# Strava Analytics & Visualization Platform

## What This Is

A personal Strava data pipeline and visualization platform that fetches run data via the Strava API, computes custom statistics (aggregations, streaks, trends, patterns, geographic data), and produces embeddable Custom Element widgets deployed to GitHub Pages. Five widget types cover stats, comparisons, streaks, geographic tables, and geographic statistics — all configurable via HTML attributes with dark/light theming and responsive sizing. Lives in its own repo (strava-widgets), with a daily GitHub Actions pipeline for automated refresh including non-blocking geocoding.

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

### Active

#### Current Milestone: v1.2 Maps & Geo Fix

**Goal:** Fix city detection accuracy, add multi-city tracking per run, and build interactive map widgets (route maps, heatmap, country/city map).

**Target features:**
- Replace geocoding library with GeoNames-based solution (fix suburb-instead-of-city problem)
- Multi-city tracking per run using decoded route polylines
- Run route map widgets (single run, browser/gallery, latest N runs)
- Heatmap widget showing all runs overlaid on a map
- Country/city pin map widget
- Both widget and standalone page formats for map visualizations

### Out of Scope

- Website redesign — this project outputs widgets, doesn't modify bacilo.github.io itself
- Social features — this is a personal dashboard, not multi-user
- Non-running activities — focus on runs only for now
- Mobile app — web widgets only
- Real-time Strava sync via webhooks — daily rebuild is sufficient
- AI training recommendations — massive scope, liability, sports science needed
- Interactive run maps — deferred to future milestone (v1.2+)
- Map styling themes (topographic, neon, minimal) — deferred to future milestone
- Animated run playback on maps — deferred to future milestone
- Street View playback along runs — deferred to future milestone
- Maps as post/page backgrounds — deferred to future milestone
- Street-level geocoding — city-level is sufficient, poor accuracy at finer granularity
- Unlimited theme customization — controlled CSS variable presets, prevents layout breakage
- Every-street completion (Wandrer clone) — massive complexity, OpenStreetMap integration

## Context

Shipped v1.0 + v1.1 with 6,702 LOC TypeScript across 19 plans in 4 days.
Tech stack: TypeScript, Node.js 22, Chart.js, Vite (IIFE bundles), Custom Elements, Shadow DOM, GitHub Actions.
1,808 run activities synced from Strava. 5 Custom Element widgets deployed to GitHub Pages.
Geographic coverage: 23 countries, 57 cities from 92% of activities (offline geocoding, zero API calls).
Repository: github.com/bacilo/strava-widgets (public).

**Future vision (noted for v1.2+):** Interactive maps with run routes, static "picture frame" maps, map styling themes (topographic, neon, minimal), maps as post backgrounds, animated run playback, Street View playback along runs, choropleth country maps, region completion badges.

## Constraints

- **Hosting**: GitHub Pages — no server-side rendering, static assets only
- **API**: Strava API rate limits (100 requests per 15 minutes, 1000 per day) — data cached locally
- **Auth**: Strava OAuth refresh token flow — tokens stored in GitHub Secrets + committed tokens.json
- **Embedding**: Widgets must work within Jekyll+Astro pages as self-contained IIFE bundles
- **Geocoding**: Offline only (offline-geocode-city library) — no external API calls

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

---
*Last updated: 2026-02-16 after v1.2 milestone started*
