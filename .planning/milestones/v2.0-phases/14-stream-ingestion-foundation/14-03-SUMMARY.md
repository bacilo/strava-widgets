---
phase: 14-stream-ingestion-foundation
plan: 03
subsystem: data-pipeline
tags: [typescript, streams, backfill, fit, gpx, vitest, cli-core]

# Dependency graph
requires:
  - phase: 14-01
    provides: "deriveFromSamples normalization seam, RawSample/StreamManifest/StreamUnavailableReason contracts, config.streamsDir/streamsManifestPath"
  - phase: 14-02
    provides: "readOriginal multi-channel FIT/GPX extraction (RawSample[]), loadManifest/upsertAvailable/upsertUnavailable/saveManifest manifest helpers"
provides:
  - "backfillStreams(): walks data/provenance.json, decodes every linked FIT/GPX original, writes data/streams/<id>.json via deriveFromSamples, records availability in the manifest"
  - "classifyUnavailable(): reason-code taxonomy (manual/treadmill/no-original) for activities with no recoverable original"
  - "buildBackfillTargets(): pure provenance-to-targets resolver with idempotent skip-if-exists selection"
affects: ["14-05"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Index-then-process: existingStreamIds and archiveById built before the main loop, so skip/classify decisions inside the loop never touch the filesystem again"
    - "Per-item try/catch isolating one bad original among ~1,841 from aborting the run, mirroring consolidate.ts's non-blocking-failure convention"
    - "Pure target-selection function (buildBackfillTargets) kept filesystem-free so idempotency and path resolution are unit-testable without export_data/"

key-files:
  created:
    - src/streams/backfill-streams.ts
    - src/streams/backfill-streams.test.ts

key-decisions:
  - "classifyUnavailable implements 'treadmill' as specified in this plan's acceptance criteria, even though RESEARCH.md's planning-time resolution had deferred it as a zero-instance future addition — the PLAN.md task spec (with explicit acceptance criteria requiring trainer:true -> 'treadmill') is the authoritative execution contract, and implementing it now costs one branch with no downside"
  - "buildBackfillTargets dedupes ids that could be listed both via provenance.activities (entry with no original) and via provenance.archive_without_original, using a Set before converting to the returned withoutOriginal array"
  - "No stub stream file is ever written for withoutOriginal activities — only a manifest entry, per CONTEXT.md D-04 ('unavailable' means no file at all plus a manifest entry)"

patterns-established:
  - "Progress reporting every 100 processed items (of ~1,841) so a multi-minute local run stays observable without flooding the log per-item"

requirements-completed: [STREAM-01, STREAM-03]

# Metrics
duration: ~10min
completed: 2026-08-10
---

# Phase 14 Plan 03: Local Backfill Core Summary

**`backfillStreams()` walks `data/provenance.json`, decodes ~1,841 provenance-linked FIT/GPX originals through the plan 14-01/14-02 seam into committed `data/streams/<id>.json` files, and flags every activity without a recoverable original with a measured reason code — all isolated by per-item try/catch and idempotent on re-run.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-10T12:41:00Z (approx, base commit bb33e5a)
- **Completed:** 2026-08-10T12:45:21Z
- **Tasks:** 2/2 completed
- **Files modified:** 2 (both created)

## Accomplishments

- Built the backfill core (`backfillStreams`) mirroring `consolidate.ts`'s index-then-process, per-item try/catch, final-summary-block shape
- `classifyUnavailable` implements the measured reason-code taxonomy: `manual` (23 real archive instances), `treadmill` (zero current instances, extensibility branch), `no-original` (fallback, including `source_provider: 'intervals'` orphans)
- `buildBackfillTargets` resolves provenance `original` values (`"<source>:<relative/path>"`) into `export_data/<source>/<relative/path>` paths, generically for any future source directory (Garmin included) with no code change needed
- Idempotency: activities already backed by a `data/streams/<id>.json` file are excluded from both `withOriginal` and `withoutOriginal` before any processing happens
- Every touched activity gets a manifest entry on both success and failure paths — `upsertAvailable` for a written stream, `upsertUnavailable` with `no-samples`/`unreadable-original` for decode failures, and the reason-code branch for activities with no original at all
- One bad original among ~1,841 cannot abort the run — proven by the per-item `try/catch` around `readOriginal`/`deriveFromSamples`

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the backfill core over provenance-linked originals** - `b9e565a` (feat)
2. **Task 2: Cover classification, target selection, and idempotency** - `b394199` (test)

## Files Created/Modified

- `src/streams/backfill-streams.ts` - `backfillStreams()` (the CLI-core async function), `classifyUnavailable()`, `buildBackfillTargets()`, plus local `ProvenanceEntry`/`ProvenanceDoc`/`ArchiveRecord` types and `resolveOriginalPath()` helper
- `src/streams/backfill-streams.test.ts` - 11 tests covering `classifyUnavailable` (manual/treadmill/no-original/intervals-source/manual-wins-priority) and `buildBackfillTargets` (strava and non-strava path resolution, archive_without_original inclusion, missing-original fallback, idempotency exclusion, cross-source dedup) — all literal inputs, no `export_data/` dependency

## Decisions Made

- **Implemented `treadmill` reason code despite RESEARCH.md's "deferred" note** — RESEARCH.md's planning-time resolution (line 318) said `treadmill` was deliberately NOT implemented since zero archive activities need it today. However, this plan's own task spec and acceptance criteria (lines 102, 128-130, 163 of `14-03-PLAN.md`) explicitly require `classifyUnavailable({trainer:true})` to return `'treadmill'`. The concrete PLAN.md task is the authoritative execution contract for this plan, so it was implemented as specified — a single extra branch with zero downside, and it satisfies the plan's own automated verification (`buildBackfillTargets`/`classifyUnavailable` acceptance criteria).
- **`buildBackfillTargets` deduplicates via a `Set`** — an id could theoretically appear in both `provenance.activities` (as an entry with no `original`) and `provenance.archive_without_original` (as observed in the live `data/provenance.json` structure documented in the plan's Interfaces section). A `Set` before converting to the returned array prevents a duplicate entry in `withoutOriginal`, tested explicitly.
- **No stub file for `withoutOriginal` activities** — only the manifest gets an entry; `data/streams/<id>.json` is never written for unavailable activities, matching CONTEXT.md D-04 literally.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria verified directly:

- `npx tsc --noEmit` exits 0
- `src/streams/backfill-streams.ts` exports `backfillStreams`, `classifyUnavailable`, and `buildBackfillTargets`
- `classifyUnavailable({manual:true,trainer:false})` returns `'manual'`
- `classifyUnavailable({trainer:true})` returns `'treadmill'`
- `classifyUnavailable({source_provider:'intervals'})` returns `'no-original'`
- `buildBackfillTargets` resolves `"strava:activities/x.fit.gz"` to `export_data/strava/activities/x.fit.gz`
- `grep -v '^\s*[/*]' src/streams/backfill-streams.ts | grep -c "git \|execSync\|spawnSync"` outputs `0`
- `backfillStreams` contains a `try`/`catch` inside the per-original loop (`catch (error: any)` calling `upsertUnavailable` with `'unreadable-original'`)
- `npx vitest run src/streams/backfill-streams.test.ts` exits 0 with 11 passing tests (>= 9 required)
- Suite passes with `export_data/` renamed away (`mv export_data export_data.bak`, ran tests, `mv` back) — exit 0
- A test asserts an id in `existingStreamIds` appears in neither `withOriginal` nor `withoutOriginal`
- A test asserts `classifyUnavailable` returns `'treadmill'` for `trainer: true`
- `npx vitest run` (full suite) exits 0 with 118/118 passing (107 existing + 11 new, zero regressions)

## Issues Encountered

None.

## Next Phase Readiness

- `backfillStreams`, `classifyUnavailable`, and `buildBackfillTargets` are exported and ready for plan 14-05 to register as a CLI command, add the D-02 size-gate report, and layer in the intervals reconciliation branch (the two orphaned `source_provider: 'intervals'` activities from RESEARCH.md Pitfall 3).
- No CLI wiring (`src/index.ts`) was touched, staying clear of the parallel plan 14-04 executor's `src/index.ts` changes.
- No blockers identified for 14-05.

## Self-Check: PASSED

All created files verified present on disk (`src/streams/backfill-streams.ts`, `src/streams/backfill-streams.test.ts`, this SUMMARY.md). All commit hashes verified present in `git log` (`b9e565a`, `b394199`).

---
*Phase: 14-stream-ingestion-foundation*
*Completed: 2026-08-10*
