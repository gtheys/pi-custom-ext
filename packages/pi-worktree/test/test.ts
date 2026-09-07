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
