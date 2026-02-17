/**
 * Multi-Run Overlay Widget - Displays latest N runs overlaid on a single map
 * Shows multiple routes with distinct colors, combined bounds, and click popups
 */

import L from 'leaflet';
import leafletCSS from 'leaflet/dist/leaflet.css?inline';
import { WidgetBase } from '../shared/widget-base.js';
import { RouteRenderer, RouteData } from '../shared/route-utils.js';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix default marker icons (required for Vite)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

/**
 * MultiRunOverlayElement - Renders multiple activity routes on a single map
 */
class MultiRunOverlayElement extends WidgetBase {
  private map: L.Map | null = null;
  private polylines: L.Polyline[] = [];

  /**
   * Default data URL for latest runs
   */
  protected get dataUrl(): string {
    return 'data/routes/latest-runs.json';
  }

  /**
   * Clean up map and polylines when element is disconnected
   */
  disconnectedCallback(): void {
    // Remove all polylines
    for (const polyline of this.polylines) {
      polyline.remove();
    }
    this.polylines = [];

    // Remove map
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    super.disconnectedCallback();
  }

  /**
   * Render the map with multiple routes
   */
  protected render(data: unknown): void {
    if (!this.shadowRoot) return;

    // Clear shadow DOM content except style elements
    const styles = Array.from(this.shadowRoot.querySelectorAll('style'));
    this.shadowRoot.innerHTML = '';
    styles.forEach(style => this.shadowRoot!.appendChild(style));

    // Inject Leaflet CSS into Shadow DOM
    const leafletStyle = document.createElement('style');
    leafletStyle.textContent = leafletCSS;
    this.shadowRoot.appendChild(leafletStyle);

    // Get height from data-height attribute (default 500px)
    const height = this.getAttribute('data-height') || '500px';

    // Create map container
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = height;
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    this.shadowRoot.appendChild(container);

    // Get count from data-count attribute (default 10)
    const count = parseInt(this.getAttribute('data-count') || '10', 10);

    // Get routes and slice to requested count
    const routes = Array.isArray(data) ? (data as RouteData[]).slice(0, count) : [];

    // Check if we have routes
    if (routes.length === 0) {
      this.showError('No route data available');
      return;
    }

    // Initialize Leaflet map
    this.map = L.map(container).setView([0, 0], 2);

    // Add CartoDB Positron tile layer (cleaner basemap, better route contrast)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 20,
      subdomains: 'abcd'
    }).addTo(this.map);

    // Force Leaflet to recalculate tile positions after Shadow DOM layout
    requestAnimationFrame(() => {
      this.map?.invalidateSize();
    });

    // Render multiple routes with distinct colors, thicker lines for visibility
    this.polylines = RouteRenderer.renderMultipleRoutes(this.map, routes, {
      weight: 4,
      opacity: 0.9,
      showPopup: true,
    });

    // Add hover effects to each polyline
    for (const polyline of this.polylines) {
      RouteRenderer.addHoverEffect(polyline, 4, 6);
    }
  }
}

// Register custom element
WidgetBase.register('multi-run-overlay', MultiRunOverlayElement);
