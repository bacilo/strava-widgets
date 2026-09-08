---
phase: 14-stream-ingestion-foundation
reviewed: 2026-08-10T13:15:09Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - .github/workflows/daily-refresh.yml
  - src/api/intervals-provider.test.ts
  - src/api/intervals-provider.ts
  - src/config/strava.config.ts
  - src/exports/geometry-readers.test.ts
  - src/exports/geometry-readers.ts
  - src/index.ts
  - src/streams/backfill-streams.test.ts
  - src/streams/backfill-streams.ts
  - src/streams/derive-stream.test.ts
  - src/streams/derive-stream.ts
  - src/streams/stream-manifest.test.ts
  - src/streams/stream-manifest.ts
  - src/streams/stream.types.ts
  - src/sync/intervals-sync.test.ts
  - src/sync/intervals-sync.ts
findings:
  critical: 2
  warning: 5
  info: 8
  total: 15
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-08-10T13:15:09Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the stream-ingestion foundation: the canonical stream derivation seam (`derive-stream.ts`), FIT/GPX readers, the availability manifest, the local backfill with its live-API reconciliation branch, the widened intervals.icu sync, and the CI workflow. TypeScript compiles clean and all 136 tests pass. Cross-referenced against `intervals-client.ts`, `file-store.ts`, `provider.ts`, `package.json` scripts, and `.gitignore` (the workflow's claims about `data/streams/` vs `data/stats/` and the `npm run fetch` → `sync-intervals` mapping check out).

The architecture is sound and unusually well-documented, but the "single normalization seam" that guarantees the locked schema does not actually guarantee it: non-finite timestamps flow through `normalize()` and are committed as `null` entries in `t` (verified by execution — see CR-01), and the daily sync converts transient network failures into permanent, unrecoverable route loss (CR-02). Several second-tier bugs were verified by running the code against edge-case inputs: the 3000-sample cap is not enforced for activities longer than ~2.5 h, GPS-dropout nulls desynchronize the geo-distance fallback from the time axis, and the GPX time fallback fabricates timestamps that displace real ones.

## Critical Issues

### CR-01: Non-finite timestamps pass through `normalize()` and are committed as `null` in the locked-schema `t` array

**File:** `src/streams/derive-stream.ts:95-109` (root cause also at `src/exports/geometry-readers.ts:134`)
**Issue:** `normalize()` never checks that `sample.tEpochS` is finite. `readGpxText` computes `Math.floor(new Date(timeMatch[1]).getTime() / 1000)` with no validity check, so a malformed `<time>` yields `NaN`. When the first sample's time is `NaN`, `t0` is `NaN`, every `t = Math.round(sample.tEpochS - t0)` is `NaN`, the out-of-order guard (`t < lastKeptT`) never fires because `NaN < x` is always false, and `JSON.stringify` serializes each `NaN` as `null`. Verified by execution: a GPX file whose first `<time>` is unparseable produces a committed stream file with `"t": [null, null]` — a direct violation of the locked schema (`t`: "integer, starting at 0", D-01's "no null ever reaches a committed array") — while the manifest marks the activity `available: true`. A malformed time mid-file corrupts a single entry and additionally disables the out-of-order drop for all subsequent samples. This is the one function contractually responsible for schema integrity ahead of a ~1,841-file unattended backfill whose output gets committed; a single bad file poisons the committed store silently and Phase 15 consumes it.
**Fix:** Reject non-finite times at the seam (and optionally at the GPX reader):
```ts
// derive-stream.ts, inside the kept-samples loop:
for (const sample of samples) {
  if (!Number.isFinite(sample.tEpochS)) continue;   // guard the seam
  const t = Math.round(sample.tEpochS - t0);
  ...
}
// and derive t0 from the first FINITE sample:
const t0 = samples.find(s => Number.isFinite(s.tEpochS))?.tEpochS;
if (t0 === undefined) return null;
```
In `readGpxText`, treat an unparseable `<time>` the same as a missing one:
```ts
const parsed = timeMatch ? new Date(timeMatch[1]).getTime() : NaN;
const time = Number.isFinite(parsed) ? Math.floor(parsed / 1000) : undefined;
```

### CR-02: A transient streams-fetch failure during daily sync permanently loses the activity's route with no retry path

**File:** `src/sync/intervals-sync.ts:157-164`
**Issue:** When `fetchGeometry` throws (network blip, intervals.icu 5xx, or a 429 — which `intervals-client.ts:82` explicitly refuses to retry because `'HTTP 429'` matches the `includes('HTTP 4')` no-retry rule), the catch block logs, flags `no-samples`, and then **still writes the activity file** with an empty `map.summary_polyline`. On every subsequent sync the activity is deduped by start-date epoch (`intervals-sync.ts:114`), so geometry is never re-fetched. No other code path repairs it: the backfill reconciliation branch re-derives the *stream file* (which deliberately carries no lat/lng), but nothing ever rewrites the activity's polyline or `start_latlng`. Committed stream files can't reconstruct it either (positions are excluded by design). Net effect: one rate-limit response or nightly-maintenance 500 in unattended CI silently and permanently strips the route from that run's map widgets — data loss from a transient error. Also note the manifest reason `no-samples` is a misclassification (the taxonomy defines it as "parsed but yielded no usable series"), which masks what actually happened.
**Fix:** Distinguish transient failure from genuine absence. Simplest robust option: on a thrown streams fetch, do not write the activity file and do not advance the watermark past it — the next daily run retries the whole activity:
```ts
} catch (error: any) {
  console.warn(`  ${activity.id}: streams fetch failed (${error.message}); will retry next sync`);
  continue; // activity not written, not deduped, epoch not added — retried tomorrow
}
```
Alternatively persist the activity but record a retryable manifest state (e.g., a `fetch-failed` reason) and re-attempt geometry for such ids at the start of each sync. Separately, exempt 429 from the `HTTP 4` no-retry rule in `intervals-client.ts`.

## Warnings

### WR-01: GPS-dropout nulls desynchronize coordinates from the time/HR axes in `intervalsStreamsToSamples`

**File:** `src/streams/derive-stream.ts:261, 284-294`
**Issue:** `IntervalsProvider.extractCoordinates` *compacts* the coordinate list (null / out-of-range pairs are dropped), but `intervalsStreamsToSamples` pairs `coordinates[i]` with `timeSeries[i]`, `hrSeries[i]`, etc. by raw index. After the first dropout, every coordinate is attached to an earlier timestamp than it belongs to, and the tail samples get no coordinates at all. Verified by execution: `time: [0,1,2,3]` with a null latlng pair at index 1 produces `d = [0, 256.4, 384.6, 384.6]` — the movement that happened between t=1 and t=3 is credited to t=0→1, and the final real segment is flattened. This distorts the geo-fallback distance-vs-time curve (Phase 15's PR input) around every GPS dropout; it only bites when `distanceSource === 'geo'` (no native distance stream), which is exactly the degraded case where fidelity matters most.
**Fix:** Extract lat/lng index-aligned instead of via the compacting `extractCoordinates`. For the confirmed `data`/`data2` shape, zip without dropping:
```ts
const latSeries = /* latlng stream .data  */;
const lngSeries = /* latlng stream .data2 */;
// in the sample loop:
lat: typeof latSeries?.[i] === 'number' ? latSeries[i] : undefined,
lng: typeof lngSeries?.[i] === 'number' ? lngSeries[i] : undefined,
```
(`normalize()`'s geo branch already tolerates per-sample missing lat/lng.)

### WR-02: `MAX_SAMPLES` is not enforced — activities over ~2.5 h exceed the 3000-sample ceiling the tests claim to guarantee

**File:** `src/streams/derive-stream.ts:180-185` (test overstating the invariant: `src/streams/derive-stream.test.ts:121-133`)
**Issue:** The decimation ladder stops at 3 s spacing. A 3 s interval yields 3000 samples per 9000 s, so any activity longer than 2 h 30 m at 1 Hz blows the cap. Verified by execution: a 4-hour 1 Hz activity yields `sampleCount: 4801`. If D-01 intended `MAX_SAMPLES` as a hard ceiling for committed file size, this breaks it for exactly the activities that produce the largest files (the archive contains 23 km runs at ~2.2 h — a marathon or long ride exceeds the band). The existing test "decimates to a minimum 1s spacing and never exceeds 3000 samples" only exercises a 4000 s activity, so it passes while the stated invariant does not hold. Either enforce the cap or fix the constant's name, the doc comment, and the test's claim.
**Fix:** If the cap is a hard invariant, add a final uniform-stride fallback:
```ts
if (indices.length > MAX_SAMPLES) {
  const stride = Math.ceil(indices.length / MAX_SAMPLES);
  indices = indices.filter((_, j) => j % stride === 0 || j === indices.length - 1);
}
```
If "light only" is the real contract, rename `MAX_SAMPLES`, update the test name/assertion to reflect the true bound, and note the size implication for the D-02 gate.

### WR-03: `readGpxText` time fallback fabricates timestamps that displace or drop real timed samples

**File:** `src/exports/geometry-readers.ts:142-152`
**Issue:** `tEpochS = p.time ?? firstTime + index` uses `firstTime` (the first point *with* a time) plus the point's absolute index. When untimed points precede the first timed point, the synthetic times land at and after `firstTime`, colliding with — and out-ordering — the real timestamps that follow. Verified by execution: two untimed points followed by real times at +0 s and +5 s produce the series `[T, T+1, T, T+5]`; `normalize()` then drops the first *real* timed sample as out-of-order and keeps the two fabricated ones. The result is a committed stream whose early time axis is invented. Also, `firstTime + index` assumes 1 Hz for interior gaps, silently compressing/stretching time when the recording interval differs.
**Fix:** Only synthesize times for points *after* the last real timestamp (or interpolate between surrounding real timestamps); drop leading untimed points instead of back-filling them:
```ts
const timedStart = points.findIndex(p => p.time !== undefined);
const usable = timedStart === -1 ? [] : points.slice(timedStart);
// then fall forward from the previous real time rather than firstTime + absolute index
```

### WR-04: Contradictory provenance double-processes an id — stream file written, then manifest overwritten to `available: false`

**File:** `src/streams/backfill-streams.ts:88-102, 250-257`
**Issue:** `buildBackfillTargets` adds an id with `entry.original` to `withOriginal`, and *independently* adds every id from `archive_without_original` to `withoutOriginal` — there is no cross-check. If an id appears in both (contradictory but representable provenance), the first pass writes `data/streams/<id>.json` and upserts `available: true`; the second pass then unconditionally overwrites the manifest entry to `available: false`. That violates the manifest's own documented contract ("available:false means no data/streams/<id>.json exists") and the inconsistency persists across runs, because the next run's `existingStreamIds` skips the id in *both* lists, freezing the wrong entry.
**Fix:** Exclude ids already selected for the withOriginal pass:
```ts
for (const id of provenance.archive_without_original) {
  if (existingStreamIds.has(id)) continue;
  if (withOriginal.some(w => w.id === id)) continue; // or track a Set of withOriginal ids
  withoutOriginalSet.add(id);
}
```

### WR-05: Activities with zero/absent reported distance can never pass geometry validation, even with a perfect GPS track

**File:** `src/api/intervals-provider.ts:304, 318` (consumed at `src/sync/intervals-sync.ts:125-139`)
**Issue:** `validateGeometry` computes `ratio = expectedMeters > 0 ? pathMeters / expectedMeters : 0`, and `ratio = 0` always fails the `ratio < 0.6` check with the misleading reason "path length is 0.00x the reported distance". Any GPS activity whose summary carries `distance: 0` or no distance field (`toCanonical` defaults it to 0) is therefore permanently saved without a route — and, combined with CR-02's no-retry dedupe, can never gain one. In the non-`allChannels` path it additionally triggers a guaranteed-futile `getAllStreams` refetch per such activity. `resolveAxes` already special-cases `expectedMeters <= 0`; `validateGeometry` should too.
**Fix:** When there is no distance to compare against, skip the ratio check and rely on the axis-overlap heuristic alone (or accept with a `ratio: undefined` marker):
```ts
if (expectedMeters <= 0) {
  return overlapping
    ? { ok: false, pathMeters, ratio: 0, reason: '…same axis' }
    : { ok: true, pathMeters, ratio: 0 };
}
```

## Info

### IN-01: Reconciliation-branch console counters can go negative / disagree

**File:** `src/streams/backfill-streams.ts:296-320`
**Issue:** `flagged--` fires whenever `previousEntry` was unavailable, including entries loaded from a *previous run's* manifest that this run's counters never incremented — `flagged` can print negative. Similarly, the no-samples branch increments `by_reason['no-samples']` without decrementing the entry's previous reason. Manifest totals are recomputed correctly in `saveManifest`; only the console summary is wrong.
**Fix:** Count reconciliation outcomes in separate counters (`reconciled`, `reconFailed`) instead of retro-adjusting the pass-1/2 counters.

### IN-02: Backfill hardcodes `data/provenance.json` and `data/activities` while writing via env-configurable `config.streamsDir`

**File:** `src/streams/backfill-streams.ts:27-28` vs `config.streamsDir` usage at lines 186, 226, 288
**Issue:** If `STRAVA_DATA_DIR` is set, the backfill reads activities/provenance from `./data/` but writes streams and the manifest under the overridden directory — a split-brain run. Use `config.dataDir`-derived paths for all four.
**Fix:** `const PROVENANCE_PATH = path.join(config.dataDir, 'provenance.json');` and use `config.activitiesDir`.

### IN-03: `resolveOriginalPath` performs no validation on the provenance `original` value

**File:** `src/streams/backfill-streams.ts:68-73`
**Issue:** A missing `:` yields `indexOf` = -1 and a garbage path (`slice(0, -1)` drops the last character of the "source"); a crafted `../../` relative path escapes `export_data/`. Input is locally generated so risk is low, but a one-line guard (`if (sepIndex < 1) throw`, plus rejecting `..` segments) makes the failure loud instead of a confusing `unreadable-original` flag.
**Fix:** Validate separator presence and reject path traversal segments before joining.

### IN-04: `unreadable-original` also absorbs file-not-found, blurring the documented taxonomy

**File:** `src/streams/backfill-streams.ts:241-246`
**Issue:** The taxonomy defines `unreadable-original` as "the file exists but decode threw", but an ENOENT from `readOriginal` (provenance pointing at a since-moved file) lands in the same bucket, hiding a distinct failure mode from the summary.
**Fix:** Check `error.code === 'ENOENT'` and flag `no-original` (or log distinctly) in that case.

### IN-05: `loadManifest` couples to FileStore's error-message prefix string

**File:** `src/streams/stream-manifest.ts:49`
**Issue:** `message.startsWith('File not found:')` breaks silently into a throw (or worse, a future format change could make a missing file fatal) if `FileStore.readJson`'s wording changes. Prefer a typed error or an `exists()` pre-check.
**Fix:** `if (!(await fileStore.exists(manifestPath))) return emptyManifest();` then read.

### IN-06: Dead first computation of decimation indices

**File:** `src/streams/derive-stream.ts:180`
**Issue:** `let indices = decimationIndices(t, DECIMATION_LADDER[0])` is immediately recomputed by the loop's first iteration — wasted work and misleading structure.
**Fix:** `let indices: number[] = [];` (or restructure the loop to `for … { indices = …; if (…) break; }` with no pre-seed).

### IN-07: `streamTypes` passed to `fetchGeometry` is dead under `allChannels: true`

**File:** `src/sync/intervals-sync.ts:121-129`
**Issue:** The `raw.stream_types` extraction and the `streamTypes` option are unused when `allChannels: true` forces the unfiltered request (`intervals-provider.ts:478-489` never reads `types` on that branch). Harmless, but it implies a filtering influence that no longer exists.
**Fix:** Drop the `streamTypes` argument from this call site.

### IN-08: Stream/activity filenames are built from a provider-supplied id without sanitization

**File:** `src/sync/intervals-sync.ts:146, 164` (also `src/streams/backfill-streams.ts:226, 288`)
**Issue:** `${this.streamsDir}/${activity.id}.json` interpolates an id that originates from the remote API. intervals.icu ids are `i` + digits in practice, but a defensive `/^[A-Za-z0-9_-]+$/` check (or `path.basename`) would prevent a hostile/buggy payload from writing outside the data tree via `../`.
**Fix:** Validate the id shape once in `toCanonical` and skip/throw on mismatch.

---

_Reviewed: 2026-08-10T13:15:09Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
