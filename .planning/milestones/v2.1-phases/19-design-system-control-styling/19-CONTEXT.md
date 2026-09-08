# Phase 19: Design System & Control Styling - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Give form controls, buttons, focus states and card/spacing rhythm **one shared visual treatment** across all five dashboard screens (Overview, Activities, Calendar, Records, Trends), implemented in `src/dashboard/styles.css`.

This phase fixes the root cause of the "raw" feel — the stylesheet has **zero `input`/`select`/`textarea` rules across 1,092 lines**, so every one of the 13 control-creation sites renders unstyled browser defaults. It is explicitly **not** a design-language refresh: no new colors, no new type roles, no new spacing scale.

The Activities screen (`list.ts`) picks up the new control styling while its row-click interaction model — the reference pattern Phase 20 builds on — stays functionally unchanged.

</domain>

<decisions>
## Implementation Decisions

### Control base strategy

- **D-01: Bare element selectors carry the control baseline.** `input, select, textarea { … }` in `styles.css` — no `.control` class, no TypeScript changes at the 13 control-creation sites across 9 view files. Zero risk of a missed site (which is exactly how the "raw" feel would return), and any control added in Phases 20–25 (curation UI, week-start select, zoom controls) inherits the treatment for free. Because the selector also matches `type="button"` and `type="checkbox"`, those need explicit resets so the text-field box treatment does not leak onto them.
- **D-02: Style the box only; leave native chrome alone.** Set border, padding, background, font and radius; do **not** use `appearance: none` and do **not** write vendor pseudo-element rules (`::-webkit-calendar-picker-indicator`, `::-webkit-inner-spin-button`, etc.). `color-scheme: light` / `color-scheme: dark` is already declared per `data-theme` block, so the native date picker, month picker, number spinners and search clear-X already re-render correctly for the active theme. A half-restyled native picker would look worse than the native one.
- **D-03: `min-height: 32px` on controls.** Reuses the control dimension already present three times in the stylesheet (`.pagination__button`, `.calendar-day`, `.records-jump__link`), so an input lines up exactly with the buttons beside it in the Activities filter bar and the Calendar header. Padding comes from `--space-xs` / `--space-sm`. No new magic value and no new spacing scale — 18-UI-SPEC § 17 stays satisfied. Also set `font: inherit`, since browsers do not inherit `--font-stack` into form controls by default.
- **D-04: Lock the baseline with text assertions in `styles.test.ts`.** Assert that the `input, select, textarea` rule exists and declares border, padding, background and `min-height`, using the `declarationsFor()` helper already in that file. This guards only against silent deletion by a later phase — it proves nothing about rendering. The mandatory human browser checkpoint remains the sole proof that anything *looks* right.

### Button unification depth

- **D-05: A quiet `button` element baseline, no `.btn` system.** Low-specificity `button { font: inherit; min-height: 32px; cursor: pointer; border-radius: … }` that the 12 existing button classes continue to override wherever they already declare a property. **Do not** refactor the 31 `createElement('button')` sites, do not rename classes, do not collapse the one-offs. This closes the inherited-font and cursor gaps everywhere at once while making it structurally impossible for Activities' row-click reference pattern to regress (success criterion 4).
  - The 12 existing treatments left in place: `.cta`, `.filter-toggle`, `.preset-chip`, `.pagination__button`, `.segmented__option`, `.chip__remove`, `.chip-clear-all`, `.records-jump__link`, `.activity-table__sort-button`, `.calendar-day`, `.theme-toggle`, `.app-nav__toggle`.
- **D-06: One shared `button:hover` using `color-mix(in srgb, var(--surface) 92%, var(--text))`.** Because `--text` flips per theme (`#333333` light, `#e0e0e0` dark), the surface darkens in light and lightens in dark — correct in both directions. This also repairs `.cta:hover`, which currently sets `background: var(--accent)`, **identical to its own base rule**, so the primary CTA has no hover feedback at all today.
- **D-07: Add a disabled treatment covering `:disabled` and `[aria-disabled="true"]`.** Muted color via `--text-secondary`, `cursor: default`, reduced opacity. `styles.css` has **no `:disabled` rule today**, so all five live disabled states render identically to enabled controls: pagination prev/next (`list.ts:491`, `list.ts:521`), the overlay checkbox at cap (`detail-charts.ts:340`), the Banister toggle (`trends.ts:824`), and calendar days (`calendar.ts:112`, `calendar.ts:131` — the `aria-disabled` arm is why both selectors are needed).
- **D-08: Retrofit `.activity-table tbody tr:hover` to the D-06 formula.** It currently mixes toward literal `black` in both themes, which darkens an already-dark surface in dark mode. This is a correction, not a redesign — success criterion 4 protects the row-click *interaction model*, which is untouched, and light theme is essentially unchanged. **Call this out explicitly at the human checkpoint** so the deviation from "visually unchanged" is a recorded decision, not a surprise.

### Focus ring — contrast and clipping

- **D-09: Replace the global outline with a two-tone `box-shadow` ring.** `box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent)` — an inner halo in the page background plus the accent ring. This guarantees separation on **any** fill, including the `--accent-strong` filled active states (`.pagination__button--current`, `.segmented__option--active`) where an `--accent` outline is currently orange-on-orange (`#fc4c02` ring on `#b3390a` fill in light; `#ff6b35` on `#c2410c` in dark).
- **D-10: Fix clipping at the containers, not with a second ring variant.** An ancestor's `overflow` clips `box-shadow` exactly as it clips `outline`, so D-09 alone does not solve this. Therefore: remove `overflow: hidden` from `.segmented` (it exists only to clip children into the rounded corners) and move the corner radii onto `.segmented__option:first-child` / `:last-child` instead; and add `--space-xs` padding to `.records-jump` and `.splits-scroll` (both `overflow-x: auto`) so the 4px ring has room to paint inside the scroll box. One ring variant, globally.
- **D-11: Discharge UI-02's contrast requirement by computing it once and documenting it.** Because D-09's inner halo is always `--bg`, the accent ring is adjacent to exactly one color per theme rather than whatever surface it landed on — so the claim reduces to two checkable pairs: `--accent` `#fc4c02` on `--bg` `#ffffff` (light) and `#ff6b35` on `#1a1a2e` (dark). Compute both ratios during planning, record them in `19-UI-SPEC.md` against the 3:1 non-text threshold, and have the human checkpoint confirm the ring actually renders by tabbing through controls in both themes. No luminance helper in the test suite.
- **D-12: Keep `:focus-visible` global and unscoped.** Do not scope the ring to controls. Leaving the selector bare means links, and the clickable rows Phase 20 adds, already inherit it with no opt-in work — which is what ROADMAP's "Phase 20 depends on Phase 19 (shared control/focus styling that the new interactive rows must match)" requires. Phase 20 may refine ring placement on full-width rows if it reads badly; the contract is inheritance by default.

### Card and spacing rhythm (UI-03)

- **D-13: Two named radius tokens plus a shared panel rule.** Add `--radius-panel: 8px` and `--radius-control: 4px` as tokens over the values already in use (no new numbers invented), then give `.error-state`, `.empty-state`, `.calendar-picker` and `.config-notice` the same surface + border + `--radius-panel` + `--space-lg` treatment `.card` already has. This normalizes the real outliers — radius currently splits three ways (8px / 4px / none) and `.error-state` + `.empty-state` sit at `--space-2xl` (48px) padding where every other panel uses `--space-md`. Also pull `.stat-grid`'s `gap: var(--space-xl)` (32px) to `--space-lg`, the only grid gap in the file that is out of step. The tokens give Phases 21–24 something to reference instead of re-picking literals.
- **D-14: Overview gets the shared treatment and nothing more.** `overview.ts` has **zero** form controls, so UI-03 is its entire stake in this phase. It picks up whatever the shared card/spacing rules give it — no markup changes, no hierarchy fixes. Its known structural problems (stacked-div PR rows, headline stats) are Phase 21's rebuild, and doing them here would be duplicated work. Overview is still included in the five-screen side-by-side comparison at the checkpoint (success criterion 3 names all five).

### Claude's Discretion

- Exact border, padding and background values for the control baseline, provided they compose with the existing tokens and honor D-03's 32px.
- Whether the `type="button"` / `type="checkbox"` resets from D-01 are written as `:not()` exclusions on the base selector or as a following override rule.
- Precise opacity/color values for the D-07 disabled treatment.
- Whether `--radius-panel` / `--radius-control` are additionally back-substituted into every existing literal `border-radius: 8px` / `4px` declaration, or only used by the new and retrofitted rules.
- Rule ordering and section placement within `styles.css`, and whether the new rules form a new commented "Phase 19" block following the Phase 17/18 precedent.
- Whether `.chip__remove`'s outlier 24px min-dimension is brought to 32px or left alone.
- How the new `styles.test.ts` assertions are grouped into `describe` blocks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contracts from prior phases (binding constraints)
- `.planning/phases/16-dashboard-shell-data-contract/16-UI-SPEC.md` — establishes `styles.css` as the single source of design tokens (16-D04), plain light DOM with no Shadow DOM, the 4-role/2-weight type scale, and the `--space-xs…3xl` spacing scale.
- `.planning/phases/17-activity-browser-detail-views/17-UI-SPEC.md` — § Color reserves `--accent-strong` for pagination and segmented-control active fills only; defines the `.activity-table`, `.filter-*`, `.chip`, `.pagination__*` and `.calendar-*` class contracts this phase restyles.
- `.planning/phases/18-records-trends-differentiators/18-UI-SPEC.md` — § 17 explicitly forbids a new spacing scale or a fifth type role. This constraint carries into Phase 19 unchanged and is why D-03 and D-13 reuse existing values rather than inventing any.

### Files this phase changes
- `src/dashboard/styles.css` — the 1,092-line stylesheet; sole implementation surface for D-01 through D-14 except the test assertions.
- `src/dashboard/styles.test.ts` — 142-line text-assertion regression guard; extended per D-04. Contains the `declarationsFor()` and `selectorListDeclares()` helpers to reuse.

### Files that create the controls being styled (read-only for this phase)
- `src/dashboard/views/list.ts` — 22 control sites, the densest; also owns the row-click reference pattern protected by success criterion 4 and the D-08 row-hover retrofit.
- `src/dashboard/views/trends.ts` — 10 control sites including the D-07 Banister disabled toggle.
- `src/dashboard/views/calendar.ts` — 5 control sites; `disabled` + `aria-disabled` days motivate D-07's dual selector.
- `src/dashboard/views/detail-charts.ts` — 3 control sites including the at-cap overlay checkbox.
- `src/dashboard/views/records.ts`, `src/dashboard/views/detail.ts`, `src/dashboard/nav.ts`, `src/dashboard/views/detail-map.ts`, `src/dashboard/views/trends-volume-logic.ts` — remaining control sites.
- `src/dashboard/views/overview.ts` — zero controls; relevant only to D-14.

### Milestone constraints
- `.planning/REQUIREMENTS.md` — UI-01, UI-02, UI-03, ACT-01 (plus the verification note: automated tests cannot discharge these; every phase ends with a human browser checkpoint under a production-shaped `/strava-widgets` URL).
- `.planning/ROADMAP.md` § Phase 19 — the five success criteria, including the human checkpoint as criterion 5.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`color-scheme: light` / `dark` per `data-theme` block** — already correct, and it is what makes D-02 (keep native chrome) viable at zero cost.
- **The `--space-xs…3xl` scale and 4-role type scale** — complete and sufficient; D-03 and D-13 draw entirely from them.
- **`declarationsFor()` / `selectorListDeclares()` in `styles.test.ts`** — ready-made helpers for D-04's assertions.
- **The 32px control dimension** — already used by `.pagination__button`, `.calendar-day` and `.records-jump__link`; D-03 and D-05 adopt it rather than picking a new size.
- **`color-mix(in srgb, …)`** — already used in eight places (row highlight, calendar tints, year-heatmap tints); D-06's hover formula is the same technique, so browser support is already assumed by the codebase.
- **`.sr-only` utility** (added Phase 18) — available if any control needs an accessible label.

### Established Patterns
- **Stylesheet is text-asserted, never DOM-tested.** vitest runs in the `node` environment with no jsdom and no headless browser anywhere in the repo. Any verification task must be either a text assertion or a human checkpoint — there is no third option.
- **Theming is attribute-driven only.** `styles.test.ts` asserts the absence of `prefers-color-scheme` in this file. New rules must theme via tokens under the two `[data-theme]` blocks, never a media query.
- **Phase-scoped commented blocks.** Phases 17 and 18 each appended a banner-commented section with a stated class contract. Phase 19 should follow, though its rules are largely element-level rather than new classes.
- **Class contracts are treated as frozen downstream.** The Phase 17 block says "Do not rename these classes downstream" — reinforcing D-05's no-refactor stance.

### Integration Points
- Every rule lands in `src/dashboard/styles.css`, linked from `index.html`, never imported from TypeScript (`tsc` would fail on a CSS import — 16-D04).
- `.segmented` is the only structural markup-adjacent change (D-10), and it is CSS-only: `overflow` removed from the container, radii moved to `:first-child` / `:last-child`. No `detail-charts.ts` edit required.
- No data files, no build-script changes, no `copyDataFiles` additions — this phase adds no new assets to publish.

</code_context>

<specifics>
## Specific Ideas

- **The dead `.cta:hover` is a concrete bug to fix, not a style preference** — `.cta:hover, .cta:focus-visible { background: var(--accent) }` is byte-identical to `.cta`'s own base declaration, so the primary CTA has never had hover feedback.
- **`.segmented { overflow: hidden }` is a focus-ring trap**, not a cosmetic choice — it clips both `outline` and `box-shadow` on its options. Any ring solution that does not address it fails UI-02 on the detail view's x-axis toggle.
- **The 24px `.chip__remove`** is the only control below 32px; noted as discretion rather than a locked change.
- **Human checkpoint staging** was raised and not discussed in depth — the roadmap already fixes it (production-shaped `/strava-widgets` URL, all five screens side by side, tab through controls in both themes). Planning should treat it as a first-class task, not an afterthought, given this project has shipped rendering defects behind a fully green automated gate three times.

</specifics>

<deferred>
## Deferred Ideas

- **Link styling** — `styles.css` has no rules for `a` outside `.app-nav__link`, `.cta` and `.detail-nav`. A shared link treatment was identified but not discussed; it is adjacent to UI-02 and could be folded into a later polish pass rather than expanding this phase.
- **`src/widget/styles.css` (26 lines)** — the embeddable widgets share the `--font-stack` value character-for-character with the dashboard but nothing else. Whether the widget bundle should adopt any of this design system is a separate question, and the widgets are not part of the five dashboard screens.
- **A real `.btn` system with modifiers** — explicitly rejected for this phase (D-05) to protect Activities. If Phases 20–24 keep adding one-off button classes, collapsing all of them onto a shared base becomes worth its own phase.
- **Overview's structural problems** (stacked-div PR rows, headline stats, Current Streak "ended" label) — already scoped as Phase 21 per ROADMAP; D-14 keeps them there.

</deferred>

---

*Phase: 19-design-system-control-styling*
*Context gathered: 2026-08-12*
