---
phase: 27-per-activity-quality-signals
plan: 11
subsystem: testing
tags: [calibration, regression-test, dry-run-scripts, quality-signals]

# Dependency graph
requires:
  - phase: 27-per-activity-quality-signals
    provides: "the composite/per-signal severe-tier classifier, the calibration sweep generator, and 27-03's hand-written denominator correction this plan makes self-regenerating"
provides:
  - "compute-pace-quality-calibration.mjs's stream-file count now excludes data/streams/manifest.json (isStreamFile helper), fixing gap G-01"
  - "a regression test (isStreamFile suite) pinning the manifest.json exclusion, demonstrated failing against the old naive glob before being trusted"
  - "27-CALIBRATION.md regenerated to state 1865/25 by live computation, with the correction note / three-way corroboration / rounding footnote now generator-emitted instead of hand-edited"
affects: [27-verify, future-27-calibration-regenerations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Named-exclusion filter as an exported pure function (isStreamFile) rather than an inline lambda, so a regression test can pin it without needing I/O against the real archive"
    - "Provenance paragraphs (correction notes, cross-run corroboration) written as generator template output with a live self-consistency check (report.compositeCount === 299 branch) rather than hand-edited static prose, so future drift is flagged explicitly instead of silently reverted"

key-files:
  created: []
  modified:
    - scripts/compute-pace-quality-calibration.mjs
    - scripts/compute-pace-quality-calibration.test.mjs
    - .planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md
    - .planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md

key-decisions:
  - "Extracted the stream-file filter into an exported isStreamFile(filename) pure function instead of leaving it as an inline arrow function in readArchive(), specifically so a regression test could pin it as pure logic without depending on the real data/streams directory contents."
  - "Named exclusion of the literal manifest.json filename, per the plan's own preference, rather than a heuristic (e.g. non-numeric/non-i-prefixed id) — exact and cannot false-positive-exclude a legitimately-shaped future stream file."
  - "Made the three-way corroboration paragraph self-checking: it now branches on report.compositeCount === 299 and states explicitly whether the current run's own figure still matches the historically corroborated 299, rather than hardcoding '299' as an assumed-eternal fact the same way the original bug hardcoded a bad denominator computation."

requirements-completed: [QUAL-05]

# Metrics
duration: 12min
completed: 2026-09-10
---

# Phase 27 Plan 11: Calibration Generator Self-Regeneration Summary

**Fixed the calibration script's manifest.json stream-count bug and made its hand-written denominator-correction provenance generator-emitted, so regenerating 27-CALIBRATION.md now reproduces 1865/25 instead of reverting to the stale 1866/24.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-10T19:04:00+02:00 (approx, first file read)
- **Completed:** 2026-09-10T19:16:16+02:00
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Closed gap G-01 (`27-VALIDATION.md` § Gap-Closure Record): the calibration generator's `readArchive()` now excludes `data/streams/manifest.json` from the stream-file count via a new exported `isStreamFile()` pure function, rather than the naive `f.endsWith('.json')` glob that counted it as a per-activity stream.
- Added a regression test suite (`isStreamFile — the manifest.json exclusion (regression for gap G-01)`) that pins the exclusion, including a hand-built directory-listing test that asserts the old naive glob would produce 4 (bug) where the fix produces 3 (correct) for a `[1.json, 2.json, 3.json, manifest.json]` listing.
- **Demonstrated the regression test failing against the unfixed glob before trusting it**, per the plan's explicit instruction, by temporarily reverting `isStreamFile` to `filename.endsWith('.json')` (no exclusion), running the suite, confirming 2 failures with the exact expected/received mismatches, then restoring the fix and confirming all 21 tests pass. Both runs are recorded verbatim below.
- Regenerated `27-CALIBRATION.md` via `npm run compute-pace-quality-calibration -- --sweep`: stream-file count and stream-less count are now stated as **1865** / **25** by live computation (no hand-edit), while activity count (1890), composite (299), the three per-signal severe cohorts (154/127/31), and all six Threshold Sensitivity rows (+67/-38/+33/-20/+35/-44) are byte-identical to the previously committed report.
- Made the correction note, the three-way independent corroboration of 299, and the section-3 rounding footnote generator-emitted (part of `renderCalibrationMarkdown`'s section 1/3/4 output) instead of hand-edited into the file, so they now survive every future regeneration automatically.
- Confirmed `git diff --stat src/analytics/pace-quality.ts` is empty — no threshold constant touched (D-02/D-04 respected).

## Task Commits

Each task was committed atomically:

1. **Task 1: Exclude the manifest index from the stream-file count, with a regression test** - `72894128` (fix)
2. **Task 2: Regenerate the report and confirm it reproduces the corrected values** - `c5ad297a` (docs)

**Plan metadata:** (this summary's commit, made immediately after this file)

## Files Created/Modified

- `scripts/compute-pace-quality-calibration.mjs` - Added exported `isStreamFile(filename)` (excludes `manifest.json` by name); `readArchive()`'s stream-file glob now uses it; section-1/3/4 render logic updated to emit the live-denominator correction note, the rounding footnote, and a self-checking three-way corroboration paragraph as generator output.
- `scripts/compute-pace-quality-calibration.test.mjs` - Added the `isStreamFile` regression suite (4 tests) pinning the manifest.json exclusion.
- `.planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md` - Regenerated; states 1865/25 by computation; all G-01-unrelated figures (1890/299/154/127/31, six sensitivity rows) unchanged.
- `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md` - Rewritten with a timestamp-only diff by the calibration script's Section 6 D-04 boundary cross-check subprocess call (`npm run compute-pace-residual`), which is this pipeline's pre-existing regeneration contract, not a new behavior introduced by this plan. No content change — verified via `git diff`.

## Decisions Made

- Extracted the filter predicate into an exported, named `isStreamFile()` function specifically so the regression test could pin the logic as a pure unit (no dependency on the real `data/streams/` directory's contents), and so the "fail first, then fix" demonstration in Task 1 could be done by toggling one function body rather than patching multiple inline call sites.
- Chose explicit-filename exclusion (`filename !== 'manifest.json'`) over a heuristic, per the plan's stated preference — this cannot accidentally exclude a legitimately-shaped future stream filename the way an id-shape heuristic might.
- Made the three-way-corroboration paragraph self-checking against `report.compositeCount` rather than hardcoding "299" as a permanent fact — if a future archive change moves the composite away from 299, the generator will now say so explicitly instead of silently asserting a stale corroboration, which is precisely the failure mode this whole gap-closure plan exists to prevent from recurring in a different spot.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` and `<acceptance_criteria>` blocks without needing Rule 1-4 auto-fixes; the one open question the plan flagged (whether the correction note / three-way corroboration / rounding footnote could all be made generator-emitted) resolved affirmatively — all three fully migrated into the generator's own render logic with no content requiring a "cannot be generator-emitted" justification.

## Regression Test: Failing-Then-Passing Demonstration (verbatim)

**Failing run (old naive glob temporarily restored, `isStreamFile` returning `filename.endsWith('.json')` with no manifest exclusion):**

```
 ❯ scripts/compute-pace-quality-calibration.test.mjs (21 tests | 2 failed) 120ms
     × excludes manifest.json even though it ends with .json
     × pins the count of a hand-built directory listing that includes manifest.json

 FAIL  scripts/compute-pace-quality-calibration.test.mjs > isStreamFile — the manifest.json exclusion (regression for gap G-01) > excludes manifest.json even though it ends with .json
AssertionError: expected true to be false // Object.is equality
- Expected
+ Received
- false
+ true
 ❯ scripts/compute-pace-quality-calibration.test.mjs:154:47

 FAIL  scripts/compute-pace-quality-calibration.test.mjs > isStreamFile — the manifest.json exclusion (regression for gap G-01) > pins the count of a hand-built directory listing that includes manifest.json
AssertionError: expected 4 to be 3 // Object.is equality
- Expected
+ Received
- 3
+ 4
 ❯ scripts/compute-pace-quality-calibration.test.mjs:179:24

 Test Files  1 failed (1)
      Tests  2 failed | 19 passed (21)
```

**Passing run (fix restored):**

```
 ✓ scripts/compute-pace-quality-calibration.test.mjs (21 tests) 64ms

 Test Files  1 passed (1)
      Tests  21 passed (21)
```

## Verification Commands Run

- `npx vitest run scripts/compute-pace-quality-calibration.test.mjs` -> 21/21 passed (after restoring the fix)
- `npx tsc --noEmit` -> exit 0
- `git diff --stat src/analytics/pace-quality.ts` -> empty (no threshold touched)
- `npm run compute-pace-quality-calibration -- --sweep` -> stdout: `Activity count: 1890`, `Stream count: 1865`, `Composite (anySevere) count: 299`, `Sanity gate: PASS`
- `node scripts/compute-pace-quality-recount.mjs` -> exit 0, `Recomputed composite ... 299`, `PASS: recount agrees with the shipped totals; no disagreements found.`
- `npm run verify-dashboard` -> `64 check(s) passed, 0 failure(s)`
- `npm test` -> `Test Files 73 passed (73)`, `Tests 2070 passed (2070)`

## Invariant Check (must be unchanged — confirmed via `git diff` on `27-CALIBRATION.md`)

| Invariant | Value | Status |
|---|---|---|
| Activity count | 1890 | unchanged |
| Composite (anySevere) | 299 | unchanged |
| Decimation severe cohort | 154 | unchanged |
| GapProfile severe cohort | 127 | unchanged |
| ImpossibleSamples severe cohort | 31 | unchanged |
| Sensitivity: gap profile looser | +67 | unchanged |
| Sensitivity: gap profile stricter | -38 | unchanged |
| Sensitivity: impossible-sample looser | +33 | unchanged |
| Sensitivity: impossible-sample stricter | -20 | unchanged |
| Sensitivity: decimation looser (demo only) | +35 | unchanged |
| Sensitivity: decimation stricter (demo only) | -44 | unchanged |
| `src/analytics/pace-quality.ts` diff | (empty) | unchanged, D-02/D-04 respected |

Stream-file count moved from a stale, generator-reverting **1866** to a correctly-computed, self-regenerating **1865** (stream-less 24 -> 25) — this is the fix itself, not a drift.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Gap G-01 is closed: `27-CALIBRATION.md` now regenerates to its own stated values without a hand-edit step, and a regression test would catch any future recurrence of the manifest.json miscount.
- Gap G-02 (stale no-device-name cohort citation in ROADMAP/REQUIREMENTS, 716 vs. live 663) remains open per `27-VALIDATION.md` — this plan did not touch it; it was scoped to G-01 only.
- `26-RESIDUAL.md`'s regeneration-on-every-calibration-run behavior (Section 6's `npm run compute-pace-residual` subprocess call) is pre-existing and unaffected by this plan's changes; its diff here is timestamp-only.

---
*Phase: 27-per-activity-quality-signals*
*Completed: 2026-09-10*
