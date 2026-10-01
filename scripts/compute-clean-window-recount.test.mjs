/**
 * Guard test for compute-clean-window-recount.mjs (Phase 36 plan 12, D-13; amended 2026-10-01 for
 * PR-09 leg 3's gap-closure fix — see `.planning/debug/36-recount-isolated-jump.md` "## Resolution
 * (recount)"). Every document and stream here is HAND-BUILT and injected through the `readStream`
 * parameter — this file never reads the real shipped best-efforts document (gitignored, deliberately
 * never read by a test sibling — Phase 31 TD-01) and never calls `main()`.
 *
 * Section 1 is D-13's own required red proof and the reason this file exists: a recount only ever
 * exercised on correct output is worth nothing. This project has twice shipped a Critical past a
 * guard that checked the changed code against itself — Phase 23's extent clamp (gesture zoom-out
 * caged by the opening window) and Phase 32's cross-segment conservation (overlapping mapped
 * index ranges double-counting a shared boundary). Sections 1(b) and 1(c) each PLANT one of the
 * two failure shapes D-13 names (a window that spans an anomaly and is wrongly left clean; a
 * contaminated record that names the wrong, anomaly-free window) and watch this recount catch it
 * BEFORE it is trusted on the real document.
 *
 * Sections 1(d)/1(e)/1(f) are the 2026-10-01 gap-closure amendment's own required red proofs, one per
 * defect found by `.planning/debug/36-recount-isolated-jump.md`:
 *   (d) defect 1 — `pairSpeeds` used to drop a pair straddling the window's end boundary (bucket E).
 *   (e) defect 2 — a window lying entirely inside an anomaly could not be judged self-referentially
 *       (bucket W); the fix normalises against the activity's own pairs OUTSIDE the window instead.
 *   (f) defect 3 — the old "every window must clear control p95" verdict was unsatisfiable from its
 *       own measured basis (bucket T); the fix is a two-part verdict with a lower per-window floor.
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
  referenceSpeeds,
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
// carries one extreme outlier among ten pairs (ratio 50/3 ≈ 16.667 under both the old
// self-referential statistic AND the new activity-outside-window reference statistic, since this
// symmetric fixture's "rest of the window" and "rest of the stream" medians coincide at 3 — see
// 1(a)'s comment below for why the numbers did not need to change). Window [10,40] is uniformly
// clean (ratio 1 under both statistics, for the same reason).
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
// SECTION 1 — THE planted BROKEN PARTITIONER (D-13's own required red proof), plus the 2026-10-01
// gap-closure amendment's three defect-specific red proofs (d, e, f).
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
    // The planted windows carry the SAME burst statistic as the real contaminated windows (this
    // still holds under the 2026-10-01 activity-outside-window reference statistic, because this
    // fixture's "outside the window" pairs are the same clean 3 m/s pairs either way), so the
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

  it('(d) planted defect #1 (gap-closure, bucket E): a jump pair straddling the WINDOW END boundary used to be silently dropped by pairSpeeds, hiding the anomaly', () => {
    // Mirrors the real production failure: activity 13343108965@1mi, window ends at t=577.8s
    // inside a segment pair spanning t=574-578s (40.2m/4s ≈ 10 m/s) — the OLD fully-inside rule
    // (`t[i] >= startSec && t[i+1] <= endSec`) excluded that pair because its end (578) is past the
    // window's end (577.8), giving a self-referential ratio of 1.71 (undetected). The NEW
    // intersecting rule included it, giving 3.63 against the activity's own outside-window
    // reference (measured 2026-10-01, `.planning/debug/36-recount-isolated-jump.md` bucket E).
    //
    // This synthetic fixture reproduces the same shape with round numbers: nine 1s pairs at 3 m/s
    // (t=0..9), then a single 4s "jump" pair (t=9..13, 40m ⇒ 10 m/s) whose END (13) is past the
    // window's end (11) — the window only partially consumes the jump — then eleven more 1s pairs
    // at 3 m/s (t=13..24).
    const t = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
    const d = [0];
    for (let i = 0; i < 9; i++) d.push(d[d.length - 1] + 3); // pairs 0-8: 3 m/s each -> d[1..9]
    d.push(d[d.length - 1] + 40); // pair 9 (t=9-13, dt=4): the 40m jump -> d[10] = 27 + 40 = 67
    for (let i = 0; i < 11; i++) d.push(d[d.length - 1] + 3); // pairs 10-20: 3 m/s each -> d[11..21]

    const start = 0;
    const end = 11; // the window ends INSIDE the jump pair's span [9, 13]

    const windowSpeeds = pairSpeeds(t, d, start, end);
    // The crossing pair (speed 10) IS included: 9 clean pairs (3 m/s) + the jump pair (10 m/s).
    expect(windowSpeeds).toHaveLength(10);
    expect(windowSpeeds).toContain(10);
    expect(Math.max(...windowSpeeds)).toBe(10);

    const outsideSpeeds = referenceSpeeds(t, d, start, end);
    // The crossing pair overlaps the window, so it is NOT counted as a reference pair either — it
    // contributes to the window's max exactly once, never to both sides.
    expect(outsideSpeeds).toHaveLength(11);
    expect(outsideSpeeds.every((s) => s === 3)).toBe(true);

    const ratio = windowOutlierRatio(windowSpeeds, outsideSpeeds);
    expect(ratio).toBeCloseTo(10 / 3, 10);

    // RED-proof statement: under the OLD fully-inside rule, the crossing pair (t=9-13) would have
    // been excluded because its end (13) exceeds the window's end (11). The window would then see
    // only the nine clean 3 m/s pairs, giving a self-referential max/median of 3/3 = 1 — the
    // anomaly is invisible. Demonstrated here by applying the OLD rule inline (not by calling a
    // since-removed function) and confirming it produces exactly that blind ratio, so this
    // assertion is falsifiable rather than a narrative.
    function oldFullyInsidePairSpeeds(tArr, dArr, s, e) {
      const speeds = [];
      for (let i = 0; i < tArr.length - 1; i++) {
        const t0 = tArr[i];
        const t1 = tArr[i + 1];
        if (t0 < s || t1 > e) continue;
        const dt = t1 - t0;
        if (dt === 0) continue;
        speeds.push((dArr[i + 1] - dArr[i]) / dt);
      }
      return speeds;
    }
    const oldSpeeds = oldFullyInsidePairSpeeds(t, d, start, end);
    expect(oldSpeeds).toHaveLength(9);
    expect(oldSpeeds).not.toContain(10);
    expect(Math.max(...oldSpeeds) / (oldSpeeds.reduce((a, b) => a + b, 0) / oldSpeeds.length)).toBe(1);
  });

  it('(e) planted defect #2 (gap-closure, bucket W): a window lying ENTIRELY inside an anomaly cannot be judged by its own self-referential median, but the outside-window reference catches it', () => {
    // Mirrors the real production failure: activity 3475713616@400m, a hidden-pause window
    // (t=3178-3196.5s) whose every pair is part of the catch-up burst itself (14.5-28.6 m/s) —
    // the OLD self-referential max/median collapsed to 1.11 (undetected) because there was no
    // clean pair left INSIDE the window to contrast against. The NEW outside-window reference gave
    // 10.59 against the activity's own normal pace (measured 2026-10-01,
    // `.planning/debug/36-recount-isolated-jump.md` bucket W).
    //
    // Synthetic fixture: a 50s stream, steady at 3 m/s everywhere except a burst of ten 1s pairs
    // at 28 m/s between t=20 and t=30. The window [20, 30] is EXACTLY the burst — every pair
    // inside it is anomalous, so the window has no "clean" pair of its own.
    const t = [];
    for (let i = 0; i <= 50; i++) t.push(i);
    const d = [0];
    for (let i = 0; i < 50; i++) {
      const speed = i >= 20 && i < 30 ? 28 : 3;
      d.push(d[d.length - 1] + speed);
    }

    const start = 20;
    const end = 30;

    const windowSpeeds = pairSpeeds(t, d, start, end);
    expect(windowSpeeds).toHaveLength(10);
    expect(windowSpeeds.every((s) => s === 28)).toBe(true);

    // Pre-fix behaviour, demonstrated inline: a self-referential ratio over the window's OWN
    // pairs alone collapses to 1 — the anomaly cannot see itself.
    const selfReferentialRatio = Math.max(...windowSpeeds) / (windowSpeeds.reduce((a, b) => a + b, 0) / windowSpeeds.length);
    expect(selfReferentialRatio).toBe(1);

    const outsideSpeeds = referenceSpeeds(t, d, start, end);
    expect(outsideSpeeds).toHaveLength(40);
    expect(outsideSpeeds.every((s) => s === 3)).toBe(true);

    const ratio = windowOutlierRatio(windowSpeeds, outsideSpeeds);
    expect(ratio).toBeCloseTo(28 / 3, 10);
    expect(ratio).toBeGreaterThan(9); // nowhere near the undetected self-referential ratio of 1
  });

  it('(f) fix 3 reachability (gap-closure, bucket T): a jump of realistic T-bucket magnitude (~2.5x the control p95) FAILS the OLD uniform-p95 rule but PASSES the redesigned two-part verdict', () => {
    // The OLD rule required EVERY contaminated window to individually clear the control
    // population's OWN p95 — shown unsatisfiable from its own measured basis (contaminated p05
    // 2.596 < control p95 3.0 on the pre-fix statistic; `.planning/debug/36-recount-isolated-jump.md`
    // bucket T, 148/190 of the live failures). The redesigned verdict keeps the POPULATION-level
    // separation check (`checkBasisGate`: contaminated median > control p95) but judges each window
    // against a materially LOWER per-window floor (`deriveVerdict`'s control p75).
    //
    // Synthetic control population (40 entries, evenly spread 1.0..2.9 — the measured archive's own
    // control distribution has a similar shape: mostly near 1-2, a thin tail reaching toward 3).
    const controlRatios = [];
    for (let i = 0; i < 40; i++) controlRatios.push(1.0 + i * (1.9 / 39));
    const control = controlRatios.map((ratio, i) => ({
      activityId: `control_${i}`,
      distance: '1k',
      window: { startSec: 0, endSec: 10 },
      ratio,
      pairCount: 10,
      referenceCount: 40,
      label: `control_${i}@1k`,
    }));

    // Three contaminated windows: a realistic T-bucket-magnitude jump (2.6, between the control
    // p75 and p95) plus two clearly-anomalous windows that keep the population median well above
    // the control p95 so the basis gate separates.
    const contaminatedRatios = [2.6, 6.0, 8.0];
    const contaminated = contaminatedRatios.map((ratio, i) => ({
      activityId: `burst_${i}`,
      distance: '400m',
      window: { startSec: 0, endSec: 10 },
      ratio,
      pairCount: 10,
      referenceCount: 40,
      label: `burst_${i}@400m`,
    }));

    const populations = { control, contaminated };

    const basisGate = checkBasisGate(populations);
    expect(basisGate.ok).toBe(true);
    // The T-bucket-magnitude window (2.6) is BELOW the population-level p95 that the OLD rule
    // required every window to individually clear — proving it would have FAILED the old rule.
    expect(basisGate.controlThresholdBasis).toBeGreaterThan(2.6);

    const verdict = deriveVerdict(populations);
    // Yet the redesigned per-window floor (control p75, materially lower) is BELOW 2.6, so the
    // same window PASSES under the new two-part verdict.
    expect(verdict.controlFloor).toBeLessThan(2.6);
    expect(verdict.controlFloorPercentile).toBe(75);
    expect(verdict.fail).toBe(0);
    expect(verdict.pass).toBe(3);
  });

  it('a recount only ever exercised on correct output is worth nothing — this project has twice shipped a Critical past a guard that checked the changed code against itself (Phase 23 extent clamp, Phase 32 cross-segment conservation)', () => {
    expect(true).toBe(true); // documentation-only assertion, see the describe block's own comment
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
    referenceCount: 10,
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
// SECTION 6 — pairSpeeds / referenceSpeeds / windowOutlierRatio totality on degenerate windows
// (2026-10-01 gap-closure amendment: windowOutlierRatio now takes TWO arrays — window speeds and
// the activity's own outside-window reference speeds — rather than one self-referential array)
// ---------------------------------------------------------------------------------------------

describe('pairSpeeds / referenceSpeeds / windowOutlierRatio — totality on degenerate windows', () => {
  it('zero qualifying window pairs: pairSpeeds returns [] and the ratio is null, never Infinity', () => {
    const windowSpeeds = pairSpeeds([0, 1], [0, 3], 5, 10); // window entirely outside the stream's range
    expect(windowSpeeds).toEqual([]);
    const outsideSpeeds = referenceSpeeds([0, 1], [0, 3], 5, 10);
    const ratio = windowOutlierRatio(windowSpeeds, outsideSpeeds);
    expect(ratio).toBeNull();
    expect(ratio).not.toBe(Infinity);
  });

  it('one qualifying window pair but fewer than 3 reference pairs: the ratio is null (reference too small)', () => {
    const t = [0, 1, 2];
    const d = [0, 3, 3];
    const windowSpeeds = pairSpeeds(t, d, 0, 1); // only the first pair qualifies for the window
    expect(windowSpeeds).toHaveLength(1);
    const outsideSpeeds = referenceSpeeds(t, d, 0, 1); // only 1 pair remains outside -> below minimum
    expect(outsideSpeeds.length).toBeLessThan(3);
    expect(windowOutlierRatio(windowSpeeds, outsideSpeeds)).toBeNull();
  });

  it('a window pair with dt === 0 is skipped rather than dividing by zero, on both sides', () => {
    const t = [0, 0, 1, 2, 3];
    const d = [0, 5, 8, 11, 14];
    const windowSpeeds = pairSpeeds(t, d, 0, 3);
    const outsideSpeeds = referenceSpeeds(t, d, 0, 3);
    expect(windowSpeeds.every((s) => Number.isFinite(s))).toBe(true);
    expect(outsideSpeeds.every((s) => Number.isFinite(s))).toBe(true);
    expect(windowSpeeds).not.toContain(Infinity);
    expect(outsideSpeeds).not.toContain(Infinity);
  });

  it('a reference population whose median speed is 0 returns null, never Infinity', () => {
    const windowSpeeds = [5];
    const referenceSpeedsFixture = [0, 0, 0]; // median 0
    const ratio = windowOutlierRatio(windowSpeeds, referenceSpeedsFixture);
    expect(ratio).toBeNull();
    expect(ratio).not.toBe(Infinity);
  });

  it('never throws on any of the four degenerate cases', () => {
    expect(() => pairSpeeds([], [], 0, 10)).not.toThrow();
    expect(() => referenceSpeeds([], [], 0, 10)).not.toThrow();
    expect(() => windowOutlierRatio([], [])).not.toThrow();
    expect(() => windowOutlierRatio([1], [1, 1])).not.toThrow();
    expect(() => windowOutlierRatio([5], [0, 0, 0])).not.toThrow();
  });
});
