---
phase: 07-widget-attribute-system
plan: 01
subsystem: widget-infrastructure
tags: [web-components, custom-elements, attribute-parsing, theme-system, responsive-design]
depends_on:
  requires: []
  provides:
    - attribute-parser (6 type-safe parsing functions)
    - ThemeManager (dark/light mode with prefers-color-scheme)
    - ResponsiveManager (ResizeObserver with loop prevention)
    - WidgetBase (Custom Element base class)
  affects:
    - All widgets (breaking change - requires migration in Plans 02/03)
tech_stack:
  added:
    - Web Components API (native Custom Elements)
    - ResizeObserver API (container-based responsiveness)
    - CSS Custom Properties (theming)
    - prefers-color-scheme media query (auto dark mode)
  patterns:
    - observedAttributes pattern for attribute reactivity
    - Shadow DOM isolation with theme piercing
    - Attribute-driven configuration (zero JavaScript required)
    - ResizeObserver with requestAnimationFrame (infinite loop prevention)
key_files:
  created:
    - src/widgets/shared/attribute-parser.ts (131 lines)
    - src/widgets/shared/theme-manager.ts (95 lines)
    - src/widgets/shared/responsive-manager.ts (94 lines)
  modified:
    - src/widgets/shared/widget-base.ts (190 → 352 lines, complete refactor)
decisions:
  - Use native Web Components API instead of library (zero dependencies, full control)
  - Implement strict attribute parsing with explicit NaN checks and JSON.parse try/catch (avoid runtime errors)
  - Support dark/light/auto themes with prefers-color-scheme media query (system preference detection)
  - Use ResizeObserver wrapped in requestAnimationFrame to prevent infinite loops (per research pitfall #4)
  - Set data-size attribute (compact/medium/large) for CSS-only responsive styling (enables :host([data-size="compact"]) selectors)
  - Make WidgetBase.register() check for duplicate registration (prevents customElements.define errors)
  - Keep getConfig() method for backwards compatibility during migration (returns WidgetConfig from attributes)
metrics:
  duration: 2.6 minutes
  tasks_completed: 2
  commits: 2
  files_created: 3
  files_modified: 1
  lines_added: 580
  completed_at: 2026-02-15T20:19:40Z
---

# Phase 07 Plan 01: Widget Attribute Infrastructure Summary

**Attribute-based configuration system for Custom Elements with theme and responsive support**

## What Was Built

Created the foundational infrastructure for HTML attribute-driven widget configuration:

1. **attribute-parser.ts** - Six type-safe parsing functions:
   - `parseBoolean()` - Presence detection via hasAttribute() (NOT value check)
   - `parseNumber()` - Strict NaN checks with min/max clamping
   - `parseJSON()` - Try/catch wrapper with fallback
   - `parseColor()` - Browser CSS parser validation (handles all formats)
   - `parseEnum()` - Whitelist validation with warnings
   - `parseCSSValue()` - Auto-append 'px' for pure numbers, pass-through for units

2. **theme-manager.ts** - Dark/light mode system:
   - `getEffectiveTheme()` - Resolves light/dark/auto via prefers-color-scheme
   - `applyTheme()` - Injects CSS with theme-aware custom properties
   - `listenForChanges()` - Watches system theme changes (only triggers if auto mode)
   - `destroy()` - Cleanup for disconnectedCallback

3. **responsive-manager.ts** - Container-based responsiveness:
   - ResizeObserver with contentBoxSize support (modern) and contentRect fallback
   - requestAnimationFrame wrapper to prevent infinite loops
   - WeakMap size tracking to avoid duplicate callbacks
   - Auto-sets data-size attribute: compact (<400px), medium (400-699px), large (≥700px)

4. **widget-base.ts refactor** - Custom Element base class:
   - Extends HTMLElement (BREAKING CHANGE from plain class)
   - Custom Element lifecycle: connectedCallback, attributeChangedCallback, disconnectedCallback
   - Observes 11 common attributes: data-url, data-url-secondary, data-title, data-show-title, data-theme, data-width, data-max-width, data-padding, data-bg, data-text-color, data-accent
   - Integrates ThemeManager and ResponsiveManager on connect
   - Provides getConfig() for backwards-compatible WidgetConfig object
   - Static register() helper for customElements.define()
   - Theme-aware and responsive BASE_WIDGET_STYLES with container queries

## How It Works

**Attribute → Configuration Flow:**
1. User embeds widget: `<strava-stats data-url="..." data-theme="dark" data-width="600px">`
2. Custom Element registered via `WidgetBase.register('strava-stats', StatsWidget)`
3. Browser creates element, calls connectedCallback()
4. WidgetBase reads all data-attributes via getAttribute()
5. Attributes parsed with type-safe parsers (e.g., parseCSSValue, parseColor)
6. CSS custom properties applied: --widget-width, --widget-bg, --widget-text, --widget-accent
7. ThemeManager detects effective theme (manual override or system preference)
8. ResponsiveManager observes container, sets data-size attribute
9. fetchDataAndRender() fetches from data-url and calls render()

**Theme System:**
- data-theme="light" → Force light mode
- data-theme="dark" → Force dark mode
- data-theme="auto" or absent → Use prefers-color-scheme
- CSS uses :host([data-theme="dark"]) and @media (prefers-color-scheme: dark) selectors
- System theme changes trigger re-render (only if auto mode)

**Responsive System:**
- ResizeObserver watches host element (not viewport)
- Sets data-size attribute for CSS-only responsive: :host([data-size="compact"])
- Calls onResize(width, height) hook for JavaScript logic
- Wrapped in requestAnimationFrame to prevent "ResizeObserver loop" errors
- WeakMap prevents duplicate callbacks for same size

## Deviations from Plan

None - plan executed exactly as written.

## Integration Points

**Upstream dependencies:**
- None (native browser APIs only)

**Downstream consumers (Plans 02/03):**
- stats-card widget (migration required)
- comparison-chart widget (migration required)
- streak-widget (migration required)
- geo-stats-widget (migration required)

**Breaking changes:**
- WidgetBase constructor signature changed from `(containerId, config)` to `()` (extends HTMLElement)
- Widgets must now extend Custom Element pattern, not plain class
- Shadow DOM created in constructor, not initShadowDom()
- Configuration read from attributes, not passed to constructor
- All individual widgets need migration to Custom Element pattern

## Testing Notes

**Compilation status:**
- ✅ Shared modules compile cleanly in isolation
- ❌ Individual widgets have expected compilation errors (will be fixed in Plans 02/03)

**Expected errors in widget files:**
- "Type 'WidgetBase' is not generic" - WidgetBase no longer takes generic type parameter
- "Property 'config' does not exist" - config is now read via getConfig() method
- "Property 'shadowRoot' does not exist" - shadowRoot inherited from HTMLElement
- "Property 'fetchData' does not exist" - fetchData now protected, accessed correctly in subclasses

**Manual testing (post-migration):**
- Attribute parsing: Test with invalid values (NaN, bad JSON, invalid colors) → should fallback gracefully
- Boolean attributes: Test both `data-show-title` (presence) and `data-show-title="false"` (presence, not value)
- Theme switching: Test light/dark/auto modes, verify system theme changes respected
- Responsive behavior: Resize container, verify data-size attribute updates (compact/medium/large)
- CSS custom properties: Verify --widget-bg, --widget-text, --widget-accent applied correctly

## Performance Characteristics

**Runtime overhead:**
- Attribute parsing: O(1) per attribute (called once in connectedCallback)
- Theme detection: O(1) matchMedia query
- ResizeObserver: Efficient native API, only fires on actual size changes
- requestAnimationFrame: Batches DOM updates, prevents layout thrashing

**Memory footprint:**
- ThemeManager: 1 MediaQueryList + 1 event listener per widget
- ResponsiveManager: 1 ResizeObserver + 1 WeakMap per widget
- All cleaned up in disconnectedCallback (no leaks)

**Best practices applied:**
- WeakMap for size tracking (auto garbage collection)
- Event listener cleanup in destroy() methods
- requestAnimationFrame batching (prevents ResizeObserver loops)
- Lazy CSS custom property setting (only if attribute present)

## Known Limitations

1. **Attribute values are strings** - All type coercion must be explicit (NaN checks, JSON.parse try/catch)
2. **Boolean attributes require hasAttribute()** - Do NOT check value === 'true' (presence detection per HTML spec)
3. **CSS custom properties don't inherit into Shadow DOM automatically** - Must be set on :host element
4. **ResizeObserver triggers on all size changes** - Including programmatic changes, not just user resize
5. **observedAttributes is static** - Cannot be changed after element registration
6. **Individual widgets broken until migration** - Plans 02/03 required before widgets work again

## Next Steps

**Immediate (Plan 02):**
- Migrate stats-card and comparison-chart to Custom Element pattern
- Change from constructor(containerId, config) to extend Custom Element
- Replace this.config with this.getConfig() or direct getAttribute() calls
- Add abstract get dataUrl() implementation
- Test with HTML attributes: `<strava-stats data-url="..." data-theme="dark">`

**Immediate (Plan 03):**
- Migrate streak-widget and geo-stats-widget
- Same pattern as Plan 02
- Verify all widgets work with attribute-driven configuration

**Future enhancements (not planned):**
- Add data-colors attribute for multi-color chart customization (JSON array)
- Support data-date-range attribute for filtering (JSON object with start/end)
- Add container query CSS examples to widget-specific styles
- Document attribute API in widget embed snippets

## Self-Check: PASSED

✅ **Files created:**
- src/widgets/shared/attribute-parser.ts exists
- src/widgets/shared/theme-manager.ts exists
- src/widgets/shared/responsive-manager.ts exists

✅ **Files modified:**
- src/widgets/shared/widget-base.ts modified

✅ **Exports verified:**
- attribute-parser.ts exports 6 functions (parseBoolean, parseNumber, parseJSON, parseColor, parseEnum, parseCSSValue)
- theme-manager.ts exports ThemeManager class (getEffectiveTheme, applyTheme, listenForChanges, destroy)
- responsive-manager.ts exports ResponsiveManager class (observe, disconnect)
- widget-base.ts exports WidgetBase extending HTMLElement

✅ **Compilation:**
- Shared modules compile cleanly in isolation (no internal errors)
- Individual widgets have expected compilation errors (will be fixed in Plans 02/03)

✅ **Commits exist:**
- c76f5a7: feat(07-01): add attribute parsing and theme infrastructure
- 793546e: refactor(07-01): convert WidgetBase to Custom Element with attribute support

✅ **Must-haves met:**
- Attribute parser converts string attributes to typed values with safe defaults ✅
- Theme manager detects system dark/light preference and responds to data-theme attribute ✅
- Responsive manager detects container size changes via ResizeObserver ✅
- Widget base class extends HTMLElement and reads configuration from data-attributes ✅
