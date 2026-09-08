# Deferred Items — Phase 26 Plan 01

## Pre-existing environment failures (out of scope, not caused by this plan)

Observed via `npm run test` after Task 2: 7 test files fail in this fresh worktree checkout,
none of them touching `src/analytics/pace-derivation.ts` or `pace-derivation.test.ts`:

- `scripts/verify-dashboard-publish-stats.test.mjs`
- `src/dashboard/views/records-logic.test.ts`
- `src/dashboard/views/trends-cadence-hr-logic.test.ts`
- `src/dashboard/views/trends-gear-logic.test.ts`
- `src/dashboard/views/trends-training-load-logic.test.ts`
- `src/dashboard/views/trends-yoy-logic.test.ts`

All six above fail with `ENOENT` reading `data/stats/*.json` — a gitignored, derived-output
directory that is absent until the compute pipeline runs; not present in this fresh worktree.

- `src/dashboard/views/trends-zoom-logic.test.ts` fails with `ENOENT` reading
  `node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js` — an npm-install artifact
  gap in this worktree, unrelated to any code change in this plan.

Not fixed (out of scope, Rule 1-3 boundary): pre-existing conditions in unrelated files, not
caused by Task 1 or Task 2's changes. `npx tsc --noEmit` is clean and
`npx vitest run src/analytics/pace-derivation.test.ts` passes 10/10.
