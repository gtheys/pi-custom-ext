# Atlas Cloud CLI

`atlas cloud` commands read and manage resources in **Atlas Cloud** (the Atlas Registry and deployment tracking). They do **not** connect to databases directly — they report what Atlas Cloud knows about repos, registered databases (targets), and deployment events.

Use them for **operational visibility** and **pre-flight checks**. Use local commands (`atlas migrate status`, `atlas migrate apply`, `atlas schema diff`) to inspect or change an actual database.

## Prerequisites

1. **Atlas CLI** — `atlas cloud` is not available in the community version.
2. **Authentication** — run before any cloud command:
   ```bash
   atlas whoami                    # verify current org
   atlas login [org]               # interactive login
   atlas login --token "$TOKEN"    # CI / non-interactive
   ```
   `ATLAS_TOKEN` env var is also accepted by `atlas login`.
3. If `atlas whoami` fails, stop and authenticate before proceeding.

## Command Reference

```
atlas cloud
├── repo
│   ├── list
│   ├── describe
│   ├── create
│   └── lingraph
├── database
│   ├── list
│   └── describe
└── migration
    ├── list
    └── describe
```

### `atlas cloud repo`

Manage Atlas Registry repositories (schema or migration directory artifacts).

| Command | Purpose |
|---------|---------|
| `repo list` | List all repos with per-repo database counts (synced / failed / pending) |
| `repo describe` | Details for one repo: slug, type, driver, URL, database counts |
| `repo create` | Create an empty repo in the registry (before first push); idempotent if the repo already exists |
| `repo lingraph` | Print the migration lineage graph for a repo |

**Identify a repo** (describe): exactly one of `--id`, `--slug`, or `--name`.

**Create flags** (all required):
- `--type schema` (or `s`) — declarative schema repo
- `--type migration_directory` (or `m`) — versioned migration repo
- `--name <name>` — repo name
- `--driver <driver>` — e.g. `postgres`, `mysql`, `sqlite`, `mssql`, `clickhouse`, `cockroach`

**Lineage graph**:
```bash
atlas cloud repo lingraph --slug <slug>
atlas cloud repo lingraph --slug <slug> --open-lineage   # OpenLineage format
```

### `atlas cloud database`

Query **registered migration/schema targets** (databases linked to Atlas Cloud).

| Command | Purpose |
|---------|---------|
| `database list` | List all cloud-tracked databases |
| `database describe` | Details for one database |

**Output fields**: `ID`, `Name`, `RepoName`, `EnvName`, `Status`, `CurrentVersion`, `LastDeploymentTime`.

**Database status** (`Status` column):

| Status | Meaning |
|--------|---------|
| `SYNCED` | Target matches the expected repo version |
| `PENDING` | Deployment or sync is in progress / not yet complete |
| `FAILED` | Last sync or deployment failed for this target |

**Filters** (list):
- `--env-name <env>` — filter by environment name (matches `env` blocks in `atlas.hcl`)

**Identify a database** (describe): exactly one of `--id` or `--ext-id`.

### `atlas cloud migration`

Query **deployment events** (each time migrations or schema were applied to targets).

| Command | Purpose |
|---------|---------|
| `migration list` | List deployment events with filters |
| `migration describe` | Details for one event |

**Migration event status**:

| Status | Meaning |
|--------|---------|
| `PASSED` | Deployment succeeded |
| `FAILED` | Deployment failed |
| `NO_ACTION` | No changes were needed |
| `DRY_RUN` | Dry-run only, nothing applied |

**Filters** (list):
- `--status <status>` — repeatable; values: `PASSED`, `FAILED`, `NO_ACTION`, `DRY_RUN`
- `--repo <slug>` — filter by repository slug
- `--name <substring>` — filter by database name (contains match)
- `--env-name <env>` — filter by environment

**Describe**: `--id <migration-event-id>` (required).

## Common Flags

| Flag | Commands | Purpose |
|------|----------|---------|
| `--format <template>` | list, describe (except lingraph) | Go template output; use `json` helper for machine-readable — `--format '{{json .}}'` |
| `--page <n>` | list commands | Page number to fetch (default 1); see **Pagination** below |

### Pagination

List commands (`repo list`, `database list`, `migration list`) return at most **20 records per page**. Each response ends with a footer:

```
--------------------------------
Page: 1  Page Size: 20  Total: 45
```

| Footer field | Meaning |
|--------------|---------|
| `Page` | Current page (1-based); matches the `--page` flag value |
| `Page Size` | Fixed at 20 records per page (not configurable via CLI) |
| `Total` | Total records matching the current filters across all pages |

**Are there more pages?** When `Total > Page Size` (i.e. `Total > 20`). Compute the number of pages:

```
total_pages = ceil(Total / Page Size)
```

Example: `Total: 45`, `Page Size: 20` → `ceil(45 / 20) = 3` pages.

**When to fetch the next page:**
- If `Page < total_pages`, more records exist — re-run the same command with `--page <Page + 1>`.
- If `Page == total_pages`, you have all records for the current filters.
- If `Total <= Page Size`, everything fits on one page; no further requests needed.

**Example** (45 records across 3 pages):

```bash
atlas cloud database list              # page 1: records 1–20
atlas cloud database list --page 2     # page 2: records 21–40
atlas cloud database list --page 3     # page 3: records 41–45
```

With `--format '{{ json . }}'`, pagination metadata is on the `PageInfo` field (`Page`, `PageSize`, `Total`). Use it in scripts to decide whether to request another page.

**Examples**:
```bash
atlas cloud database list
atlas cloud migration list --status FAILED
```

## When to Use Which Command

| User goal | Start with |
|-----------|------------|
| Is a repo healthy across all its databases? | `atlas cloud repo list` or `repo describe --slug <slug>` |
| What version is a database on in Atlas Cloud? | `atlas cloud database list --env-name <env>` or `database describe` |
| Did a recent deployment fail? | `atlas cloud migration list --status FAILED` |
| What happened in a specific deployment? | `atlas cloud migration describe --id <id>` |
| Create a registry repo before first push | `atlas cloud repo create --type m --name <n> --driver postgres` |
| Check object dependencies | `atlas cloud repo lingraph --slug <slug>` |
| Which org am I connected to? | `atlas whoami` |
| Can I push a schema change or migration to database X? | `atlas cloud database list` then `atlas cloud database describe --id <id>` using the id of database X from the list |

## Agent Workflows

### Pre-deployment readiness

Before recommending `atlas migrate apply` or a CI deploy, check Atlas Cloud state:

```
Task Progress:
- [ ] Verify auth: atlas whoami
- [ ] Check target status: atlas cloud database list --env-name <env>
- [ ] Check for failed deployments: atlas cloud migration list --status FAILED --env-name <env>
- [ ] Check repo health: atlas cloud repo describe --slug <slug>
```

**Decision rules**:
- Any database with `Status=FAILED` → investigate before applying. Run `migration list --status FAILED` filtered to that env/repo, then `migration describe` on the event ID.
- Any database with `Status=PENDING` → a deployment may be in flight; wait or confirm before starting another.
- All targets `SYNCED` and no recent `FAILED` events → cloud state looks healthy. Still run local checks (`atlas migrate status`, lint) before applying.
- `repo describe` shows `Databases Failed > 0` → at least one target in that repo is unhealthy; drill into `database list` and `migration list`.

### Investigate a failed deployment

1. `atlas cloud migration list --status FAILED --repo <slug>` (add `--env-name` or `--name` to narrow)
2. `atlas cloud migration describe --id <id>` for version, completion time, and multi-target results
3. `atlas cloud database describe --id <id>` on affected targets to see current version vs expected
4. Use local `atlas migrate status --env <env>` to compare the live database revision table against cloud state

### Audit environments

Read `atlas.hcl` first to find environment names (`env` block names). For each environment you want to compare, run:

```bash
atlas cloud database list --env-name <env>
atlas cloud migration list --env-name <env>
```

Repeat for every relevant `env` in the project (e.g. dev, staging, prod — names vary). Compare `CurrentVersion` across environments to spot version skew.

### Set up a new registry repo

1. `atlas cloud repo create --type migration_directory --name <name> --driver postgres`
2. Note the returned `Slug` and `URL`
3. Reference in `atlas.hcl`: `migration { dir = "atlas://<slug>" }`
4. Push migrations with `atlas migrate push` (separate from `atlas cloud`)

## Cloud vs Local Commands

| Concern | Atlas Cloud (`atlas cloud …`) | Local (`atlas migrate/schema …`) |
|---------|-------------------------------|-----------------------------------|
| Registry repos & artifacts | ✅ | `migrate push`, `schema push` |
| Registered target status | ✅ | — |
| Deployment event history | ✅ | — |
| Live database revision table | — | `migrate status` |
| Schema drift vs desired state | — | `schema diff`, `migrate lint` |
| Apply changes to a database | — | `migrate apply`, `schema apply` |

Cloud commands answer **"what does Atlas Cloud know?"** Local commands answer **"what is actually in the database?"** Use both when validating readiness.

## Reporting Results to the User

When summarizing cloud command output:

1. State the org (`atlas whoami`) and filters used
2. Highlight `FAILED` / `PENDING` statuses prominently
3. For migrations, include `Version`, `Status`, `CompletedAt`, and `TargetsSucceeded/TargetsTotal` when present
4. Distinguish cloud-reported state from local database state — recommend local verification when the user plans to apply changes
5. For list commands, read the pagination footer (or `PageInfo` in JSON). If `Total > Page Size`, compute `total_pages = ceil(Total / Page Size)` and fetch remaining pages with `--page 2`, `--page 3`, etc. until `Page == total_pages` before concluding the result set is complete

## Error Handling

| Error | Action |
|-------|--------|
| `'atlas login' is required` | Run `atlas login` or set token |
| `repository not found` / `database not found` / `migration not found` | Verify identifier; try `list` first to get correct ID/slug |
| `invalid --status value` | Use `PASSED`, `FAILED`, `NO_ACTION`, or `DRY_RUN` |
| `invalid --type` | Use `schema`/`s` or `migration_directory`/`m` |
| Mutually exclusive flags (`--id` vs `--slug`) | Provide exactly one identifier |
