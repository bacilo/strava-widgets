import { describe, expect, it } from 'vitest';

import { advanceSteps, type GapSpan } from './unreliable-segments.js';

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
