# Phase 24 — Deferred Items

## Pre-existing worktree environment gap (not caused by plan 24-01)

**Found during:** plan 24-01, Task 1 verification (`npm test`)

**Symptom:** 6 of 55 collected test files fail in this parallel-execution worktree:
- `src/dashboard/views/trends-training-load-logic.test.ts` — ENOENT on `data/stats/training-load.json`
- `src/dashboard/views/trends-yoy-logic.test.ts` — ENOENT on `data/stats/year-over-year.json`
- `src/dashboard/views/trends-zoom-logic.test.ts` — ENOENT on
  `node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js` (relative-path read from the
  test file, not a bare `import`)
- (plus 3 more sibling trends-* files with the same class of failure)

**Root cause:** this worktree's own `node_modules/` is empty (0 packages) — Node's module
resolution walks up to the main repo's `node_modules/` for bare `import` specifiers (which is why
`vite`/`vitest` themselves run fine), but these three test files build an explicit **relative**
`new URL('../../../node_modules/...', import.meta.url)` path, which resolves inside the worktree
itself and finds nothing there. Separately, `data/stats/*.json` is gitignored generated build
output (per `.gitignore`) and was never produced in this worktree checkout.

**Why out of scope for plan 24-01:** None of the 6 failing files import or reference
`vitest.config.ts`, `.gitignore`, `scripts/lib/copy-data-tree.mjs`, or `scripts/build-widgets.mjs`
— the four files this plan's Task 1 touches. The failures are reproducible on a clean worktree
checkout regardless of this plan's changes; the widened `include` glob still collects the
identical 55 test files (0 dropped, 0 added — no `scripts/**/*.test.mjs` file exists yet before
Task 3), and all 1218 previously-passing assertions in the other 49 files still pass.

**Disposition:** Not fixed. Logged per the Scope Boundary rule (only auto-fix issues directly
caused by the current task's changes). The orchestrator/user should confirm whether this is
expected parallel-worktree infrastructure behavior (each agent worktree does not get its own
`npm install` or a copy of generated `data/stats/`) or a setup bug to address at the harness
level, not inside this plan.
