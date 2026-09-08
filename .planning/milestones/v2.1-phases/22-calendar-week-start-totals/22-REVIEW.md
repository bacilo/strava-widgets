---
phase: 22-calendar-week-start-totals
reviewed: 2026-08-19T08:43:48Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/dashboard/main.ts
  - src/dashboard/nav.ts
  - src/dashboard/storage.test.ts
  - src/dashboard/storage.ts
  - src/dashboard/styles.css
  - src/dashboard/styles.test.ts
  - src/dashboard/theme.test.ts
  - src/dashboard/theme.ts
  - src/dashboard/views/calendar-logic.test.ts
  - src/dashboard/views/calendar-logic.ts
  - src/dashboard/views/calendar-preferences.test.ts
  - src/dashboard/views/calendar-preferences.ts
  - src/dashboard/views/calendar.test.ts
  - src/dashboard/views/calendar.ts
  - src/dashboard/views/detail-charts-logic.test.ts
  - src/dashboard/views/detail-charts-logic.ts
  - src/dashboard/views/detail-charts.ts
findings:
  critical: 2
  warning: 6
  info: 6
  total: 14
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-08-19T08:43:48Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

### Prior-round verification (requested explicitly)

All three prior blocking findings were re-verified against the code rather than
taken on the summary's word:

- **BL-01 — CLOSED.** `styles.css:956-960` gives `.calendar-week-total`
  `min-width: 0`, `white-space: normal` and `overflow-wrap: anywhere` at the
  380px breakpoint, and `styles.css:932-934` relaxes the grid to
  `repeat(7, minmax(0, 1fr)) minmax(0, max-content)`. The content-based floor on
  the 8th track is genuinely gone **at that breakpoint**. See CR-02 for what the
  breakpoint pinning leaves open.
- **BL-02 — CLOSED.** `styles.css:936-949` collapses `.calendar-day` to a
  single-column stack with `justify-self: start` on all three children at 380px.
  The centred-middle-column layout no longer applies there.
- **BL-03 — the *dereference* claim is TRUE; the *behavioural* claim is NOT.**
  I verified the "exactly one storage-global dereference site" claim
  independently with a repo-wide comment-agnostic grep: the only live
  dereference in `src/` is `storage.ts:49`, plus `index.html:41` (explicitly out
  of scope). The invariant holds. **However**, the code path the fix newly made
  reachable is broken: with a `null` handle the theme toggle in `nav.ts` can
  never leave "light" (CR-01). The page no longer renders blank — it now renders
  with a permanently stuck control instead. That regression was not caught
  because the three new BL-03 tests in `theme.test.ts` pass vacuously (WR-01).

### New findings

Two Critical and six Warning findings follow. The two Criticals are (a) the
stuck theme toggle under any degraded-storage configuration, and (b) the fact
that the BL-01/BL-02 overflow fix is pinned to `max-width: 380px` while the
defect it fixes is arithmetically present across roughly 381px-640px — a band
that contains the three most common phone widths in use (390, 393, 412 CSS px)
and was never exercised by any checkpoint row.

## Critical Issues

### CR-01: Theme toggle is permanently stuck on "light" whenever the storage handle is unusable

**File:** `src/dashboard/nav.ts:191`, `src/dashboard/nav.ts:210-215`, `src/dashboard/theme.ts:72-79`, `src/dashboard/theme.ts:139-158`

**Issue:** `nav.ts` holds no in-memory theme state. It re-derives the current
mode from storage on *every* click:

```ts
function handleThemeToggleClick(): void {
  const current = readStoredMode(resolveStorage());   // nav.ts:211
  const next = cycleThemeMode(current);
  applyThemeMode(next);
  updateThemeToggle(next);
}
```

`readStoredMode(null)` returns `'auto'` unconditionally (`theme.ts:73`), and
`cycleThemeMode('auto')` returns `'light'` (`theme.ts:59`). So under any
configuration where the handle is `null` **or** where `getItem` throws / returns
nothing:

- click 1 → `current='auto'` → `next='light'` → applies light
- click 2 → `current='auto'` again → `next='light'` → applies light
- click N → light, forever

The user can never reach dark or auto. This is not hypothetical for two shipped
configurations:

1. **Blocked site data** (Firefox "Block cookies and site data", Chrome "Don't
   allow sites to save data", storage-partitioned iframe) — `resolveStorage()`
   returns `null`. This is *exactly* the configuration BL-03 was fixed for, and
   the defect is **newly reachable** because the page now evaluates instead of
   going blank. The fix traded a blank page for a broken control, and the
   validation round only confirmed the page renders.
2. **Safari private mode / quota-0** — the handle resolves fine, `setItem`
   throws and is swallowed by `applyThemeMode` (`theme.ts:119-122`), so
   `getItem` always returns `null` and `readStoredMode` always returns `'auto'`.
   This path pre-dates the phase but is on the lines this phase edited.

The same root cause independently breaks `watchSystemTheme`'s auto-only guard
(`theme.ts:148`): `readStoredMode(null) === 'auto'` is always true, so *every*
system colour-scheme change invokes the callback, and `nav.ts:218-221` then
forces `applyThemeMode('auto', …)`. A user who explicitly picked light in this
session has their choice silently overridden by an OS theme change.

**Fix:** make the in-session mode the source of truth in `nav.ts`, seeded from
storage exactly once, exactly as `calendar.ts` already does for `weekStart`
(`calendar.ts:443` — a `let` in the mount closure that `setWeekStart` reassigns,
which is why the week-start toggle *does* work under blocked storage):

```ts
// nav.ts
let currentMode: ThemeMode = readStoredMode(resolveStorage());
updateThemeToggle(currentMode);

function handleThemeToggleClick(): void {
  currentMode = cycleThemeMode(currentMode);
  applyThemeMode(currentMode);          // persists when it can, no-ops when it can't
  updateThemeToggle(currentMode);
}

const unsubscribeSystemTheme = watchSystemTheme(
  (prefersDark) => {
    applyThemeMode('auto', { prefersDark });
    updateThemeToggle('auto', prefersDark);
  },
  { isAuto: () => currentMode === 'auto' }   // or pass currentMode via a getter
);
```

and change `watchSystemTheme`'s guard to consult that in-memory mode rather than
re-reading storage on every media-query event.

---

### CR-02: The BL-01/BL-02 overflow fix is pinned to `max-width: 380px`, leaving the same overflow across ~381-640px — including the three most common phone widths

**File:** `src/dashboard/styles.css:741-745`, `src/dashboard/styles.css:764-778`, `src/dashboard/styles.css:825-833`, `src/dashboard/styles.css:926`

**Issue:** Every compaction rule GC-1/GC-4/BL-01/BL-02 added lives inside
`@media (max-width: 380px)`. Above that breakpoint the *default* rules apply,
and those rules impose a hard, content-derived minimum width on
`.calendar-grid` that the new 8th track made materially worse:

| contributor | source | minimum contribution |
|---|---|---|
| 7 day tracks, `repeat(7, 1fr)` — `1fr` = `minmax(auto, 1fr)`, and `.calendar-day` declares a **definite** `min-width: 32px`, so each track's automatic minimum is the item's outer min-width | `styles.css:743`, `styles.css:766-769` | 7 x (32 + 2x8 padding + 2x1 border) = **350px** |
| 7 column gaps at `--space-xs: 4px` | `styles.css:744`, `styles.css:47` | **28px** |
| 8th `auto` track — `auto` min = min-content, and `.calendar-week-total` still declares `white-space: nowrap` at this breakpoint, so min-content is the full unwrapped widest line (e.g. `"357.3 km"` at 20px/600) plus 2x8 padding | `styles.css:743`, `styles.css:825-833` | **~100-105px** |
| **grid minimum** | | **~480px** |

Available width is `viewport - 2 x var(--space-lg)` because `.view { padding: 24px }`
(`styles.css:308-312`) has **no** override at any breakpoint. So:

- 390px viewport (iPhone 12/13/14/15) → 342px available vs ~480px needed
- 393px viewport (iPhone 15/16 Pro) → 345px available
- 412px viewport (Pixel) → 364px available
- ~530px viewport → first width at which the grid stops overflowing

Roughly 350px of that minimum pre-dates Phase 22; the ~100-105px the `nowrap`
`auto` Total track contributes is **new in this phase** and applies at every
width above 380px, not just at 380px. That is the same overflow class as BL-01
(a `nowrap` content floor winning the width negotiation), simply relocated one
pixel above the breakpoint where it was fixed.

No checkpoint row covers this band: `22-VALIDATION.md`'s rows exercise 380px and
desktop. `styles.test.ts`'s Phase 22 blocks are all text-level assertions about
which declarations exist inside which block — none of them can observe a
rendered width, and `IN-06`'s "exactly three 380px blocks" case actively locks
the breakpoint in place.

**Note on confidence:** the table above is derived from the CSS Grid track-sizing
rules plus the declared token values, not from a rendered measurement. It should
be confirmed with one browser observation at 390px before the fix is designed —
but the fix scope is wrong regardless of the exact pixel count, because the
compaction is gated at a narrower width than the content floor that motivated it.

**Fix:** raise the breakpoint to cover real phone widths, and drop the `nowrap`
floor from the Total track wherever the grid is width-constrained rather than at
one specific pixel value. Minimal shape:

```css
/* was: @media (max-width: 380px) */
@media (max-width: 640px) {
  .calendar-day,
  .calendar-week-total { padding: var(--space-xs); }

  .calendar-grid {
    grid-template-columns: repeat(7, minmax(0, 1fr)) minmax(0, max-content);
  }

  .calendar-day { min-width: 0; grid-template-areas: "number" "distance" "count";
                  grid-template-columns: 1fr; }
  /* …existing rules unchanged… */
}
```

If the type-size steps are only wanted at the very smallest widths, split into
two blocks: a `640px` block carrying the *floor-removal* rules (`min-width: 0`,
`minmax(0, …)`, `white-space: normal`, `overflow-wrap: anywhere`, the
single-column day stack) and the existing `380px` block carrying only the
`font-size` compaction. Update `styles.test.ts`'s IN-06 three-block count and
`calendar380Block()`'s needle to match, and add a checkpoint row at 390px.

## Warnings

### WR-01: `theme.ts` silently ignores an explicit `storage: null` override — and the three new BL-03 tests pass vacuously because of it

**File:** `src/dashboard/theme.ts:108`, `src/dashboard/theme.ts:145`, `src/dashboard/storage.ts:47`, `src/dashboard/theme.test.ts:199-213`, `src/dashboard/theme.test.ts:267-281`

**Issue:** `ApplyThemeOptions.storage` was widened to `ThemeStorage | null`
(`theme.ts:84`) and the JSDoc now says the mode is persisted "unless
`persist === false` **or no storage handle could be resolved**" — which reads as
"`storage: null` means don't persist". The implementation does the opposite:

```ts
const storage = resolveStorage(options.storage ?? undefined);   // theme.ts:108
```

`null ?? undefined` is `undefined`, and `resolveStorage(undefined)` falls through
its `if (override)` truthiness check (`storage.ts:47`) straight to
`globalThis.localStorage`. So an explicit `null` is upgraded to the **real
browser storage**. `watchSystemTheme` (`theme.ts:145`) has the identical shape.

This makes the three new tests added for BL-03 non-proofs:

- `theme.test.ts:199` — "sets data-theme even with a null storage handle"
- `theme.test.ts:206` — "does not throw with a null storage handle and persist
  left at its default true"
- `theme.test.ts:267` — "registers its listener … with a null storage handle"

All three pass only because vitest runs `environment: 'node'` and there is no
`globalThis.localStorage`, so the fallthrough happens to yield `null` anyway.
Under jsdom or in a browser these tests would exercise real `localStorage`, and
the second one would *write* `'light'` to the real store. They test the absent-
global path, not the null-override path they are named for.

**Fix:** make `null` an explicit, honoured opt-out in the resolver:

```ts
// storage.ts
export function resolveStorage(override?: WebStorage | null): WebStorage | null {
  if (override !== undefined) return override;   // null means "no storage", honoured
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
```

and drop the `?? undefined` coercions at `theme.ts:108` and `theme.ts:145`. Then
add a test that installs a working `globalThis.localStorage` stand-in and asserts
`applyThemeMode('dark', { storage: null, doc })` writes nothing to it — the case
none of the three new tests currently covers.

---

### WR-02: The `onMatch` and `mount()` ownership guards cannot distinguish two navigations to the same route

**File:** `src/dashboard/main.ts:61-75`, `src/dashboard/views/calendar.ts:384-386`, `src/dashboard/views/calendar.ts:405-407`

**Issue:** `main.ts:75` uses `currentView !== view` as its ownership token and
the comment asserts "only `currentView` distinguishes navigations". It does not.
`getView()` returns a **per-route singleton** built once in
`view-registry.ts:32-41`, so for two consecutive navigations to the same route
(`#/detail/A` → `#/detail/B`, `#/calendar?month=X` → `?month=Y`, both of which
are one click away from the list, the calendar picker and the month-nav buttons)
`view` is the *same object* on both passes. If navigation A's `view.mount()`
rejects after navigation B has already rendered, `currentView !== view` is
`false`, the guard passes, and A's error panel wipes B's freshly rendered view —
the exact failure the guard exists to prevent.

`calendar.ts` has the same shape one level down: its token is
`mountedContainer !== ctx.container`, but every view mounts into the single
`#app` element resolved once at `main.ts:35`, so `ctx.container` is a constant
across every navigation. The guard is structurally incapable of firing.

**Fix:** use a monotonic navigation token rather than object identity:

```ts
// main.ts
let navSeq = 0;
async function onMatch(match: RouteMatch): Promise<void> {
  const seq = ++navSeq;
  …
  try { await view.mount({ … }); }
  catch (error) { console.error(error); if (seq !== navSeq) return; … }
}
```

and mirror it in `calendar.ts` with a per-mount counter instead of
`mountedContainer`.

---

### WR-03: The repo-wide BL-03 invariant guard has two escape hatches and one portability bug

**File:** `src/dashboard/storage.test.ts:143-162`, `src/dashboard/storage.test.ts:134`

**Issue:** This test is the mechanism the whole BL-03 closure claim rests on, so
its holes matter more than a normal test's would.

1. `storage.test.ts:149` — `!f.endsWith('storage.ts')` exempts **any** file whose
   name ends in `storage.ts`, not just `src/dashboard/storage.ts`. A future
   `views/local-storage.ts`, `session-storage.ts` or `data/cache-storage.ts`
   would be silently exempt from the invariant it is the point of this test to
   enforce.
2. `storage.test.ts:143-145` — `stripComments` applies `/\/\/.*$/gm` to the whole
   file, which also strips everything after a `//` inside a **string literal**.
   A line such as `const u = 'https://x'; const s = globalThis.localStorage;`
   would have its dereference erased before scanning. False negative.
3. `storage.test.ts:134` — `new URL('.', import.meta.url).pathname` is
   percent-encoded and Windows-shaped. A checkout under a path containing a
   space or non-ASCII character makes `readdirSync` throw, and the test fails for
   a reason unrelated to the invariant.

**Fix:**

```ts
import { fileURLToPath } from 'node:url';
const DASHBOARD_ROOT = fileURLToPath(new URL('.', import.meta.url));
const RESOLVER_MODULE = join(DASHBOARD_ROOT, 'storage.ts');
…
const files = walk(DASHBOARD_ROOT)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== RESOLVER_MODULE);
```

and strip only line comments that begin at a `//` not preceded by `:` (the same
`(?<!:)\/\/.*$` form already used at `storage.test.ts:99`), or better, tokenise
with esbuild as `styles.test.ts` already does for its parse-level block.

---

### WR-04: `detail-charts.ts` hover indexes the primary series with an overlay dataset's index

**File:** `src/dashboard/views/detail-charts.ts:509-513`

**Issue:**

```ts
onHover: (_event: unknown, elements: { index: number }[]) => {
  if (elements.length === 0) return;
  const point = primarySeries[elements[0].index];
  if (point) broadcastHover(point.x);
},
```

`elements[0]` is whichever active element Chart.js reports first, and the
primary dataset is pushed **last** (`detail-charts.ts:470-482`) precisely so it
draws on top — with one or two overlays enabled, `elements[0]` belongs to an
*overlay* dataset. Its `index` is an index into that overlay's array, which is
not the same array as `primarySeries`: for a `pace` band, `derivePaceSeries`
returns `null` for every standstill window and `buildChannelSeries` **skips**
those entries (`detail-charts-logic.ts:154-158`), so the pace series is shorter
than the raw hr/cadence/elevation arrays by the number of stopped samples. The
crosshair and the D-26 map marker therefore land at the wrong x for any run with
a pause, whenever an overlay is checked.

**Fix:** select the element belonging to the primary dataset explicitly:

```ts
onHover: (_event: unknown, elements: { index: number; datasetIndex: number }[]) => {
  const primaryIdx = datasets.length - 1;
  const el = elements.find((e) => e.datasetIndex === primaryIdx);
  if (!el) return;
  const point = primarySeries[el.index];
  if (point) broadcastHover(point.x);
},
```

---

### WR-05: `buildChannelSeries` emits `{x, y: undefined}` points for a channel array shorter than `stream.t`

**File:** `src/dashboard/views/detail-charts-logic.ts:44-58`, `src/dashboard/views/detail-charts-logic.ts:162-167`

**Issue:** `availableChannels` admits a channel on `arr && arr.length > 0`
(`detail-charts-logic.ts:56`) — it never checks the array is the same length as
`stream.t`. `buildChannelSeries` then loops `n = stream.t.length` over that array:

```ts
const points: SeriesPoint[] = new Array(n);
for (let i = 0; i < n; i++) points[i] = { x: xs[i], y: values[i] };  // y is undefined past values.length
```

A truncated `hr`/`cadence`/`alt` stream (a sensor that dropped out mid-run, or a
partially committed stream) yields points whose `y` is `undefined`. With
`parsing: false` these are handed straight to Chart.js, and
`CHANNEL_META[ch].formatValue(raw)` in the tooltip callback receives them via a
`typeof raw !== 'number'` guard that renders an empty label
(`detail-charts.ts:500-505`) — so the failure surfaces as a silently blank
tooltip and a mis-scaled axis rather than an error. `validateStreamSeries` only
covers `t`/`d`.

**Fix:** clamp the loop and reject mismatched channels:

```ts
// availableChannels
if (arr && arr.length === stream.t.length) result.push(key);

// buildChannelSeries (defence in depth)
const n = Math.min(stream.t.length, values.length);
```

---

### WR-06: `atRuleBodiesFor(...)[0]` silently reads the first of three `@media (max-width: 380px)` blocks

**File:** `src/dashboard/styles.test.ts:520-549`, `src/dashboard/styles.test.ts:1968-2033`

**Issue:** Every Round-3 value assertion reads `atRuleBodiesFor(needle, prop)[0]`
— the **first** at-rule body in source order that declares that property for
that selector. `styles.test.ts:1927-1935` establishes that the file contains
three separate `@media (max-width: 380px)` blocks, and `atRuleBodiesFor` does not
distinguish between them or between different breakpoints. If a future edit adds
a `.calendar-day { min-width: 40px }` to, say, a `@media (max-width: 640px)`
block placed *earlier* in the file, `atRuleBodiesFor('.calendar-day', 'min-width')[0]`
would return that body instead and the assertion at `styles.test.ts:2020` would go
red (or, with an earlier block declaring the *same* value, stay green for the
wrong rule). The helper's own JSDoc promises "the matching bodies in source
order" but every call site consumes only `[0]` without asserting there is exactly
one.

**Fix:** assert cardinality at each call site, or have the helper take the
at-rule prelude as a parameter:

```ts
const bodies = atRuleBodiesFor('.calendar-day', 'min-width');
expect(bodies).toHaveLength(1);
expect(bodies[0]).toContain('min-width: 0');
```

## Info

### IN-01: `weekdayLabels('sunday')` returns the shared module constant by reference

**File:** `src/dashboard/views/calendar.ts:48-51`
**Issue:** The `'sunday'` branch returns `WEEKDAY_NAMES_SUNDAY_FIRST` itself; the
`'monday'` branch returns a fresh array. The `readonly string[]` return type is
compile-time only, so a caller mutating the result would corrupt the module
constant for every subsequent render, and the two branches have asymmetric
aliasing semantics.
**Fix:** `if (weekStart === 'sunday') return [...WEEKDAY_NAMES_SUNDAY_FIRST];`

---

### IN-02: `weekTotalAccessibleName`'s "Empty week" branch is unreachable and inconsistent with the cell it names

**File:** `src/dashboard/views/calendar.ts:103-104`, `src/dashboard/views/calendar-logic.ts:238`
**Issue:** `buildMonthGrid` guarantees at least 4 rows over at least 28 days, so
no row can have zero non-null cells and `cells.length === 0` is dead. If it were
ever reached, the sr-only name would say "Empty week" while `buildWeekTotalCell`
renders the rest-week en-dash — two different vocabularies for the same state
("rest week" is used everywhere else).
**Fix:** either drop the branch or align its wording with `, rest week`.

---

### IN-03: `MAX_OVERLAYS_PER_BAND` is duplicated as a hardcoded string in the hint

**File:** `src/dashboard/views/detail-charts.ts:392-394`, `src/dashboard/views/detail-charts-logic.ts:256`
**Issue:** `hintEl.textContent = 'Up to 2'` restates `MAX_OVERLAYS_PER_BAND = 2`
in prose. Changing the constant leaves the hint lying.
**Fix:** `hintEl.textContent = \`Up to ${MAX_OVERLAYS_PER_BAND}\`;`

---

### IN-04: `OverlayConfig` is typed `Readonly` but its arrays are mutable at runtime

**File:** `src/dashboard/views/detail-charts-logic.ts:244-251`, `src/dashboard/views/detail-charts-logic.ts:294`
**Issue:** `Object.freeze` is applied to the outer record only; `DEFAULT_OVERLAY_CONFIG.pace`
and every `parseOverlayConfig` result array stay mutable. `Readonly<Record<K, K[]>>`
protects the keys, not the arrays. The current call sites all copy
(`detail-charts.ts:254`), so nothing is broken today — but the type advertises a
guarantee the runtime does not provide, and `DEFAULT_OVERLAY_CONFIG` is a shared
singleton returned from four different code paths.
**Fix:** type as `Readonly<Record<ChannelKey, readonly ChannelKey[]>>` and freeze
each array.

---

### IN-05: `ROUTES.DETAIL.replace(':id', …)` is neither URL-encoded nor `$`-escaped

**File:** `src/dashboard/views/calendar.ts:240`
**Issue:** `String.prototype.replace` interprets `$&`, `` $` ``, `$'` and `$n` in
the *replacement* string, so an activity id containing those sequences would
produce a corrupted route; the id is also not `encodeURIComponent`-ed before
being spliced into a hash path. Today's ids are numeric/`i`-prefixed so neither
is reachable, but the pattern is repeated across views.
**Fix:** `ROUTES.DETAIL.replace(':id', () => encodeURIComponent(cell.activityIds[0]))`
— the function form disables `$` substitution.

---

### IN-06: Review-round history has become the dominant content of several source files

**File:** `src/dashboard/views/calendar-preferences.ts:1-45`, `src/dashboard/views/calendar.ts:426-441`, `src/dashboard/storage.ts:1-30`, `src/dashboard/styles.css:855-925`
**Issue:** Several comment blocks now describe superseded rounds rather than the
code as it stands: `calendar-preferences.ts:32-44` narrates a claim that "Rounds
1 and 2 got wrong" and names plan `22-11` as a pending dependency that has since
landed; `calendar.ts:426-441` is a 16-line comment on a one-line delegation;
`styles.css:862-870` records two superseded FAIL rows. A reader arriving fresh
must reconstruct which paragraphs describe live behaviour and which are archived
process. The rationale is valuable, but the phase's `-SUMMARY.md` /
`-VALIDATION.md` artifacts already hold it.
**Fix:** trim each block to the invariant a future editor must not break (one to
three lines), and leave the round-by-round narrative in the planning artifacts.

---

_Reviewed: 2026-08-19T08:43:48Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
