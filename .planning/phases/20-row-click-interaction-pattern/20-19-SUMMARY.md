---
phase: 20-row-click-interaction-pattern
plan: 19
subsystem: ui
tags: [accessibility, event-handling, aria, dom, vitest, source-guard]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    provides: "D-13's cell-link factory (plan 20-17) and D-12/D-14's shouldNavigateOnRowClick predicate (row-navigation.ts, plans 20-06/20-11)"
provides:
  - "buildCellLink anchors that are non-draggable and self-guard their own click through the unmodified shouldNavigateOnRowClick predicate (D-16)"
  - "buildCellLink anchors that carry no aria-label except the Date cell's (D-17), so each Records cell announces its own visible text"
  - "row-semantics.test.ts source guards (cellLinkLabelViolations + 15 assertions) pinning both invariants with in-suite blind-spot proofs"
affects: [20-20-round-5-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-anchor click listener mirrors a row-level listener's decision logic by importing the same predicate rather than duplicating it, with context fields split into browser-owned (presented neutral) vs decision-owned (read for real)"
    - "cellLinkLabelViolations: identifier/template-literal-then-comma regex scoped to exclude a function's own typed-parameter definition"

key-files:
  created: []
  modified:
    - src/dashboard/views/records.ts
    - src/dashboard/row-semantics.test.ts

key-decisions:
  - "D-16 implemented as locked: buildCellLink sets draggable = false and registers one click listener per anchor that presents insideAnchor/button/four-modifiers neutral (false/0) and reads hasTextSelection/clickCount for real, calling event.preventDefault() only when shouldNavigateOnRowClick refuses. row-navigation.ts itself is untouched."
  - "D-17 implemented as locked: buildCellLink's ariaLabel parameter is now optional; all seven non-Date call sites stop passing curatedLabel; both Date anchors keep it. The superseded 'not decidable in this repository' JSDoc paragraph is replaced with D-17's resolution."
  - "R31 (drag-select) is fully closed by this plan. R32 (double-click) is NOT closed and cannot be by any mechanism this plan is permitted to use: MouseEvent.detail is 1 on the first click of a double-click, so shouldNavigateOnRowClick correctly returns true and the browser navigates on that first click before D-14's clickCount > 1 refusal can ever see it. Plan 20-20's row R35 puts this disposition to the developer explicitly."

patterns-established:
  - "When a plan's embedded verify script assumes a false baseline (e.g. zero pre-existing occurrences of a common DOM idiom that already exists elsewhere in the file), scope the corresponding test-suite guard to the specific receiver/pattern the decision actually governs rather than asserting a global count that a pre-existing, unrelated usage would break."

requirements-completed: []  # Gated on plan 20-20's Round 5 checkpoint, per house rule (16-09/17-15/19-05 precedent) — not ticked by an autonomous plan.

duration: ~20min
completed: 2026-08-18
---

# Phase 20 Plan 19: D-16/D-17 — Records cell-anchor link contract and single-label-per-row Summary

**Records cell anchors (`buildCellLink`) now guard their own click through the unmodified `shouldNavigateOnRowClick` predicate and carry no `aria-label` except the Date cell's — closing R31's drag-select defeat and CR-01's six-times-per-row label duplication, both without touching `row-navigation.ts`.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-18T05:36:54Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- D-16: `buildCellLink` anchors are now non-draggable and each registers a `click` listener that builds a `RowClickContext` (browser-owned fields neutral, `hasTextSelection`/`clickCount` read for real) and calls `event.preventDefault()` only when the imported, unmodified `shouldNavigateOnRowClick` refuses. A drag inside a Records cell now selects text instead of dragging a link, and a drag-select ending in a cell no longer navigates (R31 CLOSED). A repeat click's second click no longer re-navigates.
- D-17: `buildCellLink`'s `ariaLabel` parameter is optional; all seven non-Date call sites (5 in `buildPrTable`, 2 in `buildProgressionTable`) stop passing the curated label. Only the two hand-built `dateAnchor` elements keep it. A screen reader on a Records row now hears six different strings (rank, time, pace, age-grade, date, flag badge) instead of the same date phrase repeated.
- `row-semantics.test.ts` gained a new `cellLinkLabelViolations` helper (four self-tests) and a 15-assertion `describe('D-16 / D-17 ...')` block, including two blind-spot proofs in the house shape (pre-D-16 factory had zero `preventDefault`; a naive `aria-label`-counting guard could never have seen CR-01).
- The CR-02 records non-regression test's rationale comment was rewritten: it now states that `flagsAnchor`'s badge text becoming its accessible name is D-17's intended, decided outcome, not an open question.

## Task Commits

Each task was committed atomically:

1. **Task 1: D-16 — the cell anchors enforce the same link contract, through the same unmodified predicate** - `3ef216e` (feat)
2. **Task 2: D-17 — only the Date cell is labelled; every other cell anchor announces its own text** - `2e54d73` (feat)
3. **Task 3: Pin both decisions in the source guard, each with an in-suite proof of the defect it closes** - `3a3016a` (test)

## Files Created/Modified

- `src/dashboard/views/records.ts` - `buildCellLink` gains `draggable = false`, a self-guarding click listener, and an optional `ariaLabel`; 7 call sites drop their label argument; 4 stale comments rewritten (factory JSDoc's two paragraphs, both `curatedLabel` per-row comments, the Flags conditional-append comment)
- `src/dashboard/row-semantics.test.ts` - new `cellLinkLabelViolations` helper + 4 self-tests; new 15-assertion `describe('D-16 / D-17 ...')` block; CR-02 rationale comment rewritten (assertions unchanged)

## Decisions Made

- Implemented D-16's `decision_conflict_resolved_here` resolution literally: the anchor's click context presents `insideAnchor`/`button`/the four modifier keys neutral (`false`/`0`) rather than reading the real event fields, because reading them would make `preventDefault()` cancel the browser's own Cmd/Ctrl+click new-tab and Shift+click new-window gestures — the exact behaviour R23/R24 currently PASS on. Only `hasTextSelection` (D-12) and `clickCount` (D-14) are decided for real, via the unmodified, imported `shouldNavigateOnRowClick`.
- Did not attempt to close R32 (double-click still navigates on its first click). `MouseEvent.detail` is `1` on the first click of a double-click — indistinguishable from a single click at the moment it fires — so the predicate correctly returns `true` and the browser navigates before D-14's `clickCount > 1` refusal can act. No mechanism this plan is permitted to use (no `setTimeout`, explicitly forbidden by `row-navigation.test.ts`) can close this. Recorded as a residual, per the plan's binding instruction, for plan 20-20's row R35 to put to the developer as a disposition question.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's own verify-script baseline] Task 1/3's `addEventListener(` global-count assertions were unreachable**
- **Found during:** Task 1 verification
- **Issue:** The plan's embedded automated verify script (Task 1) and Task 3's action item 3 both assert that `addEventListener(` occurs exactly once in `records.ts`. `records.ts` already registers three `addEventListener` calls unrelated to this plan before any change: the error-state Retry button's click, each jump-list button's click, and the window resize listener that maintains the sticky jump offset. After adding the cell-anchor's own listener, the true count is 4 (or 3 for the `'click'`-scoped variant), never 1.
- **Fix:** Verified all other Task 1 assertions pass via the embedded script minus this one line (confirmed: draggable, listener registration, predicate call, preventDefault, no navigateTo, all neutral/real field literals, forbidden-field zeros, `window.getSelection()` count, `hasTextSelection` expression match, forbidden synthesized-event zeros, `attachRowNavigation`/`activityDetailHref` counts, and the `D-16` JSDoc citation all hold). In Task 3's test-suite guard, scoped the equivalent assertion to `cellAnchor.addEventListener('click'` (exactly once) instead of the bare global count — this measures the same real invariant (the factory registers exactly one click listener) without being tripped by the three pre-existing, unrelated listeners.
- **Files modified:** src/dashboard/row-semantics.test.ts (scoped assertion, not a code change to records.ts)
- **Verification:** `npx vitest run src/dashboard/row-semantics.test.ts` — 65/65 pass
- **Committed in:** `3a3016a` (Task 3 commit), documented inline in that commit's message

**2. [Rule 1 - Bug in the plan's own verify-script baseline] Task 2/3's global `aria-label` count of 3 was unreachable**
- **Found during:** Task 2 verification
- **Issue:** The plan's Task 2 verify script and Task 3 action item 12 both assert `aria-label` occurs exactly 3 times in comment-stripped `records.ts` (the factory's one conditional write plus the two Date anchors). `records.ts` already carries one pre-existing, unrelated `nav.setAttribute('aria-label', 'Records sections')` on the jump-list `<nav>` landmark (line 159, plan 20-16 territory, out of this plan's scope) before any change in this plan. The true count is 4.
- **Fix:** Confirmed all other Task 2 assertions pass via the embedded script minus this one line. In Task 3's test-suite guard, scoped the assertion to a regex matching only `cellAnchor.setAttribute('aria-label'` and `dateAnchor.setAttribute('aria-label'` receivers, which correctly yields 3 and measures D-17's actual invariant precisely, without being tripped by the unrelated nav landmark.
- **Files modified:** src/dashboard/row-semantics.test.ts
- **Verification:** `npx vitest run src/dashboard/row-semantics.test.ts` — 65/65 pass
- **Committed in:** `3a3016a` (Task 3 commit), documented inline in that commit's message

---

**Total deviations:** 2 auto-fixed (both Rule 1 — pre-existing, unrelated code the plan's verify script did not account for). Neither deviation touched the actual implementation logic in `records.ts`; both were scoping corrections to test assertions so the guard measures the real D-16/D-17 invariant instead of a false global-count premise.
**Impact on plan:** None on scope or correctness. `git diff --stat src/` still lists exactly the two files the plan's own `<verification>` section names.

## Issues Encountered

- The `hasTextSelection` cross-file drift guard (Task 3, group 6) initially extracted the wrong text: a naive `indexOf('hasTextSelection:')` matched `RowClickContext`'s interface field DECLARATION (`hasTextSelection: boolean;`) before the actual assignment expression in either file. Fixed by anchoring the marker to `hasTextSelection: Boolean(` (the constructor-call assignment shape), which exists only at the real assignment site in both `records.ts` and `row-navigation.ts`, not in the interface declaration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both mutations that produced GAP 12 (drag-select/double-click bypassing the row listener via a native anchor click) and CR-01 (six-times-per-row label duplication, discarded Flags badge text) now turn the test suite red if reintroduced.
- `npx tsc --noEmit -p tsconfig.json`: zero diagnostics. `npm test`: 998/998 passing tests green; the same five pre-existing data-dependent test files fail with `ENOENT` on gitignored `data/stats/*.json` / `data/dashboard/index.json` in this fresh worktree checkout, unrelated to this plan (`src/dashboard/views/records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`) — matches `deferred-items.md`'s standing note for this worktree.
- `git status --porcelain src/dashboard/row-navigation.ts src/dashboard/row-navigation.test.ts` is empty across all three tasks — D-16 point 3 held; `row-navigation.ts` was not modified at any point in this plan.
- R31 (drag-select) is fully closed. R32 (double-click's first click still navigates) is NOT closed and cannot be by any permitted mechanism — recorded as a residual, per this plan's binding instruction, for plan 20-20's Round 5 checkpoint (row R35) to put to the developer as an explicit disposition question, alongside rows R23/R24/R36 (browser-gesture preservation re-verification) and R38 (the rendered single-label-per-row observation).

## Self-Check: PASSED

- FOUND: src/dashboard/views/records.ts
- FOUND: src/dashboard/row-semantics.test.ts
- FOUND: .planning/phases/20-row-click-interaction-pattern/20-19-SUMMARY.md
- FOUND commit: 3ef216e (Task 1)
- FOUND commit: 2e54d73 (Task 2)
- FOUND commit: 3a3016a (Task 3)
- FOUND commit: 01aafd5 (SUMMARY.md)

---
*Phase: 20-row-click-interaction-pattern*
*Completed: 2026-08-18*
