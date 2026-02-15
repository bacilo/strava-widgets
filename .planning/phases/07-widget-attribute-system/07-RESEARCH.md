# Phase 07: Widget Attribute System - Research

**Researched:** 2026-02-15
**Domain:** Web Components configuration via HTML data-attributes, Shadow DOM theming, responsive design
**Confidence:** HIGH

## Summary

This phase implements a comprehensive attribute-based configuration system for all widgets, enabling HTML-only customization without JavaScript in CMS environments. The research reveals that Web Components provide robust patterns for attribute parsing, dark/light mode detection via `prefers-color-scheme`, and responsive behavior using ResizeObserver and CSS custom properties.

The existing codebase already uses Shadow DOM with Chart.js 4.5.1, which includes the critical Shadow DOM resize fix (merged in v2.9.3, PR #6556). This means responsive Chart.js widgets will work correctly inside Shadow DOM.

Key challenges: attribute parsing requires strict type safety (NaN checks, JSON.parse error handling, boolean presence detection), and responsive behavior needs careful implementation to avoid ResizeObserver infinite loops.

**Primary recommendation:** Use native Web Components lifecycle (`observedAttributes` + `attributeChangedCallback`), CSS custom properties for theming with `prefers-color-scheme` for auto dark mode, and ResizeObserver for container-based responsive behavior. Avoid custom attribute parsing libraries—implement strict, tested parsers inline.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Components API | Native | Custom element lifecycle, Shadow DOM | Browser-native, no dependencies, full control over attributes |
| CSS Custom Properties | Native | Theming and dark mode | Pierce Shadow DOM by design, inherited automatically, fallback support |
| ResizeObserver API | Native | Container-based responsiveness | Baseline support since July 2020, element-level resize detection |
| `prefers-color-scheme` | Native CSS | Auto dark/light mode detection | Standard media query, OS-level preference detection |
| Chart.js | 4.5.1 (current) | Chart rendering | Already in use, Shadow DOM resize fix included (v2.9.3+) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Container Queries | Native CSS | Component-based responsive design | Alternative to ResizeObserver for pure CSS responsiveness (baseline 2023) |
| `light-dark()` CSS function | Native CSS | Simplified dark mode colors | Modern alternative to `@media (prefers-color-scheme)` when color-scheme is set |
| `color-scheme` CSS property | Native CSS | Enable light-dark() function | Must be set on `:root` for light-dark() to work |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native attribute parsing | `web-component-attribute-parser` library | Library handles pascal/camelCase conversion, but adds dependency and obscures parsing logic |
| ResizeObserver | Container Queries only | Container queries are pure CSS but lack JavaScript hooks for complex responsive logic |
| CSS custom properties | Inline styles from attributes | Inline styles work but break theming hierarchy and prevent inheritance |

**Installation:**
```bash
# No additional dependencies required - all native APIs
# Chart.js already installed:
npm install chart.js@^4.5.1
```

## Architecture Patterns

### Recommended Project Structure
```
src/widgets/
├── shared/
│   ├── widget-base.ts           # Extend with attribute parsing
│   ├── attribute-parser.ts      # Strict type-safe parsers (NEW)
│   ├── theme-manager.ts         # Dark mode detection (NEW)
│   └── responsive-manager.ts    # ResizeObserver wrapper (NEW)
├── stats-card/
│   └── index.ts                 # Add observedAttributes
├── comparison-chart/
│   └── index.ts                 # Add observedAttributes
├── streak-widget/
│   └── index.ts                 # Add observedAttributes
└── geo-stats-widget/
    └── index.ts                 # Add observedAttributes
```

### Pattern 1: Attribute-Backed Configuration with observedAttributes

**What:** Declare observed attributes statically, react to changes in `attributeChangedCallback`, centralize updates in single render method.

**When to use:** All widget configuration that users can set via HTML attributes.

**Example:**
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements
class WidgetBase extends HTMLElement {
  static observedAttributes = ['data-title', 'data-theme', 'data-width', 'data-colors'];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // Initial setup - read all attributes once
    this.updateStyle();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    // Skip if value unchanged
    if (oldValue === newValue) return;

    // Re-render on any attribute change
    this.updateStyle();
  }

  updateStyle() {
    const title = this.getAttribute('data-title') || 'Default Title';
    const theme = this.getAttribute('data-theme') || 'auto';
    const width = this.getAttribute('data-width') || '100%';
    const colors = this.parseColors(this.getAttribute('data-colors'));

    // Apply to Shadow DOM
    this.render({ title, theme, width, colors });
  }
}
```

### Pattern 2: Strict Attribute Parsing with Type Safety

**What:** Parse string attributes with explicit type guards, NaN checks, JSON.parse try/catch, and boolean presence detection using `hasAttribute()`.

**When to use:** Converting HTML attribute strings to typed values (numbers, booleans, objects).

**Example:**
```typescript
// Strict attribute parser with type safety
class AttributeParser {
  // Boolean: use hasAttribute (presence detection)
  static parseBoolean(element: HTMLElement, attrName: string, defaultValue: boolean = false): boolean {
    return element.hasAttribute(attrName) ? true : defaultValue;
  }

  // Number: strict NaN check
  static parseNumber(value: string | null, defaultValue: number, min?: number, max?: number): number {
    if (!value) return defaultValue;

    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      console.warn(`Invalid number: "${value}", using default: ${defaultValue}`);
      return defaultValue;
    }

    // Range validation
    if (min !== undefined && parsed < min) return min;
    if (max !== undefined && parsed > max) return max;

    return parsed;
  }

  // JSON: try/catch with fallback
  static parseJSON<T>(value: string | null, defaultValue: T): T {
    if (!value) return defaultValue;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.warn(`Invalid JSON: "${value}", using default:`, defaultValue);
      return defaultValue;
    }
  }

  // Color: CSS validation via temporary div
  static parseColor(value: string | null, defaultValue: string): string {
    if (!value) return defaultValue;

    // Use browser's CSS parsing
    const div = document.createElement('div');
    div.style.color = value;

    // If browser accepted it, style.color will be set
    if (div.style.color) return value;

    console.warn(`Invalid color: "${value}", using default: ${defaultValue}`);
    return defaultValue;
  }

  // Enum: whitelist validation
  static parseEnum<T extends string>(
    value: string | null,
    allowedValues: readonly T[],
    defaultValue: T
  ): T {
    if (!value) return defaultValue;

    if (allowedValues.includes(value as T)) {
      return value as T;
    }

    console.warn(`Invalid enum value: "${value}", allowed: ${allowedValues.join(', ')}`);
    return defaultValue;
  }
}
```

### Pattern 3: Dark Mode with CSS Custom Properties and prefers-color-scheme

**What:** Use `prefers-color-scheme` media query for auto detection, CSS custom properties for theme values, attribute for manual override.

**When to use:** All widgets that support theming.

**Example:**
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme
// CSS in Shadow DOM
const THEME_STYLES = `
:host {
  /* Light mode defaults */
  --bg-color: var(--widget-bg-light, #ffffff);
  --text-color: var(--widget-text-light, #333333);
  --accent-color: var(--widget-accent, #fc4c02);
}

/* Auto dark mode when system prefers dark */
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]), :host:not([data-theme]) {
    --bg-color: var(--widget-bg-dark, #1a1a1a);
    --text-color: var(--widget-text-dark, #ffffff);
    --accent-color: var(--widget-accent-dark, #ff6b35);
  }
}

/* Manual dark mode override */
:host([data-theme="dark"]) {
  --bg-color: var(--widget-bg-dark, #1a1a1a);
  --text-color: var(--widget-text-dark, #ffffff);
  --accent-color: var(--widget-accent-dark, #ff6b35);
}

/* Manual light mode override */
:host([data-theme="light"]) {
  --bg-color: var(--widget-bg-light, #ffffff);
  --text-color: var(--widget-text-light, #333333);
  --accent-color: var(--widget-accent, #fc4c02);
}

.widget {
  background: var(--bg-color);
  color: var(--text-color);
}
`;

// JavaScript detection (if needed)
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  const newColorScheme = e.matches ? 'dark' : 'light';
  this.handleThemeChange(newColorScheme);
});
```

### Pattern 4: Responsive Widgets with ResizeObserver

**What:** Use ResizeObserver to detect container size changes, update widget layout/sizing, wrap in requestAnimationFrame to avoid infinite loops.

**When to use:** Widgets that need to adapt to container size changes (not just viewport).

**Example:**
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
class ResponsiveWidget extends HTMLElement {
  private resizeObserver: ResizeObserver | null = null;

  connectedCallback() {
    // Track expected sizes to prevent loops
    const expectedSizes = new WeakMap<Element, number>();

    this.resizeObserver = new ResizeObserver((entries) => {
      // Use requestAnimationFrame to avoid infinite loops
      requestAnimationFrame(() => {
        for (const entry of entries) {
          // Use contentBoxSize for modern approach
          if (entry.contentBoxSize) {
            const inlineSize = entry.contentBoxSize[0].inlineSize;

            // Check if already at expected size
            const expectedSize = expectedSizes.get(entry.target);
            if (inlineSize === expectedSize) continue;

            // Update widget based on container size
            this.updateResponsiveLayout(inlineSize);
            expectedSizes.set(entry.target, inlineSize);
          } else {
            // Fallback for older browsers
            this.updateResponsiveLayout(entry.contentRect.width);
          }
        }
      });
    });

    // Observe the host element or container
    this.resizeObserver.observe(this);
  }

  disconnectedCallback() {
    // Clean up observer
    this.resizeObserver?.disconnect();
  }

  updateResponsiveLayout(width: number) {
    // Responsive breakpoints
    if (width < 400) {
      this.setAttribute('data-size', 'compact');
    } else if (width < 700) {
      this.setAttribute('data-size', 'medium');
    } else {
      this.setAttribute('data-size', 'large');
    }
  }
}
```

### Pattern 5: Chart.js Responsive Configuration in Shadow DOM

**What:** Chart.js with responsive: true, maintainAspectRatio: false, dedicated container with relative positioning.

**When to use:** All Chart.js widgets requiring responsive behavior.

**Example:**
```typescript
// Source: https://www.chartjs.org/docs/latest/configuration/responsive.html
// Chart.js 4.5.1 includes Shadow DOM resize fix (PR #6556, merged v2.9.3)

const CHART_CONTAINER_STYLES = `
.chart-container {
  position: relative;
  width: 100%;
  height: var(--chart-height, 300px);
}

.chart-container canvas {
  min-width: 0;
  max-width: 100%;
}
`;

// Chart configuration
const chartConfig = {
  type: 'bar',
  data: chartData,
  options: {
    responsive: true,              // Enable responsiveness
    maintainAspectRatio: false,    // Allow height control
    resizeDelay: 0,                // Update immediately
    onResize: (chart, size) => {
      console.log('Chart resized:', size);
    }
  }
};

// Create chart in Shadow DOM
const container = this.shadowRoot!.querySelector('.chart-container canvas') as HTMLCanvasElement;
new Chart(container, chartConfig);
```

### Pattern 6: Container Queries Alternative (Pure CSS)

**What:** Use CSS `@container` queries for responsive breakpoints without JavaScript.

**When to use:** Simple responsive layouts that don't need JavaScript logic.

**Example:**
```css
/* Source: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries */
:host {
  container-type: inline-size;
  container-name: widget;
}

/* Default compact layout */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

/* Expand to 2 columns at 400px container width */
@container widget (width > 400px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Expand to 3 columns at 700px container width */
@container widget (width > 700px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Anti-Patterns to Avoid

- **Converting attributes to properties then back to attributes:** Creates infinite loops in `attributeChangedCallback`. Use attributes as source of truth.
- **Using `getAttribute()` for boolean attributes:** Always use `hasAttribute()` for presence detection. The value doesn't matter, only presence.
- **Parsing JSON without try/catch:** JSON.parse throws on invalid input. Always catch and provide fallback.
- **Ignoring NaN from parseFloat/parseInt:** Check `isNaN()` explicitly. NaN propagates through calculations silently.
- **Modifying element size inside ResizeObserver without requestAnimationFrame:** Creates "ResizeObserver loop completed with undelivered notifications" errors.
- **Observing ALL attribute changes:** Only add attributes to `observedAttributes` that actually need callbacks. Performance optimization.
- **Setting inline styles instead of CSS custom properties:** Breaks theming hierarchy, prevents inheritance, harder to override.
- **Using `setAttribute` in property setters that reflect:** Only reflect attribute → property, not property → attribute (creates loops).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color string validation | Regex color parser | Browser's CSS parser (set `div.style.color`, check if applied) | Handles hex (#fff, #ffffff, #ffffffff), rgb(), rgba(), hsl(), hsla(), named colors, modern light-dark() |
| System theme detection | Polling localStorage or cookies | `window.matchMedia('(prefers-color-scheme: dark)')` | Real-time updates via `.addEventListener('change')`, OS-level accuracy |
| Container resize detection | Manual polling with setInterval | ResizeObserver API | Native, efficient, fires only on actual changes, baseline support since 2020 |
| Responsive layout breakpoints | JavaScript window.innerWidth checks | CSS Container Queries or ResizeObserver | Container-aware (not viewport), works in any layout context |
| Attribute type coercion | Complex type inference systems | Explicit parsers with fallbacks | Predictable, debuggable, no hidden coercion bugs |
| CSS variable inheritance | JavaScript style copying | Native CSS custom property cascade | Automatic inheritance, Shadow DOM piercing by design, fallback values with `var()` |

**Key insight:** Web platform provides robust primitives for all these problems. Custom solutions introduce bugs (NaN propagation, type coercion edge cases, memory leaks from manual listeners) and maintenance burden. Use platform APIs with explicit error handling.

## Common Pitfalls

### Pitfall 1: Boolean Attribute Values

**What goes wrong:** Checking `getAttribute('data-enabled') === 'true'` returns false when `<widget data-enabled>` is used (no value).

**Why it happens:** HTML boolean attributes are presence-based. `<input disabled>` and `<input disabled="disabled">` both mean disabled=true. The value doesn't matter.

**How to avoid:** Always use `hasAttribute()` for booleans:
```typescript
// WRONG
const enabled = this.getAttribute('data-enabled') === 'true';

// RIGHT
const enabled = this.hasAttribute('data-enabled');
```

**Warning signs:** Boolean config works with `data-enabled="true"` but fails with `data-enabled` alone.

**Source:** [HTML Standard - Boolean attributes](https://html.spec.whatwg.org/multipage/common-microsyntaxes.html)

### Pitfall 2: NaN Propagation from Numeric Attributes

**What goes wrong:** `parseFloat('abc')` returns `NaN`, which silently propagates through calculations, causing layouts to break.

**Why it happens:** JavaScript doesn't throw on NaN arithmetic. `NaN + 10 = NaN`, `NaN * 2 = NaN`, CSS ignores NaN values.

**How to avoid:** Explicit NaN checks after parsing:
```typescript
// WRONG
const width = parseFloat(this.getAttribute('data-width') || '100');
element.style.width = `${width}px`; // NaN px = invalid CSS

// RIGHT
const widthStr = this.getAttribute('data-width') || '100';
const width = parseFloat(widthStr);
if (isNaN(width)) {
  console.warn(`Invalid width: "${widthStr}", using default: 100`);
  width = 100;
}
element.style.width = `${width}px`;
```

**Warning signs:** Widget renders blank when given invalid numeric attribute. No errors in console.

### Pitfall 3: JSON.parse Crashes on Invalid Data

**What goes wrong:** User provides `data-config='{"bad json}'`, JSON.parse throws, widget crashes.

**Why it happens:** JSON.parse is strict. Single quotes, trailing commas, unquoted keys all throw SyntaxError.

**How to avoid:** Always wrap in try/catch with fallback:
```typescript
// WRONG
const config = JSON.parse(this.getAttribute('data-config') || '{}');

// RIGHT
const configStr = this.getAttribute('data-config');
let config = DEFAULT_CONFIG;
if (configStr) {
  try {
    config = { ...DEFAULT_CONFIG, ...JSON.parse(configStr) };
  } catch (error) {
    console.warn(`Invalid JSON config: "${configStr}", using defaults`);
  }
}
```

**Warning signs:** Widget works in development, breaks in production when users copy/paste config with single quotes.

### Pitfall 4: ResizeObserver Infinite Loop

**What goes wrong:** Modifying element size inside ResizeObserver callback triggers another resize event, creating infinite loop. Browser logs: "ResizeObserver loop completed with undelivered notifications."

**Why it happens:** ResizeObserver fires → callback changes size → triggers ResizeObserver → fires again.

**How to avoid:** Wrap modifications in `requestAnimationFrame` and track expected sizes:
```typescript
// WRONG
this.resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    entry.target.style.width = `${entry.contentBoxSize[0].inlineSize + 10}px`;
  }
});

// RIGHT
const expectedSizes = new WeakMap();
this.resizeObserver = new ResizeObserver((entries) => {
  requestAnimationFrame(() => {
    for (const entry of entries) {
      const expectedSize = expectedSizes.get(entry.target);
      if (entry.contentBoxSize[0].inlineSize === expectedSize) continue;

      const newSize = entry.contentBoxSize[0].inlineSize + 10;
      entry.target.style.width = `${newSize}px`;
      expectedSizes.set(entry.target, newSize);
    }
  });
});
```

**Warning signs:** Console flooded with "ResizeObserver loop" warnings, browser performance degrades.

**Source:** [MDN ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)

### Pitfall 5: Chart.js Not Resizing in Shadow DOM (Pre-2.9.3)

**What goes wrong:** Chart.js injects resize monitor CSS into document `<head>`, but Shadow DOM boundary blocks it.

**Why it happens:** Shadow DOM creates style isolation. External stylesheets don't apply inside.

**How to avoid:** Use Chart.js v2.9.3+ (PR #6556 fixed this). Current project uses v4.5.1 ✅

**Warning signs:** Chart renders but stays fixed size when container resizes. Only happens in Shadow DOM.

**Status:** RESOLVED in current stack (Chart.js 4.5.1 includes fix from v2.9.3).

**Source:** [Chart.js PR #6556](https://github.com/chartjs/Chart.js/pull/6556)

### Pitfall 6: CSS Custom Properties Not Updating in Shadow DOM

**What goes wrong:** Setting `--widget-bg` on host element from JavaScript doesn't update Shadow DOM styles.

**Why it happens:** Need to set on host element itself (`:host`), not on elements inside Shadow DOM.

**How to avoid:** Set CSS custom properties on `this` (the custom element host):
```typescript
// WRONG (sets on element inside Shadow DOM)
this.shadowRoot.querySelector('.widget').style.setProperty('--bg', '#fff');

// RIGHT (sets on host element)
this.style.setProperty('--bg', '#fff');
```

**Warning signs:** CSS variables work in light DOM but not Shadow DOM.

### Pitfall 7: Observing Too Many Attributes

**What goes wrong:** Adding all possible attributes to `observedAttributes` causes performance issues and unnecessary re-renders.

**Why it happens:** `attributeChangedCallback` fires for EVERY change to observed attributes, including `class`, `style`, etc. if you observe them.

**How to avoid:** Only observe attributes you actually need to react to:
```typescript
// WRONG (observes everything)
static observedAttributes = ['data-title', 'data-theme', 'data-width', 'data-height',
  'data-colors', 'data-labels', 'data-size', 'class', 'style', 'id'];

// RIGHT (only config attributes)
static observedAttributes = ['data-title', 'data-theme', 'data-width', 'data-colors'];
```

**Warning signs:** Widget re-renders constantly, performance degrades with many widgets on page.

**Source:** [MDN Custom Elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements)

## Code Examples

Verified patterns from official sources:

### Attribute-Based Widget Configuration
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements
// Complete example of attribute-driven widget

class ConfigurableWidget extends HTMLElement {
  static observedAttributes = [
    'data-title',
    'data-theme',
    'data-width',
    'data-height',
    'data-colors',
    'data-show-legend'
  ];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  render() {
    const title = this.getAttribute('data-title') || 'Chart';
    const theme = this.getAttribute('data-theme') || 'auto';
    const width = this.getAttribute('data-width') || '100%';
    const height = this.getAttribute('data-height') || '400px';
    const showLegend = this.hasAttribute('data-show-legend');

    // Parse colors as JSON array
    const colorsStr = this.getAttribute('data-colors');
    let colors = ['#fc4c02', '#00aaff', '#22c55e'];
    if (colorsStr) {
      try {
        colors = JSON.parse(colorsStr);
      } catch (e) {
        console.warn('Invalid colors JSON, using defaults');
      }
    }

    // Set CSS custom properties on host
    this.style.setProperty('--widget-width', width);
    this.style.setProperty('--widget-height', height);

    // Render content
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: block;
          width: var(--widget-width);
          height: var(--widget-height);
        }
        /* Theme styles here */
      </style>
      <div class="widget">
        <h2>${title}</h2>
        <!-- Widget content -->
      </div>
    `;
  }
}

customElements.define('configurable-widget', ConfigurableWidget);
```

### Dark Mode Auto-Detection with Manual Override
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme

class ThemedWidget extends HTMLElement {
  static observedAttributes = ['data-theme'];

  private themeMediaQuery: MediaQueryList;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // Listen for system theme changes
    this.themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.themeMediaQuery.addEventListener('change', this.handleSystemThemeChange);
  }

  connectedCallback() {
    this.updateTheme();
  }

  disconnectedCallback() {
    this.themeMediaQuery.removeEventListener('change', this.handleSystemThemeChange);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (name === 'data-theme' && oldValue !== newValue) {
      this.updateTheme();
    }
  }

  private handleSystemThemeChange = (e: MediaQueryListEvent) => {
    // Only update if theme is 'auto'
    const manualTheme = this.getAttribute('data-theme');
    if (!manualTheme || manualTheme === 'auto') {
      this.updateTheme();
    }
  };

  private updateTheme() {
    const themeAttr = this.getAttribute('data-theme') || 'auto';

    let effectiveTheme: 'light' | 'dark';
    if (themeAttr === 'auto') {
      effectiveTheme = this.themeMediaQuery.matches ? 'dark' : 'light';
    } else {
      effectiveTheme = themeAttr as 'light' | 'dark';
    }

    // Apply theme via CSS custom properties
    const colors = effectiveTheme === 'dark'
      ? { bg: '#1a1a1a', text: '#ffffff', accent: '#ff6b35' }
      : { bg: '#ffffff', text: '#333333', accent: '#fc4c02' };

    this.style.setProperty('--widget-bg', colors.bg);
    this.style.setProperty('--widget-text', colors.text);
    this.style.setProperty('--widget-accent', colors.accent);
  }
}
```

### Responsive Chart with ResizeObserver
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
// Source: https://www.chartjs.org/docs/latest/configuration/responsive.html

class ResponsiveChartWidget extends HTMLElement {
  private resizeObserver: ResizeObserver;
  private chart: Chart | null = null;

  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.render();
    this.initResizeObserver();
  }

  disconnectedCallback() {
    this.resizeObserver.disconnect();
    this.chart?.destroy();
  }

  private render() {
    this.shadowRoot!.innerHTML = `
      <style>
        .chart-container {
          position: relative;
          width: 100%;
          height: 100%;
        }
        canvas {
          min-width: 0;
          max-width: 100%;
        }
      </style>
      <div class="chart-container">
        <canvas></canvas>
      </div>
    `;

    // Create Chart.js instance
    const canvas = this.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    this.chart = new Chart(canvas, {
      type: 'bar',
      data: { /* chart data */ },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 0
      }
    });
  }

  private initResizeObserver() {
    const expectedSizes = new WeakMap<Element, { width: number, height: number }>();

    this.resizeObserver = new ResizeObserver((entries) => {
      requestAnimationFrame(() => {
        for (const entry of entries) {
          if (!entry.contentBoxSize) continue;

          const size = entry.contentBoxSize[0];
          const expected = expectedSizes.get(entry.target);

          if (expected?.width === size.inlineSize &&
              expected?.height === size.blockSize) {
            continue; // Already at expected size
          }

          // Update chart or layout based on size
          this.updateLayout(size.inlineSize, size.blockSize);

          expectedSizes.set(entry.target, {
            width: size.inlineSize,
            height: size.blockSize
          });
        }
      });
    });

    this.resizeObserver.observe(this);
  }

  private updateLayout(width: number, height: number) {
    // Responsive breakpoints
    if (width < 400) {
      this.setAttribute('data-layout', 'compact');
    } else if (width < 700) {
      this.setAttribute('data-layout', 'normal');
    } else {
      this.setAttribute('data-layout', 'wide');
    }

    // Chart.js handles its own resize via responsive: true
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Media queries only | Container Queries + ResizeObserver | 2023 baseline | Component-level responsiveness, no viewport dependency |
| `@media (prefers-color-scheme)` only | `light-dark()` CSS function + color-scheme | 2024+ | Simpler dark mode without media query duplication |
| Manual theme detection with JS | Native `prefers-color-scheme` + change events | 2020 baseline | Real-time system theme sync, no polling |
| Attribute reflection both ways | One-way: attribute → property only | Ongoing best practice | Prevents infinite callback loops |
| Chart.js manual resize listeners | Built-in responsive: true | Chart.js v2+ | Automatic, more reliable |
| Shadow DOM CSS injection workaround | Native support in Chart.js | v2.9.3 (Oct 2019) | No manual CSS injection needed |

**Deprecated/outdated:**
- **Custom resize listeners:** Use ResizeObserver (baseline 2020) or Chart.js built-in responsive
- **Property → attribute reflection:** Causes infinite `attributeChangedCallback` loops
- **Parsing colors with regex:** Browser CSS parser handles all formats, including new ones
- **Manual dark mode toggle:** Use `prefers-color-scheme` with auto-detection first, manual override second

## Open Questions

1. **Should widgets support legacy color formats or only CSS standard colors?**
   - What we know: Browser CSS parser accepts all valid formats automatically
   - What's unclear: Whether to validate/reject invalid colors or silently fallback
   - Recommendation: Use browser parser (set `div.style.color`), check if applied, fallback if not. Covers all current and future CSS color formats.

2. **Container Queries vs ResizeObserver for responsive behavior?**
   - What we know: Container Queries are baseline (2023), pure CSS. ResizeObserver gives JS hooks.
   - What's unclear: Which to use when, or use both?
   - Recommendation: Use Container Queries for CSS-only breakpoints (grid columns, font sizes). Use ResizeObserver when JavaScript logic needed (conditional chart types, data aggregation).

3. **Should attributes support units (data-width="400px") or assume pixels?**
   - What we know: CSS custom properties accept any valid CSS value
   - What's unclear: User expectation—do they want `data-width="400"` to mean px or be invalid?
   - Recommendation: Accept CSS units in attributes, set directly on CSS custom properties. Default to px only when pure number provided: `parseWidth('400') → '400px'`, `parseWidth('50%') → '50%'`.

## Sources

### Primary (HIGH confidence)
- [MDN: Using custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) - observedAttributes, attributeChangedCallback lifecycle
- [MDN: prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) - Dark mode detection
- [MDN: ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) - Container resize detection
- [MDN: CSS Container Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries) - Responsive layout patterns
- [Chart.js: Responsive Charts](https://www.chartjs.org/docs/latest/configuration/responsive.html) - Chart.js configuration
- [Chart.js PR #6556](https://github.com/chartjs/Chart.js/pull/6556) - Shadow DOM resize fix (merged v2.9.3)
- [HTML Standard: Boolean attributes](https://html.spec.whatwg.org/multipage/common-microsyntaxes.html) - Boolean attribute specification

### Secondary (MEDIUM confidence)
- [Web Components Best Practices](https://www.webcomponents.org/community/articles/web-components-best-practices) - Community patterns
- [Open Web Components: Attributes and Properties](https://open-wc.org/guides/knowledge/attributes-and-properties/) - Attribute vs property patterns
- [Ultimate Courses: Using Attributes and Properties in Custom Elements](https://ultimatecourses.com/blog/using-attributes-and-properties-in-custom-elements) - Practical patterns
- [Ultimate Courses: Lifecycle Hooks in Web Components](https://ultimatecourses.com/blog/lifecycle-hooks-in-web-components) - Lifecycle best practices
- [Ultimate Courses: Detecting Dark Mode in JavaScript](https://ultimatecourses.com/blog/detecting-dark-mode-in-javascript) - JavaScript detection methods
- [Max Böck: Container Queries in Web Components](https://mxb.dev/blog/container-queries-web-components/) - Container query patterns
- [web.dev: Custom Properties in Web Components](https://web.dev/articles/custom-properties-web-components) - CSS custom property theming
- [Lamplightdev: How to use boolean attributes in Web Components](https://lamplightdev.com/blog/2021/04/29/how-to-use-boolean-attributes-in-web-components/) - Boolean attribute patterns

### Tertiary (LOW confidence - WebSearch results verified against official docs)
- [GitHub: web-component-attribute-parser](https://github.com/bombadillo/web-component-attribute-parser) - Attribute parsing library (not using, but validated approach)
- [NPM: validate-color](https://www.npmjs.com/package/validate-color) - Color validation library (not using, browser parser preferred)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All native APIs with established browser support (2020+)
- Architecture: HIGH - Patterns verified against MDN documentation and official specs
- Pitfalls: HIGH - Verified against GitHub issues (Chart.js #5763) and HTML spec
- Chart.js Shadow DOM: HIGH - Fix confirmed in PR #6556 (v2.9.3), project uses v4.5.1 ✅
- Attribute parsing: HIGH - Based on HTML spec and MDN documentation
- Dark mode: HIGH - Based on W3C spec and MDN documentation
- ResizeObserver: HIGH - MDN documentation with baseline support confirmed

**Research date:** 2026-02-15
**Valid until:** March 2026 (30 days) - Stable APIs, low churn expected
