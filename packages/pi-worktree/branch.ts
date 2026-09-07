import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { deriveBranchName } from '@gtheys/pi-planning/shared/jira-branch.ts'

export type PersonalType = 'feat' | 'fix' | 'chore' | 'docs' | 'refactor'

export type BranchInput =
  | { kind: 'jira'; jiraId: string }
  | { kind: 'personal'; name: string; type: PersonalType }
  | { kind: 'literal'; branch: string }

const PERSONAL_TYPES: readonly PersonalType[] = [
  'feat',
  'fix',
  'chore',
  'docs',
  'refactor',
]

export interface RawBranchInput {
  jira_id?: string
  name?: string
  type?: string
  branch?: string
}

/**
 * Validate raw tool input into exactly one branch derivation mode:
 * jira_id XOR name XOR branch.
 */
export function parseBranchInput(raw: RawBranchInput): BranchInput {
  const modes = [
    Boolean(raw.jira_id),
    Boolean(raw.name),
    Boolean(raw.branch),
  ].filter(Boolean).length

  if (modes === 0) {
    throw new Error(
      'Missing branch input — provide exactly one of: jira_id, name, branch',
    )
  }
  if (modes > 1) {
    throw new Error(
      'Ambiguous branch input — provide exactly one of: jira_id, name, branch',
    )
  }

  if (raw.jira_id) {
    return { kind: 'jira', jiraId: raw.jira_id }
  }

  if (raw.name) {
    let type: PersonalType = 'feat'
    if (raw.type !== undefined) {
      if (!PERSONAL_TYPES.includes(raw.type as PersonalType)) {
        throw new Error(
          `Invalid type '${raw.type}' — expected one of: ${PERSONAL_TYPES.join(', ')}`,
        )
      }
      type = raw.type as PersonalType
    }
    return { kind: 'personal', name: raw.name, type }
  }

  return { kind: 'literal', branch: raw.branch as string }
}

// AIDEV-NOTE: intentionally duplicates pi-planning's unexported slugify rules
// (jira-branch.ts) — keep the two in sync when rules change.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .split('-')
    .slice(0, 5)
    .join('-')
    .replace(/^-|-$/g, '')
}

export function personalBranch(name: string, type: PersonalType): string {
  return `${type}/${slugify(name)}`
}

export interface DerivedBranch {
  branch: string
  source: 'jira' | 'personal' | 'literal'
}

export async function deriveBranch(
  pi: ExtensionAPI,
  input: BranchInput,
): Promise<DerivedBranch> {
  if (input.kind === 'jira') {
    const result = await deriveBranchName(pi, input.jiraId)
    return { branch: result.branch, source: 'jira' }
  }
  if (input.kind === 'personal') {
    return {
      branch: personalBranch(input.name, input.type),
      source: 'personal',
    }
  }
  return { branch: input.branch, source: 'literal' }
}
