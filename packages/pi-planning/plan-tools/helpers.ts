/**
 * Shared helpers for the plan-tools read/write tool registrations.
 */

import { join } from 'node:path'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'
import { type TwTask, twExport } from '../shared/tw-utils.ts'

export async function getRepoName(pi: ExtensionAPI): Promise<string> {
  // ponytail: git rev-parse --show-toplevel always works in a repo; remote URL is optional
  try {
    const r = await pi.exec('git', ['rev-parse', '--show-toplevel'], {})
    if (r.stdout.trim()) return r.stdout.trim().split('/').pop() ?? 'unknown'
  } catch {
    // Not a git repo or git unavailable — fall through to 'unknown' below.
  }
  return 'unknown'
}

// AIDEV-NOTE: Shared slug rule — lowercase, strip non-alnum, max 5 words,
// dashes. Used by both resolveSpecPath and resolveFeaturePath.
export function slugify(summary: string): string {
  return summary
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('-')
}

export async function resolveSpecPath(
  pi: ExtensionAPI,
  jiraId: string,
  summary: string,
): Promise<string> {
  const repoName = await getRepoName(pi)
  const slug = slugify(summary)

  const notesRoot = process.env.LLM_NOTES_ROOT
  let specDir: string
  if (notesRoot) {
    specDir = join(notesRoot, repoName, 'notes', 'specs')
  } else {
    const r = await pi.exec('git', ['rev-parse', '--show-toplevel'], {})
    specDir = join(r.stdout.trim(), 'notes', 'specs')
  }

  return join(specDir, `${jiraId}__${slug}.md`)
}

// AIDEV-NOTE: Feature path contract — if $PERSONAL_FEATURES is set, feature
// plans live in $PERSONAL_FEATURES/<repo>/<date>-<slug>/plan.md (personal
// cross-repo features collection). Otherwise fall back to the repo-local
// <git-toplevel>/.pi/plans/<date>-<slug>/plan.md.
export async function resolveFeaturePath(
  pi: ExtensionAPI,
  summary: string,
): Promise<string> {
  const date = new Date().toISOString().slice(0, 10)
  const slug = slugify(summary)

  const personalFeatures = process.env.PERSONAL_FEATURES
  let dir: string
  if (personalFeatures) {
    const repoName = await getRepoName(pi)
    dir = join(personalFeatures, repoName, `${date}-${slug}`)
  } else {
    const r = await pi.exec('git', ['rev-parse', '--show-toplevel'], {})
    dir = join(r.stdout.trim(), '.pi', 'plans', `${date}-${slug}`)
  }

  return join(dir, 'plan.md')
}

// AIDEV-NOTE: Annotation format is "Spec(repo=<repo>): <relative-path>"
export function extractSpecPath(task: TwTask): string | null {
  const annotations = task.annotations ?? []
  for (const ann of annotations) {
    const match = (ann.description ?? '').match(/Spec\(repo=[^)]+\):\s*(.+)/)
    if (match) return match[1].trim()
  }
  return null
}

export async function getTaskUuid(
  pi: ExtensionAPI,
  taskId: string,
): Promise<string> {
  const r = await pi.exec('task', [taskId, '_get', 'uuid'], {})
  return r.stdout.trim()
}

// AIDEV-NOTE: Shared by tw_get_phases/tw_get_impl_tasks — identical bodies,
// only the tag differs.
export async function listTaggedTasks(
  pi: ExtensionAPI,
  jiraId: string,
  tag: string,
) {
  const tasks = await twExport(pi, [`jiraid:${jiraId}`, `+${tag}`])
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(tasks, null, 2) }],
    details: { count: tasks.length, tasks },
  }
}

// Shared param schema — tw_get_spec_task, tw_get_phases, tw_get_impl_tasks
// all take just a Jira ID.
export const jiraIdParams = Type.Object({
  jira_id: Type.String({ description: 'Jira ticket ID' }),
})

// AIDEV-NOTE: Shared by the three tw_create_* tools — each just built the same
// `task add [...args] -> parse "Created task N" -> throw or getTaskUuid`
// sequence inline. One helper, one place to fix if the output format changes.
export async function createTaskAndGetUuid(
  pi: ExtensionAPI,
  args: string[],
  errorLabel: string,
): Promise<string> {
  const addResult = await pi.exec('task', [...args, 'rc.confirmation:no'], {})

  const match = addResult.stdout.match(/Created task (\d+)/)
  if (!match) {
    throw new Error(
      `Failed to create ${errorLabel}: ${addResult.stdout} ${addResult.stderr}`,
    )
  }

  // biome-ignore lint/style/noNonNullAssertion: regex '/Created task (\d+)' guarantees capture group 1
  return getTaskUuid(pi, match[1]!)
}

// AIDEV-NOTE: tw_get_phases and tw_get_impl_tasks differ only in name/
// description/tag — registered through this factory instead of two
// near-identical pi.registerTool({...}) blocks.
export function registerTagListTool(
  pi: ExtensionAPI,
  opts: {
    name: string
    label: string
    description: string
    promptSnippet: string
    tag: string
  },
) {
  pi.registerTool({
    name: opts.name,
    label: opts.label,
    description: opts.description,
    promptSnippet: opts.promptSnippet,
    parameters: jiraIdParams,
    async execute(_id, params) {
      return listTaggedTasks(pi, params.jira_id, opts.tag)
    },
  })
}
