---
phase: 20-row-click-interaction-pattern
plan: 01
subsystem: ui
tags: [typescript, vitest, dom-navigation, hash-router]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract
    provides: router.ts's navigateTo hash-navigation chokepoint
provides:
  - "Single shared row-navigation module (D-03): NAVIGABLE_ROW_CLASS, activityDetailPath, activityDetailHref, attachRowNavigation"
  - "Single definition of the #/activity/{id} URL shape, consumable by every view"
affects: [20-02, 20-03, 20-04, 20-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DOM-touching navigation helper module beside router.ts/nav.ts, deliberately not a *-logic.ts file (that convention is reserved for DOM-free pure modules)"
    - "Mutation-proving discipline for pure-function unit tests (temporarily break the function, confirm the assertion catches it, revert)"

key-files:
  created:
    - src/dashboard/row-navigation.ts
    - src/dashboard/row-navigation.test.ts
  modified: []

key-decisions:
  - "D-01/D-02/D-03 implemented exactly as specified in 20-CONTEXT.md: no tabindex, no role, no keydown listener; behavior extracted verbatim from list.ts's buildTableRow"
  - "activityDetailHref implemented in terms of activityDetailPath (single template-literal definition), not a second independent string build"

patterns-established:
  - "Row-click helper pattern: attachRowNavigation(rowEl, activityId) adds a marker class and a guarded click listener; callers pass their own row element and id"

requirements-completed: [UX-01, UX-03]

# Metrics
duration: 25min
completed: 2026-08-13
---

# Phase 20 Plan 01: Shared Row-Navigation Helper Summary

**Extracted `list.ts`'s inline row-click handler into a single shared `src/dashboard/row-navigation.ts` module (`NAVIGABLE_ROW_CLASS`, `activityDetailPath`, `activityDetailHref`, `attachRowNavigation`) with mutation-proven unit tests on its pure surface.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-13T17:29:24Z
- **Completed:** 2026-08-13T17:35:27Z
- **Tasks:** 2 completed
- **Files modified:** 2 (both new)

## Accomplishments
- Created the D-03-mandated single definition of row-click navigation and the `#/activity/{id}` URL shape (`row-navigation.ts`), extracted from `buildTableRow` (`list.ts:336-343`) with behavior preserved exactly
- D-01 (no `tabindex`/`role` mutation on the row) and D-02 (no `keydown` listener, Enter-only via native anchor semantics) enforced both by an automated structural check and explained in the module's file header, so a later agent cannot silently add a Space handler without a test turning red
- Unit-tested the module's pure, DOM-free surface (`activityDetailPath`, `activityDetailHref`, `NAVIGABLE_ROW_CLASS`) and proved the tests load-bearing via a mutation: temporarily changed `activityDetailHref` to build an independent, buggy template literal (`` `#//activity/${activityId}` ``); 3 of 7 assertions failed under it; reverted and confirmed green again with a byte-identical diff

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the shared row-navigation helper module** - `29825e8` (feat)
2. **Task 2: Unit-test the helper's pure surface** - `2e081e7` (test)

**Plan metadata:** (pending — final metadata commit follows this summary in worktree mode)

_Note: Task 2 is `tdd="true"` but its subject (already-implemented pure functions written in Task 1) meant writing the test directly and mutation-proving it, rather than a separate RED-before-implementation commit — Task 1's implementation and Task 2's test necessarily belong to different, atomically-committed tasks per the plan's own file split (`row-navigation.ts` vs `row-navigation.test.ts`)._

## Files Created/Modified
- `src/dashboard/row-navigation.ts` - The D-03 single definition: `NAVIGABLE_ROW_CLASS` marker, `activityDetailPath`/`activityDetailHref` URL-shape functions, `attachRowNavigation` DOM helper (click listener + `closest('a')` guard, extracted verbatim from `list.ts`)
- `src/dashboard/row-navigation.test.ts` - Unit coverage of the pure surface (`activityDetailPath`, `activityDetailHref`, `NAVIGABLE_ROW_CLASS`); explicitly does not cover `attachRowNavigation` (needs a live DOM this repo's vitest `node` environment does not provide)

## Decisions Made
- Followed 20-CONTEXT.md's D-01/D-02/D-03 exactly: table-row click handling stays guard-only (`closest('a')`), no keyboard-handler addition, one shared module rather than per-view copies
- `activityDetailHref` calls `activityDetailPath` internally rather than re-deriving the `#/activity/` template, satisfying D-03's "one definition" requirement literally, not just in spirit — proven by the mutation test

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, verification-script conflict] Reworded test file's DOM-coverage explanation to avoid the literal string `attachRowNavigation`**
- **Found during:** Task 2 (writing `row-navigation.test.ts`)
- **Issue:** The plan's own automated verify command for Task 2 rejects the file if it contains the substring `attachRowNavigation` anywhere (`if(/\bdocument\b|\bwindow\b|attachRowNavigation/.test(s))`), but the acceptance criteria also call for a header comment explaining *why* `attachRowNavigation` isn't covered here — an early draft named the function directly in prose and failed the check.
- **Fix:** Reworded the header comment to describe "the sibling helper that wires up the row's click listener" instead of naming it, preserving the intent (readers still land on `row-semantics.test.ts` and the human checkpoint as the real proof) without the literal identifier the script forbids.
- **Files modified:** `src/dashboard/row-navigation.test.ts`
- **Verification:** Re-ran the plan's own verify script (`node --input-type=module -e "..."`), which now reports `pure test file OK`; `npx vitest run src/dashboard/row-navigation.test.ts` still green (7/7)
- **Committed in:** `2e081e7` (Task 2 commit)

**2. [Rule 3 - Out-of-scope, logged not fixed] Pre-existing gitignored-data test failures in this worktree**
- **Found during:** Task 1 verification (`npx vitest run`, full suite)
- **Issue:** 5 test files (`records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`) fail with `ENOENT` reading gitignored generated data (`data/stats/*.json`, `data/dashboard/index.json`) that is absent from this fresh worktree checkout. Confirmed via `.gitignore` (lines 9-22) and unrelated to any file this plan touches.
- **Fix:** Not fixed — out of scope per the executor's scope-boundary rule. Logged to `.planning/phases/20-row-click-interaction-pattern/deferred-items.md`.
- **Files modified:** none (documentation only, `deferred-items.md`)
- **Verification:** `npx tsc --noEmit` clean; the two files this plan owns pass in full; the full suite's non-pre-existing test count went from 845 to 852 (the 7 new assertions), with the same 5 pre-existing failures before and after this plan's changes
- **Committed in:** `29825e8` (Task 1 commit, `deferred-items.md` included)

---

**Total deviations:** 2 (1 Rule 3 blocking fix to satisfy the plan's own verify script, 1 out-of-scope discovery logged and deferred)
**Impact on plan:** No scope creep. The wording fix keeps the plan's D-01/D-02 mechanical checks passing while preserving the header's intent; the deferred item is a pre-existing environment gap, not a regression this plan introduced.

## Issues Encountered
None beyond the two deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plans 20-02 and 20-03 can now import `attachRowNavigation`, `activityDetailPath`, `activityDetailHref`, and `NAVIGABLE_ROW_CLASS` from `src/dashboard/row-navigation.ts` and wire them into `list.ts`, `records.ts`, and `overview.ts` per D-01/D-05/D-07/D-08.
- Plan 20-04's `row-semantics.test.ts` structural guard and plan 20-05's human browser checkpoint remain the only proof of `attachRowNavigation`'s actual click-handling behavior — this plan's green `npm test` proves the URL shape is centralized, nothing about clicking.
- 5 pre-existing test failures (missing gitignored `data/stats/*.json`/`data/dashboard/index.json`) persist in this worktree, logged in `deferred-items.md`; not a blocker for downstream Phase 20 plans since none of them touch those data-dependent modules.

## Self-Check: PASSED

- FOUND: src/dashboard/row-navigation.ts
- FOUND: src/dashboard/row-navigation.test.ts
- FOUND: 29825e8 (Task 1 commit)
- FOUND: 2e081e7 (Task 2 commit)

---
*Phase: 20-row-click-interaction-pattern*
*Completed: 2026-08-13*
