# Phase 22: Calendar Week-Start & Totals - Pattern Map

**Mapped:** 2026-08-18
**Files analyzed:** 5 (2 new, 3 modified)
**Analogs found:** 5 / 5

All line numbers below were verified this session by direct `Read` against the current
working tree (not copied blind from RESEARCH.md, though they matched in every case checked).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/dashboard/views/calendar-preferences.ts` (NEW) | utility / provider (storage-backed pure module) | CRUD (read/write one key) | `src/dashboard/theme.ts` | exact (same role, same flow, same threat model) |
| `src/dashboard/views/calendar-preferences.test.ts` (NEW) | test | request-response (pure function I/O) | `src/dashboard/theme.test.ts` (if present) / `src/dashboard/views/calendar-logic.test.ts` | role-match |
| `src/dashboard/views/calendar-logic.ts` (MODIFIED) | utility (pure data-transform module) | transform (CRUD-adjacent: row aggregation) | itself, pre-existing `buildMonthGrid`/`firstWeekdayOfMonth`; secondary: `trends-logic.ts` `weekStartKey`, `records-logic.ts` `selectBiggestWeek` | exact (in-file extension) |
| `src/dashboard/views/calendar-logic.test.ts` (MODIFIED) | test | transform | itself (existing Sunday-first cases to re-pin) | exact |
| `src/dashboard/views/calendar.ts` (MODIFIED) | component / view (DOM-wiring controller) | request-response (mount) + event-driven (toggle click) | `src/dashboard/views/records.ts` (`buildPrTablesSection`/`setScope`/`renderTables`), `src/dashboard/views/detail-charts.ts` (`mountChartBands`/`setXAxisMode`) | exact (both are 3rd/4th instances of the same segmented-toggle + in-place-rerender shape) |
| `src/dashboard/styles.css` (MODIFIED) | config (CSS rules) | — | itself: `.calendar-*` block (707-813), `.segmented*` block (897-954) | exact (in-file extension) |

## Pattern Assignments

### `src/dashboard/views/calendar-preferences.ts` (NEW — utility, CRUD persistence)

**Analog:** `src/dashboard/theme.ts` (full file, 144 lines)

**Header threat-note pattern** (`theme.ts:1-17`):
```typescript
/**
 * Document-level theme engine for the dashboard shell.
 * ...
 * Security note (threat T-16-TH-01): `localStorage` is user/extension-writable in a
 * way a Shadow-DOM host attribute is not, so `parseThemeMode` allow-lists exactly
 * `'light' | 'dark' | 'auto'` and falls back to `'auto'` for anything else — a
 * tampered or unrecognised stored value can never reach `setAttribute('data-theme', ...)`.
 */
```
Copy this shape for `calendar-preferences.ts`'s header: state the module's narrow scope (per
D-06, "nothing else may read/write this key"), name a threat ID for the tamper case (research
suggests `T-22-WK-01`, unverified against any existing registry — just keep the convention
consistent with `T-16-TH-01`), and state the allow-list outcome.

**Storage key constant naming shape** (`theme.ts:22`):
```typescript
export const THEME_STORAGE_KEY = 'dashboard-theme';
```
Follow this exact shape for the new key — a `dashboard-`-prefixed, hyphenated, exported
`const`. (Exact literal value is Claude's Discretion per CONTEXT.md.)

**Validating parse — total function, silent fallback** (`theme.ts:26-35`):
```typescript
/**
 * Parses an arbitrary value (typically read from localStorage) into a valid
 * ThemeMode. Anything other than the exact strings 'light', 'dark', or 'auto'
 * falls back to 'auto' — this is the tamper guard the widget ThemeManager analog
 * deliberately omits, because its input is a developer-set host attribute.
 */
export function parseThemeMode(raw: unknown): ThemeMode {
  if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw;
  return 'auto';
}
```
Map directly to `parseWeekStart(raw: unknown): WeekStart` — `raw === 'sunday' || raw === 'monday'`
allow-list, fallback `'monday'` (D-03/D-07). Signature shape (`raw: unknown`, not `raw: string | null`)
matches exactly — the parse function itself doesn't care what untrusted-input shape arrives.

**Injectable storage interface** (`theme.ts:54-57`):
```typescript
export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
```
Copy verbatim as `WeekStartStorage` (or reuse the `Pick<Storage, 'getItem' | 'setItem'>` shape
`detail-charts.ts:181` uses instead — both are valid precedents in this codebase; `theme.ts`'s
named-interface form is the one D-05/D-06 explicitly point at).

**Read path — try/catch around storage.getItem, defaulting on throw** (`theme.ts:59-69`):
```typescript
/**
 * Reads the persisted theme mode from storage, tolerating a throwing `getItem`
 * (e.g. Safari private-mode) by falling back to 'auto' rather than propagating.
 */
export function readStoredMode(storage: ThemeStorage): ThemeMode {
  try {
    return parseThemeMode(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'auto';
  }
}
```
This is `readStoredWeekStart(storage)`'s exact template — swap `THEME_STORAGE_KEY` for the new
key, `parseThemeMode` for `parseWeekStart`, `'auto'` for `'monday'`.

**Write path — try/catch around storage.setItem, swallowed failure** (`theme.ts:91-108`,
isolating the write-specific lines `101-108`):
```typescript
export function applyThemeMode(mode: ThemeMode, options: ApplyThemeOptions = {}): Theme {
  const doc = options.doc ?? document;
  const storage = options.storage ?? localStorage;
  // ...
  if (persist) {
    try {
      storage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Swallow storage write failures (e.g. Safari private mode) — the DOM
      // attribute is already applied, which is the behavior that matters.
    }
  }
  return effective;
}
```
`theme.ts` folds the write into a larger DOM-applying function; D-06 wants a narrower
`writeWeekStart(storage, value)` that does *only* the try/catch/setItem — no DOM side effect
(the DOM rebuild is `calendar.ts`'s job, per D-04). Confirms RESEARCH.md's claim: **both**
halves of the persistence discipline (`readStoredMode` try/catch at `theme.ts:63-69`, the write
try/catch at `theme.ts:101-108`) are real and independently copyable.

**Storage-injection idiom, secondary reference** (`detail-charts.ts:181`, `:218`):
```typescript
export interface MountChartBandsOptions {
  stream: CanonicalStream;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  onHover?: (fraction: number | null) => void;
}
// ...
const storage = options.storage ?? globalThis.localStorage;
```
This is the *call-site* idiom — `calendar.ts`'s `mount()` (or wherever it invokes
`readStoredWeekStart`) should default the storage argument the same way: `globalThis.localStorage`,
not bare `localStorage`, matching the one place in this codebase (`detail-charts.ts`) that
already made that global-qualification choice explicit.

---

### `src/dashboard/views/calendar-logic.ts` (MODIFIED — pure transform module)

**Analog:** itself — this is an in-file generalization, not a new-role file. Full current
content read (202 lines); no analog needed outside the file for the mechanical part. Two
secondary analogs inform the *new* derivation piece (per-week totals) and are below.

**Current hard-coded Sunday-first function to generalize** (`calendar-logic.ts:133-136`):
```typescript
/** Weekday (0 = Sunday) of the 1st of `month`, computed via UTC components. */
function firstWeekdayOfMonth(m: CalendarMonth): number {
  return new Date(Date.UTC(m.year, m.month - 1, 1)).getUTCDay();
}
```

**Current `buildMonthGrid` signature and use of the padding value** (`calendar-logic.ts:149,
166-172, 177-193, 195-200`):
```typescript
export function buildMonthGrid(rows: readonly DashboardIndexRow[], month: CalendarMonth): MonthGrid {
  // ...
  const totalDays = daysInMonth(month);
  const leadingPadding = firstWeekdayOfMonth(month);
  const cellCount = leadingPadding + totalDays;
  const weekCount = Math.max(MIN_WEEK_ROWS, Math.ceil(cellCount / 7));
  const totalSlots = weekCount * 7;

  const flatCells: (DayCell | null)[] = new Array(totalSlots).fill(null);

  let monthTotalM = 0;
  let runCount = 0;

  for (let day = 1; day <= totalDays; day++) {
    const dateKey = `${monthPrefix}-${String(day).padStart(2, '0')}`;
    const dayRows = byDay.get(dateKey) ?? [];
    const totalDistanceM = dayRows.reduce((sum, r) => sum + (r.distanceM || 0), 0);

    monthTotalM += totalDistanceM;
    runCount += dayRows.length;

    flatCells[leadingPadding + day - 1] = {
      dateKey,
      dayOfMonth: day,
      totalDistanceM,
      runCount: dayRows.length,
      activityIds: dayRows.map((r) => r.id),
      tintStep: tintStepForDistance(totalDistanceM),
    };
  }

  const weeks: (DayCell | null)[][] = [];
  for (let i = 0; i < totalSlots; i += 7) {
    weeks.push(flatCells.slice(i, i + 7));
  }

  return { month, weeks, monthTotalM, runCount };
}
```
D-08 requires `weekStart: WeekStart` as a third, non-optional parameter — `leadingPadding` (the
local variable, distinct from the function that produces it) becomes the output of a new
`WEEK_START_OFFSET`-aware helper instead of the raw `firstWeekdayOfMonth(month)` call. The
`(rawDow - offset + 7) % 7` formula is not present anywhere in the codebase today — it must be
newly written, but its shape matches `trends-logic.ts`'s own Monday-offset math in spirit (see
below).

**`DayCell` / `MonthGrid` interfaces to extend** (`calendar-logic.ts:96-112`):
```typescript
/** One day cell in a rendered month grid. */
export interface DayCell {
  dateKey: string;
  dayOfMonth: number;
  totalDistanceM: number;
  runCount: number;
  activityIds: string[];
  tintStep: 0 | 1 | 2 | 3 | 4;
}

/** A full Sunday-first 7-column month grid, plus month-level totals. */
export interface MonthGrid {
  month: CalendarMonth;
  weeks: (DayCell | null)[][];
  monthTotalM: number;
  runCount: number;
}
```
`DayCell` needs a `totalTimeSec` field (same reduce shape as `totalDistanceM`, summing
`r.movingTimeSec`); `MonthGrid` needs a `weekTotals: WeekTotal[]` array, one entry per
`weeks[i]` row, per D-09/D-13/D-14. The doc comment "A full Sunday-first 7-column month grid"
is now false and must be updated — it no longer hard-codes Sunday.

**Secondary analog for Monday-offset week math** (`trends-logic.ts:74-85`):
```typescript
/** UTC-safe Monday-start week key, mirroring `date-utils.ts`'s `getWeekStart` weekday origin. */
function weekStartKey(dateKey: string): string {
  // dateKey is YYYY-MM-DD (activityDayKey's output shape) — safe to parse as UTC midnight.
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  const dayOfWeek = d.getUTCDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setUTCDate(d.getUTCDate() + offset);
  const year = String(d.getUTCFullYear()).padStart(4, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```
Note this is Monday-fixed and does a full date-shift-then-reformat, which is NOT what D-13
wants (D-13 explicitly rejects that shape — grouping by a true 7-day calendar week that can
cross the month boundary). Its value here is purely as **UTC discipline precedent** (parse via
`T00:00:00.000Z` suffix, read via `getUTC*`, zero-pad via `padStart`) — the same discipline
`calendar-logic.ts`'s own `activityDayKey` already uses (`calendar-logic.ts:81-92`). Do not
port `weekStartKey`'s cross-month-boundary grouping logic; do port its UTC-safe parsing idiom
if any new date arithmetic is needed beyond the padding-offset formula.

**Secondary analog for a "biggest of N" / total-per-group summary shape**
(`records-logic.ts:267-279`):
```typescript
function selectBiggestWeek(raw: unknown): { km: number; weekStartISO: string } | null {
  if (!Array.isArray(raw)) return null;
  let best: { km: number; weekStartISO: string } | null = null;
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    if (!hasOwn(entry, 'weekStartISO') || !hasOwn(entry, 'totalKm')) continue;
    const { weekStartISO, totalKm } = entry;
    if (typeof weekStartISO !== 'string' || typeof totalKm !== 'number') continue;
    if (!best || totalKm > best.km) best = { km: totalKm, weekStartISO };
  }
  return best;
}
```
Weaker match than RESEARCH.md implied — this function selects the single best pre-computed
week from *already-published* JSON (parsing untrusted external structure), not deriving a
week total from raw activity rows. Useful only as a naming precedent (`km`/`weekStartISO`-shaped
fields on a summary object); the actual derivation should follow RESEARCH.md's own
`weekTotals: WeekTotal[]` shape (a `.map()`/`.reduce()` over `weeks`, not a `.for...of` scan
for a maximum). Do not treat this as the primary derivation analog — the reduce-per-row shape
sketched in RESEARCH.md's Pattern 2 is the concrete one to implement:
```typescript
const weekTotals: WeekTotal[] = weeks.map((week) => {
  const cells = week.filter((c): c is DayCell => c !== null);
  const totalDistanceM = cells.reduce((sum, c) => sum + c.totalDistanceM, 0);
  const totalTimeSec = cells.reduce((sum, c) => sum + c.totalTimeSec, 0);
  const runCount = cells.reduce((sum, c) => sum + c.runCount, 0);
  return { totalDistanceM, totalTimeSec, runCount, daysShown: cells.length, isPartial: cells.length < 7 };
});
```

**`DashboardIndexRow`'s relevant fields** (`src/analytics/dashboard-index.types.ts:39-50`):
```typescript
export interface DashboardIndexRow {
  id: string;
  startDate: string;
  startDateLocal: string;
  name: string;
  distanceM: number;
  movingTimeSec: number;
  paceSecPerKm: number | null;
  // ...
}
```
Confirms `distanceM` and `movingTimeSec` are both present and required (not optional) — D-09's
"free data" claim holds; no pipeline change needed.

**Purity contract to preserve** (`calendar-logic.ts:1-10`):
```typescript
/**
 * Calendar training log — pure, DOM-free date math and per-day aggregation
 * (BROWSE-05). This module imports nothing from the activity list's pure
 * query-parsing module (D-16): ...
 * `now` is always injected by the caller, never constructed fresh
 * inside this module — keeps every function here total and deterministic.
 */
```
`weekStart` must be injected the same way `now` already is — never read from `localStorage` or
computed inside this module.

---

### `src/dashboard/views/calendar-logic.test.ts` (MODIFIED — test)

**Analog:** itself. Every existing `buildMonthGrid` call is 2-argument today (verified: lines
183, 189, 195, 201, 207, 213, 219, 232, 241, 258, 265, 279 in the current file all call
`buildMonthGrid(rows, month)` with no third argument). Once D-08 lands, **every one of these
call sites fails to compile** until a `weekStart` argument is added — this is the concrete,
grep-able signal RESEARCH.md's Pitfall 1 describes ("a test file where every two-argument
`buildMonthGrid(rows, month)` call still compiles after this phase's changes... means the
parameter did not actually become required").

**Existing Sunday-first expectations to re-pin explicitly** (`calendar-logic.test.ts:188-199`):
```typescript
it('March 2024 (starts Friday) produces 5 leading null cells (Sun-Thu) in week 0', () => {
  const grid = buildMonthGrid([], { year: 2024, month: 3 });
  // ...
});

it('September 2024 (September 1 is a Sunday) produces zero leading null padding', () => {
  const grid = buildMonthGrid([], { year: 2024, month: 9 });
  // ...
});
```
Each becomes `buildMonthGrid([], { year: 2024, month: 3 }, 'sunday')` with the test title
changed to say "(Sunday-start)" explicitly (D-03's requirement), and a sibling
`'monday'`-start case is added alongside it for the same fixture month, per RESEARCH.md's
verified padding arithmetic (March 2024: rawDow=5, monday-offset padding=4).

**Fixture row builder to reuse for week-total test fixtures** (`calendar-logic.test.ts:14-35`):
```typescript
function fixtureRow(overrides: Partial<DashboardIndexRow> & { id: string; startDateLocal: string }): DashboardIndexRow {
  return {
    startDate: overrides.startDateLocal,
    name: 'Test Run',
    distanceM: 5000,
    movingTimeSec: 1800,
    paceSecPerKm: 360,
    // ...
    ...overrides,
  };
}
```
Reuse this exact builder for `weekTotals` derivation test cases (full week, boundary/partial
week, empty week, both week starts) — do not write a second fixture-row helper.

---

### `src/dashboard/views/calendar.ts` (MODIFIED — component/view, mount + event-driven toggle)

**Analog 1 (segmented control + in-place re-render):** `src/dashboard/views/records.ts:590-688`
(`buildPrTablesSection`)

**Analog 2 (segmented control + in-place re-render, second instance):**
`src/dashboard/views/detail-charts.ts:179-282, 534-552` (`mountChartBands`/`setXAxisMode`)

**Segmented markup — instance 1** (`records.ts:633-652`, verbatim, confirmed this session):
```typescript
const segmented = document.createElement('div');
segmented.className = 'segmented';
segmented.setAttribute('role', 'group');
segmented.setAttribute('aria-label', 'Records scope');

const allTimeOption = document.createElement('button');
allTimeOption.type = 'button';
allTimeOption.className = 'segmented__option segmented__option--active';
allTimeOption.textContent = 'All time';
allTimeOption.setAttribute('aria-pressed', 'true');

const thisYearOption = document.createElement('button');
thisYearOption.type = 'button';
thisYearOption.className = 'segmented__option';
thisYearOption.textContent = 'This year';
thisYearOption.setAttribute('aria-pressed', 'false');

segmented.appendChild(allTimeOption);
segmented.appendChild(thisYearOption);
section.appendChild(segmented);
```

**Segmented markup — instance 2** (`detail-charts.ts:257-276`, verbatim, confirmed this session):
```typescript
const segmented = document.createElement('div');
segmented.className = 'segmented';
segmented.setAttribute('role', 'group');
segmented.setAttribute('aria-label', 'Chart x-axis');

const distanceOption = document.createElement('button');
distanceOption.type = 'button';
distanceOption.className = 'segmented__option segmented__option--active';
distanceOption.textContent = 'Distance';
distanceOption.setAttribute('aria-pressed', 'true');

const timeOption = document.createElement('button');
timeOption.type = 'button';
timeOption.className = 'segmented__option';
timeOption.textContent = 'Time';
timeOption.setAttribute('aria-pressed', 'false');

segmented.appendChild(distanceOption);
segmented.appendChild(timeOption);
root.appendChild(segmented);
```

**Diff — what is invariant vs. what varies between the two instances:**

| Element | Invariant (copy exactly) | Varies per instance |
|---|---|---|
| Container | `div`, `className = 'segmented'`, `role="group"` | `aria-label` text (`'Records scope'` vs `'Chart x-axis'`) |
| Each option | `document.createElement('button')`, `type = 'button'`, base class `'segmented__option'`, `aria-pressed` string-boolean | `textContent` (`'All time'`/`'This year'` vs `'Distance'`/`'Time'`), which option starts with `--active` appended to its className |
| Assembly | `segmented.appendChild(optionA); segmented.appendChild(optionB); <parent>.appendChild(segmented);` | the parent element appended to (`section` vs `root`) |

For the Calendar's third instance: `aria-label="Week start"` (Claude's Discretion per
CONTEXT.md; matches the `"Records scope"`/`"Chart x-axis"` naming convention of a short noun
phrase, not a question or instruction), option text `"Sunday"` / `"Monday"` (full words,
matching the spelled-out-not-abbreviated precedent of `"All time"`/`"This year"`). **D-03 means
Monday must be the option carrying `segmented__option--active`/`aria-pressed="true"` at initial
build** — this is the one place the Calendar's instance structurally differs in its *initial
state* from both existing instances (both existing ones start on their first-listed option;
Calendar starts on its second-listed option, Monday, per D-03's default).

**Active-state toggle pattern — instance 1** (`records.ts:669-680`):
```typescript
function setScope(next: RecordScope): void {
  if (next === scope) return;
  scope = next;

  const isAllTime = scope === 'all-time';
  allTimeOption.classList.toggle('segmented__option--active', isAllTime);
  allTimeOption.setAttribute('aria-pressed', String(isAllTime));
  thisYearOption.classList.toggle('segmented__option--active', !isAllTime);
  thisYearOption.setAttribute('aria-pressed', String(!isAllTime));

  renderTables(scope);
}

allTimeOption.addEventListener('click', () => setScope('all-time'));
thisYearOption.addEventListener('click', () => setScope('this-year'));
```

**Active-state toggle pattern — instance 2** (`detail-charts.ts:538-552`):
```typescript
function setXAxisMode(mode: XAxisMode): void {
  if (xAxisMode === mode) return;
  xAxisMode = mode;

  const isDistance = mode === 'distance';
  distanceOption.classList.toggle('segmented__option--active', isDistance);
  distanceOption.setAttribute('aria-pressed', String(isDistance));
  timeOption.classList.toggle('segmented__option--active', !isDistance);
  timeOption.setAttribute('aria-pressed', String(!isDistance));

  rebuildBands();
}

distanceOption.addEventListener('click', () => setXAxisMode('distance'));
timeOption.addEventListener('click', () => setXAxisMode('time'));
```
Identical shape in both: early-return guard on no-op, reassign the closure-local mode variable,
`classList.toggle(..., isX)` + `setAttribute('aria-pressed', String(isX))` on BOTH options (not
just the one being turned on), then call a named `render*`/`rebuild*` function. Copy this exact
shape for the Calendar's `setWeekStart(next)`, calling `writeWeekStart(storage, next)` before
(or as part of) the rebuild step, and rebuilding only the weekday-label row + `.calendar-grid`
per D-04 (see the in-place re-render pattern below) — NOT re-running `mount()`.

**In-place partial re-render — `renderTables` swaps only its own container**
(`records.ts:654-667`):
```typescript
const tablesContainer = document.createElement('div');
section.appendChild(tablesContainer);

function renderTables(currentScope: RecordScope): void {
  const tables: HTMLElement[] = [];
  for (const distance of TARGET_ORDER) {
    // ...build tables...
  }
  tablesContainer.replaceChildren(...tables);
}
```
`tablesContainer.replaceChildren(...)` — nothing outside `tablesContainer` (the heading, the
segmented control itself, the config notice) is touched. This is the exact shape D-04 wants for
the Calendar: hold a reference to the weekday-label-row container and `.calendar-grid` element
(or a wrapping element around both), and on toggle rebuild `buildMonthGrid` with the new
`weekStart` and `replaceChildren(...)` just that wrapper — leaving `h1`, `.calendar-header`
(including the segmented control the user just clicked), and `pickerHost` untouched.

**The rejected alternative's failure point — `h1.focus()` at the end of `mount()`**
(`calendar.ts:317-320`):
```typescript
      ctx.container.appendChild(view);

      // Every hash navigation announces a context change to assistive tech
      // (17-UI-SPEC § 5 Cross-Surface focus management).
      h1.focus();
```
Confirms RESEARCH.md/CONTEXT.md's claim exactly — line 320 is `h1.focus()`. Any toggle handler
that calls `mount()` again (directly or by re-navigating to `#/calendar`) ends here, stealing
focus from the segmented button the user just pressed. D-04 forbids this path.

**Mount-race guard shape** (`calendar.ts:196-198, 217-219`):
```typescript
      } catch (error) {
        console.error(error);
        // A rejection can arrive after the user navigated away — must not
        // wipe the newly-mounted view (WR-01).
        if (mountedContainer !== ctx.container) {
          return;
        }
        // ...
      }

      // mount() may resolve after the view was unmounted (fast navigation
      // away before the index finished loading) — guard against painting
      // into a container this view no longer owns.
      if (mountedContainer !== ctx.container) {
        return;
      }
```
The new toggle click handler is **synchronous** (no `await` in the rebuild path — `buildMonthGrid`
is pure/sync and `writeWeekStart` is sync), so it cannot race a navigation-away the way the
`await indexClient.loadIndex()` continuation can. No new mount-race guard is needed inside the
click handler itself, but the handler must be defined so it only ever touches DOM nodes it holds
direct references to (the weekday row wrapper / `.calendar-grid` element), never re-derives
`mountedContainer !== ctx.container`-style guards from scratch — those two checks exist
specifically around the async `loadIndex()` boundary and have no toggle-handler equivalent to
copy; the correct copy target for the toggle handler is `renderTables`'s
synchronous-container-swap shape above, not the mount-race guard shape.

**`WEEKDAY_LABELS` — the hard-coded array to generalize** (`calendar.ts:31`):
```typescript
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
```
Becomes a `weekdayLabels(weekStart: WeekStart): readonly string[]` function (RESEARCH.md's
Code Examples section already sketches this as a rotate-left-by-one on the Sunday-first array —
confirmed as the correct minimal-diff shape since this is a DOM-layer concern, staying in
`calendar.ts` rather than moving into the pure module, matching how km-string formatting is
already inline in `calendar.ts` rather than in `calendar-logic.ts`).

**`buildDayCellButton` — the day-cell accessible-name construction pattern to mirror for the
week-total cell** (`calendar.ts:100-163`, the two accessible-name construction sites at
`:132` and `:149-152`):
```typescript
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

  btn.addEventListener('click', () => { /* ... */ });

  return btn;
}
```
The pattern to mirror for `buildWeekTotalCell(weekTotal, weekStart, weekIndex, ...)`:
1. **A rest-day/empty case handled FIRST, before building the value elements** — the
   `cell.runCount === 0` branch returns early with the en-dash and a distinct `aria-label`
   sentence, never falling through to the km/runs sentence. D-12's empty-week case should mirror
   this exact early-return shape: build the "rest week" `aria-label` and the en-dash content,
   return before touching time/count DOM nodes at all (matching "omitted, not shown as `0h 0m`").
2. **Singular/plural word selection inline at the call site**, not a helper function
   (`const runsWord = cell.runCount === 1 ? 'run' : 'runs';`) — copy this exact inline-ternary
   style for the week-total's own run-count wording.
3. **The `aria-label` sentence is built as ONE template-literal string assembling all the
   already-formatted pieces**, not concatenated from multiple `setAttribute` calls or built with
   an array-join. D-14's partial-week disclosure ("Partial week, 3 days shown, 18.2 km, 1h 32m,
   2 runs") should be one such template literal, with the "Partial week, N days shown, " prefix
   present only when `weekTotal.isPartial` is true (mirroring how the rest-day branch's
   `aria-label` differs entirely in shape from the normal-day branch's, rather than being the
   same template with an optional segment spliced in).
4. **`fullDateLabel(cell, month)` is the existing per-day accessible-name-prefix helper**
   (`calendar.ts:38-41`) — there is no existing per-week equivalent; a new one describing "which
   week" (per D-11) must be written fresh, likely from the week's date range (first/last
   in-month `dateKey` in the row) rather than reusing `fullDateLabel` directly, since a week
   spans a range rather than a single date.

**The rest-day en-dash** (`calendar.ts:129`, inside the block quoted above):
```typescript
    distanceEl.textContent = '–';
```
This is D-12's precedent exactly — a real Unicode en-dash (`–`, U+2013), not a hyphen-minus.
Confirmed by direct read (not merely research's claim) that this exact character is what's in
source.

**The render-loop restructuring point** (`calendar.ts:292-311`, current flat loop):
```typescript
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
```
Confirms RESEARCH.md's Pattern 4 exactly. The weekday-label loop (295-300) and the flat-cell
loop (306-311) both need restructuring: the weekday loop gains one more iteration appending a
"Total" header cell after the existing 7; the flat-cell loop becomes `grid.weeks.forEach((week,
i) => { for (const cell of week) {...}; gridEl.appendChild(buildWeekTotalCell(grid.weekTotals[i], ...)); })`.
Because `.calendar-grid` stays a CSS grid with 8 tracks (`repeat(7, 1fr)` + one more, per D-10),
no manual row/column bookkeeping is needed — the browser's grid auto-flow handles the wrap,
exactly as it already does with 7.

**`buildMonthGrid` call site to update for D-08** (`calendar.ts:236`):
```typescript
      const grid = buildMonthGrid(indexClient.getRows(), month);
```
Becomes `buildMonthGrid(indexClient.getRows(), month, weekStart)` — this is the ONE production
call site D-08's rationale refers to; `weekStart` itself comes from `readStoredWeekStart(storage)`
called earlier in `mount()`, held in a `let` closure variable so the toggle handler can update it.

**`.calendar-header` assembly, insertion point for D-02** (`calendar.ts:238-290`, showing the
end of the existing sequence — the "Jump to month" input is the last child appended before
`view.appendChild(header)`):
```typescript
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
```
D-02's segmented control is appended to `header` (`header.appendChild(segmented)`) immediately
after this `jumpWrapper` append and before `view.appendChild(header)`.

---

### `src/dashboard/styles.css` (MODIFIED — config)

**Analog:** itself — `.calendar-*` block (707-813) and `.segmented*` block (897-954), both
verified this session by direct read.

**The `.calendar-header` flex row D-02 relies on** (`styles.css:709-714`):
```css
.calendar-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-md);
}
```
Confirms RESEARCH.md's claim: this rule absorbs a 4th flex item with zero new layout CSS. The
`align-items: baseline` is the flagged risk (D-02) — a `.segmented` control's baseline (an
inline-flex of buttons) may not align cleanly against `.text-display` (the month total) or the
nav buttons; this is a checkpoint item, not something to "fix" preemptively in CSS without
seeing it render.

**The 8th-column track list to extend** (`styles.css:727-731`):
```css
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-xs);
}
```
D-10: `grid-template-columns: repeat(7, 1fr);` becomes `grid-template-columns: repeat(7, 1fr) auto;`
(or `minmax(...)` — Claude's Discretion). The weekday-label row (`.calendar-weekday`, styled at
`styles.css:733-739`) also needs its 8th "Total" header cell to inherit correctly from this same
grid — no separate rule needed since `.calendar-weekday` styling is class-based, not
position-based.

**`.calendar-day`'s three-slot internal grid — the CSS precedent D-10 says to mirror**
(`styles.css:741-790`):
```css
.calendar-day {
  display: grid;
  min-width: 32px;
  min-height: 32px;
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  grid-template-areas:
    "number . ."
    ". distance ."
    ". . count";
  grid-template-columns: 1fr 1fr 1fr;
}

.calendar-day__number {
  grid-area: number;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  justify-self: start;
}

.calendar-day__distance {
  grid-area: distance;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
  justify-self: center;
}

.calendar-day__count {
  grid-area: count;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  justify-self: end;
}
```
**Do not reuse the `.calendar-day` class itself for the total cell** — this 3×3
`grid-template-areas` layout exists to place a day-NUMBER (top-left), a big distance value
(middle-center), and an optional run count (bottom-right) inside a fixed-aspect square day box.
The total cell has no day number and needs a THIRD value (time) that `.calendar-day` has no slot
for at all. Give the total cell its own class (e.g. `.calendar-week-total`) with a simpler
**vertically stacked three-line layout** (distance / time / count, top to bottom, no grid-areas
needed — a plain `display: grid` or `flex` column suffices), reusing only the font-size/weight/
line-height *tokens* shown above (14px/400/1.5 for small labels, 20px/600/1.2 for the emphasized
value) so the total cell's typography matches the day cells' visual weight without inheriting
their positional layout. This is RESEARCH.md's own Pitfall 3, confirmed here by direct read of
the actual `grid-template-areas` string — there genuinely is no "number" slot to give the total
cell, and no fourth value (time) slot either.

**Tint-step background rules, for contrast/reference only (NOT applicable to the total cell)**
(`styles.css:792-806`):
```css
.calendar-day--tint-1 {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
/* ...tint-2, tint-3, tint-4 follow the same shape at 25%/40%/55%... */
```
The total cell has no tint scale (D-10/D-11 give it no equivalent concept) — do not invent one;
its background should be visually distinct from a day cell (it is not a button/interactive
element per D-11) but does not need a `color-mix` accent scale.

**`.segmented` container and option rules, confirmed inherited with zero new CSS**
(`styles.css:899-954`):
```css
.segmented {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
}

.segmented__option {
  background: var(--surface);
  color: var(--text-secondary);
  border: none;
  border-radius: 0;
  padding: var(--space-xs) var(--space-md);
  cursor: pointer;
}

.segmented__option:first-child {
  border-radius: var(--radius-control) 0 0 var(--radius-control);
}

.segmented__option:last-child {
  border-radius: 0 var(--radius-control) var(--radius-control) 0;
}

.segmented__option--active {
  background: var(--accent-strong);
  color: #ffffff;
}
```
Confirmed: this is entirely class-selector-based, not per-page-instance-scoped — a third
`.segmented`/`.segmented__option` instance in `calendar.ts` inherits every one of these rules
automatically with **zero new CSS needed** for CAL-03's baseline styling. Only D-02's
`.calendar-header` baseline-alignment risk (above) is a genuine open visual question.

**Shared button hover exclusion — confirms `.segmented__option--active` is already excluded**
(`styles.css:1357-1393`):
```css
button {
  font: inherit;
  min-height: 32px;
  cursor: pointer;
  border-radius: var(--radius-control);
}

button:where(:not(
      :disabled,
      [aria-disabled="true"],
      .pagination__button--current,
      .segmented__option--active,
      .calendar-day--tint-1,
      .calendar-day--tint-2,
      .calendar-day--tint-3,
      .calendar-day--tint-4
    )):hover {
  background: color-mix(in srgb, var(--surface) 92%, var(--text));
}
```
Nothing to change here — `.segmented__option--active` is already excluded by class name (not by
instance/page), so the Calendar's Monday-default-active option is automatically covered on day
one with no new exclusion needed.

## Shared Patterns

### Injectable-storage persistence with validating parse (theme.ts discipline)
**Source:** `src/dashboard/theme.ts` (full file; key excerpts at lines 22, 26-35, 54-57, 63-69, 101-108)
**Apply to:** `calendar-preferences.ts` (new file) — this IS the pattern that file exists to copy.

### `.segmented` control markup + active-state toggle
**Source:** `src/dashboard/views/records.ts:633-652, 669-683`; `src/dashboard/views/detail-charts.ts:257-276, 538-552`
**Apply to:** `calendar.ts`'s new week-start toggle. Do not deviate from the invariant shape in
the diff table above — CR-02/CR-03 (Phase 19 review) already document what happens when a
segmented-family control diverges subtly from this shape (a middle-option border-radius bug that
shipped unobserved because no checkpoint ever named a 3+-option group).

### In-place partial DOM re-render (not a full `mount()` re-run)
**Source:** `src/dashboard/views/records.ts:654-667` (`renderTables`/`tablesContainer`)
**Apply to:** `calendar.ts`'s toggle handler — rebuild only the weekday-label row + `.calendar-grid`,
leave `h1`/`.calendar-header`/`pickerHost` untouched, per D-04. The explicitly-rejected
alternative (`mount()` re-run) fails at `calendar.ts:320`'s `h1.focus()`.

### Accessible-name construction on interactive/informational grid cells
**Source:** `src/dashboard/views/calendar.ts:100-163` (`buildDayCellButton`, esp. the rest-day
early-return at 124-133 and the km/runs template literal at 149-152)
**Apply to:** the new `buildWeekTotalCell` — early-return for the empty-week en-dash case before
touching time/count elements, one template-literal `aria-label` per case (not the same template
with optional segments spliced in).

### Mount-race guard (informational — no new copy needed)
**Source:** `src/dashboard/views/calendar.ts:196-198, 217-219`
**Apply to:** N/A for the toggle handler itself (it's synchronous, no race window), but the
planner/implementer must not introduce any `await` into the toggle-handler rebuild path that
would reopen a race this guard shape exists to close.

## No Analog Found

None. Every file in scope has a strong (exact or role-match) analog already present in the
codebase — this phase is explicitly "propagate an existing pattern," confirmed by direct source
read, not merely by RESEARCH.md's claim.

## Metadata

**Analog search scope:** `src/dashboard/` (views/, theme.ts, styles.css), `src/analytics/dashboard-index.types.ts`
**Files scanned (full or targeted read):** `calendar-logic.ts`, `calendar.ts`, `calendar-logic.test.ts`,
`theme.ts`, `records.ts` (590-688), `detail-charts.ts` (175-305, 525-555), `styles.css` (700-960, 1355-1410),
`trends-logic.ts` (55-99), `records-logic.ts` (255-285), `dashboard-index.types.ts` (35-55)
**Pattern extraction date:** 2026-08-18
