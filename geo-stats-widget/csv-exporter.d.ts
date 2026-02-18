/**
 * CSV Export utilities for geographic statistics
 * Handles CSV generation with UTF-8 BOM for Excel compatibility
 */
export interface CountryStats {
    countryName: string;
    countryIso2: string;
    activityCount: number;
    totalDistanceKm: number;
    cities: string[];
}
export interface CityStats {
    cityName: string;
    countryName: string;
    countryIso2: string;
    activityCount: number;
    totalDistanceKm: number;
}
/**
 * Export countries data to CSV file
 */
export declare function exportCountriesToCSV(countries: CountryStats[]): void;
/**
 * Export cities data to CSV file
 */
export declare function exportCitiesToCSV(cities: CityStats[]): void;
//# sourceMappingURL=csv-exporter.d.ts.map