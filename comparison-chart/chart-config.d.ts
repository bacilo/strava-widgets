/**
 * Chart.js configuration for comparison chart widget
 * Uses tree-shaken imports for bar and line charts
 */
import { Chart } from 'chart.js';
import { YearOverYearMonth, SeasonalTrendMonth } from '../../types/analytics.types.js';
/**
 * Create year-over-year grouped bar chart
 * Shows monthly distance comparison across up to 3 most recent years
 */
export declare function createYearOverYearChart(canvas: HTMLCanvasElement, data: YearOverYearMonth[], config?: {
    theme?: 'light' | 'dark';
    chartColors?: string[];
    showLegend?: boolean;
    customTitle?: string;
}): Chart;
/**
 * Create seasonal trends line chart
 * Shows multi-year monthly distance trends with smooth curves
 */
export declare function createSeasonalTrendsChart(canvas: HTMLCanvasElement, data: SeasonalTrendMonth[], config?: {
    theme?: 'light' | 'dark';
    chartColors?: string[];
    showLegend?: boolean;
}): Chart;
//# sourceMappingURL=chart-config.d.ts.map