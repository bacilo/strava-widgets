# Phase 15: Best-Effort Engine - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 6 (4 new source/test files, 1 modified wiring file, 1 modified types file)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/analytics/best-effort-utils.ts` | utility (pure computation) | transform | `src/analytics/streak-utils.ts` | exact — same "pure edge-case logic module paired with an I/O orchestrator" role |
| `src/analytics/best-effort-utils.test.ts` | test | transform | `src/analytics/streak-utils.test.ts` + `src/streams/derive-stream.test.ts` | exact — colocated Vitest, pure-function-in/out, edge-case-per-`it` style |
| `src/analytics/compute-best-efforts.ts` | service (I/O orchestration) | batch / CRUD (read-many, write-one) | `src/analytics/compute-advanced-stats.ts` (shape) + `src/streams/stream-manifest.ts` (manifest read pattern) | exact — same read-all-activities-then-write-gitignored-JSON shape, but also needs the manifest-driven iteration `compute-advanced-stats.ts` doesn't do |
| `src/analytics/compute-best-efforts.test.ts` | test | batch / file-I/O | `src/streams/stream-manifest.test.ts` (tmpdir + FileStore harness) | role-match — no existing test currently exercises a `compute-*.ts` I/O orchestrator directly; the manifest test's tmpdir/FileStore pattern is the closest reusable harness |
| `src/index.ts` (modified — add `computeBestEffortsCommand` + wire into `computeAllStatsCommand`) | route / CLI command | request-response (CLI invocation) | `computeAdvancedStatsCommand()` / `computeGeoStatsCommand()` in the same file (lines 148–221) | exact — this file already has 3 near-identical command wrappers to copy verbatim |
| `src/types/analytics.types.ts` (modified — add best-effort/PR types, OR keep types colocated in `best-effort-utils.ts`) | model (types) | n/a | `src/types/analytics.types.ts` (`StreakData`, `StatsMetadata`) or `src/streams/stream.types.ts` (colocated-types precedent) | role-match — codebase has both conventions; `stream.types.ts` shows precedent for a dedicated types file per new subsystem |

## Pattern Assignments

### `src/analytics/best-effort-utils.ts` (utility, transform)

**Analog:** `src/analytics/streak-utils.ts`

**File-level doc comment pattern** (lines 1-9 of `streak-utils.ts`):
```typescript
/**
 * Streak calculation utilities for running analytics
 *
 * All functions use UTC methods exclusively for timezone safety.
 */

import { getWeekStart } from './date-utils.js';

const MS_PER_DAY = 86400000;
```
Copy this shape for `best-effort-utils.ts`: a short file-level doc comment stating the invariant the whole module relies on (there: "UTC only"; here: "never snap to next sample, always interpolate at the exact crossing" / "d/t only, never lat/lng"), then a `.js`-suffixed relative import (ESM convention — every intra-repo import in this codebase uses the `.js` extension even though source is `.ts`), then any top-level constants.

**Result-interface-first pattern** (lines 11-25):
```typescript
export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  withinCurrentStreak: boolean;
  currentStreakStart: Date | null;
  longestStreakStart: Date | null;
  longestStreakEnd: Date | null;
}

export interface WeeklyConsistencyResult {
  currentConsistencyStreak: number;
  longestConsistencyStreak: number;
  totalConsistentWeeks: number;
  totalWeeks: number;
}
```
Mirror with `RawEffort` / `PlausibilityResult` (already sketched in `15-RESEARCH.md` Pattern 1/3) — one exported interface per pure function's return shape, defined immediately after imports, before the function that produces it.

**Core algorithm pattern — RESEARCH.md already has this locked verbatim; treat it as the primary source, not `streak-utils.ts`.** The two-pointer sweep (`findBestEffort`), the pre-filter, and `isPlausible` are fully specified in `15-RESEARCH.md` lines 166-258 ("Pattern 1", "Pattern 2", "Pattern 3") and MUST be copied from there — `streak-utils.ts` only supplies the *module shape* (doc comment → interfaces → pure exported functions → private helpers), not the algorithm itself, since no best-effort sweep exists anywhere in this codebase yet (`grep -rn "best.effort\|bestEffort" src/` returns zero matches, confirmed in RESEARCH.md).

**Private-helper-below-public-function pattern** (lines 30-44, `normalizeToUTCMidnight`/`dateToUTCString` sit above their first use but are unexported):
```typescript
function normalizeToUTCMidnight(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
```
Use the same convention for any internal helper the sweep needs (e.g., a private `interpolateCrossing(t, d, j, targetMeters)` extracted out of `findBestEffort` if the planner wants to unit-test interpolation independently — optional, RESEARCH.md's `findBestEffort` already inlines it).

---

### `src/analytics/best-effort-utils.test.ts` (test, transform)

**Analog:** `src/analytics/streak-utils.test.ts` (edge-case-per-`describe` structure) + `src/streams/derive-stream.test.ts` (pure-function-in/pure-value-out assertions, no mocking needed)

**Import + describe/it shape** (`derive-stream.test.ts` lines 1-18):
```typescript
import { describe, expect, it } from 'vitest';

import { deriveFromIntervalsStreams, deriveFromSamples } from './derive-stream.js';
import type { RawSample } from './stream.types.js';

describe('deriveFromSamples — cadence normalization', () => {
  it('normalizes FIT half-cadence with fractional precision (87 + 0.5 -> 175 spm)', () => {
    const result = deriveFromSamples(
      'x',
      [
        { tEpochS: 0, distanceM: 0, cadenceRawRpm: 87, fractionalCadence: 0.5 },
        { tEpochS: 1, distanceM: 3, cadenceRawRpm: 87, fractionalCadence: 0.5 },
      ],
      'fit'
    );

    expect(result?.cadence?.[0]).toBe(175);
  });
```
Copy this exact shape for `findBestEffort`/`isPlausible`/`markPRs` tests: no mocks, no async, construct tiny `t`/`d` arrays inline, assert on the returned interface's fields. `describe` blocks grouped by *behavior category* (e.g., `describe('findBestEffort — two-pointer sweep')`, `describe('findBestEffort — pause gaps')`, `describe('isPlausible — max_speed guard')`, `describe('isPlausible — max_speed unavailable')`) exactly mirrors `derive-stream.test.ts`'s `describe('deriveFromSamples — cadence normalization')` / `describe('deriveFromSamples — bounds guards')` / `describe('deriveFromSamples — distance')` split — one `describe` per Pitfall/Pattern from RESEARCH.md's "Phase Requirements → Test Map" table (lines 448-458), not one per function.

**Required specific test cases** (from RESEARCH.md's test map, each maps to one `it`):
- Two-pointer sweep finds minimum-duration window with exact-crossing interpolation
- Pause/timestamp-gap activities produce correct (not index-biased) durations
- `max_speed` guard rejects one implausible effort without affecting sibling distances on the same activity
- `max_speed` absent/zero (real activity `11865310195`, per RESEARCH.md Pitfall 5) degrades to world-record-only guard
- `markPRs` correctly reflects chronological improvement per distance

---

### `src/analytics/compute-best-efforts.ts` (service, batch/CRUD)

**Analog:** `src/analytics/compute-advanced-stats.ts` (overall shape) + `src/streams/stream-manifest.ts` (manifest-driven iteration, since this is the one thing `compute-advanced-stats.ts` doesn't need)

**Imports + options-object pattern** (`compute-advanced-stats.ts` lines 1-22):
```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import type { StravaActivity } from '../types/strava.types.js';
import type {
  YearOverYearMonth,
  TimeOfDayPattern,
  SeasonalTrendMonth,
  StreakData,
} from '../types/analytics.types.js';
import { calculateDailyStreaks, calculateWeeklyConsistency } from './streak-utils.js';

interface ComputeAdvancedStatsOptions {
  activitiesDir?: string;
  statsDir?: string;
}

export async function computeAdvancedStats(
  options: ComputeAdvancedStatsOptions = {}
): Promise<void> {
  const activitiesDir = options.activitiesDir || 'data/activities';
  const statsDir = options.statsDir || 'data/stats';
  ...
```
Copy this exact shape: a `Compute*Options` interface with optional dir overrides (defaulted with `||`, not `??`, matching the existing convention), a single exported async function taking that options object, console.log progress lines. Extend the options interface with `streamsDir?: string` and `streamsManifestPath?: string` since this file also needs Phase 14's manifest — follow `IntervalsSync`'s constructor shape (`src/sync/intervals-sync.ts`, and its wiring in `src/index.ts` lines 242-249) for how a class/function that needs both `activitiesDir` and `streamsDir`/`streamsManifestPath` already receives them together.

**Manifest-driven iteration (NOT globbing `data/streams/`)** — `src/streams/stream-manifest.ts` lines 42-54:
```typescript
export async function loadManifest(
  fileStore: FileStore,
  manifestPath: string
): Promise<StreamManifest> {
  try {
    return await fileStore.readJson<StreamManifest>(manifestPath);
  } catch (error) {
    if ((error as Error).message.startsWith('File not found:')) {
      return emptyManifest();
    }
    throw error;
  }
}
```
`compute-best-efforts.ts` must `loadManifest(fileStore, streamsManifestPath)` once up front, then iterate `Object.entries(manifest.activities)` filtering to `entry.available === true`, reading `data/streams/<id>.json` only for those ids (never `fs.readdir('data/streams')` — this is RESEARCH.md's "Don't Hand-Roll" table row 2, and directly mirrors how `stream-manifest.ts` is the single source of truth per Phase 14's D-04).

**Atomic write via FileStore instead of raw `fs.writeFile`** — `src/storage/file-store.ts` lines 18-41 (note: `compute-advanced-stats.ts`/`compute-stats.ts` predate `FileStore` and use raw `fs.writeFile` directly; `compute-best-efforts.ts` should use `FileStore.writeJson` instead, matching the more recent `stream-manifest.ts`/`intervals-sync.ts` convention per RESEARCH.md's "Don't Hand-Roll" table):
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
    try { await fs.unlink(tempPath); } catch { /* ignore */ }
    throw error;
  }
}
```

**Per-item failure isolation (D-04's "never fails CI")** — `src/sync/intervals-sync.ts` lines 119-139 is the established try/catch-log-and-continue shape:
```typescript
// Enrich with geometry. A failed validation logs and proceeds without a
// route — the run still counts toward stats; it just won't draw on maps.
try {
  const geometry = await this.provider.fetchGeometry(String(activity.id), { ... });
  if (geometry.summaryPolyline && geometry.startLatLng && geometry.validation?.ok) {
    activity.map = { summary_polyline: geometry.summaryPolyline };
    ...
  } else {
    console.warn(
      `  ${activity.id} (${activity.name}): geometry rejected — ` +
      `${geometry.validation?.reason ?? 'no coordinates'}; saving without route`
    );
  }
```
Apply the identical shape at **per-target-distance granularity** inside the per-activity loop (RESEARCH.md Pitfall 6 explicitly warns against per-activity-only isolation): each of the 7 targets gets its own try/catch or guard check; a rejected/implausible effort logs a `console.warn` with the reason and the loop continues to the next target, never `throw`s out of the activity.

**Aggregation-map-then-array pattern** (`compute-stats.ts` lines 72-114, reused for weekly/monthly/yearly — same shape applies to grouping efforts by target distance for the top-N/PR-marking step):
```typescript
const weeklyMap = new Map<string, { totalKm: number; runCount: number; ... }>();
for (const activity of activities) {
  const weekStart = getWeekStart(activityDate);
  const weekStartISO = weekStart.toISOString();
  const existing = weeklyMap.get(weekStartISO) || { totalKm: 0, ... };
  existing.totalKm += activity.distance / 1000;
  weeklyMap.set(weekStartISO, existing);
}
const weeklyStats: WeeklyStats[] = Array.from(weeklyMap.entries())
  .map(([weekStartISO, stats]) => ({ weekStartISO, ...stats }))
  .sort((a, b) => a.weekStartISO.localeCompare(b.weekStartISO));
```
Use this exact `Map<targetDistance, RawEffort[]>` accumulate-then-`Array.from(...).map(...).sort(...)` shape for grouping all activities' efforts by target distance before calling `markPRs` (RESEARCH.md Pattern 4) and deriving the top-N ranking.

**Console summary pattern** (`compute-advanced-stats.ts` lines 260-266 / `compute-stats.ts` lines 293-298):
```typescript
console.log(`\nGenerated advanced statistics:`);
console.log(`- Year-over-year: 12 months across ${sortedYears.length} years`);
...
console.log(`\nOutput written to: ${statsDir}`);
```
End `computeBestEfforts()` with an equivalent summary block, PLUS (per D-04) an explicit enumeration of every rejected/dropped effort with its reason — this is new relative to the analogs (neither existing compute file has a rejection-reporting section) but follows the same `console.log`-based, never-`process.exit`-inside-the-function convention (exit codes belong in `src/index.ts`'s command wrapper, not the library function).

---

### `src/analytics/compute-best-efforts.test.ts` (test, batch/file-I/O)

**Analog:** `src/streams/stream-manifest.test.ts` (tmpdir + real `FileStore` harness — this is the only existing test in the repo that exercises real file I/O against a `FileStore`, which `compute-best-efforts.ts` will need since it's the first `compute-*.ts` file to use `FileStore.writeJson` instead of raw `fs.writeFile`)

**tmpdir + FileStore setup/teardown pattern** (lines 1-32):
```typescript
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileStore } from '../storage/file-store.js';
...

describe('stream-manifest', () => {
  let tmpDir: string;
  let fileStore: FileStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stream-manifest-'));
    fileStore = new FileStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
```
Use identically for `compute-best-efforts.test.ts`'s I/O-level tests (e.g. "writes `best-efforts.json` matching D-06's schema shape") — seed a tmpdir with a handful of synthetic `data/activities/<id>.json` + `data/streams/manifest.json` + `data/streams/<id>.json` files, run `computeBestEfforts({ activitiesDir, streamsDir, streamsManifestPath, statsDir })` against the tmpdir, then assert on the written JSON.

**Fixture validation harness (D-05) — no existing analog; use RESEARCH.md's own scaffold verbatim** (`15-RESEARCH.md` lines 374-392):
```typescript
interface FixtureCase {
  activityId: string;
  source: 'fit' | 'gpx' | 'intervals';
  target: keyof typeof TARGET_METERS;
  expectedDurationSec: number; // from Strava/Garmin Connect — USER MUST SUPPLY
}

const TOLERANCE = 0.02; // 2%, per D-05

it.each(fixtures)('matches Strava-reported %s effort within tolerance', (fx) => {
  const result = computeBestEffortForActivity(fx.activityId, fx.target);
  const delta = Math.abs(result.durationSec - fx.expectedDurationSec) / fx.expectedDurationSec;
  expect(delta).toBeLessThanOrEqual(TOLERANCE);
});
```
This test suite reads the **real committed** `data/streams/<id>.json` / `data/activities/<id>.json` (not a tmpdir fixture) since the whole point is validating against real archive data — the fixture activity ids/expected values are a `checkpoint:human-verify` blocker per RESEARCH.md Open Question 1, not something to fabricate.

---

### `src/index.ts` (route/CLI command, modified)

**Analog:** `computeAdvancedStatsCommand()` (lines 148-164) and `computeGeoStatsCommand()`'s lazy-import style (lines 166-183)

**Command wrapper pattern to copy verbatim, renamed:**
```typescript
async function computeAdvancedStatsCommand() {
  try {
    console.log('Computing advanced statistics from synced activities...\n');
    await computeAdvancedStats({
      activitiesDir: config.activitiesDir,
      statsDir: 'data/stats',
    });
    console.log('\nAdvanced statistics generated successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('Compute advanced stats error:', error.message);
    if (error.code === 'ENOENT' && error.message.includes('activities')) {
      console.error('\nActivities directory not found. Please run: npm run sync');
    }
    process.exit(1);
  }
}
```
Note `computeGeoStatsCommand()` (lines 166-183) uses a **lazy dynamic import** (`const { computeGeoStats } = await import('./geo/compute-geo-stats.js');`) rather than a static top-level import — this is the established convention for newer/optional compute modules (also used for `IntervalsClient`/`IntervalsSync` at lines 233-234). Prefer the lazy-import style for `computeBestEfforts` too, both in its own command wrapper and inside `computeAllStatsCommand()`.

**Wiring into the aggregate chain** (`computeAllStatsCommand()`, lines 185-221) — add a 4th step following the exact same three-step shape (basic → advanced → geo), each separated by a blank `console.log('')`:
```typescript
// Run geo stats
const { computeGeoStats } = await import('./geo/compute-geo-stats.js');
await computeGeoStats({
  activitiesDir: config.activitiesDir,
  geoDir: 'data/geo',
});

console.log('\nAll statistics generated successfully!');
```
Insert a `// Run best-efforts computation` step here (or after, per CONTEXT's "Claude's Discretion" on chain-vs-sibling — the codebase's own precedent is "add to the chain," since 3/3 existing compute modules are already chained this way).

**Switch-case command registration** (lines 443-463 — not fully shown above but consistent with the `case 'compute-advanced-stats': await computeAdvancedStatsCommand(); break;` shape) — add `case 'compute-best-efforts': await computeBestEffortsCommand(); break;` plus a usage-help line alongside lines 423-426.

---

### `src/types/analytics.types.ts` (model/types, modified — OR new colocated types)

**Analog:** `StreakData`/`StatsMetadata` shape in `analytics.types.ts` (fields referenced at `compute-advanced-stats.ts` lines 15-16, 211-231) — `generatedAt` (camelCase) is the established metadata field name in this file, NOT `generated_at` (snake_case), which is instead the convention inside `src/streams/stream.types.ts` (`StreamManifest.generated_at`). **Two competing conventions exist in this codebase** — planner must pick one and should default to whichever sibling type (`StreamManifest` if colocating with Phase 14's stream types, or `StatsMetadata` if colocating in `analytics.types.ts`) is closer to `best-efforts.json`'s actual shape. Given D-06 explicitly says "following the `compute-stats.ts` convention," prefer `generatedAt` (camelCase) to match `analytics.types.ts`.

---

## Shared Patterns

### Non-blocking, per-item failure isolation ("never fails CI")
**Source:** `src/sync/intervals-sync.ts` lines 119-139 (try/catch around one enrichment step per activity, `console.warn` + continue)
**Apply to:** `compute-best-efforts.ts`'s per-activity AND per-target-distance loops — RESEARCH.md Pitfall 6 requires isolation at the *target-distance* level specifically, one level deeper than this analog's per-activity isolation, but the shape (try/catch, warn with a descriptive reason string, never throw/abort the outer loop) is identical.

### Atomic gitignored JSON write
**Source:** `src/storage/file-store.ts` lines 18-41 (`FileStore.writeJson` — temp-file + rename)
**Apply to:** `compute-best-efforts.ts`'s final `data/stats/best-efforts.json` write. Preferred over the raw `fs.writeFile` still used by `compute-stats.ts`/`compute-advanced-stats.ts`, since `FileStore` is the more recent (Phase 14) convention and RESEARCH.md's own "Don't Hand-Roll" table calls it out explicitly for this phase.

### Manifest-driven iteration, never directory globbing
**Source:** `src/streams/stream-manifest.ts` (`loadManifest`) + `data/streams/manifest.json`'s `activities: Record<string, StreamManifestEntry>` shape (`src/streams/stream.types.ts` lines 109-136)
**Apply to:** `compute-best-efforts.ts` must iterate `manifest.activities` (filtering `available === true`) to decide which `data/streams/<id>.json` files to read, and read `entry.distanceSource` directly off the manifest entry rather than re-deriving it from the stream file (both places carry it, but the manifest is the cheaper/canonical read for the D-03 `lowConfidence` flag).

### `.js`-suffixed relative imports (ESM convention)
**Source:** every file read this session (`streak-utils.ts` line 7, `compute-advanced-stats.ts` lines 10-17, `stream-manifest.ts` lines 1-10)
**Apply to:** all new files — `import { ... } from './best-effort-utils.js'` even though the source file is `best-effort-utils.ts`.

### Options-object-with-directory-overrides for compute functions
**Source:** `ComputeAdvancedStatsOptions` (`compute-advanced-stats.ts` lines 19-22), `ComputeStatsOptions` (`compute-stats.ts` lines 24-27)
**Apply to:** `ComputeBestEffortsOptions` in `compute-best-efforts.ts` — `activitiesDir?`, `streamsDir?`, `streamsManifestPath?`, `statsDir?`, each defaulted via `||` against `config.*` in `src/index.ts`'s wrapper (see `config.ts` lines 57-67 for the exact default path shapes: `data/activities`, `data/streams`, `data/streams/manifest.json`).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Fixture reference data (D-05, `data/analytics-fixtures/*` or inline test constants) | test data | file-I/O | No existing fixture-pinning convention in this repo for externally-verified reference values (closest is `derive-stream.test.ts`'s inline synthetic samples, which are self-consistent, not externally verified against a third party like Strava/Garmin). RESEARCH.md's own scaffold (Code Examples section) is the only available template; requires a `checkpoint:human-verify` step before the suite can be finalized (RESEARCH.md Open Question 1). |
| World-record pace constants table | config/constants | n/a | No existing "external reference data with inline citations" convention in this repo (closest structural precedent is `DECIMATION_LADDER` in `derive-stream.ts`, a tuning constant, not an externally-sourced one). Use RESEARCH.md's `WORLD_RECORD_SPEED_MPS` table (Code Examples section) verbatim — it's already fully specified with citations. |

## Metadata

**Analog search scope:** `src/analytics/`, `src/streams/`, `src/sync/`, `src/storage/`, `src/types/`, `src/index.ts`, `src/config/strava.config.ts`
**Files scanned:** `streak-utils.ts`, `streak-utils.test.ts`, `compute-advanced-stats.ts`, `compute-stats.ts`, `stream-manifest.ts`, `stream-manifest.test.ts`, `stream.types.ts`, `derive-stream.ts`, `derive-stream.test.ts`, `file-store.ts`, `intervals-sync.ts`, `index.ts`, `strava.config.ts`, `strava.types.ts`, `analytics.types.ts`
**Pattern extraction date:** 2026-08-10
