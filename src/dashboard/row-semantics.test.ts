import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * Source-structure regression guard for Phase 20's row-click interaction
 * pattern (`.planning/phases/20-row-click-interaction-pattern/`), in the
 * same spirit as `styles.test.ts` is a text guard over the stylesheet
 * source. This file proves that Phase 20's structural decisions are still
 * present in the TypeScript SOURCE of the view files — the removed CTA
 * columns, the single shared helper import, the navigable-row scoping, and
 * the deliberate absence of `tabindex`/`role="link"`/`keydown`.
 *
 * It proves NOTHING about rendering, clicking, focus order or screen-reader
 * announcement. Vitest runs in this repository with `environment: 'node'` —
 * this project has no DOM-simulation library dependency and no headless
 * browser anywhere in it — so nothing here can construct a live DOM,
 * dispatch a click event, or observe computed accessibility state. The
 * only proof of those is plan 20-05's human browser checkpoint. A green
 * run of this file is coverage of SOURCE TEXT SHAPE only; do not read it
 * as coverage of row clicking.
 */

const VIEWS_DIR = new URL('./views/', import.meta.url);

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, VIEWS_DIR), 'utf8');
}

const listSource = readSource('list.ts');
const overviewSource = readSource('overview.ts');
const recordsSource = readSource('records.ts');
const trendsSource = readSource('trends.ts');
const detailSectionsSource = readSource('detail-sections.ts');
const detailSource = readSource('detail.ts');
const detailMapSource = readSource('detail-map.ts');
const rowNavigationSource = readFileSync(
  new URL('./row-navigation.ts', import.meta.url),
  'utf8',
);

/**
 * Strips block comments, non-greedy (same first-closer-wins rationale as
 * `styles.test.ts`'s `cssNoComments`) and then `//`-to-end-of-line
 * comments, but only where the `//` is not immediately preceded by a `:` —
 * so a `https://` inside a string literal survives. Stripping is not
 * cosmetic here: without it, prose in a comment explaining that the "View
 * Activity" CTA was removed, or documenting why `row-navigation.ts` has no
 * `keydown` handler, would satisfy the very assertion that is supposed to
 * prove its absence in live code.
 */
export function stripComments(source: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

describe('stripComments - self-tests', () => {
  it('removes a trailing // comment', () => {
    expect(stripComments("const x = 1; // trailing comment\n")).toBe('const x = 1; \n');
  });

  it('removes a full-line // comment', () => {
    expect(stripComments('// a full line comment\nconst y = 2;')).toBe('\nconst y = 2;');
  });

  it('removes a block comment', () => {
    expect(stripComments('/* a block comment */ const z = 3;')).toBe(' const z = 3;');
  });

  it('preserves a string literal containing https://example.com', () => {
    const source = "const url = 'https://example.com';";
    expect(stripComments(source)).toBe(source);
  });
});

const listStripped = stripComments(listSource);
const overviewStripped = stripComments(overviewSource);
const recordsStripped = stripComments(recordsSource);
const trendsStripped = stripComments(trendsSource);
const detailSectionsStripped = stripComments(detailSectionsSource);
const rowNavigationStripped = stripComments(rowNavigationSource);

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('UX-02 - the CTAs are gone, and .cta survives', () => {
  it("list.ts, overview.ts and records.ts each contain zero occurrences of the quoted literal 'View Activity'", () => {
    // Assert the quoted form (with surrounding quotes), not the bare words,
    // so prose describing the removed CTA in a comment cannot collide with
    // this assertion by accident.
    expect(countOccurrences(listStripped, "'View Activity'")).toBe(0);
    expect(countOccurrences(overviewStripped, "'View Activity'")).toBe(0);
    expect(countOccurrences(recordsStripped, "'View Activity'")).toBe(0);
  });

  it("className = 'cta' appears exactly 7 times across src/dashboard/views/, with the exact per-file split", () => {
    // Per-file counts, not just the total - a total alone would stay green
    // if a retry button were deleted and a CTA re-added elsewhere.
    const detailCount = countOccurrences(stripComments(detailSource), "className = 'cta'");
    const trendsCount = countOccurrences(trendsStripped, "className = 'cta'");
    const detailMapCount = countOccurrences(stripComments(detailMapSource), "className = 'cta'");
    const recordsCount = countOccurrences(recordsStripped, "className = 'cta'");
    const listCount = countOccurrences(listStripped, "className = 'cta'");

    expect(detailCount).toBe(4);
    expect(trendsCount).toBe(1);
    expect(detailMapCount).toBe(1);
    expect(recordsCount).toBe(1);
    expect(listCount).toBe(0);
    expect(detailCount + trendsCount + detailMapCount + recordsCount + listCount).toBe(7);
  });
});

describe('UX-01 / D-03 - one definition of the URL and the click', () => {
  it("list.ts, overview.ts and records.ts each import from '../row-navigation.js'", () => {
    expect(listStripped).toContain("from '../row-navigation.js'");
    expect(overviewStripped).toContain("from '../row-navigation.js'");
    expect(recordsStripped).toContain("from '../row-navigation.js'");
  });

  it('activityDetailHref( appears the expected number of times per file', () => {
    expect(countOccurrences(listStripped, 'activityDetailHref(')).toBe(2);
    expect(countOccurrences(overviewStripped, 'activityDetailHref(')).toBe(1);
    expect(countOccurrences(recordsStripped, 'activityDetailHref(')).toBe(2);
  });

  it("the literal '#/activity/' appears zero times in list.ts, overview.ts and records.ts", () => {
    // detail.ts still builds its own prev/next hrefs and is deliberately
    // out of this phase's scope - do not assert on it here.
    expect(countOccurrences(listStripped, '#/activity/')).toBe(0);
    expect(countOccurrences(overviewStripped, '#/activity/')).toBe(0);
    expect(countOccurrences(recordsStripped, '#/activity/')).toBe(0);
  });
});

describe('D-10 - only activity rows are navigable', () => {
  it('attachRowNavigation( appears only in list.ts and records.ts, never in overview.ts, trends.ts or detail-sections.ts', () => {
    // The three zeros are the load-bearing half: they are what keeps the
    // Riegel, Trends and best-efforts tables from acquiring the marker
    // class and the pointer cursor that plan 20-04's Task 1 took away from
    // them (styles.css, Phase 20 block).
    expect(countOccurrences(listStripped, 'attachRowNavigation(')).toBe(1);
    expect(countOccurrences(recordsStripped, 'attachRowNavigation(')).toBe(2);
    expect(countOccurrences(overviewStripped, 'attachRowNavigation(')).toBe(0);
    expect(countOccurrences(trendsStripped, 'attachRowNavigation(')).toBe(0);
    expect(countOccurrences(detailSectionsStripped, 'attachRowNavigation(')).toBe(0);
  });
});

describe('D-05 - the Records columns are gone', () => {
  it("comment-stripped records.ts contains zero occurrences of label: 'Activity' and zero of the quoted literal 'Run'", () => {
    expect(countOccurrences(recordsStripped, "label: 'Activity'")).toBe(0);
    expect(countOccurrences(recordsStripped, "'Run'")).toBe(0);
  });
});

describe('D-01 - no fake link semantics on a <tr>', () => {
  it('comment-stripped list.ts, records.ts and row-navigation.ts each contain zero occurrences of tabindex', () => {
    expect(countOccurrences(listStripped, 'tabindex')).toBe(0);
    expect(countOccurrences(recordsStripped, 'tabindex')).toBe(0);
    expect(countOccurrences(rowNavigationStripped, 'tabindex')).toBe(0);
  });

  it('comment-stripped list.ts, records.ts and row-navigation.ts each contain zero occurrences of role="link" or \'role\', \'link\'', () => {
    expect(countOccurrences(listStripped, 'role="link"')).toBe(0);
    expect(countOccurrences(listStripped, "'role', 'link'")).toBe(0);
    expect(countOccurrences(recordsStripped, 'role="link"')).toBe(0);
    expect(countOccurrences(recordsStripped, "'role', 'link'")).toBe(0);
    expect(countOccurrences(rowNavigationStripped, 'role="link"')).toBe(0);
    expect(countOccurrences(rowNavigationStripped, "'role', 'link'")).toBe(0);
  });
});

describe('D-02 - Enter-only activation is deliberate', () => {
  // Space is deliberately not handled because it is the page-scroll key,
  // and a control announced as "link" takes Enter, not Space - see D-02 in
  // `.planning/phases/20-row-click-interaction-pattern/20-CONTEXT.md`. This
  // assertion exists specifically so a later agent adding a `keydown`
  // handler as a "fix" turns this suite red and has to read this comment
  // (and row-navigation.ts's own header) before doing it.
  it('comment-stripped row-navigation.ts contains zero occurrences of keydown', () => {
    expect(countOccurrences(rowNavigationStripped, 'keydown')).toBe(0);
  });
});

describe('Standing house rules (constraints 8 and 9)', () => {
  it('no file in src/dashboard/views/ contains a direct location.hash assignment', () => {
    // Matches `location.hash` followed by optional whitespace and `=` NOT
    // followed by another `=`, so trends.ts's legitimate
    // `window.location.hash !== newHash` comparison does not trip it - the
    // char after the whitespace there is `!`, not `=`, so the pattern never
    // matches at that site in the first place.
    const assignmentPattern = /location\.hash\s*=(?!=)/;
    for (const [name, stripped] of [
      ['list.ts', listStripped],
      ['overview.ts', overviewStripped],
      ['records.ts', recordsStripped],
      ['trends.ts', trendsStripped],
      ['detail-sections.ts', detailSectionsStripped],
    ] as const) {
      expect(assignmentPattern.test(stripped), `${name} should not assign location.hash directly`).toBe(
        false,
      );
    }
  });

  it("list.ts, overview.ts and records.ts each contain zero occurrences of innerHTML, outerHTML and insertAdjacentHTML", () => {
    for (const needle of ['innerHTML', 'outerHTML', 'insertAdjacentHTML']) {
      expect(countOccurrences(listStripped, needle)).toBe(0);
      expect(countOccurrences(overviewStripped, needle)).toBe(0);
      expect(countOccurrences(recordsStripped, needle)).toBe(0);
    }
  });
});
