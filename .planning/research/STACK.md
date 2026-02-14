# Technology Stack Research

**Project:** Strava Analytics & Visualization Platform - Geographic Features Milestone
**Research Date:** 2026-02-14
**Researcher:** Claude (GSD Project Researcher)
**Stack Dimension:** Additions for geographic data extraction, statistics, table widgets, and customization

---

## Executive Summary

This research focuses on **stack additions for geographic features** only. The existing stack (TypeScript, Node.js 22, Chart.js, Vite IIFE bundles, Shadow DOM, GitHub Actions) is validated and NOT changed.

**New Capabilities Needed:**
1. Reverse geocoding (GPS coords → city/country)
2. Geographic statistics computation
3. Table/list widgets (replacing chart-only widgets)
4. Widget customization system (HTML attributes)

**Key Finding:** Use **offline-geocode-city** for browser-based reverse geocoding (217 KB, zero API calls, perfect for static GitHub Pages). Native HTML tables + Web Components API for customization. **No heavy frameworks needed.**

---

## Recommended Stack Additions

### 1. Reverse Geocoding

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| offline-geocode-city | ^1.x | Offline reverse geocoding (GPS → city/country) | 217 KB gzipped, works in browser/Node.js/web workers, zero API calls (no rate limits), S2 cell-based high performance. **Perfect for static GitHub Pages deployment** where API calls are problematic. |

**Installation:**
```bash
npm install offline-geocode-city
```

**Rationale:**
- **Zero API calls**: No rate limits, no failures, no latency, works offline
- **Browser compatible**: Unlike local-reverse-geocoder (Node.js only, 2.29 GB data download)
- **Tiny bundle**: 217 KB vs 20 MB alternatives
- **City-level granularity**: Sufficient for "runs by city/country" statistics
- **Tree-shakeable**: ESM with first-class TypeScript support

**Confidence:** ✅ HIGH

**Alternative for CI batch processing:**
- **node-geocoder** ^4.x with Nominatim provider (if street-level needed)
- Requires bottleneck rate limiting (1 req/sec Nominatim policy)
- Already have bottleneck + p-retry installed
- Use ONLY in GitHub Actions, NOT in widgets

---

### 2. Table Rendering

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **None** (Native HTML tables) | - | Render table/list widgets | Consistent with existing approach (Chart.js for charts, native DOM for structure). Zero bundle overhead, full Shadow DOM control, works perfectly with IIFE bundles. |

**Rationale:**
- **Consistency**: Existing widgets use Shadow DOM + native DOM manipulation
- **Bundle size**: Zero overhead (native browser features)
- **Customization**: Full CSS control via Shadow DOM + CSS variables
- **IIFE compatible**: No framework dependency to externalize/bundle
- **Sufficient for use case**: Simple geographic stats display (city, count, distance)

**Confidence:** ✅ HIGH

**When to reconsider:**
- If need sorting, filtering, pagination, virtualization → Tabulator (adds ~50 KB)
- Current use case doesn't need these features

---

### 3. Widget Customization System

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Native Web Components API** | - | Attribute-based widget customization | Already using Shadow DOM + Web Components. `observedAttributes` + `attributeChangedCallback` provide declarative HTML attribute handling with type parsing. Zero dependencies. |

**Pattern:**
```typescript
class CustomizableWidget extends HTMLElement {
  static get observedAttributes() {
    return ['data-limit', 'data-sort', 'data-show-header', 'data-theme'];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    switch (name) {
      case 'data-limit':
        this.limit = parseInt(newValue) || 10;
        break;
      case 'data-show-header':
        this.showHeader = this.hasAttribute('data-show-header');
        break;
      case 'data-sort':
        this.sortBy = newValue || 'distance';
        break;
    }
    this.render();
  }
}
```

**Rationale:**
- **Platform standard**: Native Web Components lifecycle
- **Declarative**: HTML-first API matches web conventions
- **Type parsing**: Built-in handling for string/number/boolean
- **CSS variables**: For styling customization (existing pattern with Chart.js widgets)
- **Zero dependencies**: No library needed

**Confidence:** ✅ HIGH

---

## Supporting Libraries (Already Installed)

| Library | Current Version | Purpose | Usage for Geographic Features |
|---------|-----------------|---------|------------------------------|
| bottleneck | ^2.19.5 | Rate limiting for API calls | Use if reverse geocoding with node-geocoder in CI (1 req/sec Nominatim limit) |
| p-retry | ^7.1.1 | Retry logic with exponential backoff | Combine with bottleneck for robust API handling (if using Nominatim) |
| chart.js | ^4.5.1 | Chart rendering | **No change** - continue using for chart widgets |
| vite | ^7.3.1 | Build system | **No change** - build table widgets same as chart widgets (IIFE) |
| vitest | ^4.0.18 | Testing | **No change** - test geographic data extraction, table rendering |

**No additional dependencies needed for:**
- Table rendering (native HTML)
- Widget customization (native Web Components API)
- CSS styling (Shadow DOM + CSS variables)

---

## Installation Summary

```bash
# NEW: Reverse geocoding (geographic data extraction)
npm install offline-geocode-city

# OPTIONAL: API-based geocoding for CI batch processing only
# (Only if city-level granularity insufficient, need street-level)
npm install node-geocoder

# NO INSTALLATION NEEDED:
# - Table rendering (native HTML)
# - Widget customization (native Web Components API)
# - Rate limiting (bottleneck already installed)
# - Retry logic (p-retry already installed)
```

---

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|------------------------|
| **Reverse Geocoding (Browser)** | offline-geocode-city | local-reverse-geocoder | **NEVER** for browser use (Node.js only, ~2.29 GB GeoNames data download, requires async/csv-parse/kdt/node-fetch/unzip-stream dependencies) |
| **Reverse Geocoding (Browser)** | offline-geocode-city | Google Maps API / Geoapify | If street-level granularity needed (offline-geocode-city is city-level only). Requires API keys, rate limits, costs. |
| **Reverse Geocoding (CI)** | node-geocoder + Nominatim | OpenStreetMap API directly | node-geocoder provides consistent interface, built-in User-Agent handling (required by OSM policy), easier configuration |
| **Table Rendering** | Native HTML tables | Tabulator / Grid.js | Only if need sorting, filtering, pagination, virtualization. Adds 50-200 KB to bundle. Current use case (simple stats display) doesn't justify overhead. |
| **Table Rendering** | Native HTML tables | TanStack Table / MUI X Data Grid | React-based, incompatible with vanilla JS + IIFE bundle approach |
| **Widget Customization** | Native Web Components API | Custom parsing library | Unnecessary abstraction. Web Components API handles string/number/boolean parsing natively via `observedAttributes`. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **local-reverse-geocoder** | Node.js only (requires fs, async, csv-parse), downloads 2.29 GB GeoNames data, not browser-compatible | offline-geocode-city (217 KB, browser + Node.js, zero downloads) |
| **BigDataCloud Free API** | 10K requests/month limit, requires internet connectivity, adds latency, fails offline | offline-geocode-city (completely offline) |
| **Nominatim API in widgets** | 1 request/sec rate limit, requires internet, adds latency, single point of failure | offline-geocode-city (offline, instant) OR pre-compute in CI and cache results |
| **Vite externalizing Chart.js in IIFE** | IIFE bundles with external dependencies require global variables. Chart.js already bundled (works). Don't change. | Keep current approach (bundle Chart.js in IIFE) |
| **React table libraries** | React dependency incompatible with IIFE vanilla JS widgets | Native HTML or vanilla JS table library (Tabulator if features needed) |
| **jQuery-based table plugins** (DataTables) | Adds jQuery dependency (~90 KB), outdated approach for 2026 | Native HTML or modern vanilla JS (Grid.js, Tabulator) |

---

## Stack Patterns by Use Case

### Pattern 1: Reverse Geocoding in Widgets (Browser Runtime)

**Use offline-geocode-city:**
```typescript
import { reverseGeocode } from 'offline-geocode-city';

// At widget initialization (city-level only)
const location = reverseGeocode(
  activity.start_latlng[0],
  activity.start_latlng[1]
);
// Returns: { city: "Copenhagen", country: "Denmark" }
```

**Why:**
- Zero API calls (no rate limits, no failures, no latency)
- Works offline (GitHub Pages is static, no backend)
- Tiny bundle size (217 KB gzipped)
- Browser + Node.js compatible

**Limitations:**
- City-level granularity only (not street addresses)
- For street-level, would need API during CI batch processing

**Confidence:** ✅ HIGH

---

### Pattern 2: Reverse Geocoding During CI (Batch Processing) - OPTIONAL

**Use node-geocoder with Nominatim + bottleneck:**
```typescript
import NodeGeocoder from 'node-geocoder';
import Bottleneck from 'bottleneck';

const geocoder = NodeGeocoder({
  provider: 'openstreetmap',
  httpAdapter: 'https',
  formatter: null
});

// Nominatim rate limit: 1 req/sec
const limiter = new Bottleneck({
  minTime: 1000, // 1 request per second
  maxConcurrent: 1
});

const geocodeWithRateLimit = limiter.wrap(
  (lat: number, lng: number) => geocoder.reverse({ lat, lon: lng })
);
```

**Why:**
- Only runs during scheduled GitHub Actions (daily cron)
- Rate limiting already handled by bottleneck + p-retry (existing dependencies)
- Respects Nominatim 1 req/sec policy
- Results cached in JSON (widgets read cached data, never call API)

**When to use:**
- Batch processing 1,808 run activities during CI
- Results stored in `data/geographic-stats.json`
- Widgets read pre-computed data (no runtime geocoding)
- **ONLY if city-level insufficient** (street address needed)

**Confidence:** ⚠️ MEDIUM (likely unnecessary for "runs by city" stats)

---

### Pattern 3: Table Widget Rendering

**Use native HTML tables with Shadow DOM CSS:**
```typescript
class GeographicStatsTable extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <style>
        :host {
          --font-family: system-ui, -apple-system, sans-serif;
          --cell-padding: 0.75rem;
          --border-color: #e5e7eb;
          --header-bg: #f9fafb;
          --row-hover-bg: #f3f4f6;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--font-family);
        }

        th, td {
          padding: var(--cell-padding);
          text-align: left;
          border-bottom: 1px solid var(--border-color);
        }

        th {
          background: var(--header-bg);
          font-weight: 600;
        }

        tr:hover {
          background: var(--row-hover-bg);
        }
      </style>
      <table>
        <thead>
          <tr>
            <th>City</th>
            <th>Runs</th>
            <th>Total Distance</th>
          </tr>
        </thead>
        <tbody id="table-body"></tbody>
      </table>
    `;

    this.renderData();
  }

  renderData() {
    const tbody = this.shadowRoot.getElementById('table-body');
    // Populate table rows from data
  }
}

customElements.define('geographic-stats-table', GeographicStatsTable);
```

**Usage:**
```html
<geographic-stats-table
  data-url="/data/geographic-stats.json"
  data-limit="20"
  data-sort="distance">
</geographic-stats-table>

<style>
  geographic-stats-table {
    --primary-color: #ef4444;
    --header-bg: #fee2e2;
  }
</style>
```

**Why:**
- Consistent with existing widget pattern (Shadow DOM + IIFE)
- Zero bundle overhead (native browser features)
- CSS variables for customization (matches Chart.js widget pattern)
- Full control over rendering and styling
- No dependency management (Vite bundles nothing extra)

**Confidence:** ✅ HIGH

---

### Pattern 4: Widget Customization via HTML Attributes

**Use native Web Components API:**
```typescript
class CustomizableWidget extends HTMLElement {
  static get observedAttributes() {
    return ['data-limit', 'data-sort', 'data-show-header', 'data-theme'];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    switch (name) {
      case 'data-limit':
        // Parse number
        this.limit = parseInt(newValue) || 10;
        break;
      case 'data-show-header':
        // Parse boolean (presence = true)
        this.showHeader = this.hasAttribute('data-show-header');
        break;
      case 'data-sort':
        // String value
        this.sortBy = newValue || 'distance';
        break;
      case 'data-theme':
        // Enum validation
        this.theme = ['light', 'dark'].includes(newValue) ? newValue : 'light';
        break;
    }
    this.render();
  }
}

// Usage:
// <geographic-stats
//   data-limit="20"
//   data-sort="count"
//   data-show-header
//   data-theme="dark">
// </geographic-stats>
```

**Why:**
- Declarative HTML-first API (matches web platform conventions)
- Zero dependencies (built-in Web Components lifecycle)
- Type parsing handled natively:
  - **Boolean**: attribute presence (no value needed)
  - **Number**: `parseInt()`/`parseFloat()`
  - **String**: direct value
  - **Enum**: validation in callback
- CSS variables for styling customization (existing pattern)

**Best practices:**
- Use `data-*` prefix for custom attributes (avoids conflicts)
- Provide defaults in `attributeChangedCallback`
- Boolean attributes: check presence with `hasAttribute()`, not value
- Document expected values and types

**Confidence:** ✅ HIGH

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| offline-geocode-city@^1.x | Vite@^7.3.1, Node.js 22 | ESM tree-shakable, zero dependencies, works in Vite IIFE bundles |
| node-geocoder@^4.x | Node.js 22, bottleneck@^2.19.5 | Use with bottleneck for Nominatim rate limiting (1 req/sec) |
| bottleneck@^2.19.5 | Node.js 22, p-retry@^7.1.1 | Already installed, zero dependencies, works with async/await |
| Native Web Components | All modern browsers (2026) | Shadow DOM + Custom Elements widely supported, no polyfills needed |

---

## Integration Points

### 1. Geographic Data Extraction Flow

```
Strava API (GPS coords in activities)
  ↓
Option A (Recommended):
  Widget runtime → offline-geocode-city → city/country

Option B (If street-level needed):
  CI: node-geocoder + bottleneck (batch, 1/sec rate limit)
  → Cache: data/geographic-stats.json
  → Widget: Read cached data

  ↓
Geographic statistics computation (group by city/country)
  ↓
Display: Native HTML table in Shadow DOM
```

**Two-tier approach (if using node-geocoder):**
- **Batch (CI)**: Use node-geocoder during GitHub Actions for all activities
- **Runtime (Widget)**: Use offline-geocode-city for on-demand lookups (new data, edge cases)

**Recommended approach:**
- **Runtime only**: Use offline-geocode-city everywhere (no CI geocoding needed)
- Simpler, faster, zero API dependencies

---

### 2. Widget Bundle Size Impact

| Addition | Size (gzipped) | Cumulative |
|----------|---------------|------------|
| Existing (Chart.js + code) | ~80 KB | 80 KB |
| + offline-geocode-city | +217 KB | ~297 KB |
| + Native HTML table | +0 KB | ~297 KB |
| + Web Components customization | +0 KB | ~297 KB |

**Total widget size: ~297 KB gzipped** (acceptable for embeddable widget)

**Alternative (if using Tabulator):** ~347 KB gzipped (+50 KB for features not needed)

**Confidence:** ✅ HIGH (bundle size reasonable)

---

### 3. Vite Build Configuration

**No changes needed** - existing IIFE bundle approach works:

```typescript
// vite.config.ts (existing)
export default defineConfig({
  build: {
    lib: {
      entry: './src/widgets/geographic-stats.ts',
      name: 'GeographicStatsWidget',
      formats: ['iife'],
      fileName: () => 'geographic-stats.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true // Bundle offline-geocode-city
      }
    }
  }
});
```

**No externalization needed:**
- Bundle offline-geocode-city (small, single-purpose)
- Bundle Chart.js (existing pattern)
- Native HTML/Web Components (no bundle impact)

**Confidence:** ✅ HIGH

---

### 4. Shadow DOM CSS Customization Pattern

**Widget exposes CSS variables for customization:**

```typescript
const defaultStyles = `
  :host {
    --font-family: system-ui, -apple-system, sans-serif;
    --cell-padding: 0.75rem;
    --border-color: #e5e7eb;
    --header-bg: #f9fafb;
    --row-hover-bg: #f3f4f6;
    --primary-color: #3b82f6;
  }

  table { font-family: var(--font-family); }
  th, td { padding: var(--cell-padding); }
  /* ... */
`;
```

**Usage (external CSS overrides):**
```html
<style>
  geographic-stats {
    --primary-color: #ef4444;
    --header-bg: #fee2e2;
    --font-family: 'Inter', sans-serif;
  }
</style>

<geographic-stats
  data-url="/data/stats.json"
  data-limit="20">
</geographic-stats>
```

**Matches existing Chart.js widget pattern** (CSS variables for theming)

**Confidence:** ✅ HIGH

---

## Rate Limiting Strategy

### Nominatim API (if using node-geocoder in CI)

| Constraint | Value | Implementation |
|------------|-------|----------------|
| Rate limit | 1 request/sec | Bottleneck with `minTime: 1000` |
| Max concurrent | 1 | Bottleneck with `maxConcurrent: 1` |
| Retry on 429/500/503 | Exponential backoff | p-retry with `retries: 3` |
| User-Agent | Required | node-geocoder auto-adds from package.json |
| Batch size | 1,808 activities | ~30 minutes total (1,808 sec = 30 min) |

**CI cron schedule:** Daily at 2 AM UTC (low-traffic period)

**Confidence:** ✅ HIGH (if using node-geocoder)

---

### Offline Approach (Recommended)

Using **offline-geocode-city** eliminates rate limiting entirely:
- ✅ No API calls
- ✅ No retry logic needed
- ✅ Instant results
- ✅ No quota limits
- ✅ Works offline

**Trade-off:** City-level granularity only (sufficient for "runs by city" stats)

**Confidence:** ✅ HIGH

---

## Anti-Patterns to Avoid

### ❌ Client-side Nominatim API calls from widgets
**Why avoid:** 1 req/sec rate limit, single point of failure, latency, requires internet connectivity.
**Do instead:** Use offline-geocode-city (offline, instant) OR pre-compute in CI and cache results.

### ❌ Bundling large table libraries for simple use cases
**Why avoid:** Tabulator/Grid.js add 50-200 KB for features not needed (sorting, filtering, pagination).
**Do instead:** Native HTML tables (zero overhead, full control).

### ❌ Using React/Vue table components
**Why avoid:** Framework dependency incompatible with IIFE vanilla JS widgets.
**Do instead:** Native Web Components + vanilla JS.

### ❌ Custom attribute parsing library
**Why avoid:** Web Components API already handles attribute parsing natively.
**Do instead:** Use `observedAttributes` + `attributeChangedCallback`.

### ❌ Externalizing small dependencies in IIFE bundles
**Why avoid:** IIFE with externals requires global variables, complicates embedding.
**Do instead:** Bundle offline-geocode-city (217 KB is reasonable).

---

## Dependency Summary

### NEW Production Dependencies
```json
{
  "dependencies": {
    "offline-geocode-city": "^1.x"
  }
}
```

### OPTIONAL Production Dependencies (CI only)
```json
{
  "dependencies": {
    "node-geocoder": "^4.x"
  }
}
```

### NO CHANGES
- chart.js (continue using)
- bottleneck (already installed, use if node-geocoder needed)
- p-retry (already installed, use if node-geocoder needed)
- vite (already installed, build table widgets same as chart widgets)
- vitest (already installed, test geographic features)

**Total NEW bundle size: +217 KB gzipped** (offline-geocode-city only)

---

## Architecture Diagram (Geographic Features Addition)

```
┌─────────────────────────────────────────────────────────────┐
│  Strava API (GPS coordinates in activities)                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  OPTION A (Recommended): Widget Runtime                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ offline-geocode-city (browser)                       │  │
│  │ GPS coords → city/country                            │  │
│  │ Offline, instant, zero API calls                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  OPTION B (If street-level needed): GitHub Actions CI      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ node-geocoder + Nominatim                            │  │
│  │ bottleneck (1 req/sec rate limit)                    │  │
│  │ p-retry (exponential backoff)                        │  │
│  │ Batch process 1,808 activities (~30 min)             │  │
│  │ Write to data/geographic-stats.json                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Geographic Statistics Computation                          │
│  - Group activities by city/country                         │
│  - Aggregate: count, total distance, avg pace               │
│  - Sort by distance/count                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Table Widget (IIFE bundle)                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Shadow DOM + Native HTML table                       │  │
│  │ CSS variables for customization                      │  │
│  │ Web Components API for attributes                    │  │
│  │ <geographic-stats data-limit="20" data-sort="...">   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  GitHub Pages (CDN)                                         │
│  Serves: data/geographic-stats.json + dist/*.js             │
└─────────────────────────────────────────────────────────────┘
```

---

## Version Verification Notes

**Confidence Levels:**
- ✅ **HIGH**: Verified standard in 2026, official documentation, unlikely to change
- ⚠️ **MEDIUM**: Good choice but alternatives exist, verified via web search + community sources
- 🔴 **LOW**: Speculative, needs validation with npm registry

**Note on version currency:**
- offline-geocode-city: Verified via GitHub/npm search (217 KB size, browser support)
- node-geocoder: Verified via npm documentation (Nominatim provider support)
- Web Components API: Native browser standard (MDN verification)
- Exact version numbers: **LOW confidence** (npm registry queries blocked)

**For production use:**
1. Check npm for latest stable versions: `npm view offline-geocode-city version`
2. Review changelogs for breaking changes
3. Pin exact versions in package.json
4. Test bundle size after installation

---

## Sources

### HIGH Confidence (Official Documentation)
- [MDN Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) - Web Components API, Shadow DOM, Custom Elements
- [MDN Using Custom Elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) - observedAttributes, attributeChangedCallback
- [MDN Using Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) - Shadow DOM styling, CSS variables
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) - Rate limits (1 req/sec), User-Agent requirements
- [Vite Build Options](https://vite.dev/config/build-options) - IIFE bundling, library mode, rollupOptions
- [HTML Standard - Boolean Attributes](https://html.spec.whatwg.org/multipage/common-microsyntaxes.html) - Attribute parsing specifications

### MEDIUM Confidence (Package Documentation + Community)
- [offline-geocode-city GitHub](https://github.com/kyr0/offline-geocode-city) - 217 KB size, browser/Node.js/web worker support, S2 cell-based, city-level granularity
- [node-geocoder npm](https://www.npmjs.com/package/node-geocoder) - Nominatim provider support, User-Agent handling, reverse geocoding
- [node-geocoder Documentation](https://nchaulet.github.io/node-geocoder/) - Nominatim configuration, osmServer option
- [local-reverse-geocoder GitHub](https://github.com/tomayac/local-reverse-geocoder) - Node.js only, 2.29 GB GeoNames data, dependencies (async, csv-parse, kdt, node-fetch, unzip-stream)
- [bottleneck npm](https://www.npmjs.com/package/bottleneck) - Rate limiting patterns, reservoir, minTime, maxConcurrent
- [Open Web Components - Attributes Guide](https://open-wc.org/guides/knowledge/attributes-and-properties/) - Type parsing, property-attribute reflection
- [CSS-Tricks - Shadow DOM Styling](https://css-tricks.com/styling-in-the-shadow-dom-with-css-shadow-parts/) - CSS variables, ::part(), :host patterns

### MEDIUM Confidence (Web Search 2026)
- [Geoapify Reverse Geocoding Tutorial](https://www.geoapify.com/tutorial/reverse-geocoding-javascript-tutorial/) - API comparison, provider options
- [Tabulator](https://tabulator.info) - Vanilla JS table library features, bundle size
- [Grid.js](https://gridjs.io/) - Lightweight table alternative, TypeScript support
- [API Rate Limiting 2026 Guide](https://www.levo.ai/resources/blogs/api-rate-limiting-guide-2026) - Exponential backoff, jitter, best practices
- [Ultimate Courses - Attributes in Custom Elements](https://ultimatecourses.com/blog/using-attributes-and-properties-in-custom-elements) - observedAttributes patterns
- [JavaScript Works Hub - Web Components API](https://javascript.works-hub.com/learn/web-components-api-definition-attributes-and-props-886c0) - Attributes vs properties, type handling

### LOW Confidence (Needs Verification)
- Exact current npm versions (npm registry queries blocked)
- offline-geocode-city v1.x exact latest (assumed based on GitHub/npm search results)
- node-geocoder v4.x exact latest (assumed based on recent npm references)

---

**Research completed:** 2026-02-14
**Next step:** Create FEATURES.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md
