/**
 * `npm test`-time cross-check that the shipped detector and the independent gap-first recount
 * agree on `3475724402` (Phase 32 plan 08, D-15).
 *
 * This is the ONLY place in the codebase where both sides of the D-15 comparison meet.
 * `scripts/compute-unreliable-segment-recount.mjs` itself stays detector-free — its own
 * zero-import guard (`scripts/compute-unreliable-segment-recount.test.mjs`) proves that by
 * inspecting its stripped source for any spelling of `unreliable-segments`. This file is the
 * deliberate exception: it imports the compiled detector from `../dist/` (so `npm run build`
 * must run first) and the recount's pure helpers, and runs the comparison every `npm test`
 * (the nightly deploy gate) rather than only when a human happens to run the recount script by
 * hand.
 *
 * `classifyGapsThreeWay` is imported here (from `../dist/analytics/pace-derivation.js`) ONLY to
 * prove the precondition below and to build the detector's `gaps` argument — never the four-way
 * `classifyGaps`. **2026-09-21, Phase 33 (D-14, D-15):** `classifyGaps` folded
 * `detectUnreliableSegments` into itself this phase, so `classifyGaps(...).gapIntervals` is now
 * the POST-detector list (3475724402's recording gaps have already been absorbed into
 * `unreliable` intervals). Feeding that list back into the detector here would be circular and
 * would silently diverge this file's own precondition from what `localGapSpans` re-derives —
 * `classifyGapsThreeWay` is the pre-detector list, the ONE shape the detector is ever fed.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectUnreliableSegments, DEFAULT_DETECTOR_PARAMS } from '../dist/analytics/unreliable-segments.js';
import { classifyGaps, classifyGapsThreeWay } from '../dist/analytics/pace-derivation.js';

import { recountGapFirst, localGapSpans } from './compute-unreliable-segment-recount.mjs';

const ACTIVITY_ID = '3475724402';

function readStream(id) {
  const raw = fs.readFileSync(path.join('data', 'streams', `${id}.json`), 'utf-8');
  const doc = JSON.parse(raw);
  return { t: doc.t, d: doc.d };
}

/** Maps one detector `UnreliableSegment` to the recount's own row shape, for a like-for-like comparison. */
function detectorSegmentToRow(seg) {
  return {
    startIndex: seg.startIndex,
    endIndex: seg.endIndex,
    startSec: seg.startSec,
    endSec: seg.endSec,
    seconds: seg.seconds,
    metres: seg.metres,
    gapSeconds: seg.gapSeconds,
    gapMetres: seg.gapMetres,
    burstSeconds: seg.burstSeconds,
    burstMetres: seg.burstMetres,
    gaps: seg.gapCount,
    bursts: seg.burstCount,
    mechanism: seg.mechanism,
  };
}

/**
 * Row-by-row comparison mirroring `evaluateRecount`'s own field discipline (exact on
 * startIndex/endIndex/gaps/bursts, within `1e-6` on the metres/seconds-family fields) — written
 * locally rather than imported, since the plan's own key-link names only `recountGapFirst` and
 * `localGapSpans` as this file's imports from the recount script.
 */
function rowsMatch(a, b) {
  for (const field of ['startIndex', 'endIndex', 'gaps', 'bursts']) {
    if (a[field] !== b[field]) return false;
  }
  for (const field of ['seconds', 'metres', 'gapSeconds', 'gapMetres', 'burstSeconds', 'burstMetres']) {
    if (Math.abs(a[field] - b[field]) > 1e-6) return false;
  }
  return true;
}

function rowSetsMatch(recountRows, otherRows) {
  if (recountRows.length !== otherRows.length) return false;
  for (let i = 0; i < recountRows.length; i++) {
    if (!rowsMatch(recountRows[i], otherRows[i])) return false;
  }
  return true;
}

describe('D-15 cross-check — 3475724402 detector vs independent gap-first recount', () => {
  const { t, d } = readStream(ACTIVITY_ID);

  it('precondition: the recount\'s own local gap spans equal classifyGapsThreeWay(t, d).gapIntervals on this stream (the pre-detector list, Phase 33 D-14/D-15)', () => {
    const localSpans = localGapSpans(t, d).map((g) => ({ startSec: g.startSec, endSec: g.endSec }));
    const classified = classifyGapsThreeWay(t, d).gapIntervals.map((g) => ({
      startSec: g.startSec,
      endSec: g.endSec,
    }));

    expect(localSpans.length).toBeGreaterThan(0); // reachability: this stream must actually have gaps
    expect(localSpans).toEqual(classified);
  });

  it('the recount runs ok and returns a non-vacuous row set', () => {
    const gaps = classifyGapsThreeWay(t, d).gapIntervals;
    const recount = recountGapFirst(t, d, DEFAULT_DETECTOR_PARAMS);

    expect(recount.ok).toBe(true);
    expect(recount.rows.length).toBeGreaterThan(0);

    // Sanity: the detector itself is non-vacuous on the same input, using the same gaps.
    const detectorSegments = detectUnreliableSegments(t, d, gaps, DEFAULT_DETECTOR_PARAMS);
    expect(detectorSegments.length).toBeGreaterThan(0);
  });

  it('agrees with the detector row-by-row (startIndex/endIndex/gaps/bursts exact; metres/seconds fields within 1e-6)', () => {
    const gaps = classifyGapsThreeWay(t, d).gapIntervals;
    const detectorSegments = detectUnreliableSegments(t, d, gaps, DEFAULT_DETECTOR_PARAMS);
    const detectorRows = detectorSegments.map(detectorSegmentToRow);

    const recount = recountGapFirst(t, d, DEFAULT_DETECTOR_PARAMS);
    expect(recount.ok).toBe(true);

    expect(recount.rows).toHaveLength(detectorRows.length);
    for (let i = 0; i < recount.rows.length; i++) {
      const r = recount.rows[i];
      const dRow = detectorRows[i];
      expect(r.startIndex).toBe(dRow.startIndex);
      expect(r.endIndex).toBe(dRow.endIndex);
      expect(r.gaps).toBe(dRow.gaps);
      expect(r.bursts).toBe(dRow.bursts);
      expect(r.seconds).toBeCloseTo(dRow.seconds, 6);
      expect(r.metres).toBeCloseTo(dRow.metres, 6);
      expect(r.gapSeconds).toBeCloseTo(dRow.gapSeconds, 6);
      expect(r.gapMetres).toBeCloseTo(dRow.gapMetres, 6);
      expect(r.burstSeconds).toBeCloseTo(dRow.burstSeconds, 6);
      expect(r.burstMetres).toBeCloseTo(dRow.burstMetres, 6);
      expect(dRow.mechanism).toBe('gap-adjacent');
    }

    expect(rowSetsMatch(recount.rows, detectorRows)).toBe(true);
  });

  it('watched failing: stripping the leading burst off the first gap-adjacent segment that has one makes the comparison fail; the unmodified output still matches', () => {
    const gaps = classifyGapsThreeWay(t, d).gapIntervals;
    const detectorSegments = detectUnreliableSegments(t, d, gaps, DEFAULT_DETECTOR_PARAMS);
    const recount = recountGapFirst(t, d, DEFAULT_DETECTOR_PARAMS);
    expect(recount.ok).toBe(true);

    const leadingIndex = detectorSegments.findIndex((seg) => seg.parts[0]?.kind === 'burst');
    expect(leadingIndex).toBeGreaterThanOrEqual(0); // reachability: at least one leading-burst segment must exist

    const target = detectorSegments[leadingIndex];
    const strippedPart = target.parts[0];

    // Recompute startIndex and burst totals only — a deliberately broken row (Pitfall 4 shape),
    // mirroring compute-unreliable-segment-recount.test.mjs's own watched-failing precedent.
    const brokenRow = {
      ...detectorSegmentToRow(target),
      startIndex: strippedPart.endIndex,
      startSec: strippedPart.endSec,
      metres: target.metres - strippedPart.metres,
      seconds: target.seconds - strippedPart.seconds,
      burstMetres: target.burstMetres - strippedPart.metres,
      burstSeconds: target.burstSeconds - strippedPart.seconds,
      bursts: target.burstCount - 1,
    };

    const brokenRows = detectorSegments.map((seg, i) =>
      i === leadingIndex ? brokenRow : detectorSegmentToRow(seg)
    );

    expect(rowSetsMatch(recount.rows, brokenRows)).toBe(false);

    // The unmodified output still matches — the comparison can both fail and pass, so this is a
    // real discriminator, not a vacuous one.
    const unmodifiedRows = detectorSegments.map(detectorSegmentToRow);
    expect(rowSetsMatch(recount.rows, unmodifiedRows)).toBe(true);
  });

  it('pre-detector vs post-detector gap lists stay distinct on 3475724402 (Phase 33 D-14/D-15 regression pin)', () => {
    // Named so `-t "pre-detector"` selects it: guards against a future regression that swaps
    // classifyGapsThreeWay and classifyGaps at any detector-input call site (this file's own three
    // above, or the three .mjs scripts Task 2 repairs) — the fifth silent-inheritance trap found
    // live during Phase 33 planning.
    const threeWay = classifyGapsThreeWay(t, d).gapIntervals;
    expect(threeWay.length).toBeGreaterThan(0);
    for (const gap of threeWay) {
      expect(['recording-gap', 'pause']).toContain(gap.kind);
    }

    const fourWayCoverage = classifyGaps(t, d);
    const fourWay = fourWayCoverage.gapIntervals;
    expect(fourWay.some((gap) => gap.kind === 'unreliable')).toBe(true);
  });
});
