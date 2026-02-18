/**
 * Predefined color schemes for heatmap visualization
 * Includes perceptually uniform and brand-aligned gradients
 */
/**
 * Predefined color schemes for heatmap
 */
export const COLOR_SCHEMES = {
    /**
     * Classic hot (red-yellow-white) - traditional thermal heatmap
     */
    hot: {
        0.0: '#000080', // Navy (low density)
        0.3: '#0000ff', // Blue
        0.5: '#00ff00', // Green
        0.7: '#ffff00', // Yellow
        0.9: '#ff0000', // Red
        1.0: '#ffffff' // White (high density)
    },
    /**
     * Cool blue (blue-cyan-white) - blue-to-white gradient
     */
    cool: {
        0.0: '#001f3f', // Navy
        0.3: '#0074D9', // Blue
        0.6: '#7FDBFF', // Aqua
        0.8: '#AAFFFF', // Light cyan
        1.0: '#FFFFFF' // White
    },
    /**
     * Grayscale - accessibility-friendly, print-safe
     */
    grayscale: {
        0.0: '#000000', // Black
        0.5: '#808080', // Gray
        1.0: '#FFFFFF' // White
    },
    /**
     * Viridis-inspired - perceptually uniform, colorblind-safe
     */
    viridis: {
        0.0: '#440154', // Dark purple
        0.25: '#31688e', // Blue
        0.5: '#35b779', // Green
        0.75: '#fde724', // Yellow
        1.0: '#FFFF00' // Bright yellow
    },
    /**
     * Strava orange - brand-aligned gradient
     */
    strava: {
        0.0: '#2C3E50', // Dark gray
        0.4: '#E67E22', // Orange
        0.7: '#fc4c02', // Strava orange
        1.0: '#FFAA00' // Bright orange
    }
};
/**
 * Default color scheme
 */
export const DEFAULT_SCHEME = 'strava';
//# sourceMappingURL=color-schemes.js.map