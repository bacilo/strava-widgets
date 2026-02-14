/**
 * Streak Widget
 * Displays daily streaks, weekly consistency, and time-of-day patterns
 */

import { WidgetBase } from '../shared/widget-base.js';
import { WidgetConfig } from '../../types/widget-config.types.js';
import { StreakData, TimeOfDayPattern } from '../../types/analytics.types.js';
import { createTimeOfDayRadarChart } from './chart-config.js';

// Streak widget specific styles
const STREAK_WIDGET_STYLES = `
.streak-widget {
  background: var(--widget-bg, #ffffff);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 24px;
}
.widget-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: var(--widget-text, #333);
}
.streak-section {
  margin-bottom: 24px;
}
.streak-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}
.streak-item {
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  background: rgba(252, 76, 2, 0.05);
}
.streak-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--widget-accent, #fc4c02);
  margin: 0;
}
.streak-label {
  font-size: 12px;
  text-transform: uppercase;
  color: #666;
  margin: 4px 0 0 0;
  letter-spacing: 0.5px;
}
.streak-detail {
  font-size: 11px;
  color: #888;
  margin: 4px 0 0 0;
}
.chart-section {
  border-top: 1px solid #eee;
  padding-top: 20px;
}
.chart-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: var(--widget-text, #333);
}
.chart-container {
  position: relative;
  max-width: 400px;
  margin: 0 auto;
}
canvas {
  display: block;
  width: 100% !important;
  height: auto !important;
}
`;

class StreakWidget extends WidgetBase<StreakData> {
  private timeOfDayData: TimeOfDayPattern[] | null = null;

  constructor(containerId: string, config: WidgetConfig) {
    super(containerId, config);
  }

  /**
   * Fetch both streak data and time-of-day data
   */
  private async fetchAllData(): Promise<void> {
    try {
      // Fetch streak data (primary)
      const streakData = await this.fetchData<StreakData>(this.config.dataUrl);

      // Fetch time-of-day data (secondary)
      if (this.config.options?.secondaryDataUrl) {
        try {
          this.timeOfDayData = await this.fetchData<TimeOfDayPattern[]>(
            this.config.options.secondaryDataUrl
          );
        } catch (error) {
          console.warn('StreakWidget: Could not fetch time-of-day data', error);
        }
      }

      // Clear loading message
      if (this.shadowRoot) {
        const loadingEl = this.shadowRoot.querySelector('.widget-loading');
        if (loadingEl) {
          loadingEl.remove();
        }
      }

      // Render widget with data
      this.render(streakData);
    } catch (error) {
      console.error('StreakWidget: Failed to load data', error);
      this.showError();
    }
  }

  /**
   * Render the streak widget
   */
  protected render(data: StreakData): void {
    if (!this.shadowRoot) return;

    // Inject widget-specific styles
    const styleElement = document.createElement('style');
    styleElement.textContent = STREAK_WIDGET_STYLES;
    this.shadowRoot.appendChild(styleElement);

    // Create widget container
    const widget = document.createElement('div');
    widget.className = 'streak-widget';

    // Add title if enabled
    if (this.config.options?.showTitle !== false) {
      const title = document.createElement('h2');
      title.className = 'widget-title';
      title.textContent = this.config.options?.customTitle || 'Streak & Patterns';
      widget.appendChild(title);
    }

    // Streak section
    const streakSection = document.createElement('div');
    streakSection.className = 'streak-section';

    const streakGrid = document.createElement('div');
    streakGrid.className = 'streak-grid';

    // Current streak
    const currentStreakValue = data.currentStreak > 0
      ? `${data.currentStreak} 🔥`
      : '—';
    const currentStreakDetail = data.withinCurrentStreak && data.currentStreakStart
      ? `Since ${this.formatDate(data.currentStreakStart)}`
      : '';
    streakGrid.appendChild(
      this.createStreakItem(currentStreakValue, 'Current Streak', currentStreakDetail)
    );

    // Longest streak
    const longestStreakDetail =
      data.longestStreakStart && data.longestStreakEnd
        ? `${this.formatDate(data.longestStreakStart)} - ${this.formatDate(data.longestStreakEnd)}`
        : '';
    streakGrid.appendChild(
      this.createStreakItem(
        `${data.longestStreak}`,
        'Longest Streak',
        longestStreakDetail
      )
    );

    // Weekly consistency (current)
    const consistencyValue = data.weeklyConsistency.currentStreak > 0
      ? `${data.weeklyConsistency.currentStreak}`
      : '—';
    streakGrid.appendChild(
      this.createStreakItem(
        consistencyValue,
        'Weekly Consistency',
        `${data.weeklyConsistency.minRunsPerWeek}+ runs/week`
      )
    );

    // Longest weekly consistency
    streakGrid.appendChild(
      this.createStreakItem(
        `${data.weeklyConsistency.longestStreak}`,
        'Longest Consistency',
        `${data.weeklyConsistency.totalConsistentWeeks} total weeks`
      )
    );

    streakSection.appendChild(streakGrid);
    widget.appendChild(streakSection);

    // Time-of-day radar chart section
    if (this.timeOfDayData && this.timeOfDayData.length > 0) {
      const chartSection = document.createElement('div');
      chartSection.className = 'chart-section';

      const chartTitle = document.createElement('h3');
      chartTitle.className = 'chart-title';
      chartTitle.textContent = 'Activity Patterns';
      chartSection.appendChild(chartTitle);

      const chartContainer = document.createElement('div');
      chartContainer.className = 'chart-container';

      const canvas = document.createElement('canvas');
      chartContainer.appendChild(canvas);
      chartSection.appendChild(chartContainer);

      widget.appendChild(chartSection);

      // Render chart after DOM is attached
      this.shadowRoot.appendChild(widget);

      // Create radar chart
      createTimeOfDayRadarChart(canvas, this.timeOfDayData, {
        accentColor: this.config.colors?.accent || '#fc4c02',
        fillOpacity: 0.2,
      });
    } else {
      // No chart data, just append widget
      this.shadowRoot.appendChild(widget);
    }
  }

  /**
   * Create a streak item element
   */
  private createStreakItem(
    value: string,
    label: string,
    detail: string = ''
  ): HTMLElement {
    const item = document.createElement('div');
    item.className = 'streak-item';

    const valueEl = document.createElement('p');
    valueEl.className = 'streak-value';
    valueEl.textContent = value;
    item.appendChild(valueEl);

    const labelEl = document.createElement('p');
    labelEl.className = 'streak-label';
    labelEl.textContent = label;
    item.appendChild(labelEl);

    if (detail) {
      const detailEl = document.createElement('p');
      detailEl.className = 'streak-detail';
      detailEl.textContent = detail;
      item.appendChild(detailEl);
    }

    return item;
  }

  /**
   * Format ISO date string to short format
   */
  private formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    return `${month} ${day}, ${year}`;
  }
}

/**
 * Global initialization function
 */
const StreakWidgetInit = {
  async init(containerId: string, config: WidgetConfig): Promise<void> {
    const widget = new StreakWidget(containerId, config);

    // Fetch and render data
    await (widget as any).fetchAllData();
  },
};

// Expose globally
(window as any).StreakWidget = StreakWidgetInit;
