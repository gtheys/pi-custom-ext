# Project Setup: Coverage, CI, and Continuous Testing

## Coverage Thresholds

```json
{
  "jest": {
    "coverageThresholds": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

Run the report with:

```bash
npm run test:coverage
```

Treat a gap in the report as "which seam did we skip," not "which line needs a test bolted on." A line covered by a tautological test is worse than a line left uncovered, because it hides the gap instead of surfacing it.

## Watch Mode During Development

```bash
npm test -- --watch
```

Tests run automatically on file changes — useful while you're inside a red→green cycle.

## Pre-Commit Hook

```bash
npm test && npm run lint
```

## CI/CD Integration

```yaml
# GitHub Actions
- name: Run Tests
  run: npm test -- --coverage
- name: Upload Coverage
  uses: codecov/codecov-action@v3
```
