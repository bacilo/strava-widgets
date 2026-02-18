---
phase: 11-route-map-widgets
plan: 01
subsystem: route-infrastructure
tags: [route-data, route-rendering, shared-utilities, data-preprocessing]
dependency_graph:
  requires: [10-02-geocoding-multi-city, 10-03-leaflet-map-foundation]
  provides: [route-data-files, route-renderer-utility]
  affects: [11-02-single-route-widget, 11-03-multi-route-overlay, 11-04-route-heatmap]
tech_stack:
  added: [route-data-preprocessing, leaflet-polyline-rendering]
  patterns: [shared-utilities, data-optimization]
key_files:
  created:
    - scripts/compute-route-data.mjs
    - data/routes/route-list.json
    - data/routes/latest-runs.json
    - src/widgets/shared/route-utils.ts
  modified:
    - package.json
    - scripts/build-widgets.mjs
key_decisions:
  - decision: Pre-compute route data into optimized JSON files instead of loading full activity data in widgets
    rationale: Widget bundles need small payloads - route-list.json (2.0 MB) vs raw activities (7.1 MB)
    alternatives: [Load full activity data, Lazy load on demand]
    outcome: Reduced data payload by 72% while maintaining all route metadata
  - decision: Create shared RouteRenderer utility instead of duplicating logic across widgets
    rationale: Three route widgets (single, overlay, heatmap) all need polyline decode, auto-fit, and popup formatting
    alternatives: [Duplicate logic in each widget, Create widget base class]
    outcome: DRY implementation with consistent rendering behavior across all route widgets
  - decision: Use HSL color distribution for multi-route rendering
    rationale: Provides visually distinct colors via hue rotation for up to 20 simultaneous routes
    alternatives: [Random colors, Fixed color palette]
    outcome: Deterministic, evenly distributed colors for route visualization
metrics:
  duration: 3 minutes
  tasks_completed: 2
  files_created: 4
  files_modified: 2
  completed_date: 2026-02-17
---

# Phase 11 Plan 01: Route Data Infrastructure Summary

**One-liner:** Pre-computed route data files (1658 routes, 2.0 MB) and shared RouteRenderer utility with polyline decode, auto-fit bounds, and HSL color distribution for all route map widgets.

## Objective Achieved

Created route data infrastructure and shared rendering utilities to support three Phase 11 route map widgets. Route data pre-computation reduces widget payload from 7.1 MB (raw activities) to 2.0 MB (route metadata only). Shared RouteRenderer eliminates code duplication across single-route, multi-route overlay, and heatmap widgets.

## Tasks Completed

### Task 1: Create route data pre-computation script and generate data files

**Completed:** afaec0a

Created `scripts/compute-route-data.mjs` that extracts route metadata from 1,808 activity JSON files. Script:
- Reads all activities from `data/activities/`
- Extracts: id, name, date, distance, movingTime, polyline, startLat, startLng
- Filters out 150 activities without polylines (treadmill/manual entries)
- Sorts by date descending (newest first)
- Writes `data/routes/route-list.json` with 1,658 routes (2.0 MB)
- Writes `data/routes/latest-runs.json` with 20 most recent routes (23.7 KB)

Added npm script `compute-route-data` to package.json for easy regeneration.

Updated `scripts/build-widgets.mjs` to copy `data/routes/` to `dist/widgets/data/routes/` alongside stats and geo data.

**Files created:**
- `scripts/compute-route-data.mjs` (119 lines)
- `data/routes/route-list.json` (1658 entries, 2.0 MB)
- `data/routes/latest-runs.json` (20 entries, 23.7 KB)

**Files modified:**
- `package.json` (added compute-route-data script)
- `scripts/build-widgets.mjs` (added route data to build pipeline)

### Task 2: Create shared RouteRenderer utility

**Completed:** d96fb4d

Created `src/widgets/shared/route-utils.ts` with RouteRenderer class providing:

**Core rendering methods:**
- `renderRoute()` - Renders single route with polyline decode, auto-fit bounds, popup
- `renderMultipleRoutes()` - Renders multiple routes with HSL color distribution, combined bounds fitting
- `formatPopupContent()` - Generates HTML popup with route name, distance (km), pace, date
- `calculatePace()` - Converts distance/time to min:sec/km format (handles zero distance edge case)
- `addHoverEffect()` - Adds mouseover/mouseout events for interactive polylines

**Key features:**
- Auto-fit handles single-point routes with setView fallback (checks bounds.isValid())
- HSL color distribution provides visually distinct colors for up to 20 routes via hue rotation
- Popup content uses inline styles (works outside Shadow DOM)
- Configurable rendering via RouteRenderOptions (color, weight, opacity, showPopup, fitBounds)

**Exports:**
- `RouteRenderer` class (static methods)
- `RouteData` interface (route metadata structure)
- `RouteRenderOptions` interface (rendering configuration)

**Files created:**
- `src/widgets/shared/route-utils.ts` (212 lines)

## Verification Results

All verification criteria met:

1. ✓ `npm run compute-route-data` generates route-list.json and latest-runs.json
2. ✓ `npx tsc --noEmit` passes (route-utils.ts compiles without errors)
3. ✓ `npm run build-widgets` succeeds (build system copies route data to dist)
4. ✓ route-list.json entries have all required fields (id, name, date, distance, movingTime, polyline, startLat, startLng)
5. ✓ latest-runs.json has exactly 20 entries sorted by date descending

## Deviations from Plan

None - plan executed exactly as written.

## Technical Implementation Details

### Route Data Structure

Each route entry in route-list.json and latest-runs.json contains:
```typescript
{
  id: number;           // Activity ID
  name: string;         // Activity name
  date: string;         // ISO 8601 timestamp
  distance: number;     // Meters
  movingTime: number;   // Seconds
  polyline: string;     // Encoded polyline from Strava
  startLat: number;     // Start latitude
  startLng: number;     // Start longitude
}
```

### Data Optimization Impact

**Before:** Widgets load 7.1 MB of raw activity data
**After:** Widgets load 2.0 MB of route metadata
**Savings:** 5.1 MB (72% reduction)

For latest-runs overlay widget: 23.7 KB (99.7% reduction from full activity data)

### RouteRenderer Design Decisions

**Static methods:** RouteRenderer uses static methods (no instantiation needed) since rendering is stateless - each method call operates independently on provided map and route data.

**HSL color distribution:** For multi-route rendering, colors are generated via `hsl(${hue}, 100%, 50%)` where `hue = (index * 360 / routeCount)`. This provides:
- Deterministic colors (same route index = same color)
- Evenly distributed hues around color wheel
- Maximum visual distinction for overlapping routes

**Auto-fit fallback:** Some activities have single-point polylines (GPS errors, short routes). The auto-fit logic checks `bounds.isValid()` and falls back to `map.setView([startLat, startLng], 13)` instead of failing.

### Integration Points

Route data files and RouteRenderer utility are now ready for consumption by:
- **11-02:** Single Route Widget (renderRoute, formatPopupContent, calculatePace)
- **11-03:** Multi-Route Overlay Widget (renderMultipleRoutes, latest-runs.json)
- **11-04:** Route Heatmap Widget (route-list.json, polyline decoding)

## Files Modified

**Created:**
- `scripts/compute-route-data.mjs` (119 lines)
- `data/routes/route-list.json` (1658 entries)
- `data/routes/latest-runs.json` (20 entries)
- `src/widgets/shared/route-utils.ts` (212 lines)

**Modified:**
- `package.json` (added compute-route-data script)
- `scripts/build-widgets.mjs` (added route data copy to build pipeline)

## Self-Check: PASSED

**Created files exist:**
```
FOUND: scripts/compute-route-data.mjs
FOUND: data/routes/route-list.json
FOUND: data/routes/latest-runs.json
FOUND: src/widgets/shared/route-utils.ts
```

**Commits exist:**
```
FOUND: afaec0a (Task 1 - route data pre-computation)
FOUND: d96fb4d (Task 2 - RouteRenderer utility)
```

**Data verification:**
```
route-list.json: 1658 routes, all with required fields
latest-runs.json: 20 routes, sorted by date descending
TypeScript compilation: PASSED
Widget build: PASSED (route data copied to dist)
```

## Next Steps

Phase 11 Plan 02: Implement single-route widget that consumes RouteRenderer utility for individual activity route visualization.

---

*Duration: 3 minutes*
*Completed: 2026-02-17*
