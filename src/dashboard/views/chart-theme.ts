/**
 * Single source of chart colour resolution for every DASHBOARD VIEW
 * (`detail-charts.ts`, and Phase 18's `records-charts.ts`/`trends-charts.ts`).
 *
 * Colours are resolved from live CSS custom properties on
 * `document.documentElement` at mount time, so a theme switch (`data-theme`
 * flips) is reflected automatically without a hardcoded light/dark literal
 * table. The hardcoded light/dark table in `src/widgets/*\/chart-config.ts`
 * (e.g. `comparison-chart/chart-config.ts`, `streak-widget/chart-config.ts`)
 * is CORRECT there — those widgets render inside Shadow DOM and have no
 * access to the dashboard's `data-theme` attribute — but reproducing that
 * pattern here, where `data-theme` IS reachable, would be a regression.
 *
 * This module deliberately imports no charting library — it reads CSS
 * custom properties only. That keeps it importable from non-lazy code
 * without dragging Chart.js into the main bundle, which is why it lives as
 * its own file rather than an export off `detail-charts.ts` (a deliberate
 * lazy-chunk boundary per D-25 — see that file's header comment).
 */

/**
 * Reads a CSS custom property off `document.documentElement`, falling back
 * to `fallback` when the property is empty (e.g. a missing token) so a
 * theming gap degrades to a visible colour rather than an invisible chart.
 */
export function resolveToken(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

export interface ChannelPalette {
  pace: string;
  hr: string;
  cadence: string;
  elevation: string;
}

export function resolveChannelPalette(): ChannelPalette {
  return {
    pace: resolveToken('--chart-pace', '#fc4c02'),
    hr: resolveToken('--chart-hr', '#e11d48'),
    cadence: resolveToken('--chart-cadence', '#0891b2'),
    elevation: resolveToken('--chart-elevation', '#16a34a'),
  };
}

export interface ThemeColors {
  border: string;
  text: string;
  textSecondary: string;
}

export function resolveThemeColors(): ThemeColors {
  return {
    border: resolveToken('--border', '#e5e5e5'),
    text: resolveToken('--text', '#333333'),
    textSecondary: resolveToken('--text-secondary', '#666666'),
  };
}

/**
 * Converts a resolved `#rrggbb` (or `#rgb`) token into an `rgba(...)` string
 * at `alpha`. Every resolved token in this file's design-token contract is a
 * hex literal (styles.css), so a non-hex value degrades to opaque black
 * rather than producing an invalid canvas fill style.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.trim().replace('#', '');
  const expanded = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const parsed = parseInt(expanded, 16);
  if (expanded.length !== 6 || Number.isNaN(parsed)) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Fixed y-axis gutter width, in px, shared by every band.
 *
 * Chart.js sizes each chart's y-axis to ITS OWN widest tick label. Because the
 * pace band's labels (`10:00/km`) are far wider than heart rate's (`120`), each
 * band would otherwise reserve a different left gutter and start its plot area
 * at a different x — so the bands' x-axes would not line up vertically, and a
 * single screen x would map to a different distance/time per band, quietly
 * breaking the shared hover crosshair (D-26) as well as the visual alignment.
 *
 * Pinning one width across all bands makes the stacked bands share a common
 * left edge. 72px fits the widest label this file can produce (`10:00/km` at
 * the 14px tick font) with room for tick padding; any new channel whose labels
 * are wider must raise this number rather than remove the pin.
 */
export const Y_AXIS_WIDTH_PX = 72;
