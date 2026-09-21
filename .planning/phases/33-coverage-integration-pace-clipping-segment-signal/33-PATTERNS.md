# Phase 33: Coverage Integration — Pace Clipping & Segment Signal - Pattern Map

**Mapped:** 2026-09-21
**Files analyzed:** 13 (6 modified source files, 1 test-extension, 2 new calibration/recount scripts + their `.test.mjs`, 1 new calibration artifact, 3 planning-doc amendments)
**Analogs found:** 13 / 13 — every file this phase touches already has a same-repo precedent to copy verbatim; this is almost entirely a "widen an existing shape" phase, not a "design a new shape" phase.

No `./CLAUDE.md` and no `.claude/skills/`/`.agents/skills/` directory exist in this repo (confirmed this session, matching Phase 32's own finding) — nothing project-specific to load beyond REQUIREMENTS.md/PROJECT.md conventions already carried by CONTEXT.md/RESEARCH.md.

All code excerpts below were read directly from the live tree this session (not copied from RESEARCH.md) and are quoted with real file:line references.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog (same file, widened) | Match Quality |
|---|---|---|---|---|
| `src/analytics/pace-derivation.ts` (`classifyGaps`, `GapKind`, `GapInterval`, `PaceCoverage`) | service (pure compute, shared classifier) | transform (3-pass batch over `t[]`/`d[]`) | itself — the 3-way loop being widened to 4-way; detector call modelled on `elevationSignal`'s single-call discipline | exact — widening the function that already exists |
| `src/analytics/unreliable-segments.ts` (`detectUnreliableSegments`) | service (pure compute, leaf module) | transform (batch) | unchanged this phase (Phase 32 shipped it) — only its ONE new caller matters | exact (consumer-side change only) |
| `src/analytics/pace-quality.ts` (`gapProfileSignal`/`tierGapProfileFromCoverage`, `hasAnySevereSignal`, `computePaceQualitySignals`, `buildPaceQualityShard`, new `unreliableSegmentsSignal`/`UnreliableSegmentsSignal`) | service (tiering/composite assembly) | transform | itself — `elevationSignal`/`ElevationSignal` (`:452-468`, `:202-209`) is the exact fifth/seventh-signal template; `tierGapProfileFromCoverage` (`:907-940`) is the exact numerator-widening template | exact |
| `src/dashboard/views/detail-sections.ts` (`coverageCaptionText`, `SplitGapAnnotation`/`splitGapAnnotations`/`dominantGapKindLabel`, `gapProfileRow`, `qualitySignalsSectionPlan`, `notAvailableRows`, `EXPLANATION_PROBE_QUALITY`) | component (pure render-plan, no DOM) | transform | itself — `decimationRow`/`subGroundRow` (`:965-999`, `:1106-1137`) are the exact ninth-row template; `notAvailableRows` (`:1301-1360`) is the exact "extend the literal list" template | exact |
| `src/dashboard/views/list.ts` (`qualityBadgeSpecs`, new `unreliableSegmentsBadgeContent`) | component (pure render-plan, no DOM) | transform | itself — `elevationBadgeContent`/the elevation `if` block in `qualityBadgeSpecs` (`:480-538`) is the exact fifth-badge-source template | exact |
| `src/dashboard/data/pace-quality-client.ts` (`VALID_GAP_KINDS`, `parseGapInterval`, `parseActivityQualitySignals`) | service (tolerant network-response parser) | transform (parse, fail-open per field) | itself — `VALID_ELEVATION_TIERS`'s deliberately-separate-Set precedent (`:59`) and `parseElevationSignal`'s all-or-nothing nested-parse shape (`:177-188`) | exact |
| `src/analytics/dashboard-index.types.ts` (`ActivityQualitySignals` reference only — no direct edit expected) | config (type contract) | — | `quality: ActivityQualitySignals` (`:132`) already nests the whole signal tree; adding a 7th signal is an edit to `pace-quality.ts`'s interface, not to this file, and `DASHBOARD_INDEX_SCHEMA_VERSION` precedent (`:17-22`, `:126-128`) documents why the version stays `1` | exact (precedent for *not* touching this file beyond a doc comment) |
| `src/analytics/compute-dashboard-index.ts` (`computePaceQualitySignals`/`buildPaceQualityShard` call site) | controller (CI compute orchestration) | batch | itself, lines 302-313 — confirms NO per-signal call-site change is needed; the seventh signal is computed *inside* `pace-quality.ts` and simply appears in the returned object | exact (no-op confirmation) |
| `scripts/compute-coverage-identity-recount.mjs` (or chosen name, D-03) | utility (archive-wide independent recount) | batch, fails-closed | `scripts/compute-unreliable-segment-recount.mjs` (full file, zero-import discipline, `recountGapFirst`/`computeRunsInSegment`/`main()`) | exact |
| `scripts/compute-unreliable-segment-severity-calibration.mjs` (or chosen name, D-07) | utility (calibration generator) | batch | `scripts/compute-unreliable-segment-calibration.mjs` (per Phase 32's own PATTERNS.md — unchanged this phase, still the live analog) | exact |
| `scripts/*.test.mjs` (both new scripts' test files) | test | — | `scripts/compute-pr-ceiling-recount.test.mjs` (zero-import guard, verified working) — Phase 32 PATTERNS.md's own analog, still valid | exact — **see Pitfall flagged below** |
| `.planning/phases/33-.../33-CALIBRATION.md` | committed artifact | — | `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` (full shape) | exact |
| `.planning/ROADMAP.md` / `.planning/REQUIREMENTS.md` (D-12, D-15 dated amendments) | config (planning doc edit) | — | Phase 32's own D-03/D-14 dated-amendment precedent (`32-PATTERNS.md`'s own note: "read the live files directly when planning the amendment task") | n/a — doc edit, not code pattern |

## Pattern Assignments

### `src/analytics/pace-derivation.ts` — `classifyGaps` widening (PACE-08, D-01/D-02)

**Analog:** itself, `src/analytics/pace-derivation.ts:195-263` (read in full this session, confirms RESEARCH.md's quote verbatim — current source, not stale).

**Current three-way loop, the exact thing to widen** (`:226-256`):
```typescript
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

  if (kind === 'recording-gap') recordingGapSec += dt;
  else if (kind === 'pause') pauseSec += dt;
  else coveredSec += dt;

  if (kind === 'covered') {
    if (openKind !== null) {
      gapIntervals.push({ startSec: openStartSec, endSec: t[i], kind: openKind });
      openKind = null;
    }
  } else if (openKind === kind) {
    // Same-kind run continues — extend without emitting yet.
  } else {
    if (openKind !== null) {
      gapIntervals.push({ startSec: openStartSec, endSec: t[i], kind: openKind });
    }
    openKind = kind;
    openStartSec = t[i];
  }
}
```
The merge logic (`openKind === kind` / else close-and-reopen) is already kind-count-agnostic — RESEARCH.md's Pattern 1 claim that this generalizes to N kinds with zero structural change is confirmed by direct read: nothing here special-cases exactly two non-covered kinds.

**Current type/interface to widen** (`:52-73`):
```typescript
export type GapKind = 'recording-gap' | 'pause';

export interface GapInterval {
  startSec: number;
  endSec: number;
  kind: GapKind;
}

export interface PaceCoverage {
  spanSec: number;
  coveredSec: number;
  recordingGapSec: number;
  pauseSec: number;
  gapIntervals: GapInterval[];
}
```
`zeroCoverage()` (`:86-89`) must also gain `unreliableSec: 0`.

**Entry-guard total-function discipline to preserve exactly** (`:200`):
```typescript
if (!validateStreamSeries(t as number[], d as number[]).ok) return zeroCoverage();
```

**The detector's own contract this new Pass 2 call must honour** (`src/analytics/unreliable-segments.ts:476-485`, read in full):
```typescript
export function detectUnreliableSegments(
  t: readonly number[],
  d: readonly number[],
  gaps: readonly GapSpan[],
  params: DetectorParams = DEFAULT_DETECTOR_PARAMS
): UnreliableSegment[] {
  if (!Array.isArray(t) || !Array.isArray(d)) return [];
  if (!gapListIsWellShaped(gaps)) return [];
  if (!validateStreamSeries(t as number[], d as number[]).ok) return [];
  if (!paramsAreValid(params)) return [];
  ...
```
Total, never-throws, returns `[]` on any malformed input — `classifyGaps` may call it unconditionally without a defensive try/catch.

**`UnreliableSegment`'s exact index fields Pass 3's containment test must use** (`unreliable-segments.ts:183-198`):
```typescript
export interface UnreliableSegment {
  startIndex: number;
  endIndex: number;
  startSec: number;
  endSec: number;
  metres: number;
  seconds: number;
  mechanism: SegmentMechanism;
  burstMetres: number;
  burstSeconds: number;
  gapMetres: number;
  gapSeconds: number;
  burstCount: number;
  gapCount: number;
  parts: SegmentPart[];
}
```
`startIndex`/`endIndex` are the exact sample indices to reuse for pair-containment (RESEARCH.md's index-based-not-float argument, confirmed by direct read — no separate `startSec`-based membership helper exists in this file to accidentally diverge from).

**The single-permitted-importer guard already anticipates this exact wiring** (`src/analytics/pace-single-source.test.ts:106-113`, read in full):
```
 * The audit bans a second IMPLEMENTATION of the detector's arithmetic or a
 * second IMPORTER of its exports — it does NOT ban a second CALLER of
 * `detectUnreliableSegments` reached through its one allowed importer.
 * `pace-derivation.ts` is allow-listed for import because Phase 33 folds
 * this detector into `classifyGaps` there (this module's own docblock,
 * lines 10-16); today it imports nothing from this module. Widening this
 * allowlist in a later phase needs its own recorded reason...
```
Confirmed live: `ALLOWED_FILE_SUFFIX = 'analytics/pace-derivation.ts'` (`:138`) already allow-lists `pace-derivation.ts` as an importer of `unreliable-segments.ts`. **No change needed to `pace-single-source.test.ts`'s allowlist itself** — D-15's task is a NEW test proving the import is *load-bearing* (stub the call, watch clipping disappear, revert), not widening this allowlist (it's already wide enough).

---

### `src/analytics/pace-quality.ts` — the elevation precedent, verified verbatim (SEG-06, D-06/D-07/D-08)

**Analog:** `elevationSignal`/`ElevationSignal`/`hasAnySevereSignal` — all read in full this session at their live line numbers (not RESEARCH.md's cached numbers, though they match).

**`ElevationSignal`'s never-widen doc comment — the exact twin SEG-06 needs** (`:475-510`, `ActivityQualitySignals` interface):
```typescript
export interface ActivityQualitySignals {
  decimation: DecimationSignal;
  gapProfile: GapProfileSignal;
  impossibleSamples: ImpossibleSampleSignal;
  /**
   * Sixth signal (D-05, Phase 30 ELEV-01): altitude-implausibility
   * detection across three independent modes (sub-ground readings,
   * loop-gated closure drift, implausible vertical rate). Tiered (D-07),
   * but DELIBERATELY EXCLUDED from `anySevere` below (D-06) — bad
   * altitude says nothing about pace trust, since no grade-adjusted pace
   * ships this milestone. `hasAnySevereSignal`'s `Pick<>` is NEVER widened
   * to include this key; see that function's own doc comment and the
   * `anySevere excludes elevation` test in `pace-quality.test.ts`.
   */
  elevation: ElevationSignal;
  deviceEra: DeviceEraSignal;
  elapsedVsMoving: ElapsedVsMovingSignal;
  anySevere: boolean;
  notComputableReason: string | null;
}
```
SEG-06's field (recommend `unreliableSegments: UnreliableSegmentsSignal`) gets the identical never-widen doc comment, naming `hasAnySevereSignal`'s test by name.

**`elevationSignal`'s single-call assembly shape** (`:452-468`):
```typescript
export function elevationSignal(
  stream: Pick<CanonicalStream, 't' | 'alt'>,
  metadata: Pick<ActivityQualityMetadata, 'startLatlng' | 'endLatlng'>
): ElevationSignal {
  const subGround = subGroundSignal(stream.alt);
  const closureDrift = closureDriftSignal(stream.alt, metadata.startLatlng, metadata.endLatlng);
  const verticalRate = verticalRateSignal(stream.t, stream.alt);

  const severe = subGround.flagged || closureDrift.state === 'flagged' || verticalRate.flagged;

  return {
    tier: severe ? 'severe' : 'none',
    subGround,
    closureDrift,
    verticalRate,
  };
}
```
SEG-06's equivalent must NOT call `classifyGaps` a second time (it must read the ALREADY-computed `coverage` — see `resolveCoverage`'s docblock below) and must NOT call `detectUnreliableSegments` a second time inside `buildPaceQualityShard` if `computePaceQualitySignals` already ran it for the same activity in the same process — mirror the elevation precedent's own stated exception instead (see `elevationRaw` excerpt below): one call per PRODUCER function (`computePaceQualitySignals` vs `buildPaceQualityShard`), never a second call inside the SAME producer.

**`resolveCoverage`'s "sole call site" discipline — the exact rule the new signal must not violate** (`:882-891`):
```typescript
/**
 * The SOLE call site of the shared gap classifier in this module — the
 * classifier is called at most once per activity and its result shared,
 * never a second independent invocation inviting drift. Both
 * `gapProfileSignal` and `buildPaceQualityShard` route through this one
 * wrapper.
 */
function resolveCoverage(t: readonly number[], d: readonly number[]) {
  return classifyGaps(t as number[], d as number[]);
}
```
SEG-06's per-activity aggregation (count/metres/excess/seconds/mechanisms) should read the `unreliable`-kind entries out of the SAME `coverage.gapIntervals` this function returns (once `classifyGaps` is widened to populate them) — or, if segment-level detail beyond what `GapInterval` carries is needed (mechanism, excess metres), call `detectUnreliableSegments` directly with the SAME `gapIntervals`-derived `gaps` argument `classifyGaps` itself passes internally — never re-derive the gap list independently.

**`tierGapProfileFromCoverage` — the exact numerator-widening template for D-04** (`:907-940`):
```typescript
function tierGapProfileFromCoverage(
  coverage: ReturnType<typeof resolveCoverage>,
  options?: QualityThresholdOverrides
): GapProfileSignal {
  if (coverage.spanSec === 0) {
    return {
      tier: 'not-computable',
      gapFraction: null,
      recordingGapSec: null,
      pauseSec: null,
      spanSec: null,
    };
  }

  const gapFraction = (coverage.recordingGapSec + coverage.pauseSec) / coverage.spanSec;
  const severeFraction = options?.gapProfileSevereFraction ?? GAP_PROFILE_SEVERE_FRACTION;

  let tier: QualityTier;
  if (gapFraction > severeFraction) {
    tier = 'severe';
  } else if (gapFraction > GAP_PROFILE_MINOR_FRACTION) {
    tier = 'minor';
  } else {
    tier = 'none';
  }

  return {
    tier,
    gapFraction,
    recordingGapSec: coverage.recordingGapSec,
    pauseSec: coverage.pauseSec,
    spanSec: coverage.spanSec,
  };
}
```
D-04's change is exactly the one arithmetic line: `gapFraction = (coverage.recordingGapSec + coverage.pauseSec) / coverage.spanSec` becomes `+ coverage.unreliableSec`. `GapProfileSignal` interface (`:101-107`) gains `unreliableSec: number | null`, echoed the same way `recordingGapSec`/`pauseSec` already are — matching the interface's own doc comment ("Non-covered-time signal — recording gaps and pauses over the stream's own span") which itself needs updating for the third category.

**`hasAnySevereSignal` — the exact 3-member `Pick<>` that must NOT grow** (`:1212-1220`):
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

**The never-widen guard test — quoted VERBATIM from the live file, the exact twin to write for `unreliableSegments`** (`src/analytics/pace-quality.test.ts:839-882`):
```typescript
describe('elevation assembly, anySevere exclusion, and not-computable rollup (D-05..D-07, Phase 30 D-06)', () => {
  it("anySevere excludes elevation: a severe elevation tier never flips hasAnySevereSignal (Phase 30's own most-consequential-mistake guard)", () => {
    const tieringNone: Pick<ActivityQualitySignals, 'decimation' | 'gapProfile' | 'impossibleSamples'> = {
      decimation: { tier: 'none', zeroAdvanceFraction: 0, sampleCount: 10 },
      gapProfile: { tier: 'none', gapFraction: 0, recordingGapSec: 0, pauseSec: 0, spanSec: 100 },
      impossibleSamples: { tier: 'none', count: 0, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: 0 },
    };
    const severeElevation: ActivityQualitySignals['elevation'] = {
      tier: 'severe',
      subGround: { flagged: true, minAltM: -282 },
      closureDrift: { state: 'clear', deltaM: null, startEndDistM: 500 },
      verticalRate: { flagged: false, worstRateMps: 1.2, violatingSamples: 0 },
    };
    const full = { ...tieringNone, elevation: severeElevation };

    // Primary assertion: all three TIERING signals are 'none', elevation is
    // 'severe' — hasAnySevereSignal must still read false. A future
    // widening of the Pick<> to fold elevation into this composite (the
    // single most consequential mistake this phase could make, D-06) would
    // flip this to true.
    expect(hasAnySevereSignal(full)).toBe(false);

    // Structural guard: severe-ifying each of the three TIERING keys DOES
    // flip the result (proving they ARE read)...
    expect(hasAnySevereSignal({ ...full, decimation: { ...full.decimation, tier: 'severe' } })).toBe(true);
    expect(hasAnySevereSignal({ ...full, gapProfile: { ...full.gapProfile, tier: 'severe' } })).toBe(true);
    expect(
      hasAnySevereSignal({ ...full, impossibleSamples: { ...full.impossibleSamples, tier: 'severe' } })
    ).toBe(true);

    // ...while deleting 'elevation' entirely must NOT throw and must NOT
    // change the (false) result — proving the function never dereferences
    // `signals.elevation` at all. A future accidental
    // `signals.elevation.tier === 'severe'` read inside this function
    // would throw here rather than pass silently.
    const withoutElevation: Record<string, unknown> = { ...full };
    delete withoutElevation.elevation;
    const asTiering = withoutElevation as Pick<
      ActivityQualitySignals,
      'decimation' | 'gapProfile' | 'impossibleSamples'
    >;
    expect(() => hasAnySevereSignal(asTiering)).not.toThrow();
    expect(hasAnySevereSignal(asTiering)).toBe(false);
  });
```
Copy this exact 4-part structure for `unreliableSegments`: (1) primary assertion false with a severe `unreliableSegments`, (2) each of the three tiering keys DOES flip it, (3) deleting `unreliableSegments` entirely does not throw and does not change the result, proving `hasAnySevereSignal` never dereferences it. CONTEXT.md's D-06 additionally requires demonstrating this failing by TEMPORARILY widening the `Pick<>` in a local, uncommitted edit, watching this exact test fail, then reverting — capture the failing output in the plan's SUMMARY, per the Phase 30 precedent RESEARCH.md cites.

**`computePaceQualitySignals`'s assembly order — where the seventh signal's call is inserted** (`:1241-1274`):
```typescript
export function computePaceQualitySignals(
  stream: CanonicalStream | null,
  metadata: ActivityQualityMetadata,
  options?: QualityThresholdOverrides
): ActivityQualitySignals {
  const deviceEra = resolveDeviceFamily(metadata);
  const elapsedVsMoving = elapsedVsMovingSignal(metadata);

  if (stream === null) {
    return notComputableSignals(deviceEra, elapsedVsMoving, NOT_COMPUTABLE_NO_STREAM);
  }

  const { t, d } = stream;
  if (!validateStreamSeries(t as number[], d as number[]).ok) {
    return notComputableSignals(deviceEra, elapsedVsMoving, NOT_COMPUTABLE_UNUSABLE_STREAM);
  }

  const decimation = decimationSignal(t, d, options);
  const gapProfile = gapProfileSignal(t, d, options);
  const impossibleSamples = impossibleSampleSignal(t, d, options);
  const elevation = elevationSignal(stream, metadata);
  const anySevere = hasAnySevereSignal({ decimation, gapProfile, impossibleSamples });

  return {
    decimation,
    gapProfile,
    impossibleSamples,
    elevation,
    deviceEra,
    elapsedVsMoving,
    anySevere,
    notComputableReason: null,
  };
}
```
Add `const unreliableSegments = unreliableSegmentsSignal(t, d, options)` alongside `elevation`, and add the key to the returned object — `anySevere`'s call is UNCHANGED (still only the 3-member `Pick<>`). Also update `notComputableSignals` (`:686-733`, not separately quoted here — read it before editing) to add the not-computable literal for the new key, matching how `elevation`'s not-computable shape already appears there.

**`buildPaceQualityShard`'s "one call, shared between index tier and shard evidence" discipline — the exact precedent for SEG-06's shard segments** (`:1461-1498`, confirmed live):
```typescript
const anySevere = hasAnySevereSignal({
  decimation,
  gapProfile,
  impossibleSamples: impossibleSignal,
});

const elevation = elevationSignal(stream, metadata);
// Same raw scan `elevationSignal`'s own `verticalRateSignal` call performs
// internally — recomputed here (never a second detector, only a second
// read of the same evidence) purely to recover the capped sample list for
// the shard, matching `impossibleRaw` above's exact precedent.
const elevationRaw = countVerticalRateSamples(t, stream.alt ?? []);

const signals: ActivityQualitySignals = {
  decimation,
  gapProfile,
  impossibleSamples: impossibleSignal,
  elevation,
  deviceEra,
  elapsedVsMoving,
  anySevere,
  notComputableReason: null,
};

return {
  activityId,
  signals,
  gapIntervals: coverage.gapIntervals,
  impossibleSamples: impossibleRaw.samples,
  impossibleSamplesTruncated: impossibleRaw.count > impossibleRaw.samples.length,
  zeroAdvanceRunProfile: computeZeroAdvanceRunProfile(t, d),
  adaptiveWindowSec: adaptiveWindowSec(t, d),
  notComputableReason: null,
  elevationVerticalRateSamples: elevationRaw.samples,
  elevationVerticalRateSamplesTruncated: elevationRaw.violatingSamples > elevationRaw.samples.length,
  elevationLoopRadiusM: LOOP_RADIUS_M,
  elevationStartEndDistM: elevation.closureDrift.startEndDistM,
};
```
D-08's "row scalars for the badge, shard segments for the evidence" splits exactly the way elevation's `tier`/`subGround`/`closureDrift`/`verticalRate` (small, always present on `signals`) vs. `elevationVerticalRateSamples` (capped list, shard-only) already split. `PaceQualityShard` interface (`:1293-1325`) gains `unreliableSegments: { startSec; endSec; metres; excessMetres; seconds; mechanism }[]` (D-08 explicitly excludes `parts`) plus a truncation flag, mirroring `elevationVerticalRateSamples`/`elevationVerticalRateSamplesTruncated`'s exact two-field shape, capped at 100 like `impossibleSamples`.

**`gapIntervals: coverage.gapIntervals` (line above) is the write side of the fourth trap** — confirms RESEARCH.md's claim that the shard's `gapIntervals` field is a straight passthrough of whatever `classifyGaps` returns; once widened, `unreliable`-kind entries flow into this array with zero code change here. The trap is entirely on the READ side (`pace-quality-client.ts`, below).

---

### `src/dashboard/data/pace-quality-client.ts` — the fourth silent-inheritance trap (found by RESEARCH.md, verified live this session)

**Analog:** itself — `VALID_ELEVATION_TIERS`'s "deliberately separate set" precedent, and `parseElevationSignal`'s all-or-nothing nested-parse shape, both in the same file.

**The exact trap, quoted from the live file** (`:77`):
```typescript
const VALID_GAP_KINDS: ReadonlySet<string> = new Set<GapKind>(['recording-gap', 'pause']);
```
and its sole use site (`:266-273`):
```typescript
/** Total, never-throwing parse of one `gapIntervals` entry. Returns null on any structural failure. */
function parseGapInterval(raw: unknown): GapInterval | null {
  if (!isPlainObject(raw)) return null;
  const { startSec, endSec, kind } = raw;
  if (typeof startSec !== 'number' || typeof endSec !== 'number') return null;
  if (typeof kind !== 'string' || !VALID_GAP_KINDS.has(kind)) return null;
  return { startSec, endSec, kind: kind as GapKind };
}
```
and the tolerant-drop call site (`:325-331`):
```typescript
const gapIntervals: GapInterval[] = [];
if (Array.isArray(raw.gapIntervals)) {
  for (const item of raw.gapIntervals) {
    const parsed = parseGapInterval(item);
    if (parsed) gapIntervals.push(parsed);
  }
}
```
**Confirmed exactly as RESEARCH.md described**: any fetched shard's `unreliable`-kind interval silently vanishes here — `parseGapInterval` returns `null`, the `if (parsed)` guard drops it, no error surfaces anywhere. Fix: widen line 77 to `new Set<GapKind>(['recording-gap', 'pause', 'unreliable'])`. This is a ONE-LINE fix but the highest-leverage line in the whole phase — every downstream reader of a fetched `PaceQualityShard.gapIntervals` (the widened `gapProfileRow`, any future consumer) is silently starved without it, independent of whether their own logic is otherwise correct.

**The "deliberately separate Set" precedent to follow, NOT reuse `VALID_GAP_KINDS` for a different purpose** (`:53-59`):
```typescript
/**
 * Phase 30 (ELEV-01, D-07/T-30-10): a DELIBERATELY SEPARATE set from
 * `VALID_TIERS` — elevation has no `'minor'` band (D-07), and reusing the
 * four-member set would let a `'minor'` value survive the parse into a
 * three-member `ElevationTier` union that has no such member.
 */
const VALID_ELEVATION_TIERS: ReadonlySet<string> = new Set<ElevationTier>(['severe', 'none', 'not-computable']);
```
This is the file's own established discipline for "a new enum member needs its own validating Set, declared adjacent to the ones it resembles, with a docblock stating WHY it isn't the same Set as a look-alike neighbour" — cite it in the fix's own comment for symmetry, even though `VALID_GAP_KINDS` itself just needs a third member added (no new Set required here, unlike the tier case).

**`parseActivityQualitySignals`'s degrade-to-safe-default shape** (`:223-264`) — the seventh signal's parse function (`parseUnreliableSegmentsSignal`, modelled on `parseElevationSignal` at `:177-188`) must plug into this same all-or-nothing-per-key dispatch, with its own not-computable literal fallback via `??`, exactly like every existing key.

---

### `src/dashboard/views/detail-sections.ts` — three widenings + one new row (PACE-09, COV-03, SEG-06)

**Analog:** itself throughout — every function below already exists in the live file at the confirmed line numbers.

**`coverageCaptionText` — current three-term string, the exact widening site (D-10)** (`:79-87`):
```typescript
export function coverageCaptionText(coverage: PaceCoverage): string | null {
  if (coverage.spanSec <= 0) return null;

  const coveredPercent = Math.round((coverage.coveredSec / coverage.spanSec) * 100);
  const recordingGapPercent = Math.round((coverage.recordingGapSec / coverage.spanSec) * 100);
  const pausePercent = Math.round((coverage.pauseSec / coverage.spanSec) * 100);

  return `${coveredPercent}% of elapsed time covered · ${recordingGapPercent}% recording gaps · ${pausePercent}% paused`;
}
```
Add `unreliablePercent = Math.round((coverage.unreliableSec / coverage.spanSec) * 100)` and append `` · ${unreliablePercent}% unreliable`` — the function's own doc comment (`:60-78`, independent-rounding rule) already states the exact discipline D-10 requires ("must never be corrected by forcing a 100% total") — no new rule needed, just a fourth clause following the same pattern.

**`SplitGapAnnotation`/`splitGapAnnotations` — the exact two-way trap, quoted from the live file (CONTEXT.md's 1st named trap, D-09)** (`:95-151`):
```typescript
export interface SplitGapAnnotation {
  km: number;
  recordingGapSec: number;
  pauseSec: number;
  totalSec: number;
}

export function splitGapAnnotations(
  splits: readonly Split[],
  gapIntervals: readonly GapInterval[]
): SplitGapAnnotation[] {
  const result: SplitGapAnnotation[] = [];

  for (const split of splits) {
    let recordingGapSec = 0;
    let pauseSec = 0;

    for (const gap of gapIntervals) {
      const overlapStart = Math.max(split.startTimeSec, gap.startSec);
      const overlapEnd = Math.min(split.endTimeSec, gap.endSec);
      const overlapSec = overlapEnd - overlapStart;
      if (overlapSec > 0) {
        if (gap.kind === 'recording-gap') {
          recordingGapSec += overlapSec;
        } else {
          pauseSec += overlapSec;
        }
      }
    }

    const totalSec = recordingGapSec + pauseSec;
    if (totalSec > 0) {
      result.push({ km: split.km, recordingGapSec, pauseSec, totalSec });
    }
  }

  return result;
}
```
Confirmed exactly as CONTEXT.md/RESEARCH.md describe: `else { pauseSec += overlapSec; }` is a TWO-WAY branch — an `unreliable`-kind gap interval lands here silently as `pauseSec`. Fix: `if (gap.kind === 'recording-gap') { recordingGapSec += overlapSec; } else if (gap.kind === 'pause') { pauseSec += overlapSec; } else { unreliableSec += overlapSec; }`, add `unreliableSec: number` to the interface and to `totalSec`'s sum, and add `unreliableSec` to the pushed object.

**`dominantGapKindLabel` — the exact tie-break to widen (D-09)** (`:162-164`):
```typescript
function dominantGapKindLabel(annotation: SplitGapAnnotation): 'recording gap' | 'pause' {
  return annotation.recordingGapSec >= annotation.pauseSec ? 'recording gap' : 'pause';
}
```
D-09: check `unreliableSec > 0` FIRST (returns a new label, e.g. `'unreliable segment'`), falling through to this exact existing two-way comparison unchanged when it is not — the existing tie-favours-recording-gap rule between the other two stays untouched, per D-09's own text.

**`gapProfileRow` — CONTEXT.md's 2nd named trap, quoted from the live file (D-11)** (`:1007-1042`):
```typescript
function gapProfileRow(
  signal: GapProfileSignal,
  notComputableReason: string | null,
  shard: PaceQualityShard | null
): QualitySignalRow {
  const explanation = tieringExplanation('gapProfile');

  if (notComputableReason !== null) {
    return {
      label: 'Recording gaps',
      valueText: `Not computable — ${notComputableReason}`,
      tier: 'not-computable',
      explanation,
      evidenceText: null,
    };
  }

  let valueText: string;
  if (signal.tier === 'none') {
    valueText = 'No recording gaps';
  } else if (signal.gapFraction !== null) {
    valueText = `${Math.round(signal.gapFraction * 100)}% of recorded time in gaps or pauses`;
  } else {
    valueText = 'Gap profile data unavailable';
  }

  const intervals = shard?.gapIntervals ?? [];
  let evidenceText: string | null = null;
  if (intervals.length > 0) {
    const longestSec = intervals.reduce((max, gap) => Math.max(max, gap.endSec - gap.startSec), 0);
    const noun = intervals.length === 1 ? 'interval' : 'intervals';
    evidenceText = `${intervals.length} gap ${noun}; longest ${formatEffortDuration(longestSec)}`;
  }

  return { label: 'Recording gaps', valueText, tier: signal.tier, explanation, evidenceText };
}
```
Two independent fixes needed on this exact function: (1) `valueText`'s `'% of recorded time in gaps or pauses'` string must widen per D-11 to name unreliable segments too (mirrors `list.ts`'s `qualityBadgeSpecs` gap-profile text below — the SAME copy-widening decision applies to both surfaces); (2) `evidenceText`'s `intervals.length`/`longest` count is currently a RAW count across whatever kinds `shard.gapIntervals` carries — RESEARCH.md's Open Question 1 (itemise vs. raw count) applies exactly here; RESEARCH.md's own recommendation is to itemise (`"N gap/pause intervals, M unreliable segments; longest …"`), confirmed sound by this function's own trivial `.reduce`/`.length` shape (itemising is a `.filter(kind)` away, not a rewrite). **This function silently depends on the `pace-quality-client.ts` fix above** — `shard?.gapIntervals` is populated by that client's parse, so fixing this function's logic alone, without widening `VALID_GAP_KINDS`, produces a correct-looking but permanently-zero unreliable count.

**`qualitySignalsSectionPlan`/`notAvailableRows` — the exact "always eight, becomes always nine" list to extend** (`:1394-1425`, `:1301-1360`, both read in full):
```typescript
export function qualitySignalsSectionPlan(
  quality: ActivityQualitySignals | null,
  shard: PaceQualityShard | null
): QualitySignalsSectionPlan {
  if (quality === null) {
    return { rows: notAvailableRows() };
  }

  const reason = quality.notComputableReason;
  const elevation: ElevationSignal = quality.elevation ?? NOT_COMPUTABLE_ELEVATION;

  return {
    rows: [
      decimationRow(quality.decimation, reason, shard),
      gapProfileRow(quality.gapProfile, reason, shard),
      impossibleSamplesRow(quality.impossibleSamples, reason, shard),
      subGroundRow(elevation.subGround, reason, shard),
      closureDriftRow(elevation.closureDrift, shard),
      verticalRateRow(elevation.verticalRate, reason, shard),
      deviceEraRow(quality.deviceEra),
      elapsedVsMovingRow(quality.elapsedVsMoving),
    ],
    // ...
```
Currently exactly 8 rows (confirmed live — matches RESEARCH.md's count). Add a 9th `unreliableSegmentsRow(quality.unreliableSegments, reason, shard)` call, modelled on `decimationRow`'s not-computable/healthy/tiered three-branch shape (`:965-999`, quoted in full below) — NOT elevation's three-sub-row shape, since SEG-06 is one rolled-up signal:
```typescript
function decimationRow(
  signal: DecimationSignal,
  notComputableReason: string | null,
  shard: PaceQualityShard | null
): QualitySignalRow {
  const explanation = tieringExplanation('decimation');

  if (notComputableReason !== null) {
    return {
      label: 'Decimation',
      valueText: `Not computable — ${notComputableReason}`,
      tier: 'not-computable',
      explanation,
      evidenceText: null,
    };
  }

  let valueText: string;
  if (signal.tier === 'none') {
    valueText = 'No decimation detected';
  } else if (signal.zeroAdvanceFraction !== null) {
    valueText = `${Math.round(signal.zeroAdvanceFraction * 100)}% of samples with no distance advance`;
  } else {
    valueText = 'Decimation data unavailable';
  }

  const profile = shard?.zeroAdvanceRunProfile ?? null;
  const windowSec = shard?.adaptiveWindowSec ?? null;
  const evidenceText =
    profile !== null && windowSec !== null
      ? `Longest zero-advance run: ${profile.longestRunSamples} samples (${profile.longestRunSec.toFixed(1)}s); adaptive window ${windowSec.toFixed(1)}s`
      : null;

  return { label: 'Decimation', valueText, tier: signal.tier, explanation, evidenceText };
}
```
`unreliableSegmentsRow` reads `signal.tier`/`count`/`totalMetres` etc. the same three-branch way (`none` → healthy string, `minor`/`severe` → measured value), and `evidenceText` from `shard?.unreliableSegments` (the capped per-segment list) the same way `decimationRow` reads `shard?.zeroAdvanceRunProfile`.

`notAvailableRows()` needs a matching ninth literal object appended to its returned array (`:1301-1360`, each entry is a flat `{ label, valueText: QUALITY_DATA_NOT_AVAILABLE, tier: 'not-computable', explanation, evidenceText: null }` — trivial, mechanical addition following the existing 8 entries verbatim).

**`EXPLANATION_PROBE_QUALITY`/`EXPLANATION_PROBE_SPECS` — the module-load fixture that MUST gain the new key or `tsc` fails first** (`:796-842`, read in full):
```typescript
export const EXPLANATION_PROBE_QUALITY: ActivityQualitySignals = {
  decimation: { tier: 'severe', zeroAdvanceFraction: 0.5, sampleCount: 100 },
  gapProfile: { tier: 'severe', gapFraction: 0.5, recordingGapSec: 10, pauseSec: 10, spanSec: 20 },
  impossibleSamples: { tier: 'severe', count: 10, maxImpliedSpeedMps: 20, countInsideZeroAdvanceRun: 1 },
  elevation: {
    tier: 'none',
    subGround: { flagged: false, minAltM: 12 },
    closureDrift: { state: 'clear', deltaM: 4, startEndDistM: 38 },
    verticalRate: { flagged: false, worstRateMps: 1.2, violatingSamples: 0 },
  },
  deviceEra: { family: 'no-device-name', rawDeviceName: null },
  elapsedVsMoving: { ratio: null, elapsedSec: null, movingSec: null },
  anySevere: true,
  notComputableReason: null,
};

const EXPLANATION_PROBE_SPECS = qualityBadgeSpecs({ quality: EXPLANATION_PROBE_QUALITY });

for (const signal of ['decimation', 'gapProfile', 'impossibleSamples'] as const) {
  const explanation = EXPLANATION_PROBE_SPECS.find((spec) => spec.signal === signal)?.explanation;
  if (!explanation) {
    throw new Error(
      `detail-sections.ts: EXPLANATION_PROBE_QUALITY produced no explanation for signal "${signal}" — qualityBadgeSpecs or the probe fixture has regressed, and an empty tiering explanation is never a valid rendering outcome (D-08)`
    );
  }
}
```
Adding a required `unreliableSegments` key to `ActivityQualitySignals` (in `pace-quality.ts`) makes this object literal a compile error until a value is added here — set it `tier: 'none'` (matching elevation's own deliberately-clean-here choice, per the docblock at `:786-794`) since, exactly like elevation, D-06 keeps SEG-06 OUT of `hasAnySevereSignal` and out of the `for (const signal of [...])` three-member loop above — **do not add `'unreliableSegments'` to that loop's array**; SEG-06's explanation is a standalone constant (see below), following elevation's own established exception, not routed through `EXPLANATION_PROBE_SPECS`.

**Elevation's standalone-explanation-constant precedent — the exact template for `UNRELIABLE_SEGMENTS_EXPLANATION`** (`:863-883`):
```typescript
/**
 * Elevation's three per-mode explanations (Phase 30, D-11). Deliberately NOT
 * routed through `tieringExplanation`/`EXPLANATION_PROBE_SPECS`: D-10 ships
 * ONE rolled-up list badge across all three elevation modes, so no 1:1
 * `qualityBadgeSpecs` probe entry exists for `subGround`/`closureDrift`/
 * `verticalRate` individually...
 */
const SUB_GROUND_EXPLANATION =
  'an altitude below plausible ground level means the barometric or GPS altitude baseline for this activity is wrong, not that the terrain was';
```
`UNRELIABLE_SEGMENTS_EXPLANATION` follows this exact shape — one module-level string constant, not routed through the probe mechanism.

---

### `src/dashboard/views/list.ts` — the fifth badge source (SEG-06, D-06/D-11)

**Analog:** itself — `elevation`'s `if` block inside `qualityBadgeSpecs`, and `elevationBadgeContent`, both read in full at their live line numbers.

**The gap-profile badge text to widen (D-11) — quoted from the live file** (`:452-466`):
```typescript
if (gapProfile.tier === 'severe' && gapProfile.gapFraction !== null) {
  const pct = Math.round(gapProfile.gapFraction * 100);
  specs.push({
    signal: 'gapProfile',
    // Names BOTH recording gaps and pauses, and calls the denominator
    // "recorded time" rather than "elapsed time": gapFraction is
    // (recordingGapSec + pauseSec) / spanSec straight from classifyGaps —
    // spanSec is the STREAM'S OWN recorded span, not the metadata
    // elapsed_time. Naming only one category, or calling the span
    // "elapsed time", would misdescribe the number this badge shows.
    visibleText: `${pct}% of recorded time in gaps or pauses`,
    explanation: 'pace during a gap is interpolated, not measured',
    descriptionIdSuffix: 'gap-profile',
  });
}
```
D-11 locks the new text: `` `${pct}% of recorded time in gaps, pauses or unreliable segments` `` — the docblock comment above it ALREADY states the exact rule being honoured ("the text names exactly what the number counts"), so update the comment's own reasoning alongside the string, not just the string.

**The exact fifth/sixth-badge-source template, quoted from the live file** (`:480-499`):
```typescript
// Phase 30 (D-06, D-10): elevation is a FOURTH badge source, deliberately
// NOT one of the three tiering signals above — it never feeds
// hasAnySevereSignal's composite. Only the 'severe' tier badges a row
// ('none' and 'not-computable' both stay silent here; not-computable is
// disclosed on the detail view instead, D-11). `elevationBadgeContent`
// below is the single source of the visible text and explanation, reused
// unchanged by `detail.ts`'s Elevation Gain stat-card badge (D-12) so the
// two surfaces cannot drift apart the way `EXPLANATION_PROBE_QUALITY`
// exists to prevent elsewhere in this tree.
if (elevation !== undefined && elevation.tier === 'severe') {
  const content = elevationBadgeContent(elevation);
  if (content !== null) {
    specs.push({
      signal: 'elevation',
      visibleText: content.visibleText,
      explanation: content.explanation,
      descriptionIdSuffix: 'elevation',
    });
  }
}
```
SEG-06 is a SIXTH such block, appended after this one, structurally identical: `if (unreliableSegments !== undefined && unreliableSegments.tier === 'severe') { const content = unreliableSegmentsBadgeContent(unreliableSegments); if (content !== null) { specs.push({ signal: 'unreliableSegments', ... }); } }`. `QualityBadgeSpec.signal` union (`:362-367`) widens from `'decimation' | 'gapProfile' | 'impossibleSamples' | 'elevation'` to add `'unreliableSegments'`.

**The read-site `undefined`-tolerant widening this new key needs too, quoted from the live file (CR-01 precedent)** (`:427-439`):
```typescript
export function qualityBadgeSpecs(row: Pick<ParsedDashboardIndexRow, 'quality'>): QualityBadgeSpec[] {
  const specs: QualityBadgeSpec[] = [];
  const quality = row.quality;
  if (!quality) return specs;
  const { decimation, gapProfile, impossibleSamples } = quality;
  // CR-01 (30-REVIEW.md): `elevation` is REQUIRED by `ActivityQualitySignals`
  // on the write side, but `index-client.ts`'s `fetchDocument()` casts the
  // network response with no field-level validation, so a pre-Phase-30
  // `index.json` (stale browser cache or a lagging staged build) hands this
  // function a `quality` object carrying the five original sub-keys and no
  // `elevation` key at all. Widened only at this read site — the write-side
  // type in `pace-quality.ts` stays required.
  const elevation: ElevationSignal | undefined = quality.elevation;
```
`const unreliableSegments: UnreliableSegmentsSignal | undefined = quality.unreliableSegments;` — same stale-cache defence, same reasoning.

**`elevationBadgeContent`'s null-on-no-evidence defence — the exact template for `unreliableSegmentsBadgeContent`** (`:519-538`):
```typescript
export function elevationBadgeContent(
  elevation: Pick<ElevationSignal, 'subGround' | 'closureDrift' | 'verticalRate'>
): { visibleText: string; explanation: string } | null {
  const clauses: string[] = [];
  if (elevation.subGround.flagged && elevation.subGround.minAltM !== null) {
    clauses.push(`altitude ${Math.round(elevation.subGround.minAltM)} m below ground`);
  }
  if (elevation.closureDrift.state === 'flagged' && elevation.closureDrift.deltaM !== null) {
    clauses.push(`altitude drift ${Math.round(Math.abs(elevation.closureDrift.deltaM))} m`);
  }
  if (elevation.verticalRate.flagged && elevation.verticalRate.worstRateMps !== null) {
    clauses.push(`spike ${Math.round(elevation.verticalRate.worstRateMps)} m/s`);
  }
  if (clauses.length === 0) return null;
  return {
    visibleText: clauses.join(' · '),
    explanation:
      'barometric and GPS altitude errors of this size mean the elevation figures for this activity are not measured ground truth; this project flags rather than corrects them, so no DEM lookup or grade-adjusted pace is applied',
  };
}
```
SEG-06's version is simpler (one condition, not three independent modes) — no `clauses.join` needed, but keep the `=== null` guard-then-return-`null` defensive shape for a severe tier whose evidence field is somehow null.

**`detail.ts`'s reuse of `elevationBadgeContent` for its stat-card badge — confirms the "one text builder, two surfaces" discipline extends to a detail-view stat card too, if SEG-06 gets one** (`src/dashboard/views/detail.ts:701-714`, read this session):
```typescript
const elevationStatCard = buildStatCard(
  formatOrDash(numOrNull(activity.total_elevation_gain), (v) => `${Math.round(v)} m`),
  ...
);
if (quality?.elevation?.tier === 'severe') {
  const content = elevationBadgeContent(quality.elevation);
  if (content) {
    appendAccessibleBadge(elevationStatCard, content.visibleText, content.explanation,
      qualityBadgeDescriptionId('detail-elevation-stat', 'elevation'))
  }
}
```
Not required by CONTEXT.md's decisions (SEG-06 has no named stat card), but noted as the reuse pattern if the plan chooses to badge a detail-view stat card too — reuse `unreliableSegmentsBadgeContent`, never retype its text.

---

### `scripts/compute-coverage-identity-recount.mjs` (D-03, new script) and `scripts/compute-unreliable-segment-severity-calibration.mjs` (D-07, new script)

**Analog:** `scripts/compute-unreliable-segment-recount.mjs` (full file, confirmed live this session — structurally unchanged since Phase 32's own PATTERNS.md mapped it) and `scripts/compute-unreliable-segment-calibration.mjs` (unchanged, per Phase 32 PATTERNS.md, still current).

**Zero-import discipline, confirmed live in the recount script's own function inventory:**
```
export function checkStream(t, d)
export function localGapSpans(t, d)
function foldSegment(t, d, segStart, segEnd)
function computeRunsInSegment(t, d, segStart, segEnd, speedLimitMps, excessFloorMetres)
export function recountGapFirst(t, d, params)
export function evaluateRecount(recountRows, detectorRows)
export function formatTable(rows)
export function parseCalibrationArtifact(markdown)
function main()
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) { main(); }
```
`LOCAL_GAP_THRESHOLD_SEC = 10` (`:80`) is a LOCAL DUPLICATE of `RECORDING_GAP_ABS_THRESHOLD_SEC` — the same zero-shared-vocabulary discipline the new archive-wide script must extend: it must declare its own local copy of any constant it needs (gap threshold, speed limit reference for narrative only) rather than importing from `pace-derivation.ts` or `unreliable-segments.ts`.

**RESEARCH.md's Pitfall A's concrete extension requirement — this new script must do MORE than loop the existing one over every activity:** the existing script's `recountGapFirst` only emits rows for bursts TOUCHING a recording gap (gap-adjacent mechanism); per RESEARCH.md's own direct read of `computeRunsInSegment`, it already finds every fast run inside a segment but only `lastBurstEndingAt`/`firstBurstStartingAt` become output rows today. The new archive-wide script must ALSO emit rows for the other kept bursts (hidden-pause/isolated-jump), classified by the SAME `metres >= hiddenPauseMinMetres` rule the detector uses — this is new logic to write, not a wrapper. Read `scripts/compute-unreliable-segment-recount.mjs:176-260` directly before writing the new script's segment-run-enumeration loop (not excerpted here — file unchanged since Phase 32, that reading is Wave 2 execution-time work, not phase-mapping work).

**Self-execution guard, verified present in the live file:**
```javascript
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
```

---

### `scripts/*.test.mjs` — zero-import structural guard, **with a named pitfall to avoid, not blindly copy**

**Analog:** `scripts/compute-pr-ceiling-recount.test.mjs` (Phase 32's own PATTERNS.md analog, structurally sound and still the right shape to copy for the STRING-based import-name scan).

**Flagged explicitly, per this phase's own instructions:** the memory record `ci-autocommit-push-races`/`gsd-decision-coverage-gate-blind-spot` history aside, this specific repo's own memory notes an `fs`-spy-cannot-see-named-imports defect class (`fs spy cannot observe named imports`). The zero-import guard in `compute-pr-ceiling-recount.test.mjs` and `compute-unreliable-segment-recount.test.mjs` (both confirmed live) is a **string-search-after-strip-comments** guard (`stripComments` + `FORBIDDEN_MODULE_NAMES` + raw-source-sanity-check), NOT an `fs`/`vi.spyOn` runtime guard — this specific shape is sound (it greps the SOURCE TEXT of the script file, not a runtime call), and Phase 32's own PATTERNS.md already flags this as "VERIFIED WORKING." **However**, CONTEXT.md's `<emphasis>` block for THIS phase separately flags a *different* import-time guard pattern (`vi.spyOn(fs, 'readFileSync')` cannot observe `import { readFileSync }` named imports) as vacuous in a DIFFERENT context (Phase 32 GAP 2). **Before copying any guard for the two NEW scripts this phase adds, confirm which shape is being copied**: the `stripComments`/`FORBIDDEN_MODULE_NAMES` text-scan shape (sound, copy it) is structurally different from a `vi.spyOn(fs, ...)` runtime-mock shape (the one flagged vacuous) — do not conflate the two. If any new test for this phase's scripts uses `vi.mock('fs')` or `vi.spyOn(fs, ...)` to prove an import-time no-side-effect guard, that guard's control probe must be independently demonstrated OBSERVED (e.g. deliberately break the code under test, watch the specific mock/spy assertion fail, not just watch the overall test fail) before it is trusted, per this phase's explicit instruction — do not present an unverified `vi.spyOn(fs, ...)` guard as a pattern to copy.

**Zero-import test shape to copy for the STRING-search guard, quoted from Phase 32's own analog (still valid, structure only — not re-read this session since unchanged):**
```javascript
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const SCRIPT_PATH = fileURLToPath(new URL('./compute-coverage-identity-recount.mjs', import.meta.url));
const FORBIDDEN_MODULE_NAMES = ['unreliable-segments', 'pace-derivation'];

function stripComments(source) {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

describe('zero-import guard (D-03)', () => {
  it('the stripper actually removes a line naming a forbidden module — proving it works rather than assuming it', () => {
    // ... sanity fixture, mirrors compute-unreliable-segment-recount.test.mjs verbatim
  });

  it('compute-coverage-identity-recount.mjs contains none of the forbidden module names once comments are stripped', () => {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    const stripped = stripComments(raw);
    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(raw).toContain(forbidden); // sanity: raw source legitimately names it (docblock)
      expect(stripped).not.toContain(forbidden);
    }
  });
});
```
D-03's archive-wide recount must forbid importing BOTH `unreliable-segments` (Phase 32's rule) AND, new to this phase, `pace-derivation` — since `pace-derivation.ts` now internally calls the detector, importing `classifyGaps` from `src/`/`dist/` for the recount would ALSO inherit the shipped Pass-2/Pass-3 logic being independently verified. Read `dist/analytics/pace-derivation.js`'s COMPILED `classifyGaps(t, d).unreliableSec` only as the number to COMPARE AGAINST (per D-03's own text: "compared against the SHIPPED, WIRED total... read from the COMPILED `dist/analytics/pace-derivation.js`"), never imported as a computation dependency inside the recount's own algorithm.

## Shared Patterns

### `validateStreamSeries` entry guard + total-function discipline (T-26-01/T-26-02)
**Source:** `src/analytics/pace-derivation.ts:200` (`classifyGaps`'s own guard), `src/analytics/unreliable-segments.ts:482-485` (`detectUnreliableSegments`'s own guard)
**Apply to:** every widened function in this phase — `classifyGaps` (unchanged guard, widened body), any new `unreliableSegmentsSignal`/`unreliableSegmentsBadgeContent`/`unreliableSegmentsRow` function. Never `?? 0`/`|| 0` a "not yet computed" `unreliableSec` — a genuinely zero value and an unmeasurable one must stay distinguishable (`tierGapProfileFromCoverage`'s own `spanSec === 0 → all-null` branch, `:911-919`, is the exact precedent).

### The never-widen `Pick<>` + guard-test pattern (D-06)
**Source:** `src/analytics/pace-quality.ts:1212-1220` (`hasAnySevereSignal`) + `src/analytics/pace-quality.test.ts:839-882` (the guard test, quoted in full above)
**Apply to:** `unreliableSegments`'s addition to `ActivityQualitySignals` — the `Pick<>` stays 3-member, the guard test gets an exact twin, and D-06 requires WATCHING it fail first via a temporary (uncommitted) widening.

### One-computation-per-producer sharing discipline
**Source:** `src/analytics/pace-quality.ts:882-891` (`resolveCoverage`'s "SOLE call site" docblock) + `:1467-1472` (`elevationRaw`'s "never a second detector, only a second read of the same evidence" comment)
**Apply to:** SEG-06's signal computation inside both `computePaceQualitySignals` and `buildPaceQualityShard` — each producer calls the detector/coverage exactly once and shares the result across its own sub-fields; the two PRODUCERS are still separate calls from each other (D-14 already accepts this as a stated cost for the browser-vs-CI split), but never a second call WITHIN one producer.

### Stale-cache `undefined`-tolerant read widening (CR-01, 30-REVIEW.md precedent)
**Source:** `src/dashboard/views/list.ts:432-439` (`elevation: ElevationSignal | undefined = quality.elevation`)
**Apply to:** every new read of `quality.unreliableSegments` from a `Pick<ParsedDashboardIndexRow, 'quality'>` or similar partially-trusted parsed shape — same stale-`index.json`/cached-shard risk applies to every field this phase adds.

### Standalone-explanation-constant exception (elevation's own precedent)
**Source:** `src/dashboard/views/detail-sections.ts:863-883`
**Apply to:** SEG-06's explanation text — do NOT force it through `EXPLANATION_PROBE_SPECS`/`tieringExplanation` (that mechanism is reserved for the three `hasAnySevereSignal`-feeding tiering signals only); declare `UNRELIABLE_SEGMENTS_EXPLANATION` as its own module constant instead.

### Fail-closed, string-scan-based zero-import guard (D-03/D-15)
**Source:** `scripts/compute-unreliable-segment-recount.mjs` (docblock + zero-import discipline) + its own `.test.mjs` (Phase 32 PATTERNS.md analog, structure confirmed sound)
**Apply to:** both new `.mjs` scripts — copy the `stripComments`/`FORBIDDEN_MODULE_NAMES`/raw-source-sanity-check shape; do NOT substitute an unverified `vi.spyOn(fs, ...)` runtime mock for this string-scan shape (see the explicit pitfall flagged above).

### Independent rounding, never forced to 100%
**Source:** `src/dashboard/views/detail-sections.ts:60-78` (`coverageCaptionText`'s own doc comment)
**Apply to:** the caption's new fourth term (D-10) — the four independently-`Math.round`ed percentages may not sum to 100; this is required, not a bug to fix.

## No Analog Found

None. Every file/function this phase touches has a same-repo, same-file (in most cases) precedent already shipped by Phase 27/30/32 — this phase is structurally a "widen four already-precedented shapes" phase (the 4-way gap classifier, the 7th quality signal, the 5th/6th badge source, the 9th detail row), not a "invent a new shape" phase. The one area genuinely short of a direct in-repo precedent — the archive-wide gap-first segment-run enumeration extending `computeRunsInSegment`'s partial output into full hidden-pause/isolated-jump rows — still has its OWN existing partial implementation in the same file to extend (`scripts/compute-unreliable-segment-recount.mjs:206-260`), so it is a role-match, not a no-analog case.

## Metadata

**Analog search scope:** `src/analytics/pace-derivation.ts`, `src/analytics/unreliable-segments.ts`, `src/analytics/pace-quality.ts`, `src/analytics/pace-quality.test.ts`, `src/analytics/pace-single-source.test.ts`, `src/analytics/dashboard-index.types.ts`, `src/analytics/compute-dashboard-index.ts`, `src/dashboard/views/detail-sections.ts`, `src/dashboard/views/list.ts`, `src/dashboard/views/detail.ts`, `src/dashboard/data/pace-quality-client.ts`, `scripts/compute-unreliable-segment-recount.mjs`, `.planning/phases/32-unreliable-segment-detection-calibration/32-PATTERNS.md`, `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md`.
**Files read in full or by targeted, non-overlapping section this session:** `pace-derivation.ts` (lines 1-280, full classifier + supporting functions), `unreliable-segments.ts` (lines 1-210 + 460-520, docblock/types/constants + `detectUnreliableSegments` signature/guard), `pace-quality.ts` (lines 94-113, 440-540, 860-960, 1205-1499 — interfaces, `elevationSignal`, `hasAnySevereSignal`/`computePaceQualitySignals`, `tierGapProfileFromCoverage`/`resolveCoverage`, `buildPaceQualityShard`/`PaceQualityShard`), `pace-quality.test.ts` (lines 839-882, the guard test verbatim), `detail-sections.ts` (lines 60-230, 760-1060, 1093-1425 — caption/splits/dominant-label, probe fixture, all nine-row candidates + `notAvailableRows`/`qualitySignalsSectionPlan`), `list.ts` (lines 239-420, 419-556, 616-691 — badge helpers, `qualityBadgeSpecs`/`elevationBadgeContent`, `composeRowAriaLabel`/`activityRowAriaLabel`), `pace-quality-client.ts` (full file, 436 lines), `dashboard-index.types.ts` (lines 1-160, full row contract), `compute-dashboard-index.ts` (lines 260-340, the quality-signal call site), `detail.ts` (targeted grep + 20-line read, elevation stat-card badge reuse), `pace-single-source.test.ts` (lines 80-220, the allow-listed-importer docblock, confirmed already anticipating this phase), `compute-unreliable-segment-recount.mjs` (grep pass, function inventory).
**Pattern extraction date:** 2026-09-21
