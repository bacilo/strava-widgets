/**
 * Single Run Map Widget - Displays one activity's route on an interactive map
 * Shows route with zoom/pan, auto-fit viewport, hover effects, and click popup
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
 * SingleRunMapElement - Renders a single activity's route on a map
 */
class SingleRunMapElement extends WidgetBase {
  private map: L.Map | null = null;
  private polyline: L.Polyline | null = null;

  /**
   * Default data URL (fallback)
   */
  protected get dataUrl(): string {
    return 'data/routes/route-list.json';
  }

  /**
   * Clean up map when element is disconnected
   */
  disconnectedCallback(): void {
    if (this.polyline) {
      this.polyline.remove();
      this.polyline = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    super.disconnectedCallback();
  }

  /**
   * Render the map with route data
   */
  protected render(data: unknown): void {
    if (!this.shadowRoot) return;

    // Clear shadow DOM content except style elements
    const styles = Array.from(this.shadowRoot.querySelectorAll('style'));
    this.shadowRoot.innerHTML = '';
    styles.forEach(style => this.shadowRoot!.appendChild(style));

    // Get height from data-height attribute (default 400px)
    const height = this.getAttribute('data-height') || '400px';

    // Create map container
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = height;
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    this.shadowRoot.appendChild(container);

    // Get route data
    let route: RouteData | undefined;
    const activityId = this.getAttribute('data-activity-id');

    if (activityId && Array.isArray(data)) {
      // Find specific activity by ID
      route = (data as RouteData[]).find(r => r.id === parseInt(activityId));
    } else if (!Array.isArray(data)) {
      // Use data directly if it's a single RouteData object
      route = data as RouteData;
    } else if (Array.isArray(data) && data.length > 0) {
      // Use first route if no activity ID specified
      route = (data as RouteData[])[0];
    }

    // Check if route has polyline data
    if (!route || !route.polyline) {
      this.showError('No route data available');
      return;
    }

    // Initialize Leaflet map
    this.map = L.map(container).setView([0, 0], 2);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Render route with popup and auto-fit bounds
    this.polyline = RouteRenderer.renderRoute(this.map, route, {
      showPopup: true,
      fitBounds: true,
    });

    // Add hover effect
    RouteRenderer.addHoverEffect(this.polyline);
  }
}

// Register custom element
WidgetBase.register('single-run-map', SingleRunMapElement);
