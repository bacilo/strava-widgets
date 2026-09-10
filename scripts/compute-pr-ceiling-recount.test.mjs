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
  readShippedJson,
  recountDemoted,
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
      pinnedFixture: { present: false, note: 'absent' },
    };
  }

  it('passes on a clean report', () => {
    const verdict = evaluateReport({ readErrors: [], demoted: cleanDemotedReport(), cohort: null });
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
    const verdict = evaluateReport({ readErrors: [], demoted, cohort: null });
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('a1@400m'))).toBe(true);
  });

  it('fails naming the problem when demotedWithoutReason is non-empty', () => {
    const demoted = cleanDemotedReport();
    demoted.demotedWithoutReason = ['a1@1k'];
    const verdict = evaluateReport({ readErrors: [], demoted, cohort: null });
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('a1@1k'))).toBe(true);
  });

  it('fails naming the problem when either disagreesWithTotals boolean is true', () => {
    const demoted = cleanDemotedReport();
    demoted.disagreesWithTotals.effortsDemotedMismatch = true;
    demoted.disagreesWithTotals.totalsEffortsDemoted = 999;
    const verdict = evaluateReport({ readErrors: [], demoted, cohort: null });
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('disagrees with doc.totals.effortsDemoted'))).toBe(true);
  });

  it('fails naming the problem when unrecognisedGuards is non-empty', () => {
    const demoted = cleanDemotedReport();
    demoted.byGuard.unrecognisedGuards = ['a1@5k (guard="mystery")'];
    const verdict = evaluateReport({ readErrors: [], demoted, cohort: null });
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('unrecognised guard'))).toBe(true);
  });

  it('fails when expectedDemoted differs from ownDemotedTotal, quoting both numbers', () => {
    const demoted = cleanDemotedReport();
    const verdict = evaluateReport({ readErrors: [], demoted, cohort: null }, 999);
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('2') && p.includes('999'))).toBe(true);
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

describe('parseExpectFlags', () => {
  it('returns undefined for both flags when neither is present', () => {
    expect(parseExpectFlags([])).toEqual({ expectDemoted: undefined, expectCohort: undefined });
  });

  it('parses both flags independently when both are present', () => {
    expect(parseExpectFlags(['--expect-demoted', '18', '--expect-cohort', '662'])).toEqual({
      expectDemoted: 18,
      expectCohort: 662,
    });
  });

  it('throws on a non-integer value', () => {
    expect(() => parseExpectFlags(['--expect-demoted', 'abc'])).toThrow(/integer/);
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
