/**
 * Activity detail view (DETAIL-01, BROWSE-06 chrome) — stats header with
 * gear resolution, prev/next archive navigation, and the load/error/stale-
 * guard chrome carried over from the Phase 16 proving slice. The route map,
 * chart bands, splits table, and pace/zone breakdown are wired in by later
 * tasks in this same plan (17-14).
 */

import type { DashboardView, ViewMountContext } from '../view.types.js';
import { ROUTES } from '../view.types.js';
import { isValidActivityId } from '../router.js';
import type { DetailClient, ActivityDetail } from '../data/detail-client.js';
import type { IndexClient } from '../data/index-client.js';
import type { GearClient } from '../data/gear-client.js';
import { resolveGearLabel } from '../data/gear-client.js';
import type { AthleteConfigClient } from '../data/athlete-config-client.js';
// formatPace/formatActivityDate/formatDurationHms/noteViewedActivity are the
// dashboard's single formatter/list-highlight sources (list.ts) — imported
// rather than duplicated, matching the precedent already set for formatPace
// and formatActivityDate. The private formatDurationHms this file used to
// keep is deleted; this is the only copy in the dashboard now.
import { formatActivityDate, formatPace, formatDurationHms, noteViewedActivity } from './list.js';

const DASH = '—';

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

export interface DetailViewDeps {
  detailClient: DetailClient;
  indexClient: IndexClient;
  gearClient: GearClient;
  athleteConfigClient: AthleteConfigClient;
}

export function createDetailView(deps: DetailViewDeps): DashboardView {
  const { detailClient, indexClient, gearClient } = deps;
  let mountedContainer: HTMLElement | null = null;
  let requestToken = 0;

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
      mountedContainer?.replaceChildren();
      mountedContainer = null;
    },
  };
}
