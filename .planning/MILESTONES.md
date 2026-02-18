# Milestones

## v1.0 MVP (Shipped: 2026-02-14)

**Phases completed:** 4 phases, 9 plans | 3,844 LOC TypeScript | 1 day

**Key accomplishments:**
- Strava OAuth authentication + incremental activity sync with rate limiting (1,808 activities)
- Statistics computation engine: weekly/monthly/yearly aggregations, pace, elevation
- Embeddable widget system: Shadow DOM isolation, Vite IIFE bundles, Chart.js visualizations
- Advanced analytics: streaks, year-over-year comparisons, time-of-day patterns, seasonal trends
- Widget library: stats card, comparison chart, streak/patterns widget — all configurable
- GitHub Actions CI/CD pipeline: daily cron refresh + GitHub Pages deployment

---


## v1.1 Geographic & Widget Customization (Shipped: 2026-02-16)

**Phases completed:** 5 phases (5-9), 10 plans | 6,702 LOC TypeScript (project total) | 3 days
**Git range:** feat(05-01) → docs(v1.1) (43 commits, +13,948 / -301 lines)

**Key accomplishments:**
- Offline reverse geocoding pipeline: 23 countries, 57 cities from 1,658/1,808 activities (92% GPS coverage)
- Geographic statistics with distance aggregation (20,138 km), ranked country/city exports, CSV export
- All 5 widgets migrated to Custom Elements with HTML attribute configuration, dark/light theming, responsive sizing
- Sortable, paginated geographic table widget with locale-aware sorting and ARIA accessibility
- Non-blocking geocoding in CI/CD pipeline with comprehensive README and widget landing page

---


## v1.2 Maps & Geo Fix (Shipped: 2026-02-18)

**Phases completed:** 4 phases (10-13), 11 plans | 9,148 LOC TypeScript (project total) | 2 days
**Git range:** feat(10-01) → fix: recover polylines (49 commits, +118,693 / -1,074 lines)

**Key accomplishments:**
- GeoNames geocoding migration: accurate city names via 166K-city dataset, fixing suburb-instead-of-city problem across 23 countries
- Multi-city route tracking: polyline decoding detects all cities a run passes through (86% of 1,808 activities are multi-city)
- Interactive route map widgets: single-run map, multi-run overlay, and route browser with list selection and auto-fit
- Heatmap widget: all 1,808 runs overlaid with date filtering, color scheme options, and pre-decoded points for zero UI blocking
- Pin map widget: city/country toggle with quintile-based color encoding, cluster markers, and activity popups
- Standalone full-page map views: heatmap, pin map, and route browser with Leaflet Shadow DOM CSS injection and navigation

---

