---
phase: 19-design-system-control-styling
plan: 02
subsystem: ui
tags: [css, form-controls, design-tokens, dashboard]

# Dependency graph
requires:
  - phase: 19-01
    provides: "--radius-control (4px) and --radius-panel (8px) theme-invariant CSS custom properties"
provides:
  - "Element-level input/select/textarea baseline (border, background, color, padding, radius, min-height, font: inherit) reaching all 13 control-creation sites by bare selector, zero TypeScript change"
  - "input[type=button/checkbox/radio] override rule excluding native controls from the text-field box treatment"
  - "Phase 19 banner block at end of styles.css documenting the deletion-warning contract and the two-shorthand-font: guard"
affects: [19-03, 19-05, "any future plan adding a form control"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Element-level baseline over class-based one-ones: bare `input, select, textarea` selector (specificity 0,0,1) reaches every control-creation site by cascade; any class selector on the same element overrides for free"
    - "First shorthand `font:` declaration in the file's history (D-03); the banner comment records this is 1 of 2 the phase adds, not 'the only one'"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css

key-decisions:
  - "Banner comment framed as a deletion warning, not a rename warning, since this phase introduces zero new classes — matches D-01's zero-TypeScript-change constraint"
  - "Banner's shorthand-font: warning written forward-looking (references plan 19-03's upcoming button baseline by name) rather than as a snapshot claiming uniqueness, since 19-03 legitimately adds a second shorthand font: declaration two plans later"
  - "Type-reset override rule documented in an inline comment as: checkbox arm is the one live exclusion (detail-charts.ts:373), button/radio arms are zero-site forward-proofing only — no claim made that button/radio fix a present-day leak"

patterns-established: []

requirements-completed: [UI-01, ACT-01]

# Metrics
duration: 12min
completed: 2026-08-12
---

# Phase 19 Plan 02: Control Baseline & Type-Reset Summary

**Bare `input, select, textarea` element selector gives all 13 control-creation sites a shared box treatment (border/background/padding/radius/min-height/inherited font) with zero TypeScript change, plus a following override rule excluding the one live checkbox from that treatment.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-12T19:04Z (approx, per worktree reset)
- **Completed:** 2026-08-12T19:06:27Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- New Phase 19 banner block appended at the end of `styles.css` (after the Phase 18 block's last rule), stating a deletion warning scoped to "no new classes" and a forward-looking note that this is the first of two intentional shorthand `font:` declarations the phase adds
- `input, select, textarea` baseline rule declares all seven required properties — `border: 1px solid var(--border)`, `background: var(--surface)`, `color: var(--text)`, `padding: var(--space-xs) var(--space-sm)`, `border-radius: var(--radius-control)`, `min-height: 32px`, `font: inherit` — reaching all 13 `createElement('input'|'select')` sites across `list.ts`, `calendar.ts`, `detail-charts.ts`, `trends.ts` purely by cascade
- `input[type="button"], input[type="checkbox"], input[type="radio"]` override rule immediately follows the baseline, resetting `border: none`, `background: transparent`, `padding: 0`, `min-height: auto`, `width: auto` — with an inline comment recording that only the checkbox arm is load-bearing today
- Zero `appearance: none` and zero vendor pseudo-element (`::-webkit-*`) rules added anywhere (D-02, verified by grep count)
- `git status --porcelain src/dashboard/views src/dashboard/nav.ts` empty after both tasks — the 13 control-creation sites were reached entirely by cascade, no TypeScript file touched

## Task Commits

Each task was committed atomically:

1. **Task 1: Open the Phase 19 banner block and add the input/select/textarea baseline** - `4bb31cb` (feat)
2. **Task 2: Add the type-reset override so the box treatment does not leak onto the checkbox** - `0419c6d` (fix)

_Note: This is a worktree-isolated parallel executor run; the plan-metadata commit (SUMMARY.md) is committed separately per worktree protocol, not as a `docs:` commit alongside STATE.md/ROADMAP.md, which the orchestrator owns centrally after merge._

## Files Created/Modified
- `src/dashboard/styles.css` - Appended the Phase 19 banner block, the `input, select, textarea` baseline rule, and the `input[type="button"/"checkbox"/"radio"]` override rule

## Exact banner text used

```
/* ==========================================================================
   Phase 19 — Design System & Control Styling
   Element-level baseline for every `input`, `select` and `textarea` the
   dashboard renders, reached by bare element selector rather than a new
   class — this phase introduces no new classes. Do not delete these rules;
   removing them requires re-auditing every createElement('button'|'input'|
   'select') site across the 8 view files that currently rely on this
   cascade to receive their box treatment.

   This `input, select, textarea` rule's `font: inherit` is the first of two
   intentional shorthand `font:` declarations added in this Phase 19 block —
   the second is the `button` baseline plan 19-03 adds later in this same
   block (D-05). The two rules target disjoint element sets, so there is no
   cascade-order conflict between them. Do not add a third shorthand `font:`
   rule anywhere in this file without checking cascade order first: every
   existing class here overrides with longhand `font-size`/`font-weight`/
   `line-height`, which win on their own sub-properties regardless of a
   shorthand set by a lower-specificity rule — but that guarantee only holds
   because no other shorthand `font:` competes with it today.
   ========================================================================== */
```

## Exact baseline declarations (Task 1)

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
```

`textarea` has **zero** live sites today — there is no `createElement('textarea')` anywhere in the codebase. Its inclusion in the selector list is pure forward-proofing, intended per the plan, not an error.

## Exact override declarations (Task 2)

```css
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

Only the `input[type="checkbox"]` arm is load-bearing today: it excludes the single live site, `detail-charts.ts:373` (the overlay-cap checkbox), from the text-field box treatment. The `input[type="button"]` and `input[type="radio"]` arms match **zero** elements in this codebase — every `.type = 'button'` assignment (31 sites, confirmed by RESEARCH.md) is on a `document.createElement('button')` result, i.e. a `<button>` tag, which the CSS `input` type selector never matches regardless of its `type` attribute. Both arms are kept anyway as cheap, forward-compatible exclusions for future checkbox/radio sites (e.g. Phase 24's curation UI) — this summary makes no claim that they fix a present-day leak, per RESEARCH.md Pitfall 2.

## Confirmed counts

- `::-webkit-*` vendor pseudo-element rules: **0** (D-02 compliance, no change from baseline)
- `appearance: none`: **1** — the single pre-existing occurrence on `.records-jump__link` (line 965), untouched by this plan
- Comment-stripped shorthand `font:` declarations: **1** at the end of this plan (the `input, select, textarea` rule's `font: inherit`). This becomes **2** once plan 19-03 adds the `button` baseline's `font: inherit` per D-05 — both values are correct at their respective points in the phase; `3` or more at any point would indicate an unplanned shorthand.

## Decisions Made
- Banner comment framed as a deletion warning (not a rename warning) since Phase 19 introduces zero new classes — the risk this phase's cascade creates is silent removal of the element-level rule, not renaming a class nobody uses.
- Banner's shorthand-`font:` caution written forward-looking, naming plan 19-03's upcoming `button` baseline explicitly, rather than claiming "the file's only shorthand `font:` declaration" — that claim would be falsified two plans later and a shipped comment contradicting the shipped stylesheet was judged worse than no comment.
- Type-reset rule placed as a following override rule (not a `:not()` chain on the base selector), matching 19-UI-SPEC.md's locked recommendation — extensible for future checkbox/radio sites without touching the base rule.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria (banner/rule grep counts, the two Node declaration-presence assertions, the `::-webkit-` and `appearance: none` counts, the comment-stripped shorthand `font:` count, rule-order assertion, `git status --porcelain` on TS files, `npx tsc --noEmit`, and `npx vitest run src/dashboard/styles.test.ts`) passed on first attempt for both tasks.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The `input, select, textarea` baseline and its type-reset override now exist at the end of `styles.css`, ready for plan 19-03's `button` baseline (which adds the second and last shorthand `font: inherit` in the same Phase 19 block per D-05) to land immediately after. No blockers. Rendering verification (that a real browser shows the intended border/padding/background, that native date/month/number/search chrome still themes correctly, and that inherited font resolves to Label at all 13 sites) is deferred to plan 19-05's human browser checkpoint, per this plan's own `<verification>` section — there is no CSSOM or rendering engine in this repo to prove any of that automatically.

---
*Phase: 19-design-system-control-styling*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: src/dashboard/styles.css
- FOUND: .planning/phases/19-design-system-control-styling/19-02-SUMMARY.md
- FOUND commit: 4bb31cb (Task 1)
- FOUND commit: 0419c6d (Task 2)
- FOUND commit: dbdf26d (docs: SUMMARY.md)
