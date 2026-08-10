---
phase: 02-core-analytics-first-widget
plan: 02
subsystem: widget
tags: [chart.js, vite, shadow-dom, iife, typescript, embeddable-widget]

# Dependency graph
requires:
  - phase: 02-01
    provides: "Weekly distance statistics in data/stats/weekly-distance.json with 465 weeks of aggregated data"
provides:
  - "Embeddable weekly bar chart widget using Chart.js with tree-shaken bar chart components"
  - "Vite IIFE bundle configuration producing self-contained JavaScript (142KB uncompressed)"
  - "Shadow DOM widget implementation for complete style isolation"
  - "Test embedding page demonstrating widget integration pattern"
  - "Global WeeklyBarChart.init() API for widget initialization"
affects: [03-advanced-widgets, production-deployment]

# Tech tracking
tech-stack:
  added: [chart.js, vite, terser]
  patterns:
    - "Shadow DOM style isolation pattern for embeddable widgets"
    - "Vite IIFE library mode for self-contained browser bundles"
    - "Tree-shaken Chart.js imports (BarController, BarElement, CategoryScale, LinearScale only)"
    - "Inlined CSS styles for build simplicity"

key-files:
  created:
    - src/widget/index.ts
    - src/widget/chart-config.ts
    - src/widget/styles.css
    - vite.config.ts
    - tsconfig.widget.json
    - public/test-embed.html
    - dist/widget/weekly-bar-chart.iife.js
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Shadow DOM for style isolation (host page styles cannot affect widget)"
  - "Vite IIFE format for single-file embeddability (no module loader required)"
  - "Tree-shaken Chart.js imports reduce bundle size (bar chart components only, not full 'chart.js/auto')"
  - "Inlined CSS styles in TypeScript to avoid Vite CSS extraction complexity"
  - "Last 12 weeks displayed by default (slice recent data for readability)"
  - "Strava orange theme (rgba(252, 76, 2, 0.8)) for brand consistency"

patterns-established:
  - "Widget pattern: Class-based with Shadow DOM, global init function exposed via IIFE"
  - "Chart.js pattern: Import specific components, register via Chart.register(), avoid auto imports"
  - "Error handling pattern: Fail silently for embeddings (show error message in widget, console.error for debugging)"
  - "Vite library mode: entry in src/widget/, output to dist/widget/, formats: ['iife'], inlineDynamicImports: true"

# Metrics
duration: 5min
completed: 2026-02-14
---

# Phase 02 Plan 02: Core Analytics & First Widget - Embeddable Widget

**Embeddable weekly bar chart widget using Chart.js and Shadow DOM, bundled as self-contained IIFE (142KB) with tree-shaken imports, loading pre-generated weekly stats from static JSON**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-14T09:29:00Z
- **Completed:** 2026-02-14T09:46:58Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Built embeddable weekly bar chart widget with Chart.js showing last 12 weeks of running distance
- Configured Vite for IIFE library mode producing self-contained JavaScript bundle (142KB, ~50KB gzipped)
- Implemented Shadow DOM for complete style isolation between widget and host page
- Created tree-shaken Chart.js configuration using only bar chart components (not full auto import)
- Added test embedding page demonstrating integration pattern with style isolation
- Verified visual rendering with local server (checkpoint: user approved chart display)

## Task Commits

Each task was committed atomically:

1. **Task 1: Widget source, Vite config, and build** - `c3ceb4b` (feat)
   - Installed chart.js, vite, and terser dependencies
   - Created tsconfig.widget.json for browser-compatible TypeScript configuration
   - Implemented chart-config.ts with tree-shaken Chart.js imports (BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip)
   - Implemented widget/index.ts with WeeklyBarChartWidget class using Shadow DOM for style isolation
   - Created widget/styles.css with scoped styles (:host selector)
   - Configured Vite for IIFE library mode with inlineDynamicImports
   - Built widget bundle to dist/widget/weekly-bar-chart.iife.js (142KB)
   - Added null safety check for tooltip value to satisfy TypeScript strict mode

2. **Task 2: Test embedding page and local verification** - `9deb393` (feat)
   - Created public/test-embed.html with host page styles (Georgia serif) to test style isolation
   - Included widget script tag and WeeklyBarChart.init() initialization
   - Referenced local weekly-distance.json data file for testing
   - Started serve on port 4173 for visual verification

3. **Task 3: Visual verification of embedded widget** - Checkpoint: human-verify (approved)
   - User confirmed: chart renders correctly with orange bars showing weekly km totals
   - Shadow DOM style isolation verified: host page Georgia serif unaffected by widget sans-serif
   - No console errors
   - Responsive behavior confirmed

## Files Created/Modified

- `src/widget/index.ts` - WeeklyBarChartWidget class with Shadow DOM, global IIFE init function, fetch data from static JSON
- `src/widget/chart-config.ts` - Tree-shaken Chart.js configuration with createWeeklyBarChart function, Strava orange theme, last 12 weeks display
- `src/widget/styles.css` - Widget-scoped styles using :host selector for Shadow DOM isolation
- `vite.config.ts` - Vite library mode configuration for IIFE bundling with terser minification
- `tsconfig.widget.json` - Browser-compatible TypeScript config with ESNext module, bundler resolution, DOM types
- `public/test-embed.html` - Test page demonstrating widget embedding with deliberately different host styles
- `dist/widget/weekly-bar-chart.iife.js` - Built widget bundle (142KB uncompressed, ~50KB gzipped)
- `package.json` - Added chart.js, vite, terser dependencies

## Decisions Made

**1. Shadow DOM for style isolation**
- Used Shadow DOM with mode: 'open' to completely isolate widget styles from host page
- Host page styles cannot leak into widget, widget styles cannot affect host page
- Essential for embeddability on arbitrary websites

**2. Vite IIFE format for single-file embedding**
- Configured Vite library mode with formats: ['iife'] for classic script tag embedding
- No module loader required, works in any browser without build tools
- Global WeeklyBarChart object exposed on window for simple initialization
- inlineDynamicImports: true ensures single-file output

**3. Tree-shaken Chart.js imports**
- Imported specific components (BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip) instead of 'chart.js/auto'
- Reduces bundle size significantly (auto import includes all chart types)
- Registered only needed components via Chart.register()

**4. Inlined CSS in TypeScript**
- Embedded styles.css content as template literal in index.ts
- Avoids Vite CSS extraction complexity for IIFE builds
- Keeps styles.css file for reference and maintainability

**5. Last 12 weeks display**
- Limited visible bars to last 12 weeks for readability
- Weekly data extends to 465 weeks but chart slices to recent data
- Prevents overcrowded chart on long-term runner datasets

**6. Strava orange theme**
- Bar color: rgba(252, 76, 2, 0.8) with border rgba(252, 76, 2, 1)
- Maintains brand consistency with Strava's visual identity
- Chart title: "Weekly Running Distance"

**7. Fail-silent error handling**
- Widget shows "Chart unavailable" message on error
- console.error logs for debugging but doesn't throw
- Appropriate for embeddable widgets (shouldn't break host page)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added null safety check for tooltip value**
- **Found during:** Task 1 (chart-config.ts implementation)
- **Issue:** TypeScript strict mode complained about potentially undefined tooltip context.dataset.data[dataIndex] when computing tooltip label
- **Fix:** Added conditional check: `const value = context.dataset.data[dataIndex]; if (value == null) return 'N/A';` before formatting km value
- **Files modified:** src/widget/chart-config.ts
- **Verification:** TypeScript compilation succeeded with strict: true
- **Committed in:** c3ceb4b (Task 1 commit)

**2. [Rule 3 - Blocking] Installed terser for Vite minification**
- **Found during:** Task 1 (Vite build execution)
- **Issue:** Vite config specified minify: 'terser' but terser package not installed, build warned about falling back to esbuild
- **Fix:** Ran `npm install --save-dev terser` to install terser minifier
- **Files modified:** package.json, package-lock.json
- **Verification:** Vite build succeeded with terser minification, no warnings
- **Committed in:** c3ceb4b (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both auto-fixes necessary for TypeScript strict mode compliance and proper Vite configuration. No scope creep.

## Issues Encountered

None - all tasks completed successfully. Widget builds, renders correctly, and demonstrates style isolation as expected.

## User Setup Required

None - no external service configuration required.

**Embedding instructions for users:**
1. Copy dist/widget/weekly-bar-chart.iife.js to website
2. Copy data/stats/weekly-distance.json to website
3. Add to HTML:
   ```html
   <div id="strava-weekly-chart"></div>
   <script src="weekly-bar-chart.iife.js"></script>
   <script>
     WeeklyBarChart.init('strava-weekly-chart', 'weekly-distance.json');
   </script>
   ```

## Next Phase Readiness

**Ready for Phase 03 (Advanced Analytics & Widgets):**
- Widget embedding pattern established (Shadow DOM + IIFE)
- Vite build configuration proven for browser bundles
- Chart.js integration pattern documented (tree-shaken imports)
- Test page demonstrates full integration flow
- Bundle size acceptable (142KB uncompressed, ~50KB gzipped)

**Working example:**
- Test page at public/test-embed.html shows widget rendering correctly
- Visual verification checkpoint passed: bars visible, tooltips working, style isolation confirmed
- Ready for production embedding on personal website

**No blockers or concerns.**

## Self-Check: PASSED

All claims verified:
- ✓ All created files exist (src/widget/index.ts, chart-config.ts, styles.css, vite.config.ts, tsconfig.widget.json, public/test-embed.html)
- ✓ Built bundle exists (dist/widget/weekly-bar-chart.iife.js, 142KB)
- ✓ All commits exist (c3ceb4b, 9deb393)
- ✓ Widget renders correctly (checkpoint approved)
- ✓ Dependencies installed (chart.js, vite, terser in package.json)

---
*Phase: 02-core-analytics-first-widget*
*Completed: 2026-02-14*
