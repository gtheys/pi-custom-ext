# pi-openspec-wrapper

Pi extension that drives the [openspec-propose](https://github.com) and `openspec-new-change` skills from a Jira ticket, fetched via [taskwarrior](https://taskwarrior.org/) (bugwarrior-synced).

Instead of typing a change name and description by hand, give a Jira ID — the ticket's summary and description become the change brief.

## Commands

| Command | Routes to |
|---|---|
| `/openspec-propose-jira <JIRA-ID>` | `/skill:openspec-propose` |
| `/openspec-new-jira <JIRA-ID>` | `/skill:openspec-new-change` |

## Requirements

- `task` (taskwarrior) on `PATH`, synced with Jira (e.g. via bugwarrior), so `task jiraid:<ID> +jira export` returns a task with `jirasummary` / `jiradescription`.
- The `openspec-propose` and `openspec-new-change` skills installed.

## Usage

```
/openspec-propose-jira IMP-7070
```

Fetches the ticket, builds `<kebab-name>: <JIRA-ID> <summary>\n\n<description>`, and forwards it as if you'd typed it directly into the skill.
