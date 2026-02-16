# Project Research Summary

**Project:** Strava Widgets — Interactive Mapping Features Milestone (v1.2)
**Domain:** Running/Fitness Analytics with Interactive Web Maps
**Researched:** 2026-02-16
**Confidence:** HIGH

## Executive Summary

This milestone adds interactive mapping capabilities (route visualization, heatmaps, country/city pin maps) and improved geocoding (GeoNames data for accurate city detection) to the existing Custom Elements widget platform. The recommended approach uses Leaflet (40KB, zero dependencies) over MapLibre GL (800KB, WebGL complexity) for DOM-based rendering that fits the IIFE bundle architecture. Build-time polyline decoding and geocoding keep widgets lightweight while offline-first geocoding eliminates API dependencies and costs.

The critical architectural insight: **geocoding improvements must come first**. Current offline-geocode-city library returns suburbs instead of cities ("Frederiksberg" vs "Copenhagen"), breaking geographic aggregations. Switching to GeoNames cities1000 dataset requires cache invalidation and schema versioning. All map widgets depend on this accurate geocoding foundation, so the build order is: geocoding evolution → polyline/data pipeline → map widgets.

Key risks center on Shadow DOM compatibility and bundle size. Leaflet's CSS must be injected into each shadow root (not globally), and mobile touch events require manual delegation on iOS/Android. IIFE bundles will bloat from 180KB to 500KB+ unless Leaflet is externalized to CDN. Multi-city run tracking (polyline segmentation) is deferred to v1.3+ due to high complexity and low frequency (affects <100 of 1,808 runs).

## Key Findings

### Recommended Stack

The stack builds incrementally on existing TypeScript + Custom Elements + Vite IIFE architecture. No changes to core build tooling (Vite 7.3.1, Node.js 22, GitHub Actions CI/CD).

**Core technologies:**
- **Leaflet 1.9.4** (mapping) — 40KB gzipped vs MapLibre GL's 800KB, DOM-based rendering sufficient for polyline routes and heatmaps, proven Shadow DOM compatibility patterns, zero npm dependencies
- **leaflet.heat 0.2.0** (heatmap plugin) — 2KB official plugin, handles 10,000+ points efficiently with grid-based clustering, perfect for visualizing 1,808 run start coordinates
- **offline-geocoder 1.0.2** (geocoding replacement) — GeoNames cities1000 dataset (12MB SQLite, build-time only), replaces offline-geocode-city which returns suburbs instead of cities, city-level accuracy for 20,000+ cities worldwide
- **@mapbox/polyline 1.2.1** (polyline decoding) — 270K+ weekly downloads vs 27K for Google's library, actively maintained, outputs [[lat, lng]] format compatible with Leaflet, build-time processing only
- **vite-plugin-css-injected-by-js 3.5.1** (build tooling) — Required for IIFE format, injects Leaflet CSS into bundles, fixes Vite marker icon path hashing issues

**Critical version requirements:**
- Leaflet 2.0.0 alpha exists but wait for stable release (current 1.9.4 is production-ready)
- offline-geocoder requires Node.js only (12MB SQLite cannot run in browser)

### Expected Features

Research identified clear table stakes vs differentiators vs anti-features based on Strava, MapMyRun, Pin Traveler, and CityStrides competitor analysis.

**Must have (table stakes):**
- Interactive route map with zoom/pan — Core feature in all fitness apps since 2005
- Fit route to viewport on load — Prevents users hunting for their route
- Heatmap of all runs — Strava Personal Heatmap standard, expected in 2026
- Date range filter for heatmap — Strava offers custom range and yearly views
- Country/city pin map with stats — Pin Traveler core feature, travel visualization
- Click pin/route for details — Modern UX expectation (click = see more)
- Improved city geocoding — Current library returns suburbs, breaks aggregations

**Should have (competitive):**
- Heatmap color customization — Strava offers 6 colors for subscribers, differentiation opportunity
- Activity type filter — Strava Global Heatmap has Run/Ride/Water/Winter/Other
- Visual pin distinction by count — Data-driven marker sizing/coloring

**Defer to v1.3+ (high complexity, unclear value):**
- Multi-city run tracking — Polyline segmentation + city boundary detection, affects <100 runs of 1,808
- Latest N runs gallery map — Nice-to-have, medium complexity
- Pace/speed color coding on routes — High complexity, requires pace metadata parsing
- Standalone map pages — Can add after widgets validated, medium complexity
- Route browser with preview — High complexity, requires pagination/lazy-loading

**Anti-features (commonly requested, problematic):**
- Real-time GPS tracking — Privacy nightmare, Strava webhooks unreliable, scope creep
- Every-street completion (Wandrer clone) — Requires OSM street geometry, 100x scope increase
- 3D terrain visualization — WebGL complexity, doesn't add analytical value
- Social features (compare with friends) — Requires multi-user system, 10x scope increase

### Architecture Approach

Evolution from single-city-per-activity to multi-city-aware geocoding, with build-time data processing keeping widget bundles lightweight.

**Current architecture:**
- Activity JSON → geocode start_latlng (single point) → aggregate by city → cities.json/countries.json
- Custom Element widgets fetch pre-aggregated JSON, render in Shadow DOM
- Vite IIFE bundles with Chart.js (~50-80KB per widget)

**Target architecture:**
- Activity JSON → decode summary_polyline → geocode route points → detect cities visited → activity-locations.json (NEW)
- Enhanced aggregation with multi-city support (versioned schema)
- New map widgets with Leaflet externalized to CDN (~100KB per widget vs 500KB if bundled)

**Major components:**
1. **polyline-decoder.ts** (NEW) — Decode Google polylines to [[lat, lng]] arrays using @mapbox/polyline, build-time processing stores in data/routes/{id}.json
2. **geocoder.ts** (MODIFIED) — Replace offline-geocode-city with offline-geocoder, GeoNames cities1000 dataset, version cache to handle migration
3. **compute-geo-stats.ts** (MODIFIED) — Multi-city aggregation, generate activity-locations.json with cities[] per activity
4. **route-map-widget/** (NEW) — Single route visualization with Leaflet, Shadow DOM CSS injection, auto-fit bounds
5. **heatmap-widget/** (NEW) — All routes overlay with leaflet.heat, date range filtering, viewport culling for performance
6. **country-map-widget/** (NEW) — Marker-based pin map, popup stats per location, marker clustering if needed

**Critical build order:** Geocoding foundation MUST complete before map widget work (all widgets depend on accurate city data).

### Critical Pitfalls

Top 5 pitfalls with highest impact and prevention strategies.

1. **Leaflet CSS not loading in Shadow DOM** — Map tiles render outside container, controls broken. Shadow DOM isolates styles so external stylesheets don't penetrate. Import Leaflet CSS as string, inject into shadow root before map initialization. Phase 1 blocker.

2. **Leaflet event handling broken on mobile** — Touch events fail on iOS Safari/Android Chrome. Shadow DOM event retargeting breaks Leaflet's assumptions. Test on real devices in Phase 1, implement manual event delegation using event.composedPath(), or use leaflet-map web component wrapper. 50%+ mobile traffic makes this critical.

3. **IIFE bundle size explosion** — Widget bundles jump from 180KB to 500KB+ with Leaflet. IIFE format bundles all dependencies per widget. Externalize Leaflet to CDN (rollupOptions: {external: ['leaflet']}), document CDN requirement for consumers. Phase 1 configuration decision.

4. **Polyline decoding performance collapse** — Decoding 1,808 polylines blocks UI for 5-10 seconds, browsers show "Page Unresponsive". Synchronous decoding on main thread locks up UI. Decode on-demand, use Web Workers for batches, implement chunking with requestIdleCallback(), cache in IndexedDB. Phase 2 optimization.

5. **Geocoding migration breaks location cache** — Switching to GeoNames invalidates 114 cached locations, cities change names. Different libraries use different datasets/naming conventions. Version cache (add version field), full rebuild (don't merge old data), parallel validation before migration, archive old files as data/geo/v1/. Phase 0/1 migration plan.

**Additional Phase 1 risks:**
- Tile provider rate limiting — Use approved CDN (Thunderforest/Mapbox/Stamen), never openstreetmap.org directly, always include attribution
- Multi-city schema breaking widgets — Create versioned data files (cities-v2.json), keep old format for backward compatibility

## Implications for Roadmap

Based on dependency analysis, suggested 4-phase structure with geocoding as blocking foundation.

### Phase 1: Geocoding Foundation & Map Infrastructure
**Rationale:** All map widgets depend on accurate city data. Geocoding must be fixed first before building features on broken foundation. Map infrastructure (Leaflet + Shadow DOM + IIFE config) establishes patterns for all subsequent widgets.

**Delivers:**
- Accurate city-level geocoding (GeoNames cities1000 replacing offline-geocode-city)
- Versioned location cache with migration plan
- Leaflet integrated with Shadow DOM (CSS injection pattern)
- IIFE bundle configuration with externalized Leaflet
- Tile provider configured with attribution
- Mobile touch event handling validated

**Addresses features:**
- Improved city geocoding (table stakes)
- Infrastructure for all mapping features

**Avoids pitfalls:**
- Geocoding cache invalidation (version from day 1)
- Shadow DOM CSS issues (solve before widget builds)
- Bundle size explosion (externalize Leaflet upfront)
- Tile rate limiting (approved CDN from start)
- Mobile event failures (test real devices in Phase 1)

**Research needed:** None — well-documented patterns. Validate GeoNames data quality vs offline-geocode-city output for sample of 100 runs.

### Phase 2: Route Map Widget
**Rationale:** Simplest map widget validates approach before complexity. Demonstrates Leaflet integration works, provides immediate user value, proves widget embedding model.

**Delivers:**
- Polyline decoding pipeline (build-time with @mapbox/polyline)
- Single route map Custom Element widget
- Zoom/pan controls with auto-fit to route bounds
- Route info popup (distance, date, pace)
- Performance pattern for polyline decoding (chunked/async if needed)

**Uses stack:**
- Leaflet 1.9.4 (base map)
- @mapbox/polyline (decode summary_polyline)
- OpenStreetMap tiles via approved CDN

**Implements architecture:**
- polyline-decoder.ts (NEW)
- route-map-widget/ (NEW)
- Build pipeline: decode routes → data/routes/{id}.json → widget fetches pre-decoded

**Avoids pitfalls:**
- Polyline decoding performance (optimize during pipeline implementation)
- Runtime bundle bloat (decode at build time, not in widget)

**Research needed:** None — standard Leaflet patterns. Benchmark decoding performance with 1,808 routes.

### Phase 3: Heatmap Widget
**Rationale:** Builds on route map foundation (Leaflet + polyline decoding). High user value (Strava's most popular feature). Validates filtering UX and performance at scale.

**Delivers:**
- Heatmap widget with leaflet.heat (all 1,808 routes)
- Date range filter UI (custom range + yearly presets)
- Activity type filter (runs only, prepare for multi-sport)
- Heatmap color customization (4-5 color schemes)
- Viewport culling for performance (render only visible routes)

**Uses stack:**
- Leaflet 1.9.4 + leaflet.heat 0.2.0
- Pre-decoded polylines from Phase 2

**Implements architecture:**
- heatmap-widget/ (NEW)
- Filter components (date range, activity type)
- Performance optimizations (viewport bounds filtering, progressive rendering)

**Avoids pitfalls:**
- Heatmap memory overflow (default to 100 routes, opt-in for full dataset)
- UI freeze from decoding all routes (use Phase 2 chunking pattern)

**Research needed:** None if Phase 2 performance targets met. May need deeper optimization research if viewport culling insufficient.

### Phase 4: Country/City Pin Map
**Rationale:** Complements existing geographic table widget with visual representation. Depends on Phase 1 accurate geocoding. Lower complexity than heatmap (57 cities vs 1,808 routes).

**Delivers:**
- Country/city pin map widget with markers
- Click pin popup with stats (runs, distance, dates)
- Visual distinction by activity count (marker size/color)
- Country and city count display
- Auto-zoom to show all pins

**Uses stack:**
- Leaflet 1.9.4 (markers)
- GeoNames geocoded data from Phase 1

**Implements architecture:**
- country-map-widget/ (NEW)
- Marker clustering if >200 pins

**Avoids pitfalls:**
- Marker clustering performance (test with 57 cities, add clustering if needed)

**Research needed:** None — standard Leaflet marker patterns.

### Phase Ordering Rationale

- **Geocoding first (Phase 1)** — All features depend on accurate city data. Migration risk (cache invalidation) must be handled before building on top. Infrastructure decisions (Shadow DOM + Leaflet + IIFE) establish patterns for all widgets.

- **Route map before heatmap (Phases 2→3)** — Single route simpler than multi-route aggregation. Validates polyline decoding pipeline at small scale before applying to 1,808 routes. Establishes performance patterns (chunking, Web Workers) for Phase 3.

- **Pin map last (Phase 4)** — Lowest complexity (markers vs polylines), complements existing geo-table-widget. Can proceed in parallel with Phase 3 if needed since both depend only on Phase 1.

- **Multi-city tracking deferred (v1.3+)** — High complexity (polyline segmentation, city boundary detection), low frequency (affects <100 runs), acceptable workaround (attribute to start city). Should not delay high-value features.

**Dependency graph:**
```
Phase 1: Geocoding + Infrastructure (BLOCKS all)
    ↓
    ├── Phase 2: Route Map (ENABLES Phase 3)
    │       ↓
    │   Phase 3: Heatmap
    │
    └── Phase 4: Pin Map (can run parallel to 2/3)
```

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Leaflet + Shadow DOM extensively documented (GitHub issues #3246, #6705), GeoNames geocoding well-understood
- **Phase 2:** Polyline decoding standard pattern, Leaflet markers/popups well-documented
- **Phase 3:** Heatmap plugin official, viewport culling established pattern
- **Phase 4:** Marker maps most basic Leaflet use case

**Phases needing potential deeper research:**
- **Phase 2 (if performance issues):** Web Worker polyline decoding if synchronous approach exceeds 2-second budget for 1,808 routes
- **Phase 3 (if memory issues):** Advanced viewport culling or simplification algorithms if heatmap exceeds 200MB memory

**Validation during planning:**
- Phase 1: Compare GeoNames vs offline-geocode-city output for 100 sample runs
- Phase 2: Benchmark polyline decoding with full 1,808 dataset before widget build
- Phase 3: Memory profiling with all routes rendered to validate culling strategy

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Leaflet official docs + npm package info verified, @mapbox/polyline 270K+ weekly downloads confirms popularity, offline-geocoder GitHub repo active |
| Features | HIGH | Strava/MapMyRun feature comparison from official sources, Pin Traveler app analyzed, table stakes vs differentiators clear from competitor analysis |
| Architecture | HIGH | Existing widget architecture validated (5 widgets deployed), Shadow DOM patterns from Leaflet GitHub issues (#3246, #6705), build-time processing proven pattern |
| Pitfalls | HIGH | Based on official Leaflet GitHub issues, Vite documentation, established Shadow DOM limitations, real production failures documented in issues |

**Overall confidence:** HIGH

Sources are authoritative (official documentation, verified npm packages, GitHub issues with reproducible examples). The existing widget platform reduces architectural uncertainty (proven patterns for Custom Elements + Shadow DOM + Vite IIFE). Major risk areas (Shadow DOM compatibility, bundle size, performance) have documented solutions.

### Gaps to Address

**Minor gaps requiring validation during implementation:**

- **GeoNames data quality** — Research shows offline-geocoder uses cities1000 dataset, but exact accuracy improvement over offline-geocode-city needs validation. Mitigation: Phase 1 validation step compares geocoding output for 100 sample runs before full migration.

- **Polyline decoding performance at scale** — Research provides estimates (synchronous decode of 1,808 routes may exceed 2 seconds), but exact performance needs measurement. Mitigation: Phase 2 benchmark with full dataset before building widget, implement Web Worker if needed.

- **Shadow DOM mobile event handling** — Leaflet issues #3752 (Android) and #6705 (iOS) document problems, but exact workaround effectiveness varies by Leaflet version. Mitigation: Phase 1 testing on real iOS Safari and Android Chrome devices, manual event delegation fallback ready.

- **Multi-city run frequency** — Estimated <100 of 1,808 runs cross city boundaries, but unknown without polyline analysis. Mitigation: Defer to v1.3+, acceptable to attribute full run to start city for now.

**No critical unknowns.** All gaps have clear mitigation strategies and don't block roadmap.

## Sources

### Primary (HIGH confidence)
- [Leaflet Shadow DOM Issue #3246](https://github.com/Leaflet/Leaflet/issues/3246) — CSS injection solution
- [Leaflet GitHub Issues #3752, #6705](https://github.com/Leaflet/Leaflet/issues/) — Mobile event handling
- [Leaflet npm](https://www.npmjs.com/package/leaflet) — Version 1.9.4, bundle size
- [Leaflet.heat GitHub](https://github.com/Leaflet/Leaflet.heat) — Official plugin
- [@mapbox/polyline npm](https://www.npmjs.com/package/@mapbox/polyline) — 270K+ weekly downloads
- [offline-geocoder GitHub](https://github.com/lucaspiller/offline-geocoder) — GeoNames cities1000
- [Vite Build Options](https://vite.dev/config/build-options) — IIFE external configuration
- [Strava Personal Heatmaps Support](https://support.strava.com/hc/en-us/articles/216918467-Personal-Heatmaps) — Feature comparison

### Secondary (MEDIUM confidence)
- [MapLibre vs Leaflet comparison (Jawg Blog)](https://blog.jawg.io/maplibre-gl-vs-leaflet-choosing-the-right-tool-for-your-interactive-map/) — Bundle size benchmarks
- [Pin Traveler app](https://pintraveler.net/) — Competitor feature analysis
- [CityStrides](https://citystrides.com/) — Multi-city tracking patterns
- [Map UI Design Best Practices](https://www.eleken.co/blog-posts/map-ui-design) — UX patterns
- [GeoNames datasets](https://download.geonames.org/export/dump/) — Data availability

### Tertiary (LOW confidence - needs validation)
- Exact bundle size thresholds (500KB, 200 routes) — estimated from research, validate in Phase 1
- Multi-city run frequency (<100 of 1,808) — estimated, actual unknown without analysis
- Mobile browser event quirks — based on GitHub issues but versions may have changed, validate in Phase 1

---
*Research completed: 2026-02-16*
*Ready for roadmap: yes*
