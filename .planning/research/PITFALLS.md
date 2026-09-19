# Pitfalls Research

**Domain:** Sample-level GPS/timing anomaly detection (slew bursts, hidden pauses, isolated jumps), segment-excluding best-effort search, gap classification, and forgotten-stop flagging — added to an existing gap-aware pace/PR pipeline over a heterogeneous, partially-decimated 1,899-activity archive.
**Researched:** 2026-09-19
**Confidence:** HIGH for project-specific mechanics (verified against `src/analytics/pace-derivation.ts`, `best-effort-ceiling.ts`, `best-effort-utils.ts`, `.planning/PROJECT.md`, `.planning/RETROSPECTIVE.md`); MEDIUM for general GPS-anomaly-detection framing (WebSearch, cross-checked but not project-native)

## Critical Pitfalls

### Pitfall 1: Per-sample speed threshold re-triggers on decimation aliasing

**What goes wrong:**
A naive `speed[i] = (d[i+1]-d[i]) / (t[i+1]-t[i]) > threshold` sweep fires on the same decimation artifact v2.2 already diagnosed: index-selection decimation to a 2-3s floor aliases 53% of streams into an alternating full/zero distance pattern. A crude >7 m/s sweep already hit 1,081 of 1,873 streams. Anything that reduces to "one sample too fast" without checking whether the *next* sample is anomalously slow (the compensating zero) will re-manufacture that false-positive population, this time as "unreliable segments" instead of "fast pace."

**Why it happens:**
Decimation-by-selection doesn't smooth — it keeps some raw samples and drops others, so a real ~3 m/s average over 6s can present as one 9m/1s sample (9 m/s) followed by one 0m/2s sample (0 m/s). A per-sample check sees the first half of that pair as a slew and never notices the compensating zero that makes the *pair* physically ordinary.

**How to avoid:**
Detect on **runs**, not samples — the same `computeFlatRunDurations`-style approach `classifyGaps` already uses for pauses. A slew candidate is a maximal run whose *cumulative* distance/time ratio over the whole run exceeds the physical limit, not a single sample. Cross-check any candidate against the archive's own decimation-ratio quality signal (Phase 27) before scoring it — a stream already flagged severely decimated needs a materially higher bar or a run-length floor (e.g., sustained over ≥2 consecutive advancing samples) before a burst counts.

**Warning signs:**
A calibration sweep whose flagged-stream count tracks the 53%-decimated cohort almost 1:1 (déjà vu of the 1,081/1,873 number). Any activity whose device stair-steps and gets flagged as containing a "slew" every stair.

**Phase to address:**
Unreliable-segment detection (the first target feature) — this is the phase's own defining research question; the calibration artifact must show the detector's flagged population is disjoint from (or explicitly filtered against) the decimation-severe cohort.

---

### Pitfall 2: Genuine fast running (strides, downhill) misclassified as a slew

**What goes wrong:**
v2.2 already found a Suunto reporting 17 m/s over one real second on a descent, decided by policy to flag-not-correct it. A speed-limit threshold picked without a margin above genuine device over-measurement will demote real downhill/stride efforts, not just slews — the opposite failure from Pitfall 1, on the same knob.

**Why it happens:**
The temptation is to pick a single "physical speed limit" that feels safe (say, 10-12 m/s, elite sprint pace) because that's what a human *should* be capable of. But this archive already has a verified genuine 17 m/s sample and a verified genuine ~29.5 m/s slew cap from the same investigation — the two populations are close enough in magnitude that a threshold chosen from intuition rather than measurement will straddle both.

**How to avoid:**
Calibrate the threshold from the archive's own measured genuine-vs-slew gap (17 m/s genuine max observed vs ~29.5 m/s measured slew rate), the same way `CEILING_K` in `best-effort-ceiling.ts` was derived from an observed max/p90 ratio rather than chosen. Require the calibration artifact to name both boundary cases explicitly (the Suunto 17 m/s descent must stay *unflagged*; the three scoping activities' bursts must be flagged) as permanent regression fixtures, mirroring how `28-CEILING-CALIBRATION.md` pins the argmax distance.

**Warning signs:**
A threshold set as a round number ("20 m/s") with no cited measurement. The Suunto descent activity's severity signal changing when the new detector ships.

**Phase to address:**
Unreliable-segment detection — the calibration must be measured against both the genuine-fast and slew populations, not just the slew population.

---

### Pitfall 3: Capped slews diluted below detection because they're spread over several samples

**What goes wrong:**
Not every device slews in one giant sample. Some may interpolate the resume-jump across 2-4 samples at a lower per-sample speed that individually clears a per-sample threshold, while the *segment* still carries an unreasonable amount of distance for its elapsed time. This is the exact mechanism that already defeated v2.2's ceiling: a 100-170 m burst diluted into a 400 m window sits at ~5.0 m/s, just under the 5.11 m/s ceiling. A per-sample gate is the same mistake one layer down — a burst diluted across a handful of samples instead of one 400 m window.

**Why it happens:**
Detection logic naturally starts at the sample level because that's the shape of the data (`t[]`, `d[]` pairs). Extending a per-sample check to "does this run of samples carry more distance than physically plausible for its time," rather than "is any single sample too fast," requires deliberately choosing a windowed/cumulative test — the natural first draft won't do it.

**How to avoid:**
Score every maximal run of consecutively-advancing samples by its own aggregate implied speed (`Σd / Σt` over the run), not by any single sample within it, and merge overlapping/adjacent candidate runs before scoring — same idea as `computeFlatRunDurations`'s maximal-run grouping. Sweep the archive at multiple run-length windows (not just single-sample) during calibration and confirm the detector still finds the three scoping activities' known bursts (106s/1,694m; a single 1s/199m hidden-pause burst; five 2-5s/25-52m isolated jumps).

**Warning signs:**
The calibration finds fewer flagged bursts than the crude reference sweep (259 of 1,873 streams with ≥100m excess above 7 m/s) without a principled reason for every activity that dropped out — silent under-detection looks identical to "the calibration is stricter," so it must be checked against the three known-positive scoping activities every run.

**Phase to address:**
Unreliable-segment detection, specifically its calibration step.

---

### Pitfall 4: Slew distance split across BOTH sides of a gap, and the merge only looks one direction

**What goes wrong:**
v2.2's own retrospective note in PROJECT.md flags this exactly: "the v2.2 'only 9 activities advance >100m across a ≥30s gap' measured the gap interval alone and missed distance dumped into the adjacent bursts." A detector that only looks at the burst *immediately following* a gap's end (because that's the intuitive "resuming GPS" story) will miss contamination the recording app wrote *before* the gap starts too — some devices write a last "best guess" jump at loss-of-signal, not only at reacquisition.

**Why it happens:**
The natural mental model is "gap ends, GPS reacquires, one slew burst follows." The measured facts in this milestone's own scoping note only describe trailing-side bursts (all 30 of 3475724402's bursts are gap-adjacent) — but that's a sample of three activities, not a proof that every gap only slews on exit.

**How to avoid:**
When merging a slew burst with an adjacent gap into one segment, inspect the maximal advancing run on **both** sides of the gap boundary (the run ending at the gap's start, and the run starting at the gap's end) and merge whichever side(s) independently exceed the run-level threshold from Pitfall 3. Do not assume trailing-only. Calibrate specifically by re-measuring the "distance advance across a ≥30s gap" figure on the *merged segment* (gap + both adjacent bursts) rather than the gap interval alone, exactly as PROJECT.md flags as still owed ("to be re-measured on the merged segment").

**Warning signs:**
A merged-segment distance accounting that only ever grows on the post-gap side in every test fixture — if the detector's own unit tests never exercise a leading-side burst, that's a coverage gap masquerading as a validated feature.

**Phase to address:**
Unreliable-segment detection — the segment-merging logic specifically, with a dedicated leading-side-burst fixture.

---

### Pitfall 5: Threshold circularity — the calibration population still contains what it's trying to exclude

**What goes wrong:**
`best-effort-ceiling.ts`'s own docblock states the non-circularity rule explicitly: "a ceiling cannot be computed from anything the ceiling itself would reject." The same trap applies here in two directions: (a) calibrating the slew speed threshold from a population that already includes uncorrected slews inflates the apparent "normal" range, raising the threshold and under-detecting; (b) deriving the pause-vs-walked-vs-transported gap-classification speed bands from a population where unreliable segments haven't been excluded yet contaminates the very bands meant to classify around them.

**Why it happens:**
Calibration naturally runs against "the archive as it exists today," and the archive as it exists today is exactly the thing this milestone is scoped to fix. Without a deliberate exclusion step, every derived constant (slew threshold, gap-classification speed bands, forgotten-stop near-zero threshold) risks being calibrated from a population it should be judging.

**How to avoid:**
State explicitly, in the calibration artifact for every new constant, what population it was derived from and confirm that population excludes (or is provably insensitive to) the phenomenon the constant detects — the same discipline `CEILING_K`'s docblock already models ("Phase 27's D-02 anti-quota rule forbids moving this value to change a demotion count"). For gap classification (stationary/walked/transported), derive speed bands from gap+burst pairs with the slew contamination already stripped, not raw implied speed across the naive gap interval.

**Warning signs:**
A threshold or band boundary that moves noticeably between two calibration runs taken a week apart without an explanation tied to archive growth — the same pattern PROJECT.md already recorded for the ceiling's own drift ("the archive drifted against the planning discussion's numbers within a week").

**Phase to address:**
Every phase that derives a new constant from the archive (unreliable-segment detection, gap classification, forgotten-stop threshold) — each needs its own stated non-circularity argument, not just the ceiling's.

---

### Pitfall 6: New unreliable-segment class double-counts with the existing gap/pause classes and breaks the coverage identity

**What goes wrong:**
`classifyGaps` currently guarantees `coveredSec + recordingGapSec + pauseSec === spanSec` by strict-priority classification (never two independent overlapping checks) precisely because "independent checks can double-count a segment into more than one category and break the exact-sum identity" (the module's own Pitfall 3 comment, verified in `pace-derivation.ts`). Introducing a fourth category (`unreliable-segment`) as a bolt-on check run *after* `classifyGaps` risks classifying the same real-time span as both `covered`-plus-fast and `unreliable`, or double-subtracting time already counted as `recording-gap`/`pause` from `coveredSec`.

**Why it happens:**
The natural implementation path is "run the existing classifier, then separately run the new slew detector over the result and subtract" — two passes that were never designed to compose, exactly the shape the existing code comment warns against.

**How to avoid:**
Fold `unreliable-segment` into the SAME strict-priority decision tree as `recording-gap`/`pause`/`covered` (a fourth branch, evaluated in a defined priority order against the other three, not a second independent sweep), and extend the exact-sum identity to `coveredSec + recordingGapSec + pauseSec + unreliableSec === spanSec`, re-verified across the full archive (the project's own bar, "zero violations across 1,865 streams," must be re-established for the four-way split, not just carried over from the three-way one).

**Warning signs:**
The coverage identity check passing on the pre-existing three categories but never being extended to include the new one — a green three-way test suite that never notices a four-way violation because it isn't looking for one.

**Phase to address:**
Unreliable-segment detection and pace/histogram clipping — the identity re-verification must be part of this phase's own recount, not deferred.

---

### Pitfall 7: Clean-window best-effort search returns a window that merely abuts the excluded segment

**What goes wrong:**
`findBestEffort`'s two-pointer sweep integrates by interpolating the exact crossing time between the last two samples of a window (`t[j-1]` + frac × (`t[j]` - `t[j-1]`)). If "exclude windows spanning an unreliable segment" is implemented by simply deleting the unreliable samples from `t[]`/`d[]` and re-running the same sweep, the sweep will happily interpolate a crossing that straddles the SPLICE POINT — i.e., it stitches the sample just before the excised segment directly to the sample just after it, treating the removed segment's distance as if it were covered in zero time. This doesn't just fail to reject the contaminated window; it can manufacture an even faster fabricated one at the stitch, or hand back a "clean" window whose start or end sample sits exactly on the excluded segment's boundary, carrying an interpolation artifact from the excluded burst's own crossing-time math.

**Why it happens:**
`findBestEffort` was designed for one gap-free, monotonically increasing `(t, d)` series. Splicing out samples and re-running it treats the two segments either side of the splice as physically adjacent — the same class of bug as computing an average by including a period with no real measurement.

**How to avoid:**
Never delete-and-restitch. Instead, partition the stream into independent clean sub-intervals at the boundaries of every unreliable segment (and every existing gap, since a best effort already may not span a gap) and run `findBestEffort` separately per sub-interval, never crossing a boundary in either direction. Additionally, treat a window's start/end sample landing exactly at a sub-interval boundary as suspect — assert in the calibration/regression suite that the returned clean window's interpolated crossing times fall strictly inside a single sub-interval, with a fixture built from one of the three scoping activities' actual burst boundaries (e.g., 3475740390's 400m best starting at t=2508, exactly on the 52m jump, must move under the fix and the test must assert where it moves to, not just that it moves).

**Warning signs:**
The "best clean window" for a demoted effort recomputes to a duration suspiciously close to the original contaminated one, or its start/end offset sits within a sample or two of the excluded segment's boundary — either is the searchable window abutting rather than avoiding the excision.

**Phase to address:**
Best efforts / clean-window search — needs its own demonstrated-failing-then-passing fixture built from a real splice boundary, mirroring how Phase 28's CR-01 recount was shown failing on the pre-fix archive before being trusted.

---

### Pitfall 8: Removing contaminated efforts shifts the ceiling population, re-litigating settled demotions

**What goes wrong:**
PROJECT.md states this explicitly as a known risk: "contaminated efforts currently sit inside the population the personal ceiling's p90 is derived from; removing them moves the ceiling, which can demote or reinstate OTHER efforts" — v2.2 already saw one record change hands over a 0.002 m/s margin during a routine archive merge, with no code change at all. Once unreliable-segment detection exists and demotes/excludes some efforts from the `findBestEffort` population, `deriveCeiling`'s p90 (and therefore every distance's ceiling) shifts, which can silently promote a previously-demoted effort back above the (now-lower) ceiling, or push a previously-clean effort over a (now-higher, if contamination inflated the tail) ceiling.

**Why it happens:**
`deriveCeiling` is deliberately population-sensitive by design (that's the whole point of a personal, self-derived ceiling) — but that means ANY change to what counts as a valid effort ripples through every distance's ceiling, not just the directly-fixed one. The project has already demonstrated this ripple is real, not hypothetical (the `3475730418@1mi` case).

**How to avoid:**
Treat the post-fix ceiling recalibration as a first-class deliverable, not a side effect: regenerate `28-CEILING-CALIBRATION.md`-equivalent artifacts against the corrected population, produce a signed before/after diff exactly like `28-DIFF.md` (the milestone's own scoping text already commits to "an archive-wide before/after diff signed by the developer" for best efforts — extend the same discipline to the ceiling), and expect and report record changes rather than being surprised by them. Order operations explicitly: unreliable-segment exclusion must run BEFORE ceiling derivation in the same three-pass shape `compute-best-efforts.ts` already uses (accumulate → derive ceiling → filter-and-flag), not after — deriving the ceiling first and retrofitting exclusions later would repeat the exact "18 = 18" blind-spot failure from Phase 28 Round 1, where the ceiling itself never saw what it needed to reject.

**Warning signs:**
A ceiling recalibration that reports zero record changes — given the ceiling already moved by 0.002 m/s from nine ordinary new activities, a population change from removing dozens of contaminated efforts reporting *no* movement is itself suspicious and should be independently re-derived before being trusted.

**Phase to address:**
Best efforts (clean-window search) phase, coordinated with whichever phase computes/recomputes the ceiling — the recalibration and signed diff belong in the same phase as the exclusion logic, not deferred.

---

### Pitfall 9: Walking breaks misclassified as forgotten stops (and vice versa)

**What goes wrong:**
Gap classification (stationary/walked/transported) and forgotten-stop detection (sustained near-zero speed *inside recorded time*) are two different mechanisms answering related-sounding questions, and a shared or poorly-separated near-zero-speed threshold can conflate them: a deliberate walking break recorded with continuous timestamps (no gap) at near-zero pace looks identical, on a bare speed threshold, to a forgotten stop. PROJECT.md's own decisions section is explicit that "nothing in the data distinguishes a deliberate rest from a forgotten stop" — which means the forgotten-stop detector cannot actually determine intent, only sustained near-zero speed, and must not silently borrow the gap classifier's "walked" threshold as if the two questions collapse into one.

**Why it happens:**
Both mechanisms key off similar signals (implied speed near zero), so it's tempting to implement one as a special case of the other, or to reuse one threshold for both. But gap classification only applies to non-covered time (across a gap/pause boundary already established by `classifyGaps`), while forgotten-stop detection applies inside `covered` time with no gap at all — different denominators, different meaning, and conflating them either double-flags a single real pause (once as "walked gap," once as "forgotten stop") or under-flags because one mechanism's threshold absorbs the case the other was meant to catch.

**How to avoid:**
Keep the two mechanisms structurally distinct with different inputs: gap classification operates on `GapInterval` objects (already-classified non-covered spans) and their implied speed; forgotten-stop detection operates on `covered` spans only, looking for a *sustained* near-zero-speed sub-run (same maximal-run technique as pause detection) that never became a `pause`/`recording-gap` in the first place. Document explicitly, per the milestone's own decision, that forgotten-stop is flag-only with no time removed — it must never feed back into `coveredSec`/`pauseSec` accounting, or it silently violates the exact-sum identity from Pitfall 6.

**Warning signs:**
An activity carrying both a "walked" gap classification and a "forgotten stop" flag on the same time span, or the forgotten-stop count changing when the pause threshold multiplier (`PAUSE_GAP_P90_MULTIPLIER`) changes — that coupling would mean the two detectors aren't actually independent.

**Phase to address:**
Gap classification and Forgotten-stop detection — should probably be reviewed together even if built as separate work, specifically for shared-threshold coupling.

---

### Pitfall 10: GPS drift while stationary accrues phantom "covered" distance below any slew threshold

**What goes wrong:**
Multipath/GPS drift while genuinely stationary (e.g., indoors near a building at a race start, or during a phone-in-pocket recording) can walk the recorded position steadily in one direction for tens of seconds before snapping back, each individual hop looking like a plausible walking/running speed (not a dramatic slew) — general GPS-tracking literature documents exactly this failure mode leaking tens of metres of phantom distance with a live speed readout in the 7-30 km/h range for the duration (MEDIUM confidence, general domain, not yet measured against this archive). Because each hop is individually unremarkable, it clears both the slew threshold (Pitfall 1-3) and a naive forgotten-stop threshold (each sample looks like slow movement, not zero movement) — it sits in the gap between the two new detectors this milestone adds.

**Why it happens:**
The unreliable-segment detector is being calibrated against the three scoping activities' documented mechanism (capped resume-slew after a pause/signal-loss), which is a *different* failure mode from ordinary multipath drift during otherwise-continuous recording. A detector tuned only to catch capped ~29.5 m/s slews has no reason to catch a steady 1-2 m/s drift that never trips any single-sample threshold.

**How to avoid:**
Since this milestone's forgotten-stop mechanism already looks for "sustained near-zero speed inside recorded time" via a maximal-run technique, extend its net wide enough to also catch "sustained LOW-but-nonzero implied speed with no corresponding elevation/HR change" as a distinct, separately-labelled finding rather than assuming the unreliable-segment detector's speed-limit test will catch it (it structurally can't — drift is too slow to be a slew). If out of scope for v2.3, say so explicitly in scoping/PITFALLS rather than let it silently fall between the two new detectors' cracks. At minimum, run the archive sweep and report whether any activity's forgotten-stop candidate flat run shows non-trivial "covered" distance accruing across it — that number itself is diagnostic.

**Warning signs:**
A forgotten-stop flag whose window shows non-zero `coveredSec` distance accumulating steadily rather than zero.

**Phase to address:**
Forgotten-stop detection — worth an explicit scoping note on whether GPS-drift-while-stationary is in scope; if deferred, record it the way v2.2 deferred stream re-derivation, with a named reason rather than silence.

---

### Pitfall 11: Verification recount shares the classifier's blind spot ("N = N")

**What goes wrong:**
This is the single most-repeated defect shape across v2.1 and v2.2 (Phase 23 CR-01, Phase 28 CR-01, Phase 27 G-01/G-04) and RETROSPECTIVE.md names it as the top cross-milestone lesson: "two artifacts can share a blind spot and agree perfectly." A recount script for the new unreliable-segment count, the new gap-classification distribution, or the new forgotten-stop count that imports (by any spelling — a re-export counts, per the Phase 31 `export { x } from` lesson) the same classifier it's meant to independently verify will pass on the defect's own output, exactly like Phase 28's "18 = 18."

**Why it happens:**
Writing a truly independent recount is more work than writing a thin wrapper around the same function, and the wrapper *looks* like a recount (it's a separate file, it runs standalone) while structurally being the same computation.

**How to avoid:**
For every headline number this milestone produces (unreliable-segment count, merged-segment distance/time totals, clean-window diff, gap-classification counts, forgotten-stop count), write the recount from the archive's committed data with zero imports of the new detection module, verified by the same structural "zero imports, by any spelling" test Phase 27/31 already established. Demonstrate the recount FAILING on a deliberately mutated/pre-fix input before trusting it — the Phase 28 pattern exactly.

**Warning signs:**
A recount whose only import from `src/` is the type definitions, not the logic — that's actually fine (types aren't the classifier); the warning sign is importing any function that does the classification itself, or importing a helper the classifier itself calls.

**Phase to address:**
Every phase in this milestone that ships a headline calibration number — should be a standing requirement, not phase-specific.

---

### Pitfall 12: A synthetic fixture that "looks like" a slew/pause/jump but doesn't discriminate the real one

**What goes wrong:**
Memory and RETROSPECTIVE.md both flag this exact shape: "a convenient look-alike fixture inverted a severity call" and Phase 23's CR-01 survived three clean human rounds because every fixture only asserted internal self-agreement. For this milestone, a hand-built synthetic `(t, d)` array meant to exercise the slew detector risks NOT reproducing the archive's actual decimation-aliasing shape (alternating full/zero distance at a 2-3s floor) or the archive's actual capped-slew magnitude (~29.5 m/s, not a round number) — a fixture built from intuition rather than from one of the three scoping activities' real numbers can pass the detector for the wrong reason, or fail to reject decimation noise the detector needs to reject.

**Why it happens:**
Synthetic fixtures are quicker to author and reason about than replaying real archive data, and "detects >X m/s" is easy to write a fixture for; "doesn't fire on decimation aliasing at a 2-3s floor" or "doesn't fire on a genuine 17 m/s descent" require deliberately encoding the archive's own measured pathology into the fixture, which is easy to skip.

**How to avoid:**
Build the calibration/regression fixtures from the three named scoping activities' actual measured numbers (3475724402's 18 gaps/30 bursts/1,694m/106s; 3475734189's t=1353-1360 199m hidden-pause burst with HR 163→155; 3475740390's five 25-52m jumps at km 6.9-7.7, including the 52m jump the 400m best starts on) rather than hand-rolled round numbers, and pair every positive fixture with a negative control drawn from the archive's own decimation-aliased and genuine-fast-descent populations (the Suunto 17 m/s case). Assert reachability in BOTH directions — the detector must be shown failing (over- or under-firing) on the pre-fix version before the fix is trusted, per the project's own load-bearing habit.

**Warning signs:**
A fixture whose numbers are round (exactly 10 m/s, exactly 30 s) rather than traceable to a specific archive activity ID. A fixture suite with only positive cases and no negative controls drawn from known-tricky archive populations (decimation, genuine descent).

**Phase to address:**
Every detection phase (unreliable-segment, gap classification, forgotten-stop) — fixture provenance should be a review checklist item.

---

### Pitfall 13: Generated calibration/diff artifacts silently revert or diverge on regeneration

**What goes wrong:**
v2.2 hit this twice: a hand-corrected prose figure in `27-CALIBRATION.md` reverted 42 lines including the correction itself when the generator re-ran (G-01), and Phase 31's regeneration-twice discipline was what caught it. This milestone will ship at least as many regenerable artifacts (unreliable-segment calibration, merged-segment distance re-measurement, clean-window before/after diff, ceiling recalibration diff, gap-classification calibration) and the same trap applies to every one: hand-editing a generated report's prose without fixing the generator is not a fix.

**Why it happens:**
Fixing a wrong number in a markdown file by hand is faster than tracing it back to the script that produced it, especially under time pressure near a phase close, and the file looks fixed afterward — until the next regeneration silently reverts it.

**How to avoid:**
Regenerate every artifact of record TWICE and diff before committing (the exact discipline Phase 31 established as a pattern), and route every correction through the generator, never the prose file directly. Sign diffs against a content hash (sha256), as `28-DIFF.md` does, so a stale sign-off is detectable.

**Warning signs:**
A calibration artifact whose git history shows a hand-edit to a `.md` file with no corresponding change to the `scripts/*.mjs` (or equivalent) that produced it.

**Phase to address:**
Every phase producing a calibration/diff artifact — regeneration-twice-and-diff should be a standing closure gate, not phase-specific.

---

### Pitfall 14: New CUR-04 write action reopens the publish-safety guard surface

**What goes wrong:**
CUR-04 ("reviewed and kept" queue action) is a new write path into the curation system. Phase 24/29 already established that this project's curation write path needs TWO independent guards (a build-time content scan and an HTTP-layer assertion) because a single guard was shown to pass `tsc --noEmit` while failing a real divergence — and Phase 29's own carried-forward WR-04 already documents a related defect where ticking a pending row exposed a no-op "Remove exclusion" that silently discarded a typed reason. A naive CUR-04 implementation that adds a new mutation without running it through the SAME `saveExclusion`/`removeExclusion`/`runRecompute` transport Phase 29 established (rather than a new ad hoc endpoint) reopens exactly the guard-duplication risk Phase 24's retrospective calls out.

**Why it happens:**
"Reviewed and kept" is semantically different from "excluded" (it's a positive dismissal, not a removal), which invites writing it as a parallel code path rather than routing it through the existing transport with a new action/state value.

**How to avoid:**
Extend the existing exclusion-queue data model and transport with a new state (e.g., `reviewed` distinct from `excluded`) rather than adding a second write mechanism, and re-run both existing publish guards (`findCurationArtifacts` / `verify-dashboard-publish.mjs`) against the extended surface, demonstrating them red under a planted leak of the new state exactly as Phase 29 did for the original.

**Warning signs:**
A new API route or file distinct from the queue's existing write path. The publish-guard tests not being updated at all when CUR-04 lands (a sign the guard's scan didn't even notice a new surface exists).

**Phase to address:**
CUR-04 queue dismiss action.

---

### Pitfall 15: Unreliable-segment computation leaks into `data/streams/` or drifts from byte-identical

**What goes wrong:**
The milestone's own goal statement requires "`data/streams/` stays byte-identical" while unreliable segments are "derived at compute time." A caching/staging shortcut — writing a per-activity "unreliable segments" sidecar file that gets checked in alongside the stream, or worse, mutating a stream file to splice out contaminated samples for convenience during development — violates the explicit non-goal and risks the exact class of defect the project's own memory already recorded once (`build-widgets` mtime-skip silently no-oping on locally-edited `dist/` files masking a stale artifact, and the Phase 26 sibling where a gitignored `index.json` predating a new signal broke the publish gate).

**Why it happens:**
Recomputing unreliable segments from scratch on every request/build is more expensive than caching them once, and a developer under time pressure may reach for a committed sidecar cache "just for now."

**How to avoid:**
Derive unreliable segments purely at compute time from the committed `t[]`/`d[]` stream, the same way `classifyGaps`/`derivePaceWithCoverage` already do for gaps/pauses — no new file under `data/streams/`. If a precomputed artifact is needed for dashboard performance (analogous to the `pace-quality/{id}.json` shards), keep it in the existing `data/stats/` sibling location, versioned the same way, and verify `data/streams/` is byte-identical with a checksum gate in CI before the phase closes, the same class of check that caught the stale `geo-metadata.json` in Phase 31 (TD-02).

**Warning signs:**
Any diff touching a file under `data/streams/` during this milestone's execution. A new file appearing that isn't clearly namespaced the way `pace-quality/{id}.json` is.

**Phase to address:**
Unreliable-segment detection — should be gated by an explicit "`data/streams/` byte-identical" CI check from the first phase, not verified only at milestone close.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Per-sample speed threshold instead of run-level aggregate | Simpler code, fewer lines | Re-manufactures the 1,081/1,873 decimation false-positive population (Pitfall 1) | Never — the archive's own measured aliasing rules this out |
| Deleting unreliable samples and re-running `findBestEffort` unmodified | Reuses existing sweep with zero new logic | Stitches across the splice, fabricating or under-rejecting windows (Pitfall 7) | Never for production; acceptable only as a demonstrated-failing negative-control fixture |
| Reusing the near-zero-speed threshold for both gap classification and forgotten-stop detection | One constant instead of two | Conflates two semantically distinct findings (Pitfall 9) | Never — the two mechanisms operate on different denominators (non-covered vs covered time) |
| Hand-editing a calibration report's stale number after regenerating once | Fast, unblocks a checkpoint | Silently reverts on the next regeneration (Pitfall 13, v2.2's G-01) | Never — always fix the generator |
| Committing a sidecar "unreliable segments" cache file under `data/streams/` for dev convenience | Faster local iteration | Violates the explicit byte-identical non-goal; risks stale-cache bugs the project has already hit twice | Never; use `data/stats/` if caching is needed at all |
| Deferring the ceiling recalibration diff to "later, if needed" | Ships unreliable-segment detection sooner | Silently leaves stale demotions/promotions live against a population that's known to have moved (Pitfall 8) | Never — must ship in the same phase as the exclusion logic that changes the population |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|--------------|-----------------|-------------------|
| `classifyGaps` (existing gap/pause classifier) | Bolting the new `unreliable-segment` class on as a second independent pass over the classifier's output | Fold it into the same strict-priority decision tree and re-verify the exact-sum identity across all four categories archive-wide |
| `findBestEffort` (existing two-pointer sweep) | Splicing out excluded samples and re-running the sweep unmodified over the spliced array | Partition into independent clean sub-intervals at every exclusion/gap boundary; never let the sweep cross a boundary |
| `best-effort-ceiling.ts` (existing personal ceiling) | Deriving/reporting the ceiling before unreliable-segment exclusion has run against the effort population | Run exclusion strictly before ceiling derivation, in the same three-pass shape `compute-best-efforts.ts` already uses; ship a signed before/after diff in the same phase |
| Curation queue transport (`saveExclusion`/`removeExclusion`/`runRecompute`) | CUR-04 implemented as a new endpoint/state outside the existing transport | Extend the existing transport and state model with a `reviewed` value; re-run both existing publish guards against the extended surface |
| Quality-signal index row / shard (Phase 27's `DASHBOARD_INDEX_SCHEMA_VERSION`) | Adding new signals (unreliable-segment severity, gap classification, forgotten-stop) with an unguarded `row.quality.X` destructure the way `qualityBadgeSpecs` originally did (Phase 27's G-04) | Guard every new field read the way `rowIsAnySevere`/`rowPaceDisagreement`/`detail.ts` already do; add a regression test for a stale index row missing the new key |
| Nightly CI (commits to `origin/master` under this milestone's own calibration artifacts) | Executing the whole milestone against a fixed archive snapshot and merging only at close, as v2.2 did (402 commits, one record changed hands) | Merge origin at least once per phase (the project's own recorded ⚠️ Revisit decision), and re-run any archive-wide calibration after each merge |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Re-running `findBestEffort`'s O(n) two-pointer sweep once per clean sub-interval, per distance, per activity, with no shared precomputation | CI compute step time grows noticeably for the ~1,899-activity archive | Precompute exclusion/gap boundaries once per activity and reuse across all seven target distances (400m..marathon), same as the existing single-pass sweep already does per distance | Unlikely to bite at this archive's scale (≤1,899 activities, streams capped at `MAX_SAMPLES = 3000`), but a naive re-derivation of `classifyGaps` output inside each distance's loop would multiply work needlessly |
| Recomputing unreliable-segment classification on every dashboard page load (no server-side caching, static-SPA constraint) | Detail view for a heavily-decimated/high-sample activity feels slow to render client-side | Compute at CI time into the existing lazy per-activity shard pattern (`data/stats/pace-quality/{id}.json`-style), not client-side on every view | Only matters if a future activity has close to `MAX_SAMPLES` and the detection logic is non-trivially more than O(n) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| CUR-04 implemented as a new write route bypassing the existing origin-gated, atomic-write curation transport | Reopens the exact class of leak the two independent publish guards exist to catch (a write path reachable from the published bundle) | Route through the existing `saveExclusion`/`removeExclusion`/`runRecompute` transport only; re-verify both guards red-then-green against the new state, per Phase 24/29 discipline |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| "Pace disputed" badge (stream-derived vs metadata pace) flapping on borderline unreliable-segment-affected activities | Developer (sole user) loses trust in the badge if it fires inconsistently near the detection threshold | Reuse PACE-07's pattern of a clear ratio-and-threshold gate, and disclose the unreliable-segment contribution explicitly in the disagreement reason string, the same register `ceilingDemotion`'s reason already uses |
| Forgotten-stop flag presented identically to a "walked" gap classification on the activity detail view | The developer can't tell at a glance which mechanism fired, defeating the point of having two distinct signals | Visually and textually distinguish the two (different badge, different section), per Pitfall 9 |
| Clean-window best-effort demotion shown without disclosing WHERE the new clean window moved to (only that the old one was demoted) | Developer can't sanity-check whether the replacement window is itself suspicious (e.g., abutting the exclusion, per Pitfall 7) | Show both the demoted window's reason AND the new best clean window's start/end offsets on the detail view, mirroring how ceiling demotions already show their margin and population |

## "Looks Done But Isn't" Checklist

- [ ] **Unreliable-segment detection:** Often missing verification against the genuine-fast-descent negative control (Suunto 17 m/s) — verify the calibration artifact names it explicitly as an unflagged case, not just the three positive scoping activities.
- [ ] **Unreliable-segment detection:** Often missing leading-side (pre-gap) burst coverage — verify a dedicated fixture exercises a burst BEFORE a gap's start, not only after its end (Pitfall 4).
- [ ] **Coverage/pace clipping:** Often missing the four-way exact-sum identity re-verification archive-wide — verify the new `unreliableSec` term is included in the identity check across the FULL archive count at time of close, not just the three scoping activities.
- [ ] **Best-effort clean-window search:** Often missing a check that the returned window doesn't abut the excluded segment — verify with a fixture built from 3475740390's real 52m-jump boundary (the 400m best that starts exactly on it today).
- [ ] **PR ceiling:** Often missing a re-derived, re-signed before/after diff after unreliable-segment exclusion changes the population — verify a diff artifact exists for the ceiling itself, not only for best efforts.
- [ ] **Gap classification:** Often missing separation from forgotten-stop detection — verify no single time span can carry both a gap-classification label and a forgotten-stop flag simultaneously.
- [ ] **CUR-04:** Often missing reuse of the existing curation transport and both publish guards — verify the guard tests were touched (shown red-then-green) when CUR-04 landed, not left untouched.
- [ ] **Every calibration artifact:** Often missing two-run idempotence — verify each generator was run twice and diffed with zero unexplained delta before being committed as an artifact of record.
- [ ] **Every headline recount:** Often missing a demonstrated-failing run on a pre-fix or mutated input — verify the recount script has a committed test/log showing it FAILED before the fix, not only that it currently passes.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Per-sample threshold re-triggering on decimation noise (Pitfall 1) | MEDIUM | Re-run the run-level aggregate detector, re-sweep the archive, diff flagged-activity counts against the decimation-severe cohort, and re-derive any dependent artifact (clipping, ceiling) |
| Clean-window search abutting the exclusion (Pitfall 7) | MEDIUM-HIGH | Requires re-deriving `findBestEffort` per clean sub-interval (structural fix, not a threshold tweak), then regenerating and re-signing the best-effort diff and any ceiling recalibration downstream |
| Ceiling population shift undetected (Pitfall 8) | HIGH | Requires a full archive-wide ceiling recalibration, a new signed diff, and manual reconciliation of every effort whose demotion status flipped — the same one-day-cost pattern Phase 31's TD-05 already demonstrated is tractable |
| Shared-blind-spot recount (Pitfall 11) | LOW-MEDIUM | Rewrite the recount with zero imports of the classifier, add the structural "zero imports, any spelling" test, demonstrate it failing on a mutated input before re-trusting it — Phase 27/31 already have a template |
| Generated artifact silently reverted (Pitfall 13) | LOW | Fix the generator, not the prose; regenerate twice, diff, re-commit — Phase 31's exact playbook |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Decimation-aliasing false positives (P1) | Unreliable-segment detection | Calibration sweep's flagged population checked disjoint from the decimation-severe cohort |
| Genuine fast running misclassified (P2) | Unreliable-segment detection | Suunto 17 m/s descent activity pinned as a permanent unflagged regression fixture |
| Diluted multi-sample slews (P3) | Unreliable-segment detection | Run-level (not per-sample) aggregate test against all three scoping activities' known bursts |
| Split-gap bursts missed on one side (P4) | Unreliable-segment detection | Dedicated leading-side-burst fixture; merged-segment distance re-measured, not gap-interval-only |
| Threshold circularity (P5) | Every constant-deriving phase | Calibration artifact states its population explicitly excludes what it detects |
| Coverage identity broken by new class (P6) | Unreliable-segment + clipping phase | Four-way exact-sum identity re-verified archive-wide, zero violations |
| Clean-window abuts exclusion (P7) | Best-effort clean-window search | Fixture from 3475740390's real 52m-jump boundary; crossing times asserted strictly inside one sub-interval |
| Ceiling population shift (P8) | Best efforts + ceiling recalibration | Signed before/after diff for the ceiling itself, not only for individual efforts |
| Walking break vs forgotten stop conflated (P9) | Gap classification + Forgotten-stop detection | No time span carries both labels; independence from the pause-threshold multiplier verified |
| Stationary GPS drift phantom distance (P10) | Forgotten-stop detection (or explicit non-goal) | Archive sweep reports whether any forgotten-stop candidate shows non-zero accruing distance; scoped in or explicitly deferred |
| Shared-blind-spot recount (P11) | Every headline-number phase | Zero-import structural test; demonstrated-failing-then-passing on mutated input |
| Vacuous synthetic fixture (P12) | Every detection phase | Fixtures traced to the three named scoping activity IDs; negative controls from decimation/genuine-fast populations |
| Non-idempotent generated artifact (P13) | Every calibration/diff-producing phase | Regenerated twice, diffed, zero unexplained delta before commit |
| CUR-04 reopens guard surface (P14) | CUR-04 queue dismiss action | Both existing publish guards shown red-then-green against the new state |
| `data/streams/` drift (P15) | Unreliable-segment detection (from its first phase) | CI checksum gate on `data/streams/` byte-identity, checked every phase, not only at milestone close |

## Sources

- `.planning/PROJECT.md` § Current Milestone: v2.3, § Key Decisions, § Requirements (Validated) — primary source for all archive-measured facts (HIGH confidence, verified by direct read)
- `.planning/RETROSPECTIVE.md` — v2.1 and v2.2 milestone retrospectives, cross-milestone lessons (HIGH confidence)
- `src/analytics/pace-derivation.ts` — `classifyGaps`, `derivePaceWithCoverage`, coverage-identity mechanics (HIGH confidence, verified by direct read)
- `src/analytics/best-effort-ceiling.ts` — `deriveCeiling`, `ceilingDemotion`, non-circularity discipline (HIGH confidence, verified by direct read)
- `src/analytics/best-effort-utils.ts` — `findBestEffort` two-pointer sweep mechanics (HIGH confidence, verified by direct read)
- [GPS: indoor multipath drift can still inflate distance/speed for tens of seconds](https://github.com/sjefferson99/simple-activity-tracker/issues/52) — general corroboration for Pitfall 10 (MEDIUM confidence, general domain, not archive-verified)
- [Physics-Guided Abnormal Trajectory Gap Detection](https://arxiv.org/pdf/2403.06268) — general corroboration for run-level vs sample-level anomaly detection framing (LOW-MEDIUM confidence, general domain)

---
*Pitfalls research for: sample-level GPS/timing anomaly detection, segment-excluding best-effort search, gap classification, forgotten-stop flagging — strava-widgets v2.3*
*Researched: 2026-09-19*
