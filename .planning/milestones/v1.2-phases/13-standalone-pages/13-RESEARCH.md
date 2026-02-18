# Phase 13: Standalone Pages - Research

**Researched:** 2026-02-17
**Domain:** Multi-page application architecture with Web Components
**Confidence:** HIGH

## Summary

Phase 13 creates full-page versions of map visualizations (heatmap, pin map, route browser) for dedicated viewing while maintaining code reuse with existing widgets. The core technical challenge is building standalone HTML pages that instantiate the same Web Components used for embedding, without duplicating widget code.

This is fundamentally different from embedded widgets. Embedded widgets are constrained by host page styles and sizing, while standalone pages have full viewport control, navigation, and dedicated URLs. The project already has the foundation: widgets are Shadow DOM Web Components with complete encapsulation, making them inherently reusable.

**Primary recommendation:** Use Vite's multi-page app configuration with multiple HTML entry points. Create standalone HTML pages that load the same widget IIFE bundles already deployed to GitHub Pages. Apply full-viewport CSS layouts with modern viewport units (dvh/svh) for mobile-friendly full-screen maps. Add simple navigation structure for page discovery.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAGE-01 | User can view heatmap as a full standalone page | Vite multi-page build + full-viewport layout patterns + widget reuse architecture |
| PAGE-02 | User can view pin map as a full standalone page | Same architecture as PAGE-01 |
| PAGE-03 | User can view route browser as a full standalone page | Same architecture as PAGE-01 |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | 7.3.1 | Multi-page build tool | Already in use, native multi-page support via rollupOptions.input |
| Web Components | Native | Widget instantiation | Already architected with Shadow DOM, no framework needed |
| CSS Viewport Units | dvh/svh | Full-viewport layouts | Modern standard for mobile-friendly full-height layouts |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Leaflet | 1.9.4 | Map rendering | Already externalized via CDN for map widgets |
| GitHub Pages | N/A | Static hosting | Already configured for widget deployment |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vite multi-page | SPA with client-side routing | SPA adds complexity (router lib, code splitting) for simple 3-page site; multi-page is simpler |
| Widget reuse | Duplicate widget code in page bundles | Violates DRY, increases maintenance; widgets already designed for reuse |
| dvh/svh units | 100vh | 100vh causes mobile browser UI overflow; dvh/svh handle dynamic address bars |
| Static navigation | Jekyll with _data/navigation.yml | Jekyll adds build complexity; static nav sufficient for 3 pages |

**Installation:**

No new dependencies required. All tools already in package.json.

## Architecture Patterns

### Recommended Project Structure

```
dist/widgets/                    # GitHub Pages deploy target
├── index.html                   # Widget library landing page (existing)
├── heatmap.html                 # NEW: Standalone heatmap page
├── pinmap.html                  # NEW: Standalone pin map page
├── routes.html                  # NEW: Standalone route browser page
├── heatmap-widget.iife.js       # Existing widget bundle
├── pin-map-widget.iife.js       # Existing widget bundle
├── route-browser.iife.js        # Existing widget bundle
└── data/                        # Existing data files

src/pages/                       # NEW: Standalone page templates
├── heatmap.html                 # Source for heatmap page
├── pinmap.html                  # Source for pin map page
└── routes.html                  # Source for route browser page
```

### Pattern 1: Multi-Page Vite Configuration

**What:** Configure Vite to build multiple HTML entry points that output to dist/widgets/
**When to use:** When you need multiple standalone pages without SPA complexity
**Example:**

```typescript
// vite.config.pages.ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist/widgets',
    emptyDir: false, // Don't clear widgets when building pages
    rollupOptions: {
      input: {
        heatmap: resolve(__dirname, 'src/pages/heatmap.html'),
        pinmap: resolve(__dirname, 'src/pages/pinmap.html'),
        routes: resolve(__dirname, 'src/pages/routes.html')
      }
    }
  }
});
```

**Source:** [Building for Production | Vite](https://vite.dev/guide/build), [Vite Multiple Entries Guide](https://www.restack.io/p/vite-answer-multiple-entries-guide)

### Pattern 2: Widget Reuse via IIFE Bundle Loading

**What:** Standalone pages load pre-built widget IIFE bundles from same dist directory, instantiating Web Components without code duplication
**When to use:** When widgets are already packaged as Shadow DOM Web Components with IIFE format
**Example:**

```html
<!-- src/pages/heatmap.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Running Heatmap</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      height: 100dvh; /* Dynamic viewport height for mobile */
      overflow: hidden;
    }
    heatmap-widget {
      display: block;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <heatmap-widget
    data-url="./data/heatmap/all-points.json"
    data-height="100%">
  </heatmap-widget>
  <script src="./heatmap-widget.iife.js"></script>
</body>
</html>
```

**Source:** Widget architecture from existing codebase (src/widgets/shared/widget-base.ts), [Web Components - Reusable HTML](https://schneide.blog/2024/02/21/web-components-reusable-html-without-any-framework-magic-part-1/)

### Pattern 3: Full-Viewport Map Layout

**What:** CSS layout that fills entire viewport without scroll, handling mobile browser UI (address bars)
**When to use:** Full-page map applications where map should occupy entire screen
**Example:**

```css
html, body {
  margin: 0;
  padding: 0;
  height: 100dvh;  /* Dynamic viewport height - adapts to mobile UI */
  overflow: hidden; /* Prevent scroll */
}

.map-container {
  width: 100%;
  height: 100%;
}

/* Fallback for browsers without dvh support */
@supports not (height: 100dvh) {
  html, body {
    height: 100vh;
  }
}
```

**Source:** [The large, small, and dynamic viewport units | web.dev](https://web.dev/blog/viewport-units), [Modern CSS Viewport Units: svh, lvh, dvh](https://kiyaanix.com/modern-css-viewport-units-svh-lvh-dvh-a-game-changer-for-responsive-design/)

### Pattern 4: Simple Navigation Structure

**What:** Static navigation links between standalone pages without requiring SPA router
**When to use:** Small number of pages (3-5) with no complex routing needs
**Example:**

```html
<nav style="position: absolute; top: 10px; left: 10px; z-index: 1000;">
  <a href="index.html">Widgets</a> |
  <a href="heatmap.html">Heatmap</a> |
  <a href="pinmap.html">Pin Map</a> |
  <a href="routes.html">Routes</a>
</nav>
```

**Source:** [How to Create a Multi-page Website using Github Pages](https://phuston.github.io/patrickandfrantonarethebestninjas/howto), existing codebase patterns

### Anti-Patterns to Avoid

- **Duplicating widget code in page bundles:** Widgets are already encapsulated Web Components. Load IIFE bundles, don't rebuild widgets for pages
- **Using 100vh for full-height maps:** Mobile browser address bars cause overflow. Use dvh (dynamic viewport height) or svh (small viewport height)
- **Rebuilding widgets during page build:** Build widgets first, then build pages that reference pre-built bundles
- **Complex SPA routing for 3 pages:** Multi-page approach is simpler, faster, and more maintainable for small page count

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-page builds | Custom HTML concatenation scripts | Vite rollupOptions.input | Vite handles asset linking, minification, hashing natively |
| Component instantiation | Custom widget loaders | Web Components customElements.define | Already implemented in WidgetBase.register() |
| Mobile viewport handling | JavaScript-based resize listeners | CSS dvh/svh units | Native browser support, zero JS overhead, handles dynamic UI |
| Navigation | Client-side router library | Static HTML links | Overkill for 3 pages; adds bundle size and complexity |

**Key insight:** The project already has all the primitives needed. Widgets are Shadow DOM Web Components designed for reuse. Vite natively supports multi-page builds. The challenge is orchestration, not new functionality.

## Common Pitfalls

### Pitfall 1: Clearing Widget Bundles During Page Build

**What goes wrong:** Vite's default emptyDir: true clears dist/widgets/ before building pages, deleting widget bundles
**Why it happens:** Vite assumes single build target; doesn't expect multiple build configs targeting same output directory
**How to avoid:** Set emptyDir: false in page build config OR build pages and widgets in separate steps with different output dirs
**Warning signs:** Widget bundles missing after running page build; 404 errors when pages try to load widget scripts

### Pitfall 2: Mobile Browser UI Overflow with 100vh

**What goes wrong:** Maps sized to 100vh get cut off by mobile browser address bar; content scrolls unexpectedly
**Why it happens:** 100vh includes space occupied by browser UI (address bar, bottom nav), but actual visible viewport is smaller
**How to avoid:** Use dvh (dynamic viewport height) or svh (small viewport height) instead of 100vh
**Warning signs:** Map controls hidden on mobile; unexpected scrolling; layout shifts when address bar appears/disappears

### Pitfall 3: Widget Attribute Inheritance Issues

**What goes wrong:** Standalone page passes wrong data URLs or attributes; widget doesn't render correctly
**Why it happens:** Widget attributes (data-url, data-height) designed for embedded context; standalone needs different values
**How to avoid:** Test widgets in both embedded and standalone contexts; use relative paths (./data/) that work in both
**Warning signs:** Widget shows "Loading..." indefinitely; 404 errors for data files; incorrect sizing

### Pitfall 4: Leaflet CDN Mismatch with Widget Bundle

**What goes wrong:** Page loads different Leaflet version than widget expects; map rendering breaks
**Why it happens:** Widget bundles externalize Leaflet expecting specific version; page loads different CDN version
**How to avoid:** Hardcode same Leaflet CDN version in pages that widgets use (1.9.4); document this dependency
**Warning signs:** "L is undefined" errors; map tiles don't load; marker icons broken

### Pitfall 5: GitHub Pages Routing Confusion

**What goes wrong:** Users navigate to /heatmap expecting page to work, but GitHub Pages serves 404
**Why it happens:** GitHub Pages serves heatmap.html at /heatmap.html, not /heatmap; directory routing requires index.html
**How to avoid:** Link to pages with .html extension OR create subdirectories with index.html files
**Warning signs:** Direct URL access fails but index links work; inconsistent routing behavior

## Code Examples

Verified patterns from official sources and existing codebase:

### Standalone Page Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Running Heatmap - Strava Analytics</title>

  <!-- Leaflet CDN (must match widget bundle expectation) -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      height: 100dvh; /* Dynamic viewport height */
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Fallback for older browsers */
    @supports not (height: 100dvh) {
      html, body { height: 100vh; }
    }

    nav {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 1000;
      background: white;
      padding: 8px 12px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }

    nav a {
      margin: 0 8px;
      color: #333;
      text-decoration: none;
      font-weight: 500;
    }

    nav a:hover { color: #fc4c02; }

    heatmap-widget {
      display: block;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <nav>
    <a href="index.html">Widgets</a>
    <a href="heatmap.html" style="color: #fc4c02;">Heatmap</a>
    <a href="pinmap.html">Pin Map</a>
    <a href="routes.html">Routes</a>
  </nav>

  <heatmap-widget
    data-url="./data/heatmap/all-points.json"
    data-height="100%">
  </heatmap-widget>

  <!-- Load widget bundle -->
  <script src="./heatmap-widget.iife.js"></script>
</body>
</html>
```

Source: Composite from Vite docs, viewport unit patterns, existing widget architecture

### Vite Configuration for Pages

```typescript
// vite.config.pages.ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist/widgets',
    emptyDir: false, // CRITICAL: Don't delete widget bundles
    rollupOptions: {
      input: {
        heatmap: resolve(__dirname, 'src/pages/heatmap.html'),
        pinmap: resolve(__dirname, 'src/pages/pinmap.html'),
        routes: resolve(__dirname, 'src/pages/routes.html')
      }
    },
    target: 'es2020',
    minify: 'terser'
  }
});
```

Source: [Vite Multi-Page App](https://vite.dev/guide/build), existing vite.config.ts patterns

### Build Script Integration

```javascript
// In scripts/build-all.mjs or package.json
{
  "scripts": {
    "build-widgets": "node scripts/build-widgets.mjs",
    "build-pages": "vite build --config vite.config.pages.ts",
    "build-all": "npm run build-widgets && npm run build-pages"
  }
}
```

Source: Existing build-widgets.mjs pattern

### Widget Instantiation Pattern (No Changes Required)

```typescript
// Existing pattern in src/widgets/heatmap-widget/index.ts
// No changes needed - widgets already support standalone usage

class HeatmapWidgetElement extends WidgetBase {
  // Widget implementation...
}

// Register custom element (already implemented)
WidgetBase.register('heatmap-widget', HeatmapWidgetElement);
```

Source: Existing src/widgets/shared/widget-base.ts

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full-height: 100vh | 100dvh/svh units | CSS spec 2022, wide support 2024+ | Mobile browsers handle dynamic UI without JavaScript |
| SPA for all multi-page apps | Multi-page for simple sites | Trend shift ~2023 | Simpler architecture, faster initial load, better SEO for static content |
| iframe embedding | Web Components | HTML5 spec, mature 2020+ | Better parent integration, no height/styling issues |
| Manual asset management | Vite multi-entry | Vite 2.0+ native support | Build tool handles asset linking, hashing, minification |

**Deprecated/outdated:**

- **100vh for full-viewport layouts:** Mobile browser overflow issues. Use dvh (dynamic) or svh (small) viewport units instead
- **SPA routers for simple multi-page sites:** React Router, Vue Router add unnecessary complexity for static pages; use multi-page Vite builds
- **iframe widget embedding:** Web Components provide better isolation without iframe limitations (height detection, styling, CORS)

## Open Questions

1. **Navigation placement and design**
   - What we know: Simple nav links between pages work; can use absolute positioning
   - What's unclear: Best UX for navigation (always visible vs. hamburger menu vs. controls integrated with widget controls)
   - Recommendation: Start with simple always-visible nav in top-left; iterate based on user feedback

2. **Page URLs and routing**
   - What we know: GitHub Pages serves heatmap.html at /heatmap.html; directory routing requires index.html
   - What's unclear: Whether to use .html extension in links or create subdirectories (/heatmap/index.html)
   - Recommendation: Use .html extensions for simplicity; matches existing index.html pattern

3. **Widget attribute defaults for standalone context**
   - What we know: Widgets accept data-url, data-height attributes; standalone needs different values than embedded
   - What's unclear: Whether to create separate default configs for standalone vs. embedded contexts
   - Recommendation: Use explicit attributes in standalone pages; keep widget defaults for embedded context

## Sources

### Primary (HIGH confidence)

- [Vite - Building for Production](https://vite.dev/guide/build) - Multi-page app configuration
- [Vite Multiple Entries Guide](https://www.restack.io/p/vite-answer-multiple-entries-guide) - rollupOptions.input patterns
- [web.dev - Viewport Units](https://web.dev/blog/viewport-units) - dvh/svh for mobile browsers
- [Modern CSS Viewport Units](https://kiyaanix.com/modern-css-viewport-units-svh-lvh-dvh-a-game-changer-for-responsive-design/) - Dynamic viewport height usage
- Existing codebase - src/widgets/shared/widget-base.ts (Web Component architecture), scripts/build-widgets.mjs (build patterns)

### Secondary (MEDIUM confidence)

- [Web Components - Reusable HTML](https://schneide.blog/2024/02/21/web-components-reusable-html-without-any-framework-magic-part-1/) - Component reuse patterns
- [Widget Registry: Reusable Interactive Content](https://www.lullabot.com/articles/widget-registry-how-serve-reusable-interactive-content-pieces) - Widget design philosophy
- [Stop Embedding Like It's 1999: Web Components vs iframes](https://www.luzmo.com/blog/iframe-vs-web-component) - Embedding approaches
- [Leaflet Full Screen Map](https://gist.github.com/d3noob/7654694) - Full-viewport map patterns
- [GitHub Pages Multi-page Sites](https://phuston.github.io/patrickandfrantonarethebestninjas/howto) - Navigation and routing

### Tertiary (LOW confidence)

None required - domain well-covered by primary and secondary sources.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All tools already in use (Vite, Web Components, Leaflet), no new dependencies
- Architecture: HIGH - Multi-page Vite pattern well-documented, widget reuse verified in existing codebase
- Pitfalls: HIGH - Mobile viewport issues (dvh vs 100vh) extensively documented, build order dependencies clear

**Research date:** 2026-02-17
**Valid until:** 60 days (stable domain - Web Components, Vite, CSS specs slow-changing)
