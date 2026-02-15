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
export function parseBoolean(
  element: HTMLElement,
  attrName: string,
  defaultValue: boolean = false
): boolean {
  return element.hasAttribute(attrName) ? true : defaultValue;
}

/**
 * Parse numeric attribute with validation and clamping
 * @param value String value from getAttribute() (can be null)
 * @param defaultValue Default value if invalid or null
 * @param min Optional minimum value (clamp)
 * @param max Optional maximum value (clamp)
 * @returns Parsed number or default if invalid
 */
export function parseNumber(
  value: string | null,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  if (!value) return defaultValue;

  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    console.warn(`Invalid number: "${value}", using default: ${defaultValue}`);
    return defaultValue;
  }

  // Range validation with clamping
  if (min !== undefined && parsed < min) {
    console.warn(`Number ${parsed} below minimum ${min}, clamping to ${min}`);
    return min;
  }
  if (max !== undefined && parsed > max) {
    console.warn(`Number ${parsed} above maximum ${max}, clamping to ${max}`);
    return max;
  }

  return parsed;
}

/**
 * Parse JSON attribute with try/catch fallback
 * @param value String value from getAttribute() (can be null)
 * @param defaultValue Default value if parsing fails or null
 * @returns Parsed object or default if invalid JSON
 */
export function parseJSON<T>(value: string | null, defaultValue: T): T {
  if (!value) return defaultValue;

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn(`Invalid JSON: "${value}", using default:`, defaultValue);
    return defaultValue;
  }
}

/**
 * Parse and validate color value using browser's CSS parser
 * @param value String color value from getAttribute() (can be null)
 * @param defaultValue Default color if invalid or null
 * @returns Valid CSS color or default
 */
export function parseColor(value: string | null, defaultValue: string): string {
  if (!value) return defaultValue;

  // Use browser's CSS parser to validate color
  const div = document.createElement('div');
  div.style.color = value;

  // If browser accepted it, style.color will be set (not empty string)
  if (div.style.color) {
    return value;
  }

  console.warn(`Invalid color: "${value}", using default: ${defaultValue}`);
  return defaultValue;
}

/**
 * Parse enum attribute with whitelist validation
 * @param value String value from getAttribute() (can be null)
 * @param allowedValues Array of allowed values
 * @param defaultValue Default value if not in allowedValues or null
 * @returns Value from allowedValues or default
 */
export function parseEnum<T extends string>(
  value: string | null,
  allowedValues: readonly T[],
  defaultValue: T
): T {
  if (!value) return defaultValue;

  if (allowedValues.includes(value as T)) {
    return value as T;
  }

  console.warn(
    `Invalid enum value: "${value}", allowed: [${allowedValues.join(', ')}], using default: ${defaultValue}`
  );
  return defaultValue;
}

/**
 * Parse CSS value with automatic px unit for pure numbers
 * @param value String value from getAttribute() (can be null)
 * @param defaultValue Default CSS value if null
 * @returns CSS value with units or default
 */
export function parseCSSValue(value: string | null, defaultValue: string): string {
  if (!value) return defaultValue;

  // Check if pure number (no units)
  const numericValue = parseFloat(value);
  if (!isNaN(numericValue) && numericValue.toString() === value.trim()) {
    return `${numericValue}px`;
  }

  // Check if contains valid CSS units (%, px, em, rem, vh, vw, etc.)
  const cssUnitsPattern = /^-?\d*\.?\d+(px|%|em|rem|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc)$/i;
  if (cssUnitsPattern.test(value.trim())) {
    return value.trim();
  }

  // Return as-is for other valid CSS values (calc(), var(), etc.)
  return value;
}
