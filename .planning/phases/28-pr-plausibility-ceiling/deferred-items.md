# Deferred Items — Phase 28

Out-of-scope discoveries logged during plan execution, not fixed per the executor's scope
boundary rule (only auto-fix issues directly caused by the current task's changes).

## Plan 28-01

- **Pre-existing, environment-only `npx vitest run` failures in this fresh worktree checkout**,
  unrelated to any file this plan touches (`scripts/compute-pr-ceiling-calibration.mjs`,
  `scripts/compute-pr-ceiling-calibration.test.mjs`, `package.json`,
  `28-CEILING-CALIBRATION.md`):
  - `scripts/verify-dashboard-publish-stats.test.mjs`,
    `src/dashboard/views/records-logic.test.ts`,
    `src/dashboard/views/trends-gear-logic.test.ts`,
    `src/dashboard/views/trends-training-load-logic.test.ts`,
    `src/dashboard/views/trends-yoy-logic.test.ts` all fail with `ENOENT` reading gitignored
    `data/stats/*.json` documents (`year-over-year.json`, `training-load.json`,
    `gear-aggregate.json`, etc.) that this worktree never generated — this plan only ran
    `npm run compute-best-efforts` and `npm run compute-dashboard-index` (the two documents its
    own calibration script reads), not the full `compute-all-stats` chain.
  - `src/dashboard/views/trends-zoom-logic.test.ts` fails with `ENOENT` reading
    `node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js`, which does not exist in
    this worktree's `node_modules` despite the package being a listed dependency — an
    installation-layout issue, not a code defect.
  - Neither failure is caused by, or fixable within, this plan's file scope. Running
    `npm run compute-all-stats` (which requires network/API access this sandboxed worktree does
    not have) or reinstalling `node_modules` would be the respective fixes, both out of scope for
    a calibration-script plan.

## Plan 28-03

Same category of pre-existing, environment-only `npx vitest run` failures in this fresh worktree
checkout, none caused by or fixable within this plan's file scope
(`src/analytics/best-effort-utils.ts`, `best-effort-utils.test.ts`, `best-effort-ceiling.ts`,
`best-effort-ceiling.test.ts`, `best-effort.types.ts`):

- `scripts/compute-pace-quality-calibration.test.mjs`, `scripts/compute-pace-residual.test.mjs`,
  `scripts/compute-pr-ceiling-calibration.test.mjs` all fail with `Cannot find module
  '../dist/analytics/*.js'` — these `.mjs` scripts import from a compiled `dist/analytics/`
  directory that does not exist in this worktree (no `npm run build` has been run here). Not
  caused by any TypeScript source change in this plan.
- `scripts/verify-dashboard-publish-stats.test.mjs`, `src/dashboard/views/records-logic.test.ts`,
  `src/dashboard/views/trends-cadence-hr-logic.test.ts`,
  `src/dashboard/views/trends-gear-logic.test.ts`,
  `src/dashboard/views/trends-training-load-logic.test.ts`,
  `src/dashboard/views/trends-yoy-logic.test.ts` all fail with `ENOENT` reading gitignored
  `data/stats/*.json` / `data/dashboard/index.json` documents this worktree never generated —
  same root cause plan 28-01 already logged above.
- `src/dashboard/views/trends-zoom-logic.test.ts` fails with `ENOENT` reading
  `node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js` — same installation-layout
  gap plan 28-01 already logged above.
- `npx tsc --noEmit` is clean and `npx vitest run src/analytics/best-effort-ceiling.test.ts
  src/analytics/best-effort-utils.test.ts` passes 55/55 in isolation; the full `npm test` run is
  1918 passed / 10 failed (all 10 pre-existing environment gaps above, 0 caused by this plan).
