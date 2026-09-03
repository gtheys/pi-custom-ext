/**
 * tw_get_phases / tw_get_impl_tasks tools — both just list tasks by tag,
 * registered through the shared registerTagListTool factory.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { registerTagListTool } from './helpers.ts'

export function registerGetPhasesAndImplTasks(pi: ExtensionAPI) {
  registerTagListTool(pi, {
    name: 'tw_get_phases',
    label: 'TW: Get Phases',
    description:
      'Fetch all phase tasks (+phase tag) for a Jira ticket from taskwarrior.',
    promptSnippet: 'Fetch phase tasks for a Jira ticket',
    tag: 'phase',
  })

  registerTagListTool(pi, {
    name: 'tw_get_impl_tasks',
    label: 'TW: Get Impl Tasks',
    description:
      'Fetch all implementation tasks (+impl tag) for a Jira ticket from taskwarrior.',
    promptSnippet: 'Fetch implementation tasks for a Jira ticket',
    tag: 'impl',
  })
}
