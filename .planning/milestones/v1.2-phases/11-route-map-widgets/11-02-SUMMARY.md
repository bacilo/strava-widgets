---
phase: 11-route-map-widgets
plan: 02
subsystem: route-map-widgets
tags: [widgets, leaflet, maps, routes, ui]

dependency-graph:
  requires:
    - 11-01 (RouteRenderer utility and route data infrastructure)
  provides:
    - Single-run map widget with interactive zoom/pan
    - Multi-run overlay widget with distinct colors per route
  affects:
    - Widget library (2 new map widgets added)
    - Build pipeline (9 total widgets)

tech-stack:
  added:
    - Custom Elements API (SingleRunMapElement, MultiRunOverlayElement)
  patterns:
    - WidgetBase extension for consistent widget behavior
    - RouteRenderer.renderRoute() for single route rendering
    - RouteRenderer.renderMultipleRoutes() for overlay rendering
    - HSL color distribution for visually distinct routes
    - Shadow DOM isolation with CSS injection
    - Leaflet externalization to CDN (keeps bundles < 50KB)

key-files:
  created:
    - src/widgets/single-run-map/index.ts (121 lines)
    - src/widgets/multi-run-overlay/index.ts (111 lines)
  modified:
    - scripts/build-widgets.mjs (added multi-run-overlay entry)

decisions:
  - Use data-activity-id attribute for single-run-map to select specific route from route-list.json
  - Use data-count attribute for multi-run-overlay to control number of displayed routes (default 10)
  - Use data-height attribute for both widgets to control map container height
  - Apply hover effects to all routes for better user interaction
  - HSL hue rotation provides automatic color distribution without manual color selection
  - Combined bounds fitting for multi-run overlay ensures all routes visible on load

metrics:
  duration: 3 min
  tasks_completed: 2
  files_created: 2
  files_modified: 1
  bundle_sizes:
    - single-run-map.iife.js: 33KB
    - multi-run-overlay.iife.js: 33KB
  tests_passed: 18
  completed: 2026-02-17
---

# Phase 11 Plan 02: Single-Run and Multi-Run Map Widgets Summary

**One-liner:** Created single-run map widget (zoom/pan on one route) and multi-run overlay widget (latest N runs with HSL color distribution), both using shared RouteRenderer utility

## What Was Built

### Single-Run Map Widget (`<single-run-map>`)

**Purpose:** Display a single activity's route on an interactive Leaflet map with zoom/pan, auto-fit viewport, hover effects, and click popup.

**Implementation:**
- Extends WidgetBase following established patterns
- Renders single route via `RouteRenderer.renderRoute()`
- Auto-fits viewport to route bounds with 20px padding
- Shows popup on click with distance (km), pace (min/km), and date
- Hover effect increases polyline weight from 3 to 5
- Supports `data-activity-id` to select specific route from route-list.json
- Supports `data-height` attribute (default 400px)
- Bundle size: 33KB with Leaflet externalized to CDN

**Usage:**
```html
<single-run-map data-url="data/routes/route-list.json" data-activity-id="12345"></single-run-map>
```

### Multi-Run Overlay Widget (`<multi-run-overlay>`)

**Purpose:** Display the latest N runs overlaid on a single map with distinct colors, combined auto-fit bounds, and individual popups.

**Implementation:**
- Extends WidgetBase following established patterns
- Renders multiple routes via `RouteRenderer.renderMultipleRoutes()`
- HSL color distribution via hue rotation: `hsl(i * 360 / N, 100%, 50%)`
- Combined bounds fitting ensures all routes visible
- Hover effects on all routes
- Popups show distance, pace, and date per route
- Supports `data-count` attribute (default 10, max from data)
- Supports `data-height` attribute (default 500px)
- Bundle size: 33KB with Leaflet externalized to CDN

**Usage:**
```html
<multi-run-overlay data-url="data/routes/latest-runs.json" data-count="10"></multi-run-overlay>
```

## Deviations from Plan

None - plan executed exactly as written.

## Testing & Verification

**Compile Check:** ✅ `npx tsc --noEmit` passes

**Build Verification:** ✅ All 9 widgets build successfully
- stats-card.iife.js (14KB)
- comparison-chart.iife.js (181KB)
- streak-widget.iife.js (178KB)
- geo-stats-widget.iife.js (21KB)
- geo-table-widget.iife.js (21KB)
- map-test.iife.js (30KB)
- single-run-map.iife.js (33KB) ← NEW
- multi-run-overlay.iife.js (33KB) ← NEW
- route-browser.iife.js (36KB)

**Bundle Size:** ✅ Both new widgets < 50KB target

**Leaflet Externalization:** ✅ Both bundles end with `}(L);`

**Test Suite:** ✅ 18 tests passed (0 regressions)

**Widget Library Status:** 9 total widgets, all building cleanly

## Success Criteria Met

- ✅ `<single-run-map>` renders a single route with zoom/pan, auto-fit, hover, popup
- ✅ `<multi-run-overlay>` renders latest N runs with distinct colors, combined bounds, popups
- ✅ Both widgets follow established map widget patterns (Leaflet CDN, Shadow DOM, CSS injection, marker icon fix)
- ✅ Bundle sizes < 50KB each (both 33KB)
- ✅ Existing widgets unaffected (all 9 widgets build successfully)

## Technical Notes

**Color Distribution Algorithm:**
The multi-run overlay uses HSL hue rotation to automatically generate visually distinct colors:
```typescript
const hue = Math.floor((i * 360) / routes.length);
const color = `hsl(${hue}, 100%, 50%)`;
```

This provides excellent color separation for N routes without manual color selection. For 10 routes, colors are 36° apart on the color wheel.

**Bounds Fitting:**
Single-run-map fits bounds per route (immediate). Multi-run-overlay creates a feature group of all polylines and fits to combined bounds. Both use 20px padding and maxZoom: 15 to prevent over-zooming on short routes.

**Marker Icon Fix:**
Both widgets apply the Leaflet marker icon fix required for Vite bundler:
```typescript
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});
```

## Requirements Fulfilled

| Requirement | Status | Implementation |
|-------------|--------|---------------|
| ROUTE-01 | ✅ | Single-run map with interactive zoom/pan |
| ROUTE-03 | ✅ | Multi-run overlay with latest N runs |
| ROUTE-04 | ✅ | Auto-fit viewport on load (both widgets) |
| ROUTE-05 | ✅ | Click popup with distance/date/pace (both widgets) |

## Next Steps

**Phase 11-03:** Interactive route browser widget (list + embedded map)
- List of all routes with search/filter
- Click to load route in embedded map
- Integrates single-run-map widget

## Self-Check: PASSED

**Created files exist:**
```
FOUND: src/widgets/single-run-map/index.ts
FOUND: src/widgets/multi-run-overlay/index.ts
```

**Commits exist:**
```
FOUND: d564458 (Task 1 - single-run map widget)
FOUND: 85b5bae (Task 2 - multi-run overlay widget)
```

**Build artifacts exist:**
```
FOUND: dist/widgets/single-run-map.iife.js (33KB)
FOUND: dist/widgets/multi-run-overlay.iife.js (33KB)
```

**All claims verified:** ✅
