/**
 * /openspec-propose-jira, /openspec-new-jira, /openspec-apply-jira: fetch a
 * ticket from taskwarrior by Jira ID, then hand off to the matching
 * openspec skill. apply-jira also verifies/creates the feature branch first.
 *
 * Also: an `openspec` query tool and before_agent_start auto-context
 * injection, so the agent always has current spec-driven state.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'
import {
  findOpenSpecRoot,
  getDefaultStoreId,
  resolveQueryScope,
} from './scope.ts'
import { registerStatusWidget } from './status-widget.ts'

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '').trim()
}

// AIDEV-NOTE: kept local instead of depending on @gtheys/pi-planning — this
// package must work standalone without that extension installed.

/** Notify once if a repo-local openspec/ root exists but a different store is being forced. */
function warnIfLocalRootOverridden(
  ctx: CommandContext,
  cwd: string,
  storeId: string | undefined,
) {
  if (!storeId) return
  const root = findOpenSpecRoot(cwd)
  if (root) {
    ctx.ui.notify(
      `Local openspec/ root found at ${root} — using configured defaultStore "${storeId}" instead (--store).`,
      'info',
    )
  }
}
interface TwTask {
  uuid: string
  description: string
  jirasummary?: string
  jiradescription?: string
  jiraissuetype?: string
  [key: string]: unknown
}

async function twExport(pi: ExtensionAPI, filter: string[]): Promise<TwTask[]> {
  const result = await pi.exec('task', [...filter, 'export'], {})
  if (!result.stdout.trim()) return []
  try {
    return JSON.parse(result.stdout) as TwTask[]
  } catch {
    return []
  }
}

function toKebabCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .join('-')
}

async function fetchJiraTicket(
  pi: ExtensionAPI,
  jiraId: string,
): Promise<TwTask | null> {
  const tasks = await twExport(pi, [`jiraid:${jiraId}`, '+jira'])
  return tasks[0] ?? null
}

/** Fetch a ticket, notifying and returning null if taskwarrior has no match. */
async function fetchJiraTicketOrNotify(
  pi: ExtensionAPI,
  ctx: CommandContext,
  jiraId: string,
): Promise<TwTask | null> {
  ctx.ui.notify(`Fetching ${jiraId} from taskwarrior...`, 'info')
  const task = await fetchJiraTicket(pi, jiraId)
  if (!task) {
    ctx.ui.notify(
      `No taskwarrior task found for "${jiraId}". Run \`bugwarrior pull\` to sync.`,
      'error',
    )
  }
  return task
}

function buildChangeBrief(jiraId: string, task: TwTask): string {
  const summary = task.jirasummary ?? task.description
  const description = task.jiradescription ?? ''
  const name = toKebabCase(`${jiraId}-${summary}`)
  const brief = description ? `${summary}\n\n${description}` : summary
  return `${name}: ${jiraId} ${brief}`
}

// ── Branch derivation ─────────────────────────────────────────────────────────
// AIDEV-NOTE: mirrors skills/engineering/implement-plan/scripts/jira-branch.sh
// (issue-type prefix map + 5-word slug + git-town parent) so both flows
// produce the same branch for the same ticket.

const TYPE_PREFIX_MAP: Record<string, string> = {
  bug: 'bugfix',
  hotfix: 'hotfix',
  story: 'feature',
  feature: 'feature',
  epic: 'feature',
  task: 'chore',
  'sub-task': 'chore',
  subtask: 'chore',
  improvement: 'feature',
  'technical debt': 'chore',
  spike: 'chore',
}
const DEFAULT_PREFIX = 'feature'
const PARENT_BRANCH = 'develop'

function deriveBranchName(
  jiraId: string,
  issueType: string | undefined,
  summary: string,
): string {
  const prefix =
    TYPE_PREFIX_MAP[(issueType ?? '').toLowerCase()] ?? DEFAULT_PREFIX
  const slug = summary
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .split('-')
    .slice(0, 5)
    .join('-')
  return `${prefix}/${jiraId}-${slug}`
}

type CommandContext = Parameters<
  Parameters<ExtensionAPI['registerCommand']>[1]['handler']
>[1]

/** Verify or create the branch for `jiraId`; returns the branch name, or null on failure. */
async function ensureBranch(
  pi: ExtensionAPI,
  ctx: CommandContext,
  jiraId: string,
  task: TwTask,
): Promise<string | null> {
  const summary = task.jirasummary ?? task.description
  const branch = deriveBranchName(jiraId, task.jiraissuetype, summary)

  const current = await pi.exec(
    'git',
    ['rev-parse', '--abbrev-ref', 'HEAD'],
    {},
  )
  if (current.code !== 0) {
    ctx.ui.notify(`Not inside a git repository: ${current.stderr}`, 'error')
    return null
  }
  if (current.stdout.trim() === branch) {
    ctx.ui.notify(`Already on branch '${branch}'`, 'info')
    return branch
  }

  const exists = await pi.exec(
    'git',
    ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`],
    {},
  )
  if (exists.code === 0) {
    ctx.ui.notify(`Branch '${branch}' exists, checking out...`, 'info')
    const checkout = await pi.exec('git', ['checkout', branch], {})
    if (checkout.code !== 0) {
      ctx.ui.notify(
        `Failed to checkout '${branch}': ${checkout.stderr}`,
        'error',
      )
      return null
    }
    return branch
  }

  ctx.ui.notify(`Creating branch '${branch}'...`, 'info')
  const create = await pi.exec('git', ['checkout', '-b', branch], {})
  if (create.code !== 0) {
    ctx.ui.notify(`Failed to create '${branch}': ${create.stderr}`, 'error')
    return null
  }

  const setParent = await pi.exec(
    'git',
    ['town', 'set-parent', PARENT_BRANCH],
    {},
  )
  if (setParent.code !== 0) {
    ctx.ui.notify(
      `Branch created, but 'git town set-parent ${PARENT_BRANCH}' failed (git-town not installed?): ${setParent.stderr}`,
      'warning',
    )
  }

  return branch
}

/** Find an openspec change whose name contains the Jira ID (case-insensitive). */
async function findChangeName(
  pi: ExtensionAPI,
  jiraId: string,
  storeId: string | undefined,
): Promise<string | null> {
  const args = ['list', '--json']
  if (storeId) args.push('--store', storeId)
  const result = await pi.exec('openspec', args, {})
  if (result.code !== 0) return null
  try {
    const parsed = JSON.parse(result.stdout) as {
      changes?: Array<{ name: string }>
    }
    // AIDEV-NOTE: strip non-alphanumerics before matching — change names don't
    // reliably preserve the JIRA-ID's dash (e.g. "DP-205" -> "migrate-dp205-...").
    const needle = jiraId.toLowerCase().replace(/[^a-z0-9]/g, '')
    const matches = (parsed.changes ?? []).filter((c) =>
      c.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .includes(needle),
    )
    return matches.length === 1 ? matches[0].name : null
  } catch {
    return null
  }
}

async function routeToSkill(
  pi: ExtensionAPI,
  ctx: CommandContext,
  skillName: string,
  args: string,
) {
  const jiraId = args.trim().toUpperCase()
  if (!jiraId) {
    ctx.ui.notify(
      `Usage: /${skillName === 'openspec-propose' ? 'openspec-propose-jira' : 'openspec-new-jira'} <JIRA-ID>`,
      'warning',
    )
    return
  }

  const task = await fetchJiraTicketOrNotify(pi, ctx, jiraId)
  if (!task) return

  const brief = buildChangeBrief(jiraId, task)
  const storeId = getDefaultStoreId()
  warnIfLocalRootOverridden(ctx, ctx.cwd, storeId)
  const storeSuffix = storeId ? ` --store "${storeId}"` : ''
  pi.sendUserMessage(`/skill:${skillName} ${brief}${storeSuffix}`)
}

async function routeToApply(
  pi: ExtensionAPI,
  ctx: CommandContext,
  args: string,
) {
  const jiraId = args.trim().toUpperCase()
  if (!jiraId) {
    ctx.ui.notify('Usage: /openspec-apply-jira <JIRA-ID>', 'warning')
    return
  }

  const task = await fetchJiraTicketOrNotify(pi, ctx, jiraId)
  if (!task) return

  const branch = await ensureBranch(pi, ctx, jiraId, task)
  if (!branch) return

  const storeId = getDefaultStoreId()
  warnIfLocalRootOverridden(ctx, ctx.cwd, storeId)
  const changeName = await findChangeName(pi, jiraId, storeId)
  const target = changeName ?? jiraId
  const storeSuffix = storeId ? ` --store "${storeId}"` : ''
  pi.sendUserMessage(`/skill:openspec-apply-change ${target}${storeSuffix}`)
}

async function routeToArchive(
  pi: ExtensionAPI,
  ctx: CommandContext,
  args: string,
) {
  const jiraId = args.trim().toUpperCase()
  if (!jiraId) {
    ctx.ui.notify('Usage: /openspec-archive-jira <JIRA-ID>', 'warning')
    return
  }

  const task = await fetchJiraTicketOrNotify(pi, ctx, jiraId)
  if (!task) return

  const storeId = getDefaultStoreId()
  warnIfLocalRootOverridden(ctx, ctx.cwd, storeId)
  const changeName = await findChangeName(pi, jiraId, storeId)
  if (!changeName) {
    ctx.ui.notify(
      `No single openspec change matches "${jiraId}" in ${storeId ? `store "${storeId}"` : 'the local root'}.`,
      'error',
    )
    return
  }

  const storeSuffix = storeId ? ` --store "${storeId}"` : ''
  pi.sendUserMessage(
    `/skill:openspec-archive-change ${changeName}${storeSuffix}`,
  )
}

// ── Native openspec tool + auto-context injection ────────────────────────────

let cachedContextKey: string | null = null
let cachedContextText = ''

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: 'openspec',
    label: 'OpenSpec Specs',
    description:
      'Inspect OpenSpec spec-driven development state. Commands: status, doctor, context, list, show, validate. Always targets the configured defaultStore.',
    promptSnippet:
      'openspec: Query spec-driven development state (status, doctor, context, list, show, validate)',
    parameters: Type.Object({
      command: Type.String({
        description: 'status, doctor, context, list, show, or validate',
      }),
      change: Type.Optional(
        Type.String({ description: 'change name (for status/show)' }),
      ),
      json: Type.Optional(Type.Boolean({ description: 'return JSON output' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const scope = await resolveQueryScope(pi, ctx.cwd)
      const args = [params.command, ...scope.storeArgs]
      if (params.json) args.push('--json')
      if (params.change) args.push('--change', params.change)
      const result = await pi.exec('openspec', args, { cwd: scope.cliCwd })
      const output = stripAnsi(
        result.code !== 0 ? result.stderr : result.stdout,
      )
      return {
        content: [{ type: 'text', text: output || '(no output)' }],
        details: { code: result.code },
      }
    },
  })

  pi.on('before_agent_start', async (event) => {
    const cwd = event.systemPromptOptions.cwd
    const scope = await resolveQueryScope(pi, cwd)
    const cacheKey = `${scope.cliCwd}:${scope.storeArgs.join(' ')}`

    if (cachedContextKey !== cacheKey) {
      const result = await pi.exec(
        'openspec',
        ['context', ...scope.storeArgs],
        {
          cwd: scope.cliCwd,
        },
      )
      cachedContextKey = cacheKey
      cachedContextText = result.code === 0 ? stripAnsi(result.stdout) : ''
    }
    if (!cachedContextText) return

    return {
      systemPrompt: `${event.systemPrompt}\n\n[OpenSpec context]\n${cachedContextText}`,
    }
  })

  registerStatusWidget(pi)

  pi.registerCommand('openspec-propose-jira', {
    description: 'Propose an OpenSpec change from a Jira ticket',
    handler: (args, ctx) => routeToSkill(pi, ctx, 'openspec-propose', args),
  })

  pi.registerCommand('openspec-new-jira', {
    description: 'Start a new OpenSpec change from a Jira ticket',
    handler: (args, ctx) => routeToSkill(pi, ctx, 'openspec-new-change', args),
  })

  pi.registerCommand('openspec-apply-jira', {
    description:
      'Verify/create the feature branch for a Jira ticket, then implement its OpenSpec change',
    handler: (args, ctx) => routeToApply(pi, ctx, args),
  })

  pi.registerCommand('openspec-archive-jira', {
    description: 'Archive the OpenSpec change matching a Jira ticket',
    handler: (args, ctx) => routeToArchive(pi, ctx, args),
  })
}
