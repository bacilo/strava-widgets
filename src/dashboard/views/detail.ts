/**
 * Activity detail view (DETAIL-01..05, BROWSE-06) — the full activity page:
 * stats header with gear resolution, prev/next archive navigation, route
 * map, stacked chart bands, splits table, and pace/zone breakdown.
 *
 * The route map (`detail-map.ts`) and chart bands (`detail-charts.ts`) are
 * reached ONLY through `await import(...)` (D-25) — Leaflet and Chart.js
 * never enter the dashboard's main entry chunk. Every await point in the
 * render path (detail fetch, gear load, athlete-config load, and both
 * dynamic imports plus their mount calls) is guarded by the same
 * `myToken !== requestToken || mountedContainer !== container` stale-render
 * check, so a fast activity-to-activity navigation never paints a
 * superseded result and never leaks a Leaflet map or Chart.js instance into
 * a detached container. Hovering a chart band moves the route map's
 * position marker (D-26) via `onHover` calling `routeMapHandle`'s
 * `setPositionByFraction` — a harmless no-op when the map never mounted.
 */

import type { DashboardView, ViewMountContext } from '../view.types.js';
import { ROUTES } from '../view.types.js';
import { isValidActivityId } from '../router.js';
import type { DetailClient, ActivityDetail } from '../data/detail-client.js';
import type { IndexClient } from '../data/index-client.js';
import type { GearClient } from '../data/gear-client.js';
import { resolveGearLabel } from '../data/gear-client.js';
import type { AthleteConfigClient } from '../data/athlete-config-client.js';
import type { AgeGradingClient } from '../data/age-grading-client.js';
import { createAgeGradingClient } from '../data/age-grading-client.js';
import type { BestEffortsClient } from '../data/best-efforts-client.js';
import { createBestEffortsClient } from '../data/best-efforts-client.js';
// formatPace/formatActivityDate/formatDurationHms/noteViewedActivity/
// appendBadge are the dashboard's single formatter/list-highlight/badge
// sources (list.ts) — imported rather than duplicated, matching the
// precedent already set for formatPace and formatActivityDate. The private
// formatDurationHms this file used to keep is deleted; this is the only
// copy in the dashboard now.
import { formatActivityDate, formatPace, formatDurationHms, noteViewedActivity, appendBadge } from './list.js';
import { computeSplits } from './detail-splits.js';
import { computePaceDistribution, computeHrZoneTimes } from './detail-zones.js';
import { buildSplitsSection, buildBreakdownSection, buildBestEffortsSection } from './detail-sections.js';
import { buildPrBadgeLabels, buildBestEffortsPanelRows } from './detail-best-efforts-logic.js';
// buildExclusionReasonIndex is records-logic.ts's pure, __proto__-safe
// exclusion-reason parser (18-09) — reused here rather than duplicated, the
// same single-source discipline as the badge/formatter imports above.
import { buildExclusionReasonIndex } from './records-logic.js';
import type { CanonicalStream } from '../../streams/stream.types.js';
import type { StravaActivity } from '../../types/strava.types.js';
// @mapbox/polyline is a small, DOM-free decode library — not part of the
// D-25 restriction (Leaflet/Chart.js only) — used here purely as a
// startLat/startLng fallback when `activity.start_latlng` is absent.
import polylineCodec from '@mapbox/polyline';

const DASH = '—';

// ---------------------------------------------------------------------------
// D-25 lazy-module type aliases. `typeof import(...)` is a type-only query —
// it erases completely at compile time and produces no runtime import, so
// declaring these does NOT pull detail-map.ts/detail-charts.ts (and
// therefore Leaflet/Chart.js) into this file's static import graph. The
// actual VALUE import happens only inside `tryImportDetailMap`/
// `tryImportDetailCharts` below, via `await import(...)`.
// ---------------------------------------------------------------------------
type RouteMapModule = typeof import('./detail-map.js');
type ChartsModule = typeof import('./detail-charts.js');
type RouteMapHandle = ReturnType<RouteMapModule['mountRouteMap']>;
type ChartBandsHandle = ReturnType<ChartsModule['mountChartBands']>;

/** Import `detail-map.ts` behind a try/catch — a failed chunk load degrades, never throws into the caller. */
async function tryImportDetailMap(): Promise<RouteMapModule | null> {
  try {
    return await import('./detail-map.js');
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** Import `detail-charts.ts` behind a try/catch — a failed chunk load degrades, never throws into the caller. */
async function tryImportDetailCharts(): Promise<ChartsModule | null> {
  try {
    return await import('./detail-charts.js');
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * Shared failure UI for a heavy-module import that threw outright — mirrors
 * `detail.ts`'s own `renderErrorState` and `detail-map.ts`'s
 * `renderMapErrorState` markup (`.error-state` + `.text-heading` +
 * `.text-body` + `.cta` Retry), used only when the dynamic import itself
 * fails (before the imported module's own state renderers are reachable).
 */
function renderHeavySectionError(container: HTMLElement, heading: string, onRetry: () => void): void {
  container.replaceChildren();

  const errorState = document.createElement('section');
  errorState.className = 'error-state';

  const headingEl = document.createElement('h3');
  headingEl.className = 'text-heading';
  headingEl.textContent = heading;
  errorState.appendChild(headingEl);

  const body = document.createElement('p');
  body.className = 'text-body';
  body.textContent = 'Check your connection and try again.';
  errorState.appendChild(body);

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'cta';
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', onRetry);
  errorState.appendChild(retryBtn);

  container.appendChild(errorState);
}

/** Maps `undefined`, `null`, and `NaN` (or a non-number, since `StravaActivity`'s index signature widens unknown fields) to `null`. */
function numOrNull(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value;
}

function formatOrDash(value: number | null, formatter: (v: number) => string): string {
  return value === null ? DASH : formatter(value);
}

/**
 * Builds one stat-grid tile. `titleAttr`, when given, carries a unit/semantics
 * note that doesn't fit the tile's own short label (e.g. Cadence's
 * "rpm, single-leg" note) — set on the whole tile as a native tooltip rather
 * than shown inline, so the tile-grid label stays a single 4-role Label size.
 */
function buildStatCard(value: string, label: string, titleAttr?: string): HTMLElement {
  const wrapper = document.createElement('div');
  if (titleAttr) wrapper.title = titleAttr;
  const valueEl = document.createElement('div');
  valueEl.className = 'text-display';
  valueEl.textContent = value;
  const labelEl = document.createElement('div');
  labelEl.className = 'text-label';
  labelEl.textContent = label;
  wrapper.appendChild(valueEl);
  wrapper.appendChild(labelEl);
  return wrapper;
}

/**
 * Renders the UI-SPEC error state. `onRetry` re-runs the load flow (present
 * only for a genuine fetch failure); `backToList` offers the drill-out CTA
 * used for an invalid route id, where retrying the same malformed URL
 * cannot succeed.
 */
function renderErrorState(
  container: HTMLElement,
  options: { onRetry?: () => void; backToList?: boolean }
): void {
  container.replaceChildren();

  const errorState = document.createElement('section');
  errorState.className = 'error-state';

  const heading = document.createElement('h2');
  heading.className = 'text-heading';
  heading.textContent = "Couldn't load this activity";
  errorState.appendChild(heading);

  const body = document.createElement('p');
  body.className = 'text-body';
  body.textContent = 'Check your connection and try again.';
  errorState.appendChild(body);

  if (options.onRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'cta';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', options.onRetry);
    errorState.appendChild(retryBtn);
  }

  if (options.backToList) {
    const backCta = document.createElement('a');
    backCta.className = 'cta';
    backCta.textContent = 'Browse Activities';
    backCta.href = `#${ROUTES.LIST}`;
    errorState.appendChild(backCta);
  }

  container.appendChild(errorState);
}

/**
 * Builds the 17-UI-SPEC § 5 prev/next nav — "‹ Newer" / "Older ›" — resolved
 * from the full, unfiltered archive (`indexClient.getRows()`, documented as
 * ordered newest-first by `compute-dashboard-index.ts`). Since the array is
 * newest-first, the row immediately BEFORE the current index is the newer
 * neighbour and the row immediately AFTER is the older one. Either link is
 * simply omitted at the archive's start/end rather than rendered disabled;
 * returns `null` entirely when the current activity isn't in the (possibly
 * not-yet-loaded) index, so a fast deep link never renders a broken nav.
 */
function buildDetailNav(indexClient: IndexClient, currentId: string): HTMLElement | null {
  const rows = indexClient.getRows();
  const idx = rows.findIndex((row) => row.id === currentId);
  if (idx === -1) return null;

  const newer = idx > 0 ? rows[idx - 1] : undefined;
  const older = idx < rows.length - 1 ? rows[idx + 1] : undefined;
  if (!newer && !older) return null;

  const nav = document.createElement('div');
  nav.className = 'detail-nav';

  if (newer) {
    const link = document.createElement('a');
    link.href = `#/activity/${newer.id}`;
    link.textContent = '‹ Newer';
    nav.appendChild(link);
  }

  if (older) {
    const link = document.createElement('a');
    link.href = `#/activity/${older.id}`;
    link.textContent = 'Older ›';
    nav.appendChild(link);
  }

  return nav;
}

/**
 * Preserves the useful half of the deleted Phase-16 `buildStreamSummaryCard`
 * — the reason badge — without its debug fields (Samples/Channels/Distance
 * Source), for the 23 manual entries and other stream-unavailable
 * activities where splits/breakdown cannot be computed at all.
 */
function buildNoStreamSection(reason: string | undefined): HTMLElement {
  const section = document.createElement('section');
  section.className = 'card detail-section';

  const heading = document.createElement('h2');
  heading.className = 'text-heading';
  heading.textContent = 'No recorded stream';
  section.appendChild(heading);

  const body = document.createElement('p');
  body.className = 'text-body';
  body.textContent = reason
    ? `This activity has no recorded time or distance stream (reason: ${reason}).`
    : 'This activity has no recorded time or distance stream.';
  section.appendChild(body);

  return section;
}

export interface DetailViewDeps {
  detailClient: DetailClient;
  indexClient: IndexClient;
  gearClient: GearClient;
  athleteConfigClient: AthleteConfigClient;
  // Both optional and defaulted below (never registered in
  // view-registry.ts, which plan 18-12 edits concurrently in the same
  // wave) — dependency injection stays available for tests without any
  // change to the shared registry's construction call.
  ageGradingClient?: AgeGradingClient;
  bestEffortsClient?: BestEffortsClient;
}

export function createDetailView(deps: DetailViewDeps): DashboardView {
  const { detailClient, indexClient, gearClient, athleteConfigClient } = deps;
  const ageGradingClient = deps.ageGradingClient ?? createAgeGradingClient();
  const bestEffortsClient = deps.bestEffortsClient ?? createBestEffortsClient();
  let mountedContainer: HTMLElement | null = null;
  let requestToken = 0;
  // Module-scoped (relative to this view instance) handles for the two
  // heavy async mounts — destroyed in `unmount()` and before starting a new
  // load, so no Leaflet map or Chart.js instance survives in a detached
  // container (T-17-VW-04).
  let routeMapHandle: RouteMapHandle | null = null;
  let chartBandsHandle: ChartBandsHandle | null = null;

  /**
   * Mounts the route map (D-25 lazy import) into `routeContainer`. Reads the
   * polyline from `activity.map?.summary_polyline` — already-fetched detail
   * JSON (D-23) — issuing no new request. Every await point (the dynamic
   * import, and the mount call itself) is re-guarded, since a fast
   * activity-to-activity navigation can supersede either one.
   */
  async function mountRouteMapSection(
    container: HTMLElement,
    routeContainer: HTMLElement,
    activity: StravaActivity,
    myToken: number
  ): Promise<void> {
    const onRetry = (): void => {
      void mountRouteMapSection(container, routeContainer, activity, myToken);
    };

    const mapModule = await tryImportDetailMap();
    if (myToken !== requestToken || mountedContainer !== container) {
      return;
    }

    if (mapModule === null) {
      renderHeavySectionError(routeContainer, "Couldn't load the route map", onRetry);
      return;
    }

    const { renderRouteSection, mountRouteMap } = mapModule;

    if (!activity.map) {
      renderRouteSection(routeContainer, { kind: 'no-map' }, onRetry);
      return;
    }

    const polylineValue = activity.map.summary_polyline;
    const polyline = typeof polylineValue === 'string' ? polylineValue : '';
    if (polyline.length === 0) {
      renderRouteSection(routeContainer, { kind: 'no-polyline' }, onRetry);
      return;
    }

    try {
      const rootStyles = getComputedStyle(document.documentElement);
      const accentColor = rootStyles.getPropertyValue('--accent').trim() || '#fc4c02';
      const bgColor = rootStyles.getPropertyValue('--bg').trim() || '#ffffff';

      const startLatLng = activity.start_latlng;
      let startLat: number;
      let startLng: number;
      if (startLatLng && startLatLng.length >= 2) {
        startLat = startLatLng[0];
        startLng = startLatLng[1];
      } else {
        // Fallback (D-24): the first decoded polyline coordinate, since
        // `RouteData` requires both for the single-point bounds fallback.
        const decoded: [number, number][] = polylineCodec.decode(polyline);
        const first = decoded[0];
        startLat = first ? first[0] : 0;
        startLng = first ? first[1] : 0;
      }

      routeContainer.replaceChildren();
      const routeWrapper = document.createElement('div');
      routeWrapper.className = 'route-map';
      routeContainer.appendChild(routeWrapper);

      const handle = mountRouteMap(routeWrapper, {
        polyline,
        startLat,
        startLng,
        accentColor,
        bgColor,
        activityName: activity.name,
        distanceM: numOrNull(activity.distance) ?? 0,
        movingTimeSec: numOrNull(activity.moving_time) ?? 0,
        startDateLocal: activity.start_date_local,
        activityId: String(activity.id),
      });

      // A fast navigation away could have superseded this render while the
      // synchronous mount above ran — destroy immediately rather than leak
      // a live Leaflet instance into a container this view no longer owns.
      if (myToken !== requestToken || mountedContainer !== container) {
        handle.destroy();
        return;
      }
      routeMapHandle = handle;
    } catch (error) {
      console.error(error);
      if (myToken !== requestToken || mountedContainer !== container) {
        return;
      }
      routeContainer.replaceChildren();
      renderRouteSection(routeContainer, { kind: 'error' }, onRetry);
    }
  }

  /**
   * Mounts the chart bands (D-25 lazy import) into `chartContainer`. Only
   * called when `detail.stream` is non-null. `onHover` drives the route
   * map's position marker (D-26) — a harmless no-op when the map never
   * mounted (`routeMapHandle` is null).
   */
  async function mountChartSection(
    container: HTMLElement,
    chartContainer: HTMLElement,
    stream: CanonicalStream,
    myToken: number
  ): Promise<void> {
    const onRetry = (): void => {
      void mountChartSection(container, chartContainer, stream, myToken);
    };

    const chartsModule = await tryImportDetailCharts();
    if (myToken !== requestToken || mountedContainer !== container) {
      return;
    }

    if (chartsModule === null) {
      renderHeavySectionError(chartContainer, "Couldn't load the charts", onRetry);
      return;
    }

    try {
      chartContainer.replaceChildren();
      const handle = chartsModule.mountChartBands(chartContainer, {
        stream,
        onHover: (fraction) => {
          routeMapHandle?.setPositionByFraction(fraction);
        },
      });

      // Same supersede-after-synchronous-mount guard as the route map.
      if (myToken !== requestToken || mountedContainer !== container) {
        handle.destroy();
        return;
      }
      chartBandsHandle = handle;
    } catch (error) {
      console.error(error);
      if (myToken !== requestToken || mountedContainer !== container) {
        return;
      }
      chartContainer.replaceChildren();
      renderHeavySectionError(chartContainer, "Couldn't load the charts", onRetry);
    }
  }

  /**
   * Fired after the synchronous sections are already painted (stats header,
   * splits, breakdown), so the map and charts fill in without blocking first
   * paint. Route map mounts first so `routeMapHandle` is ready before the
   * chart's `onHover` can fire.
   */
  async function mountHeavySections(
    container: HTMLElement,
    detail: ActivityDetail,
    myToken: number,
    routeContainer: HTMLElement,
    chartContainer: HTMLElement | null
  ): Promise<void> {
    await mountRouteMapSection(container, routeContainer, detail.activity, myToken);

    if (chartContainer && detail.stream !== null) {
      await mountChartSection(container, chartContainer, detail.stream, myToken);
    }
  }

  /**
   * Looks up this one activity's exclusion reason (18-UI-SPEC § 6's
   * `Excluded — {reason}` badge) from the small, already-published
   * `data/best-effort-exclusions.json` (2 entries in the live archive) —
   * never rejects, resolves `null` on any fetch/parse failure so a missing
   * or unreachable document degrades to the generic "Excluded from records"
   * fallback the panel already supports.
   */
  async function loadExclusionReason(activityId: string): Promise<string | null> {
    try {
      const response = await fetch('data/best-effort-exclusions.json');
      if (!response.ok) return null;
      const body = await response.json();
      return buildExclusionReasonIndex(body).get(activityId) ?? null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /**
   * Fills in the header PR badges and the "Best Efforts This Run" panel
   * once the per-activity best-efforts entry, the age-grading document, and
   * the exclusion-reason lookup all resolve — fired WITHOUT awaiting
   * (mirrors `mountHeavySections`) so this supplementary content never
   * delays the synchronous render (stats, route, charts, splits,
   * breakdown) that already painted. `badgesContainer`/`panelContainer` are
   * empty placeholders appended synchronously in `renderSuccess`; they stay
   * empty (no badges, panel section omitted) until this resolves, which is
   * an honest interim state rather than a fabricated one. The single
   * `Promise.all` below is this function's only await point, guarded once
   * immediately after it settles.
   */
  async function mountBestEffortsAndBadges(
    container: HTMLElement,
    badgesContainer: HTMLElement,
    panelContainer: HTMLElement,
    detail: ActivityDetail,
    myToken: number
  ): Promise<void> {
    const [bestEffortsEntry, ageGrading, exclusionReason] = await Promise.all([
      bestEffortsClient.load(detail.id),
      ageGradingClient.load(),
      loadExclusionReason(detail.id),
    ]);

    if (myToken !== requestToken || mountedContainer !== container) {
      return;
    }

    for (const label of buildPrBadgeLabels(bestEffortsEntry)) {
      appendBadge(badgesContainer, label);
    }

    const rows = buildBestEffortsPanelRows(bestEffortsEntry, ageGrading);
    panelContainer.replaceChildren(buildBestEffortsSection(rows, exclusionReason));
  }

  async function renderSuccess(container: HTMLElement, detail: ActivityDetail, myToken: number): Promise<void> {
    const { activity } = detail;

    // Gear tile resolution (D-32/D-33) is itself a second await point in the
    // render path — guarded exactly like the detail fetch above, since a
    // fast activity-to-activity navigation can supersede it too.
    const gearMap = await gearClient.load();
    if (myToken !== requestToken || mountedContainer !== container) {
      return;
    }
    const gearLabel = resolveGearLabel(gearMap, activity.gear_id, activity.device_name);

    container.replaceChildren();

    const view = document.createElement('div');
    view.className = 'view';

    const heading = document.createElement('h1');
    heading.className = 'text-heading';
    heading.tabIndex = -1;
    heading.textContent = activity.name; // athlete free text — textContent only
    view.appendChild(heading);

    // PR badge row (18-UI-SPEC § 5) — empty placeholder appended
    // synchronously; `mountBestEffortsAndBadges` fills it in once the
    // per-activity best-efforts entry resolves, without blocking this
    // synchronous render. Reuses the plain `.badge` class via the shared
    // `appendBadge` builder, never a local copy.
    const badgesContainer = document.createElement('div');
    view.appendChild(badgesContainer);

    const dateLine = document.createElement('p');
    dateLine.className = 'text-label';
    dateLine.textContent = formatActivityDate(activity.start_date_local);
    view.appendChild(dateLine);

    const nav = buildDetailNav(indexClient, detail.id);
    if (nav) view.appendChild(nav);

    const statsCard = document.createElement('section');
    statsCard.className = 'card detail-section';
    const statGrid = document.createElement('div');
    statGrid.className = 'stat-grid';

    const distanceM = numOrNull(activity.distance);
    const movingTimeSec = numOrNull(activity.moving_time);
    const paceSecPerKm =
      distanceM !== null && distanceM > 0 && movingTimeSec !== null && movingTimeSec > 0
        ? movingTimeSec / (distanceM / 1000)
        : null;

    statGrid.appendChild(buildStatCard(formatOrDash(distanceM, (v) => `${(v / 1000).toFixed(1)} km`), 'Distance'));
    statGrid.appendChild(buildStatCard(formatOrDash(movingTimeSec, formatDurationHms), 'Moving Time'));
    statGrid.appendChild(buildStatCard(formatPace(paceSecPerKm), 'Pace'));
    statGrid.appendChild(
      buildStatCard(formatOrDash(numOrNull(activity.total_elevation_gain), (v) => `${Math.round(v)} m`), 'Elevation Gain')
    );
    statGrid.appendChild(
      buildStatCard(formatOrDash(numOrNull(activity.average_heartrate), (v) => String(Math.round(v))), 'Avg HR')
    );
    statGrid.appendChild(
      buildStatCard(formatOrDash(numOrNull(activity.max_heartrate), (v) => String(Math.round(v))), 'Max HR')
    );
    statGrid.appendChild(
      buildStatCard(
        formatOrDash(numOrNull(activity.average_cadence), (v) => String(Math.round(v))),
        'Cadence',
        'Cadence (rpm, single-leg)'
      )
    );
    // Gear tile (D-32/D-33): appended ONLY when resolveGearLabel returns a
    // string — omitting the DOM node entirely (never an empty-labelled
    // tile) is the whole `.stat-grid` auto-fit reflow contract.
    if (gearLabel !== null) {
      statGrid.appendChild(buildStatCard(gearLabel, 'Gear'));
    }

    statsCard.appendChild(statGrid);
    view.appendChild(statsCard);

    // -- Route map placeholder (17-UI-SPEC § 4, fixed order) — Task 3 fills
    // -- this asynchronously via the D-25 lazy import. -----------------------

    const routeSection = document.createElement('section');
    routeSection.className = 'detail-section';
    const routeHeading = document.createElement('h2');
    routeHeading.className = 'text-heading';
    routeHeading.textContent = 'Route';
    routeSection.appendChild(routeHeading);
    const routeContainer = document.createElement('div');
    routeSection.appendChild(routeContainer);
    view.appendChild(routeSection);

    // -- Chart bands placeholder — only when a stream exists to chart; Task 3
    // -- fills it asynchronously via the D-25 lazy import. --------------------

    let chartContainer: HTMLElement | null = null;
    if (detail.stream !== null) {
      const chartSection = document.createElement('section');
      chartSection.className = 'detail-section';
      const chartHeading = document.createElement('h2');
      chartHeading.className = 'text-heading';
      chartHeading.textContent = 'Pace & Effort';
      chartSection.appendChild(chartHeading);
      chartContainer = document.createElement('div');
      chartSection.appendChild(chartContainer);
      view.appendChild(chartSection);
    }

    // -- Splits / breakdown, or the named stream-absent state -----------------

    if (detail.stream !== null) {
      const splits = computeSplits(detail.stream);
      view.appendChild(buildSplitsSection(splits, paceSecPerKm));

      const buckets = computePaceDistribution(detail.stream);

      // A second config-load await point in the render path — guarded
      // exactly like the detail fetch and the gear load above.
      const config = await athleteConfigClient.load();
      if (myToken !== requestToken || mountedContainer !== container) {
        return;
      }

      const zoneTimes = computeHrZoneTimes(detail.stream, config);
      const breakdownSection = buildBreakdownSection(buckets, zoneTimes);
      if (breakdownSection) view.appendChild(breakdownSection);
    } else {
      const reason = indexClient.getRow(detail.id)?.streams.reason;
      view.appendChild(buildNoStreamSection(reason));
    }

    // Best-efforts panel placeholder (18-UI-SPEC § 5, D-08) — supplementary
    // content positioned after Splits/Breakdown and before the closing CTA;
    // `mountBestEffortsAndBadges` fills it in once the per-activity
    // best-efforts entry and age-grading document resolve, so it never
    // blocks understanding pace/HR/route if it resolves last.
    const bestEffortsContainer = document.createElement('div');
    view.appendChild(bestEffortsContainer);

    const backCta = document.createElement('a');
    backCta.className = 'cta';
    backCta.textContent = 'Back to Activities';
    backCta.href = `#${ROUTES.LIST}`;
    view.appendChild(backCta);

    container.appendChild(view);

    // Focus management (17-UI-SPEC § 5): every view moves focus to its own <h1>.
    heading.focus();

    // D-08: record this activity so returning to #/list highlights it.
    noteViewedActivity(detail.id);

    // Heavy sections (D-25 lazy import) — fired without awaiting so the
    // synchronous sections above are already painted; map/charts fill in.
    void mountHeavySections(container, detail, myToken, routeContainer, chartContainer);

    // PR badges + best-efforts panel (18-UI-SPEC § 5, D-08) — also fired
    // without awaiting, so this supplementary content never delays the
    // synchronous render above.
    void mountBestEffortsAndBadges(container, badgesContainer, bestEffortsContainer, detail, myToken);
  }

  async function loadAndRender(container: HTMLElement, id: string): Promise<void> {
    if (!isValidActivityId(id)) {
      // The raw id is logged, never written into the DOM (T-16-VW-02) —
      // retrying a malformed URL cannot succeed, so no Retry action either.
      console.warn(`Invalid activity id in route, ignoring: ${id}`);
      renderErrorState(container, { backToList: true });
      return;
    }

    const myToken = ++requestToken;

    // A new load supersedes any in-flight heavy mounts from the previous
    // activity — destroy before starting, so nothing leaks into a container
    // this new render is about to replace.
    routeMapHandle?.destroy();
    routeMapHandle = null;
    chartBandsHandle?.destroy();
    chartBandsHandle = null;

    container.replaceChildren();
    const loading = document.createElement('div');
    loading.className = 'loading-indicator';
    loading.setAttribute('role', 'status');
    loading.textContent = 'Loading activity…';
    container.appendChild(loading);

    let detail: ActivityDetail;
    try {
      detail = await detailClient.loadDetail(id);
    } catch (error) {
      console.error(error);
      // Discard if superseded by a newer mount or an unmount while in flight.
      if (myToken !== requestToken || mountedContainer !== container) {
        return;
      }
      renderErrorState(container, {
        onRetry: () => {
          void loadAndRender(container, id);
        },
      });
      return;
    }

    // Stale-response guard (T-16-VW-04): a fast back-and-forth navigation
    // between two activities must not paint the superseded result.
    if (myToken !== requestToken || mountedContainer !== container) {
      return;
    }

    await renderSuccess(container, detail, myToken);
  }

  return {
    route: ROUTES.DETAIL,
    title: 'Activity',
    // No navEntry — the detail route is drill-in only (D-05).

    async mount(ctx: ViewMountContext): Promise<void> {
      mountedContainer = ctx.container;
      const id = ctx.routeParams.id ?? '';
      await loadAndRender(ctx.container, id);
    },

    unmount(): void {
      requestToken++; // invalidate any in-flight request
      routeMapHandle?.destroy();
      routeMapHandle = null;
      chartBandsHandle?.destroy();
      chartBandsHandle = null;
      mountedContainer?.replaceChildren();
      mountedContainer = null;
    },
  };
}
