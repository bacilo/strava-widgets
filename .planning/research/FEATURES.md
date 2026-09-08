# Feature Research: Pace Data Quality in Running-Analytics Platforms

**Domain:** Running-activity analytics/visualization — derived-metric trustworthiness, data-quality signalling, record validation
**Researched:** 2026-09-08
**Confidence:** MEDIUM overall — several platforms (Strava, Garmin) publish just enough official documentation to source hard numbers; others (Runalyze, intervals.icu, SportTracks, TrainingPeaks) are largely undocumented and had to be triangulated from forums/blogs, so those claims are marked LOW and should be treated as directional, not authoritative.

## Critical Framing for This Project

**None of the six platforms researched do geometric GPS-spike rejection on anything other than raw lat/lng position streams.** Every documented or credibly-inferred spike-handling technique — Strava's "ignoring the most obviously inaccurate data," the GNSS/IMU engineering literature's Kalman-gating and map-matching, Strava's "Correct Distance" — operates on **position**: consecutive coordinate jumps, bearing discontinuities, or snapping the track to a road/path network. This project's committed streams have **no per-sample lat/lng** (excluded for privacy) — only cumulative distance, time, HR, cadence, and altitude. This is not a small caveat: it rules out the entire "geometric implausibility" family of techniques (the ones every commercial platform actually documents or is known to use) and confines this milestone to **derivative-based** detection — implausible speed from `dd/dt`, implausible grade from `dAlt/dd` — which is a strictly weaker signal than what Strava/Garmin have available. This matches what `PROJECT.md` already concluded independently for the Suunto 17 m/s case ("position exists in only 51.3% of that file's records, so geometry cannot arbitrate") — the research below confirms that conclusion generalizes to the whole feature category, not just that one file.

---

## Q1 — Pace Smoothing: What Window/Method Do Platforms Use?

| Platform | Method / Window | Confidence | Source |
|---|---|---|---|
| **Strava** | Two distinct behaviours. (a) The default activity-page Analysis graph is *not* a per-sample plot: "we do not plot every data point but every three or so to make a readable graph" — this is decimation for chart legibility, not a real smoothing filter. (b) Strava subscribers get an explicit **"Smoothed" toggle** on the Pace Analysis chart (vs. raw/"spiky"), described only as smoothing, no window disclosed. | MEDIUM (a, official help), LOW (b, window size never published) | [Moving Time, Speed, and Pace Calculations](https://support.strava.com/hc/en-us/articles/115001188684), [Run Activity Pages](https://support.strava.com/en-us/articles/15401883-run-activity-pages) |
| **Strava (re-smoothing on ingest)** | Reported as a **10–30 second** rolling window applied when Strava re-derives pace from an uploaded GPS track, varying "depending on the source file" — cited as the single biggest cause of Garmin-vs-Strava pace mismatches (5–20 sec/km). | **LOW** — single third-party blog, not corroborated by any Strava-official source; treat as a plausible order-of-magnitude, not a fact. | [findyouredge.app](https://www.findyouredge.app/news/why-garmin-and-strava-show-different-pace) |
| **Garmin (on-device instantaneous pace)** | Forum consensus: a short rolling window, **"often the last 5 seconds, sometimes 10."** Garmin Connect's post-hoc web chart uses **raw second-by-second data with no smoothing** — a long-standing, still-open feature request ("time select box: 5s/10s/30s/1min") has not shipped. | MEDIUM (absence of a smoothing control is confirmed by an active/unresolved official forum thread); LOW on the exact 5–10s figure (forum only) | [Garmin Forums: Pace Graph Smoothing](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/50748/pace-graph-smoothing) |
| **TrainingPeaks** | Ships a **user-adjustable smoothing control** on the chart itself — "raw data appears with no smoothing whereas turning the smoothing function on fully removes random data variation," with a partial-smoothing default. No fixed window/method (moving average vs. other) is named. | LOW — help-center paraphrase only, no formula or seconds value found | [How to Analyze a file](https://help.trainingpeaks.com/hc/en-us/articles/208916857) |
| **intervals.icu** | Default (non-customized) charts do **not** expose a smoothing control; user-built custom charts do support rolling averages, but the only concrete number found (15s) was for a physiological channel (SmO2), not pace, in one forum reply. No official docs on pace-chart smoothing were found. | LOW — forum-only, one unrelated data point | [forum.intervals.icu: Smoothing (rolling avg.)](https://forum.intervals.icu/t/smoothing-rolling-avg/56636) |
| **Runalyze / SportTracks** | No documented smoothing window or method found for either platform's pace charts. Runalyze's published data-quality effort is concentrated on **elevation**, not pace (see Q4). | GAP — not found, do not assume a number exists | — |

**Takeaway:** There is no industry-standard window. The two platforms that publish anything concrete (Garmin's short device-side window vs. Strava/TrainingPeaks' longer, adjustable/re-derived window) sit almost an order of magnitude apart, and both are LOW-to-MEDIUM confidence at best — even Strava won't commit to a number in its own documentation. **This project's existing 20s `derivePaceSeries` window is already inside the range multiple sources describe as Strava's ("10–30s") and is a defensible mid-point** — the research does not surface a reason to change it, only to make it the *single* derivation (which is already the milestone's stated plan) rather than picking a "correct" published constant, because no such constant is publicly documented anywhere.

## Q2 — Auto-Pause / Stopped-Time Definition

| Platform | Definition | Confidence | Source |
|---|---|---|---|
| **Strava — automatic (no device pause used)** | Server-side: a **speed threshold of "anything faster than a 30-minute mile pace"** (≈ 0.894 m/s / 3.2 km/h) counts as moving; slower is "resting" and stripped from Moving Time. This is stated identically across two independent official Strava docs. | **HIGH** — numeric, official, cross-confirmed | [Strava Training Glossary for Running](https://support.strava.com/hc/en-us/articles/216917157), [Moving Time, Speed, and Pace Calculations](https://support.strava.com/hc/en-us/articles/115001188684) |
| **Strava — manual device pause** | If the athlete used the device's own pause, Strava **honors that boundary as recorded** rather than recomputing — "we will represent moving time according to the time and pace shown on the GPS device." | HIGH — official, directly answers "long pause where the watch kept running": Strava does *not* second-guess a device that never paused; it applies the 30-min-mile rule to that unpaused span exactly like any other. | Same as above |
| **Strava — mobile app auto-pause** | App-side accelerometer trigger fires after being **stationary for more than 10 seconds**. | MEDIUM — official help article, but not independently re-verified by direct fetch (summarized via search) | [Auto-Pause](https://support.strava.com/en-us/articles/15402141-auto-pause) |
| **Strava — running vs. cycling mechanism** | Different signal per sport: running auto-pause is **accelerometer/motion-based**; cycling auto-pause is **GPS-speed-based**. | MEDIUM — official | Same |
| **Garmin** | Device-side setting (configurable auto-pause speed threshold exists on watches, e.g. "custom" vs "when stopped"), and Garmin Connect appears to **display whatever the device already computed** rather than recomputing server-side the way Strava does. No official Garmin Connect doc describing a *server-side* recomputation was found. | LOW — inferred from absence of evidence rather than a positive statement; do not treat as confirmed | — |
| **TrainingPeaks** | No evidence found of TrainingPeaks recomputing moving/stopped time independently; it primarily displays uploaded device totals. | GAP — not found | — |

**Takeaway:** Strava is the only platform with a *published, numeric* moving-time policy, and it is explicitly two-tiered: trust the device's own pause decision when one exists, otherwise apply a slow-speed cutoff server-side. That two-tier structure (trust an explicit device signal; otherwise apply your own threshold only to *undecided* spans) is directly reusable framing for this milestone's "elapsed-vs-moving divergence" signal — it argues for treating device `moving_time` as authoritative when the device made an explicit choice, and reserving any independent pause-gap analysis for spans the device didn't already resolve. This is consistent with — not in tension with — the milestone's existing non-goal ("device `moving_time` stays the shipped aggregate").

## Q3 — GPS Spike Rejection: Drop / Clamp / Interpolate / Flag?

| Platform | Behaviour | User-visible? | Confidence |
|---|---|---|---|
| **Strava** | "Strava does some smoothing to the uploaded data to remove outlier GPS points, including inaccurate GPS points and data clearly inconsistent with the file." No stated method (drop vs. clamp vs. interpolate) and no numeric threshold. Separately, **"Correct Distance"** is a *user-triggered*, on-demand map-matching recalculation (snaps the recorded track to known roads/paths) — not automatic, not silent. | Partially — the automatic step is invisible (no badge, no log); the map-matching correction is an explicit user action with a visible before/after distance change. | MEDIUM (official docs, but they concede no technical detail) |
| **Strava segment layer** | Separate from the whole-activity smoothing above: segment efforts get flagged/excluded from leaderboards using signals reported to include **"any single track point that implies superhuman velocity — even for one second,"** plus statistical deviation from the existing leaderboard and (for cycling) implausible power-to-weight. | Yes — flagged efforts silently drop off leaderboards ("not eligible"); the *activity* itself is untouched, only the segment-effort ranking. | LOW-MEDIUM — official docs confirm the *category* of exclusion (GPS error, wrong activity type) but not the specific triggers; the "superhuman velocity" / "standard deviations" language comes from secondary reporting, not Strava's own text |
| **Runalyze** | Offers **"Expert editing tools"** for manually correcting distance data per-activity — a user-triggered fix-up, not an automatic pipeline step. Its actual documented automated correction effort is elevation, not distance/pace (see Q4). | Yes, but manual/opt-in only | LOW — could not fully fetch the source page (403); based on a search-index snippet of the same official help article |
| **GNSS/IMU engineering literature (general, not platform-specific)** | Two credible patterns recur: (1) **Kalman-filter innovation gating** — reject/soft-limit any position update whose deviation from the filter's predicted state exceeds a chi-squared threshold; (2) **physical-limit clamping** — when instantaneous speed/acceleration between two fixes exceeds a "maximum physical speed/acceleration" constant, the new position is recomputed *at* that physical limit rather than accepted as-is (a clamp, not a drop). A peer-reviewed phone-GNSS-for-runners paper (Warsaw Univ. of Technology, PMC) describes a **three-state IIR cascade** — 'stop' (no update), 'change of pace' (light filtering), 'steady run' (aggressive filtering), gated by a **3 km/h tempo-change threshold** to switch states, and a **five-satellite floor** below which a sample is skipped entirely (not four, despite four being the GPS fix minimum). Reported results: up to 70% distance-error and 80% speed-error reduction in interval sessions. | No — internal to firmware/algorithm, nothing exposed to the end user | MEDIUM for the general Kalman-gating/clamping pattern (multiple independent engineering sources agree); MEDIUM for the specific IIR/3-state/5-satellite paper (single peer-reviewed source, not verified as what any commercial platform actually ships) |

**Takeaway:** Across every platform actually investigated, **nobody silently auto-corrects and hides it.** The two named corrections found (Strava's Correct Distance, Runalyze's Expert editing tools) are both explicit, user-triggered, and produce a visible before/after change — never a silent background rewrite the user can't see or undo. This directly supports the milestone's own stance ("flag, never auto-correct... never delete") — it is not a deviation from industry norms, it is closer to what the *credible, user-facing* parts of the industry already do; only the invisible ingest-time "remove outlier GPS points" step (Strava) departs from that, and it is exactly the kind of thing this project's committed-stream constraint makes structurally impossible to replicate anyway (no position data to run geometry against).

## Q4 — Data-Quality Surfacing: Who Shows the User Anything?

| Platform | What's exposed | Confidence |
|---|---|---|
| **Runalyze — elevation** | The clearest, most concrete data-quality feature found in this research. Runalyze runs a **DEM-based elevation correction** using SRTM (Shuttle Radar Topography Mission) 90×90m grid tiles, self-hosted, applied by default because raw GPS-derived elevation is "unusable." When correction produces "strange/extreme values" (a known issue near coastlines), the **corrected-altitude series is presented as a distinct, removable data layer** per activity — i.e., raw and corrected altitude coexist and the user can toggle which one is trusted. | MEDIUM — official help articles, fetched directly |
| **Runalyze — "Quality sessions"** | A false friend: this is a **workout-classification** feature (tagging which sessions count as quality training — intervals/tempo/etc. — for trend analysis), configured per sport type. It is **not** a data-integrity or GPS-confidence signal. Worth flagging explicitly so it isn't mistaken for the thing this milestone needs. | MEDIUM — official help article title and description are unambiguous about the feature's purpose |
| **Runalyze — distance** | "Expert editing tools" exist for manual distance correction; no evidence of an automatic per-activity confidence score/badge for distance or pace. | LOW (partial fetch only) |
| **Strava** | Has multiple help articles acknowledging GPS inaccuracy exists ("Bad GPS Data," "Why is GPS data sometimes inaccurate") but **no evidence found of any in-UI confidence score, quality badge, or accuracy indicator on the activity page itself.** The only remediation is the manual "Correct Distance" action. | MEDIUM confidence that **no such UI element exists** — based on absence across all official docs surveyed plus no forum threads describing one; a true negative claim, flagged as inferred-from-absence per the verification protocol, not verified against Strava's current live UI. |
| **Garmin** | A **GPS-accuracy margin-of-error figure** (e.g., "±12 ft / 3.65m") exists as a live device data field / Connect IQ metric, but this is a real-time device readout, not a documented per-activity retrospective quality signal on the Garmin Connect web activity page. | LOW — the applicability of the device-field number to the Connect web summary view is not confirmed |
| **TrainingPeaks, intervals.icu, SportTracks** | No data-quality/confidence indicator documented for any of the three. SportTracks is reported to auto-fix "unreliable elevation data" on import (single marketing-page claim, no mechanism described). | GAP / LOW |

**Takeaway:** Runalyze's elevation-correction pattern (DEM overlay, dual raw/corrected series, user-facing toggle when it looks wrong) is the single most concrete, most reusable precedent found across all six platforms — and it maps almost exactly onto this milestone's own "elevation as a quality signal — the impossible-altitude case, flagged the same way" goal. **No platform researched exposes a general per-activity pace/data-quality badge of the kind this milestone wants to build** — that is a genuine gap in the market, not a solved problem this project can just copy. Treat the whole "per-activity quality signals and badges" feature as a differentiator with no direct template to follow, not table stakes with an obvious reference implementation.

## Q5 — PR/Record Validation: How Is "Bogus" Decided?

| Platform | Mechanism | Personal vs. absolute ceiling? | Confidence |
|---|---|---|---|
| **Strava — segment leaderboards** | Automatically flags/excludes efforts using (reported, not officially itemized): a single-point "superhuman velocity" check, statistical deviation from the segment's existing leaderboard (described in secondary reporting as "multiple standard deviations faster"), and for cycling, power-to-weight plausibility. Flagged efforts are excluded from the leaderboard only — the activity itself is not touched, and users can appeal by submitting the original file. | **Segment-relative**, not truly personal and not a fixed absolute constant either — it compares the new effort against *other people's* historical times on that same segment, which is a population/segment baseline, not an athlete's own history. | LOW-MEDIUM — the mechanism category is documented via a company announcement (paraphrased by road.cc) and the official "Excluded Segment Efforts" / "Segment Leaderboard Guidelines" help pages, but no numeric thresholds are published anywhere; treat the specific triggers as directionally right, not exact |
| **Strava — whole-activity exclusion** | "Excluded Segment Efforts" doc names only broad categories (GPS-running-in-a-vehicle, wrong activity type, GPS error) with no numbers. | Neither — categorical, not statistical | MEDIUM (official, but deliberately vague) |
| **Garmin — personal records** | No automated validity/plausibility check found; forum evidence is limited to users reporting *incorrect* PR extraction bugs (e.g., mis-segmenting a marathon-distance interval) and manual PR management (edit/delete) tools. No evidence Garmin ever rejects a PR for being implausible. | None found | LOW — absence-of-evidence, several searches, consistently no hits on an automated check |
| **Runalyze — outlier handling** | No specific PR/record-plausibility feature found despite targeted searching; Runalyze's documented outlier handling is scoped to elevation (Q4), not records. | Not found | GAP |
| **Academic literature (not a shipping product)** | A 2026 arXiv benchmarking paper on athletic-performance anomaly detection explicitly frames the problem as **two competing baseline strategies**: (a) absolute/population thresholds (world-record or physiological limits as hard ceilings) vs. (b) **per-athlete baselines built from that athlete's own performance history**, and evaluates methods across both — z-score and IQR (population-style), Modified Z-Score/MAD (robust-to-outliers, still typically population-scoped), and **Bayesian hierarchical inference**, which explicitly models "athlete-specific parameters within a population framework" via partial pooling — i.e., a personal ceiling that still borrows statistical strength from the wider population rather than being derived from a handful of that athlete's own runs in isolation. | **This is the only source found that names "personal plausibility ceiling" as a first-class, distinct alternative to an absolute ceiling** — directly on-point for this milestone's stated approach. | LOW-MEDIUM — a single academic source, not a shipping consumer product; useful as conceptual grounding and terminology, not as a spec to copy literally |

**Takeaway:** **No commercial platform researched implements a personal-plausibility ceiling for records** — Strava's segment flagging is the closest analogue and it's *segment-population*-relative, not *athlete-personal*-relative. This means the milestone's stated approach ("a ceiling derived from demonstrated personal ability rather than the world record") has no industry precedent to validate against or copy from — it is a genuine differentiator, not table stakes, and the one piece of outside validation for the *concept* comes from academic anomaly-detection literature (MAD / Bayesian-hierarchical framing) rather than from any product in this domain. Implementation should treat "personal ceiling" as something to design from first principles against this project's own PR-evolution data (already computed per Records/PR-evolution features), not as a pattern to port from elsewhere.

## Q6 — Grade-Adjusted Pace (context only, explicitly OUT OF SCOPE this milestone)

- Both Strava's GAP and Runalyze's equivalent are reported to derive from **Minetti et al. (2002)**'s treadmill-measured cost-of-running curve: `C(i) = 155.4i⁵ − 30.4i⁴ − 43.3i³ + 46.3i² + 19.5i + 3.6` (J/kg/m, i = grade as a decimal), normalized against flat-ground cost `C(0) = 3.6`; GAP = actual pace ÷ [C(i)/C(0)]. Practical rule-of-thumb figures repeated across secondary sources: roughly **+2.5% pace cost per 1% uphill grade**, roughly **−1.5% pace benefit per 1% grade on moderate downhills** (up to about −10%), with cost **rising again below −10%** due to eccentric-braking cost. — Confidence MEDIUM: multiple independent secondary sources (reverse-engineering blogs, calculator sites) converge on the same polynomial and the same shape of the curve, but none is Strava's own published formula, so treat the exact coefficients as "very likely correct, not officially confirmed by Strava."
- **Why this matters for scope even though GAP itself is out:** the Minetti curve is exactly why a genuinely fast downhill split is real, not a data-quality defect — a driver of "impossible-looking" raw speed that quality signals must not conflate with GPS/device error. A steep, smooth downhill can legitimately produce a raw pace far outside a runner's flat-ground range; any speed-based implausibility threshold this milestone builds (Q3/Q5) needs to be grade-aware enough, at minimum, to not double-count "fast because downhill" as "fast because broken," even without computing GAP itself. This project has altitude data, so grade is computable even though GAP proper is deferred.

---

## Feature Landscape

### Table Stakes (users of a "pace data quality" capability expect these)

| Feature | Why Expected | Complexity | Notes / Dependency Flags |
|---|---|---|---|
| One consistent pace-derivation method used everywhere in the UI | Every platform researched picks *one* rendering method per context (device raw vs. Connect chart vs. Strava analysis toggle) — none show two silently-different numbers side by side the way this project's `detail-charts-logic.ts` (20s window) and `detail-zones.ts` (raw per-sample) currently do | LOW–MEDIUM (already scoped as the milestone's first target feature) | No data dependency beyond what's already committed (time, distance) |
| Gaps stop manufacturing pace | Universal pattern: every platform's moving-time logic (Q2) exists specifically to stop counting stopped/paused spans as if they were movement | MEDIUM | No position dependency — pure time/distance derivative work |
| Visible flag when data looks physically implausible (not silent correction) | Matches the *only* pattern found that's actually user-facing across platforms (Strava's manual Correct Distance, Runalyze's Expert editing tools, Runalyze's raw/corrected altitude toggle) — nobody ships a silent auto-fix as the primary UX | MEDIUM | Speed-implausibility check needs only distance+time (available); altitude-implausibility check needs only altitude (available) — **neither needs position** |
| Device `moving_time` treated as authoritative when the device made an explicit choice | Directly mirrors Strava's own two-tier policy (Q2): trust an explicit device signal, only apply independent logic to undecided spans | LOW | No new data needed |

### Differentiators (no direct industry precedent found — genuine competitive space)

| Feature | Value Proposition | Complexity | Notes / Dependency Flags |
|---|---|---|---|
| Personal plausibility ceiling for PRs (vs. world-record ceiling) | Not implemented by any platform researched; closest analogue (Strava segment flagging) is segment-population-relative, not personal. Academic anomaly-detection literature (MAD / Bayesian-hierarchical) is the only precedent for the *concept*, and it's not a shipping product. | HIGH — no reference implementation to copy; must be designed from this project's own PR-evolution history | No position dependency; needs enough historical PR data per distance to build a personal baseline, which this project already computes (`REC-01`..`REC-07`) |
| Per-activity quality badge set (device era, stair-step ratio, impossible-sample count, gap profile, elapsed-vs-moving divergence) | No platform surfaces a general per-activity quality/confidence badge; Runalyze's elevation raw/corrected toggle is the closest partial precedent, scoped to one channel only | HIGH — genuinely novel composite signal, five sub-signals to define and calibrate independently | All five sub-signals are computable from time/distance/HR/cadence/altitude alone — **none require position** |
| Elevation-as-quality-signal via impossible-altitude flagging (Runalyze-style raw/corrected duality, minus the DEM correction itself) | Directly modeled on Runalyze's documented pattern — the one concrete, reusable precedent this research found | MEDIUM — the *flagging* half of Runalyze's pattern is straightforward from altitude-rate-of-change; the *correction* half (SRTM DEM overlay) is explicitly out of scope for this milestone (flag, don't correct) | Needs only committed altitude stream — available. Does **not** need an external DEM dataset since the milestone flags rather than corrects |
| Review queue in local curation mode | No direct external precedent (this is closer to Strava's own internal moderation queue for flagged efforts, which is not user-facing on any platform) but conceptually consistent with "flagged efforts stay visible, never deleted" pattern seen in Strava's segment exclusion (excluded from leaderboard, not deleted from account) | MEDIUM — mostly UI/workflow work on top of existing local curation mode (Phase 24) | No new data dependency; extends existing manual PR-exclusion mechanism |

### Anti-Features (things that look tempting from platform research but don't fit this project)

| Anti-Feature | Why It Looks Appealing | Why Problematic Here | Alternative |
|---|---|---|---|
| Geometric GPS-spike rejection (Kalman-gated position filtering, map-matching / "Correct Distance"-style snapping) | This is what Strava, the GNSS engineering literature, and map-matching research actually use for spike rejection — the "real" industry technique | **Requires per-sample lat/lng, which this project deliberately does not commit.** Cannot be built without violating the privacy decision that excluded position from streams. | Derivative-only implausibility checks on distance/time and altitude/distance — strictly weaker but the only option available |
| Silent automatic distance/pace correction (an invisible "fix it under the hood" pipeline step, à la Strava's undocumented ingest-time outlier removal) | Would make numbers "just work" without user friction | Every genuinely user-facing example found (Correct Distance, Runalyze's tools, Runalyze's raw/corrected toggle) is **explicit and reversible**, not silent; a silent auto-fix on committed streams would also violate the milestone's own non-goal (never modify committed streams, never auto-correct genuine device error) | Flag-and-surface, exactly as the milestone already specifies |
| External DEM-based elevation correction (full Runalyze-style SRTM overlay) | It's the single most concrete, most credible pattern found in this whole research pass | Out of scope for this milestone by explicit instruction (flag the impossible-altitude case, no grade-adjusted pace, no correction) and would require sourcing/hosting an external elevation dataset this project has no infrastructure for | Flag altitude-rate implausibility only; defer correction to a future milestone if ever pursued |
| Absolute world-record-based PR ceiling (the existing `WORLD_RECORD_SPEED_MPS` guard's failure mode, per PROJECT.md) | Simple, one constant, no historical data needed | Already demonstrated in this project to be too loose (admits a 44.0s 400m) — matches the general pattern of "absolute ceiling" methods in the anomaly-detection literature being blunter than personal/hierarchical ones | Personal plausibility ceiling (differentiator above) |
| Grade-adjusted pace (Minetti/GAP) as part of this milestone | It's the standard, well-documented answer to "why did that downhill split look impossibly fast" | Explicitly out of scope this milestone per the prompt | Use raw grade (computable from committed altitude) only as *context* attached to a speed-implausibility flag, not as a full GAP computation |

## Feature Dependencies

```
[One gap-aware pace derivation]
    └──required-by──> [Speed-implausibility flag] (needs a stable dd/dt, not the raw per-sample noise)
    └──required-by──> [Per-activity quality badges] (elapsed-vs-moving divergence badge needs the same gap classification)

[Gap classification (recording gap vs. pause gap)]
    └──required-by──> [Honest pace-histogram coverage]
    └──required-by──> [Elapsed-vs-moving divergence badge]

[Personal plausibility ceiling]
    └──requires──> [Existing PR-evolution history] (already computed, REC-02..REC-07)
    └──enhances──> [Review queue in local curation mode] (ceiling produces the candidates the queue reviews)

[Altitude-rate implausibility flag]
    └──independent-of──> [Position data] (confirmed not required — altitude/distance derivative only)

[Grade-adjusted pace] ──deferred, not built this milestone, but──
    └──context-for──> [Speed-implausibility flag] (raw grade should suppress false positives on real downhills, per Q6)
```

### Dependency Notes

- **Speed-implausibility flag requires the gap-aware derivation, not raw per-sample deltas** — this mirrors why the project's own investigation found the *decimation* artifact (`MAX_SAMPLES = 3000`), not device noise, responsible for most of the phantom-fast-pace problem: an implausibility check run against un-smoothed, aliased data will fire constantly on manufactured noise rather than genuine outliers.
- **The personal-ceiling differentiator enhances, but does not block, the review queue** — the queue can launch with the existing manual exclusion mechanism and absorb the ceiling's output once it exists, consistent with the milestone's "review queue... feeding the existing manual PR-exclusion list."
- **Grade context is a soft dependency, not a hard one** — raw grade (altitude/distance) can suppress an obvious false-positive ("very fast, but it's a steep smooth downhill") without computing full GAP, so this can be sequenced independently of any future GAP work.

## MVP Recommendation (relative to this milestone's already-stated target features)

The milestone's own target-feature list (PROJECT.md) already matches what this research would independently recommend as sequencing:

1. **One gap-aware pace derivation** — table stakes, unlocks everything else, matches universal industry pattern of picking one number per context.
2. **Honest coverage (gap classification)** — table stakes, directly modeled on how Strava's own moving-time policy treats "resolved by device" vs. "needs independent judgment" spans.
3. **Per-activity quality signals/badges** — differentiator, no direct precedent, highest design risk; start with the two sub-signals that need no new dependency-work (gap profile, elapsed-vs-moving divergence) before the harder composite ones (stair-step ratio, impossible-sample count).
4. **Elevation as a quality signal** — differentiator with the *one* concrete external precedent (Runalyze), but scoped to flagging only, per this milestone's non-goals.
5. **Personal plausibility ceiling + review queue** — highest-value differentiator, but explicitly has no product to copy; treat academic MAD/hierarchical framing as terminology and conceptual grounding only, not a spec.

**Defer:** Grade-adjusted pace / GAP — explicitly out of scope; treat raw grade only as a false-positive suppressor for the speed-implausibility flag, nothing more.

## Sources

**Strava (official):**
- [Moving Time, Speed, and Pace Calculations](https://support.strava.com/hc/en-us/articles/115001188684)
- [Strava Training Glossary for Running](https://support.strava.com/hc/en-us/articles/216917157)
- [Run Activity Pages](https://support.strava.com/en-us/articles/15401883-run-activity-pages)
- [Auto-Pause](https://support.strava.com/en-us/articles/15402141-auto-pause)
- [Bad GPS Data](https://support.strava.com/en-us/articles/15402181-bad-gps-data)
- [Excluded Segment Efforts](https://support.strava.com/en-us/articles/15401732-excluded-segment-efforts)
- [Segment Leaderboard Guidelines](https://support.strava.com/en-us/articles/15401921-segment-leaderboard-guidelines)
- [Matched Activities](https://support.strava.com/hc/en-us/articles/216918597-Matched-Activities)

**Strava (secondary, flagged LOW/MEDIUM per-claim above):**
- [road.cc — Strava to automatically flag suspicious activities](https://road.cc/content/news/strava-automatically-flag-suspicious-activities-301759)
- [findyouredge.app — Why Garmin and Strava show different pace](https://www.findyouredge.app/news/why-garmin-and-strava-show-different-pace)
- [Strava Community Hub — Smoothed moving average for graphs](https://communityhub.strava.com/developers-api-7/smoothed-moving-average-for-graphs-12731)

**Garmin (official/forum):**
- [Garmin Forums — Pace Graph Smoothing](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/50748/pace-graph-smoothing)
- [Garmin Support — What Criteria Determines a Personal Record in Garmin Connect?](https://support.garmin.com/en-US/?faq=GePPQ3FJYO0A8TAHLeC7CA)
- [Garmin Support — Elevation Accuracy of Outdoor Devices With Barometric Altimeters](https://support.garmin.com/en-US/?faq=WlvNrOungC28xGtwB7hLY5)

**TrainingPeaks (official):**
- [How to Analyze a file in TrainingPeaks](https://help.trainingpeaks.com/hc/en-us/articles/208916857)

**intervals.icu (forum, LOW confidence throughout):**
- [Smoothing (rolling avg.)](https://forum.intervals.icu/t/smoothing-rolling-avg/56636)
- [Gradient adjusted pace + Pace training load](https://forum.intervals.icu/t/gradient-adjusted-pace-pace-training-load/4031)

**Runalyze (official):**
- [Help: Elevation](https://runalyze.com/help/article/elevation)
- [Help: Strange/Extreme elevation values with elevation correction](https://runalyze.com/help/article/extreme-elevation-corrected-values)
- [Help: How can I fix the recorded distance data?](https://runalyze.com/help/article/how-to-fix-recorded-distance-data) (403 on direct fetch; summarized from search index)
- [Help: Analysis tool: Quality sessions](https://runalyze.com/help/article/quality-sessions)

**GAP / Minetti (secondary, converging, MEDIUM confidence):**
- [fellrnr.com — Grade Adjusted Pace](https://fellrnr.com/wiki/Grade_Adjusted_Pace)
- [aaron-schroeder.github.io — Reverse-engineering Strava's Grade Adjusted Pace](https://aaron-schroeder.github.io/reverse-engineering/grade-adjusted-pace.html)
- [pacelore.com — Grade-Adjusted Pace, explained](https://pacelore.com/why/gap)

**GNSS engineering / anomaly-detection literature:**
- [PMC10007219 — Software Correction of Speed Measurement Determined by Phone GNSS Modules in Applications for Runners](https://pmc.ncbi.nlm.nih.gov/articles/PMC10007219/)
- [arXiv 2604.21953 — Performance Anomaly Detection in Athletics: A Benchmarking System with Visual Analytics](https://arxiv.org/pdf/2604.21953)

**Project context (not external, cited for internal consistency):**
- `/Users/pedf/workspace/strava-widgets/.planning/PROJECT.md` — v2.2 Pace Data Quality milestone scope, non-goals, and the Suunto 17 m/s / 51.3%-position-coverage example that this research's "no position data" framing generalizes from

---
*Feature research for: pace data quality in running-analytics platforms*
*Researched: 2026-09-08*
