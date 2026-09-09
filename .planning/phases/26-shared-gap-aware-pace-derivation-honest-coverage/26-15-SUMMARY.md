---
phase: 26-shared-gap-aware-pace-derivation-honest-coverage
plan: 15
subsystem: ui
tags: [typescript, vitest, dashboard-index, nullish-coalescing, tdd]

# Dependency graph
requires:
  - phase: 26-shared-gap-aware-pace-derivation-honest-coverage
    provides: "plan 26-08's paceDisagreement status-badge wiring (D-10, D-11, D-14), plan 26-14's collapsed pace-chart single-source"
provides:
  - "rowPaceDisagreement(row) — the single nullish-narrowing point both list.ts badge call sites read paceDisagreement through"
  - "CR-02 closed: a dashboard index row whose paceDisagreement key is genuinely absent no longer produces a false 'Pace disputed' badge or a TypeError"
affects: [26-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One exported Pick<>-scoped nullish-narrowing helper shared by a badge-text decision and a badge-append decision, so a re-parsed JSON artifact's absent-vs-null key ambiguity cannot resolve differently at the two call sites"
    - "Source-text guard (readFileSync + stripComments + regex count) pinning a fixed defective form at zero occurrences, run inside the same test file rather than a separate lint rule"

key-files:
  created: []
  modified:
    - src/dashboard/views/list.ts
    - src/dashboard/views/list.test.ts
    - .planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/deferred-items.md

key-decisions:
  - "Fixed only the two list.ts call sites named by 26-VERIFICATION.md's deferred: entry; explicitly did not retype index-client.ts's rows as ParsedDashboardIndexRow (phase-sized blast radius across every getRows()/getRow() consumer), logged with reasoning in deferred-items.md instead"

patterns-established:
  - "rowPaceDisagreement(row: Pick<DashboardIndexRow, 'paceDisagreement'>): PaceDisagreement | null as the one place an absent-vs-null additive index field is resolved, mirroring detail.ts:631's existing ?? null precedent"

requirements-completed: [PACE-07]

# Metrics
duration: 6min
completed: 2026-09-09
---

# Phase 26 Plan 15: CR-02 paceDisagreement undefined-vs-null badge hazard Summary

**One exported `rowPaceDisagreement` helper now resolves `list.ts`'s two badge call sites, closing the gap where a stale/partially-regenerated `index.json` row missing the `paceDisagreement` key produced a false "Pace disputed" badge and then threw a TypeError deep in the render path.**

## Performance

- **Duration:** ~6 min (RED commit to GREEN commit)
- **Started:** 2026-09-09T22:27:43+02:00
- **Completed:** 2026-09-09T22:29:25+02:00
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Closed CR-02 (`26-REVIEW.md`): `list.ts:341` and `:380` both used to test `row.paceDisagreement !== null`, which is `true` when the key is genuinely absent (`undefined !== null`) — a shape every existing fixture in the repo avoided by always setting the key to explicit `null`. `detail.ts:631`'s `?? null` precedent shows the case was considered at one call site and missed at the other.
- Added `export function rowPaceDisagreement(row: Pick<DashboardIndexRow, 'paceDisagreement'>): PaceDisagreement | null`, taking a `Pick<>` (not the full row) so it cannot grow into a second row-interpretation site. Both `statusBadgeTexts` (the badge-TEXT decision) and `appendStatusBadges` (the badge-APPEND decision) now read through it, so the two decisions are structurally incapable of drifting the way `:341` and `:380` did.
- `appendStatusBadges` hoists the narrowed local (`const disagreement = rowPaceDisagreement(row)`) above its loop and passes that same local into `appendPaceDisputedBadge` — never a re-read of `row.paceDisagreement` — so the TypeError path is structurally unreachable rather than merely untriggered.
- Added a `rowMissingPaceDisagreement()` fixture that destructures the key off a `baseRow()` result and types the remainder through `ParsedDashboardIndexRow`, so it is genuinely absent (not present-and-undefined). A dedicated assertion (`'paceDisagreement' in row === false`) pins that the fixture cannot silently degrade.
- Added a positive control (a row with a real `PaceDisagreement` still produces the badge on both `statusBadgeTexts` and `activityRowAriaLabel`) so a fix that simply deleted the badge would fail the test suite.
- Added a source-text guard (`readFileSync` + the file's existing `stripComments` + regex count) that pins `row.paceDisagreement !== null` at zero occurrences in `list.ts`, comment-stripped so this file's own prose describing the old defect cannot false-positive the count.
- Reproduced the crash half directly against the built output as a one-off probe (see Verification below), quoted verbatim, even though the permanent guard is the structural badge-text fix rather than a jsdom-rendered reproduction (no jsdom exists in this repo).
- Logged the one deliberately un-acted review recommendation (retyping `index-client.ts`'s rows as `ParsedDashboardIndexRow`) in `deferred-items.md` with its blast radius and the argument that the same hazard class will recur for the next additive index field.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — a row with the key absent must produce no badge; watch it fail** - `48b8189b` (test)
2. **Task 2: GREEN — one nullish-narrowing helper both call sites read; log the index-client deferral** - `0b1cfa1c` (feat)

_TDD-shaped plan: two commits (RED test-only, GREEN implementation), no separate REFACTOR commit needed — the GREEN change was already minimal._

## Files Created/Modified
- `src/dashboard/views/list.ts` - Added `rowPaceDisagreement`; rewrote `statusBadgeTexts` and `appendStatusBadges` to read through it instead of `row.paceDisagreement !== null`
- `src/dashboard/views/list.test.ts` - Added the CR-02 describe block (6 tests: fixture self-check, missing-key statusBadgeTexts equality-with-clean-row, missing-key exclusion of `PACE_DISPUTED_BADGE_TEXT`, missing-key aria-label exclusion, positive control, source-text guard) plus a `ParsedDashboardIndexRow` import and a `PACE_DISPUTED_BADGE_TEXT` import
- `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/deferred-items.md` - Appended the "Phase 26 Plan 15" section logging the deliberately-deferred `index-client.ts` retype

## Decisions Made
- Fixed only `list.ts`'s two call sites, matching `26-VERIFICATION.md`'s `deferred:` entry exactly. Did not retype `index-client.ts`'s rows to `ParsedDashboardIndexRow`, since that is a phase-sized refactor (every `getRows()`/`getRow()` consumer would need its own narrowing) that the verification entry does not name as part of CR-02's closure — logged in `deferred-items.md` with the reasoning and a note that it should carry into the milestone's open-items list rather than be dropped.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1-4 auto-fixes were needed; the plan's own `<action>` blocks specified the fix precisely enough that no gap-filling was required.

## Verification

- `npx vitest run src/dashboard/views/list.test.ts -t "CR-02 — a row whose index predates"` — RED (Task 1, before the fix): 4 of 6 assertions failed, all for the stated CR-02 reason. Verbatim failure excerpt:
  ```
  FAIL src/dashboard/views/list.test.ts > CR-02 — a row whose index predates the paceDisagreement field produces no badge and no crash > statusBadgeTexts returns [] for the missing-key row, matching a clean explicit-null row
  AssertionError: expected [ 'Pace disputed' ] to deeply equal []
  - Expected
  + Received
  - []
  + [
  +   "Pace disputed",
  + ]
  ```
  The positive control (`positive control: a row with a real PaceDisagreement still produces the badge and the aria-label fragment`) passed even before the fix, confirming the test block was not one-directional.
- After Task 2 (GREEN): same command, 6/6 pass; `npx vitest run src/dashboard/views/list.test.ts` 70/70 pass; `npx tsc --noEmit` clean; `npm run test` 1741 passed / 7 pre-existing environment-only file failures (ENOENT on gitignored `data/stats/*.json` and a missing `node_modules/chartjs-plugin-zoom` asset — the exact same 7 files already documented in `deferred-items.md`'s Plan 01 record, unrelated to this plan's files).
- Crash-half reproduction, run once against the built output (`npm run build` then a one-off `node --input-type=module -e` probe importing `dist/dashboard/views/list.js` and calling `paceDisputedExplanation(undefined)`):
  ```
  TypeError: Cannot read properties of undefined (reading 'streamPaceSecPerKm')
      at paceDisputedExplanation (file:///.../dist/dashboard/views/list.js:229:93)
  ```
  This is the consequence the badge-text fix makes structurally unreachable — `appendPaceDisputedBadge` (which calls `paceDisputedExplanation`) can now only be invoked with the value `rowPaceDisagreement` has already narrowed to non-null.
- `grep -c "row.paceDisagreement !== null" src/dashboard/views/list.ts` → `0`
- `grep -c "rowPaceDisagreement(row)" src/dashboard/views/list.ts` → `2`
- `git status --porcelain src/dashboard/views/list.ts` was empty at the end of Task 1 (production file untouched during RED), confirming the failing tests were genuinely watched fail before any fix.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PACE-07 is satisfied by this plan's closure; PACE-01 remains deliberately `Pending` per plan 26-14's reopening and is not touched here — plan 26-16 re-closes it after the Round 3 browser checkpoint.
- No blockers for 26-16. `list.ts` and `list.test.ts` are both green and untouched beyond this plan's scope.

---
*Phase: 26-shared-gap-aware-pace-derivation-honest-coverage*
*Completed: 2026-09-09*
