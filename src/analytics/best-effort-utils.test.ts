import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  findBestEffort,
  isPlausible,
  markPRs,
  rankTopN,
  validateStreamSeries,
  WORLD_RECORD_100M_SPEED_MPS,
  WORLD_RECORD_SPEED_MPS,
} from './best-effort-utils.js';
import { TARGET_METERS, TARGET_ORDER } from './best-effort.types.js';
import type { PRRankingEntry } from './best-effort.types.js';

/** Reads a committed stream file from `data/streams/` — never the derived stats output. */
function readStream(activityId: string): { t: number[]; d: number[] } {
  return JSON.parse(
    fs.readFileSync(path.join('data/streams', `${activityId}.json`), 'utf-8')
  ) as { t: number[]; d: number[] };
}

/** Every `available: true` activity id in the committed stream manifest. */
function readManifestAvailableIds(): string[] {
  const manifest = JSON.parse(
    fs.readFileSync(path.join('data/streams', 'manifest.json'), 'utf-8')
  ) as { activities: Record<string, { available: boolean }> };
  return Object.entries(manifest.activities)
    .filter(([, v]) => v.available)
    .map(([id]) => id);
}

describe('WORLD_RECORD_100M_SPEED_MPS', () => {
  it('is the 100m world-record floor, 10.44 m/s, declared standalone from WORLD_RECORD_SPEED_MPS', () => {
    expect(WORLD_RECORD_100M_SPEED_MPS).toBe(10.44);
  });

  it('adding WORLD_RECORD_100M_SPEED_MPS does not change WORLD_RECORD_SPEED_MPS\'s own key set', () => {
    expect(Object.keys(WORLD_RECORD_SPEED_MPS).sort()).toEqual(
      [...TARGET_ORDER].sort()
    );
    expect(Object.keys(WORLD_RECORD_SPEED_MPS)).not.toContain('100m');
  });
});

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

describe('validateStreamSeries — total for null/undefined/non-array input (D-08)', () => {
  it('does not throw for (null, null) and returns ok:false naming t', () => {
    const result = validateStreamSeries(null as never, null as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('t is not an array');
    }
  });

  it('does not throw for (null, [0,1]) and returns ok:false naming t', () => {
    const result = validateStreamSeries(null as never, [0, 1]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('t is not an array');
    }
  });

  it('does not throw for ([0,1], null) and returns ok:false naming d', () => {
    const result = validateStreamSeries([0, 1], null as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('d is not an array');
    }
  });

  it('does not throw for (undefined, undefined) and returns ok:false naming t', () => {
    const result = validateStreamSeries(undefined as never, undefined as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('t is not an array');
    }
  });

  it('does not throw for (undefined, [0,1]) and returns ok:false naming t', () => {
    const result = validateStreamSeries(undefined as never, [0, 1]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('t is not an array');
    }
  });

  it('does not throw for ([0,1], undefined) and returns ok:false naming d', () => {
    const result = validateStreamSeries([0, 1], undefined as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('d is not an array');
    }
  });

  it('does not throw for a non-array object ({} , []) and returns ok:false naming t', () => {
    const result = validateStreamSeries({} as never, [] as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('t is not an array');
    }
  });

  it('does not throw for a non-array number (42, 42) and returns ok:false naming t', () => {
    const result = validateStreamSeries(42 as never, 42 as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('t is not an array');
    }
  });
});

describe('validateStreamSeries — unchanged behaviour for already-covered input shapes (D-08)', () => {
  it('an equal-length valid series still returns exactly { ok: true }', () => {
    const result = validateStreamSeries([0, 1, 2, 3], [0, 100, 100, 200]);
    expect(result).toStrictEqual({ ok: true });
  });

  it('a length mismatch still returns the same reason string', () => {
    const result = validateStreamSeries([0, 1, 2], [0, 100]);
    expect(result).toStrictEqual({
      ok: false,
      reason: 't and d length mismatch: t has 3 samples, d has 2 samples',
    });
  });

  it('a fewer-than-2-samples series still returns the same reason string', () => {
    const result = validateStreamSeries([0], [0]);
    expect(result).toStrictEqual({
      ok: false,
      reason: 'series has 1 sample(s), at least 2 are required',
    });
  });

  it('a non-finite value still returns the same reason string', () => {
    const result = validateStreamSeries([0, 1, NaN], [0, 100, 200]);
    expect(result).toStrictEqual({
      ok: false,
      reason: 't[2] is not a finite number: NaN',
    });
  });

  it('a decreasing t value still returns the same reason string', () => {
    const result = validateStreamSeries([0, 2, 1], [0, 100, 200]);
    expect(result).toStrictEqual({
      ok: false,
      reason: 't decreases at index 2: t[1]=2, t[2]=1',
    });
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

describe('isPlausible — guard discriminator', () => {
  it('sets guard to max-speed on a max-speed rejection, reason unchanged', () => {
    const result = isPlausible(6.0, 5.0, 100);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.guard).toBe('max-speed');
      expect(result.reason).toBe(
        'implied 6.00 m/s exceeds activity max_speed 5.00 m/s'
      );
    }
  });

  it('sets guard to world-record on a world-record rejection, reason unchanged', () => {
    const result = isPlausible(8.0, 20, 6.62);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.guard).toBe('world-record');
      expect(result.reason).toBe(
        'implied 8.00 m/s exceeds world-record pace 6.62 m/s'
      );
    }
  });

  it('pins precedence: when both conditions would fire, guard is max-speed because that check runs first', () => {
    // Both max_speed*margin (5.10) and world-record (4.0) are exceeded by 8.0.
    const result = isPlausible(8.0, 5.0, 4.0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.guard).toBe('max-speed');
    }
  });

  it('the passing variant carries no guard property', () => {
    const result = isPlausible(4.0, 5.5, 6.6);
    expect(result.ok).toBe(true);
    expect('guard' in result).toBe(false);
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

/**
 * `findBestEffort`'s optional half-open sample `bounds` (36-02, PR-06). Every
 * test below lives under one describe whose title contains "bounds" so
 * `npx vitest run ... -t "bounds"` selects exactly this group — required by
 * this plan's own verification step, which asserts the matched count is
 * nonzero (a name filter matching 0 tests exits 0 and proves nothing).
 */
describe('findBestEffort — bounds (36-02, PR-06)', () => {
  it(
    'omitting bounds is exactly {startIndex:0, endIndex:t.length} on every archive activity and every TARGET_ORDER distance — THE INDEPENDENT VALUE: a compared-pair counter proves the sweep over the real archive actually ran, not vacuously',
    () => {
      const ids = readManifestAvailableIds();
      let comparedPairs = 0;

      for (const id of ids) {
        const { t, d } = readStream(id);
        for (const key of TARGET_ORDER) {
          const targetMeters = TARGET_METERS[key];
          const omitted = findBestEffort(t, d, targetMeters);
          const explicit = findBestEffort(t, d, targetMeters, {
            startIndex: 0,
            endIndex: t.length,
          });
          expect(explicit).toEqual(omitted);
          comparedPairs++;
        }
      }

      // eslint-disable-next-line no-console
      console.log(
        `bounds omitted-identity sweep: ${comparedPairs} activity/distance pairs compared across ${ids.length} activities`
      );
      expect(comparedPairs).toBeGreaterThan(0);
    },
    60_000
  );

  describe('bound equivalence against an explicitly sliced expectation — THE INDEPENDENT VALUE: the expected answer is produced by an array copy the shipped code deliberately never makes, so this is not the bounded sweep agreeing with itself', () => {
    /**
     * Only `startIndex`/`endIndex` need `lo` added back. `t`'s values are
     * absolute seconds since the ORIGINAL stream's first sample, and
     * `.slice` preserves values verbatim (sample `t[lo+k]` becomes
     * `slicedT[k]` with the identical number) — so `durationSec`,
     * `startOffsetSec` and `endOffsetSec`, which are read directly off `t`
     * (or a subtraction of it), come out identical whether the sweep is
     * bounded over the full array or unbounded over the pre-sliced
     * sub-array. `d[j] - d[i]` is likewise slice-safe because only
     * DIFFERENCES of the distance channel are ever read — this is exactly
     * why the shipped sweep can adjust loop bounds instead of copying.
     */
    function slicedExpectation(t: number[], d: number[], targetMeters: number, lo: number, hi: number) {
      const result = findBestEffort(t.slice(lo, hi), d.slice(lo, hi), targetMeters);
      if (!result) return undefined;
      return { ...result, startIndex: result.startIndex + lo, endIndex: result.endIndex + lo };
    }

    it('synthetic stream A (steady pace): bound strictly inside the array matches the sliced-array expectation', () => {
      const t = [0, 10, 20, 30, 40, 50, 60, 70];
      const d = [0, 100, 200, 300, 400, 500, 600, 700];
      const lo = 2;
      const hi = 6;
      const bounded = findBestEffort(t, d, 150, { startIndex: lo, endIndex: hi });
      expect(bounded).toBeDefined();
      expect(bounded).toEqual(slicedExpectation(t, d, 150, lo, hi));
    });

    it('synthetic stream B (a pause inside the bound): bound strictly inside the array matches the sliced-array expectation', () => {
      const t = [0, 1, 2, 600, 601, 602, 603, 604];
      const d = [0, 100, 200, 200, 300, 400, 500, 600];
      const lo = 1;
      const hi = 7;
      const bounded = findBestEffort(t, d, 250, { startIndex: lo, endIndex: hi });
      expect(bounded).toBeDefined();
      expect(bounded).toEqual(slicedExpectation(t, d, 250, lo, hi));
    });

    it('synthetic stream C (a standstill inside the bound): bound strictly inside the array matches the sliced-array expectation', () => {
      const t = [0, 5, 10, 15, 20, 25, 30];
      const d = [0, 50, 50, 100, 150, 150, 200];
      const lo = 1;
      const hi = 6;
      const bounded = findBestEffort(t, d, 100, { startIndex: lo, endIndex: hi });
      expect(bounded).toBeDefined();
      expect(bounded).toEqual(slicedExpectation(t, d, 100, lo, hi));
    });

    it('the real 3475740390 stream: bound strictly inside the array matches the sliced-array expectation', () => {
      const { t, d } = readStream('3475740390');
      const lo = 100;
      const hi = t.length - 100;
      expect(hi).toBeGreaterThan(lo + 2);
      const targetMeters = TARGET_METERS['400m'];
      const bounded = findBestEffort(t, d, targetMeters, { startIndex: lo, endIndex: hi });
      expect(bounded).toBeDefined();
      expect(bounded).toEqual(slicedExpectation(t, d, targetMeters, lo, hi));
    });
  });

  describe('bounds totality — every malformed bound returns undefined without throwing, each its own assertion (never a loop that could skip a case)', () => {
    const t = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const d = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

    it('degenerate bound {startIndex:5, endIndex:5} (zero-width, hi-lo<2) returns undefined and does not throw', () => {
      expect(() => findBestEffort(t, d, 50, { startIndex: 5, endIndex: 5 })).not.toThrow();
      expect(findBestEffort(t, d, 50, { startIndex: 5, endIndex: 5 })).toBeUndefined();
    });

    it('inverted bound {startIndex:6, endIndex:5} returns undefined and does not throw', () => {
      expect(() => findBestEffort(t, d, 50, { startIndex: 6, endIndex: 5 })).not.toThrow();
      expect(findBestEffort(t, d, 50, { startIndex: 6, endIndex: 5 })).toBeUndefined();
    });

    it('negative startIndex {startIndex:-1, endIndex:4} returns undefined and does not throw', () => {
      expect(() => findBestEffort(t, d, 50, { startIndex: -1, endIndex: 4 })).not.toThrow();
      expect(findBestEffort(t, d, 50, { startIndex: -1, endIndex: 4 })).toBeUndefined();
    });

    it('over-long endIndex {startIndex:0, endIndex:t.length+1} returns undefined and does not throw', () => {
      expect(() => findBestEffort(t, d, 50, { startIndex: 0, endIndex: t.length + 1 })).not.toThrow();
      expect(findBestEffort(t, d, 50, { startIndex: 0, endIndex: t.length + 1 })).toBeUndefined();
    });

    it('non-integer startIndex {startIndex:0.5, endIndex:4} returns undefined and does not throw', () => {
      expect(() => findBestEffort(t, d, 50, { startIndex: 0.5, endIndex: 4 })).not.toThrow();
      expect(findBestEffort(t, d, 50, { startIndex: 0.5, endIndex: 4 })).toBeUndefined();
    });

    it('a bound long enough in samples (10, well above the 2-sample floor) but too short in metres to cover the target returns undefined and does not throw', () => {
      expect(() => findBestEffort(t, d, 1000, { startIndex: 0, endIndex: t.length })).not.toThrow();
      expect(findBestEffort(t, d, 1000, { startIndex: 0, endIndex: t.length })).toBeUndefined();
    });
  });
});

/**
 * The three scoping activities' 400m BEFORE figures — ROADMAP criterion 4's
 * pinned permanent regression fixtures (36-02, PR-06/PR-09). Every case
 * below lives under one describe whose title contains "scoping activities"
 * so `npx vitest run ... -t "scoping activities"` selects exactly this
 * group.
 *
 * BEFORE STATE: these are the unconstrained sweep's answer as it stands
 * TODAY — the contaminated figure the phase's clean-window search must
 * still reproduce once it lands (this plan does not implement the search;
 * it only pins what "before" means). They are NOT the after figures. The
 * after figures — 4:59/km, 4:50/km, 5:08/km respectively (36-CONTEXT.md's
 * "Measured during this discussion" table) — are named here purely as
 * references to reconcile against once the clean-window search exists; they
 * are never asserted in this file. Plan 36-05 owns the after-state
 * assertions.
 *
 * If any activity's mm:ss does not come out as the pinned string below, this
 * is a HALT: the archive has moved under a figure ROADMAP criterion 4 pins,
 * which is a developer decision. Do not adjust the pinned string or widen
 * the tolerance to make the test pass.
 */
describe('findBestEffort — scoping activities, 400m BEFORE regression fixtures (ROADMAP criterion 4, 36-02)', () => {
  /** mm:ss conversion, computed locally — this file is analytics, must not import a dashboard formatter. */
  function paceMinSec(paceSecPerKm: number): string {
    return `${Math.floor(paceSecPerKm / 60)}:${String(Math.round(paceSecPerKm) % 60).padStart(2, '0')}`;
  }

  it('3475740390 @ 400m: BEFORE pace is 3:20/km — the window starts on the 52m jump at t=2508, SEG-03\'s own named fixture', () => {
    const { t, d } = readStream('3475740390');
    const result = findBestEffort(t, d, TARGET_METERS['400m']);
    expect(result).toBeDefined();
    if (!result) return;

    const paceSecPerKm = result.durationSec / (TARGET_METERS['400m'] / 1000);
    expect(paceMinSec(paceSecPerKm)).toBe('3:20');
    expect(result.durationSec).toBeCloseTo(79.9, 1);
    expect(Number.isInteger(result.startIndex)).toBe(true);
    expect(Number.isInteger(result.endIndex)).toBe(true);
    expect(result.endIndex).toBeGreaterThan(result.startIndex);
    expect(t[result.startIndex]).toBe(result.startOffsetSec);
  });

  it('3475724402 @ 400m: BEFORE pace is 3:21/km', () => {
    const { t, d } = readStream('3475724402');
    const result = findBestEffort(t, d, TARGET_METERS['400m']);
    expect(result).toBeDefined();
    if (!result) return;

    const paceSecPerKm = result.durationSec / (TARGET_METERS['400m'] / 1000);
    expect(paceMinSec(paceSecPerKm)).toBe('3:21');
    expect(result.durationSec).toBeCloseTo(80.4, 1);
    expect(Number.isInteger(result.startIndex)).toBe(true);
    expect(Number.isInteger(result.endIndex)).toBe(true);
    expect(result.endIndex).toBeGreaterThan(result.startIndex);
    expect(t[result.startIndex]).toBe(result.startOffsetSec);
  });

  it('3475734189 @ 400m: BEFORE pace is 3:22/km', () => {
    const { t, d } = readStream('3475734189');
    const result = findBestEffort(t, d, TARGET_METERS['400m']);
    expect(result).toBeDefined();
    if (!result) return;

    const paceSecPerKm = result.durationSec / (TARGET_METERS['400m'] / 1000);
    expect(paceMinSec(paceSecPerKm)).toBe('3:22');
    expect(result.durationSec).toBeCloseTo(80.8, 1);
    expect(Number.isInteger(result.startIndex)).toBe(true);
    expect(Number.isInteger(result.endIndex)).toBe(true);
    expect(result.endIndex).toBeGreaterThan(result.startIndex);
    expect(t[result.startIndex]).toBe(result.startOffsetSec);
  });
});
