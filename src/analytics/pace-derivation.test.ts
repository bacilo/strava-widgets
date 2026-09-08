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

import { classifyGaps } from './pace-derivation.js';
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
