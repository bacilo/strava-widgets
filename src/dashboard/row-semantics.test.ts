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
 *
 * D-01 guard, spelling-agnostic as of this round (20-10): the guard below
 * (`rowSemanticViolations`) scans `list.ts`, `records.ts`, `overview.ts` and
 * `row-navigation.ts` for a `tabindex`/`role` write in ANY spelling this
 * codebase uses — camelCase `tabIndex` or lowercase `setAttribute('tabindex',
 * ...)`, single- or double-quoted — not only the lowercase attribute form the
 * old two-`it` guard checked (proven vacuous by WR-02, 20-REVIEW.md: it read
 * `tabindex` at 0 while camelCase `tabIndex` was 1 in `list.ts` and 5 in
 * `records.ts`). Its allowlist is exactly two rules: a `tabindex` write is
 * permitted only when the receiver identifier is `heading` or `h1` AND the
 * value is `-1` (the six programmatic focus targets enumerated in
 * `rowSemanticViolations`'s own comment below), and a `role` write is
 * permitted only when its value is not `link`, case-insensitively (the two
 * `loading.setAttribute('role', 'status')` live regions). Widening either
 * rule to cover a new call site requires naming that call site explicitly in
 * the comment next to the rule — do not widen the receiver list, the allowed
 * value, or the role exclusion just to turn a red test green.
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

/**
 * Scans a comment-stripped source for every `tabindex`/`role` write, in any
 * spelling this codebase uses, and returns the full matched text of each one
 * that is NOT on the two-rule allowlist below. Replaces the old lowercase-
 * attribute-only guard (`countOccurrences(stripped, 'tabindex')`), proven
 * vacuous by WR-02 (20-REVIEW.md): `list.ts` and `records.ts` between them
 * use camelCase `tabIndex` six times, and the old guard's literal lowercase
 * needle never matched any of them.
 *
 * Four spellings are scanned, all case-insensitive and all global:
 *   1. property assignment   — `receiver.tabIndex = value;`
 *   2. attribute call        — `receiver.setAttribute('tabindex', value)`
 *   3. role property assign  — `receiver.role = 'value';`
 *   4. role attribute call   — `receiver.setAttribute('role', 'value')`
 * Each assignment form's `=` is anchored `=(?!=)` so a `===` comparison
 * (e.g. `el.tabIndex === -1`) can never be mistaken for an assignment.
 *
 * Allowlist, each rule naming the real call sites it exists for:
 *   - a tabindex hit is allowed only when the receiver identifier is
 *     `heading` or `h1` AND the value is `-1` — the six programmatic focus
 *     targets: `list.ts:1277`, `records.ts:248/465/602/679/797`,
 *     `overview.ts:283`. Any other receiver, or any other value, is a
 *     violation — including `row.tabIndex = -1` (allowed value, disallowed
 *     receiver), which is precisely the shape of the regression D-01 exists
 *     to block.
 *   - a role hit is permitted only when the receiver identifier is `loading`
 *     AND the value is `status`, compared case-insensitively — the two
 *     `loading.setAttribute('role', 'status')` live regions: `list.ts:1233`,
 *     `records.ts:762`. Any role write on any OTHER receiver is a violation
 *     whatever its value, because a role on a `<tr>` removes it from the
 *     table accessibility tree regardless of which role it is (WR-01,
 *     20-REVIEW.md: the old rule keyed on the value not being `link`, so
 *     `role="presentation"`, `role="button"` and `role="row"` on a `<tr>`
 *     all passed undetected — this rule is receiver-keyed instead, exactly
 *     like the tabindex rule above, so every one of those is now caught).
 *
 * Both role patterns accept a value written with single quotes, double
 * quotes, backticks, or as a bare identifier (a variable or constant): an
 * unresolvable value is reported as a violation rather than silently
 * skipped, since the receiver alone already decides the verdict.
 *
 * Widening either rule requires naming the new call site in the comment
 * above it — do not widen the receiver list, the allowed value, or the role
 * exclusion just to turn a red test green.
 */
function rowSemanticViolations(source: string): string[] {
  const violations: string[] = [];
  const isAllowedTabIndexReceiver = (receiver: string, value: string): boolean =>
    (receiver === 'heading' || receiver === 'h1') && value === '-1';
  const isAllowedRoleWrite = (receiver: string, value: string): boolean =>
    receiver === 'loading' && value.toLowerCase() === 'status';

  // 1. property assignment: `receiver.tabIndex = value;`
  const tabIndexPropertyPattern = /([A-Za-z_$][\w$]*)\s*\.\s*tabIndex\s*=(?!=)\s*([^;]*);/gi;
  for (const match of source.matchAll(tabIndexPropertyPattern)) {
    if (isAllowedTabIndexReceiver(match[1], match[2].trim())) continue;
    violations.push(match[0]);
  }

  // 2. attribute call: `receiver.setAttribute('tabindex', value)`
  const tabIndexAttrPattern =
    /([A-Za-z_$][\w$]*)\s*\.\s*setAttribute\s*\(\s*['"]tabindex['"]\s*,\s*['"]?([^'")]*?)['"]?\s*\)/gi;
  for (const match of source.matchAll(tabIndexAttrPattern)) {
    if (isAllowedTabIndexReceiver(match[1], match[2].trim())) continue;
    violations.push(match[0]);
  }

  // 3. role property assignment: `receiver.role = 'value';` — the quote
  // class accepts backticks alongside single/double quotes, and the second
  // alternation branch matches a bare identifier value (e.g. `role =
  // ROLE_LINK`) so a non-literal value is reported rather than skipped.
  const rolePropertyPattern =
    /([A-Za-z_$][\w$]*)\s*\.\s*role\s*=(?!=)\s*(?:['"`]([^'"`]*)['"`]|([A-Za-z_$][\w$]*))/gi;
  for (const match of source.matchAll(rolePropertyPattern)) {
    const value = match[2] !== undefined ? match[2] : match[3];
    if (isAllowedRoleWrite(match[1], value)) continue;
    violations.push(match[0]);
  }

  // 4. role attribute call: `receiver.setAttribute('role', 'value')` — same
  // backtick + bare-identifier widening as rule 3 above.
  const roleAttrPattern =
    /([A-Za-z_$][\w$]*)\s*\.\s*setAttribute\s*\(\s*['"]role['"]\s*,\s*(?:['"`]([^'"`]*)['"`]|([A-Za-z_$][\w$]*))\s*\)/gi;
  for (const match of source.matchAll(roleAttrPattern)) {
    const value = match[2] !== undefined ? match[2] : match[3];
    if (isAllowedRoleWrite(match[1], value)) continue;
    violations.push(match[0]);
  }

  return violations;
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
  // The four literal-count assertions this block used to carry
  // (`countOccurrences(..., 'tabindex')` and the `role="link"` / `'role',
  // 'link'` counts) are gone. WR-02 (20-REVIEW.md) proved them vacuous by
  // executed mutation: appending `tr.tabIndex = 0; tr.role = 'link';` to a
  // row builder left the lowercase-`tabindex` count at 0 in both `list.ts`
  // and `records.ts` while the camelCase `tabIndex` count sat at 1 and 5
  // respectively — the old guard could never see the exact regression D-01
  // exists to block. `rowSemanticViolations` (module scope, above) replaces
  // both with a single spelling-agnostic scan; see its own comment for the
  // four spellings covered and the two-rule allowlist.
  it('rowSemanticViolations finds no violations in list.ts, records.ts, overview.ts or row-navigation.ts', () => {
    const sources: Array<[string, string]> = [
      ['list.ts', listStripped],
      ['records.ts', recordsStripped],
      ['overview.ts', overviewStripped],
      ['row-navigation.ts', rowNavigationStripped],
    ];
    for (const [name, src] of sources) {
      expect(rowSemanticViolations(src), name).toEqual([]);
    }
  });
});

describe('rowSemanticViolations - self-tests', () => {
  it("tr.tabIndex = 0; yields exactly one violation whose text contains 'tabIndex'", () => {
    const violations = rowSemanticViolations('tr.tabIndex = 0;');
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('tabIndex');
  });

  it("tr.setAttribute('tabindex', '0'); yields exactly one violation", () => {
    expect(rowSemanticViolations("tr.setAttribute('tabindex', '0');")).toHaveLength(1);
  });

  it('tr.setAttribute("tabindex", "0"); (double quotes) yields exactly one violation', () => {
    expect(rowSemanticViolations('tr.setAttribute("tabindex", "0");')).toHaveLength(1);
  });

  it("tr.role = 'link'; yields exactly one violation", () => {
    expect(rowSemanticViolations("tr.role = 'link';")).toHaveLength(1);
  });

  it("tr.setAttribute('role', 'link'); yields exactly one violation", () => {
    expect(rowSemanticViolations("tr.setAttribute('role', 'link');")).toHaveLength(1);
  });

  it('row.tabIndex = -1; yields exactly one violation - the value is allowed but the receiver is not, so a row made programmatically focusable still trips the guard', () => {
    expect(rowSemanticViolations('row.tabIndex = -1;')).toHaveLength(1);
  });

  it('heading.tabIndex = -1; yields no violations', () => {
    expect(rowSemanticViolations('heading.tabIndex = -1;')).toEqual([]);
  });

  it('h1.tabIndex = -1; yields no violations', () => {
    expect(rowSemanticViolations('h1.tabIndex = -1;')).toEqual([]);
  });

  it("heading.setAttribute('tabindex', '-1'); yields no violations", () => {
    expect(rowSemanticViolations("heading.setAttribute('tabindex', '-1');")).toEqual([]);
  });

  it("loading.setAttribute('role', 'status'); yields no violations", () => {
    expect(rowSemanticViolations("loading.setAttribute('role', 'status');")).toEqual([]);
  });

  it('if (el.tabIndex === -1) { return; } yields no violations - the =(?!=) assignment anchor holds', () => {
    expect(rowSemanticViolations('if (el.tabIndex === -1) { return; }')).toEqual([]);
  });

  it("WR-02 blind-spot proof: the old guard's exact miss stays documented, and rowSemanticViolations closes it", () => {
    // The first expectation documents the defect the old guard shipped with
    // (WR-02, 20-REVIEW.md): a lowercase-only 'tabindex' needle counts zero
    // occurrences in "tr.tabIndex = 0;" because the real text is camelCase.
    // The second expectation documents that closure: the new, spelling-
    // agnostic guard catches the identical mutation. Do not "fix" the zero
    // in the first assertion - it is the proof the defect existed, not a bug.
    expect(
      countOccurrences('tr.tabIndex = 0;', 'tabindex'),
      "documents the old guard's miss - must stay 0",
    ).toBe(0);
    expect(
      rowSemanticViolations('tr.tabIndex = 0;'),
      'documents the new guard catching the identical mutation',
    ).toHaveLength(1);
  });

  it("tr.setAttribute('role', 'presentation'); yields exactly one violation - WR-01, a role hit is now receiver-keyed, not value-keyed", () => {
    expect(rowSemanticViolations("tr.setAttribute('role', 'presentation');")).toHaveLength(1);
  });

  it("tr.setAttribute('role', 'button'); yields exactly one violation - WR-01", () => {
    expect(rowSemanticViolations("tr.setAttribute('role', 'button');")).toHaveLength(1);
  });

  it("tr.role = 'row'; yields exactly one violation - WR-01, the property-assignment spelling of the same miss", () => {
    expect(rowSemanticViolations("tr.role = 'row';")).toHaveLength(1);
  });

  it('a backtick-quoted role value on tr yields exactly one violation - WR-01, the widened quote class', () => {
    expect(rowSemanticViolations('tr.setAttribute("role", `link`);')).toHaveLength(1);
  });

  it('an identifier-valued role write on tr yields exactly one violation - WR-01, an unresolvable value is reported rather than skipped', () => {
    expect(rowSemanticViolations("tr.setAttribute('role', ROLE_LINK);")).toHaveLength(1);
  });

  it("WR-01 blind-spot proof: the old value-keyed role rule's exact miss stays documented, and isAllowedRoleWrite closes it", () => {
    // Local replica of the OLD value-keyed rule this file shipped with
    // (WR-01, 20-REVIEW.md): a predicate reading `value.toLowerCase() !==
    // 'link'`, applied via the same role attribute-call pattern the guard
    // used before this fix. The first
    // expectation documents the defect existed - do not "fix" the zero to a
    // non-zero value, it is the proof, not a bug. The second expectation
    // documents that rowSemanticViolations, receiver-keyed as of this
    // round, catches the identical mutation.
    const oldIsAllowedRoleValue = (value: string): boolean => value.toLowerCase() !== 'link';
    const oldRoleAttrPattern =
      /([A-Za-z_$][\w$]*)\s*\.\s*setAttribute\s*\(\s*['"]role['"]\s*,\s*['"]([^'"]*)['"]\s*\)/gi;
    const oldViolations: string[] = [];
    for (const match of "tr.setAttribute('role', 'presentation');".matchAll(oldRoleAttrPattern)) {
      if (oldIsAllowedRoleValue(match[2])) continue;
      oldViolations.push(match[0]);
    }
    expect(oldViolations, "documents the old value-keyed rule's miss - must stay 0").toHaveLength(0);
    expect(
      rowSemanticViolations("tr.setAttribute('role', 'presentation');"),
      'documents the new receiver-keyed rule catching the identical mutation',
    ).toHaveLength(1);
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

describe('CR-02 - status-badge text is folded into whole-row aria-labels, not swallowed', () => {
  it('list.ts defines and uses activityRowAriaLabel exactly twice (its definition and its single use)', () => {
    expect(countOccurrences(listStripped, 'activityRowAriaLabel(')).toBe(2);
  });

  it('list.ts defines and uses composeRowAriaLabel exactly twice (its definition and its single use)', () => {
    expect(countOccurrences(listStripped, 'composeRowAriaLabel(')).toBe(2);
  });

  it('overview.ts defines and uses recentPrRowAriaLabel exactly twice (its definition and its single use)', () => {
    expect(countOccurrences(overviewStripped, 'recentPrRowAriaLabel(')).toBe(2);
  });

  it('overview.ts contains exactly one aria-label occurrence, and it sits on the same line as (or the line before) the recentPrRowAriaLabel call - proving no raw inline label template literal survives alongside the composed one', () => {
    expect(countOccurrences(overviewStripped, 'aria-label')).toBe(1);

    const lines = overviewStripped.split('\n');
    const ariaLabelLineIndex = lines.findIndex((line) => line.includes('aria-label'));
    // The LAST occurrence of `recentPrRowAriaLabel(` is the call site
    // (`rowEl.setAttribute('aria-label', recentPrRowAriaLabel(row))`), not
    // the first, which is the function's own `export function` definition.
    const usageLineIndex = lines.reduce(
      (found, line, i) => (line.includes('recentPrRowAriaLabel(') ? i : found),
      -1
    );
    expect(ariaLabelLineIndex).toBeGreaterThanOrEqual(0);
    expect(usageLineIndex).toBeGreaterThanOrEqual(0);
    expect(
      ariaLabelLineIndex === usageLineIndex || ariaLabelLineIndex === usageLineIndex - 1,
      `expected the aria-label occurrence (line ${ariaLabelLineIndex}) to be on the same line as, or the line before, the recentPrRowAriaLabel call (line ${usageLineIndex})`
    ).toBe(true);
  });

  it("list.ts's card and table id-prefix templates each appear exactly once, and are different strings — deviation note: a naive substring count of the bare 'activity-table-' literal would double-count the pre-existing, unrelated 'activity-table-wrapper' className (buildDesktopTable), so this guard matches the id-prefix TEMPLATE LITERAL construction ( `` `activity-card-${row.id}` `` / `` `activity-table-${row.id}` `` ) precisely rather than the bare prefix substring", () => {
    const cardPrefixTemplate = /`activity-card-\$\{row\.id\}`/g;
    const tablePrefixTemplate = /`activity-table-\$\{row\.id\}`/g;
    const cardMatches = listStripped.match(cardPrefixTemplate) ?? [];
    const tableMatches = listStripped.match(tablePrefixTemplate) ?? [];

    expect(cardMatches.length).toBe(1);
    expect(tableMatches.length).toBe(1);
    expect(cardMatches[0]).not.toBe(tableMatches[0]);
  });

  it('records.ts non-regression: the anchor stays confined to the Date cell and badges stay in the sibling Flags cell, so its aria-label never swallows them', () => {
    // Records.ts was confirmed unaffected by CR-02 (20-07-PLAN.md): its
    // row anchor lives in dateTd and its badges live in a sibling flagsTd,
    // so the anchor's curated aria-label was never positioned to swallow
    // badge text the way list.ts's and overview.ts's whole-row anchors
    // were. This guard is what keeps a future edit from accidentally
    // moving the badges inside the anchor and making this surface affected
    // too.
    expect(countOccurrences(recordsStripped, 'dateTd.appendChild(dateAnchor)')).toBeGreaterThanOrEqual(1);
    expect(countOccurrences(recordsStripped, 'appendLowConfidenceBadge(flagsTd')).toBeGreaterThanOrEqual(1);
    expect(countOccurrences(recordsStripped, 'appendBadge(flagsTd')).toBeGreaterThanOrEqual(1);
    expect(countOccurrences(recordsStripped, 'dateAnchor.appendChild(')).toBe(0);
    expect(countOccurrences(recordsStripped, 'appendBadge(dateTd')).toBe(0);
    expect(countOccurrences(recordsStripped, 'appendLowConfidenceBadge(dateTd')).toBe(0);
  });
});
