/**
 * TypeScript declarations for @mapbox/polyline
 *
 * CommonJS module for encoding/decoding Google Polyline format
 */

declare module '@mapbox/polyline' {
  /**
   * Decode a Google Polyline string into an array of [lat, lng] coordinates
   * @param str - Encoded polyline string
   * @param precision - Decimal precision (default: 5)
   * @returns Array of [latitude, longitude] pairs
   */
  export function decode(str: string, precision?: number): [number, number][];

  /**
   * Encode an array of [lat, lng] coordinates into a Google Polyline string
   * @param coords - Array of [latitude, longitude] pairs
   * @param precision - Decimal precision (default: 5)
   * @returns Encoded polyline string
   */
  export function encode(coords: [number, number][], precision?: number): string;

  const polyline: {
    decode: typeof decode;
    encode: typeof encode;
  };

  export default polyline;
}
