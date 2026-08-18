---
phase: 20-row-click-interaction-pattern
reviewed: 2026-08-18T04:33:54Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/dashboard/row-navigation.ts
  - src/dashboard/row-navigation.test.ts
  - src/dashboard/row-semantics.test.ts
  - src/dashboard/styles.css
  - src/dashboard/styles.test.ts
  - src/dashboard/views/list.ts
  - src/dashboard/views/list.test.ts
  - src/dashboard/views/overview.ts
  - src/dashboard/views/overview.test.ts
  - src/dashboard/views/records.ts
findings:
  critical: 1
  warning: 0
  info: 3
  total: 4
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-08-18T04:33:54Z
**Depth:** standard
**Files Reviewed:** 9 (10 listed; `records.ts` has no matching `.test.ts` pair reviewed separately — its logic is exercised by `records-logic.test.ts`, out of this phase's file list)
**Status:** issues_found

## Summary

This is a re-review of the current state of the row-click interaction pattern
(`row-navigation.ts`, its two test files, `styles.css`/`styles.test.ts`, and the
three view files that consume it). The prior round's CR-01/CR-02/WR-01..WR-05
findings are all closed in the current source — verified directly, not assumed:
`shouldNavigateOnRowClick` now carries the full D-12/D-14 link-contract
predicate with dedicated node-environment tests, `rowSemanticViolations` is
spelling- and receiver-agnostic (closing the old WR-01/WR-02 vacuous guards),
and the CSS assertions are cascade-aware (`cascadeWinningBodyDeclaring` /
`assertNoAtRuleOverride`, closing WR-03).

A defect from this phase's own Round 4 checkpoint (GAP 12, `20-VALIDATION.md`)
is known and deliberately unpatched — real `<a href>` cell anchors in the
Records PR table bypass both the drag-select guard and the double-click guard,
because those guards live only in the row-level listener. That is not
reported again here.

This review's one new finding is a distinct, additional consequence of the
same D-13 architectural choice (giving every PR-table cell a real anchor) that
the Round 4 checkpoint did not name: five of six anchors in every Records
PR-table row (and two of three in every progression-table row) carry an
explicit `aria-label` that is **identical across every cell in the row** and
describes the Date cell's content (date/distance/duration) rather than the
cell's own content (rank, time, pace, age-grade%, or flags). Per the ARIA
accessible-name computation order, an explicit `aria-label` always wins over
subtree text — this is a spec-level fact provable without a live DOM, not a
"needs a browser to know" question the way rendering/paint-order findings in
this codebase's history have been. A screen reader user browsing the table
(virtual cursor / "next link", which does reach `tabIndex="-1"` elements —
`tabindex` only removes an element from sequential Tab order, not from the
accessibility tree) hears the same phrase six times in a row with no
indication of which cell they are on, and the Flags cell's own badge text
("Low confidence", "Excluded — …") is completely unannounced.

## Critical Issues

### CR-01: Records PR-table and progression-table cell anchors share one identical `aria-label` across every cell in a row, misrepresenting (or discarding) the cell's actual content to assistive tech

**File:** `src/dashboard/views/records.ts:361-368` (`buildCellLink`), `418-475` (`buildPrTable` row loop), `572-593` (`buildProgressionTable` row loop)

**Issue:** `buildCellLink(activityId, ariaLabel)` sets an explicit `aria-label` on every non-Date cell anchor it builds. In both `buildPrTable` and `buildProgressionTable`, every call site in a row passes the exact same `curatedLabel` string — the Date cell's own three-part label (`formatActivityDate(row.startDate)`, distance label, `formatEffortDuration(row.durationSec)`):

```ts
// records.ts:418
const curatedLabel = `${formatActivityDate(row.startDate)}, ${DISTANCE_LABELS[distance]}, ${formatEffortDuration(row.durationSec)}`;

// records.ts:422, 429, 436, 443, 458 — Rank, Time, Pace, Age-Grade, Flags
const rankLink = buildCellLink(row.activityId, curatedLabel);
const timeLink = buildCellLink(row.activityId, curatedLabel);
const paceLink = buildCellLink(row.activityId, curatedLabel);
const ageLink  = buildCellLink(row.activityId, curatedLabel);
const flagsAnchor = buildCellLink(row.activityId, curatedLabel);
```

Per the WAI-ARIA accessible-name computation algorithm, an element's explicit
`aria-label` is used as its accessible name unconditionally — the algorithm
never falls through to "name from content" when `aria-label` is non-empty.
This holds regardless of the element's `tabIndex`: `tabIndex="-1"` removes an
element from *sequential keyboard navigation* only, it does not remove it from
the accessibility tree or from a screen reader's browse-mode/virtual-cursor
traversal (which is how these `tabIndex="-1"` anchors are reachable at all,
since they're deliberately unreachable by Tab per D-13). The practical result,
provable from the ARIA spec alone (no rendered-browser observation required):

- A screen reader user linearly navigating (or using a "list all links"
  command) through one PR-table row hears the *same string* — e.g. "Jan 15,
  2024, 5K, 19:39, link" — six times in a row (Rank, Time, Pace, Age-Grade,
  Date, and, if present, Flags), with nothing distinguishing which cell they
  landed on. The actual rank (`#1`), pace, or age-grade% is never announced,
  even though it is the anchor's own visible text content.
- For the Flags cell specifically, this also *discards* the flag badge text
  entirely: `appendLowConfidenceBadge`/`appendBadge` write "Low confidence" or
  "Excluded — <reason>" as descendants of `flagsAnchor`, but `flagsAnchor`'s
  own `aria-label` (the Date-cell string) wins, so that descendant text is
  never part of the accessible name a screen reader announces for the anchor.
  This is the exact defect class this phase's own CR-02 (prior round) fixed
  for the row-level anchors on `list.ts`/`overview.ts` — reintroduced here at
  cell scope by D-13's new anchors.

The code's own comment (`records.ts:353-359`) frames this as "not decidable in
this repository (no DOM, no accessibility tooling)" and defers it to a Round 4
checkpoint observation row. That framing is accurate for *rendering* questions
(paint order, focus-ring visibility) elsewhere in this codebase's review
history, but the accessible-name computation itself is deterministic per the
ARIA spec and does not require a rendered page to reason about — the six
identical announcements and the swallowed flag text are provable defects, not
open questions.

This is distinct from the already-recorded GAP 12 (double-click/drag-select
guard bypass via the real anchors): GAP 12 is about the row-level *guard
logic* (`shouldNavigateOnRowClick`) being unreachable once a click lands on a
real anchor. This finding is about the *accessible name* those same anchors
carry once reached — a different failure mode of the same D-13 anchor design,
not a repeat of GAP 12.

**Fix:** Give each cell anchor either no `aria-label` at all (letting its
accessible name derive from its own visible text — "#1", "19:39", "5:23/km",
"92.3%") or a cell-specific label that includes both the cell's own value and
enough context to disambiguate it, e.g.:

```ts
const rankLink = buildCellLink(row.activityId, `Rank #${row.rank}, ${curatedLabel}`);
const timeLink = buildCellLink(row.activityId, `Time ${formatEffortDuration(row.durationSec)}, ${curatedLabel}`);
const paceLink = buildCellLink(row.activityId, `Pace ${formatPace(row.paceSecPerKm)}, ${curatedLabel}`);
// ...
```

or, simpler and consistent with these anchors' stated purpose as gesture-only
targets (D-13: "the affordance on these cells is the row-level pointer cursor
... not the cell text itself"), drop the `ariaLabel` parameter from the five
non-Date call sites entirely so the anchor's accessible name falls through to
its own text content, which is already correct and cell-specific:

```ts
function buildCellLink(activityId: string, ariaLabel?: string): HTMLAnchorElement {
  const cellAnchor = document.createElement('a');
  cellAnchor.className = 'pr-table__cell-link';
  cellAnchor.href = activityDetailHref(activityId);
  if (ariaLabel) cellAnchor.setAttribute('aria-label', ariaLabel);
  cellAnchor.tabIndex = -1;
  return cellAnchor;
}
```

and only pass `curatedLabel` where it is actually correct — nowhere in the
current five non-Date call sites, since none of them describe the Date cell's
content. The Flags cell in particular must not carry an `aria-label` at all if
it is to keep announcing its badge text.

## Info

### IN-01: `tr.dataset.activityId` is written and never read anywhere in the codebase

**File:** `src/dashboard/views/list.ts:466`

**Issue:** `buildTableRow` sets `tr.dataset.activityId = row.id;`, but no
selector, test, or other module in `src/` reads `dataset.activityId` or a
`[data-activity-id]` attribute (confirmed by search). This is dead output —
either a debugging/testing hook that was never wired up, or a leftover from
an earlier implementation.

**Fix:** Remove the line if it serves no purpose, or, if it exists for future
test hooks or analytics, add a comment stating that intent (matching this
codebase's documentation discipline elsewhere) so a future reader does not
have to rediscover that it's unused.

### IN-02: `tabIndex` is set via two different mechanisms across sibling files for the identical "focus the h1 after mount" pattern

**File:** `src/dashboard/views/overview.ts:283` vs. `src/dashboard/views/list.ts:1303`, `src/dashboard/views/records.ts:248/522/665/742/860`

**Issue:** `overview.ts` writes `heading.setAttribute('tabindex', '-1')` while
every other view in this same file set (`list.ts`, `records.ts`) writes
`heading.tabIndex = -1` (property form) for the exact same "focus target,
programmatically only" pattern. Both are functionally equivalent and both
pass `row-semantics.test.ts`'s `rowSemanticViolations` allowlist (which
explicitly scans for both spellings for this reason), so this is not a
functional defect — but it is an unnecessary inconsistency in a codebase that
otherwise documents "one way to do X" quite deliberately (see this same
file's own D-06/D-07 single-source-of-truth comments for formatters and badge
builders).

**Fix:** Standardize on the property form (`heading.tabIndex = -1`) in
`overview.ts` to match `list.ts`/`records.ts`/`row-navigation.ts`'s own
`row-semantics.test.ts` guard comment, which already treats the property form
as the primary spelling this codebase uses.

### IN-03: Unchecked type assertion on `event.target` in the row-click listener

**File:** `src/dashboard/row-navigation.ts:158`

**Issue:** `(event.target as HTMLElement).closest('a')` asserts `event.target`
(typed `EventTarget | null`) is a non-null `HTMLElement` without a runtime
guard. In every real browser this is safe — a dispatched `click` event always
carries a concrete `Element` target — so this is not exploitable or
practically reachable as a crash. It is nonetheless an unchecked assertion
in a function this file's own header (lines 58-69) singles out as
untestable-by-this-repo's-test-suite DOM plumbing, which is exactly the kind
of code where a defensive null check costs nothing and removes one
"trust the browser" assumption from the only path that cannot be unit-tested
here.

**Fix:** Narrow safely instead of asserting, e.g. `event.target instanceof Element ? event.target.closest('a') : null`, or add a short comment stating why the assertion is safe (a click event's target is always a concrete element) so a future reader does not need to rediscover that reasoning.

---

_Reviewed: 2026-08-18T04:33:54Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
