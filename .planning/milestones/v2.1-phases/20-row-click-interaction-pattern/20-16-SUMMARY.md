---
phase: 20-row-click-interaction-pattern
plan: 16
subsystem: ui
tags: [css, cascade-guard, at-rule, links, records, gap-closure]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    provides: "plan 20-14's cascadeWinningBodyDeclaring/assertNoAtRuleOverride helper pair and the seven-assertion guard shape they established"
provides:
  - ".pr-table__cell-link — the CSS class that will style D-13's five/two new PR-table and progression-table cell anchors as gesture targets, not text links"
  - "A D-13 paragraph in the Phase 20 stylesheet banner, recording the appearance discretion (no visible change) so it is not re-litigated as an oversight"
  - "Five new styles.test.ts assertions guarding the new rule to the same standard as the rest of the Phase 20 block: three cascade-winner/at-rule-companion pairs, one non-vacuous negative, one paired bare-a-vs-cell-link specificity case"
affects: [20-17, records-pr-tables, progression-table]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS treatment landed one wave ahead of the markup that will use it, so a later markup plan (20-17) cannot ship an unstyled appearance regression between the two commits"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts

key-decisions:
  - "Exercised D-13's 'Claude's Discretion' appearance clause in the direction of zero visible change to the Records tables — color: inherit, text-decoration: none, display: block, no new custom property, no hover/visited state — and recorded that reasoning in both the stylesheet comment and the banner paragraph so a future reader does not mistake it for an unstated oversight"

requirements-completed: []

# Metrics
duration: ~12min
completed: 2026-08-17
---

# Phase 20 Plan 16: PR-table cell-link CSS treatment Summary

**Added `.pr-table__cell-link` (color: inherit, text-decoration: none, display: block) to the Phase 20 stylesheet block ahead of D-13's markup change, so the five PR-table and two progression-table cell anchors land as full-cell gesture targets without becoming visible underlined text links — guarded by three cascade-winner/at-rule-companion pairs, a non-vacuous negative, and a paired bare-a specificity assertion matching plan 20-14's established shape.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-17T20:32:00Z
- **Completed:** 2026-08-17T20:44:20Z
- **Tasks:** 2 of 2 complete
- **Files modified:** 2 (`src/dashboard/styles.css`, `src/dashboard/styles.test.ts`)

## Accomplishments

- **Task 1 — CSS rule and banner paragraph.** Added `.pr-table__cell-link { color: inherit; text-decoration: none; display: block; }` immediately after `.activity-row:hover` and before `.activity-table__row--navigable`, with a comment stating all four required points: why the anchors exist (R18/R19), why the Date cell keeps its underline, why `display: block` is load-bearing (D-12's modified-click refusal falling through the cell padding otherwise), and why this does not contradict D-06's "underline carries the affordance" sentence. Extended the Phase 20 banner with a D-13 paragraph naming the class and freezing its contract downstream, in the same register as the existing D-06/D-09/D-10/D-11 paragraphs.
- **Task 2 — Guards in the 20-14 shape.** Added five `it` cases to the Phase 20 describe block: three `cascadeWinningBodyDeclaring`/`assertNoAtRuleOverride` pairs (text-decoration, color, display), a negative assertion resolved through the cascade winner (not `selectorListDeclares`) so a deleted rule throws instead of passing vacuously — applying the IN-10 lesson from `20-REVIEW.md` to a new assertion — and a paired assertion pinning the bare `a` rule's `underline` against `.pr-table__cell-link`'s `none` in one case, with a comment explaining the class-beats-type specificity resolution.
- `npx vitest run src/dashboard/styles.test.ts` (81/81, up from 76/76), `npx tsc --noEmit -p tsconfig.json` (zero diagnostics), and `npm run build-widgets` (exit 0, zero `css-syntax-error` occurrences) all pass. The comment-stripped stylesheet contains no stray `*/`. `git diff --stat HEAD~2 HEAD -- src/` lists only the two expected files, 90 insertions, 0 deletions.

## Task Commits

1. **Task 1: Add the .pr-table__cell-link rule and record its rationale in the Phase 20 banner** — `3026b33` (feat) — `src/dashboard/styles.css`
2. **Task 2: Guard the new rule in the shape plan 20-14 established** — `106d88a` (test) — `src/dashboard/styles.test.ts`

## Files Created/Modified

- `src/dashboard/styles.css` - `.pr-table__cell-link` rule (3 declarations) plus a D-13 paragraph in the Phase 20 banner comment
- `src/dashboard/styles.test.ts` - five new assertions in the `styles.css - Phase 20 row-click interaction pattern` describe block

## Decisions Made

- None beyond the plan's own `binding_decision` — exercised D-13's appearance discretion in the no-visible-change direction, exactly as the plan specified, and recorded the reasoning in the stylesheet rather than treating it as an open question.
- Left `requirements-completed` empty despite the plan's `requirements: [UX-03]` frontmatter, mirroring plan 19-15's precedent (STATE.md): `REQUIREMENTS.md`'s own UX-03 entry states it remains open, blocked on R18/R19 (D-12 modifier-click/window-open), which this CSS-only prerequisite plan does not resolve — it lands the stylesheet treatment D-13's markup change will need one wave ahead of plan 20-17, which performs the actual markup change and feeds the next rendered checkpoint that can re-evaluate R18/R19. Marking UX-03 complete here would contradict `REQUIREMENTS.md`'s own still-open text.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' automated verify blocks passed on first attempt; no auto-fixes, no blocking issues, no architectural questions.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The CSS treatment is live and guarded, ahead of any markup consuming it. Plan 20-17 (D-13's actual `<a href>` markup change on the five/two cells) can now apply the `.pr-table__cell-link` class with confidence that the PR tables render with no visible appearance change and that a future edit to either the bare `a` rule or this class will fail the test suite rather than silently regressing.

---
*Phase: 20-row-click-interaction-pattern*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `src/dashboard/styles.css`
- FOUND: `src/dashboard/styles.test.ts`
- FOUND: `.planning/phases/20-row-click-interaction-pattern/20-16-SUMMARY.md`
- FOUND: commit `3026b33` (Task 1)
- FOUND: commit `106d88a` (Task 2)
