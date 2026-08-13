/**
 * Persistent TUI widget showing active OpenSpec change status — ported from
 * github.com/mattoopie/pi-openspec-status, adapted to resolve scope via
 * scope.ts (store-aware) instead of a plain git-root walk, and trimmed to
 * the inline widget only (no interactive Ctrl+Alt+O overlay/task-group
 * breakdown — add if wanted).
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  Theme,
} from '@earendil-works/pi-coding-agent'
import { truncateToWidth } from '@earendil-works/pi-tui'
import { type QueryScope, resolveQueryScope } from './scope.ts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArtifactStatus {
  id: string
  status: 'done' | 'ready' | 'blocked'
}

/** Summary of a change from `openspec list --json`. */
interface ChangeSummary {
  name: string
  completedTasks: number
  totalTasks: number
  status: string
}

/** Detailed change info from `openspec status --json --change <name>`. */
interface ChangeDetail {
  changeName: string
  schemaName: string
  isComplete: boolean
  artifacts: ArtifactStatus[]
}

interface WidgetState {
  changes: ChangeSummary[]
  details: Map<string, ChangeDetail>
  error: string | null
}

// ── Debounce ──────────────────────────────────────────────────────────────────

function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delay: number,
): { (...args: Parameters<T>): void; cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null

  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, delay)
  }

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return debounced
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((line, i) => line === b[i])
}

// ── Data layer ────────────────────────────────────────────────────────────────

async function execOpenSpecJson<T>(
  pi: ExtensionAPI,
  args: string[],
  scope: QueryScope,
  errorLabel: string,
): Promise<{ data: T | null; error: string | null }> {
  const result = await pi.exec('openspec', [...args, ...scope.storeArgs], {
    timeout: 10000,
    cwd: scope.cliCwd,
  })
  if (result.code !== 0) {
    return {
      data: null,
      error: `${errorLabel}: ${result.stderr?.trim() || `exit code ${result.code}`}`,
    }
  }
  try {
    return { data: JSON.parse(result.stdout.trim()) as T, error: null }
  } catch {
    return { data: null, error: `${errorLabel}: could not parse CLI output` }
  }
}

async function listChanges(
  pi: ExtensionAPI,
  scope: QueryScope,
): Promise<{ changes: ChangeSummary[]; error: string | null }> {
  const result = await execOpenSpecJson<{ changes: ChangeSummary[] }>(
    pi,
    ['list', '--json'],
    scope,
    'openspec list',
  )
  if (result.error) {
    // Not an OpenSpec project here — show "no active changes", not an error.
    if (/not found|no such file/i.test(result.error)) {
      return { changes: [], error: null }
    }
    return { changes: [], error: result.error }
  }
  return { changes: result.data?.changes ?? [], error: null }
}

async function getChangeStatus(
  pi: ExtensionAPI,
  scope: QueryScope,
  name: string,
): Promise<{ detail: ChangeDetail | null; error: string | null }> {
  const result = await execOpenSpecJson<ChangeDetail>(
    pi,
    ['status', '--json', '--change', name],
    scope,
    `openspec status (${name})`,
  )
  return { detail: result.data, error: result.error }
}

async function fetchActiveChanges(
  pi: ExtensionAPI,
  cwd: string,
): Promise<WidgetState> {
  const scope = await resolveQueryScope(pi, cwd)
  const { changes, error: listError } = await listChanges(pi, scope)
  if (listError) return { changes: [], details: new Map(), error: listError }

  const details = new Map<string, ChangeDetail>()
  let fetchError: string | null = null
  for (const change of changes) {
    const { detail, error } = await getChangeStatus(pi, scope, change.name)
    if (detail) details.set(change.name, detail)
    else if (error) fetchError = error
  }
  return { changes, details, error: fetchError }
}

async function checkCliAvailable(pi: ExtensionAPI): Promise<boolean> {
  try {
    const result = await pi.exec('openspec', ['--help'], { timeout: 5000 })
    return result.code === 0
  } catch {
    return false
  }
}

// ── Render primitives ─────────────────────────────────────────────────────────

function artifactIcon(theme: Theme, status: ArtifactStatus['status']): string {
  if (status === 'done') return theme.fg('success', '●')
  if (status === 'blocked') return theme.fg('warning', '◌')
  return theme.fg('muted', '○')
}

function changeStatusIcon(
  theme: Theme,
  change: ChangeSummary,
  detail?: ChangeDetail,
): string {
  if (detail?.isComplete) return theme.fg('success', '✓')
  if (change.status === 'blocked' || change.status === 'error') {
    return theme.fg('warning', '✗')
  }
  return theme.fg('accent', '◷')
}

function progressBar(theme: Theme, completed: number, total: number): string {
  if (total === 0) return theme.fg('muted', '—')
  const barWidth = Math.min(20, Math.max(4, total))
  const fillCount = Math.round((completed / total) * barWidth)
  const fill = theme.fg('accent', '█'.repeat(fillCount))
  const empty = theme.fg('muted', '░'.repeat(barWidth - fillCount))
  return `${fill}${empty}${theme.fg('text', ` ${completed}/${total}`)}`
}

function renderArtifactPart(
  theme: Theme,
  detail: ChangeDetail,
  useFullNames: boolean,
): string {
  return detail.artifacts
    .map((a) => {
      const label = useFullNames ? a.id : a.id.charAt(0).toUpperCase()
      return `${label} ${artifactIcon(theme, a.status)}`
    })
    .join('   ')
}

// ── Widget layout ─────────────────────────────────────────────────────────────

function renderSingleChange(
  theme: Theme,
  change: ChangeSummary,
  detail: ChangeDetail,
  width: number,
): string[] {
  const nameLine = `${changeStatusIcon(theme, change, detail)} ${theme.fg('text', change.name)} ${theme.fg('muted', `(${detail.schemaName})`)}`
  const artifactLine = `${theme.fg('muted', 'Artifacts: ')}${renderArtifactPart(theme, detail, true)}`
  const taskLine = `${theme.fg('muted', 'Tasks: ')}${progressBar(theme, change.completedTasks, change.totalTasks)}`
  return [nameLine, artifactLine, taskLine].map((line) =>
    truncateToWidth(line, width, '…'),
  )
}

function renderMultiChange(
  theme: Theme,
  changes: ChangeSummary[],
  details: Map<string, ChangeDetail>,
  width: number,
): string[] {
  const lines = [theme.fg('accent', `OpenSpec (${changes.length} active)`)]
  for (const change of changes) {
    const detail = details.get(change.name)
    const name = truncateToWidth(change.name, Math.floor(width * 0.2), '…')
    const artifactPart = detail ? renderArtifactPart(theme, detail, false) : ''
    const taskCounter = theme.fg(
      'text',
      `${change.completedTasks}/${change.totalTasks}`,
    )
    const blocked =
      detail?.artifacts.filter((a) => a.status === 'blocked') ?? []
    const blockedHint = blocked.length
      ? ` ${theme.fg('warning', `(blocked: ${blocked.map((a) => a.id).join(', ')})`)}`
      : ''
    const line = `${changeStatusIcon(theme, change, detail)} ${name}  ${artifactPart}  ${taskCounter}${blockedHint}`
    lines.push(truncateToWidth(line, width, '…'))
  }
  return lines
}

function renderWidget(
  theme: Theme,
  state: WidgetState,
  width: number,
): string[] {
  if (state.error && state.changes.length === 0) {
    return [
      truncateToWidth(theme.fg('warning', `⚠ ${state.error}`), width, '…'),
    ]
  }
  if (state.changes.length === 0) {
    return [theme.fg('muted', 'No active OpenSpec changes')]
  }
  if (state.changes.length === 1) {
    const only = state.changes[0]
    const detail = only ? state.details.get(only.name) : undefined
    if (only && detail) return renderSingleChange(theme, only, detail, width)
  }
  return renderMultiChange(theme, state.changes, state.details, width)
}

// ── Wiring ────────────────────────────────────────────────────────────────────

/** Register the persistent `openspec` status widget (session lifecycle + refresh events). */
export function registerStatusWidget(pi: ExtensionAPI): void {
  let cliAvailable = true
  let state: WidgetState = { changes: [], details: new Map(), error: null }
  let cachedLines: string[] | null = null
  let refreshInterval: ReturnType<typeof setInterval> | null = null

  function terminalWidth(): number {
    return process.stdout.columns ?? 80
  }

  function updateWidget(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return
    const lines = cliAvailable
      ? renderWidget(ctx.ui.theme, state, terminalWidth())
      : [ctx.ui.theme.fg('warning', 'OpenSpec CLI not found')]
    if (cachedLines && arraysEqual(cachedLines, lines)) return
    cachedLines = lines
    ctx.ui.setWidget('openspec', lines)
  }

  async function refresh(ctx: ExtensionContext): Promise<void> {
    if (!ctx.hasUI || !cliAvailable) return
    state = await fetchActiveChanges(pi, ctx.cwd)
    updateWidget(ctx)
  }

  const debouncedRefresh = debounce((ctx: ExtensionContext) => {
    refresh(ctx).catch(() => {})
  }, 500)

  function isOpenSpecRelated(
    toolName: string,
    input: Record<string, unknown>,
  ): boolean {
    if (toolName === 'write' || toolName === 'edit') {
      const path = input.path
      return typeof path === 'string' && path.includes('openspec/')
    }
    if (toolName === 'bash') {
      const command = input.command
      return typeof command === 'string' && command.includes('openspec')
    }
    return false
  }

  pi.on('session_start', async (_event, ctx) => {
    if (!ctx.hasUI) return
    cachedLines = [ctx.ui.theme.fg('muted', 'OpenSpec: Loading...')]
    ctx.ui.setWidget('openspec', cachedLines)

    if (refreshInterval) clearInterval(refreshInterval)
    refreshInterval = setInterval(() => {
      refresh(ctx).catch(() => {})
    }, 30000)

    cliAvailable = await checkCliAvailable(pi)
    await refresh(ctx)
  })

  pi.on('session_shutdown', async () => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
    debouncedRefresh.cancel()
  })

  pi.on('turn_end', async (_event, ctx) => {
    if (ctx.hasUI && cliAvailable) debouncedRefresh(ctx)
  })

  pi.on('agent_end', async (_event, ctx) => {
    if (ctx.hasUI && cliAvailable) debouncedRefresh(ctx)
  })

  pi.on('tool_result', async (event, ctx) => {
    if (
      ctx.hasUI &&
      cliAvailable &&
      isOpenSpecRelated(event.toolName, event.input)
    ) {
      debouncedRefresh(ctx)
    }
  })
}
