# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.
**Current focus:** Phase 11 - Route Map Widgets

## Current Position

Phase: 11 of 13 (Route Map Widgets)
Plan: 1 of 3 in current phase
Status: Complete
Last activity: 2026-02-17 — Completed 11-01 (Route data infrastructure and RouteRenderer utility)

Progress: [██████████████████████░░░░░░] 85% (22/26 total plans across all phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 22
- Average duration: ~35 min per plan (estimated from v1.0 + v1.1 + v1.2)
- Total execution time: ~14.5 hours

**By Milestone:**

| Milestone | Plans | LOC | Duration |
|-----------|-------|-----|----------|
| v1.0 | 9 | 3,844 | 1 day |
| v1.1 | 10 | +2,858 | 3 days |
| v1.2 (in progress) | 5 | TBD | TBD |

**Recent Trend:**
- Last plan: Phase 11-01 (3 min) — Route data infrastructure
- Trend: Excellent (Route data pre-computation reduces widget payload by 72%)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **Phase 5**: Offline geocoding (offline-geocode-city) — Zero API calls, but returns suburbs instead of cities
- **Phase 9**: Non-blocking geocoding in CI — Geo failures don't halt stats pipeline
- **v1.2 Planning**: Replace geocoding library with GeoNames-based solution to fix city accuracy
- **Phase 10-01**: Migrated to offline-geocoder (GeoNames cities1000) with versioned cache (v2) — Fixes suburb-instead-of-city problem, 166K cities vs 5K in UN/LOCODE
- **Phase 10-01**: Made geocodeActivity async to work with offline-geocoder's promise-based SQLite API
- **Phase 10-01**: Versioned cache schema (v2) includes version number and geocoder identifier for safe future migrations
- **Phase 10-02**: Multi-city data stored separately in activity-cities.json to preserve backward compatibility
- **Phase 10-02**: Route sampling uses ~10 evenly distributed points for efficient multi-city detection
- **Phase 10-02**: Distance stats attributed to start city only (not split across cities) for meaningful comparison with v1
- **Phase 10-03**: Externalized Leaflet to CDN (global L) to keep widget bundles < 50KB
- **Phase 10-03**: Used vite-plugin-css-injected-by-js for Shadow DOM CSS injection
- **Phase 10-04**: Used *.png wildcard module declaration (not specific marker icon paths) for broader compatibility
- **Phase 11-01**: Pre-compute route data into optimized JSON files (2.0 MB) instead of loading full activity data (7.1 MB) in widgets — 72% payload reduction
- **Phase 11-01**: Created shared RouteRenderer utility to avoid duplicating polyline decode, auto-fit, and popup logic across three route widgets
- **Phase 11-01**: HSL color distribution for multi-route rendering provides visually distinct colors via hue rotation

### Key Findings

**Geocoding Library Issue (RESOLVED in 10-01):**
The `offline-geocode-city` library used UN/LOCODE (trade/transport locations) data, which systematically returned nearby suburbs instead of actual major cities. Examples: Paris → Gif-sur-Yvette, Manhattan → Secaucus, Berlin → Stahnsdorf, London → Totteridge.

**Resolution:** Migrated to `offline-geocoder` with GeoNames cities1000 dataset (166K cities worldwide). Copenhagen area now correctly shows Frederiksberg/Vanløse/Christianshavn neighborhoods instead of "Roskilde" suburb. Old data archived at data/geo/v1/ for comparison.

**Route polyline data:** `map.summary_polyline` is already stored in activity JSON files — no Strava re-fetch needed for maps.

**Multi-city route prevalence:** 1554 of 1808 activities (86%) pass through multiple cities, validating the need for multi-city tracking beyond just start location.

**Geocoding accuracy improvements:** Comparison script shows 103 city name changes from UN/LOCODE to GeoNames. Major improvements: Roskilde → Frederiksberg/Vanløse/Christianshavn (Copenhagen), Alcochete → Alvalade/Olivais (Lisbon), Stahnsdorf → Gropiusstadt (Berlin).

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 10 (Complete):**
- ~~Geocoding library migration requires cache invalidation and versioned schema~~ ✓ RESOLVED in 10-01
- ~~Polyline decoding requires @mapbox/polyline library~~ ✓ RESOLVED in 10-02 (installed, TypeScript declarations added)
- ~~Multi-city detection needs efficient route sampling strategy~~ ✓ RESOLVED in 10-02 (10-point sampling, 527s for 1808 activities)
- ~~TypeScript compilation fails on PNG imports~~ ✓ RESOLVED in 10-04 (added src/types/png-modules.d.ts)
- GeoNames database (12MB) lives in node_modules - not committed to git. Future npm installs require running generation script OR moving database to project data/ directory

**Phase 11-13:**
- Polyline decoding for 1,808 routes must not block UI (chunking/Web Workers may be needed)
- Heatmap memory usage must stay under 200MB (viewport culling required)

## Session Continuity

Last session: 2026-02-17
Stopped at: Completed Phase 11-01 (Route data infrastructure and RouteRenderer utility)
Resume file: None

---
*Last updated: 2026-02-17 after Phase 11-01 completion*
