/**
 * /openspec-propose-jira and /openspec-new-jira: fetch a ticket from
 * taskwarrior by Jira ID, then hand off to the matching openspec skill.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

// AIDEV-NOTE: kept local instead of depending on @gtheys/pi-planning — this
// package must work standalone without that extension installed.
interface TwTask {
  uuid: string
  description: string
  jirasummary?: string
  jiradescription?: string
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

function buildChangeBrief(jiraId: string, task: TwTask): string {
  const summary = task.jirasummary ?? task.description
  const description = task.jiradescription ?? ''
  const name = toKebabCase(`${jiraId}-${summary}`)
  const brief = description ? `${summary}\n\n${description}` : summary
  return `${name}: ${jiraId} ${brief}`
}

async function routeToSkill(
  pi: ExtensionAPI,
  ctx: Parameters<Parameters<ExtensionAPI['registerCommand']>[1]['handler']>[1],
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

  ctx.ui.notify(`Fetching ${jiraId} from taskwarrior...`, 'info')
  const task = await fetchJiraTicket(pi, jiraId)
  if (!task) {
    ctx.ui.notify(
      `No taskwarrior task found for "${jiraId}". Run \`bugwarrior pull\` to sync.`,
      'error',
    )
    return
  }

  const brief = buildChangeBrief(jiraId, task)
  pi.sendUserMessage(`/skill:${skillName} ${brief}`)
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand('openspec-propose-jira', {
    description: 'Propose an OpenSpec change from a Jira ticket',
    handler: (args, ctx) => routeToSkill(pi, ctx, 'openspec-propose', args),
  })

  pi.registerCommand('openspec-new-jira', {
    description: 'Start a new OpenSpec change from a Jira ticket',
    handler: (args, ctx) => routeToSkill(pi, ctx, 'openspec-new-change', args),
  })
}
