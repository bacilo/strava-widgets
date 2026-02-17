# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.
**Current focus:** Phase 10 - Geocoding Foundation & Map Infrastructure

## Current Position

Phase: 10 of 13 (Geocoding Foundation & Map Infrastructure)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-02-17 — Completed 10-01 (GeoNames geocoder migration)

Progress: [████████████████████░░░░░░░░] 73% (19/26 total plans across all phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 19
- Average duration: ~43 min per plan (estimated from v1.0 + v1.1 + v1.2)
- Total execution time: ~13.6 hours

**By Milestone:**

| Milestone | Plans | LOC | Duration |
|-----------|-------|-----|----------|
| v1.0 | 9 | 3,844 | 1 day |
| v1.1 | 10 | +2,858 | 3 days |
| v1.2 (in progress) | 1 | TBD | TBD |

**Recent Trend:**
- Last plan: Phase 10-01 (5 min) — Fast geocoder migration
- Trend: Improving (shorter execution times for focused migrations)

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

### Key Findings

**Geocoding Library Issue (RESOLVED in 10-01):**
The `offline-geocode-city` library used UN/LOCODE (trade/transport locations) data, which systematically returned nearby suburbs instead of actual major cities. Examples: Paris → Gif-sur-Yvette, Manhattan → Secaucus, Berlin → Stahnsdorf, London → Totteridge.

**Resolution:** Migrated to `offline-geocoder` with GeoNames cities1000 dataset (166K cities worldwide). Copenhagen area now correctly shows Frederiksberg/Vanløse/Christianshavn neighborhoods instead of "Roskilde" suburb. Old data archived at data/geo/v1/ for comparison.

**Route polyline data:** `map.summary_polyline` is already stored in activity JSON files — no Strava re-fetch needed for maps.

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 10 (Current):**
- ~~Geocoding library migration requires cache invalidation and versioned schema~~ ✓ RESOLVED in 10-01
- GeoNames database (12MB) lives in node_modules - not committed to git. Future npm installs require running generation script OR moving database to project data/ directory
- Leaflet CSS must be injected into Shadow DOM (not globally)
- IIFE bundle size will grow from 180KB to 500KB+ unless Leaflet externalized to CDN
- Mobile touch events on iOS/Android may require manual event delegation

**Phase 11-13:**
- Polyline decoding for 1,808 routes must not block UI (chunking/Web Workers may be needed)
- Heatmap memory usage must stay under 200MB (viewport culling required)

## Session Continuity

Last session: 2026-02-17
Stopped at: Completed Phase 10-01 (GeoNames geocoder migration)
Resume file: None

---
*Last updated: 2026-02-17 after Phase 10-01 completion*
