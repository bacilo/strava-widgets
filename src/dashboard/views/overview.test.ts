import { describe, it, expect } from 'vitest';
import { activityRowAriaLabel, statusBadgeTexts } from './list.js';
import {
  selectThisYearStats,
  thisYearTileValues,
  currentStreakSublabel,
  type StreaksStats,
} from './overview.js';
import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';

/**
 * D-05: Overview no longer has its own accessible-name builder — its
 * private PR-badge-text and row-label builders were retired in plan 21-04
 * because Overview's row DOM itself was retired into `list.ts`'s shared
 * `renderActivityRow`. These assertions cover the shared `list.ts` builder
 * (`activityRowAriaLabel` / `statusBadgeTexts`) as Overview now consumes it,
 * proving the CR-02 PR-badge-in-the-accessible-name guarantee survives the
 * retirement.
 *
 * Plan 21-06 adds two more describes below covering `selectThisYearStats`/
 * `thisYearTileValues` (OVR-04) and `currentStreakSublabel` (FIX-01/D-15).
 *
 * None of this proves the two new tiles appear in `.stat-grid`, where they
 * sit relative to the other six, how they read in either theme, or that the
 * sub-label renders as a visible third line — nor does it prove anything
 * about whether a browser or a real screen reader actually announces the
 * accessible-name strings above when a row is focused. Vitest runs in this
 * repository with `environment: 'node'` — no jsdom, no headless browser
 * anywhere in it — so nothing here can construct a live DOM, focus an
 * element, or observe computed accessible-name/accessibility-tree state.
 * That confirmation is plan 21-07's checkpoint, rows R11-R13 for the two new
 * tiles and the sub-label, and the pre-existing rows for accessible names.
 */

function baseRow(overrides: Partial<DashboardIndexRow> = {}): DashboardIndexRow {
  return {
    id: '456',
    startDate: '2026-08-06T07:28:22Z',
    startDateLocal: '2026-08-06T07:28:22',
    name: 'Tempo Run',
    distanceM: 10000,
    movingTimeSec: 2700,
    paceSecPerKm: 270,
    elevationGainM: 100,
    avgHr: 160,
    maxHr: 180,
    avgCadenceRpm: 88,
    location: 'Copenhagen',
    sportType: 'Run',
    streams: {
      available: true,
      hr: true,
      cadence: true,
      elevation: true,
    },
    lowConfidence: false,
    excludedFromRecords: false,
    prCount: 1,
    gearName: null,
    ...overrides,
  };
}

describe('Overview Recent PRs — D-05/D-07: the PR badge survives the retirement into the shared renderer', () => {
  it('statusBadgeTexts contains the exact string "2 PR" for a prCount: 2 row — the badge source D-07 says needs no replacement, the string the retired PR-badge-text builder used to build is emitted here already', () => {
    const row = baseRow({ prCount: 2 });
    expect(statusBadgeTexts(row)).toContain('2 PR');
  });

  it('activityRowAriaLabel ends with "2 PR" for the same row — the CR-02 guarantee carried across the retirement: the row anchor\'s accessible name replaces every descendant string, so a PR badge that is not folded into the label is announced nowhere', () => {
    const row = baseRow({ prCount: 2 });
    expect(activityRowAriaLabel(row).endsWith('2 PR')).toBe(true);
  });

  it('activityRowAriaLabel starts with the activity name — the curated D-04 three-part base is unchanged by the retirement', () => {
    const row = baseRow({ name: 'Long Sunday Run', prCount: 1 });
    expect(activityRowAriaLabel(row).startsWith('Long Sunday Run,')).toBe(true);
  });

  it('activityRowAriaLabel is exactly the expected literal for a prCount: 5 row — pinned so a formatting drift is visible', () => {
    const row = baseRow({ prCount: 5 });
    expect(activityRowAriaLabel(row)).toBe('Tempo Run, Aug 6, 2026, 10.0 km, 5 PR');
  });

  it('a clean prCount: 0 row (Recent PRs never renders such a row, but Recent Activities does — the two now share a renderer, so the no-badge path is part of Overview\'s surface) has no PR badge', () => {
    const row = baseRow({ prCount: 0 });
    expect(statusBadgeTexts(row)).toEqual([]);
    expect(activityRowAriaLabel(row)).not.toContain(' PR');
  });
});

/** A `yearly-stats.json`-shaped fixture: three years, 2026 is "this year". */
const yearlyStatsFixture = [
  {
    periodStart: '2024-01-01T00:00:00.000Z',
    periodLabel: '2024',
    totalKm: 900.1,
    runCount: 120,
    avgPaceMinPerKm: 6.1,
    elevationGain: 5000,
    totalMovingTimeMin: 6000,
  },
  {
    periodStart: '2025-01-01T00:00:00.000Z',
    periodLabel: '2025',
    totalKm: 1000.2,
    runCount: 130,
    avgPaceMinPerKm: 6.0,
    elevationGain: 5500,
    totalMovingTimeMin: 6500,
  },
  {
    periodStart: '2026-01-01T00:00:00.000Z',
    periodLabel: '2026',
    totalKm: 1234.56,
    runCount: 140,
    avgPaceMinPerKm: 5.9,
    elevationGain: 6000,
    totalMovingTimeMin: 7430,
  },
];

describe('selectThisYearStats / thisYearTileValues — OVR-04 (D-10/D-11)', () => {
  it('selectThisYearStats(fixture, 2026) returns the 2026 entry\'s totalKm and totalMovingTimeMin', () => {
    expect(selectThisYearStats(yearlyStatsFixture, 2026)).toEqual({
      totalKm: 1234.56,
      totalMovingTimeMin: 7430,
    });
  });

  it('thisYearTileValues of the 2026 entry is exactly { distance: "1234.6 km", hours: "124" } — 7430 / 60 = 123.83, Math.round is 124', () => {
    const stats = selectThisYearStats(yearlyStatsFixture, 2026);
    expect(thisYearTileValues(stats)).toEqual({ distance: '1234.6 km', hours: '124' });
  });

  it('selectThisYearStats(fixture, 2027) is null, and thisYearTileValues(null) is the em-dash pair — D-11\'s 1-January state: honest em-dashes until the nightly rebuild writes the new year\'s entry', () => {
    expect(selectThisYearStats(yearlyStatsFixture, 2027)).toBeNull();
    expect(thisYearTileValues(null)).toEqual({ distance: '—', hours: '—' });
  });

  it('selectThisYearStats returns null without throwing for null, undefined, {} and a non-array value', () => {
    expect(selectThisYearStats(null, 2026)).toBeNull();
    expect(selectThisYearStats(undefined, 2026)).toBeNull();
    expect(selectThisYearStats({}, 2026)).toBeNull();
    expect(selectThisYearStats('nope', 2026)).toBeNull();
  });

  it('a malformed 2026 entry (totalKm is a string) is not partially trusted — the whole lookup returns null', () => {
    const malformed = [
      ...yearlyStatsFixture.slice(0, 2),
      { ...yearlyStatsFixture[2], totalKm: 'lots' },
    ];
    expect(selectThisYearStats(malformed, 2026)).toBeNull();
  });

  it('LAST-ENTRY REGRESSION GUARD: a fixture with no 2026 entry, whose final element is periodLabel "2025", returns null for year 2026, not the 2025 entry — the declined D-11 alternative (taking the file\'s last entry) would mislabel the previous year\'s totals "This Year" every January', () => {
    const noCurrentYearEntry = [yearlyStatsFixture[0], yearlyStatsFixture[1]];
    expect(noCurrentYearEntry[noCurrentYearEntry.length - 1].periodLabel).toBe('2025');
    expect(selectThisYearStats(noCurrentYearEntry, 2026)).toBeNull();
  });
});

describe('currentStreakSublabel — FIX-01 / D-15 on Overview', () => {
  function streaksFixture(overrides: Partial<StreaksStats> = {}): StreaksStats {
    return {
      currentStreak: 0,
      longestStreak: 12,
      withinCurrentStreak: false,
      currentStreakStart: null,
      currentStreakEnd: '2026-08-03T00:00:00.000Z',
      longestStreakStart: null,
      longestStreakEnd: null,
      weeklyConsistency: null,
      ...overrides,
    };
  }

  it('an ended streak with a known end day yields exactly "ended Aug 3, 2026"', () => {
    const streaks = streaksFixture();
    expect(currentStreakSublabel(streaks)).toBe('ended Aug 3, 2026');
  });

  it('the same fixture with a currentStreakStart also present still yields "ended Aug 3, 2026", NOT "ended Jul 30, 2026" — the Overview half of the Pitfall-1 discriminator: a plausible wrong fix renders the streak\'s start date here too', () => {
    const streaks = streaksFixture({ currentStreakStart: '2026-07-30T00:00:00.000Z' });
    expect(currentStreakSublabel(streaks)).toBe('ended Aug 3, 2026');
    expect(currentStreakSublabel(streaks)).not.toBe('ended Jul 30, 2026');
  });

  it('an active streak (withinCurrentStreak: true) yields undefined even with currentStreakEnd present', () => {
    const streaks = streaksFixture({ withinCurrentStreak: true });
    expect(currentStreakSublabel(streaks)).toBeUndefined();
  });

  it('an ended streak with currentStreakEnd: null yields undefined', () => {
    const streaks = streaksFixture({ currentStreakEnd: null });
    expect(currentStreakSublabel(streaks)).toBeUndefined();
  });

  it('an ended streak with currentStreakEnd: "" yields undefined', () => {
    const streaks = streaksFixture({ currentStreakEnd: '' });
    expect(currentStreakSublabel(streaks)).toBeUndefined();
  });

  it('D-13\'s degrade path: an ended streak with currentStreakEnd absent entirely (a pre-compute-run streaks.json, modeled honestly via a cast) yields undefined and does not throw', () => {
    const { currentStreakEnd: _omit, ...rest } = streaksFixture();
    const preComputeRunShape = rest as unknown as StreaksStats;
    expect(() => currentStreakSublabel(preComputeRunShape)).not.toThrow();
    expect(currentStreakSublabel(preComputeRunShape)).toBeUndefined();
  });

  it('currentStreakSublabel(null) yields undefined', () => {
    expect(currentStreakSublabel(null)).toBeUndefined();
  });
});
