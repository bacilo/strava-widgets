/**
 * Shared route rendering utilities for map widgets
 *
 * Provides RouteRenderer class with polyline decoding, auto-fit bounds,
 * popup formatting, and hover effects for Leaflet maps.
 */
import L from 'leaflet';
/**
 * Route data structure for map widgets
 */
export interface RouteData {
    id: number;
    name: string;
    date: string;
    distance: number;
    movingTime: number;
    polyline: string;
    startLat: number;
    startLng: number;
}
/**
 * Options for route rendering
 */
export interface RouteRenderOptions {
    color?: string;
    weight?: number;
    opacity?: number;
    showPopup?: boolean;
    fitBounds?: boolean;
}
/**
 * Shared route rendering utilities for map widgets
 */
export declare class RouteRenderer {
    /**
     * Render a single route on the map
     *
     * @param map - Leaflet map instance
     * @param route - Route data with polyline
     * @param options - Rendering options
     * @returns Rendered polyline for cleanup
     */
    static renderRoute(map: L.Map, route: RouteData, options?: RouteRenderOptions): L.Polyline;
    /**
     * Render multiple routes with distinct colors
     *
     * @param map - Leaflet map instance
     * @param routes - Array of route data
     * @param options - Rendering options (color will be overridden)
     * @returns Array of rendered polylines for cleanup
     */
    static renderMultipleRoutes(map: L.Map, routes: RouteData[], options?: RouteRenderOptions): L.Polyline[];
    /**
     * Format route data as HTML popup content
     *
     * @param route - Route data
     * @returns HTML string for popup
     */
    static formatPopupContent(route: RouteData): string;
    /**
     * Calculate pace in min:sec/km format
     *
     * @param distanceMeters - Distance in meters
     * @param movingTimeSec - Moving time in seconds
     * @returns Pace string like "4:23/km"
     */
    static calculatePace(distanceMeters: number, movingTimeSec: number): string;
    /**
     * Add hover effect to polyline
     *
     * @param polyline - Leaflet polyline
     * @param normalWeight - Normal line weight (default 3)
     * @param hoverWeight - Hover line weight (default normal + 2)
     */
    static addHoverEffect(polyline: L.Polyline, normalWeight?: number, hoverWeight?: number): void;
    /**
     * Add a basemap layer switcher to the map
     * Returns the default (Positron) tile layer already added to the map
     */
    static addBasemapSwitcher(map: L.Map): L.TileLayer;
}
//# sourceMappingURL=route-utils.d.ts.map