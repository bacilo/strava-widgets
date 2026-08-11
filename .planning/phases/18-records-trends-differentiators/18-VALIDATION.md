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

*Populated during planning — plans do not exist yet. Each task's row must be filled with its automated command before execution begins.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | REC-02 | — | N/A | unit | `vitest run src/dashboard/views/records-logic.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | REC-03 | — | N/A | unit | `vitest run src/dashboard/views/records-logic.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | REC-04 | — | N/A | manual | real-browser checkpoint (no jsdom) | n/a | ⬜ pending |
| TBD | TBD | TBD | REC-05 | — | N/A | unit | `vitest run src/dashboard/views/records-logic.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | REC-06 | T-18-PII-01 | Raw `birthDate`/`sex` never reach `dist/widgets/` | unit | `vitest run src/analytics/wma-factors.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | REC-07 | — | N/A | unit | `vitest run src/analytics/riegel.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TREND-01 | — | N/A | unit | `vitest run src/dashboard/views/trends-volume-logic.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TREND-02 | — | N/A | unit | `vitest run src/dashboard/views/trends-yoy-logic.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TREND-03 | — | N/A | unit | `vitest run src/dashboard/views/trends-cadence-hr-logic.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TREND-04 | — | N/A | unit | `vitest run src/analytics/trimp.test.ts`, `vitest run src/analytics/training-load.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TREND-05 | — | N/A | unit | `vitest run src/dashboard/views/trends-gear-logic.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | all | T-18-PII-01, T-18-TAB-01 | New data files reachable; private config 404s | integration | `npm run build-widgets && npm run verify-dashboard` | extends existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/analytics/trimp.test.ts` — Edwards + Banister formula correctness over synthetic **decimated** streams (interval-weighted time-in-zone, not sample counting)
- [ ] `src/analytics/training-load.test.ts` — CTL/ATL/TSB recursion, continuous daily spine across an activity gap, TSB day-offset (yesterday's CTL − ATL)
- [ ] `src/analytics/riegel.test.ts` — prediction formula + guarded log-log fit, including the live-archive scenario where three PRs come from one activity and must be excluded by **distinct-activity count**, not row count
- [ ] `src/analytics/wma-factors.test.ts` — factor lookup + 1k log-linear interpolation, with a formula-direction regression test pinned to a known worked value (5K standard 769 s, age-50-male factor 0.8775, actual 1500 s → 58.4%)
- [ ] `src/dashboard/views/records-logic.test.ts` — PR table/empty-state (`rankings.marathon` is genuinely empty), evolution-series derivation, superlative `max()` selection
- [ ] `src/dashboard/views/trends-volume-logic.test.ts`, `trends-yoy-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts` — chart data transforms, heatmap cell placement, Unknown-bucket coverage math
- [ ] `src/dashboard/data/athlete-config-client.test.ts` — **extend** with cases for the new `birthDate` / `sex` / `restingHr` fields (D-12), including each-consumer-validates-only-what-it-needs behavior
- [ ] Extend `scripts/verify-dashboard-publish.mjs` — assert every new `data/stats/*.json` and WMA factor file returns 200 with the expected top-level shape (`schemaVersion`, non-empty payload), **and** assert the private athlete config returns **404**. This is the script's first negative-reachability assertion.

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

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] Manual browser checkpoint script written and executed
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
