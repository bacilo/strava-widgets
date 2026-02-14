/**
 * Stats Card Widget
 * Displays all-time totals with year-over-year comparison
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
`;

interface StatsCardData {
  allTime: AllTimeTotals;
  yearOverYear?: YearOverYearMonth[];
}

class StatsCardWidget extends WidgetBase<AllTimeTotals> {
  private yearOverYearData: YearOverYearMonth[] | null = null;

  constructor(containerId: string, config: WidgetConfig) {
    super(containerId, config);
  }

  /**
   * Override fetchDataAndRender to fetch both data sources
   */
  protected async fetchData<D = AllTimeTotals>(url: string): Promise<D> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Override init to fetch year-over-year data if provided
   */
  private async fetchAllData(): Promise<StatsCardData> {
    const allTime = await super.fetchData<AllTimeTotals>(this.config.dataUrl);

    // Try to fetch year-over-year data if secondary URL provided
    if (this.config.options?.secondaryDataUrl) {
      try {
        this.yearOverYearData = await super.fetchData<YearOverYearMonth[]>(
          this.config.options.secondaryDataUrl
        );
      } catch (error) {
        console.warn('StatsCard: Could not fetch year-over-year data', error);
      }
    }

    return { allTime, yearOverYear: this.yearOverYearData || undefined };
  }

  /**
   * Render the stats card
   */
  protected render(data: AllTimeTotals): void {
    if (!this.shadowRoot) return;

    // Inject card-specific styles
    const styleElement = document.createElement('style');
    styleElement.textContent = STATS_CARD_STYLES;
    this.shadowRoot.appendChild(styleElement);

    // Create card container
    const card = document.createElement('div');
    card.className = 'stats-card';

    // Add title if enabled
    if (this.config.options?.showTitle !== false) {
      const title = document.createElement('h2');
      title.className = 'card-title';
      title.textContent = this.config.options?.customTitle || 'Running Stats';
      card.appendChild(title);
    }

    // Create stats grid
    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';

    // Total distance
    const distanceItem = this.createStatItem(
      this.formatNumber(data.totalKm, 0),
      'Total KM'
    );
    statsGrid.appendChild(distanceItem);

    // Total runs
    const runsItem = this.createStatItem(
      this.formatNumber(data.totalRuns, 0),
      'Total Runs'
    );
    statsGrid.appendChild(runsItem);

    // Total hours
    const hoursItem = this.createStatItem(
      this.formatNumber(data.totalHours, 0),
      'Total Hours'
    );
    statsGrid.appendChild(hoursItem);

    // Average pace
    const paceItem = this.createStatItem(
      this.formatPace(data.avgPaceMinPerKm),
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

/**
 * Global initialization function
 */
const StatsCard = {
  async init(containerId: string, config: WidgetConfig): Promise<void> {
    // Create widget instance
    const widget = new StatsCardWidget(containerId, config);

    // Fetch all data (all-time + year-over-year if available)
    try {
      const allTime = await widget['fetchData']<AllTimeTotals>(config.dataUrl);

      // Try to fetch year-over-year data if secondary URL provided
      if (config.options?.secondaryDataUrl) {
        try {
          const yoyData = await widget['fetchData']<YearOverYearMonth[]>(
            config.options.secondaryDataUrl
          );
          widget['yearOverYearData'] = yoyData;
        } catch (error) {
          console.warn('StatsCard: Could not fetch year-over-year data', error);
        }
      }

      // Clear loading and render
      if (widget['shadowRoot']) {
        const loadingEl = widget['shadowRoot'].querySelector('.widget-loading');
        if (loadingEl) {
          loadingEl.remove();
        }
      }

      widget['render'](allTime);
    } catch (error) {
      console.error('StatsCard: Failed to load data', error);
      widget['showError']();
    }
  }
};

// Expose globally
(window as any).StatsCard = StatsCard;
