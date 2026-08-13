# pi-openspec-wrapper

Pi extension that drives the [openspec-propose](https://github.com) and `openspec-new-change` skills from a Jira ticket, fetched via [taskwarrior](https://taskwarrior.org/) (bugwarrior-synced).

Instead of typing a change name and description by hand, give a Jira ID — the ticket's summary and description become the change brief.

## Commands

| Command | Routes to |
|---|---|
| `/openspec-propose-jira <JIRA-ID>` | `/skill:openspec-propose` |
| `/openspec-new-jira <JIRA-ID>` | `/skill:openspec-new-change` |
| `/openspec-apply-jira <JIRA-ID>` | Verifies/creates the feature branch, then `/skill:openspec-apply-change` |

`/openspec-apply-jira` derives the branch name the same way as `implement-plan`'s `jira-branch.sh` (`<prefix>/<JIRA-ID>-<slug>`, issue-type → prefix map, `git town set-parent develop`), but sources the ticket from taskwarrior instead of `acli`. If already on the branch it proceeds; if the branch exists locally it checks it out; otherwise it creates it. It then looks up the matching `openspec list` change by Jira ID and hands off to `openspec-apply-change`.

## `openspec` tool + auto-context

Beyond the Jira commands, this package also registers:

- **`openspec` tool** — lets the agent call `status`/`doctor`/`context`/`list`/`show`/`validate` directly instead of shelling out.
- **Auto-context injection** — on `before_agent_start`, appends `openspec context` output to the system prompt so the agent always knows current spec-driven state. Cached per resolved scope to avoid per-turn CLI overhead.

Both resolve scope the same way: repo-local `openspec/` root first, then a registered store containing cwd, then the configured `defaultStore` as a last resort. This is deliberately looser than the Jira commands below — a query tool should answer about whatever repo you're in, not always redirect to your default store.

- **Status widget** — a persistent TUI widget above the editor showing active OpenSpec changes, artifact completion, and task progress. Refreshes on session start, after each turn/agent end (debounced), and when a tool touches `openspec/` or runs an `openspec`-referencing bash command, plus a 30s fallback. Ported from [pi-openspec-status](https://github.com/mattoopie/pi-openspec-status), adapted to use the same scope resolution as the tool/auto-context above (store-aware) instead of a plain git-root walk. The interactive `Ctrl+Alt+O` detail dialog and per-task-group breakdown from the original were left out — say so if you want them ported too.

## Requirements

- `task` (taskwarrior) on `PATH`, synced with Jira (e.g. via bugwarrior), so `task jiraid:<ID> +jira export` returns a task with `jirasummary` / `jiradescription`.
- The `openspec-propose`, `openspec-new-change`, and `openspec-apply-change` skills installed.

## Store resolution (Jira commands)

The openspec CLI only honors `--store <id>` when passed explicitly — without it, `openspec new change`/`list` resolve against the nearest repo-local `openspec/` root, even if `defaultStore` is set in `~/.config/openspec/config.json`. The three Jira commands read `defaultStore` from that file themselves and append `--store "<id>"` to every openspec CLI call and skill hand-off, so a configured default store is always used instead of a repo-local root — with a heads-up notification if a local root exists and is being overridden.

## Usage

```
/openspec-propose-jira IMP-7070
```

Fetches the ticket, builds `<kebab-name>: <JIRA-ID> <summary>\n\n<description>`, and forwards it as if you'd typed it directly into the skill.
