# Roadmap: Strava Analytics Platform

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-02-14)
- 🚧 **v1.1 Geographic & Widget Customization** - Phases 5-9 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) - SHIPPED 2026-02-14</summary>

**Milestone Goal:** Core analytics pipeline with embeddable widgets.

**Key accomplishments:**
- Strava OAuth authentication + incremental activity sync with rate limiting (1,808 activities)
- Statistics computation engine: weekly/monthly/yearly aggregations, pace, elevation
- Embeddable widget system: Shadow DOM isolation, Vite IIFE bundles, Chart.js visualizations
- Advanced analytics: streaks, year-over-year comparisons, time-of-day patterns, seasonal trends
- Widget library: stats card, comparison chart, streak/patterns widget — all configurable
- GitHub Actions CI/CD pipeline: daily cron refresh + GitHub Pages deployment

**Total output:** 4 phases, 9 plans, 3,844 LOC TypeScript, delivered in 1 day.

</details>

### 🚧 v1.1 Geographic & Widget Customization (In Progress)

**Milestone Goal:** Add geographic running statistics with embeddable table/list widgets, and make all widgets customizable via HTML attributes.

#### Phase 5: Geocoding Infrastructure
**Goal**: User can see geographic locations (countries/cities) extracted from run GPS data.
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: GEO-01, GEO-02, GEO-03
**Success Criteria** (what must be TRUE):
  1. User can see which countries they have run in, extracted from activity GPS coordinates
  2. User can see which cities they have run in, extracted from activity GPS coordinates
  3. Activities without GPS data are gracefully excluded with coverage indicator displayed
  4. Geocoding service uses offline library (no API calls, no rate limits, zero cost)
**Plans:** 1 plan

Plans:
- [ ] 05-01-PLAN.md — Offline geocoding pipeline (geocoder, cache, compute-geo-stats CLI)

#### Phase 6: Geographic Statistics
**Goal**: User can view distance and run count aggregated by country and city.
**Depends on**: Phase 5 (geocoded location data available)
**Requirements**: GSTAT-01, GSTAT-02, GSTAT-03
**Success Criteria** (what must be TRUE):
  1. User can see total distance and run count per country, ranked by distance
  2. User can see total distance and run count per city, ranked by distance
  3. User can export geographic statistics as a CSV file
  4. Statistics display coverage metadata showing how many activities included GPS data
**Plans**: TBD

Plans:
- [ ] 06-01: TBD during phase planning

#### Phase 7: Widget Attribute System
**Goal**: All widgets accept configuration via HTML data-attributes with sensible defaults.
**Depends on**: Phase 4 (existing widgets from v1.0)
**Requirements**: WCUST-01, WCUST-02, WCUST-03, WCUST-04
**Success Criteria** (what must be TRUE):
  1. User can configure any widget's title, labels, colors, and size via HTML data-attributes
  2. Widgets support dark and light mode via attribute or auto-detection
  3. Widgets auto-adapt to container size responsively
  4. All existing widgets (stats card, comparison chart, streak widget) support the new customization system
  5. Widget configuration works in HTML-only environments (CMSes, Jekyll pages) without JavaScript
**Plans**: TBD

Plans:
- [ ] 07-01: TBD during phase planning

#### Phase 8: Geographic Table Widget
**Goal**: User can embed geographic statistics table on any webpage.
**Depends on**: Phase 6 (geo-stats.json), Phase 7 (attribute system)
**Requirements**: GTBL-01, GTBL-02, GTBL-03
**Success Criteria** (what must be TRUE):
  1. User can embed a geographic statistics table widget on any webpage via script tag
  2. User can sort the table by clicking column headers (location, distance, runs)
  3. Table widget paginates large datasets to maintain rendering performance
  4. Table widget follows Shadow DOM isolation pattern from existing widgets
**Plans**: TBD

Plans:
- [ ] 08-01: TBD during phase planning

#### Phase 9: CI/CD Integration
**Goal**: Geographic data and widgets automatically refresh daily via GitHub Actions.
**Depends on**: Phase 8 (all components validated)
**Requirements**: None (integration phase)
**Success Criteria** (what must be TRUE):
  1. Geocoding runs automatically in GitHub Actions workflow on each build
  2. Geographic statistics are computed and committed automatically
  3. Geographic table widget is built and deployed to GitHub Pages
  4. CI pipeline continues working if geocoding fails (non-blocking errors)
  5. Documentation explains new commands, widget attributes, and data-attribution requirements
**Plans**: TBD

Plans:
- [ ] 09-01: TBD during phase planning

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7 → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-02-14 |
| 2. Analytics | v1.0 | 2/2 | Complete | 2026-02-14 |
| 3. Widgets | v1.0 | 4/4 | Complete | 2026-02-14 |
| 4. Pipeline | v1.0 | 1/1 | Complete | 2026-02-14 |
| 5. Geocoding Infrastructure | v1.1 | 0/1 | Planned | - |
| 6. Geographic Statistics | v1.1 | 0/? | Not started | - |
| 7. Widget Attribute System | v1.1 | 0/? | Not started | - |
| 8. Geographic Table Widget | v1.1 | 0/? | Not started | - |
| 9. CI/CD Integration | v1.1 | 0/? | Not started | - |

---
*Last updated: 2026-02-15 after Phase 5 planning*
