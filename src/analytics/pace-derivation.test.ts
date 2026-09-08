/**
 * Coverage exact-sum invariant plus demonstrated-failing negative cases for
 * `pace-derivation.ts`'s classification half (COV-01, D-05, D-07).
 *
 * The numeric expectations below were measured against the committed
 * archive on 2026-09-08 (re-verify, do not trust blindly — the archive
 * grows nightly) — see `26-RESEARCH.md` and `26-01-PLAN.md`'s `<interfaces>`
 * block for the source measurements. Changing an expectation to make a test
 * pass is a correctness regression in the derivation, not a fix to this
 * file, per `best-effort-fixtures.test.ts`'s established discipline.
 *
 * This suite reads the REAL committed archive (`data/streams/<id>.json`)
 * directly via `node:fs` — it never reads the derived, gitignored
 * stats-output directory, which is absent on a fresh clone.
 *
 * Order of work matters (D-05, D-07 are demonstrated-failing requirements,
 * not a write-tests-after exercise): `brokenCoverageFromDdSkip` and the
 * absolute-pause-rule case were run and observed failing against the real
 * archive BEFORE `classifyGaps`'s positive invariants were written. Observed
 * during that run:
 *   - `spanSec - brokenCoverageFromDdSkip(t, d)` on activity 4556693525
 *     was 964 s (28.4% of the stream's 3,394 s span) — matching
 *     26-RESEARCH.md's measured 964 s / 28% figure.
 *   - `pauseSec / spanSec` on activity 5059204779 under the absolute
 *     30-second pause rule was 0.9686 (96.86%) — matching the measured
 *     0.969 figure, despite that stream's maximum `Δt` being only 7 s.
 *   - The same stream under the default scale-relative rule (K=5) measured
 *     `pauseSec / spanSec === 0` — well under the 0.02 ceiling.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  classifyGaps,
  derivePaceWithCoverage,
  derivePaceSeriesGapAware,
  adaptiveWindowSec,
  paceHistogramSamples,
  detectPaceDisagreement,
} from './pace-derivation.js';
import {
  syntheticRecordingGapStream,
  syntheticIntervalSessionStream,
  syntheticStandstillStream,
  makeStream,
} from './pace-fixtures.js';
import type { CanonicalStream } from '../streams/stream.types.js';

/** Reads a committed stream file from `data/streams/` — never the derived stats output. */
function readStream(activityId: string): CanonicalStream {
  return JSON.parse(
    fs.readFileSync(path.join('data/streams', `${activityId}.json`), 'utf-8')
  ) as CanonicalStream;
}

/**
 * Replicates `detail-zones.ts`'s `computePaceDistribution` accounting
 * verbatim (the located defect `classifyGaps` replaces): loops consecutive
 * segments, skips any segment whose `Δt` or `Δd` is non-positive, and sums
 * only the `Δt` of segments that survive the skip. This is deliberately the
 * BROKEN accounting — a permanent in-suite reminder of what COV-01 fixes.
 */
function brokenCoverageFromDdSkip(t: readonly number[], d: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < t.length - 1; i++) {
    const dt = t[i + 1] - t[i];
    const dd = d[i + 1] - d[i];
    if (dt <= 0 || dd <= 0) continue;
    total += dt;
  }
  return total;
}

/**
 * Builds a synthetic multi-category stream with a hand-derived expected
 * split: 200 s of dense (2 s) advancing samples (covered), one 300 s
 * segment with no samples across it (recording gap), 400 s of dense (2 s)
 * flat-distance samples (pause), then another 200 s of dense advancing
 * samples (covered). Hand-derived expectation: covered=400, recordingGap=300,
 * pause=400, span=1100, sum=1100.
 */
function buildSyntheticMultiCategoryFixture(): { t: number[]; d: number[] } {
  const t: number[] = [];
  const d: number[] = [];
  let time = 0;
  let dist = 0;

  // Phase 1: dense 2 s sampling, advancing distance, 200 s (100 steps).
  t.push(time);
  d.push(dist);
  for (let i = 0; i < 100; i++) {
    time += 2;
    dist += 10;
    t.push(time);
    d.push(dist);
  }
  // time = 200, dist = 1000

  // Phase 2: one 300 s segment with no samples across it (recording gap).
  time += 300;
  t.push(time);
  d.push(dist); // distance does not advance across the gap
  // time = 500

  // Phase 3: dense 2 s sampling, flat distance, 400 s (200 steps).
  for (let i = 0; i < 200; i++) {
    time += 2;
    t.push(time);
    d.push(dist); // flat
  }
  // time = 900

  // Phase 4: dense 2 s sampling, advancing distance, 200 s (100 steps).
  for (let i = 0; i < 100; i++) {
    time += 2;
    dist += 10;
    t.push(time);
    d.push(dist);
  }
  // time = 1100

  return { t, d };
}

describe('classifyGaps — coverage sums exactly and pins the two negative cases', () => {
  it('negative case 5: brokenCoverageFromDdSkip on real 4556693525 leaves 900-1000 s unaccounted (the shipped defect)', () => {
    const stream = readStream('4556693525');
    const spanSec = stream.t[stream.t.length - 1] - stream.t[0];
    const broken = brokenCoverageFromDdSkip(stream.t, stream.d);
    const shortfall = spanSec - broken;
    // Two-sided band, per the plan: this assertion must be able to fail in
    // both directions, not just a one-sided `>` check. Measured: 964 s (28%).
    expect(shortfall).toBeGreaterThan(900);
    expect(shortfall).toBeLessThan(1000);
  });

  it('positive: classifyGaps on real 4556693525 sums exactly to spanSec (coverage sums)', () => {
    const stream = readStream('4556693525');
    const spanSec = stream.t[stream.t.length - 1] - stream.t[0];
    const coverage = classifyGaps(stream.t, stream.d);
    expect(coverage.spanSec).toBe(spanSec);
    expect(coverage.coveredSec + coverage.recordingGapSec + coverage.pauseSec).toBe(spanSec);
  });

  it('negative case 2: an absolute 30s pause rule misclassifies >90% of real 5059204779 as paused despite a 7s max Δt', () => {
    const stream = readStream('5059204779');
    // This stream's maximum Δt is 7 s (26-RESEARCH.md, re-confirmed at
    // planning time) — there is no recording gap here to explain a large
    // paused fraction. Any large pause fraction under the absolute rule is
    // pure misclassification of scale-relative flat runs (D-05).
    const coverage = classifyGaps(stream.t, stream.d, {
      pauseRule: { kind: 'absolute', thresholdSec: 30 },
    });
    expect(coverage.pauseSec / coverage.spanSec).toBeGreaterThan(0.9);
  });

  it('positive: the default scale-relative pause rule classifies real 5059204779 as <2% paused', () => {
    const stream = readStream('5059204779');
    const coverage = classifyGaps(stream.t, stream.d);
    expect(coverage.pauseSec / coverage.spanSec).toBeLessThan(0.02);
  });

  it('the exact-sum identity holds on real 11544429866 (35.4h recording gap) and recordingGapSec exceeds 120,000 s', () => {
    const stream = readStream('11544429866');
    const spanSec = stream.t[stream.t.length - 1] - stream.t[0];
    const coverage = classifyGaps(stream.t, stream.d);
    expect(coverage.coveredSec + coverage.recordingGapSec + coverage.pauseSec).toBe(spanSec);
    expect(coverage.recordingGapSec).toBeGreaterThan(120000);
  });

  it('classifies a hand-derived synthetic multi-category fixture exactly', () => {
    const { t, d } = buildSyntheticMultiCategoryFixture();
    const coverage = classifyGaps(t, d);
    expect(coverage.spanSec).toBe(1100);
    expect(coverage.coveredSec).toBe(400);
    expect(coverage.recordingGapSec).toBe(300);
    expect(coverage.pauseSec).toBe(400);
    expect(coverage.coveredSec + coverage.recordingGapSec + coverage.pauseSec).toBe(
      coverage.spanSec
    );
  });

  describe('totality — never throws, always returns the zeroed result on malformed input', () => {
    it('returns zeroed result on length mismatch', () => {
      expect(() => classifyGaps([0, 1, 2], [0, 1])).not.toThrow();
      const coverage = classifyGaps([0, 1, 2], [0, 1]);
      expect(coverage).toEqual({
        spanSec: 0,
        coveredSec: 0,
        recordingGapSec: 0,
        pauseSec: 0,
        gapIntervals: [],
      });
    });

    it('returns zeroed result on empty arrays', () => {
      expect(() => classifyGaps([], [])).not.toThrow();
      const coverage = classifyGaps([], []);
      expect(coverage.spanSec).toBe(0);
      expect(coverage.gapIntervals).toEqual([]);
    });

    it('returns zeroed result on a single sample', () => {
      expect(() => classifyGaps([0], [0])).not.toThrow();
      const coverage = classifyGaps([0], [0]);
      expect(coverage.spanSec).toBe(0);
    });

    it('returns zeroed result on an array containing NaN', () => {
      expect(() => classifyGaps([0, NaN, 2], [0, 5, 10])).not.toThrow();
      const coverage = classifyGaps([0, NaN, 2], [0, 5, 10]);
      expect(coverage.spanSec).toBe(0);
      expect(coverage.gapIntervals).toEqual([]);
    });
  });
});

/**
 * `detectPaceDisagreement`'s totality guarantee (PACE-07, T-26-01), pinned
 * alongside `classifyGaps`' own totality block above so every never-throwing
 * guarantee for this module lives together. Positive/negative-case coverage
 * of the actual disagreement (activity 5059204779, negative case 7 with the
 * threshold disabled) lives in `compute-dashboard-index.test.ts`'s
 * `describe('pace disagreement', ...)` block, alongside the archive-wide
 * over-fire sweep it shares fixtures with.
 */
describe('detectPaceDisagreement — totality, never throws, always null on malformed input', () => {
  it('returns null on a malformed stream (t/d length mismatch)', () => {
    const badStream = makeStream({ t: [0, 10, 20], d: [0, 100] });
    expect(() => detectPaceDisagreement(100, badStream)).not.toThrow();
    expect(detectPaceDisagreement(100, badStream)).toBeNull();
  });

  it('returns null when metadataPaceSecPerKm is null', () => {
    const stream = makeStream({ t: [0, 10, 20], d: [0, 50, 100] });
    expect(() => detectPaceDisagreement(null, stream)).not.toThrow();
    expect(detectPaceDisagreement(null, stream)).toBeNull();
  });

  it('returns null on a zero-distance stream (d never advances)', () => {
    const stream = makeStream({ t: [0, 10, 20], d: [0, 0, 0] });
    expect(() => detectPaceDisagreement(100, stream)).not.toThrow();
    expect(detectPaceDisagreement(100, stream)).toBeNull();
  });
});

/**
 * The adaptive window, gap-clipping, and D-16 single-entry-point half of
 * this module (PACE-02, PACE-03, D-01, D-02, D-16). Every fast-mass/coverage
 * figure below was measured against the committed archive on 2026-09-08
 * (re-verify, do not trust blindly — the archive grows nightly) via this
 * suite's own `fastMassAndCoverage` helper, which is deliberately the SAME
 * weighting `computePaceDistribution` uses (`detail-zones.ts`'s
 * `bucketTimeSec.set(index, existing + dt)`), reproduced here through
 * `paceHistogramSamples`.
 *
 * "Coverage" in this suite means the fraction of the stream's own span that
 * a WINDOWED pace estimate actually resolved to a non-null value — this is
 * distinct from `PaceCoverage.coveredSec / spanSec` (which is independent
 * of `windowSec` entirely, since `classifyGaps` never sees the averaging
 * window). PACE-03's central finding is that a narrow fixed window starves
 * itself of enough distance-advance to resolve most indices at all — the
 * fixed-20s "coverage" figures below measure exactly that starvation.
 *
 * Order of work matters (demonstrated-failing, not write-tests-after): the
 * fixed-20s case on real 5059204779 was run and observed failing (fast mass
 * > 90%, coverage < 35%) BEFORE the adaptive recovery assertion was written
 * or trusted.
 */
describe('derivePaceWithCoverage — adaptive window, gap clipping, D-16 entry point', () => {
  /**
   * Δt-weighted fast mass (faster than 180 sec/km) and covered fraction
   * (fraction of the stream's own span that resolved to a non-null pace),
   * both derived from `paceHistogramSamples` so one weighting definition
   * governs every profile assertion below.
   */
  function fastMassAndCoverage(
    result: ReturnType<typeof derivePaceWithCoverage>,
    t: readonly number[]
  ): { fastMass: number; coveredFraction: number } {
    const samples = paceHistogramSamples(t, result.paceSeries);
    let totalT = 0;
    let fastT = 0;
    for (const s of samples) {
      totalT += s.timeSec;
      if (s.paceSecPerKm < 180) fastT += s.timeSec;
    }
    const fastMass = totalT > 0 ? fastT / totalT : 0;
    const coveredFraction = totalT / result.coverage.spanSec;
    return { fastMass, coveredFraction };
  }

  function readArchiveStream(activityId: string): CanonicalStream {
    return JSON.parse(
      fs.readFileSync(path.join('data/streams', `${activityId}.json`), 'utf-8')
    ) as CanonicalStream;
  }

  it('negative case 1: a fixed 20s window on real 5059204779 manufactures a data defect (fast mass > 90%, coverage < 35%)', () => {
    const stream = readArchiveStream('5059204779');
    const result = derivePaceWithCoverage(stream, { windowSec: 20 });
    const { fastMass, coveredFraction } = fastMassAndCoverage(result, stream.t);
    // Two-sided band (measured 94.80% / 30.4%) — must be able to fail in
    // both directions, not just cross a one-sided threshold.
    expect(fastMass).toBeGreaterThan(0.9);
    expect(coveredFraction).toBeLessThan(0.35);
  });

  it('positive: the default adaptive window recovers real 5059204779 (fast mass < 3%, coverage > 95%)', () => {
    const stream = readArchiveStream('5059204779');
    const result = derivePaceWithCoverage(stream);
    const { fastMass, coveredFraction } = fastMassAndCoverage(result, stream.t);
    // Measured 1.17% / 97.1%.
    expect(fastMass).toBeLessThan(0.03);
    expect(coveredFraction).toBeGreaterThan(0.95);
  });

  describe('adaptive window ("adaptive window" — all four measured interval profiles)', () => {
    it('5059204779: within ±8s of 150s (p90 advance interval 60s, floor not engaged)', () => {
      const stream = readArchiveStream('5059204779');
      const w = adaptiveWindowSec(stream.t, stream.d);
      expect(w).toBeGreaterThan(142);
      expect(w).toBeLessThan(158);
    });

    it('3647739864: within [200s, 240s] (p90 advance interval ~88.4s) — 26-RESEARCH.md Open Question 1 records ~4% methodology variance against the roadmap-cited ~230s as expected, not a defect', () => {
      const stream = readArchiveStream('3647739864');
      const w = adaptiveWindowSec(stream.t, stream.d);
      expect(w).toBeGreaterThanOrEqual(200);
      expect(w).toBeLessThanOrEqual(240);
    });

    it('4598855187: within ±12s of 247.5s (p90 advance interval 99s)', () => {
      const stream = readArchiveStream('4598855187');
      const w = adaptiveWindowSec(stream.t, stream.d);
      expect(w).toBeGreaterThan(235.5);
      expect(w).toBeLessThan(259.5);
    });

    it('4556693525: exactly 20s — the floor is load-bearing (D-03), asserted with toBe, not a band', () => {
      const stream = readArchiveStream('4556693525');
      const w = adaptiveWindowSec(stream.t, stream.d);
      expect(w).toBe(20);
    });
  });

  it('3647739864 recovers to fast mass < 2% and coverage > 98% under the adaptive window', () => {
    const stream = readArchiveStream('3647739864');
    const result = derivePaceWithCoverage(stream);
    const { fastMass, coveredFraction } = fastMassAndCoverage(result, stream.t);
    // Measured 0.62% / 100.0%.
    expect(fastMass).toBeLessThan(0.02);
    expect(coveredFraction).toBeGreaterThan(0.98);
  });

  it('4598855187 recovers to fast mass < 2% and coverage > 98% under the adaptive window', () => {
    const stream = readArchiveStream('4598855187');
    const result = derivePaceWithCoverage(stream);
    const { fastMass, coveredFraction } = fastMassAndCoverage(result, stream.t);
    // Measured 0.00% / 100.0%.
    expect(fastMass).toBeLessThan(0.02);
    expect(coveredFraction).toBeGreaterThan(0.98);
  });

  describe('gap boundary — negative case 3: an unclipped window bridges a recording gap', () => {
    it('with clipAtGaps: false, the sample immediately before the 300s gap yields a non-null pace whose window demonstrably spans the gap', () => {
      const stream = syntheticRecordingGapStream();
      const coverage = classifyGaps(stream.t, stream.d);
      expect(coverage.gapIntervals).toEqual([{ startSec: 200, endSec: 500, kind: 'recording-gap' }]);

      const preGapIndex = stream.t.indexOf(200);
      expect(preGapIndex).toBeGreaterThan(-1);

      const unclipped = derivePaceSeriesGapAware(stream.t, stream.d, {
        windowSec: 40,
        gapIntervals: coverage.gapIntervals,
        clipAtGaps: false,
      });
      // Unclipped: the window [180, 220] crosses 20s into the recording
      // gap; interpolating distance across the flat gap boundary dilutes
      // the pace to 666.67 sec/km (measured) — a fictional value, since no
      // sample exists between t=200 and t=500 to justify it.
      expect(unclipped[preGapIndex]).not.toBeNull();
      expect(unclipped[preGapIndex]).toBeGreaterThan(500);
    });

    it('with clipAtGaps true (the default), the window clips at the gap boundary and matches the pre-gap segment computed alone within 1 sec/km', () => {
      const stream = syntheticRecordingGapStream();
      const coverage = classifyGaps(stream.t, stream.d);
      const preGapIndex = stream.t.indexOf(200);

      const clipped = derivePaceSeriesGapAware(stream.t, stream.d, {
        windowSec: 40,
        gapIntervals: coverage.gapIntervals,
        clipAtGaps: true,
      });

      const preGapT = stream.t.slice(0, preGapIndex + 1);
      const preGapD = stream.d.slice(0, preGapIndex + 1);
      const preGapAlone = derivePaceSeriesGapAware(preGapT, preGapD, {
        windowSec: 40,
        gapIntervals: [],
        clipAtGaps: true,
      });

      const clippedPace = clipped[preGapIndex];
      const aloneP = preGapAlone[preGapAlone.length - 1];
      expect(clippedPace).not.toBeNull();
      expect(aloneP).not.toBeNull();
      expect(Math.abs((clippedPace as number) - (aloneP as number))).toBeLessThan(1);

      // No sample in this fixture falls strictly inside the recording gap
      // (200, 500) — a recording gap is, by definition, a span with no
      // samples recorded across it — so there is no index to assert `null`
      // against here; the "samples inside a gap are null" contract is
      // exercised by the interior-sampled `pause` case in
      // `derivePaceSeriesGapAware`'s own doc comment and by
      // `syntheticMultiHourPauseStream`-shaped fixtures used elsewhere.
      const interiorIndices = stream.t.filter((time) => time > 200 && time < 500);
      expect(interiorIndices).toEqual([]);
    });
  });

  it("criterion 5: the adaptive smoothed series resolves the interval session's own fast/slow segment paces within ±20 sec/km", () => {
    const stream = syntheticIntervalSessionStream();
    const result = derivePaceWithCoverage(stream);

    // Index 20 (t=40s) sits well inside the first fast rep (t 0..84s,
    // 210 sec/km); index 60 (t=120s) sits well inside the first slow rep
    // (t 86..164s, 390 sec/km) — see the fixture's own doc comment.
    const fastPace = result.paceSeries[20];
    const slowPace = result.paceSeries[60];

    expect(fastPace).not.toBeNull();
    expect(slowPace).not.toBeNull();
    expect(Math.abs((fastPace as number) - 210)).toBeLessThan(20);
    expect(Math.abs((slowPace as number) - 390)).toBeLessThan(20);
  });

  it('null, never 0: a standstill stream produces an all-null series and never a 0 or Infinity entry', () => {
    const stream = syntheticStandstillStream();
    const result = derivePaceWithCoverage(stream);

    expect(result.paceSeries.length).toBeGreaterThan(0);
    for (const pace of result.paceSeries) {
      expect(pace).toBeNull();
    }
    expect(result.paceSeries.some((p) => p === 0)).toBe(false);
    expect(result.paceSeries.some((p) => p === Infinity)).toBe(false);
  });
});
