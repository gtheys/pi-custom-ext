# SH Environment: Database + Pod Log Investigation

Only consult this file when the skill was invoked with the `SH` flag (`/engineering:debug <JIRA-ID> SH`). It's project-specific infra detail for this stack — nonprod database credentials and minikube pod naming — not something a generic debugging session should assume.

## PostgreSQL — Nonprod Database

**Connection string:** `postgres://postgres:localpassword@localhost:5432/nonprod`

```bash
# Connect interactively
psql postgres://postgres:localpassword@localhost:5432/nonprod

# Run a one-off query
psql postgres://postgres:localpassword@localhost:5432/nonprod -c "<SQL>"

# List all tables
psql postgres://postgres:localpassword@localhost:5432/nonprod -c "\dt"

# Describe a specific table
psql postgres://postgres:localpassword@localhost:5432/nonprod -c "\d <table_name>"
```

Use to inspect: record state, missing rows, constraint violations, migration state, data inconsistencies.

```bash
# Check migration state (common pattern)
psql postgres://postgres:localpassword@localhost:5432/nonprod -c "SELECT * FROM alembic_version;"
```

Remember to redact any row values that look like secrets or PII before showing them, per the Redact section in SKILL.md.

## Minikube Pod Logs

Pods are named closely after the repository name. Determine the current repo name via:

```bash
basename "$(git remote get-url origin 2>/dev/null | sed 's/\.git$//')" 2>/dev/null \
  || basename "$(git rev-parse --show-toplevel 2>/dev/null)" \
  || basename "$PWD"
```

**Discovery flow:**

```bash
# List all running pods
kubectl get pods -A

# Find pods matching repo name (fuzzy match)
kubectl get pods -A | grep -i "<repo-name>"

# Get logs from a specific pod (all namespaces)
kubectl logs -n <namespace> <pod-name>

# Tail live logs
kubectl logs -n <namespace> <pod-name> --tail=100 -f

# Get logs from previous crashed container
kubectl logs -n <namespace> <pod-name> --previous

# Get logs from a specific container in a multi-container pod
kubectl logs -n <namespace> <pod-name> -c <container-name>

# Describe pod for events/crash reason
kubectl describe pod -n <namespace> <pod-name>
```

If multiple pods match, list them all and ask the user which to focus on, or check all relevant ones. Always show the exact pod/namespace used — pod names rarely match the repo exactly.

**Checking recent logs for errors:**

```bash
kubectl logs -n <namespace> <pod-name> --tail=200 | grep -i "error\|exception\|traceback\|fatal\|warn"
```

## Local Service State

```bash
# Check if expected services are running
kubectl get services -A

# Check deployments and their replica state
kubectl get deployments -A

# Check recent events in the cluster
kubectl get events -A --sort-by='.lastTimestamp' | tail -30

# Check if there are crashlooping pods
kubectl get pods -A | grep -v Running | grep -v Completed
```

Always note crashlooping pods as part of initial triage — a bug reported elsewhere is sometimes just a downstream symptom of a pod that's already down.
