# Phase 22: Calendar Week-Start & Totals - Context

**Gathered:** 2026-08-18
**Status:** Ready for planning

<domain>
## Phase Boundary

The Calendar view gains a user-selectable Sunday/Monday week start. The choice persists
across reloads, and it correctly drives both the month grid's column order and a new
per-week-row total. The control is styled with the Phase 19 shared treatment.

Requirements: **CAL-01** (selectable, persisted week start), **CAL-02** (week totals at the
end of each week row, respecting the selected start), **CAL-03** (calendar controls use the
UI-01/UI-02 shared styling).

Two things are inside this boundary that a surface reading might miss:

1. `calendar-logic.ts`'s grid math is genuinely hard-coded Sunday-first — `firstWeekdayOfMonth`
   returns a raw `getUTCDay()` and `buildMonthGrid` uses it directly as leading padding.
   Success criterion 2 requires generalizing that pure function with unit coverage for
   **both** week-start values, not restyling around it.
2. `MonthGrid` today carries `monthTotalM` and `runCount` but **no per-week totals at all**.
   CAL-02 is new derivation in the pure module, not just new markup.

Not in this phase: any change to how weekly aggregates are computed in the pipeline
(see D-15), the Trends screen (Phase 23), and local curation mode (Phase 24).

</domain>

<decisions>
## Implementation Decisions

### Week-start control

- **D-01: A `.segmented` Sun | Mon toggle, not a `<select>`.** Reuses the dashboard's
  established two-option control from `records.ts:633` and `detail-charts.ts:257` — a
  `div.segmented` with `role="group"` and an `aria-label`, containing two `<button type="button">`
  elements carrying `segmented__option` / `segmented__option--active` and `aria-pressed`.
  Both states stay visible, which suits a binary spatial choice better than hiding one behind
  a click. CAL-03 is therefore discharged through Phase 19's **button** baseline (19-CONTEXT D-05,
  D-06, D-09/D-10's focus ring) rather than its `input, select, textarea` baseline (D-01).
  Note this is a deliberate divergence from 19-CONTEXT.md D-01's parenthetical, which
  anticipated a "week-start select" — the segmented pattern won on consistency with the two
  toggles already shipped.

- **D-02: The control lives in `.calendar-header`, appended after the "Jump to month" input.**
  `styles.css:709` is already `display: flex; flex-wrap: wrap; align-items: baseline;
  gap: var(--space-md)`, so it absorbs a fourth item with no new layout CSS. Keeps every
  calendar control in one band and keeps the setting visibly scoped to the calendar rather
  than reading as app-wide. **Planning must check** baseline alignment across the
  `text-display` month total, the two nav buttons, the month input and the segmented group —
  `align-items: baseline` across mixed control heights is the likely visual snag, and it
  belongs on the checkpoint list.

- **D-03: Monday is the default when nothing is stored.** This makes the Calendar agree with
  the rest of the app for the first time: `src/types/analytics.types.ts:9` documents
  `weekStartISO` as "ISO 8601 Monday UTC", `trends-logic.ts:75-78` `weekStartKey` offsets to
  Monday, and `records-logic.ts`'s biggest-week reads those Monday keys. The Calendar is
  currently the only Monday-disagreeing surface.
  **Two consequences the planner must handle deliberately, not incidentally:**
  (a) the deployed calendar visibly re-flows on first load after this ships — that is expected,
  not a regression, and should be called out at the human checkpoint the way 19-CONTEXT D-08
  called out its hover change;
  (b) every Sunday-first expectation in `calendar-logic.test.ts` must be re-pinned as an
  *explicit* Sunday-start case, never left to an implicit default.

- **D-04: Toggling rebuilds the grid in place and does not move focus.** The click handler
  recomputes the grid and replaces the weekday label row plus `.calendar-grid`, leaving the
  `h1`, the header and the picker host untouched. Focus stays on the segmented button the user
  just pressed, so a keyboard user can toggle back and forth. This mirrors `records.ts`'s
  `renderTables` swapping only its `tablesContainer`.
  **Explicitly rejected:** re-running the whole `mount()` path — it ends with `h1.focus()`
  (`calendar.ts:320`), which would steal focus on every toggle. Phase 20 shipped two separate
  focus-theft regressions of exactly that shape, most recently the `notedActivityId` leak at
  `list.ts:1112`. Open sub-question for planning: whether an open day-picker below the grid
  should be cleared on toggle (the picker host is outside the replaced region, so it will
  survive unless explicitly cleared).

### Persistence

- **D-05: `localStorage`, shaped like `theme.ts`.** A dedicated key written on toggle and read
  on mount. Follow `theme.ts`'s discipline exactly: an **injectable `storage` parameter**
  defaulting to `localStorage` (as `theme.ts:93`/`:130` and `detail-charts.ts:218` already do)
  so the read/write path is unit-testable without a DOM, and a **validating parse** that treats
  the stored value as untrusted — `theme.ts`'s threat note T-16-TH-01 records that
  `localStorage` is user- and extension-writable.
  **Explicitly rejected:** a `?weekStart=` URL param as the sole mechanism. It dies as soon as
  the user navigates to another view and back, because `nav.ts` links to a bare `#/calendar` —
  so "persists across reloads" would only hold for a literal reload of a URL that already
  carries the param. Also rejected: URL-plus-storage with a precedence rule, which would pull
  against D-04's no-navigation decision.

- **D-06: A calendar-specific module, not a generic view-preference facility.** Narrow surface —
  `parseWeekStart(raw)`, `readStoredWeekStart(storage)`, `writeWeekStart(storage, value)` — as
  total functions with injectable storage and no key registry. There is no second consumer
  waiting: Phase 21's D-04 decided the Records scope deliberately does **not** persist. If
  Phase 24's curation mode or a later phase wants persistence, generalizing two concrete cases
  beats guessing now. Also rejected: extending `theme.ts` itself, whose header explicitly scopes
  it to theming.
  **This settles the open question `records.ts:608` recorded in source** — "Phase 22's CAL-01
  owns the decision to introduce a storage mechanism for view state". The answer is: yes,
  localStorage is now sanctioned for view state, but per-view and narrowly, not as a shared store.
  Phase 21's D-04 (Records scope resets to all-time on every arrival) is **unchanged** by this.

- **D-07: The stored value is the string literal `'sunday'` or `'monday'`, with a silent fallback.**
  Human-readable in devtools and self-describing to a future phase that doesn't share our
  numbering. Anything else — `null`, `''`, `'MONDAY'`, `'3'`, an object — parses to the Monday
  default (D-03) with no console noise and no attempt to repair or rewrite the key, exactly as
  `theme.ts` treats an unrecognised mode. Keeps the read path total, matching
  `calendar-logic.ts`'s stated never-throws contract.

- **D-08: `buildMonthGrid` takes the week start as a required third parameter.**
  `buildMonthGrid(rows, month, weekStart)` — **no default value**. There is exactly one
  production call site (`calendar.ts:236`), so the churn is trivial, and TypeScript then makes
  it impossible to add a call site that silently assumes a week start. This matters
  specifically because the app default is Monday (D-03): an optional param defaulting to
  `'sunday'` would let existing tests keep passing while asserting the wrong thing, in the one
  function success criterion 2 is entirely about. `calendar-logic.ts` stays pure and total —
  the week start is injected by the caller, never read from storage or a clock inside the module,
  the same rule its header already states for `now`.

### Week totals

- **D-09: Each week total shows all three of distance, time and run count.** *(User chose this
  over the recommended distance-only option.)* `DashboardIndexRow` already carries `distanceM`
  and `movingTimeSec`, so this is free data with no pipeline work. Distance formats as the
  existing `(m / 1000).toFixed(1)` + `km` used at `calendar.ts:137` and `:243`. The time format
  is **not locked** — planning picks it; the day cells set no precedent because they show no time.

- **D-10: The total renders as an 8th grid column sized to its own content.**
  `.calendar-grid` (`styles.css:727`) goes from `repeat(7, 1fr)` to `repeat(7, 1fr)` plus an
  `auto`/`minmax` final column, so the total column sizes to its content instead of taking a
  seventh of the day columns — which matters now that three values live in it. The weekday
  label row gains an 8th header cell ("Total"). The total cell stacks its three values,
  mirroring `.calendar-day`'s existing number / distance / count grid, so no new visual concept
  enters `styles.css`. **Eight columns on a phone is the real layout risk here** and belongs
  on the checkpoint list.

- **D-11: The total cell is static content, not a focusable button.** Nothing to activate, so a
  focus stop would be a false affordance. The every-slot-is-a-real-button rule at
  `calendar.ts:96-99` exists specifically to keep Tab order identical every month; a
  non-focusable 8th column does not disturb it, it just ends each row's stops at day 7. The
  cell carries an accessible name that says which week it sums, so a screen-reader user is not
  handed a bare number. **Rejected:** introducing full ARIA grid/row/cell roles —
  `.calendar-grid` is a plain CSS grid of buttons with no roles today, and retrofitting them
  risks regressing the day cells' announcements for more than CAL-02 asks.

- **D-12: A week with no runs shows an en-dash `–`, matching the rest-day convention.** Exactly
  what a zero-distance day cell renders today (`calendar.ts:124`). Time and count lines are
  **omitted**, not shown as `0h 0m` / `×0`. The accessible name reads as a rest week rather
  than a string of zeros. This is a real case — `buildMonthGrid` guarantees at least
  `MIN_WEEK_ROWS = 4` rows and pads months out.

### Week boundary math

- **D-13: A week total sums only the visible in-month days — the non-null `DayCell`s in that row.**
  The number always reconciles with the cells beside it, and the week totals sum to the month
  total already shown at `calendar.ts:243`. `buildMonthGrid` already filters rows to the month
  prefix, so no extra data plumbing is needed.
  **Rejected:** summing the true 7-day calendar week across the month boundary. It is arguably
  the better training-log answer and matches what `weekStartISO` means everywhere else in the
  app, but it requires the unfiltered row set plus a week-key grouping like `trends-logic.ts`'s
  `weekStartKey`, and it would make the on-screen week totals deliberately **not** sum to the
  on-screen month total. Also rejected: rendering the adjacent-month days as real muted cells —
  that changes the day-cell contract, the outside-month treatment, the Tab-order invariant and
  the tint scale, and would need its own phase.

- **D-14: Partial weeks are disclosed in the accessible name only, not visibly.** The visible
  cell shows the same three values as any other week; the accessible name says so — e.g.
  "Partial week, 3 days shown, 18.2 km, 1h 32m, 2 runs". Keeps the densest column in the row
  visually uniform, while removing the ambiguity for assistive-tech users. The muted
  `.calendar-day--outside` cells are the existing visual cue for sighted users.

- **D-15: The setting reaches the Calendar view and nothing else — this is an explicit non-goal,
  not an oversight.** Trends' weekly volume, `records-logic.ts`'s biggest week and the streak
  logic all read `weekStartISO`, which is computed Monday-fixed in the pipeline
  (`analytics.types.ts:9`, `trends-logic.ts:75-78`) and published as pre-computed JSON.
  Honouring a client-side toggle there would mean re-deriving weekly aggregates in the browser —
  a pipeline change and its own phase.
  **Downstream agents: do not treat this as a gap.** The verifier should score the phase against
  the Calendar view alone. A user who selects Sunday will still see Monday-based weeks on
  Trends; that inconsistency is knowingly shipped.

### Verification

- **D-16: The human checkpoint reads back pre-computed expected values from the live archive.**
  During planning, pick a real month from `data/dashboard/index.json` that has **runs on the
  boundary day** — a Sunday run is the discriminator, since Sunday is the day that changes week
  rows when the start moves — then compute both the Sunday-start and Monday-start week-total
  sets for that month and write **both** into the plan. The checkpoint reads values back rather
  than confirming presence.
  This is the discriminator discipline that finally closed Phase 21's R15 (source ranks left at
  `4`/`9` so the scope had to be observed re-ranking). It also avoids the failure mode that
  scored FAIL across two rounds of Phase 20's validation: "the numbers changed" is not proof,
  because a wrong-grouping bug also changes the numbers.
  **No staged fixture is expected.** Unlike Phase 21 — where the archive held zero current-year
  ranking entries — 1,868 activities across multiple years give plenty of qualifying months.
  If planning cannot find a month with a boundary-day run, say so explicitly rather than
  silently weakening the checkpoint.

### Claude's Discretion

- The exact `localStorage` key name (follow `theme.ts`'s `THEME_STORAGE_KEY` naming shape).
- The time format in the week total (`3h 45m` vs `3:45` vs `3.75h`) — no existing calendar
  precedent, since day cells show no time.
- Whether the `localStorage` read is wrapped against a throwing storage (private mode / disabled
  cookies) — follow whatever `theme.ts` already does, and match it rather than inventing a
  second policy.
- The weekday label row's content and ordering under a Monday start (`WEEKDAY_LABELS` at
  `calendar.ts:31` is a hard-coded Sunday-first array and must become week-start-aware).
- The `aria-label` wording on the segmented group and its two options.
- The exact CSS track for the 8th column (`auto` vs `minmax(...)`) and the mobile strategy.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

ROADMAP.md carries no `Canonical refs:` line for Phase 22. The list below was accumulated
from REQUIREMENTS.md, prior-phase CONTEXT files, and the codebase scout.

### Requirements and phase scope
- `.planning/ROADMAP.md` § "Phase 22: Calendar Week-Start & Totals" — goal, the five success
  criteria, and the "generalize `buildMonthGrid`, don't just restyle" instruction in criterion 2
- `.planning/REQUIREMENTS.md` lines 33-35 — CAL-01, CAL-02, CAL-03 as worded

### Prior decisions this phase is bound by
- `.planning/phases/19-design-system-control-styling/19-CONTEXT.md` — **D-01** (bare-element
  control baseline; note its "week-start select" parenthetical, superseded here by D-01),
  **D-05/D-06** (button baseline and shared hover — the rules the segmented control actually
  inherits), **D-07** (disabled treatment; already covers `calendar.ts:112` and `:131`),
  **D-09/D-10** (two-tone focus ring, and the `.segmented` `overflow: hidden` removal that
  makes the ring paint correctly on segmented options), **D-13** (`--radius-panel` /
  `--radius-control` tokens)
- `.planning/phases/19-design-system-control-styling/19-UI-SPEC.md` — the design contract
  CAL-03 is measured against
- `.planning/phases/21-overview-rebuild/21-CONTEXT.md` — **D-04**, the deliberate
  no-persistence decision for the Records scope that explicitly deferred the storage question
  to this phase; D-04 stays as-is (see D-06 above)
- `.planning/phases/17-activity-browser-detail-views/17-UI-SPEC.md` § 3 Calendar — the
  Calendar Distance Tint Scale that `tintStepForDistance` implements, and the every-slot-is-a-
  real-button Tab-order rule that D-11 must not break; also § 5 Cross-Surface focus management
  (the `h1.focus()` at `calendar.ts:320` that D-04 routes around)

### Code that must be read before planning
- `src/dashboard/views/calendar-logic.ts` — the pure module. `buildMonthGrid` (line 149),
  `firstWeekdayOfMonth` (line 134, the entire Sunday hard-coding), the `MonthGrid` /`DayCell`
  interfaces (lines 96-112), and the header comment's purity contract
- `src/dashboard/views/calendar-logic.test.ts` — existing Sunday-first expectations that D-03
  requires be re-pinned explicitly
- `src/dashboard/views/calendar.ts` — `WEEKDAY_LABELS` (line 31), `buildDayCellButton`
  (lines 100-163, incl. the rest-day `–` at line 124 and the `null`-slot button at 108-114),
  `createCalendarView` and the `.calendar-header` assembly (lines 238-290), the grid render
  loop (lines 292-311), `h1.focus()` (line 320)
- `src/dashboard/theme.ts` — the persistence pattern D-05/D-06/D-07 copy: injectable `storage`
  (lines 93, 130), validated parse (line 27 onward), and the T-16-TH-01 threat note (line 13)
- `src/dashboard/views/records.ts` lines 605-655 — the `.segmented` markup D-01 reuses, **and**
  the source comment at line 608 that hands the storage decision to this phase
- `src/dashboard/views/detail-charts.ts` lines 218, 253-276, 543-545 — the second `.segmented`
  instance plus the `options.storage ?? globalThis.localStorage` idiom
- `src/dashboard/styles.css` lines 705-810 — the whole Calendar block: `.calendar-header`,
  `.calendar-grid` `repeat(7, 1fr)` at 727, `.calendar-weekday`, `.calendar-day` and its
  tint/rest/outside modifiers
- `src/analytics/dashboard-index.types.ts` lines 39-73 — `DashboardIndexRow`, confirming
  `distanceM` and `movingTimeSec` are both present for D-09

### The Monday convention this phase aligns to (read-only — D-15 forbids changing it)
- `src/types/analytics.types.ts:9` — `weekStartISO` documented as "ISO 8601 Monday UTC"
- `src/dashboard/views/trends-logic.ts:75-88` — `weekStartKey`, the Monday-offset week key
- `src/dashboard/views/records-logic.ts:261-277` — biggest-week selection reading those keys

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`.segmented` control** — built twice already (`records.ts:633-651`,
  `detail-charts.ts:257-276`), with the active-state toggle pattern at
  `detail-charts.ts:543-545`. Copy the structure; do not invent a third variant.
- **`theme.ts` persistence shape** — injectable storage + validating parse + silent fallback.
  D-05/D-06/D-07 are all "do what this file does, for a different key".
- **`.calendar-day`'s three-slot grid** (`__number` / `__distance` / `__count`) — D-10's total
  cell mirrors it, so the stacked three-value layout already has a CSS precedent in the file.
- **The rest-day `–`** (`calendar.ts:124`) — D-12's empty-week vocabulary, already in use.
- **Phase 19's control inheritance** — `button` baseline, shared hover, `:disabled` /
  `[aria-disabled]` treatment and the two-tone focus ring all apply to the new control with no
  opt-in work. CAL-03 is close to free; the checkpoint still has to confirm it *renders*.

### Established Patterns
- **`calendar-logic.ts` is pure, DOM-free and total** — never throws, never reads a clock or a
  global; `now` is always injected. D-08's required parameter keeps that contract intact.
- **UTC everywhere** — `activityDayKey` normalizes both archive shapes (Strava-era `Z`-suffixed,
  intervals.icu-era no-`Z`) by appending `Z` and reading `getUTC*`. Any new week math must use
  the same UTC discipline, matching `trends-logic.ts`'s `weekStartKey`.
- **Every grid slot is a real button** (`calendar.ts:96-99`) — deliberate, for identical Tab
  order every month. D-11 works around it rather than through it.
- **Mount-race guards** — `mount()` checks `mountedContainer !== ctx.container` twice
  (lines 196, 217) after the awaited index load. A toggle handler added to this view must not
  reintroduce a path that paints into a container the view no longer owns.
- **Automated gates have missed rendering defects three times in this project** (PROJECT.md
  line 49), hence the house rule since checkpoint 16-09: unit tests never discharge a visual
  claim. D-16 is the concrete application of that here.

### Integration Points
- `calendar.ts:236` — the single `buildMonthGrid` call site, which D-08's third parameter changes.
- `calendar.ts:238-290` — `.calendar-header` assembly, where D-02 inserts the segmented control.
- `calendar.ts:31` + `:295-300` — `WEEKDAY_LABELS` and the weekday header render loop, both of
  which become week-start-aware and gain an 8th "Total" cell.
- `calendar.ts:292-311` — the flat grid render loop; D-10 changes it from "flatten and append"
  to a per-week walk so each week's total cell can be appended after its seven days.
- `styles.css:727` — the `repeat(7, 1fr)` track list D-10 extends.
- A new week-start storage module (D-06), imported by `calendar.ts` only.

</code_context>

<specifics>
## Specific Ideas

- The user overrode the recommended distance-only week total and asked for **all three** of
  distance, time and run count (D-09). Treat the three-value cell as a firm requirement, and
  let it drive the layout decisions (it is why D-10 chose a content-sized 8th column over an
  equal-width one).
- Every other choice in this discussion took the recommended option, including three where the
  recommendation deliberately preserved a smaller blast radius: static total cells (D-11),
  visible-days-only totals (D-13), and calendar-only scope (D-15).

</specifics>

<deferred>
## Deferred Ideas

- **Make weekly aggregates honour the week-start preference.** Trends' weekly volume, biggest
  week and streak logic are Monday-fixed in the pipeline. Making them follow the setting means
  re-deriving weekly aggregates (either in the pipeline with a published variant, or client-side
  from index rows). Out of scope per D-15; belongs in its own phase, and would need to be
  reconciled with Phase 23's Trends work.
- **Render adjacent-month days as real muted cells** so a boundary week visually contains
  everything its total sums, and switch to true 7-day week totals (the D-13 alternative). This
  changes the day-cell contract, the outside-month treatment, the Tab-order invariant and the
  tint scale — a Calendar rework phase, not a CAL-02 line item.
- **A shared view-preference facility.** D-06 deliberately builds calendar-only storage. If a
  second persisted view preference appears (Phase 24 curation state, Phase 23 zoom level),
  generalize from two concrete cases then.
- **Revisit Phase 21 D-04** (Records scope not persisted) now that localStorage is sanctioned
  for view state. Not reopened here; D-04 stands.

### Reviewed Todos (not folded)
- **Exclusion tickbox via local curation mode** (`.planning/todos/pending/2026-08-12-exclusion-tickbox-local-curation-mode.md`,
  match score 0.9) — not folded. It is literally Phase 24's stated goal ("Local Curation Mode");
  it matched only on generic keywords ("via", "user", "dashboard") and the `dashboard` area tag,
  not on calendar scope.
- **Garmin export adapter when export arrives** (`.planning/todos/pending/2026-08-10-garmin-export-adapter-when-export-arrives.md`,
  match score 0.2) — not folded. This is the deferred STREAM-04 work, blocked on the export
  arriving; unrelated to the Calendar.

</deferred>

---

*Phase: 22-calendar-week-start-totals*
*Context gathered: 2026-08-18*
