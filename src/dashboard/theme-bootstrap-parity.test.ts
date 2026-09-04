/**
 * Behavioural parity pin for the inline pre-paint theme bootstrap embedded in
 * `index.html` (D-06).
 *
 * `index.html`'s own header comment states the contract this test exists to
 * hold: "Theme bootstrap: src/dashboard/theme.ts is the source of truth for
 * this logic (parseThemeMode / resolveEffectiveTheme). This inline copy is a
 * DELIBERATE duplication and must stay behaviourally identical, including
 * the 'light' | 'dark' | 'auto' allow-list — that allow-list is the
 * T-16-TH-01 mitigation and must never be dropped from this inline copy."
 * The inline copy cannot be removed: it must run synchronously, before the
 * stylesheet link, so nothing that loads as an ES module (which `theme.ts`
 * does) can replace it without letting the page paint the wrong theme first.
 *
 * There is no DOM/CSSOM in this test run (vitest environment is 'node', no
 * DOM-emulation library installed — same note as `styles.test.ts`). Parity
 * is therefore proven by extracting the inline `<script>` block's text and executing it
 * for real inside a `node:vm` sandbox with stubbed globals, never by string
 * matching. A source-text-only pin would still pass an inverted branch as
 * long as the literals were present; this pin cannot.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { describe, expect, it } from 'vitest';

import { resolveEffectiveTheme, THEME_STORAGE_KEY } from './theme.js';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

/**
 * Extracts the FIRST `<script>` tag with no attributes — the inline
 * bootstrap — never the trailing `<script type="module" src="./main.ts">`.
 * Throws loudly rather than returning '' so a malformed/renamed index.html
 * fails every test in this file, not one silently short-circuiting.
 */
function extractInlineBootstrap(source: string): string {
  const match = source.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('inline theme bootstrap script not found in index.html');
  }
  return match[1];
}

// Parsed once at module scope: a malformed index.html fails every test in
// this file loudly, rather than one test silently short-circuiting.
const bootstrapScript = extractInlineBootstrap(html);

/** The most recent media-query string passed to the sandboxed matchMedia. */
let lastMediaQuery: string | null = null;

interface RunBootstrapOptions {
  storedValue: string | null;
  prefersDark: boolean;
  throwOnGet?: boolean;
}

/**
 * Executes the real extracted bootstrap script inside a fresh `node:vm`
 * context with stubbed `localStorage`/`window`/`document` globals, and
 * returns the `data-theme` value it applied (or `null` if it applied none).
 */
function runBootstrap({
  storedValue,
  prefersDark,
  throwOnGet = false,
}: RunBootstrapOptions): string | null {
  let appliedTheme: string | null = null;
  const sandbox = {
    localStorage: {
      getItem(): string | null {
        if (throwOnGet) throw new Error('blocked');
        return storedValue;
      },
    },
    window: {
      matchMedia(query: string) {
        lastMediaQuery = query;
        return { matches: prefersDark };
      },
    },
    document: {
      documentElement: {
        setAttribute(name: string, value: string) {
          if (name === 'data-theme') appliedTheme = value;
        },
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(bootstrapScript, sandbox);
  return appliedTheme;
}

describe('inline theme bootstrap — behavioural parity with theme.ts (D-06)', () => {
  it("explicit 'light' wins over system dark preference", () => {
    const applied = runBootstrap({ storedValue: 'light', prefersDark: true });
    expect(applied).toBe(resolveEffectiveTheme('light', true));
    expect(applied).toBe('light');
  });

  it("explicit 'light' matches system light preference", () => {
    const applied = runBootstrap({ storedValue: 'light', prefersDark: false });
    expect(applied).toBe(resolveEffectiveTheme('light', false));
    expect(applied).toBe('light');
  });

  it("explicit 'dark' with system light preference stays dark", () => {
    const applied = runBootstrap({ storedValue: 'dark', prefersDark: false });
    expect(applied).toBe(resolveEffectiveTheme('dark', false));
    expect(applied).toBe('dark');
  });

  it("explicit 'dark' with system dark preference stays dark", () => {
    const applied = runBootstrap({ storedValue: 'dark', prefersDark: true });
    expect(applied).toBe(resolveEffectiveTheme('dark', true));
    expect(applied).toBe('dark');
  });

  it("'auto' with system preferring dark resolves to 'dark'", () => {
    const applied = runBootstrap({ storedValue: 'auto', prefersDark: true });
    expect(applied).toBe(resolveEffectiveTheme('auto', true));
    expect(applied).toBe('dark');
  });

  it("'auto' with system preferring light resolves to 'light'", () => {
    const applied = runBootstrap({ storedValue: 'auto', prefersDark: false });
    expect(applied).toBe(resolveEffectiveTheme('auto', false));
    expect(applied).toBe('light');
  });
});

describe('inline theme bootstrap — allow-list and robustness (T-16-TH-01)', () => {
  // A stored value outside the 'light' | 'dark' | 'auto' allow-list must
  // resolve identically to no stored value at all (falls back to auto).
  // Written as individually-named it() blocks rather than it.each, matching
  // this repo's existing convention (no it.each usage in theme-related test
  // files — see theme.test.ts's six-combination matrix).
  const outOfAllowlistValues = ['system', 'Light', '', '{}'];
  for (const storedValue of outOfAllowlistValues) {
    it(`falls back to auto-equivalent behaviour for stored value ${JSON.stringify(storedValue)}`, () => {
      expect(runBootstrap({ storedValue, prefersDark: true })).toBe('dark');
      expect(runBootstrap({ storedValue, prefersDark: false })).toBe('light');
    });
  }

  it('falls back to auto-equivalent behaviour when nothing is persisted (storedValue: null)', () => {
    expect(runBootstrap({ storedValue: null, prefersDark: true })).toBe('dark');
    expect(runBootstrap({ storedValue: null, prefersDark: false })).toBe('light');
  });

  it('still applies a theme when localStorage.getItem throws, rather than leaving the document unthemed', () => {
    const applied = runBootstrap({ storedValue: null, prefersDark: true, throwOnGet: true });
    expect(applied).not.toBeNull();
    expect(applied).toBe('dark');
  });

  it('reads the exact storage key exported as THEME_STORAGE_KEY from theme.ts, not a copied literal', () => {
    // Asserting against the imported constant (rather than a hard-coded
    // 'dashboard-theme' string in this test) means a rename of the key in
    // theme.ts breaks this pin too, catching a silent divergence.
    expect(bootstrapScript).toContain(`'${THEME_STORAGE_KEY}'`);
  });

  it("passes exactly '(prefers-color-scheme: dark)' to matchMedia when resolving mode 'auto'", () => {
    runBootstrap({ storedValue: 'auto', prefersDark: true });
    expect(lastMediaQuery).toBe('(prefers-color-scheme: dark)');
  });
});

describe('inline theme bootstrap — pre-paint position', () => {
  it('both the inline <script> and the stylesheet <link> tags are present in index.html', () => {
    // Asserting >= 0 rather than comparing against -1 means a renamed or
    // removed tag fails this check loudly instead of silently.
    const scriptIndex = html.indexOf('<script>');
    const stylesheetIndex = html.indexOf('<link rel="stylesheet"');
    expect(scriptIndex).toBeGreaterThanOrEqual(0);
    expect(stylesheetIndex).toBeGreaterThanOrEqual(0);
  });

  it(
    'the inline <script> appears before the stylesheet <link>, because a deferred module ' +
      'script does not run until after HTML parsing, which would let the page paint the ' +
      'wrong theme first',
    () => {
      const scriptIndex = html.indexOf('<script>');
      const stylesheetIndex = html.indexOf('<link rel="stylesheet"');
      expect(scriptIndex).toBeLessThan(stylesheetIndex);
    }
  );
});
