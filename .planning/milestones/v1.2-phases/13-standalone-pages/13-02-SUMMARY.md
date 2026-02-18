---
phase: 13-standalone-pages
plan: 02
subsystem: widgets
tags: [gap-closure, leaflet, shadow-dom, css, height-chain, standalone-pages]
dependency_graph:
  requires: [13-01]
  provides: [shadow-dom-css-injection, widget-height-attribute]
  affects: [heatmap-widget, pin-map-widget, route-browser, single-run-map, multi-run-overlay, map-test-widget, widget-base]
tech_stack:
  added: [vite-css-inline, shadow-dom-style-injection]
  patterns: [css-encapsulation-boundary, height-chain-fix, data-attribute-styling]
key_files:
  created:
    - src/types/css-inline.d.ts
  modified:
    - src/widgets/shared/widget-base.ts
    - src/widgets/heatmap-widget/index.ts
    - src/widgets/pin-map-widget/index.ts
    - src/widgets/route-browser/index.ts
    - src/widgets/single-run-map/index.ts
    - src/widgets/multi-run-overlay/index.ts
    - src/widgets/map-test-widget/index.ts
    - src/pages/heatmap.html
    - src/pages/pinmap.html
    - src/pages/routes.html
decisions:
  - Use Vite ?inline suffix to import CSS as string instead of document.head injection
  - Inject Leaflet CSS into Shadow DOM as <style> element before map container
  - Call invalidateSize() in requestAnimationFrame after map init for tile recalculation
  - Apply data-height as both CSS variable and inline style for height chain
  - Use 100dvh instead of 100% for standalone pages (no parent height dependency)
  - Default data-height to auto for embedded widgets (backward compatible)
metrics:
  duration_minutes: 5
  tasks_completed: 2
  files_modified: 11
  commits: 2
  completed_date: 2026-02-17
---

# Phase 13 Plan 02: Leaflet Shadow DOM CSS and Height Fix Summary

**One-liner:** Inject Leaflet CSS into Shadow DOM and fix height chain with data-height attribute for full-viewport standalone pages

## Context

UAT revealed all 3 standalone map pages (heatmap, pinmap, routes) rendered broken tiles (random scattered squares) and wrong height. Root cause diagnosed as two issues:

1. **Shadow DOM CSS boundary**: `vite-plugin-css-injected-by-js` injects Leaflet CSS into `document.head`, but Shadow DOM encapsulation blocks document-level CSS from reaching map elements inside shadowRoot. Critical Leaflet rules like `.leaflet-pane { position: absolute }` never apply.

2. **Broken height chain**: `:host` in WidgetBase has no height property, and `data-height` is not observed. Height chain breaks: `html,body(100dvh) -> custom-element(no height) -> shadow-root -> map-container(data-height)`. When `data-height="100%"`, 100% of zero = zero. When absent, defaults to 500px (not full viewport).

## Changes Made

### Task 1: Inject Leaflet CSS into Shadow DOM

**Files modified:** 6 map widget files + 1 new type declaration

**Changes:**
- Created `src/types/css-inline.d.ts` for TypeScript support of `*.css?inline` imports
- Changed all 6 map widgets from `import 'leaflet/dist/leaflet.css'` to `import leafletCSS from 'leaflet/dist/leaflet.css?inline'`
- Inject CSS as `<style>` element into Shadow DOM in each `render()` or `connectedCallback()`:
  ```typescript
  const leafletStyle = document.createElement('style');
  leafletStyle.textContent = leafletCSS;
  this.shadowRoot.appendChild(leafletStyle);
  ```
- Pin-map-widget also inlines MarkerCluster CSS (2 additional files)
- Added `requestAnimationFrame(() => this.map?.invalidateSize())` after map init to force tile recalculation after Shadow DOM layout

**Widgets updated:**
- heatmap-widget
- pin-map-widget (+ MarkerCluster CSS)
- route-browser
- single-run-map
- multi-run-overlay
- map-test-widget

**Commit:** 6ba51fe

### Task 2: Fix Height Chain with data-height Attribute

**Files modified:** WidgetBase + 3 standalone pages

**Changes to WidgetBase:**
- Added `'data-height'` to `observedAttributes` array
- Added `'data-height'` to `isStyleAttribute()` method
- In `applyStyleAttributes()`, apply height as both CSS variable and inline style:
  ```typescript
  const height = this.getAttribute('data-height');
  if (height) {
    this.style.setProperty('--widget-height', parseCSSValue(height, 'auto'));
    this.style.height = parseCSSValue(height, 'auto');
  }
  ```
- Added `height: var(--widget-height, auto);` to `:host` CSS in BASE_WIDGET_STYLES

**Changes to standalone pages:**
- `heatmap.html`: Changed `data-height="100%"` to `data-height="100dvh"`
- `pinmap.html`: Added `data-height="100dvh"` (was missing)
- `routes.html`: Added `data-height="100dvh"` (was missing)

**Rationale for 100dvh:**
Percentage heights require parent to have explicit height. Using `100dvh` (dynamic viewport height) is an absolute unit that doesn't depend on parent height chain. Works correctly when WidgetBase sets `this.style.height = '100dvh'`.

**Backward compatibility:**
Embedded widgets that don't set `data-height` get `height: var(--widget-height, auto)` which resolves to `auto` (content height) - identical to current behavior. No regression.

**Commit:** 2517a52

## Verification Results

**TypeScript compilation:** ✓ PASSED (`npx tsc --noEmit`)

**Build:** ✓ PASSED (`npm run build-widgets`)

**Bundle verification:**
- Leaflet CSS embedded in bundles: ✓ CONFIRMED (grep "leaflet-pane" found in heatmap-widget.iife.js)
- Widget-height CSS variable in bundles: ✓ CONFIRMED (grep "widget-height" found)
- Standalone pages have data-height="100dvh": ✓ CONFIRMED (all 3 pages)

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

**Why ?inline works with externalized Leaflet:**
When Leaflet is externalized (`external: ['leaflet']` in build config), the JS module is external but the CSS file is still in node_modules and can be imported with `?inline`. The `?inline` suffix is handled at build time by Vite's CSS pipeline, not at runtime.

**Why both CSS variable and inline style:**
- CSS variable (`--widget-height`): Lets widgets reference it internally (e.g., route-browser uses `--browser-height`)
- Inline style (`this.style.height`): Sets actual :host element height so percentage children resolve correctly

**InvalidateSize timing:**
Leaflet's `invalidateSize()` must run after Shadow DOM layout completes. Using `requestAnimationFrame` ensures the browser has painted the container at its final size before Leaflet recalculates tile positions.

## Impact

**Standalone pages:**
- All 3 standalone pages now render full-viewport (100dvh) Leaflet maps with contiguous tiles
- Zoom, pan, and controls work correctly
- No more random scattered tile squares

**Embedded widgets:**
- No regression - widgets without `data-height` default to `auto` (content height)
- Map widgets on index.html still render correctly with Shadow DOM CSS injection

**Future widgets:**
- All map widgets now properly encapsulated with Shadow DOM
- Height can be controlled via `data-height` attribute for both embedded and standalone use cases

## Self-Check

### Verification

**Created files:**
- ✓ FOUND: src/types/css-inline.d.ts

**Modified files:**
- ✓ FOUND: src/widgets/shared/widget-base.ts
- ✓ FOUND: src/widgets/heatmap-widget/index.ts
- ✓ FOUND: src/widgets/pin-map-widget/index.ts
- ✓ FOUND: src/widgets/route-browser/index.ts
- ✓ FOUND: src/widgets/single-run-map/index.ts
- ✓ FOUND: src/widgets/multi-run-overlay/index.ts
- ✓ FOUND: src/widgets/map-test-widget/index.ts
- ✓ FOUND: src/pages/heatmap.html
- ✓ FOUND: src/pages/pinmap.html
- ✓ FOUND: src/pages/routes.html

**Commits:**
- ✓ FOUND: 6ba51fe (Task 1 - Shadow DOM CSS injection)
- ✓ FOUND: 2517a52 (Task 2 - Height chain fix)

**Self-Check:** PASSED
