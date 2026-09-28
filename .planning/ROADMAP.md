# Roadmap: Strava Analytics Platform

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-02-14)
- ✅ **v1.1 Geographic & Widget Customization** — Phases 5-9 (shipped 2026-02-16)
- ✅ **v1.2 Maps & Geo Fix** — Phases 10-13 (shipped 2026-02-18)
- ✅ **v2.0 Training Dashboard** — Phases 14-18 (shipped 2026-08-12)
- ✅ **v2.1 Interface Polish** — Phases 19-25 (shipped 2026-09-05)
- ✅ **v2.2 Pace Data Quality** — Phases 26-31 (shipped 2026-09-19)
- 🚧 **v2.3 Pause & Slew Integrity** — Phases 32-37 (in progress)

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

<details>
<summary>✅ v2.2 Pace Data Quality (Phases 26-31) — SHIPPED 2026-09-19</summary>

- [x] Phase 26: Shared Gap-Aware Pace Derivation & Honest Coverage (16/16 plans) — completed 2026-09-10
- [x] Phase 27: Per-Activity Quality Signals (12/12 plans) — completed 2026-09-10
- [x] Phase 28: PR Plausibility Ceiling (15/15 plans) — completed 2026-09-17
- [x] Phase 29: Curation Review Queue (8/8 plans) — completed 2026-09-18
- [x] Phase 30: Elevation Quality Signal (8/8 plans) — completed 2026-09-18
- [x] Phase 31: Tech-Debt Closure — Silent-Failure Guards & Docs Reconciliation (10/10 plans, added 2026-09-19 from the close-out audit) — completed 2026-09-19

Full phase details: [`milestones/v2.2-ROADMAP.md`](milestones/v2.2-ROADMAP.md) · Requirements: [`milestones/v2.2-REQUIREMENTS.md`](milestones/v2.2-REQUIREMENTS.md) · Audit: [`milestones/v2.2-MILESTONE-AUDIT.md`](milestones/v2.2-MILESTONE-AUDIT.md) (`passed`, 33/33)

Every phase with a rendered surface (26-30) closed on a human browser checkpoint against a
digest-verified served build, and every phase shipped a classifier-independent recount of its own
headline number — because this milestone's defects were caught by re-deriving a figure outside the
code that produced it, never by a test going red.

</details>

### 🚧 v2.3 Pause & Slew Integrity (Phases 32-37) — IN PROGRESS

**Milestone Goal:** Stop distance covered off the clock from being reported as speed — pauses,
hidden pauses and GPS jumps no longer leak into pace charts, overall pace or PRs — without
rewriting a stream or deleting a byte of data. Scoped 2026-09-19 from a live investigation of
three developer-flagged activities, committed streams and original FIT files both: 3475740390
(five isolated 25–52 m GPS jumps, distance-triggered sampling, no gap), 3475724402 (18 gaps /
30 gap-adjacent bursts, 1,694 m in 106 s, ~1.9 m/s implied — walking), and 3475734189 (a 199 m
hidden-pause burst at t=1353–1360 inside contiguous 1 Hz sampling, no timestamp gap at all). Full
context, measured facts and decisions in `PROJECT.md` § Current Milestone; requirement text in
`REQUIREMENTS.md`.

- [x] **Phase 32: Unreliable-Segment Detection & Calibration** - One calibrated detector merges gap-adjacent slew bursts, hidden-pause bursts and isolated GPS jumps into segments that conserve real distance/time, and becomes the single source (completed 2026-09-20)
- [x] **Phase 33: Coverage Integration — Pace Clipping & Segment Signal** - Pace chart, histogram, splits and coverage caption clip unreliable segments exactly as gaps are clipped; the segment count/metres/seconds/mechanisms surface as a disclosed per-activity quality signal (completed 2026-09-22)
- [x] **Phase 34: Pause Classification & Forgotten-Stop** - Every gap/merged segment classified stationary/walked/transported; sustained near-zero speed inside recorded time flagged, never corrected (completed 2026-09-23)
- [ ] **Phase 35: Stream-Derived Running Pace** - A stream-derived running pace (unreliable segments and gaps excluded) shown beside metadata pace; "Pace disputed" extended to fire on material disagreement
- [ ] **Phase 36: Best-Effort Clean-Window Search & Ceiling Recalibration** - Efforts spanning an unreliable segment are demoted-and-kept while the search continues in clean sub-intervals; ceiling recalibrated on the excluded population; both diffs signed
- [ ] **Phase 37: Review-Queue Priority & CUR-04** - Queue reordered by pause class and guard-moved efforts; a reversible "reviewed and kept" action distinct from exclude

## Phase Details

### Phase 32: Unreliable-Segment Detection & Calibration

**Goal**: A single detector identifies unreliable segments — gap-adjacent slew bursts, hidden-pause bursts with no timestamp gap, and isolated GPS jumps — from the committed `t`/`d` channels alone, calibrated against the archive with an explicit non-circularity argument, and becomes the one source every downstream consumer reads.
**Depends on**: Nothing (first phase of v2.3; continues numbering after Phase 31)
**Requirements**: SEG-01, SEG-02, SEG-03, SEG-04, SEG-05a (SEG-05 split 2026-09-19 per 32-CONTEXT.md D-14; SEG-05b is tracked per consuming phase)
**Success Criteria** (what must be TRUE):

  1. Running the detector against 3475724402 leaves no burst unmerged or labelled isolated — every burst on this activity is gap-adjacent — and each merged segment's distance and elapsed time (burst + gap, both sides) match a per-segment table derived independently of the detector from the raw `t`/`d` arrays. The 2026-09-19 scoping probe's figures (30 bursts / 18 gaps / 1,694 m of burst distance in 106 s / 707 s of gap time, at an uncalibrated 7 m/s cut on the 2 s-decimated stream) are a reference to reconcile against and explain any difference from, NOT the pinned expected value.
  2. Running the detector against 3475734189 flags the 199 m burst at t=1353–1360 under the hidden-pause mechanism, despite contiguous 1 Hz sampling with no timestamp gap.
  3. Running the detector against 3475740390 flags all five isolated jumps (25–52 m, km 6.9–7.7) under the isolated-jump mechanism, including the 52 m jump at t=2508 where the activity's current 400m best starts.
  4. A committed, regenerable calibration artifact states the calibrated speed-limit constant, a non-circularity argument (the calibration population provably excludes what the threshold detects), and the Suunto 17 m/s descent sample's disposition — detected or not, with committed-stream numbers; if detected, no fourth mechanism label, because from `t`/`d` alone over-measurement and an isolated GPS jump look the same; disclosed by activity ID `4556693525` in the artifact and never corrected — replacing the crude 259/1,873 and 121/1,873 scoping sweep with a figure of record. **Amended 2026-09-19 (32-CONTEXT.md D-03):** the original v2.2 prose cited "17 m/s"; that figure did not reproduce exactly under this phase's own measurement (32-RESEARCH.md § A1), so the artifact reports measured committed-stream figures instead.
  5. The single-source audit test is extended to the detector and demonstrated catching a planted second implementation before passing against the real one. (SEG-05a, amended 2026-09-19 per D-14. The Goal's "one source every downstream consumer reads" is SEG-05b, discharged by Phases 33, 35 and 36.)

**Plans**: 17 plans (9 executed + 7 gap-closure + 1 round-2 review closure, 2026-09-20)
Plans:
**Wave 1**

- [x] 32-01-PLAN.md — D-03/D-14 amendments (SEG-05 → SEG-05a/05b) + D-17 stream-immutability gate
- [x] 32-02-PLAN.md — Standalone detector `unreliable-segments.ts` (folded run-level scoring, touching adjacency, chaining, 3 mechanisms)
- [x] 32-03-PLAN.md — Independent gap-first recount script for 3475724402 (zero-import, fails closed)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 32-04-PLAN.md — SEG-05a: single-source audit extended to the detector, planted proofs
- [x] 32-05-PLAN.md — D-10(d) reachability + D-05 detector-scale candidates + candidate statistics; blocking developer decision

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 32-06-PLAN.md — Derive speed limit / excess floor / hidden-pause boundary with D-13 insensitivity; ship constants

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 32-07-PLAN.md — Figures of record, reconciliation, D-11/D-06/D-05/Suunto sections, per-segment table; recount watched failing

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 32-08-PLAN.md — Real-stream named-activity fixtures + npm-test detector vs recount cross-check

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 32-09-PLAN.md — Merge origin, regenerate post-merge, D-12 local 1 Hz validation, closing gate

**Gap closure**

*added 2026-09-20 after 32-VERIFICATION.md returned gaps_found, 5/8 must-haves; waves renumbered
from 1 for this set*

- [x] 32-10-PLAN.md — reopen the prematurely-closed VALIDATION/ROADMAP/REQUIREMENTS/STATE artifacts
- [x] 32-11-PLAN.md — GAP 1 total-function contract made true for shape-level malformed input
- [x] 32-12-PLAN.md — GAP 2 replace the vacuous fs-namespace import-time guards with an observing mechanism
- [x] 32-13-PLAN.md — GAP 3 one gap-boundary index convention, duplicate-timestamp invariance
- [x] 32-14-PLAN.md — CR-04 findValley, CR-06 parseDecisionText, ambiguous namedItemSegmentMetres
- [x] 32-15-PLAN.md — SEG-05a needle quoting, D-05/D-09 negative-control reachability, CR-03 never-throws
- [x] 32-16-PLAN.md — re-close, gate re-run and artifacts re-ticked against recorded evidence
- [x] 32-17-PLAN.md — round-2 CR-01 overlapping gap blocks double-count distance, WR-01 start_date guard

### Phase 33: Coverage Integration — Pace Clipping & Segment Signal

**Goal**: The detector's output is wired into `classifyGaps` as a fourth `GapKind`; the pace chart band, histogram and per-km splits inherit clipping from the widened `GapKind` with zero change at their own call sites (PACE-08), the coverage identity is re-verified archive-wide across the new four-way split, and unreliable segments surface as a disclosed per-activity quality signal. **Amended 2026-09-21 (33-CONTEXT.md D-12):** the original phrase attached its zero-change claim to the whole phase rather than the clipping mechanism alone. That claim is true of PACE-08's clipping and false of the phase: PACE-09's split marker, COV-03's caption term and SEG-06's quality signal necessarily touch `detail-sections.ts`, `pace-quality.ts`, `list.ts`, `pace-quality-client.ts`, the dashboard index row and the lazy quality shard — surfaces this phase does touch. Left unnarrowed, the verifier would score every one of those rendered-surface edits as a goal violation.
**Depends on**: Phase 32
**Requirements**: SEG-06, PACE-08, PACE-09, COV-03
**Success Criteria** (what must be TRUE):

  1. On the served build, the pace chart band and histogram for 3475724402 and 3475734189 show no 0:34/km sample and 3475740390 shows no 1:10–1:40/km sample — all clipped, none manufactured or smoothed across.
  2. The per-km split covering 3475740390's t=2508 jump carries an unreliable-segment marker, consistent with the existing gap-crossing split marker.
  3. The always-on coverage caption discloses unreliable time as its own term, and covered + recording-gap + pause + unreliable time sums to each stream's own span with zero identity violations archive-wide.
  4. Each of the three named activities' detail view discloses an unreliable-segment quality signal (count, total metres, total seconds, mechanisms) badged with its measured value like the existing six signals, and whether it joins the severe composite is stated and recorded rather than assumed. `DASHBOARD_INDEX_SCHEMA_VERSION` stays unchanged.

**Note (32-CONTEXT.md D-04, 2026-09-19):** every unreliable segment receives one downstream treatment regardless of mechanism. Clipping pace or barring a window withholds a claim; it never alters distance, totals or splits. No per-mechanism branch.

**Plans**: 14 plans across 10 waves
Plans:
**Wave 1**

- [x] 33-01-PLAN.md — `classifyGaps` four-way widening, the pre-detector `classifyGapsThreeWay` seam, and the D-15 load-bearing proof
- [x] 33-02-PLAN.md — D-12 ROADMAP goal amendment and D-15 SEG-05b reopen

**Wave 2** *(blocked on 33-01)*

- [x] 33-03-PLAN.md — D-04 three-term `gapFraction` numerator; D-05 tier constants frozen and pinned
- [x] 33-04-PLAN.md — D-09 split marker, D-10 caption fourth term, D-11 gap-profile row copy and itemised evidence
- [x] 33-05-PLAN.md — the `VALID_GAP_KINDS` parse trap and the D-11 list-badge copy
- [x] 33-06-PLAN.md — PACE-08 inherited clipping proven by fixture, zero source change

**Wave 3** *(blocked on Wave 2)*

- [x] 33-07-PLAN.md — D-03 archive-wide detector-free identity recount, watched failing

**Wave 4** *(blocked on Wave 3)*

- [x] 33-08-PLAN.md — `excessMetres` output field and D-07's severity constant, circular strawman watched failing

**Wave 5** *(blocked on Wave 4)*

- [x] 33-14-PLAN.md — corrective: D-07 severity cut from a non-self-referential reference population (D-16), pre-declared shapes arbitrated by D-13, constant shipped from the artifact

**Wave 6** *(blocked on Wave 5)*

- [x] 33-09-PLAN.md — SEG-06 signal, the shipped constant and D-06's never-widen guard

**Wave 7** *(blocked on Wave 6)*

- [x] 33-10-PLAN.md — D-08 shard projection, browser parsers, `DASHBOARD_INDEX_SCHEMA_VERSION` pinned at 1

**Wave 8** *(blocked on Wave 7)*

- [x] 33-11-PLAN.md — SEG-06 surfaces: sixth badge source, ninth Quality Signals row, end-to-end render proof

**Wave 9** *(blocked on Wave 8)*

- [x] 33-12-PLAN.md — MERGE-01, post-merge regeneration, closing gate, D-13 checkpoint rows drafted

**Wave 10** *(blocked on Wave 9)*

- [x] 33-13-PLAN.md — human browser checkpoint and requirement disposition

**UI hint**: yes

### Phase 34: Pause Classification & Forgotten-Stop

**Goal**: Every gap and merged unreliable segment is classified by implied speed as stationary, walked or transported, and sustained near-zero speed inside recorded (covered) time is flagged as a possible forgotten stop — both disclosed on the detail view, neither correcting moving time, pace or best efforts. **Amended 2026-09-22 (34-CONTEXT.md D-02, D-09):** four classes — stationary, walked, ran-through, transported — on every gap-bearing interval (hidden-pause and isolated-jump segments are not-classifiable, D-01); the forgotten-stop scope is recorded, timer-running time (covered-time creep plus zero-advance pause intervals, recording gaps excluded).
**Depends on**: Phase 33
**Requirements**: PAUSE-01, PAUSE-02, PAUSE-03, STOP-01, STOP-02, STOP-03
**Success Criteria** (what must be TRUE):

  1. Each of 3475724402's merged segments is classified from its own merged distance and elapsed time, under speed bands calibrated in a regenerable artifact with its own non-circularity argument, and the per-segment classes on the detail view match a hand-derived table produced outside the classifier. The scoping probe's activity-level estimate (~1.9 m/s across all gaps, i.e. walking) is a reference only — individual segments may legitimately differ (the 98 s gap near t=2963 merges to roughly running speed), and the criterion is per-segment agreement with the independent table, not a single expected class. **Amended 2026-09-22 (34-CONTEXT.md D-02):** classes are stationary / walked / ran-through / transported; 3475724402's merged segments are expected to split between walked and ran-through under the calibrated walk/run boundary, and the criterion stays per-segment agreement with the independent table, never a pinned class. **Amended 2026-09-22 (34-CONTEXT.md D-20, D-21):** the speed bands are developer-declared (0.5 m/s stationary, D-20; 2.2 m/s walk/run, D-21) rather than calibrated, after three HALTs measured that this archive has no drift to calibrate against and no walk/run valley; the regenerable artifact carries that evidence and each constant's provenance. The 'expected to split between walked and ran-through' clause is RETIRED: at 2.2 m/s every one of 3475724402's merged intervals classifies ran-through. The criterion is per-segment agreement with the independent recount, and the class distribution is reported as a finding, never a pinned expectation.
  2. The detail view lists each pause with its class, duration and distance; the per-activity summary is an additive index key with per-interval detail in the lazy quality shard.
  3. v2.2's "9 activities advance >100 m across a ≥30s gap" figure is re-measured on merged segments rather than the gap interval alone, and the corrected figure is recorded with dated provenance in a regenerable artifact.
  4. A forgotten-stop flag (total seconds, longest stretch) is computed per activity under a near-zero threshold and minimum duration calibrated against the archive's own measured GPS-drift-while-stationary, disclosed on the detail view, structurally excluded from the severe composite, and shown NOT firing on a walking-break activity. **Amended 2026-09-22 (34-CONTEXT.md D-09):** 'inside recorded, timer-running time' — covered-time creep and the existing zero-advance pause intervals, itemised by source (count, total seconds, longest stretch) and combined; recording gaps excluded; a distance-triggered stream reports not-computable with a stated reason (D-10). **Amended 2026-09-22 (34-CONTEXT.md D-20, D-21):** the near-zero threshold is developer-declared at 0.5 m/s because drift-while-stationary was measured to be a non-issue on this archive (D-20), and the minimum duration is still calibrated. "Shown NOT firing on a walking-break activity" is read as "not firing for a walking break's walking pace": the flag marks timer-running standstills, so a genuine standstill inside a walking break is flagged honestly and disclosed. Measured at (0.5 m/s, 40 s): two of the three developer-confirmed controls are not flagged, and 3475715143 is flagged for a 42 s stretch at exactly 0.5 m/s, which the developer accepted (34-06-HALT-3.md). The criterion is the property, asserted against an independent value: every flagged stretch on a control sits strictly below that control's own confirmed window aggregate speed, parsed from 34-WALKING-BREAK-EVIDENCE.md rather than pinned, so it can genuinely fail. **Amended 2026-09-23 (34-CONTEXT.md D-22):** the 'at or below the stationary bound' reading is retired for reported stretches — each stretch is the maximal union of overlapping qualifying windows, reported once with the union's own seconds and metres (no double counting), every constituent window within the bound, and the union's own aggregate speed disclosed rather than asserted. Measured figures are reported as findings, never pinned.

**Plans**: 16 plans
Plans:
**Wave 1**

- [x] 34-01-PLAN.md — dated amendments: PAUSE-01/criterion 1 `ran-through` (D-02/D-01), STOP-01/criterion 4 timer-running scope (D-09), v2.2:165 forward pointer (D-04), SEG-05b names Phase 34
- [x] 34-02-PLAN.md — D-12 walking-break evidence (zero-import, CAN FAIL / CAN PASS on the named candidates) and the blocking developer confirmation
- [x] 34-03-PLAN.md — pure classifier leaf module: mechanism join proven exhaustive, four classes, D-10 blind-spot signature, forgotten-stop core; SEG-05b load-bearing stub proof; D-05 no-literal audit

**Wave 2** *(blocked on Wave 1)*

- [x] 34-04-PLAN.md — HALT-capable calibration generator (G/M/W shapes pre-declared verbatim, one D-13 harness, three strawmen, gates), built and tested, not run
- [x] 34-05-PLAN.md — PAUSE-03 re-measurement on merged segments beside the old rule and the transported class, dated provenance

**Wave 3** *(blocked on Wave 2)*

- [x] 34-12-PLAN.md — gap closure after 34-06 HALT-1 (D-19): Family G re-declared as standstill episodes (G4 pooled, G5 per activity), proportional planted perturbation across G/M/W, planting-entry defect fixed and watched RED first; synthetic fixtures only, not run

**Wave 4** *(blocked on Wave 3)*

- [x] 34-13-PLAN.md — gap closure after 34-06 HALT-2 (D-20): drift recorded as a measured non-issue with its evidence, STATIONARY_MAX_SPEED_MPS developer-declared at 0.5 with a provenance chain test, Family G evidence-only, M/W calibration untouched; synthetic fixtures only, not run

**Wave 5** *(blocked on Wave 4)*

- [x] 34-14-PLAN.md — gap closure after 34-06 HALT-3 (D-21): Family W evidence-only with live histogram evidence that the covered-time distribution has no valley, WALK_RUN_BOUNDARY_MPS developer-declared at 2.2 with a provenance chain test and a d21-basis gate, Family M still arbitrating; synthetic fixtures only, not run

**Wave 6** *(blocked on Wave 5)*

- [x] 34-06-PLAN.md — measured calibration run (strawman RED first, M arbitrates, gates) and constants shipped from the artifact, or HALT (fourth run: G and W declared per D-20/D-21, M still calibrated)

**Wave 7** *(blocked on Wave 6)*

- [x] 34-07-PLAN.md — D-18 zero-import independent class recount for 3475724402, watched failing against a broken classifier

**Wave 8** *(blocked on Wave 7)*

- [x] 34-08-PLAN.md — untiered pauseClassification/forgottenStop signals, capped shard list, never-widen guard, read-side parsers, fixture cascade

**Wave 9** *(blocked on Wave 8)*

- [x] 34-09-PLAN.md — Pauses section and the Quality Signals summary row, textContent-only, no badge/filter/chart change

**Wave 10** *(blocked on Wave 9)*

- [x] 34-10-PLAN.md — MERGE-01, regeneration on the merged tree, closing gate, checkpoint rows drafted with independent expected values

**Wave 11** *(blocked on Wave 10)*

- [x] 34-15-PLAN.md — gap closure after the 34-11 checkpoint (D-22): overlapping covered-creep stretches merged into one union each (STOP-01's count/totalSec/longestSec were double-counting), asserted against the independent zero-import scan and watched RED first; not-classifiable intervals disclosed in the Quality Signals Pauses row; artifacts and shards regenerated with the moved numbers written down

**Wave 12** *(blocked on Wave 11)*

- [x] 34-16-PLAN.md — code-review closure (34-REVIEW.md): CR-01 fabricated "none found" over an unreadable shard and CR-02 fabricated NaN standstill both fixed with their reproductions as regression tests; creep rows classified from the union's own numbers per D-22; tests no longer write to tracked files; one cap constant across write/read/render; scanner-backed protection for the declared constants; oracle divergence recorded; four findings deferred to todos

**Wave 13** *(blocked on Wave 12)*

- [x] 34-11-PLAN.md — human browser checkpoint and per-requirement disposition (complete; 34-16 runs after it and does not reopen it — its RE-LOOK rows are recorded in 34-VALIDATION.md)

**UI hint**: yes

### Phase 35: Stream-Derived Running Pace

**Goal**: A stream-derived running pace — unreliable segments and gaps excluded from both distance and time — is computed for every activity with a computable stream through the existing single pace-derivation module, shown beside metadata pace, with the existing "Pace disputed" badge raised on material disagreement. **Amended 2026-09-24 (35-CONTEXT.md D-08, D-06):** the running pace is covered metres over `coverage.coveredSec` off the same
   `pairKinds` partition (never a mean of windowed paces), and 'material disagreement' is
   slower-only — the running pace slower than metadata — gated on strictly positive withheld
   distance.
**Depends on**: Phase 33
**Requirements**: RPACE-01, RPACE-02, RPACE-03
**Success Criteria** (what must be TRUE):

  1. Every activity with a computable stream carries a stream-derived running pace value computed through the existing single pace-derivation module. **Amended 2026-09-24 (35-CONTEXT.md D-08):** 'computable stream' means
   `validateStreamSeries(t, d).ok` AND `coveredSec > 0` AND covered metres > 0; every other stream
   carries an explicit not-computable value with a stated reason, and the archive-wide count of
   those is reported as a finding.
  2. 3475724402's detail view shows the running pace beside the metadata pace (4:56/km) with a plain statement of the excluded metres and seconds, and the two figures visibly differ — consistent with no split on the activity being under 5:00/km.
  3. The "Pace disputed" badge is raised on 3475724402 under a threshold calibrated against the archive and recorded in a regenerable artifact, and the count of newly-disputed activities archive-wide is reported as a finding. **Amended 2026-09-24 (35-CONTEXT.md D-02, D-05, D-06, D-07):** the
   eligibility gate is zero-free-parameter (withheld distance > 0) and the direction is
   slower-only, both pre-declared in plan 35-01 before any measurement. The threshold is selected by
   first-clearing arbitration over shapes pre-declared in plan 35-05's text; the archive-wide
   newly-disputed count, the faster-side count and the gate-excluded count are all reported as
   findings and may never select, tune or re-order a shape (Phase 27 D-02 anti-quota). 'Is raised on
   3475724402' is a BASIS GATE on the run, not a selector: if the first-clearing shape's cut does
   not badge 3475724402 the run records `## GATE FAILED` and HALTs, and a different shape is NOT
   substituted to satisfy it.
  4. Metadata pace and device `moving_time` remain byte-identical everywhere else — lists, stats documents and widgets are unchanged by this phase.

**Plans**: 13 plans in 12 waves

Plans:
**Wave 1**

- [x] 35-01-PLAN.md — Dated amendments recording every discretion resolution, before any measurement (D-01/02/04/06/07/08)
- [x] 35-02-PLAN.md — Folded todo: make validateStreamSeries total at source, restore the narrowed comment

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 35-03-PLAN.md — deriveRunningPace (D-08 Reading A), its pinned boundary rule, and D-11's stub-the-detector proof

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 35-04-PLAN.md — Build the zero-import independent running-pace recount and its watched-RED guard

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 35-05-PLAN.md — Generate 35-RUNNING-PACE-RECOUNT.md, prove idempotence, reconcile the shipped function against it

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 35-06-PLAN.md — Build the HALT-capable D-05 calibration generator encoding seven pre-declared shapes

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 35-07-PLAN.md — Measure the archive, commit 35-CALIBRATION.md, name the constant or HALT (blocking decision)

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 35-08-PLAN.md — Retarget detectPaceDisagreement onto the running pace, ship the calibrated constant, rename the field

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 35-09-PLAN.md — Remove the 200 s/km stream-read gate, fold into one read, add the additive runningPace row field

**Wave 9** *(blocked on Wave 8 completion)*

- [ ] 35-10-PLAN.md — The Running Pace stat tile, its always-on exclusion line, and one extended CSS selector

**Wave 10** *(blocked on Wave 9 completion)*

- [ ] 35-11-PLAN.md — Retarget the three disputed-pace strings, prove the D-09 rebase and criterion 4's byte-identical boundary

**Wave 11** *(blocked on Wave 10 completion)*

- [ ] 35-12-PLAN.md — Merge origin, regenerate on the merged tree, freeze checkpoint rows against independent values

**Wave 12** *(blocked on Wave 11 completion)*

- [ ] 35-13-PLAN.md — Human browser checkpoint, per-requirement disposition, SEG-05b's Phase 35 half (blocking)

**UI hint**: yes

### Phase 36: Best-Effort Clean-Window Search & Ceiling Recalibration

**Goal**: A best-effort window may not span or interpolate a crossing across an unreliable segment; the contaminated effort is demoted-and-kept under a new guard while the search continues for the best clean sub-interval by partitioning (never splicing), exclusion runs strictly before ceiling derivation, and both a best-effort diff and a ceiling recalibration diff are signed before the phase closes.
**Depends on**: Phase 32 (per-activity unreliable intervals); sequenced after Phase 35 to keep the milestone's two highest-risk phases (32's calibration, 36's ranking-path change) isolated and independently reviewable
**Requirements**: PR-06, PR-07, PR-08, PR-09
**Success Criteria** (what must be TRUE):

  1. 3475740390's 400m best effort (currently 3:20/km, starting exactly on the 52 m jump at t=2508) no longer spans that jump; the demoted contaminated record states the jump's measured metres/seconds, and the ranked figure is the best clean sub-interval found by partitioning the stream, not by deleting-and-restitching it.
  2. A test demonstrates that the splice approach (delete unreliable samples, re-run the sweep over the spliced array) fabricates a faster window on a named fixture, distinguishing it from the shipped partition-based search.
  3. Unreliable-segment exclusion is shown running strictly before ceiling derivation within the existing three-pass shape, and the resulting per-distance ceiling movement is measured and reported as a finding — a recalibration reporting zero movement is treated as requiring its own explanation, not accepted silently.
  4. An archive-wide before/after diff — covering every rank change, every newly demoted effort, every reinstated effort and every ceiling value — is reconciled three ways (diff, guard counts, independent sweep) and signed by the developer against its sha256, with the three scoping activities' 400m efforts (3:20, 3:21, 3:22/km today) pinned as permanent regression fixtures.

**Note (32-CONTEXT.md D-04, 2026-09-19):** every unreliable segment receives one downstream treatment regardless of mechanism. Clipping pace or barring a window withholds a claim; it never alters distance, totals or splits. No per-mechanism branch.

**Plans**: TBD
**UI hint**: yes

### Phase 37: Review-Queue Priority & CUR-04

**Goal**: The curation review queue is reordered by pause-classification and unreliable-segment guard priority, and a queue row can be marked "reviewed and kept" — a reversible, distinct-from-exclude terminal state persisted in its own committed file — through the existing overlay transport, with both publish guards re-verified against the new state.
**Depends on**: Phase 36 (lists activities whose best effort the unreliable-segment guard moved), Phase 34 (lists activities with a transported-class pause)
**Requirements**: CUR-04, CUR-06
**Success Criteria** (what must be TRUE):

  1. In `npm run curate`, a queue row can be marked "reviewed and kept" with a required reason; it persists in its own committed file (not `best-effort-exclusions.json`, which stays load-bearing for ranking), leaves the default queue view, remains reachable under a "reviewed" filter, and the action is reversible.
  2. Both existing publish guards are shown red under a planted leak of the new route/file and green on the served build.
  3. The review queue also lists activities whose best effort was moved by the unreliable-segment guard and activities carrying a transported-class pause, ordered transported-first then by contaminated metres, with the count equal to an independent recount.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** Phases execute in numeric order: 1 → … → 31 (all shipped) → 32 → … → 37 (v2.3 Pause & Slew Integrity, in progress).

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
| 31. Tech-Debt Closure — Silent-Failure Guards & Docs Reconciliation | v2.2 | 10/10 | Complete    | 2026-09-19 |
| 32. Unreliable-Segment Detection & Calibration | v2.3 | 17/17 | Complete    | 2026-09-20 |
| 33. Coverage Integration — Pace Clipping & Segment Signal | v2.3 | 14/14 | Complete    | 2026-09-22 |
| 34. Pause Classification & Forgotten-Stop | v2.3 | 16/16 | Complete    | 2026-09-23 |
| 35. Stream-Derived Running Pace | v2.3 | 9/13 | In Progress|  |
| 36. Best-Effort Clean-Window Search & Ceiling Recalibration | v2.3 | 0/TBD | Not started | - |
| 37. Review-Queue Priority & CUR-04 | v2.3 | 0/TBD | Not started | - |

*Last updated: 2026-09-19 — **v2.3 Pause & Slew Integrity roadmap created**: 6 phases (32-37), 24/24 requirements mapped, derived from research/SUMMARY.md's suggested sequence (detection → coverage integration → pause/stop → stream pace → best-effort/ceiling → review queue), with the hard dependency chain 32→33→36 preserved. SEG-06 (the unreliable-segment quality signal/badge) placed in Phase 33 rather than Phase 32, keeping Phase 32 compute/calibration-only and grouping the badge with the other consumers `classifyGaps`' output feeds. Phases 33-37 add rendered surfaces and close on a human browser checkpoint; Phase 32 does not. No archive-wide target rates were guessed into any success criterion — v2.2's "~5%" criterion was found jointly unsatisfiable; where a rate is unknown this milestone, the criterion is "measured and reported in a regenerable artifact."

*Previously: 2026-09-19 — **v2.2 Pace Data Quality shipped**: 6 phases (26-31), 69 plans, 168 tasks, 33/33 requirements, 11 days. Full phase details archived to `milestones/v2.2-ROADMAP.md`; requirements to `milestones/v2.2-REQUIREMENTS.md`; all three audits (interim 2026-09-17, close-out 2026-09-18 `tech_debt`, final 2026-09-19 `passed`) to `milestones/`. Phase 31 was added from the close-out audit and closed the milestone's five silent-and-passing findings at the source before completion. v1.0-v2.1 remain collapsed above.*

*Previously: 2026-09-08 — **v2.2 Pace Data Quality** roadmap created: 5 phases (26-30), 27/27 requirements mapped, scoped from a live investigation of all 1,864 committed streams. Phase order followed the research-converged sequence (shared derivation → quality signals → PR ceiling → review queue → elevation), with two hard constraints carried from PROJECT.md: the PR ceiling demotes-and-flags only, never deletes, and its archive-wide before/after diff is a required reviewed deliverable.*

*Previously: 2026-09-05 — **v2.1 Interface Polish shipped**: 7 phases (19-25), 103 plans, 25/25 requirements. Full phase details archived to `milestones/v2.1-ROADMAP.md`; requirements to `milestones/v2.1-REQUIREMENTS.md`.*
