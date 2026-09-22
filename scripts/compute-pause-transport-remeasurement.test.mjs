/**
 * Phase 34 plan 05 (PAUSE-03): tests for the transport re-measurement generator. Synthetic
 * fixtures only — never a real committed stream, so this file's own behaviour is provable
 * independently of the live archive's current shape. Run `npm run build` first (this file imports
 * the compiled analytics output, the same discipline every sibling `.test.mjs` in this project
 * follows).
 */

import { describe, expect, it } from 'vitest';

import {
  remeasureActivity,
  remeasureArchive,
  renderRemeasurementMarkdown,
  V22_MIN_INTERVAL_SEC,
  V22_MIN_ADVANCE_M,
} from './compute-pause-transport-remeasurement.mjs';

// ---------------------------------------------------------------------------
// Synthetic fixture builders — no real stream file is ever read in this file.
// ---------------------------------------------------------------------------

/** A single isolated recording gap: two samples, `dt = seconds`, `dd = metres`. No adjacent
 * burst is possible (only two samples exist), so the merged rule reads identically to the old
 * rule on this fixture — the exact shape needed to test the v2.2 boundary rule in isolation. */
function isolatedGapStream(seconds, metres) {
  return { t: [0, seconds], d: [0, metres] };
}

/** A steady-running lead-in, a recording gap that alone advances only `gapMetres` (BELOW the
 * v2.2 threshold on its own), immediately followed by a fast burst the real detector recognises as
 * gap-adjacent (chained to the gap), pushing the MERGED span's own metres over the threshold. This
 * is 34-RESEARCH.md's own named v2.2 blind spot: "a synthetic stream whose raw gap advances 60 m in
 * 40 s but whose adjacent burst adds 80 m". Verified against the real compiled detector output
 * (`classifyGapsWithSegments`/`detectUnreliableSegments`'s default calibrated constants) before
 * being committed here — the burst uses 10 one-second steps of 9 m each (9 m/s, well above the
 * detector's own transport-speed threshold, with aggregate excess clearing its own excess floor),
 * chaining leading-edge to the gap exactly like `unreliable-segments.test.ts`'s own
 * "leading-side case" fixture. */
function burstBlindSpotStream() {
  const t = [0, 1, 2, 3];
  const d = [0, 3, 6, 9];
  // Recording gap: dt = 40 (> 10s threshold), dd = 60 (well under 100 m alone).
  t.push(43);
  d.push(69);
  // Adjacent burst: 10 fast one-second steps of 9 m each, touching the gap's end boundary.
  for (let i = 1; i <= 10; i++) {
    t.push(43 + i);
    d.push(69 + 9 * i);
  }
  // A short tail so the stream does not end mid-burst.
  t.push(57);
  d.push(165);
  return { t, d };
}

/** A steady lead-in, then a long zero-advance flat run (well past the activity's own p90-scaled
 * pause threshold) — classified `'pause'` (zero-advance), never `'recording-gap'`/`'unreliable'`.
 * Used to prove zero-advance pauses never contribute to either v2.2 rule or the transported count
 * (D-01/D-03: they carry no distance, so they can never qualify or read as transported). */
function zeroAdvancePauseStream() {
  const t = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const d = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30];
  for (let i = 1; i <= 20; i++) {
    t.push(10 + i);
    d.push(30);
  }
  t.push(31);
  d.push(33);
  t.push(32);
  d.push(36);
  return { t, d };
}

/** An isolated recording gap fast enough to read transported, but SHORTER than the v2.2 30 s
 * floor — proves D-03's "no duration floor" for the transported class specifically. */
function fastShortGapStream() {
  // 12 s, 100 m => 8.33 m/s, above the detector's own transport-speed threshold; 12 s < 30 s.
  return isolatedGapStream(12, 100);
}

// ---------------------------------------------------------------------------
// v2.2 rule
// ---------------------------------------------------------------------------

describe('v2.2 rule', () => {
  it('names the rule text as constants: 30 s inclusive, 100 m strict', () => {
    expect(V22_MIN_INTERVAL_SEC).toBe(30);
    expect(V22_MIN_ADVANCE_M).toBe(100);
  });

  it('exactly 30 s / 100.0 m does NOT qualify under either rule (100 is a strict floor)', () => {
    const { t, d } = isolatedGapStream(30, 100.0);
    const r = remeasureActivity(t, d);
    expect(r.oldRule.qualifies).toBe(false);
    expect(r.mergedRule.qualifies).toBe(false);
  });

  it('30 s / 100.1 m DOES qualify under either rule', () => {
    const { t, d } = isolatedGapStream(30, 100.1);
    const r = remeasureActivity(t, d);
    expect(r.oldRule.qualifies).toBe(true);
    expect(r.mergedRule.qualifies).toBe(true);
    expect(r.oldRule.intervals).toHaveLength(1);
    expect(r.oldRule.intervals[0].metres).toBeCloseTo(100.1, 5);
  });

  it('29.9 s / 500 m does NOT qualify under either rule (30 s is an inclusive floor, not reached)', () => {
    const { t, d } = isolatedGapStream(29.9, 500);
    const r = remeasureActivity(t, d);
    expect(r.oldRule.qualifies).toBe(false);
    expect(r.mergedRule.qualifies).toBe(false);
  });

  it('exactly 30 s / 100.1 m at the interval-second inclusive edge also qualifies', () => {
    const { t, d } = isolatedGapStream(30, 150);
    const r = remeasureActivity(t, d);
    expect(r.oldRule.qualifies).toBe(true);
    expect(r.oldRule.intervals[0].seconds).toBe(30);
  });

  it('a zero-advance pause interval never qualifies under either rule, however long', () => {
    const { t, d } = zeroAdvancePauseStream();
    const r = remeasureActivity(t, d);
    expect(r.oldRule.qualifies).toBe(false);
    expect(r.mergedRule.qualifies).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// merged rule (the v2.2 blind spot)
// ---------------------------------------------------------------------------

describe('merged rule', () => {
  it('the burst-blind-spot fixture: old rule does not qualify, merged rule does', () => {
    const { t, d } = burstBlindSpotStream();
    const r = remeasureActivity(t, d);

    expect(r.oldRule.qualifies).toBe(false);
    expect(r.oldRule.intervals).toHaveLength(1);
    expect(r.oldRule.intervals[0].metres).toBeCloseTo(60, 5);
    expect(r.oldRule.intervals[0].seconds).toBeCloseTo(40, 5);

    expect(r.mergedRule.qualifies).toBe(true);
    expect(r.mergedRule.intervals).toHaveLength(1);
    expect(r.mergedRule.intervals[0].metres).toBeCloseTo(150, 5);
    expect(r.mergedRule.intervals[0].seconds).toBeCloseTo(50, 5);
  });

  it('the merged interval strictly contains the raw gap span (start at or before, end at or after)', () => {
    const { t, d } = burstBlindSpotStream();
    const r = remeasureActivity(t, d);
    const rawGapStart = 3;
    const rawGapEnd = 43;
    const merged = r.mergedRule.intervals[0];
    expect(merged.startSec).toBeLessThanOrEqual(rawGapStart);
    expect(merged.endSec).toBeGreaterThanOrEqual(rawGapEnd);
  });

  it('an isolated recording gap with no adjacent burst reads identically under both rules', () => {
    const { t, d } = isolatedGapStream(45, 120);
    const r = remeasureActivity(t, d);
    expect(r.oldRule.qualifies).toBe(true);
    expect(r.mergedRule.qualifies).toBe(true);
    expect(r.mergedRule.intervals[0].metres).toBeCloseTo(r.oldRule.intervals[0].metres, 5);
    expect(r.mergedRule.intervals[0].seconds).toBeCloseTo(r.oldRule.intervals[0].seconds, 5);
  });
});

// ---------------------------------------------------------------------------
// transported
// ---------------------------------------------------------------------------

describe('transported', () => {
  it('a fast short gap (12 s, below the 30 s v2.2 floor) still counts as transported — no duration floor (D-03)', () => {
    const { t, d } = fastShortGapStream();
    const r = remeasureActivity(t, d);
    expect(r.oldRule.qualifies).toBe(false); // 12 s < 30 s: never qualifies under v2.2's own rule
    expect(r.transported.count).toBe(1);
    expect(r.transported.intervals).toHaveLength(1);
  });

  it('a slow merged interval (3 m/s) never reads as transported', () => {
    const { t, d } = burstBlindSpotStream();
    const r = remeasureActivity(t, d);
    expect(r.transported.count).toBe(0);
  });

  it('a zero-advance pause interval never reads as transported', () => {
    const { t, d } = zeroAdvancePauseStream();
    const r = remeasureActivity(t, d);
    expect(r.transported.count).toBe(0);
  });

  it('remeasureArchive sums transported intervals and activities across the archive', () => {
    const fast = fastShortGapStream();
    const slow = isolatedGapStream(45, 120);
    const result = remeasureArchive([
      { id: 'fast1', t: fast.t, d: fast.d },
      { id: 'slow1', t: slow.t, d: slow.d },
    ]);
    expect(result.transportedActivities).toEqual(['fast1']);
    expect(result.transportedIntervals).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// remeasureArchive — archive-wide aggregation
// ---------------------------------------------------------------------------

describe('remeasureArchive', () => {
  it('computes newlyCaught/noLongerCaught as the set differences between the two rule activity lists', () => {
    const blindSpot = burstBlindSpotStream(); // old: false, merged: true -> newly caught
    const both = isolatedGapStream(45, 120); // old: true, merged: true -> neither list
    const result = remeasureArchive([
      { id: 'blind-spot', t: blindSpot.t, d: blindSpot.d },
      { id: 'both', t: both.t, d: both.d },
    ]);

    expect(result.oldRuleActivities).toEqual(['both']);
    expect(result.mergedRuleActivities).toEqual(['blind-spot', 'both']);
    expect(result.newlyCaught).toEqual(['blind-spot']);
    expect(result.noLongerCaught).toEqual([]);
  });

  it('counts a malformed stream as notComputable, never throwing', () => {
    const good = isolatedGapStream(45, 120);
    const result = remeasureArchive([
      { id: 'good', t: good.t, d: good.d },
      { id: 'bad-null', t: null, d: null },
      { id: 'bad-mismatch', t: [0, 1, 2], d: [0, 1] },
    ]);
    expect(result.streamsScanned).toBe(3);
    expect(result.computable).toBe(1);
    expect(result.notComputable).toBe(2);
  });

  it('tracks the maximum km/h separately per rule', () => {
    const slower = isolatedGapStream(50, 150); // 3 m/s = 10.8 km/h
    const faster = isolatedGapStream(30, 101); // ~3.37 m/s = ~12.12 km/h
    const result = remeasureArchive([
      { id: 'slower', t: slower.t, d: slower.d },
      { id: 'faster', t: faster.t, d: faster.d },
    ]);
    expect(result.maxKmhOld).toBeGreaterThan(11);
    expect(result.maxKmhOld).toBeLessThan(13);
    expect(result.maxKmhMerged).toBe(result.maxKmhOld);
  });

  it('an empty archive returns zeroed totals and empty lists, never throwing', () => {
    const result = remeasureArchive([]);
    expect(result.streamsScanned).toBe(0);
    expect(result.computable).toBe(0);
    expect(result.oldRuleActivities).toEqual([]);
    expect(result.mergedRuleActivities).toEqual([]);
    expect(result.transportedActivities).toEqual([]);
    expect(result.maxKmhOld).toBe(0);
    expect(result.maxKmhMerged).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

describe('render', () => {
  const sampleResult = {
    streamsScanned: 2,
    computable: 2,
    notComputable: 0,
    oldRuleActivities: ['both'],
    mergedRuleActivities: ['blind-spot', 'both'],
    newlyCaught: ['blind-spot'],
    noLongerCaught: [],
    maxKmhOld: 10.8,
    maxKmhMerged: 12.0,
    oldQualifyingIntervalCount: 1,
    mergedQualifyingIntervalCount: 2,
    transportedIntervals: 1,
    transportedActivities: ['fast1'],
  };
  const sampleProvenance = { streamsTree: 'abc123def456', newestActivityStartDate: '2026-09-20T00:00:00Z' };

  const REQUIRED_HEADINGS = [
    '## Figure of record',
    '## The v2.2 rule re-run',
    '## Transported class (D-05)',
    '## Newly caught / no longer caught',
    "## Reconciliation against v2.2's figure",
    '## Live denominator',
    '## Provenance',
  ];

  it('contains every required heading', () => {
    const markdown = renderRemeasurementMarkdown(sampleResult, sampleProvenance);
    for (const heading of REQUIRED_HEADINGS) {
      expect(markdown).toContain(heading);
    }
  });

  it('is deterministic: two renders of the same input are byte-identical', () => {
    const a = renderRemeasurementMarkdown(sampleResult, sampleProvenance);
    const b = renderRemeasurementMarkdown(sampleResult, sampleProvenance);
    expect(a).toBe(b);
  });

  it('carries no wall-clock timestamp and no bare HEAD commit hash label', () => {
    const markdown = renderRemeasurementMarkdown(sampleResult, sampleProvenance);
    expect(markdown).not.toMatch(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // no ISO wall-clock stamp
    expect(markdown).not.toMatch(/rev-parse HEAD`/); // never a bare HEAD-only provenance label
    expect(markdown).toContain('git tree'); // content-addressed provenance label present
  });

  it('renders newly-caught and no-longer-caught ids by id', () => {
    const markdown = renderRemeasurementMarkdown(sampleResult, sampleProvenance);
    expect(markdown).toContain('`blind-spot`');
    expect(markdown).toContain('_none_'); // noLongerCaught is empty in the sample
  });

  it('quotes the historical v2.2 figure without asserting it equals the measured one', () => {
    const markdown = renderRemeasurementMarkdown(sampleResult, sampleProvenance);
    expect(markdown).toContain('9 activities, all at <=14 km/h');
  });

  it('an empty-archive result still renders all headings, never throwing', () => {
    const emptyResult = {
      streamsScanned: 0,
      computable: 0,
      notComputable: 0,
      oldRuleActivities: [],
      mergedRuleActivities: [],
      newlyCaught: [],
      noLongerCaught: [],
      maxKmhOld: 0,
      maxKmhMerged: 0,
      oldQualifyingIntervalCount: 0,
      mergedQualifyingIntervalCount: 0,
      transportedIntervals: 0,
      transportedActivities: [],
    };
    const markdown = renderRemeasurementMarkdown(emptyResult, { streamsTree: 'x', newestActivityStartDate: null });
    for (const heading of REQUIRED_HEADINGS) {
      expect(markdown).toContain(heading);
    }
  });
});
