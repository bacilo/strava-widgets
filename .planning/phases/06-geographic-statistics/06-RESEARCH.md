# Phase 6: Geographic Statistics - Research

**Researched:** 2026-02-15
**Domain:** Geographic data aggregation, ranking displays, CSV export
**Confidence:** HIGH

## Summary

Phase 6 builds on Phase 5's geocoding infrastructure to create user-facing displays of geographic statistics. The phase requires three deliverables: (1) country ranking display with total distance and run count, (2) city ranking display with the same metrics, and (3) CSV export functionality for both datasets.

The existing project uses a custom Shadow DOM widget architecture with vanilla TypeScript (no framework), pre-computed JSON data files, and build-time data processing. The geographic data is already aggregated and persisted in `data/geo/countries.json` and `data/geo/cities.json` from Phase 5. Phase 6 focuses on presentation and export, not data computation.

**Primary recommendation:** Build a vanilla TypeScript Shadow DOM widget following the existing `WidgetBase` pattern. Display ranked tables with sort capabilities, coverage metadata display, and client-side CSV export using Blob URLs. No new data processing required—consume existing JSON outputs.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9+ | Type-safe widget development | Project standard, all widgets use TS |
| Vite | 7.3+ | Widget bundling to IIFE format | Existing build system for all widgets |
| Vitest | 4.0+ | Unit testing for utilities | Project standard for testing |
| Chart.js | 4.5.1 | NOT USED (no charts in this phase) | Already installed, but geo stats are tables |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| terser | 5.46+ | Minification for production bundles | Build step (already configured) |
| N/A | N/A | CSV export | Use vanilla Blob + URL.createObjectURL (see Don't Hand-Roll) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla TS Shadow DOM | React/Vue components | Breaks project's framework-agnostic embedding model |
| Blob URL CSV export | export-to-csv library (npm) | Adds 10KB+ for trivial functionality; vanilla is 20 lines |
| Pre-computed JSON | Client-side aggregation | Phase 5 already computed; no benefit to re-aggregate |

**Installation:**
```bash
# No new dependencies required
# All necessary tools already in package.json
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── widgets/
│   └── geo-stats-widget/        # New widget for Phase 6
│       ├── index.ts             # Widget entry point, Shadow DOM setup
│       ├── table-renderer.ts    # Render country/city ranking tables
│       ├── csv-exporter.ts      # CSV export utilities
│       └── geo-stats-widget.test.ts  # Unit tests for CSV formatting
└── types/
    └── geo-stats.types.ts       # Type interfaces (if not already in analytics.types.ts)
```

### Pattern 1: Shadow DOM Widget Architecture
**What:** Extend `WidgetBase<T>` abstract class to create isolated, embeddable components
**When to use:** All user-facing displays (project standard)
**Example:**
```typescript
// Source: Existing pattern from src/widgets/stats-card/index.ts
import { WidgetBase } from '../shared/widget-base.js';
import { WidgetConfig } from '../../types/widget-config.types.js';

interface GeoStatsData {
  countries: CountryStats[];
  cities: CityStats[];
  metadata: GeoMetadata;
}

class GeoStatsWidget extends WidgetBase<GeoStatsData> {
  constructor(containerId: string, config: WidgetConfig) {
    super(containerId, config, false);  // Auto-fetch enabled
  }

  protected render(data: GeoStatsData): void {
    if (!this.shadowRoot) return;

    // Inject widget-specific styles
    const styleElement = document.createElement('style');
    styleElement.textContent = GEO_STATS_STYLES;
    this.shadowRoot.appendChild(styleElement);

    // Render tables + export buttons
    this.renderCountryTable(data.countries);
    this.renderCityTable(data.cities);
    this.renderMetadata(data.metadata);
  }
}

// Global initialization function
(window as any).GeoStatsWidget = {
  init: async (containerId: string, config: WidgetConfig) => {
    new GeoStatsWidget(containerId, config);
  }
};
```

### Pattern 2: Multi-Data Source Widget Loading
**What:** Fetch multiple JSON files in parallel for a single widget
**When to use:** When widget displays data from multiple pre-computed files
**Example:**
```typescript
// Source: Derived from stats-card's secondaryDataUrl pattern
protected async fetchAllData(): Promise<GeoStatsData> {
  const [countries, cities, metadata] = await Promise.all([
    this.fetchData<CountryStats[]>('data/geo/countries.json'),
    this.fetchData<CityStats[]>('data/geo/cities.json'),
    this.fetchData<GeoMetadata>('data/geo/geo-metadata.json')
  ]);

  return { countries, cities, metadata };
}
```

### Pattern 3: Client-Side CSV Export with Blob URLs
**What:** Generate CSV from JSON, create Blob, trigger browser download
**When to use:** Exporting tabular data to CSV without server
**Example:**
```typescript
// Source: Standard pattern from GeeksforGeeks, MDN Blob documentation
function exportToCSV(data: CountryStats[], filename: string): void {
  // Step 1: Convert JSON to CSV string
  const headers = ['Country', 'ISO Code', 'Activities', 'Distance (km)', 'Cities'].join(',');
  const rows = data.map(row =>
    [row.countryName, row.countryIso2, row.activityCount, row.totalKm || 0, row.cities.length]
      .map(val => `"${val}"`)  // Quote fields for safety
      .join(',')
  );
  const csv = [headers, ...rows].join('\n');

  // Step 2: Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const csvContent = BOM + csv;

  // Step 3: Create Blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Step 4: Clean up object URL to prevent memory leaks
  URL.revokeObjectURL(url);
}
```

### Pattern 4: Sortable Table Without External Libraries
**What:** Click table headers to toggle sort direction (ascending/descending)
**When to use:** Simple ranking displays where users may want to re-sort
**Example:**
```typescript
// Source: Vanilla table sorting pattern from tofsjonas/sortable
function createSortableTable(data: CountryStats[]): HTMLTableElement {
  const table = document.createElement('table');
  table.className = 'geo-table sortable';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  ['Country', 'Activities', 'Distance (km)'].forEach((label, idx) => {
    const th = document.createElement('th');
    const button = document.createElement('button');
    button.className = 'sort-button';
    button.textContent = label;
    button.setAttribute('aria-sort', 'none');

    button.addEventListener('click', () => {
      const isAsc = button.getAttribute('aria-sort') === 'ascending';
      const newDirection = isAsc ? 'descending' : 'ascending';

      // Re-render table with sorted data
      const sortedData = [...data].sort((a, b) => {
        const aVal = idx === 0 ? a.countryName : (idx === 1 ? a.activityCount : a.totalKm);
        const bVal = idx === 0 ? b.countryName : (idx === 1 ? b.activityCount : b.totalKm);
        return isAsc ? (aVal > bVal ? -1 : 1) : (aVal > bVal ? 1 : -1);
      });

      button.setAttribute('aria-sort', newDirection);
      this.renderTableBody(table, sortedData);
    });

    th.appendChild(button);
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  return table;
}
```

### Anti-Patterns to Avoid
- **Computing geo stats in widget:** Phase 5 already computed countries/cities JSON—never re-aggregate in browser
- **Inline CSV without BOM:** Excel requires UTF-8 BOM (`\uFEFF`) at file start or special characters corrupt
- **Forgetting URL.revokeObjectURL():** Creates memory leaks; always revoke after download triggered
- **Shadow DOM style duplication:** Don't inject styles per instance—use shared `<style>` element in shadow root
- **Framework dependencies:** Project is framework-agnostic; widgets must work in Jekyll, Astro, WordPress

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV generation | Custom parser with regex | Vanilla template literals + join | CSV is trivial (20 lines); libraries add 10KB+ for no benefit |
| Table sorting | Custom sort algorithms | Array.prototype.sort with comparator | Built-in sort is fast, well-tested, and handles edge cases |
| Widget bundling | Custom webpack config | Vite (already configured) | Existing build system outputs IIFE bundles for all widgets |
| Data fetching | Custom XMLHttpRequest wrapper | Built-in fetch API | Modern browsers support fetch natively; no polyfill needed |

**Key insight:** Geographic statistics display is presentation-only. Phase 5 already solved the hard problems (offline geocoding, cache management, aggregation). Phase 6 is DOM rendering + trivial CSV export—use vanilla browser APIs, not libraries.

## Common Pitfalls

### Pitfall 1: Excel UTF-8 Encoding Corruption
**What goes wrong:** Special characters in city names (e.g., "Chaniá", "Néa Moudaniá") display as gibberish when opening CSV in Excel
**Why it happens:** Excel defaults to ANSI encoding for CSVs unless UTF-8 BOM (Byte Order Mark) is present at file start
**How to avoid:** Prepend `\uFEFF` (UTF-8 BOM) to CSV string before creating Blob
**Warning signs:** Testing only with ASCII city names ("Roskilde", "Stockholm") and missing non-Latin scripts

### Pitfall 2: Memory Leaks from Object URLs
**What goes wrong:** Repeated CSV exports slowly consume browser memory until tab crashes
**Why it happens:** `URL.createObjectURL()` creates a reference the browser holds indefinitely unless explicitly revoked
**How to avoid:** Call `URL.revokeObjectURL(url)` immediately after triggering download
**Warning signs:** Memory profiler shows Blob references accumulating; long-running tabs become sluggish

### Pitfall 3: CSV Field Escaping Failures
**What goes wrong:** City names with commas (e.g., "Montemor-o-Novo, Portugal") break CSV column alignment
**Why it happens:** Commas are CSV delimiters; unescaped commas split fields incorrectly
**How to avoid:** Always wrap fields in double quotes: `"${value}"` or escape commas manually
**Warning signs:** CSV opens with misaligned columns; "City" column contains partial data

### Pitfall 4: Missing Data Validation Before Rendering
**What goes wrong:** Widget crashes with "Cannot read property 'length' of undefined" when data format changes
**Why it happens:** Assuming JSON structure without validation; Phase 5 output could change
**How to avoid:** Guard checks: `if (!data.countries?.length) return this.showError('No data');`
**Warning signs:** Widget works locally but fails in production after data rebuild

### Pitfall 5: Shadow DOM Event Listener Leaks
**What goes wrong:** Re-rendering tables without cleanup creates duplicate event listeners
**Why it happens:** Adding click listeners to `<th>` elements but never removing old listeners when re-rendering
**How to avoid:** Remove old table before appending new one, or use event delegation on parent
**Warning signs:** Click handlers fire multiple times; DevTools memory profiler shows listener count growing

### Pitfall 6: Hard-Coded Data URLs in Widget
**What goes wrong:** Widget only works with specific file paths, breaks when deployed
**Why it happens:** Using `this.fetchData('data/geo/countries.json')` instead of `this.config.dataUrl`
**How to avoid:** Always use `WidgetConfig` URLs; embed code specifies paths
**Warning signs:** Widget works in test-widgets.html but fails when embedded in external site

### Pitfall 7: Ranking Display Without Coverage Context
**What goes wrong:** Users see "Denmark: 1322 activities" without knowing 150 activities had no GPS data
**Why it happens:** Displaying aggregated counts without showing metadata (92% coverage from Phase 5)
**How to avoid:** Render `geo-metadata.json` as "Showing stats for 1,658 of 1,808 activities (92%)"
**Warning signs:** User confusion about "missing" activities; no transparency on data quality

## Code Examples

Verified patterns from project and official sources:

### Widget Initialization (Following Project Pattern)
```typescript
// Source: public/test-widgets.html existing pattern
<div id="geo-stats-widget"></div>

<script src="../dist/widgets/geo-stats-widget.iife.js"></script>
<script>
  window.GeoStatsWidget.init('geo-stats-widget', {
    dataUrl: '../data/geo/countries.json',
    options: {
      showTitle: true,
      customTitle: 'Running by Location',
      secondaryDataUrl: '../data/geo/cities.json',
      metadataUrl: '../data/geo/geo-metadata.json'
    }
  });
</script>
```

### CSV Export with UTF-8 BOM
```typescript
// Source: MDN Blob API, Excel UTF-8 best practices
export function exportCountriesToCSV(countries: CountryStats[]): void {
  const headers = ['Rank', 'Country', 'ISO Code', 'Distance (km)', 'Runs', 'Cities'];
  const rows = countries.map((country, idx) => [
    idx + 1,
    country.countryName,
    country.countryIso2,
    country.totalKm || 0,
    country.activityCount,
    country.cities.length
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(val => `"${val}"`).join(','))
  ].join('\n');

  // UTF-8 BOM ensures Excel displays special characters correctly
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `geographic-stats-countries-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();

  // Clean up to prevent memory leaks
  URL.revokeObjectURL(url);
}
```

### Coverage Metadata Display
```typescript
// Source: Derived from data/geo/geo-metadata.json structure
function renderMetadata(metadata: GeoMetadata): HTMLElement {
  const section = document.createElement('div');
  section.className = 'geo-metadata';

  const coverageText = document.createElement('p');
  coverageText.className = 'metadata-text';
  coverageText.textContent = `Showing statistics for ${metadata.geocodedActivities.toLocaleString()} ` +
    `of ${metadata.totalActivities.toLocaleString()} activities (${metadata.coveragePercent}% with GPS data)`;

  section.appendChild(coverageText);
  return section;
}
```

### Table Rendering with Ranking
```typescript
// Source: Vanilla DOM manipulation pattern
function renderCountryTable(countries: CountryStats[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'geo-table-container';

  const table = document.createElement('table');
  table.className = 'geo-table';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Rank', 'Country', 'Distance (km)', 'Runs', 'Cities'].forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body (already ranked by distance from Phase 5)
  const tbody = document.createElement('tbody');
  countries.forEach((country, idx) => {
    const row = document.createElement('tr');

    const rankCell = document.createElement('td');
    rankCell.textContent = (idx + 1).toString();
    rankCell.className = 'rank-cell';

    const countryCell = document.createElement('td');
    countryCell.textContent = country.countryName;
    countryCell.className = 'country-cell';

    const distanceCell = document.createElement('td');
    distanceCell.textContent = (country.totalKm || 0).toLocaleString();
    distanceCell.className = 'number-cell';

    const runsCell = document.createElement('td');
    runsCell.textContent = country.activityCount.toLocaleString();
    runsCell.className = 'number-cell';

    const citiesCell = document.createElement('td');
    citiesCell.textContent = country.cities.length.toString();
    citiesCell.className = 'number-cell';

    row.append(rankCell, countryCell, distanceCell, runsCell, citiesCell);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  container.appendChild(table);
  return container;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React/Vue widgets | Vanilla Shadow DOM web components | 2024-2025 | Framework-agnostic embedding; works in any site |
| Runtime data processing | Build-time pre-computation | Phase 5 (current) | Zero client-side computation; instant display |
| CSV libraries (PapaParse, export-to-csv) | Blob + URL.createObjectURL | 2020+ | Remove 10KB+ dependencies for trivial functionality |
| `download` npm package | `<a download>` HTML5 attribute | 2015+ | Native browser support eliminates dependencies |

**Deprecated/outdated:**
- CSV generation libraries for simple exports: Modern browsers support Blob API natively; no library needed for basic CSV
- Framework-based widget systems: Shadow DOM provides encapsulation without framework lock-in
- Client-side aggregation for pre-computed data: Phase 5 already computed—re-aggregating wastes CPU

## Open Questions

1. **Should widget support toggling between countries and cities, or display both simultaneously?**
   - What we know: Phase 5 outputs both datasets; requirements say "user can see" both
   - What's unclear: UI pattern—tabs, separate widgets, or single scrollable view?
   - Recommendation: Display both in single widget (countries first, cities second) with export buttons for each. User can see everything at once, matching existing single-widget patterns.

2. **Should city rankings include country name in display?**
   - What we know: `cities.json` includes `countryName` and `countryIso2` fields
   - What's unclear: Requirements say "see city stats" but not if country context is displayed
   - Recommendation: Include country in city table for clarity (e.g., "Stockholm (Sweden)") since users may not know geographic locations.

3. **Should rankings support filtering (e.g., "show only cities in Denmark")?**
   - What we know: Requirements don't mention filtering, only viewing and exporting
   - What's unclear: Whether future phases expect interactive filtering
   - Recommendation: Skip filtering for Phase 6 (YAGNI). Can add in future if requested.

4. **Should CSV include computed rank numbers or rely on sort order?**
   - What we know: Rank is derived from sort order (already sorted by distance in Phase 5)
   - What's unclear: Whether exported CSV should include explicit "Rank" column
   - Recommendation: Include rank column (1, 2, 3...) in CSV for clarity—users may re-sort in Excel and lose original ranking.

## Sources

### Primary (HIGH confidence)
- Existing widget architecture: `src/widgets/stats-card/index.ts`, `src/widgets/shared/widget-base.ts`
- Phase 5 outputs: `data/geo/countries.json`, `data/geo/cities.json`, `data/geo/geo-metadata.json`
- Project testing approach: `src/analytics/streak-utils.test.ts`, `vitest.config.ts`
- Package.json: TypeScript 5.9, Vite 7.3, Vitest 4.0

### Secondary (MEDIUM confidence)
- [Client side csv download using Blob](https://riptutorial.com/javascript/example/24711/client-side-csv-download-using-blob) - Vanilla CSV pattern
- [URL.revokeObjectURL() static method - MDN](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static) - Memory leak prevention
- [Quick Fix for UTF-8 CSV files in Microsoft Excel](https://www.edmundofuentes.com/blog/2020/06/13/excel-utf8-csv-bom-string/) - BOM requirement
- [Opening CSV UTF-8 files correctly in Excel - Microsoft Support](https://support.microsoft.com/en-us/office/opening-csv-utf-8-files-correctly-in-excel-8a935af5-3416-4edd-ba7e-3dfd2bc4a032) - Official Excel UTF-8 guidance
- [Vanilla JavaScript table sort (tofsjonas/sortable)](https://github.com/tofsjonas/sortable) - Sortable table pattern
- [Building Table Sorting and Pagination in a Web Component](https://www.raymondcamden.com/2022/05/23/building-table-sorting-and-pagination-in-a-web-component) - Web component table patterns
- [Web Components: Working With Shadow DOM - Smashing Magazine](https://www.smashingmagazine.com/2025/07/web-components-working-with-shadow-dom/) - Style management best practices

### Tertiary (LOW confidence)
- [Visualize features through aggregation - ArcGIS Pro](https://pro.arcgis.com/en/pro-app/latest/help/mapping/layer-properties/visualize-features-through-aggregation.htm) - Geographic aggregation patterns (enterprise GIS context)
- [Fundamentals of Data Visualization - Geospatial Data](https://clauswilke.com/dataviz/geospatial-data.html) - General geo visualization theory

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies already installed; no new libraries needed
- Architecture: HIGH - Widget pattern verified from existing codebase; CSV export is browser standard
- Pitfalls: MEDIUM-HIGH - UTF-8 BOM and memory leaks verified from official sources; others derived from experience

**Research date:** 2026-02-15
**Valid until:** 2026-03-17 (30 days - stable domain, browser APIs change slowly)
