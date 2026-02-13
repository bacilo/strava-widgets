# Feature Research

**Domain:** Strava analytics & running visualization (personal dashboard)
**Researched:** 2026-02-13
**Confidence:** MEDIUM (based on training data — Strava ecosystem well-known but not live-verified)

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any Strava analytics tool must have to be useful.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Strava OAuth + data sync | Can't do anything without data | HIGH | OAuth flow, token refresh, paginated API calls |
| Distance totals (weekly/monthly/yearly) | Most basic running stat | LOW | Simple aggregation over activity distances |
| Pace/speed averages | Runners always track pace | LOW | Derive from distance + moving_time |
| Activity list with details | Need to see individual runs | LOW | Date, distance, duration, pace, elevation |
| Time period filtering | Compare different periods | MEDIUM | Date range picker, preset periods (this week, this month, YTD) |
| Elevation gain totals | Standard running metric | LOW | Sum of total_elevation_gain |
| Run count per period | "How often am I running?" | LOW | Count activities per time bucket |
| Data persistence/caching | Don't re-fetch everything every time | MEDIUM | Store activities locally, incremental sync |

### Differentiators (Competitive Advantage)

Features that make this stand out vs Strava's built-in stats or tools like Elevate/VeloViewer.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Weekly km bar chart | Visual trend Strava buries in yearly summary | LOW | Primary "first win" — chart.js or Observable Plot |
| Year-over-year comparison | See progress across years side-by-side | MEDIUM | Align by week-of-year, overlay multiple years |
| Streak detection | Consecutive run days, weekly consistency | MEDIUM | Gap detection algorithm on sorted activity dates |
| Time-of-day patterns | "Am I a morning or evening runner?" | LOW | Bucket start_date_local by hour |
| Seasonal trends | Volume by season across years | MEDIUM | Aggregate by month, compare across years |
| Countries run in (map) | Visual travel + running history | HIGH | Reverse geocode start_latlng, choropleth map |
| Cities run in (list) | "I've run in 47 cities" | MEDIUM | Reverse geocode, deduplicate, count |
| Route overlay map | All runs on one map | HIGH | Decode polylines, render on Leaflet/Mapbox |
| Run animation on map | Replay a run's GPS trace | HIGH | Animate decoded polyline on map |
| Street view integration | See what a run looked like | VERY HIGH | Google Street View API, path sampling |
| Embeddable widgets | Drop stats into any webpage | MEDIUM | Self-contained JS bundles, configurable |
| Custom stat definitions | User-defined aggregations | HIGH | Expression language or config-driven stats |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time Strava sync | "I want it updated immediately" | Webhooks need a server; rate limits; complexity for marginal value on personal site | Daily rebuild via GitHub Actions — good enough |
| Multi-sport support (v1) | "I also cycle/swim" | Doubles data model complexity, different metrics per sport | Runs only for v1, add sports as separate modules later |
| Social/sharing features | "Share my stats" | Scope creep, auth complexity, GDPR concerns | Public widgets on personal site = sharing |
| Heart rate zone analysis | "Training zones matter" | Requires premium Strava data, HR monitor dependency, complex physiology | Defer to v2 — focus on distance/pace first |
| AI training recommendations | "Tell me what to run next" | Massive scope, liability, needs sports science | Out of scope entirely |
| Mobile app | "Check stats on phone" | Separate codebase, app store complexity | Responsive widgets work on mobile browsers |

## Feature Dependencies

```
Strava OAuth + Data Sync
    └──requires──> Token Management + Storage
                       └──enables──> All other features

Activity List
    └──requires──> Data Sync
                       └──enables──> Distance Totals
                       └──enables──> Pace Averages
                       └──enables──> Streak Detection

Distance Totals
    └──enables──> Weekly KM Chart
    └──enables──> Year-over-Year Comparison
    └──enables──> Seasonal Trends

Countries/Cities Maps
    └──requires──> Data Sync (start_latlng field)
    └──requires──> Reverse Geocoding Service
    └──requires──> Map Rendering Library

Route Overlay Map
    └──requires──> Data Sync (map.summary_polyline field)
    └──requires──> Polyline Decoder
    └──requires──> Map Rendering Library

Embeddable Widgets
    └──requires──> At least one visualization
    └──requires──> Widget Build System (Vite bundle)
```

### Dependency Notes

- **All features require Data Sync:** Nothing works without Strava data
- **Geographic features require start_latlng:** Available on all activities with GPS
- **Map features require polyline data:** summary_polyline from Strava, needs decoding
- **Reverse geocoding requires external service:** Nominatim (free) or Google Geocoding API
- **Widgets require a build step:** Bundle JS + CSS for embedding in external sites

## MVP Definition

### Launch With (v1)

- [ ] Strava OAuth flow + token refresh — foundation for everything
- [ ] Activity data sync + local JSON storage — cache to avoid rate limits
- [ ] Weekly km bar chart — the "first win" the user wants to see
- [ ] Year-over-year totals dashboard — km, runs, hours comparison
- [ ] Basic embeddable widget — drop a `<script>` tag into Jekyll/Astro site

### Add After Validation (v1.x)

- [ ] Streak detection + display — consecutive days, weekly consistency
- [ ] Time-of-day and seasonal patterns — when do you run?
- [ ] Monthly/custom period aggregations — flexible time bucketing
- [ ] Multiple widget types — different visualizations as separate embeds

### Future Consideration (v2+)

- [ ] Countries run in (world map) — requires reverse geocoding pipeline
- [ ] Cities run in (list + stats) — requires reverse geocoding pipeline
- [ ] Route overlay map — requires polyline decoding + map rendering
- [ ] Run animation — requires polyline + animation framework
- [ ] Street view integration — requires Google API, complex sampling
- [ ] Multi-sport support — requires data model extension

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Strava OAuth + sync | HIGH | HIGH | P1 |
| Data persistence | HIGH | MEDIUM | P1 |
| Weekly km chart | HIGH | LOW | P1 |
| Year-over-year totals | HIGH | LOW | P1 |
| Embeddable widget system | HIGH | MEDIUM | P1 |
| Streak detection | MEDIUM | MEDIUM | P2 |
| Time-of-day patterns | MEDIUM | LOW | P2 |
| Seasonal trends | MEDIUM | MEDIUM | P2 |
| Countries map | HIGH | HIGH | P2 |
| Cities list | MEDIUM | MEDIUM | P2 |
| Route overlay map | HIGH | HIGH | P3 |
| Run animation | MEDIUM | HIGH | P3 |
| Street view | LOW | VERY HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Strava (built-in) | VeloViewer | Statshunters | Elevate | Our Approach |
|---------|-------------------|------------|--------------|---------|--------------|
| Weekly distance chart | Yearly only | Yes (detailed) | No | Limited | Custom widget, embeddable |
| Year-over-year | Annual summary only | Yes | No | Some | Side-by-side comparison |
| Streaks | Basic (weekly) | No | No | Yes | Configurable streak types |
| Geographic stats | No | Tile explorer | Country/city counts | No | Map + list, embeddable |
| Route maps | Per-activity | Heatmap | Visited tiles | No | All routes overlaid |
| Embeddable | No | No | No | No | Core feature — this is our differentiator |
| Custom stats | No | Limited | No | Limited | User-defined aggregations |

**Key insight:** No existing tool produces embeddable widgets for external sites. This is the unique value proposition — own your running data presentation on your own website.

## Sources

- Strava API v3 documentation (developer.strava.com)
- VeloViewer feature set (veloviewer.com)
- Statshunters feature set (statshunters.com)
- Elevate for Strava extension
- Training data knowledge (MEDIUM confidence — not live-verified)

---
*Feature research for: Strava analytics & visualization platform*
*Researched: 2026-02-13*
