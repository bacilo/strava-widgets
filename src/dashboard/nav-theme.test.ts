import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';

import { createThemeToggleController, type ThemeToggleControllerDeps } from './nav-theme.js';
import { readStoredMode, type ApplyThemeOptions, type ThemeMode } from './theme.js';
import { resolveStorage } from './storage.js';

/** Records `apply`/`render` invocations as plain tuples — no mocking library needed. */
function recordingDeps(initialMode: ThemeMode): {
  deps: ThemeToggleControllerDeps;
  applyCalls: Array<[ThemeMode, ApplyThemeOptions | undefined]>;
  renderCalls: Array<[ThemeMode, number | undefined]>;
} {
  const applyCalls: Array<[ThemeMode, ApplyThemeOptions | undefined]> = [];
  const renderCalls: Array<[ThemeMode, number | undefined]> = [];
  const deps: ThemeToggleControllerDeps = {
    initialMode,
    apply(mode, options) {
      applyCalls.push([mode, options]);
    },
    render(mode, prefersDark) {
      renderCalls.push([mode, prefersDark as unknown as number | undefined]);
    },
  };
  return { deps, applyCalls, renderCalls };
}

describe('createThemeToggleController — CR-01: three clicks reach dark and auto with no storage handle at all', () => {
  // Node 22+ ships a built-in globalThis.localStorage even under vitest's
  // `environment: 'node'`, unlike the Node version this repo's suite was
  // originally written against (see storage.test.ts's own afterEach, which
  // relies on the same deletion). Deleting it explicitly here — rather than
  // asserting on ambient Node-version behavior — is what actually proves "no
  // storage handle at all", hermetically and regardless of test file order.
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('GC-8d: seeded from readStoredMode(resolveStorage()) with no globalThis.localStorage installed, three toggles apply exactly [light, dark, auto], not [light, light, light]', () => {
    Reflect.deleteProperty(globalThis, 'localStorage');
    expect('localStorage' in globalThis).toBe(false);
    const seed = readStoredMode(resolveStorage());
    expect(seed).toBe('auto');

    const { deps, applyCalls, renderCalls } = recordingDeps(seed);
    const controller = createThemeToggleController(deps);

    controller.toggle();
    controller.toggle();
    controller.toggle();

    const appliedModes = applyCalls.map(([mode]) => mode);
    const renderedModes = renderCalls.map(([mode]) => mode);

    expect(
      appliedModes,
      "CR-01 defect shape: three clicks must not all apply 'light' — that is the exact stranded-on-light bug this controller fixes"
    ).not.toEqual(['light', 'light', 'light']);
    expect(appliedModes).toEqual(['light', 'dark', 'auto']);
    expect(renderedModes).toEqual(['light', 'dark', 'auto']);
    expect(controller.mode()).toBe('auto');
  });

  it('GC-8e: toggle() returns the new mode on each call, matching what it passed to apply', () => {
    const { deps, applyCalls } = recordingDeps('auto');
    const controller = createThemeToggleController(deps);

    const first = controller.toggle();
    const second = controller.toggle();
    const third = controller.toggle();

    expect([first, second, third]).toEqual(['light', 'dark', 'auto']);
    expect(applyCalls.map(([mode]) => mode)).toEqual([first, second, third]);
  });

  it('GC-8f: the cycle is seed-relative, not hard-coded — seeded with light, three toggles produce [dark, auto, light]', () => {
    const { deps, applyCalls } = recordingDeps('light');
    const controller = createThemeToggleController(deps);

    controller.toggle();
    controller.toggle();
    controller.toggle();

    expect(applyCalls.map(([mode]) => mode)).toEqual(['dark', 'auto', 'light']);
  });

  it('GC-8g: isAuto() tracks the in-memory mode — true at seed auto, false after one toggle, true again after three', () => {
    const { deps } = recordingDeps('auto');
    const controller = createThemeToggleController(deps);

    expect(controller.isAuto()).toBe(true);
    controller.toggle();
    expect(controller.isAuto()).toBe(false);
    controller.toggle();
    controller.toggle();
    expect(controller.isAuto()).toBe(true);
  });

  it('GC-8h: syncSystemTheme(true) calls apply(auto, { prefersDark: true }) and render(auto, true), leaving mode() at auto', () => {
    const { deps, applyCalls, renderCalls } = recordingDeps('auto');
    const controller = createThemeToggleController(deps);

    controller.syncSystemTheme(true);

    expect(applyCalls).toEqual([['auto', { prefersDark: true }]]);
    expect(renderCalls).toEqual([['auto', true]]);
    expect(controller.mode()).toBe('auto');
  });

  describe('GC-8i: the controller never reads storage itself', () => {
    afterEach(() => {
      Reflect.deleteProperty(globalThis, 'localStorage');
    });

    it('constructing and toggling the controller while a throwing globalThis.localStorage sentinel is installed neither throws nor changes the cycle sequence', () => {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('SecurityError');
        },
      });

      const { deps, applyCalls } = recordingDeps('auto');

      expect(() => {
        const controller = createThemeToggleController(deps);
        controller.toggle();
        controller.toggle();
        controller.toggle();
      }).not.toThrow();

      expect(applyCalls.map(([mode]) => mode)).toEqual(['light', 'dark', 'auto']);
    });
  });
});

describe('GC-8j: source guard on nav.ts — a per-click storage read must never be reintroduced', () => {
  const navSource = readFileSync(new URL('./nav.ts', import.meta.url), 'utf8');
  const stripped = navSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(?<!:)\/\/.*$/gm, '');

  it('contains readStoredMode( exactly once (the mount-time seed)', () => {
    const matches = stripped.match(/readStoredMode\(/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('contains cycleThemeMode zero times — the cycle belongs to the controller now', () => {
    expect(stripped).not.toContain('cycleThemeMode');
  });

  it('constructs createThemeToggleController( exactly once', () => {
    const matches = stripped.match(/createThemeToggleController\(/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('wires isAuto: exactly once', () => {
    const matches = stripped.match(/isAuto:/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("handleThemeToggleClick's body contains neither readStoredMode nor resolveStorage", () => {
    const start = stripped.indexOf('function handleThemeToggleClick');
    expect(start).toBeGreaterThanOrEqual(0);
    const end = stripped.indexOf('\n  }', start);
    const body = stripped.slice(start, end);
    expect(body).not.toContain('readStoredMode');
    expect(body).not.toContain('resolveStorage');
  });
});
