# Requirements: Strava Analytics & Visualization Platform — v2.2 Pace Data Quality

**Defined:** 2026-09-08
**Core Value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.

**Milestone goal:** Make every pace figure the dashboard derives honest — one gap-aware derivation, plausibility guards that actually bind, and per-activity quality signals you can see — without rewriting a single committed stream.

**Scoped from measurement, not preference.** Every requirement below traces to a number measured against the live 1,864-activity archive during scoping, or to a finding in `.planning/research/`. The numbers are recorded inline so a future reader can tell whether a requirement still applies.

**Named activities are exemplars, never the scope.** Activity `4556693525` recurs below because it was the run investigated in depth during scoping, and it is useful precisely because it is legible. It is not a target. Every requirement that names an activity means *the class of defect that activity exemplifies*, sized by its own measured cohort, and is satisfied only when the mechanism is addressed archive-wide. A fix that resolves a named activity while leaving its cohort untouched fails the requirement. Where a specific activity is genuinely the deliverable — a pinned regression fixture — that is stated explicitly.

---

## v2.2 Requirements

### Pace derivation (PACE)

- [x] **PACE-01**: All stream-derived pace in the dashboard comes from one shared module in `src/analytics/`, imported by both `detail-charts-logic.ts` and `detail-zones.ts` — no call site computes `dt / (dd / 1000)` independently.
- [x] **PACE-02**: A pace-averaging window never bridges a recording or pause gap; it clips at the gap boundary instead, so no pace value is manufactured across a period with no samples.
- [x] **PACE-03**: The smoothing window is justified from this archive's own evidence and the justification is recorded, because no industry standard exists to adopt (FEATURES.md: only Strava and Garmin publish anything, both vague; Garmin Connect's web chart has no smoothing at all). **A single fixed window is already disproven by measurement and must not be assumed:** each activity's distance-advance interval — the gap between successive increases in `d`, which is what the window must average over — varies by a factor of ~30 across the archive:

  | activity | median | p90 | p99 | max | advances |
  |---|---|---|---|---|---|
  | 4556693525 | 2s | 4s | 6s | 18s | 1,198 |
  | 3647739864 | 16s | 92s | 185s | 212s | 146 |
  | 4598855187 | 24s | 99s | 168s | 195s | 182 |
  | 5059204779 | 60s | 60s | 120s | 120s | 58 |

  A 20s window averages the first activity's stair-step out cleanly and fails badly on the last, where the device emitted distance once per minute — a 20s window there either sees zero distance or a full minute's worth compressed into 20s, reading ~3× too fast. The window must therefore adapt to each activity's own observed emission interval, or the derivation must integrate across emission boundaries rather than a fixed time span. Which of those it is, is a Phase 26 design decision; that a bare constant is insufficient is settled.

- [x] **PACE-04**: The pace-distribution histogram routes through the shared derivation, eliminating the phantom fast mode across the archive — not on one activity. The mechanism is decimation aliasing, whose measured cohort is **995 of 1,864 activities (53%)** degraded, of which **154 are severe** (>15% zero-distance samples). Verified on a device-era-stratified sample, with activity 4556693525 as one pinned exemplar (its raw 2:30–3:30 cluster, 8:15–8:30 and 11:00 buckets resolving to one distribution centred 5:00–6:15), never as the sole evidence.
- [x] **PACE-05**: Per-km splits mark any split whose window contains a recording or pause gap, so a slow split reads as "paused mid-km" rather than as a bad kilometre. Splits' own arithmetic is already correct and is not changed.
- [x] **PACE-06**: The residue that adaptive windowing does *not* fix is quantified and handed to flagging, never smoothed into plausibility. Measured with a window scaled to each activity's own advance interval, **14 of the 154** severe stair-step activities retain ≥0.5% of covered time below 3:00/km, all marginal (0.51–2.44%) — these are genuine device over-measurement, the category that must be flagged rather than corrected. The residual set is enumerated by ID and percentage as a deliverable. *Corrected 2026-09-19: was 13 of the 154 (0.5–2.4%); live figure read off the regenerated `26-RESIDUAL.md` (31-08, merged 1,899-activity archive) is 14 of the 154 (0.51–2.44%) — the same cross-plan integration repair already recorded at ROADMAP.md's Phase 26 Criterion 1 (Phase 30 D-04 house style).*

  *Correction, recorded so the reasoning is not repeated:* an earlier draft claimed three of these were catastrophically broken (94.8%, 59.8%, 42.6% fast mass) and beyond derived-layer repair. That was an artifact of the measurement, not the data — a fixed 20s window applied to watches emitting distance every 60–99s. Under a window scaled to the observed interval those three read 1.22%, 0.00% and 0.00%, with coverage rising from 30/40/45% to 97/100/100%. Their streams were always sound: 5059204779 derives 5:51/km with splits of 7:05, 5:00, 6:00, 6:00, 6:00, 7:00, 5:00, 6:00, 6:00, 6:00. This is direct evidence for PACE-03's adaptive requirement, and a caution that a derivation artifact can masquerade as a data defect.

- [x] **PACE-07**: Where an activity's metadata-derived pace and its stream-derived pace disagree materially, the disagreement is detected and surfaced rather than displayed as fact. **This is a live, visible defect:** activity 5059204779 carries `moving_time: 1216` against `distance: 10804`, so `data/dashboard/index.json` holds `paceSecPerKm: 112.6` and the dashboard currently shows **1:53/km** for a run whose own stream derives **5:51/km**. Archive-wide this is a singleton (1 of 1,890 activities implies a sustained pace faster than 3:20/km from its metadata), which is precisely why a cheap cross-check is worth having: nothing else in the system would ever have caught it.

### Honest coverage (COV)

- [x] **COV-01**: For any derived pace series, covered time plus excluded time — itemised by named exclusion category — sums exactly to the stream's elapsed time. Asserted by test, watched failing against the real defect before being trusted.
- [x] **COV-02**: Coverage is visible to the reader wherever a derived distribution is shown, not merely correct internally. The shipped histogram today claims its buckets sum to elapsed time while covering 72% of it on the worked example.

### Per-activity quality signals (QUAL)

- [x] **QUAL-01**: Each activity carries computed quality signals — decimation/stair-step ratio, physically-impossible-sample count, gap profile, elapsed-vs-moving divergence, device era — produced by a CI compute step, never derived in the browser. *Discharged by automated artifact inspection, ticked 2026-09-10: `27-04-SUMMARY.md` (`data/dashboard/index.json` + per-activity `data/stats/pace-quality/{id}.json` shard fields) and `npx vitest run src/analytics/pace-quality.test.ts`.*
- [x] **QUAL-02**: Signals are disclosed individually rather than collapsed into one opaque score. Device era and decimation severity in particular stay separate signals: they correlate (all 154 severe stair-step activities are 2020–2021 Suunto 9) but decimation, not the device, is the mechanism. *Discharged by automated artifact inspection, ticked 2026-09-10: `27-02-SUMMARY.md`, `npx vitest run src/analytics/pace-quality.test.ts src/analytics/best-effort-utils.test.ts` (97/97 passed), device era and decimation severity asserted as independently-present separate fields.*
- [x] **QUAL-03**: Compact quality scalars are added additively to the dashboard index row so the activity list can badge, sort and filter by them; detailed per-sample findings live in a lazily-fetched per-activity shard, mirroring the existing `best-efforts/{id}.json` pattern. *Ticked 2026-09-10 on plan 27-10's Round 1 Checkpoint R2/R3/R6, all PASS — see `27-VALIDATION.md` § Round 1 Checkpoint.*
- [x] **QUAL-04**: Quality badges appear on the activity detail view, explaining rather than merely marking — a badge says what was detected and why it matters. *Ticked 2026-09-10 on plan 27-10's Round 1 Checkpoint R4/R5, both PASS — see `27-VALIDATION.md` § Round 1 Checkpoint.*
- [x] **QUAL-05**: Severity tiers are calibrated against an archive-wide dry run before ship, targeting a top tier under ~5% of activities (≈90 of 1,864). The measured flag rate per tier is reported and justified; a top tier materially above that target is a calibration failure, not an acceptable outcome. *Ticked 2026-09-10 on plan 27-10's Round 1 Checkpoint R6/R7, both PASS, with a stated caveat — see `27-VALIDATION.md` § Round 1 Checkpoint / Gap-Closure Record G-01. The tick reflects the measured composite (299) and the bidirectional threshold-sensitivity table, both reproduced independently; it does NOT claim `27-CALIBRATION.md` is currently regenerable byte-identical (G-01, open). QUAL-05's own recorded tension with the ~5% target, below, remains open by design per 27-03's `split-the-criterion` disposition.*

  *Restated against the live archive, 2026-09-10 (plan 27-03's calibration run, `27-CALIBRATION.md`), per D-02 — a reported finding, not a retune:* the "≈90 of 1,864" figure is stale; the live archive is 1,890 activities (1,865 with a computable stream), and ~5% of 1,890 is ≈95 activities, not ≈90. The measured composite top-tier rate is **299 activities — 15.8% of 1,890, 16.0% of 1,865 streamed** — reproduced three independent ways (this plan's classifier sweep, plan 27-04's classifier-independent recount of the shipped index, and the orchestrator's post-merge `compute-dashboard-index` run; see `27-03-SUMMARY.md`). D-04 locks Phase 26's severe-decimation cohort verbatim at 154 activities (8.15% of 1,890), which alone already exceeds the ~95-activity target before the other two tiering signals contribute anything, and D-02 forbids retuning any threshold backward from the target to close that gap. **This requirement's own language — "a top tier materially above that target is a calibration failure" — therefore stands in direct, recorded tension with the measured 15.8%/16.0% rate.** That tension is not dissolved here by moving the ~5% figure or by narrowing D-04's decimation rule: QUAL-05's concern is preserved as a live finding about this archive (see ROADMAP Phase 27 Criterion 4b), and Criterion 4's pass/fail gate (4a) is scoped to what is independently verifiable — the live denominator, the classifier-independent recount, and the threshold's proven bidirectional responsiveness — rather than to the rate's absolute value.

### PR plausibility (PR)

- [x] **PR-01**: `compute-best-efforts.ts` runs a strict three-pass shape — accumulate, derive ceiling, then filter-and-flag — with no iteration to convergence, so CI output is deterministic and reproducible.
- [x] **PR-02**: A personal plausibility ceiling is derived per target distance from the population *already* filtered by the existing absolute guard and exclusion list, never from the raw archive. Computing it over unfiltered data reproduces the exact circularity that lets today's guard admit a 44.0s 400m. ***D-04 resolved note:** the "44.0s" 400m figure (and PR-05's "9.09 m/s") for activity 4556693525 is stale — the live archive reads `durationSec: 45.2` / `paceSecPerKm: 112.9` → 8.85 m/s (`data/stats/best-efforts.json`, `rankings.400m[0]` at planning time; the committed shard `data/stats/best-efforts/4556693525.json`); ROADMAP.md criterion 3 was corrected on 2026-09-10. This requirement is not ticked by plan 28-09; the note only reconciles the cited value and leaves the stale figure legible.*
- [x] **PR-03**: An effort exceeding the ceiling is flagged and demoted from ranking — never deleted, never silently removed from the archive, and always visible with the reason it was demoted. *Ticked 2026-09-16 on plan 28-09's Round 1 Checkpoint R2/R3/R5/R6, blanket PASS (developer: "approved") — see `28-VALIDATION.md` § Round 1 Outcome. R4 (ceiling-emptied table) was NOT EXERCISABLE on the live archive; R6's note-wording sub-finding is carried forward as an open observation.* *REOPENED 2026-09-16 (same day), at the developer's direction, after phase verification returned `gaps_found` 2/5 — see `28-VERIFICATION.md` and `28-REVIEW.md` CR-01: the ceiling check is never applied to owner-excluded efforts (13 over-ceiling efforts in the shipped document carry `demotion: null`, including 4556693525 at 400m and 1k). The Round 1 checkpoint evidence above was earned but is no longer sufficient. Criterion 4 (every ceiling-rejected effort visible with its reason) failed.* *Re-ticked 2026-09-17 on Round 2 (28-15), per-row PASS — see 28-VALIDATION.md § Round 2 Outcome; verified by `28-VERIFICATION.md` (2026-09-17T10:15Z, `status: passed`, 5/5, superseding the earlier `gaps_found` 2/5, `gaps_remaining: []`).* *Corrected 2026-09-19: was "pending phase re-verification" — the re-verification named above landed the same day (2026-09-17) this wording was written and was never propagated back into this line.*
- [x] **PR-04**: An archive-wide before/after PR diff is produced and reviewed by a human before ship, showing every record that changes hands. A PR moving without the owner seeing it is a milestone failure. *Ticked 2026-09-16 on plan 28-09's R7, blanket PASS (developer: "approved"); sign-off bound to `28-DIFF.md` sha256 `08e93d5adec6ee3de886ab8b47ac0d4a48e001847e331c18830a812f546f77c6` — see `28-VALIDATION.md` § PR-04 Sign-off (D-14).* *REOPENED 2026-09-16 (same day), at the developer's direction, after phase verification returned `gaps_found` 2/5 — see `28-VERIFICATION.md` and `28-REVIEW.md` CR-01: the ceiling check is never applied to owner-excluded efforts (13 over-ceiling efforts in the shipped document carry `demotion: null`, including 4556693525 at 400m and 1k). The Round 1 checkpoint evidence above was earned but is no longer sufficient. The sign-off was bound to a `28-DIFF.md` that must be regenerated once CR-01 is fixed; a fresh sign-off against the corrected diff is required.* *Re-ticked 2026-09-17 on Round 2 (28-15), per-row PASS — see 28-VALIDATION.md § Round 2 Outcome; verified by `28-VERIFICATION.md` (2026-09-17T10:15Z, `status: passed`, 5/5, superseding the earlier `gaps_found` 2/5, `gaps_remaining: []`).* *Corrected 2026-09-19: was "pending phase re-verification" — the re-verification named above landed the same day (2026-09-17) this wording was written and was never propagated back into this line.*
- [x] **PR-05**: The sharpened guard is validated against the whole archive, not one case. The population needing it is the **662 activities (36%) carrying at least one sample faster than the 100m world record**, spread across every device and every year. Activity 4556693525's 400m effort (44.0s, 9.09 m/s, passing under the 9.30 m/s ceiling) is pinned as a permanent regression fixture — here the specific activity *is* the deliverable, since a fixture's job is to be specific — and the guard must be demonstrated rejecting it and must fail if the ceiling regresses. Passing that fixture alone does not satisfy this requirement. *Ticked 2026-09-16 on plan 28-09's Round 1 Checkpoint (blanket PASS, developer: "approved") with the archive-wide recount (`scripts/compute-pr-ceiling-recount.mjs`: 662 of 1,890 cohort, 52 demoted, 18 by the ceiling). **D-04 resolved note:** the "44.0s" 400m figure (and PR-05's "9.09 m/s") for activity 4556693525 is stale — the live archive reads `durationSec: 45.2` / `paceSecPerKm: 112.9` → 8.85 m/s (`data/stats/best-efforts.json`, `rankings.400m[0]` at planning time; the committed shard `data/stats/best-efforts/4556693525.json`); ROADMAP.md criterion 3 was corrected on 2026-09-10. The tick is NOT contingent on the stale 44.0s/9.09 m/s figure (nor the 9.30 m/s value, which is the world-record guard's threshold); the corrected figure is 45.2s/8.85 m/s. **Caveat, not fixed here:** in the shipped document the real activity 4556693525 carries `demotion: null` and is kept off the rankings by the manual exclusion list, not by a guard — the guard rejection and its demonstrated-failing regression are shown by the synthetic fixture `src/analytics/compute-best-efforts.test.ts:687`; see `28-VALIDATION.md` § Round 1 Outcome (c).* *REOPENED 2026-09-16 (same day), at the developer's direction, after phase verification returned `gaps_found` 2/5 — see `28-VERIFICATION.md` and `28-REVIEW.md` CR-01: the ceiling check is never applied to owner-excluded efforts (13 over-ceiling efforts in the shipped document carry `demotion: null`, including 4556693525 at 400m and 1k). The Round 1 checkpoint evidence above was earned but is no longer sufficient. Criterion 3 (the pinned fixture rejected by the guard as shipped) failed.* *Re-ticked 2026-09-17 on Round 2 (28-15), per-row PASS — see 28-VALIDATION.md § Round 2 Outcome; verified by `28-VERIFICATION.md` (2026-09-17T10:15Z, `status: passed`, 5/5, superseding the earlier `gaps_found` 2/5, `gaps_remaining: []`).* *Corrected 2026-09-19: was "pending phase re-verification" — the re-verification named above landed the same day (2026-09-17) this wording was written and was never propagated back into this line.*

### Curation review queue (CUR)

- [x] **CUR-01**: Local curation mode presents a queue of flagged activities, reachable without hunting through the archive, with one action: exclude the activity from PRs via the existing whole-activity `best-effort-exclusions.json` path. *Known limitation, accepted deliberately: with no dismiss action the queue is not drainable — an activity reviewed and judged fine remains listed. A dismiss/acknowledge action is the natural follow-up if this becomes annoying in use.* *Ticked 2026-09-18 on plan 29-08's Task 2 checkpoint, blanket PASS (R1-R5 all PASS, developer approved) — see `29-08-SUMMARY.md` § Checkpoint Verdicts.*
- [x] **CUR-02**: The queue reuses the existing `curate-server.mjs` write machinery (trusted-origin check, atomic write, activity-id validation) rather than introducing a parallel write surface. *Ticked 2026-09-18 on plan 29-08's Task 2 checkpoint, R7/R8 both PASS (write-through-existing-path and cross-origin rejection confirmed live) — see `29-08-SUMMARY.md` § Checkpoint Verdicts.*
- [x] **CUR-03**: Both publish guards continue to prove the curation write path absent from the published bundle, with the new routes covered — verified by the build-time content scan and the HTTP-layer assertion, each demonstrated failing if the path leaks. *Ticked 2026-09-18 on plan 29-08's Task 2 checkpoint, R10 PASS (digests matched, `findCurationArtifacts` empty, `npm test`/`build-widgets`/`verify-dashboard` green on the served build) — see `29-08-SUMMARY.md` § Checkpoint Verdicts.*

### Elevation quality signal (ELEV)

- [x] **ELEV-01**: Implausible altitude is detected and flagged archive-wide by *mechanism*, not by a single bound. Measured cohort (loop-gated, as the shipped detector actually flags): **60 activities (3.2%)** carry at least one anomaly, spanning all device families (Suunto 9 46, Garmin fēnix 6 Pro 11, no device name 2, vívoactive 4 1) — this is not one device's quirk. At least these three modes are detected, because they catch largely different activities:
  - **Sub-ground-level readings** — 11 activities below −50 m, worst being a sea-level Lisbon run at −282 m. Passes today because `derive-stream.ts` sets `ALT_MIN = -500`.
  - **Barometric closure drift (loop-gated)** — 21 activities whose start and end altitudes differ by >60 m despite returning to the same place (start/end within the derived 100 m loop radius, tested via activity metadata `start_latlng`/`end_latlng`), worst at 198 m. This is the largest single-mode cohort and a simple floor bound cannot catch any of it. *(D-04 correction, `30-CALIBRATION.md`: the original figure of 34 was a raw-difference measurement (start and end altitudes differing by >60 m, no loop condition applied) taken WITHOUT the loop condition — it decomposes into 21 loop-gated + 12 point-to-point (626 m–9,584 m apart, excluded by design) + 1 no-position. The un-loop-gated raw union across all three modes is 71 (3.8%), matching this requirement's original cited figure; see `30-CALIBRATION.md` § Correction of the raw-difference count (D-04).)*
  - **Implausible vertical rate** — 39 activities with >5 m/s of climb or descent between samples.
  *Ticked 2026-09-18 on plan 30-08's Round 1 Checkpoint R2 (Activities-list surface), R3, R4, R5, R6, R7, all
  PASS — the browser round was performed by the orchestrating agent in the developer's own Chrome session at
  the developer's explicit direction, and the developer signed off with a blanket "approved"; each verdict is
  recorded as agent-performed with developer sign-off, not as the developer's own observation. See
  `30-VALIDATION.md` § Round 1 Checkpoint and § Requirement → Row Map, as Applied. R2's Overview sub-claim
  (Recent Activities / Recent PRs) returned NOT EXERCISABLE — 0 of the current top-10-recent / top-5-PR'd
  activities carry `elevation.tier === 'severe'` in this archive; a disclosed dataset-coverage gap, not a
  defect, and not scored against the tick.*
- [x] **ELEV-02**: Altitude flagging is validated against the whole archive, and the per-mode flag rates are reported. A detector that fires only on the scoping exemplar has not been validated. Flag only: no DEM lookup, no correction, no grade-adjusted pace.
  *Ticked 2026-09-18 on plan 30-08's Round 1 Checkpoint R7 and R8, both PASS (same provenance as ELEV-01
  above), plus the automated archive-wide evidence recorded in `30-VALIDATION.md` Task 1: `30-CALIBRATION.md`
  (loop-gated union 60 of 1865, 3.2%, per-mode cohorts and device-family breakdown), the independent recount
  (`node scripts/compute-elevation-recount.mjs`: "Recounted union … 60", "PASS: recount agrees with the
  shipped elevation tiers; no disagreements found."), `npm run verify-dashboard` (66/66 checks passed), and
  `node scripts/compute-pace-quality-recount.mjs --expect 299` (PASS, Phase 27 composite unmoved). See
  `30-VALIDATION.md` § Round 1 Checkpoint and § Requirement → Row Map, as Applied.*

### Cross-era consistency (ERA)

- [x] **ERA-01**: Any logic branching on data provenance keys on **device family**, never on file format — a Garmin fēnix 6 Pro FIT file carries 0.0% `speed` and 0.0% `altitude` (it uses `enhancedSpeed`/`enhancedAltitude`) while a Suunto 9 FIT file carries 99.8% of both. Format is not a proxy for signal shape. *Ticked 2026-09-10 on plan 27-10's Round 1 Checkpoint R8, PASS — see `27-VALIDATION.md` § Round 1 Checkpoint.*
- [x] **ERA-02**: "No device name" is handled as its own explicit category, never as a default branch — it is 663 of 1,899 activities (34.9%), the second-largest cohort in the archive. *Ticked 2026-09-10 on plan 27-10's Round 1 Checkpoint R8, PASS (explicit category confirmed, never a fabricated device name) — see `27-VALIDATION.md` § Round 1 Checkpoint. The tick was never contingent on the cited cohort size, since G-02 confirmed the behavioral requirement holds regardless.* *Corrected 2026-09-19: was 716 of 1,864 activities (38%); live figure re-measured this session via a device-family census over `data/dashboard/index.json` (`quality.deviceEra.family === "no-device-name"`) on the merged 1,899-activity archive is 663 of 1,899 (34.9%) — see `27-VALIDATION.md` G-02, now CLOSED. The shortfall from 716 reflects improved device classification (activities that previously resolved to no-device-name now resolve to `intervals-icu`/`strava-app-gpx`/`garmin-vivoactive-4`), not a defect.*
- [x] **ERA-03**: Test fixtures are stratified by device era and include the known-bad cases by construction: a decimation-aliased stream, a recording gap, a multi-hour pause, an impossible-speed sample, and the pinned worked example. Ground truth does not exist for real GPS data, so fixtures must be synthetic where the expected answer must be known.

---

## v2.2 Tech-Debt Closure (Phase 31, added 2026-09-19)

Minted from `v2.2-MILESTONE-AUDIT.md` § tech_debt after option B (close the debt before completing the milestone) was chosen. Each ID is one of ROADMAP § Phase 31's six success criteria; decisions are in `31-CONTEXT.md`.

- [x] **TD-01**: `npm test` no longer depends on the live, owner-editable `data/best-effort-exclusions.json` for the four CR-01 regression tests in `src/analytics/compute-best-efforts.test.ts` (28 WR-09). Arithmetic runs against a committed fixture; exactly one test reads the real file and asserts only its premise, failing loudly with re-pin instructions when the premise changes. A curation edit cannot turn the nightly deploy gate red for an unexplained numeric mismatch; demonstrated by editing a fixture copy, never the real file.
- [x] **TD-02**: `scripts/lib/copy-data-tree.mjs` can no longer leave a locally-edited `dist/widgets/data/` file in place while `build-widgets` reports success. The mtime skip is replaced by size-then-digest comparison, and every same-size/different-content replacement is logged by path; demonstrated failing on a planted doctored file that is newer than its source.
- [x] **TD-03**: Silent folds become honest degradation or fail-closed, per role: `records-logic.ts` renders an unrecognized `demotion.guard` as "N by another guard" instead of dropping it from the breakdown; `scripts/compute-pr-ceiling-recount.mjs` exits non-zero naming each malformed exclusions entry (duplicate id, non-string/empty reason, `__proto__`, non-string id); the curation queue skips malformed entries and shows how many it ignored. Each has a negative test on a planted fixture.
- [x] **TD-04**: The ceiling demotion reason always states the margin at three decimals (`implied 4.630 m/s exceeds personal ceiling 4.628 m/s by 0.002 m/s …`), so implied speed and ceiling can never read as equal in a sentence that says one exceeds the other.
- [x] **TD-05**: Every artifact of record matches the code and the merged archive: generators fixed for 26 G-03 (residual manifest miscount), 28 WR-07 (hard-coded drift prose) and 28 WR-08 (unlabelled non-excluded "Demoted" column); `26-RESIDUAL.md`, `27-CALIBRATION.md`, `28-CEILING-CALIBRATION.md`, `28-DIFF.md`, `30-CALIBRATION.md` regenerated twice each (second run byte-identical) and committed; one fresh PR-04 sign-off recorded in `28-VALIDATION.md` bound to the new `28-DIFF.md` sha256. Hand-written stale figures (PACE-06 "13", ERA-02/ROADMAP Criterion 5 "716 of 1,864", PR-03/04/05 "pending re-verification", the audit's G-01 entry) corrected in place with dated notes naming their source record. *Ticked 2026-09-19 by plan 31-10: 31-08 regenerated all five artifacts (five byte-identical idempotence proofs, three-way ceiling reconciliation 32=32=32, new `28-DIFF.md` sha256 `97e1782c…`); 31-09 corrected all five stale hand-written figures with dated notes; PR-04 Round 4 re-sign closed with the developer's blanket approval — "Approve — R4-1/R4-2 PASS, R4-3 PASS via 4556693525@1k" — recorded verbatim in `28-VALIDATION.md` § PR-04 Sign-off (Round 4) / Developer's Verdict (Round 4).*
- [x] **TD-06**: No v2.2 phase carries a pre-execution validation record into the archive: `26/27/29-VALIDATION.md` backfilled via `/gsd-validate-phase` (done 2026-09-19 — 26 and 29 compliant, 27 `status: partial` pending G-02), and the plan that closes G-02 flips `27-VALIDATION.md` to `status: passed`. *Ticked 2026-09-19 by plan 31-09: G-02 closed and `27-VALIDATION.md` flipped `status: partial` -> `status: passed` in that same plan's Task 2 — see `27-VALIDATION.md` § G-02 and its frontmatter.*

## Future Requirements

Deferred, tracked, not in this roadmap.

### Stream re-derivation (STREAM)

- **STREAM-05**: Re-derive committed streams from local originals at full 1 Hz resolution, carrying the device's own speed channel. Deferred from v2.2 on three measured grounds: ~200 MB permanent git cost (streams are 143 MB, `.git` is 172 MB, and 1 Hz roughly doubles 2.7M samples to 5.3M); measured best-effort movement of only −1.6s to +5.0s on the tested activity; and direction — higher resolution makes bogus efforts *faster*, so rejection must land first. Revisit once v2.2's quality signals exist to measure whether it helps.
- **STREAM-06**: Raise or remove `derive-stream.ts`'s `MAX_SAMPLES = 3000` decimation ceiling, which currently degrades 995 of 1,864 activities (53%). Blocked on STREAM-05's storage decision.
- **STREAM-07**: Add a `speed` field to `RawSample` and carry the device-computed speed channel, which is present in 99.8–100% of FIT records across both device families under their respective field names and is currently discarded entirely.
- **STREAM-08**: Tighten `derive-stream.ts`'s `ALT_MIN = -500` bound, which is what admits −282 m altitude readings. Deferred with STREAM-05 because changing it requires re-deriving to take effect.
- **STREAM-04**: Garmin export adapter — inherited from v2.0, still externally blocked on the export arriving.

### Curation (CUR)

- **CUR-04**: Dismiss/acknowledge action so a reviewed-and-accepted activity leaves the queue (see CUR-01's known limitation).
- **CUR-05**: Per-effort override — reject a single bogus distance while keeping that activity's other legitimate records. Deliberately out of v2.2: exclusion stays whole-activity.

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Modifying committed stream files | The milestone's defining constraint. Every fix is derived, never written back to `data/streams/`. |
| Correcting genuine device over-measurement | The Suunto reports 17 m/s over one second on a descent where GPS geometry says 0 m, and position exists in only 51.3% of that file's records — geometry cannot arbitrate. Removing distance changes activity totals and every split. |
| Recomputing PR *times* | `findBestEffort` integrates distance at interpolated crossings, so pace smoothing is invisible to it. The only defensible movement is demotion of efforts that should never have ranked. |
| Recomputing moving time | Device `moving_time` stays the shipped aggregate; elapsed-vs-moving becomes a visible signal, not an authoritative recomputation. Mirrors Strava's own documented policy of trusting explicit device pause signals. |
| Stopped-watch correction | Nothing in the stored data distinguishes a deliberate rest from a forgotten stop — both are a pause with +0 m. Correcting would be guessing. |
| Transport/"teleport" gap handling | Measured as essentially absent: only 9 activities advance >100 m across a ≥30s gap, all at ≤14 km/h. Stopping the watch records no distance. |
| Grade-adjusted pace (GAP) | Deferred. Raw grade may be used to *suppress* false-positive speed flags on genuine steep descents, but no GAP metric is computed or shown. |
| Geometric GPS-spike rejection | Structurally impossible — committed streams carry no per-sample lat/lng by deliberate privacy design, and position coverage is asymmetric by era anyway (100% Garmin vs 51.3% Suunto), weakest exactly where it would be needed most. |
| DEM-based elevation correction | Runalyze's SRTM overlay is the precedent, but correction is out of scope; ELEV-01 flags only. |
| New runtime dependencies | STACK.md vetted `simple-statistics@7.12.0` and `d3-array@3.2.4` against live registry data and rejected both. Every algorithm needed is a 15–40 line pure function, matching what this project already hand-rolls. |
| A new local-only compute step | All v2.2 signals are computable from the committed stream, which CI can see. `export_data/` is gitignored and local-only; nothing in scope needs it. |

---

## Traceability

Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PACE-01 | Phase 26 | Complete (CR-03 closed — `buildChannelSeries` now reads `derivePaceWithCoverage(stream)`; the coverage-less `derivePaceSeries` wrapper was deleted so no production call site can pass its own `windowSec`; both false contract comments were removed; the single-source audit was extended to the object-shorthand form and demonstrated failing on it; chart-vs-histogram agreement confirmed on screen for activity 5059204779 in Round 3, rows R3-1 and R3-2, see 26-VALIDATION.md) |
| PACE-02 | Phase 26 | Complete |
| PACE-03 | Phase 26 | Complete |
| PACE-04 | Phase 26 | Complete |
| PACE-05 | Phase 26 | Complete |
| PACE-06 | Phase 26 | Complete |
| PACE-07 | Phase 26 | Complete |
| COV-01 | Phase 26 | Complete (WR-01 adjudicated REACHABLE; invariant restated as the itemised identity `coveredSec === bucketedSec + unbucketedCoveredSec`, verified across the whole committed archive — 1,865 streams, zero identity violations, see 26-11-SUMMARY.md) |
| COV-02 | Phase 26 | Complete (caption decoupled from `buckets.length`, regression-tested, and confirmed on screen for activity 11865310195 in Round 2 row R2-1, see 26-VALIDATION.md) |
| QUAL-01 | Phase 27 | Complete |
| QUAL-02 | Phase 27 | Complete |
| QUAL-03 | Phase 27 | Complete |
| QUAL-04 | Phase 27 | Complete |
| QUAL-05 | Phase 27 | Complete |
| PR-01 | Phase 28 | Complete |
| PR-02 | Phase 28 | Complete |
| PR-03 | Phase 28 | Complete (re-ticked 2026-09-17 on Round 2, 28-15 — see 28-VALIDATION.md § Round 2 Outcome; verified 2026-09-17T10:15Z, 28-VERIFICATION.md status: passed 5/5 -- corrected 2026-09-19, was "pending phase re-verification") |
| PR-04 | Phase 28 | Complete (re-ticked 2026-09-17 on Round 2, 28-15 — see 28-VALIDATION.md § Round 2 Outcome and § PR-04 Sign-off (Round 2, D-14); verified 2026-09-17T10:15Z, 28-VERIFICATION.md status: passed 5/5 -- corrected 2026-09-19, was "pending phase re-verification") |
| PR-05 | Phase 28 | Complete (re-ticked 2026-09-17 on Round 2, 28-15 — see 28-VALIDATION.md § Round 2 Outcome; verified 2026-09-17T10:15Z, 28-VERIFICATION.md status: passed 5/5 -- corrected 2026-09-19, was "pending phase re-verification") |
| CUR-01 | Phase 29 | Complete (ticked 2026-09-18 on plan 29-08's Task 2 checkpoint — see `29-08-SUMMARY.md` § Checkpoint Verdicts) |
| CUR-02 | Phase 29 | Complete (ticked 2026-09-18 on plan 29-08's Task 2 checkpoint — see `29-08-SUMMARY.md` § Checkpoint Verdicts) |
| CUR-03 | Phase 29 | Complete (ticked 2026-09-18 on plan 29-08's Task 2 checkpoint — see `29-08-SUMMARY.md` § Checkpoint Verdicts) |
| ELEV-01 | Phase 30 | Complete (ticked 2026-09-18 on plan 30-08's Round 1 Checkpoint, R2/R3/R4/R5/R6/R7 all PASS, blanket developer sign-off — see `30-VALIDATION.md` § Round 1 Checkpoint) |
| ELEV-02 | Phase 30 | Complete (ticked 2026-09-18 on plan 30-08's Round 1 Checkpoint R7/R8 PASS plus automated archive-wide evidence — see `30-VALIDATION.md` § Round 1 Checkpoint) |
| ERA-01 | Phase 27 | Complete |
| ERA-02 | Phase 27 | Complete |
| ERA-03 | Phase 26 | Complete |
| TD-01 | Phase 31 | Complete |
| TD-02 | Phase 31 | Complete (31-02, 2026-09-19 — `scripts/lib/copy-data-tree.test.mjs` RED→GREEN on a planted same-size doctored file; first post-merge `build-widgets` on the primary checkout logged `replaced stale dist/widgets/data/geo/geo-metadata.json`, a real stale file the old rule had kept) |
| TD-03 | Phase 31 | Complete (ticked 2026-09-19 by the orchestrator after the wave-1 merge — 31-03 and 31-04 each deferred the tick to the other; all three filters match: records-logic `another guard` 2, recount `malformed exclusion` 7, derive-flagged `malformed` 9; recount PASS on the real exclusions file) |
| TD-04 | Phase 31 | Complete (31-05, 2026-09-19 — reason renders 3-dp values plus `by {margin} m/s`; thin-margin test pins 3475730418@1mi; archive/28-DIFF.md propagation lands in 31-08) |
| TD-05 | Phase 31 | Complete (ticked 2026-09-19 by plan 31-10 — 31-08 regeneration: five byte-identical idempotence proofs, three-way ceiling reconciliation 32=32=32, `28-DIFF.md` sha256 `97e1782c…`; 31-09 corrections: five dated stale-figure fixes; PR-04 Round 4 sign-off: developer's blanket approval, all three rows PASS, see `28-VALIDATION.md` § PR-04 Sign-off (Round 4)) |
| TD-06 | Phase 31 | Complete (ticked 2026-09-19 by plan 31-09 — 27-VALIDATION.md flipped status: partial -> passed after G-02 closed; see 27-VALIDATION.md § G-02) |
