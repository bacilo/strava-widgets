/**
 * Guard test for `compute-coverage-identity-recount.mjs` (Phase 33 plan 07, D-03).
 *
 * Two structural guards plus pure-function cases on small synthetic fixtures — never reads
 * `data/streams/` or `.planning/milestones/v2.3-phases/32-.../32-CALIBRATION.md` as an import-time side effect
 * (the self-execution guard at the bottom of the script under test is what prevents that), and
 * never scans the whole archive — this file runs every `npm test`.
 *
 * ZERO-IMPORT GUARD: `compute-coverage-identity-recount.mjs` must contain none of
 * `FORBIDDEN_MODULE_NAMES` (just `'unreliable-segments'`, the detector's own module name) once
 * comments are stripped, in any spelling — mirrors
 * `compute-unreliable-segment-recount.test.mjs`'s own guard exactly (Phase 32's PATTERNS.md-
 * confirmed sound shape).
 *
 * SCOPED-IMPORT GUARD: unlike the zero-import guard, `classifyGaps` (the shipped, WIRED
 * classifier that internally calls the detector) IS imported by the script under test — but its
 * use must be confined to the single import line and `readShippedCoverage`'s own body. Counting
 * is done on the WHOLE WORD `classifyGaps` via a `\bclassifyGaps\b` regex, deliberately NOT a
 * plain substring search — `classifyGapsThreeWay` (the pre-detector function, imported and used
 * freely elsewhere in the script) contains `classifyGaps` as a literal substring, and a
 * boundary-blind count would treat every `classifyGapsThreeWay` call as an extra, illegitimate
 * `classifyGaps` occurrence, making the guard fail on correct code. `\b` after `...Gaps` does NOT
 * match before a following word character (`T` of `ThreeWay`), so `\bclassifyGaps\b` correctly
 * excludes `classifyGapsThreeWay` while still matching `classifyGaps(` (boundary before `(`) and
 * the bare identifier on the import line.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import {
  checkStream,
  computeArchiveWideFindings,
  evaluateArchive,
  localGapSpans,
  parseChosenConstants,
  readShippedCoverage,
  recountActivity,
} from './compute-coverage-identity-recount.mjs';

const SCRIPT_PATH = fileURLToPath(
  new URL('./compute-coverage-identity-recount.mjs', import.meta.url)
);
const FORBIDDEN_MODULE_NAMES = ['unreliable-segments'];

/**
 * Strips comments BEFORE searching for forbidden module names / scoped identifiers — the
 * comment-stripping order is load-bearing, since this script's own header docblock legitimately
 * NAMES the forbidden module while explaining why it is forbidden. Block comments first, then
 * `//`-to-end-of-line, mirroring `compute-unreliable-segment-recount.test.mjs`'s own
 * `stripComments` helper exactly.
 */
function stripComments(source) {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

/** Counts whole-word occurrences of `word` in `source` via a `\b`-delimited regex. */
function countWholeWord(source, word) {
  const re = new RegExp(`\\b${word}\\b`, 'g');
  const matches = source.match(re);
  return matches ? matches.length : 0;
}

describe('zero-import guard (D-03)', () => {
  it('the stripper actually removes a line naming a forbidden module — proving it works rather than assuming it', () => {
    const fixture = [
      'const ok = 1;',
      '// imports src/analytics/unreliable-segments.ts, forbidden',
      '/* also forbidden: unreliable-segments */',
      'const alsoOk = 2;',
    ].join('\n');

    const stripped = stripComments(fixture);

    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(fixture).toContain(forbidden); // sanity: the raw fixture DOES name the module
      expect(stripped).not.toContain(forbidden); // the stripper removed it
    }
    expect(stripped).toContain('const ok = 1;');
    expect(stripped).toContain('const alsoOk = 2;');
  });

  it('compute-coverage-identity-recount.mjs contains none of the forbidden module names once comments are stripped, and never imports the Phase 32 single-activity recount', () => {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    const stripped = stripComments(raw);

    // Sanity check first: the RAW source legitimately names the module (in its header docblock,
    // explaining why it is forbidden) — if this failed, the test above would be vacuous.
    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(raw).toContain(forbidden);
    }

    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(stripped).not.toContain(forbidden);
    }

    expect(stripped).not.toContain('compute-unreliable-segment-recount');
  });
});

describe('scoped-import guard (D-03) — classifyGaps confined to the import line and readShippedCoverage', () => {
  function readStrippedSource() {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    return stripComments(raw);
  }

  function readShippedCoverageSlice(stripped) {
    const funcStart = stripped.indexOf('function readShippedCoverage');
    if (funcStart === -1) return '';
    const marker = 'function readShippedCoverage';
    const after = stripped.slice(funcStart + marker.length);
    const nextTopLevelOffset = after.search(/\n(function |export function )/);
    const end = nextTopLevelOffset === -1 ? stripped.length : funcStart + marker.length + nextTopLevelOffset;
    return stripped.slice(funcStart, end);
  }

  it('slicer sanity: the readShippedCoverage function slice is non-empty and contains its own classifyGaps call', () => {
    const stripped = readStrippedSource();
    const slice = readShippedCoverageSlice(stripped);
    expect(slice.length).toBeGreaterThan(0);
    expect(slice).toContain('function readShippedCoverage');
    expect(countWholeWord(slice, 'classifyGaps')).toBe(1);
  });

  it('word-boundary sanity: classifyGapsThreeWay is never counted as a classifyGaps occurrence', () => {
    const fixture = 'const x = classifyGapsThreeWay(t, d); const y = classifyGaps(t, d);';
    expect(countWholeWord(fixture, 'classifyGaps')).toBe(1);
  });

  it('every whole-word classifyGaps occurrence in the stripped source is either the import line or inside readShippedCoverage', () => {
    const stripped = readStrippedSource();
    const slice = readShippedCoverageSlice(stripped);

    const totalCount = countWholeWord(stripped, 'classifyGaps');
    const sliceCount = countWholeWord(slice, 'classifyGaps');

    // +1 for the single import line — never more, never zero (the import must exist).
    expect(totalCount).toBe(sliceCount + 1);

    const importLineMatch = stripped.match(/^import \{[^}]*\bclassifyGaps\b[^}]*\} from '\.\.\/dist\/analytics\/pace-derivation\.js';$/m);
    expect(importLineMatch).not.toBeNull();
  });
});

describe('parseChosenConstants — fails closed', () => {
  function validMarkdown() {
    return [
      '## Chosen constants',
      '',
      '| Constant | Value | Statistic / rule | Live-derived value | Shipped value equal |',
      '|---|---|---|---|---|',
      '| `UNRELIABLE_SPEED_LIMIT_MPS` | 7.35 | ... | 7.35 m/s | yes |',
      '| `UNRELIABLE_EXCESS_FLOOR_M` | 3.0 | ... | 3.0 m | yes |',
      '| `HIDDEN_PAUSE_MIN_METRES` | 116.95 | ... | 116.95 m | yes |',
      '',
      '## Non-circularity (D-13)',
      '',
      'more text here that must not be scanned',
    ].join('\n');
  }

  it('parses a minimal contract-conforming markdown string', () => {
    const result = parseChosenConstants(validMarkdown());
    expect(result.ok).toBe(true);
    expect(result.constants).toEqual({
      speedLimitMps: 7.35,
      excessFloorMetres: 3.0,
      hiddenPauseMinMetres: 116.95,
    });
  });

  it('fails closed on non-string input', () => {
    expect(parseChosenConstants(null).ok).toBe(false);
    expect(parseChosenConstants(undefined).ok).toBe(false);
  });

  it('fails closed on a missing "## Chosen constants" heading', () => {
    const broken = validMarkdown().replace('## Chosen constants', '## Not The Right Heading');
    const result = parseChosenConstants(broken);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Chosen constants');
  });

  it('fails closed on a missing UNRELIABLE_SPEED_LIMIT_MPS row', () => {
    const broken = validMarkdown().replace(
      '| `UNRELIABLE_SPEED_LIMIT_MPS` | 7.35 | ... | 7.35 m/s | yes |\n',
      ''
    );
    const result = parseChosenConstants(broken);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('UNRELIABLE_SPEED_LIMIT_MPS');
  });

  it('fails closed on a non-numeric HIDDEN_PAUSE_MIN_METRES value', () => {
    const broken = validMarkdown().replace(
      '| `HIDDEN_PAUSE_MIN_METRES` | 116.95 | ... | 116.95 m | yes |',
      '| `HIDDEN_PAUSE_MIN_METRES` | not-a-number | ... | 116.95 m | yes |'
    );
    const result = parseChosenConstants(broken);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('HIDDEN_PAUSE_MIN_METRES');
  });
});

describe('checkStream', () => {
  it('accepts a well-formed, non-decreasing stream of length >= 2', () => {
    expect(checkStream([0, 1, 2], [0, 10, 20])).toEqual({ ok: true });
  });

  it('rejects non-array input', () => {
    expect(checkStream(null, [1, 2]).ok).toBe(false);
    expect(checkStream([1, 2], 'nope').ok).toBe(false);
  });

  it('rejects mismatched lengths', () => {
    const result = checkStream([0, 1, 2], [0, 1]);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('different lengths');
  });

  it('rejects a stream shorter than 2 samples', () => {
    const result = checkStream([0], [0]);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('at least 2 samples');
  });

  it('rejects a non-finite value in either array', () => {
    expect(checkStream([0, NaN, 2], [0, 1, 2]).ok).toBe(false);
    expect(checkStream([0, 1, 2], [0, Infinity, 2]).ok).toBe(false);
  });

  it('rejects a decreasing t or d array', () => {
    expect(checkStream([0, 5, 3], [0, 1, 2]).ok).toBe(false);
    expect(checkStream([0, 1, 2], [0, 5, 3]).ok).toBe(false);
  });
});

describe('localGapSpans', () => {
  it('finds no gaps in a densely-sampled stream', () => {
    expect(localGapSpans([0, 1, 2, 3], [0, 1, 2, 3])).toEqual([]);
  });

  it('finds one gap span for a single over-threshold pair', () => {
    const spans = localGapSpans([0, 2, 20, 22], [0, 10, 11, 21]);
    expect(spans).toEqual([{ startIndex: 1, endIndex: 2, startSec: 2, endSec: 20 }]);
  });

  it('does not treat a pair at exactly the 10s threshold as a gap (strict >)', () => {
    expect(localGapSpans([0, 10, 20], [0, 1, 2])).toEqual([]);
  });
});

const PARAMS = { speedLimitMps: 5, excessFloorMetres: 10, hiddenPauseMinMetres: 100 };

describe('recountActivity — fails closed', () => {
  it('propagates checkStream failure without throwing', () => {
    const result = recountActivity([0, 1], [0, 1, 2], PARAMS);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('different lengths');
  });

  it('fails closed on a missing speedLimitMps', () => {
    const result = recountActivity([0, 1, 2], [0, 1, 2], { excessFloorMetres: 10, hiddenPauseMinMetres: 100 });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('speedLimitMps');
  });

  it('fails closed on a missing excessFloorMetres', () => {
    const result = recountActivity([0, 1, 2], [0, 1, 2], { speedLimitMps: 5, hiddenPauseMinMetres: 100 });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('excessFloorMetres');
  });

  it('fails closed on a missing or negative hiddenPauseMinMetres', () => {
    expect(
      recountActivity([0, 1, 2], [0, 1, 2], { speedLimitMps: 5, excessFloorMetres: 10 }).ok
    ).toBe(false);
    expect(
      recountActivity([0, 1, 2], [0, 1, 2], {
        speedLimitMps: 5,
        excessFloorMetres: 10,
        hiddenPauseMinMetres: -5,
      }).ok
    ).toBe(false);
  });

  it('never throws on undefined params', () => {
    expect(() => recountActivity([0, 1, 2], [0, 1, 2], undefined)).not.toThrow();
    expect(recountActivity([0, 1, 2], [0, 1, 2], undefined).ok).toBe(false);
  });
});

describe('recountActivity — gap-adjacent mechanism (mirrors the Phase 32 analog)', () => {
  it('yields one gap-adjacent row when a gap has a kept burst on both sides', () => {
    // idx0-1: clean (3 m/s). idx1-2: burst (15 m/s, excess 20). idx2-3: gap (12s).
    // idx3-4: burst (15 m/s, excess 20). idx4-5: clean (0.3 m/s).
    const t = [0, 10, 12, 24, 26, 36];
    const d = [0, 30, 60, 62, 92, 95];

    const result = recountActivity(t, d, PARAMS);
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.startIndex).toBe(1);
    expect(row.endIndex).toBe(4);
    expect(row.mechanism).toBe('gap-adjacent');
    expect(row.seconds).toBe(16);
    expect(row.metres).toBe(62);
    expect(result.unreliableSec).toBe(16);
  });

  it('D-07: a burst spanning the full segment between two gaps chains them into one gap-adjacent row', () => {
    // gapA at [0,1]. Segment [1,3] is ONE continuous burst spanning its whole width, touching
    // gapA's end (index 1) AND gapB's start (index 3). gapB at [3,4]. Nothing after gapB.
    const t = [0, 20, 22, 24, 36, 38];
    const d = [0, 0, 30, 60, 61, 61];

    const result = recountActivity(t, d, PARAMS);
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].mechanism).toBe('gap-adjacent');
    expect(result.rows[0].startIndex).toBe(0);
    expect(result.rows[0].endIndex).toBe(4);
  });
});

describe('recountActivity — hidden-pause / isolated-jump: every OTHER kept run becomes a row (the new logic this plan adds)', () => {
  it('a non-boundary fast run of 150 m (>= hiddenPauseMinMetres) emits one hidden-pause row', () => {
    // Runs entirely inside one segment, touching no gap on either side: clean, then a burst of
    // 150m/10s (15 m/s, excess 100 > 10 floor, well above the 100m hidden-pause boundary), then
    // clean again. No recording gap anywhere in this stream.
    const t = [0, 5, 15, 25, 30];
    const d = [0, 5, 155, 156, 157];

    const result = recountActivity(t, d, PARAMS);
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.mechanism).toBe('hidden-pause');
    expect(row.metres).toBe(150);
    expect(row.startIndex).toBe(1);
    expect(row.endIndex).toBe(2);
  });

  it('a non-boundary fast run of 50 m (< hiddenPauseMinMetres) emits one isolated-jump row', () => {
    const t = [0, 5, 10, 20, 25];
    const d = [0, 5, 55, 56, 57];

    const result = recountActivity(t, d, PARAMS);
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.mechanism).toBe('isolated-jump');
    expect(row.metres).toBe(50);
  });

  it('a stream with a gap-adjacent segment AND a separate non-touching burst emits both mechanisms, unreliableSec summing both', () => {
    // idx0-1: burst touching stream start (not a gap boundary — isolated), 15 m/s, 60m/4s.
    // idx1-2: clean (breaks the run before the gap, so the isolated burst does NOT touch it).
    // idx2-3: gap (12s). idx3-4: burst touching the gap's end index -> gap-adjacent.
    // idx4-5: clean (ends the gap-adjacent burst's run exactly at index4).
    const t = [0, 4, 14, 26, 30, 40];
    const d = [0, 60, 61, 61, 121, 122];

    const result = recountActivity(t, d, PARAMS);
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(2);
    const mechanisms = result.rows.map((r) => r.mechanism).sort();
    expect(mechanisms).toEqual(['gap-adjacent', 'isolated-jump']);
    const sumSeconds = result.rows.reduce((s, r) => s + r.seconds, 0);
    expect(result.unreliableSec).toBe(sumSeconds);
    expect(result.unreliableSec).toBe(20);
  });

  it('a fast run that never clears the excess floor emits no row at all', () => {
    // 11 m/s over 1s: excess = 11 - 5*1 = 6, below the 10 floor.
    const t = [0, 1, 20];
    const d = [0, 11, 12];
    const result = recountActivity(t, d, PARAMS);
    expect(result.ok).toBe(true);
    expect(result.rows).toEqual([]);
    expect(result.unreliableSec).toBe(0);
  });
});

describe('recountActivity — never throws on a malformed stream, counted as skipped by evaluateArchive', () => {
  it('recountActivity itself returns ok:false with a reason, never throwing', () => {
    expect(() => recountActivity([0, NaN, 2], [0, 1, 2], PARAMS)).not.toThrow();
    const result = recountActivity([0, NaN, 2], [0, 1, 2], PARAMS);
    expect(result.ok).toBe(false);
    expect(typeof result.reason).toBe('string');
  });
});

describe('readShippedCoverage', () => {
  it('returns a zeroed PaceCoverage shape for an invalid stream, never throwing', () => {
    expect(() => readShippedCoverage([0], [0])).not.toThrow();
    const coverage = readShippedCoverage([0], [0]);
    expect(coverage.spanSec).toBe(0);
    expect(coverage.unreliableSec).toBe(0);
  });
});

describe('evaluateArchive', () => {
  it('is vacuous-safe: zero entries never reports pass:true', () => {
    const result = evaluateArchive([], PARAMS);
    expect(result.scannedCount).toBe(0);
    expect(result.pass).toBe(false);
  });

  it('counts a malformed stream as skipped, never crashing the scan, and can still pass on the remaining entries', () => {
    const entries = [
      { id: 'bad', t: [0], d: [0] }, // too short, fails checkStream
      { id: 'clean', t: [0, 100], d: [0, 200] }, // no gaps, no bursts, genuinely clean
    ];
    const result = evaluateArchive(entries, PARAMS);
    expect(result.scannedCount).toBe(2);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].id).toBe('bad');
    expect(result.identityViolations).toEqual([]);
    expect(result.recountMismatches).toEqual([]);
    expect(result.pass).toBe(true);
  });
});

describe('computeArchiveWideFindings', () => {
  it('never throws on a mixed valid/invalid entry list and reports a tier for every computable stream', () => {
    const entries = [
      { id: 'bad', t: [0], d: [0] },
      { id: 'clean', t: [0, 100], d: [0, 200] },
    ];
    expect(() => computeArchiveWideFindings(entries)).not.toThrow();
    const findings = computeArchiveWideFindings(entries);
    expect(findings.computedCount).toBe(1);
    expect(findings.skippedCount).toBe(1);
    expect(typeof findings.recordingGapMovedSec).toBe('number');
    expect(typeof findings.pauseMovedSec).toBe('number');
    expect(typeof findings.coveredMovedSec).toBe('number');
  });
});

// The import-time side-effect no-op guard is deliberately OMITTED here, per this phase's own
// instruction: a `vi.spyOn(fs, 'readFileSync')` / `vi.mock('fs')` guard's control probe must be
// independently demonstrated OBSERVED before it is trusted (33-PATTERNS.md, citing Phase 32 GAP
// 2 — `fs spy cannot observe named imports`, this repo's own recorded memory lesson) — no such
// demonstration was performed for this file, so no such guard is written. The self-execution
// guard at the bottom of compute-coverage-identity-recount.mjs (`import.meta.url ===
// pathToFileURL(...)`) is what actually prevents a real file read as an import-time side effect;
// every test above imports the module and none of them triggers a `data/streams/` or
// `32-CALIBRATION.md` read, which is the property that matters.
