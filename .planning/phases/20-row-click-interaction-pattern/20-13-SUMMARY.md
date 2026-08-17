---
phase: 20-row-click-interaction-pattern
plan: 13
subsystem: ui
tags: [typescript, vitest, dom-events, row-navigation, tdd]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    provides: "D-12's shouldNavigateOnRowClick pure predicate and RowClickContext (plan 20-09), which this plan extends"
provides:
  - "RowClickContext.clickCount field sourced from MouseEvent.detail"
  - "shouldNavigateOnRowClick's fifth refusal class, clickCount > 1, closing 20-REVIEW.md's WR-05"
  - "Unit coverage proving the double-click first-click refusal and the WR-05 blind spot (hasTextSelection alone cannot see it)"
affects: ["20-row-click-interaction-pattern gap-closure round 4 (remaining plans 20-12, 20-14..20-18)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MouseEvent.detail as a click-repeat counter fed into a pure, node-testable predicate rather than a second dblclick listener or a setTimeout debounce"

key-files:
  created: []
  modified:
    - src/dashboard/row-navigation.ts
    - src/dashboard/row-navigation.test.ts

key-decisions:
  - "D-14 implemented exactly as locked in 20-CONTEXT.md: one field, one refusal class appended fifth after hasTextSelection, closest('a') stays first, D-12's auxclick disposition untouched."

patterns-established:
  - "Source-text wiring assertions in row-navigation.test.ts explicitly document what they cannot prove (WR-09): a field fed from the wrong event property is invisible to a substring check; that gap is closed only by a human browser checkpoint, named explicitly rather than implied."

requirements-completed: [UX-01, UX-03]

# Metrics
duration: ~15min
completed: 2026-08-17
---

# Phase 20 Plan 13: Refuse navigation on a double-click's first click (D-14) Summary

**RowClickContext gains a `clickCount` field fed from `MouseEvent.detail`, and `shouldNavigateOnRowClick` refuses navigation whenever `clickCount > 1`, so the first click of a double-click on a Records PR-table cell completes a word-select instead of navigating away.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-17T20:31:44Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Closed `20-REVIEW.md`'s WR-05: the browser's `click`(detail 1) → `click`(detail 2) → `dblclick` sequence no longer navigates away on the first click, before the word selection exists.
- Extended the pure, `environment: 'node'`-testable predicate (D-12) with a fifth refusal class rather than adding a `dblclick` listener or a `setTimeout` debounce — kept the whole click decision unit-testable.
- Proved the exact WR-05 blind spot: `clickCount: 2` with `hasTextSelection: false` (the real first-click state) is refused, demonstrating `hasTextSelection` alone cannot cover this case.
- Pinned the wiring as far as a source-text assertion honestly can, and recorded — rather than implied — the residual gap (WR-09): a field fed from the wrong event property is invisible to these assertions; the Round 4 human checkpoint is the real evidence.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend the predicate suite with the double-click cases and prove them RED** - `695b083` (test)
2. **Task 2: Add the fifth refusal class to the predicate and feed it from event.detail** - `57a7f9b` (feat)
3. **Task 3: Pin the wiring so the new field cannot be fed from anything but the event** - `57feb44` (test)

**Plan metadata:** committed together with this SUMMARY.md (worktree mode — orchestrator commits STATE.md/ROADMAP.md separately after merge).

## Files Created/Modified
- `src/dashboard/row-navigation.ts` - `RowClickContext.clickCount: number` (docs: `MouseEvent.detail`); `shouldNavigateOnRowClick`'s fifth early return `if (context.clickCount > 1) return false;`, placed after `hasTextSelection` and before the final `return true`; `attachRowNavigation` now feeds `clickCount: event.detail`; new D-14 module-header paragraph.
- `src/dashboard/row-navigation.test.ts` - `plainPrimaryClick()` gains `clickCount: 1`; four new cases in the D-12/D-14 describe block (clickCount 2 refused, clickCount 3 refused, clickCount 1 still navigates, WR-05 blind-spot proof); `{ clickCount: 2 }` added to `singleFieldVariants`; wiring block extended with an `event.detail` assertion, a `clickCount`-occurs-exactly-three-times assertion, and a zero-`dblclick`/zero-`setTimeout` assertion, plus a WR-09 honesty comment above the block.

## Decisions Made
- Followed D-14 exactly as locked in `20-CONTEXT.md` — no re-litigation. `clickCount > 1` (not `=== 2`) so a triple-click is refused by the same rule as a double-click.
- Did not add `happy-dom` or any DOM library to close the WR-09 gap (fed-from-wrong-property blind spot) — out of this round's scope per the plan's own threat register (T-20G4-P13-03, disposition `accept`).

## Deviations from Plan

None - plan executed exactly as written. One minor internal-consistency note (not a deviation, not fixed): the plan's `<verification>` section states the final vitest run has "25 cases," but Task 3's own action explicitly adds two more wiring cases (the `clickCount`-count assertion and the `dblclick`/`setTimeout` assertion) on top of Task 2's 25, so the actual final count is 27. This is a wording artifact in the plan's summary verification prose, not a functional gap — every task's own `<acceptance_criteria>` was satisfied exactly as specified, and the final `npx vitest run src/dashboard/row-navigation.test.ts` exits 0 with all 27 cases passing.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Verbatim RED-state output (Task 1)

`npx tsc --noEmit -p tsconfig.json`:
```
src/dashboard/row-navigation.test.ts(77,5): error TS2353: Object literal may only specify known properties, and 'clickCount' does not exist in type 'RowClickContext'.
src/dashboard/row-navigation.test.ts(142,58): error TS2353: Object literal may only specify known properties, and 'clickCount' does not exist in type 'RowClickContext'.
src/dashboard/row-navigation.test.ts(148,58): error TS2353: Object literal may only specify known properties, and 'clickCount' does not exist in type 'RowClickContext'.
src/dashboard/row-navigation.test.ts(154,58): error TS2353: Object literal may only specify known properties, and 'clickCount' does not exist in type 'RowClickContext'.
src/dashboard/row-navigation.test.ts(168,9): error TS2353: Object literal may only specify known properties, and 'clickCount' does not exist in type 'RowClickContext'.
src/dashboard/row-navigation.test.ts(185,9): error TS2353: Object literal may only specify known properties, and 'clickCount' does not exist in type 'Partial<RowClickContext>'.
```

`npx vitest run src/dashboard/row-navigation.test.ts`: 4 failed / 21 passed (25) — the three new cases plus the extended `anti-over-blocking` variant all failed with `expected true to be false`, because `RowClickContext` (pre-Task-2) had no `clickCount` field so the extra property was silently ignored at runtime and every context still evaluated as a plain primary click.

`git status --porcelain src/dashboard/row-navigation.ts` was empty, confirming Task 1 touched no production source.

## Next Phase Readiness
- D-14 is fully implemented and unit-tested; `src/dashboard/row-navigation.ts` and its test file are internally consistent and `git diff --stat src/` against the plan's base commit shows only these two files changed.
- The residual WR-09 gap (source-text assertions cannot see a field fed from the wrong event property) is explicitly named in the wiring block's comment; real closure is the Round 4 human checkpoint's double-click row on a Records PR-table cell, not further test-file work.
- No blockers for the remaining gap-closure round 4 plans (20-12, 20-14..20-18).

---
*Phase: 20-row-click-interaction-pattern*
*Completed: 2026-08-17*
