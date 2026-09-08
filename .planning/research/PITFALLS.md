# Pitfalls Research

**Domain:** Pace data-quality/cleaning added to an existing running-analytics dashboard that already ships trusted numbers over a 15-year, 1,864-activity, 4-watch archive
**Researched:** 2026-09-08
**Confidence:** MEDIUM-HIGH (time-series/statistics pitfalls are well-established domain knowledge; device-specific claims about Garmin/Suunto/GPX behaviour are MEDIUM — verify against the actual archive's streams before hard-coding device rules)

This document is scoped tightly to v2.2 Pace Data Quality as described in `.planning/PROJECT.md`: one gap-aware pace derivation replacing the two that ship today, honest coverage, a PR ceiling that binds, per-activity quality signals, a curation-mode review queue, elevation as a quality signal, and cross-era consistency — all under the constraint that `data/streams/` stays byte-identical and corrections are conservative, non-destructive, and reversible.

---

## Critical Pitfalls

### Pitfall 1: Smoothing the differentiated signal instead of the cumulative one

**What goes wrong:**
Pace/speed is a derivative (`dd/dt`). Smoothing a noisy derivative directly (as the histogram's raw `dt / (dd/1000)` does today) amplifies rather than suppresses noise, because differentiation is itself a noise-amplifying operation — you're averaging a signal that was already unstable before you started. The correct order is smooth-then-differentiate (or differentiate over a wide-enough interval that the differentiation step itself acts as the smoother, which is what the 20s centred window effectively does), not differentiate-then-smooth.

**Why it happens:**
Per-sample `dt/dd` is the obvious, "just compute pace at every point" implementation, and it's the one that already shipped in `detail-zones.ts:76`. It's easy to write, easy to reason about locally, and looks correct on clean data. The failure only shows up as a bimodal or heavy-tailed distribution once you look at the aggregate — exactly the phantom fast-mode+72%-coverage bug already documented for activity 4556693525.

**How to avoid:**
Pick one derivation strategy for the whole system: either (a) smooth the cumulative distance/time streams first with a principled window, then differentiate, or (b) compute pace over a wide-enough interval directly (interpolated crossing distance / elapsed time across a window, which is mathematically closer to (a) than to naive per-sample diffing). Whichever is chosen, it must be the *single* source every consumer (chart, histogram, splits, badges) reads from — never let two call sites reimplement the same derivative differently again.

**Warning signs:**
A bimodal or long-tailed pace distribution that doesn't match the per-km splits; two widgets on the same screen disagreeing about the same activity's pace; a "fast mode" cluster near or below world-record pace that vanishes under a wider window.

**Phase to address:**
The gap-aware pace derivation phase (replacing the two divergent derivations) — this is the foundational fix everything else in the milestone depends on. Do this before building quality signals on top of it, or the signals will be scored against a still-noisy input.

---

### Pitfall 2: Fixed-width window blind to variable sample rate

**What goes wrong:**
A window defined in *sample count* (e.g., "10 samples") means something different at 1Hz native FIT data than at the 2-3s-floor decimated output of `derive-stream.ts`'s `MAX_SAMPLES = 3000` cap. A window defined in *time* (20s) is safer but still interacts badly with decimation: once index-selection decimation has already aliased the distance signal (as it does for 995/1,864 activities), no amount of time-windowed smoothing downstream can recover the true pace — you're smoothing an already-corrupted signal and getting a plausible-looking but still-wrong answer.

**Why it happens:**
Smoothing code is usually written and tested against one representative activity (often a recent, high-sample-rate one), so a window that looks right there silently misbehaves on the 53% of the archive that went through decimation, and differently again on the 38 GPX files and 24 intervals.icu-only activities which may already be pre-smoothed by their source.

**How to avoid:**
Always define smoothing windows in elapsed time, not sample count. Separately and explicitly: treat "was this stream decimated by index selection" as an upstream data-quality fact that the new derivation must either work around (by resampling decimated streams onto a synthetic even time grid before windowing) or surface as a quality flag ("stream resolution insufficient for reliable pace below N seconds") rather than pretend the window fixes it. Test the chosen window against a decimated fixture, a native 1Hz fixture, and a coarse-only (e.g. Suunto ~1-5s irregular) fixture side by side.

**Warning signs:**
Smoothing "fixes" the phantom-fast-mode bug on the worked example but a systematic audit across the archive still shows stair-step pace clusters concentrated in the 995 decimated activities; quality scores correlate suspiciously well with `sample_count > 3000` rather than with genuine device/GPS quality.

**Phase to address:**
Gap-aware pace derivation phase. This must explicitly special-case (or at minimum flag) activities that passed through `MAX_SAMPLES` decimation — smoothing alone does not fix aliasing, only masks it.

---

### Pitfall 3: Smoothing bleeds across a pause boundary

**What goes wrong:**
A time-windowed average (centred or trailing) that spans a pause/gap treats the zero-distance, large-`dt` pause sample as if it were part of continuous motion, dragging the pace estimate toward zero (or toward infinity if computed the other way) for every real sample within one window-width of the gap. On this archive that's not a rare edge case: 1,233 activities have at least one recording gap over 10s, 321 have over 5 minutes of cumulative ≥30s gaps, and one activity has a single 127,478-second gap with +0m — a pause window wide enough to smooth real intervals will happily average straight through it unless explicitly stopped.

**Why it happens:**
Most smoothing-window implementations assume a densely, evenly sampled signal and don't check whether the window crosses a semantic discontinuity. It's an easy thing to omit because it only manifests on activities with pauses, and a naive "does it look OK" spot check on a clean 5K will never surface it.

**How to avoid:**
Treat any gap above a defined threshold (the same threshold used for "recording gap" classification) as a hard wall for the smoothing window — clip the window at the gap boundary rather than reaching across it, exactly the way a plot library breaks a line at a data discontinuity instead of interpolating across it. Where the window would need more samples than are available on one side of a boundary, either shrink it (documented, asymmetric) or mark that stretch as insufficient-window / low-confidence rather than silently produce a distorted value.

**Warning signs:**
Pace spikes (unrealistically fast or slow) that cluster at gap boundaries when overlaid against the gap-detection data already used for the elapsed-vs-moving-time signal; a fixture built with one clean pause in the middle of steady pace shows smoothed pace dipping or spiking near the pause rather than staying flat on both sides.

**Phase to address:**
Gap-aware pace derivation phase — this is explicitly named in the milestone goal ("one gap-aware pace derivation"), so gap-boundary clipping is not optional scope, it's the headline requirement.

---

### Pitfall 4: Over-smoothing destroys real interval/fartlek structure

**What goes wrong:**
A window wide enough to kill GPS noise and decimation artefacts (tens of seconds) is also wide enough to flatten genuine short, hard efforts — 30s-60s intervals, fartlek surges, hill repeats — into the surrounding average pace. The very feature that makes smoothing "work" against noise (averaging away short-timescale variation) is indistinguishable, from the window's point of view, from a real short-timescale pace change the runner actually produced.

**Why it happens:**
Smoothing width is usually tuned by eye against one or two example runs and never checked against interval sessions specifically, because interval sessions are a minority of the archive and easy to forget when validating against "typical" long runs.

**How to avoid:**
Do not pick a single global window width by fiat. Validate the chosen window against at least one known interval/fartlek session from the archive (grep for activity names/laps suggesting interval structure, or use lap markers if the source data has them) and confirm the smoothed pace still resolves the fast/slow alternation, not just that it looks clean on continuous runs. If a single window can't satisfy both goals, prefer a narrower window with gap-aware clipping (Pitfall 3) plus separate anomaly rejection (Pitfall 6) over an artificially wide window that trades away real signal for cosmetic smoothness — this matches the project's stated "conservative, don't distort real data" principle directly.

**Warning signs:**
An interval session's chart looks suspiciously smooth/rounded compared to the runner's memory of the effort; best-effort (400m/1k) calculations computed from the *smoothed* stream would move (they must not — `findBestEffort` should keep integrating over distance crossings on the underlying stream, not the display-smoothed one, exactly as the milestone's non-goals already require: "PRs move by demotion, never recalculation").

**Phase to address:**
Gap-aware pace derivation phase for window choice; validated again in the per-activity quality signals phase if a "stair-step ratio" or similar signal risks conflating real intervals with device noise — that signal needs its own interval-aware validation, not just device-noise validation.

---

### Pitfall 5: Cumulative-signal window vs already-differentiated window are not interchangeable

**What goes wrong:**
Smoothing distance-over-time and then differentiating gives a materially different (and generally more defensible) result than differencing raw distance and *then* averaging the resulting instantaneous speeds, because averaging speeds is not the same operation as averaging positions/distances and dividing once — the two are only equivalent for evenly spaced samples with no gaps, which this archive does not have (variable sample rates across 4 watches + decimation + gaps).

**Why it happens:**
The two operations look interchangeable in isolation ("it's all just an average") and the difference only becomes visible on irregular sampling, which is the archive's actual, common case rather than the edge case.

**How to avoid:**
Be explicit and consistent about which operation the new derivation performs, and document it once (in code and in the eventual quality-signal spec) so that every future feature that touches pace inherits the same semantics instead of a third team-of-one accidentally reintroducing a third derivation years from now.

**Warning signs:**
Two code paths that both claim to compute "smoothed pace" for the same activity but disagree at the second decimal place — the exact class of bug this milestone exists to eliminate.

**Phase to address:**
Gap-aware pace derivation phase.

---

### Pitfall 6: Silent-drop filters that break the "totals sum to elapsed time" invariant

**What goes wrong:**
This is the bug that already shipped: the histogram implicitly claims its bucket totals sum to elapsed time while a smoothing/coverage requirement silently drops the first/last window-width of the activity (and anywhere else a filter can't produce a value), leaving 72% coverage on the worked example while presenting itself as complete. Any future filter — the new smoothing window's edge effects, gap exclusion, outlier rejection, decimation-flagged exclusion — has the same failure mode: discard samples/time without accounting for them anywhere visible, and downstream aggregates quietly stop summing to what the UI implies they sum to.

**Why it happens:**
Filters are usually written and tested for "does the value I keep look right," not "does the total of what I keep plus what I drop equal the total I started with." The latter is a boring invariant to assert but the only one that actually catches silent drop.

**How to avoid:**
Make coverage a first-class, always-computed, always-displayed quantity, not an implicit assumption. Concretely: every pace-consuming view should be able to report `covered_seconds / elapsed_seconds` (or covered distance / total distance) next to the number it derives from that coverage, and that fraction should be asserted in tests against a fixture with a *known* uncoverable region (e.g., a synthetic activity with a real gap and a real edge) so the invariant is watched failing before it's allowed to pass — per this project's own hard-won convention (`PROJECT.md`: "Guard assertions must be watched failing before they may pass"). Where coverage is necessarily partial (e.g., the first/last half-window can't be centred), that shortfall must be an accounted-for category (edge-excluded, gap-excluded, decimation-flagged) that sums back to 100%, not a silent absence.

**Warning signs:**
Any UI element that presents a total, average, or distribution derived from a filtered subset without also stating what fraction of the underlying signal that subset represents; a coverage percentage that, when computed, turns out below ~95% on a majority of activities and nobody previously noticed.

**Phase to address:**
Honest-coverage phase (explicitly named as a milestone target feature: "recording gaps and pause gaps stop manufacturing pace values and stop being silently dropped"). This should ship a *visible* coverage number, not just an internal accounting fix — otherwise the same class of bug can recur invisibly in the next feature that consumes the pace stream.

---

### Pitfall 7: Circular percentile thresholds computed from the contaminated data itself

**What goes wrong:**
Any "ceiling" derived as a percentile (e.g., 99th percentile of observed pace) of a dataset that itself contains the outliers you're trying to reject is circular: the outliers pull the percentile outward, so the resulting ceiling admits some of the very values it was meant to catch, and the effect gets worse the more contaminated (device-error-prone) the source activity is. This is structurally the same failure as the currently-shipped `WORLD_RECORD_SPEED_MPS` guard admitting a 44.0s 400m against a 43.03s world record — a threshold that looks principled (anchored to a real physical constant) but was never checked against what it actually admits.

**Why it happens:**
Percentile-of-observed-data thresholds are attractive because they're "data-driven" and require no domain judgment call, but that's exactly what makes them fragile against contamination — a threshold computed on the archive average of ~2.7M samples where 662/1,864 activities contain at least one physically-impossible sample is not robust unless the estimator itself has a high breakdown point (e.g., median/MAD rather than percentile-of-raw, or trimmed/Winsorized statistics computed after a first robust pass).

**How to avoid:**
Never derive a rejection threshold from a single, un-robust percentile of the same population being filtered. Instead: (a) anchor the ceiling in demonstrated personal ability (as the milestone explicitly plans — "a ceiling derived from demonstrated personal ability rather than the world record") using a robust central estimate (e.g., median of an activity's own top efforts, or a trimmed distribution across the runner's own PR history) with margin, not a raw max/percentile; (b) if any percentile-of-corpus statistic is used at all, compute it iteratively — reject the most extreme candidates first with a coarse/absolute sanity bound (physically impossible = faster than 100m world-record pace sustained, which is already established as a real signal — 662 activities), *then* compute the percentile on the cleaned remainder, never on the raw population; (c) test the resulting ceiling explicitly against the known false-admission case (44.0s/400m) as a regression fixture so it can never silently regress back to a value that admits sub-world-record-implausible efforts.

**Warning signs:**
A "world record" or "personal ceiling" guard that was never unit-tested against the specific bad activity that motivated it; a percentile-derived threshold that moves noticeably every time new (possibly still-contaminated) activities are added to the archive, rather than converging.

**Phase to address:**
PR plausibility phase. This is the single most consequential threshold in the milestone (it gates PR validity), so it needs the most explicit anti-circularity treatment and its own regression fixture from day one.

---

### Pitfall 8: Absolute thresholds that don't survive 15 years and 4 watches

**What goes wrong:**
A single hard-coded speed/pace/cadence/acceleration threshold, however physically motivated, interacts differently with GPS chipsets and firmware from a 2011-era device than a 2020s Garmin fēnix 6 Pro, and differently again with a phone-GPS-only Strava-app recording versus a dedicated watch. Older and cheaper GPS hardware produces more frequent multipath/urban-canyon speed spikes; some devices (Garmin FIT) report a device-computed, sensor-fused instantaneous speed channel while others (naive GPX exports) only offer raw lat/lon deltas that the pipeline must difference itself, which is structurally noisier for the same physical run. A threshold tuned to "look right" on recent Garmin data will systematically over-flag or under-flag other device families and eras.

**Why it happens:**
Development and manual review naturally gravitate toward recent, familiar activities (they're the ones on-screen most often), so a threshold gets implicitly tuned against a narrow, non-representative slice of the archive's actual device diversity (1,802 FIT / 38 GPX / 24 intervals.icu streams, spanning fēnix 6 Pro, Suunto 9, Runkeeper, the Strava app, and 716 activities with no device name at all).

**How to avoid:**
Validate every threshold against a deliberately stratified sample: at least one activity per known device family (fēnix 6 Pro, Suunto 9, Runkeeper, Strava app, intervals.icu-only, GPX-only, no-device-name), spanning old and recent eras. Where a threshold must vary by context, prefer deriving it from *that activity's own* demonstrated data (Pitfall 7's fix) over a device-keyed lookup table (device names are missing for 716 activities, so a device-keyed rule silently has no rule for 38% of the archive — see Pitfall 9). Where device era genuinely correlates with noisier data (the milestone explicitly plans a "device era" quality signal), surface it as a *signal*, not as a different pass/fail threshold per device — matching the project's stated non-goal that genuine device over-measurement is "flagged, never corrected."

**Warning signs:**
A quality-flag rate that clusters heavily by device or by file format rather than by any physically meaningful property of the activity; the 716 no-device-name activities all silently falling into either "always flagged" or "never flagged" because the threshold logic has an implicit device branch with a default case nobody examined.

**Phase to address:**
Cross-era-consistency phase, but the underlying discipline (validate against a stratified device/era sample, not just recent data) should be a standing test-fixture requirement across every phase that introduces a threshold.

---

### Pitfall 9: Inferring device capability from file format, and treating a missing channel as zero

**What goes wrong:**
File format (FIT vs GPX vs intervals.icu-derived) is a proxy for, not proof of, what channels a device actually recorded — a FIT file can still be missing cadence or HR, and an absent device *name* (716 activities) doesn't mean an absent device *class*; it means the metadata pipeline lost the name, which is a different fact. Separately, and more dangerously: treating a missing/absent channel as a *zero* (zero speed, zero elevation change, zero cadence) rather than as *no data* silently manufactures false readings exactly like the `MAX_SAMPLES` decimation aliasing already does — a missing sample is not a zero sample, and code that does `value ?? 0` instead of `value ?? null` in an aggregation will corrupt every average it touches.

**Why it happens:**
`?? 0` and `|| 0` are the path-of-least-resistance defaults in TypeScript aggregation code (they avoid a `NaN` propagating and crashing a chart), so they get written reflexively without the author registering that they're making a truth claim about the data.

**How to avoid:**
Audit every new aggregation added by this milestone for `?? 0` / `|| 0` / implicit-zero coercion on any pace-, distance-, elevation-, or cadence-derived value, and replace with explicit "insufficient data" states that propagate as such (skip the sample from the average's denominator, not treat it as a zero-valued numerator contribution) — this is the same shape of bug already fixed once this milestone for a different field (`gear-aggregate-logic.ts` degrading into an Unknown bucket instead of crashing on absent `gearName`, Phase 25/FIX-02) but the correct analogous fix for a *numeric* channel is "excluded from the average," not "bucketed as Unknown," because a numeric zero is a plausible-looking but wrong value in a way a string bucket isn't. For device inference specifically: treat "device name absent" as its own explicit category in any device-era signal, never silently fold it into a default device assumption.

**Warning signs:**
A quality signal or badge that is suspiciously well-behaved (never flags) for exactly the 716 no-device-name activities, or one that flags all of them uniformly regardless of their actual stream quality — both are signs the code branched on presence/absence of metadata rather than on the data itself.

**Phase to address:**
Per-activity quality signals phase and cross-era-consistency phase.

---

### Pitfall 10: A quality/plausibility change silently moves historical PRs

**What goes wrong:**
Any change to the pace derivation, the plausibility ceiling, or the decimation-aliasing fix has the potential to change which efforts rank as PRs, in which direction, and by how much — and if that recomputation happens invisibly during a routine "run the pipeline" cycle (as the daily CI rebuild already does for other stats), a runner can open the Records screen and find a PR they remember earning is gone, replaced by a different date/time, with no explanation. The milestone's own non-goals correctly forbid *recalculation* ("PRs move by demotion, never recalculation") specifically to prevent this — but demotion itself is still a visible change to a number someone has looked at for years, and needs to be surfaced, not merely permitted.

**Why it happens:**
Batch/CI-driven recomputation pipelines are built to be idempotent and silent by design (that's the whole point of a nightly rebuild), so there's no existing mechanism in this codebase for surfacing "this specific number changed and here is why" — the daily pipeline optimizes for "the numbers are always fresh," which is precisely at odds with "changes to trusted numbers should never be silent."

**How to avoid:**
Any activity whose PR status changes (newly demoted, newly flagged-implausible-but-visible, newly excluded-by-quality-signal) as a *result of this milestone's logic* should produce a one-time, reviewable diff — reuse the review-queue mechanism already planned for curation mode rather than inventing a second notification path. Never let a demotion happen as a side effect of an unrelated pipeline run without it being traceable to *this specific change* in *this specific deploy*. Concretely: run the new plausibility/derivation logic once against the full archive before shipping, diff the resulting PR table against the currently-shipped one, and treat every diff as a fact to be reviewed (and ideally surfaced to the runner once, e.g. via a changelog entry or a one-time "these records changed because..." banner) rather than as an incidental consequence nobody looked at.

**Warning signs:**
A "PRs changed" count that's only discoverable by manually diffing `data/stats/best-efforts.json` before/after a deploy, rather than being a first-class, reviewed artifact of the phase that introduced the change.

**Phase to address:**
PR plausibility phase, closed out with an explicit before/after diff review as part of that phase's own verification (not deferred to "we'll notice if a user complains").

---

### Pitfall 11: Flags become noise once too many activities are flagged

**What goes wrong:**
If the quality-signal work flags device era, stair-step ratio, impossible-sample count, gap profile, and elapsed-vs-moving divergence too liberally (or without prioritization), a runner opening the Activities list sees flags on a large fraction of 1,864 rows — at which point flags stop meaning "look at this one" and become background wallpaper the runner learns to ignore, defeating the entire point of a quality signal. Given the anchors already established (995 decimated activities, 662 with an impossible sample, 1,233 with a >10s gap, 321 with >5min of pause gaps), a naive union of "any of these signals present" would likely flag a majority of the archive.

**Why it happens:**
It's easier to ship five independent boolean flags than to design one coherent, prioritized signal, and each flag in isolation feels justified by the data that motivated it — nobody sets out to build "noisy," it accumulates one legitimate-seeming flag at a time.

**How to avoid:**
Design the quality signal as a small number of severity tiers (e.g., "informational," "worth a look," "likely implausible — excluded from PR consideration") rather than N independent badges, and calibrate the top severity tier to be genuinely rare — validate this by computing, before shipping, what fraction of the 1,864-activity archive lands in each tier, and treat a top-tier rate much above a low single-digit percentage as a signal the thresholds need tightening, not that the archive is that bad. Reuse the review-queue as the single place flagged activities surface, rather than scattering badges across every screen.

**Warning signs:**
A pre-ship dry run against the full archive shows the majority of activities carrying at least one flag; a badge/icon system with more distinct flag types than a user could name from memory.

**Phase to address:**
Per-activity quality signals phase — the severity-tier design and the archive-wide flag-rate dry run should be an explicit deliverable of that phase, not an afterthought discovered post-ship.

---

### Pitfall 12: Uninterpretable quality scores

**What goes wrong:**
A single composite "quality score" (e.g., a 0-100 number blending device era, gap profile, sample density, and impossible-sample count into one figure) is nearly impossible for a runner to act on: a 62 tells you nothing about *what's wrong* or *what to do about it*, and two activities with wildly different underlying problems can land on the same score, making the number actively misleading rather than merely unhelpful.

**Why it happens:**
A single scalar is easy to sort/filter/badge by, so it's tempting even when the underlying signals are heterogeneous and not naturally reducible to one axis.

**How to avoid:**
Prefer showing the individual signals (device era, gap profile, stair-step ratio, etc.) directly, each in its own interpretable unit ("12% of elapsed time in recording gaps," "3 samples faster than 100m world-record pace"), over collapsing them into one opaque score. If a single sortable/filterable summary is genuinely needed (e.g., for the review queue), derive it as a simple, disclosed rule ("worst tier across all signals") rather than a weighted blend whose weights nobody can explain.

**Warning signs:**
A quality score changes when an unrelated signal changes, in a direction a reviewer can't explain without opening the code; two visibly different-quality activities land on the same score.

**Phase to address:**
Per-activity quality signals phase.

---

### Pitfall 13: Auto-exclusion removes a legitimate PR

**What goes wrong:**
Any automatic exclusion mechanism (as opposed to flag-and-let-the-human-decide) risks silently removing a genuine PR that merely looks anomalous — e.g., a real negative-split effort, a short downhill segment with an unusually fast but legal pace, or a race with chip-timed splits that happen to be faster than the runner's other efforts. The project's own stated principle — "when in doubt leave it alone and let the user exclude it by hand" — exists precisely because automated correction cannot distinguish "device error" from "unusually good, real performance," and this is the single highest-consequence place that distinction matters, because a PR is the number runners care about most.

**Why it happens:**
It's tempting to make the plausibility ceiling do double duty as both a flag and an automatic filter, because that requires building only one mechanism instead of two (flag mechanism + separate review-and-confirm mechanism), and because a hard cutoff is simpler to reason about than "flag everything above X, but only exclude after human confirmation."

**How to avoid:**
Follow the milestone's own explicit design: "rejected efforts stay visible, flagged and overridable, never deleted." Concretely, this means the plausibility ceiling must never remove an effort from what's displayed or computed against — it can demote it from PR-eligibility with a visible flag, feed it into the review queue, and require an explicit human action (via curation mode, following the CUR-01 precedent) before it stops counting for PR purposes. No fully-automatic, silent exclusion path should exist for pace/PR data, mirroring the whole-activity manual exclusion pattern already shipped in Phase 24.

**Warning signs:**
Any code path where an activity or effort disappears from a ranked list without a corresponding flag or entry in the review queue explaining why; a PR table that shows fewer entries after a deploy with no diff/changelog attached (see Pitfall 10).

**Phase to address:**
PR plausibility phase and review-queue phase jointly — the ceiling logic (plausibility phase) must hand off to the review queue (curation-mode phase) rather than acting unilaterally, so these two phases have a hard dependency and should be sequenced with the ceiling shipping demote-and-flag-only, with exclusion deferred to the review-queue phase's completion.

---

### Pitfall 14: Vacuous data-quality assertions that can't fail

**What goes wrong:**
A test that asserts "coverage is computed" or "a flag exists for bad activities" without ever being run against a fixture engineered to make the *specific* defect happen is not evidence the filter works — it's evidence the code executes. This project has already been burned by this exact shape of bug repeatedly and outside this domain (case-blind tabindex scans, CSS assertions any rule could satisfy, null-override tests passing only because `localStorage` happened to be undefined in the test environment, a checkpoint row whose own setup destroyed the discriminator it existed to test). Data-quality code is *especially* prone to this because "ground truth" for a real archive activity is usually unknown — there's no oracle telling you what activity 4556693525's "real" pace distribution is, only what looks plausible, so tests silently drift toward "does this not crash" rather than "does this catch the defect."

**Why it happens:**
Ground truth is genuinely hard to come by for real GPS data (nobody recorded the "true" pace independent of the device), so it's tempting to test against real archive activities and eyeball the output rather than build synthetic fixtures with a known-correct answer.

**How to avoid:**
For every data-quality assertion, build a synthetic fixture where the correct answer is constructed, not inferred — e.g., a synthetic stream with a known constant true pace, a deliberately injected gap of known duration, a deliberately injected impossible-speed sample of known magnitude and position, and deliberately injected decimation-style aliasing reproducing the `MAX_SAMPLES` pattern. Assert against the *constructed* ground truth (the smoothed pace should equal the known constant pace within tolerance; the coverage fraction should equal exactly `(elapsed - injected_gap) / elapsed`; the impossible sample should be flagged and only that sample). Critically — per this project's own convention — every such assertion must be watched failing first: temporarily reintroduce the real defect (revert to per-sample `dt/dd`, remove gap-boundary clipping, remove the plausibility ceiling) and confirm the fixture's assertion actually goes red, not just that it currently reads green. Where feasible, also replay the actual worked example (activity 4556693525) as a *named regression fixture* with its known-bad old output (72% coverage, phantom 2:45 cluster) pinned as the "must never regress to this" case.

**Warning signs:**
A data-quality test suite with high coverage percentage but no fixture that was ever observed failing; a filter whose test only checks "output is not undefined" or "output is an array"; any assertion written by generating a fixture from the *already-passing* implementation rather than from an independently-derived ground truth.

**Phase to address:**
Every phase in this milestone, as a standing verification requirement — but it should be established as an explicit, reusable fixture library (synthetic gap, synthetic outlier, synthetic decimation-alias, the pinned real worked example) in the gap-aware pace derivation phase, since every later phase (plausibility, quality signals, elevation, review queue) will need to compose the same building blocks.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|-------------------|
| Ship the new pace derivation but leave the histogram's per-sample `dt/dd` path unremoved as a fallback | Smaller diff, lower risk in the short term | Two derivations continue to exist and can drift again exactly as they did to create this milestone | Never — the milestone's stated goal is "one gap-aware pace derivation," a fallback path defeats it |
| Hard-code a device-name allowlist for era-based thresholds | Fast to write, works for the recent/known devices | Silently no-ops for the 716 no-device-name activities and any future new device | Only as a temporary flag inside a dry-run report, never in shipped filtering logic |
| Compute the plausibility ceiling once at build time from the archive as it exists today, hard-coded as a constant | Simple, matches how `WORLD_RECORD_SPEED_MPS` already works | Freezes a threshold that can't adapt as more activities are added, and inherits Pitfall 7's circularity if computed from raw archive percentiles | Acceptable only if derived per-runner from a robust, explicitly-documented method with a fixture-pinned regression test, not as a single magic number |
| Skip the archive-wide dry-run flag-rate check before shipping quality signals | Saves a step, ships sooner | Discovers the noise problem (Pitfall 11) only after real usage, when trust is already damaged | Never for this phase — the dry run is cheap (batch job, not a UI feature) relative to its value |
| Let the review queue write directly into `excludedFromRecords` without the two-independent-guard publish-safety pattern already established for curation mode | Less code to write | Repeats the exact class of bug CUR-01's guards exist to prevent — a write path reachable from the published (non-localhost) bundle | Never — this repo already has the pattern (`curation-guard.mjs` + HTTP-layer assertion); reuse it, don't reinvent a weaker version |

## Integration Gotchas

Brownfield-specific: this is about integrating the new logic with the *existing* codebase, not with external services.

| Integration point | Common Mistake | Correct Approach |
|--------------------|------------------|---------------------|
| `derive-stream.ts`'s `MAX_SAMPLES` decimation | Building the new pace derivation downstream of decimation, inheriting its aliasing | Either derive pace from the pre-decimation stream where available, or explicitly detect and flag decimation-affected activities rather than smoothing over the artefact |
| `detail-charts-logic.ts`'s existing 20s window + `detail-zones.ts`'s raw per-sample path | Adding a *third* pace computation (e.g., inside the new quality-signal code) instead of consuming the one unified derivation | Every new consumer of pace must import the single new derivation function; no new file should compute `dt/dd` itself |
| `findBestEffort`'s interpolated-crossing integration | Accidentally feeding it the *smoothed* stream, causing PR distances/times to shift as a side effect of a display change | Keep `findBestEffort` reading the underlying (unsmoothed, but gap/decimation-aware) stream; smoothing must stay a display/quality-signal concern, matching the milestone's own non-goal |
| Local curation mode / review queue | Building a second write path for pace-quality overrides parallel to the existing whole-activity exclusion list, instead of feeding the one list | Extend the existing manual PR-exclusion list mechanism rather than creating a parallel data store, per the milestone's stated plan ("feeding the existing manual PR-exclusion list") |
| Nightly CI rebuild (`COMPUTE_ALL_STATS_STEPS`) | Adding pace-derivation/quality-signal computation as a new step without checking it against the existing step-ordering source of truth established in Phase 25 | Add the new compute step to `COMPUTE_ALL_STATS_STEPS`, not to a separately hand-maintained workflow list — Phase 25 built this precisely to prevent a second drift |
| Elevation quality signal (impossible-altitude case) | Reusing the pace plausibility ceiling's logic wholesale for elevation without checking whether elevation has its own device/GPS failure modes (barometric drift, missing elevation channel entirely on some sources) | Treat elevation plausibility as its own signal with its own fixture-derived thresholds, not a copy-paste of the speed ceiling with different units |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Recomputing the plausibility ceiling (if derived per-runner from full history) on every activity's page load instead of once per pipeline run | Slow detail-view loads, or a client-side recompute of a value that should be a precomputed static | Precompute per-activity quality signals and the ceiling once in the nightly CI pipeline, ship as static JSON like every other stat in this repo | Noticeable once client-side recomputation touches more than a few hundred KB of stream data per page load |
| Running the new gap-aware derivation over full-resolution (pre-decimation) local streams for all 1,864 activities inside CI without caching | Nightly pipeline runtime grows materially, risking CI timeout | Cache derived-pace outputs per-activity keyed by a content hash of the input stream, so unchanged activities skip recomputation | Becomes noticeable as archive grows past current size or if local 1Hz streams (94.5% available) get pulled into scope for a future re-derivation milestone |
| A dry-run archive-wide flag-rate report (Pitfall 11) implemented as an ad hoc script that reprocesses everything from scratch each time it's run during development | Slows down iteration on threshold tuning | Build the dry-run as a fast, cacheable batch script from day one since it will be re-run many times while calibrating thresholds | Breaks developer velocity almost immediately if each threshold tweak requires minutes of full-archive recompute |

## Security Mistakes

This milestone has limited attack surface (personal, single-user, static-hosted dashboard), but the one relevant risk is a repeat of a pattern already fixed once in this repo.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Review-queue write path (marking an effort as reviewed/excluded) reachable from the published, non-localhost bundle | Repeats the exact publish-safety gap Phase 24's `curation-guard.mjs` + HTTP-layer assertion were built to close for the exclusion tickbox | Extend the existing two-independent-guard pattern (build-time content scan + HTTP-layer assertion) to cover the new review-queue write path explicitly, don't assume it's automatically covered by the existing guards without adding a fixture that proves it |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Changing a chart's smoothed pace or a histogram's shape without any indication anything changed | A runner who has looked at a specific run's chart for years notices "the shape looks different" with no explanation, and starts distrusting the whole dashboard | Ship a one-time, dismissible note ("pace calculation updated — see why") tied to the deploy that introduced the change, at least on first view after the change |
| A PR silently demoted with only a small badge easy to miss | A runner scans Records, doesn't notice the badge, and only discovers the PR is "gone" later, which reads as data loss rather than a considered decision | Surface demotions prominently once (e.g., in the review queue or a changelog), not just as a passive badge on a row nobody re-visits |
| Quality flags with no explanation of what to do about them | A runner sees a flag, doesn't know if they should exclude the activity, ignore it, or worry about their watch | Every flag should link to (or inline) a one-line explanation ("12 samples faster than 100m world-record pace — likely a GPS multipath spike") and the concrete action available (review queue entry) |
| Coverage percentage shown without context | A number like "coverage: 72%" means nothing to a non-technical reader of their own dashboard | Pair coverage with a plain-language gloss ("pace computed for 72% of this run's time; the rest was in recording gaps or too short to smooth reliably") |

## "Looks Done But Isn't" Checklist

- [ ] **Single pace derivation:** Grep the whole `src/` tree for any remaining `dt /` or manual speed/pace arithmetic outside the new shared derivation function — a leftover second implementation is the exact bug this milestone exists to fix.
- [ ] **Coverage invariant:** Verify, for a fixture with a known gap, that covered-time + excluded-time (by named category) sums to exactly elapsed-time — not "close to," exactly, with a fixture-derived assertion that was watched failing.
- [ ] **Ceiling anti-circularity:** Verify the plausibility ceiling was not computed from a raw percentile of a population that includes the outliers it rejects — trace the actual computation, don't take "we use demonstrated ability" at face value without reading the code.
- [ ] **No silent exclusion:** Grep for any code path where an effort/activity is removed from a ranked list or aggregate without a corresponding flag/review-queue entry.
- [ ] **Cross-device fixture coverage:** Confirm test fixtures exist per known device family (FIT/fēnix, FIT/Suunto, GPX, intervals.icu-only, no-device-name) — not just one "representative" activity.
- [ ] **Archive-wide dry run performed:** Confirm a flag-rate/coverage/ceiling-diff report was generated against the full 1,864-activity archive before shipping, and that the top-severity flag rate and PR-diff count were reviewed by a human, not just generated and ignored.
- [ ] **Reversibility:** Confirm every automated quality decision (flag, demotion, exclusion suggestion) is traceable back to a stored, timestamped reason a human can read and undo — not baked irreversibly into recomputed aggregate JSON with no record of the "before" state.
- [ ] **Assertions watched failing:** Confirm each new data-quality test was manually reverted-and-reran against the real defect (or a fixture reproducing it) to confirm it goes red, per this project's established convention — not merely confirmed to pass once written.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-------------------|
| Two pace derivations ship again despite the milestone's goal | LOW | Grep for duplicate derivative logic, delete the second, redirect all call sites to the shared function; low cost because the fix is mechanical once found |
| Coverage invariant violated post-ship (silent drop recurs) | MEDIUM | Add the missing accounting category, backfill a coverage-diff report across the archive, and if any published aggregate was materially wrong, ship a corrected value with a visible changelog note per Pitfall 10's pattern |
| Circular ceiling admits an implausible PR (Pitfall 7 recurs) | MEDIUM | Add the specific bad activity as a named regression fixture (as should already exist for the 44.0s/400m case), fix the ceiling computation, re-run the full archive diff, and route any newly-caught efforts through the review queue rather than deleting them outright |
| A legitimate PR was auto-excluded (Pitfall 13 occurred) | HIGH — trust damage, not just data | Restore it immediately via the existing manual-override mechanism, disclose what happened and why in a visible note, and add the case as a "must never auto-exclude" regression fixture; this is the single most reputationally expensive failure mode in the whole milestone, so prevention (never build automatic exclusion at all) is far cheaper than recovery |
| Flags became noise (Pitfall 11) after ship | MEDIUM | Recalibrate thresholds against the archive-wide dry-run data that should already exist, collapse to fewer/severity-tiered flags, and communicate the recalibration as a deliberate change, not a silent one |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|-----------------|
| 1. Smoothing differentiated vs cumulative signal | Gap-aware pace derivation | Fixture with known constant true pace; smoothed output matches within tolerance regardless of which mathematical order is chosen, and stays consistent under irregular sampling |
| 2. Fixed window blind to sample rate / decimation | Gap-aware pace derivation | Side-by-side fixtures: native 1Hz, decimated (`MAX_SAMPLES`-style), coarse-irregular; assert window behaves predictably (or flags) on all three |
| 3. Smoothing across pause boundaries | Gap-aware pace derivation | Fixture with an injected mid-activity gap; assert smoothed pace stays flat on both sides, doesn't dip/spike near the boundary; watched failing with boundary-clipping removed |
| 4. Over-smoothing destroys intervals | Gap-aware pace derivation | Fixture (or real archive activity) with known interval structure; assert smoothed pace still resolves fast/slow alternation |
| 5. Cumulative vs differentiated window inequivalence | Gap-aware pace derivation | Single documented derivation; regression test pinning the exact formula so a future edit can't silently reintroduce the other order |
| 6. Silent-drop coverage invariant | Honest coverage | Fixture with known gap; assert covered+excluded sums to exactly elapsed time; watched failing against the real 72%-coverage histogram bug before being allowed to pass |
| 7. Circular percentile ceiling | PR plausibility | Regression fixture pinning the known-bad 44.0s/400m case as inadmissible; assert ceiling computed from a robust, non-circular estimator, not raw archive percentile |
| 8. Absolute thresholds fail across device/era | Cross-era consistency (with threshold work in PR plausibility / quality signals) | Stratified fixture set across every known device family and era; flag-rate parity check across strata |
| 9. Device inference from format / missing-as-zero | Per-activity quality signals + cross-era consistency | Fixture for the no-device-name case explicitly; grep-based audit for `?? 0`/`|| 0` on pace/elevation/cadence aggregation |
| 10. Silent historical PR movement | PR plausibility | Full-archive before/after diff review as a required phase deliverable, not optional |
| 11. Flag noise | Per-activity quality signals | Archive-wide dry-run flag-rate report reviewed by a human before ship; top-severity rate capped and justified |
| 12. Uninterpretable quality scores | Per-activity quality signals | Design review: prefer disclosed individual signals over an opaque composite; if a composite ships, its derivation rule must be statable in one sentence |
| 13. Auto-exclusion removes a legitimate PR | PR plausibility + review queue (joint) | No code path exists that removes an effort from ranking without a flag/review-queue entry; verified by grep/code review, not just testing the happy path |
| 14. Vacuous data-quality assertions | Established in gap-aware pace derivation, enforced every phase after | Every assertion demonstrated failing against a real or constructed defect before being accepted; reusable synthetic-fixture library (gap, outlier, decimation-alias, pinned worked example) built once and composed by later phases |

## Sources

- Project-internal: `.planning/PROJECT.md` (v2.2 milestone scope, non-goals, and the project's own established verification conventions — "assertion must be watched failing," "checkpoint rows must assert reachable extent," "duplicated logic defeats checkpoints," "two independent guards fail independently," the Phase 25 `gear-aggregate-logic.ts` missing-field precedent, the Phase 24 curation-mode publish-safety pattern) — HIGH confidence, primary source for this project's concrete anchors.
- General time-series smoothing/moving-average behaviour (centred vs trailing windows, weighted/tapered windows) — [NIST Engineering Statistics Handbook: Centered Moving Average](https://www.itl.nist.gov/div898/handbook/pmc/section4/pmc422.htm), [Exponential smoothing (Wikipedia)](https://en.wikipedia.org/wiki/Exponential_smoothing) — MEDIUM confidence, general statistics reference rather than running-domain-specific.
- Percentile-threshold circularity and breakdown-point robustness for contaminated data — [scikit-learn: Novelty and Outlier Detection](https://scikit-learn.org/stable/modules/outlier_detection.html), [SFEI: Recommended Methods for Outlier Detection and Calculations of Tolerance Intervals and Percentiles](https://www.sfei.org/documents/recommended-methods-outlier-detection-and-calculations-tolerance-intervals-and-percentiles) — MEDIUM confidence, general statistics domain applied to this project's GPS-pace context by inference.
- Device-specific claims (Garmin FIT sensor-fused speed channel vs GPX raw lat/lon differencing, older-chipset GPS noise/multipath) — LOW-MEDIUM confidence, drawn from general training-data knowledge of FIT/GPX format conventions rather than a verified current source; recommend validating directly against this archive's actual stream files (`export_data/`, committed `data/streams/`) before hard-coding any device-specific rule.

---
*Pitfalls research for: pace data-quality/cleaning added to an existing running-analytics dashboard*
*Researched: 2026-09-08*
