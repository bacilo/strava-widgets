# Phase 19: Design System & Control Styling - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 19-design-system-control-styling
**Areas discussed:** Control base strategy, Button unification depth, Focus ring — contrast + clipping, Card & spacing rhythm scope

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Control base strategy | Element selectors vs `.control` class vs both | ✓ |
| Button unification depth | 12 one-off treatments, 31 button sites | ✓ |
| Focus ring — contrast + clipping | Accent-on-accent fills, overflow clipping | ✓ |
| Card & spacing rhythm scope | How far to normalize UI-03 | ✓ |

**User's choice:** All four areas.

---

## Control base strategy

### Q1 — How should the shared control styling attach to the 13 input/select sites across 9 view files?

| Option | Description | Selected |
|--------|-------------|----------|
| Element selectors (Recommended) | `input, select, textarea { … }`. Zero TS churn, zero missed sites, future controls inherit free. Also hits type=button/checkbox, so those need resets | ✓ |
| A `.control` class at every site | Fully explicit and greppable, but touches 9 files and one missed site silently keeps a raw default | |
| Element base + class for variants | Element baseline plus `.control--sm` / `.control--inline` modifiers for genuinely different cases | |

**User's choice:** Element selectors → **D-01**
**Notes:** The decisive argument was failure mode, not effort — a missed creation site reproduces exactly the defect the phase exists to fix, and Phases 20–25 add more controls.

### Q2 — How should native browser chrome be handled inside the element baseline?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep native, lean on `color-scheme` (Recommended) | Style the box only; `color-scheme` already themes pickers, spinners and the search clear-X | ✓ |
| Neutralize spinners, keep pickers | Strip number spinners only; small vendor-prefix surface | |
| Fully custom appearance | `appearance: none` with custom glyphs; maximum cross-browser consistency, large vendor-pseudo surface | |

**User's choice:** Keep native → **D-02**
**Notes:** `color-scheme: light` / `dark` is already declared per `data-theme` block, so this option costs nothing and a half-restyled picker would look worse than the native one. Also consistent with the milestone excluding a design-language refresh.

### Q3 — What vertical size should the control baseline set?

| Option | Description | Selected |
|--------|-------------|----------|
| 32px min-height, match existing (Recommended) | Reuses the number already in the stylesheet three times; inputs align with adjacent buttons | ✓ |
| 32px desktop, 44px under 640px | Adds a media query for the mobile touch target the nav already respects | |
| Padding-only, no min-height | Least prescriptive; date and text inputs would not land on the same height across browsers | |

**User's choice:** 32px min-height → **D-03**
**Notes:** Invents no new value, so 18-UI-SPEC § 17's ban on a new spacing scale is untouched. The 44px mobile bump was not rejected on merit — it simply was not needed to satisfy UI-01, and adds a second size to verify at the checkpoint.

### Q4 — Should the baseline be locked by assertions in `styles.test.ts`?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — extend `styles.test.ts` (Recommended) | Text assertions that the rule exists and declares border/padding/background/min-height, via the existing `declarationsFor()` helper | ✓ |
| No — human checkpoint only | Automated gates gave false confidence three times; a text assertion proves nothing about rendering | |
| You decide | Let the planner choose | |

**User's choice:** Extend the test → **D-04**
**Notes:** Accepted on the explicit understanding that it guards against silent deletion only. The human browser checkpoint retains sole ownership of visual correctness.

---

## Button unification depth

### Q1 — How much of the 12 existing button treatments should Phase 19 unify?

| Option | Description | Selected |
|--------|-------------|----------|
| Quiet `button` element baseline (Recommended) | Low-specificity baseline the 12 classes keep overriding; no class touched, so Activities cannot regress | ✓ |
| Introduce `.btn` + modifiers, refactor all | Most coherent end state and best foundation for Phases 20–24; largest diff and most regression surface on the reference screen | |
| Element baseline + collapse near-duplicates | Baseline plus folding `.filter-toggle` / `.preset-chip` / `.pagination__button` into one rule | |

**User's choice:** Quiet element baseline → **D-05**
**Notes:** Success criterion 4 (Activities visually and functionally unchanged) was the binding constraint — `list.ts` holds 22 of the control sites. The `.btn` system was deferred rather than dismissed; see Deferred Ideas.

### Q2 — Should the baseline carry a shared hover treatment, and how should it behave in dark theme?

| Option | Description | Selected |
|--------|-------------|----------|
| Shared hover, mix toward `--text` (Recommended) | `color-mix(in srgb, var(--surface) 92%, var(--text))` — darkens in light, lightens in dark; also fixes the dead `.cta:hover` | ✓ |
| Shared hover, keep mixing toward black | Exact continuity with today's row hover, but keeps the dark-theme direction wrong | |
| Fix `.cta` only, no shared hover | Smallest diff; leaves most of the 31 buttons with no hover feedback | |

**User's choice:** Mix toward `--text` → **D-06**
**Notes:** Surfaced during the discussion that `.cta:hover` sets a value byte-identical to its own base rule — the primary CTA has never had hover feedback. That made "fix `.cta` only" the floor rather than a real option.

### Q3 — Should the baseline include a disabled treatment?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — `:disabled` and `[aria-disabled]` (Recommended) | One rule covering both selectors; closes the Activities pagination case and picks up calendar rest days | ✓ |
| Yes, but `:disabled` only | Narrower; calendar rest days arguably handled by `.calendar-day--rest` | |
| No — out of scope | Treat as Phase 20 interaction polish | |

**User's choice:** Both selectors → **D-07**
**Notes:** Grounded in a grep: five live disabled states across `list.ts`, `detail-charts.ts`, `trends.ts` and `calendar.ts`, and no `:disabled` rule anywhere in 1,092 lines of CSS. The `aria-disabled` arm exists because `calendar.ts:131` sets the attribute rather than the property.

### Q4 — Retrofit `.activity-table tbody tr:hover` despite success criterion 4?

| Option | Description | Selected |
|--------|-------------|----------|
| Retrofit it (Recommended) | A correction, not a redesign; criterion 4 protects the interaction model, which is untouched | ✓ |
| Leave it exactly as-is | Strict reading: nothing about the Phase 20 reference screen changes here | |
| Retrofit, and note it for Phase 20 | Change it now and record the corrected formula as Phase 20's row baseline | |

**User's choice:** Retrofit → **D-08**
**Notes:** The third option's intent (recording it for Phase 20) was folded into D-08 anyway via the explicit checkpoint call-out, so the choice was really retrofit-vs-freeze.

---

## Focus ring — contrast + clipping

### Q1 — How should the ring be reworked to survive accent fills and overflow containers?

| Option | Description | Selected |
|--------|-------------|----------|
| Two-tone ring via `box-shadow` (Recommended) | `0 0 0 2px var(--bg), 0 0 0 4px var(--accent)` — guarantees separation on any fill | ✓ |
| Keep outline, fix the containers | Preserves the native outline but does not solve orange-on-orange on filled active states | |
| Outline + inverted ring on filled states | Smallest diff, targets the two known contrast failures; needs a new override per filled control | |

**User's choice:** Two-tone box-shadow → **D-09**
**Notes:** The option description as presented claimed box-shadow escapes `overflow: hidden` clipping. **That was wrong** and was corrected immediately: an ancestor's overflow clips box-shadow exactly as it clips outline. The correction did not change the choice — the two-tone ring still uniquely solves the contrast problem — but it forced the clipping question to be decided separately in Q2 rather than being a side effect.

### Q2 — How should the ring survive `.segmented { overflow: hidden }` and the two scrollers?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop `overflow: hidden`, move radius to options (Recommended) | Same visual result via `:first-child` / `:last-child` radii; padding on the two scrollers | ✓ |
| Inset ring inside clipping ancestors | Zero container changes, but creates two ring variants and eats into small controls | |
| Uniform inset ring everywhere | One rule, clipping stops mattering; reads as an inner border and shrinks 32px controls | |

**User's choice:** Fix the containers → **D-10**
**Notes:** Keeps exactly one ring treatment globally, which is what makes D-11's contrast argument reduce to two token pairs and D-12's inheritance contract clean.

### Q3 — How should UI-02's contrast requirement be discharged with no headless browser?

| Option | Description | Selected |
|--------|-------------|----------|
| Compute once, document in UI-SPEC (Recommended) | Two ratios recorded against the 3:1 threshold; human confirms it renders | ✓ |
| Add a contrast assertion to `styles.test.ts` | Catches token-change regressions; needs a luminance helper in a text-assertion test file | |
| Human checkpoint only | Consistent with the milestone's stance on false-green gates | |

**User's choice:** Compute and document → **D-11**
**Notes:** Viable specifically because D-09 makes the ring always adjacent to `--bg`, collapsing an open-ended per-surface question into two fixed pairs.

### Q4 — Should Phase 19 define the ring contract for non-control interactive elements?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep `:focus-visible` global and unscoped (Recommended) | Links and Phase 20's rows inherit with no opt-in work | ✓ |
| Global ring + explicit row contract | Adds a written spec for focused rows so Phase 20 implements against it | |
| Controls only, defer rows to Phase 20 | Narrower phase, but ROADMAP lists Phase 20 as depending on this styling | |

**User's choice:** Global and unscoped → **D-12**
**Notes:** Satisfies ROADMAP's stated Phase 20 dependency by inheritance rather than by document, leaving Phase 20 free to refine placement on full-width rows.

---

## Card & spacing rhythm scope

### Q1 — How far should Phase 19 normalize card treatment and spacing?

| Option | Description | Selected |
|--------|-------------|----------|
| Two named radii + shared panel rule (Recommended) | `--radius-panel` / `--radius-control` over existing values; retrofit the four unstyled panels | ✓ |
| Token-only, adopt gradually | Pure groundwork, zero visual change; leaves `.error-state` at 48px padding with no radius | |
| Fix the visible outliers only | Smallest diff a checkpoint can see; leaves the radius vocabulary undocumented | |

**User's choice:** Tokens + shared panel rule → **D-13**
**Notes:** Chosen because UI-03 asks for one rhythm now, not groundwork. No new numbers are invented — both tokens name values already in the file — so 18-UI-SPEC § 17 remains satisfied.

### Q2 — How should Overview be treated, given Phase 21 rebuilds it?

| Option | Description | Selected |
|--------|-------------|----------|
| Apply shared treatment, no restructuring (Recommended) | Overview inherits the shared rules; structural problems stay Phase 21's | ✓ |
| Also fix Overview's worst spacing by hand | Avoids dragging down the checkpoint comparison; risks duplicating Phase 21 | |
| Exclude Overview from the comparison | Contradicts success criterion 3, which names all five screens | |

**User's choice:** Shared treatment only → **D-14**
**Notes:** Overview has zero form controls, so UI-03 is its entire stake in this phase. It stays in the five-screen comparison regardless.

---

## Claude's Discretion

- Exact border, padding and background values for the control baseline, subject to D-03's 32px.
- Whether D-01's `type="button"` / `type="checkbox"` resets are `:not()` exclusions or a following override rule.
- Precise opacity and color values for the D-07 disabled treatment.
- Whether the D-13 radius tokens are back-substituted into every existing literal `border-radius` declaration or used only by new and retrofitted rules.
- Rule ordering and section placement in `styles.css`; whether to follow the Phase 17/18 banner-comment convention.
- Whether `.chip__remove`'s outlier 24px min-dimension is raised to 32px.
- How the new `styles.test.ts` assertions are grouped into `describe` blocks.

## Deferred Ideas

- **Link styling** — no rules for `a` outside `.app-nav__link`, `.cta` and `.detail-nav`. Identified but not discussed; adjacent to UI-02, suits a later polish pass.
- **`src/widget/styles.css` (26 lines)** — shares only `--font-stack` with the dashboard. Whether the embeddable widgets adopt this design system is a separate question; widgets are not among the five dashboard screens.
- **A real `.btn` system with modifiers** — explicitly rejected here (D-05) to protect Activities. Worth its own phase if Phases 20–24 keep adding one-off button classes.
- **Overview's structural problems** (stacked-div PR rows, headline stats, Current Streak "ended" label) — already scoped as Phase 21; D-14 keeps them there.
- **Human checkpoint staging** — raised at the close and not explored, since ROADMAP already fixes the procedure (production-shaped `/strava-widgets` URL, all five screens side by side, tab through controls in both themes).
