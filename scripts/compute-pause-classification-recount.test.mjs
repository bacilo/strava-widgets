/**
 * Tests for compute-pause-classification-recount.mjs (Phase 34 plan 07, D-18). Every function
 * case drives its target on a hand-built synthetic fixture; none reads the real archive or the
 * real calibration artifacts (those are exercised only by `npm run compute-pause-classification-
 * recount` itself, watched failing/passing per plan 34-07 Task 2, quoted verbatim in the SUMMARY).
 *
 * The zero-import guard below is the one part of this file that reads the real SOURCE (not data)
 * of compute-pause-classification-recount.mjs, mirroring compute-unreliable-segment-recount.test.mjs
 * / compute-walking-break-evidence.test.mjs's own guards exactly — string-scan after stripping
 * comments, never an unverified runtime spy on the `fs` module's namespace object (that shape
 * cannot observe a named `import { readFileSync } from 'fs'` and would pass vacuously — the
 * fs-spy lesson).
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import {
  evaluatePauseRecount,
  formatRecountTable,
  localClassify,
  parseChosenConstants,
  parseClassTable,
  recountPauseIntervals,
} from './compute-pause-classification-recount.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('./compute-pause-classification-recount.mjs', import.meta.url));
const FORBIDDEN_MODULE_NAMES = ['unreliable-segments', 'pace-derivation', 'pause-classification'];

/**
 * Strips comments BEFORE searching for forbidden module names — load-bearing, since this script's
 * own header docblock legitimately NAMES the forbidden modules while explaining why they are
 * forbidden. Block comments first, then `//`-to-end-of-line, mirroring
 * compute-unreliable-segment-recount.test.mjs's own stripComments helper exactly.
 */
function stripComments(source) {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

describe('zero-import guard (D-18)', () => {
  it('the stripper actually removes lines naming each forbidden module — proving it works rather than assuming it', () => {
    const fixture = [
      'const ok = 1;',
      '// imports dist/analytics/pace-derivation.js, forbidden',
      '/* also forbidden: unreliable-segments */',
      '// and pause-classification too',
      'const alsoOk = 2;',
    ].join('\n');

    const stripped = stripComments(fixture);

    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(fixture).toContain(forbidden); // sanity: the raw fixture DOES name every forbidden module
      expect(stripped).not.toContain(forbidden); // the stripper removed it
    }
    expect(stripped).toContain('const ok = 1;');
    expect(stripped).toContain('const alsoOk = 2;');
  });

  it('is watched failing first: a temporary in-test mutation of the real source that plants a pause-classification import (not inside a comment) is caught by the same stripComments + FORBIDDEN_MODULE_NAMES scan used below — proving the check is not vacuous before it is trusted', () => {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    const mutated = raw + "\nimport { classifyPauses } from '../src/analytics/pause-classification.js';\n";
    const strippedMutated = stripComments(mutated);
    const caught = FORBIDDEN_MODULE_NAMES.some((name) => strippedMutated.includes(name));
    expect(caught).toBe(true);
  });

  it('compute-pause-classification-recount.mjs itself contains none of the forbidden module names once comments are stripped, and never imports from ../dist/', () => {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    const stripped = stripComments(raw);

    // Sanity check first: the RAW source legitimately names every forbidden module (in its header
    // docblock, explaining why each is forbidden) — if this failed, the test below would be vacuous.
    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(raw).toContain(forbidden);
    }

    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(stripped).not.toContain(forbidden);
    }
    expect(stripped).not.toContain("from '../dist/");
  });
});

// A single reusable fixture exercising both a burst-adjacent gap (D-07's "both sides" shape,
// becoming one merged-segment row) and a separate, non-adjacent LONE gap with no burst on either
// side (becoming a recording-gap row, since recountGapFirst emits no row for it but localGapSpans
// still finds the span).
//
// idx0-1: clean (3 m/s). idx1-2: burst (15 m/s, excess 20). idx2-3: gap (12s, CONSUMED into the
// merged row below — contained inside it). idx3-4: burst (15 m/s, excess 20). idx4-5: clean
// (0.3 m/s), ends the run. idx5-6: clean (0.25 m/s). idx6-7: a SECOND, LONE gap (22s) with no
// burst on either side. idx7-8/8-9: clean.
const FIXTURE_T = [0, 10, 12, 24, 26, 36, 40, 62, 64, 66];
const FIXTURE_D = [0, 30, 60, 62, 92, 95, 96, 97, 98, 99];
const FIXTURE_PARAMS = { speedLimitMps: 5, excessFloorMetres: 10 };

describe('recount: recountPauseIntervals (gap-first, reusing recountGapFirst) plus lone recording gaps', () => {
  it('returns the merged-segment row plus the separate lone recording-gap row, sorted by startSec, with the merged row untouched by the lone gap', () => {
    const result = recountPauseIntervals(FIXTURE_T, FIXTURE_D, FIXTURE_PARAMS);
    expect(result.ok).toBe(true);
    expect(result.rows).toEqual([
      { source: 'merged-segment', startSec: 10, endSec: 26, seconds: 16, metres: 62 },
      { source: 'recording-gap', startSec: 40, endSec: 62, seconds: 22, metres: 1 },
    ]);
  });

  it('excludes a localGapSpans span that is fully contained inside a merged row (the D-07 chained/consumed gap at idx2-3)', () => {
    // Directly confirmed by the previous test's exact-equality assertion (only 2 rows, the
    // contained [12,24] gap does not appear as a third row) — this test names that property
    // explicitly so a future change to the containment rule fails here first.
    const result = recountPauseIntervals(FIXTURE_T, FIXTURE_D, FIXTURE_PARAMS);
    expect(result.rows.some((r) => r.startSec === 12 && r.endSec === 24)).toBe(false);
  });

  it('a stream with only a lone, burst-free gap yields exactly one recording-gap row and zero merged-segment rows', () => {
    const t = [0, 4, 26, 30];
    const d = [0, 1, 2, 3];
    const result = recountPauseIntervals(t, d, FIXTURE_PARAMS);
    expect(result.ok).toBe(true);
    expect(result.rows).toEqual([{ source: 'recording-gap', startSec: 4, endSec: 26, seconds: 22, metres: 1 }]);
  });

  it('propagates a checkStream failure without throwing', () => {
    const result = recountPauseIntervals([0, 1], [0, 1, 2], FIXTURE_PARAMS);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('different lengths');
  });

  it('propagates a recountGapFirst parameter failure without throwing', () => {
    const result = recountPauseIntervals([0, 1, 2], [0, 1, 2], { excessFloorMetres: 10 });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('speedLimitMps');
  });
});

describe('recount: localClassify — D-02\'s ladder, written independently (ascending, residual transported)', () => {
  const BANDS = { stationary: 0.5, walkRun: 2.2, limit: 7.35 };

  it('classifies exactly at the stationary boundary as stationary (inclusive)', () => {
    expect(localClassify(5, 10, BANDS)).toBe('stationary'); // 0.5 m/s
  });

  it('classifies just above the stationary boundary, at the walkRun boundary, as walked (inclusive)', () => {
    expect(localClassify(0.51 * 10, 10, BANDS)).toBe('walked'); // 0.51 m/s
    expect(localClassify(2.2 * 10, 10, BANDS)).toBe('walked'); // exactly at walkRun boundary
  });

  it('classifies just above walkRun, up to and including limit, as ran-through', () => {
    expect(localClassify(2.21 * 10, 10, BANDS)).toBe('ran-through');
    expect(localClassify(7.35 * 10, 10, BANDS)).toBe('ran-through'); // exactly at limit
  });

  it('classifies strictly above limit as transported', () => {
    expect(localClassify(7.36 * 10, 10, BANDS)).toBe('transported');
  });

  it('returns null for seconds <= 0 or a non-finite input, never a coerced class', () => {
    expect(localClassify(10, 0, BANDS)).toBeNull();
    expect(localClassify(10, -1, BANDS)).toBeNull();
    expect(localClassify(NaN, 10, BANDS)).toBeNull();
    expect(localClassify(10, NaN, BANDS)).toBeNull();
  });
});

describe('evaluate: evaluatePauseRecount — watched failing on a deliberately broken class table (D-18)', () => {
  const correctRow = {
    source: 'merged-segment',
    startSec: 10,
    endSec: 26,
    seconds: 16,
    metres: 62,
    speedMps: 3.875,
    class: 'ran-through',
  };

  it('FAILS on exactly one problem naming the row number when one class is swapped in the table — the seeded-wrong-table RED demonstration', () => {
    const brokenRow = { ...correctRow, class: 'walked' }; // swapped
    const verdict = evaluatePauseRecount([correctRow], [brokenRow]);
    expect(verdict.ok).toBe(false);
    expect(verdict.problems).toHaveLength(1);
    expect(verdict.problems[0]).toContain('row 1');
    expect(verdict.problems[0]).toContain('class');
  });

  it('PASSES once the table matches the recount exactly (same shape, unbroken)', () => {
    const verdict = evaluatePauseRecount([correctRow], [{ ...correctRow }]);
    expect(verdict.ok).toBe(true);
    expect(verdict.problems).toEqual([]);
    expect(verdict.comparedRows).toBe(1);
  });

  it('treats metres equality as rounded-to-1dp, exact for startSec/endSec/seconds', () => {
    const almostRow = { ...correctRow, metres: 62.04 };
    const verdict = evaluatePauseRecount([correctRow], [almostRow]);
    expect(verdict.ok).toBe(true); // both round to 62.0
  });

  it('fails naming the field when a metres value disagrees after rounding', () => {
    const wrongRow = { ...correctRow, metres: 70 };
    const verdict = evaluatePauseRecount([correctRow], [wrongRow]);
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.some((p) => p.includes('metres'))).toBe(true);
  });

  it('is vacuous-safe: an EMPTY table fails with a named "vacuous" problem rather than a false pass', () => {
    const verdict = evaluatePauseRecount([correctRow], []);
    expect(verdict.ok).toBe(false);
    expect(verdict.problems).toEqual(['vacuous: class table has no rows']);
    expect(verdict.comparedRows).toBe(0);
  });

  it('fails naming a row-count mismatch against the in-scope table rows', () => {
    const verdict = evaluatePauseRecount([correctRow], [correctRow, { ...correctRow, startSec: 99, endSec: 120 }]);
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.some((p) => p.includes('row-count mismatch'))).toBe(true);
  });

  it('counts zero-advance-pause table rows into outOfScopeRows and never compares them', () => {
    const pauseRow = { source: 'zero-advance-pause', startSec: 500, endSec: 540, seconds: 40, metres: 0, speedMps: 0, class: 'stationary' };
    const verdict = evaluatePauseRecount([correctRow], [correctRow, pauseRow]);
    expect(verdict.ok).toBe(true); // the pause row is out of scope, not a mismatch
    expect(verdict.outOfScopeRows).toBe(1);
    expect(verdict.comparedRows).toBe(1);
  });

  it('this recount is not vacuously agreeing: a table with EVERY row given the wrong class (uniform swap, mirroring the archive\'s own all-ran-through table) still fails on every row', () => {
    const uniformTable = [
      { ...correctRow, startSec: 10, endSec: 26 },
      { ...correctRow, startSec: 30, endSec: 40, class: 'ran-through' },
    ];
    const brokenUniformTable = uniformTable.map((r) => ({ ...r, class: 'walked' }));
    const matchingRecount = uniformTable; // recount "agrees" with the correct classes
    const verdict = evaluatePauseRecount(matchingRecount, brokenUniformTable);
    expect(verdict.ok).toBe(false);
    expect(verdict.problems).toHaveLength(2); // both rows disagree — proves the check does not just check row count
  });

  it('never throws for a non-array recountRows', () => {
    expect(() => evaluatePauseRecount(null, [correctRow])).not.toThrow();
    expect(evaluatePauseRecount(null, [correctRow]).ok).toBe(false);
  });
});

describe('contract: parseChosenConstants / parseClassTable — fail closed on 34-CALIBRATION.md\'s own shapes', () => {
  function validChosenConstants() {
    return [
      '## Chosen constants',
      '',
      'STATIONARY_MAX_SPEED_MPS = 0.5',
      'STATIONARY_MAX_SPEED_MPS provenance: developer-declared (D-20), not calibrated',
      'FORGOTTEN_STOP_MIN_SEC = 40',
      'FORGOTTEN_STOP_MIN_SEC provenance: calibrated (M family, M1)',
      'WALK_RUN_BOUNDARY_MPS = 2.2',
      'WALK_RUN_BOUNDARY_MPS provenance: developer-declared (D-21), not calibrated',
      'UNRELIABLE_SPEED_LIMIT_MPS = 7.35 (imported, 32-CALIBRATION.md)',
      '',
      '## Gates',
      '',
    ].join('\n');
  }

  function validClassTable() {
    return [
      `## Per-interval class table — 3475724402 (classifier output)`,
      '',
      '| # | source | startSec | endSec | seconds | metres | speedMps | class |',
      '|---|---|---|---|---|---|---|---|',
      '| 1 | merged-segment | 10 | 26 | 16 | 62.0 | 3.875 | ran-through |',
      '',
    ].join('\n');
  }

  it('parseChosenConstants parses the three line-anchored numbers', () => {
    const result = parseChosenConstants(validChosenConstants());
    expect(result).toEqual({ stationary: 0.5, walkRun: 2.2, limit: 7.35 });
  });

  it('parseChosenConstants throws "artifact missing ## Chosen constants" when the heading is absent', () => {
    const broken = validChosenConstants().replace('## Chosen constants', '## Not The Right Heading');
    expect(() => parseChosenConstants(broken)).toThrow(/artifact missing ## Chosen constants/);
  });

  it('parseChosenConstants throws "constant <NAME> missing" when a line is absent', () => {
    const broken = validChosenConstants().replace('WALK_RUN_BOUNDARY_MPS = 2.2\n', '');
    expect(() => parseChosenConstants(broken)).toThrow(/constant WALK_RUN_BOUNDARY_MPS missing/);
  });

  it('parseChosenConstants throws on non-string input', () => {
    expect(() => parseChosenConstants(null)).toThrow();
    expect(() => parseChosenConstants(undefined)).toThrow();
  });

  it('parseClassTable parses a minimal contract-conforming table', () => {
    const rows = parseClassTable(validClassTable());
    expect(rows).toEqual([
      { source: 'merged-segment', startSec: 10, endSec: 26, seconds: 16, metres: 62, speedMps: 3.875, class: 'ran-through' },
    ]);
  });

  it('parseClassTable throws on a missing heading', () => {
    const broken = validClassTable().replace(
      '## Per-interval class table — 3475724402 (classifier output)',
      '## Wrong Heading'
    );
    expect(() => parseClassTable(broken)).toThrow(/missing.*heading/);
  });

  it('parseClassTable throws when the header differs from the contract by even one character', () => {
    const broken = validClassTable().replace(
      '| # | source | startSec | endSec | seconds | metres | speedMps | class |',
      '| # | source | startSec | endSec | seconds | metres | speedMps | classX |'
    );
    expect(() => parseClassTable(broken)).toThrow(/does not match the contract/);
  });

  it('parseClassTable throws on a row with the wrong cell count', () => {
    const broken = validClassTable().replace(
      '| 1 | merged-segment | 10 | 26 | 16 | 62.0 | 3.875 | ran-through |',
      '| 1 | merged-segment | 10 |'
    );
    expect(() => parseClassTable(broken)).toThrow(/cell\(s\)/);
  });

  it('parseClassTable throws on a non-numeric numeric cell', () => {
    const broken = validClassTable().replace(
      '| 1 | merged-segment | 10 | 26 | 16 | 62.0 | 3.875 | ran-through |',
      '| 1 | merged-segment | oops | 26 | 16 | 62.0 | 3.875 | ran-through |'
    );
    expect(() => parseClassTable(broken)).toThrow(/startSec/);
  });

  it('parseClassTable throws on non-string input', () => {
    expect(() => parseClassTable(null)).toThrow();
  });
});

describe('formatRecountTable', () => {
  it('renders the contract header, separator, one row, and the final tally line', () => {
    const rows = [
      { source: 'merged-segment', startSec: 10, endSec: 26, seconds: 16, metres: 62, speedMps: 3.875, class: 'ran-through' },
    ];
    const table = formatRecountTable(rows, 3);
    const lines = table.split('\n');
    expect(lines[0]).toBe('| # | source | startSec | endSec | seconds | metres | speedMps | class |');
    expect(lines[2]).toContain('merged-segment');
    expect(lines[2]).toContain('62.0');
    expect(lines[2]).toContain('3.875');
    expect(lines[2]).toContain('ran-through');
    expect(lines[lines.length - 1]).toBe(
      'walked=0 ran-through=1 stationary=0 transported=0 outOfScope(zero-advance-pause)=3'
    );
  });

  it('renders a zero tally line for an empty row set', () => {
    const table = formatRecountTable([], 0);
    expect(table.split('\n').pop()).toBe(
      'walked=0 ran-through=0 stationary=0 transported=0 outOfScope(zero-advance-pause)=0'
    );
  });
});
