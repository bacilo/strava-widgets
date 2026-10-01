/**
 * Guard test for compute-clean-window-recount.mjs (Phase 36 plan 12, D-13). Every document and
 * stream here is HAND-BUILT and injected through the `readStream` parameter — this file never
 * reads the real shipped best-efforts document (gitignored, deliberately never read by a test
 * sibling — Phase 31 TD-01) and never calls `main()`.
 *
 * Section 1 is D-13's own required red proof and the reason this file exists: a recount only ever
 * exercised on correct output is worth nothing. This project has twice shipped a Critical past a
 * guard that checked the changed code against itself — Phase 23's extent clamp (gesture zoom-out
 * caged by the opening window) and Phase 32's cross-segment conservation (overlapping mapped
 * index ranges double-counting a shared boundary). Sections 1(b) and 1(c) each PLANT one of the
 * two failure shapes D-13 names (a window that spans an anomaly and is wrongly left clean; a
 * contaminated record that names the wrong, anomaly-free window) and watch this recount catch it
 * BEFORE it is trusted on the real document.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import {
  checkBasisGate,
  checkInternalConsistency,
  checkPinnedFixtures,
  classifyWindows,
  deriveVerdict,
  pairSpeeds,
  windowOutlierRatio,
} from './compute-clean-window-recount.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('./compute-clean-window-recount.mjs', import.meta.url));

// ---------------------------------------------------------------------------------------------
// Shared fixtures: a hand-computed "burst" stream (anomaly in [0,10], clean in [10,40]) and a
// uniformly clean "low" stream, used to build both the CORRECT and the two planted-broken
// documents below.
// ---------------------------------------------------------------------------------------------

function buildStream(speedsPerSecond) {
  const t = [];
  const d = [0];
  for (let i = 0; i <= speedsPerSecond.length; i++) t.push(i);
  for (let i = 0; i < speedsPerSecond.length; i++) d.push(d[i] + speedsPerSecond[i]);
  return { t, d };
}

// Pair 0 (t=0..1) jumps 50m in 1s; pairs 1..39 hold a steady 3 m/s. Window [0,10] therefore
// carries one extreme outlier among ten pairs (ratio 50/3 ≈ 16.667); window [10,40] is uniformly
// clean (ratio 1).
const BURST_STREAM = buildStream([50, ...Array(39).fill(3)]);
// Uniformly steady at 3 m/s — any 3+ pair sub-window has ratio exactly 1.
const LOW_STREAM = buildStream(Array(10).fill(3));

function cleanControlEffort(distance, startOffsetSec, endOffsetSec) {
  return {
    distance,
    durationSec: endOffsetSec - startOffsetSec,
    paceSecPerKm: 100,
    startOffsetSec,
    endOffsetSec,
    demotion: null,
    contaminated: null,
  };
}

/** A CORRECTLY partitioned effort: ranks on the clean [10,40] window, contaminated names [0,10]. */
function correctlyContaminatedEffort(distance, burstStart, burstEnd) {
  return {
    distance,
    durationSec: 30,
    paceSecPerKm: 100,
    startOffsetSec: 10,
    endOffsetSec: 40,
    demotion: null,
    contaminated: {
      guard: 'unreliable-segment',
      reason: `fixture burst at t=${burstStart}-${burstEnd}`,
      durationSec: burstEnd - burstStart,
      paceSecPerKm: 50,
      startOffsetSec: burstStart,
      endOffsetSec: burstEnd,
    },
  };
}

/** planted defect #1 shape: a BROKEN partitioner's window SPANS the burst and contaminated is null. */
function brokenSpanningEffort(distance, burstStart, burstEnd) {
  return {
    distance,
    durationSec: burstEnd - burstStart,
    paceSecPerKm: 50,
    startOffsetSec: burstStart,
    endOffsetSec: burstEnd,
    demotion: null,
    contaminated: null,
  };
}

function buildCorrectDoc() {
  const activities = {};
  for (let i = 0; i < 27; i++) {
    activities[`clean_${i}`] = { efforts: [cleanControlEffort('1k', 0, 5)] };
  }
  for (let i = 0; i < 8; i++) {
    activities[`burst_${i}`] = { efforts: [correctlyContaminatedEffort('400m', 0, 10)] };
  }
  return { activities, totals: { effortsDemoted: 0 } };
}

function buildStreamMapForCorrectDoc() {
  const map = {};
  for (let i = 0; i < 27; i++) map[`clean_${i}`] = LOW_STREAM;
  for (let i = 0; i < 8; i++) map[`burst_${i}`] = BURST_STREAM;
  return map;
}

function readStreamFromMap(map) {
  return (activityId) => map[activityId] || null;
}

// ---------------------------------------------------------------------------------------------
// SECTION 1 — THE planted BROKEN PARTITIONER (D-13's own required red proof)
// ---------------------------------------------------------------------------------------------

describe('THE planted BROKEN PARTITIONER (D-13)', () => {
  it('(a) on a CORRECT partition, deriveVerdict returns all-pass and checkInternalConsistency finds no violations', () => {
    const doc = buildCorrectDoc();
    const readStream = readStreamFromMap(buildStreamMapForCorrectDoc());
    const populations = classifyWindows(doc, readStream);

    expect(populations.control).toHaveLength(27);
    expect(populations.contaminated).toHaveLength(8);

    const verdict = deriveVerdict(populations);
    expect(verdict.fail).toBe(0);
    expect(verdict.notAssessable).toBe(0);
    expect(verdict.pass).toBe(8);

    const consistency = checkInternalConsistency(doc);
    expect(consistency.violations).toEqual([]);
  });

  it("(b) planted defect #1: a window that SPANS the burst with contaminated:null enters CONTROL and destroys separation — the basis gate FLAGS it through a stated mechanism, not by accident", () => {
    const doc = buildCorrectDoc();
    // PLANT: 5 of the 8 correctly-partitioned burst activities are rewritten as a BROKEN
    // partitioner would write them — the ranked window now SPANS the burst, contaminated is null.
    for (let i = 0; i < 5; i++) {
      doc.activities[`burst_${i}`] = { efforts: [brokenSpanningEffort('400m', 0, 10)] };
    }
    const readStream = readStreamFromMap(buildStreamMapForCorrectDoc());
    const populations = classifyWindows(doc, readStream);

    // Mechanism check, not an accident: the 5 planted windows now sit in CONTROL, not
    // CONTAMINATED — exactly the shape D-13 describes.
    expect(populations.control).toHaveLength(27 + 5);
    expect(populations.contaminated).toHaveLength(3);

    const basisGate = checkBasisGate(populations);
    expect(basisGate.ok).toBe(false);
    expect(basisGate.reason).toContain('do not separate');
    expect(basisGate.controlN).toBe(32);
    expect(basisGate.contaminatedN).toBe(3);
    // The planted windows carry the SAME burst statistic as the real contaminated windows, so the
    // control threshold they inflate the p95 to is numerically identical to the contaminated
    // median — proving the mechanism (not just the verdict) is the one D-13 describes.
    expect(basisGate.controlThresholdBasis).toBeCloseTo(basisGate.contaminatedMedian, 6);
  });

  it('(c) planted defect #2: a contaminated record naming a CLEAN window (the search labelled the wrong window) is marked failing the ratio rule', () => {
    const doc = buildCorrectDoc();
    // PLANT: burst_7's contaminated record now names a CLEAN sub-interval (20-30, inside the same
    // stream's clean stretch) instead of the real burst window (0-10) — the direction that catches
    // a search mislabelling which window is contaminated, not merely missing one.
    doc.activities.burst_7 = { efforts: [correctlyContaminatedEffort('400m', 20, 30)] };
    const readStream = readStreamFromMap(buildStreamMapForCorrectDoc());
    const populations = classifyWindows(doc, readStream);

    expect(populations.contaminated).toHaveLength(8);

    const verdict = deriveVerdict(populations);
    expect(verdict.pass).toBe(7);
    expect(verdict.fail).toBe(1);
    expect(verdict.offendingEntries).toHaveLength(1);
    expect(verdict.offendingEntries[0].activityId).toBe('burst_7');
    expect(verdict.offendingEntries[0].ratio).toBeCloseTo(1, 6);
  });
});

// ---------------------------------------------------------------------------------------------
// SECTION 2 — THE BASIS GATE, both directions
// ---------------------------------------------------------------------------------------------

function populationFromRatios(ratios) {
  return ratios.map((ratio, i) => ({
    activityId: `fixture_${i}`,
    distance: '400m',
    window: { startSec: 0, endSec: 10 },
    ratio,
    pairCount: 5,
    label: `fixture_${i}@400m`,
  }));
}

describe('THE BASIS GATE — both directions', () => {
  it('fails closed with a named reason when the control population is below the stated minimum', () => {
    const populations = {
      control: populationFromRatios(Array(10).fill(1)),
      contaminated: populationFromRatios([5, 6, 7]),
    };
    const gate = checkBasisGate(populations);
    expect(gate.ok).toBe(false);
    expect(gate.reason).toContain('below the stated minimum of 30');
  });

  it('fails closed with a named reason when the contaminated population is empty', () => {
    const populations = { control: populationFromRatios(Array(40).fill(1)), contaminated: [] };
    const gate = checkBasisGate(populations);
    expect(gate.ok).toBe(false);
    expect(gate.reason).toContain('contaminated population is empty');
  });

  it('fails closed with a named reason when the two distributions do not separate', () => {
    const populations = {
      control: populationFromRatios(Array(35).fill(5)),
      contaminated: populationFromRatios([5, 5, 5]),
    };
    const gate = checkBasisGate(populations);
    expect(gate.ok).toBe(false);
    expect(gate.reason).toContain('do not separate');
  });

  it('passes with ok:true and no reason on a healthy, well-separated basis', () => {
    const populations = {
      control: populationFromRatios(Array(40).fill(1)),
      contaminated: populationFromRatios([10, 12, 15]),
    };
    const gate = checkBasisGate(populations);
    expect(gate.ok).toBe(true);
    expect(gate.reason).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// SECTION 3 — THE ZERO-IMPORT SCAN, watched RED
// ---------------------------------------------------------------------------------------------

const FORBIDDEN_MODULE_NAMES = [
  'compute-best-efforts',
  'best-effort-ceiling',
  'best-effort-utils',
  'best-effort.types',
  'unreliable-segments',
  'pace-derivation',
  'compute-ceiling-recalibration',
  'compute-clean-window-diff',
];

/**
 * Strips comments BEFORE searching for forbidden module names, mirroring
 * compute-pr-ceiling-recount.test.mjs's own stripComments — the recount's header docblock
 * legitimately names all eight forbidden modules while explaining why, so a naive raw-source grep
 * would fail on the script's own prose.
 */
function stripComments(source) {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

describe('THE ZERO-IMPORT SCAN (D-13) — watched RED before it is trusted', () => {
  it('the stripper actually removes a line naming a forbidden module, planted in a throwaway fixture — proving it works rather than assuming it', () => {
    const fixture = [
      'const ok = 1;',
      '// imports compute-best-efforts and best-effort-ceiling, forbidden',
      '/* also forbidden: best-effort-utils, best-effort.types, unreliable-segments, pace-derivation, compute-ceiling-recalibration, compute-clean-window-diff */',
      'const alsoOk = 2;',
    ].join('\n');

    const stripped = stripComments(fixture);

    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(fixture).toContain(forbidden);
      expect(stripped).not.toContain(forbidden);
    }
    expect(stripped).toContain('const ok = 1;');
    expect(stripped).toContain('const alsoOk = 2;');
  });

  it('compute-clean-window-recount.mjs contains none of the eight forbidden module names once comments are stripped, and imports exactly {fs, path, url}', () => {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    const stripped = stripComments(raw);

    // Sanity check first: the RAW source legitimately names all eight modules in its header
    // docblock (explaining why they are forbidden) — if this failed, the test below would be
    // vacuous, never actually exercising the stripper on real content.
    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(raw).toContain(forbidden);
    }
    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(stripped).not.toContain(forbidden);
    }

    const importSpecifiers = [...stripped.matchAll(/^import .*?from '([^']+)';/gm)].map((m) => m[1]);
    expect(new Set(importSpecifiers)).toEqual(new Set(['fs', 'path', 'url']));
  });

  it('planted violation: inserting a forbidden import into the source is REPORTED by the same scanner', () => {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    const planted = `${raw}\nimport { findBestEffort } from '../dist/analytics/best-effort-utils.js';\n`;
    const stripped = stripComments(planted);
    expect(stripped).toContain('best-effort-utils.js');
  });

  it('a forbidden name planted inside a COMMENT-only line is NOT reported, proving comment-stripping is load-bearing rather than assumed', () => {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    const planted = `${raw}\n// a planted mention of best-effort-utils inside a comment only, never in code\n`;
    const stripped = stripComments(planted);
    expect(stripped).not.toContain('best-effort-utils');
  });
});

// ---------------------------------------------------------------------------------------------
// SECTION 4 — INTERNAL CONSISTENCY, both directions
// ---------------------------------------------------------------------------------------------

describe('INTERNAL CONSISTENCY — both directions', () => {
  it('flags the two-homes violation: an effort carrying BOTH a non-null contaminated record and a non-null demotion', () => {
    const doc = {
      activities: {
        bad: {
          efforts: [
            {
              distance: '400m',
              demotion: { guard: 'ceiling', reason: 'x' },
              contaminated: {
                guard: 'unreliable-segment',
                reason: 'y',
                durationSec: 10,
                paceSecPerKm: 100,
                startOffsetSec: 0,
                endOffsetSec: 10,
              },
            },
          ],
        },
      },
      totals: { effortsDemoted: 1 },
    };
    const result = checkInternalConsistency(doc);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes('non-null demotion'))).toBe(true);
  });

  it('flags a totals.effortsDemoted mismatch against the walked non-null-demotion count', () => {
    const doc = {
      activities: {
        a1: { efforts: [{ distance: '400m', demotion: { guard: 'ceiling', reason: 'x' }, contaminated: null }] },
      },
      totals: { effortsDemoted: 999 },
    };
    const result = checkInternalConsistency(doc);
    expect(result.walkedDemotedCount).toBe(1);
    expect(result.violations.some((v) => v.includes('999'))).toBe(true);
  });

  it('reports no violations for a consistent document', () => {
    const doc = {
      activities: {
        a1: { efforts: [{ distance: '400m', demotion: null, contaminated: null }] },
        a2: {
          efforts: [
            {
              distance: '1k',
              demotion: null,
              contaminated: {
                guard: 'unreliable-segment',
                reason: 'z',
                durationSec: 5,
                paceSecPerKm: 300,
                startOffsetSec: 0,
                endOffsetSec: 5,
              },
            },
          ],
        },
      },
      totals: { effortsDemoted: 0 },
    };
    const result = checkInternalConsistency(doc);
    expect(result.violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// SECTION 5 — PINNED FIXTURES, both directions
// ---------------------------------------------------------------------------------------------

describe('PINNED FIXTURES (ROADMAP Criterion 4) — both directions', () => {
  it("passes when 3475740390@400m's contaminated.paceSecPerKm converts to the pinned '3:20'", () => {
    const doc = {
      activities: {
        '3475740390': {
          efforts: [
            {
              distance: '400m',
              demotion: null,
              contaminated: {
                guard: 'unreliable-segment',
                reason: 'r',
                durationSec: 79.9,
                paceSecPerKm: 199.8,
                startOffsetSec: 2508,
                endOffsetSec: 2587.9,
              },
            },
          ],
        },
      },
    };
    const results = checkPinnedFixtures(doc);
    const row = results.find((r) => r.activityId === '3475740390');
    expect(row.ok).toBe(true);
    expect(row.converted).toBe('3:20');
  });

  it('fails with a named reason when the figure is a second away from the pinned value', () => {
    const doc = {
      activities: {
        '3475740390': {
          efforts: [
            {
              distance: '400m',
              demotion: null,
              contaminated: {
                guard: 'unreliable-segment',
                reason: 'r',
                durationSec: 79.9,
                paceSecPerKm: 200.8,
                startOffsetSec: 2508,
                endOffsetSec: 2587.9,
              },
            },
          ],
        },
      },
    };
    const results = checkPinnedFixtures(doc);
    const row = results.find((r) => r.activityId === '3475740390');
    expect(row.ok).toBe(false);
    expect(row.reason).toContain('expected');
  });
});

// ---------------------------------------------------------------------------------------------
// SECTION 6 — pairSpeeds / windowOutlierRatio totality on degenerate windows
// ---------------------------------------------------------------------------------------------

describe('pairSpeeds / windowOutlierRatio — totality on degenerate windows', () => {
  it('zero qualifying pairs: pairSpeeds returns [] and the ratio is null, never Infinity', () => {
    const speeds = pairSpeeds([0, 1], [0, 3], 5, 10); // window entirely outside the stream's range
    expect(speeds).toEqual([]);
    const ratio = windowOutlierRatio(speeds);
    expect(ratio).toBeNull();
    expect(ratio).not.toBe(Infinity);
  });

  it('one qualifying pair: below the minimum pair count, the ratio is null', () => {
    const speeds = pairSpeeds([0, 1, 2], [0, 3, 3], 0, 1); // only the first pair qualifies
    expect(speeds).toHaveLength(1);
    expect(windowOutlierRatio(speeds)).toBeNull();
  });

  it('a pair with dt === 0 is skipped rather than dividing by zero', () => {
    const t = [0, 0, 1, 2, 3];
    const d = [0, 5, 8, 11, 14];
    const speeds = pairSpeeds(t, d, 0, 3);
    expect(speeds.every((s) => Number.isFinite(s))).toBe(true);
    expect(speeds).not.toContain(Infinity);
  });

  it('a window whose median speed is 0 returns null, never Infinity', () => {
    const speeds = [5, 0, 0, 0]; // median 0
    const ratio = windowOutlierRatio(speeds);
    expect(ratio).toBeNull();
    expect(ratio).not.toBe(Infinity);
  });

  it('never throws on any of the four degenerate cases', () => {
    expect(() => pairSpeeds([], [], 0, 10)).not.toThrow();
    expect(() => windowOutlierRatio([])).not.toThrow();
    expect(() => windowOutlierRatio([1])).not.toThrow();
    expect(() => windowOutlierRatio([0, 0, 0])).not.toThrow();
  });
});
