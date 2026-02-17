---
status: diagnosed
trigger: "Leaflet maps render broken tiles on standalone pages - partial tiles, wrong height, zoom issues"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - Two root causes: (1) Leaflet CSS injected into document.head instead of Shadow DOM, (2) height chain broken because `:host` has no height and `data-height="100%"` resolves to 100% of nothing
test: Traced CSS injection in IIFE bundle and full height chain
expecting: N/A - root cause confirmed
next_action: Return diagnosis

## Symptoms

expected: Full-viewport Leaflet maps with contiguous tiles on standalone pages
actual: Partial tiles (random squares), map only ~top third of viewport, zoom extends beyond viewport
errors: None reported (visual rendering issue)
reproduction: Load any standalone page (heatmap.html, pinmap.html, routes.html) - consistent across refreshes
started: Since standalone pages were created

## Eliminated

## Evidence

- timestamp: 2026-02-17T00:01:00Z
  checked: Standalone HTML pages (heatmap.html, pinmap.html, routes.html)
  found: |
    - heatmap.html uses `data-height="100%"` on <heatmap-widget>
    - pinmap.html does NOT set `data-height` at all (defaults to 500px)
    - routes.html does NOT set `data-height` at all (defaults to 500px)
    - All three load Leaflet CSS via <link> in document <head>
    - All three set html,body { height: 100dvh; overflow: hidden }
  implication: Two of three pages don't even attempt full-height; the one that does uses 100% which needs a height chain

- timestamp: 2026-02-17T00:02:00Z
  checked: WidgetBase class (src/widgets/shared/widget-base.ts)
  found: |
    - `:host` style has NO height property (only display:block, width, max-width, padding)
    - `data-height` is NOT in observedAttributes
    - `data-height` is NOT handled in applyStyleAttributes()
    - No invalidateSize() call anywhere in the codebase
    - WidgetBase has no awareness of height at all
  implication: The custom element has no explicit height, so it collapses to content height. data-height="100%" on the container div inside Shadow DOM resolves to 100% of the content-height host, not 100dvh.

- timestamp: 2026-02-17T00:03:00Z
  checked: Widget render() methods for heatmap, pin-map, route-browser
  found: |
    - All read `this.getAttribute('data-height') || '500px'` and set it as inline style on map container
    - heatmap: container.style.height = height (which is "100%")
    - pin-map: container.style.height = height (which is "500px" default)
    - routes: uses CSS variable --browser-height (which is "500px" default)
    - Leaflet map is initialized synchronously after appending container to Shadow DOM
    - No invalidateSize() or requestAnimationFrame delay after map creation
  implication: The map container gets its height from the attribute but the parent chain doesn't propagate viewport height

- timestamp: 2026-02-17T00:04:00Z
  checked: Built IIFE bundle (dist/widgets/heatmap-widget.iife.js line 1)
  found: |
    - Vite's CSS injection wraps Leaflet CSS in: `document.head.appendChild(e)`
    - This injects Leaflet CSS into the DOCUMENT head, NOT into the Shadow DOM
    - The <link> tag in the standalone HTML pages also loads Leaflet CSS into document head
    - Shadow DOM encapsulates styles: CSS in document.head does NOT penetrate Shadow DOM boundary
    - The Leaflet map is created INSIDE the Shadow DOM
    - Therefore Leaflet CSS rules (position:absolute, overflow:hidden, tile positioning, etc.) DO NOT APPLY to the map elements
  implication: This is the PRIMARY cause of broken tile rendering - Leaflet's CSS is completely absent inside the Shadow DOM

- timestamp: 2026-02-17T00:05:00Z
  checked: Leaflet CSS content in the IIFE bundle
  found: |
    - Critical Leaflet CSS rules that are NOT reaching the Shadow DOM:
      - `.leaflet-pane, .leaflet-tile { position: absolute; left: 0; top: 0 }` - tiles positioned wrong
      - `.leaflet-container { overflow: hidden }` - map overflows
      - `.leaflet-tile { filter: inherit; visibility: hidden }` / `.leaflet-tile-loaded { visibility: inherit }` - tiles visibility
      - `.leaflet-zoom-animated { transform-origin: 0 0 }` - zoom breaks
    - Without these rules, tiles render at random positions (no position:absolute), map doesn't clip (no overflow:hidden)
  implication: Explains ALL symptoms: random tile squares (no absolute positioning), map overflow on zoom (no overflow:hidden)

## Resolution

root_cause: |
  TWO DISTINCT ROOT CAUSES causing all symptoms:

  ROOT CAUSE 1 (PRIMARY - broken tiles): Leaflet CSS is injected into document.head by Vite's CSS injection
  (line 1 of each IIFE bundle: `document.head.appendChild(e)`), but the Leaflet map container lives INSIDE
  the Shadow DOM. Shadow DOM style encapsulation means document-level CSS cannot penetrate into the Shadow DOM.
  All critical Leaflet CSS rules (tile positioning, overflow clipping, zoom transforms) are absent from the
  map's rendering context. This causes: partial/random tile rendering, zoom extending beyond viewport.

  ROOT CAUSE 2 (SECONDARY - wrong height): The `:host` selector in WidgetBase has no height property.
  The CSS height chain is: html,body(100dvh) -> custom-element(:host, no height = content-height) ->
  shadow-root -> wrapper-div -> map-container(height from data-height attribute).
  When data-height="100%" (heatmap.html), the map container's 100% resolves against the :host's content
  height, not the viewport. For pinmap.html and routes.html, data-height is not set so it defaults to
  500px, which avoids the percentage issue but still doesn't fill the viewport.

fix:
verification:
files_changed: []
