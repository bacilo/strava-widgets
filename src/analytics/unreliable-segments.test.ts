import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  advanceSteps,
  detectUnreliableSegments,
  DEFAULT_DETECTOR_PARAMS,
  HIDDEN_PAUSE_MIN_METRES,
  UNRELIABLE_EXCESS_FLOOR_M,
  UNRELIABLE_SPEED_LIMIT_MPS,
  type AdvanceStep,
  type DetectorParams,
  type GapSpan,
  type UnreliableSegment,
} from './unreliable-segments.js';
import { classifyGaps } from './pace-derivation.js';

/** Reads a committed stream file from `data/streams/` — never the derived stats output. */
function readStream(activityId: string): { t: number[]; d: number[] } {
  return JSON.parse(
    fs.readFileSync(path.join('data/streams', `${activityId}.json`), 'utf-8')
  ) as { t: number[]; d: number[] };
}

describe('advanceSteps', () => {
  it('a full/zero alternation beginning with a zero pair yields exactly three folded 8m/2s steps', () => {
    const t = [0, 1, 2, 3, 4, 5, 6];
    const d = [0, 0, 8, 8, 16, 16, 24];

    const steps = advanceSteps(t, d, []);

    expect(steps).toEqual([
      { startIndex: 0, endIndex: 2, startSec: 0, endSec: 2, metres: 8, seconds: 2 },
      { startIndex: 2, endIndex: 4, startSec: 2, endSec: 4, metres: 8, seconds: 2 },
      { startIndex: 4, endIndex: 6, startSec: 4, endSec: 6, metres: 8, seconds: 2 },
    ]);
  });

  it('a zero-duration advancing pair folds into the next pair, so no step has zero seconds', () => {
    const t = [0, 0, 1];
    const d = [0, 5, 10];

    const steps = advanceSteps(t, d, []);

    expect(steps).toEqual([
      { startIndex: 0, endIndex: 2, startSec: 0, endSec: 1, metres: 10, seconds: 1 },
    ]);
    for (const step of steps) {
      expect(step.seconds).toBeGreaterThan(0);
    }
  });

  it('a gap pair discards a pending step and resets the start to the gap end sample', () => {
    const t = [0, 1, 2, 3, 4];
    const d = [0, 0, 10, 15, 20];
    const gaps: GapSpan[] = [{ startSec: 1, endSec: 2 }];

    const steps = advanceSteps(t, d, gaps);

    // The pending zero-advance pair [0,1] is discarded by the gap at [1,2],
    // never leaking into a later step. The first step after the gap starts
    // exactly on the gap's own end sample (index 2).
    expect(steps).toEqual([
      { startIndex: 2, endIndex: 3, startSec: 2, endSec: 3, metres: 5, seconds: 1 },
      { startIndex: 3, endIndex: 4, startSec: 3, endSec: 4, metres: 5, seconds: 1 },
    ]);
  });

  it('genuinely advancing consecutive covered pairs each emit their own step (no over-folding)', () => {
    const t = [0, 1, 2, 3];
    const d = [0, 10, 20, 30];

    const steps = advanceSteps(t, d, []);

    expect(steps).toEqual([
      { startIndex: 0, endIndex: 1, startSec: 0, endSec: 1, metres: 10, seconds: 1 },
      { startIndex: 1, endIndex: 2, startSec: 1, endSec: 2, metres: 10, seconds: 1 },
      { startIndex: 2, endIndex: 3, startSec: 2, endSec: 3, metres: 10, seconds: 1 },
    ]);
  });

  it('invalid input returns a fresh empty array (two calls return distinct array objects)', () => {
    const t = [1];
    const d = [1];

    const first = advanceSteps(t, d, []);
    const second = advanceSteps(t, d, []);

    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(first).not.toBe(second);
  });
});

describe('detectUnreliableSegments — adjacency and chaining (D-06/D-07)', () => {
  const params: DetectorParams = {
    speedLimitMps: 5,
    excessFloorMetres: 2,
    hiddenPauseMinMetres: 100,
  };

  it('leading-side case: [clean, clean, fast, fast | gap | clean] gives one segment, burst first', () => {
    const t = [0, 1, 2, 3, 4, 5, 15, 16];
    const d = [0, 3, 6, 16, 26, 26, 26, 29];
    const gaps: GapSpan[] = [{ startSec: 4, endSec: 5 }];

    const segments = detectUnreliableSegments(t, d, gaps, params);

    expect(segments).toHaveLength(1);
    const seg = segments[0];
    expect(seg.mechanism).toBe('gap-adjacent');
    expect(seg.burstCount).toBe(1);
    expect(seg.gapCount).toBe(1);
    expect(seg.parts[0].kind).toBe('burst');
    expect(seg.parts[1].kind).toBe('gap');
  });

  it('trailing-side case: [clean | gap | fast, clean] gives the gap then the burst', () => {
    const t = [0, 1, 2, 3, 4];
    const d = [0, 3, 3, 13, 16];
    const gaps: GapSpan[] = [{ startSec: 1, endSec: 2 }];

    const segments = detectUnreliableSegments(t, d, gaps, params);

    expect(segments).toHaveLength(1);
    const seg = segments[0];
    expect(seg.mechanism).toBe('gap-adjacent');
    expect(seg.burstCount).toBe(1);
    expect(seg.gapCount).toBe(1);
    expect(seg.parts[0].kind).toBe('gap');
    expect(seg.parts[1].kind).toBe('burst');
  });

  it('both sides: [fast | gap | fast] gives ONE segment with parts burst, gap, burst', () => {
    const t = [0, 1, 2, 3];
    const d = [0, 10, 10, 20];
    const gaps: GapSpan[] = [{ startSec: 1, endSec: 2 }];

    const segments = detectUnreliableSegments(t, d, gaps, params);

    expect(segments).toHaveLength(1);
    const seg = segments[0];
    expect(seg.mechanism).toBe('gap-adjacent');
    expect(seg.burstCount).toBe(2);
    expect(seg.gapCount).toBe(1);
    expect(seg.parts.map((p) => p.kind)).toEqual(['burst', 'gap', 'burst']);
  });

  it('chain: [fast | gapA | fast | gapB | clean] gives ONE segment with gapCount 2, burstCount 2', () => {
    const t = [0, 1, 2, 3, 4, 5];
    const d = [0, 10, 10, 20, 20, 23];
    const gaps: GapSpan[] = [
      { startSec: 1, endSec: 2 },
      { startSec: 3, endSec: 4 },
    ];

    const segments = detectUnreliableSegments(t, d, gaps, params);

    expect(segments).toHaveLength(1);
    const seg = segments[0];
    expect(seg.mechanism).toBe('gap-adjacent');
    expect(seg.burstCount).toBe(2);
    expect(seg.gapCount).toBe(2);
    expect(seg.parts.map((p) => p.kind)).toEqual(['burst', 'gap', 'burst', 'gap']);
    // Clean sample after gapB does not extend the chain.
    expect(seg.endIndex).toBe(4);
  });

  it('not swallowed: [fast | gapA | fast, CLEAN, fast | gapB] gives TWO segments', () => {
    const t = [0, 1, 2, 3, 4, 5, 6, 7];
    const d = [0, 10, 10, 20, 23, 33, 33, 36];
    const gaps: GapSpan[] = [
      { startSec: 1, endSec: 2 },
      { startSec: 5, endSec: 6 },
    ];

    const segments = detectUnreliableSegments(t, d, gaps, params);

    expect(segments).toHaveLength(2);
    expect(segments[0].burstCount).toBe(2);
    expect(segments[0].gapCount).toBe(1);
    expect(segments[0].endIndex).toBe(3);
    expect(segments[1].burstCount).toBe(1);
    expect(segments[1].gapCount).toBe(1);
    expect(segments[1].startIndex).toBe(4);
  });

  it('near miss: [fast, CLEAN | gap] gives a no-gap segment, not gap-adjacent', () => {
    const t = [0, 1, 2, 3, 4];
    const d = [0, 10, 13, 13, 16];
    const gaps: GapSpan[] = [{ startSec: 2, endSec: 3 }];

    const segments = detectUnreliableSegments(t, d, gaps, params);

    expect(segments).toHaveLength(1);
    const seg = segments[0];
    expect(seg.mechanism).not.toBe('gap-adjacent');
    expect(seg.gapCount).toBe(0);
    expect(seg.burstCount).toBe(1);
  });
});

describe('detectUnreliableSegments — excess floor (D-09)', () => {
  it('a run with excess 4 and floor 5 gives []', () => {
    const t = [0, 2];
    const d = [0, 14];
    const params: DetectorParams = {
      speedLimitMps: 5,
      excessFloorMetres: 5,
      hiddenPauseMinMetres: 1000,
    };

    const segments = detectUnreliableSegments(t, d, [], params);

    expect(segments).toEqual([]);
  });

  it('the same run with floor 3 gives one isolated-jump segment', () => {
    const t = [0, 2];
    const d = [0, 14];
    const params: DetectorParams = {
      speedLimitMps: 5,
      excessFloorMetres: 3,
      hiddenPauseMinMetres: 1000,
    };

    const segments = detectUnreliableSegments(t, d, [], params);

    expect(segments).toHaveLength(1);
    expect(segments[0].mechanism).toBe('isolated-jump');
  });

  it('admits the smallest named jump (24.7m in 2s at a limit well below its implied speed)', () => {
    // Regression fixture per D-09: the floor must still admit 24.7 m in 2 s
    // (12.35 m/s) against a limit well below that speed.
    const t = [0, 2];
    const d = [0, 24.7];
    const params: DetectorParams = {
      speedLimitMps: 5,
      excessFloorMetres: 3,
      hiddenPauseMinMetres: 1000,
    };

    const segments = detectUnreliableSegments(t, d, [], params);

    expect(segments).toHaveLength(1);
  });
});

describe('detectUnreliableSegments — mechanism labelling (D-03/D-08)', () => {
  it('a burst touching a gap is gap-adjacent regardless of metres', () => {
    const t = [0, 1, 2];
    const d = [0, 0, 10];
    const gaps: GapSpan[] = [{ startSec: 0, endSec: 1 }];
    const params: DetectorParams = {
      speedLimitMps: 5,
      excessFloorMetres: 2,
      hiddenPauseMinMetres: 100,
    };

    const segments = detectUnreliableSegments(t, d, gaps, params);

    expect(segments).toHaveLength(1);
    expect(segments[0].mechanism).toBe('gap-adjacent');
  });

  it('a no-gap segment at or above hiddenPauseMinMetres is hidden-pause', () => {
    const t = [0, 2];
    const d = [0, 70];
    const params: DetectorParams = {
      speedLimitMps: 5,
      excessFloorMetres: 2,
      hiddenPauseMinMetres: 50,
    };

    const segments = detectUnreliableSegments(t, d, [], params);

    expect(segments).toHaveLength(1);
    expect(segments[0].mechanism).toBe('hidden-pause');
    expect(segments[0].metres).toBeGreaterThanOrEqual(50);
  });

  it('a no-gap segment below hiddenPauseMinMetres is isolated-jump', () => {
    const t = [0, 2];
    const d = [0, 14];
    const params: DetectorParams = {
      speedLimitMps: 5,
      excessFloorMetres: 2,
      hiddenPauseMinMetres: 50,
    };

    const segments = detectUnreliableSegments(t, d, [], params);

    expect(segments).toHaveLength(1);
    expect(segments[0].mechanism).toBe('isolated-jump');
    expect(segments[0].metres).toBeLessThan(50);
  });

  it('SegmentMechanism has exactly three members reachable from the detector', () => {
    const seen = new Set<string>();

    // gap-adjacent
    seen.add(
      detectUnreliableSegments(
        [0, 1, 2],
        [0, 0, 10],
        [{ startSec: 0, endSec: 1 }],
        { speedLimitMps: 5, excessFloorMetres: 2, hiddenPauseMinMetres: 100 }
      )[0].mechanism
    );
    // hidden-pause
    seen.add(
      detectUnreliableSegments([0, 2], [0, 70], [], {
        speedLimitMps: 5,
        excessFloorMetres: 2,
        hiddenPauseMinMetres: 50,
      })[0].mechanism
    );
    // isolated-jump
    seen.add(
      detectUnreliableSegments([0, 2], [0, 14], [], {
        speedLimitMps: 5,
        excessFloorMetres: 2,
        hiddenPauseMinMetres: 50,
      })[0].mechanism
    );

    expect(seen).toEqual(new Set(['gap-adjacent', 'hidden-pause', 'isolated-jump']));
  });
});

describe('detectUnreliableSegments — run-level scoring (SEG-01 decimation aliasing and diluted slews)', () => {
  it('a diluted slew (five consecutive 1s steps at 9 m/s, limit 6, floor 5) gives one segment', () => {
    const t = [0, 1, 2, 3, 4, 5];
    const d = [0, 9, 18, 27, 36, 45];
    const params: DetectorParams = {
      speedLimitMps: 6,
      excessFloorMetres: 5,
      hiddenPauseMinMetres: 1000,
    };

    const segments = detectUnreliableSegments(t, d, [], params);

    expect(segments).toHaveLength(1);
    expect(segments[0].burstCount).toBe(1);
    expect(segments[0].burstMetres).toBe(45);
    expect(segments[0].burstSeconds).toBe(5);
  });

  it('each individual 1s pair of the diluted slew is itself under 10.44 m/s (context, not a rule)', () => {
    // 9 m/s < WORLD_RECORD_100M_SPEED_MPS (10.44) — the slew is only caught
    // because run-level aggregate scoring sums across steps, never because
    // any single pair alone crosses a per-sample ceiling.
    const perPairSpeedMps = 9;
    expect(perPairSpeedMps).toBeLessThan(10.44);
  });

  it('decimation aliasing: a full/zero alternation folded to 4 m/s does not fire at limit 6', () => {
    const t = [0, 1, 2, 3, 4, 5, 6];
    const d = [0, 0, 8, 8, 16, 16, 24];
    const params: DetectorParams = {
      speedLimitMps: 6,
      excessFloorMetres: 1,
      hiddenPauseMinMetres: 1000,
    };

    const segments = detectUnreliableSegments(t, d, [], params);

    expect(segments).toEqual([]);
  });
});

/**
 * This block covers FIELD-level malformation only — NaN/Infinity/negative values, or too-short/
 * mismatched arrays, on an otherwise well-shaped object. SHAPE-level malformation (a non-array
 * `t`/`d`/`gaps`, a non-object entry inside `gaps`, or a non-object `params`) lives in the
 * dedicated "shape-level" block below (gap closure 32-11, 32-VERIFICATION.md gap #1).
 */
describe('detectUnreliableSegments — total function', () => {
  const validParams: DetectorParams = {
    speedLimitMps: 5,
    excessFloorMetres: 2,
    hiddenPauseMinMetres: 50,
  };

  it('invalid t/d (too few samples) returns []', () => {
    expect(detectUnreliableSegments([1], [1], [], validParams)).toEqual([]);
  });

  it('invalid t/d (length mismatch) returns []', () => {
    expect(detectUnreliableSegments([0, 1, 2], [0, 1], [], validParams)).toEqual([]);
  });

  it.each([
    ['speedLimitMps = 0', { ...validParams, speedLimitMps: 0 }],
    ['speedLimitMps negative', { ...validParams, speedLimitMps: -5 }],
    ['speedLimitMps NaN', { ...validParams, speedLimitMps: NaN }],
    ['speedLimitMps Infinity', { ...validParams, speedLimitMps: Infinity }],
    ['excessFloorMetres negative', { ...validParams, excessFloorMetres: -1 }],
    ['excessFloorMetres NaN', { ...validParams, excessFloorMetres: NaN }],
    ['excessFloorMetres Infinity', { ...validParams, excessFloorMetres: Infinity }],
    ['hiddenPauseMinMetres negative', { ...validParams, hiddenPauseMinMetres: -1 }],
    ['hiddenPauseMinMetres NaN', { ...validParams, hiddenPauseMinMetres: NaN }],
    ['hiddenPauseMinMetres Infinity', { ...validParams, hiddenPauseMinMetres: Infinity }],
  ])('malformed params (%s) returns [] and never throws', (_label, params) => {
    const t = [0, 1, 2, 3];
    const d = [0, 10, 20, 30];
    expect(() => detectUnreliableSegments(t, d, [], params as DetectorParams)).not.toThrow();
    expect(detectUnreliableSegments(t, d, [], params as DetectorParams)).toEqual([]);
  });

  it.each([
    ['non-finite startSec', { startSec: NaN, endSec: 2 }],
    ['non-finite endSec', { startSec: 1, endSec: Infinity }],
    ['endSec <= startSec', { startSec: 2, endSec: 1 }],
    ['bounds matching no sample time', { startSec: 0.5, endSec: 1.5 }],
  ])('malformed gap span (%s) returns [] and never throws', (_label, gap) => {
    const t = [0, 1, 2, 3];
    const d = [0, 10, 20, 30];
    expect(() => detectUnreliableSegments(t, d, [gap], validParams)).not.toThrow();
    expect(detectUnreliableSegments(t, d, [gap], validParams)).toEqual([]);
  });

  it('conservation holds for every segment produced by the adjacency fixtures (within 1e-9)', () => {
    const cases: Array<[number[], number[], GapSpan[]]> = [
      [
        [0, 1, 2, 3, 4, 5, 15, 16],
        [0, 3, 6, 16, 26, 26, 26, 29],
        [{ startSec: 4, endSec: 5 }],
      ],
      [
        [0, 1, 2, 3, 4],
        [0, 3, 3, 13, 16],
        [{ startSec: 1, endSec: 2 }],
      ],
      [
        [0, 1, 2, 3],
        [0, 10, 10, 20],
        [{ startSec: 1, endSec: 2 }],
      ],
      [
        [0, 1, 2, 3, 4, 5],
        [0, 10, 10, 20, 20, 23],
        [
          { startSec: 1, endSec: 2 },
          { startSec: 3, endSec: 4 },
        ],
      ],
    ];
    const params: DetectorParams = {
      speedLimitMps: 5,
      excessFloorMetres: 2,
      hiddenPauseMinMetres: 100,
    };

    let assertedAtLeastOneSegment = false;
    for (const [t, d, gaps] of cases) {
      const segments = detectUnreliableSegments(t, d, gaps, params);
      for (const seg of segments) {
        assertedAtLeastOneSegment = true;
        expect(Math.abs(seg.metres - (seg.burstMetres + seg.gapMetres))).toBeLessThan(1e-9);
        expect(Math.abs(seg.seconds - (seg.burstSeconds + seg.gapSeconds))).toBeLessThan(1e-9);
        for (let i = 1; i < seg.parts.length; i++) {
          expect(seg.parts[i].startIndex).toBe(seg.parts[i - 1].endIndex);
        }
      }
    }
    expect(assertedAtLeastOneSegment).toBe(true);
  });
});

/**
 * Shape-level total-function regression (gap closure 32-11, 32-VERIFICATION.md gap #1).
 *
 * The `detectUnreliableSegments — total function` block above covers FIELD-level malformation on
 * an otherwise well-shaped object only (NaN/Infinity/negative on a valid input). It does not cover
 * SHAPE-level malformation — a non-array `t`/`d`/`gaps`, a non-object entry inside `gaps`, or a
 * non-object `params` — which is exactly what 32-VERIFICATION.md's gap #1 reproduced directly
 * against the shipped `dist/analytics/unreliable-segments.js`: three untyped `.mjs` consumers
 * (`compute-unreliable-segment-calibration.mjs`, `validate-unreliable-segments-1hz.mjs`) call this
 * module with `JSON.parse`'d, unvalidated on-disk data, so a null/non-array argument here is a
 * reachable production input shape, not a theoretical one.
 */
describe('detectUnreliableSegments — total function, shape-level malformation (gap closure 32-11)', () => {
  const t = [0, 1, 2, 3];
  const d = [0, 10, 20, 30];
  const validParams: DetectorParams = {
    speedLimitMps: 5,
    excessFloorMetres: 2,
    hiddenPauseMinMetres: 50,
  };

  describe('detectUnreliableSegments', () => {
    it.each([
      ['gaps = null', null],
      ['gaps = undefined', undefined],
      ["gaps = 'nope'", 'nope'],
      ['gaps = 42', 42],
      ['gaps = {} (non-array object)', {}],
    ])('malformed gaps (%s) returns [] and never throws', (_label, gaps) => {
      expect(() =>
        detectUnreliableSegments(t, d, gaps as unknown as GapSpan[], validParams)
      ).not.toThrow();
      expect(detectUnreliableSegments(t, d, gaps as unknown as GapSpan[], validParams)).toEqual(
        []
      );
    });

    it.each([
      ['[null]', [null]],
      ['[undefined]', [undefined]],
      ['[42]', [42]],
      ["['nope']", ['nope']],
      ['well-formed entry followed by null', [{ startSec: 1, endSec: 2 }, null]],
    ])('malformed gaps entry (%s) returns [] and never throws', (_label, gaps) => {
      expect(() =>
        detectUnreliableSegments(t, d, gaps as unknown as GapSpan[], validParams)
      ).not.toThrow();
      expect(detectUnreliableSegments(t, d, gaps as unknown as GapSpan[], validParams)).toEqual(
        []
      );
    });

    it.each([
      ['params = null', null],
      ["params = 'nope'", 'nope'],
      ['params = 42', 42],
    ])('malformed params (%s) returns [] and never throws', (_label, params) => {
      expect(() =>
        detectUnreliableSegments(t, d, [], params as unknown as DetectorParams)
      ).not.toThrow();
      expect(detectUnreliableSegments(t, d, [], params as unknown as DetectorParams)).toEqual([]);
    });

    it.each([
      ['t=null, d=null', null, null],
      ['t=null, d=valid', null, d],
      ['t=valid, d=null', t, null],
      ["t='x', d='y'", 'x', 'y'],
      ['t={}, d={}', {}, {}],
    ])('malformed t/d (%s) returns [] and never throws', (_label, tArg, dArg) => {
      expect(() =>
        detectUnreliableSegments(
          tArg as unknown as number[],
          dArg as unknown as number[],
          [],
          validParams
        )
      ).not.toThrow();
      expect(
        detectUnreliableSegments(
          tArg as unknown as number[],
          dArg as unknown as number[],
          [],
          validParams
        )
      ).toEqual([]);
    });
  });

  describe('advanceSteps', () => {
    it.each([
      ['gaps = null', null],
      ['gaps = undefined', undefined],
      ["gaps = 'nope'", 'nope'],
      ['gaps = 42', 42],
      ['gaps = {} (non-array object)', {}],
      ['gaps = [null]', [null]],
    ])('malformed gaps (%s) returns [] and never throws', (_label, gaps) => {
      expect(() => advanceSteps(t, d, gaps as unknown as GapSpan[])).not.toThrow();
      expect(advanceSteps(t, d, gaps as unknown as GapSpan[])).toEqual([]);
    });

    it.each([
      ['t=null, d=null', null, null],
      ['t=null, d=valid', null, d],
      ['t=valid, d=null', t, null],
      ["t='x', d='y'", 'x', 'y'],
      ['t={}, d={}', {}, {}],
    ])('malformed t/d (%s) returns [] and never throws', (_label, tArg, dArg) => {
      expect(() =>
        advanceSteps(tArg as unknown as number[], dArg as unknown as number[], [])
      ).not.toThrow();
      expect(
        advanceSteps(tArg as unknown as number[], dArg as unknown as number[], [])
      ).toEqual([]);
    });
  });

  it('the empty result is a fresh array on every invalid call (detectUnreliableSegments)', () => {
    const first = detectUnreliableSegments(
      null as unknown as number[],
      null as unknown as number[],
      [],
      validParams
    );
    const second = detectUnreliableSegments(
      null as unknown as number[],
      null as unknown as number[],
      [],
      validParams
    );
    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(first).not.toBe(second);
  });

  it('the empty result is a fresh array on every invalid call (advanceSteps)', () => {
    const first = advanceSteps(t, d, null as unknown as GapSpan[]);
    const second = advanceSteps(t, d, null as unknown as GapSpan[]);
    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(first).not.toBe(second);
  });
});

/**
 * D-06/D-07 gap boundary convention regression (gap closure 32-13, 32-VERIFICATION.md gap #3).
 *
 * `validateStreamSeries` (`best-effort-utils.ts`) explicitly documents duplicate timestamps as
 * VALID input, and 72 of the 1,874 committed streams already carry them. The fixtures below are
 * the exact two activities 32-VERIFICATION.md's gap #3 reproduced against the shipped
 * `dist/analytics/unreliable-segments.js`. The invariant under test is derived from the phase
 * goal's own conservation requirement ("segments that conserve real distance/time") and D-07's
 * "clean samples are never swallowed" rule — NOT from agreement between `mapGapToIndices` and
 * `isGapPair`. Two functions agreeing with each other is not evidence that either is right; the
 * evidence is that neither a segment's conserved metres/seconds nor its mechanism label may
 * depend on an incidental duplicate sample sitting exactly on a gap boundary.
 */
describe('D-06/D-07 gap boundary convention — duplicate timestamps (gap closure 32-13)', () => {
  const params = DEFAULT_DETECTOR_PARAMS;
  const gaps: GapSpan[] = [{ startSec: 1, endSec: 13 }];

  it("fixture A — duplicate timestamp ON the gap's start boundary", () => {
    const t = [0, 1, 1, 13];
    const d = [0, 20, 20, 21];

    const segments = detectUnreliableSegments(t, d, gaps, params);

    expect(segments).toHaveLength(1);
    const seg = segments[0];
    expect(seg.mechanism).toBe('gap-adjacent');
    expect(seg.metres).toBe(21);
    expect(seg.seconds).toBe(13);
    expect(seg.gapCount).toBe(1);
    expect(seg.burstCount).toBe(1);
    expect(seg.burstMetres).toBe(20);
    expect(seg.gapMetres).toBe(1);
    expect(seg.burstSeconds).toBe(1);
    expect(seg.gapSeconds).toBe(12);
    expect(seg.startIndex).toBe(0);
    expect(seg.endIndex).toBe(3);
  });

  it('fixture B — the same activity without the duplicate sample', () => {
    const t = [0, 1, 13];
    const d = [0, 20, 21];

    const segments = detectUnreliableSegments(t, d, gaps, params);

    expect(segments).toHaveLength(1);
    const seg = segments[0];
    expect(seg.mechanism).toBe('gap-adjacent');
    expect(seg.metres).toBe(21);
    expect(seg.seconds).toBe(13);
    expect(seg.gapCount).toBe(1);
    expect(seg.burstCount).toBe(1);
    expect(seg.burstMetres).toBe(20);
    expect(seg.gapMetres).toBe(1);
    expect(seg.burstSeconds).toBe(1);
    expect(seg.gapSeconds).toBe(12);
    expect(seg.endIndex).toBe(2);
  });

  it('A and B agree on classification and every conserved total (indices legitimately differ)', () => {
    const a = detectUnreliableSegments([0, 1, 1, 13], [0, 20, 20, 21], gaps, params)[0];
    const b = detectUnreliableSegments([0, 1, 13], [0, 20, 21], gaps, params)[0];

    expect(a.mechanism).toBe(b.mechanism);
    expect(a.metres).toBe(b.metres);
    expect(a.seconds).toBe(b.seconds);
    expect(a.burstMetres).toBe(b.burstMetres);
    expect(a.gapMetres).toBe(b.gapMetres);
    expect(a.burstSeconds).toBe(b.burstSeconds);
    expect(a.gapSeconds).toBe(b.gapSeconds);
    expect(a.burstCount).toBe(b.burstCount);
    expect(a.gapCount).toBe(b.gapCount);
  });

  it('the pre-fix classification is impossible', () => {
    // The old LAST-at-startSec/FIRST-at-endSec convention produced one isolated-jump segment of
    // 20 m / 1 s with gapCount 0 for fixture A — the gap's own 1 m / 12 s silently dropped.
    const segments = detectUnreliableSegments([0, 1, 1, 13], [0, 20, 20, 21], gaps, params);

    for (const seg of segments) {
      expect(seg.mechanism).not.toBe('isolated-jump');
      expect(seg.gapCount).not.toBe(0);
    }
  });

  it("duplicate on the gap's END boundary is equally invariant", () => {
    const withDup = detectUnreliableSegments(
      [0, 1, 13, 13, 20],
      [0, 20, 21, 21, 25],
      gaps,
      params
    )[0];
    const withoutDup = detectUnreliableSegments([0, 1, 13, 20], [0, 20, 21, 25], gaps, params)[0];

    expect(withDup.mechanism).toBe(withoutDup.mechanism);
    expect(withDup.metres).toBe(withoutDup.metres);
    expect(withDup.seconds).toBe(withoutDup.seconds);
    expect(withDup.burstMetres).toBe(withoutDup.burstMetres);
    expect(withDup.gapMetres).toBe(withoutDup.gapMetres);
    expect(withDup.burstSeconds).toBe(withoutDup.burstSeconds);
    expect(withDup.gapSeconds).toBe(withoutDup.gapSeconds);
    expect(withDup.gapCount).toBe(withoutDup.gapCount);
  });

  it('conservation holds for every fixture in this block', () => {
    const cases: Array<[number[], number[]]> = [
      [[0, 1, 1, 13], [0, 20, 20, 21]],
      [[0, 1, 13], [0, 20, 21]],
      [[0, 1, 13, 13, 20], [0, 20, 21, 21, 25]],
      [[0, 1, 13, 20], [0, 20, 21, 25]],
    ];

    let reachable = false;
    for (const [t, d] of cases) {
      const segments = detectUnreliableSegments(t, d, gaps, params);
      for (const seg of segments) {
        reachable = true;
        expect(Math.abs(seg.metres - (seg.burstMetres + seg.gapMetres))).toBeLessThan(1e-9);
        expect(Math.abs(seg.seconds - (seg.burstSeconds + seg.gapSeconds))).toBeLessThan(1e-9);
        expect(seg.metres).toBe(d[seg.endIndex] - d[seg.startIndex]);
        expect(seg.seconds).toBe(t[seg.endIndex] - t[seg.startIndex]);
        for (let i = 1; i < seg.parts.length; i++) {
          expect(seg.parts[i].startIndex).toBe(seg.parts[i - 1].endIndex);
        }
      }
    }
    expect(reachable).toBe(true);
  });
});

/**
 * Real-stream named-activity regression fixtures (Phase 32 plan 08, ROADMAP criteria 1-3).
 *
 * These tests read REAL committed streams from `data/streams/<id>.json` (byte-pinned by the
 * D-17 immutability gate, `scripts/compute-stream-checksums.mjs`) via a local `readStream`
 * helper mirroring `pace-derivation.test.ts`'s own precedent — never a derived/gitignored
 * output. Every expected extent below (which pairs are "fast", which segment covers which
 * window) is computed IN THIS FILE from the raw `t`/`d` arrays using the shipped
 * `UNRELIABLE_SPEED_LIMIT_MPS` constant, never hand-typed from a prior run's output or from the
 * scoping probe's own throwaway numbers.
 *
 * NOT asserted anywhere below: the scoping probe's own throwaway per-sample burst/gap/metres/
 * seconds counts on 3475724402 (32-CONTEXT.md "Mechanism boundaries") — those are references to
 * reconcile against in `32-CALIBRATION.md`, never expected test values (D-16's reconciliation
 * table is the right place for that comparison, not this regression suite).
 *
 * D-01: no test here (or anywhere in this file) pins the Suunto over-measurement sample as a
 * must-not-fire fixture — it is disclosed in `32-CALIBRATION.md`, never asserted spared.
 */
describe('SEG-02 — 3475724402: every burst is gap-adjacent, both sides inspected (D-07)', () => {
  const { t, d } = readStream('3475724402');
  const gaps: GapSpan[] = classifyGaps(t, d).gapIntervals;
  const segments = detectUnreliableSegments(t, d, gaps, DEFAULT_DETECTOR_PARAMS);

  it('produces at least one segment (reachability) and every one is gap-adjacent', () => {
    expect(segments.length).toBeGreaterThan(0);
    for (const seg of segments) {
      expect(seg.mechanism).toBe('gap-adjacent');
    }
  });

  it('at least one segment has a burst part immediately followed by a gap part (leading side, D-07)', () => {
    const hasLeading = segments.some((seg) =>
      seg.parts.some((part, i) => part.kind === 'burst' && seg.parts[i + 1]?.kind === 'gap')
    );
    expect(hasLeading).toBe(true);
  });

  it('at least one segment has a gap part immediately followed by a burst part (trailing side, D-07)', () => {
    const hasTrailing = segments.some((seg) =>
      seg.parts.some((part, i) => part.kind === 'gap' && seg.parts[i + 1]?.kind === 'burst')
    );
    expect(hasTrailing).toBe(true);
  });

  it('conserves distance/time exactly and keeps every part chain contiguous, on every segment', () => {
    for (const seg of segments) {
      expect(seg.metres).toBeCloseTo(d[seg.endIndex] - d[seg.startIndex], 9);
      expect(seg.seconds).toBeCloseTo(t[seg.endIndex] - t[seg.startIndex], 9);
      expect(Math.abs(seg.burstMetres + seg.gapMetres - seg.metres)).toBeLessThan(1e-9);
      expect(Math.abs(seg.burstSeconds + seg.gapSeconds - seg.seconds)).toBeLessThan(1e-9);
      for (let i = 1; i < seg.parts.length; i++) {
        expect(seg.parts[i].startIndex).toBe(seg.parts[i - 1].endIndex);
      }
    }
  });
});

describe('SEG-03 mechanism — 3475734189 hidden pause at t=1353–1360', () => {
  const { t, d } = readStream('3475734189');
  const gaps: GapSpan[] = classifyGaps(t, d).gapIntervals;
  const segments = detectUnreliableSegments(t, d, gaps, DEFAULT_DETECTOR_PARAMS);

  // Computed from raw t/d, not hard-coded: every pair whose start sample time falls in
  // [1353, 1358] AND whose implied speed exceeds the shipped speed limit.
  const fastPairStartIndices: number[] = [];
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i] >= 1353 && t[i] <= 1358 && d[i + 1] - d[i] > UNRELIABLE_SPEED_LIMIT_MPS * (t[i + 1] - t[i])) {
      fastPairStartIndices.push(i);
    }
  }

  it('reachability: the computed fast-pair set inside t=[1353,1358] is non-empty', () => {
    expect(fastPairStartIndices.length).toBeGreaterThan(0);
  });

  it('exactly one segment covers every computed fast pair, labelled hidden-pause', () => {
    const minIndex = Math.min(...fastPairStartIndices);
    const maxIndex = Math.max(...fastPairStartIndices);

    const covering = segments.filter(
      (seg) => seg.startIndex <= minIndex && seg.endIndex >= maxIndex + 1
    );

    expect(covering).toHaveLength(1);
    expect(covering[0].mechanism).toBe('hidden-pause');
    expect(covering[0].metres).toBeGreaterThanOrEqual(HIDDEN_PAUSE_MIN_METRES);
  });
});

describe('SEG-03 mechanism — 3475740390 isolated jumps', () => {
  const { t, d } = readStream('3475740390');
  const gaps: GapSpan[] = classifyGaps(t, d).gapIntervals;
  const segments = detectUnreliableSegments(t, d, gaps, DEFAULT_DETECTOR_PARAMS);

  // The five named jump start times (32-CONTEXT.md "Suunto over-measurement" measurement); the
  // 32-05 Decision's disposition was `option-refixture`, not `option-amend-criterion-3`, so
  // ROADMAP criterion 3 / SEG-03 is unamended and all five remain mandatory must-flag items.
  const namedJumpStartTimes = [2347, 2508, 2536, 2580, 2587];

  function segmentContainingPairStartingAt(time: number): UnreliableSegment | undefined {
    const i = t.indexOf(time);
    expect(i).toBeGreaterThanOrEqual(0); // reachability: the named time must exist as a sample
    return segments.find((seg) => seg.startIndex <= i && seg.endIndex >= i + 1);
  }

  it.each(namedJumpStartTimes)('t=%d lies inside a segment labelled isolated-jump', (time) => {
    const seg = segmentContainingPairStartingAt(time);
    expect(seg).toBeDefined();
    expect(seg?.mechanism).toBe('isolated-jump');
  });

  it('t=2580 and t=2587 are separate segments when a clean step (computed from raw t/d) lies between them', () => {
    const i2580 = t.indexOf(2580);
    const i2587 = t.indexOf(2587);
    expect(i2580).toBeGreaterThanOrEqual(0);
    expect(i2587).toBeGreaterThanOrEqual(0);

    // Computed in-test: is there at least one pair strictly between the two jumps' own pairs
    // whose implied speed is at or below the shipped limit (a "clean step")?
    let hasCleanStepBetween = false;
    for (let i = i2580 + 1; i < i2587; i++) {
      if (d[i + 1] - d[i] <= UNRELIABLE_SPEED_LIMIT_MPS * (t[i + 1] - t[i])) {
        hasCleanStepBetween = true;
        break;
      }
    }
    expect(hasCleanStepBetween).toBe(true);

    const seg2580 = segmentContainingPairStartingAt(2580);
    const seg2587 = segmentContainingPairStartingAt(2587);
    expect(seg2580).toBeDefined();
    expect(seg2587).toBeDefined();
    expect(seg2580).not.toBe(seg2587);
  });
});

/**
 * Independently re-derives, from raw t/d alone via the exported `advanceSteps`, two measures
 * over `[startSec, endSec]`:
 *
 * - `vMax`: the single fastest overlapping run-level step's own implied speed (informational —
 *   the "one segment away" headroom figure the 32-05 record references).
 * - `maxRunExcess`: the maximum accumulated excess metres (`sum(metres) - speedLimitMps *
 *   sum(seconds)`) over any maximal contiguous run of individually-fast steps that touches the
 *   window — mirroring the shipped detector's own `isFastStep`/`groupFastRuns`/`excessMetres`
 *   discipline (`unreliable-segments.ts`), computed independently here since those helpers are
 *   not exported. `0` if no fast step touches the window at all.
 *
 * This file's Task 1 sibling proof (`pace-single-source.test.ts` SEG-05a audit) exists precisely
 * so this aggregate-over-a-run re-derivation cannot become a second implementation of the
 * detector's own banned comparison literals — this helper never repeats `metres > speedLimitMps
 * * seconds` or `metres - speedLimitMps * seconds` as bare text; it composes the same arithmetic
 * differently (accumulated over a run) for an audit purpose, matching the same discipline
 * `pace-single-source.test.ts` already applies to this file's other real-stream fixtures.
 *
 * `vMax` ALONE is not always the discriminator that protects a window: a window can have `vMax`
 * ABOVE the shipped speed limit and still never produce a segment, because `isFastStep` only
 * marks a SINGLE step fast — the significance floor (`excessFloorMetres`) judges the ACCUMULATED
 * excess of the run those fast steps chain into, not any one step's raw speed.
 */
function deriveWindowDiscriminators(
  allSteps: readonly AdvanceStep[],
  startSec: number,
  endSec: number,
  speedLimitMps: number
): { vMax: number; maxRunExcess: number; overlappingCount: number } {
  const overlapping = allSteps.filter((s) => s.startSec < endSec && s.endSec > startSec);
  const vMax = overlapping.length > 0 ? Math.max(...overlapping.map((s) => s.metres / s.seconds)) : -Infinity;

  let maxRunExcess = -Infinity;
  let runMetres = 0;
  let runSeconds = 0;
  let runTouchesWindow = false;
  let prevEndIndex: number | null = null;

  for (const step of allSteps) {
    const isFast = step.metres > speedLimitMps * step.seconds;
    const contiguous = prevEndIndex !== null && step.startIndex === prevEndIndex;
    const touches = step.startSec < endSec && step.endSec > startSec;
    if (isFast) {
      if (contiguous) {
        runMetres += step.metres;
        runSeconds += step.seconds;
        runTouchesWindow = runTouchesWindow || touches;
      } else {
        runMetres = step.metres;
        runSeconds = step.seconds;
        runTouchesWindow = touches;
      }
      if (runTouchesWindow) {
        maxRunExcess = Math.max(maxRunExcess, runMetres - speedLimitMps * runSeconds);
      }
    } else {
      runMetres = 0;
      runSeconds = 0;
      runTouchesWindow = false;
    }
    prevEndIndex = step.endIndex;
  }

  return {
    vMax,
    maxRunExcess: maxRunExcess === -Infinity ? 0 : maxRunExcess,
    overlappingCount: overlapping.length,
  };
}

describe('D-05 negative control — locked fixtures never fire, and can', () => {
  // Locked by the developer at the 32-05 blocking checkpoint (32-05-SUMMARY.md § Decision,
  // disposition `option-refixture`) — hand-coded here deliberately, NOT probe figures: these two
  // fixture spans are a developer decision, not a measurement this test re-derives.
  const lockedFixtures: Array<{ id: string; startSec: number; endSec: number }> = [
    { id: '7409028052', startSec: 586, endSec: 624 },
    { id: '3647739864', startSec: 945, endSec: 971 },
  ];

  it.each(lockedFixtures)('no segment overlaps the locked fixture $id t=$startSec-$endSec', ({ id, startSec, endSec }) => {
    const { t, d } = readStream(id);
    const gaps: GapSpan[] = classifyGaps(t, d).gapIntervals;
    const segments = detectUnreliableSegments(t, d, gaps, DEFAULT_DETECTOR_PARAMS);

    const overlapping = segments.filter(
      (seg) => seg.startSec < endSec && seg.endSec > startSec
    );
    expect(overlapping).toEqual([]);
  });

  // Reachability pair (32-VERIFICATION.md 2026-09-20 warning: "D-05 negative-control fixtures
  // assert only [], no reachability/non-vacuity check"). Both `vMax` and `maxRunExcess` are
  // derived in-test from raw t/d via `deriveWindowDiscriminators` above — never hand-typed. The
  // lowered-parameter variant is the red direction: proof each control CAN fire, so its green
  // state above is information, not vacuity. Both numbers are recorded in 32-15-SUMMARY.md,
  // including the DEVIATION this measurement uncovered: `vMax` alone is NOT always below the
  // shipped speed limit (measured 8.70 m/s for 7409028052, above the 7.35 m/s limit) — the
  // control instead holds because the run's own ACCUMULATED excess stays below the floor.
  it.each(lockedFixtures)(
    "reachability: $id's own measured window discriminators explain why DEFAULT_DETECTOR_PARAMS never fires here, and a lowered params variant DOES produce an overlapping segment",
    ({ id, startSec, endSec }) => {
      const { t, d } = readStream(id);
      const gaps: GapSpan[] = classifyGaps(t, d).gapIntervals;
      const steps = advanceSteps(t, d, gaps);

      const { vMax, maxRunExcess, overlappingCount } = deriveWindowDiscriminators(
        steps,
        startSec,
        endSec,
        UNRELIABLE_SPEED_LIMIT_MPS
      );
      expect(
        overlappingCount,
        `${id}: no advance step overlaps the locked window t=${startSec}-${endSec} — an empty window cannot be a control`
      ).toBeGreaterThan(0);

      // eslint-disable-next-line no-console
      console.log(
        `[D-05 reachability] ${id} vMax=${vMax.toFixed(4)} m/s (headroom=${(UNRELIABLE_SPEED_LIMIT_MPS - vMax).toFixed(4)} m/s), maxRunExcess=${maxRunExcess.toFixed(4)} m (headroom=${(UNRELIABLE_EXCESS_FLOOR_M - maxRunExcess).toFixed(4)} m)`
      );

      // The control holds under DEFAULT_DETECTOR_PARAMS iff EITHER no step in the window ever
      // individually clears the speed limit (vMax < limit, exercised by 3647739864 below), OR any
      // run that does clear it never accumulates enough excess to clear the floor (maxRunExcess <
      // floor, exercised by 7409028052). At least one of the two must hold, independently derived.
      const protectedBySpeed = vMax < UNRELIABLE_SPEED_LIMIT_MPS;
      // Only meaningful as a DISTINCT mechanism when a fast run actually exists (maxRunExcess > 0);
      // when no step in the window ever clears the limit, maxRunExcess is trivially 0, which is
      // NOT floor protection — it is the speed-limit case above with nothing for the floor to judge.
      const protectedByFloor = !protectedBySpeed && maxRunExcess < UNRELIABLE_EXCESS_FLOOR_M;
      expect(
        protectedBySpeed || protectedByFloor,
        `${id}: neither the speed limit nor the excess floor explains why this window does not fire — vMax=${vMax}, maxRunExcess=${maxRunExcess}`
      ).toBe(true);

      // Red direction: lower whichever parameter this window is ACTUALLY protected by, so the
      // lowered variant targets the real discriminator rather than a parameter this window's
      // control does not depend on.
      const loweredParams: DetectorParams = protectedByFloor
        ? { ...DEFAULT_DETECTOR_PARAMS, excessFloorMetres: maxRunExcess * 0.99 }
        : { ...DEFAULT_DETECTOR_PARAMS, speedLimitMps: vMax * 0.99, excessFloorMetres: 0 };
      const loweredSegments = detectUnreliableSegments(t, d, gaps, loweredParams);
      const loweredOverlapping = loweredSegments.filter(
        (seg) => seg.startSec < endSec && seg.endSec > startSec
      );
      expect(
        loweredOverlapping.length,
        `${id}: lowering the parameter this window is actually protected by must produce a segment overlapping the locked span — otherwise the control cannot fire under any input and provides no protection`
      ).toBeGreaterThan(0);
    }
  );
});

describe('D-09 negative control — 3475734189 t=1581-1583 never fires, and can', () => {
  const id = '3475734189';
  const startSec = 1581;
  const endSec = 1583;

  it('no segment overlaps the D-09 trivial pair span', () => {
    const { t, d } = readStream(id);
    const gaps: GapSpan[] = classifyGaps(t, d).gapIntervals;
    const segments = detectUnreliableSegments(t, d, gaps, DEFAULT_DETECTOR_PARAMS);

    const overlapping = segments.filter((seg) => seg.startSec < endSec && seg.endSec > startSec);
    expect(overlapping).toEqual([]);
  });

  // Same reachability pair as the D-05 block above, for the same reason (32-VERIFICATION.md
  // warning applies identically to the D-09 trivia control). 32-CONTEXT.md's own D-09 entry
  // states this fixture's 8.5/8.8 m/s pair sits ABOVE the shipped speed limit and is spared by
  // the excess floor alone — confirmed by measurement below (maxRunExcess, not vMax, is the
  // active discriminator here).
  it("reachability: the D-09 window's own measured discriminators explain why DEFAULT_DETECTOR_PARAMS never fires here, and a lowered params variant DOES produce an overlapping segment", () => {
    const { t, d } = readStream(id);
    const gaps: GapSpan[] = classifyGaps(t, d).gapIntervals;
    const steps = advanceSteps(t, d, gaps);

    const { vMax, maxRunExcess, overlappingCount } = deriveWindowDiscriminators(
      steps,
      startSec,
      endSec,
      UNRELIABLE_SPEED_LIMIT_MPS
    );
    expect(
      overlappingCount,
      `${id}: no advance step overlaps the locked window t=${startSec}-${endSec} — an empty window cannot be a control`
    ).toBeGreaterThan(0);

    // eslint-disable-next-line no-console
    console.log(
      `[D-09 reachability] ${id} vMax=${vMax.toFixed(4)} m/s (headroom=${(UNRELIABLE_SPEED_LIMIT_MPS - vMax).toFixed(4)} m/s), maxRunExcess=${maxRunExcess.toFixed(4)} m (headroom=${(UNRELIABLE_EXCESS_FLOOR_M - maxRunExcess).toFixed(4)} m)`
    );

    const protectedBySpeed = vMax < UNRELIABLE_SPEED_LIMIT_MPS;
    // Only meaningful as a DISTINCT mechanism when a fast run actually exists (maxRunExcess > 0);
    // when no step in the window ever clears the limit, maxRunExcess is trivially 0, which is
    // NOT floor protection — it is the speed-limit case above with nothing for the floor to judge.
    const protectedByFloor = !protectedBySpeed && maxRunExcess < UNRELIABLE_EXCESS_FLOOR_M;
    expect(
      protectedBySpeed || protectedByFloor,
      `${id}: neither the speed limit nor the excess floor explains why this window does not fire — vMax=${vMax}, maxRunExcess=${maxRunExcess}`
    ).toBe(true);

    const loweredParams: DetectorParams = protectedByFloor
      ? { ...DEFAULT_DETECTOR_PARAMS, excessFloorMetres: maxRunExcess * 0.99 }
      : { ...DEFAULT_DETECTOR_PARAMS, speedLimitMps: vMax * 0.99, excessFloorMetres: 0 };
    const loweredSegments = detectUnreliableSegments(t, d, gaps, loweredParams);
    const loweredOverlapping = loweredSegments.filter(
      (seg) => seg.startSec < endSec && seg.endSec > startSec
    );
    expect(
      loweredOverlapping.length,
      `${id}: lowering the parameter this window is actually protected by must produce a segment overlapping the locked span — otherwise the control cannot fire under any input and provides no protection`
    ).toBeGreaterThan(0);
  });
});
