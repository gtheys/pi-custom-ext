/**
 * tw_phase_checkpoint tool — marks a phase task done in taskwarrior and
 * returns a ready-made conventional commit message.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'
import { twMarkDone } from '../shared/tw-utils.ts'

// AIDEV-NOTE: Does NOT run tests or commit — caller (skill) runs run_tests
// first, then calls this, then presents the commit message to the user
// for confirmation.
export function registerTwPhaseCheckpoint(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'tw_phase_checkpoint',
    label: 'TW: Phase Checkpoint',
    description: [
      'Mark a phase task as done in taskwarrior and return a ready-made git commit message.',
      'Call this AFTER tests pass and AFTER user confirms the phase is complete.',
      'Does not run tests or commit — use run_tests before calling this.',
      'Returns commitMessage in details for the user to confirm before committing.',
    ].join(' '),
    promptSnippet: 'Mark phase done in TW and return git commit message',
    parameters: Type.Object({
      jira_id: Type.String({ description: 'Jira ticket ID, e.g. DP-121' }),
      phase_uuid: Type.String({ description: 'UUID of the phase task' }),
      phase_number: Type.Number({ description: 'Phase number, e.g. 2' }),
      phase_name: Type.String({
        description: "Phase name, e.g. 'Database Schema'",
      }),
    }),
    async execute(_id, params) {
      await twMarkDone(pi, params.phase_uuid)

      const commitMessage = `feat(${params.jira_id}): Phase ${params.phase_number} - ${params.phase_name}`

      return {
        content: [
          {
            type: 'text',
            text: [
              `Phase ${params.phase_number} "${params.phase_name}" marked done.`,
              ``,
              `Suggested commit message:`,
              `  ${commitMessage}`,
              ``,
              `Run: git add -u && git commit -m "${commitMessage}"`,
            ].join('\n'),
          },
        ],
        details: { uuid: params.phase_uuid, commitMessage },
      }
    },
  })
}
