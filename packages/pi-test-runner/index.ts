/**
 * Test Runner Extension
 *
 * Provides a `run_tests` tool and `/run-tests` command that:
 *   - Discover test scripts from the nearest package.json
 *   - Spawn an isolated subagent via pi-interactive-subagents' programmatic API
 *   - Deliver structured pass/fail results back into the session as steer messages
 *   - Allow switching into the subagent session to watch the live transcript
 *
 * Commands:
 *   /run-tests [script]      — run tests (fire-and-forget, results wake the session)
 *   /test-runner setup       — install the test-runner agent definition
 *   /test-runner switch      — jump into the most recent test session
 *   /test-runner back        — return to the session you came from
 *   /test-runner model [id]  — configure the subagent model
 */

import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent'
import { getAgentDir } from '@earendil-works/pi-coding-agent'
import { Container, Text } from '@earendil-works/pi-tui'
import type { SubagentResult } from '@gtheys/pi-interactive-subagents'
import { type Static, Type } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { buildRunCommand, discoverTestScripts } from './discover.ts'
import { startTestSubagent } from './subagent.ts'

// AIDEV-NOTE: TypeBox schema is the source of truth for config shape.
// config.schema.json is generated/refreshed at startup when missing.
const TestRunnerConfigSchema = Type.Object({
  defaultModel: Type.Optional(
    Type.String({
      description:
        "Model ID for the test-runner subagent. Uses Pi's default when absent.",
    }),
  ),
  previousSession: Type.Optional(
    Type.String({
      description: 'Session file to return to via /test-runner back.',
    }),
  ),
})

type TestRunnerConfig = Static<typeof TestRunnerConfigSchema>

// AIDEV-NOTE: TestRun is in-memory only (process lifetime). Session files are
// the persistent record and can be resumed with /resume or pi --session.
interface TestRun {
  runId: string
  sessionFile: string
  script: string
  command: string
  cwd: string
  started: number
  status: 'running' | 'done' | 'error'
  summary?: SubagentResult
}

function getConfigPath(): string {
  return path.join(getAgentDir(), 'test-runner', 'config.json')
}

function loadConfig(): TestRunnerConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (Value.Check(TestRunnerConfigSchema, parsed)) {
      return parsed
    }
    return {}
  } catch {
    return {}
  }
}

function saveConfig(config: TestRunnerConfig): void {
  const configPath = getConfigPath()
  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

function getBundledAgentPath(): string {
  return path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'agents',
    'test-runner.md',
  )
}

function getAgentTargetPath(): string {
  return path.join(getAgentDir(), 'agents', 'test-runner.md')
}

// AIDEV-NOTE: The interactive-subagents extension discovers agent definitions
// from ~/.pi/agent/agents/ and the current project. We copy our bundled agent
// there once, on demand, so launchSubagent({ agent: 'test-runner' }) resolves it.
function ensureAgentFile(): { installed: boolean; path: string } {
  const bundledPath = getBundledAgentPath()
  const targetPath = getAgentTargetPath()
  if (!fs.existsSync(targetPath) && fs.existsSync(bundledPath)) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.copyFileSync(bundledPath, targetPath)
    return { installed: true, path: targetPath }
  }
  return { installed: false, path: targetPath }
}

function formatElapsed(started: number): string {
  const seconds = Math.round((Date.now() - started) / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }
  return `${Math.round(seconds / 60)}m`
}

function formatResult(result: SubagentResult): {
  text: string
  parsed: unknown
} {
  let parsed: unknown
  if (result.summary) {
    const match = result.summary.match(/```json\n([\s\S]*?)\n```/)
    if (match) {
      try {
        parsed = JSON.parse(match[1])
      } catch {
        parsed = undefined
      }
    }
  }

  let text: string
  if (result.errorMessage) {
    text = `Test run failed (provider/agent error): ${result.errorMessage}`
  } else if (result.exitCode !== 0) {
    text = `Tests failed (exit ${result.exitCode}).\n\n${result.summary}`
  } else {
    text = `Tests completed.\n\n${result.summary}`
  }

  return { text, parsed }
}

export default function (pi: ExtensionAPI) {
  let config: TestRunnerConfig = loadConfig()
  const activeRuns: TestRun[] = []

  pi.on('session_start', async (event) => {
    config = loadConfig()
    if (event.reason !== 'startup') return

    const schemaPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'config.schema.json',
    )
    if (!fs.existsSync(schemaPath)) {
      fs.writeFileSync(
        schemaPath,
        JSON.stringify(TestRunnerConfigSchema, null, 2),
        'utf-8',
      )
    }

    ensureAgentFile()
  })

  function handleResult(run: TestRun, result: SubagentResult): void {
    if (result.errorMessage || result.exitCode !== 0) {
      run.status = 'error'
    } else {
      run.status = 'done'
    }
    run.summary = result

    const { text, parsed } = formatResult(result)

    pi.sendMessage(
      {
        customType: 'test_runner_result',
        content: text,
        display: true,
        details: {
          runId: run.runId,
          script: run.script,
          command: run.command,
          cwd: run.cwd,
          ...result,
          parsed,
        },
      },
      { triggerTurn: true, deliverAs: 'steer' },
    )
  }

  function handleError(run: TestRun, err: unknown): void {
    run.status = 'error'
    const message = err instanceof Error ? err.message : String(err)
    pi.sendMessage(
      {
        customType: 'test_runner_result',
        content: `Test run error: ${message}`,
        display: true,
        details: {
          runId: run.runId,
          script: run.script,
          command: run.command,
          cwd: run.cwd,
          error: message,
        },
      },
      { triggerTurn: true, deliverAs: 'steer' },
    )
  }

  function buildRunContext(
    runDir: string,
    sessionManager: {
      getSessionFile(): string | undefined
      getSessionId(): string
      getSessionDir(): string
    },
  ) {
    return {
      sessionManager: {
        getSessionFile: () => sessionManager.getSessionFile() ?? null,
        getSessionId: () => sessionManager.getSessionId(),
        getSessionDir: () => sessionManager.getSessionDir(),
      },
      cwd: runDir,
    }
  }

  async function startRun(
    scriptKey: string,
    command: string,
    runDir: string,
    model: string | undefined,
    signal: AbortSignal | undefined,
    sessionManager: {
      getSessionFile(): string | undefined
      getSessionId(): string
      getSessionDir(): string
    },
  ): Promise<TestRun | undefined> {
    ensureAgentFile()

    const runId = randomUUID().slice(0, 8)
    const cwdBase = path.basename(runDir)
    const name = `test: ${cwdBase} › ${scriptKey}`

    const run: TestRun = {
      runId,
      sessionFile: '',
      script: scriptKey,
      command,
      cwd: runDir,
      started: Date.now(),
      status: 'running',
    }

    const started = await startTestSubagent(
      buildRunContext(runDir, sessionManager),
      {
        name,
        cwd: runDir,
        command,
        model,
        signal,
        onResult: (result) => handleResult(run, result),
        onError: (err) => handleError(run, err),
      },
    )

    run.sessionFile = started.sessionFile
    activeRuns.push(run)
    return run
  }

  async function resolveAndRun(
    scriptKey: string,
    cwd: string,
    ctx: ExtensionContext,
  ): Promise<TestRun | undefined> {
    const { scripts, packageDir } = discoverTestScripts(cwd)
    if (scripts.length === 0) {
      ctx.ui.notify(
        `No test scripts found in package.json (searched from ${cwd})`,
        'warning',
      )
      return undefined
    }

    const runDir = packageDir ?? cwd
    let selected: (typeof scripts)[0] | undefined

    if (scriptKey) {
      selected = scripts.find((s) => s.key === scriptKey)
      if (!selected) {
        ctx.ui.notify(
          `Script "${scriptKey}" not found. Available: ${scripts.map((s) => s.key).join(', ')}`,
          'warning',
        )
        return undefined
      }
    } else if (scripts.length === 1) {
      selected = scripts[0]
    } else if (ctx.hasUI) {
      const choices = scripts.map((s) => `${s.key}: ${s.command}`)
      const choice = await ctx.ui.select('Which test script to run?', choices)
      if (!choice) return undefined
      selected =
        scripts[scripts.findIndex((s) => `${s.key}: ${s.command}` === choice)]
    } else {
      selected = scripts[0]
    }

    if (!selected) return undefined

    const command = buildRunCommand(selected.key, runDir)

    try {
      const run = await startRun(
        selected.key,
        command,
        runDir,
        config.defaultModel,
        ctx.signal,
        ctx.sessionManager,
      )
      if (!run) return undefined

      ctx.ui.notify(
        `Tests started: ${command}\n/test-runner switch to watch  •  /test-runner back to return`,
        'info',
      )
      ctx.ui.setStatus('test-runner', `⏳ ${selected.key} — ${run.runId}`)
      return run
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.ui.notify(`Failed to start tests: ${message}`, 'error')
      return undefined
    }
  }

  pi.registerTool({
    name: 'run_tests',
    label: 'Run Tests',
    description: [
      'Discover and run JS/TS test scripts from the nearest package.json.',
      'Spawns an isolated subagent via pi-interactive-subagents and reports',
      'structured pass/fail results as a steer message when done.',
    ].join(' '),
    promptSnippet:
      'Run JS/TS tests from package.json and return structured failures',
    parameters: Type.Object({
      model: Type.Optional(
        Type.String({
          description:
            "Model ID for the subagent (e.g. 'claude-haiku-4-5'). Overrides the configured default.",
        }),
      ),
      script: Type.Optional(
        Type.String({
          description:
            "Test script key from package.json (e.g. 'test', 'test:unit'). Auto-detected if omitted.",
        }),
      ),
      cwd: Type.Optional(
        Type.String({
          description:
            'Working directory to search for package.json. Defaults to the current project directory.',
        }),
      ),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const workDir = params.cwd ?? ctx.cwd
      const { scripts, packageDir } = discoverTestScripts(workDir)

      if (scripts.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No test scripts found in package.json (searched from ${workDir})`,
            },
          ],
          details: { found: false },
        }
      }

      const runDir = packageDir ?? workDir

      let selected: (typeof scripts)[0] | undefined
      if (params.script) {
        selected = scripts.find((s) => s.key === params.script)
      }

      if (!selected && scripts.length > 1 && ctx.hasUI) {
        const choices = scripts.map((s) => `${s.key}: ${s.command}`)
        const choice = await ctx.ui.select('Which test script to run?', choices)
        if (!choice) {
          return {
            content: [{ type: 'text', text: 'Cancelled' }],
            details: { cancelled: true },
          }
        }
        selected =
          scripts[scripts.findIndex((s) => `${s.key}: ${s.command}` === choice)]
      }

      if (!selected) {
        selected = scripts[0]
      }

      const command = buildRunCommand(selected.key, runDir)

      try {
        const run = await startRun(
          selected.key,
          command,
          runDir,
          params.model ?? config.defaultModel,
          signal,
          ctx.sessionManager,
        )
        if (!run) {
          return {
            content: [{ type: 'text', text: 'Failed to start test run.' }],
            details: { started: false },
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: [
                `Tests started: \`${command}\``,
                `Session: ${run.sessionFile}`,
                `Use /test-runner switch to watch the live transcript, /test-runner back to return.`,
              ].join('\n'),
            },
          ],
          details: {
            running: true,
            script: selected.key,
            command,
            cwd: runDir,
            sessionFile: run.sessionFile,
            runId: run.runId,
          },
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          content: [
            {
              type: 'text',
              text: `Failed to start tests: ${message}`,
            },
          ],
          details: { error: message },
        }
      }
    },

    renderCall(args, theme) {
      const script = args.script ?? 'auto-detect'
      let cwdSuffix = ''
      if (args.cwd) {
        cwdSuffix = theme.fg('muted', ` in ${args.cwd}`)
      }
      return new Text(
        theme.fg('toolTitle', theme.bold('run_tests ')) +
          theme.fg('accent', script) +
          cwdSuffix,
        0,
        0,
      )
    },

    renderResult(result, _opts, theme) {
      type Details = {
        script?: string
        command?: string
        running?: boolean
        found?: boolean
        cancelled?: boolean
        sessionFile?: string
        runId?: string
        error?: string
      }

      const details = result.details as Details | undefined
      const t = result.content[0]
      let text = '(no output)'
      if (t?.type === 'text') {
        text = t.text
      }

      if (!details || details.found === false || details.cancelled) {
        return new Text(theme.fg('muted', text), 0, 0)
      }

      if (details.error) {
        return new Text(theme.fg('error', text), 0, 0)
      }

      if (details.running) {
        const container = new Container()
        container.addChild(
          new Text(
            theme.fg('warning', '⏳ ') +
              theme.fg('accent', details.script ?? 'tests') +
              theme.fg('muted', ' running in background'),
            0,
            0,
          ),
        )
        if (details.sessionFile) {
          container.addChild(
            new Text(
              theme.fg(
                'dim',
                '   /test-runner switch to watch  •  /test-runner back to return',
              ),
              0,
              0,
            ),
          )
        }
        return container
      }

      return new Text(theme.fg('muted', text), 0, 0)
    },
  })

  pi.registerCommand('run-tests', {
    description: 'Alias for /test-runner — run test scripts from package.json',
    handler: async (args, ctx) => {
      await resolveAndRun(args.trim(), ctx.cwd, ctx)
    },
  })

  pi.registerCommand('test-runner', {
    description:
      'Manage test-runner: setup | switch | back | model | reset | status',
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean)
      const sub = parts[0]

      if (sub === 'setup') {
        const { installed, path: agentPath } = ensureAgentFile()
        if (installed) {
          ctx.ui.notify(`Installed test-runner agent at ${agentPath}`, 'info')
        } else {
          ctx.ui.notify(
            `test-runner agent already installed at ${agentPath}`,
            'info',
          )
        }
        return
      }

      if (sub === 'switch') {
        const running = activeRuns.filter((r) => r.status === 'running')
        const candidates = running.length > 0 ? running : activeRuns
        if (candidates.length === 0) {
          ctx.ui.notify('No test runs started in this session.', 'warning')
          return
        }

        let run: TestRun
        if (candidates.length === 1) {
          run = candidates[0]
        } else {
          const choices = candidates.map(
            (r) => `${r.script} — ${r.command} (${formatElapsed(r.started)})`,
          )
          const choice = await ctx.ui.select('Switch to test session:', choices)
          if (!choice) return
          run =
            candidates[
              candidates.findIndex(
                (r) =>
                  `${r.script} — ${r.command} (${formatElapsed(r.started)})` ===
                  choice,
              )
            ]
        }

        const currentFile = ctx.sessionManager.getSessionFile()
        if (currentFile) {
          config.previousSession = currentFile
          saveConfig(config)
        }

        ctx.ui.notify(`Switching to test session: ${run.script}`, 'info')
        await ctx.switchSession(run.sessionFile)
        return
      }

      if (sub === 'back') {
        if (!config.previousSession) {
          ctx.ui.notify(
            'No previous session stored. Use /resume to pick one.',
            'warning',
          )
          return
        }
        await ctx.switchSession(config.previousSession)
        return
      }

      if (sub === 'model') {
        const modelId = parts[1]
        if (!modelId) {
          let modelMsg: string
          if (config.defaultModel) {
            modelMsg = `test-runner default model: ${config.defaultModel}`
          } else {
            modelMsg = 'test-runner default model: (pi default)'
          }
          ctx.ui.notify(modelMsg, 'info')
          return
        }
        config.defaultModel = modelId
        saveConfig(config)
        ctx.ui.notify(`test-runner default model set to: ${modelId}`, 'info')
        return
      }

      if (sub === 'reset') {
        config = {}
        saveConfig(config)
        ctx.ui.notify('test-runner config reset', 'info')
        return
      }

      if (sub === 'status') {
        const lines = ['test-runner status:']
        lines.push(`  model: ${config.defaultModel ?? '(pi default)'}`)
        if (activeRuns.length > 0) {
          lines.push('')
          lines.push('Active runs this session:')
          for (const r of activeRuns) {
            lines.push(
              `  ${r.script} (${formatElapsed(r.started)}) — ${r.runId} [${r.status}]`,
            )
          }
        }
        lines.push('')
        lines.push(
          '/test-runner setup | switch | back | model | reset | status',
        )
        ctx.ui.notify(lines.join('\n'), 'info')
        return
      }

      await resolveAndRun(args.trim(), ctx.cwd, ctx)
    },
  })
}
