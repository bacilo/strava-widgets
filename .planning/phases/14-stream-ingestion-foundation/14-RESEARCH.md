# Phase 14: Stream Ingestion Foundation - Research

**Researched:** 2026-08-10
**Domain:** Time-series (FIT/GPX/API stream) parsing and derivation for a static, git-committed data pipeline
**Confidence:** HIGH

## Summary

Phase 14 extends an already-proven pipeline, not a new system. Two ingestion paths — a local-only backfill CLI reading FIT/GPX originals from `export_data/` (never present in CI), and the existing `IntervalsSync` daily flow — must both funnel through one canonical `derive-stream.ts` module and write identical-shape `data/streams/<id>.json` files plus a single central `data/streams/manifest.json`. Every fact needed to size and de-risk this phase was verified directly in this session, not assumed: the true GPX population, the FIT field set on real archive files (including a device-generation gap), the cadence unit convention on both sources (confirmed identical), and a concrete, already-existing edge case where 2 activities will fall through both ingestion paths unless explicitly handled.

**Primary recommendation:** Build `derive-stream.ts` as a pure function `(rawSource) -> CanonicalStream`, called from three producers — the FIT/GPX backfill CLI, `IntervalsSync`'s per-activity loop, and (new, not previously scoped) a small "intervals catch-up" pass for already-archived `source_provider: 'intervals'` activities that have neither an export original nor a stream file. Store `t`/`d` (time, distance) as the only always-present channels; `hr`/`cadence`/`alt` optional per-file; normalize cadence to steps-per-minute at ingestion (×2, both sources use the same raw half-cadence convention — confirmed empirically, see below); never store a derived `pace` array (fully recoverable from `t`+`d`, redundant to persist).

## Architectural Responsibility Map

This phase has no browser/frontend tier — it is a two-path data pipeline feeding a committed data store, consumed by later phases.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| FIT/GPX original parsing | Local-only backfill CLI | — | `export_data/` is gitignored, structurally absent from CI runners |
| intervals.icu stream fetch (new activities) | CI daily pipeline (`IntervalsSync`) | — | Already fetches this response for geometry; extend, don't duplicate |
| intervals.icu stream fetch (already-archived, no-original activities) | CI daily pipeline (new catch-up step) OR local backfill | — | New gap this research discovered (see Open Questions) — must be assigned to one producer, not silently dropped |
| Canonical stream shape / normalization (cadence, sentinel-guarding) | Shared module (`derive-stream.ts`) | — | Single seam both producers call through, per CONTEXT.md decision; prevents shape/unit drift |
| Committed stream storage (`data/streams/<id>.json`) | Git-committed data layer | — | Sources vanish (local export never in CI; intervals.icu ~1yr retention) — same reasoning as `data/activities/` |
| Availability/reason-code bookkeeping | Committed manifest (`data/streams/manifest.json`) | — | Single source of truth per CONTEXT.md D-04; avoids per-activity fetches for badges |
| Size-gate reporting | Local backfill CLI (report only, no git action) | — | CONTEXT.md D-02 — user inspects and commits manually |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STREAM-01 | Local backfill command parses FIT/GPX originals from `export_data/` via `data/provenance.json` into committed per-activity stream files | Verified exact backfill-eligible population (1841, see Standard Stack); confirmed `readFit`/`readGpx` field gaps to close; confirmed `consolidateExports`'s idempotent-CLI pattern to extend |
| STREAM-02 | Daily pipeline fetches streams from intervals.icu for new activities, persists in canonical format, cadence normalized against FIT convention | Empirically confirmed intervals.icu's cadence stream uses the SAME raw half-cadence convention as FIT (not pre-doubled SPM) — HIGH confidence, live-probed; identified `IntervalsSync.syncNewActivities()` as the exact extension point |
| STREAM-03 | Activities without recoverable streams flagged, not crashing the pipeline | Enumerated and classified all 24 archive-wide no-original activities (23 confirmed `manual: true`, 1 needs a new reason path); discovered 2 additional activities needing a reason-code decision beyond STREAM-03's stated scope (see Open Questions) |

## Standard Stack

### Core

No new libraries. Everything Phase 14 needs is already an installed, verified dependency.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@garmin/fitsdk` | 21.212.0 (installed = npm latest, checked live) | FIT decode | Already integrated in `geometry-readers.ts`; `recordMesgs` confirmed (live decode, this session) to carry `heartRate`, `cadence`, `fractionalCadence`, `distance`, `speed`/`enhancedSpeed`, `altitude`/`enhancedAltitude`, `timestamp` |
| Node.js built-in regex + `node:zlib` | Node 22 | GPX parsing, gzip | `readGpx()`'s regex approach already validated; `gunzipSync` already imported for `.fit.gz`, just needs reuse for the 2 `.gpx.gz` files (currently `throw new Error('gzipped gpx not implemented')`) |
| `IntervalsClient` / `IntervalsProvider` (existing, `src/api/`) | n/a (internal) | intervals.icu streams fetch | `fetchGeometry`/`getAllStreams` already fetch the exact response streams need; extend extraction, don't add a second request |
| Vitest | 4.0.18 (installed) | Unit tests for `derive-stream.ts` and extended readers | Existing project test framework, `src/**/*.test.ts` pattern already proven (`intervals-provider.test.ts`) |

**Installation:** None required. `npm install` is a no-op for this phase.

**Version verification:** `npm view @garmin/fitsdk version` → `21.212.0`, matches `node_modules/@garmin/fitsdk/package.json` exactly (checked live, this session). `[VERIFIED: npm registry]`

### Package Legitimacy Audit

**Not applicable — this phase installs zero new packages.** `@garmin/fitsdk` is an existing, already-audited dependency (see `.planning/research/STACK.md`); no new registry surface is introduced. No `slopcheck` run needed.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────┐        ┌──────────────────────────────┐
                    │  export_data/ (LOCAL     │        │  intervals.icu API (daily CI) │
                    │  ONLY, gitignored)       │        │  IntervalsClient.getAllStreams│
                    │  1,803 .fit.gz           │        └───────────────┬───────────────┘
                    │  36 .gpx + 2 .gpx.gz     │                        │
                    └────────────┬─────────────┘                        │
                                 │                                      │
                    ┌────────────▼─────────────┐          ┌─────────────▼──────────────┐
                    │ backfill-streams (local   │          │ IntervalsSync               │
                    │ CLI, extends              │          │ .syncNewActivities()        │
                    │ consolidate-exports       │          │ per-activity loop            │
                    │ pattern)                  │          │ (already fetches this        │
                    │ reads data/provenance.json│          │ response for geometry)       │
                    └────────────┬─────────────┘          └─────────────┬──────────────┘
                                 │  raw record sequence                  │  raw stream response
                                 │  (FIT recordMesgs / GPX trkpt)        │
                                 └───────────────┬────────────────────────┘
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │   derive-stream.ts (NEW)      │
                                  │   pure fn, single canonical   │
                                  │   shape for both sources:     │
                                  │   - sentinel/bounds guard     │
                                  │   - cadence ×2 normalize      │
                                  │   - per-channel presence flag │
                                  └───────┬──────────────┬────────┘
                                         │                │
                          has streams?  │                │  no recoverable original
                          ┌─────────────▼──┐    ┌─────────▼──────────────┐
                          │ data/streams/  │    │ data/streams/manifest  │
                          │ <id>.json      │    │ .json entry:           │
                          │ (committed)    │    │ available:false,       │
                          │ t,d, hr?,      │    │ reason: manual |       │
                          │ cadence?, alt? │    │ no-original | treadmill│
                          └────────────────┘    └────────────────────────┘
                                                 (both paths ALSO write here
                                                  when they DO succeed, with
                                                  available:true + channels[])
```

**Reading this diagram:** Backfill is local-only and one-time-ish (re-run when the archive changes or a new export lands); incremental runs every day in CI on new activities only. Both converge on `derive-stream.ts` so their output is byte-for-byte structurally identical. The manifest is written by both paths, unconditionally, for every activity id they touch (success or failure) — this is what makes it a reliable single source of truth for downstream badges instead of an inferred "file exists" check.

### Recommended Project Structure

```
src/
├── streams/                    # NEW
│   ├── derive-stream.ts        # canonical (raw source) -> stream shape, pure function
│   ├── derive-stream.test.ts   # unit tests: sentinel guards, cadence normalization, channel presence
│   ├── backfill-streams.ts     # local CLI command (or --streams flag on consolidate.ts)
│   └── stream-manifest.ts      # manifest read/write/merge helpers
├── exports/
│   └── geometry-readers.ts     # EXTEND: readFit/readGpx pull hr/cadence/distance/altitude/timestamp
├── sync/
│   └── intervals-sync.ts       # EXTEND: persist stream + manifest entry per newly-synced activity
data/
└── streams/                    # NEW, committed
    ├── manifest.json           # single central availability index
    └── <id>.json               # one per activity with recoverable streams
```

### Pattern 1: Shared canonical derivation, three producers

**What:** One `deriveStream()` function consumes either a FIT `recordMesgs` array, a GPX `trkpt` sequence, or an intervals.icu streams response, and emits the same `{schemaVersion, channels, t, d, hr?, cadence?, alt?}` shape.
**When to use:** Every write path to `data/streams/`.
**Example:**
```typescript
// New module, following the existing readOriginal() dispatch pattern in geometry-readers.ts
export interface CanonicalStream {
  schemaVersion: 1;
  id: string;
  sampleCount: number;
  channels: { time: true; distance: boolean; hr: boolean; cadence: boolean; elevation: boolean };
  t: number[];      // seconds since activity start
  d: number[];      // cumulative meters (native device/API value, NOT haversine-recomputed)
  hr?: number[];    // bpm
  cadence?: number[]; // steps per minute (normalized — see Pitfall below)
  alt?: number[];    // meters, rounded to 0.1m
}
```

### Pattern 2: Non-blocking, per-activity failure isolation

**What:** A stream-derivation failure for one activity warns and continues; it never aborts the whole backfill or sync run.
**When to use:** Both `backfill-streams` (over ~1,841 files) and `IntervalsSync`'s per-activity loop.
**Example (existing convention to replicate, from `intervals-sync.ts`):**
```typescript
// Source: src/sync/intervals-sync.ts:109-126 (existing pattern, apply identically to stream persistence)
try {
  const geometry = await this.provider.fetchGeometry(String(activity.id), { ... });
  // ...
} catch (error: any) {
  console.warn(`  ${activity.id}: streams fetch failed (${error.message}); saving without route`);
}
```

### Anti-Patterns to Avoid

- **Storing a derived `pace` array:** CONTEXT.md's channel list mentions "pace," but pace is `Δd/Δt` — fully recoverable from `t`+`d` at zero storage cost. Persisting it duplicates ~1,300-2,500 floats per activity for no capability gain and creates a second place normalization bugs can hide. Compute pace downstream (Phase 15/16), not in the committed file.
- **Trusting `data/provenance.json`'s `archive_without_original` list as the complete "unavailable" set:** it is scoped to Strava-export matching only. It misses `source_provider: 'intervals'` activities that were synced before Phase 14 landed and never got a provenance entry at all (see Open Questions — 2 concrete instances found this session).
- **Re-fetching a second intervals.icu streams request for geometry AND cadence separately:** `IntervalsSync` already calls `fetchGeometry`, which calls `getStreams`/`getAllStreams`. Extend what's extracted from that one response; a second request per activity doubles daily API load for no reason.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| FIT decoding | A custom binary FIT parser | `@garmin/fitsdk` (already installed, official) | Already returns every needed field; verified live this session |
| GPX gzip decompression | A new decompression path | `gunzipSync` from `node:zlib` (already imported in `geometry-readers.ts` for `.fit.gz`) | One-line reuse; the throw for `.gpx.gz` is the only gap |
| Idempotent, re-runnable CLI bookkeeping | A new "already processed" tracking mechanism | Skip-if-file-exists against `data/streams/<id>.json`, mirroring `consolidate-exports`'s `archiveById`/`archiveByEpoch` pre-index pattern | Proven pattern in this exact codebase at this exact file count |
| Atomic JSON writes | Custom write-then-verify logic | `FileStore.writeJson()` (existing, temp-file-then-rename) | Already handles partial-write safety; reuse for `data/streams/` |

**Key insight:** Every piece of infrastructure this phase needs (decoder, gzip, atomic writes, idempotent CLI skeleton, non-blocking failure convention) already exists in this codebase in a directly adjacent file. The work is almost entirely field-extraction and normalization logic, not new plumbing.

## Common Pitfalls

### Pitfall 1: Cadence unit mismatch between FIT and intervals.icu — RESOLVED empirically this session

**What goes wrong (as previously flagged, MEDIUM confidence):** FIT's `cadence` field is documented as half-cadence (single-leg rpm); intervals.icu's convention was unverified community-forum speculation.

**What was found (this session, HIGH confidence — live probe):**
- Live `GET /activity/{id}/streams?types=cadence` against a real recent run (`i174284902`, 2026-08-10) returned integer values in the **69-91 range** for a run whose summary `average_cadence` field was **87.19–90.18** across 5 sampled recent activities.
- A live-decoded FIT file from the same person (`export_data/strava/activities/18353469270.fit.gz`, Feb 2026) showed raw `cadence` field values around **86-88** with a separate `fractionalCadence` of `0` or `0.5`, averaging **87.6** across 1,061 samples.
- These numbers match almost exactly. **intervals.icu's cadence stream and summary field pass through the same raw half-cadence (single-leg rpm) convention as FIT — it is NOT already-doubled steps-per-minute.** A typical running cadence of ~87 rpm × 2 = ~174 spm is plausible; treating the raw ~87 as already-SPM would be implausibly low for running.

**How to avoid:** Apply `displayed_spm = 2 * cadence` to intervals.icu-sourced cadence samples, and `displayed_spm = 2 * (cadence + fractionalCadence)` to FIT-sourced samples (FIT retains the 0.5-step precision intervals.icu's integer stream does not expose). Normalize both to the same unit **inside `derive-stream.ts`**, not at the call site, so the committed schema never carries raw half-cadence.

**Residual unknown:** The intervals.icu cadence stream showed occasional `0` values interspersed with plausible values (e.g., a run of `0, 0, 0` mid-stream) — likely a stop/pause marker or a null-to-zero coercion by the API, not measured against a definitively-known pause window this session. Treat `0` as a probable dropout/pause sentinel, not a real "cadence stopped" data point — guard it the same way FIT position sentinels are guarded, and confirm against a known-paused activity during implementation.

**Confidence:** HIGH — `[VERIFIED: intervals.icu API live probe, this session, activity i174284902]` cross-checked against `[VERIFIED: @garmin/fitsdk live decode, this session, file 18353469270.fit.gz]`.

### Pitfall 2: The "306 GPX files" figure in prior research and CONTEXT.md is wrong — corrected this session

**What goes wrong:** CONTEXT.md's Claude's Discretion section says "only 36 of 306 GPX files were sampled for extension absence; reconfirm or harden the regex reader." Prior research (STACK.md, PITFALLS.md) both state "306 `.gpx` in `export_data/strava/`."

**What was found (this session, HIGH confidence — direct filesystem measurement):**
```
find export_data/strava/activities -iname "*.gpx" -o -iname "*.gpx.gz"  → 38 files (36 .gpx + 2 .gpx.gz)
find export_data/strava/routes     -iname "*.gpx"                       → 270 files
```
The 270 files in `export_data/strava/routes/` are **Strava "Routes" (pre-planned courses)**, not recorded activities — confirmed by inspecting one (`routes/183.gpx`: `<name>13,45 ITU - home</name>`, no `<time>` elements, no activity id, authored by the account owner as a planned course). They have no corresponding activity record anywhere in `data/activities/` and are structurally irrelevant to stream ingestion — there is no id to attach a stream file to. Prior research conflated this directory's file count with the activity-GPX count.

**Corrected population:** 36 GPX + 2 GPX.GZ = **38 activity-recording GPX files total, not 306.** All 38 (100% of the true population, not a 36/306 sample) were grepped this session for `gpxtpx|extensions|<hr>|cadence|heartrate|atemp`: **zero matches across every file.** The "GPX hardening" discretion item in CONTEXT.md is materially descoped: no sampling gap remains to close — the entire population has been checked and confirmed extension-free. The one real remaining task is implementing gzip support for the 2 `.gpx.gz` files, which `readOriginal()` currently rejects outright (`throw new Error('gzipped gpx not implemented')`).

**How to avoid:** Planner should size "GPX hardening" as a small, bounded task (add `gunzipSync` branch, ~5 LOC) rather than an open-ended verification task. If GPX extension namespace variability is still a planning concern, it can be closed with HIGH confidence, not flagged as an open risk.

**Confidence:** HIGH — `[VERIFIED: direct filesystem grep, this session, 38/38 files]`

### Pitfall 3: Backfill/incremental provenance divergence has a live, concrete instance today — not just a theoretical risk

**What goes wrong (as previously flagged generically, Pitfall 10 in PITFALLS.md):** activities landing between "backfill's bookkeeping was last generated" and "the incremental sync's own dedupe" can be silently orphaned from streams.

**What was found (this session, HIGH confidence — direct data inspection):**
- 55 activities in `data/activities/` currently have `source_provider: 'intervals'` (already synced via the Aug 2026 migration, before Phase 14 exists).
- 53 of these 55 happen to have a usable original in `export_data/` — matched by `start_date` epoch to a row in the last Strava CSV export, which still covered these recent months. These will backfill normally through the FIT/GPX path.
- **2 do not:** `i174110124` (2026-03-09) and `i174284902` (2026-08-10, today's run, synced during this research session). Neither has a `data/provenance.json` entry at all (not even a "no original" flag — they're simply invisible to `consolidateExports`, which only indexes the `strava` export source).
- Once Phase 14 wires stream persistence into `IntervalsSync.syncNewActivities()`, these 2 activities will **not** be picked up, because that method only processes activities not yet on disk (dedup by `start_date` epoch) — and both are already on disk.

**How to avoid:** These 2 (and any more that accumulate before Phase 14 ships — this grows by roughly 1/day) are neither "STREAM-01 backfill-eligible" (no export original) nor "STREAM-02 new-activity" (already synced). They need a third, explicit reconciliation pass: for every `data/activities/*.json` with `source_provider === 'intervals'` and no `data/streams/<id>.json`, fetch streams directly from the live intervals.icu API (same call `fetchGeometry`/`getAllStreams` already makes), keyed by the intervals activity id — intervals.icu's ~1yr retention window comfortably covers activities this recent. This can be a small, explicit step in either the backfill CLI or a one-time reconciliation script; it should not be assumed away as "covered by STREAM-01" or "covered by STREAM-02," because it is covered by neither as currently scoped.

**Confidence:** HIGH — `[VERIFIED: direct inspection of data/activities/ + data/provenance.json, this session]`

### Pitfall 4: Device-generation gap — some FIT files have no cadence/speed field at all, independent of GPX-vs-FIT source

**What goes wrong:** D-03's "partial is a whole class, not an edge case" framing (CONTEXT.md) was stated specifically about the 306 (really 38) GPX files. This session found the same partiality exists **within FIT-sourced activities too**, based on recording device generation, not source format.

**What was found (this session, HIGH confidence — live decode comparison):**
- `export_data/strava/activities/3711989581.fit.gz` (2017-05-18 recording): `recordMesgs` carried `heartRate`, `distance`, `altitude`, `timestamp` — but **no `cadence` field on any record** (0 of N records had a numeric cadence). This appears to be an older device/app without a footpod or wrist-based cadence sensor.
- `export_data/strava/activities/18353469270.fit.gz` (2026-02-02 recording): full field set including `cadence`+`fractionalCadence`.

**How to avoid:** The per-channel-optional design (CONTEXT.md D-03) must be driven by **actual field presence in each decoded file**, not by source-format assumption (`FIT ⇒ has cadence`, `GPX ⇒ doesn't`). `derive-stream.ts` should set `channels.cadence = false` whenever zero records in a given file carry a numeric cadence value, regardless of whether the source was FIT or GPX. This affects the manifest design: `channels` presence needs per-file computation, not a per-source-type default.

**Confidence:** HIGH — `[VERIFIED: @garmin/fitsdk live decode, this session, 2 files across different device generations]`

### Pitfall 5-9 (carried forward, unchanged from prior research — still apply)

The following pitfalls from `.planning/research/PITFALLS.md` were reviewed against this phase's actual scope and remain valid without new findings this session; consult that document's full detail during planning:

- **Recomputing distance from lat/lng instead of native FIT `distance`** — applies to Phase 15 (best-effort computation), but the stream schema decision (store native cumulative `d`, never haversine-recompute) is made **in this phase** and cannot be patched later without re-deriving all ~1,841 files.
- **FIT sentinel/invalid values** (`0x7FFFFFFF` position, per-field max-sentinels) — `readFit()`'s existing `typeof === 'number'` guard is necessary but not sufficient; extend bounds-checking to every new field pulled (`heartRate`, `cadence`, `distance`, `altitude`), not just position.
- **Full-resolution streams blowing repo size** — measured this session: current committed `data/` totals ~38MB (`activities` 7.5M + `heatmap` 13M + `geo` 15M + `routes` 2.3M), git objects ~90MB total (`git count-objects -vH`: 62.84 MiB packed + 27.35 MiB loose). The prior ~15-35MB stream estimate would roughly double committed `data/` size — still comfortably under GitHub's guidance, but confirms the D-02 size-gate report is worth taking seriously as a real, not theoretical, check.
- **Client-side/browser pitfalls (routing, stale cache, bulk-loading)** — out of scope for this phase (no UI work per CONTEXT.md's phase boundary).

## Code Examples

### Extending `readFit()` for stream fields (verified field names against live decode)

```typescript
// Extends src/exports/geometry-readers.ts readFit() — field names confirmed via
// live decode of export_data/strava/activities/18353469270.fit.gz, this session
for (const rec of messages.recordMesgs ?? []) {
  const t = rec.timestamp instanceof Date ? rec.timestamp : undefined;
  const distance = typeof rec.distance === 'number' ? rec.distance : undefined;
  const heartRate = typeof rec.heartRate === 'number' ? rec.heartRate : undefined;
  const cadenceRaw = typeof rec.cadence === 'number' ? rec.cadence : undefined;
  const fractionalCadence = typeof rec.fractionalCadence === 'number' ? rec.fractionalCadence : 0;
  const cadenceSpm = cadenceRaw !== undefined ? 2 * (cadenceRaw + fractionalCadence) : undefined;
  const altitude = typeof rec.enhancedAltitude === 'number' ? rec.enhancedAltitude
    : typeof rec.altitude === 'number' ? rec.altitude : undefined;
  // ... push into parallel arrays, skipping records where the whole record is a sentinel
}
```

### Cadence normalization for intervals.icu streams (empirically confirmed convention)

```typescript
// intervals.icu's cadence stream uses the SAME raw half-cadence convention as
// FIT — confirmed by live probe, this session (activity i174284902: stream
// values 69-91 match average_cadence 87-90 across 5 recent runs, and match a
// live-decoded FIT file's raw cadence field, avg 87.6). No fractional
// component is exposed on this stream (integers only), unlike FIT.
function normalizeIntervalsCadence(raw: number[]): number[] {
  return raw.map(v => (v === 0 ? 0 : v * 2)); // treat 0 as a probable pause/dropout marker, not 0 spm
}
```

### GPX gzip support (the one real gap in the "306 files" GPX hardening item)

```typescript
// src/exports/geometry-readers.ts readOriginal() — replace the throw:
if (filePath.endsWith('.gz')) {
  const text = gunzipSync(fs.readFileSync(filePath)).toString('utf-8');
  return readGpxText(text); // extract readGpx()'s body into a text-accepting helper
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Position-only stream extraction (`readFit`/`readGpx` pull only `positionLat`/`positionLong`) | Multi-channel extraction (add `heartRate`, `cadence`, `distance`, `altitude`, `timestamp`) | This phase | Foundational — every later v2.0 phase depends on this |
| `data/provenance.json` as the sole source-of-truth for "does this activity have an original" | Provenance is necessary but not sufficient — must be supplemented with a `source_provider === 'intervals'`-aware reconciliation, per Pitfall 3 above | This phase (newly discovered) | Prevents 2+ activities from silently having no stream path at all |
| Cadence convention "unverified, flagged for probe" (prior research MEDIUM confidence) | Cadence convention confirmed identical (raw half-cadence) on both FIT and intervals.icu, HIGH confidence | This session | Normalization logic can be written with confidence instead of defensive guessing |

**Deprecated/outdated:** The "306 GPX files, only 36 sampled" framing from CONTEXT.md and prior research — superseded by this session's direct measurement (38 real activity-GPX files, 100% checked).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Intervals.icu's `0` cadence stream values represent pause/dropout, not genuine zero-cadence samples | Pitfall 1 | If wrong, real slow-cadence walking segments within a run could be miscoded as dropouts and dropped, slightly skewing avg-cadence stats. Low impact (cosmetic), verify against a known-paused activity during implementation. |
| A2 | The 2 currently-orphaned intervals-sourced activities (and any that accumulate before Phase 14 ships) can be resolved via a live intervals.icu API call keyed by activity id, since intervals.icu retains ~1yr of data | Pitfall 3 | If intervals.icu's retention window has already rolled past `i174110124` (2026-03-09, ~5 months old at research time) by the time this phase executes, that one activity would need a `no-original` manifest entry instead of a resolved stream. Low risk — well within the documented ~1yr window, but confirm at implementation time, not later. |
| A3 | No GPX file outside the 38 found in `export_data/strava/activities/` exists elsewhere in the export tree (e.g., a second export drop, other providers) | Pitfall 2 | If a future Garmin export (`export_data/garmin/`, STREAM-04, deferred) contains GPX with real HR/cadence extensions, the "extension-free" assumption would need re-verification for that source specifically — already flagged as out-of-scope per the deferred Garmin adapter todo. |

## Open Questions

1. **Who owns the "already-archived intervals-activity, no original, no stream" reconciliation — backfill CLI or a new one-time script?**
   - What we know: 2 concrete activities need it today (`i174110124`, `i174284902`); more will accumulate before this phase ships (daily-refresh.yml runs `sync-intervals` every night).
   - What's unclear: Whether to fold this into `backfill-streams` as a third code path (in addition to FIT and GPX), or ship it as a separate small reconciliation command that hits the live API. Both are reasonable; the backfill CLI already has the idempotent/re-runnable skeleton this needs.
   - Recommendation: Fold into the backfill CLI as a third branch — `for each data/activities/*.json with source_provider === 'intervals' and no data/streams/<id>.json: fetch via IntervalsClient, derive, write`. Keeps STREAM-01's "one command reconciles everything local-export-adjacent" property intact rather than adding a fourth CLI command to remember to run.

2. **Manifest reason-code taxonomy: is "manual" sufficient for all 23 confirmed manual entries, or does the schema need to distinguish "genuinely no recording ever existed" from "recording existed but wasn't in the export"?**
   - What we know: All 23 non-intervals `archive_without_original` activities have `manual: true`, `trainer: false` in their canonical record — these are real Strava manual entries (user-typed distance/time, no device recording ever existed).
   - What's unclear: Whether any future Garmin export (STREAM-04, deferred) might retroactively supply a recording for one of these 23 (unlikely if `manual: true` is accurate, but not verified against Garmin's own history).
   - Recommendation: `manual` reason code is safe to use for all 23 as currently understood. Treat `treadmill` as a distinct reason code reserved for future use (Strava's schema doesn't currently flag any of these 23 as `trainer: true`, so no activity in the archive needs that code today) — build the taxonomy to be extensible, but don't over-engineer a case with zero current instances.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `export_data/strava/` (local FIT/GPX originals) | STREAM-01 backfill | Yes (local machine only) | 1,803 `.fit.gz` + 36 `.gpx` + 2 `.gpx.gz` | None — structurally required, local-only by design |
| `data/provenance.json` | STREAM-01 backfill id→file mapping | Yes | Generated 2026-08-10, covers 1,841/1,866 | Regenerate via `node dist/index.js consolidate-exports` if stale |
| intervals.icu API + `INTERVALS_API_KEY` | STREAM-02 incremental, STREAM-03 catch-up | Yes — verified live this session (auth succeeded, activities fetched) | API v1 | `continue-on-error: true` already the established CI convention for this call |
| `@garmin/fitsdk` | FIT decode | Yes, installed | 21.212.0 (= npm latest) | None needed |
| Node.js 22 | Runtime | Yes (project standard) | 22 | None needed |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None — all required tooling already present and verified live.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` (`include: ['src/**/*.test.ts']`, `environment: 'node'`) |
| Quick run command | `npm test -- src/streams` (once test files exist) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| STREAM-01 | `deriveStream()` produces correct `{t,d,hr?,cadence?,alt?}` shape from a FIT-shaped `recordMesgs` fixture | unit | `npx vitest run src/streams/derive-stream.test.ts` | ❌ Wave 0 |
| STREAM-01 | `deriveStream()` correctly omits `hr`/`cadence`/`alt` channels when zero records carry that field (device-gap case, Pitfall 4) | unit | same file | ❌ Wave 0 |
| STREAM-02 | Cadence normalization: FIT-sourced (`2*(cadence+fractionalCadence)`) and intervals.icu-sourced (`2*cadence`, 0-guarded) converge to the same SPM range for equivalent inputs | unit | `npx vitest run src/streams/derive-stream.test.ts` | ❌ Wave 0 |
| STREAM-02 | `IntervalsSync` persists a stream file + manifest entry per newly-synced activity without a second network request | unit/integration (mock `IntervalsClient`) | `npx vitest run src/sync/intervals-sync.test.ts` | ❌ Wave 0 — no existing test file for `intervals-sync.ts` |
| STREAM-03 | Backfill run against a fixture set produces `available:false` + correct reason code for manual/no-original activities, `available:true` for parseable ones | unit | `npx vitest run src/streams/backfill-streams.test.ts` | ❌ Wave 0 |
| STREAM-03 | Manifest write is idempotent/re-runnable (second run against unchanged input produces no diff) | unit | same file | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/streams` (fast, no network, fixture-based)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green, plus a real (non-mocked) local run of the backfill CLI against a small subset of `export_data/` before the full 1,841-file run — per the D-02 size-gate report, this should also be manually eyeballed before the real commit.

### Wave 0 Gaps

- [ ] `src/streams/derive-stream.test.ts` — covers STREAM-01, STREAM-02 (shape, channel-presence, cadence normalization)
- [ ] `src/streams/backfill-streams.test.ts` — covers STREAM-01, STREAM-03 (idempotency, reason codes)
- [ ] `src/sync/intervals-sync.test.ts` — no existing test file for this module at all; needed to cover STREAM-02's persistence-without-double-fetch behavior with a mocked `IntervalsClient`
- [ ] Fixture data: a small synthetic FIT-shaped `recordMesgs` array (with and without cadence, to exercise Pitfall 4) and a synthetic intervals.icu streams response (including a `0`-cadence run, to exercise the Pitfall 1 guard) — no framework install needed, Vitest is already configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|--------------------|
| V2 Authentication | No | No new auth surface — reuses existing `INTERVALS_API_KEY` HTTP Basic pattern, unchanged this phase |
| V3 Session Management | No | Stateless CLI/CI pipeline, no sessions |
| V4 Access Control | No | Single-user personal tool, no multi-tenant concerns |
| V5 Input Validation | Yes | Defensive parsing of externally-sourced binary (FIT) and semi-trusted API JSON — bounds-check every numeric field extracted, treat FIT sentinel values as missing (extend the existing `typeof === 'number'` guard pattern in `geometry-readers.ts`) |
| V6 Cryptography | No | No new cryptographic operations this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Malformed/truncated FIT or GPX file crashes the backfill mid-run | Denial of Service (availability) | Per-file try/catch, warn-and-skip — extend the existing non-blocking convention (`intervals-sync.ts`'s pattern) to `backfill-streams.ts`'s loop over 1,841 files; one bad file must not abort the run |
| FIT sentinel value (`0x7FFFFFFF`-adjacent) surfaces as a plausible-looking extreme number in a new field (`heartRate`, `cadence`, `altitude`) | Tampering (data integrity) | Bounds-check every new field the same way position is already bounds-checked (±90/±180); reject implausible HR (e.g., >250bpm), cadence (e.g., >150 raw), altitude (e.g., outside -500m..9000m) as missing rather than storing |
| Committed stream JSON inadvertently includes precise start/end GPS (privacy) | Information Disclosure | Not applicable this phase — D-01/Anti-Pattern 2 in prior ARCHITECTURE.md already excludes lat/lng from `data/streams/`; this phase's schema (t/d/hr/cadence/alt) carries no position data at all |
| `export_data/` (123MB, full-resolution GPS+HR, gitignored) accidentally staged in a future commit | Information Disclosure | Pre-existing `.gitignore` entry; out of scope to add new tooling this phase, but the backfill CLI must never write anything under `export_data/` |

## Sources

### Primary (HIGH confidence — verified live, this session)

- Live decode: `export_data/strava/activities/18353469270.fit.gz` (2026-02-02) — confirmed `cadence`, `fractionalCadence`, `heartRate`, `distance`, `speed`, `altitude`, `timestamp` all present on `recordMesgs`
- Live decode: `export_data/strava/activities/3711989581.fit.gz` (2017-05-18) — confirmed cadence/speed absent on an older device recording (Pitfall 4)
- Live intervals.icu API probe (this session): `GET /athlete/0/activities?oldest=...` (30 activities, all runs, `average_cadence` 87-90 range) and `GET /activity/i174284902/streams?types=cadence` (raw stream values 69-91) — `INTERVALS_API_KEY` from local `.env`, written nowhere, no writes performed
- Direct filesystem measurement: `find export_data/strava/activities -iname "*.gpx*"` (38), `find export_data/strava/routes -iname "*.gpx*"` (270, confirmed as Strava Routes/courses via content inspection of `routes/183.gpx`)
- Direct filesystem measurement: `grep -l "gpxtpx|extensions|<hr>|cadence|heartrate|atemp"` across all 38 activity-GPX files → 0 matches
- Direct data inspection: `data/provenance.json` (`archive_total: 1866`, `archive_without_original: 24`), cross-referenced against `data/activities/*.json` for `manual`/`trainer`/`source_provider` fields on all 24
- Direct data inspection: 55 `source_provider: 'intervals'` activities in `data/activities/`, cross-referenced against `data/provenance.json` (53 matched by epoch, 2 with no provenance entry at all)
- `git count-objects -vH` (this session): 62.84 MiB packed + 27.35 MiB loose; `du -sh data/*`: activities 7.5M, heatmap 13M, geo 15M, routes 2.3M, stats 172K (gitignored)
- `npm view @garmin/fitsdk version` (this session) → `21.212.0`, matches installed `node_modules/@garmin/fitsdk/package.json`
- Direct repo inspection: `src/exports/geometry-readers.ts`, `src/exports/consolidate.ts`, `src/api/intervals-provider.ts`, `src/api/intervals-client.ts`, `src/sync/intervals-sync.ts`, `src/index.ts`, `src/storage/file-store.ts`, `src/types/strava.types.ts`, `.github/workflows/daily-refresh.yml`, `vitest.config.ts`, `package.json`, `.gitignore`

### Secondary (MEDIUM confidence)

- `.planning/research/SUMMARY.md`, `ARCHITECTURE.md`, `STACK.md`, `PITFALLS.md` — prior v2.0 milestone research; used as baseline, corrected where this session's live verification diverged (GPX population count, cadence convention certainty)
- User memory `intervals-icu-migration.md` — dedupe-by-epoch, `data`/`data2` latlng quirk, ~1yr intervals.icu retention window

### Tertiary (LOW confidence)

- None carried forward as unresolved LOW-confidence claims in this document — the two prior LOW/MEDIUM items this research was specifically tasked with resolving (cadence convention, GPX sampling completeness) were both upgraded to HIGH via live verification this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all existing tooling verified live
- Architecture: HIGH — extends directly-inspected existing code paths, no new architectural concepts
- Pitfalls: HIGH — the two previously-MEDIUM/open items (cadence convention, GPX population) were resolved via live verification this session; one new concrete pitfall (orphaned intervals-activities) discovered and quantified

**Research date:** 2026-08-10
**Valid until:** ~14 days (fast-moving: intervals.icu-sourced orphan count in Pitfall 3 grows daily via the existing `daily-refresh.yml` cron; re-verify the exact orphan list immediately before implementation rather than trusting this document's "2" count)
