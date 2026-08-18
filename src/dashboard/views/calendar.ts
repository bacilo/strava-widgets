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
  type MonthGrid,
  type WeekStart,
  type WeekTotal,
} from './calendar-logic.js';
import {
  readStoredWeekStart,
  resolveWeekStartStorage,
  writeWeekStart,
  type WeekStartStorage,
} from './calendar-preferences.js';

const WEEKDAY_NAMES_SUNDAY_FIRST = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Week-start-aware weekday header labels (DISC-4). `'sunday'` returns the
 * Sunday-first array unchanged; `'monday'` returns the same seven names
 * rotated left by one (Mon..Sun) — a rotation, not a rewrite, so both
 * orderings always contain the same seven names.
 */
export function weekdayLabels(weekStart: WeekStart): readonly string[] {
  if (weekStart === 'sunday') return WEEKDAY_NAMES_SUNDAY_FIRST;
  return [...WEEKDAY_NAMES_SUNDAY_FIRST.slice(1), WEEKDAY_NAMES_SUNDAY_FIRST[0]];
}

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
 * Formats a week total's summed moving time as `"{h}h {m}m"` (or `"{m}m"`
 * when the hour count is 0) — DISC-2. This is a NEW formatter, not a reuse
 * of `list.ts`'s `formatDurationHms` (`h:mm:ss`, shaped for one activity's
 * moving time, e.g. `"1:32:00"`) or `formatEffortDuration` (shaped for a
 * standalone effort/PR time usually under an hour) — a week total is a
 * different kind of duration (always likely well over an hour, an
 * aggregate rather than a per-activity figure), and CONTEXT.md's own D-14
 * illustrative aria-label example ("...1h 32m...") already implies this
 * "Xh Ym" shape without seconds.
 *
 * ROUNDING IS LOAD-BEARING (see 22-03-PLAN.md `<rounding_is_load_bearing>`):
 * plan 22-05's blocking checkpoint reads ten week-total time values back
 * from the browser against tables computed with round-to-nearest-minute.
 * Truncating instead would make 8 of those 10 rows disagree by one minute
 * and record a false FAIL against correct code. Total function: a
 * non-finite or non-positive input returns `"0m"` rather than `NaN`.
 */
export function formatWeekDuration(totalTimeSec: number): string {
  if (!Number.isFinite(totalTimeSec) || totalTimeSec <= 0) return '0m';
  const totalMinutes = Math.round(totalTimeSec / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * The `.sr-only` accessible name for a week-total cell (DISC-9/D-11/D-14).
 * Built as ONE template literal per case, mirroring `buildDayCellButton`'s
 * rest-day branch having its own whole sentence rather than splicing an
 * optional segment into the normal sentence. The date range is derived from
 * the first and last non-null cells in `week`, using the en-dash U+2013 (the
 * same glyph as the rest-day cell) rather than a hyphen-minus.
 */
export function weekTotalAccessibleName(
  total: WeekTotal,
  week: readonly (DayCell | null)[],
  month: CalendarMonth
): string {
  const cells = week.filter((c): c is DayCell => c !== null);
  if (cells.length === 0) return 'Empty week';

  const [monthName, year] = monthLabel(month).split(' ');
  const first = cells[0];
  const last = cells[cells.length - 1];
  const range =
    first.dayOfMonth === last.dayOfMonth
      ? `${monthName} ${first.dayOfMonth}, ${year}`
      : `${monthName} ${first.dayOfMonth}–${last.dayOfMonth}, ${year}`;

  const dayWord = total.daysShown === 1 ? 'day' : 'days';
  const prefix = total.isPartial
    ? `Partial week, ${total.daysShown} ${dayWord} shown, week of ${range}`
    : `Week of ${range}`;

  if (total.runCount === 0) return `${prefix}, rest week`;

  const km = (total.totalDistanceM / 1000).toFixed(1);
  const duration = formatWeekDuration(total.totalTimeSec);
  const runsWord = total.runCount === 1 ? 'run' : 'runs';
  return `${prefix}, ${km} km, ${duration}, ${total.runCount} ${runsWord}`;
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

/**
 * Builds one `.calendar-week-total` cell, appended after a week row's seven
 * day buttons (D-10). Always a `div` — never a `<button>`, never given a
 * focus-index attribute or an ARIA role (D-11): each week row's Tab stops
 * still end at day 7, and `buildDayCellButton`'s every-slot-is-a-real-button
 * invariant above is untouched. A `.sr-only` span carries the full
 * accessible name (DISC-9, via `weekTotalAccessibleName`, already
 * unit-covered in `calendar.test.ts`) and every visible span is
 * `aria-hidden` so the name is announced once, not twice. Every string
 * reaches the DOM via a `textContent` assignment, never via raw markup
 * injection (T-18-XSS-01).
 */
function buildWeekTotalCell(
  total: WeekTotal,
  week: readonly (DayCell | null)[],
  month: CalendarMonth
): HTMLElement {
  const cellEl = document.createElement('div');
  cellEl.className = 'calendar-week-total';

  const nameEl = document.createElement('span');
  nameEl.className = 'sr-only';
  nameEl.textContent = weekTotalAccessibleName(total, week, month);
  cellEl.appendChild(nameEl);

  const distanceEl = document.createElement('span');
  distanceEl.className = 'calendar-week-total__distance';
  distanceEl.setAttribute('aria-hidden', 'true');

  if (total.runCount === 0) {
    // Rest week: only the en-dash, matching the rest-day cell's `–`
    // (calendar.ts:206 above). No time or count span at all — omitted,
    // not `0h 0m` / `×0` (D-12). The cell renders identically for a
    // partial and a full rest week (D-14) — the disclosure lives only in
    // the .sr-only sentence built above.
    distanceEl.textContent = '–';
    cellEl.appendChild(distanceEl);
    return cellEl;
  }

  distanceEl.textContent = `${(total.totalDistanceM / 1000).toFixed(1)} km`;
  cellEl.appendChild(distanceEl);

  const timeEl = document.createElement('span');
  timeEl.className = 'calendar-week-total__time';
  timeEl.setAttribute('aria-hidden', 'true');
  timeEl.textContent = formatWeekDuration(total.totalTimeSec);
  cellEl.appendChild(timeEl);

  const countEl = document.createElement('span');
  countEl.className = 'calendar-week-total__count';
  countEl.setAttribute('aria-hidden', 'true');
  countEl.textContent = `×${total.runCount}`;
  cellEl.appendChild(countEl);

  return cellEl;
}

/**
 * Builds the weekday header row (week-start-aware, plus a fixed "Total" 8th
 * cell) and every week's seven day buttons followed by its total cell, then
 * replaces `.calendar-grid`'s children in one `replaceChildren` call. The
 * weekday label row already lives INSIDE `.calendar-grid`, so this one call
 * covers both the header row and the day/total rows. `.calendar-grid` has 8
 * CSS grid tracks (D-10, plan 22-02's CSS), so appending 8 children per
 * week lets grid auto-flow wrap onto the next row with no manual
 * row/column index bookkeeping — the same reason the previous flat loop
 * worked with 7.
 */
function renderGrid(
  gridEl: HTMLElement,
  grid: MonthGrid,
  month: CalendarMonth,
  weekStart: WeekStart,
  pickerHost: HTMLElement,
  indexClient: IndexClient
): void {
  const children: HTMLElement[] = [];

  for (const wd of weekdayLabels(weekStart)) {
    const wdEl = document.createElement('div');
    wdEl.className = 'calendar-weekday';
    wdEl.textContent = wd;
    children.push(wdEl);
  }

  const totalHeaderEl = document.createElement('div');
  totalHeaderEl.className = 'calendar-weekday calendar-weekday--total';
  totalHeaderEl.textContent = 'Total';
  children.push(totalHeaderEl);

  grid.weeks.forEach((week, i) => {
    for (const cell of week) {
      children.push(
        buildDayCellButton(cell, month, (openedCell) => renderPicker(pickerHost, openedCell, indexClient))
      );
    }
    children.push(buildWeekTotalCell(grid.weekTotals[i], week, month));
  });

  gridEl.replaceChildren(...children);
}

export interface CalendarViewDeps {
  indexClient: IndexClient;
  storage?: WeekStartStorage;
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

      // Resolved lazily here (not as a field initializer or a parameter
      // default) so this module stays importable in the Node test
      // environment with no `localStorage` global — the same discipline
      // `theme.ts`'s `applyThemeMode` and `detail-charts.ts`'s
      // `mountChartBands` already follow. The resolution itself is
      // delegated to `calendar-preferences.ts` (CR-01, BL-03): under
      // blocked site data, the storage global's property access throws
      // BEFORE any getItem/setItem call could run. An unguarded read
      // reached here at module-mount time would take down the entire
      // dashboard module graph — the page would render blank, with no nav
      // and no view content, and `main.ts`'s error panel would NOT be
      // reachable, because that try/catch wraps `view.mount(...)` inside
      // `onMatch`, which never runs if module evaluation itself fails.
      // This is why Round 3 moved the guard into the shared
      // `src/dashboard/storage.ts` and applied it at every bootstrap-
      // reachable site; this call site delegates to that same guard via
      // `resolveWeekStartStorage`.
      const storage = resolveWeekStartStorage(deps.storage);
      // `let`, not `const` — plan 22-04's toggle handler reassigns both.
      let weekStart = readStoredWeekStart(storage);
      let grid = buildMonthGrid(indexClient.getRows(), month, weekStart);

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

      // D-01: a `.segmented` Sun/Mon toggle, not a `<select>` — a faithful
      // THIRD instance of the shape already shipped at `records.ts:633-652`
      // (Records scope) and `detail-charts.ts:257-276` (chart x-axis). This
      // is a deliberate divergence from 19-CONTEXT.md D-01's "week-start
      // select" parenthetical: the segmented pattern won on consistency with
      // the two toggles already shipped, so CAL-03 is discharged through
      // Phase 19's BUTTON baseline (D-05/D-06) and its two-tone focus ring
      // (D-09/D-10) rather than its `input, select, textarea` baseline. No
      // new CSS is required — `.segmented`/`.segmented__option[--active]`
      // (styles.css:897-954) and the shared hover/focus rules already reach
      // a third instance with zero opt-in.
      const weekStartControl = document.createElement('div');
      weekStartControl.className = 'segmented';
      weekStartControl.setAttribute('role', 'group');
      weekStartControl.setAttribute('aria-label', 'Week start');

      // Unlike both shipped instances (which always start on their
      // first-listed option), this control's initial active state is
      // DERIVED from the week start already read from storage above, not
      // hard-coded — with nothing stored, `weekStart` is 'monday' (D-03), so
      // Monday starts active.
      const isSunday = weekStart === 'sunday';

      const sundayOption = document.createElement('button');
      sundayOption.type = 'button';
      sundayOption.className = isSunday ? 'segmented__option segmented__option--active' : 'segmented__option';
      sundayOption.textContent = 'Sunday';
      sundayOption.setAttribute('aria-pressed', String(isSunday));

      const mondayOption = document.createElement('button');
      mondayOption.type = 'button';
      mondayOption.className = isSunday ? 'segmented__option' : 'segmented__option segmented__option--active';
      mondayOption.textContent = 'Monday';
      mondayOption.setAttribute('aria-pressed', String(!isSunday));

      weekStartControl.appendChild(sundayOption);
      weekStartControl.appendChild(mondayOption);
      header.appendChild(weekStartControl);

      // D-04: toggling rebuilds the grid IN PLACE and moves focus nowhere.
      // Re-running the whole `mount()` path was explicitly rejected — it
      // ends by moving focus to the heading below, which would steal focus
      // from the segmented button the user just pressed, the exact
      // regression class Phase 20 shipped twice. This handler is fully
      // synchronous end to end (no `await`), so it opens no window for the
      // `mountedContainer !== ctx.container` race those guards above exist
      // to close, and no `await` may be introduced into this path.
      //
      // `setWeekStart` closes over `gridEl` and `pickerHost`, both declared
      // later in this `mount()` body. That is safe and deliberate: the
      // whole view is constructed synchronously and is not appended to
      // `ctx.container` until the end of `mount()`, so no click can fire
      // before those bindings exist.
      function setWeekStart(next: WeekStart): void {
        if (next === weekStart) return;
        weekStart = next;

        const nextIsSunday = weekStart === 'sunday';
        sundayOption.classList.toggle('segmented__option--active', nextIsSunday);
        sundayOption.setAttribute('aria-pressed', String(nextIsSunday));
        mondayOption.classList.toggle('segmented__option--active', !nextIsSunday);
        mondayOption.setAttribute('aria-pressed', String(!nextIsSunday));

        writeWeekStart(storage, next);
        // DISC-7: clear an open day picker so it does not sit beside a grid
        // that just changed shape underneath it. Safe with respect to D-04 —
        // the toggle is only reachable by clicking or key-activating the
        // segmented button, so the active element stays on that button,
        // never inside the picker, when it is cleared.
        pickerHost.replaceChildren();

        grid = buildMonthGrid(indexClient.getRows(), month, weekStart);
        renderGrid(gridEl, grid, month, weekStart, pickerHost, indexClient);
      }

      sundayOption.addEventListener('click', () => setWeekStart('sunday'));
      mondayOption.addEventListener('click', () => setWeekStart('monday'));

      view.appendChild(header);

      const gridEl = document.createElement('div');
      gridEl.className = 'calendar-grid';

      // Rendered below the grid, not a modal or tooltip — cleared whenever
      // a different day opens the picker, or the view unmounts.
      const pickerHost = document.createElement('div');

      renderGrid(gridEl, grid, month, weekStart, pickerHost, indexClient);

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
