/**
 * Responsive manager using ResizeObserver for container-based responsiveness
 * Prevents infinite loops and sets data-size attribute for CSS-only responsive styling
 */
type ResponsiveCallback = (width: number, height: number) => void;
/**
 * Manages responsive behavior using ResizeObserver
 * Tracks expected sizes to prevent infinite loops
 */
export declare class ResponsiveManager {
    private host;
    private callback;
    private observer;
    private expectedSizes;
    /**
     * @param host The host element to observe
     * @param callback Function called with new dimensions (width, height)
     */
    constructor(host: HTMLElement, callback: ResponsiveCallback);
    /**
     * Start observing the host element for size changes
     */
    observe(): void;
    /**
     * Stop observing (call in disconnectedCallback)
     */
    disconnect(): void;
    /**
     * Update data-size attribute based on width breakpoints
     * Enables CSS selectors like :host([data-size="compact"])
     */
    private updateSizeAttribute;
}
export {};
//# sourceMappingURL=responsive-manager.d.ts.map