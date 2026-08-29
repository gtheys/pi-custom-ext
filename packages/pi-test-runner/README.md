# pi-test-runner

> ⚠️ **Experimental / Work in Progress** — behaviour may change.

Pi extension that discovers and runs JS/TS test scripts from the nearest `package.json`, spawning an isolated subagent via [pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents). Results are injected back into the session automatically when done — the tool is **non-blocking**.

## Requirements

- `pi-interactive-subagents` must be installed and loaded.
- A supported terminal multiplexer (cmux, tmux, zellij, wezterm, or herdr) must be available.
- Tests run in a persistent session so the subagent has a session file to switch back to.

## How it works

1. Scans up from the current directory to find the nearest `package.json`.
2. Extracts scripts matching test patterns (`test`, `test:*`, `jest`, `vitest`, `playwright`, `mocha`, `cypress`, `e2e`, `spec`).
3. If multiple scripts exist and no `script` param is given, shows a picker.
4. Detects the package manager from lockfiles (`yarn.lock`, `pnpm-lock.yaml`, fallback to `npm`).
5. Calls `launchSubagent` from `pi-interactive-subagents` to spawn a bash-only subagent running the `test-runner` agent definition.
6. Returns **immediately** — the session is unlocked while tests run.
7. Watches the subagent in the background; when it exits, sends a `test_runner_result` steer message with structured pass/fail data.

## Setup

The first time you use the extension, install the bundled `test-runner` agent definition into the global agents directory:

```
/test-runner setup
```

This copies `agents/test-runner.md` to `~/.pi/agent/agents/test-runner.md` so `pi-interactive-subagents` can resolve the `test-runner` agent.

## Tool parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `script` | `string?` | Script key from `package.json` (e.g. `test:unit`). Auto-detected if omitted. |
| `cwd` | `string?` | Working directory to search. Defaults to the current project directory. |
| `model` | `string?` | Model ID for the subagent. Overrides the configured default. |

## Commands

```
/run-tests                — run tests (non-blocking)
/run-tests test:unit      — run a specific script

/test-runner setup       — install the test-runner agent definition
/test-runner switch      — jump into the most recent running test session
/test-runner back        — return to the previous session
/test-runner model <id>  — set the default subagent model
/test-runner model       — show the current default model
/test-runner reset       — clear all config
/test-runner status      — show config and active runs
```

## Configuration

Global config: `~/.pi/agent/test-runner/config.json`

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultModel` | string | _(pi default)_ | Model ID for the test-runner subagent |

```json
{
  "$schema": "./.pi/agent/test-runner/config.schema.json",
  "defaultModel": "claude-haiku-4-5"
}
```
