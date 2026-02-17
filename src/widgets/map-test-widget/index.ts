/**
 * Map Test Widget - Proof of concept for Leaflet + Shadow DOM integration
 * Validates that Leaflet renders correctly in Shadow DOM with all CSS, tiles, and controls
 */

import L from 'leaflet';
import leafletCSS from 'leaflet/dist/leaflet.css?inline';
import { WidgetBase } from '../shared/widget-base.js';

// Import marker icon images for Vite bundler fix
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
 * MapTestWidgetElement - Minimal map widget for testing Leaflet integration
 */
class MapTestWidgetElement extends WidgetBase {
  private map: L.Map | null = null;

  /**
   * No data URL needed - this widget doesn't fetch data
   */
  protected get dataUrl(): string {
    return '';
  }

  /**
   * Initialize map when element is connected to DOM
   */
  connectedCallback(): void {
    super.connectedCallback();

    // Inject Leaflet CSS into Shadow DOM
    const leafletStyle = document.createElement('style');
    leafletStyle.textContent = leafletCSS;
    this.shadowRoot!.appendChild(leafletStyle);

    // Create map container
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '400px';
    this.shadowRoot!.appendChild(container);

    // Initialize Leaflet map (Copenhagen default)
    this.map = L.map(container).setView([55.6761, 12.5683], 13);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Force Leaflet to recalculate tile positions after Shadow DOM layout
    requestAnimationFrame(() => {
      this.map?.invalidateSize();
    });

    // Add test marker at center
    L.marker([55.6761, 12.5683])
      .addTo(this.map)
      .bindPopup('Copenhagen, Denmark');
  }

  /**
   * Clean up map when element is disconnected
   */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  /**
   * Map widget doesn't need to render data
   */
  protected render(data: unknown): void {
    // No-op: map manages its own rendering
  }

  /**
   * Override to skip data fetching
   */
  protected async fetchDataAndRender(): Promise<void> {
    // Clear loading message if present
    if (this.shadowRoot) {
      const loadingEl = this.shadowRoot.querySelector('.widget-loading');
      if (loadingEl) {
        loadingEl.remove();
      }
    }
  }
}

// Register custom element
WidgetBase.register('map-test-widget', MapTestWidgetElement);
