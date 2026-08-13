import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  NAVIGABLE_ROW_CLASS,
  type RowClickContext,
  activityDetailHref,
  activityDetailPath,
  shouldNavigateOnRowClick,
} from './row-navigation.js';

// Node-environment-only test file — this repo has no jsdom. This file covers
// the module's pure, DOM-free surface: activityDetailPath, activityDetailHref,
// NAVIGABLE_ROW_CLASS, and — as of plan 20-09 — shouldNavigateOnRowClick,
// which now holds the WHOLE row-click decision including D-12's link-contract
// guards (modifier keys, non-primary button, active text selection). What
// remains untestable here is attachRowNavigation's DOM plumbing (closest('a'),
// window.getSelection(), the addEventListener wiring itself) — that needs a
// live DOM. Its proof is the source-structure wiring assertions below, plus
// `row-semantics.test.ts` (plan 20-04) and the Round 3 human checkpoint (plan
// 20-11). A green run of this file is coverage of the click decision logic,
// not of the DOM wiring that feeds it.

const ACTIVITY_ID = '3475726256';

describe('activityDetailPath', () => {
  it('returns /activity/<id> for a numeric id', () => {
    expect(activityDetailPath(ACTIVITY_ID)).toBe('/activity/3475726256');
  });

  it('returns a string starting with / and not with #', () => {
    const path = activityDetailPath(ACTIVITY_ID);
    expect(path.startsWith('/')).toBe(true);
    expect(path.startsWith('#')).toBe(false);
  });

  it('handles an i-prefixed intervals.icu id unchanged', () => {
    expect(activityDetailPath('i12345')).toBe('/activity/i12345');
  });
});

describe('activityDetailHref', () => {
  it('returns #/activity/<id> for a numeric id', () => {
    expect(activityDetailHref(ACTIVITY_ID)).toBe('#/activity/3475726256');
  });

  it('handles an i-prefixed intervals.icu id unchanged', () => {
    expect(activityDetailHref('i12345')).toBe('#/activity/i12345');
  });

  it('equals "#" + activityDetailPath(id) for the same id — cannot drift apart', () => {
    expect(activityDetailHref(ACTIVITY_ID)).toBe('#' + activityDetailPath(ACTIVITY_ID));
  });
});

describe('NAVIGABLE_ROW_CLASS', () => {
  it('equals activity-table__row--navigable', () => {
    expect(NAVIGABLE_ROW_CLASS).toBe('activity-table__row--navigable');
  });
});

/**
 * The permissive baseline: a plain primary click on a non-anchor cell, with
 * no modifiers and no active selection. Every case below spreads this and
 * overrides exactly one field, so each `it` names precisely one condition.
 */
function plainPrimaryClick(): RowClickContext {
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    insideAnchor: false,
    hasTextSelection: false,
  };
}

// The row-click link contract (D-12) — closing the BLOCKER 20-VERIFICATION.md
// recorded against row-navigation.ts:58-67. These cases apply to the five
// anchor-less Records PR-table cells (Rank, Time, Pace, Age-Grade, Flags;
// only Date carries a real anchor — records.ts:396-419), the sole affordance
// on those cells since plan 20-03 (670e368) removed the "View Activity"
// anchor column.
describe('shouldNavigateOnRowClick — the row-click link contract (D-12)', () => {
  it('baseline: a plain primary click on a non-anchor cell navigates', () => {
    expect(shouldNavigateOnRowClick(plainPrimaryClick())).toBe(true);
  });

  it('baseline: a click inside the row\'s own anchor does not double-navigate', () => {
    expect(
      shouldNavigateOnRowClick({ ...plainPrimaryClick(), insideAnchor: true }),
    ).toBe(false);
  });

  it('Cmd+click (metaKey) on a Rank/Time/Pace/Age-Grade/Flags cell must defer to the browser\'s new-tab gesture (D-12)', () => {
    expect(
      shouldNavigateOnRowClick({ ...plainPrimaryClick(), metaKey: true }),
    ).toBe(false);
  });

  it('Ctrl+click (ctrlKey) on a Rank/Time/Pace/Age-Grade/Flags cell must defer to the browser\'s new-tab gesture (D-12)', () => {
    expect(
      shouldNavigateOnRowClick({ ...plainPrimaryClick(), ctrlKey: true }),
    ).toBe(false);
  });

  it('Shift+click on a Rank/Time/Pace/Age-Grade/Flags cell must defer to the browser\'s new-window gesture (D-12)', () => {
    expect(
      shouldNavigateOnRowClick({ ...plainPrimaryClick(), shiftKey: true }),
    ).toBe(false);
  });

  it('Alt+click on a Rank/Time/Pace/Age-Grade/Flags cell must defer to the browser\'s download gesture (D-12)', () => {
    expect(
      shouldNavigateOnRowClick({ ...plainPrimaryClick(), altKey: true }),
    ).toBe(false);
  });

  it('a middle-click (button: 1) on a Rank/Time/Pace/Age-Grade/Flags cell must not navigate in this tab (D-12)', () => {
    expect(
      shouldNavigateOnRowClick({ ...plainPrimaryClick(), button: 1 }),
    ).toBe(false);
  });

  it('a secondary/right-click (button: 2) on a Rank/Time/Pace/Age-Grade/Flags cell must not navigate (D-12)', () => {
    expect(
      shouldNavigateOnRowClick({ ...plainPrimaryClick(), button: 2 }),
    ).toBe(false);
  });

  it('a drag-select ending inside a Rank/Time/Pace/Age-Grade/Flags cell must survive, not navigate away (D-12)', () => {
    expect(
      shouldNavigateOnRowClick({ ...plainPrimaryClick(), hasTextSelection: true }),
    ).toBe(false);
  });

  it('anti-over-blocking: each single guard field refuses navigation while the plain primary click still navigates (D-12)', () => {
    const plain = plainPrimaryClick();
    expect(shouldNavigateOnRowClick(plain)).toBe(true);
    const singleFieldVariants: Array<Partial<RowClickContext>> = [
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
      { button: 2 },
      { hasTextSelection: true },
    ];
    for (const variant of singleFieldVariants) {
      expect(
        shouldNavigateOnRowClick({ ...plain, ...variant }),
        `variant ${JSON.stringify(variant)} must refuse to navigate on a Rank/Time/Pace/Age-Grade/Flags cell (D-12) even though the plain primary click still does`,
      ).toBe(false);
    }
  });
});

/**
 * Strips block comments, non-greedy, then `//`-to-end-of-line where the `//`
 * is not immediately preceded by `:` — mirrors `row-semantics.test.ts`'s
 * `stripComments` so prose in a comment cannot collide with these assertions.
 */
function stripComments(source: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

describe('row-navigation.ts wiring — the listener actually consults the predicate', () => {
  const stripped = stripComments(
    readFileSync(new URL('./row-navigation.ts', import.meta.url), 'utf8'),
  );

  it('shouldNavigateOnRowClick( occurs exactly twice — the definition and its single call site', () => {
    const matches = stripped.match(/shouldNavigateOnRowClick\(/g) || [];
    expect(matches.length).toBe(2);
  });

  it("the listener reads event.button, every modifier key and window.getSelection(", () => {
    expect(stripped).toContain('event.button');
    expect(stripped).toContain('event.metaKey');
    expect(stripped).toContain('event.ctrlKey');
    expect(stripped).toContain('event.shiftKey');
    expect(stripped).toContain('event.altKey');
    expect(stripped).toContain('window.getSelection(');
  });

  it("closest('a') still occurs exactly once", () => {
    const matches = stripped.match(/closest\('a'\)/g) || [];
    expect(matches.length).toBe(1);
  });

  it('contains zero occurrences of auxclick — D-12 records middle-click as explicitly out of scope', () => {
    const matches = stripped.match(/auxclick/gi) || [];
    expect(
      matches.length,
      'auxclick must not appear in row-navigation.ts; see D-12 in 20-CONTEXT.md for why middle-click is deliberately unhandled',
    ).toBe(0);
  });
});
