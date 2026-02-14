/**
 * Shared widget configuration interface
 * Provides standardized customization options for all embeddable widgets
 */

export interface WidgetConfig {
  dataUrl: string;                    // URL to primary JSON data file
  colors?: {
    background?: string;              // Default '#ffffff'
    text?: string;                    // Default '#333333'
    accent?: string;                  // Default '#fc4c02' (Strava orange)
    chartColors?: string[];           // For multi-dataset charts
  };
  size?: {
    width?: string;                   // CSS unit, default '100%'
    maxWidth?: string;                // CSS unit, default '800px'
    padding?: string;                 // CSS unit, default '20px'
  };
  dateRange?: {
    start?: string;                   // ISO date string filter
    end?: string;
  };
  options?: {
    showLegend?: boolean;             // Default true
    showTitle?: boolean;              // Default true
    customTitle?: string;
    secondaryDataUrl?: string;        // Optional secondary data source
    [key: string]: any;               // Allow widget-specific options
  };
}
