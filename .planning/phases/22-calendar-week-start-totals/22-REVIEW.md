---
phase: 22-calendar-week-start-totals
reviewed: 2026-08-18T19:23:08Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/dashboard/styles.css
  - src/dashboard/styles.test.ts
  - src/dashboard/views/calendar-logic.test.ts
  - src/dashboard/views/calendar-logic.ts
  - src/dashboard/views/calendar-preferences.test.ts
  - src/dashboard/views/calendar-preferences.ts
  - src/dashboard/views/calendar.test.ts
  - src/dashboard/views/calendar.ts
findings:
  critical: 3
  warning: 11
  info: 0
  total: 14
status: issues_found
---

# Phase 22: Code Review Report (re-review after gap-closure round 22-06..22-08)

**Reviewed:** 2026-08-18T19:23:08Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Two of the three gap-closure claims hold up under inspection; one does not, and the
known-open R13 rendering defect has a demonstrable cause in the CSS.

- **WR-01 (`weekStartOffset`) is genuinely fixed.** `calendar-logic.ts:182-184` is total
  for any input, `leadingPaddingFor` is its only consumer, and
  `calendar-logic.test.ts:328-351` covers both the `'MONDAY' as never` and
  `undefined as never` paths with deep-equality against the real Monday grid. No defect
  found here.
- **CR-01 (`resolveWeekStartStorage`) is locally sound but does not deliver the claimed
  outcome.** The try/catch around the property getter is correctly placed
  (`calendar-preferences.ts:57-64`) and `calendar.ts:433` is the only call site — but in
  the exact browser configuration the fix targets, `src/dashboard/main.ts:19` throws
  during module evaluation and the calendar view never mounts. See BL-03. The
  production branch of the new function is also completely untested (WR-01 below).
- **22-06's 380px compaction did not fix R13 and cannot fix it.** The CSS supports the
  working hypothesis and adds a second, larger cause the hypothesis does not name. See
  BL-01 and BL-02 — these two are the direct input to the next gap-closure round.

Beyond that, the test substrate added for 22-06 asserts only that a media override
*exists*, never what it says, so the compaction's actual values are unguarded.

## Critical Issues

### BL-01: The 380px compaction released the day columns' floor while leaving the Total track's floor intact — this is the R13 cause

**File:** `src/dashboard/styles.css:741-745`, `:764-778`, `:825-833`, `:878-902`

**Issue:** The developer's R13 observation ("Total column remains wide … other columns
become narrow and distance text overflows") is exactly what these four declarations
produce together. The grid is:

```css
.calendar-grid {
  grid-template-columns: repeat(7, 1fr) auto;   /* styles.css:743 */
  gap: var(--space-xs);                          /* 4px, 7 gaps = 28px */
}
```

`repeat(7, 1fr)` is `minmax(auto, 1fr)`. The `auto` minimum of a grid track is the
item's *automatic minimum size*, which resolves to the item's specified `min-width`
whenever that is not `auto`. 22-06 added:

```css
@media (max-width: 380px) {
  .calendar-day { min-width: 0; }              /* styles.css:884-886 */
}
```

so all seven day tracks now floor at **0** and can be squeezed arbitrarily.

The 8th track is `auto`, and its item declares:

```css
.calendar-week-total {
  white-space: nowrap;                          /* styles.css:832 */
  /* no min-width; not overridden at 380px */
}
```

With `white-space: nowrap`, `.calendar-week-total`'s min-content width equals its
max-content width (the full `"123.4 km"` / `"10h 14m"` line). The 380px block overrides
only its `padding` (`:880-882`) and its three font sizes (`:891-901`) — it never sets
`min-width: 0`, never relaxes `white-space`, and never re-declares
`grid-template-columns` (styles.test.ts:1858 explicitly asserts the 8-track shape is
*not* overridden at any breakpoint).

Net result: the Total track keeps a hard content-based floor, the seven day tracks have
none, so 100% of the width shortfall at 380px is absorbed by the day columns. 22-06 did
not reduce the overflow — it *relocated* it, from the page (Round 1 / R11: the grid was
wider than the viewport) into the day cells (Round 2 / R13: the grid fits, the cells do
not). The hypothesis in the task brief is correct, and the CSS supports it in the exact
terms stated.

**Fix:** constrain the Total track and let it participate in the squeeze, instead of
leaving it as the only unyielding track:

```css
@media (max-width: 380px) {
  .calendar-grid {
    /* Cap the 8th track so it can no longer win the whole negotiation. */
    grid-template-columns: repeat(7, minmax(0, 1fr)) minmax(0, max-content);
  }

  .calendar-week-total {
    min-width: 0;
    white-space: normal;   /* "10h 14m" may wrap at this width */
  }
}
```

Note this change requires editing `styles.test.ts:1855-1860`, which currently asserts
`assertNoAtRuleOverride('.calendar-grid', 'grid-template-columns')` does **not** throw.
That assertion is what locks the current, failing shape in place.

### BL-02: `.calendar-day`'s inner 3-column grid gives the distance value one third of an already-collapsed cell — the dominant overflow amplifier, untouched by 22-06

**File:** `src/dashboard/styles.css:764-778`, `:799-805`, `:888-890`

**Issue:** Fixing BL-01 alone will not clear R13. Each day cell is itself a 3-column
grid with the distance pinned to the **middle** column:

```css
.calendar-day {
  display: grid;
  grid-template-areas:
    "number . ."
    ". distance ."
    ". . count";
  grid-template-columns: 1fr 1fr 1fr;           /* styles.css:773-777 */
}

.calendar-day__distance {
  grid-area: distance;
  justify-self: center;                          /* styles.css:804 */
}
```

The 380px block touches only `font-size` on this element (`:888-890`); the inner
`grid-template-columns` is never compacted. So the string `"12.3 km"` is laid out in a
track roughly `(day-track-width − 10px) / 3` wide. The inner tracks are themselves
`minmax(auto, 1fr)` with `min-width: auto` items, so the inner grid's min-content width
is the *sum* of the three spans' min-contents — which now exceeds the day cell's own
content box (whose floor 22-06 just set to 0). `justify-self: center` then centers the
overflowing span, so it spills symmetrically past both cell borders. That is precisely
"distance text overflows".

This is a separate cause from BL-01 with a separate fix. Capping the Total track
(BL-01) returns roughly 30-60px to the seven day columns collectively — the distance
value only sees a third of its column's share of that.

**Fix:** collapse the day cell to a single-column stack at the narrow breakpoint, so the
distance gets the full cell width:

```css
@media (max-width: 380px) {
  .calendar-day {
    min-width: 0;
    grid-template-areas:
      "number"
      "distance"
      "count";
    grid-template-columns: 1fr;
  }

  .calendar-day__number,
  .calendar-day__distance,
  .calendar-day__count {
    justify-self: start;
  }
}
```

Both BL-01 and BL-02 should land in the same round; verifying either in isolation will
produce another ambiguous R13-style result.

### BL-03: The CR-01 storage fix is unreachable in the browser configuration it was written for, and the source comments assert the opposite

**File:** `src/dashboard/views/calendar-preferences.ts:20-31`, `src/dashboard/views/calendar.ts:424-433`

**Issue:** `resolveWeekStartStorage` is correctly implemented — the getter access is
inside the `try`, `?? null` covers the "returns null" browsers, and the override path
short-circuits before any global is touched. But its stated threat model is not closed
end to end.

`calendar-preferences.ts:22-26` claims the fix covers "a browser configuration where
site data is blocked (Firefox 'Block cookies and site data', Chrome blocked-origin
storage, a storage-partitioned iframe)". In that configuration, `src/dashboard/main.ts`
line 19 executes at **module scope**, before any router or view code runs:

```ts
applyThemeMode(readStoredMode(localStorage));   // main.ts:19 — bare global reference
```

The bare `localStorage` identifier is the same throwing property getter. It is not
inside a `try`, and it is a top-level statement, so the entire dashboard module graph
fails to evaluate and the page renders blank. `theme.ts:93`, `theme.ts:130` and
`detail-charts.ts:218` have the identical unguarded shape (`options.storage ?? localStorage`
— the `??` right operand is still a getter read).

The rationale comment at `calendar.ts:429-432` is therefore factually wrong about the
failure mode it claims to prevent:

> "doing that unguarded here would take the whole view down through `main.ts`'s generic
> error panel for the sake of an optional cosmetic preference."

There is no reachable "generic error panel" in this scenario — `main.ts` dies during
module evaluation, before `onMatch` or any view exists. A future maintainer reading
`calendar-preferences.ts`'s header will reasonably conclude blocked-site-data is a
handled case for the dashboard. It is not.

**Fix:** pick one and make the source tell the truth. Either extend the guard:

```ts
// src/dashboard/storage.ts (new, shared)
export function resolveStorage(override?: WebStorage): WebStorage | null {
  if (override) return override;
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
// main.ts:19
applyThemeMode(readStoredMode(resolveStorage()));
```

(`readStoredMode`/`applyThemeMode`/`watchSystemTheme` already accept an injected
storage, so the change is small and the theme module already tolerates a throwing
`getItem`/`setItem`.)

Or, if that is deliberately out of Phase 22's scope, amend
`calendar-preferences.ts:20-31` and `calendar.ts:426-432` to say so explicitly — that
the calendar's own read is guarded but the dashboard bootstrap is not, so the
blocked-site-data threat remains open at the app level. Do not leave the current text,
which reads as a closure claim.

## Warnings

### WR-01: `resolveWeekStartStorage`'s production branch is untested — mutating it to `return null` leaves the whole suite green

**File:** `src/dashboard/views/calendar-preferences.test.ts:133-191`

**Issue:** The five cases cover: override identity; override with a throwing getter;
throwing getter → `null`; global absent → `null`; and a resolve-then-read cycle under a
throwing getter. There is no case where `globalThis.localStorage` is present and
working. Replacing line 60 with `return null;` therefore passes every test in this
file, in `calendar.test.ts`, and in `styles.test.ts` — while silently disabling
week-start persistence for every real user. Given this is the one function the
gap-closure round exists to add, the missing case is the one that matters.

**Fix:**

```ts
it('returns the live global when it is present and readable', () => {
  const fake = fakeStorage({ [WEEK_START_STORAGE_KEY]: 'sunday' });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: fake });
  expect(resolveWeekStartStorage()).toBe(fake);
  expect(readStoredWeekStart(resolveWeekStartStorage())).toBe('sunday');
});
```

### WR-02: Nothing prevents `calendar.ts` from re-introducing the direct `globalThis.localStorage` access CR-01 removed

**File:** `src/dashboard/views/calendar.test.ts:238-336`

**Issue:** The Phase 22 source-structure guard block checks `.focus()` counts, `tabindex`
counts, segmented markup and control ordering — but not the single regression this round
was created to prevent. Re-adding `const storage = globalThis.localStorage;` to
`calendar.ts` would pass every test in the repository. This repo uses source-text guards
for exactly this class of invariant elsewhere (`row-semantics.test.ts`, the
`NAVIGABLE_ROW_CLASS` parity check at `styles.test.ts:1583`), so the omission is
inconsistent with its own conventions.

**Fix:**

```ts
it('CR-01: calendar.ts never touches a storage global directly', () => {
  const live = calendarSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  expect(live).not.toMatch(/globalThis\.(localStorage|sessionStorage)/);
  expect(live).not.toMatch(/(^|[^.\w])localStorage\b/);
  expect(live).toContain('resolveWeekStartStorage(');
});
```

### WR-03: The 22-06 media-query tests assert that an override exists, never what it says

**File:** `src/dashboard/styles.test.ts:1819-1847`

**Issue:** All five compaction assertions have the shape
`expect(() => assertNoAtRuleOverride(sel, prop)).toThrow(/redeclares "prop"/)`. That is
an existence proof only — it is satisfied by *any* at-rule override of that property, at
*any* breakpoint, with *any* value. Concretely: changing `min-width: 0` to
`min-width: 200px` (line 885), or `font-size: 14px` to `font-size: 40px` (line 889),
keeps every one of these five tests green. For a phase whose open defect is a
width/size rendering failure, the compaction's actual values are the only thing worth
guarding and they are the one thing unguarded.

**Fix:** pair each existence check with a value check read from the media block. The
existing `RULE_SCANNER`/`isAtRuleScoped` substrate already has everything needed — add a
sibling to `assertNoAtRuleOverride` that *returns* the offending at-rule body instead of
throwing, then assert on it:

```ts
expect(atRuleBodyFor('.calendar-day', 'min-width')).toContain('min-width: 0');
expect(atRuleBodyFor('.calendar-day__distance', 'font-size')).toContain('font-size: 14px');
```

### WR-04: `setWeekStart`'s D-04 focus claim is false on macOS Safari and Firefox

**File:** `src/dashboard/views/calendar.ts:554-562`

**Issue:** The comment states:

> "Safe with respect to D-04 — the toggle is only reachable by clicking or
> key-activating the segmented button, so the active element stays on that button,
> never inside the picker, when it is cleared."

macOS Safari and Firefox do **not** move focus to a `<button>` on mouse click (this is
long-standing platform behaviour, not a bug). So in those browsers the active element
when `setWeekStart` runs is wherever it was before the click — which can be the picker
heading (`tabindex="-1"`, focused at `calendar.ts:176`), an activity row link inside the
picker, or any `.calendar-day` button the user tabbed to earlier. Lines 559 and 562 then
call `pickerHost.replaceChildren()` and `gridEl.replaceChildren(...)`, destroying that
element and resetting focus to `<body>` — the exact focus-loss class D-04 exists to
prevent, in two of the three shipped engines.

**Fix:** make the invariant real instead of assuming it, and correct the comment:

```ts
function setWeekStart(next: WeekStart, source: HTMLElement): void {
  if (next === weekStart) return;
  // ...
  const focusWasInsideRebuiltRegion =
    pickerHost.contains(document.activeElement) || gridEl.contains(document.activeElement);
  pickerHost.replaceChildren();
  grid = buildMonthGrid(indexClient.getRows(), month, weekStart);
  renderGrid(gridEl, grid, month, weekStart, pickerHost, indexClient);
  if (focusWasInsideRebuiltRegion) source.focus();
}
```

Note this introduces a `.focus()` call inside `setWeekStart`, which
`calendar.test.ts:266-284` currently forbids outright — that assertion encodes "never
call focus" rather than "never steal focus", and needs to be narrowed alongside the fix.

### WR-05: `.calendar-weekday--total` is right-aligned to the track edge, but the values it labels are inset by the cell's own padding

**File:** `src/dashboard/styles.css:755-762`

**Issue:** IN-05's stated goal is that the "Total" header line up with the values beneath
it. `.calendar-week-total` declares `justify-items: end` **and**
`padding: var(--space-sm)` (8px, or 4px inside the 380px block), so its values stop 8px
(4px) short of the track's right edge. The header div carries no padding at all, so
`text-align: right` puts "Total" flush against the track edge — permanently offset from
the column it names by exactly the cell padding, at both breakpoints. The fix half-lands.

**Fix:**

```css
.calendar-weekday--total {
  text-align: right;
  padding-right: var(--space-sm);
}

@media (max-width: 380px) {
  .calendar-weekday--total { padding-right: var(--space-xs); }
}
```

### WR-06: The first rule inside the 380px block is structurally unguardable, and nothing enforces that it stays first

**File:** `src/dashboard/styles.css:874-882`, `src/dashboard/styles.test.ts:118-120`

**Issue:** `RULE_SCANNER`'s `([^{}]+)\{([^}]*)\}` consumes the `@media` prelude as a
pseudo-head and swallows the block's first nested rule into that pseudo-body, so
`.calendar-day, .calendar-week-total { padding: var(--space-xs) }` is invisible to
`selectorListDeclares`, `bodyForSelectorListToken`, `bodiesForSelectorListToken`,
`cascadeWinningBodyDeclaring` **and** `assertNoAtRuleOverride`. The styles.css comment
(`:874-877`) acknowledges this and says the padding rule is "deliberately kept in
position 1 … so every rule a test guards sits below it" — but that is a convention held
in a comment with no test behind it, and it means the one rule that changes both cell
paddings at the failing breakpoint has zero coverage. This is directly relevant to
BL-01/BL-02: any new rule the next round adds to fix them must not land in position 1,
or it will be silently unguarded.

**Fix:** repair the scanner rather than routing around it. `RULE_SCANNER`'s body class
should exclude `{` as well as `}` (`([^{}]*)`), and the at-rule prelude should be
consumed separately — `computeAtRuleRanges` already brace-matches every block, so the
prelude's extent is known. Failing that, add a positional guard so the convention is
enforced rather than documented:

```ts
it('the padding rule is still the first rule inside the 380px calendar block', () => {
  const block = cssNoComments.slice(cssNoComments.indexOf('@media (max-width: 380px)'));
  expect(block.slice(0, block.indexOf('}') + 1)).toContain('padding: var(--space-xs)');
});
```

### WR-07: The 380px override makes the Total cell *taller* during a compaction, and diverges from its day-cell counterpart

**File:** `src/dashboard/styles.css:893-901`

**Issue:**

```css
.calendar-week-total__distance {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;   /* base rule at :838 is 1.2 */
}
```

The base `.calendar-week-total__distance` uses `line-height: 1.2`. The 380px override
raises it to `1.5` — increasing the line box height at the one breakpoint where space is
scarcest. The neighbouring `.calendar-day__distance` override (`:888-890`) changes only
`font-size` and keeps `1.2`. There is no comment explaining the divergence, so this reads
as an accidental copy of the `.text-label` type role rather than a decision. Since
`.calendar-week-total` stacks three lines, this adds real height to the tallest cell in
every row.

**Fix:** drop the `line-height` (and `font-weight`, which is unchanged from the base
rule's `600` and so is a no-op) from the override:

```css
.calendar-week-total__distance { font-size: 14px; }
```

If 1.5 is intentional, state why in the block comment.

### WR-08: `ROUTES.DETAIL.replace(':id', …)` interprets `$` patterns in the activity id

**File:** `src/dashboard/views/calendar.ts:240`

**Issue:**

```ts
navigateTo(ROUTES.DETAIL.replace(':id', cell.activityIds[0]));
```

`String.prototype.replace` treats `$&`, `` $` ``, `$'`, `$$` and `$1`..`$9` in the
*replacement* string as substitution patterns. An id containing any of those produces a
route that is not `/activity/<id>`. The id is also not URL-encoded, so a `/`, `#` or `?`
in an id silently changes the route's shape. Ids come from this repo's own published
index today, so this is low-likelihood — but it is free to close and the same pattern
will be copied to the next view.

**Fix:**

```ts
navigateTo(ROUTES.DETAIL.replace(':id', () => encodeURIComponent(cell.activityIds[0])));
```

(The function form of the replacement is never scanned for `$` patterns.)

### WR-09: Multiple stale line-number cross-references in load-bearing comments

**Files:** `src/dashboard/views/calendar.ts:284`, `:499-500`;
`src/dashboard/views/calendar-logic.ts:175-176`; `src/dashboard/styles.test.ts:1450-1451`, `:1551`, `:1657-1658`

**Issue:** These comments are the primary documentation for several non-obvious
decisions, and their pointers no longer resolve:

| Comment | Cites | Actual |
| --- | --- | --- |
| `calendar.ts:284` | "the rest-day cell's `–` (calendar.ts:206 above)" | `calendar.ts:213` |
| `calendar.ts:499-500` | "`.segmented`/`.segmented__option[--active]` (styles.css:897-954)" | `styles.css:1011-1066` |
| `calendar-logic.ts:176` | "`new Array(NaN)` … as it did at this file's line 219" | now `const monthPrefix = …`; the `new Array` call is at `:241` |
| `styles.test.ts:1451`, `:1657` | "`.activity-row` … styles.css:1530" | `styles.css:1650` (and a third rule at `:1735`) |
| `styles.test.ts:1551` | "styles.css:545-556 holds three rules" | the 720px block is `:544-556` |

A reader chasing `calendar-logic.ts`'s "line 219" lands on the wrong statement and may
conclude the WR-01 fix was never applied.

**Fix:** replace numeric line citations with symbol names, which do not rot — e.g. "as
`buildMonthGrid`'s `new Array(totalSlots)` did before this fix", "see the
`§ Segmented control (x-axis toggle)` block in styles.css".

### WR-10: Three dead constructs in `calendar-logic.ts`, two of them documented as live

**File:** `src/dashboard/views/calendar-logic.ts:100`, `:106`, `:238`; `src/dashboard/views/calendar.ts:104`

**Issue:**

1. `MIN_WEEK_ROWS = 4` (`:100`, used at `:238`) is unreachable. Every Gregorian month
   has ≥28 days, so `Math.ceil((padding + totalDays) / 7) >= 4` always holds and
   `Math.max` never selects the floor. The comment at `:200-201` ("never returns fewer
   than 4 week rows") describes a guarantee that the other operand already provides.
2. Consequently `weekTotalAccessibleName`'s `if (cells.length === 0) return 'Empty week'`
   (`calendar.ts:104`) is unreachable from `buildMonthGrid` output — an all-null week row
   cannot be produced. It is reachable only from the direct unit test at
   `calendar.test.ts:206-217`, which is testing a state the system never enters.
3. `WEEK_START_OFFSET: Record<WeekStart, number>` (`:106`) is now dead indirection:
   `weekStartOffset` (`:182-184`) hard-codes both branches of the ternary, so the map is
   two constants reachable only through a lookup that never varies. It is now two places
   to change instead of one, which is the opposite of what a lookup table buys.

**Fix:** either delete `MIN_WEEK_ROWS` and the `Math.max` (and note in the comment that
the ≥4-row guarantee follows from `daysInMonth >= 28`), or keep them and mark them
explicitly as unreachable defence-in-depth the way `weekStartOffset` is. For (3), inline
the two values into `weekStartOffset` and drop the `Record`, or keep the `Record` and
have `weekStartOffset` read `WEEK_START_OFFSET[weekStart] ?? WEEK_START_OFFSET.monday` —
one or the other, not both shapes at once.

### WR-11: Brittle count-based source guards, plus an unused import

**Files:** `src/dashboard/views/calendar.test.ts:280-284`, `:311-314`; `src/dashboard/views/calendar-preferences.test.ts:1`

**Issue:**

- `calendarSource.match(/\.focus\(\)/g)` and `calendarSource.match(/tabindex/g)` run
  against the **raw** source including comments. `calendar.ts` is heavily commented and
  those comments already discuss focus behaviour at length (`:529-542`, `:554-558`);
  adding the literal text `tabindex` or `.focus()` to any comment turns both assertions
  red for a reason unrelated to what they guard. Conversely, deleting a real
  `.focus()` call and mentioning `.focus()` in a comment keeps them green. Both should
  scan a comment-stripped view, exactly as `styles.test.ts` does via `cssNoComments`.
- `expect(setWeekStartBody).not.toContain('focus')` (`:267`) matches the bare substring
  `focus` anywhere in the function body, including inside any future comment or an
  unrelated identifier such as `focusable`.
- `calendar-preferences.test.ts:1` imports `beforeEach` and never uses it (only
  `afterEach` appears, at `:134`). `tsconfig.json` sets neither `noUnusedLocals` nor
  `noUnusedParameters`, so nothing catches this.

**Fix:** strip comments before counting, and drop the unused import:

```ts
const liveSource = calendarSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
expect(liveSource.match(/\.focus\(\)/g) ?? []).toHaveLength(2);
```

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
```

---

_Reviewed: 2026-08-18T19:23:08Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
