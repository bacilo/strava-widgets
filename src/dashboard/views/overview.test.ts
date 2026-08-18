import { describe, it, expect } from 'vitest';
import { activityRowAriaLabel, statusBadgeTexts } from './list.js';
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
 * It proves NOTHING about whether a browser or a real screen reader actually
 * announces this string when the row is focused. Vitest runs in this
 * repository with `environment: 'node'` — no jsdom, no headless browser
 * anywhere in it — so nothing here can construct a live DOM, focus an
 * element, or observe computed accessible-name/accessibility-tree state.
 * That confirmation is plan 21-07's checkpoint, on all affected surfaces.
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
