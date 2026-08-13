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

## Requirements

- `task` (taskwarrior) on `PATH`, synced with Jira (e.g. via bugwarrior), so `task jiraid:<ID> +jira export` returns a task with `jirasummary` / `jiradescription`.
- The `openspec-propose`, `openspec-new-change`, and `openspec-apply-change` skills installed.

## Store resolution

The openspec CLI only honors `--store <id>` when passed explicitly — without it, `openspec new change`/`list` resolve against the nearest repo-local `openspec/` root, even if `defaultStore` is set in `~/.config/openspec/config.json`. These commands read `defaultStore` from that file themselves and append `--store "<id>"` to every openspec CLI call and skill hand-off, so a configured default store is always used instead of a repo-local root.

## Usage

```
/openspec-propose-jira IMP-7070
```

Fetches the ticket, builds `<kebab-name>: <JIRA-ID> <summary>\n\n<description>`, and forwards it as if you'd typed it directly into the skill.
