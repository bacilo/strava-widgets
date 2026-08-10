---
phase: 14-stream-ingestion-foundation
plan: 01
subsystem: data-pipeline
tags: [typescript, streams, normalization, fit, gpx, intervals-icu, vitest, tdd]

# Dependency graph
requires: []
provides:
  - "Locked, versioned CanonicalStream/RawSample/StreamManifest contracts (src/streams/stream.types.ts)"
  - "Single pure normalization seam (src/streams/derive-stream.ts) converting FIT samples, GPX samples, and intervals.icu streams responses into an identical CanonicalStream shape"
  - "config.streamsDir / config.streamsManifestPath resolution"
affects: ["14-02", "14-03", "14-04", "14-05"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single normalization seam: every write path to a committed data family funnels through one pure function so unit conventions (cadence, bounds) cannot drift between producers"
    - "Bounds-check-then-drop-then-carry-forward for defensive numeric field extraction from binary/API sources"
    - "Per-channel presence computed from actual per-file field presence, never from source-format assumption"

key-files:
  created:
    - src/streams/stream.types.ts
    - src/streams/derive-stream.ts
    - src/streams/derive-stream.test.ts
  modified:
    - src/config/strava.config.ts

key-decisions:
  - "STREAM_SCHEMA_VERSION locked at 1 before any backfill runs, per CONTEXT.md D-01"
  - "No pace array committed — Δd/Δt is fully recoverable downstream, avoiding a second normalization surface"
  - "No lat/lng/latlng ever emitted in CanonicalStream — position data stays transient, used only for the geo distance fallback"
  - "Cadence doubling (raw half-cadence -> steps-per-minute) happens exclusively inside derive-stream.ts, branching on source only for the intervals.icu 0-as-dropout rule"
  - "Decimation ladder (1s -> 2s -> 3s) is a fixed per-file resolution rule, explicitly not a total-bytes budget (that's D-02, a later plan's concern)"

patterns-established:
  - "normalize(id, samples, source) internal function shared by deriveFromSamples and deriveFromIntervalsStreams — both public entry points are thin adapters into one seam"
  - "carryForward() helper: gap-fill by carrying the last valid value, leading gaps take the first valid value — used identically for hr, cadence, alt, and native distance gaps"

requirements-completed: [STREAM-01, STREAM-02, STREAM-03]

# Metrics
duration: 10min
completed: 2026-08-10
---

# Phase 14 Plan 01: Stream Schema and Derivation Seam Summary

**Locked the CanonicalStream schema and built a single pure `derive-stream.ts` normalization function that converts FIT samples, GPX samples, and intervals.icu streams responses into a byte-structurally identical shape, with cadence doubled to steps-per-minute, every numeric field bounds-checked, and channel presence computed per-file.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-10T12:22:00Z (approx, base commit cba24d6)
- **Completed:** 2026-08-10T12:32:00Z
- **Tasks:** 2/2 completed
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- Locked and versioned the committed stream schema (`STREAM_SCHEMA_VERSION = 1`) before any backfill runs, satisfying CONTEXT.md D-01's hard precondition
- Built one pure normalization seam (`deriveFromSamples` / `deriveFromIntervalsStreams`) that both current and future write paths to `data/streams/` will call, eliminating any chance of FIT and intervals.icu cadence units drifting apart
- Empirically-confirmed cadence normalization (raw half-cadence doubling, intervals.icu `0` treated as pause/dropout via carry-forward) implemented and covered by tests matching the exact values from RESEARCH.md's live probe
- Full defensive bounds-checking for hr/cadence/altitude sentinels, with carry-forward gap-filling so no `null` ever reaches a committed array
- Native vs geo (haversine) distance provenance tracked via `distanceSource`, with non-monotonic distance clamped to non-decreasing
- Decimation ladder enforces a hard 3000-sample ceiling per activity inside the pure function itself, so neither producer can bypass it

## Task Commits

Each task was committed atomically:

1. **Task 1: Define the locked stream contracts and config paths** - `a946e86` (feat)
2. **Task 2: Build the canonical derivation seam with full normalization coverage** - `1d49ee6` (test, RED) then `e8520e4` (feat, GREEN)

_TDD task: RED (failing test import) -> GREEN (implementation, 15/15 passing) -> no REFACTOR needed._

## Files Created/Modified

- `src/streams/stream.types.ts` - Locked contracts: `CanonicalStream`, `RawSample`, `StreamChannels`, `StreamSource`, `DistanceSource`, `StreamUnavailableReason`, `StreamManifest`, `StreamManifestEntry`, `STREAM_SCHEMA_VERSION`
- `src/streams/derive-stream.ts` - Pure normalization seam: `deriveFromSamples`, `deriveFromIntervalsStreams`, bounds constants (`HR_MIN`, `HR_MAX`, `CADENCE_RAW_MAX`, `ALT_MIN`, `ALT_MAX`)
- `src/streams/derive-stream.test.ts` - 15 unit tests covering cadence normalization, bounds guards, distance provenance, time/decimation, and no-position-data assertions
- `src/config/strava.config.ts` - Added `streamsDir` and `streamsManifestPath` getters mirroring the existing `activitiesDir` no-throw convention

## Decisions Made

- **No `pace` array in the schema** — pace is `Δd/Δt`, fully recoverable from `t`+`d`; persisting it would duplicate thousands of floats per activity and create a second place for normalization bugs. Enforced by the doc comment in `stream.types.ts`; verified no `pace` identifier exists on `CanonicalStream`.
- **No `lat`/`lng`/`latlng` ever emitted** — position data is used only transiently inside the geo-distance fallback path and never reaches the returned `CanonicalStream` object. Covered by a dedicated test.
- **Cadence branch is source-conditional, not sample-conditional** — the `source === 'intervals'` check for the 0-as-dropout rule lives inside the shared normalizer (not duplicated at each call site), keeping the "cadence-unit logic in exactly one place" requirement from CONTEXT.md intact.
- **carryForward() reused identically across hr/cadence/alt/native-distance gaps** — a single helper rather than four bespoke gap-fillers, reducing the surface for a carry-forward bug to hide in.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria were verified directly:

- `npx tsc --noEmit` exits 0
- `npx vitest run src/streams/derive-stream.test.ts` exits 0 with 15 passing tests (>= 12 required)
- `npx vitest run` (full suite) exits 0 with 82/82 passing (67 existing + 15 new, zero regressions)
- `grep -v '^\s*[/*]' src/streams/derive-stream.ts | grep -c "node:fs\|node:zlib\|IntervalsClient"` outputs `0`
- `node -e "import('./dist/config/strava.config.js')..."` prints a path ending in `data/streams` after `npm run build`
- No file under `data/streams/` was created by this plan

## Self-Check: PASSED

All created files verified present on disk (`src/streams/stream.types.ts`, `src/streams/derive-stream.ts`, `src/streams/derive-stream.test.ts`, `src/config/strava.config.ts`, this SUMMARY.md). All commit hashes verified present in `git log` (`a946e86`, `1d49ee6`, `e8520e4`, `7939fd3`).
