import { afterEach, describe, expect, it } from 'vitest';

import {
  applyThemeMode,
  cycleThemeMode,
  parseThemeMode,
  readStoredMode,
  resolveEffectiveTheme,
  THEME_STORAGE_KEY,
  watchSystemTheme,
  type Theme,
  type ThemeMediaQuery,
  type ThemeMode,
  type ThemeStorage,
} from './theme.js';

/** In-memory ThemeStorage backed by a plain object, with optional throw-on-access modes. */
function fakeStorage(
  initial: Record<string, string> = {},
  opts: { throwOnGet?: boolean; throwOnSet?: boolean } = {}
): ThemeStorage & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem(key: string): string | null {
      if (opts.throwOnGet) throw new Error('getItem blocked (private mode simulation)');
      return key in data ? data[key] : null;
    },
    setItem(key: string, value: string): void {
      if (opts.throwOnSet) throw new Error('setItem blocked (private mode simulation)');
      data[key] = value;
    },
  };
}

/**
 * Recording sentinel that stands in for the REAL globalThis.localStorage —
 * every setItem call is pushed to setItemCalls so a fallthrough to the
 * global (rather than honouring an explicit override) is DETECTABLE. WR-01's
 * previous three `storage: null` cases passed only because
 * `vitest.config.ts` is `environment: 'node'` with no setup file assigning
 * `globalThis.localStorage`, so they exercised the absent-global path rather
 * than the null-override path their titles claimed to test. Installing this
 * sentinel is what makes the GC-9 assertions below mean what their titles say.
 */
function sentinelStorage(
  initial: Record<string, string> = {}
): ThemeStorage & { data: Record<string, string>; setItemCalls: Array<[string, string]> } {
  const data: Record<string, string> = { ...initial };
  const setItemCalls: Array<[string, string]> = [];
  return {
    data,
    setItemCalls,
    getItem(key: string): string | null {
      return key in data ? data[key] : null;
    },
    setItem(key: string, value: string): void {
      setItemCalls.push([key, value]);
      data[key] = value;
    },
  };
}

/** Installs `sentinel` as globalThis.localStorage via a getter — the identical install shape storage.test.ts already uses. */
function installSentinelGlobal(sentinel: ThemeStorage): void {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      return sentinel;
    },
  });
}

/** Minimal fake Document exposing only documentElement.setAttribute, with recorded attrs. */
function fakeDoc(): { doc: Document; attrs: Record<string, string> } {
  const attrs: Record<string, string> = {};
  const doc = {
    documentElement: {
      setAttribute(name: string, value: string) {
        attrs[name] = value;
      },
    },
  } as unknown as Document;
  return { doc, attrs };
}

/** Fake MediaQueryList-shaped object that records listeners and exposes a fire() trigger. */
function fakeMediaQuery(matches: boolean): ThemeMediaQuery & { fire(matches: boolean): void } {
  const listeners: Array<(e: { matches: boolean }) => void> = [];
  return {
    matches,
    addEventListener(_type: 'change', l: (e: { matches: boolean }) => void) {
      listeners.push(l);
    },
    removeEventListener(_type: 'change', l: (e: { matches: boolean }) => void) {
      const idx = listeners.indexOf(l);
      if (idx !== -1) listeners.splice(idx, 1);
    },
    fire(nextMatches: boolean) {
      for (const l of listeners) l({ matches: nextMatches });
    },
  };
}

describe('parseThemeMode', () => {
  it("parses 'light' to 'light'", () => {
    expect(parseThemeMode('light')).toBe('light');
  });

  it("parses 'dark' to 'dark'", () => {
    expect(parseThemeMode('dark')).toBe('dark');
  });

  it("parses 'auto' to 'auto'", () => {
    expect(parseThemeMode('auto')).toBe('auto');
  });

  it("falls back to 'auto' for null", () => {
    expect(parseThemeMode(null)).toBe('auto');
  });

  it("falls back to 'auto' for an empty string", () => {
    expect(parseThemeMode('')).toBe('auto');
  });

  it("falls back to 'auto' for wrong-case 'AUTO'", () => {
    expect(parseThemeMode('AUTO')).toBe('auto');
  });

  it("falls back to 'auto' for a tampered/injected value", () => {
    expect(parseThemeMode("auto'; alert(1)")).toBe('auto');
  });

  it("falls back to 'auto' for '[object Object]'", () => {
    expect(parseThemeMode('[object Object]')).toBe('auto');
  });
});

describe('resolveEffectiveTheme', () => {
  it("explicit 'light' wins over system dark preference", () => {
    expect(resolveEffectiveTheme('light', true)).toBe('light');
  });

  it("explicit 'light' matches system light preference", () => {
    expect(resolveEffectiveTheme('light', false)).toBe('light');
  });

  it("explicit 'dark' with system light preference stays dark", () => {
    expect(resolveEffectiveTheme('dark', false)).toBe('dark');
  });

  it("explicit 'dark' with system dark preference stays dark", () => {
    expect(resolveEffectiveTheme('dark', true)).toBe('dark');
  });

  it("'auto' with system preferring dark resolves to 'dark'", () => {
    expect(resolveEffectiveTheme('auto', true)).toBe('dark');
  });

  it("'auto' with system preferring light resolves to 'light'", () => {
    expect(resolveEffectiveTheme('auto', false)).toBe('light');
  });
});

describe('cycleThemeMode', () => {
  it("cycles 'light' -> 'dark'", () => {
    expect(cycleThemeMode('light')).toBe('dark');
  });

  it("cycles 'dark' -> 'auto'", () => {
    expect(cycleThemeMode('dark')).toBe('auto');
  });

  it("cycles 'auto' -> 'light'", () => {
    expect(cycleThemeMode('auto')).toBe('light');
  });
});

describe('readStoredMode', () => {
  it("returns 'dark' when storage holds 'dark'", () => {
    const storage = fakeStorage({ [THEME_STORAGE_KEY]: 'dark' });
    expect(readStoredMode(storage)).toBe('dark');
  });

  it("falls back to 'auto' when storage holds an unrecognised value", () => {
    const storage = fakeStorage({ [THEME_STORAGE_KEY]: 'nonsense' });
    expect(readStoredMode(storage)).toBe('auto');
  });

  it("falls back to 'auto' without rethrowing when getItem throws", () => {
    const storage = fakeStorage({}, { throwOnGet: true });
    expect(() => readStoredMode(storage)).not.toThrow();
    expect(readStoredMode(storage)).toBe('auto');
  });

  it("falls back to 'auto' without rethrowing when storage is null (BL-03)", () => {
    expect(() => readStoredMode(null)).not.toThrow();
    expect(readStoredMode(null)).toBe('auto');
  });
});

describe('applyThemeMode', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it("mode 'auto' with prefersDark true sets data-theme to 'dark' and persists the MODE 'auto'", () => {
    const { doc, attrs } = fakeDoc();
    const storage = fakeStorage();
    const effective = applyThemeMode('auto', { prefersDark: true, doc, storage });
    expect(effective).toBe('dark');
    expect(attrs['data-theme']).toBe('dark');
    expect(storage.data[THEME_STORAGE_KEY]).toBe('auto');
  });

  it("mode 'light' with prefersDark true sets data-theme to 'light' and persists 'light'", () => {
    const { doc, attrs } = fakeDoc();
    const storage = fakeStorage();
    const effective = applyThemeMode('light', { prefersDark: true, doc, storage });
    expect(effective).toBe('light');
    expect(attrs['data-theme']).toBe('light');
    expect(storage.data[THEME_STORAGE_KEY]).toBe('light');
  });

  it('returns the effective theme it applied', () => {
    const { doc } = fakeDoc();
    const storage = fakeStorage();
    const effective: Theme = applyThemeMode('dark', { prefersDark: false, doc, storage });
    expect(effective).toBe('dark');
  });

  it('does not throw and still sets the attribute when storage.setItem throws', () => {
    const { doc, attrs } = fakeDoc();
    const storage = fakeStorage({}, { throwOnSet: true });
    expect(() =>
      applyThemeMode('dark', { prefersDark: false, doc, storage })
    ).not.toThrow();
    expect(attrs['data-theme']).toBe('dark');
  });

  it(
    'GC-9b: storage: null writes data-theme but records ZERO setItem calls and no dashboard-theme key ' +
      'on an installed sentinel global — the sentinel is what makes this discriminate from an accidental ' +
      'fallthrough (WR-01)',
    () => {
      const sentinel = sentinelStorage();
      installSentinelGlobal(sentinel);
      const { doc, attrs } = fakeDoc();
      const effective = applyThemeMode('dark', { prefersDark: false, doc, storage: null });
      expect(effective).toBe('dark');
      expect(attrs['data-theme']).toBe('dark');
      expect(sentinel.setItemCalls).toEqual([]);
      expect(THEME_STORAGE_KEY in sentinel.data).toBe(false);
    }
  );

  it(
    'GC-9d control: with the SAME sentinel installed and storage OMITTED entirely, applyThemeMode DOES write ' +
      'into it — proves the fallthrough branch still works and that GC-9b is discriminating rather than passing ' +
      'because nothing is ever written',
    () => {
      const sentinel = sentinelStorage();
      installSentinelGlobal(sentinel);
      const { doc, attrs } = fakeDoc();
      const effective = applyThemeMode('dark', { prefersDark: false, doc });
      expect(effective).toBe('dark');
      expect(attrs['data-theme']).toBe('dark');
      expect(sentinel.setItemCalls).toEqual([[THEME_STORAGE_KEY, 'dark']]);
    }
  );
});

describe('watchSystemTheme', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it("invokes the callback when the media query fires and the stored mode is 'auto'", () => {
    const mediaQuery = fakeMediaQuery(false);
    const storage = fakeStorage({ [THEME_STORAGE_KEY]: 'auto' });
    let called = 0;
    let lastPrefersDark: boolean | undefined;
    watchSystemTheme(
      (prefersDark) => {
        called += 1;
        lastPrefersDark = prefersDark;
      },
      { mediaQuery, storage }
    );
    mediaQuery.fire(true);
    expect(called).toBe(1);
    expect(lastPrefersDark).toBe(true);
  });

  it("does not invoke the callback when the stored mode is 'light'", () => {
    const mediaQuery = fakeMediaQuery(false);
    const storage = fakeStorage({ [THEME_STORAGE_KEY]: 'light' });
    let called = 0;
    watchSystemTheme(() => {
      called += 1;
    }, { mediaQuery, storage });
    mediaQuery.fire(true);
    expect(called).toBe(0);
  });

  it("does not invoke the callback when the stored mode is 'dark'", () => {
    const mediaQuery = fakeMediaQuery(false);
    const storage = fakeStorage({ [THEME_STORAGE_KEY]: 'dark' });
    let called = 0;
    watchSystemTheme(() => {
      called += 1;
    }, { mediaQuery, storage });
    mediaQuery.fire(true);
    expect(called).toBe(0);
  });

  it('returns an unsubscribe function that stops future callbacks', () => {
    const mediaQuery = fakeMediaQuery(false);
    const storage = fakeStorage({ [THEME_STORAGE_KEY]: 'auto' });
    let called = 0;
    const unsubscribe = watchSystemTheme(() => {
      called += 1;
    }, { mediaQuery, storage });
    unsubscribe();
    mediaQuery.fire(true);
    expect(called).toBe(0);
  });

  it(
    'GC-9c: storage: null still follows the system theme even though an installed sentinel holds a ' +
      "contradicting stored 'light' — fires the callback exactly once on the media query change (WR-01)",
    () => {
      const sentinel = sentinelStorage({ [THEME_STORAGE_KEY]: 'light' });
      installSentinelGlobal(sentinel);
      const mediaQuery = fakeMediaQuery(false);
      let called = 0;
      const unsubscribe = watchSystemTheme(() => {
        called += 1;
      }, { mediaQuery, storage: null });
      mediaQuery.fire(true);
      expect(called).toBe(1);
      unsubscribe();
    }
  );

  it("GC-8a: isAuto: () => true overrides a contradicting stored 'light' value, firing the callback", () => {
    const mediaQuery = fakeMediaQuery(false);
    const storage = fakeStorage({ [THEME_STORAGE_KEY]: 'light' });
    let called = 0;
    watchSystemTheme(
      () => {
        called += 1;
      },
      { mediaQuery, storage, isAuto: () => true }
    );
    mediaQuery.fire(true);
    expect(called).toBe(1);
  });

  it("GC-8b: isAuto: () => false overrides a contradicting stored 'auto' value, suppressing the callback", () => {
    const mediaQuery = fakeMediaQuery(false);
    const storage = fakeStorage({ [THEME_STORAGE_KEY]: 'auto' });
    let called = 0;
    watchSystemTheme(
      () => {
        called += 1;
      },
      { mediaQuery, storage, isAuto: () => false }
    );
    mediaQuery.fire(true);
    expect(called).toBe(0);
  });

  it('GC-8c: with isAuto omitted, the guard still consults the supplied storage — the option is additive, not a replacement', () => {
    const mediaQuery = fakeMediaQuery(false);
    const storage = fakeStorage({ [THEME_STORAGE_KEY]: 'auto' });
    let called = 0;
    watchSystemTheme(
      () => {
        called += 1;
      },
      { mediaQuery, storage }
    );
    mediaQuery.fire(true);
    expect(called).toBe(1);
  });
});
