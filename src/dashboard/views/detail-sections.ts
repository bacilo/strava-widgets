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
// formatPace, formatDurationHms, formatEffortDuration, appendBadge, and
// appendLowConfidenceBadge are the dashboard's only pace/duration/badge
// builders (list.ts) — imported rather than duplicated, matching the
// precedent detail.ts already set for formatPace.
import { formatPace, formatDurationHms, formatEffortDuration, appendBadge, appendLowConfidenceBadge } from './list.js';
import type { BestEffortPanelRow } from './detail-best-efforts-logic.js';
import type { PaceCoverage, GapInterval } from '../../analytics/pace-derivation.js';
import { unbucketedCoveredSec } from '../../analytics/pace-derivation.js';

// Same em dash as `DASH` in detail.ts. Defined locally rather than imported:
// detail.ts imports THIS module, so importing back would create a cycle.
// Both copies must stay identical — see detail.ts's own `DASH` constant.
const DASH = '—';

/**
 * Coverage caption text for the `Pace Distribution` heading (D-08, COV-02).
 * Reads directly from the same `PaceCoverage` the histogram beside it is
 * built from — never recomputed independently — so the two cannot drift
 * apart (D-16's structural guarantee made visible on screen).
 *
 * Returns `null` when `spanSec` is not positive (no stream, or a
 * zero-length span); the caller then appends nothing. Otherwise always
 * renders all three named segments — covered, recording gaps, paused —
 * even at 0%, so a clean run states its own health rather than the reader
 * inferring it from an absent line (D-08's always-on requirement).
 *
 * Each percentage is `Math.round`ed INDEPENDENTLY from `coverage.coveredSec
 * / coverage.spanSec`, etc. The three rounded integers may not sum to
 * exactly 100 (a cosmetic display artifact of independent rounding) — this
 * is deliberate and must never be "corrected" by forcing a 100% total,
 * which would falsify one of the individual category values against
 * COV-01's exact-second sum (asserted on the unrounded seconds elsewhere).
 */
export function coverageCaptionText(coverage: PaceCoverage): string | null {
  if (coverage.spanSec <= 0) return null;

  const coveredPercent = Math.round((coverage.coveredSec / coverage.spanSec) * 100);
  const recordingGapPercent = Math.round((coverage.recordingGapSec / coverage.spanSec) * 100);
  const pausePercent = Math.round((coverage.pauseSec / coverage.spanSec) * 100);

  return `${coveredPercent}% of elapsed time covered · ${recordingGapPercent}% recording gaps · ${pausePercent}% paused`;
}

/**
 * One split's accumulated overlap with the stream's gap intervals (D-09,
 * PACE-05). `recordingGapSec` and `pauseSec` are accumulated separately
 * since a split's window can cross more than one gap, of mixed kinds;
 * `totalSec` is their sum, the exact quantity the marker/legend states.
 */
export interface SplitGapAnnotation {
  km: number;
  recordingGapSec: number;
  pauseSec: number;
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

    for (const gap of gapIntervals) {
      const overlapStart = Math.max(split.startTimeSec, gap.startSec);
      const overlapEnd = Math.min(split.endTimeSec, gap.endSec);
      const overlapSec = overlapEnd - overlapStart;
      if (overlapSec > 0) {
        if (gap.kind === 'recording-gap') {
          recordingGapSec += overlapSec;
        } else {
          pauseSec += overlapSec;
        }
      }
    }

    const totalSec = recordingGapSec + pauseSec;
    if (totalSec > 0) {
      result.push({ km: split.km, recordingGapSec, pauseSec, totalSec });
    }
  }

  return result;
}

/**
 * Picks the single named category ("recording gap" or "pause") a mixed
 * split annotation is described by, for the marker `aria-label` and the
 * legend line (both carry exactly one category name per the UI-SPEC's
 * `{recording gap|pause}` copy contract). The larger accumulated duration
 * wins; a tie (including the common case of one category being exactly 0)
 * favours `recording-gap`, since a stopped recording is the more
 * significant disclosure of the two categories.
 */
function dominantGapKindLabel(annotation: SplitGapAnnotation): 'recording gap' | 'pause' {
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
 * the stream-derived pace as `activityAvgPaceSecPerKm` in place of the
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
    note.textContent = `Splits above are compared against the stream-derived average (${formatPace(activityAvgPaceSecPerKm)}), not the disputed metadata average.`;
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

/** Builds the PR? cell: a plain `PR` badge when `isPr`, plus the low-confidence and excluded badges when applicable. */
function buildPrFlagsCell(row: BestEffortPanelRow, exclusionReason: string | null): HTMLTableCellElement {
  const cell = document.createElement('td');

  if (row.isPr) {
    appendBadge(cell, 'PR');
  }
  if (row.lowConfidence) {
    appendLowConfidenceBadge(cell, `best-efforts-${row.distance}`);
  }
  if (row.excluded) {
    appendBadge(cell, exclusionReason ? `Excluded — ${exclusionReason}` : 'Excluded from records');
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
