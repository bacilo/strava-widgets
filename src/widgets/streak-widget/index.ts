/**
 * Streak Widget
 * Displays daily streaks, weekly consistency, and time-of-day patterns
 */

import { WidgetBase } from '../shared/widget-base.js';
import { StreakData, TimeOfDayPattern } from '../../types/analytics.types.js';
import { parseBoolean } from '../shared/attribute-parser.js';
import { ThemeManager } from '../shared/theme-manager.js';
import { ResponsiveManager } from '../shared/responsive-manager.js';
import { createTimeOfDayRadarChart } from './chart-config.js';

// Streak widget specific styles
const STREAK_WIDGET_STYLES = `
.streak-widget {
  background: var(--widget-bg, #ffffff);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 24px;
}

/* Dark mode adaptations */
:host([data-theme="dark"]) .streak-widget,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .streak-widget,
  :host(:not([data-theme])) .streak-widget {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }
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

/* Responsive: compact layout */
:host([data-size="compact"]) .streak-grid {
  grid-template-columns: 1fr;
  gap: 12px;
}

/* Responsive: medium layout */
:host([data-size="medium"]) .streak-grid {
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.streak-item {
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  background: rgba(252, 76, 2, 0.05);
}

/* Dark mode streak item background */
:host([data-theme="dark"]) .streak-item,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .streak-item,
  :host(:not([data-theme])) .streak-item {
    background: rgba(255, 107, 53, 0.1);
  }
}

.streak-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--widget-accent, #fc4c02);
  margin: 0;
}

/* Responsive: compact value size */
:host([data-size="compact"]) .streak-value {
  font-size: 24px;
}

.streak-label {
  font-size: 12px;
  text-transform: uppercase;
  color: #666;
  margin: 4px 0 0 0;
  letter-spacing: 0.5px;
}

/* Dark mode streak label */
:host([data-theme="dark"]) .streak-label,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .streak-label,
  :host(:not([data-theme])) .streak-label {
    color: #aaa;
  }
}

/* Responsive: compact label size */
:host([data-size="compact"]) .streak-label {
  font-size: 11px;
}

.streak-detail {
  font-size: 11px;
  color: #888;
  margin: 4px 0 0 0;
}

/* Dark mode streak detail */
:host([data-theme="dark"]) .streak-detail,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .streak-detail,
  :host(:not([data-theme])) .streak-detail {
    color: #999;
  }
}

/* Responsive: compact detail size */
:host([data-size="compact"]) .streak-detail {
  font-size: 10px;
}

.chart-section {
  border-top: 1px solid #eee;
  padding-top: 20px;
}

/* Dark mode chart section border */
:host([data-theme="dark"]) .chart-section,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .chart-section,
  :host(:not([data-theme])) .chart-section {
    border-top-color: #444;
  }
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

class StreakWidgetElement extends WidgetBase {
  /**
   * Observed attributes specific to this widget
   */
  static observedAttributes = [
    ...WidgetBase.observedAttributes,
    'data-url-secondary',
    'data-show-chart'
  ];

  private timeOfDayData: TimeOfDayPattern[] | null = null;

  /**
   * Default data URL for streak data
   */
  protected get dataUrl(): string {
    return '/data/stats/streaks.json';
  }

  /**
   * Fetch both streak data and time-of-day data
   */
  private async fetchAllDataAndRender(): Promise<void> {
    try {
      // Get primary URL from attribute or default
      const primaryUrl = this.getAttribute('data-url') || this.dataUrl;

      // Fetch streak data (primary)
      const streakData = await this.fetchData<StreakData>(primaryUrl);

      // Fetch time-of-day data (secondary)
      const secondaryUrl = this.getAttribute('data-url-secondary');
      if (secondaryUrl) {
        try {
          this.timeOfDayData = await this.fetchData<TimeOfDayPattern[]>(secondaryUrl);
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
   * Override connectedCallback to use custom fetch logic
   */
  connectedCallback(): void {
    // Inject base styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      :host {
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-sizing: border-box;
        color: var(--widget-text, #333333);
        background: var(--widget-bg, #ffffff);
        width: var(--widget-width, 100%);
        max-width: var(--widget-max-width, 800px);
        padding: var(--widget-padding, 20px);
        container-type: inline-size;
        container-name: widget;
      }
      *, *::before, *::after {
        box-sizing: inherit;
      }
      .widget-loading {
        padding: 24px;
        text-align: center;
        color: #666;
        font-size: 14px;
      }
      .widget-error {
        padding: 24px;
        text-align: center;
        color: #999;
        font-size: 14px;
      }
      :host([data-size="compact"]) {
        --widget-padding: 12px;
        font-size: 14px;
      }
      :host([data-size="medium"]) {
        --widget-padding: 16px;
        font-size: 15px;
      }
      :host([data-size="large"]) {
        --widget-padding: 20px;
        font-size: 16px;
      }
    `;
    this.shadowRoot!.appendChild(styleElement);

    // Initialize theme manager
    this.themeManager = new ThemeManager(this);
    this.themeManager.applyTheme(this.shadowRoot!);
    this.themeManager.listenForChanges(() => {
      this.fetchAllDataAndRender();
    });

    // Initialize responsive manager
    this.responsiveManager = new ResponsiveManager(this, (width, height) => {
      this.onResize(width, height);
    });
    this.responsiveManager.observe();

    // Apply style attributes from parent
    const width = this.getAttribute('data-width');
    if (width) {
      this.style.setProperty('--widget-width', width.includes('px') || width.includes('%') ? width : `${width}px`);
    }

    const maxWidth = this.getAttribute('data-max-width');
    if (maxWidth) {
      this.style.setProperty('--widget-max-width', maxWidth.includes('px') || maxWidth.includes('%') ? maxWidth : `${maxWidth}px`);
    }

    const padding = this.getAttribute('data-padding');
    if (padding) {
      this.style.setProperty('--widget-padding', padding.includes('px') ? padding : `${padding}px`);
    }

    const bg = this.getAttribute('data-bg');
    if (bg) {
      this.style.setProperty('--widget-bg', bg);
    }

    const textColor = this.getAttribute('data-text-color');
    if (textColor) {
      this.style.setProperty('--widget-text', textColor);
    }

    const accent = this.getAttribute('data-accent');
    if (accent) {
      this.style.setProperty('--widget-accent', accent);
    }

    // Show loading and fetch
    this.showLoading();
    this.fetchAllDataAndRender();
  }


  /**
   * Render the streak widget
   */
  protected render(data: StreakData): void {
    if (!this.shadowRoot) return;

    // Remove old widget content (keep styles)
    const oldWidget = this.shadowRoot.querySelector('.streak-widget');
    if (oldWidget) {
      oldWidget.remove();
    }

    // Inject widget-specific styles if not already present
    if (!this.shadowRoot.querySelector('style[data-widget-styles]')) {
      const styleElement = document.createElement('style');
      styleElement.setAttribute('data-widget-styles', 'true');
      styleElement.textContent = STREAK_WIDGET_STYLES;
      this.shadowRoot.appendChild(styleElement);
    }

    // Create widget container
    const widget = document.createElement('div');
    widget.className = 'streak-widget';

    // Get configuration from attributes
    const showTitle = parseBoolean(this, 'data-show-title', true);
    const customTitle = this.getAttribute('data-title');
    const showChart = parseBoolean(this, 'data-show-chart', true);
    const accentColor = this.getAttribute('data-accent') || '#fc4c02';

    // Add title if enabled
    if (showTitle) {
      const title = document.createElement('h2');
      title.className = 'widget-title';
      title.textContent = customTitle || 'Streak & Patterns';
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
    if (showChart && this.timeOfDayData && this.timeOfDayData.length > 0) {
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

      // Append widget first
      this.shadowRoot.appendChild(widget);

      // Get current theme for chart styling
      const theme = this.themeManager?.getEffectiveTheme() || 'light';

      // Create radar chart with theme-aware colors
      createTimeOfDayRadarChart(canvas, this.timeOfDayData, {
        accentColor,
        fillOpacity: 0.2,
        theme
      });
    } else {
      // No chart data or chart disabled, just append widget
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

// Register custom element
WidgetBase.register('strava-streak-widget', StreakWidgetElement);

/**
 * Backwards-compatible global initialization function
 */
const StreakWidgetInit = {
  async init(containerId: string, config: any): Promise<void> {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element #${containerId} not found`);
    }

    // Create custom element
    const widget = document.createElement('strava-streak-widget') as StreakWidgetElement;

    // Set attributes from config
    if (config.dataUrl) {
      widget.setAttribute('data-url', config.dataUrl);
    }
    if (config.options?.secondaryDataUrl) {
      widget.setAttribute('data-url-secondary', config.options.secondaryDataUrl);
    }
    if (config.options?.customTitle) {
      widget.setAttribute('data-title', config.options.customTitle);
    }
    if (config.options?.showTitle === false) {
      widget.setAttribute('data-show-title', 'false');
    }
    if (config.colors?.accent) {
      widget.setAttribute('data-accent', config.colors.accent);
    }
    if (config.size?.width) {
      widget.setAttribute('data-width', config.size.width);
    }
    if (config.size?.maxWidth) {
      widget.setAttribute('data-max-width', config.size.maxWidth);
    }

    // Append to container
    container.appendChild(widget);
  },
};

// Expose globally for backwards compatibility
(window as any).StreakWidget = StreakWidgetInit;
