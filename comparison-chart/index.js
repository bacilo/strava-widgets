/**
 * Comparison Chart Widget
 * Displays year-over-year grouped bar chart and seasonal trends line chart
 * Custom Element: <strava-comparison-chart data-url="...">
 */
import { WidgetBase } from '../shared/widget-base.js';
import { createYearOverYearChart, createSeasonalTrendsChart } from './chart-config.js';
import { parseJSON } from '../shared/attribute-parser.js';
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

/* Dark mode styles */
:host([data-theme="dark"]) .comparison-container {
  background: transparent;
}

/* Responsive breakpoints */
:host([data-size="compact"]) .comparison-container {
  gap: 20px;
}
:host([data-size="compact"]) .chart-section {
  height: 200px;
}

:host([data-size="medium"]) .chart-section {
  height: 300px;
}

:host([data-size="large"]) .chart-section {
  height: 400px;
}
`;
class ComparisonChartWidget extends WidgetBase {
    seasonalTrendsData = null;
    /**
     * Observed attributes specific to comparison-chart
     */
    static observedAttributes = [
        ...WidgetBase.observedAttributes,
        'data-chart-colors',
        'data-show-legend'
    ];
    /**
     * Default data URL for this widget type
     */
    get dataUrl() {
        return '/data/stats/year-over-year.json';
    }
    /**
     * Override connectedCallback to inject widget-specific styles
     */
    connectedCallback() {
        // Call parent first to set up Shadow DOM
        super.connectedCallback();
        // Inject widget-specific styles after base styles
        if (this.shadowRoot) {
            const styleElement = document.createElement('style');
            styleElement.textContent = COMPARISON_CHART_STYLES;
            this.shadowRoot.appendChild(styleElement);
        }
    }
    /**
     * Override fetchDataAndRender to handle dual data sources
     */
    async fetchDataAndRender() {
        try {
            const primaryUrl = this.getAttribute('data-url') || this.dataUrl;
            if (!primaryUrl) {
                throw new Error('No data URL provided');
            }
            // Fetch primary data (year-over-year)
            const yearOverYearData = await this.fetchData(primaryUrl);
            // Fetch secondary data (seasonal trends) if URL provided
            const secondaryUrl = this.getAttribute('data-url-secondary');
            if (secondaryUrl) {
                try {
                    this.seasonalTrendsData = await this.fetchData(secondaryUrl);
                }
                catch (error) {
                    console.warn('ComparisonChart: Could not fetch seasonal trends data', error);
                    this.seasonalTrendsData = null;
                }
            }
            else {
                this.seasonalTrendsData = null;
            }
            // Clear loading message
            if (this.shadowRoot) {
                const loadingEl = this.shadowRoot.querySelector('.widget-loading');
                if (loadingEl) {
                    loadingEl.remove();
                }
            }
            // Render widget with data
            this.render(yearOverYearData);
        }
        catch (error) {
            console.error('ComparisonChart: Failed to load data', error);
            this.showError();
        }
    }
    /**
     * Render the comparison charts
     */
    render(data) {
        const yearOverYearData = data;
        if (!this.shadowRoot)
            return;
        // Clear previous content except styles
        const styles = Array.from(this.shadowRoot.querySelectorAll('style'));
        this.shadowRoot.innerHTML = '';
        styles.forEach(style => this.shadowRoot.appendChild(style));
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
        let trendsCanvas = null;
        if (this.seasonalTrendsData) {
            const trendsSection = document.createElement('div');
            trendsSection.className = 'chart-section';
            trendsCanvas = document.createElement('canvas');
            trendsSection.appendChild(trendsCanvas);
            container.appendChild(trendsSection);
        }
        // Append to DOM BEFORE creating Chart.js instances (needs canvas dimensions)
        this.shadowRoot.appendChild(container);
        // Get configuration from attributes
        const theme = this.getAttribute('data-theme') || 'light';
        const chartColors = parseJSON(this.getAttribute('data-chart-colors'), ['#3b82f6', '#ef4444', '#22c55e']);
        const showLegend = this.getAttribute('data-show-legend') !== 'false'; // default true
        const customTitle = this.getAttribute('data-title') || undefined;
        // Render charts after DOM attachment
        createYearOverYearChart(yoyCanvas, yearOverYearData, {
            theme: theme,
            chartColors,
            showLegend,
            customTitle
        });
        if (this.seasonalTrendsData && trendsCanvas) {
            createSeasonalTrendsChart(trendsCanvas, this.seasonalTrendsData, {
                theme: theme,
                chartColors,
                showLegend
            });
        }
    }
}
// Register Custom Element
WidgetBase.register('strava-comparison-chart', ComparisonChartWidget);
/**
 * Backwards-compatible global initialization function
 * Creates Custom Element programmatically from config object
 */
const ComparisonChart = {
    async init(containerId, config) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`ComparisonChart: Container element "${containerId}" not found`);
            return;
        }
        // Create custom element
        const element = document.createElement('strava-comparison-chart');
        // Map config to attributes
        if (config.dataUrl) {
            element.setAttribute('data-url', config.dataUrl);
        }
        if (config.options?.secondaryDataUrl) {
            element.setAttribute('data-url-secondary', config.options.secondaryDataUrl);
        }
        if (config.options?.customTitle) {
            element.setAttribute('data-title', config.options.customTitle);
        }
        if (config.options?.showLegend === false) {
            element.setAttribute('data-show-legend', 'false');
        }
        if (config.colors?.chartColors) {
            element.setAttribute('data-chart-colors', JSON.stringify(config.colors.chartColors));
        }
        if (config.colors?.background) {
            element.setAttribute('data-bg', config.colors.background);
        }
        if (config.colors?.text) {
            element.setAttribute('data-text-color', config.colors.text);
        }
        if (config.colors?.accent) {
            element.setAttribute('data-accent', config.colors.accent);
        }
        if (config.size?.width) {
            element.setAttribute('data-width', config.size.width);
        }
        if (config.size?.maxWidth) {
            element.setAttribute('data-max-width', config.size.maxWidth);
        }
        // Append to container
        container.appendChild(element);
    }
};
// Expose globally
window.ComparisonChart = ComparisonChart;
//# sourceMappingURL=index.js.map