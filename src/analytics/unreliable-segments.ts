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
 * constant, and never a thrown exception.
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
 * Required calibration parameters (D-09, D-08, D-10). The calibrated
 * constants do not exist yet — plan 32-06 derives them from the archive and
 * only then makes this parameter optional with a measured default. This
 * plan does NOT invent interim values: any number in this module would be
 * an unmeasured literal.
 */
export interface DetectorParams {
  speedLimitMps: number;
  excessFloorMetres: number;
  hiddenPauseMinMetres: number;
}

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
 * Guarded by `validateStreamSeries` on entry (T-26-01): any non-`ok` input
 * returns a fresh empty array — never throws, never a shared/mutable
 * module-level constant (two calls on invalid input return distinct array
 * objects).
 */
export function advanceSteps(
  t: readonly number[],
  d: readonly number[],
  gaps: readonly GapSpan[]
): AdvanceStep[] {
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
