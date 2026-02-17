---
phase: 13-standalone-pages
plan: 01
subsystem: standalone-pages
tags: [pages, vite, build, navigation, full-viewport]
dependency_graph:
  requires:
    - heatmap-widget (IIFE bundle)
    - pin-map-widget (IIFE bundle)
    - route-browser (IIFE bundle)
    - Leaflet CDN (external)
  provides:
    - Standalone HTML pages (heatmap.html, pinmap.html, routes.html)
    - Multi-page Vite build config
    - Navigation bar component
  affects:
    - build-widgets.mjs (added page build step)
    - dist/widgets/index.html (added navigation links)
tech_stack:
  added:
    - vite.config.pages.ts (multi-page build)
  patterns:
    - Full-viewport layout (100dvh with vh fallback)
    - Absolute positioned navigation overlay
    - CDN-based dependencies (Leaflet, leaflet.heat)
    - Widget attribute-based customization (data-max-width, data-padding)
key_files:
  created:
    - src/pages/heatmap.html
    - src/pages/pinmap.html
    - src/pages/routes.html
    - vite.config.pages.ts
  modified:
    - scripts/build-widgets.mjs
    - dist/widgets/index.html
decisions:
  - decision: "Use Vite multi-page build with root: 'src/pages' for clean output paths"
    rationale: "Avoids nested src/pages/ structure in output, pages go directly to dist/widgets/"
  - decision: "Load IIFE bundles via script src (not bundled) in standalone pages"
    rationale: "Zero code duplication - pages are pure HTML referencing existing widget builds"
  - decision: "Use data-max-width='none' and data-padding='0' to override WidgetBase defaults"
    rationale: "WidgetBase has 800px max-width and 20px padding for embeds, full pages need 100% width"
  - decision: "Include leaflet.heat CDN only on heatmap page"
    rationale: "Only heatmap widget needs it - other widgets bundle dependencies or use Leaflet alone"
  - decision: "Navigation bar absolutely positioned (not fixed)"
    rationale: "Prevents covering map controls, overlay approach maintains full-viewport map experience"
metrics:
  duration: 175s
  tasks_completed: 2
  files_created: 4
  files_modified: 2
  commits: 2
  completed_date: 2026-02-17
---

# Phase 13 Plan 01: Standalone Pages Summary

**One-liner:** Full-page standalone HTML templates for heatmap, pin map, and route browser widgets with navigation and full-viewport layouts.

## What Was Built

Created three standalone HTML pages that provide dedicated full-page viewing experiences for map widgets:

1. **heatmap.html** - Full-viewport density heatmap of all runs
2. **pinmap.html** - Interactive pin map of cities and countries visited
3. **routes.html** - Route browser with list and map view

Each page features:
- Full-viewport layout (100dvh with vh fallback for older browsers)
- Leaflet 1.9.4 CDN (matching widget dependencies)
- Navigation bar with links between pages and widget index
- Widget element configured for full-page display (no max-width, no padding)
- IIFE bundle loading (existing builds, zero duplication)

## Implementation Highlights

### Page Architecture

**Full-viewport CSS pattern:**
```css
html, body {
  margin: 0;
  padding: 0;
  height: 100dvh;
  overflow: hidden;
}
@supports not (height: 100dvh) {
  html, body { height: 100vh; }
}
```

**Navigation overlay:**
- Absolutely positioned (top: 12px, left: 12px, z-index: 1000)
- White background with border-radius and box-shadow
- Active page highlighted in Strava orange (#fc4c02)
- Links to: Widgets (index.html), Heatmap, Pin Map, Routes

**Widget integration:**
```html
<heatmap-widget data-height="100%" data-max-width="none" data-padding="0"></heatmap-widget>
<script src="./heatmap-widget.iife.js"></script>
```

The `data-max-width="none"` and `data-padding="0"` attributes override WidgetBase's default 800px max-width and 20px padding (designed for embedded widgets).

### Build Integration

**vite.config.pages.ts:**
```typescript
export default defineConfig({
  root: 'src/pages',  // Critical for clean output paths
  build: {
    outDir: '../../dist/widgets',
    emptyDir: false,  // Preserve widget bundles
    rollupOptions: {
      input: {
        heatmap: resolve(__dirname, 'src/pages/heatmap.html'),
        pinmap: resolve(__dirname, 'src/pages/pinmap.html'),
        routes: resolve(__dirname, 'src/pages/routes.html'),
      },
    },
  },
});
```

Setting `root: 'src/pages'` ensures pages are output directly to `dist/widgets/heatmap.html` (not `dist/widgets/src/pages/heatmap.html`).

**build-widgets.mjs integration:**
```javascript
async function buildPages() {
  console.log('\nBuilding standalone pages...');
  await build({
    root: 'src/pages',
    build: { /* ... config matches vite.config.pages.ts ... */ },
    logLevel: 'warn',
  });
  console.log('✓ Built standalone pages (heatmap.html, pinmap.html, routes.html)');
}

// Called in buildAllWidgets() after copyDataFiles()
await buildPages();
```

**Build order:**
1. Build 11 widget IIFE bundles
2. Copy data JSON files
3. Build standalone pages
4. Complete

### CDN Dependencies

**All pages load:**
- Leaflet 1.9.4 CSS and JS from unpkg

**Heatmap page additionally loads:**
- leaflet.heat 0.2.0 from unpkg (required for density heatmap)

**Pin map and routes pages:**
- No additional CDN (markercluster bundled in pin-map-widget, polyline decoder in route-browser)

### Index Page Updates

Added "Standalone Map Pages" section to dist/widgets/index.html:
- Heatmap - All runs visualized as a density heatmap
- Pin Map - Cities and countries visited with interactive pins
- Route Browser - Browse and view individual run routes

Added footer navigation links for quick access to standalone pages.

## Verification Results

**Build output verification:**
```
$ npm run build-widgets
✓ Built 11 widget IIFE bundles
✓ Copied data files (stats, geo, routes, heatmap)
✓ Built standalone pages (heatmap.html, pinmap.html, routes.html)
```

**File count verification:**
- 11 IIFE bundles: ✓ (all widgets preserved)
- 3 standalone pages: ✓ (heatmap.html, pinmap.html, routes.html)
- index.html with navigation: ✓
- Data files: ✓ (all JSON files copied)

**Page structure verification:**
- Leaflet CDN references: ✓ (1.9.4 matches widget dependency)
- Navigation bar: ✓ (4 links, active state styling)
- Full-viewport CSS: ✓ (100dvh with vh fallback)
- Widget elements: ✓ (correct tag names, full-page attributes)
- IIFE bundle references: ✓ (relative ./ paths to bundles)

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions Made

1. **Vite config root setting**: Setting `root: 'src/pages'` in Vite config produces clean output paths (heatmap.html at root of dist/widgets/, not nested in src/pages/ subdirectory).

2. **WidgetBase attribute overrides**: Using `data-max-width="none"` and `data-padding="0"` on widget elements to disable WidgetBase's default embedded widget constraints (800px max-width, 20px padding) for full-page layouts.

3. **Navigation bar positioning**: Absolutely positioned (not fixed) navigation bar overlay at top-left prevents covering Leaflet's zoom controls while maintaining full-viewport map.

4. **CDN loading pattern**: Only load leaflet.heat on heatmap page (not all pages) since other widgets either bundle dependencies (markercluster) or only need Leaflet core.

5. **Build order integration**: Added page build as final step in build-widgets.mjs (after widget bundles and data copy) to ensure IIFE bundles exist before pages reference them.

## What's Next

Phase 13-02 (if planned): Potential enhancements like URL state management, page-specific controls, or dynamic widget configuration via URL parameters.

Immediate use: Standalone pages are now deployed to GitHub Pages and accessible at:
- https://bacilo.github.io/strava-widgets/heatmap.html
- https://bacilo.github.io/strava-widgets/pinmap.html
- https://bacilo.github.io/strava-widgets/routes.html

## Files Modified

**Created:**
- src/pages/heatmap.html (59 lines) - Full-page heatmap with leaflet.heat CDN
- src/pages/pinmap.html (58 lines) - Full-page pin map
- src/pages/routes.html (58 lines) - Full-page route browser
- vite.config.pages.ts (16 lines) - Multi-page build config

**Modified:**
- scripts/build-widgets.mjs (+27 lines) - Added buildPages() function and integration
- dist/widgets/index.html (+17 lines) - Added standalone pages section and footer links

## Commits

| Task | Commit  | Description                                           |
| ---- | ------- | ----------------------------------------------------- |
| 1    | 0ffa50b | Create standalone HTML pages and Vite build config    |
| 2    | e037bf4 | Integrate page build into build script and navigation |

## Self-Check: PASSED

**Created files verification:**
```
FOUND: src/pages/heatmap.html
FOUND: src/pages/pinmap.html
FOUND: src/pages/routes.html
FOUND: vite.config.pages.ts
```

**Commit verification:**
```
FOUND: 0ffa50b
FOUND: e037bf4
```

**Build output verification:**
```
FOUND: dist/widgets/heatmap.html
FOUND: dist/widgets/pinmap.html
FOUND: dist/widgets/routes.html
FOUND: 11 IIFE bundles (*.iife.js)
```

All claims verified. Plan execution complete.
