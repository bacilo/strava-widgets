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
 * The assertable surface, honestly: `activityDetailPath`, `activityDetailHref`
 * and `NAVIGABLE_ROW_CLASS` are pure and unit-tested in
 * `row-navigation.test.ts`. `attachRowNavigation` cannot be unit-tested in
 * this repository — vitest runs with `environment: 'node'`, and there is no
 * jsdom and no headless browser anywhere in this repo — so it is proven only
 * by `row-semantics.test.ts`'s source-structure guard (plan 20-04) and by the
 * human browser checkpoint (plan 20-05). This file's own test does not cover
 * `attachRowNavigation`; do not read a green run of it as coverage of row
 * clicking.
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
}

// Pre-fix baseline (plan 20-09 Task 2): only `insideAnchor` is considered.
// Task 3 replaces this body with the full link contract; every other field
// is deliberately ignored until then.
export function shouldNavigateOnRowClick(context: RowClickContext): boolean {
  return !context.insideAnchor;
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
    };
    if (!shouldNavigateOnRowClick(context)) {
      return;
    }
    navigateTo(activityDetailPath(activityId));
  });
}
