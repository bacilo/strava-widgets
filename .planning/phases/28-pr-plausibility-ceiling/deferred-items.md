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

## Gap closure 28-10..28-15 (not folded in)

Findings and scope boundaries deliberately NOT rolled into this gap-closure wave, with reasons.
Recorded per plan 28-14's instruction; disposition is the developer's call, not this wave's.

- **WR-06, second half** (making the ceiling-state write opt-in, e.g. CI-only): it changes a D-07
  mechanism, so the developer must decide it. A CI-only gate that silently stops writing would be
  a gate that fails quietly. The comments were corrected in 28-11 (WR-06's comment-only half is
  closed). Local runs still rewrite `data/best-effort-ceiling.json` when the population, p90 or
  ceiling moves. The workaround is to leave that file uncommitted after local runs.
- **IN-05** (`LOW_CONFIDENCE_BADGE_TEXT` pulls `list.ts` into `records-logic.ts`'s import graph):
  a purity refactor of `list.ts`, a file this round does not otherwise touch, with no behaviour
  impact.
- **WR-01's non-empty This-year path is unit-tested only.** No 2026 effort is in any all-time
  top-10 today, so every This-year table renders its empty state, and a browser row could not
  tell the fixed code from the broken code.
- **R4 (the ceiling-emptied table) is still NOT EXERCISABLE:** no distance has zero ranked rows
  and a positive demoted count. Confirmed again after this wave's regeneration: post-fix
  `data/stats/best-efforts.json` still ranks 10 rows at every distance whose ceiling is not
  fail-open (400m, 1k, 1mi, 5k, 10k, half all show `demoted=... 0 of 10` or a nonzero-but-partial
  demoted count against a full 10-row table; only marathon has 0 ranked rows, and marathon's
  demoted count is 0 too, so the co-occurrence R4 needs still does not exist).
- **A pre-existing case, not from Phase 28:** a distance whose every effort is owner-excluded
  renders "No {label} efforts yet", which reads as if no effort was recorded.
- **Merging `origin/master`** (9 CI data commits behind at planning time) is held until plan
  28-15 closes, so the snapshot stays pinned. Merge after the checkpoint, and never rebase.
