# Requirements: Strava Widgets

**Defined:** 2026-02-16
**Core Value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.

## v1.2 Requirements

Requirements for Maps & Geo Fix milestone. Each maps to roadmap phases.

### Geocoding

- [ ] **GEO-01**: User sees accurate city names in geographic stats (GeoNames replaces UN/LOCODE)
- [ ] **GEO-02**: User sees all cities a run passes through, not just the start city
- [ ] **GEO-03**: User can verify geocoding accuracy via comparison of old vs new results
- [ ] **GEO-04**: Existing geographic widgets continue working after geocoding library change

### Route Maps

- [ ] **ROUTE-01**: User can view an interactive map of a single run's route with zoom/pan
- [ ] **ROUTE-02**: User can browse and select runs to view their routes on a map
- [ ] **ROUTE-03**: User can see the latest N runs overlaid on a single map
- [ ] **ROUTE-04**: Route auto-fits to viewport on load
- [ ] **ROUTE-05**: User can click a route to see distance, date, and pace

### Heatmap

- [ ] **HEAT-01**: User can view all runs overlaid as a heatmap on a single map
- [ ] **HEAT-02**: User can filter heatmap by date range
- [ ] **HEAT-03**: User can customize heatmap colors
- [ ] **HEAT-04**: Heatmap renders 1,808 routes without blocking the UI

### Pin Map

- [ ] **PIN-01**: User can view a world map with pins for each city/country visited
- [ ] **PIN-02**: User can click a pin to see run count, distance, and visit dates
- [ ] **PIN-03**: User can toggle between country-level and city-level pins
- [ ] **PIN-04**: Pin size or color reflects activity count

### Standalone Pages

- [ ] **PAGE-01**: User can view heatmap as a full standalone page
- [ ] **PAGE-02**: User can view pin map as a full standalone page
- [ ] **PAGE-03**: User can view route browser as a full standalone page

## Future Requirements

Deferred to v1.3+. Tracked but not in current roadmap.

### Advanced Maps

- **MAP-01**: User can see pace/speed color coding on route lines
- **MAP-02**: User can export heatmap as static image
- **MAP-03**: User can filter heatmap by time of day

### Advanced Geo

- **GEO-05**: User sees distance attributed proportionally across cities for multi-city runs (polyline segmentation)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time GPS tracking | Privacy issues, Strava webhooks unreliable, massive scope |
| Every-street completion (Wandrer) | Requires OSM street geometry, 100x scope increase |
| Animated run playback | High complexity, limited rewatchability, niche |
| Street View integration | Google Maps API costs, embedding restrictions |
| Custom map tile providers | Licensing issues, maintenance burden |
| 3D terrain visualization | WebGL complexity, no analytical value |
| Social/comparison features | Multi-user system required, not aligned with personal analytics |
| Route recommendations | Requires popularity data, routing algorithms, massive scope |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GEO-01 | Phase 10 | Pending |
| GEO-02 | Phase 10 | Pending |
| GEO-03 | Phase 10 | Pending |
| GEO-04 | Phase 10 | Pending |
| ROUTE-01 | Phase 11 | Pending |
| ROUTE-02 | Phase 11 | Pending |
| ROUTE-03 | Phase 11 | Pending |
| ROUTE-04 | Phase 11 | Pending |
| ROUTE-05 | Phase 11 | Pending |
| HEAT-01 | Phase 12 | Pending |
| HEAT-02 | Phase 12 | Pending |
| HEAT-03 | Phase 12 | Pending |
| HEAT-04 | Phase 12 | Pending |
| PIN-01 | Phase 12 | Pending |
| PIN-02 | Phase 12 | Pending |
| PIN-03 | Phase 12 | Pending |
| PIN-04 | Phase 12 | Pending |
| PAGE-01 | Phase 13 | Pending |
| PAGE-02 | Phase 13 | Pending |
| PAGE-03 | Phase 13 | Pending |

**Coverage:**
- v1.2 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

✓ 100% coverage achieved

---
*Requirements defined: 2026-02-16*
*Last updated: 2026-02-16 after roadmap creation*
