import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';

/*
 * Regression guard for WR-04 (theme toggle invisible in light mode) and for
 * design-token parity with src/widgets/shared/theme-manager.ts. There is no
 * DOM/CSSOM in this test run (vitest environment is 'node'), so we assert on
 * the stylesheet TEXT read from disk rather than on computed styles.
 */

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

// Comments-stripped view used only for selector/rule structure parsing, so a
// header comment mentioning a selector name (e.g. "Theme toggle") can never
// be mistaken for part of a rule head. Declaration-text assertions below
// (fill/prefers-color-scheme absence) intentionally use the raw `css`
// instead, so even a stray mention in a comment would still fail loudly.
//
// The non-greedy `[\s\S]*?` is deliberate, not an oversight to "simplify"
// into a greedy `[\s\S]*`. Non-greedy is first-`*/`-wins, which is exactly
// how a real CSS parser terminates a comment — the moment it sees a closing
// `*/`, the comment is over, regardless of what `/*`-like text appears
// later. GAP 1 (19-VALIDATION.md, Phase 19 gap-closure record) was exactly
// this: a stray `*/` inside a comment's prose terminated it early. A greedy
// regex would swallow everything between the FIRST `/*` and the LAST `*/`
// in the whole file, diverging from real parsing and hiding this entire
// class of defect far more thoroughly than the current, correct behavior.
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Finds the exact selector at the start of a rule and returns the text
 * between its opening and closing brace. Anchoring on the selector followed
 * by optional whitespace and `{` (rather than a plain substring search)
 * stops a coincidental match elsewhere in the file (e.g. as part of a
 * combined-selector list) from passing an assertion it shouldn't. Throws
 * when the selector is not found, so a deleted rule fails loudly rather
 * than silently matching an empty string.
 */
function declarationsFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ruleRegex = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  const match = cssNoComments.match(ruleRegex);
  if (!match) {
    throw new Error(`No rule found for selector: ${selector}`);
  }
  return match[1];
}

/**
 * Splits a rule head into its comma-separated selectors without breaking
 * apart a selector list nested inside a functional pseudo-class such as
 * `:not(a, b)` or `:where(...)`. Walks the head character by character,
 * tracking parenthesis depth, and breaks only on a comma at depth 0.
 *
 * `selectorListDeclares` and `bodyForSelectorListToken` used to split each
 * rule head with a plain, unconditional comma split, which splits on every
 * comma regardless of context. Plan 19-03's shared hover selector head
 * contains commas *inside* `:where(:not(...))` — splitting on `,` there
 * produces standalone fragments byte-identical to real, unrelated
 * top-level selectors, one of which (`[aria-disabled="true"]`) is the
 * exact needle asserted at the disabled-treatment rule below. That
 * assertion returned the right answer only because the hover rule's body
 * happens not to contain `opacity: 0.6` — a coincidence of what the body
 * currently holds, not a property of the helper being selector-boundary-safe.
 * Depth-aware splitting keeps that fragment inside its parent selector
 * where it belongs, so a nested selector can never be mistaken for a
 * top-level one. See WR-03 (19-REVIEW.md) for the finding and the
 * reference implementation this is based on.
 */
function splitTopLevelSelectors(head: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of head) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current.trim());
  return parts;
}

/**
 * Confirms some rule whose selector list includes `needle` declares
 * `declaration` in its body — covers both the combined-selector form
 * (`.theme-toggle, .app-nav__toggle { ... }`) and two separate rules.
 */
function selectorListDeclares(needle: string, declaration: string): boolean {
  // Match any rule head (text up to `{`) that contains `needle` as a
  // selector token, then check the rule body for the declaration.
  const ruleHeadAndBody = /([^{}]+)\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = ruleHeadAndBody.exec(cssNoComments)) !== null) {
    const [, head, body] = match;
    const selectors = splitTopLevelSelectors(head);
    if (selectors.some((s) => s === needle) && body.includes(declaration)) {
      return true;
    }
  }
  return false;
}

/**
 * Throws when a rule-scanning helper is about to resolve a match whose head
 * begins with `@` (WR-02, 19-REVIEW.md). All three rule-scanning helpers in
 * this file iterate `/([^{}]+)\{([^}]*)\}/g`, whose body class `[^}]*`
 * permits `{`, so an `@media` prelude is consumed as a rule HEAD and the
 * first nested rule is swallowed into its "body" — none of these helpers
 * descend into `@media` blocks. Applied only in the two helpers below that
 * return a single resolved match and already throw on failure
 * (`bodyForSelectorListToken`, `ruleWithHeadContaining`); deliberately NOT
 * applied in `selectorListDeclares`, which iterates every rule in the file
 * and returns a boolean — throwing there would fire on the first at-rule
 * pseudo-rule it walks past and break unrelated, currently-passing
 * assertions that have nothing to do with the needle it is checking.
 */
function assertNotAtRuleHead(head: string, needle: string): void {
  const trimmedHead = head.trim();
  if (trimmedHead.startsWith('@')) {
    throw new Error(
      `Matched an @-rule prelude ("${trimmedHead}") while looking for "${needle}" — ` +
        'these helpers do not descend into @media (or other at-rule) blocks, so this ' +
        'match is the at-rule prelude itself, not the rule the caller intended.',
    );
  }
}

/**
 * Returns the declaration body of the rule whose selector list contains
 * `needle` as an exact, post-trim token — the same selector-boundary
 * anchoring `selectorListDeclares` uses and for the same reason (so a bare
 * `:focus-visible` is never confused with `.cta:focus-visible` or
 * `.app-nav__link:focus-visible`). Unlike `selectorListDeclares`, this
 * returns the body text itself rather than a boolean, for callers (plan
 * 19-07's numeric z-index comparison) that need to parse a value out of it
 * rather than just check a declaration is present. Throws when no rule's
 * selector list contains the token, so a deleted rule fails loudly.
 */
function bodyForSelectorListToken(needle: string): string {
  const ruleHeadAndBody = /([^{}]+)\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = ruleHeadAndBody.exec(cssNoComments)) !== null) {
    const [, head, body] = match;
    const selectors = splitTopLevelSelectors(head);
    if (selectors.some((s) => s === needle)) {
      assertNotAtRuleHead(head, needle);
      return body;
    }
  }
  throw new Error(`No rule found whose selector list contains: ${needle}`);
}

/**
 * Parses the numeric value of `property: <int>` out of a declaration body
 * (e.g. the body returned by `declarationsFor` or `bodyForSelectorListToken`).
 * Used to compare two z-index values numerically (plan 19-07) rather than
 * as literal strings, so the comparison still means something if either
 * value is retuned. Throws when the property is absent, so a deleted
 * declaration fails loudly rather than silently comparing against NaN.
 */
function extractNumericDeclaration(body: string, property: string): number {
  const match = body.match(new RegExp(`${property}:\\s*(-?\\d+)`));
  if (!match) {
    throw new Error(`No numeric ${property} declaration found in: ${body}`);
  }
  return Number(match[1]);
}

/**
 * Finds the first rule whose head (the text up to `{`) contains `needle` as
 * a substring, and returns `head + body` concatenated. `selectorListDeclares`
 * cannot serve this case: it splits a rule head on `,` and requires an exact
 * post-trim match against one comma-separated token, but plan 19-03's shared
 * hover selector head contains commas *inside* `:where(:not(…))` — splitting
 * on `,` there produces fragments like `.pagination__button--current` that
 * never equal the full head, so no split-token would ever match. Scanning
 * for a substring instead sidesteps the comma-splitting problem entirely.
 * Throws when no rule's head contains the needle, so a deleted rule fails
 * loudly rather than silently matching nothing.
 */
function ruleWithHeadContaining(needle: string): string {
  const ruleHeadAndBody = /([^{}]+)\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = ruleHeadAndBody.exec(cssNoComments)) !== null) {
    const [, head, body] = match;
    if (head.includes(needle)) {
      assertNotAtRuleHead(head, needle);
      return head + body;
    }
  }
  throw new Error(`No rule found with head containing: ${needle}`);
}

// Self-tests for splitTopLevelSelectors (19-08, WR-03), so a future edit to
// the splitter fails on its own terms rather than only through a downstream
// selectorListDeclares assertion that might not exercise the nested-comma
// path it exists to guard.
describe('splitTopLevelSelectors — self-tests', () => {
  it('splits a plain multi-selector list on every comma', () => {
    expect(splitTopLevelSelectors('.a, .b, .c')).toEqual(['.a', '.b', '.c']);
  });

  it('splits the real shared hover head from styles.css into exactly one top-level selector', () => {
    // Derived from the actual stylesheet rather than a pasted copy, so this
    // case tracks the real selector if it is ever edited.
    const match = cssNoComments.match(/([^{}]*:where\(:not\([^{}]*)\{/);
    if (!match) {
      throw new Error('shared hover rule head not found in styles.css');
    }
    const parts = splitTopLevelSelectors(match[1]);
    expect(parts).toHaveLength(1);
    expect(parts).not.toContain('[aria-disabled="true"]');
  });

  it('keeps a selector with nested parentheses inside :not(:is(...)) whole', () => {
    const head = '.a:not(:is(.b, .c)), .d';
    expect(splitTopLevelSelectors(head)).toEqual(['.a:not(:is(.b, .c))', '.d']);
  });

  it('does not produce spurious empty parts for an empty-ish or single-selector head', () => {
    expect(splitTopLevelSelectors('.solo')).toEqual(['.solo']);
    expect(splitTopLevelSelectors('  .solo  ')).toEqual(['.solo']);
    expect(splitTopLevelSelectors('')).toEqual(['']);
  });
});

describe('styles.css — WR-04 theme toggle visibility regressions', () => {
  it('data-theme="light" declares color-scheme: light', () => {
    expect(declarationsFor(':root[data-theme="light"]')).toContain('color-scheme: light');
  });

  it('data-theme="dark" declares color-scheme: dark', () => {
    expect(declarationsFor(':root[data-theme="dark"]')).toContain('color-scheme: dark');
  });

  it('.theme-toggle pins color: var(--text)', () => {
    expect(selectorListDeclares('.theme-toggle', 'color: var(--text)')).toBe(true);
  });

  it('.app-nav__toggle pins color: var(--text)', () => {
    expect(selectorListDeclares('.app-nav__toggle', 'color: var(--text)')).toBe(true);
  });

  it('.theme-toggle__icon is hidden by default', () => {
    expect(declarationsFor('.theme-toggle__icon')).toContain('display: none');
  });

  it('.theme-toggle__icon--active is shown and accent-colored', () => {
    const decl = declarationsFor('.theme-toggle__icon--active');
    expect(decl).toContain('display: inline');
    expect(decl).toContain('color: var(--accent)');
  });

  it('the dead fill: var(--accent) declaration is gone for good', () => {
    expect(css).not.toContain('fill: var(--accent)');
  });

  it('no prefers-color-scheme media query was introduced — data-theme is the only source of truth', () => {
    expect(css).not.toContain('prefers-color-scheme');
  });
});

describe('styles.css — token parity with src/widgets/shared/theme-manager.ts', () => {
  it('light tokens match theme-manager.ts', () => {
    const decl = declarationsFor(':root[data-theme="light"]');
    expect(decl).toContain('--accent: #fc4c02');
    expect(decl).toContain('--text: #333333');
  });

  it('dark tokens match theme-manager.ts', () => {
    const decl = declarationsFor(':root[data-theme="dark"]');
    expect(decl).toContain('--accent: #ff6b35');
    expect(decl).toContain('--text: #e0e0e0');
  });
});

describe('styles.css — Phase 17 tokens', () => {
  it('--accent-strong is #b3390a in the light theme block', () => {
    expect(declarationsFor(':root[data-theme="light"]')).toContain('--accent-strong: #b3390a');
  });

  it('--accent-strong is #c2410c in the dark theme block', () => {
    expect(declarationsFor(':root[data-theme="dark"]')).toContain('--accent-strong: #c2410c');
  });

  it('all four --chart-* tokens are present with the exact light values in the light block', () => {
    const decl = declarationsFor(':root[data-theme="light"]');
    expect(decl).toContain('--chart-pace: #fc4c02');
    expect(decl).toContain('--chart-hr: #e11d48');
    expect(decl).toContain('--chart-cadence: #0891b2');
    expect(decl).toContain('--chart-elevation: #16a34a');
  });

  it('all four --chart-* tokens are present with the exact dark values in the dark block', () => {
    const decl = declarationsFor(':root[data-theme="dark"]');
    expect(decl).toContain('--chart-pace: #ff6b35');
    expect(decl).toContain('--chart-hr: #fb7185');
    expect(decl).toContain('--chart-cadence: #22d3ee');
    expect(decl).toContain('--chart-elevation: #4ade80');
  });

  it('all five --zone-* tokens are present in the bare :root block', () => {
    const decl = declarationsFor(':root');
    expect(decl).toContain('--zone-1: #3b82f6');
    expect(decl).toContain('--zone-2: #22c55e');
    expect(decl).toContain('--zone-3: #eab308');
    expect(decl).toContain('--zone-4: #f97316');
    expect(decl).toContain('--zone-5: #ef4444');
  });
});

// The five Phase 19 blocks below assert only that a rule exists in the
// stylesheet SOURCE — never a rendered outcome. Not proven here: that the
// ring actually renders, that it renders unclipped, that hover/disabled
// states are perceptually legible, or that the segmented control's
// silhouette matches. Plan 19-05's human checkpoint is the sole proof of
// rendering (19-VALIDATION.md's two-mechanism constraint).
//
// Helper audit (19-08 Task 2, at-rule nesting added by 19-10 Task 2 / WR-02),
// so a future author extending this file knows which layer a new claim
// belongs in. Each line states what the helper proves and the class of
// false pass it cannot rule out:
// - declarationsFor: proves a rule with this exact selector exists and
//   returns its body. Cannot rule out a body edit that preserves the
//   substring an assertion checks while changing the declaration's actual
//   meaning (e.g. an added `!important`, or the same property repeated
//   later in the same body with a different value that wins the cascade).
//   Its regex requires the literal selector text immediately (optional
//   whitespace only) before `{`, so it does not share the other three
//   helpers' at-rule blind spot below — `.app-nav\s*{` never appears as a
//   substring inside an `@media` prelude's swallowed body.
// - selectorListDeclares (now depth-aware, WR-03/19-08): proves some rule
//   whose top-level selector list contains `needle` also contains
//   `declaration` as a body substring. Cannot rule out a coincidental
//   substring match inside an unrelated declaration's value — it checks
//   `.includes()` on the whole body, not that `declaration` is a distinct,
//   whole `property: value` pair. At-rule nesting (WR-02, below): does NOT
//   throw on an at-rule pseudo-rule, because it iterates every rule in the
//   file and returns a boolean — it silently walks past the wrong block
//   rather than raising, so a false `false` from this helper may mean
//   either "not declared" or "declared, but only inside an @media block
//   this helper cannot see."
// - bodyForSelectorListToken: proves some rule whose top-level selector
//   list contains `needle` exists, and returns its body text for the
//   caller to parse a value out of (plan 19-07/19-10's numeric z-index
//   comparisons). At-rule nesting (WR-02, below): guarded — throws rather
//   than silently returning the wrong block's body.
// - ruleWithHeadContaining: proves some rule's head contains `needle` as a
//   raw substring; deliberately does not parse selector structure at all.
//   Cannot rule out matching the wrong rule if `needle` is short/generic
//   enough to also appear in an unrelated head, or missing the intended
//   rule entirely if `cssNoComments`'s own comment-stripping is ever wrong.
//   At-rule nesting (WR-02, below): guarded — throws rather than silently
//   matching the wrong block.
// - splitTopLevelSelectors: proves a comma nested inside parentheses is
//   never mistaken for a selector-list boundary. Cannot rule out a false
//   split on an attribute selector containing a literal comma inside its
//   own quoted value (e.g. `[data-x="a,b"]`) — a construct that does not
//   occur anywhere in this stylesheet today, so it is untested by the
//   self-tests above and would need a fifth case if it were ever added.
//
// At-rule nesting (WR-02, 19-REVIEW.md): all THREE rule-scanning helpers —
// selectorListDeclares, bodyForSelectorListToken, ruleWithHeadContaining —
// share one generic regex, `/([^{}]+)\{([^}]*)\}/g`, whose body class
// `[^}]*` permits `{`. Against an `@media` block, that regex consumes the
// `@media (...)` prelude itself as a rule HEAD and swallows the first
// nested rule into its "body" — seven pseudo-rules come out this way in
// this stylesheet today. No assertion in this file may target a rule
// living inside an `@media` (or other at-rule) block; none of these three
// helpers descend into one. `assertNotAtRuleHead` now makes the two
// single-match helpers (`bodyForSelectorListToken`, `ruleWithHeadContaining`)
// fail loudly with a message naming the at-rule prelude and the needle,
// instead of either silently matching the wrong block or failing closed.
// It is deliberately NOT applied inside `selectorListDeclares`, which walks
// every rule and returns a boolean rather than resolving a single match —
// throwing there would fire on the first at-rule pseudo-rule it passes and
// break unrelated, currently-passing assertions; that helper's blind spot
// stays a silent `false`, documented above rather than eliminated.
//
// All helpers above operate on stylesheet TEXT — none of them observe a
// rendered page. GAP 1 (19-VALIDATION.md) proved text-level agreement between
// an assertion and the source characters is not sufficient on its own: a
// comment terminated early and discarded a declaration a real parser never
// saw, while every substring assertion in this file still passed. The
// parse-level block plan 19-06 added below (`styles.css — Phase 19 radius
// tokens (parse level)`, using esbuild's real CSS parser) is the layer
// that closes that specific gap; a future claim that depends on the file
// actually PARSING as intended — not merely containing the right
// characters — belongs there, not in a new substring assertion here.
//
// Scope, stated plainly (T-19G-FALSEGREEN-13, accepted risk, not
// eliminated): the 40 pre-existing Phase 19 substring assertions in the
// blocks below were not individually rewritten to close every theoretical
// false pass the four helpers above cannot rule out. Doing so is out of
// scope for a gap-closure pass and would put a large unreviewed diff in
// front of the phase gate for defects that are theoretical here, not
// observed — the residual risk is mitigated in depth, not eliminated, by
// the parse-level block's independent check on the one property (custom
// property registration) GAP 1 actually broke.

describe('styles.css — Phase 19 control baseline', () => {
  it('input, select, textarea declares the shared box treatment', () => {
    expect(selectorListDeclares('input', 'border: 1px solid var(--border)')).toBe(true);
    expect(selectorListDeclares('input', 'background: var(--surface)')).toBe(true);
    expect(selectorListDeclares('input', 'padding: var(--space-xs) var(--space-sm)')).toBe(true);
    expect(selectorListDeclares('input', 'border-radius: var(--radius-control)')).toBe(true);
    expect(selectorListDeclares('input', 'min-height: 32px')).toBe(true);
  });

  it('select declares min-height: 32px', () => {
    expect(selectorListDeclares('select', 'min-height: 32px')).toBe(true);
  });

  it('textarea declares font: inherit', () => {
    expect(selectorListDeclares('textarea', 'font: inherit')).toBe(true);
  });

  it('input[type="checkbox"] declares border: none', () => {
    expect(selectorListDeclares('input[type="checkbox"]', 'border: none')).toBe(true);
  });

  it('no vendor pseudo-element rule was introduced (D-02)', () => {
    expect(css).not.toContain('::-webkit-');
  });
});

describe('styles.css — Phase 19 button baseline', () => {
  it('button declares the quiet baseline', () => {
    expect(selectorListDeclares('button', 'font: inherit')).toBe(true);
    expect(selectorListDeclares('button', 'min-height: 32px')).toBe(true);
    expect(selectorListDeclares('button', 'cursor: pointer')).toBe(true);
    expect(selectorListDeclares('button', 'border-radius: var(--radius-control)')).toBe(true);
  });

  // WR-01 (19-REVIEW.md): this used to assert only `.calendar-day--tint-1`
  // and `.calendar-day--tint-4` of the four required tint exclusions, so
  // deleting `--tint-2` or `--tint-3` from styles.css left the suite green
  // while reintroducing exactly the defect the shared-hover-rule comment
  // there says the exclusions prevent. Now asserts all eight required
  // exclusion tokens.
  //
  // Limitation, stated rather than silently left implicit: `ruleWithHeadContaining`
  // returns `head + body` concatenated, so these `.toContain()` checks
  // cannot distinguish a selector token appearing in the HEAD (an actual
  // `:not()` exclusion) from the same text appearing as a substring inside
  // a declaration VALUE in the body. Fixing that would mean changing the
  // helper's return shape, which every caller depends on — out of scope for
  // this task. The next reader should know this assertion proves presence
  // of the token somewhere in the rule's text, not specifically that it is
  // one of the `:not()` exclusions.
  it('the shared hover rule excludes disabled controls and the accent-strong fills (all eight tokens)', () => {
    const rule = ruleWithHeadContaining(':where(:not(');
    expect(rule).toContain('color-mix(in srgb, var(--surface) 92%, var(--text))');
    expect(rule).toContain(':disabled');
    expect(rule).toContain('[aria-disabled="true"]');
    expect(rule).toContain('.pagination__button--current');
    expect(rule).toContain('.segmented__option--active');
    expect(rule).toContain('.calendar-day--tint-1');
    expect(rule).toContain('.calendar-day--tint-2');
    expect(rule).toContain('.calendar-day--tint-3');
    expect(rule).toContain('.calendar-day--tint-4');
  });

  it('no bare button:hover rule exists', () => {
    expect(selectorListDeclares('button:hover', '')).toBe(false);
  });

  it('.cta:hover mixes from var(--accent)', () => {
    expect(
      selectorListDeclares('.cta:hover', 'color-mix(in srgb, var(--accent) 92%, var(--text))'),
    ).toBe(true);
  });

  it('.activity-table tbody tr:hover mixes from var(--surface) toward var(--text)', () => {
    expect(declarationsFor('.activity-table tbody tr:hover')).toContain(
      'color-mix(in srgb, var(--surface) 92%, var(--text))',
    );
  });

  it('the retired literal-black row-hover mix is gone', () => {
    expect(css).not.toContain('92%, black)');
  });
});

describe('styles.css — Phase 19 disabled treatment', () => {
  it(':disabled declares the muted treatment', () => {
    expect(selectorListDeclares(':disabled', 'color: var(--text-secondary)')).toBe(true);
    expect(selectorListDeclares(':disabled', 'opacity: 0.6')).toBe(true);
    expect(selectorListDeclares(':disabled', 'cursor: default')).toBe(true);
  });

  it('[aria-disabled="true"] declares opacity: 0.6', () => {
    expect(selectorListDeclares('[aria-disabled="true"]', 'opacity: 0.6')).toBe(true);
  });

  // CR-03 (19-REVIEW.md): `opacity` applies to an element's entire rendered
  // output, including its own `box-shadow` — so the `:disabled,
  // [aria-disabled="true"] { opacity: 0.6 }` rule above composites the
  // `:focus-visible` ring at 60% on any element that is BOTH focusable and
  // disabled/aria-disabled. Calendar rest days (`calendar.ts`) are exactly
  // that: real, focusable `<button>` elements with no `disabled` attribute,
  // carrying only `aria-disabled="true"`, kept in the Tab order on purpose.
  // Recomputing the file's own W3C relative-luminance numbers with the
  // accent ring stop blended at 60% over the backdrop gives 2.19:1 light and
  // 2.93:1 dark — both fail the 3:1 SC 1.4.11 non-text floor the
  // :focus-visible comment documents at 3.40:1 / 6.02:1. The invariant this
  // test guards: a control that is both focusable and disabled must not
  // composite its focus ring below that floor. Uses selectorListDeclares for
  // presence (both `:disabled:focus-visible` and
  // `[aria-disabled="true"]:focus-visible` must be in the same rule's
  // selector list) and an anchored `;`-split fragment check for the values,
  // so `opacity: 1` cannot be satisfied by a substring of some other
  // declaration.
  it('a control that is both focusable and aria-disabled restores full opacity under :focus-visible, not composited below the 3:1 ring floor (CR-03)', () => {
    expect(selectorListDeclares(':disabled:focus-visible', 'opacity: 1')).toBe(true);
    expect(selectorListDeclares('[aria-disabled="true"]:focus-visible', 'opacity: 1')).toBe(true);

    const body = bodyForSelectorListToken(':disabled:focus-visible');
    const fragments = body
      .split(';')
      .map((fragment) => fragment.trim())
      .filter(Boolean);
    expect(fragments).toEqual(['opacity: 1']);

    // The at-rest dimming (D-07) must remain exactly as shipped.
    expect(selectorListDeclares(':disabled', 'opacity: 0.6')).toBe(true);
  });
});

describe('styles.css — Phase 19 focus ring', () => {
  // declarationsFor(':focus-visible') cannot be used here: its regex is not
  // selector-boundary-anchored, and plan 19-03 added a `.cta:focus-visible`
  // rule earlier in the file whose head literally contains the substring
  // ":focus-visible {", so declarationsFor would match that rule instead of
  // the bare one this block guards. selectorListDeclares splits each rule
  // head on `,` and requires an exact post-trim token match, so it
  // correctly discriminates ":focus-visible" from ".cta:focus-visible" and
  // from ".app-nav__link:focus-visible" — no new helper needed for the
  // boolean presence checks below.
  //
  // Plan 19-07 (GAP 2, 19-05 checkpoint row 6): the two assertions added by
  // that plan — the stacking-declaration check and the numeric ordering
  // check against `.records-jump` — prove only that the source declares
  // `position: relative; z-index: 1` on the bare selector, and that the two
  // z-index values are ordered as intended. They prove NOTHING about
  // whether the ring is actually visible in a rendered browser: there is no
  // DOM/CSSOM in this test run (vitest environment is 'node'), so no
  // assertion here can observe paint order. Row 6 of 19-VALIDATION.md's
  // Manual-Only Verifications table, re-run by plan 19-09's human
  // checkpoint, is the SOLE proof that the ring renders unoccluded. The
  // defect this whole gap-closure phase exists to repair is precisely a
  // green source-level suite being mistaken for a rendered guarantee —
  // these two assertions must not be read as closing that gap by
  // themselves.
  it(':focus-visible declares the two-tone box-shadow ring and suppresses the UA outline', () => {
    expect(selectorListDeclares(':focus-visible', 'outline: none')).toBe(true);
    expect(
      selectorListDeclares(
        ':focus-visible',
        'box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent)',
      ),
    ).toBe(true);
    expect(selectorListDeclares(':focus-visible', 'outline-offset')).toBe(false);
  });

  it('the ring is the file\'s only box-shadow declaration', () => {
    expect((cssNoComments.match(/box-shadow/g) ?? []).length).toBe(1);
  });

  // A whole-file raw-css negative on the bare word "overflow" cannot be used
  // here: .sr-only legitimately declares `overflow: hidden` and
  // .records-jump/.splits-scroll both declare `overflow-x`, so an unscoped
  // negative would fail for the wrong reason. This assertion is scoped to
  // .segmented specifically via declarationsFor.
  it('.segmented no longer clips its children', () => {
    expect(declarationsFor('.segmented')).not.toContain('overflow');
  });

  it('.sr-only still declares overflow: hidden (the fix above was not over-applied)', () => {
    expect(declarationsFor('.sr-only')).toContain('overflow: hidden');
  });

  it('.segmented__option end children carry the previous rounded silhouette', () => {
    expect(
      selectorListDeclares(
        '.segmented__option:first-child',
        'border-radius: var(--radius-control) 0 0 var(--radius-control)',
      ),
    ).toBe(true);
    expect(
      selectorListDeclares(
        '.segmented__option:last-child',
        'border-radius: 0 var(--radius-control) var(--radius-control) 0',
      ),
    ).toBe(true);
  });

  // CR-02 (19-REVIEW.md): `.segmented__option` used to declare no
  // `border-radius` of its own, so the bare `button { border-radius:
  // var(--radius-control) }` baseline (0,0,1) reached every option
  // uncancelled — middle options of any 3+-option group rendered as fully
  // rounded pills instead of square-jointed segments, only the two
  // end-child rules (0,1,1) re-rounding the outer corners. This test
  // requires an exact, anchored `border-radius: 0` fragment — not a
  // `.toContain('border-radius: 0')` substring check — because the two
  // end-child rules' own values begin with the characters
  // `border-radius: 0 var(...)`, so a substring check would pass against
  // the wrong shape if the rules were ever merged. The second assertion
  // proves the fix is a cancellation at the option, not a weakening of the
  // baseline: a future "fix" that deletes the baseline's radius instead
  // must fail this test too.
  it('.segmented__option cancels the button baseline radius so middle options render square (CR-02)', () => {
    const body = bodyForSelectorListToken('.segmented__option');
    const fragments = body
      .split(';')
      .map((fragment) => fragment.trim())
      .filter(Boolean);
    expect(fragments).toContain('border-radius: 0');
    expect(selectorListDeclares('button', 'border-radius: var(--radius-control)')).toBe(true);
  });

  // WR-01 (19-REVIEW.md): .segmented's own corner radius used to be a
  // literal `border-radius: 4px`, while its end children above already
  // derived theirs from --radius-control -- container and children could
  // disagree if the token were ever retuned. Migrated onto the token so
  // there is one source of truth for this radius.
  it('.segmented derives its own corner radius from --radius-control, not a literal', () => {
    expect(declarationsFor('.segmented')).toContain('border-radius: var(--radius-control)');
  });

  it('.splits-scroll has room for the ring', () => {
    expect(declarationsFor('.splits-scroll')).toContain('padding: var(--space-xs)');
  });

  it('.records-jump padding is unchanged', () => {
    expect(declarationsFor('.records-jump')).toContain('padding: var(--space-sm)');
  });

  // GAP 2 fix (19-07): the bare :focus-visible rule is promoted to its own
  // stacking context so it paints above later in-flow siblings and
  // positioned neighbours. selectorListDeclares again discriminates the
  // bare selector from `.cta:focus-visible` / `.app-nav__link:focus-visible`.
  it(':focus-visible establishes a stacking context above later siblings and positioned neighbours', () => {
    expect(selectorListDeclares(':focus-visible', 'position: relative')).toBe(true);
    expect(selectorListDeclares(':focus-visible', 'z-index: 1')).toBe(true);
  });

  // The sticky-layer ordering invariant (CR-01, 19-REVIEW.md), extended from
  // the two-rung .records-jump-vs-ring check plan 19-07 added. That check
  // audited only downward and upward against `.records-jump`; it never
  // looked at `.app-nav`, which is `position: sticky` with no `z-index` at
  // all — a sticky element with `z-index: auto` paints in CSS 2.1 Appendix E
  // step 8, and the promoted ring paints in step 9, so a focused control
  // scrolled under the header painted OVER the opaque global nav on every
  // route. This assertion reads all four rungs of the ladder and asserts
  // they are strictly descending, in exactly this order, as parsed numbers
  // — not literal strings, so the comparison still means something if any
  // value is retuned — and pins the four exact expected values so a silent
  // renumbering that preserves order is still visible in the diff.
  // `bodyForSelectorListToken(':focus-visible')` is used for the ring
  // (not `declarationsFor`) for the reason stated above: its regex is not
  // selector-boundary-anchored and would match `.cta:focus-visible`.
  it('the sticky-layer ladder (.app-nav > .records-jump > .splits-table__km > :focus-visible) holds numerically and in order', () => {
    const appNavZIndex = extractNumericDeclaration(bodyForSelectorListToken('.app-nav'), 'z-index');
    const recordsJumpZIndex = extractNumericDeclaration(declarationsFor('.records-jump'), 'z-index');
    const splitsKmZIndex = extractNumericDeclaration(
      bodyForSelectorListToken('.splits-table__km'),
      'z-index',
    );
    const focusRingZIndex = extractNumericDeclaration(
      bodyForSelectorListToken(':focus-visible'),
      'z-index',
    );

    expect(appNavZIndex).toBe(20);
    expect(recordsJumpZIndex).toBe(10);
    expect(splitsKmZIndex).toBe(2);
    expect(focusRingZIndex).toBe(1);

    expect(appNavZIndex).toBeGreaterThan(recordsJumpZIndex);
    expect(recordsJumpZIndex).toBeGreaterThan(splitsKmZIndex);
    expect(splitsKmZIndex).toBeGreaterThan(focusRingZIndex);
  });
});

describe('styles.css — Phase 19 radius tokens', () => {
  it(':root declares both radius tokens', () => {
    const decl = declarationsFor(':root');
    expect(decl).toContain('--radius-control: 4px');
    expect(decl).toContain('--radius-panel: 8px');
  });

  it('the radius tokens are theme-invariant — neither [data-theme] block redeclares them', () => {
    expect(declarationsFor(':root[data-theme="light"]')).not.toContain('--radius-');
    expect(declarationsFor(':root[data-theme="dark"]')).not.toContain('--radius-');
  });

  it('the four retrofitted panel selectors use --radius-panel and --space-lg', () => {
    for (const selector of ['.error-state', '.empty-state', '.calendar-picker', '.config-notice']) {
      expect(selectorListDeclares(selector, 'border-radius: var(--radius-panel)')).toBe(true);
      expect(selectorListDeclares(selector, 'padding: var(--space-lg)')).toBe(true);
    }
  });

  it('.stat-grid uses gap: var(--space-lg)', () => {
    expect(selectorListDeclares('.stat-grid', 'gap: var(--space-lg)')).toBe(true);
  });

  it('no retired --space-2xl padding or --space-xl gap survived on these selectors', () => {
    expect(css).not.toContain('padding: var(--space-2xl)');
    expect(css).not.toContain('gap: var(--space-xl)');
  });
});

// GAP 1 (19-VALIDATION.md, Phase 19 gap-closure record): every assertion
// above this point is a substring match over the literal characters of
// styles.css. A stray `*/` inside the Phase 19 radius-scale comment
// (lines 55-57) terminated that comment early, so `--radius-control: 4px`
// was silently discarded by real CSS parsers while remaining present, byte
// for byte, in the source text — invisible to every assertion above,
// because they all check "are the right characters somewhere in the file"
// rather than "does the file parse to the declarations those characters
// claim to declare". This block proves the stronger claim: that the
// stylesheet PARSES, not merely that it contains the right characters.
describe('styles.css — Phase 19 radius tokens (parse level)', () => {
  it('the whole file has zero CSS syntax warnings under a real parser', () => {
    const result = transformSync(css, { loader: 'css' });
    expect(
      result.warnings,
      `esbuild reported ${result.warnings.length} warning(s) parsing styles.css: ${JSON.stringify(result.warnings)}`,
    ).toHaveLength(0);
  });

  // Anchored declaration-name match, not `.toContain()` and not a fragment
  // count. <groundwork> records both as blind to GAP 1's failure mode: the
  // leaked comment prose merges into a single ';'-separated fragment
  // together with the swallowed declaration, so the fragment count is 39 in
  // the broken file and 39 in the fixed file alike, and the literal
  // substring '--radius-control: 4px' is still present as text even while
  // the declaration itself is discarded by a real parser. Only checking
  // that a fragment's *name*, anchored at its start, matches the token name
  // discriminates broken from fixed. Do not "simplify" this back to
  // `.toContain()` or a count comparison — both were measured during
  // planning to pass identically against the broken and fixed file.
  it('--radius-control and --radius-panel are anchored, reachable :root declarations', () => {
    const rootBody = declarationsFor(':root');
    const fragments = rootBody
      .split(';')
      .map((fragment) => fragment.trim())
      .filter(Boolean);
    for (const name of ['--radius-control', '--radius-panel']) {
      const anchored = new RegExp(`^${name}\\s*:`);
      expect(
        fragments.some((fragment) => anchored.test(fragment)),
        `${name} is not an anchored :root declaration in the parsed fragment list`,
      ).toBe(true);
    }
  });

  // General form of GAP 1, dependency-free: any surviving `*/` in the
  // comment-stripped view means some comment terminated earlier than its
  // author intended and leaked prose into live stylesheet content, and
  // catches the next instance of this defect class regardless of whether
  // the leaked text happens to produce a parser warning this time.
  it('comment stripping leaves no stray */ — no comment terminated early', () => {
    expect(cssNoComments).not.toContain('*/');
  });
});
