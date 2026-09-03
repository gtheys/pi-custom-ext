/**
 * Implement Plan Extension
 *
 * Provides typed taskwarrior tools for the implement-plan skill.
 * Replaces bash/jq pipelines with validated, structured tool calls.
 *
 * Tools (one per file — see each for details):
 *   tw_execution_plan     - execution-plan.ts
 *   tw_advance_task       - advance-task.ts
 *   tw_phase_checkpoint   - phase-checkpoint.ts
 *   jira_create_branch    - jira-branch-tool.ts
 *
 * Command:
 *   /implement <JIRA_ID>  - show execution plan and route to implement-plan skill
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { type TwTask, twExport } from '../shared/tw-utils.ts'
import { registerTwAdvanceTask } from './advance-task.ts'
import {
  buildExecutionPlan,
  planSummary,
  registerTwExecutionPlan,
} from './execution-plan.ts'
import { registerJiraCreateBranch } from './jira-branch-tool.ts'
import { registerTwPhaseCheckpoint } from './phase-checkpoint.ts'

export default function (pi: ExtensionAPI) {
  registerTwExecutionPlan(pi)
  registerTwAdvanceTask(pi)
  registerTwPhaseCheckpoint(pi)
  registerJiraCreateBranch(pi)

  // ── /implement command ─────────────────────────────────────────────────────

  // AIDEV-NOTE: Entry point for implement-plan skill.
  // Fetches + displays execution plan first so the user sees what's pending
  // before the skill starts executing. Routes to implement-plan skill.
  pi.registerCommand('implement', {
    description: 'Show execution plan and start implementing a Jira ticket',
    handler: async (args, ctx) => {
      const jiraId = args.trim().toUpperCase()
      if (!jiraId) {
        ctx.ui.notify(
          'Usage: /implement <JIRA_ID>  e.g. /implement DP-121',
          'warning',
        )
        return
      }

      ctx.ui.notify(`Fetching execution plan for ${jiraId}...`, 'info')

      // AIDEV-NOTE: Check issue type BEFORE evaluating impl tasks.
      // Bugs don't have spec/phase tasks — skip the "no impl tasks" guard for them.
      let isBug = false
      try {
        const ticketData = await twExport(pi, [`jiraid:${jiraId}`])
        const ticket = ticketData[0]
        if (ticket) {
          const issueType =
            (ticket as TwTask & { jiraissuetype?: string }).jiraissuetype ?? ''
          const tags = ticket.tags ?? []
          isBug = issueType === 'Bug' || tags.includes('bug')
        }
      } catch {
        // ignore — skill will handle it
      }

      let summary = ''
      try {
        const all = await twExport(pi, [`jiraid:${jiraId}`, '+impl'])
        if (all.length > 0) {
          const plan = buildExecutionPlan(jiraId, all)
          summary = `\n\n${planSummary(plan)}`
        } else if (!isBug) {
          ctx.ui.notify(
            `No impl tasks found for ${jiraId}. Has the plan been created? Try /plan ${jiraId}.`,
            'warning',
          )
          return
        }
      } catch (e) {
        ctx.ui.notify(`Could not fetch plan: ${e}`, 'warning')
        // Continue anyway — skill will handle it
      }

      pi.sendUserMessage(`/skill:implement-plan ${jiraId}${summary}`)
    },
  })
}
