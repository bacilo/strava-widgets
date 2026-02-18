# Phase 10: Geocoding Foundation & Map Infrastructure - Research

**Researched:** 2026-02-16
**Domain:** Offline geocoding migration, Leaflet mapping, polyline processing, Shadow DOM integration
**Confidence:** MEDIUM-HIGH

## Summary

Phase 10 establishes the technical foundation for interactive maps (Phase 11-13) by migrating from offline-geocode-city (UN/LOCODE data) to offline-geocoder (GeoNames cities1000 dataset) for accurate city-level geocoding, and integrating Leaflet 1.9.4 for map rendering in Shadow DOM widgets. The phase also introduces polyline decoding (@mapbox/polyline) to enable multi-city tracking by sampling route coordinates.

**Critical architectural constraint**: This is a breaking change phase. The geocoding library migration invalidates the existing location cache (114 entries) and may change city names for ~10-20% of activities (e.g., "Gif-sur-Yvette" → "Paris"). Existing geographic widgets (geo-table-widget, geo-stats-widget) must continue functioning with the new data schema (GEO-04 requirement). Migration requires full cache rebuild with versioning to enable old vs new comparison (GEO-03 requirement).

**Key technical challenges**:
1. Leaflet CSS injection into Shadow DOM (marker icons break with default Vite bundling)
2. Bundle size management (Leaflet adds ~150KB, requiring CDN externalization to prevent 500KB+ widgets)
3. Mobile event handling in Shadow DOM (iOS Safari touch events fail with Leaflet)
4. Geocoding data model evolution (single-city → multi-city per activity)
5. Polyline decoding performance (1,808 routes must not block UI thread)

**Primary recommendation:** Treat Phase 10 as a foundational migration, not a feature delivery phase. Focus on data model correctness, widget backward compatibility, and infrastructure setup (Leaflet + Shadow DOM patterns) before building new map widgets in Phase 11-13.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| offline-geocoder | ^1.0.2 | GeoNames-based offline reverse geocoding (REPLACES offline-geocode-city) | Uses GeoNames cities1000 dataset (12 MB SQLite), accurate city names vs suburbs. Node.js build-time only (not bundled in widgets). ~20,000 cities worldwide, population ≥1,000. Maintained, TypeScript types. |
| Leaflet | ^1.9.4 | Interactive maps, route visualization, marker-based maps | Industry standard for DOM-based mapping. Lightweight (~40 KB gzipped), zero npm dependencies, extensive plugin ecosystem. Works with Vite IIFE bundles and Shadow DOM with CSS injection workaround. |
| @mapbox/polyline | ^1.2.1 | Decode Strava summary_polyline to lat/lng coordinates | Most popular polyline library (270K+ weekly downloads). Actively maintained. Decodes to [[lat, lng], ...] format compatible with Leaflet. Handles Google polyline encoding (precision 1e5 ≈ 1.1m). |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-plugin-css-injected-by-js | ^3.5.1 | Inject Leaflet CSS into IIFE bundle | **REQUIRED** for IIFE format. Bundles CSS with JavaScript so widgets are single-file embeddable. Automatically injects Leaflet styles at runtime. Fixes Vite marker icon path hashing issues. |
| @types/leaflet | ^1.9.14 | TypeScript type definitions for Leaflet | Development-time type safety for Leaflet API usage in widgets. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| offline-geocoder (GeoNames) | offline-geocode-city (UN/LOCODE) | Current library returns suburbs instead of cities. GeoNames dataset more accurate. Migration required but worth it for correct city names. |
| offline-geocoder | local-reverse-geocoder | Requires 2 GB download, 1.3 GB disk space, 20 MB bundle. Overkill for city-level accuracy. offline-geocoder is 12 MB SQLite. |
| Leaflet | MapLibre GL JS | Bundle size: MapLibre 800 KB vs Leaflet 40 KB gzipped (~20x difference). WebGL overkill for route polylines and point heatmaps. Vite IIFE + Shadow DOM complexity higher. |
| @mapbox/polyline | @googlemaps/polyline-codec | Google library inactive (no npm updates 12+ months). Mapbox library has 10x weekly downloads, active maintenance. |
| vite-plugin-css-injected-by-js | vite-plugin-shadow-style | Generic CSS injection works for global styles. Leaflet requires specific marker icon path fixes. Existing project pattern uses css-injected-by-js. |

**Installation:**
```bash
# Geocoding (build-time, Node.js only)
npm install offline-geocoder@^1.0.2

# Mapping (widget runtime dependencies)
npm install leaflet@^1.9.4

# Polyline decoding (build-time, Node.js only)
npm install @mapbox/polyline@^1.2.1

# Dev dependencies (types + build tooling)
npm install -D @types/leaflet@^1.9.14
npm install -D vite-plugin-css-injected-by-js@^3.5.1

# REMOVE (after migration complete)
npm uninstall offline-geocode-city
```

## Architecture Patterns

### Recommended Project Structure

```
data/geo/
├── location-cache.json         # MODIFIED: Add version field, GeoNames data
├── cities.json                 # MODIFIED: May have different city names
├── countries.json              # MODIFIED: May have different aggregations
├── geo-metadata.json           # MODIFIED: Add geocoder version info
└── v1/                         # NEW: Archived old geocoding results
    ├── location-cache.json     # Backup of offline-geocode-city results
    ├── cities.json
    └── countries.json

src/geo/
├── geocoder.ts                 # MODIFIED: Wrap offline-geocoder instead
├── cache-manager.ts            # MODIFIED: Add version field handling
├── compute-geo-stats.ts        # MODIFIED: Use new geocoder API
└── polyline-decoder.ts         # NEW: Decode summary_polyline to coords

src/widgets/
├── geo-stats-widget/           # EXISTING: Must work with new data
├── geo-table-widget/           # EXISTING: Must work with new data
└── (map widgets in Phase 11-13)

scripts/
└── build-widgets.mjs           # READY: No changes needed for Phase 10
```

### Pattern 1: Geocoding Library Migration with Versioning

**What:** Replace offline-geocode-city with offline-geocoder while preserving old data for comparison (GEO-03 requirement) and ensuring widgets continue working (GEO-04 requirement).

**When to use:** Any time a core data source changes and backward compatibility is critical.

**Example:**

```typescript
// src/geo/geocoder.ts (MODIFIED for offline-geocoder)
import geocoder from 'offline-geocoder';
import type { StravaActivity } from '../types/strava.types.js';

// Initialize geocoder with GeoNames cities1000 dataset
const geo = geocoder({ citiesFileType: 'cities1000' });

export interface GeoLocation {
  cityName: string;
  countryName: string;
  countryIso2: string;
}

export interface GeoCache {
  version: number;           // NEW: Track geocoder version
  geocoder: string;          // NEW: "geonames-cities1000" or "un-locode"
  entries: {
    [coordKey: string]: GeoLocation;
  };
}

/**
 * Geocode activity using offline-geocoder (GeoNames data)
 *
 * Migration note: Returns city names, not suburbs (vs offline-geocode-city)
 */
export function geocodeActivity(
  activity: StravaActivity,
  cache: GeoCache
): GeoLocation | null {
  // Guard: Missing or invalid GPS data
  if (!activity.start_latlng || activity.start_latlng.length !== 2) {
    return null;
  }

  const [lat, lng] = activity.start_latlng;

  // Guard: Validate coordinate ranges
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  // Check cache
  const cacheKey = coordToCacheKey(lat, lng);
  if (cache.entries[cacheKey]) {
    return cache.entries[cacheKey];
  }

  // Reverse geocode using offline-geocoder
  const results = geo.search(lat, lng);

  // Guard: No results (ocean coordinates, etc.)
  if (!results || results.length === 0) {
    return null;
  }

  const result = results[0];

  // Guard: Invalid result
  if (!result.name || !result.countryName) {
    return null;
  }

  // Map offline-geocoder result to GeoLocation
  const location: GeoLocation = {
    cityName: result.name,           // GeoNames city name
    countryName: result.countryName,
    countryIso2: result.countryCode, // offline-geocoder uses 'countryCode'
  };

  // Store in cache and return
  cache.entries[cacheKey] = location;
  return location;
}

/**
 * Round coordinate to 4 decimals for cache key
 * 4 decimals ≈ 11m precision (sufficient for city-level)
 */
function roundCoord(coord: number, decimals: number = 4): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(coord * multiplier) / multiplier;
}

function coordToCacheKey(lat: number, lng: number): string {
  return `${roundCoord(lat)},${roundCoord(lng)}`;
}
```

```typescript
// src/geo/cache-manager.ts (MODIFIED for versioning)
import * as fs from 'fs/promises';
import type { GeoCache } from './geocoder.js';

const CURRENT_VERSION = 2;
const CURRENT_GEOCODER = 'geonames-cities1000';

export async function loadCache(path: string): Promise<GeoCache> {
  try {
    const content = await fs.readFile(path, 'utf-8');
    const data = JSON.parse(content);

    // Check version compatibility
    if (data.version === CURRENT_VERSION && data.geocoder === CURRENT_GEOCODER) {
      return data;
    }

    // Version mismatch — log warning and return empty cache
    console.warn(`Cache version mismatch (found: ${data.version}, expected: ${CURRENT_VERSION})`);
    console.warn(`Geocoder changed (found: ${data.geocoder}, expected: ${CURRENT_GEOCODER})`);
    console.warn('Starting fresh cache. Old cache archived at data/geo/v1/');

    return createEmptyCache();
  } catch (error) {
    // File doesn't exist on first run
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('Cache not found, starting fresh');
      return createEmptyCache();
    }
    throw error;
  }
}

export async function saveCache(path: string, cache: GeoCache): Promise<void> {
  // Ensure directory exists
  const dir = path.split('/').slice(0, -1).join('/');
  await fs.mkdir(dir, { recursive: true });

  // Write with pretty-printing for git diffs
  await fs.writeFile(path, JSON.stringify(cache, null, 2));
  console.log(`Saved ${Object.keys(cache.entries).length} cached locations (v${cache.version}, ${cache.geocoder})`);
}

function createEmptyCache(): GeoCache {
  return {
    version: CURRENT_VERSION,
    geocoder: CURRENT_GEOCODER,
    entries: {}
  };
}
```

### Pattern 2: Leaflet + Vite IIFE + Shadow DOM

**What:** Integrate Leaflet into Shadow DOM widgets as single-file IIFE bundles, with CSS automatically injected and marker icons properly bundled.

**When to use:** All map widgets (Phase 11-13) that need interactive maps in Shadow DOM.

**Example:**

```typescript
// vite.config.ts (for map widgets)
import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

export default defineConfig({
  plugins: [
    cssInjectedByJsPlugin()  // Injects CSS into IIFE bundle
  ],
  build: {
    lib: {
      entry: './src/widgets/route-map-widget/index.ts',
      name: 'RouteMapWidget',
      formats: ['iife'],
      fileName: () => 'route-map.iife.js'
    },
    rollupOptions: {
      external: ['leaflet'],  // Externalize to CDN (prevents 500KB+ bundles)
      output: {
        inlineDynamicImports: true,
        globals: {
          'leaflet': 'L'  // Assumes <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
        }
      }
    },
    target: 'es2020',
    minify: 'terser'
  }
});
```

```typescript
// src/widgets/route-map-widget/index.ts (FUTURE — Phase 11)
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { WidgetBase } from '../shared/widget-base.js';

// Import marker images directly (Vite bundles as base64 or assets)
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix default icon paths (required for Webpack/Vite bundlers)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

class RouteMapWidgetElement extends WidgetBase {
  private map: L.Map | null = null;

  connectedCallback(): void {
    super.connectedCallback(); // Sets up Shadow DOM

    // CSS automatically injected by vite-plugin-css-injected-by-js
    // Leaflet CSS now available in shadow root

    // Create map container div
    const mapContainer = document.createElement('div');
    mapContainer.id = 'map';
    mapContainer.style.width = '100%';
    mapContainer.style.height = '400px';
    this.shadowRoot!.appendChild(mapContainer);

    // Initialize Leaflet map
    this.map = L.map(mapContainer).setView([55.6761, 12.5683], 13);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Fetch and render route
    this.fetchAndRenderRoute();
  }

  async fetchAndRenderRoute(): Promise<void> {
    const activityId = this.getAttribute('data-activity-id');
    if (!activityId) return;

    // Fetch pre-decoded route (generated by polyline-decoder in Phase 10)
    const response = await fetch(`/data/routes/${activityId}.json`);
    const route = await response.json();

    // Add polyline to map
    const polyline = L.polyline(route.coordinates, {
      color: '#fc4c02',
      weight: 3,
      opacity: 0.8
    }).addTo(this.map!);

    // Fit map to route bounds
    this.map!.fitBounds(polyline.getBounds());
  }

  disconnectedCallback(): void {
    // Clean up Leaflet map
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}

WidgetBase.register('route-map-widget', RouteMapWidgetElement);
```

### Pattern 3: Polyline Decoding (Build-time)

**What:** Pre-decode all Strava summary_polyline fields during compute-geo-stats, store decoded coordinates in JSON files for widgets to fetch at runtime (no client-side decoding).

**When to use:** Always for static site generation where build-time data prep enables zero runtime overhead.

**Example:**

```typescript
// src/geo/polyline-decoder.ts (NEW)
import polyline from '@mapbox/polyline';
import type { StravaActivity } from '../types/strava.types.js';

interface DecodedRoute {
  activityId: number;
  coordinates: [number, number][]; // [[lat, lng], ...]
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  pointCount: number;
}

/**
 * Decode Strava polyline to coordinate array
 *
 * Returns null if activity has no polyline (e.g., treadmill run)
 */
export function decodeActivityPolyline(activity: StravaActivity): DecodedRoute | null {
  if (!activity.map?.summary_polyline) {
    return null; // No route data
  }

  try {
    // @mapbox/polyline.decode() returns [[lat, lng], [lat, lng], ...]
    const coords = polyline.decode(activity.map.summary_polyline);

    if (coords.length === 0) {
      return null;
    }

    // Calculate bounds for map fitting
    const lats = coords.map(c => c[0]);
    const lngs = coords.map(c => c[1]);

    return {
      activityId: activity.id,
      coordinates: coords,
      bounds: {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs)
      },
      pointCount: coords.length
    };
  } catch (error) {
    console.error(`Failed to decode polyline for activity ${activity.id}:`, error);
    return null;
  }
}

/**
 * Sample route points for geocoding (multi-city detection)
 *
 * Strategy: Sample 1 point per ~2km to balance accuracy vs geocoding cost
 * For a 10km run → ~5 geocoding lookups instead of 100-200 polyline points
 */
export function sampleRoutePoints(
  coordinates: [number, number][],
  sampleDistanceKm: number = 2
): [number, number][] {
  if (coordinates.length <= 5) {
    return coordinates; // Short route, use all points
  }

  const samples: [number, number][] = [coordinates[0]]; // Always include start

  // Simple sampling: take every Nth point
  // For better accuracy, use haversine distance (future enhancement)
  const step = Math.max(1, Math.floor(coordinates.length / 10));

  for (let i = step; i < coordinates.length; i += step) {
    samples.push(coordinates[i]);
  }

  samples.push(coordinates[coordinates.length - 1]); // Always include end

  return samples;
}
```

### Anti-Patterns to Avoid

- **Bundling Leaflet in every widget:** Creates 500KB+ bundles. Externalize to CDN (single 40KB load shared across all map widgets).
- **Runtime polyline decoding:** Adds 5KB+ to bundle, decoding 1,808 routes blocks UI. Pre-decode at build time.
- **Runtime geocoding in widgets:** offline-geocoder has 12 MB SQLite dependency (Node.js only). Pre-geocode at build time.
- **Modifying existing geo data files in place:** Breaks widgets during migration. Create versioned files (v1/, v2/) during transition.
- **Missing version fields in cache:** Makes debugging "where did this city name come from?" impossible. Always version data sources.
- **Using OSM tiles directly from openstreetmap.org:** Rate limiting, potential domain ban. Use approved CDN (Thunderforest, Mapbox free tier, Stamen).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reverse geocoding | Custom coordinate → city lookup with CSV databases | `offline-geocoder` | GeoNames dataset has 20,000+ cities with correct names. S2 cell hierarchy handles edge cases (coastlines, borders, sparse regions). Maintained library with TypeScript types. |
| Polyline encoding/decoding | Custom implementation of Google polyline algorithm | `@mapbox/polyline` | Handles precision factors, edge cases (wraparound at ±180°), GeoJSON conversion. 270K+ weekly downloads, battle-tested. |
| Leaflet CSS injection in Shadow DOM | Manual CSS string extraction and injection | `vite-plugin-css-injected-by-js` | Handles asset path rewriting, CSP compliance, automatic injection. Integrates with Vite build pipeline. |
| Map tile caching | Custom service worker for tile storage | Leaflet's built-in cache + CDN edge caching | Leaflet automatically caches tiles. CDN edge servers provide faster global distribution. Browser cache handles offline access. |

**Key insight:** Geocoding, polyline encoding, and mapping are solved problems with mature libraries. Custom solutions miss edge cases (ocean coordinates, antimeridian wrapping, projection distortions, cache invalidation) and lack community maintenance.

## Common Pitfalls

### Pitfall 1: Geocoding Library Migration Breaks Existing Location Cache

**What goes wrong:** Switching from offline-geocode-city to offline-geocoder invalidates all 114 cached locations. Cities change names (Roskilde → "Roskilde Kommune", Alcochete → "Montijo"). Countries.json and cities.json suddenly show different cities for same activities, breaking continuity. Historical stats become incomparable. Widgets display conflicting data.

**Why it happens:** Different geocoding libraries use different datasets (UN/LOCODE vs GeoNames) with different city name conventions, administrative boundaries, and granularity levels. Cache keys are coordinate-based, but values change when library changes. Offline-geocode-city returns suburb names, GeoNames returns proper cities, causing systematic inconsistencies.

**How to avoid:**
1. **Version the cache** — add `version` and `geocoder` fields to location-cache.json, bump on library change
2. **Archive old data** — copy existing cache to `data/geo/v1/` before migration (enables GEO-03 comparison)
3. **Full cache rebuild** — don't merge old cache with new library, regenerate from scratch
4. **Parallel validation** — run both libraries on same coordinates, document differences before migration
5. **Document breaking changes** — update README with "Geographic data regenerated 2026-02-16 with improved accuracy"

**Warning signs:** City names change suddenly in widgets, activity counts don't match historical data, cache hit rates drop below 85%, "Roskilde" split into "Roskilde" and "Roskilde Kommune".

### Pitfall 2: Leaflet CSS Not Loading in Shadow DOM

**What goes wrong:** Map tiles render outside their container boundaries, zoom controls appear broken or non-functional, map interface looks completely broken with overlapping UI elements. Map container might be invisible or tiles display in random positions on the page.

**Why it happens:** Shadow DOM creates an encapsulated style boundary. External stylesheets (including Leaflet's CSS loaded via `<link>` in document head) cannot penetrate Shadow DOM boundaries. Leaflet's default assumption is that its CSS is globally available. Developers coming from standard DOM forget that Shadow DOM isolates styles completely.

**How to avoid:**
1. Use `vite-plugin-css-injected-by-js` to bundle CSS with JavaScript (IIFE widgets)
2. Import Leaflet CSS in widget: `import 'leaflet/dist/leaflet.css';`
3. Plugin automatically injects CSS into shadow root before map initialization
4. Verify CSS is present: `shadowRoot.querySelector('style')` should contain `.leaflet-container` rules

**Warning signs:** Map tiles visible but controls missing, console errors about missing CSS classes, elements positioned at page (0,0) instead of container-relative, working in regular DOM but broken in Shadow DOM.

### Pitfall 3: Leaflet Event Handling Broken on Mobile in Shadow DOM

**What goes wrong:** Touch events (zoom, pan, tap) don't work on iOS Safari/Chrome or Android Chrome. Click handlers aren't triggered on markers. Gesture controls fail silently. Map appears to load correctly but is completely unresponsive to user interaction on mobile devices, while desktop browsers work fine.

**Why it happens:** Shadow DOM's event retargeting changes `event.target` from the actual DOM element (like zoom controls) to the custom element containing the shadow root. Leaflet's event listeners expect specific DOM elements as targets. On mobile browsers (especially iOS), touch event handling is more strict about event propagation through shadow boundaries. This is a known Leaflet limitation documented in GitHub issues #3752, #6705.

**How to avoid:**
1. **Test on real mobile devices** (iOS Safari, Android Chrome) in Phase 10, not just desktop Chrome DevTools mobile emulation
2. Consider using `leaflet-map` web component wrapper (handles Shadow DOM compatibility)
3. If events fail, implement manual event delegation: attach listeners to shadow root and use `event.composedPath()` to find actual targets
4. For critical mobile support, consider rendering maps outside Shadow DOM in a connected light DOM container

**Warning signs:** Events work in Chrome desktop but fail on iOS Safari, touch events work outside shadow root but not inside, console shows event listeners attached but never firing, map pans with mouse but not with touch.

### Pitfall 4: IIFE Bundle Size Explosion with Leaflet

**What goes wrong:** Widget bundle size jumps from ~180KB (current Chart.js widgets) to 500KB-800KB+ with Leaflet. GitHub Pages has a soft 1MB file limit and loading delays increase significantly. Multiple map widgets on a page each load duplicate copies of Leaflet because IIFE bundles don't share dependencies. A page with 3 map widgets = 1.5-2.4MB of JavaScript.

**Why it happens:** Leaflet core is ~150KB minified + gzipped, but tile layer plugins, marker clustering, and utilities add up quickly. Vite's IIFE format bundles ALL dependencies into a single file with no sharing between widgets. Current Vite config sets `inlineDynamicImports: true` and `external: []`, meaning Leaflet cannot be externalized. Chart.js widgets already bundle Chart.js (181KB), so adding Leaflet compounds the problem.

**How to avoid:**
1. **Externalize Leaflet** — load from CDN as global, exclude from widget bundles:
   ```typescript
   // vite.config.ts
   rollupOptions: {
     external: ['leaflet'],
     output: {
       globals: { 'leaflet': 'L' }
     }
   }
   ```
   Load globally: `<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>`
2. **Split map widgets from chart widgets** — don't mix Leaflet and Chart.js in same bundle
3. **Measure bundle sizes** — add rollup-plugin-visualizer to see what's inflating bundles

**Warning signs:** Widget builds suddenly >500KB, GitHub Pages deployment warnings about large files, slow page loads on mobile/3G connections, duplicate code visible in bundle analyzer.

### Pitfall 5: Tile Provider Rate Limiting and Attribution Requirements

**What goes wrong:** Map tiles fail to load after 10-20 page views, showing gray squares instead of maps. OpenStreetMap blocks requests from GitHub Pages domain. Missing attribution (© OpenStreetMap contributors) violates tile provider terms of service, risking domain ban. Users report "maps not working" intermittently.

**Why it happens:** Free tile providers (OpenStreetMap, OpenTopoMap) have rate limits (typically 300 requests/minute per IP, varies by provider). Static GitHub Pages sites can't implement server-side rate limiting or caching. Every page load requests 10-50 tiles (depending on zoom level and viewport), so 10 users = 500+ requests. Missing attribution text violates OSM's usage policy, which requires visible credit on every map.

**How to avoid:**
1. **Use approved tile CDN** — OSM tile usage policy recommends third-party providers for web apps:
   - Thunderforest (free tier: 150k requests/month with attribution)
   - Mapbox (free tier: 50k requests/month, requires account)
   - Stamen (free with attribution)
2. **Always include attribution** — Leaflet automatically adds attribution if set:
   ```typescript
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
     attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
   })
   ```
3. **Lazy load tiles** — don't initialize maps until widget is in viewport
4. **Fallback providers** — implement tile layer switcher for redundancy

**Warning signs:** Gray tiles or 403 errors in network tab, "Tile request failed" console errors, maps load fine locally but fail in production, email from tile provider about ToS violation.

## Code Examples

Verified patterns from official sources and ecosystem best practices:

### Basic Reverse Geocoding (offline-geocoder)

```typescript
// Source: https://www.npmjs.com/package/offline-geocoder
// Source: https://github.com/lucaspiller/offline-geocoder
import geocoder from 'offline-geocoder';

// Initialize with cities1000 dataset (default)
const geo = geocoder({ citiesFileType: 'cities1000' });

// Reverse geocode coordinates
const results = geo.search(55.6761, 12.5683); // Copenhagen coordinates

// Returns array of results (closest first):
// [
//   {
//     name: 'Copenhagen',
//     countryName: 'Denmark',
//     countryCode: 'DK',
//     population: 1153615,
//     latitude: 55.67594,
//     longitude: 12.56553
//   }
// ]

// Handle no results (ocean, poles)
if (!results || results.length === 0) {
  console.warn('No city found for coordinates');
}
```

### Polyline Decoding (@mapbox/polyline)

```typescript
// Source: https://www.npmjs.com/package/@mapbox/polyline
// Source: https://github.com/mapbox/polyline
import polyline from '@mapbox/polyline';

// Decode Strava polyline (precision 1e5)
const encoded = 'c{~rIkvnkA_@b@YlA{@?a@Rg@W...'; // Strava summary_polyline
const coords = polyline.decode(encoded);

// Returns: [[55.6761, 12.5683], [55.6762, 12.5684], ...]
// Format: [[lat, lng], ...] — directly usable in Leaflet

// Encode coordinates back to polyline
const reencoded = polyline.encode(coords);

// Convert to GeoJSON LineString
const geojson = polyline.toGeoJSON(encoded);
// Returns: { type: 'LineString', coordinates: [[lng, lat], ...] }
```

### Leaflet Marker Icon Fix for Vite

```typescript
// Source: https://github.com/Leaflet/Leaflet/issues/7424
// Source: https://docs.maptiler.com/leaflet/examples/vite-vanilla-js-default/
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix Vite/Webpack bundler breaking default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Now markers display correctly:
const marker = L.marker([55.6761, 12.5683]).addTo(map);
```

### Leaflet Map in Shadow DOM with CSS Injection

```typescript
// Source: Project's existing Shadow DOM widget pattern
// Source: https://www.npmjs.com/package/vite-plugin-css-injected-by-js
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // CSS bundled by vite-plugin-css-injected-by-js

class MapWidget extends HTMLElement {
  private shadowRoot: ShadowRoot;
  private map: L.Map | null = null;

  constructor() {
    super();
    this.shadowRoot = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // Create map container
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '400px';
    this.shadowRoot.appendChild(container);

    // Initialize Leaflet map
    this.map = L.map(container).setView([55.6761, 12.5683], 13);

    // Add tile layer with attribution
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);
  }

  disconnectedCallback() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}

customElements.define('map-widget', MapWidget);
```

## State of the Art

| Old Approach | Current Approach (2026) | When Changed | Impact |
|--------------|-------------------------|--------------|--------|
| offline-geocode-city (UN/LOCODE) | offline-geocoder (GeoNames cities1000) | 2026 (this phase) | Accurate city names vs suburbs. GeoNames dataset has 20,000+ cities worldwide. |
| Runtime polyline decoding in widgets | Build-time pre-decoding to JSON | SSG era (2018+) | Zero client-side overhead, faster page loads, no bundle size penalty for decoding library. |
| Leaflet with manual CSS imports | vite-plugin-css-injected-by-js | 2020+ | Automatic CSS bundling in IIFE format, fixes Vite asset path hashing, single-file widgets. |
| Bundling all dependencies in IIFE | Externalizing large libraries to CDN | 2015+ | Bundle size reduction (500KB → 50KB per widget). Shared dependencies across widgets. |
| Using OSM tiles directly | Third-party tile CDNs (Thunderforest, Mapbox) | 2018+ | Rate limiting compliance, ToS adherence, better global edge distribution. |

**Deprecated/outdated:**
- **offline-geocode-city (UN/LOCODE data):** Being replaced in this phase. Returns suburbs instead of cities (Paris → Gif-sur-Yvette). GeoNames dataset more accurate.
- **@googlemaps/polyline-codec:** Inactive maintenance (no npm updates 12+ months). Use @mapbox/polyline instead (270K+ weekly downloads, active maintenance).
- **Mapbox GL JS v2+:** Proprietary license after v1.13 (Dec 2020). Use Leaflet or MapLibre GL JS (OSS fork of Mapbox GL v1.13) instead.

## Open Questions

1. **Should we sample polyline points for multi-city detection or geocode all points?**
   - What we know: summary_polyline has 100-200+ points per run. Geocoding all points is slow (200 lookups per activity).
   - What's unclear: Optimal sampling strategy (every Nth point? every 2km? start/end only?).
   - Recommendation: Start with start/end only for Phase 10 (GEO-02 basic implementation). Add sampling in future enhancement if needed (GEO-05 advanced: proportional distance attribution).

2. **Should we externalize Leaflet to CDN or bundle it?**
   - What we know: Bundling = 500KB+ widgets. Externalizing = ~50KB widgets but requires global Leaflet load on pages.
   - What's unclear: User preference for deployment (single-file vs multi-file).
   - Recommendation: Externalize to CDN. Document requirement in widget README: "Pages using map widgets must include `<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>`". Trade-off justified by 10x bundle size reduction.

3. **How to handle mobile touch events in Shadow DOM?**
   - What we know: Leaflet has known issues with Shadow DOM on iOS (GitHub issue #6705). Desktop works, mobile fails.
   - What's unclear: Whether workaround (leaflet-map web component, manual event delegation) is sufficient or if we need to abandon Shadow DOM for map widgets.
   - Recommendation: Test Phase 10 infrastructure on real iOS device. If unfixable, architectural decision required: render maps outside Shadow DOM (light DOM container) or use leaflet-map wrapper. This is a blocking question for Phase 11.

4. **Should we keep old geocoded data for historical comparison?**
   - What we know: GEO-03 requires user to verify geocoding accuracy via comparison.
   - What's unclear: How to present comparison UI (side-by-side tables? diff view? JSON export?).
   - Recommendation: Archive old data to `data/geo/v1/`. Create simple comparison script: `npm run compare-geocoding` that outputs diff report (city name changes, new cities, removed cities). This satisfies GEO-03 without building full UI.

## Sources

### Primary (HIGH confidence)
- [offline-geocoder npm](https://www.npmjs.com/package/offline-geocoder) - Library features, GeoNames cities1000 dataset, API usage
- [offline-geocoder GitHub](https://github.com/lucaspiller/offline-geocoder) - Implementation details, SQLite database structure
- [Leaflet 1.9.4 Documentation](https://leafletjs.com/reference.html) - API reference, map initialization, tile layers
- [@mapbox/polyline npm](https://www.npmjs.com/package/@mapbox/polyline) - Polyline encoding/decoding, GeoJSON conversion
- [@mapbox/polyline GitHub](https://github.com/mapbox/polyline) - Implementation, precision handling
- [Leaflet Shadow DOM Issue #3246](https://github.com/Leaflet/Leaflet/issues/3246) - Known CSS and selector compatibility issues
- [Leaflet iOS Click Events Issue #6705](https://github.com/Leaflet/Leaflet/issues/6705) - Mobile touch event problems in Shadow DOM
- [Leaflet Marker Icon Webpack Issue #7424](https://github.com/Leaflet/Leaflet/issues/7424) - Vite/Webpack bundler breaking marker icons, official fix
- [vite-plugin-css-injected-by-js npm](https://www.npmjs.com/package/vite-plugin-css-injected-by-js) - CSS injection for IIFE bundles, configuration
- [MapTiler Leaflet Vite Guide](https://docs.maptiler.com/leaflet/examples/vite-vanilla-js-default/) - Official Vite + Leaflet integration pattern

### Secondary (MEDIUM confidence)
- [Strava Activity Map Tutorial (klauskomenda.net)](https://klauskomenda.net/blog/2020/05/23/how-to-render-a-strava-activity-map-using-mapbox-gl-js/) - Polyline decoding for Strava routes
- [Putting Strava Activities on a Single Map (Larry Hudson)](https://larryhudson.io/astro-strava-map/) - Astro + Strava + map integration patterns
- [Vite CSS Injection Issue #1579](https://github.com/vitejs/vite/issues/1579) - CSS injection in library mode discussion
- [vite-plugin-shadow-dom-css GitHub](https://github.com/web-widget/vite-plugin-shadow-dom-css) - Alternative Shadow DOM CSS injection approach

### Tertiary (LOW confidence)
- [OpenStreetMap Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) - Rate limits, attribution requirements (not version-specific, but principles valid)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries (offline-geocoder, Leaflet, @mapbox/polyline) are documented on npm, have GitHub repos, active maintenance, TypeScript types.
- Architecture: MEDIUM-HIGH - Leaflet + Shadow DOM pattern is documented but has known mobile issues (iOS touch events). Geocoding migration is standard data versioning pattern. Polyline decoding is straightforward.
- Pitfalls: HIGH - Geocoding migration pitfall verified by existing cache structure. Leaflet Shadow DOM issues documented in GitHub issues #3246, #6705. Bundle size verified by existing Chart.js widget builds (~180KB). Tile provider rate limiting is standard OSM policy.

**Research date:** 2026-02-16
**Valid until:** 2026-03-17 (30 days — stable domain, libraries are maintained but not fast-moving)
