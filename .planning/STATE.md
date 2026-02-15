# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.
**Current focus:** Phase 7 - Widget Attribute System (v1.1 milestone)

## Current Position

Phase: 7 of 9 (Widget Attribute System)
Plan: 2 of 3
Status: Active - Phase 7 in progress
Last activity: 2026-02-15 — Phase 7 Plan 2 complete: Chart widget migration (stats-card, comparison-chart)

Progress: [███████░░░] 73% (6.5/9 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 13 (9 v1.0 + 4 v1.1)
- Average duration: 2.2 minutes (recent average)
- Total execution time: 1 day + 8.6 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v1.0 Phases 1-4 | 9 | 1 day | ~2.7 hours/plan |
| Phase 5 | 1 | 3 min | 3 min/plan |
| Phase 6 | 2 | 3.2 min | 1.6 min/plan |
| Phase 7 | 1 | 2.6 min | 2.6 min/plan |

**Recent Completions:**
- Phase 7 Plan 2 (2026-02-15): 5.1 minutes - Chart widget migration (stats-card, comparison-chart)
  - 2 tasks, 2 commits, 4 files modified
  - Custom Element registration, Chart.js theme integration, responsive chart sizing
- Phase 7 Plan 1 (2026-02-15): 2.6 minutes - Widget attribute infrastructure
  - 2 tasks, 2 commits, 4 files modified (3 created, 1 refactored)
  - Attribute parser (6 functions), ThemeManager, ResponsiveManager, WidgetBase as Custom Element
- Phase 6 Plan 2 (2026-02-15): 1.8 minutes - Geographic statistics widget with CSV export
  - 3 tasks, 2 commits, 4 files modified (2 created, 2 modified)
  - Embeddable widget with country/city rankings, CSV export, coverage metadata
- Phase 6 Plan 1 (2026-02-15): 1.4 minutes - Distance aggregation in geographic stats
  - 1 task, 1 commit, 4 files modified
  - Added totalDistanceKm to countries/cities, ranked by distance (20,138.7 km total)

**Recent Trend:**
- v1.0: 9 plans in 1 day (3,844 LOC TypeScript)
- v1.1: Excellent velocity - Phase 5 (3 min), Phase 6 (3.2 min, 2 plans), Phase 7 ongoing (7.7 min, 2 of 3 plans)

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
- **Native Web Components for widget attributes (Phase 7 Plan 1)**: Use native Custom Elements API instead of attribute parsing library for zero dependencies and full control over attribute lifecycle
- **Strict attribute parsing (Phase 7 Plan 1)**: Implement explicit type guards (isNaN checks, JSON.parse try/catch, hasAttribute for booleans) to prevent runtime errors from string coercion
- **ResizeObserver with requestAnimationFrame (Phase 7 Plan 1)**: Wrap ResizeObserver callbacks in requestAnimationFrame to prevent "ResizeObserver loop" errors per research pitfall #4
- **Protected fetchDataAndRender (Phase 7 Plan 2)**: Changed WidgetBase.fetchDataAndRender from private to protected to allow subclasses to override for multi-source data fetching pattern
- **Chart.js theme propagation (Phase 7 Plan 2)**: Pass theme parameter to chart creation functions to set grid colors, tick colors, title colors, and legend colors based on host element's data-theme attribute

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 5 readiness:** ✓ RESOLVED (Plan 1 complete)
- ~~GPS coordinate availability~~ - Validated: 92% coverage (1,658/1,808 activities), graceful handling of missing GPS data implemented
- ~~offline-geocode-city TypeScript types~~ - Verified: API works as expected, returns cityName/countryName/countryIso2 consistently

**Phase 7 readiness:** ✓ RESOLVED (Plan 1 complete)
- ~~HTML attribute type safety~~ - Implemented strict attribute parsers with NaN checks, boolean hasAttribute() detection, JSON.parse try/catch, color validation via browser CSS parser

**Phase 8 readiness:**
- Shadow DOM table performance: Research shows 50+ rows can cause rendering issues. Plan pagination with hard limits (default 20 rows max), use Constructible Stylesheets for shared CSS.

## Session Continuity

Last session: 2026-02-15 (Phase 7 execution)
Stopped at: Phase 7 Plan 2 complete. Ready for Plan 3 (migrate streak-widget and geo-stats-widget).
Resume file: None — continue with `/gsd:execute-phase 7` for Plan 3

---
*Last updated: 2026-02-15 after Phase 7 Plan 2 execution complete (chart widget migration)*
