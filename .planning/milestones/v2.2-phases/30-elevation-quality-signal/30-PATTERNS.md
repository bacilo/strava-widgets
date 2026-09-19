# Phase 30: Elevation Quality Signal - Pattern Map

**Mapped:** 2026-09-18
**Files analyzed:** 12 (2 new script pairs incl. tests; 8 modified; 2 report/doc-correction targets not code)
**Analogs found:** 12 / 12 — every file extends a Phase 27 sibling that already exists in the same file (self-precedent), except the two new scripts, which mirror `compute-pace-quality-calibration.mjs`/`compute-pace-quality-recount.mjs` exactly, and the sha256-digest step, which has no in-repo analog (flagged below).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/analytics/pace-quality.ts` | utility / analytics module | transform (pure signal computation) | itself — `countImpossibleSamples` (per-sample-pair detector), `notComputableSignals`, `hasAnySevereSignal`, `computePaceQualitySignals`, `buildPaceQualityShard` (all in this same file) | exact (self-precedent, same file, same purity contract) |
| `src/analytics/pace-quality.test.ts` | test | transform | itself — existing per-signal describe blocks | exact |
| `src/analytics/pace-fixtures.ts` | utility / fixture library | transform (synthetic + pinned-real) | itself — `makeStream` (already accepts `alt`), `PINNED_FIXTURES` rows, `syntheticImpossibleSpeedStream`-style single-mode synthetic builders | exact |
| `src/analytics/pace-fixtures.test.ts` | test | transform | itself — `assertExpectedProperties`'s exhaustive `switch` | exact |
| `src/analytics/compute-dashboard-index.ts` | service / CI compute step | batch (per-activity loop, additive field read) | itself — the existing `qualityMetadata` assembly + `computePaceQualitySignals`/`buildPaceQualityShard` call site | exact |
| `src/dashboard/data/pace-quality-client.ts` | service / lazy shard client parser | file-I/O (fetch, already wired) | itself — `parseActivityQualitySignals`'s per-sub-signal `?? notComputable` fallback shape | exact |
| `src/dashboard/views/list.ts` | component / badge dispatch | request-response (render) | itself — `qualityBadgeSpecs`'s existing 3rd `if` block (`impossibleSamples`) | exact (additive 4th `if`, NOT the Phase 27 contract-change file — this file's dispatch mechanism is already fixed) |
| `src/dashboard/views/detail.ts` | controller / detail-view mount | request-response (stat-card badge only — fetch already wired) | itself — the Pace stat-card badge (`disagreement !== null` → `appendAccessibleBadge`) | exact |
| `src/dashboard/views/detail-sections.ts` | component / always-on section rows | request-response (render) | itself — `decimationRow`/`gapProfileRow`/`impossibleSamplesRow` triad + `notAvailableRows()` + `qualitySignalsSectionPlan` | exact |
| `scripts/compute-elevation-calibration.mjs` (+`.test.mjs`) | utility / offline archive-sweep report script | batch (read-archive, report, one new digest step) | `scripts/compute-pace-quality-calibration.mjs` (+`.test.mjs`) | exact, except the sha256 digest sub-step (no analog, see below) |
| `scripts/compute-elevation-recount.mjs` (+`.test.mjs`) | utility / offline verifier script | batch (read shipped index, report) | `scripts/compute-pace-quality-recount.mjs` (+`.test.mjs`) | exact |
| `package.json` | config | — | itself — the four existing `compute-pace-quality-*` script lines | exact |

## Pattern Assignments

### `src/analytics/pace-quality.ts` (utility, transform) — EXTENDED

**Analog:** itself — `countImpossibleSamples` (lines 637-693) as the per-sample-pair detector shape for `verticalRateSignal`; `hasAnySevereSignal` (848-856) as the D-06 `Pick<>` guarantee; `notComputableSignals` (332-357) and `computePaceQualitySignals` (877-908) as the assembly shape; `PaceQualityShard`/`buildPaceQualityShard` (927-1098) as the shard-mirror shape.

**Module header / purity contract — already states the exact rule this phase must not violate** (lines 1-21, unchanged, extend the same doc block rather than writing a new one):
```typescript
/**
 * Pure, client-safe module — no `fs`, no `fetch`, no DOM. ...
 * Total (T-26-01): every exported function accepts any array-shaped or
 * loosely-typed input, including malformed/adversarial data, and returns a
 * not-computable or zeroed result rather than throwing.
 * No `?? 0` / `|| 0` coercion (T-26-02): "insufficient data" is always an
 * explicit not-computable/null result, never a plausible-looking computed
 * zero.
 */
import { adaptiveWindowSec, classifyGaps, quantile } from './pace-derivation.js';
import { WORLD_RECORD_100M_SPEED_MPS, validateStreamSeries } from './best-effort-utils.js';
import type { GapInterval } from './pace-derivation.js';
import type { CanonicalStream } from '../streams/stream.types.js';
```
Add a haversine import/local copy here (from `derive-stream.ts`, see Shared Patterns) and a `startLatlng: unknown` / `endLatlng: unknown` pair on `ActivityQualityMetadata` (line 173-178) — same "loosely-typed metadata slice narrowed inside the consuming function" shape that field already documents for `deviceName`/`sourceProvider`.

**Per-sample-pair detector shape to copy for `verticalRateSignal`** (`countImpossibleSamples`, lines 637-693 — copy the guard, the linear scan, the capped-samples list, and the "count is always full, never the capped list length" discipline):
```typescript
export function countImpossibleSamples(
  t: readonly number[],
  d: readonly number[],
  options?: { floorMps?: number }
): { count: number; maxImpliedSpeedMps: number | null; countInsideZeroAdvanceRun: number;
    samples: { index: number; impliedSpeedMps: number; dtSec: number; ddM: number }[] } {
  if (!validateStreamSeries(t as number[], d as number[]).ok) {
    return { count: 0, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: 0, samples: [] };
  }
  const floor = options?.floorMps ?? WORLD_RECORD_100M_SPEED_MPS;
  const n = Math.min(t.length, d.length);
  let count = 0;
  let maxImpliedSpeedMps: number | null = null;
  const samples: { index: number; impliedSpeedMps: number; dtSec: number; ddM: number }[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dtSec = t[i + 1] - t[i];
    if (!(dtSec > 0)) continue;           // D-08: skip Δt ≤ 0 pairs
    const ddM = d[i + 1] - d[i];
    const impliedSpeedMps = ddM / dtSec;
    if (!(impliedSpeedMps > floor)) continue;
    count++;
    if (maxImpliedSpeedMps === null || impliedSpeedMps > maxImpliedSpeedMps) maxImpliedSpeedMps = impliedSpeedMps;
    if (samples.length < 100) samples.push({ index: i + 1, impliedSpeedMps, dtSec, ddM });
  }
  return { count, maxImpliedSpeedMps, countInsideZeroAdvanceRun: 0 /* n/a for altitude */, samples };
}
```
`verticalRateSignal(t, alt)` is the SAME shape with `d` replaced by `alt` and `impliedSpeedMps` replaced by `|Δalt|/Δt` (D-08's own text: "exactly this measurement"). Guard on `alt` presence (undefined/short array → `not-computable`, never `'none'`) the same way `validateStreamSeries` guards `t`/`d` here. Report `worstRateMps` and `violatingSamples` (D-07's shape) — `worstRateMps` is this function's `maxImpliedSpeedMps` renamed, `violatingSamples` is `count`.

**Sub-ground detector — simplest of the three, no existing per-sample analog needed**: `subGroundSignal(alt)` is `Math.min(...alt) < -50` — a one-line total function following the module's own `resolveCoverage`-adjacent min/max helper style; guard empty/undefined `alt` the same way (`not-computable`, never a fabricated `0`).

**Closure-drift detector — the loop-gate needs the haversine import (see Shared Patterns) plus the D-02/Pitfall-4 `[]`-vs-absent guard** (new, no direct in-file analog, but follows the same total/never-throw shape every other signal function here uses):
```typescript
// D-01/D-02/D-03, structure mirrors this file's own total-function contract:
function closureDriftSignal(alt, startLatlng, endLatlng, loopRadiusM = 100): ClosureDriftSignal {
  const start = normalizeLatLng(startLatlng); // Array.isArray && length === 2, per Pitfall 4
  const end = normalizeLatLng(endLatlng);
  if (start === null || end === null) {
    return { state: 'not-computable', deltaM: null, startEndDistM: null };
  }
  const distM = haversineMeters(start[0], start[1], end[0], end[1]);
  if (distM > loopRadiusM) {
    return { state: 'clear', deltaM: null, startEndDistM: distM }; // excluded-by-design, not not-computable (D-04)
  }
  const deltaM = alt[alt.length - 1] - alt[0];
  return {
    state: Math.abs(deltaM) > 60 ? 'flagged' : 'clear',
    deltaM,
    startEndDistM: distM,
  };
}
```
D-02 requires this THREE-way outcome (`not-computable` / excluded-not-a-loop / clear-or-flagged) to be distinguishable in words on the detail line — do not collapse "not a loop" and "clear" into one string internally; keep `startEndDistM` on both so the detail line and the report's exclusion list can quote the measured distance.

**The D-06 structural guarantee to leave untouched** (`hasAnySevereSignal`, lines 848-856):
```typescript
export function hasAnySevereSignal(
  signals: Pick<ActivityQualitySignals, 'decimation' | 'gapProfile' | 'impossibleSamples'>
): boolean {
  return (
    signals.decimation.tier === 'severe' ||
    signals.gapProfile.tier === 'severe' ||
    signals.impossibleSamples.tier === 'severe'
  );
}
```
Do not touch this function's `Pick<>` — adding `elevation: ElevationSignal` to `ActivityQualitySignals` costs it nothing by construction. Add a runtime or type-level test asserting the `Pick<>` key set is exactly these three (Anti-Pattern in RESEARCH.md's Pattern 1).

**`notComputableSignals`/`computePaceQualitySignals`/`buildPaceQualityShard` — extend the return object literals with the 7th key, same shape, same call sites** (lines 332-357, 877-908, 1013-1098): elevation follows the SAME "assembled from stream + metadata, never partially filled" rule these three functions already state in their own doc comments — add `elevation: ElevationSignal` to every returned object literal in all three functions (the not-computable branches get a whole-signal `not-computable` elevation value per D-07's "whole-signal not-computable applies only to the stream-less/unusable-stream cohort" rule; the drift-only not-computable state is a property of `closureDriftSignal`, not of these wrapper functions).

**`ElevationSignal.tier` must be its OWN 3-member type, not a reuse of `QualityTier`** (RESEARCH.md Pitfall 5, direct consequence of D-07's "no minor band"):
```typescript
// NOT: tier: QualityTier  (a 4-member union that lets 'minor' slip in)
export type ElevationTier = 'severe' | 'none' | 'not-computable';
```

---

### `src/analytics/pace-fixtures.ts` (utility, fixture library) — EXTENDED

**Analog:** itself — `makeStream` (lines 62-83, already accepts `alt`), `PINNED_FIXTURES` rows (`worked-example` at 413-419 is the template), `syntheticImpossibleSpeedStream`-style dedicated single-mode synthetic builder (line 270 area).

**`makeStream` already accepts `alt` — no new builder API needed** (lines 45-83):
```typescript
export interface MakeStreamOptions {
  id?: string; source?: StreamSource; distanceSource?: DistanceSource;
  t: number[]; d: number[]; hr?: number[]; cadence?: number[]; alt?: number[];
}
export function makeStream(opts: MakeStreamOptions): CanonicalStream {
  // ...
  channels: { time: true, distance: true, hr: hr !== undefined, cadence: cadence !== undefined, elevation: alt !== undefined },
  ...(alt !== undefined ? { alt } : {}),
}
```
The three synthetic per-mode fixtures (`syntheticSubGroundStream`, `syntheticClosureDriftStream`, `syntheticVerticalRateSpikeStream`) are each: build a clean baseline via `steadySegment`-style helpers (already private in this file, reuse them), then supply an `alt` array mutated to fire exactly one mode — one call to `makeStream({ ..., alt })` each, matching `syntheticImpossibleSpeedStream`'s "clean stream, one injected anomaly" shape exactly.

**Pinned-fixture row template to copy verbatim, changing only values** (`worked-example`, lines 413-419):
```typescript
{
  name: 'worked-example',
  activityId: '4556693525',
  deviceFamily: 'suunto-9',
  streamSource: 'fit',
  why: "the pinned PACE-04 exemplar; span 3394s vs metadata elapsed_time 3393, distance 10130m, 28.7% zero-advance",
  expected: { spanSec: 3394, elapsedTimeSec: 3393, distanceM: 10130, zeroAdvanceFraction: 0.287 },
},
```
Add two new rows for `4745489664` (drift, `expected: { driftDeltaM: -197.6, startEndDistM: 0 }`) and `3149636661` (rate, `expected: { worstRateMps: 80.4, startEndDistM: 0, driftDeltaM: -172.6 }` — RESEARCH.md D-14 confirms this activity ALSO drifts, so its `expected` should carry both properties, not just the rate one, so a future reader cannot mistake it for an isolation fixture). Also extend `worked-example`'s own `expected` with `minAltM: -282.0` (its own sub-ground property, per D-14's table) — same row, no new fixture needed since it is already pinned.

---

### `src/analytics/pace-fixtures.test.ts` (test) — EXTENDED

**Analog:** itself — `assertExpectedProperties`'s exhaustive `switch` (lines 197-256).

**The exact switch to extend — confirmed throw-on-unhandled-key discipline** (line 252):
```typescript
function assertExpectedProperties(fixture: PinnedFixture, stream: CanonicalStream): void {
  for (const key of Object.keys(fixture.expected)) {
    switch (key) {
      case 'sampleCount': /* ... */ break;
      case 'spanSec': /* ... */ break;
      // ... existing cases ...
      default:
        throw new Error(`assertExpectedProperties: unhandled expected key "${key}" on fixture "${fixture.name}"`);
    }
  }
}
```
Add `case 'minAltM'`, `case 'driftDeltaM'`, `case 'startEndDistM'`, `case 'worstRateMps'` calling the new detector functions against the loaded stream/activity metadata (`loadPinnedStream(fixture.name)`, `loadPinnedActivity(fixture.name)` for the latlng pair). **Sequencing hazard (Pitfall 2, confirmed real by this file's own `throw`):** add these switch cases in the SAME task/commit as the new `PINNED_FIXTURES` rows — adding the fixture rows first produces an immediate red test with the exact "unhandled expected key" message.

---

### `src/analytics/compute-dashboard-index.ts` (service, batch) — EXTENDED, additive only

**Analog:** itself — the existing `qualityMetadata` assembly and the two-call pattern (`computePaceQualitySignals` + `buildPaceQualityShard`) immediately following it (lines 292-306).

**Exact block to extend — add two keys, nothing else changes**:
```typescript
const qualityMetadata: ActivityQualityMetadata = {
  deviceName: activity.device_name,
  sourceProvider: activity.source_provider,
  elapsedTimeSec: activity.elapsed_time,
  movingTimeSec: activity.moving_time,
  // NEW (D-01, zero new file reads — StravaActivity already types these):
  startLatlng: activity.start_latlng,
  endLatlng: activity.end_latlng,
};
const quality: ActivityQualitySignals = computePaceQualitySignals(streamForQuality, qualityMetadata);
const shard: PaceQualityShard = buildPaceQualityShard(String(id), streamForQuality, qualityMetadata);
```
`activity.start_latlng`/`activity.end_latlng` are already typed `number[] | undefined` on `StravaActivity` (`src/types/strava.types.ts:33-34`, confirmed) — no new import, no new file read, no new try/catch branch. The existing `streamForQuality` unconditional-read block (lines 264-290, unchanged) already supplies the `alt` array the three new detectors need.

---

### `src/dashboard/data/pace-quality-client.ts` (service, parser) — EXTENDED, additive

**Analog:** itself — `parseActivityQualitySignals`'s per-sub-signal `?? notComputable-fallback` shape (lines 137-167) and `parseDecimationSignal`'s total-parse shape (lines 68-77).

**Exact fallback-shape to copy for the 7th key**:
```typescript
function parseActivityQualitySignals(raw: unknown): ActivityQualitySignals | null {
  if (!isPlainObject(raw)) return null;
  return {
    decimation: parseDecimationSignal(raw.decimation) ?? { tier: 'not-computable', zeroAdvanceFraction: null, sampleCount: null },
    // ... four more existing keys, unchanged ...
    elevation: parseElevationSignal(raw.elevation) ?? {
      tier: 'not-computable', subGround: { flagged: false, minAltM: null },
      closureDrift: { state: 'not-computable', deltaM: null, startEndDistM: null },
      verticalRate: { flagged: false, worstRateMps: null, violatingSamples: null },
    },
    anySevere: typeof raw.anySevere === 'boolean' ? raw.anySevere : false,
    notComputableReason: typeof raw.notComputableReason === 'string' ? raw.notComputableReason : null,
  };
}
```
Write `parseElevationSignal` following `parseDecimationSignal`'s exact total/never-throw shape (`isPlainObject` guard, `parseTier`-style validation for the new 3-member tier — do NOT reuse `VALID_TIERS`/`parseTier` verbatim since elevation's tier union excludes `'minor'`; add a sibling `VALID_ELEVATION_TIERS` set). No client-load-path change is needed — `createPaceQualityClient` and its `load`/`reset` functions (lines 245-309) are untouched; only the parse function's field set grows, exactly as D-05/RESEARCH.md's Pattern 4 states.

---

### `src/dashboard/views/list.ts` (component, badge dispatch) — EXTENDED, additive (NOT a contract change)

**Analog:** itself — `qualityBadgeSpecs`'s existing `impossibleSamples` `if` block (lines 450-460), which is the newest of the three and the best template since it, like elevation, names a count + a physical-implausibility framing.

**Exact block shape to copy as a 4th `if`** (lines 417-463 is the whole function; copy this block's shape):
```typescript
if (impossibleSamples.tier === 'severe' && impossibleSamples.count !== null) {
  const n = impossibleSamples.count;
  const noun = n === 1 ? 'sample' : 'samples';
  specs.push({
    signal: 'impossibleSamples',
    visibleText: `${n} ${noun} faster than the 100 m world record`,
    explanation: 'these samples imply a speed no human sustains, so any effort drawn across them is not a measured time',
    descriptionIdSuffix: 'impossible-samples',
  });
}
```
Add, after this block: `if (elevation.tier === 'severe') { ... }` naming the fired mode(s) with the worst value per D-10 (e.g. `altitude −282 m below ground`, or when two+ modes fire, `altitude drift 198 m · spike 80 m/s`). **This file's dispatch mechanism does NOT need Phase 27's "contract change" restructuring** — `qualityBadgeSpecs` already reads structured evidence fields (not a fixed sentinel string) since the `impossibleSamples` block was added; `appendQualityBadges` (line 554) already iterates `qualityBadgeSpecs(row)` generically and calls `appendAccessibleBadge` with each spec's own `visibleText`/`explanation` — no per-signal branch exists there to extend. Also extend `QualityBadgeSpec['signal']`'s union (line 357) with `'elevation'`, and `ParsedDashboardIndexRow`'s `quality.elevation` destructure (line 421) alongside the three existing keys.

**Reusable building block — do NOT rebuild** (`appendAccessibleBadge`, referenced not re-quoted since Phase 27's own PATTERNS.md already excerpted it verbatim at `list.ts:227-245`): used unchanged by `appendQualityBadges`; no change needed to either function beyond `qualityBadgeSpecs` growing a 4th spec source.

---

### `src/dashboard/views/detail.ts` (controller) — EXTENDED, additive, NO new fetch

**Analog:** itself — the Pace stat-card badge (lines 671-689) and the ALREADY-WIRED `paceQualityClient.load(detail.id)` member of `mountBestEffortsAndBadges`'s `Promise.all` (line 578, confirmed present from Phase 27 — this phase adds NO new `Promise.all` member).

**Exact stat-card badge shape to copy for Elevation Gain**:
```typescript
// EXISTING (lines 673-689), the precedent:
const paceStatCard = buildStatCard(formatPace(paceSecPerKm), 'Pace');
if (disagreement !== null) {
  appendAccessibleBadge(
    paceStatCard,
    `Pace disputed — stream-derived ${formatPace(disagreement.streamPaceSecPerKm)}`,
    paceDisputedExplanation(disagreement),
    paceDisputedDescriptionId('detail-pace-stat')
  );
}
statGrid.appendChild(paceStatCard);

// NEW, same shape, immediately around the existing inline Elevation Gain
// stat card (currently line 690-692, an inline appendChild with no
// intermediate variable — pull it into a variable first):
const elevationStatCard = buildStatCard(
  formatOrDash(numOrNull(activity.total_elevation_gain), (v) => `${Math.round(v)} m`),
  'Elevation Gain'
);
const quality = indexClient.getRow(detail.id)?.quality ?? null; // same optional-chain shape line 669 uses
if (quality?.elevation.tier === 'severe') {
  appendAccessibleBadge(elevationStatCard, /* visible text naming fired mode(s) + value */, /* explanation */, /* descriptionId */);
}
statGrid.appendChild(elevationStatCard);
```
No change to `mountBestEffortsAndBadges`'s `Promise.all` (line 574-579) or its stale-navigation guard (line 581-583) — the shard fetch this section's evidence would need is already flowing through `paceQualityShard`, which the function already destructures. No new injected client, no new constructor option.

---

### `src/dashboard/views/detail-sections.ts` (component) — EXTENDED, additive (3 new rows, not 1)

**Analog:** itself — the `decimationRow`/`gapProfileRow`/`impossibleSamplesRow` triad (lines 921-1048), `notAvailableRows()` (1084-1122), `qualitySignalsSectionPlan` (1139-1158). `buildQualitySignalsSection`'s render loop (1190-1226) needs ZERO change — it iterates `plan.rows` generically.

**Row-builder shape to copy exactly, three times** (`decimationRow`, lines 921-955, is the cleanest template — not-computable branch first, then healthy/tiered `valueText`, then a `shard`-derived `evidenceText`):
```typescript
function decimationRow(signal, notComputableReason, shard): QualitySignalRow {
  const explanation = tieringExplanation('decimation');
  if (notComputableReason !== null) {
    return { label: 'Decimation', valueText: `Not computable — ${notComputableReason}`, tier: 'not-computable', explanation, evidenceText: null };
  }
  let valueText: string;
  if (signal.tier === 'none') valueText = 'No decimation detected';
  else if (signal.zeroAdvanceFraction !== null) valueText = `${Math.round(signal.zeroAdvanceFraction * 100)}% ...`;
  else valueText = 'Decimation data unavailable';
  // evidenceText drawn from shard, null when shard/field unavailable
  return { label: 'Decimation', valueText, tier: signal.tier, explanation, evidenceText };
}
```
Write `subGroundRow`, `closureDriftRow`, `verticalRateRow` in this exact shape (D-11's three always-on lines: `lowest altitude 12 m`, `start/end altitude differ by 4 m (loop, 38 m apart)` / `start/end position unknown — drift not checked`, `max vertical rate 1.2 m/s`). `closureDriftRow` needs its own THREE-way `valueText` branch (flagged / clear-in-a-loop / not-a-loop-excluded / not-computable-no-position) mirroring D-02's requirement that the state read in words, not just a boolean.

**`notAvailableRows()` — extend the SAME five-element array to eight, same literal shape** (lines 1084-1121, `label`/`QUALITY_DATA_NOT_AVAILABLE`/`tier: 'not-computable'`/matching `explanation`/`evidenceText: null` per row) — add three more entries for the elevation modes, in the same D-11-specified order.

**`qualitySignalsSectionPlan` — extend the returned array in D-11's listed order** (lines 1139-1158):
```typescript
return {
  rows: [
    decimationRow(quality.decimation, reason, shard),
    gapProfileRow(quality.gapProfile, reason, shard),
    impossibleSamplesRow(quality.impossibleSamples, reason, shard),
    subGroundRow(quality.elevation.subGround, quality.elevation.tier === 'not-computable' ? reason : null, shard),
    closureDriftRow(quality.elevation.closureDrift, shard),
    verticalRateRow(quality.elevation.verticalRate, quality.elevation.tier === 'not-computable' ? reason : null, shard),
    deviceEraRow(quality.deviceEra),
    elapsedVsMovingRow(quality.elapsedVsMoving),
  ],
};
```
Placement (before `deviceEraRow`/after the three tiering rows) is Claude's Discretion within D-11's own ordering; `buildQualitySignalsSection`'s section becomes 8 rows total, needing no render-loop change.

## Shared Patterns

### Total, never-throwing pure functions over stream/metadata inputs
**Source:** `src/analytics/pace-quality.ts` module header (T-26-01/T-26-02) + `countImpossibleSamples` (lines 637-693) as the per-sample-pair shape.
**Apply to:** all three new detector functions (`subGroundSignal`, `closureDriftSignal`, `verticalRateSignal`) — malformed/short/absent arrays return `not-computable`/zeroed results, never throw, never `?? 0` coerce.

### The D-06 structural `Pick<>` guarantee — extend nothing here
**Source:** `src/analytics/pace-quality.ts:848-856` (`hasAnySevereSignal`).
**Apply to:** every new file that touches `ActivityQualitySignals` — `elevation` is a 7th key that is simply never named in this `Pick<>`; add a test asserting the key list stays exactly `['decimation', 'gapProfile', 'impossibleSamples']`.

### Accessible badge (visible text + explanation), unchanged
**Source:** `src/dashboard/views/list.ts:227-245` (`appendAccessibleBadge`).
**Apply to:** the new list badge (`list.ts`'s 4th `qualityBadgeSpecs` block, via `appendQualityBadges`'s existing loop), the Elevation Gain stat-card badge (`detail.ts`), and all three new detail-section rows (`detail-sections.ts`'s `buildQualitySignalsSection` render loop, already generic).

### Haversine distance — copy the exact formula, do not reimplement
**Source:** `src/streams/derive-stream.ts:30,42-50` (`EARTH_RADIUS_M = 6371000`, private `haversineMeters`); guard precedent for the `[]`-vs-absent case at `src/geo/geocoder.ts:139` (`!activity.start_latlng || activity.start_latlng.length !== 2`).
**Apply to:** `closureDriftSignal`'s loop-gate distance computation in `pace-quality.ts` — export or copy this exact function/constant so the loop-radius boundary this phase's research measured is reproduced exactly, not approximated by a second implementation with a different Earth-radius constant.

### Archive-sweep script skeleton (per-file try/catch, pure exported functions, guarded `main()`)
**Source:** `scripts/compute-pace-quality-calibration.mjs` (full file, 947 lines — header 1-59, pure helpers 61-110+, `main()`/self-execution guard at the bottom) and `scripts/compute-pace-quality-recount.mjs` (full file, 283 lines, quoted in full above).
**Apply to:** `scripts/compute-elevation-calibration.mjs` (imports the classifier directly, writes ONLY `30-CALIBRATION.md`, adds the D-16 sha256-digest-before/after step) and `scripts/compute-elevation-recount.mjs` (reads ONLY `data/dashboard/index.json`, zero import of the classifier, own `TIERING_SIGNAL_KEYS`-equivalent that must NOT include `elevation`).

### `package.json` script-pair addition
**Source:** lines 23, 26 (`"compute-pace-quality-calibration": "npm run build && node scripts/compute-pace-quality-calibration.mjs"`, `"compute-pace-quality-recount": "node scripts/compute-pace-quality-recount.mjs"`).
**Apply to:** two new lines, `"compute-elevation-calibration": "npm run build && node scripts/compute-elevation-calibration.mjs"` and `"compute-elevation-recount": "node scripts/compute-elevation-recount.mjs"` (the calibration variant needs `npm run build` first because it imports the compiled `dist/analytics/pace-quality.js`, exactly like its Phase 27 sibling; the recount variant does not, for the same D-03 reason).

### Guard-test shape: importing a script must not run its sweep/write its report
**Source:** `scripts/compute-pace-quality-calibration.test.mjs` lines 1-41 (dynamic `import()` inside `beforeAll`, mtime-before/after comparison) and `scripts/compute-pace-quality-recount.test.mjs` line 189 ("importing this module triggers no read of data/dashboard/index.json").
**Apply to:** `compute-elevation-calibration.test.mjs` / `compute-elevation-recount.test.mjs` — same dynamic-import + mtime (or read-triggered) assertion, PLUS a new assertion this pair specifically needs per D-16: a source-scan or explicit-call test proving neither script's write target (nor the new `pace-quality.ts` module) ever calls `fs.writeFileSync`/`writeFile` with a path under `data/` (the T-27-09 pattern extended, since T-27-09 itself only proved the `.planning/` report path, not a `data/` exclusion).

## No Analog Found

| File/Concept | Role | Data Flow | Reason |
|---|---|---|---|
| D-16's sha256 stream-digest step (`data/streams/` before/after) | pure function (script-local) | integrity check | No existing script in this repo computes a content digest of anything — `compute-pace-quality-calibration.mjs` and every sibling script read and report, never hash. Use Node's built-in `crypto.createHash('sha256')` streamed or buffered per-file, reduced into one digest — no new dependency (confirmed: RESEARCH.md's Package Legitimacy Audit already scoped this as the one place this phase touches cryptographic primitives, ASVS V6). This is genuinely new ~15-20 line code, not a copy. |
| `closureDriftSignal`'s three-way not-computable/excluded/flagged-or-clear state | pure function | transform | No existing signal function in `pace-quality.ts` has more than the two-way `not-computable`-or-real-result shape (`decimationSignal`, `gapProfileSignal`, `countImpossibleSamples` all guard once and then always produce a real number). D-02's "excluded-by-design (point-to-point) is NOT the same as not-computable (no position)" distinction is new logic — write it as its own small function rather than stretching an existing guard shape to fit a third outcome. |
| The requirement-text correction task (D-04: ROADMAP/REQUIREMENTS "34"→loop-gated figure) | doc edit | — | Not a code file with a pattern analog; sequencing note only — RESEARCH.md's Wave 0 Gaps lists it as its own task, sequenced before the checkpoint plan drafts its rows (D-04, discretion item 5). |

## Metadata

**Analog search scope:** `src/analytics/`, `src/dashboard/data/`, `src/dashboard/views/`, `scripts/`, `src/streams/derive-stream.ts`, `src/geo/geocoder.ts`, `src/types/strava.types.ts`, `package.json` — every file named in RESEARCH.md's Wave 0 Gaps plus the two haversine/latlng-guard precedents its Don't-Hand-Roll section names.
**Files scanned (read in full or by targeted non-overlapping section):** `pace-quality.ts` (1,098 lines — sections 1-210, 320-420, 580-700, 840-940, 1000-1098), `pace-fixtures.ts` (482 lines — sections 1-130, 380-482), `pace-fixtures.test.ts` (targeted grep + line 197-256), `compute-dashboard-index.ts` (targeted, 255-330), `pace-quality-client.ts` (full, 309 lines), `list.ts` (targeted, 330-560), `detail.ts` (targeted, 565-715), `detail-sections.ts` (targeted, 855-1227), `compute-pace-quality-recount.mjs` (full, 283 lines), `compute-pace-quality-calibration.mjs` (targeted, 1-110), `compute-pace-quality-calibration.test.mjs` / `compute-pace-quality-recount.test.mjs` (targeted headers), `derive-stream.ts` (targeted, 30-55), `geocoder.ts` (targeted, 125-150), `strava.types.ts` (grep), `package.json` (full, 69 lines) — 14 files.
**Pattern extraction date:** 2026-09-18
