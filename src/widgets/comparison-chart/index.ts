/**
 * Comparison Chart Widget
 * Displays year-over-year grouped bar chart and seasonal trends line chart
 */

import { WidgetBase } from '../shared/widget-base.js';
import { WidgetConfig } from '../../types/widget-config.types.js';
import { YearOverYearMonth, SeasonalTrendMonth } from '../../types/analytics.types.js';
import { createYearOverYearChart, createSeasonalTrendsChart } from './chart-config.js';

// Comparison chart specific styles
const COMPARISON_CHART_STYLES = `
.comparison-container {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.chart-section {
  position: relative;
  width: 100%;
}
.chart-section canvas {
  min-width: 0;
  max-width: 100%;
}
`;

interface ComparisonChartData {
  yearOverYear: YearOverYearMonth[];
  seasonalTrends: SeasonalTrendMonth[];
}

class ComparisonChartWidget extends WidgetBase<YearOverYearMonth[]> {
  private seasonalTrendsData: SeasonalTrendMonth[] | null = null;

  constructor(containerId: string, config: WidgetConfig) {
    super(containerId, config, true);
  }

  /**
   * Render the comparison charts
   */
  protected render(yearOverYearData: YearOverYearMonth[]): void {
    if (!this.shadowRoot) return;

    // Inject chart-specific styles
    const styleElement = document.createElement('style');
    styleElement.textContent = COMPARISON_CHART_STYLES;
    this.shadowRoot.appendChild(styleElement);

    // Create container for both charts
    const container = document.createElement('div');
    container.className = 'comparison-container';

    // Year-over-year bar chart section
    const yoySection = document.createElement('div');
    yoySection.className = 'chart-section';
    const yoyCanvas = document.createElement('canvas');
    yoySection.appendChild(yoyCanvas);
    container.appendChild(yoySection);

    // Seasonal trends line chart section (if data available)
    let trendsCanvas: HTMLCanvasElement | null = null;
    if (this.seasonalTrendsData) {
      const trendsSection = document.createElement('div');
      trendsSection.className = 'chart-section';
      trendsCanvas = document.createElement('canvas');
      trendsSection.appendChild(trendsCanvas);
      container.appendChild(trendsSection);
    }

    // Append to DOM BEFORE creating Chart.js instances (needs canvas dimensions)
    this.shadowRoot.appendChild(container);

    // Render charts after DOM attachment
    createYearOverYearChart(yoyCanvas, yearOverYearData, {
      chartColors: this.config.colors?.chartColors,
      showLegend: this.config.options?.showLegend,
      customTitle: this.config.options?.customTitle
    });

    if (this.seasonalTrendsData && trendsCanvas) {
      createSeasonalTrendsChart(trendsCanvas, this.seasonalTrendsData, {
        chartColors: this.config.colors?.chartColors,
        showLegend: this.config.options?.showLegend
      });
    }
  }
}

/**
 * Global initialization function
 */
const ComparisonChart = {
  async init(containerId: string, config: WidgetConfig): Promise<void> {
    // Create widget instance
    const widget = new ComparisonChartWidget(containerId, config);

    try {
      // Fetch year-over-year data (primary)
      const yoyData = await widget['fetchData']<YearOverYearMonth[]>(config.dataUrl);

      // Try to fetch seasonal trends data if secondary URL provided
      if (config.options?.secondaryDataUrl) {
        try {
          const trendsData = await widget['fetchData']<SeasonalTrendMonth[]>(
            config.options.secondaryDataUrl
          );
          widget['seasonalTrendsData'] = trendsData;
        } catch (error) {
          console.warn('ComparisonChart: Could not fetch seasonal trends data', error);
        }
      }

      // Clear loading and render
      if (widget['shadowRoot']) {
        const loadingEl = widget['shadowRoot'].querySelector('.widget-loading');
        if (loadingEl) {
          loadingEl.remove();
        }
      }

      widget['render'](yoyData);
    } catch (error) {
      console.error('ComparisonChart: Failed to load data', error);
      widget['showError']();
    }
  }
};

// Expose globally
(window as any).ComparisonChart = ComparisonChart;
