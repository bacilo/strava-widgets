/**
 * Theme manager for dark/light mode detection and application
 * Handles system preference detection via prefers-color-scheme and manual overrides
 */

type Theme = 'light' | 'dark';
type ThemeMode = Theme | 'auto';

/**
 * Manages theme detection and application for a widget
 */
export class ThemeManager {
  private host: HTMLElement;
  private mediaQuery: MediaQueryList;
  private changeListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  }

  /**
   * Get the effective theme based on data-theme attribute and system preference
   * @returns 'light' or 'dark' (never 'auto')
   */
  getEffectiveTheme(): Theme {
    const themeAttr = this.host.getAttribute('data-theme') as ThemeMode | null;

    // If explicit light or dark, use it
    if (themeAttr === 'light') return 'light';
    if (themeAttr === 'dark') return 'dark';

    // If 'auto' or absent, detect from system
    return this.mediaQuery.matches ? 'dark' : 'light';
  }

  /**
   * Apply theme to Shadow DOM by injecting CSS with theme-aware custom properties
   * @param shadowRoot The Shadow DOM root to inject styles into
   */
  applyTheme(shadowRoot: ShadowRoot): void {
    const themeStyles = `
      /* Light mode defaults (always apply first) */
      :host {
        --widget-bg: #ffffff;
        --widget-text: #333333;
        --widget-accent: #fc4c02;
      }

      /* Auto dark mode: when system prefers dark AND theme is auto or unset */
      @media (prefers-color-scheme: dark) {
        :host([data-theme="auto"]), :host:not([data-theme]) {
          --widget-bg: #1a1a2e;
          --widget-text: #e0e0e0;
          --widget-accent: #ff6b35;
        }
      }

      /* Manual dark mode override */
      :host([data-theme="dark"]) {
        --widget-bg: #1a1a2e;
        --widget-text: #e0e0e0;
        --widget-accent: #ff6b35;
      }

      /* Manual light mode override (explicit over auto) */
      :host([data-theme="light"]) {
        --widget-bg: #ffffff;
        --widget-text: #333333;
        --widget-accent: #fc4c02;
      }
    `;

    // Inject theme styles (append to existing styles)
    const styleElement = document.createElement('style');
    styleElement.textContent = themeStyles;
    shadowRoot.appendChild(styleElement);
  }

  /**
   * Listen for system theme changes and invoke callback
   * Only fires when theme is 'auto' or unset
   * @param callback Function to call when system theme changes
   */
  listenForChanges(callback: () => void): void {
    this.changeListener = (e: MediaQueryListEvent) => {
      // Only trigger callback if theme is auto (respects system)
      const themeAttr = this.host.getAttribute('data-theme');
      if (!themeAttr || themeAttr === 'auto') {
        callback();
      }
    };

    this.mediaQuery.addEventListener('change', this.changeListener);
  }

  /**
   * Clean up event listeners (call in disconnectedCallback)
   */
  destroy(): void {
    if (this.changeListener) {
      this.mediaQuery.removeEventListener('change', this.changeListener);
      this.changeListener = null;
    }
  }
}
