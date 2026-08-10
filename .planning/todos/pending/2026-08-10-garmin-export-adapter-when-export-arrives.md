---
created: 2026-08-10T10:10:04.854Z
title: Garmin export adapter when export arrives
area: api
files:
  - src/exports/consolidate.ts
  - src/exports/geometry-readers.ts
  - data/provenance.json
---

## Problem

User requested their Garmin Connect bulk export (2026-08-09) and will drop it
into `export_data/garmin/` (gitignored) alongside the already-consolidated
Strava export. `consolidate-exports` currently reports any non-strava
directory under `export_data/` as "awaiting adapter" and skips it.

Without the adapter, the Garmin export is dead weight: not inventoried, not
reconciled against the canonical archive (`data/activities/`, 1,866 runs),
and not indexed in `data/provenance.json`. Expected to be mostly duplicates
of the Strava originals, but it is the only Garmin-native record — anything
Garmin has that never synced to Strava (cf. the 0-km GPS blip `i174110124`
that exists nowhere else) would only surface here. It also completes the
user's goal of a platform-independent authoritative archive feeding future
custom dashboarding.

## Solution

Add a garmin source branch in `src/exports/consolidate.ts` following the
strava adapter pattern. IMPORTANT (lesson learned repeatedly this project):
**probe the real export structure first, do not code against assumed
formats** — the intervals.icu latlng stream took four attempts because of
guessed shapes.

Known going in:
- Garmin exports typically ship `DI_CONNECT/DI-Connect-Fitness-Uploaded-Files/`
  with zipped batches of FIT files plus JSON summaries — verify against the
  actual download before writing anything.
- FIT decoding already works: `readFit()` in geometry-readers.ts via
  `@garmin/fitsdk` (positions are int32 semicircles × 180/2³¹).
- Join to archive by start_date epoch (proven unique, 113/113 +
  1,861/1,865 exact matches) or via existing provenance strava external_ids
  (`garmin_ping_*` and FIT session start times).
- Validate any imported geometry with `IntervalsProvider.validateGeometry`
  (accept 0.6–1.6x of recorded distance) as the strava adapter does.
- Re-run `consolidate-exports` (idempotent) + regenerate stats/geo/routes/
  heatmap if anything imports.

See also `~/.claude` project memory `intervals-icu-migration` for the full
migration context.
