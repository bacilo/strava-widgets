# Architecture Research: Maps & Geocoding Integration

**Domain:** Strava Analytics Widget Platform (Map & Geocoding Enhancement)
**Researched:** 2026-02-16
**Confidence:** HIGH

## Executive Summary

This milestone integrates interactive maps (route visualization, heatmaps, country/city pin maps) and improved geocoding (GeoNames data, multi-city tracking) into the existing Custom Elements + Shadow DOM + Vite IIFE widget architecture. The key architectural challenge is **evolving from single-city-per-activity to multi-city-per-activity** while maintaining IIFE bundle compatibility and Shadow DOM isolation.

**Critical insight:** The geocoding data model must change first, as all map widgets depend on the new multi-city data structure. Build order: geocoding evolution → data pipeline → map widgets.

## Current Architecture (Baseline)

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions CI/CD                          │
├─────────────────────────────────────────────────────────────────┤
│  sync → compute-stats → compute-geo-stats → build-widgets       │
│   ↓          ↓                ↓                    ↓             │
│  JSON      JSON        geo/*.json            dist/widgets/       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Data Processing Layer                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ geocoder.ts  │  │compute-geo-  │  │cache-manager │          │
│  │              │→ │  stats.ts    │→ │    .ts       │          │
│  │ Single point │  │ Single city  │  │ JSON persist │          │
│  │ per activity │  │ per activity │  │ per coord    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
               ↓
         data/geo/
         ├── location-cache.json    (coord → city lookup)
         ├── cities.json            (aggregated by city)
         ├── countries.json         (aggregated by country)
         └── geo-metadata.json      (coverage stats)

┌─────────────────────────────────────────────────────────────────┐
│                      Widget Layer (Browser)                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ stats-card  │  │ comparison- │  │ geo-stats-  │             │
│  │   widget    │  │   chart     │  │   widget    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  Each: Custom Element + Shadow DOM + Vite IIFE bundle           │
│  Size: ~50-80KB minified (includes Chart.js)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Current Data Flow

```
Activity JSON (1,808 files)
    ↓
geocodeActivity(activity.start_latlng)  ← single coordinate
    ↓
GeoCache["55.7,12.53"] → {cityName, countryName, countryIso2}
    ↓
Aggregate by city key: "Roskilde,DK"
    ↓
Output: cities.json, countries.json
```

### Current Component Boundaries

| Component | Responsibility | Tech Stack |
|-----------|----------------|------------|
| `src/geo/geocoder.ts` | Reverse geocode single coordinate | `offline-geocode-city` (GeoNames-based) |
| `src/geo/compute-geo-stats.ts` | Aggregate activities by city/country | TypeScript, Node.js |
| `src/geo/cache-manager.ts` | Persist coordinate→city lookups | JSON file I/O |
| `src/widgets/*/index.ts` | Custom Element widgets | Shadow DOM, Chart.js |
| `scripts/build-widgets.mjs` | Build each widget as IIFE | Vite library mode |
| `.github/workflows/daily-refresh.yml` | Daily data sync + build + deploy | GitHub Actions |

## Target Architecture (New)

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  Enhanced Data Processing Layer                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ polyline-    │  │ geocoder.ts  │  │compute-geo-  │          │
│  │ decoder.ts   │→ │ (enhanced)   │→ │  stats.ts    │          │
│  │              │  │              │  │ (enhanced)   │          │
│  │ Google poly- │  │ Multi-point  │  │ Multi-city   │          │
│  │ line → coord │  │ per activity │  │ per activity │          │
│  │ array        │  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
               ↓
         data/geo/
         ├── location-cache.json       (coord → city lookup)
         ├── cities.json               (aggregated by city)
         ├── countries.json            (aggregated by country)
         └── activity-locations.json   (NEW: activity → cities[])

┌─────────────────────────────────────────────────────────────────┐
│                  Enhanced Widget Layer (Browser)                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ route-map-   │  │ heatmap-     │  │ country-map- │          │
│  │   widget     │  │   widget     │  │   widget     │          │
│  │              │  │              │  │              │          │
│  │ Leaflet +    │  │ Leaflet +    │  │ Leaflet +    │          │
│  │ polylines    │  │ Leaflet.heat │  │ markers      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  Each: Custom Element + Shadow DOM + Vite IIFE bundle           │
│  Size estimate: ~120-150KB minified (includes Leaflet + plugins)│
└─────────────────────────────────────────────────────────────────┘
```

### Enhanced Data Flow

```
Activity JSON with map.summary_polyline
    ↓
polylineDecoder.decode(summary_polyline)  ← NEW
    ↓
Array of [lat, lng] coordinates (10-200+ points per route)
    ↓
geocodeRoutePoints(coords)  ← NEW: sample route, geocode multiple
    ↓
GeoCache lookups + deduplication
    ↓
Activity → cities[] mapping (multi-city per run)
    ↓
NEW: activity-locations.json: {
  activityId: {
    cities: ["Roskilde,DK", "Copenhagen,DK"],
    primaryCity: "Roskilde,DK",
    routeCrossesCountries: false
  }
}
    ↓
Enhanced aggregation with multi-city support
    ↓
Output: cities.json, countries.json, activity-locations.json
```

## Component Responsibilities (New + Modified)

| Component | Type | Responsibility | Implementation |
|-----------|------|----------------|----------------|
| **src/geo/polyline-decoder.ts** | NEW | Decode Google polylines to coordinates | `@googlemaps/polyline-codec` |
| **src/geo/geocoder.ts** | MODIFIED | Reverse geocode route points, multi-city detection | Enhanced `offline-geocode-city` |
| **src/geo/compute-geo-stats.ts** | MODIFIED | Multi-city aggregation, activity→cities mapping | TypeScript pipeline |
| **src/widgets/route-map-widget/** | NEW | Display single activity route on map | Leaflet + Shadow DOM |
| **src/widgets/heatmap-widget/** | NEW | Heatmap of all activity routes | Leaflet + Leaflet.heat |
| **src/widgets/country-map-widget/** | NEW | World map with country/city pins | Leaflet + markers |
| **scripts/build-widgets.mjs** | MODIFIED | Add new map widgets to build pipeline | Update widget registry |

## Build Order & Dependency Graph

### Phase 1: Geocoding Foundation (MUST BE FIRST)

**Why first:** All map widgets depend on multi-city data model

**Components:**
1. `src/geo/polyline-decoder.ts` (NEW)
2. `src/geo/geocoder.ts` (MODIFY: add multi-city support)
3. `src/geo/compute-geo-stats.ts` (MODIFY: aggregate multi-city)
4. Data model: `activity-locations.json` (NEW)

**Deliverable:** Enhanced geocoding pipeline producing multi-city data

### Phase 2: Route Map Widget

**Components:**
1. `src/widgets/route-map-widget/index.ts` (NEW)
2. `scripts/build-widgets.mjs` (MODIFY)
3. Vite config: verify IIFE + inlined Leaflet

### Phase 3: Heatmap Widget

**Components:**
1. `src/widgets/heatmap-widget/index.ts` (NEW)
2. Install `leaflet.heat` package

### Phase 4: Country/City Map Widget

**Components:**
1. `src/widgets/country-map-widget/index.ts` (NEW)
2. Marker clustering if needed

### Dependency Graph

```
Phase 1: Geocoding Foundation
    ↓
    ├── Phase 2: Route Map Widget
    ├── Phase 3: Heatmap Widget
    └── Phase 4: Country Map Widget
```

**Critical path:** Phase 1 MUST complete before any map widget work.

## Integration Points

### Data Processing → Widget Interface

| Data File | Consumer Widgets | Update Frequency |
|-----------|------------------|------------------|
| `data/geo/cities.json` | `geo-stats-widget`, `country-map-widget` | Daily (CI) |
| `data/geo/countries.json` | `geo-stats-widget`, `country-map-widget` | Daily (CI) |
| `data/geo/activity-locations.json` | `route-map-widget`, `heatmap-widget` | Daily (CI) |

### Build Pipeline Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                     CI/CD Build Order                            │
├─────────────────────────────────────────────────────────────────┤
│  1. npm run fetch              (sync activities from Strava)     │
│  2. npm run build              (compile TypeScript)              │
│  3. npm run compute-stats      (basic stats aggregation)         │
│  4. npm run compute-geo-stats  (geocoding + multi-city) ← NEW    │
│       ↓                        (MUST run before widgets)         │
│  5. npm run build-widgets      (Vite IIFE builds)                │
│  6. Deploy to GitHub Pages     (static hosting)                  │
└─────────────────────────────────────────────────────────────────┘
```

**Critical dependency:** Step 4 MUST complete before Step 5.

## Technology Stack Recommendations

### Required Dependencies (NEW)

| Package | Version | Purpose | Size | Confidence |
|---------|---------|---------|------|------------|
| `@googlemaps/polyline-codec` | Latest | Decode Google polylines | ~3KB | HIGH |
| `leaflet` | ^1.9.0+ | Map rendering engine | ~40KB gzipped | HIGH |
| `leaflet.heat` | Latest | Heatmap visualization | ~3KB | HIGH |

**Installation:**
```bash
npm install @googlemaps/polyline-codec leaflet leaflet.heat
npm install -D @types/leaflet
```

## Sources

### Map Libraries
- [Leaflet Shadow DOM Issue #3246](https://github.com/Leaflet/Leaflet/issues/3246)
- [Leaflet.heat GitHub](https://github.com/Leaflet/Leaflet.heat)

### Polyline Decoding
- [Google Polyline Codec GitHub](https://github.com/googlemaps/js-polyline-codec)
- [@googlemaps/polyline-codec npm](https://www.npmjs.com/package/@googlemaps/polyline-codec)

### Geocoding
- [offline-geocoder npm](https://www.npmjs.com/package/offline-geocoder)
- [GeoNames cities1000 Dataset](https://download.geonames.org/export/dump/)

### Build Configuration
- [Vite IIFE Code Splitting Issue #2982](https://github.com/vitejs/vite/issues/2982)
- [Vite Build Options](https://vite.dev/config/build-options)

---
*Architecture research for: Strava Analytics Maps & Geocoding Integration*
*Researched: 2026-02-16*
*Overall confidence: HIGH (official docs + verified implementations)*
