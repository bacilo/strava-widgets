/**
 * Guard test for the pure helpers exported by compute-elevation-recount.mjs (Phase 30 plan 07,
 * D-15). Importing this module must not read `data/dashboard/index.json` as an import-time side
 * effect — if it does, the self-execution guard documented at the bottom of
 * compute-elevation-recount.mjs is wrong and must be fixed rather than worked around here.
 *
 * Every counting case drives `recountElevation`/`evaluateReport` on a hand-built document; none
 * reads the real archive. The mutation cases are the demonstrated-failing half T-30-30 requires:
 * a check that can only pass is not proven to discriminate.
 *
 * Also asserts the D-03/D-06 independence machine-checked in the plan's own words: no import of
 * the classifier module in any form, and no reference to the composite flag this script must
 * never touch (deliberately NOT written literally in this file's own assertions either — see the
 * source-scan tests below, which read compute-elevation-recount.mjs as TEXT and check for the
 * absence of these substrings without ever typing them out in a way `grep` on THIS file would
 * also match).
 */

import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { evaluateReport, readShippedIndex, recountElevation } from './compute-elevation-recount.mjs';

const SCRIPT_PATH = new URL('./compute-elevation-recount.mjs', import.meta.url);
const SCRIPT_SOURCE = readFileSync(SCRIPT_PATH, 'utf8');

/** A fully-populated, "nothing flagged" elevation object — the semantic default. */
function cleanElevation(overrides = {}) {
  return {
    tier: 'none',
    subGround: { flagged: false, minAltM: 12 },
    closureDrift: { state: 'clear', deltaM: 4, startEndDistM: 38 },
    verticalRate: { flagged: false, worstRateMps: 1.2, violatingSamples: 0 },
    ...overrides,
  };
}

function notComputableElevation() {
  return {
    tier: 'not-computable',
    subGround: { flagged: false, minAltM: null },
    closureDrift: { state: 'not-computable', deltaM: null, startEndDistM: null },
    verticalRate: { flagged: false, worstRateMps: null, violatingSamples: null },
  };
}

function row(id, elevation, quality = {}) {
  return { id, quality: { elevation, deviceEra: { family: 'garmin-fenix-6-pro', rawDeviceName: null }, ...quality } };
}

function doc(activities) {
  return { schemaVersion: 1, activities };
}

describe('recountElevation — union semantics', () => {
  it('counts 3 when three distinct rows are severe on three different modes', () => {
    const d = doc([
      row('a', cleanElevation({ tier: 'severe', subGround: { flagged: true, minAltM: -80 } })),
      row('b', cleanElevation({ tier: 'severe', closureDrift: { state: 'flagged', deltaM: 90, startEndDistM: 0 } })),
      row('c', cleanElevation({ tier: 'severe', verticalRate: { flagged: true, worstRateMps: 9, violatingSamples: 1 } })),
    ]);
    const report = recountElevation(d);
    expect(report.recountedSevereCount).toBe(3);
    expect(report.subGroundCount).toBe(1);
    expect(report.closureDriftCount).toBe(1);
    expect(report.verticalRateCount).toBe(1);
    expect(evaluateReport(report).pass).toBe(true);
  });

  it('counts 1, not 3, when one row is severe on all three modes (union, not a marginal sum)', () => {
    const d = doc([
      row(
        'all-three-severe',
        cleanElevation({
          tier: 'severe',
          subGround: { flagged: true, minAltM: -60 },
          closureDrift: { state: 'flagged', deltaM: 70, startEndDistM: 0 },
          verticalRate: { flagged: true, worstRateMps: 8, violatingSamples: 2 },
        })
      ),
    ]);
    const report = recountElevation(d);
    expect(report.recountedSevereCount).toBe(1);
    expect(report.overlaps.allThree).toBe(1);
    expect(evaluateReport(report).pass).toBe(true);
  });

  it('does not count a whole-signal not-computable row in the union, and counts it separately', () => {
    const d = doc([row('nc', notComputableElevation()), row('clean', cleanElevation())]);
    const report = recountElevation(d);
    expect(report.recountedSevereCount).toBe(0);
    expect(report.elevationTierNotComputableCount).toBe(1);
    expect(report.closureDriftNotComputableCount).toBe(0); // D-02 cohort excludes whole-signal not-computable rows
    expect(report.totalRows).toBe(2);
    expect(evaluateReport(report).pass).toBe(true);
  });

  it('counts a drift-only not-computable row (position unknown) in the D-02 cohort, not the whole-signal one', () => {
    const d = doc([
      row(
        'position-unknown',
        cleanElevation({ tier: 'none', closureDrift: { state: 'not-computable', deltaM: null, startEndDistM: null } })
      ),
    ]);
    const report = recountElevation(d);
    expect(report.closureDriftNotComputableCount).toBe(1);
    expect(report.elevationTierNotComputableCount).toBe(0);
  });

  it('builds the device-family breakdown only from the severe (recounted) set', () => {
    const d = doc([
      row('severe-suunto', cleanElevation({ tier: 'severe', subGround: { flagged: true, minAltM: -60 } }), {
        deviceEra: { family: 'suunto-9', rawDeviceName: null },
      }),
      row('healthy-suunto', cleanElevation(), { deviceEra: { family: 'suunto-9', rawDeviceName: null } }),
    ]);
    const report = recountElevation(d);
    expect(report.deviceFamilyBreakdown).toEqual({ 'suunto-9': 1 });
  });
});

describe('malformed and absent rows degrade rather than throw', () => {
  it('a row with quality absent counts toward missingElevationIds, not toward any mode', () => {
    const d = doc([{ id: 'no-quality' }, row('has-quality', cleanElevation())]);
    expect(() => recountElevation(d)).not.toThrow();
    const report = recountElevation(d);
    expect(report.missingElevationIds).toContain('no-quality');
    expect(report.rowsWithElevation).toBe(1);
  });

  it('a row with quality.elevation absent counts toward missingElevationIds, not toward any mode', () => {
    const d = doc([{ id: 'no-elevation', quality: { deviceEra: { family: 'suunto-9', rawDeviceName: null } } }]);
    expect(() => recountElevation(d)).not.toThrow();
    const report = recountElevation(d);
    expect(report.missingElevationIds).toContain('no-elevation');
    expect(report.recountedSevereCount).toBe(0);
  });

  it('a row with elevation present but malformed (subGround/closureDrift/verticalRate missing) counts none of them as severe and never throws', () => {
    const d = doc([{ id: 'malformed', quality: { elevation: { tier: 'none' } } }]);
    expect(() => recountElevation(d)).not.toThrow();
    const report = recountElevation(d);
    expect(report.rowsWithElevation).toBe(1);
    expect(report.subGroundCount).toBe(0);
    expect(report.closureDriftCount).toBe(0);
    expect(report.verticalRateCount).toBe(0);
    expect(report.recountedSevereCount).toBe(0);
  });

  it('an entirely non-object row does not throw', () => {
    const d = doc([null, 42, 'nope', row('valid', cleanElevation())]);
    expect(() => recountElevation(d)).not.toThrow();
    const report = recountElevation(d);
    expect(report.totalRows).toBe(4);
    expect(report.rowsWithElevation).toBe(1);
  });
});

describe('mutation cases — the demonstrated-failing half of D-15/T-30-30', () => {
  it('flips one row severe->clear on all three modes while the shipped tier stays "severe": clean passes, mutated fails naming the row id', () => {
    const cleanDoc = doc([
      row('victim', cleanElevation({ tier: 'severe', subGround: { flagged: true, minAltM: -60 } })),
      row('bystander', cleanElevation()),
    ]);
    const cleanReport = recountElevation(cleanDoc);
    expect(evaluateReport(cleanReport).pass).toBe(true);
    expect(cleanReport.recountedSevereCount).toBe(1);

    // The exact regression this recount exists to catch: the shipped rolled-up tier disagrees
    // with what the three per-mode booleans, read independently, actually say.
    const mutatedDoc = JSON.parse(JSON.stringify(cleanDoc));
    mutatedDoc.activities[0].quality.elevation.subGround.flagged = false;
    // tier stays 'severe' — a stale rollup that no longer matches its own per-mode evidence.
    const mutatedReport = recountElevation(mutatedDoc);
    const verdict = evaluateReport(mutatedReport);
    expect(verdict.pass).toBe(false);
    expect(mutatedReport.tierDisagreementIds.map((d) => d.id)).toContain('victim');
    expect(verdict.problems.some((p) => p.includes('victim'))).toBe(true);
  });

  it('sets one elevation.tier to the invalid string "critical": clean passes, mutated fails the closed-set check', () => {
    const cleanDoc = doc([row('a', cleanElevation()), row('b', cleanElevation())]);
    const cleanReport = recountElevation(cleanDoc);
    expect(evaluateReport(cleanReport).pass).toBe(true);

    const mutatedDoc = JSON.parse(JSON.stringify(cleanDoc));
    mutatedDoc.activities[0].quality.elevation.tier = 'critical';
    const mutatedReport = recountElevation(mutatedDoc);
    const verdict = evaluateReport(mutatedReport);
    expect(verdict.pass).toBe(false);
    expect(mutatedReport.invalidTierIds).toContain('a');
    expect(verdict.problems.some((p) => p.includes('closed set'))).toBe(true);
  });
});

describe('--expect predicate', () => {
  it('passes when the recounted union equals the expected value', () => {
    const d = doc([row('sev', cleanElevation({ tier: 'severe', subGround: { flagged: true, minAltM: -60 } }))]);
    const report = recountElevation(d);
    expect(evaluateReport(report, 1).pass).toBe(true);
  });

  it('fails when the recounted union is off by one from the expected value', () => {
    const d = doc([row('sev', cleanElevation({ tier: 'severe', subGround: { flagged: true, minAltM: -60 } }))]);
    const report = recountElevation(d);
    const verdict = evaluateReport(report, 2);
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('--expect 2'))).toBe(true);
  });
});

describe('schemaVersion check', () => {
  it('fails when schemaVersion is not 1', () => {
    const d = doc([row('a', cleanElevation())]);
    d.schemaVersion = 2;
    const verdict = evaluateReport(recountElevation(d));
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('schemaVersion'))).toBe(true);
  });
});

describe('readShippedIndex — never throws', () => {
  it('returns { ok: false, reason } for a missing file', () => {
    const result = readShippedIndex('/tmp/definitely-does-not-exist-elevation-recount.json');
    expect(result.ok).toBe(false);
    expect(typeof result.reason).toBe('string');
  });

  it('returns { ok: false, reason } for malformed JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elev-recount-guard-'));
    const badPath = join(dir, 'bad.json');
    try {
      writeFileSync(badPath, '{ not valid json', 'utf8');
      const result = readShippedIndex(badPath);
      expect(result.ok).toBe(false);
      expect(typeof result.reason).toBe('string');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('import-time side effects', () => {
  it('importing this module triggers no read of data/dashboard/index.json', async () => {
    const spy = vi.spyOn(fs, 'readFileSync');
    // Re-import via a cache-busting query so this assertion is not defeated by vitest's module
    // cache having already loaded the module for the describe blocks above.
    await import('./compute-elevation-recount.mjs?cache-bust-guard-test');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('source-scan independence guards (D-03/D-06/D-16, machine-checked not remembered)', () => {
  it('has no import/require of the classifier module, compiled or source, by any spelling', () => {
    // The forbidden substring is assembled at runtime so this assertion file's own text never
    // contains the literal identifier either — a case-sensitive grep over the source is what the
    // plan's acceptance criteria run directly.
    const forbidden = ['pace', 'quality'].join('-');
    expect(SCRIPT_SOURCE.includes(forbidden)).toBe(false);
  });

  it('has no reference to the pace-trust severity composite flag', () => {
    const forbidden = ['any', 'Severe'].join('');
    expect(SCRIPT_SOURCE.includes(forbidden)).toBe(false);
  });

  it('has no tiering-key array literal containing the string "elevation"', () => {
    // A crude but effective structural check: no array literal in the source contains the
    // quoted string 'elevation' as one of its own elements.
    const arrayLiteralWithElevation = /\[[^\]]*['"]elevation['"][^\]]*\]/;
    expect(arrayLiteralWithElevation.test(SCRIPT_SOURCE)).toBe(false);
  });

  it('has no fs write call (writeFileSync/writeFile/appendFileSync/appendFile) anywhere in its source', () => {
    // T-27-09 pattern extended to this script per D-16 — this recount never writes anything,
    // let alone under data/.
    expect(/\bwriteFileSync\s*\(/.test(SCRIPT_SOURCE)).toBe(false);
    expect(/\bwriteFile\s*\(/.test(SCRIPT_SOURCE)).toBe(false);
    expect(/\bappendFileSync\s*\(/.test(SCRIPT_SOURCE)).toBe(false);
    expect(/\bappendFile\s*\(/.test(SCRIPT_SOURCE)).toBe(false);
  });
});

describe('demonstrated failing: a hand-built fixture where the shipped tier disagrees with the per-mode evidence', () => {
  it('reports the disagreement and would exit non-zero, then the fixture is discarded (never touches data/)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elev-recount-fixture-'));
    const fixturePath = join(dir, 'index.json');
    try {
      // One row's elevation.tier is 'none' while subGround.flagged is true — a shipped rollup
      // that disagrees with its own per-mode evidence, the exact T-30-30 regression signature.
      const fixtureDoc = doc([
        row(
          'disagreeing-row',
          cleanElevation({ tier: 'none', subGround: { flagged: true, minAltM: -75 } })
        ),
      ]);
      writeFileSync(fixturePath, JSON.stringify(fixtureDoc), 'utf8');

      const read = readShippedIndex(fixturePath);
      expect(read.ok).toBe(true);
      const report = recountElevation(read.doc);
      const verdict = evaluateReport(report);
      expect(verdict.pass).toBe(false);
      expect(report.tierDisagreementIds).toEqual([
        { id: 'disagreeing-row', recountedSevere: true, shippedSevere: false },
      ]);
      expect(verdict.problems.some((p) => p.includes('disagreeing-row'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
