/**
 * Dashboard-native route map for the activity detail page (DETAIL-02).
 *
 * ============================================================================
 * LAZY-CHUNK BOUNDARY (D-25) — READ BEFORE ADDING AN IMPORT OF THIS FILE
 * ============================================================================
 * This module statically imports `leaflet`, `leaflet/dist/leaflet.css`, and
 * the shared `RouteRenderer` at its own top level. That is deliberate: the
 * lazy-load boundary for Leaflet is THIS MODULE, not a nested dynamic import
 * inside a function body. `detail.ts` (via plan 17-14) reaches this file only
 * through a dynamic `import('./detail-map.js')` call; Vite's code-splitting
 * then places Leaflet and its stylesheet into that async chunk instead of the
 * dashboard SPA's main entry chunk. Nothing outside that one dynamic import
 * may import this module statically — a stray top-level import of this file
 * anywhere else in the dashboard would pull Leaflet back into the main entry
 * chunk and silently defeat D-25.
 *
 * Confidence note (17-RESEARCH.md Assumption A1): Vite's async-CSS `<link>`
 * injection for a side-effect CSS import inside a dynamically-imported module
 * is documented, standard Vite behavior, but had never been exercised in this
 * repository before this phase. It is asserted structurally here — a plain
 * side-effect import, not the Shadow-DOM `?inline` variant used by the widget
 * system — and must be confirmed in a real browser during plan 17-15's
 * checkpoint.
 * ============================================================================
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import polylineCodec from '@mapbox/polyline';
import { RouteRenderer } from '../../widgets/shared/route-utils.js';
import type { RouteData } from '../../widgets/shared/route-utils.js';
import { pointAtDistanceFraction } from './detail-charts-logic.js';

export interface MountRouteMapOptions {
  polyline: string;
  startLat: number;
  startLng: number;
  accentColor: string;
  bgColor: string;
  activityName: string;
  distanceM: number;
  movingTimeSec: number;
  startDateLocal: string;
  /**
   * Optional raw activity id (Strava-numeric, or `i`-prefixed for the
   * intervals.icu era). Not part of the plan's originally pinned field list —
   * added because `RouteData.id` is typed `number` and the plan's own action
   * text calls for deriving it from the activity id, but the pinned
   * `MountRouteMapOptions` shape had no id field to derive it from. Optional,
   * so a caller that omits it still satisfies the type; `RouteData.id` falls
   * back to `0` in that case, which has no rendering effect since
   * `RouteRenderer.renderRoute` never reads `RouteData.id`.
   */
  activityId?: string;
}

export interface RouteMapHandle {
  /**
   * Moves the D-26 position marker to the point on the route interpolated by
   * cumulative distance at `fraction` (`[0, 1]`). Passing `null` removes the
   * marker from the map. Never re-decodes the polyline — the coordinate
   * array is decoded exactly once at mount (T-17-MAP-03).
   */
  setPositionByFraction(fraction: number | null): void;
  /** Tears down the Leaflet map instance and drops all references. Safe to call more than once. */
  destroy(): void;
}

/** D-26 honesty caveat — committed streams carry no lat/lng, so the marker is interpolated, not GPS-matched. */
const POSITION_CAVEAT_TEXT = 'Position is estimated from distance along the route, not GPS-matched.';

/**
 * Derives `RouteData.id` from an optional raw activity id string. Strips a
 * leading `i` (intervals.icu era) before parsing, and falls back to `0` when
 * the id is absent or not parseable — this field is unused by
 * `RouteRenderer.renderRoute`, so the fallback has no observable effect on
 * rendering; it exists purely to satisfy `RouteData`'s typed shape.
 */
function deriveRouteId(activityId: string | undefined): number {
  if (!activityId) return 0;
  const numericPortion = activityId.startsWith('i') ? activityId.slice(1) : activityId;
  const parsed = Number.parseInt(numericPortion, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Mounts a Leaflet route map, plus a programmatic circleMarker position
 * indicator, into `container`. This module issues no network request of its
 * own — every value it needs already lives in `options`, sourced from the
 * activity detail JSON the view already retrieved (D-23). The aggregated
 * multi-route dataset the widget system reads for its own map widgets is
 * intentionally never read here: it is oversized for rendering one route and
 * omits some activities, so the already-fetched detail JSON is the single
 * source of truth for this module.
 *
 * Reuses `RouteRenderer.renderRoute` for the actual polyline decode and
 * bounds-fit logic (D-24) rather than re-deriving either; the coordinate
 * array built here is a second, marker-only decode of the same polyline via
 * the same `@mapbox/polyline` codec `RouteRenderer` itself uses internally —
 * required because `RouteRenderer` does not expose its decoded coordinates,
 * and decoded exactly once (not per hover event, per T-17-MAP-03).
 */
export function mountRouteMap(container: HTMLElement, options: MountRouteMapOptions): RouteMapHandle {
  const canvas = document.createElement('div');
  canvas.className = 'route-map__canvas';
  container.appendChild(canvas);

  const map = L.map(canvas);
  RouteRenderer.addBasemapSwitcher(map);

  // Force Leaflet to recalculate tile positions once the canvas has taken on
  // its real, laid-out size — the same sequence single-run-map's widget uses.
  requestAnimationFrame(() => {
    map.invalidateSize();
  });

  const routeData: RouteData = {
    id: deriveRouteId(options.activityId),
    name: options.activityName,
    date: options.startDateLocal,
    distance: options.distanceM,
    movingTime: options.movingTimeSec,
    polyline: options.polyline,
    startLat: options.startLat,
    startLng: options.startLng,
  };

  RouteRenderer.renderRoute(map, routeData, {
    color: options.accentColor,
    weight: 4,
    opacity: 1.0,
    showPopup: false,
    fitBounds: true,
  });

  const coords: [number, number][] = polylineCodec.decode(options.polyline);

  let marker: L.CircleMarker | null = null;

  function setPositionByFraction(fraction: number | null): void {
    if (fraction === null) {
      if (marker) {
        marker.remove();
        marker = null;
      }
      return;
    }

    const point = pointAtDistanceFraction(coords, fraction);
    if (point === null) return; // Degenerate route (zero/one coordinate) — nothing to place.

    if (marker) {
      marker.setLatLng(point);
    } else {
      marker = L.circleMarker(point, {
        radius: 6,
        fillColor: options.accentColor,
        color: options.bgColor,
        weight: 2,
        fillOpacity: 1,
      }).addTo(map);
    }
  }

  const caveat = document.createElement('p');
  caveat.className = 'route-map__caveat';
  caveat.textContent = POSITION_CAVEAT_TEXT;
  container.appendChild(caveat);

  let destroyed = false;

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    marker = null;
    map.remove();
  }

  return { setPositionByFraction, destroy };
}
