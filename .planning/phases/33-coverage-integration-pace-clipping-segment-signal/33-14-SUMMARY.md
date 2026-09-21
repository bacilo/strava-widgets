---
phase: 33-coverage-integration-pace-clipping-segment-signal
plan: 14
subsystem: analytics
tags: [unreliable-segments, severity-calibration, D-13-insensitivity, D-16, non-circularity, vitest, calibration-artifact]

# Dependency graph
requires:
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    plan: "08"
    provides: "scripts/compute-unreliable-segment-severity-calibration.mjs (candidate/strawman/cohort machinery, kept verbatim), the documented HALT this plan closes, and excessMetres on UnreliableSegment"
  - phase: 32-unreliable-segment-detection-calibration
    provides: "detectUnreliableSegments, DEFAULT_DETECTOR_PARAMS, advanceSteps, the D-13 insensitivityCheck pattern (removal/plant over a stepsIndex) this plan restates over a view shape"
provides:
  - "UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = 0.00423 in src/analytics/pace-quality.ts — SEG-06's severity-tier constant, derived non-circularly (D-16) and pinned to 33-CALIBRATION.md by a two-directional equality guard"
  - "Four pre-declared, ordered reference shapes (R1..R4) plus a step-level D-13 harness (buildBaseViews/buildRemovedViews/buildPlantedViews/evaluateShape) and first-clearing arbitration (selectShape), all in scripts/compute-unreliable-segment-severity-calibration.mjs"
  - "33-CALIBRATION.md regenerated: Chosen constant R1, D-07 anchor check PASS, archive-wide finding severe 136 / minor 563 / none 1175 of 1874, with 33-08's own negative finding kept intact under a Recorded negative finding section"
affects: [33-09, 33-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A calibration cut's non-circularity is demonstrated by moving the STATISTIC to a reference population disjoint from the judged population, not by arguing about the same population differently — the Phase 32 UNRELIABLE_EXCESS_FLOOR_M lesson, now applied a second time to D-07's severity tier"
    - "A pre-declared, ordered, fixed-before-measurement shape list with a first-clearing selection function that receives ONLY {id, pass} is a structural (testable via source-text inspection) anti-quota guarantee, not a policy one"
    - "A D-13 harness's own removal step can make a circular strawman UNFALSIFIABLE-FAIL by construction (removal always empties the flagged population's excessList entirely here) — a useful property to notice and state, not a defect to route around"
    - "Shipping a calibrated constant 'from the artifact' means pinning to the artifact's own SOURCE-TEXT decimal string, never runtime String(number) — the latter silently normalises away a trailing-zero mismatch a numeric-only check cannot catch"

key-files:
  created: []
  modified:
    - scripts/compute-unreliable-segment-severity-calibration.mjs
    - scripts/compute-unreliable-segment-severity-calibration.test.mjs
    - src/analytics/pace-quality.ts
    - src/analytics/pace-quality.test.ts
    - .planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-CALIBRATION.md

key-decisions:
  - "Added a runtime assertion (Rule 1 deviation, Task 3) that the new step-level strawman's base value equals 33-08's legacy q=0.99 cut exactly — the plan's own <d13_harness> block requires this ('assert it; a mismatch means the views are wrong') but Task 2's main() omitted it. Verified true on the real archive (both 0.035713802737883264) before trusting any row."
  - "Chose R1 ('accumulated ordinary step noise') as the shipped shape — it was the FIRST in the fixed R1/R2/R3/R4 order to clear D-13 (removedDelta 0.2848%, plantedDelta 0.5081%, both well under 1%); R2/R3/R4 also cleared but never reached selection, since a later-passing row never beats an earlier one."
  - "The D-07 anchor check (3475734189 must tier severe, 10146303423 must tier none) PASSED on the first attempt at R1's rounded cut (0.00423) — no fallback to a later shape was needed."

patterns-established:
  - "A view shape ({id, steps, totalDistanceM, excessList}) that both the D-13 harness's perturbations AND every reference shape read, so removal/planting are defined exactly once and every shape inherits the same perturbation semantics."
  - "decideOutcome(archive, opts) as the single, pure, fully-tested function main() delegates its exit-code decision to (0/1/2 contract), so all three exit codes are exercised by synthetic tests without touching the real archive."

requirements-completed: []  # SEG-06's disposition is set by plan 33-13 alone, per this plan's own requirement-tick-safety text; this SUMMARY documents evidence only.

# Metrics
duration: ~40min
completed: 2026-09-21
---

# Phase 33 Plan 14: D-07 severity-tier calibration, non-self-referential derivation (D-16) Summary

**Closed plan 33-08's HALT by re-deriving D-07's severity cut from a reference population disjoint from the flagged cohort (four pre-declared shapes R1..R4, first-clearing order) — shape R1 ("accumulated ordinary step noise") cleared D-13 insensitivity first, its D-07 anchor check passed, and `UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = 0.00423` now ships from `33-CALIBRATION.md`, pinned by a two-directional equality guard.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 4 (all executed; no HALT branch taken — a shape cleared and the anchor check passed)
- **Files modified:** 5 (2 generator files, 2 pace-quality files, 1 calibration artifact)

## Accomplishments

- `buildBaseViews`/`buildRemovedViews`/`buildPlantedViews`: the `{id, steps, totalDistanceM, excessList}` view shape and its two D-13 perturbations, mirroring Phase 32's `insensitivityCheck` mechanics restated over views
- `shapeR1`..`shapeR4`: the four pre-declared reference shapes, each reading ordinary folded covered steps and per-activity distances over ALL computable activities — never the flagged cohort's own excess-fraction population
- `PREDECLARED_SHAPES` (frozen, order R1→R2→R3→R4) and `REJECTED_SHAPES`, carrying the plan's own prose so the artifact's text is generated, never hand-written
- `strawmanFromViews`/`evaluateShape`: the step-level D-13 two-direction check, with a permanent negative control (the strawman verdict FAIL on a synthetic bulk-dominated archive where the same `evaluateShape` lets R3 PASS)
- `selectShape`, `ceilToSignificant`, `formatShippedConstant`, `classifyActivityTier`, `anchorCheck`, `runShapeArbitration`, `decideOutcome`: first-clearing arbitration (anti-quota, structurally verified by reading `selectShape`'s own source text), direction-safe 3-s.f. rounding, tiering, the D-07 anchor check, and the full 0/1/2 exit-code contract
- `renderCalibrationMarkdown` reworked end to end: `## Statistic`, `## Pre-declared reference shapes (D-16)`, `## Non-circularity`, `## Strawman watched failing (D-13 harness)`, `## Shape arbitration (D-13 insensitivity)`, `## Chosen constant` / `## NO SHAPE CLEARS`, `## D-07 anchor check`, `## Archive-wide severe/minor/none distribution`, `## Recorded negative finding — outer percentiles of the flagged cohort (plan 33-08)` (33-08's own table demoted to `###` subsections, computed live by its untouched functions), `## Inputs` (content-addressed provenance via `gitId`)
- `UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = 0.00423` shipped in `src/analytics/pace-quality.ts`, docblock quoting the artifact's raw value, both D-13 deltas, 33-08's negative finding, the anti-quota rule, and D-07's rejected alternative
- `pace-quality.test.ts`'s "shipped from 33-CALIBRATION" equality guard: parses the artifact's one line-anchored Chosen-constant line, asserts numeric equality AND character-for-character equality against the production SOURCE-TEXT literal
- 81 tests in the generator's test file, up from 33-08's 19 (+29 Task 1 reference-shape/D-13-harness tests, +29 Task 2 arbitration/rounding/tiering/anchor/exit-code tests, +4 Task 4 named-activity tiering cases); 88 tests in `pace-quality.test.ts`, up from 87 (+1 the equality guard); full suite 93 files / 3023 tests, up from the session's 93/2960 baseline (+63)

## Task Commits

1. **Task 1: Perturbation views, the four pre-declared reference shapes and the step-level D-13 harness** - `548628b7` (feat)
2. **Task 2: First-clearing arbitration, direction-safe rounding, generated prose, and the exit-code contract** - `1d618c4c` (feat)
3. **Task 3: Run the calibration — strawman RED first, then first-clearing arbitration** - `6c622743` (feat, includes a Rule 1 deviation)
4. **Task 4: Ship the constant FROM the artifact, with the equality guard watched failing from both sides** - `739118ca` (feat)

_No separate plan-metadata commit — sequential single-agent execution on the primary checkout; the orchestrator owns STATE.md/ROADMAP.md/REQUIREMENTS.md per this plan's own instructions and this session's explicit constraint against touching them._

## Files Created/Modified

- `scripts/compute-unreliable-segment-severity-calibration.mjs` — extended with the view-shape harness, four reference shapes, arbitration, rounding, tiering, anchor check, exit-code contract, and a fully reworked `renderCalibrationMarkdown`/`main()`; every 33-08 function kept verbatim
- `scripts/compute-unreliable-segment-severity-calibration.test.mjs` — 19 (33-08) → 81 tests: reference shapes, D-13 harness (build/remove/plant, CAN PASS/CAN FAIL), arbitration, rounding, tiering, anchor check, exit-code contract, and four named-activity tiering cases (reads exactly four real stream files)
- `src/analytics/pace-quality.ts` — `UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = 0.00423` with a house-style docblock beside `GAP_PROFILE_SEVERE_FRACTION`
- `src/analytics/pace-quality.test.ts` — the "shipped from 33-CALIBRATION" equality guard
- `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-CALIBRATION.md` — regenerated: Chosen constant, D-07 anchor check, archive-wide finding, 33-08's negative finding preserved

## Verification Evidence

**Strawman watched FAILING first, in the new harness, before any shape row was read** (quoted from the artifact and console output):
`removedDelta —` (null — removal empties the flagged population's `excessList` entirely, the null-is-FAIL rule), `plantedDelta 5.4877%`, both against the 1% tolerance. Its base (`0.035713802737883264`) was asserted at runtime to equal 33-08's legacy q=0.99 cut exactly — confirmed true (same value, same population, same quantile) before any shape row was trusted.

**Full arbitration table** (every shape R1..R4, raw cut / removedDelta / plantedDelta / verdict, even for shapes after the winner):

| id | n | base (raw) | removedDelta | plantedDelta | Verdict |
|---|---|---|---|---|---|
| R1 | 1873 | 0.004229423790775019 | 0.2848% | 0.5081% | **PASS — selected** |
| R2 | 1873 | 0.0022731775591322426 | 0.2983% | 0.1709% | PASS (not selected — R1 came first) |
| R3 | 1873 | 0.0016900333463568899 | 0.0300% | 0.0159% | PASS (not selected) |
| R4 | 1873 | 0.010626311820238604 | 0.0300% | 0.0159% | PASS (not selected) |

Non-vacuity facts (asserted before any delta was trusted): removed step count 2164; planted count 1344 (= detected segment count 1344, archive-wide); source burst shape count 25 (from 3475724402); activities whose `totalDistanceM` changed under removal 699 / under planting 1344.

**Winning shape and shipped constant:** R1 ("accumulated ordinary step noise"). Raw 0.004229423790775019, rounded UP to 3 significant figures → **0.00423**, shipped character-for-character as `UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = 0.00423` in `src/analytics/pace-quality.ts`.

**D-07 anchor check — PASS on the first attempt (no fallback needed):**

| id | segments | excess (m) | own distance (m) | fraction | tier |
|---|---|---|---|---|---|
| 3475734189 | 1 | 122.70 | 6830.3 | 0.017964 | **severe** (required) |
| 10146303423 | 0 | 0.00 | 7096.6 | 0.000000 | **none** (required) |
| 3475724402 (finding) | 16 | 0.00 | 13424.7 | 0.000000 | minor |
| 3475740390 (finding) | 5 | 55.95 | 10571.1 | 0.005293 | severe |

**Named activities' tiers, restated:** 3475734189 severe (fraction 0.017964, well above the 0.00423 cut); 10146303423 none (clean control, zero segments); 3475724402 minor (fraction exactly 0 — every one of its 16 segments clamped to zero excess by gap dilution, a finding, not an anchor requirement); 3475740390 severe (fraction 0.005293, N=5 cross-segment summation: 55.95 m / 10571.1 m).

**Archive-wide severe rate — a reported FINDING, never an input to selection:** at cut 0.00423, **severe 136**, minor 563, none 1175, not-computable 0, of 1874 activities (7.26% severe).

**Byte-identity / idempotence:**
- `33-CALIBRATION.md`: regenerated → committed → regenerated TWICE more (post-Task-3 and post-Task-4-ship) → `git diff --exit-code` clean against the committed file each time.
- `32-CALIBRATION.md`: regenerated, `git diff --exit-code` clean (no detection-outcome change from this plan).
- `33-COVERAGE-IDENTITY.md`: regenerated, `git diff --exit-code` clean.
- `data/streams`: `git status --porcelain` empty throughout all four tasks.

**Full-suite counts:**
- `scripts/compute-unreliable-segment-severity-calibration.test.mjs`: 81/81 passed (19 from 33-08 unedited + 29 Task 1 + Task 2 render/arbitration additions + 4 Task 4 named-activity cases); `-t "reference shape"` matched 18; `-t "D-13 harness"` matched 7; `-t "shape arbitration"` matched 31.
- `src/analytics/pace-quality.test.ts`: 88/88 passed; `-t "shipped from 33-CALIBRATION"` matched 1.
- `src/analytics/pace-single-source.test.ts`: 84/84 passed, 200 `.ts` files scanned; `grep -c 'unreliable-segments' src/analytics/pace-quality.ts` = 0.
- `npx tsc --noEmit`: clean. `npm run build`: clean.
- Full `npm test`: **93 files / 3023 tests**, all green (+63 over this session's 93/2960 baseline — 62 new tests in the generator's file, 1 new test in `pace-quality.test.ts`).
- `npm run compute-unreliable-segment-severity-calibration`: exits **0** (twice, unpiped, `git diff --exit-code` clean on the artifact both times).

**Seeded mutations, both watched RED then reverted clean (`git diff --exit-code` proof after each):**
- **Order pin (Task 2):** swapped the `id` labels of `PREDECLARED_SHAPES[0]`/`[1]` (R1↔R2) — the literal-order test failed verbatim (`expected [ 'R2', 'R1', 'R3', 'R4' ] to deeply equal [ 'R1', 'R2', 'R3', 'R4' ]`); reverted via `git checkout --`; `git diff --exit-code` clean; test re-passed.
- **M1 (production side, Task 4):** bumped the shipped constant's last digit (0.00423 → 0.00424) — `-t "shipped from 33-CALIBRATION"` failed (`AssertionError: expected 0.00423 to be 0.00424`); the generator, built and run, reported exit code **2** and `Shipped value equal: no`; reverted via `git checkout --`, rebuilt, regenerated; `git diff --exit-code` clean on both `pace-quality.ts` and the artifact.
- **M2 (artifact side, Task 4):** hand-edited the artifact's Chosen-constant line to `0.00499` — the same filter failed (`AssertionError: expected 0.00499 to be 0.00423`); the GENERATOR (not `git checkout`) restored the line to `0.00423` on the next run; `git diff --exit-code` clean on the artifact.

## Decisions Made

- Followed the plan's fixed shape list, order, percentile orders, tolerance and selection rule exactly as written — no shape was reordered, added, or re-parameterised after seeing a delta.
- Shipped from R1 as the first-clearing shape; did not consult the archive-wide severe rate, a named activity, or any count before or during selection.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added the missing D-13 strawman-equals-legacy-cut runtime assertion**
- **Found during:** Task 3 (running the calibration for the first time)
- **Issue:** 33-14-PLAN.md's `<d13_harness>` block requires: "Its BASE value must equal 33-08's legacy q=0.99 cut exactly (same population, same quantile) — assert it; a mismatch means the views are wrong." Task 2's `main()` computed both values and printed the new one, but never asserted the equality.
- **Fix:** Added `assert.strictEqual(arbitration.strawman.base, strawman.base, ...)` in `main()`, placed before the markdown is rendered. Verified it holds on the real archive (both `0.035713802737883264`) — a silent pass would have meant a bug went unnoticed, not that the check was unnecessary.
- **Files modified:** `scripts/compute-unreliable-segment-severity-calibration.mjs`
- **Verification:** `node scripts/compute-unreliable-segment-severity-calibration.mjs` still exits with the same code and output after the addition; full test file still 77/77 (pre-Task-4 count) green.
- **Committed in:** `6c622743` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Closes a real gap between the plan's own written contract and the implementation; no scope creep — the fix is exactly the assertion the plan's text already specified.

## Issues Encountered

- The sandboxed shell environment renders vitest's coloured output even when piped through `tee` (an ANSI-escape-code artifact of this specific terminal, unrelated to the plan or the code) — `grep -qE 'Tests +[1-9][0-9]* passed'` against the raw piped output intermittently failed to match because colour codes sit between "Tests" and the digit. Worked around locally by exporting `NO_COLOR=1` for all verification commands in this session; not a defect in any committed file, and every verification below reflects the real (uncoloured) test counts.

## Next Phase Readiness

- SEG-06's constant now exists at `src/analytics/pace-quality.ts`'s `UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION`, under the exact name, file, and character-identical value plan 33-09 Task 2 step 1 expects — 33-09 needs no edit to consume it; its step 1 is satisfied by this export.
- Plan 33-13 alone still sets SEG-06/PACE-08/PACE-09/COV-03's actual REQUIREMENTS.md disposition, per this plan's own requirement-tick-safety text — nothing here is ticked.
- Orchestrator note (per 33-07-SUMMARY.md's own addendum, restated here): plan 33-12 regenerates this artifact AFTER the MERGE-01 merge. If the archive has moved enough by then to change R1's 3-significant-figure value, the generator will exit 2 and the "shipped from 33-CALIBRATION" guard will go RED **by design** — that is a developer decision (re-ship from the new artifact, recorded as such), never a silent re-tune and never a hand-edit of either side.
- `data/streams/`, `.planning/STATE.md`, `.planning/ROADMAP.md`, and `.planning/REQUIREMENTS.md` are untouched by every commit in this plan (`git diff --stat` against each, from the base commit, is empty).

---
*Phase: 33-coverage-integration-pace-clipping-segment-signal*
*Completed: 2026-09-21*
