# Phase 15: Best-Effort Engine - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure backend computation: for every activity with a committed stream in `data/streams/`, compute the fastest 400m/1k/1mi/5k/10k/half-marathon/marathon efforts using native distance and timestamp-indexed duration, and write the results (per-activity efforts plus derived PR rankings) to a gitignored records file in `data/stats/` that Phases 16–18 consume. Covers REC-01. No UI work, no dashboard contract (Phase 16), no age-grading/Riegel (Phase 18). Activities without streams (25, flagged in `data/streams/manifest.json`) are a first-class skip, not an error.

</domain>

<decisions>
## Implementation Decisions

### Algorithm (locked upstream — carried forward from v2.0 research + ROADMAP success criteria, not re-discussed)
- **D-01:** Two-pointer O(n) sweep per target distance exploiting monotonic cumulative distance; linear time interpolation at the exact target-distance crossing (never snap to the next sample — that biases results slow by up to one sample interval). Pre-filter: skip an activity for a target when `activity.distance < target * 0.99`.
- **D-02:** Use the committed stream's `d` array (native distance where `distanceSource: 'native'`) and `timestamp[j] - timestamp[i]` durations from the `t` array. Never haversine-recompute, never index-count. Pause gaps in `t` are therefore handled correctly by construction.

### Low-confidence (geo-distance) streams
- **D-03:** The 38 activities with `distanceSource: 'geo'` (haversine-reconstructed, phone GPX) get **all seven distances computed**, with each resulting effort marked `lowConfidence: true`. They remain in PR contention; UI phases can badge or filter. Nothing is silently excluded.

### Implausibility guards
- **D-04:** Sanity checks per effort: implied pace must not exceed the activity's own `max_speed` (from the canonical activity record), and must not beat world-record pace for that distance. A failing effort is **dropped** (the activity's other distances survive) and every rejection is listed with its reason in the compute step's console summary. The step never fails CI — consistent with the repo's non-blocking convention.

### Validation (success criterion 3)
- **D-05:** Pin ~5–10 reference activities as test fixtures — mixed sources (FIT, GPX, intervals.icu), including at least one race — with expected best-effort times manually read from Strava/Garmin Connect's own computed best efforts. Assert within ~1–2% tolerance. The user will need to supply/confirm the Strava-reported values for the chosen fixture activities during execution (a checkpoint, or a documented lookup step).

### Output contract
- **D-06:** One gitignored `data/stats/best-efforts.json` (recomputed every CI run, following the `compute-stats.ts` convention) containing:
  - Per-activity efforts: all seven distances with time, pace, start/end offsets within the run, `lowConfidence` flag.
  - Derived top-N PR ranking per distance.
  - A was-PR-at-the-time marker per effort (enables REC-03 evolution views and REC-04 badges without recomputation).
  - Later phases **read, never recompute** — mirrors how `data/stats/` already pre-computes everything for widgets.

### Claude's Discretion
- Exact JSON schema field names/nesting, top-N size for rankings, and `generated_at`/schema-version metadata conventions (follow existing `data/stats/` file conventions).
- Exact world-record pace table values and the max_speed comparison margin.
- Which specific activities to pick as validation fixtures (present candidates to the user for the Strava-value lookup).
- Whether the compute step is wired into the existing `compute-all-stats` chain or a sibling command — follow whatever `compute-stats.ts`/`compute-advanced-stats.ts` already do.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.0 research (locked algorithm/storage decisions)
- `.planning/research/SUMMARY.md` — two-pointer sweep, native-distance, timestamp-indexing, interpolation, pre-filter; Phase 2 (best-effort) rationale
- `.planning/research/PITFALLS.md` — Pitfall 1 (haversine noise → phantom PRs), Pitfall 2 (O(n²) search), Pitfall 3 (pause gaps / index-based duration), Pitfall 10 (no-stream activities as first-class state), Pitfall 11 (treadmill/manual exclusion)
- `.planning/research/ARCHITECTURE.md` — component 4 (best-effort computation as gitignored derived aggregate alongside compute-stats.ts)

### Locked data contracts from Phase 14
- `src/streams/stream.types.ts` — the locked CanonicalStream schema (v1): `t`/`d` arrays, `distanceSource: 'native' | 'geo'`, per-channel availability; pace is derived from `t`+`d`, never persisted
- `data/streams/manifest.json` — single source of truth for stream availability (1,842 available / 25 unavailable with reason codes)
- `.planning/phases/14-stream-ingestion-foundation/14-CONTEXT.md` — Phase 14 decisions (D-01..D-04) this phase builds on
- `.planning/phases/14-stream-ingestion-foundation/14-PATTERNS.md` — codebase patterns mapped during Phase 14

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — REC-01 definition; REC-02/03/04 (downstream consumers of this phase's output, implemented in Phase 18)
- `.planning/ROADMAP.md` — Phase 15 goal and the three success criteria (native distance, timestamp-indexed, durable gitignored output, validation against references)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/streams/stream.types.ts` — import CanonicalStream/StreamManifest types directly; do not redeclare.
- `src/streams/derive-stream.ts` + tests — the established module/test style for stream-domain pure functions.
- `data/streams/<id>.json` (1,842 files) + `data/streams/manifest.json` — real backfilled input data; iterate via the manifest, not by globbing the directory.
- `src/analytics/` (compute-stats pattern) — existing derived-aggregate convention: pure functions, gitignored JSON output in `data/stats/`, `generated_at` metadata.
- Canonical activity records in `data/activities/` — source of `max_speed` for the sanity guard and `distance` for the pre-filter.

### Established Patterns
- Commit-durable vs gitignore-recomputable split: best-efforts output is cheap to recompute from committed streams → gitignored `data/stats/`.
- Non-blocking failure convention: bad data is reported, never halts the pipeline.
- Vitest colocated `*.test.ts` files; TDD used previously for complex edge-case logic (streak detection) — best-effort sweep is the same class of problem.

### Integration Points
- New pure module(s) under `src/analytics/` (or sibling), wired into the existing stats-computation chain invoked by the daily pipeline.
- Output `data/stats/best-efforts.json` becomes an input to Phase 16's dashboard data contract and Phase 18's records/PR views.

</code_context>

<specifics>
## Specific Ideas

- Fixture validation intentionally uses Strava/Garmin's own computed best efforts as the external reference — the user manually reads those values once, and they get frozen into tests with ~1–2% tolerance.
- The was-PR-at-the-time marker exists specifically so Phase 18's "PR evolution over the years" (REC-03) and "PR badge" (REC-04) need no recomputation.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- **Garmin export adapter when export arrives** (`.planning/todos/pending/2026-08-10-garmin-export-adapter-when-export-arrives.md`) — weak match (score 0.2), already reviewed and deferred as STREAM-04 in Phase 14. Still waiting on the Garmin bulk export delivery; unrelated to best-effort computation.

</deferred>

---

*Phase: 15-Best-Effort Engine*
*Context gathered: 2026-08-10*
