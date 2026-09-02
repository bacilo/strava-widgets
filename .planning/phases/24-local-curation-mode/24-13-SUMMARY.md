---
phase: 24-local-curation-mode
plan: 13
subsystem: ui
tags: [typescript, vitest, dashboard, best-effort-exclusions, curation]

# Dependency graph
requires:
  - phase: 24-local-curation-mode
    provides: "24-10's live exclusions fetch (loadLiveExclusionState) and 24-09's buildBestEffortsPanelRows live-exclusion wiring, which this plan extends to buildPrBadgeLabels"
provides:
  - "buildPrBadgeLabels(entry, liveExclusions) — required second parameter, reads the same live exclusions document as the panel rows"
  - "BestEffortPanelRow.isPr suppressed for live-excluded rows (wasPRAtTheTime && !excluded)"
  - "Single wired call site in detail.ts passing the same liveExclusions to both derivations from one Promise.all"
affects: [24-VERIFICATION, activity-detail-view, best-effort-exclusions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Required (non-optional, non-defaulted) parameters as a compile-time guard against forgotten call sites — same discipline as 24-09's buildBestEffortsPanelRows"
    - "Compute a derived boolean once into a local binding and reuse it across two output fields, making two claims structurally unable to diverge"

key-files:
  created: []
  modified:
    - src/dashboard/views/detail-best-efforts-logic.ts
    - src/dashboard/views/detail-best-efforts-logic.test.ts
    - src/dashboard/views/detail.ts

key-decisions:
  - "Option (a) from 24-VERIFICATION.md (suppress badges from the live document) chosen over option (b) (document staleness as accepted behaviour) — D-04's whole-activity exclusion semantics make a rendered PR badge on an excluded activity a PR claim of a kind, which option (b) cannot defend"
  - "Fixed both halves of the contradiction: buildPrBadgeLabels (header) AND BestEffortPanelRow.isPr (panel row), because buildPrFlagsCell renders isPr and excluded into the same <td> — fixing only the header would have left the exact PRExcluded string R15 quoted still rendering"
  - "liveExclusions is a REQUIRED second parameter (no default, no optional marker) on buildPrBadgeLabels, matching 24-09's existing discipline on buildBestEffortsPanelRows, so a forgotten call site is a tsc error, not a silent staleness window"

patterns-established:
  - "Textually parallel ternaries: buildPrBadgeLabels and buildBestEffortsPanelRows now compute excluded via the identical `liveExclusions !== null ? isExcluded(...) : effort.excludedFromRecords` shape, making the two derivations visibly incapable of diverging by inspection alone"

requirements-completed: [CUR-01]

# Metrics
duration: 3min
completed: 2026-09-02
---

# Phase 24 Plan 13: Header PR Badges Read the Same Live Exclusions as the Panel Rows Summary

**Closed GAP-3 (WR-05): `buildPrBadgeLabels` now takes a required `liveExclusions` parameter and `BestEffortPanelRow.isPr` is suppressed for live-excluded rows, so the header PR badge and the Best Efforts panel can no longer disagree about whether a run holds a PR in the same paint — the exact `PRExcluded — {reason}` contradiction R15 quoted is now structurally unreachable.**

## Performance

- **Duration:** 3 min (11:19:42 – 11:22:35)
- **Tasks:** 3
- **Files modified:** 3 (`detail-best-efforts-logic.ts`, `detail-best-efforts-logic.test.ts`, `detail.ts`)

## Accomplishments

- Added 7 WR-05 guard cases (RED-first per D-11) covering whole-activity suppression, distance-scoped suppression (D-05), the R19 mirror-image direction, `null`-means-UNKNOWN fallback, the exact R15 contradiction reproduced over both derivations from one index, `isPr` suppression, and non-over-suppression.
- `buildPrBadgeLabels(entry, liveExclusions)` — required second parameter, gates on the same `isExcluded(liveExclusions, entry.activityId, distance)` ternary `buildBestEffortsPanelRows` already used, falling back to `effort.excludedFromRecords` only when `liveExclusions === null`.
- `buildBestEffortsPanelRows` now computes `excluded` once into a local binding and sets `isPr = wasPRAtTheTime && !excluded` from that same binding — the row-level half of the fix, since `buildPrFlagsCell` renders `isPr` and `excluded` into one `<td>`.
- `detail.ts`'s only production call site now passes the already-bound `liveExclusions` to `buildPrBadgeLabels`, from the same `Promise.all` that feeds `buildBestEffortsPanelRows`. D-03(b)'s mount `CustomEvent` remains the function's last statement, unchanged.
- Rebuilt dashboard SPA bundle hash changed (`index-UHckEgvm.js` → `index-B1uN9-48.js`), confirming the fix landed in the bytes a browser round would test.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the WR-05 guards and observe them RED against the current code (D-11)** - `4d57de9` (test)
2. **Task 2: Derive both PR claims from the live exclusions document** - `1fa2a76` (feat)
3. **Task 3: Wire detail.ts's single Promise.all to both derivations and prove no call site is left behind** - `a291814` (fix)

**Plan metadata:** committed separately per worktree protocol (SUMMARY.md commit)

## Files Created/Modified

- `src/dashboard/views/detail-best-efforts-logic.ts` — `buildPrBadgeLabels` gains required `liveExclusions: ExclusionIndex | null` param; `buildBestEffortsPanelRows` computes `excluded` once and derives `isPr` from it; both docblocks extended with rationale and the computed-stats boundary.
- `src/dashboard/views/detail-best-efforts-logic.test.ts` — new `WR-05` describe block (7 cases); six existing one-argument call sites updated to pass `null`; the defect-pinning non-regression case deleted (see Deviations).
- `src/dashboard/views/detail.ts` — the sole production call site now passes `liveExclusions` as the second argument, with a one-line comment naming WR-05.

## Decisions Made

- Implemented option (a) from `24-VERIFICATION.md`, per the plan's own `<position_on_scope>` analysis grounded in D-04 — not re-litigated here.
- Fixed both the header (`buildPrBadgeLabels`) and the row (`BestEffortPanelRow.isPr`) halves in the same plan, since the verification report's `missing` list under-specified scope (named only the header) but the actual R15-quoted string came from the row-driven flags cell.
- Kept `effort.excludedFromRecords`/`effort.wasPRAtTheTime` as the sole source of truth for Records-screen rankings, promoted next-best efforts, `compute-dashboard-index` counts, and the Activities-list badge (`list.ts:266`) — nothing in this module recomputes a ranking in the browser (D-06 untouched).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test hygiene] Deleted the non-regression case pinning the defect as intended behaviour**
- **Found during:** Task 1
- **Issue:** `detail-best-efforts-logic.test.ts` lines 262-268 contained a case named `non-regression: buildPrBadgeLabels still takes exactly one argument and still gates on effort.excludedFromRecords only` — this asserted the OLD, one-argument, precomputed-only behaviour as correct, and could not coexist with the fix (it would fail to compile once the signature changed, and even if forced to compile it would assert the exact contradiction this plan closes).
- **Fix:** Deleted per the plan's own explicit Task 1 instruction; replaced by the new `WR-05` describe block, whose case (d) ("a null live index means UNKNOWN...") covers the same `null`-fallback behaviour the deleted case partially exercised, but without pinning the one-argument signature.
- **Files modified:** `src/dashboard/views/detail-best-efforts-logic.test.ts`
- **Verification:** `grep -c "still takes exactly one argument" ...` returns 0; full suite green after Task 2.
- **Committed in:** `4d57de9` (Task 1 commit)

---

**Total deviations:** 1 (plan-directed test deletion, not a discovered issue — documented per plan's own instruction, not a Rule 1-4 auto-fix in the "found unplanned work" sense)
**Impact on plan:** None — plan executed exactly as written; the deletion was an explicit Task 1 action item, not a deviation from scope.

## Issues Encountered

`npm test` reports 6 failed test files / 1369 passed tests in this worktree
(`.claude/worktrees/agent-a4e81cd0a136ff64d`). All six are pre-existing `ENOENT` import errors —
none of the six failing files (`trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`,
`trends-zoom-logic.test.ts`, `trends-gear-logic.test.ts`, and 2 siblings) were touched by this
plan's 3 files, and the failure mode is identical with or without this plan's changes: they read
`data/stats/*.json` and `node_modules/chartjs-plugin-zoom/...`, both gitignored/absent from a
worktree checkout. This exact pattern was already documented by sibling plan 24-02 in
`.planning/phases/24-local-curation-mode/deferred-items.md`; this plan's investigation is appended
there as a confirmation entry rather than duplicated. In-scope verification is fully green:
`npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts` — 26/26 pass; `npx tsc
--noEmit` exits 0; `npm run build` and `npm run build-widgets` both exit 0; `npm test`'s own tally
shows 0 assertion failures across all 1369 executed tests.

## WR-05 D-11 RED Evidence (Task 1)

**vitest** (`npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts`), observed against the unfixed code — 5 failing, matching the plan's predicted shape (cases a, b, R19/(c), e, f; cases (d) and (g) already passed):

```
 ✓ ... (21 pre-existing cases pass unchanged)
 × post-Save, pre-Recompute: a live index marking the whole activity excluded suppresses every header badge
   AssertionError: expected [ 'PR — 5K' ] to deeply equal []
 × a distance-scoped live entry suppresses only the distances it names (D-05 read tolerance)
   AssertionError: expected [ 'PR — 5K', 'PR — 10K' ] to deeply equal [ 'PR — 10K' ]
 × R19 mirror-image: a loaded-and-empty live index overrides a stale true precomputed flag
   AssertionError: expected [] to deeply equal [ 'PR — 5K' ]
 × PRExcluded: the R15 contradiction reproduced as one assertion over both derivations from the same index
   AssertionError: expected [ 'PR — 400m' ] to deeply equal []
 × isPr is suppressed for a live-excluded row even when wasPRAtTheTime is true — buildPrFlagsCell renders isPr and excluded into the same <td>
   AssertionError: expected false to be true

 Test Files  1 failed (1)
      Tests  5 failed | 21 passed (26)
```

**tsc** (`npx tsc --noEmit`), observed against the unfixed code:

```
src/dashboard/views/detail-best-efforts-logic.test.ts(34,37): error TS2554: Expected 1 arguments, but got 2.
src/dashboard/views/detail-best-efforts-logic.test.ts(39,38): error TS2554: Expected 1 arguments, but got 2.
src/dashboard/views/detail-best-efforts-logic.test.ts(50,38): error TS2554: Expected 1 arguments, but got 2.
src/dashboard/views/detail-best-efforts-logic.test.ts(60,38): error TS2554: Expected 1 arguments, but got 2.
src/dashboard/views/detail-best-efforts-logic.test.ts(73,38): error TS2554: Expected 1 arguments, but got 2.
src/dashboard/views/detail-best-efforts-logic.test.ts(271,38): error TS2554: Expected 1 arguments, but got 2.
src/dashboard/views/detail-best-efforts-logic.test.ts(283,38): error TS2554: Expected 1 arguments, but got 2.
src/dashboard/views/detail-best-efforts-logic.test.ts(292,38): error TS2554: Expected 1 arguments, but got 2.
src/dashboard/views/detail-best-efforts-logic.test.ts(303,38): error TS2554: Expected 1 arguments, but got 2.
src/dashboard/views/detail-best-efforts-logic.test.ts(316,46): error TS2554: Expected 1 arguments, but got 2.
```

After Task 2, `npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts` reports 26/26 passing (GREEN).

## Task 3: Call-Site Search and Build Evidence

Repo-wide search (`grep -rn "buildPrBadgeLabels(" src/`), confirming every call site passes two arguments:

```
src/dashboard/views/detail-best-efforts-logic.ts:52:export function buildPrBadgeLabels(
src/dashboard/views/detail.ts:550:    for (const label of buildPrBadgeLabels(bestEffortsEntry, liveExclusions)) {
src/dashboard/views/detail-best-efforts-logic.test.ts:34:    expect(buildPrBadgeLabels(null, null)).toEqual([]);
src/dashboard/views/detail-best-efforts-logic.test.ts:39:    expect(buildPrBadgeLabels(entry, null)).toEqual([]);
src/dashboard/views/detail-best-efforts-logic.test.ts:50:    expect(buildPrBadgeLabels(entry, null)).toEqual(['PR — 5K', 'PR — 10K']);
src/dashboard/views/detail-best-efforts-logic.test.ts:60:    expect(buildPrBadgeLabels(entry, null)).toEqual(['PR — 10K']);
src/dashboard/views/detail-best-efforts-logic.test.ts:73:    expect(buildPrBadgeLabels(entry, null)).toEqual([
src/dashboard/views/detail-best-efforts-logic.test.ts:271:    expect(buildPrBadgeLabels(entry, liveExclusions)).toEqual([]);
src/dashboard/views/detail-best-efforts-logic.test.ts:283:    expect(buildPrBadgeLabels(entry, liveExclusions)).toEqual(['PR — 10K']);
src/dashboard/views/detail-best-efforts-logic.test.ts:292:    expect(buildPrBadgeLabels(entry, liveExclusions)).toEqual(['PR — 5K']);
src/dashboard/views/detail-best-efforts-logic.test.ts:303:    expect(buildPrBadgeLabels(entry, null)).toEqual(['PR — 10K']);
src/dashboard/views/detail-best-efforts-logic.test.ts:316:    const labels = buildPrBadgeLabels(entry, liveExclusions);
```

`grep -rn "buildPrBadgeLabels(" src/ | grep -c "buildPrBadgeLabels([a-zA-Z]*)"` → `0` (no single-argument call site anywhere).

**Gate exit codes:** `npx tsc --noEmit` → 0. `npm run build` → 0. `npm run build-widgets` → 0. `npm test` → non-zero overall (6 pre-existing file-level ENOENT failures unrelated to this plan; 0 assertion failures, 1369/1369 executed tests pass — see Issues Encountered).

**Bundle hash:** rebuilt `dist/widgets/assets/index-B1uN9-48.js` (and `index-B573RjUr.css`). This **differs** from Round 2's `index-UHckEgvm.js`, confirming the fix is present in the bytes a later browser verification round would load.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

GAP-3/WR-05 closed. `buildPrBadgeLabels` and `BestEffortPanelRow.isPr` now derive from the same live exclusions document in the same paint, matching the `buildBestEffortsPanelRows` wiring 24-09 already established. The repo-wide call-site search and the required (non-optional) parameter both make a future regression a compile-time error rather than a silent staleness window. No blockers for phase gate re-verification; the pre-existing 6-file `npm test` environment gap (documented in `deferred-items.md`) is orchestrator/main-checkout territory, not a plan blocker.

---
*Phase: 24-local-curation-mode*
*Completed: 2026-09-02*
