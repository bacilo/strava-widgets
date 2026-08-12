# Phase 19: Design System & Control Styling - Research

**Researched:** 2026-08-12
**Domain:** CSS-only design-system unification over an existing 1,092-line stylesheet (no framework, no build-tool changes, no new dependencies)
**Confidence:** HIGH

## Summary

This is not exploratory research — CONTEXT.md (D-01 through D-14) and 19-UI-SPEC.md already lock every technical decision, including exact CSS blocks, the two focus-ring contrast ratios, and rule placement. This document's job is to empirically verify every factual claim those two files make about the codebase, because the planner will write task-level file:line references from them, and a wrong line number or an inflated count silently degrades plan quality.

I read the full `src/dashboard/styles.css` (1,092 lines), the full `src/dashboard/styles.test.ts` (142 lines), and grepped every view file for `createElement`, `.type =`, `border-radius`, and `overflow`. **Every locked decision (D-01 through D-14) is implementable exactly as specified — nothing found here contradicts or blocks a single decision.** I did find seven small factual inaccuracies in CONTEXT.md/19-UI-SPEC.md's supporting narrative (counts and a mis-scoped file reference) that do not affect any decision's correctness but would mislead a planner writing precise line-reference tasks; each is documented below with the corrected figure. I also independently recomputed both D-11 contrast ratios from the WCAG relative-luminance formula and both match the UI-SPEC's stated values exactly (3.40:1 light, 6.02:1 dark) — HIGH confidence, no correction needed there.

**Primary recommendation:** Implement D-01 through D-14 exactly as written in 19-UI-SPEC.md; use the corrected counts/line numbers below (not CONTEXT.md's) when writing task file references; stage the human checkpoint using Phase 18's simpler `python3 -m http.server` + symlink pattern (not Phase 17's custom Node server) since this phase has no new async chunks to prove.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Form control visual baseline (border/padding/background) | Browser / Client (CSS) | — | Pure presentation; `styles.css` is the single source of design tokens (16-D04); no server involved |
| Button visual baseline + hover feedback | Browser / Client (CSS) | — | Same — `button` element selector, zero TypeScript changes (D-05) |
| `:focus-visible` ring + non-text contrast | Browser / Client (CSS) | — | Accessibility chrome is rendered entirely client-side; contrast is a static token-pair computation done once at plan time, not runtime |
| Overflow-clipping fix (`.segmented`, scrollers) | Browser / Client (CSS) | — | Container `overflow` is a CSS property; D-10 is CSS-only, no markup change |
| Card/spacing rhythm (`--radius-*` tokens) | Browser / Client (CSS) | — | Token declarations live in `:root`, consumed only by CSS |
| Regression guard (`styles.test.ts`) | Build / Test tooling (Node, `vitest` `node` env) | — | Text-only assertion over the CSS file on disk; no CSSOM, no jsdom, no browser — cannot prove rendering, only prove the rule text exists |
| Visual/interaction proof | Human (real browser) | — | The only tier capable of discharging "looks right" and "focus ring renders unclipped" — there is no jsdom/headless browser anywhere in this repo |

There is no API/backend tier in this phase at all — `src/dashboard/styles.css` is linked from `index.html`, never imported from TypeScript (`tsc` would fail on a CSS import, per 16-D04), and the phase touches zero server-side or data-pipeline code.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Control base strategy**
- D-01: Bare element selectors (`input, select, textarea`) carry the control baseline — no `.control` class, no TypeScript changes at any control-creation site.
- D-02: Style the box only; leave native chrome alone (no `appearance: none`, no vendor pseudo-elements). `color-scheme` per `data-theme` already makes native pickers/spinners theme correctly.
- D-03: `min-height: 32px` on controls, reusing the dimension already present three times in the stylesheet. Padding from `--space-xs`/`--space-sm`. `font: inherit`.
- D-04: Lock the baseline with text assertions in `styles.test.ts` using `declarationsFor()`. Proves the rule wasn't deleted; proves nothing about rendering.

**Button unification depth**
- D-05: A quiet `button` element baseline, no `.btn` system. Do not refactor any `createElement('button')` site, do not rename any of the 12 existing button classes.
- D-06: One shared `button:hover` using `color-mix(in srgb, var(--surface) 92%, var(--text))`. Also repairs the dead `.cta:hover` bug.
- D-07: Add a disabled treatment covering `:disabled` and `[aria-disabled="true"]`. Muted `--text-secondary`, `cursor: default`, reduced opacity.
- D-08: Retrofit `.activity-table tbody tr:hover` to the D-06 formula (currently mixes toward literal `black`). Call this out explicitly at the human checkpoint as a recorded, intentional deviation.

**Focus ring — contrast and clipping**
- D-09: Replace the global outline with a two-tone `box-shadow` ring: `box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent)`, with `outline: none` (load-bearing, prevents a double ring).
- D-10: Fix clipping at the containers, not with a second ring variant — remove `overflow: hidden` from `.segmented` (move radii to `:first-child`/`:last-child`), add `--space-xs` padding to `.splits-scroll`. `.records-jump` already has enough padding — no change needed there.
- D-11: Discharge UI-02's contrast requirement by computing it once: `--accent` on `--bg`, two pairs (light/dark), against the 3:1 WCAG non-text threshold. Record in 19-UI-SPEC.md. No luminance helper in the test suite.
- D-12: Keep `:focus-visible` global and unscoped — no per-component opt-in, so Phase 20's future clickable rows inherit it for free.

**Card and spacing rhythm (UI-03)**
- D-13: Two named radius tokens (`--radius-panel: 8px`, `--radius-control: 4px`) plus a shared panel rule applied to `.error-state`, `.empty-state`, `.calendar-picker`, `.config-notice`. Also pull `.stat-grid`'s gap from `--space-xl` to `--space-lg`.
- D-14: Overview gets the shared treatment and nothing more — zero form controls, zero markup changes, still included in the five-screen checkpoint comparison.

### Claude's Discretion

- Exact border/padding/background values for the control baseline (resolved in 19-UI-SPEC.md — see Code Examples below).
- Whether `type="button"`/`type="checkbox"` resets use `:not()` or a following override rule (19-UI-SPEC.md recommends a following override rule).
- Precise opacity/color values for the D-07 disabled treatment (19-UI-SPEC.md recommends `opacity: 0.6`, `cursor: default`).
- Whether `--radius-panel`/`--radius-control` are back-substituted into every existing literal declaration, or only used by new/retrofitted rules (19-UI-SPEC.md recommends narrow application — new/retrofitted rules only).
- Rule ordering/section placement in `styles.css` (19-UI-SPEC.md specifies in-place edits vs. a new Phase 19 banner block — see Architecture Patterns below).
- Whether `.chip__remove`'s 24px min-dimension is raised to 32px or left alone (19-UI-SPEC.md recommends leaving it at 24px — documented WCAG 2.5.8-floor exception from Phase 17).
- How new `styles.test.ts` assertions are grouped into `describe` blocks (19-UI-SPEC.md specifies five new blocks, one per decision area).

### Deferred Ideas (OUT OF SCOPE)

- Link styling (`a` outside `.app-nav__link`/`.cta`/`.detail-nav`) — adjacent to UI-02 but not discussed; candidate for a later polish pass.
- `src/widget/styles.css` (26 lines, embeddable widgets) — shares only `--font-stack` with the dashboard; not part of the five dashboard screens.
- A real `.btn` system with modifiers — explicitly rejected for this phase (D-05) to protect Activities; revisit if Phases 20-24 keep adding one-off button classes.
- Overview's structural problems (stacked-div PR rows, headline stats, Current Streak "ended" label) — scoped to Phase 21 (D-14 keeps them there).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Form controls (text, date, number, search inputs) styled consistently across every screen | Confirmed zero pre-existing `input`/`select`/`textarea` rules (grep of full `styles.css`, no match). Confirmed all 13 control-creation sites and their exact input `type` values (see Empirical Verification § D-01 leakage surface) — the D-01 baseline rule and its override in 19-UI-SPEC.md cover every type actually present. |
| UI-02 | Buttons/selects share one visual treatment with a `:focus-visible` ring meeting non-text contrast in both themes | Confirmed the current `:focus-visible` rule (line 332-335) and the two orange-on-orange collision sites (`.pagination__button--current`, `.segmented__option--active`) that D-09 fixes. Independently recomputed both D-11 contrast ratios from raw hex values — both match 19-UI-SPEC.md exactly (3.40:1 light, 6.02:1 dark), both clear the 3:1 WCAG 2.1 SC 1.4.11 threshold. Confirmed D-10's overflow-clipping ancestor list is exhaustive (see § Overflow-clipping ancestors below) — nothing under-specified. |
| UI-03 | Spacing/density/card treatment read as one rhythm across all five screens | Confirmed the radius/padding outliers D-13 targets exist exactly as described (`.error-state`/`.empty-state`/`.calendar-picker` have no radius; `.config-notice` has the wrong token; `.stat-grid` gap is the only out-of-step grid gap). Confirmed `overview.ts` has zero control-creation sites (D-14's premise). |
| ACT-01 | Activities screen controls adopt shared styling; row-click interaction model preserved as reference pattern | Confirmed `list.ts` is the densest control site (20 `createElement` call sites across button+input+select — see correction below) and confirmed the exact 5 disabled-state line numbers CONTEXT.md cites are byte-accurate, including the two in `list.ts` (491, 521) this requirement protects. |
</phase_requirements>

## Empirical Verification of CONTEXT.md / 19-UI-SPEC.md Claims

Every claim below was checked directly against `src/dashboard/styles.css` (read in full, 1,092 lines) and `src/dashboard/views/*.ts` / `src/dashboard/nav.ts` (grepped for `createElement`, `.type =`, `border-radius`, `overflow`). Method: `grep -n` for exact patterns plus manual line counting; results cross-checked against the claimed line numbers.

### Confirmed exactly as stated (no correction needed)

| Claim | Verification | Result |
|---|---|---|
| Zero `input`/`select`/`textarea` rules in `styles.css` | `grep -n` for `input,`/`select,`/`textarea,`/`^input`/`^select`/`^textarea` across the full file | **CONFIRMED** — zero matches |
| `.segmented { overflow: hidden }` exists | Line 783 | **CONFIRMED** exact line |
| `.cta:hover` is byte-identical to `.cta`'s base rule | Lines 289-302: base `background: var(--accent)` (291), hover `background: var(--accent)` (301) | **CONFIRMED** — dead rule |
| `.activity-table tbody tr:hover` mixes toward literal `black` | Line 407: `color-mix(in srgb, var(--surface) 92%, black)` | **CONFIRMED** exact line |
| Three existing 32px control dimensions | `.pagination__button` (545-546), `.calendar-day` (624-625), `.records-jump__link` (972-973) — all `min-width`/`min-height: 32px` | **CONFIRMED** — exactly three, no more |
| 12 existing button classes | `.cta`(289), `.filter-toggle`(452), `.preset-chip`(482), `.pagination__button`(544), `.segmented__option`(786), `.chip__remove`(516), `.chip-clear-all`(525), `.records-jump__link`(964), `.activity-table__sort-button`(385), `.calendar-day`(622), `.theme-toggle`(200), `.app-nav__toggle`(189) | **CONFIRMED** — all 12 present, no 13th found |
| 31 `createElement('button')` sites | `grep -rn "createElement('button')" src/dashboard/` | **CONFIRMED** exactly 31, across `detail-charts.ts`, `calendar.ts`, `trends.ts`, `list.ts`, `detail-map.ts`, `detail.ts`, `records.ts`, `nav.ts` (8 files) |
| 13 control-creation sites (input+select) | `grep -rn "createElement('input'\|'select')"` across all view files | **CONFIRMED** exactly 13: `list.ts` ×10 (lines 425, 667, 672, 732, 739, 807, 813, 863, 869, 1028), `calendar.ts` ×1 (279), `detail-charts.ts` ×1 (372), `trends.ts` ×1 (483). Zero `createElement('textarea')` anywhere — D-01's `textarea` in the base selector is pure future-proofing, no live site today. |
| Five live disabled states, exact line numbers | `list.ts:491` (`prevBtn.disabled = clampedPage <= 1`), `list.ts:521` (`nextBtn.disabled = clampedPage >= totalPages`), `detail-charts.ts:340` (`checkbox.disabled = atCap && !checked`), `trends.ts:824` (`banisterBtn.disabled = banisterUnavailable`), `calendar.ts:112` (`btn.disabled = true`, outside-month cells), `calendar.ts:131` (`btn.setAttribute('aria-disabled', 'true')`, rest days) | **CONFIRMED byte-exact** — all six line numbers (five sites, two selectors needed for calendar) match precisely |
| `overview.ts` has zero control/button-creation sites | `grep -c "createElement" src/dashboard/views/overview.ts` → 0 matches for input/select/button | **CONFIRMED** — D-14's premise holds |
| D-11 contrast ratios | Independently recomputed via WCAG relative-luminance formula (see § Contrast Computation below) | **CONFIRMED exactly** — 3.3995≈3.40:1 (light), 6.0157≈6.02:1 (dark) |
| `styles.test.ts` helper signatures (`declarationsFor()`, `selectorListDeclares()`) | Read full 142-line file | **CONFIRMED** exact signatures — see § Code Examples below |
| No `prefers-color-scheme` assertion pattern | Line 90-92 of `styles.test.ts`: `expect(css).not.toContain('prefers-color-scheme')` | **CONFIRMED** exact pattern — D-04's new assertions should follow the same `.not.toContain(...)`/`declarationsFor(...).toContain(...)` idiom |

### Corrections (minor — none block a decision, all are count/reference inaccuracies)

| CONTEXT.md / 19-UI-SPEC.md claim | Actual finding | Impact |
|---|---|---|
| "`color-mix(in srgb, …)` already used in eight places" (D-06 rationale) | **Actual count: 11**, not 8 — row-hover-toward-black (1, line 407, the retrofit target), row/PR permanent highlight (2: lines 411, 1011), calendar day tints (4: lines 674, 678, 682, 686), year-heatmap tints (4: lines 1079, 1083, 1087, 1091) | None — the undercount doesn't change the conclusion (browser support for `color-mix` is already assumed by the codebase either way). Cosmetic correction only. |
| "`list.ts` — 22 control sites, the densest" (canonical_refs) | **Actual count: 20** — 10 `createElement('button')` + 10 `createElement('input'/'select')` in `list.ts` | None — still correctly identified as the densest file. Planner should use 20, not 22, if writing an exhaustive task checklist. |
| `--radius-panel: 8px … already used by .card, .route-map, .chart-band` (19-UI-SPEC.md, 3 sites named) | **A 4th site also uses 8px: `.activity-row`** (line 262) | None for D-13 (discretion is narrow application to new/retrofitted rules only, and `.activity-row` isn't one of the four being retrofitted) — but the planner should know `--radius-panel` already has a 4th real-world referent if asked to back-substitute later. |
| `--radius-control: 4px … already used by .filter-toggle, .pagination__button, .calendar-day, .segmented, .config-notice` (5 sites named) | **A 6th site also uses 4px: `.badge`** (line 282) | Same as above — no impact on D-13's locked scope, only relevant if a future phase back-substitutes broadly. |
| "`radius currently splits three ways (8px / 4px / none)`" (D-13 rationale) | **Technically accurate only for the four selectors D-13 retrofits** (`.card`-style target = 8px, `.config-notice` = 4px, `.error-state`/`.empty-state`/`.calendar-picker` = none) — the file-wide radius picture also includes 6px (`.cta`, line 293), 999px (pills: `.preset-chip` 485, `.chip` 509), and 2px (`.year-heatmap__cell` 1068) | None — D-13's scope is explicitly narrow (the four named panels), so the "three ways" framing is correct *for that scope*. Flagging only so the planner doesn't generalize it to "the whole file has three radius values," which would be wrong. |
| `trends-volume-logic.ts` listed among files with "remaining control sites" (canonical_refs) | **Zero `createElement` calls of any kind** — it is a pure logic module (matches the `-logic.ts` naming convention used elsewhere: `list-logic.ts`, `calendar-logic.ts`); its one `input` reference (line 76 comment, line 82 function parameter) refers to function arguments, not DOM elements | None on any decision — D-01 requires zero TypeScript changes anywhere, so this file needs no attention regardless. Correction is only so a planner doesn't create a needless verification task for this file. The **real count of files with control/button creation is 8** (`list.ts`, `trends.ts`, `calendar.ts`, `detail-charts.ts`, `records.ts`, `detail.ts`, `nav.ts`, `detail-map.ts`), not 9. |

### Overflow-clipping ancestors — D-10 completeness check

`grep -n "overflow"` across the full stylesheet returns exactly 6 lines, on 4 distinct selectors:

| Selector | Line | Value | Has focusable descendants? | D-10 action |
|---|---|---|---|---|
| `.segmented` | 783 | `overflow: hidden` | Yes — `.segmented__option` buttons | **Fix required** — remove `overflow: hidden`, move radii to `:first-child`/`:last-child` (locked) |
| `.splits-scroll` | 802-803 | `overflow-x: auto` + `-webkit-overflow-scrolling: touch` | Not today (no focusable element currently inside), but the table could grow one | **Fix required** — add `--space-xs` padding as a forward guard (locked) |
| `.records-jump` | 959-960 | `overflow-x: auto` + `-webkit-overflow-scrolling: touch` | Yes — `.records-jump__link` buttons | **No change** — already has `padding: var(--space-sm)` (8px), exceeds the 4px the ring needs (locked, explicitly called out in 19-UI-SPEC.md so the executor doesn't add redundant padding) |
| `.sr-only` | 942 | `overflow: hidden` | No — this is the visually-hidden utility itself (1px×1px clip technique for screen-reader-only text); it is never itself a focusable element and does not clip a focusable descendant in the way `.segmented` does | **No action** — not a focus-ring clipping concern at all, a different CSS technique entirely |

**Conclusion: D-10 is NOT under-specified.** The enumeration in CONTEXT.md/19-UI-SPEC.md (`.segmented`, `.records-jump`, `.splits-scroll`) is exhaustive against every `overflow` declaration in the file — there is no fourth clipping ancestor with a focusable descendant that was missed.

### D-01 leakage surface — actual `input` type enumeration

CONTEXT.md frames the leakage risk as "the selector also matches `type="button"` and `type="checkbox"`." Grepping every `.type = '...'` assignment across all view files gives the ground truth:

| `input` type | Sites | File:line |
|---|---|---|
| `date` | 2 | `list.ts:668`, `list.ts:673` |
| `number` | 4 | `list.ts:733`, `list.ts:740`, `list.ts:864`, `list.ts:870` |
| `text` | 2 | `list.ts:808`, `list.ts:814` |
| `search` | 1 | `list.ts:1029` |
| `month` | 1 | `calendar.ts:280` |
| `checkbox` | 1 | `detail-charts.ts:373` |
| `radio` | **0** | none anywhere |
| `button` (on an `<input>` element) | **0** | none anywhere — every `.type = 'button'` assignment in the codebase (31 sites) is on a `document.createElement('button')` result, i.e. a `<button>` tag, never an `<input>` tag |

**Important correction to CONTEXT.md's framing:** the CSS type selector `input` matches only `<input>` HTML elements. A `<button type="button">` is a `<button>` tag and is never matched by an `input, select, textarea { ... }` rule regardless of its `type` attribute value — so the proposed `input[type="button"]` override rule in 19-UI-SPEC.md targets **zero actual elements** in this codebase today. It is harmless to include (it costs nothing and guards against a hypothetical future `<input type="button">`), but it is not load-bearing. **The only reset that is genuinely load-bearing today is `input[type="checkbox"]`** (1 site: `detail-charts.ts:373`, the overlay-cap checkbox) — without it, that checkbox would incorrectly receive the text-field border/padding/background treatment. The `input[type="radio"]` reset is, like `type="button"`, speculative — zero live sites, harmless to include for forward-compatibility with Phases 20-25's curation UI.

Recommendation for the planner: keep 19-UI-SPEC.md's three-type override rule (`button`, `checkbox`, `radio`) as written — it is cheap, forward-compatible, and matches the stated rationale of "Phase 24's curation UI may add more checkbox/radio sites" — but the task's acceptance criteria should not claim it fixes a `type="button"` leak today, since no such leak exists (buttons are `<button>` elements, not `<input>` elements, in every one of the 31 sites).

## Contrast Computation (D-11) — independently reproduced

Non-text contrast threshold: 3:1 (WCAG 2.1 SC 1.4.11). Standard relative-luminance formula: for each 8-bit channel `c`, `c_srgb = c/255`; if `c_srgb <= 0.03928` then `c_lin = c_srgb/12.92`, else `c_lin = ((c_srgb + 0.055) / 1.055) ^ 2.4`. `L = 0.2126*R_lin + 0.7152*G_lin + 0.0722*B_lin`. Contrast ratio = `(L_lighter + 0.05) / (L_darker + 0.05)`.

**Light theme: `--accent` `#fc4c02` vs `--bg` `#ffffff`**
- `#fc4c02`: R=252→R_lin=0.97347, G=76→G_lin=0.07249, B=2→B_lin=0.00061 (linear branch, `c_srgb`=0.00784 ≤ 0.03928)
- `L(#fc4c02) = 0.2126(0.97347) + 0.7152(0.07249) + 0.0722(0.00061) = 0.20698 + 0.05184 + 0.00004 = 0.25886`
- `L(#ffffff) = 1.0`
- Contrast = `(1.0 + 0.05) / (0.25886 + 0.05) = 1.05 / 0.30886 = 3.3995` → **3.40:1**

**Dark theme: `--accent` `#ff6b35` vs `--bg` `#1a1a2e`**
- `#ff6b35`: R=255→R_lin=1.0, G=107→G_lin=0.14723, B=53→B_lin=0.03566
- `L(#ff6b35) = 0.2126(1.0) + 0.7152(0.14723) + 0.0722(0.03566) = 0.2126 + 0.10531 + 0.00257 = 0.32049`
- `#1a1a2e`: R=26→R_lin=0.01033, G=26→G_lin=0.01033, B=46→B_lin=0.02732
- `L(#1a1a2e) = 0.2126(0.01033) + 0.7152(0.01033) + 0.0722(0.02732) = 0.00220 + 0.00739 + 0.00197 = 0.01155`
- Contrast = `(0.32049 + 0.05) / (0.01155 + 0.05) = 0.37049 / 0.06155 = 6.0178` → **≈6.02:1**

**Both values match 19-UI-SPEC.md's stated ratios exactly (3.40:1, 6.02:1). Confidence: HIGH — independently derived from the raw hex token values, not copied from the UI-SPEC.** Light theme's margin above the 3:1 floor is 0.40 (13.3%) — genuinely narrow, correctly flagged by 19-UI-SPEC.md as the pair to scrutinize first at the human checkpoint. `[VERIFIED: computed from src/dashboard/styles.css lines 20, 83, 85, 97, 99, 101 via the W3C WCAG 2.1 relative-luminance formula]`

## Standard Stack

No new libraries. This phase modifies exactly two files: `src/dashboard/styles.css` and `src/dashboard/styles.test.ts`. No `npm install` of any kind.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| (none) | — | — | CSS-only phase; existing `vitest`, `chart.js`, `leaflet` etc. are untouched |

**Installation:** none required.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero packages. No `npm install`, no new `package.json` dependency, no new `devDependency`. `Disposition: N/A` for the entire audit — skip the slopcheck/registry-verification protocol.

## Architecture Patterns

### Rule placement in `styles.css` (in-place edits vs. new banner block)

19-UI-SPEC.md's "Phase-Specific Notes" section already specifies exact placement, verified against real line numbers:

**In-place modifications** (edit existing rules where they already sit — do not move, do not duplicate):
- `:focus-visible` at lines 332-335 → replace `outline`/`outline-offset` with the D-09 box-shadow rule.
- `.card`'s sibling panels: `.error-state` (312-318), `.empty-state` (573-578), `.calendar-picker` (689-693), `.config-notice` (985-994), and `.stat-grid` (242-246) → edit in place per D-13.
- `.segmented`/`.segmented__option` (779-797) → remove `overflow: hidden` (783), add `:first-child`/`:last-child` radius rules per D-10.
- `.activity-table tbody tr:hover` (406-408) → swap `black` for `var(--text)` per D-08.
- `.splits-scroll` (801-804) → add `padding: var(--space-xs)` per D-10.

**New rules** — append after the existing Phase 18 block (which ends at line 1092, the file's last line), following the `/* ==== Phase N — Name ==== */` banner-comment precedent already used at lines 362-366 (Phase 17) and 925-931 (Phase 18):
- `--radius-control`/`--radius-panel` token declarations — co-locate with the spacing scale inside `:root` (lines 46-53), not in the new banner block.
- The `input, select, textarea` baseline + the `type="checkbox"`/`type="button"`/`type="radio"` override rule (D-01-D-04).
- The `button` baseline + `button:hover` (D-05, D-06).
- The `:disabled, [aria-disabled="true"]` disabled treatment (D-07) — one rule, shared by both baselines.

### System Architecture Diagram

```
                    styles.css (single source of truth)
                              │
      ┌───────────────────────┼───────────────────────┐
      │                       │                       │
 :root tokens          new element-level rules   in-place edits to
 (--radius-control,     (input/select/textarea,   existing rules
  --radius-panel added)  button, :disabled)        (:focus-visible,
      │                       │                    .segmented, .stat-grid,
      │                       │                    tr:hover, panel classes)
      └───────────┬───────────┴───────────┬───────────┘
                  │                       │
          cascades onto            cascades onto
        13 control-creation      31 button-creation
        sites across 4 files    sites across 8 files
        (list.ts, calendar.ts,  (list.ts, trends.ts, calendar.ts,
         detail-charts.ts,       detail-charts.ts, records.ts,
         trends.ts)              detail.ts, nav.ts, detail-map.ts)
                  │                       │
                  └───────────┬───────────┘
                              │
                   rendered DOM in a real browser
                              │
              ┌───────────────┴───────────────┐
              │                                │
    styles.test.ts text assertion      Human checkpoint (real browser,
    (proves rule text exists,          production-shaped /strava-widgets
     proves NOTHING about rendering)   URL) — the ONLY tier that can prove
                                         anything actually looks right
```

A reader can trace the primary flow: token declarations → new/edited CSS rules → cascade onto existing, unmodified TypeScript-created DOM → two disjoint proof mechanisms, neither of which alone can discharge the phase (text assertion proves existence, browser proves appearance).

### Pattern 1: Bare-element-selector baseline over class-based one-offs
**What:** A low-specificity `input, select, textarea { ... }` / `button { ... }` rule that every existing class selector (`.filter-toggle`, `.pagination__button`, etc.) naturally overrides by specificity, without any `!important` or `:not()` gymnastics for the properties those classes already declare.
**When to use:** When you need a baseline that must apply to every current AND future instance without touching creation-site code — exactly this phase's D-01/D-05 mandate.
**Example:**
```css
/* Source: 19-UI-SPEC.md, verified against src/dashboard/styles.css cascade order */
input, select, textarea {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-control);
  min-height: 32px;
  font: inherit;
}
/* .filter-toggle (line 452) already declares border/color/font-size and wins
   on all of them by specificity (0,1,0 vs 0,0,3) — only min-height/padding/
   radius (which .filter-toggle does NOT declare) are newly inherited. */
```

### Anti-Patterns to Avoid
- **`appearance: none` on the control baseline:** D-02 explicitly forbids this — a half-restyled native date/number/search widget looks worse than the untouched native one, and `color-scheme` already handles per-theme native chrome correctly at zero cost.
- **A second focus-ring variant for clipped containers:** D-10 explicitly forbids this — fix the clipping ancestor's `overflow`, don't special-case the ring.
- **`:not()` exclusion chains on the base control selector:** 19-UI-SPEC.md recommends a following override rule instead — it is easier to extend when Phase 24's curation UI adds more `checkbox`/`radio` sites, without touching the base rule.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Non-text contrast verification | A `styles.test.ts` luminance-computing helper | The two ratios D-11 already fixed in 19-UI-SPEC.md (3.40:1, 6.02:1) | The pair is closed-form and changes only if `--accent`/`--bg` themselves change (out of scope) — a helper adds test-suite complexity to compute a number that's already computed and independently reproduced in this document |
| Native form-control theming (date pickers, spinners, search clear-X) | Vendor pseudo-element CSS (`::-webkit-calendar-picker-indicator` etc.) | `color-scheme: light`/`dark` per `[data-theme]` block, already present | Already correct at zero marginal cost (D-02); vendor pseudo-elements are non-standard, inconsistent across browsers, and the documented worse outcome |
| Focus-ring double-outline prevention | A JS-based focus-visible polyfill or manual class toggling | Native CSS `:focus-visible` + `outline: none` on the same rule | `:focus-visible` is broadly supported; the only risk is the browser's own default outline painting alongside the box-shadow, solved by `outline: none` in the same rule (D-09) |

**Key insight:** every "don't hand-roll" item in this phase is really "don't re-derive something CONTEXT.md/19-UI-SPEC.md already derived correctly" — the discipline here is trusting and implementing the locked spec precisely, not re-solving it differently mid-implementation.

## Common Pitfalls

### Pitfall 1: Double focus ring from native UA outline + new box-shadow
**What goes wrong:** Chrome (and other browsers) paint a default focus outline on focusable elements. If the new `:focus-visible` rule adds `box-shadow` without also setting `outline: none`, both render simultaneously — a visible double ring.
**Why it happens:** `outline` and `box-shadow` are independent CSS properties; removing the old `outline: 2px solid var(--accent)` declaration does not implicitly suppress the browser's own UA-stylesheet default outline that reappears once the custom outline is gone.
**How to avoid:** `outline: none` must be in the same `:focus-visible` rule as the new `box-shadow` (19-UI-SPEC.md already has this — verify it survives implementation).
**Warning signs:** At the human checkpoint, a focus ring that looks "doubled" or has a thin extra line just outside the two-tone box-shadow.

### Pitfall 2: Assuming `input, select, textarea` matches `<button type="button">`
**What goes wrong:** A task or test might be written assuming the base control rule "leaks" onto buttons with `type="button"`, and spend effort building/testing a fix for a leak that doesn't exist.
**Why it happens:** CONTEXT.md's own framing ("the selector also matches `type="button"`") is imprecise — CSS type selectors match HTML tag names, not attribute values across tags. `input` never matches a `<button>` element regardless of its `type` attribute.
**How to avoid:** Keep the `input[type="button"]` override for forward-compatibility (cheap, harmless), but do not write a test asserting it "fixes" a current-state leak — there are zero `<input type="button">` elements in this codebase today (confirmed by grep).
**Warning signs:** A `styles.test.ts` assertion or task acceptance criterion that claims to regression-guard against a `<input type="button">` rendering incorrectly, when no such element exists to regress.

### Pitfall 3: Forgetting the `overflow` clipping fix leaves D-09's ring invisible on exactly the surfaces it was built to fix
**What goes wrong:** D-09's ring is specifically designed to solve the orange-on-orange collision on `--accent-strong` filled active states (`.pagination__button--current`, `.segmented__option--active`). But `.segmented__option--active` sits inside `.segmented`, which clips `box-shadow` exactly like it clipped the old `outline` — so without D-10's container fix, the segmented control's active option would still show no visible ring at all, even after D-09 ships.
**Why it happens:** `overflow: hidden`/`auto` clips box-shadow the same way it clips outline; fixing the ring formula alone is necessary but not sufficient.
**How to avoid:** D-09 and D-10 must land together, not sequentially with a gap — a plan that ships D-09 without D-10 in the same wave/checkpoint would demo a "fixed" ring that is invisible on the one control it was built to fix.
**Warning signs:** At the human checkpoint, tabbing to the x-axis segmented control's active option shows no ring at all (not a wrong-color ring — a completely absent one, because it's clipped).

### Pitfall 4: `color-mix()` browser support assumption
**What goes wrong:** D-06's hover formula and D-08's retrofit both rely on `color-mix(in srgb, ...)`. If a checkpoint is run in an old/unusual browser without `color-mix` support, hover and row-highlight colors silently fail to render (property is simply ignored, falling back to no background change).
**Why it happens:** `color-mix()` is a relatively recent CSS Color Module Level 5 feature.
**How to avoid:** This is a pre-existing codebase assumption (already used 11 times before this phase, not just introduced here), so it's a NOT a new risk introduced by Phase 19 — but the human checkpoint should be run in a current, standard browser (matching how every prior phase's checkpoint was run), never flagged as a Phase 19-specific regression if hover looks broken in an outdated browser.
**Warning signs:** Hover/row-highlight looking completely unchanged (not "wrong color," but literally no visual change at all) — check browser/engine version before treating as a code defect.

## Code Examples

Exact rules from 19-UI-SPEC.md, cross-checked against locked decisions and the real file:

### Control baseline (D-01–D-04)
```css
input,
select,
textarea {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-control);
  min-height: 32px;
  font: inherit;
}

input[type="button"],
input[type="checkbox"],
input[type="radio"] {
  border: none;
  background: transparent;
  padding: 0;
  min-height: auto;
  width: auto;
}
```
Only the `checkbox` branch is load-bearing today (1 live site: `detail-charts.ts:373`); `button`/`radio` are forward-compatible no-ops.

### Button baseline + shared hover (D-05, D-06)
```css
button {
  font: inherit;
  min-height: 32px;
  cursor: pointer;
  border-radius: var(--radius-control);
}

button:hover {
  background: color-mix(in srgb, var(--surface) 92%, var(--text));
}
```

### Disabled treatment (D-07) — covers all 5 confirmed live sites
```css
:disabled,
[aria-disabled="true"] {
  color: var(--text-secondary);
  opacity: 0.6;
  cursor: default;
}
```

### Focus ring (D-09) — replaces lines 332-335 in place
```css
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
}
```

### `.segmented` clipping fix (D-10) — edits lines 779-797
```css
.segmented {
  /* overflow: hidden;  <- removed */
}

.segmented__option:first-child {
  border-radius: var(--radius-control) 0 0 var(--radius-control);
}

.segmented__option:last-child {
  border-radius: 0 var(--radius-control) var(--radius-control) 0;
}
```

### `styles.test.ts` existing helpers (D-04's assertions must reuse these, not redefine them)
```typescript
// Source: src/dashboard/styles.test.ts lines 29-37, 44-57 (read verbatim)
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
Existing idiom for a negative assertion (D-04's "no `prefers-color-scheme`" precedent, line 90-92):
```typescript
expect(css).not.toContain('prefers-color-scheme');
```
19-UI-SPEC.md's five new `describe` blocks (control baseline, button baseline, disabled treatment, focus ring, radius tokens) should each use `declarationsFor()` for positive property assertions and this `.not.toContain(...)` idiom for any negative assertion (e.g., confirming `.segmented` no longer declares `overflow: hidden`).

## State of the Art

Not applicable in the conventional sense — this phase does not adopt a new framework or library. The one relevant "old → current" shift is internal to the codebase's own history:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Global `outline: 2px solid var(--accent)` focus ring (Phase 16) | Two-tone `box-shadow` ring with `outline: none` (Phase 19, D-09) | This phase | Fixes the orange-on-orange collision on `--accent-strong` fills introduced in Phase 17; requires the D-10 container-overflow fix to actually render on `.segmented` |
| Ad-hoc row-hover `color-mix(..., black)` (Phase 17) | Shared `color-mix(..., var(--text))` formula (Phase 19, D-08) | This phase | Corrects dark-theme over-darkening; light theme visually near-identical |

**Deprecated/outdated:** the pre-Phase-19 `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` rule (lines 332-335) is being replaced in place, not deprecated-and-kept — there is no backward-compatibility concern since this is a single-page app's own stylesheet, not a published API.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `color-mix(in srgb, ...)` is supported in whatever browser the human checkpoint uses (already assumed 11 times pre-Phase-19, not a new risk) | Common Pitfalls § 4 | Hover/row-highlight would silently render with no visible change; low risk since this is a pre-existing, already-shipped codebase assumption, not new to this phase |
| A2 | `19-UI-SPEC.md`'s recommended `opacity: 0.6` / `cursor: default` for the disabled treatment, and the "following override rule" (not `:not()`) choice for type resets, reflect the developer's actual preference and not just Claude's own discretion pick | Code Examples § Disabled treatment, § Control baseline | Low — both are explicitly marked as CONTEXT.md's "Claude's Discretion" items already resolved by the UI-checker-approved spec; if the developer disagrees at the checkpoint, it's a one-rule CSS tweak, not a re-plan |

**No claim in this document's Empirical Verification, Contrast Computation, or Code Examples sections is `[ASSUMED]`** — every factual claim there was independently checked against the actual file contents in this session (`[VERIFIED: src/dashboard/styles.css]`, `[VERIFIED: src/dashboard/styles.test.ts]`, `[VERIFIED: src/dashboard/views/*.ts grep]`, or `[VERIFIED: WCAG 2.1 relative-luminance formula, computed from raw hex values]`).

## Open Questions (RESOLVED)

1. **RESOLVED: Should the seven minor count/reference corrections above be back-ported into `19-UI-SPEC.md` before planning?** Resolved as recommended below — the Phase 19 plans use this document's corrected figures and `19-UI-SPEC.md` was left unedited. No locked decision and no CSS value is affected. Nothing in this section blocks planning or execution.
   - What we know: none of the seven corrections change any locked decision or any CSS value; they are narrative-accuracy issues only (counts, one mis-scoped file reference).
   - What's unclear: whether the planner should silently use the corrected figures (recommended) or whether 19-UI-SPEC.md itself should be edited for consistency with future re-reads.
   - Recommendation: use the corrected figures in plan-level file:line references (this document is now the source of truth for those specific numbers); editing 19-UI-SPEC.md is optional and low-priority since the checker already approved it and no decision changes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm test`, `npm run build-widgets`, `npm run verify-dashboard` | ✓ | v25.2.1 | — |
| npm | all `npm run` scripts | ✓ | 11.7.0 | — |
| TypeScript (`tsc`, via `npx`) | `npx tsc --noEmit -p tsconfig.json` gate | ✓ | 5.9.3 | — |
| `python3` | Human-checkpoint static server (`python3 -m http.server`, the Phase 18 precedent) | ✓ | 3.11.11 | If unavailable: reuse Phase 17's alternative — a small Node `http` server mirroring `verify-dashboard-publish.mjs`'s `MOUNT_PREFIX`/`safeResolve` logic (already proven to work; no new dependency either way) |
| Real browser (for the mandatory human checkpoint) | Success criterion 5, every UI-0x requirement | Assumed ✓ (developer's machine) | — | None — this is the sole proof mechanism for "looks right"; there is no fallback |

**Missing dependencies with no fallback:** none — everything needed is already present in this environment.

## Validation Architecture

**Hard constraint, verified directly:** `vitest.config.ts` sets `environment: 'node'` (confirmed by reading the file). `package.json` devDependencies contain `vitest@^4.0.18` and nothing else test-related — no `jsdom`, no `@testing-library/*`, no `puppeteer`, no `playwright`, anywhere in the dependency tree. **There is no CSSOM and no rendering engine available to any automated test in this repo.** Every claim in this phase is provable only by (a) a text assertion over the literal characters of `styles.css`, or (b) the human browser checkpoint. There is no third option, and no future test-framework addition changes this without adding a new dependency this phase does not authorize.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18, `environment: 'node'` (verified in `vitest.config.ts`) |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `npx vitest run src/dashboard/styles.test.ts` |
| Full suite command | `npm test` (884 tests passing pre-Phase-19, across 46 test files — verified baseline) |

### Phase Requirements → Test Map

| Req ID | Success criterion it maps to | Text-assertion coverage (mechanism a) | Human-checkpoint coverage (mechanism b) | What is NOT provable automatically |
|--------|-------------------------------|------------------------------------------|--------------------------------------------|--------------------------------------|
| UI-01 | Criterion 1 (every input/date/number/search renders with consistent border/padding/background) | `declarationsFor('input, select, textarea')` contains `border`, `padding`, `background`, `min-height` (D-04) — proves the rule text exists | Checkpoint step 1: load all five screens, confirm no unstyled browser-default text boxes | **Everything about actual rendering** — the assertion cannot see a computed style, a rendered box, or a native date-picker's appearance. Only the human checkpoint can confirm a text input "looks intentional." |
| UI-02 (control unification) | Criterion 2 (buttons/selects share one visual treatment) | `selectorListDeclares('button', 'font: inherit')`, `min-height: 32px`, `cursor: pointer` (D-04/D-05 style assertions) | Checkpoint step 4: hover every button once per screen, confirm `.cta` now visibly darkens/lightens | **Whether the hover color is visually distinguishable**, whether `.cta`'s "dead hover" is actually fixed in a rendered browser, whether the 12 existing button classes still look correct after the baseline cascades onto them |
| UI-02 (focus ring / contrast) | Criteria 2 and 5 (focus-visible ring meets non-text contrast, visible in both themes) | Assert `box-shadow` present, `outline: none` present, `.segmented` no longer declares `overflow: hidden` (D-04 focus-ring `describe` block) — plus the two contrast ratios are a **closed-form computation already done in this document and 19-UI-SPEC.md**, not a runtime test | Checkpoint steps 2-3: tab through controls in both themes, confirm the ring renders fully unclipped on `.segmented`, `.records-jump`, `.splits-scroll`, and on the two `--accent-strong` filled active states; scrutinize light theme specifically (narrower 3.40:1 margin) | **Whether the ring is actually unclipped in a rendered browser** — a text assertion can prove `overflow: hidden` was removed from the CSS text, but cannot prove no OTHER ancestor clips it, and cannot prove the ring is perceptually "clearly visible, not just technically passing" (19-UI-SPEC.md's own words) |
| UI-03 | Criterion 3 (spacing/density/card treatment read as one rhythm) | Assert `--radius-panel`/`--radius-control` declared once in `:root`, applied to the four retrofitted selectors (D-13 `describe` block); assert `.stat-grid` gap uses `--space-lg` | Checkpoint step 6: confirm Overview's shared spacing/card rhythm reads correctly with no structural change | **Whether the "rhythm" reads as visually consistent across five screens** — this is an inherently perceptual judgment a text assertion over CSS source cannot make |
| ACT-01 | Criterion 4 (Activities picks up new styling, row-click model unchanged) | None specific to ACT-01 beyond the shared UI-01/UI-02 assertions — there is no `list.ts`-specific text assertion possible since `list.ts` itself is unmodified (D-01/D-05 mandate zero TypeScript changes) | Checkpoint step 7: row-click still navigates, keyboard Tab/Enter works, return-from-detail highlight still flashes, sort/filter/pagination bit-for-bit unchanged, only visual chrome is new | **The entire interaction-model-preservation claim** — "functionally unchanged" for a click handler cannot be proven by any CSS text assertion; it requires literally clicking a row in a rendered browser. This is the single highest-risk untestable claim in the phase, since a CSS specificity mistake (e.g., an errant `pointer-events` or `cursor` override) could silently break the reference pattern Phase 20 depends on. |

### Sampling Rate
- **Per task commit:** `npx vitest run src/dashboard/styles.test.ts` (sub-second; only the file this phase touches)
- **Per wave merge:** `npm test` (full 884+ suite — confirms no incidental TypeScript regression, though this phase makes zero TS changes, so this is primarily a safety net for accidental scope creep)
- **Phase gate:** `npm test && npx tsc --noEmit -p tsconfig.json && npm run build-widgets && npm run verify-dashboard` all green, **then** the mandatory human checkpoint (success criterion 5) — following the exact Task 1 → Task 2 (blocking checkpoint) → Task 3 (record result) structure used in Phase 17 plan 17-15 and Phase 18 plan 18-16.

### Human Checkpoint Staging — concrete, runnable command sequence

Verified by reading the actual executed plans/summaries for 17-15 and 18-16. **Recommend Phase 18's simpler pattern for Phase 19** (Phase 17's custom Node server with SPA-fallback was justified by proving new async-chunk network behavior — Phase 19 introduces no new chunks, so the lighter `python3 -m http.server` + symlink approach that Phase 18 actually used is sufficient and was explicitly praised in its own threat model for adding zero new dependencies):

```bash
# 1. Full automated gate (must all exit 0 before opening the checkpoint)
npm test
npx tsc --noEmit -p tsconfig.json
npm run build-widgets
npm run verify-dashboard

# 2. Mount the built output under a production-shaped path (mirrors GitHub Pages'
#    project-page URL shape — serving at the server root reproduces the exact class
#    of defect that shipped Phase 16's black page behind a 15/15 green gate)
mkdir -p /tmp/gh-pages && ln -sfn "$PWD/dist/widgets" /tmp/gh-pages/strava-widgets
cd /tmp/gh-pages && python3 -m http.server 8099

# 3. Open, with browser devtools Console visible for the entire session:
#    http://localhost:8099/strava-widgets/#/            (Overview)
#    http://localhost:8099/strava-widgets/#/list         (Activities)
#    http://localhost:8099/strava-widgets/#/calendar      (Calendar)
#    http://localhost:8099/strava-widgets/#/records       (Records)
#    http://localhost:8099/strava-widgets/#/trends        (Trends)
```

This exact three-step sequence (`build-widgets` → `mkdir`+`ln -sfn` symlink trick → `python3 -m http.server`) is copied verbatim from `.planning/phases/18-records-trends-differentiators/18-16-PLAN.md` lines 116-119, which the developer already ran and approved ("it's all good," per `18-16-SUMMARY.md`). No new script needs to be written; no new dependency is installed (`python3 -m http.server` ships with the already-present Python 3.11.11).

**Do not serve at the bare server root.** `verify-dashboard-publish.mjs`'s own `MOUNT_PREFIX = '/strava-widgets'` constant (confirmed by reading the script) exists specifically because Phase 16 shipped a black-page defect behind a 15/15 green gate that only mounted at the root; the STATE.md postmortem is explicit that this project has now shipped rendering defects behind a green gate three separate times, twice implicated by root-vs-prefix mounting.

### Wave 0 Gaps

None — `styles.test.ts` already exists with the exact helpers D-04's new assertions need (`declarationsFor()`, `selectorListDeclares()`), and no new test file or fixture is required. The only "gap" is that the five new `describe` blocks 19-UI-SPEC.md specifies do not exist yet — that is ordinary Phase 19 implementation work, not a Wave 0 infrastructure gap.

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled per the workflow default), so this section is included for completeness, though nearly every category is not applicable to a CSS-only phase with zero new user input, zero new data flows, and zero new dependencies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth surface touched |
| V3 Session Management | No | No session surface touched |
| V4 Access Control | No | No access-control surface touched |
| V5 Input Validation | No | Zero new input handling — D-01 explicitly forbids any TypeScript change at control-creation sites; only CSS presentation of already-existing, already-validated inputs changes |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| CSS injection via unsanitized dynamic values | Tampering | Not applicable — every value in the new/edited rules is a static token (`var(--...)`) or a literal from `19-UI-SPEC.md`; no runtime-interpolated CSS is introduced |
| False-green automated gate hiding a rendering defect | Repudiation | This is the project's own documented, recurring threat (3 prior incidents per STATE.md/ROADMAP.md) — mitigated exclusively by the mandatory human checkpoint against a production-shaped `/strava-widgets` mount, never by adding more text assertions (which cannot see rendering by construction) |

## Sources

### Primary (HIGH confidence)
- `src/dashboard/styles.css` (read in full, 1,092 lines) — every claim about existing rules, radii, overflow, and color-mix usage counts
- `src/dashboard/styles.test.ts` (read in full, 142 lines) — exact `declarationsFor()`/`selectorListDeclares()` signatures and existing `describe` idiom
- `src/dashboard/views/*.ts`, `src/dashboard/nav.ts` (grepped for `createElement`, `.type =`) — control/button site counts and input-type enumeration
- `vitest.config.ts`, `package.json` (read directly) — `environment: 'node'` confirmation, no jsdom/puppeteer/playwright in devDependencies
- `scripts/verify-dashboard-publish.mjs` (read in full) — `MOUNT_PREFIX`/`safeResolve` mounting logic, `base: './'` rationale
- `scripts/build-widgets.mjs` (`buildDashboard()`, lines 296-331) — the `base: './'` Vite setting and its documented black-page rationale
- `.planning/phases/17-activity-browser-detail-views/17-15-PLAN.md` and `17-15-SUMMARY.md` — the Phase 17 human-checkpoint staging precedent (custom Node server, SPA fallback)
- `.planning/phases/18-records-trends-differentiators/18-16-PLAN.md` and `18-16-SUMMARY.md` — the Phase 18 human-checkpoint staging precedent (`python3 -m http.server` + symlink), recommended for Phase 19
- WCAG 2.1 relative-luminance/contrast formula (W3C specification) — used to independently reproduce D-11's two contrast ratios

### Secondary (MEDIUM confidence)
- None — every claim in this document was checked directly against a primary source in this session; no WebSearch was needed since this phase's entire domain is the local codebase itself.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new stack, CSS-only
- Architecture (rule placement, cascade behavior): HIGH — verified against real file line numbers and existing Phase 17/18 banner-comment precedent
- Empirical claims about the codebase (counts, line numbers): HIGH — every number in this document was independently grepped/counted in this session, not copied from CONTEXT.md
- Contrast computation: HIGH — independently derived from raw hex values via the W3C formula, matches 19-UI-SPEC.md exactly
- Human checkpoint staging: HIGH — copied verbatim from an already-executed, already-approved prior-phase plan (18-16), not a novel proposal
- Pitfalls: HIGH — all four are either explicit locked-decision rationale (D-09/D-10 interaction) or directly observed in the actual codebase (the `input[type=button]` non-leak)

**Research date:** 2026-08-12
**Valid until:** 30 days (stable — the codebase facts checked here don't change unless Phase 19 itself, or an earlier phase, is re-touched before planning completes)
