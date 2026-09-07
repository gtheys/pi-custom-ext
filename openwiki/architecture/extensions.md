# Extension Reference

Deep-dive on each `packages/*` extension: what it registers, key files, and
non-obvious implementation decisions worth knowing before you touch it.

## pi-bootstrap

- **File:** `packages/pi-bootstrap/index.ts` (37 lines)
- **Registers:** `session_start` handler (only on `reason === 'startup'`).
- **What:** Symlinks this repo's `agents/AGENTS.md` → `~/.pi/agent/AGENTS.md` so the
  global agent picks up this repo's rules automatically. If a file/symlink already
  exists at the target, it **warns and skips** rather than overwriting — the user's
  existing AGENTS.md always wins.
- **Gotcha:** if you edit `agents/AGENTS.md` expecting it to take effect, check
  whether the symlink was ever actually created (it silently no-ops if something
  else is already there).

## pi-interactive-subagents (vendored)

- **Files:** `packages/pi-interactive-subagents/pi-extension/subagents/index.ts` +
  `session.ts`, `status.ts`, `activity.ts`, `cmux.ts`, `subagent-done.ts`;
  agent definitions in `agents/` (claude-code, planner, reviewer, scout, visual-tester,
  worker).
- **Registers:** `subagent`/`subagent_interrupt`/`subagent_resume`-style tools,
  `/plan` dispatch command, orchestrator UI widget.
- **What:** Vendored from the upstream project into this monorepo (`ec79bc8`) so its
  programmatic API is importable as a workspace dependency (`@gtheys/pi-interactive-subagents`:
  `launchSubagent`, `watchSubagent`). Spawns sub-agents in real multiplexer panes
  (cmux/tmux/zellij/WezTerm/Herdr); results are **steered back** into the main session
  as async notifications that trigger a new turn. Fully non-blocking.
- **Agent resolution order:** project-local `.pi/agents/` → `~/.pi/agent/agents/` →
  the bundled copy under `agents/`.
- **`/plan <arg>` dispatch** (in-file AIDEV-NOTE): a Jira-shaped argument injects the
  **create-plan** skill, anything else injects **feature-plan**; if the repo's skill
  files can't be read (standalone install), it falls back to the bundled generic
  `plan-skill.md`. Note `pi-planning` also registers `/plan` — first registration wins
  by load order in the root `package.json` `pi.extensions`, so `pi-planning`'s `/plan`
  is effectively dead in the monorepo but kept for standalone npm installs of that
  package (see `README.md` "Rules of the road").

## pi-ask-user-question

- **Files:** `packages/pi-ask-user-question/index.ts` (+ test)
- **Registers:** `ask_user_question` tool.
- **What:** Lets the agent pause and ask the user exactly one question through an
  interactive TUI dialog — free-form text, single-select, or multi-select — always
  with an **Other** free-text escape hatch. Esc cancels; the tool result carries a
  structured `details` object with `status: answered | cancelled | unavailable`.
- **Concurrency:** all pop-ups share a global UI mutex (keyed on `globalThis`) so
  concurrent calls — or races with other pop-up tools — serialize instead of
  corrupting the TUI.

## pi-prompt-snippets

- **Files:** `packages/pi-prompt-snippets/index.ts`, `snippets/*.md`
- **Registers:** alt+s keybinding + `/snippets` command; a widget showing active snippets.
- **What:** One-shot prompt rules — toggle snippets on, send a message, and the active
  bodies are prepended/appended to it. Toggles reset to all-off after each send and at
  session start (one-shot, not sticky). Snippet files are markdown with frontmatter
  (`name`, `description`, `placement: prepend|append`, `order`); the directory is
  created on session start if missing.

## pi-pr-digest

- **Files:** `packages/pi-pr-digest/index.ts`, `config.schema.json`
- **Registers:** `pr_digest` tool + `/pr-digest` command.
- **What:** Lists an author's open PRs in an org via the `gh` CLI with human
  comment/review status — bot activity filtered out. Backs the digest mode of the
  `teams-pr-notify` skill (reviewer-request table for PRs lacking human review).

## pi-worktree

- **Files:** `packages/pi-worktree/index.ts`, `branch.ts`, `bootstrap.ts`,
  `herdr.ts`, `remove-guards.ts`
- **Registers:** `worktree` tool (actions `create` / `list` / `remove`).
- **What:** Parallel feature work via [Herdr](https://github.com/pi-edubot/herdr)
  worktree workspaces. `create` derives a branch from a Jira ID (acli), a
  conventional `name`+`type`, or a literal `branch`; creates the worktree, bootstraps
  dependencies by lockfile (bun/yarn/npm/pnpm/cargo/go — best-effort, failures never
  block creation, and the action waits for bootstrap to finish before returning),
  copies missing `.env*` files from the main checkout (point-in-time snapshot, never
  overwritten), and best-effort sets the git-town parent for the Jira flow.
  `list` joins worktrees with live pi agent states as a dashboard; `remove` refuses
  dirty worktrees without `force` and only deletes branches already **MERGED** on
  GitHub when `delete_branch` is set. Merge/push stay manual — removal only checks
  the result.

## pi-desktop-notify

- **File:** `packages/pi-desktop-notify/index.ts` (158 lines)
- **Registers:** `session_start`, `agent_start`, `agent_end` handlers; `/notify` command.
- **What:** Fires a `notify-send` desktop notification when the agent finishes work,
  but only if the user has been idle for `idleThresholdMs` (default 30s) — avoids
  spamming during rapid back-and-forth. State (`enabled`, `idleThresholdMs`) persists
  across sessions via a custom entry type (`desktop-notify-state`), replayed by
  scanning entries backward on `session_start`.
- **Commands:** `/notify`, `/notify on|off`, `/notify idle [seconds]`.

## pi-fastcontext

- **File:** `packages/pi-fastcontext/index.ts` (1015 lines — largest single file)
- **Registers:** `fast_context_search` tool; `/fastcontext` command; `session_start` handler that scaffolds `config.schema.json` on first startup.
- **What:** Read-only codebase search backed by a **local** FastContext model server
  (llama.cpp, OpenAI-compatible API, default `http://127.0.0.1:8772/v1`, default model
  `FastContext-1.0-4B-RL-Q4_K_M.gguf`). It's a lightweight agent loop that gives the
  small local model its own read/grep/glob tools capped tightly (`MAX_READ_LINES=120`,
  `MAX_GREP_RESULTS=40`, `MAX_TOOL_CHARS=5000`) and forces it to finalize within
  `maxTurns` (default 6), returning compact `file:line` citations instead of full file
  contents to the calling (larger, more expensive) model.
- **Config:** TypeBox schema (`FastContextConfigSchema`) validates `JSON.parse` →
  `unknown` at the boundary; `Value.Check()` rejects malformed files gracefully.
  `config.schema.json` is checked-in and refreshed at startup when missing.
  Config resolution order: built-in defaults → `getAgentDir()/fastcontext.json` →
  `<cwd>/.pi/fastcontext.json` → `FASTCONTEXT_*` env vars (last wins).
- **Why it exists:** avoid burning the primary model's context/turns on broad
  exploratory search when a cheap local model can return citations instead.

## pi-tool-pills

- **Files:** `packages/pi-tool-pills/index.ts`, `pill.ts`, `diff-renderer.ts`
- **Registers:** re-registers `ls`, `read`, `find`, `grep`, `bash` (colored pill labels
  + collapsed output, 15-line default) and `write`/`edit` (Shiki syntax-highlighted
  diffs via `registerDiffTools`).
- **What:** Pure **rendering** layer — it wraps the harness's own
  `create*ToolDefinition` factories and only changes how results are displayed in the
  TUI, not tool behavior/semantics. Diff theme config loads from
  `~/.pi/agent/settings.json` (fixed in `e58efbdd`).
- **Dependency note:** pulls in `shiki`/`@shikijs/cli` for highlighting — the only
  package in this repo with a real third-party rendering dependency.

## pi-test-runner ⚠️ experimental/WIP

- **Files:** `packages/pi-test-runner/index.ts`, `subagent.ts`, `discover.ts`,
  `agents/test-runner.md`
- **Registers:** `run_tests` tool; `/run-tests`, `/test-runner` commands; `session_start`
  handler that scaffolds `config.schema.json` on first startup.
- **What:** Discovers test scripts from the nearest `package.json`
  (`discoverTestScripts`), then spawns a **`test-runner` agent** via `pi-interactive-subagents`
  programmatic API (`subagent.ts` wraps `launchSubagent` + `watchSubagent`) so the run
  shows in the orchestrator's subagents widget and doesn't block the calling
  conversation. Results come back when the subagent finishes — its result is steered
  into the session. (Replaced an earlier detached-process + `pi-intercom`
  `contact_supervisor` design; the full `ExtensionContext` is passed through so the
  subagent widget renders.)
- **Config:** TypeBox schema (`TestRunnerConfigSchema`) validates `JSON.parse` →
  `unknown` at the boundary via `Value.Check()`. `config.schema.json` checked-in and
  scaffolded at startup when missing. Persisted at `getAgentDir()/test-runner/config.json`
  — **not** `pi.appendEntry()`, because that API is session-scoped.
- **Commands:** `/run-tests [script]` (fire-and-forget), `/test-runner switch`,
  `/test-runner back`, `/test-runner model`.

## pi-sem

- **Files:** `packages/pi-sem/index.ts` (625 lines), `core.d.mts`, `bin/sem-eval.mjs`
- **Registers:** 7 tools — `sem_diff`, `sem_impact`, `sem_context`, `sem_log`,
  `sem_entities`, `sem_blame`, `sem_eval` (see `pi.registerTool` calls at
  `index.ts:205,250,308,368,432,469,506`).
- **What:** Thin typed wrapper around the external `sem` CLI
  (`@ataraxy-labs/sem`, an **optional** dependency — the extension must degrade
  gracefully if it's not installed; see `SEM_INSTALL_HINT` in the shared `core.mjs`).
  Provides entity-level (function/class/method) git diff, blast-radius/impact
  analysis, budgeted context retrieval, and history — richer than raw
  `git diff`/`git blame` for reasoning about a single function across commits.
- **Output truncation:** large outputs are written to a temp file under
  `os.tmpdir()/pi-sem-<timestamp>/` and the tool result references that path instead
  of dumping megabytes into the conversation (`writeTruncatedOutput`,
  `truncateToolText`).
- Full usage guidance lives in the paired `skills/tools/sem/SKILL.md`.

## pi-planning (plan-tools + implement-plan)

Two extensions in one package, sharing `packages/pi-planning/shared/`
(`tw-utils.ts` — `twExport` runs `task <filter> export` and parses the JSON;
`jira-branch.ts` — shared branch-name derivation for the `jira_create_branch` tool).
Both halves follow **one-tool-per-file** layout (`f748401`): each tool lives in its
own file exporting a `register*` function, wired up from the sibling `index.ts`.

### plan-tools — `packages/pi-planning/plan-tools/`

- **Files:** `index.ts`, `helpers.ts`, one file per tool: `get-ticket.ts`,
  `get-spec-task.ts`, `get-phases-impl.ts`, `create-spec-task.ts`, `create-phase.ts`,
  `create-impl-task.ts`, `resolve-spec-path.ts`, `resolve-feature-path.ts`,
  `open-in-pane.ts`.
- **Tools:** `tw_get_ticket`, `tw_get_spec_task`, `tw_get_phases`, `tw_get_impl_tasks`,
  `resolve_spec_path`, `resolve_feature_path`, `tw_create_spec_task`,
  `tw_create_phase`, `tw_create_impl_task`, `jira_create_branch`, `open_in_pane`.
- **Commands:** `/plan <JIRA_ID>` (duplicate registration — see
  pi-interactive-subagents above for who wins) and `/review-spec <path>`.
- **Routing:** `/plan` checks for an existing spec file: if found → **iterate-plan**
  skill, otherwise → **create-plan**.
- **Spec path convention:** `<notes-root-or-repo>/notes/specs/<JIRA_ID>__<slug>.md`,
  where slug = first 5 lowercase words of the Jira summary, non-alnum stripped
  (`resolveSpecPath`). `$LLM_NOTES_ROOT` overrides where specs live,
  letting a central notes vault span multiple repos.
- **Feature path convention:** `resolve_feature_path` computes a personal-feature
  `plan.md` path — `$PERSONAL_FEATURES/<repo>/<date>-<slug>/plan.md` if set, else
  `<git-toplevel>/.pi/plans/<date>-<slug>/plan.md` — backing the **feature-plan**
  skill's no-Jira flow.
- **Spec annotation format:** `Spec(repo=<repo>): <relative-path>` — parsed by
  `extractSpecPath` in `helpers.ts` via regex. This is the **only** link between a
  taskwarrior spec task and its file on disk — don't change the format without
  updating both `plan-tools` and any skill that reads it.
- **`jira_create_branch`** (shared `shared/jira-branch.ts`): derives a branch name
  from a Jira issue (type → prefix, summary → slug), creates it, and sets its
  git-town parent to `develop`. Requires `acli` + `git-town`. Replaced the old
  `skills/engineering/implement-plan/scripts/jira-branch.sh` shell script (`f748401`).
- **`open_in_pane`** (`open-in-pane.ts`): opens a spec/plan file with `glow` in a new
  herdr pane (`spec-review`) for human review. Calls the `herdr` CLI directly —
  deliberate, no cross-package import of pi-interactive-subagents for 3 exec calls.
  Non-fatal: returns a manual-open note if herdr is unavailable. The create-plan /
  iterate-plan / feature-plan skills call it after writing the spec/plan — skippable,
  never blocks the flow.

### implement-plan — `packages/pi-planning/implement-plan/`

- **Files:** `index.ts` (the `/implement` command), one file per tool:
  `execution-plan.ts`, `advance-task.ts`, `phase-checkpoint.ts`, `jira-branch-tool.ts`.
- **Tools:** `tw_execution_plan`, `tw_advance_task`, `tw_phase_checkpoint`,
  `jira_create_branch` (shared tool, registered here too for standalone installs).
- **Command:** `/implement <JIRA_ID>` — shows the execution plan, routes to the
  **implement-plan** skill.
- **`tw_execution_plan`** is the important one: it fetches all `+impl` tasks for a
  **Jira ID or a local feature UUID** (mutually exclusive params), parses phase numbers
  out of descriptions matching `^(\d+)\.\s*Phase:` (`parsePhaseNumber`) and subtask
  numbers matching `^(\d+\.\d+)` (`parseSubtaskNumber`), sorts by numeric prefix, and
  computes `currentPhase`/`currentSubtask` — the first non-done item — as the **resume
  target**. This is what lets `/implement` be safely re-run mid-way through a
  multi-session implementation, for Jira specs and local features alike.
- See [Planning workflow](../workflows/planning-and-implementation.md) for the full
  task lifecycle and taskwarrior data model.

## pi-review (review + sonarqube + pr-quality)

Three extensions sharing `packages/pi-review/shared/sonarqube-utils.ts`.

### review — `packages/pi-review/review/review.ts`

- **Command:** `/review [pr <n>|pr <url>|uncommitted|branch <name>|commit <sha>|folder <paths...>|custom "<instructions>"]`
  with an interactive selector when called with no args.
- **What:** Prompts the agent to review code changes. When a supported multiplexer is
  available, `/review` **spawns a `reviewer` subagent** via `pi-interactive-subagents`
  programmatic API (`launchSubagent`, `d90713f`) — findings steer back into the session
  when the review completes. The legacy in-session path remains as fallback when
  there's no mux or the spawn fails; with a mux available, every mode runs in the
  subagent.
- Injects semantic-tool guidance (`buildSemReviewGuidance` from `sem-guidance.mjs`)
  so the review prompt tells the agent to prefer `sem_diff`/`sem_impact` when
  `pi-sem` is available.
- **Constraint:** PR review mode requires a clean working tree (it checks out the PR
  branch locally) — will refuse if there are uncommitted tracked-file changes.
- **Session state:** tracks the origin session ID for a "fresh session per review"
  pattern; module-level state (`reviewOriginId`, `endReviewInProgress`) is deliberate
  and assumes a single active review at a time (documented in-file).
- Project-specific guidelines: if `REVIEW_GUIDELINES.md` exists next to `.pi/`, its
  contents are appended to the review prompt.

### sonarqube — `packages/pi-review/sonarqube/sonarqube.ts`

- **Command:** `/sonarqube [pr-number] [--severity=...] [--types=...]`
- **What:** Analysis-only rewrite of legacy `salaryhero/opencode/bin/sonar-*` bash
  scripts. Auto-detects PR number from current branch and Sonar project config from
  `sonar-project.properties` if not given explicitly. Fetches coverage gaps
  (`analyzeCoverage`) and quality issues (`analyzeIssues`/`fetchAllIssues`) from
  SonarCloud, filterable by severity/type.
- **Requires:** `SONARQUBE_TOKEN` env var.

### pr-quality — `packages/pi-review/pr-quality/index.ts` (642 lines)

- **Commands:** `/pr-quality [pr-number]`, `/pr-watch`.
- **What:** Combines GitHub PR unresolved review threads (via inline `gh api graphql`,
  `REVIEW_THREADS_QUERY`) with SonarCloud analysis for the same PR into one unified
  LLM context message. The agent is expected to: triage each thread VALID/INVALID,
  auto-resolve INVALID threads through the GraphQL API, cross-reference VALID
  comments with Sonar issues by file, and **fix issues immediately** — deliberately
  no plan file is written (changed in `f68b45b5`, replacing an earlier
  plan-file-based flow).
- **`/pr-watch`:** background-polls GitHub Actions/status checks
  (`checkActionsComplete`, via `statusCheckRollup`, ignoring `SKIPPED` checks) using a
  plain `setInterval` loop — replaced an earlier detached-bash+sentinel-file+`fs.watch`
  approach (`202b3de7`) that was flaky. When checks complete, it triggers `/pr-quality`
  automatically. Cleans up its interval on `session_shutdown`.

## Next

- [Planning & implementation workflow](../workflows/planning-and-implementation.md)
- [Code review workflow](../workflows/code-review.md)
