# Feature Research: Training Analytics Dashboard (v2.0)

**Domain:** Personal running-analytics dashboard (activity browsing, best efforts, records, trends)
**Researched:** 2026-08-10
**Confidence:** HIGH (official product docs + multiple independent sources per claim)

**Context:** v2.0 adds a static SPA dashboard on top of the existing widget platform — activity
browser, activity detail pages, self-computed best-effort PRs, and weekly/monthly/yearly/all-time
records and trends. Reference products: Strava, Garmin Connect, intervals.icu, Runalyze, Smashrun,
Elevate for Strava (browser extension, not a standalone product but a well-documented "power user
overlay" pattern worth studying). This is a **single-athlete personal dashboard** — no social,
no multi-user, no live sync (all already Out of Scope per PROJECT.md).

**Data reality driving this research:** 1,867 run activities exist today as **summary rows**
(distance, time, avg/max HR on ~90%, cadence on ~60%, elevation on ~90%). Time-series **streams**
(second-by-second pace/HR/cadence/elevation/lat-lng) are a NEW capability this milestone, sourced
two ways: (1) parsing the local Strava bulk-export FIT/GPX files via `provenance.json` for
historical activities, and (2) intervals.icu streams for activities synced going forward. Not
every activity will have streams — the bulk export covers ~1,841/1,866 canonical records per
provenance linkage, and older phone-GPX or unlinked activities may never get one. **Every feature
below is tagged with its data dependency** so the roadmap can sequence stream-dependent work after
stream ingestion lands, and ship summary-only wins earlier.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any modern training dashboard. Missing these makes the dashboard
feel like a toy next to Strava/Garmin/intervals.icu, which is the explicit "more complete and
versatile" bar this milestone sets.

#### Activity Browser

| Feature | Why Expected | Complexity | Data Dependency |
|---------|--------------|------------|------------------|
| Paginated/virtualized activity list (1,867 rows) | Every reference product opens to a list/log view | MEDIUM | Summary only |
| Sort by date, distance, pace, duration, HR | Standard column-sort UX (intervals.icu's grid has 70+ sortable columns) | LOW | Summary only |
| Filter by date range (custom, this year, last 12mo) | Table stakes on Strava Training Log, Garmin, intervals.icu | MEDIUM | Summary only |
| Filter by distance/pace/duration range | Common on intervals.icu's activity grid, Runalyze | MEDIUM | Summary only |
| Text search (activity name/notes) | Universal list-view expectation | LOW | Summary only |
| Calendar/month-grid view of training log | Strava Training Log, Garmin, TrainingPeaks, Runalyze all default to or offer this | MEDIUM | Summary only (daily rollups) |
| Visible active-filter chips + result count | UX best practice for any filtered list (Filter UX pattern literature) | LOW | N/A (UI) |
| Empty/missing-data states (no HR, no cadence) | ~10% of activities lack HR, ~40% lack cadence today | LOW | Summary only |

#### Activity Detail Page

| Feature | Why Expected | Complexity | Data Dependency |
|---------|--------------|------------|------------------|
| Route map on detail page | Every reference product leads with the map | LOW | Reuse existing polyline/route-map widget (already built) |
| Pace chart over distance/time | Strava's core "smoothed profile" analysis, Garmin's charts, intervals.icu | MEDIUM-HIGH | **Streams required** |
| Elevation profile chart | Table stakes alongside pace chart; ~90% have summary elevation gain today but not a profile | MEDIUM | **Streams required** for the profile; summary gain already available |
| HR chart over time | Standard on all reference products when a HR strap/watch was worn | MEDIUM | **Streams required**; only ~90% of activities have any HR at all |
| Auto-splits (per-km or per-mile pace table) | Strava's "Splits" tab, Garmin's lap table — one of the most-used detail-page features | MEDIUM-HIGH | **Streams required** (distance-vs-time to compute split boundaries) |
| Native laps (if device-recorded) | Toggle between splits/laps, per Strava's own docs | MEDIUM | **Streams + lap markers**, not present in current summary data — treat as summary-record splits only if lap markers can't be recovered from FIT |
| Basic stats header (distance, time, pace, elevation, HR avg/max) | Every product shows this above the fold | LOW | Summary only |
| Gear shown per activity (shoe) | Strava's automatic shoe-mileage attribution is widely used | LOW | Summary — **already available** via `provenance.json` gear linkage (per migration memory) |

#### Records/PRs

| Feature | Why Expected | Complexity | Data Dependency |
|---------|--------------|------------|------------------|
| All-time best per standard distance (5K, 10K, HM, marathon, etc.) | Strava's "All-Time PRs", Garmin's PR list — the anchor feature of any records page | HIGH | **Streams required** to detect a best-effort sub-segment inside a longer run (e.g., fastest 5K split within a 10-mile run), not just whole-activity times |
| "Recent PR" badge/notification on a run that beats a record | Strava explicitly calls this out ("Track Your Run PRs") | LOW (once records engine exists) | Derived from best-efforts engine |
| Per-distance history/trend (how has my 10K best evolved over years) | Strava's Progress tab shows top-10 times per year + trend graph | MEDIUM | Derived from best-efforts engine |
| Weekly/monthly/yearly aggregate totals (distance, time, run count) | Already built in v1.0 widgets — must resurface inside the SPA | LOW | Summary only — **mostly reuse existing v1.0 aggregation logic** |
| "Biggest week/month" and streak records | Already computed for v1.0 streak widgets | LOW | Summary only — **reuse existing pipeline output** |

#### Trends

| Feature | Why Expected | Complexity | Data Dependency |
|---------|--------------|------------|------------------|
| Weekly/monthly volume trend chart (km over time) | Core of every dashboard's home page; already exists as a v1.0 widget | LOW | Summary only — reuse |
| Year-over-year comparison | v1.0 already has YoY totals widget; needs SPA-native presentation | LOW | Summary only — reuse |
| Cadence/HR averages trending over months | intervals.icu "Compare" pages, Elevate's yearly progression charts | MEDIUM | Summary only — **per-activity averages (already ~90%/60% coverage) are sufficient; full streams not required for a trend line of run-level averages** |

### Differentiators (Competitive Advantage)

Not required for a credible dashboard, but where a personal, self-hosted, streams-owning platform
can go further than the SaaS competitors — most of them gate advanced analytics behind
subscriptions (Strava Summit) or cloud lock-in.

| Feature | Value Proposition | Complexity | Data Dependency |
|---------|-------------------|------------|------------------|
| Self-computed best efforts within *any* run (not just races) | Strava/Garmin only surface all-time bests loosely; a full sliding-window best-effort scan (400m..marathon) across every run, including buried mid-run efforts, is more thorough than what any SaaS tool exposes for free | HIGH | **Streams required** — this is the explicit centerpiece of the milestone |
| Training load (CTL/ATL/TSB "Fitness & Freshness" chart) via TRIMP | intervals.icu's headline feature (PMC chart); TRIMP needs only avg HR + duration per run — no power meter, no full streams | MEDIUM | **Summary only** — TRIMP = duration × avg-HR × HR-reserve weighting; computable today for the ~90% of activities with HR, uniformly across the full 1,867-run archive (unlike intervals.icu's own load, which only covers ~1yr of Garmin backfill) |
| Age-graded performance % on every PR/best-effort | WMA age-grading is a well-documented open standard (finish time ÷ world record time × age factor); Strava doesn't offer this on the free tier, Runalyze does | LOW-MEDIUM | Summary only — needs just distance+time+birthdate, static WMA table |
| Race-time prediction across distances (Riegel formula from PRs) | Cheaper and more transparent than Garmin's proprietary VO2max-based predictor, which is well-documented as overestimating | LOW | Derived from best-efforts engine, no streams needed beyond what PRs already require |
| Full-archive PR history back to the oldest 2018-era Strava record | Garmin Connect only has ~1yr of comparable history for this user (per migration memory); Strava web PRs are also incomplete for old imported activities | MEDIUM | **Streams required** for the ~1,841 activities with recovered FIT/GPX via provenance.json |
| Cross-widget deep-linking (dashboard activity → existing route-map/heatmap widgets) | Unique to owning both the widget layer and the dashboard; no reference competitor can do this | LOW | Reuses existing widget infra |
| Gear-aware trend breakdown (pace/HR by shoe) | Strava gear tracking is mileage-only; combining it with pace/HR trend data per shoe is not offered anywhere | MEDIUM | Summary — gear already linked via provenance.json |
| Pace-distribution / zone breakdown per run | Strava's "Pace Distribution" tab, useful for a personal training-quality view | MEDIUM-HIGH | **Streams required** |
| Combined weather-agnostic "conditions-normalized" personal bests (future) | Speculative differentiator — normalize PRs for temperature once weather is available | HIGH | Streams + external weather data (see anti-features) |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Segments & segment leaderboards | Strava's most iconic feature | Requires a community segment database and multi-athlete comparison — fundamentally a social/competitive feature; PROJECT.md already excludes social features | Personal best-efforts engine (this milestone) covers the "how fast have I gone over this distance" need without needing other athletes' data |
| Garmin-style proprietary "Training Status"/"Readiness"/recovery-time scores | Looks authoritative, sounds actionable | Black-box algorithms (Garmin's own docs caution these are estimates, not lab-validated); reimplementing them is guesswork with no ground truth to validate against | Transparent, well-documented TRIMP-based CTL/ATL/TSB (differentiator above) — same value, auditable math |
| Historical weather backfill for all 1,867 runs | "Nice context for why a run felt hard" | Requires a paid historical-weather API, backfill cost for the full archive, and ongoing capture going forward — high cost for low analytical value on a personal dashboard | Skip for v2.0; revisit only if a free/cheap bulk historical weather source appears |
| VO2max / fitness-age estimation | Garmin shows this prominently, feels like a "score" | Proprietary, requires calibrated physiological models beyond pace+HR; recreating it credibly needs data (resting HR trends, HRV) this pipeline doesn't have | Riegel-based race predictions from PRs (differentiator above) — same "how fit am I" answer without pretending false precision |
| Kudos/comments/social feed | Familiar Strava UX | Multi-user system, auth, moderation — explicitly Out of Scope (PROJECT.md: "Social features") | N/A — not needed for single-athlete tool |
| Live/real-time activity sync during a run | "See it update live" | Requires webhooks/streaming infra; PROJECT.md already excludes real-time sync, static hosting can't do this anyway | Existing daily batch pipeline |
| AI-generated training plans/recommendations | Sounds like the natural next step after records/trends | Explicitly excluded in PROJECT.md (liability, sports-science expertise required, massive scope) | Records/trends dashboard gives the athlete raw material to self-coach |
| Route recommendations / "where should I run" | Natural extension once maps exist | Needs popularity/safety data and routing algorithms, unrelated to analytics goal | Out of scope, unchanged from v1.2 research |

## Feature Dependencies

```
[Stream Ingestion: FIT/GPX + intervals.icu streams]  (NEW, blocking)
    └──requires──> [provenance.json linkage] (already exists)
    └──enables──> [Best Efforts Engine (sliding-window scan)]
    └──enables──> [Activity Detail Charts: pace/HR/elevation]
    └──enables──> [Auto-Splits table]
    └──enables──> [Pace-distribution / zone breakdown]

[Best Efforts Engine]
    └──requires──> [Stream Ingestion]
    └──enables──> [All-Time PR list per distance]
    └──enables──> [Recent-PR badges]
    └──enables──> [Per-distance history/trend]
    └──enables──> [Age-graded % on PRs]  (also requires WMA table, no extra stream dep)
    └──enables──> [Race-time prediction (Riegel)]

[Activity Browser (list/calendar/filters/sort/search)]
    └──requires──> [Existing summary activity data] (already exists, no new dependency)
    └──enhances──> [Activity Detail Page] (list → detail navigation)

[Weekly/Monthly/Yearly/All-Time Aggregates & Records]
    └──requires──> [Existing v1.0 aggregation pipeline] (reuse, no new dependency)
    └──enhances──> [Trends: volume, YoY]

[Training Load (CTL/ATL/TSB via TRIMP)]
    └──requires──> [Summary avg HR + duration] (already ~90% available, no streams needed)
    └──independent-of──> [Best Efforts Engine] (can ship before or after stream ingestion)

[Gear-aware breakdowns]
    └──requires──> [provenance.json gear linkage] (already exists)
    └──enhances──> [Activity Detail Page], [Trends]

[Dashboard SPA Shell / routing]
    └──requires──> [Pre-computed JSON build step] (static hosting constraint)
    └──BLOCKS──> [everything above, at the presentation layer]
```

### Dependency Notes

- **Stream ingestion is the single biggest unlock:** best efforts, detail-page charts, splits, and
  pace-distribution all sit behind it. Everything else in this milestone (browser, aggregates,
  training load, gear breakdowns) can be built and shipped against summary data alone, in parallel
  or before stream work lands — a natural phase-ordering signal for the roadmap.
- **Training load (TRIMP) is deliberately summary-only:** don't gate it behind stream ingestion.
  It's one of the highest-value "intervals.icu-style" features and is achievable today.
- **Best-effort accuracy depends on stream coverage, not just presence:** a "best 5K" claim is
  only as good as the GPS/pace-derivation quality of the source stream. Flag activities with only
  partial or noisy streams (e.g., phone GPX) so PR lists don't get poisoned by bad data — this
  echoes the geometry-validation lesson already learned during the intervals.icu migration
  (0.6–1.6x distance sanity check).
- **Records/aggregates reuse existing v1.0 logic** — this is presentation/routing work in the SPA,
  not new computation, and should be sequenced early as low-risk, high-visible-progress work.
- **Age-grading and race prediction are "free" once best efforts exist** — cheap additions with no
  independent data dependency beyond the best-efforts output, good candidates to bundle into the
  same phase as the PR list rather than a separate phase.

## MVP Definition

### Launch With (v2.0 core)

- [ ] Activity browser: list view with sort, filter (date/distance/pace), search — summary data, no stream dependency, ships immediately
- [ ] Activity detail page: stats header + reused route map — summary data only
- [ ] Weekly/monthly/yearly/all-time aggregates & records resurfaced in SPA — reuse v1.0 pipeline
- [ ] Stream ingestion pipeline (FIT/GPX parse + intervals.icu streams) — blocking infrastructure for everything below
- [ ] Best-effort engine (fastest 400m..marathon within runs) + PR list per distance — the explicit centerpiece
- [ ] Activity detail charts: pace/elevation/HR over the route, once streams exist

### Add After Validation (v2.x)

- [ ] Calendar/month-grid training-log view
- [ ] Auto-splits table on activity detail
- [ ] Training load (CTL/ATL/TSB via TRIMP) — cheap, summary-only, but sequence after core browser/PRs ship so it doesn't compete for attention
- [ ] Age-graded % and Riegel race predictions on PR list
- [ ] Gear-aware pace/HR trend breakdown

### Future Consideration (v3+)

- [ ] Pace-distribution/zone breakdown charts
- [ ] Native lap support (device-recorded laps, not just computed splits)
- [ ] Cross-widget deep-linking from dashboard into existing map widgets
- [ ] Weather-normalized PRs (only if a viable bulk historical weather source appears)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Stream ingestion (FIT/GPX + intervals.icu) | HIGH | HIGH | P0 (blocking) |
| Activity browser (list/filter/sort/search) | HIGH | MEDIUM | P1 |
| Activity detail — stats + map | HIGH | LOW | P1 |
| Weekly/monthly/yearly/all-time aggregates | HIGH | LOW | P1 |
| Best-efforts engine + PR lists | HIGH | HIGH | P1 |
| Activity detail charts (pace/HR/elevation) | HIGH | MEDIUM-HIGH | P1 |
| Auto-splits table | MEDIUM | MEDIUM-HIGH | P2 |
| Calendar/month-grid view | MEDIUM | MEDIUM | P2 |
| Training load (TRIMP CTL/ATL/TSB) | MEDIUM | MEDIUM | P2 |
| Age-graded % / Riegel prediction | MEDIUM | LOW | P2 |
| Gear-aware breakdowns | LOW-MEDIUM | MEDIUM | P3 |
| Pace-distribution/zones | MEDIUM | MEDIUM-HIGH | P3 |
| Native laps | LOW | MEDIUM | P3 |
| Weather backfill | LOW | HIGH | Not planned |
| Segments/leaderboards | N/A | N/A | Excluded (social) |
| Proprietary training status clone | LOW | HIGH | Excluded |

**Priority key:**
- P0: Blocking infrastructure — must exist before dependent features can ship
- P1: Core v2.0 milestone deliverables
- P2: Strong candidates for v2.x once core ships
- P3: Nice to have, defer until v2.x is validated

## Competitor Feature Analysis

| Feature | Strava | Garmin Connect | intervals.icu | Runalyze | Smashrun | Elevate (ext.) | Our Approach |
|---------|--------|-----------------|----------------|----------|----------|-----------------|--------------|
| Activity list/grid | ✓ Training Log | ✓ Calendar-first | ✓ 70+ column grid | ✓ | ✓ | ✓ overlay only | ✓ list + calendar, summary-only, ships first |
| Activity detail charts | ✓ core feature | ✓ core feature | ✓ | ✓ | ✓ | ✓ enhanced overlay | ✓ gated on stream ingestion |
| Splits/laps | ✓ | ✓ | ✓ | ✓ | Partial | — | ✓ P2, stream-dependent |
| All-time PRs / best efforts | ✓ (whole-activity + some segments) | ✓ PR list | ✓ | ✓ | ✓ | — | ✓ deeper: sliding-window scan inside any run, full archive back to 2018-era |
| Training load (CTL/ATL/TSB) | ✗ (Summit has "Fitness") | ✓ Training Status (proprietary) | ✓ headline feature (PMC) | ✓ | — | ✓ Fitness Trend | ✓ TRIMP-based, transparent, full-archive coverage (P2) |
| Age-graded scoring | ✗ | ✗ | Partial | ✓ | — | — | ✓ differentiator, cheap (P2) |
| Race prediction | ✗ (manual PRs only) | ✓ VO2max-based (overestimates per reviews) | Partial | ✓ | ✓ | — | ✓ Riegel-based, transparent (P2) |
| Gear tracking | ✓ mileage only | ✓ | Partial | — | — | — | ✓ mileage + pace/HR-by-gear (P3), data already linked |
| Segments/leaderboards | ✓ core, social | — | — | — | — | — | ✗ excluded (social, out of scope) |
| Weather on activity | ✓ (partial) | ✓ | — | — | — | — | ✗ excluded (backfill cost) |
| Embeddable/self-hosted | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ (browser ext, not standalone) | ✓ unique — static SPA, owns all data |

**Our differentiators:** full-archive best-efforts scanning (deeper than any SaaS free tier),
transparent open-formula training load and race prediction (vs. Garmin's proprietary black boxes),
and gear-aware trend analysis — all built on data this project already owns outright, with no
subscription gate.

## Sources

**intervals.icu:**
- [Fitness, Fatigue & Form Chart (PMC)](https://www.intervals.icu/features/fitness-chart/)
- [Manage Activities (70+ column grid)](https://www.intervals.icu/features/manage-activities/)
- [Track Your Progress](https://www.intervals.icu/features/track/)
- [Intervals.icu for Runners — STAS Guide](https://stas.run/en/guides/intervals-icu-beginners)

**Strava:**
- [Run Activity Pages](https://support.strava.com/hc/en-us/articles/216919567-Run-Activity-Pages)
- [Viewing Activities](https://support.strava.com/hc/en-us/articles/216919157-Viewing-Activities)
- [All-Time PRs](https://support.strava.com/hc/en-us/articles/216918487-All-Time-PRs)
- [Best Efforts - Running](https://support.strava.com/en-us/articles/15401661-best-efforts-running)
- [Best Efforts - Overview](https://support.strava.com/hc/en-us/articles/19685360245005-Best-Efforts-Overview)
- [My Segment Results](https://support.strava.com/hc/en-us/articles/216917447-My-Segment-Results)
- [Track Your Run PRs on Strava](https://stories.strava.com/articles/track-your-run-prs)
- [Training Log](https://support.strava.com/hc/en-us/articles/206535704-Training-Log)
- [Strava Gear Tracking (mileage)](https://theservicecourse.net/strava-gear-tracking/)
- [Adding Gear to Your Activities](https://support.strava.com/hc/en-us/articles/216918727-Adding-Gear-to-Your-Activities)

**Garmin Connect:**
- [Performance Measurements manual](https://www8.garmin.com/manuals-apac/webhelp/fenix7series/EN-SG/GUID-0ECA590D-69D1-4223-96D9-4E222C58784D-8498.html)
- [Predicted Race Times (Forerunner 945 manual)](https://www8.garmin.com/manuals/webhelp/forerunner945/EN-US/GUID-31B2458A-859A-4A34-AB83-224E4A29387A.html)
- [Garmin VO2 Max Accuracy Reviewed — The Mother Runners](https://www.themotherrunners.com/garmin-vo2-max-explained-metrics-reviewed/)

**Elevate for Strava:**
- [Elevate for Strava (GitHub)](https://github.com/thomaschampagne/elevate)
- [Elevate for Strava overview](https://thomaschampagne.github.io/elevate/)
- [Elevate for Strava — Coleman McCormick review](https://www.colemanm.org/post/elevate-for-strava/)

**Runalyze / Smashrun comparison:**
- [Top 10 Best Running Analysis Software of 2026](https://worldmetrics.org/best/running-analysis-software/)
- [Runalyze vs Smashrun — SaaSHub](https://www.saashub.com/compare-runalyze-vs-smashrun)

**Training load / TRIMP methodology:**
- [What is TRIMP? — OpenAthlete](https://www.openathlete.org/blog/what-is-trimp-and-how-to-use-it)
- [What is TRIMP? — Firstbeat](https://www.firstbeat.com/en/blog/what-is-trimp/)
- [Quantifying training, TRIMP and TSS — Fellrnr.com](https://fellrnr.com/wiki/TRIMP)

**Age-grading:**
- [Age Grade Calculator For Runners — Marathon Handbook](https://marathonhandbook.com/age-grade-calculator/)
- [Age Graded Running Calculator — RunBikeCalc (WMA tables)](https://www.runbikecalc.com/age-graded-calculator)

**UX patterns:**
- [Filter UX Design Patterns & Best Practices — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering)
- [Filter UI and UX Design — UXPin](https://www.uxpin.com/studio/blog/filter-ui-and-ux/)

**Internal:**
- Project memory: intervals.icu migration (provenance.json linkage, geometry validation lessons, gear-per-activity availability)

---
*Feature research for: Strava Analytics v2.0 Training Dashboard*
*Researched: 2026-08-10*
*Confidence: HIGH (official product docs for all major reference products, cross-verified with independent reviews/comparisons for proprietary-algorithm claims)*
