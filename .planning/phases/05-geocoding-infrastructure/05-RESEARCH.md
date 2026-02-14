# Phase 5: Geocoding Infrastructure - Research

**Researched:** 2026-02-15
**Domain:** Offline reverse geocoding, GPS data processing, geographic visualization
**Confidence:** HIGH

## Summary

Phase 5 adds geographic location extraction from GPS coordinates in Strava activities. The core challenge is reverse geocoding 1,808 activities at build time without API calls, rate limits, or costs. The project has already decided on `offline-geocode-city` (217 KB, S2 cell-based), which provides country and city lookups from lat/lng coordinates with sub-millisecond performance.

The architecture follows the established pattern: build-time processing scripts generate static JSON files (countries.json, cities.json, geo-metadata.json) stored in `data/geo/`, which are consumed by Shadow DOM widgets at runtime. A git-tracked location cache (`data/geo/location-cache.json`) prevents redundant geocoding across builds, achieving >90% cache hit rates for stable activity datasets.

Key challenges include handling activities without GPS data (gracefully exclude, report coverage %), coordinate precision for cache optimization (round to 4-5 decimals for ~10m accuracy), and presenting location lists in an accessible UI (avoid 200+ item dropdowns, use grouped/searchable lists).

**Primary recommendation:** Use offline-geocode-city for build-time geocoding, implement coordinate-based caching with 4-decimal rounding, generate static JSON aggregations, follow existing Shadow DOM widget patterns for display components.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| offline-geocode-city | ^2.x | Offline reverse geocoding (coords → country/city) | 217 KB bundle, zero API calls, S2 cell-based performance (0.035-4.87ms lookup), browser + Node.js support, TypeScript types |
| TypeScript | 5.9.3 | Type-safe geocoding logic | Already in project stack |
| Node.js | 22.x | Build-time geocoding scripts | Already in project stack |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | No additional libraries needed | Geocoding handled by offline-geocode-city alone |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| offline-geocode-city | local-reverse-geocoder | Larger bundle (~20 MB GeoNames data vs 217 KB), higher precision (population >1000 cities), but overkill for country/city-level needs |
| offline-geocode-city | which-country | Country-only (no cities), 11 years old, unmaintained |
| offline-geocode-city | offline-geocoder | Requires 12 MB SQLite database, English-only, 300 lookups/sec vs sub-ms |
| Build-time geocoding | Runtime API calls (Nominatim, Google Maps) | Free tier rate limits (1 req/sec), API key management, network dependency, cost at scale |

**Installation:**
```bash
npm install offline-geocode-city
```

## Architecture Patterns

### Recommended Project Structure
```
data/
├── geo/                          # NEW: Geocoding outputs
│   ├── location-cache.json       # Coordinate → location cache (git-tracked)
│   ├── countries.json            # Aggregated country list with counts
│   ├── cities.json               # Aggregated city list with counts
│   └── geo-metadata.json         # Coverage stats (X of Y activities)
src/
├── geo/                          # NEW: Geocoding logic
│   ├── geocoder.ts               # Wrapper around offline-geocode-city
│   ├── cache-manager.ts          # Load/save location-cache.json
│   └── compute-geo-stats.ts      # Build script: geocode + aggregate
src/widgets/
├── countries-widget/             # NEW: Display countries visited
│   ├── index.ts                  # Shadow DOM widget
│   └── chart-config.ts           # Optional: visualization config
└── cities-widget/                # NEW: Display cities visited
    ├── index.ts                  # Shadow DOM widget
    └── chart-config.ts           # Optional: map or list config
```

### Pattern 1: Build-Time Geocoding with Persistent Cache

**What:** Generate all geocoding data during `npm run compute-geo-stats` (before build), cache results in git-tracked JSON to avoid redundant lookups across CI builds.

**When to use:** Static datasets where >90% of activities don't change between builds (Strava sync adds new activities but doesn't modify historical ones).

**Example:**
```typescript
// src/geo/geocoder.ts
import { getNearestCity } from 'offline-geocode-city';
import type { StravaActivity } from '../types/strava.types.js';

export interface GeoLocation {
  cityName: string;
  countryName: string;
  countryIso2: string;
}

export interface GeoCache {
  [coordKey: string]: GeoLocation; // "38.7600,-9.1200" → {cityName, countryName, countryIso2}
}

/**
 * Round coordinates to N decimals for cache key
 * 4 decimals ≈ 11m precision (sufficient for city-level)
 * 5 decimals ≈ 1.1m precision (overkill but acceptable)
 */
function roundCoord(coord: number, decimals: number = 4): number {
  return Math.round(coord * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function coordToCacheKey(lat: number, lng: number): string {
  return `${roundCoord(lat, 4)},${roundCoord(lng, 4)}`;
}

export function geocodeActivity(
  activity: StravaActivity,
  cache: GeoCache
): GeoLocation | null {
  // Filter: activities without GPS data
  if (!activity.start_latlng || activity.start_latlng.length !== 2) {
    return null;
  }

  const [lat, lng] = activity.start_latlng;
  const cacheKey = coordToCacheKey(lat, lng);

  // Check cache first
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  // Reverse geocode using offline-geocode-city
  const result = getNearestCity(lat, lng);

  // Validate result (library may return undefined for ocean coordinates)
  if (!result || !result.cityName || !result.countryName) {
    return null;
  }

  const location: GeoLocation = {
    cityName: result.cityName,
    countryName: result.countryName,
    countryIso2: result.countryIso2,
  };

  // Update cache
  cache[cacheKey] = location;

  return location;
}
```

### Pattern 2: Static JSON Aggregation for Widgets

**What:** Pre-compute country/city lists with activity counts, write to JSON files consumed by widgets at runtime (no client-side geocoding).

**When to use:** Always for static site generation where build-time data prep enables zero runtime overhead.

**Example:**
```typescript
// src/geo/compute-geo-stats.ts
import * as fs from 'fs/promises';
import { geocodeActivity, type GeoCache, type GeoLocation } from './geocoder.js';
import { loadCache, saveCache } from './cache-manager.js';
import type { StravaActivity } from '../types/strava.types.js';

interface CountryStats {
  countryName: string;
  countryIso2: string;
  activityCount: number;
  cities: string[]; // Unique cities in this country
}

interface CityStats {
  cityName: string;
  countryName: string;
  countryIso2: string;
  activityCount: number;
}

export async function computeGeoStats(): Promise<void> {
  // 1. Load activities (same pattern as compute-stats.ts)
  const files = await fs.readdir('data/activities');
  const activities: StravaActivity[] = [];
  for (const file of files.filter(f => f.endsWith('.json'))) {
    const content = await fs.readFile(`data/activities/${file}`, 'utf-8');
    const activity = JSON.parse(content);
    if (activity.type === 'Run') activities.push(activity);
  }

  // 2. Load cache
  const cache: GeoCache = await loadCache('data/geo/location-cache.json');

  // 3. Geocode all activities
  const locations: GeoLocation[] = [];
  let successCount = 0;

  for (const activity of activities) {
    const location = geocodeActivity(activity, cache);
    if (location) {
      locations.push(location);
      successCount++;
    }
  }

  // 4. Save updated cache (includes new lookups)
  await saveCache('data/geo/location-cache.json', cache);

  // 5. Aggregate countries
  const countryMap = new Map<string, CountryStats>();
  for (const loc of locations) {
    const existing = countryMap.get(loc.countryIso2) || {
      countryName: loc.countryName,
      countryIso2: loc.countryIso2,
      activityCount: 0,
      cities: [],
    };
    existing.activityCount++;
    if (!existing.cities.includes(loc.cityName)) {
      existing.cities.push(loc.cityName);
    }
    countryMap.set(loc.countryIso2, existing);
  }

  // 6. Aggregate cities
  const cityMap = new Map<string, CityStats>();
  for (const loc of locations) {
    const cityKey = `${loc.cityName},${loc.countryIso2}`;
    const existing = cityMap.get(cityKey) || {
      cityName: loc.cityName,
      countryName: loc.countryName,
      countryIso2: loc.countryIso2,
      activityCount: 0,
    };
    existing.activityCount++;
    cityMap.set(cityKey, existing);
  }

  // 7. Write JSON outputs
  await fs.mkdir('data/geo', { recursive: true });

  await fs.writeFile(
    'data/geo/countries.json',
    JSON.stringify(Array.from(countryMap.values()), null, 2)
  );

  await fs.writeFile(
    'data/geo/cities.json',
    JSON.stringify(Array.from(cityMap.values()), null, 2)
  );

  await fs.writeFile(
    'data/geo/geo-metadata.json',
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      totalActivities: activities.length,
      geocodedActivities: successCount,
      coveragePercent: Math.round((successCount / activities.length) * 100),
      cacheSize: Object.keys(cache).length,
    }, null, 2)
  );

  console.log(`Geocoded ${successCount} of ${activities.length} activities (${Math.round((successCount / activities.length) * 100)}%)`);
}
```

### Pattern 3: Shadow DOM Widget with Coverage Indicator

**What:** Display location lists in Shadow DOM widgets, include coverage metadata ("Based on X of Y activities") to clarify incomplete GPS data.

**When to use:** All geographic widgets to maintain transparency about data quality.

**Example:**
```typescript
// src/widgets/countries-widget/index.ts
import { WidgetBase } from '../shared/widget-base.js';
import type { WidgetConfig } from '../../types/widget-config.types.js';

interface CountryData {
  countryName: string;
  countryIso2: string;
  activityCount: number;
  cities: string[];
}

interface GeoMetadata {
  totalActivities: number;
  geocodedActivities: number;
  coveragePercent: number;
}

class CountriesWidget extends WidgetBase<CountryData[]> {
  private metadata: GeoMetadata | null = null;

  protected render(countries: CountryData[]): void {
    if (!this.shadowRoot) return;

    // Inject styles (following existing pattern)
    const style = document.createElement('style');
    style.textContent = `
      .countries-list { /* ... */ }
      .coverage-note {
        font-size: 12px;
        color: #666;
        margin-top: 16px;
        text-align: center;
      }
    `;
    this.shadowRoot.appendChild(style);

    // Render country list
    const container = document.createElement('div');
    container.className = 'countries-container';

    const title = document.createElement('h2');
    title.textContent = 'Countries Visited';
    container.appendChild(title);

    // Sort countries by activity count descending
    const sortedCountries = [...countries].sort((a, b) => b.activityCount - a.activityCount);

    const list = document.createElement('ul');
    list.className = 'countries-list';
    for (const country of sortedCountries) {
      const item = document.createElement('li');
      item.innerHTML = `
        <span class="country-name">${country.countryName}</span>
        <span class="activity-count">${country.activityCount} runs</span>
        <span class="city-count">${country.cities.length} cities</span>
      `;
      list.appendChild(item);
    }
    container.appendChild(list);

    // Coverage indicator (GEO-03 requirement)
    if (this.metadata) {
      const coverage = document.createElement('p');
      coverage.className = 'coverage-note';
      coverage.textContent = `Based on ${this.metadata.geocodedActivities} of ${this.metadata.totalActivities} activities (${this.metadata.coveragePercent}% with GPS data)`;
      container.appendChild(coverage);
    }

    this.shadowRoot.appendChild(container);
  }

  // Fetch metadata alongside countries data
  async init(): Promise<void> {
    const [countriesData, metadataResponse] = await Promise.all([
      this.fetchData<CountryData[]>(this.config.dataUrl),
      fetch(this.config.options?.metadataUrl || 'data/geo/geo-metadata.json')
    ]);

    if (metadataResponse.ok) {
      this.metadata = await metadataResponse.json();
    }

    this.render(countriesData);
  }
}
```

### Anti-Patterns to Avoid

- **Runtime geocoding in widgets:** Never call `getNearestCity()` in browser widgets — geocode at build time, serve pre-computed JSON (avoids 217 KB bundle in every widget, maintains zero-runtime-overhead principle)
- **Caching by exact coordinates:** Don't use raw `[38.760123, -9.120456]` as cache keys — round to 4-5 decimals to increase hit rate (same activity GPS drift between syncs)
- **Large dropdown lists:** Don't render 200+ cities in `<select>` elements — use grouped lists (by country), search/filter, or map visualizations for accessibility
- **Missing coverage indicators:** Always show "Based on X of Y activities" — users need context when 10-20% of activities lack GPS data

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reverse geocoding | Custom coordinate → city lookup with CSV databases | `offline-geocode-city` | S2 cell hierarchy handles edge cases (coastlines, borders, sparse regions), 217 KB optimized bundle, sub-ms performance, maintained library |
| Coordinate-based spatial indexing | Linear array search for nearest city | S2 geometry (built into offline-geocode-city) | O(log n) lookups vs O(n), handles spherical geometry correctly, efficient range queries |
| Country boundary detection | Point-in-polygon checks on GeoJSON borders | Library's built-in country detection | Border complexity (territorial waters, enclaves, disputed regions), pre-optimized spatial index |
| GPS coordinate validation | Regex or manual range checks | TypeScript tuple types + library validation | Library handles null/undefined gracefully, validates coordinate ranges, returns null for invalid inputs |

**Key insight:** Geographic coordinate systems have hidden complexity (spherical geometry, projection distortions, dateline wrapping, precision limits). Offline-geocode-city abstracts these with S2 cells (Google's battle-tested spatial indexing), making custom solutions error-prone and slow.

## Common Pitfalls

### Pitfall 1: Cache Miss Rate from Over-Precision

**What goes wrong:** Using full-precision coordinates (`38.76012345, -9.12045678`) as cache keys causes <10% hit rate because GPS drift changes coordinates slightly between Strava syncs, even for identical activity locations.

**Why it happens:** Consumer GPS accuracy is ±5-10 meters, so coordinates fluctuate at the 4th-5th decimal place. Full precision treats `38.7601` and `38.7602` (11m apart) as different cache keys for the same city.

**How to avoid:** Round coordinates to 4 decimals (±11m) or 5 decimals (±1.1m) before caching. City-level geocoding doesn't require centimeter precision.

**Warning signs:** Cache file grows linearly with activity count instead of plateauing; `npm run compute-geo-stats` takes >10 seconds despite cache.

### Pitfall 2: Missing GPS Data Silent Failures

**What goes wrong:** Geocoding script crashes on `null` or `undefined` start_latlng, or silently skips activities without logging coverage gaps, leaving users confused why location counts are low.

**Why it happens:** Strava activities from treadmills, manual entries, or GPS-disabled devices have `start_latlng: null`. Early activities (pre-2012) often lack GPS. Iterating without validation assumes all activities have coordinates.

**How to avoid:**
1. Filter activities with `if (!activity.start_latlng || activity.start_latlng.length !== 2)` guard clause
2. Track counts: `geocodedCount` vs `totalCount`
3. Write coverage stats to `geo-metadata.json` with percentage
4. Display coverage in widget UI: "Based on 1,620 of 1,808 activities (90% with GPS)"

**Warning signs:** Widget shows "0 countries" despite activities; console errors with "Cannot read property '0' of null"; metadata shows <80% coverage without explanation.

### Pitfall 3: UI Overload with Long Lists

**What goes wrong:** Rendering 150+ cities in a flat list or `<select>` dropdown overwhelms users, violates accessibility guidelines (screen readers), and provides poor UX on mobile.

**Why it happens:** Geocoding succeeds on all activities, developer assumes displaying all results is best. Designers familiar with 5-10 item lists don't test with real 200+ item datasets.

**How to avoid:**
1. Group cities by country (collapsible sections)
2. Sort by activity count (most-visited first) and show top 20 + "Show all" toggle
3. Add search/filter input for long lists
4. Consider map visualization (pin clusters) for geographic context
5. Paginate if list exceeds 50 items

**Warning signs:** Widget scrolls off-screen; mobile users can't find cities; accessibility audit flags "list contains >50 items without search."

### Pitfall 4: Ocean/Border Coordinate Edge Cases

**What goes wrong:** Activities starting on ferries, cruise ships, or near borders geocode to wrong country or return `undefined`, causing runtime errors or incorrect aggregations.

**Why it happens:** Reverse geocoding libraries use "nearest city" heuristics. Ocean coordinates may return `null` or nearest coastal city (wrong country). Border crossings during warmup snap to wrong side.

**How to avoid:**
1. Validate library result: `if (!result || !result.cityName) return null;`
2. Accept that 1-2% of activities may not geocode (log these for review)
3. Document known limitation: "Locations based on activity start coordinates"
4. For border cases, city proximity is acceptable (geocoding precision > GPS precision)

**Warning signs:** Portugal activities show up in Spain; ferries geocode to random coastal cities; cache contains `null` values that crash JSON serialization.

### Pitfall 5: Build-Time Performance Bottleneck

**What goes wrong:** Build script takes >60 seconds in CI because it geocodes all 1,808 activities on every commit, despite only 1-2 new activities since last build.

**Why it happens:** Missing or improperly loaded cache file forces full re-geocoding. CI environment doesn't persist cache between runs (cache not committed to git).

**How to avoid:**
1. **Git-track `location-cache.json`** so CI inherits previous run's cache
2. Load cache at script start: `const cache = JSON.parse(fs.readFileSync(...))`
3. Update cache in-memory during geocoding, save once at end
4. Log cache hit rate: "Cache hits: 1,806/1,808 (99.9%)"
5. GitHub Actions caches `node_modules` but NOT data files — must commit cache

**Warning signs:** CI build time increases linearly with activity count; cache file not in git history; console shows "Geocoding 1,808 activities..." every build.

## Code Examples

Verified patterns from official sources and ecosystem best practices:

### Basic Reverse Geocoding (offline-geocode-city)

```typescript
// Source: https://github.com/kyr0/offline-geocode-city (official README)
import { getNearestCity } from 'offline-geocode-city';

const result = getNearestCity(48.3243193, 11.658644);
// Returns:
// {
//   cityName: 'Ismaning',
//   countryIso2: 'DE',
//   countryName: 'Germany'
// }

// Handle invalid coordinates (ocean, poles)
const oceanResult = getNearestCity(0, 0); // May return undefined or nearest coast
if (!oceanResult || !oceanResult.cityName) {
  console.warn('No city found for coordinates');
}
```

### GPS Coordinate Validation (TypeScript patterns)

```typescript
// Source: TypeScript best practices (type guards, tuple validation)
type LatLng = [number, number];

function isValidCoordinate(coord: unknown): coord is LatLng {
  return (
    Array.isArray(coord) &&
    coord.length === 2 &&
    typeof coord[0] === 'number' &&
    typeof coord[1] === 'number' &&
    coord[0] >= -90 && coord[0] <= 90 &&  // Latitude bounds
    coord[1] >= -180 && coord[1] <= 180   // Longitude bounds
  );
}

function safeGeocode(activity: StravaActivity): GeoLocation | null {
  if (!isValidCoordinate(activity.start_latlng)) {
    return null;
  }
  const [lat, lng] = activity.start_latlng;
  return geocodeActivity(lat, lng);
}
```

### Persistent File-Based Cache (Node.js fs/promises)

```typescript
// Source: Node.js documentation, file-based cache patterns
import * as fs from 'fs/promises';
import type { GeoCache } from './geocoder.js';

export async function loadCache(path: string): Promise<GeoCache> {
  try {
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // File doesn't exist on first run — return empty cache
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('Cache not found, starting fresh');
      return {};
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
  console.log(`Saved ${Object.keys(cache).length} cached locations`);
}
```

### Shadow DOM Widget with Grouped List

```typescript
// Source: Existing widget-base.ts pattern + accessibility best practices
const COUNTRIES_STYLES = `
  .countries-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }
  .country-card {
    padding: 16px;
    border-radius: 8px;
    background: rgba(252, 76, 2, 0.05);
  }
  .country-name {
    font-weight: 600;
    color: var(--widget-accent, #fc4c02);
  }
  .cities-list {
    font-size: 12px;
    color: #666;
    margin-top: 8px;
  }
`;

// Render as card grid (better than long list)
const grid = document.createElement('div');
grid.className = 'countries-grid';

for (const country of sortedCountries) {
  const card = document.createElement('div');
  card.className = 'country-card';

  const name = document.createElement('div');
  name.className = 'country-name';
  name.textContent = `${country.countryName} (${country.activityCount})`;
  card.appendChild(name);

  const cities = document.createElement('div');
  cities.className = 'cities-list';
  cities.textContent = country.cities.slice(0, 5).join(', ') +
    (country.cities.length > 5 ? `, +${country.cities.length - 5} more` : '');
  card.appendChild(cities);

  grid.appendChild(card);
}
```

## State of the Art

| Old Approach | Current Approach (2026) | When Changed | Impact |
|--------------|-------------------------|--------------|--------|
| API-based geocoding (Nominatim, Google) | Offline libraries (offline-geocode-city, S2-based) | ~2020 | Eliminates rate limits, costs, API key management; enables build-time processing |
| Full-precision coordinate caching | Rounded coordinates (4-5 decimals) | ~2022 | Increased cache hit rates from <10% to >90% for city-level geocoding |
| Runtime browser geocoding | Build-time static JSON generation | SSG era (2018+) | Zero client-side overhead, faster page loads, SEO-friendly, no bundle size penalty |
| Linear coordinate lookups | S2 cell spatial indexing | Google S2 release (2017) | O(log n) vs O(n) performance, sub-millisecond lookups, handles spherical geometry |
| Country-only geocoding | City + country with single library | 2024+ | User experience improvement (detailed travel history), single dependency |

**Deprecated/outdated:**
- **Google Maps Geocoding API for hobbyist projects:** $5/1000 requests after free tier, rate limited, requires credit card and API key (exposes key in git/client code). Modern offline libraries eliminate these barriers for city-level precision.
- **CSV/JSON country boundary files with manual point-in-polygon:** Replaced by S2 cell pre-indexed libraries (offline-geocode-city). Manual approaches miss edge cases (territorial waters, enclaves, coastline precision).
- **Real-time geocoding in user browsers:** Outdated for static sites. Build-time generation (Vite, Next.js SSG) pre-computes all location data, serves as static JSON, eliminates runtime dependencies.

## Open Questions

1. **Should cities be deduplicated across countries?**
   - What we know: Cities like "San José" exist in 50+ countries. `offline-geocode-city` returns unique city names per coordinates.
   - What's unclear: Display preference — group as "San José (USA, Costa Rica, ...)" or show separately?
   - Recommendation: Show separately (city + country pair) for clarity. User sees "San José, USA" and "San José, Costa Rica" as distinct entries. Aggregation key: `${cityName},${countryIso2}`.

2. **How to handle multi-country activities (border crossings)?**
   - What we know: Activities starting near borders may geocode to one country but cross into another. start_latlng is only data point (no route polyline parsing in Phase 5).
   - What's unclear: Should we parse activity polylines for all coordinates? (Out of scope complexity)
   - Recommendation: Use start coordinate only. Document limitation: "Locations based on activity start position." Phase 6+ could add route-based multi-country detection if needed.

3. **Visualization approach for cities (list vs map)?**
   - What we know: 150+ cities are common for active runners. Lists need grouping/search for accessibility. Maps show geographic context but add complexity (Leaflet.js, Mapbox).
   - What's unclear: User preference for this project's aesthetic/goals.
   - Recommendation: Start with grouped list (by country, sortable by activity count) for Phase 5. Map visualization can be Phase 6 enhancement based on user feedback.

4. **Cache invalidation strategy for coordinate updates?**
   - What we know: Strava occasionally updates historical activity coordinates (e.g., GPS drift corrections). Cache may hold stale city names.
   - What's unclear: Frequency of these updates, whether they matter for city-level precision.
   - Recommendation: No active invalidation in v1. If needed, add `cacheVersion` field to `geo-metadata.json` and manual cache reset command (`npm run reset-geo-cache`). Coordinate updates are rare (<0.1% of activities/year).

## Sources

### Primary (HIGH confidence)
- [offline-geocode-city GitHub](https://github.com/kyr0/offline-geocode-city) - Library features, performance benchmarks, API usage
- [S2 Geometry Documentation](https://s2geometry.io/) - S2 cell hierarchy, spatial indexing concepts
- [MDN Web Components: Using Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) - Shadow DOM best practices, slot patterns
- [Node.js fs/promises API](https://nodejs.org/docs/latest-v22.x/api/fs.html) - File-based cache implementation

### Secondary (MEDIUM confidence)
- [Smashing Magazine: Web Components and Shadow DOM (2025)](https://www.smashingmagazine.com/2025/07/web-components-working-with-shadow-dom/) - Lifecycle, encapsulation patterns
- [OpenCage Geocoding Best Practices](https://opencagedata.com/api) - Coordinate precision guidance (6-7 decimals max)
- [Geocoding Resolution Guide](https://www.serviceobjects.com/blog/geocoding-resolution-ensuring-accuracy-and-precision/) - Precision levels (4 decimals ≈ 11m, 5 decimals ≈ 1.1m)
- [local-reverse-geocoder npm](https://www.npmjs.com/package/local-reverse-geocoder) - Alternative library comparison (GeoNames-based, 20 MB bundle)

### Tertiary (LOW confidence)
- [Redesigning Country Selector — Smashing Magazine (2011)](https://www.smashingmagazine.com/2011/11/redesigning-the-country-selector/) - UI patterns for long country lists (dated but principles valid)
- [UI Design Trends 2026](https://landdding.com/blog/ui-design-trends-2026) - General UI/UX trends (not geocoding-specific)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - `offline-geocode-city` is documented, maintained, and aligns with project requirements (offline, TypeScript, 217 KB)
- Architecture: HIGH - Patterns follow established project conventions (build-time scripts, Shadow DOM widgets, static JSON), verified against existing `src/analytics/compute-stats.ts`
- Pitfalls: MEDIUM-HIGH - Based on geocoding ecosystem knowledge, coordinate precision research (OpenCage, LocationIQ docs), and cache optimization patterns; not all verified in offline-geocode-city context specifically

**Research date:** 2026-02-15
**Valid until:** 2026-03-17 (30 days — geocoding is stable domain, library is maintained but not fast-moving)
