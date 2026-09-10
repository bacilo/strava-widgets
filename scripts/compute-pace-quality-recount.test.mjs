/**
 * Guard test for the pure helpers exported by compute-pace-quality-recount.mjs (Phase 27 plan
 * 05, D-03). Importing this module must not read `data/dashboard/index.json` as an import-time
 * side effect — if it does, the self-execution guard documented at the bottom of
 * compute-pace-quality-recount.mjs is wrong and must be fixed rather than worked around here.
 *
 * Every case drives `recountComposite`/`evaluateReport` on a hand-built document; none reads
 * the real archive. The mutation cases are the demonstrated-failing half D-03 requires: a check
 * that can only pass is not proven to discriminate. Each asserts BOTH the clean document
 * passing and the mutated copy of the SAME document failing.
 */

import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';

import { evaluateReport, recountComposite } from './compute-pace-quality-recount.mjs';

/** A fully-populated, "nothing flagged" quality object — the semantic default. */
function cleanQuality(overrides = {}) {
  return {
    decimation: { tier: 'none', zeroAdvanceFraction: 0.01, sampleCount: 200 },
    gapProfile: { tier: 'none', gapFraction: 0.02, recordingGapSec: 10, pauseSec: 0, spanSec: 500 },
    impossibleSamples: { tier: 'none', count: 0, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: 0 },
    deviceEra: { family: 'garmin-fenix-6-pro', rawDeviceName: null },
    elapsedVsMoving: { ratio: 1.02, elapsedSec: 500, movingSec: 490 },
    anySevere: false,
    notComputableReason: null,
    ...overrides,
  };
}

function notComputableQuality() {
  return {
    decimation: { tier: 'not-computable', zeroAdvanceFraction: null, sampleCount: null },
    gapProfile: { tier: 'not-computable', gapFraction: null, recordingGapSec: null, pauseSec: null, spanSec: null },
    impossibleSamples: { tier: 'not-computable', count: null, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: null },
    deviceEra: { family: 'no-device-name', rawDeviceName: null },
    elapsedVsMoving: { ratio: 1, elapsedSec: 300, movingSec: 300 },
    anySevere: false,
    notComputableReason: 'no stream committed for this activity',
  };
}

function row(id, quality) {
  return { id, quality };
}

function doc(activities, totalsOverride) {
  const computedComposite = activities.filter((r) =>
    ['decimation', 'gapProfile', 'impossibleSamples'].some((k) => r.quality[k]?.tier === 'severe')
  ).length;
  return {
    schemaVersion: 1,
    activities,
    totals: { qualityAnySevere: computedComposite, ...totalsOverride },
  };
}

describe('recountComposite — union semantics', () => {
  it('counts 3 when three distinct rows are severe on three different signals', () => {
    const d = doc([
      row('a', cleanQuality({ decimation: { ...cleanQuality().decimation, tier: 'severe' }, anySevere: true })),
      row('b', cleanQuality({ gapProfile: { ...cleanQuality().gapProfile, tier: 'severe' }, anySevere: true })),
      row('c', cleanQuality({ impossibleSamples: { ...cleanQuality().impossibleSamples, tier: 'severe' }, anySevere: true })),
    ]);
    const report = recountComposite(d);
    expect(report.ownComposite).toBe(3);
    expect(report.perSignalSevereCounts).toEqual({ decimation: 1, gapProfile: 1, impossibleSamples: 1 });
    expect(evaluateReport(report).pass).toBe(true);
  });

  it('counts 1, not 3, when one row is severe on all three signals (union, not a marginal sum)', () => {
    const d = doc([
      row(
        'all-three-severe',
        cleanQuality({
          decimation: { ...cleanQuality().decimation, tier: 'severe' },
          gapProfile: { ...cleanQuality().gapProfile, tier: 'severe' },
          impossibleSamples: { ...cleanQuality().impossibleSamples, tier: 'severe' },
          anySevere: true,
        })
      ),
    ]);
    const report = recountComposite(d);
    expect(report.ownComposite).toBe(1);
    expect(report.perSignalSevereCounts).toEqual({ decimation: 1, gapProfile: 1, impossibleSamples: 1 });
    expect(evaluateReport(report).pass).toBe(true);
  });

  it('does not count an all-not-computable row in the composite, and counts it as not-computable', () => {
    const d = doc([row('nc', notComputableQuality()), row('clean', cleanQuality())]);
    const report = recountComposite(d);
    expect(report.ownComposite).toBe(0);
    expect(report.notComputableCount).toBe(1);
    expect(report.totalRows).toBe(2);
    expect(evaluateReport(report).pass).toBe(true);
  });
});

describe('mutation cases — the demonstrated-failing half of D-03', () => {
  it('(a) flips one row severe->none while anySevere stays true: clean passes, mutated fails naming the row id', () => {
    const cleanDoc = doc([
      row('victim', cleanQuality({ decimation: { ...cleanQuality().decimation, tier: 'severe' }, anySevere: true })),
      row('bystander', cleanQuality()),
    ]);
    const cleanReport = recountComposite(cleanDoc);
    expect(evaluateReport(cleanReport).pass).toBe(true);
    expect(cleanReport.ownComposite).toBe(1);

    // The exact regression D-03 exists to catch: the classifier's summary flag (anySevere)
    // survives while the tier field it summarizes silently stopped being emitted.
    const mutatedDoc = JSON.parse(JSON.stringify(cleanDoc));
    mutatedDoc.activities[0].quality.decimation.tier = 'none';
    // totals.qualityAnySevere was computed from the clean doc and is now stale by construction,
    // matching what a real regression would ship: the field flipped, the summary total did not.
    const mutatedReport = recountComposite(mutatedDoc);
    const verdict = evaluateReport(mutatedReport);
    expect(verdict.pass).toBe(false);
    expect(mutatedReport.compositeDisagreementIds).toContain('victim');
    expect(verdict.problems.some((p) => p.includes('victim'))).toBe(true);
  });

  it('(b) deletes quality entirely from one row: clean passes, mutated fails naming the row id', () => {
    const cleanDoc = doc([row('has-quality', cleanQuality()), row('also-has-quality', cleanQuality())]);
    const cleanReport = recountComposite(cleanDoc);
    expect(evaluateReport(cleanReport).pass).toBe(true);

    const mutatedDoc = JSON.parse(JSON.stringify(cleanDoc));
    delete mutatedDoc.activities[0].quality;
    const mutatedReport = recountComposite(mutatedDoc);
    const verdict = evaluateReport(mutatedReport);
    expect(verdict.pass).toBe(false);
    expect(mutatedReport.missingFieldIds).toContain('has-quality');
    expect(verdict.problems.some((p) => p.includes('has-quality'))).toBe(true);
  });

  it('(c) sets one tier to the invalid string "critical": clean passes, mutated fails the closed-set check', () => {
    const cleanDoc = doc([row('a', cleanQuality()), row('b', cleanQuality())]);
    const cleanReport = recountComposite(cleanDoc);
    expect(evaluateReport(cleanReport).pass).toBe(true);

    const mutatedDoc = JSON.parse(JSON.stringify(cleanDoc));
    mutatedDoc.activities[0].quality.gapProfile.tier = 'critical';
    const mutatedReport = recountComposite(mutatedDoc);
    const verdict = evaluateReport(mutatedReport);
    expect(verdict.pass).toBe(false);
    expect(mutatedReport.invalidTierIds).toContain('a');
    expect(verdict.problems.some((p) => p.includes('closed set'))).toBe(true);
  });
});

describe('--expect predicate', () => {
  it('passes when the recomputed composite equals the expected value', () => {
    const d = doc([row('sev', cleanQuality({ decimation: { ...cleanQuality().decimation, tier: 'severe' }, anySevere: true }))]);
    const report = recountComposite(d);
    expect(evaluateReport(report, 1).pass).toBe(true);
  });

  it('fails when the recomputed composite is off by one from the expected value', () => {
    const d = doc([row('sev', cleanQuality({ decimation: { ...cleanQuality().decimation, tier: 'severe' }, anySevere: true }))]);
    const report = recountComposite(d);
    const verdict = evaluateReport(report, 2);
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('--expect 2'))).toBe(true);
  });
});

describe('schemaVersion and totals cross-check', () => {
  it('fails when schemaVersion is not 1', () => {
    const d = doc([row('a', cleanQuality())]);
    d.schemaVersion = 2;
    const verdict = evaluateReport(recountComposite(d));
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('schemaVersion'))).toBe(true);
  });

  it('fails when the recomputed composite disagrees with totals.qualityAnySevere', () => {
    const d = doc(
      [row('sev', cleanQuality({ decimation: { ...cleanQuality().decimation, tier: 'severe' }, anySevere: true }))],
      { qualityAnySevere: 999 }
    );
    const verdict = evaluateReport(recountComposite(d));
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('disagrees with totals.qualityAnySevere'))).toBe(true);
  });
});

describe('import-time side effects', () => {
  it('importing this module triggers no read of data/dashboard/index.json', async () => {
    const spy = vi.spyOn(fs, 'readFileSync');
    // Re-import via a cache-busting query so this assertion is not defeated by vitest's
    // module cache having already loaded the module for the describe blocks above.
    await import('./compute-pace-quality-recount.mjs?cache-bust-guard-test');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
