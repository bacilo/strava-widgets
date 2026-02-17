/**
 * TypeScript declarations for leaflet.heat plugin
 * No @types package exists, so we create manual declarations
 */

import * as L from 'leaflet';

declare module 'leaflet' {
  /**
   * Options for HeatLayer
   */
  interface HeatMapOptions {
    /**
     * Minimum opacity (0-1)
     */
    minOpacity?: number;

    /**
     * Maximum zoom level where points reach full intensity
     */
    maxZoom?: number;

    /**
     * Maximum point intensity (default 1.0)
     */
    max?: number;

    /**
     * Radius of each point in pixels (default 25)
     */
    radius?: number;

    /**
     * Blur amount (default 15)
     */
    blur?: number;

    /**
     * Color gradient configuration
     * Key: gradient stop position (0-1)
     * Value: color as hex string (e.g., '#ff0000')
     */
    gradient?: Record<number, string>;
  }

  /**
   * HeatLayer class for rendering heatmaps
   */
  interface HeatLayer extends Layer {
    /**
     * Set the lat/lng points for the heatmap
     */
    setLatLngs(latlngs: LatLngExpression[]): this;

    /**
     * Add a single lat/lng point to the heatmap
     */
    addLatLng(latlng: LatLngExpression): this;

    /**
     * Update heatmap options
     */
    setOptions(options: HeatMapOptions): this;

    /**
     * Redraw the heatmap
     */
    redraw(): this;

    /**
     * Get current lat/lng points
     */
    getLatLngs(): LatLngExpression[];
  }

  /**
   * Factory function to create a HeatLayer
   */
  function heatLayer(
    latlngs: LatLngExpression[],
    options?: HeatMapOptions
  ): HeatLayer;
}
