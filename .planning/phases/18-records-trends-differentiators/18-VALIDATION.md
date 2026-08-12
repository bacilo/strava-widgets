---
phase: 18
slug: records-trends-differentiators
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `18-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (installed) |
| **Config file** | `vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts']` |
| **Quick run command** | `npm test -- --run src/analytics` / `npm test -- --run src/dashboard` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | ~1 second (592/592 passing as of Phase 17 close) |

**Hard constraint carried forward from Phase 17:** no `jsdom`/`happy-dom` and no headless browser in `devDependencies`. `environment: 'node'` means `document`, `window`, and canvas rendering are **untestable** in this suite. Every automated test this phase adds MUST target pure functions with zero DOM dependency — the established `*-logic.ts` pattern. Canvas/DOM correctness is verified by the manual browser checkpoint below, not by the suite.

---

## Sampling Rate

- **After every task commit:** `npm test -- --run src/analytics` and/or `npm test -- --run src/dashboard` (whichever the task touches)
- **After every plan wave:** `npm test` **plus** `npm run build-widgets && npm run verify-dashboard`
- **Before `/gsd-verify-work`:** Full suite green, `verify-dashboard` green (extended per Wave 0 below), **and** the real-browser manual checkpoint complete
- **Max feedback latency:** ~5 seconds (unit suite is sub-second; build + verify-dashboard adds the rest)

---

## Per-Task Verification Map

*Reconciled at phase close (plan 18-16, Task 1) against the actual plans that shipped and the tests that actually exist. Requirements were implemented incrementally across several plans/waves; each row lists every contributing plan.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-04/18-09/18-12 | 18-04, 18-09, 18-12 | 1, 2, 3 | REC-02 | — | N/A | unit | `vitest run src/dashboard/views/records-logic.test.ts` | ✅ | ✅ green |
| 18-04/18-09/18-12 | 18-04, 18-09, 18-12 | 1, 2, 3 | REC-03 | — | N/A | unit | `vitest run src/dashboard/views/records-logic.test.ts` | ✅ | ✅ green |
| 18-04/18-13 | 18-04, 18-13 | 1, 3 | REC-04 | — | N/A | unit (logic) + manual (badge/panel DOM, see Manual-Only Verifications) | `vitest run src/dashboard/views/detail-best-efforts-logic.test.ts` | ✅ | ✅ green |
| 18-06/18-09/18-12/18-14 | 18-06, 18-09, 18-12, 18-14 | 1, 2, 3, 4 | REC-05 | — | N/A | unit | `vitest run src/dashboard/views/records-logic.test.ts src/dashboard/views/trends-logic.test.ts` | ✅ | ✅ green |
| 18-01/18-02/18-08/18-12/18-13 | 18-01, 18-02, 18-08, 18-12, 18-13 | 1, 1, 2, 3, 3 | REC-06 | T-18-PII-01 | Raw `birthDate`/`sex`/`restingHr` never reach `dist/widgets/` or git | unit | `vitest run src/analytics/wma-factors.test.ts src/analytics/athlete-private.test.ts src/analytics/compute-age-grading.test.ts` | ✅ | ✅ green |
| 18-04/18-09/18-12 | 18-04, 18-09, 18-12 | 1, 2, 3 | REC-07 | — | N/A | unit | `vitest run src/analytics/riegel.test.ts` | ✅ | ✅ green |
| 18-04/18-06/18-14 | 18-04, 18-06, 18-14 | 1, 1, 4 | TREND-01 | — | N/A | unit | `vitest run src/dashboard/views/trends-volume-logic.test.ts` | ✅ | ✅ green |
| 18-06/18-14 | 18-06, 18-14 | 1, 4 | TREND-02 | — | N/A | unit | `vitest run src/dashboard/views/trends-yoy-logic.test.ts` | ✅ | ✅ green |
| 18-10/18-15 | 18-10, 18-15 | 2, 5 | TREND-03 | — | N/A | unit | `vitest run src/dashboard/views/trends-cadence-hr-logic.test.ts` | ✅ | ✅ green |
| 18-01/18-03/18-04/18-07/18-10/18-15 | 18-01, 18-03, 18-04, 18-07, 18-10, 18-15 | 1, 1, 1, 2, 2, 5 | TREND-04 | T-18-PII-05 | `TrainingLoadDocument` structurally excludes `restingHr`/`sex`/`birthDate` | unit | `vitest run src/analytics/trimp.test.ts src/analytics/training-load.test.ts src/analytics/compute-training-load.test.ts` | ✅ | ✅ green |
| 18-04/18-05/18-10/18-15 | 18-04, 18-05, 18-10, 18-15 | 1, 1, 2, 5 | TREND-05 | — | N/A | unit | `vitest run src/dashboard/views/trends-gear-logic.test.ts src/analytics/gear-naming.test.ts src/analytics/gear-aggregate-logic.test.ts` | ✅ | ✅ green |
| 18-01/18-11 | 18-01, 18-11 | 1, 3 | all | T-18-PII-01, T-18-AVAIL-03 | New data files reachable; private config 404s; no identity-field leak at any published URL | integration | `npm run build-widgets && npm run verify-dashboard` | extends existing | ✅ green (37/37) |
| 18-05 | 18-05 | 1 | TREND-05 (extra coverage) | — | N/A | unit | `vitest run src/analytics/gear-naming.test.ts` | ✅ | ✅ green |
| 18-05 | 18-05 | 1 | TREND-05 (extra coverage) | — | N/A | unit | `vitest run src/analytics/gear-aggregate-logic.test.ts` | ✅ | ✅ green |
| 18-01 | 18-01 | 1 | REC-06 (extra coverage) | T-18-PII-01, T-18-PII-09 | Private config never reaches `dist/widgets/`; own-property regression guard on the public config | unit | `vitest run src/analytics/athlete-private.test.ts` | ✅ | ✅ green |
| 18-07 | 18-07 | 2 | TREND-04 (extra coverage) | T-18-PII-06 | `compute-training-load` build step degrades Banister off (never estimates) with no private config | unit | `vitest run src/analytics/compute-training-load.test.ts` | ✅ | ✅ green |
| 18-08 | 18-08 | 2 | REC-06 (extra coverage) | T-18-PII-01 | `compute-age-grading` build step never publishes identity fields; degrades to `enabled: false` | unit | `vitest run src/analytics/compute-age-grading.test.ts` | ✅ | ✅ green |
| 18-13 | 18-13 | 3 | REC-04 (extra coverage) | — | N/A | unit | `vitest run src/dashboard/views/detail-best-efforts-logic.test.ts` | ✅ | ✅ green |
| 18-13 | 18-13 | 3 | REC-06 (extra coverage) | T-18-PII-01 | Client degrades to `null` on a missing/malformed document, parses `enabled: false` without exposing identity fields | unit | `vitest run src/dashboard/data/age-grading-client.test.ts` | ✅ | ✅ green |
| 18-06 | 18-06 | 1 | REC-05, TREND-01..05 (shell coverage) | — | N/A | unit | `vitest run src/dashboard/views/trends-logic.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: rows marked "(extra coverage)" are the eight test files created beyond the original Wave 0 map (`gear-naming.test.ts`, `gear-aggregate-logic.test.ts`, `athlete-private.test.ts`, `compute-training-load.test.ts`, `compute-age-grading.test.ts`, `detail-best-efforts-logic.test.ts`, `age-grading-client.test.ts`, `trends-logic.test.ts`) — added here so every test file this phase produced is traceable to a row, not just the original Wave 0 list.*

---

## Wave 0 Requirements

- [x] `src/analytics/trimp.test.ts` — Edwards + Banister formula correctness over synthetic **decimated** streams (interval-weighted time-in-zone, not sample counting). Delivered by plan 18-03 (wave 1). Mutation check run live (Pitfall 2, uniform-sampling assumption): failed 3/14 tests as expected, reverted.
- [x] `src/analytics/training-load.test.ts` — CTL/ATL/TSB recursion, continuous daily spine across an activity gap, TSB day-offset (yesterday's CTL − ATL). Delivered by plan 18-03 (wave 1). Mutation check run live (Pitfall 4, same-day TSB): failed as expected, reverted.
- [x] `src/analytics/riegel.test.ts` — prediction formula + guarded log-log fit, including the live-archive scenario where three PRs come from one activity and must be excluded by **distinct-activity count**, not row count. Delivered by plan 18-09 (wave 2). Mutation check run live (row-count instead of distinct-activity-count): produced a fabricated exponent from one activity's internal splits, reverted.
- [x] `src/analytics/wma-factors.test.ts` — factor lookup + 1k log-linear interpolation, with a formula-direction regression test pinned to a known worked value (5K standard 769 s, age-50-male factor 0.8775, actual 1500 s → 58.4%). Delivered by plan 18-02 (wave 1).
- [x] `src/dashboard/views/records-logic.test.ts` — PR table/empty-state (`rankings.marathon` is genuinely empty), evolution-series derivation, superlative `max()` selection. Delivered by plan 18-09 (wave 2).
- [x] `src/dashboard/views/trends-volume-logic.test.ts`, `trends-yoy-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts` — chart data transforms, heatmap cell placement, Unknown-bucket coverage math. Delivered by plans 18-06 (volume, YoY, wave 1) and 18-10 (cadence/HR, gear, wave 2).
- [ ] `src/dashboard/data/athlete-config-client.test.ts` — ~~extend with cases for the new `birthDate` / `sex` / `restingHr` fields (D-12)~~ **SUPERSEDED by 18-01's locked deviation.** Plan 18-01 moved `birthDate`/`sex`/`restingHr` out of `data/config/athlete.json` entirely, into the gitignored, never-published `data/private/athlete-private.json` — because this repo is public and `copyDataFiles` wholesale-copies `data/config/`. The public `athlete.json` and its client (`athlete-config-client.ts`) therefore gained **no** new fields and needed no new test cases. Coverage for `birthDate`/`sex`/`restingHr` now lives entirely in `src/analytics/athlete-private.test.ts` (11 cases: valid config, template rejection, missing/invalid sex, restingHr edge cases, `__proto__`-keyed non-reachability, prose-birthDate rejection, ENOENT degrade). This item is deliberately left unchecked rather than ticked — a superseded requirement that looks satisfied is how a real gap hides.
- [x] Extend `scripts/verify-dashboard-publish.mjs` — assert every new `data/stats/*.json` and WMA factor file returns 200 with the expected top-level shape (`schemaVersion`, non-empty payload), **and** assert the private athlete config returns **404**. This is the script's first negative-reachability assertion. Delivered by plan 18-01 (wave 1, the initial 404/own-property-regression assertions) and extended by plan 18-11 (wave 3, training-load/age-grading/gear-aggregate/WMA-table shape assertions, 25→37 total checks).

---

## Manual-Only Verifications

No jsdom, no headless browser → all canvas/DOM behavior is manual. This is the phase's highest-risk surface: **Phase 16 shipped a black page behind a 15/15 green gate, and Phase 17 shipped two chart/map defects behind 592/592 tests, clean tsc, and 20/20 verify-dashboard. Both escapes were rendering defects invisible to automated checks.** A five-tab, ~15-chart phase is maximally exposed to this class.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 7 PR-evolution step charts render | REC-03 | Canvas paint — no headless browser | Open `#/records`; confirm each of the 7 small multiples shows a visible descending step line and a correctly-directioned duration y-axis |
| `rankings.marathon` empty state | REC-02 | DOM render | Confirm the marathon table shows a proper empty state — not a blank block, not a crash |
| Low-confidence / excluded badges visible | REC-02, REC-07 | DOM render | Confirm low-confidence rows carry a marker with tooltip, and excluded activities show their `reason` string |
| Detail-view PR badge + best-efforts panel | REC-04 | DOM render | Open a run with `prCount > 0`; confirm named per-distance badges in the stats header and a best-efforts panel listing all efforts with PR-setting rows highlighted |
| Age-grade column hides with actionable notice | REC-06 | DOM render | With `birthDate` unset, confirm the column is absent and a notice names the file and field — no placeholder number |
| 53×7 year consistency heatmap | TREND-01 | Canvas/CSS grid layout | Confirm the grid renders 53×7 with no overlapping or missing cells and a legible color scale |
| Thin-HR-coverage shading | TREND-04 | Canvas paint | Confirm spans with sparse HR are visually distinguishable from genuine zero-load — a dip must read as "no data", not "no training" |
| Edwards/Banister toggle changes the series | TREND-04 | Canvas paint | Toggle the model; confirm the plotted series actually changes, not just the label |
| Tab switching does not throw | TREND-01..05 | Runtime canvas lifecycle | Cycle all 5 Trends tabs twice; confirm no "Canvas is already in use" error in the console |
| Unknown gear bucket + stated coverage | TREND-05 | DOM render | Confirm an explicit Unknown row and a plain-numbers coverage statement (62% archive-wide, 19% in 2026) |

---

## Live archive measurements at phase close

Recorded during plan 18-16, Task 1, by running the full gate from a clean state (`npm run build && npm test && node dist/index.js compute-all-stats && npm run build-widgets && npm run verify-dashboard`) and re-deriving each value directly from the freshly regenerated `data/stats/*.json` files rather than copying plan-summary text uncross-checked. These are the numbers a future phase will want and that nothing else in the repo records.

| Measurement | Value | Source |
|---|---|---|
| **Riegel fit** | 6 fit points across **4 distinct activities**; fitted exponent **b = 1.1935142631296778** | `node -e` against `riegel.selectFitPoints`/`fitRiegelExponent` over the live `data/stats/best-efforts.json`, re-run at phase close — matches 18-09-SUMMARY.md exactly |
| **Training-load spine** | **5,475 days** (2011-05-09 to 2026-08-11); **1,868 activities considered**, **1,688 with HR**, **180 without HR**, **0 unreadable** | `node dist/index.js compute-all-stats` output at phase close, and `data/stats/training-load.json`'s `days.length`/`totals` — matches 18-07-SUMMARY.md exactly |
| **Gear coverage** | **62.1%** overall (1,160/1,868 runs); **56.4%** in 2020; **100%** in 2023; **19.4%** in 2026 | `data/stats/gear-aggregate.json`'s `totals.percentWithGear` and `byYear[]` entries, read live at phase close — matches 18-05-SUMMARY.md's observed table |
| **Gear aggregate** | **16 distinct shoes** (all currently "Shoe N" ordinal fallback, no config names set) plus 1 Unknown bucket = 17 rows | `data/stats/gear-aggregate.json`'s `totals.distinctShoes` and `shoes.length`, read live at phase close |
| **WMA editions bundled** | Road: **2025 edition** (`AlanLyttonJones/Age-Grade-Tables`, `MaleRoadStd2025.xlsx`/`FemaleRoadStd2025.xlsx`, CC0-1.0). Track: **2023-edition factors paired with 2015-edition open standards** (both `howardgrubb.co.uk`, same author/domain — the 2023 factors page has no standards field; the 2010/2015 standards are byte-identical, indicating standards revise far less often than factors) | `data/wma/road-factors.json`'s `edition`/`source`, `data/wma/track-factors.json`'s `edition`/`standardsEdition`, read live at phase close; full pairing rationale in `data/wma/README.md` |
| **Per-distance PR-evolution step counts** | 400m **11**, 1k **11**, 1mi **14**, 5k **21**, 10k **16**, half **6**, marathon **0** — **79 total** | `node -e` against `records-logic.buildEvolutionSeries` over the live `data/stats/best-efforts.json`, re-run at phase close — matches 18-09-SUMMARY.md and 18-12-SUMMARY.md exactly |

**Additional phase-close state** (not one of the six required measurements above, but recorded for completeness since the gate was run to confirm it): with no `data/private/athlete-private.json` present — the state this phase ships in — `data/stats/age-grading.json` reports `enabled: false` with `disabledReason: "Age-grading is off — add birthDate and sex to data/private/athlete-private.json to enable it."`, and `data/stats/training-load.json` reports `models.banister: false` (Banister TRIMP correctly disabled, never estimated). Both match every prior plan summary's documented default-state behavior.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] Manual browser checkpoint script written and executed
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
