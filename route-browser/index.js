/**
 * Route Browser Widget - Browse and select runs to view on an interactive map
 * Displays a scrollable list of runs alongside an embedded map,
 * updating the map when a run is selected.
 */
import L from 'leaflet';
import leafletCSS from 'leaflet/dist/leaflet.css?inline';
import { WidgetBase } from '../shared/widget-base.js';
import { RouteRenderer } from '../shared/route-utils.js';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
// Fix default marker icons (required for Vite)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
});
/**
 * RouteBrowserElement - Route browser widget with list + map side-by-side
 */
class RouteBrowserElement extends WidgetBase {
    map = null;
    currentPolyline = null;
    routes = [];
    selectedId = null;
    /**
     * Default data URL for route list
     */
    get dataUrl() {
        return 'data/routes/route-list.json';
    }
    /**
     * Render widget with route data
     */
    render(data) {
        this.routes = data;
        // Clear shadow DOM except styles
        const styles = Array.from(this.shadowRoot.querySelectorAll('style'));
        this.shadowRoot.innerHTML = '';
        styles.forEach(style => this.shadowRoot.appendChild(style));
        // Inject Leaflet CSS into Shadow DOM
        const leafletStyle = document.createElement('style');
        leafletStyle.textContent = leafletCSS;
        this.shadowRoot.appendChild(leafletStyle);
        // Add widget-specific styles
        const widgetStyles = document.createElement('style');
        widgetStyles.textContent = `
      .route-browser {
        display: grid;
        grid-template-columns: 280px 1fr;
        height: var(--browser-height, 500px);
        border: 1px solid var(--widget-border, #e0e0e0);
        border-radius: 8px;
        overflow: hidden;
      }
      .route-list {
        overflow-y: auto;
        border-right: 1px solid var(--widget-border, #e0e0e0);
        background: var(--widget-bg, #fff);
      }
      .route-list-item {
        padding: 12px 16px;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
        transition: background 0.15s;
      }
      .route-list-item:hover {
        background: #f5f5f5;
      }
      .route-list-item.selected {
        background: #fc4c02;
        color: white;
      }
      .route-list-item.selected .item-meta {
        color: rgba(255,255,255,0.8);
      }
      .item-name {
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .item-meta {
        font-size: 12px;
        color: #666;
      }
      .route-map {
        min-height: 300px;
      }
      /* Responsive: stack on narrow containers */
      @container widget (max-width: 500px) {
        .route-browser {
          grid-template-columns: 1fr;
          grid-template-rows: 200px 1fr;
        }
        .route-list {
          border-right: none;
          border-bottom: 1px solid var(--widget-border, #e0e0e0);
        }
      }
    `;
        this.shadowRoot.appendChild(widgetStyles);
        // Create container div with CSS variable for height
        const container = document.createElement('div');
        container.className = 'route-browser';
        const height = this.getAttribute('data-height') || '500px';
        container.style.setProperty('--browser-height', height);
        // Create list div
        const listDiv = document.createElement('div');
        listDiv.className = 'route-list';
        // Add each route as a list item
        for (const route of this.routes) {
            const item = document.createElement('div');
            item.className = 'route-list-item';
            item.setAttribute('data-id', route.id.toString());
            const distanceKm = (route.distance / 1000).toFixed(1);
            const formattedDate = new Date(route.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            item.innerHTML = `
        <div class="item-name">${route.name}</div>
        <div class="item-meta">${distanceKm} km &bull; ${formattedDate}</div>
      `;
            item.addEventListener('click', () => this.selectRoute(route.id));
            listDiv.appendChild(item);
        }
        // Create map div
        const mapDiv = document.createElement('div');
        mapDiv.className = 'route-map';
        // Append list and map to container
        container.appendChild(listDiv);
        container.appendChild(mapDiv);
        this.shadowRoot.appendChild(container);
        // Initialize Leaflet map
        this.map = L.map(mapDiv).setView([55.6761, 12.5683], 10);
        // Add basemap with layer switcher (Light/Dark/Street/Terrain)
        RouteRenderer.addBasemapSwitcher(this.map);
        // Force Leaflet to recalculate tile positions after Shadow DOM layout
        requestAnimationFrame(() => {
            this.map?.invalidateSize();
        });
        // Auto-select first route
        if (this.routes.length > 0) {
            this.selectRoute(this.routes[0].id);
        }
    }
    /**
     * Select a route and update the map
     */
    selectRoute(activityId) {
        // Find route in routes array
        const route = this.routes.find(r => r.id === activityId);
        if (!route || !this.map)
            return;
        // Remove current polyline if exists
        if (this.currentPolyline) {
            this.currentPolyline.remove();
        }
        // Update selected ID
        this.selectedId = activityId;
        // Render route with popup and auto-fit, thicker line for visibility
        this.currentPolyline = RouteRenderer.renderRoute(this.map, route, {
            weight: 5,
            opacity: 1.0,
            showPopup: true,
            fitBounds: true
        });
        // Add hover effect
        RouteRenderer.addHoverEffect(this.currentPolyline, 5, 7);
        // Update list selection visual state
        const items = this.shadowRoot.querySelectorAll('.route-list-item');
        items.forEach(item => {
            const itemId = parseInt(item.getAttribute('data-id') || '0', 10);
            if (itemId === activityId) {
                item.classList.add('selected');
                // Scroll selected item into view
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
            else {
                item.classList.remove('selected');
            }
        });
    }
    /**
     * Clean up when element is disconnected
     */
    disconnectedCallback() {
        if (this.currentPolyline) {
            this.currentPolyline.remove();
        }
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        super.disconnectedCallback();
    }
}
// Register custom element
WidgetBase.register('route-browser', RouteBrowserElement);
//# sourceMappingURL=index.js.map