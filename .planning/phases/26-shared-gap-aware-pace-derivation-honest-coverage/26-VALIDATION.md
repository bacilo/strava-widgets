---
phase: 26
slug: shared-gap-aware-pace-derivation-honest-coverage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-08
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `26-RESEARCH.md` § "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | `vitest.config.ts` (existing — keep `fileParallelism: false`, per STATE.md's Phase 24 cross-plan-defect lesson; do **not** re-enable parallelism for this phase's new test files) |
| **Quick run command** | `npx vitest run src/analytics/pace-derivation.test.ts src/analytics/pace-fixtures.test.ts` |
| **Full suite command** | `npm run test` (`vitest run`) |
| **Estimated runtime** | ~30s quick / full suite per existing project baseline |

**Framework install:** none needed — vitest is already configured project-wide.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/analytics/pace-derivation.test.ts src/analytics/pace-fixtures.test.ts`
- **After every plan wave:** Run `npm run test` (full suite, `fileParallelism: false`)
- **Before `/gsd-verify-work`:** Full suite green **+** `tsc --noEmit` **+** `npm run build-widgets` — this project's existing phase-gate convention, confirmed across every prior phase in STATE.md
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner. Rows below are keyed by requirement and are
filled in with concrete task IDs once `*-PLAN.md` files exist; every task that
touches a requirement below must cite the matching automated command.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PACE-01 | — | N/A | unit (grep-based audit) | `npx vitest run src/analytics/pace-single-source.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACE-02 | — | N/A | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "gap boundary"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACE-03 | — | N/A | unit, real committed stream `5059204779` | `npx vitest run src/analytics/pace-derivation.test.ts -t "adaptive window"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACE-04 | — | N/A | unit, real archive | `npx vitest run src/analytics/pace-derivation.test.ts -t "histogram"` | ❌ W0 | ⬜ pending |
| Task 2 | 26-06 | 4 | PACE-05 | — | N/A | unit | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "gap marker"` | ✅ (created by 26-06; 8 passing) | ✅ green |
| TBD | TBD | TBD | PACE-06 | — | N/A | integration (script, real archive) | `node scripts/compute-pace-residual.mjs` — diff against committed `26-RESIDUAL.md` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACE-07 | T-26-01 | Total/never-throwing on malformed stream input | unit + archive-wide dry run | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "pace disagreement"` | ❌ W0 (extend existing file) | ⬜ pending |
| TBD | TBD | TBD | COV-01 | — | N/A | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "coverage sums"` | ❌ W0 | ⬜ pending |
| Task 2 | 26-06 | 4 | COV-02 | — | N/A | unit (text/structure assertion — no jsdom, per project convention) | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "coverage caption"` | ✅ (created by 26-06; 5 passing) | ✅ green |
| TBD | TBD | TBD | ERA-03 | — | N/A | unit | `npx vitest run src/analytics/pace-fixtures.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Demonstrated-Failing Cases (Nyquist negative staging)

Every Phase 26 Success Criterion carries a "demonstrated failing" clause. Each negative
case below must be staged and observed failing **before** its positive assertion is trusted.

| # | Negative case staged | Observable that proves the failure | Criterion / Req |
|---|----------------------|-----------------------------------|-----------------|
| 1 | Fixed 20s window instead of adaptive | `5059204779` reads ~94.8% fast mass / ~30% coverage (vs 1.2% / 97% adaptive) | Crit 5 · PACE-03 |
| 2 | Absolute distance-flat pause threshold instead of scale-relative | ~97% of `5059204779` classified as paused despite max time gap of 7s | D-05 · PACE-02 |
| 3 | Gap-boundary clipping removed | Constructed known-duration-gap fixture shows the window bridging the gap | Crit 2 · PACE-02 |
| 4 | Split gap marking removed | Split whose window crosses a gap renders with no marker/legend | Crit 2 · PACE-05 |
| 5 | The `dd <= 0` skip in `computePaceDistribution` (the located defect) | `covered + Σ(excluded by category)` ≠ `t[n-1] - t[0]`; 964/3,394s (28%) unaccounted on `4556693525` | Crit 3 · COV-01 |
| 6 | A second per-sample pace implementation deliberately reintroduced | `pace-single-source.test.ts` fails, naming the offending file | Crit 4 · PACE-01 |
| 7 | Metadata-vs-stream cross-check removed | Dashboard reverts to displaying `5059204779` as 1:53/km as fact | Crit 7 · PACE-07 |
| 8 | Archive sweep re-run against the unfixed per-sample path | Baseline fast-mass values reproduce, confirming the "after" comparison is real | Crit 1 · PACE-04/06 |

---

## Wave 0 Requirements

- [ ] `src/analytics/pace-derivation.ts` + `src/analytics/pace-derivation.test.ts` — the shared module
- [ ] `src/analytics/pace-fixtures.ts` + `src/analytics/pace-fixtures.test.ts` — ERA-03 fixture library
- [ ] `src/analytics/pace-single-source.test.ts` — D-18's grep-based audit
- [ ] `scripts/compute-pace-residual.mjs` — D-19's regenerating script
- [ ] `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md` — D-19's committed deliverable (13 IDs; re-verify against the live archive before committing as final)
- [ ] Extend `src/dashboard/views/detail-sections.test.ts` — D-08 caption + D-09 split marker
- [ ] Extend `src/analytics/compute-dashboard-index.test.ts` — PACE-07's additive flag field

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coverage caption reads correctly on screen under the `Pace Distribution` heading, and its percentage equals a hand-sum taken straight from the committed stream file | COV-02, Crit 3 | Criterion 3 requires the value be *read in the browser at the moment of observation*, not asserted from a unit test | Serve the built dashboard, hard-reload (stale `index.html`/`index.json` in staged builds is a known trap), open the pinned exemplar `4556693525`, read the caption percentage back against an independently summed value from `data/streams/4556693525.json`. Pre-computed expectation (plan 26-06, re-derived at execution time from `derivePaceWithCoverage`): `"99% of elapsed time covered · 1% recording gaps · 0% paused"` (spanSec 3394, coveredSec 3363, recordingGapSec 31, pauseSec 0). |
| Split gap marker + legend render legibly at phone widths without breaking the splits table's 7 columns (`Km \| Pace \| Elapsed \| Avg HR \| Avg Cadence \| Elev Δ \| vs. Avg` — confirmed by direct source read, not the 8 columns CONTEXT.md's prose stated) | PACE-05, D-09 | Layout legibility is not assertable from a text/structure test | Hard-reload, open activity `10198771331` (fēnix 6 Pro FIT, span 5225s, distance 11169m — pinned as `gap-crossing-split` in `pace-fixtures.ts`) at narrow viewport (clamped 500..941). Confirm km 11's Pace cell reads `"18:38/km ⚠"` and the legend below the splits table reads exactly `"Km 11: includes 11:29 of recording gap"` — the marker and legend should read as "paused mid-km" not "bad kilometre". Verified at execution time (plan 26-06): `splitGapAnnotations` flags exactly km 11 (recordingGapSec 688, pauseSec 1, totalSec 689 = 11:29), no other split in this activity is flagged. Backups if `10198771331` cannot be reached: `10238432339` (km 17, 515s gap) or `10325703458` (km 2, 273s gap), both also pinned in `pace-fixtures.ts`. |
| PACE-07 badge appears on **both** the detail Pace stat card and the Activities list row (and is considered against all three `renderActivityRow` surfaces) | PACE-07, D-11 | Multi-surface rendering; `idPrefix` pattern makes the list row shared across Activities, Overview Recent Activities, Overview Recent PRs | Hard-reload, sort Activities by pace, confirm `5059204779` ranks #1 **with** its badge visible and is not suppressed from results (D-12) |

*This project has a standing browser-checkpoint convention: per PROJECT.md, automated gates have
missed shipped rendering defects three times. ROADMAP.md marks Phase 26 `UI hint: yes`. A human
browser checkpoint is expected before this phase closes.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] All 8 demonstrated-failing cases staged and observed failing before their positive assertion
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
