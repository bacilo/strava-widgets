---
phase: 22-calendar-week-start-totals
reviewed: 2026-08-18T13:43:45Z
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
  critical: 1
  warning: 6
  info: 13
  total: 20
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-08-18T13:43:45Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 22 adds a Sunday/Monday week-start toggle and per-week total cells to the
Calendar view. The data-derivation change (`buildMonthGrid`'s `weekStart`
parameter, `DayCell.totalTimeSec`, `MonthGrid.weekTotals`) is correct on every
path I traced, `npx tsc --noEmit` is clean, and all 215 tests in the four
reviewed test files pass. The `.sr-only` + `aria-hidden` construction in
`buildWeekTotalCell` is correct, every string reaches the DOM through
`textContent`, and `calendar-preferences.ts` genuinely honours D-07 (no repair,
no write-back) and T-22-WK-01 (exact allow-list).

Three real problems survive that scrutiny, two of them proven by execution
rather than reading:

1. **`globalThis.localStorage` is dereferenced outside any `try`** at
   `calendar.ts:424`. In a browser configuration where site data is blocked
   (Firefox "block cookies and site data", Chrome blocked-origin, cross-origin
   iframe), the property *getter itself* throws `SecurityError` before
   `readStoredWeekStart`'s guard is ever entered. `calendar-preferences.ts`'s
   own header claims T-22-WK-02 covers exactly this case ("disabled cookies").
   It does not; the whole Calendar view collapses into `main.ts`'s generic
   "Something went wrong" panel.
2. **`buildMonthGrid` throws `RangeError: Invalid array length`** for any
   `weekStart` outside the union, contradicting its JSDoc's "Total function:
   never throws" and T-22-WK-01's "can never reach the grid math". Proven by
   execution against the real module (stack: `calendar-logic.ts:219`).
3. **The Phase 22 CSS test block ships the exact false-green class
   `styles.test.ts` documents at length.** The block asserts
   `.calendar-week-total__distance` declares `font-size: 20px` through
   `bodyForSelectorListToken`, which is structurally blind to at-rule
   overrides, and the *same phase* added a `@media (max-width: 380px)` rule
   overriding it to `14px`. No `assertNoAtRuleOverride` pairing was added,
   unlike Phase 21's block. Proven by execution: calling
   `assertNoAtRuleOverride('.calendar-week-total__distance', 'font-size')`
   against the shipped stylesheet throws.

Also of note: `calendar.test.ts`'s exact-count source guards ("exactly two
`.focus()` call sites", "exactly two `tabindex` writes") have already visibly
distorted the source they guard — `buildWeekTotalCell`'s JSDoc says
"focus-index attribute" to avoid writing `tabindex`, and `setWeekStart`'s
comment says "the active element stays on that button" to avoid writing
`focus`. They also block the fix for a real pre-existing focus-loss defect in
the day picker's Close button.

Explicitly **not** reported, per the phase's known-and-accepted list: the
357.2/357.3 km per-row `toFixed(1)` rounding artifact, the Monday-fixed
Trends/Records/streak surfaces (D-15), and the tracked ~380px day-cell overflow
gap (IN-05 comments on the *shape* of the compaction, not the gap itself).

_No `<structural_findings>` pre-pass was supplied with this review; all findings
below are narrative._

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `globalThis.localStorage` dereferenced outside the storage guard — Calendar dies with site data blocked

**File:** `src/dashboard/views/calendar.ts:424`
**Issue:**

```ts
const storage = deps.storage ?? globalThis.localStorage;
let weekStart = readStoredWeekStart(storage);
```

`readStoredWeekStart` and `writeWeekStart` both wrap `getItem`/`setItem` in
`try/catch`, and `calendar-preferences.ts:15-18` claims that discipline covers
"Safari private mode, disabled cookies, quota exceeded" (T-22-WK-02). But the
*property access* `globalThis.localStorage` is the throwing operation in the
"disabled cookies" case — Firefox with "Block cookies and site data", Chrome
with site data blocked for the origin, and any cross-origin iframe with storage
partitioning all throw `SecurityError` from the getter, before
`readStoredWeekStart` is called. Line 424 is not inside any `try`.

The throw lands in the middle of `mount()`, **after** `ctx.container.replaceChildren()`
at line 404 has already emptied the container, so it propagates to `main.ts:53-77`
and the entire Calendar route renders the generic "Something went wrong" panel.
Every non-storage feature of the view (grid, totals, month nav, picker) is lost
because an optional cosmetic preference could not be read.

`theme.ts:91` has the same unguarded shape (`options.storage ?? localStorage`),
so this is a repeated pattern rather than a novel one — but this phase newly
documented a threat mitigation the code does not deliver, and the calendar's
blast radius is a whole view rather than a colour attribute.

**Fix:** resolve the storage handle defensively and let the (already total)
preference functions absorb a missing handle:

```ts
// calendar-preferences.ts
export function resolveWeekStartStorage(
  override?: WeekStartStorage
): WeekStartStorage | null {
  if (override) return override;
  try {
    // The GETTER throws (SecurityError) when site data is blocked — not just
    // getItem/setItem. T-22-WK-02 is only covered if this access is guarded.
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readStoredWeekStart(storage: WeekStartStorage | null): WeekStart {
  if (!storage) return 'monday';
  try {
    return parseWeekStart(storage.getItem(WEEK_START_STORAGE_KEY));
  } catch {
    return 'monday';
  }
}

export function writeWeekStart(storage: WeekStartStorage | null, value: WeekStart): void {
  if (!storage) return;
  try {
    storage.setItem(WEEK_START_STORAGE_KEY, value);
  } catch {
    // Swallow storage write failures — the grid is already rebuilt in memory.
  }
}
```

```ts
// calendar.ts:424
const storage = resolveWeekStartStorage(deps.storage);
```

Add a `calendar-preferences.test.ts` case with a getter-throwing stand-in to
lock the behaviour in (`Object.defineProperty(fake, 'storage', { get() { throw new Error('SecurityError'); } })`).

## Warnings

### WR-01: `buildMonthGrid` throws `RangeError` for an off-union `weekStart` — contradicts its documented totality

**File:** `src/dashboard/views/calendar-logic.ts:106, 174-176, 214-219`
**Issue:** `WEEK_START_OFFSET[weekStart]` returns `undefined` for anything
outside `'sunday' | 'monday'`. That propagates as `NaN` through
`leadingPaddingFor` → `padding` → `cellCount` → `Math.ceil(NaN)` →
`Math.max(4, NaN) === NaN` → `totalSlots === NaN` → `new Array(NaN)`, which
throws.

Executed against the shipped module:

```
RESULT: RangeError: Invalid array length
    at buildMonthGrid (src/dashboard/views/calendar-logic.ts:219:41)
```

This directly contradicts three claims in the same file: the JSDoc's "Total
function: never throws" (line 185), the D-08 "injected by the caller"
framing, and `calendar-preferences.ts:11-13`'s "a tampered or unrecognised
stored value can never reach the grid math" (T-22-WK-01). The *only* thing
standing between a tampered `localStorage` value and this throw is
`parseWeekStart` plus TypeScript's compile-time union — there is no runtime
defence in the module that advertises itself as total. `buildMonthGrid` is an
exported, deliberately DOM-free, "reusable and total" function; a future second
caller that does not route through `parseWeekStart` turns this into a crash.

**Fix:** make the offset lookup total, matching the module's stated contract:

```ts
function weekStartOffset(weekStart: WeekStart): number {
  // Total: an off-union value (only reachable by bypassing parseWeekStart or
  // TypeScript) falls back to the D-03 default rather than producing NaN and
  // a RangeError from `new Array(NaN)` below.
  return weekStart === 'sunday' ? 0 : 1;
}

function leadingPaddingFor(m: CalendarMonth, weekStart: WeekStart): number {
  return (firstWeekdayOfMonth(m) - weekStartOffset(weekStart) + 7) % 7;
}
```

Add the regression test:

```ts
it('an off-union weekStart does not throw (T-22-WK-01 defence in depth)', () => {
  expect(() => buildMonthGrid([], { year: 2024, month: 3 }, 'MONDAY' as never)).not.toThrow();
});
```

### WR-02: Phase 22 CSS assertions are false-green — no `assertNoAtRuleOverride` pairing, and the phase itself added the overriding `@media`

**File:** `src/dashboard/styles.test.ts:1751-1817`, `src/dashboard/styles.css:826-863`
**Issue:** `styles.test.ts` documents at length (lines 298-307, 411-426,
446-468, 939-949) that `bodyForSelectorListToken` /
`bodiesForSelectorListToken` / `cascadeWinningBodyDeclaring` **skip every
at-rule-scoped rule by construction**, and that "a guard that needs that claim
to be true must pair with `assertNoAtRuleOverride`". Phase 21's block
(line 1748) does exactly that. The Phase 22 block adds **zero**
`assertNoAtRuleOverride` calls.

That is not theoretical here — the phase created the override itself:

```css
.calendar-week-total__distance { font-size: 20px; ... }   /* styles.css:826 */
@media (max-width: 380px) {
  .calendar-week-total__distance { font-size: 14px; ... } /* styles.css:858 */
}
```

Executed against the shipped stylesheet:

```
assertNoAtRuleOverride('.calendar-week-total__distance', 'font-size')
→ Error: An at-rule-scoped rule (head: ".calendar-week-total__distance")
  redeclares "font-size" for ".calendar-week-total__distance" — this override
  is invisible to cascadeWinningBodyDeclaring, bodyForSelectorListToken and
  bodiesForSelectorListToken ...
```

So `it('.calendar-week-total__distance declares font-size: 20px ...')` is green
while the browser renders `14px` at every viewport ≤380px — the precise defect
class the file's own 200-line helper audit exists to prevent.

**Fix:** pair every positive Phase 22 assertion with the companion guard, and
where a deliberate override exists, assert the override instead of pretending
it isn't there:

```ts
it('D-10: .calendar-grid declares grid-template-columns: repeat(7, 1fr) auto', () => {
  expect(bodyForSelectorListToken('.calendar-grid')).toContain(
    'grid-template-columns: repeat(7, 1fr) auto',
  );
  assertNoAtRuleOverride('.calendar-grid', 'grid-template-columns');
});

it('.calendar-week-total__distance is 20px at the default breakpoint', () => {
  expect(bodyForSelectorListToken('.calendar-week-total__distance'))
    .toContain('font-size: 20px');
  // DELIBERATE override, DISC-6b: assert it exists rather than assuming none.
  expect(() =>
    assertNoAtRuleOverride('.calendar-week-total__distance', 'font-size'),
  ).toThrow(/redeclares "font-size"/);
});
```

Apply the same pairing to `.calendar-week-total`'s `white-space` and
`.calendar-week-total__time`'s `font-size`/`color` assertions.

### WR-03: the new `@media` block's first rule is structurally unguardable by every helper in `styles.test.ts`

**File:** `src/dashboard/styles.css:852-856`
**Issue:** `RULE_SCANNER()`'s body class (`[^}]*`) permits an unmatched `{`, so
an `@media` prelude swallows the **first** nested rule into its pseudo-body —
a limitation `styles.test.ts:841-853` documents explicitly ("swallows the first
nested rule into its 'body' — seven pseudo-rules come out this way"). The new
block puts `.calendar-day, .calendar-week-total { padding: var(--space-xs) }`
first, so it is invisible to *both* halves of the guard machinery.

Executed proof: `assertNoAtRuleOverride('.calendar-week-total', 'padding')`
returns **cleanly** against the real stylesheet, even though the override
demonstrably exists three lines below the assertion's own selector. Any future
guard on `.calendar-week-total`'s or `.calendar-day`'s padding is therefore
unprovable — a silent hole, not a loud failure.

**Fix (either):**
1. Reorder so a rule nobody guards is first in the block:
   ```css
   @media (max-width: 380px) {
     /* First nested rule is swallowed by styles.test.ts's RULE_SCANNER
        pseudo-rule (see that file's at-rule audit) — keep the guarded
        padding rule out of position 1. */
     .calendar-week-total__distance { font-size: 14px; font-weight: 600; line-height: 1.5; }
     .calendar-day,
     .calendar-week-total { padding: var(--space-xs); }
   }
   ```
2. Or add the padding claim to the esbuild parse-level block
   (`styles.css — Phase 19 radius tokens (parse level)`), which uses a real CSS
   parser and does not share the regex substrate's blind spot.

### WR-04: exact-count source guards in `calendar.test.ts` cement a real defect and are already distorting the source's documentation

**File:** `src/dashboard/views/calendar.test.ts:280-284, 311-314`
**Issue:** Two guards count *whole-file substring occurrences*, comments
included:

```ts
const focusMatches = calendarSource.match(/\.focus\(\)/g) ?? [];
expect(focusMatches).toHaveLength(2);

const tabindexMatches = calendarSource.match(/tabindex/g) ?? [];
expect(tabindexMatches).toHaveLength(2);
```

Three concrete problems:

1. **They lock in a real focus-management defect.** `renderPicker`'s Close
   button (`calendar.ts:156-158`) removes itself from the DOM
   (`pickerHost.replaceChildren()`), dropping focus to `<body>` — a WCAG 2.4.3
   focus-order failure. The correct fix is to restore focus to the originating
   day button, which requires a third `.focus()` call site and fails this
   assertion. A guard that fails when a bug is fixed is worse than no guard.
2. **They have already warped the source's documentation.**
   `buildWeekTotalCell`'s JSDoc (`calendar.ts:248`) writes "never given a
   focus-index attribute" instead of the accurate word `tabindex`, and
   `setWeekStart`'s comment (`calendar.ts:548-549`) writes "the active element
   stays on that button" instead of "focus stays". Both circumlocutions exist
   only to keep the counters at 2.
3. **`tabindex` matching is unanchored** — a comment, a class name, or a string
   containing the substring inflates the count with no relation to a real
   attribute write.

**Fix:** assert the invariant that actually matters (no focus call and no
tabindex inside `setWeekStart` / `buildWeekTotalCell`) rather than a global
count:

```ts
const buildWeekTotalCellBody = extractFunctionBody(calendarSource, 'function buildWeekTotalCell');

it('setWeekStart and buildWeekTotalCell contain no focus call and no tabindex write', () => {
  expect(setWeekStartBody).not.toMatch(/\.focus\(\)/);
  expect(setWeekStartBody).not.toMatch(/tabindex/);
  expect(buildWeekTotalCellBody).not.toMatch(/\.focus\(\)/);
  expect(buildWeekTotalCellBody).not.toMatch(/tabindex/);
});
```

This keeps the D-04/D-11 guarantees, drops the false coupling to unrelated
parts of the file, and unblocks the Close-button focus fix (IN-12).

### WR-05: `WeekStartStorage` parameters are typed non-nullable but are already called with `undefined` — the storage `catch` is doing double duty

**File:** `src/dashboard/views/calendar-preferences.ts:46, 60`; `src/dashboard/views/calendar.ts:424, 426, 544`
**Issue:** `readStoredWeekStart(storage: WeekStartStorage)` and
`writeWeekStart(storage: WeekStartStorage, ...)` declare a non-nullable handle,
but `calendar.ts:424` resolves `deps.storage ?? globalThis.localStorage`, which
is `undefined` in the Node test environment this repo deliberately runs under
(`environment: 'node'`, no `localStorage` global). The calls "work" only
because `undefined.getItem(...)` raises a `TypeError` that the same `catch`
block — written for storage-subsystem failures — silently absorbs.

The type signature therefore lies (`storage` can be `undefined`), and the
`catch` conflates two unrelated failure classes: an environment problem the
fallback is correct for, and a programming error (`undefined` handle) that
should be impossible. TypeScript cannot warn about it because
`globalThis.localStorage` is typed `Storage`, never `Storage | undefined`.

**Fix:** widen the parameter type to `WeekStartStorage | null` with an explicit
early return (see CR-01's fix, which resolves both findings together). The
explicit `if (!storage) return 'monday';` also makes the fallback intentional
rather than an artefact of exception handling.

### WR-06: `extractFunctionBody` brace-counts without string/comment awareness and never fails loudly on an unbalanced body

**File:** `src/dashboard/views/calendar.test.ts:247-261`
**Issue:** The helper walks characters counting `{`/`}` with no awareness of
string literals, template literals, regex literals or comments, and if `depth`
never returns to zero it exits the loop with `i === source.length` and returns
`source.slice(openBraceIdx, source.length + 1)` — silently the rest of the file,
with no error.

Both failure modes make every D-04 guard built on it silently *wrong* rather
than red:

- If `setWeekStart` ever gains a template literal containing a `}` (e.g.
  `` `${x}` `` inside a string, or an `aria-label` string with a brace), the
  extracted body truncates early and the `not.toContain('focus')` /
  `not.toContain('await')` assertions pass vacuously against a fragment.
- If it truncates late, the body swallows the whole remainder of `mount()` and
  `not.toContain('focus')` fails on `h1.focus()` — a confusing false red.

The JSDoc's claim that it "stays correct if a future edit adds one [a nested
brace]" is true only for braces outside literals, which is not stated.

**Fix:** fail loudly on an unbalanced scan, and document the literal-blindness:

```ts
function extractFunctionBody(source: string, signature: string): string {
  const startIdx = source.indexOf(signature);
  if (startIdx === -1) throw new Error(`"${signature}" not found in calendar.ts`);
  const openBraceIdx = source.indexOf('{', startIdx);
  if (openBraceIdx === -1) throw new Error(`no body brace after "${signature}"`);
  let depth = 0;
  let i = openBraceIdx;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) break;
  }
  // NOT literal-aware: a `{`/`}` inside a string, template literal, regex or
  // comment inside the extracted function will mis-scope this. Fail loudly
  // rather than silently returning the rest of the file.
  if (depth !== 0) throw new Error(`unbalanced braces extracting "${signature}"`);
  return source.slice(openBraceIdx, i + 1);
}
```

## Info

### IN-01: `weekdayLabels('sunday')` leaks the shared module-level array; `'monday'` returns a fresh copy

**File:** `src/dashboard/views/calendar.ts:35, 43-46`
**Issue:** The `'sunday'` branch returns `WEEKDAY_NAMES_SUNDAY_FIRST` itself.
The declared `readonly string[]` return type is erased at runtime, and the
backing array is a plain mutable `const`. A caller that mutates the returned
array (or the exported function's result cast to `string[]`) corrupts every
subsequent Sunday-start render for the session — an asymmetry with the
`'monday'` branch, which always allocates.
**Fix:** `const WEEKDAY_NAMES_SUNDAY_FIRST = ['Sun', ...] as const;` and return
`[...WEEKDAY_NAMES_SUNDAY_FIRST]` from both branches, or `Object.freeze` the
constant.

### IN-02: `grid` is reassigned in `setWeekStart` but never read again; month-header totals are not re-derived

**File:** `src/dashboard/views/calendar.ts:427, 432-440, 552-553`
**Issue:** `let grid` is reassigned at line 552 and consumed one line later;
nothing outside `setWeekStart` reads the outer binding after line 568. Meanwhile
`totalEl` (`grid.monthTotalM`) and `captionEl` (`grid.runCount`) are computed
once at lines 434/439 and never updated. This is correct *today* only because
those two values are week-start-invariant — but the `let` reassignment signals
the opposite, inviting a future edit that adds a week-start-dependent header
value and silently leaves it stale.
**Fix:** make the outer binding `const`, use a local inside the handler, and
add a one-line comment recording why the header is not re-rendered:

```ts
const initialGrid = buildMonthGrid(indexClient.getRows(), month, weekStart);
// ...
function setWeekStart(next: WeekStart): void {
  // ...
  // monthTotalM / runCount are week-start-invariant, so the header above is
  // deliberately NOT re-rendered here.
  const nextGrid = buildMonthGrid(indexClient.getRows(), month, weekStart);
  renderGrid(gridEl, nextGrid, month, weekStart, pickerHost, indexClient);
}
```

### IN-03: stale hardcoded line references in the new comments

**File:** `src/dashboard/views/calendar.ts:276, 490`
**Issue:** `buildWeekTotalCell`'s comment cites "the rest-day cell's `–`
(calendar.ts:206 above)" — the actual assignment is line 208. The segmented
comment cites "`.segmented`/`.segmented__option[--active]` (styles.css:897-954)"
— the actual block is `styles.css:972-1030`; line 897 is inside the Phase 17
activity-detail section. Line-number citations in comments rot on the first
edit above them.
**Fix:** cite the symbol/selector name only ("see the rest-day branch of
`buildDayCellButton`", "see the § Segmented control block in `styles.css`").

### IN-04: `.calendar-week-total__time` and `.calendar-week-total__count` are byte-identical rules

**File:** `src/dashboard/styles.css:832-844`
**Issue:** Both declare the same four properties with the same values. Pure
duplication; a future change to one will silently diverge from the other.
**Fix:**
```css
.calendar-week-total__time,
.calendar-week-total__count {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--text-secondary);
}
```

### IN-05: the "Total" header is centred over a right-aligned column, and the 380px compaction is partial

**File:** `src/dashboard/views/calendar.ts:330-333`; `src/dashboard/styles.css:747-753, 816-863`
**Issue:** The 8th header cell reuses `.calendar-weekday`, which declares
`text-align: center`, while `.calendar-week-total` declares
`justify-items: end`. In an `auto`-sized track wider than the word "Total"
(any week whose distance/time strings are longer), the header label does not
sit above the values it labels.

Separately, the `@media (max-width: 380px)` block shrinks only
`.calendar-week-total__distance` (20px → 14px). `.calendar-week-total__time`
and `__count` stay at 14px and `.calendar-day__distance` stays at 20px, so the
compaction leaves the widest contributors untouched. Combined with
`white-space: nowrap` on an `auto` track inside a
`repeat(7, 1fr) auto` grid with no `min-width: 0` on the day columns, the total
column can push the grid past the viewport. (The narrow-viewport overflow itself
is already tracked as an open gap — recorded here only because the compaction
rule's *shape* does not address the widest text.)
**Fix:** give the total header its own modifier, e.g.
`.calendar-weekday--total { text-align: right; }`, applied alongside
`.calendar-weekday` at `calendar.ts:331`; and consider adding
`.calendar-week-total__time, .calendar-week-total__count { font-size: 12px }`
to the 380px block when the tracked overflow gap is closed.

### IN-06: a third disjoint `@media (max-width: 380px)` block, described as "the existing breakpoint"

**File:** `src/dashboard/styles.css:846-863`
**Issue:** The comment reads "padding + type compaction at the existing 380px
breakpoint", but the change adds a **third** independent
`@media (max-width: 380px)` block (the existing ones are at lines 945 and
1294) rather than joining either. Three disjoint blocks for one breakpoint make
the responsive contract harder to read and make the source-order cascade
(WR-03) harder to reason about.
**Fix:** either consolidate the breakpoint into one block, or reword the comment
to "at the same 380px breakpoint used elsewhere in this file" so it stops
implying reuse that did not happen.

### IN-07: five vacuous `toBeTruthy()` assertions

**File:** `src/dashboard/styles.test.ts:1756-1774, 1809-1811`
**Issue:** `expect(bodyForSelectorListToken('.calendar-week-total')).toBeTruthy()`
adds nothing beyond "the helper did not throw" — the helper already throws on
absence, and an empty rule body (`.calendar-week-total { }`) returns `' '`,
which is truthy. Two of the four (`__time`, `__count`) additionally cannot fail
their stated purpose ("not media-nested") because those selectors appear in no
at-rule anywhere in the file.
**Fix:** assert a real declaration from each body (the neighbouring tests
already do this for `__distance` and `__time`), or drop the four
existence-only cases as redundant.

### IN-08: duplicate test case for `'MONDAY'` in the preferences suite

**File:** `src/dashboard/views/calendar-preferences.test.ts:45-51, 53-55`
**Issue:** `'MONDAY'` is already in the `tamperedValues` array, so the loop
generates `falls back to 'monday' for "MONDAY"`; line 53 asserts the identical
thing again with a different title.
**Fix:** delete the standalone case and move its "rather than normalising it"
intent into the loop's title, or keep only the standalone one.

### IN-09: negative CSS assertions run against raw `css` including comments

**File:** `src/dashboard/styles.test.ts:1794-1808`
**Issue:** Four new assertions (`.calendar-week-total--tint`,
`.calendar-week-total--outside`, `.calendar-header .segmented`,
`.calendar .segmented`) match against `css`, not `cssNoComments`. Today's
comments dodge those exact strings (`styles.css:809` writes
"`--outside`/`--rest`/`--tint-N`" precisely to avoid them), but a future
explanatory comment that names a selector in prose fails the suite for a reason
unrelated to the stylesheet's behaviour.
**Fix:** run structural absence checks against `cssNoComments`, matching the
rationale already stated at `styles.test.ts:16-20` (the raw-`css` form is
justified there for *declaration-text* assertions, not selector-structure ones).

### IN-10: unreachable `'Empty week'` branch, and `MIN_WEEK_ROWS` can never bind

**File:** `src/dashboard/views/calendar.ts:99`; `src/dashboard/views/calendar-logic.ts:100, 216`
**Issue:** `weekCount = Math.max(MIN_WEEK_ROWS, Math.ceil(cellCount / 7))`, and
`cellCount = padding + totalDays ≥ 0 + 28`, so `Math.ceil(cellCount / 7) ≥ 4`
unconditionally — `MIN_WEEK_ROWS` is inert and the "never returns fewer than 4
week rows" JSDoc clause is guaranteed by the arithmetic, not by the guard.
Consequently no week row can be entirely `null` (the last row always holds at
least one in-month day), so `weekTotalAccessibleName`'s `cells.length === 0` →
`'Empty week'` branch is unreachable from `buildWeekTotalCell`. It is only
exercised by `calendar.test.ts:206-217`, which constructs the state directly.
Not a bug — but two pieces of defensive code that the tests present as live
behaviour.
**Fix:** keep both (cheap totality for an exported function) and annotate them
as unreachable-by-construction, or drop `MIN_WEEK_ROWS` and simplify the JSDoc
to state why 4 is the arithmetic minimum.

### IN-11: redundant parameters that must agree with each other

**File:** `src/dashboard/views/calendar.ts:93-97, 256-260, 313-320, 341`
**Issue:** `renderGrid` takes both `grid` and `month`, but `MonthGrid` already
carries `grid.month` — a caller can pass a mismatched pair and every day-cell
`aria-label` and week-total accessible name silently names the wrong month.
Likewise `weekTotalAccessibleName(total, week, month)` derives `daysShown`
messaging from `total` but the date range from `week`; if the two disagree the
generated name lies ("Partial week, 5 days shown, week of October 13–19").
Nothing enforces the pairing.
**Fix:** drop the redundant `month` parameter from `renderGrid` and read
`grid.month`; and derive `daysShown`/`isPartial` inside
`weekTotalAccessibleName` from `week` rather than trusting `total`, or take a
single `{ total, week }` pair produced by `buildMonthGrid`.

### IN-12: the picker's Close button drops focus to `<body>` (pre-existing)

**File:** `src/dashboard/views/calendar.ts:153-159`
**Issue:** `closeBtn`'s handler calls `pickerHost.replaceChildren()`, which
removes the button the user just activated. Focus falls to `<body>`, so the
next Tab restarts from the top of the document — a WCAG 2.4.3 focus-order
failure. Symmetrical with `renderPicker` moving focus *into* the panel on open,
which makes the missing restore-on-close conspicuous. Pre-existing (not
introduced by Phase 22), but it lives in a reviewed file and WR-04's exact-count
guard currently blocks the fix.
**Fix:** capture the originating day button when the picker opens and restore
focus to it on close:

```ts
function renderPicker(pickerHost, cell, indexClient, returnFocusTo: HTMLElement) {
  // ...
  closeBtn.addEventListener('click', () => {
    pickerHost.replaceChildren();
    returnFocusTo.focus();
  });
}
```

(Requires relaxing `calendar.test.ts:280-284` per WR-04.)

### IN-13: `ROUTES.DETAIL.replace(':id', id)` interprets `$`-patterns in the replacement (pre-existing)

**File:** `src/dashboard/views/calendar.ts:235`
**Issue:** `String.prototype.replace` with a *string* replacement interprets
`$&`, `` $` ``, `$'` and `$1` in that replacement. An activity id containing a
`$` sequence produces a malformed detail URL rather than a literal
substitution. Ids come from the published index rather than user input, so this
is latent rather than exploitable — but it is a data-shape assumption that is
never validated.
**Fix:** use a replacer function, which never interprets `$` patterns:
`ROUTES.DETAIL.replace(':id', () => encodeURIComponent(cell.activityIds[0]))`.

---

_Reviewed: 2026-08-18T13:43:45Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
