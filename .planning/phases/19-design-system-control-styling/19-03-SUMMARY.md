---
phase: 19-design-system-control-styling
plan: 03
subsystem: ui
tags: [css, buttons, hover-states, disabled-states, design-tokens, dashboard]

# Dependency graph
requires:
  - phase: 19-01
    provides: "--radius-control (4px) theme-invariant CSS custom property"
  - phase: 19-02
    provides: "Phase 19 banner block at end of styles.css, the input/select/textarea baseline, and the first of two intentional shorthand font: inherit declarations"
provides:
  - "Bare `button {}` baseline (font: inherit, min-height: 32px, cursor: pointer, border-radius: var(--radius-control)) reaching all 31 createElement('button') sites by cascade, zero TypeScript change"
  - "Unscoped `:disabled, [aria-disabled=\"true\"]` treatment (color: var(--text-secondary), opacity: 0.6, cursor: default) — the file's first disabled rule ever, reaching all five live disabled states"
  - "Shared button:where(:not(...)):hover rule delivering D-06's color-mix(in srgb, var(--surface) 92%, var(--text)) formula while excluding disabled controls and the two --accent-strong fills and the four calendar tint classes"
  - ".cta:hover repaired from a dead byte-identical-to-base declaration to color-mix(in srgb, var(--accent) 92%, var(--text))"
  - ".activity-table tbody tr:hover retrofitted from a literal-black mix to color-mix(in srgb, var(--surface) 92%, var(--text))"
affects: [19-05, "any future plan adding a button-creation site or a disabled control"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Element-level button baseline over class-based one-offs: bare `button` selector (0,0,1) reaches every button-creation site by cascade; any of the 12 existing button classes overrides for free"
    - "Zero-specificity :where(:not(...)) exclusion list to let a pseudo-class-bearing shared rule (0,1,1) skip specific higher-priority-by-content class modifiers without raising the shared rule's own specificity"
    - "Second and last shorthand font: inherit declaration in the file, completing the two-shorthand contract plan 19-02's banner comment forward-declared"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css

key-decisions:
  - "Wrote the hover exclusion selector as button:where(:not(:disabled, [aria-disabled=\"true\"], .pagination__button--current, .segmented__option--active, .calendar-day--tint-1, .calendar-day--tint-2, .calendar-day--tint-3, .calendar-day--tint-4)):hover — :where() keeps specificity at 0,1,1, identical to a bare button:hover, so the correction is purely which elements the rule reaches, not how strongly it competes"
  - ".cta:hover mixes from var(--accent), not var(--surface) like the shared button hover, because .cta's base fill is accent itself — the shared button-hover formula was structurally inapplicable to .cta and needed its own edit"
  - "Row-hover retrofit (black to var(--text)) is a deliberate, acknowledged visual change to Activities, flagged here for plan 19-05's human checkpoint per the plan's spec_correction — not a silent contradiction of success criterion 4's 'visually unchanged' framing"

patterns-established:
  - "The file's two shorthand font: declarations (input/select/textarea baseline from 19-02, button baseline from this plan) target fully disjoint element sets, so there is no cascade-order conflict between them — do not add a third without re-checking this invariant"

requirements-completed: [UI-02, ACT-01]

# Metrics
duration: 12min
completed: 2026-08-12
---

# Phase 19 Plan 03: Button Baseline, Shared Hover, Disabled Treatment & Row-Hover Fix Summary

**Bare `button {}` baseline plus a zero-specificity `:where(:not(...))`-scoped shared hover give all 31 button-creation sites a quiet font/cursor/radius/min-height floor and one hover feedback color without disturbing the two `--accent-strong` active fills or the calendar distance-tint scale, the file's first-ever `:disabled` rule mutes five live disabled states, `.cta:hover` finally has real feedback instead of a dead byte-identical declaration, and the activity-table row hover no longer darkens toward literal black in dark theme.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-12T19:08Z (approx, per worktree reset)
- **Completed:** 2026-08-12T19:12:03Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Bare `button` baseline rule (`font: inherit`, `min-height: 32px`, `cursor: pointer`, `border-radius: var(--radius-control)`) added at `0,0,1` specificity, reaching all 31 `createElement('button')` sites across 8 view files purely by cascade — none of the 12 existing button classes changed shape or color, verified by the plan's Node acceptance assertion and by `.chip__remove`'s 24px / `.theme-toggle`+`.app-nav__toggle`'s 44px min-width/min-height exceptions surviving untouched (`grep -c` returns 1 and 2 respectively)
- First `:disabled, [aria-disabled="true"]` rule in the file's history — `color: var(--text-secondary)`, `opacity: 0.6`, `cursor: default` — reaching all five live disabled states, listed below with file:line anchors
- Shared `button:where(:not(...)):hover` rule delivers D-06's `color-mix(in srgb, var(--surface) 92%, var(--text))` formula at `0,1,1` specificity (identical to a bare `button:hover`) while a zero-specificity `:where(:not(...))` exclusion list skips `:disabled`, `[aria-disabled="true"]`, `.pagination__button--current`, `.segmented__option--active`, and the four `.calendar-day--tint-1..4` classes explicitly (no attribute-substring match) — confirmed via the plan's Node assertion that all eight exclusion tokens are present and via a second assertion confirming no bare `button:hover` rule exists anywhere in the file
- `.cta:hover, .cta:focus-visible` repaired from `background: var(--accent)` (byte-identical to `.cta`'s own base declaration — the primary CTA had never had hover feedback) to `color-mix(in srgb, var(--accent) 92%, var(--text))`, reaching both the CTA's `<a>` and `<button>` sites since the fix is on the shared selector, not a new rule
- `.activity-table tbody tr:hover` retrofitted from `color-mix(in srgb, var(--surface) 92%, black)` to `color-mix(in srgb, var(--surface) 92%, var(--text))`, matching D-06's directional logic (darkens in light theme, lightens in dark) instead of over-darkening an already-dark `--surface` toward literal black
- Zero `!important` declarations in the file (unchanged from before this plan), zero button-creation sites or button classes edited, zero TypeScript files touched — `git status --porcelain src/dashboard/views src/dashboard/nav.ts` empty after every task

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the quiet button baseline and the unscoped disabled treatment** - `48e7a1c` (feat)
2. **Task 2: Add the shared button hover with the zero-specificity exclusion list** - `4e2f111` (feat)
3. **Task 3: Repair the dead .cta hover and retrofit the activity-table row hover** - `6da4f6d` (fix)

_Note: This is a worktree-isolated parallel executor run; the plan-metadata commit (SUMMARY.md) is committed separately per worktree protocol, not as a `docs:` commit alongside STATE.md/ROADMAP.md, which the orchestrator owns centrally after merge._

## Files Created/Modified
- `src/dashboard/styles.css` - Added the `button` baseline rule, the `:disabled`/`[aria-disabled="true"]` rule, and the `button:where(:not(...)):hover` shared hover rule to the Phase 19 block; edited `.cta:hover, .cta:focus-visible` and `.activity-table tbody tr:hover` in place

## Exact declarations as written

**`button` baseline (Task 1):**
```css
button {
  font: inherit;
  min-height: 32px;
  cursor: pointer;
  border-radius: var(--radius-control);
}
```

**Disabled treatment (Task 1):**
```css
:disabled,
[aria-disabled="true"] {
  color: var(--text-secondary);
  opacity: 0.6;
  cursor: default;
}
```

**Shared hover, full selector verbatim with specificity arithmetic (Task 2):**
```css
button:where(:not(
      :disabled,
      [aria-disabled="true"],
      .pagination__button--current,
      .segmented__option--active,
      .calendar-day--tint-1,
      .calendar-day--tint-2,
      .calendar-day--tint-3,
      .calendar-day--tint-4
    )):hover {
  background: color-mix(in srgb, var(--surface) 92%, var(--text));
}
```
Specificity: `:where()` contributes zero, so the whole selector is `0,1,1` — identical to a bare `button:hover`. Each excluded selector is `0,1,0` (a single class) or `0,1,0`-equivalent (`:disabled`/`[aria-disabled="true"]` are pseudo-class/attribute selectors of the same weight), all of which a bare `button:hover` at `0,1,1` would otherwise beat. The `:where(:not(...))` correction changes *what the rule reaches*, not *how strongly it competes* — nothing else in the cascade shifted.

**`.cta:hover` before/after (Task 3):**
- Before: `background: var(--accent);` — byte-identical to `.cta`'s own base `background: var(--accent)` at line 297, so the primary CTA had zero hover feedback since the rule was written.
- After: `background: color-mix(in srgb, var(--accent) 92%, var(--text));`
- Reason the mix base differs from the shared `button:hover` formula: `.cta`'s base fill *is* accent, not surface — mixing `--surface` into an accent-filled CTA would turn it grey under its `color: #ffffff` label. Mixing 8% `--text` into `--accent` darkens in light theme and lightens in dark, the same directional logic as D-06's formula, while keeping the white label readable. This is not new accent usage in the reserved-list sense — the primary CTA is item 1 on 19-UI-SPEC's accent reservation list.

**`.activity-table tbody tr:hover` before/after (Task 3):**
- Before: `background: color-mix(in srgb, var(--surface) 92%, black);`
- After: `background: color-mix(in srgb, var(--surface) 92%, var(--text));`
- This is a correction, not a redesign: mixing toward literal `black` over-darkens an already-dark `--surface` in dark theme, while in light theme `black` and `--text: #333333` produce visually similar results at 8%. `cursor: pointer` on `.activity-table tbody tr` and the `.activity-table__row--highlight` transition were confirmed untouched.

## Five live disabled states (file:line anchors)

The `:disabled, [aria-disabled="true"]` rule and the hover exclusion's first two tokens reach these five live states (six anchors — pagination prev/next share one state, both live on the same `.pagination__button` class):

1. **Pagination prev/next** — `list.ts:491` (`prevBtn.disabled = clampedPage <= 1`), `list.ts:521` (`nextBtn.disabled = clampedPage >= totalPages`)
2. **Overlay-cap checkbox** — `detail-charts.ts:340` (`checkbox.disabled = atCap && !checked`)
3. **Banister toggle** — `trends.ts:824` (`banisterBtn.disabled = banisterUnavailable`)
4. **Outside-month calendar cells** — `calendar.ts:112` (`btn.disabled = true`)
5. **Rest-day calendar cells** — `calendar.ts:131` (`btn.setAttribute('aria-disabled', 'true')`)

## Two derived corrections to D-06 (for plan 19-05's checkpoint agenda)

Both stated plainly here, per this plan's own `<spec_correction>` block, so plan 19-05 can carry them onto the human checkpoint as explicit call-out rows:

1. **The shared hover selector cannot be a bare `button:hover`.** `button:hover` is `0,1,1`, which *beats* every single-class button modifier at `0,1,0` — including `.pagination__button--current` and `.segmented__option--active` (both fill with `var(--accent-strong)` under white text) and the four `.calendar-day--tint-1..4` classes (the accent distance-tint scale). A bare `button:hover` would have replaced the current-page pagination fill and active segmented fill with the surface mix while leaving white text on top (roughly 1.1:1 contrast — unreadable), and flattened the hovered calendar day's tint to grey. The corrected selector uses `:where(:not(...))`, which contributes zero specificity, so the rule stays at `0,1,1` — the fix is purely which elements are reached, not a specificity change.
2. **`.cta:hover` cannot be repaired by the shared hover rule at all.** `.cta:hover` is `0,2,0`, which already beats `button:hover` (`0,1,1`) regardless of any exclusion list, and five of `.cta`'s ten sites are `<a>` elements that a `button` selector never reaches. The only cascade path to "the primary CTA has hover feedback" is editing `.cta:hover`'s own declaration directly (Task 3), using the same `color-mix` technique but mixing from `var(--accent)` instead of `var(--surface)`.

## Decisions Made
- No `:not()` exclusion added to the `button` baseline itself for `.chip__remove` (24px) or `.theme-toggle`/`.app-nav__toggle` (44px) — all three are class selectors at `0,1,0` and beat the baseline's `0,0,1` `min-height: 32px` automatically. Verified via `grep -c 'min-width: 24px'` (1) and `grep -c 'min-width: 44px'` (2), both unchanged from pre-plan counts.
- Disabled rule placed at the very end of the Phase 19 block (after the button baseline and hover), deliberately winning the later-rule tiebreak against equal-specificity class rules that declare `color` — specifically `.pagination__button { color: var(--text) }` (a disabled pagination button must read as muted) and `.calendar-day--rest { color: var(--text-secondary) }` (already the same value, so nothing changes there).
- Kept the combined `.cta:hover, .cta:focus-visible` selector list as-is rather than splitting it — showing the hover shade on keyboard focus alongside the existing focus ring is harmless and keeps the edit to one declaration.

## Deviations from Plan

None — plan executed exactly as written, including both derived corrections to D-06's stated cascade mechanism, which the plan itself pre-authorized in its `<spec_correction>` block (not a deviation from the plan; the plan's own text specified the corrected selector and the `.cta:hover` edit). The one implementation detail worth recording: the plan's acceptance-criteria Node assertion for the hover rule searches for the literal substring `:where(:not(` with no intervening whitespace, so the selector was formatted as `button:where(:not(\n      :disabled,\n      ...\n    )):hover` (opening parens adjacent, list items indented) rather than with a line break between `:where(` and `:not(` — purely a formatting choice to satisfy the grep-style assertion, the resulting CSS is behaviorally identical either way.

## Issues Encountered

One self-caught formatting issue during Task 2: the first draft of the `:where(:not(...))` selector had a newline between `:where(` and `:not(` for readability, which caused the plan's own acceptance-criteria Node assertion (searching for literal `:where(:not(`) to fail with "no :where(:not(...)) hover rule". Reformatted to keep the two tokens adjacent; re-ran the assertion and all other Task 2 acceptance criteria, all passed. No scope change, no additional commit needed since this was caught before the Task 2 commit was made.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All three tasks' full acceptance-criteria suites (grep counts, five Node assertions across the plan, `git status --porcelain` on view/nav TypeScript files, `npx tsc --noEmit`, and `npx vitest run src/dashboard/styles.test.ts`) passed for every task. `src/dashboard/styles.css` now has: two shorthand `font: inherit` declarations total (input/select/textarea baseline from 19-02 plus this plan's button baseline — the phase-wide value 19-02's banner comment forward-declared), a `button` baseline, a first-ever disabled rule, a shared button hover with its exclusion list, a repaired `.cta:hover`, and a corrected `.activity-table tbody tr:hover`. Zero `!important` in the file. No blockers for plan 19-04 (segmented-control radii, independent of this plan's hover/disabled work) or plan 19-05, whose human checkpoint agenda should include: (1) the shared hover formula's perceptual legibility, (2) `.cta`'s repaired hover on both `<a>` and `<button>` sites, (3) the two `--accent-strong` fills and the four calendar tints surviving hover in a rendered browser, (4) all five disabled states reading as disabled, (5) the activity-table row-hover's acknowledged visual change in dark theme specifically, and (6) confirmation that Activities' row-click model still works — none of this is provable without a rendering engine, which this repo does not have.

---
*Phase: 19-design-system-control-styling*
*Completed: 2026-08-12*
