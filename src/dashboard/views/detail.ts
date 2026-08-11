/**
 * Activity detail view — the D-07 proving slice. Lazily fetches exactly one
 * activity's two committed files (detail JSON + stream JSON) and renders
 * its stats header, with loading, stale-response guarding, an error state,
 * and a working Retry.
 *
 * Out of scope this phase: charts, route map, splits table, zone breakdown
 * (DETAIL-02..05 are Phase 17). No charting or mapping library import here.
 */

import type { DashboardView, ViewMountContext } from '../view.types.js';
import { ROUTES } from '../view.types.js';
import { isValidActivityId } from '../router.js';
import type { DetailClient, ActivityDetail } from '../data/detail-client.js';
import type { IndexClient } from '../data/index-client.js';
// formatPace is imported rather than duplicated: this view previously kept its
// own copy, and both copies carried the same m:ss rounding defect. One formatter.
import { formatActivityDate, formatPace } from './list.js';

const DASH = '—';

function formatDurationHms(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

function buildStatCard(value: string, label: string): HTMLElement {
  const wrapper = document.createElement('div');
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

function buildStreamSummaryCard(detail: ActivityDetail, indexClient: IndexClient): HTMLElement {
  const section = document.createElement('section');
  section.className = 'card';

  const heading = document.createElement('h2');
  heading.className = 'text-heading';
  heading.textContent = 'Stream Data';
  section.appendChild(heading);

  const { stream } = detail;
  if (stream === null) {
    const empty = document.createElement('p');
    empty.className = 'text-body';
    empty.textContent = 'No stream data for this activity.';
    section.appendChild(empty);

    const row = indexClient.getRow(detail.id);
    if (row && !row.streams.available && row.streams.reason) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = row.streams.reason;
      section.appendChild(badge);
    }
    return section;
  }

  const grid = document.createElement('div');
  grid.className = 'stat-grid';
  grid.appendChild(buildStatCard(String(stream.t.length), 'Samples'));

  const channels: string[] = [];
  if (stream.hr) channels.push('HR');
  if (stream.cadence) channels.push('Cadence');
  if (stream.alt) channels.push('Elevation');
  grid.appendChild(buildStatCard(channels.length > 0 ? channels.join(', ') : DASH, 'Channels'));

  grid.appendChild(buildStatCard(stream.distanceSource, 'Distance Source'));
  section.appendChild(grid);

  return section;
}

function renderSuccess(container: HTMLElement, detail: ActivityDetail, indexClient: IndexClient): void {
  container.replaceChildren();

  const view = document.createElement('div');
  view.className = 'view';

  const { activity } = detail;

  const heading = document.createElement('h1');
  heading.className = 'text-heading';
  heading.textContent = activity.name; // athlete free text — textContent only
  view.appendChild(heading);

  const dateLine = document.createElement('p');
  dateLine.className = 'text-label';
  dateLine.textContent = formatActivityDate(activity.start_date_local);
  view.appendChild(dateLine);

  const statsCard = document.createElement('section');
  statsCard.className = 'card';
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
  statGrid.appendChild(buildStatCard(formatPace(paceSecPerKm), 'Average Pace'));
  statGrid.appendChild(
    buildStatCard(formatOrDash(numOrNull(activity.total_elevation_gain), (v) => `${Math.round(v)} m`), 'Elevation Gain')
  );
  statGrid.appendChild(
    buildStatCard(formatOrDash(numOrNull(activity.average_heartrate), (v) => String(Math.round(v))), 'Average HR')
  );
  statGrid.appendChild(
    buildStatCard(formatOrDash(numOrNull(activity.max_heartrate), (v) => String(Math.round(v))), 'Max HR')
  );
  statGrid.appendChild(
    buildStatCard(
      formatOrDash(numOrNull(activity.average_cadence), (v) => String(Math.round(v))),
      'Avg Cadence (rpm, single-leg)'
    )
  );

  statsCard.appendChild(statGrid);
  view.appendChild(statsCard);

  view.appendChild(buildStreamSummaryCard(detail, indexClient));

  const backCta = document.createElement('a');
  backCta.className = 'cta';
  backCta.textContent = 'Back to Activities';
  backCta.href = `#${ROUTES.LIST}`;
  view.appendChild(backCta);

  container.appendChild(view);
}

export interface DetailViewDeps {
  detailClient: DetailClient;
  indexClient: IndexClient;
}

export function createDetailView(deps: DetailViewDeps): DashboardView {
  const { detailClient, indexClient } = deps;
  let mountedContainer: HTMLElement | null = null;
  let requestToken = 0;

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

    renderSuccess(container, detail, indexClient);
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
