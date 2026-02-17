---
status: complete
phase: 13-standalone-pages
source: 13-01-SUMMARY.md
started: 2026-02-17T12:00:00Z
updated: 2026-02-17T12:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Heatmap Standalone Page
expected: Opening heatmap.html shows a full-viewport interactive heatmap of all runs. The map fills the entire browser window with no scrollbars, margins, or padding. Leaflet zoom/pan controls are visible and functional.
result: issue
reported: "The map is not loading properly. It's like partially loaded, I have tried waiting and refreshing but I believe there is a bigger issue. It's always partially loaded in the same way. Zooming in and out doesn't fix anything and seems to extend the map well beyond the viewport but hard to tell what's happening since only some random squares are visible."
severity: major

### 2. Pin Map Standalone Page
expected: Opening pinmap.html shows a full-viewport pin map with city/country pins. The map fills the entire browser window. Clicking pins shows popups with run count and distance info.
result: issue
reported: "Can't see pins, map loaded in similar broken manner as before."
severity: major

### 3. Routes Standalone Page
expected: Opening routes.html shows a full-viewport route browser with the route list sidebar and map. The layout fills the entire browser window. Selecting a route displays it on the map.
result: issue
reported: "I can click the routes and see them on the left side. Map is broken, only certain squares visible and not always contiguous. Zooming it makes it seemingly larger in width. The map does not take the whole height, but only the top third."
severity: major

### 4. Navigation Bar
expected: Each standalone page shows a navigation bar (top-left overlay) with links to: Widgets (index), Heatmap, Pin Map, Routes. The current page link is highlighted in Strava orange. Clicking a link navigates to that page.
result: pass

### 5. Full-Viewport Layout
expected: On all three standalone pages, the map fills 100% of the viewport height and width. No white space, no scrollbars, no WidgetBase max-width constraint (800px). Resizing the browser window causes the map to resize accordingly.
result: issue
reported: "On all three standalone pages the whole width is occupied but only around the top third of the full height. Map is broken and resizing window's impact hard to gather since the broken map just becomes broken in different ways. Like only some squares visible and hard to make sense of what's happening."
severity: major

### 6. Index Page Links
expected: The widget index page (index.html) has a "Standalone Map Pages" section with links to Heatmap, Pin Map, and Route Browser. Clicking each link opens the corresponding standalone page.
result: pass

### 7. Build Integration
expected: Running `npm run build-widgets` builds all widget IIFE bundles, copies data files, AND builds the three standalone pages. Console output shows the standalone page build step completing successfully.
result: pass

## Summary

total: 7
passed: 3
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "Opening heatmap.html shows a full-viewport interactive heatmap of all runs. The map fills the entire browser window with no scrollbars, margins, or padding."
  status: failed
  reason: "User reported: The map is not loading properly. It's like partially loaded, I have tried waiting and refreshing but I believe there is a bigger issue. It's always partially loaded in the same way. Zooming in and out doesn't fix anything and seems to extend the map well beyond the viewport but hard to tell what's happening since only some random squares are visible."
  severity: major
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Opening pinmap.html shows a full-viewport pin map with city/country pins. The map fills the entire browser window."
  status: failed
  reason: "User reported: Can't see pins, map loaded in similar broken manner as before."
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Opening routes.html shows a full-viewport route browser. The layout fills the entire browser window."
  status: failed
  reason: "User reported: Map is broken, only certain squares visible and not always contiguous. Zooming makes it seemingly larger in width. Map does not take the whole height, but only the top third."
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "On all three standalone pages, the map fills 100% of the viewport height and width."
  status: failed
  reason: "User reported: On all three standalone pages the whole width is occupied but only around the top third of the full height. Map is broken and resizing window's impact hard to gather since the broken map just becomes broken in different ways."
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
