# Pitfalls Research: Maps & Geocoding Evolution

**Domain:** Adding Interactive Maps to Existing Shadow DOM Widget System
**Researched:** 2026-02-16
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Leaflet CSS Not Loading in Shadow DOM

**What goes wrong:**
Map tiles render outside their container boundaries, zoom controls appear broken or non-functional, and the map interface looks completely broken with overlapping UI elements. The map container might be invisible or tiles display in random positions on the page.

**Why it happens:**
Shadow DOM creates an encapsulated style boundary. External stylesheets (including Leaflet's CSS loaded via `<link>` in the document head) cannot penetrate Shadow DOM boundaries. Leaflet's default assumption is that its CSS is globally available, so widgets using Shadow DOM must explicitly inject Leaflet CSS into each shadow root. Developers coming from standard DOM development forget that Shadow DOM isolates styles completely.

**How to avoid:**
1. Import Leaflet CSS as a string (import as raw text or use Vite's `?inline` query)
2. Create a `<style>` element inside the Shadow DOM during `connectedCallback()`
3. Inject the Leaflet CSS string into that style element before initializing the map
4. Verify CSS is present: `shadowRoot.querySelector('style')` should contain `.leaflet-container` rules

**Example pattern:**
```typescript
import leafletCssText from 'leaflet/dist/leaflet.css?inline';

connectedCallback() {
  const style = document.createElement('style');
  style.textContent = leafletCssText;
  this.shadowRoot.appendChild(style);

  // Now initialize Leaflet map
  this.map = L.map(this.shadowRoot.querySelector('.map-container'));
}
```

**Warning signs:**
- Map tiles visible but controls missing
- Console errors about missing CSS classes
- Elements positioned at page (0,0) instead of container-relative
- Working in regular DOM but broken in Shadow DOM

**Phase to address:**
Phase 1 (Map Infrastructure) — must be solved before any map widget will render correctly. Add to widget-base pattern documentation and create reusable CSS injection utility.

---

### Pitfall 2: Leaflet Event Handling Broken on Mobile in Shadow DOM

**What goes wrong:**
Touch events (zoom, pan, tap) don't work on iOS Safari/Chrome or Android Chrome. Click handlers aren't triggered on markers. Gesture controls fail silently. Map appears to load correctly but is completely unresponsive to user interaction on mobile devices, while desktop browsers work fine.

**Why it happens:**
Shadow DOM's event retargeting changes `event.target` from the actual DOM element (like zoom controls) to the custom element containing the shadow root. Leaflet's event listeners expect specific DOM elements as targets. On mobile browsers (especially iOS), touch event handling is more strict about event propagation through shadow boundaries. This is a known Leaflet limitation documented in GitHub issues #3752 (Android Chrome zoom controls), #6705 (iOS click events).

**How to avoid:**
1. Test on real mobile devices (iOS Safari, Android Chrome) in Phase 1, not just desktop Chrome DevTools mobile emulation
2. Consider using leaflet-map web component wrapper (leaflet-extras/leaflet-map) which handles Shadow DOM compatibility
3. If events fail, implement manual event delegation: attach listeners to shadow root and use `event.composedPath()` to find actual targets
4. For critical mobile support, consider rendering maps outside Shadow DOM in a connected light DOM container

**Workaround pattern:**
```typescript
// Manual event delegation for Shadow DOM
this.shadowRoot.addEventListener('click', (e) => {
  const path = e.composedPath();
  const leafletElement = path.find(el => el.classList?.contains('leaflet-marker'));
  if (leafletElement) {
    // Handle click on marker
  }
}, { capture: true });
```

**Warning signs:**
- Events work in Chrome desktop but fail on iOS Safari
- Touch events work outside shadow root but not inside
- Console shows event listeners attached but never firing
- Map pans with mouse but not with touch

**Phase to address:**
Phase 1 (Map Infrastructure) — test and resolve before building widgets. If unsolvable, architectural decision required: render maps outside Shadow DOM or use web component wrapper.

---

### Pitfall 3: IIFE Bundle Size Explosion with Leaflet

**What goes wrong:**
Widget bundle size jumps from ~180KB (current Chart.js widgets) to 500KB-800KB+ with Leaflet. GitHub Pages has a soft 1MB file limit and loading delays increase significantly. Multiple map widgets on a page each load duplicate copies of Leaflet because IIFE bundles don't share dependencies. A page with 3 map widgets = 1.5-2.4MB of JavaScript.

**Why it happens:**
Leaflet core is ~150KB minified + gzipped, but tile layer plugins, marker clustering, and utilities add up quickly. Vite's IIFE format (`formats: ['iife']`) bundles ALL dependencies into a single file with no sharing between widgets. Current Vite config sets `inlineDynamicImports: true` and `external: []`, meaning Leaflet cannot be externalized. Chart.js widgets already bundle Chart.js (181KB bundle), so adding Leaflet compounds the problem.

**How to avoid:**
1. **Externalize Leaflet** — load Leaflet from CDN as a global, exclude from widget bundles:
   ```typescript
   // vite.config.ts
   rollupOptions: {
     external: ['leaflet'],
     output: {
       globals: { 'leaflet': 'L' }
     }
   }
   ```
   Load Leaflet globally on pages using map widgets: `<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>`

2. **Split map widgets from chart widgets** — don't mix Leaflet and Chart.js in same bundle
3. **Lazy load tile layers** — don't bundle tile layer plugins, load from CDN
4. **Use manualChunks** (if moving away from IIFE) to share Leaflet across widgets
5. **Measure bundle sizes** — add rollup-plugin-visualizer to see what's inflating bundles

**Warning signs:**
- Widget builds suddenly >500KB (check with `ls -lh dist/widgets/*.iife.js`)
- GitHub Pages deployment warnings about large files
- Slow page loads on mobile/3G connections
- Duplicate code visible in bundle analyzer

**Phase to address:**
Phase 1 (Map Infrastructure) — configure before building first map widget. Update build scripts to externalize Leaflet, document CDN requirement for pages using map widgets. This is an architectural decision that affects all map widgets.

---

### Pitfall 4: Polyline Decoding Performance Collapse at Scale

**What goes wrong:**
Decoding 1,808 polylines blocks the browser UI thread for 5-10+ seconds. Page becomes unresponsive during processing. Heatmap widget times out or crashes. Memory usage spikes to 500MB+ as decoded coordinates (arrays of [lat, lng]) accumulate. Browsers show "Page Unresponsive" warnings.

**Why it happens:**
Strava's polyline encoding compresses routes efficiently (summary_polyline is ~200 chars), but decoding expands to hundreds/thousands of coordinate pairs per route. Decoding is CPU-intensive (loops over each character, bit shifting). Synchronous decoding of 1,808 polylines on the main thread locks up the UI. Each decoded route is a large array kept in memory (1,808 routes × 200 coords × 2 numbers × 8 bytes = ~5.8MB minimum, more with object overhead).

**How to avoid:**
1. **Decode on-demand** — don't decode all 1,808 routes upfront. For heatmap, decode only routes currently in viewport bounds
2. **Use Web Workers** — decode polylines in background thread:
   ```typescript
   const worker = new Worker('polyline-worker.js');
   worker.postMessage({ polylines: chunk });
   worker.onmessage = (e) => { renderRoutes(e.data.decoded); };
   ```
3. **Batch processing** — decode in chunks of 50-100 routes with `requestIdleCallback()` between batches
4. **Use efficient library** — @mapbox/polyline is well-optimized (600 bytes minified). Avoid regex-heavy implementations
5. **Cache decoded results** — decode once, store in IndexedDB for session reuse
6. **Limit route display** — heatmap widget should default to "last 100 routes" with opt-in for full dataset

**Performance targets:**
- Single route decode: <1ms
- 100 routes batch: <50ms
- Full 1,808 routes: <2 seconds (with Web Worker, chunked)

**Warning signs:**
- Browser "Page Unresponsive" dialogs
- DevTools Performance tab shows long tasks (>50ms)
- Memory profiler shows large array allocations
- Widget initialization takes >3 seconds

**Phase to address:**
Phase 2 (Polyline Processing) — before building heatmap widget. Implement chunked/async decoding infrastructure, benchmark with full dataset, set performance budgets. Add Web Worker if synchronous approach exceeds budgets.

---

### Pitfall 5: Geocoding Library Migration Breaks Existing Location Cache

**What goes wrong:**
Switching from offline-geocode-city to GeoNames-based solution invalidates all 114 cached locations. Cities change names (Roskilde → "Roskilde Kommune", Alcochete → "Montijo"). Countries.json and cities.json suddenly show different cities for same activities, breaking continuity. Historical stats become incomparable ("Where did Stockholm go?"). Widgets display conflicting data (old vs new geocoding).

**Why it happens:**
Different geocoding libraries use different datasets (UN/LOCODE vs GeoNames) with different city name conventions, administrative boundaries, and granularity levels. Cache keys are coordinate-based (`"55.6415,12.0803"`), but values change when library changes. Offline-geocode-city returns suburb names, GeoNames returns proper cities, causing systematic inconsistencies. Cache was built incrementally over time, so partial migration creates mixed-source data.

**How to avoid:**
1. **Version the cache** — add `version` field to location-cache.json, bump on library change:
   ```json
   {
     "version": 2,
     "geocoder": "geonames-cities1000",
     "entries": { ... }
   }
   ```
2. **Parallel validation** — run both libraries on same coordinates, compare differences before migration
3. **Full cache rebuild** — don't merge old cache with new library, regenerate from scratch
4. **Staged rollout** — keep old geocoded data files as `countries-v1.json`, generate `countries-v2.json`, compare before switching
5. **Document breaking changes** — update documentation to note "Geographic data regenerated on [date] with improved accuracy"
6. **Coordinate precision unchanged** — keep 4 decimal places (11m precision) to preserve cache hit rates

**Migration checklist:**
- [ ] Back up current location-cache.json, countries.json, cities.json
- [ ] Run new geocoder on all 1,808 activities, generate new cache
- [ ] Compare old vs new (expect ~10-20% differences, document major changes)
- [ ] Commit new cache with version bump and changelog entry
- [ ] Update CI to use new geocoder configuration
- [ ] Archive old files as `data/geo/v1/` for reference

**Warning signs:**
- City names change suddenly in widgets
- "Roskilde" split into "Roskilde" and "Roskilde Kommune"
- Activity counts don't match historical data
- Cache hit rates drop below 85%

**Phase to address:**
Phase 0 (Planning/Research Validation) — assess migration impact before Phase 1. Compare offline-geocode-city vs GeoNames outputs, quantify differences, decide if accuracy improvement justifies breaking change. Execute full migration in Phase 1 before building new features on top.

---

### Pitfall 6: Multi-City Data Model Breaking Existing Single-City Aggregations

**What goes wrong:**
Existing countries.json format assumes `cities: string[]` (one city per activity). New multi-city model needs `cities: Array<{name, activityCount, distance}>` (activities can span multiple cities). Old stats computation breaks with "Cannot read property 'activityCount' of string" errors. Widgets expecting `cities[0]` get objects instead of strings. Geographic table sorting fails because data types changed.

**Why it happens:**
Original model simplified to one city per activity (activity start location). Multi-city tracking requires decoding full route polyline and geocoding all points, so a single activity can contribute to multiple cities. This is a breaking schema change from `string[]` to `Array<CityStats>`. JSON lacks schema enforcement, so runtime errors appear when old code meets new data structure.

**How to avoid:**
1. **Create new data files** — don't modify countries.json/cities.json, create countries-detailed.json with new schema:
   ```json
   {
     "countries": [...], // old format
     "countriesDetailed": [
       {
         "countryName": "Denmark",
         "cities": [
           { "name": "Roskilde", "activityCount": 1320, "distanceKm": 16162.8 },
           { "name": "Sorø", "activityCount": 45, "distanceKm": 412.3 }
         ]
       }
     ]
   }
   ```
2. **Versioned endpoints** — widgets load `/data/geo/v2/countries.json` for new model, v1 still available
3. **Backward-compatible writers** — stats computation writes both formats during transition
4. **TypeScript interfaces** — define strict types for both formats to catch mismatches at compile time
5. **Runtime validation** — check data shape before processing: `if (typeof cities[0] === 'string')` handle old format

**Migration strategy:**
- **Phase 1:** Keep existing single-city model, improve geocoding accuracy within same schema
- **Phase 2:** Add multi-city as NEW data source (cities-multi.json), don't modify existing files
- **Phase 3:** Build new widgets consuming multi-city data, old widgets unchanged
- **Future:** Deprecate v1 files after 6 months, migrate all widgets to v2

**Warning signs:**
- TypeScript errors: `Type 'string' is not assignable to type 'CityStats'`
- Runtime errors: `cities.map is not a function`
- Widget rendering blank because data format unrecognized
- Sort functions breaking on mixed string/object arrays

**Phase to address:**
Phase 2 (Multi-City Data Model) — design new schema BEFORE touching existing data structures. Write migration plan, implement parallel data generation, validate both formats coexist. Do not replace existing files until all widgets migrated.

---

### Pitfall 7: Tile Provider Rate Limiting and Attribution Requirements

**What goes wrong:**
Map tiles fail to load after 10-20 page views, showing gray squares instead of maps. OpenStreetMap blocks requests from GitHub Pages domain. Missing attribution (© OpenStreetMap contributors) violates tile provider terms of service, risking domain ban. Users report "maps not working" intermittently.

**Why it happens:**
Free tile providers (OpenStreetMap, OpenTopoMap) have rate limits (typically 300 requests/minute per IP, varies by provider). Static GitHub Pages sites can't implement server-side rate limiting or caching. Every page load requests 10-50 tiles (depending on zoom level and viewport), so 10 users = 500+ requests. Missing attribution text violates OSM's usage policy, which requires visible credit on every map.

**How to avoid:**
1. **Use approved tile CDN** — OSM tile usage policy recommends third-party providers for web apps:
   - Thunderforest (free tier: 150k requests/month with attribution)
   - Mapbox (free tier: 50k requests/month, requires account)
   - Stamen (free with attribution)
2. **Implement tile caching** — use Leaflet's built-in cache, set `maxAge` header hints
3. **Always include attribution** — Leaflet automatically adds attribution if set:
   ```typescript
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
     attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
   })
   ```
4. **Lazy load tiles** — don't initialize maps until widget is in viewport
5. **Monitor usage** — log tile requests if using paid tier to detect quota exhaustion
6. **Fallback providers** — implement tile layer switcher for redundancy

**Attribution requirements checklist:**
- [ ] Attribution visible on all map widgets
- [ ] Attribution includes provider name and link to copyright info
- [ ] Attribution persists when map is zoomed/panned
- [ ] Screenshot functionality captures attribution text

**Warning signs:**
- Gray tiles or 403 errors in network tab
- "Tile request failed" console errors
- Maps load fine locally but fail in production
- Email from tile provider about ToS violation

**Phase to address:**
Phase 1 (Map Infrastructure) — configure tile provider and attribution before any widget goes live. Document tile provider selection criteria and fallback strategy. Add attribution to base map configuration.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Bundle Leaflet in every widget | No external dependencies, works standalone | 500KB+ per widget, 2MB+ for multi-widget pages | Never — externalize to CDN |
| Decode all polylines synchronously | Simpler code, no async complexity | UI freezes for 5-10 seconds, "Page Unresponsive" warnings | Only for single-route widgets (<10 routes) |
| Keep old geocoded data without versioning | No migration needed upfront | Data inconsistency, impossible to track geocoder changes | Never — always version cache from day 1 |
| Use OSM tiles directly from openstreetmap.org | Free, no signup required | Rate limiting, potential domain ban | Only for local development, never production |
| Shadow DOM with Leaflet but no mobile testing | Works on desktop, ships faster | Broken mobile UX discovered by users | Never — mobile is 50%+ of traffic |
| Modify existing countries.json schema in place | Single data file, no migration | Breaks all existing widgets, risky deployment | Never — always add new versioned files |
| Import Leaflet CSS globally instead of per-widget | Less code duplication | Defeats Shadow DOM isolation, style leakage risks | Acceptable if NOT using Shadow DOM |
| Cache polyline decoding in memory only | Fast repeat access | Lost on page refresh, rebuilds every session | OK for MVP, add IndexedDB in Phase 2+ |

---

## Integration Gotchas

Common mistakes when integrating maps and geocoding services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Leaflet + Shadow DOM | Expecting global CSS to work | Inject Leaflet CSS into each shadow root as string |
| Leaflet + Shadow DOM (mobile) | Testing only in desktop Chrome DevTools | Test on real iOS Safari and Android Chrome devices |
| Leaflet + Vite IIFE | Including Leaflet in bundle with `external: []` | Externalize Leaflet, load from CDN as global `L` |
| Polyline decoding | Decoding all 1,808 routes in `connectedCallback()` | Decode on-demand or in Web Worker with chunking |
| Geocoding migration | Replacing library and merging old cache | Version cache, full rebuild, parallel validation |
| Multi-city model | Modifying existing JSON schema | Create new versioned data files, keep old format |
| OSM tiles | Using tile.openstreetmap.org directly | Use approved tile provider (Thunderforest, Mapbox, Stamen) |
| Tile attribution | Adding attribution as separate div | Use Leaflet's built-in attribution control |
| Map initialization | Creating map before container is in DOM | Wait for `connectedCallback()`, ensure container has dimensions |
| Tile caching | Expecting browser cache to persist across sessions | Implement IndexedDB tile cache for offline support |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous polyline decoding | Blocking UI thread | Use Web Workers or chunked decoding with `requestIdleCallback()` | >200 routes (>1 second delay) |
| Heatmap rendering all routes at once | Browser freezes, 500MB+ memory | Viewport culling, decode only visible routes, limit default to 100 routes | >500 routes |
| No tile caching strategy | Slow page loads, rate limit errors | Configure Leaflet maxAge, consider IndexedDB for offline tile cache | >50 page views/hour |
| Leaflet bundled per widget | Page load 2-3MB for 3 widgets | Externalize Leaflet to shared CDN script | >2 map widgets per page |
| Geocoding all activities on every CI run | 10+ minute builds, high memory use | Cache location lookups, incremental geocoding only new activities | >1000 activities |
| In-memory decoded polylines cache | High memory usage, cache lost on refresh | Use IndexedDB for persistent cache, LRU eviction policy | >500 cached routes |
| Rendering 1,000+ markers directly | Map unresponsive, 60fps → 10fps | Use marker clustering plugin (Leaflet.markercluster) | >200 markers visible |
| No bundle size monitoring | Unnoticed bundle bloat to 1MB+ | Add rollup-plugin-visualizer, set CI alerts at 500KB | Any widget >250KB |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Embedding API keys in widget bundles | Key exposure in public JavaScript, quota theft | Use server-side geocoding in CI, never in browser code |
| Loading tiles from HTTP instead of HTTPS | Mixed content warnings, blocked on HTTPS pages | Always use HTTPS tile URLs |
| User-supplied coordinates without validation | SSRF via crafted tile requests, XSS via marker content | Validate lat/lng ranges, sanitize marker HTML |
| Exposing full activity data including GPS | Privacy violation, Strava OAuth scope overreach | Limit widget data to aggregated stats, no raw GPS |
| No CSP headers for tile providers | XSS via compromised tile CDN | Add CSP: `img-src https://cdn.tile-provider.com` |
| Geocoding user input without rate limiting | DoS via geocoding quota exhaustion | Rate limit in CI, never expose geocoding API to client |

---

## UX Pitfalls

Common user experience mistakes in map widgets.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Map loads blank (no error message) | User thinks widget is broken | Show loading spinner, error message if tiles fail |
| Heatmap decodes all routes on load | 10-second page freeze, "Page Unresponsive" | Show loading progress, decode incrementally, render in batches |
| No mobile touch support | Map unusable on phones (50%+ traffic) | Test on real devices, implement Shadow DOM event delegation |
| Tiny map in widget (200px × 150px) | Can't see routes, tiles illegible | Minimum 400px × 300px, responsive sizing via container queries |
| Map starts zoomed out to world view | User has to manually zoom to see activity | Auto-fit bounds to route/heatmap extent |
| Attribution hidden or illegible | Legal violation, user doesn't know data source | Always visible in bottom-right, sufficient contrast |
| Route colors all identical | Can't distinguish individual routes in heatmap | Color by date (gradient from old→new) or activity type |
| No loading indicator for polyline decoding | User clicks widget, nothing happens for 5 seconds | Show "Loading 1,808 routes..." with progress bar |
| Geocoding errors treated as hard failures | Widget crashes if one city lookup fails | Graceful degradation, show "X of Y activities geocoded" |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Map Widget:** Often missing attribution text — verify "© OpenStreetMap contributors" visible in bottom-right corner
- [ ] **Map Widget:** Often missing mobile touch event support — verify pan/zoom works on iOS Safari, not just desktop Chrome
- [ ] **Map Widget:** Often missing error handling for tile load failures — verify gray tiles show "Map tiles unavailable" message
- [ ] **Leaflet Integration:** Often missing CSS injection into Shadow DOM — verify map displays correctly in custom element, not just standalone page
- [ ] **Polyline Decoding:** Often missing performance optimization — verify 1,808 routes decode without UI freeze (use DevTools Performance tab)
- [ ] **Geocoding Migration:** Often missing cache versioning — verify location-cache.json has `version` field and geocoder name
- [ ] **Multi-City Data:** Often missing backward compatibility — verify old widgets still work with new data structure
- [ ] **Bundle Size:** Often missing externalization check — verify Leaflet NOT bundled in IIFE (inspect with rollup-plugin-visualizer)
- [ ] **Tile Provider:** Often missing usage policy compliance — verify using approved CDN, not openstreetmap.org directly
- [ ] **Cache Invalidation:** Often missing strategy for geocoder changes — verify migration plan exists for switching geocoding libraries
- [ ] **Mobile Testing:** Often skipped real device testing — verify widgets work on actual iOS/Android devices, not just emulators
- [ ] **Rate Limiting:** Often missing monitoring for tile provider quotas — verify usage tracking if on paid/limited tier

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Leaflet CSS missing in Shadow DOM | LOW | Import CSS as string, inject into shadow root, redeploy |
| Mobile events broken | MEDIUM | Add manual event delegation or switch to leaflet-map web component, requires code refactor |
| Bundle size >500KB | MEDIUM | Externalize Leaflet to CDN, update Vite config, document CDN requirement for widget consumers |
| Polyline decoding blocks UI | LOW | Add `requestIdleCallback()` chunking or move to Web Worker, 1-2 hour refactor |
| Geocoding cache invalidated | LOW | Regenerate cache from scratch (10 minutes), commit new cache, redeploy |
| Multi-city model breaks widgets | HIGH | Roll back data changes, implement versioned data files, migrate widgets one-by-one |
| Tile rate limiting | LOW | Switch tile provider in config, add attribution, redeploy |
| Map unresponsive on mobile | HIGH | Render maps outside Shadow DOM or use web component wrapper, architectural change |
| Heatmap out of memory | MEDIUM | Implement viewport culling, limit default routes, add pagination controls |
| Bundle leaked API key | CRITICAL | Rotate keys immediately, remove from bundle, implement server-side geocoding |
| Missing attribution | MEDIUM | Add attribution control to all maps, redeploy, document in checklist |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Leaflet CSS missing in Shadow DOM | Phase 1 (Map Infrastructure) | Map renders correctly in custom element with zoom controls visible |
| Mobile event handling broken | Phase 1 (Map Infrastructure) | Test passes on iOS Safari and Android Chrome physical devices |
| IIFE bundle size explosion | Phase 1 (Map Infrastructure) | All map widget bundles <100KB when Leaflet externalized |
| Polyline decoding performance | Phase 2 (Polyline Processing) | 1,808 routes decode in <2 seconds without blocking UI thread |
| Geocoding library migration | Phase 0/1 (Planning/Geocoding Fix) | New cache versioned, old data archived, comparison documented |
| Multi-city data model breakage | Phase 2 (Multi-City Model) | Old widgets load v1 data, new widgets load v2, both work simultaneously |
| Tile provider rate limiting | Phase 1 (Map Infrastructure) | Approved tile CDN configured, attribution visible, usage monitored |
| Mobile touch events | Phase 1 (Map Infrastructure) | Manual event delegation implemented if needed, tested on real devices |
| Heatmap memory overflow | Phase 3 (Heatmap Widget) | Viewport culling active, default 100 routes, memory stays <200MB |
| No tile attribution | Phase 1 (Map Infrastructure) | Attribution control visible on all map widgets |
| Bundle size monitoring | Phase 1 (Map Infrastructure) | CI fails if any widget >250KB, rollup-plugin-visualizer in CI |
| Geocoding cache versioning | Phase 1 (Geocoding Fix) | Cache includes version field, migration plan documented |

---

## Sources

### Primary Sources (HIGH confidence)
- [Problems using Leaflet inside Shadow DOM · Issue #3246](https://github.com/Leaflet/Leaflet/issues/3246) — CSS injection solution for Shadow DOM
- [Zoom controls broken in Shadow DOM on mobile Chrome · Issue #3752](https://github.com/Leaflet/Leaflet/issues/3752) — Android touch event issues
- [Click events don't work in the shadow DOM on iOS · Issue #6705](https://github.com/Leaflet/Leaflet/issues/6705) — iOS Safari event handling
- [Vite Build Options](https://vite.dev/config/build-options) — External dependencies, rollup configuration
- [Library mode: How should I manage external dependencies? · Discussion #6198](https://github.com/vitejs/vite/discussions/6198) — Vite externalization patterns
- [@mapbox/polyline GitHub](https://github.com/mapbox/polyline) — Polyline encoding/decoding library
- [Polyline Decoder Guide 2025](https://nextbillion.ai/blog/polyline-encoder-decoder-tool-guide-2025) — Performance optimization strategies
- [Leaflet Provider Demo](https://leaflet-extras.github.io/leaflet-providers/preview/) — Tile provider options and attribution requirements
- [5 Caching Strategies for Large-Scale Geospatial Data](https://www.maplibrary.org/11469/5-caching-strategies-for-large-scale-geospatial-data/) — Cache invalidation strategies
- [Evolutionary Database Design](https://martinfowler.com/articles/evodb.html) — Schema migration best practices

### Secondary Sources (MEDIUM confidence)
- [leaflet-extras/leaflet-map GitHub](https://github.com/leaflet-extras/leaflet-map) — Web component wrapper for Leaflet
- [Drawing Thousands of Polylines via Google Maps API V3](https://spin.atomicobject.com/2020/12/02/multiple-polylines-google-maps-api/) — Performance benchmarks for large polyline datasets
- [offline-geocoder npm](https://www.npmjs.com/package/offline-geocoder) — GeoNames-based geocoding alternatives
- [GeoNames: The only terrible choice we have](https://tonyshowoff.com/articles/geonames-the-only-terrible-choice-we-have/) — GeoNames data quality issues
- [Advanced Data Structures in JSON: Nested Objects & Arrays](https://blog.liquid-technologies.com/advanced-data-structures-in-json-part-3-of-4) — JSON schema evolution patterns
- [Common Challenges in Schema Migration](https://medium.com/@adamf_64691/common-challenges-in-schema-migration-how-to-overcome-them-49ae26859c96) — Data model migration strategies
- [8 Ways to Optimize Your JavaScript Bundle Size](https://about.codecov.io/blog/8-ways-to-optimize-your-javascript-bundle-size/) — Bundle optimization techniques

### Tertiary Sources (LOW confidence - needs validation)
- Static tile server on GitHub Pages (madefor/static-tile-server) — mentioned but not verified for production use
- Exact mobile browser event handling quirks — based on GitHub issues but versions may have changed
- Specific bundle size thresholds (500KB, 200 routes) — estimated from research, should be validated with actual measurements in Phase 1

---

*Pitfalls research for: Strava Analytics Maps & Geocoding Evolution Milestone*
*Researched: 2026-02-16*
*Confidence: HIGH (based on official Leaflet issues, Vite documentation, established Shadow DOM patterns)*
