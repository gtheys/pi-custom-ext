/**
 * tw_advance_task tool — single entry point for all task state transitions.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'
import { twMarkDone } from '../shared/tw-utils.ts'

// AIDEV-NOTE: Static lookup instead of `work_state:${state}` interpolation —
// keeps the exec arg a fixed string per branch, not a runtime-built one.
const WORK_STATE_ARG = {
  todo: 'work_state:todo',
  inprogress: 'work_state:inprogress',
  done: 'work_state:done',
} as const

// AIDEV-NOTE: When state=done, twMarkDone calls both `modify work_state:done`
// AND `task done` so the task is closed in taskwarrior (status:completed).
export function registerTwAdvanceTask(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'tw_advance_task',
    label: 'TW: Advance Task',
    description: [
      'Transition a taskwarrior task to a new work_state.',
      'Valid states: todo, inprogress, done.',
      'When state=done: also calls `task done` to close the task (status:completed).',
      'Use for both phase tasks and subtasks.',
    ].join(' '),
    promptSnippet: 'Transition a task to todo/inprogress/done',
    parameters: Type.Object({
      uuid: Type.String({ description: 'Task UUID' }),
      state: Type.Union(
        [
          Type.Literal('todo'),
          Type.Literal('inprogress'),
          Type.Literal('done'),
        ],
        { description: 'Target work_state' },
      ),
      description: Type.Optional(
        Type.String({
          description: 'Task description (for confirmation output only)',
        }),
      ),
    }),
    async execute(_id, params) {
      if (params.state === 'done') {
        await twMarkDone(pi, params.uuid)
      } else {
        await pi.exec(
          'task',
          [
            params.uuid,
            'modify',
            WORK_STATE_ARG[params.state],
            'rc.confirmation:no',
          ],
          {},
        )
      }

      let label: string
      if (params.description) {
        label = `"${params.description}"`
      } else {
        label = params.uuid
      }
      return {
        content: [{ type: 'text', text: `Task ${label} → ${params.state}` }],
        details: { uuid: params.uuid, state: params.state },
      }
    },
  })
}
