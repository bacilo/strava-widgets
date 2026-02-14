# Project Research Summary

**Project:** Strava Analytics Platform - Geographic Features Milestone
**Domain:** Running Analytics & Embeddable Widgets
**Researched:** 2026-02-14
**Confidence:** HIGH

## Executive Summary

This milestone extends an existing Strava analytics platform (TypeScript, Node.js 22, Chart.js, Vite IIFE bundles, Shadow DOM) with geographic capabilities. Research shows the optimal approach is to use **offline-geocode-city** for browser-based reverse geocoding (217 KB, zero API calls), native HTML tables for geographic statistics display, and Web Components API for attribute-based widget customization. The existing stack is validated and requires only one new dependency.

The key architectural insight is separating concerns: geocoding happens at widget runtime using an offline library (not in CI), geographic statistics are computed like existing time-based stats, and the new table widget follows the established Shadow DOM pattern. This approach avoids the two critical pitfalls: API cost explosions from repeated geocoding calls and GPS data quality issues affecting 20-30% of activities.

Primary risk is GPS coordinate availability - research shows treadmill runs, indoor activities, and GPS failures mean approximately 20-30% of activities lack location data. Mitigation requires robust filtering (validate start_latlng exists and isn't [0,0]) and graceful degradation (display "Based on X of Y activities with GPS data"). Secondary risk is Shadow DOM table performance with 100+ rows; solution is hard pagination limits (default 20 rows maximum).

## Key Findings

### Recommended Stack

**Single new dependency needed:** offline-geocode-city (217 KB gzipped) provides browser-based reverse geocoding with zero API calls, perfect for static GitHub Pages deployment. Unlike alternatives requiring Node.js-only processing (local-reverse-geocoder at 2.29 GB) or API keys with rate limits (Nominatim at 1 req/sec, Google Maps at $5/1000 requests), offline-geocode-city works instantly in browser/Node.js/web workers with city-level precision sufficient for "runs by city/country" statistics.

**Core technologies (NO CHANGES to existing stack):**
- **offline-geocode-city**: Offline reverse geocoding (GPS → city/country) — 217 KB, S2 cell-based, zero API calls, perfect for static sites
- **Native HTML tables**: Table widget rendering — zero bundle overhead, full Shadow DOM control, consistent with existing widget approach
- **Native Web Components API**: Attribute-based customization — observedAttributes + attributeChangedCallback provide declarative HTML configuration without dependencies
- **Existing tools retained**: Chart.js (charts), Vite (IIFE bundles), bottleneck + p-retry (rate limiting if needed), TypeScript + Node.js 22 (pipeline)

**Key architectural decision:** Use offline-geocode-city at widget runtime (not CI batch processing). This eliminates rate limiting concerns, API costs, quota management, and enables instant geographic lookups without pre-computing.

### Expected Features

**Must have (table stakes):**
- Countries visited list — standard in running apps like Wandrer/StatHunters, users expect geographic aggregation
- Total distance by country — basic metric alongside activity count
- Cities/locations visited — finer granularity than countries, city-level precision expected
- Activity count by location — count activities per identified location
- Data attribute configuration — HTML-only environments (CMSes) need declarative config without JavaScript
- Style isolation (Shadow DOM) — widget must not break host page CSS (already implemented, maintain pattern)

**Should have (competitive advantage):**
- CSV export of geographic data — low complexity, high user value differentiator
- Dark/light mode support — standard expectation for modern widgets in 2026
- Interactive table sorting — sort by distance, date, activity count (client-side only)
- Responsive widget sizing — auto-adapt to container size using ResizeObserver

**Defer (v2+):**
- Percentage completion badges — requires area boundary data, significant complexity (Wandrer-style gamification)
- Choropleth country map — countries colored by distance, adds mapping library dependency
- Custom location groupings — user-defined regions (e.g., "Nordic countries"), wait for feedback
- Geographic heatmap visualization — high complexity, requires mapping library, defer until demand validated

**Anti-features identified (commonly requested but problematic):**
- Real-time location tracking — privacy nightmare, scope creep beyond static analytics
- Every street completion (Wandrer clone) — massive complexity, OpenStreetMap integration challenges
- Fine-grained street-level geocoding — poor accuracy, rate limiting issues, city-level is sufficient
- Unlimited theme customization — maintenance burden, breaks layouts, use controlled CSS variable presets

### Architecture Approach

The milestone adds four capabilities to existing infrastructure without changing core architecture: (1) geographic data extraction via offline-geocode-city at widget runtime, (2) geographic statistics computation mirroring existing time-based stats pattern, (3) native HTML table widget following Shadow DOM pattern, (4) Web Components attribute-based configuration extending existing widgets.

**Major components:**

1. **Reverse Geocoding Service** (`src/services/reverse-geocoder.ts`) — wraps offline-geocode-city, accepts [lat, lng] from activities, returns {city, country, countryCode, displayName}, handles null gracefully
2. **Location Cache** (`data/geo/location-cache.json`) — persistent storage of coordinate → location mappings (2 decimal precision ~1km), git-tracked for reuse, enables >90% cache hit rate after initial run
3. **Geographic Statistics Computation** (`src/analytics/compute-geo-stats.ts`) — reads activities with start_latlng, groups by country/city, aggregates count/distance/percentage, outputs `data/stats/geo-stats.json`
4. **Geographic Table Widget** (`src/widgets/geo-table/index.ts`) — Shadow DOM table with sortable columns (Location, Distance, Runs, Percentage), responsive layout, IIFE bundle via Vite
5. **Widget Attribute Configuration System** — extends WidgetBase with parseAttributes() method reading HTML data-* attributes (data-url, data-accent-color, data-group-by, data-sort-by), provides type parsing with validation and defaults

**Key patterns:**
- **Offline geocoding at runtime** (Pattern 1): Widget calls offline-geocode-city during initialization, instant lookups, zero API dependencies
- **Persistent JSON cache** (Pattern 2): Git-tracked location-cache.json survives builds, unlimited caching, coordinate rounding reduces duplicates
- **Shadow DOM + attribute config** (Pattern 3): HTML data-* attributes for declarative configuration, Web Components observedAttributes for parsing
- **Git-tracked static generation** (Pattern 4): Compute stats → write JSON → commit → deploy (existing pattern extended for geographic data)

### Critical Pitfalls

1. **GPS Coordinate Quality Issues** — 20-30% of activities lack GPS data (treadmill runs, indoor activities, GPS failures, privacy zones). **Avoid:** Pre-geocoding validation (check start_latlng exists and not [0,0], skip activities with no map.summary_polyline), graceful degradation (track total vs geolocated separately), fallback hierarchy (use timezone → country if GPS missing), data quality metadata (display "Based on X of Y activities with GPS").

2. **HTML Attribute Type Safety Collapse** — HTML attributes are strings, causing NaN errors when code expects numbers/booleans. **Avoid:** Strict parsing pattern (parseInt with NaN check + defaults, boolean via presence check, JSON.parse with try/catch), never setAttribute in attributeChangedCallback (infinite loops), validate enums against whitelist, document all attribute types with defaults.

3. **Shadow DOM Table Rendering Performance Collapse** — 100+ rows cause 5+ second renders and browser lockup. **Avoid:** Pagination with hard limits (default 10-20 rows max), Constructible Stylesheets for shared CSS across instances, DocumentFragment for batch DOM updates, render only changed rows not entire table, separate Chart.js and table into different widgets.

4. **Strava Activity Data Lacking Coordinates** — Indoor/manual activities have null start_latlng. **Avoid:** Activity filtering (`hasValidGPS()` function checking map.summary_polyline and non-zero coordinates), display coverage percentage ("Geographic stats based on 1,250 of 1,808 activities"), fallback location inference via timezone, separate "Indoor (no location)" category.

5. **Static Site API Key Exposure** — Calling geocoding APIs from browser widgets exposes keys. **Avoid:** Use offline-geocode-city (zero API calls), never import API keys in src/ (browser code), verify with `grep -r "API_KEY" src/` returns nothing, alternative if API needed: batch geocoding in GitHub Actions with keys in Secrets.

## Implications for Roadmap

Based on research, suggested 5-phase structure with clear dependency ordering:

### Phase 1: Geocoding Infrastructure
**Rationale:** Foundation for all geographic features - must establish offline geocoding before any statistics or widgets can be built. Research shows offline-geocode-city eliminates API cost/quota risks that plague traditional approaches.

**Delivers:**
- Reverse Geocoder Service wrapping offline-geocode-city
- Location cache (data/geo/location-cache.json) with coordinate rounding
- Geocoding CLI command (`npm run geocode`)
- GPS validation logic (filter activities lacking coordinates)

**Addresses features:** GPS coordinate extraction (table stakes), graceful handling of missing data

**Avoids pitfalls:** GPS coordinate quality issues (validation before geocoding), Strava activity data lacking coordinates (filtering logic), API key exposure (offline library, no API calls)

**Research flag:** SKIP RESEARCH - offline-geocode-city has clear documentation, usage pattern is straightforward (import + call reverseGeocode function)

### Phase 2: Geographic Statistics
**Rationale:** Depends on Phase 1 geocoded data, needed before widgets can display anything. Follows existing pattern from weekly/monthly stats computation.

**Delivers:**
- Geographic stats computation (src/analytics/compute-geo-stats.ts)
- CLI integration (npm run compute-geo-stats, update compute-all-stats)
- Output format (data/stats/geo-stats.json with byCountry/byCity arrays)
- Data quality metadata tracking (total vs geolocated counts)

**Addresses features:** Countries visited list, total distance by country, cities visited, activity count by location (all table stakes)

**Avoids pitfalls:** Strava data lacking coordinates (metadata shows X of Y activities), graceful degradation (separate counts)

**Research flag:** SKIP RESEARCH - mirrors existing stats computation architecture, no new patterns needed

### Phase 3: Widget Attribute System
**Rationale:** Foundation for new widget AND improves existing widgets. Can be developed in parallel with Phase 1-2 (no dependency). Establishes pattern before building geographic table widget.

**Delivers:**
- WidgetBase refactor with parseAttributes() method
- Attribute parsing utilities (parseInt with validation, boolean parsing, JSON.parse with try/catch)
- Existing widget migration (StatsCardWidget, ComparisonChart, StreakWidget)
- Documentation of all attributes with types and defaults

**Addresses features:** Data attribute configuration (table stakes), basic theming via CSS variables

**Avoids pitfalls:** HTML attribute type safety collapse (strict parsing with validation), infinite loops (no setAttribute in attributeChangedCallback)

**Research flag:** SKIP RESEARCH - Web Components API is well-documented, MDN has comprehensive guides on observedAttributes

### Phase 4: Geographic Table Widget
**Rationale:** Depends on Phase 2 (geo-stats.json) and Phase 3 (attribute system). Final deliverable combining all previous work.

**Delivers:**
- Geographic Table Widget (src/widgets/geo-table/index.ts)
- Table rendering with Shadow DOM and native HTML
- Sorting functionality (click headers)
- Build configuration (add to scripts/build-widgets.mjs)
- Widget demo page for testing

**Uses stack:** Native HTML tables (zero overhead), Shadow DOM (existing pattern), Constructible Stylesheets (performance)

**Implements architecture:** Shadow DOM widget with attribute configuration (Pattern 3)

**Addresses features:** Geographic statistics display (table stakes), interactive table sorting (competitive), responsive sizing (competitive)

**Avoids pitfalls:** Shadow DOM performance collapse (pagination limits, Constructible Stylesheets, max 20 rows default)

**Research flag:** SKIP RESEARCH - follows existing widget pattern exactly, no new concepts

### Phase 5: CI/CD Integration
**Rationale:** Integrates all components into automated workflow. Final step after all components validated independently.

**Delivers:**
- GitHub Actions workflow updates (add geocoding + geo-stats steps)
- Error handling (continue-on-error for non-blocking failures)
- Documentation updates (README with new commands, widget attributes guide)
- Geocoding attribution requirements (Nominatim/OSM credit)

**Addresses features:** Automated daily refresh of geographic data

**Avoids pitfalls:** CI builds taking too long (incremental processing), build failures blocking deployment (non-blocking geocoding)

**Research flag:** SKIP RESEARCH - GitHub Actions workflow is established, just adding steps

### Phase Ordering Rationale

- **Sequential dependencies:** 1 → 2 → 4 → 5 (each depends on previous), Phase 3 is independent and can run parallel to 1-2
- **Validation gates:** Each phase can be tested independently before proceeding (1: geocoding works, 2: stats JSON correct, 3: attributes parse, 4: widget renders, 5: full pipeline)
- **Pitfall avoidance built into order:** GPS validation in Phase 1 prevents bad data in Phase 2, attribute system in Phase 3 prevents type bugs in Phase 4
- **Incremental value:** Phase 2 produces usable JSON even if widgets incomplete, Phase 3 improves existing widgets immediately
- **Research efficiency:** All phases use standard/existing patterns, no deep research needed during planning

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** offline-geocode-city has clear documentation, straightforward usage
- **Phase 2:** Mirrors existing stats computation, established pattern
- **Phase 3:** Web Components API well-documented by MDN, standard platform feature
- **Phase 4:** Follows existing widget architecture exactly
- **Phase 5:** GitHub Actions workflow established, incremental addition

**No phases require deep research** - all technologies and patterns are well-documented with official sources.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | offline-geocode-city verified via GitHub/npm (217 KB, browser support), Web Components API is platform standard (MDN), native HTML tables proven approach |
| Features | HIGH | Wandrer/StatHunters/Strava establish clear feature expectations, table stakes vs differentiators well-defined, anti-features backed by community wisdom |
| Architecture | HIGH | Extends existing validated architecture, offline geocoding pattern verified, Shadow DOM + attribute config follows Web Components best practices |
| Pitfalls | HIGH | GPS data quality issues documented by Strava Support, attribute type safety pitfalls well-known in Web Components community, Shadow DOM performance characteristics proven |

**Overall confidence:** HIGH

Research sources include official documentation (MDN, Nominatim usage policy, Strava Support), verified npm packages (offline-geocode-city GitHub/npm), and multiple corroborating community sources (Open Web Components, API comparison guides). All architectural patterns have production precedents.

### Gaps to Address

**Minor gaps (handle during implementation):**

- **Exact offline-geocode-city API:** Import syntax and return format verified via GitHub README, but exact TypeScript types may need adjustment during integration. Handle by: Read types from node_modules after install, adjust interface definitions.

- **GPS coordinate precision for cache keys:** Research suggests 2 decimal places (~1km) for deduplication, but optimal rounding may vary. Handle by: Start with 2 decimals, add logging for cache hit rates, adjust if needed.

- **Shadow DOM performance thresholds:** Research indicates 50+ rows causes issues, but exact threshold depends on complexity. Handle by: Performance measurement in Phase 4, adjust max-rows default based on actual benchmarks.

- **Activity timezone → country mapping:** Fallback for activities without GPS requires timezone to country lookup table. Handle by: Use IANA timezone database mapping (well-established), implement in Phase 1 if needed.

All gaps are implementation details, not architectural uncertainties. Core approach is validated.

## Sources

### Primary (HIGH confidence)
- [MDN Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) - Web Components API, Shadow DOM, Custom Elements, observedAttributes lifecycle
- [MDN Using Custom Elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) - attributeChangedCallback patterns
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) - Rate limits, caching policy, attribution requirements
- [Strava Support - Bad GPS Data](https://support.strava.com/hc/en-us/articles/216917707-Bad-GPS-Data) - Official GPS data quality issues
- [offline-geocode-city GitHub](https://github.com/kyr0/offline-geocode-city) - 217 KB bundle size, browser/Node.js support, S2 cells, city-level precision

### Secondary (MEDIUM confidence)
- [Open Web Components - Attributes Guide](https://open-wc.org/guides/knowledge/attributes-and-properties/) - Type parsing, property-attribute reflection best practices
- [Public APIs - Free Geocoding APIs 2026](https://publicapis.io/blog/free-geocoding-apis) - API comparison (Nominatim, LocationIQ, OpenCage, Google)
- [Wandrer.earth](https://wandrer.earth/) - Competitor feature analysis (street-level exploration, % completion badges)
- [StatHunters](https://www.statshunters.com/) - Competitor feature analysis (activity mapping, statistics tables)
- [Mapscaping - Geocoding API Pricing Guide](https://mapscaping.com/guide-to-geocoding-api-pricing/) - Cost comparison and optimization strategies
- [Does Shadow DOM Improve Style Performance?](https://nolanlawson.com/2021/08/15/does-shadow-dom-improve-style-performance/) - Performance benchmarks and analysis

### Tertiary (LOW confidence - needs validation)
- Exact npm version numbers (npm registry queries not performed, assumed ^1.x for offline-geocode-city based on GitHub)
- GPS coordinate rounding precision (2 decimals recommended by multiple sources, but optimal value may vary)

---
*Research completed: 2026-02-14*
*Ready for roadmap: yes*
