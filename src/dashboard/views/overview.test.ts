import { describe, it, expect } from 'vitest';
import { recentPrBadgeText, recentPrRowAriaLabel } from './overview.js';
import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';

/**
 * Coverage of the Overview Recent PRs row's composed accessible-name string
 * (CR-02) — this file proves the STRING `recentPrRowAriaLabel` returns and
 * that it always ends with exactly what `recentPrBadgeText` returns for the
 * same row, so the visible badge and the announced tail can never diverge.
 *
 * It proves NOTHING about whether a browser or a real screen reader actually
 * announces this string when the row is focused. Vitest runs in this
 * repository with `environment: 'node'` — there is no DOM-simulation
 * library dependency and no headless browser anywhere in it — so nothing
 * here can construct a live DOM, focus an element, or observe computed
 * accessible-name/accessibility-tree state. That confirmation is plan
 * 20-08's VoiceOver rows, on all three affected surfaces.
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

describe('recentPrBadgeText', () => {
  it('formats the PR count', () => {
    expect(recentPrBadgeText(baseRow({ prCount: 1 }))).toBe('1 PR');
    expect(recentPrBadgeText(baseRow({ prCount: 3 }))).toBe('3 PR');
  });
});

describe('recentPrRowAriaLabel — CR-02 PR-count badge folded into the row label', () => {
  it('contains the PR badge text', () => {
    const row = baseRow({ prCount: 2 });
    expect(recentPrRowAriaLabel(row)).toContain(recentPrBadgeText(row));
  });

  it('starts with the activity name', () => {
    const row = baseRow({ name: 'Long Sunday Run' });
    expect(recentPrRowAriaLabel(row).startsWith('Long Sunday Run,')).toBe(true);
  });

  it('ends with exactly what recentPrBadgeText returns for the same row', () => {
    const row = baseRow({ prCount: 5 });
    const label = recentPrRowAriaLabel(row);
    const badgeText = recentPrBadgeText(row);
    expect(label.endsWith(badgeText)).toBe(true);
    expect(label).toBe(`Tempo Run, Aug 6, 2026, 10.0 km, ${badgeText}`);
  });
});
