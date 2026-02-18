/**
 * Theme manager for dark/light mode detection and application
 * Handles system preference detection via prefers-color-scheme and manual overrides
 */
type Theme = 'light' | 'dark';
/**
 * Manages theme detection and application for a widget
 */
export declare class ThemeManager {
    private host;
    private mediaQuery;
    private changeListener;
    constructor(host: HTMLElement);
    /**
     * Get the effective theme based on data-theme attribute and system preference
     * @returns 'light' or 'dark' (never 'auto')
     */
    getEffectiveTheme(): Theme;
    /**
     * Apply theme to Shadow DOM by injecting CSS with theme-aware custom properties
     * @param shadowRoot The Shadow DOM root to inject styles into
     */
    applyTheme(shadowRoot: ShadowRoot): void;
    /**
     * Listen for system theme changes and invoke callback
     * Only fires when theme is 'auto' or unset
     * @param callback Function to call when system theme changes
     */
    listenForChanges(callback: () => void): void;
    /**
     * Clean up event listeners (call in disconnectedCallback)
     */
    destroy(): void;
}
export {};
//# sourceMappingURL=theme-manager.d.ts.map