# Roadmap: Strava Analytics Platform

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-02-14)
- ✅ **v1.1 Geographic & Widget Customization** — Phases 5-9 (shipped 2026-02-16)
- ✅ **v1.2 Maps & Geo Fix** — Phases 10-13 (shipped 2026-02-18)
- ✅ **v2.0 Training Dashboard** — Phases 14-18 (shipped 2026-08-12)
- ✅ **v2.1 Interface Polish** — Phases 19-25 (shipped 2026-09-05)
- 📋 **v2.2 Pace Data Quality** — Phases 26-31 (26-30 complete; 31 tech-debt closure added 2026-09-19)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-02-14</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-02-14
- [x] Phase 2: Analytics (2/2 plans) — completed 2026-02-14
- [x] Phase 3: Widgets (4/4 plans) — completed 2026-02-14
- [x] Phase 4: Pipeline (1/1 plan) — completed 2026-02-14

</details>

<details>
<summary>✅ v1.1 Geographic & Widget Customization (Phases 5-9) — SHIPPED 2026-02-16</summary>

- [x] Phase 5: Geocoding Infrastructure (1/1 plan) — completed 2026-02-15
- [x] Phase 6: Geographic Statistics (2/2 plans) — completed 2026-02-15
- [x] Phase 7: Widget Attribute System (3/3 plans) — completed 2026-02-15
- [x] Phase 8: Geographic Table Widget (2/2 plans) — completed 2026-02-15
- [x] Phase 9: CI/CD Integration (2/2 plans) — completed 2026-02-16

</details>

<details>
<summary>✅ v1.2 Maps & Geo Fix (Phases 10-13) — SHIPPED 2026-02-18</summary>

- [x] Phase 10: Geocoding Foundation & Map Infrastructure (4/4 plans) — completed 2026-02-17
- [x] Phase 11: Route Map Widgets (3/3 plans) — completed 2026-02-17
- [x] Phase 12: Heatmap & Pin Map Widgets (2/2 plans) — completed 2026-02-17
- [x] Phase 13: Standalone Pages (2/2 plans) — completed 2026-02-18

</details>

<details>
<summary>✅ v2.0 Training Dashboard (Phases 14-18) — SHIPPED 2026-08-12</summary>

- [x] Phase 14: Stream Ingestion Foundation (5/5 plans) — completed 2026-08-10
- [x] Phase 15: Best-Effort Engine (4/4 plans) — completed 2026-08-10
- [x] Phase 16: Dashboard Shell & Data Contract (16/16 plans) — completed 2026-08-11
- [x] Phase 17: Activity Browser & Detail Views (15/15 plans) — completed 2026-08-11
- [x] Phase 18: Records, Trends & Differentiators (16/16 plans) — completed 2026-08-12

Full phase details: [`milestones/v2.0-ROADMAP.md`](milestones/v2.0-ROADMAP.md) · Audit: [`v2.0-MILESTONE-AUDIT.md`](v2.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v2.1 Interface Polish (Phases 19-25) — SHIPPED 2026-09-05</summary>

- [x] Phase 19: Design System & Control Styling (17/17 plans) — completed 2026-08-13
- [x] Phase 20: Row-Click Interaction Pattern (20/20 plans) — completed 2026-08-18
- [x] Phase 21: Overview Rebuild (8/8 plans) — completed 2026-08-18
- [x] Phase 22: Calendar Week-Start & Totals (16/16 plans) — completed 2026-08-19, re-verified 2026-09-05
- [x] Phase 23: Trends Zoom, Pan & Taller Bands (13/13 plans) — completed 2026-08-27
- [x] Phase 24: Local Curation Mode (17/17 plans) — completed 2026-09-02
- [x] Phase 25: CI Hardening & Light-Theme Verification (12/12 plans) — completed 2026-09-04

Full phase details: [`milestones/v2.1-ROADMAP.md`](milestones/v2.1-ROADMAP.md)

Every phase closed on a mandatory human browser checkpoint against a production-shaped URL, by
design — this project had shipped rendering defects behind a fully green automated gate three
times before this milestone, and there is no jsdom or headless browser in the repo.

</details>

### 📋 v2.2 Pace Data Quality (Planned)

**Milestone Goal:** Make every pace figure the dashboard derives honest — one gap-aware derivation, plausibility guards that actually bind, and per-activity quality signals you can see — without rewriting a single committed stream.

**Phase Numbering:** Continues from v2.1 (which ended at Phase 25). This milestone is Phases 26-30, plus Phase 31 (tech-debt closure, added 2026-09-19 from the close-out audit).

- [x] **Phase 26: Shared Gap-Aware Pace Derivation & Honest Coverage** - One shared module replaces the two divergent pace formulas; coverage is exact and visible (16/16 plans executed; verified 7/7 success criteria 2026-09-10, see 26-VERIFICATION.md. Took three verification rounds: the Criterion 3 / D-08 / COV-02 gap was closed by 26-13's Round 2 human checkpoint; re-verification then found CR-03 — the pace chart band still derived with the fixed 20s window while the histogram/caption used the adaptive one, defeating Criteria 1/4/5 on the phase's own exemplar 5059204779 — closed by 26-14, alongside CR-02 by 26-15 and a Round 3 human checkpoint by 26-16, all four rows PASS, see 26-VALIDATION.md) (completed 2026-09-10)
- [x] **Phase 27: Per-Activity Quality Signals** - Device-era-aware, severity-tiered quality signals computed in CI, disclosed individually as badges (completed 2026-09-10)
- [x] **Phase 28: PR Plausibility Ceiling** - Three-pass restructure of `compute-best-efforts.ts` derives a personal ceiling and demotes-never-deletes implausible efforts (completed 2026-09-17)
- [x] **Phase 29: Curation Review Queue** - Local curation mode gains a queue for ceiling-flagged efforts, reusing the existing exclusion write path (completed 2026-09-18)
- [x] **Phase 30: Elevation Quality Signal** - Implausible altitude flagged archive-wide by three independent mechanisms, flag-only (completed 2026-09-18)
- [ ] **Phase 31: Tech-Debt Closure — Silent-Failure Guards & Docs Reconciliation** - Close the v2.2 close-out audit's silent-and-passing findings and reconcile every stale figure the milestone left in its own documents (added 2026-09-19 from `v2.2-MILESTONE-AUDIT.md`)

#### Phase 26: Shared Gap-Aware Pace Derivation & Honest Coverage

**Goal**: Every consumer of derived pace (chart, histogram, splits) reads from one gap-aware module in `src/analytics/`, coverage is exact and visibly reported, a stratified fixture library exists for every later phase to reuse, the residue adaptive windowing does not fix (genuine device over-measurement, not data corruption — an earlier draft wrongly called three activities "beyond repair"; adaptivity recovers all three) is identified and quantified rather than smoothed into plausibility, and a metadata-vs-stream pace cross-check catches the one activity whose metadata alone would otherwise display a physically implausible pace as fact.
**Depends on**: Nothing (first phase of this milestone; builds the foundation and fixture library every later phase composes)
**Requirements**: PACE-01, PACE-02, PACE-03, PACE-04, PACE-05, PACE-06, PACE-07, COV-01, COV-02, ERA-03
**Success Criteria** (what must be TRUE):

  1. Archive-wide phantom-fast-mode reduction, measured per-activity against that activity's own baseline rather than a uniform absolute floor — a uniform floor across the 154-activity severe stair-step cohort is unsatisfiable under a fixed window, but a fixed-window measurement can itself manufacture the appearance of a data defect, which is the trap this criterion exists to avoid re-entering: an earlier draft applied a fixed 20s window to three activities emitting distance every 60-99s (5059204779, 3647739864, 4598855187), read them as 94.81%/59.77%/42.57% fast mass, and wrongly called them broken beyond derived-layer repair; under a window scaled to each activity's own observed advance interval, all three resolve to 1.22%/0.00%/0.00% with coverage rising from 30/40/45% to 97/100/100% — their streams were always sound (5059204779 derives 5:51/km against splits of 7:05, 5:00, 6:00×6, 7:00, 5:00, 6:00×2; the round numbers are 60s emission landing on minute multiples, not corruption). Instead: for each of the 154, restricting the Δt-weighted histogram to covered (non-gap-excluded) time per criteria 2/3's accounting and using the adaptive window Criterion 5 requires, the fraction of mass faster than 3:00/km is measured against both the current unfixed per-sample `dt/dd` path (baseline) and the shared derivation (after) — the after-value is strictly lower than that same activity's own baseline, **or both exactly zero** (amended per D-19 / 26-RESEARCH.md Pitfall 2: activity `3475742397` measures baseline fast mass already at exactly 0.00%, so a literal strict-decrease reading is unsatisfiable for it; of the 154, 153 strictly improve, 1 ties at zero, 0 regress), demonstrated failing by re-running the comparison against the unfixed path. Separately, as PACE-06's own required deliverable: under the adaptive derivation, the residual — every activity whose after-value still exceeds 0.5% of covered-time mass — is **14 of the 154, all marginal (0.51-2.44%)** (corrected 2026-09-08, cross-plan integration repair: an earlier measurement attributed a gap segment's entire duration to the pre-gap sample's pace instead of excluding it from the histogram, undercounting the residual; correcting the exclusion moved activity `5246078056` from 0.485% to 0.564% covered-time fast mass, crossing the 0.5% residual threshold — Criterion 1's strictly-lower-than-baseline result above is unaffected, zero violations either way; this is a correction of a measurement error, not a relaxation of the criterion), genuine device over-measurement rather than a data defect, re-derived against the live committed archive on 2026-09-08 (1,866 streams scanned) and enumerated by ID and percentage in `26-RESIDUAL.md` (D-19) — the committed artifact of record, regenerable via `npm run compute-pace-residual`; that exact residual list is the artifact Phase 27 consumes as pre-flagged input, cross-checked at that phase's boundary rather than merely asserted here.
  2. Gaps clip rather than manufacture pace, and affected splits disclose it: a constructed fixture with a known-duration gap shows the pace window stopping exactly at the gap boundary, and any per-km split whose window crosses a gap is marked as such — both checks demonstrated failing when gap-boundary clipping/marking is removed.
  3. Coverage sums exactly and is visibly reported: for the real 35-hour-gap activity and a synthetic multi-category fixture, covered-time + excluded-time (by named category) equals the stream's own span, `t[n-1] - t[0]`, exactly, not approximately (amended per D-06: `CanonicalStream` carries no `elapsed_time` field — that is activity metadata, read from a different file, and the two genuinely differ: activity `4556693525`'s stream span is 3,394s against that same activity's metadata `elapsed_time` of 3,393s, a difference reported rather than absorbed into a tolerance); and the pinned exemplar's detail view displays a coverage percentage that, read in the browser at the moment of observation, equals the value independently summed straight from that activity's committed stream file.
  4. One derivation, provably: a grep-based audit of `src/` finds zero remaining per-sample `dt/dd` (or equivalent) pace arithmetic outside `src/analytics/pace-derivation.ts` — the audit is demonstrated catching a deliberately reintroduced second implementation before being trusted clean.
  5. The derivation adapts to each activity's own distance-advance interval rather than assuming a fixed window — this is now the strongest single argument for adaptivity, backed by direct recovery evidence rather than justification alone: a window scaled to 5059204779's own ~60s p90 advance interval (~150s) recovers it from 94.81% fast-mass / 30% coverage (fixed 20s window) to 1.22% fast-mass / 97% coverage, and 3647739864 / 4598855187 similarly resolve from 59.77%/40% and 42.57%/45% to 0.00%/100% and 0.00%/100% (windows ~230s/~248s respectively). Validated against at least the four measured interval profiles (medians 2s/16s/24s/60s, activities 4556693525/3647739864/4598855187/5059204779): a fixed-20s implementation is demonstrated failing on the 60s-median case (reproducing the 94.81%/30% distortion), while the shipped adaptive approach — window-width adapts to each activity's observed interval, or the derivation integrates across emission boundaries instead of a fixed time span — is demonstrated recovering it to the measured 1.22%/97% figures above. Whichever mechanism is chosen is recorded and justified against this archive's own evidence, per PACE-03, and separately validated against a constructed interval-session fixture whose smoothed output still resolves that session's own recorded fast/slow splits to within a stated tolerance.
  6. The fixture library is stratified and reusable: the library built for this phase is stratified across at least fēnix 6 Pro, Suunto 9, GPX, intervals.icu-only and no-device-name cases, and includes, by construction, a decimation-aliased stream, a recording gap, a multi-hour pause, an impossible-speed sample, and the pinned worked example — each verified present by name in the test suite, so Phases 27-30 compose them rather than rebuild them.
  7. A metadata-vs-stream pace cross-check flags material disagreement rather than displaying metadata as fact: activity 5059204779 (`moving_time: 1216`, `distance: 10804` → metadata `paceSecPerKm: 112.6`, i.e. 1:53/km, against the stream-derived 5:51/km) is flagged by the check, read directly from the dashboard/index output rather than inferred — demonstrated failing when the cross-check is removed, at which point the dashboard reverts to displaying 1:53/km as fact. The check's archive-wide flag count at the stated threshold (metadata implying a sustained pace faster than 3:20/km) is reported and is exactly 1 of 1,890 activities, showing the check does not over-fire across the rest of the archive.

  *Seven criteria, two over the 2-5 guideline. Criteria 2 and 3 could look mergeable (both gap-related) but are kept separate because they fail independently on inspection: gap-boundary clipping (2) can be correct while the coverage sum or its on-screen display (3) has its own, unrelated bug, and vice versa — merging would let one criterion's pass mask the other's failure. Criterion 7 (PACE-07's metadata cross-check) is a materially different failure mode from every other criterion here — metadata-vs-stream disagreement, not an internal derivation defect — and is kept separate rather than folded into Criterion 1 so its own singleton-flag-count evidence is not buried inside PACE-04/06's reduction narrative.*
**Plans**: 16 plans in 12 waves

Plans:
**Wave 1**

- [x] 26-01-PLAN.md — Shared module: segment-priority gap classification and exact coverage accounting (COV-01, PACE-02)
- [x] 26-03-PLAN.md — ERA-03 stratified fixture library, verified present by name (ERA-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 26-02-PLAN.md — Adaptive window, gap-clipped pace series, and the single pace+coverage entry point (PACE-02, PACE-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 26-04-PLAN.md — Collapse the chart and the histogram onto the shared derivation (PACE-01, PACE-04)
- [x] 26-07-PLAN.md — Metadata-vs-stream cross-check as an additive index flag (PACE-07)
- [x] 26-09-PLAN.md — Archive-wide residual report, its regenerating script, and two ROADMAP criterion corrections (PACE-04, PACE-06)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 26-06-PLAN.md — Always-on coverage caption and split gap marker plus legend (COV-02, PACE-05)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 26-05-PLAN.md — Single-source audit as a vitest test, demonstrated catching a planted second implementation (PACE-01)
- [x] 26-08-PLAN.md — Pace disputed badges on every surface, rebased splits baseline, no suppression (PACE-07)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 26-10-PLAN.md — Human browser checkpoint against a production-shaped build (COV-02, PACE-05, PACE-07)

**Wave 7** *(gap closure — 26-VERIFICATION.md `gaps_found`, 2026-09-09)*

- [x] 26-11-PLAN.md — Adjudicate WR-01 and itemise unbucketed covered time into an exact identity (COV-01)

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 26-12-PLAN.md — Decouple the always-on coverage caption from histogram bucket presence (COV-02)

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 26-13-PLAN.md — Round 2 browser checkpoint on activity 11865310195 and COV-01/COV-02 closure (COV-01, COV-02)

**Wave 10** *(gap closure — 26-VERIFICATION.md re-verification `gaps_found`, CR-03, 2026-09-09)*

- [x] 26-14-PLAN.md — Collapse the pace chart band onto the shared adaptive derivation; delete the coverage-less wrapper and its two false contract comments; extend the single-source audit to the object-shorthand override and demonstrate it failing (PACE-01, PACE-03, PACE-04)

**Wave 11** *(blocked on Wave 10 completion)*

- [x] 26-15-PLAN.md — CR-02: a stale index.json row with `paceDisagreement` absent must produce no badge and no TypeError (PACE-07)

**Wave 12** *(blocked on Wave 11 completion)*

- [x] 26-16-PLAN.md — Round 3 browser checkpoint pinning chart-vs-histogram extent to an independently derived value, and PACE-01 re-closure (PACE-01, PACE-03, PACE-04, PACE-07)

**UI hint**: yes

#### Phase 27: Per-Activity Quality Signals

**Goal**: Every activity carries computed, individually-disclosed quality signals (decimation ratio, impossible-sample count, gap profile, elapsed-vs-moving divergence, device era) — precomputed in CI, badged on the activity list and detail view, severity-calibrated against a measured archive-wide rate.
**Depends on**: Phase 26 (reuses its gap classifier for the gap-profile signal and its fixture library for device-era stratification)
**Requirements**: QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05, ERA-01, ERA-02
**Success Criteria** (what must be TRUE):

  1. Signals are computed in CI and disclosed individually: each activity's index row and per-activity shard carry the five named signals as separate fields (device era and decimation severity stay distinct even though they correlate), verified by inspecting `data/dashboard/index.json` and `data/stats/pace-quality/{id}.json` directly.
  2. Index stays additive, shard stays lazy: `DASHBOARD_INDEX_SCHEMA_VERSION` is unchanged before/after the addition, and the per-activity shard is fetched only when a detail view opens — verified by the network panel showing zero shard fetches on the activity-list view and exactly one fetch on open, mirroring the existing `best-efforts/{id}.json` pattern.
  3. Badges explain, not just mark: opening a real flagged activity's detail view in the browser shows a badge whose text names the detected condition and its measured value (e.g. "12% of elapsed time in recording gaps"), read directly off the rendered page.
  4. Severity is calibrated against a measured, independently re-derived archive-wide rate. **Original wording ("under ~5% (≈90 activities)" against a "1,864-activity archive") split into 4a/4b, amended 2026-09-10 per plan 27-03's developer disposition (`split-the-criterion`):** the original single clause is jointly unsatisfiable with D-01/D-02/D-04 — D-04 locks Phase 26's severe-decimation cohort verbatim at 154 activities, which alone measures 154/1,890 = 8.15% of the live archive, a floor that exceeds the ~5% (~95-activity) target by 59 activities before the other two tiering signals (gap profile, impossible samples) contribute anything, and D-02 forbids retuning any threshold backward from that target to close the gap. This is a criterion-wording defect, not a data or code defect; see `27-CALIBRATION.md` §5 and `27-03-SUMMARY.md` for the measured figures and the full disposition. The criterion is now:
     - **4a — GATE (pass/fail):** the composite rate is measured against a live denominator (recomputed at run time, never a hardcoded archive size); a standalone script counting top-tier flags from the shipped index reproduces the same count WITHOUT importing the classifier (D-03); and the criterion is demonstrated failing by moving a threshold and observing the measured composite rate move accordingly, in BOTH directions (strictly looser → rate strictly increases; strictly stricter → rate strictly decreases or holds at a stated, named floor).
     - **4b — REPORTED FINDING (no threshold gate):** the measured composite severe rate and its per-signal cohort breakdown are reported, not gated. Measured 2026-09-10 against the live archive (1,890 activities, 1,865 with a computable stream): composite (any severe signal) **299 activities — 15.8% of 1,890 activities, 16.0% of 1,865 streamed activities**; per-signal severe cohorts: decimation (D-04) 154 (8.1%), gap profile 127 (6.7%), impossible samples 31 (1.6%). A rate materially above ~5% is recorded as a finding under D-02, never silently retuned away.
  5. Device-family, not file-format, drives branching, and no-device-name is its own category: a fēnix 6 Pro FIT activity (0% `speed` field) and a Suunto 9 FIT activity (99.8% `speed` field) — same file format, different device family — get correctly differentiated device-era signals; sampled index rows from the 716-activity no-device-name cohort report their own explicit category, never a fabricated device name, demonstrated failing if that branch is deleted and a default silently takes over.

**Plans**: 10 plans in 6 waves

Plans:
**Wave 1**

- [x] 27-01-PLAN.md — pace-quality.ts type contract, device-era taxonomy (ERA-01/ERA-02), untiered facts, `unknown-device` collision resolved

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 27-02-PLAN.md — the three tiering signals, their mechanism-first thresholds, the composite predicate and the D-17 evidence shard

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 27-03-PLAN.md — archive-wide calibration dry run, threshold-sensitivity sweep, and the blocking checkpoint on the measured composite rate
- [x] 27-04-PLAN.md — required `quality` index field (schema version unchanged), per-activity shard writer, publish-time spot-checks

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 27-05-PLAN.md — D-03's independent recount reading only the shipped index, demonstrated failing on three mutations
- [x] 27-06-PLAN.md — lazy `pace-quality/{id}.json` shard client with D-18's instrumented fetch counter
- [x] 27-07-PLAN.md — `list.ts` badge-dispatch contract change plus the three severe-tier badges, existing badges pinned unregressed

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 27-08-PLAN.md — D-16's single "has any severe signal" filter, one URL param, no new sort key
- [x] 27-09-PLAN.md — always-on five-signal detail section and the one shard fetch in the existing mount point

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 27-10-PLAN.md — Round 1 human browser checkpoint (R1-R8) against a digest-verified build

**UI hint**: yes

#### Phase 28: PR Plausibility Ceiling

**Goal**: A personal plausibility ceiling, derived non-circularly from each athlete's own already-filtered effort history, demotes-and-flags implausible efforts from PR ranking — never deletes them — with an archive-wide before/after diff reviewed by a human before ship.
**Depends on**: Phase 27 (no functional coupling to the quality-signal fields themselves; sequenced after so the eventual review queue has quality context, per research's own ordering rationale — not a hard blocker)
**Requirements**: PR-01, PR-02, PR-03, PR-04, PR-05
**Success Criteria** (what must be TRUE):

  1. The three-pass structure is deterministic: running `compute-best-efforts.ts` twice against unchanged input produces byte-identical ceiling values and flags, verified by diffing two consecutive CI runs — demonstrated failing if Pass 2 is changed to iterate to convergence instead of running once.
  2. The ceiling is computed non-circularly: traced by test to read only from Pass 1's already-filtered array (post `isPlausible` + exclusion list), never the raw archive — a fixture where the unfiltered-population computation and the filtered-population computation diverge shows the shipped code producing the filtered result.
  3. The pinned regression case is rejected and the fix is validated archive-wide: activity 4556693525's 400m effort (45.2s, 8.85 m/s — value corrected 2026-09-10 against the live archive `data/stats/best-efforts.json` `rankings.400m[0]`; the earlier 44.0s/9.09 m/s figure did not match any record) is demonstrated rejected as a permanent regression fixture (test fails if the ceiling regresses to admit it), and the guard's effect is additionally reported across the full 662-activity impossible-sample cohort via a dry-run count — not the pinned fixture alone.
  4. Rejected efforts are demoted, never deleted: for every ceiling-rejected effort, the effort remains visible in that activity's own detail view (read directly in the browser, not merely present in JSON) with a stated demotion reason, absent only from the ranked PR list; a code audit confirms no path removes a flagged effort from `activities[id].efforts`, demonstrated failing if the filter is mutated to delete instead of flag.
  5. The archive-wide diff is a reviewed phase deliverable: a before/after PR diff (every record that changes hands) is generated from the real full archive and reviewed and signed off by the developer before the phase closes; its record count reconciles with the independently-derived ceiling-rejected count from criterion 3's dry run.

**Plans**: 15 plans (9 executed in 6 waves, plus 6 gap-closure plans in 3 waves)

Plans:
**Wave 1**

- [x] 28-01-PLAN.md — Measure the archive and choose the ceiling multiplier and minimum-population floor, recorded with justifying evidence in a regenerable calibration artifact (PR-02, PR-05)
- [x] 28-02-PLAN.md — The demotion data model plus the pure, DOM-free dashboard logic that reads it (PR-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 28-03-PLAN.md — The pure ceiling module, its fail-open branch, and the guard discriminator on isPlausible (PR-02, PR-03)
- [x] 28-04-PLAN.md — Render the demotion: spec-driven PR-flags cell, three-state Records empty copy, demoted badge style (PR-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 28-05-PLAN.md — Three-pass restructure of compute-best-efforts.ts, one shared demotion path, and the four demonstrated-failing regression suites (PR-01, PR-02, PR-03, PR-05)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 28-06-PLAN.md — Committed ceiling state, drift reporting, and one added glob on the existing CI commit step (PR-01, PR-04)
- [x] 28-07-PLAN.md — Archive-wide before/after PR diff computed from one snapshot, proven idempotent by a second run (PR-04)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 28-08-PLAN.md — Classifier-independent recount, the impossible-sample cohort dry-run, and the criterion 5 reconciliation (PR-04, PR-05)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 28-09-PLAN.md — Human browser checkpoint on rendered demotion evidence, and the PR-04 sign-off bound to the diff's content hash (PR-03, PR-04, PR-05)

**Gap closure: Wave 1** *(28-VERIFICATION.md gaps_found 2/5: CR-01, CR-02, WR-05)*

- [x] 28-10-PLAN.md — Recount checks every effort against the ceiling and fails on the pinned fixture; shown failing on the pre-fix archive (13 missing, 31 vs 18) (PR-04, PR-05)
- [x] 28-11-PLAN.md — CR-01 fix: the ceiling is applied to owner-excluded efforts; real-exclusion 4556693525 regression written first and seen failing (PR-01, PR-02, PR-03, PR-05)
- [x] 28-12-PLAN.md — Generator fixes: per-effort exclusion (WR-04), calibration population follows Pass 1 (WR-03), diff lists owner-excluded ceiling demotions (PR-02, PR-04)
- [x] 28-13-PLAN.md — Records copy names the guard responsible for each demotion (CR-02), This-year note (WR-01), dark badge contrast (WR-02), badge wording (IN-02) (PR-03)

**Gap closure: Wave 2** *(blocked on Wave 1)*

- [x] 28-14-PLAN.md — Regenerate best-efforts, 28-DIFF.md and calibration against the pinned snapshot; pre/post comparison and 31/31/31 reconciliation (PR-03, PR-04, PR-05)

**Gap closure: Wave 3** *(blocked on Wave 2)*

- [x] 28-15-PLAN.md — Round 2 human checkpoint (R3/R6 re-runs, precedence, contrast) and fresh PR-04 sign-off on the regenerated diff (PR-03, PR-04, PR-05)

**UI hint**: yes
**Browser checkpoint**: warranted — PR-03/PR-04 require a demoted effort to remain visibly present with its reason on the Records/detail screens rather than silently vanishing; this is exactly the class of defect (a check that only agrees with itself) the project's Phase 23 CR-01 lesson exists to guard against.

#### Phase 29: Curation Review Queue

**Goal**: Local curation mode surfaces ceiling-flagged efforts in a reviewable queue and lets the developer exclude them via the existing whole-activity write path — no new write surface, both publish guards still prove it absent from the published bundle.
**Depends on**: Phase 28 (hard dependency — nothing to review without ceiling-rejected efforts existing)
**Requirements**: CUR-01, CUR-02, CUR-03
**Success Criteria** (what must be TRUE):

  1. The queue surfaces flagged activities without hunting: in `npm run curate`, a queue view lists activities carrying a real ceiling-flagged effort from Phase 28's actual archive output, reachable via one navigation action; the listed set matches Phase 28's independently-derived flagged set exactly, not merely "some rows appear."
  2. Exclusion reuses the existing write path: exercising the queue's exclude action writes to `best-effort-exclusions.json` via `curate-server.mjs`'s existing trusted-origin check, atomic write, and activity-id validation; a request from an untrusted origin is rejected, demonstrated failing if a parallel write surface is substituted instead.
  3. Both publish guards discriminate in both directions on the new routes: `curation-guard.mjs`'s build-time scan and `verify-dashboard-publish.mjs`'s HTTP-layer assertion are both demonstrated failing (red) when the new review-queue route/content is deliberately leaked into `dist/widgets`, and both demonstrated passing (green) against a correct build.

**Plans**: 8 plans in 5 waves

Plans:
**Wave 1**

- [x] 29-01-PLAN.md — Build-time guard: IN-17 one-path-one-violation fix + planted queue-leak fixtures (D-18/D-19)
- [x] 29-02-PLAN.md — HTTP guard: two literal 404 assertions for the new routes, planted-leak Cases E/F, IN-18 (D-17/D-19)
- [x] 29-03-PLAN.md — Independent recount gains an all-guards activity count and its --expect pin (D-16)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 29-04-PLAN.md — Pure flagged-set derivation (D-01..D-05, D-11, D-12) cross-checked against the recount

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 29-05-PLAN.md — Queue page client: rows, header counts, inline exclude control, Recompute (D-08..D-15)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 29-06-PLAN.md — curate-server: gated /__curate/queue and /__curate/queue.js routes, bundle step, startup log (D-06/D-07/D-09)
- [x] 29-07-PLAN.md — Overlay nav-link entry point + queue client source-structure guard (D-07/D-10)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 29-08-PLAN.md — Human browser checkpoint: rendered extent vs independent count, write path, origin rejection

**UI hint**: yes
**Browser checkpoint**: warranted — directly extends the Phase 24 local curation UI, which this project's own convention ends on a human browser checkpoint every time.

#### Phase 30: Elevation Quality Signal

**Goal**: Implausible altitude is flagged archive-wide by three independent mechanisms (sub-ground-level, barometric closure drift, implausible vertical rate) spanning all device families — flag only, no correction.
**Depends on**: Phase 26 (reuses its fixture-library and archive-wide dry-run validation conventions; otherwise functionally independent of Phases 27-29 and could execute in parallel with Phase 27 if desired)
**Requirements**: ELEV-01, ELEV-02
**Success Criteria** (what must be TRUE):

  1. All three modes are detected archive-wide: a dry-run report over the full committed archive independently reproduces at least the 11 sub-ground-level activities (worst: −282 m, Lisbon), at least the 21 loop-gated barometric-closure-drift activities (start/end within the derived 100 m loop radius differing >60 m, worst 198 m), and at least the 39 implausible-vertical-rate activities — each count read from the report, not inferred from the detector's own self-description. *(D-04 correction, `30-CALIBRATION.md`: the original "34" was a raw start/end altitude difference measured WITHOUT the loop condition; it decomposes into 21 loop-gated + 12 point-to-point + 1 no-position. The 12 point-to-point activities are excluded by design — their endpoints are 626 m–9,584 m apart, and a real 60–90 m altitude change is plausible between endpoints kilometres apart. See `30-CALIBRATION.md` § Correction of the raw-difference count (D-04).)*
  2. Mode-independence is demonstrated, not assumed: the barometric-closure-drift and sub-ground-level flagged-ID lists from criterion 1 are shown substantially non-overlapping — proving a floor-bound check alone could not have caught the drift cohort — and each detector is demonstrated failing (flags nothing) when its own mode's injected fixture is removed.
  3. Flag rate reconciles archive-wide and nothing is corrected: the report's total flagged count reconciles with the measured 60-activity (3.2%) LOOP-GATED cohort, AND separately shows how the raw-definition 71-activity (3.8%) union — the requirement's originally-measured figure — decomposes against it, so the correction is visible rather than silent (see `30-CALIBRATION.md` § Overlap matrix (loop-gated) and § Mode independence (Criterion 2)); sampled across all four named device families (Suunto 9 46, Garmin fēnix 6 Pro 11, no device name 2, vívoactive 4 1, loop-gated breakdown); a code/behavior audit confirms `data/streams/` files are byte-unchanged after running the detector — flag only, no DEM lookup, no correction, no grade-adjusted pace.

**Plans**: 8 plans in 4 waves

Plans:
**Wave 1**

- [x] 30-01-PLAN.md — Elevation detector core: three total detectors, the derived loop radius, three single-mode synthetic fixtures, and elevation as the sixth signal with `anySevere` provably unchanged (ELEV-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 30-02-PLAN.md — Pinned real exemplars (4556693525, 4745489664, 3149636661) re-verified against the live archive through the total `expected`-key switch (ELEV-02)
- [x] 30-03-PLAN.md — Index wiring, tolerant client parse, and a publish gate that fails on a partial elevation rollout (ELEV-01, ELEV-02)
- [x] 30-04-PLAN.md — Archive-wide calibration report with the derived loop radius, the stream digest, and the D-04 correction of ROADMAP Criteria 1/3 and ELEV-01 (ELEV-01, ELEV-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 30-05-PLAN.md — One severe-only elevation badge per row on all three surfaces, plus the Elevation Gain stat-card caveat (ELEV-01)
- [x] 30-06-PLAN.md — Three always-on elevation lines on the detail view, with the drift line's four phrasings (ELEV-01)
- [x] 30-07-PLAN.md — Independent elevation recount from the shipped index, and the Phase 27 composite proved byte-stable (ELEV-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 30-08-PLAN.md — Human browser checkpoint against a digest-verified build, including elevation's visible absence from the severe filter (ELEV-01, ELEV-02)

**UI hint**: yes
**Browser checkpoint**: not strictly warranted on its own — this phase is a compute-layer detector with no new interactive surface; if its badge rendering reuses Phase 27's already-checkpointed badge component, a lightweight visual spot-check folded into Phase 27's or Phase 29's checkpoint session is sufficient rather than a dedicated round.

## Progress

#### Phase 31: Tech-Debt Closure — Silent-Failure Guards & Docs Reconciliation

**Goal**: The v2.2 close-out audit (`.planning/v2.2-MILESTONE-AUDIT.md`, status `tech_debt`) found no requirement gap but ~30 advisory items, five of which share the failure shape this project's own lessons single out — silent and passing. This phase closes those five at the source, each with a demonstrated-failing test, and reconciles every stale figure the milestone left in its own artifacts, so the milestone can be completed on a record that matches the code.
**Depends on**: Phase 30 (last v2.2 phase; runs against the merged 1,899-activity archive pushed 2026-09-19)
**Requirements**: TD-01, TD-02, TD-03, TD-04, TD-05, TD-06 (minted 2026-09-19 in REQUIREMENTS.md § v2.2 Tech-Debt Closure; one per success criterion below)
**Success Criteria** (what must be TRUE):
  1. `npm test` no longer depends on the live, owner-editable `data/best-effort-exclusions.json` for the four CR-01 regression tests in `compute-best-efforts.test.ts` (28 WR-09) — a curation edit cannot turn the nightly deploy gate red; demonstrated by editing a fixture copy, not the real file.
  2. `scripts/lib/copy-data-tree.mjs`'s mtime skip can no longer leave a locally-edited `dist/widgets/data/` file in place while `build-widgets` reports success (26 deferred) — either content-digest comparison or a `--force` path that checkpoint staging uses; demonstrated failing on a doctored file.
  3. `deriveFlaggedActivities` and `recountDemotedActivities` agree, or fail loudly, on a malformed exclusions file (29 WR-02: duplicates, `reason: null`, `__proto__`); `records-logic.ts` no longer silently folds an unrecognized `demotion.guard` into the total (28 integration observation) — both with negative tests.
  4. The demotion reason string shows the margin when implied speed and ceiling round to the same 2-dp value (post-merge observation: "4.63 m/s exceeds personal ceiling 4.63 m/s").
  5. Every stale figure named by the audit is reconciled in place and its generator fixed where one exists: REQUIREMENTS.md PACE-06 "13 → 14", ERA-02 "716/1,864 → 663/1,890" (ROADMAP Criterion 5 too), PR-03/04/05 "pending phase re-verification" wording, `compute-pace-residual.mjs` manifest miscount (27 G-03), `compute-pr-ceiling-calibration.mjs` hard-coded "400m shows the largest drift" prose and unlabelled non-excluded "Demoted" column (28 WR-07/WR-08), and 27 G-01's calibration-report regenerability — proven by regenerating each artifact twice, not by a hand edit.
  6. 29-VALIDATION.md (and 26/27 where still pending) reflects execution — `/gsd-validate-phase` output or equivalent — so no v2.2 phase carries a pre-execution validation record into the archive.
**Out of scope (recorded so they are not re-litigated):** 28 WR-06's opt-in ceiling-file write gate (developer decision on a D-07 mechanism), CUR-04 queue dismiss action (Future Requirements), 26 F-26-02 histogram tails (developer: not a priority), 30 WR-02/WR-03 badge wording (product decisions, checkpoint-blessed), the `index-client.ts` `ParsedDashboardIndexRow` retype (phase-sized; consider for v2.3).
**Plans**: 10 plans in 4 waves (planned 2026-09-19)

Plans:
- [ ] 31-01-PLAN.md — TD-01: decouple the four CR-01 tests from the live exclusions file onto a committed fixture, keeping one premise-only live read (wave 1)
- [ ] 31-02-PLAN.md — TD-02: replace `copyJsonTree`'s mtime skip with size-then-digest and log stale replacements (wave 1)
- [ ] 31-03-PLAN.md — TD-03a/b: `other` bucket in the Records sentence; recount fails closed on four malformed-exclusion classes (wave 1)
- [ ] 31-04-PLAN.md — TD-03c: the curation queue counts and renders the entries it ignored (wave 1)
- [ ] 31-05-PLAN.md — TD-04: the ceiling demotion reason states its margin at three decimals (wave 1)
- [ ] 31-06-PLAN.md — TD-05: shared `isStreamFile` in `scripts/lib/`; residual sweep stops counting `manifest.json` (27 G-03) (wave 1)
- [ ] 31-07-PLAN.md — TD-05: data-derived largest-drift sentence (28 WR-07) and a reconciled Demoted column (28 WR-08) (wave 1)
- [ ] 31-08-PLAN.md — TD-05: regenerate all five artifacts of record twice in dependency order, prove idempotence, commit (wave 2)
- [ ] 31-09-PLAN.md — TD-05/TD-06: re-measure and correct every stale figure in place with dated notes; close G-01 in the audit and flip 27-VALIDATION.md to passed (wave 3)
- [ ] 31-10-PLAN.md — TD-05: blocking PR-04 Round 4 re-sign against the regenerated `28-DIFF.md` sha256 (wave 4)
**UI hint**: no (compute/test/tooling/docs only; no new interactive surface)

**Execution Order:**
Phases execute in numeric order: 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26 → 27 → 28 → 29 → 30

**v2.1 parallelization note:** Phase 23 (Trends) carries no dependency on the screen-styling work in Phases 20-22 and may execute in parallel with them once Phase 19 (Design System) is complete. Phase 24 (Local Curation Mode) similarly only depends on Phase 19.

**v2.2 parallelization note:** Phase 30 (Elevation) needs only committed altitude data and carries no functional dependency on Phases 27-29 — it may execute in parallel with Phase 27 once Phase 26 (shared derivation + fixture library) lands. Phase 29 (Curation Review Queue) hard-depends on Phase 28's flagged efforts existing and cannot start before it.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-02-14 |
| 2. Analytics | v1.0 | 2/2 | Complete | 2026-02-14 |
| 3. Widgets | v1.0 | 4/4 | Complete | 2026-02-14 |
| 4. Pipeline | v1.0 | 1/1 | Complete | 2026-02-14 |
| 5. Geocoding Infrastructure | v1.1 | 1/1 | Complete | 2026-02-15 |
| 6. Geographic Statistics | v1.1 | 2/2 | Complete | 2026-02-15 |
| 7. Widget Attribute System | v1.1 | 3/3 | Complete | 2026-02-15 |
| 8. Geographic Table Widget | v1.1 | 2/2 | Complete | 2026-02-15 |
| 9. CI/CD Integration | v1.1 | 2/2 | Complete | 2026-02-16 |
| 10. Geocoding Foundation & Map Infrastructure | v1.2 | 4/4 | Complete | 2026-02-17 |
| 11. Route Map Widgets | v1.2 | 3/3 | Complete | 2026-02-17 |
| 12. Heatmap & Pin Map Widgets | v1.2 | 2/2 | Complete | 2026-02-17 |
| 13. Standalone Pages | v1.2 | 2/2 | Complete | 2026-02-18 |
| 14. Stream Ingestion Foundation | v2.0 | 5/5 | Complete    | 2026-08-10 |
| 15. Best-Effort Engine | v2.0 | 4/4 | Complete    | 2026-08-10 |
| 16. Dashboard Shell & Data Contract | v2.0 | 16/16 | Complete    | 2026-08-11 |
| 17. Activity Browser & Detail Views | v2.0 | 15/15 | Complete    | 2026-08-11 |
| 18. Records, Trends & Differentiators | v2.0 | 16/16 | Complete    | 2026-08-12 |
| 19. Design System & Control Styling | v2.1 | 17/17 | Complete    | 2026-08-13 |
| 20. Row-Click Interaction Pattern | v2.1 | 20/20 | Complete    | 2026-08-18 |
| 21. Overview Rebuild | v2.1 | 8/8 | Complete    | 2026-08-18 |
| 22. Calendar Week-Start & Totals | v2.1 | 16/16 | Complete    | 2026-08-19 |
| 23. Trends Zoom, Pan & Taller Bands | v2.1 | 13/13 | Complete    | 2026-08-27 |
| 24. Local Curation Mode | v2.1 | 17/17 | Complete    | 2026-09-02 |
| 25. CI Hardening & Light-Theme Verification | v2.1 | 12/12 | Complete    | 2026-09-04 |
| 26. Shared Gap-Aware Pace Derivation & Honest Coverage | v2.2 | 16/16 | Complete    | 2026-09-10 |
| 27. Per-Activity Quality Signals | v2.2 | 12/12 | Complete    | 2026-09-10 |
| 28. PR Plausibility Ceiling | v2.2 | 15/15 | Complete    | 2026-09-17 |
| 29. Curation Review Queue | v2.2 | 8/8 | Complete    | 2026-09-18 |
| 30. Elevation Quality Signal | v2.2 | 8/8 | Complete    | 2026-09-18 |
| 31. Tech-Debt Closure — Silent-Failure Guards & Docs Reconciliation | v2.2 | 0/10 | Planned | — |

*Last updated: 2026-09-08 — **v2.2 Pace Data Quality** roadmap created: 5 phases (26-30), 27/27 requirements mapped. PACE-06 and PACE-07 were added after the initial draft, both folded into Phase 26 alongside the rest of PACE: PACE-06 quantifies the residue adaptive windowing does not fix (13/154, all marginal 0.5-2.4%, genuine device over-measurement — an earlier measurement wrongly called three of those activities "beyond repair" using a fixed-window artifact; corrected once adaptivity was applied), and PACE-07 catches a live singleton defect where activity 5059204779's metadata (`moving_time`/`distance`) implies 1:53/km while its own stream derives 5:51/km. Phase order follows the research-converged sequence (shared derivation → quality signals → PR ceiling → review queue → elevation), with two hard constraints carried from PROJECT.md: the PR ceiling (Phase 28) demotes-and-flags only, never deletes, and its archive-wide before/after diff is a required reviewed deliverable, not optional polish. ERA-03 (stratified fixture library) is folded into Phase 26 rather than a standalone phase, and ERA-01/ERA-02 (device-family branching) are folded into Phase 27 — both per research/SUMMARY.md's explicit recommendation that cross-era discipline is a standing convention every threshold-introducing phase reuses, not a phase of its own.*

*Previously: 2026-09-05 — **v2.1 Interface Polish shipped**: 7 phases (19-25), 103 plans, 25/25 requirements. Full phase details archived to `milestones/v2.1-ROADMAP.md`; requirements to `milestones/v2.1-REQUIREMENTS.md`. Phase 22 was re-verified at close (`passed` 8/8, superseding a stale `gaps_found` report that predated its own Round 4 gap-closure). v1.0-v2.0 remain collapsed above.*
