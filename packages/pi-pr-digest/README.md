# @gtheys/pi-pr-digest

Pi extension that gives the agent a digest of your outstanding GitHub PRs in
an org: which have human comments, who reviewed them, and which are silently
waiting for reviewers. Uses the `gh` CLI (must be installed and
authenticated).

## What it provides

- **`pr_digest` tool** — lists an author's open PRs in an org via
  `gh search prs`, fetches comments/reviews per PR, filters out bot activity
  (logins ending in `[bot]`, `sonarqubecloud`,
  `copilot-pull-request-reviewer`, `github-actions`, `dependabot`, `codecov`,
  plus configured `botLogins`), and returns per-PR `humanCommenters`,
  `humanReviews`, and `hasHumanComments`.
- **`/pr-digest [org] [author]` command** — runs the digest and has the agent
  report PRs with human comments, then render a reviewer-request markdown
  table for the silent ones ("asking for a second reviewer" / "we need 2
  reviewers").

## Install

```bash
pi install @gtheys/pi-pr-digest
```

## Configuration

Global config lives at `~/.pi/agent/pi-pr-digest/config.json`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `org` | string | `Salary-Hero` | GitHub org/owner to search open PRs in |
| `author` | string | `@me` | GitHub author login to search PRs for |
| `botLogins` | string[] | `[]` | Extra logins to treat as bots (their comments/reviews don't count as human activity) |

```json
{
  "$schema": "https://raw.githubusercontent.com/gtheys/pi-my-rifle-ext/main/packages/pi-pr-digest/config.schema.json",
  "org": "Salary-Hero",
  "author": "@me",
  "botLogins": []
}
```

Tool parameters `org` / `author` override config per call.
