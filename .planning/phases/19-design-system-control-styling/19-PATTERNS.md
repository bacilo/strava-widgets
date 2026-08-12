# Phase 19: Design System & Control Styling - Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 2 (both modified, none created)
**Analogs found:** in-file precedent for all 14 decisions (D-01..D-14) / 14

**Scope note:** This phase creates zero new files. All of D-01 through D-14 land inside two
already-existing files:

- `src/dashboard/styles.css` (1,092 lines)
- `src/dashboard/styles.test.ts` (142 lines)

So "closest analog" below means the **in-file precedent** each new/edited rule or assertion
must imitate — verified by reading both files directly in this session (line numbers below are
first-hand, not copied from RESEARCH.md, though they agree with it).

---

## File Classification

| File | Role | Data Flow | Nature of change | Closest analog |
|------|------|-----------|-------------------|-----------------|
| `src/dashboard/styles.css` | config (design tokens) + stylesheet | transform (cascade over existing, unmodified DOM) | in-place edits (7 rules) + one new appended banner block (D-01/D-05/D-06/D-07) + 2 new tokens inserted into `:root` (D-13) | Phase 17 block (lines 362-366) and Phase 18 block (lines 925-931) — both banner-commented additions to this same file |
| `src/dashboard/styles.test.ts` | test | transform (text assertion over CSS-as-string) | 5 new `describe` blocks appended, reusing existing helpers | The existing `describe('styles.css — Phase 17 tokens', ...)` block (lines 109-142) — same file, same idiom, one phase earlier |

---

## Pattern Assignments

### 1. Banner-comment block structure (governs where/how new CSS is added)

**Analog A — Phase 17 banner**, `src/dashboard/styles.css` lines 362-366:
```css
/* ==========================================================================
   Phase 17 — Activity browser
   Class contract for plans 17-08 (list), 17-09 (filters/pagination), and
   17-10 (calendar). Do not rename these classes downstream.
   ========================================================================== */
```

**Analog B — Phase 18 banner**, `src/dashboard/styles.css` lines 925-931:
```css
/* ==========================================================================
   Phase 18 — Records, Trends & Differentiators
   Class contract for the Records (#/records) and Trends (#/trends) views,
   plus the Phase 18 additions to the activity detail page. No new spacing
   scale, no fifth type role, no new --destructive usage — this phase reuses
   the existing scales verbatim (18-UI-SPEC § 17).
   ========================================================================== */
```

There is also a second, smaller Phase 17 banner at lines 695-699 (`Phase 17 — Activity detail`) —
confirming the pattern is "one banner per major sub-area of a phase," not strictly one banner
per phase. For Phase 19, since the new rules are element-level (not a new class contract in the
usual sense), a single banner at the end of the file (after line 1092, where the Phase 18 block's
content ends) is the right precedent to follow — one new block, not several.

**Exact shape to reproduce for Phase 19** (per 19-UI-SPEC.md "Phase-Specific Notes" and this
precedent):
```css
/* ==========================================================================
   Phase 19 — Design System & Control Styling
   Element-level baseline for input/select/textarea/button + the shared
   focus ring and disabled treatment. No new classes; existing button/control
   classes below in the cascade continue to override this baseline wherever
   they already declare a property. Do not remove without re-auditing every
   createElement('button'|'input'|'select') site across the 8 view files.
   ========================================================================== */
```

Note the phrasing difference from Phase 17/18: those banners say "do not rename these classes
downstream" because they *introduce* class contracts. Phase 19 introduces no new classes (D-01,
D-05 lock this), so its banner should instead warn against *deletion* of the element-level rules
— that is the actual regression risk D-04 guards against.

---

### 2. `:root` / `[data-theme]` token block layout — where D-13's new tokens go

**Analog**, `src/dashboard/styles.css` lines 15-79 (bare `:root`), 81-95 (`[data-theme="light"]`),
97-110 (`[data-theme="dark"]`):

```css
:root {
  ...
  --destructive: #dc2626;

  /* Phase 17 — contrast-safe active-state fill (pagination + segmented
     control only, never used elsewhere — see 17-UI-SPEC § Color). */
  --accent-strong: #b3390a;
  ...
  /* Phase 17 — fixed HR-zone colors, theme-independent (identical in both
     themes per 17-UI-SPEC § HR zone colors), so declared only here. */
  --zone-1: #3b82f6;
  --zone-2: #22c55e;
  --zone-3: #eab308;
  --zone-4: #f97316;
  --zone-5: #ef4444;

  /* Spacing scale (UI-SPEC) */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;

  /* Font stack — character-for-character identical to src/widget/styles.css line 3 */
  --font-stack: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Phase 18 — training-load and categorical tokens, theme-invariant
     (declared once here, not repeated in the two [data-theme] blocks below,
     following the --zone-1..5 precedent rather than the --chart-* per-theme
     precedent — these are informational/categorical colors, not brand
     colors). ... */
  --load-ctl: #3b82f6;
  ...
}
```

**Theming pattern confirmed:** tokens are declared in exactly one of two shapes:
1. **Themed** (redeclared with different values inside both `[data-theme="light"]` and
   `[data-theme="dark"]`) — e.g. `--bg`, `--surface`, `--accent`, `--accent-strong`, `--chart-*`.
2. **Theme-invariant** (declared once, only in the bare `:root`, never repeated in either
   `[data-theme]` block) — e.g. `--space-*`, `--font-stack`, `--zone-1..5`, `--load-*`, `--cat-*`.

`--radius-panel: 8px` and `--radius-control: 4px` are **theme-invariant** (8px/4px in light and
dark alike — 19-UI-SPEC.md confirms "identical in light and dark"), so they follow shape 2: insert
them once, in the bare `:root` block only, immediately after `--space-3xl: 64px;` (line 53) and
before the `--font-stack` comment (line 55) — i.e. same neighborhood as the spacing scale, per
19-UI-SPEC.md's explicit instruction ("Declare both immediately below `--space-3xl` in the `:root`
token block ... since they are structurally the same kind of design-scale token"). Do **not** add
them to either `[data-theme]` block — that would be the wrong shape (shape 1) for a value that
never changes per theme, and would create an unnecessary place for the two copies to drift.

---

### 3. `color-mix(in srgb, …)` call sites — D-06/D-08 formula precedent

Three representative excerpts (of 11 total occurrences) showing the established syntax:

**Retrofit target itself**, `src/dashboard/styles.css` line 406-408:
```css
.activity-table tbody tr:hover {
  background: color-mix(in srgb, var(--surface) 92%, black);
}
```
This is the exact rule D-08 retrofits — change `black` to `var(--text)`, nothing else.

**Calendar day tint**, `src/dashboard/styles.css` lines 673-675 (one of four `--tint-1..4`):
```css
.calendar-day--tint-1 {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
```

**Permanent highlight marker**, `src/dashboard/styles.css` lines 1007-1012:
```css
/* Identical color-mix formula to .activity-table__row--highlight, but with
   NO transition — this is a permanent state marker (every visit), not a
   "you just arrived" flash. */
.pr-table__row--pr {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
}
```

**Syntax to match exactly for D-06's new `button:hover` rule and D-08's retrofit:**
`color-mix(in srgb, var(--surface) 92%, var(--text))` — always `color-mix(in srgb, <var> <pct>%, <var-or-literal>)`, space-separated, no other color space used anywhere in the file (all 11 sites use `in srgb`).

---

### 4. Existing 32px control dimensions — exact expression to match for D-03/D-05

**`.pagination__button`**, `src/dashboard/styles.css` lines 544-552:
```css
.pagination__button {
  min-width: 32px;
  min-height: 32px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
}
```

**`.calendar-day`**, `src/dashboard/styles.css` lines 622-636:
```css
.calendar-day {
  display: grid;
  min-width: 32px;
  min-height: 32px;
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  grid-template-areas:
    "number . ."
    ". distance ."
    ". . count";
  grid-template-columns: 1fr 1fr 1fr;
}
```

**`.records-jump__link`**, `src/dashboard/styles.css` lines 964-976:
```css
.records-jump__link {
  appearance: none;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  min-height: 32px;
  min-width: 32px;
  padding: var(--space-xs) var(--space-sm);
  cursor: pointer;
}
```

**Confirmed expression: `min-height: 32px` (and usually also `min-width: 32px`), never `height:
32px` and never a padding-derived height.** All three precedents use the literal `32px` value,
not a token — there is no `--control-height` or similar token in the file today. D-03's new
`input, select, textarea` rule and D-05's new `button` rule should write `min-height: 32px`
literally, matching this precedent exactly (no new token invented, per 18-UI-SPEC § 17's
carried-forward constraint).

---

### 5. `.card` — source-of-truth panel treatment, and its four D-13 targets as they exist today

**Source of truth**, `src/dashboard/styles.css` lines 235-240:
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: var(--space-md);
}
```

**Target 1 — `.error-state`**, lines 312-318 — **IMPORTANT: this selector is a combined list with
`.stub-panel`, not a standalone rule:**
```css
.error-state,
.stub-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  text-align: center;
  padding: var(--space-2xl);
}
```
No radius today. CONTEXT.md/19-UI-SPEC.md name only `.error-state` as a D-13 target — editing
this rule in place (the only way to change `.error-state`, since it shares a rule body with
`.stub-panel`) will **also** apply `border-radius: var(--radius-panel)` and the `--space-lg`
padding correction to `.stub-panel`. See Landmines below.

**Target 2 — `.empty-state`**, lines 573-578:
```css
.empty-state {
  background: var(--surface);
  border: 1px solid var(--border);
  text-align: center;
  padding: var(--space-2xl) var(--space-lg);
}
```
No radius today; padding is two-axis (`--space-2xl` block / `--space-lg` inline) — D-13 normalizes
both axes to `--space-lg`.

**Target 3 — `.calendar-picker`**, lines 689-693:
```css
.calendar-picker {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: var(--space-md);
}
```
No radius today; padding is currently `--space-md`, not even the wrong panel value — D-13 raises
it to `--space-lg` alongside adding the radius.

**Target 4 — `.config-notice`**, lines 985-994:
```css
.config-notice {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: var(--space-md);
  margin-bottom: var(--space-md);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.5;
}
```
Already has a radius, but the **wrong token** (4px = control radius, not panel radius) — D-13
swaps `border-radius: 4px` for `border-radius: var(--radius-panel)` and raises padding to
`--space-lg`; the `margin-bottom`/font declarations are untouched.

**Also referenced by D-13 (not a `.card` retrofit target, but a nearby correction):**
`.stat-grid`, lines 242-246:
```css
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-xl);
}
```
Change `gap: var(--space-xl)` to `gap: var(--space-lg)` — everything else stays.

---

### 6. `styles.test.ts` — exact helpers, grouping convention, and idioms to imitate

Full relevant excerpt, `src/dashboard/styles.test.ts` lines 1-57 (imports + both helpers):
```typescript
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

function declarationsFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ruleRegex = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  const match = cssNoComments.match(ruleRegex);
  if (!match) {
    throw new Error(`No rule found for selector: ${selector}`);
  }
  return match[1];
}

function selectorListDeclares(needle: string, declaration: string): boolean {
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
```

**Important behavior to know before writing D-04's new assertions:**
- `declarationsFor(selector)` does an exact-string regex match on the selector as written
  (escaped, then `\s*\{`) — it will **not** find `input, select, textarea` unless you pass that
  literal three-part string in that literal order with that literal comma-space formatting (or
  whatever the actual rule head text is char-for-char). Safer for a combined selector list is
  `selectorListDeclares('input', 'border: 1px solid var(--border)')` etc., since it splits on `,`
  and trims — this is the idiom already used for `.theme-toggle` (below), and is what D-04 should
  use for the multi-selector `input, select, textarea { ... }` rule.
- `declarationsFor` is best for single, unambiguous selectors like `:root[data-theme="light"]`
  or `.theme-toggle__icon`.

**Describe-block grouping convention**, lines 109-142 (the most recent, one-phase-prior precedent
— use this shape for the five new Phase 19 blocks, not the older WR-04 block's shape):
```typescript
describe('styles.css — Phase 17 tokens', () => {
  it('--accent-strong is #b3390a in the light theme block', () => {
    expect(declarationsFor(':root[data-theme="light"]')).toContain('--accent-strong: #b3390a');
  });
  ...
});
```
Note the `describe` title convention: `'styles.css — Phase <N> <short topic>'`. 19-UI-SPEC.md's
five proposed titles (`'styles.css — Phase 19 control baseline'`, etc.) match this convention
exactly.

**Representative single `it()` using `selectorListDeclares`** (the combined-selector idiom),
lines 68-70:
```typescript
it('.theme-toggle pins color: var(--text)', () => {
  expect(selectorListDeclares('.theme-toggle', 'color: var(--text)')).toBe(true);
});
```

**The "no `prefers-color-scheme`" negative-assertion idiom**, lines 90-92 (inside the WR-04
`describe` block, not its own block):
```typescript
it('no prefers-color-scheme media query was introduced — data-theme is the only source of truth', () => {
  expect(css).not.toContain('prefers-color-scheme');
});
```
Uses the raw `css` (not `cssNoComments`) for negative assertions — the file comment at lines 13-18
explains why: a stray mention in a comment should still fail the assertion, so negative checks
must scan the untouched text, not the comment-stripped view. D-04's negative assertion (confirming
`.segmented` no longer declares `overflow: hidden`) should follow the same `expect(css).not.toContain(...)` pattern, scanning raw `css`, not `cssNoComments` — this matters because if the
banner comment for the new Phase 19 block or the removed-declaration's own explanatory comment
happens to still mention `overflow: hidden` in prose, an assertion against `cssNoComments` would
correctly ignore it, but an assertion meant to catch a real re-introduction should scan the same
way the existing precedent does (raw text) to stay consistent with house style — verify no
comment text near `.segmented` says "overflow: hidden" if this exact idiom is reused, or the
negative assertion could theoretically pass for the wrong reason. (Low risk in practice, since the
existing precedent already accepts this trade-off for `prefers-color-scheme`.)

---

### 7. `.segmented` and its options — D-10's retrofit target in full

**Analog**, `src/dashboard/styles.css` lines 779-797:
```css
.segmented {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}

.segmented__option {
  background: var(--surface);
  color: var(--text-secondary);
  border: none;
  padding: var(--space-xs) var(--space-md);
  cursor: pointer;
}

.segmented__option--active {
  background: var(--accent-strong);
  color: #ffffff;
}
```

D-10's edit: remove `overflow: hidden;` from `.segmented` (line 783); the container keeps its own
`border-radius: 4px` for the outer border sliver, and two new rules go immediately after
`.segmented__option` (before or after `--active`, either ordering is fine since they target
different pseudo-classes on the same element, not overlapping declarations):
```css
.segmented__option:first-child {
  border-radius: var(--radius-control) 0 0 var(--radius-control);
}

.segmented__option:last-child {
  border-radius: 0 var(--radius-control) var(--radius-control) 0;
}
```
Note `.segmented__option` itself declares no `border-radius` today — the rounded-corner look
previously came entirely from the parent's `overflow: hidden` clipping square children into the
parent's rounded shape. After D-10, the parent's own `border-radius: 4px` (line 781, unchanged)
and the two new child corner rules must visually reproduce the same silhouette. This is a real
visual mechanism change, not a pure refactor — flag this at the human checkpoint alongside D-08's
row-hover call-out.

---

## Shared Patterns

### Element-level baseline over class-based one-offs (D-01/D-05's core technique)
**Source:** no direct precedent exists yet in this file (the file has zero bare `input`/`select`/
`textarea`/`button` rules today) — the closest structural precedent for "a low-specificity rule
that named classes override for free" is the type-scale block itself, `src/dashboard/styles.css`
lines 113-140, where `body, .text-body { font-size: 16px; ... }` sets a baseline that
`.text-heading, h1, h2` and `.text-display` override by being separate, more specific rules with
their own complete property sets (not partial overrides). D-01/D-05 differ in an important way:
the new baseline is deliberately *partial* (only sets properties the 12 button classes/13 control
sites don't already set), relying on CSS specificity (element selector `0,0,1` loses to any class
selector `0,1,0`) rather than rule ordering. Apply to: the new `input, select, textarea` rule and
the new `button` rule.

### `:root`/`[data-theme]` token declaration shape
**Source:** `src/dashboard/styles.css` lines 15-110 (see Pattern 2 above).
**Apply to:** `--radius-panel`/`--radius-control` (theme-invariant shape — bare `:root` only).

### `color-mix(in srgb, …)` formula
**Source:** `src/dashboard/styles.css` lines 406-408, 673-675, 1007-1012 (see Pattern 3 above).
**Apply to:** D-06's `button:hover`, D-08's `.activity-table tbody tr:hover` retrofit.

### Banner-commented phase blocks with a stated class-contract warning
**Source:** `src/dashboard/styles.css` lines 362-366, 695-699, 925-931 (see Pattern 1 above).
**Apply to:** the single new Phase 19 block appended at the end of the file.

---

## No Analog Found

None — every one of D-01 through D-14 has a direct in-file precedent to imitate (this is expected
for a phase whose entire premise is "normalize toward patterns that already exist elsewhere in
this same file"). The one item with the thinnest precedent is the element-level baseline
technique itself (D-01/D-05), noted under Shared Patterns above — there is no existing bare-tag
selector in this file to copy verbatim, only the specificity mechanism to rely on.

---

## Landmines

Cascade hazards the planner should account for when ordering the new rules and writing tasks:

1. **`.error-state` shares its rule body with `.stub-panel`** (lines 312-318) — editing
   `.error-state`'s radius/padding per D-13 will also restyle `.stub-panel`, which is not named
   anywhere in CONTEXT.md, 19-RESEARCH.md, or 19-UI-SPEC.md. This is very likely a desirable side
   effect (same visual family — an error panel and a stub/placeholder panel probably *should*
   match) but it is an unlisted scope expansion the plan/task should call out explicitly rather
   than silently inherit.

2. **`.records-jump__link` already uses `appearance: none;`** (line 965) — the only
   `appearance` declaration in the entire file today. D-02 forbids `appearance: none` on the
   *new* `input`/`select`/`textarea` baseline, but this pre-existing exception on a `<button>`
   element is untouched and irrelevant to that rule (buttons aren't native form widgets in the
   same sense) — no conflict, but worth knowing so a reviewer doesn't flag it as a D-02 violation
   introduced by this phase. It already existed pre-Phase-19.

3. **No `!important` anywhere in the file** (confirmed via grep, zero matches) — good news: the
   new low-specificity `button`/`input`/`select`/`textarea` rules cannot be defeated by an
   `!important` landmine anywhere, and will not need one themselves. But it also means override
   ordering depends entirely on selector specificity and cascade order; there is no
   "belt-and-suspenders" `!important` anywhere to lean on if a specificity calculation is wrong.

4. **No shorthand `font:` declaration exists anywhere in the file today** (confirmed via grep,
   zero matches) — every existing rule sets `font-size`/`font-weight`/`line-height` as separate
   longhand properties. D-03/D-05's `font: inherit` on the new baseline will be the **first**
   shorthand `font` declaration in the stylesheet's history. This is safe here specifically
   because every one of the 12 button classes and the control-adjacent classes (`.filter-toggle`,
   `.preset-chip`, etc.) override with **longhand** `font-size`/`font-weight`/`line-height`
   properties, which win on their own sub-properties by specificity regardless of the shorthand
   set by the lower-specificity baseline — but if any *future* class rule were to use shorthand
   `font:` instead of longhand, ordering (not just specificity) would start to matter for which
   sub-properties end up winning. Not a Phase 19 defect, but worth a one-line comment near the new
   baseline rule warning future editors not to introduce a second shorthand `font:` rule without
   checking cascade order.

5. **`.chip__remove` (24px) and `.app-nav__toggle`/`.theme-toggle` (44px) already explicitly set
   `min-width`/`min-height`** (lines 517-518, 191-192, 204-205) — all three are class selectors
   with higher specificity than the new `button { min-height: 32px; }` baseline, so they are
   correctly preserved without any `:not()` exclusion needed. Confirmed no override risk, but
   flag it as an explicit "verified, no `:not()` needed" note for the executor, since D-01's
   discretion question raises `:not()` as an option — for D-05's button-dimension case, unlike
   D-01's `input[type]` case, no override rule is needed at all; specificity alone suffices.

6. **`:focus-visible` replacement must keep `outline: none` in the same rule** (D-09, already
   locked) — the existing rule being replaced (lines 332-335) sets `outline: 2px solid
   var(--accent); outline-offset: 2px;`. If the new rule only adds `box-shadow` without also
   setting `outline: none`, some browsers' default UA focus outline reappears once the custom
   `outline` declaration is gone, producing a double ring. This is already called out in
   19-UI-SPEC.md as load-bearing, repeated here because it's the single highest-risk one-line
   omission in the whole phase.

7. **`.segmented`'s rounded-corner illusion currently comes entirely from `overflow: hidden`**
   clipping square children (see Pattern 7 above) — removing it without adding the
   `:first-child`/`:last-child` radius rules in the *same* task/commit would produce square
   inner corners on the segmented control until the follow-up rule lands. D-09 and D-10 are
   documented as needing to ship together (RESEARCH.md Pitfall 3); this is the CSS-mechanics
   reason why, independent of the focus-ring argument.

---

## Metadata

**Analog search scope:** `src/dashboard/styles.css` (read in full, 1,092 lines, this session),
`src/dashboard/styles.test.ts` (read in full, 142 lines, this session). No other files searched —
per the phase's own scope note, no sibling-file analogs exist to search for; the codebase search
tools (Glob/Grep for controllers/services/components) do not apply to a CSS-only phase.
**Files scanned:** 2 (both fully read), plus targeted `grep` passes for `!important`, `all:`,
`appearance`, `font:`, and `border:` shorthand risk patterns across the same 2 files.
**Pattern extraction date:** 2026-08-12

---

*Phase: 19-design-system-control-styling*
