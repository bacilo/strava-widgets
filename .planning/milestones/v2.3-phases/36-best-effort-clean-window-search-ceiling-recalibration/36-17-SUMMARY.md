---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 17
subsystem: analytics
tags: [best-efforts, wr-02, contract, recount]
requirements: [PR-07, PR-09]
requirements-ticked: none
key-files:
  modified:
    - src/analytics/best-effort.types.ts
    - src/analytics/compute-best-efforts.ts
    - src/analytics/compute-best-efforts.test.ts
    - scripts/compute-clean-window-recount.mjs
    - scripts/compute-clean-window-recount.test.mjs
    - .planning/REQUIREMENTS.md
decisions:
  - "WR-02 contract (developer-accepted 2026-11-24): contaminated records the measured window; demotion independently judges the clean figure; only contaminated + unreliable-segment is impossible"
metrics:
  completed: 2026-11-24
  tasks: 2
---

# Phase 36 Plan 17: WR-02 contaminated/demotion contract Summary

One contract enforced at the writer tests, the analytics docblocks and the independent recount: a Branch-2 effort may carry both `contaminated` and a world-record, max-speed or ceiling `demotion`; only `contaminated` plus `unreliable-segment` is impossible. No computed figure changed.

## Commits
- f7782b6e: Task 1 (writer contract tests, docblocks, PR-07 amendment)
- 52750cc2: Task 2 (recount rule narrowed, two-direction tests)

## Task 1
- 3 tests matched by `-t "WR-02 contract"` in compute-best-efforts.test.ts, all passing (max-speed Branch 2, Branch 3 forbidden pair, orchestration ceiling case). `-t "no iteration to convergence"` matched 2, passing; that describe was not edited. Full file: 79 passed. `tsc --noEmit` clean.
- Orchestration case: 100 clean activities at 3.5 m/s plus one contaminated activity whose clean figure is 5.0 m/s. Ceiling computed by hand in the test: p90 index ceil(0.9*101)-1 = 90 gives 3.5, so 1.28 * 3.5 = 4.48 m/s. The effort carries contaminated plus a `ceiling` demotion and is absent from rankings['400m']. Rankings are capped (10), so the clean direction is asserted as non-empty and clean-only.
- compute-best-efforts.ts diff vs 40cf1651 is comment-only (7 added comment lines in Pass 1).
- No RED step applies to Task 1: it demonstrates existing writer behaviour, and its failing direction is carried by Task 2's recount tests and 36-18's WR-03/WR-04 tests.
- PR-07 row in REQUIREMENTS.md carries the dated amendment quoting "Accept the planner's contract". Checkbox stays `[ ]`, Traceability cell stays Pending.
- No "ranks normally" or "demotion is null for every contaminated effort" wording remains in best-effort.types.ts or compute-best-efforts.ts.

## Task 2
- RED: 5 failing (the 3 permitted pairings plus the forbidden case on its new message, plus the re-planted existing test). GREEN: whole recount file 29 passed; `-t "WR-02 contract"` matched exactly 4; `-t "planted"` matched 10.
- Existing two-homes test plant changed from `demotion.guard: 'ceiling'` to `'unreliable-segment'`, expected message fragment changed from "non-null demotion" to "contaminated record and an unreliable-segment demotion".
- `checkInternalConsistency` now fires only on `contaminated` with `demotion.guard === 'unreliable-segment'`. Docblocks updated; "two-homes rule forbids this" count is 0; no new import.
- Live recount: DEFERRED to plan 36-19's gate. This ran in a worktree without a regenerated `data/stats/`, and stale data must not be reported as current. The expected figures remain pass=1440 fail=0 notAssessable=74 (the contaminated-and-demoted overlap was 0 per 36-VERIFICATION.md).

## Deviations from Plan
None. STATE.md and ROADMAP.md untouched; no requirement ticked.

## Self-Check: PASSED
Both commits exist; SUMMARY and modified files present.
