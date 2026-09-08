# Phase 14: Stream Ingestion Foundation - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Every historical and newly-synced activity gets committed per-activity time-series stream data (time, distance, pace, HR, cadence, elevation) in `data/streams/`, or an explicit unavailable flag when no recording exists. Two ingestion paths share one canonical derivation module: a local backfill command parsing FIT/GPX originals from `export_data/` (via `data/provenance.json`), and the daily intervals.icu sync for new activities. Covers STREAM-01, STREAM-02, STREAM-03. No UI work, no best-effort computation (Phase 15), no dashboard contract (Phase 16).

</domain>

<decisions>
## Implementation Decisions

### Committed stream resolution
- **D-01:** Committed streams are **best-effort-grade**: light decimation only (~1-3s sample intervals, roughly native FIT resolution, ~1,300-2,500 points/activity), strip nulls, round numeric precision. Rationale: Phase 15 computes best efforts (400m..marathon) in CI from these committed files — `export_data/` never reaches CI, so committed fidelity is the ceiling on PR accuracy. Charts decimate client-side (Chart.js Decimation plugin); do NOT commit a separate chart-grade tier.
- **D-02:** Backfill enforces a **hard size gate with report**: after writing files it prints a size report (total MB, largest files, git object estimate) and warns if total exceeds ~50MB budget. The command never runs git itself — the user inspects the report and commits manually. No auto-tightening of decimation to fit.

### Missing/partial stream handling
- **D-03:** Stream availability is **per-channel**. Each stream file declares which channels it actually contains (time/distance always present when a file exists; HR, cadence, elevation optional). Critical: ~306 GPX-sourced activities have position/time only (no HR/cadence extensions) — partial is a whole class, not an edge case. Downstream renders exactly what exists (pace+elevation charts, no HR chart, no fake zeros).
- **D-04:** Availability lives in **one committed central manifest** `data/streams/manifest.json`: every activity's availability, channels present, and a reason code when unavailable (e.g., no-original, manual, treadmill). Single source of truth — list views get badges without per-activity fetches; detail views know not to fetch. No per-activity stub files. "Unavailable" = no stream file at all + manifest entry with reason.

### Claude's Discretion
- **Exact JSON schema shape** for `data/streams/<id>.json` — parallel arrays recommended, must include a `schemaVersion` field. Lock the schema BEFORE the backfill runs (re-running against a changed schema means re-committing ~1,850 files).
- **Backfill CLI ergonomics** — idempotent and re-runnable following the existing `consolidate-exports` pattern; progress reporting for ~1,835 files; a validation/summary report so output can be trusted before committing.
- **Cadence unit normalization** — FIT half-cadence convention vs intervals.icu's ambiguous units MUST be verified with an empirical probe against a live intervals.icu payload (same suspicion class as the already-discovered `data`/`data2` latlng quirk) before trusting the field. How the probe is done is Claude's call.
- **GPX hardening** — only 36 of 306 GPX files were sampled for extension absence; reconfirm or harden the regex reader to detect and skip unrecognized extension prefixes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.0 research (locked storage/algorithm decisions)
- `.planning/research/SUMMARY.md` — recommended approach, phase rationale, critical pitfalls 1-5, gaps to address (cadence probe, GPX sampling, unmeasured payload size)
- `.planning/research/PITFALLS.md` — full pitfall catalog (FIT sentinels, repo bloat trajectory, backfill/incremental provenance divergence, GPS-less activities)
- `.planning/research/ARCHITECTURE.md` — pipeline-stage placement, `data/streams/` commit-vs-gitignore rationale, component breakdown
- `.planning/research/STACK.md` — zero-new-dependencies verdict, verified `@garmin/fitsdk` field availability from live decode

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — STREAM-01/02/03 definitions; STREAM-04 (Garmin adapter) explicitly deferred
- `.planning/ROADMAP.md` — Phase 14 goal and success criteria

### Existing data contracts
- `data/provenance.json` — canonical activity id → original FIT/GPX mapping (1,841/1,866 covered; 24 runs without original; regenerate via `consolidate-exports`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/exports/geometry-readers.ts` — existing FIT/GPX readers; extend to pull HR/cadence/altitude/distance/timestamp (currently position-only). FIT decode verified at 7.2ms/file.
- `src/exports/consolidate.ts` (`consolidate-exports` command) — the idempotent, re-runnable local CLI pattern the backfill command should follow.
- `src/sync/intervals-sync.ts` + `src/api/intervals-client.ts` / `intervals-provider.ts` — daily sync already fetches intervals.icu streams for geometry; reuse that response to persist streams incrementally (don't fetch twice).
- `@garmin/fitsdk` (installed) — `recordMesgs` already carry `heartRate`, `cadence`, `distance`, `speed`/`enhancedSpeed`, `altitude`/`enhancedAltitude`. FIT positions are int32 semicircles (× 180/2³¹).

### Established Patterns
- Commit-durable vs gitignore-recomputable split: `data/activities/` (committed) vs `data/stats/` (gitignored). Streams are durable → committed.
- intervals.icu quirks already established: latlng stream = `data` (lat) + `data2` (lng) parallel arrays with index-aligned nulls; HTTP Basic auth with literal username `API_KEY`; dedupe/join by start_date epoch (strava_id is null for Garmin-sourced activities).
- Zero new npm dependencies — regex GPX parsing stays (archive GPX has no extension data).
- Non-blocking failure convention: geo failures don't halt the stats pipeline; stream persistence failures in daily sync should follow the same convention.

### Integration Points
- New canonical `derive-stream.ts` module shared by both backfill and incremental paths (single canonical output shape).
- New local-only backfill CLI command registered in `src/index.ts` (export_data/ is gitignored and structurally unreachable from CI).
- `src/sync/intervals-sync.ts` extended to write `data/streams/<id>.json` + manifest updates for newly-synced activities.
- `data/streams/` is a new committed data family; `.github/workflows/daily-refresh.yml` commit pattern picks it up.

</code_context>

<specifics>
## Specific Ideas

- The size gate matters because this repo has a measured bloat precedent (`data/heatmap/all-points.json`, ~11-13MB/version) — the report-before-commit flow is deliberate, not optional polish.
- Four runs in the archive exist only via phone-app GPX rescued by `consolidate-exports` (never reached Garmin/intervals.icu) — the backfill must handle them like any other provenance-mapped original.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- **Garmin export adapter when export arrives** (`.planning/todos/2026-08-10-garmin-export-adapter-when-export-arrives.md`) — reviewed, kept deferred as STREAM-04. The Garmin bulk export hasn't been delivered; the adapter should be written against the real file structure in `export_data/garmin/` when it lands, not guessed now.

</deferred>

---

*Phase: 14-Stream Ingestion Foundation*
*Context gathered: 2026-08-10*
