# Strava Analytics & Visualization Platform

## What This Is

A personal Strava data pipeline and visualization platform that fetches run data via the Strava API, computes custom statistics (aggregations, streaks, trends, patterns, geographic data), and produces embeddable Custom Element widgets and interactive map visualizations deployed to GitHub Pages. Ten widget types cover stats, comparisons, streaks, geographic tables, geographic statistics, route maps (single-run, multi-run overlay, route browser), heatmap, and pin map — all configurable via HTML attributes with dark/light theming and responsive sizing. Standalone full-page map views available alongside embeddable widgets. Lives in its own repo (strava-widgets), with a daily GitHub Actions pipeline for automated refresh including non-blocking geocoding.

## Core Value

Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.

## Requirements

### Validated

- ✓ Strava OAuth authentication and token management — v1.0
- ✓ Fetch and store run activity data from Strava API — v1.0
- ✓ Weekly km aggregation and chart widget — v1.0
- ✓ Year-over-year totals (km, runs, hours) — v1.0
- ✓ Custom time-period aggregations (monthly, yearly) — v1.0
- ✓ Streak and pattern detection (consecutive run days, time-of-day, seasonal trends) — v1.0
- ✓ Embeddable widget system for static site consumption — v1.0
- ✓ Data refresh pipeline (daily automated rebuild via GitHub Actions) — v1.0
- ✓ Geographic data extraction from activities (countries, cities from GPS coordinates) — v1.1
- ✓ Geographic statistics (runs/distance per city and country, ranked lists, CSV export) — v1.1
- ✓ Geographic table widget with sortable columns and pagination — v1.1
- ✓ Widget customization via HTML data-attributes (title, labels, colors, size, theme) — v1.1
- ✓ Dark/light mode support with auto-detection — v1.1
- ✓ Responsive container-based widget sizing — v1.1
- ✓ All widgets migrated to Custom Elements — v1.1

- ✓ Accurate city-level geocoding via GeoNames (166K cities, replacing UN/LOCODE) — v1.2
- ✓ Multi-city tracking per run using decoded route polylines — v1.2
- ✓ Single-run route map widget with zoom/pan and auto-fit — v1.2
- ✓ Multi-run overlay widget showing latest N runs — v1.2
- ✓ Route browser widget with list selection and embedded map — v1.2
- ✓ Heatmap widget with date filtering and color scheme options — v1.2
- ✓ Pin map widget with city/country toggle and visual encoding — v1.2
- ✓ Standalone full-page views for heatmap, pin map, and route browser — v1.2
- ✓ Leaflet map infrastructure with Shadow DOM CSS injection and CDN externalization — v1.2

### Active

(No active milestone — run `/gsd:new-milestone` to start next)

### Out of Scope

- Website redesign — this project outputs widgets, doesn't modify bacilo.github.io itself
- Social features — this is a personal dashboard, not multi-user
- Non-running activities — focus on runs only for now
- Mobile app — web widgets only
- Real-time Strava sync via webhooks — daily rebuild is sufficient
- AI training recommendations — massive scope, liability, sports science needed
- Map styling themes (topographic, neon, minimal) — deferred to future milestone
- Animated run playback on maps — deferred to future milestone
- Street View playback along runs — deferred to future milestone
- Maps as post/page backgrounds — deferred to future milestone
- Street-level geocoding — city-level is sufficient, poor accuracy at finer granularity
- Unlimited theme customization — controlled CSS variable presets, prevents layout breakage
- Every-street completion (Wandrer clone) — massive complexity, OpenStreetMap integration

## Context

Shipped v1.0 + v1.1 + v1.2 with 9,148 LOC TypeScript across 30 plans in 6 days.
Tech stack: TypeScript, Node.js 22, Chart.js, Leaflet 1.9.4, Vite (IIFE bundles), Custom Elements, Shadow DOM, GitHub Actions.
1,808 run activities synced from Strava. 10 Custom Element widgets + 3 standalone pages deployed to GitHub Pages.
Geographic coverage: 23 countries, 57 cities from 92% of activities (GeoNames offline geocoding, zero API calls).
Multi-city tracking: 86% of activities pass through multiple cities via polyline route sampling.
Repository: github.com/bacilo/strava-widgets (public).

**Future vision:** Map styling themes (topographic, neon, minimal), maps as post backgrounds, animated run playback, Street View playback along runs, choropleth country maps, region completion badges, pace/speed color coding on routes.

## Constraints

- **Hosting**: GitHub Pages — no server-side rendering, static assets only
- **API**: Strava API rate limits (100 requests per 15 minutes, 1000 per day) — data cached locally
- **Auth**: Strava OAuth refresh token flow — tokens stored in GitHub Secrets + committed tokens.json
- **Embedding**: Widgets must work within Jekyll+Astro pages as self-contained IIFE bundles
- **Geocoding**: Offline only (offline-geocoder with GeoNames cities1000) — no external API calls
- **Maps**: Leaflet externalized to CDN — widgets use global `L`, Shadow DOM CSS injection required

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate repo from website | Keeps data pipeline independent, cleaner separation of concerns | ✓ Good |
| Runs only for v1 | Simplifies data model, user primarily interested in running | ✓ Good |
| Daily rebuild via GitHub Actions | Simpler architecture than live API, sufficient for personal use | ✓ Good |
| Native fetch (no HTTP libraries) | Node.js 18+ built-in, fewer dependencies | ✓ Good |
| Shadow DOM for widget isolation | Host page styles cannot affect widgets | ✓ Good |
| Vite IIFE bundles | Single-file embeddability, no module loader required | ✓ Good |
| Git-tracked activity data | CI needs committed data for incremental sync | ✓ Good |
| CI token bootstrap pattern | First run uses secret, subsequent runs use committed tokens | ✓ Good |
| TDD for streak logic | Complex edge cases benefit from test-first | ✓ Good |
| UTC everywhere for dates | Timezone safety, consistent across environments | ✓ Good |
| Offline geocoding (offline-geocode-city) | Zero API calls, no rate limits, no cost, 217KB library | ✓ Good |
| Git-tracked location cache | >90% cache hit rate across CI builds, 114 unique locations | ✓ Good |
| Coordinate rounding (4 decimal places) | ≈11m precision balances accuracy with cache efficiency | ✓ Good |
| Native Custom Elements API | Zero dependencies, full attribute lifecycle control | ✓ Good |
| ResizeObserver + requestAnimationFrame | Prevents "ResizeObserver loop" browser errors | ✓ Good |
| Constructible Stylesheets for tables | Shared CSS across widget instances, reduced memory | ✓ Good |
| Non-blocking geocoding in CI | Geo failures don't halt stats pipeline | ✓ Good |
| Distance ranking over activity count | More meaningful geographic statistics | ✓ Good |
| UTF-8 BOM for CSV export | Special characters display correctly in Excel | ✓ Good |
| GeoNames over UN/LOCODE | 166K cities vs 5K, fixes suburb-instead-of-city problem | ✓ Good |
| Versioned geocoding cache (v2) | Safe migration with metadata tracking, old data archived | ✓ Good |
| Pre-computed route data (JSON) | 72% payload reduction vs loading full activity data in widgets | ✓ Good |
| Leaflet externalized to CDN | Keeps widget bundles < 50KB, shared across all map widgets | ✓ Good |
| Vite ?inline CSS for Shadow DOM | Bypasses document.head injection, CSS penetrates encapsulation | ✓ Good |
| Pre-decoded heatmap points | Zero UI blocking for 1,808 routes, trades file size for performance | ✓ Good |
| Quintile color scale for pin map | Clear visual hierarchy with 5 teal-to-orange levels | ✓ Good |
| Vite multi-page build for standalone | Clean output paths, pages load existing IIFE bundles (no duplication) | ✓ Good |

---
*Last updated: 2026-02-18 after v1.2 milestone complete*
