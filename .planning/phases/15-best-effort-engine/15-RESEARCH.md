# Phase 15: Best-Effort Engine - Research

**Researched:** 2026-08-10
**Domain:** Pure backend time-series computation (sliding-window best-effort extraction) over an already-locked stream schema, in a static-hosting TypeScript pipeline
**Confidence:** HIGH

## Summary

Phase 15 is algorithmically well-defined and low-risk: the two-pointer sweep, native-distance/timestamp-indexed duration, and storage-split decisions were already locked in the v2.0 roadmap research (`.planning/research/SUMMARY.md`, `PITFALLS.md` Pitfalls 1-3) and carried forward verbatim into `15-CONTEXT.md`'s D-01/D-02. Nothing in this phase requires new libraries, new architectural concepts, or external services — it is a pure-function computation module plus a thin I/O orchestration layer, following exactly the `streak-utils.ts` (pure logic) + `compute-advanced-stats.ts` (I/O orchestration) split this repo already uses. Phase 14's `CanonicalStream` schema (`src/streams/stream.types.ts`) is locked and provides everything the sweep needs: non-decreasing `d` (cumulative meters, native or geo-reconstructed) and `t` (seconds since first sample, real gaps preserved) arrays, plus a `distanceSource` flag that maps directly onto D-03's `lowConfidence` output field.

Direct inspection of the real committed data (not assumption) confirms every numeric claim CONTEXT.md's decisions depend on: 1,842 of 1,867 run activities have available streams (38 `geo`-sourced, 1,804 `native`-sourced — exactly matching D-03's "38 activities" claim); `max_speed` is present on the `StravaActivity` type as a required field, but empirically 26 of 1,867 run activities have it as `0`/falsy — of those, only **1** activity actually has an available stream and will reach the best-effort sweep, so D-04's sanity guard needs an explicit "`max_speed` unavailable → skip that half of the guard, rely on the world-record ceiling alone" branch, not a hard requirement that it be present and non-zero. This is a concrete, previously-undocumented edge case worth a dedicated unit test.

**Primary recommendation:** Implement as two new modules under `src/analytics/`: a pure `best-effort-utils.ts` (two-pointer sweep, interpolation, pre-filter, implausibility guards — colocated `*.test.ts`, TDD per CONTEXT's own note that this is "the same class of problem" as streak detection) and an I/O-orchestrating `compute-best-efforts.ts` (reads `data/streams/manifest.json` + `data/streams/<id>.json` + `data/activities/<id>.json`, calls the pure functions, writes `data/stats/best-efforts.json`), wired into `computeAllStatsCommand()` in `src/index.ts` exactly like `compute-advanced-stats` already is.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read committed stream + activity JSON | API/Backend | Database/Storage | `data/streams/`, `data/activities/` are the on-disk "database" for this static pipeline; reads happen inside the Node CLI compute step, not a server |
| Two-pointer best-effort sweep + interpolation | API/Backend | — | Pure CPU computation, no I/O; this is the phase's core deliverable |
| Implausibility guards (max_speed, world-record pace) | API/Backend | — | Pure validation logic co-located with the sweep |
| Write `data/stats/best-efforts.json` | Database/Storage | API/Backend | Gitignored derived-aggregate write, same role as existing `data/stats/*.json` outputs |
| CI wiring (`daily-refresh.yml`, `compute-all-stats` chain) | API/Backend | — | Pipeline orchestration, not a new architectural tier |
| Validation fixtures (reference PR values) | API/Backend (tests) | — | Test-only; no UI, no browser tier touched this phase |

No Browser/Client, Frontend Server, or CDN/Static capability exists in this phase's scope — UI consumption is explicitly deferred to Phases 16-18 per `15-CONTEXT.md`'s Phase Boundary.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Algorithm (locked upstream — carried forward from v2.0 research + ROADMAP success criteria, not re-discussed)**
- **D-01:** Two-pointer O(n) sweep per target distance exploiting monotonic cumulative distance; linear time interpolation at the exact target-distance crossing (never snap to the next sample — that biases results slow by up to one sample interval). Pre-filter: skip an activity for a target when `activity.distance < target * 0.99`.
- **D-02:** Use the committed stream's `d` array (native distance where `distanceSource: 'native'`) and `timestamp[j] - timestamp[i]` durations from the `t` array. Never haversine-recompute, never index-count. Pause gaps in `t` are therefore handled correctly by construction.

**Low-confidence (geo-distance) streams**
- **D-03:** The 38 activities with `distanceSource: 'geo'` (haversine-reconstructed, phone GPX) get **all seven distances computed**, with each resulting effort marked `lowConfidence: true`. They remain in PR contention; UI phases can badge or filter. Nothing is silently excluded.

**Implausibility guards**
- **D-04:** Sanity checks per effort: implied pace must not exceed the activity's own `max_speed` (from the canonical activity record), and must not beat world-record pace for that distance. A failing effort is **dropped** (the activity's other distances survive) and every rejection is listed with its reason in the compute step's console summary. The step never fails CI — consistent with the repo's non-blocking convention.

**Validation (success criterion 3)**
- **D-05:** Pin ~5-10 reference activities as test fixtures — mixed sources (FIT, GPX, intervals.icu), including at least one race — with expected best-effort times manually read from Strava/Garmin Connect's own computed best efforts. Assert within ~1-2% tolerance. The user will need to supply/confirm the Strava-reported values for the chosen fixture activities during execution (a checkpoint, or a documented lookup step).

**Output contract**
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

### Deferred Ideas (OUT OF SCOPE)

**Reviewed Todos (not folded)**
- Garmin export adapter when export arrives (`.planning/todos/pending/2026-08-10-garmin-export-adapter-when-export-arrives.md`) — weak match, already reviewed and deferred as STREAM-04 in Phase 14. Unrelated to best-effort computation.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REC-01 | Pipeline computes best efforts (fastest 400m, 1k, 1mi, 5k, 10k, half, marathon) within every run from streams | Architecture Patterns (two-pointer sweep + interpolation), Code Examples, Don't Hand-Roll, Common Pitfalls, Validation Architecture sections below cover the full algorithm, guard, and test strategy needed to implement this requirement end-to-end |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

No `./CLAUDE.md` exists in this repository — no project-level directives to enforce beyond the patterns already established in the codebase (documented throughout this file) and the locked decisions in `15-CONTEXT.md` above. No `.claude/skills/` or `.agents/skills/` directory exists either.

## Standard Stack

### Core

No new npm packages. `[VERIFIED: package.json + direct repo inspection]` — this phase is pure TypeScript (already `^5.9.3`) running on Node 22, reusing `FileStore` (`src/storage/file-store.ts`) for atomic JSON I/O and Vitest `^4.0.18` (already a devDependency) for tests. This matches the v2.0 roadmap research's explicit call-out: "Uses: Pure TS, no new dependencies" for the best-effort phase (`.planning/research/SUMMARY.md` line 83).

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 (installed) | Implementation language | Already the pipeline's only language |
| Vitest | 4.0.18 (installed) | Unit + fixture-validation tests | Already the pipeline's only test framework; colocated `*.test.ts` convention already established in `src/streams/` and `src/analytics/` |
| (none — `FileStore`) | n/a, internal | Atomic JSON read/write | `src/storage/file-store.ts` already provides temp-file-then-rename writes and typed `readJson`; reused by `stream-manifest.ts`, `intervals-sync.ts` |

### Supporting

None required.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Two-pointer O(n) sweep | Brute-force nested loop, or `O(n log n)` binary-search-per-start-index | Both rejected in the v2.0 roadmap research (`PITFALLS.md` Pitfall 2) — brute force risks the 30-minute CI timeout at ~1,850 activities × 7 target distances; binary search is unnecessary complexity when the monotonic two-pointer invariant already gives true O(n) |
| Linear interpolation at the target-distance crossing | Snap to nearest/next sample | Snapping biases every result slow by up to one sample interval — locked out by D-01 explicitly, and by decimated streams' 1-3s spacing (see Common Pitfalls below) this bias would be larger than on raw 1Hz data |

**Installation:**
```bash
# No installation required — zero new dependencies.
```

**Version verification:** Not applicable — no new packages. `typescript@5.9.3` and `vitest@4.0.18` are already installed and already the versions the rest of the codebase (including Phase 14's just-landed streams work) depends on; confirmed via direct `package.json` read, not assumed.

## Package Legitimacy Audit

**Not applicable.** This phase introduces zero external packages — verified against `.planning/research/SUMMARY.md`'s explicit "Uses: Pure TS, no new dependencies" call-out for this exact phase, and confirmed by this phase's own scope (a pure computation module plus I/O reusing the already-installed `FileStore`). The Package Legitimacy Gate protocol (slopcheck, registry checks) is skipped entirely — there is nothing to audit. If a future replan introduces any package (e.g., a date/formatting library), re-run the gate at that time.

## Architecture Patterns

### System Architecture Diagram

```
data/activities/<id>.json  ─┐
  (distance, max_speed,     │
   start_date — canonical    │
   activity record)          │
                              ▼
data/streams/manifest.json ──►  compute-best-efforts.ts (I/O orchestration)
  (which ids have streams,        │
   distanceSource per id)          │  for each available id:
                                    │   1. pre-filter by activity.distance
data/streams/<id>.json ───────────►│      vs each of 7 targets (D-01)
  (t[], d[], distanceSource)       │   2. read stream JSON
                                    │   3. call pure sweep per surviving target
                                    ▼
                          best-effort-utils.ts (pure functions)
                            - findBestEffort(t, d, targetMeters)
                              → two-pointer sweep + interpolation
                            - isPlausible(effort, maxSpeedMps)
                              → max_speed guard + world-record guard
                                    │
                                    ▼
                          compute-best-efforts.ts (continued)
                            - drop implausible efforts, log reasons
                            - assign lowConfidence from distanceSource
                            - sort per-distance results chronologically,
                              stamp was-PR-at-the-time
                            - derive top-N ranking per distance
                                    │
                                    ▼
                     data/stats/best-efforts.json (gitignored, D-06)
                                    │
                                    ▼
                  Phase 18 (records/PR views) — reads only, never recomputes
```

### Recommended Project Structure

```
src/analytics/
├── best-effort-utils.ts       # NEW — pure: sweep, interpolation, guards, PR/ranking logic
├── best-effort-utils.test.ts  # NEW — colocated, TDD-first per CONTEXT's own guidance
├── compute-best-efforts.ts    # NEW — I/O orchestration, mirrors compute-advanced-stats.ts shape
├── compute-best-efforts.test.ts  # NEW — fixture validation (D-05), against real committed data
├── compute-stats.ts           # existing, unmodified
├── compute-advanced-stats.ts  # existing, unmodified
├── streak-utils.ts            # existing — the direct analog for best-effort-utils.ts's role
└── date-utils.ts              # existing, unmodified
```

**Why this split:** `streak-utils.ts` (pure) + `compute-advanced-stats.ts` (I/O, calls `calculateDailyStreaks`/`calculateWeeklyConsistency`) is the closest existing analog in this exact codebase for "complex edge-case pure logic consumed by an I/O orchestration file" — `15-CONTEXT.md`'s own Established Patterns section calls this out explicitly ("best-effort sweep is the same class of problem"). Reusing that split (rather than inlining the sweep into `compute-best-efforts.ts` the way `compute-stats.ts` inlines its simpler aggregation loops) keeps the two-pointer/interpolation/guard logic independently unit-testable without any file I/O, matching the TDD approach CONTEXT recommends.

### Pattern 1: Two-pointer monotonic sweep with exact-crossing interpolation

**What:** For each target distance, advance a start pointer `i` across the (non-decreasing) `d` array; for each `i`, advance an end pointer `j` (never resetting backward) until `d[j] - d[i] >= target`; interpolate the exact time the target distance was crossed between `t[j-1]` and `t[j]`; track the minimum such duration across all `i`.
**When to use:** Exactly once per (activity, target distance) pair inside `best-effort-utils.ts`'s core `findBestEffort`.
**Example:**
```typescript
// Source: derived directly from CONTEXT.md D-01 + .planning/research/PITFALLS.md Pitfall 2
// (two-pointer sweep + "interpolate at the exact target-distance crossing" requirement)
export interface RawEffort {
  durationSec: number;   // interpolated, timestamp-indexed
  startOffsetSec: number;
  endOffsetSec: number;  // interpolated
}

export function findBestEffort(
  t: number[],
  d: number[],
  targetMeters: number
): RawEffort | undefined {
  const n = t.length;
  if (n < 2 || d[n - 1] - d[0] < targetMeters) return undefined;

  let best: RawEffort | undefined;
  let j = 0;

  for (let i = 0; i < n; i++) {
    if (j < i + 1) j = i + 1; // pointer only ever moves forward (Pitfall 2)
    while (j < n && d[j] - d[i] < targetMeters) j++;
    if (j >= n) break; // no window starting at i (or later) reaches target

    // Linear interpolation at the exact crossing — never snap to d[j]/t[j]
    // (D-01: snapping biases every result slow by up to one sample interval).
    const segMeters = d[j] - d[j - 1];
    const needed = targetMeters - (d[j - 1] - d[i]);
    const frac = segMeters > 0 ? needed / segMeters : 0;
    const crossingTime = t[j - 1] + frac * (t[j] - t[j - 1]);

    const durationSec = crossingTime - t[i];
    if (durationSec > 0 && (!best || durationSec < best.durationSec)) {
      best = { durationSec, startOffsetSec: t[i], endOffsetSec: crossingTime };
    }
  }
  return best;
}
```

### Pattern 2: Pre-filter before loading/scanning a stream (D-01)

**What:** Skip an activity for a given target distance using only the already-in-memory canonical `activity.distance` field, before the (potentially large) stream file is even read.
**When to use:** In `compute-best-efforts.ts`'s per-activity loop, before calling `findBestEffort`.
**Example:**
```typescript
// Source: CONTEXT.md D-01 — "Pre-filter: skip an activity for a target when
// activity.distance < target * 0.99"
const TARGET_METERS = {
  '400m': 400,
  '1k': 1000,
  '1mi': 1609.344,
  '5k': 5000,
  '10k': 10000,
  'half': 21097.5,
  'marathon': 42195,
} as const;

const eligibleTargets = Object.entries(TARGET_METERS).filter(
  ([, target]) => activity.distance >= target * 0.99
);
if (eligibleTargets.length === 0) continue; // skip loading the stream entirely
```

### Pattern 3: `max_speed`-missing-safe implausibility guard (D-04, empirically discovered edge case)

**What:** The guard has two independent checks (own `max_speed`, world-record pace); `max_speed` must degrade gracefully when it is `0`/falsy rather than treating "implied speed > 0" as an automatic rejection.
**When to use:** `isPlausible()` in `best-effort-utils.ts`.
**Example:**
```typescript
// Source: empirical finding this session — `python3` audit of data/activities/*.json
// found max_speed is 0/missing on 26/1867 run activities; of those, exactly 1 has an
// available stream (id 11865310195) and will actually reach this guard.
export function isPlausible(
  impliedSpeedMps: number,
  activityMaxSpeedMps: number | undefined,
  worldRecordSpeedMps: number
): { ok: true } | { ok: false; reason: string } {
  if (activityMaxSpeedMps && impliedSpeedMps > activityMaxSpeedMps * MAX_SPEED_MARGIN) {
    return { ok: false, reason: `implied ${impliedSpeedMps.toFixed(2)} m/s exceeds activity max_speed ${activityMaxSpeedMps} m/s` };
  }
  if (impliedSpeedMps > worldRecordSpeedMps) {
    return { ok: false, reason: `implied ${impliedSpeedMps.toFixed(2)} m/s exceeds world-record pace ${worldRecordSpeedMps.toFixed(2)} m/s` };
  }
  return { ok: true };
}
```

### Pattern 4: was-PR-at-the-time marker (D-06)

**What:** After computing all efforts for one target distance across the whole archive, sort chronologically by the activity's `start_date` and stamp each effort with whether it improved on the best time seen so far.
**When to use:** Once per target distance, after all per-activity sweeps for that distance are collected, before writing `best-efforts.json`.
**Example:**
```typescript
// Source: CONTEXT.md D-06 — "A was-PR-at-the-time marker per effort (enables
// REC-03 evolution views and REC-04 badges without recomputation)."
interface DatedEffort { activityId: string; startDate: string; durationSec: number; }

function markPRs(effortsForDistance: DatedEffort[]): (DatedEffort & { wasPR: boolean })[] {
  const chronological = [...effortsForDistance].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  let bestSoFar = Infinity;
  return chronological.map((effort) => {
    const wasPR = effort.durationSec < bestSoFar;
    if (wasPR) bestSoFar = effort.durationSec;
    return { ...effort, wasPR };
  });
}
```

### Anti-Patterns to Avoid

- **Re-deriving distance from `lat`/`lng`:** The committed `CanonicalStream` (Phase 14) carries no position data at all — only `t`/`d` (and optional `hr`/`cadence`/`alt`). There is nothing to haversine-recompute from even if someone tried; this anti-pattern is structurally prevented by the locked schema, not just a coding-discipline reminder.
- **Resetting the `j` pointer per `i`:** Reintroduces O(n²) complexity (Pitfall 2). The two-pointer invariant only holds if `j` never moves backward across the whole activity, not just within one `i`.
- **Treating a dropped/implausible effort as "the activity has no valid efforts":** D-04 requires per-target rejection — one distance failing the guard must not remove the activity's other six distances' results.
- **Recomputing `data/stats/best-efforts.json` inputs from `export_data/`:** `export_data/` is gitignored and CI-inaccessible (per v2.0 `ARCHITECTURE.md` Anti-Pattern 1); this phase only ever reads the already-committed `data/streams/<id>.json` and `data/activities/<id>.json`, never the raw FIT/GPX originals.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic JSON writes to `data/stats/best-efforts.json` | A second temp-file-then-rename primitive | `FileStore.writeJson` (`src/storage/file-store.ts`) | Already handles the temp-file/rename/cleanup-on-error dance; reused by `stream-manifest.ts` and `intervals-sync.ts` already |
| Reading which activities have streams | Globbing `data/streams/*.json` and inferring availability from file existence | `data/streams/manifest.json` (via `loadManifest` in `src/streams/stream-manifest.ts`) | The manifest is the single source of truth per Phase 14's D-04 and already encodes `distanceSource`/`channels`/unavailability-reason — globbing would silently miss the "why 25 activities have no stream" distinction the manifest already computed |
| Best-effort sliding-window search | Any `O(n²)` or `O(n log n)` formulation | The two-pointer O(n) sweep (Pattern 1 above) | Already the locked, research-validated algorithm; a fresh implementation of a "smarter" search is solving an already-solved problem with more risk of a subtle bug |
| World-record reference data | Hard-coding untraceable numbers | A small constants table with inline source citations (see Code Examples below) | Records change (this session's research found three record changes reported in 2026 alone — mile, half marathon, marathon); an un-cited magic number is unmaintainable |

**Key insight:** Every piece of infrastructure this phase needs to *read* (streams, manifest, activities) already exists and is already correctly abstracted from Phase 14; the only genuinely new code is the sweep itself and its two guards, which is exactly the surface area D-05's fixture-based validation is designed to exercise.

## Common Pitfalls

### Pitfall 1: Recomputing distance from raw lat/lng instead of native distance
**What goes wrong:** Best-effort splits computed against a haversine-summed distance instead of the stream's own `d` array produce phantom PRs at short distances (400m/1k) because raw GPS points jitter even when stationary, breaking the monotonicity a sliding window assumes.
**Why it happens:** Structurally prevented in this phase — the committed `CanonicalStream` carries no `lat`/`lng` at all (Phase 14 explicitly excluded position data, see `stream.types.ts`'s doc comment). The only way to reintroduce this bug is to bypass the stream file and read something else.
**How to avoid:** Only ever read `stream.d` / `stream.t`; never touch `data/activities/<id>.json`'s `map.summary_polyline` or geo files for distance/time.
**Warning signs:** Any import of geo/polyline-decoding code inside `best-effort-utils.ts`.
**Phase to address:** This phase (already structurally mitigated by Phase 14's schema).

### Pitfall 2: O(n²) best-effort search
**What goes wrong:** A naive nested loop over ~1,842 streamed activities × 7 targets risks the 30-minute CI timeout (`.github/workflows/daily-refresh.yml` `timeout-minutes: 30`).
**Why it happens:** The brute-force formulation ("for every start, scan forward") is the obvious first draft.
**How to avoid:** Use Pattern 1's two-pointer sweep, verified O(n) per target per activity; combine with Pattern 2's pre-filter (most runs are shorter than half the target list, eliminating most work before a stream file is even opened).
**Warning signs:** `compute-best-efforts` step wall-clock time scaling with total stream points × target count rather than staying near-linear.
**Phase to address:** This phase.

### Pitfall 3: Index-based duration instead of timestamp-based
**What goes wrong:** Computing duration as `(j - i)` array-index deltas instead of `t[j] - t[i]` produces impossible splits across any paused/auto-lap activity, since Phase 14's decimated streams preserve real timestamp gaps rather than assuming constant sample spacing.
**Why it happens:** Assuming uniform sampling is a reasonable-looking simplification until it silently breaks on a subset of activities.
**How to avoid:** `findBestEffort` (Pattern 1) already indexes exclusively by `t[]`; never introduce a parallel "assume 1s between samples" shortcut anywhere in the sweep.
**Warning signs:** Best-effort paces faster than the activity's own `max_speed`; this is exactly what D-04's guard is designed to catch as a second line of defense, not the primary correctness mechanism.
**Phase to address:** This phase.

### Pitfall 4: Decimated stream spacing biasing short-effort interpolation `[VERIFIED: src/streams/derive-stream.ts DECIMATION_LADDER + direct sample inspection]`
**What goes wrong:** Phase 14's committed streams are decimated to a minimum 1-3s sample spacing (`DECIMATION_LADDER = [1, 2, 3]`, capped at `MAX_SAMPLES = 3000`; confirmed by directly inspecting `data/streams/3475707975.json`, whose `t` array steps by 2-5s). Linear interpolation between two samples assumes locally uniform pace across that gap; for a 400m/1k effort that happens to fall on a segment with genuinely non-uniform pace within the gap (e.g., a brief surge inside an easy run, sampled at the coarser end of the ladder), the interpolated crossing time carries a small bias the raw device's own (much higher internal sample rate) computation wouldn't have.
**Why it happens:** This is an inherent, already-locked tradeoff from Phase 14's repo-bloat mitigation (`PITFALLS.md` Pitfall 6), not something Phase 15 can fix — the committed data simply doesn't carry the original 1Hz+ resolution.
**How to avoid:** Cannot be eliminated; must be *accounted for* in D-05's fixture tolerance (the CONTEXT-specified ~1-2% tolerance is generous enough to absorb this) and explicitly represented in the fixture set — deliberately include at least one short-effort (400m or 1k) fixture, not only longer races, so the tolerance band is validated against the case most sensitive to decimation.
**Warning signs:** A fixture's computed 400m/1k time differs from Strava's by more than the tolerance band while 5k+ efforts on the same activity match closely — indicates the bias is decimation-driven, not an algorithm bug.
**Phase to address:** This phase (test/validation design), root cause already accepted in Phase 14.

### Pitfall 5: `max_speed` unavailable/zero for a small subset of streamed activities `[VERIFIED: data/activities/*.json audit this session]`
**What goes wrong:** 26 of 1,867 run activities have `max_speed` as `0` or missing; a naive guard (`if (impliedSpeed > activity.max_speed) reject`) would reject every effort on those activities outright (since any positive implied speed exceeds 0), not just implausible ones.
**Why it happens:** `max_speed` is typed as a required `number` on `StravaActivity` but its actual population depends on the source provider (Strava API vs. intervals.icu vs. manual entry); it isn't guaranteed non-zero in practice.
**How to avoid:** Only apply the `max_speed` half of the guard when the value is truthy (`> 0`); when absent/zero, rely solely on the world-record ceiling. Of the 26 affected activities, only 1 (`11865310195`) has an available stream and will actually reach this code path — write a unit test for exactly this case.
**Warning signs:** All best-effort results silently missing for an activity whose stream is otherwise valid.
**Phase to address:** This phase.

### Pitfall 6: Treating a dropped effort as invalidating the whole activity
**What goes wrong:** If the implausibility guard rejects one target distance's effort (e.g., a bad 400m due to a GPS/timestamp anomaly localized to one segment), an implementation that bails out of the whole per-activity loop on the first rejection silently loses the activity's other six (otherwise valid) distances.
**Why it happens:** Easy to structure the per-activity loop as "compute all seven, if any fails throw" rather than per-target isolation.
**How to avoid:** D-04 requires each target distance to be independently computed, guarded, and (if it fails) dropped — mirror the codebase's established non-blocking, per-item failure isolation pattern (`src/sync/intervals-sync.ts:109-126`, `src/exports/consolidate.ts:201-217`) at the per-target-distance granularity, not just per-activity.
**Warning signs:** An activity's PR list missing distances it should plausibly have, correlated with console warnings about a *different* distance on the same activity.
**Phase to address:** This phase.

## Code Examples

### World-record pace reference table (Claude's Discretion, D-04 exact values)
```typescript
// Source: WebSearch this session, cross-referenced against multiple results
// (World Athletics official reports for the most recent 2026 changes; see Sources).
// Speeds in m/s = target meters / current world-record seconds. Table intentionally
// uses the men's absolute record per distance as the ceiling (gender-agnostic upper
// bound; the guard only needs to reject *impossible* efforts, not model a specific
// athlete class). NOTE: several of these changed within 2026 itself (mile, half
// marathon) — comment includes the date so a future maintainer knows to re-check.
export const WORLD_RECORD_SPEED_MPS: Record<string, number> = {
  '400m': 400 / 43.03,        // Wayde van Niekerk, 43.03s (2016)
  '1k': 1000 / 131.96,        // Noah Ngeny, 2:11.96 world best (1999)
  '1mi': 1609.344 / 222.66,   // Josh Kerr, 3:42.66 (London Diamond League, Jul 2026)
  '5k': 5000 / 755.36,        // Joshua Cheptegei, 12:35.36 (2020)
  '10k': 10000 / 1591,        // Yomif Kejelcha, 26:31 (2025)
  'half': 21097.5 / 3440,     // Jacob Kiplimo, 57:20 (Lisbon Half, Feb 2026)
  'marathon': 42195 / 7235,   // Kelvin Kiptum, 2:00:35 (2023, ratified) — see Open
                               // Questions re: Sawe's unratified 1:59:30 (London 2026)
};

/** Multiplier applied to an activity's own max_speed before rejecting an effort —
 * absorbs rounding/interpolation noise (Pattern 3's `MAX_SPEED_MARGIN`). Exact
 * value is Claude's Discretion per CONTEXT.md; 1.02 (2%) matches D-05's own
 * fixture tolerance band for consistency. */
export const MAX_SPEED_MARGIN = 1.02;
```

### Fixture-based validation harness shape (D-05)
```typescript
// Source: CONTEXT.md D-05 — pin ~5-10 reference activities, assert within ~1-2%
// tolerance against user-supplied Strava/Garmin values.
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Strava/Garmin device-side best-effort computation (proprietary, high-frequency internal sampling, opaque algorithm) | This phase's own two-pointer sweep over Phase 14's decimated (1-3s), native-distance, timestamp-indexed streams | This phase (new capability) | Self-computed results are the source of truth for this project going forward (`data/stats/best-efforts.json`); Strava/Garmin values are used only as the D-05 *validation reference*, within a tolerance band that explicitly accounts for the decimation gap (Pitfall 4) |
| Recomputing everything from `export_data/` originals per feature | Reading only the already-derived, already-committed `data/streams/`/`data/activities/` | Locked in Phase 14 (v2.0 `ARCHITECTURE.md` Anti-Pattern 1) | This phase never touches `export_data/`; it is CI-safe by construction since it only reads committed files |

**Deprecated/outdated:** Not applicable — this is greenfield computation with no prior implementation in this codebase to deprecate (confirmed via `grep -rn "best.effort\|bestEffort" src/` returning zero matches).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact world-record times/paces (400m through marathon) as of this research session | Code Examples (World-record pace reference table) | Low — the guard only needs to be a generous outer ceiling far beyond any personal recreational effort; a stale record by a few seconds does not change whether a computed effort is a "computation bug" (thousands of m/s) vs. plausible. Marathon specifically uses the older ratified 2:00:35 record rather than the newer, pending-ratification 1:59:30 — flagged explicitly in Open Questions below |
| A2 | Recommended module split (`best-effort-utils.ts` pure + `compute-best-efforts.ts` I/O) and file location under `src/analytics/` | Architecture Patterns | Low — CONTEXT.md explicitly left this to Claude's Discretion ("Whether the compute step is wired into the existing compute-all-stats chain or a sibling command"); the recommendation is a strong pattern-match to `streak-utils.ts`/`compute-advanced-stats.ts` but the planner could reasonably choose `src/streams/` instead given the sweep reads `CanonicalStream` directly |
| A3 | Recommended top-N size (not fixed in this research — deliberately left as a planner decision) | User Constraints (Claude's Discretion) | Low — purely a display/storage-size tradeoff, easy to change later since `best-efforts.json` is gitignored and regenerated every run |
| A4 | `MAX_SPEED_MARGIN = 1.02` (2%) as the max_speed guard's tolerance | Code Examples | Low-Medium — too tight risks false-rejecting genuine near-max-effort splits (interpolation/decimation noise per Pitfall 4); too loose risks missing real computation bugs. Should be tuned against D-05's fixture set during implementation, not treated as final |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Exact Strava/Garmin-reported best-effort values for the chosen fixture activities (D-05)**
   - What we know: The tolerance band (~1-2%) and fixture count (5-10, mixed source, at least one race) are locked; the algorithm and guard logic are implementable without these values.
   - What's unclear: The actual reference numbers, which only exist in the user's Strava/Garmin Connect account and cannot be looked up by an agent.
   - Recommendation: Planner should insert an explicit `checkpoint:human-verify` (or documented manual lookup step) before the fixture test suite can be finalized — candidate activities should be selected first (e.g., by scanning `data/activities/*.json` `name` fields for race-like keywords, cross-referenced against `data/streams/manifest.json` for `source: 'fit' | 'gpx' | 'intervals'` diversity), then presented to the user for the Strava-value lookup, per CONTEXT's own Claude's Discretion note.

2. **Marathon world-record reference value: ratified 2:00:35 vs. unratified/pending 1:59:30**
   - What we know: This session's WebSearch surfaced a reported sub-2-hour marathon (Sabastian Sawe, London 2026, 1:59:30) explicitly described as "pending ratification," alongside the previously-ratified Kelvin Kiptum 2:00:35 (2023).
   - What's unclear: Whether the pending record will be ratified by the time this phase ships, and whether World Athletics' official record page reflects it.
   - Recommendation: Use the ratified 2:00:35 as the guard ceiling (more conservative — rejects more, which is the safer direction for a sanity guard) and treat the table as easily updatable (all values are named constants with inline citations, not embedded magic numbers) rather than blocking implementation on this ambiguity.

3. **Does `data/streams/manifest.json`'s `distanceSource: 'geo'` map 1:1 onto every activity that should get `lowConfidence: true`, or could a `native`-sourced stream still warrant lower confidence in edge cases (e.g., very old/low-sample-rate FIT files)?**
   - What we know: D-03 ties `lowConfidence` directly to `distanceSource === 'geo'`, and this is a clean, already-computed flag requiring no new logic.
   - What's unclear: Whether some `native` streams (e.g., older devices with sparse `distance` field population, silently carried-forward by Phase 14's `carryForward()` gap-filling) deserve the same flag. This is out of this phase's locked scope per D-03's explicit wording ("distinguish native from recomputed distance rather than silently mixing the two provenances" — a binary split, not a graduated confidence score).
   - Recommendation: Implement exactly as D-03 specifies (binary flag from `distanceSource`); if sparse-native-stream quality turns out to be a real problem, it's a Phase 14 data-quality issue to revisit separately, not something Phase 15's guard should try to detect heuristically.

## Environment Availability

Skipped — this phase has no external dependencies beyond the already-installed, already-verified Node/TypeScript/Vitest toolchain this entire repository already runs on (confirmed present and current via direct `package.json` inspection). No new service, CLI tool, or runtime is introduced.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (installed, `vitest.config.ts` present) |
| Config file | `vitest.config.ts` (`include: ['src/**/*.test.ts']`, `environment: 'node'`, `globals: true`) |
| Quick run command | `npx vitest run src/analytics/best-effort-utils.test.ts src/analytics/compute-best-efforts.test.ts` |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REC-01 | Two-pointer sweep finds the minimum-duration window for a target distance, interpolating the exact crossing | unit | `npx vitest run src/analytics/best-effort-utils.test.ts -t "findBestEffort"` | ❌ Wave 0 |
| REC-01 | Pause/timestamp-gap activities produce correct (not index-biased) durations | unit | `npx vitest run src/analytics/best-effort-utils.test.ts -t "timestamp"` | ❌ Wave 0 |
| REC-01 | Pre-filter skips activities shorter than `target * 0.99` without reading the stream | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "pre-filter"` | ❌ Wave 0 |
| REC-01 | `max_speed` guard rejects an implausible effort but not others on the same activity | unit | `npx vitest run src/analytics/best-effort-utils.test.ts -t "isPlausible"` | ❌ Wave 0 |
| REC-01 | `max_speed` absent/zero (activity `11865310195`) degrades to world-record-only guard instead of rejecting everything | unit | `npx vitest run src/analytics/best-effort-utils.test.ts -t "max_speed unavailable"` | ❌ Wave 0 |
| REC-01 | `distanceSource: 'geo'` activities get `lowConfidence: true` on every computed effort | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "lowConfidence"` | ❌ Wave 0 |
| REC-01 | was-PR-at-the-time marker correctly reflects chronological improvement per distance | unit | `npx vitest run src/analytics/best-effort-utils.test.ts -t "markPRs"` | ❌ Wave 0 |
| REC-01 | Fixture activities' computed best efforts match user-supplied Strava/Garmin values within ~2% tolerance | integration (fixture) | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "fixture"` | ❌ Wave 0 — blocked on user-supplied reference values (Open Question 1) |
| REC-01 | Output written to `data/stats/best-efforts.json` matches D-06's schema shape | integration | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "writes best-efforts.json"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/analytics/best-effort-utils.test.ts src/analytics/compute-best-efforts.test.ts` (quick, isolated to this phase's new files)
- **Per wave merge:** `npm test` (full suite — guards against regressing `streak-utils`/`compute-advanced-stats`/`derive-stream` tests, which share no code but do share the `data/activities`/`data/streams` fixtures conventions)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/analytics/best-effort-utils.ts` + `.test.ts` — new pure module, does not exist yet
- [ ] `src/analytics/compute-best-efforts.ts` + `.test.ts` — new I/O orchestration module, does not exist yet
- [ ] Fixture reference data (5-10 activities' Strava/Garmin-reported best-effort times) — requires a `checkpoint:human-verify` task; cannot be automated (Open Question 1)
- [ ] No framework install needed — Vitest already configured and used identically by `src/streams/*.test.ts`

## Security Domain

This phase is a local/CI batch-compute step over already-committed, already-trusted JSON files (no network calls, no user input, no authentication surface). Most ASVS categories don't apply; the one relevant control is input validation on data this phase treats as untrusted-until-checked (stream/activity JSON could in principle be malformed if hand-edited or corrupted).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface — local/CI file-based computation only |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A — single-user personal pipeline, no multi-tenant concern |
| V5 Input Validation | Yes | Treat every numeric field read from `data/streams/<id>.json` and `data/activities/<id>.json` as untrusted: guard against `NaN`/`Infinity`/negative durations before writing to `best-efforts.json` (the `durationSec > 0` check in Pattern 1's `findBestEffort` is this control in practice; extend the same discipline to `d`/`t` array length mismatches) |
| V6 Cryptography | No | N/A — no secrets, no crypto operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/corrupted `data/streams/<id>.json` (e.g., truncated write, manual edit) crashing the whole `compute-all-stats` chain | Denial of Service (availability) | Wrap each activity's read+sweep in the codebase's established per-item try/catch (`src/sync/intervals-sync.ts:109-126` pattern) — one bad file warns and is skipped, never aborts the ~1,842-activity run, consistent with the repo's non-blocking convention and D-04's "never fails CI" requirement |
| A future upstream bug in Phase 14's derivation writing non-monotonic `d` arrays | Tampering (data integrity, not malicious) | `findBestEffort`'s pre-condition (`d[n-1] - d[0] < targetMeters` early return) does not itself validate monotonicity; add a defensive assertion/guard that logs and skips an activity whose `d` array is ever observed to decrease, rather than silently producing a nonsensical negative-duration effort |

## Sources

### Primary (HIGH confidence)
- Direct repo inspection: `src/streams/stream.types.ts`, `src/streams/derive-stream.ts`, `src/streams/stream-manifest.ts`, `src/analytics/compute-stats.ts`, `src/analytics/compute-advanced-stats.ts`, `src/analytics/streak-utils.ts`, `src/storage/file-store.ts`, `src/index.ts`, `src/types/strava.types.ts`, `src/types/analytics.types.ts`, `.github/workflows/daily-refresh.yml`, `package.json`, `.gitignore`, `vitest.config.ts`
- Direct data inspection (this session, via Python one-liners against the real committed archive): `data/streams/manifest.json` (1,842/1,867 available, 38 `geo`/1,804 `native` — confirms D-03's "38 activities" claim exactly), `data/streams/3475707975.json` (real decimated `t`/`d` sample spacing, 2-5s), `data/activities/*.json` full sweep (26/1,867 run activities with `max_speed` falsy; only 1 of those, `11865310195`, has an available stream)
- `.planning/phases/15-best-effort-engine/15-CONTEXT.md` — this phase's locked decisions (D-01 through D-06)
- `.planning/research/SUMMARY.md`, `PITFALLS.md`, `ARCHITECTURE.md` — v2.0 roadmap research, Pitfalls 1/2/3/10/11, Architecture component 4, all directly re-verified against the now-real Phase 14 output rather than taken on faith
- `.planning/phases/14-stream-ingestion-foundation/14-PATTERNS.md` — established codebase patterns this phase should extend (non-blocking failure isolation, atomic writes, CLI wiring, colocated tests)
- `.planning/REQUIREMENTS.md` — REC-01 definition and traceability table

### Secondary (MEDIUM confidence)
- World Athletics / news reporting on 2026 record changes (Josh Kerr mile 3:42.66, Jacob Kiplimo half marathon 57:20, Sabastian Sawe marathon 1:59:30 pending ratification) — cross-referenced across multiple independent search results (worldathletics.org, npr.org, olympics.com), used only as an outer sanity-guard ceiling where exact precision doesn't affect correctness

### Tertiary (LOW confidence)
- 1000m "world best" (Noah Ngeny 2:11.96, 1999) and marathon 2:00:35 (Kelvin Kiptum, 2023) — well-established, longstanding records from training-data knowledge, not independently re-verified via WebSearch this session (lower priority given they're used only as a guard ceiling, not a display value)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, directly confirmed against `package.json` and the v2.0 roadmap research's own explicit statement
- Architecture: HIGH — directly extends an already-proven, already-landed pattern (`streak-utils.ts`/`compute-advanced-stats.ts` split) in this exact codebase, with the algorithm itself locked upstream in `15-CONTEXT.md`
- Pitfalls: HIGH — Pitfalls 1-3 are locked/inherited from prior research and structurally reinforced by Phase 14's schema; Pitfalls 4-6 are new findings from this session's direct inspection of the real committed data (not assumptions)

**Research date:** 2026-08-10
**Valid until:** 30 days (stable domain — pure algorithm over an already-locked, already-committed data schema; the only fast-moving element, the world-record reference table, is isolated in one small constants block explicitly designed to be easy to update)
