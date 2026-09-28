/**
 * DOM section renderers for the activity detail page — the per-km splits
 * table and the pace-distribution / HR-zone breakdown (DETAIL-04, DETAIL-05,
 * BROWSE-06). Pure rendering: every number displayed here is already
 * computed and unit-tested in `detail-splits.ts` (plan 17-04) and
 * `detail-zones.ts` (plan 17-05) — this module contains no arithmetic beyond
 * formatting and bar-width percentages.
 *
 * Both breakdowns are hand-rolled accessible DOM bars, NOT Chart.js canvases
 * (17-UI-SPEC.md § 4e) — that keeps this module out of the lazy chart chunk
 * entirely and makes the numbers readable by assistive tech.
 *
 * Kept out of `detail.ts` so plan 17-14's orchestrator stays small and this
 * work can run in parallel with the map and chart modules in the same wave.
 */

import type { Split } from './detail-splits.js';
import type { PaceBucket, ZoneTime } from './detail-zones.js';
// formatPace, formatDurationHms, formatEffortDuration, appendAccessibleBadge,
// and qualityBadgeSpecs are the dashboard's only pace/duration/badge
// builders (list.ts) — imported rather than duplicated, matching the
// precedent detail.ts already set for formatPace. `qualityBadgeSpecs` is
// imported ONLY to source the three tiering signals' explanation strings at
// module load (see `EXPLANATION_PROBE_SPECS` below) — never called
// per-render — so the always-on Quality Signals section cannot drift from
// the severe-tier list badges' own explanation text (Phase 27, plan 27-09's
// interface contract). `appendBadge`/`appendLowConfidenceBadge` are no
// longer imported here — plan 28-04 moved `buildPrFlagsCell` onto
// `prFlagBadgeSpecs` + `appendAccessibleBadge` exclusively (D-09).
import {
  formatPace,
  formatDurationHms,
  formatEffortDuration,
  appendAccessibleBadge,
  qualityBadgeSpecs,
  unreliableSegmentsBadgeContent,
  formatMetres,
} from './list.js';
import { prFlagBadgeSpecs, type BestEffortPanelRow, type PrFlagBadgeSpec } from './detail-best-efforts-logic.js';
import type { PaceCoverage, GapInterval } from '../../analytics/pace-derivation.js';
import { unbucketedCoveredSec } from '../../analytics/pace-derivation.js';
import type { RunningPaceRow } from '../../analytics/dashboard-index.types.js';
import type {
  ActivityQualitySignals,
  ClosureDriftSignal,
  DecimationSignal,
  DeviceEraSignal,
  ElapsedVsMovingSignal,
  ElevationSignal,
  ForgottenStopSignal,
  GapProfileSignal,
  ImpossibleSampleSignal,
  PaceQualityShard,
  PauseClassificationSignal,
  QualityTier,
  SubGroundSignal,
  UnreliableSegmentsSignal,
  VerticalRateSignal,
} from '../../analytics/pace-quality.js';
import { SHARD_LIST_CAP } from '../../analytics/pace-quality.js';
import type { PauseClass, PauseSource } from '../../analytics/pause-classification.js';

// Same em dash as `DASH` in detail.ts. Defined locally rather than imported:
// detail.ts imports THIS module, so importing back would create a cycle.
// Both copies must stay identical — see detail.ts's own `DASH` constant.
const DASH = '—';

/**
 * Coverage caption text for the `Pace Distribution` heading (D-08, D-10,
 * COV-02, COV-03). Reads directly from the same `PaceCoverage` the
 * histogram beside it is built from — never recomputed independently — so
 * the two cannot drift apart (D-16's structural guarantee made visible on
 * screen).
 *
 * Returns `null` when `spanSec` is not positive (no stream, or a
 * zero-length span); the caller then appends nothing. Otherwise always
 * renders all FOUR named segments — covered, recording gaps, paused,
 * unreliable — even at 0%, so a clean run states its own health rather than
 * the reader inferring it from an absent line (D-08's always-on
 * requirement, extended by D-10 to the fourth term: an absent unreliable
 * clause would stop meaning "zero" and start meaning "unknown", the exact
 * ambiguity D-08 already forbids for the first three terms).
 *
 * Each percentage is `Math.round`ed INDEPENDENTLY from `coverage.coveredSec
 * / coverage.spanSec`, etc. The four rounded integers may not sum to
 * exactly 100 (a cosmetic display artifact of independent rounding) — this
 * is deliberate and must never be "corrected" by forcing a 100% total,
 * which would falsify one of the individual category values against
 * COV-01's exact-second sum (asserted on the unrounded seconds elsewhere).
 * This applies identically to the new fourth term: `unreliablePercent` is
 * never normalised against the other three.
 */
export function coverageCaptionText(coverage: PaceCoverage): string | null {
  if (coverage.spanSec <= 0) return null;

  const coveredPercent = Math.round((coverage.coveredSec / coverage.spanSec) * 100);
  const recordingGapPercent = Math.round((coverage.recordingGapSec / coverage.spanSec) * 100);
  const pausePercent = Math.round((coverage.pauseSec / coverage.spanSec) * 100);
  const unreliablePercent = Math.round((coverage.unreliableSec / coverage.spanSec) * 100);

  return `${coveredPercent}% of elapsed time covered · ${recordingGapPercent}% recording gaps · ${pausePercent}% paused · ${unreliablePercent}% unreliable`;
}

/**
 * One split's accumulated overlap with the stream's gap intervals (D-09,
 * PACE-05). `recordingGapSec`, `pauseSec` and `unreliableSec` are
 * accumulated separately since a split's window can cross more than one
 * gap, of mixed kinds; `totalSec` is their three-term sum, the exact
 * quantity the marker/legend states.
 */
export interface SplitGapAnnotation {
  km: number;
  recordingGapSec: number;
  pauseSec: number;
  unreliableSec: number;
  totalSec: number;
}

/**
 * For each split, intersects its `[startTimeSec, endTimeSec]` window with
 * every entry in `gapIntervals`, accumulating overlapping seconds per
 * `kind`. Emits an entry only when the split's total overlap is positive —
 * a split with no gap overlap produces no marker, no legend line, and no
 * entry here at all.
 *
 * Total: an empty `gapIntervals` array (or a `splits` list with no
 * overlapping window) yields an empty result — exactly the "marking
 * removed" state negative case 4 pins in-suite.
 *
 * Consumes `PaceCoverage.gapIntervals` from the shared
 * `derivePaceWithCoverage` result; this function does not itself decide
 * what counts as a gap — that classification lives entirely in
 * `pace-derivation.ts` (PACE-01's single-derivation guarantee).
 *
 * Returned in `km` ascending order, matching the order `splits` is already
 * iterated in.
 */
export function splitGapAnnotations(
  splits: readonly Split[],
  gapIntervals: readonly GapInterval[]
): SplitGapAnnotation[] {
  const result: SplitGapAnnotation[] = [];

  for (const split of splits) {
    let recordingGapSec = 0;
    let pauseSec = 0;
    let unreliableSec = 0;

    for (const gap of gapIntervals) {
      const overlapStart = Math.max(split.startTimeSec, gap.startSec);
      const overlapEnd = Math.min(split.endTimeSec, gap.endSec);
      const overlapSec = overlapEnd - overlapStart;
      if (overlapSec > 0) {
        // Explicit three-way branch (D-09). Before Phase 33 this was a
        // two-way `if (gap.kind === 'recording-gap') ... else pauseSec +=
        // overlapSec`, which silently swallowed ANY non-recording-gap kind
        // into pauseSec — once `GapKind` widened to include `'unreliable'`
        // (D-01/D-02), that `else` branch would have disclosed an unreliable
        // interval to the user as an ordinary pause, a wrong disclosure, not
        // a cosmetic defect.
        if (gap.kind === 'recording-gap') {
          recordingGapSec += overlapSec;
        } else if (gap.kind === 'pause') {
          pauseSec += overlapSec;
        } else {
          unreliableSec += overlapSec;
        }
      }
    }

    const totalSec = recordingGapSec + pauseSec + unreliableSec;
    if (totalSec > 0) {
      result.push({ km: split.km, recordingGapSec, pauseSec, unreliableSec, totalSec });
    }
  }

  return result;
}

/**
 * Picks the single named category ("unreliable segment", "recording gap" or
 * "pause") a mixed split annotation is described by, for the marker
 * `aria-label` and the legend line (both carry exactly one category name
 * per the UI-SPEC's copy contract, widened by D-09).
 *
 * `unreliableSec > 0` is checked FIRST and wins unconditionally, before the
 * existing magnitude comparison — a split holding a 200s pause and a 2.7s
 * isolated jump would, under pure magnitude, name only the pause and never
 * mention the jump that corrupted that split's pace. D-09 rejected both a
 * second marker per split and a three-way magnitude comparison: unreliable
 * time is a data-integrity concern the reader must always see, not merely
 * the largest one.
 *
 * Below that, today's rule is unchanged byte-for-byte: the larger
 * accumulated duration between `recordingGapSec` and `pauseSec` wins; a tie
 * (including the common case of one category being exactly 0) favours
 * `recording-gap`, since a stopped recording is the more significant
 * disclosure of the two categories.
 *
 * Exported (Phase 33) solely so `detail-sections.test.ts` can pin the exact
 * worked-example priority rule directly — this module's own file-header
 * comment establishes there is no DOM-simulation dependency in this tree, so
 * the marker/legend copy this function drives (only reachable through
 * `buildSplitsSection`, a DOM builder) could not otherwise be unit-tested at
 * all, only re-derived independently inside a test (a strictly weaker check
 * than calling the real function).
 */
export function dominantGapKindLabel(annotation: SplitGapAnnotation): 'unreliable segment' | 'recording gap' | 'pause' {
  if (annotation.unreliableSec > 0) return 'unreliable segment';
  return annotation.recordingGapSec >= annotation.pauseSec ? 'recording gap' : 'pause';
}

/** Builds a `<td>` with plain text content — the default cell shape for every non-bar column. */
function buildTextCell(text: string, className?: string): HTMLTableCellElement {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.textContent = text;
  return cell;
}

/** Formats an elevation delta in metres, signed with an explicit `+` for a gain, or the em dash when absent. */
function formatElevDelta(elevDeltaM: number | null): string {
  if (elevDeltaM === null) return DASH;
  const rounded = Math.round(elevDeltaM);
  const sign = rounded >= 0 ? '+' : '';
  return `${sign}${rounded} m`;
}

/**
 * Builds the `Km` cell for one split row. A full split's text is just its
 * number; the final partial split (D-28) reads
 * `"{n} ({distance} km, partial)"` with distance to one decimal, and carries
 * `.splits-table__partial` for the italic Label treatment — this is what
 * stops a short final segment's pace from being misread as a full split.
 */
function buildKmCell(split: Split): HTMLTableCellElement {
  const className = split.isPartial ? 'splits-table__km splits-table__partial' : 'splits-table__km';
  const text = split.isPartial
    ? `${split.km} (${(split.distanceM / 1000).toFixed(1)} km, partial)`
    : String(split.km);
  return buildTextCell(text, className);
}

/**
 * Builds the `vs. Avg` cell: a `.pace-bar` whose fill extends LEFT from the
 * centred tick when the split is faster than the activity average, and
 * RIGHT when it is slower. The fill width is computed as a percentage of
 * HALF the track — the split's relative pace deviation
 * (`|split - avg| / avg`) as a percentage, capped at 100% of the half so an
 * extreme outlier (e.g. a very short, very slow partial km) cannot overflow
 * the cell. When there is no activity average to compare against, the cell
 * renders the em dash instead of a bar. The `aria-label` states the signed
 * seconds-per-km difference, since a purely visual bar means nothing to
 * assistive tech.
 */
function buildPaceBarCell(split: Split, activityAvgPaceSecPerKm: number | null): HTMLTableCellElement {
  const cell = document.createElement('td');

  if (activityAvgPaceSecPerKm === null || activityAvgPaceSecPerKm <= 0) {
    cell.textContent = DASH;
    return cell;
  }

  const diffSecPerKm = split.paceSecPerKm - activityAvgPaceSecPerKm;
  const roundedDiff = Math.round(diffSecPerKm);
  const diffSign = roundedDiff > 0 ? '+' : roundedDiff < 0 ? '-' : '';
  cell.setAttribute('aria-label', `${diffSign}${Math.abs(roundedDiff)} sec/km vs. average`);

  const bar = document.createElement('div');
  bar.className = 'pace-bar';

  const track = document.createElement('div');
  track.className = 'pace-bar__track';
  bar.appendChild(track);

  const tick = document.createElement('div');
  tick.className = 'pace-bar__tick';
  bar.appendChild(tick);

  if (diffSecPerKm !== 0) {
    // Relative deviation, expressed as a percentage of half the track, capped at 100% of that half.
    const halfTrackPercent = Math.min(100, (Math.abs(diffSecPerKm) / activityAvgPaceSecPerKm) * 100);
    // Converted to a percentage of the FULL track, since the fill's own width is measured against .pace-bar (100% wide).
    const fillWidthPercent = halfTrackPercent / 2;

    const fill = document.createElement('div');
    fill.className = 'pace-bar__fill';
    fill.style.width = `${fillWidthPercent}%`;
    if (diffSecPerKm < 0) {
      // Faster than average: extend left from the centred tick.
      fill.style.left = `${50 - fillWidthPercent}%`;
    } else {
      // Slower than average: extend right from the centred tick.
      fill.style.left = '50%';
    }
    bar.appendChild(fill);
  }

  cell.appendChild(bar);
  return cell;
}

/**
 * Builds the seven-column splits table: `Km | Pace | Elapsed | Avg HR |
 * Avg Cadence | Elev Δ | vs. Avg`. `Elapsed` is the CUMULATIVE elapsed time
 * at the end of each split (`formatDurationHms(split.endTimeSec)`), not a
 * per-split duration — 17-UI-SPEC.md names it "cumulative elapsed time".
 * Columns for channels the stream lacks (`avgHr`/`avgCadence` null) render
 * the em dash instead of breaking.
 *
 * The horizontal-scroll behaviour lives entirely in the `.splits-scroll`
 * CSS from plan 17-01 (D-27's hard requirement) — this function adds no
 * inline style or script that could let the page body scroll horizontally.
 *
 * When `splits` is empty (no stream, or a sub-2-sample stream), returns a
 * named empty state rather than an empty table.
 *
 * `gapAnnotations` (D-09, PACE-05) is optional and defaults to empty — when
 * a split's `km` matches an annotation, the Pace cell gains an inline
 * `⚠` marker (aria-hidden, paired with an `aria-label` stating the amount
 * and category) and the split's own km/duration/category is named in a
 * legend `<ul>` appended after `.splits-scroll`, present only when at least
 * one split is flagged. This adds no eighth column and does not touch any
 * split's own pace arithmetic — the marking is purely additive over
 * `computeSplits`'s existing output (PACE-05's binding constraint).
 *
 * `isRebasedAverage` (D-13, PACE-07) is optional and defaults to `false` —
 * this function does not itself decide when a rebase applies; the caller
 * (`detail.ts`) sets it `true` only on the branch where it already passed
 * the running pace as `activityAvgPaceSecPerKm` in place of the
 * disputed metadata average (D-13 is a call-site change, not a change to
 * `buildPaceBarCell`, which keeps diffing against whatever baseline it is
 * handed). When `true`, a `<p class="text-label">` stating the D-13
 * disclosure sentence verbatim — built here from the SAME
 * `activityAvgPaceSecPerKm` value already in scope, not a re-derived one —
 * is appended below `.splits-scroll`, adjacent to the D-09 gap legend, so a
 * reader who remembers the old metadata pace understands why every split's
 * `vs. Avg` reading changed.
 */
export function buildSplitsSection(
  splits: readonly Split[],
  activityAvgPaceSecPerKm: number | null,
  gapAnnotations: readonly SplitGapAnnotation[] = [],
  isRebasedAverage: boolean = false
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'card detail-section';

  const heading = document.createElement('h2');
  heading.className = 'text-heading';
  heading.textContent = 'Splits';
  section.appendChild(heading);

  if (splits.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-body';
    empty.textContent = 'No per-kilometre splits for this activity.';
    section.appendChild(empty);
    return section;
  }

  const scroll = document.createElement('div');
  scroll.className = 'splits-scroll';

  const table = document.createElement('table');
  table.className = 'splits-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const headers = ['Km', 'Pace', 'Elapsed', 'Avg HR', 'Avg Cadence', 'Elev Δ', 'vs. Avg'];
  for (const headerText of headers) {
    const th = document.createElement('th');
    th.textContent = headerText;
    if (headerText === 'Km') th.className = 'splits-table__km';
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const annotationByKm = new Map(gapAnnotations.map((annotation) => [annotation.km, annotation]));
  const legendLines: string[] = [];

  const tbody = document.createElement('tbody');
  for (const split of splits) {
    const row = document.createElement('tr');
    row.appendChild(buildKmCell(split));

    const paceCell = buildTextCell(formatPace(split.paceSecPerKm));
    const annotation = annotationByKm.get(split.km);
    if (annotation) {
      const kindLabel = dominantGapKindLabel(annotation);
      const durationText = formatEffortDuration(annotation.totalSec);

      const marker = document.createElement('span');
      marker.className = 'split-gap-marker';
      marker.setAttribute('aria-hidden', 'true');
      marker.textContent = ' ⚠';
      paceCell.appendChild(marker);

      paceCell.setAttribute('aria-label', `${formatPace(split.paceSecPerKm)} — includes ${durationText} of ${kindLabel}`);

      legendLines.push(`Km ${split.km}: includes ${durationText} of ${kindLabel}`);
    }
    row.appendChild(paceCell);

    row.appendChild(buildTextCell(formatDurationHms(split.endTimeSec)));
    row.appendChild(buildTextCell(split.avgHr === null ? DASH : String(Math.round(split.avgHr))));
    row.appendChild(buildTextCell(split.avgCadence === null ? DASH : String(Math.round(split.avgCadence))));
    row.appendChild(buildTextCell(formatElevDelta(split.elevDeltaM)));
    row.appendChild(buildPaceBarCell(split, activityAvgPaceSecPerKm));
    tbody.appendChild(row);
  }
  table.appendChild(tbody);

  scroll.appendChild(table);
  section.appendChild(scroll);

  if (legendLines.length > 0) {
    const legend = document.createElement('ul');
    legend.className = 'text-label';
    for (const line of legendLines) {
      const item = document.createElement('li');
      item.textContent = line;
      legend.appendChild(item);
    }
    section.appendChild(legend);
  }

  if (isRebasedAverage && activityAvgPaceSecPerKm !== null) {
    const note = document.createElement('p');
    note.className = 'text-label';
    note.textContent = `Splits above are compared against the running pace (${formatPace(activityAvgPaceSecPerKm)}), not the disputed metadata average.`;
    section.appendChild(note);
  }

  return section;
}

/** Builds one `.distribution__row` shared by both the pace histogram and the HR-zone panel. */
function buildDistributionRow(
  label: string,
  valueText: string,
  ariaLabel: string,
  barWidthPercent: number,
  barModifierClass?: string
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'distribution__row';
  row.setAttribute('aria-label', ariaLabel);

  const labelEl = document.createElement('div');
  labelEl.className = 'distribution__label';
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const bar = document.createElement('div');
  bar.className = barModifierClass ? `distribution__bar ${barModifierClass}` : 'distribution__bar';
  bar.style.width = `${barWidthPercent}%`;
  row.appendChild(bar);

  const valueEl = document.createElement('div');
  valueEl.className = 'distribution__value';
  valueEl.textContent = valueText;
  row.appendChild(valueEl);

  return row;
}

/**
 * Builds the always-on pace-distribution histogram (D-29) — one
 * `.distribution__row` per bucket, in ascending pace order (the order
 * `computePaceDistribution` already returns them in). Each bar's width is
 * that bucket's `timeSec` as a percentage of the LARGEST bucket's `timeSec`,
 * so the longest bar is 100% and the shape stays readable. The bar color
 * comes from `.distribution__bar`'s base `--chart-pace` rule — never set
 * inline.
 */
function buildPaceDistributionRows(buckets: readonly PaceBucket[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'distribution';

  const maxTimeSec = buckets.reduce((max, bucket) => Math.max(max, bucket.timeSec), 0);

  for (const bucket of buckets) {
    const minutes = bucket.timeSec / 60;
    const widthPercent = maxTimeSec > 0 ? (bucket.timeSec / maxTimeSec) * 100 : 0;
    container.appendChild(
      buildDistributionRow(
        bucket.label,
        `${minutes.toFixed(1)} min`,
        `${bucket.label}: ${minutes.toFixed(1)} min`,
        widthPercent
      )
    );
  }

  return container;
}

/**
 * Builds the HR-zone breakdown (D-29/D-31) — exactly five `.distribution__row`
 * entries in ascending zone order, INCLUDING zero-time zones, so the
 * five-bar shape is always stable. Each bar carries the matching
 * `.distribution__bar--zone-{n}` modifier and a width equal to the zone's
 * own `percent` (already computed by `computeHrZoneTimes`). Never
 * constructs a zone boundary or a max HR here — it renders only what plan
 * 17-05 computed.
 */
function buildHrZoneRows(zoneTimes: readonly ZoneTime[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'distribution';

  for (const zone of zoneTimes) {
    const minutes = zone.timeSec / 60;
    const roundedPercent = Math.round(zone.percent);
    container.appendChild(
      buildDistributionRow(
        zone.label,
        `${minutes.toFixed(1)} min · ${roundedPercent}%`,
        `${zone.label}: ${minutes.toFixed(1)} min, ${roundedPercent}%`,
        zone.percent,
        `distribution__bar--zone-${zone.zone}`
      )
    );
  }

  return container;
}

/**
 * The pure render decision `buildBreakdownSection` renders (CR-01, D-08,
 * COV-02). Extracted so the decision is behaviourally testable in this
 * repository's node-environment vitest suite — there is no DOM-simulation
 * dependency anywhere in the tree, so the DOM builder itself cannot be
 * invoked in tests (see the header comment on `detail-sections.test.ts`).
 * The same `*-logic` split this codebase already uses in
 * `detail-charts-logic.ts`, `detail-best-efforts-logic.ts`, `list-logic.ts`,
 * `calendar-logic.ts` and the `trends-*-logic.ts` modules.
 */
export interface BreakdownSectionPlan {
  showPaceHeading: boolean;
  captionText: string | null;
  showBars: boolean;
  noteText: string | null;
  showHrZones: boolean;
}

/**
 * Decides what `buildBreakdownSection` renders, given the same three inputs.
 * Returns `null` when there is nothing to show at all — no coverage worth
 * captioning, no buckets, no HR zones — so the caller appends nothing.
 *
 * The pace heading and its coverage caption (D-08, COV-02) are gated on
 * `coverage` alone — NEVER on `buckets.length` — because `PaceCoverage` is
 * computed independently by `classifyGaps` and can be well-defined and
 * non-trivial when the histogram is empty. Real archive activity
 * `11865310195` (CR-01) hits exactly this: `spanSec` 18, `coveredSec` 6
 * (33%), yet `paceHistogramSamples` returns zero samples. Only the bars are
 * gated on `buckets.length`. When covered time exists but produced fewer (or
 * zero) bucketable seconds than `coverage.coveredSec` accounts for, `noteText`
 * names the itemised shortfall via `unbucketedCoveredSec` (WR-01, plan
 * 26-11) — never a re-derived or estimated figure — so the caption's
 * percentage is never left silently overstating what the bars below it sum
 * to. An archive-wide sweep (plan 26-11) found this is not a rare edge case:
 * 44 of 1,865 activities carry `unbucketedCoveredSec > 0`, and 43 of those
 * still render bars (`buckets.length > 0`) — only one (`11865310195`) has an
 * entirely empty histogram. The note therefore renders in BOTH shapes: in
 * place of the bars when there are none, and alongside the bars when there
 * are some but they omit covered time.
 */
export function breakdownSectionPlan(
  buckets: readonly PaceBucket[],
  coverage: PaceCoverage | null,
  zoneTimes: readonly ZoneTime[] | null
): BreakdownSectionPlan | null {
  const captionText = coverage !== null ? coverageCaptionText(coverage) : null;
  const hasCoverage = captionText !== null;

  if (!hasCoverage && buckets.length === 0 && zoneTimes === null) return null;

  const unbucketedSec = coverage !== null ? unbucketedCoveredSec(coverage, buckets.map((b) => b.timeSec)) : 0;

  let noteText: string | null = null;
  if (hasCoverage && buckets.length === 0) {
    noteText = `No pace buckets — ${formatEffortDuration(unbucketedSec)} of covered time produced no derivable pace.`;
  } else if (hasCoverage && buckets.length > 0 && unbucketedSec > 0) {
    noteText = `Bars below omit ${formatEffortDuration(unbucketedSec)} of covered time that produced no derivable pace.`;
  }

  return {
    showPaceHeading: hasCoverage || buckets.length > 0,
    captionText,
    showBars: buckets.length > 0,
    noteText,
    showHrZones: zoneTimes !== null,
  };
}

/**
 * Builds the pace-distribution / HR-zone breakdown section.
 *
 * Return contract:
 * - Returns `null` when `breakdownSectionPlan` returns `null` — a three-way
 *   condition (CR-01 fix): there is no coverage worth captioning, no
 *   buckets, AND no HR zones. An activity with no stream at all still
 *   produces no breakdown section, but an activity with real, non-trivial
 *   coverage and an empty histogram (e.g. `11865310195`) no longer
 *   disappears the way it did before CR-01 was fixed.
 * - Otherwise returns a `<section class="card detail-section">` containing:
 *   - The `Pace Distribution` heading and its coverage caption (D-08,
 *     COV-02), which render whenever coverage is captionable —
 *     INDEPENDENTLY of bucket presence — built from the SAME `coverage` the
 *     caller derived the histogram's `buckets` from, never a second,
 *     independently-computed value (D-16).
 *   - An honest note, when covered time produced no bars, or produced fewer
 *     bucketed seconds than `coverage.coveredSec` accounts for (WR-01):
 *     naming the itemised shortfall via `unbucketedCoveredSec` rather than
 *     showing a heading over emptiness or a caption that silently
 *     overstates what the bars below it sum to.
 *   - The histogram bars, gated ONLY on `buckets.length` — this is the one
 *     piece of the pace half that bucket presence still controls.
 *   - The HR-zone panel, ADDITIONALLY and ONLY when `zoneTimes` is
 *     non-null. When `zoneTimes` is `null`, this half renders NOTHING — no
 *     heading, no empty box, no placeholder, no explanatory copy. Absence is
 *     the correct, spec-compliant outcome (D-31): the missing-HR situation
 *     is already communicated by the omitted HR chart band and the
 *     em-dashed stats tiles, so no "no HR data" message belongs here. This
 *     half gains nothing from the CR-01/WR-01 fix above.
 *
 * Every render decision lives in `breakdownSectionPlan` — this function is a
 * pure emitter over the plan it returns.
 */
export function buildBreakdownSection(
  buckets: readonly PaceBucket[],
  coverage: PaceCoverage | null,
  zoneTimes: readonly ZoneTime[] | null
): HTMLElement | null {
  const plan = breakdownSectionPlan(buckets, coverage, zoneTimes);
  if (plan === null) return null;

  const section = document.createElement('section');
  section.className = 'card detail-section';

  if (plan.showPaceHeading) {
    const heading = document.createElement('h2');
    heading.className = 'text-heading';
    heading.textContent = 'Pace Distribution';
    section.appendChild(heading);

    if (plan.captionText !== null) {
      const caption = document.createElement('p');
      caption.className = 'text-label';
      caption.textContent = plan.captionText;
      section.appendChild(caption);
    }

    if (plan.noteText !== null) {
      const note = document.createElement('p');
      note.className = 'text-label';
      note.textContent = plan.noteText;
      section.appendChild(note);
    }

    if (plan.showBars) {
      section.appendChild(buildPaceDistributionRows(buckets));
    }
  }

  if (plan.showHrZones) {
    const heading = document.createElement('h2');
    heading.className = 'text-heading';
    heading.textContent = 'Heart Rate Zones';
    section.appendChild(heading);
    section.appendChild(buildHrZoneRows(zoneTimes as readonly ZoneTime[]));
  }

  return section;
}

/** Builds the Age-Grade cell: one decimal + `%`, em dash when absent, `1k` rows append `*` (18-UI-SPEC § 6's footnote asterisk). */
function buildAgeGradeCell(row: BestEffortPanelRow): HTMLTableCellElement {
  if (row.agePercent === null) {
    return buildTextCell(DASH, 'pr-table__numeric');
  }
  const suffix = row.distance === '1k' ? '*' : '';
  return buildTextCell(`${row.agePercent.toFixed(1)}%${suffix}`, 'pr-table__numeric');
}

/**
 * Maps a `PrFlagBadgeSpec.kind` to its CSS modifier class. A kind absent
 * from this lookup (`'pr'`, `'low-confidence'`, `'excluded'`) renders as a
 * plain `.badge` by design — only `'demoted'` and `'contaminated'` carry
 * their own dedicated colour token. `'contaminated'` gets its own modifier,
 * distinct from `'demoted'`'s, because a moved-but-ranked effort and a
 * rejected effort are different claims (Phase 36 D-15) — Phase 28 WR-02
 * already established a dedicated token per badge claim rather than a
 * shared one, and this is that precedent applied to the new claim.
 */
const BADGE_KIND_CLASS: Partial<Record<PrFlagBadgeSpec['kind'], string>> = {
  demoted: 'badge--demoted',
  contaminated: 'badge--contaminated',
};

/**
 * Builds the PR? cell. This function DECIDES NOTHING ITSELF — it renders
 * whatever `prFlagBadgeSpecs` returns, one `appendAccessibleBadge` call per
 * spec, and nothing else (the kind-to-class lookup above is the one
 * exception: a CSS modifier, not a wording decision). Every badge therefore
 * carries its own `aria-describedby` pointing at a `.sr-only` explanation
 * span, which is what keeps two adjacent badges separable when a screen
 * reader flows the cell's text — Phase 24 Round 2's R15 recorded two bare,
 * unexplained badges concatenating into one run-on claim, `PRExcluded —
 * {reason}`. The badge strings themselves live in `prFlagBadgeSpecs`, a
 * pure module, precisely because this repository's vitest runs with
 * `environment: 'node'` and cannot invoke a DOM builder — a string decided
 * here would be a string no test could ever read.
 */
function buildPrFlagsCell(row: BestEffortPanelRow, exclusionReason: string | null): HTMLTableCellElement {
  const cell = document.createElement('td');

  for (const spec of prFlagBadgeSpecs(row, exclusionReason)) {
    appendAccessibleBadge(
      cell,
      spec.visibleText,
      spec.explanation,
      `best-efforts-${row.distance}-${spec.descriptionIdSuffix}`,
      BADGE_KIND_CLASS[spec.kind]
    );
  }

  return cell;
}

/**
 * Builds the "Best Efforts This Run" panel (18-UI-SPEC § 5, D-08, REC-04) —
 * one row per distance this activity produced ANY effort for, not only its
 * PR-setting ones. Mirrors `buildSplitsSection`'s shape exactly: a
 * `<section class="card detail-section">`, a heading, an empty-state early
 * return, then the table.
 *
 * The section is NEVER omitted — a run with zero qualifying efforts still
 * renders the named empty state rather than disappearing, so its absence
 * always reads as a real "too short" fact, never as a bug (18-UI-SPEC § 15).
 *
 * Phase 24's D-03(a) attach seam: `section.dataset.activityId` is set here,
 * unconditionally, before ANY early return. This is inert — it carries no
 * endpoint, no fetch, no write, and no curate code — it exists purely so a
 * developer-only local overlay (`npm run curate`) can find this exact panel
 * by activity id rather than by matching visible label text or table column
 * order. It ships in the published bundle deliberately (24-CONTEXT.md D-03).
 */
export function buildBestEffortsSection(
  rows: readonly BestEffortPanelRow[],
  exclusionReason: string | null,
  activityId: string
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'card detail-section';
  section.dataset.activityId = activityId;

  const heading = document.createElement('h2');
  heading.className = 'text-heading';
  heading.textContent = 'Best Efforts This Run';
  section.appendChild(heading);

  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';

    const emptyHeading = document.createElement('h3');
    emptyHeading.textContent = 'No qualifying efforts';
    empty.appendChild(emptyHeading);

    const emptyBody = document.createElement('p');
    emptyBody.textContent = 'This run is shorter than 400m or below the shortest effort threshold.';
    empty.appendChild(emptyBody);

    section.appendChild(empty);
    return section;
  }

  const table = document.createElement('table');
  table.className = 'activity-table pr-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const headers = ['Distance', 'Time', 'Pace', 'Age-Grade', 'PR?'];
  for (const headerText of headers) {
    const th = document.createElement('th');
    th.textContent = headerText;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  let hasFootnoteRow = false;
  for (const row of rows) {
    const tr = document.createElement('tr');
    if (row.isPr) tr.classList.add('pr-table__row--pr');

    tr.appendChild(buildTextCell(row.display));
    tr.appendChild(buildTextCell(formatEffortDuration(row.durationSec), 'pr-table__numeric'));
    tr.appendChild(buildTextCell(formatPace(row.paceSecPerKm), 'pr-table__numeric'));
    tr.appendChild(buildAgeGradeCell(row));
    tr.appendChild(buildPrFlagsCell(row, exclusionReason));

    if (row.distance === '1k' && row.agePercent !== null) {
      hasFootnoteRow = true;
    }

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  section.appendChild(table);

  if (hasFootnoteRow) {
    const footnote = document.createElement('p');
    footnote.className = 'text-label';
    footnote.textContent =
      '* Interpolated between 800m and mile factors — no official WMA standard exists for 1k.';
    section.appendChild(footnote);
  }

  return section;
}

// ---------------------------------------------------------------------------
// Running Pace tile (Phase 35, plan 35-10: RPACE-02, D-10) — the fourth stat
// tile's pure plan function, following this file's own section-plan
// convention (`breakdownSectionPlan`, `qualitySignalsSectionPlan`,
// `pausesSectionPlan`): returns DATA, never DOM. `detail.ts` is a DOM
// controller with no test harness of its own (no `detail.test.ts` exists),
// so the render DECISION lives here, unit-testable, and `detail.ts` builds
// the actual `.stat-grid` tile elements from what this returns.
// ---------------------------------------------------------------------------

/**
 * Decides the Running Pace tile's value and its always-on exclusion note
 * (RPACE-02, D-10, 35-UI-SPEC.md § Copywriting Contract), across all four
 * states, in this precedence order:
 *
 *   1. `runningPace` is `null` or `undefined` — the "no stream at all" case
 *      only (`DashboardIndexRow.runningPace` is `null` ONLY when
 *      `entry.available === false`; `ParsedDashboardIndexRow`'s `Partial<>`
 *      also makes `undefined` reachable for a stale re-parsed row missing
 *      the key). The tile is omitted entirely — this returns `null` and the
 *      caller appends nothing, mirroring the Gear tile's own
 *      conditional-append precedent.
 *   2. `computable === false` — `value` is the same em dash this file's own
 *      `DASH` constant already uses for a missing figure (never a freshly
 *      typed character; `DASH` is defined locally rather than importing
 *      `detail.ts`'s `formatOrDash`, since `detail.ts` imports THIS module —
 *      importing back would create the cycle this file's header comment
 *      already forbids; both copies of the glyph must stay identical).
 *      `note` is `Not computable — {reason}`, the SAME phrase template
 *      `decimationRow`/`gapProfileRow`/`impossibleSamplesRow`/
 *      `unreliableSegmentsRow` above already use verbatim. A `null` or
 *      empty/whitespace-only reason on a not-computable row is a
 *      PRODUCER-CONTRACT VIOLATION (`RunningPaceRow`'s own docblock:
 *      `computable: false` always pairs with a non-empty
 *      `notComputableReason`) — this returns a note naming the violation
 *      explicitly rather than a dangling `"Not computable — "` prefix with
 *      nothing after it.
 *   3. `computable === true` with BOTH `excludedM` and `excludedSec`
 *      rounding to exactly 0 — `value` is `formatPace(runningPaceSecPerKm)`,
 *      `note` is the zero sentence verbatim. A genuinely clean stream states
 *      its own health, exactly like `coverageCaptionText` always rendering
 *      all four of its own terms even at 0% (D-08/COV-02's always-on
 *      precedent, extended by D-10 to this tile).
 *   4. Otherwise (computable, something excluded) — `value` is
 *      `formatPace(runningPaceSecPerKm)`, `note` is the nonzero sentence,
 *      with `metresText` from `formatMetres` (the extracted, single-source
 *      metres convention `unreliableSegmentsBadgeContent` also calls, so
 *      this tile's number formatting cannot drift from the Quality Signals
 *      section's own convention) and `durationText` from
 *      `formatEffortDuration(excludedSec)`.
 *
 * The note is ALWAYS present for any activity with a stream (states 2/3/4
 * above) — a term that disappears at zero stops meaning "zero" and starts
 * meaning "unknown" (COV-02's precedent). The three named categories in
 * state 4's sentence ("recording gaps, pauses and unreliable segments")
 * deliberately echo `coverageCaptionText`'s own three non-covered terms and
 * must never disagree with it (D-08's binding "must reconcile with what the
 * coverage caption already discloses" constraint).
 *
 * Returns DATA only, never DOM — the caller (`detail.ts`) writes both
 * `value` and `note` to the DOM with `textContent` only, never a raw-markup
 * DOM-assignment method.
 */
export function runningPaceTilePlan(
  runningPace: RunningPaceRow | null | undefined
): { value: string; note: string } | null {
  if (runningPace === null || runningPace === undefined) return null;

  if (!runningPace.computable) {
    const reason = runningPace.notComputableReason;
    if (reason === null || reason.trim().length === 0) {
      return {
        value: DASH,
        note:
          'Not computable — no reason was recorded for this not-computable running pace (producer contract violation)',
      };
    }
    return { value: DASH, note: `Not computable — ${reason}` };
  }

  const value = formatPace(runningPace.runningPaceSecPerKm);
  const excludedMRounded = Math.round(runningPace.excludedM);
  const excludedSecRounded = Math.round(runningPace.excludedSec);

  if (excludedMRounded === 0 && excludedSecRounded === 0) {
    return { value, note: 'No time excluded — every second of this activity is covered.' };
  }

  const metresText = formatMetres(runningPace.excludedM);
  const durationText = formatEffortDuration(runningPace.excludedSec);
  return {
    value,
    note: `Excludes ${metresText} over ${durationText} of recording gaps, pauses and unreliable segments.`,
  };
}

// ---------------------------------------------------------------------------
// Quality Signals section (Phase 27, plan 27-09: QUAL-01, QUAL-04, ERA-02) —
// the always-on detail-view disclosure of all five per-activity quality
// signals, healthy and stream-less activities included (D-08).
// ---------------------------------------------------------------------------

/**
 * The synthetic, always-severe probe row `EXPLANATION_PROBE_SPECS` below is
 * fed through — EXPORTED (G-05, 27-REVIEW.md WR-01) so
 * `detail-sections.test.ts`'s drift test imports and exercises this EXACT
 * object rather than a hand-typed duplicate literal that could silently
 * diverge from this one; a drift test whose two sides are separately
 * maintained can pass while the thing it guards has drifted. `deviceEra`/
 * `elapsedVsMoving` are included (required by `ActivityQualitySignals`)
 * but have no `qualityBadgeSpecs` equivalent (D-13/D-14 exclude them from
 * any list badge) — this section defines its own explanation strings for
 * those two rows below, independent of this probe. `qualityBadgeSpecs`
 * only returns a spec for a severe-tier signal with a non-null evidence
 * field (D-07), so every field here is set to a value that satisfies that
 * gate; the actual numbers are irrelevant — only `.explanation` is ever
 * read from the result, never `.visibleText`. `elevation` (Phase 30) is
 * DELIBERATELY kept clean (tier `'none'`) here: `qualityBadgeSpecs`
 * doesn't yet have an elevation spec (that lands in plan 30-05), but once
 * it does, a severe elevation on this probe would add a fourth spec to
 * `EXPLANATION_PROBE_SPECS` and change what the module-load assertion
 * loop below is asserting — elevation deliberately does not participate
 * in that loop's three-signal list (plan 30-06 defines its own per-mode
 * explanations, since D-10's single rolled-up badge does not map 1:1
 * onto D-11's three per-mode rows).
 */
export const EXPLANATION_PROBE_QUALITY: ActivityQualitySignals = {
  decimation: { tier: 'severe', zeroAdvanceFraction: 0.5, sampleCount: 100 },
  gapProfile: { tier: 'severe', gapFraction: 0.5, recordingGapSec: 10, pauseSec: 10, spanSec: 20 },
  impossibleSamples: { tier: 'severe', count: 10, maxImpliedSpeedMps: 20, countInsideZeroAdvanceRun: 1 },
  elevation: {
    tier: 'none',
    subGround: { flagged: false, minAltM: 12 },
    closureDrift: { state: 'clear', deltaM: 4, startEndDistM: 38 },
    verticalRate: { flagged: false, worstRateMps: 1.2, violatingSamples: 0 },
  },
  // Seventh signal (Phase 33, SEG-06, plan 33-09 Task 3): DELIBERATELY kept
  // clean (tier 'none') here, mirroring elevation's own choice above —
  // `qualityBadgeSpecs` has no unreliableSegments spec in this probe's
  // three-signal assertion loop below (SEG-06 is excluded from
  // hasAnySevereSignal exactly like elevation, D-06), so a severe value
  // here would add a fourth entry to `EXPLANATION_PROBE_SPECS` with no
  // corresponding assertion, silently implying it feeds the composite.
  unreliableSegments: {
    tier: 'none',
    count: 0,
    totalMetres: 0,
    totalExcessMetres: 0,
    totalSeconds: 0,
    excessFraction: 0,
    mechanisms: [],
  },
  deviceEra: { family: 'no-device-name', rawDeviceName: null },
  elapsedVsMoving: { ratio: null, elapsedSec: null, movingSec: null },
  // Ninth/tenth signals (Phase 34, PAUSE-02/STOP-01/STOP-03, D-11): flat
  // untiered defaults, mirroring `deviceEra`/`elapsedVsMoving`'s own choice
  // above — neither key has a `tier` field, so there is no 'none'/'severe'
  // choice to make, and neither participates in the three-signal assertion
  // loop below (they are not tiering signals feeding hasAnySevereSignal).
  // Rows and sections for these two ship in plan 34-09.
  pauseClassification: {
    intervalCount: 0,
    stationaryCount: 0,
    walkedCount: 0,
    ranThroughCount: 0,
    transportedCount: 0,
    notClassifiableCount: 0,
  },
  forgottenStop: {
    computable: true,
    reason: null,
    count: 0,
    totalSec: 0,
    longestSec: 0,
    creepCount: 0,
    creepTotalSec: 0,
    creepLongestSec: 0,
    pauseCount: 0,
    pauseTotalSec: 0,
    pauseLongestSec: 0,
  },
  anySevere: true,
  notComputableReason: null,
};

/**
 * `EXPLANATION_PROBE_QUALITY` fed through `list.ts`'s `qualityBadgeSpecs`
 * ONCE at module load, purely so this module can read the three tiering
 * signals' explanation strings (`decimation`, `gapProfile`,
 * `impossibleSamples`) from their single source of truth rather than
 * retyping them here — the plan's explicit instruction that the two
 * surfaces (the severe-tier list badge and this always-on section) cannot
 * drift apart.
 */
const EXPLANATION_PROBE_SPECS = qualityBadgeSpecs({ quality: EXPLANATION_PROBE_QUALITY });

/**
 * G-05 (27-REVIEW.md WR-01): fails loudly at true module load — before any
 * render can occur — rather than letting a regressed probe silently reach
 * `tieringExplanation`'s `?? ''` fallback later, at render time. An empty
 * explanation string is never a valid rendering outcome for this always-on
 * section (D-08), so a missing spec here is treated as a hard defect, not
 * a value to paper over. This throws once, at import, and ONLY when
 * `EXPLANATION_PROBE_QUALITY` (or `qualityBadgeSpecs` itself) has
 * regressed to no longer satisfy D-07's severe-tier-with-non-null-evidence
 * gate on all three tiering signals — every present-day import of this
 * module is unaffected, because the invariant holds.
 */
for (const signal of ['decimation', 'gapProfile', 'impossibleSamples'] as const) {
  const explanation = EXPLANATION_PROBE_SPECS.find((spec) => spec.signal === signal)?.explanation;
  if (!explanation) {
    throw new Error(
      `detail-sections.ts: EXPLANATION_PROBE_QUALITY produced no explanation for signal "${signal}" — qualityBadgeSpecs or the probe fixture has regressed, and an empty tiering explanation is never a valid rendering outcome (D-08)`
    );
  }
}

/**
 * Reads one tiering signal's explanation from `EXPLANATION_PROBE_SPECS`.
 * The module-load assertion above guarantees every signal here already has
 * a non-empty explanation, so the `?? ''` below is unreachable
 * defense-in-depth — the throw above is the actual safety net, not this
 * fallback.
 */
function tieringExplanation(signal: 'decimation' | 'gapProfile' | 'impossibleSamples'): string {
  return EXPLANATION_PROBE_SPECS.find((spec) => spec.signal === signal)?.explanation ?? '';
}

/** `deviceEra` has no `qualityBadgeSpecs` equivalent (D-13) — this section's own explanation text. */
const DEVICE_ERA_EXPLANATION =
  'the recording device or migration source can explain artifacts specific to that device’s firmware or export pipeline, independent of the three tiering signals above';

/** `elapsedVsMoving` has no `qualityBadgeSpecs` equivalent (D-14) — this section's own explanation text. */
const ELAPSED_VS_MOVING_EXPLANATION =
  'elapsed time includes any stopped-watch time not captured as a moving pause; a high ratio does not by itself distinguish deliberate rest from a forgotten stop';

/**
 * Elevation's three per-mode explanations (Phase 30, D-11). Deliberately NOT
 * routed through `tieringExplanation`/`EXPLANATION_PROBE_SPECS`: D-10 ships
 * ONE rolled-up list badge across all three elevation modes, so no 1:1
 * `qualityBadgeSpecs` probe entry exists for `subGround`/`closureDrift`/
 * `verticalRate` individually — forcing one through the existing probe
 * mechanism would mean either adding a fourth, elevation-specific probe spec
 * (a badge/section coupling this section does not otherwise have) or letting
 * a lookup miss fall through to an empty string, which D-08's always-on rule
 * forbids. These follow `DEVICE_ERA_EXPLANATION`/`ELAPSED_VS_MOVING_EXPLANATION`'s
 * own precedent instead: a standalone, module-level explanation constant for
 * a row with no list-badge counterpart.
 */
const SUB_GROUND_EXPLANATION =
  'an altitude below plausible ground level means the barometric or GPS altitude baseline for this activity is wrong, not that the terrain was';

const CLOSURE_DRIFT_EXPLANATION =
  'a loop that returns to its start should return to its start altitude, so a large difference is sensor drift over the activity rather than terrain';

const VERTICAL_RATE_EXPLANATION =
  'a per-sample climb or descent rate no runner achieves means the altitude channel moved without the athlete doing so';

/**
 * SEG-06's own explanation (Phase 33, plan 33-11). Deliberately NOT routed
 * through `tieringExplanation`/`EXPLANATION_PROBE_SPECS`: that mechanism
 * exists only for the three `hasAnySevereSignal`-feeding TIERING signals
 * (`decimation`/`gapProfile`/`impossibleSamples`), and routing SEG-06
 * through it would falsely imply this signal feeds that composite — it
 * structurally does not (D-06, `hasAnySevereSignal`'s never-widen `Pick<>`
 * and its own guard test in `pace-quality.test.ts`). Follows
 * `SUB_GROUND_EXPLANATION`'s exact precedent instead: a standalone,
 * module-level explanation constant for a row with no `qualityBadgeSpecs`
 * tiering-loop entry.
 */
export const UNRELIABLE_SEGMENTS_EXPLANATION =
  'distance recorded here in less time than it could physically take means pace inside this segment is not measured; the segment is clipped from pace charts and splits, never filled in or corrected';

/**
 * The tenth row's own explanation (Phase 34, PAUSE-02, STOP-01, STOP-03,
 * D-11, D-14, plan 34-09). Deliberately NOT routed through
 * `tieringExplanation`/`EXPLANATION_PROBE_SPECS` — same reasoning as
 * `DEVICE_ERA_EXPLANATION`/`ELAPSED_VS_MOVING_EXPLANATION`/
 * `UNRELIABLE_SEGMENTS_EXPLANATION` above: neither `pauseClassification` nor
 * `forgottenStop` is one of the three `hasAnySevereSignal`-feeding tiering
 * signals, so routing this row through that mechanism would falsely imply
 * it feeds that composite.
 *
 * Also read by `buildPausesSection` below (shared, not retyped) — the
 * Pauses section's own heading explains the SAME two facts at greater
 * length (D-14: a section plus a one-line summary row, not two
 * independently-worded explanations of the same underlying computation).
 */
export const PAUSES_SUMMARY_EXPLANATION =
  'each interval’s class is judged from its own distance over its own elapsed time; a possible forgotten stop is timer-running standstill time — creep inside recorded time, plus paused intervals — and none of this changes moving time, pace or best efforts';

/** Shown for all nine rows when `quality` itself is `null` (D-08: absence must say so, never vanish). */
const QUALITY_DATA_NOT_AVAILABLE = 'Quality data not available for this activity';

/**
 * One row of the always-on Quality Signals section (D-08, D-09, D-12, D-17,
 * D-18). `tier` is the shared four-member `QualityTier` for the three
 * TIERING signals, or the literal `'untiered'` for `deviceEra`/
 * `elapsedVsMoving` (D-13/D-14) — kept as a distinct value rather than
 * `QualityTier | null` for the exact T-26-02 reason `QualityTier` itself
 * documents: a nullable tier invites `tier ?? 'none'`, which would style an
 * untiered fact as a clean tiering result.
 */
export interface QualitySignalRow {
  label: string;
  valueText: string;
  tier: QualityTier | 'untiered';
  explanation: string;
  evidenceText: string | null;
}

/**
 * The full always-on Quality Signals section decision — always exactly nine
 * rows, in fixed order (D-08; Phase 30 D-11 extended the original five with
 * three always-on elevation rows; Phase 33 SEG-06, plan 33-11, adds a ninth
 * for unreliable segments).
 */
export interface QualitySignalsSectionPlan {
  rows: QualitySignalRow[];
}

/**
 * Maps a resolved `DeviceEraSignal` to its display string (ERA-02, D-12).
 * Exhaustive `switch (family)` with NO `default` branch — an eighth
 * `DeviceFamilyKind` member added in a later phase without a matching case
 * here fails `npx tsc --noEmit` (TS2366: not every code path returns a
 * value), rather than silently falling through to a fabricated device name.
 * This is Criterion 5's "demonstrated failing if that branch is deleted and
 * a default silently takes over" concern, prevented structurally rather than
 * by convention.
 *
 * `'unrecognized-device'` includes `rawDeviceName` VERBATIM — untrusted
 * athlete/device free text reaching this string unescaped on purpose;
 * `buildQualitySignalsSection` below reaches the DOM through `textContent`
 * only, so escaping here would double-escape on screen (`pace-quality.ts`'s
 * own `DeviceEraSignal` doc comment states the same rule).
 */
function deviceFamilyDisplayName(era: DeviceEraSignal): string {
  const { family } = era;
  switch (family) {
    case 'garmin-fenix-6-pro':
      return 'Garmin fēnix 6 Pro';
    case 'suunto-9':
      return 'Suunto 9';
    case 'garmin-vivoactive-4':
      return 'Garmin vívoactive 4';
    case 'strava-app-gpx':
      return 'Strava App';
    case 'intervals-icu':
      return 'intervals.icu (migrated)';
    case 'no-device-name':
      return 'No device name recorded';
    case 'unrecognized-device':
      return `Unrecognized device: ${era.rawDeviceName ?? ''}`;
  }
}

/**
 * Decimation row (D-08, D-17). `notComputableReason` non-null (D-06) always
 * wins, reading `Not computable — {reason}` with `tier: 'not-computable'` —
 * never a healthy statement, never `0%` (T-26-02). Otherwise `'none'` tier
 * reads the explicit healthy statement; `'minor'`/`'severe'` name the
 * measured `zeroAdvanceFraction` percentage, matching `qualityBadgeSpecs`'s
 * own severe-tier phrasing in `list.ts` (not imported verbatim there, since
 * that function only ever computes a severe-tier percentage — this row
 * computes the same percentage at any tier).
 *
 * `evidenceText` is drawn from `shard.zeroAdvanceRunProfile` and
 * `shard.adaptiveWindowSec` — evidence the index row's own scalars do not
 * carry (D-17) — and is `null` whenever either is unavailable, including
 * when `shard` itself is `null`.
 */
function decimationRow(
  signal: DecimationSignal,
  notComputableReason: string | null,
  shard: PaceQualityShard | null
): QualitySignalRow {
  const explanation = tieringExplanation('decimation');

  if (notComputableReason !== null) {
    return {
      label: 'Decimation',
      valueText: `Not computable — ${notComputableReason}`,
      tier: 'not-computable',
      explanation,
      evidenceText: null,
    };
  }

  let valueText: string;
  if (signal.tier === 'none') {
    valueText = 'No decimation detected';
  } else if (signal.zeroAdvanceFraction !== null) {
    valueText = `${Math.round(signal.zeroAdvanceFraction * 100)}% of samples with no distance advance`;
  } else {
    valueText = 'Decimation data unavailable';
  }

  const profile = shard?.zeroAdvanceRunProfile ?? null;
  const windowSec = shard?.adaptiveWindowSec ?? null;
  const evidenceText =
    profile !== null && windowSec !== null
      ? `Longest zero-advance run: ${profile.longestRunSamples} samples (${profile.longestRunSec.toFixed(1)}s); adaptive window ${windowSec.toFixed(1)}s`
      : null;

  return { label: 'Decimation', valueText, tier: signal.tier, explanation, evidenceText };
}

/**
 * Gap-profile row (D-08, D-11, D-17) — same not-computable/healthy/tiered
 * shape as `decimationRow`. `label` reads `'Coverage gaps'` in all three
 * branches (D-11) — the number this row displays now counts recording
 * gaps, pauses AND unreliable segments (plan 33-03 widened `gapFraction`),
 * so the old `'Recording gaps'` label and its `'... in gaps or pauses'`
 * copy would misdescribe a shipped figure. This is a CORRECTNESS fix, not
 * cosmetic — exactly the defect this badge's own docblock rule (every
 * string names what its number counts) exists to prevent.
 *
 * `evidenceText` itemises `shard.gapIntervals` by kind — recording-gap/pause
 * intervals counted together, unreliable segments counted separately
 * (RESEARCH.md's Open Question 1: itemise, not a raw cross-kind count) —
 * and always names the unreliable count, including when it is zero, the
 * same always-on reasoning D-10 applies to the coverage caption's fourth
 * term (an omitted clause would read as "unknown", not "none"). `longest`
 * is computed across ALL intervals of both kinds, as before.
 *
 * This evidence line's DATA depends on `pace-quality-client.ts`'s
 * `VALID_GAP_KINDS` being widened to include `'unreliable'` (plan 33-05) —
 * without that fix this logic is correct but permanently starved of
 * unreliable intervals once the shard is parsed in the browser, and the
 * unreliable count below would read zero on every activity regardless of
 * what the detector actually found.
 */
function gapProfileRow(
  signal: GapProfileSignal,
  notComputableReason: string | null,
  shard: PaceQualityShard | null
): QualitySignalRow {
  const explanation = tieringExplanation('gapProfile');

  if (notComputableReason !== null) {
    return {
      label: 'Coverage gaps',
      valueText: `Not computable — ${notComputableReason}`,
      tier: 'not-computable',
      explanation,
      evidenceText: null,
    };
  }

  let valueText: string;
  if (signal.tier === 'none') {
    valueText = 'No gaps, pauses or unreliable segments';
  } else if (signal.gapFraction !== null) {
    valueText = `${Math.round(signal.gapFraction * 100)}% of recorded time in gaps, pauses or unreliable segments`;
  } else {
    valueText = 'Gap profile data unavailable';
  }

  const intervals = shard?.gapIntervals ?? [];
  let evidenceText: string | null = null;
  if (intervals.length > 0) {
    const unreliableIntervals = intervals.filter((gap) => gap.kind === 'unreliable');
    const gapPauseIntervals = intervals.filter((gap) => gap.kind !== 'unreliable');
    const longestSec = intervals.reduce((max, gap) => Math.max(max, gap.endSec - gap.startSec), 0);
    const gapPauseNoun = gapPauseIntervals.length === 1 ? 'interval' : 'intervals';
    const unreliableNoun = unreliableIntervals.length === 1 ? 'segment' : 'segments';
    evidenceText = `${gapPauseIntervals.length} gap/pause ${gapPauseNoun}, ${unreliableIntervals.length} unreliable ${unreliableNoun}; longest ${formatEffortDuration(longestSec)}`;
  }

  return { label: 'Coverage gaps', valueText, tier: signal.tier, explanation, evidenceText };
}

/**
 * Impossible-samples row (D-08, D-17) — same not-computable/healthy/tiered
 * shape as `decimationRow`. `evidenceText` names the fastest implied speed
 * drawn from `shard.impossibleSamples`' own per-pair list (never the index
 * row's `maxImpliedSpeedMps` scalar, even though the values agree, so this
 * row's evidence genuinely depends on the fetched shard) plus
 * `shard.signals.impossibleSamples.countInsideZeroAdvanceRun` — the
 * per-activity face of the measured decimation/impossible-sample
 * correlation, disclosed here rather than only in the calibration report.
 */
function impossibleSamplesRow(
  signal: ImpossibleSampleSignal,
  notComputableReason: string | null,
  shard: PaceQualityShard | null
): QualitySignalRow {
  const explanation = tieringExplanation('impossibleSamples');

  if (notComputableReason !== null) {
    return {
      label: 'Impossible samples',
      valueText: `Not computable — ${notComputableReason}`,
      tier: 'not-computable',
      explanation,
      evidenceText: null,
    };
  }

  let valueText: string;
  if (signal.tier === 'none') {
    valueText = 'No impossible samples';
  } else if (signal.count !== null) {
    const noun = signal.count === 1 ? 'sample' : 'samples';
    valueText = `${signal.count} ${noun} faster than the 100 m world record`;
  } else {
    valueText = 'Impossible-sample data unavailable';
  }

  const samples = shard?.impossibleSamples ?? [];
  let evidenceText: string | null = null;
  if (samples.length > 0) {
    const worst = samples.reduce((max, s) => (s.impliedSpeedMps > max.impliedSpeedMps ? s : max), samples[0]);
    const insideRun = shard?.signals.impossibleSamples.countInsideZeroAdvanceRun ?? null;
    evidenceText =
      `Fastest implied speed ${worst.impliedSpeedMps.toFixed(1)} m/s (+${worst.ddM.toFixed(1)} m in ${worst.dtSec.toFixed(1)}s)` +
      (insideRun !== null ? `; ${insideRun} of these fall inside a zero-advance run` : '');
  }

  return { label: 'Impossible samples', valueText, tier: signal.tier, explanation, evidenceText };
}

/**
 * Unreliable-segments row (SEG-06, D-06, D-08, plan 33-11) — the same
 * not-computable/healthy/tiered three-branch shape as `decimationRow`, NOT
 * elevation's three-sub-row shape, since SEG-06 is one rolled-up signal.
 * Unlike the three TIERING rows above, `signal.tier` reaches all the way to
 * `'minor'` here (D-06): `qualityBadgeSpecs` only badges a list row at
 * `'severe'`, so a `'minor'`-tier activity — e.g. 3475724402's 16
 * gap-adjacent segments, 2148.7 m, D-07's own recorded gap-dilution finding
 * that clamps its `excessFraction` to exactly 0 — has no list badge, but
 * this always-on row still discloses its measured count/metres/seconds so
 * the fact is never silently absent from the detail view.
 *
 * `valueText` for the `'minor'`/`'severe'` branches reuses
 * `unreliableSegmentsBadgeContent` from `list.ts` — the SAME text builder
 * `qualityBadgeSpecs`'s sixth badge block calls (33-11 Task 1) — so this row
 * and that badge cannot describe the same measured value with two different
 * strings. The `'none'` branch is this row's own healthy statement, since
 * `unreliableSegmentsBadgeContent` has no meaningful output for a
 * zero-segment signal (no mechanism to name).
 *
 * `evidenceText` is read from `shard?.unreliableSegments` — the capped,
 * `parts`-free per-segment list (D-08) — naming where in the run the
 * segments sit (first segment's start time, longest segment's duration) and
 * stating the truncation when `shard.unreliableSegmentsTruncated` is true.
 * `null` whenever the shard carries no segments, including when `shard`
 * itself is `null` (fetch failed or still in flight, T-27-31).
 *
 * NOTE ON DOUBLE DISCLOSURE (33-CONTEXT.md environment note): `gapProfileRow`
 * above already itemises `shard.gapIntervals`' `'unreliable'`-kind entries
 * in ITS OWN evidence line ("N unreliable segments"). Both that count and
 * this row's `signal.count` are read from the SAME detector segments (one
 * `unreliable`-kind `gapIntervals` entry per detected segment,
 * `classifyGapsWithSegments`'s own agreement, pinned by plan 33-09's Task 1
 * tests) — they cannot disagree by construction, so the two rows disclosing
 * the same fact twice is intentional overlap, never a contradiction.
 */
function unreliableSegmentsRow(
  signal: UnreliableSegmentsSignal,
  notComputableReason: string | null,
  shard: PaceQualityShard | null
): QualitySignalRow {
  if (notComputableReason !== null) {
    return {
      label: 'Unreliable segments',
      valueText: `Not computable — ${notComputableReason}`,
      tier: 'not-computable',
      explanation: UNRELIABLE_SEGMENTS_EXPLANATION,
      evidenceText: null,
    };
  }

  let valueText: string;
  if (signal.tier === 'none') {
    valueText = 'No unreliable segments detected';
  } else {
    const content = unreliableSegmentsBadgeContent(signal);
    valueText = content !== null ? content.visibleText : 'Unreliable-segment data unavailable';
  }

  const entries = shard?.unreliableSegments ?? [];
  let evidenceText: string | null = null;
  if (entries.length > 0) {
    const first = entries[0];
    const longest = entries.reduce((max, e) => (e.seconds > max.seconds ? e : max), entries[0]);
    const truncationText = shard?.unreliableSegmentsTruncated
      ? ` (list truncated to the first ${entries.length})`
      : '';
    evidenceText =
      `First segment at ${formatEffortDuration(first.startSec)}; longest ${formatEffortDuration(longest.seconds)}${truncationText}`;
  }

  return { label: 'Unreliable segments', valueText, tier: signal.tier, explanation: UNRELIABLE_SEGMENTS_EXPLANATION, evidenceText };
}

/**
 * Sub-ground-level row (D-11, D-17, Phase 30). Unlike the three tiering rows
 * above, `notComputableReason` here is the WHOLE-SIGNAL reason
 * (`quality.notComputableReason`) — the same one `decimationRow`/
 * `gapProfileRow`/`impossibleSamplesRow` take — never a per-mode reason,
 * since sub-ground has no not-computable state of its own beyond the
 * stream-less/unusable-stream cohort (D-07). A `minAltM` of `null` on an
 * otherwise-computable activity (a stream without an elevation channel)
 * reads as data-unavailable, never a fabricated `0 m` (T-26-02).
 * `evidenceText` is always `null` — the shard carries no sub-ground-specific
 * evidence field beyond the `minAltM` this row's `valueText` already states.
 */
function subGroundRow(
  signal: SubGroundSignal,
  notComputableReason: string | null,
  _shard: PaceQualityShard | null
): QualitySignalRow {
  if (notComputableReason !== null) {
    return {
      label: 'Lowest altitude',
      valueText: `Not computable — ${notComputableReason}`,
      tier: 'not-computable',
      explanation: SUB_GROUND_EXPLANATION,
      evidenceText: null,
    };
  }

  let valueText: string;
  if (signal.minAltM === null) {
    valueText = 'Lowest-altitude data unavailable';
  } else if (signal.flagged) {
    valueText = `lowest altitude ${Math.round(signal.minAltM)} m — below plausible ground level`;
  } else {
    valueText = `lowest altitude ${Math.round(signal.minAltM)} m`;
  }

  return {
    label: 'Lowest altitude',
    valueText,
    tier: signal.flagged ? 'severe' : 'none',
    explanation: SUB_GROUND_EXPLANATION,
    evidenceText: null,
  };
}

/**
 * Closure-drift row (D-02, D-11, D-17, Phase 30). FOUR distinct,
 * distinguishable phrasings, all reading in words rather than a boolean —
 * `signal.state` is authoritative here, never gated on the whole-signal
 * `notComputableReason` (unlike `subGroundRow`/`verticalRateRow`): an
 * activity with a usable stream but no start/end position renders a healthy
 * sub-ground line and a healthy vertical-rate line beside a
 * position-unknown drift line, which is the entire point of D-02.
 *
 *   1. `state === 'not-computable'` (no usable start/end position): reads
 *      "start/end position unknown — drift not checked", no number invented.
 *   2. `state === 'clear'` with `deltaM === null` (endpoints farther apart
 *      than the loop radius — excluded BY DESIGN, D-01): names the measured
 *      distance and says drift was not checked because this was not a loop.
 *   3. `state === 'clear'` with a real `deltaM` (a genuine loop, under
 *      threshold): D-11's own example phrasing, both numbers present.
 *   4. `state === 'flagged'` (a genuine loop, over threshold): the measured
 *      absolute delta plus the measured endpoint distance.
 *
 * `deltaM` is signed on the underlying signal; this row always shows its
 * absolute value (D-14's Claude's Discretion recommendation). `evidenceText`
 * names the resolved loop radius the detector used, present whenever a shard
 * is available regardless of which of the four states applies — the radius
 * is a property of the detection method, not of the outcome.
 */
function closureDriftRow(signal: ClosureDriftSignal, shard: PaceQualityShard | null): QualitySignalRow {
  let valueText: string;
  let tier: QualityTier | 'untiered';

  if (signal.state === 'not-computable') {
    valueText = 'start/end position unknown — drift not checked';
    tier = 'not-computable';
  } else if (signal.state === 'clear' && signal.deltaM === null) {
    const dist = signal.startEndDistM !== null ? Math.round(signal.startEndDistM) : null;
    valueText =
      dist !== null
        ? `start/end position measured ${dist} m apart — not a loop, so drift was not checked`
        : 'start/end position not a loop — drift was not checked';
    tier = 'none';
  } else if (signal.state === 'flagged') {
    const absDelta = signal.deltaM !== null ? Math.round(Math.abs(signal.deltaM)) : null;
    const dist = signal.startEndDistM !== null ? Math.round(signal.startEndDistM) : null;
    valueText =
      absDelta !== null && dist !== null
        ? `start and end altitudes differ by ${absDelta} m on a loop whose endpoints are ${dist} m apart`
        : 'start/end altitude drift data unavailable';
    tier = 'severe';
  } else {
    // state === 'clear' && deltaM !== null — a genuine loop, under threshold.
    const absDelta = signal.deltaM !== null ? Math.round(Math.abs(signal.deltaM)) : null;
    const dist = signal.startEndDistM !== null ? Math.round(signal.startEndDistM) : null;
    valueText =
      absDelta !== null && dist !== null
        ? `start/end altitude differ by ${absDelta} m (loop, ${dist} m apart)`
        : 'start/end altitude drift data unavailable';
    tier = 'none';
  }

  const evidenceText = shard !== null ? `Loop radius ${shard.elevationLoopRadiusM} m` : null;

  return { label: 'Start/end altitude', valueText, tier, explanation: CLOSURE_DRIFT_EXPLANATION, evidenceText };
}

/**
 * Max-vertical-rate row (D-08, D-11, D-17, Phase 30) — same
 * whole-signal-`notComputableReason`/healthy/tiered shape as `subGroundRow`.
 * A `worstRateMps` of `null` on an otherwise-computable activity reads as
 * data-unavailable, never a fabricated `0 m/s` (T-26-02). `evidenceText`
 * names the offending sample's index and its Δt/Δalt from
 * `shard.elevationVerticalRateSamples` — the same raw scan
 * `elevationSignal`'s own `verticalRateSignal` call performs, never a second
 * independent detector run (mirrors `impossibleSamplesRow`'s exact
 * precedent, one channel over).
 */
function verticalRateRow(
  signal: VerticalRateSignal,
  notComputableReason: string | null,
  shard: PaceQualityShard | null
): QualitySignalRow {
  if (notComputableReason !== null) {
    return {
      label: 'Max vertical rate',
      valueText: `Not computable — ${notComputableReason}`,
      tier: 'not-computable',
      explanation: VERTICAL_RATE_EXPLANATION,
      evidenceText: null,
    };
  }

  let valueText: string;
  if (signal.worstRateMps === null) {
    valueText = 'Vertical-rate data unavailable';
  } else if (signal.flagged) {
    // WR-04 (30-REVIEW.md, T-26-02): `violatingSamples` can be `null` on a
    // flagged row (any non-finite raw value degrades to `null` in
    // `pace-quality-client.ts`'s parse, and the index-row path has no parse
    // at all) — `?? 0` would fabricate a plausible-looking computed zero on
    // a row that is, by definition, severe. State unavailability explicitly
    // instead of coercing it to a count.
    const rate = `max vertical rate ${signal.worstRateMps.toFixed(1)} m/s`;
    valueText =
      signal.violatingSamples === null
        ? `${rate} — violating sample count unavailable`
        : `${rate} across ${signal.violatingSamples} violating sample ${signal.violatingSamples === 1 ? 'pair' : 'pairs'}`;
  } else {
    valueText = `max vertical rate ${signal.worstRateMps.toFixed(1)} m/s`;
  }

  const samples = shard?.elevationVerticalRateSamples ?? [];
  let evidenceText: string | null = null;
  if (samples.length > 0) {
    const worst = samples.reduce((max, s) => (s.rateMps > max.rateMps ? s : max), samples[0]);
    evidenceText = `Sample ${worst.index}: ${worst.rateMps.toFixed(1)} m/s (Δalt ${worst.dAltM.toFixed(1)} m in ${worst.dtSec.toFixed(1)}s)`;
  }

  return {
    label: 'Max vertical rate',
    valueText,
    tier: signal.flagged ? 'severe' : 'none',
    explanation: VERTICAL_RATE_EXPLANATION,
    evidenceText,
  };
}

/**
 * Device-era row (D-08, D-12, D-13, ERA-02) — untiered, always renders
 * `deviceFamilyDisplayName`'s result regardless of the stream's
 * computability (D-06: `deviceEra` passes through unchanged even on a
 * not-computable activity, since it is resolved from metadata alone).
 */
function deviceEraRow(era: DeviceEraSignal): QualitySignalRow {
  return {
    label: 'Device / recording source',
    valueText: deviceFamilyDisplayName(era),
    tier: 'untiered',
    explanation: DEVICE_ERA_EXPLANATION,
    evidenceText: null,
  };
}

/**
 * Elapsed-vs-moving row (D-08, D-14) — untiered. `ratio === null` (absent or
 * non-finite metadata, or `movingSec <= 0`) reads an explicit unavailable
 * statement, never a fabricated `1.00×`.
 */
function elapsedVsMovingRow(signal: ElapsedVsMovingSignal): QualitySignalRow {
  const valueText =
    signal.ratio !== null ? `${signal.ratio.toFixed(2)}× elapsed vs. moving time` : 'Elapsed/moving ratio not available';
  return {
    label: 'Elapsed vs. moving',
    valueText,
    tier: 'untiered',
    explanation: ELAPSED_VS_MOVING_EXPLANATION,
    evidenceText: null,
  };
}

/**
 * Formats one `<n> stretches, <T> total, longest <L> (creep <kc>/<Tc>,
 * paused <kp>/<Tp>)` clause from a COMPUTABLE `ForgottenStopSignal` (every
 * numeric field non-null by construction once `computable` is `true` —
 * `?? 0` below is defensive formatting, never a fabrication of a
 * not-computable state, since the caller only reaches this branch after
 * confirming `computable`).
 */
function forgottenStopStretchesText(signal: ForgottenStopSignal): string {
  return (
    `${signal.count ?? 0} stretches, ${formatEffortDuration(signal.totalSec ?? 0)} total, ` +
    `longest ${formatEffortDuration(signal.longestSec ?? 0)} ` +
    `(creep ${signal.creepCount ?? 0}/${formatEffortDuration(signal.creepTotalSec ?? 0)}, ` +
    `paused ${signal.pauseCount ?? 0}/${formatEffortDuration(signal.pauseTotalSec ?? 0)})`
  );
}

/**
 * Tenth row of the always-on Quality Signals section (Phase 34, PAUSE-02,
 * STOP-01, STOP-03, D-09, D-10, D-11, D-14, plan 34-09) — a SINGLE combined
 * row for both new untiered facts (D-14: "a one-line summary row", not two),
 * always `tier: 'untiered'` (mirroring `elapsedVsMovingRow`'s own choice
 * above — neither `pc` nor `fs` carries a `.tier` to branch on).
 *
 * The two clauses are independently worded and joined with ' · ' (matching
 * `elevationBadgeContent`'s own multi-clause join in `list.ts`):
 *   - the classification clause reads the class counts when
 *     `pc.intervalCount !== null`, or an explicit not-computable statement
 *     otherwise (T-26-02: never a fabricated `0 intervals`); when
 *     `pc.notClassifiableCount` is a positive number, the SAME clause
 *     discloses it as its own trailing parenthetical (D-01, D-22's closing
 *     bullet: "not-classifiable" is not "none", and must never be silently
 *     dropped — `hidden-pause`/`isolated-jump` segments keep only their
 *     Phase 32 mechanism label, never a speed class). `notClassifiableCount
 *     === 0` adds no clause at all (a clean row stays clean); `=== null`
 *     (a stale `index.json` row predating this field, CR-01) also adds no
 *     clause — T-26-02: never an invented zero, and the row otherwise reads
 *     exactly as it did before this disclosure existed;
 *   - the forgotten-stop clause (D-10) reads "none found" for a genuine
 *     zero-stretch computable result, the full itemised figures for a
 *     non-zero one, or "not computable — {reason}" when `fs.computable` is
 *     `false` — NEVER the bare word "none" for a not-computable result,
 *     since that would read as "looked and found none" (D-10's own rule).
 *
 * `notComputableReason` is the WHOLE-SIGNAL not-computable reason (same
 * argument every other row function above takes) — `PauseClassificationSignal`
 * itself carries no `reason` field (unlike `ForgottenStopSignal`, which
 * carries its own), so this is the classification clause's only source of
 * wording when `pc` arrives as the CR-01 fallback literal
 * (`NOT_COMPUTABLE_PAUSE_CLASSIFICATION`, no reason of its own) rather than
 * from a genuinely not-computable stream (where the caller's own
 * `notComputableReason` is set).
 */
function pausesSummaryRow(
  pc: PauseClassificationSignal,
  fs: ForgottenStopSignal,
  notComputableReason: string | null
): QualitySignalRow {
  const fallbackReason = notComputableReason ?? 'not computed for this activity';

  // R4 (34-11-SUMMARY.md's disclosed cosmetic finding): reads as a CATEGORY
  // — "not-classifiable" — rather than naming both mechanisms
  // (isolated-jump AND hidden-pause) unconditionally, which previously
  // implied both kinds of segment exist on a row even when only one does.
  // The exact per-mechanism breakdown is deferred (needs an additive index
  // key) — see
  // `.planning/todos/pending/2026-09-23-not-classifiable-mechanism-breakdown-in-pauses-row.md`.
  const notClassifiableClause =
    pc.notClassifiableCount !== null && pc.notClassifiableCount > 0
      ? ` (${pc.notClassifiableCount} not-classifiable — see Unreliable segments)`
      : '';

  // WR-02: with `parsePauseClassificationSignal` now genuinely all-or-nothing
  // on `pc.intervalCount !== null`, every sibling count field is guaranteed
  // non-null too — the `?? 0` fabrications this branch used to need are gone,
  // so a corrupted document can no longer render counts that silently fail
  // to sum to `intervalCount`.
  const classificationText =
    pc.intervalCount === null
      ? `pause classification not computable — ${fallbackReason}`
      : `${pc.intervalCount} intervals: ${pc.stationaryCount} stationary, ${pc.walkedCount} walked, ` +
        `${pc.ranThroughCount} ran through, ${pc.transportedCount} transported${notClassifiableClause}`;

  // CR-01 render boundary: `fs.count === null` is reachable even given a
  // hand-built/stale signal claiming `computable: true` (the whole-signal
  // parser now rejects that shape, but this boundary defends the render
  // path independently, so the index-row path cannot regress on its own) —
  // treated exactly like `!fs.computable`, never as a coerced zero.
  let forgottenStopText: string;
  if (!fs.computable || fs.count === null) {
    forgottenStopText = `possible forgotten stop: not computable — ${fs.reason ?? fallbackReason}`;
  } else if (fs.count === 0) {
    forgottenStopText = 'possible forgotten stop: none found';
  } else {
    forgottenStopText = `possible forgotten stop: ${forgottenStopStretchesText(fs)}`;
  }

  return {
    label: 'Pauses',
    valueText: `${classificationText} · ${forgottenStopText}`,
    tier: 'untiered',
    explanation: PAUSES_SUMMARY_EXPLANATION,
    evidenceText: null,
  };
}

/**
 * The ten-row fallback for a `quality === null` row (D-08: absence says
 * so, never vanishes; Phase 30 D-11 extended the original five with three
 * always-on elevation entries, Phase 33 SEG-06/plan 33-11 added a ninth,
 * Phase 34/plan 34-09 adds a tenth for Pauses — same literal shape as the
 * other nine).
 */
function notAvailableRows(): QualitySignalRow[] {
  return [
    {
      label: 'Decimation',
      valueText: QUALITY_DATA_NOT_AVAILABLE,
      tier: 'not-computable',
      explanation: tieringExplanation('decimation'),
      evidenceText: null,
    },
    {
      // 'Coverage gaps' (D-11) — matches gapProfileRow's own label in all
      // three of its branches, so a `quality === null` fallback row does
      // not disagree with the label the same signal carries everywhere
      // else.
      label: 'Coverage gaps',
      valueText: QUALITY_DATA_NOT_AVAILABLE,
      tier: 'not-computable',
      explanation: tieringExplanation('gapProfile'),
      evidenceText: null,
    },
    {
      label: 'Impossible samples',
      valueText: QUALITY_DATA_NOT_AVAILABLE,
      tier: 'not-computable',
      explanation: tieringExplanation('impossibleSamples'),
      evidenceText: null,
    },
    {
      label: 'Unreliable segments',
      valueText: QUALITY_DATA_NOT_AVAILABLE,
      tier: 'not-computable',
      explanation: UNRELIABLE_SEGMENTS_EXPLANATION,
      evidenceText: null,
    },
    {
      label: 'Lowest altitude',
      valueText: QUALITY_DATA_NOT_AVAILABLE,
      tier: 'not-computable',
      explanation: SUB_GROUND_EXPLANATION,
      evidenceText: null,
    },
    {
      label: 'Start/end altitude',
      valueText: QUALITY_DATA_NOT_AVAILABLE,
      tier: 'not-computable',
      explanation: CLOSURE_DRIFT_EXPLANATION,
      evidenceText: null,
    },
    {
      label: 'Max vertical rate',
      valueText: QUALITY_DATA_NOT_AVAILABLE,
      tier: 'not-computable',
      explanation: VERTICAL_RATE_EXPLANATION,
      evidenceText: null,
    },
    {
      label: 'Device / recording source',
      valueText: QUALITY_DATA_NOT_AVAILABLE,
      tier: 'untiered',
      explanation: DEVICE_ERA_EXPLANATION,
      evidenceText: null,
    },
    {
      label: 'Elapsed vs. moving',
      valueText: QUALITY_DATA_NOT_AVAILABLE,
      tier: 'untiered',
      explanation: ELAPSED_VS_MOVING_EXPLANATION,
      evidenceText: null,
    },
    {
      label: 'Pauses',
      valueText: QUALITY_DATA_NOT_AVAILABLE,
      tier: 'untiered',
      explanation: PAUSES_SUMMARY_EXPLANATION,
      evidenceText: null,
    },
  ];
}

/**
 * CR-01 (30-REVIEW.md) fallback for a `quality` object that has every
 * pre-Phase-30 sub-key but no `elevation` at all (a stale `index.json`
 * served past its cache TTL, or a staged build lagging the bundle —
 * `ActivityQualitySignals.elevation` is required on the write side, but
 * `index-client.ts` does a blind cast with no field-level validation on the
 * read side). Renders the same not-computable phrasing
 * `notComputableSignals` (`pace-quality.ts`) produces for the whole-signal
 * stream-less cohort.
 */
const NOT_COMPUTABLE_ELEVATION: ElevationSignal = {
  tier: 'not-computable',
  subGround: { flagged: false, minAltM: null },
  closureDrift: { state: 'not-computable', deltaM: null, startEndDistM: null },
  verticalRate: { flagged: false, worstRateMps: null, violatingSamples: null },
};

/**
 * CR-01 (30-REVIEW.md precedent) fallback for a `quality` object that has
 * every pre-Phase-33 sub-key but no `unreliableSegments` at all (Phase 33,
 * SEG-06, plan 33-11) — same stale-`index.json`/lagging-staged-build hazard
 * as `NOT_COMPUTABLE_ELEVATION` above, one signal later.
 */
const NOT_COMPUTABLE_UNRELIABLE_SEGMENTS: UnreliableSegmentsSignal = {
  tier: 'not-computable',
  count: null,
  totalMetres: null,
  totalExcessMetres: null,
  totalSeconds: null,
  excessFraction: null,
  mechanisms: null,
};

/**
 * CR-01 (30-REVIEW.md precedent) fallback for a `quality` object that has
 * every pre-Phase-34 sub-key but no `pauseClassification` at all (Phase 34,
 * PAUSE-02, D-11, plan 34-09) — same stale-`index.json`/lagging-staged-build
 * hazard as `NOT_COMPUTABLE_ELEVATION`/`NOT_COMPUTABLE_UNRELIABLE_SEGMENTS`
 * above, two signals later. Every count `null` (T-26-02: never zeroed, since
 * a zero here would read as "genuinely no pauses classified" rather than
 * "not looked").
 */
export const NOT_COMPUTABLE_PAUSE_CLASSIFICATION: PauseClassificationSignal = {
  intervalCount: null,
  stationaryCount: null,
  walkedCount: null,
  ranThroughCount: null,
  transportedCount: null,
  notClassifiableCount: null,
};

/**
 * CR-01 (30-REVIEW.md precedent) fallback for a `quality` object that has
 * every pre-Phase-34 sub-key but no `forgottenStop` at all (Phase 34,
 * STOP-01, STOP-03, D-09, D-11, plan 34-09) — same hazard, one signal later.
 * `computable: false` with a generic reason (this row's own read-side
 * fallback never claims to know WHY the whole activity is not computable —
 * `pausesSummaryRow`'s own `notComputableReason` parameter is the more
 * specific source when the whole signal itself is not computable).
 */
export const NOT_COMPUTABLE_FORGOTTEN_STOP: ForgottenStopSignal = {
  computable: false,
  reason: 'not computed for this activity',
  count: null,
  totalSec: null,
  longestSec: null,
  creepCount: null,
  creepTotalSec: null,
  creepLongestSec: null,
  pauseCount: null,
  pauseTotalSec: null,
  pauseLongestSec: null,
};

/**
 * Decides the always-on Quality Signals section (D-08, D-09, D-12, D-17,
 * D-18) — pure, no DOM, same `*-logic`/plan split `breakdownSectionPlan`
 * uses and for the same reason (there is no DOM-simulation dependency
 * anywhere in this tree). Unlike `breakdownSectionPlan`, this NEVER returns
 * `null` (D-08): even a `quality === null` row (an index row predating the
 * field, or a re-parsed row missing it — `ParsedDashboardIndexRow` is a
 * `Partial<>`) still produces nine rows, each saying explicitly that
 * quality data is not available, rather than vanishing.
 *
 * `shard` supplies ONLY the `evidenceText` fields — every `valueText` comes
 * from `quality` (the index row's own scalars) alone, so the section still
 * renders its nine value rows even when `shard` is `null` (fetch failed, or
 * still in flight, T-27-31).
 */
export function qualitySignalsSectionPlan(
  quality: ActivityQualitySignals | null,
  shard: PaceQualityShard | null
): QualitySignalsSectionPlan {
  if (quality === null) {
    return { rows: notAvailableRows() };
  }

  const reason = quality.notComputableReason;
  // CR-01 (30-REVIEW.md): `elevation` is REQUIRED by `ActivityQualitySignals`
  // on the write side, but `index-client.ts`'s `fetchDocument()` casts the
  // network response with no field-level validation, so a pre-Phase-30
  // `index.json` (stale browser cache or a lagging staged build) hands this
  // function a `quality` object with the five original sub-keys and no
  // `elevation` key at all. Fall back to the not-computable shape rather
  // than dereferencing `undefined` three lines below.
  const elevation: ElevationSignal = quality.elevation ?? NOT_COMPUTABLE_ELEVATION;
  // Same CR-01 hazard, one signal later (Phase 33, SEG-06, plan 33-11): a
  // pre-Phase-33 `index.json` carries the six original sub-keys and no
  // `unreliableSegments` key at all.
  const unreliableSegments: UnreliableSegmentsSignal =
    quality.unreliableSegments ?? NOT_COMPUTABLE_UNRELIABLE_SEGMENTS;
  // Same CR-01 hazard, two signals later (Phase 34, PAUSE-02/STOP-01/
  // STOP-03, D-11, plan 34-09): a pre-Phase-34 `index.json` carries the
  // eight original sub-keys and no `pauseClassification`/`forgottenStop`
  // keys at all.
  const pauseClassification: PauseClassificationSignal =
    quality.pauseClassification ?? NOT_COMPUTABLE_PAUSE_CLASSIFICATION;
  const forgottenStop: ForgottenStopSignal = quality.forgottenStop ?? NOT_COMPUTABLE_FORGOTTEN_STOP;

  return {
    rows: [
      decimationRow(quality.decimation, reason, shard),
      gapProfileRow(quality.gapProfile, reason, shard),
      impossibleSamplesRow(quality.impossibleSamples, reason, shard),
      unreliableSegmentsRow(unreliableSegments, reason, shard),
      subGroundRow(elevation.subGround, reason, shard),
      closureDriftRow(elevation.closureDrift, shard),
      verticalRateRow(elevation.verticalRate, reason, shard),
      deviceEraRow(quality.deviceEra),
      elapsedVsMovingRow(quality.elapsedVsMoving),
      pausesSummaryRow(pauseClassification, forgottenStop, reason),
    ],
  };
}

/** The `id` a Quality Signals row's `.sr-only` explanation span is given — one per fixed row label, unique within the detail view (only one instance mounts at a time). */
function qualitySignalDescriptionId(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `quality-signal-${slug}-desc`;
}

/**
 * Builds the always-on Quality Signals section (D-08, D-09, D-12, D-17,
 * D-18, T-27-29). Return type is `HTMLElement`, never `HTMLElement | null` —
 * unlike `buildBreakdownSection`'s analogous emitter, this one never omits
 * itself.
 *
 * Every row's `valueText` and `explanation` reach the DOM through
 * `appendAccessibleBadge` (which itself uses `textContent` on both spans,
 * T-18-XSS-01) — no raw-markup DOM assignment of any kind, never
 * string-concatenated markup. This is the surface `deviceEra.rawDeviceName`
 * (untrusted athlete/device free text) first reaches the DOM (T-27-29);
 * `appendAccessibleBadge`'s `textContent`-only construction is the first
 * line of defence, plan 27-04's publish-time scan the second.
 *
 * Only a `'severe'` tier gets the existing `.badge--severe` modifier
 * (reused unchanged from plan 27-07, D-09) — `'minor'`, `'none'`,
 * `'not-computable'`, and `'untiered'` all render the plain `.badge`.
 * Tier is never the ONLY carrier of meaning regardless: every row's visible
 * `valueText` already names the condition and its measured value in text,
 * so the section remains fully legible with colour perception removed.
 */
export function buildQualitySignalsSection(plan: QualitySignalsSectionPlan): HTMLElement {
  const section = document.createElement('section');
  section.className = 'card detail-section';

  const heading = document.createElement('h2');
  heading.className = 'text-heading';
  heading.textContent = 'Quality Signals';
  section.appendChild(heading);

  for (const row of plan.rows) {
    const rowEl = document.createElement('div');
    rowEl.className = 'quality-signal-row';

    const labelEl = document.createElement('div');
    labelEl.className = 'text-label';
    labelEl.textContent = row.label;
    rowEl.appendChild(labelEl);

    appendAccessibleBadge(
      rowEl,
      row.valueText,
      row.explanation,
      qualitySignalDescriptionId(row.label),
      row.tier === 'severe' ? 'badge--severe' : undefined
    );

    if (row.evidenceText !== null) {
      const evidence = document.createElement('p');
      evidence.className = 'text-label';
      evidence.textContent = row.evidenceText;
      rowEl.appendChild(evidence);
    }

    section.appendChild(rowEl);
  }

  return section;
}

// ---------------------------------------------------------------------------
// Pauses section (Phase 34, PAUSE-02, D-14, D-15, D-17, plan 34-09) — the
// per-interval disclosure the Quality Signals summary row above rolls up.
// Fed from the lazy quality shard's `pauseIntervals` list (after first
// paint, `detail.ts`'s `mountBestEffortsAndBadges`), never from the index
// row's own scalars — the opposite data source from `qualitySignalsSectionPlan`
// above, mirroring `buildSplitsSection`'s own pure-plan/DOM-builder split.
// No pace-chart or chart-logic module is touched by this section (D-16).
// ---------------------------------------------------------------------------

/** One rendered row of the Pauses section table (D-14/D-15). */
export interface PausesSectionRow {
  atText: string;
  classText: string;
  durationText: string;
  distanceText: string;
}

/**
 * The full Pauses section decision (D-14/D-15) — pure, no DOM, same
 * `*-logic`/plan split every other section builder in this file uses.
 * `'unavailable'` (shard fetch failed, or still in flight, T-27-31) and
 * `'empty'` (shard present, genuinely zero pause/gap intervals) are DISTINCT
 * states with distinct copy (the plan's own two named empty strings) —
 * collapsing them would misdescribe a failed fetch as "no pauses found".
 *
 * IN-01 (2026-09-23, plan 34-16): `'not-computable'` is a THIRD, distinct
 * empty-list state — the shard fetch succeeded and the list is genuinely
 * empty, but the ACTIVITY's own quality data was not computable (no stream,
 * or another whole-signal not-computable cause), so "zero rows" here means
 * "could not look", not "looked and found none" (D-10's own rule, extended
 * to this section for the first time).
 */
export type PausesSectionPlan =
  | { kind: 'unavailable' }
  | { kind: 'empty' }
  | { kind: 'not-computable' }
  | { kind: 'rows'; rows: PausesSectionRow[]; truncated: boolean };

/**
 * Human-readable label for each `PauseClass` (D-14's copy) — the single
 * source of class wording `pausesSectionRowClassText` below builds on.
 * Exhaustive `switch` with NO `default` branch, matching
 * `deviceFamilyDisplayName`/`segmentMechanismLabel`'s own precedent — a
 * fifth `PauseClass` member added in a later phase without a matching case
 * here fails `npx tsc --noEmit` rather than silently falling through.
 */
function pauseClassLabel(pauseClass: PauseClass): string {
  switch (pauseClass) {
    case 'stationary':
      return 'Stationary';
    case 'walked':
      return 'Walked';
    case 'ran-through':
      return 'Ran through';
    case 'transported':
      return 'Transported';
  }
}

/**
 * D-14's copy: a covered-creep row's class cell names the possible
 * forgotten stop; a zero-advance-pause row names the plain pause — both are
 * timer-running standstill facts (D-09), marked here rather than left
 * indistinguishable from a recording-gap/merged-segment row carrying the
 * same `pauseClass`. Every other source renders the plain class label.
 */
function pausesSectionRowClassText(pauseClass: PauseClass, source: PauseSource): string {
  const base = pauseClassLabel(pauseClass);
  if (source === 'covered-creep') return `${base} — possible forgotten stop (timer running)`;
  if (source === 'zero-advance-pause') return `${base} — paused (timer running)`;
  return base;
}

/**
 * Decides the Pauses section (D-14, D-15, D-17) — pure, no DOM. `shard`
 * alone determines the plan's `kind`: `null` (fetch failed, or still in
 * flight) is `'unavailable'`; a present shard with zero `pauseIntervals`
 * entries is `'empty'`; otherwise every entry becomes one row, IN THE
 * SHARD'S OWN ORDER (`projectPauseIntervals`, `pace-quality.ts`, already
 * sorts by `startSec` — this function performs no re-sort of its own). No
 * row here can come from anything but `shard.pauseIntervals` (D-15:
 * `shard.unreliableSegments` entries — isolated-jump/hidden-pause segments —
 * never leak into this list, matching D-01/D-15's own membership rule).
 *
 * IN-01 (2026-09-23, plan 34-16): `quality` is now USED, not discarded —
 * `shard.pauseIntervals` degrades to an empty list for BOTH a genuinely
 * clean activity and a not-computable one (`buildPaceQualityShard`'s own
 * not-computable branches), so an empty list alone cannot tell the two
 * apart. When the list is empty, `quality === null` or a set
 * `quality.notComputableReason` means the WHOLE activity's quality data was
 * not computable (no stream, most commonly) — that reads `'not-computable'`
 * rather than `'empty'`, so a reader is never told "looked and found none"
 * (D-10's own rule) about an activity that was never looked at.
 */
export function pausesSectionPlan(
  shard: PaceQualityShard | null,
  quality: ActivityQualitySignals | null
): PausesSectionPlan {
  if (shard === null) {
    return { kind: 'unavailable' };
  }
  if (shard.pauseIntervals.length === 0) {
    if (quality === null || quality.notComputableReason !== null) {
      return { kind: 'not-computable' };
    }
    return { kind: 'empty' };
  }
  const rows: PausesSectionRow[] = shard.pauseIntervals.map((entry) => ({
    atText: `${formatEffortDuration(entry.startSec)} · km ${(entry.startMetres / 1000).toFixed(2)}`,
    classText: pausesSectionRowClassText(entry.pauseClass, entry.source),
    durationText: formatEffortDuration(entry.seconds),
    distanceText: `${Math.round(entry.metres)} m`,
  }));
  return { kind: 'rows', rows, truncated: shard.pauseIntervalsTruncated };
}

/** D-14's one-sentence legend, verbatim. */
const PAUSES_LEGEND_TEXT =
  "Class is judged from each interval's own distance over its own elapsed time. GPS jumps are not listed here; see Unreliable segments.";

/**
 * D-15's truncation disclosure. WR-07 (2026-09-23, plan 34-16): built from
 * `SHARD_LIST_CAP` rather than repeating its number as a bare literal, so
 * changing the cap can never silently make this sentence a lie.
 */
const PAUSES_TRUNCATION_TEXT = `Showing the first ${SHARD_LIST_CAP} intervals.`;

/**
 * Builds the Pauses section (D-14, D-15, T-34-30) — same `<section
 * class="card detail-section">` + `<h2>` + empty-state-else-`<table>` shape
 * `buildSplitsSection` uses above, reusing that function's `.splits-scroll`/
 * `.splits-table` classes rather than inventing new CSS (this plan touches
 * no chart module and adds no new stylesheet rule, D-16). Every string here
 * reaches the DOM through `textContent` only (T-18-XSS-01/T-34-30) — no
 * `innerHTML`, `insertAdjacentHTML` or `outerHTML` anywhere in this
 * function's body.
 */
export function buildPausesSection(plan: PausesSectionPlan): HTMLElement {
  const section = document.createElement('section');
  section.className = 'card detail-section';

  const heading = document.createElement('h2');
  heading.className = 'text-heading';
  heading.textContent = 'Pauses';
  section.appendChild(heading);

  if (plan.kind === 'unavailable') {
    const empty = document.createElement('p');
    empty.className = 'text-body';
    empty.textContent = 'Pause detail unavailable.';
    section.appendChild(empty);
    return section;
  }

  if (plan.kind === 'empty') {
    const empty = document.createElement('p');
    empty.className = 'text-body';
    empty.textContent = 'No pauses or recording gaps in this activity.';
    section.appendChild(empty);
    return section;
  }

  if (plan.kind === 'not-computable') {
    // IN-01: distinguishable from the 'empty' copy above — this activity's
    // quality data was not computable, so an empty list here means "could
    // not look", never "looked and found none" (D-10).
    const notComputable = document.createElement('p');
    notComputable.className = 'text-body';
    notComputable.textContent = 'Pause detail not computable for this activity.';
    section.appendChild(notComputable);
    return section;
  }

  const scroll = document.createElement('div');
  scroll.className = 'splits-scroll';

  const table = document.createElement('table');
  table.className = 'splits-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const headerText of ['At', 'Class', 'Duration', 'Distance']) {
    const th = document.createElement('th');
    th.textContent = headerText;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of plan.rows) {
    const tr = document.createElement('tr');
    tr.appendChild(buildTextCell(row.atText));
    tr.appendChild(buildTextCell(row.classText));
    tr.appendChild(buildTextCell(row.durationText));
    tr.appendChild(buildTextCell(row.distanceText));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  scroll.appendChild(table);
  section.appendChild(scroll);

  const legend = document.createElement('p');
  legend.className = 'text-label';
  legend.textContent = PAUSES_LEGEND_TEXT;
  section.appendChild(legend);

  if (plan.truncated) {
    const truncationNote = document.createElement('p');
    truncationNote.className = 'text-label';
    truncationNote.textContent = PAUSES_TRUNCATION_TEXT;
    section.appendChild(truncationNote);
  }

  return section;
}
