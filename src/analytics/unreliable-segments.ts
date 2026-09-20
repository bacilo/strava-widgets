/**
 * Standalone unreliable-segment detector over the committed, decimated
 * `{t[], d[]}` stream shape (SEG-01, and the SEG-02/SEG-03 mechanics).
 *
 * Pure, client-safe, Node/CI-only compute module — no `fs`, no `fetch`, no
 * DOM. It is computed from the caller's `t`/`d` arrays plus the caller's own
 * `gaps` argument alone: no lat/lng, no `export_data/`, no other stream
 * field.
 *
 * This is a LEAF module. It imports only `validateStreamSeries`, from
 * `./best-effort-utils.js`. It deliberately does NOT import
 * `pace-derivation.ts` — Phase 33 will make `pace-derivation.ts` import
 * THIS module instead, and gaps arrive here as the `gaps` argument so
 * `classifyGaps` stays the ONE definition of what a gap is. A second gap
 * rule declared inside this file would itself be a second implementation of
 * the thing `pace-single-source.test.ts` exists to catch.
 *
 * Total-function / never-throw discipline (T-26-01): every export here
 * guards its input with `validateStreamSeries` (or, for malformed
 * params/gaps, an equivalent explicit check) first and returns a FRESH empty
 * array on any non-`ok` input — never a shared/mutable module-level
 * constant, and never a thrown exception. This covers both FIELD-level
 * malformation (NaN/Infinity/negative on an otherwise well-shaped input) and
 * SHAPE-level malformation — a non-array `t`/`d`/`gaps`, a non-object entry
 * inside `gaps`, or a null/non-object `params` — the latter being a
 * reachable production input shape, not a theoretical one: the untyped
 * `.mjs` consumers (`compute-unreliable-segment-calibration.mjs`,
 * `validate-unreliable-segments-1hz.mjs`) call this module with
 * `JSON.parse`'d, unvalidated on-disk data, with no TypeScript check at
 * their call sites (32-VERIFICATION.md gap #1, gap closure 32-11).
 *
 * Phases 33 and 36 fold and partition on this module's output (fold a
 * segment's span into `classifyGaps`' strict-priority tree; partition a
 * best-effort window around it) — D-04 requires ONE treatment for every
 * mechanism, so this module deliberately carries no per-mechanism behaviour
 * beyond the label itself.
 */

import { validateStreamSeries } from './best-effort-utils.js';

/**
 * The three mechanisms a segment can be labelled with (D-03, D-08). From
 * `t`/`d` alone, an over-measurement device artefact and a genuine isolated
 * GPS jump are indistinguishable, so there is deliberately NO fourth member
 * — see 32-CONTEXT.md D-03 for the disclosed-in-the-calibration-artifact
 * resolution.
 */
export type SegmentMechanism = 'gap-adjacent' | 'hidden-pause' | 'isolated-jump';

/**
 * One caller-supplied non-covered span, in real sample time. Structurally
 * assignable from `pace-derivation.ts`'s `GapInterval` (which additionally
 * carries a `kind`), but declared as its own interface here — this module
 * does not import `GapInterval` or any other symbol from `pace-derivation.ts`.
 */
export interface GapSpan {
  startSec: number;
  endSec: number;
}

/**
 * Required calibration parameters (D-09, D-08, D-10). `params` is optional on
 * `detectUnreliableSegments`, defaulting to `DEFAULT_DETECTOR_PARAMS` below.
 */
export interface DetectorParams {
  speedLimitMps: number;
  excessFloorMetres: number;
  hiddenPauseMinMetres: number;
}

/**
 * The calibrated speed limit (D-10): `ceil(multiplier x S-A x 100) / 100`, where S-A is the
 * 32-05 Decision's chosen statistic (R-7 p90 across activities of each activity's own R-7 p95
 * folded covered-step speed, 4.404 m/s, n=1873) and the multiplier is measured, not chosen — see
 * `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` section
 * "Chosen constants" for the live-derived value and section "Non-circularity (D-13)" for its
 * insensitivity check.
 *
 * The multiplier is the R-7 percentile (across activities) of each activity's own ratio of its
 * R-7 95th-percentile folded-step speed to its R-7 median folded-step speed — a bulk measure of
 * one activity's own internal pace variability, never a tail percentile of the archive-wide
 * population this detector judges (D-10(b)). The outer cross-activity percentile order is the
 * smallest of a fixed, round candidate list ({0.90, 0.95, 0.97, 0.99}) whose result clears D-13's
 * insensitivity check — mirroring 32-05's own precedent of choosing between candidate statistics
 * by measured insensitivity, never by a flagged count (D-10(e)). An earlier draft applied a bare
 * multiplier of 1 (`ceil(S-A)` alone, 4.41 m/s) — at that limit, ordinary sustained running
 * already carries more absolute excess-metres than the smallest named GPS jump; see this plan's
 * SUMMARY for the full measurement.
 *
 * Ceil-rounded to 0.01 m/s: rounding UP can only ever flag LESS of the archive at the rounded
 * value than the raw product would, never more (the direction-safe rounding `CEILING_K`'s own
 * docblock precedent uses, `best-effort-ceiling.ts`).
 *
 * Phase 27's D-02 anti-quota rule forbids moving this value to change a flagged count —
 * `UNRELIABLE_SPEED_LIMIT_MPS` is fixed by measurement alone and the derivation chain that
 * produces it takes no flagged-count argument, structurally, not by promise.
 */
export const UNRELIABLE_SPEED_LIMIT_MPS = 7.35;

/**
 * The calibrated excess-metres significance floor (D-09): the R-7 10th percentile — the
 * COMPLEMENT of `UNRELIABLE_SPEED_LIMIT_MPS`'s own locked 90th-percentile order (D-10(a)) — of
 * EVERY folded covered step's own metres, pooled archive-wide (never restricted to "fast" steps).
 * See `32-CALIBRATION.md` section "Chosen constants" for the live-derived value and section
 * "Non-circularity (D-13)" for its insensitivity check (0% removedDelta/plantedDelta on the live
 * archive — this population is dominated by ordinary, non-anomalous steps, so it is essentially
 * unmoved by removing or doubling the archive's detected fast bursts).
 *
 * Floor-rounded to 0.1 m in the direction that keeps every must-flag item admitted: DOWN. A floor
 * is an exclusion threshold — every must-flag item's excess must exceed it — so rounding the raw
 * value down can only ever admit MORE of a borderline must-flag item, never less.
 *
 * Phase 27's D-02 anti-quota rule forbids moving this value to change a flagged count —
 * `UNRELIABLE_EXCESS_FLOOR_M`'s derivation takes `L` and the archive alone, structurally
 * incapable of consulting a named item or a flagged count.
 */
export const UNRELIABLE_EXCESS_FLOOR_M = 3;

/**
 * The calibrated hidden-pause vs isolated-jump metres boundary (D-08): searched as a valley in
 * the archive's own distribution of no-gap segment metres, over the anchor interval `[largest
 * named isolated jump's own segment metres, the named hidden-pause item's own segment metres)` at
 * `(UNRELIABLE_SPEED_LIMIT_MPS, UNRELIABLE_EXCESS_FLOOR_M)`. See `32-CALIBRATION.md` section
 * "Hidden-pause vs isolated-jump boundary (D-08)" for the histogram and section "Chosen
 * constants" for the live-derived value.
 *
 * On the live archive **no clean valley exists** in that interval (`valleyFound: false`) — this
 * is reported verbatim, not manufactured (D-08). The value below is the anchor interval's own
 * MIDPOINT, a stated best-effort fallback that is deliberately NOT a percentile of the
 * segment-metres distribution (that shape is this constant's own watched-failing strawman). The
 * `hidden-pause` label this boundary drives is therefore a best-effort description, not a
 * verified cause, whenever a segment lands on this exact fallback value.
 *
 * Phase 27's D-02 anti-quota rule forbids moving this value to change a flagged count.
 */
export const HIDDEN_PAUSE_MIN_METRES = 116.95;

/** The measured default `DetectorParams`, built from the three calibrated constants above.
 * Frozen so a caller cannot mutate the shared default in place. */
export const DEFAULT_DETECTOR_PARAMS: DetectorParams = Object.freeze({
  speedLimitMps: UNRELIABLE_SPEED_LIMIT_MPS,
  excessFloorMetres: UNRELIABLE_EXCESS_FLOOR_M,
  hiddenPauseMinMetres: HIDDEN_PAUSE_MIN_METRES,
});

/**
 * One maximal folded advance step: a run of one or more consecutive covered
 * pairs, starting at `startIndex` and ending at `endIndex`, over which `d`
 * and `t` both genuinely advance (see `advanceSteps`'s docblock for the
 * exact folding rule). `metres`/`seconds` are always endpoint differences —
 * `d[endIndex] - d[startIndex]` and `t[endIndex] - t[startIndex]` — never a
 * per-pair or per-sample count.
 */
export interface AdvanceStep {
  startIndex: number;
  endIndex: number;
  startSec: number;
  endSec: number;
  metres: number;
  seconds: number;
}

/** One itemised burst or gap contribution inside an `UnreliableSegment` (D-15). */
export interface SegmentPart {
  kind: 'burst' | 'gap';
  startIndex: number;
  endIndex: number;
  startSec: number;
  endSec: number;
  metres: number;
  seconds: number;
}

/**
 * One detected unreliable segment: a maximal contiguous chain of bursts and
 * the gaps they touch (D-06, D-07). `metres`/`seconds` are always the
 * chain's own endpoint differences (`d[endIndex] - d[startIndex]`,
 * `t[endIndex] - t[startIndex]`) — conservation requires the itemised
 * `parts` to sum EXACTLY to those totals (`burstMetres + gapMetres ===
 * metres`, `burstSeconds + gapSeconds === seconds`, within floating-point
 * tolerance).
 */
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

/**
 * True iff pair `i` (the segment `[t[i], t[i+1]]`) falls inside some caller
 * gap span — `g.startSec <= t[i] && t[i+1] <= g.endSec`. Every other pair is
 * a covered pair. `gaps` is the caller's own array (typically
 * `classifyGaps(...).gapIntervals`); this function does not recompute or
 * redefine what a gap is.
 */
function isGapPair(t: readonly number[], i: number, gaps: readonly GapSpan[]): boolean {
  const start = t[i];
  const end = t[i + 1];
  for (const g of gaps) {
    if (g.startSec <= start && end <= g.endSec) return true;
  }
  return false;
}

/**
 * Walks covered pairs in order, folding zero-advance and zero-duration
 * pairs forward into the next genuinely-advancing pair, and returns the
 * maximal folded advance steps that result (SEG-01's run-level unit).
 *
 * Algorithm: keeps a pending step start `s` (initially the stream's first
 * sample). For each pair `i` in order:
 *   - If pair `i` is a gap pair (`isGapPair`), any pending (not yet emitted)
 *     step starting at `s` is discarded — `s` resets to `i + 1`. Folding
 *     never crosses a gap, so the first step after a gap starts exactly on
 *     the gap's own end sample.
 *   - Otherwise (a covered pair), the step is emitted as `{ startIndex: s,
 *     endIndex: i + 1, startSec: t[s], endSec: t[i + 1], metres: d[i + 1] -
 *     d[s], seconds: t[i + 1] - t[s] }` ONLY when both `metres > 0` and
 *     `seconds > 0`; then `s` resets to `i + 1` regardless of whether a step
 *     was emitted. A pair that does not clear this bar (a zero-advance or
 *     zero-duration pair) is silently folded into whichever step eventually
 *     does clear it — no step this function returns ever has zero seconds
 *     or zero metres.
 * A pending step still open when the stream ends (or when a gap begins) is
 * dropped — clean non-advancing time never becomes a step.
 *
 * Guarded on entry (T-26-01): a non-array `t`/`d`, a non-array `gaps`, or a
 * non-object entry inside `gaps` returns a fresh empty array before
 * `validateStreamSeries` is ever reached (it dereferences `t.length`, which
 * throws on `null`); any other non-`ok` `validateStreamSeries` result
 * returns a fresh empty array too. Never throws, never a shared/mutable
 * module-level constant (two calls on invalid input return distinct array
 * objects). Reachable from the untyped `.mjs` consumers that parse JSON off
 * disk (32-VERIFICATION.md gap #1, gap closure 32-11).
 */
export function advanceSteps(
  t: readonly number[],
  d: readonly number[],
  gaps: readonly GapSpan[]
): AdvanceStep[] {
  if (!Array.isArray(t) || !Array.isArray(d)) return [];
  if (!gapListIsWellShaped(gaps)) return [];
  if (!validateStreamSeries(t as number[], d as number[]).ok) return [];

  const n = t.length;
  const steps: AdvanceStep[] = [];
  let s = 0;

  for (let i = 0; i < n - 1; i++) {
    if (isGapPair(t, i, gaps)) {
      s = i + 1;
      continue;
    }

    const metres = d[i + 1] - d[s];
    const seconds = t[i + 1] - t[s];
    if (metres > 0 && seconds > 0) {
      steps.push({
        startIndex: s,
        endIndex: i + 1,
        startSec: t[s],
        endSec: t[i + 1],
        metres,
        seconds,
      });
      s = i + 1;
    }
  }

  return steps;
}

// ---------------------------------------------------------------------------
// detectUnreliableSegments — bursts, excess floor, adjacency, chaining
// (SEG-01/SEG-02/SEG-03, D-03, D-04, D-06, D-07, D-08, D-09, D-11)
// ---------------------------------------------------------------------------

/**
 * A step is fast iff its aggregate implied speed exceeds the calibrated
 * limit, tested by cross-multiplying rather than dividing — so there is no
 * divide-by-zero path, matching `advanceSteps`'s own guarantee that every
 * step it emits has a strictly positive `seconds` value. Plan 32-04's
 * single-source audit bans this exact comparison's literal text outside
 * this file; do not vary it (e.g. by reordering operands or introducing a
 * helper that hides the comparison).
 */
function isFastStep(step: AdvanceStep, speedLimitMps: number): boolean {
  const metres = step.metres;
  const seconds = step.seconds;
  return metres > speedLimitMps * seconds;
}

/**
 * A run's (or step's) excess metres beyond what the speed limit would allow
 * over its own elapsed seconds. Plan 32-04's single-source audit bans this
 * literal text outside this file; do not vary it.
 */
function excessMetres(metres: number, seconds: number, speedLimitMps: number): number {
  return metres - speedLimitMps * seconds;
}

/** One maximal contiguous run of fast steps (an internal grouping unit; never exported). */
interface FastRun {
  startIndex: number;
  endIndex: number;
  steps: AdvanceStep[];
}

/**
 * Groups a step list into maximal contiguous runs of fast steps. "Maximal"
 * means: each step's `startIndex` equals the previous step's `endIndex`
 * (contiguous, no clean step or gap pair skipped in between) AND every step
 * in the run is fast. A non-fast step, or a break in contiguity (a clean
 * step or a gap sits between two fast steps), ends the run.
 */
function groupFastRuns(steps: readonly AdvanceStep[], speedLimitMps: number): FastRun[] {
  const runs: FastRun[] = [];
  let current: FastRun | null = null;

  for (const step of steps) {
    const fast = isFastStep(step, speedLimitMps);
    if (fast && current !== null && current.endIndex === step.startIndex) {
      current.steps.push(step);
      current.endIndex = step.endIndex;
    } else if (fast) {
      current = { startIndex: step.startIndex, endIndex: step.endIndex, steps: [step] };
      runs.push(current);
    } else {
      current = null;
    }
  }

  return runs;
}

/** An internal block — either a burst (from a qualifying fast run) or a gap span mapped to sample indices. */
interface Block {
  kind: 'burst' | 'gap';
  startIndex: number;
  endIndex: number;
  startSec: number;
  endSec: number;
  metres: number;
  seconds: number;
}

/**
 * True iff `gaps` is SHAPE-well-formed: an array whose every entry is a
 * non-null object. This checks SHAPE only — field values (`NaN` bounds,
 * `endSec <= startSec`, bounds matching no sample) stay `mapGapToIndices`'s
 * job, so the existing field-level fail-closed behaviour is unchanged. A
 * non-array `gaps`, or an array containing `null`/`undefined`/a primitive,
 * fails this check and lets the caller return a fresh `[]` before any
 * iteration or dereference (32-VERIFICATION.md gap #1, gap closure 32-11).
 */
function gapListIsWellShaped(gaps: unknown): gaps is readonly GapSpan[] {
  return Array.isArray(gaps) && gaps.every((g) => g !== null && typeof g === 'object');
}

/**
 * Maps a gap span to sample indices `[gi, gj]`: `gi` is the LAST index with
 * `t[gi] === span.startSec`, `gj` is the FIRST index with `t[gj] ===
 * span.endSec`. Returns `null` if `span` is not a non-null object, its
 * bounds are non-finite, `endSec <= startSec`, or either bound matches no
 * sample time (a malformed gap span) — callers fail closed on `null` rather
 * than guessing.
 */
function mapGapToIndices(
  t: readonly number[],
  span: GapSpan
): { startIndex: number; endIndex: number } | null {
  if (span === null || typeof span !== 'object') return null;
  if (
    !Number.isFinite(span.startSec) ||
    !Number.isFinite(span.endSec) ||
    !(span.endSec > span.startSec)
  ) {
    return null;
  }

  let gi = -1;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === span.startSec) gi = i;
  }
  if (gi === -1) return null;

  let gj = -1;
  for (let j = 0; j < t.length; j++) {
    if (t[j] === span.endSec) {
      gj = j;
      break;
    }
  }
  if (gj === -1) return null;

  return { startIndex: gi, endIndex: gj };
}

/**
 * True iff `params` is a non-null object whose every finite-required field
 * is present, finite, and within the required range. A `null`/non-object
 * `params` (e.g. a `.mjs` consumer's `JSON.parse`'d value) fails closed here
 * rather than throwing on the destructure below (32-VERIFICATION.md gap #1,
 * gap closure 32-11).
 */
function paramsAreValid(params: DetectorParams): boolean {
  if (params === null || typeof params !== 'object') return false;
  const { speedLimitMps, excessFloorMetres, hiddenPauseMinMetres } = params;
  if (!Number.isFinite(speedLimitMps) || !(speedLimitMps > 0)) return false;
  if (!Number.isFinite(excessFloorMetres) || excessFloorMetres < 0) return false;
  if (!Number.isFinite(hiddenPauseMinMetres) || hiddenPauseMinMetres < 0) return false;
  return true;
}

/**
 * Detects unreliable segments: maximal advancing runs whose aggregate
 * implied speed exceeds `params.speedLimitMps` and whose aggregate excess
 * distance exceeds `params.excessFloorMetres` (a "burst", D-09), merged with
 * any gap span it TOUCHES (D-06: `burst.endIndex === gap.startIndex` or
 * `burst.startIndex === gap.endIndex`, no tolerance), and chained with
 * further touching bursts/gaps into one segment (D-07). A gap block that
 * touches no burst yields nothing — it stays a plain gap for Phase 33 to
 * classify.
 *
 * Each returned segment's `mechanism` is `'gap-adjacent'` whenever it
 * contains at least one gap; otherwise `'hidden-pause'` if its total metres
 * is at or above `params.hiddenPauseMinMetres`, else `'isolated-jump'`
 * (D-03, D-08). No per-mechanism behaviour beyond this label — D-04 — and no
 * decimation or run-length exemption of any kind — D-11.
 *
 * `params` is optional, defaulting to `DEFAULT_DETECTOR_PARAMS` (the calibrated constants above)
 * — existing explicit-params callers are unaffected.
 *
 * Guarded on entry (T-26-01): returns a fresh `[]` and never throws when `t`
 * or `d` is not an array, when `gaps` is not an array or contains a
 * non-object entry, when `validateStreamSeries(t, d)` is not `ok`, when
 * `params` is null/non-object or carries a non-finite or out-of-range value,
 * or when any gap span is malformed (fails `mapGapToIndices`). Failing
 * closed on a malformed gap beats emitting segments against a misread gap.
 * The shape-level cases (non-array `t`/`d`/`gaps`, a non-object `gaps`
 * entry, a null/non-object `params`) are reachable from the untyped `.mjs`
 * consumers that parse JSON off disk (32-VERIFICATION.md gap #1, gap closure
 * 32-11).
 */
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

  const gapBlocks: Block[] = [];
  for (const span of gaps) {
    const mapped = mapGapToIndices(t, span);
    if (mapped === null) return [];
    gapBlocks.push({
      kind: 'gap',
      startIndex: mapped.startIndex,
      endIndex: mapped.endIndex,
      startSec: t[mapped.startIndex],
      endSec: t[mapped.endIndex],
      metres: d[mapped.endIndex] - d[mapped.startIndex],
      seconds: t[mapped.endIndex] - t[mapped.startIndex],
    });
  }

  const steps = advanceSteps(t, d, gaps);
  const fastRuns = groupFastRuns(steps, params.speedLimitMps);

  const burstBlocks: Block[] = [];
  for (const run of fastRuns) {
    const metres = d[run.endIndex] - d[run.startIndex];
    const seconds = t[run.endIndex] - t[run.startIndex];
    const excess = excessMetres(metres, seconds, params.speedLimitMps);
    if (excess > params.excessFloorMetres) {
      burstBlocks.push({
        kind: 'burst',
        startIndex: run.startIndex,
        endIndex: run.endIndex,
        startSec: t[run.startIndex],
        endSec: t[run.endIndex],
        metres,
        seconds,
      });
    }
  }

  const blocks = [...burstBlocks, ...gapBlocks].sort((a, b) => a.startIndex - b.startIndex);

  const segments: UnreliableSegment[] = [];
  let i = 0;
  while (i < blocks.length) {
    let j = i;
    while (j + 1 < blocks.length && blocks[j + 1].startIndex === blocks[j].endIndex) j++;

    const chain = blocks.slice(i, j + 1);
    const hasBurst = chain.some((b) => b.kind === 'burst');
    const hasGap = chain.some((b) => b.kind === 'gap');

    if (hasBurst && hasGap) {
      const startIndex = chain[0].startIndex;
      const endIndex = chain[chain.length - 1].endIndex;
      const metres = d[endIndex] - d[startIndex];
      const seconds = t[endIndex] - t[startIndex];

      const parts: SegmentPart[] = chain.map((b) => ({
        kind: b.kind,
        startIndex: b.startIndex,
        endIndex: b.endIndex,
        startSec: b.startSec,
        endSec: b.endSec,
        metres: b.metres,
        seconds: b.seconds,
      }));

      let burstMetres = 0;
      let burstSeconds = 0;
      let gapMetres = 0;
      let gapSeconds = 0;
      let burstCount = 0;
      let gapCount = 0;
      for (const part of parts) {
        if (part.kind === 'burst') {
          burstMetres += part.metres;
          burstSeconds += part.seconds;
          burstCount++;
        } else {
          gapMetres += part.metres;
          gapSeconds += part.seconds;
          gapCount++;
        }
      }

      const mechanism: SegmentMechanism =
        gapCount > 0
          ? 'gap-adjacent'
          : metres >= params.hiddenPauseMinMetres
            ? 'hidden-pause'
            : 'isolated-jump';

      segments.push({
        startIndex,
        endIndex,
        startSec: t[startIndex],
        endSec: t[endIndex],
        metres,
        seconds,
        mechanism,
        burstMetres,
        burstSeconds,
        gapMetres,
        gapSeconds,
        burstCount,
        gapCount,
        parts,
      });
    } else if (hasBurst) {
      // A burst chain touching no gap — still a segment (isolated-jump or
      // hidden-pause per D-08), just with gapCount 0.
      const startIndex = chain[0].startIndex;
      const endIndex = chain[chain.length - 1].endIndex;
      const metres = d[endIndex] - d[startIndex];
      const seconds = t[endIndex] - t[startIndex];

      const parts: SegmentPart[] = chain.map((b) => ({
        kind: b.kind,
        startIndex: b.startIndex,
        endIndex: b.endIndex,
        startSec: b.startSec,
        endSec: b.endSec,
        metres: b.metres,
        seconds: b.seconds,
      }));

      let burstMetres = 0;
      let burstSeconds = 0;
      let burstCount = 0;
      for (const part of parts) {
        burstMetres += part.metres;
        burstSeconds += part.seconds;
        burstCount++;
      }

      const mechanism: SegmentMechanism =
        metres >= params.hiddenPauseMinMetres ? 'hidden-pause' : 'isolated-jump';

      segments.push({
        startIndex,
        endIndex,
        startSec: t[startIndex],
        endSec: t[endIndex],
        metres,
        seconds,
        mechanism,
        burstMetres,
        burstSeconds,
        gapMetres: 0,
        gapSeconds: 0,
        burstCount,
        gapCount: 0,
        parts,
      });
    }
    // A gap-only chain (no burst) touches nothing — yields nothing.

    i = j + 1;
  }

  return segments;
}
