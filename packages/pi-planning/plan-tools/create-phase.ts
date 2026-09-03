/**
 * tw_create_phase tool — create a phase task in taskwarrior.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'
import { createTaskAndGetUuid } from './helpers.ts'

export function registerTwCreatePhase(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'tw_create_phase',
    label: 'TW: Create Phase',
    description:
      'Create a phase task in taskwarrior. Sets work_state:todo and +impl +phase tags. Returns the task UUID — pass this as depends_uuid to tw_create_impl_task.',
    promptSnippet:
      'Create a phase task in taskwarrior, returns UUID for depends',
    parameters: Type.Object({
      jira_id: Type.String({ description: 'Jira ticket ID' }),
      phase_number: Type.Number({ description: 'Phase number, e.g. 1, 2, 3' }),
      phase_name: Type.String({
        description: "Phase name, e.g. 'Database Schema'",
      }),
      project: Type.String({
        description: 'Project suffix. Will be stored as SalaryHero.<project>.',
      }),
      repo: Type.String({ description: 'Repository name' }),
    }),
    async execute(_id, params) {
      const uuid = await createTaskAndGetUuid(
        pi,
        [
          'add',
          `${params.phase_number}. Phase: ${params.phase_name}`,
          `project:SalaryHero.${params.project}`,
          `jiraid:${params.jira_id}`,
          `repository:${params.repo}`,
          'work_state:todo',
          '+impl',
          '+phase',
        ],
        'phase task',
      )

      return {
        content: [
          {
            type: 'text',
            text: `Created phase "${params.phase_number}. Phase: ${params.phase_name}" (UUID: ${uuid})`,
          },
        ],
        details: { uuid },
      }
    },
  })
}
