/**
 * Responsive manager using ResizeObserver for container-based responsiveness
 * Prevents infinite loops and sets data-size attribute for CSS-only responsive styling
 */
/**
 * Manages responsive behavior using ResizeObserver
 * Tracks expected sizes to prevent infinite loops
 */
export class ResponsiveManager {
    host;
    callback;
    observer = null;
    expectedSizes = new WeakMap();
    /**
     * @param host The host element to observe
     * @param callback Function called with new dimensions (width, height)
     */
    constructor(host, callback) {
        this.host = host;
        this.callback = callback;
    }
    /**
     * Start observing the host element for size changes
     */
    observe() {
        this.observer = new ResizeObserver((entries) => {
            // Wrap in requestAnimationFrame to prevent infinite loops
            requestAnimationFrame(() => {
                for (const entry of entries) {
                    let width;
                    let height;
                    // Use contentBoxSize for modern browsers
                    if (entry.contentBoxSize && entry.contentBoxSize.length > 0) {
                        const size = entry.contentBoxSize[0];
                        width = size.inlineSize;
                        height = size.blockSize;
                    }
                    else {
                        // Fallback for older browsers
                        width = entry.contentRect.width;
                        height = entry.contentRect.height;
                    }
                    // Check if already at expected size (prevent loop)
                    const expected = this.expectedSizes.get(entry.target);
                    if (expected && expected.width === width && expected.height === height) {
                        continue;
                    }
                    // Update data-size attribute for CSS-based responsive styling
                    this.updateSizeAttribute(width);
                    // Call user callback with new dimensions
                    this.callback(width, height);
                    // Track new expected size
                    this.expectedSizes.set(entry.target, { width, height });
                }
            });
        });
        this.observer.observe(this.host);
    }
    /**
     * Stop observing (call in disconnectedCallback)
     */
    disconnect() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
    /**
     * Update data-size attribute based on width breakpoints
     * Enables CSS selectors like :host([data-size="compact"])
     */
    updateSizeAttribute(width) {
        let size;
        if (width < 400) {
            size = 'compact';
        }
        else if (width < 700) {
            size = 'medium';
        }
        else {
            size = 'large';
        }
        // Only update if changed (avoid unnecessary DOM mutation)
        if (this.host.getAttribute('data-size') !== size) {
            this.host.setAttribute('data-size', size);
        }
    }
}
//# sourceMappingURL=responsive-manager.js.map