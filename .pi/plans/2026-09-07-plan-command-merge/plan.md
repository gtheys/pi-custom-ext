# [FEATURE-4f976638] Merge /plan Command With Feature-Planning Flow

## Overview

Unify planning entry under `/plan`. A Jira argument keeps the existing taskwarrior/spec flow; a free-text argument runs a new local-feature flow that combines the `feature-ticket` interview, the pi-interactive-subagents planner-agent workflow, and a taskwarrior hierarchy (feature ticket → phases → subtasks) with artifacts stored under `$PERSONAL_FEATURES`.

**Feature task UUID:** `4f976638-8fbe-45e9-a24d-2dd93f892b9f`
**Repo:** pi-my-rifle-ext

## Current State Analysis

- `/plan` is registered by pi-interactive-subagents (`pi-extension/subagents/index.ts:2442`). Its handler always injects the bundled `plan-skill.md` — a scout → interactive planner → `plan.md` + todos workflow with no taskwarrior integration (`pi-extension/subagents/index.ts:2442-2471`).
- `skills/engineering/create-plan/SKILL.md` implements the Jira/taskwarrior flow (`tw_*` tools, spec file via `resolve_spec_path`, phase/impl-task hierarchy). Its Step F (local feature flow) duplicates an interview inline and reuses the Jira-shaped spec path.
- `skills/engineering/feature-ticket/SKILL.md` owns the lightweight interview → single taskwarrior ticket flow.
- `agents/planner.md` (bundled in pi-interactive-subagents) is the interactive planner agent; `agents/scout.md` is the read-only recon agent.
- `tw_execution_plan` (`packages/pi-planning/implement-plan/execution-plan.ts`) filters tasks by `jiraid:<JIRA_ID> +impl`; `buildExecutionPlan(label, tasks)` itself is agnostic — phases are `+phase +impl` sorted by `N.` prefix, subtasks `+impl` hung off `depends:` phase UUIDs.
- `tw_phase_checkpoint` treats `jira_id` as an opaque string in the commit message — `FEATURE-<uuid8>` works unmodified.
- `resolve_spec_path` (`packages/pi-planning/plan-tools/helpers.ts`) derives repo name from the git toplevel and slug from the summary.
- pi loads `skills/` from every package listed in settings `packages` — repo skills are available in any session, and the `/plan` handler can resolve them relative to the repo root via `SUBAGENTS_DIR/../../..`.

### Key Discoveries:

- Skills from packages load globally (pi docs, "Locations → Packages"), so the dispatch can inject skill content by absolute path with a graceful fallback when the package is installed standalone (files missing).
- `buildExecutionPlan` already takes an opaque label; only the task-fetch in `registerTwExecutionPlan` is jiraid-coupled.
- The existing `/iterate` command (`index.ts:2226`) demonstrates the `pi.sendUserMessage(...)` injection pattern.

## Desired End State

- `/plan IMP-7070` → injects `create-plan` SKILL.md (existing Jira/taskwarrior flow, unchanged behavior).
- `/plan add dark mode to settings` → injects new `feature-plan` SKILL.md: interview → scout → interactive planner agent → plan.md → taskwarrior feature hierarchy → artifact folder + annotations.
- `tw_execution_plan` resumes feature hierarchies as well as Jira ones.
- `/skill:implement-plan` works for both flows.

### Verification

- `bun run lint` and `bun run format` clean.
- `node --test` passes in pi-planning (new) and pi-interactive-subagents (dispatch test).
- Manual: `/plan IMP-7070` dispatches to create-plan; `/plan <text>` dispatches to feature-plan; `/plan` with no args shows usage.

## What We're NOT Doing

- No changes to the Jira flow's behavior or data model (spec tasks, `SalaryHero.` prefix, `$LLM_NOTES_ROOT` paths stay).
- No bugwarrior/Jira sync for features — features live only in taskwarrior.
- No new subagent types (planner/scout reused as-is).
- No `/plan` argument grammar beyond the Jira-regex split.
- No branch automation for features (`jira_create_branch` stays Jira-only).

## Implementation Approach

Dispatch on the argument shape inside the existing `/plan` handler. The feature flow is a new skill document (triggerable standalone as `/skill:feature-plan`); the handler injects whichever skill applies, falling back to the bundled generic `plan-skill.md` when skill files cannot be resolved (standalone npm install). Tooling additions are two small ones in pi-planning: `resolve_feature_path` and a `feature_uuid` parameter on `tw_execution_plan`.

---

## Phase 1: /plan Dispatch (pi-interactive-subagents)

### Overview

Make the existing `/plan` command route by argument shape.

### Changes Required:

#### 1. Dispatch in the /plan handler
**File**: `packages/pi-interactive-subagents/pi-extension/subagents/index.ts`
**Changes**: In the `registerCommand('plan')` handler (line ~2442), after trimming args:

- If args match `^[A-Z][A-Z0-9]+-\d+\b` → read `skills/engineering/create-plan/SKILL.md` (resolved as `join(SUBAGENTS_DIR, '../../../skills/engineering/create-plan/SKILL.md')`), strip frontmatter, inject as `<skill name="create-plan">` + args.
- Else → read `skills/engineering/feature-plan/SKILL.md` the same way, inject as `<skill name="feature-plan">` + args.
- If either file read fails (standalone install) → keep current behavior (bundled `plan-skill.md`).
- Keep the workspace/tab rename and the no-arg usage notice.

```typescript
const JIRA_ID = /^[A-Z][A-Z0-9]+-\d+\b/
const skillDir = join(SUBAGENTS_DIR, '../../../skills/engineering')
const skillName = JIRA_ID.test(task) ? 'create-plan' : 'feature-plan'
let content: string | null = null
try {
  content = readFileSync(join(skillDir, `${skillName}/SKILL.md`), 'utf8')
} catch {
  // standalone install — repo skills unavailable
}
```

#### 2. Dispatch test
**File**: `packages/pi-interactive-subagents/test/test.ts` (extend)
**Changes**: Unit-test the Jira regex classification (pure function — extract it) and the fallback path resolution.

### Success Criteria

#### Automated Verification

- [ ] `bun run lint` passes
- [ ] `node --test test/test.ts` passes in pi-interactive-subagents

#### Manual Verification

- [ ] `/plan IMP-7070` injects create-plan skill
- [ ] `/plan add dark mode` injects feature-plan skill
- [ ] `/plan` (no args) shows usage notice

**Implementation Note**: Pause for manual confirmation after automated checks pass.

---

## Phase 2: pi-planning Tools

### Overview

Two small tool additions so the feature flow has the same path-resolution and resume ergonomics as the Jira flow.

### Changes Required:

#### 1. resolve_feature_path tool
**File**: `packages/pi-planning/plan-tools/resolve-feature-path.ts` (new)
**Changes**: Mirror `resolve-spec-path.ts`. Params: `summary` (string). Logic:

- repo = `getRepoName(pi)` (reuse helper)
- slug = same 5-word slugify as `resolveSpecPath`
- dir = `$PERSONAL_FEATURES` set → `$PERSONAL_FEATURES/<repo>/<YYYY-MM-DD>-<slug>/`; unset → `<repo-toplevel>/.pi/plans/<YYYY-MM-DD>-<slug>/`
- returns absolute path to `plan.md` inside the folder

Register in `packages/pi-planning/plan-tools/index.ts`.

#### 2. tw_execution_plan feature support
**File**: `packages/pi-planning/implement-plan/execution-plan.ts`
**Changes**: Add optional `feature_uuid` param. When present (instead of `jira_id`): fetch the feature task by uuid, label the plan `FEATURE-<uuid8>`, and collect phases as `+phase +impl` tasks whose `depends` includes `feature_uuid`; subtask collection and sorting reuse `buildExecutionPlan` unchanged. Update the tool description; keep jira path byte-identical.

#### 3. Tests
**File**: `packages/pi-planning/test/test.ts` (new) + `package.json` scripts
**Changes**: `node --test` for `resolve_feature_path` slug/date/dir logic and `buildExecutionPlan` over a feature-shaped task fixture.

### Success Criteria

#### Automated Verification

- [ ] `node --test` passes in pi-planning
- [ ] `bun run lint` passes

#### Manual Verification

- [ ] `tw_execution_plan` with a feature UUID returns sorted tree + resume target
- [ ] Feature tasks visible via `task jirastatus:Local +feature`
- [ ] `resolve_feature_path` honors `$PERSONAL_FEATURES` when set

**Implementation Note**: Pause for manual confirmation after automated checks pass.

---

## Phase 3: Skills

### Overview

The feature flow becomes a first-class skill; create-plan and implement-plan updated to delegate/extend.

### Changes Required:

#### 1. New feature-plan skill
**File**: `skills/engineering/feature-plan/SKILL.md` (new)
**Changes**: Frontmatter `name: feature-plan`, description triggering on feature-planning phrasing. Body — the merged flow:

1. Quick assessment (30s, main session, plan-skill Phase 1 pattern)
2. `resolve_feature_path` → artifact folder
3. Scout subagent(s) (plan-skill Phase 2 pattern, explicit artifact paths)
4. Lightweight interview (feature-ticket pattern — one focused round, 3–6 questions)
5. Create the feature task: `task add ... project:<repo> +feature priority:M jirastatus:Local` (jirastatus UDA exists and is a string — `Local` distinguishes feature-flow tasks in reports and filters, and makes them visible in the default `task list`, which excludes `jirastatus:Backlog`); annotate interview results; capture UUID; pseudo-ID `FEATURE-<uuid8>`. Phases and subtasks are also created with `jirastatus:Local`.
6. Spawn interactive planner agent (`agent: "planner"`, `interactive: true`), task = request + scout context + interview answers + **plan.md target path** + **taskwarrior output contract** (phase/subtask numbering `N.` / `N.M`, tags `+phase +impl` / `+impl`, `depends:` feature UUID then phase UUIDs, `work_state:todo`, annotate each task with the artifact folder path)
7. After planner exits: verify hierarchy with `tw_execution_plan feature_uuid`, present tree to user
8. Fallback (no subagent tool): main session writes plan.md + creates the hierarchy itself

#### 2. Update create-plan Step F
**File**: `skills/engineering/create-plan/SKILL.md`
**Changes**: Replace the inline Step F interview + raw-taskwarrior blocks with a delegation pointer to `/skill:feature-plan`. Keep the Jira flow untouched.

#### 3. Update implement-plan
**File**: `skills/engineering/implement-plan/SKILL.md`
**Changes**: Add feature-variant entry: resume via `tw_execution_plan` with `feature_uuid` (found through `task +feature jirastatus:Local status:pending` list or the annotated path), worker loop unchanged, `tw_phase_checkpoint` called with `jira_id: "FEATURE-<uuid8>"`. Skip `jira_create_branch` for features — plain branch naming.

### Success Criteria

#### Automated Verification

- [ ] `bun run lint` passes (skills not linted, but repo-wide check stays green)

#### Manual Verification

- [ ] `/skill:feature-plan add X` runs the full flow end to end on a scratch feature
- [ ] `/skill:implement-plan` resumes the scratch feature tree correctly
- [ ] create-plan Jira flow unaffected (`/plan IMP-7070` unchanged)

**Implementation Note**: Pause for manual confirmation after automated checks pass.

---

## Phase 4: Docs & Packaging

### Overview

Keep packaging and docs in sync.

### Changes Required:

#### 1. pi-planning manifest
**File**: `packages/pi-planning/package.json`
**Changes**: Add `plan-tools/resolve-feature-path.ts` to `files`; add `"test": "node --test test/test.ts"` script.

#### 2. READMEs
**Files**: `packages/pi-planning/README.md`, `packages/pi-interactive-subagents/README.md`
**Changes**: pi-planning — document `resolve_feature_path` and the `feature_uuid` param. pi-interactive-subagents — `/plan` section: dispatch behavior (Jira vs feature vs generic fallback).

### Success Criteria

#### Automated Verification

- [ ] `npm pack --dry-run -w @gtheys/pi-planning` includes the new file

#### Manual Verification

- [ ] README examples match actual tool signatures

---

## Testing Strategy

### Unit Tests

- Jira regex classification + fallback resolution (pi-interactive-subagents)
- `resolve_feature_path` slug/date/env-var logic (pi-planning)
- `buildExecutionPlan` over feature fixture (phases by `depends:` on feature UUID)

### Integration Tests

- None new — existing pi-interactive-subagents integration suite must stay green.

### Manual Testing Steps

1. `/plan IMP-7070` in a SalaryHero repo → create-plan flow
2. `/plan add snippets fuzzy search` here → full feature flow, verify hierarchy + artifacts
3. `/skill:implement-plan` on the feature from step 2 → resume target correct

## Performance Considerations

None — one extra `readFileSync` per `/plan` invocation.

## Migration Notes

- Existing `plan-skill.md` flow remains reachable as the fallback; no breaking change for standalone installs.
- Existing local-feature Step F tickets (if any) remain valid taskwarrior data; nothing migrates. Optionally stamp existing in-flight feature trees once with `task <uuids> modify jirastatus:Local` (done for feature 4f976638).

## References

- Feature task: `task 92` (uuid `4f976638-8fbe-45e9-a24d-2dd93f892b9f`, `+feature`)
- Spec file: `.pi/plans/2026-09-07-plan-command-merge/plan.md` (fallback convention — set `$PERSONAL_FEATURES` to relocate future feature artifacts)
- `/plan` handler: `packages/pi-interactive-subagents/pi-extension/subagents/index.ts:2442`
- Skills loading from packages: pi docs `docs/skills.md` → "Locations"
