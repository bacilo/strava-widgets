import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  parseWeekStart,
  readStoredWeekStart,
  resolveWeekStartStorage,
  writeWeekStart,
  WEEK_START_STORAGE_KEY,
  type WeekStartStorage,
} from './calendar-preferences.js';
import { resolveStorage } from '../storage.js';

/** In-memory WeekStartStorage backed by a plain object, with optional throw-on-access modes. */
function fakeStorage(
  initial: Record<string, string> = {},
  opts: { throwOnGet?: boolean; throwOnSet?: boolean } = {}
): WeekStartStorage & { data: Record<string, string>; getItemCalls: string[]; setItemCalls: Array<[string, string]> } {
  const data: Record<string, string> = { ...initial };
  const getItemCalls: string[] = [];
  const setItemCalls: Array<[string, string]> = [];
  return {
    data,
    getItemCalls,
    setItemCalls,
    getItem(key: string): string | null {
      getItemCalls.push(key);
      if (opts.throwOnGet) throw new Error('getItem blocked (private mode simulation)');
      return key in data ? data[key] : null;
    },
    setItem(key: string, value: string): void {
      setItemCalls.push([key, value]);
      if (opts.throwOnSet) throw new Error('setItem blocked (private mode simulation)');
      data[key] = value;
    },
  };
}

describe('parseWeekStart', () => {
  it("parses 'sunday' to 'sunday'", () => {
    expect(parseWeekStart('sunday')).toBe('sunday');
  });

  it("parses 'monday' to 'monday'", () => {
    expect(parseWeekStart('monday')).toBe('monday');
  });

  const tamperedValues: unknown[] = [null, undefined, '', 'MONDAY', 'Sunday', '3', 0, {}, [], true];

  for (const value of tamperedValues) {
    it(`falls back to 'monday' for ${JSON.stringify(value)}`, () => {
      expect(parseWeekStart(value)).toBe('monday');
    });
  }

  it("falls back to 'monday' for the uppercase variant 'MONDAY' rather than normalising it", () => {
    expect(parseWeekStart('MONDAY')).toBe('monday');
  });

  it('emits no console output for a tampered value', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    parseWeekStart('nonsense');

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('readStoredWeekStart', () => {
  it("returns 'sunday' when storage holds 'sunday'", () => {
    const storage = fakeStorage({ [WEEK_START_STORAGE_KEY]: 'sunday' });
    expect(readStoredWeekStart(storage)).toBe('sunday');
  });

  it("returns 'monday' when storage holds 'monday'", () => {
    const storage = fakeStorage({ [WEEK_START_STORAGE_KEY]: 'monday' });
    expect(readStoredWeekStart(storage)).toBe('monday');
  });

  it("returns 'monday' when the key is absent (getItem returns null)", () => {
    const storage = fakeStorage({});
    expect(readStoredWeekStart(storage)).toBe('monday');
  });

  it('reads exactly WEEK_START_STORAGE_KEY, not the theme key', () => {
    const storage = fakeStorage({ [WEEK_START_STORAGE_KEY]: 'sunday' });
    readStoredWeekStart(storage);
    expect(storage.getItemCalls).toEqual([WEEK_START_STORAGE_KEY]);
    expect(storage.getItemCalls).not.toContain('dashboard-theme');
  });

  it("returns 'monday' and does not throw when getItem throws", () => {
    const storage = fakeStorage({}, { throwOnGet: true });
    expect(() => readStoredWeekStart(storage)).not.toThrow();
    expect(readStoredWeekStart(storage)).toBe('monday');
  });

  it('does NOT call setItem for a tampered value (no repair, D-07)', () => {
    const storage = fakeStorage({ [WEEK_START_STORAGE_KEY]: 'nonsense' });
    readStoredWeekStart(storage);
    expect(storage.setItemCalls).toEqual([]);
  });
});

describe('writeWeekStart', () => {
  it('calls setItem with the key and the exact literal value', () => {
    const storage = fakeStorage();
    writeWeekStart(storage, 'sunday');
    expect(storage.setItemCalls).toEqual([[WEEK_START_STORAGE_KEY, 'sunday']]);
    expect(storage.data[WEEK_START_STORAGE_KEY]).toBe('sunday');
  });

  it('does not throw when setItem throws', () => {
    const storage = fakeStorage({}, { throwOnSet: true });
    expect(() => writeWeekStart(storage, 'monday')).not.toThrow();
  });
});

describe('readStoredWeekStart(null) / writeWeekStart(null, ...) — falsy handle (CR-01/GC-2b)', () => {
  it("readStoredWeekStart(null) returns 'monday' and does not throw", () => {
    expect(() => readStoredWeekStart(null)).not.toThrow();
    expect(readStoredWeekStart(null)).toBe('monday');
  });

  it('writeWeekStart(null, ...) does not throw and performs no observable work', () => {
    expect(() => writeWeekStart(null, 'sunday')).not.toThrow();
  });
});

describe('resolveWeekStartStorage — CR-01: guards the globalThis.localStorage property GETTER, not just getItem/setItem', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('returns the exact override object (identity) when one is supplied', () => {
    const fake = fakeStorage();
    expect(resolveWeekStartStorage(fake)).toBe(fake);
  });

  it('returns the override without ever touching globalThis.localStorage, even while its getter throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: should never be read when an override is supplied');
      },
    });
    const fake = fakeStorage();
    expect(() => resolveWeekStartStorage(fake)).not.toThrow();
    expect(resolveWeekStartStorage(fake)).toBe(fake);
  });

  it('returns null, without throwing, when the globalThis.localStorage GETTER throws (blocked site data)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    expect(() => resolveWeekStartStorage()).not.toThrow();
    expect(resolveWeekStartStorage()).toBeNull();
  });

  it("returns null when globalThis has no 'localStorage' (this repo's default environment: 'node' state)", () => {
    expect('localStorage' in globalThis).toBe(false);
    expect(resolveWeekStartStorage()).toBeNull();
  });

  it('a full resolve-then-read cycle under the throwing getter writes nothing to the console (D-07 silence rule)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const storage = resolveWeekStartStorage();
    const weekStart = readStoredWeekStart(storage);

    expect(weekStart).toBe('monday');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('WR-01 — the live and working branch: with a working globalThis.localStorage stand-in holding sunday, resolveWeekStartStorage() returns that exact object AND readStoredWeekStart(resolveWeekStartStorage()) returns sunday, not the monday default', () => {
    const live = fakeStorage({ [WEEK_START_STORAGE_KEY]: 'sunday' });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        return live;
      },
    });

    const resolved = resolveWeekStartStorage();
    expect(resolved).toBe(live);
    expect(readStoredWeekStart(resolveWeekStartStorage())).toBe('sunday');
  });

  it('resolveWeekStartStorage and resolveStorage agree: same working stand-in returns the same object, throwing getter returns null for both', () => {
    const live = fakeStorage({ [WEEK_START_STORAGE_KEY]: 'sunday' });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        return live;
      },
    });
    expect(resolveWeekStartStorage()).toBe(resolveStorage());

    Reflect.deleteProperty(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    expect(resolveWeekStartStorage()).toBeNull();
    expect(resolveStorage()).toBeNull();
  });
});
