import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

import {
  coverageCaptionText,
  splitGapAnnotations,
  breakdownSectionPlan,
  qualitySignalsSectionPlan,
  EXPLANATION_PROBE_QUALITY,
  type SplitGapAnnotation,
} from './detail-sections.js';
import type { Split } from './detail-splits.js';
import type { PaceBucket } from './detail-zones.js';
import type { PaceCoverage, GapInterval } from '../../analytics/pace-derivation.js';
import { derivePaceWithCoverage } from '../../analytics/pace-derivation.js';
import { computeSplits } from './detail-splits.js';
import type { CanonicalStream } from '../../streams/stream.types.js';
import { stripComments } from '../row-semantics.test.js';
import { qualityBadgeSpecs } from './list.js';
import type { ActivityQualitySignals, DeviceFamilyKind, PaceQualityShard } from '../../analytics/pace-quality.js';

/*
 * Unit tests for the pure D-08/D-09 helpers (`coverageCaptionText`,
 * `splitGapAnnotations`), plus source-text wiring guards, following
 * `curation-seam.test.ts`'s idiom. Vitest runs in this repository with
 * `environment: 'node'` — there is no DOM-simulation library dependency
 * anywhere in the tree, so this file never invokes a DOM builder
 * (`buildBreakdownSection`/`buildSplitsSection` themselves). Rendering
 * itself is proven only by the mandatory human browser checkpoint
 * (plan 26-10).
 */

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeCoverage(overrides: Partial<PaceCoverage>): PaceCoverage {
  return {
    spanSec: 0,
    coveredSec: 0,
    recordingGapSec: 0,
    pauseSec: 0,
    gapIntervals: [],
    ...overrides,
  };
}

/** Minimal `Split` fixture — only `km`/`startTimeSec`/`endTimeSec` matter to `splitGapAnnotations`. */
function makeSplit(km: number, startTimeSec: number, endTimeSec: number): Split {
  return {
    km,
    distanceM: 1000,
    durationSec: endTimeSec - startTimeSec,
    paceSecPerKm: endTimeSec - startTimeSec,
    isPartial: false,
    startTimeSec,
    endTimeSec,
    avgHr: null,
    avgCadence: null,
    elevDeltaM: null,
  };
}

function makeGap(startSec: number, endSec: number, kind: GapInterval['kind']): GapInterval {
  return { startSec, endSec, kind };
}

function makeBucket(overrides: Partial<PaceBucket>): PaceBucket {
  return { minSecPerKm: 0, maxSecPerKm: 0, label: '', timeSec: 0, ...overrides };
}

function loadStream(activityId: string): CanonicalStream {
  const raw = fs.readFileSync(`data/streams/${activityId}.json`, 'utf-8');
  return JSON.parse(raw) as CanonicalStream;
}

// ---------------------------------------------------------------------------
// coverageCaptionText
// ---------------------------------------------------------------------------

describe('coverageCaptionText — coverage caption (D-08, COV-02)', () => {
  it('emits all three segments at 0%, joined by the middle-dot separator, on a fully covered stream', () => {
    const coverage = makeCoverage({ spanSec: 100, coveredSec: 100, recordingGapSec: 0, pauseSec: 0 });
    expect(coverageCaptionText(coverage)).toBe('100% of elapsed time covered · 0% recording gaps · 0% paused');
  });

  it('returns null on a zero span (T-26-01: never throws, never renders a nonsensical caption)', () => {
    const coverage = makeCoverage({ spanSec: 0, coveredSec: 0, recordingGapSec: 0, pauseSec: 0 });
    expect(coverageCaptionText(coverage)).toBeNull();
  });

  it('returns null on a negative span (malformed/adversarial input, T-26-01)', () => {
    const coverage = makeCoverage({ spanSec: -5, coveredSec: 0, recordingGapSec: 0, pauseSec: 0 });
    expect(coverageCaptionText(coverage)).toBeNull();
  });

  it('does not force the three rounded percentages to sum to 100 — a 33/33/33 split stays 33/33/33, not adjusted to 100', () => {
    // spanSec 3, one second in each category: each fraction is 33.333...%,
    // which Math.round independently rounds to 33 for all three — summing
    // to 99, not 100. Asserting the un-adjusted 33/33/33 output pins that
    // this helper never "fixes" the display total (see its own doc comment).
    const coverage = makeCoverage({ spanSec: 3, coveredSec: 1, recordingGapSec: 1, pauseSec: 1 });
    const text = coverageCaptionText(coverage);
    expect(text).toBe('33% of elapsed time covered · 33% recording gaps · 33% paused');
    // Explicit non-100 assertion, so this test would fail loudly if a future
    // edit "corrected" the percentages to sum to exactly 100.
    expect(33 + 33 + 33).not.toBe(100);
  });

  it('renders the pinned worked example (4556693525) at the percentages plan 26-10 will read back', () => {
    const stream = loadStream('4556693525');
    const derived = derivePaceWithCoverage(stream);
    const text = coverageCaptionText(derived.coverage);
    // Pre-computed at execution time (see this plan's SUMMARY.md) so
    // plan 26-10's human checkpoint has an expectation to read back against,
    // not just "a caption is present".
    expect(text).toBe('99% of elapsed time covered · 1% recording gaps · 0% paused');
  });
});

// ---------------------------------------------------------------------------
// splitGapAnnotations
// ---------------------------------------------------------------------------

describe('splitGapAnnotations — gap marker source of truth', () => {
  it('returns one entry naming the correct km and the correct overlapping seconds, attributed to the correct kind', () => {
    const splits = [makeSplit(1, 0, 100), makeSplit(2, 100, 200)];
    const gap = makeGap(50, 80, 'recording-gap'); // fully inside km 1's window: 30s
    const result = splitGapAnnotations(splits, [gap]);
    expect(result).toEqual<SplitGapAnnotation[]>([{ km: 1, recordingGapSec: 30, pauseSec: 0, totalSec: 30 }]);
  });

  it('attributes a pause-kind gap to pauseSec, not recordingGapSec', () => {
    const splits = [makeSplit(1, 0, 100)];
    const gap = makeGap(10, 40, 'pause'); // 30s
    const result = splitGapAnnotations(splits, [gap]);
    expect(result).toEqual<SplitGapAnnotation[]>([{ km: 1, recordingGapSec: 0, pauseSec: 30, totalSec: 30 }]);
  });

  it('a gap partially overlapping a split contributes only the overlapping seconds, not the whole gap', () => {
    const splits = [makeSplit(1, 0, 100), makeSplit(2, 100, 200)];
    // Gap spans [180, 220] — only [180, 200] (20s) falls inside km 2's window; the
    // remaining 20s ([200, 220]) is outside any split entirely.
    const gap = makeGap(180, 220, 'recording-gap');
    const result = splitGapAnnotations(splits, [gap]);
    expect(result).toEqual<SplitGapAnnotation[]>([{ km: 2, recordingGapSec: 20, pauseSec: 0, totalSec: 20 }]);
  });

  it('accumulates overlap across multiple gaps of mixed kind touching the same split', () => {
    const splits = [makeSplit(1, 0, 100)];
    const gaps = [makeGap(10, 20, 'recording-gap'), makeGap(50, 65, 'pause')];
    const result = splitGapAnnotations(splits, gaps);
    expect(result).toEqual<SplitGapAnnotation[]>([{ km: 1, recordingGapSec: 10, pauseSec: 15, totalSec: 25 }]);
  });

  it('returns entries in km ascending order, matching the input split order', () => {
    const splits = [makeSplit(1, 0, 100), makeSplit(2, 100, 200), makeSplit(3, 200, 300)];
    const gaps = [makeGap(210, 220, 'recording-gap'), makeGap(10, 20, 'pause')];
    const result = splitGapAnnotations(splits, gaps);
    expect(result.map((entry) => entry.km)).toEqual([1, 3]);
  });

  it('negative case 4 (permanent, two-directional): an empty gapIntervals array yields no annotations, while the SAME splits with a real gap interval yields one — marking removed produces zero, not vacuously', () => {
    const splits = [makeSplit(1, 0, 100), makeSplit(2, 100, 200)];
    const realGap = makeGap(50, 80, 'recording-gap');

    // CAN FAIL direction: marking removed (empty gapIntervals) must produce
    // nothing — no marker, no legend possible downstream.
    expect(splitGapAnnotations(splits, [])).toEqual([]);

    // CAN PASS direction: the identical splits, with the real gap interval
    // restored, must produce exactly one annotation — proving the empty
    // result above is not simply "this function always returns []".
    expect(splitGapAnnotations(splits, [realGap])).toEqual<SplitGapAnnotation[]>([
      { km: 1, recordingGapSec: 30, pauseSec: 0, totalSec: 30 },
    ]);
  });

  it('emits no entry for a split with zero overlap', () => {
    const splits = [makeSplit(1, 0, 100), makeSplit(2, 100, 200)];
    const gap = makeGap(300, 400, 'recording-gap'); // outside both splits entirely
    expect(splitGapAnnotations(splits, [gap])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Real archive activity — resolves plan 26-10's checkpoint row 2 (D-09/PACE-05)
// ---------------------------------------------------------------------------

describe('splitGapAnnotations — real activity 10198771331 (gap-crossing split, pinned by pace-fixtures.ts)', () => {
  it('flags exactly km 11 with the 688s recording gap (plus 1s of pause boundary noise), for a stated 11:29 legend duration', () => {
    const stream = loadStream('10198771331');
    const derived = derivePaceWithCoverage(stream);
    const splits = computeSplits(stream);
    const annotations = splitGapAnnotations(splits, derived.coverage.gapIntervals);

    expect(annotations).toHaveLength(1);
    expect(annotations[0].km).toBe(11);
    expect(annotations[0].recordingGapSec).toBe(688);
    expect(annotations[0].pauseSec).toBe(1);
    expect(annotations[0].totalSec).toBe(689);

    // 689s = 11 minutes 29 seconds — the exact legend string plan 26-10's
    // human checkpoint row must read back on screen.
    const minutes = Math.floor(annotations[0].totalSec / 60);
    const seconds = annotations[0].totalSec % 60;
    const durationText = `${minutes}:${String(seconds).padStart(2, '0')}`;
    expect(durationText).toBe('11:29');
    expect(`Km ${annotations[0].km}: includes ${durationText} of recording gap`).toBe(
      'Km 11: includes 11:29 of recording gap'
    );
  });
});

// ---------------------------------------------------------------------------
// breakdownSectionPlan — D-08 always-on coverage caption (CR-01 regression)
// ---------------------------------------------------------------------------

describe('breakdownSectionPlan — D-08 always-on coverage caption (CR-01 regression)', () => {
  it('renders the pace heading and caption for real activity 11865310195 even though its histogram is empty, from a hand-built fixture', () => {
    const coverage = makeCoverage({
      spanSec: 18,
      coveredSec: 6,
      recordingGapSec: 12,
      pauseSec: 0,
      gapIntervals: [makeGap(2, 14, 'recording-gap')],
    });

    const plan = breakdownSectionPlan([], coverage, null);

    expect(plan).not.toBeNull();
    expect(plan!.captionText).toBe('33% of elapsed time covered · 67% recording gaps · 0% paused');
    expect(plan!.showPaceHeading).toBe(true);
    expect(plan!.showBars).toBe(false);
    expect(plan!.showHrZones).toBe(false);
  });

  it('renders the same caption from the real committed stream 11865310195, not just a synthetic look-alike', () => {
    const stream = loadStream('11865310195');
    const derived = derivePaceWithCoverage(stream);

    expect(derived.coverage.spanSec).toBe(18);
    expect(derived.coverage.coveredSec).toBe(6);
    expect(derived.coverage.recordingGapSec).toBe(12);

    const plan = breakdownSectionPlan([], derived.coverage, null);
    expect(plan).not.toBeNull();
    expect(plan!.captionText).toBe('33% of elapsed time covered · 67% recording gaps · 0% paused');
  });

  it('returns null when there is no coverage, no buckets, and no zone times — nothing to show, nothing rendered', () => {
    expect(breakdownSectionPlan([], null, null)).toBeNull();
  });

  it('returns null on a zero-span coverage (cannot fail guard): a zero span is not captionable, so this must not become a heading over an empty card', () => {
    const coverage = makeCoverage({ spanSec: 0 });
    expect(breakdownSectionPlan([], coverage, null)).toBeNull();
  });

  it('renders the all-gap edge case with a deliberate 0% caption and a 0:00 note', () => {
    const coverage = makeCoverage({ spanSec: 100, coveredSec: 0, recordingGapSec: 100, pauseSec: 0 });
    const plan = breakdownSectionPlan([], coverage, null);

    expect(plan).not.toBeNull();
    expect(plan!.captionText).toBe('0% of elapsed time covered · 100% recording gaps · 0% paused');
    expect(plan!.noteText).toContain('0:00');
  });

  it('does not invert into "caption always, bars never": buckets whose timeSec sums to coveredSec show bars, a caption, and no note', () => {
    const coverage = makeCoverage({ spanSec: 100, coveredSec: 100, recordingGapSec: 0, pauseSec: 0 });
    const buckets = [makeBucket({ timeSec: 60 }), makeBucket({ timeSec: 40 })];
    const plan = breakdownSectionPlan(buckets, coverage, null);

    expect(plan).not.toBeNull();
    expect(plan!.showBars).toBe(true);
    expect(plan!.captionText).not.toBeNull();
    expect(plan!.noteText).toBeNull();
  });

  it('D-31 re-pinned at the fix site: the plan for real activity 11865310195 carries showHrZones false and no HR-related copy', () => {
    const coverage11865310195 = makeCoverage({
      spanSec: 18,
      coveredSec: 6,
      recordingGapSec: 12,
      pauseSec: 0,
      gapIntervals: [makeGap(2, 14, 'recording-gap')],
    });
    const plan = breakdownSectionPlan([], coverage11865310195, null);

    expect(plan!.showHrZones).toBe(false);
    expect(plan!.noteText).not.toMatch(/HR|heart rate/i);
    expect(plan!.captionText).not.toMatch(/HR|heart rate/i);
  });
});

// ---------------------------------------------------------------------------
// Source wiring — text-scan guards, no DOM builder invoked (node environment)
// ---------------------------------------------------------------------------

const VIEWS_DIR = new URL('./', import.meta.url);

function readSource(relativePath: string): string {
  return fs.readFileSync(new URL(relativePath, VIEWS_DIR), 'utf8');
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const detailSectionsStripped = stripComments(readSource('detail-sections.ts'));
const detailStripped = stripComments(readSource('detail.ts'));

describe('source wiring — detail-sections.ts / detail.ts (text-structure guard, no DOM)', () => {
  it('detail-sections.ts exports both coverageCaptionText and splitGapAnnotations exactly once each', () => {
    expect(countOccurrences(detailSectionsStripped, 'export function coverageCaptionText')).toBe(1);
    expect(countOccurrences(detailSectionsStripped, 'export function splitGapAnnotations')).toBe(1);
  });

  it('detail-sections.ts calls coverageCaptionText exactly once, from within breakdownSectionPlan', () => {
    // The definition line reads `coverageCaptionText(coverage: PaceCoverage)`
    // — the ":" makes it distinct from an actual call site `coverageCaptionText(coverage)`.
    expect(countOccurrences(detailSectionsStripped, 'coverageCaptionText(coverage)')).toBe(1);

    const breakdownPlanStart = detailSectionsStripped.indexOf('export function breakdownSectionPlan');
    const callOffset = detailSectionsStripped.indexOf('coverageCaptionText(coverage)');
    expect(breakdownPlanStart).toBeGreaterThanOrEqual(0);
    expect(callOffset).toBeGreaterThan(breakdownPlanStart);
  });

  it('buildSplitsSection accepts a gapAnnotations parameter (D-09 wiring point)', () => {
    expect(detailSectionsStripped).toContain('gapAnnotations: readonly SplitGapAnnotation[]');
  });

  it('the split-gap marker glyph is aria-hidden and never the sole signal (accessibility constraint)', () => {
    expect(detailSectionsStripped).toContain("marker.setAttribute('aria-hidden', 'true')");
    expect(detailSectionsStripped).toContain("paceCell.setAttribute('aria-label'");
  });

  it('detail.ts calls splitGapAnnotations and passes the result directly into buildSplitsSection, consuming the same derived.coverage.gapIntervals the histogram is built from', () => {
    // 26-08 (D-13) reformatted this call across multiple lines to add the
    // rebased-average and isRebasedAverage arguments, so this is a
    // proximity check (all four pieces present, in order, within one call
    // site) rather than a single-line literal match.
    const callSiteIndex = detailStripped.indexOf('buildSplitsSection(');
    expect(callSiteIndex).toBeGreaterThanOrEqual(0);
    const callSite = detailStripped.slice(callSiteIndex, callSiteIndex + 300);
    expect(callSite).toContain('splits,');
    expect(callSite).toContain('splitGapAnnotations(splits, derived.coverage.gapIntervals)');
  });

  it('detail.ts passes derived.coverage (not a second, independently-derived value) to buildBreakdownSection', () => {
    expect(detailStripped).toContain('buildBreakdownSection(buckets, derived.coverage, zoneTimes)');
  });

  // ---------------------------------------------------------------------
  // D-13 (26-08, PACE-07) — the rebased vs. Avg baseline for a flagged
  // activity. The DOM builder cannot be invoked in this node-environment
  // suite, so the wiring is pinned as a comment-stripped source scan
  // instead — the same idiom this file already uses above.
  // ---------------------------------------------------------------------

  it('D-13 wiring: detail.ts derives the buildSplitsSection average from the disagreement branch — the stream-derived pace when flagged, the metadata pace otherwise', () => {
    expect(detailStripped).toContain(
      'const rebasedAveragePaceSecPerKm = disagreement !== null ? disagreement.streamPaceSecPerKm : paceSecPerKm;'
    );
  });

  it('D-13 wiring: detail.ts passes both rebasedAveragePaceSecPerKm and the disagreement!==null flag into the SAME buildSplitsSection call already asserted above', () => {
    const callSiteIndex = detailStripped.indexOf('buildSplitsSection(');
    expect(callSiteIndex).toBeGreaterThanOrEqual(0);
    const callSite = detailStripped.slice(callSiteIndex, callSiteIndex + 300);
    expect(callSite).toContain('rebasedAveragePaceSecPerKm');
    expect(callSite).toContain('disagreement !== null');
  });

  it('D-13 wiring: buildSplitsSection accepts the isRebasedAverage flag and builds its caption note from the SAME activityAvgPaceSecPerKm argument already in scope, not a re-derived value', () => {
    expect(detailSectionsStripped).toContain('isRebasedAverage: boolean = false');
    expect(detailSectionsStripped).toContain('isRebasedAverage && activityAvgPaceSecPerKm !== null');
    expect(detailSectionsStripped).toContain('formatPace(activityAvgPaceSecPerKm)');
  });

  it('D-13 caption-note copy string is present verbatim in detail-sections.ts', () => {
    expect(detailSectionsStripped).toContain(
      'Splits above are compared against the stream-derived average'
    );
    expect(detailSectionsStripped).toContain('not the disputed metadata average.');
  });

  it('negative case 4 (marking removed) is pinned permanently in this suite, not just described', () => {
    // Self-referential guard: confirms the empty-gapIntervals direction of
    // negative case 4 actually lives in this file's own source, so a future
    // edit cannot silently delete it without this assertion catching it.
    const thisFileSource = stripComments(readSource('detail-sections.test.ts'));
    expect(thisFileSource).toContain('splitGapAnnotations(splits, [])');
  });
});

// ---------------------------------------------------------------------------
// buildPrFlagsCell wiring (source guard) — Phase 28, plan 28-04, D-09.
// `buildPrFlagsCell` cannot itself be invoked in this node-environment
// suite (no DOM-simulation library exists anywhere in this tree), so its
// wiring is pinned by isolating the function's own body from a
// comment-stripped source read and asserting on that slice directly. This
// mirrors the `source wiring` describe block above.
// ---------------------------------------------------------------------------

function isolateFunctionBody(source: string, declarationNeedle: string): string {
  const start = source.indexOf(declarationNeedle);
  if (start < 0) {
    throw new Error(`isolateFunctionBody: declaration not found: ${declarationNeedle}`);
  }
  const nextTopLevelFunction = /\n(export )?function /g;
  nextTopLevelFunction.lastIndex = start + declarationNeedle.length;
  const nextMatch = nextTopLevelFunction.exec(source);
  const end = nextMatch ? nextMatch.index : source.length;
  return source.slice(start, end);
}

describe('buildPrFlagsCell wiring (source guard)', () => {
  const buildPrFlagsCellBody = isolateFunctionBody(detailSectionsStripped, 'function buildPrFlagsCell(');

  it('the body contains exactly one prFlagBadgeSpecs( call', () => {
    expect(countOccurrences(buildPrFlagsCellBody, 'prFlagBadgeSpecs(')).toBe(1);
  });

  it('the body contains exactly one appendAccessibleBadge( call and zero appendBadge( calls', () => {
    expect(countOccurrences(buildPrFlagsCellBody, 'appendAccessibleBadge(')).toBe(1);
    expect(countOccurrences(buildPrFlagsCellBody, 'appendBadge(')).toBe(0);
  });

  it('the body contains zero occurrences of the literal badge-text strings — every string now lives in prFlagBadgeSpecs', () => {
    expect(buildPrFlagsCellBody).not.toContain('Excluded');
    expect(buildPrFlagsCellBody).not.toContain("PR'");
    expect(buildPrFlagsCellBody).not.toContain('Demoted');
    expect(buildPrFlagsCellBody).not.toContain('Low confidence');
  });

  it('the body contains zero if ( statements — it decides nothing, it only renders', () => {
    expect(countOccurrences(buildPrFlagsCellBody, 'if (')).toBe(0);
  });

  it('the description id passed to appendAccessibleBadge is built from both row.distance and spec.descriptionIdSuffix, so two badges in one cell cannot collide on one id', () => {
    expect(buildPrFlagsCellBody).toContain('${row.distance}-${spec.descriptionIdSuffix}');
  });
});

// ---------------------------------------------------------------------------
// qualitySignalsSectionPlan — quality signals section (Phase 27, plan 27-09:
// QUAL-01, QUAL-04, ERA-02). Only the pure plan is tested — there is no
// DOM-simulation dependency anywhere in this tree, so `buildQualitySignalsSection`
// (the emitter) cannot itself be invoked here; that mirrors this file's own
// existing header comment about `buildBreakdownSection`/`buildSplitsSection`.
// ---------------------------------------------------------------------------

const HEALTHY_QUALITY: ActivityQualitySignals = {
  decimation: { tier: 'none', zeroAdvanceFraction: 0.01, sampleCount: 500 },
  gapProfile: { tier: 'none', gapFraction: 0, recordingGapSec: 0, pauseSec: 0, spanSec: 1000 },
  impossibleSamples: { tier: 'none', count: 0, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: 0 },
  deviceEra: { family: 'garmin-fenix-6-pro', rawDeviceName: null },
  elapsedVsMoving: { ratio: 1.01, elapsedSec: 1010, movingSec: 1000 },
  anySevere: false,
  notComputableReason: null,
};

const NOT_COMPUTABLE_QUALITY: ActivityQualitySignals = {
  decimation: { tier: 'not-computable', zeroAdvanceFraction: null, sampleCount: null },
  gapProfile: { tier: 'not-computable', gapFraction: null, recordingGapSec: null, pauseSec: null, spanSec: null },
  impossibleSamples: { tier: 'not-computable', count: null, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: null },
  deviceEra: { family: 'no-device-name', rawDeviceName: null },
  elapsedVsMoving: { ratio: null, elapsedSec: null, movingSec: null },
  anySevere: false,
  notComputableReason: 'no stream committed for this activity',
};

function makeShard(overrides: Partial<PaceQualityShard>): PaceQualityShard {
  return {
    activityId: 'test-activity',
    signals: HEALTHY_QUALITY,
    gapIntervals: [],
    impossibleSamples: [],
    impossibleSamplesTruncated: false,
    zeroAdvanceRunProfile: null,
    adaptiveWindowSec: null,
    notComputableReason: null,
    ...overrides,
  };
}

describe('qualitySignalsSectionPlan — quality signals section (D-08, D-09, D-12, D-17)', () => {
  it('a fully healthy row produces five rows, all three tiering rows carrying an explicit healthy statement, none blank/undefined/null/NaN', () => {
    const plan = qualitySignalsSectionPlan(HEALTHY_QUALITY, null);
    expect(plan.rows).toHaveLength(5);

    for (const row of plan.rows) {
      expect(row.valueText.length).toBeGreaterThan(0);
      expect(row.valueText).not.toContain('undefined');
      expect(row.valueText).not.toContain('null');
      expect(row.valueText).not.toContain('NaN');
    }

    const [decimation, gapProfile, impossibleSamples] = plan.rows;
    expect(decimation.valueText).toBe('No decimation detected');
    expect(decimation.tier).toBe('none');
    expect(gapProfile.valueText).toBe('No recording gaps');
    expect(gapProfile.tier).toBe('none');
    expect(impossibleSamples.valueText).toBe('No impossible samples');
    expect(impossibleSamples.tier).toBe('none');
  });

  it('a row severe on gapProfile with a shard: the gap row names the percentage and its evidenceText carries a figure from shard.gapIntervals; evidenceText is absent when shard is null', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      gapProfile: { tier: 'severe', gapFraction: 0.2655, recordingGapSec: 2112, pauseSec: 1, spanSec: 7958 },
      anySevere: true,
    };

    const withoutShard = qualitySignalsSectionPlan(quality, null);
    const gapRowNoShard = withoutShard.rows[1];
    expect(gapRowNoShard.valueText).toBe('27% of recorded time in gaps or pauses');
    expect(gapRowNoShard.tier).toBe('severe');
    expect(gapRowNoShard.evidenceText).toBeNull();

    const shard = makeShard({
      signals: quality,
      gapIntervals: [
        { startSec: 78, endSec: 127, kind: 'recording-gap' },
        { startSec: 4766, endSec: 5769, kind: 'recording-gap' },
      ],
    });
    const withShard = qualitySignalsSectionPlan(quality, shard);
    const gapRowWithShard = withShard.rows[1];
    expect(gapRowWithShard.valueText).toBe('27% of recorded time in gaps or pauses');
    expect(gapRowWithShard.evidenceText).not.toBeNull();
    expect(gapRowWithShard.evidenceText).toContain('2 gap intervals');
    expect(gapRowWithShard.evidenceText).toContain('16:43'); // longest interval, 1003s
  });

  it('a not-computable row: all three tiering rows read "Not computable — {reason}" with tier not-computable, and NO row reads 0% or a healthy statement', () => {
    const plan = qualitySignalsSectionPlan(NOT_COMPUTABLE_QUALITY, null);
    const [decimation, gapProfile, impossibleSamples] = plan.rows;

    for (const row of [decimation, gapProfile, impossibleSamples]) {
      expect(row.valueText).toBe('Not computable — no stream committed for this activity');
      expect(row.tier).toBe('not-computable');
      expect(row.valueText).not.toContain('0%');
      expect(row.valueText).not.toBe('No decimation detected');
      expect(row.valueText).not.toBe('No recording gaps');
      expect(row.valueText).not.toBe('No impossible samples');
    }
  });

  it('quality === null: the section plan is still produced (never null/undefined) and says so', () => {
    const plan = qualitySignalsSectionPlan(null, null);
    expect(plan).not.toBeNull();
    expect(plan.rows).toHaveLength(5);
    for (const row of plan.rows) {
      expect(row.valueText).toBe('Quality data not available for this activity');
    }
  });

  const DEVICE_FAMILY_EXPECTATIONS: [DeviceFamilyKind, string][] = [
    ['garmin-fenix-6-pro', 'Garmin fēnix 6 Pro'],
    ['suunto-9', 'Suunto 9'],
    ['garmin-vivoactive-4', 'Garmin vívoactive 4'],
    ['strava-app-gpx', 'Strava App'],
    ['intervals-icu', 'intervals.icu (migrated)'],
    ['no-device-name', 'No device name recorded'],
  ];

  it.each(DEVICE_FAMILY_EXPECTATIONS)('device family %s maps to a distinct display string: %s', (family, expected) => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      deviceEra: { family, rawDeviceName: null },
    };
    const plan = qualitySignalsSectionPlan(quality, null);
    const deviceRow = plan.rows[3];
    expect(deviceRow.valueText).toBe(expected);
  });

  it('unrecognized-device includes the raw string verbatim, and an XSS-shaped payload survives into valueText unescaped', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      deviceEra: { family: 'unrecognized-device', rawDeviceName: payload },
    };
    const plan = qualitySignalsSectionPlan(quality, null);
    const deviceRow = plan.rows[3];
    expect(deviceRow.valueText).toBe(`Unrecognized device: ${payload}`);
  });

  it('all seven DeviceFamilyKind values map to distinct display strings (including unrecognized-device)', () => {
    const allFamilies: DeviceFamilyKind[] = [
      'garmin-fenix-6-pro',
      'suunto-9',
      'garmin-vivoactive-4',
      'strava-app-gpx',
      'intervals-icu',
      'no-device-name',
      'unrecognized-device',
    ];
    const displayNames = allFamilies.map((family) => {
      const quality: ActivityQualitySignals = {
        ...HEALTHY_QUALITY,
        deviceEra: { family, rawDeviceName: family === 'unrecognized-device' ? 'Some Watch X1' : null },
      };
      return qualitySignalsSectionPlan(quality, null).rows[3].valueText;
    });
    expect(new Set(displayNames).size).toBe(allFamilies.length);
  });

  it('the three tiering explanation strings are identical to the ones list.ts exports via qualityBadgeSpecs — a drift between the two surfaces fails this test', () => {
    // Imports EXPLANATION_PROBE_QUALITY from detail-sections.ts itself
    // (G-05, 27-REVIEW.md WR-01) rather than hand-typing a second copy of
    // the same literal here — this test now exercises the SAME object
    // production's EXPLANATION_PROBE_SPECS is built from, so the two
    // sides cannot silently diverge from each other.
    const listSpecs = qualityBadgeSpecs({ quality: EXPLANATION_PROBE_QUALITY });
    const sectionRows = qualitySignalsSectionPlan(EXPLANATION_PROBE_QUALITY, null).rows;

    const bySignal = new Map(listSpecs.map((spec) => [spec.signal, spec.explanation]));
    expect(sectionRows[0].explanation).toBe(bySignal.get('decimation'));
    expect(sectionRows[1].explanation).toBe(bySignal.get('gapProfile'));
    expect(sectionRows[2].explanation).toBe(bySignal.get('impossibleSamples'));
  });

  it('G-05: the three tiering explanation strings are directly asserted non-empty, not only compared for equality against list.ts (the equality check above would pass even if BOTH sides were "")', () => {
    const sectionRows = qualitySignalsSectionPlan(EXPLANATION_PROBE_QUALITY, null).rows;
    expect(sectionRows[0].explanation.length, 'decimation row explanation must not be empty').toBeGreaterThan(0);
    expect(sectionRows[1].explanation.length, 'gapProfile row explanation must not be empty').toBeGreaterThan(0);
    expect(
      sectionRows[2].explanation.length,
      'impossibleSamples row explanation must not be empty'
    ).toBeGreaterThan(0);
  });

  it('the impossible-samples row names the fastest implied speed from shard.impossibleSamples and the zero-advance-run overlap, absent when shard is null', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      impossibleSamples: { tier: 'severe', count: 11, maxImpliedSpeedMps: 15.2, countInsideZeroAdvanceRun: 3 },
      anySevere: true,
    };

    const withoutShard = qualitySignalsSectionPlan(quality, null);
    expect(withoutShard.rows[2].evidenceText).toBeNull();

    const shard = makeShard({
      signals: quality,
      impossibleSamples: [
        { index: 10, impliedSpeedMps: 12.1, dtSec: 1, ddM: 12.1 },
        { index: 20, impliedSpeedMps: 15.2, dtSec: 1, ddM: 15.2 },
      ],
    });
    const withShard = qualitySignalsSectionPlan(quality, shard);
    expect(withShard.rows[2].evidenceText).toContain('15.2 m/s');
    expect(withShard.rows[2].evidenceText).toContain('3 of these fall inside a zero-advance run');
  });

  it('the decimation row names the longest zero-advance run and the resolved adaptive window from the shard, absent when shard is null', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      decimation: { tier: 'severe', zeroAdvanceFraction: 0.2033, sampleCount: 200 },
      anySevere: true,
    };

    const withoutShard = qualitySignalsSectionPlan(quality, null);
    expect(withoutShard.rows[0].evidenceText).toBeNull();

    const shard = makeShard({
      signals: quality,
      zeroAdvanceRunProfile: { runCount: 4, longestRunSamples: 12, longestRunSec: 48, medianRunSamples: 3, p90RunSec: 30 },
      adaptiveWindowSec: 20,
    });
    const withShard = qualitySignalsSectionPlan(quality, shard);
    expect(withShard.rows[0].evidenceText).toContain('12 samples');
    expect(withShard.rows[0].evidenceText).toContain('48.0s');
    expect(withShard.rows[0].evidenceText).toContain('adaptive window 20.0s');
  });

  it('elapsedVsMoving reports an explicit unavailable statement rather than a fabricated ratio when null', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      elapsedVsMoving: { ratio: null, elapsedSec: null, movingSec: null },
    };
    const plan = qualitySignalsSectionPlan(quality, null);
    expect(plan.rows[4].valueText).toBe('Elapsed/moving ratio not available');
    expect(plan.rows[4].tier).toBe('untiered');
  });

  it('deviceEra and elapsedVsMoving carry the untiered tier value, never one of the four QualityTier members', () => {
    const plan = qualitySignalsSectionPlan(HEALTHY_QUALITY, null);
    expect(plan.rows[3].tier).toBe('untiered');
    expect(plan.rows[4].tier).toBe('untiered');
  });
});

describe('deviceFamilyDisplayName exhaustive switch (ERA-02, Criterion 5) — no default branch', () => {
  it('the switch(family) mapping in detail-sections.ts has zero default branches', () => {
    const source = readSource('detail-sections.ts');
    const switchIndex = source.indexOf('switch (family)');
    expect(switchIndex).toBeGreaterThanOrEqual(0);
    const switchBlock = source.slice(switchIndex, switchIndex + 1500);
    // Bounded to the switch statement itself (up to the next top-level
    // closing brace at the same indent), not the whole file.
    const closeIndex = switchBlock.indexOf('\n}');
    const bounded = closeIndex >= 0 ? switchBlock.slice(0, closeIndex) : switchBlock;
    expect(bounded).not.toContain('default:');
  });
});
