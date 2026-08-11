import { readFileSync } from 'node:fs';
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
