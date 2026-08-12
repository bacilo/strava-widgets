/**
 * Data-only assertions on the view registry (D-03). No `mount()` is ever
 * invoked and no DOM is touched — `vitest.config.ts` runs in a `node`
 * environment with no jsdom, so this file may only assert on registry
 * DATA (route/title/navEntry), matching `compute-best-efforts.test.ts`'s
 * precedent for this repo's test phrasing style.
 */

import { describe, expect, it } from 'vitest';

import { ALL_ROUTES, NAV_ORDER, ROUTES, STUB_PHASE } from './view.types.js';
import { VIEWS, getView } from './view-registry.js';

describe('VIEWS', () => {
  it('covers exactly the routes in ALL_ROUTES, no more and no fewer', () => {
    expect(VIEWS.map((v) => v.route).sort()).toEqual([...ALL_ROUTES].sort());
  });

  it('contains no duplicate route values', () => {
    const routes = VIEWS.map((v) => v.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('every entry has a non-empty title and a mount function', () => {
    for (const view of VIEWS) {
      expect(typeof view.title).toBe('string');
      expect(view.title.length).toBeGreaterThan(0);
      expect(typeof view.mount).toBe('function');
    }
  });
});

describe('getView', () => {
  it.each([
    ROUTES.OVERVIEW,
    ROUTES.LIST,
    ROUTES.CALENDAR,
    ROUTES.RECORDS,
    ROUTES.TRENDS,
    ROUTES.DETAIL,
  ])('resolves %s to a view whose route matches the argument', (route) => {
    const view = getView(route);
    expect(view).toBeDefined();
    expect(view!.route).toBe(route);
  });

  it('returns undefined for an unregistered route', () => {
    expect(getView('/nope')).toBeUndefined();
  });

  it('never surfaces the detail route in the nav — navEntry is undefined (D-05)', () => {
    expect(getView(ROUTES.DETAIL)!.navEntry).toBeUndefined();
  });
});

describe('STUB_PHASE', () => {
  it('has no entry for ROUTES.CALENDAR (BROWSE-05 shipped) or ROUTES.RECORDS (this plan shipped it) while TRENDS remains stubbed — regression guard against a silent revert (T-17-REG-01)', () => {
    expect(STUB_PHASE[ROUTES.CALENDAR]).toBeUndefined();
    expect(STUB_PHASE[ROUTES.RECORDS]).toBeUndefined();
    expect(STUB_PHASE[ROUTES.TRENDS]).toBeDefined();
  });
});

describe('NAV_ORDER', () => {
  it('every route resolves through getView to a defined view', () => {
    for (const entry of NAV_ORDER) {
      expect(getView(entry.route)).toBeDefined();
    }
  });

  it('contains no entry whose route is ROUTES.DETAIL', () => {
    expect(NAV_ORDER.some((entry) => entry.route === ROUTES.DETAIL)).toBe(false);
  });
});
