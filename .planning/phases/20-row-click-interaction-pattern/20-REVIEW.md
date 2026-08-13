---
phase: 20-row-click-interaction-pattern
reviewed: 2026-08-13T22:10:00Z
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
  warning: 7
  info: 8
  total: 16
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-08-13T22:10:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Round 2 review of the row-click interaction pattern, after plans 20-06 (CR-01) and
20-07 (CR-02) landed. Both prior BLOCKERs were re-verified from source rather than
taken on trust:

- **CR-01 (`highlightAndFocus`) — verified fixed and correct.** The
  `el.tagName === 'A'` branch (`list.ts:1101`) is right for both row shapes:
  `document.createElement('a').tagName` is `'A'` in an HTML document, so the card
  focuses itself and a `<tr>` still delegates to its Activity-cell anchor. The
  double-call in `applyReturnHighlight` (`list.ts:1129-1130`) is also safe in both
  breakpoints, because `styles.css:534` / `styles.css:546` put the non-active layout
  behind `display: none`, and `focus()`/`scrollIntoView()` on a boxless element are
  no-ops. The `tagName` over `instanceof HTMLAnchorElement` deviation is correctly
  justified for `environment: 'node'`.
- **CR-02 (accessible-name composition) — verified fixed and correct, including
  `idPrefix` uniqueness.** Traced every `appendStatusBadges` / `appendLowConfidenceBadge`
  call site in the repo (`list.ts:345`, `list.ts:503`, `records.ts:412`,
  `detail-sections.ts:346`). The pre-fix shared `activity-${row.id}` prefix genuinely
  did collide on `#/list` (both layouts render simultaneously); `activity-card-` /
  `activity-table-` resolves it, and no third surface renders `renderActivityRow` and
  `buildTableRow` for the same row at once. `statusBadgeTexts` cannot produce a
  low-confidence text without `appendLowConfidenceBadge` also creating the referenced
  `.sr-only` span, so the row-level `aria-describedby` can never dangle.

What the fixes did **not** close, and what this round found independently, is below.
The one BLOCKER is in the shared helper both fixes build on: `attachRowNavigation`
navigates on modifier-clicks and on click-to-select, which is newly load-bearing
because plan 20-03 deleted the `.cta` "View Activity" anchor column from both Records
PR tables. Four of the seven warnings are false-green test guards, two of them proven
false by executed mutation.

## Critical Issues

### CR-01: `attachRowNavigation` hijacks modifier-clicks and click-to-select, breaking the link contract on every navigable row

**File:** `src/dashboard/row-navigation.ts:60-67`

**Issue:** The row-level `click` listener calls `navigateTo()` for *any* click whose
target is not inside an anchor. It inspects neither the mouse button, nor the modifier
keys, nor the current text selection. Three concrete failures:

1. **Cmd/Ctrl+click navigates in the current tab.** A user Cmd+clicking a row cell to
   open the activity in a background tab instead loses their place: `click` still
   fires with `metaKey: true`, `closest('a')` is `null` for a `<td>`, and
   `navigateTo()` assigns `window.location.hash` (`router.ts:176`). Shift+click
   (new window) and Alt+click (download) fail the same way.
2. **Middle-click does nothing at all.** Modern browsers fire `auxclick`, not `click`,
   for the middle button, so the row's only "open in new tab" path is the one anchor
   the row happens to contain — the Activity cell on `#/list`, the Date cell on
   `#/records`. Every other cell in the row is a dead zone for the one gesture users
   reach for on link-shaped things.
3. **Selecting text inside a row navigates away.** Drag-selecting a pace or a date in
   a `<td>` ends in a `mouseup` that fires `click` on the row, discarding the
   selection and leaving the page.

This is not a pre-existing defect carried over unchanged. Plan 20-03 (`670e368`)
removed the `.cta` "View Activity" anchor column from `buildPrTable` and added
`attachRowNavigation(tr, row.activityId)` in its place, and plan 20-03 (`d0ab680`)
did the same for `buildProgressionTable`. On the Records PR tables, five of six cells
are now row-click-only, and `.activity-table__row--navigable { cursor: pointer }`
(`styles.css:1544`) actively advertises them as clickable. The phase's own D-06
rationale is that these rows should read as links; a row that ignores every link
modifier does not.

**Fix:**

```ts
export function attachRowNavigation(rowEl: HTMLElement, activityId: string): void {
  rowEl.classList.add(NAVIGABLE_ROW_CLASS);
  rowEl.addEventListener('click', (event) => {
    // The row's own in-cell anchor already navigates on its own; do not
    // double-navigate when the click originated from it.
    if ((event.target as HTMLElement).closest('a')) {
      return;
    }
    // A row is a link affordance, so it must honour the link contract: let the
    // browser own modified clicks (new tab / new window / download) and any
    // non-primary button rather than swallowing them into a same-tab hash change.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    // A drag-select that ends inside the row must not be destroyed by navigation.
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().length > 0) {
      return;
    }
    navigateTo(activityDetailPath(activityId));
  });
}
```

Note that fixing (2) properly also needs an `auxclick` path, or acceptance that
middle-click is anchor-only — either is fine, but it should be a recorded decision
(the D-02 precedent in this module's header is the right shape for it) rather than an
unexamined gap. Whichever is chosen, `row-navigation.test.ts` currently proves none of
this (see WR-06).

## Warnings

### WR-01: `notedActivityId` survives three of the four list render paths, so the one-shot return highlight fires on an unrelated later navigation

**File:** `src/dashboard/views/list.ts:1112-1131`, `src/dashboard/views/list.ts:1293-1325`

**Issue:** `applyReturnHighlight` is the only writer that clears `notedActivityId`, and
`mount()` calls it in exactly one branch — the non-empty, non-stale, non-error one
(`list.ts:1322-1324`). The id is therefore retained when:

- the filtered set is empty (`list.ts:1293-1299` returns before the `else` branch);
- `indexClient.loadIndex()` rejects (`list.ts:1239-1259` early-returns);
- the stale-container guard trips (`list.ts:1322`).

`applyReturnHighlight`'s own JSDoc claims it "Clears the noted id unconditionally so a
later navigation to the list does not re-highlight" — that claim is false for all three
paths above. Concretely: view activity A, return to `#/list` with a filter that matches
nothing, clear the filter or navigate away and back, and row A is scrolled to, tinted,
and given focus with no user action implying a return.

The blast radius grew with the CR-01 fix. Before 20-06, `highlightAndFocus` silently
no-opped on the card layout, so the stale-id path could only tint a desktop row.
Post-fix it steals focus and scrolls on the mobile card layout too. Compounding it,
`detail.ts:665` calls `noteViewedActivity` on every detail mount, so the hint is set by
*any* detail visit, not only ones the user navigates back from — detail → overview →
list also triggers the "return" behaviour.

**Fix:** make the clear unconditional and independent of render outcome. Either clear it
at the top of `mount()` into a local, or split the read:

```ts
function takeNotedActivityId(): string | null {
  const id = notedActivityId;
  notedActivityId = null;
  return id;
}
```

and call `takeNotedActivityId()` once early in `mount()` (before the empty/error
branches diverge), passing the result down to `applyReturnHighlight`.

### WR-02: the D-01 source guards are case-blind and stay green under the exact mutation they exist to catch

**File:** `src/dashboard/row-semantics.test.ts:158-171`

**Issue:** `countOccurrences` is `haystack.split(needle).length - 1` — case-sensitive.
The guards search for the lowercase attribute spellings `'tabindex'` and `'role="link"'`,
but this codebase sets both through DOM *properties*: `heading.tabIndex = -1`
(`list.ts:1277`, `records.ts:248/465/602/679`). Executed proof against the real,
comment-stripped sources:

```
src/dashboard/views/list.ts     lowercase tabindex: 0 | camelCase tabIndex: 1
src/dashboard/views/records.ts  lowercase tabindex: 0 | camelCase tabIndex: 5
```

So the assertion "comment-stripped list.ts, records.ts and row-navigation.ts each
contain zero occurrences of tabindex" is already vacuously true while `tabIndex` is
used five times in one of the files it names. Appending the defect D-01 exists to
prevent leaves every guard at zero:

```
after appending `tr.tabIndex = 0;` and `tr.role = "link";` to list.ts:
  tabindex count = 0 , role="link" count = 0 , 'role', 'link' count = 0
```

A future agent adding `tr.tabIndex = 0` and `tr.role = 'link'` to `buildTableRow` —
the precise regression D-01 was written to block — ships with a green suite.

**Fix:** lowercase both sides before counting, and cover the property spellings:

```ts
function countOccurrencesCaseInsensitive(haystack: string, needle: string): number {
  return haystack.toLowerCase().split(needle.toLowerCase()).length - 1;
}

// D-01: no tabindex ANYWHERE on a row element, in any spelling.
for (const [name, src] of [['list.ts', listStripped], ['records.ts', recordsStripped]] as const) {
  const hits = [...src.matchAll(/tabindex|\.tabIndex\s*=|\.role\s*=|['"]role['"]\s*,\s*['"]link['"]/gi)]
    .map((m) => m[0]);
  // headings legitimately set tabIndex = -1; assert on the ROW identifiers only
  expect(hits.filter((h) => /role/i.test(h)), name).toEqual([]);
}
```

At minimum, the `tabindex` guards must be case-insensitive and must exclude the
heading call sites explicitly rather than by accident of casing.

### WR-03: the Phase 20 stylesheet assertions use the first-wins `declarationsFor` helper, reintroducing the documented R3-WR-02 cascade blind spot

**File:** `src/dashboard/styles.test.ts:1090-1112`

**Issue:** Four of the eight Phase 20 CSS assertions read through `declarationsFor`,
which returns the **first** matching rule (`styles.test.ts:42-50`). This file's own
600-line helper audit records that first-wins was a proven false-green mechanism and
that `bodyForSelectorListToken` was rewritten to last-wins for exactly that reason
(R3-WR-02, `styles.test.ts:586-600`). `declarationsFor` was left first-wins, and the
new Phase 20 block uses it anyway. Executed mutation, appending later cascade-winning
overrides to the real stylesheet:

```
appended: .activity-row { display: block }
          .activity-table__row--navigable { cursor: default }
          .activity-row:hover { background: red }
          .activity-table__row--navigable:hover { background: red }

display:flex still asserted?            true
cursor:pointer still asserted?          true
row hover color-mix still asserted?     true
navigable hover color-mix still asserted? true
```

All four Phase 20 assertions stay green while the rules they guard are dead. This
matters most for `.activity-row { display: flex }`, whose own source comment
(`styles.css:335-337`) calls it "load-bearing" now that the row is an inline-by-default
anchor — cancel it and the mobile card layout collapses, silently.

**Fix:** switch all four to `bodyForSelectorListToken`, which is last-wins and
selector-boundary-anchored:

```ts
it('.activity-row keeps display: flex - load-bearing now that it is an <a>', () => {
  expect(bodyForSelectorListToken('.activity-row')).toContain('display: flex');
});
```

Note that `.activity-row` is declared twice (`styles.css:338`, `styles.css:1530`), so
last-wins would resolve to the second body; the `display: flex` declaration should be
consolidated into one rule, or the assertion should scan both bodies explicitly.

### WR-04: the mobile card list is `display: block`, so the `gap` the Phase 20 focus-ring rationale depends on does not exist on the one surface CR-01 made focusable

**File:** `src/dashboard/styles.css:550-552`, rationale at `src/dashboard/styles.css:1485-1496`

**Issue:** The Phase 20 banner justifies having no row-specific focus ring with:
"`.activity-list`'s `gap: var(--space-sm)` (8px) leaves room for the ring's 4px spread".
That is true for `.activity-list` (`styles.css:329-333`, `display: flex`), and false for
`.activity-list--cards`, which the 720px media query switches to `display: block`
(`styles.css:550-552`). `gap` applies only to flex, grid and multi-column containers —
under `display: block` it is inert, so the mobile card rows stack with zero separation.

That is precisely the layout `renderActivityRow` produces, precisely the element the
CR-01 fix now calls `.focus()` on, and precisely the breakpoint where the card is the
*only* focusable row shape. The global `:focus-visible` ring is
`0 0 0 2px var(--bg), 0 0 0 4px var(--accent)` (`styles.test.ts:808`), so the outer
4px spread overlaps the adjacent row's 1px border with no clearance.

**Fix:** keep the card list a flex column so the gap survives the breakpoint:

```css
@media (max-width: 720px) {
  .activity-list--cards {
    display: flex;
  }
}
```

(`.activity-list` already supplies `flex-direction: column` and `gap: var(--space-sm)`.)
Then correct the banner comment, which currently states a clearance guarantee the
stylesheet does not provide.

### WR-05: `appendStatusBadges` dispatches on badge string equality, and the `idPrefix` uniqueness contract is documentation-only

**File:** `src/dashboard/views/list.ts:249-257`; call sites `list.ts:345`, `list.ts:503`, `records.ts:412`, `detail-sections.ts:346`

**Issue:** Two coupled fragilities introduced by the CR-02 refactor:

1. `appendStatusBadges` decides which DOM builder to use by comparing the badge *text*
   to `LOW_CONFIDENCE_BADGE_TEXT`. Badge text and badge DOM shape are now bound by
   string identity: any future badge whose text collides, or any localisation of the
   badge string that misses one of the two constants, silently downgrades the
   accessible low-confidence badge to a plain `.badge` with no `title`, no `.sr-only`
   explanation, and a dangling row-level `aria-describedby` in `renderActivityRow`
   (`list.ts:331-333`).
2. The `idPrefix` uniqueness rule that CR-02 exists to enforce lives entirely in a
   JSDoc paragraph (`list.ts:242-247`). Four call sites hand-roll four different
   conventions — `activity-card-${row.id}`, `activity-table-${row.id}`,
   `pr-${distance}-${row.activityId}`, `best-efforts-${row.distance}` — with no shared
   builder, no test, and no runtime assertion. `row-semantics.test.ts:249-258` only
   counts that two template literals appear once each; it cannot detect a *third*
   surface reusing one, which is exactly how the original collision was introduced.

**Fix:** make the shape discriminated rather than string-matched, and centralise prefix
construction:

```ts
type StatusBadge =
  | { kind: 'plain'; text: string }
  | { kind: 'low-confidence'; text: typeof LOW_CONFIDENCE_BADGE_TEXT };

export function statusBadges(row: DashboardIndexRow): StatusBadge[] { /* ... */ }
export function statusBadgeTexts(row: DashboardIndexRow): string[] {
  return statusBadges(row).map((b) => b.text);
}

/** The only sanctioned way to build a badge id prefix. Surface is a closed union. */
export type BadgeSurface = 'activity-card' | 'activity-table' | 'pr' | 'best-efforts';
export function badgeIdPrefix(surface: BadgeSurface, ...parts: string[]): string {
  return [surface, ...parts].join('-');
}
```

Then `appendStatusBadges` switches on `badge.kind`, and a single test can assert the
full set of prefixes produced for one row across all surfaces is distinct.

### WR-06: `attachRowNavigation` — the riskiest code in the phase — has zero automated coverage, and the "no DOM available" premise is a dependency choice, not a constraint

**File:** `src/dashboard/row-navigation.test.ts:9-15`, `src/dashboard/row-semantics.test.ts:14-21`

**Issue:** Both test files state honestly that they prove nothing about `attachRowNavigation`.
That honesty is good; the resulting coverage is not. The `closest('a')` double-navigation
guard (`row-navigation.ts:63-65`) is the single line whose failure produces the worst
outcome in this phase — a double hash write on every anchor click — and nothing anywhere
exercises it. `row-semantics.test.ts` substitutes substring counting, which WR-02 above
shows can be defeated by a change in letter case.

The stated reason — "this repository has no jsdom and no headless browser anywhere in
it" (`row-navigation.ts:28-31`) — is a devDependency fact, not a platform limit.
`vitest.config.ts` already pins `environment: 'node'`; vitest supports a per-file
`// @vitest-environment happy-dom` pragma, and `happy-dom` is a single dev dependency.
Both prior BLOCKERs in this phase were DOM-behaviour defects that a source-text guard
could not see; CR-01 above is a third.

**Fix:** add `happy-dom` as a devDependency and a DOM-scoped test for the helper:

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
```

with sibling cases for the plain-cell click, each modifier key (CR-01), and a
non-collapsed selection.

### WR-07: the same activity announces two different accessible names on the same page, and the table anchor drops its badges for keyboard link navigation

**File:** `src/dashboard/views/list.ts:290-294` vs `src/dashboard/views/list.ts:479-482`

**Issue:** `#/list` renders both layouts into the DOM simultaneously — only CSS hides one
(`list.ts:1301-1307`, `styles.css:534/546`). Post-CR-02, the card anchor announces
`"<name>, <date>, <km>, No HR, Excluded from records, 2 PR"` while the table anchor for
the identical row announces `"<name>, <date>, <km>"`. `records.ts:403-406` uses a third,
date-first shape. D-04's stated rationale — that a row's label "must match what the same
activity announces elsewhere" — is now satisfied within a surface and violated across them.

The justification given for not folding badges into the table anchor
(`list.ts:283-288`: badges "live in a sibling `<td>` … and are already announced by
table navigation") holds only in a screen reader's table-browse mode. In the other
common mode — Tab through focusables, or a links list — the anchor is the only thing
announced, and the Status column's "Low confidence" / "Excluded from records" / "N PR"
text is never reached. The `aria-describedby` wired onto the badge span
(`list.ts:193`) does not help either, since the badge span itself is never focused.
Nothing in the suite pins this divergence, so it cannot regress loudly.

**Fix:** decide explicitly, and encode the decision. Either fold the badges into
`buildTableRow`'s anchor too (reusing `composeRowAriaLabel(base, statusBadgeTexts(row))`,
accepting the double-announcement in table-browse mode), or add a `.sr-only` span inside
the Activity cell carrying the badge texts, so links-mode users get them without the
table-mode duplication:

```ts
anchor.setAttribute('aria-label', activityRowAriaLabel(row)); // one shared label builder
```

Either way, add a test asserting `activityRowAriaLabel(row)` is the label used on *both*
list surfaces, so the two cannot drift again. Plan 20-08's VoiceOver checkpoint should
arbitrate which mode wins, but the current state — one surface fixed, its sibling not,
with no guard — is the same drift CR-02 was raised for.

## Info

### IN-01: `LOW_CONFIDENCE_BADGE_TEXT` is exported with no external consumer

**File:** `src/dashboard/views/list.ts:155`
**Issue:** A repo-wide grep finds references only inside `list.ts` itself (lines 191,
222, 251). No other module and no test imports it.
**Fix:** drop the `export`, or add the test that asserts badge text and label text agree
through it.

### IN-02: `recentPrRowAriaLabel` unconditionally appends a PR badge, producing "0 PR" for a zero-PR row

**File:** `src/dashboard/views/overview.ts:101-105`
**Issue:** `composeRowAriaLabel(base, [recentPrBadgeText(row)])` hardcodes a one-element
array. The only caller filters on `prCount > 0` (`overview.ts:176`), but the function is
exported and its sibling `statusBadgeTexts` guards the same condition
(`list.ts:229-231`), so the asymmetry is a trap for the next caller.
**Fix:** `composeRowAriaLabel(base, row.prCount > 0 ? [recentPrBadgeText(row)] : [])`.

### IN-03: `highlightAndFocus` applies a table-namespaced BEM class to a non-table card element

**File:** `src/dashboard/views/list.ts:1099`
**Issue:** `activity-table__row--highlight` is added to both the `<tr>` and the
`.activity-row` card anchor. The class name asserts a block (`activity-table`) the card
is not part of, which is why `styles.css:528` sits in the table section of the
stylesheet while styling a card.
**Fix:** rename to a surface-neutral `row--highlight` (or `activity-row--highlight`) and
update `styles.css:528`.

### IN-04: `stripComments` is exported from a test file and mangles `//` inside non-`:`-prefixed literals

**File:** `src/dashboard/row-semantics.test.ts:51-54`
**Issue:** The `(?<!:)\/\/.*$` rule strips any `//` not directly preceded by `:` — a
string literal like `'a//b'`, a regex literal, or a protocol-relative `'//cdn/x'` would
be truncated, silently changing what downstream assertions count. The `export` keyword
on a helper inside a `.test.ts` file also has no consumer.
**Fix:** drop the `export`; if the helper grows further, move it to a shared
`test-utils.ts` with its own self-tests for literal-safety.

### IN-05: `row-semantics.test.ts` hard-codes occurrence counts for three files outside this phase

**File:** `src/dashboard/row-semantics.test.ts:99-111`
**Issue:** `detailCount).toBe(4)`, `trendsCount).toBe(1)`, `detailMapCount).toBe(1)` pin
`.cta` counts in `detail.ts`, `trends.ts` and `detail-map.ts`. A future phase adding a
legitimate CTA to any of those files fails a Phase 20 test for an unrelated reason.
**Fix:** assert the two facts this phase owns (`listCount === 0`, `recordsCount === 1`)
and replace the rest with a total-and-per-file snapshot comment, or move the
cross-file `.cta` inventory into its own clearly-labelled suite.

### IN-06: the `overview.ts` `aria-label` count guard breaks on any unrelated future label

**File:** `src/dashboard/row-semantics.test.ts:229-247`
**Issue:** `expect(countOccurrences(overviewStripped, 'aria-label')).toBe(1)` fails the
moment overview gains a second, entirely legitimate `aria-label` (a landmark, a stat
card, a chart). The intent — "no raw inline label template literal survives" — is better
expressed directly.
**Fix:** assert the absence of the raw shape instead:
`expect(overviewStripped).not.toMatch(/setAttribute\(\s*'aria-label'\s*,\s*`/)` on the
row builder, alongside the existing `recentPrRowAriaLabel` count.

### IN-07: `formatActivityDate` returns an em dash for any offset-suffixed ISO timestamp

**File:** `src/dashboard/views/list.ts:61-67`
**Issue:** The normaliser appends `Z` whenever the string does not already end in `Z`,
so `2024-01-15T09:00:00+02:00` becomes `...+02:00Z`, an invalid date, rendered as `—`.
The archive currently carries only the two documented shapes, but the guard is
shape-blind rather than shape-aware, so a third producer degrades silently to an em dash
across list, overview, records and detail at once.
**Fix:** only append `Z` when the string has no timezone designator at all:
`const hasTz = /(?:Z|[+-]\d{2}:?\d{2})$/.test(isoLocal);`

### IN-08: `attachRowNavigation` is called at inconsistent points relative to cell construction

**File:** `src/dashboard/views/list.ts:467` vs `src/dashboard/views/records.ts:419` and `src/dashboard/views/records.ts:532`
**Issue:** `list.ts` wires the row before appending any cells; `records.ts` wires it after.
Behaviourally identical today (both happen before insertion into the document), but it
reads as if ordering matters somewhere and it does not.
**Fix:** pick one position — immediately after `document.createElement('tr')` reads best,
since it pairs the element with its behaviour — and apply it at all three call sites.

---

_Reviewed: 2026-08-13T22:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
