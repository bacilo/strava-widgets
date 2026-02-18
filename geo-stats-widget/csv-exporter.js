/**
 * CSV Export utilities for geographic statistics
 * Handles CSV generation with UTF-8 BOM for Excel compatibility
 */
/**
 * Export countries data to CSV file
 */
export function exportCountriesToCSV(countries) {
    // Generate CSV content
    const headers = ['Rank', 'Country', 'ISO Code', 'Distance (km)', 'Runs', 'Cities'];
    const rows = countries.map((country, idx) => [
        (idx + 1).toString(),
        country.countryName,
        country.countryIso2,
        country.totalDistanceKm.toString(),
        country.activityCount.toString(),
        country.cities.length.toString()
    ]);
    // Build CSV with quoted fields
    const csvLines = [
        headers.map(h => `"${h}"`).join(','),
        ...rows.map(row => row.map(field => `"${field}"`).join(','))
    ];
    // Prepend UTF-8 BOM for Excel compatibility
    const csvContent = '\uFEFF' + csvLines.join('\n');
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    // Generate filename with current date
    const date = new Date().toISOString().split('T')[0];
    const filename = `running-stats-countries-${date}.csv`;
    // Create temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    // Append to body for cross-browser compatibility
    document.body.appendChild(link);
    link.click();
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
/**
 * Export cities data to CSV file
 */
export function exportCitiesToCSV(cities) {
    // Generate CSV content
    const headers = ['Rank', 'City', 'Country', 'ISO Code', 'Distance (km)', 'Runs'];
    const rows = cities.map((city, idx) => [
        (idx + 1).toString(),
        city.cityName,
        city.countryName,
        city.countryIso2,
        city.totalDistanceKm.toString(),
        city.activityCount.toString()
    ]);
    // Build CSV with quoted fields
    const csvLines = [
        headers.map(h => `"${h}"`).join(','),
        ...rows.map(row => row.map(field => `"${field}"`).join(','))
    ];
    // Prepend UTF-8 BOM for Excel compatibility
    const csvContent = '\uFEFF' + csvLines.join('\n');
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    // Generate filename with current date
    const date = new Date().toISOString().split('T')[0];
    const filename = `running-stats-cities-${date}.csv`;
    // Create temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    // Append to body for cross-browser compatibility
    document.body.appendChild(link);
    link.click();
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
//# sourceMappingURL=csv-exporter.js.map