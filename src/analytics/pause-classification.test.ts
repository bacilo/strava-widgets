/**
 * Unit coverage for `pause-classification.ts` (PAUSE-01, STOP-01, D-01, D-02,
 * D-03, D-05, D-09, D-10; the Phase 34 half of SEG-05b).
 *
 * `TEST_BANDS` below are deliberately round synthetic values for mechanism
 * tests, NOT calibrated bands — plans 34-04/34-06 calibrate the real
 * `walkRunMps`/`stationaryMaxMps` values. Named streams are read from
 * `data/streams/<id>.json` (committed, never gitignored) via `node:fs`,
 * mirroring `pace-derivation.test.ts`'s own archive-read discipline.
 *
 * Research's cv/ratio figures (34-RESEARCH.md § D-10) and the
 * 2.31-4.06 m/s / cv values / 104-of-1,874 archive counts are references to
 * reconcile against, never expected values pinned in any assertion here
 * (scoping-probe-figures-get-pinned-as-criteria lesson).
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { classifyGapsWithSegments, UNRELIABLE_SPEED_LIMIT_MPS as IMPORTED_UNRELIABLE_SPEED_LIMIT_MPS } from './pace-derivation.js';
import type { CoveredRun, GapInterval, PaceCoverage, UnreliableSegment } from './pace-derivation.js';
import {
  DISTANCE_TRIGGERED_MAX_CV_DD,
  DISTANCE_TRIGGERED_MAX_CV_RATIO,
  FORGOTTEN_STOP_MIN_SEC,
  NOT_COMPUTABLE_DISTANCE_TRIGGERED,
  NOT_COMPUTABLE_TOO_FEW_SIGNATURE_PAIRS,
  SHIPPED_PAUSE_BANDS,
  SHIPPED_STOP_PARAMS,
  SIGNATURE_MIN_COVERED_PAIRS,
  STATIONARY_MAX_SPEED_MPS,
  WALK_RUN_BOUNDARY_MPS,
  classifyForgottenStop,
  classifyPauseSpeed,
  classifyPauses,
  collectPauseIntervals,
  findCreepStretches,
  isTransported,
  joinUnreliableIntervals,
  recordingMechanismSignature,
} from './pause-classification.js';
import type { CanonicalStream } from '../streams/stream.types.js';

/** Reads a committed stream file from `data/streams/` — never the derived stats output. */
function readStream(activityId: string): CanonicalStream {
  return JSON.parse(
    fs.readFileSync(path.join('data/streams', `${activityId}.json`), 'utf-8')
  ) as CanonicalStream;
}

/** Deliberately round synthetic bands for mechanism tests — NOT calibrated (plans 34-04/34-06 calibrate the real values). */
const TEST_BANDS = { stationaryMaxMps: 0.5, walkRunMps: 2.0 };

const UNRELIABLE_SPEED_LIMIT_MPS = 7.35; // for probe construction ONLY — never asserted as the source of truth in this file (that is pace-single-source.test.ts's D-05 job)

// ---------------------------------------------------------------------------
// Hand-built join fixtures (D-01, join exhaustive)
// ---------------------------------------------------------------------------

/** Builds a minimal, valid-shaped `UnreliableSegment` for join tests — only the fields the join reads are meaningful. */
function buildSegment(
  startSec: number,
  endSec: number,
  mechanism: UnreliableSegment['mechanism'],
  startIndex = 0,
  endIndex = 1
): UnreliableSegment {
  return {
    startIndex,
    endIndex,
    startSec,
    endSec,
    metres: (endSec - startSec) * 3, // arbitrary but positive, not asserted directly by join tests
    seconds: endSec - startSec,
    mechanism,
    burstMetres: 0,
    burstSeconds: 0,
    gapMetres: 0,
    gapSeconds: 0,
    burstCount: 0,
    gapCount: 0,
    parts: [],
    excessMetres: 0,
  };
}

function buildGapInterval(startSec: number, endSec: number, kind: GapInterval['kind']): GapInterval {
  return { startSec, endSec, kind };
}

describe('joinUnreliableIntervals — join exhaustive (D-01)', () => {
  it('one \'unreliable\' interval holding one gap-adjacent segment gives gapAdjacent [that segment], violations 0', () => {
    const gapIntervals = [buildGapInterval(10, 20, 'unreliable')];
    const segment = buildSegment(10, 20, 'gap-adjacent');
    const result = joinUnreliableIntervals(gapIntervals, [segment]);

    expect(result.gapAdjacent).toEqual([segment]);
    expect(result.notClassifiableCount).toBe(0);
    expect(result.violations).toBe(0);
  });

  it('one interval holding TWO pair-adjacent segments (one gap-adjacent, one isolated-jump) gives gapAdjacent [the gap-adjacent one], notClassifiableCount 1, violations 0', () => {
    const gapIntervals = [buildGapInterval(10, 30, 'unreliable')];
    const gapAdjacentSeg = buildSegment(10, 20, 'gap-adjacent');
    const isolatedJumpSeg = buildSegment(20, 30, 'isolated-jump');
    const result = joinUnreliableIntervals(gapIntervals, [gapAdjacentSeg, isolatedJumpSeg]);

    expect(result.gapAdjacent).toEqual([gapAdjacentSeg]);
    expect(result.notClassifiableCount).toBe(1);
    expect(result.violations).toBe(0);
  });

  it('an \'unreliable\' interval with no segment inside it gives violations 1', () => {
    const gapIntervals = [buildGapInterval(10, 20, 'unreliable')];
    const result = joinUnreliableIntervals(gapIntervals, []);

    expect(result.gapAdjacent).toEqual([]);
    expect(result.violations).toBe(1);
  });

  it('a segment inside no \'unreliable\' interval gives violations 1', () => {
    const segment = buildSegment(10, 20, 'gap-adjacent');
    const result = joinUnreliableIntervals([], [segment]);

    expect(result.gapAdjacent).toEqual([]);
    expect(result.violations).toBe(1);
  });

  it('hidden-pause and isolated-jump segments add to notClassifiableCount and never appear in gapAdjacent', () => {
    const gapIntervals = [buildGapInterval(10, 20, 'unreliable'), buildGapInterval(30, 40, 'unreliable')];
    const hiddenPauseSeg = buildSegment(10, 20, 'hidden-pause');
    const isolatedJumpSeg = buildSegment(30, 40, 'isolated-jump');
    const result = joinUnreliableIntervals(gapIntervals, [hiddenPauseSeg, isolatedJumpSeg]);

    expect(result.gapAdjacent).toEqual([]);
    expect(result.notClassifiableCount).toBe(2);
    expect(result.violations).toBe(0);
  });

  it('is total: null/undefined gapIntervals or segments returns the zeroed result rather than throwing', () => {
    expect(() => joinUnreliableIntervals(null as unknown as GapInterval[], [])).not.toThrow();
    expect(joinUnreliableIntervals(null as unknown as GapInterval[], [])).toEqual({
      gapAdjacent: [],
      notClassifiableCount: 0,
      violations: 0,
    });
    expect(() => joinUnreliableIntervals([], null as unknown as UnreliableSegment[])).not.toThrow();
  });

  it('on real 3475724402, the join is exhaustive (zero violations) and every gap-adjacent segment is classified', () => {
    const stream = readStream('3475724402');
    const { coverage, segments } = classifyGapsWithSegments(stream.t, stream.d);
    const result = joinUnreliableIntervals(coverage.gapIntervals, segments);

    expect(result.violations).toBe(0);
    expect(result.gapAdjacent.length).toBeGreaterThan(0); // reachability
  });

  it("on real 3475740390, all five isolated-jump segments are counted not-classifiable and none appear in gapAdjacent (Pitfall 1's warning sign)", () => {
    const stream = readStream('3475740390');
    const { coverage, segments } = classifyGapsWithSegments(stream.t, stream.d);
    const result = joinUnreliableIntervals(coverage.gapIntervals, segments);

    expect(segments.length).toBeGreaterThan(0); // reachability
    expect(segments.every((s) => s.mechanism === 'isolated-jump')).toBe(true); // measured fact of this fixture
    expect(result.gapAdjacent).toEqual([]);
    expect(result.notClassifiableCount).toBe(segments.length);
    expect(result.violations).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// collectPauseIntervals — the three sources, D-03 no duration floor
// ---------------------------------------------------------------------------

describe('collectPauseIntervals', () => {
  it("a raw 'recording-gap' interval's metres equals d[index of endSec] - d[index of startSec], including a short 12 s gap (D-03 no duration floor)", () => {
    const t: number[] = [0];
    const d: number[] = [0];
    for (let i = 0; i < 30; i++) {
      t.push(t[t.length - 1] + 1);
      d.push(d[d.length - 1] + 3);
    }
    t.push(t[t.length - 1] + 12); // 12 s recording gap — shorter than the old 30 s v2.2 rule
    d.push(d[d.length - 1] + 1); // a small advance during the gap
    for (let i = 0; i < 30; i++) {
      t.push(t[t.length - 1] + 1);
      d.push(d[d.length - 1] + 3);
    }

    const { coverage, segments } = classifyGapsWithSegments(t, d);
    const result = collectPauseIntervals(t, d, coverage, segments);

    const gapEntries = result.intervals.filter((iv) => iv.source === 'recording-gap');
    expect(gapEntries.length).toBe(1);
    expect(gapEntries[0].seconds).toBe(12);
    expect(gapEntries[0].metres).toBe(1);
    expect(gapEntries[0].startMetres).toBe(90);
  });

  it("a merged-segment interval uses the segment's own metres/seconds, on real 3475724402", () => {
    const stream = readStream('3475724402');
    const { coverage, segments } = classifyGapsWithSegments(stream.t, stream.d);
    const result = collectPauseIntervals(stream.t, stream.d, coverage, segments);

    const mergedEntries = result.intervals.filter((iv) => iv.source === 'merged-segment');
    expect(mergedEntries.length).toBeGreaterThan(0); // reachability

    const gapAdjacentSegments = segments.filter((s) => s.mechanism === 'gap-adjacent');
    for (const entry of mergedEntries) {
      const matchingSegment = gapAdjacentSegments.find(
        (s) => s.startSec === entry.startSec && s.endSec === entry.endSec
      );
      expect(matchingSegment).toBeDefined();
      expect(entry.metres).toBe(matchingSegment!.metres);
      expect(entry.seconds).toBe(matchingSegment!.seconds);
    }
  });

  it("a 'pause' interval gets source 'zero-advance-pause' with its own metres (0 on a true zero-advance run)", () => {
    const t: number[] = [0];
    const d: number[] = [0];
    for (let i = 0; i < 30; i++) {
      t.push(t[t.length - 1] + 1);
      d.push(d[d.length - 1] + 3);
    }
    for (let i = 0; i < 60; i++) {
      t.push(t[t.length - 1] + 1);
      d.push(d[d.length - 1]); // flat — zero advance
    }
    for (let i = 0; i < 30; i++) {
      t.push(t[t.length - 1] + 1);
      d.push(d[d.length - 1] + 3);
    }

    const { coverage, segments } = classifyGapsWithSegments(t, d);
    const result = collectPauseIntervals(t, d, coverage, segments);

    const pauseEntries = result.intervals.filter((iv) => iv.source === 'zero-advance-pause');
    expect(pauseEntries.length).toBe(1);
    expect(pauseEntries[0].metres).toBe(0);
    expect(pauseEntries[0].seconds).toBe(60);
  });

  it('startMetres = d at the interval\'s start sample, and output is sorted by startSec, on real 3475724402', () => {
    const stream = readStream('3475724402');
    const { coverage, segments } = classifyGapsWithSegments(stream.t, stream.d);
    const result = collectPauseIntervals(stream.t, stream.d, coverage, segments);

    expect(result.intervals.length).toBeGreaterThan(0); // reachability
    for (let i = 1; i < result.intervals.length; i++) {
      expect(result.intervals[i].startSec).toBeGreaterThanOrEqual(result.intervals[i - 1].startSec);
    }
    const indexByTime = new Map<number, number>();
    for (let i = 0; i < stream.t.length; i++) indexByTime.set(stream.t[i], i);
    for (const interval of result.intervals) {
      const idx = indexByTime.get(interval.startSec);
      if (idx !== undefined) {
        expect(interval.startMetres).toBe(stream.d[idx]);
      }
    }
  });

  it('is total: null t/d, mismatched lengths and null coverage return the empty result rather than throwing', () => {
    expect(() => collectPauseIntervals(null as unknown as number[], [1, 2], null as unknown as PaceCoverage, [])).not.toThrow();
    expect(collectPauseIntervals(null as unknown as number[], [1, 2], null as unknown as PaceCoverage, [])).toEqual({
      intervals: [],
      notClassifiableCount: 0,
      joinViolations: 0,
    });

    const mismatchedT = [0, 1, 2];
    const mismatchedD = [0, 1];
    const { coverage, segments } = classifyGapsWithSegments(mismatchedT, mismatchedD);
    expect(() => collectPauseIntervals(mismatchedT, mismatchedD, coverage, segments)).not.toThrow();
    expect(collectPauseIntervals(mismatchedT, mismatchedD, coverage, segments).intervals).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// classifyPauseSpeed / isTransported — D-02, D-05
// ---------------------------------------------------------------------------

describe('classifyPauseSpeed and isTransported', () => {
  it('classifies the inclusive/strict ladder exactly per TEST_BANDS {stationaryMaxMps: 0.5, walkRunMps: 2.0}', () => {
    expect(classifyPauseSpeed(0.5, 1, TEST_BANDS)).toBe('stationary'); // inclusive
    expect(classifyPauseSpeed(0.51, 1, TEST_BANDS)).toBe('walked');
    expect(classifyPauseSpeed(2.0, 1, TEST_BANDS)).toBe('walked'); // inclusive
    expect(classifyPauseSpeed(2.01, 1, TEST_BANDS)).toBe('ran-through');
    expect(classifyPauseSpeed(UNRELIABLE_SPEED_LIMIT_MPS, 1, TEST_BANDS)).toBe('ran-through'); // inclusive top rung
    expect(classifyPauseSpeed(UNRELIABLE_SPEED_LIMIT_MPS + 0.01, 1, TEST_BANDS)).toBe('transported');
  });

  it('returns null on seconds <= 0 or a non-finite input', () => {
    expect(classifyPauseSpeed(5, 0, TEST_BANDS)).toBeNull();
    expect(classifyPauseSpeed(5, -1, TEST_BANDS)).toBeNull();
    expect(classifyPauseSpeed(NaN, 1, TEST_BANDS)).toBeNull();
    expect(classifyPauseSpeed(5, NaN, TEST_BANDS)).toBeNull();
    expect(classifyPauseSpeed(Infinity, 1, TEST_BANDS)).toBeNull();
  });

  it('isTransported(m, s) === (classifyPauseSpeed(m, s, anyBands) === \'transported\') for every probe', () => {
    const probes: [number, number][] = [
      [0.1, 1],
      [0.5, 1],
      [0.51, 1],
      [2.0, 1],
      [2.01, 1],
      [UNRELIABLE_SPEED_LIMIT_MPS, 1],
      [UNRELIABLE_SPEED_LIMIT_MPS + 0.01, 1],
      [100, 1],
      [5, 0],
      [5, -1],
      [NaN, 1],
      [5, NaN],
    ];
    for (const [metres, seconds] of probes) {
      expect(isTransported(metres, seconds)).toBe(classifyPauseSpeed(metres, seconds, TEST_BANDS) === 'transported');
    }
  });
});

// ---------------------------------------------------------------------------
// classifyPauses — D-01 composition
// ---------------------------------------------------------------------------

describe('classifyPauses', () => {
  it("gives zero-advance-pause intervals 'stationary' WITHOUT calling the speed test, proven by an interval whose metres/seconds would otherwise band 'walked'", () => {
    // Hand-built coverage: a 'pause'-kind interval whose boundary samples
    // show a substantial d advance (1.0 m/s over 60 s = 1.0 m/s, which
    // would band 'walked' under TEST_BANDS if the speed test ran). This is
    // semantically inconsistent with a genuine zero-advance pause — that is
    // deliberate: it proves classifyPauses skips the speed test entirely
    // for this source, rather than merely happening to agree with it.
    const t = [0, 60];
    const d = [0, 60]; // 1.0 m/s over the 'pause' interval if speed-tested
    const coverage: PaceCoverage = {
      spanSec: 60,
      coveredSec: 0,
      recordingGapSec: 0,
      pauseSec: 60,
      unreliableSec: 0,
      gapIntervals: [{ startSec: 0, endSec: 60, kind: 'pause' }],
    };
    const result = classifyPauses(t, d, coverage, [], TEST_BANDS);

    expect(result.intervals.length).toBe(1);
    expect(result.intervals[0].source).toBe('zero-advance-pause');
    expect(result.intervals[0].pauseClass).toBe('stationary');
  });

  it('on real 3475740390, no merged-segment interval appears and all five isolated-jump segments are not-classifiable (D-01)', () => {
    const stream = readStream('3475740390');
    const { coverage, segments } = classifyGapsWithSegments(stream.t, stream.d);
    const result = classifyPauses(stream.t, stream.d, coverage, segments, TEST_BANDS);

    expect(result.intervals.some((iv) => iv.source === 'merged-segment')).toBe(false);
    expect(result.notClassifiableCount).toBe(segments.length);
    expect(segments.length).toBeGreaterThan(0); // reachability
  });

  it('on real 3475724402, every classified interval carries a valid PauseClass and at least one is merged-segment', () => {
    const stream = readStream('3475724402');
    const { coverage, segments } = classifyGapsWithSegments(stream.t, stream.d);
    const result = classifyPauses(stream.t, stream.d, coverage, segments, TEST_BANDS);

    expect(result.intervals.some((iv) => iv.source === 'merged-segment')).toBe(true);
    for (const interval of result.intervals) {
      expect(['stationary', 'walked', 'ran-through', 'transported']).toContain(interval.pauseClass);
    }
  });
});

// ---------------------------------------------------------------------------
// recordingMechanismSignature — D-10
// ---------------------------------------------------------------------------

describe('recordingMechanismSignature', () => {
  /** dt constant (1 s), dd deterministically varying and always positive — a time-triggered signature. */
  function buildTimeTriggeredStream(steps: number): { t: number[]; d: number[] } {
    const t: number[] = [0];
    const d: number[] = [0];
    for (let i = 1; i <= steps; i++) {
      t.push(t[t.length - 1] + 1);
      const increment = 3 + ((i * 37) % 11);
      d.push(d[d.length - 1] + increment);
    }
    return { t, d };
  }

  /** dd constant (10 m), dt deterministically varying and always positive — a distance-triggered signature. */
  function buildDistanceTriggeredStream(steps: number): { t: number[]; d: number[] } {
    const t: number[] = [0];
    const d: number[] = [0];
    for (let i = 1; i <= steps; i++) {
      const dtVal = 1 + ((i * 17) % 5);
      t.push(t[t.length - 1] + dtVal);
      d.push(d[d.length - 1] + 10);
    }
    return { t, d };
  }

  it('a synthetic time-triggered stream (dt constant 1 s, dd varying) gives distanceTriggered false', () => {
    const { t, d } = buildTimeTriggeredStream(35);
    const result = recordingMechanismSignature(t, d);

    expect(result.computable).toBe(true);
    if (result.computable) expect(result.distanceTriggered).toBe(false);
  });

  it('a synthetic distance-triggered stream (dd constant 10 m, dt varying) gives distanceTriggered true', () => {
    const { t, d } = buildDistanceTriggeredStream(35);
    const result = recordingMechanismSignature(t, d);

    expect(result.computable).toBe(true);
    if (result.computable) expect(result.distanceTriggered).toBe(true);
  });

  it('fewer than SIGNATURE_MIN_COVERED_PAIRS qualifying pairs gives computable false with reason NOT_COMPUTABLE_TOO_FEW_SIGNATURE_PAIRS', () => {
    const { t, d } = buildTimeTriggeredStream(SIGNATURE_MIN_COVERED_PAIRS - 20);
    const result = recordingMechanismSignature(t, d);

    expect(result).toEqual({ computable: false, reason: NOT_COMPUTABLE_TOO_FEW_SIGNATURE_PAIRS });
  });

  it('3475740390 gives distanceTriggered true (boolean only, research cv values are references)', () => {
    const stream = readStream('3475740390');
    const result = recordingMechanismSignature(stream.t, stream.d);

    expect(result.computable).toBe(true);
    if (result.computable) expect(result.distanceTriggered).toBe(true);
  });

  it.each(['3475724402', '3475734189', '4556693525'])(
    '%s gives distanceTriggered false (boolean only, research cv values are references)',
    (id) => {
      const stream = readStream(id);
      const result = recordingMechanismSignature(stream.t, stream.d);

      expect(result.computable).toBe(true);
      if (result.computable) expect(result.distanceTriggered).toBe(false);
    }
  );

  it('is total: null t/d returns computable false rather than throwing', () => {
    expect(() => recordingMechanismSignature(null as unknown as number[], null as unknown as number[])).not.toThrow();
    expect(recordingMechanismSignature(null as unknown as number[], null as unknown as number[])).toEqual({
      computable: false,
      reason: NOT_COMPUTABLE_TOO_FEW_SIGNATURE_PAIRS,
    });
  });

  it('exposes its three pre-declared constants unchanged from 34-RESEARCH.md § D-10', () => {
    expect(DISTANCE_TRIGGERED_MAX_CV_DD).toBe(0.2);
    expect(DISTANCE_TRIGGERED_MAX_CV_RATIO).toBe(0.8);
    expect(SIGNATURE_MIN_COVERED_PAIRS).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// findCreepStretches — D-09
// ---------------------------------------------------------------------------

describe('findCreepStretches', () => {
  /** 30 s @ 3 m/s running, 60 s @ 0.1 m/s creep, 30 s @ 3 m/s running — dense 1 Hz, one continuous covered run. */
  function buildRunCreepRunStream(): { t: number[]; d: number[] } {
    const t: number[] = [0];
    const d: number[] = [0];
    for (let i = 0; i < 30; i++) {
      t.push(t[t.length - 1] + 1);
      d.push(d[d.length - 1] + 3);
    }
    for (let i = 0; i < 60; i++) {
      t.push(t[t.length - 1] + 1);
      d.push(d[d.length - 1] + 0.1);
    }
    for (let i = 0; i < 30; i++) {
      t.push(t[t.length - 1] + 1);
      d.push(d[d.length - 1] + 3);
    }
    return { t, d };
  }

  it('gives exactly one covered-creep stretch at maxSpeedMps 0.3 / minSec 30, and none at maxSpeedMps 0.05', () => {
    const { t, d } = buildRunCreepRunStream();
    const { coveredRuns } = classifyGapsWithSegments(t, d);
    expect(coveredRuns.length).toBe(1); // reachability — one continuous covered run

    const stretches = findCreepStretches(t, d, coveredRuns, 0.3, 30);
    expect(stretches.length).toBe(1);
    expect(stretches[0].source).toBe('covered-creep');

    const noStretches = findCreepStretches(t, d, coveredRuns, 0.05, 30);
    expect(noStretches).toEqual([]);
  });

  it('never spans a covered-run boundary: two 20 s creep runs separated by a 15 s recording gap give no stretch at minSec 30, even though their combined near-zero span (55 s) would otherwise qualify', () => {
    const t: number[] = [0];
    const d: number[] = [0];
    for (let i = 0; i < 20; i++) {
      t.push(t[t.length - 1] + 1);
      d.push(d[d.length - 1] + 0.1);
    }
    t.push(t[t.length - 1] + 15); // 15 s recording gap
    d.push(d[d.length - 1]);
    for (let i = 0; i < 20; i++) {
      t.push(t[t.length - 1] + 1);
      d.push(d[d.length - 1] + 0.1);
    }

    const { coverage, coveredRuns } = classifyGapsWithSegments(t, d);
    expect(coverage.gapIntervals.some((gi) => gi.kind === 'recording-gap')).toBe(true); // reachability
    expect(coveredRuns.length).toBe(2); // reachability — two separate covered runs

    const stretches = findCreepStretches(t, d, coveredRuns, 0.3, 30);
    expect(stretches).toEqual([]);
  });

  it('is total: null t/d/coveredRuns returns [] rather than throwing', () => {
    expect(() => findCreepStretches(null as unknown as number[], [1, 2], [], 0.3, 30)).not.toThrow();
    expect(findCreepStretches(null as unknown as number[], [1, 2], [], 0.3, 30)).toEqual([]);
    expect(findCreepStretches([1, 2], [1, 2], null as unknown as CoveredRun[], 0.3, 30)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// classifyForgottenStop — D-09, D-10, D-11
// ---------------------------------------------------------------------------

describe('classifyForgottenStop', () => {
  it('recording gaps never appear in either list (D-09), and \'pause\' intervals appear in pauses with source zero-advance-pause', () => {
    const t: number[] = [0];
    const d: number[] = [0];
    for (let i = 0; i < 30; i++) {
      t.push(t[t.length - 1] + 1);
      d.push(d[d.length - 1] + 3);
    }
    t.push(t[t.length - 1] + 15); // recording gap
    d.push(d[d.length - 1]);
    for (let i = 0; i < 30; i++) {
      t.push(t[t.length - 1] + 1);
      d.push(d[d.length - 1] + 3);
    }
    for (let i = 0; i < 60; i++) {
      t.push(t[t.length - 1] + 1);
      d.push(d[d.length - 1]); // flat — zero advance, will classify as 'pause'
    }
    for (let i = 0; i < 30; i++) {
      t.push(t[t.length - 1] + 1);
      d.push(d[d.length - 1] + 3);
    }

    const { coverage, coveredRuns } = classifyGapsWithSegments(t, d);
    expect(coverage.gapIntervals.some((gi) => gi.kind === 'recording-gap')).toBe(true); // reachability
    expect(coverage.gapIntervals.some((gi) => gi.kind === 'pause')).toBe(true); // reachability

    const result = classifyForgottenStop(t, d, coverage, coveredRuns, { stationaryMaxMps: 0.3, minSec: 30 });

    expect(result.computable).toBe(true);
    if (result.computable) {
      expect(result.pauses.length).toBe(1);
      expect(result.pauses[0].source).toBe('zero-advance-pause');
      expect(result.pauses.every((p) => p.source !== 'recording-gap')).toBe(true);
      expect(result.creep.every((c) => c.source !== 'recording-gap')).toBe(true);
    }
  });

  it('3475740390 gives { computable: false, reason: NOT_COMPUTABLE_DISTANCE_TRIGGERED }', () => {
    const stream = readStream('3475740390');
    const { coverage, coveredRuns } = classifyGapsWithSegments(stream.t, stream.d);

    const result = classifyForgottenStop(stream.t, stream.d, coverage, coveredRuns, {
      stationaryMaxMps: 0.3,
      minSec: 30,
    });

    expect(result).toEqual({ computable: false, reason: NOT_COMPUTABLE_DISTANCE_TRIGGERED });
  });

  it('is total: invalid input never throws', () => {
    expect(() =>
      classifyForgottenStop(
        null as unknown as number[],
        null as unknown as number[],
        null as unknown as PaceCoverage,
        null as unknown as CoveredRun[],
        { stationaryMaxMps: 0.3, minSec: 30 }
      )
    ).not.toThrow();

    const result = classifyForgottenStop(
      null as unknown as number[],
      null as unknown as number[],
      null as unknown as PaceCoverage,
      null as unknown as CoveredRun[],
      { stationaryMaxMps: 0.3, minSec: 30 }
    );
    expect(result).toEqual({ computable: false, reason: NOT_COMPUTABLE_TOO_FEW_SIGNATURE_PAIRS });
  });
});

// ---------------------------------------------------------------------------
// shipped from 34-CALIBRATION (plan 34-06 Task 2) — the equality guard.
// Named so `-t "shipped from 34-CALIBRATION"` selects it (33-14 precedent).
// ---------------------------------------------------------------------------

describe('shipped from 34-CALIBRATION', () => {
  const ARTIFACT_PATH = path.join(
    '.planning',
    'phases',
    '34-pause-classification-forgotten-stop',
    '34-CALIBRATION.md'
  );
  const SOURCE_PATH = path.join('src', 'analytics', 'pause-classification.ts');

  function readArtifact(): string {
    if (!fs.existsSync(ARTIFACT_PATH)) {
      throw new Error(
        `Missing ${ARTIFACT_PATH} — likely a milestone-archival \`git mv\` moved this phase's ` +
          "directory; update this test's ARTIFACT_PATH to the archived location. Never skip this test."
      );
    }
    return fs.readFileSync(ARTIFACT_PATH, 'utf8');
  }

  function readSource(): string {
    return fs.readFileSync(SOURCE_PATH, 'utf8');
  }

  const CASES: { name: string; exportValue: number }[] = [
    { name: 'STATIONARY_MAX_SPEED_MPS', exportValue: STATIONARY_MAX_SPEED_MPS },
    { name: 'WALK_RUN_BOUNDARY_MPS', exportValue: WALK_RUN_BOUNDARY_MPS },
    { name: 'FORGOTTEN_STOP_MIN_SEC', exportValue: FORGOTTEN_STOP_MIN_SEC },
  ];

  it.each(CASES)(
    '$name: the artifact line-anchored value equals the export numerically AND matches the source text literal character-for-character',
    ({ name, exportValue }) => {
      const artifactContent = readArtifact();
      const artifactPattern = new RegExp(`^${name} = ([0-9.]+)$`, 'm');
      const artifactMatch = artifactPattern.exec(artifactContent);
      if (artifactMatch === null) {
        throw new Error(
          `Expected a line-anchored "${name} = <value>" line in ${ARTIFACT_PATH} — a re-run of the ` +
            'generator landing on its own HALT branch (never shipping a line) is the likely cause; ' +
            'never skip, never silently pass.'
        );
      }
      const artifactLiteral = artifactMatch[1];

      const sourceContent = readSource();
      const sourcePattern = new RegExp(`export const ${name} = ([0-9.]+);`);
      const sourceMatch = sourcePattern.exec(sourceContent);
      if (sourceMatch === null) {
        throw new Error(`Could not find "export const ${name} = <literal>;" in ${SOURCE_PATH}.`);
      }
      const sourceLiteral = sourceMatch[1];

      // Numeric equality against the runtime export (parses correctly, not just textually).
      expect(Number(artifactLiteral)).toBe(exportValue);
      // Character-for-character against the SOURCE TEXT literal, never a runtime String(value),
      // which would silently normalise away a trailing-zero mismatch a plain numeric check misses.
      expect(sourceLiteral).toBe(artifactLiteral);
    }
  );

  it("the artifact's UNRELIABLE_SPEED_LIMIT_MPS line equals the imported constant", () => {
    const artifactContent = readArtifact();
    const match = /^UNRELIABLE_SPEED_LIMIT_MPS = ([0-9.]+) \(imported, 32-CALIBRATION\.md\)$/m.exec(
      artifactContent
    );
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(IMPORTED_UNRELIABLE_SPEED_LIMIT_MPS);
  });

  it('SHIPPED_PAUSE_BANDS deep-equals { stationaryMaxMps: STATIONARY_MAX_SPEED_MPS, walkRunMps: WALK_RUN_BOUNDARY_MPS } (D-07: one constant referenced, never a repeated literal)', () => {
    expect(SHIPPED_PAUSE_BANDS).toEqual({
      stationaryMaxMps: STATIONARY_MAX_SPEED_MPS,
      walkRunMps: WALK_RUN_BOUNDARY_MPS,
    });
  });

  it('SHIPPED_STOP_PARAMS deep-equals { stationaryMaxMps: STATIONARY_MAX_SPEED_MPS, minSec: FORGOTTEN_STOP_MIN_SEC } (D-07: the same stationary constant reference as SHIPPED_PAUSE_BANDS)', () => {
    expect(SHIPPED_STOP_PARAMS).toEqual({
      stationaryMaxMps: STATIONARY_MAX_SPEED_MPS,
      minSec: FORGOTTEN_STOP_MIN_SEC,
    });
    expect(SHIPPED_STOP_PARAMS.stationaryMaxMps).toBe(SHIPPED_PAUSE_BANDS.stationaryMaxMps);
  });
});

// ---------------------------------------------------------------------------
// walking-break control (STOP-02 / D-12 / D-21) — the developer-confirmed
// negative control(s), read from 34-WALKING-BREAK-CONTROL.md /
// 34-WALKING-BREAK-EVIDENCE.md at test time, never pinned as literals here.
// ---------------------------------------------------------------------------

describe('walking-break control', () => {
  const CONTROL_PATH = path.join(
    '.planning',
    'phases',
    '34-pause-classification-forgotten-stop',
    '34-WALKING-BREAK-CONTROL.md'
  );
  const EVIDENCE_PATH = path.join(
    '.planning',
    'phases',
    '34-pause-classification-forgotten-stop',
    '34-WALKING-BREAK-EVIDENCE.md'
  );

  interface ConfirmedControl {
    id: string;
    startSec: number;
    endSec: number;
  }

  /** Reads every `CONFIRMED_CONTROL: <id> t=<start>-<end>` line — never fewer than one, per D-12. */
  function readConfirmedControls(): ConfirmedControl[] {
    const content = fs.readFileSync(CONTROL_PATH, 'utf8');
    const pattern = /^CONFIRMED_CONTROL: (\d+) t=(\d+)-(\d+)$/gm;
    const controls: ConfirmedControl[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      controls.push({ id: match[1], startSec: Number(match[2]), endSec: Number(match[3]) });
    }
    return controls;
  }

  /** Parses a candidate's own "Aggregate (m/s)" figure from 34-WALKING-BREAK-EVIDENCE.md's Candidates table — never pinned as a literal in this file (1.264 / 1.512 / 1.797 are forbidden here). */
  function parseCandidateAggregateSpeed(id: string): number {
    const content = fs.readFileSync(EVIDENCE_PATH, 'utf8');
    const pattern = new RegExp(`^\\| ${id} \\| t=\\d+-\\d+ \\| \\d+ \\| [0-9.]+ \\| ([0-9.]+) \\|`, 'm');
    const match = pattern.exec(content);
    if (match === null) {
      throw new Error(`Expected a Candidates table row for ${id} in ${EVIDENCE_PATH}`);
    }
    return Number(match[1]);
  }

  /**
   * Direct in-test computation of the minimum aggregate speed over any
   * `minSec`-duration sub-window inside `[startSec, endSec]` — a fresh,
   * self-contained computation (never imports `findCreepStretches` or the
   * evidence generator's own `minWindowSpeed`), used only to derive the
   * CAN-FAIL threshold for the first control's reachability test below.
   */
  function minSubWindowSpeed(
    t: readonly number[],
    d: readonly number[],
    startSec: number,
    endSec: number,
    minSec: number
  ): number | null {
    let min: number | null = null;
    for (let i = 0; i < t.length; i++) {
      if (t[i] < startSec) continue;
      if (t[i] > endSec) break;
      let j = i;
      while (j < t.length - 1 && t[j] - t[i] < minSec) j++;
      if (t[j] - t[i] < minSec) continue;
      if (t[j] > endSec) continue;
      const duration = t[j] - t[i];
      const speed = (d[j] - d[i]) / duration;
      if (min === null || speed < min) min = speed;
    }
    return min;
  }

  function intersectsWindow(interval: { startSec: number; endSec: number }, control: ConfirmedControl): boolean {
    return interval.startSec < control.endSec && interval.endSec > control.startSec;
  }

  const confirmedControls = readConfirmedControls();

  it('reads at least one CONFIRMED_CONTROL line from 34-WALKING-BREAK-CONTROL.md (D-12)', () => {
    expect(confirmedControls.length).toBeGreaterThan(0);
  });

  it('the FIRST confirmed control (D-12 anchor) is computable and NOT flagged at SHIPPED_STOP_PARAMS, but IS flagged once stationaryMaxMps is raised just above its own minimum FORGOTTEN_STOP_MIN_SEC-duration sub-window speed — both directions in one test', () => {
    const first = confirmedControls[0];
    const stream = readStream(first.id);
    const { coverage, coveredRuns } = classifyGapsWithSegments(stream.t, stream.d);

    // Direction 1 (CAN PASS): at the shipped params, computable and no creep stretch intersects the window.
    const shippedResult = classifyForgottenStop(stream.t, stream.d, coverage, coveredRuns, SHIPPED_STOP_PARAMS);
    expect(shippedResult.computable).toBe(true);
    if (shippedResult.computable) {
      expect(shippedResult.creep.filter((c) => intersectsWindow(c, first))).toEqual([]);
    }

    // Direction 2 (CAN FAIL): raise stationaryMaxMps to just above the window's own measured
    // minimum FORGOTTEN_STOP_MIN_SEC sub-window speed — at least one stretch must then intersect.
    const minSpeed = minSubWindowSpeed(stream.t, stream.d, first.startSec, first.endSec, FORGOTTEN_STOP_MIN_SEC);
    expect(minSpeed).not.toBeNull();
    const raisedParams = { stationaryMaxMps: (minSpeed as number) + 0.01, minSec: FORGOTTEN_STOP_MIN_SEC };
    const raisedResult = classifyForgottenStop(stream.t, stream.d, coverage, coveredRuns, raisedParams);
    expect(raisedResult.computable).toBe(true);
    if (raisedResult.computable) {
      expect(raisedResult.creep.filter((c) => intersectsWindow(c, first)).length).toBeGreaterThan(0);
    }
  });

  it('across EVERY confirmed control (D-21), no control is flagged FOR ITS WALKING PACE — every flagged stretch intersecting a control\'s window is strictly BELOW that control\'s OWN parsed window aggregate speed (independent of the classifier), and CAN FAIL when stationaryMaxMps is raised to that same parsed speed', () => {
    const findings: string[] = [];

    for (const control of confirmedControls) {
      const windowSpeed = parseCandidateAggregateSpeed(control.id);
      const stream = readStream(control.id);
      const { coverage, coveredRuns } = classifyGapsWithSegments(stream.t, stream.d);

      // CAN PASS at the shipped params: every flagged stretch intersecting the window is
      // strictly below the control's own parsed window speed — never asserted as exactly zero.
      const shippedResult = classifyForgottenStop(stream.t, stream.d, coverage, coveredRuns, SHIPPED_STOP_PARAMS);
      expect(shippedResult.computable).toBe(true);
      if (shippedResult.computable) {
        const intersecting = shippedResult.creep.filter((c) => intersectsWindow(c, control));
        if (intersecting.length === 0) {
          findings.push(`${control.id}: not flagged at shipped params (window aggregate ${windowSpeed} m/s)`);
        }
        for (const stretch of intersecting) {
          const stretchSpeed = stretch.metres / stretch.seconds;
          expect(stretchSpeed).toBeLessThan(windowSpeed);
          findings.push(
            `${control.id}: flagged ${stretch.seconds}s stretch at ${stretchSpeed.toFixed(4)} m/s ` +
              `(control window aggregate ${windowSpeed} m/s) — reported as a finding, never an expected value`
          );
        }
      }

      // CAN FAIL: raise stationaryMaxMps to the control's own parsed window speed — at least one
      // flagged stretch must then cover the window at walking pace.
      const raisedParams = { stationaryMaxMps: windowSpeed, minSec: FORGOTTEN_STOP_MIN_SEC };
      const raisedResult = classifyForgottenStop(stream.t, stream.d, coverage, coveredRuns, raisedParams);
      expect(raisedResult.computable).toBe(true);
      if (raisedResult.computable) {
        expect(raisedResult.creep.filter((c) => intersectsWindow(c, control)).length).toBeGreaterThan(0);
      }
    }

    // eslint-disable-next-line no-console
    console.log('walking-break control findings (SUMMARY quotes these verbatim):\n' + findings.join('\n'));
  });

  it('DEFINITIONAL (regression tripwire only — cannot fail while findCreepStretches admits only such stretches by construction, pause-classification.ts:466 — proves nothing on its own): every flagged stretch on every confirmed control sits at or below SHIPPED_PAUSE_BANDS.stationaryMaxMps', () => {
    for (const control of confirmedControls) {
      const stream = readStream(control.id);
      const { coverage, coveredRuns } = classifyGapsWithSegments(stream.t, stream.d);
      const result = classifyForgottenStop(stream.t, stream.d, coverage, coveredRuns, SHIPPED_STOP_PARAMS);
      expect(result.computable).toBe(true);
      if (result.computable) {
        for (const stretch of result.creep) {
          expect(stretch.metres / stretch.seconds).toBeLessThanOrEqual(SHIPPED_PAUSE_BANDS.stationaryMaxMps);
        }
      }
    }
  });

  it("each confirmed control window's own aggregate speed classifies 'walked' under SHIPPED_PAUSE_BANDS", () => {
    for (const control of confirmedControls) {
      const stream = readStream(control.id);
      const startIdx = stream.t.indexOf(control.startSec);
      const endIdx = stream.t.indexOf(control.endSec);
      expect(startIdx).toBeGreaterThanOrEqual(0);
      expect(endIdx).toBeGreaterThan(startIdx);
      const seconds = stream.t[endIdx] - stream.t[startIdx];
      const metres = stream.d[endIdx] - stream.d[startIdx];
      expect(classifyPauseSpeed(metres, seconds, SHIPPED_PAUSE_BANDS)).toBe('walked');
    }
  });
});
