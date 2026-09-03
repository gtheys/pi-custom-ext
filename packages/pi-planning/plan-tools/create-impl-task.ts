/**
 * tw_create_impl_task tool — create an implementation task under a phase.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'
import { createTaskAndGetUuid } from './helpers.ts'

export function registerTwCreateImplTask(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'tw_create_impl_task',
    label: 'TW: Create Impl Task',
    description:
      'Create an implementation task in taskwarrior under a phase. Sets work_state:todo and +impl tag. Use the UUID from tw_create_phase as depends_uuid.',
    promptSnippet: 'Create an implementation task under a phase in taskwarrior',
    parameters: Type.Object({
      jira_id: Type.String({ description: 'Jira ticket ID' }),
      title: Type.String({
        description: "Task title, e.g. '1.1 Add migration for users table'",
      }),
      project: Type.String({
        description: 'Project suffix. Will be stored as SalaryHero.<project>.',
      }),
      repo: Type.String({ description: 'Repository name' }),
      depends_uuid: Type.String({
        description: 'UUID of the parent phase task from tw_create_phase',
      }),
    }),
    async execute(_id, params) {
      const uuid = await createTaskAndGetUuid(
        pi,
        [
          'add',
          params.title,
          `project:SalaryHero.${params.project}`,
          `jiraid:${params.jira_id}`,
          `repository:${params.repo}`,
          'work_state:todo',
          '+impl',
          `depends:${params.depends_uuid}`,
        ],
        'impl task',
      )

      return {
        content: [
          {
            type: 'text',
            text: `Created impl task "${params.title}" (UUID: ${uuid})`,
          },
        ],
        details: { uuid },
      }
    },
  })
}
