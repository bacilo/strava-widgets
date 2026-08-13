import { describe, expect, it } from 'vitest';

import {
  NAVIGABLE_ROW_CLASS,
  activityDetailHref,
  activityDetailPath,
} from './row-navigation.js';

// Node-environment-only test file — this repo has no jsdom, so this file
// covers only the module's pure, DOM-free surface (activityDetailPath,
// activityDetailHref, NAVIGABLE_ROW_CLASS). The sibling helper that wires up
// the row's click listener needs a live DOM and cannot be unit-tested here;
// its proof is `row-semantics.test.ts` (plan 20-04, a source-structure guard)
// plus the human browser checkpoint (plan 20-05). A green run of this file
// is not coverage of row clicking.

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
