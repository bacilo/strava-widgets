# Feature Research: Interactive Maps & Multi-City Geocoding

**Domain:** Running/Fitness App Map Visualization & Geographic Data
**Researched:** 2026-02-16
**Confidence:** HIGH

**Context:** This research focuses on NEW features for v1.2 milestone — interactive route maps, heatmaps, country/city pin maps, and multi-city run tracking. Builds on existing v1.1 platform with offline geocoding (23 countries, 57 cities), geographic tables, and Custom Element widgets.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

#### Interactive Route Map Features

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Display single run route as polyline | Core feature in Strava, MapMyRun, all fitness apps | LOW | Decode Google polyline format, map library (Leaflet) |
| Zoom and pan controls | Standard web map interaction since Google Maps era (2005+) | LOW | Map library provides this (Leaflet built-in) |
| Fit route to viewport on load | Prevents users hunting for their route on world map | LOW | Map library `fitBounds()` with polyline coordinates |
| Basic route info popup (distance, date) | Users expect to see what run they're looking at | LOW | Popup overlay with run metadata |
| Route color coding | Visual distinction between runs or activity types | LOW | Polyline styling options |
| Clickable route for details | Modern UX expectation — click thing to see more | MEDIUM | Event handlers + state management for multi-route maps |

#### Heatmap Features

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| All runs overlaid on map | Core feature of Strava Personal Heatmap, expected in 2026 | MEDIUM | Polyline aggregation, map library layer system |
| Color intensity by activity density | Visual "heat" representation, industry standard | LOW | CSS opacity stacking or heatmap plugin |
| Date range filter | Strava offers this (custom range, specific year), table stakes | MEDIUM | Client-side filtering + re-render, date range UI |
| Activity type filter (if multi-sport) | Strava Global Heatmap has this (Run/Ride/Water/Winter/Other) | MEDIUM | Activity type metadata + filter UI |
| Zoom/pan interaction | Same as route map, users expect slippy map behavior | LOW | Map library provides this |
| Toggle photo overlay (if GPS-tagged photos exist) | Strava Personal Heatmap feature for subscribers | HIGH | Photo metadata extraction, marker clustering |

#### Country/City Pin Map Features

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Pin/marker for each visited location | Pin Traveler, Visited app, Been app standard | LOW | Marker for each unique city/country geocoded |
| Click pin to see stats (runs, distance, dates) | Expected interaction — pin = clickable | LOW | Popup with aggregated geographic stats |
| Visual distinction by activity count/distance | Pin size or color variation shows importance | MEDIUM | Marker styling based on data thresholds |
| Country count / city count display | Simple numeric summary, all travel apps show this | LOW | Count unique locations from geocoded data |
| Auto-zoom to show all pins | Prevents empty map or hunting for pins | LOW | Map library `fitBounds()` with marker positions |

#### Multi-City Run Tracking (Data Layer)

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Detect multiple cities in single run | Airport runs, city-border runs are common edge cases | HIGH | Decode full polyline, segment by city boundaries, reverse geocode segments |
| Attribute distance to each city visited | Users want accurate distance-per-city stats | HIGH | Polyline segmentation + distance calculation per segment |
| Handle city boundary crossings gracefully | Runs crossing borders shouldn't break stats | HIGH | Segment polyline at boundary crossing points |
| Aggregate stats across multi-city runs | Total distance = sum of segments across cities | MEDIUM | Database/aggregation layer handles split attribution |

#### Improved Geocoding (Fix Current Issues)

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Accurate city detection (not suburbs) | Current offline-geocode-city returns suburbs, not cities | MEDIUM | Switch to GeoNames or similar city-aware service |
| Consistent city naming | "New York" vs "New York City" inconsistency breaks aggregation | MEDIUM | Canonical name resolution via GeoNames alternateNames |
| Handle missing GPS data gracefully | 8% of activities lack GPS, system shouldn't crash | LOW | Skip geocoding for activities without coordinates |
| Performance: geocode 1,808+ activities efficiently | Batch processing during CI, not blocking | MEDIUM | Rate limiting, caching, incremental geocoding |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Latest N runs gallery map | Show most recent runs at a glance, not on competitors | MEDIUM | Multi-polyline rendering, route list UI |
| Route browser with map preview | Browse all runs with thumbnail maps, unique to embeddable widgets | HIGH | Route index, lazy-loading map tiles, pagination |
| Heatmap color customization | Strava offers this (orange/red/blue/purple/grey) for subscribers | LOW | CSS variable theming + color picker UI |
| Map style themes (light/dark/satellite) | Strava offers standard/hybrid/satellite/winter/light/dark | MEDIUM | Multiple tile layer providers or style switching |
| Export heatmap as static image | Save "picture frame" map for sharing/printing, not common | HIGH | Canvas rendering or server-side tile generation |
| Standalone map pages (not just widgets) | Full-page map experience + embeddable widget, unique flexibility | MEDIUM | Separate HTML page templates with same data |
| Offline-first geocoding (zero API calls) | Current strength, competitors rely on API services | MEDIUM | GeoNames local database (existing approach) |
| Time-of-day heatmap filter | Show only morning runs or evening runs on heatmap | MEDIUM | Filter by activity start time + re-render |
| Pace/speed color coding on routes | Strava Activity Map shows green=fastest, red=slowest | HIGH | Decode polyline with pace metadata, gradient styling |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time GPS tracking | "Live" map seems cool | Privacy nightmare, requires constant API calls, Strava webhooks not reliable, scope creep beyond personal analytics | Daily batch geocoding (existing GitHub Actions pipeline) |
| Every-street completion (Wandrer clone) | Gamification is popular, "gotta catch 'em all" appeal | Requires OpenStreetMap street geometry data, massive complexity, huge database, street matching algorithms, 100x scope increase | Simple city/country pin map with visit counts |
| 3D terrain visualization | "Looks impressive" appeal | Large tile data, WebGL complexity, doesn't add analytical value for personal stats | Elevation profile charts (already implemented in v1.0) |
| Custom map tile providers | "Let users choose their basemap" | Licensing issues (Google/Mapbox require API keys), rate limiting, performance variability, maintenance burden | Single well-designed default (OpenStreetMap tiles) |
| Animated run playback | "Relive your run" feature seems fun | High implementation complexity, video encoding, limited rewatchability, niche use case | Static route map with pace color coding |
| Street View integration along routes | Google Maps Street View looks cool | Google Maps API costs money, embedding restrictions, performance issues, scope creep | Link to Google Maps route for users who want it |
| Social features (compare routes with friends) | "See where others run" sounds useful | Requires multi-user system, authentication, privacy controls, 10x scope increase, not aligned with "personal analytics" | Link to Strava for social features |
| Route recommendations / route planning | "Where should I run?" feature | Requires popularity data, routing algorithms, safety data, massive scope increase | Focus on visualizing existing runs, not planning new ones |

## Feature Dependencies

```
[Interactive Route Map Widget]
    └──requires──> [Decoded Polyline Data]
                       └──requires──> [Google Polyline Decoder]
    └──requires──> [Map Library (Leaflet)]
    └──enhances──> [Run Metadata Display]

[Heatmap Widget]
    └──requires──> [All Decoded Polylines]
    └──requires──> [Map Library (Leaflet)]
    └──requires──> [Date Range Filter UI]
    └──enhances──> [Activity Type Filter]

[Country/City Pin Map Widget]
    └──requires──> [Improved Geocoding System]
                       └──requires──> [GeoNames Integration]
    └──requires──> [Geographic Aggregation Stats]
    └──requires──> [Map Library (Leaflet)]

[Multi-City Run Tracking]
    └──requires──> [Full Polyline Decoding]
    └──requires──> [Polyline Segmentation Algorithm]
    └──requires──> [Improved Geocoding for Segments]
    └──requires──> [City Boundary Data or Proximity Detection]
    └──updates──> [Geographic Aggregation Stats]

[Improved Geocoding]
    └──requires──> [GeoNames Local Database]
    └──requires──> [Canonical City Name Resolution]
    └──replaces──> [offline-geocode-city library]

[Latest N Runs Gallery Map]
    └──requires──> [Interactive Route Map Widget]
    └──requires──> [Multi-Polyline Rendering]
    └──enhances──> [Run Filtering by Date]
```

### Dependency Notes

- **Map library choice:** Leaflet recommended over OpenLayers (30KB vs 200KB+, simpler API, zero npm dependencies, huge plugin ecosystem)
- **Polyline decoding:** Required for all map visualizations; Google's encoded format needs decoding to lat/lon arrays
- **Multi-city tracking blocks geographic stats accuracy:** Current 1-run=1-city model misattributes distance for border-crossing runs
- **Geocoding improvement blocks multi-city tracking:** Can't segment runs by city if city detection is inaccurate
- **Heatmap depends on date filtering:** Without date range filter, showing 1,808 routes creates unusable visual noise
- **Pin map requires aggregated stats:** Not useful without distance/run counts per location from existing geographic pipeline

## MVP Definition

### Phase 1: Geocoding Foundation (Blocking)

Critical infrastructure that blocks all other features.

- [ ] **Replace offline-geocode-city with GeoNames** — Fixes suburb-instead-of-city problem (BLOCKS: all geographic features)
- [ ] **Canonical city name resolution** — Prevents "New York" vs "New York City" aggregation bugs (BLOCKS: accurate stats)
- [ ] **Incremental geocoding with caching** — Only geocode new/changed activities (IMPROVES: CI performance)
- [ ] **Graceful handling of missing GPS** — 8% of activities lack coordinates (PREVENTS: crashes)

**Why first:** Can't build accurate maps or multi-city tracking on broken geocoding foundation.

### Phase 2: Basic Route Map (First User Value)

Simplest map widget to validate approach.

- [ ] **Decode Google polyline format** — Convert encoded strings to lat/lon arrays (ENABLES: all map rendering)
- [ ] **Integrate Leaflet map library** — 30KB, zero dependencies, proven (ENABLES: map visualization)
- [ ] **Single run route map widget** — Display one run's polyline with zoom/pan (DELIVERS: first map widget)
- [ ] **Fit route to viewport on load** — Auto-zoom to route bounds (DELIVERS: good UX)
- [ ] **Basic route info popup** — Show distance, date, pace on click (DELIVERS: context)

**Why second:** Demonstrates map integration works, provides immediate user value, validates widget embedding.

### Phase 3: Heatmap (High-Value Feature)

Most requested feature, high visual impact.

- [ ] **All runs heatmap widget** — Overlay all 1,808 routes on single map (DELIVERS: Strava-like heatmap)
- [ ] **Date range filter UI** — Show runs from custom date range or specific year (DELIVERS: focused heatmap)
- [ ] **Activity type filter (runs only for now)** — Prepare for future multi-sport (DELIVERS: filtered view)
- [ ] **Heatmap color customization** — Orange/red/blue/purple options like Strava (DELIVERS: personalization)

**Why third:** Builds on route map foundation, high user value, validates filtering UX.

### Phase 4: Pin Map (Geographic Visualization)

Visual representation of places visited.

- [ ] **Country/city pin map widget** — Marker for each unique location (DELIVERS: travel map visualization)
- [ ] **Click pin to see stats** — Popup with runs/distance/dates per location (DELIVERS: interactive detail)
- [ ] **Visual distinction by activity count** — Pin size/color variation (DELIVERS: data-driven visualization)
- [ ] **Country and city count display** — Simple numeric summary (DELIVERS: quick stats)

**Why fourth:** Depends on improved geocoding from Phase 1, complements existing geographic table widget.

### Defer to v1.3+

Features requiring significant complexity or unclear value.

- [ ] **Multi-city run tracking** — HIGH complexity, edge case feature (affects ~50-100 runs of 1,808)
- [ ] **Latest N runs gallery map** — MEDIUM complexity, nice-to-have
- [ ] **Route browser with map preview** — HIGH complexity, requires pagination/lazy-loading
- [ ] **Standalone map pages** — MEDIUM complexity, can be added after widgets validated
- [ ] **Pace/speed color coding** — HIGH complexity, requires pace metadata parsing
- [ ] **Export heatmap as static image** — HIGH complexity, niche use case
- [ ] **Time-of-day heatmap filter** — MEDIUM complexity, unclear user value

**Why defer:** Multi-city tracking requires polyline segmentation algorithms + city boundary detection (massive scope). Other features are polish, not core value. Validate Phase 1-4 first.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| GeoNames geocoding | HIGH | MEDIUM | P0 | 1 |
| Canonical city names | HIGH | MEDIUM | P0 | 1 |
| Polyline decoding | HIGH | LOW | P0 | 2 |
| Leaflet integration | HIGH | LOW | P0 | 2 |
| Single route map widget | HIGH | LOW | P1 | 2 |
| Heatmap widget | HIGH | MEDIUM | P1 | 3 |
| Date range filter | HIGH | MEDIUM | P1 | 3 |
| Pin map widget | MEDIUM | LOW | P1 | 4 |
| Pin click stats | MEDIUM | LOW | P1 | 4 |
| Heatmap color customization | MEDIUM | LOW | P2 | 3 |
| Activity type filter | MEDIUM | MEDIUM | P2 | 3 |
| Visual pin distinction | LOW | MEDIUM | P2 | 4 |
| Latest N runs gallery | MEDIUM | MEDIUM | P3 | v1.3+ |
| Multi-city tracking | LOW | HIGH | P3 | v1.3+ |
| Route browser | MEDIUM | HIGH | P3 | v1.3+ |
| Pace color coding | MEDIUM | HIGH | P3 | v1.3+ |
| Standalone map pages | MEDIUM | MEDIUM | P3 | v1.3+ |

**Priority key:**
- P0: Blocking — must complete before other work
- P1: Must have for v1.2 launch
- P2: Should have if time permits
- P3: Nice to have, defer to future milestone

## Competitor Feature Analysis

| Feature | Strava Personal Heatmap | MapMyRun | Pin Traveler | CityStrides | Our Approach |
|---------|-------------------------|----------|--------------|-------------|--------------|
| **Single route map** | ✓ Activity detail page | ✓ Post-workout | N/A | N/A | ✓ Embeddable widget + standalone |
| **Heatmap overlay** | ✓ Subscriber-only, all activities | ✓ Basic view | N/A | ✓ LifeMap | ✓ Free, date-filtered, embeddable |
| **Date range filter** | ✓ Custom range + yearly | ✗ Limited | N/A | ✗ | ✓ Custom range + yearly |
| **Color customization** | ✓ 6 colors (subscriber) | ✗ | N/A | ✗ | ✓ 4-5 colors, CSS variables |
| **Activity type filter** | ✓ Run/Ride/Water/Winter/Other | ✓ Activity type | N/A | ✓ Run-focused | ✓ Runs only (v1.2) |
| **Pin/visited map** | ✗ | ✗ | ✓ Core feature | ✓ City pins | ✓ Country + city pins |
| **Pin stats on click** | N/A | N/A | ✓ Trip details | ✓ Street completion % | ✓ Runs/distance/dates |
| **Multi-city per run** | ✗ | ✗ | N/A | ✗ | ✗ Deferred to v1.3+ |
| **Embeddable widgets** | ✗ Platform-locked | ✗ Platform-locked | ✗ App-only | ✗ Platform-locked | ✓ Core differentiator |
| **Offline geocoding** | N/A (cloud platform) | N/A (cloud platform) | N/A | N/A | ✓ Zero API calls, zero cost |

**Our differentiators:**
1. **Embeddable** — Only solution designed for personal website integration
2. **Free and open** — No subscription required (Strava heatmap = subscriber-only)
3. **Offline-first** — No API dependencies, no rate limits, no costs
4. **Customizable** — CSS variables, theming, widget configuration
5. **Privacy-focused** — Data stays in your GitHub repo, no third-party services

## Expected User Interactions

### Route Map Widget Interactions

| Interaction | Expected Behavior | Implementation |
|-------------|-------------------|----------------|
| **Load widget** | Route auto-fits to viewport, controls visible | `map.fitBounds(polyline.getBounds())` |
| **Scroll wheel** | Zoom in/out (cooperative mode: require Ctrl+scroll) | Leaflet `scrollWheelZoom: 'center'` + gestureHandling |
| **Click + drag** | Pan map to explore area | Leaflet default drag behavior |
| **Click route** | Show popup with distance, date, pace, elevation | Leaflet `polyline.bindPopup()` + event handler |
| **+/- buttons** | Zoom in/out by fixed increment | Leaflet default zoom controls |
| **Double-click** | Zoom in one level | Leaflet default behavior |
| **Mobile pinch** | Zoom in/out | Leaflet touch gesture support |
| **Resize container** | Map resizes to fit, route stays centered | Leaflet `map.invalidateSize()` on ResizeObserver |

### Heatmap Widget Interactions

| Interaction | Expected Behavior | Implementation |
|-------------|-------------------|----------------|
| **Load widget** | All routes shown, auto-fit to bounds, filter UI visible | Aggregate all polylines, `fitBounds()` to global extent |
| **Date range filter** | Re-render with filtered routes only | Filter activities by date, clear/re-add polylines |
| **Activity type filter** | Toggle run/ride/other on/off | Filter by activity type, re-render polylines |
| **Color picker** | Change heatmap color scheme | Update polyline stroke colors, CSS variables |
| **Zoom/pan** | Same as route map | Leaflet default behavior |
| **Toggle photos** | Show/hide GPS-tagged photos as markers | DEFERRED — high complexity |

### Pin Map Widget Interactions

| Interaction | Expected Behavior | Implementation |
|-------------|-------------------|----------------|
| **Load widget** | All location pins shown, auto-fit to bounds | Place marker for each city/country, `fitBounds()` |
| **Click pin** | Popup shows: location name, run count, distance, first/last visit dates | Leaflet `marker.bindPopup()` with geographic stats |
| **Hover pin** | Tooltip shows location name | Leaflet `marker.bindTooltip()` |
| **Zoom/pan** | Same as route map | Leaflet default behavior |
| **Click country/city toggle** | Switch between country-level and city-level pins | Re-render markers from different dataset |

## Technical Constraints & Considerations

### Map Library Bundle Size

| Library | Minified + Gzipped | Dependencies | Ecosystem | Recommendation |
|---------|-------------------|--------------|-----------|----------------|
| **Leaflet** | ~40KB | Zero npm deps | 350+ plugins | ✓ Use this |
| **OpenLayers** | ~200KB+ | Multiple deps | Smaller ecosystem | ✗ Too heavy |
| **Mapbox GL JS** | ~150KB | Requires API key | Mapbox-specific | ✗ API dependency |
| **Google Maps** | ~100KB+ | Requires API key + billing | Google-specific | ✗ Cost + API dependency |

**Decision:** Leaflet — lightweight, no API dependencies, zero npm dependencies (aligns with offline-first approach).

### Polyline Rendering Performance

| Scenario | Polyline Count | Optimization Strategy |
|----------|---------------|----------------------|
| Single route map | 1 polyline | No optimization needed |
| Latest N runs | 5-10 polylines | No optimization needed |
| Full heatmap | 1,808 polylines | **Required:** Simplify polylines with Ramer–Douglas–Peucker algorithm, cluster at low zoom, filter by viewport bounds |

**Performance targets:**
- Single route: <100ms render time
- Heatmap (all routes): <2s initial render, <500ms pan/zoom updates
- Pin map (57 cities): <200ms render time

**Optimization techniques:**
1. **Polyline simplification:** Reduce points in each polyline by 50-80% using RDP algorithm (invisible to eye at normal zoom)
2. **Viewport filtering:** Only render polylines/pins visible in current map bounds
3. **Progressive loading:** Render simplified polylines first, add detail on zoom
4. **WebGL rendering:** Leaflet.Canvas or Leaflet.WebGL for GPU-accelerated polylines (if needed)

### Geocoding Performance & Accuracy

| Metric | Current (offline-geocode-city) | Target (GeoNames) |
|--------|-------------------------------|-------------------|
| **Accuracy** | ~60% (returns suburbs, not cities) | ~95% (city-aware with alternateNames) |
| **Cache hit rate** | 92% (114 unique locations) | 95%+ (fewer unique locations after canonical names) |
| **Processing time** | ~30min for 1,808 activities | ~10min (incremental + caching) |
| **API calls** | Zero (offline database) | Zero (local GeoNames database) |
| **Database size** | 217KB (offline-geocode-city) | ~50MB (GeoNames cities15000.txt — cities >15k population) |

**GeoNames advantages:**
- Canonical city names via `alternateNames` table (resolves "New York" vs "New York City")
- City-aware (returns city, not suburb)
- Population data (can prioritize larger cities for border cases)
- Free, offline, no API keys

**Implementation approach:**
1. Download GeoNames `cities15000.txt` (cities with population >15,000)
2. Build local search index (lat/lon → city lookup)
3. Cache results in `.cache/geocoding.json` (existing pattern)
4. Incremental geocoding: only process activities without cached location

### Widget Embedding Constraints

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| **Bundle size** | Leaflet adds ~40KB to widget | Separate map widgets from stats widgets (users include only what they need) |
| **Map tile loading** | External HTTP requests to OpenStreetMap servers | Expected for maps, tiles are cached by browser |
| **Initial render performance** | Heatmap with 1,808 routes may be slow | Progressive loading, show spinner, optimize polylines |
| **Shadow DOM + Leaflet** | Leaflet expects global CSS, may have issues with Shadow DOM | Test thoroughly, may need light DOM or CSS injection |
| **Mobile responsiveness** | Maps need touch gesture handling | Leaflet provides this, test on mobile viewports |

## Multi-City Run Tracking: Deep Dive

**User story:** Runner crosses from San Francisco to Oakland during single run. Should attribute distance to both cities.

**Current behavior (v1.1):** Single start coordinate → geocoded to "San Francisco" → all 15km attributed to San Francisco, Oakland gets zero.

**Desired behavior (v1.2+):** Decode full polyline → segment at city boundary → 8km to SF, 7km to Oakland.

**Implementation challenges:**

| Challenge | Complexity | Solution Approach |
|-----------|------------|-------------------|
| **Detect boundary crossing** | HIGH | Check each polyline point against city boundaries OR use proximity-based heuristic (distance from city center) |
| **Segment polyline** | MEDIUM | Split polyline array at boundary crossing points, calculate distance per segment |
| **City boundary data** | HIGH | GeoNames provides city points, not boundaries; need GeoJSON city polygons (huge dataset) OR use radius approximation |
| **Performance** | HIGH | 1,808 runs × ~200 points/run = 361,600 geocoding lookups (vs 1,808 currently) — requires aggressive caching |
| **Edge cases** | MEDIUM | Runs through 3+ cities, runs along border (flipping back/forth), GPS noise at boundaries |

**Recommendation:** **DEFER TO v1.3+**

**Rationale:**
1. **Low frequency:** Estimated <100 runs (of 1,808) cross city boundaries
2. **High complexity:** Requires city boundary data (not in GeoNames), polyline segmentation algorithm, 100x more geocoding lookups
3. **Acceptable workaround:** Attribute full run to start city (current behavior) — inaccurate but consistent
4. **Blocking:** Should not delay v1.2 map widgets (higher user value)

**Alternative for v1.2:** Add note in geographic stats: "Distance attributed to run start location. Multi-city runs may appear in one city only."

## Implementation Phases & Dependencies

```
Phase 1: Geocoding Foundation (BLOCKING)
├── Task: Replace offline-geocode-city with GeoNames
├── Task: Implement canonical city name resolution
├── Task: Add incremental geocoding with caching
└── Task: Graceful handling for missing GPS
    └── BLOCKS → Phase 2, 3, 4

Phase 2: Basic Route Map (FIRST USER VALUE)
├── Task: Decode Google polyline format
├── Task: Integrate Leaflet into widget build
├── Task: Build single-route map Custom Element
├── Task: Add zoom/pan controls + auto-fit
└── Task: Add route info popup
    └── ENABLES → Phase 3 (heatmap builds on this)

Phase 3: Heatmap (HIGH VALUE)
├── Task: Multi-polyline heatmap rendering
├── Task: Date range filter UI component
├── Task: Activity type filter component
└── Task: Heatmap color customization
    └── REQUIRES → Phase 2 (route map foundation)

Phase 4: Pin Map (COMPLEMENTARY)
├── Task: Country/city pin map Custom Element
├── Task: Pin click popup with stats
├── Task: Visual distinction by activity count
└── Task: Country/city count display
    └── REQUIRES → Phase 1 (accurate geocoding)
```

## Sources

**Strava Heatmap & Map Features:**
- [Strava Global Heatmap](https://www.strava.com/maps/global-heatmap)
- [Strava Personal Heatmaps Support](https://support.strava.com/hc/en-us/articles/216918467-Personal-Heatmaps)
- [Strava Heatmaps vs Competition Guide (2026)](https://the5krunner.com/2026/01/16/strava-heatmaps-guide/)
- [Strava Personal Heatmap Color Customization](https://cyclingmagazine.ca/sections/news/stravas-personal-heatmaps-feature-gets-more-customizable/)
- [Strava Map Types Support](https://support.strava.com/hc/en-us/articles/360049869011-Map-Types)

**Running/Fitness App Map Features:**
- [Best Apps for Mapping Your Run - TechRadar](https://www.techradar.com/health-fitness/fitness-apps/5-of-the-best-apps-for-mapping-your-run)
- [15 Best Running Apps of 2026](https://runtothefinish.com/must-have-running-apps/)
- [MapMyRun GPS Running Tracker](https://www.mapmyrun.com/)
- [How Maps Help The Fitness Industry - Mapbox Blog](https://www.mapbox.com/blog/mapping-technology-fitness-industry)

**Pin Map / Travel Tracking Apps:**
- [Pin Traveler: Travel Map App](https://pintraveler.net/)
- [Visited: Travel Tracker & Map](https://visitedapp.com/)
- [Been App - Track Countries Visited](https://been.app/)

**Multi-City & Route Tracking:**
- [CityStrides - Run Every Street](https://citystrides.com/)
- [RunGo - Turn-by-Turn Navigation](https://www.rungoapp.com)
- [MapMyFitness Workout Splits](https://support.mapmyfitness.com/hc/en-us/articles/1500009118742-Workout-Splits)

**Web Map Interaction Best Practices:**
- [Google Maps Platform: Controlling Zoom and Pan](https://developers.google.com/maps/documentation/javascript/interaction)
- [Map UI Design: Best Practices, Tools & Examples](https://www.eleken.co/blog-posts/map-ui-design)
- [Google Maps Platform Best Practices: Optimization and Performance](https://mapsplatform.google.com/resources/blog/google-maps-platform-best-practices-optimization-and-performance-tips/)
- [Accessibility Guide for Interactive Web Maps](https://mn.gov/mnit/assets/Accessibility%20Guide%20for%20Interactive%20Web%20Maps_tcm38-403564.pdf)

**Leaflet & Map Libraries:**
- [Leaflet Quick Start Guide](https://leafletjs.com/examples/quick-start/)
- [Leaflet Documentation](https://leafletjs.com/reference.html)
- [Leaflet vs OpenLayers Comparison](https://www.geoapify.com/leaflet-vs-openlayers/)
- [Map Libraries Popularity: Leaflet vs MapLibre GL vs OpenLayers](https://www.geoapify.com/map-libraries-comparison-leaflet-vs-maplibre-gl-vs-openlayers-trends-and-statistics/)
- [Mapbox Loves Leaflet](https://blog.mapbox.com/mapbox-%EF%B8%8F-leaflet-d60b1be96615)

**Polyline Rendering & Performance:**
- [Google Maps Platform: Polyline Optimization](https://cloud.google.com/blog/products/maps-platform/google-maps-platform-best-practices-optimization-and-performance-tips)
- [Polylines: Supercharge Your Map](https://shurutech.com/blog/polylines-supercharge-your-map/)
- [How to Improve Performance When Rendering Map Polygons](https://medium.com/game-development-stuff/how-to-improve-performance-when-rendering-map-polygons-on-react-native-projects-c6a75a5b1acd)

**Heatmap Implementation:**
- [Activity Heatmap - Oobeya Docs](https://docs.oobeya.io/activity-heatmap/activity-heatmap)
- [What Are Heatmaps? A Guide to Heat Maps](https://contentsquare.com/guides/heatmaps/)
- [Heatmapper - Latitude/Longitude Heatmaps](https://heatmapper.ca/)

**UX & Interaction Patterns:**
- [MVP Blog: Display an Activity Route On A Map](https://medium.com/@dev-john-nguyen/mvp-blog-display-an-activity-route-on-a-map-dfb1152e2101)
- [UX Case Study: Design of a Fitness App](https://medium.com/pari-chowdhry/ux-case-study-design-of-a-fitness-app-e644790da19)

---
*Feature research for: Strava Analytics v1.2 Maps & Geo Fix Milestone*
*Researched: 2026-02-16*
*Confidence: HIGH (official sources + competitor analysis + technical documentation)*
