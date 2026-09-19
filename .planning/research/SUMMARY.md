# Project Research Summary

**Project:** strava-widgets — Pause & Slew Integrity (v2.3)
**Domain:** Sample-level GPS/timing anomaly detection and gap classification layered onto an existing static-JSON running-analytics pipeline
**Researched:** 2026-09-19
**Confidence:** HIGH overall (stack and architecture verified directly against this repo's own source; features MEDIUM on the general-market comparison; pitfalls HIGH for project-specific mechanics, MEDIUM for the one general-domain pitfall)

## Executive Summary

v2.3 closes a blind spot v2.2 could not see: the personal PR ceiling and every pace figure operate on effort/window *averages*, and a 100–170 m GPS slew burst or hidden pause diluted into a 400 m window sits under any average-speed threshold even though no single stretch of the run was real. This is not a new product or a new technology decision — it is arithmetic over the two arrays (`t`, `d`) the pipeline already commits, extending three modules (`pace-derivation.ts`'s gap classifier, `best-effort-utils.ts`'s window search, `pace-quality.ts`'s signal set) that already carry the exact hand-rolled percentile/median/run-merging patterns this milestone's math needs. Every mainstream platform researched (Strava, Garmin, GoldenCheetah) confirms the shape of the fix — demote-and-keep never delete, clip-and-disclose never smooth, flag-only for anything the data can't disambiguate (a forgotten stop from a deliberate rest) — so the milestone's seven target features (DETECT, PACE, PR, OVERALL, GAP, STOP, CUR-04) are all P1 with no smaller MVP available beneath them: each was scoped from measured archive evidence, not a wish list, and none of the genuinely novel work (sample-level contamination guard, clean-window search after demotion) has direct precedent anywhere in the market — this is the milestone's real contribution, not a catch-up feature.

The recommended approach is additive-only at every layer: a new `unreliable-segments.ts` module, imported by exactly one caller (`pace-derivation.ts`'s `classifyGaps`), extends the existing three-way strict-priority gap classification to a fourth `GapKind` (`'unreliable'`) so every downstream consumer — pace charts, histograms, coverage captions — clips it for free through the same `gapIntervals`-generic mechanism that already clips gaps, with zero code change outside `pace-derivation.ts`. The riskiest change is to `findBestEffort`: it must never delete-and-restitch samples around an excluded segment (this fabricates or masks a contaminated window at the splice point), and its `ComputedEffort` result must always describe the clean window at the top level, with the contaminated (raw) window attached only as a nested, optional disclosure field — this single design choice is also what keeps the personal ceiling's p90 non-circular with zero code change to `best-effort-ceiling.ts`.

The dominant risk cluster is calibration, not code shape: a naive per-sample speed threshold re-triggers on the same decimation aliasing v2.2 already diagnosed (53% of streams alternate full/zero distance at a 2-3s floor), and the archive already contains a verified genuine 17 m/s sample close enough to the measured ~29.5 m/s slew cap that an unmeasured threshold will straddle both populations. Every new constant this milestone derives (slew speed limit, gap-classification speed bands, forgotten-stop near-zero threshold) needs its own explicit non-circularity argument — the population it's calibrated from must provably exclude what it's meant to detect — mirroring the discipline `CEILING_K` already established in v2.2. A second, structurally distinct risk is that excluding contaminated efforts moves the ceiling's population, which can silently re-litigate settled demotions elsewhere in the archive (already demonstrated once in v2.2 by a 0.002 m/s ceiling drift flipping a record); this milestone must ship a signed before/after diff for both the best efforts AND the ceiling itself, in the same phase as the exclusion logic, not deferred.

## Key Findings

### Recommended Stack

No new core technology and zero new `package.json` entries. TypeScript/Node/vitest/Chart.js stay exactly as they are; the milestone's math (median, MAD, run-level implied-speed scoring, gap+burst merging) is 1-3 line extensions beside the project's two deliberately-distinct, already-calibration-cited percentile implementations (`quantile()` in `pace-derivation.ts`, `percentileNearestRank()` in `best-effort-ceiling.ts`). `@garmin/fitsdk` and `haversineMeters()` remain available for **local-only calibration scripts** against `export_data/*.fit` (which has lat/lng) but are explicitly out of any runtime code path, because `data/streams/{id}.json` carries no `latlng` channel and CI cannot read `export_data/`.

**Core technologies (unchanged):**
- TypeScript / Node 22 / vitest — pure-function detection/classification modules under `src/analytics/`, same convention as every prior milestone
- `@garmin/fitsdk` (already installed) — local-only calibration scripts only, never the runtime detector
- `node:http` + esbuild — the curate server/overlay's existing transport, extended with one more route for CUR-04, no framework added

**Explicitly rejected:** any general statistics library (`simple-statistics`, `d3-array`, `mathjs`) for median/MAD/percentile — the project deliberately hand-maintains two distinct percentile definitions because the exact algorithm is calibration-load-bearing, and a third library-defined variant would be one more thing to reconcile, not fewer. Also rejected: geometry libraries (`turf.js`, `geolib`) for runtime GPS-jump detection (no `latlng` channel exists at runtime), any HTTP framework for the curate server, and any outlier/anomaly-detection ML package (the detector must be a calibrated, explainable, single-variable threshold rule the developer can sign off on, not a black box).

### Expected Features

All seven target features are table-stakes-or-better against the researched market (Strava, Garmin Connect, GoldenCheetah, intervals.icu, Runalyze) — none require inventing new user expectations, and two are genuine differentiators with no direct market precedent.

**Must have (all seven are P1, no smaller MVP exists beneath this scope):**
- DETECT — speed-threshold + run-merging segment detection, the direct analogue of every platform's baseline GPS-cleaning heuristic
- PACE — clip-and-disclose unreliable segments exactly as gaps are clipped today (Strava's own moving-time logic excludes below-threshold time from the denominator the same way, never rewrites the track)
- PR — elapsed-time best efforts (matches Strava's own documented segment/effort policy), demote-and-keep (matches Strava's "Excluded Segment Efforts" mechanism almost exactly)
- OVERALL — stream pace beside metadata pace, reusing the existing "Pace disputed" badge (v2.2 PACE-07) — no platform discloses a second, independently-derived figure the way this one already commits to
- GAP classification (stationary/walked/transported) — rule-based, threshold-only classification is the industry-standard first approach in the transport-mode-detection literature
- STOP flag-only — no platform auto-corrects a forgotten stop; even Garmin requires manual trim
- CUR-04 reviewed-and-kept — the missing terminal state every review-queue pattern needs to distinguish "not reviewed" from "reviewed, kept as-is"

**Genuine differentiators (no researched platform does these):** the sample-level contamination guard beneath the effort-level ceiling (the milestone's actual novel contribution — Strava's own segment-matching GPS-accuracy check never operates below effort-window granularity); clean-window search after demotion (Strava demotes and stops, GoldenCheetah's processors operate on the whole activity, neither goes looking for a best surviving sub-window); gap classification surfaced as review-queue priority (every platform researched keeps a pause either fully-respected or fully-hidden — the classification itself is never surfaced anywhere).

**Explicitly anti-features (concretely ruled out by this project's own evidence, not just general principle):** interpolating/smoothing the slewed segment (device distance ≈ GPS path within 0-2%, so there is no independent signal to interpolate toward); GPS-track rebasing (same reason — the jump *is* the GPS data); deleting/silently re-deriving distance (already caused a real defect once — 34 efforts silently deleted pre-v2.2); auto-correcting forgotten stops; using the stream-derived figure as a silent replacement for metadata pace; auto-excluding on a "transported" gap classification (an advisory single-signal estimate, not a verified fact); full-trajectory Kalman/particle-filter smoothing (produces one opaque track that defeats the project's whole auditable-coverage-identity philosophy).

### Architecture Approach

No new top-level directory. Every new capability is a variation on a pattern already owned by an existing module: gap/segment classification stays inside `pace-derivation.ts` (new sibling file `unreliable-segments.ts`, imported by exactly one caller), quality signals extend `pace-quality.ts`'s shard/row split, the demotion guard extends `best-effort.types.ts`/`best-effort-utils.ts`'s existing single-shared-field pattern, and CUR-04 extends the curate server/overlay's existing route-and-transport shape into a new, separate committed file (`data/pace-review-state.json`) rather than widening `best-effort-exclusions.json`.

**Major components and their v2.3 change:**
1. `pace-derivation.ts` — becomes the sole unreliable-segment classifier too; `GapKind` gains a third member (`'unreliable'`), `PaceCoverage` gains `unreliableSec`, and the exact-sum coverage identity widens to a four-term equation, folded into the *same* strict-priority decision tree that already prevents double-counting between `covered`/`recording-gap`/`pause` — never a second, independent pass.
2. `best-effort-utils.ts` / `best-effort.types.ts` / `compute-best-efforts.ts` — `findBestEffort` gains segment-avoidance; `EffortDemotionGuard` gains a fourth member (`'unreliable-segment'`); `ComputedEffort` gains an optional, nested `contaminated` field rather than a second row per distance (the two-row shape was rejected — three call sites in `compute-best-efforts.ts` assume exactly one entry per distance and would silently break, the same shape as a real prior defect, Phase 27's G-04).
3. `best-effort-ceiling.ts` — requires **no code change**. Because the top-level `durationSec` is always redefined as the clean-window result, the contaminated timing structurally can never reach the ceiling's p90 population; non-circularity is preserved by construction, not by a new filter step.
4. `pace-quality.ts` — gains `gapMovementSignal` and `forgottenStopSignal`, following the existing shard-vs-row split (per-interval evidence in the shard, a small fixed-shape summary on the index row) and the "never partially fills" all-or-`not-computable` contract every existing signal already follows.
5. `curate-server.mjs` / `curate-overlay/index.ts` / `curate-queue/derive-flagged.mjs` — a second, structurally identical route/file pair for "reviewed and kept" (`/__curate/reviewed/:id`, `data/pace-review-state.json`), plus a fourth optional input to the flagged-activity derivation for queue-priority sorting.

### Critical Pitfalls

1. **Per-sample threshold re-triggers on decimation aliasing** — a naive single-sample speed check reproduces the 1,081/1,873-stream false-positive population v2.2 already diagnosed. Detect on maximal *runs* (aggregate `Σd/Σt` over the run), the same technique `computeFlatRunDurations`/`classifyGaps` already use, and cross-check candidates against the archive's own decimation-severity signal.
2. **Genuine fast running (downhill/strides) misclassified as a slew** — the archive already contains a verified genuine 17 m/s sample close to the measured ~29.5 m/s slew cap. The threshold must be calibrated from the archive's own measured genuine-vs-slew gap, with both boundary cases (the Suunto 17 m/s descent staying unflagged; the three scoping activities' bursts staying flagged) pinned as permanent regression fixtures.
3. **Clean-window search must never delete-and-restitch** — splicing out unreliable samples and re-running `findBestEffort` unmodified stitches the sample before the excision directly to the sample after it, fabricating or masking a window at the splice point. The stream must be partitioned into independent clean sub-intervals at every exclusion/gap boundary, with `findBestEffort` run separately per sub-interval and never crossing a boundary.
4. **Removing contaminated efforts moves the ceiling population, re-litigating settled demotions** — already demonstrated as real, not hypothetical, in v2.2 (a 0.002 m/s ceiling drift flipped a record with zero code change). Exclusion must run strictly before ceiling derivation, and a signed before/after diff is required for the ceiling itself, not only for individual best efforts, in the same phase as the exclusion logic.
5. **Threshold circularity across every new constant** — calibrating the slew threshold, gap-classification speed bands, or forgotten-stop threshold from the archive as it exists today risks calibrating a constant from the very population it's meant to reject. Every calibration artifact must state the population it was derived from and confirm that population provably excludes the phenomenon being detected.

## Reconciled Points (Architecture × Pitfalls)

Two points where the two research files touch the same ground were checked for disagreement; both concur rather than conflict, with Pitfalls supplying the operational detail Architecture's design only gestures at:

- **Clean-window search: partition, don't splice.** Architecture's data-flow sketch shows `findBestEffort(t, d, target, {avoid: unreliableIntervals})` — an "avoid" option — without spelling out the underlying mechanism. Pitfalls (Pitfall 7) makes the mechanism explicit and non-negotiable: the `avoid` option must be implemented as a partition into independent clean sub-intervals with `findBestEffort` run separately per sub-interval, never as sample deletion followed by an unmodified re-run over the spliced array (which fabricates or masks a window at the splice point). No disagreement — Pitfalls specifies the exact discipline the phase implementing Architecture's `avoid` parameter must follow, including a concrete negative-control fixture (3475740390's 400m best, which today starts exactly on a 52m jump boundary).
- **Contaminated efforts and the ceiling population.** Architecture explains *why* the ceiling needs no code change: with `ComputedEffort.durationSec` always redefined as the clean-window result, the contaminated timing structurally can never reach `best-effort-ceiling.ts`'s p90 population — correctness by construction. Pitfalls (Pitfall 8) is the complementary, empirical layer: even though the design is structurally correct, the population still changes shape (an activity's contribution shifts from a fast contaminated time to a slower clean one, or drops out entirely if no clean window exists), so the ceiling's actual numeric value will move, and that movement must be measured, diffed, and signed — a recalibration reporting zero movement should itself be treated as suspicious given v2.2's own precedent of a 0.002 m/s drift flipping a record. Both files agree that unreliable-segment exclusion must run strictly *before* ceiling derivation, in the same three-pass shape `compute-best-efforts.ts` already uses.

## Implications for Roadmap

Suggested phase structure continues numbering from Phase 32. Dependencies point one direction — detection first, everything else reads its output — matching both the FEATURES.md dependency graph and ARCHITECTURE.md's suggested build order.

### Phase 32: Unreliable-Segment Detection & Calibration
**Rationale:** Everything else in this milestone depends on this existing first; it is also the single highest-risk calibration surface (Pitfalls 1-4, 10, 12).
**Delivers:** `unreliable-segments.ts` (run-level implied-speed scan + maximal-run merge, both-sides-of-gap merging), the single-source audit extension with a planted-violation test, and a calibration artifact naming the genuine-vs-slew boundary (Suunto 17 m/s unflagged; three scoping activities' bursts flagged) plus a stated non-circularity argument for the speed-limit constant. **Superseded 2026-09-19 (32-CONTEXT.md D-01):** ROADMAP criterion 4 and SEG-04 win; if the run-level rule fires on the Suunto sample it IS a segment; the Suunto activity (`4556693525`) must never be pinned as a must-not-fire fixture; D-05's negative control is the archive's fastest corroborated-genuine running instead.
**Addresses:** DETECT (FEATURES.md P1).
**Avoids:** decimation-aliasing false positives, genuine-fast misclassification, diluted multi-sample slews, leading-side burst omission, vacuous synthetic fixtures.
**Constraint:** must ship its own `data/streams/` byte-identical CI checksum gate from this phase, not deferred to milestone close.

### Phase 33: Coverage Integration — Pace Clipping & Coverage Identity
**Rationale:** Wiring the detector into `classifyGaps` as a fourth `GapKind` satisfies pace/histogram/coverage clipping with zero code change outside `pace-derivation.ts`, because the clip machinery is already kind-agnostic — but the exact-sum identity must be re-verified archive-wide for the new four-way split, not assumed carried over.
**Delivers:** third `GapKind`, `unreliableSec`, the merge pass folded into the existing strict-priority tree (not a bolt-on second pass), and an archive-wide re-verification that the pre-existing three-way gap/pause cohorts are unchanged byte-for-byte.
**Addresses:** PACE (FEATURES.md P1).
**Avoids:** coverage-identity double-counting (Pitfall 6).

### Phase 34: Quality Signals — Gap Classification & Forgotten-Stop
**Rationale:** Both signals reduce `classifyGaps`' already-classified output rather than introducing new detection math, but they must stay structurally independent of each other (different denominators — non-covered vs. covered time) and this phase must explicitly resolve the GPS-drift-while-stationary open question (see below) rather than let it silently fall between the two detectors.
**Delivers:** `gapMovementSignal` (stationary/walked/transported by implied speed across the merged segment) and `forgottenStopSignal` (flag-only, no time removed), in the shard/row split, with a scoping note on GPS drift.
**Addresses:** GAP, STOP (FEATURES.md P1).
**Avoids:** walking-break/forgotten-stop conflation (Pitfall 9), threshold circularity for the two new bands.

### Phase 35: Stream-Derived Overall Pace
**Rationale:** Cheap given PACE-07 already exists; depends only on Phase 33, independent of 34 — can be sequenced in parallel if useful.
**Delivers:** `streamRunningPaceSecPerKm`, surfaced via `compute-dashboard-index.ts` as a new additive index field, rendered beside metadata pace with the existing "Pace disputed" badge extended to disclose the unreliable-segment contribution.
**Addresses:** OVERALL (FEATURES.md P1).

### Phase 36: Best-Effort Clean-Window Search & Ceiling Recalibration
**Rationale:** The highest-risk phase — it changes a ranking-critical path and the ceiling's population composition. Depends on Phase 32 (needs per-activity unreliable intervals). Researchers recommend fusing the ceiling recalibration diff into this same phase (both ARCHITECTURE's build order and PITFALLS' Pitfall 8 independently reach this conclusion) so unreliable-segment exclusion always precedes ceiling derivation, rather than risking a phase boundary where the ceiling is derived against a stale population.
**Delivers:** `findBestEffort` segment-avoidance via partition-not-splice, `EffortDemotionGuard`'s fourth member, `ComputedEffort.contaminated` as a nested optional field, Pass 1 wiring in `compute-best-efforts.ts`, plus **both** a signed archive-wide before/after diff for best efforts AND a signed recalibration diff for the ceiling itself.
**Addresses:** PR (FEATURES.md P1).
**Avoids:** splice-restitching (Pitfall 7), ceiling non-circularity/population-shift (Pitfalls 5, 8), the "raw window reaches the ranking population" correctness gap (Anti-Pattern 3).

### Phase 37: Review-Queue Priority & CUR-04
**Rationale:** Fully orthogonal to Phases 32-36 and can move anywhere in sequence without risk; sequencing it last keeps the riskiest, most novel work isolated and independently reviewable, and closes the milestone the way Phase 29 closed v2.2's curation work.
**Delivers:** gap-classification-driven queue sort (small, depends on Phase 34's summary signal) and CUR-04's "reviewed and kept" action — a new route pair and committed file (`data/pace-review-state.json`) that reuses the existing origin-gated, atomic-write transport verbatim, with both existing publish guards re-verified red-then-green against the new state.
**Addresses:** CUR-04 and GAP's queue-priority differentiator (FEATURES.md P1).
**Avoids:** CUR-04 reopening the publish-safety guard surface (Pitfall 14), folding reviewed-state into the exclusions file (Anti-Pattern 2).

### Phase Ordering Rationale

- Phases 32→33→36 form a strict chain (detection must exist before clipping, and clipping's per-activity intervals must exist before the best-effort guard can gate on them) and should not be parallelized.
- Phases 34 and 35 both depend only on Phase 33 and are independent of each other — either can be reordered or run in parallel without breaking the chain.
- Phase 37 has zero dependency on 32-36 and is deliberately sequenced last to keep the two highest-risk phases (32's calibration, 36's ranking-path change) isolated and reviewable on their own, matching this project's own established discipline of ending high-risk phases with a demonstrated, signed diff before moving on.

### Research Flags

Needs deeper research during planning (`/gsd-plan-phase --research-phase <N>`):
- **Phase 32** — the single most novel work in the milestone: no prior code in this repo does run-level speed-threshold detection with archive-wide calibration against two overlapping populations (decimation noise, genuine-fast vs. slew). The physical speed-limit constant does not exist yet and must be derived, not guessed.
- **Phase 36** — the riskiest data-shape change (nested `contaminated` field, partition-not-splice `findBestEffort` rewrite) and the only phase where a structural design choice (Pattern 2 in ARCHITECTURE.md) has load-bearing correctness implications for a separate module (`best-effort-ceiling.ts`) that isn't itself being touched.
- **Phase 34** — smaller in code surface but carries the one open scoping question (GPS-drift-while-stationary) that needs a resolved decision, not just implementation, before the phase can close cleanly.

Standard patterns, likely skip research-phase:
- **Phase 33** — direct, previously-modeled extension of `classifyGaps`'s existing strict-priority tree; the "clip machinery is already kind-agnostic" claim is asserted and traceable to specific line ranges in ARCHITECTURE.md.
- **Phase 35** — reuses PACE-07's existing badge mechanism verbatim; additive index field, well-precedented (Phase 30's `elevation` signal is the direct template).
- **Phase 37** — CUR-04 is a structural copy of the existing `saveExclusion`/`removeExclusion` route pair; both publish guards and the transport pattern already exist and are documented end-to-end in ARCHITECTURE.md and STACK.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every claim grounded in this repo's own committed source (files read directly), not a general ecosystem survey; zero new dependencies to evaluate |
| Features | MEDIUM | Strava's own support docs and Excluded-Segment-Efforts page fetched directly (HIGH); Garmin/GoldenCheetah/Runalyze/intervals.icu drawn from vendor docs and forums (MEDIUM); transport-mode-detection and GPS-cleaning academic literature is peer-reviewed but threshold values are study-specific and don't transfer 1:1 to this archive's single-signal (distance/time only) input |
| Architecture | HIGH | All claims verified against current source (full or near-full reads of every touched module), including specific line numbers for every claimed call site and existing pattern |
| Pitfalls | HIGH for project-specific mechanics (verified against `pace-derivation.ts`, `best-effort-ceiling.ts`, `best-effort-utils.ts`, `PROJECT.md`, `RETROSPECTIVE.md`); MEDIUM for the one general-domain pitfall (GPS drift while stationary, Pitfall 10 — WebSearch-corroborated, not yet measured against this archive) |

**Overall confidence:** HIGH — this is an integration milestone onto a codebase whose own conventions were read directly rather than inferred, and the one genuinely open question (GPS drift while stationary) is explicitly named as open rather than silently assumed either way.

### Gaps to Address

- **GPS drift while stationary, in or out of scope for forgotten-stop detection (Pitfall 10).** Multipath/GPS drift while genuinely stationary can accrue phantom "covered" distance at a speed low enough to clear both the new slew threshold and a naive forgotten-stop near-zero threshold — it sits in the gap between the two new detectors. Researchers recommend either extending forgotten-stop's net to catch "sustained low-but-nonzero implied speed with no elevation/HR change" as a distinct, separately-labelled finding, or explicitly deferring it with a named reason (mirroring how v2.2 deferred stream re-derivation). Not resolved by research — surfaced for a scoping decision in Phase 34's planning, not silently assumed either way.
- **Ceiling-recalibration diff: fused into Phase 36, or split into its own phase?** Both ARCHITECTURE.md and PITFALLS.md independently recommend fusing the ceiling recalibration diff into the same phase as the best-effort exclusion logic, with exclusion running strictly before ceiling derivation. This summary's suggested Phase 36 follows that recommendation, but it is presented here as a recommendation for the roadmapper/planner to lock in explicitly (e.g., as an explicit deliverable line in the phase's requirements) rather than an already-settled architectural fact — the alternative (deferring the ceiling diff to a later phase) is the exact shape of failure Pitfall 8 warns produces stale, unreconciled demotions.
- **The physical speed-limit constant for slew detection does not exist yet.** The archive's own crude sweep (7 m/s floor, 259/1,873 streams) is explicitly "uncalibrated — establishes reach, not a figure of record." Phase 32 must derive this from measurement (the archive's own genuine-vs-slew gap), not adopt a round number.
- **`gapProfileSignal`'s fraction formula (`pace-quality.ts:921`) needs an explicit decision** on whether `unreliableSec` counts toward "non-covered" for that existing signal, or whether a sibling signal owns it instead — flagged in ARCHITECTURE.md as a phase-level decision not resolved by architecture research alone; belongs in Phase 33 or 34's planning.

## Sources

### Primary (HIGH confidence)
- `src/analytics/pace-derivation.ts`, `pace-quality.ts`, `best-effort-utils.ts`, `best-effort-ceiling.ts`, `best-effort.types.ts`, `compute-best-efforts.ts`, `dashboard-index.types.ts`, `best-effort-exclusions.ts`, `pace-single-source.test.ts`, `compute-dashboard-index.ts` — read directly (STACK.md, ARCHITECTURE.md)
- `scripts/curate-server.mjs`, `scripts/curate-overlay/index.ts`, `scripts/curate-queue/derive-flagged.mjs`, `scripts/lib/curation-guard.mjs` — read directly (STACK.md, ARCHITECTURE.md)
- `.planning/PROJECT.md` §§ Current Milestone v2.3, Key Decisions, Requirements (Validated) — primary source for all measured archive evidence and scoping decisions already taken
- `.planning/RETROSPECTIVE.md` — cross-milestone lessons (v2.1/v2.2), used throughout PITFALLS.md
- Strava Support: "Moving Time, Speed, and Pace Calculations", "Excluded Segment Efforts" — fetched directly (FEATURES.md)

### Secondary (MEDIUM confidence)
- Garmin Connect / Garmin Forums / Suunto Community Forum threads on GPS-loss dead-reckoning behaviour (FEATURES.md, corroborates the measured ~29.5 m/s slew cap)
- GoldenCheetah Activity Processing wiki (FEATURES.md, official project docs)
- Review and evaluation of methods in transport mode detection based on GPS tracking data (ScienceDirect, peer-reviewed survey) — speed-threshold values taken as directional only
- GPS indoor multipath drift corroboration (GitHub issue) — general domain, not archive-verified (PITFALLS.md, Pitfall 10)

### Tertiary (LOW confidence)
- Intervals.icu forum threads, Runalyze help docs — limited GPS-jump-specific detail, used only as directional corroboration
- Physics-Guided Abnormal Trajectory Gap Detection (arXiv) — general framing only for run-level vs sample-level detection

---
*Research completed: 2026-09-19*
*Ready for roadmap: yes*
