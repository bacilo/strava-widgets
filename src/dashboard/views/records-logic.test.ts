import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type {
  ActivityBestEfforts,
  BestEffortsDocument,
  BestEffort,
  PRRankingEntry,
  TargetDistanceKey,
} from '../../analytics/best-effort.types.js';
import type { AgeGradingDocument } from '../../analytics/age-grading.types.js';
import {
  buildEvolutionSeries,
  buildExclusionReasonIndex,
  buildPrTableRows,
  buildProgressionRows,
  evolutionCardSummary,
  isEmptyRanking,
  selectSuperlatives,
  type EvolutionPoint,
} from './records-logic.js';

/**
 * Real committed/generated `data/stats/*.json` files, read via `fs` rather
 * than a static ES import — `tsconfig.json`'s `rootDir: "src"` would reject
 * a static import reaching outside it (the same discipline
 * `wma-factors.test.ts` established in plan 18-02).
 */
const __dirname = dirname(fileURLToPath(import.meta.url));

const bestEfforts: BestEffortsDocument = JSON.parse(
  readFileSync(join(__dirname, '../../../data/stats/best-efforts.json'), 'utf-8')
);
const weeklyDistance: unknown = JSON.parse(
  readFileSync(join(__dirname, '../../../data/stats/weekly-distance.json'), 'utf-8')
);
const monthlyStats: unknown = JSON.parse(
  readFileSync(join(__dirname, '../../../data/stats/monthly-stats.json'), 'utf-8')
);
const streaks: unknown = JSON.parse(
  readFileSync(join(__dirname, '../../../data/stats/streaks.json'), 'utf-8')
);

function rankingEntry(overrides: Partial<PRRankingEntry> & { activityId: string; durationSec: number }): PRRankingEntry {
  return {
    rank: 1,
    startDate: '2024-01-01T00:00:00Z',
    paceSecPerKm: 240,
    lowConfidence: false,
    ...overrides,
  };
}

function fixtureEffort(overrides: Partial<BestEffort> & { distance: TargetDistanceKey; durationSec: number }): BestEffort {
  return {
    paceSecPerKm: 240,
    startOffsetSec: 0,
    endOffsetSec: overrides.durationSec,
    lowConfidence: false,
    wasPRAtTheTime: false,
    excludedFromRecords: false,
    ...overrides,
  };
}

function fixtureActivity(
  overrides: Partial<ActivityBestEfforts> & { activityId: string; startDate: string; efforts: BestEffort[] }
): ActivityBestEfforts {
  return {
    distanceSource: 'native',
    excludedFromRecords: false,
    ...overrides,
  };
}

describe('isEmptyRanking / buildPrTableRows — marathon empty state (D-05)', () => {
  it('isEmptyRanking returns true for undefined and for an empty array', () => {
    expect(isEmptyRanking(undefined)).toBe(true);
    expect(isEmptyRanking([])).toBe(true);
  });

  it('buildPrTableRows for marathon returns [] and does not throw', () => {
    expect(() => buildPrTableRows(undefined, null, 'marathon', new Map())).not.toThrow();
    expect(buildPrTableRows(undefined, null, 'marathon', new Map())).toEqual([]);
  });

  it('the live archive genuinely has an empty marathon ranking (fixture reflects reality, not a fabricated case)', () => {
    expect(isEmptyRanking(bestEfforts.rankings.marathon)).toBe(true);
    expect(bestEfforts.rankings.marathon).toHaveLength(0);
  });
});

describe('buildPrTableRows — age-grade join by (distance, activityId)', () => {
  const entries: PRRankingEntry[] = [
    rankingEntry({ rank: 1, activityId: 'has-grade', durationSec: 1200 }),
    rankingEntry({ rank: 2, activityId: 'no-grade', durationSec: 1250 }),
  ];

  it('an entry with a matching age-grade gets its agePercent; one without gets null (never 0)', () => {
    const ageGrading: AgeGradingDocument = {
      schemaVersion: 1,
      generatedAt: '2026-01-01T00:00:00Z',
      note: 'test',
      enabled: true,
      disabledReason: null,
      editions: { road: '2025', track: '2023' },
      rankings: {
        '5k': [{ rank: 1, activityId: 'has-grade', agePercent: 72.5, derived: false }],
      },
      activities: {},
    };

    const rows = buildPrTableRows(entries, ageGrading, '5k', new Map());
    expect(rows[0].agePercent).toBe(72.5);
    expect(rows[1].agePercent).toBeNull();
    expect(rows[1].agePercent).not.toBe(0);
  });

  it('a disabled age-grading document makes every row null', () => {
    const disabled: AgeGradingDocument = {
      schemaVersion: 1,
      generatedAt: '2026-01-01T00:00:00Z',
      note: 'test',
      enabled: false,
      disabledReason: 'birthDate missing',
      editions: { road: '2025', track: '2023' },
      rankings: {
        '5k': [{ rank: 1, activityId: 'has-grade', agePercent: 72.5, derived: false }],
      },
      activities: {},
    };

    const rows = buildPrTableRows(entries, disabled, '5k', new Map());
    expect(rows.every((r) => r.agePercent === null)).toBe(true);
  });

  it('a null age-grading document also makes every row null', () => {
    const rows = buildPrTableRows(entries, null, '5k', new Map());
    expect(rows.every((r) => r.agePercent === null)).toBe(true);
  });
});

describe('buildPrTableRows — ageDerived flag', () => {
  it('is true for 1k rows and false for the other six distances', () => {
    const entries: PRRankingEntry[] = [rankingEntry({ activityId: 'a1', durationSec: 210 })];
    const distances: TargetDistanceKey[] = ['400m', '1k', '1mi', '5k', '10k', 'half', 'marathon'];

    for (const distance of distances) {
      const rows = buildPrTableRows(entries, null, distance, new Map());
      expect(rows[0].ageDerived).toBe(distance === '1k');
    }
  });
});

describe('buildExclusionReasonIndex / buildPrTableRows — exclusion reason surfacing', () => {
  const rawExclusions = {
    schemaVersion: 1,
    note: 'test',
    exclusions: [
      { activityId: 'excluded-1', distances: null, reason: 'Inaccurate GPS device.' },
    ],
  };

  it('an entry whose activityId is in the exclusions file gets excluded: true and the exact reason string', () => {
    const index = buildExclusionReasonIndex(rawExclusions);
    const entries: PRRankingEntry[] = [
      rankingEntry({ activityId: 'excluded-1', durationSec: 1200 }),
      rankingEntry({ activityId: 'clean-1', durationSec: 1210 }),
    ];

    const rows = buildPrTableRows(entries, null, '5k', index);
    expect(rows[0].excluded).toBe(true);
    expect(rows[0].exclusionReason).toBe('Inaccurate GPS device.');
    expect(rows[1].excluded).toBe(false);
    expect(rows[1].exclusionReason).toBeNull();
  });

  it('buildExclusionReasonIndex(null) and a malformed body both return an empty map without throwing', () => {
    expect(() => buildExclusionReasonIndex(null)).not.toThrow();
    expect(buildExclusionReasonIndex(null).size).toBe(0);

    expect(() => buildExclusionReasonIndex({ not: 'the right shape' })).not.toThrow();
    expect(buildExclusionReasonIndex({ not: 'the right shape' }).size).toBe(0);

    expect(() => buildExclusionReasonIndex('a string')).not.toThrow();
    expect(buildExclusionReasonIndex('a string').size).toBe(0);

    expect(() => buildExclusionReasonIndex(42)).not.toThrow();
    expect(buildExclusionReasonIndex([1, 2, 3]).size).toBe(0);
  });

  it('a __proto__-keyed activityId entry is not reachable through the returned map', () => {
    const hostile = {
      schemaVersion: 1,
      note: 'test',
      exclusions: [{ activityId: '__proto__', distances: null, reason: 'hostile' }],
    };
    const index = buildExclusionReasonIndex(hostile);
    expect(index.has('__proto__')).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('buildPrTableRows — lowConfidence passthrough', () => {
  it('passes lowConfidence through from the ranking entry unchanged', () => {
    const entries: PRRankingEntry[] = [
      rankingEntry({ activityId: 'a1', durationSec: 1200, lowConfidence: true }),
      rankingEntry({ activityId: 'a2', durationSec: 1210, lowConfidence: false }),
    ];

    const rows = buildPrTableRows(entries, null, '5k', new Map());
    expect(rows[0].lowConfidence).toBe(true);
    expect(rows[1].lowConfidence).toBe(false);
  });
});

describe('buildEvolutionSeries', () => {
  it('returns only wasPRAtTheTime === true efforts, ascending by date, even when the activities map is in arbitrary key order', () => {
    const activities: BestEffortsDocument['activities'] = {
      'z-newest': fixtureActivity({
        activityId: 'z-newest',
        startDate: '2024-01-01T00:00:00Z',
        efforts: [fixtureEffort({ distance: '5k', durationSec: 1100, wasPRAtTheTime: true })],
      }),
      'a-oldest': fixtureActivity({
        activityId: 'a-oldest',
        startDate: '2020-01-01T00:00:00Z',
        efforts: [fixtureEffort({ distance: '5k', durationSec: 1300, wasPRAtTheTime: true })],
      }),
      'm-middle-not-pr': fixtureActivity({
        activityId: 'm-middle-not-pr',
        startDate: '2022-01-01T00:00:00Z',
        efforts: [fixtureEffort({ distance: '5k', durationSec: 1400, wasPRAtTheTime: false })],
      }),
    };

    const series = buildEvolutionSeries(activities, '5k');
    expect(series).toHaveLength(2);
    expect(series[0].activityId).toBe('a-oldest');
    expect(series[1].activityId).toBe('z-newest');
    expect(series[0].x).toBeLessThan(series[1].x);
  });

  it('returns [] for a distance with no PR efforts', () => {
    const activities: BestEffortsDocument['activities'] = {
      a1: fixtureActivity({
        activityId: 'a1',
        startDate: '2024-01-01T00:00:00Z',
        efforts: [fixtureEffort({ distance: '5k', durationSec: 1100, wasPRAtTheTime: true })],
      }),
    };

    expect(buildEvolutionSeries(activities, 'marathon')).toEqual([]);
  });
});

describe('buildProgressionRows', () => {
  it('first row improvementSec is null; subsequent faster rows carry a negative value', () => {
    const series: EvolutionPoint[] = [
      { x: 1000, y: 1300, activityId: 'a1' },
      { x: 2000, y: 1250, activityId: 'a2' },
      { x: 3000, y: 1200, activityId: 'a3' },
    ];

    const rows = buildProgressionRows(series);
    expect(rows[0].improvementSec).toBeNull();
    expect(rows[1].improvementSec).toBe(-50);
    expect(rows[2].improvementSec).toBe(-50);
  });

  it('a non-improving step yields a positive value rather than throwing', () => {
    const series: EvolutionPoint[] = [
      { x: 1000, y: 1200, activityId: 'a1' },
      { x: 2000, y: 1250, activityId: 'a2' },
    ];

    expect(() => buildProgressionRows(series)).not.toThrow();
    const rows = buildProgressionRows(series);
    expect(rows[1].improvementSec).toBe(50);
  });
});

describe('evolutionCardSummary', () => {
  it('over an empty series returns nulls/zero without throwing', () => {
    expect(evolutionCardSummary([])).toEqual({
      currentSec: null,
      steps: 0,
      firstYear: null,
      lastYear: null,
    });
  });

  it('over the live 5k series, currentSec equals the last (fastest) point and matches the rank-1 duration', () => {
    const series = buildEvolutionSeries(bestEfforts.activities, '5k');
    const summary = evolutionCardSummary(series);
    const rankOne = bestEfforts.rankings['5k'].find((e) => e.rank === 1);

    expect(summary.currentSec).toBe(series[series.length - 1].y);
    expect(summary.currentSec).toBe(rankOne!.durationSec);
    expect(summary.steps).toBe(series.length);
  });
});

describe('selectSuperlatives — live data/stats files', () => {
  it('all four tiles resolve; biggestWeek.km equals the max totalKm in the weekly file', () => {
    const superlatives = selectSuperlatives(weeklyDistance, monthlyStats, streaks);

    expect(superlatives.biggestWeek).not.toBeNull();
    expect(superlatives.biggestMonth).not.toBeNull();
    expect(superlatives.longestStreak).not.toBeNull();
    expect(superlatives.currentStreak).not.toBeNull();

    const maxKm = (weeklyDistance as { totalKm: number }[]).reduce(
      (max, entry) => Math.max(max, entry.totalKm),
      0
    );
    expect(superlatives.biggestWeek!.km).toBe(maxKm);
  });

  it('longestStreak.days pins the archive live value (update here + summary if the archive changes, never loosen to an inequality)', () => {
    const superlatives = selectSuperlatives(weeklyDistance, monthlyStats, streaks);
    expect(superlatives.longestStreak!.days).toBe(31);
  });

  it('currentStreak tile is present even when its day count could be zero — proving zero is never conflated with absent (T-18-HONEST-02)', () => {
    // NOTE: the plan text this suite was written against predicted the
    // archive's live currentStreak at the value 0 with active === false.
    // At the time this test was actually run, the archive had two
    // consecutive recent training days, so currentStreak is 2 and
    // active is true. The zero-day case is still exercised directly
    // below with a synthetic fixture, so the "zero is a real value, not
    // absence" guarantee remains pinned regardless of which state the
    // live archive happens to be in on any given day. See the plan
    // summary's Decisions section for the full note.
    const superlatives = selectSuperlatives(weeklyDistance, monthlyStats, streaks);
    expect(superlatives.currentStreak).not.toBeNull();
    expect(typeof superlatives.currentStreak!.days).toBe('number');

    const zeroStreak = {
      currentStreak: 0,
      withinCurrentStreak: false,
      currentStreakStart: '',
    };
    const zeroResult = selectSuperlatives(null, null, zeroStreak);
    expect(zeroResult.currentStreak).not.toBeNull();
    expect(zeroResult.currentStreak!.days).toBe(0);
    expect(zeroResult.currentStreak!.active).toBe(false);
  });
});

describe('selectSuperlatives — tolerant of null/malformed inputs', () => {
  it('selectSuperlatives(null, null, null) returns all four tiles as null without throwing', () => {
    expect(() => selectSuperlatives(null, null, null)).not.toThrow();
    const result = selectSuperlatives(null, null, null);
    expect(result).toEqual({
      biggestWeek: null,
      biggestMonth: null,
      longestStreak: null,
      currentStreak: null,
    });
  });

  it('selectSuperlatives(weekly, null, null) resolves only biggestWeek', () => {
    const result = selectSuperlatives(weeklyDistance, null, null);
    expect(result.biggestWeek).not.toBeNull();
    expect(result.biggestMonth).toBeNull();
    expect(result.longestStreak).toBeNull();
    expect(result.currentStreak).toBeNull();
  });
});

describe('selectCurrentStreak — FIX-01 endedISO comes from currentStreakEnd, not currentStreakStart (D-12 layer 2)', () => {
  it('an ended streak carrying both fields with different values yields endedISO from currentStreakEnd, not currentStreakStart', () => {
    const fixture = {
      currentStreak: 0,
      withinCurrentStreak: false,
      currentStreakStart: '2026-07-30T00:00:00.000Z',
      currentStreakEnd: '2026-08-03T00:00:00.000Z',
    };
    const result = selectSuperlatives(null, null, fixture);
    expect(result.currentStreak).not.toBeNull();
    expect(result.currentStreak!.endedISO).toBe('2026-08-03T00:00:00.000Z');
    expect(result.currentStreak!.endedISO).not.toBe('2026-07-30T00:00:00.000Z');
  });

  it('an ended streak with no currentStreakEnd key still renders a tile with a null sub-label (pre-compute-run degrade path, D-13)', () => {
    const fixture = {
      currentStreak: 0,
      withinCurrentStreak: false,
    };
    const result = selectSuperlatives(null, null, fixture);
    expect(result.currentStreak).not.toBeNull();
    expect(result.currentStreak!.days).toBe(0);
    expect(result.currentStreak!.active).toBe(false);
    expect(result.currentStreak!.endedISO).toBeNull();
  });

  it('an ended streak with currentStreakEnd as an empty string yields endedISO === null', () => {
    const fixture = {
      currentStreak: 0,
      withinCurrentStreak: false,
      currentStreakEnd: '',
    };
    const result = selectSuperlatives(null, null, fixture);
    expect(result.currentStreak).not.toBeNull();
    expect(result.currentStreak!.endedISO).toBeNull();
  });

  it('an active streak carrying a currentStreakEnd still resolves endedISO to null — the active branch wins', () => {
    const fixture = {
      currentStreak: 2,
      withinCurrentStreak: true,
      currentStreakEnd: '2026-08-17T00:00:00.000Z',
    };
    const result = selectSuperlatives(null, null, fixture);
    expect(result.currentStreak).not.toBeNull();
    expect(result.currentStreak!.active).toBe(true);
    expect(result.currentStreak!.endedISO).toBeNull();
  });
});
