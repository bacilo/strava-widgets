/**
 * Pin Map Widget - Displays geographic markers for cities and countries visited
 * Shows pins on world map with toggle between country/city view, clickable popups, and visual encoding
 */
import L from 'leaflet';
import leafletCSS from 'leaflet/dist/leaflet.css?inline';
import 'leaflet.markercluster';
import markerClusterCSS from 'leaflet.markercluster/dist/MarkerCluster.css?inline';
import markerClusterDefaultCSS from 'leaflet.markercluster/dist/MarkerCluster.Default.css?inline';
import { WidgetBase } from '../shared/widget-base.js';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
// Fix default marker icons (required for Vite)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
});
/**
 * PinMapWidgetElement - Renders pins for cities and countries on a world map
 */
class PinMapWidgetElement extends WidgetBase {
    map = null;
    markerLayer = null;
    viewMode = 'country';
    cities = [];
    countries = [];
    locationCache = null;
    activityCities = {};
    allRouteData = [];
    /**
     * Default data URL (fallback)
     */
    get dataUrl() {
        return 'data/geo/cities.json';
    }
    /**
     * Override to fetch multiple data sources
     */
    async fetchDataAndRender() {
        try {
            // Fetch all required data in parallel
            const [citiesData, countriesData, locationCacheData, activityCitiesData, routeListData] = await Promise.all([
                this.fetchData('data/geo/cities.json'),
                this.fetchData('data/geo/countries.json'),
                this.fetchData('data/geo/location-cache.json'),
                this.fetchData('data/geo/activity-cities.json'),
                this.fetchData('data/routes/route-list.json'),
            ]);
            // Store in instance properties
            this.cities = citiesData;
            this.countries = countriesData;
            this.locationCache = locationCacheData;
            this.activityCities = activityCitiesData;
            this.allRouteData = routeListData;
            // Get initial view mode from attribute
            const viewAttr = this.getAttribute('data-view');
            this.viewMode = (viewAttr === 'city' || viewAttr === 'country') ? viewAttr : 'country';
            // Clear loading message
            if (this.shadowRoot) {
                const loadingEl = this.shadowRoot.querySelector('.widget-loading');
                if (loadingEl) {
                    loadingEl.remove();
                }
            }
            // Render the widget
            this.render(citiesData);
        }
        catch (error) {
            console.error('PinMapWidget: Failed to load data', error);
            this.showError();
        }
    }
    /**
     * Render the map with pins
     */
    render(data) {
        if (!this.shadowRoot)
            return;
        // Clear shadow DOM content except style elements
        const styles = Array.from(this.shadowRoot.querySelectorAll('style'));
        this.shadowRoot.innerHTML = '';
        styles.forEach(style => this.shadowRoot.appendChild(style));
        // Inject Leaflet CSS into Shadow DOM
        const leafletStyle = document.createElement('style');
        leafletStyle.textContent = leafletCSS;
        this.shadowRoot.appendChild(leafletStyle);
        // Inject MarkerCluster CSS into Shadow DOM
        const markerClusterStyle = document.createElement('style');
        markerClusterStyle.textContent = markerClusterCSS;
        this.shadowRoot.appendChild(markerClusterStyle);
        const markerClusterDefaultStyle = document.createElement('style');
        markerClusterDefaultStyle.textContent = markerClusterDefaultCSS;
        this.shadowRoot.appendChild(markerClusterDefaultStyle);
        // Get height from data-height attribute (default 500px)
        const height = this.getAttribute('data-height') || '500px';
        // Create wrapper div
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        // Create map container
        const container = document.createElement('div');
        container.style.width = '100%';
        container.style.height = height;
        container.style.borderRadius = '8px';
        container.style.overflow = 'hidden';
        wrapper.appendChild(container);
        this.shadowRoot.appendChild(wrapper);
        // Initialize Leaflet map
        this.map = L.map(container).setView([30, 0], 2); // World view
        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(this.map);
        // Force Leaflet to recalculate tile positions after Shadow DOM layout
        requestAnimationFrame(() => {
            this.map?.invalidateSize();
        });
        // Render pins based on view mode
        this.renderPins();
        // Add toggle controls and append to wrapper
        const controls = this.renderToggleControls();
        wrapper.appendChild(controls);
    }
    /**
     * Render pins based on current view mode
     */
    renderPins() {
        // Remove existing marker layer if exists
        if (this.markerLayer) {
            this.markerLayer.remove();
            this.markerLayer = null;
        }
        if (this.viewMode === 'country') {
            this.renderCountryPins();
        }
        else {
            this.renderCityPins();
        }
    }
    /**
     * Render country-level pins
     */
    renderCountryPins() {
        if (!this.map)
            return;
        const layerGroup = L.layerGroup();
        for (const country of this.countries) {
            const coords = this.getCountryCoordinates(country);
            if (!coords) {
                console.warn(`No coordinates found for country: ${country.countryName}`);
                continue;
            }
            const marker = this.createScaledMarker(coords, country.activityCount, country.totalDistanceKm);
            marker.bindPopup(this.formatCountryPopup(country));
            marker.addTo(layerGroup);
        }
        layerGroup.addTo(this.map);
        this.markerLayer = layerGroup;
    }
    /**
     * Render city-level pins with clustering
     */
    renderCityPins() {
        if (!this.map)
            return;
        const clusterGroup = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
        });
        for (const city of this.cities) {
            const coords = this.getCityCoordinates(city.cityName, city.countryIso2);
            if (!coords) {
                console.warn(`No coordinates found for city: ${city.cityName}, ${city.countryIso2}`);
                continue;
            }
            const marker = this.createScaledMarker(coords, city.activityCount, city.totalDistanceKm);
            marker.bindPopup(this.formatCityPopup(city));
            marker.addTo(clusterGroup);
        }
        clusterGroup.addTo(this.map);
        this.markerLayer = clusterGroup;
    }
    /**
     * Get coordinates for a country (average of all city coordinates)
     */
    getCountryCoordinates(country) {
        if (!this.locationCache)
            return null;
        const matchingCoords = [];
        for (const [coordKey, entry] of Object.entries(this.locationCache.entries)) {
            if (entry.countryIso2 === country.countryIso2) {
                const [lat, lng] = coordKey.split(',').map(parseFloat);
                if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    matchingCoords.push([lat, lng]);
                }
            }
        }
        if (matchingCoords.length === 0)
            return null;
        // Calculate average
        const avgLat = matchingCoords.reduce((sum, c) => sum + c[0], 0) / matchingCoords.length;
        const avgLng = matchingCoords.reduce((sum, c) => sum + c[1], 0) / matchingCoords.length;
        return [avgLat, avgLng];
    }
    /**
     * Get coordinates for a city
     */
    getCityCoordinates(cityName, countryIso2) {
        if (!this.locationCache)
            return null;
        // Try exact match first
        for (const [coordKey, entry] of Object.entries(this.locationCache.entries)) {
            if (entry.cityName === cityName && entry.countryIso2 === countryIso2) {
                const [lat, lng] = coordKey.split(',').map(parseFloat);
                if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    return [lat, lng];
                }
            }
        }
        // Fuzzy fallback: case-insensitive partial match
        const cityNameLower = cityName.toLowerCase();
        for (const [coordKey, entry] of Object.entries(this.locationCache.entries)) {
            if (entry.cityName.toLowerCase().includes(cityNameLower) && entry.countryIso2 === countryIso2) {
                const [lat, lng] = coordKey.split(',').map(parseFloat);
                if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    return [lat, lng];
                }
            }
        }
        return null;
    }
    /**
     * Create a scaled marker with size and color encoding
     */
    createScaledMarker(coords, activityCount, totalDistanceKm) {
        // Calculate max activities for dynamic scaling
        const maxActivities = Math.max(...this.cities.map(c => c.activityCount));
        // Scale size: 1-maxActivities -> 20-60px
        const minSize = 20;
        const maxSize = 60;
        const size = minSize + ((activityCount - 1) / (maxActivities - 1)) * (maxSize - minSize);
        // Get color based on distance
        const color = this.getDistanceColor(totalDistanceKm);
        // Create custom div icon
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${color};
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${Math.max(10, size * 0.3)}px;
      ">${activityCount}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
        return L.marker(coords, { icon });
    }
    /**
     * Get color based on distance quintiles
     */
    getDistanceColor(distanceKm) {
        if (distanceKm > 5000)
            return '#fc4c02'; // Strava orange
        if (distanceKm > 2000)
            return '#ff6b35';
        if (distanceKm > 1000)
            return '#f7931e';
        if (distanceKm > 500)
            return '#fdc500';
        return '#4ecdc4'; // Teal
    }
    /**
     * Format popup HTML for country
     */
    formatCountryPopup(country) {
        const dateRange = this.getVisitDateRange(country.cities);
        const dateStr = dateRange
            ? `${this.formatDate(dateRange.first)} - ${this.formatDate(dateRange.last)}`
            : 'Unknown';
        return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px;">${country.countryName}</h3>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Activities:</strong> ${country.activityCount}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Distance:</strong> ${country.totalDistanceKm.toFixed(1)} km</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Visited:</strong> ${dateStr}</p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;"><strong>Cities:</strong> ${country.cities.join(', ')}</p>
      </div>
    `;
    }
    /**
     * Format popup HTML for city
     */
    formatCityPopup(city) {
        const dateRange = this.getVisitDateRange([city.cityName]);
        const dateStr = dateRange
            ? `${this.formatDate(dateRange.first)} - ${this.formatDate(dateRange.last)}`
            : 'Unknown';
        return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px;">${city.cityName}</h3>
        <p style="margin: 4px 0; font-size: 14px; color: #666;">${city.countryName}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Activities:</strong> ${city.activityCount}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Distance:</strong> ${city.totalDistanceKm.toFixed(1)} km</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Visited:</strong> ${dateStr}</p>
      </div>
    `;
    }
    /**
     * Get visit date range for given cities
     */
    getVisitDateRange(cityNames) {
        const matchingDates = [];
        // Find all activities that visited any of these cities
        for (const [activityId, cities] of Object.entries(this.activityCities)) {
            const hasMatch = cities.some(city => cityNames.includes(city));
            if (hasMatch) {
                // Find the route data for this activity
                const route = this.allRouteData.find(r => r.id.toString() === activityId);
                if (route) {
                    matchingDates.push(new Date(route.date));
                }
            }
        }
        if (matchingDates.length === 0)
            return null;
        // Sort dates
        matchingDates.sort((a, b) => a.getTime() - b.getTime());
        return {
            first: matchingDates[0],
            last: matchingDates[matchingDates.length - 1],
        };
    }
    /**
     * Format date as "Mon YYYY"
     */
    formatDate(date) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
    }
    /**
     * Render toggle controls for switching between country/city view
     */
    renderToggleControls() {
        const container = document.createElement('div');
        container.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 1000;
      background: white;
      padding: 8px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      display: flex;
      gap: 8px;
    `;
        const countryBtn = document.createElement('button');
        countryBtn.textContent = `Countries (${this.countries.length})`;
        countryBtn.style.cssText = `
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    `;
        const cityBtn = document.createElement('button');
        cityBtn.textContent = `Cities (${this.cities.length})`;
        cityBtn.style.cssText = `
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    `;
        // Update button styles based on active view
        const updateButtonStyles = () => {
            if (this.viewMode === 'country') {
                countryBtn.style.background = '#fc4c02';
                countryBtn.style.color = 'white';
                cityBtn.style.background = '#f0f0f0';
                cityBtn.style.color = '#333';
            }
            else {
                cityBtn.style.background = '#fc4c02';
                cityBtn.style.color = 'white';
                countryBtn.style.background = '#f0f0f0';
                countryBtn.style.color = '#333';
            }
        };
        // Initialize button styles
        updateButtonStyles();
        // Add click handlers
        countryBtn.addEventListener('click', () => {
            this.viewMode = 'country';
            updateButtonStyles();
            this.renderPins();
        });
        cityBtn.addEventListener('click', () => {
            this.viewMode = 'city';
            updateButtonStyles();
            this.renderPins();
        });
        container.appendChild(countryBtn);
        container.appendChild(cityBtn);
        return container;
    }
    /**
     * Clean up map when element is disconnected
     */
    disconnectedCallback() {
        if (this.markerLayer) {
            this.markerLayer.remove();
            this.markerLayer = null;
        }
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        super.disconnectedCallback();
    }
}
// Register custom element
WidgetBase.register('pin-map-widget', PinMapWidgetElement);
//# sourceMappingURL=index.js.map