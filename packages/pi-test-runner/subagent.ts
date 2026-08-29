/**
 * Thin wrapper around pi-interactive-subagents' programmatic API.
 *
 * Reuses launchSubagent + watchSubagent so the test runner does not need its
 * own subagent spawner or result channel.
 */

import * as path from 'node:path'
import type { ExtensionContext } from '@earendil-works/pi-coding-agent'
import {
  isMuxAvailable,
  launchSubagent,
  muxSetupHint,
  type SubagentInput,
  type SubagentResult,
  watchSubagent,
} from '@gtheys/pi-interactive-subagents'

export interface StartTestSubagentOptions {
  name: string
  cwd: string
  command: string
  model?: string
  signal?: AbortSignal
  onResult: (result: SubagentResult) => void
  onError: (err: unknown) => void
}

export async function startTestSubagent(
  ctx: ExtensionContext,
  opts: StartTestSubagentOptions,
): Promise<{ id: string; name: string; sessionFile: string }> {
  if (!isMuxAvailable()) {
    throw new Error(
      `Tests require a supported terminal multiplexer. ${muxSetupHint()}`,
    )
  }

  const sessionFile = ctx.sessionManager.getSessionFile()
  if (!sessionFile) {
    throw new Error('Tests need a persistent session. Run pi with --session.')
  }

  const task = [
    `Run this test command in directory ${opts.cwd}:`,
    opts.command,
    '',
    'Return a single JSON code block with exitCode, passed, failed, skipped, errors, rawOutput.',
  ].join('\n')

  const params: SubagentInput = {
    agent: 'test-runner',
    name: opts.name,
    task,
    cwd: path.resolve(opts.cwd),
    model: opts.model,
    interactive: false,
  }

  const running = await launchSubagent(params, ctx)

  const abort = new AbortController()
  if (opts.signal) {
    opts.signal.addEventListener('abort', () => abort.abort(), { once: true })
  }

  watchSubagent(running, abort.signal).then(opts.onResult).catch(opts.onError)

  return {
    id: running.id,
    name: running.name,
    sessionFile: running.sessionFile,
  }
}
