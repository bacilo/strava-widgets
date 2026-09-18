/**
 * Local curation mode's review queue page (Phase 29, D-06/D-08/D-09/D-10/D-12/D-14).
 *
 * Developer-only, localhost-only — never built by the publish pipeline and never shipped: this
 * file is outside tsconfig.json's `include`, outside every Vite config's input graph, and outside
 * build-widgets.mjs's copy lists (Phase 24's D-01 structural-absence rule, inherited unchanged).
 * It is bundled only by scripts/curate-server.mjs's esbuild step into the gitignored
 * `.curate-dist/`, and served from `/__curate/queue.js`.
 *
 * Importing `../curate-overlay/index.js` (`saveExclusion`/`removeExclusion`/`runRecompute`) is
 * deliberate reuse of the existing write transport, never a reimplementation (D-10 — that import
 * IS the CUR-02 guarantee). That module's own module-scope listeners run as harmless no-ops on
 * this page: no `dashboard:best-efforts-mounted` CustomEvent ever fires here, and there is no
 * `#app-nav-root` on this page for its nav-link injector to find.
 *
 * The list itself is derived in the browser from the already-mirrored JSON (D-08) — no new server
 * read route. DOM is built with `document.createElement` + `textContent` only; the page links the
 * dashboard's own built stylesheet (injected by the server) and ships zero styling of its own
 * (D-09/OD-3) — no HTML-string assignment of any kind, no dynamically created style element, no
 * inline style attribute, and no stylesheet reference anywhere in this file.
 */

import { deriveFlaggedActivities, summarizeQueue } from './derive-flagged.mjs';
import {
  activityDetailUrl,
  formatActivityDate,
  formatEffortDuration,
  formatPace,
} from './format.mjs';

/**
 * Never-throw fetch of the best-efforts document, mirroring `exclusion-panel.ts`'s
 * `loadExclusionState` discipline exactly: a non-ok response or any thrown error degrades to
 * `null` rather than propagating.
 */
async function loadBestEffortsDoc(): Promise<unknown> {
  try {
    const response = await fetch('/strava-widgets/data/stats/best-efforts.json');
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** Never-throw fetch of the mirrored exclusions document. Same discipline as loadBestEffortsDoc. */
async function loadExclusionsDoc(): Promise<unknown> {
  try {
    const response = await fetch('/strava-widgets/data/best-effort-exclusions.json');
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * Never-throw fetch of the dashboard index (PD-01's name-only join source). A `null` here must not
 * change the derived row set or order — `deriveFlaggedActivities` degrades a missing name to the
 * label `Activity <id>`.
 */
async function loadIndexDoc(): Promise<unknown> {
  try {
    const response = await fetch('/strava-widgets/data/dashboard/index.json');
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * Creates the page's single wrapping element. This is the ONLY element in this file that ever
 * receives a class name (D-09) — both the normal render path and the error-fallback path route
 * through this one function so that invariant holds structurally, not by convention.
 */
function createQueueMain(): HTMLElement {
  const main = document.createElement('main');
  main.className = 'curate-queue';
  return main;
}

/** Appends the never-blank empty state (rows.length === 0, or a missing best-efforts document). */
function appendEmptyState(main: HTMLElement, bestEffortsDoc: unknown): void {
  const empty = document.createElement('p');
  empty.setAttribute('data-queue-empty', '');
  empty.textContent = 'No flagged activities.';
  main.appendChild(empty);

  if (bestEffortsDoc === null) {
    const reason = document.createElement('p');
    reason.textContent =
      'dist/widgets is likely not built, or data/stats/best-efforts.json is missing. ' +
      'Run `npm run build && npm run build-widgets`, then reload this page.';
    main.appendChild(reason);
  }
}

/** Builds one `<li data-queue-row>` for a derived queue row (D-12). */
function buildRowElement(row: ReturnType<typeof deriveFlaggedActivities>[number]): HTMLElement {
  const item = document.createElement('li');
  item.setAttribute('data-queue-row', '');
  item.setAttribute('data-activity-id', row.activityId);
  item.setAttribute('data-excluded', String(row.excluded));

  const rowHeading = document.createElement('h2');
  const link = document.createElement('a');
  link.href = activityDetailUrl(row.activityId);
  link.textContent = `${formatActivityDate(row.startDate)} — ${row.label}`;
  rowHeading.appendChild(link);
  item.appendChild(rowHeading);

  if (row.excluded) {
    const state = document.createElement('p');
    state.setAttribute('data-queue-state', '');
    state.textContent = `Excluded — ${row.exclusionReason}`;
    item.appendChild(state);
  }

  const effortsList = document.createElement('ul');
  effortsList.setAttribute('data-queue-efforts', '');
  for (const effort of row.flaggedEfforts) {
    const effortItem = document.createElement('li');
    effortItem.textContent =
      `${effort.distance} · ${effort.guard} · ${effort.reason} · ` +
      `${formatEffortDuration(effort.durationSec)} · ${formatPace(effort.paceSecPerKm)}`;
    effortsList.appendChild(effortItem);
  }
  item.appendChild(effortsList);

  const controls = document.createElement('div');
  controls.setAttribute('data-queue-controls', '');
  item.appendChild(controls);
  // mountRowControls(controls, row) is wired in Task 3.

  return item;
}

/**
 * Loads the three mirrored documents, derives the flagged row set, and renders the queue page into
 * `document.body`. Wrapped so a rejection anywhere in this chain lands in the empty state rather
 * than an unhandled rejection or a blank page.
 */
async function renderQueue(): Promise<void> {
  const main = createQueueMain();

  const heading = document.createElement('h1');
  heading.textContent = 'Review queue';
  main.appendChild(heading);

  const [bestEffortsDoc, exclusionsDoc, indexDoc] = await Promise.all([
    loadBestEffortsDoc(),
    loadExclusionsDoc(),
    loadIndexDoc(),
  ]);

  const rows = deriveFlaggedActivities(bestEffortsDoc, exclusionsDoc, indexDoc);
  const { flaggedCount, excludedCount } = summarizeQueue(rows);

  const summary = document.createElement('p');
  summary.setAttribute('data-queue-summary', '');
  summary.textContent = `${flaggedCount} flagged · ${excludedCount} already excluded`;
  main.appendChild(summary);

  const recomputeNote = document.createElement('p');
  recomputeNote.setAttribute('data-queue-recompute-note', '');
  recomputeNote.textContent =
    'The plausibility ceiling is derived from the already-filtered population, so excluding an ' +
    'activity and recomputing can change which activities are listed here.';
  main.appendChild(recomputeNote);

  const recomputeButton = document.createElement('button');
  recomputeButton.setAttribute('data-queue-recompute', '');
  recomputeButton.textContent = 'Recompute records';
  main.appendChild(recomputeButton);
  // Click handler wired in Task 3, via the imported runRecompute transport.

  const recomputeOutput = document.createElement('pre');
  recomputeOutput.setAttribute('data-queue-recompute-output', '');
  main.appendChild(recomputeOutput);

  if (rows.length === 0) {
    appendEmptyState(main, bestEffortsDoc);
    document.body.appendChild(main);
    return;
  }

  const list = document.createElement('ol');
  list.setAttribute('data-queue-list', '');
  for (const row of rows) {
    list.appendChild(buildRowElement(row));
  }
  main.appendChild(list);

  document.body.appendChild(main);
}

document.addEventListener('DOMContentLoaded', () => {
  renderQueue().catch((error) => {
    console.error(error);
    const main = createQueueMain();
    appendEmptyState(main, null);
    document.body.appendChild(main);
  });
});
