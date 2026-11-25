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

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildPrefillReason,
  compareQueueRows,
  countMalformedExclusions,
  countMalformedReviewed,
  deriveFlaggedActivities,
  deriveOrphans,
  fingerprintFor,
  QUEUE_VIEWS,
  rowsForView,
  summarizeQueue,
  summarizeViews,
} from './derive-flagged.mjs';
import { recountDemotedActivities } from '../compute-pr-ceiling-recount.mjs';

// REPO_ROOT resolution idiom mirrors scripts/lib/curation-guard.test.mjs.
const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const BEST_EFFORTS_PATH = path.resolve(REPO_ROOT, 'data/stats/best-efforts.json');
const EXCLUSIONS_PATH = path.resolve(REPO_ROOT, 'data/best-effort-exclusions.json');
const DERIVE_PATH = path.resolve(REPO_ROOT, 'scripts/curate-queue/derive-flagged.mjs');

describe('collection canary', () => {
  it('the exports are functions', () => {
    expect(typeof deriveFlaggedActivities).toBe('function');
    expect(typeof buildPrefillReason).toBe('function');
    expect(typeof summarizeQueue).toBe('function');
    expect(typeof compareQueueRows).toBe('function');
    expect(typeof countMalformedExclusions).toBe('function');
    for (const fn of [fingerprintFor, countMalformedReviewed, rowsForView, deriveOrphans, summarizeViews]) {
      expect(typeof fn).toBe('function');
    }
    expect(QUEUE_VIEWS).toEqual(['to-review', 'reviewed', 'excluded', 'all']);
  });
});

function effort(distance, guard, reason, durationSec = 100, paceSecPerKm = 250, contaminated = null) {
  return {
    distance,
    durationSec,
    paceSecPerKm,
    demotion: guard === null ? null : { guard, reason },
    contaminated,
  };
}

function contam(durationSec = 90, paceSecPerKm = 240) {
  return {
    guard: 'unreliable-segment',
    reason: 'contaminated window',
    durationSec,
    paceSecPerKm,
    startOffsetSec: 0,
    endOffsetSec: durationSec,
  };
}

function activity(startDate, efforts, excludedFromRecords = false, contaminatedMetres = undefined) {
  const entry = { startDate, efforts, excludedFromRecords };
  if (contaminatedMetres !== undefined) entry.contaminatedMetres = contaminatedMetres;
  return entry;
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

  // D-17 evidence (Phase 36, plan 36-09): Phase 36 adds the 'unreliable-segment' guard value.
  // No file under scripts/curate-queue/ is touched by Phase 36 — this describe block already
  // existed as D-01's "not ceiling-only" population proof, and these three tests extend it with
  // the new guard specifically. This is EVIDENCE that the untouched queue admits the new guard
  // through the same guard-agnostic path it already uses for the other three, not a queue
  // feature: D-17 explicitly forbids assuming this without a test proving it, because
  // VALID_DEMOTION_GUARDS (the browser's allowlist) is exactly the kind of mechanism that fails
  // silently on an unlisted guard, and deriveFlaggedActivities has no allowlist of its own to
  // fail the same way.
  it('D-17 evidence: a best-efforts document whose only demoted effort carries the new unreliable-segment guard produces exactly one queue row, with guard and reason passed through verbatim (no allowlist filters it out)', () => {
    const reason = 'no clean window at this distance: every candidate window intersects a detected unreliable segment';
    const doc = {
      activities: {
        a1: activity('2024-01-01T00:00:00Z', [effort('10k', 'unreliable-segment', reason)]),
      },
    };
    const rows = deriveFlaggedActivities(doc, {});
    expect(rows.length).toBe(1);
    expect(rows[0].flaggedEfforts.length).toBe(1);
    expect(rows[0].flaggedEfforts[0].guard).toBe('unreliable-segment');
    expect(rows[0].flaggedEfforts[0].reason).toBe(reason);
    // A filtered derivation (an allowlist checking only the original three guards) would have
    // dropped this row entirely — the row count above, not just the guard string, is the proof
    // there is no allowlist: a filter that silently excluded 'unreliable-segment' would still
    // pass a bare guard-string assertion on a row that was never produced. Asserting length 1
    // catches that failure mode the guard-string assertion alone would miss.
    expect(rows.length).not.toBe(0);
  });

  it('D-17 evidence: a document mixing all FOUR guards on one activity produces four flagged efforts — a derivation that knew only the original three would return 3', () => {
    const doc = {
      activities: {
        a1: activity('2024-01-01T00:00:00Z', [
          effort('400m', 'ceiling', 'ceiling reason'),
          effort('1k', 'world-record', 'wr reason'),
          effort('1mi', 'max-speed', 'ms reason'),
          effort('10k', 'unreliable-segment', 'no clean window at this distance'),
        ]),
      },
    };
    const rows = deriveFlaggedActivities(doc, {});
    expect(rows.length).toBe(1);
    expect(rows[0].flaggedEfforts.length).toBe(4);
    const guards = rows[0].flaggedEfforts.map((e) => e.guard).sort();
    expect(guards).toEqual(['ceiling', 'max-speed', 'unreliable-segment', 'world-record']);
  });

  it('D-17 evidence: buildPrefillReason includes the unreliable-segment effort line, so the prefill the queue writes is not silently missing it', () => {
    const doc = {
      activities: {
        a1: activity('2024-01-01T00:00:00Z', [
          effort('1k', 'world-record', 'wr reason'),
          effort('10k', 'unreliable-segment', 'no clean window at this distance'),
        ]),
      },
    };
    const rows = deriveFlaggedActivities(doc, {});
    expect(rows.length).toBe(1);
    expect(rows[0].prefillReason).toContain('10k: no clean window at this distance');
    expect(rows[0].prefillReason).toBe('1k: wr reason\n10k: no clean window at this distance');
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

// Fixture Q (hand-built; every expected value is derived here from the fixture, never from live data).
//   tier 1 (transported, index transportedCount > 0): T1 metres 40 (2021), T0 metres 0 (2024),
//     TX no best-efforts entry at all (index startDate 2023), TC transported + ceiling demotion, 0 (2022-06)
//   tier 2 (guard-moved): G1 contaminated 120 (2020-01), G2 Branch-3 demotion 30 (2020-05),
//     G3 contaminated 30 (2022-01), GC contaminated 400m + ceiling 1k, 10 (2019)
//   tier 3 (other demotions, no metres key): C1 ceiling (2023-03), W1 world-record (2018)
//   N1: no flags, not transported -> absent
// Derivation of the order: tier asc. Tier 1 by metres desc: T1 (40), then the three 0s by startDate
//   desc: T0 2024, TX 2023, TC 2022. Tier 2 by metres desc: G1 120, then the 30 tie broken newest-first
//   G3 2022 before G2 2020, then GC 10. Tier 3 by startDate desc: C1 2023, W1 2018.
const Q_ORDER = ['T1', 'T0', 'TX', 'TC', 'G1', 'G3', 'G2', 'GC', 'C1', 'W1'];

function fixtureQ(keyOrder = null) {
  const entries = {
    T1: activity('2021-01-01T00:00:00Z', [effort('400m', null, '', 100, 250, contam())], false, 40),
    T0: activity('2024-01-01T00:00:00Z', [effort('400m', null, '')], false, 0),
    TC: activity('2022-06-01T00:00:00Z', [effort('1k', 'ceiling', 'ceiling reason')], false, 0),
    G1: activity('2020-01-01T00:00:00Z', [effort('400m', null, '', 100, 250, contam())], false, 120),
    G2: activity('2020-05-01T00:00:00Z', [effort('1k', 'unreliable-segment', 'no clean window')], false, 30),
    G3: activity('2022-01-01T00:00:00Z', [effort('400m', null, '', 100, 250, contam())], false, 30),
    GC: activity(
      '2019-01-01T00:00:00Z',
      [effort('400m', null, '', 100, 250, contam()), effort('1k', 'ceiling', 'gc ceiling reason')],
      false,
      10
    ),
    C1: activity('2023-03-01T00:00:00Z', [effort('400m', 'ceiling', 'c1 ceiling reason')]),
    W1: activity('2018-01-01T00:00:00Z', [effort('1k', 'world-record', 'w1 wr reason')]),
    N1: activity('2025-01-01T00:00:00Z', [effort('400m', null, '')], false, 0),
  };
  const keys = keyOrder ?? Object.keys(entries);
  const bestEfforts = { activities: Object.fromEntries(keys.map((k) => [k, entries[k]])) };
  const indexRows = [
    { id: 'T1', startDate: '2021-01-01T00:00:00Z', quality: { pauseClassification: { transportedCount: 1 } } },
    { id: 'T0', startDate: '2024-01-01T00:00:00Z', quality: { pauseClassification: { transportedCount: 2 } } },
    { id: 'TX', startDate: '2023-01-01T00:00:00Z', quality: { pauseClassification: { transportedCount: 1 } } },
    { id: 'TC', startDate: '2022-06-01T00:00:00Z', quality: { pauseClassification: { transportedCount: 1 } } },
    { id: 'N1', startDate: '2025-01-01T00:00:00Z', quality: { pauseClassification: { transportedCount: 0 } } },
  ];
  return { bestEfforts, indexDoc: { activities: keyOrder ? [...indexRows].reverse() : indexRows } };
}

describe('deriveFlaggedActivities — D-08 ordering', () => {
  it('fixture Q orders exactly as derived above', () => {
    const { bestEfforts, indexDoc } = fixtureQ();
    const rows = deriveFlaggedActivities(bestEfforts, {}, indexDoc);
    expect(rows.map((r) => r.activityId)).toEqual(Q_ORDER);
    expect(rows.map((r) => r.tier)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3]);
    expect(rows.map((r) => r.contaminatedMetres)).toEqual([40, 0, 0, 0, 120, 30, 30, 10, null, null]);
  });

  it('D-06: TX has no best-efforts entry yet is present, metres 0, not missing, no flagged efforts, start date from the index', () => {
    const { bestEfforts, indexDoc } = fixtureQ();
    expect(bestEfforts.activities.TX).toBeUndefined();
    const tx = deriveFlaggedActivities(bestEfforts, {}, indexDoc).find((r) => r.activityId === 'TX');
    expect(tx).toMatchObject({
      tier: 1,
      contaminatedMetres: 0,
      metresMissing: false,
      transported: true,
      flaggedEfforts: [],
      startDate: '2023-01-01T00:00:00Z',
    });
  });

  it('N1 (no flags, transportedCount 0) is absent', () => {
    const { bestEfforts, indexDoc } = fixtureQ();
    const ids = deriveFlaggedActivities(bestEfforts, {}, indexDoc).map((r) => r.activityId);
    expect(ids).not.toContain('N1');
  });

  it('TC is transported AND ceiling-demoted: tier 1 wins (not tier 3)', () => {
    const { bestEfforts, indexDoc } = fixtureQ();
    const tc = deriveFlaggedActivities(bestEfforts, {}, indexDoc).find((r) => r.activityId === 'TC');
    expect(tc.tier).toBe(1);
    expect(tc.flaggedEfforts.length).toBe(1);
  });

  it('GC: a guard-moved effort beats a plain ceiling demotion (tier 2, not 3)', () => {
    const { bestEfforts, indexDoc } = fixtureQ();
    const gc = deriveFlaggedActivities(bestEfforts, {}, indexDoc).find((r) => r.activityId === 'GC');
    expect(gc.tier).toBe(2);
  });

  it('D-17: GC prefill carries only the ceiling line; the 400m contaminated line is listed separately', () => {
    const { bestEfforts, indexDoc } = fixtureQ();
    const gc = deriveFlaggedActivities(bestEfforts, {}, indexDoc).find((r) => r.activityId === 'GC');
    expect(gc.prefillReason).toBe('1k: gc ceiling reason');
    expect(gc.contaminatedEfforts.map((e) => `${e.distance}:${e.guard}`)).toEqual(['400m:unreliable-segment']);
    expect(gc.flaggedEfforts.map((e) => e.distance)).toEqual(['1k']);
  });

  it('stale or invalid contaminatedMetres reads as 0 and is counted metresMissing (D-07, fail closed)', () => {
    for (const bad of [undefined, NaN, -5, '120', null, Infinity]) {
      const { bestEfforts, indexDoc } = fixtureQ();
      if (bad === undefined) delete bestEfforts.activities.G1.contaminatedMetres;
      else bestEfforts.activities.G1.contaminatedMetres = bad;
      const g1 = deriveFlaggedActivities(bestEfforts, {}, indexDoc).find((r) => r.activityId === 'G1');
      expect(g1.contaminatedMetres, String(bad)).toBe(0);
      expect(g1.metresMissing, String(bad)).toBe(true);
    }
    const { bestEfforts, indexDoc } = fixtureQ();
    const rows = deriveFlaggedActivities(bestEfforts, {}, indexDoc);
    // a valid 0 (T0) is not missing; tier 3 rows are not missing
    expect(rows.filter((r) => r.metresMissing)).toEqual([]);
  });

  it('two rows with identical startDate and metres sort by activityId ascending', () => {
    const doc = {
      activities: {
        b2: activity('2024-01-01T00:00:00Z', [effort('400m', 'ceiling', 'r')]),
        a1: activity('2024-01-01T00:00:00Z', [effort('400m', 'ceiling', 'r')]),
      },
    };
    const rows = deriveFlaggedActivities(doc, {});
    expect(rows.map((r) => r.activityId)).toEqual(['a1', 'b2']);
    const g = {
      activities: {
        y: activity('2024-01-01T00:00:00Z', [effort('400m', null, '', 1, 1, contam())], false, 7),
        x: activity('2024-01-01T00:00:00Z', [effort('400m', null, '', 1, 1, contam())], false, 7),
      },
    };
    expect(deriveFlaggedActivities(g, {}).map((r) => r.activityId)).toEqual(['x', 'y']);
  });

  it('the order is total and reload-stable: 5 different input key orders give the identical output', () => {
    const baseline = deriveFlaggedActivities(fixtureQ().bestEfforts, {}, fixtureQ().indexDoc).map((r) => r.activityId);
    const keys = Object.keys(fixtureQ().bestEfforts.activities);
    const orders = [
      [...keys].reverse(),
      [...keys.slice(3), ...keys.slice(0, 3)],
      [...keys.slice(7), ...keys.slice(0, 7)],
      [...keys].sort(),
      [...keys].sort().reverse(),
    ];
    for (const order of orders) {
      const { bestEfforts, indexDoc } = fixtureQ(order);
      expect(deriveFlaggedActivities(bestEfforts, {}, indexDoc).map((r) => r.activityId)).toEqual(baseline);
    }
    expect(baseline).toEqual(Q_ORDER);
  });

  it('excluded rows are no longer sorted last: an excluded tier-1 row stays in tier order (D-08 retires the excluded-first comparator)', () => {
    const { bestEfforts, indexDoc } = fixtureQ();
    const rows = deriveFlaggedActivities(bestEfforts, { exclusions: [{ activityId: 'T1', reason: 'r' }] }, indexDoc);
    expect(rows.map((r) => r.activityId)).toEqual(Q_ORDER);
    expect(rows[0].excluded).toBe(true);
  });
});

describe('fingerprintFor — D-12', () => {
  const e400 = { distance: '400m', demotion: { guard: 'ceiling', reason: 'r1' }, contaminated: null, durationSec: 10 };
  const e1k = {
    distance: '1k',
    demotion: null,
    contaminated: { guard: 'unreliable-segment', reason: 'r2', durationSec: 5 },
    durationSec: 20,
  };

  it("is the sorted token set then |t=; '1k:...' sorts before '400m:...' because '1' < '4'", () => {
    expect(fingerprintFor([e400, e1k], false)).toBe('1k:contaminated:unreliable-segment,400m:demoted:ceiling|t=0');
  });

  it('an empty effort list with transported is exactly |t=1', () => {
    expect(fingerprintFor([], true)).toBe('|t=1');
    expect(fingerprintFor([], false)).toBe('|t=0');
  });

  it('is independent of effort order, durations, reasons and metres', () => {
    const base = fingerprintFor([e400, e1k], false);
    expect(fingerprintFor([e1k, e400], false)).toBe(base);
    const drifted = [
      { ...e400, durationSec: 999, paceSecPerKm: 1, demotion: { guard: 'ceiling', reason: 'other words' } },
      { ...e1k, contaminated: { guard: 'unreliable-segment', reason: 'x', durationSec: 1234 }, contaminatedMetres: 77 },
    ];
    expect(fingerprintFor(drifted, false)).toBe(base);
  });

  it('a new distance flag, a new guard, or transported each change it', () => {
    const base = fingerprintFor([e400], false);
    expect(fingerprintFor([e400, e1k], false)).not.toBe(base);
    expect(fingerprintFor([{ ...e400, demotion: { guard: 'world-record', reason: 'r' } }], false)).not.toBe(base);
    expect(fingerprintFor([e400], true)).not.toBe(base);
  });

  it('duplicate tokens collapse to one', () => {
    const dup = { distance: '400m', demotion: { guard: 'ceiling', reason: 'again' }, contaminated: null };
    expect(fingerprintFor([e400, dup], false)).toBe('400m:demoted:ceiling|t=0');
  });

  it('every row carries fingerprint = fingerprintFor(its efforts, transported)', () => {
    const { bestEfforts, indexDoc } = fixtureQ();
    const rows = deriveFlaggedActivities(bestEfforts, {}, indexDoc);
    const gc = rows.find((r) => r.activityId === 'GC');
    // GC: 400m contaminated unreliable-segment + 1k ceiling, not transported
    expect(gc.fingerprint).toBe('1k:demoted:ceiling,400m:contaminated:unreliable-segment|t=0');
    const tx = rows.find((r) => r.activityId === 'TX');
    expect(tx.fingerprint).toBe('|t=1');
    const tc = rows.find((r) => r.activityId === 'TC');
    expect(tc.fingerprint).toBe('1k:demoted:ceiling|t=1');
  });
});

// CR-01 (D-12 amended 2026-11-25): Branch 3 (demoted under 'unreliable-segment', does not rank) and
// Branch 2 (contaminated under 'unreliable-segment', ranks on a clean window) carry the SAME guard
// string, but opposite effects on the public records. The fingerprint must tell them apart, or a
// reviewed-and-kept row stays hidden while a PR it never covered appears or disappears.
describe('fingerprintFor — CR-01 demoted vs contaminated under the same guard', () => {
  const demoted5k = effort('5k', 'unreliable-segment', 'no clean window');
  const contaminated5k = effort('5k', null, '', 1200, 240, contam(1200, 240));

  it('a 5k demoted effort and a 5k contaminated effort under the same guard fingerprint differently', () => {
    expect(fingerprintFor([demoted5k], false)).not.toBe(fingerprintFor([contaminated5k], false));
    expect(fingerprintFor([demoted5k], true)).not.toBe(fingerprintFor([contaminated5k], true));
  });

  it('tokens are <distance>:<kind>:<guard>, kind is demoted or contaminated', () => {
    expect(fingerprintFor([demoted5k], false)).toBe('5k:demoted:unreliable-segment|t=0');
    expect(fingerprintFor([contaminated5k], false)).toBe('5k:contaminated:unreliable-segment|t=0');
  });

  function flipDoc(eff) {
    return { activities: { F1: activity('2024-03-01T00:00:00Z', [eff], false, 25) } };
  }

  it('a reviewed row resurfaces as changed when its 5k flips demoted -> contaminated (and back)', () => {
    for (const [from, to] of [
      [demoted5k, contaminated5k],
      [contaminated5k, demoted5k],
    ]) {
      const [atReview] = deriveFlaggedActivities(flipDoc(from), {}, null);
      const reviewed = {
        reviewed: [
          { activityId: 'F1', reason: 'kept', reviewedAt: '2026-11-25T10:00:00.000Z', fingerprint: atReview.fingerprint },
        ],
      };
      // Control: unchanged evidence stays reviewed, so 'changed' below is not vacuous.
      const [same] = deriveFlaggedActivities(flipDoc(from), {}, null, reviewed);
      expect(same.reviewState).toBe('reviewed');
      const [flipped] = deriveFlaggedActivities(flipDoc(to), {}, null, reviewed);
      expect(flipped.reviewState).toBe('changed');
      expect(flipped.reviewedFingerprint).toBe(atReview.fingerprint);
      expect(rowsForView([flipped], 'to-review').map((r) => r.activityId)).toEqual(['F1']);
    }
  });
});

// Review overlay over fixture Q. Fingerprints, derived from the fixture:
//   G1: 400m contaminated unreliable-segment, not transported -> '400m:contaminated:unreliable-segment|t=0'
//   G3: same shape -> '400m:contaminated:unreliable-segment|t=0'
//   C1: 400m ceiling -> '400m:demoted:ceiling|t=0'
const G_FP = '400m:contaminated:unreliable-segment|t=0';
function reviewedDocFor() {
  return {
    reviewed: [
      { activityId: 'G1', reason: 'kept: jump is on a bridge', reviewedAt: '2026-11-01T10:00:00.000Z', fingerprint: G_FP },
      // stale: a token was removed (an extra 1k flag existed at review time); G3 now has only 400m
      { activityId: 'G3', reason: 'old reason', reviewedAt: '2026-10-01T10:00:00.000Z', fingerprint: `1k:demoted:ceiling,${G_FP}` },
      { activityId: 'C1', reason: 'hand edit', reviewedAt: '2026-11-02T10:00:00.000Z', fingerprint: '400m:demoted:ceiling|t=0' },
      { activityId: 'ghost', reason: 'gone', reviewedAt: '2026-09-01T10:00:00.000Z', fingerprint: 'x|t=0' },
    ],
  };
}
function overlayRows() {
  const { bestEfforts, indexDoc } = fixtureQ();
  const exclusions = { exclusions: [{ activityId: 'C1', reason: 'excluded too' }] };
  const reviewed = reviewedDocFor();
  return { rows: deriveFlaggedActivities(bestEfforts, exclusions, indexDoc, reviewed), reviewed };
}

describe('review overlay, views, orphans — D-10 D-11 D-13 D-15', () => {
  it('G1 with its current fingerprint is reviewed, carrying reason and date', () => {
    const g1 = overlayRows().rows.find((r) => r.activityId === 'G1');
    expect(g1).toMatchObject({
      reviewState: 'reviewed',
      reviewReason: 'kept: jump is on a bridge',
      reviewedAt: '2026-11-01T10:00:00.000Z',
    });
  });

  it('G3 with a stale fingerprint is changed and carries the old reason and date', () => {
    const g3 = overlayRows().rows.find((r) => r.activityId === 'G3');
    expect(g3).toMatchObject({
      reviewState: 'changed',
      reviewReason: 'old reason',
      reviewedAt: '2026-10-01T10:00:00.000Z',
      reviewedFingerprint: `1k:demoted:ceiling,${G_FP}`,
    });
  });

  it('C1 excluded AND reviewed is flagged reviewConflict and appears only under Excluded', () => {
    const { rows } = overlayRows();
    const c1 = rows.find((r) => r.activityId === 'C1');
    expect(c1.reviewConflict).toBe(true);
    expect(rowsForView(rows, 'excluded').map((r) => r.activityId)).toEqual(['C1']);
    expect(rowsForView(rows, 'reviewed').map((r) => r.activityId)).not.toContain('C1');
    expect(rowsForView(rows, 'to-review').map((r) => r.activityId)).not.toContain('C1');
    expect(rows.filter((r) => r.activityId !== 'C1').every((r) => r.reviewConflict === false)).toBe(true);
  });

  it('views: to-review keeps G3 (changed), drops G1 and C1, preserves comparator order', () => {
    const { rows } = overlayRows();
    // Q_ORDER minus G1 (reviewed) and C1 (excluded)
    expect(rowsForView(rows, 'to-review').map((r) => r.activityId)).toEqual([
      'T1', 'T0', 'TX', 'TC', 'G3', 'G2', 'GC', 'W1',
    ]);
    expect(rowsForView(rows, 'reviewed').map((r) => r.activityId)).toEqual(['G1']);
    expect(rowsForView(rows, 'all').map((r) => r.activityId)).toEqual(Q_ORDER);
    expect(rowsForView(rows, 'nonsense').map((r) => r.activityId)).toEqual(
      rowsForView(rows, 'to-review').map((r) => r.activityId)
    );
  });

  it('deriveOrphans returns the ghost entry, never dropped', () => {
    const { rows, reviewed } = overlayRows();
    expect(deriveOrphans(rows, reviewed)).toEqual([
      { activityId: 'ghost', reason: 'gone', reviewedAt: '2026-09-01T10:00:00.000Z', fingerprint: 'x|t=0' },
    ]);
  });

  it('orphans sort by reviewedAt descending, then activityId', () => {
    const doc = {
      reviewed: [
        { activityId: 'b', reason: 'r', reviewedAt: '2026-01-01T00:00:00Z', fingerprint: 'f' },
        { activityId: 'a', reason: 'r', reviewedAt: '2026-01-01T00:00:00Z', fingerprint: 'f' },
        { activityId: 'c', reason: 'r', reviewedAt: '2026-05-01T00:00:00Z', fingerprint: 'f' },
      ],
    };
    expect(deriveOrphans([], doc).map((o) => o.activityId)).toEqual(['c', 'a', 'b']);
  });

  it('summarizeViews counts, derived from the fixture', () => {
    const { rows, reviewed } = overlayRows();
    const orphans = deriveOrphans(rows, reviewed);
    // rows 10: to-review 8 (above), of which changed 1 (G3); reviewed rows 1 (G1) + orphans 1 = 2;
    // excluded 1 (C1); all 10; metresMissing 0; conflicts 1 (C1)
    expect(summarizeViews(rows, orphans)).toEqual({
      toReview: 8,
      changed: 1,
      reviewed: 2,
      excluded: 1,
      all: 10,
      orphans: 1,
      metresMissing: 0,
      conflicts: 1,
    });
  });

  it('without a reviewedDoc every row is reviewState none', () => {
    const { bestEfforts, indexDoc } = fixtureQ();
    const rows = deriveFlaggedActivities(bestEfforts, {}, indexDoc);
    expect(rows.every((r) => r.reviewState === 'none' && r.reviewReason === null && !r.reviewConflict)).toBe(true);
  });

  it('a malformed reviewed entry never marks a row reviewed', () => {
    const { bestEfforts, indexDoc } = fixtureQ();
    const doc = { reviewed: [{ activityId: 'G1', reason: '   ', reviewedAt: '2026-11-01T10:00:00Z', fingerprint: G_FP }] };
    const g1 = deriveFlaggedActivities(bestEfforts, {}, indexDoc, doc).find((r) => r.activityId === 'G1');
    expect(g1.reviewState).toBe('none');
  });
});

describe('countMalformedReviewed — D-05', () => {
  const good = { activityId: 'ok', reason: 'r', reviewedAt: '2026-11-01T10:00:00Z', fingerprint: 'f' };

  it('the clean doc counts 0', () => {
    expect(countMalformedReviewed({ reviewed: [good] })).toBe(0);
  });

  it('a planted doc with eight classes counts exactly 8', () => {
    // 1 null entry, 2 numeric activityId, 3 __proto__ id, 4 whitespace reason, 5 unparseable
    // reviewedAt, 6 missing reviewedAt, 7 numeric fingerprint, 8 duplicate id (second 'ok').
    // The first 'ok' is well formed and counts 0.
    const doc = JSON.parse(
      JSON.stringify({
        reviewed: [
          good,
          null,
          { ...good, activityId: 5 },
          { ...good, activityId: 'p' },
          { ...good, activityId: 'ws', reason: '   ' },
          { ...good, activityId: 'bad', reviewedAt: 'not a date' },
          { activityId: 'nodate', reason: 'r', fingerprint: 'f' },
          { ...good, activityId: 'fp', fingerprint: 42 },
          { ...good, reason: 'second ok' },
        ],
      }).replace('"activityId":"p"', '"activityId":"__proto__"')
    );
    expect(countMalformedReviewed(doc)).toBe(8);
  });

  it('a missing, null or wrongly shaped doc counts 0 and never throws', () => {
    expect(countMalformedReviewed(null)).toBe(0);
    expect(countMalformedReviewed(undefined)).toBe(0);
    expect(countMalformedReviewed({ reviewed: 'x' })).toBe(0);
  });
});

describe('derive-flagged.mjs zero-import, zero-console contract', () => {
  function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');
  }
  function violations(source) {
    const stripped = stripComments(source);
    return {
      hasImport: /^\s*import\b/m.test(stripped),
      hasConsole: /\bconsole\./.test(stripped),
    };
  }

  it('the scan is reachable: a planted fixture with an import and a console call is flagged, and comment-only mentions are not', () => {
    const planted = ['// import x from "y"', '/* console.log(1) */', "import fs from 'fs';", 'console.log(1);'].join('\n');
    expect(violations(planted)).toEqual({ hasImport: true, hasConsole: true });
    const commentOnly = ['// import x from "y"', '/* console.log(1) */', 'const a = 1;'].join('\n');
    expect(violations(commentOnly)).toEqual({ hasImport: false, hasConsole: false });
  });

  it('derive-flagged.mjs has no import and no console statement once comments are stripped', () => {
    const raw = readFileSync(DERIVE_PATH, 'utf8');
    expect(violations(raw)).toEqual({ hasImport: false, hasConsole: false });
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

describe('countMalformedExclusions — malformed exclusion entries (D-09)', () => {
  it('a well-formed document with no malformed entries counts 0', () => {
    const exclusionsDoc = { exclusions: [{ activityId: 'a1', reason: 'bad GPS device' }] };
    expect(countMalformedExclusions(exclusionsDoc)).toBe(0);
  });

  it('a non-string activityId is counted as one malformed entry', () => {
    const exclusionsDoc = { exclusions: [{ activityId: 123, reason: 'bad GPS device' }] };
    expect(countMalformedExclusions(exclusionsDoc)).toBe(1);
  });

  it("activityId === '__proto__' is counted as one malformed entry", () => {
    const exclusionsDoc = JSON.parse(
      '{"exclusions": [{"activityId": "__proto__", "reason": "r"}]}'
    );
    expect(countMalformedExclusions(exclusionsDoc)).toBe(1);
  });

  it('a non-string reason is counted as one malformed entry', () => {
    const exclusionsDoc = { exclusions: [{ activityId: 'a1', reason: null }] };
    expect(countMalformedExclusions(exclusionsDoc)).toBe(1);
  });

  it('an empty or whitespace-only reason is counted as malformed, one per entry', () => {
    const exclusionsDoc = {
      exclusions: [
        { activityId: 'a1', reason: '' },
        { activityId: 'a2', reason: '   ' },
      ],
    };
    expect(countMalformedExclusions(exclusionsDoc)).toBe(2);
  });

  it('two entries sharing one activityId are counted as a single malformed collision', () => {
    const exclusionsDoc = {
      exclusions: [
        { activityId: 'a1', reason: 'first reason' },
        { activityId: 'a1', reason: 'second reason' },
      ],
    };
    expect(countMalformedExclusions(exclusionsDoc)).toBe(1);
  });

  it('a missing or null document counts 0 malformed entries, never throws', () => {
    expect(() => countMalformedExclusions(null)).not.toThrow();
    expect(countMalformedExclusions(null)).toBe(0);
    expect(countMalformedExclusions(undefined)).toBe(0);
  });

  it('a document whose exclusions is not an array counts 0 malformed entries, never throws', () => {
    expect(() => countMalformedExclusions({ exclusions: 'not-an-array' })).not.toThrow();
    expect(countMalformedExclusions({ exclusions: 'not-an-array' })).toBe(0);
  });

  it('deriveFlaggedActivities returns identical rows whether malformed exclusion entries are present or removed', () => {
    const doc = {
      activities: {
        a1: activity('2024-01-01T00:00:00Z', [effort('400m', 'ceiling', 'ceiling reason')]),
      },
    };
    const exclusionsWithMalformed = {
      exclusions: [
        { activityId: 123, reason: 'bad' },
        { activityId: '__proto__', reason: 'bad' },
        { activityId: 'a1', reason: '' },
      ],
    };
    const exclusionsWithoutMalformed = { exclusions: [] };
    expect(countMalformedExclusions(exclusionsWithMalformed)).toBe(3);
    const rowsWithMalformed = deriveFlaggedActivities(doc, exclusionsWithMalformed);
    const rowsWithoutMalformed = deriveFlaggedActivities(doc, exclusionsWithoutMalformed);
    expect(rowsWithMalformed).toEqual(rowsWithoutMalformed);
  });
});

describe('countMalformedExclusions vs. recountDemotedActivities — CR-01 parity', () => {
  const emptyBestEfforts = { activities: {} };

  it('agree on a planted document with a null entry and primitive entries (CR-01 reproduction)', () => {
    const exclusionsDoc = {
      exclusions: [null, { activityId: 'X', reason: 'ok' }],
    };
    const recount = recountDemotedActivities(emptyBestEfforts, exclusionsDoc);
    expect(countMalformedExclusions(exclusionsDoc)).toBe(recount.malformedExclusions.length);
    expect(countMalformedExclusions(exclusionsDoc)).toBe(1);
  });

  it('agree on a planted document containing only primitive (non-object) entries', () => {
    const exclusionsDoc = { exclusions: ['garbage', 42] };
    const recount = recountDemotedActivities(emptyBestEfforts, exclusionsDoc);
    expect(countMalformedExclusions(exclusionsDoc)).toBe(recount.malformedExclusions.length);
    expect(countMalformedExclusions(exclusionsDoc)).toBe(2);
  });

  it('agree on a rejected entry followed by a well-formed entry sharing its activityId (WR-02)', () => {
    const exclusionsDoc = {
      exclusions: [
        { activityId: 'X', reason: '' },
        { activityId: 'X', reason: 'ok' },
      ],
    };
    const recount = recountDemotedActivities(emptyBestEfforts, exclusionsDoc);
    expect(countMalformedExclusions(exclusionsDoc)).toBe(recount.malformedExclusions.length);
    expect(countMalformedExclusions(exclusionsDoc)).toBe(1);
    expect(recount.exclusionsTotal).toBe(1);
  });

  it('agree on a planted document containing every malformed class at once (null entry, primitive entry, non-string id, __proto__, empty reason, duplicate, WR-02 rejected-then-repeated pair)', () => {
    const exclusionsDoc = {
      exclusions: [
        null,
        'garbage',
        { activityId: 123, reason: 'numeric id' },
        { activityId: '__proto__', reason: 'malicious' },
        { activityId: 'empty-reason', reason: '' },
        { activityId: 'dup', reason: 'first' },
        { activityId: 'dup', reason: 'second' },
        { activityId: 'rejected-then-repeated', reason: '' },
        { activityId: 'rejected-then-repeated', reason: 'ok' },
        { activityId: 'well-formed', reason: 'fine' },
      ],
    };
    const recount = recountDemotedActivities(emptyBestEfforts, exclusionsDoc);
    expect(countMalformedExclusions(exclusionsDoc)).toBe(recount.malformedExclusions.length);
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

// D-16 / Task 3: ties this derivation to scripts/compute-pr-ceiling-recount.mjs's own arithmetic,
// which imports none of the ceiling/compute/util/types modules. Two independent implementations
// agreeing is the assertion; no count is ever hardcoded here, since the archive grows nightly
// via CI sync (T-29-14). Skipped when the shipped data is absent (e.g. a fresh worktree where
// data/stats/ and data/dashboard/ are gitignored).
// Phase 37: the queue is now a superset (union, D-06), so this check is re-scoped to the
// demotion-bearing subset (rows with flaggedEfforts), which preserves the Phase 29 D-01 guarantee.
// Full-set count and order move to plan 37-05's independent recount.
describe.skipIf(!existsSync(BEST_EFFORTS_PATH))('live archive cross-check', () => {
  it('the demotion-bearing subset of deriveFlaggedActivities agrees with recountDemotedActivities on the live archive', () => {
    const bestEfforts = JSON.parse(readFileSync(BEST_EFFORTS_PATH, 'utf8'));
    const exclusions = existsSync(EXCLUSIONS_PATH)
      ? JSON.parse(readFileSync(EXCLUSIONS_PATH, 'utf8'))
      : undefined;

    const rows = deriveFlaggedActivities(bestEfforts, exclusions).filter((r) => r.flaggedEfforts.length > 0);
    const recount = recountDemotedActivities(bestEfforts, exclusions);

    expect(rows.length).toBe(recount.flaggedActivityCount);
    expect(summarizeQueue(rows).excludedCount).toBe(recount.excludedWithinFlaggedCount);
    expect(rows.map((r) => r.activityId).sort()).toEqual(recount.flaggedActivityIds);
  });
});
