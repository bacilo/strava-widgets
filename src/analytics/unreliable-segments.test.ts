import { describe, expect, it } from 'vitest';

import {
  advanceSteps,
  detectUnreliableSegments,
  type DetectorParams,
  type GapSpan,
} from './unreliable-segments.js';

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
