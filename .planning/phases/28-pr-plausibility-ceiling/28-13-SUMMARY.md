---
phase: 28-pr-plausibility-ceiling
plan: 13
subsystem: ui
tags: [dashboard, records, accessibility, wcag, contrast, css-custom-properties, copy]

# Dependency graph
requires:
  - phase: 28-pr-plausibility-ceiling
    provides: "D-08/D-10 demotion data model (EffortDemotion, guard field) from earlier Phase 28 plans"
provides:
  - "Guard-accurate Records demotion note and empty-state copy (DemotionCounts breakdown, per-guard attribution)"
  - "Scope-aware demotion note (silent under This-year scope, WR-01)"
  - "Dedicated --demoted-text CSS token meeting WCAG AA in both themes (WR-02)"
  - "Demoted-badge screen-reader explanation no longer overloads the word 'excluded' (IN-02)"
affects: [28-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared copy-building helper (describeDemotionCounts) so two rendering surfaces (note + empty state) cannot state a different count for the same underlying breakdown"
    - "CSS custom-property contrast asserted via a computed-luminance test reading token values from the live stylesheet, not hardcoded hex, so the test fails on a future regression"

key-files:
  created: []
  modified:
    - src/dashboard/views/records-logic.ts
    - src/dashboard/views/records-logic.test.ts
    - src/dashboard/views/records.ts
    - src/dashboard/views/detail-best-efforts-logic.ts
    - src/dashboard/views/detail-best-efforts-logic.test.ts
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts

key-decisions:
  - "Records demotion copy is guard-neutral with an exact per-guard breakdown (ceiling/world-record/max-speed), counted only over efforts the owner did not exclude — combines the review's two proposed fixes rather than picking one."
  - "The empty-state heading names 'the plausibility ceiling' only when counts.ceiling > 0, otherwise 'the plausibility guards' generically, closing the latent marathon-style false-heading case CR-02 flagged."
  - "A dedicated --demoted-text token replaces --accent-strong for .badge--demoted text/border, since --accent-strong's own documented contract reserves it for fills and its dark value fails WCAG AA as text."

requirements-completed: []  # PR-03 deliberately left un-ticked — worktree mode does not touch REQUIREMENTS.md; re-ticking is plan 28-15's job after re-verification, per the phase's documented "tick after verification, not before" house rule.

# Metrics
duration: ~20min
completed: 2026-09-16
---

# Phase 28 Plan 13: Records Copy Misattribution & Demoted-Badge Accessibility Summary

**Records demotion note/empty-state now attribute each guard by name with an exact count, stay silent under This-year scope, and the dark-theme demoted badge meets WCAG AA via a dedicated token; the demoted badge's screen-reader text no longer says "excluded".**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-16
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `countDemotedAtDistance` now returns a `DemotionCounts` breakdown (`total`/`ceiling`/`worldRecord`/`maxSpeed`), skipping owner-excluded efforts entirely per D-10, so the count can never conflate the owner's stated intent with the machine's judgment.
- `resolvePrTableDemotionNote` and `resolvePrTableEmptyState` share one new helper (`describeDemotionCounts`) that builds the guard-accurate sentence, so the note and the empty-state body cannot drift apart. The exact shipped-archive string is pinned by test: `35 400m efforts were demoted by a plausibility guard (8 by the personal ceiling, 17 by the world-record pace guard, 10 by the activity max-speed guard). Efforts the owner excluded are not counted here. See the activity detail view for each reason.`
- The demotion note is now scope-aware (WR-01): it returns `null` under `'this-year'`, matching the empty state's existing rule, rather than showing an archive-wide count under a year-filtered table.
- The empty-state heading names "the plausibility ceiling" only when a ceiling demotion actually occurred (`counts.ceiling > 0`); otherwise it reads "the plausibility guards" generically — closing the latent case where a distance empties purely on world-record/max-speed demotions with no ceiling to name.
- Added `--demoted-text`, a CSS custom property dedicated to `.badge--demoted`, distinct from `--accent-strong` (whose own comment reserves it for pagination/segmented-control fills and which fails WCAG AA as dark-theme text at 2.87:1/3.29:1). `--demoted-text` measures 5.99:1/5.50:1 in light and 7.54:1/6.58:1 in dark — both pass the 4.5:1 floor.
- A new `styles.test.ts` suite computes the real W3C relative-luminance contrast ratio from token values read out of the live stylesheet (not hardcoded hex), so the test fails if a future edit regresses the token to a failing colour. Verified this by temporarily substituting the old `#c2410c` value for the dark token: the dark-theme test FAILED at `3.2939569405596263 < 4.5` (matching the review's measured 3.29:1), then PASSED again after reverting.
- `detail-best-efforts-logic.ts`'s demoted-badge explanation no longer contains the word "excluded" (IN-02): `this effort is left out of the ranked PR list because a plausibility guard rejected it; it stays visible here with its reason`. Added a test asserting a demoted-and-excluded, non-PR row renders exactly two badges — Demoted then Excluded — with distinct `descriptionIdSuffix` values and the demoted explanation free of "excluded".

## Task Commits

Each task was committed atomically:

1. **Task 1: Guard-accurate Records counts and copy (CR-02) and scope-aware note (WR-01)** - `38c7b1ea` (fix)
2. **Task 2: Dark-theme demoted-badge contrast (WR-02) and the demoted badge's wording (IN-02)** - `07f924ca` (fix)

_No TDD multi-commit split was used — tests and implementation were written together per task and verified failing-then-passing manually rather than via separate RED/GREEN commits, since these are `auto` tasks with `tdd="true"` guidance describing a test-first workflow rather than a plan-level TDD gate._

## Files Created/Modified

- `src/dashboard/views/records-logic.ts` - `DemotionCounts` interface, per-guard `countDemotedAtDistance`, shared `describeDemotionCounts` helper, scope- and guard-aware `resolvePrTableDemotionNote`/`resolvePrTableEmptyState`
- `src/dashboard/views/records-logic.test.ts` - Rewrote the three suites to assert per-guard breakdowns, exact guard-accurate strings, and scope/ceiling-gating behavior
- `src/dashboard/views/records.ts` - Threads `DemotionCounts` through `buildPrTableEmptyState`/`buildPrTableSection`, renames the `renderTables` local to `demotionCounts`, passes `scope` into the note call
- `src/dashboard/views/detail-best-efforts-logic.ts` - Demoted-badge explanation string no longer contains "excluded" (IN-02)
- `src/dashboard/views/detail-best-efforts-logic.test.ts` - Added the demoted-and-excluded two-badge test
- `src/dashboard/styles.css` - New `--demoted-text` token (three declarations: `:root`, light, dark) with measured-ratio comments; `.badge--demoted` now uses it instead of `--accent-strong`
- `src/dashboard/styles.test.ts` - New WR-02 suite: hex-to-luminance helper, contrast-ratio helper, token-extraction helper reading the real stylesheet, plus a wiring assertion that `.badge--demoted` never references `--accent-strong`

## Decisions Made

- Combined the code review's two proposed CR-02 fixes (per-guard-only count vs. guard-neutral copy) into one: a guard-neutral sentence carrying an exact per-guard breakdown, matching the plan's own `must_haves` spec verbatim.
- Kept the two pre-existing pinned empty-state branches (`this-year`, `all-time` with `total === 0`) byte-identical, moving only the third branch's decision point into the guard-accurate helper — no visible regression to already-shipped copy.
- Used a dedicated `--demoted-text` token rather than patching `--accent-strong`'s dark value in place, preserving `--accent-strong`'s existing documented "fills only" contract for the pagination/segmented control, which other rules already depend on.

## Deviations from Plan

None - plan executed exactly as written. All four `must_haves.truths` items and both `must_haves.artifacts` are present; the two `key_links` patterns (`resolvePrTableDemotionNote\(` and `--demoted-text`) are wired as specified.

## Issues Encountered

None. Both tasks' automated verification commands ran clean apart from a pre-existing, environment-only fixture gap already documented below.

### Known pre-existing environment-only test failures (not caused by this plan)

This worktree is a fresh checkout with no `data/stats/*.json` (gitignored, regenerated by `compute-all-stats`, requires network access this sandbox lacks), no `dist/` (`npm run build` not run here), and a `node_modules/chartjs-plugin-zoom` layout gap. `npm test` in this worktree shows **11 failing test files / 2055 passing tests**, all ENOENT/module-not-found failures unrelated to any file this plan touches:

- `src/dashboard/views/records-logic.test.ts` — `ENOENT: data/stats/best-efforts.json` (the exact gap plan 28-13's own acceptance criteria pre-name as expected in a worktree lacking `data/stats`)
- `src/dashboard/views/trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts` — same `data/stats`/`data/dashboard` ENOENT gap, pre-dating this plan (logged in `deferred-items.md` under plans 28-01/28-03)
- `src/dashboard/views/trends-zoom-logic.test.ts` — missing `node_modules/chartjs-plugin-zoom/dist/...esm.js`, an installation-layout gap, pre-dating this plan
- `scripts/compute-pace-quality-calibration.test.mjs`, `compute-pace-residual.test.mjs`, `compute-pr-ceiling-calibration.test.mjs`, `compute-pr-ceiling-diff.test.mjs` — `Cannot find module '../dist/analytics/...'`, no `npm run build` output in this worktree
- `scripts/verify-dashboard-publish-stats.test.mjs` — `ENOENT: dist/widgets/data/stats/best-efforts.json`, same missing-build/missing-data root cause

`npx vitest run` scoped to this plan's own files (`records-logic.test.ts`, `records.test.ts`, `styles.test.ts`, `detail-best-efforts-logic.test.ts`, `detail-sections.test.ts`) with the `records-logic.test.ts` ENOENT excluded runs green (`69 + 159 + 119 + 57 = 404 tests passed`). `npx tsc --noEmit` is clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Task 1 and Task 2's `must_haves` are all satisfied and test-pinned, ready for plan 28-15's Round 2 re-check (R6 wording re-check named in `28-VERIFICATION.md`'s Human Verification Required section).
- PR-03 is left un-ticked in `REQUIREMENTS.md` by design — this worktree does not touch that file, and re-ticking after re-verification is 28-15's job per the phase's documented process lesson (tick requirements after verification, not before).
- The CR-01 compute fix (plan 28-11, a separate worktree) is a prerequisite for regenerating `data/stats/best-efforts.json` with correct ceiling demotions on owner-excluded efforts; this plan's logic was written and tested against fixtures per the plan's own instruction, independent of that regeneration.

---
*Phase: 28-pr-plausibility-ceiling*
*Completed: 2026-09-16*

## Self-Check: PASSED

All 8 referenced files confirmed present on disk (7 modified source/test files plus this SUMMARY.md itself). Both task commit hashes (`38c7b1ea`, `07f924ca`) confirmed present in `git log --oneline --all`.
