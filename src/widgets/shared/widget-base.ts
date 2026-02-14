/**
 * Abstract base class for embeddable widgets
 * Provides Shadow DOM setup, loading/error states, and data fetching
 */

import { WidgetConfig } from '../../types/widget-config.types.js';

// Base styles injected into all widgets
const BASE_WIDGET_STYLES = `
:host {
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-sizing: border-box;
  color: var(--widget-text, #333333);
  background: var(--widget-bg, #ffffff);
  width: var(--widget-width, 100%);
  max-width: var(--widget-max-width, 800px);
  padding: var(--widget-padding, 20px);
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
`;

/**
 * Abstract widget base class
 * Subclasses must implement render(data) method
 */
export abstract class WidgetBase<T = unknown> {
  protected containerId: string;
  protected config: WidgetConfig;
  protected shadowRoot: ShadowRoot | null = null;
  protected container: HTMLElement | null = null;

  constructor(containerId: string, config: WidgetConfig) {
    this.containerId = containerId;
    this.config = config;
    this.init();
  }

  /**
   * Initialize the widget: create Shadow DOM, fetch data, render
   */
  private init(): void {
    // Find container element
    const containerElement = document.getElementById(this.containerId);
    if (!containerElement) {
      console.error(`Widget: Container element with id '${this.containerId}' not found`);
      return;
    }
    this.container = containerElement;

    // Create Shadow DOM
    this.createShadowRoot();

    // Show loading state
    this.showLoading();

    // Fetch data and render
    this.fetchDataAndRender();
  }

  /**
   * Create Shadow DOM and inject base styles with custom properties
   */
  protected createShadowRoot(): void {
    if (!this.container) return;

    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    // Inject base styles
    const styleElement = document.createElement('style');
    styleElement.textContent = BASE_WIDGET_STYLES;
    this.shadowRoot.appendChild(styleElement);

    // Apply CSS custom properties from config
    if (this.shadowRoot.host instanceof HTMLElement) {
      const host = this.shadowRoot.host as HTMLElement;

      // Color config
      if (this.config.colors?.background) {
        host.style.setProperty('--widget-bg', this.config.colors.background);
      }
      if (this.config.colors?.text) {
        host.style.setProperty('--widget-text', this.config.colors.text);
      }
      if (this.config.colors?.accent) {
        host.style.setProperty('--widget-accent', this.config.colors.accent);
      }

      // Size config
      if (this.config.size?.width) {
        host.style.setProperty('--widget-width', this.config.size.width);
      }
      if (this.config.size?.maxWidth) {
        host.style.setProperty('--widget-max-width', this.config.size.maxWidth);
      }
      if (this.config.size?.padding) {
        host.style.setProperty('--widget-padding', this.config.size.padding);
      }
    }
  }

  /**
   * Show loading message
   */
  protected showLoading(): void {
    if (!this.shadowRoot) return;

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'widget-loading';
    loadingDiv.textContent = 'Loading...';
    this.shadowRoot.appendChild(loadingDiv);
  }

  /**
   * Show error message (fail silently for embeddable widgets)
   */
  protected showError(message: string = 'Widget unavailable'): void {
    if (!this.shadowRoot) return;

    // Clear existing content
    while (this.shadowRoot.firstChild) {
      this.shadowRoot.removeChild(this.shadowRoot.firstChild);
    }

    // Re-inject styles
    const styleElement = document.createElement('style');
    styleElement.textContent = BASE_WIDGET_STYLES;
    this.shadowRoot.appendChild(styleElement);

    // Show error
    const errorDiv = document.createElement('div');
    errorDiv.className = 'widget-error';
    errorDiv.textContent = message;
    this.shadowRoot.appendChild(errorDiv);
  }

  /**
   * Fetch JSON data from URL
   */
  protected async fetchData<D = T>(url: string): Promise<D> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Fetch data and render widget
   */
  private async fetchDataAndRender(): Promise<void> {
    try {
      const data = await this.fetchData<T>(this.config.dataUrl);

      // Clear loading message
      if (this.shadowRoot) {
        const loadingEl = this.shadowRoot.querySelector('.widget-loading');
        if (loadingEl) {
          loadingEl.remove();
        }
      }

      // Render widget with data
      this.render(data);
    } catch (error) {
      console.error('Widget: Failed to load data', error);
      this.showError();
    }
  }

  /**
   * Abstract render method - subclasses must implement
   */
  protected abstract render(data: T): void;
}
