---
phase: 20-row-click-interaction-pattern
reviewed: 2026-08-13T20:30:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/dashboard/row-navigation.ts
  - src/dashboard/row-navigation.test.ts
  - src/dashboard/row-semantics.test.ts
  - src/dashboard/styles.css
  - src/dashboard/styles.test.ts
  - src/dashboard/views/list.ts
  - src/dashboard/views/overview.ts
  - src/dashboard/views/records.ts
findings:
  critical: 2
  warning: 8
  info: 0
  total: 10
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-08-13T20:30:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 20 converts `.activity-row` from a `<div>` + inner `.cta` anchor into a
whole-row `<a>`, and extracts the desktop `<tr>` click handler into a single
`attachRowNavigation` helper. The extraction itself is faithful (the moved
click body is byte-equivalent to the old `buildTableRow` body), the XSS
discipline holds (every athlete string still reaches the DOM via
`textContent`; hrefs are always `#`-prefixed so no `javascript:` scheme is
reachable), the column-count arithmetic in `records.ts` is correct (6 headers
/ 6 cells, 3 / 3), `npx tsc --noEmit` is clean, and the three named test files
pass (91 tests).

What the phase did **not** do is re-audit the two call sites that depended on
the old row shape. Converting the card row into an anchor silently broke a
shipped feature (`D-08` return-from-detail focus restoration) and silently
disabled a shipped accessibility affordance (Phase 18's `D-07` reachable
low-confidence explanation). Neither is covered by any test — the phase's own
test files are source-text guards that cannot observe DOM behaviour, and
`row-semantics.test.ts` says so explicitly.

Secondary concerns: the phase's own headline decision (`D-03`, "one definition
of the `#/activity/{id}` URL shape") is not actually true in the repository
after this phase; the new pure URL builder bypasses the repository's own
documented `isValidActivityId` chokepoint; and two of the new regression
guards are weaker than their own docstrings claim (a case-blind `tabindex`
guard whose subject files contain 6 occurrences of `tabIndex`, and a
first-wins `declarationsFor` read on a selector this phase made
double-declared — the exact `R3-WR-02` defect class `styles.test.ts` already
documents and fixed elsewhere).

Decisions D-01, D-02, D-10 and D-11 were checked as implemented and are NOT
reported as defects: `row-navigation.ts` genuinely registers no `keydown`
handler, sets no `tabindex`/`role`, and the pointer/hover treatment is
genuinely scoped to `.activity-table__row--navigable` (verified: the old
`.activity-table tbody tr` rules are deleted, and `attachRowNavigation` is
absent from `overview.ts`, `trends.ts`, `detail-sections.ts`).

## Critical Issues

### CR-01: Return-from-detail focus restoration is dead on the card layout

**Severity:** BLOCKER
**File:** `src/dashboard/views/list.ts:963-968` (with `list.ts:221-244`)

**Issue:** `highlightAndFocus` recovers the focusable element with
`el.querySelector('a')?.focus()`. That worked because `renderActivityRow`
used to append a `.cta` **descendant** anchor. This phase deleted that
descendant and made the row element itself the `<a>` (`list.ts:222`), so on
the card layout `el.querySelector('a')` now returns `null` and `?.focus()`
silently no-ops. The `?.` swallows the failure — no error, no test.

The path is live, not theoretical: `detail.ts:665` calls
`noteViewedActivity(detail.id)` on mount, and `applyReturnHighlight`
(`list.ts:977-996`) runs on every subsequent list mount. Below the 720px
breakpoint the table wrapper is `display: none`, so the card branch is the
*only* branch that can take focus — meaning D-08's "returning to the list
puts you back on the row you came from" is fully broken on mobile. The
`.activity-table__row--highlight` class is still added, so the row looks
restored while keyboard focus stays on the `<h1>`.

`row-semantics.test.ts:17-21` and `row-navigation.test.ts:9-15` both state
that nothing in this phase can observe DOM behaviour, so no green test
contradicts this.

**Fix:**
```ts
function highlightAndFocus(el: HTMLElement | undefined): void {
  if (!el) return;
  el.classList.add('activity-table__row--highlight');
  el.scrollIntoView({ block: 'center' });
  // The card row IS the anchor (renderActivityRow); the table row CONTAINS
  // one (buildTableRow's Activity cell). Handle both, or the card layout
  // silently loses focus restoration.
  const target = el instanceof HTMLAnchorElement ? el : el.querySelector('a');
  target?.focus();
}
```

### CR-02: The "Low confidence" explanation (D-07) is unreachable inside the whole-row link

**Severity:** BLOCKER
**File:** `src/dashboard/views/list.ts:221-244` (mechanism at `list.ts:159-175`, `182-200`)

**Issue:** `appendLowConfidenceBadge` exists specifically so the explanation
is reachable **without hovering** (its own docstring, `list.ts:150-158`,
18-UI-SPEC § 6 / D-07): a visible `.badge` with `title`, plus a sibling
`.sr-only` span wired via `aria-describedby`. `appendStatusBadges` appends
that pair straight into `rowEl` — which this phase turned into an `<a>`
carrying an overriding curated `aria-label` (`list.ts:226-229`). Two
concrete consequences, both new in this phase:

1. The row's accessible name is now entirely the curated label
   (`name, date, distance`). Every status badge — `No streams`,
   `Low confidence`, `Excluded from records`, `N PR` — is inside that link
   and is no longer part of anything announced when the link is reached.
   These are exactly this repository's "honesty" disclosures; a screen-reader
   user on the card layout now gets a row that claims a clean PR with no
   caveat attached. D-04 records the *decision* to curate the label; it does
   not record dropping the badges from the announcement.
2. The `aria-describedby` wiring is now inert on this surface. A description
   is announced when its *host* is announced; the host is a non-focusable
   `<span>` whose text has been subsumed by the ancestor link's `aria-label`,
   so the description has no announcement point at all. `title` (hover only)
   is what is left — which is precisely the failure D-07 was written to
   close.

Additionally, because both layouts render simultaneously, the same
`activity-${row.id}-low-confidence-desc` id is emitted twice per activity on
`#/list` (once from `buildTableRow`'s Status cell, once from the card), so
`aria-describedby` resolves to the copy inside the `display: none` table.
That duplication pre-dates this phase, but this phase is what removed the
one surface where the description still had a chance to be announced.

**Fix:** Do not bury the honesty badges inside the link's overridden name.
Either fold their text into the curated label, or move them out of the anchor:
```ts
export function renderActivityRow(row: DashboardIndexRow): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'activity-row';           // layout stays on the wrapper
  const link = document.createElement('a');     // link wraps name + meta only
  link.href = activityDetailHref(row.id);
  link.setAttribute('aria-label', `${row.name}, ${formatActivityDate(row.startDateLocal)}, ${distanceKm} km`);
  // …name + meta into `link`…
  wrapper.appendChild(link);
  appendStatusBadges(wrapper, row);             // badges stay announceable
  return wrapper;
}
```
If the whole-row link must stay, append the badge text to the `aria-label`
(`…, Low confidence, Excluded from records`) and make the `.sr-only`
description ids unique per surface (e.g. `card-${row.id}` vs `row-${row.id}`).

## Warnings

### WR-01: `activityDetailPath` neither validates nor encodes the activity id

**Severity:** WARNING
**File:** `src/dashboard/row-navigation.ts:43-50`

**Issue:** `router.ts:96-104` declares `isValidActivityId` "the single
exported chokepoint every fetch-URL builder and every DOM writer … must call
before using a route param (threat T-16-RT-01)", and `matchRoute`
(`router.ts:63-69`) decodes the captured segment with `decodeURIComponent`.
The new single definition of the outbound URL does neither: it interpolates
the raw string. The encode/decode pair is therefore asymmetric — an id
containing `%` produces a malformed escape that makes `decodeURIComponent`
throw, `matchRoute` returns `null`, and the click lands on the no-match
route; an id containing `/` or `?` silently changes the parsed path.

This is reachable because the ids are not validated at the source either:
`records.ts:95-106` parses `best-efforts.json` with an unchecked
`as T` cast, so `PrTableRow.activityId` is `string` only by declaration.
`activityDetailPath('')` yields `#/activity/`, which `parseHash` normalizes to
`/activity` (segment-count mismatch) — a silent dead link. The unit tests
(`row-navigation.test.ts:19-47`) exercise only well-formed ids, so none of
these shapes are covered.

**Fix:**
```ts
export function activityDetailPath(activityId: string): string {
  return `/activity/${encodeURIComponent(activityId)}`;
}
```
and add cases for `''`, `'a/b'` and `'50%'` to `row-navigation.test.ts`.

### WR-02: D-03's "only definition of the `#/activity/{id}` URL shape" is not true

**Severity:** WARNING
**File:** `src/dashboard/row-navigation.ts:2-3` (violations at `src/dashboard/views/detail.ts:221`, `:228`, `src/dashboard/views/calendar.ts:156`)

**Issue:** The module header claims to be "the D-03 single definition of …
the `#/activity/{id}` URL shape", and `row-semantics.test.ts:127-133` asserts
the literal is absent from list/overview/records. But after this phase the
repository still contains two other constructions of the same URL:

- `detail.ts:221` / `detail.ts:228`: `link.href = \`#/activity/${newer.id}\``
- `calendar.ts:156`: `navigateTo(ROUTES.DETAIL.replace(':id', cell.activityIds[0]))`

`row-semantics.test.ts:128-129` waives `detail.ts` as "deliberately out of
this phase's scope" and never mentions `calendar.ts` at all — so the guard
protects three files while three drift sites remain unguarded. Any fix to
WR-01 (encoding) lands in one of four places and leaves the other three
broken, which is exactly the failure mode D-03 exists to prevent.

**Fix:** Point the remaining sites at the shared helper and widen the guard:
```ts
// detail.ts
import { activityDetailHref } from '../row-navigation.js';
link.href = activityDetailHref(newer.id);

// calendar.ts
navigateTo(activityDetailPath(cell.activityIds[0]));
```
then extend `row-semantics.test.ts` to assert zero `'#/activity/'` and zero
`ROUTES.DETAIL.replace(` occurrences across `src/dashboard/views/`.

### WR-03: Row click ignores modifier keys and fires on text selection

**Severity:** WARNING
**File:** `src/dashboard/row-navigation.ts:58-68`

**Issue:** The handler navigates on *any* click whose target is not inside an
anchor. It never checks `event.ctrlKey`/`metaKey`/`shiftKey`/`altKey`, and it
never checks whether the click concluded a text selection. Consequences on a
surface this phase deliberately advertises as a link (pointer cursor + hover
feedback):

- Cmd/Ctrl-clicking anywhere on a row except the one anchor navigates the
  **current** tab instead of opening a new one. The in-cell anchor behaves
  correctly, so the same row behaves two different ways depending on which
  pixel was hit.
- Selecting a row's text (mousedown, drag, mouseup inside the row) dispatches
  a `click` and navigates away, destroying the selection.
- Shift-click likewise navigates instead of opening a window.

Phase 20 did not introduce the omission — it moved it — but it did multiply
the blast radius from one table to three (`list.ts:363`, `records.ts:419`,
`records.ts:532`), and this is now the single place a fix would land.

**Fix:**
```ts
rowEl.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).closest('a')) return;
  // Let the browser's own link affordances win: new tab / new window.
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  // Do not swallow a text selection that merely ended inside the row.
  if ((window.getSelection()?.toString().length ?? 0) > 0) return;
  navigateTo(activityDetailPath(activityId));
});
```

### WR-04: The new hover rules override the return-highlight on the card layout

**Severity:** WARNING
**File:** `src/dashboard/styles.css:1537-1539` (interacting with `styles.css:529-532`)

**Issue:** `.activity-table__row--highlight` (specificity `0,1,0`) is the
D-08 "you just arrived here" marker. This phase adds
`.activity-row:hover` (`0,1,1`) and `.activity-table__row--navigable:hover`
(`0,1,1`), both of which beat it and both of which set `background`.

For the card layout this is a new regression: before this phase `.activity-row`
had no `:hover` rule at all, so the accent highlight survived under the
pointer. Now the highlight is invisible in exactly the situation that produces
it — the user has just clicked "back" and the pointer is resting on the row
that is being highlighted. (The `<tr>` case is unchanged: the deleted
`.activity-table tbody tr:hover` was already `0,1,2`.)

The four new Phase 20 assertions in `styles.test.ts:1090-1112` check each rule
in isolation and cannot see the interaction.

**Fix:** Exclude the highlighted row from the hover treatment, e.g.
```css
.activity-row:not(.activity-table__row--highlight):hover,
.activity-table__row--navigable:not(.activity-table__row--highlight):hover {
  background: color-mix(in srgb, var(--surface) 92%, var(--text));
}
```
and add a `styles.test.ts` assertion pinning the exclusion.

### WR-05: The D-01 `tabindex` guard is case-blind and cannot catch the idiomatic regression

**Severity:** WARNING
**File:** `src/dashboard/row-semantics.test.ts:157-162`

**Issue:** The test asserts "comment-stripped list.ts, records.ts and
row-navigation.ts each contain zero occurrences of `tabindex`" and is
described as the guard that keeps a later agent from putting fake link
semantics on a `<tr>`. `countOccurrences` is a case-sensitive
`String.split`, and both subject files already set tab order the DOM-property
way: `list.ts:1142` (`heading.tabIndex = -1`) and `records.ts:248, 465, 602,
679, 797` — six occurrences of `tabIndex` that the assertion is structurally
unable to see. The green result therefore proves nothing about the property
form, and a future `tr.tabIndex = 0` — written in the exact style the rest of
both files already use — keeps the suite green.

The sibling `role` assertion (`row-semantics.test.ts:164-171`) has the same
shape of hole: it matches only `role="link"` and `'role', 'link'`, so
`setAttribute("role", "link")` (double quotes) and `el.role = 'link'` both
pass. This is the "guard documented as closing a hole that it does not close"
failure mode `styles.test.ts:618-626` already records for Round 4.

**Fix:** Normalize case and cover the property form:
```ts
function countOccurrencesCI(haystack: string, needle: string): number {
  return countOccurrences(haystack.toLowerCase(), needle.toLowerCase());
}
expect(countOccurrencesCI(listStripped, 'tabindex')).toBe(1);   // the <h1> only
expect(countOccurrencesCI(recordsStripped, 'tabindex')).toBe(5); // headings only
// and assert no tabindex is set on a variable named `tr`/`rowEl`:
expect(/\b(tr|rowEl)\.tabIndex\b/i.test(listStripped)).toBe(false);
```
plus a case-insensitive `role` check accepting either quote style.

### WR-06: New stylesheet assertions use the first-wins helper on a now-double-declared selector

**Severity:** WARNING
**File:** `src/dashboard/styles.test.ts:1090-1112`

**Issue:** `styles.test.ts:586-600` records R3-WR-02: `declarationsFor` is
first-match and not cascade-aware, which is why `bodyForSelectorListToken`
was made last-wins. This phase then added
`declarationsFor('.activity-row')` at line 1091 — and this phase is precisely
what made `.activity-row` declared **twice** (`styles.css:338` and
`styles.css:1530`). The assertion reads the first rule only. Appending
`.activity-row { display: inline; }` to the end of the stylesheet destroys
the layout of every card row (the comment at `styles.css:335-337` calls
`display: flex` "load-bearing") while this test stays green — the exact
mutation class the file's own audit says was closed.

The same helper choice is used for `.activity-row:hover`,
`.activity-table__row--navigable` and `.activity-table__row--navigable:hover`
(lines 1099, 1105, 1109), all of which are also unguarded against at-rule
nesting, unlike `bodyForSelectorListToken`.

**Fix:** Use the hardened helper for the new assertions:
```ts
expect(bodyForSelectorListToken('.activity-row')).toContain('display: flex');
```
Note this requires merging the two `.activity-row` rules (or moving
`display: flex` into the Phase 20 block), which is the honest resolution:
one selector, one rule, one cascade winner.

### WR-07: `tr.dataset.activityId` is written and never read

**Severity:** WARNING
**File:** `src/dashboard/views/list.ts:362`

**Issue:** `tr.dataset.activityId = row.id` is the only writer in the
dashboard; a repository-wide search finds no reader (the only other
`data-activity-id` usage is the unrelated `single-run-map` widget). It is dead
state that a reader will reasonably assume is the mechanism behind row
navigation or the return highlight — neither is true. `applyReturnHighlight`
(`list.ts:992-993`) instead relies on positional alignment between
`pageItems` and `querySelectorAll('tbody tr')`, which is a stricter coupling
than the data attribute it already has available.

**Fix:** Either delete line 362, or use it and drop the positional
assumption:
```ts
const tr = tableWrapper.querySelector<HTMLElement>(
  `tbody tr[data-activity-id="${CSS.escape(id)}"]`
) ?? undefined;
```

### WR-08: `buildTableRow`'s D-01 docstring contradicts the code it documents

**Severity:** WARNING
**File:** `src/dashboard/views/list.ts:352-354`

**Issue:** The docstring says "on the div rows (`renderActivityRow`,
`renderRecentPrRow`) it is satisfied literally, because those rows are
themselves anchors." Those two functions no longer produce div rows — this
phase changed them to `<a>` (`list.ts:222`, `overview.ts:90`), and
`styles.css:335-337` documents that change explicitly. In a repository where
these header comments are the primary carrier of decision rationale and are
load-bearing for the source-text guards, a comment that names the wrong
element type is a real defect: the next reader either "fixes" the anchors
back to divs or distrusts the surrounding rationale.

**Fix:** Replace "the div rows" with "the card rows", or state the shape
directly: "on the card rows (`renderActivityRow`, `renderRecentPrRow`), which
this phase made `<a>` elements, it is satisfied literally."

---

_Reviewed: 2026-08-13T20:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
