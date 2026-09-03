/**
 * tw_get_spec_task tool — fetch the spec task for a Jira ticket and extract
 * the spec file path from its annotation.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { type TwTask, twExport } from '../shared/tw-utils.ts'
import { extractSpecPath, jiraIdParams } from './helpers.ts'

export function registerTwGetSpecTask(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'tw_get_spec_task',
    label: 'TW: Get Spec Task',
    description:
      'Fetch the spec task for a Jira ticket. Returns the task and extracts the spec file path from its annotation (pattern: Spec(repo=<repo>): <path>). specPath is null if no annotation found.',
    promptSnippet: 'Fetch spec task and spec file path for a Jira ticket',
    parameters: jiraIdParams,
    async execute(_id, params) {
      const tasks = await twExport(pi, [`jiraid:${params.jira_id}`, '+spec'])
      if (tasks.length === 0) {
        return {
          content: [
            { type: 'text', text: `No spec task found for ${params.jira_id}.` },
          ],
          details: {
            found: false,
            specPath: null as string | null,
            task: undefined as TwTask | undefined,
          },
        }
      }
      const task = tasks[0]
      const specPath = extractSpecPath(task)
      return {
        content: [
          { type: 'text', text: JSON.stringify({ task, specPath }, null, 2) },
        ],
        details: { found: true, task: task as TwTask | undefined, specPath },
      }
    },
  })
}
