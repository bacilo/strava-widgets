# Requirements: v2.3 Pause & Slew Integrity

**Defined:** 2026-09-19
**Core Value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.
**Milestone goal:** Stop distance covered off the clock from being reported as speed — pauses, hidden pauses and GPS jumps no longer leak into pace charts, overall pace or PRs — without rewriting a stream or deleting a byte of data.

Scoped from a live investigation on 2026-09-19 of three developer-flagged activities (3475740390, 3475724402, 3475734189), committed streams and original FIT files both; evidence is recorded in `PROJECT.md` § Current Milestone and `research/SUMMARY.md`. REQ-IDs continue v2.2's numbering where a category already exists (PACE, COV, PR, CUR); SEG, RPACE, PAUSE and STOP are new. "PAUSE" is used for gap classification rather than "GAP", which this project already uses for grade-adjusted pace.

**Standing conventions every requirement inherits** (v2.1 + v2.2, not restated per row): a guard is watched failing before it is trusted; every headline figure has a classifier-independent recount shown failing-then-passing; every generated artifact is proven idempotent by a second run; checkpoint rows and fixtures are pinned to values derived outside the changed code and traced to the three named activity IDs, not look-alikes; every phase that adds a rendered surface closes on a human browser checkpoint against a digest-verified served build; origin is merged at least once per phase.

**Amendments:**
- SEG-04's Suunto disposition wording — see its row (amended 2026-09-19, 32-CONTEXT.md D-03).
- SEG-05 split into SEG-05a/SEG-05b — see their rows and the Traceability table (split 2026-09-19, 32-CONTEXT.md D-14).
- SEG-05b reopened — see its row (reopened 2026-09-21, 33-CONTEXT.md D-15).
- PAUSE-01's classes and scope — see its row (amended 2026-09-22, 34-CONTEXT.md D-02/D-01).
- STOP-01's timer-running scope — see its row (amended 2026-09-22, 34-CONTEXT.md D-09).

## v2.3 Requirements

### Unreliable-segment detection (SEG)

- [x] **SEG-01**: One detector (`src/analytics/unreliable-segments.ts`) identifies unreliable segments from the committed `t`/`d` channels alone — no lat/lng, no `export_data/` — so CI computes it. It judges maximal advancing *runs* by their aggregate implied speed, never single samples, so decimation aliasing (53% of streams alternate full/zero distance) does not fire it and a capped slew diluted across several samples does not escape it. **Reopened 2026-09-20 (32-VERIFICATION.md, gaps_found):** the detector's documented "never throws" total-function contract is false for null/non-array `t`/`d`/`gaps` and null `params` — a reachable production path from the untyped `.mjs` callers, closed by gap-closure plan 32-11. **Closed 2026-09-20 by 32-11:** shape-level guards re-reproduced closed against `dist/analytics/unreliable-segments.js` in 32-16 (31 matched `-t "shape-level"` tests).
- [x] **SEG-02**: A slew burst on either or both sides of a gap is merged with that gap into a single segment that conserves its real distance and real elapsed time. On 3475724402 no burst is left unmerged or labelled isolated (the uncalibrated 2026-09-19 scoping probe found 30 bursts, all adjacent to 18 gaps — a reference to reconcile against, not a pinned value); each merged segment's distance and elapsed time are asserted against a per-segment table derived independently of the detector. **Reopened 2026-09-20 (32-VERIFICATION.md, gaps_found):** `mapGapToIndices` and `isGapPair` use two disagreeing gap-boundary index conventions, so a duplicate timestamp exactly on a gap boundary silently drops the gap's own metres/seconds from the segment — latent on the committed archive today, closed by gap-closure plan 32-13. **Closed 2026-09-20 by 32-13:** boundary-convention fix re-reproduced closed against `dist/` in 32-16 (both verifier fixtures A/B now `gap-adjacent`, 21m/13s/1 gap; 6 matched `-t "boundary convention"` tests).
- [x] **SEG-03**: Bursts with no timestamp gap are detected — both the hidden-pause case (3475734189: 199 m at t=1353–1360, contiguous 1 Hz) and the isolated GPS-jump case (3475740390: five jumps of 25–52 m between km 6.9 and 7.7, distance-triggered sampling) — and each segment records which of the three mechanisms (gap-adjacent / hidden-pause / isolated-jump) produced it.
- [x] **SEG-04**: The speed limit and adjacency rule are calibrated against the archive in a committed, regenerable, idempotent calibration artifact, with an explicit non-circularity argument (the calibration population provably excludes what the threshold detects) and a stated disposition for genuine device over-measurement (the Suunto 17 m/s descent sample): whether it is detected, with its committed-stream numbers; if detected, it carries whichever of the three observable mechanisms the detector assigns — there is no fourth label, because from `t`/`d` alone over-measurement and an isolated GPS jump look the same; and the calibration artifact discloses it by activity ID (`4556693525`, identified 2026-09-19 in 32-RESEARCH.md § D-02) and states plainly that the detector cannot tell over-measurement from a jump — it is never corrected. The artifact replaces the crude 259/1,873 and 121/1,873 scoping figures with figures of record. **Amended 2026-09-19 (32-CONTEXT.md D-03):** the five isolated jumps on 3475740390 run slower than the Suunto sample, so no speed rule can flag them and spare it, and a fourth label would need lat/lng or device-family relabelling, both rejected. **Reopened 2026-09-20 (32-VERIFICATION.md, gaps_found):** the calibration generator's import-time side-effect guard is structurally vacuous (a `vi.spyOn(fs, 'readFileSync')` cannot observe a named-import call) and its `findValley` derivation is unsound in general (CR-04), closed by gap-closure plans 32-12 and 32-14. **Closed 2026-09-20 by 32-12 and 32-14:** the import-time guard is now observing (proven both directions, re-watched failing in 32-16) and `findValley` bins only in-interval mass (7 matched `-t "findValley"` tests); the artifact regenerates byte-identically (sha256 `f8f6d5db...`) and the three shipped constants (7.35/3.0/116.95) are unchanged.
- [x] **SEG-05a**: The single-source audit test is extended to the detector and shown catching a planted second implementation (a permanent in-suite planted block AND a one-off planted probe file against the real tree). This is Phase 32's half.
- [ ] **SEG-05b**: The detector is the single source — pace derivation, quality signals and best efforts all consume its output. Stays Pending until every consuming phase (33, 34, 35, 36) has shown its consumer reading the detector, and each phase records its own part. **Split 2026-09-19 (32-CONTEXT.md D-14):** Phase 32 has no consumer, and an unsplittable row is a planning defect (Phase 25's R6 lesson). **Reopened 2026-09-21 (33-CONTEXT.md D-15):** this row was carried as `[x]` Complete by commit `f5819975` ("docs(phase-32): complete phase execution"), contradicting its own text — it stays Pending until every consuming phase has shown its consumer reading the detector, and Phase 32 shipped no consumer at all, so nothing could have satisfied it. Phase 33 records its own half: `pace-derivation.ts` reads the detector inside `classifyGaps`, proven load-bearing by plan 33-01 Task 3 — the clipping disappears when the call is stubbed, not merely because the import exists. The row re-ticks only after Phases 35 and 36 each record theirs. **Consumer list widened 2026-09-22 (34-CONTEXT.md D-01):** Phase 34's pause classifier reads the detector's merged segments through `pace-derivation.ts` and records its own half.
- [x] **SEG-06**: Unreliable segments surface as an individually-disclosed per-activity quality signal (count, total metres, total seconds, mechanisms), badged with its measured value like the existing six, added additively with `DASHBOARD_INDEX_SCHEMA_VERSION` unchanged. Whether it joins the severe composite is decided from the calibrated rate and recorded, not assumed.

### Pace surfaces and coverage (PACE, COV)

- [x] **PACE-08**: The pace chart band, pace histogram and splits clip unreliable segments exactly as they clip recording and pause gaps — no pace value is manufactured inside one, and none is smoothed across one. The 0:34/km samples on 3475724402 and 3475734189 and the 1:10–1:40/km samples on 3475740390 are absent from chart and histogram on the served build.
- [x] **PACE-09**: A per-km split that contains an unreliable segment carries a marker, consistent with the existing gap-crossing split marker.
- [x] **COV-03**: The coverage identity stays exact with the new class — covered + recording-gap + pause + unreliable time sums to the stream's own span with zero violations across every stream in the archive — and the always-on coverage caption discloses unreliable time as its own term. How `gapProfileSignal`'s fraction treats unreliable time is decided explicitly and recorded.

### Best efforts (PR)

- [ ] **PR-06**: A best-effort window may not span, or interpolate a crossing across, an unreliable segment. The search partitions the stream into clean sub-intervals rather than deleting samples and re-running the sweep, and a test demonstrates that the splice approach fabricates a faster window on a named fixture.
- [ ] **PR-07**: The contaminated effort is never deleted: it is retained on the effort as a demoted record under a new guard discriminator with a reason stating the segment and its measured metres/seconds, while the effort's ranked figure is the best clean window. An activity with no clean window at a distance has no ranked effort there and says why. This amends v2.2's "PRs move by demotion, never recalculation" for this guard only (developer decision, 2026-09-19).
- [ ] **PR-08**: Unreliable-segment exclusion runs strictly before ceiling derivation within the existing three-pass shape, so contaminated timings never enter the ceiling's p90 population; the resulting ceiling movement per distance is measured and reported. A recalibration reporting zero movement is treated as a finding to explain, not a pass.
- [ ] **PR-09**: An archive-wide before/after diff covering every rank change, every newly demoted effort, every reinstated effort and every ceiling value is generated, reconciled three ways (diff, guard counts, independent sweep) and signed by the developer against its sha256 before the phase closes. The three scoping activities' 400m efforts (3:20, 3:21, 3:22/km today) are pinned regression fixtures.

### Overall pace (RPACE)

- [ ] **RPACE-01**: A stream-derived running pace (unreliable segments and gaps excluded from both distance and time) is computed for every activity with a computable stream, through the existing single pace-derivation module.
- [ ] **RPACE-02**: The activity detail view shows the running pace beside the metadata pace with a plain statement of what was excluded (metres and seconds). Metadata pace and device `moving_time` remain the shipped aggregate everywhere — lists, stats and widgets are unchanged.
- [ ] **RPACE-03**: The existing "Pace disputed" badge is raised when the two figures disagree materially, under a threshold calibrated against the archive and recorded. 3475724402 (metadata 4:56/km, no split under 5:00) is badged; the count of newly-disputed activities is reported as a finding.

### Pause classification (PAUSE)

- [ ] **PAUSE-01**: Every gap and merged segment is classified by implied speed across the whole segment as stationary, walked or transported, with speed bands calibrated against the archive in a regenerable artifact that carries its own non-circularity argument. **Amended 2026-09-22 (34-CONTEXT.md D-02, D-01):** four classes, not three — stationary, walked, ran-through, transported. 3475724402's merged segments sit at continued-running speed through signal loss, which none of the original three classes describes. 'Merged segment' means a gap-bearing merged segment (a recording gap and any adjacent burst the detector merged with it). Hidden-pause and isolated-jump segments carry no off-clock time, sit above the detector's speed limit by construction, and are not-classifiable; they keep only their Phase 32 mechanism label. Zero-advance pause intervals are stationary by definition and are listed without a speed test. **Amended 2026-09-22 (34-CONTEXT.md D-20, D-21, after three calibration HALTs):** the two class bands are DEVELOPER-DECLARED, not calibrated — `STATIONARY_MAX_SPEED_MPS` at 0.5 m/s (D-20, drift measured to be a non-issue) and `WALK_RUN_BOUNDARY_MPS` at 2.2 m/s (D-21, the covered-time distribution measured to have no walk/run valley: walking and running form one hump). The artifact still carries the measurement rows and the histogram evidence that produced both dispositions, plus each constant's provenance line, and the ran-through/transported boundary is still the imported `UNRELIABLE_SPEED_LIMIT_MPS` (D-05). The only constant still calibrated against the archive in Phase 34 is `FORGOTTEN_STOP_MIN_SEC` (STOP-02's minimum duration), which must still be selected by arbitration under D-06/D-08/D-13.
- [ ] **PAUSE-02**: The activity detail view lists each pause with its class, duration and distance; the per-activity summary is an additive index key and per-interval detail lives in the lazy quality shard.
- [ ] **PAUSE-03**: v2.2's finding that transport gaps are "essentially absent" (9 activities advancing >100 m across a ≥30 s gap, measured on the gap interval alone) is re-measured on merged segments and the corrected figure recorded with dated provenance in place of the old one.

### Forgotten stops (STOP)

- [ ] **STOP-01**: Sustained near-zero speed inside recorded (covered) time is flagged per activity with its total seconds and the longest stretch. Flag only — no time is removed, and moving time, overall pace and best efforts are untouched by it. **Amended 2026-09-22 (34-CONTEXT.md D-09):** the scope is recorded, timer-running time, not covered time alone. The flag counts two sources, itemised by source and combined: creeping near-zero stretches inside covered time, and the existing zero-advance pause intervals. Each source reports its count, total seconds and longest stretch. Recording gaps are excluded, because the timer was not running (auto-pause or signal loss). Still flag only. A stream whose recording mechanism makes a standstill invisible (distance-triggered sampling) reports not-computable with a stated reason, never 'none' (D-10).
- [ ] **STOP-02**: The near-zero threshold and minimum duration are calibrated against the archive, and the calibration artifact measures how much GPS drift-while-stationary actually exists (phantom distance accrued during stops). The detector tolerates drift if it is measured to matter; otherwise drift is recorded as a measured non-issue. Walking breaks are shown not to be flagged as forgotten stops. **Amended 2026-09-22 (34-CONTEXT.md D-20, after the second calibration HALT recorded in 34-06-HALT-2.md):** the drift measurement resolved to the requirement's own "measured non-issue" branch, so the near-zero threshold is developer-declared rather than calibrated. Measured on 1,874 streams: 684 standstill episodes, of which 678 record exactly zero advance (definitional — the pause rule marks only zero-advance runs) and 6 accrue anything at all, totalling 2.70 m; the candidate statistics over those 6 failed D-13 insensitivity on both axes. `STATIONARY_MAX_SPEED_MPS` is therefore declared at 0.5 m/s on physical grounds (far above the measured ~0.03 m/s drift, far below the slowest developer-confirmed walking control at 1.264 m/s), never presented as calibrated, and the artifact keeps the measurement rows as the evidence that produced the disposition. The minimum duration is still calibrated against the archive and may still HALT. The same 0.5 m/s still serves both the stationary class boundary and this threshold (D-07: one constant). The walking-break requirement is unchanged and still enforced against the declared value. **Amended 2026-09-22 (34-CONTEXT.md D-21, after the third run's gate failure recorded in 34-06-HALT-3.md):** "walking breaks are shown not to be flagged" is read as "no walking break is flagged FOR ITS WALKING PACE". The flag marks timer-running standstills, so a genuine standstill inside a walking break is flagged honestly and is disclosed rather than suppressed. Measured at the candidate params (0.5 m/s, 40 s) against all three developer-confirmed controls: 6286234101 and 3475733231 are not flagged; 3475715143 is flagged for a 42 s stretch measuring exactly the declared 0.5 m/s bound, inside its confirmed walking window. The developer accepted that flag rather than lowering the bound to hide it. The control test therefore asserts the property against an independent value: every flagged stretch on a control must sit strictly BELOW that control's own confirmed window aggregate speed, parsed at test time from 34-WALKING-BREAK-EVIDENCE.md rather than pinned, so the check can genuinely fail (raising the bound to that speed flags the whole window). **Amended 2026-09-23 (34-CONTEXT.md D-22, after the 34-11 checkpoint found overlapping stretches):** the weaker 'at or below the stationary bound' reading is RETIRED for reported stretches. A covered-creep stretch is the maximal union of overlapping qualifying windows, reported once with the union's own seconds and metres, so per-source count, total seconds and longest stretch never double-count; every CONSTITUENT window stays within the bound, while the union's own aggregate speed is disclosed and may exceed it. The regression tripwire now asserts the constituent property against the independent scan, not the union. The measured seconds and speed are reported as findings, never pinned as expected values. D-12's own anchor gate on the first control is unchanged and still enforced.
- [ ] **STOP-03**: The flag is disclosed on the detail view and is structurally excluded from the severe composite (it describes athlete behaviour, not data quality).

### Curation (CUR)

- [ ] **CUR-04**: In `npm run curate`, a queue row can be marked "reviewed and kept" with a required reason, distinct from exclude. It persists in its own committed file — not in `best-effort-exclusions.json`, which is load-bearing for ranking — through the existing overlay transport only (no second write surface), the row leaves the default queue view and remains reachable under a "reviewed" filter, and the action is reversible. Both publish guards are shown red under a planted leak and green on the served build.
- [ ] **CUR-06**: The review queue also lists activities whose best effort was moved by the unreliable-segment guard and activities with a transported-class pause, ordered by a stated priority (transported first, then by contaminated metres), with the count equal to an independent recount.

## Future Requirements

Deferred, tracked, not in this roadmap.

- **STREAM-05 / 06 / 07 / 08**: Stream re-derivation from the 1 Hz originals, carrying the device `speed` channel. Still deferred; v2.3's calibration artifacts are the first measurement of whether higher resolution would sharpen segment detection, and that finding should inform the revisit.
- **STREAM-04**: Garmin export adapter — still externally blocked on the export arriving.
- **CUR-05**: Per-effort override (reject one distance, keep the activity's others). Less pressing once PR-06/07 move contaminated efforts automatically; revisit after v2.3's queue has been worked through.
- **STOP-04**: Offering a "stopped time removed" pace for activities with forgotten stops. Out until STOP-02's calibration shows whether stops can be told from slow walking reliably enough to subtract.
- `index-client.ts` `ParsedDashboardIndexRow` retype; 28 WR-06 ceiling-file write gate; 30 WR-02/WR-03 elevation badge wording — carried from the v2.2 hand-forward list, unscheduled.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Rebasing gaps or bursts to GPS coordinates | Measured 2026-09-19: device distance equals the summed GPS path within 0–2% in all three investigated files (phone-app recordings, no FIT timer events). The jumps are *in* the coordinates, so geometry cannot arbitrate — and committed streams carry no lat/lng by deliberate privacy design. |
| Modifying committed stream files | Carried from v2.2. Every fix is derived at compute time; `data/streams/` stays byte-identical. |
| Redistributing burst distance across the gap (interpolate/smooth) | The GoldenCheetah-style fix. It manufactures pace values that were never measured — the same class of error v2.2 removed. Segments are clipped and disclosed, never filled. |
| Removing burst distance from activity totals | The distance is real (it is the GPS path); only its timing is wrong. Totals, stats and widgets are unchanged. |
| Replacing metadata pace or `moving_time` as the shipped aggregate | Developer decision 2026-09-19: the stream-derived figure is shown beside it, never substituted. Consistent with v2.2 and with Strava's documented policy. |
| Correcting forgotten stops | Nothing in the data distinguishes a deliberate rest from a forgotten stop. Flag only. |
| Correcting genuine device over-measurement | Carried from v2.2 (the Suunto 17 m/s descent). SEG-04 must state how the detector treats it; it is disclosed in the calibration artifact, never corrected (amended 2026-09-19, D-03). |
| Auto-excluding activities by pause class | Rule-based single-signal transport classification is unreliable at fine discrimination; it sets review-queue priority only. Exclusion stays a manual decision. |
| New runtime dependencies | STACK.md: every algorithm needed extends an existing hand-rolled function (`quantile`, `classifyGaps`); a stats library would add a third percentile definition to reconcile. |
| Wiring `export_data/` into CI or `npm test` | Gitignored and local-only. Local FIT-based calibration scripts are allowed under `scripts/` and must emit committed, regenerable artifacts. |

**v2.2 positions this milestone deliberately reverses, with the evidence:** "Recomputing PR times" (v2.2 Out of Scope) is amended by PR-06/07 for the unreliable-segment guard only — the ceiling judges whole efforts and provably cannot see a 100–170 m burst diluted into a 400 m window. "Transport/teleport gap handling … measured as essentially absent" is reopened by PAUSE-03 because that measurement looked at the gap interval alone and missed distance dumped into adjacent bursts.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEG-01 | Phase 32 | Complete |
| SEG-02 | Phase 32 | Complete |
| SEG-03 | Phase 32 | Complete |
| SEG-04 | Phase 32 | Complete |
| SEG-05a | Phase 32 | Complete |
| SEG-05b | Phases 33, 34, 35, 36 (per consumer) | Pending |
| SEG-06 | Phase 33 | Complete |
| PACE-08 | Phase 33 | Complete |
| PACE-09 | Phase 33 | Complete |
| COV-03 | Phase 33 | Complete |
| PAUSE-01 | Phase 34 | Pending |
| PAUSE-02 | Phase 34 | Pending |
| PAUSE-03 | Phase 34 | Pending |
| STOP-01 | Phase 34 | Pending |
| STOP-02 | Phase 34 | Pending |
| STOP-03 | Phase 34 | Pending |
| RPACE-01 | Phase 35 | Pending |
| RPACE-02 | Phase 35 | Pending |
| RPACE-03 | Phase 35 | Pending |
| PR-06 | Phase 36 | Pending |
| PR-07 | Phase 36 | Pending |
| PR-08 | Phase 36 | Pending |
| PR-09 | Phase 36 | Pending |
| CUR-04 | Phase 37 | Pending |
| CUR-06 | Phase 37 | Pending |
