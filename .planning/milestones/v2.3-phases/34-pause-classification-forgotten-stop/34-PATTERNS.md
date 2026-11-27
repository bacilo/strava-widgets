# Phase 34: Pause Classification & Forgotten-Stop - Pattern Map

**Mapped:** 2026-09-22
**Files analyzed:** 12 (2 new source modules incl. `.test.ts`, 5 modified source files, 3-4 new
calibration/recount scripts + `.test.mjs`, 3 dated planning-doc amendments)
**Analogs found:** 12 / 12 — every mechanism Phase 34 needs (untiered fact, CR-01 fallback, capped
shard projection, never-widen guard, zero-import recount, HALT/first-clearing calibration) already
ships in this codebase from Phases 27/30/32/33. This is a "wire a new 8th/9th signal + a new pure
classifier module" phase, not an "invent new machinery" phase.

No `./CLAUDE.md` and no `.claude/skills/`/`.agents/skills/` directory exist in this repo (confirmed
this session) — nothing project-specific to load beyond REQUIREMENTS.md/PROJECT.md conventions
already carried by CONTEXT.md/RESEARCH.md.

All code excerpts below were read directly from the live tree this session (line numbers current
as of 2026-09-22 — note the tree has grown materially since Phase 33's own PATTERNS.md was written:
`pace-derivation.ts` 931 lines (was ~931 when Phase 33 closed, `unreliableSec`/`classifyGapsWithSegments`
already shipped), `pace-quality.ts` 1881 lines (was ~1499 mid-Phase-33), `detail-sections.ts` 1696
lines (was ~1696 at Phase 33 close) — every one of RESEARCH.md's own line citations was independently
re-verified here, not trusted from RESEARCH.md's cache).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/analytics/pause-classification.ts` (NEW — `classifyPauses`, `classifyForgottenStop`, mechanism-join) | service (pure compute, new leaf module) | transform (batch over `classifyGapsWithSegments`'s two return halves) | `src/analytics/pace-derivation.ts` itself (`classifyGapsWithSegments`, mechanism-lookup join) for the join pattern; `src/analytics/unreliable-segments.ts` (`detectUnreliableSegments`'s total-function/guard discipline) for the module's own entry guard | exact — a clean new module following an established module-boundary discipline (`pace-derivation.ts` is the ONE permitted importer of `unreliable-segments.ts`, and this new module must import only `pace-derivation.ts`'s exports, never `unreliable-segments.ts` directly) |
| `src/analytics/pause-classification.test.ts` (NEW) | test | — | `src/analytics/pace-quality.test.ts` (the `anySevere excludes unreliableSegments` guard-test shape, `:1599-1660`) | exact |
| `src/analytics/pace-quality.ts` (extend — 8th/9th signal `pauseClassification`/`forgottenStop`, `ActivityQualitySignals`, `hasAnySevereSignal` UNCHANGED, `computePaceQualitySignals`/`buildPaceQualityShard`) | service (tiering/composite assembly) | transform | itself — `elapsedVsMovingSignal`/`ElapsedVsMovingSignal` (`:181-185`, `:704-720`) is the exact untiered-fact template (D-11); `unreliableSegmentsSignal`/`UnreliableSegmentsSignal` (`:161-169`, `:1200-1230ish`) is the exact 7th-signal/never-widen precedent for an 8th | exact |
| `src/dashboard/views/detail-sections.ts` (extend — `qualitySignalsSectionPlan` 10th row, new `pausesSectionPlan`/`buildPausesSection`, `NOT_COMPUTABLE_*` CR-01 fallback, `notAvailableRows`, `EXPLANATION_PROBE_QUALITY`) | component (pure render-plan, no DOM for the plan half; DOM builder mirrors `buildSplitsSection`) | transform | itself — `unreliableSegmentsRow`/`NOT_COMPUTABLE_UNRELIABLE_SEGMENTS` (`:1225-1261`, `:1566-1574`) is the exact 9th-row/CR-01 template for a 10th; `buildSplitsSection` (`:334-420+`) is the exact section-builder template for the new Pauses section | exact |
| `src/dashboard/views/detail.ts` (extend — mount a Pauses section container in the same `Promise.all`/`mountBestEffortsAndBadges` batch) | controller (DOM mounting orchestration) | request-response (lazy shard fetch, then render) | itself — `qualitySignalsContainer` mounting (`:775`, `:818/823`, filled at `:602` inside `mountBestEffortsAndBadges`, `:568-612`) | exact |
| `src/dashboard/data/pace-quality-client.ts` (extend — `parsePauseClassificationSignal`/`parseForgottenStopSignal`, widen `parseActivityQualitySignals`, no `VALID_GAP_KINDS` change needed) | service (tolerant network-response parser) | transform (parse, fail-open per field) | itself — `parseUnreliableSegmentsSignal` (`:233-264`) is the exact all-or-nothing nested-parse template for the 8th/9th signal parse functions; `parseElevationSignal` (`:204-215`) is the sibling template | exact |
| `src/analytics/dashboard-index.types.ts` (reference only — no direct edit expected beyond a doc comment, per Phase 33's own "why this file stays untouched" precedent) | config (type contract) | — | `quality: ActivityQualitySignals` (`:141`) already nests the whole signal tree; `DASHBOARD_INDEX_SCHEMA_VERSION` stays `1` (D-17 explicit) | exact (precedent for *not* touching this file) |
| `src/analytics/compute-dashboard-index.ts` (no-op confirmation expected, mirroring Phase 33's own finding) | controller (CI compute orchestration) | batch | itself — the new signals are computed *inside* `pace-quality.ts` and simply appear in the returned object; no per-signal call-site change | exact (no-op confirmation, verify at execution time) |
| `scripts/compute-pause-classification-calibration.mjs` (NEW, D-06/D-07/D-13's walk/run valley + drift floor + min-duration) | utility (calibration generator, HALT-capable) | batch | `scripts/compute-unreliable-segment-severity-calibration.mjs` (full file — pre-declared shapes, `insensitivityForCandidate`, `selectShape`/`selectSevereCut` first-clearing arbitration, strawman-watched-failing) | exact |
| `scripts/compute-pause-classification-recount.mjs` (NEW, D-18's zero-import recount for 3475724402) | utility (archive-scoped independent recount) | batch, fails-closed | `scripts/compute-unreliable-segment-recount.mjs` (full file — gap-first traversal, `LOCAL_GAP_THRESHOLD_SEC` local duplicate, `CONTRACT_HEADER` table-parsing contract, guarded `main()`) | exact |
| `scripts/compute-pause03-recount.mjs` (NEW or folded into the calibration script — PAUSE-03 re-measurement) | utility (archive-wide measurement script) | batch | `scripts/compute-coverage-identity-recount.mjs` (D-03's own archive-wide-not-single-activity recount, structurally the closer analog than the single-activity D-18 script since PAUSE-03 sweeps every activity) | exact |
| `scripts/*.test.mjs` (all new scripts' test files) | test | — | `scripts/unreliable-segment-import-guards.test.mjs` (the consolidated string-scan zero-import guard, `stripComments`/`FORBIDDEN_MODULE_NAMES`) | exact — copy the STRING-scan shape, never an unverified `vi.spyOn(fs, ...)` runtime mock (flagged pitfall, restated below) |
| `.planning/phases/34-.../34-CALIBRATION.md` (or split per Claude's Discretion) | committed artifact | — | `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` and `33-CALIBRATION.md` (full shape, HALT precedent) | exact |
| `.planning/REQUIREMENTS.md` (PAUSE-01/STOP-01 dated amendments), `.planning/ROADMAP.md` (Phase 34 goal/criterion wording), `.planning/milestones/v2.2-REQUIREMENTS.md:165` (forward pointer) | config (planning doc edit) | — | Phase 32's own D-03/D-14 dated-amendment precedent, restated by Phase 33's own PATTERNS.md ("read the live files directly when planning the amendment task") | n/a — doc edit, not code pattern |

## Pattern Assignments

### `src/analytics/pause-classification.ts` (NEW) — the mechanism-join seam (PAUSE-01, D-01, D-02, SEG-05b)

**Analog:** `src/analytics/pace-derivation.ts` itself — `classifyGapsWithSegments` (`:482-530`,
read in full this session) and `unreliable-segments.ts`'s segment-mechanism assignment (`:601-606`,
`:652-653`).

**The exact seam, verified live this session — confirms RESEARCH.md's claim, current source, not
stale.** `classifyGapsWithSegments` returns two independent halves:

```typescript
// Source: src/analytics/pace-derivation.ts:482-530 (verified this session)
export function classifyGapsWithSegments(
  t: readonly number[],
  d: readonly number[],
  options?: { pauseRule?: PauseRule }
): { coverage: PaceCoverage; segments: UnreliableSegment[] } {
  // ... pass 1/2/3, then:
  return {
    coverage: {
      spanSec: pass1.spanSec,
      coveredSec: finalAcc.coveredSec,
      recordingGapSec: finalAcc.recordingGapSec,
      pauseSec: finalAcc.pauseSec,
      unreliableSec: finalAcc.unreliableSec,
      gapIntervals: finalAcc.gapIntervals,   // GapInterval[] — { startSec, endSec, kind }, NO metres field
    },
    segments,                                 // UnreliableSegment[] — the detector's own raw output
  };
}
```

`coverage.gapIntervals` entries carry `kind: 'unreliable'` for **every** returned segment
regardless of mechanism (pass 3 relabels ALL segment-covered pairs to `'unreliable'`, `:508-516`)
— `hidden-pause`/`isolated-jump` segments (which carry no gap at all) look identical to
`gap-adjacent` ones at the `gapIntervals` level. The mechanism lives ONLY on `segments`:

```typescript
// Source: src/analytics/unreliable-segments.ts:601-606, :652-653 (verified this session)
const mechanism: SegmentMechanism =
  gapCount > 0
    ? 'gap-adjacent'
    : metres >= params.hiddenPauseMinMetres
      ? 'hidden-pause'
      : 'isolated-jump';
```

**The classifier's join, following this exactly (D-01):**
```typescript
const { coverage, segments } = classifyGapsWithSegments(t, d);

// Classifiable, no speed test (D-01/D-03) — stationary by definition.
const pauseIntervals = coverage.gapIntervals.filter((gi) => gi.kind === 'pause');

// Classifiable via own merged metres/seconds — never derived from gapIntervals.
const classifiableFromSegments = segments.filter((s) => s.mechanism === 'gap-adjacent');

// Classifiable, metres MUST be derived (GapInterval has no metres field — Pitfall 2).
const rawRecordingGaps = coverage.gapIntervals.filter((gi) => gi.kind === 'recording-gap');

// NOT-classifiable (D-01) — stays in the existing Unreliable Segments disclosure only.
const notClassifiable = segments.filter((s) => s.mechanism !== 'gap-adjacent');
```

**Deriving metres for a raw (unmerged) `recording-gap` interval — `GapInterval` has no `metres`
field, `UnreliableSegment` does (Pitfall 2).** `t`/`d` index lookup, verified against
`unreliable-segments.ts`'s own `startIndex`/`endIndex`-based endpoint-difference convention
(`metres: number;` `seconds: number;` fields, `UnreliableSegment` interface `:183-197`, read in
full this session — `metres`/`excessMetres` fields confirmed present exactly as RESEARCH.md
describes):
```typescript
// Pattern verified against classifyGapsWithSegments's own boundary construction —
// startSec/endSec are always real t[i] values (the function only ever builds interval
// boundaries from samples, never interpolated times).
function metresForInterval(t: readonly number[], d: readonly number[], startSec: number, endSec: number): number {
  const startIdx = t.indexOf(startSec);
  const endIdx = t.indexOf(endSec);
  return d[endIdx] - d[startIdx];
}
// Production implementation: build a Map<number, number> once per activity (O(n)),
// not repeated Array.indexOf (O(n) each) — performance note, not correctness.
```

**`UNRELIABLE_SPEED_LIMIT_MPS` — import, never copy (D-05):**
```typescript
// Source: src/analytics/unreliable-segments.ts:98 (verified live)
export const UNRELIABLE_SPEED_LIMIT_MPS = 7.35;
```
Already re-exported through `pace-derivation.ts`'s type re-export block (`:46`, `export type {
UnreliableSegment, SegmentMechanism } from './unreliable-segments.js';`) — the classifier should
import `UNRELIABLE_SPEED_LIMIT_MPS` the same way, from `unreliable-segments.js` directly if it is a
value (not just a type) export, or via whatever `pace-derivation.ts` already re-exports. Verify at
implementation time whether a value re-export needs adding to `pace-derivation.ts`'s re-export
block (`:46` currently only re-exports the two TYPES, not the constant) — this is itself a
single-source-audit-relevant decision (D-05: "the single-source audit should see an import, not a
literal").

**The single-permitted-importer guard already anticipates a NEW pure module reading
`pace-derivation.ts`'s exports (confirmed live, `src/analytics/pace-single-source.test.ts:139`):**
```typescript
const ALLOWED_FILE_SUFFIX = 'analytics/pace-derivation.ts';
```
`pause-classification.ts` must import ONLY from `pace-derivation.ts` (its re-exported
`UnreliableSegment`/`SegmentMechanism` types, `GapInterval`, `classifyGapsWithSegments`) — **never**
`unreliable-segments.ts` directly. Doing so requires **no widening of `ALLOWED_FILE_SUFFIX`** (that
allowlist governs importers of the *detector*, not importers of `pace-derivation.ts` itself — a
plain TypeScript import of `pace-derivation.ts`'s own exports needs no special allowlist entry).
D-01/SEG-05b's "load-bearing" proof (stub the `classifyGapsWithSegments` call, watch the classes
change) is a NEW test in `pause-classification.test.ts` or `pace-single-source.test.ts`, following
the Phase 33 D-15 pattern cited in CONTEXT.md — not an addition to the existing allowlist.

---

### `src/analytics/pace-quality.ts` — the untiered-fact template (D-11) and the never-widen guard (D-06 restated for STOP)

**Analog:** `ElapsedVsMovingSignal`/`elapsedVsMovingSignal` (untiered template) and
`UnreliableSegmentsSignal`/`hasAnySevereSignal` (never-widen template) — both read in full this
session at their live line numbers.

**The exact untiered-fact shape to copy for STOP-01/02/03 (D-11 — no `tier` field at all)**
(`:181-185`, `:704-720`, verified live):
```typescript
export interface ElapsedVsMovingSignal {
  ratio: number | null; // untiered (D-14) — never a plausible-looking computed zero
  elapsedSec: number | null;
  movingSec: number | null;
}

export function elapsedVsMovingSignal(
  metadata: Pick<ActivityQualityMetadata, 'elapsedTimeSec' | 'movingTimeSec'>
): ElapsedVsMovingSignal {
  const { elapsedTimeSec, movingTimeSec } = metadata;
  const elapsedSec = typeof elapsedTimeSec === 'number' && Number.isFinite(elapsedTimeSec) ? elapsedTimeSec : null;
  const movingSec = typeof movingTimeSec === 'number' && Number.isFinite(movingTimeSec) ? movingTimeSec : null;
  const ratio =
    elapsedSec !== null && movingSec !== null && movingSec > 0
      ? Math.round((elapsedSec / movingSec) * 100) / 100
      : null;
  return { ratio, elapsedSec, movingSec };
}
```
`ForgottenStopSignal` (D-09/D-11's flag) follows this exact shape — total seconds, longest
stretch, count, itemised per source (covered-creep vs. pause-interval), **no `tier` field**,
structurally excluded from `hasAnySevereSignal`'s `Pick<>` (never listed there at all — this is
what "structurally outside" means: the type itself carries no tier to exclude, unlike
`UnreliableSegmentsSignal`/`ElevationSignal` which DO carry a tier and are excluded by the `Pick<>`
naming only three keys).

**`PAUSE-01`'s per-class summary row is DIFFERENT from STOP's shape — it IS tiered-free but still
needs counts per class, closer to `UnreliableSegmentsSignal`'s flat-numeric-fields shape (`:161-169`,
verified live) minus the `tier` field:**
```typescript
export interface UnreliableSegmentsSignal {
  tier: QualityTier;
  count: number | null;
  totalMetres: number | null;
  totalExcessMetres: number | null;
  totalSeconds: number | null;
  excessFraction: number | null;
  mechanisms: SegmentMechanism[] | null;
}
```
A `PauseClassificationSignal` (D-14's "untiered" per-class summary) mirrors this exact flat-fields
shape (counts per class instead of `mechanisms[]`, no `tier`) — D-14/D-11 both explicitly call out
"no none/minor/severe cut" for this phase's two new signals, so neither gets a `QualityTier` field,
unlike `UnreliableSegmentsSignal`'s own precedent (which the classifier's per-class summary
resembles structurally but not in tieredness).

**`ActivityQualitySignals`'s never-widen doc-comment precedent — the exact twin the two new keys
need** (`:538-552`, verified live, current 7-key interface before Phase 34):
```typescript
export interface ActivityQualitySignals {
  decimation: DecimationSignal;
  gapProfile: GapProfileSignal;
  impossibleSamples: ImpossibleSampleSignal;
  elevation: ElevationSignal;               // excluded from anySevere, Phase 30 D-06
  unreliableSegments: UnreliableSegmentsSignal; // excluded from anySevere, Phase 33 D-06
  deviceEra: DeviceEraSignal;                // untiered, D-13
  elapsedVsMoving: ElapsedVsMovingSignal;    // untiered, D-14
  anySevere: boolean;
  notComputableReason: string | null;
}
```
Two new keys (e.g. `pauseClassification: PauseClassificationSignal`, `forgottenStop:
ForgottenStopSignal`) each need the identical doc-comment shape naming `hasAnySevereSignal`'s own
test by name — since NEITHER carries a tier at all, the doc comment should state this even more
strongly than elevation's/unreliableSegments' own comment ("structurally cannot be widened into
`anySevere` — there is no `tier` field to read").

**`hasAnySevereSignal` — the exact 3-member `Pick<>` that must NOT grow, confirmed unchanged since
Phase 33** (`:1501-1509`, verified live):
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

**The never-widen guard test — quoted VERBATIM from the live file, the exact twin to write for the
new 8th/9th keys** (`src/analytics/pace-quality.test.ts:1599-1660`, read in full this session — this
is the Phase 33 SEG-06 guard, itself modelled on Phase 30's elevation guard at `:1544-1598`):
```typescript
it("anySevere excludes unreliableSegments: a severe unreliableSegments tier never flips hasAnySevereSignal", () => {
  const tieringNone: Pick<ActivityQualitySignals, 'decimation' | 'gapProfile' | 'impossibleSamples'> = { /* ... */ };
  const severeUnreliableSegments: ActivityQualitySignals['unreliableSegments'] = { tier: 'severe', /* ... */ };
  const full = { ...tieringNone, unreliableSegments: severeUnreliableSegments };

  expect(hasAnySevereSignal(full)).toBe(false);                       // Part 1: primary assertion
  // Part 2: each of the three TIERING keys DOES flip it (proves they ARE read)
  expect(hasAnySevereSignal({ ...full, decimation: { ...full.decimation, tier: 'severe' } })).toBe(true);
  // Part 3: deleting the key entirely must NOT throw and must NOT change the result
  const withoutKey: Record<string, unknown> = { ...full };
  delete withoutKey.unreliableSegments;
  expect(() => hasAnySevereSignal(withoutKey as Pick<ActivityQualitySignals, 'decimation' | 'gapProfile' | 'impossibleSamples'>)).not.toThrow();
  // Part 4: TYPE-LEVEL lock — hasAnySevereSignal's Pick<> is checked to name EXACTLY three keys via
  // Record<keyof TieringSignalsParam, true>; widening the Pick<> is a compile error, not just a
  // runtime miss.
});
```
Since the two new signals carry no `tier` field at all, Part 1/Part 2/Part 4 of this guard still
apply verbatim (constructing `full` with the new untiered key present, proving it's never read);
Part 3 (delete-and-no-throw) is the MOST important part for an untiered signal, since there is no
`.tier` property to even attempt reading — the guard proves `hasAnySevereSignal` never dereferences
the key's own shape at all. CONTEXT.md's D-11 additionally requires watching this guard FAIL first
via a temporary (uncommitted) widening of the `Pick<>` — the 33 D-06 / 30 D-06 precedent CONTEXT.md
itself names.

**`computePaceQualitySignals`'s assembly order — where the two new signals' calls are inserted**
(`:1530-1570`, verified live):
```typescript
export function computePaceQualitySignals(
  stream: CanonicalStream | null,
  metadata: ActivityQualityMetadata,
  options?: QualityThresholdOverrides
): ActivityQualitySignals {
  const deviceEra = resolveDeviceFamily(metadata);
  const elapsedVsMoving = elapsedVsMovingSignal(metadata);
  if (stream === null) return notComputableSignals(deviceEra, elapsedVsMoving, NOT_COMPUTABLE_NO_STREAM);
  const { t, d } = stream;
  if (!validateStreamSeries(t as number[], d as number[]).ok) return notComputableSignals(...);

  const decimation = decimationSignal(t, d, options);
  const { coverage, segments } = resolveCoverage(t, d);   // SOLE call site — share, never re-derive
  const gapProfile = tierGapProfileFromCoverage(coverage, options);
  const impossibleSamples = impossibleSampleSignal(t, d, options);
  const elevation = elevationSignal(stream, metadata);
  const unreliableSegments = unreliableSegmentsSignal(t, d, segments, options);
  const anySevere = hasAnySevereSignal({ decimation, gapProfile, impossibleSamples });  // UNCHANGED

  return { decimation, gapProfile, impossibleSamples, elevation, unreliableSegments, deviceEra, elapsedVsMoving, anySevere, notComputableReason: null };
}
```
Add `const pauseClassification = pauseClassificationSignal(coverage, segments, t, d, options)` and
`const forgottenStop = forgottenStopSignal(t, d, coverage, options)` alongside `unreliableSegments`
— **reading the SAME `coverage`/`segments` this producer already resolved** (the `resolveCoverage`
"SOLE call site" discipline, `:882-891`-equivalent docblock, unchanged this phase — the new
classifier calls `classifyGapsWithSegments` itself only if it CANNOT reuse this producer's already-
resolved halves; per D-01/SEG-05b, the classifier is a pure function of `(coverage, segments)` it is
handed, never re-deriving them itself). `anySevere`'s call is UNCHANGED — still only the 3-member
`Pick<>`. Also update `notComputableSignals` (not separately re-read this session — same location
Phase 33 mapped, now shifted a few hundred lines later; grep for it at execution time) to add
not-computable literals for the two new keys.

**`buildPaceQualityShard`'s "one call, shared between index tier and shard evidence" discipline —
confirmed live, exact precedent for the Pauses-list evidence** (`:1761-1881`, read in full this
session):
```typescript
export function buildPaceQualityShard(...): PaceQualityShard {
  // ...
  const { coverage, segments } = resolveCoverage(t, d);   // the sole coverage-and-segments computation
  const gapProfile = tierGapProfileFromCoverage(coverage, options);
  const unreliableSegments = unreliableSegmentsSignal(t, d, segments, options);
  // ...
  const { segments: projectedUnreliableSegments, truncated: unreliableSegmentsTruncated } =
    projectUnreliableSegments(segments);
  return {
    // ...
    gapIntervals: coverage.gapIntervals,
    unreliableSegments: projectedUnreliableSegments,
    unreliableSegmentsTruncated,
  };
}
```
Phase 34's Pauses-list shard field(s) (`pauseIntervals`/whatever field name Claude's Discretion
picks) should be computed the SAME way — from the SAME `coverage`/`segments` this function already
resolved, never a second `resolveCoverage`/`classifyGapsWithSegments` call within this producer.

---

### The cap-100 shard projection template (D-15) — `projectUnreliableSegments`

**Analog:** `projectUnreliableSegments` (`pace-quality.ts:1727-1743`, read in full this session,
current and unchanged since Phase 33 shipped it).

```typescript
// Source: src/analytics/pace-quality.ts:1727-1743 (verified live)
export function projectUnreliableSegments(
  segments: readonly UnreliableSegment[]
): { segments: PaceQualityShard['unreliableSegments']; truncated: boolean } {
  const projected: PaceQualityShard['unreliableSegments'] = [];
  for (const segment of segments) {
    if (projected.length >= 100) break;
    projected.push({
      startSec: segment.startSec,
      endSec: segment.endSec,
      metres: segment.metres,
      excessMetres: segment.excessMetres,
      seconds: segment.seconds,
      mechanism: segment.mechanism,
    });
  }
  return { segments: projected, truncated: segments.length > projected.length };
}
```
This is a **pure function over an already-resolved list** — never calls the detector or
`resolveCoverage` itself, so it can be unit-tested directly against a synthetic 101-entry fixture
(the exact reason this shape exists, per its own docblock). D-15's capped-at-100 Pauses list
(`projectPauseIntervals` or similar name) copies this exact shape: same 100-entry cap, same
`{ segments, truncated }` return contract, same "pure projection, one production call site inside
`buildPaceQualityShard`" discipline. **Note the field selection differs from
`projectUnreliableSegments`'s own choice** — D-15 explicitly rejects `parts`/`startIndex`/`endIndex`
the same way D-08 did for the unreliable-segments shard; Phase 34's projection needs `class`
(the new speed band) added to the standard `startSec`/`endSec`/`metres`/`seconds` fields, plus
whatever position fields D-14 names (elapsed time, km).

`PaceQualityShard` interface's own doc comment on the unreliable-segments field (`:1621-1639`,
verified live) is the exact model to follow for the new field's doc comment — cites the cap, cites
why `parts` is excluded, cites the "capped at 100 like `impossibleSamples`" convention.

---

### `src/dashboard/data/pace-quality-client.ts` — the parse-side CR-01 twin (D-08 read side)

**Analog:** `parseUnreliableSegmentsSignal` (`:233-264`, read in full this session) and
`parseElevationSignal` (`:204-215`) — both the all-or-nothing nested-parse template.

```typescript
// Source: src/dashboard/data/pace-quality-client.ts:233-264 (verified live)
function parseUnreliableSegmentsSignal(raw: unknown): UnreliableSegmentsSignal | null {
  if (!isPlainObject(raw)) return null;
  const tier = parseTier(raw.tier);
  if (tier === null) return null;
  let mechanisms: SegmentMechanism[] | null;
  if (raw.mechanisms === null) {
    mechanisms = null;
  } else if (Array.isArray(raw.mechanisms)) {
    const parsedMechanisms: SegmentMechanism[] = [];
    for (const item of raw.mechanisms) {
      const mechanism = parseSegmentMechanism(item);
      if (mechanism === null) return null; // one malformed entry invalidates the whole signal
      parsedMechanisms.push(mechanism);
    }
    mechanisms = parsedMechanisms;
  } else {
    return null;
  }
  return { tier, count: finiteNumberOrNull(raw.count), /* ...remaining flat fields via finiteNumberOrNull */ mechanisms };
}
```
Two new parse functions (`parsePauseClassificationSignal`, `parseForgottenStopSignal`) follow this
exact shape (no `tier` to parse for either — since both are untiered — so simpler than this
template: parse each numeric/array field independently via `finiteNumberOrNull`/an array-of-known-
literal loop for per-class counts, return `null` on any single field failure).

**`parseActivityQualitySignals`'s degrade-to-safe-default dispatch — the exact CR-01 read-side
template, confirmed live** (`:299-345`, read in full this session):
```typescript
elevation: parseElevationSignal(raw.elevation) ?? { tier: 'not-computable', /* ...all-null literal */ },
unreliableSegments: parseUnreliableSegmentsSignal(raw.unreliableSegments) ?? { tier: 'not-computable', /* ...all-null literal */ },
```
The two new keys plug into this same `??`-fallback dispatch, each with its own untiered
not-computable literal (all numeric/array fields `null`, no `tier` field to set at all).

**No `VALID_GAP_KINDS` change needed** — confirmed live (`:93`):
```typescript
const VALID_GAP_KINDS: ReadonlySet<string> = new Set<GapKind>(['recording-gap', 'pause', 'unreliable']);
```
Already widened to all three kinds by Phase 33; Phase 34 introduces no new `GapKind` member (D-01:
the classifier reads existing `kind`-tagged intervals, adds no new kind), so this file's gap-kind
validation needs no further widening. The only new validating-Set need is for any new closed-string
enum Phase 34 introduces (e.g. a `PauseClass` union `'stationary' | 'walked' | 'ran-through' |
'transported'`) — follow `VALID_ELEVATION_TIERS`'s "deliberately separate Set, docblock stating why"
discipline (`:56-60`) for that new Set, never reuse `VALID_GAP_KINDS` or `VALID_TIERS` for it.

---

### `src/dashboard/views/detail-sections.ts` — the 10th summary row (D-14) and the new Pauses section (D-14/D-15)

**Analog:** `unreliableSegmentsRow`/`NOT_COMPUTABLE_UNRELIABLE_SEGMENTS`/`qualitySignalsSectionPlan`
(the 9th-row precedent) and `buildSplitsSection` (the section-builder template) — all read in full
this session at their live line numbers.

**`qualitySignalsSectionPlan`'s current 9-row assembly, confirmed live** (`:1591-1627`):
```typescript
export function qualitySignalsSectionPlan(
  quality: ActivityQualitySignals | null,
  shard: PaceQualityShard | null
): QualitySignalsSectionPlan {
  if (quality === null) return { rows: notAvailableRows() };
  const reason = quality.notComputableReason;
  const elevation: ElevationSignal = quality.elevation ?? NOT_COMPUTABLE_ELEVATION;
  const unreliableSegments: UnreliableSegmentsSignal = quality.unreliableSegments ?? NOT_COMPUTABLE_UNRELIABLE_SEGMENTS;
  return {
    rows: [
      decimationRow(quality.decimation, reason, shard),
      gapProfileRow(quality.gapProfile, reason, shard),
      impossibleSamplesRow(quality.impossibleSamples, reason, shard),
      unreliableSegmentsRow(unreliableSegments, reason, shard),
      subGroundRow(elevation.subGround, reason, shard),
      closureDriftRow(elevation.closureDrift, shard),
      verticalRateRow(elevation.verticalRate, reason, shard),
      deviceEraRow(quality.deviceEra),
      elapsedVsMovingRow(quality.elapsedVsMoving),
    ],
  };
}
```
Add a 10th row — a single combined Pauses-summary row per D-14 ("a one-line summary row in Quality
Signals" — not two rows for the two signals, per CONTEXT.md's own wording, though Claude's
Discretion covers exact field shape; if the plan chooses two separate rows instead, this same
pattern applies twice). Model the row function on `unreliableSegmentsRow`'s own three-branch shape
(`:1225-1261`, read in full this session):
```typescript
function unreliableSegmentsRow(signal: UnreliableSegmentsSignal, notComputableReason: string | null, shard: PaceQualityShard | null): QualitySignalRow {
  if (notComputableReason !== null) return { label: 'Unreliable segments', valueText: `Not computable — ${notComputableReason}`, tier: 'not-computable', explanation: UNRELIABLE_SEGMENTS_EXPLANATION, evidenceText: null };
  let valueText: string;
  if (signal.tier === 'none') valueText = 'No unreliable segments detected';
  else { const content = unreliableSegmentsBadgeContent(signal); valueText = content !== null ? content.visibleText : 'Unreliable-segment data unavailable'; }
  const entries = shard?.unreliableSegments ?? [];
  let evidenceText: string | null = null;
  if (entries.length > 0) { /* first/longest summary */ }
  return { label: 'Unreliable segments', valueText, tier: signal.tier, explanation: UNRELIABLE_SEGMENTS_EXPLANATION, evidenceText };
}
```
Phase 34's row differs in ONE structural way: `QualitySignalRow.tier` is typed `QualityTier |
'untiered'` (`:969-975`, verified live) — since D-14's summary is untiered (no none/minor/severe
cut named), the new row sets `tier: 'untiered'` unconditionally (mirroring `elapsedVsMovingRow`'s
own `tier: 'untiered'`, `:1453-1463`, verified live), not a `signal.tier === 'none' ? ... :
unreliableSegmentsBadgeContent(...)`-style branch — there is no tier to branch on.

**The CR-01 fallback constant template, confirmed live** (`:1566-1574`):
```typescript
const NOT_COMPUTABLE_UNRELIABLE_SEGMENTS: UnreliableSegmentsSignal = {
  tier: 'not-computable', count: null, totalMetres: null, totalExcessMetres: null,
  totalSeconds: null, excessFraction: null, mechanisms: null,
};
```
Two new fallback constants (one per new signal, or one combined if D-14 ships a single combined
summary type) follow this exact shape — all-null literal, `??` at the read site inside
`qualitySignalsSectionPlan` exactly like `elevation`/`unreliableSegments` above.

**`notAvailableRows()`'s literal-list-extension template, confirmed live** (`:1471-1541`, 9 entries
currently) — a 10th literal object appended, following the other 9 verbatim (`{ label, valueText:
QUALITY_DATA_NOT_AVAILABLE, tier: 'untiered', explanation, evidenceText: null }` — note `tier:
'untiered'` not `'not-computable'` for this one, since the row itself is untiered even when data is
absent — cross-check against `deviceEraRow`'s/`elapsedVsMovingRow`'s own `notAvailableRows` entries,
which DO use `tier: 'untiered'` even in the not-available fallback, `:1526-1539`, verified live).

**`EXPLANATION_PROBE_QUALITY` — the module-load fixture that MUST gain the new key(s) or `tsc`
fails first, confirmed live** (`:837-867`):
```typescript
export const EXPLANATION_PROBE_QUALITY: ActivityQualitySignals = {
  decimation: { tier: 'severe', /* ... */ },
  gapProfile: { tier: 'severe', /* ... */ },
  impossibleSamples: { tier: 'severe', /* ... */ },
  elevation: { tier: 'none', /* ... */ },
  unreliableSegments: { tier: 'none', count: 0, /* ... */ mechanisms: [] },
  deviceEra: { family: 'no-device-name', rawDeviceName: null },
  elapsedVsMoving: { ratio: null, elapsedSec: null, movingSec: null },
  anySevere: true,
  notComputableReason: null,
};
```
Adding required keys to `ActivityQualitySignals` makes this literal a compile error until values
are added here — since the two new signals are untiered (no `tier` field), they need only their
own flat-fields default (e.g. `pauseClassification: { stationaryCount: 0, /* ... */ }`,
`forgottenStop: { totalSeconds: 0, /* ... */ }`), no `'none'`/`'severe'` choice to make. **Do not
add either new key to the `for (const signal of ['decimation', 'gapProfile', 'impossibleSamples'])`
loop at `:892`** — same reasoning as elevation/unreliableSegments: these two are NOT tiering
signals feeding `hasAnySevereSignal`, so they get standalone module-level explanation constants
(see next paragraph), never routed through `EXPLANATION_PROBE_SPECS`.

**The standalone-explanation-constant precedent, confirmed live** (`DEVICE_ERA_EXPLANATION` /
`ELAPSED_VS_MOVING_EXPLANATION`, `:913-918`; `UNRELIABLE_SEGMENTS_EXPLANATION` similarly declared
near `:920-935`'s block for the elevation trio):
```typescript
const ELAPSED_VS_MOVING_EXPLANATION =
  'elapsed time includes any stopped-watch time not captured as a moving pause; a high ratio does not by itself distinguish deliberate rest from a forgotten stop';
```
The two new rows' explanation strings follow this exact "one module-level string constant, not
routed through the probe mechanism" shape.

**`buildSplitsSection` — the exact section-builder template for the new Pauses section** (`:334-420+`,
read in full this session — signature and empty-state/DOM-building shape confirmed):
```typescript
export function buildSplitsSection(
  splits: readonly Split[],
  activityAvgPaceSecPerKm: number | null,
  gapAnnotations: readonly SplitGapAnnotation[] = [],
  isRebasedAverage: boolean = false
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'card detail-section';
  const heading = document.createElement('h2');
  heading.className = 'text-heading';
  heading.textContent = 'Splits';
  section.appendChild(heading);
  if (splits.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-body';
    empty.textContent = 'No per-kilometre splits for this activity.';
    section.appendChild(empty);
    return section;
  }
  // ... table build, one row per item, from a pure plan object
}
```
A new `buildPausesSection(entries: PausesSectionPlan)` follows this exact `<section class="card
detail-section">` + `<h2>` + empty-state-else-`<table>` shape, one `<tr>` per pause-list entry (D-15:
position, class, duration, distance), pure `*-logic`/plan split per the project's own established
"no DOM-simulation dependency anywhere in this tree" rule (RESEARCH.md's own citation of this
discipline).

---

### `src/dashboard/views/detail.ts` — mounting the new section (D-14)

**Analog:** the existing `qualitySignalsContainer` mount, confirmed live (`:775`, `:818/823`,
filled inside `mountBestEffortsAndBadges` at `:602`, `Promise.all` at `:576-580`).

```typescript
// Source: src/dashboard/views/detail.ts (grep-confirmed this session)
const qualitySignalsContainer = document.createElement('div');
// ... appended to view at :818/:823 depending on branch
async function mountBestEffortsAndBadges(..., qualitySignalsContainer: HTMLElement, ...) {
  const [bestEffortsEntry, ageGrading, liveExclusionState, paceQualityShard] = await Promise.all([
    /* ... */
    paceQualityClient.load(detail.id),
  ]);
  qualitySignalsContainer.replaceChildren(/* built section */);
}
```
A new `pausesContainer` (or similar) is created the same way, appended at first-paint alongside
`qualitySignalsContainer`, and filled inside the SAME `Promise.all`-resolved callback — D-14/RESEARCH.md's
own finding confirms "the new Pauses section needs no new fetch, only a new placeholder container
mounted at first-paint time... and filled in the same `Promise.all`-resolved callback." No new
`await` point, no new client call.

---

### `scripts/compute-pause-classification-calibration.mjs` (NEW, D-06/D-07/D-13/D-08's HALT-capable calibration)

**Analog:** `scripts/compute-unreliable-segment-severity-calibration.mjs` (full file — read via
targeted grep this session, structure confirmed current and unchanged since Phase 33).

**The pre-declared-shapes / first-clearing / HALT-on-none pipeline, confirmed live in the script's
own structure:**
```javascript
// Source: scripts/compute-unreliable-segment-severity-calibration.mjs (grep-verified this session)
// D-13's tolerance, fixed BEFORE any insensitivity check runs (never adjusted after seeing a delta).
const INSENSITIVITY_TOLERANCE = /* fixed constant */;
// The candidate list, fixed and round BEFORE any check runs.
const CANDIDATE_OUTER_PERCENTILES = [ /* ... */ ];

export function insensitivityForCandidate(fractions, q, { tolerance }) {
  // two-direction check: removed-population delta AND planted-population delta, BOTH must clear tolerance
}

export function selectSevereCut(fractions, { tolerance = INSENSITIVITY_TOLERANCE } = {}) {
  const results = CANDIDATE_OUTER_PERCENTILES.map((q) => insensitivityForCandidate(fractions, q, { tolerance }));
  const chosen = /* smallest q whose pass is true */;
  return { results, chosen, tolerance };   // chosen is null when NO candidate passes — the HALT signal
}

export function strawmanCandidate(fractions, { tolerance = INSENSITIVITY_TOLERANCE } = {}) {
  // Deliberately circular candidate, watched FAILING before any real candidate is trusted (Pitfall C precedent)
  return insensitivityForCandidate(fractions, STRAWMAN_PERCENTILE, { tolerance });
}
```
Phase 34's calibration script mirrors this exact `insensitivityForCandidate`/`select*`/strawman
triple for EACH of its three calibrated values (D-06's walk/run valley shapes W1-W3, D-07's drift
floor shapes G1-G3, D-13's min-duration shapes M1-M2) — CONTEXT.md's own text already states these
shapes must be "pre-declared in the plan text before any measurement" (D-06) and "the plan commits
a NO-VALUE artifact and stops for the developer" on no shape clearing (D-08) — `chosen: null` from
`select*` IS that NO-VALUE signal, matching this script's own established contract.

---

### `scripts/compute-pause-classification-recount.mjs` (NEW, D-18's zero-import recount for 3475724402)

**Analog:** `scripts/compute-unreliable-segment-recount.mjs` (full docblock + structure read this
session, unchanged since Phase 33 mapped it — confirmed still the live analog).

**The zero-import discipline, docblock quoted verbatim from the live file (`:1-45`, read this
session):**
```
FORBIDDEN, DELIBERATELY: this file has zero import/require/dynamic-import() statements naming
unreliable-segments... A recount that imported the detector that produced the numbers it is
checking would agree with itself by construction.

TRAVERSAL, DELIBERATELY MIRRORED: the detector is run-first... This recount is gap-first...

LOCAL_GAP_THRESHOLD_SEC = 10 is a LOCAL DUPLICATE of RECORDING_GAP_ABS_THRESHOLD_SEC... duplicating
this tiny constant is the price of staying a genuinely independent recount.
```
CONTEXT.md's D-18 already states: "a committed script that never imports the classifier or the
detector (gap-first recount, the 32 D-15 / `compute-unreliable-segment-recount.mjs` pattern, fails
closed, shown failing against a deliberately broken classifier first)". This new script must forbid
importing BOTH `unreliable-segments` AND `pace-derivation` AND the new `pause-classification`
module — since `pause-classification.ts` now depends on `pace-derivation.ts`, importing either
transitively inherits the shipped classification logic being independently verified (the exact
`FORBIDDEN_MODULE_NAMES` widening Phase 33's own D-03 script already had to make for
`pace-derivation`, per Phase 33's own PATTERNS.md — restated here as the THIRD forbidden name this
phase adds). Extend the script's classified-band column onto the SAME independently-derived
`metres`/`seconds` table this script's gap-first traversal already produces — never re-deriving the
merge itself, only adding the classification arithmetic (speed = metres/seconds, band lookup)
on top.

**Self-execution guard, verified present in the live file:**
```javascript
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) { main(); }
```

---

### `scripts/*.test.mjs` — zero-import structural guard, flagged pitfall restated (D-03/D-18)

**Analog:** `scripts/unreliable-segment-import-guards.test.mjs` (the consolidated string-scan guard
file — confirmed present in the scripts directory this session, a Phase 33-era consolidation of the
per-script guard test Phase 32's own PATTERNS.md originally mapped per-file).

**The sound shape — string-search AFTER stripping comments, NOT a runtime `fs` mock:**
```javascript
function stripComments(source) {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}
// ... FORBIDDEN_MODULE_NAMES scan against readFileSync(SCRIPT_PATH, 'utf8')
```
**Explicitly flagged again per this phase's own emphasis instructions and this repo's own memory
record (`fs spy cannot observe named imports`):** copy the STRING-scan-after-strip-comments shape
for every new `.mjs` script's guard test. Do **not** substitute an unverified `vi.spyOn(fs,
'readFileSync')`/`vi.mock('fs')` runtime-mock guard for this — that shape cannot observe a named
`import { readFileSync } from 'fs'` and would pass vacuously even against a script that DOES import
the forbidden module. If any new test for this phase's scripts uses a runtime `fs` mock for a
DIFFERENT purpose (not the zero-import guard), that mock's own control assertion must be
independently demonstrated observed (break the code under test, watch the specific mock assertion
fail) before it is trusted.

---

## Shared Patterns

### The untiered-fact shape (D-11's own template, restated for two new signals)
**Source:** `src/analytics/pace-quality.ts:181-185` (`ElapsedVsMovingSignal`) + `:704-720`
(`elapsedVsMovingSignal`)
**Apply to:** `PauseClassificationSignal`/`ForgottenStopSignal` (or whatever names Claude's
Discretion settles on) — no `tier` field at all, computed always, disclosed always, never
contributes to `hasAnySevereSignal`'s `Pick<>` (which stays 3-member, unchanged).

### The never-widen guard + `Pick<>` lock (D-06, restated as D-11's structural guard)
**Source:** `src/analytics/pace-quality.ts:1501-1509` (`hasAnySevereSignal`) + `pace-quality.test.ts:1599-1660`
(the Phase 33 guard test, quoted in full above, itself modelled on Phase 30's own at `:1544-1598`)
**Apply to:** both new signals' addition to `ActivityQualitySignals` — write an exact twin guard
test for EACH new key (or one combined test naming both, following the two-signals-in-one-test
shape if the plan folds them), watch it FAIL first via a temporary uncommitted `Pick<>` widening
(D-08/D-11's explicit instruction), then revert.

### One-computation-per-producer sharing discipline
**Source:** `src/analytics/pace-quality.ts:1809-1815` (`buildPaceQualityShard`'s own comment: "The
sole coverage-and-segments computation for this activity — shared by the gap-profile signal, this
shard's own `gapIntervals`, and the seventh signal below") + `:1548-1552` (`computePaceQualitySignals`'s
matching comment)
**Apply to:** the new classifier's computation inside BOTH `computePaceQualitySignals` and
`buildPaceQualityShard` — each producer calls `classifyGapsWithSegments` (via `resolveCoverage`,
if that helper's own signature already returns both halves — verify at execution time) exactly
once and shares `coverage`/`segments` across the pause classifier AND the forgotten-stop detector
AND the existing gap-profile/unreliable-segments signals; the two PRODUCERS remain separate calls
from each other (the existing browser-vs-CI split), but never a second call WITHIN one producer.

### Stale-cache `??`-fallback CR-01 read widening
**Source:** `src/dashboard/views/detail-sections.ts:1607-1612` (`qualitySignalsSectionPlan`'s own
`quality.elevation ?? NOT_COMPUTABLE_ELEVATION` / `quality.unreliableSegments ?? NOT_COMPUTABLE_UNRELIABLE_SEGMENTS`)
+ `src/dashboard/data/pace-quality-client.ts:325-345` (`parseActivityQualitySignals`'s matching `??`
dispatch)
**Apply to:** every new read of the two new signal keys from a `quality`/`ParsedDashboardIndexRow`
object that may predate this phase (stale `index.json`, lagging staged build) — BOTH the write-side
render function (`detail-sections.ts`) and the read-side network parser (`pace-quality-client.ts`)
need their own `??` fallback constant, following the two-file pattern this codebase has now
established three times (elevation, unreliableSegments, and now pause classification/forgotten stop).

### Standalone-explanation-constant exception
**Source:** `src/dashboard/views/detail-sections.ts:913-918` (`DEVICE_ERA_EXPLANATION`/
`ELAPSED_VS_MOVING_EXPLANATION`)
**Apply to:** the two new rows' explanation text — module-level string constants, never routed
through `EXPLANATION_PROBE_SPECS`/`tieringExplanation` (reserved for the three `hasAnySevereSignal`-
feeding tiering signals only).

### Fail-closed, string-scan-based zero-import guard
**Source:** `scripts/unreliable-segment-import-guards.test.mjs` (consolidated guard file, confirmed
present this session) + `scripts/compute-unreliable-segment-recount.mjs`'s own docblock discipline
**Apply to:** every new `.mjs` script this phase adds — copy the `stripComments`/
`FORBIDDEN_MODULE_NAMES`/raw-source-sanity-check shape; never substitute an unverified `vi.spyOn(fs,
...)` runtime mock (explicit pitfall, restated above).

### The HALT/pre-declared-shapes/first-clearing calibration pipeline
**Source:** `scripts/compute-unreliable-segment-severity-calibration.mjs` (structure confirmed live
this session) + `32-CALIBRATION.md`/`33-CALIBRATION.md` (the rendered artifact shape)
**Apply to:** D-06 (walk/run valley), D-07 (drift floor), D-13 (min-duration) — each gets its own
pre-declared candidate list, fixed tolerance, `insensitivityForCandidate`-style two-direction check,
first-clearing selection, and a strawman watched failing first. `chosen: null` (no candidate
clears) is the committed NO-VALUE/HALT artifact D-08 requires — not a silently-widened tolerance.

### Independent recount, structurally different traversal
**Source:** `scripts/compute-unreliable-segment-recount.mjs` (gap-first vs. the detector's run-first
traversal, docblock quoted above)
**Apply to:** D-18's `compute-pause-classification-recount.mjs` — extend the EXISTING gap-first
per-segment table (never re-derive the merge) with one more column (the classified band), computed
by re-applying the calibrated speed-band constants to the SAME independently-derived metres/seconds
this recount already produces.

## No Analog Found

None for the core wiring. Every mechanism Phase 34 needs — untiered-fact signal shape, never-widen
guard, capped shard projection, CR-01 fallback (both write- and read-side), section-builder
template, HALT-capable calibration pipeline, zero-import recount — has an exact, current, same-repo
precedent verified this session. The two genuinely novel pieces are the mechanism-join itself
(`pause-classification.ts`'s core logic, D-01) and the D-10 blind-spot discriminator
(`cvDd`/`cvDt`-ratio rule) — **both are new algorithms with no prior in-repo shape to copy**, but
RESEARCH.md already traces both to verified, working, archive-tested logic (not merely proposed);
they are new CODE, not new PATTERN-SHAPES — the total-function/guard/never-throws discipline that
wraps them (T-26-01/T-26-02) is itself copied verbatim from `classifyGapsWithSegments`'s/
`detectUnreliableSegments`'s own entry guards.

## Metadata

**Analog search scope:** `src/analytics/pace-derivation.ts` (full read, offset 1-180 + 380-680),
`src/analytics/unreliable-segments.ts` (targeted reads, lines 140-210 + 580-660), `src/analytics/pace-quality.ts`
(full-file grep + targeted reads, lines 60-260, 500-780, 1490-1881), `src/analytics/pace-quality.test.ts`
(targeted read, lines 1599-1660), `src/analytics/pace-single-source.test.ts` (grep pass, allowlist
confirmed unchanged), `src/dashboard/views/detail-sections.ts` (targeted reads, lines 300-400,
837-935, 960-1010, 1180-1260, 1440-1640), `src/dashboard/views/detail.ts` (grep pass, mounting order
confirmed), `src/dashboard/data/pace-quality-client.ts` (targeted read, lines 160-345), `src/analytics/dashboard-index.types.ts`
(grep pass), `scripts/` directory listing + `scripts/compute-unreliable-segment-recount.mjs` (docblock
read, lines 1-90) + `scripts/compute-unreliable-segment-severity-calibration.mjs` (grep pass,
HALT/first-clearing structure confirmed).
**Files read in full or by targeted, non-overlapping section this session:** listed above; every
line-number citation in this document was independently re-verified against the live tree this
session (not copied from RESEARCH.md's cache, though RESEARCH.md's own claims were confirmed
accurate in every case checked).
**Pattern extraction date:** 2026-09-22
