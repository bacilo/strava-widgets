---
phase: 14-stream-ingestion-foundation
plan: 02
subsystem: data-pipeline
tags: [typescript, fit, gpx, vitest, tdd, fitsdk, geometry, manifest]

# Dependency graph
requires:
  - phase: 14-01
    provides: "RawSample/StreamManifest/StreamChannels/StreamUnavailableReason contracts (src/streams/stream.types.ts)"
provides:
  - "Multi-channel raw sample extraction from FIT (fitRecordsToSamples, readFit) and GPX (readGpxText, readGpx) originals, returning RawSample[] alongside the existing coordinates field"
  - "Gzipped GPX (.gpx.gz) reading — readOriginal no longer throws for the two archive files in that format"
  - "Central, idempotent, atomic, sorted, diff-stable stream availability manifest (src/streams/stream-manifest.ts): emptyManifest/loadManifest/upsertAvailable/upsertUnavailable/saveManifest"
affects: ["14-03", "14-04", "14-05"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raw-field extraction stays in geometry-readers.ts; unit normalization (cadence x2) stays exclusively in derive-stream.ts — cadence-unit logic lives in exactly one place"
    - "Read-merge-write idempotent manifest: rebuild totals from entries on every save, only bump generated_at when the sorted-entries payload actually changed vs disk"
    - "Sorted-key serialization for diff-stable committed JSON (localeCompare insertion order; for all-digit activity ids this also coincides with V8's automatic integer-key ascending enumeration)"

key-files:
  created:
    - src/exports/geometry-readers.test.ts
    - src/streams/stream-manifest.ts
    - src/streams/stream-manifest.test.ts
  modified:
    - src/exports/geometry-readers.ts

key-decisions:
  - "coordinates in OriginalRecording is now derived from the produced samples[] (single pass) rather than a separate loop — matches plan instruction, no behavior change for real FIT files since every record in practice carries a timestamp"
  - "readGpxText uses a two-phase collect-then-assign approach for the missing-time fallback, so a point with no <time> that precedes the first timed point still gets a correct fallback (first-timed-point epoch + index), not just points that follow the first point"
  - "saveManifest's own existing-file read for change-detection swallows any read/parse error and treats it as 'no existing file' — safe because saveManifest doesn't merge state from disk, it just decides whether to bump generated_at; T-14-07's strict-throw guarantee lives in loadManifest, which callers use to build the merged state"

patterns-established:
  - "fitRecordsToSamples/readGpxText are pure, exported functions so multi-channel extraction is unit-testable without export_data/ (gitignored, absent from CI)"
  - "Two-phase point collection in readGpxText (collect all points with optional time/ele, then assign tEpochS in a second pass) instead of streaming assignment, so the missing-time fallback rule works regardless of which point in the sequence lacks a <time>"

requirements-completed: [STREAM-01, STREAM-03]

# Metrics
duration: 20min
completed: 2026-08-10
---

# Phase 14 Plan 02: Multi-Channel Geometry Readers and Stream Manifest Summary

**Extended FIT/GPX readers from position-only to full RawSample[] extraction (time, distance, HR, raw cadence, altitude) and gzipped-GPX support, plus a new idempotent, atomically-written, diff-stable central availability manifest module both ingestion paths will write into.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-10T12:36:00Z (approx, base commit b39b987)
- **Completed:** 2026-08-10T12:40:03Z
- **Tasks:** 2/2 completed
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `fitRecordsToSamples` extracts every field RESEARCH.md verified via live decode (timestamp, distance, heartRate, cadence, fractionalCadence, enhancedAltitude/altitude fallback, semicircle position), guarded by `typeof === 'number'` with no default substitution, cadence emitted RAW and undoubled
- `readFit` rebuilt on `fitRecordsToSamples` in one pass; `coordinates` derived from the same samples so `consolidate.ts`'s existing `recording.coordinates` usage is unbroken
- `readGpxText` (new, exported) replaces the old two-independent-regex approach with a per-`<trkpt>` block scan (handles both open/close and self-closing forms) so `lat`/`lon`/`<time>`/`<ele>` stay associated per point; missing-time points fall back to the first-timed-point's epoch plus index
- `readOriginal` no longer throws `gzipped gpx not implemented` — the two archive `.gpx.gz` files now gunzip and decode via `readGpxText`
- Verified against the real archive: a real FIT file yields 1,061 samples (>500 required), and both real `.gpx.gz` files decode successfully (969 samples on the first)
- `stream-manifest.ts` provides `emptyManifest`/`loadManifest`/`upsertAvailable`/`upsertUnavailable`/`saveManifest` per the locked `stream.types.ts` contracts, reusing `FileStore.writeJson`'s atomic temp-then-rename rather than a second write primitive
- `saveManifest` recomputes `totals` from the entries on every save and only bumps `generated_at` when the sorted-entries payload differs from disk — a no-op re-run produces a byte-identical file, satisfying D-02's inspect-before-commit flow
- `loadManifest` throws (does not silently reset to empty) on a genuine parse failure of an existing manifest — mitigates T-14-07

## Task Commits

Each task was committed atomically (TDD RED -> GREEN, no REFACTOR needed for either task — implementation was clean on first pass):

1. **Task 1: Extend the FIT and GPX readers to multi-channel raw samples** - `8ff1c03` (test, RED) then `0fdf6fd` (feat, GREEN)
2. **Task 2: Build the central stream availability manifest** - `3f95f1a` (test, RED) then `e740918` (feat, GREEN)

## Files Created/Modified

- `src/exports/geometry-readers.ts` - Extended `OriginalRecording` with `samples: RawSample[]`; added exported `fitRecordsToSamples`; rewrote `readFit` to build `coordinates`+`samples` in one pass; extracted `readGpxText` from `readGpx`'s body with a per-`<trkpt>`-block scan; `readOriginal` gunzips `.gpx.gz` instead of throwing
- `src/exports/geometry-readers.test.ts` - 16 tests covering `fitRecordsToSamples` field extraction/guards/undoubled-cadence, `readGpxText` per-point extraction/missing-time-fallback/self-closing-form/empty-input, and `readOriginal`'s no-longer-throws behavior for `.gpx.gz` — all synthetic inputs, no `export_data/` dependency
- `src/streams/stream-manifest.ts` - `emptyManifest`, `loadManifest` (no-throw-on-missing, throw-on-parse-failure), `upsertAvailable`/`upsertUnavailable` (overwrite semantics), `saveManifest` (sorted serialization, recomputed totals, stable `generated_at`)
- `src/streams/stream-manifest.test.ts` - 9 tests covering all manifest behaviors, using a real `FileStore` rooted at an `fs.mkdtempSync`-created temp dir (atomic-write path exercised for real, not mocked), with `vi.useFakeTimers()` isolating the generated_at-changes test from millisecond-resolution wall-clock flakiness

## Decisions Made

- **`coordinates` derived from `samples`, not a separate loop** — the plan's "one pass over `messages.recordMesgs ?? []` by calling `fitRecordsToSamples`" instruction is implemented literally: `readFit` calls `fitRecordsToSamples` once, then filters the resulting samples for `lat`/`lng` presence to build `coordinates`. This means a hypothetical FIT record with position but no timestamp would be dropped from `coordinates` (since `fitRecordsToSamples` skips no-timestamp records entirely) — a narrow behavior change from the prior implementation, but real FIT records always carry a timestamp per RESEARCH.md's live-decode findings, and the full-suite `consolidate.ts` regression test (`npx vitest run`) plus a live read against the real archive (1,061 samples produced) confirm no observable regression.
- **`readGpxText` two-phase point collection** — points are first fully collected (lat/lng/time/ele) before any `tEpochS` is assigned, so the "fall back to the first point's time + index" rule is correct even when the very first point in sequence lacks a `<time>` but a later point has one. A naive single-pass streaming approach would fail this case since no fallback base would be known yet when processing the first point.
- **`saveManifest`'s own disk-read for change-detection swallows errors** — distinct from `loadManifest`'s strict-throw. `saveManifest` isn't merging state, only deciding whether to reuse the on-disk `generated_at`; a corrupt/missing file there simply means "treat as changed, stamp a new timestamp," which is safe because the full correct manifest is written regardless. T-14-07's data-loss mitigation is scoped to `loadManifest`, the function actual merge call sites use.

## Deviations from Plan

None — plan executed as written. One test-quality fix during TDD iteration (not a plan deviation, a self-authored test flakiness fix): the `generated_at`-changes test in `stream-manifest.test.ts` initially compared two real wall-clock `new Date().toISOString()` values that could collide at millisecond resolution on a fast run; switched to `vi.useFakeTimers()`/`vi.setSystemTime()` with a 1-minute gap between the two `saveManifest` calls to make the assertion deterministic.

## Issues Encountered

- `export_data/` (the real archive originals) is gitignored and does not exist inside this isolated worktree's filesystem by default — each git worktree has its own working tree and gitignored files aren't shared. To run the plan's real-archive acceptance criterion (`node -e "import('./dist/exports/geometry-readers.js')..."`), a temporary local symlink to the main repo's `export_data/` was created for verification only, then removed before the final commit (confirmed via `git status --short` that nothing tracked the symlink). This was verification-only tooling, not a code or plan change.

## Next Phase Readiness

- `fitRecordsToSamples`/`readGpxText`/`readFit`/`readGpx`/`readOriginal` are ready for plan 14-03's backfill CLI to call directly, producing `RawSample[]` that funnels into plan 14-01's `deriveFromSamples`.
- `stream-manifest.ts`'s five exports are ready for both the backfill CLI (14-03/14-04) and the daily `intervals-sync.ts` extension to read-merge-write into `data/streams/manifest.json` — no manifest file has been created on disk by this plan (verified: `data/streams/` does not exist), only the helpers that will write it.
- No blockers identified for 14-03.

## Self-Check: PASSED

All created/modified files verified present on disk (`src/exports/geometry-readers.ts`, `src/exports/geometry-readers.test.ts`, `src/streams/stream-manifest.ts`, `src/streams/stream-manifest.test.ts`, this SUMMARY.md). All commit hashes verified present in `git log` (`8ff1c03`, `0fdf6fd`, `3f95f1a`, `e740918`).

---
*Phase: 14-stream-ingestion-foundation*
*Completed: 2026-08-10*
