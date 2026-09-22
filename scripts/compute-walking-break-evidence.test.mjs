/**
 * Tests for compute-walking-break-evidence.mjs (Phase 34 plan 02, D-12). Every function case drives
 * its target on a hand-built synthetic fixture; none reads the real archive. Research's own
 * 1.264/1.512/1.797 m/s or 407/402 s figures are never asserted as expected values here (Task 1
 * acceptance criteria) — those numbers appear only inside the implementation's own
 * `RESEARCH_REFERENCE` reconciliation table, never in a test assertion.
 *
 * The zero-import guard below is the one part of this file that reads the real SOURCE (not data)
 * of compute-walking-break-evidence.mjs, mirroring compute-unreliable-segment-recount.test.mjs's
 * own guard exactly — string-scan after stripping comments, never an unverified runtime spy on the
 * `fs` module's namespace object (that shape cannot observe a named `import { readFileSync } from
 * 'fs'` and would pass vacuously).
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import {
  CANDIDATES,
  EVIDENCE_MIN_SEC_GRID,
  checkStream,
  localCreepWindows,
  minWindowSpeed,
  parseControlFile,
  renderEvidenceMarkdown,
  windowEvidence,
} from './compute-walking-break-evidence.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('./compute-walking-break-evidence.mjs', import.meta.url));
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

describe('zero-import guard (D-18/T-34-05)', () => {
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

  it('is watched failing first: a temporary in-test mutation of the real source that plants a pace-derivation import (not inside a comment) is caught by the same stripComments + FORBIDDEN_MODULE_NAMES scan used below — proving the check is not vacuous before it is trusted', () => {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    const mutated = raw + "\nimport { classifyGapsWithSegments } from '../src/analytics/pace-derivation.js';\n";
    const strippedMutated = stripComments(mutated);
    const caught = FORBIDDEN_MODULE_NAMES.some((name) => strippedMutated.includes(name));
    expect(caught).toBe(true);
  });

  it('compute-walking-break-evidence.mjs itself contains none of the forbidden module names once comments are stripped, and never imports from ../dist/', () => {
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

describe('CANDIDATES / EVIDENCE_MIN_SEC_GRID', () => {
  it('CANDIDATES names exactly the three research-proposed ids with their windows, frozen', () => {
    expect(CANDIDATES).toEqual([
      { id: '6286234101', startSec: 5289, endSec: 5696 },
      { id: '3475733231', startSec: 1827, endSec: 2229 },
      { id: '3475715143', startSec: 1590, endSec: 1992 },
    ]);
    expect(Object.isFrozen(CANDIDATES)).toBe(true);
    for (const c of CANDIDATES) {
      expect(Object.isFrozen(c)).toBe(true);
    }
  });

  it('EVIDENCE_MIN_SEC_GRID is the fixed grid, frozen', () => {
    expect(EVIDENCE_MIN_SEC_GRID).toEqual([10, 20, 30, 60, 120, 300]);
    expect(Object.isFrozen(EVIDENCE_MIN_SEC_GRID)).toBe(true);
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

describe('minWindowSpeed', () => {
  it('on a synthetic 1 Hz walk at exactly 1.0 m/s over 200 s with minSec 30 returns 1.0 (within 1e-9)', () => {
    const n = 201;
    const t = Array.from({ length: n }, (_, i) => i);
    const d = Array.from({ length: n }, (_, i) => i);
    const speed = minWindowSpeed(t, d, 0, 200, 30);
    expect(speed).not.toBeNull();
    expect(Math.abs(speed - 1.0)).toBeLessThan(1e-9);
  });

  it('on the same walk with a planted 40 s zero-advance stretch at its middle returns 0 for minSec 30 (the window contains a standstill, so no positive threshold can pass it)', () => {
    const n = 201;
    const t = Array.from({ length: n }, (_, i) => i);
    // Flat (zero-advance) from t=80 to t=120 (40 s); 1.0 m/s elsewhere.
    const d = t.map((tv) => {
      if (tv <= 80) return tv;
      if (tv <= 120) return 80;
      return 80 + (tv - 120);
    });
    const speed = minWindowSpeed(t, d, 0, 200, 30);
    expect(speed).toBe(0);
  });

  it('returns null when the window is shorter than minSec', () => {
    const t = Array.from({ length: 21 }, (_, i) => i);
    const d = Array.from({ length: 21 }, (_, i) => i);
    expect(minWindowSpeed(t, d, 0, 20, 30)).toBeNull();
  });

  it('never throws on malformed input', () => {
    expect(() => minWindowSpeed(null, undefined, 0, 10, 5)).not.toThrow();
    expect(minWindowSpeed(null, undefined, 0, 10, 5)).toBeNull();
  });
});

describe('localCreepWindows', () => {
  function creepFixture() {
    // t=0..30: running at 3 m/s. t=30..90: creep at 0.1 m/s (60 s). t=90..120: running at 3 m/s.
    const t = Array.from({ length: 121 }, (_, i) => i);
    const d = t.map((tv) => {
      if (tv <= 30) return 3 * tv;
      if (tv <= 90) return 90 + 0.1 * (tv - 30);
      return 96 + 3 * (tv - 90);
    });
    return { t, d };
  }

  it('returns exactly one stretch covering the creep at maxMps 0.3 / minSec 30', () => {
    const { t, d } = creepFixture();
    const windows = localCreepWindows(t, d, 0.3, 30);
    expect(windows).toHaveLength(1);
    expect(windows[0].startSec).toBeLessThanOrEqual(30);
    expect(windows[0].endSec).toBeGreaterThanOrEqual(90);
    expect(windows[0].seconds).toBeGreaterThanOrEqual(60);
  });

  it('returns none at maxMps 0.05 (below the creep\'s own ~0.1 m/s)', () => {
    const { t, d } = creepFixture();
    const windows = localCreepWindows(t, d, 0.05, 30);
    expect(windows).toEqual([]);
  });

  it('never spans a local gap (a pair with dt > LOCAL_GAP_THRESHOLD_SEC ends the run)', () => {
    // Segment A: t=0..40 at 0.1 m/s (41 samples). A local gap (dt=15) from t=40 to t=55.
    // Segment B: t=55..95 at 0.1 m/s (41 samples).
    const tA = Array.from({ length: 41 }, (_, i) => i);
    const dA = tA.map((tv) => 0.1 * tv);
    const tB = Array.from({ length: 41 }, (_, i) => 55 + i);
    const dB = tB.map((tv) => dA[dA.length - 1] + 0.1 * (tv - 55));
    const t = [...tA, ...tB];
    const d = [...dA, ...dB];

    const windows = localCreepWindows(t, d, 0.5, 30);
    expect(windows).toHaveLength(2);
    expect(windows[0].endSec).toBeLessThanOrEqual(40);
    expect(windows[1].startSec).toBeGreaterThanOrEqual(55);
  });

  it('never throws on malformed input', () => {
    expect(() => localCreepWindows(null, undefined, 0.3, 30)).not.toThrow();
    expect(localCreepWindows(null, undefined, 0.3, 30)).toEqual([]);
  });
});

describe('windowEvidence', () => {
  it('reports maxZeroAdvanceRunSec, internalGapCount, durationSec, metres, aggregateSpeed, restOfActivitySpeed and hrMin/hrMax on a hand-built fixture', () => {
    // t: [0,10,20,31,41,51,61,71,81] — the pair (20 -> 31) has dt=11 > 10 (one internal gap).
    // d: [0,10,20,20,20,50,60,66,72] — pairs at indices 2 and 3 are zero-advance (dd=0,0), forming
    // a run from t=20 to t=41 (21 s). The candidate window is t=0..61 (indices 0..6); indices 6..8
    // (t=61..81) are the "rest of activity" outside the window, at a steady 0.6 m/s.
    const t = [0, 10, 20, 31, 41, 51, 61, 71, 81];
    const d = [0, 10, 20, 20, 20, 50, 60, 66, 72];
    const hr = [140, 145, 150, 148, 146, 150, 152, 151, 149];
    const stream = { t, d, hr };
    const candidate = { id: 'synthetic-1', startSec: 0, endSec: 61 };

    const evidence = windowEvidence(stream, candidate);

    expect(evidence.ok).toBe(true);
    expect(evidence.id).toBe('synthetic-1');
    expect(evidence.durationSec).toBe(61);
    expect(evidence.metres).toBe(60);
    expect(evidence.aggregateSpeed).toBeCloseTo(60 / 61, 9);
    expect(evidence.internalGapCount).toBe(1);
    expect(evidence.maxZeroAdvanceRunSec).toBe(21);
    expect(evidence.restOfActivitySpeed).toBeCloseTo(0.6, 9);
    expect(evidence.hrMin).toBe(140);
    expect(evidence.hrMax).toBe(152);
  });

  it('reports hrMin/hrMax as null when the hr channel is absent', () => {
    const t = [0, 10, 20, 30];
    const d = [0, 10, 20, 30];
    const stream = { t, d };
    const candidate = { id: 'no-hr', startSec: 0, endSec: 30 };

    const evidence = windowEvidence(stream, candidate);

    expect(evidence.ok).toBe(true);
    expect(evidence.hrMin).toBeNull();
    expect(evidence.hrMax).toBeNull();
  });

  it('reports restOfActivitySpeed as null when the window covers the whole stream', () => {
    const t = [0, 10, 20, 30];
    const d = [0, 10, 20, 30];
    const stream = { t, d };
    const candidate = { id: 'whole-stream', startSec: 0, endSec: 30 };

    const evidence = windowEvidence(stream, candidate);

    expect(evidence.ok).toBe(true);
    expect(evidence.restOfActivitySpeed).toBeNull();
  });

  it('never throws and fails closed when candidate bounds are not exact samples in stream.t', () => {
    const stream = { t: [0, 10, 20], d: [0, 10, 20] };
    const candidate = { id: 'bad-bounds', startSec: 5, endSec: 20 };
    const evidence = windowEvidence(stream, candidate);
    expect(evidence.ok).toBe(false);
    expect(evidence.id).toBe('bad-bounds');
  });

  it('never throws and fails closed on an invalid stream', () => {
    const evidence = windowEvidence({ t: [0, 1], d: [0] }, { id: 'bad-stream', startSec: 0, endSec: 1 });
    expect(evidence.ok).toBe(false);
  });
});

describe('renderEvidenceMarkdown', () => {
  const row1 = {
    id: 'SYN-1',
    startSec: 100,
    endSec: 500,
    durationSec: 400,
    metres: 500,
    aggregateSpeed: 1.25,
    restOfActivitySpeed: 2.5,
    hrMin: 120,
    hrMax: 160,
    internalGapCount: 0,
    maxZeroAdvanceRunSec: 0,
    researchSpeed: null,
    reachability: [
      { minSec: 10, minWindowSpeed: 1.1 },
      { minSec: 300, minWindowSpeed: 0 },
    ],
  };
  const row2 = {
    id: 'SYN-2',
    startSec: 50,
    endSec: 250,
    durationSec: 200,
    metres: 220,
    aggregateSpeed: 1.1,
    restOfActivitySpeed: null,
    hrMin: null,
    hrMax: null,
    internalGapCount: 2,
    maxZeroAdvanceRunSec: 15,
    researchSpeed: 1.4,
    reachability: [{ minSec: 30, minWindowSpeed: null }],
  };

  it('renders the Candidates, Reachability, Research reconciliation and Inputs sections with CAN FAIL / CAN PASS / UNPASSABLE verdicts', () => {
    const markdown = renderEvidenceMarkdown([row1, row2]);

    expect(markdown).toContain('## Candidates');
    expect(markdown).toContain('## Reachability (CAN FAIL / CAN PASS)');
    expect(markdown).toContain('## Research reconciliation');
    expect(markdown).toContain('## Inputs');
    expect(markdown).toContain('SYN-1');
    expect(markdown).toContain('SYN-2');
    expect(markdown).toContain('CAN FAIL');
    expect(markdown).toContain('CAN PASS');
    expect(markdown).toContain('UNPASSABLE');
    expect(markdown).not.toContain('git rev-parse');
  });

  it('is deterministic — calling twice with the same rows produces byte-identical output', () => {
    const md1 = renderEvidenceMarkdown([row1, row2]);
    const md2 = renderEvidenceMarkdown([row1, row2]);
    expect(md1).toBe(md2);
  });

  it('never throws on an empty rows array', () => {
    expect(() => renderEvidenceMarkdown([])).not.toThrow();
  });
});

describe('parseControlFile', () => {
  it('returns [] for text without a CONFIRMED_CONTROL line', () => {
    expect(parseControlFile('# No confirmation yet\n\nSome prose.\n')).toEqual([]);
  });

  it('parses "CONFIRMED_CONTROL: 6286234101 t=5289-5696" into { id, startSec, endSec }', () => {
    const text = '## Developer confirmation (verbatim)\n\nCONFIRMED_CONTROL: 6286234101 t=5289-5696\n';
    expect(parseControlFile(text)).toEqual([{ id: '6286234101', startSec: 5289, endSec: 5696 }]);
  });

  it('parses multiple CONFIRMED_CONTROL lines in order', () => {
    const text = [
      'CONFIRMED_CONTROL: 3475733231 t=1827-2229',
      'CONFIRMED_CONTROL: 3475715143 t=1590-1992',
    ].join('\n');
    expect(parseControlFile(text)).toEqual([
      { id: '3475733231', startSec: 1827, endSec: 2229 },
      { id: '3475715143', startSec: 1590, endSec: 1992 },
    ]);
  });

  it('throws a readable error on a malformed CONFIRMED_CONTROL line (fail closed)', () => {
    expect(() => parseControlFile('CONFIRMED_CONTROL: not-a-valid-line')).toThrow(
      /malformed CONFIRMED_CONTROL/
    );
  });

  it('throws on non-string input', () => {
    expect(() => parseControlFile(null)).toThrow();
    expect(() => parseControlFile(undefined)).toThrow();
  });
});
