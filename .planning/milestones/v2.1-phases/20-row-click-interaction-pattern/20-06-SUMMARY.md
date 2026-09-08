---
phase: 20-row-click-interaction-pattern
plan: 06
subsystem: ui
tags: [vitest, tdd, focus-management, accessibility, dashboard]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    provides: "D-01/D-07's two row shapes (renderActivityRow card <a>, buildTableRow <tr>) from plan 20-02, and the Phase 17 D-08 return-focus contract from list.ts"
provides:
  - "highlightAndFocus branches on el.tagName === 'A' to resolve the correct focus target for both row shapes"
  - "A node-environment regression test (list.test.ts) proven RED before the fix and GREEN after it, covering card, table, neither-shape and undefined inputs"
affects: [20-07, 20-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stub-element DOM testing under vitest environment:node (plain objects cast as unknown as HTMLElement) as the sanctioned zero-dependency alternative to jsdom for behaviour assertions"
    - "tagName === 'A' string check in place of instanceof HTMLAnchorElement, required because HTMLAnchorElement is not a defined global under environment:node"

key-files:
  created: []
  modified:
    - src/dashboard/views/list.ts
    - src/dashboard/views/list.test.ts

key-decisions:
  - "Used el.tagName === 'A' instead of the review's proposed el instanceof HTMLAnchorElement, because HTMLAnchorElement is undefined under vitest's environment:node and instanceof would throw ReferenceError inside the very regression test meant to prove the fix"

patterns-established:
  - "Stub-element unit tests (plain objects recording method calls, cast through `as unknown as HTMLElement`) are this repository's sanctioned DOM-behaviour test mechanism where jsdom/happy-dom are unavailable and installs are out of scope"

requirements-completed: [UX-01]

# Metrics
duration: 5min
completed: 2026-08-13
---

# Phase 20 Plan 06: CR-01 Mobile Return-Focus Regression Summary

**Fixed `highlightAndFocus` to resolve the focus target correctly for both row shapes Phase 20 created (card `<a>` vs `<tr>` containing an anchor), closing the dead return-from-detail focus restoration on mobile, and locked it down with a test proven RED before the fix and GREEN after.**

## Performance

- **Duration:** ~5 min (commit timestamps 21:16:48 to 21:17:50)
- **Started:** 2026-08-13T21:13:12+02:00 (base commit)
- **Completed:** 2026-08-13T21:17:50+02:00
- **Tasks:** 2 completed
- **Files modified:** 2 (`src/dashboard/views/list.ts`, `src/dashboard/views/list.test.ts`)

## Accomplishments

- Exported `highlightAndFocus` and added a four-case regression test (card-shaped, table-shaped, neither-shape, undefined) that fails exactly on the card-shaped case against the unfixed implementation — proving the test covers the CR-01 defect before any fix was applied.
- Fixed `highlightAndFocus` to branch on `el.tagName === 'A'`: when the row element IS the anchor (mobile card, `renderActivityRow`), it focuses itself; when the row CONTAINS an anchor (`<tr>`, `buildTableRow`), it still delegates to `querySelector('a')` exactly as before.
- Below the 720px breakpoint, returning from an activity detail view to `#/list` now moves keyboard focus onto the restored card row itself, matching Phase 17 D-08's contract. Above 720px, the `<tr>` branch is unchanged and still hands focus to its Activity-cell anchor.
- Documented the deliberate `tagName === 'A'` vs `instanceof HTMLAnchorElement` deviation from `20-REVIEW.md`'s proposed patch directly in the function's JSDoc, with the reasoning (no `HTMLAnchorElement` global under vitest's `environment: 'node'`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Export highlightAndFocus and add the CR-01 regression test — RED** - `3e60456` (test)
2. **Task 2: Resolve the focus target for both row shapes — GREEN** - `db9fb4b` (fix)

**Plan metadata:** committed alongside this summary (worktree mode — orchestrator handles the shared-file metadata commit after merge).

## Files Created/Modified

- `src/dashboard/views/list.ts` - `highlightAndFocus` exported, JSDoc added recording the CR-01 defect/fix/deviation, body now branches on `el.tagName === 'A'` before falling back to `el.querySelector('a')`
- `src/dashboard/views/list.test.ts` - New `describe('highlightAndFocus — CR-01 / Phase 17 D-08 return-from-detail focus restoration')` block with a `buildStubRow` helper and four `it` cases

## Decisions Made

- **`tagName === 'A'` over `instanceof HTMLAnchorElement`** — the plan's own `<interfaces>` section flagged this in advance: `vitest.config.ts` runs `environment: 'node'`, which has no `HTMLAnchorElement` global, so the review's literal proposed patch would throw `ReferenceError` inside the regression test it's meant to be verified by. `tagName` is uppercase (`'A'`) for HTML elements in an HTML document, so the two forms select the same elements here. Recorded in the code's JSDoc as the plan required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 2's automated `tabindex` verification regex was overbroad and had to be bypassed manually, not fixed**

- **Found during:** Task 2 verification
- **Issue:** The plan's `<verify><automated>` script for Task 2 includes `if(/tabindex/i.test(s)) throw new Error('D-01 violated: tabindex introduced')` run against the comment-and-string-stripped source of `list.ts`. This is case-insensitive and matches the codebase's own pre-existing, unrelated `heading.tabIndex = -1` (line ~1173, `noteViewedActivity`/heading-focus code untouched by this plan) plus two pre-existing prose comments discussing `tabindex` (lines 348, 352, part of a different function's docstring). Both predate this plan (confirmed present at base commit `c5f8e75` via `git show c5f8e75:src/dashboard/views/list.ts`), so the script fails regardless of any change this plan makes.
- **Fix:** No code change was needed or made — `git diff src/dashboard/views/list.ts | grep -i tabindex` returns nothing, confirming this task introduced zero `tabindex` occurrences. Ran the remainder of the Task 2 verification script with only that one regex line removed, and separately confirmed the plan's actual D-01 gate (`row-semantics.test.ts`, which asserts zero occurrences in the correct semantic sense, not a raw case-insensitive substring match) passes at 16/16.
- **Files modified:** None — this is a verification-script observation, not a code fix.
- **Verification:** `git diff src/dashboard/views/list.ts | grep -i tabindex` → no match. `npx vitest run src/dashboard/views/list.test.ts src/dashboard/row-semantics.test.ts src/dashboard/row-navigation.test.ts src/dashboard/styles.test.ts` → 117/117 passing.
- **Committed in:** N/A (no code change; documented here per Rule 1's "shared process" — investigate, confirm no defect, continue).

---

**Total deviations:** 1 (verification-script false positive investigated and bypassed; zero code impact)
**Impact on plan:** None on shipped code. All substantive acceptance criteria (tsc clean, the four-case test suite RED-then-GREEN, `tagName === 'A'` present, `querySelector(` path preserved for the `<tr>` branch, no `instanceof HTMLAnchorElement`, exactly 3 `highlightAndFocus(` occurrences, diff scope limited to the function body/JSDoc, full-suite result matching the five known data-dependent failures) were verified and pass.

## Issues Encountered

None beyond the verification-script false positive documented above.

## Test Evidence

**Task 1 (RED), `npx vitest run src/dashboard/views/list.test.ts`:**

```
❯ src/dashboard/views/list.test.ts (26 tests | 1 failed)
  × focuses the card row itself below the 720px breakpoint, where the mobile
    card IS the anchor (renderActivityRow) and has no descendant anchor to
    delegate to
    AssertionError: card-shaped row (tagName A, no descendant anchor):
    highlightAndFocus must focus the row itself, or Phase 17 D-08
    return-focus is dead on the mobile card layout below the 720px
    breakpoint: expected false to be true
  ✓ delegates focus to the descendant anchor for the table row shape (non-regression)
  ✓ does not throw when the row has neither shape
  ✓ does not throw when the element is undefined

Test Files  1 failed (1)
     Tests  1 failed | 25 passed (26)
```

**Task 2 (GREEN), targeted suite:**

```
✓ src/dashboard/row-semantics.test.ts (16 tests)
✓ src/dashboard/row-navigation.test.ts (7 tests)
✓ src/dashboard/styles.test.ts (68 tests)
✓ src/dashboard/views/list.test.ts (26 tests)

Test Files  4 passed (4)
     Tests  117 passed (117)
```

**Full suite (`npx vitest run`):** 882 passed, 5 test files failed — all five are the pre-existing data-dependent files named in `deferred-items.md` (`records-logic`, `trends-cadence-hr-logic`, `trends-gear-logic`, `trends-training-load-logic`, `trends-yoy-logic`), each failing on `ENOENT` for gitignored `data/**` fixtures in this fresh worktree, not on any assertion. No regression.

**TypeScript:** `npx tsc --noEmit -p tsconfig.json` exits 0 after both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CR-01 is closed at the source level and covered by an automated regression test. Plan 20-08's checkpoint rows R13/R14 still own the real-browser confirmation that focus visibly lands correctly — this plan's `<verification>` section explicitly scopes that out ("Nothing here proves focus lands correctly in a real browser").
- `applyReturnHighlight`, `renderActivityRow`, `buildTableRow` and `appendStatusBadges` were left untouched per the plan's constraints, keeping the diff disjoint from plan 20-07's CR-02 work in the same file.
- No blockers for 20-07 or 20-08.

---
*Phase: 20-row-click-interaction-pattern*
*Completed: 2026-08-13*

## Self-Check: PASSED

- FOUND: src/dashboard/views/list.ts
- FOUND: src/dashboard/views/list.test.ts
- FOUND: .planning/phases/20-row-click-interaction-pattern/20-06-SUMMARY.md
- FOUND commit: 3e60456 (test)
- FOUND commit: db9fb4b (fix)
- FOUND commit: 6163cf7 (docs — summary)
