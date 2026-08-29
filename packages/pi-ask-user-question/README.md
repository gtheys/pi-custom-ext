# pi-ask-user-question

Pi extension that adds an `ask_user_question` tool. The agent can pause execution and ask the user a single question through an interactive TUI dialog — free-form text, single-select, or multi-select — then continue with the structured answer.

## Tool

| Tool | Description |
|------|-------------|
| `ask_user_question` | Ask exactly one question and wait for the answer. Options are optional; the user can always pick **Other** to type a custom answer. |

### Modes

| Mode | When | UI |
|------|------|-----|
| `text` | No options passed | Multi-line editor dialog |
| `single-select` | Options passed | Arrow-key list, Enter selects, Other opens inline editor |
| `multi-select` | Options + `multiSelect: true` | Space toggles, Submit item confirms, Other opens inline editor |

Esc cancels in every mode; the tool result reports `status: "cancelled"` so the agent knows not to treat it as an answer.

### Result details

Every result carries a structured `details` object:

```json
{
  "status": "answered",
  "question": "Which database should we use?",
  "mode": "single-select",
  "answers": [{ "type": "option", "label": "PostgreSQL (Recommended)", "value": "postgres", "index": 1 }]
}
```

`status` is one of `answered`, `cancelled`, or `unavailable` (no interactive UI).

## Concurrency

All `ctx.ui.custom()`/editor pop-ups share a global UI mutex (keyed on `globalThis`), so concurrent `ask_user_question` calls — or calls racing other pop-up tools — serialize instead of corrupting the TUI.

## Install

Load from the monorepo root `package.json` `pi.extensions`, or install standalone:

```bash
pi install npm:@gtheys/pi-ask-user-question
```
