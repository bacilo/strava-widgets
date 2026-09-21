# Phase 33: Coverage Integration — Pace Clipping & Segment Signal - Research

**Researched:** 2026-09-21
**Domain:** Wiring an existing, calibrated detector (`unreliable-segments.ts`) into an existing strict-priority gap classifier (`classifyGaps`) and its downstream consumers; a new per-activity quality signal following an existing precedent (elevation).
**Confidence:** HIGH — every claim below is grounded in a direct read of the actual source files this phase changes, the actual committed streams for the three named fixtures, and the actual `32-CALIBRATION.md`/`32-CONTEXT.md` figures of record. No Context7/WebSearch lookups were needed: this phase installs no new package (REQUIREMENTS.md Out of Scope: "New runtime dependencies"), touches no external API, and every algorithm it reuses (`quantile`, `classifyGaps`'s strict-priority tree, the elevation-signal precedent) already exists in this repository.

## Summary

Phase 33 is a wiring phase, not a detection phase. Phase 32 already shipped a calibrated, standalone `detectUnreliableSegments` — this phase's entire job is to (1) fold its output into `classifyGaps` as a fourth, top-priority `GapKind` so every existing consumer of `gapIntervals`/`PaceCoverage` inherits clipping for free, (2) prove that wiring archive-wide with an independent recount rather than a self-agreeing identity check, (3) derive exactly one new calibrated constant (an excess-metres tier fraction) for SEG-06's severity tier, and (4) copy the Phase 30 elevation-signal precedent verbatim for the seventh quality signal, including its never-widen guard.

The single highest-risk mechanical step is `classifyGaps` itself: it currently computes gap/pause/covered in ONE forward pass over pairs. Widening it to a four-way split requires computing the THREE-way pass first (to get the `gaps: GapSpan[]` the detector needs as input), calling `detectUnreliableSegments`, and then re-deriving the final per-pair classification and all four running totals from that combined information — not simply adding an `if` branch to the existing loop. This research spells out exactly where and how.

The second highest-risk step is enumerating every consumer of `gapIntervals`/`GapKind`/`PaceCoverage`. CONTEXT.md names three silent-inheritance traps; this research found and verified a **fourth, more severe one**: `pace-quality-client.ts`'s `VALID_GAP_KINDS` set is a hardcoded two-member allowlist (`'recording-gap' | 'pause'`) used to parse the fetched quality shard in the browser. Left unwidened, it will silently **drop every `unreliable`-kind interval** from the parsed `PaceQualityShard.gapIntervals` array before `gapProfileRow`'s evidence line (or any other shard consumer) ever sees them — independent of whatever fix D-09/D-11 apply to the rendering logic itself, because the data never arrives.

**Primary recommendation:** Sequence the phase in three strictly-ordered waves — (1) `classifyGaps` widening + the four-consumer fix set, proven by unit tests and the single-fixture crosscheck; (2) the archive-wide independent recount + D-07's tier constant, both regenerable artifacts; (3) SEG-06's index/shard/badge/detail-row surface, copying the elevation precedent — with the human browser checkpoint (D-13's independently-derived-extent rows) last, gated on all three waves being merged.

## Architectural Responsibility Map

This project is a static SPA over pre-computed JSON with no server tier — "compute" happens in a Node/CI process that writes committed artifacts, and "render" happens in the browser reading those artifacts plus (per D-14) re-running the same pure compute module live for the detail view's chart/histogram/splits.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `classifyGaps` four-way widening (the ledger) | Shared compute module (`pace-derivation.ts`, isomorphic — runs identically in Node/CI and in-browser) | — | D-14 locks this: browser and CI must agree by construction, so there is exactly one implementation, imported by both. |
| Pace chart band / histogram / splits clipping (PACE-08, PACE-09) | Browser render (`detail-charts-logic.ts`, `detail-zones.ts`, `detail-sections.ts`) | Shared compute module (source of the clipped values) | D-14: computed live in-browser via `derivePaceWithCoverage(stream)`, not read from a precomputed shard — the quality shard arrives asynchronously AFTER first paint, so a shard-fed chart would render before its segments existed. |
| Coverage caption (COV-03's disclosure half) | Browser render (`detail-sections.ts` `coverageCaptionText`) | Shared compute module | Same live-recompute path as the chart — reads the same `PaceCoverage` object the chart was built from, never a second call. |
| Archive-wide coverage-identity proof (COV-03's exactness half) | CI/Node compute (a new `scripts/compute-*.mjs` artifact) | — | Never runs in the browser; it is a build-time/CI-time regenerable artifact, mirroring `32-CALIBRATION.md`. |
| SEG-06 index-row scalars + lazy shard segments (D-08) | CI/Node compute (`compute-dashboard-index.ts`, writes `data/dashboard/index.json` + `pace-quality/{id}.json`) | Browser render (`list.ts` badge, `detail-sections.ts` row) reads the precomputed values | Same pattern as the six existing quality signals — computed once at CI time, read many times in the browser. |
| D-07's excess-metres tier constant | CI/Node compute (calibration artifact) | — | Same shape as `UNRELIABLE_SPEED_LIMIT_MPS`/`UNRELIABLE_EXCESS_FLOOR_M`/`HIDDEN_PAUSE_MIN_METRES` — derived once, shipped as a source constant, never recomputed client-side. |
| ROADMAP/REQUIREMENTS dated amendments (D-12, D-15) | Docs (`.planning/`) | — | Not application code; handled via `gsd-sdk query` handlers where one exists (D-12's own instruction). |

## Standard Stack

**No new package is introduced or recommended by this phase.** REQUIREMENTS.md's own Out of Scope table states this as a locked project-wide rule ("STACK.md: every algorithm needed extends an existing hand-rolled function (`quantile`, `classifyGaps`); a stats library would add a third percentile definition to reconcile"), and every mechanism this phase needs already exists in-repo:

| Capability needed | Existing implementation | Where |
|---|---|---|
| Percentile/quantile statistic for D-07's new constant | `quantile()` — R-7 linear-interpolation, already used by `adaptiveWindowSec`, `classifyGaps`'s pause threshold, and all three of Phase 32's own constants | `src/analytics/pace-derivation.ts:100` |
| Detector call | `detectUnreliableSegments` | `src/analytics/unreliable-segments.ts:476` |
| Severity-tier shape (none/minor/severe/not-computable) | `QualityTier` | `src/analytics/pace-quality.ts:43` |
| Badge/explanation pattern for a tiered, composite-excluded signal | `elevationSignal`/`elevationBadgeContent`/`hasAnySevereSignal`'s `Pick<>` | `src/analytics/pace-quality.ts:452`, `src/dashboard/views/list.ts:519`,`1212` |

### Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages (`npm install` is not run for any part of this scope). The Package Legitimacy Gate protocol is skipped per its own trigger condition ("whenever this phase installs external packages"). No package name appears anywhere in this document tagged `[VERIFIED: npm registry]`/`[ASSUMED]` for that reason — the only "packages" this phase touches are this repository's own modules.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
                         │         classifyGaps (WIDENED, D-01/D-02)     │
                         │  src/analytics/pace-derivation.ts             │
                         │                                                │
   t[], d[]  ───────────▶  Pass 1: three-way classify (existing code,    │
                         │          UNCHANGED) → recordingGap/pause/     │
                         │          covered pairs + gapIntervals[]        │
                         │                                                │
                         │  Pass 2 (NEW): detectUnreliableSegments(       │
                         │          t, d, gapIntervals-as-GapSpan[])      │
                         │          → UnreliableSegment[]                 │
                         │             (from src/analytics/               │
                         │              unreliable-segments.ts — THE      │
                         │              ONE PERMITTED IMPORTER)           │
                         │                                                │
                         │  Pass 3 (NEW): re-walk pairs, PRIORITY:        │
                         │    unreliable > recording-gap > pause > covered│
                         │    subtract reclassified seconds OUT of        │
                         │    recordingGapSec/pauseSec, INTO unreliableSec│
                         └───────────────┬───────────────────────────────┘
                                          │  PaceCoverage { spanSec, coveredSec,
                                          │    recordingGapSec, pauseSec,
                                          │    unreliableSec (NEW),
                                          │    gapIntervals: GapInterval[]
                                          │      (kind now 4-valued) }
                         ┌────────────────┴───────────────────────────────┐
                         │                                                 │
        BROWSER (live, per D-14)                         CI/Node (compute-dashboard-index.ts)
                         │                                                 │
   derivePaceSeriesGapAware        paceHistogramSamples      splitGapAnnotations      buildPaceQualityShard /
   (window clipping)                (histogram exclusion)     (PACE-09 marker)         computePaceQualitySignals
   — INHERITS, zero change          — INHERITS, zero change   — NEEDS D-09 widening    — NEEDS SEG-06 7th signal
                         │                                                 │           (excess-metres tier)
   coverageCaptionText                                       gapProfileRow             │
   (COV-03 4th term, D-10)                                    (D-11 evidence text,      ▼
   — NEEDS D-10 widening                                       filters by kind)     data/dashboard/index.json
                                                                                     + pace-quality/{id}.json
                                                          ┌──────────────────────┐        │
                                                          │ pace-quality-client.ts│◀───────┘
                                                          │ VALID_GAP_KINDS set   │  (fetched by browser AFTER
                                                          │ — MUST WIDEN or the   │   first paint, per D-14)
                                                          │ 4th kind is silently  │
                                                          │ dropped on parse      │
                                                          └──────────┬───────────┘
                                                                     ▼
                                                          list.ts qualityBadgeSpecs
                                                          (5th badge source, elevation
                                                           precedent) + detail-sections.ts
                                                          qualitySignalsSectionPlan (9th row)
```

### Recommended Project Structure

No new files/folders for the compute logic — every symbol this phase adds lives inside the existing modules CONTEXT.md's `canonical_refs` names. Two new files are expected, following the Phase 32 naming convention (`compute-{concept}-calibration.mjs` / `compute-{concept}-recount.mjs`, artifact `{phase}-CALIBRATION.md`):

```
scripts/
├── compute-coverage-identity-recount.mjs   # D-03: archive-wide, detector-free, gap-first
│                                             # + isolated/hidden-pause enumeration (extends the
│                                             # existing compute-unreliable-segment-recount.mjs shape)
├── compute-unreliable-segment-severity-calibration.mjs   # D-07's one new constant, D-13 insensitivity
.planning/phases/33-.../
└── 33-CALIBRATION.md                        # both artifacts' output, mirroring 32-CALIBRATION.md's shape
```
(Exact filenames are Claude's Discretion per CONTEXT.md — follow the `compute-*-calibration.mjs`/`compute-*-recount.mjs` pattern; do not reuse Phase 32's script names, since they are scoped and load-bearing to Phase 32's own single-activity claim and must stay untouched.)

### Pattern 1: `classifyGaps`'s exact widening (Research Priority 1)

**What exists today** (`src/analytics/pace-derivation.ts:195-263`, quoted verbatim):

```typescript
export function classifyGaps(
  t: readonly number[],
  d: readonly number[],
  options?: { pauseRule?: PauseRule }
): PaceCoverage {
  if (!validateStreamSeries(t as number[], d as number[]).ok) return zeroCoverage();

  const n = t.length;
  const spanSec = t[n - 1] - t[0];
  // ... pauseThresholdSec resolution (unchanged) ...
  const flatRunDuration = computeFlatRunDurations(t, d, n);

  let coveredSec = 0;
  let recordingGapSec = 0;
  let pauseSec = 0;
  const gapIntervals: GapInterval[] = [];
  let openKind: GapKind | null = null;
  let openStartSec = 0;

  for (let i = 0; i < n - 1; i++) {
    const dt = t[i + 1] - t[i];
    let kind: GapKind | 'covered';
    if (dt > RECORDING_GAP_ABS_THRESHOLD_SEC) {
      kind = 'recording-gap';
    } else if (flatRunDuration[i] >= 0 && flatRunDuration[i] > pauseThresholdSec) {
      kind = 'pause';
    } else {
      kind = 'covered';
    }
    // accumulate into recordingGapSec/pauseSec/coveredSec, build gapIntervals runs...
  }
  return { spanSec, coveredSec, recordingGapSec, pauseSec, gapIntervals };
}
```

**The precise refactor.** `detectUnreliableSegments(t, d, gaps, params)` needs a `gaps: GapSpan[]` argument — per its own docblock, "gaps arrive here as the `gaps` argument so `classifyGaps` stays the ONE definition of what a gap is." This is a genuine chicken-and-egg: the detector needs to know where the EXISTING (pre-widening) gaps are before it can decide which bursts touch one. The refactor is therefore **three passes, not one**:

1. **Pass 1 (existing code, unchanged in substance):** run today's three-way loop exactly as written, producing an intermediate `{ recordingGapSec, pauseSec, coveredSec, gapIntervals: GapInterval[] }` where `gapIntervals` still only has `'recording-gap' | 'pause'` kinds. Do not discard this — it IS the detector's `gaps` input (mapped to `{ startSec, endSec }`, dropping `kind`).
2. **Pass 2 (new):** `const segments = detectUnreliableSegments(t, d, gapIntervals.map(g => ({ startSec: g.startSec, endSec: g.endSec })))`. Per D-01, each returned `UnreliableSegment`'s full `[startSec, endSec]` (burst seconds AND any gap seconds it merged) becomes one `unreliable` interval.
3. **Pass 3 (new):** re-walk the SAME `[t[i], t[i+1]]` pairs one more time. For each pair, the final `kind` is decided by strict priority: `unreliable` (if the pair's `[t[i], t[i+1]]` falls inside any `segment`'s `[startIndex, endIndex]` range — index-based containment is safe and exact here, unlike a floating `startSec`/`endSec` comparison, because `UnreliableSegment.startIndex/endIndex` are the same sample indices Pass 1 iterated) `> recording-gap > pause > covered`. Re-accumulate `coveredSec`, `recordingGapSec`, `pauseSec`, and the NEW `unreliableSec`, and rebuild `gapIntervals` as ONE array of same-kind merged runs across all four kinds (extending the existing `openKind`/`openStartSec` merge logic, which already generalizes to N kinds with no structural change — it only ever compares `openKind === kind`).

**The precise subtraction D-01 describes** ("~11,574 s across 63 gap-adjacent activities moves between shipped caption terms") is exactly what Pass 3 does for free: any pair that Pass 1 classified `recording-gap` but that Pass 2's detector decided is inside an `UnreliableSegment` is counted in Pass 3 as `unreliable`, not `recording-gap` — the seconds move because the SAME pair is reclassified, not because anything is added or removed from `spanSec`.

**Why this must be index-based, not re-deriving from `startSec`/`endSec` floats:** `UnreliableSegment.startIndex`/`endIndex` are the exact sample indices `advanceSteps`/`mapGapToIndices` computed internally — reusing them for the Pass-3 containment test avoids re-deriving a second, possibly-diverging notion of "which pair is inside this segment" from floating-point `t[]` comparisons. `pace-quality.ts`'s own module docblock precedent ("the SOLE call site... never a second independent invocation inviting drift") argues for the same discipline here: Pass 3 should consume the detector's own index fields, never recompute a `startSec <= t[i] && t[i+1] <= endSec` test that could disagree with the detector's own `isGapPair`-style boundary convention (which Phase 32 round-2 review already found once, CR-01/gap #3, to be a genuine source of double-counting bugs).

**Total-function contract:** `classifyGaps` is called from the untyped `.mjs` recount/calibration scripts too (via `dist/analytics/pace-derivation.js`), so the widened function must preserve `validateStreamSeries`-guarded totality (T-26-01) — `detectUnreliableSegments` is itself already total per Phase 32's own gap-closure work (32-11), so no new failure mode is introduced by calling it from inside `classifyGaps`, but the calling code must not assume a non-empty result and must handle `[]` (no segments) as a legitimate all-clear identically to today's behaviour.

### Pattern 2: Every `gapIntervals`/`GapKind`/`PaceCoverage` consumer, classified (Research Priority 2)

Full inventory via `grep -rln "gapIntervals\|GapKind\|PaceCoverage\|classifyGaps\|recordingGapSec\|pauseSec" src/ scripts/` (non-test files only; the equivalent `.test.ts`/`.test.mjs` files exist for every producer/consumer below and must be extended in lockstep, but are not separately listed):

| File | Symbol | Consumes | Classification | Action needed |
|---|---|---|---|---|
| `src/analytics/pace-derivation.ts` | `classifyGaps` | (producer) | — | **Widen** (Pattern 1 above). |
| `src/analytics/pace-derivation.ts` | `derivePaceSeriesGapAware` | `gapIntervals` (generic membership test on `startSec`/`endSec`, kind-agnostic) | **Inherits correctly** | None. Already clips on ANY `gapIntervals` entry regardless of `kind` — this is D-02's whole point. |
| `src/analytics/pace-derivation.ts` | `paceHistogramSamples` | `gapIntervals` (generic `segStart >= g.startSec && segStart < g.endSec`, kind-agnostic) | **Inherits correctly** | None. |
| `src/analytics/pace-derivation.ts` | `paceHistogramAccounting`/`unbucketedCoveredSec` | `coverage.coveredSec` (already excludes whatever Pass 3 puts there) | **Inherits correctly** | None — `coveredSec` is smaller after widening (unreliable time moves out of it too, since a burst was never `covered` in the old scheme either... **VERIFY**: confirm bursts were previously classified `covered` (not `pause`/`recording-gap`) before this phase — if so, `coveredSec` SHRINKS under D-01/D-02, which is new behaviour for `paceHistogramAccounting`'s identity and must be asserted in a widened test, not merely assumed unchanged). |
| `src/analytics/pace-quality.ts` | `resolveCoverage` (sole `classifyGaps` call site in this module) | `classifyGaps(t, d)` result | **Inherits correctly** (call site) | None — but see `tierGapProfileFromCoverage` row below. |
| `src/analytics/pace-quality.ts` | `tierGapProfileFromCoverage` / `gapProfileSignal` | `coverage.recordingGapSec + coverage.pauseSec` (D-04's numerator) | **Needs explicit widening** | D-04 locks: numerator becomes `recordingGapSec + pauseSec + unreliableSec`. `GapProfileSignal` interface gains `unreliableSec: number \| null` (Claude's Discretion whether echoed — recommend YES, matching `recordingGapSec`/`pauseSec`'s own itemisation, so the shard/badge can name it separately per D-11's copy widening). |
| `src/analytics/pace-quality.ts` | `GAP_PROFILE_SEVERE_FRACTION` / `GAP_PROFILE_MINOR_FRACTION` | (thresholds) | **Frozen by D-05** | None — do not touch the constants; only their measured before/after migration is reported. |
| `src/analytics/pace-quality.ts` | `PaceQualityShard.gapIntervals` | `coverage.gapIntervals` (straight passthrough in `buildPaceQualityShard`) | **Inherits correctly** (write side) | None on the write side — but see the client parser below (the READ side is the actual trap). |
| `src/dashboard/data/pace-quality-client.ts` | `VALID_GAP_KINDS` | Hardcoded `Set<GapKind>(['recording-gap', 'pause'])`, gates `parseGapInterval` | **SILENTLY WRONG — fourth trap, found in this research, not named in CONTEXT.md's three** | **MUST widen** to `['recording-gap', 'pause', 'unreliable']` or every fetched shard's `unreliable`-kind intervals are dropped on parse (`parseGapInterval` returns `null` for any `kind` not in the set, and `parsePaceQualityShard` silently skips `null` entries — no error, no warning, just an undercount). This is the load-bearing fix underneath CONTEXT.md's second named trap (`gapProfileRow`'s evidence line reads `shard.gapIntervals`) — fixing `gapProfileRow` alone without this leaves the evidence line correct in LOGIC but wrong in DATA. |
| `src/dashboard/views/detail-sections.ts` | `coverageCaptionText` | `coverage.{coveredSec,recordingGapSec,pauseSec}` (three-term string, hardcoded) | **Needs explicit widening (D-10)** | Add the fourth `{u}% unreliable` term, always-on (render even at 0%), independent rounding — see Pattern 4. |
| `src/dashboard/views/detail-sections.ts` | `SplitGapAnnotation` / `splitGapAnnotations` | `gapIntervals`, two-way `if (gap.kind === 'recording-gap') … else pauseSec += …` | **SILENTLY WRONG (CONTEXT.md's 1st named trap)** | **MUST widen** to a three-way `if/else if/else`; add `unreliableSec` to the interface. Untested today, an `unreliable` interval would silently count as `pauseSec`. |
| `src/dashboard/views/detail-sections.ts` | `dominantGapKindLabel` | `annotation.recordingGapSec >= annotation.pauseSec` (two-way tie logic) | **Needs explicit widening (D-09)** | D-09: `unreliable` wins whenever present (checked FIRST, before the existing magnitude comparison), `recording-gap`/`pause` keep today's tie-favours-recording-gap rule between themselves when `unreliable` is absent. Return type widens to include `'unreliable segment'` (or similar — exact label is presentation-layer discretion, must fit the UI-SPEC's single-category-per-split copy contract). |
| `src/dashboard/views/detail-sections.ts` | `gapProfileRow` | `shard?.gapIntervals` (evidence line: "N gap intervals; longest …") | **SILENTLY WRONG (CONTEXT.md's 2nd named trap)** | D-11 requires deciding whether the evidence line itemises by kind (e.g. "N gap/pause intervals, M unreliable segments; longest …") or stays a raw count across all four kinds. Recommend itemising — a raw count across 4 kinds is less informative than today's raw count across 2, and the whole point of D-11's copy widening is that the number's meaning changed. **Depends on the `pace-quality-client.ts` fix above** — fixing this function alone without widening `VALID_GAP_KINDS` produces a correct-looking but data-starved evidence line. |
| `src/dashboard/views/list.ts` | `qualityBadgeSpecs` | `quality.{decimation,gapProfile,impossibleSamples}` text ("% of recorded time in gaps or pauses") | **Needs explicit widening (D-11)** | Update the `gapProfile` badge's `visibleText` template string to match D-11's new copy — this is a correctness fix (the number now includes unreliable time), not cosmetic. Also add a FIFTH badge source (SEG-06 itself) following `elevation`'s exact pattern — see Pattern 3. |
| `src/dashboard/views/list.ts` | `hasAnySevereSignal` | `Pick<ActivityQualitySignals, 'decimation'\|'gapProfile'\|'impossibleSamples'>` | **Must NOT change** | D-06 requires the NEW SEG-06 signal is structurally excluded, exactly like `elevation` — the `Pick<>` stays 3-member. A guard test must exist proving this (Pattern 3). |
| `src/dashboard/views/detail.ts` | (chart wiring) | `derived.coverage.gapIntervals` passed to `splitGapAnnotations` | **Inherits correctly** (call site) | None — the call site itself needs no change; only `splitGapAnnotations`'s own body does. |
| `src/dashboard/views/detail-charts-logic.ts` | `buildChannelSeries`(pace branch) | `derivePaceWithCoverage(stream).paceSeries` | **Inherits correctly** | None. |
| `src/dashboard/views/detail-zones.ts` | `computePaceDistribution` | `paceHistogramSamples(t, derived.paceSeries, derived.coverage.gapIntervals)` | **Inherits correctly** | None. |
| `src/analytics/compute-dashboard-index.ts` | `computePaceQualitySignals`/`buildPaceQualityShard` call | — | **Needs SEG-06 wiring** | Add the seventh signal's computation and its index-row scalars (D-08) — see Pattern 3. |
| `src/analytics/dashboard-index.types.ts` | `DASHBOARD_INDEX_SCHEMA_VERSION` | — | **Stays `1`** | D-08 requires purely additive fields on `ActivityQualitySignals`/`DashboardIndexRow` — no version bump. |
| `src/dashboard/data/index-client.ts` | `fetchDocument` | Blind cast, no field-level validation | **Inherits correctly** | None — new row scalars pass straight through the cast; `ParsedDashboardIndexRow = Partial<DashboardIndexRow> & { id: string }` already tolerates an old/missing field at every read site (established `?? null`/`Pick<>` discipline). |

**A fifth thing to verify, not just a trap:** `paceHistogramAccounting`'s identity (`coveredSec === bucketedSec + unbucketedCoveredSec`, WR-01) is unconditional BY CONSTRUCTION on whatever `coverage.coveredSec` the widened `classifyGaps` reports — it needs no code change, but it DOES need a new/extended test proving the identity still holds when `coveredSec` has shrunk further (a burst's covered pairs, which contributed to `coveredSec` before this phase, now contribute to `unreliableSec` instead). This is a regression a green existing test suite would NOT catch on its own (Pitfall 6's exact shape) unless a new fixture with a real detected segment is added to `pace-derivation.test.ts`.

### Pattern 3: The elevation precedent, exact inventory for SEG-06 (Research Priority 5)

Trace of the existing fourth-badge-source, tiered-but-excluded pattern, file by file:

1. **Signal shape** — `ElevationSignal` (`pace-quality.ts:202`): `{ tier: ElevationTier; subGround; closureDrift; verticalRate }`. SEG-06's equivalent needs its own interface, e.g. `UnreliableSegmentsSignal { tier: QualityTier; count: number | null; totalMetres: number | null; totalExcessMetres: number | null; totalSeconds: number | null; mechanisms: SegmentMechanism[] | null }` (field names are Claude's Discretion per CONTEXT.md, but must carry count/metres/seconds/mechanisms per SEG-06's own text and D-08). Unlike elevation's THREE-member `ElevationTier` (no `'minor'`, D-07 of Phase 30), SEG-06 explicitly DOES get a `minor` tier per D-06 here — reuse the full four-member `QualityTier`, not a new elevation-style union.
2. **Assembly** — `elevationSignal(stream, metadata)` (`pace-quality.ts:452`) is called once inside `computePaceQualitySignals` (`:1261`) and `buildPaceQualityShard` (`:1467`), from the SAME raw scan, never twice. SEG-06's equivalent must call `detectUnreliableSegments` exactly once per activity and share the result between the index-row tiering AND the shard's per-segment evidence list — mirroring how `elevationRaw = countVerticalRateSamples(...)` is recomputed ONCE for the shard's capped list from the same detector Pass, "never a second detector, only a second read of the same evidence" (`pace-quality.ts:1468-1472`'s own comment). Per D-14, `classifyGaps` ALSO calls the detector (browser + CI) — `computePaceQualitySignals`/`buildPaceQualityShard` run ONLY in CI (`compute-dashboard-index.ts`), so this is a structurally separate call from `classifyGaps`'s own, not a shared cache; document this explicitly as an accepted "one call per producer, not a global de-dupe" cost, matching D-14's own accepted "O(n) pass per detail view" cost.
3. **Composite exclusion** — `hasAnySevereSignal`'s `Pick<>` (`pace-quality.ts:1212-1220`) stays exactly 3-member (`decimation | gapProfile | impossibleSamples`). The guard test precedent: `pace-quality.test.ts:840`, `"anySevere excludes elevation: a severe elevation tier never flips hasAnySevereSignal (Phase 30's own most-consequential-mistake guard)"`. SEG-06 needs the SAME test shape, e.g. `"anySevere excludes unreliableSegments: a severe unreliableSegments tier never flips hasAnySevereSignal"`, demonstrated by temporarily widening the `Pick<>` (per STATE.md's own Phase 30 plan 01 precedent: "demonstrated failing by temporarily widening it, observing the guard test fail, then reverting" — this temporary widening must NOT be committed, only its failing-output captured in the plan's SUMMARY).
4. **Badge source** — `qualityBadgeSpecs` (`list.ts:427-502`) has elevation as the fourth, deliberately-separate `if` block (`:489-499`) appended AFTER the three tiering-signal blocks, calling `elevationBadgeContent(elevation)` (`:519-538`) as its own text-builder, reused unchanged by `detail.ts`'s stat-card badge (D-12 of Phase 30). SEG-06 is the FIFTH such block, structurally identical: `if (unreliableSegments !== undefined && unreliableSegments.tier === 'severe') { const content = unreliableSegmentsBadgeContent(unreliableSegments); ... }`. `QualityBadgeSpec.signal` union widens to add `'unreliableSegments'`.
5. **Read-site widening guard** — `elevation: ElevationSignal | undefined = quality.elevation` (`list.ts:439`, CR-01 30-REVIEW.md precedent: a stale cached `index.json` may lack the key entirely). SEG-06 needs the identical `undefined`-tolerant read, since the same stale-cache risk applies to every new field this phase adds.
6. **Detail-view always-on row** — `qualitySignalsSectionPlan` (`detail-sections.ts:1394-1424`) currently emits exactly 8 rows in fixed order (`decimationRow, gapProfileRow, impossibleSamplesRow, subGroundRow, closureDriftRow, verticalRateRow, deviceEraRow, elapsedVsMovingRow`). SEG-06 needs a NINTH row function (e.g. `unreliableSegmentsRow`), following `decimationRow`'s not-computable/healthy/tiered shape (`:965-999`) — NOT elevation's three-sub-row shape, since SEG-06 is one rolled-up signal like decimation/gapProfile/impossibleSamples, not three independent detectors. `notAvailableRows()` (`:1301`) needs a matching ninth not-available row.
7. **Explanation text is deliberately NOT routed through `EXPLANATION_PROBE_SPECS`** — that mechanism (`:796-853`) exists ONLY for the three composite-feeding tiering signals; elevation's three per-mode explanations are standalone module constants (`SUB_GROUND_EXPLANATION` etc., `:876-883`). SEG-06, excluded from the composite exactly like elevation, should follow the SAME standalone-constant pattern (e.g. `UNRELIABLE_SEGMENTS_EXPLANATION`), not be force-fit into the probe mechanism (which would incorrectly imply it feeds `hasAnySevereSignal`).
8. **`EXPLANATION_PROBE_QUALITY`'s own comment already anticipates a future non-tiering-trio member** (`:786-794`, discussing elevation): a new fourth quality-signal member added to `ActivityQualitySignals` must be given a value in that fixture object or every existing test constructing `ActivityQualitySignals` object literals (there are many, via `pace-quality.test.ts`, `list.test.ts`, `detail-sections.test.ts`) will fail to typecheck until updated — this is a mechanical but wide-reaching edit (grep `ActivityQualitySignals` literal construction across `*.test.ts` before starting).

### Anti-Patterns to Avoid

- **Second `classifyGaps` invocation inside the detector-integration code.** `resolveCoverage` in `pace-quality.ts` is already documented as "the SOLE call site of the shared gap classifier in this module" — SEG-06's signal must be derived from the SAME `coverage` object `gapProfileSignal` already computed in `buildPaceQualityShard`'s existing flow (`coverage = resolveCoverage(t, d)`, `:1440`), never a second `classifyGaps(t, d)` call.
- **Deleting-and-restitching for the excess-metres statistic.** D-07 explicitly reuses the detector's own excess concept ("Excess = distance carried beyond what `UNRELIABLE_SPEED_LIMIT_MPS` allows") — do not invent a second excess formula; import the shape from the detector's already-shipped `excessMetres` reasoning (documented, not literally importable — that function is private to `unreliable-segments.ts` and confined by `pace-single-source.test.ts`'s `DETECTOR_ARITHMETIC_LITERALS` scan; SEG-06's per-activity aggregation reads `UnreliableSegment.metres` and re-derives excess the SAME way the calibration script does, i.e. `metres - speedLimitMps * seconds` per segment, summed).
- **A raw-count "presence = severe" tier for SEG-06.** D-06 explicitly measured and rejected this (699/1,874 = 37.3% would badge over a third of the archive). The tier MUST be excess-metres-fraction-based (D-07), not segment-count-based.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| A new percentile/quantile function for D-07's constant | A second percentile implementation | `quantile()` from `pace-derivation.ts:100` | Explicitly locked by that function's own docblock ("Deliberately the SAME quantile implementation Phase 28's PR plausibility ceiling will reuse; do not substitute") and by the project-wide "no third percentile definition" rule in REQUIREMENTS.md's Out of Scope table. |
| A second gap-membership test for Pass 3's containment check | A hand-rolled `startSec <= t[i] && t[i+1] <= endSec` re-derivation | The detector's own `startIndex`/`endIndex` sample-index fields | Avoids re-deriving a boundary convention that has ALREADY been the source of one real double-counting defect in this codebase (32-REVIEW.md round-2 CR-01/gap #3). |
| A new "which kind wins" tie-break for `dominantGapKindLabel` | A three-way magnitude comparison | D-09's locked rule: `unreliable` always wins when present, else the EXISTING two-way magnitude/tie rule unchanged | D-09 already rejected the alternative (three-way magnitude dominance) with a stated reason (a 200s pause with a 2.7s isolated jump must still name the jump). |
| A second detector call inside `computePaceQualitySignals` vs `buildPaceQualityShard` | Two independent `detectUnreliableSegments` invocations per activity | One call, shared exactly like `elevationSignal`'s single call is shared between the index-row tier and the shard's evidence list | Matches the module's own "never a second independent invocation" discipline (see `resolveCoverage`'s docblock). |

**Key insight:** every "don't hand-roll" item above is not a generic best-practice caution — each one names a SPECIFIC prior defect or a SPECIFIC locked decision in THIS codebase that a hand-rolled second implementation would either duplicate or reopen.

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase. No stored data, live service config, OS-registered state, secrets, or build artifacts carry a name that changes in this phase.

## Common Pitfalls

### Pitfall A: Treating the four-way identity as proof of correctness (Research Priority 3, D-03)

**What goes wrong:** `coveredSec + recordingGapSec + pauseSec + unreliableSec === spanSec` will pass EVEN IF the widened `classifyGaps` misclassifies every single pair — e.g. if Pass 3's containment test is inverted and marks the WRONG pairs `unreliable`, the four buckets still exhaustively partition every pair exactly once (Pass 3's own `if/else if/else` structure guarantees this by construction, the same way the current three-way version already guarantees the three-way identity today). The identity is a property of the CODE SHAPE (mutually-exclusive, exhaustive classification), not of the SEMANTIC correctness of which pairs land in `unreliable`.

**Why it happens:** it is easy to write a test asserting the identity, watch it pass, and stop — the identity is real and worth keeping as a fast `npm test` guard (D-03 keeps it), but CONTEXT.md is explicit that it "proves little on its own."

**How to avoid — the concrete independent recount design:**
1. **Extend `compute-unreliable-segment-recount.mjs`'s ALGORITHM, in a NEW script, archive-wide.** The existing script (`scripts/compute-unreliable-segment-recount.mjs`) is scoped to ONE activity and ONLY the gap-adjacent mechanism (`recountGapFirst` only emits rows for bursts touching a `LOCAL_GAP_THRESHOLD_SEC`-derived recording gap — see its own comment: "This rule covers only RECORDING gaps, which is sufficient for `3475724402` because every one of its gaps is a recording gap"). It does NOT enumerate isolated-jump or hidden-pause segments (bursts with no touching gap) — `computeRunsInSegment` computes every fast run inside a segment, but only `lastBurstEndingAt`/`firstBurstStartingAt` (the boundary-touching ones) become output rows today. **The new archive-wide script must additionally emit a row for every OTHER kept burst in `segRuns` (the ones `computeRunsInSegment` already finds but the current script discards), classified `hidden-pause`/`isolated-jump` by the SAME `metres >= hiddenPauseMinMetres` rule the detector uses** — this is new logic, not merely a loop-over-activities wrapper around the existing one.
2. **Zero-import discipline (D-15) extends unchanged**: the new script must have no import/require/dynamic-`import()` of `unreliable-segments` in ANY spelling — mirror `compute-unreliable-segment-recount.test.mjs`'s existing zero-import guard test for the new script.
3. **What gets compared, and against what:** for every stream in `data/streams/`, sum this recount's own `seconds` across every emitted row (gap-adjacent + hidden-pause + isolated-jump) → `recountUnreliableSec`. Compare against the SHIPPED, WIRED total: `classifyGaps(t, d).unreliableSec`, read from the COMPILED `dist/analytics/pace-derivation.js` (never from `src/`, mirroring `unreliable-segment-recount-crosscheck.test.mjs`'s existing precedent of importing from `../dist/`). **This is the load-bearing comparison** — it independently re-derives the number the shipped code claims, using a structurally different traversal (gap-first + segment-run enumeration vs. the shipped run-first + adjacency-merge), which is exactly what avoids PITFALLS.md's Pitfall 11 (a recount sharing the classifier's blind spot): the two algorithms fold zero-advance steps, group fast runs, and merge with gaps via genuinely different code, so a shared bug in ONE traversal order is unlikely to reproduce identically in the other.
4. **The archive-wide extension of the EXISTING single-fixture crosscheck (`unreliable-segment-recount-crosscheck.test.mjs`)** should stay as-is (Claude's Discretion note in CONTEXT.md doesn't mention removing it) — it remains the fast, `npm test`-time, single-activity guard; the new archive-wide script is the SEPARATE, regenerable, not-run-every-`npm test` artifact D-03 requires (`fileParallelism: false` already makes the suite slow; a 1,874-stream scan does not belong in the hot path).
5. **What "avoids the classifier's blind spot" means concretely here:** the shipped `classifyGaps` calls `detectUnreliableSegments` internally (Pattern 1's Pass 2) using the SAME boundary/adjacency/excess-floor logic that produced the numbers in `32-CALIBRATION.md`. If the recount ALSO called `detectUnreliableSegments` (even indirectly, by importing `classifyGaps` from `src/`), it would inherit any bug in `mapGapToIndices`/`isGapPair`/`groupFastRuns` for free — this is precisely PITFALLS.md's Pitfall 11's "N = N" shape (Phase 28's "18 = 18"). The recount's `foldSegment`/`computeRunsInSegment`-style logic (already present in the existing script, to be extended) is a hand-written SECOND implementation of "fold zero-advance steps into the next advancing step, group consecutive fast steps, compute excess" — genuinely independent arithmetic, not a wrapper.

### Pitfall B: `pace-quality-client.ts`'s `VALID_GAP_KINDS` silently drops data (found in this research, not a CONTEXT.md-named trap)

See Pattern 2's dedicated row above. **Warning sign to check for during execution:** a test that fetches a shard containing an `unreliable`-kind interval and asserts the parsed `PaceQualityShard.gapIntervals` length — if this test is only ever run against a shard WITHOUT an unreliable interval, it will pass vacuously and never catch the drop. The plan must include a fixture shard with at least one `unreliable`-kind entry.

### Pitfall C: A D-07 severity fraction that is itself circular (mirrors Phase 32's Pitfall 5)

**What goes wrong:** deriving the new severe-tier excess-fraction constant from a population that ALREADY excludes what it will exclude, or — the sharper trap named in D-07's own text — deriving it as a raw tail percentile of the very excess-fraction distribution it will threshold, which is definitionally unfalsifiable (the top X% will always be "severe" by construction, regardless of what X is, so no insensitivity check can meaningfully fail).

**The strawman to watch failing first (Research Priority 4):** mirror `32-CALIBRATION.md`'s "Why not a tail percentile" section exactly — a raw tail percentile (e.g. p99) of the pooled per-activity excess-fraction population, analogous to L's own rejected `7.750 m/s` strawman (pooled p99.9 of folded step speeds) and F's rejected `245.046 m` strawman (p99 tail of pooled step metres). Both of those strawmen FAILED the 1% insensitivity check (removedDelta 17.42%/98.82%) precisely because a tail percentile of a population MOVES when you remove or double its own tail — the exact test D-07 requires ("re-derive with detected segments removed, and with planted synthetics added ... a constant that moves beyond a stated tolerance is a failed calibration"). Run this exact strawman FIRST, confirm it fails the tolerance (which CONTEXT.md's own anti-quota/watch-it-fail convention requires be demonstrated, not assumed), THEN derive the real candidate.

**Recommended candidate shape** (Claude's Discretion per CONTEXT.md, offered as a starting hypothesis for the planner/executor to test, NOT a locked value): an R-7 percentile ACROSS FLAGGED activities (the 699-activity cohort) of each activity's own `(total excess metres across its own segments) / (activity's own total distance)` — structurally parallel to `UNRELIABLE_SPEED_LIMIT_MPS`'s own S-A shape ("R-7 p90 ACROSS ACTIVITIES of each activity's own R-7 p95 ..."), with the outer percentile order chosen from the same `{0.90, 0.95, 0.97, 0.99}` candidate list, smallest-that-clears-D-13 wins (mirroring the multiplier-selection precedent in `UNRELIABLE_SPEED_LIMIT_MPS`'s own docblock). This constant is a FRACTION (dimensionless), not a metres value, so `UNRELIABLE_EXCESS_FLOOR_M`'s rounding-direction argument does not directly transfer — round in whichever direction the D-13 check's own tolerance dictates once real numbers exist.

**Minor tier — an explicit open question, not resolved by CONTEXT.md's text:** D-06 promises `none`/`minor`/`severe`, but D-07 names exactly ONE new constant. The simplest reading that honours "one constant" literally: `minor` = "at least one segment detected AND excess-fraction below the severe cut" (no second threshold needed — the boundary between `none` and `minor` is simply "has ≥1 segment"); `severe` = excess-fraction over the D-07 constant. Flag this explicitly to the planner as a decision to confirm during planning, not silently assumed.

### Pitfall D: Sequencing a check that would pass vacuously (Research Priority 8)

Any test asserting "no `unreliable` interval reaches the histogram/splits/caption" is UNFAILABLE until Pass 1-3's widening lands — a plan that writes such a test BEFORE the widening exists would see it pass trivially (there are zero `unreliable` intervals to leak, because none can be produced yet). Sequence strictly: `classifyGaps` widening (Wave 1) MUST merge before ANY consumer-side test asserting clipping behaviour is written as a real (non-vacuous) check.

## Code Examples

### The `hasAnySevereSignal` never-widen guard (exact precedent to copy)

```typescript
// Source: src/analytics/pace-quality.test.ts:840 (verified by direct read)
it("anySevere excludes elevation: a severe elevation tier never flips hasAnySevereSignal (Phase 30's own most-consequential-mistake guard)", () => {
  const tieringNone: Pick<ActivityQualitySignals, 'decimation' | 'gapProfile' | 'impossibleSamples'> = {
    decimation: { tier: 'none', zeroAdvanceFraction: 0, sampleCount: 100 },
    gapProfile: { tier: 'none', gapFraction: 0, recordingGapSec: 0, pauseSec: 0, spanSec: 100 },
    impossibleSamples: { tier: 'none', count: 0, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: 0 },
  };
  expect(hasAnySevereSignal(tieringNone)).toBe(false);
  // ... constructs a severe elevation signal, confirms hasAnySevereSignal(Pick<>) type still
  //     rejects it at compile time — the Pick<> itself is the guard, not a runtime branch.
});
```
SEG-06's equivalent test must exist with the identical structure, naming `unreliableSegments` instead of `elevation`.

### `elevationBadgeContent`'s null-on-no-evidence defence (exact pattern to copy for `unreliableSegmentsBadgeContent`)

```typescript
// Source: src/dashboard/views/list.ts:519-538 (verified by direct read)
export function elevationBadgeContent(
  elevation: Pick<ElevationSignal, 'subGround' | 'closureDrift' | 'verticalRate'>
): { visibleText: string; explanation: string } | null {
  const clauses: string[] = [];
  if (elevation.subGround.flagged && elevation.subGround.minAltM !== null) {
    clauses.push(`altitude ${Math.round(elevation.subGround.minAltM)} m below ground`);
  }
  // ... two more clauses ...
  if (clauses.length === 0) return null; // a severe tier with no non-null evidence is a
                                          // contradiction the classifier cannot produce —
                                          // defend against a future regression anyway.
  return { visibleText: clauses.join(' · '), explanation: '...' };
}
```

### `splitGapAnnotations`'s two-way else (the exact bug CONTEXT.md's D-09 fixes)

```typescript
// Source: src/dashboard/views/detail-sections.ts:127-148 (verified by direct read)
for (const gap of gapIntervals) {
  const overlapStart = Math.max(split.startTimeSec, gap.startSec);
  const overlapEnd = Math.min(split.endTimeSec, gap.endSec);
  const overlapSec = overlapEnd - overlapStart;
  if (overlapSec > 0) {
    if (gap.kind === 'recording-gap') {
      recordingGapSec += overlapSec;
    } else {
      pauseSec += overlapSec;   // <-- an 'unreliable' kind lands HERE today, silently
    }
  }
}
```
Fix: add `unreliableSec` accumulation and a third branch (`else if (gap.kind === 'pause') pauseSec += overlapSec; else unreliableSec += overlapSec;`), plus `SplitGapAnnotation.unreliableSec`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Three-way gap classification (`recording-gap`/`pause`/`covered`) | Four-way (`unreliable` added at top priority) | This phase | `coveredSec`/`recordingGapSec`/`pauseSec` all shrink for the 699 activities carrying ≥1 detected segment; `gapProfile`'s severe/minor rate moves (measured, not tuned, per D-05). |
| `gapProfile` badge text names two categories | Names three (D-11) | This phase | Every list-row badge and detail-row label using the old two-category phrasing must be updated in the SAME commit as the numerator change — stale copy describing a changed number is D-11's own named defect class. |
| Six per-activity quality signals | Seven (SEG-06 added) | This phase | `hasAnySevereSignal`'s composite denominator/numerator is UNCHANGED (SEG-06 structurally excluded, D-06) — the v2.2 figure of record (299/1,890, 15.8%) stays comparable across this milestone. |

**Deprecated/outdated:** none — this phase does not remove any existing capability, only widens/extends.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Bursts were classified `covered` (not `pause`/`recording-gap`) by the PRE-Phase-33 three-way `classifyGaps` — i.e. `coveredSec` genuinely shrinks under D-01/D-02, not merely `recordingGapSec`/`pauseSec`. | Pattern 2, `paceHistogramAccounting` row | If wrong (bursts were already classified as `pause` in some cases, e.g. a slow-motion slew that never exceeded `RECORDING_GAP_ABS_THRESHOLD_SEC` but also never registered as fast enough to be `covered`), the WR-01 identity's expected direction of movement is different than described here, and the new regression fixture asserting it would need re-deriving. **[ASSUMED]** — not independently re-derived from the three named fixtures' raw streams in this research session; the planner should confirm this with a direct before/after `classifyGaps` run on 3475724402 during Wave 1. |
| A2 | The recommended D-07 statistic shape (percentile-across-flagged-activities of each activity's own excess-fraction, candidate outer-percentile list `{0.90,0.95,0.97,0.99}`) will pass its own D-13 insensitivity check. | Pitfall C | This is offered as a STARTING HYPOTHESIS, explicitly not computed or verified in this research session (no calibration script exists yet to run it against). If it fails insensitivity, the planner must try the next candidate in the list or a structurally different statistic — same discovery process Phase 32 itself went through for L (S-A vs S-B). **[ASSUMED]** |
| A3 | `minor` tier for SEG-06 requires no second constant (boundary is simply "≥1 segment present, below the severe cut"). | Pitfall C | If the developer intends a genuinely distinct minor/severe boundary (not just "has any"), a second constant is needed, contradicting D-07's "one new constant" text — flagged as an open question, not assumed silently. **[ASSUMED — recommend confirming in planning, not execution]** |

## Open Questions

1. **Does the D-11 `gapProfileRow` evidence line itemise by kind, or stay a raw cross-kind count?**
   - What we know: CONTEXT.md names the trap but not the resolution ("Decide and pin whether it filters by kind").
   - What's unclear: whether "N gap intervals; longest …" becomes "N gap/pause intervals, M unreliable segments; longest …" or some other split.
   - Recommendation: itemise — a raw count across 4 kinds is strictly less informative than today's count across 2, undermining D-11's own stated goal that "the text names exactly what the number counts."

2. **Exact field names/shape for `GapProfileSignal.unreliableSec` and the new `UnreliableSegmentsSignal` interface.**
   - What we know: CONTEXT.md explicitly leaves this to Claude's Discretion.
   - What's unclear: whether `unreliableSec` is nested inside `GapProfileSignal` (echoed, per CONTEXT.md's suggestion) or lives only on the new seventh signal.
   - Recommendation: echo it on `GapProfileSignal` too (small, additive, and matches `recordingGapSec`/`pauseSec`'s own existing itemisation pattern) — the shard/badge precedent already expects separately-named fields, not a derived subtraction at render time.

3. **The exact D-07 statistic and its numeric value.**
   - What we know: the METHODOLOGY (percentile-across-activities, D-13 insensitivity, watched-failing strawman) is fully specified by this research and by Phase 32's own precedent.
   - What's unclear: the actual number, which requires running a calibration script against the live archive — genuinely execution-time work, not research-time work (Phase 32's own L/F/B values were only known after 32-06's script ran).
   - Recommendation: build the calibration script early in Wave 2, run it, record whatever it finds as the figure of record (never tune toward a target, per the project's anti-quota rule).

## Environment Availability

Not applicable — this phase has no external tool/service/runtime dependency beyond the project's own existing Node/npm toolchain, already verified present and in use by every prior phase in this milestone (`npm test`, `npm run build`, `npm run compute-dashboard-index`, `npm run build-widgets`, `npm run verify-dashboard` — all pre-existing scripts, unchanged in this phase).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (already configured, `vitest.config.ts`) |
| Config file | `vitest.config.ts` — `globals: true`, `environment: 'node'`, `fileParallelism: false`, `include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']` |
| Quick run command | `npx vitest run -t "<name fragment>"` |
| Full suite command | `npm test` (currently 91 files / 2,848 tests per 32-17's summary — will grow) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PACE-08 | `classifyGaps` widened, `unreliable` outranks `recording-gap`/`pause` | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "unreliable"` | ❌ Wave 0/1 — new cases in existing file |
| PACE-08 | Chart/histogram clip an `unreliable` interval exactly as a gap | unit | `npx vitest run src/dashboard/views/detail-charts-logic.test.ts src/dashboard/views/detail-zones.test.ts -t "unreliable"` | ❌ Wave 1 (inherited behaviour — new fixture-driven assertions, no source change per D-02) |
| PACE-08 | Fastest post-clip pace on the served build matches a raw-`t`/`d`-derived value | manual (browser checkpoint) | N/A — human checkpoint, D-13 | ❌ Wave 3, checkpoint row |
| PACE-09 | `SplitGapAnnotation` three-way widening; `unreliable` wins the marker | unit | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "splitGapAnnotations"` | ❌ Wave 1 |
| PACE-09 | 3475740390's t=2508 split (km 8) carries the marker on the served build | manual (browser checkpoint) | N/A | ❌ Wave 3, checkpoint row |
| COV-03 | Coverage caption's fourth term, always-on including 0% | unit | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "coverageCaptionText"` | ❌ Wave 1 |
| COV-03 | Four-way identity, zero violations archive-wide | script (regenerable artifact) | `npm run compute-coverage-identity-recount` (or chosen name) | ❌ Wave 2, new script |
| COV-03 | `gapProfileSignal`'s numerator includes `unreliableSec` (D-04) | unit | `npx vitest run src/analytics/pace-quality.test.ts -t "gapProfile"` | ❌ Wave 1 |
| SEG-06 | Signal tiered none/minor/severe, structurally excluded from `hasAnySevereSignal` | unit | `npx vitest run src/analytics/pace-quality.test.ts -t "unreliableSegments"` | ❌ Wave 3 |
| SEG-06 | Index row scalars additive, `DASHBOARD_INDEX_SCHEMA_VERSION` unchanged | unit | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "unreliable"` | ❌ Wave 3 |
| SEG-06 | Badge appears only at `severe`, list surfaces | unit | `npx vitest run src/dashboard/views/list.test.ts -t "unreliableSegments"` | ❌ Wave 3 |
| SEG-06 | Three named activities disclose the signal on the served build | manual (browser checkpoint) | N/A | ❌ Wave 3, checkpoint row |
| D-15 (SEG-05b, this phase's half) | `pace-derivation.ts` reading the detector is LOAD-BEARING, not merely imported | unit | `npx vitest run src/analytics/pace-single-source.test.ts -t "pace-derivation"` (stub the call, watch clipping disappear, revert) | ❌ Wave 1 |

**Sampling rate note:** the full archive-wide identity/recount scan (1,874 streams) is a regenerable ARTIFACT (`npm run compute-coverage-identity-recount`), run by hand/CI at phase-close time, never inside `npm test`'s hot path — matching D-03's explicit rejection of "running the full 1,874-stream scan every `npm test`." The FAST `npm test`-time guard stays the extended `unreliable-segment-recount-crosscheck.test.mjs`-style single/few-fixture check.

### Sampling Rate

- **Per task commit:** `npx vitest run <touched test files> -t "<relevant fragment>"`
- **Per wave merge:** `npm test` (full suite) + `npx tsc --noEmit` + `npm run build` + `npm run build-widgets`
- **Phase gate:** full suite green, `npm run compute-coverage-identity-recount` clean (zero identity violations archive-wide), calibration artifact regenerated TWICE and byte-identical, human browser checkpoint (D-13 rows) PASS before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `scripts/compute-coverage-identity-recount.mjs` (or chosen name) + its own `.test.mjs` zero-import guard — does not exist yet, Wave 2 blocking artifact.
- [ ] `scripts/compute-unreliable-segment-severity-calibration.mjs` (or chosen name) + its own `.test.mjs` — does not exist yet, Wave 2, needed before SEG-06's tier constant can ship (Wave 3 depends on this).
- [ ] A fixture `PaceQualityShard`-shaped object carrying at least one `unreliable`-kind `gapInterval`, for `pace-quality-client.test.ts`'s parser tests (closes Pitfall B non-vacuously).
- [ ] Framework install: none — vitest already configured.

## Security Domain

`workflow.security_enforcement` is not present in `.planning/config.json` → treated as enabled, ASVS L1.

**Honest scoping note for the planner's `<threat_model>` block:** this phase is a static, offline analytics compute-and-render change with NO new network input surface, NO new user input surface, and NO new authentication/authorization boundary. It:
- Reads only already-committed, already-trusted `data/streams/*.json` (byte-identical, unwritten by this phase, gated by the pre-existing `compute-stream-checksums.mjs`).
- Writes only to the existing `data/dashboard/index.json` / `data/stats/pace-quality/{id}.json` compute artifacts, through the existing CI compute chain (no new write surface, no new file location).
- Renders only computed numbers and pre-existing device-name free text (`deviceEra.rawDeviceName`) through the SAME `textContent`-only DOM boundary (`appendAccessibleBadge`) already audited for XSS in Phase 27/29 — this phase adds no new raw-string-to-DOM path.
- Adds no new HTTP route, no new curation-transport write, and does not touch `curation-guard.mjs`/`verify-dashboard-publish.mjs`'s existing scope.

A boilerplate ASVS table naming V2/V3/V4/V6 as "not applicable" is honest here, not a rubber-stamp — write the `<threat_model>` block saying so explicitly, with the one relevant control named:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface exists in this static SPA; unchanged by this phase. |
| V3 Session Management | no | No sessions; unchanged. |
| V4 Access Control | no | No access-control boundary touched (curation's origin-gated write path is untouched by this phase). |
| V5 Input Validation | yes (unchanged scope, extended shape) | The existing total/never-throw discipline (T-26-01/T-26-02) already applied to every new field — `pace-quality-client.ts`'s parser functions (which this phase MUST extend for `VALID_GAP_KINDS`) already follow the "malformed entry dropped, never invalidates the whole shard" tolerant-parse pattern; the new `unreliable`-kind value and the new SEG-06 shard/index fields must follow the SAME pattern, not a new one. |
| V6 Cryptography | no | Not touched. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A malformed/adversarial cached `index.json`/shard (stale CDN edge, browser tab left open across deploy) missing the new SEG-06 fields or carrying a malformed `unreliable`-kind interval | Tampering (of a benign kind — stale cache, not an attacker) | Already-established `?? null`/`Pick<>`/tolerant-entry-drop pattern (CR-01 30-REVIEW.md precedent) — extend it, do not invent a new one. |
| Untrusted `deviceEra.rawDeviceName` free text reaching the SEG-06 row (unlikely, since SEG-06 carries no free text, but the surrounding Quality Signals section does) | Tampering/XSS | `appendAccessibleBadge`'s existing `textContent`-only construction — already covers every row in this section, including the new ninth row, with zero additional code. |

## Sources

### Primary (HIGH confidence — direct source read this session)
- `src/analytics/pace-derivation.ts` — `classifyGaps`, `PaceCoverage`, `GapKind`, `GapInterval`, `derivePaceSeriesGapAware`, `paceHistogramSamples`, `paceHistogramAccounting`, `quantile`, `derivePaceWithCoverage` (full file read)
- `src/analytics/unreliable-segments.ts` — `detectUnreliableSegments`, `UnreliableSegment`, `advanceSteps`, `mapGapToIndices`, `isGapPair`, all three calibrated constants and their docblocks (full file read)
- `src/analytics/pace-quality.ts` — `ActivityQualitySignals`, `elevationSignal`, `hasAnySevereSignal`, `gapProfileSignal`/`tierGapProfileFromCoverage`, `resolveCoverage`, `buildPaceQualityShard`, `computePaceQualitySignals`, `GAP_PROFILE_SEVERE_FRACTION`'s full derivation docblock (full file read, 1500 lines)
- `src/dashboard/views/detail-sections.ts` — `coverageCaptionText`, `SplitGapAnnotation`/`splitGapAnnotations`/`dominantGapKindLabel`, `gapProfileRow`, `qualitySignalsSectionPlan`, `EXPLANATION_PROBE_QUALITY`/`EXPLANATION_PROBE_SPECS`, `notAvailableRows` (targeted reads covering all relevant sections)
- `src/dashboard/views/list.ts` — `qualityBadgeSpecs`, `elevationBadgeContent`, `hasAnySevereSignal` usage, `QualityBadgeSpec` (targeted read)
- `src/dashboard/data/pace-quality-client.ts` — `VALID_GAP_KINDS`, `parseGapInterval`, `parsePaceQualityShard` (full file read) — **source of the fourth silent-inheritance trap this research found**
- `src/dashboard/data/index-client.ts`, `src/analytics/dashboard-index.types.ts`, `src/analytics/compute-dashboard-index.ts`, `src/dashboard/views/detail-charts-logic.ts`, `src/dashboard/views/detail-zones.ts`, `src/dashboard/views/detail.ts` — targeted greps + reads confirming inherits-correctly classifications
- `scripts/compute-unreliable-segment-recount.mjs` — full file read (692 lines), the exact algorithm D-03's archive-wide recount must extend
- `scripts/unreliable-segment-recount-crosscheck.test.mjs` — the existing single-activity `npm test`-time crosscheck (partial read)
- `src/analytics/pace-single-source.test.ts` — full file read (788 lines), the exact D-15 single-source-audit mechanism and its allow-listing of `pace-derivation.ts` as the detector's one permitted importer
- `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` — full file read, every constant/statistic/figure-of-record cited above verified against this file directly, not from the prompt's own reference numbers
- `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-CONTEXT.md` — full file read, all 15 decisions
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` (Phase 33 section), `.planning/PROJECT.md` (Current Milestone/Current State sections) — full/targeted reads
- `.planning/research/PITFALLS.md` — full file read, Pitfalls 3/4/5/6/11/12/13 all directly relevant (Pitfall 6, "double-counts with existing gap/pause classes," was found to be exactly this phase's central risk and is not separately numbered in the prompt's priority list but is the same concern as Pitfall A above)
- `data/streams/3475740390.json`, `data/streams/3475734189.json` — read directly (via a Python one-off) to confirm the t=2508→d=7305m→km-split-8 fact and the t=1353–1360 hidden-pause window's containment inside km split 4
- `vitest.config.ts`, `package.json` (scripts section), `.planning/config.json` — read directly for test/validation/security-enforcement configuration

### Secondary / Tertiary
None — no WebSearch, Context7, or external documentation lookup was performed or needed for this phase (no new library, API, or external service is introduced).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new package; every reused primitive verified by direct source read.
- Architecture (the `classifyGaps` widening design): HIGH — the three-pass design is derived directly from the actual current implementation and the actual detector's documented input contract (`gaps: GapSpan[]`), not from general GPS-anomaly-detection theory.
- Consumer inventory: HIGH for the four confirmed traps (all verified by direct source read, including the pace-quality-client.ts trap this research discovered); MEDIUM for the completeness claim itself (a `grep` for the specific symbol names was run, but a symbol renamed or re-exported under a different name in a file not matched by the grep pattern could theoretically be missed — flagged as a residual risk for the plan-checker to re-verify against the merged tree before Wave 1 closes).
- D-07's tier constant: MEDIUM — methodology is HIGH confidence (directly mirrors Phase 32's own three-constant precedent), but the actual numeric value is unknown until a calibration script runs against the live archive (execution-time work, correctly deferred).
- Pitfalls: HIGH — every named pitfall traces to either a direct source-code read or a verbatim-quoted prior incident in this project's own STATE.md/RETROSPECTIVE.md/PITFALLS.md, not general domain knowledge.

**Research date:** 2026-09-21
**Valid until:** this research is tied to the exact current state of `src/analytics/pace-derivation.ts`, `unreliable-segments.ts`, `pace-quality.ts`, and the three detail/list view files — valid until any of those files changes for a reason other than this phase's own plans (e.g. an out-of-band hotfix). Given this milestone's own stated practice of merging origin at least once per phase, re-verify the consumer inventory (Pattern 2's table) against the merged tree if origin has moved non-trivially since 2026-09-21.
