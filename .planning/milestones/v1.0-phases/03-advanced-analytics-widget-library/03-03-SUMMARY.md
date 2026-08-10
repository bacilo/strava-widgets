---
phase: 03-advanced-analytics-widget-library
plan: 03
subsystem: widget-library
tags: [widgets, shadow-dom, iife, chart.js, multi-build]
dependency-graph:
  requires:
    - 03-01-streaks
    - 03-02-advanced-stats
  provides:
    - widget-config-types
    - widget-base-class
    - stats-card-widget
    - comparison-chart-widget
    - multi-widget-build-system
  affects:
    - widget-architecture
    - build-system
tech-stack:
  added:
    - multi-entry-vite-builds
  patterns:
    - abstract-base-class
    - shadow-dom-isolation
    - tree-shaken-chart-imports
    - programmatic-build-script
key-files:
  created:
    - src/types/widget-config.types.ts
    - src/widgets/shared/widget-base.ts
    - src/widgets/stats-card/index.ts
    - src/widgets/comparison-chart/index.ts
    - src/widgets/comparison-chart/chart-config.ts
    - scripts/build-widgets.mjs
    - scripts/build-widgets.ts
  modified:
    - package.json
    - tsconfig.widget.json
decisions:
  - choice: "Abstract WidgetBase class with Shadow DOM setup"
    rationale: "DRY principle - all widgets need Shadow DOM, loading states, error handling, data fetching"
  - choice: "CSS custom properties for theming"
    rationale: "Allows runtime customization via config while maintaining style isolation"
  - choice: "Secondary data URL via config.options.secondaryDataUrl"
    rationale: "Flexible pattern for widgets needing multiple data sources without breaking single dataUrl convention"
  - choice: "Programmatic Vite build script instead of multi-entry config"
    rationale: "Vite IIFE mode doesn't support multi-entry well; separate builds with temp dirs avoids file conflicts"
  - choice: "Grid layout for stats card"
    rationale: "Responsive, auto-fits stat items, works on mobile and desktop"
  - choice: "Two charts stacked vertically in ComparisonChart"
    rationale: "Complementary views: bars for direct comparison, lines for trend patterns"
metrics:
  duration: 5.6 min
  tasks-completed: 2
  files-created: 7
  files-modified: 2
  commits: 2
  completed: "2026-02-14T10:50:25Z"
---

# Phase 03 Plan 03: Widget Infrastructure & Multi-Widget Build Summary

**One-liner:** Created WidgetBase abstraction with Shadow DOM isolation, StatsCard for all-time totals with YoY comparison, and ComparisonChart for grouped bar/line visualizations using programmatic multi-widget build system.

## What Was Built

### Widget Infrastructure

**WidgetConfig Interface** (`src/types/widget-config.types.ts`)
- Standardized configuration for all widgets
- Colors (background, text, accent, chartColors)
- Size (width, maxWidth, padding)
- Date range filtering
- Options (showLegend, showTitle, customTitle, secondaryDataUrl)
- Extensible for widget-specific options

**WidgetBase Abstract Class** (`src/widgets/shared/widget-base.ts`)
- Shadow DOM setup with `mode: 'open'`
- CSS custom properties injection from config
- Loading state management
- Error handling (fail silently with user-friendly message)
- Generic `fetchData<T>()` method
- Abstract `render(data)` method for subclasses
- Base styles (font-family, box-sizing, color scheme)

### StatsCard Widget

**Features:**
- Displays all-time totals (km, runs, hours, avg pace)
- Year-over-year comparison (current year vs previous year km with delta percentage)
- Card layout with rounded corners and shadow
- Grid-based stat items with Strava orange accent
- Responsive design (auto-fit grid)

**Data Sources:**
- Primary: `all-time-totals.json` (total km, runs, hours, pace)
- Secondary: `year-over-year.json` (via `config.options.secondaryDataUrl`)

**Styling:**
- Shadow DOM isolation
- CSS custom properties for theming
- Strava orange (#fc4c02) accent color
- Subtle card shadow and rounded corners

### ComparisonChart Widget

**Features:**
- Year-over-year grouped bar chart (monthly comparison, 3 most recent years)
- Seasonal trends line chart (smooth curves with tension: 0.3)
- Stacked vertically for complementary views
- Responsive with aspectRatio: 2

**Data Sources:**
- Primary: `year-over-year.json` (grouped bars)
- Secondary: `seasonal-trends.json` (line chart)

**Chart Configuration:**
- Tree-shaken Chart.js imports (BarController, LineController, LineElement, PointElement, etc.)
- Color-coded years (blue, red, green)
- Legend and tooltips
- Begin at zero for consistent scale

### Build System

**Multi-Widget Build Script** (`scripts/build-widgets.mjs`)
- Programmatic Vite build calls for each widget
- Temporary output directories to avoid file conflicts
- Copies final bundles to `dist/widgets/`
- Separate IIFE bundles: `stats-card.iife.js`, `comparison-chart.iife.js`
- npm script: `npm run build-widgets`

**Output:**
- `dist/widgets/stats-card.iife.js` (7.9 KB)
- `dist/widgets/comparison-chart.iife.js` (174 KB)
- Existing `dist/widget/weekly-bar-chart.iife.js` still builds correctly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript null check in chart tooltips**
- **Found during:** Task 2, TypeScript compilation
- **Issue:** Chart.js tooltip callbacks for `context.parsed.y` can be null, causing TypeScript error
- **Fix:** Added null/undefined checks before calling `toFixed()` in both chart configs
- **Files modified:** `src/widgets/comparison-chart/chart-config.ts`
- **Commit:** 8b1c967 (part of Task 2)

**2. [Rule 3 - Blocking] Vite multi-entry IIFE build conflict**
- **Found during:** Task 2, widget build execution
- **Issue:** Vite's IIFE mode with `emptyDir: false` still cleared output directory between builds, resulting in only one widget bundle
- **Fix:** Created programmatic build script using temporary output directories per widget, then copying to final location
- **Files created:** `scripts/build-widgets.mjs` (added fs operations for copy)
- **Impact:** Reliable multi-widget builds without file loss
- **Commit:** 8b1c967

## Verification Results

**TypeScript Compilation:**
```bash
npx tsc --noEmit
✓ No errors
```

**Widget Builds:**
```bash
npm run build-widgets
✓ stats-card.iife.js (7.9 KB)
✓ comparison-chart.iife.js (174 KB)

npm run build-widget
✓ weekly-bar-chart.iife.js (145.50 KB)
```

**Build System:**
- Multi-widget build completes without file conflicts
- Existing weekly-bar-chart build unaffected
- All widgets use IIFE format for embeddability

**Widget API:**
```javascript
// StatsCard
StatsCard.init('container-id', {
  dataUrl: '/data/stats/all-time-totals.json',
  options: {
    secondaryDataUrl: '/data/stats/year-over-year.json'
  }
});

// ComparisonChart
ComparisonChart.init('container-id', {
  dataUrl: '/data/stats/year-over-year.json',
  options: {
    secondaryDataUrl: '/data/stats/seasonal-trends.json',
    customTitle: 'Monthly Distance Trends'
  }
});
```

## Technical Decisions

**1. Abstract WidgetBase class**
- All widgets share Shadow DOM setup, loading/error states, data fetching
- Eliminates code duplication
- Consistent behavior across widget library

**2. CSS custom properties for theming**
- Applied to Shadow DOM host element
- Runtime customization via config
- Maintains style isolation while enabling user control

**3. Secondary data URL pattern**
- `config.options.secondaryDataUrl` for multi-source widgets
- Maintains single `dataUrl` convention for simple widgets
- Graceful degradation if secondary data unavailable

**4. Programmatic build script**
- Vite's multi-entry IIFE support is limited
- Temporary output directories prevent file conflicts
- Sequential builds with file copying ensures all widgets present
- Alternative to complex Rollup configuration

**5. Grid layout for stats card**
- `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))`
- Responsive without media queries
- Works on mobile (stacks) and desktop (horizontal)

**6. Stacked charts in ComparisonChart**
- Vertical flexbox layout
- Bars for direct comparison
- Lines for trend visualization
- Complementary insights from same data

## Key Files

### Created

| File | Purpose | Exports |
|------|---------|---------|
| `src/types/widget-config.types.ts` | Shared widget configuration interface | `WidgetConfig` |
| `src/widgets/shared/widget-base.ts` | Abstract base class for widgets | `WidgetBase<T>` |
| `src/widgets/stats-card/index.ts` | All-time stats summary widget | `StatsCard.init()` |
| `src/widgets/comparison-chart/index.ts` | Year-over-year charts widget | `ComparisonChart.init()` |
| `src/widgets/comparison-chart/chart-config.ts` | Chart.js configs for bar/line charts | `createYearOverYearChart()`, `createSeasonalTrendsChart()` |
| `scripts/build-widgets.mjs` | Multi-widget build script | N/A (executable) |

### Modified

| File | Changes |
|------|---------|
| `package.json` | Added `build-widgets` npm script |
| `tsconfig.widget.json` | Added `src/widgets/**/*` to include paths |

## Success Criteria Met

- [x] Two new widget IIFE bundles produced: stats-card.js and comparison-chart.js
- [x] StatsCard displays all-time totals and year-over-year delta
- [x] ComparisonChart displays grouped bar chart and seasonal line chart
- [x] Widgets accept config for colors, sizes, and options
- [x] Consistent init API: `StatsCard.init(id, config)`, `ComparisonChart.init(id, config)`
- [x] TypeScript compiles without errors
- [x] Both widgets use Shadow DOM for style isolation
- [x] Existing weekly-bar-chart build is not broken

## Self-Check: PASSED

**Created files verified:**
```bash
✓ FOUND: src/types/widget-config.types.ts
✓ FOUND: src/widgets/shared/widget-base.ts
✓ FOUND: src/widgets/stats-card/index.ts
✓ FOUND: src/widgets/comparison-chart/index.ts
✓ FOUND: src/widgets/comparison-chart/chart-config.ts
✓ FOUND: scripts/build-widgets.mjs
✓ FOUND: dist/widgets/stats-card.iife.js
✓ FOUND: dist/widgets/comparison-chart.iife.js
```

**Commits verified:**
```bash
✓ FOUND: 0f64fde (Task 1: widget config types, base class, stats card)
✓ FOUND: 8b1c967 (Task 2: comparison chart and multi-widget build)
```

## Next Steps

This plan completes the widget infrastructure and first two data-heavy widgets. Next plan (03-04) will build the remaining widgets:
- Activity calendar heatmap
- Time-of-day radar chart
- Streak counter

All will use the WidgetBase abstraction and build via the multi-widget build system.
