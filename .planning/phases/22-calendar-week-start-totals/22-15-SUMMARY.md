---
phase: 22-calendar-week-start-totals
plan: 15
subsystem: ui
tags: [css, media-queries, vitest, responsive, calendar]

# Dependency graph
requires:
  - phase: 22-calendar-week-start-totals
    provides: "plan 22-09's calendar overflow compaction block (BL-01/BL-02 fixes, GC-4 no-overflow invariant, WR-06 padding-first convention), scoped to 380px"
provides:
  - "the calendar's overflow compaction now governs 0-640px inclusive instead of 0-380px, closing the ~381-530px overflow band that contained the three most common real phone widths (390/393/412px)"
  - "a parsed-breakpoint breadth guard (GC-7a, >= 530px) in styles.test.ts that fails if a future edit re-narrows the compaction breakpoint"
affects: ["22-16 (Round 4 human checkpoint rows R25/R26)"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["breakpoint-parsing test guard: parse the numeric max-width out of an at-rule's own prelude rather than hard-coding it, so the assertion tracks what the stylesheet actually ships"]

key-files:
  created: []
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts
    - .planning/phases/22-calendar-week-start-totals/deferred-items.md

key-decisions:
  - "Single raised breakpoint (380px -> 640px) chosen over 22-REVIEW.md CR-02's alternative fix shape (reducing .view padding), per the plan's explicit scope exclusion — .view padding is shared by all five screens and the 640px cutoff already clears CR-02's ~530px edge with ~110px headroom"
  - "Rationale comment rewritten from 71 lines of round-history narrative to a <=30-line comment describing the stylesheet as it now stands (IN-06 concern from 22-REVIEW.md)"

patterns-established:
  - "Parsed-breakpoint breadth guard: GC-7a captures the numeric max-width from the compaction block's own @media prelude and asserts it is >= the arithmetic-derived overflow-band edge, so narrowing the breakpoint back in a future edit is a red test, not a silent regression"

requirements-completed: [CAL-02]

# Metrics
duration: ~20min
completed: 2026-08-19
---

# Phase 22 Plan 15: Widen calendar overflow compaction from 380px to 640px Summary

**Raised the calendar day-cell/week-total overflow compaction's `@media` breakpoint from `max-width: 380px` to `max-width: 640px` (zero declaration changes) and added a parsed-breakpoint `>= 530px` non-vacuity guard in `styles.test.ts` so the fix's coverage BAND, not merely its existence, is test-enforced.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 2 source files + 1 deferred-items.md doc update

## Accomplishments

- Closed `22-VERIFICATION.md` Gap 1 (CAL-02/SC3, reopened) and `22-REVIEW.md` CR-02: the compaction that fixes day-cell and week-total overflow now covers the entire computed overflow band (~381-530px) instead of only the single 375px width R19 observed, bringing 390px (iPhone 12-15), 393px (iPhone 15/16 Pro), and 412px (Pixel) inside coverage for the first time in the phase.
- Every declaration inside the compaction block is byte-identical to what plan 22-09 shipped — only the `@media` prelude's numeric value moved.
- Added GC-7a, the breadth guard that Round 3 lacked: a test parses the breakpoint out of the block's own prelude and fails if it drops below 530px. Proved non-vacuous by mutating the breakpoint back to 380px mid-verification and confirming `styles.test.ts` goes red before restoring the file.
- D-10's default-breakpoint eight-column contract, GC-4's no-`overflow`-property invariant, and WR-06's padding-rule-first convention all re-verified intact.

## Task Commits

Each task was committed atomically:

1. **Task 1: Raise the calendar compaction block's prelude to 640px and rewrite its rationale comment** - `f1a69cb` (fix)
2. **Task 2: Re-point styles.test.ts breakpoint assertions and add the GC-7 breadth guard** - `03cf66d` (test)

**Supplementary:** `a567999` (docs: log pre-existing `data/stats/`-dependent test failures as out of scope, per the executor's scope-boundary rule)

## Files Created/Modified

- `src/dashboard/styles.css` - Calendar compaction block's `@media` prelude moved from `(max-width: 380px)` to `(max-width: 640px)`; 71-line round-history rationale comment replaced with a 30-line comment describing the current coverage band, arithmetic, and invariants.
- `src/dashboard/styles.test.ts` - `calendar380Block()` renamed to `calendarCompactionBlock()` and re-needled to 640px; IN-06 block count assertion updated `toHaveLength(3)` → `toHaveLength(2)` with an added no-`.calendar-` check on both remaining 380px blocks; every `it()`/`describe()` title in the two Phase 22 describes retitled from "380px" to "<=640px" with no assertion body changed; new `Phase 22 gap closure round 4 (22-15): GC-7` describe added with GC-7a (breadth guard, `>= 530px`), GC-7b (390/393/412px named phone widths), GC-7c (no calendar rule left at 380px), GC-7d (D-10 survives at desktop).
- `.planning/phases/22-calendar-week-start-totals/deferred-items.md` - Logged a re-confirmation of the pre-existing `data/stats/`-dependent test failures (5 suites, same root cause first documented at plan 22-10) as out of this plan's scope.

## Decisions Made

- Implemented CR-02's first suggested fix shape (single raised breakpoint) rather than the second (reduce `.view` padding), matching the plan's explicit scope exclusion.
- Condensed the rationale comment to concrete, current-state facts (coverage band, arithmetic, named device widths, WR-06 convention, remaining-block count) rather than round-by-round narrative, per `22-REVIEW.md` IN-06.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' automated verify commands passed on the first attempt after the comment-length trim described below (not a deviation from the plan's instructions, just an iteration to fit the stated 30-line cap).

## Issues Encountered

- The first draft of the rewritten rationale comment ran to 32 lines against the plan's own `<=30 lines` acceptance criterion. Trimmed wording (merged two short paragraphs, shortened a parenthetical) to land at exactly 30 lines without dropping any of the six required content points (coverage band + arithmetic, breakpoint-move-not-new-declarations rationale, `anywhere` vs `break-word`, no-overflow-property rationale, WR-06 convention, remaining-380px-block count).
- `npx vitest run src/dashboard` (the plan's stated "fully green" verification target) surfaces 5 pre-existing failures unrelated to this plan's files (`records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`), all failing at import time on a missing `data/stats/` directory that this fresh worktree checkout never generates. This is the identical, already-documented condition from plans 22-10/22-11 (gitignored, pipeline-generated, requires `npm run compute-all-stats` against the committed archive). Confirmed no new failures: 807 passed / 0 newly failing across the 25 suites that do not depend on `data/stats/`, and `src/dashboard/styles.test.ts` itself is 129/129 green. Logged in `deferred-items.md` per the executor's scope-boundary rule rather than fixed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `styles.css`/`styles.test.ts` are ready for plan 22-16's Round 4 human checkpoint, which stages non-waivable rows R25 (a stated 390/393/412px phone-width observation) and R26 (a stated ~600px observation) — both widths this plan's automated gates cannot render or observe (`vitest.config.ts` is `environment: 'node'`, no jsdom/headless browser in this repo).
- `git status --porcelain` (checked immediately after both tasks' non-vacuity mutation gates restored `styles.css`) showed only this plan's own files at each check point — no stray mutation residue.
- `npm run build-widgets` exits 0 with zero `css-syntax-error` occurrences.

---
*Phase: 22-calendar-week-start-totals*
*Completed: 2026-08-19*
