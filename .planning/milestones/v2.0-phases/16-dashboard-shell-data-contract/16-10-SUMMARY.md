---
phase: 16-dashboard-shell-data-contract
plan: 10
subsystem: dashboard-shell
tags: [routing, id-validation, regex, vitest, gap-closure]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract
    provides: "isValidActivityId chokepoint (16-03) and detail-client lazy fetch (16-05)"
provides:
  - "Widened isValidActivityId predicate (/^i?\\d{1,20}$/) accepting intervals.icu-shaped ids"
  - "Regression coverage proving i-prefixed ids reach fetch-URL construction end-to-end"
  - "Corrected must-have wording in 16-03/16-05 that had mandated the defect"
affects: [16-14, dashboard-detail-view, activity-browser]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Single-regex chokepoint widened in place rather than duplicated; consumers unchanged"]

key-files:
  created: []
  modified:
    - src/dashboard/router.ts
    - src/dashboard/router.test.ts
    - src/dashboard/data/detail-client.test.ts
    - .planning/phases/16-dashboard-shell-data-contract/16-03-PLAN.md
    - .planning/phases/16-dashboard-shell-data-contract/16-05-PLAN.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Widened the id regex from /^\\d{1,20}$/ to /^i?\\d{1,20}$/ only — no general alphanumeric pattern, no second regex, keeping T-16-RT-01's traversal/injection guarantee intact"
  - "Corrected 16-03/16-05 must-have wording (the only sanctioned prior-plan edit in this pass) since the old wording literally specified the defect"
  - "Flipped DASH-01 checklist marker to [ ] to match its already-Pending status-table row — routing is only human-confirmed locally, not yet on GitHub Pages"

patterns-established: []

requirements-completed: [DASH-02]

# Metrics
duration: ~15min
completed: 2026-08-11
---

# Phase 16 Plan 10: Widen activity-id chokepoint for intervals.icu ids Summary

**Widened the single `isValidActivityId` regex chokepoint from all-digits to an optional leading `i` plus digits, unblocking lazy-loaded detail views for the 55 newest (intervals.icu-sourced) archive activities, with full regression coverage at both the router and detail-client layers.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3 completed
- **Files modified:** 6

## Accomplishments
- `isValidActivityId` now accepts both Strava-era bare-digit ids (`3475726256`) and intervals.icu `i`-prefixed ids (`i174109928`), while every traversal/injection near-miss remains rejected
- `detailClient.loadDetail('i174109928')` proven (via committed test) to reach URL construction and issue `data/activities/i174109928.json` then `data/streams/i174109928.json`
- Corrected the two prior-plan must-haves (16-03, 16-05) that had specified "not all digits is rejected" — wording that literally mandated the shipped defect
- DASH-01 checklist marker in REQUIREMENTS.md corrected from `[x]` to `[ ]` to match its Pending status-table row

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen the id chokepoint and add regression cases to router.test.ts** - `e9c9ca0` (fix)
2. **Task 2: Add an i-prefixed happy path and near-miss rejects to detail-client.test.ts** - `337c945` (test)
3. **Task 3: Correct the two mis-specified plan must-haves and the DASH-01 checklist marker** - `c7ed009` (docs)

_Note: SUMMARY.md commit follows as plan metadata._

## Files Created/Modified
- `src/dashboard/router.ts` - `isValidActivityId` pattern widened to `/^i?\d{1,20}$/`; doc comment rewritten to describe both id shapes and the preserved traversal/injection guarantee
- `src/dashboard/router.test.ts` - Added accept cases for `i174109928`/`i174284902`, near-miss reject cases (`x123`, `i`, `ii123`, `I174109928`, `1i23`, `i12.3`, `i../secrets`), and i-prefixed ceiling coverage (20 vs 21 digits)
- `src/dashboard/data/detail-client.test.ts` - Added `fakeIntervalsActivity`/`fakeIntervalsStream` fixtures (real no-`Z` `start_date_local` shape), an end-to-end happy-path test for `loadDetail('i174109928')`, and four new near-miss ids in the `invalidIds` array; implementation file untouched
- `.planning/phases/16-dashboard-shell-data-contract/16-03-PLAN.md` - Must-have truth reworded from "not all digits" to "outside the accepted shape (bare digits, or a single leading 'i' followed by digits)"
- `.planning/phases/16-dashboard-shell-data-contract/16-05-PLAN.md` - Same wording correction at the client layer
- `.planning/REQUIREMENTS.md` - DASH-01 checklist marker `[x]` → `[ ]` to agree with its Pending status-table row

## Prior plan text corrected

This is the one sanctioned edit to prior plan text in this gap-closure pass (Task 3), called out explicitly per plan instructions:

**`.planning/phases/16-dashboard-shell-data-contract/16-03-PLAN.md` line 19**
- Before: `"An activity id that is not all digits is rejected before it can reach any fetch URL or the DOM"`
- After: `"An activity id outside the accepted shape (bare digits, or a single leading 'i' followed by digits) is rejected before it can reach any fetch URL or the DOM"`

**`.planning/phases/16-dashboard-shell-data-contract/16-05-PLAN.md` line 19**
- Before: `"An activity id that is not all digits is rejected before any network request is made"`
- After: `"An activity id outside the accepted shape (bare digits, or a single leading 'i' followed by digits) is rejected before any network request is made"`

No other line in either file was touched (confirmed via `git diff --numstat`: exactly `1 1` for each).

## Decisions Made
- Widened the regex minimally (`i?` prefix only) rather than a broader alphanumeric pattern, per the plan's explicit instruction and to keep the traversal/injection guarantee provable by the same near-miss test strings
- Did not modify `detail-client.ts` — it already imports `isValidActivityId` as the single chokepoint, so Task 1's fix propagates automatically; Task 2 only adds regression coverage proving that propagation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Worktree base mismatch at startup:** The worktree's branch (`worktree-agent-a02b85846e2272c57`) was not based on the expected commit `cdc4211` (its merge-base was an older commit, `4967a8b`, and `.planning/phases/` did not exist at all in the checked-out tree). This is exactly the scenario the `<worktree_branch_check>` step's `git reset --hard` exception (#2015) exists for. Corrected via the sanctioned `git reset --hard cdc4211c173d9cf83fadaee25b3774368b6d19ec` inside that step before any task work began; confirmed HEAD landed on the expected commit and `.planning/phases/16-dashboard-shell-data-contract/16-10-PLAN.md` became readable.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SC2/P07 gap closed for the id-validation half of DASH-02: `isValidActivityId` and `detailClient.loadDetail` both proven to accept intervals.icu ids with committed regression tests
- `npm test` now at 348 passing tests (up from 334 recorded at verification time), `npx tsc --noEmit` clean
- Remaining Phase 16 gap-closure plans (16-11..16-16) are independent follow-ups per the phase's gap-closure plan; this plan's scope (CR-01/IN-07, SC2/P07) is fully closed
- No blockers identified

---
*Phase: 16-dashboard-shell-data-contract*
*Completed: 2026-08-11*

## Self-Check: PASSED

All files referenced in this summary exist on disk (router.ts, router.test.ts, detail-client.test.ts, 16-03-PLAN.md, 16-05-PLAN.md, REQUIREMENTS.md, this SUMMARY.md). All three task commit hashes (`e9c9ca0`, `337c945`, `c7ed009`) are present in `git log --oneline`.
