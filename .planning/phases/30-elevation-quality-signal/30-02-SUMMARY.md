---
phase: 30-elevation-quality-signal
plan: 02
subsystem: analytics
tags: [typescript, vitest, quality-signals, altitude, fixtures]

# Dependency graph
requires:
  - phase: 30-elevation-quality-signal
    plan: "01"
    provides: "subGroundSignal/closureDriftSignal/verticalRateSignal detectors, ElevationSignal assembly, loadPinnedStream/loadPinnedActivity/PINNED_FIXTURES scaffolding"
provides:
  - "Two new PINNED_FIXTURES rows (closure-drift-exemplar 4745489664, vertical-rate-exemplar 3149636661) re-verified against the live archive on every test run"
  - "worked-example (4556693525) row extended with minAltM/driftDeltaM/startEndDistM/worstRateMps, confirming its sub-ground fixture stays clear of the other two elevation modes"
  - "assertExpectedProperties switch cases for minAltM/driftDeltaM/startEndDistM/worstRateMps, each running the shipped Phase 30-01 detectors against the live committed stream"
affects: [30-03, 30-04, 30-05, 30-06, 30-07, 30-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pinned real fixtures re-verify their `expected` values against the live archive by calling the SAME shipped detector functions the production code uses (not a re-implementation) — a fixture verified by a second implementation only verifies the second implementation"
    - "3149636661 carries driftDeltaM in `expected` alongside worstRateMps specifically so its dual-mode (drift + rate) nature is machine-checked, not merely stated in `why` prose"

key-files:
  created: []
  modified:
    - src/analytics/pace-fixtures.ts
    - src/analytics/pace-fixtures.test.ts

key-decisions:
  - "Named the two new rows 'closure-drift-exemplar' and 'vertical-rate-exemplar' (Claude's Discretion per 30-CONTEXT.md) — descriptive of the mode each pins, matching the archive's own worst-case per mode."
  - "All twelve live re-derived values (four properties x three activities) matched 30-RESEARCH.md's D-14 table exactly (within floating-point rounding) — no archive drift since the 2026-09-18 research session, so no pinned value needed updating beyond the research table's own figures."

patterns-established:
  - "A pinned value's tolerance is proven load-bearing by perturbing it 10x past tolerance, observing the named failure quoting both planning-time and execution-time values, then restoring — not merely inspected."

requirements-completed: [ELEV-02]

# Metrics
duration: ~20min
completed: 2026-09-18
---

# Phase 30 Plan 02: Pin Three Real Elevation Exemplars Summary

**Two new `PINNED_FIXTURES` rows (4745489664 drift-only, 3149636661 dual-mode drift+rate) and four new elevation properties on the existing `worked-example` row, all re-verified against the live archive by calling the shipped Phase 30-01 detectors on every test run — with the total switch's `default:` throw kept intact and demonstrated firing on 10x perturbation.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-18T16:00:00+02:00 (approx.)
- **Completed:** 2026-09-18T16:10:00+02:00 (approx.)
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- `worked-example` (4556693525) row extended with `minAltM: -282`, `driftDeltaM: -5.6`, `startEndDistM: 0`, `worstRateMps: 3.3` — confirms the archive's sub-ground exemplar does not also trip the drift or vertical-rate modes
- New `closure-drift-exemplar` row (4745489664): `driftDeltaM: -197.6`, `startEndDistM: 0`, `minAltM: 4.2` — the archive's worst loop-gated closure drift, isolated from the other two modes
- New `vertical-rate-exemplar` row (3149636661): `worstRateMps: 80.4`, `driftDeltaM: -172.6`, `startEndDistM: 0`, `minAltM: 19.8` — the archive's worst vertical-rate real, with `driftDeltaM` deliberately carried in `expected` so its dual-mode (drift + rate) nature is machine-checked; its `why` text states in words that it must never be used as a single-mode isolation fixture (that role belongs to plan 30-01's three synthetics)
- `assertExpectedProperties` in `pace-fixtures.test.ts` extended with `case 'minAltM'`, `case 'driftDeltaM'`, `case 'startEndDistM'`, `case 'worstRateMps'`, each calling `subGroundSignal`/`closureDriftSignal`/`verticalRateSignal` (imported from the shipped `pace-quality.ts`, not re-implemented) against `loadPinnedStream`/`loadPinnedActivity`, with a 0.1-precision `toBeCloseTo` tolerance
- The `default:` throw (`unhandled expected key`) is untouched and confirmed intact by grep
- Perturbation demonstrated: changing `vertical-rate-exemplar`'s pinned `worstRateMps` from 80.4 to 90.4 produced a named failing test quoting both values; reverted, suite green again

## Task Commits

1. **Task 1: Re-derive the three exemplars' live values, then pin them with their switch cases** - `93f87ef0` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `src/analytics/pace-fixtures.ts` — `worked-example` row's `expected` extended with four elevation properties and its `why` text extended; two new `PINNED_FIXTURES` rows (`closure-drift-exemplar`, `vertical-rate-exemplar`) added, automatically included in `PACE_FIXTURE_NAMES` (derived via `.map`)
- `src/analytics/pace-fixtures.test.ts` — `assertExpectedProperties`'s switch gains four new cases; imports `closureDriftSignal`/`subGroundSignal`/`verticalRateSignal` from `pace-quality.js`

## Live Re-Derivation (Task 1 acceptance criterion)

Computed by importing the SHIPPED, compiled detectors from `dist/analytics/pace-quality.js` (built via `npm run build`) in a throwaway script at `/tmp/elev-derive-30-02.mjs`, run read-only against `data/streams/{id}.json` and `data/activities/{id}.json`. All twelve values (four properties x three activities) matched 30-RESEARCH.md's D-14 table exactly, within floating-point rounding — **no delta, no archive drift** since the 2026-09-18 research session:

| Activity | Property | 30-RESEARCH.md D-14 (planning-time) | Live re-derived (execution-time) | Delta |
|---|---|---|---|---|
| 4556693525 | minAltM | -282.0 | -282 | none |
| 4556693525 | driftDeltaM | -5.6 | -5.600000000000023 | none (fp rounding) |
| 4556693525 | startEndDistM | 0 | 0 | none |
| 4556693525 | worstRateMps | 3.3 | 3.3000000000000114 | none (fp rounding) |
| 4745489664 | minAltM | +4.2 | 4.199999999999989 | none (fp rounding) |
| 4745489664 | driftDeltaM | -197.6 | -197.59999999999997 | none (fp rounding) |
| 4745489664 | startEndDistM | 0 | 0 | none |
| 4745489664 | worstRateMps | 2.3 | 2.3000000000000114 | none (fp rounding) |
| 3149636661 | minAltM | 19.8 | 19.8 | none |
| 3149636661 | driftDeltaM | -172.6 | -172.6 | none |
| 3149636661 | startEndDistM | 0 | 0 | none |
| 3149636661 | worstRateMps | 80.4 | 80.39999999999999 | none (fp rounding) |

`deviceFamily`/`streamSource` were read from each activity's own `data/activities/{id}.json` rather than guessed: 4745489664 is `device_name: "Suunto 9"`, stream `source: "fit"` -> `deviceFamily: 'suunto-9'`, `streamSource: 'fit'`. 3149636661 is `device_name: "Garmin vívoactive 4"`, stream `source: "gpx"` -> `deviceFamily: 'garmin-vivoactive-4'`, `streamSource: 'gpx'`.

## Perturbation Demonstration (verbatim)

Changed `vertical-rate-exemplar`'s pinned `worstRateMps` from `80.4` to `90.4` (a 10 m/s perturbation, well past the 0.1 m/s tolerance), ran the test file:

```
FAIL src/analytics/pace-fixtures.test.ts > PINNED_FIXTURES — archive files resolve and match their recorded expectations > loadPinnedStream("'vertical-rate-exemplar'") parses and matches expected properties
AssertionError: fixture "vertical-rate-exemplar" (activity 3149636661) property "worstRateMps": planning-time 90.4, execution-time 80.39999999999999: expected 80.39999999999999 to be close to 90.4, received difference is 10.000000000000014, but expected 0.05
 ❯ assertExpectedProperties src/analytics/pace-fixtures.test.ts:278:84

 Test Files  1 failed (1)
      Tests  1 failed | 38 passed (39)
```

Restored to `80.4` via `mv src/analytics/pace-fixtures.ts.bak src/analytics/pace-fixtures.ts` (the `sed -i.bak` edit's backup), confirmed `git diff` against the committed version showed the restoration byte-identical to plan, then re-ran: 39/39 passed. A pinned value that cannot fail is not verification — this one can, and was shown to.

## Decisions Made

- Named the two new fixtures `closure-drift-exemplar` and `vertical-rate-exemplar` (Claude's Discretion) — descriptive of the archive's worst-case per mode, consistent with `worked-example`'s naming style.
- Used `toBeCloseTo(expectedValue, 1)` (0.1 precision) for `minAltM`/`driftDeltaM`/`startEndDistM`/`worstRateMps`, matching the plan's stated tolerance (0.1 m for altitudes/distances, 0.1 m/s for rates) rather than exact float equality, since the detectors' floating-point arithmetic produces values like `-5.600000000000023`.

## Deviations from Plan

None — plan executed exactly as written. The live re-derivation matched the research table exactly (no archive drift to record), so no pinned value differs from 30-RESEARCH.md's D-14 table.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `PACE_FIXTURE_NAMES` now includes `closure-drift-exemplar` and `vertical-rate-exemplar` alongside `worked-example`, all three real elevation exemplars — plan 30-08's checkpoint can quote these three names and their pinned values (`data/stats/pace-quality/{id}.json`) directly.
- `assertExpectedProperties`'s total switch remains exhaustive; any future plan adding a new elevation `expected` key must extend the switch in the same commit (RESEARCH Pitfall 2) or the suite goes red immediately with a named, actionable error.
- Full `npm test` (excluding one pre-existing environmental failure, see below) is 2422/2422 passing (80/82 files; 1 skipped by design), `npx tsc --noEmit` exits 0, `git status --porcelain data/` is empty.
- `scripts/verify-dashboard-publish-stats.test.mjs` fails in THIS bare worktree only, on `ENOENT` for `dist/widgets/data/stats/best-efforts.json` — a gitignored, locally-generated build artifact this worktree setup does not symlink (only `node_modules` and `data/` per the worktree environment notes). Not a regression: the file is outside this plan's declared `files_modified` scope and the failure is purely the missing artifact, not a code defect. The orchestrator's full-suite run on the primary checkout is the real gate for this file.

---
*Phase: 30-elevation-quality-signal*
*Completed: 2026-09-18*
