# Phase 2: Core Analytics & First Widget - Research

**Researched:** 2026-02-14
**Domain:** Data analytics computation, web-based charting, embeddable widget development
**Confidence:** MEDIUM-HIGH

## Summary

Phase 2 transforms raw activity JSON files into statistical insights and delivers them via an embeddable JavaScript widget. The technical stack centers on **vanilla JavaScript data processing**, **Chart.js for visualization**, and **Vite in library mode for bundling**. The architecture follows a three-layer pattern: compute statistics from JSON files (Node.js scripts), pre-generate static JSON datasets, and render self-contained widgets that load from static files.

The primary challenge is creating a widget that's lightweight (target <100KB gzipped), style-isolated (Shadow DOM), and embeddable with a single script tag while Chart.js itself is ~48KB. Tree-shaking via manual component registration reduces Chart.js to ~14KB for basic bar charts. The data aggregation layer must handle timezone-aware weekly rollups without external dependencies, using native JavaScript Date objects with UTC normalization.

**Primary recommendation:** Use Chart.js with tree-shaken imports, Vite library mode (IIFE format), Shadow DOM for style isolation, and Node.js scripts for static JSON generation. Avoid React/Vue frameworks (bundle bloat), avoid runtime API calls (violates static-first constraint), and avoid custom chart implementations (complexity trap).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chart.js | 4.x (latest) | Bar chart rendering | Industry standard for simple charts, tree-shakeable to 14KB, excellent documentation, 96% browser support |
| Vite | 6.x (latest) | Widget bundling | Modern bundler with library mode, pairs esbuild + Rollup, supports IIFE/UMD formats for widgets |
| TypeScript | 5.x | Type safety | Already in use (Phase 1), prevents data structure mismatches |
| Node.js | 18+ | Static JSON generation | Native fetch (already in use), built-in fs/promises, no external dependencies needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | 3.x | Widget styling (optional) | If visual polish needed; requires extraction to avoid host conflicts |
| date-fns | 3.x | Date utilities (optional) | If native Date proves insufficient for complex aggregations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Chart.js | D3.js | D3 offers unlimited customization but adds 10-20KB+ and steep learning curve; overkill for bar charts |
| Chart.js | Recharts | React-only, forces React into bundle (~50KB base), incompatible with vanilla widget requirement |
| Vite | Webpack | Webpack has mature ecosystem but slower builds; Vite library mode is purpose-built for this use case |
| Vite | Rollup | Rollup is excellent for libraries but Vite provides dev server + Rollup production in one package |
| IIFE bundle | UMD bundle | UMD supports AMD/CommonJS/global; IIFE simpler for script-tag-only widgets, smaller output |

**Installation:**
```bash
# Analytics dependencies (widget project)
npm install chart.js

# Development
npm install --save-dev vite @types/node typescript
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── analytics/          # Data computation scripts (Node.js)
│   ├── compute-stats.ts    # Main aggregation logic
│   └── utils/
│       ├── date-utils.ts   # Week boundaries, UTC normalization
│       └── aggregators.ts  # Distance totals, pace, elevation
├── widget/             # Embeddable widget source
│   ├── index.ts           # Entry point, Shadow DOM setup
│   ├── chart-config.ts    # Chart.js configuration
│   └── styles.css         # Widget-scoped styles
└── types/              # Shared types
    └── analytics.types.ts # Stats interfaces

data/
├── activities/         # Source data (Phase 1)
│   └── *.json
└── stats/              # Generated static JSON
    ├── weekly-distance.json
    ├── all-time-totals.json
    └── metadata.json

dist/
└── widget/
    ├── weekly-bar-chart.js    # IIFE bundle
    └── weekly-bar-chart.css   # Extracted styles

public/
└── test-embed.html    # Local embedding test page
```

### Pattern 1: Static JSON Generation Pipeline
**What:** Node.js script reads all activity JSON files, computes aggregations, writes static output files
**When to use:** Pre-build step before widget deployment; can be triggered manually or via CI

**Example:**
```typescript
// Source: Research synthesis from Node.js best practices
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

interface WeeklyStats {
  weekStartISO: string; // ISO 8601 week start (Monday UTC)
  totalKm: number;
  runCount: number;
  avgPace: number; // min/km
  elevationGain: number; // meters
}

async function computeWeeklyDistance(): Promise<WeeklyStats[]> {
  const activitiesDir = 'data/activities';
  const files = await readdir(activitiesDir);

  // Load all activities
  const activities = await Promise.all(
    files
      .filter(f => f.endsWith('.json'))
      .map(async (file) => {
        const content = await readFile(join(activitiesDir, file), 'utf-8');
        return JSON.parse(content);
      })
  );

  // Group by UTC week (using Monday as week start)
  const weekMap = new Map<string, StravaActivity[]>();

  for (const activity of activities) {
    const weekStart = getWeekStart(new Date(activity.start_date));
    const weekKey = weekStart.toISOString();

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(activity);
  }

  // Aggregate statistics per week
  const weeklyStats: WeeklyStats[] = Array.from(weekMap.entries()).map(([weekISO, acts]) => ({
    weekStartISO: weekISO,
    totalKm: acts.reduce((sum, a) => sum + a.distance / 1000, 0),
    runCount: acts.length,
    avgPace: calculateAvgPace(acts),
    elevationGain: acts.reduce((sum, a) => sum + a.total_elevation_gain, 0)
  }));

  // Write to static file
  await writeFile(
    'data/stats/weekly-distance.json',
    JSON.stringify(weeklyStats, null, 2)
  );

  return weeklyStats;
}

function getWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = d.getUTCDay(); // 0=Sunday
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function calculateAvgPace(activities: StravaActivity[]): number {
  const totalMinutes = activities.reduce((sum, a) => sum + a.moving_time / 60, 0);
  const totalKm = activities.reduce((sum, a) => sum + a.distance / 1000, 0);
  return totalKm > 0 ? totalMinutes / totalKm : 0;
}
```

### Pattern 2: Tree-Shaken Chart.js Integration
**What:** Import only required Chart.js components to minimize bundle size
**When to use:** Production widget builds; dev can use chart.js/auto for faster iteration

**Example:**
```typescript
// Source: https://www.chartjs.org/docs/latest/getting-started/integration.html
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip
} from 'chart.js';

// Register only needed components
Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip
);

export function createWeeklyBarChart(canvasId: string, data: WeeklyStats[]) {
  return new Chart(canvasId, {
    type: 'bar',
    data: {
      labels: data.map(w => formatWeekLabel(w.weekStartISO)),
      datasets: [{
        label: 'Weekly Distance (km)',
        data: data.map(w => w.totalKm),
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: {
        title: {
          display: true,
          text: 'Weekly Running Distance'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Distance (km)'
          }
        }
      }
    }
  });
}

function formatWeekLabel(isoDate: string): string {
  const date = new Date(isoDate);
  return `Week of ${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}
```

### Pattern 3: Shadow DOM Widget Initialization
**What:** Create isolated DOM container, inject widget, prevent style leakage
**When to use:** All embeddable widgets; mandatory for third-party embedding

**Example:**
```typescript
// Source: https://makerkit.dev/blog/tutorials/embeddable-widgets-react
class WeeklyBarChartWidget {
  private shadowRoot: ShadowRoot;
  private chart: Chart | null = null;

  constructor(containerId: string, dataUrl: string) {
    // Create shadow DOM container
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`[WeeklyBarChart] Container ${containerId} not found`);
      return;
    }

    this.shadowRoot = container.attachShadow({ mode: 'open' });

    // Inject HTML structure
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .chart-container {
          position: relative;
          width: 100%;
          max-width: 800px;
        }
      </style>
      <div class="chart-container">
        <canvas id="chart"></canvas>
      </div>
    `;

    // Load data and render
    this.loadAndRender(dataUrl);
  }

  private async loadAndRender(dataUrl: string) {
    try {
      const response = await fetch(dataUrl);
      const data: WeeklyStats[] = await response.json();

      const canvas = this.shadowRoot.querySelector('canvas') as HTMLCanvasElement;
      this.chart = createWeeklyBarChart(canvas, data);
    } catch (error) {
      // Fail silently - cardinal rule for embeddable widgets
      console.error('[WeeklyBarChart] Failed to load data:', error);
      this.shadowRoot.innerHTML = '<p>Chart unavailable</p>';
    }
  }
}

// Global initialization function
(window as any).initWeeklyBarChart = (containerId: string, dataUrl: string) => {
  return new WeeklyBarChartWidget(containerId, dataUrl);
};
```

### Pattern 4: Vite Library Mode Configuration
**What:** Configure Vite to produce IIFE bundle for script-tag embedding
**When to use:** Widget build configuration

**Example:**
```typescript
// vite.config.ts
// Source: https://vite.dev/guide/build
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/widget/index.ts'),
      name: 'WeeklyBarChart',
      fileName: 'weekly-bar-chart',
      formats: ['iife'] // Script tag format only
    },
    rollupOptions: {
      // Don't externalize anything - bundle all dependencies
      external: [],
      output: {
        // Ensure no code splitting (IIFE doesn't support it)
        inlineDynamicImports: true,
        globals: {}
      }
    },
    // Target modern browsers (96% support for Shadow DOM)
    target: 'es2020',
    // Minify for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true // Remove console.log in production
      }
    }
  }
});
```

### Anti-Patterns to Avoid

- **Runtime API calls from widget:** Violates static-first architecture; adds latency, auth complexity, CORS issues. Pre-generate JSON instead.
- **Framework dependencies (React/Vue) in widget:** Adds 40-80KB to bundle; unnecessary for simple bar chart. Use vanilla JS + Chart.js.
- **Global CSS in widget:** Conflicts with host page styles. Always use Shadow DOM or scoped CSS.
- **Synchronous file operations in Node.js:** Blocks event loop during stat generation. Use fs/promises with await.
- **Local timezone assumptions:** Weekly rollups differ between users. Normalize all dates to UTC before aggregation.
- **Chart.js auto import in production:** Imports entire library (~48KB). Use manual registration to tree-shake to ~14KB.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bar chart rendering | Custom Canvas API drawing | Chart.js with tree-shaking | Responsive sizing, tooltips, accessibility, browser quirks handled; custom implementation is 500+ lines |
| Module bundling | Custom Rollup config | Vite library mode | Vite handles dev server + production build, esbuild pre-bundling, CSS extraction, minification out of box |
| Weekly date boundaries | Manual day-of-week math | UTC Date with `getUTCDay()` | Timezone edge cases (DST, leap years, locale variations) are subtle; one-off bugs only appear in production |
| Shadow DOM polyfills | Custom style isolation | Native Shadow DOM | 96% browser support as of 2026; polyfills add 10-20KB and incomplete coverage |
| Data aggregation library | Lodash/Ramda | Native Array.reduce/map | Simple statistics don't justify 20-70KB library; native methods are sufficient and 10x faster |

**Key insight:** Chart.js handles the deceptively complex problem of responsive canvas sizing. Chart.js documentation states: "The canvas render size (canvas.width/.height) cannot be expressed with relative values, unlike display size" - this means custom implementations must handle display-to-render coordinate transforms, HiDPI scaling, container resize observers, and flexbox/grid edge cases. Chart.js solves this; don't rebuild it.

## Common Pitfalls

### Pitfall 1: Chart.js Infinite Resize Loop
**What goes wrong:** Chart canvas placed in percentage-sized container causes chart to grow indefinitely
**Why it happens:** Chart.js resizes canvas to fit container → canvas size change triggers container resize → loop
**How to avoid:** Use dedicated, relatively-positioned container with fixed aspect ratio OR use `maintainAspectRatio: false` with explicit height
**Warning signs:** Chart grows on every window resize; browser tab becomes unresponsive

**Prevention pattern:**
```css
/* Dedicated container pattern */
.chart-wrapper {
  position: relative;
  width: 100%;
  max-width: 800px;
}

/* OR fixed height pattern */
.chart-wrapper {
  position: relative;
  height: 400px;
}
```

### Pitfall 2: Timezone-Dependent Weekly Rollups
**What goes wrong:** Same activity appears in different weeks depending on server/user timezone
**Why it happens:** JavaScript Date defaults to local timezone; `new Date('2024-01-01').getDay()` returns different values in EST vs UTC
**How to avoid:** Always use UTC methods (`getUTCDay()`, `setUTCDate()`) for week boundary calculations; normalize to UTC immediately after parsing
**Warning signs:** Weekly totals change when deploying to different server regions; test data aggregates differently than production

**Prevention pattern:**
```typescript
// WRONG - local timezone dependent
function getWeekStartBad(date: Date): Date {
  const dayOfWeek = date.getDay(); // BAD - uses local timezone
  // ...
}

// CORRECT - UTC normalized
function getWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
  const dayOfWeek = d.getUTCDay(); // GOOD - UTC consistent
  // ...
}
```

### Pitfall 3: UMD/IIFE Bundle with Code Splitting
**What goes wrong:** Vite build fails with "UMD and IIFE output formats are not supported for code-splitting builds"
**Why it happens:** Dynamic imports create multiple chunks; IIFE expects single-file output
**How to avoid:** Set `rollupOptions.output.inlineDynamicImports: true` in Vite config
**Warning signs:** Build error mentioning code-splitting; multiple output files generated when expecting one

**Prevention pattern:**
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    lib: {
      formats: ['iife']
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true // CRITICAL for IIFE
      }
    }
  }
});
```

### Pitfall 4: Widget Script Tag innerHTML Injection
**What goes wrong:** Widget script tag added via `innerHTML` doesn't execute
**Why it happens:** Browser security prevents script execution from innerHTML; requires manual script element creation
**How to avoid:** Provide copy-paste `<script src="...">` tag for users; if dynamically loading, use `document.createElement('script')`
**Warning signs:** Widget doesn't initialize on some embedding methods; works when added to HTML source but not via JS injection

**Prevention pattern:**
```html
<!-- CORRECT - Static script tag -->
<div id="weekly-chart"></div>
<script src="https://your-site.com/weekly-bar-chart.js"></script>
<script>
  WeeklyBarChart.init('weekly-chart', '/data/stats/weekly-distance.json');
</script>

<!-- WRONG - innerHTML injection (won't work) -->
<script>
  document.body.innerHTML += '<script src="widget.js"></scr' + 'ipt>'; // Won't execute
</script>
```

### Pitfall 5: Chart.js Responsive in Flexbox/Grid
**What goes wrong:** Chart overflows flex/grid container
**Why it happens:** Flexbox/grid items have implicit `min-width: auto`, preventing canvas from shrinking
**How to avoid:** Set `min-width: 0` on flex/grid child containing chart
**Warning signs:** Chart doesn't shrink when container shrinks; horizontal scrollbar appears

**Prevention pattern:**
```css
.flex-container {
  display: flex;
}

.chart-item {
  min-width: 0; /* CRITICAL for responsive charts in flexbox */
  flex: 1;
}
```

### Pitfall 6: Average Pace Calculation from Speed
**What goes wrong:** Averaging speed values produces incorrect pace (non-linear relationship)
**Why it happens:** Pace (min/km) is 1/speed; arithmetic mean of speeds ≠ 1/(arithmetic mean of paces)
**How to avoid:** Calculate pace as `total_time / total_distance`, not `average(time/distance per activity)`
**Warning signs:** Average pace doesn't match manual calculation; slower activities over-weighted

**Prevention pattern:**
```typescript
// WRONG - averaging speeds then converting
const avgSpeed = activities.reduce((sum, a) => sum + a.average_speed, 0) / activities.length;
const avgPace = 1000 / (avgSpeed * 60); // INCORRECT

// CORRECT - total time / total distance
const totalMinutes = activities.reduce((sum, a) => sum + a.moving_time / 60, 0);
const totalKm = activities.reduce((sum, a) => sum + a.distance / 1000, 0);
const avgPace = totalKm > 0 ? totalMinutes / totalKm : 0; // CORRECT
```

## Code Examples

Verified patterns from official sources:

### Chart.js Bar Chart with Custom Data Format
```typescript
// Source: https://www.chartjs.org/docs/latest/general/data-structures.html
const weeklyData: WeeklyStats[] = [
  { weekStartISO: '2024-01-01T00:00:00Z', totalKm: 25.3, runCount: 3 },
  { weekStartISO: '2024-01-08T00:00:00Z', totalKm: 30.1, runCount: 4 }
];

new Chart(ctx, {
  type: 'bar',
  data: {
    // Simple label array
    labels: weeklyData.map(w => new Date(w.weekStartISO).toLocaleDateString()),
    datasets: [{
      label: 'Weekly Distance (km)',
      data: weeklyData.map(w => w.totalKm),
      backgroundColor: 'rgba(54, 162, 235, 0.8)'
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2 // Width:height ratio
  }
});
```

### Async File Reading with fs/promises
```typescript
// Source: https://heynode.com/tutorial/readwrite-json-files-nodejs/
import { readFile, writeFile } from 'fs/promises';

async function processActivities() {
  // Read JSON file
  const content = await readFile('data/activities/12345.json', 'utf-8');
  const activity = JSON.parse(content);

  // Process data
  const stats = computeStats(activity);

  // Write JSON file (atomic operation via temp file)
  const tempPath = 'data/stats/weekly.tmp.json';
  const finalPath = 'data/stats/weekly.json';

  await writeFile(tempPath, JSON.stringify(stats, null, 2));
  await rename(tempPath, finalPath); // Atomic rename
}
```

### Widget Embedding Pattern
```html
<!-- Source: https://makerkit.dev/blog/tutorials/embeddable-widgets-react -->
<!-- User copy-pastes this into their site -->
<div id="strava-weekly-chart"></div>
<script src="https://your-domain.com/dist/widget/weekly-bar-chart.js"></script>
<script>
  // Initialize widget with data URL
  window.WeeklyBarChart.init(
    'strava-weekly-chart',
    'https://your-domain.com/data/stats/weekly-distance.json'
  );
</script>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chart.js v2 auto-import | Chart.js v3+ tree-shaking | v3.0 (2021) | Bundle size reducible from 48KB to 14KB; requires manual component registration |
| Webpack for libraries | Vite library mode | Vite 2.0 (2021) | 10-20x faster builds; integrated dev server; simpler config for library output |
| Date manipulation libraries | Native Temporal API | ES2026 (partial support 2026) | Firefox 139, Chrome 144 support; still needs fallback for Safari; more reliable timezone handling |
| UMD universal format | IIFE for widgets | Ongoing trend | IIFE simpler for script-tag-only use case; UMD still needed for npm distribution |

**Deprecated/outdated:**
- **Chart.js v2.x API:** v2 reached EOL; v3+ breaking changes in scale configuration, dataset structure
- **chart.js/auto for production:** Convenience import for dev; production should use tree-shaking
- **Webpack DefinePlugin for globals:** Vite uses build.lib.name for UMD/IIFE globals automatically
- **Moment.js for dates:** Deprecated by maintainers; use date-fns or native Date (Temporal when stable)

## Open Questions

1. **Static JSON hosting strategy**
   - What we know: Widgets load from pre-generated JSON; needs public HTTP access
   - What's unclear: Should JSON live in `public/` (served alongside widget) or separate CDN? Does Jekyll/Astro site structure constrain this?
   - Recommendation: Default to `public/data/stats/` co-located with widget; planner should verify Jekyll/Astro compatibility

2. **Chart.js version compatibility with Shadow DOM**
   - What we know: Shadow DOM has 96% browser support; Chart.js works in regular DOM
   - What's unclear: Any known issues with Chart.js canvas rendering inside Shadow DOM? Performance implications?
   - Recommendation: LOW risk but should be verified in test-embed.html during implementation; fallback is unshadowed div with scoped classes

3. **Statistics computation frequency**
   - What we know: Phase 1 syncs activities on demand; stats should be pre-generated
   - What's unclear: Should stat generation be triggered automatically after sync, or manual script? What about historical recalculation on logic changes?
   - Recommendation: Start with manual `npm run compute-stats` script; Phase 3+ can add automation

4. **Embedding verification scope**
   - What we know: "Widget displays correctly when embedded in test HTML page" is success criterion
   - What's unclear: Should test include Jekyll/Astro simulation, or just plain HTML? Mobile responsive testing in scope?
   - Recommendation: Plain HTML sufficient for Phase 2; responsive behavior testable via browser dev tools; actual Jekyll/Astro integration deferred to deployment phase

## Sources

### Primary (HIGH confidence)
- [Chart.js Official Documentation - Integration](https://www.chartjs.org/docs/latest/getting-started/integration.html) - Tree-shaking and component registration verified
- [Chart.js Official Documentation - Bar Charts](https://www.chartjs.org/docs/latest/charts/bar.html) - Dataset configuration and options verified
- [Chart.js Official Documentation - Data Structures](https://www.chartjs.org/docs/latest/general/data-structures.html) - Label and dataset format verified
- [Chart.js Official Documentation - Responsive](https://www.chartjs.org/docs/latest/configuration/responsive.html) - Resize behavior and container requirements verified
- [Vite Official Documentation - Building for Production](https://vite.dev/guide/build) - Library mode configuration verified
- [Vite Official Documentation - Build Options](https://vite.dev/config/build-options) - IIFE format and rollup options verified

### Secondary (MEDIUM confidence)
- [Makerkit: Building Embeddable React Widgets](https://makerkit.dev/blog/tutorials/embeddable-widgets-react) - Shadow DOM patterns and widget architecture
- [MDN: Using Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) - Browser compatibility and API
- [HeyNode: Read/Write JSON Files with Node.js](https://heynode.com/tutorial/readwrite-json-files-nodejs/) - fs/promises patterns
- [MDN: Array.prototype.reduce()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce) - Aggregation patterns
- [JavaScript Date getDay() Method: Weekday-Safe Code](https://thelinuxcode.com/javascript-date-getday-method-weekday-safe-code-in-real-apps-2026/) - Timezone pitfalls for weekly rollups
- [JavaScript Temporal in 2026](https://bryntum.com/blog/javascript-temporal-is-it-finally-here/) - Current state of Temporal API adoption

### Tertiary (LOW confidence - flagged for validation)
- [6 Best JavaScript Charting Libraries for Dashboards in 2026](https://embeddable.com/blog/javascript-charting-libraries) - Library comparison trends
- [Which JavaScript Bundler is Best in 2025?](https://medium.com/@Hariharasudhan_/which-javascript-bundler-is-best-in-2025-vite-vs-rollup-vs-webpack-vs-esbuild-9bca86a9b36e) - Bundler performance claims
- [Charting Libraries Performance Comparison](https://chart.pdfmunk.com/blog/charting-libraries-performance-comparison) - Bundle size comparisons (need verification with actual builds)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Chart.js and Vite are documented official recommendations; TypeScript/Node.js already in use
- Architecture: MEDIUM-HIGH - Patterns verified from official docs; Shadow DOM approach based on multiple community sources
- Pitfalls: MEDIUM - Timezone and Chart.js resize issues verified in official docs/issues; widget injection issues from community best practices
- Code examples: HIGH - All examples derived from official documentation or verified Node.js patterns
- Bundle size claims: MEDIUM - Tree-shaking 48KB→14KB from Chart.js GitHub issues; needs verification in actual build

**Research date:** 2026-02-14
**Valid until:** ~30 days (stable ecosystem; Chart.js v4 and Vite v6 are current; no major releases expected)

**Open validation items:**
1. Verify Chart.js tree-shaking actually achieves 14KB in test build
2. Test Chart.js rendering inside Shadow DOM (no known issues found, but not explicitly documented)
3. Confirm IIFE bundle size with Chart.js stays under 100KB gzipped target
4. Validate weekly rollup logic with Phase 1 actual activity data (timezone edge cases)
