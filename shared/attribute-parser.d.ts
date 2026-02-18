/**
 * Type-safe attribute parsing utilities for Web Components
 * Pure functions with explicit error handling and console warnings
 */
/**
 * Parse boolean attribute using presence detection
 * @param element The host element
 * @param attrName The data-attribute name (e.g., 'data-show-title')
 * @param defaultValue Default value if attribute is not present
 * @returns true if attribute exists, false otherwise
 */
export declare function parseBoolean(element: HTMLElement, attrName: string, defaultValue?: boolean): boolean;
/**
 * Parse numeric attribute with validation and clamping
 * @param value String value from getAttribute() (can be null)
 * @param defaultValue Default value if invalid or null
 * @param min Optional minimum value (clamp)
 * @param max Optional maximum value (clamp)
 * @returns Parsed number or default if invalid
 */
export declare function parseNumber(value: string | null, defaultValue: number, min?: number, max?: number): number;
/**
 * Parse JSON attribute with try/catch fallback
 * @param value String value from getAttribute() (can be null)
 * @param defaultValue Default value if parsing fails or null
 * @returns Parsed object or default if invalid JSON
 */
export declare function parseJSON<T>(value: string | null, defaultValue: T): T;
/**
 * Parse and validate color value using browser's CSS parser
 * @param value String color value from getAttribute() (can be null)
 * @param defaultValue Default color if invalid or null
 * @returns Valid CSS color or default
 */
export declare function parseColor(value: string | null, defaultValue: string): string;
/**
 * Parse enum attribute with whitelist validation
 * @param value String value from getAttribute() (can be null)
 * @param allowedValues Array of allowed values
 * @param defaultValue Default value if not in allowedValues or null
 * @returns Value from allowedValues or default
 */
export declare function parseEnum<T extends string>(value: string | null, allowedValues: readonly T[], defaultValue: T): T;
/**
 * Parse CSS value with automatic px unit for pure numbers
 * @param value String value from getAttribute() (can be null)
 * @param defaultValue Default CSS value if null
 * @returns CSS value with units or default
 */
export declare function parseCSSValue(value: string | null, defaultValue: string): string;
//# sourceMappingURL=attribute-parser.d.ts.map