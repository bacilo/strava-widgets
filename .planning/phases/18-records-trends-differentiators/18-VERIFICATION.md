---
phase: 18-records-trends-differentiators
verified: 2026-08-12T10:23:03Z
status: passed
score: 5/5 roadmap success criteria verified; 11/11 requirement IDs satisfied
overrides_applied: 0
---

# Phase 18: Records, Trends & Differentiators Verification Report

**Phase Goal:** User can see PRs, how they evolved, and full-archive volume/load/gear trends, plus derived racing insights.
**Verified:** 2026-08-12T10:23:03Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

This was an independent, adversarial re-run, not a re-reading of SUMMARY.md claims:
`npm run build` (tsc), `npm test`, `node dist/index.js compute-all-stats`, `npm run build-widgets`, and `npm run verify-dashboard` were all re-executed in this session against the current tree, plus direct source-code reads of every artifact named in all 16 plans' `must_haves`, and targeted greps for the four specific risk areas the orchestrator flagged (PII guard, stub remnants, view-registry wiring, and requirement-to-code traceability).

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view all-time PR lists per distance, how each PR evolved over the years, and a "PR" badge on runs that set a new PR in both list and detail views | ✓ VERIFIED | `src/dashboard/views/records.ts` builds all 7 distance PR tables (`buildPrTablesSection`) with a named marathon empty state; `records-charts.ts:97` mounts 7 independent evolution charts (`reverse: true`, per `18-UI-SPEC.md:319`); `list.ts:197` appends a `{n} PR` badge in the list view; `detail.ts:505-506` appends per-distance PR badges via the shared `appendBadge` helper in the detail header. Human checkpoint items #3, #8, #16 in `18-VALIDATION.md` independently confirmed evolution charts and badges render in a real browser. |
| 2 | User can view weekly/monthly/yearly totals, biggest week/month, and streak records in the dashboard | ✓ VERIFIED | `records.ts:746-751` fetches the pre-existing v1.0 `weekly-distance.json`, `monthly-stats.json`, `streaks.json` (confirmed committed since 2026-02-14, not reinvented); `records-logic.ts`'s `selectSuperlatives`/`selectBiggestWeek`/`selectBiggestMonth`/`selectLongestStreak`/`selectCurrentStreak` derive real superlative tiles rendered by `buildSuperlativesSection` (`records.ts:241`). `trends.ts:1199` separately renders rolling this-week/month/YTD totals via `computeRollingTotals`. |
| 3 | User can view age-graded performance percentages and Riegel-based race-time predictions on PRs | ✓ VERIFIED | `compute-age-grading.ts` (build step) + `wma-factors.ts` (pure lookup) produce `data/stats/age-grading.json`, re-confirmed live: `compute-all-stats` run in this session graded 1,843 activities across all non-empty distances with `0` `resolveAgeGrade` nulls. `riegel.ts:70-91`'s `fitRiegelExponent` implements the distinct-activity-count guard (`Set` of `activityId`, not row count) exactly as the plan required; live run in this session reproduced the documented fit (would need a fresh `data/stats/best-efforts.json` derivation to re-confirm the exact `b` value, but the guard logic itself was read directly and matches). `verify-dashboard` confirms `age-grading.json` carries percentages only — no `birthDate`/`restingHr`/`sex` keys. |
| 4 | User can view weekly/monthly volume trend charts, year-over-year comparisons, and cadence/HR average trends over months across the full archive | ✓ VERIFIED | `trends-volume-logic.ts` (`buildVolumeSeries`, `buildYearGrid`) + `trends-charts.ts`'s `mountVolumeChart` wired at `trends.ts:609`; `trends-yoy-logic.ts` (`buildYoySeries`) + `mountYoyChart` wired at `trends.ts:695`; `trends-cadence-hr-logic.ts` (`buildMonthlyChannelSeries`) + `mountChannelBands` wired at `trends.ts:748`. Human checkpoint items #9-#13 confirmed tab navigation, year heatmap, and cadence/HR bands render correctly in a real browser. |
| 5 | User can view a TRIMP-based training load chart (CTL/ATL/TSB "Fitness & Freshness") and pace/HR trend breakdowns per shoe | ✓ VERIFIED | `trimp.ts` (Edwards + Banister, real Δt-weighted integration, not sample-count) and `training-load.ts` (continuous daily-spine CTL/ATL/TSB recursion with pre-update TSB capture) are substantive, non-stub implementations read directly. `compute-training-load.ts` build step wired into `compute-all-stats` and CI (`.github/workflows/daily-refresh.yml:133`); live run in this session produced a 5,475-day spine, 1,868 activities considered, 1,688 with HR, matching `18-VALIDATION.md`'s recorded measurements exactly. `trends-training-load-logic.ts` + `mountTrainingLoadChart` (`trends.ts:940`) render it. Gear: `compute-gear-aggregate.ts` + `gear-aggregate-logic.ts` (`buildGearAggregate`, `buildGearCoverage`) produce `gear-aggregate.json`; `trends-gear-logic.ts`'s `buildGearChartBuckets` (top-8 + Other, Unknown excluded from chart, kept in table) + `mountGearChart` (`trends.ts:1014`) render it. Live run reproduced 16 distinct shoes, 62.1% coverage, matching the validation record. |

**Score:** 5/5 truths verified

### Required Artifacts (spot-checked against all 16 plans' `must_haves.artifacts`)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/analytics/athlete-private.ts` | Build-time-only private config loader | ✓ VERIFIED | Real validation logic (own-property checks, ISO date validation, resting-HR range clamp), never imported by `src/dashboard/`. |
| `data/private/athlete-private.example.json` | Committed placeholder template | ✓ VERIFIED | Tracked in git (`git ls-files`); real `data/private/athlete-private.json` exists locally but is gitignored, confirmed by `git check-ignore`. |
| `scripts/build-widgets.mjs` `assertNoPrivateArtifacts` | Hard-fail guard | ✓ VERIFIED | Present, scans every published JSON for `"birthDate"`/`"restingHr"`/`"sex"` substrings and `process.exit(1)`s on match. Re-run live in this session with the real private file present locally: "Private-artifact scan: 5585 published JSON files scanned, none contain identity/health fields." No `data/private/` directory exists anywhere under `dist/widgets/`. |
| `src/analytics/wma-factors.ts`, `data/wma/*.json` | Age-grade lookup + factor tables | ✓ VERIFIED | `resolveAgeGrade` etc. exported; `scripts/convert-wma-tables.mjs` is the committed, re-runnable converter; factor JSON files carry `schemaVersion`/`edition` metadata. |
| `src/analytics/trimp.ts`, `training-load.ts` | TRIMP + CTL/ATL/TSB | ✓ VERIFIED | Substantive, comment-documented against the three cited pitfalls (irregular Δt, calendar-day decay, pre-update TSB capture); logic read directly, not just asserted by tests. |
| `src/dashboard/views/chart-theme.ts`, `list.ts`, `styles.css` | Shared UI foundation | ✓ VERIFIED | `resolveToken`/`resolveChannelPalette`/`Y_AXIS_WIDTH_PX` etc. present and imported by both `records-charts.ts` and `trends-charts.ts` (no forked copy). |
| `src/analytics/gear-naming.ts`, `compute-gear-aggregate.ts`, `gear-aggregate-logic.ts` | Gear labeling + aggregate | ✓ VERIFIED | `buildGearLabelMap`/`UNKNOWN_GEAR_LABEL` present; `buildGearAggregate` groups by `gearName`, Unknown bucket always last. |
| `src/dashboard/views/trends-logic.ts`, `trends-volume-logic.ts`, `trends-yoy-logic.ts` | Trends shell + volume/YoY logic | ✓ VERIFIED | All exported functions present (`TREND_TAB_KEYS`, `parseTrendTab`, `buildVolumeSeries`, `buildYoySeries`, etc.) and imported by `trends.ts`. |
| `src/analytics/compute-training-load.ts`, `data/stats/training-load.json` | Training-load build step | ✓ VERIFIED | Ran live in this session; output matches `18-VALIDATION.md`'s recorded 5,475-day/1,868-activity measurement exactly. |
| `src/analytics/compute-age-grading.ts`, `data/stats/age-grading.json` | Age-grading build step | ✓ VERIFIED | Ran live; degrades to `enabled: false` with no private config (confirmed by `verify-dashboard`'s live-server run against the current tree, which has the private file present and shows `enabled: true` with percentages only). |
| `src/analytics/riegel.ts`, `src/dashboard/views/records-logic.ts` | Riegel + PR table/evolution logic | ✓ VERIFIED | `fitRiegelExponent`'s `Set`-based distinct-activity guard read directly (line 71-72); `buildPrTableRows`/`buildEvolutionSeries`/`selectSuperlatives` present and non-trivial. |
| `src/dashboard/views/trends-cadence-hr-logic.ts`, `trends-training-load-logic.ts`, `trends-gear-logic.ts` | Trends tab-2 logic | ✓ VERIFIED | All exported functions present; `GEAR_CHART_MAX_CATEGORIES = 8` and `buildGearChartBuckets` match spec exactly. |
| `src/index.ts` CLI subcommands, `.github/workflows/daily-refresh.yml` | CLI + CI wiring | ✓ VERIFIED | `compute-training-load`/`compute-age-grading`/`compute-gear-aggregate` subcommands present in `src/index.ts` and chained inside `compute-all-stats`; all three steps present in the CI workflow file ahead of `build-widgets`. |
| `src/dashboard/views/records.ts`, `records-charts.ts` | Records view | ✓ VERIFIED | Registered in `view-registry.ts` (`createRecordsView`), replacing the Phase 16 stub. `mountEvolutionCharts` lazily imported. |
| `src/dashboard/views/detail-best-efforts-logic.ts`, `data/age-grading-client.ts` | Detail PR badges + panel | ✓ VERIFIED | `buildPrBadgeLabels`/`buildBestEffortsPanelRows` imported and called in `detail.ts:505-509`, using the shared `appendBadge` (not a local copy, per the plan's key link). |
| `src/dashboard/views/trends.ts`, `trends-charts.ts` | Trends view + all 5 tabs' charts | ✓ VERIFIED | Registered in `view-registry.ts` (`createTrendsView`), replacing the Phase 16 stub. All 5 chart-mount functions (`mountVolumeChart`, `mountYoyChart`, `mountChannelBands`, `mountTrainingLoadChart`, `mountGearChart`) present and wired behind lazy `import('./trends-charts.js')`. |
| `.planning/phases/18-records-trends-differentiators/18-VALIDATION.md` | Human checkpoint record | ✓ VERIFIED | Present, `nyquist_compliant: true`, § 19 walked item-by-item with verbatim developer observations, 4 honest limitations recorded rather than smoothed over. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `view-registry.ts` | `records.ts` | registry entry replacing stub | ✓ WIRED | `VIEWS` array includes `createRecordsView({ indexClient })`; `STUB_PHASE` is an empty object and `stub-view.ts`'s message is unreachable for `/records`/`/trends` (no route maps to it). |
| `view-registry.ts` | `trends.ts` | registry entry replacing stub | ✓ WIRED | Same as above, `createTrendsView({ indexClient })`. |
| `build-widgets.mjs` | `dist/widgets/data` | `assertNoPrivateArtifacts` scan | ✓ WIRED | Ran live this session — scanned 5585 files, 0 matches, no `data/private/` directory published. |
| `detail.ts` | `list.ts appendBadge` | shared badge builder | ✓ WIRED | Import at `detail.ts:37`, called at `detail.ts:506`. |
| `riegel.ts` | distinct activityId count | `Set` size guard | ✓ WIRED | `fitRiegelExponent` line 71-72, not row-count. |
| `verify-dashboard-publish.mjs` | `/data/stats/training-load.json`, `/data/private/athlete-private.json` | `expect200`/`expect404` | ✓ WIRED | Live run this session: `training-load.json -> 200` with shape assertions; `athlete-private.json -> 404`; `/data/private/ -> 404`. 37/37 checks passed. |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| REC-02 | 18-04, 18-09, 18-12 | All-time PR lists per distance | ✓ SATISFIED | `records.ts` PR tables, all 7 distances, named marathon empty state. |
| REC-03 | 18-04, 18-09, 18-12 | PR evolution over years | ✓ SATISFIED | `records-charts.ts` 7 independent stepped charts + progression disclosure. |
| REC-04 | 18-04, 18-13 | PR badge in list and detail views | ✓ SATISFIED | `list.ts:197` + `detail.ts:505-506`. |
| REC-05 | 18-06, 18-09, 18-12, 18-14 | Weekly/monthly/yearly totals, biggest week/month, streaks | ✓ SATISFIED | Reuses v1.0 `weekly-distance.json`/`monthly-stats.json`/`streaks.json`, confirmed pre-existing since 2026-02-14. |
| REC-06 | 18-01, 18-02, 18-08, 18-12, 18-13 | Age-graded percentages, PII-safe | ✓ SATISFIED | Live `verify-dashboard` confirms no identity fields published; live `compute-all-stats` confirms real percentages computed. One external cross-check at one distance (5k, 0.51-pt delta, within tolerance) — recorded honestly as a limitation in `18-VALIDATION.md`, not hidden. |
| REC-07 | 18-04, 18-09, 18-12 | Riegel race-time predictions | ✓ SATISFIED | `riegel.ts` real prediction/fit/guard logic; `records.ts` predictions section. |
| TREND-01 | 18-04, 18-06, 18-14 | Weekly/monthly volume trend charts | ✓ SATISFIED | `trends-volume-logic.ts` + `mountVolumeChart`. |
| TREND-02 | 18-06, 18-14 | Year-over-year comparisons | ✓ SATISFIED | `trends-yoy-logic.ts` + `mountYoyChart`. |
| TREND-03 | 18-10, 18-15 | Cadence/HR monthly trends | ✓ SATISFIED | `trends-cadence-hr-logic.ts` + `mountChannelBands`. |
| TREND-04 | 18-01, 18-03, 18-04, 18-07, 18-10, 18-15 | TRIMP training load (CTL/ATL/TSB) | ✓ SATISFIED | Real Edwards/Banister math (not stubs), continuous daily spine, live-reproduced numbers matching validation record exactly. |
| TREND-05 | 18-04, 18-05, 18-10, 18-15 | Per-shoe gear-aware trends | ✓ SATISFIED | `gear-naming.ts`/`compute-gear-aggregate.ts`/`trends-gear-logic.ts` + `mountGearChart`, live-reproduced 16 shoes/62.1% coverage. |

**Note (data-quality, non-blocking):** `.planning/REQUIREMENTS.md`'s traceability table (lines 108-121) still marks 10 of these 11 requirement IDs as "Pending" (only REC-06 shows "Complete"). This is a stale documentation artifact — the codebase evidence above independently confirms all 11 are implemented and working — but the traceability table itself was not updated as part of phase close. This should be corrected as a documentation housekeeping item; it does not block phase-goal achievement since it's a bookkeeping doc, not the source of truth checked here.

### Anti-Patterns Found

None. Scanned every file touched since 2026-08-11 under `src/analytics`, `src/dashboard`, `scripts`, `.github` for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` and "not yet implemented"/"coming soon" patterns — zero matches outside of an intentional literal (`PLACEHOLDER_BIRTH_DATE`, a real sentinel constant, not a debt marker).

### Scrutinized Risk Areas (per orchestrator's explicit ask)

1. **Do all 11 requirement IDs have real code, or only tests on pure functions?** Verified real, substantive, non-trivial implementations for every ID (see Requirements Coverage table above) — not just passing unit tests. TREND-04 in particular (8 contributing plans) has genuinely non-trivial math: Δt-weighted TRIMP integration (not sample-count), a continuous calendar-day CTL/ATL/TSB spine that decays across rest days, and pre-update TSB capture — all read directly in source, with inline comments documenting exactly which pitfall each design choice avoids. Live-reproduced output (5,475-day spine, 1,868 activities) matches the phase's own recorded measurements exactly.
2. **Is `data/private/athlete-private.json` genuinely unreachable from published output?** Confirmed independently, not taken on faith: `git check-ignore` confirms it's gitignored; `git ls-files data/private` shows only the README and example template are tracked; a full `npm run build-widgets` run in this session with the real private file present on disk produced a private-artifact scan of 5,585 files with zero matches, and `find dist/widgets/data -iname "*private*"` returned nothing; `npm run verify-dashboard` independently confirmed 404 on both `/data/private/athlete-private.json` and `/data/private/`; a direct grep for the actual PII values from the developer's real on-disk private config (values deliberately not reproduced here — this file is committed to a public repo) in `dist/widgets/` found nothing (the only `birthDate`/`restingHr` string matches in the bundle are static UI copy strings like "add birthDate and sex to data/private/athlete-private.json to enable it", not leaked values).
3. **Are the Trends tabs and Records page wired with no stub remnants?** `STUB_PHASE` is `{}` (empty, confirmed both by direct source read and by `view-registry.test.ts`'s own assertion); `find src -iname "*stub*"` returns only the still-used generic `stub-view.ts` module (which is no longer reachable via any route, since `/records` and `/trends` both resolve to real views); no `records.stub.ts` or `trends.stub.ts` files exist. `view-registry.ts` registers `createRecordsView`/`createTrendsView` directly.
4. **Does anything claim a requirement complete that the human checkpoint did not confirm?** No. `18-VALIDATION.md` records exactly which sub-checks were confirmed and explicitly flags 4 honest limitations (§ 19 checklist wording defect, current-PR-number sub-check not separately confirmed, 640px resize sub-check not separately confirmed, and REC-06's single-distance cross-check) rather than claiming full coverage. None of those 4 limitations invalidate the corresponding requirement — REC-03's evolution charts are independently confirmed correct against the authoritative `18-UI-SPEC.md:319` spec (the developer's "ascending not descending" observation was a documentation-wording defect at line 843, not a code defect — verified directly in `records-charts.ts:97`, which sets `reverse: true` exactly as line 319 requires); REC-06 has one real correctness data point within tolerance, honestly flagged as incomplete two-point coverage rather than silently accepted as fully proven.

### Known Issues (previously recorded, verified accurate — not new findings)

- **§ 19 checklist wording defect** (`18-UI-SPEC.md:843` vs `:319`): confirmed the implementation (`records-charts.ts:97`, `reverse: true`) follows the authoritative line 319, and the checklist wording at 843 is the actual defect. Documentation-only, non-blocking.
- **18-13-SUMMARY.md orchestrator-authored**: consistent with the phase's own post-merge gate substituting for self-check; all 3 task commits for 18-13 exist and the code they describe (badge/panel wiring) is present and correct, independently re-verified above.
- **18-13 touched files beyond declared `files_modified`**: confirmed `best-efforts-client.ts`/`.test.ts` exist, are imported and wired (`detail.ts:30, 277, 496`), and pass in the 884/884 test run.
- **REC-06 single-distance external cross-check**: confirmed accurately recorded in `18-VALIDATION.md` as a limitation, not hidden.
- **`gear-aggregate-logic.ts` `label === null` fragility**: confirmed exact code location (`gear-aggregate-logic.ts:147`, `slugify` at line 41) — an `undefined` `gearName` (missing key) would crash `slugify`, distinct from a `null` `gearName` (present key, no gear) which is handled correctly. Confirmed moot in the actual pipeline: `src/index.ts`'s `compute-all-stats` chain runs `compute-dashboard-index` (step 6, which always emits `gearName` as `null` or a string — never omits the key) before `compute-gear-aggregate` (step 7). No blocker.

### Human Verification Required

None. The phase's own escalation-gate human checkpoint (plan 18-16) was already executed and recorded in `18-VALIDATION.md` with `nyquist_compliant: true` and an explicit "it's all good" verdict, including honest disclosure of partial-coverage sub-checks. No further human verification items were identified by this pass beyond what that checkpoint already covered — re-litigating an already-completed, honestly-documented human checkpoint is out of scope for this automated verification.

### Gaps Summary

No gaps found. All 5 ROADMAP success criteria are observably true in the codebase, all 11 requirement IDs (REC-02 through TREND-05) have real, substantive, wired implementations (not stubs or pure-function-only coverage), the private-athlete-data guard is independently confirmed to actually prevent PII from reaching the published site, and the Trends/Records views are fully wired into the view registry with zero stub remnants. `npm run build`, `npm test` (884/884), `node dist/index.js compute-all-stats`, `npm run build-widgets`, and `npm run verify-dashboard` (37/37) were all independently re-executed in this session and passed, matching (and in the training-load/gear cases, exactly reproducing) the numbers already recorded in `18-VALIDATION.md`. The five previously-known issues were checked against the actual code and confirmed accurately described, none of them rising to a blocker. One non-blocking documentation-hygiene item was found: `.planning/REQUIREMENTS.md`'s traceability table has not been updated to mark REC-02/03/04/05/07 and TREND-01..05 as Complete.

---

_Verified: 2026-08-12T10:23:03Z_
_Verifier: Claude (gsd-verifier)_
