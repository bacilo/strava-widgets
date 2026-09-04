# Phase 25 Deferred Items

Out-of-scope discoveries logged per the executor's scope-boundary rule (not fixed, not blocking).

## From plan 25-02

- **`chartjs-plugin-zoom` missing from this worktree's `node_modules`** (found during Task 3's whole-suite `npx vitest run` regression check). `node_modules/chartjs-plugin-zoom/` does not exist even though the package is declared in `package.json`/`package-lock.json` — this worktree's `node_modules` has only 2 top-level entries, an incomplete install unrelated to plan 25-02's scope (`src/compute-all-stats-steps.ts`, `src/compute-all-stats-steps.test.ts`, `src/index.ts`, `.github/workflows/daily-refresh.yml`). Causes one test file (a Trends-chart plugin-source test, sibling of `src/dashboard/theme.test.ts`) to fail at collection/import time. Package-manager installs are excluded from Rule 3 auto-fix, so this was left unfixed. All other 1,505 tests pass (11 skipped). Likely resolves with a full `npm ci` in this worktree or on merge back to a checkout with a complete install.
