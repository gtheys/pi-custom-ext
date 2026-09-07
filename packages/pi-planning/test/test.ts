import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { resolveFeaturePath, slugify } from '../plan-tools/helpers.ts'

const GIT_TOPLEVEL = '/home/dev/Code/acme/widgets'

function fakePi(): ExtensionAPI {
  return {
    exec: async () => ({ stdout: `${GIT_TOPLEVEL}\n`, stderr: '' }),
  } as unknown as ExtensionAPI
}

test('slugify: lowercase, strip punctuation, max 5 words', () => {
  assert.equal(
    slugify('Merge /plan command with feature-planning flow!'),
    'merge-plan-command-with-feature-planning',
  )
})

test('resolveFeaturePath: $PERSONAL_FEATURES set → repo/date/slug dir under it', async () => {
  const prev = process.env.PERSONAL_FEATURES
  process.env.PERSONAL_FEATURES = '/home/dev/features'
  try {
    const path = await resolveFeaturePath(fakePi(), 'Merge command flow')
    const date = new Date().toISOString().slice(0, 10)
    assert.equal(
      path,
      `/home/dev/features/widgets/${date}-merge-command-flow/plan.md`,
    )
  } finally {
    if (prev === undefined) delete process.env.PERSONAL_FEATURES
    else process.env.PERSONAL_FEATURES = prev
  }
})

test('resolveFeaturePath: $PERSONAL_FEATURES unset → .pi/plans under git toplevel', async () => {
  delete process.env.PERSONAL_FEATURES
  const path = await resolveFeaturePath(fakePi(), 'Add dark mode')
  const date = new Date().toISOString().slice(0, 10)
  assert.equal(path, `${GIT_TOPLEVEL}/.pi/plans/${date}-add-dark-mode/plan.md`)
})

// ── tw_execution_plan feature support ────────────────────────────────────────

import {
  buildExecutionPlan,
  filterFeatureTasks,
} from '../implement-plan/execution-plan.ts'
import type { TwTask } from '../shared/tw-utils.ts'

const F = '4f976638-8fbe-45e9-a24d-2dd93f892b9f'
const P1 = '11111111-1111-1111-1111-111111111111'
const P2 = '22222222-2222-2222-2222-222222222222'
const S11 = 'aaaa1111-1111-1111-1111-111111111111'
const S12 = 'aaaa2222-2222-2222-2222-222222222222'
const S21 = 'aaaa3333-3333-3333-3333-333333333333'
const P1_OTHER = '99999999-9999-9999-9999-999999999999' // other feature's phase

function task(
  uuid: string,
  description: string,
  tags: string[],
  depends: string[],
  work_state = 'todo',
): TwTask {
  return { uuid, description, tags, depends, work_state }
}

function featureFixture(): TwTask[] {
  return [
    task(P1, '1. Phase: X', ['phase', 'impl'], [F]),
    task(P2, '2. Phase: Y', ['phase', 'impl'], [F]),
    task(S11, '1.1 a', ['impl'], [P1]),
    task(S12, '1.2 b', ['impl'], [P1]),
    task(S21, '2.1 c', ['impl'], [P2]),
    // Same project, different feature root — must be excluded
    task(
      P1_OTHER,
      '1. Phase: Other',
      ['phase', 'impl'],
      ['deadbeef-0000-0000-0000-000000000000'],
    ),
  ]
}

test('filterFeatureTasks: keeps phases depending on root + their subtasks, excludes other features', () => {
  const filtered = filterFeatureTasks(F, featureFixture())
  assert.deepEqual(
    filtered.map((t) => t.uuid).sort(),
    [P1, P2, S11, S12, S21].sort(),
  )
})

test('buildExecutionPlan: feature fixture — sorted phases, grouped subtasks, resume target', () => {
  const plan = buildExecutionPlan(
    'FEATURE-4f976638',
    filterFeatureTasks(F, featureFixture()),
  )
  assert.equal(plan.phases.length, 2)
  assert.equal(plan.phases[0].number, 1)
  assert.equal(plan.phases[0].name, 'X')
  assert.deepEqual(
    plan.phases[0].subtasks.map((s) => s.number),
    ['1.1', '1.2'],
  )
  assert.equal(plan.phases[1].subtasks[0].number, '2.1')
  assert.equal(plan.currentPhase?.number, 1)
  assert.equal(plan.currentSubtask?.number, '1.1')
  assert.equal(plan.totalSubtasks, 3)
  assert.equal(plan.doneSubtasks, 0)
})

test('validatePlanParams: exactly one of jira_id / feature_uuid required', async () => {
  const { validatePlanParams } = await import(
    '../implement-plan/execution-plan.ts'
  )
  assert.ok(validatePlanParams({}) !== null)
  assert.ok(validatePlanParams({ jira_id: 'DP-1', feature_uuid: F }) !== null)
  assert.ok(validatePlanParams({ jira_id: 'DP-1' }) === null)
  assert.ok(validatePlanParams({ feature_uuid: F }) === null)
})
