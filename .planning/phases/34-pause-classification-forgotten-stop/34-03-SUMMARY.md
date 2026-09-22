---
phase: 34-pause-classification-forgotten-stop
plan: 03
subsystem: analytics
tags: [pace-derivation, unreliable-segments, pause-classification, forgotten-stop, single-source-audit, vitest]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration
    provides: "detectUnreliableSegments, UnreliableSegment, SegmentMechanism, UNRELIABLE_SPEED_LIMIT_MPS"
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    provides: "classifyGapsWithSegments returning { coverage, segments }, GapInterval, PaceCoverage, the pace-single-source.test.ts audit infrastructure"
provides:
  - "pace-derivation.ts value re-export of UNRELIABLE_SPEED_LIMIT_MPS (D-05's one door)"
  - "pace-derivation.ts CoveredRun type and classifyGapsWithSegments's additive coveredRuns field"
  - "src/analytics/pause-classification.ts: joinUnreliableIntervals, collectPauseIntervals, isTransported, classifyPauseSpeed, classifyPauses, recordingMechanismSignature, findCreepStretches, classifyForgottenStop"
  - "pace-single-source.test.ts extended with the Phase 34 half of SEG-05b (load-bearing proof), the D-05 no-literal guard, and the classifier's own call-site confinement"
affects: [34-04-band-calibration, 34-06-drift-calibration, 34-08-pace-quality-wiring, 34-09-detail-view-disclosure, 34-10-recount, 35-stream-derived-pace, 36-best-effort-partitioning, 37-review-queue]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Value re-export through pace-derivation.ts as the one door a downstream constant reaches consumers by (D-05), alongside the pre-existing type re-export"
    - "Index-based CoveredRun field derived from the SAME final pairKinds array accumulateCoverage already sums — no second boundary convention, mirroring 32-13/32-17's fixed defect"
    - "Sorted two-pointer mechanism-lookup join between a merged GapInterval list and a raw UnreliableSegment list, counting violations in both directions rather than assuming a 1:1 boundary match"
    - "A pure leaf classifier module that imports ONLY a detector-facing module's re-exports, never the detector itself — extending the existing 'ONE permitted importer' discipline one hop further downstream"
    - "Per-CoveredRun sliding-window union (two-pointer, O(n) per run) for a sustained near-zero-speed detector that structurally cannot cross a covered-run boundary"
    - "A recording-mechanism (distance-triggered vs time-triggered) signature gate that short-circuits a downstream flag's computability without ever touching the flag's own band/threshold logic (Pitfall 5 non-circularity)"

key-files:
  created:
    - src/analytics/pause-classification.ts
    - src/analytics/pause-classification.test.ts
  modified:
    - src/analytics/pace-derivation.ts
    - src/analytics/pace-derivation.test.ts
    - src/analytics/pace-single-source.test.ts

key-decisions:
  - "D-01: only gap-bearing intervals (recording-gap, gap-adjacent merged segments, zero-advance pauses) are speed-classified; hidden-pause/isolated-jump segments are not-classifiable, counted but never listed"
  - "D-02: four-class ladder (stationary/walked/ran-through/transported), inclusive at both lower rungs, inclusive at the ran-through/transported boundary using UNRELIABLE_SPEED_LIMIT_MPS exactly, strict above it"
  - "D-03: no duration floor anywhere in the classifier — a 12s recording gap is classified exactly like a longer one"
  - "D-05: UNRELIABLE_SPEED_LIMIT_MPS reaches pause-classification.ts through a NEW value re-export in pace-derivation.ts, never a copied literal; verified by a permanent, watched-failing single-source audit guard"
  - "D-09/D-10: classifyForgottenStop checks the D-10 recording-mechanism signature FIRST; a distance-triggered stream (3475740390) or one with fewer than 30 signature pairs returns not-computable with a stated reason before either forgotten-stop source is computed"

patterns-established:
  - "Pattern: additive fields on an existing shared classifier's return object (coveredRuns) rather than a second, parallel computation of covered-time membership"
  - "Pattern: a downstream leaf module's own single-source-audit extension (no-literal guard + call-site confinement) ships in the SAME plan as the module itself, not deferred to the wiring phase"

requirements-completed: []  # 34-03 ticks nothing (plan's own Requirement-tick safety note); PAUSE-01/STOP-01 disposition is plan 34-11's job

# Metrics
duration: ~24min
completed: 2026-09-22
---

# Phase 34 Plan 03: Pause Classifier & Forgotten-Stop Core Summary

**Pure `pause-classification.ts` leaf module (mechanism join, D-02's four-class speed ladder, D-10's distance-triggered blind-spot signature, and the forgotten-stop core) that reads `pace-derivation.ts`'s merged detector output — never re-deriving it — proven load-bearing and structurally audit-guarded.**

## Performance

- **Duration:** ~24 min (commit span 13:06:55 -> 13:30:05 local)
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `pace-derivation.ts` gained a value re-export of `UNRELIABLE_SPEED_LIMIT_MPS` (D-05's one door) and an additive, index-based `coveredRuns: CoveredRun[]` field on `classifyGapsWithSegments`, derived from the same final `pairKinds` array `accumulateCoverage` already sums — zero second boundary convention, zero existing output moved (32-CALIBRATION.md and 33-COVERAGE-IDENTITY.md both regenerated byte-identically).
- New pure leaf module `src/analytics/pause-classification.ts`: an exhaustive sorted two-pointer mechanism-lookup join (`joinUnreliableIntervals`), gap-bearing interval collection (`collectPauseIntervals`), the D-02 four-class speed ladder (`classifyPauseSpeed`/`isTransported`), composition (`classifyPauses`), the D-10 recording-mechanism signature (`recordingMechanismSignature`), a per-covered-run sliding-window creep detector (`findCreepStretches`), and the signature-gated forgotten-stop core (`classifyForgottenStop`). 34 unit tests, all passing.
- Extended `pace-single-source.test.ts` with the Phase 34 half of SEG-05b's load-bearing proof (stub the detector two modules downstream, both directions asserted in one test), a permanently planted D-05 no-literal guard, and a permanently planted call-site confinement guard for the classifier's own four entry points — 7 new tests, both guards watched failing first against a live mutation, then reverted clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: pace-derivation.ts value re-export + coveredRuns** - `57963d3f` (feat)
2. **Task 2: pause-classification.ts core module + tests** - `417323bf` (feat)
3. **Task 3: single-source audit extension (SEG-05b, D-05, confinement)** - `cfb6baea` (test)

_No separate plan-metadata commit — this worktree agent does not update STATE.md/ROADMAP.md per the orchestrator's ownership boundary; this SUMMARY.md's own commit closes the plan._

## Files Created/Modified

- `src/analytics/pace-derivation.ts` - value re-export of `UNRELIABLE_SPEED_LIMIT_MPS`; new `CoveredRun` interface and `deriveCoveredRuns` helper; `classifyGapsWithSegments` now returns an additive `coveredRuns` field; `classifyPairKinds` gained a `null`/`undefined` `t`/`d` guard (Rule 1, see Deviations)
- `src/analytics/pace-derivation.test.ts` - new `classifyGapsWithSegments coveredRuns (Phase 34)` describe block: a hand-built five-phase fixture, the three-named-activity sum/no-overlap invariant, invalid-input totality, and the `UNRELIABLE_SPEED_LIMIT_MPS` `Object.is` re-export proof
- `src/analytics/pause-classification.ts` (NEW) - the classifier and forgotten-stop core, importing only from `pace-derivation.ts`
- `src/analytics/pause-classification.test.ts` (NEW) - 34 unit tests covering every behavior in the plan's `<behavior>` list
- `src/analytics/pace-single-source.test.ts` - three new describe blocks plus their supporting scanners (`findTransportLiteralViolations`, `findPauseClassificationConfinementViolations`)

## Decisions Made

- **D-01 scope enforcement:** `joinUnreliableIntervals` counts violations in BOTH directions (an `'unreliable'`-kind interval with no contained segment, and a segment inside no interval) via a sorted two-pointer sweep — never a `gapIntervals.some(`/`.find(` re-scan, which the single-source audit already bans. Verified exhaustive (zero violations) on real 3475724402, and verified all five of 3475740390's isolated-jump segments land in `notClassifiableCount`, never `gapAdjacent`.
- **D-02 ladder ordering:** implemented as `isTransported` first (top rung, strict `>`), then the two inclusive lower rungs, then `ran-through` as the residual — matches the plan's exact inclusive/strict wording at every named probe (0.5, 0.51, 2.0, 2.01, exactly `UNRELIABLE_SPEED_LIMIT_MPS`, just above it), verified via `isTransported(m,s) === (classifyPauseSpeed(m,s,bands) === 'transported')` across 12 probes.
- **D-09/D-10 short-circuit ordering:** `classifyForgottenStop` checks `recordingMechanismSignature` before computing either `creep` or `pauses` — confirmed on 3475740390 returning `{ computable: false, reason: NOT_COMPUTABLE_DISTANCE_TRIGGERED }` without ever calling `findCreepStretches`.
- **Metres derivation for merged-segment intervals uses `d[seg.startIndex]` directly** (the field `UnreliableSegment` already carries), never a second `t`-to-index lookup — only raw `GapInterval` boundaries (which carry no index) go through the shared `buildIndexByTime` map.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `classifyPairKinds` threw on a `null`/`undefined` `t` or `d` instead of returning the documented total-function zeroed result**
- **Found during:** Task 1, while designing the coveredRuns "invalid input (null t, mismatched lengths) returns coveredRuns [] and never throws" test the plan's own `<behavior>` list requires
- **Issue:** `classifyPairKinds` (and therefore `classifyGaps`, `classifyGapsThreeWay`, `classifyGapsWithSegments`) called `validateStreamSeries(t, d)` unconditionally; `validateStreamSeries` reads `t.length` with no null guard, so a literal `null` `t`/`d` threw a raw `TypeError` rather than honoring the module's own documented T-26-01 "never throws" guarantee. This is a pre-existing gap in a function this task was already modifying (in-scope, not out-of-bounds per the scope-boundary rule).
- **Fix:** Added `t == null || d == null ||` before the existing `validateStreamSeries` check in `classifyPairKinds`. Purely additive — every other input path is unchanged.
- **Files modified:** `src/analytics/pace-derivation.ts`
- **Verification:** New test `invalid input (null t, mismatched lengths) returns coveredRuns [] and never throws` in `pace-derivation.test.ts`, covering both null `t` and null `d`, passes; full 46-test `pace-derivation.test.ts` suite still green; `tsc --noEmit` clean.
- **Committed in:** `57963d3f` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, Rule 1)
**Impact on plan:** Necessary to satisfy the plan's own explicitly stated behavior requirement for `coveredRuns`' totality; the fix generalizes to every existing caller of `classifyGaps`/`classifyGapsThreeWay`/`classifyGapsWithSegments` for free, strictly improving the module's own documented total-function guarantee. No scope creep — same function, same file, already being modified for Task 1.

## Verification Evidence

### Matched `-t` filter counts (Rule 1 discipline — every filter checked non-zero)

- `pace-derivation.test.ts -t "coveredRuns"` — 4 matched, all passed
- `pause-classification.test.ts -t "classifyPauses"` — 3 matched
- `pause-classification.test.ts -t "join exhaustive"` — 8 matched
- `pause-classification.test.ts -t "recordingMechanismSignature"` — 9 matched
- `pause-classification.test.ts -t "classifyForgottenStop"` — 3 matched
- `pause-classification.test.ts -t "findCreepStretches"` — 3 matched
- `pace-single-source.test.ts -t "pause-classification"` — 7 matched (>= 3 required)

### Full suite (scoped to this plan's touched files, per the worktree environment note)

- `pace-derivation.test.ts`: 46/46 passed
- `pause-classification.test.ts`: 34/34 passed
- `pace-single-source.test.ts`: 91/91 passed (up from 84 pre-plan; scanned-file count unchanged at 202)
- `npx tsc --noEmit`: exit 0
- `npm run build`: exit 0
- `32-CALIBRATION.md`: regenerated, `git diff --exit-code` clean
- `33-COVERAGE-IDENTITY.md`: regenerated, `git diff --exit-code` clean (`scanned=1874 identityViolations=0 recountMismatches=0`)
- `git status --porcelain data/streams`: empty

### Watched-failing proofs (Task 3, both mutations reverted and confirmed `git diff --exit-code` clean before re-running to green)

**(a) Load-bearing test under a join-bypass mutation** — `collectPauseIntervals` temporarily edited to treat every `'unreliable'`-kind interval as a raw gap and bypass `joinUnreliableIntervals` entirely:

```
FAIL  src/analytics/pace-single-source.test.ts > pause-classification reads the detector (SEG-05b, Phase 34 half) > stubbing detectUnreliableSegments to [] on real 3475724402 zeroes merged-segment intervals and changes at least one recording-gap interval's class inside a real merged interval's bounds; the real module gives at least one merged-segment interval
AssertionError: expected 0 to be greater than 0
 > src/analytics/pace-single-source.test.ts:989:40
    987|     );
    988|     const realMergedIntervals = realResult.intervals.filter((iv) => iv…
    989|     expect(realMergedIntervals.length).toBeGreaterThan(0); // reachabi…
       |                                        ^
    990|
    991|     // Stubbed direction: detectUnreliableSegments always returns [], …
```

The mutation broke the REAL direction (not just the stub direction) since bypassing the join removes all merged-segment classification unconditionally — confirming the test is load-bearing on the join actually running, not merely on the stub's mechanics. Reverted; `git diff --exit-code src/analytics/pause-classification.ts` confirmed clean; re-run green (91/91).

**(b) D-05 guard under a planted `7.35` literal** — `const PLANTED_D05_VIOLATION = 7.35;` temporarily added near the top of `pause-classification.ts`:

```
FAIL  src/analytics/pace-single-source.test.ts > pause-classification D-05: no transport-speed literal outside the detector > zero transport-speed-literal offenders exist outside unreliable-segments.ts and *.test.ts files
AssertionError: violations found:
src/analytics/pause-classification.ts: contains "7.35" (1x): expected [ { …(3) } ] to deeply equal []

- Expected
+ Received

- []
+ [
+   {
+     "count": 1,
+     "needle": "7.35",
+     "path": "src/analytics/pause-classification.ts",
+   },
+ ]
```

Reverted; `git diff --exit-code src/analytics/pause-classification.ts` confirmed clean; re-run green (91/91).

## Issues Encountered

None beyond the Rule 1 fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 34-04 (band calibration) and 34-06 (drift calibration) can now import `pause-classification.ts`'s `PauseBands`/`StopParams`-shaped functions and calibrate real values against the band-free `classifyPauseSpeed`/`classifyForgottenStop` contracts shipped here.
- Plan 34-08 (pace-quality.ts wiring) has its exact call-site allowance already reserved in the confinement guard (`pace-quality.ts` pre-allowed, documented inline).
- Plan 34-10 (independent recount) can rely on `classifyGapsWithSegments`'s new `coveredRuns` field and the D-10 signature constants (`DISTANCE_TRIGGERED_MAX_CV_DD`, `DISTANCE_TRIGGERED_MAX_CV_RATIO`, `SIGNATURE_MIN_COVERED_PAIRS`) being stable, exported values.
- No blockers. `TEST_BANDS` used throughout this plan's tests are explicitly synthetic/uncalibrated and must not be treated as the shipped bands by any downstream plan.

---
*Phase: 34-pause-classification-forgotten-stop*
*Completed: 2026-09-22*

## Self-Check: PASSED

All claimed files found on disk (`src/analytics/pace-derivation.ts`, `src/analytics/pace-derivation.test.ts`,
`src/analytics/pause-classification.ts`, `src/analytics/pause-classification.test.ts`,
`src/analytics/pace-single-source.test.ts`). All three claimed commit hashes (`57963d3f`, `417323bf`,
`cfb6baea`) confirmed present in `git log --oneline -5`.
