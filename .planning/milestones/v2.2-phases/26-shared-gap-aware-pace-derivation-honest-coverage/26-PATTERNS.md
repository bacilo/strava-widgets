# Phase 26: Shared Gap-Aware Pace Derivation & Honest Coverage - Pattern Map

**Mapped:** 2026-09-08
**Files analyzed:** 15 (7 new, 8 modified)
**Analogs found:** 15 / 15 (all matched; one — the residual script — matched at role-level only)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/analytics/pace-derivation.ts` | service (analytics module) | transform (batch, over a stream array) | `src/analytics/trimp.ts` (purity/header) + `src/dashboard/views/detail-charts-logic.ts` `derivePaceSeries` (shape) + `src/dashboard/views/detail-zones.ts` `computePaceDistribution` (Δt-weighted skip-defect) | exact (composite — no single file owns both halves today) |
| `src/analytics/pace-derivation.test.ts` | test (unit) | transform | `src/dashboard/views/detail-zones.test.ts` | exact |
| `src/analytics/pace-fixtures.ts` | utility (fixture library, named exports) | batch / file-I/O (node:fs read of committed archive) | `src/analytics/best-effort-fixtures.test.ts` | role-match (analog is a `.test.ts`, not a standalone fixtures module, but its FIXTURES array + node:fs read pattern is exactly what D-20 wants) |
| `src/analytics/pace-fixtures.test.ts` | test (unit, presence assertions) | transform | `src/analytics/best-effort-fixtures.test.ts` (coverage-guard `it()` blocks at the tail) | exact |
| `src/analytics/pace-single-source.test.ts` | test (repo-scanning guard, vitest) | transform (source-tree scan) | `src/dashboard/curation-seam.test.ts` (vitest source-text-shape guard) + `scripts/lib/curation-guard.mjs` (pure scanner returning a violations array — reused for scanning shape, not for the vitest wrapper) | exact (curation-seam.test.ts) / role-match (curation-guard.mjs) |
| `scripts/compute-pace-residual.mjs` | script (archive-sweeping report generator) | batch / file-I/O | `scripts/compute-route-data.mjs` | role-match (JSON-only precedent; no existing script emits Markdown — see "No Analog Found") |
| `.planning/phases/26-.../26-RESIDUAL.md` | config/deliverable (committed markdown) | file-I/O (static, reviewed) | `.planning/milestones/v2.0-phases/15-best-effort-engine/15-FIXTURE-CANDIDATES.md` | exact (precedent named explicitly in CONTEXT.md D-19) |
| `src/dashboard/views/detail-zones.ts` (modify `computePaceDistribution`) | service (analytics module) | transform | itself, pre-modification (baseline) | exact — this IS the located defect site |
| `src/dashboard/views/detail-charts-logic.ts` (modify `derivePaceSeries`) | service (analytics module) | transform | itself, pre-modification (baseline) | exact — becomes a thin caller of `pace-derivation.ts` |
| `src/dashboard/views/detail-sections.ts` (D-08/D-09/D-13) | component (DOM builder) | request-response (render) | itself: `buildBreakdownSection` (~line 313), footnote pattern (lines 418-445), `buildPaceBarCell` (lines 74-118) | exact — all three additions extend existing functions in this same file |
| `src/dashboard/views/detail.ts` (`buildBreakdownSection` call site, `buildStatCard` extension) | component (DOM builder / page assembly) | request-response (render) | itself: `buildStatCard` (lines 145-157), call site (line 689) | exact |
| `src/dashboard/views/list.ts` (D-11 badge) | component (DOM builder) | request-response (render) | itself: `statusBadgeTexts`/`appendStatusBadges`/`appendLowConfidenceBadge` (lines 142-282) | exact |
| `src/dashboard/views/list-logic.ts` (D-12 no-suppression) | service (pure sort/filter logic) | transform | itself: `sortValueFor`'s `'pace'` case (line 194-195), `matchesFilters`'s pace-range block (lines 322-336) | exact |
| `src/analytics/compute-dashboard-index.ts` + `src/analytics/dashboard-index.types.ts` (D-14 additive flag) | service + model | CRUD (batch write) | itself: the `gearName` addition — `dashboard-index.types.ts:17` doc comment + `gearName: string \| null` field (line 85), and the `paceSecPerKm` computation site (lines ~201-203) | exact — CONTEXT.md names this precedent directly |
| `src/analytics/compute-dashboard-index.test.ts` (extend) | test (unit, archive orchestration) | CRUD | itself: `EXPECTED_ROW_KEYS` sorted-array assertion (lines 12-31) | exact |
| `src/dashboard/views/detail-sections.test.ts` (NEW — does not exist yet, see below) | test (unit, DOM/structure assertion) | request-response | `src/dashboard/views/detail-zones.test.ts` (`makeStream` fixture builder + `describe`/`it` shape) | role-match |

**Correction to RESEARCH.md's Wave-0 gap list:** `src/dashboard/views/detail-sections.test.ts` does **not** currently exist (`find src/dashboard/views -name "*.test.ts"` confirms it). RESEARCH.md's "extend, don't duplicate" instruction assumed a file that isn't there — the planner creates it fresh, following `detail-zones.test.ts`'s fixture/`describe` shape (below), not by editing an existing file.

---

## Pattern Assignments

### `src/analytics/pace-derivation.ts` (service, transform)

**Analogs:** `src/analytics/trimp.ts` (module header / purity discipline), `src/dashboard/views/detail-charts-logic.ts` (`derivePaceSeries`, `interpValueAtTime` — the window/interpolation shape to keep), `src/dashboard/views/detail-zones.ts` (`computePaceDistribution` — the Δt-weighted-bucket shape, and the exact `dt <= 0 || dd <= 0` skip that is the located defect, at line 74).

**Purity header pattern** (`src/analytics/trimp.ts:1-21`):
```typescript
/**
 * Edwards and Banister TRIMP (training impulse) over the committed,
 * decimated `{t[], hr[]}` stream shape (TREND-04, D-14, D-15).
 *
 * Pure, client-safe module — no `fs`, no `fetch`, no DOM. Both models are
 * computed per activity from the HR **stream**, never from `avgHr`, per
 * D-14.
 *
 * Pitfall 2 (18-RESEARCH.md § Common Pitfalls): `CanonicalStream.t` is
 * decimated and irregularly spaced (variable sample intervals), not
 * fixed-Hz. ... integrate by the REAL `Δt` between consecutive samples
 * (`t[i + 1] - t[i]`), never by sample count.
 */
```
D-15's own header should mirror this shape exactly: state the module is pure/client-safe, name what it must never import (`fs`, `fetch`, DOM), and restate the Δt-integration discipline this module inherits as its fourth consumer.

**Core windowed-derivation pattern to keep, `derivePaceSeries`** (`src/dashboard/views/detail-charts-logic.ts:88-131`, plus `interpValueAtTime` at `68-86`):
```typescript
function interpValueAtTime(t: number[], values: number[], time: number): number {
  const n = t.length;
  if (n === 0) return NaN;
  if (n === 1 || time <= t[0]) return values[0];
  if (time >= t[n - 1]) return values[n - 1];
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t[mid] <= time) lo = mid; else hi = mid - 1;
  }
  const i = lo, j = Math.min(i + 1, n - 1);
  if (t[j] === t[i]) return values[i];
  const frac = (time - t[i]) / (t[j] - t[i]);
  return values[i] + frac * (values[j] - values[i]);
}

export function derivePaceSeries(
  t: number[], d: number[], windowSec: number = PACE_SMOOTHING_WINDOW_SEC
): (number | null)[] {
  const n = t.length;
  const result: (number | null)[] = new Array(n);
  if (n === 0) return result;
  const half = windowSec / 2;
  const tStart = t[0], tEnd = t[n - 1];
  for (let i = 0; i < n; i++) {
    const windowStart = Math.max(tStart, t[i] - half);
    const windowEnd = Math.min(tEnd, t[i] + half);
    const elapsed = windowEnd - windowStart;
    if (!(elapsed > 0)) { result[i] = null; continue; }
    const dStart = interpValueAtTime(t, d, windowStart);
    const dEnd = interpValueAtTime(t, d, windowEnd);
    const metres = dEnd - dStart;
    if (!(metres > 0)) { result[i] = null; continue; }
    result[i] = elapsed / (metres / 1000);
  }
  return result;
}
```
Per D-01/RESEARCH.md Pattern 2, this signature stays but is called with a per-activity `adaptiveWindowSec(t, d)` value instead of the constant. The `null`-on-zero-metres/zero-elapsed contract must survive unchanged (Security Domain V5 note: never coerce to `0` with `?? 0`).

**The located defect this module fixes, `computePaceDistribution`** (`src/dashboard/views/detail-zones.ts:61-93`):
```typescript
export function computePaceDistribution(
  stream: CanonicalStream, bucketWidthSec: number = PACE_BUCKET_WIDTH_SEC
): PaceBucket[] {
  const { t, d } = stream;
  if (!validateStreamSeries(t, d).ok) return [];
  const bucketTimeSec = new Map<number, number>();
  for (let i = 0; i < t.length - 1; i++) {
    const dt = t[i + 1] - t[i];
    const dd = d[i + 1] - d[i];
    if (dt <= 0 || dd <= 0) continue;   // <-- THE DEFECT (D-07's watched-failing case)
    const paceSecPerKm = dt / (dd / 1000);
    const index = Math.floor(paceSecPerKm / bucketWidthSec);
    bucketTimeSec.set(index, (bucketTimeSec.get(index) ?? 0) + dt);
  }
  // ... sorts indices, formats labels ...
}
```
`pace-derivation.ts`'s coverage accounting replaces this raw-per-segment skip: every segment must land in exactly one of `{recording-gap, pause, covered}` (RESEARCH.md Pattern 1), never silently dropped, so `covered + recordingGap + pause === t[n-1] - t[0]` exactly (D-07).

**Validation guard to reuse unchanged** (`src/analytics/best-effort-utils.ts:50-66`):
```typescript
export function validateStreamSeries(t: number[], d: number[]): PlausibilityResult {
  if (t.length !== d.length) { return { ok: false, reason: `t and d length mismatch...` }; }
  const n = t.length;
  if (n < 2) { return { ok: false, reason: `series has ${n} sample(s)...` }; }
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(t[i])) { return { ok: false, reason: `t[${i}] is not a finite number...` }; }
    // ...
  }
}
```

**Single-entry-point contract to build (D-16), no direct analog — synthesize from RESEARCH.md Pattern 3:**
```typescript
export function derivePaceWithCoverage(stream: CanonicalStream): {
  paceSeries: (number | null)[];
  coverage: { coveredSec: number; recordingGapSec: number; pauseSec: number; span: number; gapIntervals: GapInterval[] };
} { /* single pass; every caller (chart, histogram, splits, residual script) uses this, never a partial call */ }
```

---

### `src/analytics/pace-derivation.test.ts` (test, unit)

**Analog:** `src/dashboard/views/detail-zones.test.ts` — fixture builder + `describe`/`it` shape, and its existing "sums bucket timeSec to elapsed time" test is the direct ancestor of this phase's D-07 exact-sum assertion.

**Fixture builder pattern** (`src/dashboard/views/detail-zones.test.ts:11-28`):
```typescript
function makeStream(t: number[], d: number[], hr?: number[]): CanonicalStream {
  return {
    schemaVersion: 1, id: 'test-activity', source: 'intervals', distanceSource: 'native',
    sampleCount: t.length,
    channels: { time: true, distance: true, hr: hr !== undefined, cadence: false, elevation: false },
    t, d,
    ...(hr !== undefined ? { hr } : {}),
  };
}
```

**Exact-sum assertion pattern to extend into D-07's coverage identity** (`src/dashboard/views/detail-zones.test.ts:47-51`):
```typescript
it('sums bucket timeSec to the stream elapsed time within 0.01 s on an irregular fixture', () => {
  const stream = makeStream([0, 1, 5, 10, 14, 16, 18, 20], [0, 5, 25, 50, 70, 80, 90, 100]);
  const buckets = computePaceDistribution(stream);
  const total = buckets.reduce((sum, b) => sum + b.timeSec, 0);
  expect(total).toBeCloseTo(stream.t[stream.t.length - 1] - stream.t[0], 2);
});
```
D-07's own test must assert exact equality (`covered + recordingGap + pause === t[n-1] - t[0]`) as an identity, not `toBeCloseTo`, and must be demonstrated failing against the real `dd <= 0` skip first (write it, run it against the unmodified `computePaceDistribution` shape, confirm it fails, then implement the fix) per D-07's own wording.

**Weighting-by-real-Δt discrimination pattern** (`src/dashboard/views/detail-zones.test.ts:52-58`, the "never one sample-count unit each" test) — the template for D-02/D-05's "demonstrated failing first" requirement: write the fixed-20s / absolute-threshold version, assert it produces the cited wrong number, THEN assert the adaptive/scale-relative version produces the corrected number, both in the same test file so the regression is pinned.

---

### `src/analytics/pace-fixtures.ts` + `pace-fixtures.test.ts` (utility + test)

**Analog:** `src/analytics/best-effort-fixtures.test.ts` (full file — this is the ERA-03 pattern D-20 explicitly names).

**Header / provenance-discipline pattern** (`src/analytics/best-effort-fixtures.test.ts:1-21`):
```typescript
/**
 * External-reference validation suite for the best-effort engine (D-05).
 *
 * The `expectedDurationSec` value in every fixture row below was read
 * manually by the developer from Strava's own "Best Efforts" panel...
 * These are the ONLY external reference this engine has... Changing an
 * `expectedDurationSec` value to make a test pass is a correctness
 * regression in the engine, not a fix to this file.
 *
 * This suite reads the REAL committed archive (`data/streams/<id>.json` and
 * `data/activities/<id>.json`) directly via `node:fs` — it never reads the
 * derived, gitignored stats output under `data/stats/`, which is absent on
 * a fresh clone.
 */
```
`pace-fixtures.ts`'s own header should state the equivalent: synthetic fixtures carry a hand-derived expected answer (no ground truth exists for real GPS data — D-20), pinned real-archive fixtures are read via `node:fs` from `data/streams/`/`data/activities/`, never from `data/stats/`.

**node:fs archive-read pattern** (`src/analytics/best-effort-fixtures.test.ts:107-130`):
```typescript
function computeEffortsForActivity(activityId: string, distanceSource: DistanceSource) {
  const activity = JSON.parse(
    fs.readFileSync(path.join('data/activities', `${activityId}.json`), 'utf-8')
  ) as StravaActivity;
  const stream = JSON.parse(
    fs.readFileSync(path.join('data/streams', `${activityId}.json`), 'utf-8')
  ) as CanonicalStream;
  // ...
  return computeActivityEfforts(input);
}
```
Same two-file read pattern (`data/activities/{id}.json` + `data/streams/{id}.json`) applies to `pace-fixtures.ts`'s pinned real cases (4556693525, and any recording-gap/decimation-aliased pinned IDs research selects), imported with `path.join('data/streams', ...)` / `path.join('data/activities', ...)`, never `data/stats/`.

**Named-fixture array + coverage-guard test tail pattern** (`src/analytics/best-effort-fixtures.test.ts:56-105, 132-176`):
```typescript
export const FIXTURES: FixtureCase[] = [ /* one object per case, activityId + expected + reference */ ];

describe('best-effort fixtures — external reference validation', () => {
  it.each(FIXTURES)('matches the platform-reported $target effort...', (fx) => { /* ... */ });

  // Coverage guards — keep the fixture set from silently eroding.
  it('has at least 5 fixture rows', () => { expect(FIXTURES.length).toBeGreaterThanOrEqual(5); });
  it('includes at least one short-distance (400m or 1k) fixture', () => { /* .some(...) */ });
  it('spans at least two distinct stream sources', () => { /* Set(...).size */ });
});
```
`pace-fixtures.test.ts`'s Criterion-6 "each required fixture present by name" assertion is this exact "coverage guard" idiom, extended to name each required category from D-20 (fēnix 6 Pro / Suunto 9 / GPX / intervals.icu-only / no-device-name / decimation-aliased / recording-gap / multi-hour-pause / impossible-speed / 4556693525) rather than counting rows.

**Pitfall carried from RESEARCH.md:** no real multi-hour, densely-sampled pause exists in the archive (exhaustive scan, longest found 10.4 min on `3475742397`) — that one fixture must be synthetic (dense 2-5s samples, `d` flat for 3 hours), built directly in `pace-fixtures.ts` rather than read via `node:fs`.

---

### `src/analytics/pace-single-source.test.ts` (test, repo-scanning guard)

**Analogs:** `src/dashboard/curation-seam.test.ts` (vitest source-text-shape guard, the closest thing to a "grep `src/` and assert a pattern's exact call count/location" test already in this repo) and `scripts/lib/curation-guard.mjs` (pure violations-array scanner shape, reused for its *pattern* — fail-closed, return array, never throw/exit inside the pure function).

**Source-read + comment-strip + occurrence-count pattern** (`src/dashboard/curation-seam.test.ts:1-41`):
```typescript
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stripComments } from './row-semantics.test.js';

const VIEWS_DIR = new URL('./views/', import.meta.url);
function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, VIEWS_DIR), 'utf8');
}
const detailSectionsSource = readSource('detail-sections.ts');
const detailSectionsStripped = stripComments(detailSectionsSource);

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}
```
`pace-single-source.test.ts` needs the `src`-wide equivalent: walk every `.ts` file under `src/` (readdirSync recursively — reuse `curation-guard.mjs`'s `walk()` shape below for the traversal, not its curate-specific violation reasons), strip comments per-file, and assert the literal pace-arithmetic shapes (`dt / (dd / 1000)`, `elapsed / (metres / 1000)` — RESEARCH.md's Pitfall 5 names these exact two strings, confirmed at `detail-zones.ts:76` and `detail-charts-logic.ts:127`) occur ONLY inside `pace-derivation.ts`.

**Directory-walk + fail-closed pattern to reuse for the scan itself** (`scripts/lib/curation-guard.mjs:76-100`):
```javascript
export function findCurationArtifacts(publishDir) {
  const violations = [];
  if (!existsSync(publishDir)) return violations;
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      violations.push({ path: dir, reason: `could not be listed (${error.code ?? error.message})...` });
      return;
    }
    for (const entry of entries) {
      const entryPath = resolve(dir, entry.name);
      if (entry.isDirectory()) { walk(entryPath); continue; }
      // ... per-file content scan ...
    }
  }
  walk(publishDir);
  return violations;
}
```
This is a `.mjs` module scanning a *build output* directory; `pace-single-source.test.ts` is TypeScript scanning `src/` at test time. Borrow the shape (pure function returning a violations array, `try`/`catch` around `readdirSync` and `readFileSync`, never throw out of the scanner) but do not import `curation-guard.mjs` directly — write the scan inline in the `.test.ts` file, following `curation-seam.test.ts`'s in-file `readSource`/`countOccurrences` idiom instead, since this guard's scope (`src/**/*.ts`, not a build output tree) and its allow-list (one file: `pace-derivation.ts`) are structurally different from the curation guard's marker-string scan.

**RESEARCH.md's named false-positive risk (must not conflate):** `src/widgets/shared/route-utils.ts:183` (`(movingTimeSec / distanceMeters) * 1000`) and `src/analytics/gear-aggregate-logic.ts:138` (`bucket.movingTimeSec / (bucket.distanceM / 1000)`) are metadata/aggregate pace sites outside PACE-01's scope — grep for the exact literal stream-sample expressions, not a broad `movingTime.*distance` shape, or the audit false-positives on these two files.

**Demonstrated-catching requirement (D-18, Criterion 4):** the test must be shown red against a deliberately reintroduced second implementation before being trusted — mirror `curation-guard.test.mjs`'s "plant a violation, assert it's caught" idiom (`scripts/lib/curation-guard.test.mjs:30-71`, not excerpted above but confirmed present) rather than inventing a new demonstrated-failing shape.

---

### `scripts/compute-pace-residual.mjs` (script, archive-sweeping report generator)

**Analog:** `scripts/compute-route-data.mjs` (closest existing archive-sweep-and-write script; role-match only — see "No Analog Found" for the Markdown-output gap).

**Directory-sweep + per-file try/catch pattern** (`scripts/compute-route-data.mjs:1-34`):
```javascript
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACTIVITIES_DIR = join(__dirname, '../data/activities');

function readActivities() {
  const files = readdirSync(ACTIVITIES_DIR).filter(f => f.endsWith('.json'));
  const activities = [];
  for (const file of files) {
    try {
      const content = readFileSync(join(ACTIVITIES_DIR, file), 'utf8');
      activities.push(JSON.parse(content));
    } catch (error) {
      console.warn(`Warning: Failed to read ${file}:`, error.message);
    }
  }
  return activities;
}
```
`compute-pace-residual.mjs` sweeps `data/streams/` the same way (readdirSync + filter `.json` + per-file try/catch), for the 154-activity severe cohort RESEARCH.md's cohort definition selects (`>15% of consecutive samples have Δd === 0` AND `sampleCount >= 50`), importing `classifyGaps`/`derivePaceWithCoverage` from `pace-derivation.ts` (D-19's own text: "imports pace-derivation.ts's classifyGaps + derivePaceSeries").

**`main()` + console-log-summary + write pattern** (`scripts/compute-route-data.mjs:91-114`):
```javascript
function main() {
  console.log('Computing route data from activities...\n');
  ensureOutputDir();
  const activities = readActivities();
  const routes = extractRouteData(activities);
  const { routeListSize, latestRunsSize } = writeRouteFiles(routes);
  console.log(`\n✓ route-list.json: ${routes.length} routes (${formatBytes(routeListSize)})`);
  console.log('\nRoute data computation complete!');
}
main();
```
Same top-level shape (`main()` invoked unconditionally at module scope — no ESM `import.meta.url === process.argv[1]` guard exists in this analog, so match the codebase convention rather than adding one). The output write target differs: this analog `writeFileSync`s JSON; `compute-pace-residual.mjs` must instead render the 13-of-154 table as Markdown text and write to `.planning/phases/26-.../26-RESIDUAL.md` — no existing script does a Markdown write (see below), so this last step has no direct precedent to copy verbatim.

---

### `.planning/phases/26-.../26-RESIDUAL.md` (deliverable)

**Analog:** `.planning/milestones/v2.0-phases/15-best-effort-engine/15-FIXTURE-CANDIDATES.md` (named explicitly by CONTEXT.md D-19).

**Shape to follow** (`15-FIXTURE-CANDIDATES.md:1-41`): a short intro paragraph naming the phase/plan/decision that produced it and the exact archive run it's derived from (`generatedAt`, activity counts), a labelled table, and a "Verification Notes (developer-supplied, <date>)" closing section. For `26-RESIDUAL.md`, the analogous shape is: intro naming D-19/PACE-06 and the measurement mechanism (adaptive window, not fixed-20s), a table of the 13 IDs + percentages + role annotations (flagging `4556693525`'s dual PACE-04/PACE-06 role and `3475742397`'s "tie at zero" discriminator per RESEARCH.md Open Questions #2/#3), and a note on how to regenerate it (`node scripts/compute-pace-residual.mjs`).

---

### `src/dashboard/views/detail-zones.ts` — modify `computePaceDistribution`

**Analog:** itself (the file being changed) — see the "located defect" excerpt under `pace-derivation.ts` above (lines 61-93). Post-change, this function becomes a thin caller: `computePaceDistribution` stops doing raw per-segment `dt / (dd / 1000)` arithmetic and instead consumes the `paceSeries` from `derivePaceWithCoverage`, Δt-weighted per sample index — RESEARCH.md's explicit anti-pattern warning: "Recomputing the histogram from raw per-segment `dt/dd` and only fixing the window in the chart... is exactly today's shipped bug."

---

### `src/dashboard/views/detail-charts-logic.ts` — modify `derivePaceSeries`

**Analog:** itself — see the full excerpt under `pace-derivation.ts` above (lines 88-131). Post-change this becomes a re-export/thin wrapper around `pace-derivation.ts`'s function, and `PACE_SMOOTHING_WINDOW_SEC` (line 61) becomes the floor constant rather than the only value (RESEARCH.md Pattern 2). `interpValueAtTime` (lines 68-86) is reused unchanged — it moves to (or is re-exported from) `pace-derivation.ts` since the window-edge interpolation logic is now shared, not duplicated.

---

### `src/dashboard/views/detail-sections.ts` — D-08 caption, D-09 marker/legend, D-13 caption note

**Analog:** itself — three separate existing patterns in the same file.

**D-08 caption insertion point, `buildBreakdownSection`** (`src/dashboard/views/detail-sections.ts:301-325`):
```typescript
export function buildBreakdownSection(
  buckets: readonly PaceBucket[], zoneTimes: readonly ZoneTime[] | null
): HTMLElement | null {
  if (buckets.length === 0 && zoneTimes === null) return null;
  const section = document.createElement('section');
  section.className = 'card detail-section';
  if (buckets.length > 0) {
    const heading = document.createElement('h2');
    heading.className = 'text-heading';
    heading.textContent = 'Pace Distribution';
    section.appendChild(heading);
    section.appendChild(buildPaceDistributionRows(buckets));   // <-- D-08's caption goes BEFORE this line, right after heading append
  }
  // ...
}
```

**D-09 marker precedent, non-text `aria-label` overriding a cell's announced content, `buildPaceBarCell`** (`src/dashboard/views/detail-sections.ts:74-118`):
```typescript
function buildPaceBarCell(split: Split, activityAvgPaceSecPerKm: number | null): HTMLTableCellElement {
  const cell = document.createElement('td');
  if (activityAvgPaceSecPerKm === null || activityAvgPaceSecPerKm <= 0) {
    cell.textContent = DASH;
    return cell;
  }
  const diffSecPerKm = split.paceSecPerKm - activityAvgPaceSecPerKm;
  const roundedDiff = Math.round(diffSecPerKm);
  const diffSign = roundedDiff > 0 ? '+' : roundedDiff < 0 ? '-' : '';
  cell.setAttribute('aria-label', `${diffSign}${Math.abs(roundedDiff)} sec/km vs. average`);
  // ... builds the visual bar ...
}
```
This IS the D-13 rebase target — `activityAvgPaceSecPerKm` is the parameter to swap to the stream-derived average for a flagged activity only. The `aria-label` construction pattern above is also D-09's precedent for the split's Pace `<td>` gaining its own `aria-label` naming the gap amount.

**D-09/D-13 legend/caption-note precedent, the conditional footnote block** (`src/dashboard/views/detail-sections.ts:405-444`):
```typescript
const tbody = document.createElement('tbody');
let hasFootnoteRow = false;
for (const row of rows) {
  // ... build cells ...
  if (row.distance === '1k' && row.agePercent !== null) {
    hasFootnoteRow = true;
  }
  tbody.appendChild(tr);
}
table.appendChild(tbody);
section.appendChild(table);
if (hasFootnoteRow) {
  const footnote = document.createElement('p');
  footnote.className = 'text-label';
  footnote.textContent = '* Interpolated between 800m and mile factors — no official WMA standard exists for 1k.';
  section.appendChild(footnote);
}
```
D-09's legend `<ul>` and D-13's caption note both follow this exact "accumulate a boolean/list while building rows, conditionally append after the table" shape — `hasFootnoteRow` becomes a `flaggedSplits: Split[]` accumulator, and the single `<p>` becomes a `<ul>` with one `<li>` per flagged split (per UI-SPEC's derived shape).

**Splits table assembly, where the gap-marker glyph is appended to the Pace `<td>`** (`src/dashboard/views/detail-sections.ts:170-176`):
```typescript
row.appendChild(buildKmCell(split));
row.appendChild(buildTextCell(formatPace(split.paceSecPerKm)));   // <-- D-09's " ⚠" glyph appends here
row.appendChild(buildTextCell(formatDurationHms(split.endTimeSec)));
// ...
row.appendChild(buildPaceBarCell(split, activityAvgPaceSecPerKm));  // <-- D-13 rebases this call's 2nd argument
```

---

### `src/dashboard/views/detail.ts` — `buildBreakdownSection` call site, `buildStatCard` extension

**Analog:** itself.

**`buildStatCard`, extensible with a third child (D-11's detail badge)** (`src/dashboard/views/detail.ts:145-157`):
```typescript
function buildStatCard(value: string, label: string, titleAttr?: string): HTMLElement {
  const wrapper = document.createElement('div');
  if (titleAttr) wrapper.title = titleAttr;
  const valueEl = document.createElement('div');
  valueEl.className = 'text-display';
  valueEl.textContent = value;
  const labelEl = document.createElement('div');
  labelEl.className = 'text-label';
  labelEl.textContent = label;
  wrapper.appendChild(valueEl);
  wrapper.appendChild(labelEl);
  return wrapper;
}
// call site:
statGrid.appendChild(buildStatCard(formatPace(paceSecPerKm), 'Pace'));   // line 617
```
D-11's badge is appended as a third child of this wrapper (UI-SPEC's own instruction) — either by extending `buildStatCard`'s signature with an optional badge param, or by capturing the returned element and calling `.appendChild` at the `line 617` call site directly. UI-SPEC pins the CSS note: needs `margin-top: var(--space-xs)` on `.stat-grid > div` for the badge's separation from the label line.

**`buildBreakdownSection` call site** (`src/dashboard/views/detail.ts:689`):
```typescript
const breakdownSection = buildBreakdownSection(buckets, zoneTimes);
```
No change to the call signature itself is required by D-08 (the caption is internal to `buildBreakdownSection`), but `buckets` must now come from the same `derivePaceWithCoverage` result the coverage caption reads (D-16's structural guarantee).

---

### `src/dashboard/views/list.ts` — D-11 badge via `statusBadgeTexts`/`appendStatusBadges`

**Analog:** itself — the existing three-tier badge pipeline.

**Plain badge helper** (`src/dashboard/views/list.ts:142-148`):
```typescript
export function appendBadge(container: HTMLElement, text: string): void {
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = text;
  container.appendChild(badge);
}
```

**Accessible badge with hover title + sr-only `aria-describedby` explanation — D-11's exact shape** (`src/dashboard/views/list.ts:214-233`):
```typescript
export function appendLowConfidenceBadge(container: HTMLElement, idPrefix: string): void {
  const explanation = 'GPS-reconstructed distance; treat this time with caution';
  const descriptionId = lowConfidenceDescriptionId(idPrefix);
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = LOW_CONFIDENCE_BADGE_TEXT;
  badge.title = explanation;
  badge.setAttribute('aria-describedby', descriptionId);
  container.appendChild(badge);
  const description = document.createElement('span');
  description.className = 'sr-only';
  description.id = descriptionId;
  description.textContent = explanation;
  container.appendChild(description);
}
```
D-11's "Pace disputed" badge follows this exact pattern verbatim, swapping the explanation string for the pace-disagreement text UI-SPEC specifies.

**Single-source badge-text pipeline (D-11's "all three surfaces" requirement)** (`src/dashboard/views/list.ts:238-282`):
```typescript
export type RowSurface = 'activity-card' | 'activity-table' | 'overview-prs' | 'overview-activities';

export function rowIdPrefix(surface: RowSurface, rowId: string): string {
  return `${surface}-${rowId}`;
}

export function statusBadgeTexts(row: DashboardIndexRow): string[] {
  const texts: string[] = [];
  if (!row.streams.available) { texts.push(/* ... */); }
  else if (!row.streams.hr) { texts.push('No HR'); }
  if (row.lowConfidence) { texts.push(LOW_CONFIDENCE_BADGE_TEXT); }
  if (row.excludedFromRecords) { texts.push('Excluded from records'); }
  if (row.prCount > 0) { texts.push(`${row.prCount} PR`); }
  return texts;   // <-- D-11 adds: if (row.paceDisagreement) texts.push('Pace disputed');
}

function appendStatusBadges(container: HTMLElement, row: DashboardIndexRow, idPrefix: string): void {
  for (const text of statusBadgeTexts(row)) {
    if (text === LOW_CONFIDENCE_BADGE_TEXT) { appendLowConfidenceBadge(container, idPrefix); }
    else { appendBadge(container, text); }
  }
}
```
Extend `statusBadgeTexts` with the D-14 flag check, and extend `appendStatusBadges`'s dispatch with a `'Pace disputed'` branch calling a new accessible-badge appender (following `appendLowConfidenceBadge`'s exact shape). Because `appendStatusBadges` is the single call site both `renderActivityRow` and `buildTableRow` (desktop) invoke, and `RowSurface` already enumerates all four surfaces including `overview-prs`/`overview-activities`, D-11's "all three surfaces + idPrefix" requirement is satisfied by this one change — no per-surface duplication needed.

---

### `src/dashboard/views/list-logic.ts` — D-12 no-suppression rule

**Analog:** itself — the existing pace sort/filter code, which D-12 requires be left untouched for flagged activities (disclosure, not suppression).

**Sort value** (`src/dashboard/views/list-logic.ts:194-195`):
```typescript
case 'pace':
  return row.paceSecPerKm;
```
**Filter range** (`src/dashboard/views/list-logic.ts:~322-336`):
```typescript
// A row whose `paceSecPerKm` is null is excluded whenever a pace bound is active.
if (row.paceSecPerKm === null) return false;
if (!matchesRange(row.paceSecPerKm, filters.pMinSec, filters.pMaxSec)) return false;
```
D-12's rule is a negative constraint: do NOT add a `row.paceDisagreement` check to either of these two sites. The pattern to copy is precisely the absence of a new gate here — `5059204779` must keep sorting/filtering on its metadata `paceSecPerKm` exactly as today (D-10: nothing is recomputed or substituted), and remain reachable in a pace-sorted view per UI-SPEC's checkpoint row 4.

---

### `src/analytics/compute-dashboard-index.ts` + `dashboard-index.types.ts` — D-14 additive flag

**Analog:** itself — the `gearName` precedent, named directly by CONTEXT.md.

**Additive-field discipline, stated at the top of the types file** (`src/analytics/dashboard-index.types.ts:1-25`):
```typescript
/**
 * Contracts for the published dashboard index manifest (`data/dashboard/index.json`).
 * ...
 * `DASHBOARD_INDEX_SCHEMA_VERSION` stays at `1` for the `gearName` addition
 * below — it is a purely additive field, and `scripts/verify-dashboard-publish.mjs`
 * asserts `schemaVersion === 1`.
 */
export const DASHBOARD_INDEX_SCHEMA_VERSION = 1;
```

**Field declaration + WHY-required-not-optional discipline (WR-06 lesson)** (`src/analytics/dashboard-index.types.ts:71-86`):
```typescript
export interface DashboardIndexRow {
  // ...
  /**
   * Resolved human gear label ... NEVER the raw gear id (17-D32/D33, D-17).
   *
   * REQUIRED, deliberately (WR-06). This interface is the type the *writer*
   * (compute-dashboard-index.ts) builds against as well as the type the
   * runtime re-parse used to be asserted as. Making the key optional to model
   * "re-parsed JSON may lack it" also meant compute-dashboard-index could
   * silently stop emitting the field with no compile error — discarding the
   * exact guarantee ... Use `ParsedDashboardIndexRow` below for the re-parse
   * side instead.
   */
  gearName: string | null;
}

export type ParsedDashboardIndexRow = Partial<DashboardIndexRow> & { id: string };
```
D-14's `paceDisagreement` field should be declared the same way: required (not optional) on `DashboardIndexRow` (so the writer cannot silently stop emitting it), naturally `Partial` on the re-parse side via the existing `ParsedDashboardIndexRow` type alias (no separate change needed there — it already maps every field to optional generically).

**Writer site — where the new field is computed, alongside the existing metadata-pace computation** (`src/analytics/compute-dashboard-index.ts:200-215`):
```typescript
const distanceM = activity.distance;
const movingTimeSec = activity.moving_time;
const paceSecPerKm =
  distanceM > 0 && movingTimeSec > 0 ? round1(movingTimeSec / (distanceM / 1000)) : null;
// D-18 names this exact line as OUT of the single-source pace audit's scope — it is
// PACE-07's subject (metadata-derived), not PACE-01's (stream-derived).
// ...
const row: Omit<DashboardIndexRow, 'gearName'> = {
  id: String(id),
  // ...
  paceSecPerKm,
  // ... D-14's `paceDisagreement` field is computed here too, comparing this
  // `paceSecPerKm` against the stream-derived pace from `pace-derivation.ts`
  // (imported the same way `gear-naming.js` is imported at the top of this file).
};
```

---

### `src/analytics/compute-dashboard-index.test.ts` (extend)

**Analog:** itself — the existing field-leak guard.

**Sorted-key-list assertion pattern** (`src/analytics/compute-dashboard-index.test.ts:12-31`):
```typescript
const EXPECTED_ROW_KEYS = [
  'avgCadenceRpm', 'avgHr', 'distanceM', 'elevationGainM', 'excludedFromRecords',
  'gearName', 'id', 'location', 'lowConfidence', 'maxHr', 'movingTimeSec', 'name',
  'paceSecPerKm', 'prCount', 'sportType', 'startDate', 'startDateLocal', 'streams',
].sort();
```
D-14's field must be added to this array (`'paceDisagreement'`, alphabetically sorted) — this is the exact test that would otherwise silently pass with a field present-but-unlisted or absent-but-expected; it is the single place row-shape drift gets caught.

---

### `src/dashboard/views/detail-sections.test.ts` (NEW file, does not exist)

**Analog:** `src/dashboard/views/detail-zones.test.ts` (fixture/`describe` shape) — since `detail-sections.ts` has no test file today, this new file is written from scratch following the nearest sibling's conventions (import style, `makeStream`-equivalent fixture builder if one is needed for DOM assertions, `describe`/`it` naming that states the exact behavior asserted, per-test comments citing the requirement ID).

---

## Shared Patterns

### Purity / client-safety discipline
**Source:** `src/analytics/trimp.ts:1-21` (header), reused by `src/dashboard/views/detail-charts-logic.ts:1-16` and `src/dashboard/views/detail-zones.ts:1-21`.
**Apply to:** `pace-derivation.ts`, `pace-fixtures.ts` — no `fs`, `fetch`, or DOM import; every function total (never throws) on malformed input, matching `validateStreamSeries`'s contract.

### Δt-integration, never sample-count
**Source:** stated identically in `trimp.ts:9-20`, `detail-charts-logic.ts:13-15`, and `detail-zones.ts:17-20` — a fourth+fifth restatement in `pace-derivation.ts` continues this exact house convention.
**Apply to:** `pace-derivation.ts`'s window/coverage/gap-classification logic; `compute-pace-residual.mjs`'s residual measurement.

### Never-throwing total function contract
**Source:** `src/analytics/best-effort-utils.ts:50-66` (`validateStreamSeries`), `scripts/lib/curation-guard.mjs:76-100` (`findCurationArtifacts` — returns `[]`/violations array, never throws).
**Apply to:** every new pure function in `pace-derivation.ts`, `pace-fixtures.ts`, and the scanner inside `pace-single-source.test.ts`.

### `null`, never `0`, for "insufficient data"
**Source:** `src/dashboard/views/detail-charts-logic.ts:113-125` (`derivePaceSeries` returns `null` for zero elapsed/zero metres, never `0`).
**Apply to:** `pace-derivation.ts`'s pace series and any "no data" states — RESEARCH.md's Security Domain explicitly names `?? 0`/`|| 0` coercion as the exact defect class (Pitfall 9 from PITFALLS.md) to avoid.

### Accessible badge (visible text + title + sr-only aria-describedby)
**Source:** `src/dashboard/views/list.ts:214-233` (`appendLowConfidenceBadge`).
**Apply to:** D-11's `'Pace disputed'` badge on all `RowSurface` values, and D-11's detail-view badge on the Pace stat card (UI-SPEC pins the same accessibility contract there too).

### Conditional footnote/legend appended after a table, driven by a per-row accumulator
**Source:** `src/dashboard/views/detail-sections.ts:405-444` (the 1k age-grade footnote).
**Apply to:** D-09's gap-crossing legend and D-13's rebase caption note, both under `.splits-scroll` in `buildSplitsSection`/`buildBreakdownSection`'s sibling caption area.

### Additive index field, schema version unchanged
**Source:** `src/analytics/dashboard-index.types.ts:1-25, 71-86` (the `gearName` precedent).
**Apply to:** D-14's `paceDisagreement` field on `DashboardIndexRow`, `DASHBOARD_INDEX_SCHEMA_VERSION` stays `1`.

### External-reference / committed-archive fixture provenance discipline
**Source:** `src/analytics/best-effort-fixtures.test.ts:1-21` header, `.planning/milestones/v2.0-phases/15-best-effort-engine/15-FIXTURE-CANDIDATES.md` worksheet shape.
**Apply to:** `pace-fixtures.ts` (D-20) and `26-RESIDUAL.md` (D-19) — both must state their provenance and forbid "fixing" the reference value to make a test pass.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `scripts/compute-pace-residual.mjs`'s Markdown-generation step specifically (not the archive-sweep half, which matches `compute-route-data.mjs`) | script | file-I/O | No existing `scripts/*.mjs` writes a `.md` file — every archive-sweeping script in `scripts/` (`compute-route-data.mjs`, `compute-heatmap-data.mjs`) writes `JSON.stringify(...)` to a `data/` output. The `15-FIXTURE-CANDIDATES.md` precedent (used above for the deliverable's *shape*) was hand-written by a developer, not script-generated. The planner should treat the Markdown-table-formatting logic itself as new code (simple template-string table rows, `id | percent%` per line), not something to find a template for — RESEARCH.md's own script sketch (`Architecture Patterns` diagram) confirms no such precedent was found in its research pass either. |

---

## Metadata

**Analog search scope:** `src/analytics/`, `src/dashboard/views/`, `src/widgets/shared/`, `scripts/`, `scripts/lib/`, `.planning/milestones/v2.0-phases/15-best-effort-engine/`
**Files scanned (read directly, this pass):** `src/analytics/trimp.ts`, `src/analytics/best-effort-fixtures.test.ts`, `src/analytics/best-effort-utils.ts` (partial), `src/analytics/compute-dashboard-index.ts` (partial), `src/analytics/compute-dashboard-index.test.ts` (partial), `src/analytics/dashboard-index.types.ts`, `src/dashboard/views/detail-charts-logic.ts` (full), `src/dashboard/views/detail-zones.ts` (partial), `src/dashboard/views/detail-zones.test.ts` (partial), `src/dashboard/views/detail-sections.ts` (partial), `src/dashboard/views/detail.ts` (partial), `src/dashboard/views/list.ts` (partial), `src/dashboard/views/list-logic.ts` (grep only), `src/dashboard/views/detail-splits.ts` (grep only), `src/dashboard/curation-seam.test.ts` (partial), `scripts/lib/curation-guard.mjs` (partial), `scripts/exclusion-cli.mjs` (partial), `scripts/compute-route-data.mjs` (full), `scripts/compute-heatmap-data.mjs` (partial), `.planning/milestones/v2.0-phases/15-best-effort-engine/15-FIXTURE-CANDIDATES.md` (partial)
**Pattern extraction date:** 2026-09-08
