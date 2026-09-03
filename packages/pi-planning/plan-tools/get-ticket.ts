/**
 * tw_get_ticket tool — fetch Jira ticket details from taskwarrior by Jira ID.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'
import { type TwTask, twExport } from '../shared/tw-utils.ts'

export function registerTwGetTicket(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'tw_get_ticket',
    label: 'TW: Get Ticket',
    description:
      'Fetch Jira ticket details from taskwarrior by Jira ID. Returns parsed task fields: description, jiradescription, jirasummary, jirastatus, jiraurl, jiraissuetype, jiraparent, tags, project.',
    promptSnippet: 'Fetch Jira ticket details from taskwarrior',
    parameters: Type.Object({
      jira_id: Type.String({
        description: 'Jira ticket ID, e.g. IMP-7070 or DP-92',
      }),
    }),
    async execute(_id, params) {
      const tasks = await twExport(pi, [`jiraid:${params.jira_id}`, '+jira'])
      if (tasks.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No taskwarrior task found for "${params.jira_id}". Run \`bugwarrior pull\` to sync, or provide ticket details manually.`,
            },
          ],
          details: { found: false, task: undefined as TwTask | undefined },
        }
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(tasks[0], null, 2) }],
        details: { found: true, task: tasks[0] as TwTask | undefined },
      }
    },
  })
}
