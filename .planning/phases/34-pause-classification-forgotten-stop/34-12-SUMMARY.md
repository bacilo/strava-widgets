---
phase: 34-pause-classification-forgotten-stop
plan: 12
subsystem: testing
tags: [calibration, d13-insensitivity, d19, gap-closure, pause-classification, forgotten-stop, vitest]

# Dependency graph
requires:
  - phase: 34-pause-classification-forgotten-stop
    provides: "scripts/compute-pause-classification-calibration.mjs (PREDECLARED_SHAPES, the D-13 harness, runCalibration/runFamily/evaluateShape) from plan 34-04"
  - phase: 34-pause-classification-forgotten-stop
    provides: "34-06-HALT-1.md's diagnosis of both defects this plan fixes: the vacuous planted rows, and G1/G2/G3 all failing D-13 insensitivity at walking/jogging speeds"
  - phase: 34-pause-classification-forgotten-stop
    provides: "34-CONTEXT.md D-19 (2026-09-22): the developer decision authorising this plan's re-declaration of Family G and the proportional planted-perturbation rule"
provides:
  - "scripts/compute-pause-classification-calibration.mjs: PLANT_FRACTION (assigned from INSENSITIVITY_TOLERANCE), generic plantShapes({population, count}) with unconditional per-shape admission, standstill-episode views (paSec, standstillEpisodes) built from base pause/bridge chaining with an asserted bridge invariant, shapeG4/shapeG5 replacing shapeG1/G2/G3, the amended REJECTED_SHAPES list, the rewritten always-on driftSection, and a plants-column renderer naming the D-19 amendment"
  - "scripts/compute-pause-classification-calibration.test.mjs: the RED-then-GREEN 'planted entry' proof (6 tests), a new 'standstill episodes' describe block (6 tests) proving the chaining/bridging rule in both directions plus the bridge invariant, G4/G5-updated 'reference shape'/'shape arbitration'/'render' describes, and a 24-cell 'reachability' matrix proving every one of G4/G5/M1/M2/W1/W2 reachable on both the REMOVED and PLANTED axes in both directions, on synthetic fixtures only (95 tests total)"
affects: [34-06, 34-07, 34-08, 34-09, 34-10, 34-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-13's PLANTED perturbation is per-shape and proportional (ceil(INSENSITIVITY_TOLERANCE x that shape's own base item count)), built inside runFamily via a `population` descriptor {arrayKey, baseItemCount(view), buildItem(template, sentinel)} — never a single family-wide fixed-count plant. Membership (which activities receive a plant) is restricted to activities that already contribute >=1 base item to that specific shape's population, round-robin by sorted id."
    - "A shape admits planted items unconditionally by construction of its population descriptor (cadenceSilent:true, chained:true, etc. set directly on the built plant item) rather than by adding an exception branch to the shape's own filtering logic — the one exception is the retired G3's window filter, which explicitly bypassed position-checking for `planted: true` items before G3 was deleted in Task 2."
    - "A standstill episode is a maximal alternating chain of zero-advance pause intervals and bridges (covered runs whose real-time span matches EXACTLY [pause.endSec, nextPause.startSec], sample-time equality, with seconds < P_a); anything else between two pauses breaks the chain. Built once from BASE data in buildBaseViews, never re-chained after REMOVED-view filtering."
    - "Fixture design for a proportional-planting harness must keep every MEMBER activity's own population large, not just the pooled archive-wide total — round-robin plant placement is even BY ACTIVITY ID, so a small D-10/D-12-style fixture mixed into a 'bulk' archive absorbs the same plant share as a huge background activity, contaminating it far past 1% locally even when the pooled total looks bulk-dominated."

key-files:
  created: []
  modified:
    - scripts/compute-pause-classification-calibration.mjs
    - scripts/compute-pause-classification-calibration.test.mjs

key-decisions:
  - "Split the plan's three tasks into four commits, not three: Task 1's own <action> explicitly calls for a separate RED commit ('Commit the failing test as test(34-12): planted entry fails...') before the GREEN fix, mirroring this system's standard TDD RED/GREEN protocol rather than the single-commit-per-task pattern 34-04 used for its own (non-explicitly-RED-gated) tasks."
  - "Rewrote the shared 'bulk-dominated' background fixture (buildBackgroundActivity) rather than adding a parallel one: G4/G5 need actual zero-advance pauses, which the old fixture (all-positive-speed 'phase1' block) never produced. The new fixture's standstill-group bridge speed is deliberately set EQUAL to the walking hump's speed (1.0 m/s) so its folded-step contribution merges into W's existing walk cluster bin instead of creating a spurious extra valley dip between the tiny drift rate and the walk/run humps — discovered by direct measurement after an initial attempt (bridge speed 0.5 m/s, phase1 creep block still present) produced a nonsensical WALK_RUN_BOUNDARY_MPS of 0.25 (an artifact gap between two contamination clusters, not the intended valley)."
  - "Kept a separate 'slow creep block' (speed 0.05 m/s, deliberately BELOW the eventual shipped G value) in the shared fixture so M's creep-candidate population and strawman M's own population have genuine non-degenerate content — without it, M's floor-gated creepCandidates() population would be empty on every fixture (since nothing else in the archive is slow enough to qualify), making strawman M's FAIL vacuous rather than a genuine base-to-null collapse under removal."
  - "24 reachability fixtures were each independently validated via direct Node execution against the real harness functions (not hand-derived arithmetic) before being written into the test file, then re-verified inside vitest — every cell's PASS/FAIL direction is measured, not assumed."

patterns-established:
  - "Pattern: when a D-13 harness's perturbation becomes per-shape/proportional rather than family-wide/fixed, every downstream CAN-PASS synthetic fixture must be audited for whether ITS OWN small archive-mixing choices (small D-10/D-12-style activities alongside bulk ones) still hold under the new plant-distribution rule — a fixture that passed under a fixed small plant count can silently start failing once the plant count scales with a shape's own (potentially huge) population."

requirements-completed: []  # this plan ticks nothing — PAUSE-01/STOP-02's disposition is a later plan's job, per this plan's own Requirement-tick safety note; the phase 34-06 re-run has not happened yet

# Metrics
duration: single session, 2026-09-22
completed: 2026-09-22
---

# Phase 34 Plan 12: D-19 Gap Closure — Family G Re-declared as Standstill Episodes Summary

**Fixed HALT-1's vacuous D-13 planted rows (proportional per-shape planting, watched RED first) and re-declared Family G as G4/G5 "standstill episodes" (chained zero-advance-pause/bridge chains, built from base pause/bridge data with an asserted bridge invariant) replacing G1/G2/G3, which all measured walking/jogging speeds instead of stationary drift and failed D-13 on the real archive — proven reachable in both directions on both D-13 axes for all six real shapes via a 24-cell matrix, entirely on synthetic fixtures; the real archive is still unmeasured.**

## Performance

- **Duration:** single session
- **Tasks:** 3
- **Files modified:** 2 (both existing: the generator script and its test file)

## Accomplishments

- **Task 1 (D-19 planting-defect fix):** Watched RED against the unmodified HALT-1 code on a new `pauseBearingArchive()` fixture (real zero-advance pauses, a chained bridge, a recording gap adjoining a pause) — `G3: expected planted.items (32) === base.items (32) + plantCount (2) = 34, got 32` and `strawman G: expected planted.items (2) === base.items (2) + plantCount (2) = 4, got 2` — matching 34-06-HALT-1.md's own diagnosis exactly, then fixed: `plantShapes` now takes a `{ population, count }` descriptor and plants exactly `ceil(PLANT_FRACTION x that shape's own base items)` clones round-robin into member activities only, with `PLANT_FRACTION` assigned from `INSENSITIVITY_TOLERANCE` (never a literal). Every shape/strawman admits `planted: true` items unconditionally.
- **Task 2 (Family G re-declaration):** Implemented the STANDSTILL DEFINITIONS (`paSec`, `standstillEpisodes` with bridge/chain construction and an asserted zero-metres-bridge invariant) in `buildBaseViews`. Added `shapeG4` (pooled R-7 p90 of chained-episode rates) and `shapeG5` (per-activity metres/seconds ratio, R-7 p90 across activities). Deleted `shapeG1`/`shapeG2`/`shapeG3` and `DEVICE_FAMILY_NOTE`. `PREDECLARED_SHAPES.G` is now `[G4, G5]`, pinned by a literal-order test. `REJECTED_SHAPES` gained the amendment's (c)-(g) entries plus the RETIRED line. `removeNeighbourhoods('G', ...)` now filters `standstillEpisodes`. `driftSection` is rewritten to always compute from BASE standstill episodes, independent of whether G cleared. Rendering names "34-04-PLAN.md `<predeclared_shapes>`, as amended by 34-12-PLAN.md (D-19)" and states the uniform planting rule.
- **Task 3 (24-cell reachability):** For each of G4, G5, M1, M2, W1, W2 — REMOVED CAN FAIL/CAN PASS and PLANTED CAN FAIL/CAN PASS, each on a dedicated fixture whose structure realises its own named mechanism from the amendment's REACHABILITY table (verified via direct measurement, not asserted from theory): small pause-bearing archives that empty entirely under REMOVED; a single-member G5 archive whose disproportionate plant lifts the one member's ratio outright; creep-dominated M hosts whose entire advance-interval population sits inside a creep candidate's own neighbourhood; tiny M hosts where one planted interval dominates a small quantile; a single thin-valley W activity whose recording-gap rate lands exactly in the current argmin bin. Every CAN-PASS cell also asserts the paired strawman FAILs on the same fixture.
- Full generator test file: **95 tests**, all synthetic, zero real-stream reads (`grep -c "data/streams"` prints 0). Full `npm test`: **97 files / 3299 tests**, all green. `npm run build` (tsc) clean throughout.
- `34-CALIBRATION.md` byte-identical to HEAD throughout (still HALT-1's committed artifact, git history at `00c02bda`); `data/streams/` untouched; `main()` was never invoked.

## Task Commits

Each task was committed atomically (Task 1 split into its own RED/GREEN pair per the plan's explicit instruction):

1. **Task 1 (RED):** `test(34-12): planted entry fails on HALT-1 planting (G3, strawman G vacuous)` - `b0237f5a` (test)
2. **Task 1 (GREEN):** `feat(34-12): proportional per-shape D-13 planting with unconditional entry (D-19 Task 1)` - `8c3b66fc` (feat)
3. **Task 2:** `feat(34-12): re-declare Family G as G4/G5 standstill episodes, retire G1/G2/G3 (D-19 Task 2)` - `763743f8` (feat)
4. **Task 3:** `test(34-12): 24-cell reachability matrix for G4/G5/M1/M2/W1/W2, both axes, both directions (D-19 Task 3)` - `b52adbb5` (test)

**Plan metadata:** (this commit) `docs(34-12): complete plan`

## Files Created/Modified

- `scripts/compute-pause-classification-calibration.mjs` - the calibration generator: proportional per-shape D-13 planting (Task 1), standstill-episode views/G4/G5/amended rejected list/rewritten drift section (Task 2)
- `scripts/compute-pause-classification-calibration.test.mjs` - 95 synthetic-fixture tests: planted-entry RED-then-GREEN proof, standstill-episode chaining/bridge-invariant tests, G4/G5-updated reference-shape/arbitration/render tests, and the 24-cell reachability matrix

## Decisions Made

- **RED evidence quoted verbatim.** Before the fix, on `pauseBearingArchive()`, the old family-wide `plantShapes(views, sourceShapes)` (count = archive `|J|`, plants pushed only into `coveredPairs`/`foldedSteps`/`positionedAdvanceIntervals` at span `[0, seconds]`) gave `G3: expected planted.items (32) === base.items (32) + plantCount (2) = 34, got 32` and `strawman G: expected planted.items (2) === base.items (2) + plantCount (2) = 4, got 2` — both zero-growth, exactly the defect 34-06-HALT-1.md named.
- **`items` is a pooled-array-length reading, not a separately-tracked counter, for every shape except strawman M.** For G1(retired)/G3(retired)/G4/G5/strawman-G/strawman-W/W1/W2/M1/M2, `items` = the size of the relevant population array as read from whichever view (base or planted) is passed to the shape function — this makes `plantedItems === baseItems + plantCount` hold structurally, as long as plants are admitted and match the population's membership predicate. Only strawman M's `plantedCreepDurations` is a genuinely separate array (since strawman M's real population is dynamically recomputed from `coveredPairs` via a floor threshold, not stored directly), so its `items` sums the recomputed creep-candidate count plus the separate planted-durations array length.
- **The shared background fixture's bridge speed (1.0 m/s, equal to the walking hump) was chosen after a failed first attempt (0.5 m/s) produced a spurious extra valley cluster** between the drift rate and the walk/run humps, giving a nonsensical `WALK_RUN_BOUNDARY_MPS = 0.25`. Setting the bridge speed equal to an existing cluster (walking) merges its folded-step contribution into that bin rather than creating a new one — discovered empirically, documented in the fixture's own docblock.
- **A dedicated slow creep block (0.05 m/s, kept below the eventual shipped G value) was added back to the shared fixture** so M1/M2's creep-candidate population and strawman M's own population have genuine, non-degenerate content on every archive that uses this fixture — without it, `creepCandidates()` at the shipped-G floor finds nothing anywhere in the archive, making strawman M's FAIL a vacuous "always null" case rather than a real base-to-null collapse under removal.

## Deviations from Plan

### Auto-fixed Issues

None — every "fix" in this plan (the planting-defect fix in Task 1, the Family G re-declaration in Task 2) IS the plan's own stated work, not an unplanned deviation. The two design corrections documented under "Decisions Made" above (the bridge-speed choice and the slow-creep-block addition) were made during Task 2's own fixture construction, before any commit, in service of the plan's own stated behavior requirements (a working `<lo, hi)` valley and a non-vacuous strawman M) — not classified as Rule 1-3 auto-fixes since no prior committed code was found broken; they are fixture-design choices within this plan's own scope.

**Total deviations:** 0
**Impact on plan:** None — plan executed exactly as written, including its own RED-then-GREEN instruction for Task 1.

## Issues Encountered

- Building 24 genuinely-mechanism-realizing synthetic fixtures for Task 3 required substantial direct-measurement iteration (via ad hoc Node scripts run against the real harness functions) rather than hand-derived arithmetic, since R-7 quantile interpolation and round-robin plant placement across activities of very different population sizes produce non-obvious results. Every fixture in the final test file was validated this way before being committed — none is guessed.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - this plan touches only a calibration generator and its own tests; no UI, no dashboard data path.

## Next Phase Readiness

- Family G is fully re-declared (G4, G5) and un-peeked — `main()` was never run, `34-CALIBRATION.md` is still HALT-1's artifact, `data/streams` is untouched.
- **Plan 34-06's re-run is now unblocked.** It can re-run `npm run compute-pause-classification-calibration` against the real 1,874-stream archive: strawman G first (expected FAIL), then G4 then G5 in that pinned order, then (if G clears) M1/M2 and W1/W2 in their own unchanged order.
- Plans 34-07 through 34-11 remain blocked on 34-06's re-run producing real shipped constants (`STATIONARY_MAX_SPEED_MPS`, `WALK_RUN_BOUNDARY_MPS`, `FORGOTTEN_STOP_MIN_SEC`), per the phase's existing fixed-order dependency chain.
- No blockers specific to this plan. The generator, its 95 synthetic tests and this SUMMARY are complete and committed; the archive has not been touched.

---
*Phase: 34-pause-classification-forgotten-stop*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: `scripts/compute-pause-classification-calibration.mjs`
- FOUND: `scripts/compute-pause-classification-calibration.test.mjs`
- FOUND: `.planning/phases/34-pause-classification-forgotten-stop/34-12-SUMMARY.md` (this file)
- FOUND commits: `b0237f5a`, `8c3b66fc`, `763743f8`, `b52adbb5`
