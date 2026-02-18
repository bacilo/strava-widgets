/**
 * Table pagination utility
 * Manages pagination state and provides data slicing
 */
/**
 * Table paginator class with boundary checking
 */
export declare class TablePaginator<T> {
    currentPage: number;
    rowsPerPage: number;
    totalRows: number;
    /**
     * Create paginator
     * @param totalRows Total number of rows
     * @param rowsPerPage Rows per page (default 20)
     */
    constructor(totalRows: number, rowsPerPage?: number);
    /**
     * Get total number of pages
     */
    get totalPages(): number;
    /**
     * Get start index for current page (0-based)
     */
    get startIndex(): number;
    /**
     * Get end index for current page (exclusive, 0-based)
     */
    get endIndex(): number;
    /**
     * Get current page of data (slice of array)
     * @param data Full data array
     * @returns Sliced array for current page
     */
    paginate(data: T[]): T[];
    /**
     * Navigate to specific page (with boundary checking)
     * @param page Page number (1-based)
     */
    goToPage(page: number): void;
    /**
     * Navigate to next page (with boundary checking)
     */
    nextPage(): void;
    /**
     * Navigate to previous page (with boundary checking)
     */
    previousPage(): void;
    /**
     * Update total rows (e.g., after filtering)
     * Resets to page 1 if current page is out of bounds
     * @param totalRows New total row count
     */
    updateTotal(totalRows: number): void;
}
//# sourceMappingURL=table-paginator.d.ts.map