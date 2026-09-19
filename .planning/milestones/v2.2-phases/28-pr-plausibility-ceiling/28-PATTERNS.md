# Phase 28: PR Plausibility Ceiling - Pattern Map

**Mapped:** 2026-09-10
**Files analyzed:** 9 (2 modified core, 1 new pure module, 2 modified dashboard views, 2 new scripts, 2 test files with zero prior coverage)
**Analogs found:** 9 / 9 (all files have a strong in-repo analog; none require external research patterns)

All line numbers below were read directly from the live source on 2026-09-10, not copied from RESEARCH.md — several drifted from RESEARCH.md's cited numbers (noted per-file). Re-verify at execution time if the archive/codebase has moved.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/analytics/compute-best-efforts.ts` (restructure) | service (batch compute) | batch/CRUD (accumulate→derive→write) | itself (existing 2-pass shape → 3-pass) | exact (self-restructure) |
| `src/analytics/best-effort-ceiling.ts` (NEW — module-layout discretion, this doc recommends this path) | utility (pure guard/statistic fn) | transform | `src/analytics/best-effort-utils.ts`'s `isPlausible`/`rankTopN` | exact |
| `src/analytics/best-effort.types.ts` (additive field) | model | — | itself (`BestEffort extends ComputedEffort` shape) | exact |
| `data/best-effort-ceiling.json` (NEW, committed, D-07) | config (machine-written state) | file-I/O (read/diff/write) | `data/best-effort-exclusions.json` + `best-effort-exclusions.ts`'s loader | exact |
| `src/dashboard/views/detail-sections.ts` (`buildPrFlagsCell`, modify) | component (DOM builder) | request-response (render) | itself — sibling badge cell in same file | exact |
| `src/dashboard/views/detail-sections.test.ts` (NEW describe block) | test | — | none exists for this function today (see below) | no analog — net-new coverage |
| `src/dashboard/views/records-logic.ts` / `records.ts` (`buildPrTableEmptyState`, modify) | component + pure logic | request-response (render) | itself — existing two-branch empty state | exact |
| `scripts/compute-pr-ceiling-diff.mjs` (NEW) | script (audit artifact generator) | batch/transform | `scripts/compute-pace-residual.mjs` | exact |
| `scripts/compute-pr-ceiling-recount.mjs` (NEW, D-15) | script (classifier-independent verifier) | batch/transform | `scripts/compute-pace-quality-recount.mjs` | exact |

## Pattern Assignments

### `src/analytics/compute-best-efforts.ts` (service, batch compute — restructure)

**Analog:** itself. File is 348 lines total — read whole, no re-reads needed.

**Imports** (lines 12-35):
```typescript
import * as path from 'path';

import type {
  ActivityBestEfforts,
  BestEffortsDocument,
  ComputedEffort,
  PRRankingEntry,
  RejectedEffort,
  TargetDistanceKey,
} from './best-effort.types.js';
import { BEST_EFFORTS_SCHEMA_VERSION, TARGET_METERS, TARGET_ORDER } from './best-effort.types.js';
import {
  findBestEffort,
  isPlausible,
  markPRs,
  rankTopN,
  validateStreamSeries,
  WORLD_RECORD_SPEED_MPS,
} from './best-effort-utils.js';
import { isExcluded, loadExclusions } from './best-effort-exclusions.js';
import { loadManifest } from '../streams/stream-manifest.js';
import type { CanonicalStream, DistanceSource } from '../streams/stream.types.js';
import type { StravaActivity } from '../types/strava.types.js';
import { FileStore } from '../storage/file-store.js';
```
A new `best-effort-ceiling.js` import belongs alongside `best-effort-utils.js`'s import block, matching the `.js`-suffixed-relative-import convention (ESM/NodeNext).

**The exact deletion to reverse** (lines 83-117, `computeActivityEfforts`'s per-target loop — verified live, matches RESEARCH.md's cited 94-97 almost exactly; the `if (!plausibility.ok)` block is lines 94-97):
```typescript
for (const key of eligibleTargets) {
  try {
    const raw = findBestEffort(t, d, TARGET_METERS[key]);
    if (!raw) {
      // The stream simply never covers this distance — not an error, not a rejection.
      continue;
    }

    const impliedSpeedMps = TARGET_METERS[key] / raw.durationSec;
    const plausibility = isPlausible(impliedSpeedMps, maxSpeedMps, WORLD_RECORD_SPEED_MPS[key]);

    if (!plausibility.ok) {
      rejected.push({ activityId, distance: key, reason: plausibility.reason });
      continue;   // <-- THIS is the delete-not-demote defect (D-08 reverses it)
    }

    const paceSecPerKm = raw.durationSec / (TARGET_METERS[key] / 1000);

    efforts.push({
      distance: key,
      durationSec: round1(raw.durationSec),
      paceSecPerKm: round1(paceSecPerKm),
      startOffsetSec: Math.round(raw.startOffsetSec),
      endOffsetSec: round1(raw.endOffsetSec),
      lowConfidence: distanceSource === 'geo',
    });
  } catch (error) {
    rejected.push({
      activityId,
      distance: key,
      reason: `unexpected error: ${(error as Error).message}`,
    });
  }
}
```
**Note for the planner:** since `computeActivityEfforts` is called BEFORE the ceiling exists (Pass 1, archive-wide), the absolute guard (`isPlausible`) stays inside this per-activity sweep exactly as today — it does not depend on the archive population. The change here is only: on `!plausibility.ok`, push a retained-but-flagged effort (with a `demotion` field set) into `efforts[]` instead of `continue`-ing past it into `rejected[]` only. The ceiling guard (Pass 3, new) cannot run here — it needs `byDistance` from all activities first.

**Pass 1's accumulator — the exact seam PR-02 anchors on** (lines 174-177, 207-228):
```typescript
// Map<distance, entries> — accumulated across the whole archive, then
// sorted/marked/ranked once per distance after the per-activity loop.
const byDistance = new Map<TargetDistanceKey, PRAccumulatorEntry[]>();
for (const key of TARGET_ORDER) byDistance.set(key, []);
```
```typescript
for (const rejection of result.rejected) {
  rejected.push(rejection);
  effortsRejected++;
}

for (const effort of result.efforts) {
  if (effort.lowConfidence) lowConfidenceEfforts++;

  const isEffortExcluded = isExcluded(exclusions, id, effort.distance);
  if (isEffortExcluded) {
    effortsExcluded++;
    continue;
  }

  byDistance.get(effort.distance)!.push({
    activityId: id,
    startDate: activity.start_date,
    durationSec: effort.durationSec,
    paceSecPerKm: effort.paceSecPerKm,
    lowConfidence: effort.lowConfidence,
  });
}
```
This is PR-02's "already-filtered population" — built from `result.efforts` (already past `isPlausible`) and `isExcluded`. **This is the exact array a new Pass 2 must read from** (`byDistance.get(key)!.map(e => e.durationSec)` or similar), not `computeActivityEfforts`'s raw per-target sweep output.

**Pass 2/3's insertion seam — the current per-distance loop** (lines 250-270):
```typescript
const rankings: Record<TargetDistanceKey, PRRankingEntry[]> = {} as Record<
  TargetDistanceKey,
  PRRankingEntry[]
>;

for (const key of TARGET_ORDER) {
  const entries = byDistance.get(key)!;
  const withPR = markPRs(entries);

  // Write wasPRAtTheTime back onto the matching effort inside the
  // per-activity results. Each activity has at most one effort per
  // distance, so matching by (activityId, distance) is unambiguous.
  for (const marked of withPR) {
    const activityEfforts = activities[marked.activityId]?.efforts;
    if (!activityEfforts) continue;
    const effort = activityEfforts.find((e) => e.distance === key);
    if (effort) effort.wasPRAtTheTime = marked.wasPRAtTheTime;
  }

  rankings[key] = rankTopN(entries);
}
```
This is where Pass 2 (derive ceiling from `byDistance.get(key)!`, once, per distance) inserts BEFORE this loop, and Pass 3 (ceiling-exceeding entries removed from `entries` before `markPRs`/`rankTopN`, but the matching `activities[id].efforts[...]` row gets `demotion` set instead of never existing) folds into this same loop body.

**Error handling / defensive posture to preserve:** the per-activity `try/catch` at lines 185-247 (`console.warn` + `skippedUnreadable++`) must not be touched — "a truncated or hand-edited stream/activity file must not abort a 1,842-activity run" (comment at line 242-243) is load-bearing and orthogonal to this phase's change.

**Console reporting tail** (lines 324-345) already has a `rejected.length > 0` block capped at `REJECTED_CONSOLE_CAP = 50` (line 140) — extend this reporting for ceiling movement (D-06) rather than inventing a second logging block.

**Tested today via:** `src/analytics/compute-best-efforts.test.ts` — 348-line source, ~700+-line test file, `describe('computeBestEfforts — archive orchestration', ...)` at line 203 is the fixture harness to extend (see the dedicated harness excerpt below). The `rejected contains one row per dropped effort` test (around line 500-535) is the exact test that must flip meaning under D-08 — it currently asserts `doc.rejected.length === 1` and the effort absent from `efforts`; post-change it should additionally assert the effort IS present in `activities['implausible'].efforts` with a `demotion` field set.

---

### `src/analytics/best-effort-ceiling.ts` (NEW pure module — module-layout discretion)

**Analog:** `src/analytics/best-effort-utils.ts` (222 lines, read whole) — specifically `isPlausible` (guard-function shape) and `rankTopN` (sort-then-slice statistic shape).

**Why this file, not an addition to `best-effort-utils.ts`:** RESEARCH.md leaves this open; recommend a sibling file because the ceiling derivation has its own doc-comment header, its own constant (`K`), and its own minimum-population floor — bundling it into the 222-line `best-effort-utils.ts` would mix "guard against absolute limits" with "derive a personal statistic," two different jobs the file's own header (lines 1-8) currently scopes to "computation utilities," not statistics. Either choice satisfies Phase 26's D-15 purity rule (no `fs`, no Node builtins) as long as it is imported by the same callers.

**Guard-function shape to match — `isPlausible`** (`best-effort-utils.ts:162-186`):
```typescript
export function isPlausible(
  impliedSpeedMps: number,
  activityMaxSpeedMps: number | undefined,
  worldRecordSpeedMps: number
): PlausibilityResult {
  if (
    activityMaxSpeedMps &&
    Number.isFinite(activityMaxSpeedMps) &&
    impliedSpeedMps > activityMaxSpeedMps * MAX_SPEED_MARGIN
  ) {
    return {
      ok: false,
      reason: `implied ${impliedSpeedMps.toFixed(2)} m/s exceeds activity max_speed ${activityMaxSpeedMps.toFixed(2)} m/s`,
    };
  }
  if (impliedSpeedMps > worldRecordSpeedMps) {
    return {
      ok: false,
      reason: `implied ${impliedSpeedMps.toFixed(2)} m/s exceeds world-record pace ${worldRecordSpeedMps.toFixed(2)} m/s`,
    };
  }
  return { ok: true };
}
```
The demotion reason's wording register (house style, named condition + measured value, never an adjective) must match this exactly — e.g. `implied 8.85 m/s exceeds personal ceiling 6.01 m/s (K=1.50 × p90 4.01 m/s, n=1831)`.

**Statistic-derivation shape to match — `rankTopN`** (`best-effort-utils.ts:212-222`, sort-then-slice, zero dependency, matches "Don't Hand-Roll" guidance):
```typescript
export function rankTopN(
  effortsForDistance: PRRankingEntry[] | Array<Omit<PRRankingEntry, 'rank'>>,
  n: number = TOP_N
): PRRankingEntry[] {
  const sorted = [...effortsForDistance].sort((a, b) => {
    if (a.durationSec !== b.durationSec) return a.durationSec - b.durationSec;
    return Date.parse(a.startDate) - Date.parse(b.startDate);
  });

  return sorted.slice(0, n).map((entry, index) => ({ ...entry, rank: index + 1 }));
}
```
A percentile function follows the same `[...arr].sort(...)` + index-into-sorted shape — no library needed (STACK.md already rejected `simple-statistics`/`d3-array`).

**Existing constants to place a new ceiling constant beside** (`best-effort-utils.ts:22-42`):
```typescript
export const MAX_SPEED_MARGIN = 1.02;
export const TOP_N = 10;
export const WORLD_RECORD_SPEED_MPS: Record<TargetDistanceKey, number> = { /* ... */ };
export const WORLD_RECORD_100M_SPEED_MPS = 10.44;
```
A new `CEILING_K` (or equivalent) constant, plus the minimum-population floor constant, belong in this new file with the same "why this number" doc-comment discipline these four already have (each has 3-10 lines of rationale above it).

**Cross-distance option available at zero cost** — `src/analytics/riegel.ts` exports `riegelPredict`, `fitRiegelExponent`, `selectFitPoints`, `RIEGEL_STANDARD_B` (confirmed exported and already tested; not re-read here per stop-early discipline — RESEARCH.md's citation is sufficient and this phase does not require reading riegel.ts's internals unless the hybrid gate is chosen).

**Tested today:** N/A — new file. Companion `best-effort-ceiling.test.ts` should mirror `best-effort-utils.test.ts`'s per-function `describe` block shape (not read in full here — same directory, same project convention, confirmed present via `ls`).

---

### `src/analytics/best-effort.types.ts` (model — additive field, D-10)

**Analog:** itself, 162 lines, read whole.

**The exact interface to extend** (lines 90-94):
```typescript
export interface BestEffort extends ComputedEffort {
  wasPRAtTheTime: boolean;
  /** True when this effort matched an entry in the exclusion list — computed but withheld from PR marking/ranking. */
  excludedFromRecords: boolean;
}
```
D-10's additive field goes here, sibling to `excludedFromRecords`, e.g.:
```typescript
/** A separate machine judgment (D-10) — never collapsed into excludedFromRecords, which means "the owner decided." */
demotion: { guard: 'world-record' | 'max-speed' | 'ceiling'; reason: string } | null;
```

**Doc-comment convention this file uses everywhere** — every exported type/const carries a 1-4 line rationale comment (see `RejectedEffort` at lines 136-141: `/** One row per dropped effort (D-04). */`), and the file header (lines 1-11) states the two invariants ("duration always from `t`", "distance always from `d`") the whole subsystem rests on. A new field must carry the same register.

**`BestEffortsDocument`'s `rejected: RejectedEffort[]` top-level array** (lines 144-161) — confirmed still present and typed as before; RESEARCH.md's "Deprecated/outdated" note (retain vs retire) is an open call, not locked — if retained, its shape (`activityId`, `distance`, `reason` — lines 137-141) needs no change since `RejectedEffort` doesn't carry `guard`, only `reason` (a string). If the planner wants `rejected[]` to also carry the guard type for the diff script's cross-check, that's an additive change to `RejectedEffort`, not a breaking one.

**`BEST_EFFORTS_SCHEMA_VERSION`** (line 16) — `export const BEST_EFFORTS_SCHEMA_VERSION = 1;` with the comment "Bump only via an explicit, coordinated recomputation" — confirms this additive field does NOT require a bump (purely additive, matches Phase 26 D-14's precedent cited in CONTEXT.md).

---

### `data/best-effort-ceiling.json` (NEW committed state file, D-07)

**Analog:** `data/best-effort-exclusions.json` (the only other non-gitignored, hand/machine-written file in `data/`) + its loader `src/analytics/best-effort-exclusions.ts` (102 lines, read whole).

**The never-throws defensive-parse convention to mirror exactly** (`best-effort-exclusions.ts:87-101`):
```typescript
export async function loadExclusions(
  fileStore: FileStore,
  exclusionsPath: string
): Promise<ExclusionIndex> {
  try {
    const file = await fileStore.readJson<BestEffortExclusionsFile>(exclusionsPath);
    const index = buildExclusionIndex(file.exclusions);
    console.log(`Loaded ${index.size} best-effort exclusion${index.size === 1 ? '' : 's'} from ${exclusionsPath}`);
    return index;
  } catch (error) {
    console.warn(
      `Could not load exclusions from ${exclusionsPath}: ${(error as Error).message}; proceeding with zero exclusions`
    );
    return new Map();
  }
}
```
A new `loadCeilingState(fileStore, ceilingStatePath)` must follow this exact shape: try/catch around `readJson`, `console.warn` + safe fallback (`{}` / "treat every run as if it's the first") on any failure — never throw, never abort the nightly 1,842-activity run (T-16-EX-01's precedent, this phase's own Security Domain table names the same threat pattern explicitly).

**Individually-skip-bad-rows discipline** (`buildExclusionIndex`, lines 30-67) — the per-entry validation pattern (`typeof entry.activityId !== 'string'` etc., one bad row does not poison the whole index) is the shape a ceiling-state parser should copy if the file has a per-distance array structure.

**Schema-version field convention** — `BestEffortExclusionsFile` (`best-effort.types.ts:120-124`):
```typescript
export interface BestEffortExclusionsFile {
  schemaVersion: 1;
  note: string;
  exclusions: BestEffortExclusion[];
}
```
A new `BestEffortCeilingStateFile` type (in `best-effort.types.ts`, sibling to this one) should carry the same `schemaVersion`/`note` pair plus per-distance ceiling values and a demoted-effort-id set (per RESEARCH.md's suggested shape).

**Not tested today:** N/A — new file, no existing consumer. `best-effort-exclusions.test.ts` exists (confirmed via `ls`) as the test-shape analog for a new `best-effort-ceiling-state.test.ts` if the loader lives in its own module, or folded into `best-effort-ceiling.ts`'s own test file.

**CI wiring — do not add a second commit step** (`.github/workflows/daily-refresh.yml:220-226`):
```yaml
uses: stefanzweifel/git-auto-commit-action@4a55954c782fc1ea30b9056cd3e7a2b40ca8887d  # v7.2.0
commit_message: 'chore: update activities and stats [skip ci]'
file_pattern: 'data/activities/*.json data/sync-state.json data/geo/*.json data/streams/*.json'
```
Add `data/best-effort-ceiling.json` to this SAME `file_pattern` string (space-separated glob list) — do not add a second `git add`/`commit`/`push` step (that is the CI auto-commit push-race hazard named in D-07 and this project's memory). Note the commit message already carries `[skip ci]` literally — MEMORY confirms quoting a skip-CI token anywhere in a commit body silently suppresses the whole daily-refresh run; this existing line is presumably safe as-is (it is the workflow's own trigger-avoidance, not a stray quote), but any NEW commit-message text the ceiling-diff step logs must not itself contain that literal token unless deliberately suppressing.

---

### `src/dashboard/views/detail-sections.ts` — `buildPrFlagsCell` (component, DOM — modify, D-09 hazard)

**Analog:** itself. File is 1215 lines — do NOT read whole; grep-then-targeted-read was used (lines 1-40 for imports, 620-745 for the function and its caller).

**Live location (verified 2026-09-10 — differs from RESEARCH.md's cited 639-653, which was itself correct; CONTEXT.md's cited 339-353 is STALE, from an earlier line count before intervening edits):**
```typescript
// detail-sections.ts:639-652
/** Builds the PR? cell: a plain `PR` badge when `isPr`, plus the low-confidence and excluded badges when applicable. */
function buildPrFlagsCell(row: BestEffortPanelRow, exclusionReason: string | null): HTMLTableCellElement {
  const cell = document.createElement('td');

  if (row.isPr) {
    appendBadge(cell, 'PR');
  }
  if (row.lowConfidence) {
    appendLowConfidenceBadge(cell, `best-efforts-${row.distance}`);
  }
  if (row.excluded) {
    appendBadge(cell, exclusionReason ? `Excluded — ${exclusionReason}` : 'Excluded from records');
  }

  return cell;
}
```
**Confirmed finding (resolves RESEARCH.md's Assumption A3):** each condition already calls `appendBadge`/`appendLowConfidenceBadge` as a SEPARATE DOM node append — there is no string-concatenation defect live in this exact function today. The R15 "PRExcluded — {reason}" defect, if still reproducible, would come from three adjacent `<span class="badge">` nodes rendering with no visual separator/label distinguishing which claim is which when read as flowed text (e.g., by a screen reader concatenating cell text), not from a JS string-concatenation bug. A fourth condition (`row.demoted`) added as a fourth `if` block, appending a fourth badge, is structurally consistent with the existing three — but per D-09 it must ship WITH a fixture-driven regression test asserting the rendered badge texts/count are distinguishable, since no such test exists today (see below).

**Import block this function depends on** (lines 16-33):
```typescript
import type { Split } from './detail-splits.js';
import type { PaceBucket, ZoneTime } from './detail-zones.js';
import {
  formatPace,
  formatDurationHms,
  formatEffortDuration,
  appendBadge,
  appendLowConfidenceBadge,
  appendAccessibleBadge,
  qualityBadgeSpecs,
} from './list.js';
import type { BestEffortPanelRow } from './detail-best-efforts-logic.js';
```
`BestEffortPanelRow` (imported from `detail-best-efforts-logic.js`) is where a `demoted`/`demotionReason` field must be added first (see next section) before this cell can read it.

**Caller** (line 727, inside `buildBestEffortsSection`):
```typescript
tr.appendChild(buildPrFlagsCell(row, exclusionReason));
```
No signature change needed at the call site if the demotion reason travels on `row` itself (matching how `row.excluded` already does, rather than `exclusionReason` which is a separate parameter) — recommend adding `row.demotionReason: string | null` to `BestEffortPanelRow` rather than a second function parameter, for symmetry with `row.excluded`/`row.lowConfidence`/`row.isPr` which are all row fields, not parameters (the one exception, `exclusionReason`, is itself called out in `detail-best-efforts-logic.ts`'s JSDoc as a WR-05 "required second parameter, no default" discipline the planner may choose to extend the same way OR fold into the row — either is a legitimate design call, not dictated by this pattern map).

**Tested today: NOT AT ALL.** Confirmed by grep — `src/dashboard/views/detail-sections.test.ts` (exists, contains other `buildXSection` tests) has zero matches for `buildPrFlagsCell`, `PRExcluded`, or `Excluded —`. This is a genuine coverage gap RESEARCH.md's Wave 0 Gaps section already flags ("verify first whether that function currently has any test file at all" — confirmed: it does not, within a file that does test its siblings). The new test must be added from scratch, not extended.

---

### `src/dashboard/views/detail-best-efforts-logic.ts` — `BestEffortPanelRow` (pure logic, DOM-free — modify)

**Analog:** itself, 190 lines, read whole.

**The interface to extend** (lines 98-109):
```typescript
export interface BestEffortPanelRow {
  distance: TargetDistanceKey;
  display: string;
  durationSec: number;
  paceSecPerKm: number;
  isPr: boolean;
  lowConfidence: boolean;
  excluded: boolean;
  agePercent: number | null;
  ageDerived: boolean;
}
```

**The exact suppression precedent to extend, not fight** (lines 146-156, already anticipates a third state):
```typescript
* `isPr` (WR-05, GAP-24-04) is suppressed for a live-excluded row —
* computed as `wasPRAtTheTime && !excluded`, using the SAME locally-bound
* `excluded` value the row pushes — because `buildPrFlagsCell`
* (`detail-sections.ts:339-353`) renders `isPr` and `excluded` into the
* same `<td>`, and Round 2's R15 recorded that cell rendering literally
* `PRExcluded — {reason}`. This suppression is a BADGE-STATE claim only:
```
(Note: this comment's own line citation `339-353` is now stale — confirms the drift already flagged above; the function is at 639-652 as of this read.)

**Row-building function to extend** (lines 157-189, `buildBestEffortsPanelRows`):
```typescript
export function buildBestEffortsPanelRows(
  entry: ActivityBestEfforts | null,
  ageGrading: AgeGradingDocument | null,
  liveExclusions: ExclusionIndex | null
): BestEffortPanelRow[] {
  if (entry === null || entry.efforts.length === 0) return [];

  const byDistance = new Map(entry.efforts.map((effort) => [effort.distance, effort]));
  // ...
  for (const distance of TARGET_ORDER) {
    const effort = byDistance.get(distance);
    if (!effort) continue;
    const ageGradeEntry = ageGradeForActivity?.[distance];
    const excluded = resolveExcluded(liveExclusions, entry.activityId, distance, effort);

    rows.push({
      distance,
      display: DISTANCE_DISPLAY_NAMES[distance],
      durationSec: effort.durationSec,
      paceSecPerKm: effort.paceSecPerKm,
      isPr: effort.wasPRAtTheTime && !excluded,
      lowConfidence: effort.lowConfidence,
      excluded,
      agePercent: ageGradeEntry ? ageGradeEntry.agePercent : null,
      ageDerived: distance === '1k',
    });
  }
  return rows;
}
```
D-08 requires demoted efforts to remain visible on THIS panel (via `activity.efforts` now including them, per the compute-side change), so `byDistance` here (built from `entry.efforts`) picks them up for free once Pass 3 stops deleting them — the row-push above needs a `demoted: effort.demotion !== null` and `demotionReason: effort.demotion?.reason ?? null` added. `isPr` should already be structurally `false` for a demoted effort (a ceiling-demoted effort never reaches `wasPRAtTheTime: true` per the Pass 3 restructuring), so no change to the `isPr` line itself should be needed — but this is worth a fixture assertion, not just an inference.

**`resolveExcluded`, the single shared helper (D-10 boundary — leave untouched)** (lines 40-49):
```typescript
export function resolveExcluded(
  liveExclusions: ExclusionIndex | null,
  activityId: string,
  distance: TargetDistanceKey,
  effort: { excludedFromRecords: boolean }
): boolean {
  return liveExclusions !== null
    ? isExcluded(liveExclusions, activityId, distance)
    : effort.excludedFromRecords;
}
```
This function must NOT be touched or reused for demotion — D-10 explicitly keeps `excludedFromRecords` (owner intent) and `demotion` (machine judgment) as separate fields with separate resolution paths. A demoted effort's `demoted` flag reads directly off `effort.demotion !== null`, with no "live" vs "precomputed" distinction analogous to `resolveExcluded` (there is no live-editable demotion state this phase — D-11 forbids a write surface).

**Tested today:** presumably yes (a `.test.ts` sibling likely exists for this logic module, following the project's 1:1 test-file convention — not independently re-verified here since Wave 0 Gaps in RESEARCH.md/VALIDATION.md do not flag this file as untested, only `buildPrFlagsCell` and the empty-state branch).

---

### `src/dashboard/views/records-logic.ts` / `records.ts` — empty-state (component + logic, D-03/D-09)

**Analog:** itself, both files.

**`isEmptyRanking` — the existing sentinel to extend** (`records-logic.ts:143-149`):
```typescript
/**
 * The explicit sentinel `records.ts` branches on to decide whether a
 * distance's table body renders rows or the named empty state (D-05) —
 * testable rather than an inline `?.length` check in DOM code.
 */
export function isEmptyRanking(entries: readonly PRRankingEntry[] | undefined): boolean {
  return !entries || entries.length === 0;
}
```
This sentinel alone cannot distinguish "never attempted" (marathon) from "all demoted" (400m, D-03's accepted outcome) — both produce an empty `rankings[distance]` array. The distinguishing signal must come from a NEW count: how many `activities[id].efforts` exist at this distance total (attempted) vs how many survived into `rankings` (ranked). `buildEvolutionSeries` (below) already demonstrates the exact iteration shape needed to compute such a count.

**`buildPrTableEmptyState` — the two-branch function to extend to three branches** (`records.ts`, confirmed live at the function definition — grep located it; full body read):
```typescript
function buildPrTableEmptyState(distance: TargetDistanceKey, scope: RecordScope, year: number): HTMLElement {
  const label = DISTANCE_LABELS[distance];
  const empty = document.createElement('div');
  empty.className = 'empty-state';

  const heading = document.createElement('h3');
  heading.className = 'text-heading';
  heading.textContent = scope === 'this-year' ? `No ${label} efforts in ${year}` : `No ${label} efforts yet`;
  empty.appendChild(heading);

  const body = document.createElement('p');
  body.className = 'text-body';
  body.textContent =
    scope === 'this-year'
      ? `The archive has no ${label} effort recorded in ${year}. Switch to All time to see every ranked effort.`
      : `The archive has no completed ${label} effort. Once one is recorded, its rank will appear here.`;
  empty.appendChild(body);

  return empty;
}
```
A third branch (all-demoted) needs a new parameter (e.g. `demotedCount: number`) threaded from `records.ts`'s render loop, and a new copy variant such as `"No {label} efforts passed the plausibility ceiling"` / `"{demotedCount} effort(s) were recorded but demoted — see the activity detail view for each one's reason."` — following this function's existing register (a factual statement of what happened, matching the two branches already there, never an apology or a vague "no data").

**Caller / render-loop context** (`records.ts:556-588` region, `buildPrTableSection`):
```typescript
function buildPrTableSection(
  distance: TargetDistanceKey,
  rows: readonly PrTableRow[],
  empty: boolean,
  scope: RecordScope,
  year: number
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'card detail-section';
  section.id = `pr-table-${DISTANCE_SLUGS[distance]}`;

  const heading = document.createElement('h3');
  heading.className = 'text-heading';
  heading.textContent = DISTANCE_LABELS[distance];
  section.appendChild(heading);

  if (empty) {
    section.appendChild(buildPrTableEmptyState(distance, scope, year));
    return section;
  }
  // ...
}
```
The `empty: boolean` parameter is computed at the call site around line 660-666 via `isEmptyRanking(entries)` — a `demotedCount` argument threads through this same chain, sourced from `bestEfforts.activities` (iterate all activities' `efforts`, filter `distance === X && effort.demotion !== null`, count) rather than a new top-level document field, unless the planner adds one to `BestEffortsDocument.totals` for cheaper access (a reasonable additive choice, matching how `totals.effortsExcluded`/`totals.effortsRejected` already exist as archive-wide counts in `best-effort.types.ts:144-161`).

**`buildEvolutionSeries` — the exact per-activity-iteration shape to copy for the demoted-count helper** (`records-logic.ts:207-231`):
```typescript
export function buildEvolutionSeries(
  activities: BestEffortsDocument['activities'],
  distance: TargetDistanceKey
): EvolutionPoint[] {
  const points: EvolutionPoint[] = [];

  for (const activityId of Object.keys(activities)) {
    if (!hasOwn(activities, activityId)) continue;
    const activity = activities[activityId];
    if (!activity) continue;

    const x = parseStartDateToEpochMs(activity.startDate);
    if (x === null) continue;

    for (const effort of activity.efforts) {
      if (effort.distance !== distance) continue;
      if (effort.wasPRAtTheTime !== true) continue;

      points.push({ x, y: effort.durationSec, activityId: activity.activityId });
    }
  }

  points.sort((a, b) => a.x - b.x);
  return points;
}
```
A `countDemotedAtDistance(activities, distance)` pure function follows this exact `Object.keys(activities)` + `hasOwn` + inner-`for (effort of activity.efforts)` shape, swapping the `wasPRAtTheTime !== true` filter for `effort.demotion === null`.

**D-12's retroactive-promotion mechanism — why `markPRs` alone explains the diff blast radius** (`best-effort-utils.ts:193-206`, already excerpted above under the ceiling module; repeated here because `records-logic.ts`'s `buildEvolutionSeries`/`buildProgressionRows` are the DIRECT downstream consumers of `wasPRAtTheTime` flips): no change needed to `buildEvolutionSeries`/`buildProgressionRows` themselves — they already read whatever `wasPRAtTheTime` the compute step wrote. The diff script (next section) is what must independently recompute and compare the BEFORE/AFTER `wasPRAtTheTime` sets to surface D-12's flips; this dashboard code needs no new logic for the flip-detection itself, only for the demoted-count empty-state text.

**Tested today:** `records-logic.test.ts` exists (confirmed via `ls`) — `isEmptyRanking`, `buildEvolutionSeries` etc. are presumably already covered there; VALIDATION.md's Wave 0 explicitly names `records-logic.test.ts` / `records.test.ts` as needing a NEW case for "demoted, not never-attempted" (not currently present, per the Wave 0 Gaps list — this is additive coverage, not a fix to broken coverage).

---

### `scripts/compute-pr-ceiling-diff.mjs` (NEW — script, batch/transform, PR-04/D-12/D-13)

**Analog:** `scripts/compute-pace-residual.mjs` (390 lines, read whole) — the closest and most complete precedent: computes two semantics (`baselineFastMass` vs `adaptiveFastMass`) side-by-side over the SAME live archive in one run, exactly what PR-04 needs (OLD delete-on-reject semantics vs NEW ceiling-demote semantics), then writes a committed markdown artifact.

**Self-execution guard — copy verbatim** (lines 29-34, 384-390):
```javascript
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { derivePaceWithCoverage, paceHistogramSamples } from '../dist/analytics/pace-derivation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
```
```javascript
// Self-execution guard, mirroring curate-server.mjs / exclusion-cli.mjs: main()
// runs only under direct invocation, so scripts/compute-pace-residual.test.mjs
// can import the pure functions above without triggering the full archive
// sweep and a write to 26-RESIDUAL.md as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
```
The new diff script imports from `../dist/analytics/compute-best-efforts.js` (the built NEW semantics) and re-implements the OLD (delete-on-reject) semantics locally as a small pure function (RESEARCH.md's option (a), explicitly recommended over pinning a snapshot file) — `isPlausible`/`markPRs`/`rankTopN` are already pure exports it can import directly from `../dist/analytics/best-effort-utils.js` to reconstruct the pre-ceiling ranking without re-deriving that logic.

**Output path convention** (lines 36-39):
```javascript
const OUTPUT_PATH = join(
  __dirname,
  '../.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md'
);
```
New script writes to `.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md` (or similar per-phase name) — same `join(__dirname, '../.planning/...')` construction.

**Markdown-rendering shape — plain string-array `.push()` + `.join('\n')`, no templating library** (lines 158-271, `renderResidualMarkdown` — representative excerpt):
```javascript
export function renderResidualMarkdown(report) {
  const { generatedAt, archiveSize, cohortSize, residual, maxResidualPct, criterion1 } = report;
  const lines = [];

  lines.push('# Phase 26 PACE-06 Residual Report');
  lines.push('');
  lines.push('The residue the adaptive gap-aware derivation ... does not fix ...');
  lines.push('');
  lines.push(`**Generated:** ${generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Archive size scanned: ${archiveSize}`);
  // ... table rows built via more .push() calls, then:
  return lines.join('\n');
}
```
D-12's flip table (every top-10 row that moved, every `wasPRAtTheTime` flip, both directions, the 1mi-style promotion case) follows this same `| col | col |` markdown-table-via-push pattern (see the "Residual Activities" table at lines 206-215 of the analog for the exact `|---|---|---|---|---|` header-row-then-mapped-rows shape).

**Idempotence test — the D-13 trap this exact repo already learned the hard way (Phase 27 G-01):**
```
# From 27-VALIDATION.md's G-01 closure record — the exact verification shape to copy:
npm run compute-pr-ceiling-diff   # first run
cp .../28-DIFF.md /tmp/run1.md
npm run compute-pr-ceiling-diff   # second run, unchanged input
diff <(grep -v '^\*\*Generated:\*\*' /tmp/run1.md) \
     <(grep -v '^\*\*Generated:\*\*' .../28-DIFF.md)
# assert: empty diff output
```
This must be a REAL test (a script invoked twice and diffed), not an assumption — `27-CALIBRATION.md`'s G-01 stayed open specifically because this proof was skipped originally.

**Archive-sweep + per-file try/catch pattern, for reading `data/streams/*.json` if the diff script needs raw streams rather than just `best-efforts.json`** (lines 273-294, `sweepArchive`):
```javascript
function sweepArchive() {
  const streams = [];
  let files;
  try {
    files = readdirSync(STREAMS_DIR).filter((f) => f.endsWith('.json'));
  } catch (error) {
    console.warn(`Warning: Failed to read stream directory ${STREAMS_DIR}:`, error.message);
    return streams;
  }
  for (const file of files) {
    try {
      const content = readFileSync(join(STREAMS_DIR, file), 'utf8');
      streams.push(JSON.parse(content));
    } catch (error) {
      console.warn(`Warning: Failed to read ${file}:`, error.message);
    }
  }
  return streams;
}
```
One unreadable file must never abort the whole sweep (T-26-01) — same discipline `compute-best-efforts.ts`'s per-activity `try/catch` already enforces on the compute side.

**Tested today:** N/A — new file. Companion `.test.mjs` imports the pure functions (report-builder, markdown-renderer) directly, guarded by the same self-execution check, mirroring `compute-pace-residual.mjs`'s own test file (not read here — same-directory sibling, confirmed to exist by convention, not independently verified since it is out of this phase's file list).

---

### `scripts/compute-pr-ceiling-recount.mjs` (NEW — script, classifier-independent, D-15/PR-05 Criterion 3 & 5)

**Analog:** `scripts/compute-pace-quality-recount.mjs` (283 lines, read whole) — Phase 27's D-03 zero-import-discipline precedent, explicitly cited by this phase's own D-15.

**The load-bearing constraint, stated at the top of the analog and to be copied near-verbatim into the new script's header comment** (lines 1-34):
```javascript
/**
 * D-03's independent recount — the standalone verifier Phase 27's ROADMAP Criterion 4a
 * requires: it opens the SHIPPED `data/dashboard/index.json` off disk with `readFileSync` +
 * `JSON.parse` and counts severe-tier activities with its OWN arithmetic.
 *
 * FORBIDDEN, DELIBERATELY: this file has zero `import`/`require`/dynamic-`import()` statements
 * naming the classifier module ... a verifier that pulls in the classifier that produced the
 * numbers it is checking agrees with itself by construction — the exact failure mode D-03
 * exists to rule out ...
 *
 * Shape follows `scripts/compute-pace-residual.mjs`: pure exported functions, a guarded
 * `main()` behind the self-execution check ...
 *
 * Only read target: `data/dashboard/index.json`. Writes nothing, ever.
 */
```
For Phase 28's D-15, the equivalent forbidden import is `src/analytics/best-effort-ceiling.ts` (or wherever the ceiling logic lands) and `compute-best-efforts.ts` itself — the recount script's only read target is the SHIPPED `data/stats/best-efforts.json` (for the demoted-count reconciliation) and `data/dashboard/index.json` (for the 662-cohort `impossibleSamples.count >= 1` read PR-05 Criterion 3 needs — RESEARCH.md confirms this is Phase 27's already-shipped field, zero new mechanism).

**Never-throws file read** (lines 63-77, `readShippedIndex`):
```javascript
export function readShippedIndex(indexPath = INDEX_PATH) {
  let raw;
  try {
    raw = readFileSync(indexPath, 'utf8');
  } catch (err) {
    return { ok: false, reason: `could not read ${indexPath}: ${err.message}` };
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    return { ok: false, reason: `could not parse ${indexPath} as JSON: ${err.message}` };
  }
  return { ok: true, doc };
}
```
Copy this `{ ok, reason }` / `{ ok, doc }` result-object shape verbatim for a `readShippedBestEfforts(path)` function reading `best-efforts.json`.

**Own-arithmetic recount, driven off raw document fields, with disagreement cross-checks named explicitly rather than asserted** (lines 87-177, `recountComposite` — representative excerpt of the pattern, not the whole function):
```javascript
export function recountComposite(doc) {
  const findings = [];
  // ... walks doc.activities, recomputes its OWN verdict per row from tier STRINGS,
  // never from doc.<row>.anySevere as an answer ...
  for (const row of activities) {
    // ...
    if (rowHasSevere !== Boolean(quality.anySevere)) {
      compositeDisagreementIds.push(id);   // Cross-check 1: per-row disagreement
    }
  }
  const totalsComposite = doc.totals ? doc.totals.qualityAnySevere : undefined;
  const disagreesWithTotals = totalsComposite !== ownComposite;  // Cross-check 2: aggregate disagreement
  return { /* ... named fields, not a single boolean ... */ };
}
```
For Phase 28: the recount reads `doc.activities[*].efforts[*]` directly, counts `effort.demotion !== null` per activity (own arithmetic), and cross-checks against whatever archive-wide total the new `BestEffortsDocument.totals` carries (if the planner adds e.g. `totals.effortsDemoted`) — same two-cross-check shape (per-row AND aggregate).

**Pass/fail verdict assembly, pure, no `process.exit` inside it** (lines 184-212, `evaluateReport`):
```javascript
export function evaluateReport(report, expected) {
  const problems = [...report.schemaFindings];
  if (report.missingFieldIds.length > 0) { problems.push(`...`); }
  if (report.disagreesWithTotals) { problems.push(`...`); }
  if (expected !== undefined && report.ownComposite !== expected) {
    problems.push(`recomputed composite (${report.ownComposite}) does not equal --expect ${expected}`);
  }
  return { pass: problems.length === 0, problems };
}
```
This `--expect <n>` CLI flag pattern (parsed at lines 214-223 via `parseExpectFlag`) is directly reusable for pinning PR-05's cohort count check without hardcoding — RESEARCH.md explicitly warns "cohort.length should be ~662 ... do not hardcode 662 as an assertion," and this flag mechanism is exactly how the analog already avoids hardcoding while still allowing an optional pinned check.

**`main()` + self-execution guard** (lines 225-283) — same guard as `compute-pace-residual.mjs`, copy verbatim; `main()` here additionally demonstrates the console-reporting register (`Total rows:`, `Recomputed composite (own arithmetic, ...): N`, `vs. totals.X: N`, `PASS`/`FAIL:` blocks with `process.exitCode = 1` on failure) that the new script's `main()` should match line-for-line in spirit.

**Tested today:** N/A — new file. `scripts/compute-pace-quality-recount.mjs` has a sibling `.test.mjs` per this project's 1:1 convention (not read here, out of this phase's scope, but confirmed to exist by the same `ls` pattern used for the other analogs).

---

## Shared Patterns

### One-shared-demotion-path discipline (D-08)
**Source:** the reversed `compute-best-efforts.ts:94-97` block above.
**Apply to:** `compute-best-efforts.ts`'s restructured Pass 1/3 only. Every rejection reason (world-record, max-speed, ceiling) must funnel through ONE push-a-demoted-effort code path, not three separate branches with different downstream handling — mirrors how `isPlausible` already returns one `PlausibilityResult` union type for two different checks (`best-effort-utils.ts:162-186`) rather than two separate guard functions.

### Never-throws defensive file parsing (T-16-EX-01)
**Source:** `src/analytics/best-effort-exclusions.ts:87-101` (`loadExclusions`).
**Apply to:** the new `data/best-effort-ceiling.json` loader (D-07's V5 Input Validation requirement) — try/catch, `console.warn`, safe empty-state fallback, never reject/throw.

### Self-execution guard for dual-purpose scripts
**Source:** `scripts/compute-pace-residual.mjs:384-390` and `scripts/compute-pace-quality-recount.mjs:278-283` (identical pattern, both files).
```javascript
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
```
**Apply to:** both new scripts (`compute-pr-ceiling-diff.mjs`, `compute-pr-ceiling-recount.mjs`) — so their pure functions are importable by `.test.mjs` companions without triggering a real archive sweep/file write/file read as an import-time side effect.

### Plain-string-array markdown rendering (no templating dependency)
**Source:** `scripts/compute-pace-residual.mjs:158-271` (`renderResidualMarkdown`).
**Apply to:** `compute-pr-ceiling-diff.mjs`'s `28-DIFF.md` renderer — `const lines = []; lines.push(...); ...; return lines.join('\n');`.

### Additive, non-breaking type extension with rationale comments
**Source:** `src/analytics/best-effort.types.ts` — every field/const has a 1-4 line "why" comment (e.g. `RejectedEffort`'s `/** One row per dropped effort (D-04). */`), and `BEST_EFFORTS_SCHEMA_VERSION`'s "bump only via explicit coordinated recomputation" note.
**Apply to:** the new `demotion` field on `BestEffort`, and any new `totals.effortsDemoted`-style counter — additive only, no schema bump, matching Phase 26 D-14's precedent.

### Pure-function/DOM-split discipline
**Source:** `src/dashboard/views/detail-best-efforts-logic.ts`'s header comment: "Pure, DOM-free: every function here takes already-fetched data and returns plain values/rows — `detail.ts` renders them, this module never touches `document`/`window`."
**Apply to:** all demoted-effort logic added to `detail-best-efforts-logic.ts` and `records-logic.ts` — computation stays DOM-free and independently testable; only `detail-sections.ts` and `records.ts` touch `document.createElement`.

## No Analog Found

None. Every file in this phase's scope has a strong, directly-cited in-repo analog. The two genuinely new pieces of machinery (the ceiling statistic's exact numeric form, and the three-pass restructuring's precise pass boundaries) are covered by RESEARCH.md's own Architecture Patterns section and are compositions of the analogs above, not novel patterns requiring external research.

## Metadata

**Analog search scope:** `src/analytics/`, `src/dashboard/views/`, `scripts/`, `.github/workflows/`, `data/` (listing only, not content, for gitignore status) — all read directly from the live repository on 2026-09-10, cross-checked against RESEARCH.md/CONTEXT.md's own citations (several line-number drifts found and corrected above; see `detail-sections.ts` and `detail-best-efforts-logic.ts` notes).
**Files scanned (read in full or via targeted grep+offset):** `src/analytics/compute-best-efforts.ts` (348, whole), `src/analytics/best-effort-utils.ts` (222, whole), `src/analytics/best-effort.types.ts` (162, whole), `src/analytics/best-effort-exclusions.ts` (102, whole), `src/dashboard/views/detail-best-efforts-logic.ts` (190, whole), `src/dashboard/views/detail-sections.ts` (1215, targeted: 1-40, 620-745), `src/dashboard/views/records.ts` (1084, targeted: 1-40, 330-600), `src/dashboard/views/records-logic.ts` (380, targeted: 1-60, 95-260), `src/compute-all-stats-steps.ts` (254, whole), `.github/workflows/daily-refresh.yml` (grep only), `scripts/compute-pace-residual.mjs` (390, whole), `scripts/compute-pace-quality-recount.mjs` (283, whole), `src/analytics/compute-best-efforts.test.ts` (grep + targeted: 1-45, 203-335, 500-560).
**Pattern extraction date:** 2026-09-10
