/**
 * Embeddable weekly bar chart widget
 * Renders inside Shadow DOM for style isolation
 */

import { createWeeklyBarChart } from './chart-config.js';
import { WeeklyStats } from '../types/analytics.types.js';

// Inline CSS for Shadow DOM (avoids CSS extraction issues with Vite IIFE builds)
const WIDGET_STYLES = `
:host {
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #333;
}
.chart-container {
  position: relative;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}
.chart-container canvas {
  min-width: 0; /* Prevent flexbox overflow */
}
.widget-error {
  padding: 16px;
  text-align: center;
  color: #999;
  font-size: 14px;
}
.widget-loading {
  padding: 16px;
  text-align: center;
  color: #666;
  font-size: 14px;
}
`;

/**
 * Weekly Bar Chart Widget class
 */
class WeeklyBarChartWidget {
  private containerId: string;
  private dataUrl: string;
  private shadowRoot: ShadowRoot | null = null;

  constructor(containerId: string, dataUrl: string) {
    this.containerId = containerId;
    this.dataUrl = dataUrl;
    this.render();
  }

  private render(): void {
    // Find container element
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`WeeklyBarChartWidget: Container element with id '${this.containerId}' not found`);
      return;
    }

    // Attach Shadow DOM for style isolation
    this.shadowRoot = container.attachShadow({ mode: 'open' });

    // Inject styles
    const styleElement = document.createElement('style');
    styleElement.textContent = WIDGET_STYLES;
    this.shadowRoot.appendChild(styleElement);

    // Create chart container
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    this.shadowRoot.appendChild(chartContainer);

    // Show loading message
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'widget-loading';
    loadingMessage.textContent = 'Loading chart data...';
    chartContainer.appendChild(loadingMessage);

    // Fetch data and render chart
    this.fetchDataAndRender(chartContainer, loadingMessage);
  }

  private async fetchDataAndRender(
    chartContainer: HTMLElement,
    loadingMessage: HTMLElement
  ): Promise<void> {
    try {
      const response = await fetch(this.dataUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }

      const data: WeeklyStats[] = await response.json();

      // Remove loading message
      loadingMessage.remove();

      // Create canvas element
      const canvas = document.createElement('canvas');
      chartContainer.appendChild(canvas);

      // Render chart
      createWeeklyBarChart(canvas, data);
    } catch (error) {
      console.error('WeeklyBarChartWidget: Failed to load chart data', error);

      // Show error message (fail silently for embeddable widgets)
      loadingMessage.remove();
      const errorMessage = document.createElement('div');
      errorMessage.className = 'widget-error';
      errorMessage.textContent = 'Chart unavailable';
      chartContainer.appendChild(errorMessage);
    }
  }
}

// Expose global initialization function for IIFE usage
const WeeklyBarChart = {
  init(containerId: string, dataUrl: string) {
    return new WeeklyBarChartWidget(containerId, dataUrl);
  }
};

// Make available globally
(window as any).WeeklyBarChart = WeeklyBarChart;
