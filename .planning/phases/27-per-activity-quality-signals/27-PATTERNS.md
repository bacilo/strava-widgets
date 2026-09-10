# Phase 27: Per-Activity Quality Signals - Pattern Map

**Mapped:** 2026-09-10
**Files analyzed:** 11 (3 new pairs incl. tests, 8 modified)
**Analogs found:** 11 / 11 (all have a strong or exact analog; one — the badge dispatch restructure — is flagged as a contract change, not a copy)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/analytics/pace-quality.ts` (+`.test.ts`) | utility / analytics module | transform (pure signal computation) | `src/analytics/pace-derivation.ts` | exact (sibling module, same purity contract, same file) |
| `src/dashboard/data/pace-quality-client.ts` (+`.test.ts`) | service / lazy shard client | file-I/O (fetch) | `src/dashboard/data/best-efforts-client.ts` | exact |
| `scripts/compute-pace-quality-recount.mjs` | utility / offline verifier script | batch (read-archive, report) | `scripts/compute-pace-residual.mjs` | exact |
| `src/analytics/dashboard-index.types.ts` | model / type contract | CRUD (additive schema) | itself (prior `gearName`/`paceDisagreement` additions in the same file) | exact (self-precedent) |
| `src/analytics/compute-dashboard-index.ts` | service / CI compute step | batch (per-activity loop, write) | itself (existing `paceDisagreement`/gear loop) + `compute-best-efforts.ts` (shard-write loop) | exact |
| `src/dashboard/views/list.ts` | component / badge renderer | request-response (render) | itself (`appendStatusBadges`/`statusBadgeTexts`) | **contract change**, not additive — see below |
| `src/dashboard/views/list-logic.ts` | store / URL-state + filter brain | transform (pure filter/URL round-trip) | itself (`FilterState`/`parseListQuery`/`filterRows`) | exact (one new boolean field, same shape as existing fields) |
| `src/dashboard/views/detail.ts` | controller / detail-view mount | request-response (one mount, one fetch batch) | itself (`mountBestEffortsAndBadges`'s `Promise.all`) | exact |
| `src/dashboard/views/detail-sections.ts` | component / section builder | request-response (render) | itself (`buildBreakdownSection`/`breakdownSectionPlan`) | exact (same plan/render split) |
| `scripts/verify-dashboard-publish.mjs` | test / publish-time spot-check | request-response (HTTP smoke check) | itself (`gearName` check block) | exact |

## Pattern Assignments

### `src/analytics/pace-quality.ts` (utility, transform) — NEW

**Analog:** `src/analytics/pace-derivation.ts` (read in full for header/exports; `src/analytics/best-effort-utils.ts` for the impossible-sample precedent)

**Module header / purity contract to copy** (`pace-derivation.ts:1-29`):
```typescript
/**
 * ... Pure, client-safe module — no `fs`, no `fetch`, no DOM. It is imported by
 * both the dashboard render path (browser) and the CI compute chain (Node) ...
 * Every exported function is total: any array-shaped input, including a
 * malformed or adversarial stream, returns a zeroed result rather than
 * throwing (T-26-01). No `?? 0` / `|| 0` coercion anywhere below —
 * "insufficient data" is always a zeroed/neutral result, never a
 * plausible-looking computed zero (T-26-02).
 */
import { validateStreamSeries } from './best-effort-utils.js';
import type { CanonicalStream } from '../streams/stream.types.js';
```
Copy this contract verbatim into `pace-quality.ts`'s own header — D-06 requires the same "explicit not-computable state, never a fabricated zero" rule for the 24 stream-less activities, and this is the file that already states the rule this phase must not violate. Reuse `classifyGaps`, `quantile`, `advanceIntervals` from this file directly (`import { classifyGaps, quantile, advanceIntervals } from './pace-derivation.js'`) rather than reimplementing.

**Constants/exports precedent — a named, justified constant per mechanism** (`pace-derivation.ts:34-50`):
```typescript
export const RECORDING_GAP_ABS_THRESHOLD_SEC = 10;
export const PAUSE_GAP_P90_MULTIPLIER = 5;
```
Every threshold in `pace-derivation.ts` is `export const`, uppercase, with a doc comment citing its measured justification. D-04's severe-decimation threshold and the two open thresholds (impossible-sample count, gap-profile percentage) should follow this exact shape — named constants with a comment citing the measured archive rate, not inline magic numbers.

**Totality/validation precedent for the new per-sample function** (`best-effort-utils.ts:50-75`, `:140-163`):
```typescript
export function validateStreamSeries(t: number[], d: number[]): PlausibilityResult {
  if (t.length !== d.length) return { ok: false, reason: `t and d length mismatch...` };
  const n = t.length;
  if (n < 2) return { ok: false, reason: `series has ${n} sample(s), at least 2 are required` };
  // finiteness + non-decreasing checks ...
}

export function isPlausible(
  impliedSpeedMps: number,
  activityMaxSpeedMps: number | undefined,
  worldRecordSpeedMps: number
): PlausibilityResult { /* effort-level check — does NOT transfer to per-sample, see note below */ }
```
**Note (research-flagged, confirmed):** `isPlausible` operates on one effort's implied speed against `activityMaxSpeedMps`, a different granularity/denominator than the new per-sample `countImpossibleSamples` function this phase needs. Do not call `isPlausible` from the new signal — write a new small function following the same `(t, d) -> total, never-throwing result` shape, and reuse `WORLD_RECORD_SPEED_MPS` (`best-effort-utils.ts:34-43`) only if a `100m` entry is added to it (the table's shortest entry today is `400m` at 9.296 m/s, not the 10.44 m/s value this phase's own research measured against and used informally elsewhere in the repo).

**Device-family resolver — net-new, no existing code analog, exact shape proposed by research** (confirmed against live archive counts):
```typescript
function resolveDeviceFamily(deviceName: string | null | undefined, sourceProvider: string | undefined): DeviceFamily {
  if (typeof deviceName === 'string' && deviceName.trim().length > 0) {
    return KNOWN_FAMILIES[deviceName] ?? { kind: 'unrecognized-device', raw: deviceName };
  }
  if (sourceProvider === 'intervals') return { kind: 'intervals-icu' };
  return { kind: 'no-device-name' };
}
```
Must consult BOTH `device_name` and `source_provider` — see Shared Patterns/Naming Conflict below for the `unknown-device` vs `unrecognized-device` fixture-naming mismatch this touches.

**Fixture reuse (test-side)** — `src/analytics/pace-fixtures.ts:315-470`: `PINNED_FIXTURES`, `PACE_FIXTURE_NAMES`, and the synthetic builders (`syntheticImpossibleSpeedStream`, `syntheticDecimationAliasedStream`, `syntheticRecordingGapStream`, `syntheticMultiHourPauseStream`) are the fixture library `pace-quality.test.ts` should import, not rebuild.

---

### `src/dashboard/data/pace-quality-client.ts` (service, file-I/O) — NEW

**Analog:** `src/dashboard/data/best-efforts-client.ts` (read in full — copy this file's shape, changing only the URL and parse-function field set)

**Full fetch-once/memoize/degrade shape to mirror** (`best-efforts-client.ts:104-155`):
```typescript
function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
}

export function createBestEffortsClient(options: BestEffortsClientOptions = {}): BestEffortsClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? 'data/');
  const inFlight = new Map<string, Promise<ActivityBestEfforts | null>>();

  async function fetchActivityBestEfforts(activityId: string): Promise<ActivityBestEfforts | null> {
    try {
      const doFetch = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
      const url = `${baseUrl}stats/best-efforts/${activityId}.json`;
      const response = await doFetch(url);
      if (!response.ok) throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      const body = await response.json();
      return parseActivityBestEfforts(body);
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function load(activityId: string): Promise<ActivityBestEfforts | null> {
    const existing = inFlight.get(activityId);
    if (existing) return existing;
    const promise = fetchActivityBestEfforts(activityId).then((result) => {
      // A null result must NOT be memoized: a subsequent load() re-fetches
      // rather than replaying the cached failure.
      if (result === null) inFlight.delete(activityId);
      return result;
    });
    inFlight.set(activityId, promise);
    return promise;
  }

  function reset(): void { inFlight.clear(); }
  return { load, reset };
}
```
Change only: URL path (`stats/pace-quality/${activityId}.json`), the parse function's required-field set (per D-17's shard shape — gap intervals, impossible-sample indices+speeds, zero-advance run profile, adaptive window width, resolved device family + raw `device_name`), and the exported type names.

**Total, never-throwing parse precedent** (`best-efforts-client.ts:19-89`) — own-property-only reads (`hasOwn`), `isPlainObject` guard, entry-level tolerance (a single malformed sub-entry is dropped, never invalidates the whole shard), returns `null` on any top-level structural failure. Copy this exact discipline for `parsePaceQualityShard`.

**D-18's fetch-counter test precedent:** no existing counter test file was found to copy directly; `reset()` on the returned client object is the existing test-support hook (`best-efforts-client.ts:150-152`) — the new client's test should wrap `fetchImpl` in a counting stub and assert call count, following whatever pattern `best-efforts-client.test.ts` already uses (not read this session; check it directly when implementing, since it is the direct sibling test file).

---

### `scripts/compute-pace-quality-recount.mjs` (utility, batch) — NEW

**Analog:** `scripts/compute-pace-residual.mjs` (read header in full)

**Shape to copy** (`compute-pace-residual.mjs:1-40`):
```javascript
/**
 * ... D-19: the report ships with the script that regenerates it. ...
 * Structure follows `compute-route-data.mjs` (the archive-sweep analog): a
 * per-file try/catch around `readFileSync`/`JSON.parse` that warns and
 * continues (T-26-01), and a `main()` that drives the whole run.
 *
 * Deviation: this script also ships a guard test that imports its pure
 * functions directly, so `main()` is gated behind a self-execution check
 * rather than invoked unconditionally at module scope.
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
```
**Critical deviation D-03 requires:** unlike `compute-pace-residual.mjs` (which imports `../dist/analytics/pace-derivation.js`), `compute-pace-quality-recount.mjs` must **NOT** import `pace-quality.ts`/`dist/analytics/pace-quality.js` at all. It reads `data/dashboard/index.json` directly off disk and counts severe-tier fields with its own arithmetic — the whole point is that it cannot agree with the classifier by construction. Keep the `main()`-guard-behind-self-execution-check shape (mirrors `curate-server.mjs`/`exclusion-cli.mjs`) so a unit test can import its counting function without running the whole sweep.

---

### `src/analytics/dashboard-index.types.ts` (model, additive) — MODIFIED, genuinely additive

**Change type: ADDITIVE (safe)** — same shape as the two prior additions in this exact file.

**Self-precedent to copy** (`dashboard-index.types.ts:74-102`):
```typescript
/**
 * Resolved human gear label ... NEVER the raw gear id (17-D32/D33, D-17).
 *
 * REQUIRED, deliberately (WR-06). ... Making the key optional to model
 * "re-parsed JSON may lack it" also meant compute-dashboard-index could
 * silently stop emitting the field with no compile error ...
 * Use `ParsedDashboardIndexRow` below for the re-parse side instead.
 */
gearName: string | null;
/**
 * Metadata-vs-stream pace cross-check result (PACE-07, D-10, D-14), or
 * `null` when checked and not flagged. `null` NEVER means "not checked" —
 * the writer always evaluates the check and assigns a value here.
 * REQUIRED, deliberately, following the `gearName` precedent above (WR-06) ...
 */
paceDisagreement: PaceDisagreement | null;
```
The 5 new signal fields go on `DashboardIndexRow` the same way: **REQUIRED** (never optional — WR-06's compile-error-on-silent-omission guarantee), each with a doc comment stating what `null`/a not-computable sentinel means for the 24 stream-less activities (D-06), and `DASHBOARD_INDEX_SCHEMA_VERSION` stays `1`. The file's own header already states: *"Phase 27 asserts index additivity for its own signals against this same precedent."* `ParsedDashboardIndexRow`'s `Partial<>` handles the re-parse side automatically — no change needed there beyond the new keys existing on `DashboardIndexRow`.

---

### `src/analytics/compute-dashboard-index.ts` (service, batch) — MODIFIED, additive integration + one new I/O branch

**Change type: ADDITIVE (safe)** for the index-row fields; the shard-write loop is a **new code path**, not a modification of an existing one — low regression risk since it is a new `for` loop, but it is new file-I/O the plan should size as its own task.

**Analog 1 — the existing per-activity field-assembly + optional-stream-read pattern to extend** (`compute-dashboard-index.ts:208-269`, confirmed by direct read):
```typescript
const distanceM = activity.distance;
const movingTimeSec = activity.moving_time;
const paceSecPerKm = distanceM > 0 && movingTimeSec > 0 ? round1(movingTimeSec / (distanceM / 1000)) : null;

// PACE-07/D-14: gated on the threshold so the archive sweep stays cheap —
// only when the metadata pace is implausibly fast do we read the
// activity's stream file at all (T-26-09). Degrades to `null` on any
// stream read/parse failure (T-26-01) ...
let paceDisagreement: PaceDisagreement | null = null;
if (paceSecPerKm !== null && paceSecPerKm < PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM) {
  try {
    const stream = await fileStore.readJson<CanonicalStream>(path.join(streamsDir, `${id}.json`));
    paceDisagreement = detectPaceDisagreement(paceSecPerKm, stream);
  } catch (error) {
    console.warn(`  ${id}: could not read stream for pace disagreement check (${(error as Error).message}); paceDisagreement will be null`);
    paceDisagreement = null;
  }
}
...
const row: Omit<DashboardIndexRow, 'gearName'> = {
  id: String(id), startDate: activity.start_date, /* ... */ paceDisagreement,
};
```
Unlike `paceDisagreement` (conditionally read), Phase 27's three stream-derived signals need the stream **unconditionally** when one exists (not gated behind a pace threshold) — but the try/catch-degrade-to-not-computable shape is identical. `device_name`/`elapsed_time`/`moving_time` are already in scope on `activity` at this exact point in the loop — no new file read needed for those two metadata-only signals.

**Import line precedent** (`compute-dashboard-index.ts:26-30`):
```typescript
import {
  detectPaceDisagreement,
  PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM,
} from './pace-derivation.js';
```
Add `import { computePaceQualitySignals /* or similar */ } from './pace-quality.js';` alongside this.

**Analog 2 — the exact per-id shard-write loop to copy** (`compute-best-efforts.ts:308-321`):
```typescript
await fileStore.writeJson(path.join(statsDir, 'best-efforts.json'), doc);

// Per-activity shard files (18-13/T-18-AVAIL-04): the detail view's
// best-efforts panel needs exactly one activity's efforts, and must never
// fetch this whole archive-wide document in a browser ...
for (const [id, entry] of Object.entries(sortedActivities)) {
  await fileStore.writeJson(path.join(statsDir, 'best-efforts', `${id}.json`), entry);
}
```
Write `data/stats/pace-quality/{id}.json` the same way — either inside the existing per-activity loop (single pass) or as a second loop immediately after, following whichever this file's own existing structure makes cleaner (`compute-dashboard-index.ts` already loops once per activity; a second small loop mirroring the two-pass shape above is the lower-risk option since it isolates the new I/O from the existing row-assembly loop).

---

### `src/dashboard/views/list.ts` (component, badge dispatch) — MODIFIED, **CONTRACT CHANGE, not additive** (flag for its own task)

**Change type: API/CONTRACT CHANGE — needs its own task and regression attention.** This is the single highest-risk file in the phase. The existing dispatch mechanism cannot support D-09 as currently designed; extending it with a fourth `if (text === X)` branch does not work because there is no fixed `X` to match against when the visible text varies per row.

**Full current dispatch — read and extracted verbatim** (`list.ts:337-405`):
```typescript
/**
 * The status-badge strings for one row, in render order — the single source
 * of truth `appendStatusBadges` iterates to build the visible `.badge`
 * spans and `activityRowAriaLabel` folds into the row anchor's `aria-label`
 * (CR-02). Returns an empty array for a row with streams, HR, no
 * low-confidence flag, no exclusion and `prCount` 0.
 */
export function statusBadgeTexts(row: DashboardIndexRow): string[] {
  const texts: string[] = [];

  if (!row.streams.available) {
    texts.push(row.streams.reason ? `No streams (${row.streams.reason})` : 'No streams');
  } else if (!row.streams.hr) {
    texts.push('No HR');
  }

  if (row.lowConfidence) {
    texts.push(LOW_CONFIDENCE_BADGE_TEXT);
  }

  if (rowPaceDisagreement(row) !== null) {
    texts.push(PACE_DISPUTED_BADGE_TEXT);
  }

  if (row.excludedFromRecords) {
    texts.push('Excluded from records');
  }

  if (row.prCount > 0) {
    texts.push(`${row.prCount} PR`);
  }

  return texts;
}

/**
 * Appends every applicable status badge to `container` — shared by
 * `renderActivityRow` (mobile card) and `buildTableRow` (desktop Status
 * cell) ... `idPrefix` must differ between every simultaneously-rendered
 * surface ... A future badge must be added HERE, not as a new per-surface call.
 */
function appendStatusBadges(container: HTMLElement, row: DashboardIndexRow, idPrefix: string): void {
  const disagreement = rowPaceDisagreement(row);
  for (const text of statusBadgeTexts(row)) {
    if (text === LOW_CONFIDENCE_BADGE_TEXT) {
      appendLowConfidenceBadge(container, idPrefix);
    } else if (text === PACE_DISPUTED_BADGE_TEXT && disagreement !== null) {
      appendPaceDisputedBadge(container, idPrefix, disagreement);
    } else {
      appendBadge(container, text);
    }
  }
}
```
**Why this is a contract change, not an addition:** `text === PACE_DISPUTED_BADGE_TEXT` works today because "Pace disputed" is a fixed sentinel string every disputed row shows identically — the *measured* pace figure lives only in the hover/`aria-describedby` explanation (`paceDisputedExplanation`), never in the row's visible badge text. D-09 requires the NEW badges' visible text itself to carry the per-row measured value (e.g., `12% of elapsed time in recording gaps`), so there is no fixed string to equality-match against.

**Recommended restructuring** (research's own recommendation, confirmed sound against the read code): keep `statusBadgeTexts`/`appendStatusBadges` and the two existing badges (`LOW_CONFIDENCE_BADGE_TEXT`, `PACE_DISPUTED_BADGE_TEXT`) completely untouched on their existing string-equality path — lowest regression risk. Add a second, parallel, explicit dispatch step inside (or alongside) `appendStatusBadges` that reads directly off the row's own severity fields (e.g., `row.gapProfileSeverity === 'severe'` → `appendGapProfileBadge(container, idPrefix, row.gapProfileEvidence)`), never round-tripping the new badges' dynamic text through the `string[]`/re-match pattern. This is the exact split Open Question 3 in RESEARCH.md already recommends.

**Reusable building block — do NOT rebuild** (`list.ts:227-245`, `appendAccessibleBadge`):
```typescript
export function appendAccessibleBadge(
  container: HTMLElement,
  visibleText: string,
  explanation: string,
  descriptionId: string
): void {
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = visibleText;
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
D-09 uses this **unchanged** — visible text is the first argument (carries condition + measured value), `explanation` is the accessible/why-it-matters slot. Every new signal badge's append function should call this directly, mirroring `appendLowConfidenceBadge`'s and `appendPaceDisputedBadge`'s one-line wrapper shape (`list.ts:262-264`, `:306-317`) — a distinct `<signal>DescriptionId(idPrefix)` helper per new badge, following `lowConfidenceDescriptionId`/`paceDisputedDescriptionId`'s exact suffix-derivation pattern (`list.ts:206-208`, `:277-284`).

**`RowSurface`/`idPrefix`/multi-surface discipline to preserve** (`list.ts:180-196`, D-10):
```typescript
export type RowSurface =
  | 'activity-card' | 'activity-table' | 'overview-prs' | 'overview-activities';

export function rowIdPrefix(surface: RowSurface, rowId: string): string {
  return `${surface}-${rowId}`;
}
```
D-10 requires the new badges reach all four surfaces through this SAME `appendStatusBadges` call site, never a per-surface conditional — confirmed this is exactly what `PACE_DISPUTED_BADGE_TEXT`'s own addition already did (one dispatch branch, reached by all four surfaces via `renderActivityRow`/`buildTableRow`'s existing calls).

---

### `src/dashboard/views/list-logic.ts` (store, pure) — MODIFIED, additive

**Change type: ADDITIVE (safe)** — one new `FilterState` boolean field, following the exact shape of the eight existing fields (all `string | number | null`, this one is the first `boolean`).

**`FilterState` shape to extend** (`list-logic.ts:34-56`):
```typescript
export interface FilterState {
  q: string;
  from: string | null;
  to: string | null;
  dMinKm: number | null;
  dMaxKm: number | null;
  pMinSec: number | null;
  pMaxSec: number | null;
  tMinMin: number | null;
  tMaxMin: number | null;
}

export const EMPTY_FILTERS: FilterState = {
  q: '', from: null, to: null, dMinKm: null, dMaxKm: null,
  pMinSec: null, pMaxSec: null, tMinMin: null, tMaxMin: null,
};
```
Add e.g. `anySevere: boolean` with `EMPTY_FILTERS.anySevere = false`. **No existing boolean field to copy verbatim** — this phase introduces the first one; use `false`/absent-param-means-false as the "default" the way `parseListQuery` treats every other filter's absence, not the numeric/string null-sentinel shape the others use.

**URL parse/serialize round-trip to extend** (`list-logic.ts:106-133`, `:140-...`):
```typescript
export function parseListQuery(query: URLSearchParams): ListState {
  // ... existing sort/dir/page ...
  const filters: FilterState = {
    q: parseQParam(query.get('q')),
    from: parseDateParam(query.get('from')),
    // ...
  };
  return { sort, dir, page, filters };
}
```
Add `anySevere: query.get('severe') === '1'` (or similar single-param boolean parse) alongside the existing filter fields — a boolean URL param typically encodes as presence/`'1'` rather than `Number`/regex-date parsing; there is no existing boolean param in this file to copy the exact parse idiom from, so this is genuinely new (small) code, not a copy.

**Filter-application (AND-semantics) precedent to extend** (`list-logic.ts:325-343`, `filterRows`):
```typescript
export function filterRows(rows: readonly DashboardIndexRow[], filters: FilterState): DashboardIndexRow[] {
  return rows.filter((row) => {
    if (!matchesQuery(row, filters.q)) return false;
    if (!matchesDateRange(row, filters.from, filters.to)) return false;
    if (!matchesRange(row.distanceM / 1000, filters.dMinKm, filters.dMaxKm)) return false;
    // ...
    return true;
  });
}
```
Add `if (filters.anySevere && !rowHasAnySevereSignal(row)) return false;` following the same early-return-false AND-chain shape. `rowHasAnySevereSignal` should live in `pace-quality.ts` (pure, testable) or as a small helper here reading the three tiering fields directly — this is the SAME composite predicate the calibration report/recount script computes, so keep it in exactly one place per D-16's own "same composite Criterion 4 measures" requirement.

**Filter-chip precedent** (`list-logic.ts:349-399`, `buildFilterChips`) — not required by D-15/D-16 (no chip is asked for), but if the checkbox needs a removable chip, this is the shape (`FilterChipKey` union + one `chips.push({ key, label })` per active group).

---

### `src/dashboard/views/detail.ts` (controller, one mount point) — MODIFIED, additive

**Change type: ADDITIVE (safe)** — one new member in an existing `Promise.all` array, mirroring the existing three.

**Exact one-mount-point `Promise.all` to extend** (`detail.ts:536-547`, confirmed by direct read):
```typescript
async function mountBestEffortsAndBadges(
  container: HTMLElement,
  badgesContainer: HTMLElement,
  panelContainer: HTMLElement,
  detail: ActivityDetail,
  myToken: number
): Promise<void> {
  const [bestEffortsEntry, ageGrading, liveExclusionState] = await Promise.all([
    bestEffortsClient.load(detail.id),
    ageGradingClient.load(),
    loadLiveExclusionState(detail.id),
  ]);

  if (myToken !== requestToken || mountedContainer !== container) {
    return;
  }
  // ...
}
```
Add `paceQualityClient.load(detail.id)` as a fourth destructured member of this SAME `Promise.all` — this is what makes "zero fetches on list, exactly one on open" true by construction (this function is never called from the list render path at all). The existing `myToken`/`mountedContainer` stale-navigation guard immediately after the `Promise.all` already covers the new fetch too — no new guard needed.

**Existing index-row read-and-badge worked example to extend for the new row fields** (`detail.ts:584`, `:631`, confirmed present):
```typescript
const gearLabel = resolveGearLabel(gearMap, activity.gear_id, activity.device_name);
// ...
const disagreement = indexClient.getRow(detail.id)?.paceDisagreement ?? null;
```
The detail view already reads scalar fields straight off `indexClient.getRow(detail.id)` for existing badges — the 5 new signal fields (all always-on per D-08, none requiring a fetch) should be read the same way, directly off the index row, with the shard fetched only for the evidence detail beneath the badges (D-17).

**Client construction/injection pattern** (`detail.ts:287-294`):
```typescript
ageGradingClient?: AgeGradingClient;
bestEffortsClient?: BestEffortsClient;
// ...
const ageGradingClient = deps.ageGradingClient ?? createAgeGradingClient();
const bestEffortsClient = deps.bestEffortsClient ?? createBestEffortsClient();
```
Add `paceQualityClient` the same way — optional injected dependency, defaulting to `createPaceQualityClient()` — for test seams.

---

### `src/dashboard/views/detail-sections.ts` (component, always-on section) — MODIFIED, additive (new section) + one integration decision (where it sits)

**Change type: ADDITIVE (safe)** — a wholly new section builder function; does not touch `buildBreakdownSection`'s existing logic.

**Plan/render split precedent to copy exactly** (`detail-sections.ts:497-604`, `breakdownSectionPlan` / `buildBreakdownSection`):
```typescript
export function breakdownSectionPlan(
  buckets: readonly PaceBucket[],
  coverage: PaceCoverage | null,
  zoneTimes: readonly ZoneTime[] | null
): BreakdownSectionPlan | null {
  const captionText = coverage !== null ? coverageCaptionText(coverage) : null;
  const hasCoverage = captionText !== null;
  if (!hasCoverage && buckets.length === 0 && zoneTimes === null) return null;
  // ... returns a plain data plan object, no DOM ...
}

export function buildBreakdownSection(
  buckets: readonly PaceBucket[],
  coverage: PaceCoverage | null,
  zoneTimes: readonly ZoneTime[] | null
): HTMLElement | null {
  const plan = breakdownSectionPlan(buckets, coverage, zoneTimes);
  if (plan === null) return null;
  const section = document.createElement('section');
  section.className = 'card detail-section';
  // ... pure emitter over `plan` ...
  return section;
}
```
D-08 requires the new "Quality Signals" section to be **always-on** (never `null`) — simpler than `breakdownSectionPlan`'s three-way null case, since D-08 explicitly wants healthy signals disclosed too, not hidden. Still worth keeping the plan/render split (a pure `buildQualitySignalsPlan(row, shard)` returning a data object, then a pure `buildQualitySignalsSection(plan)` emitter) for the same testability reason this file already established (CR-01's own history — a rendering defect here would be the fourth of this project's shipped-behind-a-green-gate class of bug).

**Section placement precedent** — the `Pace Distribution` `<h2 class="text-heading">` and its D-08-of-Phase-26 always-on coverage caption `<p class="text-label">` sit immediately above the histogram bars (`detail-sections.ts:570-593`). Per CONTEXT.md D-08, the new quality section extends this SAME always-on-caption reasoning to the signals "sitting beside it on the same page" — placing it adjacent to (immediately before or after) this heading is the natural integration point research and CONTEXT.md both point to; exact ordering (before/after Pace Distribution) is Claude's Discretion per the phase context.

---

### `scripts/verify-dashboard-publish.mjs` (test, spot-check) — MODIFIED, additive

**Change type: ADDITIVE (safe)** — one new `if` block following an existing sibling block; no existing check is altered.

**Exact `gearName` check to follow** (`verify-dashboard-publish.mjs:269-292`, confirmed by direct read):
```javascript
const indexJsonBody = await expect200(baseUrl, '/data/dashboard/index.json');
if (indexJsonBody) {
  const parsed = JSON.parse(indexJsonBody);
  if (parsed.schemaVersion !== 1) {
    fail(`/data/dashboard/index.json schemaVersion expected 1, got ${parsed.schemaVersion}`);
  } else if (!Array.isArray(parsed.activities) || parsed.activities.length === 0) {
    fail('/data/dashboard/index.json activities array is empty');
  } else {
    ok('/data/dashboard/index.json parses with schemaVersion 1 and a non-empty activities array');
  }
  // gearName (D-17) must survive publication: at least one row resolved,
  // and no row leaks a raw gear id (T-18-GEAR-01).
  if (Array.isArray(parsed.activities)) {
    const badGearId = /^g\d{5,}$/;
    const hasGearName = parsed.activities.some((row) => row.gearName !== null && row.gearName !== undefined);
    const leakedRow = parsed.activities.find((row) => badGearId.test(row.gearName ?? ''));
    if (!hasGearName) {
      fail('/data/dashboard/index.json no row has a non-null "gearName" ...');
    } else if (leakedRow) {
      fail(`/data/dashboard/index.json activity ${leakedRow.id} leaks a raw gear id in "gearName" ...`);
    } else {
      ok('/data/dashboard/index.json at least one row has "gearName" and no row leaks a raw gear id');
    }
  }
}
```
Add a new block immediately after this one, in the same `if (Array.isArray(parsed.activities))` shape: assert at least one row carries a non-`undefined` value for at least one of the 5 new fields (presence spot-check, mirroring `hasGearName`), following the same `fail(...)`/`ok(...)` idiom. Since `device_name` now reaches the published index verbatim for the `unrecognized-device` category (D-12), consider a second check mirroring the `leakedRow` shape — e.g. assert no `unrecognized-device` row's raw string contains `<` or other HTML-special characters reaching the JSON body unescaped (defense-in-depth spot-check; the real XSS guard is `textContent`-only rendering at the DOM layer, covered by the security note below, not this script).

## Shared Patterns

### Accessible badge (visible text + explanation)
**Source:** `src/dashboard/views/list.ts:227-245` (`appendAccessibleBadge`)
**Apply to:** every new severe-tier list badge (`src/dashboard/views/list.ts`) — reused unchanged per D-09, the first argument (`visibleText`) carries the per-row measured value, the third (`explanation`) carries the accessible why-it-matters text.

### Total, never-throwing pure functions over `(t, d)` streams
**Source:** `src/analytics/pace-derivation.ts` header (T-26-01/T-26-02) + `src/analytics/best-effort-utils.ts:50-75` (`validateStreamSeries`)
**Apply to:** every new function in `pace-quality.ts` that touches a stream — any array-shaped input, including malformed/adversarial, returns a zeroed/not-computable result rather than throwing; never `?? 0`/`|| 0` coerce insufficient data into a plausible-looking zero.

### Required (never optional) producer-type fields
**Source:** `src/analytics/dashboard-index.types.ts:74-102` (`gearName`, `paceDisagreement` — the WR-06 rule stated twice)
**Apply to:** the 5 new fields on `DashboardIndexRow` — required, never optional, so a compute step that silently stops emitting one fails `tsc`, not silently at runtime.

### Fetch-once/memoize/degrade-to-null shard client
**Source:** `src/dashboard/data/best-efforts-client.ts` (full file)
**Apply to:** `src/dashboard/data/pace-quality-client.ts` — copy verbatim, changing only the URL and parse function.

### Per-id shard-write loop
**Source:** `src/analytics/compute-best-efforts.ts:308-321`
**Apply to:** the new `data/stats/pace-quality/{id}.json` writer inside/after `compute-dashboard-index.ts`'s per-activity loop.

### `textContent`-only rendering for untrusted strings
**Source:** stated in `dashboard-index.types.ts`'s header for `name`; precedented for `device_name` specifically via `resolveGearLabel` (`gear-client.ts:61-78`) feeding the published `gearName` field
**Apply to:** the new `unrecognized-device` category's raw `device_name` string, wherever it reaches the DOM (detail-view badge/section) — `textContent` only, never `innerHTML`, in both `list.ts` and `detail-sections.ts`.

## No Analog Found / Naming Conflict Flagged

| File/Concept | Role | Data Flow | Reason |
|---|---|---|---|
| `resolveDeviceFamily(device_name, source_provider)` | pure function | transform | No existing code resolves device family from these two fields jointly — `resolveGearLabel` (`gear-client.ts`) resolves a *label*, not a *family category*, and never consults `source_provider`. This is genuinely net-new logic (small, ~15-30 lines per RESEARCH.md), not a copy. |
| `countImpossibleSamples` (per-sample) | pure function | transform | `isPlausible` (`best-effort-utils.ts:140-163`) is confirmed NOT to transfer — it operates on one effort's implied speed against `activityMaxSpeedMps`, a different granularity/denominator than a per-sample-pair check over the whole stream. Write new, do not adapt `isPlausible`. |
| Boolean `FilterState` field + its URL-param parse idiom | pure function | transform | Every existing `FilterState` field is `string \| number \| null`; there is no existing boolean-URL-param parse/serialize idiom in `list-logic.ts` to copy the exact form from (only presence/`'1'`-style encoding is a reasonable default, not an established pattern in this file). |
| **Naming conflict: `unknown-device` vs `unrecognized-device`** | — | — | `src/analytics/pace-fixtures.ts:397` pins the `'real-pause'` fixture's `deviceFamily` as `'unknown-device'` (with a comment noting it is deliberately distinct from `'no-device-name'` for an unrelated reason — pinned for its pause-length property). CONTEXT.md's D-12 names the unrecognized-device category `unrecognized-device`. These are two different strings for what may or may not be the same taxonomy slot. **The planner must resolve this explicitly** before writing `pace-quality.ts`'s `DeviceFamily` union: either rename the fixture's `unknown-device` to `unrecognized-device` (breaking a pinned fixture value CONTEXT.md/D-11 says matches "whatever else this archive's four watches actually require"), or treat them as two deliberately distinct categories and justify why. This was not raised in CONTEXT.md or RESEARCH.md and is a genuine planning gap this pattern search surfaced. |

## Metadata

**Analog search scope:** `src/analytics/`, `src/dashboard/data/`, `src/dashboard/views/`, `scripts/` — all files named in RESEARCH.md's Wave 0 Gaps, confirmed against the live tree with `wc -l`/`grep -n`/`sed -n` before excerpting.
**Files scanned (read in full or by targeted non-overlapping section):** `compute-best-efforts.ts`, `best-efforts-client.ts`, `dashboard-index.types.ts`, `compute-dashboard-index.ts`, `pace-derivation.ts`, `best-effort-utils.ts`, `gear-client.ts`, `list.ts`, `list-logic.ts`, `detail.ts`, `detail-sections.ts`, `verify-dashboard-publish.mjs`, `compute-pace-residual.mjs`, `pace-fixtures.ts` (13 files).
**Pattern extraction date:** 2026-09-10
