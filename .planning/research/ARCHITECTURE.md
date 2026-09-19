# Architecture Research

**Domain:** Codebase integration — v2.3 "Pause & Slew Integrity" onto the existing v2.2 pace/quality/best-effort subsystem
**Researched:** 2026-09-19
**Confidence:** HIGH (all claims verified against the current source, not training data)

This is not a greenfield ecosystem survey. It answers one question: given the concrete modules that exist today (`pace-derivation.ts`, `pace-quality.ts`, `best-effort-utils.ts`, `best-effort-ceiling.ts`, `compute-best-efforts.ts`, the curation overlay/server, the dashboard index), where does each new v2.3 capability attach so the project's own load-bearing conventions — single-source-of-truth modules, additive schema, demote-never-delete, one shared demotion path, one write transport — hold rather than fork.

## Standard Architecture

### System Overview (v2.3 additions in bold)

```
┌───────────────────────────────────────────────────────────────────────────┐
│  data/streams/{id}.json  — CanonicalStream { t, d, hr?, cadence?, alt? }   │
│  byte-identical, no lat/lng, only source CI can read                       │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  src/analytics/pace-derivation.ts  (pure, client-safe, THE gap/segment     │
│  authority)                                                                │
│  classifyGaps(t,d) → PaceCoverage { coveredSec, recordingGapSec, pauseSec, │
│    **unreliableSec**, gapIntervals: GapInterval[] }                       │
│  **GapKind gains a 3rd member: 'unreliable'**                              │
│  **detectUnreliableSegments(t,d) — NEW, sole detector, called from inside  │
│    classifyGaps**                                                          │
│  derivePaceWithCoverage / derivePaceSeriesGapAware / paceHistogramSamples  │
│  clip on `gapIntervals` generically — already kind-agnostic, so unreliable │
│  segments are clipped for free once they are gapIntervals entries          │
│  streamPaceSecPerKm (span-based, PACE-07, UNCHANGED)                       │
│  **streamRunningPaceSecPerKm — NEW, covered-only aggregate**               │
└───────┬───────────────────────────────┬───────────────────────┬───────────┘
        │ (sole classifyGaps call site) │                       │
        ▼                               ▼                       ▼
┌──────────────────────┐   ┌─────────────────────────┐  ┌──────────────────────┐
│ pace-quality.ts       │   │ compute-dashboard-index │  │ best-effort-utils.ts /│
│ gapProfileSignal,     │   │  .ts — writes index row │  │ compute-best-efforts  │
│ **gapMovementSignal,  │   │  quality, paceDisagree- │  │  .ts — findBestEffort │
│  forgottenStopSignal**│   │  ment, **streamRunning- │  │  gains **unreliable-  │
│ PaceQualityShard      │   │  PaceSecPerKm**         │  │  segment avoidance**  │
│  {id}.json            │   │                         │  │  EffortDemotionGuard  │
│                       │   │                         │  │  gains **'unreliable- │
│                       │   │                         │  │  segment'**           │
└──────────────────────┘   └─────────────────────────┘  └──────────┬───────────┘
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │ best-effort-ceiling.ts│
                                                          │ deriveCeilings — reads│
                                                          │ byDistance, which     │
                                                          │ already only accumu-  │
                                                          │ lates demotion:null   │
                                                          │ efforts (Pass 1) —    │
                                                          │ non-circularity holds │
                                                          │ IF the clean window's │
                                                          │ duration is what      │
                                                          │ populates it (see     │
                                                          │ Q3 below)             │
                                                          └──────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│ scripts/curate-server.mjs + scripts/curate-overlay/  (localhost write     │
│ transport, D-02/D-07/D-09/D-12 security discipline)                       │
│ PUT/DELETE /__curate/exclusions/:id  ── saveExclusion/removeExclusion      │
│ **PUT/DELETE /__curate/reviewed/:id — NEW, structural copy of the above,  │
│   same origin gate, same writeAtomic, same mirror-to-dist pattern,        │
│   own file data/pace-review-state.json**                                  │
│ scripts/curate-queue — derive-flagged.mjs reads bestEfforts+exclusions    │
│   (+index for names); **gains reviewedDoc as a 4th input**                │
└───────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility today | v2.3 change |
|-----------|----------------------|-------------|
| `src/analytics/pace-derivation.ts` | Sole gap classifier + presentation pace series + span-based disagreement check (`pace-derivation.ts:1-665`) | Becomes the sole **unreliable-segment** classifier too; gains `unreliableSec`, a 3rd `GapKind`, and `streamRunningPaceSecPerKm` |
| `src/analytics/pace-quality.ts` | Six per-activity signals + `PaceQualityShard` evidence (`pace-quality.ts:1-1500`) | Adds gap-movement classification + forgotten-stop as new signal(s), reusing `resolveCoverage`'s sole-call-site pattern (`pace-quality.ts:889-891`) |
| `src/analytics/best-effort-utils.ts` | `findBestEffort` two-pointer sweep, `isPlausible` absolute guards (`best-effort-utils.ts:123-196`) | `findBestEffort` gains segment-avoidance; a new guard sibling to `isPlausible` |
| `src/analytics/best-effort-ceiling.ts` | Pure, non-circular per-distance ceiling from an already-filtered population (`best-effort-ceiling.ts:1-226`) | **No code change required** if Q3's design (below) is followed — non-circularity is preserved structurally, not by a new filter |
| `src/analytics/compute-best-efforts.ts` | 3-pass accumulate/derive/filter-and-flag over `data/streams/` (`compute-best-efforts.ts:1-587`) | Pass 1 needs per-activity unreliable intervals; Pass 3's demotion path gains a 4th guard alongside world-record/max-speed/ceiling |
| `scripts/curate-server.mjs` + `scripts/curate-overlay/` | One write transport for exclusions (`curate-server.mjs:339-625`, `curate-overlay/index.ts:113-177`) | A second, structurally identical route/file pair for "reviewed and kept" — not a new transport mechanism |
| `src/analytics/pace-single-source.test.ts` | Structural audit banning a second stream-pace implementation (`pace-single-source.test.ts:1-453`) | Extended with new banned literals for the segment detector's raw arithmetic and its own override surface |

## Recommended Project Structure

No new top-level directories. New files slot beside their nearest sibling:

```
src/analytics/
├── pace-derivation.ts          # MODIFIED — 3rd GapKind, unreliableSec, streamRunningPaceSecPerKm
├── unreliable-segments.ts      # NEW — pure detector: raw per-pair speed scan + run-merge +
│                                #   gap-adjacency merge, mirrors classifyGaps's own shape;
│                                #   imported ONLY by pace-derivation.ts (D-18-style containment)
├── pace-quality.ts             # MODIFIED — gapMovementSignal, forgottenStopSignal
├── pace-single-source.test.ts  # MODIFIED — new BANNED_LITERALS / OVERRIDE_LITERALS entries
├── best-effort-utils.ts        # MODIFIED — findBestEffort gains segment-avoidance option
├── best-effort.types.ts        # MODIFIED — EffortDemotionGuard gains 'unreliable-segment'
├── best-effort-ceiling.ts      # UNCHANGED (see Q3)
├── compute-best-efforts.ts     # MODIFIED — Pass 1 reads unreliable intervals per activity
├── compute-dashboard-index.ts  # MODIFIED — new additive index-row field(s)
└── dashboard-index.types.ts    # MODIFIED — additive only, schemaVersion stays 1

scripts/
├── curate-server.mjs           # MODIFIED — new /__curate/reviewed/:id routes, own JSON file
├── curate-overlay/index.ts     # MODIFIED — markReviewedKept/unmarkReviewedKept, same shape as saveExclusion
├── curate-queue/derive-flagged.mjs   # MODIFIED — 4th input (reviewedDoc), gap-priority sort key
└── compute-unreliable-segment-diff.mjs   # NEW — archive-wide before/after diff + dev sign-off,
                                            #   structural sibling of Phase 28's 28-DIFF.md generator

data/
├── best-effort-exclusions.json     # UNCHANGED — do not fold CUR-04 into this file (see Q6)
└── pace-review-state.json          # NEW, committed — "reviewed and kept" state, same shape family
```

### Structure Rationale

- **`unreliable-segments.ts` as its own file, not inline in `pace-derivation.ts`:** the detector's own raw arithmetic (a per-pair implied-speed scan, structurally identical in shape to `countImpossibleSamples` at `pace-quality.ts:1001-1057`) needs its own home so the single-source audit can allow-list it by path the same way it allow-lists `pace-derivation.ts` itself (`pace-single-source.test.ts:101-113`). It is imported by exactly one caller — `pace-derivation.ts`'s `classifyGaps` — never by `pace-quality.ts` or `compute-best-efforts.ts` directly, so there is exactly one place the raw detector runs per activity and everything downstream reads its output through `PaceCoverage`/`GapInterval`, the same containment discipline `resolveCoverage` already gives `classifyGaps` (`pace-quality.ts:889-891`).
- **No new top-level `src/` directory:** every new capability is a variation on a pattern already owned by an existing module (gap classification → `pace-derivation.ts`; quality signal → `pace-quality.ts`; demotion guard → `best-effort-utils.ts`/`best-effort.types.ts`; curation write → `curate-server.mjs`). Inventing a parallel directory would be exactly the "second locus" shape `pace-single-source.test.ts`'s own docblock (lines 52-82) documents as this project's two historically-real defects.
- **`pace-review-state.json` as its own file, not a field on `best-effort-exclusions.json`:** see Q6 below — the exclusions file is load-bearing for `isExcluded`/ranking (`best-effort-exclusions.ts:27-60`, consumed at `compute-best-efforts.ts:291,322,324,412`); overloading it risks a "reviewed-kept" row being misread as a ranking exclusion by any future reader that doesn't check a new `status` field.

## Architectural Patterns

### Pattern 1: Third `GapKind`, not a parallel segment list

**What:** Unreliable segments are classified through `classifyGaps`'s existing per-pair strict-priority scan (`pace-derivation.ts:195-263`) as a new `GapKind` member (`'unreliable'`), merged into the *same* `gapIntervals: GapInterval[]` array that `recording-gap`/`pause` already populate.

**When to use:** Whenever the new segment must be excluded from a pace figure. This is the entire mechanism by which target feature #2 ("Pace chart and histogram clip unreliable segments exactly as they clip gaps today") is satisfied with **zero changes** to `derivePaceSeriesGapAware` (`pace-derivation.ts:363-418`) or `paceHistogramSamples`/`paceHistogramAccounting` (`pace-derivation.ts:504-570`) — both already clip/exclude purely by interval boundary, never by `kind`. Verify this claim before relying on it: `derivePaceSeriesGapAware`'s clamping logic (`pace-derivation.ts:393-398`) and `paceHistogramSamples`'s membership test (`pace-derivation.ts:516`) both operate on `gapIntervals` generically.

**Trade-offs:** The exact-sum identity (`coveredSec + recordingGapSec + pauseSec === spanSec`, `pace-derivation.ts:63-73`) must widen to a 4-term identity (`+ unreliableSec`). Every existing consumer of `PaceCoverage` (`gapProfileSignal` at `pace-quality.ts:950-957`, and any future reader) must be re-audited for an assumption that only two non-covered categories exist — grep for `recordingGapSec + pauseSec` (currently exactly one hit, `pace-quality.ts:921`) before shipping.

**Design detail worth deciding explicitly in the phase, not left implicit:** the milestone's own language — "merged with any adjacent gap into one segment that conserves its real distance and real elapsed time" — means classification is two-pass, not one:
1. **Unchanged pass:** `classifyGaps`'s existing priority scan runs exactly as today over `covered`-classified segments — this keeps the byte-identical 1,233/321-activity gap/pause cohorts from `26-RESIDUAL.md` stable.
2. **New pass, over `covered` segments only:** a per-pair implied-speed scan (raw `dd/dt`, no smoothing — the same "raw, unsmoothed" discipline `countImpossibleSamples` locks at `pace-quality.ts:969-976`, for the same reason: a windowed/smoothed check would dilute a short burst into a long window, which is exactly the v2.2 blind spot this milestone exists to close) against a calibrated physical speed limit, merging contiguous violating pairs into runs (`computeFlatRunDurations`'s maximal-run technique, `pace-derivation.ts:151-166`, is the precedent to copy, not reinvent).
3. **Merge pass:** any `'unreliable'`-classified run whose boundary touches a `recording-gap` or `pause` interval is unioned with it into one `GapInterval` of kind `'unreliable'` spanning both, and that interval's seconds move out of `recordingGapSec`/`pauseSec` into `unreliableSec` (never double-counted — this is what "conserves its real distance and real elapsed time" cashes out to structurally). A **standalone** unreliable run with no adjacent gap (the isolated-GPS-jump case, 3475740390's five 25-52m jumps) stays a bare `'unreliable'` interval carved directly out of `coveredSec`.

This two-pass-plus-merge shape is a recommendation, not a verified implementation — it is the design that keeps the exact-sum identity, reuses every existing clip mechanism, and matches the three mechanisms named in scoping (gap-adjacent slew, hidden-pause burst with no gap at all, isolated jump) without inventing three separate code paths. It needs its own calibration research (the physical speed limit, distinct from `WORLD_RECORD_100M_SPEED_MPS` — the archive's crude sweep in `PROJECT.md` used 7 m/s as a first-pass floor) before being locked, the same way `PAUSE_GAP_P90_MULTIPLIER` and `GAP_PROFILE_SEVERE_FRACTION` were each measured, not guessed (`pace-derivation.ts:43-50`, `pace-quality.ts:836-871`).

**Example (shape, not literal code):**
```typescript
// pace-derivation.ts — extends the existing GapKind union
export type GapKind = 'recording-gap' | 'pause' | 'unreliable';
export interface PaceCoverage {
  spanSec: number;
  coveredSec: number;
  recordingGapSec: number;
  pauseSec: number;
  unreliableSec: number;       // NEW
  gapIntervals: GapInterval[]; // unchanged shape, now carries 'unreliable' entries too
}
```

### Pattern 2: The demotion path gains a 4th guard, not a parallel effort array

**What:** `EffortDemotionGuard` (`best-effort.types.ts:79`) currently has three members (`'world-record' | 'max-speed' | 'ceiling'`), each constructed by exactly one function (`isPlausible` at `best-effort-utils.ts:170-196`, `ceilingDemotion` at `best-effort-ceiling.ts:206-225`) and consumed through exactly one shared field (`ComputedEffort.demotion`, `best-effort.types.ts:96-121`). The new guard (`'unreliable-segment'`) must follow the identical shape: one new constructor, one new discriminator value, the same `EffortDemotion { guard, reason }` record — never a parallel "contaminated efforts" array or a second demotion field.

**When to use:** Any time `findBestEffort`'s naive two-pointer result (`best-effort-utils.ts:123-152`) spans an unreliable interval.

**Trade-offs — the genuinely new problem, not solved by precedent alone:** every existing guard demotes the ONE window `findBestEffort` already found; it does not search for a second, different window. v2.3's amended rule ("demote the contaminated effort AND search for the best clean window") needs a *second* timing per (activity, distance) for the cases where they differ — something no existing guard does. Two shapes were considered:

- **Rejected: two full `ComputedEffort` rows per distance.** `ActivityBestEfforts.efforts[]` is walked by `.find((e) => e.distance === key)` in at least three places in `compute-best-efforts.ts` (lines 392, 411, 430) that assume exactly one entry per distance. Two rows would silently break all three without a compile error, the same shape as the Phase 27 G-04 defect (`PROJECT.md`, "one row lacking the key blanked the ENTIRE Activities list").
- **Recommended: one row, an optional `contaminated` field.** `ComputedEffort` gains `contaminated?: { durationSec, startOffsetSec, endOffsetSec, demotion: EffortDemotion } | null`, populated only when the raw (unconstrained) `findBestEffort` result differs from the segment-avoiding result. The top-level `durationSec`/`startOffsetSec`/`endOffsetSec`/`demotion` fields always describe the **clean** result (or `demotion` from an existing absolute/ceiling guard if the clean result itself is implausible). This mirrors the existing `SubGroundSignal`/`ClosureDriftSignal`/`VerticalRateSignal` nested-optional-evidence convention already in `pace-quality.ts:157-207`, and keeps every `.find((e) => e.distance === key)` call site correct with zero change.

**Why this also solves Q3's ceiling non-circularity question, structurally:** Pass 1's population accumulator already only admits efforts whose `demotion` is `null` (`compute-best-efforts.ts:304`: `if (effort.demotion !== null) continue;`) into `byDistance`, which is the only thing `deriveCeilings` ever reads (`compute-best-efforts.ts:347-353`, `best-effort-ceiling.ts:157-168`). If the top-level `durationSec` is *always* the clean-window value (per the recommendation above), the contaminated (fast, guard-spanning) timing structurally can never reach `impliedSpeedsByDistance` — **no new filter step is needed in `best-effort-ceiling.ts`, and that file requires no code change at all.** This directly answers the milestone's own observation that "contaminated efforts currently sit IN the p90 population": today they sit there because `findBestEffort` has no segment-avoidance at all and its single result becomes the ranked timing; once the ranked timing is redefined as the clean-window result, the contamination is removed from the ceiling's input at the source, not filtered out after the fact.

### Pattern 3: New quality signals reuse the shard-vs-row split, not a new file format

**What:** Gap movement classification (stationary/walked/transported) is inherently per-interval and variable-length — it belongs in `PaceQualityShard` (`pace-quality.ts:1293-1325`), extending `GapInterval` (or a parallel array keyed the same way) with a `movementClass` field, following the same evidence-lives-in-the-shard discipline the capped `impossibleSamples`/`elevationVerticalRateSamples` lists already use (`pace-quality.ts:1298,1321`). A per-activity **summary** (e.g. the worst class present, needed for review-queue sorting) is small and fixed-shape, so it belongs on the index row as a new key inside `ActivityQualitySignals` (`pace-quality.ts:475-510`) — additive, following the exact precedent Phase 30's `elevation` signal set (added as a 6th top-level key with `DASHBOARD_INDEX_SCHEMA_VERSION` left at `1`, `dashboard-index.types.ts:17-22`).

**When to use:** Forgotten-stop is a duration-threshold read of the *existing* `pause`-kind `gapIntervals` entries — `classifyGaps` already isolates every "distance froze for longer than this activity's own advance-interval distribution justifies" run (`pace-derivation.ts:168-194`). No new detection math is needed; a new small pure function (sibling to `elapsedVsMovingSignal`, `pace-quality.ts:639-655`) reduces the existing `pauseSec`/longest-pause-interval data into a flag, "flag only, no time removed" per the non-goal already stated in scoping.

**Trade-offs:** Both new signals must be threaded through `computePaceQualitySignals`/`buildPaceQualityShard`'s existing "never partially fills" contract (`pace-quality.ts:1226-1274`, `1394-1499`) — an activity is either fully computed or fully `not-computable`, never a mix. `notComputableSignals` (`pace-quality.ts:686-721`) must grow the same two new keys with their own not-computable shape.

## Data Flow

### Detection → clipping → surfacing

```
data/streams/{id}.json (t,d)
    ↓
pace-derivation.ts: classifyGaps(t,d)
    ↓ (internally: unreliable-segments.ts's detector, merge pass)
PaceCoverage { ..., unreliableSec, gapIntervals[incl. 'unreliable'] }
    ↓                                    ↓                        ↓
derivePaceWithCoverage            pace-quality.ts:               compute-best-efforts.ts:
(chart/histogram/caption,         resolveCoverage → gapProfile-  needs the SAME unreliable
 clipped for free via             /gapMovement/forgottenStop     intervals, per activity, to
 gapIntervals, no code change)    signals + shard evidence        gate findBestEffort — a NEW
                                                                   read of the activity's
                                                                   stream+classifyGaps result
                                                                   inside computeActivityEfforts
                                                                   (best-effort-utils.ts is pure
                                                                   and must not import Node fs,
                                                                   so this wiring happens in
                                                                   compute-best-efforts.ts's
                                                                   caller, mirroring how it
                                                                   already reads t/d today at
                                                                   compute-best-efforts.ts:270)
```

### Best-effort demotion + ceiling flow

```
computeActivityEfforts (compute-best-efforts.ts:111-172)
    ↓ findBestEffort(t,d,target, {avoid: unreliableIntervals})
    ↓   → clean RawEffort (or undefined if no clean window exists)
    ↓ findBestEffort(t,d,target)  [existing, unconstrained]
    ↓   → raw RawEffort
    ↓ if raw window spans an unreliable interval and raw !== clean:
    ↓   effort.contaminated = { ...raw, demotion: { guard: 'unreliable-segment', reason } }
    ↓ effort.durationSec/.../demotion = clean result (existing isPlausible/ceiling guards
    ↓   still apply to the CLEAN result, unchanged)
    ↓
Pass 1 byDistance accumulation (compute-best-efforts.ts:249-333)
    — reads effort.durationSec/effort.demotion, UNCHANGED code, now naturally clean-only
    ↓
Pass 2 deriveCeilings (best-effort-ceiling.ts) — UNCHANGED, non-circular by construction
    ↓
Pass 3 ceilingDemotion sweep — UNCHANGED, applies to the clean result exactly as today
```

### Curation write flow (CUR-04)

```
Review queue row "Mark reviewed & kept" button
    ↓ scripts/curate-overlay/index.ts: markReviewedKept(activityId)
    ↓ fetch PUT /__curate/reviewed/:id   [NEW route, same isTrustedOrigin gate,
    ↓                                     same readJsonBody/normalizeReason discipline
    ↓                                     as handleExclusionWrite, curate-server.mjs:560-625]
    ↓ applyUpsert-equivalent over data/pace-review-state.json (NEW file)
    ↓ writeAtomic (curate-server.mjs:414-418, reused verbatim)
    ↓ mirror to dist/widgets/data/pace-review-state.json (curate-server.mjs:429-437 pattern, reused)
    ↓ location.reload()
    ↓
scripts/curate-queue/derive-flagged.mjs: deriveFlaggedActivities(bestEffortsDoc,
  exclusionsDoc, indexDoc, reviewedDoc)   ← 4th param, same optional-enrichment
  precedent PD-01 already set for indexDoc (Phase 29)
```

## Scaling Considerations

Not a user-growth question — this is a single-archive, single-developer tool. The relevant "scale" axis is archive size and per-activity compute cost.

| Concern | Today (~1,899 activities) | After v2.3 |
|---------|---------------------------|------------|
| Per-activity compute in `compute-best-efforts.ts` | One `findBestEffort` sweep per target distance (O(n) two-pointer) | Two sweeps per target distance (clean + raw) — roughly 2x the best-effort compute pass, still O(n) per activity, negligible at this archive size |
| `compute-dashboard-index.ts` wall time | Already logs its own quality-pass cost (`qualityComputeMs`, `compute-dashboard-index.ts:161`) | Add the new signals to the same timing block rather than a silent second pass, continuing the project's own "wall time is disclosed" convention |
| `data/streams/` | Byte-identical, no lat/lng, CI-readable | **Stays byte-identical** — the whole detector must work from `t`/`d` alone; this is the hard constraint the milestone context states explicitly ("CI has NO access to export_data/ ... detection must run on committed t/d streams") |
| Gitignored regenerated artifacts (`data/stats/best-efforts.json`, `data/stats/pace-quality/{id}.json`) | Regenerated every run | Grows by one nested field per shard; no new per-activity file needed |

## Anti-Patterns to Avoid

### Anti-Pattern 1: A second gap-membership or speed-threshold implementation outside `pace-derivation.ts`

**What people will be tempted to do:** compute the unreliable-segment check directly inside `compute-best-efforts.ts` or `pace-quality.ts` (both already have `t`/`d` in hand), rather than routing through `classifyGaps`.

**Why it's wrong:** this is the exact historically-real defect `pace-single-source.test.ts`'s docblock names twice (lines 52-82) — a second locus with no arithmetic resembling the banned literals (the `detail-zones.ts` `maskedPaceSeries` incident) slipped past the literal-string audit entirely and needed a structural `gapIntervals.some(`/`.find(` containment check instead. A second unreliable-segment detector would recreate that exact blind spot for a brand-new mechanism.

**Do this instead:** one detector, called once inside `classifyGaps`; every other module reads `PaceCoverage.gapIntervals`/`unreliableSec`. Extend `pace-single-source.test.ts`'s `OVERRIDE_LITERALS`/`GAP_MEMBERSHIP_LITERALS` pattern (`pace-single-source.test.ts:240-260`) with the new detector's own raw-arithmetic literal(s) and confine them to `unreliable-segments.ts` + `pace-derivation.ts` + `*.test.ts`, in the same PR that introduces the detector — this project's own most load-bearing convention is "a guard assertion must be watched failing before it may pass" (`PROJECT.md` Key Decisions table), so the audit extension should ship with a planted-violation test, not as an afterthought.

### Anti-Pattern 2: Folding "reviewed and kept" into `best-effort-exclusions.json`

**What people will be tempted to do:** add a `status: 'excluded' | 'reviewed-kept'` field to the existing exclusion entries, since the file/route/transport already exists and CUR-04 explicitly wants to reuse the write path.

**Why it's wrong:** `best-effort-exclusions.ts`'s `buildExclusionIndex` (lines 27-60) and every consumer of its output (`isExcluded` at `compute-best-efforts.ts:291,322,324,412`) treat *presence in this file* as the entire signal — there is no status check anywhere in that path today. A `status`-widened entry would need every one of those call sites updated in lockstep, and a single missed one would silently exclude a "kept" activity from PR ranking — the inverse of what CUR-04 is for. This is also a live, load-bearing regression fixture area: `29-REVIEW.md` WR-02 already documents two independent flagged counts disagreeing on duplicate/`reason: null`/`__proto__` exclusion entries; widening the schema mid-stream multiplies that surface.

**Do this instead:** a new, separate committed file (`data/pace-review-state.json`) and a new route pair under the same `/__curate/` prefix, reusing `writeAtomic`/`isTrustedOrigin`/the mirror-to-`dist` pattern verbatim (`curate-server.mjs:414-437,467-476`). This is not "a second write surface" in the sense CUR-04's scoping warns against — it is the same transport mechanism, security gate, and atomicity discipline, instantiated a second time for a semantically distinct piece of state, exactly the way `data/best-effort-ceiling.json` and `data/best-effort-exclusions.json` already coexist as two separate committed documents with two different meanings. It also costs nothing extra on the publish-guard side: `curation-guard.mjs`'s `findCurationArtifacts` scans generically for the literal `__curate` marker (`curation-guard.mjs:57-58,192-195`), so a new `/__curate/reviewed/...` route is covered by the existing guard with no code change — only `verify-dashboard-publish.mjs`'s explicit route-reachability assertions need a new line, mirroring Phase 29's CUR-03 ("Both publish guards cover the two new routes").

### Anti-Pattern 3: Letting the raw (contaminated) window's duration reach the PR ranking population

**What people will be tempted to do:** keep `ComputedEffort.durationSec` as today's single `findBestEffort` result (the fastest, possibly contaminated, window) and merely attach a `demotion` to it — the same shape every existing guard uses.

**Why it's wrong:** Pass 1's population accumulator (`compute-best-efforts.ts:304`) already skips any effort with a non-null `demotion`, which means the activity would contribute **nothing** for that distance — not even its real, clean time — silently shrinking the ceiling's population and producing no ranked record at all for a run that genuinely did complete that distance cleanly. This is a real, not hypothetical, correctness gap in the naive "just add a 4th guard" approach.

**Do this instead:** Pattern 2 above — the top-level fields are always the clean-window result; `contaminated` is a strictly additional, nested, optional disclosure field.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `unreliable-segments.ts` ↔ `pace-derivation.ts` | Direct import, one call site inside `classifyGaps` | New module is NOT imported by `pace-quality.ts`, `compute-best-efforts.ts`, or any dashboard view — everything downstream reads `PaceCoverage`/`GapInterval` |
| `pace-derivation.ts` ↔ `pace-quality.ts` | `classifyGaps` via `resolveCoverage` (`pace-quality.ts:889-891`), `adaptiveWindowSec`, `quantile` | Unchanged call shape; `gapProfileSignal`'s fraction formula (`pace-quality.ts:921`) needs updating to decide whether `unreliableSec` counts toward "non-covered" for that signal, or whether a sibling signal owns it — this is a phase-level decision, not resolved by architecture alone |
| `pace-derivation.ts` ↔ `compute-best-efforts.ts` | Currently NONE — `compute-best-efforts.ts` reads raw `t`/`d` directly (`compute-best-efforts.ts:270`) and never calls `classifyGaps` | v2.3 must add this boundary: `computeActivityEfforts`'s caller needs `classifyGaps(t,d).gapIntervals` (filtered to `'unreliable'` kind) passed into `computeActivityEfforts`/`findBestEffort`. `best-effort-utils.ts` itself stays pure (no `fs`) — the classification happens in the caller, same as today's stream read already does |
| `compute-dashboard-index.ts` ↔ `pace-derivation.ts` | `detectPaceDisagreement`/`streamPaceSecPerKm`, one of the four allow-listed metadata/aggregate sites (`pace-single-source.test.ts:22-25,315-334`) | Add `streamRunningPaceSecPerKm` as a second call from the same allow-listed site — do not add a 5th allow-listed file |
| `curate-overlay/index.ts` ↔ `curate-server.mjs` | Root-absolute `/__curate/...` fetch, same-origin gate | New `markReviewedKept`/`unmarkReviewedKept` functions in the same file, same `describeFailure` helper (`curate-overlay/index.ts:95-111`), same reload-on-success discipline |
| `curate-queue` ↔ `data/pace-review-state.json` | New optional 4th parameter to `deriveFlaggedActivities` | Matches the existing PD-01 precedent of `indexDoc` as an optional read-only enrichment input (Phase 29) |

## Suggested Build Order

Dependencies point one direction — detection first, everything else reads its output. CUR-04 is fully orthogonal and can move anywhere in the sequence without risk; putting it last keeps the riskiest, most novel work (the demotion-path change in Pattern 2) isolated and reviewable on its own.

1. **Unreliable-segment detector + calibration** (`unreliable-segments.ts`, archive-wide speed-limit calibration against the flagged activities and the crude 259/1,873-stream sweep). Ship the single-source audit extension (`pace-single-source.test.ts`) in the *same* phase, with a planted-violation test, per this project's own convention.
2. **Wire the detector into `classifyGaps`** — 3rd `GapKind`, `unreliableSec`, the merge pass. This alone satisfies target feature #2 (pace chart/histogram/coverage-caption clipping) with no changes outside `pace-derivation.ts`, because the clip machinery is already kind-agnostic. Re-run the archive-wide gap/pause cohort measurements (`26-RESIDUAL.md`-style) to prove the unchanged-pass claim in Pattern 1 holds byte-for-byte.
3. **`pace-quality.ts` signals** — gap-movement classification + forgotten-stop, in the shard/row split described in Pattern 3. Depends on (2)'s `gapIntervals` carrying real per-interval distance (add a `distanceM` field to `GapInterval` or compute it inline via `interpValueAtTime`, already imported at `pace-derivation.ts` scope).
4. **`streamRunningPaceSecPerKm`** — new aggregate in `pace-derivation.ts`, surfaced via `compute-dashboard-index.ts` as a new additive index-row field, rendered beside metadata pace in `detail.ts`. Depends only on (2). Independent of (3) and (5) — can run in parallel.
5. **Best-effort guard** — `findBestEffort` segment-avoidance, `EffortDemotionGuard` 4th member, `ComputedEffort.contaminated`, Pass 1 wiring in `compute-best-efforts.ts`. Depends on (2) (needs per-activity unreliable intervals). This is the highest-risk phase — it changes a ranking-critical path and the ceiling's population composition — and should end with its own archive-wide before/after diff and developer sign-off, structurally mirroring `28-DIFF.md`/PR-04's precedent (`PROJECT.md` Phase 28 history).
6. **Gap classification as review-queue priority** — extends `curate-queue/derive-flagged.mjs` to read the new per-activity summary signal from (3) via the index doc, sorting/prioritizing rows. Small, depends on (3).
7. **CUR-04 "reviewed and kept"** — new file, new route pair, new overlay functions, new queue button. Zero dependency on (1)-(6); can be built first, last, or in parallel. Recommended last so it closes the milestone the way Phase 29 closed v2.2's curation work — a low-risk, well-precedented feature after the higher-risk pace/segment/ranking changes have landed and been diffed.

Steps (4) and (6) can be reordered or merged with adjacent steps without breaking dependencies; steps (1)→(2)→(5) are a strict chain and should not be parallelized.

## Sources

- `/Users/pedf/workspace/strava-widgets/.planning/PROJECT.md` — § Current Milestone: v2.3, § Key Decisions, § Requirements (Validated) for v2.2's precedents
- `/Users/pedf/workspace/strava-widgets/src/analytics/pace-derivation.ts` (read in full)
- `/Users/pedf/workspace/strava-widgets/src/analytics/pace-quality.ts` (read in full)
- `/Users/pedf/workspace/strava-widgets/src/analytics/pace-single-source.test.ts` (read in full)
- `/Users/pedf/workspace/strava-widgets/src/analytics/best-effort-utils.ts` (read in full)
- `/Users/pedf/workspace/strava-widgets/src/analytics/best-effort-ceiling.ts` (read in full)
- `/Users/pedf/workspace/strava-widgets/src/analytics/best-effort.types.ts` (lines 1-140)
- `/Users/pedf/workspace/strava-widgets/src/analytics/compute-best-efforts.ts` (read in full)
- `/Users/pedf/workspace/strava-widgets/src/analytics/dashboard-index.types.ts` (read in full)
- `/Users/pedf/workspace/strava-widgets/src/analytics/best-effort-exclusions.ts` (lines 1-60)
- `/Users/pedf/workspace/strava-widgets/src/streams/stream.types.ts` (lines 1-80)
- `/Users/pedf/workspace/strava-widgets/src/compute-all-stats-steps.ts` (read in full)
- `/Users/pedf/workspace/strava-widgets/scripts/curate-server.mjs` (lines 1-100, 330-870)
- `/Users/pedf/workspace/strava-widgets/scripts/curate-overlay/index.ts` (read in full)
- `/Users/pedf/workspace/strava-widgets/scripts/curate-overlay/exclusion-panel.ts` (read in full)
- `/Users/pedf/workspace/strava-widgets/scripts/curate-queue/derive-flagged.mjs` (read in full)
- `/Users/pedf/workspace/strava-widgets/scripts/lib/curation-guard.mjs` (grep, lines around 57-195)
- `/Users/pedf/workspace/strava-widgets/src/analytics/compute-dashboard-index.ts` (grep for quality/paceDisagreement call sites)
- `/Users/pedf/workspace/strava-widgets/src/dashboard/views/detail.ts` (grep for paceDisagreement rendering, lines 671-794)

---
*Architecture research for: strava-widgets v2.3 "Pause & Slew Integrity" codebase integration*
*Researched: 2026-09-19*
