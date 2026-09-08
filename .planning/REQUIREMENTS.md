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
- [ ] **PACE-05**: Per-km splits mark any split whose window contains a recording or pause gap, so a slow split reads as "paused mid-km" rather than as a bad kilometre. Splits' own arithmetic is already correct and is not changed.
- [ ] **PACE-06**: The residue that adaptive windowing does *not* fix is quantified and handed to flagging, never smoothed into plausibility. Measured with a window scaled to each activity's own advance interval, **13 of the 154** severe stair-step activities retain ≥0.5% of covered time below 3:00/km, all marginal (0.5–2.4%) — these are genuine device over-measurement, the category that must be flagged rather than corrected. The residual set is enumerated by ID and percentage as a deliverable.

  *Correction, recorded so the reasoning is not repeated:* an earlier draft claimed three of these were catastrophically broken (94.8%, 59.8%, 42.6% fast mass) and beyond derived-layer repair. That was an artifact of the measurement, not the data — a fixed 20s window applied to watches emitting distance every 60–99s. Under a window scaled to the observed interval those three read 1.22%, 0.00% and 0.00%, with coverage rising from 30/40/45% to 97/100/100%. Their streams were always sound: 5059204779 derives 5:51/km with splits of 7:05, 5:00, 6:00, 6:00, 6:00, 7:00, 5:00, 6:00, 6:00, 6:00. This is direct evidence for PACE-03's adaptive requirement, and a caution that a derivation artifact can masquerade as a data defect.

- [x] **PACE-07**: Where an activity's metadata-derived pace and its stream-derived pace disagree materially, the disagreement is detected and surfaced rather than displayed as fact. **This is a live, visible defect:** activity 5059204779 carries `moving_time: 1216` against `distance: 10804`, so `data/dashboard/index.json` holds `paceSecPerKm: 112.6` and the dashboard currently shows **1:53/km** for a run whose own stream derives **5:51/km**. Archive-wide this is a singleton (1 of 1,890 activities implies a sustained pace faster than 3:20/km from its metadata), which is precisely why a cheap cross-check is worth having: nothing else in the system would ever have caught it.

### Honest coverage (COV)

- [ ] **COV-01**: For any derived pace series, covered time plus excluded time — itemised by named exclusion category — sums exactly to the stream's elapsed time. Asserted by test, watched failing against the real defect before being trusted.
- [ ] **COV-02**: Coverage is visible to the reader wherever a derived distribution is shown, not merely correct internally. The shipped histogram today claims its buckets sum to elapsed time while covering 72% of it on the worked example.

### Per-activity quality signals (QUAL)

- [ ] **QUAL-01**: Each activity carries computed quality signals — decimation/stair-step ratio, physically-impossible-sample count, gap profile, elapsed-vs-moving divergence, device era — produced by a CI compute step, never derived in the browser.
- [ ] **QUAL-02**: Signals are disclosed individually rather than collapsed into one opaque score. Device era and decimation severity in particular stay separate signals: they correlate (all 154 severe stair-step activities are 2020–2021 Suunto 9) but decimation, not the device, is the mechanism.
- [ ] **QUAL-03**: Compact quality scalars are added additively to the dashboard index row so the activity list can badge, sort and filter by them; detailed per-sample findings live in a lazily-fetched per-activity shard, mirroring the existing `best-efforts/{id}.json` pattern.
- [ ] **QUAL-04**: Quality badges appear on the activity detail view, explaining rather than merely marking — a badge says what was detected and why it matters.
- [ ] **QUAL-05**: Severity tiers are calibrated against an archive-wide dry run before ship, targeting a top tier under ~5% of activities (≈90 of 1,864). The measured flag rate per tier is reported and justified; a top tier materially above that target is a calibration failure, not an acceptable outcome.

### PR plausibility (PR)

- [ ] **PR-01**: `compute-best-efforts.ts` runs a strict three-pass shape — accumulate, derive ceiling, then filter-and-flag — with no iteration to convergence, so CI output is deterministic and reproducible.
- [ ] **PR-02**: A personal plausibility ceiling is derived per target distance from the population *already* filtered by the existing absolute guard and exclusion list, never from the raw archive. Computing it over unfiltered data reproduces the exact circularity that lets today's guard admit a 44.0s 400m.
- [ ] **PR-03**: An effort exceeding the ceiling is flagged and demoted from ranking — never deleted, never silently removed from the archive, and always visible with the reason it was demoted.
- [ ] **PR-04**: An archive-wide before/after PR diff is produced and reviewed by a human before ship, showing every record that changes hands. A PR moving without the owner seeing it is a milestone failure.
- [ ] **PR-05**: The sharpened guard is validated against the whole archive, not one case. The population needing it is the **662 activities (36%) carrying at least one sample faster than the 100m world record**, spread across every device and every year. Activity 4556693525's 400m effort (44.0s, 9.09 m/s, passing under the 9.30 m/s ceiling) is pinned as a permanent regression fixture — here the specific activity *is* the deliverable, since a fixture's job is to be specific — and the guard must be demonstrated rejecting it and must fail if the ceiling regresses. Passing that fixture alone does not satisfy this requirement.

### Curation review queue (CUR)

- [ ] **CUR-01**: Local curation mode presents a queue of flagged activities, reachable without hunting through the archive, with one action: exclude the activity from PRs via the existing whole-activity `best-effort-exclusions.json` path. *Known limitation, accepted deliberately: with no dismiss action the queue is not drainable — an activity reviewed and judged fine remains listed. A dismiss/acknowledge action is the natural follow-up if this becomes annoying in use.*
- [ ] **CUR-02**: The queue reuses the existing `curate-server.mjs` write machinery (trusted-origin check, atomic write, activity-id validation) rather than introducing a parallel write surface.
- [ ] **CUR-03**: Both publish guards continue to prove the curation write path absent from the published bundle, with the new routes covered — verified by the build-time content scan and the HTTP-layer assertion, each demonstrated failing if the path leaks.

### Elevation quality signal (ELEV)

- [ ] **ELEV-01**: Implausible altitude is detected and flagged archive-wide by *mechanism*, not by a single bound. Measured cohort: **71 activities (3.8%)** carry at least one anomaly, spanning all device families (Suunto 9 50, Garmin fēnix 6 Pro 12, no device name 8, vívoactive 4 1) — this is not one device's quirk. At least these three modes are detected, because they catch largely different activities:
  - **Sub-ground-level readings** — 11 activities below −50 m, worst being a sea-level Lisbon run at −282 m. Passes today because `derive-stream.ts` sets `ALT_MIN = -500`.
  - **Barometric closure drift** — 34 activities whose start and end altitudes differ by >60 m despite returning to the same place, worst at 198 m. This is the largest cohort and a simple floor bound cannot catch any of it.
  - **Implausible vertical rate** — 39 activities with >5 m/s of climb or descent between samples.
- [ ] **ELEV-02**: Altitude flagging is validated against the whole archive, and the per-mode flag rates are reported. A detector that fires only on the scoping exemplar has not been validated. Flag only: no DEM lookup, no correction, no grade-adjusted pace.

### Cross-era consistency (ERA)

- [ ] **ERA-01**: Any logic branching on data provenance keys on **device family**, never on file format — a Garmin fēnix 6 Pro FIT file carries 0.0% `speed` and 0.0% `altitude` (it uses `enhancedSpeed`/`enhancedAltitude`) while a Suunto 9 FIT file carries 99.8% of both. Format is not a proxy for signal shape.
- [ ] **ERA-02**: "No device name" is handled as its own explicit category, never as a default branch — it is 716 of 1,864 activities (38%), the second-largest cohort in the archive.
- [ ] **ERA-03**: Test fixtures are stratified by device era and include the known-bad cases by construction: a decimation-aliased stream, a recording gap, a multi-hour pause, an impossible-speed sample, and the pinned worked example. Ground truth does not exist for real GPS data, so fixtures must be synthetic where the expected answer must be known.

---

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
| PACE-01 | Phase 26 | Complete |
| PACE-02 | Phase 26 | Complete |
| PACE-03 | Phase 26 | Complete |
| PACE-04 | Phase 26 | Complete |
| PACE-05 | Phase 26 | Pending |
| PACE-06 | Phase 26 | Pending |
| PACE-07 | Phase 26 | Complete |
| COV-01 | Phase 26 | Pending |
| COV-02 | Phase 26 | Pending |
| QUAL-01 | Phase 27 | Pending |
| QUAL-02 | Phase 27 | Pending |
| QUAL-03 | Phase 27 | Pending |
| QUAL-04 | Phase 27 | Pending |
| QUAL-05 | Phase 27 | Pending |
| PR-01 | Phase 28 | Pending |
| PR-02 | Phase 28 | Pending |
| PR-03 | Phase 28 | Pending |
| PR-04 | Phase 28 | Pending |
| PR-05 | Phase 28 | Pending |
| CUR-01 | Phase 29 | Pending |
| CUR-02 | Phase 29 | Pending |
| CUR-03 | Phase 29 | Pending |
| ELEV-01 | Phase 30 | Pending |
| ELEV-02 | Phase 30 | Pending |
| ERA-01 | Phase 27 | Pending |
| ERA-02 | Phase 27 | Pending |
| ERA-03 | Phase 26 | Pending |
