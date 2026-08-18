---
name: atlas
description: "Database schema management and migrations with Atlas CLI. Use when: generating migrations, diffing schemas, linting or testing migrations, applying schema changes, inspecting databases, working with atlas.hcl, schema.hcl, or ORM schemas (GORM, Drizzle, SQLAlchemy, Django, Ent, Sequelize, TypeORM), validating schema definitions, or checking Atlas Cloud registry and deployment status."
---

# Atlas Schema Migrations

## Security

Never hardcode credentials. Use environment variables:

```hcl
env "prod" {
  url = getenv("DATABASE_URL")
}
```

## Quick Reference

Use `--help` on any command for comprehensive docs and examples:
```bash
atlas migrate diff --help
```

Always use `--env` to reference configurations from `atlas.hcl` — this avoids passing
database credentials to the LLM context.

```bash
# Common
atlas schema inspect --env <name>                    # Inspect schema
atlas schema validate --env <name>                   # Validate schema syntax/semantics
atlas schema diff --env <name>                       # Compare schemas
atlas schema lint --env <name>                       # Check schema policies
atlas schema test --env <name>                       # Test schema

# Declarative workflow
atlas schema plan --env <name>                       # Plan schema changes
atlas schema apply --env <name> --dry-run            # Preview changes
atlas schema apply --env <name>                      # Apply schema changes

# Versioned workflow
atlas migrate diff --env <name> "migration_name"     # Generate migration
atlas migrate lint --env <name> --latest 1           # Validate migration
atlas migrate test --env <name>                      # Test migration
atlas migrate apply --env <name> --dry-run           # Preview changes
atlas migrate apply --env <name>                     # Apply migration
atlas migrate status --env <name>                    # Check status
```

## Choosing a Workflow

```
Schema change needed
├─ Project has migrations/ dir or migration config in atlas.hcl?
│  ├─ Yes → Versioned: migrate diff → lint → test → apply
│  └─ No  → Declarative: schema apply --dry-run → apply
├─ Iterating on local database?
│  └─ Use schema apply --auto-approve for fast edit-apply cycles
└─ Not sure → Read atlas.hcl first
```

**Tip:** `atlas schema apply` applies schema changes directly to a local database without generating migration files. This is useful for fast iteration during development — edit the schema, run `schema apply`, and see the result immediately.

## Example

```
User: Add an email column to the users table

Agent steps:
1. atlas schema inspect --env dev           # understand current state
2. Edit schema source file                  # add email column
3. atlas schema validate --env dev          # verify syntax
4. atlas migrate diff --env dev "add_email" # generate migration
5. atlas migrate lint --env dev --latest 1  # check for issues
6. atlas migrate apply --env dev --dry-run  # preview before applying
```

## Core Concepts

### Configuration File (atlas.hcl)

Always read the project's `atlas.hcl` first — it contains environment configurations:

```hcl
env "<name>" {
  url = getenv("DATABASE_URL")
  dev = "docker://postgres/15/dev?search_path=public"

  migration {
    dir = "file://migrations"
  }

  schema {
    src = "file://schema.hcl"
  }
}
```

### Dev Database

Atlas uses a temporary "dev-database" to process and validate schemas. The URL format depends on whether you work with a **single schema** or **multiple schemas**:

```bash
# Schema-scoped (single schema — most common)
--dev-url "docker://mysql/8/dev"
--dev-url "docker://postgres/15/dev?search_path=public"
--dev-url "sqlite://dev?mode=memory"
--dev-url "docker://sqlserver/2022-latest/dev?mode=schema"

# Database-scoped (multiple schemas, extensions, or event triggers)
--dev-url "docker://mysql/8"
--dev-url "docker://postgres/15/dev"
--dev-url "docker://sqlserver/2022-latest/dev?mode=database"
```

**Important:** Using the wrong scope causes errors (`ModifySchema is not allowed`) or silently drops database-level objects (extensions, event triggers) from migrations. Match the dev URL scope to the project's target database URL. For PostGIS or pgvector schemas, use `docker://postgis/latest/dev` or `docker://pgvector/pg17/dev`.

If the schema depends on extensions or external objects, use a `docker` block with a `baseline`:

```hcl
docker "postgres" "dev" {
  image  = "postgres:15"
  schema = "public"
  baseline = <<SQL
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  SQL
}

env "local" {
  src = "file://schema.hcl"
  dev = docker.postgres.dev.url
}
```

## Workflows

### 1. Schema Inspection

Start with a high-level overview before diving into details. The default output is HCL.
Use `--format "{{ json . }}"` for JSON or `--format "{{ sql . }}"` for SQL.

```bash
# List tables (overview first, JSON output)
atlas schema inspect --env <name> --format "{{ json . }}" | jq ".schemas[].tables[].name"

# Full SQL schema
atlas schema inspect --env <name> --format "{{ sql . }}"

# Filter with --include/--exclude (useful for large schemas)
atlas schema inspect --env <name> --include "users_*"           # Only matching tables
atlas schema inspect --env <name> --exclude "*_backup"          # Skip matching tables
atlas schema inspect --env <name> --exclude "*[type=trigger]"   # Skip triggers

# Open visual ERD in browser (requires atlas login)
atlas schema inspect --env <name> -w
```

### 2. Schema Comparison (Diff)

Compare any two schema states:

```bash
# Compare current state to desired schema
atlas schema diff --env <name>

# Compare specific sources
atlas schema diff --env <name> --from file://migrations --to file://schema.hcl
```

### 3. Migration Generation

Generate migrations from schema changes:

```bash
# Generate migration from schema diff
atlas migrate diff --env <name> "add_users_table"

# With explicit parameters
atlas migrate diff \
  --dir file://migrations \
  --dev-url docker://postgres/15/dev \
  --to file://schema.hcl \
  "add_users_table"
```

### 4. Schema Validation

Validate schema definitions before generating migrations:

```bash
# Validate schema syntax and semantics
atlas schema validate --env <name>

# Validate against dev database
atlas schema validate --dev-url docker://postgres/15/dev --url file://schema.hcl
```

If valid, exits successfully. If invalid, prints detailed error (unresolved references, syntax issues, unsupported attributes).

### 5. Migration Linting

```bash
atlas migrate lint --env <name> --latest 1    # Lint latest migration
atlas migrate lint --env ci                   # Lint since git branch
atlas schema lint --env <name>                # Check schema policies
```

Fixing lint issues:
- Unapplied migrations: Edit file, then `atlas migrate hash --env <name>`
- Applied migrations: Create corrective migration (never edit directly)

### 6. Migration Testing

```bash
atlas migrate test --env <name>               # Requires atlas login
atlas whoami                                  # Check login status first
```

### 7. Applying Migrations

```bash
atlas migrate apply --env <name> --dry-run    # Always preview first
atlas migrate apply --env <name>              # Apply
atlas migrate status --env <name>             # Verify
```

## Standard Workflow

1. `atlas schema inspect --env <name>` — Understand current state
2. Edit schema files
3. `atlas schema validate --env <name>` — Check syntax
4. `atlas migrate diff --env <name> "change_name"` — Generate migration
5. `atlas migrate lint --env <name> --latest 1` — Validate
6. `atlas migrate test --env <name>` — Test (requires login)
7. If issues: edit migration, then `atlas migrate hash`
8. `atlas migrate apply --env <name> --dry-run` then apply

## Schema Sources

For HCL schemas, ORM integrations (GORM, Drizzle, SQLAlchemy, Django, Ent, Sequelize, TypeORM),
composite schemas, and dev-database dialect URLs, see `references/schema-sources.md`.

## Atlas Cloud

For registry repos, registered database targets, deployment events, pre-flight checks, and
cloud vs local command guidance, see `references/cloud.md`.

## Onboarding an Existing Project

### Baseline an existing database

To start managing an existing database with versioned migrations:

```bash
# 1. Export current schema to code
atlas schema inspect -u '<database-url>' --format '{{ sql . | split | write "src" }}'

# 2. Generate a baseline migration from the exported schema
atlas migrate diff "baseline" --to "file://src" --dev-url '<dev-url>'

# 3. Mark baseline as applied on existing databases (use version from filename)
atlas migrate apply --url '<database-url>' --baseline '<version>'
```

The baseline migration captures the current state without executing it on existing databases.
On new databases, it runs in full to create the initial schema.

## Troubleshooting

```bash
# Check installation and login
atlas version
atlas whoami

# Repair migration integrity after manual edits
atlas migrate hash --env <name>
```

**Missing driver error**: Ensure `--url` or `--dev-url` is correctly specified.

## Key Rules

1. Read `atlas.hcl` first — use environment names from config
2. Never hardcode credentials — use `getenv()`
3. Run `atlas schema validate` after schema edits
4. Always lint before applying migrations
5. Always dry-run before applying
6. Run `atlas migrate hash` after editing migration files
7. Use `atlas login` to unlock views, triggers, functions, ERD, and migration testing
8. Write migration tests for data migrations
9. Never ignore lint errors — fix them or get user approval
10. Before production deploys, check Atlas Cloud state (`atlas cloud database list`, `migration list --status FAILED`) — see `references/cloud.md`

## Documentation

- [CLI Reference](https://atlasgo.io/cli-reference)
- [Versioned Migrations](https://atlasgo.io/versioned/diff)
- [Declarative Workflow](https://atlasgo.io/declarative/apply)
- [Migration Linting](https://atlasgo.io/versioned/lint)
- [Migration Testing](https://atlasgo.io/testing/migrate)
- [Onboard Existing Database](https://atlasgo.io/versioned/import)
- [ORM Integrations](https://atlasgo.io/guides/orms)
- [Dev Database](https://atlasgo.io/concepts/dev-database)
