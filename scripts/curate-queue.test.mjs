/**
 * Source-structure regression guard for Phase 29's review queue client
 * (`scripts/curate-queue/index.ts`).
 *
 * It proves NOTHING about rendering, clicking, focus or network behaviour —
 * vitest runs here with `environment: 'node'`, this project has no
 * DOM-simulation library and no headless browser, and the queue client never
 * runs in the test process at all. A green run is coverage of SOURCE TEXT
 * SHAPE only; the sole proof of the interaction is plan 29-08's human
 * browser checkpoint.
 *
 * Comments are stripped before every assertion so a doc comment can never
 * satisfy or defeat an assertion below. This is a reimplementation of
 * `scripts/curate-overlay.test.mjs`'s `stripComments` regex, mirrored rather
 * than imported — this file is `.mjs` under `scripts/`, so it cannot import
 * a `.ts` helper from `src/`.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/** Mirrors curate-overlay.test.mjs's stripComments (block comments, then //-to-EOL, `:`-guarded). */
function stripComments(source) {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

describe('stripComments meta-test — a doc comment can never satisfy or defeat an assertion below', () => {
  it('removes a forbidden token inside both a // comment and a /* */ block', () => {
    const sample = [
      '// contains FORBIDDEN_TOKEN in a line comment',
      '/* contains FORBIDDEN_TOKEN in a block comment */',
      'const real = "no token here";',
    ].join('\n');
    const stripped = stripComments(sample);
    expect(stripped.includes('FORBIDDEN_TOKEN')).toBe(false);
    expect(stripped.includes('const real = "no token here";')).toBe(true);
  });
});

const INDEX_RAW = readFileSync(new URL('./curate-queue/index.ts', import.meta.url), 'utf8');
const INDEX_SOURCE = stripComments(INDEX_RAW);

describe('D-10 / CUR-02 — transport reused, not reimplemented', () => {
  it("imports the overlay transport from '../curate-overlay/index.js'", () => {
    expect(INDEX_SOURCE.includes("from '../curate-overlay/index.js'")).toBe(true);
  });

  it('imports saveExclusion, removeExclusion and runRecompute', () => {
    expect(INDEX_SOURCE.includes('saveExclusion')).toBe(true);
    expect(INDEX_SOURCE.includes('removeExclusion')).toBe(true);
    expect(INDEX_SOURCE.includes('runRecompute')).toBe(true);
  });

  it('contains no second write call site and no reload of its own', () => {
    expect(INDEX_SOURCE.includes('/__curate/exclusions')).toBe(false);
    expect(INDEX_SOURCE.includes('/__curate/recompute')).toBe(false);
    expect(INDEX_SOURCE.includes('location.reload(')).toBe(false);
  });
});

describe('D-08 — reads only the mirrored public JSON', () => {
  it('fetches the three root-absolute mirrored documents', () => {
    const matches = INDEX_SOURCE.match(/fetch\('\/strava-widgets\/data\//g) || [];
    expect(matches.length).toBe(3);
  });

  it('never issues a fetch missing its leading slash', () => {
    expect(INDEX_SOURCE.includes("fetch('data/")).toBe(false);
    expect(INDEX_SOURCE.includes("fetch('__curate")).toBe(false);
    expect(INDEX_SOURCE.includes('fetch(`__curate')).toBe(false);
  });
});

describe('D-09 / OD-3 — zero styling, no HTML strings', () => {
  it('references no stylesheet, no style element, and no HTML-string assignment', () => {
    for (const forbidden of [
      '.css',
      "createElement('style')",
      'innerHTML',
      'insertAdjacentHTML',
      'outerHTML',
      'document.write',
    ]) {
      expect(INDEX_SOURCE.includes(forbidden)).toBe(false);
    }
  });

  it('className is assigned exactly once', () => {
    const matches = INDEX_SOURCE.match(/className\s*=/g) || [];
    expect(matches.length).toBe(1);
  });
});

describe('D-01 — the client does not re-derive the population', () => {
  it('imports and uses deriveFlaggedActivities', () => {
    expect(INDEX_SOURCE.includes('deriveFlaggedActivities')).toBe(true);
  });

  it('never filters by guard name itself', () => {
    for (const forbidden of ["'ceiling'", "'world-record'", "'max-speed'"]) {
      expect(INDEX_SOURCE.includes(forbidden)).toBe(false);
    }
  });
});

describe('D-04 — demotions only', () => {
  it('never references a pace-quality signal', () => {
    for (const forbidden of ['paceQuality', 'qualityTier', 'severe']) {
      expect(INDEX_SOURCE.includes(forbidden)).toBe(false);
    }
  });
});

describe('D-01 structural absence from the publish pipeline', () => {
  const CONFIG_FILES = [
    new URL('../vite.config.ts', import.meta.url),
    new URL('../vite.config.pages.ts', import.meta.url),
    new URL('../tsconfig.json', import.meta.url),
    new URL('../scripts/build-widgets.mjs', import.meta.url),
  ];

  it('vite.config.ts, vite.config.pages.ts, tsconfig.json and build-widgets.mjs never reference the queue client or its bundle output', () => {
    // grep-equivalent: raw source, comments included — a stray mention
    // anywhere in these four files (even in a comment) is worth catching.
    for (const fileUrl of CONFIG_FILES) {
      const source = readFileSync(fileUrl, 'utf8');
      expect(source.includes('curate-queue')).toBe(false);
      expect(source.includes('.curate-dist')).toBe(false);
    }
  });
});
