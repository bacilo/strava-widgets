---
phase: 14-stream-ingestion-foundation
verified: 2026-08-10T15:35:00Z
status: passed
score: 31/31 must-haves verified
overrides_applied: 0
---

# Phase 14: Stream Ingestion Foundation Verification Report

**Phase Goal:** Every historical and newly-synced activity has committed time-series stream data (pace, HR, cadence, elevation), or an explicit flag when unavailable, ready for downstream computation.
**Verified:** 2026-08-10T15:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

**Roadmap Success Criteria**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Backfill produces committed per-activity stream files (time, distance, pace, HR, cadence, elevation) for export-covered historical activities | ✓ VERIFIED | `data/streams/` contains 1,842 `<id>.json` files; FIT spot-check (`10041312551.json`) shows `channels: {time,distance,hr,cadence,elevation: all true}`, `sampleCount: 939`. Pace is deliberately derivable (`Δd/Δt`) rather than stored — an explicit, documented CONTEXT.md D-01 design decision, not a gap. |
| 2 | Daily pipeline persists intervals.icu streams for newly-synced activities in the same canonical format, cadence normalized against FIT convention | ✓ VERIFIED | `src/sync/intervals-sync.ts:128` calls `fetchGeometry({allChannels:true, ...})`; line 144 calls `deriveFromIntervalsStreams`. Real reconciled activity `i174284902.json` (produced via the same intervals.icu code path) shows cadence min 102/max 184/mean ~177, zero `0`-entries — confirms Assumption A1 (0 = dropout, not real zero-cadence) empirically. |
| 3 | Activities with no recoverable original recording are marked with a stream-unavailable flag rather than causing pipeline failures | ✓ VERIFIED | `data/streams/manifest.json` totals: `{activities:1867, with_streams:1842, without_streams:25, by_reason:{manual:23, no-original:1, no-samples:1}}`. Backfill run completed across the full archive without aborting. |

**Plan-Level Must-Have Truths (14-01 .. 14-05, merged and deduplicated)**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 4 | Committed stream schema locked/versioned before any stream file written | ✓ VERIFIED | `STREAM_SCHEMA_VERSION = 1` in `src/streams/stream.types.ts:19`; committed 14-01 before any `data/streams/` write (git log order: schema commit `a946e86`/`e8520e4` precedes backfill commit `4ad338f`). |
| 5 | One shared function normalizes FIT-shaped, GPX-shaped, and intervals.icu samples to an identical `CanonicalStream` shape | ✓ VERIFIED | `deriveFromSamples`/`deriveFromIntervalsStreams` both funnel into a shared `normalize()` in `derive-stream.ts`; real committed files from all three sources (`fit`, `gpx`, `intervals`) share identical top-level schema (`schemaVersion, id, source, distanceSource, sampleCount, channels, t, d, hr?, cadence?, alt?`) — confirmed by spot-checking one file of each source type. |
| 6 | Cadence lands as steps-per-minute, never raw half-cadence | ✓ VERIFIED | Real archive cadence values cluster 100-190 spm range in spot checks (never ~half that), consistent with the ×2 normalization; `derive-stream.test.ts` covers this directly (15 tests). |
| 7 | D-01 best-effort-grade: light decimation only, nulls stripped, precision rounded, no chart-grade tier | ✓ VERIFIED (see note) | All 1,842 committed files use the 1-3s decimation ladder; zero `null`/`NaN` entries found across a full scan of all 1,842 files' `t/d/hr/cadence/alt` arrays. **Note:** REVIEW.md's WR-02 (decimation ladder doesn't hard-cap at 3000 samples for activities >~2.5h) is confirmed to manifest in the real archive — 10 of 1,842 files exceed 3000 samples (max 4,121). This does not violate the "light decimation" truth itself (files are still decimated at 1-3s spacing per the fixed ladder) and does not block downstream consumption; it is a narrower Task-2 acceptance-criterion miss, already tracked in 14-REVIEW.md (WR-02). See Gaps Summary. |
| 8 | D-03: per-channel availability computed from actual per-file field presence | ✓ VERIFIED | GPX spot-check (`10146303423.json`): `channels: {hr:false, cadence:false, elevation:true}` — matches the documented "38 archive GPX files carry no HR/cadence extensions" population. |
| 9 | Channel absent from source is omitted entirely, not zero-filled | ✓ VERIFIED | Same GPX spot-check: no `hr`/`cadence` keys present in the object at all (not empty arrays or zero arrays). |
| 10 | Out-of-bounds and sentinel values never reach a committed file | ✓ VERIFIED (real data) | Full scan of all 1,842 committed files found zero `null`/`NaN` entries in any numeric array. REVIEW.md's CR-01 (non-finite GPX timestamps could theoretically produce `null` in `t`) is a real latent code defect but did not manifest in any of the 1,842 real committed files — verified by direct execution/scan, not assumption. Tracked separately in 14-REVIEW.md as a fast-follow. |
| 11 | FIT original yields per-record HR, cadence, distance, altitude, timestamp | ✓ VERIFIED | `fitRecordsToSamples` exported and tested (`geometry-readers.test.ts`); real FIT spot-check confirms all channels populated. |
| 12 | GPX original yields per-point time and elevation | ✓ VERIFIED | `readGpxText` exported and tested; real GPX spot-check confirms `channels.elevation === true`. |
| 13 | The two gzipped GPX originals in the archive are readable, not throwing | ✓ VERIFIED | `readOriginal` gunzip branch implemented and tested; real backfill run (1,842 files written, 0 unreadable-original failures reported for GPX) confirms no regression. |
| 14 | D-04: one committed central manifest that both ingestion paths write to | ✓ VERIFIED | `data/streams/manifest.json` exists as the single availability index; both `backfill-streams.ts` and `intervals-sync.ts` import and call `loadManifest`/`upsertAvailable`/`upsertUnavailable`/`saveManifest` from the same `stream-manifest.ts` module. |
| 15 | Re-running an ingestion path against unchanged input produces no manifest diff | ✓ VERIFIED | `stream-manifest.test.ts` asserts byte-identical output on a no-op re-save; `saveManifest` only bumps `generated_at` when the sorted payload differs. |
| 16 | Backfill turns every provenance-linked original into a committed stream file | ✓ VERIFIED | 1,842 stream files written against 1,867 archive activities (25 correctly flagged unavailable). |
| 17 | One unreadable original warns and the run continues | ✓ VERIFIED | Per-item `try/catch` in `backfill-streams.ts`; real run completed end-to-end across the full archive without aborting. |
| 18 | Every activity the backfill touches gets a manifest entry, success or failure | ✓ VERIFIED | `1842 (with_streams) + 25 (without_streams) = 1867 (activities)` — exact match, cross-checked against `data/activities/*.json` count (1,867) and against actual files in `data/streams/` (0 inconsistent entries found in a full manifest-vs-filesystem cross-check). |
| 19 | Activities with no recoverable original flagged with a reason code instead of crashing | ✓ VERIFIED | `by_reason: {manual:23, no-original:1, no-samples:1}` in the real manifest. |
| 20 | Re-running the backfill skips activities that already have a stream file | ✓ VERIFIED | `buildBackfillTargets` excludes `existingStreamIds`; covered by dedicated idempotency unit tests. |
| 21 | Newly-synced activity gets `data/streams/<id>.json` in the same canonical format the backfill produces | ✓ VERIFIED | `intervals-sync.ts` calls the same `deriveFromIntervalsStreams` seam; real reconciled activity `i174284902.json` (produced via the identical intervals.icu code path used by daily sync) has `schemaVersion:1` and full channel population. |
| 22 | Stream file carries every channel actually recorded — never coordinate-only | ✓ VERIFIED | `allChannels: true` bypasses the coordinate-only narrowing at the request (`intervals-provider.ts:478`); `intervals-sync.test.ts` asserts `channels.hr/cadence/elevation === true` against a filtering-faithful fake; real reconciled file confirms all three true. |
| 23 | Persisting streams costs zero additional intervals.icu requests | ✓ VERIFIED | `getAllStreams` replaces `getStreams` as the sole request under `allChannels`; test asserts `getStreamsCalls.length === 0, getAllStreamsCalls === 1`. |
| 24 | A stream-derivation failure warns and the activity is still saved | ✓ VERIFIED | Same `try/catch` as geometry handling; `intervals-sync.test.ts` covers empty-payload and throwing-client cases. |
| 25 | Every newly-synced activity gets a manifest entry, including when no stream could be derived | ✓ VERIFIED | Tested: empty payload → `available:false, reason:'no-samples'` manifest entry still written. |
| 26 | Stream files produced in CI are actually committed back to the repository | ✓ VERIFIED | `.github/workflows/daily-refresh.yml` `file_pattern` now includes `data/streams/*.json`; `git check-ignore -q data/streams` exits non-zero (not ignored); YAML validated with `yaml.safe_load`. |
| 27 | Activities already synced from intervals.icu with no export original still get streams | ✓ VERIFIED | `selectReconciliationTargets` (keyed on `source_provider === 'intervals'`) found and reconciled `i174284902` in the real run; `i174110124` correctly resolved to `no-samples` (valid outcome — live fetch succeeded but yielded no usable series). |
| 28 | Backfill prints a size report the user can inspect before committing | ✓ VERIFIED | `formatSizeReport` implemented, tested, and its real output is recorded in 14-05-SUMMARY.md (`WARNING: total size 138.33 MB exceeds the 50 MB budget by 88.33 MB`) — explicitly reviewed and approved by the developer at the Task 3 checkpoint. |
| 29 | The backfill never runs git itself | ✓ VERIFIED | `grep -c "execSync\|spawnSync\|'git'" src/streams/backfill-streams.ts` outputs 0; `git status --short data/streams` before commit showed only untracked files, no commit made by the tool. |
| 30 | A single command reconciles everything: local originals, live-API catch-up, unavailable flags | ✓ VERIFIED | `backfill-streams` registered in `src/index.ts` and `package.json`; `node dist/index.js help` lists it; three branches (FIT/GPX, reconciliation, unavailable-flag) all live inside one `backfillStreams()` function. |
| 31 | The real archive produces committed stream files and a manifest covering every activity | ✓ VERIFIED | `data/streams/` has 1,842 `<id>.json` + `manifest.json` (1,843 total files), all committed (present in git-tracked working tree); manifest `totals.activities === 1867` matches `data/activities/*.json` count exactly. |

**Score:** 31/31 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/streams/stream.types.ts` | CanonicalStream/RawSample/StreamManifest contracts | ✓ VERIFIED | Exports `STREAM_SCHEMA_VERSION`, `CanonicalStream`, `RawSample`, `StreamChannels`, `StreamSource`, `DistanceSource`, `StreamUnavailableReason`, `StreamManifest`, `StreamManifestEntry` — all present |
| `src/streams/derive-stream.ts` | Pure canonical derivation seam | ✓ VERIFIED | Exports `deriveFromSamples`, `deriveFromIntervalsStreams`; no `node:fs`/`node:zlib`/network import |
| `src/streams/derive-stream.test.ts` | Normalization/bounds/channel/decimation coverage | ✓ VERIFIED | 15 tests, all passing |
| `src/config/strava.config.ts` | `streamsDir`/`streamsManifestPath` | ✓ VERIFIED | Getters present, resolve to `data/streams` paths |
| `src/exports/geometry-readers.ts` | Multi-channel FIT/GPX extraction | ✓ VERIFIED | Exports `readFit`, `readGpx`, `readGpxText`, `readOriginal`, `fitRecordsToSamples` |
| `src/exports/geometry-readers.test.ts` | CI-safe coverage | ✓ VERIFIED | 16 tests, synthetic inputs only |
| `src/streams/stream-manifest.ts` | Central availability manifest r/w | ✓ VERIFIED | Exports `loadManifest`, `upsertAvailable`, `upsertUnavailable`, `saveManifest`, `emptyManifest` |
| `src/streams/stream-manifest.test.ts` | Idempotency/reason-code coverage | ✓ VERIFIED | 9 tests, real temp-dir `FileStore` harness |
| `src/streams/backfill-streams.ts` | Local backfill CLI core + reconciliation + size gate | ✓ VERIFIED | Exports `backfillStreams`, `classifyUnavailable`, `buildBackfillTargets`, `selectReconciliationTargets`, `formatSizeReport` |
| `src/streams/backfill-streams.test.ts` | Classification/target-selection/idempotency/size-report coverage | ✓ VERIFIED | 19 tests, all passing, CI-safe (no `export_data/` dependency) |
| `src/api/intervals-provider.ts` | `allChannels` option on `fetchGeometry` | ✓ VERIFIED | `allChannels?: boolean` destructured at line 466, branched at line 478 |
| `src/sync/intervals-sync.ts` | Stream persistence in sync loop | ✓ VERIFIED | Contains `deriveFromIntervalsStreams` call and `allChannels: true` |
| `src/sync/intervals-sync.test.ts` | First test coverage for this module | ✓ VERIFIED | 6 tests, filtering-faithful fake client |
| `src/api/intervals-provider.test.ts` | `allChannels` coverage | ✓ VERIFIED | Extended with `allChannels` describe block |
| `.github/workflows/daily-refresh.yml` | CI commit of `data/streams/` | ✓ VERIFIED | `file_pattern` contains `data/streams/*.json`; valid YAML |
| `data/streams/manifest.json` | Availability for every archive activity | ✓ VERIFIED | 1,867 entries, totals consistent with `data/activities/` |
| `data/streams/<id>.json` (1,842 files) | Committed per-activity canonical streams | ✓ VERIFIED | Present, valid JSON, schema-conformant, no position data leaked |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `derive-stream.ts` | `stream.types.ts` | type import | ✓ WIRED | `import { ... } from './stream.types.js'` |
| `derive-stream.ts` | `intervals-provider.ts` | `IntervalsProvider.extractCoordinates` | ✓ WIRED | Used for geo-distance fallback |
| `geometry-readers.ts` | `stream.types.ts` | `RawSample` return type | ✓ WIRED | `OriginalRecording.samples: RawSample[]` |
| `stream-manifest.ts` | `file-store.ts` | `FileStore.writeJson` atomic write | ✓ WIRED | Confirmed via real temp-dir test harness |
| `backfill-streams.ts` | `geometry-readers.ts` | `readOriginal` | ✓ WIRED | Called in the per-original loop |
| `backfill-streams.ts` | `derive-stream.ts` | `deriveFromSamples` | ✓ WIRED | Called on decoded samples |
| `backfill-streams.ts` | `stream-manifest.ts` | `upsertAvailable`/`upsertUnavailable`/`saveManifest` | ✓ WIRED | All three used |
| `intervals-sync.ts` | `intervals-provider.ts` | `fetchGeometry(allChannels: true)` | ✓ WIRED | Confirmed `grep -c "allChannels: true"` = 1 in sync file |
| `intervals-provider.ts` | `intervals-client.ts` | `getAllStreams` primary request | ✓ WIRED | Called when `allChannels` true, bypassing narrowing |
| `intervals-sync.ts` | `derive-stream.ts` | `deriveFromIntervalsStreams` | ✓ WIRED | Called on `geometry.rawAll ?? geometry.raw` |
| `.github/workflows/daily-refresh.yml` | `data/streams/` | `file_pattern` allowlist | ✓ WIRED | `data/streams/*.json` present; path not gitignored |

### Data-Flow Trace (Level 4)

Committed stream files are the terminal artifact of this phase (no further runtime rendering component consumes them within Phase 14's scope — that begins in Phase 15). Data-flow was traced end-to-end instead by direct inspection of the real committed archive:

| Artifact | Data Source | Produces Real Data | Status |
|----------|-------------|---------------------|--------|
| `data/streams/<id>.json` (FIT) | `readOriginal` → `deriveFromSamples` | Yes — real decoded FIT records, spot-checked | ✓ FLOWING |
| `data/streams/<id>.json` (GPX) | `readOriginal` → `deriveFromSamples` | Yes — real decoded GPX points, spot-checked | ✓ FLOWING |
| `data/streams/<id>.json` (intervals) | `client.getAllStreams` → `deriveFromIntervalsStreams` | Yes — real intervals.icu API response, spot-checked (`i174284902`) | ✓ FLOWING |
| `data/streams/manifest.json` | `saveManifest` over the merged manifest state | Yes — 1,867 real entries, cross-checked against filesystem with zero inconsistencies | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `npx vitest run` | 136/136 tests passed, 8 test files | ✓ PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Build succeeds | `npm run build` | exit 0 | ✓ PASS |
| CLI lists `backfill-streams` | `node dist/index.js help \| grep backfill` | `backfill-streams - Derive committed per-activity streams...` | ✓ PASS |
| Manifest totals consistent | `node -e "require('./data/streams/manifest.json').totals"` | `{activities:1867, with_streams:1842, without_streams:25, by_reason:{manual:23,no-original:1,no-samples:1}}` | ✓ PASS |
| Manifest ↔ filesystem cross-check | custom script comparing `manifest.activities` keys/`available` flags against actual files on disk | 0 inconsistent entries of 1,867; 0 orphaned files | ✓ PASS |
| No position data leaked | `grep -rl '"lat"' data/streams/` | no matches | ✓ PASS |
| Full null/NaN scan across all committed arrays | custom script parsing all 1,842 files' `t/d/hr/cadence/alt` | 0 files with `null`/`NaN` | ✓ PASS |
| Decimation cap scan (REVIEW.md WR-02 check) | custom script computing max `sampleCount` across archive | max 4,121 in one file; 10/1,842 files exceed the stated 3,000 ceiling | ⚠ CONFIRMED (see Gaps Summary — non-blocking) |
| CI workflow YAML valid | `python3 -c "yaml.safe_load(...)"` | exit 0 | ✓ PASS |
| `data/streams` not gitignored | `git check-ignore -q data/streams` | exit 1 (not ignored) | ✓ PASS |
| No debt markers in phase-modified files | grep for `TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER` across 7 core phase files | none found | ✓ PASS |

### Probe Execution

Not applicable — this phase is not a migration/tooling-probe phase; no `scripts/*/tests/probe-*.sh` declared or found. Step 7c: SKIPPED (no probes for this phase type).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| STREAM-01 | 14-01, 14-02, 14-03, 14-05 | Local backfill parses FIT/GPX originals into committed per-activity stream files | ✓ SATISFIED | 1,842 real committed stream files; `backfillStreams()` end-to-end verified against the real archive |
| STREAM-02 | 14-01, 14-04 | Daily pipeline fetches/persists intervals.icu streams in the same canonical format with cadence normalization verified against FIT | ✓ SATISFIED | `allChannels` wiring + `deriveFromIntervalsStreams`; Assumption A1 empirically confirmed against real reconciled data |
| STREAM-03 | 14-02, 14-03, 14-04, 14-05 | Activities without recoverable streams are flagged rather than failing the pipeline | ✓ SATISFIED | Manifest reason-code taxonomy (`manual`, `no-original`, `no-samples`, `treadmill`, `unreadable-original`) implemented and populated in the real manifest |

No orphaned requirements — all three IDs (STREAM-01/02/03) declared in ROADMAP.md Phase 14 requirements list are covered by at least one plan's `requirements` frontmatter.

**Note:** `.planning/REQUIREMENTS.md` still shows STREAM-01/02/03 as unchecked `[ ]` and "Pending" in its status table. This is a documentation-sync gap (the requirements tracking file was not updated after phase completion), not a code gap — the actual implementation satisfies all three requirements per the evidence above. Recommend updating REQUIREMENTS.md's checkboxes/status table as part of phase close-out.

### Anti-Patterns Found

None found in the 7 core phase-modified source files (`stream.types.ts`, `derive-stream.ts`, `stream-manifest.ts`, `backfill-streams.ts`, `geometry-readers.ts`, `intervals-provider.ts`, `intervals-sync.ts`) — no `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no empty-implementation stubs, no hardcoded-empty data flows.

### Human Verification Required

None. All must-haves were verifiable programmatically against the real, already-committed archive data (this phase's Task 3 human checkpoint in 14-05-PLAN.md was already completed and approved by the developer prior to this verification pass — confirmed via the `4ad338f` commit and the recorded approval in 14-05-SUMMARY.md).

### Gaps Summary

No blocking gaps. All 31 must-have truths (3 roadmap success criteria + 28 plan-level truths) are verified against the actual codebase and the real, already-committed `data/streams/` archive — not merely against SUMMARY.md claims.

**Two non-blocking items carried forward from 14-REVIEW.md, now independently confirmed against real data during this verification pass (informational, not phase-blocking):**

1. **WR-02 (decimation cap not hard-enforced):** The plan's Task 2 acceptance criteria for `derive-stream.ts` claimed "never exceeds 3000 samples," but the decimation ladder only steps to a 3-second minimum interval and stops — it doesn't add a final uniform-stride fallback. Confirmed in the real archive: 10 of 1,842 committed files exceed 3,000 samples (max 4,121, for activities longer than ~2.5 hours). This does not break the schema, does not introduce nulls, and does not block Phase 15's consumption of the data — it is a size-predictability miss already reviewed and tracked as a WARNING in 14-REVIEW.md. Given the developer already explicitly accepted a much larger, related size overage (138.33 MB vs. the 50 MB budget) at the Task 3 checkpoint, this is reasonable to treat as within the same accepted size tradeoff, but is flagged here for visibility since the specific 3000-cap violation wasn't itemized at that checkpoint.

2. **CR-01 (non-finite timestamp handling gap):** `derive-stream.ts`'s `normalize()` does not explicitly guard against non-finite (`NaN`) `tEpochS` values, which could theoretically occur if a GPX `<time>` fails to parse. A full scan of all 1,842 real committed files found **zero** occurrences of `null`/`NaN` in any committed array, so this latent defect did not manifest in the actual delivered archive. It remains a legitimate robustness gap for future backfill/sync runs against new or different-vintage source data, already tracked as CR-01 (critical) in 14-REVIEW.md and recommended as a fast-follow fix before the next backfill re-run.

Both items are advisory review findings that do not contradict any of the 31 verified must-have truths in their observable, real-data outcome. They are surfaced here per the verification mandate (confirmed-in-reality findings are stronger than untested theoretical ones) but do not change the phase's `passed` status, since the phase goal — "every historical and newly-synced activity has committed time-series stream data ... ready for downstream computation" — is demonstrably achieved for the full 1,867-activity archive as it exists today.

---

_Verified: 2026-08-10T15:35:00Z_
_Verifier: Claude (gsd-verifier)_
