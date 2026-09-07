import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseBranchInput, personalBranch, slugify } from '../branch.ts'

// --- parseBranchInput: modes ---

test('parseBranchInput: jira mode', () => {
  assert.deepEqual(parseBranchInput({ jira_id: 'IMP-7070' }), {
    kind: 'jira',
    jiraId: 'IMP-7070',
  })
})

test('parseBranchInput: personal mode with type', () => {
  assert.deepEqual(parseBranchInput({ name: 'Add Save Button', type: 'fix' }), {
    kind: 'personal',
    name: 'Add Save Button',
    type: 'fix',
  })
})

test('parseBranchInput: personal mode defaults type to feat', () => {
  assert.deepEqual(parseBranchInput({ name: 'Add Save Button' }), {
    kind: 'personal',
    name: 'Add Save Button',
    type: 'feat',
  })
})

test('parseBranchInput: literal mode', () => {
  assert.deepEqual(parseBranchInput({ branch: 'release/1.2.3' }), {
    kind: 'literal',
    branch: 'release/1.2.3',
  })
})

// --- parseBranchInput: errors ---

test('parseBranchInput: empty input errors', () => {
  assert.throws(() => parseBranchInput({}), /Missing branch input/)
})

test('parseBranchInput: jira_id + name is ambiguous', () => {
  assert.throws(
    () => parseBranchInput({ jira_id: 'IMP-1', name: 'thing' }),
    /Ambiguous branch input/,
  )
})

test('parseBranchInput: name + branch is ambiguous', () => {
  assert.throws(
    () => parseBranchInput({ name: 'thing', branch: 'x/y' }),
    /Ambiguous branch input/,
  )
})

test('parseBranchInput: all three modes is ambiguous', () => {
  assert.throws(
    () => parseBranchInput({ jira_id: 'IMP-1', name: 'n', branch: 'b' }),
    /Ambiguous branch input/,
  )
})

test('parseBranchInput: invalid type errors and lists valid values', () => {
  assert.throws(
    () => parseBranchInput({ name: 'thing', type: 'bugfix' }),
    /Invalid type 'bugfix'.*(feat, fix, chore, docs, refactor)/,
  )
})

// --- slugify: known-good literals ---

test('slugify: punctuation stripped', () => {
  assert.equal(slugify('Add Save Button & Export!'), 'add-save-button-export')
})

test('slugify: long names truncated to first 5 words', () => {
  assert.equal(
    slugify('one two three four five six seven'),
    'one-two-three-four-five',
  )
})

test('slugify: edge hyphens trimmed', () => {
  assert.equal(slugify('  -- Hello World --  '), 'hello-world')
})

test('slugify: empty after strip', () => {
  assert.equal(slugify('!!!***'), '')
})

test('slugify: numbers and case preserved as lowercase', () => {
  assert.equal(slugify('Fix CVE-2024-1234 NOW'), 'fix-cve-2024-1234-now')
})

// --- personalBranch ---

test('personalBranch: composes type/slug', () => {
  assert.equal(
    personalBranch('Add Save Button & Export!', 'feat'),
    'feat/add-save-button-export',
  )
})

test('personalBranch: each personal type', () => {
  assert.equal(personalBranch('docs', 'docs'), 'docs/docs')
  assert.equal(
    personalBranch('refactor core', 'refactor'),
    'refactor/refactor-core',
  )
})

// --- herdr.ts parsing helpers ---

// AIDEV-NOTE: fixtures mirror `herdr worktree list` / `herdr agent list`
// output captured live from herdr 0.8.2 — do not "fix" field names.
import { parseJson, pickString } from '../herdr.ts'

test('parseJson: valid JSON parses, non-JSON returns null', () => {
  assert.equal(parseJson('{"a":1}') !== null, true)
  assert.equal(parseJson('not json at all'), null)
})

test('pickString: herdr 0.8.2 worktree entry field names', () => {
  const entry = JSON.parse(
    '{"branch":"main","is_bare":false,"label":"sh-projects","open_workspace_id":"w1N","path":"/home/geert/Code/notes/sh-projects"}',
  )
  assert.equal(
    pickString(entry, ['path', 'worktree_path']),
    '/home/geert/Code/notes/sh-projects',
  )
  assert.equal(pickString(entry, ['branch', 'head']), 'main')
  assert.equal(pickString(entry, ['label', 'name']), 'sh-projects')
  assert.equal(
    pickString(entry, ['open_workspace_id', 'workspace_id', 'id']),
    'w1N',
  )
})

test('pickString: herdr 0.8.2 agent entry field names', () => {
  const entry = JSON.parse(
    '{"agent":"pi","agent_status":"working","pane_id":"w23:pX","workspace_id":"w23","cwd":"/repo"}',
  )
  assert.equal(pickString(entry, ['agent', 'name']), 'pi')
  assert.equal(
    pickString(entry, ['agent_status', 'state', 'status']),
    'working',
  )
  assert.equal(pickString(entry, ['pane_id', 'pane']), 'w23:pX')
  assert.equal(pickString(entry, ['workspace_id', 'workspace.id']), 'w23')
})

test('pickString: variant names and nested lookup', () => {
  const variants = JSON.parse(
    '{"worktree_path":"/wt","name":"alt-label","workspace":{"id":"w9"}}',
  )
  assert.equal(pickString(variants, ['path', 'worktree_path']), '/wt')
  assert.equal(pickString(variants, ['label', 'name']), 'alt-label')
  assert.equal(pickString(variants, ['workspace_id', 'workspace.id']), 'w9')
})

test('pickString: missing everywhere returns empty string', () => {
  assert.equal(pickString({}, ['path', 'worktree_path']), '')
  assert.equal(pickString(null, ['path']), '')
  assert.equal(pickString('str', ['path']), '')
})

// --- bootstrap.ts: detectBootstrapPlan ---

import { detectBootstrapPlan, selectEnvFiles } from '../bootstrap.ts'

test('detectBootstrapPlan: bun.lock', () => {
  assert.deepEqual(detectBootstrapPlan(['bun.lock', 'package.json']), {
    steps: [{ label: 'bun install', command: 'bun install', shell: false }],
  })
})

test('detectBootstrapPlan: bun.lockb variant', () => {
  assert.deepEqual(detectBootstrapPlan(['bun.lockb']), {
    steps: [{ label: 'bun install', command: 'bun install', shell: false }],
  })
})

test('detectBootstrapPlan: yarn uses shell command with GH_TOKEN', () => {
  const plan = detectBootstrapPlan(['yarn.lock', 'package.json'])
  assert.equal(plan.steps.length, 1)
  assert.equal(plan.steps[0].shell, true)
  assert.ok(plan.steps[0].command.includes('GH_TOKEN'))
  assert.ok(plan.steps[0].command.includes('gh auth token'))
  assert.ok(plan.steps[0].command.includes('yarn install'))
})

test('detectBootstrapPlan: package-lock.json → npm ci', () => {
  assert.deepEqual(detectBootstrapPlan(['package-lock.json']), {
    steps: [{ label: 'npm ci', command: 'npm ci', shell: false }],
  })
})

test('detectBootstrapPlan: pnpm-lock.yaml', () => {
  assert.deepEqual(detectBootstrapPlan(['pnpm-lock.yaml']), {
    steps: [
      {
        label: 'pnpm install',
        command: 'pnpm install --frozen-lockfile',
        shell: false,
      },
    ],
  })
})

test('detectBootstrapPlan: Cargo.toml', () => {
  assert.deepEqual(detectBootstrapPlan(['Cargo.toml', 'src/main.rs']), {
    steps: [{ label: 'cargo fetch', command: 'cargo fetch', shell: false }],
  })
})

test('detectBootstrapPlan: go.mod → note only', () => {
  assert.deepEqual(detectBootstrapPlan(['go.mod', 'main.go']), {
    steps: [],
    note: 'go: global module cache, nothing to install',
  })
})

test('detectBootstrapPlan: none → note only', () => {
  assert.deepEqual(detectBootstrapPlan(['README.md', 'index.html']), {
    steps: [],
    note: 'no recognized lockfile — nothing to bootstrap',
  })
})

test('detectBootstrapPlan: monorepo yarn.lock + Cargo.toml → 2 steps', () => {
  const plan = detectBootstrapPlan(['yarn.lock', 'Cargo.toml'])
  assert.equal(plan.steps.length, 2)
  assert.equal(plan.steps[0].label, 'yarn install')
  assert.equal(plan.steps[1].label, 'cargo fetch')
})

test('detectBootstrapPlan: bun + go.mod → install step + go note', () => {
  const plan = detectBootstrapPlan(['bun.lock', 'go.mod'])
  assert.equal(plan.steps.length, 1)
  assert.equal(plan.steps[0].label, 'bun install')
  assert.ok((plan.note ?? '').includes('go:'))
})

test('detectBootstrapPlan: multiple JS lockfiles — first in priority wins, ambiguity noted', () => {
  const plan = detectBootstrapPlan(['yarn.lock', 'pnpm-lock.yaml'])
  assert.equal(plan.steps.length, 1)
  assert.equal(plan.steps[0].label, 'yarn install')
  assert.ok((plan.note ?? '').includes('multiple JS lockfiles'))
})

// --- bootstrap.ts: selectEnvFiles ---

test('selectEnvFiles: .env in both → excluded (never overwritten)', () => {
  assert.deepEqual(selectEnvFiles(['.env', '.env.local'], ['.env']), [
    '.env.local',
  ])
})

test('selectEnvFiles: source-only .env.local → included', () => {
  assert.deepEqual(selectEnvFiles(['.env.local'], []), ['.env.local'])
})

test('selectEnvFiles: non-.env files ignored (.environment excluded)', () => {
  assert.deepEqual(
    selectEnvFiles(['.env', '.environment', 'README.md'], ['README.md']),
    ['.env'],
  )
})

test('selectEnvFiles: empty dirs', () => {
  assert.deepEqual(selectEnvFiles([], ['.env']), [])
  assert.deepEqual(selectEnvFiles([], []), [])
})
