# Deferred Items — Phase 21 (overview-rebuild)

## Plan 21-02

- **Pre-existing environmental gap, out of scope**: `npm test` reports 5 failing test
  files unrelated to this plan's changes —
  `src/dashboard/views/trends-cadence-hr-logic.test.ts`,
  `src/dashboard/views/trends-gear-logic.test.ts`,
  `src/dashboard/views/trends-training-load-logic.test.ts`,
  `src/dashboard/views/trends-yoy-logic.test.ts`, and one records-index-shaped
  test — all `ENOENT: no such file or directory` against `data/dashboard/index.json`
  and `data/stats/*.json`. Both `data/dashboard/` and `data/stats/` are gitignored
  (`.gitignore` lines 11/14) — generated pipeline output not present in a fresh
  worktree checkout, not something this plan's task files (`list.ts`, `list.test.ts`,
  `row-semantics.test.ts`) touch or could fix. Not auto-fixed per the executor's
  scope-boundary rule. The two plan-relevant test files
  (`src/dashboard/views/list.test.ts`, `src/dashboard/row-semantics.test.ts`) and
  `npx tsc --noEmit` and `npm run build-widgets` are all green.
