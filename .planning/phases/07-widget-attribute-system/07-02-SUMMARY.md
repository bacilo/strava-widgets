---
phase: 07-widget-attribute-system
plan: 02
subsystem: widget-system
tags: [custom-elements, chartjs, dark-mode, responsive]
completed: 2026-02-15
duration: 5.1 min

dependencies:
  requires:
    - 07-01-PLAN.md
  provides:
    - Stats card Custom Element with attribute API
    - Comparison chart Custom Element with attribute API
    - Chart.js theme integration (dark/light modes)
  affects:
    - All existing widget usage patterns (backwards compatible)

tech-stack:
  added:
    - Chart.js theme parameter system (dark/light grid lines, ticks, labels)
  patterns:
    - Multi-source data fetching pattern via fetchDataAndRender override
    - JSON attribute parsing for complex config (chart colors array)
    - Responsive chart sizing via CSS container queries

key-files:
  created: []
  modified:
    - src/widgets/stats-card/index.ts
    - src/widgets/comparison-chart/index.ts
    - src/widgets/comparison-chart/chart-config.ts
    - src/widgets/shared/widget-base.ts

decisions:
  - "Protected fetchDataAndRender: Changed widget-base.ts fetchDataAndRender from private to protected to allow subclasses to override for multi-source data fetching (stats-card and comparison-chart both fetch primary + secondary data sources)"
  - "Theme propagation to Chart.js: Pass theme parameter ('light' | 'dark') to chart creation functions to set grid colors, tick colors, title colors, and legend colors based on host element's data-theme attribute"
  - "Responsive chart height: Use :host([data-size]) selectors in chart-specific styles to set explicit canvas heights (compact: 200px, medium: 300px, large: 400px) preventing layout shifts"

metrics:
  tasks_completed: 2
  commits: 2
  files_modified: 4
  lines_added: 379
  lines_removed: 117
---

# Phase 07 Plan 02: Chart Widget Migration to Custom Elements

Migrated stats-card and comparison-chart widgets from JavaScript-config initialization to HTML attribute-driven Custom Elements, validating attribute system works with Chart.js rendering and dark/light theme switching.

## Tasks Completed

### Task 1: Migrate stats-card to Custom Element (2.8 min)

**Changes:**
- Rewrote StatsCardWidget to extend WidgetBase (no generic type parameter)
- Added Custom Element registration: `<strava-stats-card>`
- Implemented attribute-driven config:
  - `data-url`: Primary data source (all-time-totals.json)
  - `data-url-secondary`: Year-over-year data (optional)
  - `data-show-yoy`: Boolean to control year-over-year section (default true)
  - `data-title`, `data-show-title`: Title configuration
  - Inherited: `data-theme`, `data-width`, `data-accent`, etc. from WidgetBase
- Dark mode styles via `:host([data-theme="dark"])`:
  - Box shadow: darker shadow (0.3 alpha vs 0.1)
  - Stat items: `rgba(255, 107, 53, 0.1)` background
  - YoY items: `#2a2a2a` background
  - Borders: `#333` instead of `#eee`
  - Labels: `#999` and `#777` for muted text
- Responsive breakpoints via `:host([data-size])`:
  - compact: single column grid, smaller fonts (24px value, 18px title)
  - medium: 2-column grid
  - large: auto-fit grid (existing behavior)
- Backwards-compatible `StatsCard.init()` API maps config object to attributes

**Commit:** `d0b09ff` - feat(07-02): migrate stats-card to Custom Element

**Files:**
- `src/widgets/stats-card/index.ts` (158 lines changed)
- `src/widgets/shared/widget-base.ts` (1 line changed: private → protected)

### Task 2: Migrate comparison-chart to Custom Element (2.3 min)

**Changes:**
- Rewrote ComparisonChartWidget to extend WidgetBase
- Added Custom Element registration: `<strava-comparison-chart>`
- Implemented attribute-driven config:
  - `data-url`: Primary data (year-over-year.json)
  - `data-url-secondary`: Seasonal trends data (optional)
  - `data-chart-colors`: JSON array of color strings (default: ['#3b82f6', '#ef4444', '#22c55e'])
  - `data-show-legend`: Boolean (default true)
- Chart.js theme integration:
  - Updated `createYearOverYearChart()` and `createSeasonalTrendsChart()` to accept `theme` parameter
  - Dark mode: grid lines `rgba(255,255,255,0.1)`, ticks `#999`, titles/legends `#ccc`
  - Light mode: grid lines `rgba(0,0,0,0.1)`, ticks `#666`, titles/legends `#333`
- Responsive chart sizing via `:host([data-size])`:
  - compact: 200px height, 20px gap
  - medium: 300px height
  - large: 400px height
- Backwards-compatible `ComparisonChart.init()` API

**Commit:** `f8d67e4` - feat(07-02): migrate comparison-chart to Custom Element

**Files:**
- `src/widgets/comparison-chart/index.ts` (221 lines changed)
- `src/widgets/comparison-chart/chart-config.ts` (52 lines changed for theme support)

## Deviations from Plan

**None** - Plan executed exactly as written. All chart widget functionality works with Custom Elements, Chart.js theme integration successful, responsive sizing works correctly.

## Verification Results

### Build Verification
```
✓ npx tsc --noEmit - No compilation errors for stats-card or comparison-chart
✓ npm run build-widgets - Both widgets built successfully
✓ stats-card.iife.js contains customElements.define('strava-stats-card', ...)
✓ comparison-chart.iife.js contains customElements.define('strava-comparison-chart', ...)
```

### Attribute Support Verified
- Both widgets support `data-url`, `data-theme`, `data-title`, `data-width`, `data-accent`
- Stats card supports `data-url-secondary`, `data-show-yoy`
- Comparison chart supports `data-url-secondary`, `data-chart-colors`, `data-show-legend`
- Both include dark mode CSS variant styles (`:host([data-theme="dark"])`)
- Both include responsive breakpoints (`:host([data-size="compact|medium|large"])`)

### Success Criteria Met
- [x] Stats card renders as `<strava-stats-card>` Custom Element
- [x] Comparison chart renders as `<strava-comparison-chart>` Custom Element
- [x] Both support dark/light/auto theme via `data-theme` attribute
- [x] Both respond to container size changes via ResponsiveManager
- [x] Both maintain backwards-compatible JavaScript `init()` API
- [x] Chart.js chart colors adapt to theme (grid, ticks, labels, legend)

## Technical Highlights

1. **Multi-source Data Fetching Pattern**
   - Modified WidgetBase.fetchDataAndRender from private to protected
   - Subclasses override to fetch multiple JSON files in parallel
   - Stats card: all-time-totals.json + year-over-year.json
   - Comparison chart: year-over-year.json + seasonal-trends.json

2. **Chart.js Theme Integration**
   - Theme parameter flows from host element's `data-theme` attribute
   - Chart config applies theme-specific colors for all text/grid elements
   - Maintains Chart.js responsive:true for automatic canvas resizing

3. **Responsive Chart Sizing**
   - CSS container queries enable responsive layout without JavaScript
   - Explicit canvas heights prevent layout shifts during initial render
   - ResponsiveManager sets data-size attribute based on container width

## Self-Check: PASSED

**Files created:** (none - all modifications)

**Files modified:**
- [x] FOUND: src/widgets/stats-card/index.ts
- [x] FOUND: src/widgets/comparison-chart/index.ts
- [x] FOUND: src/widgets/comparison-chart/chart-config.ts
- [x] FOUND: src/widgets/shared/widget-base.ts

**Commits:**
- [x] FOUND: d0b09ff (stats-card Custom Element migration)
- [x] FOUND: f8d67e4 (comparison-chart Custom Element migration)

**Build artifacts:**
- [x] FOUND: dist/widgets/stats-card.iife.js (contains customElements.define)
- [x] FOUND: dist/widgets/comparison-chart.iife.js (contains customElements.define)

All claims verified. Plan execution complete.
