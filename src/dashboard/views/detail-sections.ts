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
// formatPace and formatDurationHms are the dashboard's only pace/duration
// formatters (list.ts) — imported rather than duplicated, matching the
// precedent detail.ts already set for formatPace.
import { formatPace, formatDurationHms } from './list.js';

// Same em dash as `DASH` in detail.ts. Defined locally rather than imported:
// detail.ts imports THIS module, so importing back would create a cycle.
// Both copies must stay identical — see detail.ts's own `DASH` constant.
const DASH = '—';

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
 */
export function buildSplitsSection(
  splits: readonly Split[],
  activityAvgPaceSecPerKm: number | null
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

  const tbody = document.createElement('tbody');
  for (const split of splits) {
    const row = document.createElement('tr');
    row.appendChild(buildKmCell(split));
    row.appendChild(buildTextCell(formatPace(split.paceSecPerKm)));
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
  return section;
}
