# Phase 11: Route Map Widgets - Research

**Researched:** 2026-02-17
**Domain:** Interactive route visualization with Leaflet, polyline rendering, widget-based list/selection UI, route data aggregation
**Confidence:** HIGH

## Summary

Phase 11 builds three interactive route visualization widgets on the map infrastructure established in Phase 10. The phase delivers ROUTE-01 through ROUTE-05 requirements: single-run map viewer, route browser with selection, multi-run overlay, auto-fit viewport, and interactive popups showing activity metadata. All widgets leverage the existing Leaflet 1.9.4 + Shadow DOM setup, @mapbox/polyline decoder, and 1,808 activities with summary_polyline data.

**Critical architectural foundation**: Phase 10 completed all map infrastructure prerequisites: Leaflet 1.9.4 externalized to CDN (global L), vite-plugin-css-injected-by-js for Shadow DOM CSS injection, @mapbox/polyline installed, marker icon path fixes for Vite, and proof-of-concept map-test-widget validating the stack. The build pattern (isMapWidget: true flag) produces <50KB widget bundles. Phase 11 extends this proven foundation with route-specific rendering.

**Key technical challenges**:
1. **Route data preparation**: 1,808 activities (7.1MB raw JSON) must be transformed into widget-optimized formats. Single-run widget needs activity metadata + polyline. Route browser needs list of all activities (sortable by date/distance). Multi-run overlay needs latest N activities with polylines. Pre-computing aggregated JSON files at build time prevents runtime processing overhead.
2. **Polyline rendering performance**: Leaflet's default SVG renderer handles dozens of polylines smoothly but may struggle with N=50+ overlays. Canvas renderer option available for performance vs. visual quality tradeoff. Polyline simplification (smoothFactor) reduces point count without visible degradation.
3. **Auto-fit viewport (fitBounds)**: Leaflet's polyline.getBounds() + map.fitBounds() API auto-zooms to show entire route. Challenge: single-point routes (treadmill runs) fail bounds calculation. Solution: Fallback to start_latlng with default zoom level.
4. **Interactive popups**: Leaflet's bindPopup() attaches HTML to polyline click events. Custom data (distance, date, pace) stored in polyline options, accessed in click handler. Popup positioning handled automatically by Leaflet.
5. **Widget state management**: Route browser needs selection state (which activity is displayed on map). Two approaches: (a) single widget with embedded map + list, or (b) two separate widgets with cross-widget communication via custom events. Option (a) simpler, better encapsulation.

**Primary recommendation**: Treat Phase 11 as three focused widgets with shared route rendering utilities. Create reusable RouteRenderer class handling polyline decode → Leaflet polyline → fitBounds → popup binding. Pre-compute three data files at build time: single-run-metadata.json (activity summary + polyline for individual runs), route-list.json (sortable activity list for browser), latest-runs.json (N most recent activities with polylines for overlay). Build in order: single-run (simplest, validates RouteRenderer), multi-run overlay (tests performance with N polylines), route browser (adds selection UI complexity).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROUTE-01 | User can view an interactive map of a single run's route with zoom/pan | Leaflet map.setView() + L.polyline() + fitBounds() API. Phase 10 map-test-widget proves Shadow DOM integration works. Polyline decoded via @mapbox/polyline already installed. |
| ROUTE-02 | User can browse and select runs to view their routes on a map | Web Components support click event listeners (addEventListener). Pattern: sortable list (like geo-table-widget pagination/sorting) + embedded map. Selection state managed in widget class property. |
| ROUTE-03 | User can see the latest N runs overlaid on a single map | Leaflet supports multiple L.polyline() layers added to same map instance. Performance validated for N=10-50 routes. Use distinct colors per route (hue rotation or predefined palette). |
| ROUTE-04 | Route auto-fits to viewport on load | polyline.getBounds() returns LatLngBounds, map.fitBounds(bounds) zooms map. Fallback needed for single-point routes (check bounds.isValid(), use start_latlng + zoom:13). |
| ROUTE-05 | User can click a route to see distance, date, and pace | Leaflet polyline.on('click', handler) + bindPopup(html). Store activity metadata in polyline options object. Format: "10.5 km • 2023-10-14 • 4:32/km". Pace calculated from distance/moving_time. |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Leaflet | 1.9.4 | Interactive map rendering, polyline visualization | **ALREADY INSTALLED** (Phase 10). Industry standard for DOM-based mapping. Zero npm runtime dependencies. Works with Shadow DOM + CSS injection pattern. Polyline API supports styling, events, bounds calculation. |
| @mapbox/polyline | 1.2.1 | Decode Strava summary_polyline to lat/lng coordinates | **ALREADY INSTALLED** (Phase 10-02). Most popular polyline library (270K+ downloads/week). Decodes to [[lat, lng], ...] format directly compatible with Leaflet L.polyline(). |
| vite-plugin-css-injected-by-js | 3.5.2 | Inject Leaflet CSS into IIFE widget bundles | **ALREADY INSTALLED** (Phase 10). Required for Shadow DOM CSS isolation. Injects styles at runtime, fixes Vite marker icon paths. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/leaflet | 1.9.21 | TypeScript type definitions for Leaflet API | **ALREADY INSTALLED** (Phase 10). Development-time type safety for map operations, polyline methods, event handlers. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SVG renderer (default) | Canvas renderer (L.canvas()) | Canvas faster for 50+ polylines but lines less smooth. SVG sufficient for Phase 11 use cases (N≤50). Canvas option available if performance testing reveals issues. |
| Pre-computed JSON | Fetch raw activities, process client-side | 7.1MB activity data too large for widget runtime fetch. Pre-computing reduces widget complexity, improves load time. Build-time aggregation already proven (geo-stats, weekly-distance). |
| Embedded map + list (single widget) | Separate widgets with cross-communication | Single widget simpler state management, better encapsulation. Separate widgets require custom event protocol (fragile). Choose single widget for ROUTE-02 browser. |
| Distinct colors per route | Single color for all routes | Multi-run overlay (ROUTE-03) needs visual distinction. Use hue rotation (HSL) or predefined Strava-inspired palette. Single color acceptable if routes don't overlap heavily. |

**Installation:**
```bash
# No new dependencies required - Phase 10 installed everything needed
# Verify existing dependencies:
npm ls leaflet @mapbox/polyline vite-plugin-css-injected-by-js
```

## Architecture Patterns

### Recommended Project Structure

```
src/widgets/
├── single-run-map/          # NEW: ROUTE-01 widget
│   └── index.ts             # SingleRunMapElement class
├── route-browser/           # NEW: ROUTE-02 widget
│   ├── index.ts             # RouteBrowserElement class
│   └── route-renderer.ts    # Shared RouteRenderer utility
├── multi-run-overlay/       # NEW: ROUTE-03 widget
│   └── index.ts             # MultiRunOverlayElement class
└── shared/
    ├── widget-base.ts       # EXISTING: HTMLElement base class
    └── route-utils.ts       # NEW: Shared polyline/bounds utilities

data/routes/                 # NEW: Route widget data files
├── route-list.json          # All activities (id, name, date, distance, polyline) for browser
├── latest-runs.json         # Latest N runs with polylines for overlay
└── metadata.json            # Route data generation metadata

scripts/
├── build-widgets.mjs        # MODIFY: Add 3 new route widgets to build config
└── compute-route-data.mjs   # NEW: Generate route-list.json, latest-runs.json

src/geo/
└── polyline-decoder.ts      # EXISTING: decodeActivityPolyline() from Phase 10-02
```

### Pattern 1: Route Data Pre-Computation (Build-Time Aggregation)

**What:** Generate widget-optimized JSON files at build time from raw activity data, reducing runtime processing and network transfer.

**When to use:** Any widget consuming route data (all three Phase 11 widgets). Avoids fetching 7.1MB of raw activity JSON or processing 1,808 polylines at runtime.

**How it works:**
1. Script reads all activities from `data/activities/*.json`
2. Extracts relevant fields: id, name, start_date_local, distance, moving_time, map.summary_polyline, start_latlng
3. Sorts by date (descending) for latest-runs
4. Outputs compact JSON files to `data/routes/`

**Example script structure:**
```typescript
// scripts/compute-route-data.mjs
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface RouteData {
  id: number;
  name: string;
  date: string;
  distance: number;
  movingTime: number;
  polyline: string;
  startLat: number;
  startLng: number;
}

function generateRouteData() {
  const activitiesDir = 'data/activities';
  const files = readdirSync(activitiesDir).filter(f => f.endsWith('.json'));

  const routes: RouteData[] = files.map(file => {
    const activity = JSON.parse(readFileSync(join(activitiesDir, file), 'utf-8'));
    return {
      id: activity.id,
      name: activity.name,
      date: activity.start_date_local,
      distance: activity.distance,
      movingTime: activity.moving_time,
      polyline: activity.map.summary_polyline,
      startLat: activity.start_latlng[0],
      startLng: activity.start_latlng[1]
    };
  }).filter(r => r.polyline); // Only activities with routes

  // Sort by date (descending)
  routes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Generate route-list.json (all activities)
  writeFileSync('data/routes/route-list.json', JSON.stringify(routes, null, 2));

  // Generate latest-runs.json (latest 50 activities)
  writeFileSync('data/routes/latest-runs.json', JSON.stringify(routes.slice(0, 50), null, 2));

  console.log(`Generated route data: ${routes.length} activities`);
}

generateRouteData();
```

**Benefits:**
- Widget bundles stay small (<50KB)
- No runtime polyline processing overhead
- Faster widget initialization (pre-sorted, pre-filtered data)
- Consistent with existing project pattern (geo-stats, weekly-distance pre-computed)

**Source:** [11 Ways to Improve JSON Performance & Usage - Stackify](https://stackify.com/top-11-json-performance-usage-tips/), [ADX Query Performance Best Practices](https://techcommunity.microsoft.com/blog/azuredataexplorer/adx-query-performance-unleashed-best-practices-and-pro-tips/3974675)

### Pattern 2: Reusable RouteRenderer Utility

**What:** Shared class handling polyline decode → Leaflet rendering → bounds calculation → popup creation. Reduces duplication across three route widgets.

**When to use:** All three route widgets need this logic. Extract to `src/widgets/shared/route-utils.ts` or widget-specific `route-renderer.ts`.

**Example implementation:**
```typescript
// src/widgets/route-browser/route-renderer.ts
import L from 'leaflet';
import polyline from '@mapbox/polyline';

export interface RouteData {
  id: number;
  name: string;
  date: string;
  distance: number;
  movingTime: number;
  polyline: string;
  startLat: number;
  startLng: number;
}

export interface RouteRenderOptions {
  color?: string;
  weight?: number;
  opacity?: number;
  showPopup?: boolean;
}

export class RouteRenderer {
  /**
   * Render a route polyline on a Leaflet map with auto-fit and optional popup
   */
  static renderRoute(
    map: L.Map,
    route: RouteData,
    options: RouteRenderOptions = {}
  ): L.Polyline {
    // Decode polyline to coordinates
    const coords = polyline.decode(route.polyline);

    // Create Leaflet polyline with styling
    const line = L.polyline(coords, {
      color: options.color || '#fc4c02',
      weight: options.weight || 3,
      opacity: options.opacity || 0.8
    }).addTo(map);

    // Auto-fit map to route bounds
    const bounds = line.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    } else {
      // Fallback for single-point routes (treadmill runs)
      map.setView([route.startLat, route.startLng], 13);
    }

    // Optionally bind popup with activity metadata
    if (options.showPopup) {
      const pace = this.calculatePace(route.distance, route.movingTime);
      const popupHtml = `
        <strong>${route.name}</strong><br>
        ${(route.distance / 1000).toFixed(1)} km<br>
        ${new Date(route.date).toLocaleDateString()}<br>
        Pace: ${pace}
      `;
      line.bindPopup(popupHtml);
    }

    return line;
  }

  /**
   * Calculate pace in min/km format
   */
  private static calculatePace(distanceMeters: number, movingTimeSec: number): string {
    const paceSecPerKm = (movingTimeSec / (distanceMeters / 1000));
    const minutes = Math.floor(paceSecPerKm / 60);
    const seconds = Math.floor(paceSecPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  }
}
```

**Usage in widgets:**
```typescript
// In single-run-map widget
const route = await this.fetchData<RouteData>(this.dataUrl);
RouteRenderer.renderRoute(this.map!, route, { showPopup: true });

// In multi-run-overlay widget (multiple routes)
routes.forEach((route, index) => {
  const hue = (index * 360 / routes.length);
  RouteRenderer.renderRoute(this.map!, route, {
    color: `hsl(${hue}, 70%, 50%)`,
    showPopup: true
  });
});
```

**Source:** Derived from [Leaflet Polyline Documentation](https://leafletjs.com/reference.html), [Leaflet fitBounds Tutorial](https://www.markhneedham.com/blog/2017/12/31/leaflet-fit-polyline-view/)

### Pattern 3: Auto-Fit Viewport with Fallback

**What:** Use Leaflet's fitBounds() API to auto-zoom map to show entire route, with fallback for edge cases (single-point routes, invalid bounds).

**When to use:** All route visualization widgets (ROUTE-04 requirement).

**Implementation:**
```typescript
function autoFitRoute(map: L.Map, polyline: L.Polyline, fallbackCenter: [number, number]) {
  const bounds = polyline.getBounds();

  if (bounds.isValid()) {
    // Normal case: polyline has multiple points
    map.fitBounds(bounds, {
      padding: [20, 20],  // 20px padding on all sides
      maxZoom: 15         // Don't zoom closer than street level
    });
  } else {
    // Edge case: single point (treadmill run) or empty polyline
    map.setView(fallbackCenter, 13);
  }
}
```

**Edge cases handled:**
- **Treadmill runs**: No GPS movement, polyline is single point. Fallback to start_latlng with zoom:13.
- **Very short routes**: fitBounds might zoom to 18+ (too close). maxZoom:15 prevents over-zooming.
- **Empty polylines**: Some activities missing map.summary_polyline. Filter at data generation or show error state.

**Source:** [Leaflet fitBounds Documentation](https://leafletjs.com/reference.html), [Leaflet Fit Polyline in View](https://dzone.com/articles/leaflet-fit-polyline-in-view)

### Pattern 4: Interactive Polyline Popups

**What:** Attach click event handlers to polylines, displaying activity metadata in Leaflet popup.

**When to use:** ROUTE-05 requirement (all three widgets).

**Implementation:**
```typescript
function addPopupToRoute(polyline: L.Polyline, route: RouteData) {
  polyline.on('click', () => {
    const popupContent = formatRoutePopup(route);
    polyline.bindPopup(popupContent).openPopup();
  });
}

function formatRoutePopup(route: RouteData): string {
  const distanceKm = (route.distance / 1000).toFixed(1);
  const date = new Date(route.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const pace = calculatePace(route.distance, route.movingTime);

  return `
    <div style="font-family: sans-serif; min-width: 150px;">
      <strong style="font-size: 14px;">${route.name}</strong><br>
      <span style="color: #666;">${distanceKm} km • ${date}</span><br>
      <span style="color: #666;">Pace: ${pace}</span>
    </div>
  `;
}
```

**Styling tips:**
- Inline styles (popup content is plain HTML, no Shadow DOM)
- Keep popup minimal (distance, date, pace only per requirements)
- Use Leaflet's default popup styling (close button, arrow)

**Hover states (optional enhancement):**
```typescript
polyline.on('mouseover', () => {
  polyline.setStyle({ weight: 5, opacity: 1.0 });
});

polyline.on('mouseout', () => {
  polyline.setStyle({ weight: 3, opacity: 0.8 });
});
```

**Source:** [Leaflet Popup Documentation](https://leafletjs.com/reference.html), [Clicking on Polylines in Leaflet](https://runebook.dev/en/articles/leaflet/index/polyline-click)

### Pattern 5: Route Browser Selection State

**What:** Manage selected activity in route browser widget, updating map when user clicks list item.

**When to use:** ROUTE-02 widget (route browser with list + map).

**Implementation:**
```typescript
class RouteBrowserElement extends WidgetBase {
  private map: L.Map | null = null;
  private currentPolyline: L.Polyline | null = null;
  private selectedActivityId: number | null = null;
  private routes: RouteData[] = [];

  protected render(data: RouteData[]): void {
    this.routes = data;

    // Render list
    const listContainer = document.createElement('div');
    listContainer.className = 'route-list';

    data.forEach(route => {
      const item = this.createListItem(route);
      item.addEventListener('click', () => this.selectRoute(route.id));
      listContainer.appendChild(item);
    });

    // Render map container
    const mapContainer = document.createElement('div');
    mapContainer.className = 'route-map';
    mapContainer.style.height = '400px';

    this.shadowRoot!.appendChild(listContainer);
    this.shadowRoot!.appendChild(mapContainer);

    // Initialize map
    this.map = L.map(mapContainer).setView([55.6761, 12.5683], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    // Select first route by default
    if (data.length > 0) {
      this.selectRoute(data[0].id);
    }
  }

  private selectRoute(activityId: number): void {
    this.selectedActivityId = activityId;
    const route = this.routes.find(r => r.id === activityId);
    if (!route || !this.map) return;

    // Remove previous polyline
    if (this.currentPolyline) {
      this.currentPolyline.remove();
    }

    // Render new route
    this.currentPolyline = RouteRenderer.renderRoute(this.map, route, {
      showPopup: true
    });

    // Update list item selection state
    this.updateListSelection(activityId);
  }

  private updateListSelection(activityId: number): void {
    const items = this.shadowRoot!.querySelectorAll('.route-list-item');
    items.forEach(item => {
      const itemId = parseInt(item.getAttribute('data-activity-id')!);
      item.classList.toggle('selected', itemId === activityId);
    });
  }

  private createListItem(route: RouteData): HTMLElement {
    const item = document.createElement('div');
    item.className = 'route-list-item';
    item.setAttribute('data-activity-id', route.id.toString());

    const distanceKm = (route.distance / 1000).toFixed(1);
    const date = new Date(route.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    item.innerHTML = `
      <div class="item-name">${route.name}</div>
      <div class="item-meta">${distanceKm} km • ${date}</div>
    `;

    return item;
  }
}
```

**Layout options:**
- **Side-by-side**: List on left (30%), map on right (70%)
- **Stacked**: List on top, map below (mobile-friendly)
- **Responsive**: Side-by-side on desktop, stacked on mobile (use ResponsiveManager)

**Source:** [Web Components Custom Elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements), existing geo-table-widget pattern

### Anti-Patterns to Avoid

- **Fetching raw activities in widgets**: 7.1MB of data, 1,808 JSON parses. Always pre-compute route data at build time.
- **Bundling Leaflet**: Increases widget size to 500KB+. Always externalize to CDN (isMapWidget: true).
- **Processing polylines client-side**: Decode once at build time, store decoded coords in JSON. Or decode lazily but cache results.
- **Memory leaks from map instances**: Always call map.remove() in disconnectedCallback(). Event listeners auto-cleaned by Leaflet.
- **Not handling missing polylines**: ~10% of activities lack GPS data. Filter at data generation or show "No route available" state.
- **Over-zooming single-point routes**: Check bounds.isValid() before fitBounds(), use maxZoom option.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Polyline decoding | Custom Google Polyline decoder | @mapbox/polyline (already installed) | Handles precision edge cases, optimized, 270K+ weekly downloads. Phase 10-02 already uses it. |
| Route bounds calculation | Manual lat/lng min/max | Leaflet polyline.getBounds() | Handles antimeridian crossing, validates bounds, accounts for map projection. |
| Map tile rendering | Custom tile layer fetching | Leaflet L.tileLayer() | Handles tile caching, retina displays, zoom level management, attribution. |
| Popup positioning | Absolute CSS positioning | Leaflet bindPopup() | Auto-positions near click point, handles map edges, responsive to zoom/pan. |
| Pace/speed calculations | String formatting logic | Extract to shared utility | Pace formatting tricky (4:32/km vs 0:04:32 for slow). Reusable across widgets. |

**Key insight:** Leaflet's polyline API handles 90% of ROUTE-01 through ROUTE-05 requirements out-of-box. The heavy lifting (decode, bounds, popups, styling) is built-in. Phase 11 focuses on widget structure, data preparation, and UX polish, not low-level map operations.

## Common Pitfalls

### Pitfall 1: Memory Leaks from Uncleaned Map Instances

**What goes wrong:** Creating Leaflet map without calling map.remove() in disconnectedCallback() causes memory leaks. Event listeners, tile layers, DOM nodes persist after widget removal.

**Why it happens:** Leaflet maintains internal references to map container, layers, event handlers. Browser can't garbage collect without explicit cleanup.

**How to avoid:**
```typescript
class MyMapWidget extends WidgetBase {
  private map: L.Map | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    const container = document.createElement('div');
    container.style.height = '400px';
    this.shadowRoot!.appendChild(container);
    this.map = L.map(container).setView([55.6761, 12.5683], 13);
    // ... add layers
  }

  disconnectedCallback(): void {
    // CRITICAL: Clean up map instance
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    super.disconnectedCallback();
  }
}
```

**Warning signs:**
- Memory usage increases when widgets added/removed repeatedly
- Browser DevTools heap snapshot shows leaked L.Map instances
- Performance degrades over time in single-page apps

**Source:** [Leaflet Memory Leak Prevention](https://app.studyraid.com/en/read/11881/378250/memory-leak-prevention), [Switching maps memory consumption issue](https://github.com/Leaflet/Leaflet/issues/4762)

### Pitfall 2: Invalid Bounds on Single-Point Routes

**What goes wrong:** Calling map.fitBounds() on treadmill run (single GPS point) causes JavaScript error or map zooms to max level (18+), showing blank tiles.

**Why it happens:** Leaflet bounds require at least two distinct points (southwest, northeast). Single point creates invalid bounds (sw === ne).

**How to avoid:**
```typescript
function autoFitRoute(map: L.Map, polyline: L.Polyline, fallbackCenter: [number, number]) {
  const bounds = polyline.getBounds();

  // Check bounds validity BEFORE calling fitBounds
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
  } else {
    // Fallback to start location with reasonable zoom
    map.setView(fallbackCenter, 13);
  }
}
```

**Additional check:** Filter activities without polylines at data generation time:
```typescript
const routes = activities.filter(a => a.map?.summary_polyline && a.map.summary_polyline.length > 10);
```

**Warning signs:**
- Console errors: "Invalid LatLngBounds"
- Map zoomed extremely close (zoom 18+) showing gray tiles
- Activities with distance > 0 but no visible route

**Source:** [Leaflet fitBounds Documentation](https://leafletjs.com/reference.html), [Leaflet Bounds API](https://runebook.dev/en/articles/leaflet/index/bounds)

### Pitfall 3: Performance Degradation with Many Overlapping Polylines

**What goes wrong:** Multi-run overlay (ROUTE-03) with N=50+ routes causes sluggish pan/zoom, high CPU usage, janky scrolling.

**Why it happens:** Leaflet's default SVG renderer re-renders all polylines on every map interaction (pan, zoom). SVG DOM manipulation expensive for large node counts.

**How to avoid:**
1. **Limit overlay count**: Default N=10-20 routes. Add attribute `data-overlay-count` for customization.
2. **Use Canvas renderer if needed**:
```typescript
const canvas = L.canvas();
const polyline = L.polyline(coords, {
  renderer: canvas,
  color: '#fc4c02',
  weight: 3
});
```
3. **Simplify polylines**: Use Leaflet's smoothFactor option:
```typescript
const polyline = L.polyline(coords, {
  smoothFactor: 3.0,  // Higher = more simplification (default: 1.0)
  color: '#fc4c02'
});
```

**Performance target:** 60fps pan/zoom with N=20 routes on mid-range desktop (2020+ laptop).

**Warning signs:**
- Framerate drops below 30fps during pan/zoom
- Browser DevTools Performance tab shows long SVG layout/paint tasks
- Mobile devices (iOS Safari) become unresponsive

**Source:** [Leaflet Canvas vs SVG Performance](https://andrejgajdos.com/leaflet-developer-guide-to-high-performance-map-visualizations-in-react/), [Troubleshooting Polyline Rendering](https://runebook.dev/en/articles/leaflet/index/polyline-renderer)

### Pitfall 4: Missing Polyline Data Handling

**What goes wrong:** Widget fetches route data, assumes all activities have polylines, crashes when encountering null/undefined map.summary_polyline.

**Why it happens:** ~10% of Strava activities lack GPS data (manual entries, treadmill runs without GPS watch, privacy zones). Activity JSON has distance/time but no polyline.

**How to avoid:**
1. **Filter at data generation**:
```typescript
// scripts/compute-route-data.mjs
const routes = activities
  .filter(a => a.map?.summary_polyline)  // Only activities with polylines
  .map(a => ({
    id: a.id,
    // ... other fields
    polyline: a.map.summary_polyline
  }));
```

2. **Graceful degradation in widget**:
```typescript
protected async fetchDataAndRender(): Promise<void> {
  try {
    const route = await this.fetchData<RouteData>(this.dataUrl);

    if (!route.polyline || route.polyline.length === 0) {
      this.showMessage('No route data available for this activity');
      return;
    }

    this.renderRoute(route);
  } catch (error) {
    this.showError('Failed to load route');
  }
}
```

**Warning signs:**
- Console errors: "Cannot read property 'summary_polyline' of undefined"
- Blank map with no polyline rendered
- Activities with distance > 0 but no route shown

### Pitfall 5: Excessive Data Fetching in Route Browser

**What goes wrong:** Route browser widget fetches all 1,808 activities with full polylines (7.1MB) to populate list, causing 5+ second load time, poor mobile experience.

**Why it happens:** Treating route browser like geo-table-widget (which has 86 cities, negligible data). Route list needs metadata only, not full polylines upfront.

**How to avoid:**
1. **Two-file approach**:
   - `route-list.json`: All activities with metadata only (id, name, date, distance) - ~200KB
   - `route-details/{activityId}.json`: Individual activity polylines fetched on selection - ~2KB each
2. **Pagination**: Show 50 activities per page, infinite scroll for rest
3. **Pre-sorted data**: Sort by date descending at generation time, no client-side sorting

**Implementation:**
```typescript
// Data generation
const routeList = activities.map(a => ({
  id: a.id,
  name: a.name,
  date: a.start_date_local,
  distance: a.distance,
  // NO polyline here - saves 90% of data size
}));

const routeDetails = activities.reduce((acc, a) => {
  acc[a.id] = {
    polyline: a.map.summary_polyline,
    startLat: a.start_latlng[0],
    startLng: a.start_latlng[1]
  };
  return acc;
}, {});

writeFileSync('data/routes/route-list.json', JSON.stringify(routeList));
activities.forEach(a => {
  writeFileSync(`data/routes/details/${a.id}.json`, JSON.stringify(routeDetails[a.id]));
});
```

**Widget implementation:**
```typescript
private async selectRoute(activityId: number): Promise<void> {
  // Fetch polyline only when selected
  const details = await this.fetchData<RouteDetails>(
    `data/routes/details/${activityId}.json`
  );
  this.renderRoute(details);
}
```

**Warning signs:**
- Widget load time > 2 seconds on broadband
- Mobile data usage concerns (7MB for a simple widget)
- Browser becomes unresponsive during initial fetch

**Source:** [Pagination vs Infinite Scroll](https://medium.com/@itsanuragjoshi/pagination-vs-infinite-scroll-vs-load-more-data-loading-ux-patterns-in-react-cccd261d3984), [API Pagination Guide](https://treblle.com/blog/api-pagination-guide-techniques-benefits-implementation)

## Code Examples

Verified patterns from official sources and Phase 10 implementation:

### Example 1: Basic Polyline Rendering

```typescript
// Source: Phase 10 map-test-widget + Leaflet documentation
import L from 'leaflet';
import polyline from '@mapbox/polyline';
import 'leaflet/dist/leaflet.css';

// Decode Strava polyline to coordinates
const encodedPolyline = 'c{~rIkvnkA_@b@YlA{@?a@Rg@WiAGwAL}B@K]_Au@c@KiAQ]Mk';
const coords = polyline.decode(encodedPolyline);
// coords = [[55.676, 12.568], [55.677, 12.569], ...]

// Create Leaflet polyline with styling
const route = L.polyline(coords, {
  color: '#fc4c02',      // Strava orange
  weight: 3,             // Line width in pixels
  opacity: 0.8,          // Semi-transparent
  smoothFactor: 1.0      // Polyline simplification (1.0 = no simplification)
}).addTo(map);

// Auto-fit map to route
map.fitBounds(route.getBounds(), {
  padding: [20, 20],     // 20px padding on all sides
  maxZoom: 15            // Don't zoom closer than street level
});
```

**Source:** [Leaflet Polyline API](https://leafletjs.com/reference.html#polyline), [Leaflet fitBounds Tutorial](https://www.markhneedham.com/blog/2017/12/31/leaflet-fit-polyline-view/)

### Example 2: Polyline with Interactive Popup

```typescript
// Source: Leaflet documentation + Strava color coding patterns
const route = L.polyline(coords, {
  color: '#fc4c02',
  weight: 3,
  opacity: 0.8
}).addTo(map);

// Bind popup to polyline (opens on click)
const distanceKm = (10351 / 1000).toFixed(1);  // 10.4 km
const date = new Date('2023-10-14T09:41:47Z').toLocaleDateString();
const pace = '4:32/km';

route.bindPopup(`
  <div style="font-family: sans-serif; min-width: 150px;">
    <strong>Morning Run</strong><br>
    <span style="color: #666;">${distanceKm} km • ${date}</span><br>
    <span style="color: #666;">Pace: ${pace}</span>
  </div>
`);

// Optional: Add hover effects
route.on('mouseover', () => {
  route.setStyle({ weight: 5, opacity: 1.0 });
});

route.on('mouseout', () => {
  route.setStyle({ weight: 3, opacity: 0.8 });
});
```

**Source:** [Leaflet Popup Documentation](https://leafletjs.com/reference.html#popup), [Strava Color Coding Patterns](https://communityhub.strava.com/strava-features-chat-5/color-the-activity-on-map-according-to-pace-609)

### Example 3: Multiple Polylines with Distinct Colors

```typescript
// Source: Multi-polyline overlay pattern
interface RouteData {
  id: number;
  name: string;
  polyline: string;
}

const routes: RouteData[] = [
  /* latest N activities */
];

// Render each route with distinct color (HSL hue rotation)
routes.forEach((route, index) => {
  const coords = polyline.decode(route.polyline);
  const hue = (index * 360 / routes.length);  // Distribute hues evenly

  const line = L.polyline(coords, {
    color: `hsl(${hue}, 70%, 50%)`,  // HSL for even color distribution
    weight: 3,
    opacity: 0.7
  }).addTo(map);

  // Bind popup with route-specific data
  line.bindPopup(`<strong>${route.name}</strong>`);
});

// Fit map to show all routes
const group = L.featureGroup(routes.map(r =>
  L.polyline(polyline.decode(r.polyline))
));
map.fitBounds(group.getBounds());
```

**Alternative color palette (predefined Strava-inspired colors):**
```typescript
const colors = ['#fc4c02', '#1e88e5', '#43a047', '#e53935', '#fb8c00', '#8e24aa'];
routes.forEach((route, index) => {
  const line = L.polyline(coords, {
    color: colors[index % colors.length],
    weight: 3,
    opacity: 0.8
  });
});
```

**Source:** [Strava Map Color Coding](https://communityhub.strava.com/strava-features-chat-5/color-the-activity-on-map-according-to-pace-609), [Leaflet Multi-Polyline Tutorial](https://www.tutorialspoint.com/leafletjs/leafletjs_multi_polyline_and_polygon.htm)

### Example 4: Route Browser Widget Structure

```typescript
// Source: Derived from geo-table-widget pattern + Web Components best practices
import { WidgetBase } from '../shared/widget-base.js';
import L from 'leaflet';
import polyline from '@mapbox/polyline';

interface RouteListItem {
  id: number;
  name: string;
  date: string;
  distance: number;
  polyline: string;
}

class RouteBrowserElement extends WidgetBase {
  private map: L.Map | null = null;
  private currentPolyline: L.Polyline | null = null;
  private routes: RouteListItem[] = [];

  protected get dataUrl(): string {
    return this.getAttribute('data-url') || 'data/routes/route-list.json';
  }

  protected render(data: RouteListItem[]): void {
    this.routes = data;

    // Create container with side-by-side layout
    const container = document.createElement('div');
    container.className = 'route-browser';
    container.innerHTML = `
      <style>
        .route-browser {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 20px;
          height: 500px;
        }
        .route-list {
          overflow-y: auto;
          border: 1px solid #ddd;
          border-radius: 8px;
        }
        .route-list-item {
          padding: 12px;
          border-bottom: 1px solid #f0f0f0;
          cursor: pointer;
        }
        .route-list-item:hover {
          background: #f5f5f5;
        }
        .route-list-item.selected {
          background: #fc4c02;
          color: white;
        }
        .route-map {
          border-radius: 8px;
          overflow: hidden;
        }
      </style>
      <div class="route-list"></div>
      <div class="route-map"></div>
    `;

    this.shadowRoot!.appendChild(container);

    // Populate list
    const listEl = container.querySelector('.route-list')!;
    data.forEach(route => {
      const item = this.createListItem(route);
      item.addEventListener('click', () => this.selectRoute(route.id));
      listEl.appendChild(item);
    });

    // Initialize map
    const mapEl = container.querySelector('.route-map') as HTMLElement;
    this.map = L.map(mapEl).setView([55.6761, 12.5683], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    // Select first route by default
    if (data.length > 0) {
      this.selectRoute(data[0].id);
    }
  }

  private selectRoute(activityId: number): void {
    const route = this.routes.find(r => r.id === activityId);
    if (!route || !this.map) return;

    // Remove previous polyline
    if (this.currentPolyline) {
      this.currentPolyline.remove();
    }

    // Render new polyline
    const coords = polyline.decode(route.polyline);
    this.currentPolyline = L.polyline(coords, {
      color: '#fc4c02',
      weight: 3,
      opacity: 0.8
    }).addTo(this.map);

    // Auto-fit to route
    const bounds = this.currentPolyline.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [20, 20] });
    }

    // Update selection state in list
    this.shadowRoot!.querySelectorAll('.route-list-item').forEach(item => {
      item.classList.toggle('selected',
        parseInt(item.getAttribute('data-id')!) === activityId
      );
    });
  }

  private createListItem(route: RouteListItem): HTMLElement {
    const item = document.createElement('div');
    item.className = 'route-list-item';
    item.setAttribute('data-id', route.id.toString());

    const distanceKm = (route.distance / 1000).toFixed(1);
    const date = new Date(route.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    item.innerHTML = `
      <div style="font-weight: 600;">${route.name}</div>
      <div style="font-size: 12px; color: #666;">${distanceKm} km • ${date}</div>
    `;

    return item;
  }

  disconnectedCallback(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    super.disconnectedCallback();
  }
}

WidgetBase.register('route-browser-widget', RouteBrowserElement);
```

**Source:** [Web Components List Selection Pattern](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements), geo-table-widget implementation, Phase 10 map-test-widget

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mapbox GL JS / Maplibre GL | Leaflet for simple polyline viz | 2020+ | WebGL overkill for route polylines. Leaflet 40KB vs Maplibre 800KB. Leaflet DOM-based rendering easier for simple use cases. |
| Client-side polyline processing | Pre-computed route data at build time | Industry best practice | Reduces widget bundle size, faster initialization, better mobile performance. Proven in geo-stats, weekly-distance widgets. |
| Single-file widgets with all data | Separate list + detail JSON files | 2015+ (REST API patterns) | Route browser can load 200KB list, fetch 2KB details on demand. Improves perceived performance. |
| Manual bounds calculation | Leaflet polyline.getBounds() | Leaflet 1.0+ (2016) | Built-in bounds calculation handles edge cases (antimeridian, single points). No need to hand-roll. |
| SVG rendering only | Canvas renderer option for performance | Leaflet 1.0+ (2016) | Canvas faster for 50+ polylines but less smooth. Use SVG default, switch to Canvas if profiling shows issues. |

**Deprecated/outdated:**
- **Google Maps API for polyline viz**: High cost, strict terms of service. OpenStreetMap + Leaflet free, open source.
- **Mapbox.js** (Leaflet plugin): Deprecated 2019, replaced by Mapbox GL JS. Use vanilla Leaflet with OSM tiles.
- **Client-side route simplification**: Douglas-Peucker algorithm computationally expensive. Use Leaflet's built-in smoothFactor or pre-simplify at build time.

## Open Questions

1. **Route color palette for multi-run overlay**
   - What we know: HSL hue rotation gives even distribution. Strava uses gradient color coding (pace/elevation).
   - What's unclear: Does user want customizable colors (data-colors attribute)? Predefined palette vs. algorithmic?
   - Recommendation: Start with HSL hue rotation (N=10 routes = 36° spacing). Add data-color-scheme attribute in future if requested.

2. **Route browser list size and pagination**
   - What we know: 1,808 activities total. Geo-table-widget uses 25 rows/page. Route browser likely shows fewer (larger rows with map preview?).
   - What's unclear: Should browser paginate (25/page) or infinite scroll? Initial load all 1,808 or first 100?
   - Recommendation: Phase 11 loads all routes (route-list.json without polylines = ~200KB). Add pagination in future if performance issues arise. Sort by date descending (latest first).

3. **Mobile touch events and gesture handling**
   - What we know: Leaflet supports touch events (pinch zoom, two-finger pan). Phase 10 map-test-widget not tested on mobile.
   - What's unclear: Do touch events work in Shadow DOM on iOS Safari? Any issues with pan/zoom gestures?
   - Recommendation: Manual testing on iOS/Android after Phase 11 implementation. Leaflet mobile support mature, issues unlikely but unverified.

4. **Polyline data freshness**
   - What we know: Route data pre-computed at build time (npm run compute-route-data). Strava sync adds new activities.
   - What's unclear: When does route data regenerate? Manual rebuild or automatic after sync?
   - Recommendation: Add route data generation to npm run process script (after compute-all-stats). Document in README: "Run npm run process after Strava sync to update widgets."

## Sources

### Primary (HIGH confidence)

- **Leaflet 1.9.4 Official Documentation** - Polyline API, fitBounds, Popup API, Canvas/SVG renderers
  - https://leafletjs.com/reference.html
- **@mapbox/polyline npm package** - Decode/encode API, precision handling
  - Already installed (Phase 10-02), TypeScript declarations in src/types/mapbox-polyline.d.ts
- **Phase 10 Implementation** - map-test-widget.ts, build-widgets.mjs, polyline-decoder.ts
  - Verified: Leaflet renders in Shadow DOM, CSS injection working, @mapbox/polyline integration
- **Project Activity Data** - 1,808 activities with map.summary_polyline (7.1MB total)
  - Verified: data/activities/*.json structure, polyline presence ~90%

### Secondary (MEDIUM confidence)

- [Leaflet: Fit Polyline in View - Mark Needham](https://www.markhneedham.com/blog/2017/12/31/leaflet-fit-polyline-view/)
  - fitBounds() usage pattern, padding options
- [Leaflet Developer's Guide to High-Performance Map Visualizations - Andrej Gajdos](https://andrejgajdos.com/leaflet-developer-guide-to-high-performance-map-visualizations-in-react/)
  - Canvas vs SVG performance comparison, optimization strategies
- [Leaflet Memory Leak Prevention](https://app.studyraid.com/en/read/11881/378250/memory-leak-prevention)
  - map.remove() necessity, event listener cleanup
- [Strava Map Color Coding - Community Hub](https://communityhub.strava.com/strava-features-chat-5/color-the-activity-on-map-according-to-pace-609)
  - Pace/speed gradient colors, elevation coding
- [Pagination vs Infinite Scroll - Medium](https://medium.com/@itsanuragjoshi/pagination-vs-infinite-scroll-vs-load-more-data-loading-ux-patterns-in-react-cccd261d3984)
  - Data loading UX patterns, performance trade-offs
- [11 Ways to Improve JSON Performance - Stackify](https://stackify.com/top-11-json-performance-usage-tips/)
  - Pre-computed aggregates, data size optimization

### Tertiary (LOW confidence, marked for validation)

- [Web Components Custom Elements - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements)
  - General pattern, not route-specific. Phase 7 widget architecture already validates this.
- [Leaflet Multi-Polyline Tutorial - TutorialsPoint](https://www.tutorialspoint.com/leafletjs/leafletjs_multi_polyline_and_polygon.htm)
  - Basic example, not performance-focused. Supplement with Andrej Gajdos performance guide.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - Leaflet, @mapbox/polyline, vite-plugin-css-injected-by-js all installed and validated in Phase 10
- Architecture patterns: **HIGH** - RouteRenderer derived from Leaflet docs + Phase 10 implementation, data pre-computation proven in geo-stats
- Common pitfalls: **MEDIUM-HIGH** - Memory leaks and bounds validation confirmed in Leaflet docs/issues, polyline performance from community reports (need validation with N=50 test)
- Open questions: **MEDIUM** - Color palette/pagination/mobile touch are design decisions, not technical unknowns. Can proceed with defaults, iterate based on feedback.

**Research date:** 2026-02-17
**Valid until:** ~60 days (Leaflet stable, map rendering patterns mature, project-specific architecture)

**Coverage:**
- ✅ ROUTE-01: Single-run map rendering (Leaflet polyline + fitBounds)
- ✅ ROUTE-02: Route browser with selection (list UI pattern + state management)
- ✅ ROUTE-03: Multi-run overlay (multiple polylines, color palette)
- ✅ ROUTE-04: Auto-fit viewport (fitBounds with fallback)
- ✅ ROUTE-05: Interactive popups (bindPopup + click events)
- ✅ Data preparation (pre-computed JSON, route-list + details)
- ✅ Performance (Canvas vs SVG, polyline simplification, memory leaks)
- ✅ Build system integration (isMapWidget pattern from Phase 10)

**Research complete - ready for planning.**
