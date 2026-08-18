# Phase 22: Calendar Week-Start & Totals - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-18
**Phase:** 22-calendar-week-start-totals
**Areas discussed:** Week-start control, Persistence mechanism, Week totals display, Week boundary math

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Week-start control | Segmented vs select, placement, default value | ✓ |
| Persistence mechanism | localStorage vs URL param, reusable vs calendar-only | ✓ |
| Week totals display | Content, format, column vs inline, empty weeks | ✓ |
| Week boundary math | Which days a week total sums; scope beyond the calendar | ✓ |

**User's choice:** all four areas.

## Todo cross-reference

| Option | Description | Selected |
|--------|-------------|----------|
| Neither | Both matched on generic keywords; exclusion tickbox is Phase 24's goal, Garmin adapter is blocked STREAM-04 | ✓ |
| Fold the exclusion tickbox | Pull local curation mode into Phase 22 | |
| Fold both | Pull both matched todos into scope | |

**User's choice:** Neither. Both recorded as reviewed-not-folded in CONTEXT.md `<deferred>`.

---

## Week-start control

### Q1 — What form should the week-start control take?

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented Sun \| Mon | The `.segmented` pattern from `records.ts:633` and `detail-charts.ts:257`; both states visible; CAL-03 via the button baseline | ✓ |
| Labelled `<select>` | Literally what 19-CONTEXT D-01 anticipated; CAL-03 free via the bare `input, select, textarea` rule; least code | |
| Checkbox "Start weeks on Monday" | Minimal, but D-01 notes checkboxes need explicit resets, and it names one option while implying the other | |

**User's choice:** Segmented Sun | Mon.
**Notes:** Deliberate divergence from 19-CONTEXT D-01's "week-start select" parenthetical — consistency with the two shipped toggles won.

### Q2 — Where does the segmented control live?

| Option | Description | Selected |
|--------|-------------|----------|
| In `.calendar-header` | Appended after "Jump to month"; the flex/wrap/baseline container absorbs a fourth item with no new CSS | ✓ |
| Own control row above the grid | Strongest control-to-effect link; costs a new CSS block and vertical space | |
| Global setting in the top nav | Consistent with the theme toggle, but would imply app-wide effect the pipeline can't deliver | |

**User's choice:** In `.calendar-header`.
**Notes:** Baseline alignment across mixed-height controls flagged as a checkpoint item.

### Q3 — What's the week start for someone with nothing stored?

| Option | Description | Selected |
|--------|-------------|----------|
| Monday | Aligns the calendar with `weekStartISO` / `trends-logic.ts` / `records-logic.ts`; deployed calendar re-flows on first load; Sunday-first tests must be re-pinned | ✓ |
| Sunday | Preserves current rendering and existing test expectations; keeps the calendar permanently out of step with the app's own convention | |

**User's choice:** Monday.

### Q4 — What happens to the view and to keyboard focus on toggle?

| Option | Description | Selected |
|--------|-------------|----------|
| Rebuild grid only, focus stays | Replace the weekday row + `.calendar-grid` in place; focus stays on the pressed button; mirrors `records.ts` `renderTables` | ✓ |
| Re-render the whole view | Simplest, but `mount()` ends with `h1.focus()`; Phase 20 shipped two focus-theft regressions of this shape | |
| Navigate — write to the URL | Reuses the router's render path, but requires URL persistence and inherits the focus steal plus a history entry per toggle | |

**User's choice:** Rebuild grid only, focus stays.
**Notes:** Open sub-question left to planning — whether an open day-picker should be cleared on toggle.

---

## Persistence mechanism

### Q1 — Where does the choice live between page loads?

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage | `theme.ts` shape: injectable storage, validated parse, silent fallback; survives reload and cross-view navigation | ✓ |
| `?weekStart=` URL param only | Shareable, no storage precedent, but dies on navigation away since `nav.ts` links to a bare `#/calendar` | |
| Both — URL wins, localStorage backs it | Most capable, but a three-way precedence rule and it pulls against the no-navigation toggle decision | |

**User's choice:** localStorage.

### Q2 — Calendar-specific or a shared view-preference facility?

| Option | Description | Selected |
|--------|-------------|----------|
| Calendar-specific, `theme.ts`-shaped | `parseWeekStart` / `readStoredWeekStart` / `writeWeekStart`; no second consumer exists since Phase 21 D-04 chose not to persist | ✓ |
| Generic view-preference module | Pays off if Phases 23-25 add persisted state; premature with one use case | |
| Extend `theme.ts` directly | Least new surface, but muddies a module with a deliberately stated single responsibility | |

**User's choice:** Calendar-specific.
**Notes:** This answers the open question recorded in source at `records.ts:608`. Phase 21 D-04 stands unchanged.

### Q3 — What does the stored value look like, and what happens to a corrupt one?

| Option | Description | Selected |
|--------|-------------|----------|
| String literal `'sunday'` / `'monday'`, silent fallback | Human-readable, self-describing; anything unrecognised falls back to the default with no console noise, as `theme.ts` does | ✓ |
| Numeric 0-6 weekday index | Stores what the grid math consumes; opaque in devtools and invites out-of-range values | |
| Boolean-ish `mondayStart` flag | Smallest value, but encodes the binary in the key name — a third option later means a migration | |

**User's choice:** String literal with silent fallback.

### Q4 — How does the week start reach `buildMonthGrid`?

| Option | Description | Selected |
|--------|-------------|----------|
| Required third parameter | One production call site, so trivial churn; TypeScript then forbids a call site that silently assumes a week start | ✓ |
| Optional param defaulting to `'sunday'` | Smaller diff, existing tests untouched — but leaves a default disagreeing with the app default, in the function SC2 is about | |
| Options object | Room to grow, overkill for one field, same call-site churn as a required param | |

**User's choice:** Required third parameter.

---

## Week totals display

### Q1 — What does each week row's total show?

| Option | Description | Selected |
|--------|-------------|----------|
| Distance only | One number, same km formatting as day cells and the month header; keeps one unit on a distance-tinted surface | |
| Distance + time stacked | `movingTimeSec` is free data; costs a second line and inverts the visual hierarchy against day cells | |
| Distance + run count | Mirrors `.calendar-day__count`; least interesting of the three, and the header already reports run count | |
| **Other (free text)** | **"Distance, time and run count."** | ✓ |

**User's choice:** *Other* — all three of distance, time and run count.
**Notes:** User overrode the recommended distance-only option. This drove Q2's layout answer, since three values in a `1fr` day-width cell would be cramped. The three-value stack maps onto `.calendar-day`'s existing number/distance/count grid, so no new visual concept is needed. Time format was left to Claude's discretion — day cells set no precedent.

### Q2 — Where does the total render relative to the 7-day grid?

| Option | Description | Selected |
|--------|-------------|----------|
| 8th grid column, own width | `repeat(7, 1fr)` + a content-sized track; weekday row gains a "Total" cell; mirrors `.calendar-day`'s three-slot grid | ✓ |
| 8th column at equal width | One-token change, but shrinks all seven day columns by 12.5% for the densest cell in the row | |
| Full-width strip under each week | No column pressure, reads well on mobile, but roughly doubles the grid's row count and breaks the one-row-per-week reading | |

**User's choice:** 8th grid column, own width.
**Notes:** Eight columns on a phone flagged as the real layout risk for the checkpoint.

### Q3 — Is the total cell focusable or static?

| Option | Description | Selected |
|--------|-------------|----------|
| Static, with the row labelled for AT | No false affordance; doesn't disturb the every-slot-is-a-button Tab-order rule, just ends row stops at day 7 | ✓ |
| Focusable button | Keeps the invariant literally true, but adds 5-6 non-actionable Tab stops per month | |
| Static, exposed as a row-level summary | Most correct semantically, but requires introducing a full ARIA grid structure and risks regressing day-cell announcements | |

**User's choice:** Static, with an accessible name naming the week it sums.

### Q4 — What does a week with no runs show?

| Option | Description | Selected |
|--------|-------------|----------|
| En-dash `–`, matching rest days | Exactly what a zero-distance day cell renders at `calendar.ts:124`; time and count lines omitted rather than zeroed | ✓ |
| Explicit zeros `0.0 km` / `0h 0m` / `×0` | Unambiguous, but three zeros per rest week is noisy beside already-muted rest days | |
| Render nothing at all | Quietest, but an empty cell in an otherwise-populated column reads as a bug and gives AT nothing to announce | |

**User's choice:** En-dash `–`.

---

## Week boundary math

### Q1 — Does a boundary week's total include adjacent-month days?

| Option | Description | Selected |
|--------|-------------|----------|
| Visible days only | Sums the non-null `DayCell`s in the row; reconciles with the cells beside it and with the month total; no extra data plumbing | ✓ |
| True 7-day calendar week, spanning months | The training-log answer, and what `weekStartISO` means elsewhere — but needs unfiltered rows plus week-key grouping, and week totals would no longer sum to the on-screen month total | |
| True 7-day week, rendering the adjacent days too | Fully self-consistent and how most calendar apps behave, but changes the day-cell contract, outside-month treatment, Tab-order invariant and tint scale | |

**User's choice:** Visible days only.

### Q2 — How is a partial week signalled?

| Option | Description | Selected |
|--------|-------------|----------|
| Accessible name only | Visible cell unchanged; the name says "Partial week, 3 days shown, …"; muted null cells are the sighted cue | ✓ |
| Visible marker in the cell | Unambiguous for everyone, but adds a fourth line to the two boundary rows in an already-dense column | |
| No signal | Cheapest, but a screen-reader user gets a bare number with no indication it covers three days | |

**User's choice:** Accessible name only.

### Q3 — Does the setting reach anything outside the calendar grid?

| Option | Description | Selected |
|--------|-------------|----------|
| Calendar view only, stated as an explicit non-goal | Weekly aggregates are Monday-fixed in the pipeline; honouring the toggle there is a pipeline change and its own phase | ✓ |
| Calendar now, with a follow-up noted for the pipeline | Same shipped behaviour plus a backlog entry acknowledging the inconsistency | |
| Extend to Trends weekly volume this phase | Genuinely consistent, but new capability outside CAL-01/02/03 and it collides with Phase 23 | |

**User's choice:** Calendar view only, as an explicit non-goal.
**Notes:** The deferred-idea entry from option 2 was recorded anyway, since it costs nothing and the inconsistency is real.

### Q4 — How does the human checkpoint prove the totals really recompute?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-computed expected values from the live archive | Pick a real month with a boundary-day (Sunday) run, compute both week-total sets during planning, read values back at the checkpoint | ✓ |
| Staged fixture with a hand-built month | Cleanest possible signal and the project has done disclosed fixtures twice, but tests fabricated data the real archive can answer | |
| Eyeball the re-flow and the reload | Fast, but "the numbers changed" is the blanket-approval shape that scored FAIL across two rounds of Phase 20's validation | |

**User's choice:** Pre-computed expected values from the live archive.
**Notes:** No fixture expected — unlike Phase 21, the archive has ample qualifying months. If planning can't find a month with a boundary-day run, it must say so rather than silently weaken the checkpoint.

---

## Claude's Discretion

- The exact `localStorage` key name (follow `theme.ts`'s `THEME_STORAGE_KEY` naming shape)
- The time format in the week total — no calendar precedent exists
- Whether the storage read is guarded against a throwing `localStorage` (private mode) — match `theme.ts` rather than inventing a second policy
- `WEEKDAY_LABELS` content and ordering under a Monday start
- `aria-label` wording on the segmented group and its options
- The exact CSS track for the 8th column and the mobile strategy

## Deferred Ideas

- Make weekly aggregates (Trends volume, biggest week, streaks) honour the week-start preference — pipeline work, own phase, must reconcile with Phase 23
- Render adjacent-month days as real muted cells and switch to true 7-day week totals — a Calendar rework phase
- A shared view-preference facility — generalize once a second persisted preference exists
- Revisit Phase 21 D-04 (Records scope not persisted) now that localStorage is sanctioned for view state — not reopened here
