---
phase: 15-best-effort-engine
plan: 03
subsystem: analytics
tags: [typescript, cli, github-actions, best-effort, pipeline-wiring]

# Dependency graph
requires:
  - phase: 15-best-effort-engine (plan 01)
    provides: best-effort.types.ts contracts and best-effort-utils.ts pure sweep/guard/PR functions
  - phase: 15-best-effort-engine (plan 02)
    provides: computeActivityEfforts and computeBestEfforts (manifest-driven archive orchestration)
provides:
  - compute-best-efforts CLI command, npm script, and compute-all-stats chain step
  - Non-blocking daily-refresh.yml CI step (continue-on-error, paired warning) satisfying D-04
  - Verified data/stats/best-efforts.json over the real 1,842-activity archive
  - Corrected totals.activitiesConsidered semantics in compute-best-efforts.ts (excludes skippedNoStream)
affects: [15-04, 16-dashboard-shell, 18-records-and-trends]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy dynamic import for compute-best-efforts, matching the compute-geo-stats/IntervalsSync convention"
    - "Non-blocking CI step pair (continue-on-error + Warn-on-failure) mirroring the geocode precedent"

key-files:
  created: []
  modified:
    - src/index.ts
    - package.json
    - .github/workflows/daily-refresh.yml
    - src/analytics/compute-best-efforts.ts
    - src/analytics/compute-best-efforts.test.ts

key-decisions:
  - "Fixed totals.activitiesConsidered to exclude skippedNoStream entries (was Object.keys(manifest.activities).length = 1867, double-counting the 25 no-stream activities; now 1867 - skippedNoStream = 1842), because the plan's own numeric gate and success criteria require activitiesConsidered to reconcile with the manifest's with_streams count as a figure separate from skippedNoStream. Treated as a Rule 1 bug fix discovered while running the real archive in Task 2, committed separately from Task 2's gitignored-output-only scope."

patterns-established: []

requirements-completed: [REC-01]

# Metrics
duration: 25min
completed: 2026-08-10
---

# Phase 15 Plan 03: Wire compute-best-efforts into CLI, Chain and CI Summary

**`compute-best-efforts` CLI command, npm script, and non-blocking CI step wired into the pipeline; real run over 1,842 committed streams produces a best-efforts file whose totals exactly reconcile with the manifest, all 8,806 efforts sit under their world-record ceiling, and the whole computation completes in ~1 second.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-10T15:19:00Z (approx.)
- **Completed:** 2026-08-10T15:44:27Z
- **Tasks:** 2
- **Files modified:** 5 (3 wiring files + 2 bug-fix files)

## Accomplishments

- Added `computeBestEffortsCommand()` to `src/index.ts`, copying the `computeGeoStatsCommand` lazy-import shape exactly, plus a targeted ENOENT hint pointing at `npm run backfill-streams`.
- Wired best efforts as the fourth (and final) step of `computeAllStatsCommand()`, after basic/advanced/geo stats — best efforts depend on committed streams, not on the other stats outputs.
- Registered the `compute-best-efforts` CLI case, `npm run compute-best-efforts` script, and updated help text (command list, examples, and the existing `compute-all-stats` description).
- Added a non-blocking `Compute best efforts` / `Warn on best-effort failure` step pair to `daily-refresh.yml`, mirroring the geocode precedent exactly (`continue-on-error: true` + conditional warning), with an explanatory comment above the pair and `file_pattern` left untouched.
- Ran the real engine over the full 1,842-activity archive: `data/stats/best-efforts.json` reconciles exactly with the manifest (1,842 considered, 25 skipped-no-stream, 0 unreadable), every one of the 8,806 emitted efforts sits under its world-record speed ceiling, every ranking is ordered and capped at 10 (marathon legitimately empty — longest activity is 34.09 km), and all 180 low-confidence efforts trace back to exactly the 38 `distanceSource: 'geo'` activities.
- Discovered and fixed a totals-definition bug in `compute-best-efforts.ts` (plan 02 code): `activitiesConsidered` was double-counting the 25 no-stream activities instead of reporting only activities computation was actually attempted for.

## Task Commits

Each task was committed atomically:

1. **Task 1: Register the command, the chain step, the npm script and the CI step** - `eb30168` (feat)
2. **[Deviation, Rule 1] Fix `activitiesConsidered` totals bug, discovered during Task 2's real-archive run** - `6e2bdeb` (fix)
3. **Task 2: Run the engine over the real archive and validate the output** - no commit (only the gitignored `data/stats/best-efforts.json` output changed; per the plan's own instruction, no source file is modified by this task)

**Plan metadata:** committed as part of this SUMMARY commit.

## Files Created/Modified

- `src/index.ts` - `computeBestEffortsCommand()`, fourth chain step in `computeAllStatsCommand()`, `compute-best-efforts` switch case, updated help text
- `package.json` - `compute-best-efforts` npm script, grouped after `compute-geo-stats`
- `.github/workflows/daily-refresh.yml` - `Compute best efforts` (`continue-on-error: true`) + `Warn on best-effort failure` step pair, inserted between the geocode-warning step and the widget build step; `file_pattern` unchanged
- `src/analytics/compute-best-efforts.ts` - fixed `totals.activitiesConsidered` to exclude `skippedNoStream` (bug fix, not part of the original plan wiring)
- `src/analytics/compute-best-efforts.test.ts` - added an assertion locking the corrected `activitiesConsidered` semantics in the existing manifest-driven test

## Real Archive Run Results

**Command:** `node dist/index.js compute-best-efforts`
**Wall-clock runtime:** ~1.0 second (well under the 120-second Pitfall-2-regression gate and the CI's 30-minute shared budget)
**Output file:** `data/stats/best-efforts.json`, 2,513,819 bytes (~2.4 MB), gitignored, confirmed untracked via `git status --porcelain data/stats` (empty output)

**Totals block:**
```json
{
  "activitiesConsidered": 1842,
  "activitiesWithEfforts": 1841,
  "effortsComputed": 8806,
  "effortsRejected": 34,
  "lowConfidenceEfforts": 180,
  "skippedNoStream": 25,
  "skippedUnreadable": 0
}
```
This reconciles exactly with `data/streams/manifest.json`'s `with_streams: 1842` / `without_streams: 25`. `schemaVersion` is `1`; `generatedAt` parses as a valid ISO date. `Object.keys(activities).length` is 1841 (≥ 1835 threshold) — one available/readable activity produced zero plausible efforts across all seven targets (its 400m-clearing distance did not survive any target's implausibility guard, plausible given the archive's data-quality noise documented below).

**Rankings:** `400m`, `1k`, `1mi`, `5k`, `10k`, and `half` each hold exactly 10 entries; `marathon` holds 0, because the longest activity in the archive is 34.09 km (id `3475727699`) — matching the plan's stated expectation exactly. All ranking arrays verified strictly non-decreasing by `durationSec` with `rank` running 1..N.

**Rank-1 entries per distance:**
| Distance | Activity ID | Date | Duration | Pace |
|----------|-------------|------|----------|------|
| 400m | 3475726256 | 2019-05-12 | 44.0s | 1:50/km |
| 1k | 3475725513 | 2019-06-09 | 148.9s | 2:29/km |
| 5k | 7827165619 | 2022-09-18 | 1179.3s (19:39) | 3:56/km |
| 10k | 7827165619 | 2022-09-18 | 2383.9s (39:44) | 3:58/km |
| half | 7827165619 | 2022-09-18 | 5211.3s (1:26:51) | 4:07/km |
| marathon | — | — | — | (empty, expected) |

The 5k/10k/half rank-1 entries all belong to the same activity (`7827165619`, a 2022-09-18 session) — internally consistent with a genuine race effort by a strong amateur runner (~4-minute/km pace sustained over 21 km), not suspicious.

**Flagged as suspicious per the plan's own 2:30/km threshold:** the `400m` (1:50/km) and `1k` (2:29/km, just under the threshold) rank-1 entries are faster than typical recreational pace — near-elite short-interval speed. Both sit *under* the world-record ceiling (400m: 9.09 m/s vs. the 9.30 m/s guard; 1k: 6.72 m/s vs. the 7.58 m/s guard) so the D-04 guard correctly does not reject them, but they likely represent short, fast segments within longer track-workout streams (native `distanceSource`, not geo-reconstructed) rather than errors. No fix applied — this is a data-observation, not an implementation defect, and the guard is working as specified.

**Rejection list (34 total, all rows shown — well under the 50-row cap):**
```
3475713251 400m: implied 14.75 m/s exceeds world-record pace 9.30 m/s
3475713616 400m: implied 21.67 m/s exceeds world-record pace 9.30 m/s
3475714543 400m: implied 24.44 m/s exceeds world-record pace 9.30 m/s
3475714700 400m: implied 23.56 m/s exceeds world-record pace 9.30 m/s
3475724360 400m: implied 12.50 m/s exceeds world-record pace 9.30 m/s
3475724852 400m: implied 14.12 m/s exceeds world-record pace 9.30 m/s
3475724988 400m: implied 22.59 m/s exceeds world-record pace 9.30 m/s
3475725513 400m: implied 27.32 m/s exceeds world-record pace 9.30 m/s
3475725842 400m: implied 28.19 m/s exceeds activity max_speed 6.08 m/s
3475725842 1k: implied 15.59 m/s exceeds activity max_speed 6.08 m/s
3475725980 400m: implied 10.71 m/s exceeds world-record pace 9.30 m/s
3475727699 400m: implied 32.14 m/s exceeds activity max_speed 28.90 m/s
3475727928 400m: implied 22.16 m/s exceeds world-record pace 9.30 m/s
3475728044 400m: implied 13.94 m/s exceeds world-record pace 9.30 m/s
3475730418 400m: implied 13.65 m/s exceeds world-record pace 9.30 m/s
3475730418 1k: implied 11.50 m/s exceeds world-record pace 7.58 m/s
3475730936 400m: implied 18.33 m/s exceeds activity max_speed 15.60 m/s
3475731249 400m: implied 11.56 m/s exceeds world-record pace 9.30 m/s
3475732222 400m: implied 16.87 m/s exceeds world-record pace 9.30 m/s
3475734859 400m: implied 19.90 m/s exceeds world-record pace 9.30 m/s
3475734925 400m: implied 19.06 m/s exceeds world-record pace 9.30 m/s
3475735234 400m: implied 22.82 m/s exceeds activity max_speed 4.68 m/s
3475735234 1k: implied 11.54 m/s exceeds activity max_speed 4.68 m/s
3475735234 1mi: implied 7.44 m/s exceeds activity max_speed 4.68 m/s
3475735637 400m: implied 22.77 m/s exceeds world-record pace 9.30 m/s
3475743558 400m: implied 12.73 m/s exceeds world-record pace 9.30 m/s
3540594727 400m: implied 202.45 m/s exceeds activity max_speed 4.70 m/s
3647739864 400m: implied 253.00 m/s exceeds activity max_speed 31.20 m/s
4598855187 400m: implied 195.33 m/s exceeds activity max_speed 24.20 m/s
4667351283 400m: implied 17.05 m/s exceeds activity max_speed 4.30 m/s
5059213289 400m: implied 903.00 m/s exceeds activity max_speed 5.30 m/s
5059213289 1k: implied 903.00 m/s exceeds activity max_speed 5.30 m/s
5059213289 1mi: implied 903.00 m/s exceeds activity max_speed 5.30 m/s
8254185606 400m: implied 13.31 m/s exceeds activity max_speed 5.51 m/s
```
Every rejection is a `400m`/`1k`/`1mi` window — expected, since short target distances are most sensitive to GPS/stream noise producing a locally-implausible implied speed; no `5k`/`10k`/`half`/`marathon` rejections occurred. Several rows (e.g. `5059213289` at 903 m/s, `3647739864` at 253 m/s, `3540594727` at 202.45 m/s) show the `max_speed` guard catching severely corrupt stream segments — the clearest real-world evidence D-04's guard is doing its job.

**Activity `5059204779` (the plan's flagged known-bad archive record, 10.80 km / 20:16 moving time):** did **not** produce any rejections. It appears in `activities` with five plausible-looking efforts (400m in 60.3s, 1k in 240.5s, 1mi in 420.7s, 5k in 1620.3s, 10k in 3420.1s — all well within normal recreational pace, no `1mi`/`half`/`marathon` implausibility). The activity-level `10.80 km / 20:16` summary that made this record "known-bad" appears to be a discrepancy in the *activity record's* own distance/moving_time fields rather than in its `t`/`d` stream arrays, which the engine reads directly and which produced internally-consistent, plausible efforts. This is not a guard rejection but is worth noting: the D-04 guard operates on stream-derived implied speed, not on the activity summary's own (possibly inconsistent) distance/duration fields, so a bad activity-level summary does not by itself trigger a rejection if the underlying stream is coherent.

## Decisions Made

- Fixed `totals.activitiesConsidered` in `compute-best-efforts.ts` to exclude `skippedNoStream` entries (see key-decisions above for full reasoning) — a Rule 1 bug fix, not part of Task 1's wiring scope, discovered only once the real archive was run in Task 2. Committed separately (`6e2bdeb`) between Task 1 and Task 2 so Task 2 itself touches no source files, honoring the plan's explicit "do not modify any source file in this task" instruction for the validation task while still meeting the plan's own hard numeric gate.
- Did not adjust the world-record speed guard or the 2:30/km "suspicious" threshold despite the fast `400m`/`1k` rank-1 entries — both are within the D-04 guard's stated tolerance and the plan's own instruction was to report, not loosen, any surprising real-data findings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `totals.activitiesConsidered` double-counting skipped-no-stream activities**
- **Found during:** Task 2 (first real-archive run, before any validation checks)
- **Issue:** `compute-best-efforts.ts` (plan 02 code) computed `activitiesConsidered: Object.keys(manifest.activities).length`, i.e. the full manifest size (1,867) including the 25 activities with no available stream. The plan's own numeric gate (`data/streams/manifest.json` totals: 1,867 activities, 1,842 available, 25 unavailable) and Task 2's explicit acceptance criteria require `totals.activitiesConsidered` to equal 1,842 — the count of activities computation was actually attempted for — with `skippedNoStream` (25) reported as a separate, non-overlapping figure.
- **Fix:** Changed the totals computation to `Object.keys(manifest.activities).length - skippedNoStream`, added an explanatory comment, and locked the corrected semantics with a new assertion (`expect(doc.totals.activitiesConsidered).toBe(3)`) in the existing manifest-driven test (3 available + 2 unavailable fixture).
- **Files modified:** `src/analytics/compute-best-efforts.ts`, `src/analytics/compute-best-efforts.test.ts`
- **Verification:** `npx vitest run` — 191/191 passing (no regressions); real archive re-run produces `activitiesConsidered: 1842`, matching the manifest exactly
- **Committed in:** `6e2bdeb`

---

**Total deviations:** 1 auto-fixed (Rule 1, totals-definition bug in previously-committed plan 02 code, discovered while satisfying this plan's own numeric acceptance gate)
**Impact on plan:** Necessary correction — without it, the plan's stated success criterion ("the real run reconciles with the manifest — 1,842 considered, 25 skipped, 0 unreadable") could not be satisfied. No scope creep: the fix touches only the totals object's arithmetic, not any computation, guard, or ranking logic.

## Issues Encountered

- Running the full `compute-all-stats` chain (for the plan's `<verification>` check that best-effort output appears in the chain) also re-ran `compute-geo-stats`, which regenerated `data/geo/geo-metadata.json`'s `generatedAt` timestamp. This is a committed (non-gitignored) file, so the timestamp bump was reverted via `git checkout -- data/geo/geo-metadata.json` before committing this plan's changes — an unrelated side effect of verification, not part of this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `compute-best-efforts` is fully wired into the CLI, the `compute-all-stats` chain, and the daily CI pipeline; the daily workflow will recompute best efforts on every run without being able to fail the pipeline (D-04 satisfied).
- `data/stats/best-efforts.json` now exists over the real archive with verified-plausible totals, rankings, and rejections — ready for Phase 15 plan 04's fixture-validation suite (D-05) and Phases 16-18's dashboard/records consumers.
- The `activitiesConsidered` totals-definition fix is a corrected contract going forward; any downstream code that may have assumed the old (buggy) semantics does not yet exist (Phase 15 plan 03 is the first consumer to run the real archive), so no further migration is needed.
- Full test suite (191 tests) is green with no regressions.

---
*Phase: 15-best-effort-engine*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: src/index.ts (computeBestEffortsCommand, chain wiring, switch case, help text present)
- FOUND: package.json (compute-best-efforts script present)
- FOUND: .github/workflows/daily-refresh.yml (Compute best efforts + Warn on best-effort failure steps present, file_pattern unchanged)
- FOUND: src/analytics/compute-best-efforts.ts (activitiesConsidered fix present)
- FOUND: data/stats/best-efforts.json (gitignored, verified via git status --porcelain data/stats producing no output)
- FOUND commits: eb30168, 6e2bdeb (`git log --oneline -5`)
- Re-ran plan-level `<verification>`: `npm run build` exit 0; `npx tsc --noEmit` exit 0; `node dist/index.js help` contains `compute-best-efforts`; `node dist/index.js compute-best-efforts` exit 0 and writes `data/stats/best-efforts.json`; `node dist/index.js compute-all-stats` exit 0 with best-effort summary block present in output; `git status --porcelain data/stats` empty; `npx vitest run` 191/191 passing
- Re-ran all task-level `<acceptance_criteria>`: Task 1 all passing (build, help text, package.json script, workflow grep counts, continue-on-error, file_pattern unchanged, lazy-import count = 2, tsc, vitest); Task 2 all passing (exit 0, verify script prints OK with correct totals, file exists/parses/untracked, runtime ~1s, world-record ceiling check, ranking order check, lowConfidence > 0 check, summary records runtime/size/totals/rank-1/rejections)
