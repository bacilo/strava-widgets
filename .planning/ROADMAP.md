# Roadmap: Strava Analytics Platform

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-02-14)
- ✅ **v1.1 Geographic & Widget Customization** — Phases 5-9 (shipped 2026-02-16)
- 🚧 **v1.2 Maps & Geo Fix** — Phases 10-13 (in progress)

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

### 🚧 v1.2 Maps & Geo Fix (In Progress)

**Milestone Goal:** Fix city detection accuracy, add multi-city tracking per run, and build interactive map widgets (route maps, heatmap, country/city map).

#### Phase 10: Geocoding Foundation & Map Infrastructure
**Goal**: Accurate city-level geocoding and Leaflet integration with Shadow DOM
**Depends on**: Phase 9
**Requirements**: GEO-01, GEO-02, GEO-03, GEO-04
**Success Criteria** (what must be TRUE):
  1. User sees accurate city names in geographic stats (Copenhagen, not Frederiksberg)
  2. User sees all cities a run passes through in activity metadata
  3. User can compare old vs new geocoding results to verify accuracy improvement
  4. Existing geographic widgets (geo-table-widget) continue working after library change
  5. Leaflet renders correctly in Shadow DOM with all CSS and controls working
  6. Map widgets load with acceptable bundle size (Leaflet externalized to CDN)
**Plans**: 3 plans

Plans:
- [ ] 10-01-PLAN.md — Geocoding library migration (offline-geocode-city to offline-geocoder/GeoNames)
- [ ] 10-02-PLAN.md — Polyline decoding, multi-city detection, and geocoding comparison script
- [ ] 10-03-PLAN.md — Leaflet infrastructure setup with Shadow DOM and CDN externalization

#### Phase 11: Route Map Widgets
**Goal**: Interactive single-run and multi-run route visualization
**Depends on**: Phase 10
**Requirements**: ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, ROUTE-05
**Success Criteria** (what must be TRUE):
  1. User can view a single run's route on an interactive map with zoom/pan
  2. User can browse a list of runs and select one to view its route
  3. User can see the latest N runs overlaid on a single map
  4. Route auto-fits to viewport on load without manual zooming
  5. User can click a route to see distance, date, and pace in a popup
**Plans**: 3 plans

Plans:
- [ ] 11-01-PLAN.md — Route data pre-computation and shared RouteRenderer utility
- [ ] 11-02-PLAN.md — Single-run map widget and multi-run overlay widget
- [ ] 11-03-PLAN.md — Route browser widget with list selection and embedded map

#### Phase 12: Heatmap & Pin Map Widgets
**Goal**: All-runs heatmap and geographic pin map with click interactions
**Depends on**: Phase 10 (can run parallel to Phase 11 after Phase 10 complete)
**Requirements**: HEAT-01, HEAT-02, HEAT-03, HEAT-04, PIN-01, PIN-02, PIN-03, PIN-04
**Success Criteria** (what must be TRUE):
  1. User can view all 1,808 runs overlaid as a heatmap on a single map
  2. User can filter heatmap by date range (custom range and yearly presets)
  3. User can customize heatmap colors (4-5 color scheme options)
  4. Heatmap renders all routes without blocking UI or exceeding 200MB memory
  5. User can view a world map with pins for each city/country visited
  6. User can click a pin to see run count, distance, and visit dates
  7. User can toggle between country-level and city-level pin views
  8. Pin size or color reflects activity count (visual data encoding)
**Plans**: 2 plans

Plans:
- [ ] 12-01-PLAN.md — Heatmap widget with pre-computed data, date filtering, and color schemes
- [ ] 12-02-PLAN.md — Pin map widget with city/country toggle, popups, and visual encoding

#### Phase 13: Standalone Pages
**Goal**: Full-page versions of map visualizations for dedicated viewing
**Depends on**: Phase 12
**Requirements**: PAGE-01, PAGE-02, PAGE-03
**Success Criteria** (what must be TRUE):
  1. User can view heatmap as a full standalone page (not embedded widget)
  2. User can view pin map as a full standalone page
  3. User can view route browser as a full standalone page
  4. Standalone pages share underlying widgets (no code duplication)
**Plans**: 1 plan

Plans:
- [ ] 13-01-PLAN.md — Standalone pages for heatmap, pin map, and route browser with navigation and build integration

## Progress

**Execution Order:**
Phases execute in numeric order: 10 → 11 → 12 → 13

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
| 10. Geocoding Foundation & Map Infrastructure | v1.2 | Complete    | 2026-02-17 | - |
| 11. Route Map Widgets | v1.2 | Complete    | 2026-02-17 | - |
| 12. Heatmap & Pin Map Widgets | v1.2 | Complete    | 2026-02-17 | - |
| 13. Standalone Pages | v1.2 | Complete    | 2026-02-17 | - |

---
*Last updated: 2026-02-17 after Phase 12 planning*
