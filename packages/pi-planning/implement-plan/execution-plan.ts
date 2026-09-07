/**
 * tw_execution_plan tool — full sorted task tree for a Jira ID
 * (phases + subtasks + work_state). Also exports the plan builder/formatter
 * for reuse by the /implement command in index.ts.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'
import { type TwTask, twExport } from '../shared/tw-utils.ts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Subtask {
  uuid: string
  number: string // e.g. "2.3"
  name: string
  work_state: string
}

interface Phase {
  uuid: string
  number: number
  name: string
  work_state: string
  subtasks: Subtask[]
}

export interface ExecutionPlan {
  jiraId: string
  phases: Phase[]
  currentPhase: Phase | null
  currentSubtask: Subtask | null
  totalSubtasks: number
  doneSubtasks: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePhaseNumber(description: string): number | null {
  const m = description.match(/^(\d+)\.\s*Phase:/i)
  const n = m?.[1]
  return n ? parseInt(n, 10) : null
}

function parseSubtaskNumber(description: string): string | null {
  const m = description.match(/^(\d+\.\d+)/)
  return m?.[1] ?? null
}

function parseSubtaskName(description: string): string {
  // Strip leading "N.M " prefix
  return description.replace(/^\d+\.\d+\s+/, '').trim()
}

function parsePhaseName(description: string): string {
  // Strip leading "N. Phase: " prefix
  return description.replace(/^\d+\.\s*Phase:\s*/i, '').trim()
}

function sortByPrefix(
  tasks: TwTask[],
  getKey: (t: TwTask) => number | null,
): TwTask[] {
  return [...tasks].sort((a, b) => {
    const ka = getKey(a) ?? 999
    const kb = getKey(b) ?? 999
    return ka - kb
  })
}

function sortSubtasks(tasks: TwTask[]): TwTask[] {
  return [...tasks].sort((a, b) => {
    const na = parseSubtaskNumber(a.description)
    const nb = parseSubtaskNumber(b.description)
    if (!na || !nb) return 0
    const [, am] = na.split('.').map(Number) as [number, number]
    const [, bm] = nb.split('.').map(Number) as [number, number]
    return am - bm
  })
}

function firstNonDone<T extends { work_state: string }>(items: T[]): T | null {
  return items.find((i) => i.work_state !== 'done') ?? null
}

// AIDEV-NOTE: Builds a full execution plan from raw TW tasks.
// Phases sorted by N. prefix, subtasks sorted by N.M prefix.
// currentPhase/currentSubtask point to the first non-done item — resume target.
export function buildExecutionPlan(
  jiraId: string,
  allTasks: TwTask[],
): ExecutionPlan {
  const phaseTasks = allTasks.filter(
    (t) => (t.tags ?? []).includes('phase') && (t.tags ?? []).includes('impl'),
  )
  const implOnlyTasks = allTasks.filter(
    (t) => (t.tags ?? []).includes('impl') && !(t.tags ?? []).includes('phase'),
  )

  const sortedPhases = sortByPrefix(phaseTasks, (t) =>
    parsePhaseNumber(t.description),
  )

  const phases: Phase[] = sortedPhases.map((pt) => {
    const subtaskRaw = implOnlyTasks.filter((t) =>
      (t.depends ?? []).includes(pt.uuid),
    )
    const sorted = sortSubtasks(subtaskRaw)
    const subtasks: Subtask[] = sorted.map((st) => ({
      uuid: st.uuid,
      number: parseSubtaskNumber(st.description) ?? st.description,
      name: parseSubtaskName(st.description),
      work_state: st.work_state ?? 'todo',
    }))

    return {
      uuid: pt.uuid,
      number: parsePhaseNumber(pt.description) ?? 0,
      name: parsePhaseName(pt.description),
      work_state: pt.work_state ?? 'todo',
      subtasks,
    }
  })

  const totalSubtasks = phases.reduce((n, p) => n + p.subtasks.length, 0)
  const doneSubtasks = phases.reduce(
    (n, p) => n + p.subtasks.filter((s) => s.work_state === 'done').length,
    0,
  )

  // Resume target: first non-done phase, then first non-done subtask within it
  const currentPhase = firstNonDone(phases)
  let currentSubtask: Subtask | null = null
  if (currentPhase) {
    currentSubtask = firstNonDone(currentPhase.subtasks)
  }

  return {
    jiraId,
    phases,
    currentPhase,
    currentSubtask,
    totalSubtasks,
    doneSubtasks,
  }
}

// AIDEV-NOTE: Feature-flow scoping — a project may contain several features'
// trees, so the feature path cannot filter by project alone. Phases are
// +phase +impl tasks whose depends chain includes the feature root uuid;
// subtasks are +impl tasks depending on any of those phases. buildExecutionPlan
// then groups/sorts the filtered list via that same depends structure.
export function filterFeatureTasks(
  rootUuid: string,
  allTasks: TwTask[],
): TwTask[] {
  const phases = allTasks.filter(
    (t) =>
      (t.tags ?? []).includes('phase') &&
      (t.tags ?? []).includes('impl') &&
      (t.depends ?? []).includes(rootUuid),
  )
  const phaseUuids = new Set(phases.map((p) => p.uuid))
  const subtasks = allTasks.filter(
    (t) =>
      (t.tags ?? []).includes('impl') &&
      !(t.tags ?? []).includes('phase') &&
      (t.depends ?? []).some((d) => phaseUuids.has(d)),
  )
  return [...phases, ...subtasks]
}

export function planSummary(plan: ExecutionPlan): string {
  const lines: string[] = [`Execution plan for ${plan.jiraId}:`]
  lines.push(
    `Progress: ${plan.doneSubtasks}/${plan.totalSubtasks} subtasks done`,
  )
  lines.push('')

  for (const phase of plan.phases) {
    const doneSubs = phase.subtasks.filter(
      (s) => s.work_state === 'done',
    ).length
    let icon: string
    if (phase.work_state === 'done') {
      icon = '✓'
    } else if (phase.work_state === 'inprogress') {
      icon = '▶'
    } else {
      icon = '○'
    }
    lines.push(
      `  ${icon} Phase ${phase.number}: ${phase.name} [${phase.work_state}] (${doneSubs}/${phase.subtasks.length})`,
    )
    for (const sub of phase.subtasks) {
      let sicon: string
      if (sub.work_state === 'done') {
        sicon = '  ✓'
      } else if (sub.work_state === 'inprogress') {
        sicon = '  ▶'
      } else {
        sicon = '  ○'
      }
      lines.push(`    ${sicon} ${sub.number} ${sub.name} [${sub.work_state}]`)
    }
  }

  if (plan.currentPhase) {
    lines.push('')
    if (plan.currentSubtask) {
      lines.push(
        `▶ Resume at: Phase ${plan.currentPhase.number} — subtask ${plan.currentSubtask.number} ${plan.currentSubtask.name}`,
      )
    } else {
      lines.push(
        `▶ Resume at: Phase ${plan.currentPhase.number} (all subtasks done, phase not closed)`,
      )
    }
  } else {
    lines.push('')
    lines.push('✓ All phases complete.')
  }

  return lines.join('\n')
}

// ── Params ────────────────────────────────────────────────────────────────────

export function validatePlanParams(
  params: Record<string, unknown>,
): string | null {
  const hasJira = typeof params.jira_id === 'string' && params.jira_id !== ''
  const hasFeature =
    typeof params.feature_uuid === 'string' && params.feature_uuid !== ''
  if (hasJira && hasFeature) {
    return 'Error: jira_id and feature_uuid are mutually exclusive — provide exactly one.'
  }
  if (!hasJira && !hasFeature) {
    return 'Error: exactly one of jira_id or feature_uuid is required.'
  }
  return null
}

export function registerTwExecutionPlan(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'tw_execution_plan',
    label: 'TW: Execution Plan',
    description: [
      'Fetch the full sorted implementation task tree for a Jira ID (jira_id)',
      'or a local taskwarrior feature (feature_uuid — full UUID or short prefix).',
      'Returns phases (sorted by N. prefix) each with their subtasks (sorted by N.M prefix),',
      'work_state for every item, and currentPhase/currentSubtask pointing to the first',
      'non-done item — the resume target. Use this at the start of any implement-plan session.',
    ].join(' '),
    promptSnippet:
      'Fetch full sorted implementation task tree for a Jira ID or feature UUID',
    parameters: Type.Object({
      jira_id: Type.Optional(
        Type.String({ description: 'Jira ticket ID, e.g. DP-121' }),
      ),
      feature_uuid: Type.Optional(
        Type.String({
          description:
            'Taskwarrior feature task UUID (or short prefix). Mutually exclusive with jira_id.',
        }),
      ),
    }),
    async execute(_id, params) {
      const paramError = validatePlanParams(params)
      if (paramError) {
        return { content: [{ type: 'text', text: paramError }] }
      }

      if (params.feature_uuid) {
        // AIDEV-NOTE: feature path — fetch root by uuid (prefix ok, taskwarrior
        // resolves it), then scope phases via depends-chain (see filterFeatureTasks).
        const [root] = await twExport(pi, [params.feature_uuid])
        if (!root) {
          return {
            content: [
              {
                type: 'text',
                text: `No taskwarrior task found for feature uuid ${params.feature_uuid}.`,
              },
            ],
            details: { found: false, plan: undefined },
          }
        }
        const label = `FEATURE-${root.uuid.slice(0, 8)}`
        const all = await twExport(pi, [
          '+impl',
          `project:${String(root.project ?? '')}`,
        ])
        const plan = buildExecutionPlan(
          label,
          filterFeatureTasks(root.uuid, all),
        )
        return {
          content: [{ type: 'text', text: planSummary(plan) }],
          details: { found: plan.phases.length > 0, plan },
        }
      }

      const all = await twExport(pi, [`jiraid:${params.jira_id}`, '+impl'])
      if (all.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No impl tasks found for ${params.jira_id}. Run bugwarrior-pull or check the Jira ID.`,
            },
          ],
          details: {
            found: false,
            plan: undefined as ExecutionPlan | undefined,
          },
        }
      }

      const plan = buildExecutionPlan(params.jira_id, all)
      const summary = planSummary(plan)

      return {
        content: [{ type: 'text', text: summary }],
        details: { found: true, plan },
      }
    },
  })
}
