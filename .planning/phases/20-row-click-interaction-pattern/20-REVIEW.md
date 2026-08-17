---
phase: 20-row-click-interaction-pattern
reviewed: 2026-08-17T21:40:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/dashboard/row-navigation.test.ts
  - src/dashboard/row-navigation.ts
  - src/dashboard/row-semantics.test.ts
  - src/dashboard/styles.css
  - src/dashboard/styles.test.ts
  - src/dashboard/views/list.test.ts
  - src/dashboard/views/list.ts
  - src/dashboard/views/overview.test.ts
  - src/dashboard/views/overview.ts
  - src/dashboard/views/records.ts
findings:
  critical: 1
  warning: 9
  info: 11
  total: 21
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-08-17T21:40:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Round 3 review, after gap-closure plans 20-09 (`89dc391`, `f94dda3`, `89d1b48`) and 20-10
(`2229fe9`, `e68a2bd`). Both were re-verified against current source rather than taken on
trust, and both landed real code — but only two of the three findings they were aimed at
are actually closed, and each fix opened a narrower hole of the same class.

`git diff --stat cacc416..HEAD -- src/` shows the entire gap-closure round touched exactly
four files: `row-navigation.ts`, `row-navigation.test.ts`, `row-semantics.test.ts`,
`styles.test.ts`. **`list.ts`, `overview.ts`, `records.ts` and `styles.css` are byte-identical
to what the previous round reviewed**, so every prior finding against those four files is
still open verbatim; none was re-derived on trust, each was re-read.

All 175 tests across the five phase test files pass (`npx vitest run` on the phase files,
run during this review).

### Disposition of every finding in the prior review (`cacc416`)

| Prior ID | Prior severity | Status now | Evidence |
|---|---|---|---|
| CR-01 row-click link contract | Critical | **RESOLVED** | `shouldNavigateOnRowClick` (`row-navigation.ts:103-117`) implements all four refusal classes in the reviewed order; `attachRowNavigation` (`:127-142`) builds the context from `event.button`/`metaKey`/`ctrlKey`/`shiftKey`/`altKey`/`closest('a')`/`window.getSelection()` and gates `navigateTo` on the predicate. 21 cases in `row-navigation.test.ts` cover it. Sub-point 2 (middle-click) is not implemented and is now an explicitly recorded D-12 out-of-scope call — not reported again here, per the accepted Round 3 record. |
| WR-01 `notedActivityId` leak | Warning | **STILL OPEN — promoted** | `list.ts:1117-1131` unchanged; `mount()` still calls `applyReturnHighlight` in one branch only. See CR-01 below. |
| WR-02 D-01 guards case-blind | Warning | **RESOLVED on the spelling axis; new hole found** | `rowSemanticViolations` (`row-semantics.test.ts:136-173`) catches all four spellings; self-tests at `:270-333` include the exact WR-02 mutation. But the `role` allowlist is value-keyed — see WR-01 below. |
| WR-03 Phase 20 CSS assertions first-wins | Warning | **PARTIALLY ADDRESSED** | 4 of the 7 Phase 20 CSS assertions moved onto `bodyForSelectorListToken`/`cascadeWinningBodyDeclaring`. 3 were left on `selectorListDeclares` (WR-02 below), and the new helpers are blind to `@media` overrides (WR-03 below). |
| WR-04 `.activity-list--cards` gap inert | Warning | **STILL OPEN** | `styles.css:534-536` / `styles.css:550-552` unchanged; banner claim at `styles.css:1493-1496` unchanged. |
| WR-05 badge string dispatch / `idPrefix` | Warning | **STILL OPEN** | `list.ts:249-257` unchanged. |
| WR-06 no coverage for `attachRowNavigation` | Warning | **PARTIALLY ADDRESSED** | The decision is now unit-tested; the DOM plumbing that feeds it is not. |
| WR-07 divergent accessible names | Warning | **STILL OPEN** | `list.ts:290-294` vs `list.ts:479-482` unchanged. |
| IN-01…IN-03, IN-05…IN-08 | Info | **STILL OPEN** | Files unchanged. |
| IN-04 `stripComments` exported from a test file | Info | **REGRESSED** | Still exported with zero importers, and now duplicated verbatim into a second test file — see WR-04 below. |

## Critical Issues

### CR-01: the one-shot return-highlight fires on unrelated navigations, stealing focus and scrolling the page

**File:** `src/dashboard/views/list.ts:1112-1131`, `src/dashboard/views/list.ts:1293-1325`
(reads: `src/dashboard/views/detail.ts:665`)

**Issue:** `applyReturnHighlight` is the only writer that clears `notedActivityId`
(`list.ts:1122`), and `mount()` reaches it from exactly one branch — the non-empty,
non-error, non-stale one (`list.ts:1322-1324`). The id therefore survives:

- the zero-match branch — `list.ts:1293-1299` appends the empty state and returns before
  the `else` block that calls `applyReturnHighlight`;
- the load-failure branch — `list.ts:1239-1259` early-returns after rendering the error state;
- the stale-container branch — `list.ts:1322` skips the call.

`applyReturnHighlight`'s own JSDoc (`list.ts:1109-1111`) states it "Clears the noted id
unconditionally so a later navigation to the list does not re-highlight." That sentence is
false for all three paths above; the documented contract and the code disagree.

The behaviour is reachable without any unusual gesture, because `detail.ts:665` calls
`noteViewedActivity(detail.id)` on **every** detail mount, not only on visits the user later
backs out of. Concrete repro:

1. Open any activity detail (`#/activity/X`) — `notedActivityId = 'X'`.
2. Navigate to `#/list` with a filter that matches nothing (`filtered.length === 0`) —
   empty-state branch, id retained.
3. Clear the filter, or navigate away and back.
4. Row X is now class-highlighted, `scrollIntoView({ block: 'center' })`-ed, and given
   **focus** — with no return gesture anywhere in that sequence.

Blast radius grew when plan 20-06 fixed `highlightAndFocus` for the card shape
(`list.ts:1101`, `el.tagName === 'A'`). Before that fix the stale-id path silently no-opped
on the mobile card layout; it now steals focus and scrolls there too, on the one breakpoint
where the card is the only focusable row shape. Unexpected focus movement is a WCAG 3.2.x
class defect, not a cosmetic one.

**Fix:** make the clear independent of render outcome — read-and-consume once, early in
`mount()`, before the branches diverge:

```ts
/** Reads and consumes the one-shot return hint. Consuming is unconditional by
 *  construction, so no render branch can leak it into a later navigation. */
function takeNotedActivityId(): string | null {
  const id = notedActivityId;
  notedActivityId = null;
  return id;
}

function applyReturnHighlight(
  notedId: string | null,
  tableWrapper: HTMLElement,
  cardList: HTMLElement,
  pageItems: readonly DashboardIndexRow[],
): void {
  if (notedId === null) return;
  const idx = pageItems.findIndex((row) => row.id === notedId);
  if (idx === -1) return;
  highlightAndFocus(tableWrapper.querySelectorAll('tbody tr')[idx] as HTMLElement | undefined);
  highlightAndFocus(cardList.children[idx] as HTMLElement | undefined);
}
```

Then in `mount()`, immediately after the stale-container guard at `list.ts:1264`:

```ts
const notedId = takeNotedActivityId();   // consumed on EVERY render path
```

and pass `notedId` into the call at `list.ts:1323`. Add a unit test that calls
`noteViewedActivity('X')`, drives the empty-filter path, and asserts a subsequent
non-empty render does not highlight — the current suite has no case for this at all.

## Warnings

### WR-01: the D-01 guard's `role` allowlist is keyed on the value being `link`, so `role="presentation"` on a `<tr>` passes

**File:** `src/dashboard/row-semantics.test.ts:140`, `src/dashboard/row-semantics.test.ts:157-170`

**Issue:** `isAllowedRoleValue` is `value.toLowerCase() !== 'link'`. Everything that is not
literally `link` is allowlisted. But the harm D-01 exists to prevent, stated in its own
comment at `row-navigation.ts:10-13` and `row-semantics.test.ts:22-37`, is that *a `role` on
a `<tr>` removes it from the table's accessibility tree and breaks screen-reader table
navigation*. That harm is caused by `role="presentation"`, `role="button"` and `role="row"`
just as much as by `role="link"` — `presentation` is strictly worse, since it strips the row
from the tree with no replacement semantic at all. Executed proof against a verbatim copy of
`rowSemanticViolations`:

```
MISSED   n=0  tr.setAttribute('role', 'presentation');
MISSED   n=0  tr.setAttribute('role', 'button');
MISSED   n=0  tr.role = 'row';
MISSED   n=0  tr.setAttribute("role", `link`);      // backtick-quoted value
MISSED   n=0  tr.setAttribute('role', ROLE_LINK);   // value via identifier
caught   n=1  tr.role = 'link';                     // control
caught   n=1  tr.setAttribute('role', 'LINK');      // control
```

Three of those five misses put a role on a row element and defeat D-01 while the suite stays
green. The comment block at `row-semantics.test.ts:31-37` documents the allowlist as
two rules and tells a future agent not to widen them — but the rule as written is already
wider than the invariant it claims to enforce, and the eleven self-tests at `:270-333` only
ever exercise the value `link`, so nothing surfaces the gap.

**Fix:** invert the rule — allowlist by *receiver*, the way the `tabindex` rule already does,
rather than by value:

```ts
// A `role` write is permitted only on the two live-region receivers that need one:
// `loading.setAttribute('role', 'status')` — list.ts:1233, records.ts:762.
// Any role write on any other receiver is a violation, whatever the value: a role on a
// <tr> removes it from the table accessibility tree regardless of which role it is.
const isAllowedRoleWrite = (receiver: string, value: string): boolean =>
  receiver === 'loading' && value.toLowerCase() === 'status';
```

and widen both value patterns to accept backticks (`['"\`]`) plus a bare-identifier value, so
a non-literal role value is reported rather than skipped. Add self-tests for
`role="presentation"` and `role="button"` alongside the existing `link` cases.

### WR-02: three Phase 20 CSS assertions were left on `selectorListDeclares`, which is any-rule-wins — the exact false-green mechanism 20-10 was raised to close

**File:** `src/dashboard/styles.test.ts:1263`, `:1267`, `:1292`

**Issue:** Plan 20-10 moved four Phase 20 assertions off the first-wins `declarationsFor`,
and the helper-audit comment at `styles.test.ts:790-814` presents that as closing WR-03. It
does not close the block: three assertions in the same `describe` still read through
`selectorListDeclares`, which returns `true` as soon as **any** rule with that selector token
contains the declaration substring (`styles.test.ts:140-153`) — a later, cascade-winning
override cannot make it fail. That is a strictly weaker guarantee than the first-wins helper
that was just removed for being too weak. Executed mutation against the real stylesheet:

```
BASELINE   selectorListDeclares('.activity-row', 'text-decoration: none') -> true
MUTATION   append `.activity-row { text-decoration: underline; }` to styles.css
RESULT     selectorListDeclares('.activity-row', 'text-decoration: none') -> true   (still green)
```

So the whole-row link can render underlined — the precise regression the rule's own comment
at `styles.css:1525-1529` says it exists to prevent — with the suite green. The same holds
for `D-06: the bare a rule declares color: inherit` (`:1263`) and
`text-decoration: underline` (`:1267`).

**Fix:** convert all three to the cascade-aware helper, exactly as the other four were:

```ts
it('.activity-row declares text-decoration: none - the whole-row link is not a text link', () => {
  expect(cascadeWinningBodyDeclaring('.activity-row', 'text-decoration')).toContain(
    'text-decoration: none',
  );
});

it('D-06: the bare a rule declares color: inherit', () => {
  expect(cascadeWinningBodyDeclaring('a', 'color')).toContain('color: inherit');
});
```

and correct the audit paragraph at `styles.test.ts:790-814`, which currently reads as if the
whole Phase 20 block was migrated.

### WR-03: `cascadeWinningBodyDeclaring` is named for the cascade but skips every at-rule-scoped rule, so a `@media` override of `.activity-row` leaves all four converted assertions green

**File:** `src/dashboard/styles.test.ts:315-378` (helpers), consumed at `:1288`, `:1296`, `:1302`, `:1306`

**Issue:** `bodiesForSelectorListToken` `continue`s on any candidate for which
`isAtRuleScoped` is true (`styles.test.ts:326-329`), and `cascadeWinningBodyDeclaring` builds
on it, so both are structurally incapable of seeing a declaration inside `@media`. The JSDoc
at `:341-361` nevertheless calls the return value "the cascade winner … matching how CSS
resolves a selector declared more than once", with no statement of the exclusion. Skipping
`@media` is defensible for *resolution* (a media rule may not apply), but it is not
defensible for a *guard*: the assertion it backs claims a rule is live, and a media-query
override makes it dead at exactly one breakpoint. That is not theoretical for this selector —
`.activity-row`'s presentation is governed by the 720px breakpoint in this very file
(`styles.css:545-553`). Executed mutation:

```
MUTATION  append `@media (max-width: 720px) { .activity-row { display: block; } }`
RESULT    cascadeWinningBodyDeclaring('.activity-row','display') -> "display: flex; …"  (green)

MUTATION  append `@media (max-width: 720px) { .activity-table__row--navigable { cursor: default; } }`
RESULT    bodyForSelectorListToken('.activity-table__row--navigable') contains 'cursor: pointer' -> true  (green)
```

The first mutation is precisely the "load-bearing `display: flex`" failure
(`styles.css:335-337`) the converted assertion was written to catch, and it survives the
conversion.

**Fix:** at minimum, state the exclusion in the JSDoc and rename to
`topLevelCascadeWinningBodyDeclaring` so no future reader reads "cascade winner" as
"resolves like a browser". Better: add a companion assertion that no at-rule-scoped rule
redeclares the guarded property for the guarded selector:

```ts
/** Fails when any at-rule-scoped rule redeclares `property` for `needle` —
 *  the blind spot `cascadeWinningBodyDeclaring` cannot see by construction. */
function assertNoAtRuleOverride(needle: string, property: string): void { /* … */ }

it('.activity-row keeps display: flex - load-bearing now that it is an <a>', () => {
  expect(cascadeWinningBodyDeclaring('.activity-row', 'display')).toContain('display: flex');
  assertNoAtRuleOverride('.activity-row', 'display');
});
```

### WR-04: `stripComments` was copy-pasted into `row-navigation.test.ts` instead of imported, and the two copies have no shared self-tests

**File:** `src/dashboard/row-navigation.test.ts:160-168`, `src/dashboard/row-semantics.test.ts:68-90`

**Issue:** `row-semantics.test.ts:68` exports `stripComments` and self-tests it four ways
(`:73-90`). Plan 20-09 needed the same helper in `row-navigation.test.ts` and duplicated the
body verbatim (`:165-168`) rather than importing it — its own comment even says "mirrors
`row-semantics.test.ts`'s `stripComments`", acknowledging the duplication in writing. Two
consequences, both live:

1. The copy at `row-navigation.test.ts:165` has **no** self-tests. Every assertion in that
   file's `row-navigation.ts wiring` block (`:170-201`) depends on the copy stripping
   correctly; if it drifts, four assertions silently change meaning with nothing to catch it.
   The whole point of stripping is that comment prose must not satisfy an assertion about
   live code — the `auxclick` zero-count check at `:194-200` is defeated outright if
   stripping regresses.
2. `export` on `row-semantics.test.ts:68` now has **zero** importers repo-wide
   (`grep -rn "stripComments" src/` confirms: every reference is inside its own file, plus
   the independent copy). The export is dead, and the copy is what made it dead.

Both files also inherit the `(?<!:)\/\/.*$` literal-truncation hazard the prior IN-04 flagged,
now in two places instead of one.

**Fix:** move the helper to a shared `src/dashboard/test-utils.ts` (or import it from
`row-semantics.test.ts`, which already exports it) and delete the copy, so the four self-tests
cover both consumers:

```ts
// row-navigation.test.ts
import { stripComments } from './row-semantics.test.js';   // or a shared test-utils module
```

### WR-05: the D-12 selection guard covers drag-select but not double-click word-select, so the first click of a double-click navigates away

**File:** `src/dashboard/row-navigation.ts:113-115`, `src/dashboard/row-navigation.ts:136`

**Issue:** `hasTextSelection` is read from `window.getSelection()` **at click time**. A
drag-select is protected: mouseup happens with the selection already set, and the `click`
that follows sees it non-collapsed. A double-click is not: the browser fires
`click` (detail 1) → `click` (detail 2) → `dblclick`, and the word selection only exists from
the second event onward. The **first** click sees a collapsed selection, passes every guard,
and `navigateTo` fires — the user is on the detail page before the word they meant to select
is ever highlighted.

This matters on the same five anchor-less Records PR-table cells D-12 was written for
(`records.ts:375-394` — Rank, Time, Pace, Age-Grade, Flags): those cells carry exactly the
kind of short numeric values a user double-clicks to copy. The predicate's JSDoc
(`row-navigation.ts:100`) states the intent as "a drag-select that ends inside the row must
survive", which is accurate for what is implemented but reads as if selection is covered
generally; nothing in `20-CONTEXT.md`'s D-12 records the double-click case either way.

**Fix:** either refuse navigation on a multi-click event, which is one field on the existing
pure predicate and therefore testable under `environment: 'node'` like every other guard:

```ts
export interface RowClickContext {
  // … existing fields …
  /** `MouseEvent.detail` — 2+ means this click is part of a double-click sequence. */
  clickCount: number;
}

// in shouldNavigateOnRowClick, alongside the other refusals:
if (context.clickCount > 1) {
  return false;   // a double-click is a select gesture, not a navigate gesture
}
```

(fed by `clickCount: event.detail` in `attachRowNavigation`) — or record the double-click
case explicitly in D-12 as accepted, in the same register D-12 already uses for `auxclick`,
so it is a decision rather than an unexamined gap. Do not leave it undocumented.

### WR-06: the mobile card list is `display: block`, so the `gap` the Phase 20 focus-ring rationale relies on does not exist at the breakpoint where the card is the only focusable row

**File:** `src/dashboard/styles.css:550-552`, rationale at `src/dashboard/styles.css:1487-1497`

**Issue:** Unchanged since the prior round; re-verified. The Phase 20 banner justifies having
no row-specific focus ring with "`.activity-list`'s `gap: var(--space-sm)` (8px) leaves room
for the ring's 4px spread". `.activity-list` is `display: flex` (`styles.css:329-333`), so
that holds — but `.activity-list--cards` is switched to `display: block` inside the 720px
media query (`styles.css:550-552`), where `gap` is inert. Cards therefore stack with zero
separation on the exact breakpoint where the card *is* the anchor and the only focusable row
shape. The ring is not clipped (`:focus-visible` declares `position: relative; z-index: 1`,
so it paints above neighbours) but it overlaps the adjacent row's 1px border with no
clearance, which is the legibility outcome the banner claims is prevented.

**Fix:** keep the card list a flex column across the breakpoint so the gap survives —
`.activity-list` already supplies `flex-direction: column` and the gap:

```css
@media (max-width: 720px) {
  .activity-list--cards {
    display: flex;
  }
}
```

and correct the banner comment, which currently asserts a clearance guarantee the stylesheet
does not provide.

### WR-07: `appendStatusBadges` dispatches on badge string equality, and the `idPrefix` uniqueness contract is documentation-only

**File:** `src/dashboard/views/list.ts:249-257`; call sites `list.ts:345`, `list.ts:503`, `records.ts:412`, `detail-sections.ts:346`

**Issue:** Unchanged since the prior round; re-verified. Two coupled fragilities:

1. `appendStatusBadges` picks its DOM builder by comparing badge *text* to
   `LOW_CONFIDENCE_BADGE_TEXT` (`list.ts:251`). Badge text and badge DOM shape are bound by
   string identity, so any future badge whose text collides — or any localisation that misses
   one of the two constants — silently downgrades the accessible low-confidence badge to a
   plain `.badge` with no `title`, no `.sr-only` span, and a **dangling**
   `aria-describedby` on the row (`list.ts:331-333` points at an id that
   `appendLowConfidenceBadge` would no longer create).
2. The `idPrefix` uniqueness rule that CR-02 exists to enforce lives only in a JSDoc
   paragraph (`list.ts:242-247`). Four call sites hand-roll four conventions —
   `activity-card-${row.id}`, `activity-table-${row.id}`, `pr-${distance}-${row.activityId}`,
   `best-efforts-${row.distance}` — with no shared builder and no runtime assertion.
   `row-semantics.test.ts:410-419` only counts that two template literals appear once each;
   it cannot see a *third* surface reusing one, which is exactly how the original collision
   arose.

**Fix:** make the shape discriminated rather than string-matched, and centralise prefix
construction:

```ts
type StatusBadge =
  | { kind: 'plain'; text: string }
  | { kind: 'low-confidence'; text: typeof LOW_CONFIDENCE_BADGE_TEXT };

export function statusBadges(row: DashboardIndexRow): StatusBadge[] { /* … */ }
export function statusBadgeTexts(row: DashboardIndexRow): string[] {
  return statusBadges(row).map((b) => b.text);
}

/** The only sanctioned way to build a badge id prefix. Surface is a closed union. */
export type BadgeSurface = 'activity-card' | 'activity-table' | 'pr' | 'best-efforts';
export function badgeIdPrefix(surface: BadgeSurface, ...parts: string[]): string {
  return [surface, ...parts].join('-');
}
```

Then `appendStatusBadges` switches on `badge.kind`, and one test asserts the full set of
prefixes produced for a single row across all surfaces is distinct.

### WR-08: the same activity announces two different accessible names on the same page, with nothing pinning the divergence

**File:** `src/dashboard/views/list.ts:290-294` vs `src/dashboard/views/list.ts:479-482`

**Issue:** Unchanged since the prior round; re-verified. `#/list` renders both layouts into
the DOM simultaneously — only CSS hides one (`list.ts:1301-1307`, `styles.css:534`/`:546`).
The card anchor announces `"<name>, <date>, <km>, No HR, Excluded from records, 2 PR"`
(via `activityRowAriaLabel`), while the table anchor for the identical row announces a
hand-built `"<name>, <date>, <km>"` (`list.ts:479-482`, an inline template literal, not the
shared builder). `records.ts:403-406` uses a third, date-first shape.

The stated justification (`list.ts:283-288`: table badges "live in a sibling `<td>` … and are
already announced by table navigation") holds only in a screen reader's table-browse mode. In
Tab-through-focusables or links-list mode, the anchor is the only thing announced and the
Status column's text is never reached. `aria-describedby` on the badge span (`list.ts:193`)
does not help, since the badge span is never focused. Nothing in the suite pins the
divergence, so it cannot regress loudly, and the fact that `buildTableRow` re-derives the
base string inline rather than calling `activityRowAriaLabel` means the two can drift further
with no signal.

**Fix:** route both surfaces through one builder so the base cannot diverge, then decide the
badge question explicitly:

```ts
// buildTableRow
anchor.setAttribute('aria-label', composeRowAriaLabel(activityRowBase(row), /* badges? */ []));
```

Whichever way the badge question is decided (fold in, or add an in-cell `.sr-only` span), add
a test asserting the shared base is identical on both list surfaces.

### WR-09: `attachRowNavigation`'s DOM plumbing still has zero executable coverage, and the "no DOM available" premise remains a dependency choice

**File:** `src/dashboard/row-navigation.ts:125-143`, `src/dashboard/row-navigation.test.ts:170-201`

**Issue:** Partially addressed. Plan 20-09 correctly extracted the decision into a pure
predicate, and the predicate is now well covered (10 cases). What is still unproven is
everything that *builds the input to it*: `closest('a')`, `window.getSelection()`, the
field-by-field mapping from `MouseEvent`, and the `addEventListener` wiring. The substitute
is four source-text assertions (`row-navigation.test.ts:175-200`), and those cannot see the
defect class that matters. Mutations that keep every one of them green:

- `metaKey: event.ctrlKey, ctrlKey: event.metaKey` — fields swapped; all five
  `toContain('event.…')` assertions still pass.
- `insideAnchor: false` while retaining a dead `event.target.closest('a')` expression — the
  `closest('a') occurs exactly once` count still passes, and the double-navigation guard
  the module's own header calls load-bearing is gone.

The stated blocker ("this repository has no jsdom and no headless browser anywhere in it",
`row-navigation.ts:52-54`) is a devDependency fact, not a platform constraint:
`vitest.config.ts:6` pins `environment: 'node'` globally, and vitest supports a per-file
`// @vitest-environment happy-dom` pragma. Both critical findings this phase has produced
were DOM-behaviour defects a source-text guard could not see.

**Fix:** add `happy-dom` as a devDependency and one DOM-scoped file for the plumbing:

```ts
// @vitest-environment happy-dom
import { attachRowNavigation } from './row-navigation.js';

it('does not navigate when the click originates inside an in-row anchor', () => {
  const tr = document.createElement('tr');
  const a = document.createElement('a');
  a.href = '#/activity/1';
  tr.appendChild(a);
  attachRowNavigation(tr, '1');
  const before = window.location.hash;
  a.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(window.location.hash).toBe(before);
});

it('maps each modifier onto the matching context field, not a neighbouring one', () => {
  // dispatch four clicks, one modifier each, and assert no hash change for any of them
});
```

## Info

### IN-01: the `tabIndex` property pattern requires a trailing `;`, producing both a miss and a false positive

**File:** `src/dashboard/row-semantics.test.ts:143`
**Issue:** `/…\.\s*tabIndex\s*=(?!=)\s*([^;]*);/gi` needs a `;` to match at all, and captures
the value greedily up to the *next* `;` anywhere in the file. Executed proof:
`rowSemanticViolations('tr.tabIndex = 0')` (ASI, no semicolon, nothing after) returns `[]` —
missed; `rowSemanticViolations('heading.tabIndex = -1\nconst x = 1;')` returns one violation —
a false positive on an allowlisted receiver, because the captured value is
`-1\nconst x = 1` rather than `-1`.
**Fix:** terminate the value capture at a statement boundary rather than a semicolon:
`/([A-Za-z_$][\w$]*)\s*\.\s*tabIndex\s*=(?!=)\s*([^;\n]*)/gi`.

### IN-02: `LOW_CONFIDENCE_BADGE_TEXT` is exported with no external consumer

**File:** `src/dashboard/views/list.ts:155`
**Issue:** `grep -rn "LOW_CONFIDENCE_BADGE_TEXT" src/` finds references only inside `list.ts`
(lines 191, 222, 251). No other module and no test imports it.
**Fix:** drop the `export`, or add the test that asserts badge text and composed label text
agree through it.

### IN-03: `recentPrRowAriaLabel` unconditionally appends a PR badge, producing "0 PR" for a zero-PR row

**File:** `src/dashboard/views/overview.ts:101-105`
**Issue:** `composeRowAriaLabel(base, [recentPrBadgeText(row)])` hardcodes a one-element
array. The only current caller filters on `prCount > 0` (`overview.ts:176`), but the function
is exported (and directly tested at `overview.test.ts:56-74`), while its sibling
`statusBadgeTexts` guards the same condition (`list.ts:229-231`) — the asymmetry is a trap for
the next caller.
**Fix:** `composeRowAriaLabel(base, row.prCount > 0 ? [recentPrBadgeText(row)] : [])`, plus a
test case at `prCount: 0`.

### IN-04: `highlightAndFocus` applies a table-namespaced BEM class to a non-table card element

**File:** `src/dashboard/views/list.ts:1099`
**Issue:** `activity-table__row--highlight` is added to both the `<tr>` and the
`.activity-row` card anchor. The class asserts a block (`activity-table`) the card is not part
of, which is why `styles.css:528` sits in the table section while styling a card.
**Fix:** rename to a surface-neutral `row--highlight` and update `styles.css:528`.

### IN-05: `row-semantics.test.ts` hard-codes `.cta` occurrence counts for three files outside this phase

**File:** `src/dashboard/row-semantics.test.ts:185-200`
**Issue:** `detailCount).toBe(4)`, `trendsCount).toBe(1)`, `detailMapCount).toBe(1)` pin `.cta`
counts in `detail.ts`, `trends.ts` and `detail-map.ts`. A future phase adding a legitimate CTA
to any of those fails a Phase 20 test for an unrelated reason.
**Fix:** assert the two facts this phase owns (`listCount === 0`, `recordsCount === 1`) and
move the cross-file `.cta` inventory into its own clearly-labelled suite.

### IN-06: the `overview.ts` `aria-label` count guard breaks on any unrelated future label

**File:** `src/dashboard/row-semantics.test.ts:390-408`
**Issue:** `expect(countOccurrences(overviewStripped, 'aria-label')).toBe(1)` fails the moment
overview gains a second, entirely legitimate `aria-label` (a landmark, a stat card, a chart).
The intent — "no raw inline label template literal survives" — is better expressed directly.
**Fix:** assert the absence of the raw shape instead, e.g.
``expect(overviewStripped).not.toMatch(/setAttribute\(\s*'aria-label'\s*,\s*`/)``, alongside
the existing `recentPrRowAriaLabel` count.

### IN-07: `formatActivityDate` returns an em dash for any offset-suffixed ISO timestamp

**File:** `src/dashboard/views/list.ts:61-67`
**Issue:** The normaliser appends `Z` whenever the string does not already end in `Z`, so
`2024-01-15T09:00:00+02:00` becomes `…+02:00Z`, an invalid date, rendered as `—` across list,
overview, records and detail at once. The archive currently carries only the two documented
shapes, but the guard is shape-blind rather than shape-aware, so a third producer degrades
silently.
**Fix:** only append `Z` when there is no timezone designator at all:
`const hasTz = /(?:Z|[+-]\d{2}:?\d{2})$/.test(isoLocal);`

### IN-08: `attachRowNavigation` is called at inconsistent points relative to cell construction

**File:** `src/dashboard/views/list.ts:467` vs `src/dashboard/views/records.ts:419` and `src/dashboard/views/records.ts:532`
**Issue:** `list.ts` wires the row before appending any cells; `records.ts` wires it after.
Behaviourally identical today (both precede document insertion), but it reads as if ordering
matters somewhere and it does not.
**Fix:** pick one position — immediately after `document.createElement('tr')` pairs the
element with its behaviour — and apply it at all three call sites.

### IN-09: `activityDetailPath` / `activityDetailHref` interpolate the activity id without encoding it

**File:** `src/dashboard/row-navigation.ts:67-74`
**Issue:** `` `/activity/${activityId}` `` is written straight into `window.location.hash`
(`router.ts:176`) and into `anchor.href`, while `router.ts` decodes captured segments with
`decodeURIComponent`. An id containing `?`, `#`, `/` or `%` therefore does not round-trip:
`parseHash` (`router.ts:22-25`) splits on the first `?`, so `?` truncates the id into a query
string. Not exploitable today — ids are numeric or `i`-prefixed, and the `#` prefix means the
value can never become a `javascript:` URL — but the round-trip contract is unenforced.
**Fix:** `return '/activity/' + encodeURIComponent(activityId);`, and extend
`row-navigation.test.ts:27-41` with a case containing a reserved character.

### IN-10: the D-06 negative `a`-rule assertion passes vacuously if the rule is deleted

**File:** `src/dashboard/styles.test.ts:1270-1276`
**Issue:** `expect(selectorListDeclares('a', 'color: var(--accent)')).toBe(false)` returns
`false` both when the rule declares something else *and* when no bare `a` rule exists at all.
Executed proof: deleting the entire `a { … }` block from a copy of the stylesheet leaves this
assertion green. It is only non-vacuous because the two sibling positive assertions
(`:1263`, `:1267`) happen to fail in that case — and those two are themselves weakened by
WR-02 above.
**Fix:** resolve the rule first so a deleted rule throws, then assert on its body:
`expect(cascadeWinningBodyDeclaring('a', 'color')).not.toContain('var(--accent)')`.

### IN-11: the `auxclick` zero-count assertion encodes "do not implement" as a failing test

**File:** `src/dashboard/row-navigation.test.ts:194-200`
**Issue:** The assertion makes any future `auxclick` handler in `row-navigation.ts` fail the
suite. That is the intended tripwire while D-12's disposition stands, but it also means the
recorded Round 3 R18/R19 outcome cannot be revisited without editing a test whose failure
message says not to. The tripwire is reasonable; what is missing is a stated exit condition.
**Fix:** extend the failure message to name what must change first, e.g. "…update D-12 in
20-CONTEXT.md before removing this assertion", so the guard documents its own retirement path
rather than reading as permanent.

---

_Reviewed: 2026-08-17T21:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
