/**
 * Shared route rendering utilities for map widgets
 *
 * Provides RouteRenderer class with polyline decoding, auto-fit bounds,
 * popup formatting, and hover effects for Leaflet maps.
 */
import L from 'leaflet';
import polylineCodec from '@mapbox/polyline';
/**
 * Default route rendering options
 */
const DEFAULT_OPTIONS = {
    color: '#fc4c02',
    weight: 3,
    opacity: 0.8,
    showPopup: true,
    fitBounds: true,
};
/**
 * Shared route rendering utilities for map widgets
 */
export class RouteRenderer {
    /**
     * Render a single route on the map
     *
     * @param map - Leaflet map instance
     * @param route - Route data with polyline
     * @param options - Rendering options
     * @returns Rendered polyline for cleanup
     */
    static renderRoute(map, route, options) {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        // Decode polyline to coordinates [[lat, lng], ...]
        const coordinates = polylineCodec.decode(route.polyline);
        // Create Leaflet polyline
        const polyline = L.polyline(coordinates, {
            color: opts.color,
            weight: opts.weight,
            opacity: opts.opacity,
        }).addTo(map);
        // Add popup if requested
        if (opts.showPopup) {
            const popupContent = RouteRenderer.formatPopupContent(route);
            polyline.bindPopup(popupContent);
        }
        // Auto-fit bounds if requested
        if (opts.fitBounds) {
            const bounds = polyline.getBounds();
            // Fallback for single-point routes (bounds not valid)
            if (bounds.isValid()) {
                map.fitBounds(bounds, {
                    padding: [20, 20],
                    maxZoom: 15,
                });
            }
            else {
                // Use start coordinates with default zoom
                map.setView([route.startLat, route.startLng], 13);
            }
        }
        return polyline;
    }
    /**
     * Render multiple routes with distinct colors
     *
     * @param map - Leaflet map instance
     * @param routes - Array of route data
     * @param options - Rendering options (color will be overridden)
     * @returns Array of rendered polylines for cleanup
     */
    static renderMultipleRoutes(map, routes, options) {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const polylines = [];
        // Render each route with distinct color via HSL hue rotation
        for (let i = 0; i < routes.length; i++) {
            const hue = Math.floor((i * 360) / routes.length);
            const color = `hsl(${hue}, 100%, 50%)`;
            const polyline = RouteRenderer.renderRoute(map, routes[i], {
                ...opts,
                color,
                fitBounds: false, // Don't fit bounds per route
            });
            polylines.push(polyline);
        }
        // Fit map to combined bounds of all routes
        if (opts.fitBounds && polylines.length > 0) {
            const featureGroup = L.featureGroup(polylines);
            map.fitBounds(featureGroup.getBounds(), {
                padding: [20, 20],
                maxZoom: 15,
            });
        }
        return polylines;
    }
    /**
     * Format route data as HTML popup content
     *
     * @param route - Route data
     * @returns HTML string for popup
     */
    static formatPopupContent(route) {
        const distanceKm = (route.distance / 1000).toFixed(1);
        const pace = RouteRenderer.calculatePace(route.distance, route.movingTime);
        const date = new Date(route.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
        return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.4;">
        <div style="font-weight: 600; margin-bottom: 4px;">${route.name}</div>
        <div style="font-size: 13px; color: #666;">
          <div>${distanceKm} km</div>
          <div>${pace}</div>
          <div>${date}</div>
        </div>
      </div>
    `;
    }
    /**
     * Calculate pace in min:sec/km format
     *
     * @param distanceMeters - Distance in meters
     * @param movingTimeSec - Moving time in seconds
     * @returns Pace string like "4:23/km"
     */
    static calculatePace(distanceMeters, movingTimeSec) {
        // Handle edge case of zero distance
        if (distanceMeters === 0) {
            return '--:--/km';
        }
        const paceSecondsPerKm = (movingTimeSec / distanceMeters) * 1000;
        const minutes = Math.floor(paceSecondsPerKm / 60);
        const seconds = Math.floor(paceSecondsPerKm % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
    }
    /**
     * Add hover effect to polyline
     *
     * @param polyline - Leaflet polyline
     * @param normalWeight - Normal line weight (default 3)
     * @param hoverWeight - Hover line weight (default normal + 2)
     */
    static addHoverEffect(polyline, normalWeight = 3, hoverWeight) {
        const hover = hoverWeight ?? normalWeight + 2;
        polyline.on('mouseover', () => {
            polyline.setStyle({ weight: hover, opacity: 1.0 });
        });
        polyline.on('mouseout', () => {
            polyline.setStyle({ weight: normalWeight, opacity: 0.8 });
        });
    }
    /**
     * Add a basemap layer switcher to the map
     * Returns the default (Positron) tile layer already added to the map
     */
    static addBasemapSwitcher(map) {
        const positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            maxZoom: 20,
            subdomains: 'abcd'
        }).addTo(map);
        const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            maxZoom: 20,
            subdomains: 'abcd'
        });
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19
        });
        const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
            maxZoom: 17
        });
        L.control.layers({
            'Light': positron,
            'Dark': dark,
            'Street': osm,
            'Terrain': topo,
        }, {}, { position: 'bottomleft' }).addTo(map);
        return positron;
    }
}
//# sourceMappingURL=route-utils.js.map