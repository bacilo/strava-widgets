# Phase 35: Stream-Derived Running Pace - Pattern Map

**Mapped:** 2026-09-24
**Files analyzed:** 15 (2 extended core analytics files + their `.test.ts`, 1 CI writer + its
`.test.ts`, 1 type-contract file, 3 extended dashboard-view files + their `.test.ts`, 2 new
calibration/recount scripts + their `.test.mjs`, 1 new generated calibration artifact, 3 dated
planning-doc amendments)
**Analogs found:** 15 / 15 — every mechanism this phase needs (total-function coverage math, the
retarget-a-comparator shape, the gated-vs-unconditional stream read, the accessible-badge/rebase
chain, the HALT-capable calibration pipeline, the zero-import recount, the stub-the-detector
load-bearing proof) already ships in this codebase from Phases 26/32/33/34. This is a "retarget one
comparator and add one new coverage-derived quantity" phase, not an "invent new machinery" phase —
the one genuinely new piece (the running-pace metres accounting itself, D-08) still reuses an
already-computed, already-tested field (`coveredRuns`) rather than inventing a new traversal.

No `./CLAUDE.md` and no `.claude/skills/`/`.agents/skills/` directory exist in this repo (confirmed
this session) — nothing project-specific to load beyond REQUIREMENTS.md/PROJECT.md conventions
already carried by CONTEXT.md/RESEARCH.md.

All code excerpts below were read directly from the live tree this session (line numbers current as
of 2026-09-24 — `pace-derivation.ts` is 1,002 lines, `pace-single-source.test.ts` is 1,238 lines,
`detail-sections.ts` is 2,127 lines, `list.ts` is 1,941 lines, `pace-quality.ts` is 2,298 lines —
every citation below was independently re-verified against the live tree, not copied from
RESEARCH.md's or a prior phase's PATTERNS.md's cached numbers, though every claim checked against
those documents was confirmed accurate).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/analytics/pace-derivation.ts` (extend — new running-pace function reusing `coveredRuns`, retargeted `detectPaceDisagreement`, `PaceDisagreementResult` shape change, `streamPaceSecPerKm` disposition) | service (pure compute, shared leaf module) | transform (batch over `t[]`/`d[]`, reuses an already-computed partition) | itself — `classifyGapsWithSegments`'s own `coveredRuns` field (`:125-151`, `:596-600`) is the exact reusable numerator; `detectPaceDisagreement`'s existing all-or-nothing contract (`:980-1002`) is the exact shape to retarget, not restructure | exact — the function whose contract is being extended already exists at the exact seam D-01 needs |
| `src/analytics/pace-derivation.test.ts` (extend) | test | — | the file's own existing coverage/derivation test blocks (not separately re-read this session — same file, same conventions as every other exported function's test) | exact |
| `src/analytics/pace-single-source.test.ts` (extend — D-11's stub-the-detector proof for the new running-pace function; possibly a `BANNED_LITERALS`/`GAP_MEMBERSHIP_LITERALS`-style extension if D-08 introduces a new arithmetic shape) | test (structural audit + load-bearing proof) | — | itself — the **Phase 33 SEG-05b block** (`:889-941`) and, even closer, the **Phase 34 SEG-05b block** (`:964-` onward) which already stubs `detectUnreliableSegments` on activity `3475724402` — Phase 35's own scoping fixture — through **two** re-import hops | exact — a near-verbatim template already exists for this exact activity |
| `src/analytics/compute-dashboard-index.ts` (extend — fold the running-pace + retargeted disagreement computation into the ALREADY-unconditional quality-signal stream read; remove/repurpose the `< 200` gate) | controller (CI compute orchestration) | batch | itself — the existing gated block (`:244-262`) beside the existing unconditional block (`:264-290`) it must be folded into | exact — both the defect (Pitfall 1) and its fix site are the same file, already read live this session |
| `src/analytics/compute-dashboard-index.test.ts` (extend) | test | — | the file's own existing row-assembly tests (not separately re-read — same conventions) | exact |
| `src/analytics/dashboard-index.types.ts` (extend — `PaceDisagreement` field shape per D-04, new running-pace row field per D-10) | config (type contract) | — | itself — `PaceDisagreement` (`:149-153`) and its own docblock's `DASHBOARD_INDEX_SCHEMA_VERSION` stays-`1` precedent (`:96-141`) | exact |
| `src/dashboard/views/detail.ts` (extend — Running Pace tile, retargeted badge text/position, `rebasedAveragePaceSecPerKm` reads the new field) | controller (DOM mounting + render) | request-response (index-row read, synchronous render) | itself — the existing Pace stat card block (`:666-699`), the `disagreement` read (`:679`), `rebasedAveragePaceSecPerKm` (`:809`), the Gear-tile "append only when there is something to show" precedent (`:739-741`) for the omitted-entirely state | exact |
| `src/dashboard/views/detail-sections.ts` (extend — `isRebasedAverage` note text, no structural change to `buildSplitsSection`) | component (pure render-plan / DOM builder) | transform | itself — `buildSplitsSection`'s existing `isRebasedAverage` branch (`:427-432`) | exact |
| `src/dashboard/views/list.ts` (extend — `paceDisputedExplanation` text, possibly `statusBadgeTexts`/`appendStatusBadges` reach unchanged since the dispatch is already population-agnostic) | component (pure render-plan, no DOM) | transform | itself — `paceDisputedExplanation` (`:307-309`), `statusBadgeTexts` (`:662-688`), `appendStatusBadges` (`:710-722`) | exact — D-03's "reach" question turns out to need **zero structural change** here (see finding below); only the shared explanation string and disagreement population size change |
| `src/dashboard/views/detail.test.ts` / `detail-sections.test.ts` / `list.test.ts` (extend) | test | — | each file's own existing conventions | exact |
| `scripts/compute-<name>-calibration.mjs` (NEW, D-05's full HALT-capable calibration) | utility (calibration generator, HALT-capable) | batch | `scripts/compute-pause-classification-calibration.mjs` (full structure: pre-declared shapes, strawman-first, D-13 insensitivity, first-clearing arbitration, `## NO SHAPE CLEARS`, content-addressed provenance) | exact |
| `scripts/compute-<name>-calibration.test.mjs` (NEW) | test | — | `scripts/compute-pause-classification-calibration.mjs`'s own paired `.test.mjs` (not separately re-read — same file-pair convention as every prior calibration script) | exact |
| `scripts/compute-<name>-recount.mjs` (NEW, D-08's zero-import independent recount) | utility (archive-scoped independent recount) | batch, fails-closed | `scripts/compute-unreliable-segment-recount.mjs` (docblock + zero-import discipline, read in full this session) | exact |
| `scripts/compute-<name>-recount.test.mjs` (NEW) | test | — | `scripts/unreliable-segment-import-guards.test.mjs`'s consolidated string-scan shape (per Phase 33/34's own PATTERNS.md, structure confirmed sound and unchanged) | exact |
| `.planning/phases/35-stream-derived-running-pace/35-CALIBRATION.md` (NEW, generated artifact) | committed artifact | — | `.planning/phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md` / `33-CALIBRATION.md` (full shape, HALT precedent, deterministic content-addressed provenance) | exact |
| `.planning/REQUIREMENTS.md` (SEG-05b row, D-11, records Phase 35's half without re-ticking), `.planning/milestones/v2.2-REQUIREMENTS.md:62,64` (D-04's dated amendment of the 5:51/km figure), `26-07-SUMMARY.md`/`26-07-PLAN.md` (forward pointers, if amended) | config (planning doc edit) | — | Phase 33/34's own PATTERNS.md-cited dated-amendment precedent ("read the live files directly when planning the amendment task") — Phase 32 D-03/D-14, Phase 33 D-12, Phase 34 D-02 | n/a — doc edit, not code pattern |

## Pattern Assignments

### `src/analytics/pace-derivation.ts` — the running-pace function (D-08) and the comparator retarget (D-01)

**Analog:** itself — `classifyGapsWithSegments`'s `coveredRuns` field and `detectPaceDisagreement`'s
existing contract, both read in full this session at their live line numbers.

**The exact reusable numerator, confirmed live** (`:112-128`, `:136-151`):
```typescript
/**
 * One maximal run of consecutive `'covered'` pairs, `[startIndex, endIndex)`
 * over the pair-index space (pair `i` spans samples `t[i]`..`t[i+1]`), from
 * `classifyGapsWithSegments`'s own FINAL `pairKinds` array ... Deliberately
 * index-based, never a second `startSec`/`endSec` boundary convention
 * derived by re-scanning floating-point sample times — the same reason the
 * pass-3 detector-segment containment check above is index-based (32-13/
 * 32-17's fixed defect: a second, disagreeing boundary convention can
 * double-count a shared interval).
 */
export interface CoveredRun {
  startIndex: number;
  endIndex: number;
}

function deriveCoveredRuns(pairKinds: readonly PairKind[]): CoveredRun[] {
  const runs: CoveredRun[] = [];
  let runStart: number | null = null;
  for (let i = 0; i < pairKinds.length; i++) {
    if (pairKinds[i] === 'covered') {
      if (runStart === null) runStart = i;
    } else if (runStart !== null) {
      runs.push({ startIndex: runStart, endIndex: i });
      runStart = null;
    }
  }
  if (runStart !== null) {
    runs.push({ startIndex: runStart, endIndex: pairKinds.length });
  }
  return runs;
}
```
and its production, confirmed live (`:596-600`, inside `classifyGapsWithSegments`):
```typescript
    segments,
    // Derived from the SAME final pairKinds array finalAcc was summed from —
    // no second classification pass, no re-scan of gapIntervals (D-01).
    coveredRuns: deriveCoveredRuns(pairKinds),
```
`coveredRuns` ships today, already computed, already returned by
`classifyGapsWithSegments(t, d, options).coveredRuns` — no caller reads it yet outside
`pace-quality.ts`'s own uses (verified by grep this session: `resolveCoverage`-adjacent code paths
only). **The lower-risk shape for D-08's new function** (naming it is Claude's Discretion, e.g.
`deriveRunningPace`): sum `d[run.endIndex] - d[run.startIndex]` over every `coveredRuns` entry for
the metres numerator, divide by `coverage.coveredSec` (already the exact-second denominator proven
by COV-01/COV-03, and already the number `coverageCaptionText` discloses — see D-08's own binding
"must reconcile with what the coverage caption already discloses" text). This is structurally
guaranteed to reconcile because numerator and denominator are two views of the identical final
`pairKinds` partition, not two independent computations — RESEARCH.md's Pattern 1 argues this at
length; this file confirms the underlying field is real, live, and already-tested, not a research
proposal.

**The exclusion metres/seconds the disclosure sentence needs are the complement of the same sum:**
`excludedM = totalDistanceM - coveredMetres`, `excludedSec = coverage.spanSec - coverage.coveredSec`
(equivalently `recordingGapSec + pauseSec + unreliableSec`) — both already-in-hand quantities once
`coverage` is computed, no new traversal needed for the exclusion half.

**The boundary-case activity to pin as a test (RESEARCH.md's own flagged edge case, D-08's "boundary
handling stated explicitly"):** an activity whose excluded metres round to 0 but excluded seconds
are large (the probe's own reference: 3475742397, 0 m / 1,211 s excluded) — assert the new
function's numerator is NOT silently perturbed by such a run's own start/end indices, since
`d[run.endIndex] - d[run.startIndex]` at a run immediately adjacent to a near-zero-advance
`recording-gap`/`pause` is exactly where a careless boundary convention could diverge (Pattern 1's
own stated risk).

**`streamPaceSecPerKm` — the exact function D-01 retires as comparator, quoted in full, current and
unchanged** (`:930-953`):
```typescript
/**
 * Span-based stream pace: `(t[n-1] - t[0]) / ((d[n-1] - d[0]) / 1000)`, or
 * `null` when the stream is invalid (via `validateStreamSeries`), the time
 * span is not positive, or the distance span is not positive.
 * ...
 */
export function streamPaceSecPerKm(stream: CanonicalStream): number | null {
  const { t, d } = stream;
  if (!validateStreamSeries(t, d).ok) return null;

  const n = t.length;
  const spanSec = t[n - 1] - t[0];
  const spanM = d[n - 1] - d[0];
  if (!(spanSec > 0) || !(spanM > 0)) return null;

  return spanSec / (spanM / 1000);
}
```
Confirms RESEARCH.md's grep claim: nothing in this file or elsewhere calls `streamPaceSecPerKm`
except `detectPaceDisagreement` below (re-verify by grep at execution time before choosing D-01's
disposition — delete, keep standalone, or keep test-only).

**`detectPaceDisagreement`'s exact current contract to retarget, not restructure, quoted in full**
(`:955-1002`):
```typescript
export interface PaceDisagreementResult {
  streamPaceSecPerKm: number;
  metadataPaceSecPerKm: number;
  ratio: number;
}

export function detectPaceDisagreement(
  metadataPaceSecPerKm: number | null,
  stream: CanonicalStream,
  options?: { metadataThresholdSecPerKm?: number; ratio?: number }
): PaceDisagreementResult | null {
  const threshold =
    options?.metadataThresholdSecPerKm ?? PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM;
  const ratioFloor = options?.ratio ?? PACE_DISAGREEMENT_RATIO;

  if (metadataPaceSecPerKm === null || !(metadataPaceSecPerKm > 0)) return null;
  if (!(metadataPaceSecPerKm < threshold)) return null;

  const streamPace = streamPaceSecPerKm(stream);
  if (streamPace === null) return null;

  if (!(streamPace / metadataPaceSecPerKm >= ratioFloor)) return null;

  return {
    streamPaceSecPerKm: Math.round(streamPace * 10) / 10,
    metadataPaceSecPerKm: Math.round(metadataPaceSecPerKm * 10) / 10,
    ratio: Math.round((streamPace / metadataPaceSecPerKm) * 100) / 100,
  };
}
```
D-01's change is to the comparator (`streamPaceSecPerKm(stream)` → the new running-pace value) and
the eligibility gate (`metadataPaceSecPerKm < threshold` → D-02's replacement, which must NOT
exclude 3475724402's 296.0 s/km). The all-or-nothing return contract (`null` or fully populated,
never partial) is explicitly NOT what changes (RESEARCH.md's own Code Examples section states this;
confirmed against the live function body — there is no partial-return path to accidentally
introduce). RESEARCH.md's own Assumption A3 flags that the signature likely needs to accept an
ALREADY-COMPUTED running pace rather than recomputing it internally (since Pitfall 1's fix means
the running pace is computed once, unconditionally, before this function is ever called) — follow
that shape: `detectPaceDisagreement(metadataPaceSecPerKm, runningPaceSecPerKm, options)` rather than
`(metadataPaceSecPerKm, stream, options)`, to avoid a second computation of the same numbers per
activity.

**The two named constants to retarget/replace, quoted in full, current** (`:914-928`):
```typescript
export const PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM = 200;
export const PACE_DISAGREEMENT_RATIO = 2;
```
Each constant's docblock ("measurement provenance + no-tuning-toward-a-count rule") is the template
D-02/D-05/D-06/D-07's replacement constant(s) must follow verbatim — this is itself the prose D-04
names as needing amendment once the old threshold is superseded (never a silent overwrite: state
what the old constant measured, what replaced it, and why, per the 32 D-03 / 33 D-12 / 34 D-02
dated-amendment pattern already used four times in this codebase).

---

### `src/analytics/pace-single-source.test.ts` — the D-11 stub-the-detector proof, near-verbatim template already in this file

**Analog:** the file's own **Phase 34 SEG-05b block**, which already stubs
`detectUnreliableSegments` on activity `3475724402` — Phase 35's own named scoping fixture — through
two re-import hops. This is the closest possible in-repo precedent: same activity ID, same stub
target, same "prove the import is load-bearing, not merely present" claim.

**The Phase 33 twin (single-hop: `pace-derivation.ts` itself), quoted in full** (`:889-941`):
```typescript
describe('pace-derivation.ts\'s detector import is load-bearing (SEG-05b, D-15)', () => {
  it('stubbing detectUnreliableSegments to return [] on real 3475734189 both zeroes ' +
     'unreliableSec AND un-clips the previously-clipped window; the real module does the ' +
     'opposite in both respects', async () => {
    const stream = JSON.parse(
      readFileSync(path.join('data', 'streams', '3475734189.json'), 'utf-8')
    ) as import('../streams/stream.types.js').CanonicalStream;

    vi.resetModules();
    const real = await import('./pace-derivation.js');
    const realCoverage = real.classifyGaps(stream.t, stream.d);
    const realDerived = real.derivePaceWithCoverage(stream);
    expect(realCoverage.unreliableSec).toBeGreaterThan(0);
    // ... strictlyInsideIndices assertion on realDerived.paceSeries ...

    vi.doMock('./unreliable-segments.js', async () => {
      const actual =
        await vi.importActual<typeof import('./unreliable-segments.js')>('./unreliable-segments.js');
      return { ...actual, detectUnreliableSegments: () => [] };
    });
    vi.resetModules();
    const stubbed = await import('./pace-derivation.js');
    const stubbedCoverage = stubbed.classifyGaps(stream.t, stream.d);
    const stubbedDerived = stubbed.derivePaceWithCoverage(stream);
    expect(stubbedCoverage.unreliableSec).toBe(0);
    // ... anyNonNullInStubbedWindow assertion, BOTH directions in one test ...

    vi.doUnmock('./unreliable-segments.js');
    vi.resetModules();
  });
});
```

**The Phase 34 twin (two-hop: `pause-classification.ts` → `pace-derivation.ts` →
`unreliable-segments.ts`), the EXACT shape D-11 needs since the new running-pace function is itself
one more hop downstream of the same chain, quoted in full** (`:964-` onward, read this session):
```typescript
describe('pause-classification reads the detector (SEG-05b, Phase 34 half)', () => {
  const TEST_BANDS = { stationaryMaxMps: 0.5, walkRunMps: 2.0 };

  it("stubbing detectUnreliableSegments to [] on real 3475724402 zeroes merged-segment " +
     "intervals and changes at least one recording-gap interval's class inside a real " +
     "merged interval's bounds; the real module gives at least one merged-segment interval",
     async () => {
    const stream = JSON.parse(
      readFileSync(path.join('data', 'streams', '3475724402.json'), 'utf-8')
    ) as import('../streams/stream.types.js').CanonicalStream;

    vi.resetModules();
    const realPaceDerivation = await import('./pace-derivation.js');
    const realPauseClassification = await import('./pause-classification.js');
    const { coverage: realCoverage, segments: realSegments } =
      realPaceDerivation.classifyGapsWithSegments(stream.t, stream.d);
    const realResult = realPauseClassification.classifyPauses(
      stream.t, stream.d, realCoverage, realSegments, TEST_BANDS
    );
    const realMergedIntervals = realResult.intervals.filter((iv) => iv.source === 'merged-segment');
    expect(realMergedIntervals.length).toBeGreaterThan(0); // reachability — real direction

    vi.doMock('./unreliable-segments.js', async () => {
      const actual =
        await vi.importActual<typeof import('./unreliable-segments.js')>('./unreliable-segments.js');
      return { ...actual, detectUnreliableSegments: () => [] };
    });
    vi.resetModules();
    const stubbedPaceDerivation = await import('./pace-derivation.js');
    const stubbedPauseClassification = await import('./pause-classification.js');
    const { coverage: stubbedCoverage, segments: stubbedSegments } =
      stubbedPaceDerivation.classifyGapsWithSegments(stream.t, stream.d);
    expect(stubbedSegments).toEqual([]); // reachability — the stub actually took
    // ... continues asserting the stubbed classification differs on the real named activity ...
  });
});
```
**Phase 35's own D-11 proof copies this exact two-part shape** on the SAME activity
(`3475724402`, which is ALSO the ROADMAP criterion 3 fixture — no need to introduce a new named
activity for this proof): real direction first (assert the running-pace/excluded-metres output
depends on a non-empty `segments` list), then `vi.doMock('./unreliable-segments.js', ...)` returning
`[]`, `vi.resetModules()`, re-import, and assert the running-pace/excluded-metres value CHANGES on
the same activity — both directions in the same test, per the project's own "a one-direction
assertion would pass against a build where the chart never renders at all" rule (quoted verbatim in
both existing blocks above). Since D-11's new function is itself called from inside
`pace-derivation.ts` (not a second module importing it, unlike Phase 34's two-hop case), this is
actually the SIMPLER, single-hop shape (Phase 33's block above) — stub `unreliable-segments.js`,
re-import `pace-derivation.js`, call the new running-pace function directly, assert the excluded
metres/seconds change.

**`BANNED_LITERALS`/`ALLOWED_FILE_SUFFIX` — confirmed live, current, the exact audit surface a new
inline reimplementation would need to evade** (`:136-150`):
```typescript
const BANNED_LITERALS = ['dt / (dd / 1000)', 'elapsed / (metres / 1000)'] as const;
const ALLOWED_FILE_SUFFIX = 'analytics/pace-derivation.ts';
const ALLOWED_SELF_SUFFIX = 'analytics/pace-single-source.test.ts';
```
Confirms RESEARCH.md's Anti-Pattern warning directly: neither `BANNED_LITERALS` entry would catch a
NEW running-pace formula (`coveredMetres / (coveredSec / 1000)` or similar) reimplemented inline at
a second call site — this audit's literal-matching shape is narrow BY DESIGN (RESEARCH.md's own
"not a broad shape" quote from this file's docblock, `:130-135`). If the plan chooses to guard
against a drifted duplicate structurally, it must EITHER add the new formula's own literal(s) to
`BANNED_LITERALS`/a sibling array (mirroring `GAP_MEMBERSHIP_LITERALS`'s addition for the
Phase-26-era blind spot, `:62-65`) OR rely on "one function, every consumer imports it" by
construction — the codebase's own stated fallback when a new literal-scan entry is not added.

---

### `src/analytics/compute-dashboard-index.ts` — Pitfall 1's fix site, confirmed live and exact

**Analog:** itself — the gated block sits four lines above the unconditional block it must fold
into, both already read in full this session.

**The gate that would make 3475724402 unreachable, quoted verbatim, current, live** (`:241-262`):
```typescript
let paceDisagreement: PaceDisagreement | null = null;
let streamForActivity: CanonicalStream | null = null;
let streamReadAttempted = false;
if (
  paceSecPerKm !== null &&
  paceSecPerKm < PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM
) {
  streamReadAttempted = true;
  try {
    streamForActivity = await fileStore.readJson<CanonicalStream>(
      path.join(streamsDir, `${id}.json`)
    );
    paceDisagreement = detectPaceDisagreement(paceSecPerKm, streamForActivity);
  } catch (error) {
    console.warn(
      `  ${id}: could not read stream for pace disagreement check (${(error as Error).message}); paceDisagreement will be null`
    );
    paceDisagreement = null;
    streamForActivity = null;
  }
  if (paceDisagreement !== null) paceDisagreementCount++;
}
```
3475724402's metadata pace is 296.0 s/km — `paceSecPerKm < 200` is `false`, so this branch never
executes for it TODAY. Confirmed exactly as RESEARCH.md's Pitfall 1 describes, live, not inferred.

**The ALREADY-unconditional block, four lines below, that the fix folds into, quoted verbatim,
current, live** (`:264-311`):
```typescript
const qualityStart = Date.now();
let streamForQuality: CanonicalStream | null = streamForActivity;
if (!streamReadAttempted) {
  if (entry.available) {
    try {
      streamForQuality = await fileStore.readJson<CanonicalStream>(
        path.join(streamsDir, `${id}.json`)
      );
    } catch (error) {
      console.warn(
        `  ${id}: could not read stream for quality signals (${(error as Error).message}); quality will be not-computable`
      );
      streamForQuality = null;
    }
  } else {
    streamForQuality = null;
  }
}

const qualityMetadata: ActivityQualityMetadata = { /* ... */ };
const quality: ActivityQualitySignals = computePaceQualitySignals(streamForQuality, qualityMetadata);
const shard: PaceQualityShard = buildPaceQualityShard(String(id), streamForQuality, qualityMetadata);
```
This block ALREADY reads every `entry.available` activity's stream unconditionally, and reuses
`streamForActivity` when the gated block above already read it (the `streamReadAttempted` flag).
**The fix (RESEARCH.md's Pitfall 1 / Assumption A2): compute the running pace and the retargeted
`detectPaceDisagreement` call from `streamForQuality` here, not from a third independently-gated
read.** Concretely: move (or duplicate the trigger for) the running-pace + disagreement computation
to AFTER this block resolves `streamForQuality`, so every `entry.available` activity gets a running
pace, and the disagreement check becomes a filter on an ALREADY-COMPUTED running pace (D-02's
eligibility gate), never a filter on whether to read the stream at all. `round1` (`:36`, confirmed
live) is the existing rounding convention `detectPaceDisagreement`'s own rounding already matches —
reuse it for the running pace's own rounding, never a fourth rounding convention.

---

### `src/dashboard/views/detail.ts` — the Pace stat card, Running Pace tile, and the rebase call site

**Analog:** itself — every call site below already exists at its live line number, read in full
this session (not from RESEARCH.md's cache, though the cached numbers matched almost exactly).

**The metadata Pace tile + disagreement read + existing badge attach, quoted verbatim, current,
live** (`:666-699`):
```typescript
const distanceM = numOrNull(activity.distance);
const movingTimeSec = numOrNull(activity.moving_time);
const paceSecPerKm =
  distanceM !== null && distanceM > 0 && movingTimeSec !== null && movingTimeSec > 0
    ? movingTimeSec / (distanceM / 1000)
    : null;

const disagreement = indexClient.getRow(detail.id)?.paceDisagreement ?? null;

statGrid.appendChild(buildStatCard(formatOrDash(distanceM, (v) => `${(v / 1000).toFixed(1)} km`), 'Distance'));
statGrid.appendChild(buildStatCard(formatOrDash(movingTimeSec, formatDurationHms), 'Moving Time'));
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
```
`paceSecPerKm` (the metadata figure) is untouched by this phase (ROADMAP criterion 4) — confirmed:
no line above reads `disagreement` to compute `paceSecPerKm` itself, only to decide whether to
attach a badge. The badge text template (`` `Pace disputed — stream-derived ${...}` ``) is the exact
string the UI-SPEC's Copywriting Contract retargets to `` `Pace disputed — running ${...}` `` —
same call site, same `appendAccessibleBadge`/`paceDisputedExplanation` machinery, only the visible
text template and the field it reads (`disagreement.streamPaceSecPerKm` → whatever D-04 names the
retargeted field) change.

**The Gear-tile "append only when there is something to show" precedent — the exact template for
the Running Pace tile's "omitted entirely" state (UI-SPEC's own cited precedent)** (`:736-741`):
```typescript
// Gear tile (D-32/D-33): appended ONLY when resolveGearLabel returns a
// string — omitting the DOM node entirely (never an empty-labelled
// tile) is the whole `.stat-grid` auto-fit reflow contract.
if (gearLabel !== null) {
  statGrid.appendChild(buildStatCard(gearLabel, 'Gear'));
}
```
The Running Pace tile follows this exact `if (condition) { statGrid.appendChild(buildStatCard(...)) }`
shape for the `detail.stream === null` omitted-entirely case (UI-SPEC's row 7), inserted immediately
after the metadata `paceStatCard` append (UI-SPEC's binding tile-order requirement — "the fourth
tile, immediately after Pace").

**The elevation stat-card badge reuse — confirms "one text builder, two surfaces" extends to a
detail-view stat card, the precedent for the Running Pace tile's own not-computable/badge content
if reused** (`:709-721`, already read this session, unchanged by this phase but instructive as a
template):
```typescript
const elevationStatCard = buildStatCard(
  formatOrDash(numOrNull(activity.total_elevation_gain), (v) => `${Math.round(v)} m`),
  'Elevation Gain'
);
const quality = indexClient.getRow(detail.id)?.quality ?? null;
if (quality?.elevation?.tier === 'severe') {
  const content = elevationBadgeContent(quality.elevation);
  if (content !== null) {
    appendAccessibleBadge(elevationStatCard, content.visibleText, content.explanation,
      qualityBadgeDescriptionId('detail-elevation-stat', 'elevation')
    );
  }
}
```
The `indexClient.getRow(detail.id)?.<field> ?? null` optional-chained read pattern is the ONE
template every new row-field read in this phase follows (the running pace's own row field,
whatever D-10 names it) — tolerant of a re-parsed row missing the key, matching `disagreement`'s own
read one line above it.

**The rebase call site D-09 governs, quoted verbatim, current, live** (`:792-818`):
```typescript
if (detail.stream !== null) {
  const splits = computeSplits(detail.stream);
  const derived = derivePaceWithCoverage(detail.stream);
  const rebasedAveragePaceSecPerKm = disagreement !== null ? disagreement.streamPaceSecPerKm : paceSecPerKm;

  view.appendChild(
    buildSplitsSection(
      splits,
      rebasedAveragePaceSecPerKm,
      splitGapAnnotations(splits, derived.coverage.gapIntervals),
      disagreement !== null
    )
  );
  // ...
}
```
This is EXACTLY the one-line conditional CONTEXT.md's D-09 and RESEARCH.md's Pattern 2 both name:
`disagreement !== null ? disagreement.streamPaceSecPerKm : paceSecPerKm`. Once D-04 renames/retargets
`PaceDisagreementResult`'s field to the running pace, this line needs NO other change — it already
reads whatever `disagreement`'s comparator-field is, and the widened badge population (from D-01/
D-05/D-06) automatically widens the rebased population by exactly the same amount, as CONTEXT.md's
own text states. `disagreement !== null` (the fourth argument, `isRebasedAverage`) is similarly
unchanged — it is already a boolean derived from the SAME `disagreement` value the badge reads.

**Note on `mountBestEffortsAndBadges`'s existing `qualitySignalsContainer`/`pausesContainer`
create-once/fill-later shape (`:783-790`, `:833-834`, `:839-840`, confirmed live, unchanged by this
phase):** the Running Pace tile does NOT need this shape — unlike Quality Signals/Pauses (which are
fetched from a separate lazy shard via `Promise.all`), the running pace/exclusions/disagreement are
already synchronously available from `indexClient.getRow(detail.id)` at the SAME point
`disagreement` itself is read (`:679`), so the Running Pace tile is built and appended synchronously
alongside the Pace tile, with no new `await` point and no new container-then-fill split.

---

### `src/dashboard/views/detail-sections.ts` — the `isRebasedAverage` note, unchanged shape, retargeted text only

**Analog:** itself — `buildSplitsSection`'s existing disclosure-note branch, read in full this
session, current and unchanged in structure since Phase 26 shipped it.

**The exact note to retarget, quoted verbatim, current, live** (`:427-432`):
```typescript
if (isRebasedAverage && activityAvgPaceSecPerKm !== null) {
  const note = document.createElement('p');
  note.className = 'text-label';
  note.textContent = `Splits above are compared against the stream-derived average (${formatPace(activityAvgPaceSecPerKm)}), not the disputed metadata average.`;
  section.appendChild(note);
}
```
UI-SPEC's Copywriting Contract retargets the string to `"Splits above are compared against the
running pace ({avgFormatted}), not the disputed metadata average."` — a COPY-ONLY change at this
exact site; `buildSplitsSection`'s signature, its `isRebasedAverage`/`activityAvgPaceSecPerKm`
parameters, and every other line of this function are unchanged (confirmed by the full read above —
`activityAvgPaceSecPerKm` is already whatever value the caller passes, `detail.ts:809`'s
`rebasedAveragePaceSecPerKm`, so no re-derivation is needed here).

**`buildPaceBarCell` — confirmed UNCHANGED and untouched by this phase** (`:254-299`, read in full
this session): diffs `split.paceSecPerKm` against whatever `activityAvgPaceSecPerKm` it is handed —
already reused verbatim by the rebase, no edit needed.

**`coverageCaptionText` — the exact function RPACE-02's "must reconcile with what the coverage
caption already discloses" binds against, confirmed live** (`:91`+, signature only re-confirmed this
session; full body already mapped in `33-PATTERNS.md`'s own excerpt, unchanged since): reads
`coverage.coveredSec`/`recordingGapSec`/`pauseSec`/`unreliableSec` against `coverage.spanSec` —
exactly the same `PaceCoverage` object the new running-pace function's denominator must read, so a
correct D-08 implementation cannot present a different "excluded seconds" number than this caption
already shows for the same activity, by construction (both read the same `coverage`).

---

### `src/dashboard/views/list.ts` — the shared disclosure sentence and the badge-reach non-finding

**Analog:** itself — `paceDisputedExplanation`, `statusBadgeTexts`, `appendStatusBadges`, all read
in full this session at their live line numbers.

**The one shared sentence both surfaces read, quoted verbatim, current, live** (`:300-309`):
```typescript
/**
 * The full disclosure sentence behind the pace-disputed badge's `title` and
 * `.sr-only` description ... the single definition both the row badge
 * (`appendPaceDisputedBadge`) and the detail Pace stat-card badge
 * (`detail.ts`) read from, so the explanation text cannot drift between the
 * two surfaces.
 */
export function paceDisputedExplanation(disagreement: PaceDisagreement): string {
  return `Metadata pace disagrees with the stream-derived pace: ${formatPace(disagreement.streamPaceSecPerKm)} measured vs. ${formatPace(disagreement.metadataPaceSecPerKm)} shown`;
}
```
UI-SPEC's Copywriting Contract retargets this to `"Metadata pace disagrees with the running pace:
{running} measured vs. {metadata} shown"` (plus an optional direction clause under D-06's symmetric
reading) — a single-function edit that atomically changes BOTH surfaces' explanation text, exactly
the point CONTEXT.md's D-03 hard rule ("no surface may disagree with another") depends on.

**`statusBadgeTexts`/`appendStatusBadges` — confirmed by direct read this session: D-03's "reach"
question requires NO code change here.** Quoted verbatim, current, live (`:662-688`, `:710-722`):
```typescript
export function statusBadgeTexts(row: DashboardIndexRow): string[] {
  const texts: string[] = [];
  if (!row.streams.available) { /* ... */ }
  if (row.lowConfidence) { texts.push(LOW_CONFIDENCE_BADGE_TEXT); }
  if (rowPaceDisagreement(row) !== null) {
    texts.push(PACE_DISPUTED_BADGE_TEXT);
  }
  // ...
  return texts;
}

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
  appendQualityBadges(container, row, idPrefix);
}
```
Both functions already dispatch on `rowPaceDisagreement(row) !== null` — a boolean that is already
population-size-agnostic. Widening the badged population from 1 to ~20-45 activities (D-01/D-05/
D-06's known consequence) changes WHICH rows this returns `true` for, with **zero** structural
change to either function — `statusBadgeTexts`/`appendStatusBadges` already reach all four
`RowSurface` values (`activity-card`, `activity-table`, `overview-prs`, `overview-activities`)
through the ONE dispatch point their own docblocks (`:281-286`, `:702-708`) already describe. **This
means D-03's "Claude's Discretion, bound by no-surface-may-disagree" is best resolved by CHANGING
NOTHING here** — the widened population reaches all four surfaces automatically and identically,
which is the reading that trivially satisfies the hard rule (no code path exists by which one
surface could read a different `rowPaceDisagreement(row)` value than another, since all four already
call through this same function). A detail-view-only reach (the alternative CONTEXT.md flags as
needing "an explicit argument") would require actively SUPPRESSING this existing dispatch on the
list surfaces — an anti-pattern this codebase's own Phase 24 D-04 lesson already warns against, per
CONTEXT.md's own citation.

**`rowPaceDisagreement` — confirmed live, unchanged, the CR-02 single-read discipline every new
field read should mirror** (`:334-349`, read in full this session): `row.paceDisagreement ?? null`,
`Pick<>`-scoped so it "cannot quietly grow into a second row-interpretation site" — any new field
this phase reads off a row (the running pace itself, if it ships as a row scalar per D-10's
recommendation) should get an identically-shaped single-read accessor if more than one call site
needs it, following this exact precedent.

---

### `scripts/compute-<name>-calibration.mjs` (NEW, D-05's full HALT-capable calibration)

**Analog:** `scripts/compute-pause-classification-calibration.mjs` (2,351 lines, confirmed live this
session) — the most recently exercised full HALT-capable generator in this codebase, run through
three real HALTs per its own commit history.

**The deterministic-provenance discipline — the exact template answering this task's own instruction
to find how prior generators avoid embedding a HEAD hash or timestamp, quoted verbatim, current,
live** (`:1993-1994`, `:2227-2235`, `:2308-2313`):
```javascript
/**
 * Renders the full calibration artifact. `result.allCleared === false` renders `## NO SHAPE CLEARS`
 * and NO `Chosen constants` lines ... Deterministic — no wall-clock timestamp, no bare `rev-parse HEAD`
 * commit id, no source-file hash: a re-render of the same `result` is byte-identical.
 */
export function renderCalibrationMarkdown(result) { /* ... */ }

/** Content-addressed provenance: names the run's actual input (the committed stream archive's git
 * tree), never `rev-parse HEAD` alone, never a wall-clock read, never a classifier source hash. */
function gitId(args) {
  try {
    return execSync(`git ${args}`, { cwd: ROOT_DIR, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown (git failed)';
  }
}

// in main():
result.provenance = {
  streamsTree: gitId('rev-parse HEAD:data/streams'),
  newestActivityStartDate: newestActivityStartDate(ACTIVITIES_DIR),
  controlFilePath: CONTROL_FILE_PATH,
};
```
The key discipline: `gitId('rev-parse HEAD:data/streams')` resolves the **tree object hash of the
`data/streams` directory as of HEAD** (content-addressed — changes only when the archive itself
changes), NOT `gitId('rev-parse HEAD')` (which would change on every unrelated commit, including a
commit that touches nothing this calibration reads — the exact `generated-artifact-head-hash-
breaks-idempotence` failure mode). Regenerating twice against an unchanged archive is byte-identical
BECAUSE nothing wall-clock or repo-wide is embedded — only this directory's own content hash and the
newest activity's own `start_date` (itself archive content, not a clock read). Phase 35's new
calibration script must reuse this exact `gitId('rev-parse HEAD:data/streams')` call (or the
equivalent for whatever directory its own statistic reads), never a bare `rev-parse HEAD`.

**The `## NO SHAPE CLEARS` HALT branch, quoted verbatim, current, live** (`:2128-2135`):
```javascript
} else if (!result.allCleared) {
  lines.push('## NO SHAPE CLEARS');
  lines.push('');
  lines.push(
    'At least one family failed to select a shape clearing D-13 insensitivity. No constant is named ' +
      'for that family or any family downstream of it. Nothing is widened or loosened.'
  );
  lines.push('');
}
```
This is the exact committed-artifact shape D-05's own text requires ("the plan commits a NO SHAPE
CLEARS artifact and HALTs for the developer... nothing is widened, loosened or hand-picked").

**The `## Chosen constants` shipped-value rendering, showing the "ship the DECLARED source text
verbatim, never a runtime-derived string" discipline for any declared (not calibrated) constant,
quoted verbatim, current, live** (`:2110-2127`):
```javascript
if (result.allCleared && !gateFailed) {
  lines.push('## Chosen constants');
  lines.push('');
  lines.push(`STATIONARY_MAX_SPEED_MPS = ${DECLARED_STATIONARY_MAX_SPEED_MPS_TEXT}`);
  lines.push(`STATIONARY_MAX_SPEED_MPS provenance: ${STATIONARY_PROVENANCE_TEXT}`);
  lines.push(`FORGOTTEN_STOP_MIN_SEC = ${result.shipped.FORGOTTEN_STOP_MIN_SEC}`);
  lines.push(
    `FORGOTTEN_STOP_MIN_SEC provenance: calibrated (M family, ${result.families.M.selectedId})`
  );
  // ...
  lines.push(`UNRELIABLE_SPEED_LIMIT_MPS = ${UNRELIABLE_SPEED_LIMIT_MPS} (imported, 32-CALIBRATION.md)`);
}
```
Note the last line's pattern — a constant imported from a PRIOR phase's own calibration is named
with its own provenance ("imported, 32-CALIBRATION.md"), never re-derived. If D-05's calibration
needs to cite any already-shipped constant (e.g. `RECORDING_GAP_ABS_THRESHOLD_SEC`), follow this
exact "imported, cite the source" convention rather than silently duplicating the literal.

**Structural checklist for Phase 35's own pre-declared shapes (D-05's binding text), extracted from
this generator's own section headings, confirmed present and in this order, live** (grep-confirmed
this session): `## Statistic and scope`, `## Pre-declared shapes` (per family, each with `**Meaning:**`
/ `**Non-circularity:**` / `**Caveats:**`), `## Rejected on argument`, `## Non-circularity`,
`## Strawmen watched failing`, `## Shape arbitration`, `## Chosen constants` / `## NO SHAPE CLEARS` /
`## GATE FAILED`, `## Gates`, `## Inputs` (with the provenance lines). Phase 35's single-family
calibration (RPACE-03's one threshold, not three families like Phase 34's G/M/W) renders this same
skeleton with one family instead of three — the section ORDER and NAMES are the load-bearing
convention to copy, not the three-family count.

---

### `scripts/compute-<name>-recount.mjs` (NEW, D-08's zero-import independent recount)

**Analog:** `scripts/compute-unreliable-segment-recount.mjs` (691 lines, docblock read in full this
session — structurally unchanged since Phase 32/33/34's own PATTERNS.md mapped it, still the live,
current analog).

**The zero-import + local-duplicate-constant + bounded-claim discipline, quoted verbatim, current,
live** (`:1-40`):
```
/**
 * D-15's independent gap-first recount for `3475724402` — the standalone verifier SEG-02
 * requires: each merged unreliable segment's distance and time is asserted against a table
 * derived independently of the detector.
 *
 * FORBIDDEN, DELIBERATELY: this file has zero `import`/`require`/dynamic-`import()` statements
 * naming `unreliable-segments` ... A recount that imported the detector that produced
 * the numbers it is checking would agree with itself by construction ...
 *
 * TRAVERSAL, DELIBERATELY MIRRORED: the detector ... is run-first ... This recount is
 * gap-first ...
 *
 * `LOCAL_GAP_THRESHOLD_SEC = 10` is a LOCAL DUPLICATE of `RECORDING_GAP_ABS_THRESHOLD_SEC`
 * (`src/analytics/pace-derivation.ts`) ... duplicating this tiny constant is the price of
 * staying a genuinely independent recount rather than sharing vocabulary with the code it
 * checks.
 *
 * THE BOUND ON ITS CLAIM: this script verifies that the detector's own reported per-segment
 * table (as recorded in the calibration artifact ...) agrees with an independently derived
 * table for the SAME activity — nothing more. It does NOT and cannot arbitrate whether the
 * calibrated ... themselves are the right numbers ...
 */
```
Phase 35's own recount must declare its own LOCAL duplicate of every constant D-08's running-pace
function reads (at minimum `RECORDING_GAP_ABS_THRESHOLD_SEC`, and any pause-threshold formula
inputs it needs to independently re-derive `coveredRuns`-equivalent boundaries), and must forbid
importing `pace-derivation` AND `unreliable-segments` (the transitively-inherited detector, per
Phase 33/34's own precedent of widening `FORBIDDEN_MODULE_NAMES` each time a new module sits between
the recount's subject and the detector). State its own bound-on-claim paragraph explicitly: this
recount verifies the running pace's metres/seconds agree with an independent gap-first derivation
for the NAMED activities it covers — it does not and cannot arbitrate D-05's calibrated threshold
itself (that is the calibration script's job, which DOES import the running-pace function because
that is its job, mirroring the existing severity-calibration script's own stated split).

**Self-execution guard, confirmed present, live, unchanged across every prior recount script:**
```javascript
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) { main(); }
```

---

### `scripts/*.test.mjs` — zero-import structural guard, the recurring flagged pitfall restated

**Analog:** `scripts/unreliable-segment-import-guards.test.mjs` (the consolidated string-scan guard
file, confirmed present this session, unchanged since Phase 33/34's own PATTERNS.md mapped it).

**Explicitly restated per this repo's own memory record (`fs spy cannot observe named imports`) and
this project's own recurring instruction across three prior phases' PATTERNS.md:** copy the
`stripComments`-after-strip-then-`FORBIDDEN_MODULE_NAMES`-string-scan shape for BOTH new `.mjs`
scripts' guard tests. Do **not** substitute an unverified `vi.spyOn(fs, 'readFileSync')`/
`vi.mock('fs')` runtime-mock guard for this — that shape cannot observe a named
`import { readFileSync } from 'fs'` and passes vacuously even against a script that DOES import the
forbidden module. This is the fourth phase in a row this exact pitfall is worth restating verbatim,
per this repo's own persistent memory on the subject.

## Shared Patterns

### `validateStreamSeries` entry guard + total-function discipline (T-26-01/T-26-02)
**Source:** `src/analytics/pace-derivation.ts:340` (`classifyPairKinds`'s own `t == null || d == null ||
!validateStreamSeries(...)` guard, already closing the folded-todo's specific gap at ITS call site),
`:792` (`derivePaceWithCoverage`'s guard)
**Apply to:** the new running-pace function — it must be TOTAL (never throws on any array-shaped or
`null`-shaped input) and return a zeroed/neutral result (`{ runningPaceSecPerKm: null, excludedM: 0,
excludedSec: 0 }` or similar never-a-plausible-zero shape) rather than a computed zero, mirroring
`zeroCoverage()`'s own discipline. The folded todo's own scope note applies verbatim: only
`pace-derivation.ts:937` (`streamPaceSecPerKm`, D-01's own retirement target) sits in THIS phase's
blast radius per D-11's CONTEXT.md text — the six `pace-quality.ts` sites are out of scope unless the
new function creates a TENTH call site with the same gap (verify at implementation time whether the
new function calls `validateStreamSeries` itself or only ever receives an already-validated
`coverage`/`coveredRuns` pair, in which case no new call site exists at all).

### The all-or-nothing detection-result contract (D-01's "retarget, not restructure")
**Source:** `src/analytics/pace-derivation.ts:980-1002` (`detectPaceDisagreement`, quoted in full
above)
**Apply to:** the retargeted function itself — `null` or a fully-populated result, never partial,
never a zero standing in for "not disputed." The options-override shape (`{ metadataThresholdSecPerKm?,
ratio? }` or its D-02/D-05/D-06/D-07 replacement) stays a caller-overridable options bag, matching
every prior constant-pair override in this file.

### One-computation-per-producer sharing discipline (fold, don't triple-read)
**Source:** `src/analytics/compute-dashboard-index.ts:241-262` (the gated block) +
`:264-290` (the unconditional block it must fold into) — both quoted in full above
**Apply to:** the CI write path — the running pace, the retargeted disagreement check, and the
existing quality-signal computation must all read the SAME `streamForQuality`/`coverage` this file
already resolves once per activity, never a third independently-gated stream read. This is the
single most consequential correctness requirement in the whole phase (RESEARCH.md's own "most
consequential mistake available" framing) — without it, ROADMAP criterion 3 (3475724402 badged) is
unreachable regardless of how the comparator/threshold logic is written.

### Accessible badge + single shared explanation sentence (never let two surfaces disagree)
**Source:** `src/dashboard/views/list.ts:240-259` (`appendAccessibleBadge`), `:307-309`
(`paceDisputedExplanation`), confirmed live, unchanged in shape since Phase 26
**Apply to:** the retargeted badge text at BOTH call sites (`detail.ts`'s stat-card badge, `list.ts`'s
row badge) — both already read `paceDisputedExplanation(disagreement)` for the hover/`.sr-only` text;
only the DETAIL view's own visible-text template (`` `Pace disputed — stream-derived ${...}` `` →
`` `Pace disputed — running ${...}` ``) is a separate string, since the row badge's visible text
(`PACE_DISPUTED_BADGE_TEXT = 'Pace disputed'`) is fixed and unaffected by D-01/D-04.

### Dated in-place amendment, never a silent overwrite
**Source:** Phase 32 D-03/D-14, Phase 33 D-12, Phase 34 D-02 (cited by CONTEXT.md D-04 as binding
precedent; the concrete rendering template is `scripts/compute-pause-classification-calibration.mjs`'s
own "provenance: calibrated (M family, ...)" / "provenance: ... imported, 32-CALIBRATION.md" lines,
quoted above)
**Apply to:** the 5:51/km figure of record (`.planning/milestones/v2.2-REQUIREMENTS.md:62,64`,
`26-07-SUMMARY.md`, `26-07-PLAN.md`) — each citation gets a dated note naming what superseded it
(5:56/km, or whatever D-08's actual computation yields) and why (D-01's comparator retarget), never
a value silently replaced in place.

### Deterministic, content-addressed provenance (never a bare HEAD hash or timestamp)
**Source:** `scripts/compute-pause-classification-calibration.mjs:2227-2235,2308-2313` (`gitId`,
quoted in full above)
**Apply to:** BOTH new scripts this phase adds (`compute-<name>-calibration.mjs` and
`compute-<name>-recount.mjs`) — provenance must name `data/streams`' own git TREE object (content-
addressed, changes only when the archive changes), never `rev-parse HEAD` alone (which would change
on every unrelated commit and break the byte-identical-regeneration requirement — this repo's own
`generated-artifact-head-hash-breaks-idempotence` lesson) and never a wall-clock timestamp.

### The stub-the-detector load-bearing proof, two working templates already in this exact file
**Source:** `src/analytics/pace-single-source.test.ts:889-941` (single-hop) and `:964-` onward
(two-hop, on activity `3475724402` — Phase 35's own named fixture), both quoted in full above
**Apply to:** D-11's own proof — copy the single-hop shape (the new running-pace function sits
directly inside `pace-derivation.ts`, one hop from `unreliable-segments.js`, matching Phase 33's
shape more closely than Phase 34's two-hop one), asserting BOTH directions (real: segments present,
excluded metres/seconds reflect them; stubbed: segments empty, excluded metres/seconds change) in
ONE test, on the SAME activity ROADMAP criterion 3 already names.

## No Analog Found

None. Every mechanism this phase needs — the reusable `coveredRuns` numerator, the retarget-a-
comparator contract, the gated-vs-unconditional stream-read fold, the accessible-badge/shared-
explanation/rebase chain, the HALT-capable calibration pipeline with deterministic provenance, the
zero-import recount, and the stub-the-detector load-bearing proof (on the EXACT named activity this
phase already cites) — has a same-repo, mostly same-file, precedent verified live this session. The
one genuinely open technical question (D-08's Reading A vs. Reading B, per RESEARCH.md) is not a
missing-pattern problem: Reading A's own reusable field (`coveredRuns`) already exists, already
ships, and is already tested — the "no analog" risk RESEARCH.md flags is about which of two
CORRECT-LOOKING arithmetic shapes to choose, not about inventing new machinery from nothing.

## Metadata

**Analog search scope:** `src/analytics/pace-derivation.ts` (full read, offset 1-280 + 560-1002),
`src/analytics/pace-single-source.test.ts` (targeted reads, lines 1-200 + 860-1010), `src/analytics/
compute-dashboard-index.ts` (targeted read, lines 200-330), `src/analytics/dashboard-index.types.ts`
(targeted read, lines 100-180), `src/analytics/pace-quality.ts` (grep pass, `notComputableReason`/
`NOT_COMPUTABLE_*` sites), `src/dashboard/views/detail.ts` (targeted read, lines 640-860),
`src/dashboard/views/detail-sections.ts` (targeted read, lines 240-440 + grep pass for
`coverageCaptionText`/`buildSplitsSection`/`buildPaceBarCell`), `src/dashboard/views/list.ts`
(targeted reads, lines 180-360 + 655-730), `scripts/compute-unreliable-segment-recount.mjs`
(docblock read, lines 1-50), `scripts/compute-pause-classification-calibration.mjs` (grep pass +
targeted reads, lines 1980-2160 + 2210-2340), `.planning/phases/33-.../33-PATTERNS.md` and
`.planning/phases/34-.../34-PATTERNS.md` (full read, both files, for cross-phase precedent
confirmation).
**Files read in full or by targeted, non-overlapping section this session:** listed above; every
line-number citation in this document was independently re-verified against the live tree this
session (not copied from RESEARCH.md's or a prior PATTERNS.md's cache, though every cross-checked
claim in those documents was confirmed accurate).
**Pattern extraction date:** 2026-09-24
