import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  CONFIG_DIR_NAME,
  type ExtensionAPI,
  getAgentDir,
} from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'
import { Value } from 'typebox/value'

const execFileAsync = promisify(execFile)

// AIDEV-NOTE: TypeBox schema is the source of truth for config shape.
// config.schema.json (checked in) is regenerated from this at startup if
// missing. Global path: getAgentDir()/pi-pr-digest/config.json.
// Project override: <cwd>/CONFIG_DIR_NAME/pi-pr-digest/config.json.
const PrDigestConfigSchema = Type.Object({
  org: Type.Optional(
    Type.String({
      description:
        "GitHub org or owner to search open PRs in (e.g. 'Salary-Hero'). Default 'Salary-Hero'.",
    }),
  ),
  author: Type.Optional(
    Type.String({
      description:
        "GitHub author login to search PRs for, or '@me'. Default '@me'.",
    }),
  ),
  botLogins: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Extra logins to treat as bots (their comments/reviews don't count as human activity). Logins ending in '[bot]' are always ignored. Built-in bots: sonarqubecloud, copilot-pull-request-reviewer, github-actions, dependabot, codecov.",
    }),
  ),
})

type PrDigestConfig = {
  org?: string
  author?: string
  botLogins?: string[]
}

const DEFAULT_ORG = 'Salary-Hero'
// AIDEV-NOTE: keep in sync with the botLogins schema description above.
export const BUILTIN_BOTS = new Set([
  'sonarqubecloud',
  'copilot-pull-request-reviewer',
  'github-actions',
  'dependabot',
  'codecov',
])

const GLOBAL_CONFIG_PATH = path.join(
  getAgentDir(),
  'pi-pr-digest',
  'config.json',
)

function projectConfigPath(cwd: string): string {
  return path.join(cwd, CONFIG_DIR_NAME, 'pi-pr-digest', 'config.json')
}

async function readConfigFile(file: string): Promise<PrDigestConfig> {
  try {
    const raw = await fs.readFile(file, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!Value.Check(PrDigestConfigSchema, parsed)) return {}
    return parsed
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return {}
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to read pi-pr-digest config ${file}: ${msg}`)
  }
}

// AIDEV-NOTE: precedence is explicit tool param > project config > global
// config > built-in default.
async function resolveConfig(
  cwd: string,
  paramOrg?: string,
  paramAuthor?: string,
): Promise<{ org: string; author: string; bots: Set<string> }> {
  const global = await readConfigFile(GLOBAL_CONFIG_PATH)
  const project = await readConfigFile(projectConfigPath(cwd))
  const org = paramOrg || project.org || global.org || DEFAULT_ORG
  const author = paramAuthor || project.author || global.author || '@me'
  const bots = new Set(BUILTIN_BOTS)
  for (const login of global.botLogins || []) bots.add(login)
  for (const login of project.botLogins || []) bots.add(login)
  return { org, author, bots }
}

interface GhSearchEntry {
  number: number
  title: string
  url: string
  repository: { name: string; nameWithOwner: string }
}

interface GhReview {
  author: { login: string }
  state: string
}

interface GhComment {
  author: { login: string }
}

interface GhPrDetails {
  url: string
  title: string
  body: string
  comments: GhComment[]
  reviews: GhReview[]
}

export interface DigestPr {
  number: number
  repo: string
  title: string
  url: string
  humanCommenters: string[]
  humanReviews: Array<{ author: string; state: string }>
  hasHumanComments: boolean
}

export function isBot(login: string, bots: Set<string>): boolean {
  return login.endsWith('[bot]') || bots.has(login)
}

// AIDEV-NOTE: pure so the bot-filter/classification rules stay unit-testable
// without shelling out to gh.
export function classifyActivity(
  comments: GhComment[],
  reviews: GhReview[],
  bots: Set<string>,
): Pick<DigestPr, 'humanCommenters' | 'humanReviews' | 'hasHumanComments'> {
  const humanCommenters = [
    ...new Set(
      comments
        .map((c) => c.author.login)
        .filter((login) => !isBot(login, bots)),
    ),
  ]
  const humanReviews = reviews
    .filter((r) => !isBot(r.author.login, bots))
    .map((r) => ({ author: r.author.login, state: r.state }))
  return {
    humanCommenters,
    humanReviews,
    hasHumanComments: humanCommenters.length > 0,
  }
}

async function ghJson<T>(args: string[]): Promise<T> {
  const env = { ...process.env, GH_PAGER: 'cat' }
  const { stdout } = await execFileAsync('gh', args, {
    env,
    maxBuffer: 16 * 1024 * 1024,
  })
  return JSON.parse(stdout) as T
}

export async function collectDigest(
  org: string,
  author: string,
  limit: number,
  bots: Set<string>,
): Promise<DigestPr[]> {
  const search = await ghJson<GhSearchEntry[]>([
    'search',
    'prs',
    '--author',
    author,
    '--owner',
    org,
    '--state=open',
    '--limit',
    String(limit),
    '--json',
    'repository,number,title,url',
  ])
  const out: DigestPr[] = []
  for (const pr of search) {
    const details = await ghJson<GhPrDetails>([
      'pr',
      'view',
      pr.url,
      '--json',
      'url,title,body,comments,reviews',
    ])
    const activity = classifyActivity(details.comments, details.reviews, bots)
    out.push({
      number: pr.number,
      repo: pr.repository.nameWithOwner,
      title: pr.title,
      url: pr.url,
      ...activity,
    })
  }
  return out
}

export default function (pi: ExtensionAPI) {
  // Scaffold config.schema.json next to this file when missing.
  pi.on('session_start', async (event) => {
    if (event.reason !== 'startup') return
    const schemaPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'config.schema.json',
    )
    try {
      await fs.access(schemaPath)
    } catch {
      await fs.writeFile(
        schemaPath,
        JSON.stringify(PrDigestConfigSchema, null, 2),
        'utf-8',
      )
    }
  })

  pi.registerTool({
    name: 'pr_digest',
    label: 'GitHub PR Digest',
    description:
      "List a GitHub author's open PRs in an org (via the gh CLI) with human comment and review status. Bot activity (logins ending in [bot], sonarqubecloud, copilot-pull-request-reviewer, github-actions, dependabot, codecov, plus configured botLogins) is filtered out. Returns one entry per PR with humanCommenters, humanReviews (author + state), and hasHumanComments.",
    promptSnippet:
      "Digest of an author's open PRs in a GitHub org with human comment/review status (bots filtered).",
    promptGuidelines: [
      'Use this to answer "my outstanding PRs", "PRs waiting for review", "who reviewed my PRs".',
      'PRs with hasHumanComments=true: report who commented and review states. PRs without: they go in a reviewer-request table — one human approval means "asking for a second reviewer", zero human reviews means "we need 2 reviewers".',
      'Write a 1-line plain-text description per silent PR from its title when building the table.',
    ],
    parameters: Type.Object({
      org: Type.Optional(
        Type.String({
          description:
            'GitHub org/owner to search (default from config, else Salary-Hero)',
        }),
      ),
      author: Type.Optional(
        Type.String({
          description: "PR author login or '@me' (default from config)",
        }),
      ),
      limit: Type.Optional(
        Type.Integer({
          description: 'Max PRs to return (default 50)',
          minimum: 1,
          maximum: 100,
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cfg = await resolveConfig(ctx.cwd, params.org, params.author)
      const limit = params.limit ?? 50
      const prs = await collectDigest(cfg.org, cfg.author, limit, cfg.bots)
      const withComments = prs.filter((p) => p.hasHumanComments)
      const silent = prs.filter((p) => !p.hasHumanComments)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                org: cfg.org,
                author: cfg.author,
                total: prs.length,
                withComments,
                silent,
              },
              null,
              2,
            ),
          },
        ],
        details: { org: cfg.org, author: cfg.author, prs },
      }
    },
  })

  pi.registerCommand('pr-digest', {
    description:
      'Digest of your outstanding PRs in the configured GitHub org: who commented/reviewed, and a reviewer-request table for silent PRs. Usage: /pr-digest [org] [author]',
    // AIDEV-NOTE: hands off to the agent via sendUserMessage so the run goes
    // through the pr_digest tool call (same pattern as pi-teams-transcript
    // commands) instead of duplicating the fetch logic here.
    handler: async (args, ctx) => {
      const [argOrg, argAuthor] = args.trim().split(/\s+/).filter(Boolean)
      const cfg = await resolveConfig(ctx.cwd, argOrg, argAuthor)
      pi.sendUserMessage(
        `Call the pr_digest tool with org="${cfg.org}", author="${cfg.author}". Report PRs with human comments (who commented, review states), then a markdown table of the silent ones: PR link, 1-line description, human reviewers with state, and the ask ("asking for a second reviewer" if exactly one human approval, "we need 2 reviewers" if none).`,
      )
    },
  })
}
