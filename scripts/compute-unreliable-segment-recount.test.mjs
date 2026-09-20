/**
 * Guard test for the pure helpers exported by compute-unreliable-segment-recount.mjs (Phase 32
 * plan 03, D-15). Importing this module must not read `data/streams/3475724402.json` or
 * `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` as an
 * import-time side effect — the self-execution guard documented at the bottom of
 * compute-unreliable-segment-recount.mjs is what prevents that.
 *
 * Every function case drives its target on a hand-built fixture; none reads the real archive or
 * the (not-yet-existing) calibration artifact. The zero-import guard is the one part of this file
 * that reads the real SOURCE (not data) of compute-unreliable-segment-recount.mjs, because that
 * is the only way to prove the discipline D-15 requires actually holds — mirroring
 * compute-pr-ceiling-recount.test.mjs's own zero-import guard exactly.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import {
  checkStream,
  evaluateRecount,
  formatTable,
  localGapSpans,
  parseCalibrationArtifact,
  recountGapFirst,
  RECOUNT_ACTIVITY_ID,
} from './compute-unreliable-segment-recount.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('./compute-unreliable-segment-recount.mjs', import.meta.url));
const FORBIDDEN_MODULE_NAMES = ['unreliable-segments'];

/**
 * Strips comments BEFORE searching for forbidden module names — the comment-stripping order is
 * load-bearing, since this script's own header docblock legitimately NAMES the forbidden module
 * while explaining why it is forbidden. Block comments first, then `//`-to-end-of-line, mirroring
 * compute-pr-ceiling-recount.test.mjs's own stripComments helper exactly.
 */
function stripComments(source) {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

describe('zero-import guard (D-15)', () => {
  it('the stripper actually removes a line naming a forbidden module — proving it works rather than assuming it', () => {
    const fixture = [
      'const ok = 1;',
      '// imports dist/analytics/unreliable-segments.js, forbidden',
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

  it('compute-unreliable-segment-recount.mjs contains none of the forbidden module names once comments are stripped, and never imports from ../dist/', () => {
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

    expect(stripped).not.toContain("from '../dist/");
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

  it('merges consecutive over-threshold pairs into one maximal span', () => {
    const spans = localGapSpans([0, 20, 40, 60], [0, 1, 2, 3]);
    expect(spans).toEqual([{ startIndex: 0, endIndex: 3, startSec: 0, endSec: 60 }]);
  });

  it('finds two separate spans with a covered pair between them', () => {
    const spans = localGapSpans([0, 20, 22, 40], [0, 1, 2, 3]);
    expect(spans).toEqual([
      { startIndex: 0, endIndex: 1, startSec: 0, endSec: 20 },
      { startIndex: 2, endIndex: 3, startSec: 22, endSec: 40 },
    ]);
  });
});

const PARAMS = { speedLimitMps: 5, excessFloorMetres: 10 };

describe('recountGapFirst — gap-first walk, both sides (D-07)', () => {
  it('yields one row with bursts 2 when a gap has a kept burst on BOTH sides', () => {
    // idx0-1: clean (3 m/s). idx1-2: burst (15 m/s, excess 20). idx2-3: gap (12s).
    // idx3-4: burst (15 m/s, excess 20). idx4-5: clean (0.3 m/s).
    const t = [0, 10, 12, 24, 26, 36];
    const d = [0, 30, 60, 62, 92, 95];

    const result = recountGapFirst(t, d, PARAMS);
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.startIndex).toBe(1);
    expect(row.endIndex).toBe(4);
    expect(row.gaps).toBe(1);
    expect(row.bursts).toBe(2);
    expect(row.gapSeconds).toBe(12);
    expect(row.gapMetres).toBe(2);
    expect(row.burstSeconds).toBe(4);
    expect(row.burstMetres).toBe(60);
    expect(row.seconds).toBe(16);
    expect(row.metres).toBe(62);
    expect(row.mechanism).toBe('gap-adjacent');
  });

  it('D-06 touching nuance: a non-advancing pair immediately before a gap start drops the pending step — NO leading burst is recorded even though a burst sits nearby', () => {
    // idx0-1: burst (15 m/s). idx1-2: zero-advance (dd=0), immediately before the gap.
    // idx2-3: gap (12s). Stream ends right at the gap's end (no trailing side either).
    const t = [0, 2, 4, 16];
    const d = [0, 30, 30, 32];

    const result = recountGapFirst(t, d, PARAMS);
    expect(result.ok).toBe(true);
    // Forward folding would leave the zero pair as a dropped pending step — no step ends on the
    // gap's start sample, so this gap gets no before-burst, and (with nothing after it either)
    // emits no row at all.
    expect(result.rows).toEqual([]);
  });

  it('D-06 touching nuance, forward side: a zero-advance pair immediately AFTER a gap end is folded into the following advancing pair, so the resulting burst still starts exactly on the gap end sample', () => {
    // idx0-1: gap (20s). idx1-2: zero-advance. idx2-3: advancing, together with idx1-2 forming a
    // fast step (40m/4s = 10 m/s > 5 m/s limit). idx3-4: clean, ends the run.
    const t = [0, 20, 22, 24, 34];
    const d = [0, 0, 0, 40, 41];

    const result = recountGapFirst(t, d, PARAMS);
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.startIndex).toBe(0);
    expect(row.endIndex).toBe(3);
    expect(row.bursts).toBe(1);
    expect(row.burstMetres).toBe(40);
    expect(row.burstSeconds).toBe(4);
  });

  it('D-07: a burst spanning the FULL segment between two gaps chains them into one segment, deduping the shared connector burst', () => {
    // gapA at [0,1]. Segment [1,3] is ONE continuous burst spanning its whole width, touching
    // gapA's end (index 1) AND gapB's start (index 3). gapB at [3,4]. Nothing after gapB.
    const t = [0, 20, 22, 24, 36, 38];
    const d = [0, 0, 30, 60, 61, 61];

    const result = recountGapFirst(t, d, PARAMS);
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.startIndex).toBe(0);
    expect(row.endIndex).toBe(4);
    expect(row.gaps).toBe(2);
    expect(row.bursts).toBe(1); // the connector burst counted once, not twice
    expect(row.gapSeconds).toBe(32); // 20 + 12
    expect(row.gapMetres).toBe(1); // 0 + 1
    expect(row.burstSeconds).toBe(4);
    expect(row.burstMetres).toBe(60);
    expect(row.seconds).toBe(36);
    expect(row.metres).toBe(61);
  });

  it('D-07: clean samples are never swallowed — a non-fast step between two bursts near adjacent gaps keeps them as TWO separate segments', () => {
    // gapA at [0,1]. Then a burst [1,2] (trailing gapA), a CLEAN step [2,3] (dt=10, not a gap,
    // not fast), then a burst [3,4] (leading into gapB). gapB at [4,5]. Nothing after gapB.
    const t = [0, 20, 22, 32, 34, 46, 48];
    const d = [0, 0, 30, 31, 61, 62, 62];

    const result = recountGapFirst(t, d, PARAMS);
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(2);

    const [row1, row2] = result.rows;
    expect(row1.startIndex).toBe(0);
    expect(row1.endIndex).toBe(2);
    expect(row1.gaps).toBe(1);
    expect(row1.bursts).toBe(1);

    expect(row2.startIndex).toBe(3);
    expect(row2.endIndex).toBe(5);
    expect(row2.gaps).toBe(1);
    expect(row2.bursts).toBe(1);
  });

  it('a gap with a fast run that never clears the excess floor emits no row on that side', () => {
    // idx0-1: fast (11 m/s, >5 m/s limit) but tiny — excess = 11 - 5*1 = 6, below the 10 floor,
    // so this run is fast but NOT a kept burst. idx1-2: gap (13s). Nothing after the gap.
    const t = [0, 1, 14];
    const d = [0, 11, 12];
    const result = recountGapFirst(t, d, PARAMS);
    expect(result.ok).toBe(true);
    expect(result.rows).toEqual([]);
  });
});

describe('recountGapFirst — fails closed', () => {
  it('propagates checkStream failure without throwing', () => {
    const result = recountGapFirst([0, 1], [0, 1, 2], PARAMS);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('different lengths');
  });

  it('fails closed on a missing speedLimitMps', () => {
    const result = recountGapFirst([0, 1, 2], [0, 1, 2], { excessFloorMetres: 10 });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('speedLimitMps');
  });

  it('fails closed on a non-finite speedLimitMps', () => {
    const result = recountGapFirst([0, 1, 2], [0, 1, 2], { speedLimitMps: NaN, excessFloorMetres: 10 });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('speedLimitMps');
  });

  it('fails closed on a zero or negative speedLimitMps', () => {
    expect(recountGapFirst([0, 1, 2], [0, 1, 2], { speedLimitMps: 0, excessFloorMetres: 10 }).ok).toBe(false);
    expect(recountGapFirst([0, 1, 2], [0, 1, 2], { speedLimitMps: -1, excessFloorMetres: 10 }).ok).toBe(false);
  });

  it('fails closed on a missing or non-positive excessFloorMetres', () => {
    expect(recountGapFirst([0, 1, 2], [0, 1, 2], { speedLimitMps: 5 }).ok).toBe(false);
    expect(recountGapFirst([0, 1, 2], [0, 1, 2], { speedLimitMps: 5, excessFloorMetres: -5 }).ok).toBe(false);
    expect(recountGapFirst([0, 1, 2], [0, 1, 2], { speedLimitMps: 5, excessFloorMetres: NaN }).ok).toBe(false);
  });

  it('never throws on undefined params', () => {
    expect(() => recountGapFirst([0, 1, 2], [0, 1, 2], undefined)).not.toThrow();
    expect(recountGapFirst([0, 1, 2], [0, 1, 2], undefined).ok).toBe(false);
  });
});

describe('evaluateRecount — watched failing on a deliberately broken detector table (D-15)', () => {
  const correctRow = {
    startIndex: 1,
    endIndex: 4,
    startSec: 10,
    endSec: 26,
    seconds: 16,
    metres: 62,
    gapSeconds: 12,
    gapMetres: 2,
    burstSeconds: 4,
    burstMetres: 60,
    gaps: 1,
    bursts: 2,
    mechanism: 'gap-adjacent',
  };

  it('FAILS on the Pitfall 4 shape: a broken detector table with the leading burst stripped from the segment, naming startIndex and bursts', () => {
    const brokenRow = {
      ...correctRow,
      startIndex: 2, // moved to the gap's own start (leading burst stripped)
      seconds: 14,
      metres: 32,
      burstSeconds: 2,
      burstMetres: 30, // only the trailing burst's metres remain
      bursts: 1, // leading burst dropped
    };

    const verdict = evaluateRecount([correctRow], [brokenRow]);
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('startIndex'))).toBe(true);
    expect(verdict.problems.some((p) => p.includes('bursts'))).toBe(true);
  });

  it('PASSES once the detector table matches the recount exactly (same shape, unbroken)', () => {
    const verdict = evaluateRecount([correctRow], [{ ...correctRow }]);
    expect(verdict.pass).toBe(true);
    expect(verdict.problems).toEqual([]);
  });

  it('treats field equality as exact for integer fields and rounded-to-1dp for metres/seconds fields', () => {
    const almostRow = { ...correctRow, metres: 62.04, gapMetres: 1.96 };
    const verdict = evaluateRecount([correctRow], [almostRow]);
    expect(verdict.pass).toBe(true); // both round to 62.0 / 2.0
  });

  it('fails naming the problem when a metres/seconds field disagrees after rounding', () => {
    const wrongRow = { ...correctRow, metres: 70 };
    const verdict = evaluateRecount([correctRow], [wrongRow]);
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('metres'))).toBe(true);
  });

  it('is vacuous-safe: an empty detector table fails with a named "vacuous" problem rather than a false pass', () => {
    const verdict = evaluateRecount([correctRow], []);
    expect(verdict.pass).toBe(false);
    expect(verdict.problems).toEqual(['vacuous: detector table has no rows']);
  });

  it('fails naming a row-count mismatch', () => {
    const verdict = evaluateRecount([correctRow], [correctRow, { ...correctRow, startIndex: 99 }]);
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('row-count mismatch'))).toBe(true);
  });

  it('fails naming a non-gap-adjacent mechanism on 3475724402', () => {
    const isolatedRow = { ...correctRow, mechanism: 'isolated-jump' };
    const verdict = evaluateRecount([correctRow], [isolatedRow]);
    expect(verdict.pass).toBe(false);
    expect(verdict.problems.some((p) => p.includes('isolated-jump') && p.includes(RECOUNT_ACTIVITY_ID))).toBe(
      true
    );
  });

  it('never throws for a non-array recountRows', () => {
    expect(() => evaluateRecount(null, [correctRow])).not.toThrow();
    expect(evaluateRecount(null, [correctRow]).pass).toBe(false);
  });
});

describe('formatTable', () => {
  it('renders the contract header, separator, and one row with metres via toFixed(1)', () => {
    const rows = [
      {
        startIndex: 1,
        endIndex: 4,
        startSec: 10,
        endSec: 26,
        seconds: 16,
        metres: 62,
        gapSeconds: 12,
        gapMetres: 2,
        burstSeconds: 4,
        burstMetres: 60,
        gaps: 1,
        bursts: 2,
        mechanism: 'gap-adjacent',
      },
    ];
    const table = formatTable(rows);
    const lines = table.split('\n');
    expect(lines[0]).toBe(
      '| # | startIndex | endIndex | startSec | endSec | seconds | metres | gapSeconds | gapMetres | burstSeconds | burstMetres | gaps | bursts | mechanism |'
    );
    expect(lines[2]).toContain('62.0');
    expect(lines[2]).toContain('60.0');
    expect(lines[2]).toContain('gap-adjacent');
  });

  it('renders an empty table (header + separator only) for zero rows', () => {
    const table = formatTable([]);
    expect(table.split('\n')).toHaveLength(2);
  });
});

describe('parseCalibrationArtifact — fails closed', () => {
  function validMarkdown() {
    return [
      '## Chosen constants',
      '',
      '| Constant | Value |',
      '|---|---|',
      '| `UNRELIABLE_SPEED_LIMIT_MPS` | 8.5 |',
      '| `UNRELIABLE_EXCESS_FLOOR_M` | 12 |',
      '| `HIDDEN_PAUSE_MIN_METRES` | 100 |',
      '',
      `## Per-segment table — ${RECOUNT_ACTIVITY_ID} (detector output)`,
      '',
      '| # | startIndex | endIndex | startSec | endSec | seconds | metres | gapSeconds | gapMetres | burstSeconds | burstMetres | gaps | bursts | mechanism |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
      '| 1 | 1 | 4 | 10 | 26 | 16 | 62.0 | 12 | 2.0 | 4 | 60.0 | 1 | 2 | gap-adjacent |',
    ].join('\n');
  }

  it('parses a minimal contract-conforming markdown string', () => {
    const result = parseCalibrationArtifact(validMarkdown());
    expect(result.ok).toBe(true);
    expect(result.constants).toEqual({ speedLimitMps: 8.5, excessFloorMetres: 12 });
    expect(result.detectorRows).toHaveLength(1);
    expect(result.detectorRows[0]).toMatchObject({
      startIndex: 1,
      endIndex: 4,
      bursts: 2,
      mechanism: 'gap-adjacent',
    });
  });

  it('fails closed on non-string input', () => {
    expect(parseCalibrationArtifact(null).ok).toBe(false);
    expect(parseCalibrationArtifact(undefined).ok).toBe(false);
  });

  it('fails closed on a missing "## Chosen constants" heading', () => {
    const broken = validMarkdown().replace('## Chosen constants', '## Not The Right Heading');
    const result = parseCalibrationArtifact(broken);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Chosen constants');
  });

  it('fails closed on a missing UNRELIABLE_SPEED_LIMIT_MPS row', () => {
    const broken = validMarkdown().replace('| `UNRELIABLE_SPEED_LIMIT_MPS` | 8.5 |\n', '');
    const result = parseCalibrationArtifact(broken);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('UNRELIABLE_SPEED_LIMIT_MPS');
  });

  it('fails closed on a non-numeric UNRELIABLE_SPEED_LIMIT_MPS value', () => {
    const broken = validMarkdown().replace(
      '| `UNRELIABLE_SPEED_LIMIT_MPS` | 8.5 |',
      '| `UNRELIABLE_SPEED_LIMIT_MPS` | not-a-number |'
    );
    const result = parseCalibrationArtifact(broken);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('UNRELIABLE_SPEED_LIMIT_MPS');
  });

  it('fails closed on a missing UNRELIABLE_EXCESS_FLOOR_M row', () => {
    const broken = validMarkdown().replace('| `UNRELIABLE_EXCESS_FLOOR_M` | 12 |\n', '');
    const result = parseCalibrationArtifact(broken);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('UNRELIABLE_EXCESS_FLOOR_M');
  });

  it('fails closed on a non-numeric UNRELIABLE_EXCESS_FLOOR_M value', () => {
    const broken = validMarkdown().replace(
      '| `UNRELIABLE_EXCESS_FLOOR_M` | 12 |',
      '| `UNRELIABLE_EXCESS_FLOOR_M` | |'
    );
    const result = parseCalibrationArtifact(broken);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('UNRELIABLE_EXCESS_FLOOR_M');
  });

  it('fails closed on a missing per-segment table heading', () => {
    const broken = validMarkdown().replace(
      `## Per-segment table — ${RECOUNT_ACTIVITY_ID} (detector output)`,
      '## Wrong Heading'
    );
    const result = parseCalibrationArtifact(broken);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Per-segment table');
  });

  it('fails closed on a header row that differs from the contract', () => {
    const broken = validMarkdown().replace(
      '| # | startIndex | endIndex | startSec | endSec | seconds | metres | gapSeconds | gapMetres | burstSeconds | burstMetres | gaps | bursts | mechanism |',
      '| # | startIndex | endIndex | seconds | metres |'
    );
    const result = parseCalibrationArtifact(broken);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('does not match the contract');
  });

  it('fails closed on a row with the wrong cell count', () => {
    const broken = validMarkdown().replace(
      '| 1 | 1 | 4 | 10 | 26 | 16 | 62.0 | 12 | 2.0 | 4 | 60.0 | 1 | 2 | gap-adjacent |',
      '| 1 | 1 | 4 | 10 |'
    );
    const result = parseCalibrationArtifact(broken);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('cell(s)');
  });

  it('fails closed on a row with a non-numeric numeric cell', () => {
    const broken = validMarkdown().replace(
      '| 1 | 1 | 4 | 10 | 26 | 16 | 62.0 | 12 | 2.0 | 4 | 60.0 | 1 | 2 | gap-adjacent |',
      '| 1 | oops | 4 | 10 | 26 | 16 | 62.0 | 12 | 2.0 | 4 | 60.0 | 1 | 2 | gap-adjacent |'
    );
    const result = parseCalibrationArtifact(broken);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('startIndex');
  });
});

// The import-time side-effect guard formerly here moved to
// scripts/unreliable-segment-import-guards.test.mjs (Phase 32 plan 12, closing
// 32-VERIFICATION.md gap #2). The old mechanism — a spy-based property replacement of
// `readFileSync` on the default `fs` namespace object — was structurally vacuous: this module
// consumes `fs` via `import { readFileSync } from 'fs' }` (a named import), and Node resolves a
// builtin's named exports once, at namespace creation, so a property replacement made on the
// namespace afterwards is never dereferenced by a call already bound to the original named
// export. The spy recorded zero calls regardless of what this module actually did at import
// time. The replacement is a `vi.mock` of the `fs` module with two positive controls proving the
// mechanism can observe a read through both the named-import and default-import idioms before it
// is trusted to certify this module's absence of import-time I/O.
//
// Do NOT re-add a namespace-object spy on `fs` here — it cannot fail and proves nothing.
