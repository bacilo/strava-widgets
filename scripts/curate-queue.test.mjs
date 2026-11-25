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

import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { deriveFlaggedActivities, fingerprintFor } from './curate-queue/derive-flagged.mjs';
import { normalizeFingerprint } from './curate-server.mjs';

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

  it('imports the reviewed transport and the view derivations', () => {
    const overlayImport = /import\s*\{([^}]*)\}\s*from '\.\.\/curate-overlay\/index\.js'/.exec(
      INDEX_SOURCE
    );
    expect(overlayImport).not.toBeNull();
    for (const name of ['saveReviewed', 'removeReviewed', 'loadReviewedDoc']) {
      expect(overlayImport[1].includes(name)).toBe(true);
    }
    const deriveImport = /import\s*\{([^}]*)\}\s*from '\.\/derive-flagged\.mjs'/.exec(INDEX_SOURCE);
    expect(deriveImport).not.toBeNull();
    for (const name of [
      'rowsForView',
      'deriveOrphans',
      'summarizeViews',
      'countMalformedReviewed',
      'QUEUE_VIEWS',
    ]) {
      expect(deriveImport[1].includes(name)).toBe(true);
    }
  });

  it('contains no reviewed route literal', () => {
    expect(INDEX_SOURCE.includes('/__curate/reviewed')).toBe(false);
    expect(INDEX_SOURCE.includes('/__curate')).toBe(false);
  });
});

describe('Phase 37 D-18 / D-17 / D-14 — one row at a time, blank required reason, confirmed un-review', () => {
  it('saveReviewed( has exactly one call site (the import line excluded)', () => {
    const calls = INDEX_SOURCE.split('\n')
      .filter((line) => !/^\s*saveReviewed,?\s*$/.test(line))
      .join('\n')
      .match(/saveReviewed\(/g);
    expect((calls || []).length).toBe(1);
  });

  it('has no select-all or bulk affordance', () => {
    const lower = INDEX_SOURCE.toLowerCase();
    for (const forbidden of ['select all', 'review all', 'bulk']) {
      expect(lower.includes(forbidden)).toBe(false);
    }
  });

  it('the review reason textarea is never assigned a value and the reason is trimmed', () => {
    expect(/reviewReasonInput\.value\s*=(?!=)/.test(INDEX_SOURCE)).toBe(false);
    expect(INDEX_SOURCE.includes('reviewReasonInput.value.trim()')).toBe(true);
    expect(INDEX_SOURCE.includes('A reason is required.')).toBe(true);
  });

  it('removeReviewed( is called only after a confirm( inside its own function', () => {
    const start = INDEX_SOURCE.indexOf('function mountUnreviewControl');
    expect(start).toBeGreaterThanOrEqual(0);
    const end = INDEX_SOURCE.indexOf('\nfunction ', start + 1);
    const body = INDEX_SOURCE.slice(start, end === -1 ? undefined : end);
    const confirmAt = body.indexOf('confirm(');
    const callAt = body.indexOf('removeReviewed(');
    expect(confirmAt).toBeGreaterThanOrEqual(0);
    expect(callAt).toBeGreaterThan(confirmAt);
    expect(INDEX_SOURCE.match(/removeReviewed\(/g).length).toBe(1);
  });
});

describe('Phase 37 D-15 / D-10 / D-13 — views, state attributes, orphans', () => {
  it('renders the view switcher and the row and orphan state attributes', () => {
    for (const token of [
      'data-queue-view',
      'aria-pressed',
      'data-tier',
      'data-review-state',
      'data-contaminated-metres',
      'data-queue-orphan',
      'changed since review',
      'no longer flagged',
    ]) {
      expect(INDEX_SOURCE.includes(token)).toBe(true);
    }
  });

  it('persists the active view in location.hash as #view=<name>', () => {
    expect(INDEX_SOURCE.includes('#view=')).toBe(true);
    expect(INDEX_SOURCE.includes('location.hash = `view=')).toBe(true);
  });
});

/**
 * Client/server contract (T-37-28). `fingerprintFn` is a parameter so the reachability check can
 * substitute a deliberately broken one and watch this fail.
 */
const GUARDS = ['ceiling', 'world-record', 'max-speed', 'unreliable-segment'];
const DISTANCES = ['400m', '1k', '1mi', '5k', '10k', 'half', 'marathon'];

function contractFailures(fingerprintFn) {
  const failures = [];
  for (const transported of [true, false]) {
    for (const distance of DISTANCES) {
      for (const guard of GUARDS) {
        const efforts = [
          { distance, demotion: { guard, reason: 'r' }, contaminated: null },
          { distance, demotion: null, contaminated: { guard } },
        ];
        const fp = fingerprintFn(efforts, transported);
        if (normalizeFingerprint(fp) !== fp) {
          failures.push(`${distance}:${guard}:${transported} -> ${JSON.stringify(fp)}`);
        }
      }
    }
  }
  return failures;
}

describe('Phase 37 fingerprint contract — every derived fingerprint passes normalizeFingerprint', () => {
  it('contract: every guard x distance x transported combination is accepted unchanged', () => {
    expect(contractFailures(fingerprintFor)).toEqual([]);
  });

  it('contract: the contract check can fail (a spaced fingerprint is rejected)', () => {
    const spaced = (efforts, t) => fingerprintFor(efforts, t).replace(',', ', ').replace('|', ' |');
    expect(contractFailures(spaced).length).toBeGreaterThan(0);
  });

  it('contract: the worst case (every distance x every guard, transported) is under the 1000-char cap', () => {
    const efforts = [];
    for (const distance of DISTANCES) {
      for (const guard of GUARDS) {
        efforts.push({ distance, demotion: { guard, reason: 'r' }, contaminated: { guard } });
      }
    }
    const fp = fingerprintFor(efforts, true);
    expect(fp.length).toBeLessThan(1000);
    expect(normalizeFingerprint(fp)).toBe(fp);
  });

  describe.skipIf(!existsSync(new URL('../data/stats/best-efforts.json', import.meta.url)))(
    'contract: live archive',
    () => {
      it('contract: every derived row fingerprint on the live archive is accepted', () => {
        const doc = JSON.parse(
          readFileSync(new URL('../data/stats/best-efforts.json', import.meta.url), 'utf8')
        );
        const rows = deriveFlaggedActivities(doc, null, null);
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
          expect(normalizeFingerprint(row.fingerprint)).toBe(row.fingerprint);
        }
      });
    }
  );
});

describe('D-08 (amended by Phase 37 D-16) — three mirrored fetches; the reviewed document is the one non-mirrored input, read through the transport', () => {
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

describe('D-04 (amended by Phase 37 D-06) — the page never re-derives membership; the derive owns guard-moved and transported', () => {
  it('never references a pace-quality signal', () => {
    for (const forbidden of [
      'paceQuality',
      'qualityTier',
      'severe',
      "'unreliable-segment'",
      'transportedCount',
      'pauseClassification',
    ]) {
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
