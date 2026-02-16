# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.
**Current focus:** Phase 10 - Geocoding Foundation & Map Infrastructure

## Current Position

Phase: 10 of 13 (Geocoding Foundation & Map Infrastructure)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-02-16 — v1.2 milestone roadmap created, starting phase 10

Progress: [████████████████████░░░░░░░░] 69% (18/26 total plans across all phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 18
- Average duration: ~45 min per plan (estimated from v1.0 + v1.1)
- Total execution time: ~13.5 hours

**By Milestone:**

| Milestone | Plans | LOC | Duration |
|-----------|-------|-----|----------|
| v1.0 | 9 | 3,844 | 1 day |
| v1.1 | 10 | +2,858 | 3 days |

**Recent Trend:**
- Last 5 plans: Phase 9 (CI/CD Integration) completed
- Trend: Stable (consistent ~45 min per plan)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **Phase 5**: Offline geocoding (offline-geocode-city) — Zero API calls, but returns suburbs instead of cities
- **Phase 9**: Non-blocking geocoding in CI — Geo failures don't halt stats pipeline
- **v1.2 Planning**: Replace geocoding library with GeoNames-based solution to fix city accuracy

### Key Finding: Geocoding Library Issue

The `offline-geocode-city` library uses UN/LOCODE (trade/transport locations) data, which systematically returns nearby suburbs instead of actual major cities. Examples: Paris → Gif-sur-Yvette, Manhattan → Secaucus, Berlin → Stahnsdorf, London → Totteridge. Must be replaced with GeoNames-based solution.

Route polyline data (`map.summary_polyline`) is already stored in activity JSON files — no Strava re-fetch needed for maps.

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 10 (Current):**
- Geocoding library migration requires cache invalidation and versioned schema
- Leaflet CSS must be injected into Shadow DOM (not globally)
- IIFE bundle size will grow from 180KB to 500KB+ unless Leaflet externalized to CDN
- Mobile touch events on iOS/Android may require manual event delegation

**Phase 11-13:**
- Polyline decoding for 1,808 routes must not block UI (chunking/Web Workers may be needed)
- Heatmap memory usage must stay under 200MB (viewport culling required)

## Session Continuity

Last session: 2026-02-16
Stopped at: v1.2 roadmap creation complete, ready to plan Phase 10
Resume file: None

---
*Last updated: 2026-02-16 after v1.2 roadmap created*
