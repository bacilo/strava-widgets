---
phase: 12-heatmap-pin-map-widgets
plan: 02
subsystem: widgets
tags: [pin-map, markercluster, geographic-visualization, interactive-map]
dependency-graph:
  requires: [10-03-map-infrastructure, 10-02-geo-data]
  provides: [pin-map-widget]
  affects: [widget-library]
tech-stack:
  added: [leaflet.markercluster@1.5.3]
  patterns: [marker-clustering, visual-encoding, coordinate-lookup]
key-files:
  created:
    - src/widgets/pin-map-widget/index.ts
    - src/types/leaflet-markercluster.d.ts
  modified:
    - scripts/build-widgets.mjs
    - package.json
decisions:
  - decision: Bundle markercluster within widget instead of externalizing
    rationale: Plugin is only 37KB, only used by this widget, simpler CDN setup
    impact: Larger bundle (72KB) but no additional CDN script tag required
  - decision: Use quintile-based color scale for distance encoding
    rationale: Five distinct colors provide clear visual hierarchy without overwhelming
    impact: Orange (>5000km), red-orange (>2000km), orange-yellow (>1000km), yellow (>500km), teal (<500km)
  - decision: Average city coordinates for country-level centroids
    rationale: Simple, accurate enough for world-scale view, uses existing location-cache data
    impact: No need for separate country coordinate lookup
metrics:
  duration: 4
  completed-date: 2026-02-17
---

# Phase 12 Plan 02: Pin Map Widget Summary

**One-liner:** Interactive world map with city/country pins, toggleable aggregation, clustering, and visual encoding by activity count and distance

## Overview

Implemented the pin map widget that displays geographic markers for all cities and countries visited, with a toggle to switch between aggregation levels, marker clustering for dense city views, and visual encoding of activity volume through marker size and color.

## Tasks Completed

### Task 1: Install markercluster, create type declarations, and build core pin map widget
**Status:** Complete
**Commit:** cce40b8
**Duration:** ~4 minutes

**Implementation:**
1. Installed `leaflet.markercluster@1.5.3` package
2. Created TypeScript type declarations (`src/types/leaflet-markercluster.d.ts`) since no official @types package exists
3. Implemented `PinMapWidgetElement` extending `WidgetBase`:
   - Fetches 5 data sources in parallel: cities, countries, location-cache, activity-cities, route-list
   - Renders world map with OpenStreetMap tiles (center [30, 0], zoom 2)
   - Country view: averages city coordinates for country centroids, displays non-clustered markers
   - City view: uses `L.markerClusterGroup` (maxRadius 50px) for clean visualization
   - Visual encoding: marker size 20-60px (proportional to activity count), color quintiles (distance)
   - Click popups: activity count, total distance km, visit date range (earliest-latest activity)
   - Toggle UI: positioned absolute (top-right), shows counts, Strava orange for active view
4. Added pin-map-widget to `scripts/build-widgets.mjs` with `isMapWidget: true`
5. Bundled markercluster within widget (Leaflet externalized to CDN)

**Verification:**
- `npm ls leaflet.markercluster` shows version 1.5.3 installed
- `npx tsc --noEmit` passes with no type errors
- `npm run build-widgets` succeeds, creates `dist/widgets/pin-map-widget.iife.js` (72KB)
- 10 widget bundles built successfully (no regression)
- Bundle ends with `}(L);` confirming Leaflet externalization

**Key Files:**
- `src/widgets/pin-map-widget/index.ts` (412 lines) - Widget implementation
- `src/types/leaflet-markercluster.d.ts` (28 lines) - Type declarations

## Deviations from Plan

None - plan executed exactly as written.

## Technical Implementation Details

### Visual Encoding (PIN-04)

**Size encoding:**
- Dynamic scaling based on max activity count in dataset
- Range: 20px (minimum) to 60px (maximum)
- Formula: `size = 20 + ((count - 1) / (maxCount - 1)) * 40`

**Color encoding (distance quintiles):**
- `>5000 km` → `#fc4c02` (Strava orange)
- `>2000 km` → `#ff6b35` (red-orange)
- `>1000 km` → `#f7931e` (orange-yellow)
- `>500 km` → `#fdc500` (yellow)
- `<500 km` → `#4ecdc4` (teal)

### Coordinate Lookup Strategy

**Country coordinates:**
- Averages lat/lng of all cities in that country from location-cache
- Validates coordinates (-90 to 90 lat, -180 to 180 lng)
- Falls back to null if no entries found (console warning)

**City coordinates:**
- Exact match: `cityName` AND `countryIso2` match in location-cache
- Fuzzy fallback: case-insensitive partial match on city name
- Parses coordinates from cache key format `"lat,lng"`

### Visit Date Range Calculation

1. For each city, find all activities that visited that city (via `activity-cities.json`)
2. Look up activity dates from `route-list.json`
3. Sort dates chronologically
4. Format as "Mon YYYY - Mon YYYY" (e.g., "Feb 2023 - Oct 2025")
5. Country popups show date range across all cities in that country

### Marker Clustering Configuration

```javascript
L.markerClusterGroup({
  maxClusterRadius: 50,        // Cluster markers within 50px
  spiderfyOnMaxZoom: true,     // Spread out on max zoom
  showCoverageOnHover: false   // Don't show polygon on hover
})
```

## Success Criteria

- [x] `<pin-map-widget>` custom element renders markers for cities and countries (PIN-01)
- [x] Click popup shows run count, distance, and visit date range (PIN-02)
- [x] Toggle UI switches between country-level and city-level views (PIN-03)
- [x] Marker size proportional to activity count, color based on distance quintile (PIN-04)
- [x] City-level view uses marker clustering for clean visualization at low zoom

## Output Artifacts

**Widget bundle:**
- `dist/widgets/pin-map-widget.iife.js` (72KB)
- Includes markercluster library bundled
- Externalizes Leaflet to global `L` variable (CDN)

**Usage:**
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="dist/widgets/pin-map-widget.iife.js"></script>

<pin-map-widget data-view="country" data-height="600px"></pin-map-widget>
```

**Attributes:**
- `data-view`: `"country"` or `"city"` (default: `"country"`)
- `data-height`: CSS height value (default: `"500px"`)

## Self-Check: PASSED

**Created files verified:**
```bash
[ -f "src/widgets/pin-map-widget/index.ts" ] && echo "FOUND: src/widgets/pin-map-widget/index.ts" || echo "MISSING"
# FOUND: src/widgets/pin-map-widget/index.ts

[ -f "src/types/leaflet-markercluster.d.ts" ] && echo "FOUND: src/types/leaflet-markercluster.d.ts" || echo "MISSING"
# FOUND: src/types/leaflet-markercluster.d.ts

[ -f "dist/widgets/pin-map-widget.iife.js" ] && echo "FOUND: dist/widgets/pin-map-widget.iife.js" || echo "MISSING"
# FOUND: dist/widgets/pin-map-widget.iife.js
```

**Commit verified:**
```bash
git log --oneline --all | grep -q "cce40b8" && echo "FOUND: cce40b8" || echo "MISSING"
# FOUND: cce40b8
```

## Notes

- Markercluster CSS is injected via `vite-plugin-css-injected-by-js` (same pattern as other map widgets)
- Bundle size (72KB) is larger than other map widgets (~35KB) due to bundled markercluster library
- This is acceptable and preferred over requiring users to add extra CDN script tags
- Widget leverages existing geo data pipeline from Phase 10 (location-cache, activity-cities)
- Date formatting uses JavaScript `Date` object (not external library like date-fns)
