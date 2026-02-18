/**
 * Chart.js configuration for radar charts in streak widget
 * Tree-shaken imports for minimal bundle size
 */
import { Chart } from 'chart.js';
import type { TimeOfDayPattern } from '../../types/analytics.types.js';
export interface RadarChartConfig {
    accentColor?: string;
    fillOpacity?: number;
    theme?: 'light' | 'dark';
}
/**
 * Create a time-of-day radar chart
 * Displays 4 data points (morning, afternoon, evening, night)
 */
export declare function createTimeOfDayRadarChart(canvas: HTMLCanvasElement, data: TimeOfDayPattern[], config?: RadarChartConfig): Chart;
//# sourceMappingURL=chart-config.d.ts.map