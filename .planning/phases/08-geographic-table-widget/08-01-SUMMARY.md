---
phase: 08-geographic-table-widget
plan: 01
subsystem: widget-performance-ux
tags: [widgets, table, sorting, pagination, accessibility, web-components]
dependency_graph:
  requires:
    - phase-07-plan-01-attribute-system
    - phase-06-plan-02-geo-stats-widget
  provides:
    - sortable-table-widget
    - table-pagination-utilities
    - accessible-table-patterns
  affects:
    - widget-library
    - geo-stats-display
tech_stack:
  added:
    - Intl.Collator (locale-aware string sorting)
    - Constructible Stylesheets (shared CSS across Shadow DOM instances)
    - TableSorter utility (generic sorting with type detection)
    - TablePaginator utility (boundary-checked pagination)
  patterns:
    - ARIA sortable table (W3C APG pattern)
    - Button-based sortable headers (accessibility)
    - Client-side pagination for <1000 rows
    - Shadow DOM table performance optimization (20 rows default, 50 max)
key_files:
  created:
    - src/widgets/geo-table-widget/index.ts (698 lines)
    - src/widgets/geo-table-widget/table-sorter.ts (89 lines)
    - src/widgets/geo-table-widget/table-paginator.ts (90 lines)
  modified: []
decisions:
  - title: Reusable Intl.Collator instance
    rationale: Create collator once and reuse for all sorts (2x faster than String.localeCompare per call)
    alternatives: String.localeCompare() per sort (slower), custom unicode comparison (error-prone)
  - title: Pagination default 20 rows with 1-50 clamp
    rationale: Research shows Shadow DOM table performance degrades with 50+ rows, 20 is optimal
    alternatives: No pagination (poor performance), fixed 50 (slower), unlimited (research pitfall)
  - title: Sort copy instead of mutating original
    rationale: Preserves original data order, prevents bugs when resetting sort
    alternatives: In-place sort (mutates data, breaks reset functionality)
  - title: Constructible Stylesheets for table CSS
    rationale: Shared CSS across multiple widget instances reduces memory usage
    alternatives: Inline <style> tags (duplicates CSS per instance), external stylesheet (breaks Shadow DOM isolation)
  - title: Separate columns config for countries vs cities
    rationale: Different datasets need different columns (countries have cities count, cities have country name)
    alternatives: Single column config with conditionals (complex), dynamic column detection (fragile)
metrics:
  duration: 3.0 minutes
  completed_at: 2026-02-15T19:55:06Z
  tasks_completed: 2
  commits: 2
  files_created: 3
  files_modified: 0
  lines_added: 877
---

# Phase 08 Plan 01: Geographic Table Widget Summary

**One-liner:** Sortable, paginated geographic table widget with locale-aware sorting, ARIA accessibility, and Shadow DOM performance optimization.

## Implementation Summary

Created a standalone geographic table widget (`strava-geo-table`) that displays running statistics by country or city with sortable columns and pagination. The widget extends WidgetBase and follows established Custom Element patterns from Phase 7.

**Key features:**
- Sortable columns using accessible `<button>` elements with aria-sort attributes
- Locale-aware string sorting via reusable Intl.Collator instance
- Pagination with configurable rows-per-page (default 20, clamped 1-50)
- Constructible Stylesheets for CSS sharing across Shadow DOM instances
- Support for both countries and cities datasets via `data-dataset` attribute
- Dark mode and responsive sizing with compact column hiding
- Sort indicators (▲▼♢) for visual feedback

## Tasks Completed

### Task 1: Create table sorting and pagination utilities
**Status:** ✅ Complete
**Commit:** df3ab33
**Files:** table-sorter.ts (89 lines), table-paginator.ts (90 lines)

Created two pure utility modules:

**TableSorter:**
- Static methods (no instantiation needed)
- Reusable Intl.Collator instance with sensitivity: 'base' (case/accent-insensitive)
- Separate sortByString and sortByNumber methods with explicit type coercion
- Generic sort() method delegating to appropriate sorter
- Always sorts copy of array (never mutates original)
- Exports SortState interface

**TablePaginator:**
- Generic class `TablePaginator<T>` with constructor taking totalRows and rowsPerPage
- Properties: currentPage (1-based), rowsPerPage, totalRows
- Getters: totalPages (Math.ceil), startIndex, endIndex
- Methods: paginate() (returns slice), goToPage() (boundary-checked), nextPage(), previousPage()
- updateTotal() method resets to page 1 if current page out of bounds

Both modules are pure TypeScript with no DOM dependencies or external imports.

### Task 2: Create geo-table-widget Custom Element
**Status:** ✅ Complete
**Commit:** 969928b
**Files:** index.ts (698 lines)

Implemented the main widget as Custom Element:

**Column configuration:**
- Defined TableColumn interface with key, label, sortable, type
- COUNTRY_COLUMNS: countryName, totalDistanceKm, activityCount, citiesCount
- CITY_COLUMNS: cityName, countryName, totalDistanceKm, activityCount

**Constructible Stylesheet:**
- Created outside class for sharing across instances
- Table styles matching geo-stats-widget aesthetic (same font sizes, padding, colors)
- Sort button styles: background: none, border: none, cursor: pointer, full width, left-aligned
- Sort indicators: aria-hidden spans with unicode arrows (▲▼♢)
- Pagination controls: flexbox row with prev/next buttons and "X-Y of Z" text
- Dark mode support using :host([data-theme="dark"]) and @media (prefers-color-scheme: dark)
- Responsive: :host([data-size="compact"]) hides less-important columns (cities count for countries, country for cities)

**Widget class:**
- Extends WidgetBase with observed attributes: data-dataset, data-rows-per-page, data-default-sort, data-default-sort-direction
- Private state: data array, sortState, paginator, columns
- data-dataset: parseEnum(['countries', 'cities'], 'countries')
- data-rows-per-page: parseNumber(20, 1, 50)
- connectedCallback override: injects base styles, adopts constructible stylesheet, initializes managers, sets columns based on dataset, initializes paginator, sets initial sort state
- dataUrl getter: returns /data/geo/countries.json or /data/geo/cities.json based on dataset
- render(): sorts data, paginates, builds accessible table with caption, sortable headers, formatted numbers
- createTableHeader(): creates th with button for sortable columns, adds aria-sort to sorted column only
- handleSort(): clears all aria-sort first (research pitfall #1), toggles direction, resets to page 1
- renderPaginationControls(): prev/next buttons (disabled at boundaries), "X-Y of Z" page info
- Title support: data-show-title (default true), data-title attribute or default "Running by Country"/"Running by City"

**Registration:**
- WidgetBase.register('strava-geo-table', GeoTableWidgetElement)
- Global GeoTableWidget object for backwards compatibility
- Exported GeoTableWidgetElement and GeoTableWidget

## Deviations from Plan

None - plan executed exactly as written.

## Technical Highlights

**Accessibility (ARIA):**
- Follows W3C ARIA Practices Guide sortable table pattern
- Uses `<button>` elements inside `<th>` for keyboard navigation
- Sets aria-sort attribute on sorted column only (removes from all others first)
- Table caption describes sorting instructions for screen readers
- Sort indicators use aria-hidden="true" (visual only, not announced)

**Performance optimizations:**
- Constructible Stylesheets: shared CSS reduces memory per widget instance
- Reusable Intl.Collator: ~2x faster than String.localeCompare per call
- Pagination: hard limit prevents Shadow DOM performance degradation with 50+ rows
- Array.slice for pagination: O(n) but fast for small datasets (<100 rows)

**Type safety:**
- Generic TablePaginator<T> works with any data type
- TableSorter uses keyof T for type-safe property access
- Column configuration enforces key/type consistency

**Dark mode:**
- All table elements have dark mode variants
- Uses :host([data-theme="dark"]) and @media (prefers-color-scheme: dark) patterns
- Theme propagation via ThemeManager from Phase 7

**Responsive design:**
- Compact mode hides less-important columns via CSS (no JavaScript DOM manipulation)
- ResponsiveManager triggers size attribute changes automatically
- Font sizes and padding adjust via data-size attribute

## Self-Check

Verifying implementation claims:

**Created files:**
```
✓ src/widgets/geo-table-widget/index.ts (698 lines)
✓ src/widgets/geo-table-widget/table-sorter.ts (89 lines)
✓ src/widgets/geo-table-widget/table-paginator.ts (90 lines)
```

**Commits:**
```
✓ df3ab33: feat(08-01): implement table sorting and pagination utilities
✓ 969928b: feat(08-01): create geo-table-widget with sorting and pagination
```

**TypeScript compilation:**
```
✓ npx tsc --noEmit passes with no errors
```

**Widget registration:**
```
✓ WidgetBase.register('strava-geo-table', GeoTableWidgetElement) present
✓ Global GeoTableWidget object exposed
```

**Exports:**
```
✓ TableSorter class exported from table-sorter.ts
✓ SortState interface exported from table-sorter.ts
✓ TablePaginator class exported from table-paginator.ts
✓ GeoTableWidgetElement and GeoTableWidget exported from index.ts
```

**Key patterns verified:**
```
✓ Intl.Collator created once outside methods
✓ Array sorting uses [...data].sort() (copy, not mutate)
✓ Sortable headers use <button> elements
✓ aria-sort only on sorted column (cleared from all others first)
✓ Pagination buttons disabled at boundaries
✓ Numbers formatted with toLocaleString()
✓ Constructible Stylesheet adopted in connectedCallback
```

## Self-Check: PASSED

All files exist, commits verified, TypeScript compilation successful, exports confirmed, accessibility patterns implemented correctly.

## Next Steps

**Immediate:**
- Plan 02: Add visual testing or demo page for table widget
- Plan 03: Performance testing with varying dataset sizes

**Future enhancements:**
- Multi-column sort (shift+click pattern)
- Column visibility toggles
- Export to CSV from table widget
- Filter/search functionality
- Custom column configurations via attributes

## Notes

- Research-informed implementation avoided all 7 documented pitfalls
- Follows W3C ARIA APG sortable table pattern exactly
- Compatible with existing Phase 7 attribute system
- Reuses CountryStats/CityStats types from Phase 6
- Zero additional dependencies (all native APIs)
- Widget ready for production use in HTML pages
