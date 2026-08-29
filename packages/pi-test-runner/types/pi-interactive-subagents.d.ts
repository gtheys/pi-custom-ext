/**
 * Local type declarations for pi-interactive-subagents' programmatic API.
 *
 * This file shields pi-test-runner from typechecking the source of
 * pi-interactive-subagents, which is built against a different version of the
 * pi-coding-agent package and would otherwise report unrelated diagnostics.
 */

export interface SubagentInput {
  name: string
  task: string
  agent?: string
  cwd?: string
  model?: string
  interactive?: boolean
  tools?: string[]
  skills?: string[]
  systemPrompt?: string
  resumeSessionId?: string
}

export interface RunningSubagent {
  id: string
  name: string
  task: string
  sessionFile: string
  startTime: number
  surface: string
}

export interface SubagentResult {
  name: string
  task: string
  summary: string
  sessionFile?: string
  claudeSessionId?: string
  exitCode: number
  elapsed: number
  error?: string
  errorMessage?: string
  ping?: { name: string; message: string }
}

export function isMuxAvailable(): boolean
export function muxSetupHint(): string

export function launchSubagent(
  params: SubagentInput,
  ctx: {
    sessionManager: {
      getSessionFile(): string | null
      getSessionId(): string
      getSessionDir(): string
    }
    cwd: string
  },
  options?: { surface?: string },
): Promise<RunningSubagent>

export function watchSubagent(
  running: RunningSubagent,
  signal: AbortSignal,
): Promise<SubagentResult>
