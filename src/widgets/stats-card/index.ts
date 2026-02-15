/**
 * Stats Card Widget
 * Displays all-time totals with year-over-year comparison
 * Custom Element: <strava-stats-card data-url="...">
 */

import { WidgetBase } from '../shared/widget-base.js';
import { WidgetConfig } from '../../types/widget-config.types.js';
import { AllTimeTotals, YearOverYearMonth } from '../../types/analytics.types.js';

// Stats card specific styles
const STATS_CARD_STYLES = `
.stats-card {
  background: var(--widget-bg, #ffffff);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 24px;
}
.card-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: var(--widget-text, #333);
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}
.stat-item {
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  background: rgba(252, 76, 2, 0.05);
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--widget-accent, #fc4c02);
  margin: 0;
}
.stat-label {
  font-size: 12px;
  text-transform: uppercase;
  color: #666;
  margin: 4px 0 0 0;
  letter-spacing: 0.5px;
}
.yoy-comparison {
  border-top: 1px solid #eee;
  padding-top: 16px;
  margin-top: 16px;
}
.yoy-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #666;
}
.yoy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}
.yoy-item {
  text-align: center;
  padding: 8px;
  border-radius: 6px;
  background: #f8f8f8;
}
.yoy-year {
  font-size: 11px;
  color: #888;
  margin: 0 0 4px 0;
}
.yoy-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--widget-text, #333);
  margin: 0;
}
.yoy-delta {
  font-size: 11px;
  margin: 4px 0 0 0;
}
.yoy-delta.positive {
  color: #22c55e;
}
.yoy-delta.negative {
  color: #ef4444;
}

/* Dark mode styles */
:host([data-theme="dark"]) .stats-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
:host([data-theme="dark"]) .stat-item {
  background: rgba(255, 107, 53, 0.1);
}
:host([data-theme="dark"]) .yoy-item {
  background: #2a2a2a;
}
:host([data-theme="dark"]) .yoy-comparison {
  border-top-color: #333;
}
:host([data-theme="dark"]) .stat-label,
:host([data-theme="dark"]) .yoy-title {
  color: #999;
}
:host([data-theme="dark"]) .yoy-year {
  color: #777;
}

/* Responsive breakpoints */
:host([data-size="compact"]) .stats-grid {
  grid-template-columns: 1fr;
  gap: 12px;
}
:host([data-size="compact"]) .stat-value {
  font-size: 24px;
}
:host([data-size="compact"]) .card-title {
  font-size: 18px;
}

:host([data-size="medium"]) .stats-grid {
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}
`;

interface StatsCardData {
  allTime: AllTimeTotals;
  yearOverYear?: YearOverYearMonth[];
}

class StatsCardWidget extends WidgetBase {
  private yearOverYearData: YearOverYearMonth[] | null = null;

  /**
   * Observed attributes specific to stats-card
   */
  static observedAttributes = [
    ...WidgetBase.observedAttributes,
    'data-show-yoy'
  ];

  /**
   * Default data URL for this widget type
   */
  protected get dataUrl(): string {
    return '/data/stats/all-time-totals.json';
  }

  /**
   * Override connectedCallback to inject widget-specific styles
   */
  connectedCallback(): void {
    // Call parent first to set up Shadow DOM
    super.connectedCallback();

    // Inject widget-specific styles after base styles
    if (this.shadowRoot) {
      const styleElement = document.createElement('style');
      styleElement.textContent = STATS_CARD_STYLES;
      this.shadowRoot.appendChild(styleElement);
    }
  }

  /**
   * Override fetchDataAndRender to handle dual data sources
   */
  protected async fetchDataAndRender(): Promise<void> {
    try {
      const primaryUrl = this.getAttribute('data-url') || this.dataUrl;
      if (!primaryUrl) {
        throw new Error('No data URL provided');
      }

      // Fetch primary data (all-time totals)
      const allTimeData = await this.fetchData<AllTimeTotals>(primaryUrl);

      // Fetch secondary data (year-over-year) if URL provided and enabled
      const secondaryUrl = this.getAttribute('data-url-secondary');
      const showYoY = this.getAttribute('data-show-yoy') !== 'false'; // default true

      if (secondaryUrl && showYoY) {
        try {
          this.yearOverYearData = await this.fetchData<YearOverYearMonth[]>(secondaryUrl);
        } catch (error) {
          console.warn('StatsCard: Could not fetch year-over-year data', error);
          this.yearOverYearData = null;
        }
      } else {
        this.yearOverYearData = null;
      }

      // Clear loading message
      if (this.shadowRoot) {
        const loadingEl = this.shadowRoot.querySelector('.widget-loading');
        if (loadingEl) {
          loadingEl.remove();
        }
      }

      // Render widget with data
      this.render(allTimeData);
    } catch (error) {
      console.error('StatsCard: Failed to load data', error);
      this.showError();
    }
  }

  /**
   * Render the stats card
   */
  protected render(data: unknown): void {
    const allTimeData = data as AllTimeTotals;
    if (!this.shadowRoot) return;

    // Clear previous content except styles
    const styles = Array.from(this.shadowRoot.querySelectorAll('style'));
    this.shadowRoot.innerHTML = '';
    styles.forEach(style => this.shadowRoot!.appendChild(style));

    // Create card container
    const card = document.createElement('div');
    card.className = 'stats-card';

    // Add title if enabled
    const showTitle = this.getAttribute('data-show-title') !== 'false'; // default true
    if (showTitle) {
      const title = document.createElement('h2');
      title.className = 'card-title';
      title.textContent = this.getAttribute('data-title') || 'Running Stats';
      card.appendChild(title);
    }

    // Create stats grid
    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';

    // Total distance
    const distanceItem = this.createStatItem(
      this.formatNumber(allTimeData.totalKm, 0),
      'Total KM'
    );
    statsGrid.appendChild(distanceItem);

    // Total runs
    const runsItem = this.createStatItem(
      this.formatNumber(allTimeData.totalRuns, 0),
      'Total Runs'
    );
    statsGrid.appendChild(runsItem);

    // Total hours
    const hoursItem = this.createStatItem(
      this.formatNumber(allTimeData.totalHours, 0),
      'Total Hours'
    );
    statsGrid.appendChild(hoursItem);

    // Average pace
    const paceItem = this.createStatItem(
      this.formatPace(allTimeData.avgPaceMinPerKm),
      'Avg Pace'
    );
    statsGrid.appendChild(paceItem);

    card.appendChild(statsGrid);

    // Add year-over-year comparison if data available
    if (this.yearOverYearData) {
      const yoySection = this.createYearOverYearSection(this.yearOverYearData);
      card.appendChild(yoySection);
    }

    this.shadowRoot.appendChild(card);
  }

  /**
   * Create a stat item element
   */
  private createStatItem(value: string, label: string): HTMLElement {
    const item = document.createElement('div');
    item.className = 'stat-item';

    const valueEl = document.createElement('p');
    valueEl.className = 'stat-value';
    valueEl.textContent = value;
    item.appendChild(valueEl);

    const labelEl = document.createElement('p');
    labelEl.className = 'stat-label';
    labelEl.textContent = label;
    item.appendChild(labelEl);

    return item;
  }

  /**
   * Create year-over-year comparison section
   */
  private createYearOverYearSection(yoyData: YearOverYearMonth[]): HTMLElement {
    const section = document.createElement('div');
    section.className = 'yoy-comparison';

    const title = document.createElement('h3');
    title.className = 'yoy-title';
    title.textContent = 'Year-to-Date Comparison';
    section.appendChild(title);

    // Get current year and previous year totals
    const currentYear = new Date().getFullYear().toString();
    const previousYear = (new Date().getFullYear() - 1).toString();

    let currentYearTotal = 0;
    let previousYearTotal = 0;

    // Sum up totals from year-over-year data
    yoyData.forEach(month => {
      if (month.years[currentYear]) {
        currentYearTotal += month.years[currentYear].totalKm;
      }
      if (month.years[previousYear]) {
        previousYearTotal += month.years[previousYear].totalKm;
      }
    });

    // Calculate delta
    const delta = previousYearTotal > 0
      ? ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100
      : 0;

    const grid = document.createElement('div');
    grid.className = 'yoy-grid';

    // Previous year
    const prevItem = this.createYoyItem(
      previousYear,
      this.formatNumber(previousYearTotal, 0) + ' km',
      null
    );
    grid.appendChild(prevItem);

    // Current year
    const currItem = this.createYoyItem(
      currentYear,
      this.formatNumber(currentYearTotal, 0) + ' km',
      delta
    );
    grid.appendChild(currItem);

    section.appendChild(grid);

    return section;
  }

  /**
   * Create a year-over-year item
   */
  private createYoyItem(year: string, value: string, delta: number | null): HTMLElement {
    const item = document.createElement('div');
    item.className = 'yoy-item';

    const yearEl = document.createElement('p');
    yearEl.className = 'yoy-year';
    yearEl.textContent = year;
    item.appendChild(yearEl);

    const valueEl = document.createElement('p');
    valueEl.className = 'yoy-value';
    valueEl.textContent = value;
    item.appendChild(valueEl);

    if (delta !== null) {
      const deltaEl = document.createElement('p');
      deltaEl.className = `yoy-delta ${delta >= 0 ? 'positive' : 'negative'}`;
      const sign = delta >= 0 ? '+' : '';
      deltaEl.textContent = `${sign}${delta.toFixed(1)}%`;
      item.appendChild(deltaEl);
    }

    return item;
  }

  /**
   * Format number with commas and optional decimals
   */
  private formatNumber(value: number, decimals: number = 1): string {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Format pace as min:sec per km
   */
  private formatPace(paceMinPerKm: number): string {
    const minutes = Math.floor(paceMinPerKm);
    const seconds = Math.round((paceMinPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

// Register Custom Element
WidgetBase.register('strava-stats-card', StatsCardWidget);

/**
 * Backwards-compatible global initialization function
 * Creates Custom Element programmatically from config object
 */
const StatsCard = {
  async init(containerId: string, config: WidgetConfig): Promise<void> {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`StatsCard: Container element "${containerId}" not found`);
      return;
    }

    // Create custom element
    const element = document.createElement('strava-stats-card') as StatsCardWidget;

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
    if (config.options?.showTitle === false) {
      element.setAttribute('data-show-title', 'false');
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
(window as any).StatsCard = StatsCard;
