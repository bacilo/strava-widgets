/**
 * Geographic Statistics Widget
 * Displays country and city rankings with distance data and CSV export
 */
import { WidgetBase } from '../shared/widget-base.js';
import { ThemeManager } from '../shared/theme-manager.js';
import { ResponsiveManager } from '../shared/responsive-manager.js';
import { parseBoolean, parseNumber } from '../shared/attribute-parser.js';
import { exportCountriesToCSV, exportCitiesToCSV } from './csv-exporter.js';
// Geo stats widget specific styles
const GEO_STATS_STYLES = `
.geo-stats-card {
  background: var(--widget-bg, #ffffff);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 24px;
}

/* Dark mode box shadow */
:host([data-theme="dark"]) .geo-stats-card,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .geo-stats-card,
  :host(:not([data-theme])) .geo-stats-card {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }
}

.card-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: var(--widget-text, #333);
}

.geo-metadata {
  font-size: 13px;
  color: #888;
  margin-bottom: 20px;
  padding: 8px 12px;
  background: rgba(252, 76, 2, 0.05);
  border-radius: 6px;
}

/* Dark mode metadata */
:host([data-theme="dark"]) .geo-metadata,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .geo-metadata,
  :host(:not([data-theme])) .geo-metadata {
    background: rgba(255, 107, 53, 0.1);
    color: #aaa;
  }
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 24px 0 12px 0;
  color: var(--widget-text, #333);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title:first-of-type {
  margin-top: 0;
}

.export-btn {
  font-size: 12px;
  padding: 4px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  color: #666;
  cursor: pointer;
  font-weight: 400;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.export-btn:hover {
  background: #f5f5f5;
  border-color: #bbb;
}

/* Dark mode export button */
:host([data-theme="dark"]) .export-btn,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .export-btn,
  :host(:not([data-theme])) .export-btn {
    background: #2a2a3e;
    border-color: #444;
    color: #ccc;
  }
}

:host([data-theme="dark"]) .export-btn:hover,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .export-btn:hover,
  :host(:not([data-theme])) .export-btn:hover {
    background: #3a3a4e;
    border-color: #666;
  }
}

.geo-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

/* Responsive: compact table */
:host([data-size="compact"]) .geo-table {
  font-size: 12px;
}

/* Hide cities column in compact mode for countries table */
:host([data-size="compact"]) .geo-table .cities-col {
  display: none;
}

.geo-table th {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 2px solid #eee;
  color: #666;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Dark mode table headers */
:host([data-theme="dark"]) .geo-table th,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .geo-table th,
  :host(:not([data-theme])) .geo-table th {
    border-bottom-color: #444;
    color: #aaa;
  }
}

.geo-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
}

/* Dark mode table cells */
:host([data-theme="dark"]) .geo-table td,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .geo-table td,
  :host(:not([data-theme])) .geo-table td {
    border-bottom-color: #333;
  }
}

.geo-table tr:last-child td {
  border-bottom: none;
}

.rank-cell {
  color: #999;
  font-weight: 500;
  width: 40px;
}

/* Dark mode rank cells */
:host([data-theme="dark"]) .rank-cell,
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .rank-cell,
  :host(:not([data-theme])) .rank-cell {
    color: #777;
  }
}

.number-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.country-cell, .city-cell {
  font-weight: 500;
}
`;
class GeoStatsWidgetElement extends WidgetBase {
    /**
     * Observed attributes specific to this widget
     */
    static observedAttributes = [
        ...WidgetBase.observedAttributes,
        'data-url-secondary',
        'data-url-metadata',
        'data-show-export',
        'data-max-rows'
    ];
    citiesData = [];
    metadataData = null;
    /**
     * Default data URL for countries data
     */
    get dataUrl() {
        return '/data/geo/countries.json';
    }
    /**
     * Fetch all three data sources
     */
    async fetchAllDataAndRender() {
        try {
            // Get URLs from attributes or defaults
            const primaryUrl = this.getAttribute('data-url') || this.dataUrl;
            const secondaryUrl = this.getAttribute('data-url-secondary');
            const metadataUrl = this.getAttribute('data-url-metadata');
            // Fetch all data sources in parallel
            const [countries, cities, metadata] = await Promise.all([
                this.fetchData(primaryUrl),
                secondaryUrl
                    ? this.fetchData(secondaryUrl)
                    : Promise.resolve([]),
                metadataUrl
                    ? this.fetchData(metadataUrl)
                    : Promise.resolve(null)
            ]);
            // Store secondary data
            this.citiesData = cities;
            this.metadataData = metadata;
            // Clear loading
            if (this.shadowRoot) {
                const loadingEl = this.shadowRoot.querySelector('.widget-loading');
                if (loadingEl) {
                    loadingEl.remove();
                }
            }
            // Render widget with data
            this.render(countries);
        }
        catch (error) {
            console.error('GeoStatsWidget: Failed to load data', error);
            this.showError();
        }
    }
    /**
     * Override connectedCallback to use custom fetch logic
     */
    connectedCallback() {
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
        this.shadowRoot.appendChild(styleElement);
        // Initialize theme manager
        this.themeManager = new ThemeManager(this);
        this.themeManager.applyTheme(this.shadowRoot);
        this.themeManager.listenForChanges(() => {
            this.fetchAllDataAndRender();
        });
        // Initialize responsive manager
        this.responsiveManager = new ResponsiveManager(this, (width, height) => {
            this.onResize(width, height);
        });
        this.responsiveManager.observe();
        // Apply style attributes from parent
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
            this.style.setProperty('--widget-padding', padding.includes('px') ? padding : `${padding}px`);
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
        // Show loading and fetch
        this.showLoading();
        this.fetchAllDataAndRender();
    }
    /**
     * Render the geographic statistics widget
     */
    render(countries) {
        if (!this.shadowRoot)
            return;
        // Remove old widget content (keep styles)
        const oldCard = this.shadowRoot.querySelector('.geo-stats-card');
        if (oldCard) {
            oldCard.remove();
        }
        // Inject widget-specific styles if not already present
        if (!this.shadowRoot.querySelector('style[data-widget-styles]')) {
            const styleElement = document.createElement('style');
            styleElement.setAttribute('data-widget-styles', 'true');
            styleElement.textContent = GEO_STATS_STYLES;
            this.shadowRoot.appendChild(styleElement);
        }
        // Get configuration from attributes
        const showTitle = parseBoolean(this, 'data-show-title', true);
        const customTitle = this.getAttribute('data-title');
        const showExport = parseBoolean(this, 'data-show-export', true);
        const maxRows = parseNumber(this.getAttribute('data-max-rows'), Infinity, 1);
        // Apply max rows limit if specified
        let displayCountries = countries;
        let displayCities = this.citiesData;
        if (maxRows < Infinity) {
            displayCountries = countries.slice(0, maxRows);
            displayCities = this.citiesData.slice(0, maxRows);
        }
        // Create card container
        const card = document.createElement('div');
        card.className = 'geo-stats-card';
        // Add title if enabled
        if (showTitle) {
            const title = document.createElement('h2');
            title.className = 'card-title';
            title.textContent = customTitle || 'Running by Location';
            card.appendChild(title);
        }
        // Add metadata if available
        if (this.metadataData) {
            const metadata = document.createElement('div');
            metadata.className = 'geo-metadata';
            metadata.textContent = `Based on ${this.metadataData.geocodedActivities.toLocaleString()} of ${this.metadataData.totalActivities.toLocaleString()} activities (${this.metadataData.coveragePercent}% with GPS data) - ${this.metadataData.totalDistanceKm.toLocaleString()} km total`;
            card.appendChild(metadata);
        }
        // Render Countries section
        const countriesSection = this.createCountriesSection(displayCountries, showExport);
        card.appendChild(countriesSection);
        // Render Cities section
        const citiesSection = this.createCitiesSection(displayCities, showExport);
        card.appendChild(citiesSection);
        this.shadowRoot.appendChild(card);
    }
    /**
     * Create countries table section
     */
    createCountriesSection(countries, showExport) {
        const section = document.createElement('div');
        // Section title with export button
        const titleDiv = document.createElement('div');
        titleDiv.className = 'section-title';
        const titleText = document.createElement('span');
        titleText.textContent = 'Countries';
        titleDiv.appendChild(titleText);
        if (showExport) {
            const exportBtn = document.createElement('button');
            exportBtn.className = 'export-btn';
            exportBtn.textContent = 'Export CSV';
            exportBtn.addEventListener('click', () => exportCountriesToCSV(countries));
            titleDiv.appendChild(exportBtn);
        }
        section.appendChild(titleDiv);
        // Create table
        const table = document.createElement('table');
        table.className = 'geo-table';
        // Table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const headers = [
            { text: 'Rank', className: 'rank-cell' },
            { text: 'Country', className: '' },
            { text: 'Distance (km)', className: 'number-cell' },
            { text: 'Runs', className: 'number-cell' },
            { text: 'Cities', className: 'number-cell cities-col' }
        ];
        headers.forEach(({ text, className }) => {
            const th = document.createElement('th');
            th.textContent = text;
            if (className) {
                th.className = className;
            }
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        // Table body
        const tbody = document.createElement('tbody');
        countries.forEach((country, idx) => {
            const row = document.createElement('tr');
            // Rank
            const rankCell = document.createElement('td');
            rankCell.className = 'rank-cell';
            rankCell.textContent = (idx + 1).toString();
            row.appendChild(rankCell);
            // Country name
            const countryCell = document.createElement('td');
            countryCell.className = 'country-cell';
            countryCell.textContent = country.countryName;
            row.appendChild(countryCell);
            // Distance
            const distanceCell = document.createElement('td');
            distanceCell.className = 'number-cell';
            distanceCell.textContent = country.totalDistanceKm.toLocaleString();
            row.appendChild(distanceCell);
            // Runs
            const runsCell = document.createElement('td');
            runsCell.className = 'number-cell';
            runsCell.textContent = country.activityCount.toLocaleString();
            row.appendChild(runsCell);
            // Cities count
            const citiesCell = document.createElement('td');
            citiesCell.className = 'number-cell cities-col';
            citiesCell.textContent = country.cities.length.toString();
            row.appendChild(citiesCell);
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    }
    /**
     * Create cities table section
     */
    createCitiesSection(cities, showExport) {
        const section = document.createElement('div');
        // Section title with export button
        const titleDiv = document.createElement('div');
        titleDiv.className = 'section-title';
        const titleText = document.createElement('span');
        titleText.textContent = 'Cities';
        titleDiv.appendChild(titleText);
        if (showExport) {
            const exportBtn = document.createElement('button');
            exportBtn.className = 'export-btn';
            exportBtn.textContent = 'Export CSV';
            exportBtn.addEventListener('click', () => exportCitiesToCSV(cities));
            titleDiv.appendChild(exportBtn);
        }
        section.appendChild(titleDiv);
        // Create table
        const table = document.createElement('table');
        table.className = 'geo-table';
        // Table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const headers = [
            { text: 'Rank', className: 'rank-cell' },
            { text: 'City', className: '' },
            { text: 'Country', className: '' },
            { text: 'Distance (km)', className: 'number-cell' },
            { text: 'Runs', className: 'number-cell' }
        ];
        headers.forEach(({ text, className }) => {
            const th = document.createElement('th');
            th.textContent = text;
            if (className) {
                th.className = className;
            }
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        // Table body
        const tbody = document.createElement('tbody');
        cities.forEach((city, idx) => {
            const row = document.createElement('tr');
            // Rank
            const rankCell = document.createElement('td');
            rankCell.className = 'rank-cell';
            rankCell.textContent = (idx + 1).toString();
            row.appendChild(rankCell);
            // City name
            const cityCell = document.createElement('td');
            cityCell.className = 'city-cell';
            cityCell.textContent = city.cityName;
            row.appendChild(cityCell);
            // Country name
            const countryCell = document.createElement('td');
            countryCell.textContent = city.countryName;
            row.appendChild(countryCell);
            // Distance
            const distanceCell = document.createElement('td');
            distanceCell.className = 'number-cell';
            distanceCell.textContent = city.totalDistanceKm.toLocaleString();
            row.appendChild(distanceCell);
            // Runs
            const runsCell = document.createElement('td');
            runsCell.className = 'number-cell';
            runsCell.textContent = city.activityCount.toLocaleString();
            row.appendChild(runsCell);
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    }
}
// Register custom element
WidgetBase.register('strava-geo-stats', GeoStatsWidgetElement);
/**
 * Backwards-compatible global initialization function
 */
const GeoStatsWidget = {
    async init(containerId, config) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container element #${containerId} not found`);
        }
        // Create custom element
        const widget = document.createElement('strava-geo-stats');
        // Set attributes from config
        if (config.dataUrl) {
            widget.setAttribute('data-url', config.dataUrl);
        }
        if (config.options?.secondaryDataUrl) {
            widget.setAttribute('data-url-secondary', config.options.secondaryDataUrl);
        }
        if (config.options?.metadataUrl) {
            widget.setAttribute('data-url-metadata', config.options.metadataUrl);
        }
        if (config.options?.customTitle) {
            widget.setAttribute('data-title', config.options.customTitle);
        }
        if (config.options?.showTitle === false) {
            widget.setAttribute('data-show-title', 'false');
        }
        if (config.colors?.accent) {
            widget.setAttribute('data-accent', config.colors.accent);
        }
        if (config.size?.width) {
            widget.setAttribute('data-width', config.size.width);
        }
        if (config.size?.maxWidth) {
            widget.setAttribute('data-max-width', config.size.maxWidth);
        }
        // Append to container
        container.appendChild(widget);
    }
};
// Expose globally for backwards compatibility
window.GeoStatsWidget = GeoStatsWidget;
//# sourceMappingURL=index.js.map