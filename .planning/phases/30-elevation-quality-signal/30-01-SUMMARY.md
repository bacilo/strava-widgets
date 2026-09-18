---
phase: 30-elevation-quality-signal
plan: 01
subsystem: analytics
tags: [typescript, vitest, quality-signals, altitude, haversine]

# Dependency graph
requires:
  - phase: 27-per-activity-quality-signals
    provides: "ActivityQualitySignals/PaceQualityShard shape, hasAnySevereSignal's Pick<> guarantee, notComputableSignals constructor, the (stream, metadata) assembly this plan extends"
provides:
  - "Three total altitude detectors (subGroundSignal, closureDriftSignal, verticalRateSignal) in pace-quality.ts"
  - "ElevationSignal as the sixth, non-anySevere signal on ActivityQualitySignals; elevationSignal(stream, metadata) assembly"
  - "Three synthetic single-mode fixtures (syntheticSubGroundStream/syntheticClosureDriftStream/syntheticVerticalRateSpikeStream)"
  - "PaceQualityShard elevation evidence fields (elevationVerticalRateSamples, elevationLoopRadiusM, elevationStartEndDistM)"
affects: [30-02, 30-03, 30-04, 30-05, 30-06, 30-07, 30-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ElevationTier is its own three-member union, never a reuse of the four-member QualityTier (no minor band, D-07)"
    - "closureDriftSignal's three-outcome ladder (not-computable / clear-excluded-by-design / flagged-or-clear) keeps startEndDistM and deltaM independently nullable so the detail line and report can distinguish all three cases"
    - "haversineMeters/EARTH_RADIUS_M copied verbatim into pace-quality.ts (not imported) to preserve the module's client-safe, no-fs/no-fetch contract"

key-files:
  created: []
  modified:
    - src/analytics/pace-quality.ts
    - src/analytics/pace-quality.test.ts
    - src/analytics/pace-fixtures.ts
    - src/analytics/compute-dashboard-index.ts
    - src/analytics/gear-aggregate-logic.test.ts
    - src/dashboard/data/pace-quality-client.ts
    - src/dashboard/data/pace-quality-client.test.ts
    - src/dashboard/data/index-client.test.ts
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail-sections.test.ts
    - src/dashboard/views/overview.test.ts
    - src/dashboard/views/list.test.ts
    - src/dashboard/views/list-logic.test.ts
    - src/dashboard/views/calendar-logic.test.ts
    - src/dashboard/views/trends-logic.test.ts
    - src/dashboard/views/trends-volume-logic.test.ts
    - src/dashboard/views/trends-cadence-hr-logic.test.ts

key-decisions:
  - "Did not add the three new synthetic fixture names to PACE_FIXTURE_NAMES: that list's own resolvability test (pace-fixtures.test.ts, out of this plan's file scope) maps every listed synthetic name through a hand-maintained SYNTHETIC_CONSTRUCTORS dict, and adding names there without extending that dict would break an existing test. Left for a later plan that owns pace-fixtures.test.ts."
  - "pace-quality-client.ts's parseActivityQualitySignals/parsePaceQualityShard emit a minimal not-computable elevation fallback unconditionally, never reading raw.elevation -- the real tolerant parse is explicitly plan 30-03's Task 2 per this plan's own action text, not pre-empted here."
  - "Standardized on D-11's own example numbers (minAltM 12, deltaM 4/startEndDistM 38, worstRateMps 1.2) as the one 'healthy elevation' literal reused across every CLEAN_QUALITY/HEALTHY_QUALITY fixture this task touched, rather than inventing a different plausible value per file."

patterns-established:
  - "A tiered signal can be deliberately excluded from the anySevere composite by construction (Pick<> never widened) -- the guard is proven by literally reversing it, running the test, observing the failure, and reverting, with the reversal reproduced from the plan's own restore-and-confirm instruction rather than asserted from memory."

requirements-completed: [ELEV-01]

# Metrics
duration: ~25min
completed: 2026-09-18
---

# Phase 30 Plan 01: Three Altitude Detectors and Elevation Assembly Summary

**Three total, never-throwing altitude detectors (sub-ground, loop-gated closure drift, implausible vertical rate) landed as `ElevationSignal`, the sixth signal on `ActivityQualitySignals`, structurally excluded from the `anySevere` composite and demonstrated failing when that exclusion is reversed.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-18T15:35:00+02:00 (approx.)
- **Completed:** 2026-09-18T15:57:34+02:00
- **Tasks:** 3
- **Files modified:** 17 (3 in Task 1, 2 in Task 2, 14 in Task 3 — 3 files overlap across tasks)

## Accomplishments

- `subGroundSignal`, `closureDriftSignal`, `verticalRateSignal` — three total, adversarial-input-safe detectors in `src/analytics/pace-quality.ts`, with named threshold constants (`SUB_GROUND_MIN_ALT_M = -50`, `CLOSURE_DRIFT_SEVERE_DELTA_M = 60`, `VERTICAL_RATE_SEVERE_MPS = 5`) and the D-03-derived `LOOP_RADIUS_M = 100`
- `haversineMeters`/`EARTH_RADIUS_M = 6371000` copied verbatim from `derive-stream.ts` (kept private there) to preserve this module's client-safe contract — confirmed identical in both files by grep
- Three synthetic per-mode fixtures in `pace-fixtures.ts`, each proven (by direct assertion, not inspection) to fire exactly one detector, plus the converse (clean baseline stops that mode alone, other two unchanged)
- `elevation: ElevationSignal` landed as the sixth, required key on `ActivityQualitySignals`; `elevationSignal(stream, metadata)` assembles it from the same `(stream, metadata)` `computePaceQualitySignals`/`buildPaceQualityShard` already receive — no new fetch, no new parameter
- `hasAnySevereSignal`'s `Pick<'decimation' | 'gapProfile' | 'impossibleSamples'>` is byte-identical to before this plan; the exclusion was demonstrated failing (not just asserted) by temporarily widening it and observing the guard test go red, then reverting and confirming green
- Whole tree restored to green: `npx tsc --noEmit` exits 0, `npm test` is 82/82 files, 2448/2448 tests — a clean +26 over the pre-plan baseline (2422, measured via a disposable git worktree at commit `3c1e172e`)

## Task Commits

1. **Task 1: Three total detectors and three single-mode synthetic fixtures** - `58becd3e` (feat)
2. **Task 2: Assemble elevation as the sixth signal and pin the anySevere boundary** - `9f738df2` (feat)
3. **Task 3: Restore a green tree after the required key landed** - `3290dcb9` (fix)

## Files Created/Modified

- `src/analytics/pace-quality.ts` — `ElevationTier`/`ElevationSignal`/sub-signal interfaces, four threshold constants, `haversineMeters`/`normalizeLatLng`, the three detectors, `elevationSignal` assembly, wired into `ActivityQualitySignals`, `ActivityQualityMetadata` (+`startLatlng`/`endLatlng`), `notComputableSignals`, `computePaceQualitySignals`, `PaceQualityShard` (+4 evidence fields), `buildPaceQualityShard`
- `src/analytics/pace-quality.test.ts` — per-mode boundary/position-outcome/totality tests (Task 1); anySevere-exclusion, mode-independence (fires-only + converse), notComputableSignals-elevation tests (Task 2)
- `src/analytics/pace-fixtures.ts` — `syntheticSubGroundStream`, `syntheticClosureDriftStream`, `syntheticVerticalRateSpikeStream`
- `src/analytics/compute-dashboard-index.ts` — `qualityMetadata` now passes `activity.start_latlng`/`end_latlng` through (zero new file reads)
- `src/dashboard/data/pace-quality-client.ts` — minimal not-computable elevation fallback in both parse functions, so the client compiles against the new required fields; real tolerant parsing deferred to plan 30-03
- `src/dashboard/views/detail-sections.ts` — `EXPLANATION_PROBE_QUALITY` gets a clean elevation; module-load assertion loop's three-signal list left untouched
- Nine test files (`detail-sections.test.ts`, `index-client.test.ts`, `overview.test.ts`, `list.test.ts`, `list-logic.test.ts`, `calendar-logic.test.ts`, `trends-logic.test.ts`, `trends-volume-logic.test.ts`, `trends-cadence-hr-logic.test.ts`) — additive `elevation:` members on existing `ActivityQualitySignals`/`PaceQualityShard` literals only; zero changed `expect(` lines (verified by grep across all nine)
- `src/analytics/gear-aggregate-logic.test.ts`, `src/dashboard/data/pace-quality-client.test.ts` — same additive treatment (see Deviations)

## Decisions Made

- `LOOP_RADIUS_M = 100` implemented exactly as 30-RESEARCH.md recommended (Assumption A1): any value in `(0, 552.4)` is archive-equivalent on the live data, 100 m chosen for headroom.
- `closureDriftSignal`'s excluded-by-design branch (`distance > loopRadiusM`) returns `state: 'clear'` with `deltaM: null` but a populated `startEndDistM` — deliberately never falls back to the raw altitude difference (D-02), and stays distinguishable from the not-computable branch (which nulls both fields).
- `verticalRateSignal` always reports the worst observed rate even when nothing is flagged, so a healthy activity's future detail-view row (plan 30-06) can print a real number rather than going silent.
- Did not extend `PACE_FIXTURE_NAMES` with the three new synthetic names (see Deviations) — a deliberate scope boundary, not an oversight.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended `src/analytics/compute-dashboard-index.ts`, `src/dashboard/data/pace-quality-client.ts`, `src/dashboard/data/pace-quality-client.test.ts`, and `src/analytics/gear-aggregate-logic.test.ts`, none of which are in this plan's declared `files_modified` list**
- **Found during:** Task 3 (`npx tsc --noEmit` after Task 2 landed the required `elevation` key)
- **Issue:** The plan's own frontmatter `files_modified` list for Task 3 names ten dashboard-view files, but `tsc --noEmit` also failed on `compute-dashboard-index.ts` (the `qualityMetadata` literal, missing `startLatlng`/`endLatlng`), `pace-quality-client.ts` (two `ActivityQualitySignals`/`PaceQualityShard` return sites), and `gear-aggregate-logic.test.ts` (a `quality:` fixture literal). The plan's own Task 3 action text explicitly anticipated the `pace-quality-client.ts` case ("update ... only if tsc reports its parse function as returning an incomplete `ActivityQualitySignals`") — the other two were a frontmatter omission, not a design gap.
- **Fix:** `compute-dashboard-index.ts` — added `activity.start_latlng`/`end_latlng` to the existing `qualityMetadata` literal (zero new file reads, matching D-01's own claim). `pace-quality-client.ts` — added a minimal not-computable elevation fallback to `parseActivityQualitySignals` and the four new `PaceQualityShard` evidence fields (with sensible not-computable/empty defaults) to `parsePaceQualityShard`, per the plan's own explicit instruction not to pre-empt plan 30-03's real tolerant parse. `gear-aggregate-logic.test.ts` — added the same clean elevation literal used across the other fixture files.
- **Files modified:** `src/analytics/compute-dashboard-index.ts`, `src/dashboard/data/pace-quality-client.ts`, `src/analytics/gear-aggregate-logic.test.ts`
- **Verification:** `npx tsc --noEmit` exits 0.
- **Committed in:** `3290dcb9` (Task 3 commit)

**2. [Rule 1 - Bug] Fixed `pace-quality-client.test.ts`'s `validShard` round-trip fixture, broken by fix #1 above**
- **Found during:** Task 3, first `npm test` run after the `pace-quality-client.ts` fix
- **Issue:** `parsePaceQualityShard`'s new unconditional not-computable elevation fallback (and the four new shard evidence-field defaults) made `parsePaceQualityShard(validShard)` no longer deep-equal `validShard` itself — 4 tests in `pace-quality-client.test.ts` failed on `toEqual`.
- **Fix:** Added the matching `elevation` sub-object and the four shard-level `elevation*` fields to `validShard`, mirroring exactly what the parser now always emits.
- **Files modified:** `src/dashboard/data/pace-quality-client.test.ts`
- **Verification:** `npx vitest run src/dashboard/data/pace-quality-client.test.ts` — 17/17 pass. Full `npm test` — 82/82 files, 2448/2448 tests.
- **Committed in:** `3290dcb9` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1/3, both required for a genuinely green tree)
**Impact on plan:** No scope creep — every fix was either explicitly anticipated by the plan's own action text (`pace-quality-client.ts`) or a direct, mechanical consequence of a change the plan did require (the other three files). No new behavior was introduced beyond what Task 3's stated goal ("restore a green tree") already demanded.

## Verbatim Evidence: D-06 Guard Demonstrated Failing (Task 2 acceptance criterion)

Per the plan's explicit instruction, `hasAnySevereSignal`'s `Pick<>` was temporarily widened to include `'elevation'` and its body changed to OR in `signals.elevation.tier === 'severe'`, then the guard test was run, then the change was reverted and the test re-run.

**Before (reversed) — FAILED, exact output:**
```
 FAIL  src/analytics/pace-quality.test.ts > elevation assembly, anySevere exclusion, and not-computable rollup (D-05..D-07, Phase 30 D-06) > anySevere excludes elevation: a severe elevation tier never flips hasAnySevereSignal (Phase 30's own most-consequential-mistake guard)
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ src/analytics/pace-quality.test.ts:859:38

 Test Files  1 failed (1)
      Tests  1 failed | 77 skipped (78)
```

**After (restored) — PASSED:**
```
 ✓ src/analytics/pace-quality.test.ts (78 tests | 77 skipped) 2ms

 Test Files  1 passed (1)
      Tests  1 passed | 77 skipped (78)
```

`git diff 58becd3e -- src/analytics/pace-quality.ts | grep -c "elevation.tier === 'severe'"` returns `0` after restoration — no trace of the reversal remains in the shipped diff.

## Threshold Constants As Shipped

| Constant | Value | Meaning |
|---|---|---|
| `SUB_GROUND_MIN_ALT_M` | `-50` | Sub-ground flags when the stream's minimum altitude is strictly below this |
| `CLOSURE_DRIFT_SEVERE_DELTA_M` | `60` | Closure drift flags when `\|alt[end] - alt[start]\|` (in a loop) strictly exceeds this |
| `VERTICAL_RATE_SEVERE_MPS` | `5` | Vertical rate flags a sample pair whose `\|Δalt\|/Δt` strictly exceeds this |
| `LOOP_RADIUS_M` | `100` | Derived (30-RESEARCH.md D-03): any value in `(0, 552.4)` m is archive-equivalent; 100 chosen for headroom |

## `ElevationSignal` Shape As Shipped

```typescript
export type ElevationTier = 'severe' | 'none' | 'not-computable';

export interface ElevationSignal {
  tier: ElevationTier;
  subGround: { flagged: boolean; minAltM: number | null };
  closureDrift: {
    state: 'flagged' | 'clear' | 'not-computable';
    deltaM: number | null;          // signed: alt[end] - alt[start]
    startEndDistM: number | null;   // retained on BOTH the loop and excluded branches
  };
  verticalRate: { flagged: boolean; worstRateMps: number | null; violatingSamples: number | null };
}
```

Matches the plan's `<interfaces>` block exactly — no field renamed, no field added, no field dropped.

## `npm test` Passing Counts

| | Files | Tests |
|---|---|---|
| Before this plan (commit `3c1e172e`, measured via disposable `git worktree`) | 82/82 | 2422/2422 |
| After Task 3's sweep (commit `3290dcb9`) | 82/82 | 2448/2448 |

Difference: **+26** — exactly Task 1's 22 new elevation-detector tests plus Task 2's 4 new assembly tests (1 anySevere-exclusion + 2 mode-independence + 1 notComputableSignals-elevation), with zero tests removed or changed anywhere in the tree.

## Issues Encountered

The baseline worktree comparison initially returned false failures (5-10 files erroring on missing `data/stats/*`/`dist/*`) purely from the disposable worktree lacking symlinks to the gitignored, locally-generated `data/stats/`, `data/dashboard/`, and `dist/` directories — resolved by symlinking those three specific subdirectories (not the whole `data/` tree, which is partially git-tracked) into the worktree. Not a code issue; documented here per the project's `worktree-executors-need-node-modules-and-data` memory lesson.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `ElevationSignal` and its three detectors are fully assembled and shard-evidenced; plan 30-02 (per 30-RESEARCH.md's Wave map) can build the loop-radius/overlap-matrix calibration report directly against `elevationSignal`/`buildPaceQualityShard` without further wiring.
- `pace-quality-client.ts`'s elevation parsing is a deliberate, documented stub (minimal not-computable fallback) — plan 30-03's Task 2 must replace it with the real tolerant `parseElevationSignal` before any UI surface (badges, detail rows) can show real elevation data client-side.
- `PACE_FIXTURE_NAMES`/`pace-fixtures.test.ts`'s `SYNTHETIC_CONSTRUCTORS` map do not yet know about the three new synthetic fixtures — a future plan touching that file should decide whether to register them there (Criterion 6's presence-by-name coverage) or leave them addressed only by direct import, as this plan's own tests already do.
- No blockers for downstream plans.

---
*Phase: 30-elevation-quality-signal*
*Completed: 2026-09-18*

## Self-Check: PASSED

All 17 files listed under Files Created/Modified verified present on disk. All three task commit
hashes (`58becd3e`, `9f738df2`, `3290dcb9`) verified present in `git log --oneline --all`.
