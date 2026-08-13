# Deferred Items — Phase 20

Out-of-scope discoveries logged during execution, not fixed per the executor's
scope boundary rule (only auto-fix issues directly caused by the current
task's changes).

## Plan 20-01

- **Pre-existing environment gap, not caused by this plan:** `npx vitest run`
  (full suite) reports 5 failing test files in this worktree checkout —
  `records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`,
  `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`,
  `trends-yoy-logic.test.ts` — all failing with `ENOENT` on gitignored
  generated data files (`data/stats/*.json`, `data/dashboard/index.json`,
  confirmed absent via `.gitignore` lines 9-22). These files read live
  pipeline output that a fresh worktree clone never generates. Unrelated to
  `src/dashboard/row-navigation.ts` / `row-navigation.test.ts`, the only files
  this plan touches. 845 of the remaining tests pass; `npx tsc --noEmit`
  is clean. The plan's stated 927-test baseline cannot be reproduced in this
  isolated worktree for this pre-existing reason, not a regression introduced
  here.
