# Feature Research

**Domain:** GPS/timer track integrity for a personal running-analytics dashboard — pause-distance leakage, GPS slew/teleport handling, gap classification, forgotten-stop detection, best-effort computation across corrupted segments
**Researched:** 2026-09-19
**Confidence:** MEDIUM (Strava's own docs and a Strava Engineering source verified directly; Garmin/GoldenCheetah/Runalyze from vendor docs + forums, no source code; academic GPS-cleaning literature is peer-reviewed but threshold values vary by study and don't transfer 1:1 to a 1 Hz/adaptive-interval running watch corpus)

## Feature Landscape

### Table Stakes (Users Expect These)

These map onto the milestone's own requirement categories (DETECT / PACE / PR / OVERALL / GAP / STOP / CUR). "Users expect" here means: this is how every mainstream platform this domain was checked against already behaves, so a dashboard claiming to be more honest than Strava cannot behave worse than Strava on these axes.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Speed-threshold segment detection (DETECT) | Every platform and every piece of GPS-cleaning literature checked uses a hard physical-speed cutoff as the first-pass anomaly filter — Strava's own "moving time" logic removes below-threshold time, and academic trajectory cleaning treats speed-threshold filtering as the baseline heuristic before anything fancier (median/Hampel/Kalman) is layered on. This project already has a calibrated personal ceiling (v2.2 PR-02); DETECT reuses that discipline one level down, at sample/segment granularity instead of effort granularity. | LOW-MEDIUM | Already proven pattern in this codebase (`1.28 × p90` ceiling derivation); the new work is applying an analogous calibrated limit to instantaneous speed runs-of-samples, not effort averages. |
| Gap-adjacent burst merged into one segment that conserves real distance/time (DETECT) | This is the direct analogue of "dead reckoning" behaviour documented on Garmin/Suunto forums: when GPS is lost, devices propagate a position from last-known heading/speed for a short period, then on reacquisition slew hard to the true position — exactly the ~29.5 m/s cap this project measured. No platform researched treats the gap and the post-gap burst as two unrelated events; conflating them is the actual mechanism, so the segment model has to conflate them too. | MEDIUM | Novel synthesis (no vendor does this "merge and account for" step explicitly) but grounded in why GPS reconnection artifacts exist at all, not invented from scratch. |
| Unreliable segments clipped from pace surfaces, not deleted from the stream (PACE) | Direct precedent: Strava computes moving time/speed by *excluding* below-threshold time from the denominator, never by rewriting the recorded track; GoldenCheetah's own docs distinguish "remove GPS errors" (a display/derived-data operation) from the underlying activity file. This project's own v2.2 convention (`data/streams/` byte-identical) already established this pattern for gaps — PACE extends the identical clip to bursts. | LOW | Direct extension of existing `derivePaceSeries`-family code, same clip-and-disclose shape as gaps today. |
| Best efforts computed on elapsed time/distance across the window, not silently recalculated against moving time (PR) | Strava's own support docs state plainly: "Segments and best efforts always use elapsed time — resting time is part of how long it takes you to complete them." The project's own decision (device `moving_time` stays shipped, stream figure shown beside it) already matches this. What's new is which *windows* are eligible, not which *clock* is used within a window. | LOW (policy already set) | Confirms D-02/decision already taken; PR work is about window eligibility (exclude windows spanning an unreliable segment), not about switching best-effort math to a different time base. |
| Demote-and-keep, never delete, with the flagged item still visible to the owner (PR, general philosophy) | Strava's own "Excluded Segment Efforts" mechanism is the closest real-world analogue: efforts that fail a plausibility check are hidden from public leaderboards but remain visible to the athlete under "Excluded Efforts," are not deleted, and don't count toward records. That is precisely the shape of this project's existing PR-ceiling guard and the decision to extend it (demote-and-search-for-clean-window) rather than delete. | LOW (policy already set) | Validates the project's own established convention against the market leader's actual behaviour — this is not a novel choice, it's the industry's own answer to the same problem. |
| Gap/pause classification by implied speed (GAP) | Transportation-mode-detection literature (walking ≤ ~3 m/s / ~11 km/h, cycling 3-8 m/s, motorized ≥ ~17 m/s) is a mature, decades-old sub-field with converging thresholds across many independent studies. Using implied speed across a merged gap+burst to bucket stationary/walked/transported is the direct, minimum-viable application of that literature to a single-signal (distance/time) input. | LOW-MEDIUM | Rule-based, threshold-only classification (no ML) is explicitly the industry-standard *first* approach in this literature and is noted as "computationally inexpensive" and adequate when the three buckets are coarse and don't need to discriminate walking vs. easy jogging or bike vs. train. |
| Forgotten-stop detection, flag-only, no time correction (STOP) | No platform researched auto-corrects a forgotten stop. Garmin Connect's own forums confirm there is no built-in automatic "you forgot to stop, here's the corrected time" feature — only a manual trim tool the athlete applies themselves after noticing. This matches the project's own decision (flag only; nothing in the data distinguishes deliberate rest from forgotten stop). | LOW | Confirms an already-taken decision; no correction mechanism to build, only a sustained-near-zero-speed-inside-recorded-time detector and a badge. |
| Curation queue "reviewed and kept" distinct from "excluded" (CUR-04) | Every review-queue / anomaly-triage tool pattern (including GoldenCheetah's manual accept-or-run-processor-per-activity model) needs a "looked at this, it's fine" terminal state distinct from "acted on this." Without it, a queue that only supports exclude cannot distinguish "not reviewed yet" from "reviewed, kept as-is," which defeats the queue's own purpose as a priority/triage surface. | LOW | Additive to the existing `npm run curate` queue and `saveExclusion`/`removeExclusion` transport (CUR-01/02) — a third state alongside default and excluded, not a new write path. |

### Differentiators (Competitive Advantage)

None of the platforms researched (Strava, Garmin Connect, GoldenCheetah, intervals.icu, Runalyze) do these. They are genuinely ahead of the market on this narrow problem, and they follow directly from the milestone's Core Value (compute what Strava doesn't).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sample-level contamination guard beneath the effort-level ceiling | Strava's segment/leaderboard exclusion and this project's own v2.2 PR ceiling both operate on *effort averages*. Every platform researched has the exact blind spot the milestone's own evidence names: a 100-170 m burst diluted into a 400 m window sits under any average-speed ceiling because the average survives even though no single stretch of the run was real. No researched platform (including Strava's segment-matching GPS-accuracy check) operates below the effort-window granularity. This is the milestone's actual novel contribution. | MEDIUM-HIGH | Depends on DETECT existing first (a segment can't be excluded from a window before it's identified). |
| Clean-window search after demotion, not just exclusion | Strava demotes/excludes an effort and stops there — it does not go looking for the best surviving sub-window of the same activity. GoldenCheetah's data processors operate on the whole activity, not per-effort. Continuing the search for the best clean window inside a contaminated activity, rather than just discarding the ranking slot, is not something any researched tool does. | MEDIUM | Amends the v2.2 "demotion, never recalculation" rule for this one guard only (decision already taken) — the search space is bounded (existing distance windows: 400m..marathon) so this is a bounded re-run of `findBestEffort`, not open-ended recomputation. |
| Stream-derived running pace shown *beside* metadata pace, never substituted | Strava and Garmin each show exactly one authoritative pace number computed by their own undisclosed method; neither discloses a second, independently-derived figure next to it for the athlete to compare. This project already ships a "Pace disputed" badge (v2.2 PACE-07) on exactly this kind of disagreement — OVERALL extends the same idea from per-activity metadata-vs-stream to the aggregate/overview level. | LOW (extension of existing pattern) | Reuses PACE-07's disagreement badge; no new detection mechanism, just a second visible number and the existing threshold. |
| Gap classification surfaced to the user as review-queue *priority*, not just an internal label | Every platform researched treats a pause as either fully respected (manual pause) or fully auto-detected and hidden (auto-pause) — the classification itself (stationary/walked/transported) is never surfaced. Making it visible on the detail view and using it to rank the curation queue (a "transported" gap is more suspicious than a "walked" one) is a differentiator with no direct precedent found. | LOW-MEDIUM | Pure UI/prioritization layer over DETECT's output; no new detection work. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Interpolating/smoothing the slewed segment into a plausible-looking track or pace curve | GoldenCheetah's own "Remove GPS errors" tool does exactly this for short gaps (interpolates positional data from before/after the gap) and "Fix Speed from Distance" applies a moving-average smoothing filter — it looks like the obvious fix and other tools do it. | Interpolation manufactures a fictitious route/pace through the exact region the project's own investigation proved is unreliable (device distance ≈ GPS path, so there is no independent signal to interpolate *toward* — "rebasing to GPS coordinates" was explicitly ruled out on this project's own evidence). This is the same "smoothing manufactures pace" failure mode v2.2 already fought and fixed (the fixed 20s window aliasing a phantom fast mode) — interpolating a slew burst would reintroduce a fabricated-but-smoother version of the same lie. | Clip and disclose, exactly as gaps are already handled: the segment's real distance and real elapsed time stay in the coverage identity, but it is excluded from pace curves, histograms and best-effort windows. |
| GPS-track rebasing / snapping the burst to a plausible path | Seems like the "real" fix for a teleport — correct the coordinates, not just hide the number. | Already tested and ruled out on this project's own evidence: device distance equals the summed GPS path within 0-2% across all three investigated files, meaning the jump *is* the GPS data, not a distance-sensor artifact GPS could arbitrate. No coordinate signal exists to rebase against. | Treat distance/time as the only trustworthy signal for these segments (what DETECT already does); never touch coordinates. |
| Deleting or silently re-deriving distance for contaminated segments | Deleting looks like the honest fix — "that distance wasn't real, remove it." | This project has already learned this lesson twice: the old effort-ranking code silently deleted 34 efforts across 28 activities before v2.2 replaced it with demote-and-flag, and PACE's own coverage-identity discipline (covered + gap + pause == stream span) exists specifically so no time or distance silently vanishes from the accounting. Silent deletion also breaks the archive-wide diff/audit trail this project relies on as its evidentiary convention. | Demote-and-flag with the reason and margin stated (existing pattern); segment stays in the coverage identity as "unreliable," never zeroed. |
| Auto-correcting a forgotten stop by trimming the recorded time | Garmin Connect's manual trim tool exists and users request an automatic version of it constantly (per forum threads) — "just detect the near-zero segment and cut it." | Nothing in the stored data distinguishes a deliberate long rest from a forgotten stop (explicit v2.2 and v2.3 decision) — an automatic trim would sometimes correctly fix a forgotten stop and sometimes wrongly amputate a real, intended rest break, with no way to tell which case is which from the data alone. No platform researched does this automatically; even Garmin requires the athlete to notice and manually trim. | Flag only (STOP decision already taken); leave correction to the athlete via existing curation tooling if they choose to act on it manually. |
| Using device `moving_time` — or the new stream-derived figure — as a silent replacement for metadata pace | Feels like an upgrade: "we now compute a more honest number, so show that instead." | Already decided against (v2.2 and v2.3 both): device `moving_time` and metadata pace stay the shipped aggregate; the stream-derived figure is a disclosed second opinion, not a replacement. Silently swapping the headline number would also invalidate every historical PR/aggregate comparison built on the old figure, and Strava's own segment math (elapsed time, not moving time, for best efforts) shows there is no single "correct" clock — showing both and flagging disagreement is the only honest move. | Beside-not-instead, with the existing "Pace disputed" badge mechanism (already the project's answer to exactly this tension). |
| Automatically excluding an activity because a gap classifies as "transported" | Seems logical: if part of the recording was a car/train, the activity's overall stats are contaminated, so auto-exclude it. | The classification is a per-gap implied-speed estimate off a single distance/time signal, not a verified mode-of-transport (the literature itself flags rule-based single-signal classification as unreliable at discriminating similar-speed modes, and false positives near the walking/vehicle threshold are expected). Acting on it automatically converts an advisory signal into a silent, unreviewable deletion-adjacent decision — exactly the anti-pattern above, one layer removed. | Surface classification as review-queue priority only (the differentiator above); leave the exclude decision to the existing manual curation action. |
| Full-trajectory Kalman/particle-filter smoothing across the whole activity | Standard, well-published technique in the GPS-cleaning literature for producing a single "best estimate" track; looks like state-of-the-art compared to a threshold filter. | Produces one smoothed, opaque trajectory that hides exactly where the real signal ran out — the opposite of this project's whole quality-signal philosophy (v2.2: "the residue adaptive windowing does not fix is quantified... rather than smoothed into plausibility"). A Kalman filter's smoothed output cannot be audited sample-by-sample against a coverage identity, and it would silently launder the same slew bursts the milestone exists to expose. | Segment-level detect-and-clip with an exact, itemisable coverage/reliability identity — auditable, not a black-box estimate. |

## Feature Dependencies

```
DETECT (unreliable-segment detection: gap-adjacent slews, hidden-pause bursts, isolated jumps)
    ├──requires──> existing gap classifier + adaptive pace derivation (v2.2 PACE-01..07, COV-01/02)
    │
    ├──feeds──> PACE (chart/histogram/coverage clip unreliable segments)
    ├──feeds──> PR (best-effort windows may not span an unreliable segment; clean-window search)
    ├──feeds──> GAP classification (runs on the DETECT-merged gap+burst segment, not the raw gap alone)
    └──feeds──> OVERALL (stream-derived running pace excludes unreliable segments, same as PACE)

PR clean-window search
    └──requires──> DETECT (segments must be identified before a window can be judged to span one)
    └──requires──> existing PR ceiling machinery (v2.2 PR-01..05) — this milestone amends it, doesn't replace it

OVERALL (stream-derived pace beside metadata pace)
    └──requires──> existing "Pace disputed" badge mechanism (v2.2 PACE-07) — reused, not reinvented
    └──enhances──> existing metadata pace display (adds a second figure, never substitutes)

GAP classification (stationary / walked / transported)
    └──requires──> DETECT's merged segment (classifying the raw gap alone under-measures distance, per the milestone's own re-measurement of the v2.2 "9 activities" finding)
    └──feeds──> CUR queue priority ordering (differentiator, not a hard requirement — queue still functions without it)

STOP (forgotten-stop flag)
    └──independent of DETECT──> different mechanism (sustained near-zero speed inside recorded time, not a speed-limit violation) but shares the flag-only philosophical pattern with PR/DETECT

CUR-04 (reviewed-and-kept)
    └──requires──> existing curation queue transport (v2.1 CUR-01, v2.2 CUR-01..03) — additive third state, no new write path
    └──enhances──> GAP classification's priority ordering (a "walked" gap reviewed-and-kept can drop in priority; not required for CUR-04 itself to ship)

CONFLICTS (ruled out by this project's own evidence, not by external precedent):
GPS-track rebasing ──conflicts──> DETECT's premise (device distance ≈ GPS path within 0-2%; no independent coordinate signal exists to rebase against)
Interpolation/smoothing ──conflicts──> the clip-and-disclose convention (v2.2's whole "not smoothed into plausibility" lesson)
```

### Dependency Notes

- **PR requires DETECT:** the milestone's own measured evidence is explicit that the v2.2 effort-level ceiling cannot see this class of contamination (a 100-170 m burst dilutes below the ceiling inside a 400 m window) — so the sample-level guard has to exist and identify segments before any window-eligibility rule can be written against it.
- **GAP classification requires DETECT's merged segment, not the raw gap:** the milestone's own re-measurement point is direct evidence for this — "v2.2's 'only 9 activities advance >100m across a gap' measured the gap interval alone and missed distance dumped into the adjacent bursts." Classifying on the raw gap would reproduce that exact undercount.
- **OVERALL enhances rather than requires PACE:** the stream-derived running pace can reuse PACE's clipping logic directly (same unreliable-segment exclusion), so it is best sequenced after or alongside PACE rather than as an independent computation path — two consumers of one clipped series, matching the existing single-shared-module discipline (PACE-01's structural audit) rather than a second divergent implementation.
- **STOP is deliberately independent:** it is a different physical signature (sustained low speed with continuous, correctly-timestamped recording) from everything DETECT targets (speed-limit violations). Building it as a separate detector avoids conflating "too fast to be real" with "too slow to be a real stop," which are opposite ends of the same speed axis and should not share a threshold or a code path.
- **Interpolation/smoothing and GPS-rebasing are listed as conflicts, not alternatives considered and rejected in the abstract** — both were concretely tested against the three investigated activities and failed on this project's own evidence (0-2% GPS/device agreement; no plausible interpolation target), which is stronger grounds for exclusion than general principle alone.

## MVP Definition

The milestone's target features already function as the MVP scope — there is no "launch with less" cut available beneath them, because each was scoped from measured archive evidence rather than a wish list, and the developer's own four scoping decisions (§ PROJECT.md) already ruled out the features that would have made a smaller MVP tempting (full re-derivation, automatic stop correction, GPS rebasing).

### Launch With (v2.3)

- [ ] DETECT — unreliable-segment detection (gap-adjacent slews, hidden-pause bursts, isolated jumps), calibrated against the archive — everything else in this milestone depends on it existing first
- [ ] PACE — chart/histogram/coverage clip and disclose unreliable segments — direct, low-risk extension of the existing gap-clipping pattern
- [ ] PR — best efforts exclude windows spanning an unreliable segment, demote-and-keep plus clean-window search, signed archive-wide diff — closes the milestone's headline finding (v2.2 ceiling blind spot)
- [ ] OVERALL — stream-derived running pace beside metadata pace, "Pace disputed" raised on disagreement — cheap given PACE-07 already exists
- [ ] GAP — classification (stationary/walked/transported) — needed for the review-queue priority differentiator and to correct the "9 activities" undercount
- [ ] STOP — forgotten-stop flag, no correction — small, isolated, flag-only per decision already taken
- [ ] CUR-04 — reviewed-and-kept queue action — small, additive, explicitly pulled forward from the v2.2 hand-forward list because "some of these cannot reasonably be automated"

### Add After Validation (v2.3.x, only if evidence demands it)

- [ ] Re-tune DETECT's speed calibration if the archive-wide run surfaces a different distribution than the 259/1,873-activity crude sweep suggested (that sweep is explicitly uncalibrated — "establishes reach, not a figure of record") — trigger: DETECT's own calibration artifact disagrees materially with the crude sweep's shape
- [ ] Extend gap classification's priority signal into a fourth CUR queue sort dimension if the reviewed-and-kept data shows walked/transported gaps have very different false-positive rates — trigger: enough CUR-04 usage data exists to measure it

### Future Consideration (v2.4+)

- [ ] Stream re-derivation from 1 Hz originals (STREAM-05/06, already tracked as hand-forward) — now that DETECT/quality signals exist to measure whether higher resolution actually helps distinguish real bursts from recording artifacts, this is the natural next milestone, not this one
- [ ] `index-client.ts` `ParsedDashboardIndexRow` retype — orthogonal technical-debt item, unrelated to this milestone's domain

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| DETECT | HIGH | HIGH | P1 |
| PACE (clip unreliable segments) | HIGH | LOW | P1 |
| PR (window exclusion + clean-window search + diff) | HIGH | HIGH | P1 |
| OVERALL (stream pace beside metadata) | MEDIUM | LOW | P1 |
| GAP classification | MEDIUM | MEDIUM | P1 |
| STOP flag | LOW-MEDIUM | LOW | P1 |
| CUR-04 reviewed-and-kept | MEDIUM | LOW | P1 |

**Priority key:** all seven are P1 — this milestone was scoped narrowly from measured evidence rather than a broader wish list, so there is no P2/P3 tier within it; the "future consideration" items above are the actual P2/P3 candidates, deliberately deferred to a later milestone.

## Competitor Feature Analysis

| Feature | Strava | Garmin Connect | GoldenCheetah / intervals.icu / Runalyze | Our Approach |
|---------|--------|-----------------|-------------------------------------------|--------------|
| Pause-distance leakage into pace | Auto-pause (accelerometer for running, GPS speed threshold for cycling) excludes below-threshold time from moving time; manual pauses always respected; no per-segment integrity check beyond that | Configurable auto-pause with hysteresis (separate pause/resume speed thresholds) prevents flicker, but no post-hoc detection of distance dumped into a resume burst | GoldenCheetah's "Remove GPS errors"/"Fix Speed from Distance" tools smooth or interpolate, applied manually or on import; none flag-and-clip a specific slew burst | Detect the gap+burst as one segment, clip it from pace surfaces, keep it in the exact coverage identity — narrower and more auditable than any researched tool |
| GPS jumps/teleports | Segment-matching GPS-accuracy check hides bad segment efforts from leaderboards but doesn't touch pace/best-effort computation elsewhere in the activity | Devices dead-reckon during signal loss, then slew hard on reacquisition (the mechanism this milestone targets) — no correction offered in Garmin Connect itself | GoldenCheetah interpolates through short GPS gaps (anti-feature per above); none detect isolated jumps with no adjacent timestamp gap | Detect isolated jumps via the same physical speed-limit test, independent of whether a timestamp gap exists |
| Best-effort computation across pauses | Elapsed time, not moving time, for segments/best efforts (confirmed via official docs) — no window-eligibility check against GPS/slew contamination | No published segment/best-effort concept at the Connect platform level | GoldenCheetah has no automated best-effort ceiling; a human inspects the smoothed/fixed data manually | Elapsed time within the window (matches Strava), plus a sample-level contamination guard no researched platform has, plus clean-window search after demotion (also unmatched) |
| Gap classification | Not exposed — a pause is a pause, no mode inferred | Not exposed | Not exposed by any researched tool | Stationary/walked/transported by implied speed across the merged segment, surfaced on the detail view and as queue priority — a genuine differentiator |
| Forgotten-stop handling | No detection; athlete edits manually via activity edit tools | Manual trim tool only, no auto-detection | No researched tool auto-detects | Flag-only detector (sustained near-zero speed inside recorded time), matching the industry's universal "don't auto-correct" norm but adding visibility Garmin/Strava don't offer |
| Flag vs. delete philosophy | Excluded segment efforts are hidden from leaderboards, never deleted, still visible to the athlete under "Excluded Efforts" | N/A (no equivalent mechanism) | Data-processor corrections are opt-in and reversible per-activity, not automatic deletion | Demote-and-keep across every guard in this milestone (PR, DETECT), matching Strava's own philosophy — the industry's answer to "don't silently vanish data," already this project's established convention since v2.2 |

## Sources

- [Improving Auto-Pause for Everyone (Strava Engineering, Medium)](https://medium.com/strava-engineering/improving-auto-pause-for-everyone-13f253c66f9e) — MEDIUM confidence (fetch blocked 403; used via WebSearch synthesis only, not primary-fetched)
- [Moving Time, Speed, and Pace Calculations — Strava Support](https://support.strava.com/hc/en-us/articles/115001188684-Moving-Time-Speed-and-Pace-Calculations) — HIGH confidence (fetched directly): confirms elapsed-time basis for segments/best efforts, accelerometer-based running auto-pause, manual-pause precedence over server-side recalculation
- [Excluded Segment Efforts — Strava Help Center](https://support.strava.com/hc/en-us/articles/360061896712-Excluded-Segment-Efforts) — HIGH confidence (fetched directly): confirms flag-not-delete, athlete-still-visible philosophy
- [Strava Training Glossary for Running](https://support.strava.com/hc/en-us/articles/216917157-Strava-Training-Glossary-for-Running) — MEDIUM confidence, referenced via search
- Garmin auto-pause manuals (vívoactive, Venu, Edge series — www8.garmin.com/manuals) — MEDIUM confidence, official docs but no algorithmic detail beyond threshold + hysteresis description
- [Electronic device, pause determination method, and storage medium (patent filings)](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12442938) — LOW confidence, single-source technical detail on dual-threshold hysteresis, used only to corroborate forum-reported behaviour
- Garmin Forums — GPS-loss-in-tunnel threads (fēnix 6, Forerunner 945/955, Epix Gen 2) and Suunto Community Forum — MEDIUM confidence (multiple independent user reports converging on dead-reckoning-then-slew behaviour, matching this project's own measured ~29.5 m/s cap)
- [GoldenCheetah Activity Processing wiki](https://github.com/GoldenCheetah/GoldenCheetah/wiki/UG_Special-Topics_Activity-Processing) — HIGH confidence, official project documentation
- Runalyze Help Center — Elevation and Features overview (runalyze.com/help) — MEDIUM confidence, official docs but elevation-focused, limited GPS-jump-specific detail
- Intervals.icu Forum — "Fix data" and elevation-correction threads (forum.intervals.icu) — LOW-MEDIUM confidence, community forum rather than official spec
- [Review and evaluation of methods in transport mode detection based on GPS tracking data (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S2095756421000623) — HIGH confidence, peer-reviewed survey; speed-threshold values (walking ≤3 m/s, biking 3-8 m/s, motorized ≥17.4 m/s) taken as directional, not literal, given this project's single-signal (distance/time, no accelerometer) input
- Hampel filter / speed-threshold GPS-trajectory-cleaning literature (Sensors journal, EURASIP, Hampel test survey) — HIGH confidence for the existence and standard use of these techniques as a baseline; threshold values are study-specific and not directly portable
- Stay-point detection literature (Ye 2009 algorithm, ScienceDirect evaluation, arXiv staypoint-from-noisy-trajectory papers) — HIGH confidence for the time+distance-threshold concept underlying gap/segment merging; not a literal implementation source
- `.planning/PROJECT.md` § Current Milestone: v2.3 — primary source for all measured archive evidence and the four scoping decisions this research deliberately did not re-litigate

---
*Feature research for: pause/slew integrity in a personal running-analytics dashboard*
*Researched: 2026-09-19*
