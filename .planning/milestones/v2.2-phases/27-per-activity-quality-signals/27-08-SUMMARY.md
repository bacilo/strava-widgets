---
phase: 27-per-activity-quality-signals
plan: 08
subsystem: ui
tags: [typescript, vitest, dashboard, filters, url-state, quality-signals]

requires:
  - phase: 27-per-activity-quality-signals
    provides: "27-04's required row.quality field (ActivityQualitySignals, anySevere) on every published DashboardIndexRow; 27-07's badge dispatch shape (composed with, not touched)"
provides:
  - "FilterState.anySevere — this file's first boolean filter field, its URL param (severe=1), its filterRows AND-chain predicate, and its 'quality' chip"
  - "The filter-panel checkbox (buildQualityField), wired through the existing chip/count/clear machinery with no new field enumeration"
affects: [27-10]

tech-stack:
  added: []
  patterns:
    - "First boolean FilterState field: presence-with-value-'1' URL encoding (not bare presence) — established as the idiom for the next boolean filter field"
    - "Filter predicate reads the shipped row.quality.anySevere flag via a local rowIsAnySevere helper (optional chaining + explicit === true) rather than re-deriving it from the row's own tiers, so the filter and the recount script share one datum"

key-files:
  created: []
  modified:
    - src/dashboard/views/list-logic.ts
    - src/dashboard/views/list-logic.test.ts
    - src/dashboard/views/list.ts
    - src/dashboard/views/list.test.ts

key-decisions:
  - "URL param encoding: severe=1 (presence-with-value-'1'), not bare `?severe` presence — so a stray `?severe` or `?severe=0`/`?severe=true` reads as off rather than on (T-27-26), pinned by four explicit parse-direction tests."
  - "The predicate reads row.quality?.anySevere === true, the row's shipped, CI-classified flag, rather than calling hasAnySevereSignal on the row's own tiers — this is the SAME datum compute-pace-quality-recount.mjs cross-checks (T-27-27), and optional chaining + explicit === true guards the ParsedDashboardIndexRow re-parse shape where no key is guaranteed present (T-27-28, the CR-02 undefined-vs-null defect class)."
  - "The checkbox carries BOTH a wrapping <label> with visible text and an aria-label on the input itself (belt-and-suspenders) rather than choosing one — the plan allowed either; both cost nothing extra and the wrapping label also grows the click target."
  - "No new CSS: the existing input[type=\"checkbox\"] rule in styles.css already styles it; confirmed via an empty git diff on that file."

requirements-completed: [QUAL-03]

duration: ~20min
completed: 2026-09-10
---

# Phase 27 Plan 08: Filter by Severe Quality Signal Summary

**Shipped D-16's single "has any severe signal" filter toggle end to end through `list-logic.ts`'s existing `FilterState`/URL/`filterRows`/chip machinery and one checkbox in `list.ts`'s filter panel — verified against the live 1,890-row archive to return exactly 299 rows, matching the independently-counted flag.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 4 (`list-logic.ts`, `list-logic.test.ts`, `list.ts`, `list.test.ts`)

## Accomplishments

- `FilterState.anySevere: boolean` — this module's first boolean filter field (every other field is `string | number | null`) — with `EMPTY_FILTERS.anySevere: false`, documented inline with D-16's intent and the not-computable exclusion (a stream-less activity is never `severe`, so the toggle filters it out along with every clean row).
- URL param `severe`, parsed as strict `=== '1'` and serialized only when `true` (omit-when-default discipline preserved) — pinned in all four directions: `?severe=1` → true, `?severe=0` → false, `?severe` (no value) → false, `?severe=true` → false.
- `filterRows` gained one more AND-chain member reading `row.quality?.anySevere === true` via a local `rowIsAnySevere` helper — the row's shipped, CI-classified flag, not a second three-tier evaluation in the browser, so the filter and `compute-pace-quality-recount.mjs` are provably looking at the same datum.
- `'quality'` added to `FilterChipKey`, its chip (`severe signals only`), and its `removeChip` case; `activeFilterCount` needed no change (already `buildFilterChips(filters).length`).
- `buildQualityField` in `list.ts` follows `buildDurationField`'s shape (a `div.filter-field`, a `text-label` legend, one control) with a checkbox wired to `change` → `applyImmediate` with `page` reset to 1; appended in `buildFilterPanel` immediately after `buildDurationField`. No other field builder, the chip row, the chip-removal handler, the clear-all handler, or the filter-button count needed any change — all four already route through `buildFilterChips`/`removeChip`/`activeFilterCount`/`EMPTY_FILTERS`.
- `SortKey`, `SORT_KEYS`, `DEFAULT_DIR`, and `PAGE_SIZE` are byte-identical before/after (confirmed via `git diff`) — D-15's no-new-sort-key rule holds.
- `composeRowAriaLabel(` still occurs exactly twice in `list.ts`'s stripped source — this plan does not touch the aria-label fold, and a standing test now asserts the invariant from this file's side too (parallel plan 27-09 owns `detail.ts`/`detail-sections.ts`, untouched here).
- 21 new tests: 12 in `list-logic.test.ts`'s `severe filter` describe block (round trip both directions, all four URL-parse cases, filter-keeps/drops/absent-quality with an independently-derived expected-id list, filter-off-is-a-no-op, AND-composition with an active distance filter, chip presence/absence, `removeChip` field-by-field, and a `SORT_KEYS`/`DEFAULT_DIR` regression guard), 5 in `list.test.ts`'s `severe filter wiring` describe block (pure chip/count/clear assertions plus source-text checks that `buildFilterPanel` calls `buildQualityField` after `buildDurationField`, that the checkbox wires `change` not `input`/`keydown`, that `buildQualityField(` occurs exactly twice, and that `composeRowAriaLabel(` still occurs exactly twice).

## Task Commits

Each task was committed atomically:

1. **Task 1: FilterState.anySevere — field, URL param, predicate, chip** - `2cbc051e` (feat)
2. **Task 2: The filter-panel checkbox** - `f16183d9` (feat)

_Note: no plan-metadata commit yet in this worktree — orchestrator handles the final merge-time docs commit across all wave worktrees._

## Files Created/Modified

- `src/dashboard/views/list-logic.ts` — `FilterState.anySevere`, `EMPTY_FILTERS.anySevere`, `parseListQuery`/`serializeListQuery`'s `severe` param, `rowIsAnySevere` helper, `filterRows`'s new AND-chain member, `'quality'` in `FilterChipKey`, its chip in `buildFilterChips`, its case in `removeChip`.
- `src/dashboard/views/list-logic.test.ts` — `severe filter (D-16) — FilterState.anySevere` describe block (12 tests); `SORT_KEYS` added to the existing import list for the regression-guard test.
- `src/dashboard/views/list.ts` — `buildQualityField` (new), one `panel.appendChild(buildQualityField(...))` line in `buildFilterPanel`. No other function in this file changed (confirmed: `git diff` shows only additions, zero removed lines).
- `src/dashboard/views/list.test.ts` — `severe filter wiring (27-08, D-16)` describe block (5 tests); import of `buildFilterChips`/`removeChip`/`activeFilterCount`/`EMPTY_FILTERS` from `./list-logic.js` added.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`npm run test` (full suite): 10 failed FILES, 4 failed individual tests, 1863 passed, 17 skipped. All 10 failing files are the same pre-existing worktree-provisioning artifacts already documented by plans 27-01/27-04/27-07 in `deferred-items.md` — this worktree's dependency install and CI compute pipeline never ran, so several gitignored `data/stats/*.json` files and `dist/widgets/data/dashboard/index.json` don't exist locally (`scripts/compute-pace-quality-calibration.test.mjs`, `scripts/compute-pace-residual.test.mjs`, `scripts/verify-dashboard-publish-stats.test.mjs`, `scripts/verify-dashboard-publish-guard.test.mjs`, `src/dashboard/views/{records,trends-cadence-hr,trends-gear,trends-training-load,trends-yoy,trends-zoom}-logic.test.ts`). None of these files are touched by this plan, and neither `list.ts`/`list-logic.ts`/their test files appear in the failure list. Not added to `deferred-items.md` again per the prior sessions' instruction not to duplicate the same documented cause.

This plan's own verification targets are fully green:
```
npx tsc --noEmit                                                                  # 0 errors
npx vitest run src/dashboard/views/list-logic.test.ts -t "severe filter"         # 12/12 passed
npx vitest run src/dashboard/views/list.test.ts src/dashboard/views/list-logic.test.ts
                                                                                   # 164/164 passed
npm run build-widgets                                                            # exit 0, 0 css-syntax-error
git diff src/dashboard/styles.css                                                # empty
```

**Acceptance-criterion note (per this phase's own precedent from 27-02/27-03/27-06):** Task 2's acceptance criterion `npm run test` (full suite) exits 0 is not literally satisfiable in this worktree — the 10 failures are all reachability-in-both-directions artifacts of missing gitignored derived data, not a defect this plan introduced or could fix without running the full compute pipeline (dozens of unrelated files, outside this plan's scope and the deviation rules' auto-fix boundary). Reported here with scoped evidence rather than working around it.

## Live Archive Verification

Run against the live, staged `data/dashboard/index.json` in the MAIN checkout (read-only from this worktree, per the parallel-execution note):

```
total rows: 1890
independently counted anySevere (rows.filter(r => r.quality?.anySevere === true).length): 299
filterRows(rows, { ...EMPTY_FILTERS, anySevere: true }).length: 299
match: true
```

299/1890 matches `27-04-SUMMARY.md`'s own independently-recomputed `totals.qualityAnySevere` (299) and the verification context's stated expected count for plan 27-10's checkpoint to cross-check against `27-CALIBRATION.md` section 4 and the recount script's output.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The calibrated 299-activity composite is now directly reachable in the browser via one checkbox: `?severe=1` (or the filter panel toggle) narrows the 1,890-row list to exactly the cohort `27-CALIBRATION.md` and `compute-pace-quality-recount.mjs` both measure. Plan 27-10's checkpoint can count the filtered rows on screen against both other independently-produced figures without scrolling the full archive. No blockers for 27-10.

---
*Phase: 27-per-activity-quality-signals*
*Completed: 2026-09-10*

## Self-Check: PASSED
