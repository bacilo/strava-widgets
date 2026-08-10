import { describe, expect, it } from 'vitest';

import {
  findBestEffort,
  isPlausible,
  markPRs,
  rankTopN,
  validateStreamSeries,
  WORLD_RECORD_SPEED_MPS,
} from './best-effort-utils.js';
import { TARGET_ORDER } from './best-effort.types.js';
import type { PRRankingEntry } from './best-effort.types.js';

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

describe('isPlausible — max_speed guard', () => {
  it('accepts a normal effort well under both ceilings', () => {
    const result = isPlausible(4.0, 5.5, 6.6);
    expect(result.ok).toBe(true);
  });

  it('rejects an effort faster than the activity own max_speed plus margin, naming both numbers', () => {
    const result = isPlausible(6.0, 5.0, 100);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('6.00');
      expect(result.reason).toContain('5.00');
    }
  });

  it('tolerates interpolation noise inside the 1.02 margin', () => {
    const result = isPlausible(5.05, 5.0, 100);
    expect(result.ok).toBe(true);
  });
});

describe('isPlausible — max_speed unavailable', () => {
  it('does not reject a normal effort when max_speed is 0 (activity 11865310195)', () => {
    const result = isPlausible(4.0, 0, 6.6);
    expect(result.ok).toBe(true);
  });

  it('does not reject a normal effort when max_speed is undefined (activity 11865310195)', () => {
    const result = isPlausible(4.0, undefined, 6.6);
    expect(result.ok).toBe(true);
  });

  it('still rejects a world-record-beating effort when max_speed is unavailable', () => {
    const result = isPlausible(8.0, 0, 6.62);
    expect(result.ok).toBe(false);
  });
});

describe('isPlausible — world-record ceiling', () => {
  it('rejects an effort faster than the world record even when max_speed would allow it, naming the ceiling', () => {
    const result = isPlausible(8.0, 20, 6.62);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('6.62');
    }
  });
});

describe('WORLD_RECORD_SPEED_MPS', () => {
  it('is strictly decreasing across TARGET_ORDER and every entry is finite and positive', () => {
    for (let i = 0; i < TARGET_ORDER.length; i++) {
      const speed = WORLD_RECORD_SPEED_MPS[TARGET_ORDER[i]];
      expect(Number.isFinite(speed)).toBe(true);
      expect(speed).toBeGreaterThan(0);
      if (i > 0) {
        const prevSpeed = WORLD_RECORD_SPEED_MPS[TARGET_ORDER[i - 1]];
        expect(speed).toBeLessThan(prevSpeed);
      }
    }
  });
});

describe('markPRs', () => {
  it('marks the first effort chronologically as a PR', () => {
    const result = markPRs([{ startDate: '2024-01-01T00:00:00Z', durationSec: 100 }]);
    expect(result[0].wasPRAtTheTime).toBe(true);
  });

  it('marks a later faster effort as a PR', () => {
    const result = markPRs([
      { startDate: '2024-01-01T00:00:00Z', durationSec: 100 },
      { startDate: '2024-02-01T00:00:00Z', durationSec: 90 },
    ]);
    expect(result[0].wasPRAtTheTime).toBe(true);
    expect(result[1].wasPRAtTheTime).toBe(true);
  });

  it('does not mark a later slower effort as a PR', () => {
    const result = markPRs([
      { startDate: '2024-01-01T00:00:00Z', durationSec: 90 },
      { startDate: '2024-02-01T00:00:00Z', durationSec: 100 },
    ]);
    expect(result[0].wasPRAtTheTime).toBe(true);
    expect(result[1].wasPRAtTheTime).toBe(false);
  });

  it('orders by startDate, not input order (reverse-chronological input yields same marking)', () => {
    const chronological = markPRs([
      { startDate: '2024-01-01T00:00:00Z', durationSec: 100 },
      { startDate: '2024-02-01T00:00:00Z', durationSec: 90 },
      { startDate: '2024-03-01T00:00:00Z', durationSec: 95 },
    ]);
    const reversed = markPRs([
      { startDate: '2024-03-01T00:00:00Z', durationSec: 95 },
      { startDate: '2024-02-01T00:00:00Z', durationSec: 90 },
      { startDate: '2024-01-01T00:00:00Z', durationSec: 100 },
    ]);

    const chronoByDate = new Map(chronological.map((e) => [e.startDate, e.wasPRAtTheTime]));
    const reversedByDate = new Map(reversed.map((e) => [e.startDate, e.wasPRAtTheTime]));
    expect(chronoByDate).toEqual(reversedByDate);
  });

  it('marks an exactly-equal-time later effort as NOT a PR (ties do not set a new record)', () => {
    const result = markPRs([
      { startDate: '2024-01-01T00:00:00Z', durationSec: 100 },
      { startDate: '2024-02-01T00:00:00Z', durationSec: 100 },
    ]);
    expect(result[0].wasPRAtTheTime).toBe(true);
    expect(result[1].wasPRAtTheTime).toBe(false);
  });
});

describe('rankTopN', () => {
  function entry(overrides: Partial<Omit<PRRankingEntry, 'rank'>>): Omit<PRRankingEntry, 'rank'> {
    return {
      activityId: 'a',
      startDate: '2024-01-01T00:00:00Z',
      durationSec: 100,
      paceSecPerKm: 300,
      lowConfidence: false,
      ...overrides,
    };
  }

  it('returns entries sorted fastest-first with 1-based rank, truncated to N', () => {
    const efforts = [
      entry({ activityId: 'slow', durationSec: 200 }),
      entry({ activityId: 'fast', durationSec: 90 }),
      entry({ activityId: 'mid', durationSec: 150 }),
    ];
    const result = rankTopN(efforts, 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ rank: 1, activityId: 'fast' });
    expect(result[1]).toMatchObject({ rank: 2, activityId: 'mid' });
  });

  it('breaks a duration tie in favour of the earlier startDate', () => {
    const efforts = [
      entry({ activityId: 'later', durationSec: 100, startDate: '2024-02-01T00:00:00Z' }),
      entry({ activityId: 'earlier', durationSec: 100, startDate: '2024-01-01T00:00:00Z' }),
    ];
    const result = rankTopN(efforts, 2);
    expect(result[0]).toMatchObject({ rank: 1, activityId: 'earlier' });
    expect(result[1]).toMatchObject({ rank: 2, activityId: 'later' });
  });
});
