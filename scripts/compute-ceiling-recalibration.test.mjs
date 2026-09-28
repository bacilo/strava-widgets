/**
 * Guard test for the pure functions exported by
 * compute-ceiling-recalibration.mjs (Phase 36 plan 10, D-09/D-10/D-12).
 * Importing this module must not run the archive sweep or write
 * 36-CEILING-RECALIBRATION.md — if it does, the self-execution guard
 * documented at the bottom of compute-ceiling-recalibration.mjs is wrong and
 * must be fixed rather than worked around here. Every fixture below is
 * hand-built; no fixture reads any committed archive directory under the
 * repo's top-level `data` folder, and no test writes anywhere.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { TARGET_ORDER } from '../dist/analytics/best-effort.types.js';
import { CEILING_MIN_POPULATION } from '../dist/analytics/best-effort-ceiling.js';

import {
  buildPopulations,
  buildRecalibrationReport,
  describeDepartures,
  describeMovementCause,
  diffAgainstCommittedBaseline,
  findFailOpenFindings,
  reconstructOldEfforts,
  renderRecalibrationMarkdown,
} from './compute-ceiling-recalibration.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATOR_PATH = join(__dirname, 'compute-ceiling-recalibration.mjs');

/** Minimal per-effort fixture, in the shape the NEW document's `activities[id].efforts[]` carries. */
function makeNewEffort({
  distance,
  durationSec,
  demotion = null,
  contaminated = null,
  excludedFromRecords = false,
}) {
  return { distance, durationSec, demotion, contaminated, excludedFromRecords };
}

function makeActivity(efforts) {
  return { efforts };
}

/** A minimal `CeilingDerivation`-shaped object — only the three fields this file's functions read. */
function makeCeiling({ populationN, p90Mps, ceilingMps, distance = 'x', multiplier = 1.28, failOpenReason = null }) {
  return { distance, populationN, p90Mps, multiplier, ceilingMps, failOpenReason };
}

function fullCeilingsMap(perDistance) {
  const result = {};
  for (const key of TARGET_ORDER) {
    result[key] = perDistance[key] ?? makeCeiling({ populationN: 0, p90Mps: null, ceilingMps: null, distance: key, failOpenReason: 'no data' });
  }
  return result;
}

// ---------------------------------------------------------------------------
// a. RENDERER IDEMPOTENCE
// ---------------------------------------------------------------------------

describe('renderRecalibrationMarkdown idempotence', () => {
  it('is byte-identical across two calls over an unchanged report, including the Generated line', () => {
    const row = {
      distance: '5k',
      populationBefore: 100,
      populationAfter: 90,
      p90Before: 4.0,
      p90After: 3.95,
      ceilingBefore: 5.12,
      ceilingAfter: 5.056,
      delta: -0.064,
      movementKind: 'fell',
      departures: [{ activityId: '123', oldSpeedMps: 3.9, reason: 'no-clean-window' }],
      retainedMedianMps: 4.0,
      segmentIntersectionCount: 1,
    };
    row.cause = describeMovementCause(row);

    const report = {
      generatedAt: '2020-01-01T00:00:00.000Z',
      rows: [row],
      failOpenFindings: [],
      baselineDrift: { available: true, rows: [] },
      reconciliation: [
        {
          distance: '5k',
          populationBefore: 100,
          populationAfter: 90,
          probePopulationBefore: 100,
          probePopulationAfter: 90,
          ceilingBefore: 5.12,
          ceilingAfter: 5.056,
          probeCeilingBefore: 5.12,
          probeCeilingAfter: 5.056,
        },
      ],
      oneMiCrossCheck: {
        referenceCeilingMps: 4.628,
        referenceP90Mps: 3.616,
        referencePopulationN: 1851,
        measuredCeilingMps: 4.628,
        measuredP90Mps: 3.616,
        measuredPopulationN: 1851,
        matches: true,
      },
      inputs: {
        archiveSize: 1874,
        committedBaselinePath: 'data/best-effort-ceiling.json',
        committedBaselineGeneratedAt: '2019-12-31T00:00:00.000Z',
      },
    };

    const first = renderRecalibrationMarkdown(report);
    const second = renderRecalibrationMarkdown(report);
    expect(second).toBe(first);
    expect(first).toContain('**Generated:** 2020-01-01T00:00:00.000Z');
  });

  it('the renderer function body contains no new Date( call, so it cannot itself break idempotence', () => {
    const source = readFileSync(GENERATOR_PATH, 'utf8');
    const start = source.indexOf('export function renderRecalibrationMarkdown');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('\n}\n', start);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).not.toContain('new Date(');
  });
});

// ---------------------------------------------------------------------------
// b. CAUSE COMPLETENESS — every movementKind, including none and upward
// ---------------------------------------------------------------------------

describe('describeMovementCause — cause completeness across every movementKind', () => {
  const rowFell = {
    distance: '400m',
    populationBefore: 100,
    populationAfter: 90,
    p90Before: 5.0,
    p90After: 4.9,
    ceilingBefore: 6.4,
    ceilingAfter: 6.272,
    delta: -0.128,
    movementKind: 'fell',
    departures: [{ activityId: '111', oldSpeedMps: 4.5, reason: 'no-clean-window' }],
    retainedMedianMps: 4.8,
    segmentIntersectionCount: 1,
  };
  const rowRose = {
    distance: '1k',
    populationBefore: 50,
    populationAfter: 40,
    p90Before: 4.0,
    p90After: 4.2,
    ceilingBefore: 5.12,
    ceilingAfter: 5.376,
    delta: 0.256,
    movementKind: 'rose',
    departures: [{ activityId: '222', oldSpeedMps: 3.15, reason: 'no-clean-window' }],
    retainedMedianMps: 4.5,
    segmentIntersectionCount: 2,
  };
  const rowUnchanged = {
    distance: '1mi',
    populationBefore: 80,
    populationAfter: 80,
    p90Before: 4.0,
    p90After: 4.0,
    ceilingBefore: 5.12,
    ceilingAfter: 5.12,
    delta: 0,
    movementKind: 'unchanged',
    departures: [],
    retainedMedianMps: 4.0,
    segmentIntersectionCount: 0,
  };
  const rowLostCeiling = {
    distance: '5k',
    populationBefore: 120,
    populationAfter: 80,
    p90Before: 4.0,
    p90After: null,
    ceilingBefore: 5.0,
    ceilingAfter: null,
    delta: null,
    movementKind: 'lost-ceiling',
    departures: [{ activityId: '333', oldSpeedMps: 3.9, reason: 'no-clean-window' }],
    retainedMedianMps: null,
    segmentIntersectionCount: 1,
  };
  const rowGainedCeiling = {
    distance: '10k',
    populationBefore: 80,
    populationAfter: 120,
    p90Before: null,
    p90After: 4.0,
    ceilingBefore: null,
    ceilingAfter: 5.2,
    delta: null,
    movementKind: 'gained-ceiling',
    departures: [],
    retainedMedianMps: 4.0,
    segmentIntersectionCount: 0,
  };
  const rowNeverDerivable = {
    distance: 'marathon',
    populationBefore: 0,
    populationAfter: 0,
    p90Before: null,
    p90After: null,
    ceilingBefore: null,
    ceilingAfter: null,
    delta: null,
    movementKind: 'never-derivable',
    departures: [],
    retainedMedianMps: null,
    segmentIntersectionCount: 0,
  };

  const allRows = [rowFell, rowRose, rowUnchanged, rowLostCeiling, rowGainedCeiling, rowNeverDerivable];

  it('produces a non-empty string for every one of the six movementKinds', () => {
    for (const row of allRows) {
      const cause = describeMovementCause(row);
      expect(typeof cause).toBe('string');
      expect(cause.length).toBeGreaterThan(0);
    }
  });

  it("the 'rose' row's sentence contains the departing and retained speed figures from the row itself", () => {
    const cause = describeMovementCause(rowRose);
    expect(cause).toContain('3.1500'); // the single departure's OLD implied speed, fmtMps(3.15)
    expect(cause).toContain('4.5000'); // retainedMedianMps
    expect(cause).toContain('ROSE');
  });

  it("the 'unchanged' row's sentence contains the literal zero count", () => {
    const cause = describeMovementCause(rowUnchanged);
    expect(cause).toContain('0 effort(s) at this distance had a window intersecting a segment');
  });

  it('the rendered markdown carries a cause sentence for every distance — no row left with a number and no account', () => {
    const rowsWithCause = allRows.map((r) => ({ ...r, cause: describeMovementCause(r) }));
    const report = {
      generatedAt: '2020-01-01T00:00:00.000Z',
      rows: rowsWithCause,
      failOpenFindings: findFailOpenFindings({ rows: rowsWithCause }),
      baselineDrift: { available: true, rows: [] },
      reconciliation: rowsWithCause.map((r) => ({
        distance: r.distance,
        populationBefore: r.populationBefore,
        populationAfter: r.populationAfter,
        probePopulationBefore: r.populationBefore,
        probePopulationAfter: r.populationAfter,
        ceilingBefore: r.ceilingBefore,
        ceilingAfter: r.ceilingAfter,
        probeCeilingBefore: r.ceilingBefore,
        probeCeilingAfter: r.ceilingAfter,
      })),
      oneMiCrossCheck: {
        referenceCeilingMps: 4.628,
        referenceP90Mps: 3.616,
        referencePopulationN: 1851,
        measuredCeilingMps: 4.628,
        measuredP90Mps: 3.616,
        measuredPopulationN: 1851,
        matches: true,
      },
      inputs: { archiveSize: 1874, committedBaselinePath: 'data/best-effort-ceiling.json', committedBaselineGeneratedAt: null },
    };

    const markdown = renderRecalibrationMarkdown(report);
    for (const row of rowsWithCause) {
      expect(markdown).toContain(row.cause);
    }
  });
});

// ---------------------------------------------------------------------------
// c. FAIL-OPEN FINDING (D-10), both directions
// ---------------------------------------------------------------------------

describe('findFailOpenFindings (D-10)', () => {
  it('a half row crossing the floor produces exactly one finding, rendered with both populations and the floor', () => {
    const halfRow = {
      distance: 'half',
      populationBefore: 104,
      populationAfter: 69,
      p90Before: 3.4388,
      p90After: null,
      ceilingBefore: 4.4017,
      ceilingAfter: null,
      delta: null,
      movementKind: 'lost-ceiling',
      departures: [],
      retainedMedianMps: null,
      segmentIntersectionCount: 0,
    };
    halfRow.cause = describeMovementCause(halfRow);
    const otherRow = {
      distance: '5k',
      populationBefore: 100,
      populationAfter: 100,
      p90Before: 4.0,
      p90After: 4.0,
      ceilingBefore: 5.12,
      ceilingAfter: 5.12,
      delta: 0,
      movementKind: 'unchanged',
      departures: [],
      retainedMedianMps: 4.0,
      segmentIntersectionCount: 0,
    };
    otherRow.cause = describeMovementCause(otherRow);

    const report = { rows: [halfRow, otherRow] };
    const findings = findFailOpenFindings(report);
    expect(findings.length).toBe(1);
    expect(findings[0]).toMatchObject({
      distance: 'half',
      populationBefore: 104,
      populationAfter: 69,
      floor: CEILING_MIN_POPULATION,
    });

    const fullReport = {
      generatedAt: '2020-01-01T00:00:00.000Z',
      rows: [halfRow, otherRow],
      failOpenFindings: findings,
      baselineDrift: { available: true, rows: [] },
      reconciliation: [],
      oneMiCrossCheck: {
        referenceCeilingMps: 4.628,
        referenceP90Mps: 3.616,
        referencePopulationN: 1851,
        measuredCeilingMps: 4.628,
        measuredP90Mps: 3.616,
        measuredPopulationN: 1851,
        matches: true,
      },
      inputs: { archiveSize: 1874, committedBaselinePath: 'data/best-effort-ceiling.json', committedBaselineGeneratedAt: null },
    };
    const markdown = renderRecalibrationMarkdown(fullReport);
    expect(markdown).toContain('## Fail-Open Findings');
    expect(markdown).toContain('half');
    expect(markdown).toContain('104');
    expect(markdown).toContain('69');
    expect(markdown).toContain(String(CEILING_MIN_POPULATION));
    expect(markdown).toContain('may NOT be moved');
  });

  it('a report with no distance crossing the floor renders the section with an explicit none statement, not omitted', () => {
    const row = {
      distance: '5k',
      populationBefore: 100,
      populationAfter: 100,
      p90Before: 4.0,
      p90After: 4.0,
      ceilingBefore: 5.12,
      ceilingAfter: 5.12,
      delta: 0,
      movementKind: 'unchanged',
      departures: [],
      retainedMedianMps: 4.0,
      segmentIntersectionCount: 0,
    };
    row.cause = describeMovementCause(row);

    const findings = findFailOpenFindings({ rows: [row] });
    expect(findings).toEqual([]);

    const report = {
      generatedAt: '2020-01-01T00:00:00.000Z',
      rows: [row],
      failOpenFindings: findings,
      baselineDrift: { available: true, rows: [] },
      reconciliation: [],
      oneMiCrossCheck: {
        referenceCeilingMps: 4.628,
        referenceP90Mps: 3.616,
        referencePopulationN: 1851,
        measuredCeilingMps: 4.628,
        measuredP90Mps: 3.616,
        measuredPopulationN: 1851,
        matches: true,
      },
      inputs: { archiveSize: 1874, committedBaselinePath: 'data/best-effort-ceiling.json', committedBaselineGeneratedAt: null },
    };
    const markdown = renderRecalibrationMarkdown(report);
    expect(markdown).toContain('## Fail-Open Findings');
    expect(markdown).toContain('None in this run');
  });
});

// ---------------------------------------------------------------------------
// d. OLD RECONSTRUCTION — the three-case rule, plus the reinstatement case
// ---------------------------------------------------------------------------

describe('reconstructOldEfforts — the three-case OLD-duration rule', () => {
  it('picks the correct OLD duration for each of the three cases', () => {
    const newDoc = {
      activities: {
        case1: makeActivity([
          makeNewEffort({
            distance: '1k',
            durationSec: 220, // NEW/clean top-level figure
            demotion: null,
            contaminated: { guard: 'unreliable-segment', reason: 'r', durationSec: 200, paceSecPerKm: 200, startOffsetSec: 0, endOffsetSec: 200 },
          }),
        ]),
        case2: makeActivity([
          makeNewEffort({
            distance: '10k',
            durationSec: 4000, // RAW/unconstrained top-level figure (D-06 puts it there)
            demotion: { guard: 'unreliable-segment', reason: 'no clean window' },
            contaminated: null,
          }),
        ]),
        case3: makeActivity([
          makeNewEffort({
            distance: '5k',
            durationSec: 1500, // never touched by the search
            demotion: null,
            contaminated: null,
          }),
        ]),
      },
    };

    const oldEfforts = reconstructOldEfforts(newDoc, new Map());
    const byActivity = new Map(oldEfforts.map((e) => [e.activityId, e]));

    expect(byActivity.get('case1').durationSec).toBe(200); // case 1: from contaminated.durationSec
    expect(byActivity.get('case2').durationSec).toBe(4000); // case 2: from top-level durationSec
    expect(byActivity.get('case3').durationSec).toBe(1500); // case 3: from top-level durationSec, unchanged
  });

  it('the reinstatement case: OLD duration fails isPlausible while the NEW (clean) one does not', () => {
    const newDoc = {
      activities: {
        reinstated: makeActivity([
          makeNewEffort({
            distance: '400m',
            durationSec: 100, // NEW/clean: 400/100 = 4 m/s, plausible
            demotion: null,
            contaminated: {
              guard: 'unreliable-segment',
              reason: 'r',
              durationSec: 30, // OLD/raw: 400/30 = 13.33 m/s, exceeds the 400m world record (~9.296 m/s)
              paceSecPerKm: 75,
              startOffsetSec: 0,
              endOffsetSec: 30,
            },
          }),
        ]),
      },
    };

    const oldEfforts = reconstructOldEfforts(newDoc, new Map());
    expect(oldEfforts).toHaveLength(1);
    const reinstated = oldEfforts[0];
    expect(reinstated.durationSec).toBe(30);
    expect(reinstated.demotion).not.toBeNull();
    expect(reinstated.demotion.guard).toBe('world-record');

    // The NEW side (as authored in newDoc, not reconstructed) is null —
    // this effort ranks under Phase 36's code but would NOT have ranked
    // under the pre-Phase-36 code. The "reinstatement population, pinned".
    const newEffort = newDoc.activities.reinstated.efforts[0];
    expect(newEffort.demotion).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// e. TABLE SAFETY — pipe/newline/CR injection
// ---------------------------------------------------------------------------

describe('table safety — an injected activity id cannot break the rendered table', () => {
  it('describeDepartures renders a single line regardless of a malicious activity id', () => {
    const safeRow = {
      departures: [{ activityId: '12345', oldSpeedMps: 4.0, reason: 'no-clean-window' }],
    };
    const maliciousRow = {
      departures: [{ activityId: '1|2\n3\r4', oldSpeedMps: 4.0, reason: 'no-clean-window' }],
    };

    const safeText = describeDepartures(safeRow);
    const maliciousText = describeDepartures(maliciousRow);

    expect(safeText.split('\n')).toHaveLength(1);
    expect(maliciousText.split('\n')).toHaveLength(1);
    expect(maliciousText).toContain('(malformed id)');
  });

  it("the rendered markdown's line count is unchanged by an injected pipe/newline/CR activity id", () => {
    const baseRow = (activityId) => {
      const row = {
        distance: '5k',
        populationBefore: 10,
        populationAfter: 9,
        p90Before: 4.0,
        p90After: 3.9,
        ceilingBefore: 5.12,
        ceilingAfter: 4.99,
        delta: -0.13,
        movementKind: 'fell',
        departures: [{ activityId, oldSpeedMps: 3.9, reason: 'no-clean-window' }],
        retainedMedianMps: 4.0,
        segmentIntersectionCount: 1,
      };
      row.cause = describeMovementCause(row);
      return row;
    };

    const makeReport = (activityId) => ({
      generatedAt: '2020-01-01T00:00:00.000Z',
      rows: [baseRow(activityId)],
      failOpenFindings: [],
      baselineDrift: { available: true, rows: [] },
      reconciliation: [],
      oneMiCrossCheck: {
        referenceCeilingMps: 4.628,
        referenceP90Mps: 3.616,
        referencePopulationN: 1851,
        measuredCeilingMps: 4.628,
        measuredP90Mps: 3.616,
        measuredPopulationN: 1851,
        matches: true,
      },
      inputs: { archiveSize: 1874, committedBaselinePath: 'data/best-effort-ceiling.json', committedBaselineGeneratedAt: null },
    });

    const safeMarkdown = renderRecalibrationMarkdown(makeReport('12345'));
    const maliciousMarkdown = renderRecalibrationMarkdown(makeReport('1|2\n3\r4'));

    expect(maliciousMarkdown.split('\n').length).toBe(safeMarkdown.split('\n').length);
    expect(maliciousMarkdown).toContain('(malformed id)');
  });
});

// ---------------------------------------------------------------------------
// f. BASELINE DRIFT
// ---------------------------------------------------------------------------

describe('diffAgainstCommittedBaseline', () => {
  function makeFullCeilings(ceilingMps) {
    const perDistance = {};
    for (const key of TARGET_ORDER) {
      perDistance[key] = makeCeiling({ distance: key, populationN: 200, p90Mps: ceilingMps / 1.28, ceilingMps });
    }
    return fullCeilingsMap(perDistance);
  }

  it('returns { available: false } when there is no committed baseline to compare against', () => {
    const oldCeilings = makeFullCeilings(5.0);
    const diff = diffAgainstCommittedBaseline(null, oldCeilings);
    expect(diff).toEqual({ available: false, rows: [] });
  });

  it('a disagreeing committed baseline produces a non-empty diff naming both figures', () => {
    const oldCeilings = makeFullCeilings(5.0);
    const committedBaseline = {
      ceilings: (() => {
        const c = {};
        for (const key of TARGET_ORDER) {
          c[key] = { ceilingMps: 5.0, p90Mps: 5.0 / 1.28, populationN: 200 };
        }
        c['400m'] = { ceilingMps: 5.2, p90Mps: 5.2 / 1.28, populationN: 200 }; // disagreement
        return c;
      })(),
    };

    const diff = diffAgainstCommittedBaseline(committedBaseline, oldCeilings);
    expect(diff.available).toBe(true);
    expect(diff.rows).toHaveLength(1);
    expect(diff.rows[0]).toMatchObject({ distance: '400m', reconstructedCeilingMps: 5.0, committedCeilingMps: 5.2 });

    const rowsForReport = TARGET_ORDER.map((distance) => {
      const c = oldCeilings[distance];
      const row = {
        distance,
        populationBefore: c.populationN,
        populationAfter: c.populationN,
        p90Before: c.p90Mps,
        p90After: c.p90Mps,
        ceilingBefore: c.ceilingMps,
        ceilingAfter: c.ceilingMps,
        delta: 0,
        movementKind: 'unchanged',
        departures: [],
        retainedMedianMps: c.p90Mps,
        segmentIntersectionCount: 0,
      };
      row.cause = describeMovementCause(row);
      return row;
    });
    const report = {
      generatedAt: '2020-01-01T00:00:00.000Z',
      rows: rowsForReport,
      failOpenFindings: [],
      baselineDrift: diff,
      reconciliation: [],
      oneMiCrossCheck: {
        referenceCeilingMps: 4.628,
        referenceP90Mps: 3.616,
        referencePopulationN: 1851,
        measuredCeilingMps: 4.628,
        measuredP90Mps: 3.616,
        measuredPopulationN: 1851,
        matches: true,
      },
      inputs: { archiveSize: 1874, committedBaselinePath: 'data/best-effort-ceiling.json', committedBaselineGeneratedAt: '2020-01-01T00:00:00Z' },
    };
    const markdown = renderRecalibrationMarkdown(report);
    expect(markdown).toContain('## Baseline Drift');
    expect(markdown).toContain('5.0000');
    expect(markdown).toContain('5.2000');
  });

  it('an agreeing committed baseline renders the explicit no-drift statement', () => {
    const oldCeilings = makeFullCeilings(5.0);
    const committedBaseline = {
      ceilings: (() => {
        const c = {};
        for (const key of TARGET_ORDER) {
          c[key] = { ceilingMps: 5.0, p90Mps: 5.0 / 1.28, populationN: 200 };
        }
        return c;
      })(),
    };

    const diff = diffAgainstCommittedBaseline(committedBaseline, oldCeilings);
    expect(diff).toEqual({ available: true, rows: [] });

    const row = {
      distance: '5k',
      populationBefore: 200,
      populationAfter: 200,
      p90Before: 5.0 / 1.28,
      p90After: 5.0 / 1.28,
      ceilingBefore: 5.0,
      ceilingAfter: 5.0,
      delta: 0,
      movementKind: 'unchanged',
      departures: [],
      retainedMedianMps: 5.0 / 1.28,
      segmentIntersectionCount: 0,
    };
    row.cause = describeMovementCause(row);
    const report = {
      generatedAt: '2020-01-01T00:00:00.000Z',
      rows: [row],
      failOpenFindings: [],
      baselineDrift: diff,
      reconciliation: [],
      oneMiCrossCheck: {
        referenceCeilingMps: 4.628,
        referenceP90Mps: 3.616,
        referencePopulationN: 1851,
        measuredCeilingMps: 4.628,
        measuredP90Mps: 3.616,
        measuredPopulationN: 1851,
        matches: true,
      },
      inputs: { archiveSize: 1874, committedBaselinePath: 'data/best-effort-ceiling.json', committedBaselineGeneratedAt: '2020-01-01T00:00:00Z' },
    };
    const markdown = renderRecalibrationMarkdown(report);
    expect(markdown).toContain('None — the reconstructed OLD ceilings agree');
  });
});

// ---------------------------------------------------------------------------
// buildPopulations — the assertion-backed membership rule
// ---------------------------------------------------------------------------

describe('buildPopulations', () => {
  it('retains a ceiling-guarded effort (Pass-1 has no ceiling yet) but excludes absolute-guard and unreliable-segment guards', () => {
    const efforts = [
      { distance: '5k', durationSec: 1000, demotion: null, excludedFromRecords: false },
      { distance: '5k', durationSec: 900, demotion: { guard: 'ceiling', reason: 'x' }, excludedFromRecords: false },
      { distance: '5k', durationSec: 800, demotion: { guard: 'world-record', reason: 'x' }, excludedFromRecords: false },
      { distance: '5k', durationSec: 700, demotion: { guard: 'unreliable-segment', reason: 'x' }, excludedFromRecords: false },
      { distance: '5k', durationSec: 600, demotion: null, excludedFromRecords: true },
    ];
    const populations = buildPopulations(efforts, { useOld: false });
    expect(populations.get('5k')).toHaveLength(2); // the null-demotion one and the ceiling-guarded one
  });

  it('throws when a useOld:true record carries a guard reconstructOldEfforts never assigns', () => {
    const efforts = [{ distance: '5k', durationSec: 1000, demotion: { guard: 'ceiling', reason: 'x' }, excludedFromRecords: false }];
    expect(() => buildPopulations(efforts, { useOld: true })).toThrow(/reconstructOldEfforts never assigns/);
  });
});

// ---------------------------------------------------------------------------
// buildRecalibrationReport — end-to-end over a small synthetic archive
// ---------------------------------------------------------------------------

describe('buildRecalibrationReport', () => {
  it('assembles a full report with one row per TARGET_ORDER distance from OLD/NEW ceilings and efforts', () => {
    const oldCeilings = fullCeilingsMap({
      '5k': makeCeiling({ distance: '5k', populationN: 150, p90Mps: 4.0, ceilingMps: 5.12 }),
    });
    const newCeilings = fullCeilingsMap({
      '5k': makeCeiling({ distance: '5k', populationN: 140, p90Mps: 3.95, ceilingMps: 5.056 }),
    });
    const oldEfforts = [{ activityId: 'a1', distance: '5k', durationSec: 1200, impliedSpeedMps: 4.17, demotion: null, excludedFromRecords: false }];
    const newEfforts = [
      { activityId: 'a1', distance: '5k', durationSec: 1300, impliedSpeedMps: 3.85, demotion: { guard: 'unreliable-segment', reason: 'x' }, excludedFromRecords: false, contaminated: null },
    ];

    const report = buildRecalibrationReport({
      oldCeilings,
      newCeilings,
      oldEfforts,
      newEfforts,
      committedBaseline: null,
      inputs: { archiveSize: 1, committedBaselinePath: 'data/best-effort-ceiling.json', committedBaselineGeneratedAt: null },
    });

    expect(report.rows).toHaveLength(TARGET_ORDER.length);
    const fiveK = report.rows.find((r) => r.distance === '5k');
    expect(fiveK.movementKind).toBe('fell');
    expect(fiveK.departures).toHaveLength(1);
    expect(fiveK.departures[0]).toMatchObject({ activityId: 'a1', reason: 'no-clean-window' });
    expect(typeof fiveK.cause).toBe('string');
    expect(fiveK.cause.length).toBeGreaterThan(0);
    expect(report.baselineDrift).toEqual({ available: false, rows: [] });
  });
});
