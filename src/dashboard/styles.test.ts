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
    const selectors = head.split(',').map((s) => s.trim());
    if (selectors.some((s) => s === needle) && body.includes(declaration)) {
      return true;
    }
  }
  return false;
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
      return head + body;
    }
  }
  throw new Error(`No rule found with head containing: ${needle}`);
}

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

  it('the shared hover rule excludes disabled controls and the accent-strong fills', () => {
    const rule = ruleWithHeadContaining(':where(:not(');
    expect(rule).toContain('color-mix(in srgb, var(--surface) 92%, var(--text))');
    expect(rule).toContain(':disabled');
    expect(rule).toContain('[aria-disabled="true"]');
    expect(rule).toContain('.pagination__button--current');
    expect(rule).toContain('.segmented__option--active');
    expect(rule).toContain('.calendar-day--tint-1');
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
});

describe('styles.css — Phase 19 focus ring', () => {
  // declarationsFor(':focus-visible') cannot be used here: its regex is not
  // selector-boundary-anchored, and plan 19-03 added a `.cta:focus-visible`
  // rule earlier in the file whose head literally contains the substring
  // ":focus-visible {", so declarationsFor would match that rule instead of
  // the bare one this block guards. selectorListDeclares splits each rule
  // head on `,` and requires an exact post-trim token match, so it
  // correctly discriminates ":focus-visible" from ".cta:focus-visible" —
  // no new helper needed.
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

  it('.splits-scroll has room for the ring', () => {
    expect(declarationsFor('.splits-scroll')).toContain('padding: var(--space-xs)');
  });

  it('.records-jump padding is unchanged', () => {
    expect(declarationsFor('.records-jump')).toContain('padding: var(--space-sm)');
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
});
