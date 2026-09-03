/**
 * tw_create_spec_task tool — create a spec task and annotate it with the
 * spec file path.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'
import { createTaskAndGetUuid } from './helpers.ts'

export function registerTwCreateSpecTask(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'tw_create_spec_task',
    label: 'TW: Create Spec Task',
    description:
      'Create a spec task in taskwarrior and annotate it with the spec file path. Sets work_state:approved and +spec tag. Project is prefixed with SalaryHero automatically. Returns the task UUID.',
    promptSnippet:
      'Create a spec task in taskwarrior with spec file annotation',
    parameters: Type.Object({
      jira_id: Type.String({ description: 'Jira ticket ID' }),
      summary: Type.String({ description: 'Jira summary/title' }),
      project: Type.String({
        description:
          "Project suffix, e.g. 'backend'. Will be stored as SalaryHero.<project>.",
      }),
      repo: Type.String({
        description: 'Repository name for the spec annotation',
      }),
      spec_path: Type.String({
        description:
          'Relative spec file path, e.g. notes/specs/IMP-7070__slug.md',
      }),
    }),
    async execute(_id, params) {
      const uuid = await createTaskAndGetUuid(
        pi,
        [
          'add',
          `SPEC: ${params.jira_id} ${params.summary}`,
          `project:SalaryHero.${params.project}`,
          `jiraid:${params.jira_id}`,
          'work_state:approved',
          '+spec',
        ],
        'spec task',
      )
      const specAnnotation = `Spec(repo=${params.repo}): ${params.spec_path}`
      await pi.exec(
        'task',
        [uuid, 'annotate', specAnnotation, 'rc.confirmation:no'],
        {},
      )

      return {
        content: [
          {
            type: 'text',
            text: `Created spec task (UUID: ${uuid})\nAnnotated: ${specAnnotation}`,
          },
        ],
        details: { uuid },
      }
    },
  })
}
