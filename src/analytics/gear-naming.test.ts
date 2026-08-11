import { describe, expect, it } from 'vitest';

import { buildGearLabelMap, UNKNOWN_GEAR_LABEL } from './gear-naming.js';

describe('buildGearLabelMap', () => {
  it('exports the UNKNOWN_GEAR_LABEL literal', () => {
    expect(UNKNOWN_GEAR_LABEL).toBe('Unknown');
  });

  it('all-blank names: three ids with out-of-order first-use dates produce Shoe 1/2/3 assigned by first-use date, not input order', () => {
    const usages = [
      { gearId: 'g-c', startDate: '2024-03-01T00:00:00Z' },
      { gearId: 'g-a', startDate: '2020-01-01T00:00:00Z' },
      { gearId: 'g-b', startDate: '2022-06-15T00:00:00Z' },
    ];
    const gearMap: Record<string, string> = { 'g-a': '', 'g-b': '', 'g-c': '' };

    const map = buildGearLabelMap(usages, gearMap);

    expect(map.get('g-a')).toBe('Shoe 1');
    expect(map.get('g-b')).toBe('Shoe 2');
    expect(map.get('g-c')).toBe('Shoe 3');
  });

  it('mixed: a named shoe keeps its name, others still get ordinals, and the ordinal numbering counts all shoes (does not shift for the named one)', () => {
    const usages = [
      { gearId: 'g-first', startDate: '2020-01-01T00:00:00Z' },
      { gearId: 'g-second-named', startDate: '2021-01-01T00:00:00Z' },
      { gearId: 'g-third', startDate: '2022-01-01T00:00:00Z' },
    ];
    const gearMap: Record<string, string> = {
      'g-first': '',
      'g-second-named': 'Pegasus 40',
      'g-third': '',
    };

    const map = buildGearLabelMap(usages, gearMap);

    expect(map.get('g-first')).toBe('Shoe 1');
    expect(map.get('g-second-named')).toBe('Pegasus 40');
    expect(map.get('g-third')).toBe('Shoe 3');
  });

  it('null gearMap yields ordinals for every id', () => {
    const usages = [
      { gearId: 'g-a', startDate: '2020-01-01T00:00:00Z' },
      { gearId: 'g-b', startDate: '2021-01-01T00:00:00Z' },
    ];

    const map = buildGearLabelMap(usages, null);

    expect(map.get('g-a')).toBe('Shoe 1');
    expect(map.get('g-b')).toBe('Shoe 2');
  });

  it('whitespace-only name falls back to the ordinal', () => {
    const usages = [{ gearId: 'g-a', startDate: '2020-01-01T00:00:00Z' }];
    const gearMap: Record<string, string> = { 'g-a': '   ' };

    const map = buildGearLabelMap(usages, gearMap);

    expect(map.get('g-a')).toBe('Shoe 1');
  });

  it('determinism: two ids sharing an identical earliest date always produce the same assignment across repeated calls (tie broken by id)', () => {
    const usages = [
      { gearId: 'g-zzz', startDate: '2023-05-01T00:00:00Z' },
      { gearId: 'g-aaa', startDate: '2023-05-01T00:00:00Z' },
    ];
    const gearMap: Record<string, string> = { 'g-zzz': '', 'g-aaa': '' };

    const first = buildGearLabelMap(usages, gearMap);
    const second = buildGearLabelMap(usages, gearMap);
    const third = buildGearLabelMap([...usages].reverse(), gearMap);

    expect(first.get('g-aaa')).toBe('Shoe 1');
    expect(first.get('g-zzz')).toBe('Shoe 2');
    expect(second.get('g-aaa')).toBe('Shoe 1');
    expect(second.get('g-zzz')).toBe('Shoe 2');
    expect(third.get('g-aaa')).toBe('Shoe 1');
    expect(third.get('g-zzz')).toBe('Shoe 2');
  });

  it('Z-suffix mixing: a Z-suffixed date and a non-Z intervals.icu date order correctly', () => {
    const usages = [
      { gearId: 'g-strava', startDate: '2024-01-15T09:00:00Z' },
      { gearId: 'g-intervals', startDate: '2026-08-06T07:28:22' },
    ];
    const gearMap: Record<string, string> = { 'g-strava': '', 'g-intervals': '' };

    const map = buildGearLabelMap(usages, gearMap);

    expect(map.get('g-strava')).toBe('Shoe 1');
    expect(map.get('g-intervals')).toBe('Shoe 2');
  });

  it('no output label equals any input gearId', () => {
    const usages = [
      { gearId: 'g16649854', startDate: '2020-01-01T00:00:00Z' },
      { gearId: 'g10893777', startDate: '2021-01-01T00:00:00Z' },
      { gearId: 'g7431700', startDate: '2022-01-01T00:00:00Z' },
    ];
    const gearMap: Record<string, string> = {
      g16649854: '',
      g10893777: 'Real Name',
      g7431700: '   ',
    };

    const map = buildGearLabelMap(usages, gearMap);

    for (const [gearId, label] of map) {
      expect(label).not.toBe(gearId);
    }
  });
});
