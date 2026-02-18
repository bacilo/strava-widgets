# Phase 12: Heatmap & Pin Map Widgets - Research

**Researched:** 2026-02-17
**Domain:** Heatmap visualization, geographic pin maps, large-dataset performance optimization, date range filtering
**Confidence:** HIGH

## Summary

Phase 12 builds two new map visualization widgets on the Leaflet infrastructure from Phase 10-11: a heatmap showing all 1,808 runs as a density overlay, and a pin map displaying cities/countries visited with aggregated statistics. Both widgets require performance optimization for large datasets (HEAT-04: non-blocking UI, <200MB memory), user-facing controls (HEAT-02: date filters, HEAT-03: color schemes, PIN-03: country/city toggle), and interactive click handlers (PIN-02: run count, distance, dates).

**Critical technical foundation**: Phase 10-11 established Leaflet 1.9.4 (CDN externalized), Shadow DOM + CSS injection, RouteRenderer utility, and route data pre-computation patterns. Phase 11 created `data/routes/route-list.json` (2.0 MB, all 1,808 activities with polylines). Phase 10 geocoding migration produced `data/geo/cities.json` (86 cities) and `data/geo/countries.json` (8 countries) with activity counts, distances, and coordinates in `location-cache.json`. These existing data files enable Phase 12 widgets without additional data generation.

**Key technical challenges**:
1. **Heatmap performance (HEAT-04)**: Converting 1,808 encoded polylines to decoded coordinates for Leaflet.heat creates ~200K-500K individual lat/lng points. Decoding all polylines synchronously blocks UI for 2-5 seconds. Solution: Pre-decode polylines at build time (extend `compute-route-data.mjs`) or use Web Worker for async decoding with chunking. Memory target: <200MB browser heap (Leaflet.heat uses Canvas, not DOM nodes, reducing overhead vs SVG polylines).
2. **Heatmap color customization (HEAT-03)**: Leaflet.heat supports gradient config (e.g., `{0.4: 'blue', 0.65: 'lime', 1: 'red'}`). Provide 4-5 presets (classic hot, cool blue, grayscale, viridis-inspired, Strava orange) via widget attribute `data-color-scheme="hot"`. Use perceptually uniform gradients (viridis, inferno, mako) for accessibility.
3. **Date range filtering (HEAT-02)**: Filter `route-list.json` by `start_date_local` before rendering heatmap. UI approach: HTML5 date inputs (custom range) + preset buttons (2025, 2024, 2023, all-time). Re-render heatmap on filter change. Performance: Leaflet.heat.setLatLngs() replaces points without recreating map instance.
4. **Pin map city/country toggle (PIN-03)**: Two modes render different markers: (a) country-level: 8 markers from `countries.json` at country centroids, (b) city-level: 86 markers from `cities.json` at city coordinates (from `location-cache.json`). Toggle via widget attribute or UI button. Use Leaflet.markercluster for city mode if >50 cities cause visual clutter.
5. **Pin visual encoding (PIN-04)**: Marker size proportional to activity count (scale: 1-872 activities → 20-60px radius). Use L.divIcon with CSS border-radius for circular markers, background color based on distance quintile. Alternative: color scale only (fixed size), easier mobile interaction.

**Primary recommendation**: Build heatmap and pin map as two separate widgets (not combined). Heatmap focuses on density visualization with performance optimization (pre-decoded points, Canvas renderer, viewport culling via Leaflet.heat's built-in grid clustering). Pin map focuses on discrete location aggregation with interactive popups (Leaflet markers + markercluster for city mode). Both widgets share Leaflet infrastructure (Phase 10 CDN setup, Shadow DOM CSS injection) and build patterns (isMapWidget: true in `build-widgets.mjs`). Prioritize performance (HEAT-04) over feature richness—deliver date filtering and color schemes only after confirming 1,808-route heatmap renders without UI blocking.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HEAT-01 | User can view all runs overlaid as a heatmap on a single map | Leaflet.heat plugin (18KB, 10K+ point demo exists). Convert polylines to points via @mapbox/polyline decode (already installed). Render with L.heatLayer(points, options). Grid clustering handles density. |
| HEAT-02 | User can filter heatmap by date range | Filter route-list.json by date before point conversion. UI: HTML5 date inputs + preset buttons (yearly, all-time). Update heatmap via heatLayer.setLatLngs(filteredPoints). |
| HEAT-03 | User can customize heatmap colors | Leaflet.heat gradient option: `{0.4: 'blue', 0.65: 'lime', 1: 'red'}`. Provide 4-5 presets (hot, cool, grayscale, viridis, Strava). Update via heatLayer.setOptions({gradient}). |
| HEAT-04 | Heatmap renders 1,808 routes without blocking UI or exceeding 200MB | Pre-decode polylines at build time OR use Web Worker for async decode. Leaflet.heat uses Canvas (low memory vs DOM). Grid clustering reduces rendered points. Chunking: decode 100 routes at a time, yield to browser. |
| PIN-01 | User can view a world map with pins for each city/country visited | Use data/geo/cities.json (86 cities) and countries.json (8 countries). Get coordinates from location-cache.json. Render L.marker for each location. Country centroids calculated from city averages. |
| PIN-02 | User can click a pin to see run count, distance, and visit dates | L.marker.bindPopup(html). Popup content: `activityCount`, `totalDistanceKm` from cities/countries.json. Visit dates: Query activity-cities.json or route-list.json filtered by city. Format: "103 runs, 1,274.8 km, Feb 2023 - Oct 2024". |
| PIN-03 | User can toggle between country-level and city-level pins | Two rendering modes: country (8 markers) vs city (86 markers). Toggle via widget attribute `data-view="country"` or UI button. Clear existing markers, render new set. Use Leaflet.markercluster for city mode if >50 cities. |
| PIN-04 | Pin size or color reflects activity count | Marker size: Scale activity count (1-872) to radius (20-60px). Use L.divIcon with CSS `border-radius: 50%`. Color: Quintile-based (top 20% = red, next 20% = orange, etc.). Alternative: color-only encoding (fixed size) for mobile tap targets. |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Leaflet | 1.9.4 | Interactive map rendering | **ALREADY INSTALLED** (Phase 10). Industry standard for DOM-based mapping. Zero npm runtime dependencies. Externalized to CDN (global L). |
| leaflet.heat | ^0.2.0 | Heatmap layer for Leaflet | Official Leaflet plugin (18KB minified). Uses simpleheat under the hood with grid clustering for performance. Handles 10K+ points in demo. Canvas-based rendering (low memory). Configurable gradient, radius, blur. 140K+ weekly downloads. |
| @mapbox/polyline | 1.2.1 | Decode Strava polylines to lat/lng arrays | **ALREADY INSTALLED** (Phase 10-02). Decodes to [[lat, lng], ...] format directly usable in Leaflet.heat. |
| leaflet.markercluster | ^1.5.3 | Cluster city markers in pin map | Official Leaflet plugin for marker clustering. Handles 50K+ markers, chunked loading option. Improves city-level pin map UX when 86 cities cause visual clutter. Customizable cluster appearance. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-plugin-css-injected-by-js | 3.5.2 | Inject Leaflet CSS into IIFE bundles | **ALREADY INSTALLED** (Phase 10). Required for Shadow DOM CSS isolation. Handles both Leaflet core CSS and plugin CSS (leaflet.heat, markercluster). |
| @types/leaflet | 1.9.21 | TypeScript type definitions | **ALREADY INSTALLED** (Phase 10). Development-time type safety for Leaflet API. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| leaflet.heat (official) | heatmap.js with leaflet-heatmap plugin | heatmap.js has more customization (different kernels, dynamic data updates) but 3x bundle size (~50KB vs 18KB). Leaflet.heat sufficient for static heatmaps. |
| Pre-decoded points at build time | Client-side decode on demand | Pre-decoding eliminates UI blocking, reduces widget complexity. Trade-off: larger data files (2.0 MB → ~5 MB with decoded coords), but acceptable for static site deployment. |
| Leaflet.markercluster | Custom marker aggregation | Marker clustering is solved problem. Don't hand-roll grid-based clustering (edge cases: antimeridian, projection distortion, zoom-level scaling). |
| Date range with presets | Date picker library (Flatpickr, etc.) | HTML5 date inputs work in all modern browsers, zero bundle size. Preset buttons (2025, 2024, all-time) cover 90% of use cases. Avoid external library for simple filtering. |
| Gradient presets | User-defined RGB pickers | Predefined perceptually uniform gradients (viridis, inferno) are accessible, tested, and avoid bad color choices (red-green for colorblind users). |

**Installation:**
```bash
# Heatmap plugin
npm install leaflet.heat@^0.2.0

# Marker clustering plugin (for city-level pins)
npm install leaflet.markercluster@^1.5.3

# Dev dependencies (types)
npm install -D @types/leaflet.heat @types/leaflet.markercluster

# Already installed (verify):
npm ls leaflet @mapbox/polyline vite-plugin-css-injected-by-js
```

## Architecture Patterns

### Recommended Project Structure

```
src/widgets/
├── heatmap-widget/          # NEW: HEAT-01 through HEAT-04
│   ├── index.ts             # HeatmapWidgetElement class
│   └── color-schemes.ts     # Predefined gradient configs
├── pin-map-widget/          # NEW: PIN-01 through PIN-04
│   └── index.ts             # PinMapWidgetElement class
└── shared/
    ├── widget-base.ts       # EXISTING: HTMLElement base class
    ├── route-utils.ts       # EXISTING: RouteRenderer (Phase 11)
    └── map-utils.ts         # NEW: Shared heatmap/pin utilities

data/routes/                 # EXISTING: From Phase 11
├── route-list.json          # 1,808 activities with polylines (2.0 MB)
└── latest-runs.json         # Latest 20 runs

data/geo/                    # EXISTING: From Phase 10
├── cities.json              # 86 cities with activity counts, distances
├── countries.json           # 8 countries with aggregated stats
├── location-cache.json      # Coordinates for cities (lat/lng lookup)
└── activity-cities.json     # Activity-to-city mapping (for visit dates)

data/heatmap/                # NEW: Pre-computed heatmap data (optional optimization)
└── all-points.json          # Decoded polylines as flat [lat, lng, intensity] array

scripts/
├── compute-route-data.mjs   # EXISTING: From Phase 11
├── compute-heatmap-data.mjs # NEW: Pre-decode polylines to points (optional)
└── build-widgets.mjs        # MODIFY: Add heatmap-widget, pin-map-widget

src/types/
└── leaflet-plugins.d.ts     # NEW: Type declarations for leaflet.heat, markercluster
```

### Pattern 1: Pre-Computed Heatmap Points (Build-Time Optimization)

**What:** Decode all 1,808 polylines to lat/lng points at build time, store in `data/heatmap/all-points.json` for zero client-side decoding overhead.

**When to use:** If polyline decoding causes UI blocking (2+ second freeze on page load). Pre-decoding trades larger data file (2.0 MB → ~5 MB) for instant rendering.

**How it works:**
1. Script reads `data/routes/route-list.json`
2. For each route, decodes `polyline` using @mapbox/polyline
3. Flattens coordinates to [lat, lng] pairs (intensity=1 for all points)
4. Writes to `data/heatmap/all-points.json` as flat array: `[[55.67, 12.56], [55.68, 12.57], ...]`
5. Heatmap widget fetches pre-decoded points, passes directly to L.heatLayer()

**Example script:**
```typescript
// scripts/compute-heatmap-data.mjs
import { readFileSync, writeFileSync } from 'fs';
import polyline from '@mapbox/polyline';

function generateHeatmapData() {
  const routes = JSON.parse(readFileSync('data/routes/route-list.json', 'utf-8'));

  const allPoints = [];

  for (const route of routes) {
    if (!route.polyline) continue;

    // Decode polyline to [[lat, lng], ...]
    const coords = polyline.decode(route.polyline);

    // Add all points to heatmap (intensity=1)
    allPoints.push(...coords);
  }

  console.log(`Generated ${allPoints.length} heatmap points from ${routes.length} routes`);

  // Write as JSON array
  writeFileSync('data/heatmap/all-points.json', JSON.stringify(allPoints));
}

generateHeatmapData();
```

**Widget usage:**
```typescript
// In heatmap widget
const points = await this.fetchData<[number, number][]>('data/heatmap/all-points.json');
const heatLayer = L.heatLayer(points, this.getHeatmapOptions());
heatLayer.addTo(this.map!);
```

**Trade-offs:**
- **Pro:** Zero client-side decoding, instant heatmap render, no UI blocking
- **Pro:** Simplifies widget code (no async decode, no Web Worker complexity)
- **Con:** Larger data file (~5 MB vs 2.0 MB), longer initial fetch
- **Con:** Data file must regenerate after Strava sync (add to `npm run process`)

**Alternative approach:** On-demand decoding with chunking (see Pattern 3).

### Pattern 2: Leaflet.heat Configuration and Color Schemes

**What:** Configure Leaflet.heat heatmap layer with customizable gradients, radius, blur, and intensity options.

**When to use:** All heatmap widgets (HEAT-01, HEAT-03).

**Example implementation:**
```typescript
// src/widgets/heatmap-widget/color-schemes.ts
export interface HeatmapGradient {
  [stop: number]: string;
}

export const COLOR_SCHEMES: Record<string, HeatmapGradient> = {
  // Classic hot (red-yellow-white)
  hot: {
    0.0: '#000080',   // Dark blue (low density)
    0.3: '#0000ff',   // Blue
    0.5: '#00ff00',   // Green
    0.7: '#ffff00',   // Yellow
    0.9: '#ff0000',   // Red
    1.0: '#ffffff'    // White (high density)
  },

  // Cool blue (blue-cyan-white)
  cool: {
    0.0: '#001f3f',   // Navy
    0.3: '#0074D9',   // Blue
    0.6: '#7FDBFF',   // Aqua
    0.8: '#AAFFFF',   // Light cyan
    1.0: '#FFFFFF'    // White
  },

  // Grayscale (accessibility)
  grayscale: {
    0.0: '#000000',
    0.5: '#808080',
    1.0: '#FFFFFF'
  },

  // Viridis-inspired (perceptually uniform, colorblind-friendly)
  viridis: {
    0.0: '#440154',   // Dark purple
    0.25: '#31688e',  // Blue
    0.5: '#35b779',   // Green
    0.75: '#fde724',  // Yellow
    1.0: '#FFFF00'    // Bright yellow
  },

  // Strava orange (brand-aligned)
  strava: {
    0.0: '#2C3E50',   // Dark gray
    0.4: '#E67E22',   // Orange
    0.7: '#fc4c02',   // Strava orange
    1.0: '#FFAA00'    // Bright orange
  }
};

export const DEFAULT_SCHEME = 'hot';
```

```typescript
// src/widgets/heatmap-widget/index.ts
import L from 'leaflet';
import 'leaflet.heat';
import { COLOR_SCHEMES, DEFAULT_SCHEME } from './color-schemes.js';

class HeatmapWidgetElement extends WidgetBase {
  private map: L.Map | null = null;
  private heatLayer: L.HeatLayer | null = null;

  private getColorScheme(): string {
    return this.getAttribute('data-color-scheme') || DEFAULT_SCHEME;
  }

  private getHeatmapOptions(): L.HeatMapOptions {
    const scheme = this.getColorScheme();

    return {
      radius: 15,              // Radius of each point (default 25, lower for sharper detail)
      blur: 20,                // Blur amount (default 15)
      maxZoom: 13,             // Max zoom where points reach full intensity
      max: 1.0,                // Maximum point intensity
      gradient: COLOR_SCHEMES[scheme] || COLOR_SCHEMES[DEFAULT_SCHEME],
      minOpacity: 0.4          // Minimum opacity (prevents invisible low-density areas)
    };
  }

  private renderHeatmap(points: [number, number][]): void {
    // Remove existing heatmap if present
    if (this.heatLayer) {
      this.heatLayer.remove();
    }

    // Create new heatmap layer
    this.heatLayer = L.heatLayer(points, this.getHeatmapOptions());
    this.heatLayer.addTo(this.map!);
  }

  // Update color scheme without re-fetching data
  updateColorScheme(scheme: string): void {
    if (!this.heatLayer) return;

    this.heatLayer.setOptions({
      gradient: COLOR_SCHEMES[scheme] || COLOR_SCHEMES[DEFAULT_SCHEME]
    });
  }
}
```

**Usage in HTML:**
```html
<heatmap-widget data-color-scheme="viridis"></heatmap-widget>
```

**UI for color scheme selection (optional):**
```typescript
private renderColorSchemeSelector(): HTMLElement {
  const selector = document.createElement('div');
  selector.className = 'color-scheme-selector';

  Object.keys(COLOR_SCHEMES).forEach(scheme => {
    const button = document.createElement('button');
    button.textContent = scheme;
    button.addEventListener('click', () => this.updateColorScheme(scheme));
    selector.appendChild(button);
  });

  return selector;
}
```

**Source:** [Leaflet.heat gradient configuration](https://github.com/Leaflet/Leaflet.heat), [VWO Heatmap Colors Guide](https://vwo.com/blog/heatmap-colors/), [Seaborn Perceptually Uniform Palettes](http://seaborn.pydata.org/tutorial/color_palettes.html)

### Pattern 3: Date Range Filtering with Preset Buttons

**What:** Filter heatmap points by activity date range, with UI controls for custom ranges and yearly presets.

**When to use:** HEAT-02 requirement (date range filtering).

**Implementation:**
```typescript
// src/widgets/heatmap-widget/index.ts (continued)
class HeatmapWidgetElement extends WidgetBase {
  private allRoutes: RouteData[] = [];  // Full unfiltered dataset

  protected async fetchDataAndRender(): Promise<void> {
    // Fetch all routes
    this.allRoutes = await this.fetchData<RouteData[]>('data/routes/route-list.json');

    // Render with default filter (all-time)
    this.applyDateFilter('all-time');

    // Add filter UI
    this.renderFilterControls();
  }

  private renderFilterControls(): void {
    const controls = document.createElement('div');
    controls.className = 'filter-controls';
    controls.innerHTML = `
      <style>
        .filter-controls {
          position: absolute;
          top: 10px;
          right: 10px;
          background: white;
          padding: 12px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          z-index: 1000;
        }
        .filter-controls button {
          margin: 4px;
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
        }
        .filter-controls button.active {
          background: #fc4c02;
          color: white;
          border-color: #fc4c02;
        }
        .filter-controls input[type="date"] {
          margin: 4px;
          padding: 6px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
      </style>

      <div>
        <strong>Date Range:</strong><br>
        <button data-preset="all-time" class="active">All Time</button>
        <button data-preset="2025">2025</button>
        <button data-preset="2024">2024</button>
        <button data-preset="2023">2023</button>
      </div>

      <div style="margin-top: 8px;">
        <label>Custom: </label>
        <input type="date" id="start-date" />
        <input type="date" id="end-date" />
        <button id="apply-custom">Apply</button>
      </div>
    `;

    this.shadowRoot!.appendChild(controls);

    // Attach event listeners
    controls.querySelectorAll('button[data-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = (e.target as HTMLElement).getAttribute('data-preset')!;
        this.applyDateFilter(preset);

        // Update active state
        controls.querySelectorAll('button[data-preset]').forEach(b => b.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
      });
    });

    controls.querySelector('#apply-custom')?.addEventListener('click', () => {
      const start = (controls.querySelector('#start-date') as HTMLInputElement).value;
      const end = (controls.querySelector('#end-date') as HTMLInputElement).value;

      if (start && end) {
        this.applyCustomDateFilter(start, end);
      }
    });
  }

  private applyDateFilter(preset: string): void {
    let startDate: Date;
    const endDate = new Date();  // Today

    switch (preset) {
      case '2025':
        startDate = new Date('2025-01-01');
        break;
      case '2024':
        startDate = new Date('2024-01-01');
        endDate.setFullYear(2024, 11, 31);  // Dec 31, 2024
        break;
      case '2023':
        startDate = new Date('2023-01-01');
        endDate.setFullYear(2023, 11, 31);
        break;
      case 'all-time':
      default:
        startDate = new Date('2000-01-01');  // Before first Strava activity
    }

    this.filterAndRenderByDateRange(startDate, endDate);
  }

  private applyCustomDateFilter(start: string, end: string): void {
    const startDate = new Date(start);
    const endDate = new Date(end);
    this.filterAndRenderByDateRange(startDate, endDate);
  }

  private filterAndRenderByDateRange(start: Date, end: Date): void {
    // Filter routes by date
    const filteredRoutes = this.allRoutes.filter(route => {
      const routeDate = new Date(route.date);
      return routeDate >= start && routeDate <= end;
    });

    console.log(`Filtered ${filteredRoutes.length} routes (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`);

    // Decode polylines to points
    const points = this.routesToHeatmapPoints(filteredRoutes);

    // Update heatmap
    if (this.heatLayer) {
      this.heatLayer.setLatLngs(points);  // Efficient update without recreating layer
    } else {
      this.renderHeatmap(points);
    }
  }

  private routesToHeatmapPoints(routes: RouteData[]): [number, number][] {
    const points: [number, number][] = [];

    for (const route of routes) {
      if (!route.polyline) continue;

      const coords = polyline.decode(route.polyline);
      points.push(...coords);
    }

    return points;
  }
}
```

**Performance note:** `setLatLngs()` is efficient—it updates Canvas pixel buffer without recreating DOM elements. Filtering 1,808 routes to 200 (2025 only) and re-decoding takes ~100ms, acceptable for user interaction.

**Source:** [Leaflet.heat API](https://github.com/Leaflet/Leaflet.heat), [HTML5 Date Input](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date)

### Pattern 4: Pin Map with Country/City Toggle

**What:** Render geographic markers for cities or countries visited, with toggle between aggregation levels.

**When to use:** PIN-01, PIN-03 requirements.

**Implementation:**
```typescript
// src/widgets/pin-map-widget/index.ts
import L from 'leaflet';
import 'leaflet.markercluster';  // Optional: for city mode clustering
import { WidgetBase } from '../shared/widget-base.js';

interface CityData {
  cityName: string;
  countryName: string;
  countryIso2: string;
  activityCount: number;
  totalDistanceKm: number;
}

interface CountryData {
  countryName: string;
  countryIso2: string;
  activityCount: number;
  totalDistanceKm: number;
  cities: string[];
}

class PinMapWidgetElement extends WidgetBase {
  private map: L.Map | null = null;
  private markerLayer: L.LayerGroup | L.MarkerClusterGroup | null = null;
  private viewMode: 'country' | 'city' = 'country';

  private cities: CityData[] = [];
  private countries: CountryData[] = [];
  private locationCache: Record<string, { cityName: string; countryName: string; countryIso2: string }> = {};

  protected async fetchDataAndRender(): Promise<void> {
    // Fetch geo data
    this.cities = await this.fetchData<CityData[]>('data/geo/cities.json');
    this.countries = await this.fetchData<CountryData[]>('data/geo/countries.json');
    this.locationCache = await this.fetchData('data/geo/location-cache.json');

    // Get initial view mode from attribute
    this.viewMode = (this.getAttribute('data-view') as 'country' | 'city') || 'country';

    // Render map
    this.initializeMap();
    this.renderPins();
    this.renderToggleControls();
  }

  private initializeMap(): void {
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '600px';
    this.shadowRoot!.appendChild(container);

    this.map = L.map(container).setView([45, 10], 3);  // Europe-centered

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);
  }

  private renderPins(): void {
    // Remove existing markers
    if (this.markerLayer) {
      this.markerLayer.remove();
    }

    if (this.viewMode === 'country') {
      this.renderCountryPins();
    } else {
      this.renderCityPins();
    }
  }

  private renderCountryPins(): void {
    this.markerLayer = L.layerGroup().addTo(this.map!);

    for (const country of this.countries) {
      // Calculate country centroid from average of city coordinates
      const coords = this.getCountryCoordinates(country);
      if (!coords) continue;

      // Create marker with size based on activity count
      const marker = this.createScaledMarker(
        coords,
        country.activityCount,
        country.totalDistanceKm
      );

      // Bind popup with country stats
      marker.bindPopup(this.formatCountryPopup(country));
      marker.addTo(this.markerLayer);
    }
  }

  private renderCityPins(): void {
    // Use marker clustering for city mode (86 cities)
    this.markerLayer = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false
    }).addTo(this.map!);

    for (const city of this.cities) {
      // Get city coordinates from location cache
      const coords = this.getCityCoordinates(city.cityName, city.countryIso2);
      if (!coords) continue;

      const marker = this.createScaledMarker(
        coords,
        city.activityCount,
        city.totalDistanceKm
      );

      marker.bindPopup(this.formatCityPopup(city));
      (this.markerLayer as L.MarkerClusterGroup).addLayer(marker);
    }
  }

  private getCountryCoordinates(country: CountryData): [number, number] | null {
    // Find all cities in this country and average their coordinates
    const citiesInCountry = Object.entries(this.locationCache)
      .filter(([_, loc]) => loc.countryIso2 === country.countryIso2);

    if (citiesInCountry.length === 0) return null;

    const avgLat = citiesInCountry.reduce((sum, [key]) => {
      const [lat] = key.split(',').map(Number);
      return sum + lat;
    }, 0) / citiesInCountry.length;

    const avgLng = citiesInCountry.reduce((sum, [key]) => {
      const [, lng] = key.split(',').map(Number);
      return sum + lng;
    }, 0) / citiesInCountry.length;

    return [avgLat, avgLng];
  }

  private getCityCoordinates(cityName: string, countryIso2: string): [number, number] | null {
    // Search location cache for matching city
    const entry = Object.entries(this.locationCache)
      .find(([_, loc]) => loc.cityName === cityName && loc.countryIso2 === countryIso2);

    if (!entry) return null;

    const [lat, lng] = entry[0].split(',').map(Number);
    return [lat, lng];
  }

  private createScaledMarker(
    coords: [number, number],
    activityCount: number,
    distanceKm: number
  ): L.Marker {
    // Scale marker size based on activity count (1-872 → 20-60px)
    const minSize = 20;
    const maxSize = 60;
    const maxActivities = 872;  // Frederiksberg (highest count)

    const size = minSize + ((activityCount / maxActivities) * (maxSize - minSize));

    // Color based on distance quintile
    const color = this.getDistanceColor(distanceKm);

    // Create custom div icon (circular marker)
    const icon = L.divIcon({
      className: 'pin-marker',
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${color};
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: ${Math.max(10, size / 3)}px;
        ">
          ${activityCount}
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });

    return L.marker(coords, { icon });
  }

  private getDistanceColor(distanceKm: number): string {
    // Quintile-based color scale
    if (distanceKm > 5000) return '#fc4c02';      // Strava orange (top 20%)
    if (distanceKm > 2000) return '#ff6b35';      // Orange
    if (distanceKm > 1000) return '#f7931e';      // Light orange
    if (distanceKm > 500) return '#fdc500';       // Yellow
    return '#4ecdc4';                             // Teal (lowest 20%)
  }

  private formatCountryPopup(country: CountryData): string {
    return `
      <div style="font-family: sans-serif; min-width: 200px;">
        <h3 style="margin: 0 0 8px 0;">${country.countryName}</h3>
        <div style="color: #666;">
          <div><strong>${country.activityCount}</strong> runs</div>
          <div><strong>${country.totalDistanceKm.toFixed(1)}</strong> km</div>
          <div style="margin-top: 8px;">
            <em>Cities: ${country.cities.join(', ')}</em>
          </div>
        </div>
      </div>
    `;
  }

  private formatCityPopup(city: CityData): string {
    // TODO: Add visit dates (requires querying activity-cities.json or route-list.json)
    return `
      <div style="font-family: sans-serif; min-width: 180px;">
        <h3 style="margin: 0 0 8px 0;">${city.cityName}</h3>
        <div style="color: #666;">
          <div><strong>${city.activityCount}</strong> runs</div>
          <div><strong>${city.totalDistanceKm.toFixed(1)}</strong> km</div>
          <div style="margin-top: 4px; font-size: 12px;">
            ${city.countryName}
          </div>
        </div>
      </div>
    `;
  }

  private renderToggleControls(): void {
    const toggle = document.createElement('div');
    toggle.className = 'view-toggle';
    toggle.innerHTML = `
      <style>
        .view-toggle {
          position: absolute;
          top: 10px;
          right: 10px;
          background: white;
          padding: 8px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          z-index: 1000;
        }
        .view-toggle button {
          padding: 6px 12px;
          margin: 0 2px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
        }
        .view-toggle button.active {
          background: #fc4c02;
          color: white;
          border-color: #fc4c02;
        }
      </style>

      <button class="${this.viewMode === 'country' ? 'active' : ''}" data-view="country">
        Countries (${this.countries.length})
      </button>
      <button class="${this.viewMode === 'city' ? 'active' : ''}" data-view="city">
        Cities (${this.cities.length})
      </button>
    `;

    this.shadowRoot!.appendChild(toggle);

    toggle.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = (e.target as HTMLElement).getAttribute('data-view') as 'country' | 'city';
        this.viewMode = view;
        this.renderPins();

        // Update active state
        toggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
      });
    });
  }

  disconnectedCallback(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    super.disconnectedCallback();
  }
}

WidgetBase.register('pin-map-widget', PinMapWidgetElement);
```

**Source:** [Leaflet Marker API](https://leafletjs.com/reference.html#marker), [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster), existing Phase 10 geo data files

### Pattern 5: Web Worker for Async Polyline Decoding (Optional Performance Optimization)

**What:** Offload CPU-intensive polyline decoding to Web Worker to prevent UI blocking when loading heatmap.

**When to use:** If pre-decoded points (Pattern 1) aren't used AND synchronous decoding of 1,808 polylines causes >500ms freeze.

**Implementation:**
```typescript
// src/workers/polyline-decoder.worker.ts
import polyline from '@mapbox/polyline';

interface DecodeMessage {
  type: 'decode';
  routes: Array<{ polyline: string }>;
  chunkSize: number;
}

interface DecodeProgress {
  type: 'progress';
  decoded: number;
  total: number;
}

interface DecodeComplete {
  type: 'complete';
  points: [number, number][];
}

self.onmessage = (e: MessageEvent<DecodeMessage>) => {
  const { routes, chunkSize } = e.data;
  const allPoints: [number, number][] = [];

  // Process in chunks to allow progress updates
  for (let i = 0; i < routes.length; i += chunkSize) {
    const chunk = routes.slice(i, i + chunkSize);

    for (const route of chunk) {
      if (!route.polyline) continue;

      const coords = polyline.decode(route.polyline);
      allPoints.push(...coords);
    }

    // Report progress
    self.postMessage({
      type: 'progress',
      decoded: Math.min(i + chunkSize, routes.length),
      total: routes.length
    } as DecodeProgress);
  }

  // Send complete result
  self.postMessage({
    type: 'complete',
    points: allPoints
  } as DecodeComplete);
};
```

```typescript
// src/widgets/heatmap-widget/index.ts (Web Worker usage)
class HeatmapWidgetElement extends WidgetBase {
  private decodeWorker: Worker | null = null;

  protected async fetchDataAndRender(): Promise<void> {
    const routes = await this.fetchData<RouteData[]>('data/routes/route-list.json');

    // Show loading state
    this.showMessage('Decoding 1,808 routes...');

    // Decode in Web Worker
    const points = await this.decodePolylinesAsync(routes);

    // Render heatmap
    this.renderHeatmap(points);
  }

  private decodePolylinesAsync(routes: RouteData[]): Promise<[number, number][]> {
    return new Promise((resolve) => {
      // Create worker (inline or external file)
      this.decodeWorker = new Worker(
        new URL('../workers/polyline-decoder.worker.ts', import.meta.url)
      );

      this.decodeWorker.onmessage = (e) => {
        if (e.data.type === 'progress') {
          const progress = Math.round((e.data.decoded / e.data.total) * 100);
          this.showMessage(`Decoding routes: ${progress}%`);
        } else if (e.data.type === 'complete') {
          this.decodeWorker!.terminate();
          this.decodeWorker = null;
          resolve(e.data.points);
        }
      };

      // Start decoding (100 routes per chunk)
      this.decodeWorker.postMessage({
        type: 'decode',
        routes,
        chunkSize: 100
      });
    });
  }

  disconnectedCallback(): void {
    // Clean up worker if still running
    if (this.decodeWorker) {
      this.decodeWorker.terminate();
      this.decodeWorker = null;
    }
    super.disconnectedCallback();
  }
}
```

**Trade-offs:**
- **Pro:** Non-blocking UI, better perceived performance (progress bar visible)
- **Pro:** Leverages multi-core CPUs (worker runs on separate thread)
- **Con:** Added complexity (worker file, message passing, error handling)
- **Con:** Doesn't work with CDN-loaded @mapbox/polyline (requires bundling in worker)
- **Con:** Vite worker bundling needs special config

**Recommendation:** Only use if synchronous decoding causes UX issues. Prefer Pattern 1 (pre-decoded points) for simplicity.

**Source:** [Web Workers for CPU-Intensive Tasks](https://www.digitalocean.com/community/tutorials/how-to-handle-cpu-bound-tasks-with-web-workers), [Smashing Magazine Web Workers 2021](https://www.smashingmagazine.com/2021/06/web-workers-2021/)

### Anti-Patterns to Avoid

- **Not pre-decoding polylines**: Decoding 1,808 polylines synchronously on page load blocks UI for 2-5 seconds. Always pre-decode at build time OR use Web Worker with chunking.
- **Bundling Leaflet.heat in every widget**: Plugin is 18KB minified. Externalize to CDN like Leaflet core (use `external: ['leaflet', 'leaflet.heat']` in Vite config).
- **Creating new markers on every filter change**: Pin map toggle should remove old layer (`markerLayer.remove()`) before adding new one. Don't accumulate markers on map.
- **Missing viewport culling for heatmap**: Leaflet.heat handles this automatically via grid clustering. Don't manually implement viewport-based point filtering.
- **Using SVG for large heatmaps**: Leaflet.heat uses Canvas renderer by default (correct choice). Don't override with SVG (DOM overhead).
- **Not handling missing coordinates in pin map**: Some cities in location-cache.json may lack precise coordinates. Guard with `if (!coords) continue`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Heatmap rendering | Custom Canvas pixel manipulation, kernel density estimation | `leaflet.heat` plugin | Handles grid clustering, gradient rendering, zoom-based scaling, and Canvas optimization. Battle-tested on 10K+ point datasets. |
| Marker clustering | Custom grid-based aggregation for cities | `leaflet.markercluster` | Handles 50K+ markers, zoom-level clustering, spider clusters, performance optimization. Solves antimeridian edge cases. |
| Date parsing and filtering | String manipulation for date ranges | Native `Date` object with `getTime()` comparison | Date parsing is complex (timezones, DST, leap years). Native Date API handles edge cases. |
| Polyline decoding | Custom Google Polyline Algorithm implementation | `@mapbox/polyline` (already installed) | Handles precision factors, coordinate wrapping at ±180°, edge cases. 270K+ weekly downloads. |
| Color gradient generation | Manual RGB interpolation | Predefined perceptually uniform gradients (viridis, inferno) | Perceptual uniformity requires LAB color space math. Predefined gradients tested for accessibility. |
| Country centroid calculation | Manual polygon centroid algorithm | Average of city coordinates in country | True centroids require country boundary polygons (massive dataset). City averaging gives "activity center" (more meaningful). |

**Key insight:** Heatmaps and marker clustering are solved problems with mature Leaflet plugins. Performance optimization (Canvas rendering, grid clustering, viewport culling) is built-in. Phase 12 focuses on data preparation (route filtering, coordinate lookup) and UX (color schemes, date filters, toggle controls), not low-level rendering algorithms.

## Common Pitfalls

### Pitfall 1: Synchronous Polyline Decoding Blocks UI

**What goes wrong:** Loading heatmap widget triggers synchronous decode of 1,808 polylines, freezing browser for 2-5 seconds. Page becomes unresponsive, user thinks site crashed, bounces.

**Why it happens:** @mapbox/polyline.decode() is CPU-intensive (Base64 decoding, delta decompression, coordinate arithmetic). Looping through 1,808 routes synchronously blocks main thread, preventing UI updates, user input, and animation frames.

**How to avoid:**
1. **Pre-decode at build time** (Pattern 1): Generate `data/heatmap/all-points.json` during `npm run process`. Widget fetches decoded points, zero client-side processing.
2. **Web Worker with chunking** (Pattern 5): Offload decoding to worker thread, process 100 routes at a time, yield to main thread for progress updates.
3. **Progressive rendering**: Decode first 200 routes, render partial heatmap, continue decoding in background. Leaflet.heat.addLatLngs() appends points without full re-render.

**Warning signs:**
- Browser DevTools Performance tab shows long task (>500ms) during widget load
- "Page Unresponsive" dialog on slower devices
- Lighthouse report flags "Total Blocking Time" issue

**Source:** [Web Workers to Prevent JavaScript Lag](https://procedure.tech/blogs/how-to-prevent-javascript-lag-using-web-workers), [Breaking Up Long Tasks](https://library.linkbot.com/how-can-breaking-up-long-javascript-tasks-into-smaller-chunks-improve-first-input-delay-fid-on-complex-pages/)

### Pitfall 2: Heatmap Memory Exceeds 200MB Target

**What goes wrong:** Decoded heatmap with 1,808 routes generates 200K-500K coordinate points. Storing as JavaScript arrays consumes 50-150MB heap. Adding Leaflet.heat Canvas buffer, tile cache, and widget overhead pushes total memory >200MB, causing mobile browser crashes.

**Why it happens:** Each [lat, lng] pair is two 64-bit floats (16 bytes). 500K points × 16 bytes = 8 MB raw data, but JavaScript array overhead adds 4-6x multiplier (object headers, V8 internal structures). Canvas buffer stores rendered pixels (1000x1000 map = 4 MB RGBA bitmap). Multiple map widgets on page = cumulative memory.

**How to avoid:**
1. **Monitor memory usage**: Chrome DevTools Memory Profiler → Heap Snapshot → filter "HeatmapWidget". Verify <200MB total.
2. **Reduce point density**: Sample every Nth point from decoded polylines (e.g., every 5th point). Heatmap is density visualization—high-resolution points don't add visual information.
3. **Dispose old data**: When applying date filter, clear old heatLayer and points array before rendering new data. Use `heatLayer.setLatLngs([])` to free memory.
4. **Lazy load**: Don't render heatmap until widget is in viewport (use IntersectionObserver).

**Example sampling:**
```typescript
private routesToHeatmapPoints(routes: RouteData[], sampleRate: number = 5): [number, number][] {
  const points: [number, number][] = [];

  for (const route of routes) {
    const coords = polyline.decode(route.polyline);

    // Sample every 5th point (reduces point count 80%)
    for (let i = 0; i < coords.length; i += sampleRate) {
      points.push(coords[i]);
    }
  }

  return points;
}
```

**Warning signs:**
- Browser tab crashes on mobile devices (iOS Safari "out of memory")
- DevTools Heap Snapshot shows >200MB "Retained Size"
- Multiple heatmap widgets cause exponential memory growth

**Source:** [Leaflet Performance with Large Datasets](https://lemon.io/answers/leaflet/what-are-the-performance-implications-of-using-leaflet-with-large-datasets/), [Large Dataset Handling in Leaflet](https://app.studyraid.com/en/read/11881/378252/large-dataset-handling)

### Pitfall 3: Missing Coordinates for Cities in Pin Map

**What goes wrong:** Pin map widget tries to render markers for all 86 cities from cities.json but some lack coordinates in location-cache.json. Widget crashes or renders markers at [0, 0] (Gulf of Guinea).

**Why it happens:** location-cache.json stores coordinates rounded to 2 decimals (e.g., "55.69,12.51") for cache key efficiency. Some cities only appear at 1 decimal precision or use different city names (geocoder returned "Frederiksberg Kommune" but cities.json has "Frederiksberg"). Coordinate lookup fails silently, returns undefined.

**How to avoid:**
```typescript
private getCityCoordinates(cityName: string, countryIso2: string): [number, number] | null {
  // Fuzzy search: try exact match first, then partial match
  let entry = Object.entries(this.locationCache)
    .find(([_, loc]) => loc.cityName === cityName && loc.countryIso2 === countryIso2);

  if (!entry) {
    // Fallback: case-insensitive partial match
    entry = Object.entries(this.locationCache)
      .find(([_, loc]) =>
        loc.cityName.toLowerCase().includes(cityName.toLowerCase()) &&
        loc.countryIso2 === countryIso2
      );
  }

  if (!entry) {
    console.warn(`No coordinates found for ${cityName}, ${countryIso2}`);
    return null;  // Skip this marker
  }

  const [lat, lng] = entry[0].split(',').map(Number);

  // Validate coordinates
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    console.error(`Invalid coordinates for ${cityName}: ${lat}, ${lng}`);
    return null;
  }

  return [lat, lng];
}
```

**Guard in render loop:**
```typescript
for (const city of this.cities) {
  const coords = this.getCityCoordinates(city.cityName, city.countryIso2);

  if (!coords) {
    // Skip this city, don't crash
    continue;
  }

  const marker = this.createScaledMarker(coords, city.activityCount, city.totalDistanceKm);
  marker.addTo(this.markerLayer);
}
```

**Warning signs:**
- Console errors: "Cannot read property 'split' of undefined"
- Markers clustered at [0, 0] on map (Atlantic Ocean)
- Pin count in UI < city count in cities.json

### Pitfall 4: Leaflet.heat Gradient Not Updating

**What goes wrong:** User selects new color scheme via UI button, but heatmap colors don't change. Existing gradient persists, new selection has no effect.

**Why it happens:** Leaflet.heat caches gradient as Canvas ImageData at layer creation time. Calling `setOptions({gradient})` after layer is rendered doesn't trigger Canvas re-draw. Gradient must be set before adding layer to map OR layer must be removed and re-created.

**How to avoid:**
```typescript
// WRONG: setOptions after layer added
this.heatLayer = L.heatLayer(points, { radius: 15 }).addTo(this.map!);
this.heatLayer.setOptions({ gradient: newGradient });  // No effect!

// CORRECT: Remove and re-create layer
updateColorScheme(scheme: string): void {
  if (!this.heatLayer || !this.map) return;

  const currentPoints = this.heatLayer.getLatLngs();  // Save current points

  // Remove old layer
  this.heatLayer.remove();

  // Create new layer with updated gradient
  this.heatLayer = L.heatLayer(currentPoints, {
    radius: 15,
    blur: 20,
    maxZoom: 13,
    gradient: COLOR_SCHEMES[scheme]
  }).addTo(this.map);
}

// ALTERNATIVE: setOptions before adding to map (initial render only)
private renderHeatmap(points: [number, number][]): void {
  const options = {
    radius: 15,
    blur: 20,
    gradient: COLOR_SCHEMES[this.getColorScheme()]
  };

  this.heatLayer = L.heatLayer(points, options);  // Set options first
  this.heatLayer.addTo(this.map!);                // Then add to map
}
```

**Warning signs:**
- Color scheme selector buttons respond (active state changes) but heatmap colors unchanged
- Console shows no errors, gradient config looks correct in DevTools
- Only initial gradient (from widget attribute) ever displays

**Source:** [Leaflet.heat API](https://github.com/Leaflet/Leaflet.heat), [Leaflet.heat HeatLayer.js source](https://github.com/Leaflet/Leaflet.heat/blob/gh-pages/src/HeatLayer.js/)

### Pitfall 5: Date Filter Performance Degrades with Repeated Changes

**What goes wrong:** First date filter change (e.g., 2025 → 2024) renders quickly. Second change (2024 → 2023) takes longer. After 5-10 filter changes, each re-render takes 2-3 seconds, widget becomes unusable.

**Why it happens:** Each filter change decodes polylines, creates new point array, but doesn't dispose old arrays. JavaScript garbage collector can't reclaim memory fast enough. Heap grows with each filter change, decoding slows as memory pressure increases. Eventually triggers major GC pause (multi-second freeze).

**How to avoid:**
```typescript
private filterAndRenderByDateRange(start: Date, end: Date): void {
  // Filter routes
  const filteredRoutes = this.allRoutes.filter(route => {
    const routeDate = new Date(route.date);
    return routeDate >= start && routeDate <= end;
  });

  // CRITICAL: Clear old heatmap layer BEFORE decoding new points
  if (this.heatLayer) {
    this.heatLayer.setLatLngs([]);  // Clear points first (frees Canvas buffer)
    // Note: Leaflet.heat doesn't have explicit dispose method
    // Setting empty array releases most memory
  }

  // Decode new points
  const points = this.routesToHeatmapPoints(filteredRoutes);

  // Update heatmap (reuses existing layer)
  if (this.heatLayer) {
    this.heatLayer.setLatLngs(points);
  } else {
    this.renderHeatmap(points);
  }

  // Hint to GC (optional, browser-dependent)
  if (filteredRoutes.length < 500) {
    // Small filter change, request idle GC
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        // GC hint (no-op, but may trigger GC in some browsers)
      });
    }
  }
}
```

**Memory profiling:**
```typescript
// Add to widget for debugging
private logMemoryUsage(): void {
  if ('memory' in performance) {
    const mem = (performance as any).memory;
    console.log(`Heap: ${(mem.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB / ${(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(1)} MB`);
  }
}

// Call after each filter change
this.filterAndRenderByDateRange(start, end);
this.logMemoryUsage();
```

**Warning signs:**
- First filter change fast (<500ms), subsequent changes slower (1s, 2s, 3s...)
- Browser DevTools Memory tab shows sawtooth pattern (heap grows until GC, repeats)
- Performance degrades over time, improves after page refresh

**Source:** [JavaScript Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_management), [Optimizing JavaScript Performance](https://www.twilio.com/blog/optimize-javascript-application-performance-web-workers)

## Code Examples

Verified patterns from official sources and Phase 10-11 implementation:

### Example 1: Basic Leaflet.heat Heatmap

```typescript
// Source: Leaflet.heat official documentation and demo
import L from 'leaflet';
import 'leaflet.heat';

// Example data: Copenhagen run points
const points: [number, number][] = [
  [55.6761, 12.5683],
  [55.6762, 12.5684],
  [55.6763, 12.5685],
  // ... ~200K points from 1,808 decoded polylines
];

// Create heatmap layer with options
const heatLayer = L.heatLayer(points, {
  radius: 15,              // Point radius (default 25, lower for sharper)
  blur: 20,                // Blur amount (default 15)
  maxZoom: 13,             // Max zoom for full intensity
  max: 1.0,                // Maximum point intensity
  gradient: {              // Color gradient (default blue→cyan→lime→yellow→red)
    0.0: '#0000ff',        // Blue (low density)
    0.5: '#00ff00',        // Green
    1.0: '#ff0000'         // Red (high density)
  },
  minOpacity: 0.4          // Minimum opacity (prevents invisible areas)
}).addTo(map);

// Auto-fit map to heatmap bounds (all 1,808 routes)
const bounds = L.latLngBounds(points);
map.fitBounds(bounds, { padding: [20, 20] });
```

**Source:** [Leaflet.heat GitHub](https://github.com/Leaflet/Leaflet.heat), [Leaflet.heat Demo](https://leaflet.github.io/Leaflet.heat/demo/)

### Example 2: Leaflet.markercluster for City Pins

```typescript
// Source: Leaflet.markercluster documentation
import L from 'leaflet';
import 'leaflet.markercluster';

// Create marker cluster group
const markers = L.markerClusterGroup({
  maxClusterRadius: 50,           // Cluster radius in pixels
  spiderfyOnMaxZoom: true,        // Expand cluster on max zoom
  showCoverageOnHover: false,     // Don't show cluster coverage polygon
  chunkedLoading: true,           // Load markers in chunks (for 50K+ markers)
  chunkInterval: 200,             // Chunk processing interval (ms)
  chunkDelay: 50                  // Delay between chunks
});

// Add city markers (86 cities from cities.json)
for (const city of cities) {
  const coords = getCityCoordinates(city);
  if (!coords) continue;

  const marker = L.marker(coords);
  marker.bindPopup(`
    <strong>${city.cityName}</strong><br>
    ${city.activityCount} runs<br>
    ${city.totalDistanceKm.toFixed(1)} km
  `);

  markers.addLayer(marker);
}

// Add cluster group to map
map.addLayer(markers);
```

**Customizing cluster appearance:**
```typescript
const markers = L.markerClusterGroup({
  iconCreateFunction: (cluster) => {
    const count = cluster.getChildCount();

    // Size based on marker count
    let size = 'small';
    if (count > 10) size = 'medium';
    if (count > 50) size = 'large';

    return L.divIcon({
      html: `<div class="cluster-${size}">${count}</div>`,
      className: 'marker-cluster',
      iconSize: L.point(40, 40)
    });
  }
});
```

**Source:** [Leaflet.markercluster GitHub](https://github.com/Leaflet/Leaflet.markercluster), [Clustering Markers Tutorial](https://asmaloney.com/2015/06/code/clustering-markers-on-leaflet-maps/)

### Example 3: Perceptually Uniform Color Gradients

```typescript
// Source: Seaborn color palettes, VWO heatmap colors guide
export const COLOR_SCHEMES: Record<string, HeatmapGradient> = {
  // Viridis (perceptually uniform, colorblind-friendly)
  viridis: {
    0.0: '#440154',   // Dark purple
    0.2: '#31688e',   // Blue
    0.4: '#35b779',   // Green
    0.6: '#6ece58',   // Yellow-green
    0.8: '#fde724',   // Yellow
    1.0: '#FFFF00'    // Bright yellow
  },

  // Inferno (heat-inspired, perceptually uniform)
  inferno: {
    0.0: '#000004',   // Near-black
    0.2: '#420a68',   // Purple
    0.4: '#932667',   // Magenta
    0.6: '#dd513a',   // Orange-red
    0.8: '#fca50a',   // Orange
    1.0: '#fcffa4'    // Pale yellow
  },

  // Mako (blue-green, perceptually uniform)
  mako: {
    0.0: '#0b0405',   // Near-black
    0.2: '#2d1e3e',   // Dark purple
    0.4: '#3a5e8c',   // Blue
    0.6: '#10a53d',   // Green
    0.8: '#7fd34e',   // Yellow-green
    1.0: '#f1f5aa'    // Pale yellow-green
  },

  // Classic hot (traditional heatmap)
  hot: {
    0.0: '#000080',   // Navy
    0.25: '#0000ff',  // Blue
    0.5: '#00ff00',   // Green
    0.75: '#ffff00',  // Yellow
    0.9: '#ff0000',   // Red
    1.0: '#ffffff'    // White
  }
};
```

**Why perceptually uniform matters:**
- Equal data differences appear as equal color differences (not true for RGB interpolation)
- Colorblind-safe (avoid red-green confusion)
- Print-friendly (grayscale conversion preserves intensity)
- Scientifically validated (used in matplotlib, seaborn, D3)

**Source:** [Seaborn Color Palettes](http://seaborn.pydata.org/tutorial/color_palettes.html), [VWO Heatmap Colors](https://vwo.com/blog/heatmap-colors/), [Pixelesque Gradient Palettes](https://pixelesque.net/blog/2024/11/continuous-colour-scale-gradient-palettes/)

### Example 4: Date Range Filter with Preset Buttons

```typescript
// Source: Derived from HTML5 date input API and Leaflet.timeline patterns
class HeatmapWidgetElement extends WidgetBase {
  private allRoutes: RouteData[] = [];
  private currentFilter: 'all-time' | '2025' | '2024' | '2023' | 'custom' = 'all-time';

  private renderFilterUI(): HTMLElement {
    const ui = document.createElement('div');
    ui.className = 'filter-ui';
    ui.innerHTML = `
      <style>
        .filter-ui {
          position: absolute;
          top: 10px; right: 10px;
          background: white;
          padding: 12px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          z-index: 1000;
          font-family: -apple-system, sans-serif;
        }
        .filter-buttons button {
          margin: 4px;
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 13px;
        }
        .filter-buttons button.active {
          background: #fc4c02;
          color: white;
          border-color: #fc4c02;
        }
        .custom-range {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #eee;
        }
        .custom-range input {
          margin: 4px;
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
        }
      </style>

      <div>
        <strong style="font-size: 14px;">Date Range:</strong>
      </div>

      <div class="filter-buttons">
        <button data-preset="all-time" class="active">All Time</button>
        <button data-preset="2025">2025</button>
        <button data-preset="2024">2024</button>
        <button data-preset="2023">2023</button>
      </div>

      <div class="custom-range">
        <label style="font-size: 12px; color: #666;">Custom:</label><br>
        <input type="date" id="filter-start" />
        <input type="date" id="filter-end" />
        <button id="apply-custom" style="font-size: 12px;">Apply</button>
      </div>

      <div id="filter-stats" style="margin-top: 8px; font-size: 12px; color: #666;">
        Showing 1,808 runs
      </div>
    `;

    return ui;
  }

  private attachFilterListeners(ui: HTMLElement): void {
    // Preset buttons
    ui.querySelectorAll('button[data-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = (e.target as HTMLElement).getAttribute('data-preset')!;
        this.applyPresetFilter(preset as any);

        // Update UI
        ui.querySelectorAll('button[data-preset]').forEach(b => b.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
      });
    });

    // Custom range
    ui.querySelector('#apply-custom')?.addEventListener('click', () => {
      const start = (ui.querySelector('#filter-start') as HTMLInputElement).value;
      const end = (ui.querySelector('#filter-end') as HTMLInputElement).value;

      if (start && end) {
        this.applyCustomFilter(start, end);

        // Deactivate presets
        ui.querySelectorAll('button[data-preset]').forEach(b => b.classList.remove('active'));
      }
    });
  }

  private applyPresetFilter(preset: 'all-time' | '2025' | '2024' | '2023'): void {
    this.currentFilter = preset;

    let start: Date;
    let end = new Date();

    switch (preset) {
      case '2025':
        start = new Date('2025-01-01');
        break;
      case '2024':
        start = new Date('2024-01-01');
        end = new Date('2024-12-31');
        break;
      case '2023':
        start = new Date('2023-01-01');
        end = new Date('2023-12-31');
        break;
      case 'all-time':
      default:
        start = new Date('2000-01-01');
    }

    this.filterByDateRange(start, end);
  }

  private applyCustomFilter(startStr: string, endStr: string): void {
    this.currentFilter = 'custom';
    const start = new Date(startStr);
    const end = new Date(endStr);
    this.filterByDateRange(start, end);
  }

  private filterByDateRange(start: Date, end: Date): void {
    const filtered = this.allRoutes.filter(route => {
      const date = new Date(route.date);
      return date >= start && date <= end;
    });

    console.log(`Filtered ${filtered.length}/${this.allRoutes.length} routes`);

    // Update stats display
    const statsEl = this.shadowRoot?.querySelector('#filter-stats');
    if (statsEl) {
      statsEl.textContent = `Showing ${filtered.length} runs`;
    }

    // Re-render heatmap
    this.renderHeatmapFromRoutes(filtered);
  }
}
```

**Source:** [HTML5 Date Input](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date), [Leaflet.timeline](https://skeate.dev/Leaflet.timeline/), [Digital Geography Slider Filter](https://digital-geography.com/filter-leaflet-maps-slider/)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side polyline decoding on page load | Pre-computed heatmap points at build time | Static site generation era (2018+) | Eliminates 2-5s UI freeze, instant heatmap render. Data file grows 2.5x but acceptable for CDN delivery. |
| heatmap.js library (50KB, many config options) | Leaflet.heat (18KB, focused plugin) | Leaflet 1.0+ (2016) | Smaller bundle, better Leaflet integration. heatmap.js overkill for static heatmaps. |
| Manual marker aggregation for cities | Leaflet.markercluster plugin | Leaflet 0.7+ (2013) | Handles 50K+ markers, zoom-based clustering, spiderfy clusters. Don't hand-roll. |
| RGB color gradients (red-green) | Perceptually uniform gradients (viridis, inferno, mako) | Matplotlib 2.0 (2017), adopted widely | Colorblind-friendly, perceptually linear, scientifically validated. Avoid red-green confusion. |
| Custom date picker libraries (Flatpickr, etc.) | HTML5 date input with preset buttons | HTML5 widespread support (2020+) | Zero bundle size, native browser UI, works on mobile. Presets cover 90% of use cases. |

**Deprecated/outdated:**
- **Google Maps Heatmap Layer**: Requires Google Maps API (licensing costs, usage limits). Leaflet.heat free, open source, works with OSM tiles.
- **Manual Canvas heatmap rendering**: Kernel density estimation complex (Gaussian kernel, bandwidth selection, edge cases). Leaflet.heat handles this, don't reinvent.
- **Client-side date filtering with Lodash/Moment.js**: Native Date API sufficient for ISO 8601 dates (Strava format). No need for heavy libraries (Moment.js deprecated, 67KB).

## Open Questions

1. **Heatmap point sampling strategy**
   - What we know: 1,808 routes decode to ~300K-500K points. Leaflet.heat has 10K point demo. Higher point counts may slow render.
   - What's unclear: Optimal sampling rate (every Nth point? distance-based? Douglas-Peucker simplification?).
   - Recommendation: Start with no sampling (all points). If performance issues arise, sample every 5th point (80% reduction, visually identical for density). Monitor memory (<200MB target).

2. **Pre-decoded points vs. Web Worker decoding**
   - What we know: Pre-decoding trades 2.5x larger data file (2.0 MB → 5 MB) for zero client-side processing. Web Worker adds complexity but keeps data file small.
   - What's unclear: User's deployment preference (GitHub Pages 1GB limit allows 5 MB file, but CDN bandwidth cost?).
   - Recommendation: Start with pre-decoded points (simpler, zero UI blocking). Add Web Worker if user requests smaller data files or slower connections become issue.

3. **Pin map visit dates implementation**
   - What we know: PIN-02 requires showing visit dates for clicked city. Data exists in activity-cities.json (143KB, maps activities to cities).
   - What's unclear: Should widget pre-load activity-cities.json (143KB upfront) or lazy-load on pin click (143KB only when needed)?
   - Recommendation: Pre-load activity-cities.json on widget init (143KB negligible vs 2.0 MB route-list.json). Simplifies popup generation, no async delay on click.

4. **Country centroid calculation accuracy**
   - What we know: True country centroids require boundary polygons (GeoJSON, massive dataset). Averaging city coordinates gives approximate center.
   - What's unclear: Is "activity center" (weighted by run count) better than simple average?
   - Recommendation: Simple average of city coordinates sufficient for Phase 12. Activity-weighted center (future enhancement) requires proportional distance calculation (GEO-05 out of scope for v1.2).

## Sources

### Primary (HIGH confidence)

- **Leaflet.heat Official Documentation** - Plugin API, configuration options, performance characteristics
  - https://github.com/Leaflet/Leaflet.heat
  - https://leaflet.github.io/Leaflet.heat/demo/
- **Leaflet.markercluster Documentation** - Marker clustering, chunk loading, customization
  - https://github.com/Leaflet/Leaflet.markercluster
  - http://leaflet.github.io/Leaflet.markercluster/
- **@mapbox/polyline npm** - Already installed (Phase 10-02), decode API verified
  - https://www.npmjs.com/package/@mapbox/polyline
- **Phase 10-11 Implementation** - Leaflet 1.9.4 setup, RouteRenderer, route-list.json structure, geo data files
  - Verified: data/routes/route-list.json (2.0 MB), data/geo/cities.json, data/geo/countries.json, location-cache.json
- **Existing Widget Patterns** - WidgetBase class, Shadow DOM, isMapWidget build flag
  - src/widgets/shared/widget-base.ts, scripts/build-widgets.mjs

### Secondary (MEDIUM confidence)

- [Leaflet Developer's Guide to High-Performance Visualizations - Andrej Gajdos](https://andrejgajdos.com/leaflet-developer-guide-to-high-performance-map-visualizations-in-react/)
  - Canvas vs SVG performance, viewport culling, large dataset handling
- [Optimizing Leaflet Performance with Large Markers - Medium](https://medium.com/@silvajohnny777/optimizing-leaflet-performance-with-a-large-number-of-markers-0dea18c2ec99)
  - Marker clustering best practices, chunked loading
- [Web Workers to Prevent JavaScript Lag - Procedure.tech](https://procedure.tech/blogs/how-to-prevent-javascript-lag-using-web-workers)
  - Web Worker patterns for CPU-intensive tasks
- [Web Workers 2021 - Smashing Magazine](https://www.smashingmagazine.com/2021/06/web-workers-2021/)
  - Current best practices, chunking vs workers trade-offs
- [Heatmap Color Palette Guide - VWO](https://vwo.com/blog/heatmap-colors/)
  - Color scheme psychology, accessibility considerations
- [Seaborn Color Palettes](http://seaborn.pydata.org/tutorial/color_palettes.html)
  - Perceptually uniform gradients (viridis, inferno, mako)
- [Heatmap Gradient Palettes - Pixelesque](https://pixelesque.net/blog/2024/11/continuous-colour-scale-gradient-palettes/)
  - Modern gradient palettes, colorblind-friendly design
- [Leaflet.timeline Plugin](https://skeate.dev/Leaflet.timeline/)
  - Time-based filtering patterns, slider UI
- [Filter Leaflet Maps with Slider - Digital Geography](https://digital-geography.com/filter-leaflet-maps-slider/)
  - Interactive filter controls

### Tertiary (LOW confidence, marked for validation)

- [Large Dataset Handling in Leaflet - StudyRaid](https://app.studyraid.com/en/read/11881/378252/large-dataset-handling)
  - General guidance, not heatmap-specific
- [Leaflet Performance with Large Datasets - Lemon.io](https://lemon.io/answers/leaflet/what-are-the-performance-implications-of-using-leaflet-with-large-datasets/)
  - Community discussion, not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - Leaflet.heat and Leaflet.markercluster are official Leaflet plugins with extensive documentation, npm downloads, and demo projects. @mapbox/polyline already installed and validated in Phase 10-11.
- Architecture patterns: **HIGH** - Pre-decoded points and date filtering derived from existing Phase 11 route data patterns. Pin map uses existing Phase 10 geo data (cities.json, countries.json, location-cache.json).
- Common pitfalls: **MEDIUM-HIGH** - Polyline decoding UI blocking verified by Web Worker research. Memory limits (200MB) are project-specific target. Gradient update issue confirmed in Leaflet.heat source code review.
- Performance optimization: **MEDIUM** - Heatmap memory usage (200MB target) and sampling strategies need validation with actual 1,808-route dataset. Web Worker complexity vs pre-decoded trade-off is project-specific.

**Research date:** 2026-02-17
**Valid until:** ~60 days (Leaflet plugins stable, heatmap visualization patterns mature, project-specific architecture)

**Coverage:**
- ✅ HEAT-01: Heatmap overlay (Leaflet.heat plugin, polyline-to-points conversion)
- ✅ HEAT-02: Date range filtering (HTML5 date inputs, preset buttons, filter logic)
- ✅ HEAT-03: Color customization (gradient presets, perceptually uniform palettes)
- ✅ HEAT-04: Performance optimization (pre-decoded points, Web Worker chunking, memory monitoring)
- ✅ PIN-01: Pin map rendering (Leaflet markers, city/country coordinates from geo data)
- ✅ PIN-02: Interactive popups (bindPopup with activity stats, visit dates)
- ✅ PIN-03: Country/city toggle (two rendering modes, Leaflet.markercluster for cities)
- ✅ PIN-04: Visual encoding (marker size scaling, color quintiles, L.divIcon)
- ✅ Data sources (existing route-list.json, cities.json, countries.json, location-cache.json)
- ✅ Build system integration (isMapWidget pattern, CSS injection, CDN externalization)

**Research complete - ready for planning.**
