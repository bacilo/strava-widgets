# Project Research Summary

**Project:** Strava Analytics & Visualization Platform
**Domain:** Fitness data analytics with embeddable widgets
**Researched:** 2026-02-13
**Confidence:** HIGH

## Executive Summary

This project builds a personal Strava analytics platform that fetches running data via GitHub Actions, computes statistics in a TypeScript/Node.js pipeline, and generates embeddable JavaScript widgets for a static Jekyll/Astro site hosted on GitHub Pages. The architecture follows a JAMstack pattern with build-time data fetching, avoiding server-side dependencies while respecting Strava's API rate limits (100 requests/15min, 1000/day).

The recommended approach separates concerns into three clear layers: a data acquisition layer (OAuth + API client with rate limiting), a processing layer (statistics computation with aggregations and geographic analysis), and an output layer (static JSON/widget generation). Daily batch processing via GitHub Actions cron jobs provides an optimal balance between data freshness and API constraint compliance, while incremental sync capabilities enable future near-real-time updates.

The primary risks center on OAuth token management in a static environment, API rate limit exhaustion, and geographic data privacy violations. These are mitigated through GitHub Secrets for tokens, aggressive caching with git-committed data, and privacy-aware GPS handling. The platform's unique value proposition is producing embeddable widgets for external sites—a capability no existing tool (Strava, VeloViewer, Statshunters, Elevate) currently offers.

## Key Findings

### Recommended Stack

The stack centers on **TypeScript 5.3+ with Node.js 20 LTS** for type safety and native fetch API support, avoiding runtime dependencies. Native fetch eliminates the need for axios or strava-v3 libraries, giving full control over rate limiting and OAuth flows. Build-time processing uses date-fns for temporal calculations and lodash-es for aggregations, while avoiding heavyweight data processing libraries (pandas, DuckDB) unnecessary for <10k activities.

**Core technologies:**

- **TypeScript 5.3+ / Node.js 20 LTS**: Runtime with native fetch, type safety for API responses, excellent GitHub Actions support
- **Vite 5.1+**: Widget build system with library mode for UMD/IIFE bundles, tree-shaking for minimal bundle sizes (~150-200KB gzipped)
- **Observable Plot 0.6+**: Primary visualization library (modern D3-based grammar, concise syntax, responsive by default)
- **Leaflet 1.9+**: Map rendering for GPS routes with OpenStreetMap tiles (lighter than Mapbox GL for basic use cases)
- **bottleneck 2.19+**: Rate limiting to respect Strava's 100/15min and 1000/day limits with reservoir pattern
- **GitHub Actions**: CI/CD pipeline for daily cron jobs, secrets management, and automatic deployment to GitHub Pages
- **Static JSON files**: Data storage committed to git (no database needed for personal use, provides audit trail)

**Critical version requirements:**
- Node.js 20 LTS (active until April 2026, native fetch API)
- TypeScript 5.3+ (improved type inference for API responses)
- Observable Plot 0.6+ (aggregation helpers ideal for fitness data)

### Expected Features

The feature landscape divides into table stakes (expected by any Strava tool), differentiators (competitive advantage), and anti-features (commonly requested but problematic).

**Must have (table stakes):**
- Strava OAuth + incremental data sync with token refresh
- Distance totals by time period (weekly/monthly/yearly)
- Pace/speed averages and elevation gain totals
- Activity list with filtering by date range
- Local caching to avoid redundant API calls

**Should have (competitive):**
- **Weekly km bar chart** (primary "first win" visualization)
- **Year-over-year comparison** (side-by-side progress tracking)
- **Streak detection** (consecutive run days, weekly consistency patterns)
- **Time-of-day patterns** (morning vs evening runner analysis)
- **Embeddable widgets** (THE unique differentiator—drop stats into any webpage via `<script>` tag)

**Defer (v2+):**
- Countries/cities run in (requires reverse geocoding pipeline)
- Route overlay maps (high complexity, needs polyline decoding + rendering)
- Multi-sport support (doubles data model complexity for v1)
- Heart rate zone analysis (requires premium Strava data)
- Real-time sync via webhooks (server dependency, marginal value over daily rebuild)

**Key insight:** No competitor offers embeddable widgets for external sites. This is the core value proposition—personal ownership of running data presentation.

### Architecture Approach

The platform follows a **3-tier hybrid architecture** with clear component boundaries: data layer (OAuth + API client + rate limiter), storage layer (filesystem for raw JSON + SQLite optional for processed data), processing layer (aggregation engine, streak calculator, geographic analyzer), and output layer (HTML/JSON/GeoJSON widget generators). GitHub Actions orchestrates the daily pipeline: authenticate → fetch new activities → process statistics → generate widgets → commit to repo.

**Major components:**

1. **Auth Manager** — Manages OAuth 2.0 flow, token refresh (6-hour expiry), and secure GitHub Secrets storage
2. **Data Fetcher** — Incremental sync of activities with bottleneck rate limiting, exponential backoff retries, and caching strategy (7-day athlete data, 1-day activity list)
3. **Statistics Processor** — Computes aggregations (SUM/AVG/MAX), streak detection (consecutive days), time-series trends (weekly/monthly), and geographic analysis (bounding boxes, route clustering)
4. **Widget Generator** — Creates embeddable outputs (static HTML cards, JSON for Chart.js consumption, GeoJSON for Leaflet maps, iframe-embeddable full widgets)
5. **Orchestration Pipeline** — Scheduled batch processing (daily cron at 2 AM UTC), manual CLI trigger for testing, error handling with pipeline state management

**Data flow:** Strava API → Auth (token refresh) → Fetcher (rate-limited requests) → Storage (raw JSON files) → Processor (compute stats) → Generator (widget files) → Git commit → GitHub Pages deployment

**Key patterns:**
- Immutable raw data (never modified after storage, enables reprocessing)
- Separation between raw and processed storage (processed can regenerate without API calls)
- Static-first output (self-contained files, no server required)
- Incremental everything (sync, processing, widget generation for efficiency)

### Critical Pitfalls

From the pitfalls research, five areas demand immediate attention during foundation phases:

1. **OAuth Token Management in Static Sites** — NEVER store refresh tokens client-side or commit to repos. Use GitHub Secrets for tokens during Actions workflow. Token refresh must happen proactively before 6-hour expiry. Architecture: Manual OAuth during build time, access token as GitHub secret, Actions fetches data, commit processed data only (not tokens).

2. **Geographic Data Privacy Violations** — Respect Strava's `map.privacy` flags, implement privacy zones (blur routes within 200m of home/work clusters), add random offset (100-500m) to start/end GPS points, never display exact doorstep coordinates. Critical for legal/ethical compliance and Strava API terms.

3. **Rate Limit Management** — Implement tiered caching (store API responses as static JSON committed to repo), incremental updates (fetch only new activities since last sync), request batching (summary endpoints first, detailed only when needed), rate limit buffer (target 80% of limits: 80 req/15min, 800/day). Local development mode must use cached fixtures instead of live API calls.

4. **Timezone and Time Series Handling** — Standardize on UTC for internal storage, use date-fns-tz for conversions, respect activity's local timezone from API response. Calculate daily stats using activity's local timezone (not viewer's) to avoid off-by-one errors at day boundaries. Test across DST transitions (March/November).

5. **Metric Unit Inconsistencies** — Store all values in canonical metric (meters, seconds, kg), convert to user preference only at display time. Always show units in UI (5.2 km, not 5.2). Use precise conversion constants (1 mile = 1.609344 km). Format consistently: 1 decimal for km, mm:ss for pace, whole numbers for elevation.

## Implications for Roadmap

Based on research findings, the project naturally divides into 4 phases following dependency chains and risk mitigation priorities.

### Phase 1: Foundation (Data Acquisition)

**Rationale:** OAuth and data fetching are hard dependencies for all features. Must establish secure token management and rate limit compliance before any other work. Architecture research indicates Auth → Fetcher → Storage as the critical path.

**Delivers:**
- Working OAuth flow with GitHub Secrets storage
- Incremental activity sync with rate limiting
- File-based storage for raw activities
- CLI tool to manually trigger data fetch

**Addresses (from FEATURES.md):**
- Strava OAuth + data sync (table stakes)
- Data persistence/caching (table stakes)

**Avoids (from PITFALLS.md):**
- #2: OAuth Token Management (security risk)
- #3: Geographic Data Privacy (implement privacy checks from start)
- #1: Rate Limit Management (bottleneck library + caching strategy)

**Stack elements (from STACK.md):**
- TypeScript 5.3+ / Node.js 20 LTS
- Native fetch for API calls
- bottleneck for rate limiting
- GitHub Secrets for OAuth tokens
- date-fns for timezone handling

**Research flag:** SKIP — OAuth and REST API patterns are well-documented, standard implementation

### Phase 2: Core Analytics & First Widget

**Rationale:** Once data flows reliably, deliver immediate user value through basic statistics and the "first win" visualization (weekly km chart). This validates the full pipeline before investing in complex features.

**Delivers:**
- Statistics processor (distance totals, pace averages, elevation)
- Weekly km bar chart (primary MVP feature)
- Basic embeddable HTML widget
- GitHub Actions daily cron workflow
- Data staleness indicators ("Last updated" timestamps)

**Addresses (from FEATURES.md):**
- Distance totals (weekly/monthly/yearly) — table stakes
- Pace/speed averages — table stakes
- Weekly km bar chart — PRIMARY differentiator
- Embeddable widget system — unique value proposition

**Uses (from STACK.md):**
- Observable Plot for weekly chart
- Vite library mode for widget bundles
- lodash-es for aggregations
- date-fns for weekly buckets

**Implements (from ARCHITECTURE.md):**
- Statistics Processor component
- Widget Generator component
- Orchestration Pipeline component

**Avoids (from PITFALLS.md):**
- #5: Static Site Data Staleness (display timestamps, cache busting)
- #9: Metric Unit Inconsistencies (canonical storage + display conversion)
- #6: Activity Type Assumptions (whitelist approach, fallback rendering)

**Research flag:** SKIP — Time-series aggregation and charting are standard patterns

### Phase 3: Advanced Analytics & Multiple Widgets

**Rationale:** With core pipeline proven, expand to richer insights that differentiate from Strava's built-in stats. Year-over-year comparison and streak detection are high-value, medium-complexity features.

**Delivers:**
- Year-over-year comparison dashboard
- Streak detection (consecutive days, weekly consistency)
- Time-of-day and seasonal pattern analysis
- Multiple widget types (stats cards, comparison charts, activity calendar)
- JSON export for client-side Chart.js consumption

**Addresses (from FEATURES.md):**
- Year-over-year comparison — differentiator
- Streak detection — differentiator
- Time-of-day patterns — differentiator
- Seasonal trends — differentiator
- Multiple widget types — variety

**Uses (from STACK.md):**
- Observable Plot for trend visualizations
- Chart.js (secondary) for specific chart types (doughnut, radar)
- date-fns for streak algorithms
- Static JSON output for widget data

**Implements (from ARCHITECTURE.md):**
- Advanced Statistics Processor (streaks, time-series)
- Multiple Widget Generator types
- Incremental processing optimization

**Avoids (from PITFALLS.md):**
- #4: Timezone and Time Series Handling (test across DST transitions)
- #10: Correlation vs Causation (humble language, descriptive not prescriptive)

**Research flag:** SKIP — Streak detection and trend analysis follow established patterns

### Phase 4: Geographic Features & Maps

**Rationale:** Geographic visualizations (routes, heatmaps, countries/cities) are high-value but require additional API calls (activity streams) and complex processing. Defer until core analytics are stable to manage rate limits and complexity.

**Delivers:**
- Activity streams fetcher (GPS data)
- Polyline decoder for route coordinates
- GeoJSON generator for Leaflet maps
- Route overlay map widget
- Heatmap data generation
- Cities/countries run in (with reverse geocoding)

**Addresses (from FEATURES.md):**
- Countries run in (map) — differentiator (v2)
- Cities run in (list) — differentiator (v2)
- Route overlay map — differentiator (v2)

**Uses (from STACK.md):**
- Leaflet for map rendering
- @mapbox/polyline for decoding
- OpenStreetMap tiles (free)
- GeoJSON export format

**Implements (from ARCHITECTURE.md):**
- Activity Streams Fetcher component
- Geographic Processor component
- Map Widget Generator component

**Avoids (from PITFALLS.md):**
- #3: Geographic Data Privacy (privacy zones, fuzzy start/end, respect map.privacy flags)
- #8: Polyline Encoding/Decoding Errors (use @mapbox/polyline, validate coordinates)
- #7: Large Dataset Performance (downsample GPS points, lazy-load streams)

**Research flag:** PHASE RESEARCH RECOMMENDED — Reverse geocoding services (Nominatim vs Google), privacy zone algorithms, and heatmap generation strategies need deeper investigation

### Phase Ordering Rationale

- **Foundation first:** OAuth and data fetching are hard blockers for everything else. Security risks (#2, #3) must be addressed before any data processing.
- **Core analytics second:** Deliver user value quickly with basic stats + first widget. Validates full pipeline (fetch → process → generate → deploy) before complexity.
- **Advanced analytics third:** Builds on proven processing patterns, adds differentiation without new data sources. Stays within established rate limits.
- **Geographic last:** Requires additional API calls (streams), most complex processing, highest performance risks. Benefits from established infrastructure and rate limit management.

**Dependency chain:**
- Phase 2 depends on Phase 1 (data acquisition)
- Phase 3 depends on Phase 2 (processing infrastructure)
- Phase 4 depends on Phase 1 (streams API) and Phase 3 (widget generation patterns)

**Risk mitigation progression:**
- Phase 1 addresses critical security/privacy pitfalls (#2, #3, #1)
- Phase 2 addresses UX and data integrity pitfalls (#5, #9, #6, #4)
- Phase 3 addresses analytical rigor pitfalls (#10)
- Phase 4 addresses performance and domain-specific pitfalls (#7, #8)

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 4 (Geographic):** Reverse geocoding services comparison (Nominatim free tier limits vs Google Geocoding API costs), privacy zone detection algorithms (clustering start/end points, fuzzy radius determination), heatmap generation strategies (grid density vs kernel density estimation), polyline simplification for performance (Douglas-Peucker algorithm thresholds)

**Phases with standard patterns (skip research-phase):**

- **Phase 1 (Foundation):** OAuth 2.0 flows, REST API clients, rate limiting patterns extensively documented
- **Phase 2 (Core Analytics):** Time-series aggregation, charting libraries, widget bundling well-established
- **Phase 3 (Advanced Analytics):** Streak detection algorithms, trend analysis patterns common in fitness apps

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | TypeScript/Node.js for build-time processing is industry standard. Observable Plot and Vite are well-documented. bottleneck library proven for rate limiting. |
| Features | HIGH | Feature landscape well-understood from Strava API docs and competitor analysis. Embeddable widget differentiation validated. |
| Architecture | HIGH | JAMstack pattern with static JSON storage is proven for personal projects. GitHub Actions orchestration widely used. Component boundaries clear from established patterns. |
| Pitfalls | MEDIUM-HIGH | OAuth and rate limit pitfalls well-documented. Privacy pitfalls critical and research-backed. Geographic encoding pitfalls specific but addressable with proven libraries. |

**Overall confidence:** HIGH

The project follows established patterns (JAMstack, build-time data fetching, static site widgets) with well-documented technologies. Strava API is mature with extensive community usage. The main unknowns are in Phase 4 geographic features (reverse geocoding service selection, privacy zone implementation), but these are deferred and can be researched during phase planning.

### Gaps to Address

While research confidence is high, several areas need validation during implementation:

- **Rate limit headroom:** The 80% buffer target (80 req/15min) assumes no parallel development activity. Monitor actual usage patterns during Phase 1 to validate this is sufficient.
- **SQLite vs file-only storage:** Research recommends hybrid approach but doesn't quantify the performance breakpoint. Start with files only, add SQLite when queries become slow (likely Phase 3+).
- **Widget embed compatibility:** Observable Plot and Chart.js compatibility with Jekyll/Astro needs hands-on validation. Test embed code early in Phase 2.
- **Privacy zone accuracy:** Privacy research provides strategies but not specific clustering algorithms. Needs implementation experimentation in Phase 4.
- **Bundle size optimization:** 150-200KB estimate for full widget may be too large for some pages. Investigate code splitting and lazy loading during Phase 2 widget development.

**Handling during planning/execution:**

- Phase 1: Instrument rate limit tracking to validate buffer strategy
- Phase 2: Create test Jekyll/Astro pages early for widget integration validation
- Phase 3: Profile file-based query performance, migrate to SQLite if needed
- Phase 4: Research privacy zone algorithms before implementation (use `/gsd:research-phase`)

## Sources

### Primary (HIGH confidence)

- **Strava API v3 Documentation** (developers.strava.com) — OAuth flow, rate limits, activity/stream endpoints, polyline encoding
- **Official library docs** — Observable Plot (observablehq.com/plot), Vite (vitejs.dev), Leaflet (leafletjs.com), TypeScript (typescriptlang.org)
- **GitHub Actions for Node.js** (docs.github.com/en/actions) — CI/CD workflows, cron scheduling, secrets management
- **Node.js 20 LTS documentation** — Native fetch API, runtime features, LTS timeline

### Secondary (MEDIUM confidence)

- **npm package documentation** — bottleneck, date-fns, lodash-es, @mapbox/polyline (active maintenance verified)
- **Competitor analysis** — VeloViewer, Statshunters, Elevate feature sets (validated through public documentation)
- **JAMstack architecture patterns** — Static site generation with build-time data fetching (established pattern)
- **Fitness data visualization best practices** — Weekly aggregations, streak detection, pace/distance metrics (common in running apps)

### Tertiary (LOW confidence, needs validation)

- **Privacy zone algorithms** — Clustering strategies for start/end point fuzzing (needs implementation testing)
- **Reverse geocoding service performance** — Nominatim vs Google comparison for personal use (needs Phase 4 research)
- **Bundle size estimates** — 150-200KB for full widget based on library sizes (needs actual build verification)

---

*Research completed: 2026-02-13*
*Ready for roadmap: yes*
