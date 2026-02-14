# Requirements: Strava Analytics Platform

**Defined:** 2026-02-14
**Core Value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.

## v1.1 Requirements

Requirements for milestone v1.1 Geographic & Widget Customization.

### Geographic Data

- [ ] **GEO-01**: User can see which countries they have run in, extracted from activity GPS coordinates
- [ ] **GEO-02**: User can see which cities they have run in, extracted from activity GPS coordinates
- [ ] **GEO-03**: Activities without GPS data are gracefully excluded with a coverage indicator ("Based on X of Y activities")

### Geographic Statistics

- [ ] **GSTAT-01**: User can see total distance and run count per country, ranked by distance
- [ ] **GSTAT-02**: User can see total distance and run count per city, ranked by distance
- [ ] **GSTAT-03**: User can export geographic statistics as a CSV file

### Geographic Table Widget

- [ ] **GTBL-01**: User can embed a geographic statistics table widget on any webpage via script tag
- [ ] **GTBL-02**: User can sort the table by clicking column headers (name, distance, runs)
- [ ] **GTBL-03**: Table widget paginates large datasets to maintain rendering performance

### Widget Customization

- [ ] **WCUST-01**: User can configure widget title, labels, colors, and size via HTML data-attributes with sensible defaults
- [ ] **WCUST-02**: Widgets support dark and light mode via attribute or auto-detection
- [ ] **WCUST-03**: Widgets auto-adapt to container size responsively
- [ ] **WCUST-04**: All existing widgets (stats card, comparison chart, streak widget) support the new customization system

## Future Requirements

Deferred to v1.2+. Tracked but not in current roadmap.

### Geographic Visualization

- **GVIS-01**: User can view interactive maps with run routes placed on them
- **GVIS-02**: User can view static "picture frame" maps of individual runs
- **GVIS-03**: User can choose map styling themes (topographic, neon, minimal)
- **GVIS-04**: User can use maps as post/page backgrounds
- **GVIS-05**: User can view animated run playback on maps
- **GVIS-06**: User can view Street View playback along a run route

### Geographic Extras

- **GEXT-01**: User can see choropleth country map colored by distance
- **GEXT-02**: User can see percentage completion badges for regions
- **GEXT-03**: User can define custom location groupings (e.g., "Nordic countries")

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time location tracking | Privacy concerns, scope creep beyond static analytics |
| Street-level geocoding | Poor accuracy, rate limiting issues — city-level is sufficient |
| Every-street completion (Wandrer clone) | Massive complexity, OpenStreetMap integration challenges |
| Unlimited theme customization | Maintenance burden, breaks layouts — use controlled CSS variable presets |
| Non-running activities | Focus on runs only for now |
| Mobile app | Web widgets only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GEO-01 | — | Pending |
| GEO-02 | — | Pending |
| GEO-03 | — | Pending |
| GSTAT-01 | — | Pending |
| GSTAT-02 | — | Pending |
| GSTAT-03 | — | Pending |
| GTBL-01 | — | Pending |
| GTBL-02 | — | Pending |
| GTBL-03 | — | Pending |
| WCUST-01 | — | Pending |
| WCUST-02 | — | Pending |
| WCUST-03 | — | Pending |
| WCUST-04 | — | Pending |

**Coverage:**
- v1.1 requirements: 13 total
- Mapped to phases: 0
- Unmapped: 13 ⚠️

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after initial definition*
