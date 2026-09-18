/**
 * Behavioral unit tests for scripts/curate-queue/derive-flagged.mjs (Phase 29 plan 04). Follows
 * scripts/compute-pr-ceiling-recount.test.mjs's practice of asserting against small, hand-built
 * fixture documents, plus a live-archive cross-check (Task 3) against
 * scripts/compute-pr-ceiling-recount.mjs's independently-derived recount — never a hardcoded
 * count, since the archive grows nightly via CI sync.
 *
 * Canary-first discipline (this project has twice shipped a guard that stayed green while
 * proving nothing): Task 1 proved this file is actually collected by vitest before any real
 * assertion was written.
 */

import { describe, expect, it } from 'vitest';

import { buildPrefillReason, deriveFlaggedActivities, summarizeQueue } from './derive-flagged.mjs';

describe('collection canary', () => {
  it('the three exports are functions', () => {
    expect(typeof deriveFlaggedActivities).toBe('function');
    expect(typeof buildPrefillReason).toBe('function');
    expect(typeof summarizeQueue).toBe('function');
  });
});

function effort(distance, guard, reason, durationSec = 100, paceSecPerKm = 250) {
  return {
    distance,
    durationSec,
    paceSecPerKm,
    demotion: guard === null ? null : { guard, reason },
  };
}

function activity(startDate, efforts, excludedFromRecords = false) {
  return { startDate, efforts, excludedFromRecords };
}

describe('deriveFlaggedActivities — D-01 population (all guards, not ceiling-only)', () => {
  it('an activity flagged only by ceiling, one only by world-record, one only by max-speed all appear — 3 rows', () => {
    const doc = {
      activities: {
        a1: activity('2024-01-01T00:00:00Z', [effort('400m', 'ceiling', 'ceiling reason')]),
        a2: activity('2024-01-02T00:00:00Z', [effort('1k', 'world-record', 'wr reason')]),
        a3: activity('2024-01-03T00:00:00Z', [effort('1mi', 'max-speed', 'ms reason')]),
      },
    };
    const rows = deriveFlaggedActivities(doc, {});
    expect(rows.length).toBe(3);
    const ids = rows.map((r) => r.activityId).sort();
    expect(ids).toEqual(['a1', 'a2', 'a3']);
  });

  it('a ceiling-only filter would incorrectly return 1 — this derivation must not do that', () => {
    const doc = {
      activities: {
        a1: activity('2024-01-01T00:00:00Z', [effort('400m', 'ceiling', 'ceiling reason')]),
        a2: activity('2024-01-02T00:00:00Z', [effort('1k', 'world-record', 'wr reason')]),
        a3: activity('2024-01-03T00:00:00Z', [effort('1mi', 'max-speed', 'ms reason')]),
      },
    };
    const rows = deriveFlaggedActivities(doc, {});
    const ceilingOnlyCount = rows.filter((r) =>
      r.flaggedEfforts.some((e) => e.guard === 'ceiling')
    ).length;
    expect(ceilingOnlyCount).toBe(1);
    expect(rows.length).not.toBe(ceilingOnlyCount);
  });

  it('an activity whose efforts all have demotion: null is absent', () => {
    const doc = {
      activities: {
        a1: activity('2024-01-01T00:00:00Z', [effort('400m', null, ''), effort('1k', null, '')]),
      },
    };
    const rows = deriveFlaggedActivities(doc, {});
    expect(rows.length).toBe(0);
  });
});

describe('deriveFlaggedActivities — D-03 one row per activity', () => {
  it('an activity with 2 flagged efforts and 1 unflagged produces exactly 1 row with flaggedEfforts.length 2', () => {
    const doc = {
      activities: {
        a1: activity('2024-01-01T00:00:00Z', [
          effort('400m', 'ceiling', 'reason 400m', 45, 112.5),
          effort('1k', 'world-record', 'reason 1k', 150, 150),
          effort('1mi', null, ''),
        ]),
      },
    };
    const rows = deriveFlaggedActivities(doc, {});
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.flaggedEfforts.length).toBe(2);
    const byDistance = Object.fromEntries(row.flaggedEfforts.map((e) => [e.distance, e]));
    expect(byDistance['400m']).toMatchObject({
      distance: '400m',
      guard: 'ceiling',
      reason: 'reason 400m',
      durationSec: 45,
      paceSecPerKm: 112.5,
    });
    expect(byDistance['1k']).toMatchObject({
      distance: '1k',
      guard: 'world-record',
      reason: 'reason 1k',
      durationSec: 150,
      paceSecPerKm: 150,
    });
    expect(byDistance['1mi']).toBeUndefined();
  });
});

describe('deriveFlaggedActivities — D-02 exclusion overlay', () => {
  it('a flagged activity present in the exclusions doc is present with excluded: true and the stored reason', () => {
    const doc = {
      activities: {
        a1: activity('2024-01-01T00:00:00Z', [effort('400m', 'ceiling', 'ceiling reason')]),
      },
    };
    const exclusionsDoc = { exclusions: [{ activityId: 'a1', reason: 'bad GPS device' }] };
    const rows = deriveFlaggedActivities(doc, exclusionsDoc);
    expect(rows.length).toBe(1);
    expect(rows[0].excluded).toBe(true);
    expect(rows[0].exclusionReason).toBe('bad GPS device');
  });

  it('an exclusion for a non-flagged activity adds no row', () => {
    const doc = {
      activities: {
        a1: activity('2024-01-01T00:00:00Z', [effort('400m', null, '')]),
      },
    };
    const exclusionsDoc = { exclusions: [{ activityId: 'a1', reason: 'irrelevant' }] };
    const rows = deriveFlaggedActivities(doc, exclusionsDoc);
    expect(rows.length).toBe(0);
  });
});

describe('deriveFlaggedActivities — D-05 ordering', () => {
  it('two pending and two excluded sort not-yet-excluded first, then newest-first within each group', () => {
    const doc = {
      activities: {
        pendingOld: activity('2020-01-01T00:00:00Z', [effort('400m', 'ceiling', 'r')]),
        pendingNew: activity('2022-01-01T00:00:00Z', [effort('400m', 'ceiling', 'r')]),
        excludedOld: activity('2021-01-01T00:00:00Z', [effort('400m', 'ceiling', 'r')]),
        excludedNew: activity('2023-01-01T00:00:00Z', [effort('400m', 'ceiling', 'r')]),
      },
    };
    const exclusionsDoc = {
      exclusions: [
        { activityId: 'excludedOld', reason: 'r' },
        { activityId: 'excludedNew', reason: 'r' },
      ],
    };
    const rows = deriveFlaggedActivities(doc, exclusionsDoc);
    expect(rows.map((r) => r.activityId)).toEqual([
      'pendingNew',
      'pendingOld',
      'excludedNew',
      'excludedOld',
    ]);
  });

  it('two rows with identical startDate sort by activityId ascending, a total reload-stable order', () => {
    const doc = {
      activities: {
        b2: activity('2024-01-01T00:00:00Z', [effort('400m', 'ceiling', 'r')]),
        a1: activity('2024-01-01T00:00:00Z', [effort('400m', 'ceiling', 'r')]),
      },
    };
    const rows = deriveFlaggedActivities(doc, {});
    expect(rows.map((r) => r.activityId)).toEqual(['a1', 'b2']);
  });
});

describe('buildPrefillReason — D-11', () => {
  it('joins two flagged efforts as "400m: <reason1>\\n1k: <reason2>"', () => {
    const flaggedEfforts = [
      { distance: '400m', guard: 'ceiling', reason: 'implied 6.96 m/s exceeds ceiling 5.11 m/s', durationSec: 57.5, paceSecPerKm: 143.8 },
      { distance: '1k', guard: 'world-record', reason: 'implied 14.75 m/s exceeds world-record pace 9.30 m/s', durationSec: 150, paceSecPerKm: 150 },
    ];
    expect(buildPrefillReason(flaggedEfforts)).toBe(
      '400m: implied 6.96 m/s exceeds ceiling 5.11 m/s\n1k: implied 14.75 m/s exceeds world-record pace 9.30 m/s'
    );
  });

  it('an empty input returns an empty string', () => {
    expect(buildPrefillReason([])).toBe('');
  });

  it('skips efforts with a non-string reason', () => {
    const flaggedEfforts = [
      { distance: '400m', guard: 'ceiling', reason: 'valid reason', durationSec: 1, paceSecPerKm: 1 },
      { distance: '1k', guard: 'ceiling', reason: null, durationSec: 1, paceSecPerKm: 1 },
    ];
    expect(buildPrefillReason(flaggedEfforts)).toBe('400m: valid reason');
  });
});

describe('deriveFlaggedActivities — D-12 detailUrl', () => {
  it('detailUrl is exactly /strava-widgets/#/activity/<activityId>', () => {
    const doc = {
      activities: {
        '3475711469': activity('2024-01-01T00:00:00Z', [effort('400m', 'ceiling', 'r')]),
      },
    };
    const rows = deriveFlaggedActivities(doc, {});
    expect(rows[0].detailUrl).toBe('/strava-widgets/#/activity/3475711469');
  });
});

describe('deriveFlaggedActivities — PD-01 name join', () => {
  it('name comes from the index.json row whose String(id) equals the activityId; label falls back to Activity <id>', () => {
    const doc = {
      activities: {
        '111': activity('2024-01-01T00:00:00Z', [effort('400m', 'ceiling', 'r')]),
        '222': activity('2024-01-02T00:00:00Z', [effort('400m', 'ceiling', 'r')]),
      },
    };
    const indexDoc = { activities: [{ id: 111, name: 'Morning Run' }] };
    const rows = deriveFlaggedActivities(doc, {}, indexDoc);
    const row111 = rows.find((r) => r.activityId === '111');
    const row222 = rows.find((r) => r.activityId === '222');
    expect(row111.name).toBe('Morning Run');
    expect(row111.label).toBe('Morning Run');
    expect(row222.name).toBeNull();
    expect(row222.label).toBe('Activity 222');
  });

  it('omitting indexDoc entirely changes neither the row count nor the order', () => {
    const doc = {
      activities: {
        '111': activity('2024-01-02T00:00:00Z', [effort('400m', 'ceiling', 'r')]),
        '222': activity('2024-01-01T00:00:00Z', [effort('400m', 'ceiling', 'r')]),
      },
    };
    const indexDoc = { activities: [{ id: 111, name: 'Morning Run' }] };
    const withIndex = deriveFlaggedActivities(doc, {}, indexDoc);
    const withoutIndex = deriveFlaggedActivities(doc, {});
    expect(withoutIndex.length).toBe(withIndex.length);
    expect(withoutIndex.map((r) => r.activityId)).toEqual(withIndex.map((r) => r.activityId));
    expect(withoutIndex[0].label).toBe('Activity 111');
  });
});

describe('deriveFlaggedActivities — degradation, never throws', () => {
  it('deriveFlaggedActivities(null, null) returns []', () => {
    expect(() => deriveFlaggedActivities(null, null)).not.toThrow();
    expect(deriveFlaggedActivities(null, null)).toEqual([]);
  });

  it('deriveFlaggedActivities({}, {}) returns []', () => {
    expect(() => deriveFlaggedActivities({}, {})).not.toThrow();
    expect(deriveFlaggedActivities({}, {})).toEqual([]);
  });

  it('deriveFlaggedActivities({ activities: "x" }, { exclusions: "x" }) returns []', () => {
    expect(() => deriveFlaggedActivities({ activities: 'x' }, { exclusions: 'x' })).not.toThrow();
    expect(deriveFlaggedActivities({ activities: 'x' }, { exclusions: 'x' })).toEqual([]);
  });

  it('an activity with non-array efforts degrades to absent, never throws', () => {
    const doc = { activities: { a1: { startDate: '2024-01-01T00:00:00Z', efforts: 'not-an-array' } } };
    expect(() => deriveFlaggedActivities(doc, {})).not.toThrow();
    expect(deriveFlaggedActivities(doc, {})).toEqual([]);
  });

  it('an effort whose demotion is a string is treated as not-flagged, never throws', () => {
    const doc = {
      activities: {
        a1: activity('2024-01-01T00:00:00Z', [{ distance: '400m', durationSec: 1, paceSecPerKm: 1, demotion: 'oops' }]),
      },
    };
    expect(() => deriveFlaggedActivities(doc, {})).not.toThrow();
    expect(deriveFlaggedActivities(doc, {})).toEqual([]);
  });
});

describe('deriveFlaggedActivities — __proto__ safety (T-29-12)', () => {
  it('__proto__ as an activityId key is skipped, never used as an object key', () => {
    const doc = {
      activities: JSON.parse(
        '{"__proto__": {"startDate": "2024-01-01T00:00:00Z", "efforts": [{"distance": "400m", "durationSec": 1, "paceSecPerKm": 1, "demotion": {"guard": "ceiling", "reason": "r"}}]}, "a1": {"startDate": "2024-01-02T00:00:00Z", "efforts": [{"distance": "400m", "durationSec": 1, "paceSecPerKm": 1, "demotion": {"guard": "ceiling", "reason": "r"}}]}}'
      ),
    };
    const rows = deriveFlaggedActivities(doc, {});
    expect(rows.map((r) => r.activityId)).toEqual(['a1']);
    expect(({}).__proto__.polluted).toBeUndefined();
  });

  it('__proto__ as an exclusion activityId is skipped, never used as an object key', () => {
    const doc = {
      activities: {
        a1: activity('2024-01-01T00:00:00Z', [effort('400m', 'ceiling', 'r')]),
      },
    };
    const exclusionsDoc = JSON.parse('{"exclusions": [{"activityId": "__proto__", "reason": "r"}]}');
    const rows = deriveFlaggedActivities(doc, exclusionsDoc);
    expect(rows.length).toBe(1);
    expect(rows[0].excluded).toBe(false);
    expect(({}).__proto__.polluted).toBeUndefined();
  });
});

describe('summarizeQueue', () => {
  it('returns { flaggedCount: rows.length, excludedCount: rows.filter(excluded).length }', () => {
    const rows = [
      { activityId: 'a1', excluded: true },
      { activityId: 'a2', excluded: false },
      { activityId: 'a3', excluded: true },
    ];
    expect(summarizeQueue(rows)).toEqual({ flaggedCount: 3, excludedCount: 2 });
  });

  it('an empty row set summarizes to zero/zero', () => {
    expect(summarizeQueue([])).toEqual({ flaggedCount: 0, excludedCount: 0 });
  });
});
