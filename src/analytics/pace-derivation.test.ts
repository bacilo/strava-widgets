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
  classifyGapsThreeWay,
  classifyGapsWithSegments,
  derivePaceWithCoverage,
  derivePaceSeriesGapAware,
  adaptiveWindowSec,
  paceHistogramSamples,
  paceHistogramAccounting,
  detectPaceDisagreement,
  PACE_DISAGREEMENT_RUNNING_RATIO,
  deriveRunningPace,
  NOT_COMPUTABLE_NO_COVERED_DISTANCE,
  UNRELIABLE_SPEED_LIMIT_MPS as UNRELIABLE_SPEED_LIMIT_MPS_VIA_PACE_DERIVATION,
} from './pace-derivation.js';
import type { UnreliableSegment, SegmentMechanism, RunningPace } from './pace-derivation.js';
import {
  detectUnreliableSegments,
  DEFAULT_DETECTOR_PARAMS,
  UNRELIABLE_SPEED_LIMIT_MPS as UNRELIABLE_SPEED_LIMIT_MPS_VIA_DETECTOR,
} from './unreliable-segments.js';
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
 * Builds a hand-specified `RunningPace` fixture for `detectPaceDisagreement`'s
 * SYNTHETIC totality/behaviour suite (35-08, RPACE-03) — deliberately
 * independent of `deriveRunningPace`, so every expectation below is a fact
 * about the comparator, not a fact about the derivation. Defaults describe a
 * plainly computable, plainly eligible (D-02: `excludedM > 0`) running pace;
 * every case overrides exactly the fields its own name says it varies.
 */
function makeRunningPace(overrides: Partial<RunningPace> = {}): RunningPace {
  return {
    computable: true,
    notComputableReason: null,
    runningPaceSecPerKm: 300,
    coveredM: 1000,
    coveredSec: 300,
    excludedM: 10,
    excludedSec: 5,
    ...overrides,
  };
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

  it('positive: classifyGaps on real 4556693525 sums exactly to spanSec (coverage sums, widened to the four-way identity by Phase 33 D-01/D-02)', () => {
    const stream = readStream('4556693525');
    const spanSec = stream.t[stream.t.length - 1] - stream.t[0];
    const coverage = classifyGaps(stream.t, stream.d);
    expect(coverage.spanSec).toBe(spanSec);
    // Phase 33: this stream now carries a detected unreliable segment
    // (measured unreliableSec 32 of 3394 s), so the pre-Phase-33 three-term
    // sum no longer equals spanSec on its own — the fourth term is required.
    expect(
      coverage.coveredSec + coverage.recordingGapSec + coverage.pauseSec + coverage.unreliableSec
    ).toBe(spanSec);
  });

  it('negative case 2: an absolute 30s pause rule misclassifies real 5059204779 (Phase 33: the detector now swallows the whole misclassified span as unreliable, not pause)', () => {
    const stream = readStream('5059204779');
    // This stream's maximum Δt is 7 s (26-RESEARCH.md, re-confirmed at
    // planning time) — there is no recording gap here to explain a large
    // paused fraction. The absolute rule's D-05 misclassification is still
    // real, but its OWN pre-detector gap list — the exact garbage this rule
    // produces — is what `classifyGaps` now feeds `detectUnreliableSegments`
    // (D-14: the detector runs on whatever pauseRule the caller passed).
    // Measured 2026-09-21: the ENTIRE span (3788 of 3788 s) is swallowed as
    // one 'unreliable' segment, not 'pause' — 'unreliable' outranks 'pause'
    // in the priority tree (D-01), so the OLD claim ("misclassified as
    // paused") is no longer literally true, but the underlying defect (the
    // absolute rule feeding a degenerate gap list) is demonstrated even more
    // starkly: pauseSec collapses to exactly 0 and unreliableSec absorbs the
    // whole activity.
    const coverage = classifyGaps(stream.t, stream.d, {
      pauseRule: { kind: 'absolute', thresholdSec: 30 },
    });
    expect(coverage.pauseSec).toBe(0);
    expect(coverage.unreliableSec).toBe(coverage.spanSec);
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
        unreliableSec: 0,
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
 * `detectPaceDisagreement`'s totality guarantee (RPACE-03, T-26-01), pinned
 * alongside `classifyGaps`' own totality block above so every never-throwing
 * guarantee for this module lives together. Retargeted (35-08, D-01): the
 * comparator now takes an already-computed `RunningPace`, never a stream —
 * the malformed-input cases below chain through `deriveRunningPace`'s own
 * totality (pinned separately in this file, 35-03) to preserve the original
 * "malformed stream" flavour of each case rather than dropping it. Positive/
 * negative-case coverage of the actual disagreement (activity 5059204779,
 * the D-02 gate's own can-fail/can-pass pair) lives in
 * `compute-dashboard-index.test.ts`'s `describe('pace disagreement', ...)`
 * block, alongside the archive-wide over-fire sweep it shares fixtures with.
 * Boundary and direction behaviour (cases a-h) live in the calibration-pinned
 * describe block below this one.
 */
describe('detectPaceDisagreement — totality, never throws, always null on malformed input', () => {
  it('returns null on a not-computable RunningPace produced from a malformed stream (t/d length mismatch)', () => {
    const badStream = makeStream({ t: [0, 10, 20], d: [0, 100] });
    const runningPace = deriveRunningPace(badStream);
    expect(runningPace.computable).toBe(false);
    expect(() => detectPaceDisagreement(100, runningPace)).not.toThrow();
    expect(detectPaceDisagreement(100, runningPace)).toBeNull();
  });

  it('returns null when metadataPaceSecPerKm is null, even given an otherwise-eligible computable RunningPace', () => {
    const runningPace = makeRunningPace();
    expect(() => detectPaceDisagreement(null, runningPace)).not.toThrow();
    expect(detectPaceDisagreement(null, runningPace)).toBeNull();
  });

  it('returns null on the not-computable RunningPace produced from a zero-distance stream (d never advances)', () => {
    const stream = makeStream({ t: [0, 10, 20], d: [0, 0, 0] });
    const runningPace = deriveRunningPace(stream);
    expect(runningPace.computable).toBe(false);
    expect(runningPace.notComputableReason).toBe(NOT_COMPUTABLE_NO_COVERED_DISTANCE);
    expect(() => detectPaceDisagreement(100, runningPace)).not.toThrow();
    expect(detectPaceDisagreement(100, runningPace)).toBeNull();
  });
});

/**
 * The calibrated constant, and the eligibility gate / cut / direction it
 * governs (RPACE-03, D-01/D-02/D-06/D-07, 35-08). This suite stays
 * SYNTHETIC throughout — every case is built on `makeRunningPace`, so no
 * expectation here depends on `deriveRunningPace`'s own correctness.
 * Named-activity reachability against the real archive lives in
 * `compute-dashboard-index.test.ts`'s `describe('pace disagreement', ...)`
 * block, the phase's one archive-reading location for this comparator.
 */
describe('detectPaceDisagreement — calibrated cut, D-02 gate, D-06 direction (RPACE-03, pinned to 35-CALIBRATION.md)', () => {
  const ARTIFACT_PATH = path.join(
    '.planning',
    'phases',
    '35-stream-derived-running-pace',
    '35-CALIBRATION.md'
  );

  /**
   * Parses `PACE_DISAGREEMENT_RUNNING_RATIO`'s value out of
   * `35-CALIBRATION.md`'s `## Chosen constants` line at TEST TIME (34
   * D-21's parse-from-artifact precedent) — never a literal `1.0173` pinned
   * in this file, so the test fails if the artifact and the shipped
   * constant ever diverge, rather than silently agreeing with itself.
   */
  function parsedCut(): number {
    if (!fs.existsSync(ARTIFACT_PATH)) {
      throw new Error(
        `Missing ${ARTIFACT_PATH} — likely a milestone-archival \`git mv\` moved this phase's ` +
          "directory; update this test's ARTIFACT_PATH to the archived location. Never skip this test."
      );
    }
    const artifact = fs.readFileSync(ARTIFACT_PATH, 'utf-8');
    const match = /^PACE_DISAGREEMENT_RUNNING_RATIO = ([0-9.]+)$/m.exec(artifact);
    if (match === null) {
      throw new Error(
        `Expected a line-anchored "PACE_DISAGREEMENT_RUNNING_RATIO = <value>" line in ` +
          `${ARTIFACT_PATH} — a re-run of the generator landing on its own HALT branch (never ` +
          'shipping a line) is the likely cause; never skip, never silently pass.'
      );
    }
    return Number(match[1]);
  }

  it('the exported constant equals the value parsed from 35-CALIBRATION.md', () => {
    expect(PACE_DISAGREEMENT_RUNNING_RATIO).toBe(parsedCut());
  });

  it('just above the cut: flagged, with a fully-populated result and both roundings correct', () => {
    const cut = parsedCut();
    const metadataPaceSecPerKm = 300;
    const runningPace = makeRunningPace({
      runningPaceSecPerKm: metadataPaceSecPerKm * cut + 1,
      excludedM: 10,
    });
    const result = detectPaceDisagreement(metadataPaceSecPerKm, runningPace);
    expect(result).not.toBeNull();
    expect(result).toEqual({
      runningPaceSecPerKm: Math.round((metadataPaceSecPerKm * cut + 1) * 10) / 10,
      metadataPaceSecPerKm: 300,
      ratio: Math.round(((metadataPaceSecPerKm * cut + 1) / metadataPaceSecPerKm) * 100) / 100,
    });
  });

  it('just below the cut: null', () => {
    const cut = parsedCut();
    const metadataPaceSecPerKm = 300;
    const runningPace = makeRunningPace({
      runningPaceSecPerKm: metadataPaceSecPerKm * cut - 1,
      excludedM: 10,
    });
    expect(detectPaceDisagreement(metadataPaceSecPerKm, runningPace)).toBeNull();
  });

  it('exactly at the cut: flagged — the comparison is inclusive (boundary asserted explicitly)', () => {
    const cut = parsedCut();
    const metadataPaceSecPerKm = 300;
    const runningPace = makeRunningPace({
      runningPaceSecPerKm: metadataPaceSecPerKm * cut,
      excludedM: 10,
    });
    const result = detectPaceDisagreement(metadataPaceSecPerKm, runningPace);
    expect(result).not.toBeNull();
    // The raw ratio (runningPaceSecPerKm / metadataPaceSecPerKm) sits exactly
    // at `cut` by construction; the returned field is `cut` rounded to two
    // decimals, matching `detectPaceDisagreement`'s own rounding convention.
    expect(result?.ratio).toBe(Math.round(cut * 100) / 100);
  });

  it('D-02 gate: excludedM === 0 returns null even far beyond the cut; the smallest positive excludedM returns a result (can-fail AND can-pass in one pair)', () => {
    const cut = parsedCut();
    const metadataPaceSecPerKm = 300;
    const farBeyondCut = makeRunningPace({
      runningPaceSecPerKm: metadataPaceSecPerKm * cut * 2,
      excludedM: 0,
    });
    expect(detectPaceDisagreement(metadataPaceSecPerKm, farBeyondCut)).toBeNull();

    const smallestPositiveExcludedM = { ...farBeyondCut, excludedM: Number.EPSILON };
    expect(detectPaceDisagreement(metadataPaceSecPerKm, smallestPositiveExcludedM)).not.toBeNull();
  });

  it('D-06 direction: a running pace FASTER than metadata by more than the cut\'s magnitude returns null, in both statistic families\' arithmetic', () => {
    const cut = parsedCut();
    const metadataPaceSecPerKm = 300;
    // Ratio-family mirror: running pace at 1/cut of metadata (i.e. running
    // faster by exactly the same magnitude the slow-side cut requires).
    const fasterRatioMirror = makeRunningPace({
      runningPaceSecPerKm: metadataPaceSecPerKm / cut,
      excludedM: 10,
    });
    expect(detectPaceDisagreement(metadataPaceSecPerKm, fasterRatioMirror)).toBeNull();

    // Delta-family mirror: running pace faster by the same absolute sec/km
    // magnitude the ratio cut implies at this metadata pace.
    const deltaMagnitude = metadataPaceSecPerKm * cut - metadataPaceSecPerKm;
    const fasterDeltaMirror = makeRunningPace({
      runningPaceSecPerKm: metadataPaceSecPerKm - deltaMagnitude,
      excludedM: 10,
    });
    expect(detectPaceDisagreement(metadataPaceSecPerKm, fasterDeltaMirror)).toBeNull();
  });

  it('computable: false returns null even when every other clause would pass', () => {
    const cut = parsedCut();
    const metadataPaceSecPerKm = 300;
    const runningPace = makeRunningPace({
      computable: false,
      notComputableReason: NOT_COMPUTABLE_NO_COVERED_DISTANCE,
      runningPaceSecPerKm: metadataPaceSecPerKm * cut * 2,
      excludedM: 10,
    });
    expect(detectPaceDisagreement(metadataPaceSecPerKm, runningPace)).toBeNull();
  });

  it('runningPace.runningPaceSecPerKm === null returns null even when computable is (incorrectly) true', () => {
    const runningPace = makeRunningPace({ runningPaceSecPerKm: null, excludedM: 10 });
    expect(detectPaceDisagreement(300, runningPace)).toBeNull();
  });

  it.each([
    ['null', null],
    ['0', 0],
    ['a negative value', -50],
  ])('metadataPaceSecPerKm of %s returns null', (_label, metadataPaceSecPerKm) => {
    const cut = parsedCut();
    const runningPace = makeRunningPace({ runningPaceSecPerKm: 1000 * cut, excludedM: 10 });
    expect(detectPaceDisagreement(metadataPaceSecPerKm, runningPace)).toBeNull();
  });

  it('all-or-nothing: a flagged result has exactly the three expected keys and no undefined value on any of them', () => {
    const cut = parsedCut();
    const metadataPaceSecPerKm = 300;
    const runningPace = makeRunningPace({
      runningPaceSecPerKm: metadataPaceSecPerKm * cut * 1.5,
      excludedM: 10,
    });
    const result = detectPaceDisagreement(metadataPaceSecPerKm, runningPace);
    expect(result).not.toBeNull();
    const entries = Object.entries(result as unknown as Record<string, unknown>);
    const keys = entries.map(([key]) => key).sort();
    expect(keys).toEqual(['metadataPaceSecPerKm', 'ratio', 'runningPaceSecPerKm']);
    for (const [, value] of entries) {
      expect(value).not.toBeUndefined();
    }
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
    const samples = paceHistogramSamples(t, result.paceSeries, result.coverage.gapIntervals);
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

  it('3647739864 recovers to fast mass < 2% and coverage > 97% under the adaptive window (Phase 33: coverage floor lowered from 98% — the detector now clips a genuine unreliable segment here too)', () => {
    const stream = readArchiveStream('3647739864');
    const result = derivePaceWithCoverage(stream);
    const { fastMass, coveredFraction } = fastMassAndCoverage(result, stream.t);
    // Pre-Phase-33 measured 0.62% / 100.0%. Phase 33 (2026-09-21): this
    // stream carries a detected unreliable segment (88 s) that
    // paceHistogramSamples now excludes exactly as it excludes a gap
    // (PACE-08's inherited clipping, D-02) — measured 0.08% / 97.45%. The
    // coverage floor is lowered to reflect this genuine, intended clip, not
    // a regression.
    expect(fastMass).toBeLessThan(0.02);
    expect(coveredFraction).toBeGreaterThan(0.97);
  });

  it('4598855187 recovers to fast mass < 2% and coverage > 97% under the adaptive window (Phase 33: coverage floor lowered from 98% — the detector now clips a genuine unreliable segment here too)', () => {
    const stream = readArchiveStream('4598855187');
    const result = derivePaceWithCoverage(stream);
    const { fastMass, coveredFraction } = fastMassAndCoverage(result, stream.t);
    // Pre-Phase-33 measured 0.00% / 100.0%. Phase 33 (2026-09-21): this
    // stream carries a detected unreliable segment (147 s), clipped the same
    // way — measured 0.09% / 97.91%. The coverage floor is lowered to
    // reflect this genuine, intended clip, not a regression.
    expect(fastMass).toBeLessThan(0.02);
    expect(coveredFraction).toBeGreaterThan(0.97);
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

/**
 * Cross-plan integration repair (2026-09-08): `paceHistogramSamples` pins
 * the exact-coverage invariant itself, rather than leaving it to a
 * per-caller local mask. Plan 26-04 discovered this defect and worked
 * around it locally inside `detail-zones.ts` because `pace-derivation.ts`
 * was owned by a concurrently-executing sibling plan at the time; this
 * suite is what proves the shared module now owns the rule directly.
 *
 * `syntheticRecordingGapStream()` (t 0..200s dense, 300s recording gap,
 * t 500..700s dense — see `pace-fixtures.ts`) is exact enough to hand-derive
 * the answer: `spanSec` is 700, the gap is exactly 300s, so `coveredSec` is
 * exactly 400s. Before this fix, `paceHistogramSamples(t, paceSeries)`
 * (2-arg) summed to 700 — the FULL SPAN — because the pre-gap sample's own
 * forward segment `[200, 500]` (the gap itself) was included: its pace
 * value is non-null (window-clipped but valid), so the old `dt <= 0 ||
 * pace === null` skip never caught it.
 *
 * Mutation check performed while writing this test (not committed as
 * source, recorded here per the plan's instruction): temporarily reverted
 * `paceHistogramSamples` to the old 2-arg body (drop the `gapIntervals`
 * parameter and the `inGap` exclusion) and ran this test — it failed with
 * `expected 700 to be 400` (received `700`, the un-clipped full span),
 * confirming the test actually exercises the defect rather than passing
 * vacuously. Reverted back to the fixed 3-arg body immediately after,
 * confirmed the suite passes again.
 *
 * NARROWED (WR-01, plan 26-11): the exact-sum claim below holds for THIS
 * fixture's two shapes, not universally — an isolated zero-net-advance
 * `covered` segment flanked by two `recording-gap`s breaks it (see the
 * `WR-01 —` describe block after this one). The unconditional, general-case
 * identity is `coveredSec === bucketedSec + unbucketedCoveredSec`, asserted
 * via `paceHistogramAccounting`, not this function's bare sum.
 */
describe('paceHistogramSamples — exact coverage invariant (cross-plan integration repair, 2026-09-08)', () => {
  it('summed timeSec equals coverage.coveredSec exactly, never spanSec, across a fixture with a known-duration gap', () => {
    const stream = syntheticRecordingGapStream();
    const result = derivePaceWithCoverage(stream);

    expect(result.coverage.spanSec).toBe(700);
    expect(result.coverage.recordingGapSec).toBe(300);
    expect(result.coverage.coveredSec).toBe(400);

    const samples = paceHistogramSamples(stream.t, result.paceSeries, result.coverage.gapIntervals);
    const totalWeightedSec = samples.reduce((sum, s) => sum + s.timeSec, 0);

    expect(totalWeightedSec).toBe(result.coverage.coveredSec);
    expect(totalWeightedSec).not.toBe(result.coverage.spanSec);
  });

  it('excludes the pre-gap sample\'s own forward segment specifically (the defect\'s exact mechanism)', () => {
    const stream = syntheticRecordingGapStream();
    const result = derivePaceWithCoverage(stream);
    const preGapIndex = stream.t.indexOf(200);

    expect(preGapIndex).toBeGreaterThan(-1);
    expect(result.paceSeries[preGapIndex]).not.toBeNull();

    const samples = paceHistogramSamples(stream.t, result.paceSeries, result.coverage.gapIntervals);
    const gapTimeIncluded = samples.some((s) => s.timeSec === 300);

    expect(gapTimeIncluded).toBe(false);
  });
});

/**
 * WR-01 (26-REVIEW.md): `paceHistogramSamples`'s documented "sum of every
 * returned timeSec equals coverage.coveredSec EXACTLY" invariant can be
 * silently violated by an isolated zero-net-advance `covered` segment
 * flanked by two `recording-gap`s. The verifier tried to construct this
 * shape and could not (their flat run classified `pause`, not `covered`) —
 * 26-VERIFICATION.md carried it forward as unsettled in both directions.
 * This block settles it: reachable, proven with an assertion rather than a
 * comment, the old invariant was observed failing against it twice — once
 * synthetically, once on real committed archive data
 * (`data/streams/11865310195.json`) — and the replacement identity
 * (`paceHistogramAccounting`, `coveredSec === bucketedSec +
 * unbucketedCoveredSec`) is asserted exact, unconditionally, on both
 * shapes.
 */
describe('WR-01 — zero-net-advance covered segment flanked by recording gaps', () => {
  it('reachability: classifyGaps classifies the middle [12, 14] segment as covered, not pause', () => {
    // advanceIntervals(t, d) here is [12, 14] (the two segments that DO
    // advance distance) — its p90 quantile is small, so the scale-relative
    // pause threshold (5 * p90) is far above this segment's 2-second flat
    // run. The flat run therefore does NOT exceed the pause threshold, and
    // strict-priority classification falls through to `covered`. A future
    // reader who changes PAUSE_GAP_P90_MULTIPLIER should re-check this.
    const stream = makeStream({ t: [0, 12, 14, 26], d: [0, 30, 30, 60] });
    const coverage = classifyGaps(stream.t, stream.d);

    expect(coverage.spanSec).toBe(26);
    expect(coverage.coveredSec).toBe(2);
    expect(coverage.recordingGapSec).toBe(24);
    expect(coverage.pauseSec).toBe(0);
    expect(coverage.gapIntervals).toHaveLength(2);
    expect(coverage.gapIntervals[0]).toStrictEqual({ startSec: 0, endSec: 12, kind: 'recording-gap' });
    expect(coverage.gapIntervals[1]).toStrictEqual({ startSec: 14, endSec: 26, kind: 'recording-gap' });
  });

  it('itemised identity: on the synthetic shape, bucketedSec is 0, unbucketedCoveredSec is 2, and the sum equals coveredSec', () => {
    const stream = makeStream({ t: [0, 12, 14, 26], d: [0, 30, 30, 60] });
    const result = derivePaceWithCoverage(stream);
    const accounting = paceHistogramAccounting(stream.t, result.paceSeries, result.coverage);

    // The OLD claim was wrong: Σ samples.timeSec does NOT equal
    // coverage.coveredSec on this shape (the sample index whose window
    // clamps to exactly [12, 14] has metres = 0, so its pace is null and
    // paceHistogramSamples drops it entirely). Pinned so a future edit
    // cannot silently restore the old, false invariant.
    expect(accounting.bucketedSec).not.toBe(result.coverage.coveredSec);

    expect(accounting.bucketedSec).toBe(0);
    expect(accounting.unbucketedCoveredSec).toBe(2);
    expect(result.coverage.coveredSec).toBe(accounting.bucketedSec + accounting.unbucketedCoveredSec);
  });

  it('itemised identity: on real archive activity 11865310195, bucketedSec is 0, unbucketedCoveredSec is 6, and the sum equals coveredSec', () => {
    const stream = readStream('11865310195');
    const coverage = classifyGaps(stream.t, stream.d);

    expect(coverage.spanSec).toBe(18);
    expect(coverage.coveredSec).toBe(6);
    expect(coverage.recordingGapSec).toBe(12);

    const result = derivePaceWithCoverage(stream);
    const accounting = paceHistogramAccounting(stream.t, result.paceSeries, result.coverage);

    expect(accounting.bucketedSec).not.toBe(result.coverage.coveredSec);

    expect(accounting.bucketedSec).toBe(0);
    expect(accounting.unbucketedCoveredSec).toBe(6);
    expect(result.coverage.coveredSec).toBe(accounting.bucketedSec + accounting.unbucketedCoveredSec);
  });

  /**
   * Archive-wide sweep (plan 26-11 Task 3, throwaway script, 2026-09-09, 1865
   * streams): the identity holds on every scanned stream (0 violations); 44
   * activities have unbucketedCoveredSec > 0, and 11865310195 is the maximum
   * ratio case (1.0 — 100% of its covered time is unbucketed, the pathological
   * shape). Pinned here for two named real activities per the file's
   * established discipline — a small sample, not the whole sweep, but a
   * permanent regression guard on both the pathological case and a clean one.
   */
  it('itemised identity holds for a named sample of real archive activities, including the pathological and a clean case', () => {
    const pathological = readStream('11865310195');
    const pathologicalCoverage = classifyGaps(pathological.t, pathological.d);
    const pathologicalResult = derivePaceWithCoverage(pathological);
    const pathologicalAccounting = paceHistogramAccounting(
      pathological.t,
      pathologicalResult.paceSeries,
      pathologicalResult.coverage
    );
    expect(pathologicalAccounting.unbucketedCoveredSec).toBe(6);
    expect(pathologicalCoverage.coveredSec).toBe(
      pathologicalAccounting.bucketedSec + pathologicalAccounting.unbucketedCoveredSec
    );

    // 4556693525 — the pinned worked exemplar (26-CONTEXT.md). The sweep
    // measured unbucketedCoveredSec === 0 for it exactly (every covered
    // second the derivation classifies is also bucketed into a histogram
    // sample) — asserting the measured value, not a rounder assumption.
    const clean = readStream('4556693525');
    const cleanCoverage = classifyGaps(clean.t, clean.d);
    const cleanResult = derivePaceWithCoverage(clean);
    const cleanAccounting = paceHistogramAccounting(clean.t, cleanResult.paceSeries, cleanResult.coverage);
    expect(cleanAccounting.unbucketedCoveredSec).toBe(0);
    expect(cleanCoverage.coveredSec).toBe(cleanAccounting.bucketedSec + cleanAccounting.unbucketedCoveredSec);
  });

  it('unbucketedCoveredSec is never negative for either fixture (the deliberate no-clamp decision, pinned as a checked property)', () => {
    const synthetic = makeStream({ t: [0, 12, 14, 26], d: [0, 30, 30, 60] });
    const syntheticResult = derivePaceWithCoverage(synthetic);
    const syntheticAccounting = paceHistogramAccounting(
      synthetic.t,
      syntheticResult.paceSeries,
      syntheticResult.coverage
    );
    expect(syntheticAccounting.unbucketedCoveredSec).toBeGreaterThanOrEqual(0);

    const archive = readStream('11865310195');
    const archiveResult = derivePaceWithCoverage(archive);
    const archiveAccounting = paceHistogramAccounting(archive.t, archiveResult.paceSeries, archiveResult.coverage);
    expect(archiveAccounting.unbucketedCoveredSec).toBeGreaterThanOrEqual(0);
  });
});

/**
 * classifyGaps reclassification — real committed unreliable segments
 * (Phase 33, PACE-08, D-01/D-02/D-14/D-15). Every case below reads
 * `data/streams/{id}.json` directly and computes every numeric expectation
 * in-test from raw `t`/`d` (or from `classifyGapsThreeWay`) — never a number
 * copied from CONTEXT.md/RESEARCH.md/32-CALIBRATION.md, per this plan's own
 * anti-circularity instruction. Named so `-t "unreliable"` selects every
 * test in this block (the describe title itself carries the word).
 *
 * The three named activities are 33-CONTEXT.md's own fixtures: 3475724402
 * (18 gaps, 30 gap-adjacent bursts), 3475734189 (no timestamp gap at all;
 * the 199 m hidden pause at t=1353-1360), 3475740390 (five isolated jumps,
 * t=2508 is the 52.4 m jump). Real IDs only, no synthetic look-alikes
 * (33-RESEARCH.md Pitfall 12).
 */
describe('classifyGaps reclassification — real-stream unreliable segments (Phase 33 D-01, D-02, D-14/D-15)', () => {
  const NAMED_ACTIVITY_IDS = ['3475724402', '3475734189', '3475740390'] as const;

  it('priority: on 3475724402, at least one pair classifyGapsThreeWay calls recording-gap is called unreliable by classifyGaps, and recordingGapSec strictly shrinks', () => {
    const stream = readStream('3475724402');
    const threeWay = classifyGapsThreeWay(stream.t, stream.d);
    const fourWay = classifyGaps(stream.t, stream.d);

    // Reachability: this stream must actually have a three-way recording-gap
    // interval for the priority claim to be checkable at all.
    const threeWayRecordingGapIntervals = threeWay.gapIntervals.filter((g) => g.kind === 'recording-gap');
    expect(threeWayRecordingGapIntervals.length).toBeGreaterThan(0);

    // At least one three-way recording-gap interval overlaps a four-way
    // unreliable interval — the pair that pass 1 called recording-gap is
    // reclassified unreliable by pass 3.
    const fourWayUnreliableIntervals = fourWay.gapIntervals.filter((g) => g.kind === 'unreliable');
    expect(fourWayUnreliableIntervals.length).toBeGreaterThan(0);
    const anyOverlap = threeWayRecordingGapIntervals.some((tg) =>
      fourWayUnreliableIntervals.some((fg) => tg.startSec < fg.endSec && fg.startSec < tg.endSec)
    );
    expect(anyOverlap).toBe(true);

    expect(fourWay.recordingGapSec).toBeLessThan(threeWay.recordingGapSec);
  });

  it('A1 measured, not assumed: four-way coveredSec is <= three-way coveredSec on all three named activities, and strictly less on at least one', () => {
    const measurements = NAMED_ACTIVITY_IDS.map((id) => {
      const stream = readStream(id);
      const threeWay = classifyGapsThreeWay(stream.t, stream.d);
      const fourWay = classifyGaps(stream.t, stream.d);
      return { id, threeWayCoveredSec: threeWay.coveredSec, fourWayCoveredSec: fourWay.coveredSec };
    });

    // eslint-disable-next-line no-console
    console.log('[pace-derivation A1] ' + JSON.stringify(measurements));

    for (const m of measurements) {
      expect(m.fourWayCoveredSec).toBeLessThanOrEqual(m.threeWayCoveredSec);
    }
    expect(measurements.some((m) => m.fourWayCoveredSec < m.threeWayCoveredSec)).toBe(true);
  });

  it('conservation: for each named activity, three-way and four-way sums both equal spanSec, and equal each other, to 1e-9 (a structural property of an exhaustive if/else partition — NOT the proof of COV-03; plan 33-07\'s detector-free recount is)', () => {
    for (const id of NAMED_ACTIVITY_IDS) {
      const stream = readStream(id);
      const threeWay = classifyGapsThreeWay(stream.t, stream.d);
      const fourWay = classifyGaps(stream.t, stream.d);

      const threeWaySum = threeWay.coveredSec + threeWay.recordingGapSec + threeWay.pauseSec;
      const fourWaySum =
        fourWay.coveredSec + fourWay.recordingGapSec + fourWay.pauseSec + fourWay.unreliableSec;

      expect(Math.abs(threeWaySum - fourWay.spanSec)).toBeLessThan(1e-9);
      expect(Math.abs(fourWaySum - fourWay.spanSec)).toBeLessThan(1e-9);
      expect(Math.abs(threeWaySum - fourWaySum)).toBeLessThan(1e-9);
    }
  });

  it('unreliableSec equals the summed duration of classifyGaps intervals of kind unreliable, and that set\'s boundaries equal the detector\'s own segment boundaries on the same stream', () => {
    for (const id of NAMED_ACTIVITY_IDS) {
      const stream = readStream(id);
      const threeWay = classifyGapsThreeWay(stream.t, stream.d);
      const fourWay = classifyGaps(stream.t, stream.d);

      const unreliableIntervals = fourWay.gapIntervals.filter((g) => g.kind === 'unreliable');
      const summedDuration = unreliableIntervals.reduce((sum, g) => sum + (g.endSec - g.startSec), 0);
      expect(Math.abs(summedDuration - fourWay.unreliableSec)).toBeLessThan(1e-9);

      // Independently re-derive the detector's own segment boundaries from
      // the pre-detector three-way list, the same way classifyGaps' own
      // pass 2 does — not by trusting fourWay's own output.
      const detectorGaps = threeWay.gapIntervals.map((g) => ({ startSec: g.startSec, endSec: g.endSec }));
      const segments = detectUnreliableSegments(stream.t, stream.d, detectorGaps, DEFAULT_DETECTOR_PARAMS);
      const segmentBoundaries = segments
        .map((s) => ({ startSec: s.startSec, endSec: s.endSec }))
        .sort((a, b) => a.startSec - b.startSec);
      const intervalBoundaries = unreliableIntervals
        .map((g) => ({ startSec: g.startSec, endSec: g.endSec }))
        .sort((a, b) => a.startSec - b.startSec);

      expect(intervalBoundaries).toEqual(segmentBoundaries);
    }
  });

  it('clipping is real, not nominal: on 3475734189 (199 m hidden pause, no timestamp gap) every sample index strictly inside the detected segment is null in derivePaceWithCoverage\'s paceSeries, and paceHistogramSamples emits no sample whose start falls inside it', () => {
    const stream = readStream('3475734189');
    const threeWay = classifyGapsThreeWay(stream.t, stream.d);
    const detectorGaps = threeWay.gapIntervals.map((g) => ({ startSec: g.startSec, endSec: g.endSec }));
    const segments = detectUnreliableSegments(stream.t, stream.d, detectorGaps, DEFAULT_DETECTOR_PARAMS);

    expect(segments.length).toBeGreaterThan(0); // reachability
    const segment = segments[0];
    expect(segment.mechanism).toBe('hidden-pause');

    const result = derivePaceWithCoverage(stream);

    // Strictly inside: t strictly between the segment's own startSec/endSec
    // (the same open-interval rule derivePaceSeriesGapAware's own clip uses)
    // — every sample index in that range must be null.
    let checkedAny = false;
    for (let i = segment.startIndex; i <= segment.endIndex; i++) {
      const time = stream.t[i];
      if (time > segment.startSec && time < segment.endSec) {
        checkedAny = true;
        expect(result.paceSeries[i]).toBeNull();
      }
    }
    expect(checkedAny).toBe(true); // reachability: at least one strictly-inside index must exist

    // paceHistogramSamples excludes a raw index i whenever t[i] (the
    // segment's own start) falls inside a gapIntervals entry — re-derive,
    // from raw t alone, which indices in this segment's window WOULD have
    // survived if this segment carried no gap-membership exclusion at all
    // (dt > 0 and a non-null pace), then confirm every one of them IS
    // excluded once result.coverage.gapIntervals (which now includes this
    // segment as 'unreliable') is applied — proving the exclusion is doing
    // real work here, not vacuously finding nothing to exclude.
    const wouldSurviveWithNoGapIntervals: number[] = [];
    for (let i = segment.startIndex; i < segment.endIndex; i++) {
      const segStart = stream.t[i];
      const dt = stream.t[i + 1] - stream.t[i];
      if (dt > 0 && segStart >= segment.startSec && segStart < segment.endSec) {
        wouldSurviveWithNoGapIntervals.push(i);
      }
    }
    expect(wouldSurviveWithNoGapIntervals.length).toBeGreaterThan(0); // reachability

    const samplesWithNoGaps = paceHistogramSamples(stream.t, result.paceSeries, []);
    const samplesWithRealGaps = paceHistogramSamples(stream.t, result.paceSeries, result.coverage.gapIntervals);

    // With gapIntervals stripped entirely, the segment's own bucketed time
    // (sum of dt for indices whose t[i] falls inside [startSec, endSec))
    // is non-zero — proving the exclusion mechanism, not a null pace series,
    // is what would otherwise let these samples through.
    const bucketedInsideSegmentNoGaps = wouldSurviveWithNoGapIntervals.reduce(
      (sum, i) => sum + (stream.t[i + 1] - stream.t[i]),
      0
    );
    expect(bucketedInsideSegmentNoGaps).toBeGreaterThan(0);
    expect(samplesWithNoGaps.length).toBeGreaterThanOrEqual(samplesWithRealGaps.length);

    // With the real gapIntervals applied, paceHistogramSamples' own total
    // bucketed time never includes any of this segment's dt.
    const totalBucketedRealGaps = samplesWithRealGaps.reduce((sum, s) => sum + s.timeSec, 0);
    const totalBucketedNoGaps = samplesWithNoGaps.reduce((sum, s) => sum + s.timeSec, 0);
    expect(totalBucketedRealGaps).toBeLessThan(totalBucketedNoGaps);
  });

  it('WR-01 identity survives the shrink: paceHistogramAccounting\'s coveredSec === bucketedSec + unbucketedCoveredSec holds on 3475724402 with the now-smaller coveredSec', () => {
    const stream = readStream('3475724402');
    const threeWay = classifyGapsThreeWay(stream.t, stream.d);
    const result = derivePaceWithCoverage(stream);
    const accounting = paceHistogramAccounting(stream.t, result.paceSeries, result.coverage);

    // Reachability: coveredSec must genuinely have shrunk from the
    // pre-detector three-way value for "the now-smaller coveredSec" to be
    // a real claim, not an assumption.
    expect(result.coverage.coveredSec).toBeLessThan(threeWay.coveredSec);

    expect(result.coverage.coveredSec).toBe(accounting.bucketedSec + accounting.unbucketedCoveredSec);
  });
});

/**
 * `classifyGapsWithSegments` — the detector's one permitted accessor
 * (Phase 33 plan 33-09, Task 1). Four named inputs throughout, per this
 * plan's own acceptance criteria: 3475724402, 3475734189, 3475740390 (the
 * three CONTEXT.md fixtures) plus one invalid stream (a length-mismatched
 * `t`/`d` pair, mirroring the "totality" block above).
 */
describe('classifyGapsWithSegments — the detector\'s one permitted accessor (Phase 33 plan 33-09 D-06)', () => {
  const NAMED_ACTIVITY_IDS = ['3475724402', '3475734189', '3475740390'] as const;

  it('classifyGaps(t, d, options) deep-equals classifyGapsWithSegments(t, d, options).coverage on all three named activities plus one invalid stream', () => {
    for (const id of NAMED_ACTIVITY_IDS) {
      const stream = readStream(id);
      const viaClassifyGaps = classifyGaps(stream.t, stream.d);
      const viaAccessor = classifyGapsWithSegments(stream.t, stream.d);
      expect(viaClassifyGaps).toEqual(viaAccessor.coverage);
    }

    // The invalid-stream case: a length-mismatched t/d pair (mirrors the
    // "totality" describe block above). Both must independently return the
    // zeroed PaceCoverage.
    const invalidT = [0, 1, 2];
    const invalidD = [0, 1];
    const viaClassifyGapsInvalid = classifyGaps(invalidT, invalidD);
    const viaAccessorInvalid = classifyGapsWithSegments(invalidT, invalidD);
    expect(viaClassifyGapsInvalid).toEqual(viaAccessorInvalid.coverage);
    expect(viaAccessorInvalid.coverage).toEqual({
      spanSec: 0,
      coveredSec: 0,
      recordingGapSec: 0,
      pauseSec: 0,
      unreliableSec: 0,
      gapIntervals: [],
    });
    expect(viaAccessorInvalid.segments).toEqual([]);
  });

  it('on 3475724402 the returned segments array is non-empty and every segment\'s [startSec, endSec] equals an \'unreliable\' interval in the SAME call\'s coverage.gapIntervals', () => {
    const stream = readStream('3475724402');
    const { coverage, segments } = classifyGapsWithSegments(stream.t, stream.d);

    expect(segments.length).toBeGreaterThan(0); // reachability

    const unreliableIntervals = coverage.gapIntervals
      .filter((g) => g.kind === 'unreliable')
      .map((g) => ({ startSec: g.startSec, endSec: g.endSec }))
      .sort((a, b) => a.startSec - b.startSec);
    const segmentBoundaries = segments
      .map((s) => ({ startSec: s.startSec, endSec: s.endSec }))
      .sort((a, b) => a.startSec - b.startSec);

    expect(segmentBoundaries).toEqual(unreliableIntervals);
  });

  it('on a clean activity (10146303423, no detected segments) both the segments array is empty and coverage.unreliableSec is 0', () => {
    const stream = readStream('10146303423');
    const { coverage, segments } = classifyGapsWithSegments(stream.t, stream.d);

    expect(segments).toEqual([]);
    expect(coverage.unreliableSec).toBe(0);
  });

  it('the re-exported UnreliableSegment and SegmentMechanism types are usable from another analytics module without importing unreliable-segments.js — a segment produced through the accessor is directly assignable to the re-exported type', () => {
    const stream = readStream('3475724402');
    const { segments } = classifyGapsWithSegments(stream.t, stream.d);
    expect(segments.length).toBeGreaterThan(0); // reachability

    // This assignment is itself the type-level proof: if the re-export at
    // the top of pace-derivation.ts were missing or mistyped, this file
    // (which imports UnreliableSegment/SegmentMechanism ONLY from
    // './pace-derivation.js', never from './unreliable-segments.js') would
    // fail to compile.
    const oneSegment: UnreliableSegment = segments[0];
    const mechanism: SegmentMechanism = oneSegment.mechanism;
    expect(['gap-adjacent', 'hidden-pause', 'isolated-jump']).toContain(mechanism);
  });
});

/**
 * `coveredRuns` (34-CONTEXT.md D-01, 34-03-PLAN.md Task 1) — the index-based
 * covered-pair-run field Phase 34's downstream consumers (`findCreepStretches`
 * in `pause-classification.ts`) read instead of re-deriving covered
 * membership from floating `gapIntervals` boundaries. Additive to
 * `classifyGapsWithSegments`'s existing `{ coverage, segments }` result —
 * every pre-existing test above stays green unmodified.
 */
describe('classifyGapsWithSegments coveredRuns (Phase 34)', () => {
  /**
   * Hand-built five-phase fixture: covered (200 s) -> recording gap (300 s,
   * one sample jump, no advance) -> covered (200 s) -> zero-advance pause
   * (400 s, flat distance) -> covered (200 s). Mirrors
   * `buildSyntheticMultiCategoryFixture` above with one extra covered phase
   * inserted between the gap and the pause, so the pattern is exactly the
   * plan's own behavior-list wording: "(covered, recording gap, covered,
   * zero-advance pause, covered)".
   *
   * Pair-index accounting (hand-derived, dense 2 s sampling throughout):
   *   pairs   0..99   covered   (phase 1, 100 steps)
   *   pair    100      recording-gap (phase 2, one 300 s jump)
   *   pairs 101..200  covered   (phase 3, 100 steps)
   *   pairs 201..400  pause     (phase 4, 200 steps, one 400 s flat run)
   *   pairs 401..500  covered   (phase 5, 100 steps)
   * The pause threshold (scale-relative default, multiplier 5) resolves to
   * 5 * quantile(p90 of the 2 s advance intervals) = 5 * 2 = 10 s; the
   * phase-4 flat run's own duration (400 s) clears that threshold by a wide
   * margin, so every pair in it is classified `pause`, not `covered`.
   */
  function buildFiveCategoryFixture(): { t: number[]; d: number[] } {
    const t: number[] = [];
    const d: number[] = [];
    let time = 0;
    let dist = 0;

    // Phase 1: covered, dense 2 s sampling, advancing distance, 200 s (100 steps).
    t.push(time);
    d.push(dist);
    for (let i = 0; i < 100; i++) {
      time += 2;
      dist += 10;
      t.push(time);
      d.push(dist);
    }
    // pairs 0..99 covered. time=200, dist=1000

    // Phase 2: one 300 s recording gap (single sample jump, no advance).
    time += 300;
    t.push(time);
    d.push(dist);
    // pair 100: recording-gap. time=500

    // Phase 3: covered again, dense 2 s sampling, advancing distance, 200 s (100 steps).
    for (let i = 0; i < 100; i++) {
      time += 2;
      dist += 10;
      t.push(time);
      d.push(dist);
    }
    // pairs 101..200 covered. time=700, dist=2000

    // Phase 4: zero-advance pause, dense 2 s sampling, flat distance, 400 s (200 steps).
    for (let i = 0; i < 200; i++) {
      time += 2;
      t.push(time);
      d.push(dist); // flat — zero advance
    }
    // pairs 201..400 pause. time=1100

    // Phase 5: covered again, dense 2 s sampling, advancing distance, 200 s (100 steps).
    for (let i = 0; i < 100; i++) {
      time += 2;
      dist += 10;
      t.push(time);
      d.push(dist);
    }
    // pairs 401..500 covered. time=1300, dist=3000

    return { t, d };
  }

  it('on the hand-built five-phase fixture, returns exactly three covered runs with the expected index bounds', () => {
    const { t, d } = buildFiveCategoryFixture();
    const { coveredRuns } = classifyGapsWithSegments(t, d);

    expect(coveredRuns).toEqual([
      { startIndex: 0, endIndex: 100 },
      { startIndex: 101, endIndex: 201 },
      { startIndex: 401, endIndex: 501 },
    ]);
  });

  it('for each of the three named activities, the sum over coveredRuns of (t[endIndex] - t[startIndex]) equals coverage.coveredSec (within 1e-9), and no coveredRuns pair lies inside any gapIntervals entry', () => {
    const NAMED_ACTIVITY_IDS = ['3475724402', '3475734189', '3475740390'] as const;

    for (const id of NAMED_ACTIVITY_IDS) {
      const stream = readStream(id);
      const { coverage, coveredRuns } = classifyGapsWithSegments(stream.t, stream.d);

      expect(coveredRuns.length).toBeGreaterThan(0); // reachability

      const summedCoveredSec = coveredRuns.reduce(
        (sum, run) => sum + (stream.t[run.endIndex] - stream.t[run.startIndex]),
        0
      );
      expect(Math.abs(summedCoveredSec - coverage.coveredSec)).toBeLessThan(1e-9);

      // No coveredRuns pair lies inside any gapIntervals entry: a covered
      // run's own time span must never have an interior overlap with a
      // gapIntervals entry's time span (they may share a boundary sample,
      // since one category ends exactly where the next begins).
      for (const run of coveredRuns) {
        const runStartSec = stream.t[run.startIndex];
        const runEndSec = stream.t[run.endIndex];
        for (const gap of coverage.gapIntervals) {
          const interiorOverlap = gap.startSec < runEndSec && gap.endSec > runStartSec;
          expect(interiorOverlap).toBe(false);
        }
      }
    }
  });

  it('invalid input (null t, mismatched lengths) returns coveredRuns [] and never throws', () => {
    expect(() => {
      const resultNullT = classifyGapsWithSegments(null as unknown as number[], [0, 1, 2]);
      expect(resultNullT.coveredRuns).toEqual([]);
      expect(resultNullT.coverage.spanSec).toBe(0);
      expect(resultNullT.segments).toEqual([]);
    }).not.toThrow();

    expect(() => {
      const resultNullD = classifyGapsWithSegments([0, 1, 2], null as unknown as number[]);
      expect(resultNullD.coveredRuns).toEqual([]);
    }).not.toThrow();

    expect(() => {
      const resultMismatched = classifyGapsWithSegments([0, 1, 2], [0, 1]);
      expect(resultMismatched.coveredRuns).toEqual([]);
    }).not.toThrow();
  });

  it("UNRELIABLE_SPEED_LIMIT_MPS re-exported from pace-derivation.js is strictly greater than 0 and Object.is-identical to unreliable-segments.js's own export", () => {
    expect(UNRELIABLE_SPEED_LIMIT_MPS_VIA_PACE_DERIVATION).toBeGreaterThan(0);
    expect(
      Object.is(UNRELIABLE_SPEED_LIMIT_MPS_VIA_PACE_DERIVATION, UNRELIABLE_SPEED_LIMIT_MPS_VIA_DETECTOR)
    ).toBe(true);
  });
});

/**
 * 35-02 Task 2 (D-08 folded todo, `validateStreamSeries` null-safety at
 * source): one null-input assertion per exported function in this module
 * that transitively reaches a `validateStreamSeries` call, each asserting
 * the function's OWN already-documented neutral value on a `null`/
 * `undefined` `t`/`d` — never throws, never a newly-invented value.
 * `classifyGapsWithSegments` itself already has this exact coverage in the
 * `coveredRuns (Phase 34)` describe block above (the `null t`/`null d`/
 * mismatched-length case at line ~1055) — not duplicated here.
 */
describe('validateStreamSeries null-safety at source — every reaching exported function (35-02, D-08)', () => {
  it('classifyGaps(null, null) does not throw and returns the zeroed PaceCoverage', () => {
    expect(() => classifyGaps(null as unknown as number[], null as unknown as number[])).not.toThrow();
    const coverage = classifyGaps(null as unknown as number[], null as unknown as number[]);
    expect(coverage).toEqual({
      spanSec: 0,
      coveredSec: 0,
      recordingGapSec: 0,
      pauseSec: 0,
      unreliableSec: 0,
      gapIntervals: [],
    });
  });

  it('classifyGapsThreeWay(undefined, undefined) does not throw and returns the zeroed ThreeWayPaceCoverage', () => {
    expect(() =>
      classifyGapsThreeWay(undefined as unknown as number[], undefined as unknown as number[])
    ).not.toThrow();
    const coverage = classifyGapsThreeWay(
      undefined as unknown as number[],
      undefined as unknown as number[]
    );
    expect(coverage).toEqual({
      spanSec: 0,
      coveredSec: 0,
      recordingGapSec: 0,
      pauseSec: 0,
      gapIntervals: [],
    });
  });

  it('derivePaceWithCoverage on a stream whose t/d are null does not throw and returns an empty series with the zeroed coverage and the floor window width', () => {
    const stream = makeStream({ t: [0, 1, 2], d: [0, 1, 2] });
    const nullStream = { ...stream, t: null as unknown as number[], d: null as unknown as number[] };
    expect(() => derivePaceWithCoverage(nullStream)).not.toThrow();
    const result = derivePaceWithCoverage(nullStream);
    expect(result.paceSeries).toEqual([]);
    expect(result.coverage).toEqual({
      spanSec: 0,
      coveredSec: 0,
      recordingGapSec: 0,
      pauseSec: 0,
      unreliableSec: 0,
      gapIntervals: [],
    });
    expect(result.windowSec).toBe(20);
  });

  it('detectPaceDisagreement given the not-computable RunningPace deriveRunningPace produces for a stream whose t/d are null does not throw and returns null (35-08 retarget: composed through deriveRunningPace, which is the function that now reaches validateStreamSeries here)', () => {
    const stream = makeStream({ t: [0, 1, 2], d: [0, 1, 2] });
    const nullStream = { ...stream, t: null as unknown as number[], d: null as unknown as number[] };
    const runningPace = deriveRunningPace(nullStream);
    expect(runningPace.computable).toBe(false);
    expect(() => detectPaceDisagreement(100, runningPace)).not.toThrow();
    expect(detectPaceDisagreement(100, runningPace)).toBeNull();
  });
});

/**
 * 35-03 Task 2 (RPACE-01, D-08): `deriveRunningPace` — hand-computed boundary
 * fixtures pinning the per-pair boundary rule (Group A), plus structural
 * conservation on the four named real activities (Group B).
 *
 * Every Group A expected value below is derived BY HAND, in a comment
 * immediately above its assertion, from the fixture's own construction —
 * never by calling `deriveRunningPace` itself and asserting its own output
 * back. Per 35-CONTEXT.md's contamination guard, none of these fixtures'
 * numbers are drawn from this phase's own probe table — every number here
 * is invented fresh for this test file, on purpose-built synthetic streams.
 */
describe('deriveRunningPace — boundary rule pinned by hand-computed fixtures (RPACE-01, D-08)', () => {
  describe('Group A — hand-computed synthetic fixtures', () => {
    it('(a) a clean stream with no gaps, pauses or unreliable segments: excludedM === 0, excludedSec === 0, pace matches the hand-computed division', () => {
      // 50 dense steps of dt=2s, dd=10m each: t = 0, 2, 4, ..., 100;
      // d = 0, 10, 20, ..., 500. Every pair is covered (dt=2 <= 10s
      // recording-gap threshold; d always advances, so the pause threshold
      // never fires). Hand-computed: coveredM = 500, coveredSec = 100,
      // pace = 100 / (500 / 1000) = 200 sec/km.
      const t: number[] = [];
      const d: number[] = [];
      for (let i = 0; i <= 50; i++) {
        t.push(i * 2);
        d.push(i * 10);
      }
      const stream = makeStream({ t, d });

      const result = deriveRunningPace(stream);

      expect(result.computable).toBe(true);
      expect(result.notComputableReason).toBeNull();
      expect(result.coveredM).toBe(500);
      expect(result.coveredSec).toBe(100);
      expect(result.excludedM).toBe(0);
      expect(result.excludedSec).toBe(0);
      expect(result.runningPaceSecPerKm).toBe(100 / (500 / 1000)); // hand: 200 sec/km
    });

    it('(b) THE BOUNDARY CASE — near-zero excluded metres, large excluded seconds: a long mid-stream recording gap across which distance does not advance', () => {
      // Phase A: 100 dense covered steps, dt=2s/dd=10m each: samples
      // index 0..100, t: 0 -> 200, d: 0 -> 1000.
      // Gap: ONE pair, dt=500s (> 10s recording-gap threshold), dd=0 (no
      // advance): index 100 -> 101, t: 200 -> 700, d stays 1000.
      // Phase B: 100 more dense covered steps: index 101..201, t: 700 ->
      // 900, d: 1000 -> 2000.
      const t: number[] = [0];
      const d: number[] = [0];
      for (let i = 1; i <= 100; i++) {
        t.push(t[t.length - 1] + 2);
        d.push(d[d.length - 1] + 10);
      }
      t.push(t[t.length - 1] + 500); // the gap: dt=500, dd=0
      d.push(d[d.length - 1]);
      for (let i = 1; i <= 100; i++) {
        t.push(t[t.length - 1] + 2);
        d.push(d[d.length - 1] + 10);
      }
      const stream = makeStream({ t, d });

      // Reachability: confirm the fixture actually produces two covered
      // runs straddling one recording-gap pair before trusting the
      // hand-computed numbers below.
      const { coveredRuns, coverage } = classifyGapsWithSegments(t, d);
      expect(coveredRuns).toEqual([
        { startIndex: 0, endIndex: 100 },
        { startIndex: 101, endIndex: 201 },
      ]);
      expect(coverage.recordingGapSec).toBe(500);

      const result = deriveRunningPace(stream);

      expect(result.computable).toBe(true);
      // Hand: run1 metres = d[100]-d[0] = 1000-0 = 1000; run2 metres =
      // d[201]-d[101] = 2000-1000 = 1000; coveredM = 1000+1000 = 2000.
      expect(result.coveredM).toBe(2000);
      // Hand: run1 seconds = t[100]-t[0] = 200-0 = 200; run2 seconds =
      // t[201]-t[101] = 900-700 = 200; coveredSec = 200+200 = 400.
      expect(result.coveredSec).toBe(400);
      // Hand: total distance = d[201]-d[0] = 2000-0 = 2000; excludedM =
      // 2000 - 2000 = 0 — the gap pair contributes ZERO metres, so the
      // covered run immediately adjacent to it contributes nothing from
      // the gap's own pair (the boundary rule this case pins).
      expect(result.excludedM).toBe(0);
      // Hand: total span = t[201]-t[0] = 900-0 = 900; excludedSec = 900 -
      // 400 = 500 — EXACTLY the gap's own 500 s duration.
      expect(result.excludedSec).toBe(500);
    });

    it('(c) the mirror case — large excluded distance, small excluded seconds: an isolated single-pair GPS jump (slew burst), no adjacent gap', () => {
      // Phase A: 50 dense covered steps, dt=2s/dd=10m each: index 0..50,
      // t: 0 -> 100, d: 0 -> 500.
      // Burst: ONE pair, dt=2s, dd=60m (implied speed 30 m/s, far above
      // UNRELIABLE_SPEED_LIMIT_MPS=7.35; excess = 60 - 7.35*2 = 45.3 m,
      // clears UNRELIABLE_EXCESS_FLOOR_M=3; not adjacent to any gap and
      // 60 m < HIDDEN_PAUSE_MIN_METRES=116.95, so the detector labels it
      // isolated-jump): index 50 -> 51, t: 100 -> 102, d: 500 -> 560.
      // Phase B: 50 more dense covered steps: index 51..101, t: 102 ->
      // 202, d: 560 -> 1060.
      const t: number[] = [];
      const d: number[] = [];
      for (let i = 0; i <= 50; i++) {
        t.push(i * 2);
        d.push(i * 10);
      }
      t.push(t[t.length - 1] + 2); // the burst: dt=2, dd=60
      d.push(d[d.length - 1] + 60);
      for (let i = 1; i <= 50; i++) {
        t.push(t[t.length - 1] + 2);
        d.push(d[d.length - 1] + 10);
      }
      const stream = makeStream({ t, d });

      // Reachability: confirm the detector actually flagged the burst
      // pair as unreliable before trusting the hand-computed numbers.
      const { coverage, segments } = classifyGapsWithSegments(t, d);
      expect(segments).toHaveLength(1);
      expect(segments[0].mechanism).toBe('isolated-jump');
      expect(coverage.unreliableSec).toBe(2);

      const result = deriveRunningPace(stream);

      expect(result.computable).toBe(true);
      // Hand: run1 metres = 500-0 = 500; run2 metres = 1060-560 = 500;
      // coveredM = 500+500 = 1000.
      expect(result.coveredM).toBe(1000);
      // Hand: run1 seconds = 100-0 = 100; run2 seconds = 202-102 = 100;
      // coveredSec = 100+100 = 200.
      expect(result.coveredSec).toBe(200);
      // Hand: total distance = 1060-0 = 1060; excludedM = 1060-1000 = 60
      // — EXACTLY the burst pair's own 60 m advance.
      expect(result.excludedM).toBe(60);
      // Hand: total span = 202-0 = 202; excludedSec = 202-200 = 2 —
      // EXACTLY the burst pair's own 2 s duration.
      expect(result.excludedSec).toBe(2);
    });

    it('(d) two adjacent covered runs separated by a single non-covered pair: coveredM is the sum of both runs\' own literal metres, and the non-covered pair\'s own advance appears in excludedM and nowhere else', () => {
      // Run 1: 3 dense covered steps, dt=2s/dd=10m each: t: 0->2->4->6,
      // d: 0->10->20->30.
      // Non-covered pair: dt=15s (> 10s recording-gap threshold), dd=5m
      // (a small nonzero advance during the gap — GPS drift, not zero):
      // t: 6->21, d: 30->35.
      // Run 2: 4 dense covered steps: t: 21->23->25->27->29,
      // d: 35->45->55->65->75.
      const t = [0, 2, 4, 6, 21, 23, 25, 27, 29];
      const d = [0, 10, 20, 30, 35, 45, 55, 65, 75];
      const stream = makeStream({ t, d });

      const { coveredRuns, coverage } = classifyGapsWithSegments(t, d);
      expect(coveredRuns).toEqual([
        { startIndex: 0, endIndex: 3 },
        { startIndex: 4, endIndex: 8 },
      ]);
      expect(coverage.recordingGapSec).toBe(15);

      const result = deriveRunningPace(stream);

      expect(result.computable).toBe(true);
      // Hand, both terms as literals: run1 metres = d[3]-d[0] = 30-0 = 30;
      // run2 metres = d[8]-d[4] = 75-35 = 40.
      expect(result.coveredM).toBe(30 + 40);
      // Hand: the single non-covered pair's own advance is d[4]-d[3] =
      // 35-30 = 5 m — total distance 75-0=75, coveredM=70,
      // excludedM = 75-70 = 5, exactly that one pair's own dd and nowhere
      // else (there is no other non-covered pair in this fixture).
      expect(result.excludedM).toBe(5);
      expect(result.excludedSec).toBe(15);
    });

    describe('(e) totality — never throws, always the neutral result with a stated reason, runningPaceSecPerKm: null (never a computed zero)', () => {
      it('deriveRunningPace(null) is not computable, reason NOT_COMPUTABLE_NO_STREAM\'s own text, runningPaceSecPerKm null', () => {
        expect(() => deriveRunningPace(null)).not.toThrow();
        const result = deriveRunningPace(null);
        expect(result).toEqual({
          computable: false,
          notComputableReason: 'no stream committed for this activity',
          runningPaceSecPerKm: null,
          coveredM: 0,
          coveredSec: 0,
          excludedM: 0,
          excludedSec: 0,
        });
      });

      it('deriveRunningPace(undefined) is not computable, same reason as null, runningPaceSecPerKm null', () => {
        expect(() => deriveRunningPace(undefined)).not.toThrow();
        const result = deriveRunningPace(undefined);
        expect(result.computable).toBe(false);
        expect(result.notComputableReason).toBe('no stream committed for this activity');
        expect(result.runningPaceSecPerKm).toBeNull();
      });

      it('a stream whose t/d are null is not computable, same NOT_COMPUTABLE_NO_STREAM reason (non-array shape), runningPaceSecPerKm null', () => {
        const stream = makeStream({ t: [0, 1, 2], d: [0, 1, 2] });
        const nullStream = {
          ...stream,
          t: null as unknown as number[],
          d: null as unknown as number[],
        };
        expect(() => deriveRunningPace(nullStream)).not.toThrow();
        const result = deriveRunningPace(nullStream);
        expect(result.computable).toBe(false);
        expect(result.notComputableReason).toBe('no stream committed for this activity');
        expect(result.runningPaceSecPerKm).toBeNull();
      });

      it('a 1-sample stream is not computable, reason NOT_COMPUTABLE_UNUSABLE_STREAM\'s own text (fails validateStreamSeries inside pass 1), runningPaceSecPerKm null', () => {
        const stream = makeStream({ t: [0], d: [0] });
        expect(() => deriveRunningPace(stream)).not.toThrow();
        const result = deriveRunningPace(stream);
        expect(result.computable).toBe(false);
        expect(result.notComputableReason).toBe('stream failed validateStreamSeries');
        expect(result.runningPaceSecPerKm).toBeNull();
      });

      it('a stream whose d never advances is not computable, reason NOT_COMPUTABLE_NO_COVERED_DISTANCE (passes validateStreamSeries but coveredM is 0), runningPaceSecPerKm null', () => {
        // 50 dense steps, dt=2s, d flat at 0 throughout. Since d never
        // advances anywhere, advanceIntervals(t, d) returns [] (no advance
        // ever recorded), so classifyPairKinds resolves the pause
        // threshold to Infinity and every pair falls through to
        // 'covered' — coveredSec > 0 but coveredM === 0, the exact shape
        // NOT_COMPUTABLE_NO_COVERED_DISTANCE exists to name.
        const t: number[] = [];
        const d: number[] = [];
        for (let i = 0; i <= 50; i++) {
          t.push(i * 2);
          d.push(0);
        }
        const stream = makeStream({ t, d });

        expect(() => deriveRunningPace(stream)).not.toThrow();
        const result = deriveRunningPace(stream);
        expect(result.computable).toBe(false);
        expect(result.notComputableReason).toBe(NOT_COMPUTABLE_NO_COVERED_DISTANCE);
        expect(result.runningPaceSecPerKm).toBeNull();
        expect(result.coveredM).toBe(0);
        expect(result.coveredSec).toBeGreaterThan(0);
      });
    });
  });

  /**
   * Group B — STRUCTURAL CONSERVATION on the four named real activities.
   * This is NOT evidence that the right pairs were classified covered —
   * it holds even if the wrong pairs were labelled, the same distinction
   * `PaceCoverage`'s own docblock draws about its four-term identity. The
   * independent evidence that the RIGHT pairs were classified covered is
   * plan 35-04's zero-import recount, not this block.
   */
  describe('Group B — structural conservation on the four named real activities (NOT evidence of correct classification — see plan 35-04\'s recount for that)', () => {
    const NAMED_ACTIVITY_IDS = ['3475724402', '3475734189', '3475740390', '5059204779'] as const;

    it.each(NAMED_ACTIVITY_IDS)(
      'activity %s: coveredSec + excludedSec === spanSec, excludedSec === the caption\'s own three excluded terms, coveredM + excludedM === total distance, computable with a positive pace',
      (id) => {
        const stream = readStream(id);
        const { coverage } = classifyGapsWithSegments(stream.t, stream.d);
        const result = deriveRunningPace(stream);

        expect(result.computable).toBe(true); // reachability
        expect(result.runningPaceSecPerKm).toBeGreaterThan(0);

        expect(
          Math.abs(result.coveredSec + result.excludedSec - coverage.spanSec)
        ).toBeLessThan(1e-9);

        expect(
          Math.abs(
            result.excludedSec -
              (coverage.recordingGapSec + coverage.pauseSec + coverage.unreliableSec)
          )
        ).toBeLessThan(1e-9);

        const totalM = stream.d[stream.d.length - 1] - stream.d[0];
        expect(Math.abs(result.coveredM + result.excludedM - totalM)).toBeLessThan(1e-6);
      }
    );
  });
});
