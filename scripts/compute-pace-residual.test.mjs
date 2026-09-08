/**
 * Guard test for the pure helpers exported by compute-pace-residual.mjs
 * (Phase 26 plan 09, PACE-06/D-19). Importing this module must not run the
 * archive sweep or write 26-RESIDUAL.md — if it does, the self-execution
 * guard documented at the bottom of compute-pace-residual.mjs is wrong and
 * must be fixed rather than worked around here.
 */

import { describe, expect, it } from 'vitest';

import {
  adaptiveFastMass,
  baselineFastMass,
  isSevereStairStep,
  renderResidualMarkdown,
  zeroAdvanceFraction,
} from './compute-pace-residual.mjs';

describe('isSevereStairStep / zeroAdvanceFraction', () => {
  it('is true for a 60-sample stream with over 15% zero-advance pairs', () => {
    // Every 4th sample is flat (d does not advance) -> 25% zero-advance pairs.
    const t = [];
    const d = [];
    let dist = 0;
    for (let i = 0; i < 60; i++) {
      t.push(i);
      if (i % 4 !== 0) dist += 10;
      d.push(dist);
    }
    const stream = { schemaVersion: 1, id: 'stair-step', sampleCount: 60, t, d };

    expect(zeroAdvanceFraction(stream)).toBeGreaterThan(0.15);
    expect(isSevereStairStep(stream)).toBe(true);
  });

  it('is false for a clean, evenly-advancing 60-sample stream', () => {
    const t = [];
    const d = [];
    for (let i = 0; i < 60; i++) {
      t.push(i);
      d.push(i * 3.33);
    }
    const stream = { schemaVersion: 1, id: 'clean', sampleCount: 60, t, d };

    expect(zeroAdvanceFraction(stream)).toBeLessThanOrEqual(0.15);
    expect(isSevereStairStep(stream)).toBe(false);
  });

  it('is false for a 6-sample degenerate stream even with 100% zero advance', () => {
    const t = [0, 1, 2, 3, 4, 5];
    const d = [0, 0, 0, 0, 0, 0];
    const stream = { schemaVersion: 1, id: 'degenerate', sampleCount: 6, t, d };

    expect(zeroAdvanceFraction(stream)).toBe(1);
    expect(isSevereStairStep(stream)).toBe(false);
  });
});

describe('baselineFastMass', () => {
  it('is high on an alternating full/zero-advance stair-step fixture', () => {
    // Advances 50m every other second (20 sec/km, well under the 180 sec/km
    // threshold) and holds flat on the alternating seconds (skipped by the
    // dd <= 0 guard), reproducing the pre-Phase-26 phantom-fast-mode shape.
    const t = [];
    const d = [];
    let dist = 0;
    for (let i = 0; i < 40; i++) {
      t.push(i);
      if (i % 2 === 1) dist += 50;
      d.push(dist);
    }

    expect(baselineFastMass(t, d)).toBeGreaterThan(0.9);
  });

  it('is low on a clean, evenly-advancing 5:00/km fixture', () => {
    // 1000m / 300s = 300 sec/km, slower than the 180 sec/km threshold.
    const t = [];
    const d = [];
    for (let i = 0; i <= 300; i++) {
      t.push(i);
      d.push((1000 / 300) * i);
    }

    expect(baselineFastMass(t, d)).toBe(0);
  });

  it('returns 0 for a stream with no positive-dt/positive-dd segments', () => {
    expect(baselineFastMass([0, 1, 2], [0, 0, 0])).toBe(0);
  });
});

describe('adaptiveFastMass', () => {
  it('returns a fastMass fraction and a positive resolved windowSec for a real-shaped stream', () => {
    const t = [];
    const d = [];
    for (let i = 0; i <= 300; i++) {
      t.push(i);
      d.push((1000 / 300) * i);
    }
    const stream = { schemaVersion: 1, id: 'adaptive-fixture', sampleCount: t.length, t, d };

    const { fastMass, windowSec } = adaptiveFastMass(stream);
    expect(fastMass).toBeGreaterThanOrEqual(0);
    expect(fastMass).toBeLessThanOrEqual(1);
    expect(windowSec).toBeGreaterThan(0);
  });
});

describe('renderResidualMarkdown', () => {
  it('produces one table row per residual entry for a hand-built report object', () => {
    const report = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      archiveSize: 1890,
      cohortSize: 154,
      maxResidualPct: 2.42,
      residual: [
        { id: '4556693525', afterPct: 2.42, baselinePct: 2.42, windowSec: 20, note: 'Also the PACE-04 worked example' },
        { id: '5059204779', afterPct: 1.17, baselinePct: 94.8, windowSec: 150, note: '' },
        { id: '4332544744', afterPct: 0.5, baselinePct: 12.3, windowSec: 88, note: '' },
      ],
      criterion1: {
        strictlyImproved: 152,
        tied: 1,
        regressed: 0,
        ties: ['3475742397'],
        violations: [],
      },
    };

    const markdown = renderResidualMarkdown(report);

    for (const entry of report.residual) {
      expect(markdown).toContain(entry.id);
    }

    const residualTableStart = markdown.indexOf('## Residual Activities');
    const criterionSectionStart = markdown.indexOf('## Criterion 1 Reconciliation');
    const residualTableSection = markdown.slice(residualTableStart, criterionSectionStart);
    const dataRowCount = (residualTableSection.match(/^\|\s*\d/gm) || []).length;

    expect(dataRowCount).toBe(report.residual.length);
    expect(markdown).toContain('3475742397');
    expect(markdown).toContain('npm run compute-pace-residual');
  });

  it('names violations when Criterion 1 reports a regression', () => {
    const report = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      archiveSize: 10,
      cohortSize: 1,
      maxResidualPct: 5,
      residual: [{ id: '999', afterPct: 5, baselinePct: 3, windowSec: 20, note: '' }],
      criterion1: {
        strictlyImproved: 0,
        tied: 0,
        regressed: 1,
        ties: [],
        violations: [{ id: '999', baselinePct: 3, afterPct: 5 }],
      },
    };

    const markdown = renderResidualMarkdown(report);
    expect(markdown).toContain('VIOLATIONS');
    expect(markdown).toContain('999');
  });
});
