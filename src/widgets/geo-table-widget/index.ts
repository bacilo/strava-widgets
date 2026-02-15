/**
 * Geographic Table Widget
 * Sortable, paginated table for geographic running statistics
 */

import { WidgetBase } from '../shared/widget-base.js';
import { ThemeManager } from '../shared/theme-manager.js';
import { ResponsiveManager } from '../shared/responsive-manager.js';
import { parseBoolean, parseNumber, parseEnum } from '../shared/attribute-parser.js';
import { TableSorter, SortState } from './table-sorter.js';
import { TablePaginator } from './table-paginator.js';
import { CountryStats, CityStats } from '../geo-stats-widget/csv-exporter.js';

/**
 * Table column configuration
 */
interface TableColumn {
  key: string;
  label: string;
  sortable: boolean;
  type: 'string' | 'number';
}

/**
 * Column definitions for countries dataset
 */
const COUNTRY_COLUMNS: TableColumn[] = [
  { key: 'countryName', label: 'Country', sortable: true, type: 'string' },
  { key: 'totalDistanceKm', label: 'Distance (km)', sortable: true, type: 'number' },
  { key: 'activityCount', label: 'Runs', sortable: true, type: 'number' },
  { key: 'citiesCount', label: 'Cities', sortable: true, type: 'number' }
];

/**
 * Column definitions for cities dataset
 */
const CITY_COLUMNS: TableColumn[] = [
  { key: 'cityName', label: 'City', sortable: true, type: 'string' },
  { key: 'countryName', label: 'Country', sortable: true, type: 'string' },
  { key: 'totalDistanceKm', label: 'Distance (km)', sortable: true, type: 'number' },
  { key: 'activityCount', label: 'Runs', sortable: true, type: 'number' }
];

/**
 * Constructible stylesheet for table styles (shared across instances)
 */
const tableStyles = new CSSStyleSheet();
tableStyles.replaceSync(`
.geo-table-container {
  background: var(--widget-bg, #ffffff);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 24px;
}

/* Dark mode box shadow */
:host([data-theme="dark"]) .geo-table-container,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .geo-table-container,
  :host(:not([data-theme])) .geo-table-container {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }
}

.table-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: var(--widget-text, #333);
}

.geo-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.geo-table caption {
  font-size: 13px;
  color: #888;
  text-align: left;
  margin-bottom: 8px;
  padding: 4px 0;
}

/* Dark mode caption */
:host([data-theme="dark"]) .geo-table caption,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .geo-table caption,
  :host(:not([data-theme])) .geo-table caption {
    color: #aaa;
  }
}

.geo-table th {
  text-align: left;
  padding: 12px 16px;
  border-bottom: 2px solid #eee;
  font-weight: 600;
  color: var(--widget-text, #333);
}

/* Dark mode table header */
:host([data-theme="dark"]) .geo-table th,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .geo-table th,
  :host(:not([data-theme])) .geo-table th {
    border-bottom-color: #444;
  }
}

.geo-table td {
  padding: 10px 16px;
  border-bottom: 1px solid #f0f0f0;
  color: var(--widget-text, #333);
}

/* Dark mode table cells */
:host([data-theme="dark"]) .geo-table td,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .geo-table td,
  :host(:not([data-theme])) .geo-table td {
    border-bottom-color: #333;
  }
}

.geo-table tbody tr:last-child td {
  border-bottom: none;
}

.geo-table tbody tr:hover {
  background: rgba(252, 76, 2, 0.05);
}

/* Dark mode row hover */
:host([data-theme="dark"]) .geo-table tbody tr:hover,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .geo-table tbody tr:hover,
  :host(:not([data-theme])) .geo-table tbody tr:hover {
    background: rgba(255, 107, 53, 0.1);
  }
}

.sort-button {
  background: none;
  border: none;
  cursor: pointer;
  font: inherit;
  width: 100%;
  text-align: left;
  padding: 0;
  color: inherit;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sort-button:hover {
  color: var(--widget-accent, #fc4c02);
}

.sort-button:focus {
  outline: 2px solid var(--widget-accent, #fc4c02);
  outline-offset: 2px;
}

.sort-indicator {
  margin-left: 8px;
  font-size: 12px;
  color: var(--widget-accent, #fc4c02);
  flex-shrink: 0;
}

.number-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

/* Dark mode pagination border */
:host([data-theme="dark"]) .pagination-controls,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .pagination-controls,
  :host(:not([data-theme])) .pagination-controls {
    border-top-color: #444;
  }
}

.pagination-btn {
  font-size: 12px;
  padding: 6px 14px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  color: #666;
  cursor: pointer;
  font-weight: 400;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.pagination-btn:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #bbb;
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Dark mode pagination buttons */
:host([data-theme="dark"]) .pagination-btn,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .pagination-btn,
  :host(:not([data-theme])) .pagination-btn {
    background: #2a2a2a;
    border-color: #444;
    color: #aaa;
  }
}

:host([data-theme="dark"]) .pagination-btn:hover:not(:disabled),
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .pagination-btn:hover:not(:disabled),
  :host(:not([data-theme])) .pagination-btn:hover:not(:disabled) {
    background: #333;
    border-color: #555;
  }
}

.pagination-info {
  font-size: 13px;
  color: #888;
}

/* Dark mode pagination info */
:host([data-theme="dark"]) .pagination-info,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .pagination-info,
  :host(:not([data-theme])) .pagination-info {
    color: #aaa;
  }
}

/* Responsive: hide less-important columns in compact mode */
:host([data-size="compact"]) .geo-table th.compact-hide,
:host([data-size="compact"]) .geo-table td.compact-hide {
  display: none;
}

:host([data-size="compact"]) .geo-table {
  font-size: 13px;
}
`);

/**
 * Geographic Table Widget Custom Element
 */
class GeoTableWidgetElement extends WidgetBase {
  /**
   * Observed attributes specific to this widget
   */
  static observedAttributes = [
    ...WidgetBase.observedAttributes,
    'data-dataset',
    'data-rows-per-page',
    'data-default-sort',
    'data-default-sort-direction'
  ];

  private data: (CountryStats | CityStats)[] = [];
  private sortState: SortState = { column: 'totalDistanceKm', direction: 'descending' };
  private paginator: TablePaginator<CountryStats | CityStats>;
  private columns: TableColumn[] = COUNTRY_COLUMNS;

  constructor() {
    super();
    // Initialize paginator with default values (will be updated in connectedCallback)
    this.paginator = new TablePaginator(0, 20);
  }

  /**
   * Default data URL (countries)
   */
  protected get dataUrl(): string {
    const dataset = this.getDataset();
    return dataset === 'cities'
      ? '/data/geo/cities.json'
      : '/data/geo/countries.json';
  }

  /**
   * Get dataset type from attribute
   */
  private getDataset(): 'countries' | 'cities' {
    const datasetAttr = this.getAttribute('data-dataset');
    return parseEnum(datasetAttr, ['countries', 'cities'] as const, 'countries');
  }

  /**
   * Override connectedCallback to add custom initialization
   */
  connectedCallback(): void {
    // Inject base styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      :host {
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-sizing: border-box;
        color: var(--widget-text, #333333);
        background: var(--widget-bg, #ffffff);
        width: var(--widget-width, 100%);
        max-width: var(--widget-max-width, 800px);
        padding: var(--widget-padding, 20px);
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
    this.shadowRoot!.appendChild(styleElement);

    // Adopt constructible stylesheet
    this.shadowRoot!.adoptedStyleSheets = [tableStyles];

    // Initialize theme manager
    this.themeManager = new ThemeManager(this);
    this.themeManager.applyTheme(this.shadowRoot!);
    this.themeManager.listenForChanges(() => {
      this.fetchDataAndRender();
    });

    // Initialize responsive manager
    this.responsiveManager = new ResponsiveManager(this, (width, height) => {
      this.onResize(width, height);
    });
    this.responsiveManager.observe();

    // Apply CSS custom properties from attributes
    const width = this.getAttribute('data-width');
    if (width) {
      this.style.setProperty('--widget-width', width.includes('px') || width.includes('%') ? width : `${width}px`);
    }

    const maxWidth = this.getAttribute('data-max-width');
    if (maxWidth) {
      this.style.setProperty('--widget-max-width', maxWidth.includes('px') || maxWidth.includes('%') ? maxWidth : `${maxWidth}px`);
    }

    const padding = this.getAttribute('data-padding');
    if (padding) {
      this.style.setProperty('--widget-padding', padding.includes('px') || padding.includes('%') ? padding : `${padding}px`);
    }

    const bg = this.getAttribute('data-bg');
    if (bg) {
      this.style.setProperty('--widget-bg', bg);
    }

    const textColor = this.getAttribute('data-text-color');
    if (textColor) {
      this.style.setProperty('--widget-text', textColor);
    }

    const accent = this.getAttribute('data-accent');
    if (accent) {
      this.style.setProperty('--widget-accent', accent);
    }

    // Determine dataset and set columns
    const dataset = this.getDataset();
    this.columns = dataset === 'cities' ? CITY_COLUMNS : COUNTRY_COLUMNS;

    // Initialize paginator with rows-per-page from attribute
    const rowsPerPage = parseNumber(
      this.getAttribute('data-rows-per-page'),
      20,
      1,
      50
    );
    this.paginator = new TablePaginator(0, rowsPerPage);

    // Initialize sort state from attributes
    const defaultSort = this.getAttribute('data-default-sort') || 'totalDistanceKm';
    const defaultDirection = parseEnum(
      this.getAttribute('data-default-sort-direction'),
      ['ascending', 'descending'] as const,
      'descending'
    );
    this.sortState = { column: defaultSort, direction: defaultDirection };

    // Show loading and fetch data
    this.showLoading();
    this.fetchDataAndRender();
  }

  /**
   * Render widget with data
   */
  protected render(data: unknown): void {
    // Store raw data
    this.data = data as (CountryStats | CityStats)[];

    // Update paginator total
    this.paginator.updateTotal(this.data.length);

    // Sort data using TableSorter
    const columnType = this.getColumnType(this.sortState.column);
    const sorted = TableSorter.sort(
      this.data,
      this.sortState.column as keyof (CountryStats | CityStats),
      this.sortState.direction,
      columnType
    );

    // Paginate sorted data
    const pageData = this.paginator.paginate(sorted);

    // Clear old table content (keep styles)
    const oldContainer = this.shadowRoot?.querySelector('.geo-table-container');
    if (oldContainer) {
      oldContainer.remove();
    }

    // Create container
    const container = document.createElement('div');
    container.className = 'geo-table-container';

    // Add title if enabled
    const showTitle = parseBoolean(this, 'data-show-title', true);
    if (showTitle) {
      const titleAttr = this.getAttribute('data-title');
      const dataset = this.getDataset();
      const defaultTitle = dataset === 'cities' ? 'Running by City' : 'Running by Country';

      const title = document.createElement('h2');
      title.className = 'table-title';
      title.textContent = titleAttr || defaultTitle;
      container.appendChild(title);
    }

    // Create table
    const table = document.createElement('table');
    table.className = 'geo-table';
    table.setAttribute('role', 'table');

    // Add caption for accessibility
    const caption = document.createElement('caption');
    caption.textContent = 'Sortable table - click column headers to sort';
    table.appendChild(caption);

    // Create header
    table.appendChild(this.createTableHeader());

    // Create body
    const tbody = document.createElement('tbody');
    pageData.forEach(row => {
      tbody.appendChild(this.createTableRow(row));
    });
    table.appendChild(tbody);

    container.appendChild(table);

    // Add pagination controls if needed
    if (this.paginator.totalPages > 1) {
      container.appendChild(this.renderPaginationControls());
    }

    this.shadowRoot?.appendChild(container);
  }

  /**
   * Create table header with sortable columns
   */
  private createTableHeader(): HTMLElement {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');

    this.columns.forEach((col, index) => {
      const th = document.createElement('th');

      // Add compact-hide class to cities count column (countries) or country column (cities)
      const dataset = this.getDataset();
      if (
        (dataset === 'countries' && col.key === 'citiesCount') ||
        (dataset === 'cities' && col.key === 'countryName')
      ) {
        th.classList.add('compact-hide');
      }

      // Add number-cell class for right alignment
      if (col.type === 'number') {
        th.classList.add('number-cell');
      }

      if (col.sortable) {
        // Use button for sortable columns
        const button = document.createElement('button');
        button.className = 'sort-button';
        button.textContent = col.label;
        button.addEventListener('click', () => this.handleSort(col.key));

        // Add sort indicator
        const indicator = document.createElement('span');
        indicator.setAttribute('aria-hidden', 'true');
        indicator.className = 'sort-indicator';

        if (this.sortState.column === col.key) {
          indicator.textContent = this.sortState.direction === 'ascending' ? '▲' : '▼';
          th.setAttribute('aria-sort', this.sortState.direction);
        } else {
          indicator.textContent = '♢';
        }

        button.appendChild(indicator);
        th.appendChild(button);
      } else {
        // Plain text for non-sortable columns
        th.textContent = col.label;
      }

      tr.appendChild(th);
    });

    thead.appendChild(tr);
    return thead;
  }

  /**
   * Create table row
   */
  private createTableRow(rowData: CountryStats | CityStats): HTMLElement {
    const tr = document.createElement('tr');
    const dataset = this.getDataset();

    this.columns.forEach(col => {
      const td = document.createElement('td');

      // Add compact-hide class to match header
      if (
        (dataset === 'countries' && col.key === 'citiesCount') ||
        (dataset === 'cities' && col.key === 'countryName')
      ) {
        td.classList.add('compact-hide');
      }

      // Add number-cell class for right alignment
      if (col.type === 'number') {
        td.classList.add('number-cell');
      }

      // Get value
      let value: string | number;
      if (col.key === 'citiesCount' && 'cities' in rowData) {
        // Special case: cities count from cities array length
        value = (rowData as CountryStats).cities.length;
      } else {
        value = (rowData as any)[col.key];
      }

      // Format value
      if (col.type === 'number') {
        td.textContent = Number(value).toLocaleString();
      } else {
        td.textContent = String(value);
      }

      tr.appendChild(td);
    });

    return tr;
  }

  /**
   * Handle column sort
   */
  private handleSort(column: string): void {
    // Clear all aria-sort attributes (research pitfall #1)
    const allHeaders = this.shadowRoot?.querySelectorAll('th[aria-sort]');
    allHeaders?.forEach(th => th.removeAttribute('aria-sort'));

    // Toggle direction if same column, reset to ascending if different
    if (this.sortState.column === column) {
      this.sortState.direction =
        this.sortState.direction === 'ascending' ? 'descending' : 'ascending';
    } else {
      this.sortState.column = column;
      this.sortState.direction = 'ascending';
    }

    // Reset to page 1 when sorting
    this.paginator.goToPage(1);

    // Re-render with stored data
    this.render(this.data);
  }

  /**
   * Render pagination controls
   */
  private renderPaginationControls(): HTMLElement {
    const controls = document.createElement('div');
    controls.className = 'pagination-controls';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.className = 'pagination-btn';
    prevBtn.disabled = this.paginator.currentPage === 1;
    prevBtn.addEventListener('click', () => {
      this.paginator.previousPage();
      this.render(this.data);
    });
    controls.appendChild(prevBtn);

    // Page info (X-Y of Z format)
    const pageInfo = document.createElement('span');
    pageInfo.className = 'pagination-info';
    const start = this.paginator.startIndex + 1;
    const end = Math.min(this.paginator.endIndex, this.paginator.totalRows);
    pageInfo.textContent = `${start}-${end} of ${this.paginator.totalRows}`;
    controls.appendChild(pageInfo);

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.className = 'pagination-btn';
    nextBtn.disabled = this.paginator.currentPage >= this.paginator.totalPages;
    nextBtn.addEventListener('click', () => {
      this.paginator.nextPage();
      this.render(this.data);
    });
    controls.appendChild(nextBtn);

    return controls;
  }

  /**
   * Get column type for sorting
   */
  private getColumnType(columnKey: string): 'string' | 'number' {
    const column = this.columns.find(c => c.key === columnKey);
    return column?.type || 'string';
  }
}

// Register custom element
WidgetBase.register('strava-geo-table', GeoTableWidgetElement);

// Backwards-compatible global init object (same pattern as geo-stats-widget)
const GeoTableWidget = {
  version: '1.1.0',
  init: () => {
    // Auto-registration happens when module is imported
    console.log('GeoTableWidget v1.1.0 initialized');
  }
};

// Expose globally for backwards compatibility
(window as any).GeoTableWidget = GeoTableWidget;

export { GeoTableWidgetElement, GeoTableWidget };
