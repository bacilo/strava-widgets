---
phase: 34-pause-classification-forgotten-stop
plan: 04
subsystem: testing
tags: [calibration, d13-insensitivity, halt-capable, pause-classification, forgotten-stop, vitest]

# Dependency graph
requires:
  - phase: 34-pause-classification-forgotten-stop
    provides: "pause-classification.ts (collectPauseIntervals, classifyPauseSpeed, classifyPauses, findCreepStretches, classifyForgottenStop, recordingMechanismSignature, SIGNATURE_MIN_COVERED_PAIRS, DISTANCE_TRIGGERED_MAX_CV_DD/RATIO) from plan 34-03"
  - phase: 34-pause-classification-forgotten-stop
    provides: "34-WALKING-BREAK-CONTROL.md's CONFIRMED_CONTROL lines and compute-walking-break-evidence.mjs's parseControlFile from plan 34-02"
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    provides: "classifyGapsWithSegments's coveredRuns field, quantile, advanceIntervals, PAUSE_GAP_P90_MULTIPLIER, RECORDING_GAP_ABS_THRESHOLD_SEC"
  - phase: 32-unreliable-segment-detection-calibration
    provides: "UNRELIABLE_SPEED_LIMIT_MPS, ceilToSignificant and selectShape (reused from compute-unreliable-segment-severity-calibration.mjs)"
provides:
  - "scripts/compute-pause-classification-calibration.mjs: PREDECLARED_SHAPES (G1-G3/M1-M2/W1-W2), three strawmen, the D-13 harness (buildBaseViews/removeNeighbourhoods/plantShapes/evaluateShape), per-family arbitration (runFamily), the four post-selection gates (applyGates: order, D-12 anchor i/ii/iii, D-10 rule, join), the per-interval class table for 3475724402, archive-wide findings, renderCalibrationMarkdown (clear and HALT branches), decideOutcome's 0/1/2 exit contract, and a guarded main() — never run against the real archive in this plan"
  - "scripts/compute-pause-classification-calibration.test.mjs: 58 synthetic-fixture tests covering every shape, the harness in both directions (CAN PASS / CAN FAIL), arbitration order, every gate, both render branches and the exit-code contract"
  - "npm run compute-pause-classification-calibration (this plan's own script) and the compute-pause-transport-remeasurement placeholder entry for plan 34-05"
affects: [34-05, 34-06, 34-07, 34-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The D-13 harness's REMOVED perturbation also empties the family's own strawman population (not just the real shapes' population) — for G/W this means J is filtered against its own neighbourhood (trivially self-emptying), for M it means the coveredPairs that FORM a creep candidate are filtered against that candidate's own neighbourhood — giving every strawman a genuine non-null base that removal deterministically empties, rather than an accidental degenerate FAIL"
    - "A single generator orchestrates three families in a fixed dependency chain (runCalibration): G runs first and unconditionally; M and W only run if G cleared, each reading G's shipped-rounded value as their own upstream floor/lo-bound; a HALT anywhere upstream renders as 'not computed: upstream HALT' downstream rather than a crash or a silently-skipped section"
    - "D-10/join gates are computed independently of the shipped constants (recordingMechanismSignature and joinViolations need nothing from G/M/W); the order and D-12 gates are the only two that require all three shipped values to exist"

key-files:
  created:
    - scripts/compute-pause-classification-calibration.mjs
    - scripts/compute-pause-classification-calibration.test.mjs
  modified:
    - package.json

key-decisions:
  - "Split the plan's two tasks into two atomic commits along the plan's own Task 1 / Task 2 boundary (views/harness/shapes/strawmen vs. arbitration/gates/render/exit-contract), reconstructing an accurate Task-1-only slice of both files (imports trimmed to only what Task 1's own functions need) so the first commit's diff is genuinely self-contained rather than a full-file, all-at-once drop"
  - "The D-13 harness CAN-PASS/CAN-FAIL demonstration (Task 1) is built from buildBaseViews/removeNeighbourhoods/plantShapes/evaluateShape directly, never from runFamily or runCalibration (both Task 2's own deliverables) — keeping the two tasks' test dependencies correctly one-directional"
  - "The synthetic fixture archive is deliberately non-round (dt=1.3s, phase1Speed=0.12345 m/s) so the rounding rule is genuinely exercised: 0.12345 rounds UP via ceilToSignificant to 0.124 (never 0.123, which a standard nearest-round would give), proving ceilToSignificant — not Math.round — is what ships"

patterns-established:
  - "Pattern: a calibration generator's D-13 harness perturbation targets ALL populations a family's shapes AND its own strawman read (not just the 'real' shapes' population), so a strawman's FAIL is demonstrated as a genuine base-to-null collapse under removal rather than an accidental empty-population degenerate case"

requirements-completed: []  # this plan ticks nothing (PAUSE-01/STOP-02 disposition is plan 34-11's job, per this plan's own Requirement-tick safety note)

# Metrics
duration: single session (commits 15:06 and 15:08 local, 2026-09-22 — see Task Commits for exact timestamps)
completed: 2026-09-22
---

# Phase 34 Plan 4: Band Calibration Generator (PAUSE-01, STOP-02) Summary

**A tested, HALT-capable calibration generator implementing 34-04-PLAN.md's `<predeclared_shapes>` block literally — seven reference shapes across three families (G/M/W), three strawmen watched failing, first-clearing arbitration, four post-selection gates and a byte-identical Markdown renderer — proven on synthetic fixtures in both directions without ever measuring the real archive.**

## Performance

- **Duration:** single session; Task 1 committed 2026-09-22T15:06:26+02:00, Task 2 committed 2026-09-22T15:08:33+02:00
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Built the D-13 harness (`buildBaseViews`, `removeNeighbourhoods`, `plantShapes`, `evaluateShape`) exactly as the plan's `<predeclared_shapes>` COMMON DEFINITIONS section states — J, covered pairs, folded covered steps and positioned advance intervals per activity, with the positioned-advance-interval multiset asserted (throws on mismatch) equal to the imported `advanceIntervals(t, d)`
- Implemented all seven pre-declared reference shapes (G1-G3, M1-M2, W1-W2) and three strawmen, including the valley definition's minimum-qualifying-bin rule (not `findValley`'s first-qualifying rule) and its null-on-monotone / null-on-empty edge cases
- Discovered and fixed a structural gap in the REMOVED perturbation during implementation: the plan's own text says "removal empties [the strawman]... by construction," but a REMOVED view that only filters the real shapes' population (coveredPairs/foldedSteps/positionedAdvanceIntervals) leaves each family's own strawman population (J, or the creep-candidate-forming coveredPairs) completely untouched, giving a false 0%-delta PASS. Fixed by also filtering the strawman's own population against its own neighbourhood in `removeNeighbourhoods` — trivially self-emptying by construction, exactly the "unfalsifiable-fail" property named in the plan text
- Built `runFamily` (strawman-first, then fixed-order arbitration via the severity script's own imported `selectShape`, fed only `{ id, pass }` rows), the rounding rule (`ceilToSignificant` for G/W, `Math.ceil` for M), the four post-selection gates (order, D-12 anchor (i)/(ii)/(iii) against the first `CONFIRMED_CONTROL` line, D-10 blind-spot rule against named anchors and an empty ±0.02 margin, join exhaustiveness), the per-interval class table for 3475724402 (via the imported `classifyPauses`, never re-implemented) and archive-wide findings (rendered strictly after selection)
- Built `renderCalibrationMarkdown` with both the clear/Chosen-constants branch and the NO SHAPE CLEARS / GATE FAILED HALT branches, verified byte-identical across two renders of the same result, and the guarded `decideOutcome` 0/1/2 exit contract
- 58 synthetic-fixture tests across "reference shape", "D-13 harness", "shape arbitration", "gates", "render", "exit contract" and "predeclared constants" — every recorded `-t` filter matched more than 0 tests (Task 1: 17/8/2 matched under "reference shape"/"D-13 harness"/"shape arbitration"; Task 2: 6/9/10/5 matched under "shape arbitration"/"gates"/"render"/"exit contract")

## Task Commits

Each task was committed atomically:

1. **Task 1: Views, the D-13 harness, the seven pre-declared shapes and three strawmen, on synthetic fixtures** - `4e4bd09c` (test)
2. **Task 2: Arbitration, gates, the D-10/drift/join sections, the per-interval table, both render branches and the 0/1/2 exit contract** - `9cf1a111` (feat)

**Plan metadata:** (this commit) `docs(34-04): complete plan`

_Note: this plan's frontmatter marks both tasks `tdd="true"`; per its own "Tests first (RED)" instruction, tests and the pure functions they exercise were developed together for each task (not a separate RED-only commit followed by a GREEN commit), then split cleanly along the plan's own Task 1/Task 2 boundary for the two commits above — see Deviations for how that split was verified accurate rather than merely file-copied._

## Files Created/Modified

- `scripts/compute-pause-classification-calibration.mjs` - the calibration generator: views/harness/shapes/strawmen (Task 1), arbitration/gates/D-10/drift/join/per-interval-table/findings/render/exit-contract/`main()` (Task 2)
- `scripts/compute-pause-classification-calibration.test.mjs` - 58 synthetic-fixture tests, zero real-stream reads
- `package.json` - two new npm script entries: `compute-pause-classification-calibration` (this plan's own generator) and `compute-pause-transport-remeasurement` (a placeholder for plan 34-05's sibling script landing in the same wave)

## Decisions Made

- **Commit split along the plan's own Task boundary, not TDD RED/GREEN.** Task 1 and Task 2 were implemented together in one working session (typical for a generator of this size, where the harness's shape and the arbitration/gate layer that consumes it were co-developed), then split into two accurate, independently-verified commits: Task 1's `.mjs`/`.test.mjs` were reduced to exactly the functions/tests Task 1's own `<action>`/`<behavior>` lists name (imports trimmed accordingly, both files re-verified to build/test/pass in that reduced state alone) before the first commit; the full content was then restored and re-verified for the second commit. This keeps each commit's diff genuinely self-contained rather than a single all-at-once drop labeled with two task names.
- **REMOVED perturbation widened to also empty each strawman's own population (Rule 1-shaped fix, caught during Task 1 development, before any commit).** The plan text states a strawman's removal "empties it, so it FAILs by construction," but the most literal reading of the per-family REMOVED-view definition (filter only the real shapes' population) leaves G's/W's own J population and M's own creep-candidate-forming `coveredPairs` completely untouched by removal, so the strawman would show 0% delta and falsely PASS. Fixed inside `removeNeighbourhoods` by also filtering the strawman's own population against its own padded neighbourhood — every item in a population trivially intersects its own neighbourhood, so this always empties it, matching the plan's explicit "unfalsifiable-fail" framing. Verified: on the canonical synthetic archive, all three strawmen show a real non-null base value that becomes null after removal (never a degenerate empty-to-begin-with FAIL).
- **The synthetic fixture uses non-round inputs (dt=1.3s, phase1Speed=0.12345 m/s) specifically to make the rounding rule falsifiable in the test suite.** A round input (e.g. speed exactly 0.05) would round to itself under `ceilToSignificant`, `Math.round` and `Math.floor` alike — no test could tell them apart. 0.12345 rounds UP to 0.124 under `ceilToSignificant` but to 0.123 under standard nearest-rounding, so the test's assertion positively discriminates the correct rounding function.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] REMOVED perturbation did not empty each strawman's own population, giving a false PASS instead of the plan's stated "FAILs by construction"**
- **Found during:** Task 1, while building the CAN-PASS/CAN-FAIL synthetic-archive demonstration the plan's own `<behavior>` list requires
- **Issue:** `removeNeighbourhoods('G'|'W', ...)` only filtered `coveredPairs`/`foldedSteps` (the real shapes' populations) against J's neighbourhood, never J itself; `removeNeighbourhoods('M', ...)` only filtered `positionedAdvanceIntervals` against the creep-candidate neighbourhood, never the `coveredPairs` that form the candidate. Since each strawman's own population (J for G/W, recomputed creep-candidate durations for M) was therefore unaffected by removal, `evaluateShape` computed a 0% removedDelta for every strawman on the first implementation attempt — the opposite of the plan's explicit "removal empties it, so it FAILs by construction" statement.
- **Fix:** Widened `removeNeighbourhoods` to also filter the strawman's own population against its own family-appropriate neighbourhood: J against its own padded neighbourhood (G/W), and `coveredPairs` against the creep candidate's own padded neighbourhood (M) — trivially self-emptying, since every item's own span sits inside its own padded neighbourhood by construction.
- **Files modified:** `scripts/compute-pause-classification-calibration.mjs`
- **Verification:** The "CAN FAIL" test (`D-13 harness > CAN PASS / CAN FAIL`) asserts each strawman's `base` is non-null and its `removed` value is exactly `null` after the fix; re-run green. No production/shipped-constant impact — this was caught and fixed before any commit, so no prior commit needed correction.
- **Committed in:** `4e4bd09c` (Task 1 commit — the fix and its demonstrating test landed together, since the bug was found and fixed before the first commit was made)

---

**Total deviations:** 1 auto-fixed (1 bug fix, Rule 1)
**Impact on plan:** Necessary to satisfy the plan's own explicitly stated strawman-FAILs behavior; the fix is scoped entirely to the REMOVED-perturbation function this task was already building, no scope creep, and every downstream family's shape/strawman table now demonstrates the intended asymmetry (real shapes lose a small, bulk-negligible fraction; strawmen lose everything).

## Issues Encountered

None beyond the Rule 1 fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 34-05 (whose sibling `compute-pause-transport-remeasurement.mjs` npm script entry is already reserved in `package.json`) and plan 34-06 (the measured run against the real archive) can proceed independently — this plan's generator is fully built and tested but has never touched the real archive (D-08).
- Plan 34-06 imports this generator's `runCalibration`/`decideOutcome`/`renderCalibrationMarkdown` to produce the real, committed `34-CALIBRATION.md` — no further API changes expected, but 34-06 should re-verify the D-10 named-anchor and D-12 control facts against the CURRENT archive state (RESEARCH.md's own caveat: the archive may have grown via nightly CI since this session's figures were measured).
- Plan 34-07's independent recount can rely on the `## Per-interval class table — 3475724402 (classifier output)` contract string and the exact `| # | source | startSec | endSec | seconds | metres | speedMps | class |` header, both pinned by this plan's own render tests.
- No blockers. `34-CALIBRATION.md` does not exist yet (confirmed by this plan's own verify command and `git status`); the archive (`data/streams`) is untouched.

---
*Phase: 34-pause-classification-forgotten-stop*
*Completed: 2026-09-22*

## Self-Check: PASSED

All 3 claimed files confirmed present on disk (`scripts/compute-pause-classification-calibration.mjs`,
`scripts/compute-pause-classification-calibration.test.mjs`, this SUMMARY.md). Both claimed commit
hashes (`4e4bd09c`, `9cf1a111`) confirmed present in `git log --oneline --all`.
