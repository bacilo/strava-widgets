---
phase: 18-records-trends-differentiators
plan: 07
subsystem: analytics
tags: [trimp, training-load, ctl-atl-tsb, build-pipeline, heart-rate, manifest-sweep, vitest]

# Dependency graph
requires:
  - phase: 18-records-trends-differentiators
    provides: "18-01: loadAthletePrivateConfig warn-and-degrade loader; 18-03: computeActivityTrimp / computeCtlAtlTsb pure formulas and the TrainingLoadDocument contract"
provides:
  - "src/analytics/compute-training-load.ts — computeTrainingLoad build step: manifest-driven sweep producing data/stats/training-load.json"
  - "data/stats/training-load.json — daily CTL/ATL/TSB for both TRIMP models plus per-day run/HR counts, gitignored and regenerated"
affects: ["18-10/18-11 (Trends training-load tab UI, will read data/stats/training-load.json)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Required-manifest-throws / optional-inputs-degrade split, mirroring compute-best-efforts.ts and compute-dashboard-index.ts's established convention"
    - "Every manifest activity increments its calendar day's runs count regardless of stream/HR availability, so no-HR days are structurally distinguishable from rest days rather than erased by an early-continue"
    - "Operator-facing degradation messages hardcode the canonical file path literal rather than interpolating the (possibly test-overridden) option value, so the guidance always names the real committed location"

key-files:
  created:
    - src/analytics/compute-training-load.ts
    - src/analytics/compute-training-load.test.ts
  modified: []

key-decisions:
  - "banisterDisabledReason and the missing-manifest error message hardcode the literal canonical paths (data/private/athlete-private.json, data/config/athlete.json, npm run backfill-streams) rather than the actual (possibly overridden) option values — required so fixture-driven tests using tmpDir-joined option paths still produce messages containing the real committed paths an operator would recognize."
  - "activitiesWithHr + activitiesWithoutHr + activitiesUnreadable sums to the full manifest entry count (mirroring compute-dashboard-index.ts's withStreams+withoutStreams+skippedUnreadable invariant) — a stream read failure for an HR-flagged activity is bucketed into activitiesUnreadable, not activitiesWithoutHr, keeping the three buckets mutually exclusive."
  - "A stream that manifest metadata says carries HR but which computeActivityTrimp finds empty/absent degrades to activitiesWithoutHr (honest fallback) rather than activitiesUnreadable, since the file itself read successfully — only the read/parse operation failing counts as unreadable."

requirements-completed: []

# Metrics
duration: ~9min
completed: 2026-08-11
---

# Phase 18 Plan 07: compute-training-load Build Step Summary

**Manifest-driven `compute-training-load` build step sweeping all 1,868 committed activities into a 5,475-day Edwards/Banister CTL/ATL/TSB document, with no-HR days recorded honestly and Banister cleanly disabled (never estimated) when the private config is absent.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-08-11T21:52:14+02:00 (approx, worktree base commit)
- **Completed:** 2026-08-11T22:00:37+02:00
- **Tasks:** 2/2
- **Files modified:** 2 (both new)

## Accomplishments
- `src/analytics/compute-training-load.ts` — sweeps `data/streams/manifest.json`, reads each activity's `start_date_local` to bucket it into a calendar day, computes Edwards TRIMP for every HR-bearing activity and Banister TRIMP only when the private config is complete, and writes `data/stats/training-load.json` via `computeCtlAtlTsb` per model.
- Verified against the **live archive** (not just fixtures): 5,475-day spine (2011-05-09 to 2026-08-11), 1,868 activities considered, 1,688 with HR / 180 without, 0 unreadable, Banister correctly disabled with `data/private/athlete-private.json` absent (the phase's shipped state), 1.12 MB output — well under the 3 MB ceiling.
- Both live-archive honesty checks pass: 170 of 1,797 run-days have zero HR-bearing runs (visible, not erased), and day-1 TSB is exactly 0 with 1,797 genuine rest-day CTL decreases (Pitfalls 3/4 from plan 18-03 hold against the real archive, not only synthetic fixtures).
- `src/analytics/compute-training-load.test.ts` — 10 fixture-driven cases pinning the full degradation contract: no private config, full config (numerically distinct Banister vs Edwards series), `restingHr: null`, missing/invalid public `athlete.json`, missing manifest (throws), one corrupt stream among three, an `channels.hr: false` activity (contributes `runs:1, runsWithHr:0`, 0 TRIMP), two same-day activities (summed TRIMP, `runs:2`), a 40-day gap (all 40 intervening days present with `runs:0` and strictly decreasing CTL), and 2-decimal rounding.

## Task Commits

Each task was committed atomically:

1. **Task 1: Sweep the stream archive and emit the daily training-load document** - `db898cc` (feat)
2. **Task 2: Test the build step's degradation paths against fixtures** - `bb51801` (test)

_No plan-metadata commit in worktree mode — SUMMARY.md is committed separately below per worktree protocol._

## Files Created/Modified
- `src/analytics/compute-training-load.ts` - `ComputeTrainingLoadOptions`, `computeTrainingLoad`: required-manifest-throws, required-for-anything public zone config (degrades both models off), optional private config (degrades Banister only), per-activity try/catch sweep, per-day accumulation, rounded-to-2-decimals output
- `src/analytics/compute-training-load.test.ts` - 10 vitest cases covering the degradation contract (fixtures only, no reads of the live `data/streams/`/`data/activities/`)

## Decisions Made
- Followed the plan's `<action>` spec closely: `compute-best-efforts.ts`'s manifest-sweep/try-catch/counter structure, `compute-dashboard-index.ts`'s required-vs-optional-input split, plan 18-03's `computeActivityTrimp`/`computeCtlAtlTsb` for the actual math.
- Chose to hardcode the canonical file-path literals (`data/private/athlete-private.json`, `data/config/athlete.json`, `npm run backfill-streams`) in every operator-facing message rather than interpolating the actual `options.*Path` value — the plan's own acceptance criteria require the live-archive run's message to contain the literal committed path, and the test suite verifies the same literal text even though its fixtures use tmpDir-joined override paths. Interpolating the real option value would have broken one or the other.
- Buckets `activitiesWithHr`/`activitiesWithoutHr`/`activitiesUnreadable` to be mutually exclusive and sum to the full manifest count, mirroring `compute-dashboard-index.ts`'s established totals-reconciliation convention (not explicitly required by the plan's acceptance criteria, but a natural extension of the existing pattern that keeps the totals self-consistent and testable).

## Deviations from Plan

None — plan executed exactly as written, including the additional degradation branches implied by the `<action>` prose (public-config-missing early return, private-config-missing/partial Banister disable, per-activity unreadable-record/unreadable-stream handling).

## Issues Encountered
- Initial `vitest` run for Task 2's "one unreadable stream" case failed a `expect(warnSpy).toHaveBeenCalled()` assertion because `warnSpy.mockRestore()` was called (which also clears the mock's recorded call history in vitest, not just its implementation) before the assertion ran. Reordered the assertion before `mockRestore()`; not a Rule 1-3 deviation since it was a test-authoring bug caught and fixed before commit, not a change to plan-specified production behavior.
- `npm test` initially showed one unrelated pre-existing failure (`src/dashboard/views/trends-yoy-logic.test.ts`, missing local `data/stats/year-over-year.json`) — a gitignored, locally-regenerated file absent in this fresh worktree checkout, matching the exact precedent noted in plan 18-01's SUMMARY. Ran `npm run compute-advanced-stats` to populate it locally (out of this plan's file scope, not committed) and reconfirmed a fully clean 749/749 `npm test` pass. Not a plan deviation.

## User Setup Required
None - no external service configuration required. The phase continues to pass with `data/private/athlete-private.json` absent, exactly as designed.

## Verification

- `npm run build` and `npm test` exit 0 — 749/749 tests pass (739 pre-existing + 10 new), 0 regressions.
- Live-archive run (`node -e "require('./dist/analytics/compute-training-load.js').computeTrainingLoad({})..."`) exits 0: 5,475-day spine, `edwards true`, `banister false`, reason naming `data/private/athlete-private.json`.
- `grep -cE '"restingHr"|"birthDate"|"sex"' data/stats/training-load.json` → `0` (T-18-PII-06 closed).
- `grep -n "60" src/analytics/compute-training-load.ts` → no matches (no substituted default resting HR).
- `stat -f%z data/stats/training-load.json` → 1,174,289 bytes, under the 3 MB ceiling.
- No-HR honesty check: 170 of 1,797 run-days have zero HR-bearing runs, all visible in the document.
- Rest-day decay check: day-1 TSB is `0`; 1,797 genuine rest-day CTL decreases across the archive.
- `grep -cE "'data/(streams|activities)" src/analytics/compute-training-load.test.ts` → `0` (fixtures-only test suite, confirmed).

## Next Phase Readiness
- `data/stats/training-load.json` exists with the full `TrainingLoadDocument` contract plan 18-03 defined; plans 18-10/18-11 (Trends training-load tab UI) can read it directly with no refetch needed for the model toggle (both Edwards and Banister series ship in the one document per 18-UI-SPEC § 11).
- No blockers. `TREND-04` remains unmarked in REQUIREMENTS.md per this project's established convention — requirement checkboxes are marked complete only at the phase's validation/human-checkpoint plan, not by individual contributing plans. TREND-04 is claimed by 8 plans in this phase; this plan supplies the build step, not the UI.
- The developer can populate `data/private/athlete-private.json` from the example template at any point; Banister TRIMP will activate automatically on the next `compute-training-load` run with no code changes.

## Self-Check: PASSED

Both created source files (`src/analytics/compute-training-load.ts`, `src/analytics/compute-training-load.test.ts`) confirmed present on disk. Both commits (`db898cc`, `bb51801`) confirmed present in `git log`.

---
*Phase: 18-records-trends-differentiators*
*Completed: 2026-08-11*
