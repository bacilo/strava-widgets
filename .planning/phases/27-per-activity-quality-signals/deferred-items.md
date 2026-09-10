# Deferred Items

## Plan 27-01: pre-existing `npm run test` failures, out of scope

Observed when running the full suite (`npm run test`) after completing plan 27-01's Task 3.
None of these 8 failing files are touched by this plan (`src/analytics/pace-quality.ts`,
`pace-quality.test.ts`, `pace-fixtures.ts`, `pace-fixtures.test.ts`), and none were introduced
by this plan's changes — confirmed by checking the failure causes below, all of which are
this worktree's environment state, not code defects.

| File | Cause |
|---|---|
| `scripts/compute-pace-residual.test.mjs` | reads a gitignored, derived `data/stats/` output never generated in this fresh worktree |
| `scripts/verify-dashboard-publish-stats.test.mjs` | same — gitignored derived output absent |
| `src/dashboard/views/records-logic.test.ts` | `ENOENT: data/stats/best-efforts.json` — gitignored, never generated locally |
| `src/dashboard/views/trends-cadence-hr-logic.test.ts` | `ENOENT: data/dashboard/index.json` — gitignored, never generated locally |
| `src/dashboard/views/trends-gear-logic.test.ts` | `ENOENT: data/stats/gear-aggregate.json` — gitignored, never generated locally |
| `src/dashboard/views/trends-training-load-logic.test.ts` | `ENOENT: data/stats/training-load.json` — gitignored, never generated locally |
| `src/dashboard/views/trends-yoy-logic.test.ts` | `ENOENT: data/stats/year-over-year.json` — gitignored, never generated locally |
| `src/dashboard/views/trends-zoom-logic.test.ts` | `ENOENT: node_modules/chartjs-plugin-zoom/dist/...` — this worktree's own `node_modules/` was created empty; Node module resolution silently falls back to the parent repo's `node_modules/` for `import` specifiers, but this test reads the package file via a relative `fs` path from `__dirname`, which resolves inside the worktree's own (empty) `node_modules/` and fails |

Root cause for the last six: this worktree's dependency install never ran (`node_modules/`
directory exists but is empty — 0 entries) and the CI compute pipeline
(`npm run process` / `compute-all-stats`) never ran to produce `data/stats/*.json` and
`data/dashboard/index.json`. Both are outside this plan's scope (interface-first, pure
TypeScript, no I/O) and outside the deviation rules' auto-fix boundary (running the full
compute pipeline touches dozens of unrelated files and activity data; a fresh `npm install`
is excluded from Rule 3's auto-fix scope by policy).

Everything this plan actually modifies passes cleanly:
```
npx tsc --noEmit                                                         # 0 errors
npx vitest run src/analytics/pace-quality.test.ts src/analytics/pace-fixtures.test.ts
# 55 tests passed (2 files)
```
