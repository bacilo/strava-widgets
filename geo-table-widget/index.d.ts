/**
 * Geographic Table Widget
 * Sortable, paginated table for geographic running statistics
 */
import { WidgetBase } from '../shared/widget-base.js';
/**
 * Geographic Table Widget Custom Element
 */
declare class GeoTableWidgetElement extends WidgetBase {
    /**
     * Observed attributes specific to this widget
     */
    static observedAttributes: string[];
    private data;
    private sortState;
    private paginator;
    private columns;
    constructor();
    /**
     * Default data URL (countries)
     */
    protected get dataUrl(): string;
    /**
     * Get dataset type from attribute
     */
    private getDataset;
    /**
     * Override connectedCallback to add custom initialization
     */
    connectedCallback(): void;
    /**
     * Render widget with data
     */
    protected render(data: unknown): void;
    /**
     * Create table header with sortable columns
     */
    private createTableHeader;
    /**
     * Create table row
     */
    private createTableRow;
    /**
     * Handle column sort
     */
    private handleSort;
    /**
     * Render pagination controls
     */
    private renderPaginationControls;
    /**
     * Get column type for sorting
     */
    private getColumnType;
}
declare const GeoTableWidget: {
    version: string;
    init: () => void;
};
export { GeoTableWidgetElement, GeoTableWidget };
//# sourceMappingURL=index.d.ts.map