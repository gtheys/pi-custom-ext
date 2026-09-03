---
name: tdd-workflow
description: Use this skill whenever writing new features, fixing bugs, refactoring code, adding API endpoints, or creating new components. Enforces test-driven development through a strict red-before-green loop, tests written at agreed public seams (not implementation details), and 80%+ coverage across unit, integration, and E2E tests. Make sure to consult this skill before writing any implementation code, not just when the user explicitly asks for "tests" or "TDD" — if code is being written or changed, this skill applies.
---

# Test-Driven Development Workflow

TDD is the red → green loop. This skill is the reference that makes that loop produce tests worth keeping: what a good test is, where tests go, the anti-patterns that quietly ruin a test suite, and the rules of the loop itself. Every section below applies on every cycle — consult them before and during the loop, not after the fact once a pile of code and tests already exists.

## When to Activate

- Writing new features or functionality
- Fixing bugs or issues
- Refactoring existing code
- Adding API endpoints
- Creating new components

## Before You Start

If the project has a `CONTEXT.md`, read it so test names and the vocabulary you use for interfaces match the project's own domain language rather than generic placeholders. Respect any ADRs (architecture decision records) that cover the area you're about to touch — a test suite that fights a documented decision is a sign you're solving the wrong problem.

## What a Good Test Is

Tests verify behavior through public interfaces, not implementation details. The code behind an interface can be rewritten entirely and the test shouldn't need to change. A good test reads like a specification — `"user can checkout with valid cart"` tells you exactly what capability exists, and it survives refactors because it never cared about internal structure in the first place.

See `references/tests.md` for worked examples of good vs. bad tests, and `references/mocking.md` for mocking guidelines.

## Seams: Where Tests Go

A **seam** is the public boundary you test at — the interface where you can observe behavior without reaching inside. Tests live at seams, never against internals.

Before writing any test, write down the seams under test and confirm them with the user. Don't write a test at a seam that hasn't been agreed. You can't test everything, so agreeing the seams up front is what makes testing effort land on critical paths and complex logic instead of spreading thin across every incidental edge case.

Ask: **"What's the public interface here, and which seams should we test?"**

If the shape of that interface is itself in question — how deep the module should be, where the seam belongs, what the interface ought to expose — and a codebase-design skill or reference is available in this environment, consult it for shared vocabulary (module, interface, depth, seam, adapter). Treat it as a reference to check, not a workflow to run.

## Anti-Patterns

Watch for these three failure modes — they're the ones that let a test suite pass while quietly stopping being useful:

- **Implementation-coupled**: mocks internal collaborators, tests private methods, or verifies through a side channel (e.g. querying the database directly instead of going through the interface). The tell: the test breaks when you refactor even though behavior hasn't changed.
- **Tautological**: the assertion recomputes the expected value the same way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand using the same logic, a constant asserted equal to itself). This kind of test passes by construction and can never disagree with the code. Expected values must come from an independent source of truth — a known-good literal, a worked example, the spec.
- **Horizontal slicing**: writing all the tests for a feature first, then all the implementation. This feels efficient but the bulk-written tests end up verifying imagined behavior rather than real behavior, they go insensitive to changes because they were never driven by an actual implementation, and you lock in test structure before you understand the shape of the solution. Work in vertical slices instead — see "Rules of the Loop" below.

Full examples of each of these (and their fixes) are in `references/tests.md`.

## Rules of the Loop

- **Red before green.** Write the failing test first, then write only enough code to make it pass. Don't anticipate future tests or add speculative features the current test doesn't require.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle. Each cycle is a tracer bullet that responds to what the previous cycle taught you — this is what a vertical slice looks like in practice, as opposed to the horizontal-slicing anti-pattern above.
- **Refactoring is not part of the loop.** It happens at the review stage, after the cycle is green — not folded into the red → green cycle itself. Keep the two activities separate so it's always clear whether you're changing behavior or just its internal shape.

### The loop, concretely

1. **Write one user journey.** `As a [role], I want to [action], so that [benefit]`.
2. **Pick one seam and one test case for it.** Not the whole list — one.
3. **Write that test. Run it. Confirm it fails** (and fails for the right reason — a typo or import error isn't a real red).
4. **Write the minimal implementation to pass it.** Resist adding anything the test doesn't demand.
5. **Run it again. Confirm it's green.**
6. **Repeat from step 2** for the next test case in the journey, letting each new test grow the implementation incrementally.
7. Once the journey's cycles are done, refactor as a separate pass — remove duplication, improve naming, tidy structure — with the tests green throughout.
8. **Verify coverage** once the feature's cycles are complete (see Coverage below).

## Test Types

A full feature typically needs coverage at three levels. Code patterns and examples for each are in `references/patterns.md`.

- **Unit** — individual functions, pure logic, component behavior, helpers.
- **Integration** — API endpoints, database operations, service interactions, external API calls.
- **E2E (Playwright)** — critical user flows, complete workflows, browser automation.

## Mocking

Mock only at system boundaries — external APIs, databases (prefer a real test DB when practical), time/randomness, sometimes the filesystem. Don't mock your own modules or internal collaborators; if a test needs to mock something you wrote to make it pass, that's usually a sign the test is at the wrong seam, not that the mock is missing. See `references/mocking.md` for the reasoning, dependency-injection patterns, and concrete mocks for common services (Supabase, Redis, OpenAI-style embedding calls).

## Test File Organization

```
├── src/
│   └── ...production code only...
└── test/
    ├── unit/                # pure unit tests (no network/db)
    ├── integration/         # routers/services touching db libs, supertest, etc
    ├── e2e/                 # black-box / end-to-end (HTTP-level)
    ├── e2e-db/              # special DB validation suite + own config
    ├── helpers/             # shared test helpers
    ├── fixtures/            # shared fixtures
    ├── setup/
    │   └── jest-setup.js
    └── mocks/
        └── ...service mocks...
```

## Coverage

Minimum 80% coverage (unit + integration + E2E combined), with all edge cases, error scenarios, and boundary conditions covered. Treat this as a floor that falls out naturally from testing every seam you agreed to test — not a target to chase by adding tests that pad the number. A tautological test can hit 100% coverage on a line and still tell you nothing; a suite built one honest red→green cycle at a time won't have that problem. See `references/project-setup.md` for the coverage config, CI wiring, and pre-commit setup.

## Best Practices

1. Red before green, always.
2. One assertion focus per test — test a single behavior.
3. Descriptive test names that explain *what*, not *how*.
4. Arrange–Act–Assert structure.
5. Mock only at system boundaries.
6. Test edge cases: null, undefined, empty, large.
7. Test error paths, not just the happy path.
8. Keep unit tests fast (< 50ms each).
9. Clean up after tests — no shared state, no side effects.
10. Review coverage reports to find gaps, not to chase a percentage.

## Success Metrics

- Every test maps to an agreed seam, and you could explain what capability it specifies without reading its body.
- 80%+ coverage achieved as a byproduct of that, not as the goal itself.
- All tests passing, none skipped or disabled.
- Refactors don't break tests unless behavior actually changed.
- Fast test execution (< 30s for unit tests).
- E2E tests cover the critical user flows end to end.
