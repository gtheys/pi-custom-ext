/**
 * Resolve which openspec root/store a CLI call or file read should target:
 * repo-local `openspec/` root first, then a registered store containing
 * cwd, then the configured `defaultStore` as a last resort.
 *
 * Shared by the `openspec` tool, auto-context injection, and the status
 * widget — all of which should answer about "whatever repo you're in" by
 * default, unlike the Jira commands which always force `defaultStore`.
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

export interface QueryScope {
  /** cwd to invoke the openspec CLI from */
  cliCwd: string
  /** --store <id> args to append, or [] when targeting a local root */
  storeArgs: string[]
  /** filesystem root of the targeted openspec project, if known */
  fsRoot: string | null
}

interface StoreEntry {
  id: string
  root: string
}

// AIDEV-NOTE: `openspec new change`/`list` without --store resolve against the
// nearest repo-local openspec/ root, not the configured defaultStore — the
// CLI only honors --store when passed explicitly. Read it ourselves.
export function getDefaultStoreId(): string | undefined {
  try {
    const configPath = join(homedir(), '.config', 'openspec', 'config.json')
    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as {
      defaultStore?: string
    }
    return config.defaultStore
  } catch {
    return undefined
  }
}

/** Walk up from cwd looking for an OpenSpec root marker (openspec/config.yaml). */
export function findOpenSpecRoot(cwd: string): string | null {
  let dir = resolve(cwd)
  for (;;) {
    if (existsSync(join(dir, 'openspec', 'config.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

async function listStores(pi: ExtensionAPI): Promise<StoreEntry[]> {
  const result = await pi.exec('openspec', ['store', 'list', '--json'], {})
  if (result.code !== 0) return []
  try {
    const parsed = JSON.parse(result.stdout) as { stores?: StoreEntry[] }
    return parsed.stores ?? []
  } catch {
    return []
  }
}

export async function resolveQueryScope(
  pi: ExtensionAPI,
  cwd: string,
): Promise<QueryScope> {
  const root = findOpenSpecRoot(cwd)
  if (root) return { cliCwd: root, storeArgs: [], fsRoot: root }

  const stores = await listStores(pi)
  const abs = resolve(cwd)
  const containing = stores.find((s) => {
    const storeRoot = resolve(s.root)
    return abs === storeRoot || abs.startsWith(`${storeRoot}/`)
  })
  if (containing) {
    return {
      cliCwd: cwd,
      storeArgs: ['--store', containing.id],
      fsRoot: containing.root,
    }
  }

  const defaultId = getDefaultStoreId()
  if (defaultId) {
    const matched = stores.find((s) => s.id === defaultId)
    return {
      cliCwd: cwd,
      storeArgs: ['--store', defaultId],
      fsRoot: matched?.root ?? null,
    }
  }

  return { cliCwd: cwd, storeArgs: [], fsRoot: null }
}
