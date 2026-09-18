/**
 * Guard test for the pure helpers exported by compute-pr-ceiling-recount.mjs (Phase 28 plan 08,
 * D-15). Importing this module must not read `data/stats/best-efforts.json` or
 * `data/dashboard/index.json` as an import-time side effect — the self-execution guard
 * documented at the bottom of compute-pr-ceiling-recount.mjs is what prevents that.
 *
 * Every function case drives its target on a hand-built document; none reads the real archive.
 * The zero-import guard is the one part of this file that reads the real SOURCE (not data) of
 * compute-pr-ceiling-recount.mjs, because that is the only way to prove the discipline D-15
 * requires actually holds — mirroring compute-pace-quality-recount.mjs's import-time-side-effect
 * guard and this project's `curate-overlay.test.mjs` / `row-semantics.test.ts` comment-stripping
 * precedent.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';

import {
  computeCohortOverlap,
  evaluateReport,
  parseExpectFlags,
  parseInputPaths,
  readShippedJson,
  recountCeilingSweep,
  recountDemoted,
  recountDemotedActivities,
  recountImpossibleSampleCohort,
} from './compute-pr-ceiling-recount.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('./compute-pr-ceiling-recount.mjs', import.meta.url));
const FORBIDDEN_MODULE_NAMES = [
  'best-effort-ceiling',
  'compute-best-efforts',
  'best-effort-utils',
  'best-effort.types',
];

/**
 * Strips comments BEFORE searching for forbidden module names. The comment-stripping order is
 * load-bearing: compute-pr-ceiling-recount.mjs's own header comment legitimately NAMES all four
 * forbidden modules in its docblock explaining why they are forbidden, so a naive raw-source
 * grep would fail on the script's own prose — the exact self-invalidating-grep trap this project
 * has hit before (see D-15's guard requirement and the `curate-overlay.test.mjs` precedent).
 * Block comments first, then `//`-to-end-of-line, mirroring the project's other stripComments
 * helpers.
 */
function stripComments(source) {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

describe('zero-import guard (D-15)', () => {
  it('the stripper actually removes a line naming a forbidden module — proving it works rather than assuming it', () => {
    const fixture = [
      'const ok = 1;',
      "// imports dist/analytics/best-effort-ceiling.js, forbidden",
      '/* also forbidden: compute-best-efforts and best-effort-utils and best-effort.types */',
      'const alsoOk = 2;',
    ].join('\n');

    const stripped = stripComments(fixture);

    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(fixture).toContain(forbidden); // sanity: the raw fixture DOES name every module
      expect(stripped).not.toContain(forbidden); // the stripper removed every one of them
    }
    expect(stripped).toContain('const ok = 1;');
    expect(stripped).toContain('const alsoOk = 2;');
  });

  it('compute-pr-ceiling-recount.mjs contains none of the four forbidden module names once comments are stripped', () => {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    const stripped = stripComments(raw);

    // Sanity check first: the RAW source legitimately names all four modules (in its header
    // docblock, explaining why they are forbidden) — if this failed, the test above would be
    // vacuous (never actually exercising the stripper on real content).
    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(raw).toContain(forbidden);
    }

    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(stripped).not.toContain(forbidden);
    }
  });
});

/** Minimal best-efforts-shaped fixture builder. */
function bestEffortsDoc({ activities = {}, rankings = {}, rejected = [], totalsOverride = {} } = {}) {
  const ownDemotedTotal = Object.values(activities).reduce(
    (sum, a) => sum + a.efforts.filter((e) => e.demotion && typeof e.demotion === 'object').length,
    0
  );
  return {
    activities,
    rankings,
    rejected,
    totals: { effortsDemoted: ownDemotedTotal, ...totalsOverride },
  };
}

function effort(distance, durationSec, demotion = null) {
  return { distance, durationSec, demotion };
}

describe('recountDemoted', () => {
  it('counts 3 demoted efforts across two activities and two guards, with the right byGuard split', () => {
    const doc = bestEffortsDoc({
      activities: {
        a1: { efforts: [effort('400m', 60, { guard: 'ceiling', reason: 'r1' }), effort('1k', 200)] },
        a2: {
          efforts: [
            effort('400m', 50, { guard: 'world-record', reason: 'r2' }),
            effort('1mi', 300, { guard: 'ceiling', reason: 'r3' }),
          ],
        },
      },
      rankings: { '400m': [], '1k': [], '1mi': [] },
    });

    const report = recountDemoted(doc);
    expect(report.ownDemotedTotal).toBe(3);
    expect(report.byGuard.ceiling).toBe(2);
    expect(report.byGuard['world-record']).toBe(1);
    expect(report.byGuard['max-speed']).toBe(0);
    expect(report.byGuard.unrecognisedGuards).toEqual([]);
  });

  it('reports its OWN number while flagging the disagreement, when totals.effortsDemoted disagrees with the true count', () => {
    const doc = bestEffortsDoc({
      activities: {
        a1: { efforts: [effort('400m', 60, { guard: 'ceiling', reason: 'r1' })] },
      },
      rankings: { '400m': [] },
      totalsOverride: { effortsDemoted: 999 },
    });

    const report = recountDemoted(doc);
    // The script does not defer to the document's claim — it still reports its own arithmetic.
    expect(report.ownDemotedTotal).toBe(1);
    expect(report.disagreesWithTotals.effortsDemotedMismatch).toBe(true);
    expect(report.disagreesWithTotals.totalsEffortsDemoted).toBe(999);
    expect(report.disagreesWithTotals.ownDemotedTotal).toBe(1);
  });

  it('flags a demoted effort still present in rankings via rankedButDemotedIds', () => {
    const doc = bestEffortsDoc({
      activities: {
        a1: { efforts: [effort('400m', 60, { guard: 'ceiling', reason: 'r1' })] },
      },
      rankings: { '400m': [{ activityId: 'a1', durationSec: 60 }] },
    });

    const report = recountDemoted(doc);
    expect(report.rankedButDemotedIds).toEqual(['a1@400m']);
  });

  it('flags a demoted effort with an empty reason via demotedWithoutReason', () => {
    const doc = bestEffortsDoc({
      activities: {
        a1: { efforts: [effort('1k', 200, { guard: 'ceiling', reason: '' })] },
      },
      rankings: { '1k': [] },
    });

    const report = recountDemoted(doc);
    expect(report.demotedWithoutReason).toEqual(['a1@1k']);
  });

  it('lands an unknown guard value in unrecognisedGuards rather than any counted bucket', () => {
    const doc = bestEffortsDoc({
      activities: {
        a1: { efforts: [effort('5k', 1000, { guard: 'mystery-guard', reason: 'x' })] },
      },
      rankings: { '5k': [] },
    });

    const report = recountDemoted(doc);
    expect(report.ownDemotedTotal).toBe(1); // still counted in the raw total...
    expect(report.byGuard['world-record']).toBe(0); // ...but not absorbed into a known guard bucket
    expect(report.byGuard['max-speed']).toBe(0);
    expect(report.byGuard.ceiling).toBe(0);
    expect(report.byGuard.unrecognisedGuards.length).toBe(1);
    expect(report.byGuard.unrecognisedGuards[0]).toContain('mystery-guard');
  });

  it('reports the pinned fixture explicitly absent when the activity is missing from the document', () => {
    const doc = bestEffortsDoc({ activities: {}, rankings: {} });
    const report = recountDemoted(doc);
    expect(report.pinnedFixture.present).toBe(false);
    expect(report.pinnedFixture.note).toContain('4556693525');
  });
});

describe('recountDemotedActivities', () => {
  it('counts an activity with 3 demoted efforts once (dedupe by activity, not effort)', () => {
    const doc = bestEffortsDoc({
      activities: {
        a1: {
          efforts: [
            effort('400m', 60, { guard: 'ceiling', reason: 'r1' }),
            effort('1k', 200, { guard: 'ceiling', reason: 'r2' }),
            effort('1mi', 300, { guard: 'world-record', reason: 'r3' }),
          ],
        },
      },
      rankings: { '400m': [], '1k': [], '1mi': [] },
    });

    const result = recountDemotedActivities(doc);
    expect(result.flaggedActivityCount).toBe(1);
    expect(result.flaggedActivityIds).toEqual(['a1']);
  });

  it('counts two activities flagged by different single guards (all guards, not ceiling-only)', () => {
    const doc = bestEffortsDoc({
      activities: {
        wr: { efforts: [effort('400m', 45, { guard: 'world-record', reason: 'wr' })] },
        ms: { efforts: [effort('1k', 100, { guard: 'max-speed', reason: 'ms' })] },
      },
      rankings: { '400m': [], '1k': [] },
    });

    const result = recountDemotedActivities(doc);
    expect(result.flaggedActivityCount).toBe(2);
    expect(result.flaggedActivityIds).toEqual(['ms', 'wr']);
  });

  it('does not count an activity whose every effort has demotion: null', () => {
    const doc = bestEffortsDoc({
      activities: {
        clean: { efforts: [effort('400m', 60, null), effort('1k', 200, null)] },
      },
      rankings: { '400m': [], '1k': [] },
    });

    const result = recountDemotedActivities(doc);
    expect(result.flaggedActivityCount).toBe(0);
    expect(result.flaggedActivityIds).toEqual([]);
  });

  it('never throws and returns flaggedActivityCount 0 for null, {}, and malformed shapes', () => {
    expect(() => recountDemotedActivities(null)).not.toThrow();
    expect(recountDemotedActivities(null).flaggedActivityCount).toBe(0);

    expect(() => recountDemotedActivities({})).not.toThrow();
    expect(recountDemotedActivities({}).flaggedActivityCount).toBe(0);

    expect(() => recountDemotedActivities({ activities: null })).not.toThrow();
    expect(recountDemotedActivities({ activities: null }).flaggedActivityCount).toBe(0);

    const effortsNotArray = { activities: { a1: { efforts: 'not-an-array' } } };
    expect(() => recountDemotedActivities(effortsNotArray)).not.toThrow();
    expect(recountDemotedActivities(effortsNotArray).flaggedActivityCount).toBe(0);

    const demotionIsString = { activities: { a1: { efforts: [{ distance: '400m', demotion: 'ceiling' }] } } };
    expect(() => recountDemotedActivities(demotionIsString)).not.toThrow();
    expect(recountDemotedActivities(demotionIsString).flaggedActivityCount).toBe(0);

    const demotionIsNumber = { activities: { a1: { efforts: [{ distance: '400m', demotion: 42 }] } } };
    expect(() => recountDemotedActivities(demotionIsNumber)).not.toThrow();
    expect(recountDemotedActivities(demotionIsNumber).flaggedActivityCount).toBe(0);
  });

  it('does not require typeof demotion.guard === "string" — a malformed guard still qualifies the activity (D-01)', () => {
    const doc = {
      activities: {
        a1: { efforts: [{ distance: '400m', demotion: { guard: 12345, reason: 'x' } }] },
      },
    };
    const result = recountDemotedActivities(doc);
    expect(result.flaggedActivityCount).toBe(1);
    expect(result.flaggedActivityIds).toEqual(['a1']);
  });

  it('counts excludedWithinFlaggedCount for an exclusion inside the flagged set, and exclusionsTotal separately for one outside it', () => {
    const doc = bestEffortsDoc({
      activities: {
        flagged: { efforts: [effort('400m', 60, { guard: 'ceiling', reason: 'r1' })] },
        clean: { efforts: [effort('1k', 200, null)] },
      },
      rankings: { '400m': [], '1k': [] },
    });
    const exclusionsDoc = {
      exclusions: [
        { activityId: 'flagged', distances: null, reason: 'inside flagged set' },
        { activityId: 'clean', distances: null, reason: 'outside flagged set' },
      ],
    };

    const result = recountDemotedActivities(doc, exclusionsDoc);
    expect(result.flaggedActivityCount).toBe(1);
    expect(result.excludedWithinFlaggedCount).toBe(1);
    expect(result.exclusionsTotal).toBe(2);
  });

  it('reports excludedWithinFlaggedCount and exclusionsTotal as null when exclusionsDoc is undefined/null, while flaggedActivityCount stays correct', () => {
    const doc = bestEffortsDoc({
      activities: {
        flagged: { efforts: [effort('400m', 60, { guard: 'ceiling', reason: 'r1' })] },
      },
      rankings: { '400m': [] },
    });

    const resultUndefined = recountDemotedActivities(doc, undefined);
    expect(resultUndefined.flaggedActivityCount).toBe(1);
    expect(resultUndefined.excludedWithinFlaggedCount).toBeNull();
    expect(resultUndefined.exclusionsTotal).toBeNull();

    const resultNull = recountDemotedActivities(doc, null);
    expect(resultNull.flaggedActivityCount).toBe(1);
    expect(resultNull.excludedWithinFlaggedCount).toBeNull();
    expect(resultNull.exclusionsTotal).toBeNull();
  });
});

describe('recountImpossibleSampleCohort', () => {
  it('derives the denominator from the document row count, counts rows with count>=1, and counts a missing-quality row separately', () => {
    const rows = [
      { id: '1', quality: { impossibleSamples: { count: 1 } } },
      { id: '2', quality: { impossibleSamples: { count: 0 } } },
      { id: '3', quality: { impossibleSamples: { count: 2 } } },
      { id: '4' }, // missing quality entirely
      { id: '5', quality: { impossibleSamples: { count: 0 } } },
      { id: '6', quality: { impossibleSamples: { count: 1 } } },
      { id: '7', quality: { impossibleSamples: { count: 0 } } },
      { id: '8', quality: { impossibleSamples: { count: 0 } } },
      { id: '9', quality: { impossibleSamples: { count: 0 } } },
      { id: '10', quality: { impossibleSamples: { count: 0 } } },
    ];
    const report = recountImpossibleSampleCohort({ activities: rows });

    expect(report.archiveDenominator).toBe(10);
    expect(report.cohortCount).toBe(3);
    expect(report.rowsMissingQuality).toBe(1);
    expect(report.cohortIds).toEqual(['1', '3', '6']);
  });
});

describe('computeCohortOverlap', () => {
  it('returns 1/1/1 when one cohort activity has a demoted effort, one does not, and one demoted activity sits outside the cohort', () => {
    const bestEfforts = bestEffortsDoc({
      activities: {
        '1': { efforts: [effort('400m', 60, { guard: 'ceiling', reason: 'x' })] },
        '3': { efforts: [effort('400m', 70)] },
        '9': { efforts: [effort('1k', 200, { guard: 'ceiling', reason: 'y' })] },
      },
      rankings: { '400m': [], '1k': [] },
    });

    const overlap = computeCohortOverlap(['1', '3'], bestEfforts);
    expect(overlap.cohortWithDemotedEffort).toBe(1);
    expect(overlap.cohortWithoutDemotedEffort).toBe(1);
    expect(overlap.demotedNotInCohort).toBe(1);
  });
});

describe('evaluateReport', () => {
  function cleanDemotedReport() {
    return {
      ownDemotedTotal: 2,
      byGuard: { 'world-record': 1, 'max-speed': 0, ceiling: 1, unrecognisedGuards: [] },
      byDistance: { '400m': 2 },
      ownRejectedNonErrorRows: 2,
      rankedButDemotedIds: [],
      demotedWithoutReason: [],
      disagreesWithTotals: {
        effortsDemotedMismatch: false,
        ownDemotedTotal: 2,
        totalsEffortsDemoted: 2,
        rejectedMismatch: false,
        ownRejectedNonErrorRows: 2,
      },
      pinnedFixture: {
        present: true,
        durationSec: 45.2,
        guard: 'ceiling',
        durationMatches45_2: true,
        guardIsCeiling: true,
      },
    };
  }

  /**
   * A clean sweep matching cleanDemotedReport()'s byGuard.ceiling of 1: exactly one
   * independently-derived over-ceiling effort, no problems in either direction.
   */
  function cleanSweep() {
    return {
      overCeilingWithoutDemotion: [],
      ceilingDemotedButNotOverCeiling: [],
      independentCeilingCount: 1,
      unevaluable: [],
      failOpenDistances: [],
      ceilingsMissing: false,
    };
  }

  it('passes on a clean report', () => {
    const verdict = evaluateReport({
      readErrors: [],
      demoted: cleanDemotedReport(),
      cohort: null,
      sweep: cleanSweep(),
    });
    expect(verdict.pass).toBe(true);
    expect(verdict.problems).toEqual([]);
  });

  it('fails naming the problem when readErrors is non-empty (unreadable input)', () => {
    const verdict = evaluateReport({ readErrors: ['could not read x: ENOENT'], demoted: null, cohort: null });
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('unreadable input'))).toBe(true);
  });

  it('fails naming the problem when rankedButDemotedIds is non-empty', () => {
    const demoted = cleanDemotedReport();
    demoted.rankedButDemotedIds = ['a1@400m'];
    const verdict = evaluateReport({ readErrors: [], demoted, cohort: null, sweep: cleanSweep() });
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('a1@400m'))).toBe(true);
  });

  it('fails naming the problem when demotedWithoutReason is non-empty', () => {
    const demoted = cleanDemotedReport();
    demoted.demotedWithoutReason = ['a1@1k'];
    const verdict = evaluateReport({ readErrors: [], demoted, cohort: null, sweep: cleanSweep() });
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('a1@1k'))).toBe(true);
  });

  it('fails naming the problem when either disagreesWithTotals boolean is true', () => {
    const demoted = cleanDemotedReport();
    demoted.disagreesWithTotals.effortsDemotedMismatch = true;
    demoted.disagreesWithTotals.totalsEffortsDemoted = 999;
    const verdict = evaluateReport({ readErrors: [], demoted, cohort: null, sweep: cleanSweep() });
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('disagrees with doc.totals.effortsDemoted'))).toBe(true);
  });

  it('fails naming the problem when unrecognisedGuards is non-empty', () => {
    const demoted = cleanDemotedReport();
    demoted.byGuard.unrecognisedGuards = ['a1@5k (guard="mystery")'];
    const verdict = evaluateReport({ readErrors: [], demoted, cohort: null, sweep: cleanSweep() });
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('unrecognised guard'))).toBe(true);
  });

  it('fails when expectedDemoted differs from ownDemotedTotal, quoting both numbers', () => {
    const demoted = cleanDemotedReport();
    const verdict = evaluateReport({ readErrors: [], demoted, cohort: null, sweep: cleanSweep() }, 999);
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('2') && p.includes('999'))).toBe(true);
  });

  it('fails when expectedFlaggedActivities differs from flaggedActivityCount, quoting both numbers', () => {
    const demoted = cleanDemotedReport();
    const flaggedActivities = {
      flaggedActivityCount: 47,
      flaggedActivityIds: [],
      excludedWithinFlaggedCount: 12,
      exclusionsTotal: 12,
    };
    const verdict = evaluateReport(
      { readErrors: [], demoted, cohort: null, sweep: cleanSweep(), flaggedActivities },
      undefined,
      undefined,
      35
    );
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('47') && p.includes('35'))).toBe(true);
  });

  it('passes when expectedFlaggedActivities matches flaggedActivityCount exactly', () => {
    const demoted = cleanDemotedReport();
    const flaggedActivities = {
      flaggedActivityCount: 47,
      flaggedActivityIds: [],
      excludedWithinFlaggedCount: 12,
      exclusionsTotal: 12,
    };
    const verdict = evaluateReport(
      { readErrors: [], demoted, cohort: null, sweep: cleanSweep(), flaggedActivities },
      undefined,
      undefined,
      47
    );
    expect(verdict.pass).toBe(true);
  });

  it('fails naming "ceiling sweep was not run" when sweep is absent but demoted is present', () => {
    const demoted = cleanDemotedReport();
    const verdict = evaluateReport({ readErrors: [], demoted, cohort: null });
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('ceiling sweep was not run'))).toBe(true);
  });

  describe('sweep problems', () => {
    it('fails naming every label when sweep.overCeilingWithoutDemotion is non-empty', () => {
      const demoted = cleanDemotedReport();
      const sweep = cleanSweep();
      sweep.overCeilingWithoutDemotion = ['a1@400m', 'a2@1k'];
      const verdict = evaluateReport({ readErrors: [], demoted, cohort: null, sweep });
      expect(verdict.pass).toBe(false);
      expect(verdict.problems.some((p) => p.includes('a1@400m') && p.includes('a2@1k'))).toBe(true);
    });

    it('fails naming the problem when sweep.ceilingDemotedButNotOverCeiling is non-empty', () => {
      const demoted = cleanDemotedReport();
      const sweep = cleanSweep();
      sweep.ceilingDemotedButNotOverCeiling = ['a3@5k'];
      const verdict = evaluateReport({ readErrors: [], demoted, cohort: null, sweep });
      expect(verdict.pass).toBe(false);
      expect(verdict.problems.some((p) => p.includes('a3@5k'))).toBe(true);
    });

    it('fails naming both numbers when independentCeilingCount disagrees with byGuard.ceiling', () => {
      const demoted = cleanDemotedReport(); // byGuard.ceiling = 1
      const sweep = cleanSweep();
      sweep.independentCeilingCount = 5;
      const verdict = evaluateReport({ readErrors: [], demoted, cohort: null, sweep });
      expect(verdict.pass).toBe(false);
      expect(verdict.problems.some((p) => p.includes('5') && p.includes('1'))).toBe(true);
    });

    it('fails naming the problem when sweep.unevaluable is non-empty', () => {
      const demoted = cleanDemotedReport();
      const sweep = cleanSweep();
      sweep.unevaluable = ['a4@unknown'];
      const verdict = evaluateReport({ readErrors: [], demoted, cohort: null, sweep });
      expect(verdict.pass).toBe(false);
      expect(verdict.problems.some((p) => p.includes('a4@unknown'))).toBe(true);
    });

    it('fails naming the problem when sweep.ceilingsMissing is true', () => {
      const demoted = cleanDemotedReport();
      const sweep = cleanSweep();
      sweep.ceilingsMissing = true;
      const verdict = evaluateReport({ readErrors: [], demoted, cohort: null, sweep });
      expect(verdict.pass).toBe(false);
      expect(verdict.problems.some((p) => p.toLowerCase().includes('ceilings'))).toBe(true);
    });
  });

  describe('pinned-fixture problems', () => {
    it('fails naming the problem when the pinned fixture guard is not "ceiling"', () => {
      const demoted = cleanDemotedReport();
      demoted.pinnedFixture = {
        present: true,
        durationSec: 45.2,
        guard: 'world-record',
        durationMatches45_2: true,
        guardIsCeiling: false,
      };
      const verdict = evaluateReport({ readErrors: [], demoted, cohort: null, sweep: cleanSweep() });
      expect(verdict.pass).toBe(false);
      expect(verdict.problems.some((p) => p.includes('guardIsCeiling'))).toBe(true);
    });

    it('fails naming the problem when pinnedFixture durationSec does not match 45.2', () => {
      const demoted = cleanDemotedReport();
      demoted.pinnedFixture = {
        present: true,
        durationSec: 50,
        guard: 'ceiling',
        durationMatches45_2: false,
        guardIsCeiling: true,
      };
      const verdict = evaluateReport({ readErrors: [], demoted, cohort: null, sweep: cleanSweep() });
      expect(verdict.pass).toBe(false);
      expect(verdict.problems.some((p) => p.includes('45.2'))).toBe(true);
    });

    it('fails naming the problem when the pinned fixture is absent (PR-05 check would be vacuous)', () => {
      const demoted = cleanDemotedReport();
      demoted.pinnedFixture = {
        present: false,
        note: 'activity 4556693525 is absent from the shipped document',
      };
      const verdict = evaluateReport({ readErrors: [], demoted, cohort: null, sweep: cleanSweep() });
      expect(verdict.pass).toBe(false);
      expect(verdict.problems.some((p) => p.includes('vacuous'))).toBe(true);
    });
  });

  it('fails when expectedCohort differs from cohortCount', () => {
    const verdict = evaluateReport(
      { readErrors: [], demoted: null, cohort: { cohortCount: 5 } },
      undefined,
      6
    );
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('5') && p.includes('6'))).toBe(true);
  });
});

/**
 * D-15's classifier-independent ceiling sweep (WR-05, IN-03). Distance meters are declared
 * locally in the fixtures below, mirroring the script's own local `TARGET_METERS_LOCAL` — no
 * import of best-effort.types or any other classifier module.
 */
describe('recountCeilingSweep', () => {
  function sweepDoc({ ceilings = {}, activities = {} } = {}) {
    return { ceilings, activities };
  }

  it('returns overCeilingWithoutDemotion and independentCeilingCount 1 for one excluded 400m effort over the ceiling with demotion null', () => {
    const doc = sweepDoc({
      ceilings: { '400m': { ceilingMps: 5.1098, p90Mps: 3.992, populationN: 1825 } },
      activities: { X: { efforts: [effort('400m', 45.2, null)] } },
    });
    const sweep = recountCeilingSweep(doc);
    expect(sweep.overCeilingWithoutDemotion).toEqual(['X@400m']);
    expect(sweep.independentCeilingCount).toBe(1);
  });

  it('does not flag an effort at exactly ceiling speed (strict >)', () => {
    // 400m / 80s = 5 m/s, exactly at the ceiling.
    const doc = sweepDoc({
      ceilings: { '400m': { ceilingMps: 5 } },
      activities: { X: { efforts: [effort('400m', 80, null)] } },
    });
    const sweep = recountCeilingSweep(doc);
    expect(sweep.overCeilingWithoutDemotion).toEqual([]);
    expect(sweep.independentCeilingCount).toBe(0);
  });

  it('lists an effort with guard "ceiling" whose implied speed is not over the ceiling in ceilingDemotedButNotOverCeiling', () => {
    const doc = sweepDoc({
      ceilings: { '400m': { ceilingMps: 10 } },
      activities: { X: { efforts: [effort('400m', 90, { guard: 'ceiling', reason: 'x' })] } },
    });
    const sweep = recountCeilingSweep(doc);
    expect(sweep.ceilingDemotedButNotOverCeiling).toEqual(['X@400m']);
  });

  it('does not count or list an over-ceiling effort already demoted by world-record or max-speed', () => {
    const doc = sweepDoc({
      ceilings: { '400m': { ceilingMps: 5.1098 } },
      activities: {
        X: { efforts: [effort('400m', 45.2, { guard: 'world-record', reason: 'wr' })] },
        Y: { efforts: [effort('400m', 46, { guard: 'max-speed', reason: 'ms' })] },
      },
    });
    const sweep = recountCeilingSweep(doc);
    expect(sweep.overCeilingWithoutDemotion).toEqual([]);
    expect(sweep.ceilingDemotedButNotOverCeiling).toEqual([]);
    expect(sweep.independentCeilingCount).toBe(0);
  });

  it('contributes nothing for a fail-open distance (ceilingMps null) and lists it in failOpenDistances', () => {
    const doc = sweepDoc({
      ceilings: { marathon: { ceilingMps: null } },
      activities: { X: { efforts: [effort('marathon', 8000, null)] } },
    });
    const sweep = recountCeilingSweep(doc);
    expect(sweep.overCeilingWithoutDemotion).toEqual([]);
    expect(sweep.independentCeilingCount).toBe(0);
    expect(sweep.failOpenDistances).toEqual(['marathon']);
  });

  it('lists an effort whose distance has no local meters entry in unevaluable, never silently skipping it', () => {
    const doc = sweepDoc({
      ceilings: { '400m': { ceilingMps: 5.1098 } },
      activities: { X: { efforts: [effort('7k', 2000, null)] } },
    });
    const sweep = recountCeilingSweep(doc);
    expect(sweep.unevaluable).toEqual(['X@7k']);
  });

  it('returns ceilingsMissing true when the document has no ceilings object', () => {
    const sweep = recountCeilingSweep({ activities: {} });
    expect(sweep.ceilingsMissing).toBe(true);
  });

  it('does not throw for null or empty input, returning ceilingsMissing true', () => {
    expect(() => recountCeilingSweep(null)).not.toThrow();
    expect(recountCeilingSweep(null).ceilingsMissing).toBe(true);
    expect(() => recountCeilingSweep({})).not.toThrow();
    expect(recountCeilingSweep({}).ceilingsMissing).toBe(true);
  });
});

describe('recountDemoted null-safety (IN-03)', () => {
  it('does not throw for recountDemoted(null) or recountDemoted({})', () => {
    expect(() => recountDemoted(null)).not.toThrow();
    expect(() => recountDemoted({})).not.toThrow();
  });
});

describe('CR-01 regression shape (D-04, D-15)', () => {
  it('fails on the CR-01 shape: an owner-excluded over-ceiling effort with demotion null', () => {
    const doc = {
      ceilings: { '400m': { ceilingMps: 5.1098, p90Mps: 3.992, populationN: 1825 } },
      activities: {
        '4556693525': { efforts: [effort('400m', 45.2, null)] },
        ok: { efforts: [effort('400m', 90, null)] },
      },
      rankings: { '400m': [] },
    };

    const demoted = recountDemoted(doc);
    const sweep = recountCeilingSweep(doc);
    const verdict = evaluateReport({ readErrors: [], demoted, cohort: null, sweep });

    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('4556693525@400m'))).toBe(true);
    expect(verdict.problems.some((p) => p.includes('guardIsCeiling'))).toBe(true);
  });
});

describe('parseInputPaths', () => {
  it('returns the three default paths when no flags are present', () => {
    const result = parseInputPaths([]);
    expect(result.bestEffortsPath).toContain('best-efforts.json');
    expect(result.indexPath).toContain('index.json');
    expect(result.exclusionsPath).toContain('best-effort-exclusions.json');
  });

  it('returns the given paths when all three flags are present', () => {
    const result = parseInputPaths([
      '--best-efforts',
      '/a.json',
      '--index',
      '/b.json',
      '--exclusions',
      '/c.json',
    ]);
    expect(result).toEqual({ bestEffortsPath: '/a.json', indexPath: '/b.json', exclusionsPath: '/c.json' });
  });

  it('defaults --exclusions when only --best-efforts and --index are given', () => {
    const result = parseInputPaths(['--best-efforts', '/a.json', '--index', '/b.json']);
    expect(result.bestEffortsPath).toBe('/a.json');
    expect(result.indexPath).toBe('/b.json');
    expect(result.exclusionsPath).toContain('best-effort-exclusions.json');
  });

  it('throws naming the flag when --best-efforts has no value', () => {
    expect(() => parseInputPaths(['--best-efforts'])).toThrow(/--best-efforts/);
  });

  it('throws naming the flag when --index has no value', () => {
    expect(() => parseInputPaths(['--index'])).toThrow(/--index/);
  });

  it('throws naming the flag when --exclusions has no value', () => {
    expect(() => parseInputPaths(['--exclusions'])).toThrow(/--exclusions/);
  });
});

describe('parseExpectFlags', () => {
  it('returns undefined for all three flags when none is present', () => {
    expect(parseExpectFlags([])).toEqual({
      expectDemoted: undefined,
      expectCohort: undefined,
      expectFlaggedActivities: undefined,
    });
  });

  it('parses all three flags independently when all are present', () => {
    expect(
      parseExpectFlags([
        '--expect-demoted',
        '18',
        '--expect-cohort',
        '662',
        '--expect-flagged-activities',
        '47',
      ])
    ).toEqual({
      expectDemoted: 18,
      expectCohort: 662,
      expectFlaggedActivities: 47,
    });
  });

  it('throws on a non-integer value', () => {
    expect(() => parseExpectFlags(['--expect-demoted', 'abc'])).toThrow(/integer/);
  });

  it('throws on a non-integer --expect-flagged-activities value', () => {
    expect(() => parseExpectFlags(['--expect-flagged-activities', 'abc'])).toThrow(/integer/);
  });
});

describe('readShippedJson', () => {
  it('returns { ok: false } naming the path for a missing file, never throwing', () => {
    const result = readShippedJson('/nonexistent/path/does-not-exist.json');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('/nonexistent/path/does-not-exist.json');
  });

  it('returns { ok: false } naming the path for invalid JSON, never throwing', () => {
    const badJsonPath = fileURLToPath(new URL('./compute-pr-ceiling-recount.mjs', import.meta.url)); // valid file, not JSON
    const result = readShippedJson(badJsonPath);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain(badJsonPath);
  });
});

describe('import-time side effects', () => {
  it('importing this module triggers no read of the shipped documents', async () => {
    const spy = vi.spyOn(fs, 'readFileSync');
    // Re-import via a cache-busting query so this assertion is not defeated by vitest's module
    // cache having already loaded the module for the describe blocks above.
    await import('./compute-pr-ceiling-recount.mjs?cache-bust-guard-test');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
