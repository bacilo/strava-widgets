# Best-Effort Fixture Candidates — External Reference Worksheet

Phase 15 Plan 04 (D-05). This worksheet lists candidate activities pulled from the
real `data/stats/best-efforts.json` run (plan 03), computed against the committed
archive of 1,842 activity streams. Each row is one (activity, target distance) pair
the engine computed a time for. The engine's own computed time is shown for
reference only — **do not copy it into "Reported time"**. The point of this
exercise is to write down what Strava (or Garmin Connect, for the intervals.icu
row) independently reports for the same activity and distance, so the engine's
output can be checked against a source it did not produce itself.

## Instructions

1. Open each activity via its lookup link (or, for `i174284902`, open intervals.icu
   or Garmin Connect and find the activity by its date: 2026-08-10).
2. On Strava, open the activity page and read the **Best Efforts** panel for the
   row's target distance. On Garmin Connect, read the equivalent per-activity
   best-effort list.
3. Write the platform's reported time into the `Reported time` column as `MM:SS`
   (or `H:MM:SS` for the half-marathon row, whichever the platform displays).
4. If the platform does not report that distance for that activity, write
   `not available` in `Reported time` — do not estimate or guess. That row will
   be **dropped** from the fixture set in Task 3, not approximated.
5. Note anything odd in the `Notes` column (treadmill segment, GPS dropout,
   obviously-wrong reported value, etc).

## Engine run context (self-contained reference, from the real archive run)

- **Run date:** 2026-08-10T15:46:17.452Z (`data/stats/best-efforts.json` `generatedAt`)
- **Totals:** `activitiesConsidered: 1842`, `activitiesWithEfforts: 1841`, `effortsComputed: 8806`, `effortsRejected: 34`, `lowConfidenceEfforts: 180`, `skippedNoStream: 25`, `skippedUnreadable: 0`
- **Engine's rank-1 time per distance** (the archive's all-time bests, per `rankings[distance][0]`):

| Distance | Activity ID | Date | Duration |
|----------|-------------|------|----------|
| 400m | 3475726256 | 2019-05-12 | 0:44.0 |
| 1k | 3475725513 | 2019-06-09 | 2:28.9 |
| 1mi | 3475725842 | 2019-05-16 | 4:47.0 |
| 5k | 7827165619 | 2022-09-18 | 19:39.3 |
| 10k | 7827165619 | 2022-09-18 | 39:43.9 |
| half | 7827165619 | 2022-09-18 | 86:51.3 |
| marathon | — | — | (empty — longest activity in the archive is 34.09 km) |

## Candidate table

Selection rationale: rows 1-5 are the archive's rank-1 (all-time best) efforts at
400m, 1k, 5k, 10k and half — the values the developer is most likely to recognise
and where accuracy matters most. Row 6 is the fastest `geo`-sourced (GPX,
reconstructed-distance) candidate in the archive — no geo-sourced activity cracked
any distance's top-10 ranking, so this row checks accuracy on the `lowConfidence`
source path specifically (D-03). Rows 7-8 are the sole `intervals`-sourced
activity in the archive (`i174284902`, the only stream ingested via the daily
intervals.icu path rather than the FIT/GPX bulk export), at its two most
commonly-reported target distances. Rows 1 and 2 already cover the mandatory
short-distance requirement (RESEARCH.md Pitfall 4), so no additional 400m/1k row
was needed.

| # | Activity ID | Date (UTC) | Source | distanceSource | Activity distance | Target | Engine computed time | Reported time | Notes | Lookup |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 3475726256 | 2019-05-12 05:46 UTC | fit | native | 32.05 km | 400m | 0:44.0 | | | https://www.strava.com/activities/3475726256 |
| 2 | 3475725513 | 2019-06-09 06:57 UTC | fit | native | 32.01 km | 1k | 2:28.9 | | | https://www.strava.com/activities/3475725513 |
| 3 | 7827165619 | 2022-09-18 09:16 UTC | fit | native | 21.35 km | 5k | 19:39.3 | | | https://www.strava.com/activities/7827165619 |
| 4 | 7827165619 | 2022-09-18 09:16 UTC | fit | native | 21.35 km | 10k | 39:43.9 | | | https://www.strava.com/activities/7827165619 |
| 5 | 7827165619 | 2022-09-18 09:16 UTC | fit | native | 21.35 km | half | 86:51.3 | | | https://www.strava.com/activities/7827165619 |
| 6 | 9716153503 | 2023-08-25 05:16 UTC | gpx | geo | 11.91 km | 5k | 26:18.4 | | | https://www.strava.com/activities/9716153503 |
| 7 | i174284902 | 2026-08-10 05:51 UTC | intervals | native | 11.26 km | 5k | 27:50.9 | | | intervals.icu / Garmin Connect — find by date 2026-08-10 |
| 8 | i174284902 | 2026-08-10 05:51 UTC | intervals | native | 11.26 km | 10k | 56:52.5 | | | intervals.icu / Garmin Connect — find by date 2026-08-10 |

**Sanity check while filling this in:** on 5k and above the engine's computed
time and the platform's reported time should agree to within a couple of
seconds. A difference of more than a few percent on a long effort (rows 3-8) is
worth flagging in Notes rather than accepting silently.
