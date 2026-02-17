declare module 'offline-geocoder' {
  interface GeocoderResult {
    id: number;
    name: string;
    formatted: string;
    country: {
      id: string;
      name: string;
    };
    admin1: {
      id: number;
      name: string;
    };
    coordinates: {
      latitude: number;
      longitude: number;
    };
  }

  interface GeocoderOptions {
    database?: string;
  }

  interface Geocoder {
    reverse(latitude: number, longitude: number, callback?: (error: Error | undefined, result: GeocoderResult) => void): Promise<GeocoderResult>;
  }

  function geocoder(options?: GeocoderOptions): Geocoder;

  export = geocoder;
}
