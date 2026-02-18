/**
 * Abstract base class for embeddable widgets (Custom Element)
 * Extends HTMLElement with attribute-driven configuration, Shadow DOM, theming, and responsive behavior
 */
import { WidgetConfig } from '../../types/widget-config.types.js';
import { ThemeManager } from './theme-manager.js';
import { ResponsiveManager } from './responsive-manager.js';
/**
 * Abstract widget base class extending HTMLElement
 * All widgets must extend this and implement render() and dataUrl getter
 */
export declare abstract class WidgetBase extends HTMLElement {
    /**
     * Observed attributes common to all widgets
     * Subclasses can add their own by overriding this static property
     */
    static observedAttributes: string[];
    protected themeManager: ThemeManager | null;
    protected responsiveManager: ResponsiveManager | null;
    /**
     * Constructor - attach Shadow DOM
     * DO NOT read attributes here (not available until connectedCallback)
     */
    constructor();
    /**
     * Called when element is inserted into the DOM
     * Read attributes, initialize managers, fetch data
     */
    connectedCallback(): void;
    /**
     * Called when observed attributes change
     * @param name Attribute name
     * @param oldValue Previous value
     * @param newValue New value
     */
    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void;
    /**
     * Called when element is removed from the DOM
     * Clean up managers and listeners
     */
    disconnectedCallback(): void;
    /**
     * Check if attribute is a style-related attribute (doesn't require data re-fetch)
     */
    private isStyleAttribute;
    /**
     * Apply CSS custom properties from attributes
     */
    private applyStyleAttributes;
    /**
     * Get configuration object from attributes (backwards compatibility)
     * Subclasses can use this to get a WidgetConfig-compatible object
     */
    protected getConfig(): WidgetConfig;
    /**
     * Show loading message
     */
    protected showLoading(): void;
    /**
     * Show error message (fail silently for embeddable widgets)
     */
    protected showError(message?: string): void;
    /**
     * Fetch JSON data from URL
     */
    protected fetchData<T = unknown>(url: string): Promise<T>;
    /**
     * Fetch data and render widget
     * Can be overridden by subclasses that need to fetch multiple data sources
     */
    protected fetchDataAndRender(): Promise<void>;
    /**
     * Hook for responsive behavior (override in subclasses if needed)
     * @param width Container width in pixels
     * @param height Container height in pixels
     */
    protected onResize(width: number, height: number): void;
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
    static register(tagName: string, ElementClass: CustomElementConstructor): void;
}
//# sourceMappingURL=widget-base.d.ts.map