import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveStorage, type WebStorage } from './storage.js';

/** In-memory WebStorage backed by a plain object — mirrors calendar-preferences.test.ts's fakeStorage. */
function fakeStorage(initial: Record<string, string> = {}): WebStorage & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem(key: string): string | null {
      return key in data ? data[key] : null;
    },
    setItem(key: string, value: string): void {
      data[key] = value;
    },
  };
}

describe('resolveStorage — BL-03: the single app-wide storage-handle resolver', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('returns the exact override object (identity) when one is supplied', () => {
    const fake = fakeStorage();
    expect(resolveStorage(fake)).toBe(fake);
  });

  it('returns the override without ever touching globalThis.localStorage, even while its getter throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: should never be read when an override is supplied');
      },
    });
    const fake = fakeStorage();
    expect(() => resolveStorage(fake)).not.toThrow();
    expect(resolveStorage(fake)).toBe(fake);
  });

  it('returns null, without throwing, when the globalThis.localStorage GETTER throws (blocked site data)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    expect(() => resolveStorage()).not.toThrow();
    expect(resolveStorage()).toBeNull();
  });

  it("returns null when globalThis has no 'localStorage' (this repo's default environment: 'node' state)", () => {
    expect('localStorage' in globalThis).toBe(false);
    expect(resolveStorage()).toBeNull();
  });

  it('WR-01 — the live and working branch: with a working globalThis.localStorage installed, resolveStorage() returns that exact object AND a value written into it is readable back through the resolved handle', () => {
    const live = fakeStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        return live;
      },
    });

    const resolved = resolveStorage();
    expect(resolved).toBe(live);

    resolved?.setItem('probe-key', 'probe-value');
    expect(resolved?.getItem('probe-key')).toBe('probe-value');
  });

  it('GC-9a: resolveStorage(null) returns null — an explicit opt-out is HONOURED even while a live, readable sentinel globalThis.localStorage is installed (WR-01)', () => {
    const live = fakeStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        return live;
      },
    });
    expect(resolveStorage(null)).toBeNull();
  });

  it('a full resolve cycle under the throwing getter writes nothing to the console (D-07 silence rule)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    resolveStorage();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('storage.ts — GC-5d: stays a narrow handle resolver, not the deferred shared view-preference facility', () => {
  const storageSource = readFileSync(new URL('./storage.ts', import.meta.url), 'utf8');
  const storageSourceNoComments = storageSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(?<!:)\/\/.*$/gm, '');

  it('exports resolveStorage and WebStorage', () => {
    expect(storageSource).toContain('export function resolveStorage(');
    expect(storageSource).toContain('export interface WebStorage');
  });

  it('contains no .getItem( or .setItem( call — it resolves a handle, not a value', () => {
    expect(storageSourceNoComments).not.toContain('.getItem(');
    expect(storageSourceNoComments).not.toContain('.setItem(');
  });

  it('declares no STORAGE_KEY identifier and performs no JSON.parse or console output', () => {
    expect(storageSourceNoComments).not.toContain('STORAGE_KEY');
    expect(storageSourceNoComments).not.toContain('JSON.parse');
    expect(storageSourceNoComments).not.toContain('console.');
  });
});

/**
 * BL-03's app-wide invariant, enforced repo-wide rather than trusted: every
 * non-test `.ts` module under `src/dashboard/` — walked recursively, so this
 * reaches `src/dashboard/views/` too — must resolve its storage handle
 * through `resolveStorage`, never by dereferencing `globalThis.localStorage`
 * / `globalThis.sessionStorage` or a bare `localStorage`/`sessionStorage`
 * identifier itself. `storage.ts` is the sole, deliberate exception: it is
 * the ONE place the dereference is allowed to live.
 *
 * Six sites carried the unguarded shape before Round 3: `main.ts:19`,
 * `nav.ts:186`, `nav.ts:206`, `theme.ts:93`, `theme.ts:130` and
 * `detail-charts.ts:218`. Comment-stripping is mandatory before scanning —
 * several of these files discuss `localStorage` in prose (this file's own
 * header included), which a naive raw-text scan would false-positive on.
 */
describe('storage.test.ts — BL-03: the app-wide single-dereference-site guard', () => {
  const DASHBOARD_ROOT = new URL('.', import.meta.url).pathname;

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });
  }

  function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  }

  it('finds zero storage-global dereferences in every non-test dashboard module except storage.ts itself', () => {
    const files = walk(DASHBOARD_ROOT).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('storage.ts')
    );
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const live = stripComments(readFileSync(file, 'utf8'));
      const hasGlobalThisDeref = /globalThis\.(localStorage|sessionStorage)/.test(live);
      const hasBareIdentifier = /(^|[^.\w])(localStorage|sessionStorage)\b/m.test(live);
      if (hasGlobalThisDeref || hasBareIdentifier) offenders.push(file);
    }

    expect(offenders, `these files still dereference a storage global directly: ${offenders.join(', ')}`).toEqual([]);
  });

  it('storage.ts itself, comments stripped, contains exactly one globalThis.localStorage occurrence', () => {
    const storageSource = readFileSync(join(DASHBOARD_ROOT, 'storage.ts'), 'utf8');
    const live = stripComments(storageSource);
    const matches = live.match(/globalThis\.localStorage/g) ?? [];
    expect(matches.length).toBe(1);
  });
});
