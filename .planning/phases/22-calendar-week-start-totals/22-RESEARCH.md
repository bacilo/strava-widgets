# Phase 22: Calendar Week-Start & Totals - Research

**Researched:** 2026-08-18
**Domain:** Internal codebase — pure date/grid-math generalization, a small persistence module, and DOM render-loop restructuring. No new external dependency.
**Confidence:** HIGH (all claims verified by direct source read or by executing code against the live archive; the few genuinely open style/UX judgment calls are flagged `[ASSUMED]` in the Assumptions Log)

## Summary

This phase has no library-selection question — the entire domain is `src/dashboard/views/calendar-logic.ts` (pure, DOM-free, hard-coded Sunday-first) and `src/dashboard/views/calendar.ts` (the thin DOM-wiring view). The work is: (1) generalize `buildMonthGrid`'s leading-padding arithmetic from a raw `getUTCDay()` read to a week-start-parameterized offset; (2) add a new derivation — per-week totals (distance, time, run count) — to the same pure module, filtered to in-month days only (D-13); (3) add a small, calendar-scoped persistence module shaped exactly like `theme.ts`; (4) restructure `calendar.ts`'s flat render loop into a per-week loop that appends a total cell after each week's seven days; and (5) add a third `.segmented` control instance, copying the exact markup/toggle pattern already shipped twice (`records.ts`, `detail-charts.ts`).

Every architectural pattern this phase needs already has a working precedent in this codebase: pure-module date math (`calendar-logic.ts` itself), injectable-storage persistence with a validating parse (`theme.ts`), and a two-option segmented toggle with an `aria-pressed`/class-swap update (`records.ts`, `detail-charts.ts`). The phase is "propagate an existing pattern," not "invent one." The two genuinely new pieces of derivation — week-start-aware leading padding and per-week totals — are both small, pure, and directly unit-testable.

A real discriminator month exists in the live archive and is fully tabulated below (both Sunday-start and Monday-start week-total sets, October 2025) for the D-16 human checkpoint — no staged fixture is needed.

**Primary recommendation:** Generalize `buildMonthGrid` to take a required third `weekStart: WeekStart` parameter using the `(rawDow - offset + 7) % 7` leading-padding formula; add `totalTimeSec` to `DayCell` and a new `weekTotals: WeekTotal[]` array to `MonthGrid`, both computed inside the same pure function; build the persistence module as a narrow three-function file mirroring `theme.ts`; and restructure `calendar.ts`'s render loop to walk `grid.weeks` row-by-row, appending an 8th static total cell per row.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Week-start control**
- **D-01**: A `.segmented` Sun | Mon toggle, not a `<select>` — reuses `records.ts:633`/`detail-charts.ts:257`'s `div.segmented[role=group][aria-label]` containing two `<button type="button">` with `segmented__option`/`segmented__option--active`/`aria-pressed`. CAL-03 is discharged through Phase 19's **button** baseline, not its `input,select,textarea` baseline.
- **D-02**: The control lives in `.calendar-header`, appended after the "Jump to month" input. `styles.css:709`'s `display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--space-md)` absorbs a fourth item with no new layout CSS. **Planning must check** baseline alignment across mixed control heights — flag on the checkpoint list.
- **D-03**: Monday is the default when nothing is stored — aligns Calendar with `weekStartISO`/`weekStartKey` elsewhere in the app for the first time. Consequences: (a) the deployed calendar visibly re-flows on first load, expected not a regression, call out at the checkpoint; (b) every Sunday-first expectation in `calendar-logic.test.ts` must be re-pinned as an *explicit* Sunday-start case.
- **D-04**: Toggling rebuilds the grid in place (weekday label row + `.calendar-grid` only) and does not move focus — mirrors `records.ts`'s `renderTables` swapping only `tablesContainer`. Explicitly rejected: re-running `mount()` (ends in `h1.focus()`, would steal focus every toggle). Open sub-question for planning: whether an open day-picker below the grid should be cleared on toggle — see "Pattern 4" and "Pitfall 4" below, plus the concrete recommendation in the Assumptions Log (A3).

**Persistence**
- **D-05**: `localStorage`, shaped like `theme.ts` — injectable `storage` parameter defaulting to `localStorage`, validating parse treating the stored value as untrusted (T-16-TH-01: localStorage is user/extension-writable). Explicitly rejected: a `?weekStart=` URL param as sole mechanism (dies on navigation since `nav.ts` links to a bare `#/calendar`) and URL-plus-storage precedence (fights D-04's no-navigation decision).
- **D-06**: A calendar-specific module, not a generic view-preference facility — narrow surface `parseWeekStart(raw)`, `readStoredWeekStart(storage)`, `writeWeekStart(storage, value)`, total functions, injectable storage, no key registry. Settles `records.ts:608`'s open question: yes, localStorage is now sanctioned for view state, but per-view and narrow. Phase 21 D-04 (Records scope not persisted) is unchanged.
- **D-07**: The stored value is the string literal `'sunday'` or `'monday'`, silent fallback to Monday default (D-03) for anything else — no console noise, no repair. Matches `theme.ts`'s treatment of an unrecognised mode; keeps the read path total.
- **D-08**: `buildMonthGrid` takes the week start as a **required** third parameter — `buildMonthGrid(rows, month, weekStart)`, no default. Exactly one production call site (`calendar.ts:236`). An optional param defaulting to `'sunday'` would let existing tests keep passing while asserting the wrong thing. `calendar-logic.ts` stays pure/total — week start is injected, never read from storage or a clock inside the module.

**Week totals**
- **D-09**: Each week total shows all three of distance, time and run count *(user overrode the recommended distance-only option)*. `DashboardIndexRow` already carries `distanceM`/`movingTimeSec` — free data, no pipeline work. Distance formats as the existing `(m/1000).toFixed(1)` + `km`. **Time format is not locked — planning picks it; day cells set no precedent.**
- **D-10**: The total renders as an 8th grid column sized to its own content — `.calendar-grid`'s `repeat(7, 1fr)` gains an `auto`/`minmax` final column. Weekday label row gains an 8th "Total" header cell. The total cell stacks its three values, mirroring `.calendar-day`'s number/distance/count grid — no new visual concept. **Eight columns on a phone is the real layout risk — belongs on the checkpoint list.**
- **D-11**: The total cell is static content, not a focusable button — nothing to activate; a focus stop would be a false affordance. The every-slot-is-a-real-button rule (`calendar.ts:96-99`) is unaffected — an 8th, non-focusable column just ends each row's Tab stops at day 7. The cell carries an accessible name saying which week it sums. Rejected: full ARIA grid/row/cell roles.
- **D-12**: A week with no runs shows an en-dash `–`, matching the rest-day convention (`calendar.ts:124`). Time and count lines are **omitted**, not `0h 0m`/`×0`. A real case — `buildMonthGrid` guarantees `MIN_WEEK_ROWS = 4` and pads months out.

**Week boundary math**
- **D-13**: A week total sums only the visible in-month days — the non-null `DayCell`s in that row. Reconciles with the month total already shown at `calendar.ts:243`. `buildMonthGrid` already filters rows to the month prefix. Rejected: summing the true 7-day calendar week across the month boundary (would need unfiltered rows + a `weekStartKey`-style grouping, and would make week totals NOT sum to the month total). Also rejected: rendering adjacent-month days as real muted cells.
- **D-14**: Partial weeks are disclosed in the accessible name only, not visibly — e.g. "Partial week, 3 days shown, 18.2 km, 1h 32m, 2 runs". The visible cell shows the same three values as any other week. The muted `.calendar-day--outside` cells are the existing visual cue for sighted users.
- **D-15**: The setting reaches the Calendar view and nothing else — explicit non-goal. Trends' weekly volume, `records-logic.ts`'s biggest week, and streak logic all read `weekStartISO`, Monday-fixed in the pipeline (`analytics.types.ts:9`, `trends-logic.ts:75-88`) and published as pre-computed JSON. **Downstream agents: do not treat this as a gap** — the verifier scores this phase against the Calendar view alone.

**Verification**
- **D-16**: The human checkpoint reads back pre-computed expected values from the live archive. Pick a real month with **runs on the boundary day** (a Sunday run — the day that changes week rows when the start moves), compute both the Sunday-start and Monday-start week-total sets, write **both** into the plan. **This research discharges D-16: see "D-16 Discriminator Month" below — October 2025, no staged fixture needed.**

### Claude's Discretion

- The exact `localStorage` key name (follow `theme.ts`'s `THEME_STORAGE_KEY` naming shape).
- The time format in the week total (`3h 45m` vs `3:45` vs `3.75h`) — no existing calendar precedent, day cells show no time.
- Whether the `localStorage` read is wrapped against a throwing storage (private mode/disabled cookies) — follow whatever `theme.ts` already does, match it rather than inventing a second policy.
- The weekday label row's content and ordering under a Monday start (`WEEKDAY_LABELS` at `calendar.ts:31` is hard-coded Sunday-first and must become week-start-aware).
- The `aria-label` wording on the segmented group and its two options.
- The exact CSS track for the 8th column (`auto` vs `minmax(...)`) and the mobile strategy.

### Deferred Ideas (OUT OF SCOPE)

- **Make weekly aggregates honour the week-start preference** (Trends/records/streak logic staying Monday-fixed) — out of scope per D-15, own future phase, would need reconciling with Phase 23.
- **Render adjacent-month days as real muted cells**, switch to true 7-day week totals (the D-13 alternative) — changes the day-cell contract, outside-month treatment, Tab-order invariant, tint scale. A Calendar rework phase, not a CAL-02 line item.
- **A shared view-preference facility** — D-06 deliberately builds calendar-only storage; generalize from two concrete cases if a second persisted view preference appears later.
- **Revisit Phase 21 D-04** (Records scope not persisted) now that localStorage is sanctioned for view state — not reopened here; D-04 stands.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAL-01 | User can choose whether weeks start on Sunday or Monday; the choice persists | D-05/D-06/D-07 persistence design below (mirrors `theme.ts`); D-08's required `weekStart` param on `buildMonthGrid`; D-01/D-02 segmented control placement |
| CAL-02 | Week totals computed and shown at the end of each week row, respecting the selected week start | D-09/D-10/D-11/D-12/D-13/D-14 derivation design below; concrete `WeekTotal` interface and derivation code; October 2025 discriminator table for the checkpoint |
| CAL-03 | Calendar controls use the shared control styling from UI-01/UI-02 | `.segmented` control (D-01) inherits Phase 19's button baseline, shared hover, and two-tone focus ring with zero opt-in work — confirmed against 19-CONTEXT.md D-05/D-06/D-09/D-10 below |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Week-start selection UI (segmented toggle) | Browser / Client | — | Pure client-side DOM control, no server round-trip; this app has no backend runtime beyond the static-generated JSON published to GitHub Pages |
| Week-start persistence | Browser / Client (localStorage) | — | `theme.ts`'s established pattern; there is no session/auth tier in this SPA — everything client-local |
| Month-grid layout math (`buildMonthGrid`) | Browser / Client (pure TS module, bundled) | — | `calendar-logic.ts` is DOM-free but ships in the client bundle and runs in the browser against the already-fetched index; there is no server-side rendering in this app |
| Per-week total derivation (distance/time/count) | Browser / Client (same pure module) | — | Reads the already-published `DashboardIndexRow[]` (client-fetched JSON), no new backend computation |
| Underlying activity data (`distanceM`, `movingTimeSec`) | Database / Storage (build-time pipeline → published JSON) | — | Pre-computed by `compute-dashboard-index` and published to `data/dashboard/index.json`; Calendar only reads it, never computes it server-side (D-15 keeps it that way) |
| Control styling (CAL-03) | Browser / Client (CSS) | — | `styles.css`'s existing `.segmented`/button baseline; no new visual concept |

This app is a static, client-only dashboard (GitHub Pages) with a build-time Node pipeline that pre-computes JSON and a pure client bundle that reads it — there is no live API/backend tier at runtime. Every capability in this phase resolves to the Browser/Client tier; the "Database / Storage" row is included only to make explicit that the underlying numbers are pipeline-computed and read-only from the Calendar's perspective (D-15's boundary).

## Standard Stack

No new external dependency. This phase is entirely internal-codebase work in the existing TypeScript/Vite/Vitest stack already used by every other dashboard view. `package.json` confirms no new packages are needed for any of this phase's requirements — reused, already-installed pieces only:

| Piece | Where it already exists | Purpose in this phase |
|-------|--------------------------|------------------------|
| Vitest | `vitest.config.ts`, `npm test` → `vitest run` | Unit-tests `buildMonthGrid`'s generalized leading-padding math and the new `weekTotals` derivation, plus the new persistence module's pure functions |
| TypeScript / `tsc` | `npm run build` | Type-checks the new `WeekStart` union, the `buildMonthGrid` signature change, and the new `DayCell`/`MonthGrid` fields |
| esbuild (via `scripts/build-widgets.mjs`) | `npm run build-widgets` | Bundles the new persistence module and updated `calendar.ts`/`calendar-logic.ts` into the published dashboard bundle |
| `verify-dashboard-publish.mjs` | `npm run verify-dashboard` | Existing publish-shape checks; no new assertions needed for this phase (no new published artifact, no new private-write path) |

**Installation:** none — `npm install` is not required for this phase.

## Package Legitimacy Audit

Not applicable. This phase introduces zero new external packages; nothing to run `slopcheck` or a registry check against. `Standard Stack` above lists only already-installed tooling, confirmed present by reading `package.json` and `vitest.config.ts` directly.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (single client-side SPA, no server tier)                    │
│                                                                        │
│  #/calendar route                                                     │
│   │                                                                    │
│   ▼                                                                    │
│  createCalendarView().mount()                                         │
│   │  1. indexClient.loadIndex()  ──► data/dashboard/index.json        │
│   │       (already-published, pre-computed by the build pipeline)     │
│   │  2. readStoredWeekStart(localStorage)  ──► 'sunday' | 'monday'    │
│   │       (new: calendar-preferences.ts, D-05/D-06/D-07)              │
│   │  3. buildMonthGrid(rows, month, weekStart)  ──► MonthGrid          │
│   │       (calendar-logic.ts, pure — generalized D-08, now also       │
│   │        derives weekTotals per row, D-09/D-13)                     │
│   │  4. renderGrid(grid, weekStart)                                   │
│   │       - weekday header row (week-start-aware WEEKDAY_LABELS)      │
│   │       - per-week loop: 7 × buildDayCellButton + 1 × total cell    │
│   │         (restructured from the current flatten-and-append loop)   │
│   │                                                                    │
│   ▼                                                                    │
│  User clicks the .segmented Sun|Mon toggle                            │
│   │  - writeWeekStart(localStorage, next)   (persist, D-05)           │
│   │  - rebuild grid in place (weekday row + .calendar-grid only,      │
│   │    D-04) — h1, header shell, picker host untouched                │
│   │  - focus stays on the pressed segmented button                    │
│   └─────────────────────────────────────────────────────────────────┘
│                                                                        │
│  On next mount() (page reload): readStoredWeekStart runs again,       │
│  grid renders with the persisted setting immediately — no flash of    │
│  the other week-start (D-05's whole point).                           │
└─────────────────────────────────────────────────────────────────────┘
```

A reader can trace the primary use case end to end: index JSON in → stored preference read → pure grid+totals derivation → per-week DOM render → toggle click → re-derive → re-render in place → persist for next mount.

### Recommended Project Structure

No new directories. Two files change, one file is added, all inside the existing `src/dashboard/` tree:

```
src/dashboard/
├── views/
│   ├── calendar-logic.ts          # MODIFIED: weekStart param, WeekTotal derivation
│   ├── calendar-logic.test.ts     # MODIFIED: re-pin Sunday-first cases (D-03), add Monday cases
│   ├── calendar.ts                # MODIFIED: segmented control, per-week render loop
│   ├── calendar-preferences.ts    # NEW: parseWeekStart/readStoredWeekStart/writeWeekStart (D-06)
│   └── calendar-preferences.test.ts  # NEW
└── styles.css                     # MODIFIED: .calendar-grid 8th column, weekday header, total cell
```

`calendar-preferences.ts` sits in `views/` (not `src/dashboard/theme.ts`'s sibling location at `src/dashboard/`) because it is calendar-scoped, not shell-scoped — `theme.ts` is imported dashboard-wide; this module has exactly one importer, `calendar.ts`, matching D-06's "narrow, calendar-specific" framing.

### Pattern 1: Week-start-aware leading padding (generalizing `firstWeekdayOfMonth`)

**What:** The current function returns a raw Sunday-relative weekday (`0` = Sunday). `buildMonthGrid` uses that value directly as leading `null` padding, which only produces a correct grid when the grid itself is Sunday-first. Generalizing requires subtracting the chosen week-start's offset before taking the grid-relative padding count.

**When to use:** Any month-grid layout where the first column can vary.

**Exact arithmetic (verified against the current test fixtures by direct execution — see below):**

```typescript
// Source: this research, generalizing calendar-logic.ts's existing firstWeekdayOfMonth
export type WeekStart = 'sunday' | 'monday';

const WEEK_START_OFFSET: Record<WeekStart, number> = { sunday: 0, monday: 1 };

/** Weekday (0 = Sunday) of the 1st of `month`, computed via UTC components. Unchanged. */
function rawFirstWeekdayOfMonth(m: CalendarMonth): number {
  return new Date(Date.UTC(m.year, m.month - 1, 1)).getUTCDay();
}

/** Number of leading null cells before day 1, relative to `weekStart`. */
function leadingPadding(m: CalendarMonth, weekStart: WeekStart): number {
  const rawDow = rawFirstWeekdayOfMonth(m);
  const offset = WEEK_START_OFFSET[weekStart];
  return (rawDow - offset + 7) % 7;
}
```

Then in `buildMonthGrid`, replace `const leadingPadding = firstWeekdayOfMonth(month);` with `const padding = leadingPadding(month, weekStart);` and use `padding` everywhere `leadingPadding` was used.

**Verified by direct execution** (Node, replicating this exact formula) against the existing test fixture months:
- March 2024 (`weekStart: 'sunday'`): `rawDow=5` (Friday), offset 0 → padding 5 — matches the existing test "produces 5 leading null cells (Sun-Thu)".
- September 2024 (`weekStart: 'sunday'`): `rawDow=0` (Sunday), offset 0 → padding 0 — matches "produces zero leading null padding".
- October 2025 (`weekStart: 'monday'`): `rawDow=3` (Wednesday), offset 1 → padding `(3-1+7)%7=2` — verified by direct grid computation below, produces the correct Mon/Tue leading nulls before Oct 1 (Wed).

This formula is the standard `(getUTCDay() - startOffset + 7) % 7` shape flagged as the target shape in the research brief, confirmed correct by re-deriving the current Sunday-first test expectations from it with `offset=0` and by computing a full Monday-start October 2025 grid and cross-checking day placement by hand (see "D-16 Discriminator Month" below).

### Pattern 2: Per-week total derivation inside the same pure module (D-09/D-13/D-14)

**What:** `MonthGrid` today carries only month-level `monthTotalM`/`runCount`. Add a `weekTotals: WeekTotal[]` array — one entry per row in `weeks`, computed by summing only the non-null (in-month) `DayCell`s in that row (D-13).

**Concrete interface additions:**

```typescript
// DayCell gains a time field, mirroring the existing totalDistanceM/runCount sum pattern.
export interface DayCell {
  dateKey: string;
  dayOfMonth: number;
  totalDistanceM: number;
  totalTimeSec: number;      // NEW — sum of movingTimeSec for that day's rows, same reduce shape as totalDistanceM
  runCount: number;
  activityIds: string[];
  tintStep: 0 | 1 | 2 | 3 | 4;
}

/** One week row's total, D-13 (in-month cells only) / D-14 (partial disclosure). */
export interface WeekTotal {
  totalDistanceM: number;
  totalTimeSec: number;
  runCount: number;
  daysShown: number;   // count of non-null cells in the row — 7 for a full week, <7 for a boundary week
  isPartial: boolean;  // daysShown < 7 — D-14's accessible-name disclosure trigger
}

export interface MonthGrid {
  month: CalendarMonth;
  weeks: (DayCell | null)[][];
  weekTotals: WeekTotal[];   // NEW — weekTotals[i] corresponds to weeks[i], same length
  monthTotalM: number;
  monthTotalTimeSec: number; // NEW — free to add alongside monthTotalM using the same loop that already sums it (D-09 needs a time figure at month level too, for symmetry, though not explicitly required by any success criterion — optional, but trivial given totalTimeSec now exists per day)
  runCount: number;
}
```

**Derivation** (append after the existing `weeks` construction in `buildMonthGrid`, D-12's empty-week case falls out of `daysShown === 0` at render time, not inside this pure derivation — the pure function should still report `totalDistanceM: 0, totalTimeSec: 0, runCount: 0, daysShown: N` for such a row; the `–` en-dash rendering is `calendar.ts`'s job, matching how a rest-day `DayCell` is still a real object and `calendar.ts` decides to render `–` for it):

```typescript
const weekTotals: WeekTotal[] = weeks.map((week) => {
  const cells = week.filter((c): c is DayCell => c !== null);
  const totalDistanceM = cells.reduce((sum, c) => sum + c.totalDistanceM, 0);
  const totalTimeSec = cells.reduce((sum, c) => sum + c.totalTimeSec, 0);
  const runCount = cells.reduce((sum, c) => sum + c.runCount, 0);
  return { totalDistanceM, totalTimeSec, runCount, daysShown: cells.length, isPartial: cells.length < 7 };
});
```

**Verified against the live archive** — see "D-16 Discriminator Month" below, which is exactly this derivation executed against `data/dashboard/index.json` for October 2025 under both week starts.

### Pattern 3: The `.segmented` control — copy structure exactly, do not invent a variant (D-01)

**What:** Two existing instances share identical markup shape and toggle-update pattern:

```typescript
// Source: src/dashboard/views/records.ts:633-651 (verified read, this session)
const segmented = document.createElement('div');
segmented.className = 'segmented';
segmented.setAttribute('role', 'group');
segmented.setAttribute('aria-label', 'Records scope');   // <- customize per instance

const optionA = document.createElement('button');
optionA.type = 'button';
optionA.className = 'segmented__option segmented__option--active';
optionA.textContent = 'All time';
optionA.setAttribute('aria-pressed', 'true');

const optionB = document.createElement('button');
optionB.type = 'button';
optionB.className = 'segmented__option';
optionB.textContent = 'This year';
optionB.setAttribute('aria-pressed', 'false');

segmented.appendChild(optionA);
segmented.appendChild(optionB);
```

**The active-state toggle pattern** (identical in both `records.ts:673-680` and `detail-charts.ts:542-546`):

```typescript
// Source: src/dashboard/views/detail-charts.ts:538-549 (verified read, this session)
function setXAxisMode(mode: XAxisMode): void {
  if (xAxisMode === mode) return;
  xAxisMode = mode;

  const isDistance = mode === 'distance';
  distanceOption.classList.toggle('segmented__option--active', isDistance);
  distanceOption.setAttribute('aria-pressed', String(isDistance));
  timeOption.classList.toggle('segmented__option--active', !isDistance);
  timeOption.setAttribute('aria-pressed', String(!isDistance));

  rebuildBands();   // <- calendar.ts's equivalent: rebuild the weekday row + .calendar-grid
}
```

**For the Calendar's third instance:** structurally identical — `aria-label="Week start"` (recommendation, see Assumptions Log), option text `"Sunday"` / `"Monday"` (full words, matching the `"All time"`/`"This year"` precedent of spelling things out rather than abbreviating), and the toggle handler calls `writeWeekStart(storage, next)` then rebuilds the grid instead of `renderTables`/`rebuildBands`.

**Phase 19 inheritance confirmed, no opt-in work needed:** `.segmented__option` is a `<button>` with no class exclusions from the D-05/D-06 button baseline (`styles.css:1357` `button { font: inherit; min-height: 32px; cursor: pointer; border-radius: var(--radius-control); }` and the D-06 shared hover at `styles.css:1382`, which explicitly excludes `.segmented__option--active` from the hover-background rule so the active option's `--accent-strong` fill isn't overwritten on hover). The two-tone `:focus-visible` ring (`styles.css:456-461`) is global/unscoped and reaches every `.segmented__option` with no per-instance CSS. `.segmented`'s own rounded-silhouette rules (`styles.css:899-949`, including the CR-02 middle-option-radius fix) are selector-based on the `.segmented`/`.segmented__option` classes, not per-page-instance — a third instance inherits automatically. **CAL-03 is therefore close to free** for this control; the only remaining verification is that it *renders* correctly in the browser (D-02's baseline-alignment risk).

### Pattern 4: Restructuring the render loop from flat to per-week (D-10)

**What:** `calendar.ts`'s current loop (lines 306-311) flattens `grid.weeks` and appends every cell in one pass:

```typescript
// CURRENT — src/dashboard/views/calendar.ts:306-311 (verified read, this session)
const flatCells = grid.weeks.flat();
for (const cell of flatCells) {
  gridEl.appendChild(
    buildDayCellButton(cell, month, (openedCell) => renderPicker(pickerHost, openedCell, indexClient))
  );
}
```

This must become a per-week walk so a total cell can be appended after each week's seven days:

```typescript
// PROPOSED shape
grid.weeks.forEach((week, i) => {
  for (const cell of week) {
    gridEl.appendChild(
      buildDayCellButton(cell, month, (openedCell) => renderPicker(pickerHost, openedCell, indexClient))
    );
  }
  gridEl.appendChild(buildWeekTotalCell(grid.weekTotals[i]));
});
```

Because `.calendar-grid` is a CSS grid with `grid-template-columns: repeat(7, 1fr) auto;` (8 tracks), appending 7 day buttons then 1 total cell per iteration lays out correctly with NO row/column index bookkeeping needed — CSS grid auto-flow wraps every 8 children onto the next row automatically, exactly as it does today with 7. This is the same reason the current flat loop works with no manual row math.

**The weekday header row also needs its 8th "Total" cell**, appended once after the existing `WEEKDAY_LABELS` loop (`calendar.ts:295-300`), not per-week (headers render once, not once per row).

### Anti-Patterns to Avoid

- **Don't add a default value to `buildMonthGrid`'s `weekStart` parameter.** D-08 is explicit: a default would let a forgotten call site silently assume the wrong week start, defeating the entire point of making the parameter required. TypeScript is the enforcement mechanism here, not a runtime check.
- **Don't read `localStorage` or a clock inside `calendar-logic.ts`.** The module's whole contract (stated in its own header comment) is purity/totality — `weekStart` must be injected by the caller (`calendar.ts`), exactly as `now` already is for `parseMonthParam`.
- **Don't re-run the whole `mount()` path on toggle.** It ends in `h1.focus()` (`calendar.ts:320`), which steals focus on every toggle — the exact regression class Phase 20 shipped twice (`list.ts:1112`'s `notedActivityId` leak). D-04 requires an in-place rebuild instead.
- **Don't retrofit ARIA grid/row/cell roles onto `.calendar-grid` for the total cell.** D-11 explicitly rejects this — the grid is a plain CSS grid of buttons with no roles today, and adding them risks regressing the day cells' existing announcements for more than CAL-02 asks.
- **Don't invent a fourth duration-format function without first checking `list.ts`'s existing three** (`formatDurationHms`, `formatPace`, `formatEffortDuration`) — see the Assumptions Log for the specific tension on which one (if any) fits a week total.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Segmented two-option toggle UI | A new toggle component/pattern | Copy `records.ts:633-651`'s exact markup + `detail-charts.ts:538-549`'s exact update pattern | Two working, Phase-19-styled, accessibility-correct instances already exist; a third variant risks a CSS/ARIA drift that a shared pattern wouldn't have |
| localStorage read/write with tamper tolerance | A bespoke try/catch + validation scheme | Copy `theme.ts`'s injectable-`storage` + `parseXxx`-allow-list + silent-fallback shape (D-05/D-06/D-07 mandate this explicitly) | `theme.ts` already solved the exact threat (T-16-TH-01: localStorage is user/extension-writable) and the exact failure mode (throwing storage in private browsing) this module needs to handle |
| Week-boundary date math | A generic ISO-week library or a hand-rolled day-of-week calculator | The existing `(rawDow - offset + 7) % 7` pattern, matching `trends-logic.ts`'s own `weekStartKey` offset logic (`dayOfWeek === 0 ? -6 : 1 - dayOfWeek`) in spirit though not code-shared (D-15 keeps these deliberately un-unified — Trends stays Monday-fixed) | The archive's day-key normalization (`activityDayKey`'s Z-suffix append) is already a solved, tested problem; introducing a date library would duplicate that UTC-discipline logic in a second place |

**Key insight:** Every piece this phase needs has already been built once in this codebase for a sibling concern (theming, records scope, chart x-axis). The risk is not "what pattern to use" but "copying the pattern exactly enough" — CR-02/CR-03 (Phase 19's `.segmented` review findings) show that a segmented control diverging even slightly from the established shape (e.g., missing an exclusion in the shared hover rule) ships a real, checkpoint-catchable defect.

## Common Pitfalls

### Pitfall 1: Reintroducing the "optional-default silently wrong" class of bug

**What goes wrong:** Adding `weekStart: WeekStart = 'sunday'` (or any default) to `buildMonthGrid` lets every existing Sunday-first test keep passing unchanged while the one production call site (`calendar.ts:236`) either forgets to pass the app's actual Monday default (D-03) or passes it inconsistently with the persisted value.
**Why it happens:** Optional parameters are the path of least typing friction, especially when "make the existing tests green with minimal diff" is the instinct.
**How to avoid:** D-08 mandates a required parameter — TypeScript will then refuse to compile the one call site until it's updated, and refuse any new call site that forgets it.
**Warning signs:** A test file where every `buildMonthGrid(rows, month)` call (two-argument) still compiles after this phase's changes — that means the parameter did not actually become required.

### Pitfall 2: Independent per-row rounding making week totals look like they don't reconcile with the month total

**What goes wrong:** Each week's displayed distance is independently rounded to 1 decimal (`toFixed(1)`, matching the existing `calendar.ts:137`/`:243` pattern). Summing already-rounded row values can differ from the month total's own independently-rounded figure by ±0.1 km, even though the underlying unrounded metres reconcile exactly.
**Why it happens:** `toFixed(1)` is applied per-value, not once at the end — this is the SAME behavior the app already has for day cells vs. the month total, just newly visible at the week-row level.
**How to avoid:** Do not "fix" this by forcing week totals to sum exactly to the displayed month total (that would require carrying rounding error between rows, a worse bug). Document it as expected in the checkpoint: **verified below** for October 2025 — Sunday-start week totals display-sum to 357.3 km (matches the month total exactly by coincidence of rounding), Monday-start week totals display-sum to 357.2 km (0.1 km below the month total's 357.3 km display value), while the exact unrounded metres sum to 357.349 km for both. This is a **display-rounding artifact, not a computation bug** — the checkpoint agenda should read back the row values, not assert they sum to the displayed month total.
**Warning signs:** A bug report reading "week totals don't add up to the month total" that is actually just independent `toFixed(1)` rounding — check the underlying `distanceM` sums (unrounded) before concluding there's a real derivation bug.

### Pitfall 3: `.calendar-day` cells and the new total cell fighting for the same CSS grid area names

**What goes wrong:** `.calendar-day` uses `grid-template-areas: "number . ." ". distance ." ". . count"` — a 3×3 internal layout. If the new total cell reuses `.calendar-day`'s class (instead of a new class), it inherits a day-number-shaped internal grid it doesn't need (there's no "day number" for a week total), and the `--outside`/`--rest`/`--tint-N` modifiers become nonsensical on it.
**Why it happens:** D-10's own wording ("mirroring `.calendar-day`'s existing number/distance/count grid") could be read as "reuse the class," when it more likely means "reuse the *idea* of a stacked small-label/big-value/small-label layout."
**How to avoid:** Give the total cell its own class (e.g. `.calendar-week-total`) with its own, simpler stacked layout (three lines: distance, time, count — no day-number slot), rather than retrofitting `.calendar-day`'s 3×3 grid-template-areas.
**Warning signs:** CSS that sets `grid-area: number` on anything inside the new total cell — there is no day number to place.

### Pitfall 4: Toggling week start while the multi-run day picker is open

**What goes wrong:** `pickerHost` (`calendar.ts:304`) lives outside the region D-04 replaces (weekday row + `.calendar-grid` only) — an open picker survives a toggle untouched. The picker's *content* stays correct (same day, same `activityIds`, unaffected by week-start), but its presence next to a just-reorganized grid may read as stale/disconnected UI state.
**Why it happens:** D-04 deliberately scopes the rebuild narrowly to avoid the `h1.focus()` regression — but that same narrow scope means anything outside it (the picker host) is never told a toggle happened.
**How to avoid:** See "Code Context" item 6 below for the concrete recommendation — clear `pickerHost` in the toggle handler.
**Warning signs:** A browser checkpoint step where a picker is open, the user toggles week start, and the picker visibly persists next to a grid that has just changed shape underneath it — flag this explicitly as a checkpoint row if the recommendation below isn't implemented.

## Code Examples

### `firstWeekdayOfMonth` → week-start-aware `leadingPadding` (generalization)

```typescript
// Source: this research, based on the exact shape flagged in the research brief,
// verified against calendar-logic.test.ts's existing fixture months (see Pattern 1 above)
export type WeekStart = 'sunday' | 'monday';

const WEEK_START_OFFSET: Record<WeekStart, number> = { sunday: 0, monday: 1 };

function rawFirstWeekdayOfMonth(m: CalendarMonth): number {
  return new Date(Date.UTC(m.year, m.month - 1, 1)).getUTCDay();
}

function leadingPadding(m: CalendarMonth, weekStart: WeekStart): number {
  const rawDow = rawFirstWeekdayOfMonth(m);
  return (rawDow - WEEK_START_OFFSET[weekStart] + 7) % 7;
}

export function buildMonthGrid(
  rows: readonly DashboardIndexRow[],
  month: CalendarMonth,
  weekStart: WeekStart   // D-08: required, no default
): MonthGrid {
  // ...unchanged monthPrefix/byDay grouping logic...
  const totalDays = daysInMonth(month);
  const padding = leadingPadding(month, weekStart);   // was: firstWeekdayOfMonth(month)
  const cellCount = padding + totalDays;
  const weekCount = Math.max(MIN_WEEK_ROWS, Math.ceil(cellCount / 7));
  const totalSlots = weekCount * 7;
  const flatCells: (DayCell | null)[] = new Array(totalSlots).fill(null);
  // ...day loop uses `padding + day - 1` instead of `leadingPadding + day - 1`...
  // ...weeks construction unchanged...
  // NEW: weekTotals derivation (see Pattern 2)
}
```

### Week-start-aware `WEEKDAY_LABELS`

```typescript
// Source: this research, generalizing calendar.ts:31's hard-coded array
const WEEKDAY_NAMES_SUNDAY_FIRST = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayLabels(weekStart: WeekStart): readonly string[] {
  if (weekStart === 'sunday') return WEEKDAY_NAMES_SUNDAY_FIRST;
  // Monday-first: rotate the Sunday-first array left by one.
  return [...WEEKDAY_NAMES_SUNDAY_FIRST.slice(1), WEEKDAY_NAMES_SUNDAY_FIRST[0]];
}
```

### `calendar-preferences.ts` — the persistence module, shaped like `theme.ts`

```typescript
// Source: this research, mirroring src/dashboard/theme.ts's exact discipline
// (injectable storage, validating parse, silent fallback, throw-tolerant read)
import type { WeekStart } from './calendar-logic.js';

export const WEEK_START_STORAGE_KEY = 'dashboard-calendar-week-start';  // see Assumptions Log — [ASSUMED] naming

export interface WeekStartStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Total function: anything other than the literal strings 'sunday'/'monday' falls back to 'monday' (D-03/D-07). */
export function parseWeekStart(raw: unknown): WeekStart {
  if (raw === 'sunday' || raw === 'monday') return raw;
  return 'monday';
}

/** Tolerates a throwing storage.getItem (private mode) by falling back to the default — matches theme.ts's readStoredMode. */
export function readStoredWeekStart(storage: WeekStartStorage): WeekStart {
  try {
    return parseWeekStart(storage.getItem(WEEK_START_STORAGE_KEY));
  } catch {
    return 'monday';
  }
}

/** Tolerates a throwing storage.setItem (private mode) by swallowing the failure — matches theme.ts's applyThemeMode. */
export function writeWeekStart(storage: WeekStartStorage, value: WeekStart): void {
  try {
    storage.setItem(WEEK_START_STORAGE_KEY, value);
  } catch {
    // Swallow — matches theme.ts's applyThemeMode persist failure handling.
  }
}
```

This answers the "Claude's Discretion" question of whether the read is wrapped against a throwing storage: **yes, `theme.ts` wraps BOTH `readStoredMode` (try/catch → `'auto'` fallback) and `applyThemeMode`'s `storage.setItem` call (try/catch, swallowed) — confirmed by direct read of `theme.ts:63-69` and `theme.ts:101-108`.** The module above matches both halves of that discipline exactly.

## State of the Art

Not applicable in the traditional "library version drift" sense — this is a zero-dependency phase. The one relevant "state of the art" fact is internal: the Calendar is currently the **only** Monday-disagreeing surface in the app (D-03's own framing), so this phase is catching the Calendar up to a convention (`weekStartISO` Monday-fixed) that has existed elsewhere in the codebase since `analytics.types.ts`'s original authoring — not introducing a new convention.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `calendar-logic.ts` hard-codes Sunday-first via raw `getUTCDay()` | `buildMonthGrid` takes a required `WeekStart` parameter, generalized leading-padding formula | This phase | Existing `calendar-logic.test.ts` Sunday-first expectations must be re-pinned as explicit `'sunday'` cases (D-03) — a silent behavior change for any test that omits the parameter |
| Calendar defaults to Sunday-first with no stored preference | Calendar defaults to Monday (D-03), matching `weekStartISO`/`weekStartKey` elsewhere | This phase | The deployed calendar visibly re-flows on first load after ship — expected, must be called out at the checkpoint like 19-CONTEXT D-08's hover-change precedent |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `localStorage` key name `'dashboard-calendar-week-start'` (following `theme.ts`'s `'dashboard-theme'` shape) | Code Examples, `calendar-preferences.ts` | Low — purely cosmetic devtools-visible string; changing it later just orphans one old key with no migration need (matches D-07's "no attempt to repair or rewrite the key" philosophy for OTHER apps' garbage values, and there's no existing key to migrate away from) |
| A2 | Week-total time format recommendation: a new, small "Xh Ym" formatter (e.g. "5h 27m", no seconds), NOT a reuse of `list.ts`'s existing `formatDurationHms` (`h:mm:ss`, e.g. "10:14:23") | Pitfall/Discretion notes; see explicit tension flagged in Open Questions below | Medium — this is explicitly unlocked by D-09 ("planning picks it"), but CONTEXT.md's own D-14 illustrative aria-label example ("...18.2 km, 1h 32m, 2 runs") already implies the "Xh Ym" shape without seconds, creating a soft precedent the planner should weigh against reusing an existing exported formatter |
| A3 | Recommendation to clear `pickerHost` on every week-start toggle (D-04's explicitly-open sub-question) | Pattern/Pitfall 4 | Low-medium — a UX judgment call, not a correctness bug either way; if wrong, worst case is a stale-but-accurate picker panel next to a reorganized grid, not a data error |
| A4 | Mobile strategy for the 8th column: wrap `.calendar-grid` in a horizontal-scroll container mirroring `.splits-scroll`'s existing pattern (`overflow-x:auto; -webkit-overflow-scrolling:touch;`), rather than reflowing to a card layout | Don't Hand-Roll / Common Pitfalls context | Medium-high — D-10 itself flags this as "the real layout risk"; this is a genuinely unverified recommendation (no rendered-browser check performed in this research session) and MUST be confirmed at the D-10-flagged checkpoint row regardless of which strategy planning picks |
| A5 | New CSS class `.calendar-week-total` (rather than reusing `.calendar-day`) for the total cell's styling hook | Common Pitfalls, Pitfall 3 | Low — an implementation-naming choice; reusing `.calendar-day` instead would still work visually if its 3×3 areas are simply not fully populated, but risks unintended inheritance of `--outside`/`--rest`/`--tint-N` modifier CSS matching by accident |
| A6 | `aria-label="Week start"` on the segmented group, with option button text `"Sunday"`/`"Monday"` (full words) | Pattern 3 | Low — cosmetic/a11y-wording choice; any reasonable, distinct wording satisfies CAL-01's "selectable" requirement, and this mirrors the existing `"Records scope"` / `"Chart x-axis"` naming convention exactly |
| A7 | Suggested threat-ID label `T-22-WK-01` for the new localStorage tamper-tolerance note, following the project's existing `T-16-TH-01`/`T-17-URL-04`/`T-17-CAL-02`/`T-17-CAL-03` naming convention | Security Domain | Low — a documentation-convention suggestion only, not a functional claim; any consistent ID works |

## Open Questions

1. **Week-total time format: "Xh Ym" vs. reuse of `formatDurationHms` (`h:mm:ss`)**
   - What we know: D-09 explicitly leaves this open ("planning picks it — day cells set no precedent"). `list.ts` already exports THREE duration formatters (`formatDurationHms` for activity moving-time stats, `formatPace` for pace, `formatEffortDuration` for PR/effort times under an hour) — none is a perfect semantic fit for "one week's summed moving time," which is a genuinely new kind of duration (always likely well over an hour, aggregated rather than per-activity).
   - What's unclear: D-14's own illustrative aria-label example in CONTEXT.md ("...18.2 km, 1h 32m, 2 runs") already implies an "Xh Ym" shape, which is neither of the two existing formatters' exact output shape (`formatDurationHms` would render that as `1:32:00`).
   - Recommendation: define one small new formatter local to `calendar.ts` (not `calendar-logic.ts`, matching the existing precedent that km-string formatting is inline in `calendar.ts` rather than in the pure module) producing `"{h}h {m}m"` with no seconds and no zero-padding, e.g. `formatWeekDuration(totalTimeSec: number): string`. This avoids inventing a fourth generic duration formatter for reuse elsewhere (there is no other consumer today) while matching CONTEXT's own illustrative wording. Flag this choice explicitly for user confirmation if the planner wants certainty rather than a research recommendation.

2. **Should `monthTotalTimeSec` be added to `MonthGrid` even though no success criterion explicitly asks for it?**
   - What we know: Adding `totalTimeSec` to `DayCell` (needed for week totals) makes a parallel `monthTotalTimeSec` essentially free — same reduce, same loop.
   - What's unclear: Nothing in ROADMAP.md's five success criteria or REQUIREMENTS.md's CAL-01..03 text asks for a month-level time figure; `calendar.ts:243`'s header currently shows only `{km} km` / `across {N} runs`.
   - Recommendation: add the field to the pure module for symmetry/cheapness, but do NOT render it in the header unless the planner decides it's in scope — rendering it would be a scope addition beyond CAL-01/02/03, however small.

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependencies beyond the already-installed, already-verified Node/TypeScript/Vitest/esbuild toolchain every prior phase in this milestone has used. Nothing new to probe.

## Validation Architecture

`nyquist_validation` is enabled (`.planning/config.json`, `workflow.nyquist_validation: true`) and this project's own house rule (`PROJECT.md` line 49, restated in every prior v2.1 phase) is: **automated gates have missed rendering defects three times — unit tests never discharge a visual claim.** Every success criterion below that touches rendering or interaction gets a mandatory human-observation row; only the pure grid-math derivation (criterion 2's core) is genuinely unit-testable end to end.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest@` per `package.json` devDependencies — already in use project-wide) |
| Config file | `vitest.config.ts` (`environment: 'node'`, `include: ['src/**/*.test.ts']`) — no jsdom, confirmed no browser DOM emulation exists in this repo, consistent with the milestone-wide "no phase's success criteria can be satisfied by `npm test` alone" note in ROADMAP.md |
| Quick run command | `npx vitest run src/dashboard/views/calendar-logic.test.ts src/dashboard/views/calendar-preferences.test.ts` |
| Full suite command | `npm test` (→ `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| CAL-01 | `parseWeekStart`/`readStoredWeekStart`/`writeWeekStart` are total, tamper-tolerant, default to Monday | unit | `npx vitest run src/dashboard/views/calendar-preferences.test.ts` | ❌ Wave 0 (new file) |
| CAL-01 | Control renders, toggles, and the choice **actually persists across a real browser reload** | manual-only | — (localStorage across a real page reload cannot be exercised by a Node-environment Vitest run with no DOM) | N/A — human checkpoint only |
| CAL-02 | `buildMonthGrid`'s leading-padding is correct for both `'sunday'` and `'monday'` across the existing fixture months (re-pinned + new cases) | unit | `npx vitest run src/dashboard/views/calendar-logic.test.ts` | ✅ exists, needs Wave 0 edits (re-pin + new cases) |
| CAL-02 | `weekTotals` derivation sums only in-month cells per row (D-13), correct for both week starts | unit | `npx vitest run src/dashboard/views/calendar-logic.test.ts` | ❌ Wave 0 (new test cases in the existing file) |
| CAL-02 | Total cell **actually renders** at the end of each week row, with correct on-screen numbers for a boundary week | manual-only | — (DOM rendering, no jsdom in this repo) | N/A — human checkpoint only, discharged by the October 2025 discriminator table below |
| CAL-03 | `.segmented__option` markup structurally matches the existing two instances (source-guard style, following `styles.test.ts`'s existing parse-level assertion precedent from Phase 19) | unit (source-structure guard, not a rendering test) | `npx vitest run src/dashboard/styles.test.ts` (if a new assertion is added there) or a plain source-grep guard in `calendar.test.ts`-style file | ❌ Wave 0 if planner chooses to add one — optional, since CAL-03 is fundamentally a visual claim |
| CAL-03 | Control visually renders with Phase 19 styling, focus ring, hover, both themes | manual-only | — | N/A — human checkpoint only |

### Sampling Rate

- **Per task commit:** `npx vitest run src/dashboard/views/calendar-logic.test.ts src/dashboard/views/calendar-preferences.test.ts` (fast, scoped to this phase's changed files)
- **Per wave merge:** `npm test` (full suite — confirms no regression in `trends-logic.test.ts`/`records-logic.test.ts`, which read the same Monday-fixed `weekStartISO` convention this phase deliberately does NOT touch, D-15)
- **Phase gate:** Full suite green (`npm test`), clean `tsc` (`npm run build`), clean `npm run build-widgets`, clean `npm run verify-dashboard` — THEN the mandatory human browser checkpoint (success criterion 5) using the October 2025 discriminator numbers below to read back, not just confirm presence of, both week-start total sets.

### Wave 0 Gaps

- [ ] `src/dashboard/views/calendar-preferences.test.ts` — new file, covers CAL-01's pure persistence functions (parse/read/write, default-to-Monday, tamper tolerance, throwing-storage tolerance)
- [ ] `src/dashboard/views/calendar-logic.test.ts` — every existing Sunday-first `buildMonthGrid` expectation must be re-pinned to pass `'sunday'` explicitly (D-03); new Monday-start cases for the same fixture months; new `weekTotals` derivation test cases (full week, partial/boundary week, empty week, both week starts)
- [ ] Framework install: none — Vitest is already configured and used by 20+ existing test files in this exact directory

## Security Domain

`security_enforcement` is absent from `.planning/config.json` — per the operating instructions, absence means enabled, so this section is included. This phase's security surface is narrow: it introduces one new untrusted-input path (a `localStorage` value a user, browser extension, or third-party script could tamper with) and no network/auth/session surface at all (this is a static, client-only SPA with no login on the dashboard itself).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | This dashboard route has no authentication surface; Strava/intervals.icu auth lives entirely in the build-time ingestion pipeline, untouched by this phase |
| V3 Session Management | No | No session concept in the client SPA |
| V4 Access Control | No | No access-control boundary — the published index is already public data, and the Calendar's week-start preference does not gate access to anything |
| V5 Input Validation | Yes | The `parseWeekStart` allow-list (`'sunday' | 'monday'` only, silent fallback to `'monday'` for anything else) — mirrors `theme.ts`'s `parseThemeMode` exactly, same category of control |
| V6 Cryptography | No | No cryptographic operation in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| `localStorage` tampering — a browser extension, another same-origin script, or manual devtools edit writes an unexpected value under the calendar week-start key | Tampering | Allow-list parse (`parseWeekStart`) that only accepts the exact literals `'sunday'`/`'monday'`, silently falling back to the safe default (`'monday'`) for anything else — the exact pattern `theme.ts`'s header names as threat **T-16-TH-01**. This phase's equivalent note (suggested label **T-22-WK-01**, `[ASSUMED]` — a documentation-convention suggestion, not an existing codebase artifact) should be added to `calendar-preferences.ts`'s header comment, following the same convention |
| Throwing `storage.getItem`/`setItem` (Safari private-mode, disabled cookies, storage quota) causing an unhandled exception that crashes the calendar mount | Denial of Service (client-side) | try/catch around both the read and write paths, falling back to the in-memory default and swallowing write failures — exactly `theme.ts`'s `readStoredMode`/`applyThemeMode` pattern, reused verbatim in the Code Examples section above |

No new network-facing surface, no new data written to the published bundle, no change to `verify-dashboard-publish.mjs`'s private-artifact assertions — this phase's entire security surface is the one `localStorage` key, already fully covered by the `theme.ts`-mirrored design above.

## D-16 Discriminator Month

**October 2025** — computed directly by executing `buildMonthGrid`'s exact generalized arithmetic (Pattern 1 + Pattern 2 above) against the live `data/dashboard/index.json` (1,868 activities, generated 2026-08-12) in this research session. **`[VERIFIED: computed against data/dashboard/index.json]`** — this is not a staged fixture; every number below is read directly from the committed archive.

**Why October 2025 qualifies as the discriminator:** exactly one activity in the month falls on a Sunday — **Oct 19, 2025, "Morning Run," 24.0 km, 2h 31m37s (9,097 s)**. October 1, 2025 is a Wednesday (`getUTCDay() === 3`), so under Sunday-start the leading padding is 3 and under Monday-start it is 2 — the single Sunday activity moves from ending one week row (Monday-start) to starting the next (Sunday-start), changing both adjacent rows' composition. No other day in the month is a boundary-moving Sunday with nonzero activity, which makes the effect on exactly two rows unambiguous and easy to read back at the checkpoint.

### Sunday-start week totals (October 2025)

| Row | Days (Oct) | Distance | Time | Runs |
|-----|------------|----------|------|------|
| 1 | 1–4 | 59.1 km | 5h 42m | 5 |
| 2 | 5–11 | 80.0 km | 7h 53m | 6 |
| 3 | 12–18 | 56.0 km | 5h 27m | 4 |
| **4** | **19–25** | **104.1 km** | **10h 14m** | **7** |
| 5 | 26–31 | 58.1 km | 5h 32m | 5 |

Display-sum of rows: 357.3 km (matches the month total's own display value exactly, by coincidence of rounding — see Pitfall 2).

### Monday-start week totals (October 2025)

| Row | Days (Oct) | Distance | Time | Runs |
|-----|------------|----------|------|------|
| 1 | 1–5 | 59.1 km | 5h 42m | 5 |
| 2 | 6–12 | 80.0 km | 7h 53m | 6 |
| **3** | **13–19** | **80.0 km** | **7h 58m** | **5** |
| **4** | **20–26** | **80.0 km** | **7h 42m** | **6** |
| 5 | 27–31 | 58.1 km | 5h 32m | 5 |

Display-sum of rows: 357.2 km (0.1 km below the month total's display value of 357.3 km — see Pitfall 2; the exact unrounded metres, 357.349 km total, are identical between both week-start groupings, confirming this is a rounding artifact, not a computation error).

**Reconciliation with the month total:** `calendar.ts:243` renders `(grid.monthTotalM / 1000).toFixed(1)` — for October 2025 that is **"357.3 km"** under both week starts (`monthTotalM` does not depend on `weekStart` at all, since it sums every in-month day regardless of grid layout). Both week-start row sets above reconcile with this exactly at the unrounded-metres level (357.349 km both ways); only the independently-rounded *displayed* row sum for Monday-start differs by 0.1 km, per Pitfall 2.

**Checkpoint-ready reading:** rows 3 and 4 are the ones to read back at the D-16 checkpoint — a viewer toggling from Sunday-start to Monday-start on October 2025 should see the "12–18 / 56.0 km / 5h 27m / 4 runs" and "19–25 / 104.1 km / 10h 14m / 7 runs" rows visually merge-and-redistribute into "13–19 / 80.0 km / 7h 58m / 5 runs" and "20–26 / 80.0 km / 7h 42m / 6 runs" — a genuinely legible, non-trivial redistribution (not just "the numbers changed," which per D-16's own stated rationale is not proof, since a wrong-grouping bug would also change the numbers). The fact that both post-toggle rows land on the same 80.0 km display value while having different underlying day compositions AND different run counts (5 vs. 6) is itself a useful discriminator against a "grid re-flowed but week grouping didn't actually change" bug — a broken toggle that just repainted the same grouping would show 56.0/104.1 unchanged, not 80.0/80.0.

**No staged fixture was needed** — this directly confirms D-16's own expectation ("1,868 activities across multiple years give plenty of qualifying months"). 97 distinct months in the live archive contain at least one Sunday-dated activity and would have worked; October 2025 was selected for having exactly one such activity (cleanest single-variable discriminator) in a recently-completed, non-current month.

## Sources

### Primary (HIGH confidence — direct source read or direct code execution against the live repo, this session)

- `src/dashboard/views/calendar-logic.ts` — full read, the pure module `buildMonthGrid`/`firstWeekdayOfMonth`/`DayCell`/`MonthGrid` live in
- `src/dashboard/views/calendar-logic.test.ts` — full read, every existing Sunday-first expectation enumerated
- `src/dashboard/views/calendar.ts` — full read, `WEEKDAY_LABELS`, `buildDayCellButton`, the render loop, `h1.focus()`, mount-race guards
- `src/dashboard/theme.ts` — full read, the exact persistence pattern D-05/D-06/D-07 mandate copying
- `src/dashboard/views/records.ts` lines 590-688 — the first `.segmented` instance, `setScope`, the storage-decision comment at line 608
- `src/dashboard/views/detail-charts.ts` lines 190-290, 520-560 — the second `.segmented` instance, `options.storage ?? globalThis.localStorage` idiom, `setXAxisMode`
- `src/dashboard/styles.css` lines 440-570, 690-1000, 1330-1462 — `.calendar-*` block, `.segmented*` rules and their CR-02/CR-03 history comments, button baseline, focus ring, mobile breakpoints
- `src/analytics/dashboard-index.types.ts` — full read, confirms `distanceM`/`movingTimeSec` present on `DashboardIndexRow`
- `src/types/analytics.types.ts` line 9, `src/dashboard/views/trends-logic.ts` lines 65-94, `src/dashboard/views/records-logic.ts` lines 261-277 — the Monday-fixed `weekStartISO`/`weekStartKey` convention D-15 forbids touching
- `src/dashboard/views/list.ts` lines 60-135 — the three existing duration/date/pace formatters, checked for reuse fitness (Open Question 1)
- `data/dashboard/index.json` — executed against directly (Node) to produce the October 2025 discriminator table above; 1,868 activities confirmed, `generatedAt: 2026-08-12T10:21:02.111Z`
- `package.json`, `vitest.config.ts` — confirmed test/build tooling and commands, no new dependency needed
- `.planning/config.json` — confirmed `nyquist_validation: true`, `security_enforcement` absent (treated enabled)
- `.planning/phases/22-calendar-week-start-totals/22-CONTEXT.md` — all 16 locked decisions, discretion items, deferred ideas (copied verbatim above)
- `.planning/REQUIREMENTS.md` lines 33-35, `.planning/ROADMAP.md` § Phase 22 — CAL-01/02/03 wording and the five success criteria
- `.planning/STATE.md`, `.planning/PROJECT.md` line 49 — the house rule on automated gates never discharging a visual claim

### Secondary (MEDIUM confidence)

None — this phase required no external web research; every claim was resolvable against this repository's own source and data.

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, confirmed by direct `package.json`/`vitest.config.ts` read
- Architecture: HIGH — every pattern (segmented control, `theme.ts` persistence shape, pure-module date math) verified against actual shipped code in this repo, not inferred from training data
- Pitfalls: HIGH for the rounding/CSS-area/mount-race pitfalls (all derived from direct code/CSS read); MEDIUM for the mobile-layout-strategy recommendation specifically (A4 in Assumptions Log — genuinely unverified in a browser, flagged for the D-10 checkpoint)
- D-16 discriminator month: HIGH — computed directly against the live, committed archive file in this session, not assumed or estimated

**Research date:** 2026-08-18
**Valid until:** No expiry driver — this is entirely internal-codebase research with no external library-version dependency to go stale. Re-verify only if `data/dashboard/index.json` is regenerated before planning executes (the October 2025 figures would need re-computing against a newer archive snapshot, though the underlying activities for a closed historical month are extremely unlikely to change).
