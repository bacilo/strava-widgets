---
phase: 18
slug: records-trends-differentiators
status: approved
nyquist_compliant: true
wave_0_complete: true
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

**Performed 2026-08-12 against `http://localhost:8099/strava-widgets/` (production-shaped path, console visible for the whole session), walking § 19's 20-item checklist item by item. Observations below are the developer's own words, recorded verbatim per T-18-VERIFY-03 — not smoothed, not paraphrased, not upgraded past what was actually said.**

| # | Item | Requirement | Verbatim Observation |
|---|------|-------------|----------------------|
| 1 | Hash-router safety (§ 1 landmine) | REC-02/03/05 | "yes" — URL hash stayed `#/records` across all four jump-list clicks, page scrolled to the right section |
| 2 | Sticky offset (§ 1 landmine) | REC-02/03/05 | "the 'superlatives, pr tables' etc... top row is on front and as we scroll everything seems to go behind it. It's fine just not sure that was the intended effect." Confirmed by the orchestrator as intended sticky behaviour; developer later reconfirmed overall with "it's all good". **The 640px resize gap/overlap sub-check was not separately confirmed** — recorded honestly as a limitation rather than assumed passing. |
| 3 | Seven evolution charts (§ 3) | REC-03 | "are the 'step lines' the PR evolution? They look great but they're not descending but ascending. I think the y scale is reversed. It's fine though..." **This is a real finding and a DOCUMENTATION defect, not a code defect.** `src/dashboard/views/records-charts.ts:97` sets `reverse: true`, exactly as `18-UI-SPEC.md:319` requires ("`y`: linear scale, **`reverse: true`**"). But `18-UI-SPEC.md:843`'s § 19 checklist item reads "each renders a visibly descending step" — which contradicts the reversed scale that line 319 mandates. **The implementation follows the authoritative chart spec (line 319); the § 19 checklist wording (line 843) is wrong and must be corrected in a future doc pass.** Also recorded honestly: the second half of this item — that the big `.text-display` current-PR number matches the chart's lowest/best point — was not separately confirmed by the developer. |
| 4 | Evolution grid breakpoints (§ 3) | REC-03 | "yes" — column counts matched 1 / 2 / 3 across the <640px, 640-999px, ≥1000px breakpoints |
| 5 | Marathon empty state (§ 2) | REC-02 | "yes" — named empty state, reachable from the jump list |
| 6 | Age-grade column (§ 2) | REC-06 | "yes" — em-dash cells, single config notice naming `data/private/athlete-private.json` |
| 7 | Riegel suppression (§ 4b) | REC-07 | "yeah fitted component table exists" — matches the live data recorded in Live Archive Measurements above: fitted branch, b=1.1935142631296778, 6 points across 4 distinct activities |
| 8 | Progression disclosure (§ 3) | REC-03 | "yes!" — `<details>` opens, signed improvements with leading `−` for faster times |
| 9 | Tablist keyboard model (§ 7) | TREND-01..05 | "good" — Left/Right moved and activated across all five tabs, Home/End jumped to Volume/Gear |
| 10 | Bookmarkability | TREND-01..05 | "good" — `#/trends?tab=training-load` opened directly on that tab; Back/Forward worked across tab changes |
| 11 | Canvas lifecycle | TREND-01..05 | "good" — no "Canvas is already in use" error and no other console error across two full cycles of all five tabs; pasted server log for the session shows only one 404, for `/favicon.ico`, unrelated to the dashboard and outside the `/strava-widgets/` path |
| 12 | Year heatmap (§ 8) | TREND-01 | "yes" — 53×7 grid, no overlapping/missing cells, rest days visibly distinct with zero accent tint, "View as table" discloses real per-day data |
| 13 | Cadence & HR (§ 10) | TREND-03 | "looks good" — the Phase 17 GAP 2 signature (both bands sharing the same x offset) checked deliberately and confirmed |
| 14 | Training load (§ 11) | TREND-04 | "yes" — shaded no-HR regions distinguishable from a genuine zero-load valley, caption legible, Edwards/Banister toggle and window control behave as specified |
| 15 | Gear (§ 12) | TREND-05 | "yes good" — bounded bars, all 16 shoes plus Unknown listed, Unknown stays last after sorting, coverage sentence shows real numbers |
| 16 | PR badge + panel (§ 5) | REC-04 | "yes" — checked against a multi-PR activity (candidates given: 7827165619, 6709874572, 3475734859); named per-distance badges and a permanently-highlighted best-efforts panel |
| 17 | Both themes | cross-cutting | "good" — colour-sensitive checks repeated in dark mode |
| 18 | New-token contrast (§ 16) | cross-cutting | "looks fine" — `--cat-1..8` and `--load-tsb` eyeballed against both light and dark surface pairs |
| 19 | `STUB_PHASE` removal | cross-cutting | "couldn't find any" — no stub panel found on either `#/records` or `#/trends` |
| 20 | Independent age-grade cross-check (RESEARCH Assumption A1, REC-06's only correctness check) | REC-06 | PASSES, with a small unexplained residual. Verbatim: "Age-grading: 63.11% — Your time of 21:26 for 5 kilometres as a 40 year old male yields an age-grading percentage of 63.11% ALMOST the same but a little differet from: #5    21:26    4:17/km    62.6%    May 29, 2022". Distance 5k, time 21:26 (4:17/km), effort date May 29, 2022, age 40 at that date, male. Dashboard 62.6% vs external calculator 63.11% at the **same age (40)** (delta 0.51, inside the plan's ~1-point tolerance). The developer confirmed, verbatim, when asked to clarify: "no. i am 44 i put 40 because it was the age i had at the time" — i.e. both the dashboard (which resolves age at the effort's own date) and the external calculator (entered manually as 40) used the same age. **The delta is therefore NOT explained by age-resolution semantics** — both figures used the same age, so no cause is asserted. As an explicitly **unverified hypothesis, not investigated**: the repo bundles the WMA road 2025 edition while public calculators often use an earlier edition, and edition differences or rounding are candidate explanations — this was not checked and must not be treated as established. **Limitation recorded honestly: the plan asked for two PR rows at two different distances; only one distance (5k) was cross-checked.** The external calculator's identity was not stated by the developer and is recorded as unspecified rather than guessed. |

**Developer's overall verdict, given verbatim: "it's all good"**

### Honest limitations of this checkpoint (recorded so a future phase is not misled)

1. **§ 19 checklist wording defect (item 3).** `18-UI-SPEC.md:843` reads "each renders a visibly descending step", which contradicts `18-UI-SPEC.md:319`'s mandatory `reverse: true` y-scale. The shipped code (`src/dashboard/views/records-charts.ts:97`) correctly implements line 319. The checklist wording at line 843 is wrong and needs correcting in a future documentation pass — this is not a code defect and does not block approval.
2. **Item 3's second sub-check (current-PR number vs. chart low point) was not separately confirmed** by the developer — only the ascending/reversed-scale observation was made.
3. **Item 2's 640px resize gap/overlap sub-check was not separately confirmed**, and **item 20 cross-checked one distance (5k) rather than the two the plan asked for.** Both are recorded as coverage gaps in this checkpoint, not as failures — the developer's overall verdict ("it's all good") stands, but future phases should not assume these specific sub-checks were exercised.
4. **Item 20's 0.51-point delta between the bundled WMA tables and an independent calculator, evaluated at the same age (40), is within the plan's ~1-point tolerance but unexplained.** No cause was confirmed; a possible WMA-edition or rounding difference is noted only as an unverified, uninvestigated hypothesis. A second distance was never cross-checked, so REC-06's external evidence remains one data point with a small, unresolved residual — not a fully independent two-point confirmation.

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] Manual browser checkpoint script written and executed
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-12
