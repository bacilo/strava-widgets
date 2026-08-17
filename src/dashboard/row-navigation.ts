/**
 * The D-03 single definition of row-click navigation and of the
 * `#/activity/{id}` URL shape. This is not a `*-logic.ts` module — unlike
 * `list-logic.ts` / `records-logic.ts` / `calendar-logic.ts`, which are
 * DOM-free brains split out for node-environment unit testing, this module's
 * `attachRowNavigation` inherently touches `document`/DOM elements, so it
 * lives beside `router.ts` / `nav.ts` instead (mirroring `nav.ts`'s shape:
 * a file header, then small focused exports).
 *
 * D-01, as a decision rather than an accident: a `<tr>` cannot become an
 * anchor, and putting `role="link"` on one removes it from the table's
 * accessibility tree and breaks screen-reader table navigation. So table
 * rows keep an anchor inside one cell for the keyboard path plus this
 * row-level click listener for the mouse path, guarded by `closest('a')` so
 * the two never double-navigate. Div rows do not call this function at all —
 * they become real `<a>` elements instead (plan 20-02).
 *
 * D-02, written so a later agent does not "fix" it: there is deliberately no
 * `keydown` handler and deliberately no Space activation. An `<a href>`
 * activates on Enter; Space is the page-scroll key, and hijacking it on a
 * focused full-width row surprises keyboard users. A control announced as
 * "link" is expected to take Enter. Phase 20 success criterion 3's
 * "Enter/Space" is discharged by native link semantics — see D-02 in
 * `.planning/phases/20-row-click-interaction-pattern/20-CONTEXT.md`.
 *
 * D-12, closing the BLOCKER `20-VERIFICATION.md` recorded against
 * `row-navigation.ts:58-67`: the row-click listener now honours the
 * browser's own link contract. A non-primary button, any of
 * meta/ctrl/shift/alt, or an active (non-collapsed, non-empty) text
 * selection all refuse navigation, in addition to the pre-existing
 * `closest('a')` guard. This became load-bearing, not cosmetic, when plan
 * 20-03 (`670e368`) removed the "View Activity" anchor column from both
 * Records PR tables, leaving five of six PR-table cells (Rank, Time, Pace,
 * Age-Grade, Flags — only Date carries a real anchor) row-click-only.
 * Middle-click (`auxclick`) is deliberately NOT handled — see D-12 in
 * `.planning/phases/20-row-click-interaction-pattern/20-CONTEXT.md` for the
 * full reasoning, recorded there so a later agent does not "fix" the
 * absence as an oversight, the same register D-02's paragraph above uses.
 * Deviation from `20-REVIEW.md`'s drafted patch: the review inlined all
 * three checks directly in the listener; this implementation extracts them
 * into `shouldNavigateOnRowClick` instead, because a check inline inside an
 * `addEventListener` callback is unreachable from any test in a repository
 * with no DOM — the same reasoning that drove `20-06-PLAN.md` to prefer
 * `tagName === 'A'` over `instanceof HTMLAnchorElement`. The refusal
 * conditions themselves are the review's, unchanged.
 *
 * D-14, written so a later agent does not undo it: the row-click listener
 * refuses navigation on the first click of a double-click, closing
 * `20-REVIEW.md`'s WR-05. `RowClickContext` gains a `clickCount` field fed
 * from `MouseEvent.detail`, and `shouldNavigateOnRowClick` gains a fifth
 * refusal class, `clickCount > 1`, appended after D-12's four. D-12's
 * `auxclick` out-of-scope disposition is unchanged by this — no `auxclick`
 * or `dblclick` handler is added. The refusal order deliberately keeps
 * `closest('a')` first, so a click inside the row's own anchor is still
 * refused for the double-navigation reason rather than incidentally by this
 * later guard.
 *
 * The assertable surface, honestly: `activityDetailPath`, `activityDetailHref`,
 * `NAVIGABLE_ROW_CLASS` and now `shouldNavigateOnRowClick` — the whole click
 * decision, including D-12's guards — are pure and unit-tested in
 * `row-navigation.test.ts`. `attachRowNavigation`'s remaining DOM plumbing
 * (`closest`, `window.getSelection`, the `addEventListener` wiring) still
 * cannot be unit-tested in this repository — vitest runs with
 * `environment: 'node'`, and there is no jsdom and no headless browser
 * anywhere in this repo — so that plumbing is proven only by
 * `row-navigation.test.ts`'s own source-structure wiring assertions plus
 * `row-semantics.test.ts`'s guard (plan 20-04) and the Round 3 human
 * checkpoint (plan 20-11). Do not read a green run of this file as coverage
 * of the DOM wiring itself — only of the decision logic it delegates to.
 */

import { navigateTo } from './router.js';

/** D-10's scoping marker for actually-clickable rows. Defined here and only here. */
export const NAVIGABLE_ROW_CLASS = 'activity-table__row--navigable';

/** The router path for an activity's detail view: `/activity/<activityId>`. */
export function activityDetailPath(activityId: string): string {
  return `/activity/${activityId}`;
}

/** The hash-prefixed href for an activity's detail view: `#/activity/<activityId>`. */
export function activityDetailHref(activityId: string): string {
  return '#' + activityDetailPath(activityId);
}

/**
 * The DOM-free description of one row click, extracted so the link-contract
 * decision (D-12) is testable under `environment: 'node'`.
 */
export interface RowClickContext {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  insideAnchor: boolean;
  hasTextSelection: boolean;
  /**
   * `MouseEvent.detail` — the browser's own click-repeat counter. 1 is a
   * single click; 2 or more means this click is part of a double-click (or
   * triple-click) sequence.
   */
  clickCount: number;
}

/**
 * The whole row-click decision (D-12), pure so it can be unit-tested under
 * `environment: 'node'`. Refuses navigation, in order, when:
 * - `insideAnchor` — the row's own in-cell anchor already navigates itself;
 *   this is the pre-existing guard and stays first, so an anchor click is
 *   refused for the double-navigation reason rather than incidentally by a
 *   later guard.
 * - `button !== 0` — a non-primary mouse button is the browser's to own.
 * - any of `metaKey` / `ctrlKey` / `shiftKey` / `altKey` — new tab, new
 *   window and download all belong to the browser.
 * - `hasTextSelection` — a drag-select that ends inside the row must survive.
 * - `clickCount > 1` (D-14) — the first click of a double-click is a select
 *   gesture, not a navigate gesture, and `hasTextSelection` cannot cover it:
 *   the browser fires the first `click` before the word selection exists.
 * Otherwise navigates.
 */
export function shouldNavigateOnRowClick(context: RowClickContext): boolean {
  if (context.insideAnchor) {
    return false;
  }
  if (context.button !== 0) {
    return false;
  }
  if (context.metaKey || context.ctrlKey || context.shiftKey || context.altKey) {
    return false;
  }
  if (context.hasTextSelection) {
    return false;
  }
  if (context.clickCount > 1) {
    return false;
  }
  return true;
}

/**
 * Extracted from `buildTableRow` (`list.ts:333-343`) — behavior preserved
 * exactly (D-03). Adds `NAVIGABLE_ROW_CLASS` to `rowEl` and registers a click
 * listener that builds a `RowClickContext` from the event and the current
 * selection, then delegates the decision to `shouldNavigateOnRowClick`.
 */
export function attachRowNavigation(rowEl: HTMLElement, activityId: string): void {
  rowEl.classList.add(NAVIGABLE_ROW_CLASS);
  rowEl.addEventListener('click', (event: MouseEvent) => {
    const selection = window.getSelection();
    const context: RowClickContext = {
      button: event.button,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      insideAnchor: Boolean((event.target as HTMLElement).closest('a')),
      hasTextSelection: Boolean(selection && !selection.isCollapsed && selection.toString().length > 0),
      clickCount: event.detail,
    };
    if (!shouldNavigateOnRowClick(context)) {
      return;
    }
    navigateTo(activityDetailPath(activityId));
  });
}
