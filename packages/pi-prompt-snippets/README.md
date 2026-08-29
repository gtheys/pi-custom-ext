# pi-prompt-snippets

Mix-and-match single-purpose prompt rules. Toggle snippets on, send a message, and the active snippet bodies are prepended/appended to it. Toggles reset to all-off after each send and at session start — snippets are one-shot, not sticky.

## Usage

- **alt+s** or **`/snippets`** — open the toggle menu.
  - `↑↓` navigate · `Space` toggle · `Tab` preview · `Enter` apply · `Esc` cancel
- Active snippets show in a widget above the editor, with `↑ prepend` and `↓ append` groups distinguished.
- On send: prepend snippets (sorted by `order`) → your message → append snippets (sorted by `order`), joined with blank lines.

## Snippet files

Snippets live in `snippets/` next to the extension. Each is a markdown file with frontmatter:

```markdown
---
name: concise
description: Keep answers short and direct
placement: prepend
order: 10
---
Answer concisely. Skip preamble and pleasantries; lead with the answer or the code.
```

| Field | Values | Default |
|-------|--------|---------|
| `name` | Display name | Filename without `.md` |
| `description` | Shown in the menu | empty |
| `placement` | `prepend` or `append` | `append` |
| `order` | Sort order within its group (lower = earlier) | `9999` |

The directory is created on session start if missing. Two starter snippets ship with the package: `concise` (prepend) and `tests` (append).

## Install

Load from the monorepo root `package.json` `pi.extensions`, or install standalone:

```bash
pi install npm:@gtheys/pi-prompt-snippets
```
