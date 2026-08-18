---
phase: 22-calendar-week-start-totals
plan: 06
subsystem: ui
tags: [css, media-query, calendar, vitest, gap-closure]

# Dependency graph
requires:
  - phase: 22-calendar-week-start-totals
    provides: "plan 22-02's calendar grid CSS (8-column contract, .calendar-week-total*, the DISC-6b 380px block) and plan 22-05's Round 1 checkpoint (22-VALIDATION.md), which recorded row R11 FAIL"
provides:
  - "Deeper 380px compaction: .calendar-day min-width: 0, .calendar-day__distance 20px→14px, .calendar-week-total__time/__count 14px→12px, on top of the already-shipped padding and __distance compaction"
  - "A corrected DISC-6b/IN-06 comment naming GC-1, IN-06, WR-03 and R11 literally, keeping splits-scroll as the documented-but-unimplemented fallback"
  - "A .calendar-weekday--total { text-align: right } modifier applied alongside .calendar-weekday on the Total header cell (IN-05)"
  - "8 new override-aware CSS guard cases in styles.test.ts, each pairing a positive claim with an assertNoAtRuleOverride(...).toThrow(/redeclares/) companion where the 380px block overrides it"
affects: ["22-07", "22-08"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Override-aware CSS test pairing: any assertion about a property the stylesheet overrides in an at-rule block must pair a positive claim (cascadeWinningBodyDeclaring/bodyForSelectorListToken) with assertNoAtRuleOverride(...).toThrow(/redeclares \"<property>\"/), never assert the base value in isolation"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts
    - src/dashboard/views/calendar.ts

key-decisions:
  - "GC-1: fixed the ~380px day-cell overflow by deepening type compaction inside the existing @media (max-width: 380px) block rather than building the DISC-6b .splits-scroll-style horizontal-scroll wrapper, because that wrapper's focusable content would scroll-jump on Tab in a grid full of focusable day buttons"
  - "IN-05: right-aligned the Total header via a .calendar-weekday--total modifier applied alongside .calendar-weekday, not instead of it, so the label matches .calendar-week-total's justify-items: end column"
  - "IN-06: declined to consolidate the file's three disjoint @media (max-width: 380px) blocks; reworded the DISC-6b comment instead, since merging would relocate two out-of-scope selectors and change their source-order cascade"
  - "WR-02 caveat honoured: every new assertion about an overridden property pairs with assertNoAtRuleOverride; the pre-existing false-green Phase 22 describe (15 cases) was left byte-identical, an automated check in Task 3 enforces this"

patterns-established:
  - "Gap-closure describe blocks are appended after the pre-existing phase's CSS describe, never edited in place, when a code-review finding (WR-02/WR-03) is explicitly out of scope for the round"

requirements-completed: []  # Plan explicitly does NOT tick CAL-02 (a visual overflow judgement, discharged only by 22-08's Round 2 human checkpoint) or CAL-03 (already Complete from 22-05, unaffected by this plan's IN-05 fix)

# Metrics
duration: ~25min
completed: 2026-08-18
---

# Phase 22 Plan 06: Deepen 380px Calendar Compaction & Fix Total Header Alignment Summary

**Deepened the calendar's 380px CSS compaction (day distance 20px→14px, week-total time/count 14px→12px, day min-width 32px→0) to answer Round 1's R11 overflow FAIL, right-aligned the Total header over its right-aligned column via a new `.calendar-weekday--total` modifier, and added 8 override-aware `styles.test.ts` guard cases pairing every new claim with an `assertNoAtRuleOverride` throw.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 completed
- **Files modified:** 3 (`src/dashboard/styles.css`, `src/dashboard/styles.test.ts`, `src/dashboard/views/calendar.ts`)

## Accomplishments

- The calendar's 380px `@media` block now compacts `.calendar-day__distance` (20px→14px) and `.calendar-week-total__time`/`__count` (14px→12px), and relaxes `.calendar-day`'s width floor to `min-width: 0` — the two widest contributors to the R11 overflow the phase's existing compaction had left untouched.
- The DISC-6b comment above that block now states, in prose, that the `.splits-scroll`-style scroll wrapper remains a documented, unbuilt fallback; that Round 1 row R11 FAILed and GC-1 chose deeper compaction over the wrapper; that this is one of three disjoint 380px blocks in the file (IN-06) which were deliberately not consolidated; and why the padding rule stays first in the block (WR-03).
- The `Total` header cell in `calendar.ts` now carries `'calendar-weekday calendar-weekday--total'`, and a new `.calendar-weekday--total { text-align: right }` rule overrides `.calendar-weekday`'s `text-align: center` base — closing IN-05 (the label was previously centred over a right-aligned column).
- A new `styles.css — Phase 22 gap closure (22-06)` describe block (8 cases) was appended after the untouched, byte-stable pre-existing `Phase 22 calendar week totals` describe (still exactly 15 cases). 7 of the 8 new cases call `assertNoAtRuleOverride`; 5 wrap it in `expect(() => ...).toThrow(/redeclares "..."/)`, honouring the WR-02 caveat that a positive claim about an overridden property must acknowledge the override, not assert the base value in isolation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Deepen the 380px compaction and correct its DISC-6b/IN-06 comment** - `1a1ab4d` (fix)
2. **Task 2: Right-align the Total header (IN-05) with a modifier applied alongside .calendar-weekday** - `09aa206` (fix)
3. **Task 3: Add an override-aware CSS guard block, leaving the pre-existing false-green Phase 22 block untouched** - `cea2fee` (test)

_Plan metadata commit (SUMMARY.md) is committed separately by this executor per worktree-mode protocol._

## Files Created/Modified

- `src/dashboard/styles.css` - Deepened the calendar 380px `@media` block (3 new declarations), rewrote the DISC-6b/IN-06 comment, added `.calendar-weekday--total`
- `src/dashboard/styles.test.ts` - Appended an 8-case override-aware gap-closure describe block after the untouched Phase 22 block
- `src/dashboard/views/calendar.ts` - Changed the Total header cell's `className` to `'calendar-weekday calendar-weekday--total'`

## Decisions Made

- GC-1/GC-1a-e, IN-05a, IN-06a: all pre-settled by the plan's `<settled_decisions>` table; implemented as specified, not reopened.
- No new decisions were made during execution — the plan's read-first instructions and settled-discretion table gave enough detail to implement each task without ambiguity.

## Deviations from Plan

**1. [Rule 3 - Blocking] Copied gitignored generated stats/dashboard data into the worktree to unblock `npm test`**
- **Found during:** Task 3's verification (`npm test`)
- **Issue:** 5 test files (`records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`) read live, gitignored generated JSON under `data/stats/` and `data/dashboard/` via `readFileSync`. This worktree was created fresh from a `git reset --hard` and never ran the stats-computation pipeline, so those gitignored directories didn't exist here, though they exist in the main repo checkout. This is a worktree-isolation artifact, not caused by any change in this plan — none of the five failing files are in this plan's scope.
- **Fix:** Copied `data/stats/` and `data/dashboard/` (both gitignored, untracked) from the main repo checkout (`/Users/pedf/workspace/strava-widgets/data/{stats,dashboard}`) into this worktree's filesystem. No tracked file was touched; `git status` remained clean of these paths before and after.
- **Files modified:** None tracked (gitignored data directories only).
- **Verification:** `npm test` went from 5 failed/46 passed test files to 51/51 passed, 1211/1211 tests (1203 baseline + 8 new gap-closure cases), matching the plan's acceptance criteria.
- **Committed in:** N/A — gitignored, nothing to commit.

**2. [Rule 1 - Bug] Fixed multi-line `toThrow(/regex/)` calls that broke Task 3's automated verify**
- **Found during:** Task 3's own automated verify script
- **Issue:** The first draft wrote `assertNoAtRuleOverride(...)).toThrow(\n  /redeclares "..."/,\n)` across three lines; the plan's verify script scans for the literal contiguous substring `toThrow(/redeclares`, which a line break inside the parens defeats, producing a false "expected at least 5 override-asserting toThrow(/redeclares/) pairings" failure even though the assertions themselves were semantically correct and passing under vitest.
- **Fix:** Collapsed all five `assertNoAtRuleOverride(...).toThrow(/redeclares "..."/);` calls to single lines.
- **Files modified:** `src/dashboard/styles.test.ts`
- **Verification:** Re-ran the plan's exact verify script; it now reports 8 cases, 7+ override companions, 5+ throw pairings, matching the acceptance criteria.
- **Committed in:** `cea2fee` (Task 3 commit — this was fixed before the task's single commit was made, not as a follow-up).

---

**Total deviations:** 2 auto-fixed (1 blocking/environment, 1 self-correction before commit)
**Impact on plan:** Neither affects the shipped CSS/TS behavior. The data-copy is a local, gitignored, worktree-only fix with no tracked-file footprint. The multi-line fix was caught and corrected within Task 3 before its commit, so the committed test file already reflects the single-line form. No scope creep.

## Issues Encountered

None beyond the two items documented above under Deviations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The 380px CSS fix and the IN-05 header alignment are ready for plan 22-08's Round 2 human browser checkpoint, which is the only mechanism that can discharge the visual overflow judgement CAL-02 is gated on (per PROJECT.md's rule that automated CSS assertions cannot substitute for a rendered-browser check).
- CAL-02 remains `Pending` in REQUIREMENTS.md, exactly as this plan's objective specifies — this plan produces the CSS the checkpoint will observe, it does not tick the requirement itself.
- CAL-03 is unaffected (already Complete from plan 22-05); the IN-05 fix is cosmetic and does not reopen it.
- WR-02 and WR-03 (the pre-existing false-green Phase 22 CSS block and the unguardable first-nested-rule) remain open by design — this round did not fix them, only avoided tripping them and added an automated check (Task 3) confirming the untouched block still holds exactly 15 cases.
- WR-04 (exact-count source guards in `calendar.test.ts`) remains open by design; this plan's Task 2 confirmed neither the `tabindex` nor `.focus()` whole-file counts moved off 2.

---
*Phase: 22-calendar-week-start-totals*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: `src/dashboard/styles.css`
- FOUND: `src/dashboard/styles.test.ts`
- FOUND: `src/dashboard/views/calendar.ts`
- FOUND: `1a1ab4d` (Task 1 commit)
- FOUND: `09aa206` (Task 2 commit)
- FOUND: `cea2fee` (Task 3 commit)
