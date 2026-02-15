/**
 * Abstract base class for embeddable widgets (Custom Element)
 * Extends HTMLElement with attribute-driven configuration, Shadow DOM, theming, and responsive behavior
 */

import { WidgetConfig } from '../../types/widget-config.types.js';
import { parseBoolean, parseNumber, parseJSON, parseColor, parseEnum, parseCSSValue } from './attribute-parser.js';
import { ThemeManager } from './theme-manager.js';
import { ResponsiveManager } from './responsive-manager.js';

// Base styles injected into all widgets (with theme and responsive support)
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

  /* Enable container queries for CSS-only responsive design */
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

/* Responsive breakpoint styles via data-size attribute */
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

/**
 * Abstract widget base class extending HTMLElement
 * All widgets must extend this and implement render() and dataUrl getter
 */
export abstract class WidgetBase extends HTMLElement {
  /**
   * Observed attributes common to all widgets
   * Subclasses can add their own by overriding this static property
   */
  static observedAttributes = [
    'data-url',
    'data-url-secondary',
    'data-title',
    'data-show-title',
    'data-theme',
    'data-width',
    'data-max-width',
    'data-padding',
    'data-bg',
    'data-text-color',
    'data-accent'
  ];

  protected themeManager: ThemeManager | null = null;
  protected responsiveManager: ResponsiveManager | null = null;

  /**
   * Constructor - attach Shadow DOM
   * DO NOT read attributes here (not available until connectedCallback)
   */
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /**
   * Called when element is inserted into the DOM
   * Read attributes, initialize managers, fetch data
   */
  connectedCallback(): void {
    // Inject base styles
    const styleElement = document.createElement('style');
    styleElement.textContent = BASE_WIDGET_STYLES;
    this.shadowRoot!.appendChild(styleElement);

    // Initialize theme manager and apply theme
    this.themeManager = new ThemeManager(this);
    this.themeManager.applyTheme(this.shadowRoot!);
    this.themeManager.listenForChanges(() => {
      // Re-render when system theme changes (if theme is 'auto')
      this.fetchDataAndRender();
    });

    // Initialize responsive manager
    this.responsiveManager = new ResponsiveManager(this, (width, height) => {
      // Callback for custom responsive logic (subclasses can override)
      this.onResize(width, height);
    });
    this.responsiveManager.observe();

    // Apply CSS custom properties from attributes
    this.applyStyleAttributes();

    // Show loading and fetch data
    this.showLoading();
    this.fetchDataAndRender();
  }

  /**
   * Called when observed attributes change
   * @param name Attribute name
   * @param oldValue Previous value
   * @param newValue New value
   */
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    // Skip if value unchanged or element not yet connected
    if (oldValue === newValue || !this.isConnected) return;

    // If theme attribute changed, apply new theme
    if (name === 'data-theme') {
      this.applyStyleAttributes();
      this.fetchDataAndRender();
      return;
    }

    // For style attributes, update CSS custom properties
    if (this.isStyleAttribute(name)) {
      this.applyStyleAttributes();
      return;
    }

    // For data attributes, trigger re-fetch and re-render
    this.fetchDataAndRender();
  }

  /**
   * Called when element is removed from the DOM
   * Clean up managers and listeners
   */
  disconnectedCallback(): void {
    this.themeManager?.destroy();
    this.responsiveManager?.disconnect();
  }

  /**
   * Check if attribute is a style-related attribute (doesn't require data re-fetch)
   */
  private isStyleAttribute(name: string): boolean {
    const styleAttrs = ['data-width', 'data-max-width', 'data-padding', 'data-bg', 'data-text-color', 'data-accent'];
    return styleAttrs.includes(name);
  }

  /**
   * Apply CSS custom properties from attributes
   */
  private applyStyleAttributes(): void {
    // Size attributes
    const width = this.getAttribute('data-width');
    if (width) {
      this.style.setProperty('--widget-width', parseCSSValue(width, '100%'));
    }

    const maxWidth = this.getAttribute('data-max-width');
    if (maxWidth) {
      this.style.setProperty('--widget-max-width', parseCSSValue(maxWidth, '800px'));
    }

    const padding = this.getAttribute('data-padding');
    if (padding) {
      this.style.setProperty('--widget-padding', parseCSSValue(padding, '20px'));
    }

    // Color attributes (override theme if provided)
    const bg = this.getAttribute('data-bg');
    if (bg) {
      this.style.setProperty('--widget-bg', parseColor(bg, '#ffffff'));
    }

    const textColor = this.getAttribute('data-text-color');
    if (textColor) {
      this.style.setProperty('--widget-text', parseColor(textColor, '#333333'));
    }

    const accent = this.getAttribute('data-accent');
    if (accent) {
      this.style.setProperty('--widget-accent', parseColor(accent, '#fc4c02'));
    }
  }

  /**
   * Get configuration object from attributes (backwards compatibility)
   * Subclasses can use this to get a WidgetConfig-compatible object
   */
  protected getConfig(): WidgetConfig {
    const dataUrl = this.getAttribute('data-url') || this.dataUrl;

    return {
      dataUrl,
      colors: {
        background: this.getAttribute('data-bg') || undefined,
        text: this.getAttribute('data-text-color') || undefined,
        accent: this.getAttribute('data-accent') || undefined
      },
      size: {
        width: this.getAttribute('data-width') || undefined,
        maxWidth: this.getAttribute('data-max-width') || undefined,
        padding: this.getAttribute('data-padding') || undefined
      },
      options: {
        showTitle: parseBoolean(this, 'data-show-title', true),
        customTitle: this.getAttribute('data-title') || undefined,
        secondaryDataUrl: this.getAttribute('data-url-secondary') || undefined
      }
    };
  }

  /**
   * Show loading message
   */
  protected showLoading(): void {
    if (!this.shadowRoot) return;

    // Remove existing loading/error messages
    const existing = this.shadowRoot.querySelector('.widget-loading, .widget-error');
    if (existing) {
      existing.remove();
    }

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

    // Clear existing content except styles
    const styles = Array.from(this.shadowRoot.querySelectorAll('style'));
    this.shadowRoot.innerHTML = '';
    styles.forEach(style => this.shadowRoot!.appendChild(style));

    // Show error
    const errorDiv = document.createElement('div');
    errorDiv.className = 'widget-error';
    errorDiv.textContent = message;
    this.shadowRoot.appendChild(errorDiv);
  }

  /**
   * Fetch JSON data from URL
   */
  protected async fetchData<T = unknown>(url: string): Promise<T> {
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
      const url = this.getAttribute('data-url') || this.dataUrl;
      if (!url) {
        throw new Error('No data URL provided');
      }

      const data = await this.fetchData(url);

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
   * Hook for responsive behavior (override in subclasses if needed)
   * @param width Container width in pixels
   * @param height Container height in pixels
   */
  protected onResize(width: number, height: number): void {
    // Default: no-op, subclasses can override
  }

  /**
   * Abstract methods - subclasses must implement
   */

  /**
   * Render widget with fetched data
   * @param data The fetched data (type varies by widget)
   */
  protected abstract render(data: unknown): void;

  /**
   * Get the default data URL for this widget type
   * Used as fallback when data-url attribute is not provided
   */
  protected abstract get dataUrl(): string;

  /**
   * Static helper to register custom element
   * Checks for duplicate registration to prevent errors
   * @param tagName Custom element tag name (must contain hyphen)
   * @param ElementClass Widget class extending WidgetBase
   */
  static register(tagName: string, ElementClass: CustomElementConstructor): void {
    if (!customElements.get(tagName)) {
      customElements.define(tagName, ElementClass);
    } else {
      console.warn(`Custom element "${tagName}" already registered, skipping`);
    }
  }
}
