/**
 * Calendar training log (`#/calendar`) — BROWSE-05's real DOM-wiring view.
 *
 * All date math and per-day aggregation lives in `calendar-logic.ts` (plan
 * 17-03, pure and unit-tested); this module is deliberately thin: parse the
 * `?month=` query param, build a grid from the shared `IndexClient`, and
 * wire navigation/picker interactions.
 *
 * D-16 independence: this module imports nothing from the list's pure
 * filter-query module and never reads the list's filter state — the
 * calendar always shows every run in the requested month, derived straight
 * from the shared index, so a filtered month never renders as a false gap
 * in the training log.
 */

import type { DashboardView, ViewMountContext } from '../view.types.js';
import { ROUTES } from '../view.types.js';
import type { IndexClient } from '../data/index-client.js';
import { navigateTo } from '../router.js';
import { formatActivityDate, renderActivityRow } from './list.js';
import {
  buildMonthGrid,
  formatMonthParam,
  monthLabel,
  parseMonthParam,
  shiftMonth,
  type CalendarMonth,
  type DayCell,
} from './calendar-logic.js';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Full date text for a day cell's `aria-label`, e.g. "August 11, 2026".
 * Derived from `monthLabel` (which already produces "{Month} {year}")
 * rather than a second month-name table.
 */
function fullDateLabel(cell: DayCell, month: CalendarMonth): string {
  const [monthName, year] = monthLabel(month).split(' ');
  return `${monthName} ${cell.dayOfMonth}, ${year}`;
}

/**
 * Visible text for a prev/next nav button. Per 17-UI-SPEC, the year is
 * stripped when the adjacent month falls in the same year as `current` and
 * kept when it differs (so a December→January crossing stays unambiguous).
 */
function adjacentMonthLabel(target: CalendarMonth, current: CalendarMonth): string {
  const full = monthLabel(target);
  if (target.year === current.year) {
    return full.split(' ')[0];
  }
  return full;
}

/**
 * Renders (or replaces) the multi-run picker panel inside `pickerHost`.
 * Rows reuse `renderActivityRow` from `list.ts` (D-04: one shared card
 * renderer) — ids the index doesn't know are skipped, never thrown on
 * (T-17-CAL-03). Focus moves to the panel heading when it opens.
 */
function renderPicker(pickerHost: HTMLElement, cell: DayCell, indexClient: IndexClient): void {
  pickerHost.replaceChildren();

  const panel = document.createElement('section');
  panel.className = 'calendar-picker';

  const heading = document.createElement('h2');
  heading.className = 'text-heading';
  heading.setAttribute('tabindex', '-1');
  heading.textContent = `${cell.runCount} runs on ${formatActivityDate(cell.dateKey)}`;
  panel.appendChild(heading);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => {
    pickerHost.replaceChildren();
  });
  panel.appendChild(closeBtn);

  const listEl = document.createElement('div');
  listEl.className = 'activity-list';
  for (const id of cell.activityIds) {
    const row = indexClient.getRow(id);
    if (!row) continue;
    listEl.appendChild(renderActivityRow(row));
  }
  panel.appendChild(listEl);

  pickerHost.appendChild(panel);
  heading.focus();
}

/**
 * Builds one `.calendar-day` button. Every grid position — including a
 * `null` (outside-the-month) slot — renders a real button so the Tab order
 * is identical every month (17-UI-SPEC § 3 Calendar).
 */
function buildDayCellButton(
  cell: DayCell | null,
  month: CalendarMonth,
  onOpenPicker: (cell: DayCell) => void
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'calendar-day';

  if (cell === null) {
    btn.classList.add('calendar-day--outside');
    btn.setAttribute('aria-hidden', 'true');
    btn.disabled = true;
    return btn;
  }

  const numberEl = document.createElement('span');
  numberEl.className = 'calendar-day__number';
  numberEl.textContent = String(cell.dayOfMonth);
  btn.appendChild(numberEl);

  const distanceEl = document.createElement('span');
  distanceEl.className = 'calendar-day__distance';

  if (cell.runCount === 0) {
    // Rest day: still a real, focusable button for a consistent Tab order,
    // but no click handler and aria-disabled so assistive tech doesn't
    // announce a false affordance.
    btn.classList.add('calendar-day--rest');
    distanceEl.textContent = '–';
    btn.appendChild(distanceEl);
    btn.setAttribute('aria-disabled', 'true');
    btn.setAttribute('aria-label', `${fullDateLabel(cell, month)}, rest day`);
    return btn;
  }

  btn.classList.add(`calendar-day--tint-${cell.tintStep}`);
  const km = (cell.totalDistanceM / 1000).toFixed(1);
  distanceEl.textContent = `${km} km`;
  btn.appendChild(distanceEl);

  if (cell.runCount > 1) {
    const countEl = document.createElement('span');
    countEl.className = 'calendar-day__count';
    countEl.textContent = `×${cell.runCount}`;
    btn.appendChild(countEl);
  }

  const runsWord = cell.runCount === 1 ? 'run' : 'runs';
  btn.setAttribute(
    'aria-label',
    `${fullDateLabel(cell, month)}, ${km} km, ${cell.runCount} ${runsWord}`
  );

  btn.addEventListener('click', () => {
    if (cell.runCount === 1) {
      navigateTo(ROUTES.DETAIL.replace(':id', cell.activityIds[0]));
    } else {
      onOpenPicker(cell);
    }
  });

  return btn;
}

export interface CalendarViewDeps {
  indexClient: IndexClient;
}

export function createCalendarView(deps: CalendarViewDeps): DashboardView {
  const { indexClient } = deps;
  let mountedContainer: HTMLElement | null = null;

  return {
    route: ROUTES.CALENDAR,
    title: 'Calendar',

    async mount(ctx: ViewMountContext): Promise<void> {
      mountedContainer = ctx.container;
      ctx.container.replaceChildren();

      const loading = document.createElement('div');
      loading.className = 'loading-indicator';
      loading.setAttribute('role', 'status');
      loading.textContent = 'Loading calendar…';
      ctx.container.appendChild(loading);

      try {
        // Use the SHARED indexClient injected by the registry — the index
        // is 1.22 MB and memoized once per session; never construct a
        // second client here (17-RESEARCH.md Anti-Patterns).
        await indexClient.loadIndex();
      } catch (error) {
        console.error(error);
        // A rejection can arrive after the user navigated away — must not
        // wipe the newly-mounted view (WR-01).
        if (mountedContainer !== ctx.container) {
          return;
        }
        ctx.container.replaceChildren();
        const errorState = document.createElement('section');
        errorState.className = 'error-state';
        const heading = document.createElement('h2');
        heading.className = 'text-heading';
        heading.textContent = "Couldn't load the calendar";
        const body = document.createElement('p');
        body.className = 'text-body';
        body.textContent = 'Check your connection and try again.';
        errorState.appendChild(heading);
        errorState.appendChild(body);
        ctx.container.appendChild(errorState);
        return;
      }

      // mount() may resolve after the view was unmounted (fast navigation
      // away before the index finished loading) — guard against painting
      // into a container this view no longer owns.
      if (mountedContainer !== ctx.container) {
        return;
      }

      ctx.container.replaceChildren();

      const view = document.createElement('div');
      view.className = 'view';

      // Constructed fresh at the call site and passed in — parseMonthParam
      // itself stays deterministic and total (T-17-URL-04).
      const month = parseMonthParam(ctx.query.get('month'), new Date());

      const h1 = document.createElement('h1');
      h1.className = 'text-heading';
      h1.textContent = 'Calendar';
      h1.setAttribute('tabindex', '-1');
      view.appendChild(h1);

      // TODO(22-03): pass the persisted WeekStart preference here instead of
      // the literal 'sunday' — this call site is temporarily pinned to
      // preserve today's runtime behavior until plan 22-03 wires the
      // segmented toggle and calendar-preferences.ts's stored value in.
      const grid = buildMonthGrid(indexClient.getRows(), month, 'sunday');

      const header = document.createElement('div');
      header.className = 'calendar-header';

      const totalEl = document.createElement('div');
      totalEl.className = 'text-display';
      totalEl.textContent = `${(grid.monthTotalM / 1000).toFixed(1)} km`;
      header.appendChild(totalEl);

      const captionEl = document.createElement('div');
      captionEl.className = 'text-label';
      captionEl.textContent = `across ${grid.runCount} runs`;
      header.appendChild(captionEl);

      const nav = document.createElement('div');
      nav.className = 'calendar-nav';

      const prevMonth = shiftMonth(month, -1);
      const nextMonth = shiftMonth(month, 1);

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.textContent = `‹ ${adjacentMonthLabel(prevMonth, month)}`;
      prevBtn.addEventListener('click', () => {
        navigateTo(ROUTES.CALENDAR, new URLSearchParams({ month: formatMonthParam(prevMonth) }));
      });
      nav.appendChild(prevBtn);

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.textContent = `${adjacentMonthLabel(nextMonth, month)} ›`;
      nextBtn.addEventListener('click', () => {
        navigateTo(ROUTES.CALENDAR, new URLSearchParams({ month: formatMonthParam(nextMonth) }));
      });
      nav.appendChild(nextBtn);

      header.appendChild(nav);

      const jumpWrapper = document.createElement('div');
      jumpWrapper.className = 'calendar-jump';
      const jumpLabel = document.createElement('label');
      jumpLabel.textContent = 'Jump to month';
      const jumpInput = document.createElement('input');
      jumpInput.type = 'month';
      jumpInput.value = formatMonthParam(month);
      jumpInput.addEventListener('change', () => {
        const parsed = parseMonthParam(jumpInput.value, new Date());
        navigateTo(ROUTES.CALENDAR, new URLSearchParams({ month: formatMonthParam(parsed) }));
      });
      jumpLabel.appendChild(jumpInput);
      jumpWrapper.appendChild(jumpLabel);
      header.appendChild(jumpWrapper);

      view.appendChild(header);

      const gridEl = document.createElement('div');
      gridEl.className = 'calendar-grid';

      for (const wd of WEEKDAY_LABELS) {
        const wdEl = document.createElement('div');
        wdEl.className = 'calendar-weekday';
        wdEl.textContent = wd;
        gridEl.appendChild(wdEl);
      }

      // Rendered below the grid, not a modal or tooltip — cleared whenever
      // a different day opens the picker, or the view unmounts.
      const pickerHost = document.createElement('div');

      const flatCells = grid.weeks.flat();
      for (const cell of flatCells) {
        gridEl.appendChild(
          buildDayCellButton(cell, month, (openedCell) => renderPicker(pickerHost, openedCell, indexClient))
        );
      }

      view.appendChild(gridEl);
      view.appendChild(pickerHost);

      ctx.container.appendChild(view);

      // Every hash navigation announces a context change to assistive tech
      // (17-UI-SPEC § 5 Cross-Surface focus management).
      h1.focus();
    },

    unmount(): void {
      mountedContainer?.replaceChildren();
      mountedContainer = null;
    },
  };
}
