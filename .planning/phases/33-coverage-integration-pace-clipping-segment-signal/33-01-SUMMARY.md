---
phase: 33-coverage-integration-pace-clipping-segment-signal
plan: 01
subsystem: analytics
tags: [pace-derivation, unreliable-segments, coverage, gap-classification, vitest]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration
    provides: detectUnreliableSegments, DEFAULT_DETECTOR_PARAMS, UnreliableSegment (the calibrated detector this plan wires in)
provides:
  - "classifyGaps widened to a four-way GapKind ('recording-gap' | 'pause' | 'unreliable' | covered), unreliable at the top of the strict-priority tree (D-01)"
  - "classifyGapsThreeWay: the pre-detector recording-gap/pause list, the ONE shape detectUnreliableSegments is ever fed (D-02, D-14)"
  - "PreDetectorGapKind, PreDetectorGapInterval, ThreeWayPaceCoverage exported types"
  - "All four pre-existing detector-input call sites (3 .mjs scripts + 1 .ts test file, a fifth trap found live) repaired to use classifyGapsThreeWay"
  - "Real-stream regression tests proving the reclassification moves real seconds, clips the pace series and histogram, and that the detector import is load-bearing in both directions (D-15)"
affects: [33-02, 33-03, 33-04, 33-05, 33-06, 33-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-pass classification (classifyPairKinds -> accumulateCoverage x2) replacing a single loop, with one shared kind-count-agnostic accumulator reused by both classifyGaps and classifyGapsThreeWay"
    - "Index-based segment containment (seg.startIndex/endIndex), never startSec/endSec float comparison, to avoid a second boundary convention (32-13/32-17 precedent)"
    - "vi.doMock + fresh dynamic import() for module-level load-bearing proofs in a file with no prior static import of the target module"

key-files:
  created: []
  modified:
    - src/analytics/pace-derivation.ts
    - src/analytics/pace-derivation.test.ts
    - src/analytics/pace-single-source.test.ts
    - scripts/unreliable-segment-recount-crosscheck.test.mjs
    - scripts/compute-unreliable-segment-calibration.mjs
    - scripts/validate-unreliable-segments-1hz.mjs
    - src/analytics/unreliable-segments.test.ts
    - src/dashboard/views/detail-charts-logic.test.ts
    - src/dashboard/views/detail-sections.test.ts

key-decisions:
  - "D-01/D-02/D-14 implemented as specified: unreliable is the top-priority GapKind, lands in the same gapIntervals array, classifyGapsThreeWay is the one pre-detector gap shape"
  - "A fifth silent-inheritance trap found live: src/analytics/unreliable-segments.test.ts (not named in the plan's file list) fed classifyGaps(t,d).gapIntervals into detectUnreliableSegments at 7 sites — repaired identically to the plan's own three .mjs fixes (Rule 3, required for npm test green)"
  - "Five pre-existing pace-derivation.test.ts assertions and one detail-sections.test.ts caption assertion updated to the measured post-widening reality rather than left red (Rule 1) — all are real, measured consequences of D-01, not fudged expectations"
  - "detail-charts-logic.test.ts's synthetic burst-speed fixture lowered from 10 m/s to 6 m/s (below the detector's 7.35 m/s calibrated limit) to decouple an unrelated Δt-weighting test from Phase 33's detector"

patterns-established:
  - "A widened shared-classifier type change is a blocking-issue class of its own: every real-stream fixture across the whole suite must be re-measured, not just the plan's own declared files"

requirements-completed: []  # This plan's own text (D-15/requirement-tick safety) forbids ticking PACE-08/SEG-06/PACE-09/COV-03 here; plan 33-13 alone sets their disposition.

# Metrics
duration: ~30min
completed: 2026-09-21
---

# Phase 33 Plan 1: Four-way classifyGaps, pre-detector seam & real-stream reclassification proofs Summary

**Wired `detectUnreliableSegments` into `classifyGaps` as a fourth top-priority `GapKind`, exposed the pre-detector three-way gap list as `classifyGapsThreeWay`, repaired all four (not three) detector-input call sites the widening made circular, and proved on real committed streams that the reclassification moves real seconds and that the detector import is load-bearing in both directions.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 9 (6 in the plan's own declared scope, 3 additional test files fixed under Rule 1/3 to keep `npm test` green)

## Accomplishments

- `classifyGaps` is now a four-way classifier (`recording-gap` / `pause` / `unreliable` / covered), `unreliable` outranking the other two, decomposed into a `classifyPairKinds` pass and one shared `accumulateCoverage` arithmetic function reused three times across the module — no second copy of the classification logic anywhere
- `classifyGapsThreeWay` exposes the pre-detector gap list — the one shape the detector is ever fed — closing the circularity trap where `classifyGaps(...).gapIntervals` (now post-detector) could otherwise be fed back into `detectUnreliableSegments`
- Found and repaired a **fifth** call site of that exact trap beyond the plan's own four: `src/analytics/unreliable-segments.test.ts` (7 sites, not named in this plan's `files_modified`)
- Proved on real committed streams (3475724402, 3475734189, 3475740390) that reclassification moves real seconds, the pace series and histogram genuinely clip, and that `pace-derivation.ts`'s detector import is load-bearing (stubbing it un-clips the previously-clipped window; the real module clips it)
- `derivePaceSeriesGapAware`, `paceHistogramSamples`, `paceHistogramAccounting` and `derivePaceWithCoverage` were not touched — confirmed by hunk-header inspection (all Task 1 hunks fall in lines 32-353; those four functions start at line 582+)

## Task Commits

1. **Task 1: Four-way classifyGaps, three-pass, with the pre-detector seam exported** - `a3e2bba7` (feat)
2. **Task 2: Repair every detector-gap-input call site and prove 32-CALIBRATION.md is unmoved** - `daedd87f` (fix)
3. **Task 3: Real-stream reclassification tests and the D-15 load-bearing proof** - `eda85800` (test)

_No plan-metadata commit — this is a worktree-isolated parallel execution; the orchestrator handles STATE.md/ROADMAP.md centrally after merge._

## Files Created/Modified

- `src/analytics/pace-derivation.ts` — widened `GapKind`/`GapInterval`/`PaceCoverage`, new `PreDetectorGapKind`/`PreDetectorGapInterval`/`ThreeWayPaceCoverage`, new private `classifyPairKinds`/`accumulateCoverage`, new exported `classifyGapsThreeWay`, `classifyGaps` now three-pass and detector-wired
- `src/analytics/pace-derivation.test.ts` — new `describe` block (`-t "unreliable"`, 6 new tests) proving priority, A1, conservation, boundary identity, real clipping and the WR-01 shrink survival on real streams; 5 pre-existing assertions updated to post-widening measured reality
- `src/analytics/pace-single-source.test.ts` — new `describe` block (`-t "load-bearing"`, 1 test) proving the detector import is load-bearing via `vi.doMock` + dynamic re-`import()`, both directions in one test
- `scripts/unreliable-segment-recount-crosscheck.test.mjs` — all three detector-input sites switched to `classifyGapsThreeWay`; precondition now compares against the pre-detector list; new permanent regression test pinned to `-t "pre-detector"`
- `scripts/compute-unreliable-segment-calibration.mjs` — its one detector-input site switched to `classifyGapsThreeWay`; dated docblock note
- `scripts/validate-unreliable-segments-1hz.mjs` — both detector-input sites switched; dated docblock note
- `src/analytics/unreliable-segments.test.ts` — the fifth trap: 7 sites switched from `classifyGaps` to `classifyGapsThreeWay`
- `src/dashboard/views/detail-charts-logic.test.ts` — one synthetic fixture's burst speed lowered 10→6 m/s to stay below the detector's calibrated limit
- `src/dashboard/views/detail-sections.test.ts` — one pinned caption percentage updated (99%→98%) reflecting 32 s that moved out of `coveredSec`; one `PaceCoverage` fixture literal gained `unreliableSec: 0`

## Decisions Made

- Followed D-01/D-02/D-14 exactly as specified in 33-CONTEXT.md — no deviation on the core design.
- Where the widened `PaceCoverage`/`GapKind` broke a pre-existing test (in-scope or not), fixed it to reflect the new, measured, genuinely-correct behavior rather than reverting or skipping — every updated number is cited as computed in-test or measured live via `node -e` against `dist/`.
- Did not touch `detail-sections.ts`, `pace-quality.ts`, `list.ts`, or any other production consumer — those are explicitly later plans' scope (D-12's amendment: "zero code change outside `pace-derivation.ts`" describes the clipping mechanism, not the whole phase).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed a pre-existing `PaceCoverage` fixture literal in `detail-sections.test.ts` missing the new required `unreliableSec` field**
- **Found during:** Task 1, `npx tsc --noEmit`
- **Issue:** `makeCoverage`'s object literal predates the widened interface; `tsc --noEmit` failed with a missing-property error
- **Fix:** Added `unreliableSec: 0` to the fixture default, with a dated comment
- **Files modified:** `src/dashboard/views/detail-sections.test.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `a3e2bba7`

**2. [Rule 3 - Blocking] Repaired a fifth call site of the detector-input circularity trap not named in this plan's file scope**
- **Found during:** Task 3, full `npm test` run after Tasks 1-2
- **Issue:** `src/analytics/unreliable-segments.test.ts` fed `classifyGaps(t, d).gapIntervals` (now post-detector) into `detectUnreliableSegments` at 7 sites — the exact trap Task 2 fixed in three `.mjs` scripts, but this `.ts` test file was not in the plan's declared `files_modified`
- **Fix:** Switched all 7 sites to `classifyGapsThreeWay`, matching Task 2's established repair pattern exactly; added a dated docblock note
- **Files modified:** `src/analytics/unreliable-segments.test.ts`
- **Verification:** `npx vitest run src/analytics/unreliable-segments.test.ts` — 94/94 passed
- **Committed in:** `eda85800`

**3. [Rule 1 - Bug/measured-reality] Updated five pre-existing `pace-derivation.test.ts` assertions broken by the correct new four-way behavior**
- **Found during:** Task 3, full `npm test` run
- **Issue:** Real archive streams (4556693525, 5059204779, 3647739864, 4598855187) now carry genuine detected unreliable segments; assertions written against the pre-Phase-33 three-way behavior no longer held
- **Fix:** Widened the 4556693525 sum identity to four terms; rewrote the absolute-pause-rule negative case to assert the new, more-dramatic failure mode (the whole span swallowed as `unreliable`, not `pause`); added `unreliableSec: 0` to the zeroed-result equality check; lowered two `coveredFraction` floors from 98% to 97%, documenting the measured 97.45%/97.91% values and citing the genuine clip that caused the drop
- **Files modified:** `src/analytics/pace-derivation.test.ts`
- **Verification:** `npx vitest run src/analytics/pace-derivation.test.ts` — 38/38 passed
- **Committed in:** `eda85800`

**4. [Rule 1 - Bug/measured-reality] Lowered a synthetic burst-speed fixture in `detail-charts-logic.test.ts` from 10 m/s to 6 m/s**
- **Found during:** Task 3, full `npm test` run
- **Issue:** A pre-existing Δt-weighting test's synthetic 60s/10 m/s burst exceeded the detector's calibrated 7.35 m/s limit, so the burst was now detected and clipped entirely out of the pace window, inverting the test's own claim (`longDeviation` collapsed to ~0)
- **Fix:** Lowered the burst speed to 6 m/s (confirmed via a `node -e` probe that neither the 1s nor the 60s burst at 6 m/s triggers detection), restoring the test's original intent — testing `derivePaceSeriesGapAware`'s Δt-weighting, not the unrelated detector
- **Files modified:** `src/dashboard/views/detail-charts-logic.test.ts`
- **Verification:** `npx vitest run src/dashboard/views/detail-charts-logic.test.ts` — 39/39 passed
- **Committed in:** `eda85800`

**5. [Rule 1 - Bug/measured-reality] Updated a pinned caption percentage in `detail-sections.test.ts`**
- **Found during:** Task 3, full `npm test` run
- **Issue:** 4556693525's pinned coverage caption read `99% of elapsed time covered`; 32 s now moves out of `coveredSec` into `unreliableSec` (which `coverageCaptionText` — untouched by this plan — does not yet render), dropping the displayed percentage to 98%
- **Fix:** Updated the expected string to `98%...`, with a dated comment explaining the measured cause and noting the caption widening (D-10) is a later plan's job
- **Files modified:** `src/dashboard/views/detail-sections.test.ts`
- **Verification:** `npx vitest run src/dashboard/views/detail-sections.test.ts` — 3 failures remain, all pre-existing environmental ENOENT (see below), not this assertion
- **Committed in:** `eda85800`

---

**Total deviations:** 5 auto-fixed (2 Rule 3 blocking, 3 Rule 1 measured-reality corrections)
**Impact on plan:** All five were required for `npm test`/`tsc --noEmit` to pass, which is this plan's own stated verification. None touch production consumer files outside `pace-derivation.ts`; all are test-file-only. No scope creep into `detail-sections.ts`/`pace-quality.ts`/`list.ts` production code.

## Issues Encountered

- **Self-inflicted environment noise (not a code defect):** running `npm run build-widgets` once during plan-level verification left a partially-built `dist/widgets/` tree (missing `data/dashboard/index.json`, which is gitignored and absent in this bare worktree). This changed `scripts/verify-dashboard-publish-guard.test.mjs`'s internal skip/run logic, producing 8 additional false failures on the next `npm test`. Diagnosed and resolved by removing `dist/widgets/` (and stray `dist/widgets-temp-*` scratch dirs from repeated `npm run build` invocations) — all gitignored build output, safe to delete. One exception: `dist/widgets/test.html` is deliberately tracked despite living under `dist/` (`.gitignore` negation `!dist/widgets/test.html`) and was accidentally deleted by the cleanup; restored via `git checkout -- dist/widgets/test.html` before the final `npm test` run.
- **Worktree base correction:** at agent start, `git merge-base HEAD <expected-base>` did not equal the expected base commit (HEAD had landed on `5e902283`, an ancestor via origin/master's nightly auto-commits, not the expected `6772dca5`). Corrected per the mandatory protocol with `git reset --hard 6772dca562900dee77a2bce83cb537242499f2ed` before any other work began — expected per this repo's documented CI-auto-commit pattern, not a fault.

## Environmental Test Failures (not regressions)

Full `npm test`: **91 files, 2735 tests — 7 files / 3 tests failing**, all pre-existing ENOENT for gitignored, environment-absent artifacts in this bare worktree (`data/stats/*.json`, `data/dashboard/index.json`, `dist/widgets/data/stats/best-efforts.json`) — the same 7-file/3-test set present before any of this plan's edits. Not caused by, and not fixed by, this plan; the orchestrator's post-merge `npm test` on the primary checkout is the real gate.

Delta vs 32-17's recorded baseline (91 files / 2,848 tests): 0 files, and this plan's own 7 new test cases are visible in the raw total (2728→2735 across Tasks 1-3); the residual gap against 2,848 is attributable to entire suites that fail to even load in this environment (their test counts are absent from the total, not counted as failures) — an artifact of the bare-worktree carve-out, not measured here.

## Next Phase Readiness

- `classifyGaps`'s four-way output and `classifyGapsThreeWay`'s pre-detector seam are both ready for plans 33-02 through 33-07 (the pace chart, histogram, coverage caption, split markers, gap-profile signal and SEG-06 quality signal all read `PaceCoverage`/`GapInterval` without further changes to `pace-derivation.ts`).
- No blockers. `data/streams/` is byte-identical (`git status --porcelain data/streams` empty throughout). `32-CALIBRATION.md` regenerates byte-identically twice; the three shipped constants (7.35 m/s, 3.0 m, 116.95 m) are unmoved.
- Requirement ticks (PACE-08, SEG-06, PACE-09, COV-03) are deliberately NOT set by this plan, per its own requirement-tick-safety text — plan 33-13 alone sets their disposition against rendered checkpoint evidence.

---
*Phase: 33-coverage-integration-pace-clipping-segment-signal*
*Completed: 2026-09-21*

## Self-Check: PASSED

- FOUND: `src/analytics/pace-derivation.ts`
- FOUND: `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-01-SUMMARY.md`
- FOUND commit: `a3e2bba7`
- FOUND commit: `daedd87f`
- FOUND commit: `eda85800`
- FOUND commit: `8b54ffaf`
