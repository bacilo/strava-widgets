# Feature Research: Geographic Statistics & Widget Customization

**Domain:** Geographic Running Statistics & Widget Customization (Milestone Extension)
**Researched:** 2026-02-14
**Confidence:** MEDIUM

**Context:** This research focuses on NEW features for geographic data extraction and widget customization system, adding to existing Strava analytics platform with OAuth, activity sync, stats cards, charts, and streak widgets.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

#### Geographic Statistics

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Countries visited list | Standard feature in running apps like Wandrer, StatHunters | LOW | Extract from existing activity GPS data via reverse geocoding |
| Total distance by country | Users expect to see aggregate distance per location | LOW | Simple aggregation once locations identified |
| Cities/locations visited | Finer granularity than countries, expected in modern running analytics | MEDIUM | Requires reverse geocoding with city-level precision |
| Activity count by location | Basic metric alongside distance | LOW | Count activities per identified location |
| Date range for first/last visit | Context for when user visited each location | LOW | Track min/max activity dates per location |

#### Widget Customization

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Basic theming (colors) | Users want widgets to match their site | LOW | CSS variables exposed via data attributes |
| Dark/light mode support | Standard expectation for modern widgets (2026) | MEDIUM | Requires dual color palettes, system preference detection |
| Size/dimensions control | Widgets need to fit different page layouts | LOW | data-width, data-height attributes or CSS |
| Data attribute configuration | HTML-only environments (CMSes) can't use JS config | MEDIUM | Parse data-* attributes for all settings |
| Style isolation (Shadow DOM) | Widget must not break host page CSS | HIGH | Already implemented in existing widgets, maintain isolation |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Percentage completion badges | Wandrer-style gamification (25%, 50%, 75%, 90% of area covered) | MEDIUM | Requires area boundary data, distance-in-area calculation |
| Geographic heatmap visualization | Visual representation like Strava Global Heatmap | HIGH | Requires mapping library, complex data aggregation |
| Choropleth country map | Countries colored by distance/activity count | MEDIUM | SVG world map with data-driven coloring |
| Custom location groupings | User defines regions (e.g., "Nordic countries", "Home area") | MEDIUM | Requires location tagging/grouping system |
| Export geographic data | CSV/JSON of countries/cities with stats | LOW | Serialize aggregated data |
| Widget composition API | Combine multiple widgets with shared configuration | MEDIUM | Allows table + chart with same theme settings |
| Responsive widget sizing | Auto-adapt to container size | MEDIUM | ResizeObserver, container queries |
| Interactive table sorting/filtering | Sort by distance, date, activity count | MEDIUM | Client-side table interactions |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time location tracking | "Live" stats appeal | Privacy nightmare, requires constant API calls, scope creep | Daily batch refresh (existing GitHub Actions) |
| Every street completion (Wandrer clone) | Gamification is popular | Requires detailed street geometry data, massive complexity, OpenStreetMap integration challenges | Simpler city/country completion percentages |
| Custom map tiles/providers | Let users choose map style | Adds complexity, licensing issues, performance concerns | Single well-designed default visualization |
| Fine-grained reverse geocoding (street-level) | More data seems better | Poor accuracy at street level, rate limiting issues, data quality inconsistent | City-level granularity is sufficient and reliable |
| Unlimited theme customization | "Let users style everything" | Creates maintenance burden, breaks layouts, accessibility issues | Controlled theming via CSS variable presets |
| Real-time widget preview editor | Visual configuration tool | Significant UI complexity, scope creep beyond core value | Code examples + documentation |

## Feature Dependencies

```
[Geographic Statistics Table Widget]
    └──requires──> [Reverse Geocoding System]
                       └──requires──> [GPS Coordinate Extraction]

[Choropleth Map Visualization] ──requires──> [Geographic Statistics Table Widget]

[Widget Dark Mode] ──requires──> [CSS Variable Theming System]

[Widget Composition API] ──enhances──> [All Widget Types]

[Custom Location Groupings] ──requires──> [Geographic Statistics Table Widget]

[Interactive Sorting/Filtering] ──conflicts──> [Static HTML-only widgets]
    └──note: Requires JavaScript bundle, adds complexity
```

### Dependency Notes

- **Reverse Geocoding requires GPS coordinates:** Must extract start/end lat/lon from existing 1,808 activities first
- **Choropleth map enhances table widget:** Map visualization makes sense only after table data exists
- **Dark mode requires theming system:** Need CSS variable infrastructure before implementing mode switching
- **Interactive features conflict with static approach:** Current widgets are IIFE bundles; interactive features require event handlers and state management
- **Widget composition requires shared config:** Theme settings must be centralized for cross-widget consistency

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] **Extract GPS coordinates from activities** — Foundation for all geographic features (DEPENDS ON: existing activity data)
- [ ] **Reverse geocode to countries** — Core geographic aggregation (city-level optional for v1)
- [ ] **Countries visited table widget** — Display country, distance, activity count, first/last visit
- [ ] **Data attribute configuration for widgets** — data-theme, data-width for basic customization (EXTENDS: existing widget system)
- [ ] **CSS variable theming** — Expose colors via CSS variables for host page customization
- [ ] **Export geographic data (CSV)** — Low-complexity differentiator, high user value

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **City-level geographic statistics** — Add after country-level proves valuable
- [ ] **Dark/light mode toggle** — Add once theming system validated
- [ ] **Interactive table sorting** — Add if users request it, requires JS enhancement
- [ ] **Choropleth map visualization** — Add if geographic data proves popular
- [ ] **Responsive widget sizing** — Add based on embedding feedback

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Percentage completion badges** — Requires area boundary data, significant complexity
- [ ] **Custom location groupings** — Wait for user feedback on use cases
- [ ] **Widget composition API** — Only if users embed multiple widgets
- [ ] **Geographic heatmap** — High complexity, defer until demand validated

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| GPS coordinate extraction | HIGH | LOW | P1 |
| Reverse geocoding (countries) | HIGH | MEDIUM | P1 |
| Countries table widget | HIGH | LOW | P1 |
| Data attribute configuration | HIGH | LOW | P1 |
| CSS variable theming | MEDIUM | LOW | P1 |
| CSV export | MEDIUM | LOW | P1 |
| City-level geocoding | MEDIUM | LOW | P2 |
| Dark/light mode | MEDIUM | MEDIUM | P2 |
| Interactive sorting | LOW | MEDIUM | P2 |
| Choropleth map | MEDIUM | MEDIUM | P2 |
| Responsive sizing | LOW | MEDIUM | P2 |
| Completion badges | LOW | HIGH | P3 |
| Custom groupings | LOW | MEDIUM | P3 |
| Geographic heatmap | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Wandrer | StatHunters | Strava | Our Approach |
|---------|---------|-------------|--------|--------------|
| Geographic tracking | Street-level exploration game | Activity mapping, statistics tables | Global heatmap, Year in Sport | Country/city-level aggregation (simpler) |
| Visualization | % completion by area, untraveled roads | Heatmaps, tiles, badges | Heatmap visualization | Table widget + optional choropleth |
| Gamification | Points per new road mile, achievements | Eddington number, badges | Year in Sport report | Completion badges (future) |
| Customization | Not embeddable | Not embeddable | Not embeddable | Fully customizable embeddable widgets |
| Theming | N/A | N/A | N/A | CSS variables, dark/light mode |

**Our differentiator:** Embeddable, customizable geographic widgets for personal sites (competitors focus on their own platforms)

## Implementation Notes

### Reverse Geocoding Approach

**Recommended:** OpenStreetMap Nominatim (free, open-source)
- Rate limit: 1 request/second on public API
- For 1,808 activities: ~30 minutes batch processing time
- Cache results in data pipeline to avoid re-geocoding
- Use start coordinates (lat/lon) from each activity

**Alternative:** BigDataCloud Free Reverse Geocode API
- Client-side capable (no server required)
- City-level precision
- Higher rate limits for batch operations

**Implementation:**
1. Extract start lat/lon from existing activity data
2. Batch reverse geocode during GitHub Actions refresh
3. Store country/city in activity metadata
4. Aggregate statistics from enriched data

### Widget Configuration Pattern

**Dual configuration support:**
```html
<!-- Data attributes (HTML-only environments) -->
<div id="geo-stats"
     data-theme="dark"
     data-width="100%"
     data-sort-by="distance"></div>

<!-- JavaScript configuration (flexibility) -->
<script>
window.stravaGeoConfig = {
  theme: 'dark',
  width: '100%',
  sortBy: 'distance'
};
</script>
```

**CSS Variable Theming:**
```css
:root {
  --widget-bg: #ffffff;
  --widget-text: #1a1a1a;
  --widget-border: #e0e0e0;
}

[data-theme="dark"] {
  --widget-bg: #1a1a1a;
  --widget-text: #ffffff;
  --widget-border: #333333;
}
```

### Table Widget Structure

**Columns:**
1. Location (Country/City name)
2. Distance (km/miles with unit toggle)
3. Activities (#)
4. First Visit (date)
5. Last Visit (date)
6. % of Total Distance (calculated)

**Sorting:** Default by distance DESC, allow toggle to alphabetical or date-based

**Filtering:** Optional search/filter by location name (P2)

## Technical Constraints

### Reverse Geocoding Rate Limits
- Nominatim: 1 req/sec = batch processing only, no real-time
- Solution: Pre-process during daily GitHub Actions refresh
- Cache geocoded results to avoid re-processing

### GPS Data Availability
- Assumption: Strava API provides start/end lat/lon
- Risk: If not available, need to fetch detailed activity streams
- Mitigation: Verify API response structure early

### Data Quality
- GPS accuracy varies (city-level ~few km precision)
- Border activities may misattribute location
- Solution: Use start coordinate only, document limitation

### Widget Size/Performance
- Additional geographic data increases JSON payload
- Mitigation: Separate widget (geo-stats) vs existing widgets
- Allow users to include only widgets they need

## Relationship to Existing Features

### Builds On
- **Existing activity sync:** Geographic features use already-fetched activity data
- **Existing widget system:** New widgets follow same IIFE bundle pattern
- **Existing GitHub Actions:** Reverse geocoding runs in same daily refresh
- **Existing Shadow DOM:** Geographic table inherits style isolation

### Extends
- **Widget configuration:** Adds data-attribute pattern to existing widgets
- **Theming system:** Introduces CSS variables that can be adopted by existing widgets
- **Data aggregation:** New geographic aggregations parallel existing time-based stats

### New Capabilities
- **Reverse geocoding pipeline:** Entirely new capability
- **Geographic table widget:** New widget type
- **Location-based aggregations:** New dimension for statistics

## Sources

**Geographic Running Analytics:**
- [Wandrer - Run Every Road Exploration Game](https://wandrer.earth/)
- [Wandrer Review - Gamified Running Tracking](https://personalwellnesstracking.com/wandrer-earth-review-run-every-road-strava-challenge/)
- [StatHunters - Strava Activity Statistics](https://www.statshunters.com/)
- [Strava Global Heatmap](https://www.strava.com/maps/global-heatmap)
- [Running Achievements (Smadges) App](https://apps.apple.com/us/app/running-achievements-smadges/id1478043600)
- [Been App - Countries Visited Tracking](https://been.app/)

**Reverse Geocoding:**
- [Geoapify Reverse Geocoding API](https://www.geoapify.com/reverse-geocoding-api/)
- [BigDataCloud Free Reverse Geocode API](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api)
- [OpenStreetMap Nominatim Documentation](https://nominatim.org/release-docs/latest/api/Reverse/)
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/)
- [Google Maps Geocoding API](https://developers.google.com/maps/documentation/geocoding/overview)

**Widget Customization:**
- [Building Embeddable React Widgets Guide](https://makerkit.dev/blog/tutorials/embeddable-widgets-react)
- [Styling Shadow DOM with CSS Variables](https://gomakethings.com/styling-the-shadow-dom-with-css-variables-in-web-components/)
- [MDN: Using Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
- [Best Practices for Embeddable Widgets](https://codeutopia.net/blog/2012/05/26/best-practices-for-building-embeddable-widgets/)
- [Creating Dark/Light Themes with CSS Variables](https://www.digitalocean.com/community/tutorials/css-theming-custom-properties)
- [Data Attributes vs JavaScript Configuration](https://jmperezperez.com/blog/embeddable-widget/)

**Visualization:**
- [Choropleth Maps - Data Visualization Guide](https://venngage.com/blog/choropleth-map/)
- [Plotly Choropleth Maps in Python](https://plotly.com/python/choropleth-maps/)

---
*Feature research for: Strava Analytics Geographic Statistics & Widget Customization Milestone*
*Researched: 2026-02-14*
