/**
 * Table pagination utility
 * Manages pagination state and provides data slicing
 */

/**
 * Table paginator class with boundary checking
 */
export class TablePaginator<T> {
  public currentPage: number = 1;
  public rowsPerPage: number;
  public totalRows: number;

  /**
   * Create paginator
   * @param totalRows Total number of rows
   * @param rowsPerPage Rows per page (default 20)
   */
  constructor(totalRows: number, rowsPerPage: number = 20) {
    this.totalRows = totalRows;
    this.rowsPerPage = rowsPerPage;
  }

  /**
   * Get total number of pages
   */
  get totalPages(): number {
    return Math.ceil(this.totalRows / this.rowsPerPage);
  }

  /**
   * Get start index for current page (0-based)
   */
  get startIndex(): number {
    return (this.currentPage - 1) * this.rowsPerPage;
  }

  /**
   * Get end index for current page (exclusive, 0-based)
   */
  get endIndex(): number {
    return this.startIndex + this.rowsPerPage;
  }

  /**
   * Get current page of data (slice of array)
   * @param data Full data array
   * @returns Sliced array for current page
   */
  paginate(data: T[]): T[] {
    return data.slice(this.startIndex, this.endIndex);
  }

  /**
   * Navigate to specific page (with boundary checking)
   * @param page Page number (1-based)
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  /**
   * Navigate to next page (with boundary checking)
   */
  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  /**
   * Navigate to previous page (with boundary checking)
   */
  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  /**
   * Update total rows (e.g., after filtering)
   * Resets to page 1 if current page is out of bounds
   * @param totalRows New total row count
   */
  updateTotal(totalRows: number): void {
    this.totalRows = totalRows;
    // Reset to page 1 if current page out of bounds (research pitfall #6)
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }
}
