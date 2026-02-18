---
phase: 11-route-map-widgets
plan: 03
subsystem: widgets
tags: [route-browser, map-widget, leaflet, interactive, ui]
completed: 2026-02-17

dependency_graph:
  requires:
    - 11-01-SUMMARY.md # RouteRenderer utility and route data infrastructure
  provides:
    - route-browser widget (list + map side-by-side)
    - test page with all Phase 11 widgets
  affects:
    - test.html # Added route widget demos

tech_stack:
  added:
    - route-browser Custom Element with Leaflet integration
  patterns:
    - Side-by-side grid layout with responsive stacking
    - List selection drives map state updates
    - CSS container queries for responsive breakpoints

key_files:
  created:
    - src/widgets/route-browser/index.ts # Route browser widget implementation
  modified:
    - scripts/build-widgets.mjs # Added route-browser build entry
    - dist/widgets/test.html # Added route widget demos and Leaflet CDN

decisions:
  - choice: "280px fixed sidebar width with grid layout"
    rationale: "Provides optimal list item readability while maximizing map viewport"
    alternatives: ["Flexible percentage-based width", "Tabbed interface"]
  - choice: "Container query for responsive stacking at 500px"
    rationale: "Widget-level responsiveness independent of page layout"
    alternatives: ["Media queries", "JavaScript-based resize detection"]
  - choice: "Auto-select first route on render"
    rationale: "Immediate visual feedback shows map functionality without user action"
    alternatives: ["Empty map state", "Center on all routes"]

metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_created: 1
  files_modified: 2
  commits: 2
  bundle_size_kb: 36
  widget_count: 9
---

# Phase 11 Plan 03: Route Browser Widget Summary

**One-liner:** Interactive route browser with scrollable activity list and embedded map with selection-driven route display and auto-fit bounds.

## What Was Built

### Route Browser Widget (`<route-browser>`)

**Core Functionality:**
- Scrollable list of runs (280px sidebar) with name, distance, and date
- Embedded Leaflet map (responsive width) displays selected route
- Click a list item → map updates to show that route with auto-fit bounds
- Click the polyline → popup shows distance, date, and pace
- Hover effect on polylines (weight increases, opacity to 100%)
- Responsive layout: side-by-side on wide containers, stacked vertical on narrow (<500px)

**Implementation Highlights:**
- Uses `RouteRenderer.renderRoute()` for polyline decode, auto-fit, and popup formatting
- Grid layout with CSS container queries for widget-level responsiveness
- Selection state managed via `data-id` attributes and `selected` CSS class
- Smooth scroll to selected item in list (`scrollIntoView`)
- Proper cleanup in `disconnectedCallback` (remove polyline, destroy map)

**Widget Configuration:**
- `data-url`: Route list JSON (default: `data/routes/route-list.json`)
- `data-height`: Total widget height (default: `500px`)
- Standard WidgetBase attributes (theme, colors, sizing)

**Bundle Size:** 36KB (Leaflet externalized to CDN)

### Test Page Updates

Added three new widget sections to `dist/widgets/test.html`:
1. **Single Run Map** — Display single activity with ID 17257505831
2. **Multi-Run Overlay** — Latest 10 runs with distinct colors
3. **Route Browser** — Full list with interactive selection

Added Leaflet CDN (CSS + JS) and widget script tags for all three Phase 11 widgets.

## Deviations from Plan

None - plan executed exactly as written.

## Technical Outcomes

### Build System
- All 9 widgets build successfully (6 existing + 3 Phase 11 route widgets)
- Route data files deployed to `dist/widgets/data/routes/`:
  - `route-list.json` (2.0 MB) — Full activity list
  - `latest-runs.json` (24 KB) — Latest 10 runs
- TypeScript compilation passes without errors
- All tests pass (18 tests, no regressions)

### Widget Behavior Validation
- ✓ Scrollable list renders all routes with formatted metadata
- ✓ Selection updates map to show correct route
- ✓ Auto-fit bounds centers route in viewport
- ✓ Popup displays on polyline click with distance, date, pace
- ✓ Hover effect increases polyline weight
- ✓ Responsive layout stacks vertically at 500px breakpoint
- ✓ First route auto-selected on initial render

### Success Criteria Met
- [x] `<route-browser>` shows scrollable list of runs with name, distance, date
- [x] Clicking a list item updates the map to show that run's route
- [x] Selected route auto-fits to viewport
- [x] Clicking the route polyline shows popup with distance, date, pace
- [x] Layout is side-by-side on wide containers, stacked on narrow (< 500px)
- [x] All 9 widgets build correctly with existing widgets unaffected

## Phase 11 Completion Status

**Widgets Delivered (3/3):**
1. ✓ Single Run Map (11-02) — Display one activity route
2. ✓ Multi-Run Overlay (11-02) — Overlay multiple routes with distinct colors
3. ✓ Route Browser (11-03) — Browse and select runs from list

**Shared Infrastructure:**
- ✓ Route data pre-computation (11-01) — 72% payload reduction
- ✓ RouteRenderer utility (11-01) — Polyline decode, auto-fit, popups, hover effects
- ✓ HSL color distribution (11-01) — Visually distinct route colors

**Phase 11 Complete:** All planned route map widgets implemented and tested.

## Files Changed

### Created
- `src/widgets/route-browser/index.ts` (222 lines) — Route browser Custom Element

### Modified
- `scripts/build-widgets.mjs` — Added route-browser build entry
- `dist/widgets/test.html` — Added Leaflet CDN and three route widget demos

## Commits

1. `911c726` — feat(11-03): implement route browser widget with list selection and embedded map
2. `fa649df` — feat(11-03): update test page with Phase 11 route widgets

## Self-Check

### Verify Created Files Exist
```bash
✓ FOUND: src/widgets/route-browser/index.ts
```

### Verify Commits Exist
```bash
✓ FOUND: 911c726 (route browser widget implementation)
✓ FOUND: fa649df (test page updates)
```

### Verify Build Outputs
```bash
✓ FOUND: dist/widgets/route-browser.iife.js (36KB)
✓ FOUND: dist/widgets/single-run-map.iife.js (33KB)
✓ FOUND: dist/widgets/multi-run-overlay.iife.js (33KB)
✓ FOUND: dist/widgets/data/routes/route-list.json (2.0 MB)
✓ FOUND: dist/widgets/data/routes/latest-runs.json (24 KB)
```

**Self-Check: PASSED** — All files created, commits recorded, build outputs verified.

## Next Steps

Phase 11 is complete. Next phase: **Phase 12 - Heatmap Widget** (1 plan remaining in v1.2 milestone).
