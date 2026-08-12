---
phase: 18-records-trends-differentiators
plan: 12
subsystem: ui
tags: [records-page, chart.js, riegel, vanilla-ts, dom-assembly, lazy-chunk]

# Dependency graph
requires:
  - phase: 18-records-trends-differentiators
    plan: 04
    provides: chart-theme.ts (resolveToken), list.ts's formatEffortDuration/appendBadge/appendLowConfidenceBadge, every Phase 18 CSS class
  - phase: 18-records-trends-differentiators
    plan: 09
    provides: records-logic.ts's DOM-free transforms and riegel.ts's prediction/fit functions
provides:
  - src/dashboard/views/records.ts — createRecordsView, the real #/records page
  - src/dashboard/views/records-charts.ts — mountEvolutionCharts, the lazy Chart.js chunk boundary for the evolution grid
affects: [18-16 (manual checkpoint covers canvas rendering, sticky offset, hash-router safety)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "records-charts.ts mirrors detail.ts's D-25 lazy-module type-alias pattern (typeof import(...)) so records.ts derives EvolutionChartCard/EvolutionChartsHandle from the lazy module's own function signature instead of duplicating a parallel interface"
    - "Two-line superlative tile (value + category label + optional context sub-label) reuses .text-display/.text-label twice rather than inventing new CSS — zero new classes"

key-files:
  created:
    - src/dashboard/views/records.ts
    - src/dashboard/views/records-charts.ts
  modified:
    - src/dashboard/view-registry.ts
    - src/dashboard/view.types.ts
    - src/dashboard/view-registry.test.ts
  deleted:
    - src/dashboard/views/records.stub.ts

key-decisions:
  - "Tasks 1-3 were authored and committed as records.ts (Task 1's commit) + records-charts.ts (Task 2's commit), rather than three separate diffs against records.ts. The jump list built in Task 1 needs all four section headings (including PR Evolution and Race Predictions) to exist before it can wire scrollIntoView+focus targets, and all three tasks share DISTANCE_LABELS/DISTANCE_SLUGS — splitting into three partially-working intermediate commits would have required either broken intermediate states or artificial stub sections with no verification value. Task 3's acceptance criteria (exact copy strings, the live Riegel branch, no canvas references) were verified independently against the code that landed in Task 1's commit."
  - "Superlative tiles use a locally-built two-line-label tile (value + category label + optional context sub-label) instead of overview.ts's single-label buildStatCard, so each tile still names its own category (Biggest Week/Month/etc.) alongside the UI-SPEC's requested context text (\"week of {date}\", the streak's active/ended state) — zero new CSS, since it only reuses .text-display/.text-label."
  - "Each top-level section (#records-superlatives, #records-pr-tables, #records-pr-evolution, #records-predictions) gets its own <h2 tabindex=\"-1\"> as the FIRST child, serving both as the jump list's scroll+focus target and, for PR Tables, as the heading the combined config-notice sits directly under."

patterns-established:
  - "records-charts.ts's EvolutionChartCard/EvolutionChartsHandle types are derived via Parameters<>/ReturnType<> off the lazy module's typeof import(...) alias rather than a duplicated interface — one source of truth for the mount function's shape."

requirements-completed: [REC-02, REC-03, REC-05, REC-06, REC-07]

# Metrics
duration: ~90min
completed: 2026-08-11
---

# Phase 18 Plan 12: Records Page — DOM Assembly, PR Tables, Evolution Charts & Race Predictions Summary

**Replaced the Phase 16 `#/records` stub with a real page — sticky jump list, four superlative tiles, seven PR tables with age-grade/honesty badges, a seven-card independently-scaled PR-evolution grid behind a lazy Chart.js chunk, and a Race Predictions section whose fitted-exponent table self-suppresses (or, against the live archive today, renders with b=1.194 from 6 rank-1 PRs across 4 distinct activities).**

## Performance

- **Duration:** ~90 min (including regenerating `data/stats/*.json` and `data/dashboard/index.json` locally, since the worktree started without them)
- **Tasks:** 3 (delivered as 2 commits — see Deviations)
- **Files modified:** 6 (2 created, 3 modified, 1 deleted)

## Accomplishments

- `#/records` now renders real content: `data/stats/best-efforts.json` is the only required fetch (renders the exact three-part error state on failure); age-grading/weekly-distance/monthly-stats/streaks/exclusions each degrade to `null` independently, so a missing optional file narrows only its own section.
- The sticky jump list's offset is computed from the live `.app-nav` element's `getBoundingClientRect().height` (never hardcoded), recomputed on resize, removed in `unmount()`. All four jump buttons are real `<button>` elements calling `scrollIntoView` + `.focus()` — zero `href="#..."` anchors anywhere in the file (confirmed via `grep -c 'href="#'` returning `0` after fixing one self-referential comment).
- Seven PR tables render Rank/Time/Pace/Age-Grade/Date/Activity/Flags in that exact order, `formatEffortDuration` (not `formatDurationHms`) for Time, one combined `.config-notice` under the PR Tables heading (not one per table), the marathon named empty state, and the 1k interpolation footnote.
- The seven-card evolution grid mounts its Chart.js instances lazily via `await import('./records-charts.js')`; each of the seven charts is fully independent (own y-range, own x-range, no shared domain), `stepped: 'after'`, `reverse: true`, tick callbacks use `formatEffortDuration`/year-only — never a `TimeScale`.
- Race Predictions renders the standard Riegel matrix (marathon column only, never a row) plus the fitted-exponent table naming its distances and the rank-1-PR subset — verified against the live archive below.
- `STUB_PHASE` no longer lists `ROUTES.RECORDS` (mirrors the 17-10 calendar precedent); the pre-existing `view-registry.test.ts` assertion that checked the opposite was updated in the same commit as the removal (Rule 1 — a test that would otherwise regress from this task's own change).

## Live-data verification (required by Task 3's acceptance criteria)

Ran against the freshly regenerated `data/stats/best-efforts.json` (1843 activities considered, 8811 efforts computed):

- `selectFitPoints(rankings)` → 6 points across `400m, 1k, 1mi, 5k, 10k, half` (marathon excluded, no ranking).
- `fitRiegelExponent(points)` → **non-null**: `b = 1.1935142631296778` (renders as `1.194`), `distinctActivities = 4`.
- **Branch observed: the fitted table renders** (not the suppression copy) — matches 18-09-SUMMARY's recorded live fit exactly (same `b`, same 4 distinct activities).
- `buildEvolutionSeries` step counts per distance: `400m 11, 1k 11, 1mi 14, 5k 21, 10k 16, half 6, marathon 0` — 79 total, matching 18-09-SUMMARY's predicted range.
- `data/stats/age-grading.json` regenerated with `enabled: false` and the exact `disabledReason` string the plan's fallback copy also uses — the Records page's config-notice was exercised against this real disabled state, not a fixture.

## Build output verification (Task 2's async-chunk requirement)

- `npm run build-widgets` output: `records-charts-Qwx2lxF3.js` (971 bytes) is a separate async chunk. Chart.js core itself lands in a chunk shared with `detail-charts.ts` — `chart-theme-ByRKr5LH.js` (152KB, contains the Chart.js banner string) — because both lazy consumers import `chart-theme.ts`; Vite grouped the shared dependency into one async chunk rather than duplicating Chart.js per consumer.
- Confirmed `index-DhQwDrsm.js` (the main entry, 77KB) contains **zero** occurrences of the Chart.js banner string — Chart.js never enters the eagerly-loaded bundle.

## Task Commits

1. **Task 1 + Task 3 (combined — see Deviations): Page shell, data fetch, sticky jump list, superlatives, seven PR tables, and Race Predictions** - `d85e88a` (feat)
2. **Task 2: The seven-card PR-evolution grid and its stepped charts** - `405f18a` (feat)

_No plan-metadata commit yet — this is a worktree-mode executor; the orchestrator makes the final metadata commit after merge. Per plan instructions, STATE.md/ROADMAP.md are NOT touched by this executor._

## Files Created/Modified

- `src/dashboard/views/records.ts` - New: `createRecordsView`, the full `#/records` page (error state, jump list, superlatives, seven PR tables, evolution grid wiring, Race Predictions)
- `src/dashboard/views/records-charts.ts` - New: `mountEvolutionCharts`, the lazy Chart.js chunk boundary for the seven evolution charts
- `src/dashboard/view-registry.ts` - Swapped `recordsView` (stub) for `createRecordsView({ indexClient })`
- `src/dashboard/view.types.ts` - Removed the `ROUTES.RECORDS` entry from `STUB_PHASE` (TRENDS remains, per 17-10 precedent)
- `src/dashboard/view-registry.test.ts` - Updated the `STUB_PHASE` regression-guard test to assert `ROUTES.RECORDS` is now `undefined` (was asserting the opposite before this plan)
- `src/dashboard/views/records.stub.ts` - Deleted

## Decisions Made

- **Combined Task 1/3 commit, separate Task 2 commit.** See key-decisions above — the jump list (Task 1) structurally needs all four section headings, including the ones Task 2/3 fill, so the file was authored as one cohesive unit. Task 3's specific acceptance criteria (exact copy strings, `grep -c "canvas"` isolation, the live Riegel branch) were all independently re-verified against the committed code.
- **Two-line superlative tiles**, not `overview.ts`'s single-label `buildStatCard` shape — see key-decisions above.
- **Section-level `<h2 tabindex="-1">` as first child of each of the four top-level sections** — doubles as both the jump target and, for PR Tables, the heading the combined config-notice sits directly under, satisfying both requirements with one element rather than two.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded three records.ts/records-charts.ts comments to avoid tripping their own acceptance-criteria greps**
- **Found during:** Task 1 and Task 2 verification
- **Issue:** Mirrors the identical class of defect already documented in 18-04-SUMMARY.md and 18-09-SUMMARY.md. `records.ts`'s own explanatory comment about the hash-router landmine quoted the literal `` href="#..." `` string, tripping `grep -c 'href="#'` to `1` instead of `0`. `records-charts.ts`'s registration comment named `Filler`/`Decimation` by name while explaining they're intentionally NOT registered, tripping `grep -c "Filler\|Decimation"` to `1` instead of `0`.
- **Fix:** Reworded both comments to convey the same constraint without repeating the exact literal substrings the greps check for (matches the established fix pattern from 18-04/18-09).
- **Files modified:** `src/dashboard/views/records.ts`, `src/dashboard/views/records-charts.ts`
- **Verification:** Re-ran both grep checks after each edit; both now return the exact value the plan's acceptance criteria specify. `npm run build` re-run clean afterward.
- **Committed in:** `d85e88a` (records.ts fix), `405f18a` (records-charts.ts fix) — both fixes were made before their task's commit, no separate follow-up commit.

**2. [Rule 1 - Bug] Updated `view-registry.test.ts`'s pre-existing `STUB_PHASE` regression test**
- **Found during:** Task 1, after removing `STUB_PHASE[ROUTES.RECORDS]`
- **Issue:** The plan's own required change (removing the `ROUTES.RECORDS` entry from `STUB_PHASE`) directly breaks a pre-existing assertion in `view-registry.test.ts` that expected `STUB_PHASE[ROUTES.RECORDS]` to be defined (a Phase 17 regression guard against a silent stub-revert).
- **Fix:** Updated the assertion to expect `STUB_PHASE[ROUTES.RECORDS]` to be `undefined` now (mirroring how the same test already handles `ROUTES.CALENDAR` since Phase 17's calendar shipped), keeping the regression-guard intent intact for the one route (`TRENDS`) still genuinely stubbed.
- **Files modified:** `src/dashboard/view-registry.test.ts`
- **Verification:** `npm test` — all 838 tests pass, including the updated assertion.
- **Committed in:** `d85e88a`

### Notes on an unmeetable acceptance-criteria grep count

Task 1's acceptance criteria state `grep -c "ROUTES.RECORDS" src/dashboard/view.types.ts` should return `1` ("the ROUTES/NAV_ORDER entries remain, but the STUB_PHASE entry is gone"). In the live file, `ROUTES.RECORDS` legitimately appears **twice** even after removing the `STUB_PHASE` entry — once in `ALL_ROUTES` and once in `NAV_ORDER` — both of which the same acceptance text explicitly requires to remain. The original (pre-plan) file had 3 occurrences (`ALL_ROUTES` + `NAV_ORDER` + `STUB_PHASE`); removing only the `STUB_PHASE` entry correctly reduces that to 2, not 1. This reads as a miscount in the plan's own stated grep expectation rather than a defect in the implementation — the criterion's own reasoning ("the ROUTES/NAV_ORDER entries remain") requires 2 occurrences, and the load-bearing invariant (no `STUB_PHASE` entry) is independently confirmed via the criterion's own follow-up instruction to "verify by inspecting the `STUB_PHASE` object directly," which the updated `view-registry.test.ts` assertion now does permanently.

---

**Total deviations:** 2 auto-fixed (2 Rule-1 bug-class fixes), 1 documented acceptance-criteria discrepancy (no code change, count is structurally correct at 2)
**Impact on plan:** No functional or behavioral change from the two comment-wording fixes; the test update is a required, in-scope consequence of the plan's own `STUB_PHASE` change. No scope creep.

## Issues Encountered

- The worktree started without `data/stats/*.json` or `data/dashboard/index.json` (both gitignored). Regenerated via `npm run build` + `npm run compute-all-stats` (best-efforts, weekly/monthly/streaks/totals) + direct invocation of the compiled `compute-age-grading`/`compute-dashboard-index`/`compute-gear-aggregate`/`compute-training-load` modules, per the derived-data note in this plan's own briefing (the last two were needed only to unblock two pre-existing, unrelated test suites — `trends-gear-logic.test.ts` and `trends-training-load-logic.test.ts` — that read those files directly; neither is part of this plan's scope). `data/geo/geo-metadata.json`'s `generatedAt` timestamp was incidentally touched by `compute-all-stats` and reverted with `git checkout -- data/geo/geo-metadata.json` before committing (same out-of-scope side effect already documented in 18-09-SUMMARY.md).
- No other issues. `npm run build`, `npm run build-widgets`, `npm run verify-dashboard` (25/25), and `npm test` (838/838) all pass on the final state of this plan.

## User Setup Required

None — no external service configuration required. The manual-only verifications this plan explicitly defers (canvas rendering, the sticky-offset breakpoint crossing, the hash-router safety of the jump list, both themes) are covered by plan 18-16's checkpoint, as stated in this plan's own `<verification>` section.

## Next Phase Readiness

- `#/records` is fully wired and registered; `STUB_PHASE` now lists only `ROUTES.TRENDS` (plan 18-14 removes that final entry).
- `records-charts.ts` establishes the second precedent (after `detail-charts.ts`) for a Chart.js lazy-chunk boundary in this codebase — `trends-charts.ts` (a later plan) can follow the identical `typeof import(...)` type-alias pattern.
- No blockers identified for downstream Phase 18 plans.

---
*Phase: 18-records-trends-differentiators*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 3 claimed created files verified present on disk (`src/dashboard/views/records.ts`, `src/dashboard/views/records-charts.ts`, this SUMMARY.md); `src/dashboard/views/records.stub.ts` confirmed absent. Both commits (`d85e88a`, `405f18a`) confirmed present in `git log --oneline --all`.
