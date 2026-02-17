/**
 * Heatmap Widget - Displays all running routes as a density heatmap
 * Features: Date range filtering, color scheme customization, pre-decoded points for instant rendering
 */

import L from 'leaflet';
import leafletCSS from 'leaflet/dist/leaflet.css?inline';
import 'leaflet.heat';
import { WidgetBase } from '../shared/widget-base.js';
import { COLOR_SCHEMES, DEFAULT_SCHEME } from './color-schemes.js';
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
 * HeatmapRouteData - Per-route data structure with date for filtering
 */
interface HeatmapRouteData {
  id: number;
  date: string;
  points: [number, number][];
}

/**
 * HeatmapWidgetElement - Renders all routes as a density heatmap
 */
class HeatmapWidgetElement extends WidgetBase {
  private map: L.Map | null = null;
  private heatLayer: L.HeatLayer | null = null;
  private allRoutes: HeatmapRouteData[] = [];
  private currentScheme: string = DEFAULT_SCHEME;
  private currentFilter: 'all-time' | string = 'all-time';

  /**
   * Default data URL
   */
  protected get dataUrl(): string {
    return 'data/heatmap/all-points.json';
  }

  /**
   * Clean up map when element is disconnected
   */
  disconnectedCallback(): void {
    if (this.heatLayer) {
      this.heatLayer.remove();
      this.heatLayer = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    super.disconnectedCallback();
  }

  /**
   * Render the heatmap with route data
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

    // Store all routes data
    this.allRoutes = data as HeatmapRouteData[];

    // Get configuration from attributes
    const height = this.getAttribute('data-height') || '500px';
    this.currentScheme = this.getAttribute('data-color-scheme') || DEFAULT_SCHEME;

    // Create wrapper for map and controls
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    this.shadowRoot.appendChild(wrapper);

    // Create map container
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = height;
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    wrapper.appendChild(container);

    // Initialize Leaflet map
    this.map = L.map(container).setView([30, 0], 2);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Force Leaflet to recalculate tile positions after Shadow DOM layout
    requestAnimationFrame(() => {
      this.map?.invalidateSize();
    });

    // Render heatmap with all routes (default filter)
    this.renderHeatmapFromRoutes(this.allRoutes);

    // Add controls for filtering and color schemes
    const controls = this.renderControls();
    wrapper.appendChild(controls);

    // Update stats display
    this.updateStatsDisplay();
  }

  /**
   * Render heatmap from filtered routes
   */
  private renderHeatmapFromRoutes(routes: HeatmapRouteData[]): void {
    if (!this.map) return;

    // Flatten all route points into single array
    const points: [number, number][] = [];
    for (const route of routes) {
      points.push(...route.points);
    }

    // Remove existing heatmap layer
    if (this.heatLayer) {
      this.heatLayer.remove();
    }

    // Create new heatmap layer with current options
    this.heatLayer = L.heatLayer(points, this.getHeatmapOptions()).addTo(this.map);

    // Auto-fit map bounds to show all points
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      this.map.fitBounds(bounds, { padding: [20, 20] });
    }
  }

  /**
   * Get heatmap layer options
   */
  private getHeatmapOptions(): L.HeatMapOptions {
    return {
      radius: 15,              // Point radius
      blur: 20,                // Blur amount
      maxZoom: 13,             // Max zoom for full intensity
      max: 1.0,                // Maximum point intensity
      minOpacity: 0.4,         // Minimum opacity
      gradient: COLOR_SCHEMES[this.currentScheme] || COLOR_SCHEMES[DEFAULT_SCHEME]
    };
  }

  /**
   * Render filter and color scheme controls
   */
  private renderControls(): HTMLElement {
    const controls = document.createElement('div');
    controls.className = 'heatmap-controls';
    controls.innerHTML = `
      <style>
        .heatmap-controls {
          position: absolute;
          top: 10px;
          right: 10px;
          background: white;
          padding: 12px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          z-index: 1000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 250px;
        }
        .heatmap-controls h3 {
          margin: 0 0 8px 0;
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }
        .heatmap-controls .section {
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #eee;
        }
        .heatmap-controls .section:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }
        .heatmap-controls button {
          margin: 4px 4px 4px 0;
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 12px;
          font-family: inherit;
        }
        .heatmap-controls button:hover {
          background: #f5f5f5;
        }
        .heatmap-controls button.active {
          background: #fc4c02;
          color: white;
          border-color: #fc4c02;
        }
        .heatmap-controls input[type="date"] {
          margin: 4px 4px 4px 0;
          padding: 4px 6px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
          font-family: inherit;
          width: 110px;
        }
        .heatmap-controls .stats {
          font-size: 12px;
          color: #666;
          margin-top: 8px;
        }
        .heatmap-controls .custom-range {
          margin-top: 4px;
        }
      </style>

      <div class="section">
        <h3>Date Range</h3>
        <div class="preset-buttons">
          <button data-preset="all-time" class="active">All Time</button>
          <button data-preset="2026">2026</button>
          <button data-preset="2025">2025</button>
          <button data-preset="2024">2024</button>
        </div>
        <div class="custom-range">
          <input type="date" id="start-date" placeholder="Start date" />
          <input type="date" id="end-date" placeholder="End date" />
          <button id="apply-custom">Apply</button>
        </div>
      </div>

      <div class="section">
        <h3>Color Scheme</h3>
        <div class="color-buttons">
          ${Object.keys(COLOR_SCHEMES).map(scheme =>
            `<button data-scheme="${scheme}" class="${scheme === this.currentScheme ? 'active' : ''}">${scheme}</button>`
          ).join('')}
        </div>
      </div>

      <div class="stats" id="stats-display">
        Showing ${this.allRoutes.length} runs
      </div>
    `;

    // Attach event listeners
    this.attachControlListeners(controls);

    return controls;
  }

  /**
   * Attach event listeners to control buttons
   */
  private attachControlListeners(controls: HTMLElement): void {
    // Date preset buttons
    controls.querySelectorAll('button[data-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = (e.target as HTMLElement).getAttribute('data-preset')!;
        this.applyDateFilter(preset);

        // Update active state
        controls.querySelectorAll('button[data-preset]').forEach(b => b.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
      });
    });

    // Custom date range
    controls.querySelector('#apply-custom')?.addEventListener('click', () => {
      const start = (controls.querySelector('#start-date') as HTMLInputElement).value;
      const end = (controls.querySelector('#end-date') as HTMLInputElement).value;

      if (start && end) {
        this.applyCustomDateFilter(start, end);

        // Deactivate preset buttons
        controls.querySelectorAll('button[data-preset]').forEach(b => b.classList.remove('active'));
      }
    });

    // Color scheme buttons
    controls.querySelectorAll('button[data-scheme]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const scheme = (e.target as HTMLElement).getAttribute('data-scheme')!;
        this.updateColorScheme(scheme);

        // Update active state
        controls.querySelectorAll('button[data-scheme]').forEach(b => b.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
      });
    });
  }

  /**
   * Apply date filter preset
   */
  private applyDateFilter(preset: string): void {
    this.currentFilter = preset;

    let startDate: Date;
    const endDate = new Date();  // Today

    switch (preset) {
      case '2026':
        startDate = new Date('2026-01-01');
        break;
      case '2025':
        startDate = new Date('2025-01-01');
        endDate.setFullYear(2025, 11, 31);  // Dec 31, 2025
        break;
      case '2024':
        startDate = new Date('2024-01-01');
        endDate.setFullYear(2024, 11, 31);  // Dec 31, 2024
        break;
      case 'all-time':
      default:
        startDate = new Date('2000-01-01');  // Before first Strava activity
    }

    this.filterAndRenderByDateRange(startDate, endDate);
  }

  /**
   * Apply custom date filter
   */
  private applyCustomDateFilter(startStr: string, endStr: string): void {
    this.currentFilter = 'custom';
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    this.filterAndRenderByDateRange(startDate, endDate);
  }

  /**
   * Filter routes by date range and re-render heatmap
   */
  private filterAndRenderByDateRange(start: Date, end: Date): void {
    // Filter routes by date
    const filteredRoutes = this.allRoutes.filter(route => {
      const routeDate = new Date(route.date);
      return routeDate >= start && routeDate <= end;
    });

    console.log(`Filtered ${filteredRoutes.length}/${this.allRoutes.length} routes (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`);

    // Re-render heatmap with filtered routes
    this.renderHeatmapFromRoutes(filteredRoutes);

    // Update stats display
    this.updateStatsDisplay(filteredRoutes.length);
  }

  /**
   * Update color scheme
   */
  private updateColorScheme(scheme: string): void {
    this.currentScheme = scheme;

    // Re-render heatmap with new color scheme
    // Note: Gradient must be set at layer creation time, so we remove and recreate
    if (this.heatLayer && this.map) {
      const currentPoints = this.heatLayer.getLatLngs();
      this.heatLayer.remove();
      this.heatLayer = L.heatLayer(currentPoints as [number, number][], this.getHeatmapOptions()).addTo(this.map);
    }
  }

  /**
   * Update stats display
   */
  private updateStatsDisplay(count?: number): void {
    const statsEl = this.shadowRoot?.querySelector('#stats-display');
    if (statsEl) {
      const displayCount = count !== undefined ? count : this.allRoutes.length;
      statsEl.textContent = `Showing ${displayCount.toLocaleString()} runs`;
    }
  }
}

// Register custom element
WidgetBase.register('heatmap-widget', HeatmapWidgetElement);
