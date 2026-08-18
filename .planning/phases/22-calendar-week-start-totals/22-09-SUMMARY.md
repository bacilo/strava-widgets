---
phase: 22-calendar-week-start-totals
plan: 09
subsystem: ui
tags: [css, grid, responsive, vitest, calendar]

# Dependency graph
requires:
  - phase: 22-calendar-week-start-totals
    provides: plan 22-06's deeper 380px type compaction (the shape this plan reconciles with and supersedes at the 380px breakpoint only)
provides:
  - "BL-01 fix: .calendar-grid's 8th (Total) track gets a zero floor at 380px via minmax(0, max-content), replacing the unyielding white-space: nowrap content floor that absorbed the day tracks' entire width shortfall"
  - "BL-02 fix: .calendar-day collapses to a single-column stack at 380px with all three children justify-self: start, giving the distance value the full cell width instead of a third of an already-collapsed cell"
  - "Two overflow-wrap: anywhere floors (day distance, week total) that lower min-content contribution so the grid track floor actually holds at the arithmetic edge"
  - "WR-07 cleanup: .calendar-week-total__distance's 380px override reduced to font-size: 14px alone"
  - "atRuleBodiesFor(needle, property) test helper — the value-reading sibling of assertNoAtRuleOverride, sharing the same RULE_SCANNER/isAtRuleScoped/splitTopLevelSelectors substrate"
  - "9 new value-asserting test cases plus one inverted pre-existing case (.calendar-grid no longer asserted as never-overridden)"
affects: [22-10, 22-11, 22-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "atRuleBodiesFor: returning sibling of a throwing existence-proof helper, built on the identical scanning substrate so the two can never disagree about what a rule is"
    - "Value-level assertions over at-rule-scoped CSS overrides, closing an existence-only test-coverage gap (WR-03)"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts

key-decisions:
  - "BL-01 and BL-02 landed together in the same 380px block with their test coverage, per 22-REVIEW.md's explicit warning that verifying either alone reproduces another ambiguous R13-style result"
  - "The 8th track's sizing function (not the eight-track contract) changes at 380px — GC-4c deliberately supersedes plan 22-06's must-have that the track list is unchanged at every breakpoint, under 22-CONTEXT.md's Claude's-Discretion clause for the 8th column's exact CSS track"
  - "overflow-wrap: anywhere (never break-word) on both overflowing elements — only anywhere lowers min-content contribution, which is what the grid track floor is computed from"
  - "No overflow/overflow-x/text-overflow was added anywhere — the .splits-scroll horizontal-scroll wrapper remains the documented, unimplemented fallback (GC-1's focus-order rejection still holds)"

patterns-established:
  - "atRuleBodiesFor: WR-03's answer to existence-only at-rule override guards — future CSS override coverage should read values through this helper rather than pairing assertNoAtRuleOverride alone"

requirements-completed: []

# Metrics
duration: ~15min
completed: 2026-08-18
---

# Phase 22 Plan 09: Close CAL-02 Gap 1 (BL-01/BL-02 380px calendar overflow) Summary

**Fixed both root causes of the ~380px day-cell overflow that failed R11 and R13 twice — the 8th grid track's unyielding nowrap floor (BL-01) and the day cell's centred three-column distance layout (BL-02) — landed together with a value-asserting test substrate that closes the existence-only coverage gap that let the R13 regression ship unnoticed.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-18T22:14:12+02:00 (base commit)
- **Completed:** 2026-08-18T22:24:43Z
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 2

## Accomplishments

- `.calendar-grid` at 380px now redeclares `grid-template-columns: repeat(7, minmax(0, 1fr)) minmax(0, max-content)`, giving every track (day and Total) an explicit zero floor instead of only the seven day tracks
- `.calendar-day` at 380px collapses to a single-column stack (`grid-template-areas: "number" "distance" "count"`, `grid-template-columns: 1fr`) with `.calendar-day__number`/`__distance`/`__count` all `justify-self: start`, so the distance value gets the full cell width
- `.calendar-day__distance` and `.calendar-week-total` both gain `overflow-wrap: anywhere` at 380px — the deliberate strengthening (GC-4e) that makes the fix hold at the arithmetic edge, since only `anywhere` lowers an element's min-content contribution
- WR-07 closed: `.calendar-week-total__distance`'s 380px override is now `font-size: 14px` alone (dropped `line-height: 1.5` and the no-op `font-weight: 600`)
- New `atRuleBodiesFor` helper in `styles.test.ts` turns five previously existence-only override guards into value assertions; the `.calendar-grid` case that previously asserted the track list is NEVER overridden (the assertion `22-VERIFICATION.md` named as locking Round 2's failing shape in place) is inverted to a `.toThrow(/redeclares "grid-template-columns"/)` pairing that also reads the override's value
- 9 new test cases assert every BL-01/BL-02/WR-07/WR-06/GC-4 380px declaration by value; the pre-existing 15-case and 8-case Phase 22 describes are unmodified in count

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix BL-01 and BL-02 together in the 380px block, add the two overflow-wrap floors, and close WR-07** - `f5442ae` (fix)
2. **Task 2: Add the atRuleBodiesFor value-reading helper, invert the assertion that locked the failing shape, and guard every 380px override by value** - `0266e3d` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `src/dashboard/styles.css` - Rewrote the calendar `@media (max-width: 380px)` block (8 rules, up from 5) to fix BL-01/BL-02, add two `overflow-wrap: anywhere` floors, and close WR-07; expanded the DISC-6b comment with R13/GC-4/BL-01/BL-02/WR-07 tokens while retaining every Round 1/2 token
- `src/dashboard/styles.test.ts` - Added `atRuleBodiesFor(needle, property, source?)`, inverted the `.calendar-grid` case in the 22-06 describe, and appended a 9-case `styles.css — Phase 22 gap closure round 3 (22-09)` describe

## Decisions Made

- BL-01 and BL-02 landed in the same task/commit with their test coverage — splitting them across plans is what 22-REVIEW.md explicitly forbade, since verifying either alone reproduces another ambiguous R13-style result
- Kept the padding rule as the block's first nested rule byte-identical (WR-03/WR-06 unguardable-position convention), and added a new WR-06 test case (case 8 of the round 3 describe) that turns the prose convention into an enforced assertion
- Did not fix WR-05 (the 8px header/value padding offset) — out of scope per the plan, Round 2 row R17 already read the current alignment as correct

## Deviations from Plan

None - plan executed exactly as written. Every task's automated verification script and acceptance criteria passed without needing a workaround; the one iteration required (reformatting a multi-line `toThrow()` call onto one line so the plan's own regex-based verification script could match it) was a mechanical formatting adjustment within Task 2's own action, not a deviation from what the plan specified.

## Issues Encountered

- `npm test` reports 5 pre-existing, out-of-scope test file failures (`ENOENT: no such file or directory, open 'data/stats/*.json'`) in `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`, and two others — these read live pipeline-generated JSON from `data/stats/`, a directory that is not git-tracked (confirmed via `git ls-tree`) and simply does not exist in this worktree checkout. Zero overlap with this plan's `files_modified` scope (`src/dashboard/styles.css`, `src/dashboard/styles.test.ts`). Not fixed, per the scope-boundary rule (pre-existing failures in unrelated files are out of scope) — logging here rather than in a separate `deferred-items.md` since it is an environment/data-availability condition of this worktree, not a code defect. `npx vitest run src/dashboard/styles.test.ts` (this plan's own scope) passed 125/125; `npx tsc --noEmit -p tsconfig.json` and `npm run build-widgets` both exited 0 with zero `css-syntax-error`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- This plan discharges no visual claim, per its own `<verification>` section — whether the ~380px overflow is actually gone is settled only by plan `22-12`'s Round 3 row R19, observed by the developer's own eyes with no waiver
- `CAL-02` is deliberately NOT ticked by this plan (per its success criteria) — it stays gated on R19
- `calendar.ts` was not touched (plan `22-10` owns it this round, per this plan's explicit non-scope) — no file-boundary conflict with the parallel wave agent
- The `.splits-scroll` scroll-wrapper fallback remains documented and unimplemented, ready if R19 fails a third time

## Known Stubs

None.

---
*Phase: 22-calendar-week-start-totals*
*Completed: 2026-08-18*
