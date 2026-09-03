/** Shared taskwarrior exec helpers for the pi-planning tools. */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

/**
 * Taskwarrior `task <filter> export` row.
 *
 * AIDEV-NOTE: only the fields read by the planning extensions are typed; the
 * `[key: string]: unknown` index signature preserves the rest of the export
 * payload without resorting to `any`.
 */
export interface TwTask {
  uuid: string
  description: string
  tags?: string[]
  depends?: string[]
  annotations?: Array<{ entry?: string; description?: string }>
  work_state?: string
  status?: string
  [key: string]: unknown
}

/** Run `task <filter> export` and parse the JSON result. */
export async function twExport(
  pi: ExtensionAPI,
  filter: string[],
): Promise<TwTask[]> {
  const result = await pi.exec('task', [...filter, 'export'], {})
  if (!result.stdout.trim()) return []
  try {
    return JSON.parse(result.stdout) as TwTask[]
  } catch {
    return []
  }
}

/**
 * Close a taskwarrior task: sets work_state:done then runs `task done`
 * so it's also closed as status:completed. Shared by tw_advance_task and
 * tw_phase_checkpoint — both need the same two-call sequence.
 */
export async function twMarkDone(
  pi: ExtensionAPI,
  uuid: string,
): Promise<void> {
  await pi.exec(
    'task',
    [uuid, 'modify', 'work_state:done', 'rc.confirmation:no'],
    {},
  )
  await pi.exec('task', [uuid, 'done', 'rc.confirmation:no'], {})
}
