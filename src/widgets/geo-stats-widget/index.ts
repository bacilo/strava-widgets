/**
 * Geographic Statistics Widget
 * Displays country and city rankings with distance data and CSV export
 */

import { WidgetBase } from '../shared/widget-base.js';
import { WidgetConfig } from '../../types/widget-config.types.js';
import {
  exportCountriesToCSV,
  exportCitiesToCSV,
  CountryStats,
  CityStats
} from './csv-exporter.js';

interface GeoMetadata {
  generatedAt: string;
  totalActivities: number;
  geocodedActivities: number;
  coveragePercent: number;
  cacheSize: number;
  totalDistanceKm: number;
}

// Geo stats widget specific styles
const GEO_STATS_STYLES = `
.geo-stats-card {
  background: var(--widget-bg, #ffffff);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 24px;
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
.geo-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
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
.geo-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
}
.geo-table tr:last-child td {
  border-bottom: none;
}
.rank-cell {
  color: #999;
  font-weight: 500;
  width: 40px;
}
.number-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.country-cell, .city-cell {
  font-weight: 500;
}
`;

class GeoStatsWidgetClass extends WidgetBase<CountryStats[]> {
  private citiesData: CityStats[] = [];
  private metadataData: GeoMetadata | null = null;

  constructor(containerId: string, config: WidgetConfig) {
    super(containerId, config, true);
  }

  /**
   * Render the geographic statistics widget
   */
  protected render(countries: CountryStats[]): void {
    if (!this.shadowRoot) return;

    // Inject widget-specific styles
    const styleElement = document.createElement('style');
    styleElement.textContent = GEO_STATS_STYLES;
    this.shadowRoot.appendChild(styleElement);

    // Create card container
    const card = document.createElement('div');
    card.className = 'geo-stats-card';

    // Add title if enabled
    if (this.config.options?.showTitle !== false) {
      const title = document.createElement('h2');
      title.className = 'card-title';
      title.textContent = this.config.options?.customTitle || 'Running by Location';
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
    const countriesSection = this.createCountriesSection(countries);
    card.appendChild(countriesSection);

    // Render Cities section
    const citiesSection = this.createCitiesSection(this.citiesData);
    card.appendChild(citiesSection);

    this.shadowRoot.appendChild(card);
  }

  /**
   * Create countries table section
   */
  private createCountriesSection(countries: CountryStats[]): HTMLElement {
    const section = document.createElement('div');

    // Section title with export button
    const titleDiv = document.createElement('div');
    titleDiv.className = 'section-title';

    const titleText = document.createElement('span');
    titleText.textContent = 'Countries';
    titleDiv.appendChild(titleText);

    const exportBtn = document.createElement('button');
    exportBtn.className = 'export-btn';
    exportBtn.textContent = 'Export CSV';
    exportBtn.addEventListener('click', () => exportCountriesToCSV(countries));
    titleDiv.appendChild(exportBtn);

    section.appendChild(titleDiv);

    // Create table
    const table = document.createElement('table');
    table.className = 'geo-table';

    // Table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const headers = ['Rank', 'Country', 'Distance (km)', 'Runs', 'Cities'];
    headers.forEach((headerText, idx) => {
      const th = document.createElement('th');
      th.textContent = headerText;

      // Apply specific classes for alignment
      if (idx === 0) th.className = 'rank-cell';
      if (idx >= 2) th.className = 'number-cell';

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
      citiesCell.className = 'number-cell';
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
  private createCitiesSection(cities: CityStats[]): HTMLElement {
    const section = document.createElement('div');

    // Section title with export button
    const titleDiv = document.createElement('div');
    titleDiv.className = 'section-title';

    const titleText = document.createElement('span');
    titleText.textContent = 'Cities';
    titleDiv.appendChild(titleText);

    const exportBtn = document.createElement('button');
    exportBtn.className = 'export-btn';
    exportBtn.textContent = 'Export CSV';
    exportBtn.addEventListener('click', () => exportCitiesToCSV(cities));
    titleDiv.appendChild(exportBtn);

    section.appendChild(titleDiv);

    // Create table
    const table = document.createElement('table');
    table.className = 'geo-table';

    // Table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const headers = ['Rank', 'City', 'Country', 'Distance (km)', 'Runs'];
    headers.forEach((headerText, idx) => {
      const th = document.createElement('th');
      th.textContent = headerText;

      // Apply specific classes for alignment
      if (idx === 0) th.className = 'rank-cell';
      if (idx >= 3) th.className = 'number-cell';

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

/**
 * Global initialization function
 */
const GeoStatsWidget = {
  async init(containerId: string, config: WidgetConfig): Promise<void> {
    const widget = new GeoStatsWidgetClass(containerId, config);
    try {
      // Fetch all three data sources
      const [countries, cities, metadata] = await Promise.all([
        widget['fetchData']<CountryStats[]>(config.dataUrl),
        config.options?.secondaryDataUrl
          ? widget['fetchData']<CityStats[]>(config.options.secondaryDataUrl)
          : Promise.resolve([]),
        config.options?.metadataUrl
          ? widget['fetchData']<GeoMetadata>(config.options.metadataUrl)
          : Promise.resolve(null)
      ]);

      // Store secondary data on widget instance
      widget['citiesData'] = cities;
      widget['metadataData'] = metadata;

      // Clear loading
      if (widget['shadowRoot']) {
        const loadingEl = widget['shadowRoot'].querySelector('.widget-loading');
        if (loadingEl) loadingEl.remove();
      }

      widget['render'](countries);
    } catch (error) {
      console.error('GeoStatsWidget: Failed to load data', error);
      widget['showError']();
    }
  }
};

// Expose globally
(window as any).GeoStatsWidget = GeoStatsWidget;
