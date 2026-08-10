import { describe, expect, it } from 'vitest';

import { findBestEffort, validateStreamSeries } from './best-effort-utils.js';

describe('findBestEffort — two-pointer sweep', () => {
  it('finds the minimum-duration window covering the target distance', () => {
    // d crosses 200 -> 400 in 1s (t=2 to t=3); that is the fastest 200m window.
    const t = [0, 1, 2, 3, 4];
    const d = [0, 100, 200, 400, 500];
    const result = findBestEffort(t, d, 200);
    expect(result?.durationSec).toBe(1);
  });

  it('returns undefined when the series never covers the target distance', () => {
    const t = [0, 1];
    const d = [0, 100];
    expect(findBestEffort(t, d, 500)).toBeUndefined();
  });

  it('returns undefined for a series with fewer than 2 samples', () => {
    expect(findBestEffort([0], [0], 100)).toBeUndefined();
    expect(findBestEffort([], [], 100)).toBeUndefined();
  });

  it('completes a 200,000-sample series in under 2 seconds (end pointer never resets backwards)', () => {
    const n = 200_000;
    const t = new Array<number>(n);
    const d = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      t[i] = i; // 1 s spacing
      d[i] = i * 3; // 3 m per sample
    }

    const start = Date.now();
    const result = findBestEffort(t, d, 5000);
    const elapsedMs = Date.now() - start;

    expect(result).toBeDefined();
    expect(elapsedMs).toBeLessThan(2000);
  });
});

describe('findBestEffort — exact-crossing interpolation', () => {
  it('interpolates at the exact crossing instead of snapping to the next sample', () => {
    // Target 50 sits halfway between d=0 (t=0) and d=100 (t=10) -> crossing at t=5.
    const t = [0, 10];
    const d = [0, 100];
    const result = findBestEffort(t, d, 50);
    expect(result?.durationSec).toBe(5);
    expect(result?.endOffsetSec).toBe(5);
  });
});

describe('findBestEffort — pause gaps', () => {
  it('is timestamp-indexed, not index-indexed, across a real pause in t', () => {
    // 10-minute pause after the second sample (t jumps 2 -> 600).
    const t = [0, 1, 2, 600, 601, 602];
    const d = [0, 100, 200, 200, 300, 400];
    const result = findBestEffort(t, d, 400);
    expect(result?.durationSec).toBe(602);
  });

  it('does not let a pause corrupt a window that lies entirely inside one moving segment', () => {
    const t = [0, 1, 2, 600, 601, 602];
    const d = [0, 100, 200, 200, 300, 400];
    const result = findBestEffort(t, d, 200);
    expect(result?.durationSec).toBe(2);
  });
});

describe('validateStreamSeries', () => {
  it('rejects a length mismatch between t and d, naming both lengths', () => {
    const result = validateStreamSeries([0, 1, 2], [0, 100]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('3');
      expect(result.reason).toContain('2');
    }
  });

  it('rejects a non-finite value in either array, naming the index', () => {
    const result = validateStreamSeries([0, 1, NaN], [0, 100, 200]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('2');
    }
  });

  it('rejects a non-finite value in d, naming the index', () => {
    const result = validateStreamSeries([0, 1, 2], [0, 100, Infinity]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('2');
    }
  });

  it('rejects a decreasing d value, naming the index and both distances', () => {
    const result = validateStreamSeries([0, 1, 2], [0, 200, 100]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('200');
      expect(result.reason).toContain('100');
    }
  });

  it('rejects a decreasing t value, naming the index', () => {
    const result = validateStreamSeries([0, 2, 1], [0, 100, 200]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('2');
    }
  });

  it('rejects a series with fewer than 2 samples, naming the count', () => {
    const result = validateStreamSeries([0], [0]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('1');
    }
  });

  it('accepts a well-formed series including equal consecutive d values (a standstill)', () => {
    const result = validateStreamSeries([0, 1, 2, 3], [0, 100, 100, 200]);
    expect(result.ok).toBe(true);
  });

  it('accepts a well-formed series including equal consecutive t values', () => {
    const result = validateStreamSeries([0, 1, 1, 2], [0, 100, 150, 200]);
    expect(result.ok).toBe(true);
  });
});
