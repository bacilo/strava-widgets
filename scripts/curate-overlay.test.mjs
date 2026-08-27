/**
 * Source-structure regression guard for Phase 24's curate overlay
 * (`scripts/curate-overlay/index.ts` and `scripts/curate-overlay/exclusion-panel.ts`).
 *
 * It proves NOTHING about rendering, clicking, focus or network behaviour —
 * vitest runs here with `environment: 'node'`, this project has no
 * DOM-simulation library and no headless browser, and the overlay never
 * runs in the test process at all. A green run is coverage of SOURCE TEXT
 * SHAPE only; the sole proof of the interaction is plan 24-08's human
 * browser checkpoint.
 *
 * Comments are stripped before every assertion so a doc comment can never
 * satisfy an assertion about live code. This is a reimplementation of
 * `src/dashboard/row-semantics.test.ts`'s `stripComments` regexes — this
 * file is `.mjs` under `scripts/`, so it cannot import a `.ts` helper from
 * `src/`.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/** Mirrors row-semantics.test.ts's stripComments (block comments, then //-to-EOL, `:`-guarded). */
function stripComments(source) {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

const INDEX_RAW = readFileSync(new URL('./curate-overlay/index.ts', import.meta.url), 'utf8');
const PANEL_RAW = readFileSync(
  new URL('./curate-overlay/exclusion-panel.ts', import.meta.url),
  'utf8'
);
const INDEX_SOURCE = stripComments(INDEX_RAW);
const PANEL_SOURCE = stripComments(PANEL_RAW);
const BOTH_SOURCES = `${INDEX_SOURCE}\n${PANEL_SOURCE}`;

describe('D-03/OD-1 — not a second renderer', () => {
  it('neither file mentions the panel section builder, a whole-children replace, or a DOM-watching observer', () => {
    for (const forbidden of ['buildBestEffortsSection', 'replaceChildren', 'MutationObserver']) {
      expect(INDEX_SOURCE.includes(forbidden)).toBe(false);
      expect(PANEL_SOURCE.includes(forbidden)).toBe(false);
    }
  });

  it('index.ts calls location.reload()', () => {
    expect(INDEX_SOURCE.includes('location.reload()')).toBe(true);
  });
});

describe('D-03 — attaches via the documented seam only', () => {
  it('index.ts references the mount event name and the data-activity-id selector', () => {
    expect(INDEX_SOURCE.includes('dashboard:best-efforts-mounted')).toBe(true);
    expect(INDEX_SOURCE.includes('section[data-activity-id=')).toBe(true);
  });

  it('index.ts registers exactly one addEventListener(', () => {
    const matches = INDEX_SOURCE.match(/addEventListener\(/g) || [];
    expect(matches.length).toBe(1);
  });
});

describe('D-08 — confirm before destructive delete', () => {
  it('exclusion-panel.ts contains confirm(', () => {
    expect(PANEL_SOURCE.includes('confirm(')).toBe(true);
  });

  it('the panel calls its remove helper only from inside a confirm(-guarded path', () => {
    // The panel never issues the DELETE itself (that lives in index.ts's
    // removeExclusion); it calls a local doRemove() helper. Assert that
    // every call site of doRemove() in the panel source is preceded by a
    // confirm( call earlier in the same source text — offset ordering,
    // mirroring row-semantics.test.ts's "must appear after X" style.
    const confirmOffset = PANEL_SOURCE.indexOf('confirm(');
    expect(confirmOffset).toBeGreaterThanOrEqual(0);

    const callSitePattern = /doRemove\(\)/g;
    const callSites = [];
    let match;
    while ((match = callSitePattern.exec(PANEL_SOURCE)) !== null) {
      callSites.push(match.index);
    }
    // At least one call site (the confirm-guarded invocation), and every
    // call site to the helper function's *invocation* form (not its
    // `function doRemove()` declaration) must sit after the first confirm(.
    const invocationSites = callSites.filter((offset) => {
      const precedingText = PANEL_SOURCE.slice(0, offset);
      return !/function\s+$/.test(precedingText.slice(-20));
    });
    expect(invocationSites.length).toBeGreaterThan(0);
    for (const offset of invocationSites) {
      expect(offset).toBeGreaterThan(confirmOffset);
    }
  });
});

describe('D-08 — required reason enforced client-side too', () => {
  it('exclusion-panel.ts calls .trim() and never sets disabled = true on the Save button', () => {
    expect(PANEL_SOURCE.includes('.trim()')).toBe(true);
    expect(PANEL_SOURCE.includes('saveButton.disabled = true')).toBe(false);
    expect(PANEL_SOURCE.includes('disabled = true')).toBe(false);
  });
});

describe('OD-3 — zero CSS shipped', () => {
  it('neither file references a stylesheet, a style element, or HTML-string assignment', () => {
    for (const forbidden of ['.css', "createElement('style')", 'innerHTML']) {
      expect(INDEX_SOURCE.includes(forbidden)).toBe(false);
      expect(PANEL_SOURCE.includes(forbidden)).toBe(false);
    }
  });

  it("the literal className = 'curate-... class assignment appears exactly once across both files", () => {
    const matches = BOTH_SOURCES.match(/className = 'curate-/g) || [];
    expect(matches.length).toBe(1);
  });
});

describe('D-02 — root-absolute curate paths', () => {
  it('index.ts never issues a curate fetch missing its leading slash', () => {
    expect(INDEX_SOURCE.includes("fetch('__curate")).toBe(false);
    expect(INDEX_SOURCE.includes('fetch(`__curate')).toBe(false);
  });

  it('every CURATE_PREFIX-built curate URL is rooted at /__curate', () => {
    expect(INDEX_SOURCE.includes("const CURATE_PREFIX = '/__curate'")).toBe(true);
  });
});

describe('D-07 — recompute is separate from save', () => {
  it("the saveExclusion function body does not reference the recompute route", () => {
    const start = INDEX_SOURCE.indexOf('export async function saveExclusion');
    expect(start).toBeGreaterThanOrEqual(0);
    const nextExport = INDEX_SOURCE.indexOf('\nexport ', start + 1);
    const body = nextExport === -1 ? INDEX_SOURCE.slice(start) : INDEX_SOURCE.slice(start, nextExport);
    expect(body.includes('/__curate/recompute')).toBe(false);
  });
});

describe('D-01 — structural absence from the publish pipeline', () => {
  const CONFIG_FILES = [
    new URL('../vite.config.ts', import.meta.url),
    new URL('../vite.config.pages.ts', import.meta.url),
    new URL('../tsconfig.json', import.meta.url),
    new URL('../scripts/build-widgets.mjs', import.meta.url),
  ];

  it('vite.config.ts, vite.config.pages.ts, tsconfig.json and build-widgets.mjs never reference the overlay source or its bundle output', () => {
    // grep-equivalent: raw source, comments included — a stray mention
    // anywhere in these four files (even in a comment) is worth catching.
    for (const fileUrl of CONFIG_FILES) {
      const source = readFileSync(fileUrl, 'utf8');
      expect(source.includes('curate-overlay')).toBe(false);
      expect(source.includes('.curate-dist')).toBe(false);
    }
  });
});
