import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';

import { NAVIGABLE_ROW_CLASS } from './row-navigation.js';

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
/**
 * FIRST-rule-wins: matches the FIRST `selector {`-shaped substring in
 * `source` (default: the real stylesheet, comments stripped) and returns its
 * body. Unsuitable for any assertion about a selector that can be declared
 * more than once — for that, use `bodyForSelectorListToken` (single rule) or
 * `cascadeWinningBodyDeclaring` (the cascade winner for one property across
 * every rule declaring that selector), both last-wins. Accepts an optional
 * `source` purely so the self-tests below can exercise first-wins against
 * small synthetic CSS strings without editing `styles.css` — every existing
 * call site omits it and keeps reading the real stylesheet exactly as
 * before (20-10, closing R3-WR-02's remaining first-wins call sites in this
 * file's own Phase 20 assertions — see the helper audit entry below).
 */
function declarationsFor(selector: string, source: string = cssNoComments): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ruleRegex = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  const match = source.match(ruleRegex);
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
 * Factory for the shared rule-scanning regex: text up to a `{`, captured as
 * the head, followed by everything up to the matching `}`, captured as the
 * body. Returns a FRESH `RegExp` instance on every call rather than a
 * shared module-level constant — a global-flag regex used with `.exec()` in
 * a loop is stateful (`lastIndex` advances as it scans), so two callers
 * sharing one instance, or the same instance reused across two separate
 * loops, would silently resume scanning from wherever the previous caller
 * left off. R3-IN-03 (19-REVIEW-round3.md): this rule-scanning regex literal
 * used to be duplicated verbatim in three helpers below; consolidated here
 * so a future correction to how rules are scanned (such as this plan's
 * at-rule and last-wins fixes) lands in one place instead of needing to
 * land in three.
 */
function RULE_SCANNER(): RegExp {
  return /([^{}]+)\{([^}]*)\}/g;
}

/**
 * Splits a declaration body on `;` into trimmed, non-empty fragments.
 * R3-IN-03 (19-REVIEW-round3.md): this `body.split(';').map(trim).filter(Boolean)`
 * idiom used to be repeated at three separate test call sites; consolidated
 * here for the same one-place-to-fix reason as `RULE_SCANNER` above.
 */
function declarationFragments(body: string): string[] {
  return body
    .split(';')
    .map((fragment) => fragment.trim())
    .filter(Boolean);
}

/**
 * Confirms some rule whose selector list includes `needle` declares
 * `declaration` in its body — covers both the combined-selector form
 * (`.theme-toggle, .app-nav__toggle { ... }`) and two separate rules.
 */
function selectorListDeclares(needle: string, declaration: string): boolean {
  // Match any rule head (text up to `{`) that contains `needle` as a
  // selector token, then check the rule body for the declaration.
  const ruleHeadAndBody = RULE_SCANNER();
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
 * Computes every `[start, end)` character offset range in `source` occupied
 * by an at-rule block (`@media`, or any other `@`-prefixed rule), by brace
 * matching: for each `@`-prelude's opening `{`, walk forward tracking
 * nesting depth until the block closes, and record the offsets.
 * R3-CR-01 (19-REVIEW-round3.md): the previous guard (a head-only check,
 * removed below) only rejected a match whose HEAD itself began with `@` —
 * the at-rule prelude pseudo-rule the shared scanner produces — which no
 * real needle ever reaches, since the only selector-list token an at-rule
 * prelude produces is the literal prelude text itself (e.g.
 * `'@media (max-width: 640px)'`). It did nothing for every rule NESTED
 * inside the block, which the scanner emits as an ordinary-looking
 * head+body pair with no `@` anywhere in it — proven executed against this
 * stylesheet in the review: `bodyForSelectorListToken('.app-nav[data-open="true"]
 * .app-nav__links')` resolved without throwing and returned the `@media`
 * body. Brace matching (rather than assuming exactly one level of nesting)
 * is deliberate: it finds the block's true end even for a construct nested
 * inside the `@media` body, not just a flat rule list.
 *
 * Parameterized by `source` (WR-03, 20-14): this used to be a module-level
 * constant computed once from `cssNoComments`, which is correct only for
 * callers reading the real stylesheet. Every offset-consuming helper below
 * also accepts an optional `source` for synthetic self-tests, and an offset
 * computed against a small synthetic string has no relationship to a range
 * computed from the (much larger) real file — comparing the two would
 * silently never match, making the at-rule check inert for every synthetic
 * `@media` proof. Memoized per distinct `source` string (a `Map`, not a
 * `WeakMap` — the keys here are string values compared by content, most
 * calls reuse the default `cssNoComments` instance) so repeated calls
 * against the real stylesheet stay O(1) after the first.
 */
const atRuleRangesCache = new Map<string, Array<[number, number]>>();
function computeAtRuleRanges(source: string): Array<[number, number]> {
  const cached = atRuleRangesCache.get(source);
  if (cached) {
    return cached;
  }
  const ranges: Array<[number, number]> = [];
  for (const m of source.matchAll(/@[a-z-]+[^{]*\{/g)) {
    let i = m.index! + m[0].length;
    let depth = 1;
    while (depth > 0 && i < source.length) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
      i++;
    }
    ranges.push([m.index!, i]);
  }
  atRuleRangesCache.set(source, ranges);
  return ranges;
}

/**
 * Predicate backing `assertNotAtRuleScoped` below: true when a match lives
 * inside an at-rule block — either because the match IS the at-rule prelude
 * itself (its head starts with `@`), or because its offset falls strictly
 * inside one of the brace-matched ranges `computeAtRuleRanges` returns for
 * `source`, which catches a nested rule at ANY position inside the block,
 * not only the first. Split out from `assertNotAtRuleScoped` (rather than
 * inlined into it) so `bodyForSelectorListToken` below can SKIP an
 * at-rule-scoped candidate and keep scanning for a valid one — a real
 * selector can appear once at the top level and again, separately, nested
 * inside `@media` (e.g. `.app-nav__toggle`), and the top-level rule must
 * still resolve even though a later or earlier at-rule-scoped match for the
 * same token exists. Takes `source` explicitly (WR-03, 20-14) rather than
 * reading a module-level constant, so the ranges it checks against always
 * match the text `offset` was computed from.
 */
function isAtRuleScoped(offset: number, head: string, source: string = cssNoComments): boolean {
  const trimmed = head.trim();
  return (
    trimmed.startsWith('@') ||
    computeAtRuleRanges(source).some(([start, end]) => offset > start && offset < end)
  );
}

/**
 * Throws when a rule-scanning helper is about to resolve a match that lives
 * inside an at-rule block (see `isAtRuleScoped` above for the two ways).
 * Replaces the old head-only guard entirely (R3-CR-01, 19-REVIEW-round3.md) —
 * one function rather than layering the range check alongside the old head
 * check, since the old check's one reachable case (the prelude itself) is a
 * strict subset of what the range check, plus a `startsWith('@')` fast path
 * kept for a clearer error message naming the prelude, now covers. Applied
 * only in the two helpers below that resolve a single match and already
 * throw on failure (`bodyForSelectorListToken`, `ruleWithHeadContaining`);
 * deliberately NOT applied in `selectorListDeclares`, which iterates every
 * rule in the file and returns a boolean — throwing there would fire on the
 * first at-rule it walks past and break unrelated, currently-passing
 * assertions that have nothing to do with the needle it is checking. Takes
 * `source` explicitly (WR-03, 20-14) for the same reason `isAtRuleScoped`
 * does — see that function's JSDoc.
 */
function assertNotAtRuleScoped(
  offset: number,
  head: string,
  needle: string,
  source: string = cssNoComments,
): void {
  const trimmed = head.trim();
  if (trimmed.startsWith('@')) {
    throw new Error(
      `Matched an @-rule prelude ("${trimmed}") while looking for "${needle}" — ` +
        'these helpers do not descend into @media (or other at-rule) blocks, so this ' +
        'match is the at-rule prelude itself, not the rule the caller intended.',
    );
  }
  if (computeAtRuleRanges(source).some(([start, end]) => offset > start && offset < end)) {
    throw new Error(
      `Match for "${needle}" resolves inside an at-rule block (head: "${trimmed}") — ` +
        'these helpers do not model at-rule nesting; assert on a top-level rule instead.',
    );
  }
}

/**
 * Returns the declaration body of the LAST rule (in source order) whose
 * selector list contains `needle` as an exact, post-trim token — the same
 * selector-boundary anchoring `selectorListDeclares` uses and for the same
 * reason (so a bare `:focus-visible` is never confused with
 * `.cta:focus-visible` or `.app-nav__link:focus-visible`). Collects every
 * NON-at-rule-scoped candidate match and returns the LAST one's body rather
 * than the first, matching how CSS actually resolves a selector redeclared
 * at equal specificity (R3-WR-02, 19-REVIEW-round3.md): the previous
 * first-wins behavior could read a value a later declaration overrides —
 * the review's executed case appended `.app-nav { z-index: 0; }` to the end
 * of the stylesheet and the old helper kept reporting `20`. An at-rule-scoped
 * candidate (R3-CR-01) is SKIPPED rather than counted, so a rule
 * unreachable inside `@media` can never win the last-wins comparison, and a
 * real top-level rule for the same selector (e.g. `.app-nav__toggle`,
 * which exists both at the top level and nested inside `@media`) still
 * resolves correctly even when the at-rule-scoped duplicate is scanned
 * first or last. Throws when NO non-at-rule-scoped match is found — naming
 * the specific at-rule block via `assertNotAtRuleScoped` if the token was
 * seen only at-rule-scoped (the review's proof case,
 * `.app-nav[data-open="true"] .app-nav__links`, which has no top-level
 * counterpart), or the generic "no rule found" message if the token was
 * never seen at all — so a deleted rule fails loudly either way. Accepts an
 * optional `source` (default: the real stylesheet with comments stripped)
 * purely so the self-tests below can exercise last-wins against small
 * synthetic CSS strings without editing `styles.css` — every existing call
 * site omits it and keeps reading the real stylesheet exactly as before.
 *
 * Exclusion (WR-03, 20-REVIEW.md): the returned body is the cascade winner
 * AMONG TOP-LEVEL RULES ONLY — at-rule-scoped rules are skipped by
 * construction (`isAtRuleScoped` above), so a guard built on this helper
 * cannot see a `@media` (or other at-rule) override of the same selector. A
 * guard that needs to rule that out must pair with `assertNoAtRuleOverride`.
 * The name is not qualified with "top-level" — `20-REVIEW.md` offered
 * `topLevelCascadeWinningBodyDeclaring` as an option for the sibling helper
 * below, but renaming any of these three would churn every Phase 16-19 call
 * site for no behavioural gain; the exclusion is recorded here in the docs
 * instead, so the naming question is closed rather than left open.
 */
function bodyForSelectorListToken(needle: string, source: string = cssNoComments): string {
  const ruleHeadAndBody = RULE_SCANNER();
  let match: RegExpExecArray | null;
  let lastBody: string | undefined;
  let found = false;
  let atRuleScopedMatch: { offset: number; head: string } | undefined;
  while ((match = ruleHeadAndBody.exec(source)) !== null) {
    const [, head, body] = match;
    const selectors = splitTopLevelSelectors(head);
    if (!selectors.some((s) => s === needle)) {
      continue;
    }
    if (isAtRuleScoped(match.index, head, source)) {
      atRuleScopedMatch = { offset: match.index, head };
      continue;
    }
    lastBody = body;
    found = true;
  }
  if (!found) {
    if (atRuleScopedMatch) {
      assertNotAtRuleScoped(atRuleScopedMatch.offset, atRuleScopedMatch.head, needle, source);
    }
    throw new Error(`No rule found whose selector list contains: ${needle}`);
  }
  return lastBody as string;
}

/**
 * Returns EVERY non-at-rule-scoped body (in source order) whose selector
 * list contains `needle` as an exact, post-trim token — the multi-body
 * sibling of `bodyForSelectorListToken`, which returns only the last one.
 * Exists because `.activity-row` is declared TWICE at the top level
 * (`styles.css:338`, carrying `display: flex`, and `styles.css:1530`,
 * carrying only `text-decoration: none`), and `bodyForSelectorListToken`
 * returning only the last body is wrong for a caller that needs to find
 * which of several bodies declares a given property (20-10, WR-03,
 * 20-REVIEW.md). Skips at-rule-scoped candidates via `isAtRuleScoped`,
 * exactly as `bodyForSelectorListToken` does, so a rule unreachable inside
 * `@media` never appears in the returned list. Throws using the same
 * two-path message shape `bodyForSelectorListToken` uses — naming the
 * at-rule block via `assertNotAtRuleScoped` when the token was seen only
 * at-rule-scoped, or the generic "no rule found" message when it was never
 * seen at all — so a deleted rule fails loudly rather than returning an
 * empty array a caller might mistake for "zero legitimately".
 *
 * Exclusion (WR-03, 20-REVIEW.md): the returned list is TOP-LEVEL bodies
 * ONLY — at-rule-scoped rules are skipped by construction, so a caller
 * (including `cascadeWinningBodyDeclaring`, built on this) cannot see a
 * `@media` (or other at-rule) override of the same selector. A guard that
 * needs to rule that out must pair with `assertNoAtRuleOverride`. Not
 * renamed to signal this (e.g. `topLevelBodiesForSelectorListToken`) for the
 * same reason `cascadeWinningBodyDeclaring` below is not renamed — see its
 * JSDoc for the recorded decision.
 */
function bodiesForSelectorListToken(needle: string, source: string = cssNoComments): string[] {
  const ruleHeadAndBody = RULE_SCANNER();
  let match: RegExpExecArray | null;
  const bodies: string[] = [];
  let atRuleScopedMatch: { offset: number; head: string } | undefined;
  while ((match = ruleHeadAndBody.exec(source)) !== null) {
    const [, head, body] = match;
    const selectors = splitTopLevelSelectors(head);
    if (!selectors.some((s) => s === needle)) {
      continue;
    }
    if (isAtRuleScoped(match.index, head, source)) {
      atRuleScopedMatch = { offset: match.index, head };
      continue;
    }
    bodies.push(body);
  }
  if (bodies.length === 0) {
    if (atRuleScopedMatch) {
      assertNotAtRuleScoped(atRuleScopedMatch.offset, atRuleScopedMatch.head, needle, source);
    }
    throw new Error(`No rule found whose selector list contains: ${needle}`);
  }
  return bodies;
}

/**
 * Returns the LAST body (in source order, among every non-at-rule-scoped
 * rule whose selector list contains `needle`) that declares `property` — the
 * cascade winner for that property, matching how CSS resolves a selector
 * declared more than once at the top level. `bodyForSelectorListToken`
 * returns the last body whether or not that body declares the property
 * under test, which is right for a single-declaration selector and wrong
 * for `.activity-row`: its last top-level body (`styles.css:1530`) carries
 * only `text-decoration: none`, so `bodyForSelectorListToken('.activity-row')
 * .toContain('display: flex')` would fail even though `display: flex` is
 * exactly what a real browser renders, from the earlier body at
 * `styles.css:338` (20-10, WR-03, 20-REVIEW.md). CSS resolves per property,
 * not per rule — the winner for `display` is the last body that mentions
 * `display`, which is what this computes. Anchors the property match to a
 * declaration boundary (start of body, or a preceding `;` or whitespace)
 * the same way `extractNumericDeclaration` does, so a property that is a
 * suffix of a longer property name can never match, and escapes `property`
 * with the same `.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` guard the other
 * helpers use (R3-IN-01). Throws, naming both `needle` and `property`, when
 * no non-at-rule-scoped body declares it.
 *
 * Exclusion (WR-03, 20-REVIEW.md): "matching how CSS resolves a selector
 * declared more than once" above is true only AMONG TOP-LEVEL RULES — this
 * is built on `bodiesForSelectorListToken`, which skips every at-rule-scoped
 * rule by construction, so this helper is structurally incapable of seeing a
 * `@media` (or other at-rule) override of `property` for `needle`. That is
 * not theoretical: `.activity-row`'s `display` is genuinely governed by the
 * 720px breakpoint in this very stylesheet (`styles.css:545-553`), and an
 * executed mutation appending a `@media` override of it left this helper
 * green. A guard built on this return value claims the rule is LIVE, so a
 * guard that needs that claim to be true must pair with
 * `assertNoAtRuleOverride`, which is the companion this helper cannot be by
 * construction. `20-REVIEW.md` offered renaming this to
 * `topLevelCascadeWinningBodyDeclaring` to make the exclusion visible in the
 * name; that rename is declined here because it would churn every Phase
 * 16-19 call site for no behavioural gain, and the exclusion is recorded in
 * this doc instead — the naming question is closed, not left open.
 */
function cascadeWinningBodyDeclaring(
  needle: string,
  property: string,
  source: string = cssNoComments,
): string {
  const bodies = bodiesForSelectorListToken(needle, source);
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declarationPattern = new RegExp(`(?:^|;|\\s)${escapedProperty}\\s*:`);
  for (let i = bodies.length - 1; i >= 0; i--) {
    if (declarationPattern.test(bodies[i])) {
      return bodies[i];
    }
  }
  throw new Error(
    `No body among the rules whose selector list contains "${needle}" declares "${property}"`,
  );
}

/**
 * Companion for the blind spot `cascadeWinningBodyDeclaring`,
 * `bodyForSelectorListToken` and `bodiesForSelectorListToken` cannot see by
 * construction (WR-03, 20-REVIEW.md): all three `continue` on
 * `isAtRuleScoped`, so none of them can ever observe an at-rule-scoped rule
 * that redeclares a guarded property for a guarded selector. This helper
 * scans the opposite half of the same rule list — reusing the same
 * `RULE_SCANNER()` walk and `splitTopLevelSelectors` head-splitting the
 * other helpers use, so the two halves can never disagree about what a
 * "rule" or a "selector token" is — keeps only the candidates whose selector
 * list contains `needle` as an exact token AND for which `isAtRuleScoped` is
 * true, and throws when any such body declares `property`. Anchors the
 * property match to a declaration boundary (start of body, or a preceding
 * `;` or whitespace) and escapes `property` with the same
 * `.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` guard the other helpers use
 * (R3-IN-01), so a property that is a suffix of a longer property name (e.g.
 * `index` inside `z-index`) can never match. The thrown message names the
 * selector, the property and the offending at-rule head, so a failure says
 * which breakpoint kills the rule. Accepts an optional `source` (default:
 * the real stylesheet with comments stripped), for the same reason the
 * other selector-token helpers do — every proof in this file's Phase 20
 * block exercises it against a synthetic CSS string rather than editing
 * `styles.css`.
 */
function assertNoAtRuleOverride(
  needle: string,
  property: string,
  source: string = cssNoComments,
): void {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declarationPattern = new RegExp(`(?:^|;|\\s)${escapedProperty}\\s*:`);
  const ruleHeadAndBody = RULE_SCANNER();
  let match: RegExpExecArray | null;
  while ((match = ruleHeadAndBody.exec(source)) !== null) {
    const [, head, body] = match;
    if (!isAtRuleScoped(match.index, head, source)) {
      continue;
    }
    const selectors = splitTopLevelSelectors(head);
    if (!selectors.some((s) => s === needle)) {
      continue;
    }
    if (declarationPattern.test(body)) {
      throw new Error(
        `An at-rule-scoped rule (head: "${head.trim()}") redeclares "${property}" for ` +
          `"${needle}" — this override is invisible to cascadeWinningBodyDeclaring, ` +
          'bodyForSelectorListToken and bodiesForSelectorListToken, which skip every ' +
          'at-rule-scoped rule by construction.',
      );
    }
  }
}

/**
 * WR-03 (22-REVIEW.md): the RETURNING sibling of the THROWING
 * `assertNoAtRuleOverride` above. Walks `RULE_SCANNER()` the same way,
 * keeps only the candidates for which `isAtRuleScoped` is true AND whose
 * `splitTopLevelSelectors(head)` contains `needle` as an exact token AND
 * whose body declares `property` at the same declaration-boundary-anchored
 * pattern the other helpers use — so the two functions share
 * `RULE_SCANNER`/`isAtRuleScoped`/`splitTopLevelSelectors` and can never
 * disagree about what a "rule" or a "selector token" is. Returns the
 * matching bodies in source order.
 *
 * `assertNoAtRuleOverride`'s `.toThrow`/`.not.toThrow` pairing is an
 * EXISTENCE proof only: it is satisfied by any override at any breakpoint
 * with any value, so a mutation that changes `min-width: 0` to
 * `min-width: 200px`, or `font-size: 14px` to `font-size: 40px`, leaves
 * every such assertion green. A guard that needs to know an override's
 * VALUE — not merely that one exists — must read it through this helper
 * instead. Throws, naming both `needle` and `property`, when no at-rule-
 * scoped body declares it, so a deleted override fails loudly rather than
 * silently comparing against `undefined`.
 */
function atRuleBodiesFor(
  needle: string,
  property: string,
  source: string = cssNoComments,
): string[] {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declarationPattern = new RegExp(`(?:^|;|\\s)${escapedProperty}\\s*:`);
  const ruleHeadAndBody = RULE_SCANNER();
  let match: RegExpExecArray | null;
  const bodies: string[] = [];
  while ((match = ruleHeadAndBody.exec(source)) !== null) {
    const [, head, body] = match;
    if (!isAtRuleScoped(match.index, head, source)) {
      continue;
    }
    const selectors = splitTopLevelSelectors(head);
    if (!selectors.some((s) => s === needle)) {
      continue;
    }
    if (declarationPattern.test(body)) {
      bodies.push(body);
    }
  }
  if (bodies.length === 0) {
    throw new Error(
      `No at-rule-scoped rule whose selector list contains "${needle}" declares "${property}"`,
    );
  }
  return bodies;
}

/**
 * Parses the numeric value of `property: <int>` out of a declaration body
 * (e.g. the body returned by `declarationsFor` or `bodyForSelectorListToken`),
 * returning the LAST match in source order rather than the first — matching
 * how CSS resolves a property redeclared twice in one rule body (R3-WR-02,
 * 19-REVIEW-round3.md): the review's executed case was a body declaring
 * `z-index` twice (20 then 0), where the old first-match helper reported 20
 * even though 0 is the real cascade winner. Escapes `property` with the
 * same `.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` guard `declarationsFor`
 * already uses (R3-IN-01) — without it, a property name containing a regex
 * metacharacter would be interpreted as regex syntax instead of a literal
 * string. Anchors each match to a declaration boundary (start of body, or a
 * preceding `;` or whitespace) so a property name that is a SUFFIX of a
 * longer property (e.g. `index` inside `z-index`) can never match. Throws
 * when there are no matches, so a deleted declaration fails loudly rather
 * than silently comparing against `NaN`.
 */
function extractNumericDeclaration(body: string, property: string): number {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...body.matchAll(new RegExp(`(?:^|;|\\s)${escaped}\\s*:\\s*(-?\\d+)`, 'g'))];
  if (matches.length === 0) {
    throw new Error(`No numeric ${property} declaration found in: ${body}`);
  }
  return Number(matches[matches.length - 1][1]);
}

/**
 * Finds the first rule whose head (the text up to `{`) contains `needle` as
 * a substring, and returns `head + '{' + body + '}'` — the brace boundary is
 * kept in the returned string (unlike a plain `head + body` concatenation)
 * specifically so a caller can recover `head` alone by slicing at the first
 * `{`, which plan 19-15's hover-shape assertion (below) needs to inspect the
 * selector's structure rather than just search text across head and body.
 * `selectorListDeclares` cannot serve this case: it splits a rule head on
 * `,` and requires an exact post-trim match against one comma-separated
 * token, but plan 19-03's shared hover selector head contains commas
 * *inside* `:where(:not(…))` — splitting on `,` there produces fragments
 * like `.pagination__button--current` that never equal the full head, so no
 * split-token would ever match. Scanning for a substring instead sidesteps
 * the comma-splitting problem entirely. Throws when no rule's head contains
 * the needle, so a deleted rule fails loudly rather than silently matching
 * nothing.
 */
function ruleWithHeadContaining(needle: string): string {
  const ruleHeadAndBody = RULE_SCANNER();
  let match: RegExpExecArray | null;
  while ((match = ruleHeadAndBody.exec(cssNoComments)) !== null) {
    const [, head, body] = match;
    if (head.includes(needle)) {
      assertNotAtRuleScoped(match.index, head, needle);
      return `${head}{${body}}`;
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

// Self-tests for the helper substrate hardened by plan 19-15 in response to
// 19-REVIEW-round3.md (R3-CR-01 at-rule hole, R3-WR-02 first-wins blind
// spots). Each case here is a mutation the review executed against the OLD
// helper bodies and observed staying green (or silently wrong); the
// corresponding assertion below is the new, closed-loop guard.
describe('AT_RULE_RANGES / assertNotAtRuleScoped / last-wins — self-tests', () => {
  it('throws for a selector that exists only inside an @media block (R3-CR-01) — the review\'s old helper resolved this without throwing and returned "display: flex;\\n    flex-direction: column;"', () => {
    expect(() =>
      bodyForSelectorListToken('.app-nav[data-open="true"] .app-nav__links'),
    ).toThrow(/at-rule block/);
  });

  it('still resolves .app-nav__toggle to its TOP-LEVEL rule, not the media-nested one, once the media-nested match is rejected by offset', () => {
    const body = bodyForSelectorListToken('.app-nav__toggle');
    expect(body).toContain('display: none');
    expect(body).not.toContain('inline-flex');
  });

  it('bodyForSelectorListToken is last-wins: a token declared twice in synthetic CSS resolves to the second rule\'s body', () => {
    const synthetic = '.token { value: 1; } .token { value: 2; }';
    expect(bodyForSelectorListToken('.token', synthetic)).toContain('value: 2');
    expect(bodyForSelectorListToken('.token', synthetic)).not.toContain('value: 1');
  });

  it('extractNumericDeclaration is last-wins: a property declared twice inside one body resolves to the second value', () => {
    const body = 'z-index: 5; other: 1; z-index: 9;';
    expect(extractNumericDeclaration(body, 'z-index')).toBe(9);
  });

  it('extractNumericDeclaration does not match a property name occurring as a suffix of another declaration', () => {
    const body = 'max-z-index: 40; other: 1;';
    expect(() => extractNumericDeclaration(body, 'z-index')).toThrow(/No numeric/);
  });

  it('extractNumericDeclaration escapes a property containing a regex metacharacter instead of treating it as regex syntax', () => {
    // Unescaped, `grid.column` as a regex would also match the LATER
    // `grid-column: 8` declaration (`.` matching the literal `-`), and
    // last-wins would then incorrectly return 8 instead of 4.
    const body = 'grid.column: 4; grid-column: 8;';
    expect(extractNumericDeclaration(body, 'grid.column')).toBe(4);
  });
});

// Self-tests for cascadeWinningBodyDeclaring / bodiesForSelectorListToken
// (20-10, migrating WR-03's four Phase 20 CSS assertions off the first-wins
// declarationsFor helper). Each case is the false-green mechanism WR-03
// (20-REVIEW.md) proved by executed mutation against the OLD assertions:
// they stayed green while the rules they guard went dead, because
// declarationsFor reads the FIRST matching rule instead of the cascade
// winner. Every case below runs against synthetic CSS passed through the
// `source` parameter, so styles.css is never edited to make a self-test
// pass.
describe('cascadeWinningBodyDeclaring / bodiesForSelectorListToken — self-tests', () => {
  it('R3-WR-02 / WR-03: declarationsFor returns the FALSE GREEN first body, cascadeWinningBodyDeclaring returns the cascade winner', () => {
    const synthetic = '.x { display: flex; } .x { display: block; }';
    expect(
      declarationsFor('.x', synthetic),
      'documents the false green the old first-wins assertion would have produced',
    ).toContain('display: flex');
    expect(
      cascadeWinningBodyDeclaring('.x', 'display', synthetic),
      'documents the cascade winner the browser actually applies',
    ).toContain('display: block');
  });

  it("WR-03: the real .activity-row shape - a later rule that does NOT redeclare the property under test - resolves to the EARLIER rule's value, not the last rule's body", () => {
    // The real stylesheet's exact shape: styles.css:338 declares `display:
    // flex` and styles.css:1530 (later, Phase 20) declares only
    // `text-decoration: none`. bodyForSelectorListToken, which returns
    // whichever body is LAST regardless of what it declares, resolves to
    // the second rule and does not contain `display` at all — this is the
    // trap 20-REVIEW.md's WR-03 closing paragraph names.
    const synthetic = '.x { display: flex; } .x { text-decoration: none; }';
    const lastBody = bodyForSelectorListToken('.x', synthetic);
    expect(lastBody).toContain('text-decoration: none');
    expect(lastBody).not.toContain('display');
    expect(cascadeWinningBodyDeclaring('.x', 'display', synthetic)).toContain('display: flex');
  });

  it("the navigable-row cursor's own version of the same mutation: declarationsFor reads the stale first cursor, bodyForSelectorListToken reads the cascade winner", () => {
    const synthetic = '.n { cursor: pointer; } .n { cursor: default; }';
    expect(declarationsFor('.n', synthetic)).toContain('cursor: pointer');
    expect(bodyForSelectorListToken('.n', synthetic)).toContain('cursor: default');
  });

  it('bodiesForSelectorListToken returns every body in source order', () => {
    const synthetic = '.x { a: 1; } .x { a: 2; } .x { a: 3; }';
    expect(bodiesForSelectorListToken('.x', synthetic)).toEqual([
      ' a: 1; ',
      ' a: 2; ',
      ' a: 3; ',
    ]);
  });

  it('cascadeWinningBodyDeclaring throws when no body declares the property', () => {
    const synthetic = '.x { display: flex; } .x { text-decoration: none; }';
    expect(() => cascadeWinningBodyDeclaring('.x', 'color', synthetic)).toThrow(
      /No body among the rules/,
    );
  });

  it('bodiesForSelectorListToken throws when the selector is absent entirely - a deleted rule fails loudly', () => {
    const synthetic = '.y { display: flex; }';
    expect(() => bodiesForSelectorListToken('.x', synthetic)).toThrow(
      /No rule found whose selector list contains/,
    );
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
// Helper audit (19-08 Task 2, at-rule nesting added by 19-10 Task 2 / WR-02,
// corrected by plan 19-15 in response to 19-REVIEW-round3.md after Round 3
// proved two of the audit's own prior claims false — see the at-rule and
// cascade paragraphs below), so a future author extending this file knows
// which layer a new claim belongs in. Each line states what the helper
// proves and the class of false pass it cannot rule out:
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
//   whole `property: value` pair. At-rule nesting (below): remains
//   DELIBERATELY unguarded — it iterates every rule in the file and
//   returns a boolean, so throwing on an at-rule-scoped match would fire on
//   the first at-rule it walks past and break unrelated, currently-passing
//   assertions that have nothing to do with the needle being checked. Its
//   blind spot therefore stays a silent `false`: a false `false` from this
//   helper may mean either "not declared" or "declared, but only inside an
//   `@media` block this helper cannot see."
// - bodyForSelectorListToken: proves some rule whose top-level selector
//   list contains `needle` exists, and returns its body text for the
//   caller to parse a value out of (plan 19-07/19-10's numeric z-index
//   comparisons). At-rule nesting (below): guarded by offset, not just by
//   head shape — see that paragraph for what changed. Cascade (below):
//   last-wins, matching CSS.
// - ruleWithHeadContaining: proves some rule's head contains `needle` as a
//   raw substring; deliberately does not parse selector structure at all.
//   Cannot rule out matching the wrong rule if `needle` is short/generic
//   enough to also appear in an unrelated head, or missing the intended
//   rule entirely if `cssNoComments`'s own comment-stripping is ever wrong.
//   At-rule nesting (below): guarded by offset, same as
//   bodyForSelectorListToken. Returns its match as `head + '{' + body +
//   '}'` (brace boundary preserved, not `head + body` concatenated), so a
//   caller can recover `head` alone by slicing at the first `{` — added by
//   plan 19-15 for the hover-shape assertion below, which needs the head's
//   structure rather than a head+body substring search.
// - splitTopLevelSelectors: proves a comma nested inside parentheses is
//   never mistaken for a selector-list boundary. Cannot rule out a false
//   split on an attribute selector containing a literal comma inside its
//   own quoted value (e.g. `[data-x="a,b"]`) — a construct that does not
//   occur anywhere in this stylesheet today, so it is untested by the
//   self-tests above and would need a fifth case if it were ever added.
//
// At-rule nesting (WR-02, 19-REVIEW.md; corrected by R3-CR-01,
// 19-REVIEW-round3.md): all THREE rule-scanning helpers —
// selectorListDeclares, bodyForSelectorListToken, ruleWithHeadContaining —
// share one generic regex (RULE_SCANNER above), whose body class permits an
// unmatched `{`. Against an `@media` block, that regex consumes the
// `@media (...)` prelude itself as a rule HEAD and swallows the first
// nested rule into its "body" — seven pseudo-rules come out this way in
// this stylesheet today. Round 3 proved the guard this file shipped for
// that — a check that a resolved match's HEAD merely begins with `@` — only
// ever fires on the at-rule prelude pseudo-rule itself, which no real
// needle reaches (the only selector-list token a prelude produces is its
// own literal text, e.g. `'@media (max-width: 640px)'`); every rule NESTED
// inside the block resolved silently with no `@` anywhere in its head.
// Executed proof: `bodyForSelectorListToken('.app-nav[data-open="true"]
// .app-nav__links')` used to resolve without throwing and return the
// `@media` body. `AT_RULE_RANGES` now computes every at-rule block's
// `[start, end)` offset once by brace matching over `cssNoComments`, and
// `assertNotAtRuleScoped` rejects a match whose OFFSET falls inside any
// range — catching a nested rule at every position in the block, not only
// the first. Applied in the two single-match helpers
// (`bodyForSelectorListToken`, `ruleWithHeadContaining`), which already
// throw on failure; still deliberately NOT applied inside
// `selectorListDeclares`, for the reason stated in its bullet above — that
// helper's blind spot is retired from "documented as guarded but is not" to
// "known and left open, because closing it would break other assertions."
//
// Cascade order (R3-WR-02, 19-REVIEW-round3.md): this audit used to omit
// two blind spots entirely. `bodyForSelectorListToken` was first-rule-wins
// and `extractNumericDeclaration` was first-declaration-wins, while CSS
// resolves both LAST-wins, so an assertion built on either could read a
// value a later, real declaration overrides. Concrete case: a later
// `.segmented__option { border-radius: var(--radius-control) }` would
// silently cancel the CR-02 fix's own `.segmented__option { border-radius:
// 0 }` cancellation, and the CR-02 test written to guard exactly that
// stayed green, because the helper read the FIRST declaration, not the one
// the browser applies. Both are now last-wins: `bodyForSelectorListToken`
// returns the last non-at-rule-scoped candidate's body;
// `extractNumericDeclaration` uses `matchAll` and returns the final match,
// anchored to a declaration boundary, `property` escaped like
// `declarationsFor` escapes `selector` (R3-IN-01). Needle enumeration
// (19-15-SUMMARY.md) confirms this changed no existing assertion's value.
//
// Substrate consolidation (R3-IN-03, 19-REVIEW-round3.md): the rule-scanning
// regex used to be duplicated verbatim in three helpers, and the
// `;`-split fragment idiom was repeated at three call sites. Both are now
// single points of correction, `RULE_SCANNER()` (a factory — a shared
// `RegExp`'s `lastIndex` is stateful across callers) and
// `declarationFragments(body)`, so a future fix lands in one place, not
// three.
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
// characters — belongs there, not in a new substring assertion here. Round
// 4 (19-REVIEW-round3.md) added a fourth false-green mechanism to this
// file's record, distinct from GAP 1's text-vs-parse gap: a guard
// documented in this very comment as closing a hole (the at-rule and
// cascade paragraphs above) that it did not close, proven only by mutation
// against the real stylesheet — not by re-reading the code — so the fix
// above is itself evidence that "the assertion exists and the file says so"
// is not sufficient either.
//
// Phase 20 cascade migration (WR-02/WR-03, 20-REVIEW.md; plans 20-10 and
// 20-14): the seven positive assertions in the Phase 20 block below split
// into two migration steps, neither of which is complete on its own.
//
// Step one (plan 20-10, WR-03 in its round): four of the seven assertions
// ('.activity-row keeps display: flex', the two D-09 hover-mix checks, and
// D-10's cursor: pointer check) used to read through `declarationsFor`,
// which is first-rule-wins over the raw stylesheet text — the same
// false-green mechanism the R3-WR-02 paragraph above already proved for
// `bodyForSelectorListToken` and `extractNumericDeclaration`. The review's
// executed mutation showed all four staying green while the rules they
// guard were dead. They were converted to `bodyForSelectorListToken` (three
// of the four — each targets a selector declared exactly once at the top
// level, so last-wins and first-wins coincide today, but only last-wins
// matches what a browser actually resolves if a later override is ever
// added) or `cascadeWinningBodyDeclaring` (the `.activity-row` / `display`
// case, which needs it for real: `.activity-row` is declared TWICE at the
// top level — styles.css:338 carrying `display: flex`, styles.css:1530
// carrying only `text-decoration: none` — so `bodyForSelectorListToken`
// alone would resolve to the second body and fail the assertion;
// `cascadeWinningBodyDeclaring` finds the last body that actually declares
// `display`). Plan 20-10 left the remaining THREE assertions — the two bare
// `a` checks and `.activity-row declares text-decoration: none` — on
// `selectorListDeclares`, which is any-rule-wins rather than last-wins, a
// strictly weaker guarantee than the first-wins helper it had just replaced
// the other four away from (WR-02, 20-REVIEW.md). Plan 20-14 converted
// those three to `cascadeWinningBodyDeclaring` as well, so all seven
// positive assertions now read the cascade winner, and added an executed
// blind-spot proof of the any-rule-wins mechanism it closed.
//
// Step two (plan 20-14, WR-03): `bodyForSelectorListToken` and
// `cascadeWinningBodyDeclaring` are both built on
// `bodiesForSelectorListToken`, which skips every at-rule-scoped rule by
// construction — so even after step one, a `@media` override of a guarded
// selector left every converted assertion green. That is not theoretical
// for this selector: `.activity-row`'s `display` is genuinely governed by
// the 720px breakpoint elsewhere in this file (styles.css:545-553), and the
// review's executed mutation proved it. Plan 20-14 added
// `assertNoAtRuleOverride` and paired it with all seven positive
// assertions, plus an executed blind-spot proof covering both of the
// review's mutations.
//
// `declarationsFor` itself is NOT converted to last-wins — doing so would
// change the reading of roughly forty pre-existing Phase 16-19 assertions
// built on it, in a gap-closure plan that has no rendered verification to
// catch a regression any of those forty might introduce. It remains
// first-wins and is now documented as such (see its own JSDoc above), with
// `bodyForSelectorListToken` and `cascadeWinningBodyDeclaring` named as the
// correct choices for any selector that might be declared more than once.
//
// The Phase 20 block's three NEGATIVE assertions (`selectorListDeclares('a',
// 'color: var(--accent)')`, and D-10's two `.activity-table tbody tr[:hover]`
// checks) deliberately stay on `selectorListDeclares` — neither plan
// converts them, because any-rule-wins over a negative claim ("no rule
// declares this") is the conservative direction, not the false-green one.
// IN-10 (20-REVIEW.md) notes their vacuity on deletion remains open: if the
// guarded rule were deleted outright rather than overridden, these negative
// assertions would still (correctly, but coincidentally) read `false`, and
// nothing in this file distinguishes "never declared" from "correctly
// absent by design". That gap is not addressed by plan 20-14 and stays open.
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
  // there says the exclusions prevent. Widened to all eight required
  // exclusion tokens (still true below).
  //
  // R3-CR-02 (19-REVIEW-round3.md): the eight-token widening above closed
  // the exclusion-list gap but introduced two much larger ones, both proven
  // by executed mutation — the assertion below never checked that the rule
  // was still a `:hover` rule, and never checked it was still scoped to
  // `button`. Deleting `:hover` from the head (applying the surface-mix
  // background to every non-excluded button unconditionally) and widening
  // `button` to `*` (applying it to every element on the page) both stayed
  // green. This assertion now proves the head's SHAPE — anchored `button`
  // scope, anchored `:hover` gate, and the `:not()` argument compared as an
  // ORDERED LIST via `splitTopLevelSelectors` (so a reorder is visible in
  // the diff, not silently accepted) — retiring the old limitation this
  // comment used to document (that the concatenated rule text could not
  // distinguish a selector token from the same text inside a declaration
  // value), since the token list is now extracted from the parsed head
  // alone. What it still cannot prove: that the rule renders — see the
  // closing paragraph of the helper audit above.
  it('the shared hover rule is button-scoped, hover-gated, and excludes all eight tokens', () => {
    const rule = ruleWithHeadContaining(':where(:not(');
    const braceIndex = rule.indexOf('{');
    const head = braceIndex === -1 ? rule : rule.slice(0, braceIndex);
    const normalized = head.replace(/\s+/g, ' ').trim();

    expect(normalized.startsWith('button:where(:not(')).toBe(true);
    expect(normalized.endsWith(')):hover')).toBe(true);

    const notArg = normalized.slice(
      'button:where(:not('.length,
      normalized.lastIndexOf(')):hover'),
    );
    expect(splitTopLevelSelectors(notArg)).toEqual([
      ':disabled',
      '[aria-disabled="true"]',
      '.pagination__button--current',
      '.segmented__option--active',
      '.calendar-day--tint-1',
      '.calendar-day--tint-2',
      '.calendar-day--tint-3',
      '.calendar-day--tint-4',
    ]);
    expect(rule).toContain('color-mix(in srgb, var(--surface) 92%, var(--text))');
  });

  it('no bare button:hover rule exists', () => {
    expect(selectorListDeclares('button:hover', '')).toBe(false);
  });

  it('.cta:hover mixes from var(--accent)', () => {
    expect(
      selectorListDeclares('.cta:hover', 'color-mix(in srgb, var(--accent) 92%, var(--text))'),
    ).toBe(true);
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
    const fragments = declarationFragments(body);
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
  // must fail this test too. R3-IN-04 (19-REVIEW-round3.md): that second
  // assertion is a deliberate, verbatim duplicate of the button-baseline
  // radius check in the "button declares the quiet baseline" test above —
  // kept so a reader seeing two failures at once knows they are one fact,
  // not two independent regressions.
  it('.segmented__option cancels the button baseline radius so middle options render square (CR-02)', () => {
    const body = bodyForSelectorListToken('.segmented__option');
    const fragments = declarationFragments(body);
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
  //
  // R3-IN-02 (19-REVIEW-round3.md): `.records-jump` used to be the one rung
  // read through `declarationsFor` instead of `bodyForSelectorListToken`,
  // for no stated reason — the two helpers have different blind-spot
  // profiles (`declarationsFor` is not selector-boundary-anchored;
  // `bodyForSelectorListToken` is now last-wins per plan 19-15's substrate
  // hardening above), so a reader could not reason about this test
  // uniformly. `.records-jump` resolves as an exact top-level selector
  // token with no other rule sharing it, so switching it to
  // `bodyForSelectorListToken` for both its z-index and position reads
  // below is behaviour-preserving; confirmed by running the suite. All
  // four rungs now read through the same helper.
  it('the sticky-layer ladder (#app-nav-root > .records-jump > .splits-table__km > :focus-visible) holds numerically and in order', () => {
    const appNavZIndex = extractNumericDeclaration(
      bodyForSelectorListToken('#app-nav-root'),
      'z-index',
    );
    const recordsJumpZIndex = extractNumericDeclaration(
      bodyForSelectorListToken('.records-jump'),
      'z-index',
    );
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

    // R3-WR-01 (19-REVIEW-round3.md): the ladder assertions above pinned
    // only z-index numbers, which stayed green under an executed mutation
    // that deleted `position: sticky` from every sticky rung — proving a
    // z-index-only ladder is a repudiation-prone guard, since the whole
    // CR-01 fix could go inert while this test kept passing. GAP 7
    // (19-13-PLAN.md / 19-GAP7-DIAGNOSIS.md, confirmed root cause H1,
    // 2026-08-13) showed concretely why the positioning precondition
    // matters: `.app-nav` was `position: sticky` inside a containing block
    // (`#app-nav-root`) sized exactly to its own height, giving it zero
    // travel distance, so it left the viewport in lock-step with its parent
    // despite `position: sticky` being present in the rule the whole time.
    // The fix moved the sticky declaration to `#app-nav-root` itself, whose
    // containing block (BODY) has real travel room. These assertions pin
    // that positioning precondition directly rather than only the numbers
    // layered on top of it.
    expect(bodyForSelectorListToken('#app-nav-root')).toContain('position: sticky');
    expect(bodyForSelectorListToken('.records-jump')).toContain('position: sticky');
    expect(bodyForSelectorListToken('.splits-table__km')).toContain('position: sticky');
    expect(bodyForSelectorListToken(':focus-visible')).toContain('position: relative');

    // GAP 7 / H1 invariant, dated 2026-08-13: `.app-nav` itself must NOT
    // declare `position: sticky`. A sticky element nested inside a
    // zero-travel sticky parent is the exact shape GAP 7's confirmed root
    // cause diagnosed, and reintroducing a second, nested sticky
    // declaration on `.app-nav` — even alongside the correct
    // `#app-nav-root` declaration — would silently restore that defect.
    expect(bodyForSelectorListToken('.app-nav')).not.toContain('position: sticky');
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
    const fragments = declarationFragments(rootBody);
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

describe('styles.css - Phase 20 row-click interaction pattern', () => {
  // Do NOT use the declarationsFor helper on the bare `a` selector for these
  // three assertions. That helper's regex is
  // `new RegExp(escaped + '\\s*\\{')` and is unanchored — it matches the
  // FIRST `a {`-shaped substring anywhere in the file, which is `.cta {`
  // (styles.css, § Primary CTA), not the bare `a` rule this phase adds.
  // Using it here would silently assert against the wrong rule and pass or
  // fail for the wrong reason — exactly the kind of assertion this
  // repository has shipped once already (GAP 1) and now mutation-proves
  // against. selectorListDeclares walks the parsed rule list and matches
  // `a` as an exact top-level selector token, so it cannot make this
  // mistake — but it was not the right replacement either: it is
  // any-rule-wins (WR-02, 20-REVIEW.md), so a later, cascade-winning
  // override of the same selector cannot make it fail. See the WR-02
  // blind-spot proof below for an executed case where that is exactly what
  // happens.
  //
  // cascadeWinningBodyDeclaring, not bodyForSelectorListToken, for the two
  // `a` assertions below, even though `a` is declared exactly once today:
  // bodyForSelectorListToken returns the last body whether or not it
  // declares the property under test, which is wrong the moment a second
  // `a` rule is added that does not carry `color` (or `text-decoration`).
  // cascadeWinningBodyDeclaring resolves per property, so it stays correct
  // even if that happens.
  it('D-06: the bare a rule declares color: inherit', () => {
    expect(cascadeWinningBodyDeclaring('a', 'color')).toContain('color: inherit');
    assertNoAtRuleOverride('a', 'color');
  });

  it('D-06: the bare a rule declares text-decoration: underline', () => {
    expect(cascadeWinningBodyDeclaring('a', 'text-decoration')).toContain(
      'text-decoration: underline',
    );
    assertNoAtRuleOverride('a', 'text-decoration');
  });

  it('D-06: the bare a rule does not declare color: var(--accent)', () => {
    // --accent on --bg measures ~3.4:1 light / ~2.8:1 dark in this
    // repository's own record (17-UI-SPEC.md:105), both under the 4.5:1 AA
    // floor for normal-size text. This assertion is what stops an
    // accent-coloured link text regression from creeping back in.
    expect(selectorListDeclares('a', 'color: var(--accent)')).toBe(false);
  });

  it('.activity-row keeps display: flex - load-bearing now that it is an <a>', () => {
    // cascadeWinningBodyDeclaring, not declarationsFor: `.activity-row` is
    // declared TWICE at the top level (styles.css:338 carrying `display:
    // flex`, styles.css:1530 carrying only `text-decoration: none`), and
    // declarationsFor is first-rule-wins over the raw stylesheet text, which
    // happens to read the right rule here only because the `display`-
    // carrying rule comes first in source order — a coincidence of file
    // layout, not a property of the helper. cascadeWinningBodyDeclaring
    // resolves per property, the way a browser does, so it stays correct
    // even if the two rules are ever reordered. See WR-03 (20-REVIEW.md).
    expect(cascadeWinningBodyDeclaring('.activity-row', 'display')).toContain('display: flex');
    assertNoAtRuleOverride('.activity-row', 'display');
  });

  it('.activity-row declares text-decoration: none - the whole-row link is not a text link', () => {
    // cascadeWinningBodyDeclaring, not selectorListDeclares: `.activity-row`
    // is also declared at styles.css:338 (carrying `display: flex`, not
    // `text-decoration`), so any-rule-wins would report `true` even if the
    // text-decoration-carrying rule at :1530 were later overridden — see the
    // WR-02 blind-spot proof immediately below for the executed case.
    expect(cascadeWinningBodyDeclaring('.activity-row', 'text-decoration')).toContain(
      'text-decoration: none',
    );
    assertNoAtRuleOverride('.activity-row', 'text-decoration');
  });

  it('WR-02: selectorListDeclares is any-rule-wins; cascadeWinningBodyDeclaring is not (20-REVIEW.md)', () => {
    // The first expectation below documents the defect the old any-rule-wins
    // guard shipped with and must not be "fixed" to a passing value — it is
    // the false-green this plan closes, preserved here as evidence that the
    // mechanism is real. The second expectation shows the cascade-aware
    // replacement resolving to the actual override instead. Runs against a
    // synthetic string via the helpers' optional `source` argument, not
    // against styles.css.
    const synthetic =
      '.activity-row { text-decoration: none; }\n' +
      '.activity-row { text-decoration: underline; }';
    // selectorListDeclares has no `source` parameter, so its any-rule-wins
    // scan (return true on the FIRST matching rule, ignoring source order)
    // is reproduced inline here rather than called directly.
    const anyRuleWinsDeclares = (needle: string, declaration: string): boolean => {
      const ruleHeadAndBody = RULE_SCANNER();
      let match: RegExpExecArray | null;
      while ((match = ruleHeadAndBody.exec(synthetic)) !== null) {
        const [, head, body] = match;
        if (splitTopLevelSelectors(head).some((s) => s === needle) && body.includes(declaration)) {
          return true;
        }
      }
      return false;
    };
    // Documents the miss: the stale first rule's declaration reads as
    // present even though a later rule overrides it.
    expect(anyRuleWinsDeclares('.activity-row', 'text-decoration: none')).toBe(true);
    // The cascade-aware replacement resolves to the actual override.
    const winner = cascadeWinningBodyDeclaring('.activity-row', 'text-decoration', synthetic);
    expect(winner).toContain('underline');
    expect(winner).not.toContain('text-decoration: none');
  });

  it('D-09: .activity-row:hover mixes from var(--surface) toward var(--text)', () => {
    expect(bodyForSelectorListToken('.activity-row:hover')).toContain(
      'color-mix(in srgb, var(--surface) 92%, var(--text))',
    );
    assertNoAtRuleOverride('.activity-row:hover', 'background');
  });

  it('D-10: .activity-table__row--navigable declares cursor: pointer', () => {
    expect(bodyForSelectorListToken('.activity-table__row--navigable')).toContain('cursor: pointer');
    assertNoAtRuleOverride('.activity-table__row--navigable', 'cursor');
  });

  it('D-09/D-10: .activity-table__row--navigable:hover mixes with the byte-identical formula', () => {
    expect(bodyForSelectorListToken('.activity-table__row--navigable:hover')).toContain(
      'color-mix(in srgb, var(--surface) 92%, var(--text))',
    );
    assertNoAtRuleOverride('.activity-table__row--navigable:hover', 'background');
  });

  it('D-10: .activity-table tbody tr no longer declares cursor: pointer', () => {
    // The negative half of D-10 - proves the four non-activity tables
    // (Riegel, two Trends, best-efforts) no longer inherit a pointer cursor
    // they cannot honor.
    expect(selectorListDeclares('.activity-table tbody tr', 'cursor: pointer')).toBe(false);
  });

  it('D-10: .activity-table tbody tr:hover no longer declares a color-mix hover', () => {
    expect(selectorListDeclares('.activity-table tbody tr:hover', 'color-mix')).toBe(false);
  });

  it('WR-03: cascadeWinningBodyDeclaring and bodyForSelectorListToken are blind to @media overrides; assertNoAtRuleOverride is not (20-REVIEW.md)', () => {
    // Each pair below documents the blind spot first (the old helper stays
    // green against a synthetic @media override — this must not be "fixed"
    // to a failing value, it is the false-green this plan closes) and then
    // proves the closure (assertNoAtRuleOverride throws on the same input).
    // Both run against synthetic CSS strings via the helpers' optional
    // `source` argument, not against styles.css.

    // Mutation 1 (the review's `.activity-row` / `display` case): a
    // top-level `display: flex` is overridden at the 720px breakpoint,
    // exactly as `.activity-row` is genuinely governed by that breakpoint
    // in this stylesheet (styles.css:545-553). A leading `.placeholder` rule
    // inside the `@media` block is deliberate, matching the real
    // stylesheet's shape (styles.css:545-556 holds three rules, not one):
    // RULE_SCANNER's shared regex consumes the `@media` prelude itself as a
    // pseudo rule head and swallows the FIRST nested rule into that pseudo
    // rule's captured body (see the `computeAtRuleRanges` JSDoc above), so a
    // single-rule `@media` block would never produce a real head+body match
    // for `.activity-row` to test against at all — this needs a second rule
    // in the block for the override to be reachable by the scanner the same
    // way it is reachable in the real file.
    const displaySynthetic =
      '.activity-row { display: flex; }\n' +
      '@media (max-width: 720px) { .placeholder { color: red; } .activity-row { display: block; } }';
    expect(cascadeWinningBodyDeclaring('.activity-row', 'display', displaySynthetic)).toContain(
      'display: flex',
    );
    expect(() => assertNoAtRuleOverride('.activity-row', 'display', displaySynthetic)).toThrow();

    // Mutation 2 (the review's `.activity-table__row--navigable` / `cursor`
    // case): a top-level `cursor: pointer` is redeclared to `cursor:
    // default` inside a `@media` block for the same selector. Same leading
    // `.placeholder` rule, for the same reason as mutation 1.
    const cursorSynthetic =
      '.activity-table__row--navigable { cursor: pointer; }\n' +
      '@media (max-width: 720px) { .placeholder { color: red; } ' +
      '.activity-table__row--navigable { cursor: default; } }';
    expect(bodyForSelectorListToken('.activity-table__row--navigable', cursorSynthetic)).toContain(
      'cursor: pointer',
    );
    expect(() =>
      assertNoAtRuleOverride('.activity-table__row--navigable', 'cursor', cursorSynthetic),
    ).toThrow();
  });

  it('T-20-CSS-02: the marker class literal matches NAVIGABLE_ROW_CLASS from row-navigation.ts', () => {
    // The single most likely silent break in this phase: the marker class
    // name is duplicated across a TypeScript module and this stylesheet. If
    // either side is renamed without the other, every navigable row loses
    // its cursor and hover feedback with no error anywhere.
    expect(cssNoComments).toContain('.' + NAVIGABLE_ROW_CLASS);
  });

  // D-13 (20-16): .pr-table__cell-link gives the five PR-table cells and two
  // progression-table cells a real anchor without turning them into visible
  // text links. Same two-statement shape as the seven assertions above — a
  // cascade-winner expectation paired with the matching at-rule companion.
  it('D-13: .pr-table__cell-link declares text-decoration: none - the cell anchors are gesture targets, not text links', () => {
    expect(cascadeWinningBodyDeclaring('.pr-table__cell-link', 'text-decoration')).toContain(
      'text-decoration: none',
    );
    assertNoAtRuleOverride('.pr-table__cell-link', 'text-decoration');
  });

  it('D-13: .pr-table__cell-link declares color: inherit - the cell keeps its column colour', () => {
    expect(cascadeWinningBodyDeclaring('.pr-table__cell-link', 'color')).toContain(
      'color: inherit',
    );
    assertNoAtRuleOverride('.pr-table__cell-link', 'color');
  });

  it('D-13: .pr-table__cell-link declares display: block - load-bearing, not cosmetic', () => {
    // An inline anchor would leave the cell's padding falling through to the
    // row listener, which refuses modified clicks by design (D-12),
    // re-creating the R18/R19 failure this rule exists to avoid.
    expect(cascadeWinningBodyDeclaring('.pr-table__cell-link', 'display')).toContain(
      'display: block',
    );
    assertNoAtRuleOverride('.pr-table__cell-link', 'display');
  });

  it('D-13: .pr-table__cell-link does not declare text-decoration: underline', () => {
    // IN-10 (20-REVIEW.md): a negative assertion expressed as
    // selectorListDeclares(...).toBe(false) would still (coincidentally, not
    // correctly) read false after the rule is deleted outright - it cannot
    // distinguish "never declared" from "correctly absent by design".
    // Resolving through the cascade winner instead makes a deletion throw
    // rather than pass vacuously, applying the IN-10 lesson to this new
    // assertion instead of leaving it to be rediscovered.
    const winner = cascadeWinningBodyDeclaring('.pr-table__cell-link', 'text-decoration');
    expect(winner).not.toContain('underline');
  });

  it('D-13: the bare a rule stays underlined while .pr-table__cell-link stays none - class beats type', () => {
    // A class selector (0,1,0) beats the bare `a` type selector (0,0,1)
    // regardless of source order, so this holds even though .pr-table__cell-
    // link is declared before the bare `a` rule in this file. Asserted
    // together, not as two separate `it`s, so deleting either half of the
    // pair is visible in one failing assertion rather than two independent
    // ones that could each be "fixed" without noticing the other broke.
    expect(cascadeWinningBodyDeclaring('a', 'text-decoration')).toContain('underline');
    expect(cascadeWinningBodyDeclaring('.pr-table__cell-link', 'text-decoration')).toContain(
      'none',
    );
  });
});

// These assertions read stylesheet TEXT, the same limitation every describe
// block above operates under. They can prove which declarations exist, which
// rule wins the cascade for a property, and whether a media query overrides
// one — they CANNOT prove that the header line actually renders with the
// badges on the right, that nothing wraps at 360px, or that the two-line
// result reads as a hierarchy to a human eye. That is plan 21-07's checkpoint
// rows R1-R4, and 21-VALIDATION.md lists it as manual-only.
describe('styles.css — Phase 21 two-line activity row (D-06/D-08)', () => {
  it('D-06: .activity-row declares flex-direction: column, with no @media override', () => {
    // cascadeWinningBodyDeclaring, not declarationsFor/bodyForSelectorListToken:
    // `.activity-row` is now declared THREE times at top level (styles.css
    // :338 display/background/border/etc., :~1539 text-decoration: none, and
    // this phase's new gap-only block) — see the WR-03 blind-spot proofs
    // above for why a non-cascade-aware helper would be wrong here.
    expect(cascadeWinningBodyDeclaring('.activity-row', 'flex-direction')).toContain(
      'flex-direction: column',
    );
    // The no-media-query requirement (D-06: "no media query involved") is
    // exactly what this checks — it throws if any @media block redeclares
    // flex-direction for .activity-row.
    assertNoAtRuleOverride('.activity-row', 'flex-direction');
  });

  it('D-06: no top-level .activity-row body anywhere declares flex-wrap: wrap', () => {
    // Written as a scan over every top-level `.activity-row` body (via
    // bodiesForSelectorListToken), not a single cascade-winner check: a
    // single-body check would go green even if a stale `flex-wrap: wrap`
    // sat in one of the OTHER two bodies the cascade does not currently
    // win for — exactly the kind of false-green this file's WR-02/WR-03
    // proofs above exist to close.
    const bodies = bodiesForSelectorListToken('.activity-row');
    for (const body of bodies) {
      expect(body).not.toMatch(/flex-wrap\s*:\s*wrap\b/);
    }
  });

  it('D-06: .activity-row__header declares flex-wrap: nowrap - the line whose removal would silently restore the pre-Phase-21 wrap behaviour', () => {
    // `nowrap` is what D-06's "badges never wrapping into the metrics line"
    // reduces to in CSS.
    expect(bodyForSelectorListToken('.activity-row__header')).toContain('flex-wrap: nowrap');
    assertNoAtRuleOverride('.activity-row__header', 'flex-wrap');
  });

  it('D-06: .activity-row__header declares justify-content: space-between - name left, badges right', () => {
    expect(bodyForSelectorListToken('.activity-row__header')).toContain(
      'justify-content: space-between',
    );
    assertNoAtRuleOverride('.activity-row__header', 'justify-content');
  });

  it('D-06: .activity-row__header declares display: flex', () => {
    expect(bodyForSelectorListToken('.activity-row__header')).toContain('display: flex');
    assertNoAtRuleOverride('.activity-row__header', 'display');
  });

  it('D-06: .activity-row__badges declares flex-shrink: 0 - makes the NAME absorb width pressure, not the badges', () => {
    expect(bodyForSelectorListToken('.activity-row__badges')).toContain('flex-shrink: 0');
    assertNoAtRuleOverride('.activity-row__badges', 'flex-shrink');
  });

  it('D-06: .activity-row__name declares min-width: 0 - the flex-item shrink enabler', () => {
    // cascadeWinningBodyDeclaring, not bodyForSelectorListToken:
    // `.activity-row__name` is now declared TWICE at top level (the
    // pre-existing type-role rule and this phase's new flex/min-width
    // block), for the same reason `.activity-row` needs the cascade-aware
    // helper above.
    expect(cascadeWinningBodyDeclaring('.activity-row__name', 'min-width')).toContain(
      'min-width: 0',
    );
    assertNoAtRuleOverride('.activity-row__name', 'min-width');
  });

  it('D-08: .activity-row still declares border-radius: 8px', () => {
    expect(cascadeWinningBodyDeclaring('.activity-row', 'border-radius')).toContain('8px');
    assertNoAtRuleOverride('.activity-row', 'border-radius');
  });

  it('D-08: .activity-row still declares padding: var(--space-md)', () => {
    expect(cascadeWinningBodyDeclaring('.activity-row', 'padding')).toContain(
      'var(--space-md)',
    );
    assertNoAtRuleOverride('.activity-row', 'padding');
  });

  it('D-08: .activity-row still declares background: var(--surface) - the value Phase 20 D-09s hover color-mix mixes against', () => {
    expect(cascadeWinningBodyDeclaring('.activity-row', 'background')).toContain(
      'var(--surface)',
    );
    assertNoAtRuleOverride('.activity-row', 'background');
  });

  it('D-08: .activity-list still declares gap: var(--space-sm) - Phase 20 D-11s focus-ring clearance', () => {
    expect(cascadeWinningBodyDeclaring('.activity-list', 'gap')).toContain('var(--space-sm)');
    assertNoAtRuleOverride('.activity-list', 'gap');
  });

  it('D-08: .activity-row still declares display: flex - flex-direction: column is meaningless without it', () => {
    // Duplicates the Phase 20 assertion at line ~1458 deliberately, inside
    // this Phase 21 describe, so a later edit that drops `display: flex`
    // while touching only this block's neighbourhood still fails loudly
    // here too.
    expect(cascadeWinningBodyDeclaring('.activity-row', 'display')).toContain('display: flex');
    assertNoAtRuleOverride('.activity-row', 'display');
  });
});

describe('styles.css — Phase 22 calendar week totals', () => {
  it('D-10: .calendar-grid declares grid-template-columns: repeat(7, 1fr) auto', () => {
    expect(bodyForSelectorListToken('.calendar-grid')).toContain(
      'grid-template-columns: repeat(7, 1fr) auto',
    );
  });

  it('.calendar-week-total resolves to a top-level rule (not media-nested)', () => {
    expect(bodyForSelectorListToken('.calendar-week-total')).toBeTruthy();
  });

  it('.calendar-week-total__distance resolves to a top-level rule (not media-nested)', () => {
    expect(bodyForSelectorListToken('.calendar-week-total__distance')).toBeTruthy();
  });

  it('.calendar-week-total__time resolves to a top-level rule (not media-nested)', () => {
    expect(bodyForSelectorListToken('.calendar-week-total__time')).toBeTruthy();
  });

  it('.calendar-week-total__count resolves to a top-level rule (not media-nested)', () => {
    expect(bodyForSelectorListToken('.calendar-week-total__count')).toBeTruthy();
  });

  it('.calendar-week-total__distance declares font-size: 20px and font-weight: 600', () => {
    const decl = bodyForSelectorListToken('.calendar-week-total__distance');
    expect(decl).toContain('font-size: 20px');
    expect(decl).toContain('font-weight: 600');
  });

  it('.calendar-week-total__time declares font-size: 14px and color: var(--text-secondary)', () => {
    const decl = bodyForSelectorListToken('.calendar-week-total__time');
    expect(decl).toContain('font-size: 14px');
    expect(decl).toContain('color: var(--text-secondary)');
  });

  it('.calendar-week-total declares white-space: nowrap', () => {
    expect(bodyForSelectorListToken('.calendar-week-total')).toContain('white-space: nowrap');
  });

  it('.calendar-week-total does NOT declare grid-template-areas (Pitfall 3 guard: a total cell with a day-number slot is the bug)', () => {
    expect(bodyForSelectorListToken('.calendar-week-total')).not.toMatch(/grid-template-areas/);
  });

  it('.calendar-week-total does NOT declare a border', () => {
    expect(bodyForSelectorListToken('.calendar-week-total')).not.toMatch(/\bborder\s*:/);
  });

  it('no .calendar-week-total--tint modifier was invented', () => {
    expect(css).not.toContain('.calendar-week-total--tint');
  });

  it('no .calendar-week-total--outside modifier was invented', () => {
    expect(css).not.toContain('.calendar-week-total--outside');
  });

  it('.sr-only still resolves (plan 22-03 depends on it existing)', () => {
    expect(bodyForSelectorListToken('.sr-only')).toBeTruthy();
  });

  it('the .segmented block gained no calendar-scoped selector: no ".calendar-header .segmented" rule', () => {
    expect(css).not.toContain('.calendar-header .segmented');
  });

  it('the .segmented block gained no calendar-scoped selector: no ".calendar .segmented" rule', () => {
    expect(css).not.toContain('.calendar .segmented');
  });
});

describe('styles.css — Phase 22 gap closure (22-06): the 380px compaction and the Total header modifier', () => {
  it('GC-1: .calendar-day keeps min-width: 32px at the default breakpoint and is relaxed at 380px', () => {
    expect(cascadeWinningBodyDeclaring('.calendar-day', 'min-width')).toContain('min-width: 32px');
    expect(() => assertNoAtRuleOverride('.calendar-day', 'min-width')).toThrow(/redeclares "min-width"/);
  });

  it('GC-1: .calendar-day__distance is 20px at the default breakpoint and overridden at 380px', () => {
    expect(bodyForSelectorListToken('.calendar-day__distance')).toContain('font-size: 20px');
    expect(() => assertNoAtRuleOverride('.calendar-day__distance', 'font-size')).toThrow(/redeclares "font-size"/);
  });

  it('GC-1: .calendar-week-total__time is 14px at the default breakpoint and overridden at 380px', () => {
    expect(bodyForSelectorListToken('.calendar-week-total__time')).toContain('font-size: 14px');
    expect(() => assertNoAtRuleOverride('.calendar-week-total__time', 'font-size')).toThrow(/redeclares "font-size"/);
  });

  it('GC-1: .calendar-week-total__count is 14px at the default breakpoint and overridden at 380px', () => {
    expect(bodyForSelectorListToken('.calendar-week-total__count')).toContain('font-size: 14px');
    expect(() => assertNoAtRuleOverride('.calendar-week-total__count', 'font-size')).toThrow(/redeclares "font-size"/);
  });

  it("WR-02 caveat: .calendar-week-total__distance's 380px override is asserted, not assumed away", () => {
    // The neighbouring pre-existing case in the "Phase 22 calendar week totals"
    // describe above asserts .calendar-week-total__distance's 20px base in
    // isolation, with no assertNoAtRuleOverride pairing — that is WR-02's
    // documented false green and is deliberately left in place this round.
    // This case supplies the missing override-aware half.
    expect(() => assertNoAtRuleOverride('.calendar-week-total__distance', 'font-size')).toThrow(/redeclares "font-size"/);
  });

  it('IN-05: .calendar-weekday--total declares text-align: right and is not overridden at any breakpoint', () => {
    expect(bodyForSelectorListToken('.calendar-weekday--total')).toContain('text-align: right');
    expect(() => assertNoAtRuleOverride('.calendar-weekday--total', 'text-align')).not.toThrow();
    expect(bodyForSelectorListToken('.calendar-weekday')).toContain('text-align: center');
  });

  it('D-10/GC-4/BL-01: the eight-column contract is the DEFAULT shape and is deliberately overridden at 380px', () => {
    // Previously this case asserted the opposite: that .calendar-grid's
    // track list is NEVER overridden at any breakpoint
    // (`assertNoAtRuleOverride(...).not.toThrow()`). 22-VERIFICATION.md
    // named that exact assertion as what locked Round 2's failing eight-
    // track shape in place — R13 recorded FAIL against a build this
    // assertion still passed. GC-4c (22-09-PLAN.md) inverts it
    // deliberately, under 22-CONTEXT.md's Claude's-Discretion clause
    // assigning the 8th column's exact CSS track to the planner: the
    // eight-track CONTRACT survives as the default-breakpoint shape, but
    // its SIZING FUNCTION is now allowed to change at 380px.
    const body = bodyForSelectorListToken('.calendar-grid');
    expect(body).toContain('grid-template-columns: repeat(7, 1fr) auto');
    expect(() => assertNoAtRuleOverride('.calendar-grid', 'grid-template-columns')).toThrow(/redeclares "grid-template-columns"/);
    expect(atRuleBodiesFor('.calendar-grid', 'grid-template-columns')[0]).toContain(
      'repeat(7, minmax(0, 1fr)) minmax(0, max-content)',
    );
    expect(body).not.toMatch(/overflow/);
  });

  it('IN-06: this stylesheet carries exactly three disjoint @media (max-width: 380px) blocks', () => {
    // Pairs with the reworded IN-06 comment in styles.css: if a future edit
    // consolidates the blocks, this goes red and the comment must be
    // corrected with it. Reads cssNoComments, never the raw css, whose
    // comments now name the breakpoint in prose (IN-09's rationale applied
    // to a structural check).
    const matches = cssNoComments.match(/@media \(max-width: 380px\)/g) ?? [];
    expect(matches).toHaveLength(3);
  });
});

/**
 * Extracts the body of the ONE `@media (max-width: 380px)` block that
 * mentions a `.calendar-` selector, by brace-matching from its `@media`
 * prelude to its closing `}` — the same brace-walk `computeAtRuleRanges`
 * performs, applied to a single needle block rather than every at-rule in
 * the file. Used by the round 3 describe below (cases 8 and 9) to make a
 * positional assertion about the block's FIRST nested rule, which
 * `RULE_SCANNER` itself swallows into the `@media` prelude's pseudo-body
 * (WR-03/WR-06) and so cannot be read through any of the selector-token
 * helpers above.
 */
function calendar380Block(): string {
  const starts = [...cssNoComments.matchAll(/@media \(max-width: 380px\)\s*\{/g)];
  for (const m of starts) {
    let i = m.index! + m[0].length;
    let depth = 1;
    while (depth > 0 && i < cssNoComments.length) {
      if (cssNoComments[i] === '{') depth++;
      else if (cssNoComments[i] === '}') depth--;
      i++;
    }
    const body = cssNoComments.slice(m.index! + m[0].length, i - 1);
    if (body.includes('.calendar-')) {
      return body;
    }
  }
  throw new Error('No @media (max-width: 380px) block mentioning a .calendar- selector was found');
}

describe('styles.css — Phase 22 gap closure round 3 (22-09): BL-01/BL-02 and the 380px override VALUES', () => {
  it('BL-01: .calendar-week-total is nowrap at the default breakpoint and wraps with a zero floor at 380px', () => {
    expect(bodyForSelectorListToken('.calendar-week-total')).toContain('white-space: nowrap');
    expect(atRuleBodiesFor('.calendar-week-total', 'white-space')[0]).toContain(
      'white-space: normal',
    );
    expect(atRuleBodiesFor('.calendar-week-total', 'min-width')[0]).toContain('min-width: 0');
    expect(atRuleBodiesFor('.calendar-week-total', 'overflow-wrap')[0]).toContain(
      'overflow-wrap: anywhere',
    );
  });

  it('BL-02: .calendar-day is a three-column grid at the default breakpoint and a single-column stack at 380px', () => {
    expect(bodyForSelectorListToken('.calendar-day')).toContain(
      'grid-template-columns: 1fr 1fr 1fr',
    );
    const gtc = atRuleBodiesFor('.calendar-day', 'grid-template-columns')[0];
    expect(gtc).toContain('grid-template-columns: 1fr');
    expect(gtc).not.toMatch(/1fr 1fr 1fr/);
    expect(atRuleBodiesFor('.calendar-day', 'grid-template-areas')[0]).not.toMatch(
      /number\s*\.\s*\./,
    );
  });

  it('BL-02: all three day-cell children are start-aligned at 380px, overriding centre and end', () => {
    expect(bodyForSelectorListToken('.calendar-day__distance')).toContain(
      'justify-self: center',
    );
    expect(bodyForSelectorListToken('.calendar-day__count')).toContain('justify-self: end');
    for (const needle of [
      '.calendar-day__number',
      '.calendar-day__distance',
      '.calendar-day__count',
    ]) {
      expect(atRuleBodiesFor(needle, 'justify-self')[0]).toContain('justify-self: start');
    }
  });

  it('GC-4e: the two overflowing values declare overflow-wrap: anywhere, not break-word, at 380px', () => {
    for (const needle of ['.calendar-day__distance', '.calendar-week-total']) {
      const body = atRuleBodiesFor(needle, 'overflow-wrap')[0];
      expect(body).toContain('anywhere');
      expect(body).not.toMatch(/break-word/);
    }
  });

  it('WR-03: the 380px day-cell compaction is asserted by VALUE', () => {
    // The gap this case closes: the pre-existing existence-only pairing
    // (`assertNoAtRuleOverride(...).toThrow(...)`) proves only that SOME
    // override exists — mutating `min-width: 0` to `min-width: 200px`, or
    // `font-size: 14px` to `font-size: 40px`, used to leave every such
    // assertion green. Reading the value through `atRuleBodiesFor` closes
    // that gap: it now goes red on exactly those mutations.
    expect(atRuleBodiesFor('.calendar-day', 'min-width')[0]).toContain('min-width: 0');
    expect(atRuleBodiesFor('.calendar-day__distance', 'font-size')[0]).toContain(
      'font-size: 14px',
    );
  });

  it('WR-03: the 380px total-cell compaction is asserted by VALUE', () => {
    expect(atRuleBodiesFor('.calendar-week-total__time', 'font-size')[0]).toContain(
      'font-size: 12px',
    );
    expect(atRuleBodiesFor('.calendar-week-total__count', 'font-size')[0]).toContain(
      'font-size: 12px',
    );
  });

  it('WR-07: the 380px .calendar-week-total__distance override is font-size only', () => {
    const body = atRuleBodiesFor('.calendar-week-total__distance', 'font-size')[0];
    expect(body).toContain('font-size: 14px');
    expect(body).not.toMatch(/line-height/);
    expect(body).not.toMatch(/font-weight/);
    expect(bodyForSelectorListToken('.calendar-week-total__distance')).toContain(
      'line-height: 1.2',
    );
  });

  it('WR-06: the padding rule is still the FIRST rule inside the calendar 380px block', () => {
    // WR-06 (22-REVIEW.md): the positional convention `styles.css`'s WR-03
    // paragraph has been holding in prose, now held by a test instead.
    // `RULE_SCANNER` swallows an at-rule block's first nested rule into its
    // prelude pseudo-body, which is exactly why that rule is structurally
    // unguardable through any of the selector-token helpers above — a
    // future rule accidentally inserted ahead of the padding rule would be
    // silently invisible to every other case in this file.
    const block = calendar380Block();
    const firstRuleBody = block.slice(0, block.indexOf('}'));
    expect(firstRuleBody).toContain('padding: var(--space-xs)');
  });

  it('GC-4: no scroll wrapper was built — no calendar rule declares overflow at any breakpoint', () => {
    expect(() => atRuleBodiesFor('.calendar-grid', 'overflow')).toThrow();
    const block = calendar380Block();
    expect(block).not.toMatch(/(^|[^-\w])overflow\s*:/);
  });
});
