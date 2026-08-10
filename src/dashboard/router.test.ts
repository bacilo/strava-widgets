import { describe, expect, it } from 'vitest';

import { ALL_ROUTES } from './view.types.js';
import { isValidActivityId, matchRoute, parseHash, resolveHash } from './router.js';

describe('parseHash — bare and param forms', () => {
  it('parseHash("#/activity/3475726256") splits into path and an empty query', () => {
    const result = parseHash('#/activity/3475726256');
    expect(result.path).toBe('/activity/3475726256');
    expect(Array.from(result.query.keys())).toEqual([]);
  });

  it('parseHash("#/list?year=2024") extracts path and the year query param', () => {
    const result = parseHash('#/list?year=2024');
    expect(result.path).toBe('/list');
    expect(result.query.get('year')).toBe('2024');
  });

  it('parseHash("#/list?year=2024&sort=pace") extracts both query params', () => {
    const result = parseHash('#/list?year=2024&sort=pace');
    expect(result.query.get('year')).toBe('2024');
    expect(result.query.get('sort')).toBe('pace');
  });

  it('parseHash("") defaults to path "/"', () => {
    expect(parseHash('').path).toBe('/');
  });

  it('parseHash("#") defaults to path "/"', () => {
    expect(parseHash('#').path).toBe('/');
  });

  it('parseHash("#/") defaults to path "/"', () => {
    expect(parseHash('#/').path).toBe('/');
  });

  it('parseHash("#/list/") strips a single trailing slash on a non-root path', () => {
    expect(parseHash('#/list/').path).toBe('/list');
  });
});

describe('matchRoute — literal and param routes', () => {
  it('matchRoute("/", ALL_ROUTES) matches the root route with empty params', () => {
    const result = matchRoute('/', ALL_ROUTES);
    expect(result).toEqual({ route: '/', routeParams: {} });
  });

  it('matchRoute("/list", ALL_ROUTES) matches the list route with empty params', () => {
    const result = matchRoute('/list', ALL_ROUTES);
    expect(result?.route).toBe('/list');
    expect(result?.routeParams).toEqual({});
  });

  it('matchRoute("/activity/3475726256", ALL_ROUTES) matches the detail route and extracts id', () => {
    const result = matchRoute('/activity/3475726256', ALL_ROUTES);
    expect(result?.route).toBe('/activity/:id');
    expect(result?.routeParams.id).toBe('3475726256');
  });

  it('matchRoute("/nope", ALL_ROUTES) returns null for an unregistered path', () => {
    expect(matchRoute('/nope', ALL_ROUTES)).toBeNull();
  });

  it('matchRoute("/activity", ALL_ROUTES) returns null on segment-count mismatch (too few)', () => {
    expect(matchRoute('/activity', ALL_ROUTES)).toBeNull();
  });

  it('matchRoute("/activity/1/2", ALL_ROUTES) returns null on segment-count mismatch (too many)', () => {
    expect(matchRoute('/activity/1/2', ALL_ROUTES)).toBeNull();
  });
});

describe('resolveHash — composed parse + match', () => {
  it('resolveHash composes parseHash and matchRoute for a param route with a query string', () => {
    const result = resolveHash('#/activity/3475726256?tab=splits', ALL_ROUTES);
    expect(result?.route).toBe('/activity/:id');
    expect(result?.routeParams.id).toBe('3475726256');
    expect(result?.query.get('tab')).toBe('splits');
  });

  it('resolveHash("#/garbage", ALL_ROUTES) returns null for an unmatched path', () => {
    expect(resolveHash('#/garbage', ALL_ROUTES)).toBeNull();
  });
});

describe('isValidActivityId — the single id-validation chokepoint', () => {
  it('accepts a real numeric id', () => {
    expect(isValidActivityId('3475726256')).toBe(true);
  });

  it.each([
    ['', 'empty string'],
    ['abc', 'non-numeric'],
    ['12a', 'trailing letter'],
    ['12.3', 'decimal'],
    ['-1', 'negative sign'],
    ['1 2', 'embedded space'],
    ['../secrets', 'path traversal attempt'],
    ['12%2F..', 'percent-encoded traversal attempt'],
    ['<script>', 'markup injection attempt'],
  ])('rejects %j (%s)', (value) => {
    expect(isValidActivityId(value)).toBe(false);
  });

  it('rejects an id over the length ceiling (40 digits)', () => {
    expect(isValidActivityId('0'.repeat(40))).toBe(false);
  });
});
