# Phase 14: Stream Ingestion Foundation - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 8 (3 new modules + 1 new test suite split into 3 files + 2 extended files + 1 CLI wiring + 1 config touch)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/streams/derive-stream.ts` (new) | utility/transform | transform | `src/exports/geometry-readers.ts` (`readOriginal` dispatch) | role-match |
| `src/streams/derive-stream.test.ts` (new) | test | transform | `src/api/intervals-provider.test.ts` (`extractCoordinates` suite) | exact |
| `src/streams/backfill-streams.ts` (new) | service/CLI-command | batch, file-I/O | `src/exports/consolidate.ts` (`consolidateExports`) | exact |
| `src/streams/backfill-streams.test.ts` (new) | test | batch | `src/exports/csv.test.ts` | role-match |
| `src/streams/stream-manifest.ts` (new) | model/store | CRUD (read-merge-write) | `src/storage/file-store.ts` (`FileStore`) | role-match |
| `src/exports/geometry-readers.ts` (extend) | utility | file-I/O, transform | itself (existing file, extend in place) | exact |
| `src/sync/intervals-sync.ts` (extend) | service | request-response, event-driven (per-activity loop) | itself (existing file, extend in place) | exact |
| `src/sync/intervals-sync.test.ts` (new) | test | event-driven | `src/api/intervals-provider.test.ts` (mock-free, pure-function style) + `IntervalsClient`/`IntervalsProvider` constructor-injection pattern | role-match |
| `src/index.ts` (extend — register `backfill-streams` command) | CLI entry | request-response | itself, `consolidate-exports` case (lines 465-469) | exact |
| `src/config/strava.config.ts` (extend — optional `streamsDir` getter) | config | — | itself, `activitiesDir` getter (lines 57-59) | exact |

## Pattern Assignments

### `src/streams/derive-stream.ts` (utility, transform)

**Analog:** `src/exports/geometry-readers.ts` (dispatch style) + `src/api/intervals-provider.ts` (`extractCoordinates`/normalization style)

**Imports pattern** (from `geometry-readers.ts` lines 1-2):
```typescript
import { gunzipSync } from 'node:zlib';
import fs from 'node:fs';
```
This module is a pure function — it should NOT import `fs`/network clients itself. Callers (backfill, sync) do I/O and pass already-decoded records in. Mirror `IntervalsProvider.extractCoordinates`'s pure-function shape instead (`src/api/intervals-provider.ts:107`, `static extractCoordinates(streams: unknown): [number, number][] { ... }`) — a static, side-effect-free transform taking loosely-typed input and returning a strict typed shape.

**Dispatch-on-source-shape pattern** (`geometry-readers.ts` lines 76-86):
```typescript
/** Dispatch on file extension. */
export async function readOriginal(filePath: string): Promise<OriginalRecording> {
  if (/\.fit(\.gz)?$/.test(filePath)) return readFit(filePath);
  if (/\.gpx(\.gz)?$/.test(filePath)) {
    if (filePath.endsWith('.gz')) {
      throw new Error(`gzipped gpx not implemented: ${filePath}`);
    }
    return readGpx(filePath);
  }
  throw new Error(`unsupported original format: ${filePath}`);
}
```
`derive-stream.ts` should expose three named entry points (`deriveFromFit`, `deriveFromGpx`, `deriveFromIntervals`) that all funnel into one shared internal normalizer — same shape as `readFit`/`readGpx` funneling into the same `OriginalRecording` interface (lines 13-17):
```typescript
export interface OriginalRecording {
  coordinates: [number, number][];
  startEpoch?: number;
}
```
Model `CanonicalStream` the same way (per RESEARCH.md Pattern 1) — one shared interface, three producers writing into it.

**Sentinel/bounds-guard pattern** (`geometry-readers.ts` lines 39-43, extend to every new field):
```typescript
for (const rec of messages.recordMesgs ?? []) {
  if (typeof rec.positionLat === 'number' && typeof rec.positionLong === 'number') {
    coordinates.push([rec.positionLat * SEMICIRCLE, rec.positionLong * SEMICIRCLE]);
  }
}
```
Extend this `typeof === 'number'` guard to `heartRate`, `cadence`, `distance`, `altitude` per RESEARCH.md's Code Examples section and Pitfall (bounds: HR ≤250bpm, cadence raw ≤150, altitude -500..9000m). RESEARCH.md already supplies the exact field-extraction snippet to adapt (lines 250-260 of RESEARCH.md) — copy that logic directly rather than re-deriving it.

**Numeric extraction guard pattern** (`intervals-provider.ts`, referenced via `num()` helper used throughout `extractCoordinates`):
```typescript
// same file, used at intervals-provider.ts:139-141
const lat = num(lats[i]);
const lng = num(lngs[i]);
if (lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
  pairs.push([lat, lng]);
}
```
Copy this "coerce-then-bounds-check-then-push, else drop" idiom for cadence/HR/altitude normalization inside `derive-stream.ts`.

**data/data2 parallel-array quirk** (`intervals-provider.ts` lines 128-146) — apply the same pairing convention when reading intervals.icu's cadence/HR/altitude streams (they are separate top-level keys per RESEARCH.md, but any parallel-array-with-nulls shape should reuse this zip-by-index-and-drop-incomplete-pairs idiom):
```typescript
for (const key of ['latlng', 'lat_lng', 'position', 'coordinates']) {
  const stream = streamNamed(key);
  const lats = stream?.data;
  const lngs = stream?.data2;
  if (Array.isArray(lats) && Array.isArray(lngs)) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < Math.min(lats.length, lngs.length); i++) {
      const lat = num(lats[i]);
      const lng = num(lngs[i]);
      if (lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        pairs.push([lat, lng]);
      }
    }
    if (pairs.length > 0) return pairs;
  }
}
```

**Cadence normalization** — copy directly from RESEARCH.md Code Examples (already-written, verified logic, not left to reinterpretation):
```typescript
// FIT-sourced
const cadenceSpm = cadenceRaw !== undefined ? 2 * (cadenceRaw + fractionalCadence) : undefined;

// intervals.icu-sourced
function normalizeIntervalsCadence(raw: number[]): number[] {
  return raw.map(v => (v === 0 ? 0 : v * 2)); // treat 0 as a probable pause/dropout marker, not 0 spm
}
```

---

### `src/streams/backfill-streams.ts` (service/CLI-command, batch + file-I/O)

**Analog:** `src/exports/consolidate.ts` (`consolidateExports`)

**Imports pattern** (`consolidate.ts` lines 1-9):
```typescript
import fs from 'node:fs';
import path from 'node:path';

import polyline from '@mapbox/polyline';

import { IntervalsProvider } from '../api/intervals-provider.js';
import type { StravaActivity } from '../types/strava.types.js';
import { columnIndices, parseCsv, parseStravaExportDate } from './csv.js';
import { readOriginal } from './geometry-readers.js';
```
For `backfill-streams.ts`, swap in `deriveFromFit`/`deriveFromGpx` from the new `derive-stream.ts`, `IntervalsClient` for the reconciliation branch, and `readJson`/`writeJson` from `FileStore`.

**Idempotent, re-runnable index-then-process pattern** (`consolidate.ts` lines 148-157 — build an index of what's already done, then skip-if-present):
```typescript
// Canonical archive index.
const archiveById = new Map<string, string>(); // id -> filename
const archiveByEpoch = new Map<number, string>(); // epoch -> id
for (const file of fs.readdirSync(ACTIVITIES_DIR).filter(f => f.endsWith('.json'))) {
  const activity = JSON.parse(fs.readFileSync(path.join(ACTIVITIES_DIR, file), 'utf-8'));
  const id = String(activity.id);
  archiveById.set(id, file);
  archiveByEpoch.set(Math.floor(new Date(activity.start_date).getTime() / 1000), id);
}
console.log(`Canonical archive: ${archiveById.size} activities\n`);
```
`backfill-streams.ts` should build the equivalent "already have a stream file" index by listing `data/streams/*.json` (skip-if-file-exists, per RESEARCH.md's Don't Hand-Roll table), then iterate `data/provenance.json` entries for the FIT/GPX branch and `data/activities/*.json` with `source_provider === 'intervals'` for the reconciliation branch (Pitfall 3 — the third code path Open Question 1 recommends folding into this CLI).

**Per-item non-blocking failure isolation** (`consolidate.ts` lines 201-217, and RESEARCH.md Pattern 2 quoting `intervals-sync.ts:109-126` — same convention, apply identically):
```typescript
if (run.file) {
  try {
    const recording = await readOriginal(path.join(root, run.file));
    const validation = IntervalsProvider.validateGeometry(
      recording.coordinates,
      run.distanceMeters
    );
    if (validation.ok) {
      activity.map = { summary_polyline: polyline.encode(recording.coordinates) };
      activity.start_latlng = recording.coordinates[0];
    } else {
      console.warn(`   ${run.stravaId}: geometry rejected (${validation.reason}); importing without route`);
    }
  } catch (error: any) {
    console.warn(`   ${run.stravaId}: could not read original (${error.message}); importing without route`);
  }
}
```
One bad FIT/GPX file must warn-and-skip, never abort the ~1,841-file run — copy this try/catch-per-item shape directly into the backfill's per-activity loop.

**Progress + summary reporting pattern** (`consolidate.ts` lines 137-146, 194-195, 232-236, 263-274) — console.log a running summary of matched/imported/missing counts as the loop progresses, then a final report block. `backfill-streams.ts` needs the same shape for its D-02 size-gate report (total MB, largest files, git object estimate — new content, but the "print a structured summary block at the end, do not commit anything" reporting pattern is directly lifted from this file's final `console.log` block, lines 263-274):
```typescript
console.log(`\nProvenance written: ${PROVENANCE_PATH}`);
console.log(`  archive total: ${archiveById.size}`);
console.log(`  linked to an original: ${Object.values(provenance).filter(p => p.original).length}`);
console.log(`  imported this run: ${imported}`);
console.log(`  archive records with no original: ${withoutOriginal.length}`);
```

**Function signature / export shape** (`consolidate.ts` line 137): `export async function consolidateExports(): Promise<void> { ... }` — mirror as `export async function backfillStreams(): Promise<void> { ... }`, dynamically imported from `index.ts` exactly like `consolidateExports` is (see CLI wiring pattern below).

---

### `src/streams/stream-manifest.ts` (model/store, CRUD read-merge-write)

**Analog:** `src/storage/file-store.ts` (`FileStore`) for atomic I/O primitives; `consolidate.ts`'s `provenance` doc-building for the "single JSON object keyed by activity id, unconditionally updated per item" shape.

**Atomic write pattern to reuse directly** (`file-store.ts` lines 18-41):
```typescript
async writeJson(filePath: string, data: unknown): Promise<void> {
  const fullPath = path.resolve(this.baseDir, filePath);
  const tempPath = `${fullPath}.tmp.${process.pid}`;

  try {
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(tempPath, json, 'utf-8');
    await fs.rename(tempPath, fullPath);
  } catch (error) {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
```
`stream-manifest.ts`'s helpers should call `FileStore.writeJson('data/streams/manifest.json', manifest)` rather than reimplementing temp-file-then-rename — this is the "Don't Hand-Roll" item RESEARCH.md flags explicitly.

**Central-index-doc shape** (`consolidate.ts` lines 253-260 — the `doc` object assembled once and written at the end):
```typescript
const doc = {
  generated_at: new Date().toISOString(),
  note: 'Maps canonical activity ids to original recordings under export_data/ (gitignored, local-only). Regenerate with: node dist/index.js consolidate-exports',
  sources: sourceSummaries,
  archive_total: archiveById.size,
  archive_without_original: withoutOriginal,
  activities: provenance,
};
fs.writeFileSync(PROVENANCE_PATH, JSON.stringify(doc, null, 2));
```
`manifest.json`'s shape (per CONTEXT.md D-04) should follow this same "generated_at + summary counts + activities: Record<id, entry>" convention, with each entry holding `{available: boolean, channels?: {...}, reason?: string}`. Read-merge-write (not append-only) so re-runs stay idempotent — read existing manifest via `FileStore.readJson`, merge new/updated entries into the `activities` map, write back the whole doc.

---

### `src/exports/geometry-readers.ts` (extend in place)

**Analog:** itself — extend `readFit`/`readGpx` to pull additional fields; the file's own existing structure is the pattern.

**FIT field extraction to add** (RESEARCH.md Code Examples, verified live decode — copy verbatim into `readFit`'s loop at lines 38-43):
```typescript
for (const rec of messages.recordMesgs ?? []) {
  const t = rec.timestamp instanceof Date ? rec.timestamp : undefined;
  const distance = typeof rec.distance === 'number' ? rec.distance : undefined;
  const heartRate = typeof rec.heartRate === 'number' ? rec.heartRate : undefined;
  const cadenceRaw = typeof rec.cadence === 'number' ? rec.cadence : undefined;
  const fractionalCadence = typeof rec.fractionalCadence === 'number' ? rec.fractionalCadence : 0;
  const cadenceSpm = cadenceRaw !== undefined ? 2 * (cadenceRaw + fractionalCadence) : undefined;
  const altitude = typeof rec.enhancedAltitude === 'number' ? rec.enhancedAltitude
    : typeof rec.altitude === 'number' ? rec.altitude : undefined;
}
```
Note: this normalization arguably belongs in `derive-stream.ts` per the "single canonical shape, one seam" architecture decision (RESEARCH.md Pattern 1) — `geometry-readers.ts` should be extended to return the *raw* extracted fields (undecorated `cadence`, `fractionalCadence`, `heartRate`, `altitude`, `distance`, `timestamp` per record), and `derive-stream.ts` should own the `×2` normalization step, so cadence-unit logic lives in exactly one place as CONTEXT.md's Claude's Discretion section requires ("normalize... inside derive-stream.ts, not at the call site").

**GPX gzip support to add** (RESEARCH.md Code Examples — replace the throw at line 81):
```typescript
// src/exports/geometry-readers.ts readOriginal() — replace the throw:
if (filePath.endsWith('.gz')) {
  const text = gunzipSync(fs.readFileSync(filePath)).toString('utf-8');
  return readGpxText(text); // extract readGpx()'s body into a text-accepting helper
}
```
`gunzipSync` is already imported at line 1 — this is a direct copy-paste extension, no new import needed.

**GPX regex field extraction to add** — extend the existing `<trkpt lat=... lon=...>` regex pattern (lines 62-71) with the same targeted-regex style for `<time>`, `<ele>` (already partially present for start time), and confirm via RESEARCH.md Pitfall 2 that no `<hr>`/`<cadence>`/`extensions` regex is needed (verified 0/38 files have them — don't build unused extraction paths).

---

### `src/sync/intervals-sync.ts` (extend in place)

**Analog:** itself — extend `syncNewActivities()`'s per-activity loop; the file's own geometry-fetch-and-fallback block is the pattern to replicate for streams.

**Non-blocking per-activity enrichment pattern to replicate for streams** (lines 104-126 — this is the exact block RESEARCH.md's Pattern 2 quotes):
```typescript
const streamTypes = Array.isArray(raw.stream_types)
  ? (raw.stream_types as string[])
  : undefined;
try {
  const geometry = await this.provider.fetchGeometry(String(activity.id), {
    streamTypes,
    expectedMeters: activity.distance,
  });
  if (geometry.summaryPolyline && geometry.startLatLng && geometry.validation?.ok) {
    activity.map = { summary_polyline: geometry.summaryPolyline };
    activity.start_latlng = geometry.startLatLng;
    activity.end_latlng = undefined; // not consumed downstream; omit rather than guess
  } else {
    console.warn(
      `  ${activity.id} (${activity.name}): geometry rejected — ` +
      `${geometry.validation?.reason ?? 'no coordinates'}; saving without route`
    );
  }
} catch (error: any) {
  console.warn(`  ${activity.id}: streams fetch failed (${error.message}); saving without route`);
}
```
Critical constraint from RESEARCH.md's Anti-Patterns: `this.provider.fetchGeometry(...)` already performs the `getStreams`/`getAllStreams` HTTP call — the `raw` response it returns (already destructured as `geometry.raw`/`geometry.rawAll` per `intervals-provider.ts:462-506`) must be reused to extract HR/cadence/altitude for the stream file, NOT re-fetched. Extend this same try block to also call `deriveFromIntervals(geometry.raw ?? geometry.rawAll)` and persist via `FileStore.writeJson` + manifest update, inside the same try/catch so a stream-derivation failure degrades the same way a geometry failure does (warn, keep the activity, continue).

**Constructor/dependency-injection pattern** (lines 22-43) — if stream persistence needs its own dependency (e.g., a `streamsDir` path or the new `stream-manifest.ts` helpers), add it the same way `activitiesDir` was threaded through:
```typescript
constructor({
  client,
  fileStore,
  syncStateManager,
  activitiesDir,
}: {
  client: IntervalsClient;
  fileStore: FileStore;
  syncStateManager: SyncStateManager;
  activitiesDir: string;
}) {
  this.provider = new IntervalsProvider(client);
  this.fileStore = fileStore;
  this.syncStateManager = syncStateManager;
  this.activitiesDir = activitiesDir;
}
```

**Persist-via-existing-FileStore pattern** (line 128):
```typescript
await this.fileStore.writeJson(`${this.activitiesDir}/${activity.id}.json`, activity);
```
Copy directly for stream persistence: `await this.fileStore.writeJson(\`${this.streamsDir}/${activity.id}.json\`, canonicalStream)`.

---

### `src/sync/intervals-sync.test.ts` (new test file — no prior test exists for this module)

**Analog:** `src/api/intervals-provider.test.ts` for Vitest conventions (`describe`/`it`/`expect` from `'vitest'`, no mocking library installed — hand-roll a minimal fake client/provider as a plain object literal implementing only the methods under test, following this codebase's existing style of testing static pure functions directly rather than mocking framework internals).

**Import + describe/it structure** (`intervals-provider.test.ts` lines 1-17):
```typescript
import { describe, expect, it } from 'vitest';

import { IntervalsProvider } from './intervals-provider.js';

describe('IntervalsProvider.extractCoordinates', () => {
  it('reads an array of {type, data} stream objects', () => {
    // ...
  });
});
```
For `intervals-sync.test.ts`, construct `IntervalsSync` with a hand-written fake `client` (object literal matching `IntervalsClient`'s public method shape: `getActivities`, `getStreams`, `getAllStreams`) and a real in-memory or temp-dir `FileStore`, asserting the persisted stream file + manifest entry after calling `syncNewActivities()` — this is a new pattern (no existing constructor-injected-fake test exists in the repo yet), but should follow `csv.test.ts`'s flat `describe`-per-function, `it`-per-behavior granularity (see `csv.test.ts` excerpt below) rather than one giant integration test.

---

### `src/streams/*.test.ts` (new test files)

**Analog:** `src/exports/csv.test.ts` for granularity/style; `src/api/intervals-provider.test.ts` for testing pure derivation functions with edge-case-named `it` blocks.

**Test naming/structure convention** (`csv.test.ts` lines 1-37):
```typescript
import { describe, expect, it } from 'vitest';

import { columnIndices, parseCsv, parseStravaExportDate } from './csv.js';

describe('parseCsv', () => {
  it('splits plain rows', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps commas inside quoted fields — every Strava date has two', () => {
    // ...
  });
});
```
Note the convention: `it` descriptions state the *specific edge case being defended*, often referencing the real data quirk that motivated it (e.g., "every Strava date has two [commas]"). Apply the same style to `derive-stream.test.ts`: `it('normalizes FIT half-cadence with fractional precision to spm')`, `it('treats a 0 intervals.icu cadence sample as a dropout, not zero spm')`, `it('omits the cadence channel when zero records carry the field — device-generation gap')`.

---

### `src/index.ts` (extend — register new command(s))

**Analog:** itself, `consolidate-exports` case (lines 465-469) — the exact pattern for a dynamically-imported, zero-argument data-pipeline command.

**CLI case pattern to copy**:
```typescript
case 'consolidate-exports': {
  const { consolidateExports } = await import('./exports/consolidate.js');
  await consolidateExports();
  break;
}
```
Add `case 'backfill-streams': { const { backfillStreams } = await import('./streams/backfill-streams.js'); await backfillStreams(); break; }` following this identical shape. Also add the help-text line following the existing convention (lines 425-427):
```typescript
console.log('  sync-intervals         - Sync new activities from intervals.icu (Garmin bridge)');
console.log('  consolidate-exports    - Reconcile bulk exports under export_data/ into the archive');
console.log('  probe-intervals        - Dry-run the intervals.icu provider (writes nothing)');
```

**Error handling convention** (lines 480-486, top-level `main()` wrapper — nothing new needed here, `backfillStreams()` throwing bubbles to this existing handler):
```typescript
main().catch((error) => {
  console.error('Unexpected error:', error.message);
  if (error.stack && !error.stack.includes('token') && !error.stack.includes('secret')) {
    console.error(error.stack);
  }
  process.exit(1);
});
```

---

### `src/config/strava.config.ts` (extend — optional `streamsDir` getter)

**Analog:** itself, `activitiesDir` getter (lines 57-59):
```typescript
get activitiesDir(): string {
  return path.join(this.dataDir, 'activities');
},
```
Add `get streamsDir(): string { return path.join(this.dataDir, 'streams'); }` and, if the manifest path needs its own getter, `get streamsManifestPath(): string { return path.join(this.streamsDir, 'manifest.json'); }` — following the same no-throw (unlike `clientId`/`clientSecret`/`refreshToken`) convention already used for `activitiesDir`/`syncStatePath`, since these have safe defaults and aren't required-with-no-fallback.

## Shared Patterns

### Non-blocking, per-item failure isolation
**Source:** `src/sync/intervals-sync.ts:109-126` and `src/exports/consolidate.ts:201-217`
**Apply to:** `derive-stream.ts` callers in both `backfill-streams.ts`'s per-file loop and `intervals-sync.ts`'s per-activity loop, and the new intervals-catch-up reconciliation branch.
```typescript
try {
  const geometry = await this.provider.fetchGeometry(String(activity.id), { ... });
  // ...
} catch (error: any) {
  console.warn(`  ${activity.id}: streams fetch failed (${error.message}); saving without route`);
}
```
One bad file or one failed request warns and continues; it never aborts the run. This is the single most load-bearing shared pattern in this phase — the backfill touches ~1,841 files and the daily sync runs unattended in CI.

### Atomic JSON writes
**Source:** `src/storage/file-store.ts:18-41` (`FileStore.writeJson`)
**Apply to:** All new writes to `data/streams/<id>.json` and `data/streams/manifest.json`, from both `backfill-streams.ts` and `intervals-sync.ts`. Do not hand-roll a second write primitive — instantiate/reuse the existing `FileStore` the same way `intervals-sync.ts` already does (constructor-injected, line 3/24/40).

### Idempotent, skip-if-exists CLI bookkeeping
**Source:** `src/exports/consolidate.ts:148-157` (index-then-process) and RESEARCH.md's Don't Hand-Roll table
**Apply to:** `backfill-streams.ts` — build a `Set`/`Map` of activity ids that already have a `data/streams/<id>.json` before the main loop, skip them, so re-running the command after a partial run or a new export drop is safe and cheap.

### Dynamic import + switch-case CLI registration
**Source:** `src/index.ts:465-469` (`consolidate-exports` case) and `:231-265` (`syncIntervalsCommand`)
**Apply to:** Registering `backfill-streams` (and, if the intervals catch-up ships as a separate command rather than a third branch inside `backfillStreams()`, that command too) in `src/index.ts`'s `main()` switch and `printHelp()`.

### Bounds-checked numeric field extraction ("coerce, bounds-check, else drop")
**Source:** `src/exports/geometry-readers.ts:40` (`typeof rec.positionLat === 'number'`) and `src/api/intervals-provider.ts:139-141` (`num()` + range check before push)
**Apply to:** Every new field `derive-stream.ts` extracts from FIT records, GPX text, and intervals.icu stream payloads (`heartRate` ≤250bpm, cadence raw ≤150, altitude -500..9000m per RESEARCH.md's Security Domain table) — treat an out-of-bounds or non-numeric value as missing, never store it.

## No Analog Found

None. Every file in this phase's scope has a direct, recently-modified analog already in the codebase — this is an explicit finding of RESEARCH.md ("every piece of infrastructure this phase needs... already exists in this codebase in a directly adjacent file").

## Metadata

**Analog search scope:** `src/exports/`, `src/sync/`, `src/api/`, `src/storage/`, `src/config/`, `src/index.ts`, plus their corresponding `*.test.ts` files and `.github/workflows/daily-refresh.yml`
**Files scanned:** `geometry-readers.ts`, `consolidate.ts`, `csv.ts`/`csv.test.ts`, `intervals-sync.ts`, `intervals-client.ts`, `intervals-provider.ts`/`intervals-provider.test.ts`, `file-store.ts`, `strava.config.ts`, `index.ts`, `daily-refresh.yml`
**Pattern extraction date:** 2026-08-10
