import { readFileSync } from 'node:fs';
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
