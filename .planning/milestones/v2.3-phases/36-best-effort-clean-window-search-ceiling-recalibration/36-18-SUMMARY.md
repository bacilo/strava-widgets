---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 18
subsystem: dashboard
tags: [best-efforts, contamination, badges, records, gap-closure]
requires: [36-17 WR-02 contract (parallel)]
provides:
  - rank-conditional contaminated badge copy (WR-03)
  - countContaminatedAtDistance skipping demoted efforts (WR-04)
key-files:
  modified:
    - src/dashboard/views/detail-best-efforts-logic.ts
    - src/dashboard/views/detail-best-efforts-logic.test.ts
    - src/dashboard/views/records-logic.ts
    - src/dashboard/views/records-logic.test.ts
decisions:
  - "Badge word follows rank: ranks = !excluded && !demoted selects Ranked vs Measured; kind and descriptionIdSuffix unchanged"
metrics:
  tasks: 2
  completed: 2026-11-24
---

# Phase 36 Plan 18: Truthful contaminated badge and contamination count Summary

A contaminated effort's badge now says "Ranked on clean window" only when it ranks (otherwise "Measured on clean window"), and the Records contamination count skips demoted efforts. Requirements ticked: none.

## Commits
- 1074a43d: Task 1, rank-conditional badge copy (WR-03)
- 24ec7215: Task 2, countContaminatedAtDistance demotion skip (WR-04)

## Changed expectations (detail-best-efforts-logic.test.ts)
- Existing contaminated-badge tests (reason and null-reason fallback): fixtures now state `excluded: false, demoted: false` explicitly. Expectations are unchanged ("Ranked on clean window ..."). Both assert on ranking fixtures only.
- The "contaminated AND demoted AND excluded" panel-row test asserts only row flags, not badge text, so it needed no change. The Measured copy for that combination is asserted in the new describe (the all-flags row, plus separate excluded and demoted rows).
- ORDER and R15 tests are kinds/suffixes only and are unchanged.
- No existing test asserted "Ranked" beside Excluded/Demoted on a badge, so nothing was deleted. The new describe `prFlagBadgeSpecs — contaminated badge on a non-ranking row WR-03` (5 tests) pins the exact strings.

## TDD
- Task 1 RED: 4 failed, 1 passed. GREEN: 5 passed.
- Task 2 RED: 2 failed, 1 passed (3 matched). GREEN: 3 passed.

## Verification
- records-logic + records tests: 141 passed. detail-best-efforts-logic + detail-sections: all pass. `npx tsc --noEmit` exits 0.
- `-t "contaminated badge wiring"` in detail-sections.test.ts: 4 passed, file unmodified against 40cf1651. records.test.ts also unmodified.

## Deviations from Plan
None. Environment note: in the bare worktree, the first detail-sections run failed 3 tests and records-logic.test.ts failed to load because untracked `data/` was missing. This was a fixture problem, not a regression. After copying `data/` from the primary checkout (not committed), all of them passed.

## Self-Check: PASSED
