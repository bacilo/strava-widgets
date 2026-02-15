# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.
**Current focus:** Phase 8 - Geographic Table Widget (v1.1 milestone)

## Current Position

Phase: 8 of 9 (Geographic Table Widget)
Plan: 2 of 2
Status: Complete - Phase 8 finished (all plans complete)
Last activity: 2026-02-15 — Phase 8 Plan 2 complete: Build integration and test page for geo-table-widget

Progress: [█████████░] 89% (8/9 phases complete, ready for Phase 9)

## Performance Metrics

**Velocity:**
- Total plans completed: 17 (9 v1.0 + 8 v1.1)
- Average duration: 3.4 minutes (recent average)
- Total execution time: 1 day + 25.7 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v1.0 Phases 1-4 | 9 | 1 day | ~2.7 hours/plan |
| Phase 5 | 1 | 3 min | 3 min/plan |
| Phase 6 | 2 | 3.2 min | 1.6 min/plan |
| Phase 7 | 3 | 14 min | 4.7 min/plan |
| Phase 8 | 2 | 5.5 min | 2.8 min/plan |

**Recent Completions:**
- Phase 8 Plan 2 (2026-02-15): 2.5 minutes - Build integration and test page for geo-table-widget
  - 2 tasks, 2 commits, 1 file created (249 lines), 2 files modified
  - Integrated into build pipeline (21KB IIFE bundle), comprehensive test page with 4 demo variants
- Phase 8 Plan 1 (2026-02-15): 3.0 minutes - Sortable, paginated geographic table widget
  - 2 tasks, 2 commits, 3 files created (877 lines)
  - TableSorter with Intl.Collator, TablePaginator with boundary checking, accessible table with aria-sort
- Phase 7 Plan 3 (2026-02-15): 6.3 minutes - Final widget migration and HTML-only test page
  - 2 tasks, 2 commits, 4 files modified (1 created, 3 modified)
  - Streak-widget and geo-stats-widget as Custom Elements, comprehensive test page (352 lines)
- Phase 7 Plan 2 (2026-02-15): 5.1 minutes - Chart widget migration (stats-card, comparison-chart)
  - 2 tasks, 2 commits, 4 files modified
  - Custom Element registration, Chart.js theme integration, responsive chart sizing
- Phase 7 Plan 1 (2026-02-15): 2.6 minutes - Widget attribute infrastructure
  - 2 tasks, 2 commits, 4 files modified (3 created, 1 refactored)
  - Attribute parser (6 functions), ThemeManager, ResponsiveManager, WidgetBase as Custom Element
- Phase 6 Plan 2 (2026-02-15): 1.8 minutes - Geographic statistics widget with CSV export
  - 3 tasks, 2 commits, 4 files modified (2 created, 2 modified)
  - Embeddable widget with country/city rankings, CSV export, coverage metadata

**Recent Trend:**
- v1.0: 9 plans in 1 day (3,844 LOC TypeScript)
- v1.1: Excellent velocity - Phase 5 (3 min), Phase 6 (3.2 min, 2 plans), Phase 7 (14 min, 3 plans), Phase 8 (5.5 min, 2 plans) ✅ COMPLETE

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
- **Custom fetch method naming (Phase 7 Plan 3)**: Rename widget-specific fetch methods to fetchAllDataAndRender() instead of fetchDataAndRender() to avoid conflict with base class protected method
- **Inline style application (Phase 7 Plan 3)**: Apply CSS custom properties directly in connectedCallback() instead of separate private method to avoid duplicate method declarations with base class
- **Dark mode chart theming (Phase 7 Plan 3)**: Pass theme parameter to Chart.js config functions for theme-aware grid lines, point labels, and tick colors (rgba values adapt to light/dark mode)
- **Responsive table hiding (Phase 7 Plan 3)**: Use CSS :host([data-size="compact"]) selectors to hide less-important columns (cities count) in compact mode instead of JavaScript DOM manipulation
- **Reusable Intl.Collator instance (Phase 8 Plan 1)**: Create collator once and reuse for all sorts (2x faster than String.localeCompare per call)
- **Pagination default 20 rows with 1-50 clamp (Phase 8 Plan 1)**: Research shows Shadow DOM table performance degrades with 50+ rows, 20 is optimal
- **Sort copy instead of mutating original (Phase 8 Plan 1)**: Preserves original data order, prevents bugs when resetting sort
- **Constructible Stylesheets for table CSS (Phase 8 Plan 1)**: Shared CSS across multiple widget instances reduces memory usage
- **Track test.html in git (Phase 8 Plan 2)**: Added !dist/widgets/test.html to .gitignore exceptions for GitHub Pages deployment alongside index.html

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 5 readiness:** ✓ RESOLVED (Plan 1 complete)
- ~~GPS coordinate availability~~ - Validated: 92% coverage (1,658/1,808 activities), graceful handling of missing GPS data implemented
- ~~offline-geocode-city TypeScript types~~ - Verified: API works as expected, returns cityName/countryName/countryIso2 consistently

**Phase 7 readiness:** ✓ RESOLVED (Plan 1 complete)
- ~~HTML attribute type safety~~ - Implemented strict attribute parsers with NaN checks, boolean hasAttribute() detection, JSON.parse try/catch, color validation via browser CSS parser

**Phase 8 readiness:** ✓ RESOLVED (Plan 1 complete)
- ~~Shadow DOM table performance~~ - Implemented pagination with 20 row default (clamped 1-50), Constructible Stylesheets for shared CSS across instances

## Session Continuity

Last session: 2026-02-15 (Phase 8 Plan 2 execution)
Stopped at: Phase 8 complete! Geographic table widget with build integration and test page. Ready for Phase 9 (Widget Performance & UX enhancements).
Resume file: None — continue with `/gsd:execute-phase 9` for next phase

---
*Last updated: 2026-02-15 after Phase 8 Plan 2 execution complete (build integration and test page)*
