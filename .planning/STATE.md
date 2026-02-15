# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.
**Current focus:** Phase 6 - Geographic Statistics (v1.1 milestone)

## Current Position

Phase: 6 of 9 (Geographic Statistics)
Plan: 2 of 2
Status: Complete - Phase 6 complete
Last activity: 2026-02-15 — Phase 6 Plan 2 complete: Geographic statistics widget with CSV export

Progress: [██████░░░░] 67% (6/9 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 12 (9 v1.0 + 3 v1.1)
- Average duration: 2 minutes (recent average)
- Total execution time: 1 day + 6 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v1.0 Phases 1-4 | 9 | 1 day | ~2.7 hours/plan |
| Phase 5 | 1 | 3 min | 3 min/plan |
| Phase 6 | 2 | 3.2 min | 1.6 min/plan |

**Recent Completions:**
- Phase 6 Plan 2 (2026-02-15): 1.8 minutes - Geographic statistics widget with CSV export
  - 3 tasks, 2 commits, 4 files modified (2 created, 2 modified)
  - Embeddable widget with country/city rankings, CSV export, coverage metadata
- Phase 6 Plan 1 (2026-02-15): 1.4 minutes - Distance aggregation in geographic stats
  - 1 task, 1 commit, 4 files modified
  - Added totalDistanceKm to countries/cities, ranked by distance (20,138.7 km total)
- Phase 5 Plan 1 (2026-02-15): 3 minutes - Offline geocoding pipeline (geocoder, cache, compute-geo-stats)
  - 2 tasks, 2 commits, 7 files created, 2 files modified
  - Geocoded 1,658 activities (92% coverage), 23 countries, 57 cities

**Recent Trend:**
- v1.0: 9 plans in 1 day (3,844 LOC TypeScript)
- v1.1: Excellent velocity - Phase 5 (3 min), Phase 6 (3.2 min total, 2 plans)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **Offline geocoding approach**: Use offline-geocode-city library (217 KB, browser/Node.js support, zero API calls) instead of Nominatim/Google Maps APIs to avoid rate limits, costs, and API key exposure
- **Shadow DOM isolation**: Continue pattern from v1.0 for all new widgets to prevent host page style conflicts
- **Git-tracked location cache**: Persist coordinate → location mappings in data/geo/location-cache.json for >90% cache hit rate across builds
- **GPS data validation**: Filter activities lacking coordinates before geocoding, display coverage metadata ("Based on X of Y activities")
- **Coordinate rounding (Phase 5 Plan 1)**: Use 4 decimal places (≈11m precision) for cache keys to balance accuracy with cache efficiency (114 unique locations from 1,658 activities)
- **Geo stats in compute-all-stats (Phase 5 Plan 1)**: Include geographic computation in main pipeline to ensure geo data stays fresh
- **Distance aggregation in meters (Phase 6 Plan 1)**: Accumulate in meters during processing, convert to km with 1 decimal precision for output to prevent precision loss from repeated conversions
- **Ranking by distance (Phase 6 Plan 1)**: Geographic entities ranked by totalDistanceKm descending instead of activityCount for more meaningful statistics
- **CSV download via document.body (Phase 6 Plan 2)**: Export functions append temporary `<a>` elements to document.body instead of shadowRoot for cross-browser download compatibility
- **UTF-8 BOM for Excel CSV (Phase 6 Plan 2)**: Prepend \uFEFF to CSV content ensuring special characters display correctly in Excel
- **Multi-source widget data fetching (Phase 6 Plan 2)**: Widgets can fetch multiple JSON files in parallel via Promise.all, storing secondary data on instance

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 5 readiness:** ✓ RESOLVED (Plan 1 complete)
- ~~GPS coordinate availability~~ - Validated: 92% coverage (1,658/1,808 activities), graceful handling of missing GPS data implemented
- ~~offline-geocode-city TypeScript types~~ - Verified: API works as expected, returns cityName/countryName/countryIso2 consistently

**Phase 7 readiness:**
- HTML attribute type safety: Attributes are strings; need strict parsing with NaN checks, boolean presence detection, JSON.parse try/catch to prevent runtime errors.

**Phase 8 readiness:**
- Shadow DOM table performance: Research shows 50+ rows can cause rendering issues. Plan pagination with hard limits (default 20 rows max), use Constructible Stylesheets for shared CSS.

## Session Continuity

Last session: 2026-02-15 (Phase 6 execution)
Stopped at: Phase 6 complete. Ready to begin Phase 7 (Widget Customization).
Resume file: None — continue with `/gsd:execute-phase 7`

---
*Last updated: 2026-02-15 after Phase 6 Plan 2 execution complete (Phase 6 complete)*
