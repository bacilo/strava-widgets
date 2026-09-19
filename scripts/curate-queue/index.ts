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

import {
  buildPrefillReason,
  countMalformedExclusions,
  deriveFlaggedActivities,
  summarizeQueue,
} from './derive-flagged.mjs';
import {
  activityDetailUrl,
  formatActivityDate,
  formatEffortDuration,
  formatPace,
} from './format.mjs';
import { removeExclusion, runRecompute, saveExclusion } from '../curate-overlay/index.js';

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
 * True while a page-level Recompute run is in flight (D-13). A plain module-scope boolean, not a
 * `disabled` attribute on the button — matches `mountCurationControls`'s own rejection of that
 * shape (Phase 19's CR-03: an unexplained disabled control). A click while a run is active is
 * simply ignored rather than queued or double-issued.
 */
let recomputeInFlight = false;

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

/**
 * Mounts the exclude/edit/remove control for one row (D-10/D-11/D-15), copying
 * `exclusion-panel.ts`'s `mountCurationControls` two-step-commit structure — tick reveals a
 * required, editable reason textarea and a Save button; unticking an already-excluded row or
 * pressing "Remove exclusion" confirms first. Every write crosses through the imported
 * `saveExclusion`/`removeExclusion` transport only — this function issues no fetch of its own and
 * calls no reload of its own (both live in the imported module, which is exactly what CUR-02
 * requires).
 *
 * Differences from the overlay's panel (queue-specific): the row's data is already loaded
 * synchronously (no `loadExclusionState` fetch needed) and the reason textarea's initial value is
 * the stored reason when already excluded, otherwise `buildPrefillReason`'s join of this row's
 * flagged-effort demotion reasons (D-11) rather than starting empty.
 */
function mountRowControls(
  container: HTMLElement,
  row: ReturnType<typeof deriveFlaggedActivities>[number]
): void {
  const checkboxLabel = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkboxLabel.appendChild(checkbox);
  checkboxLabel.appendChild(document.createTextNode('Exclude this activity from PRs'));
  container.appendChild(checkboxLabel);

  const reasonLabel = document.createElement('span');
  reasonLabel.textContent = 'Reason (required)';
  container.appendChild(reasonLabel);

  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Why is this activity untrustworthy for PRs?';
  container.appendChild(textarea);

  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save';
  container.appendChild(saveButton);

  const removeButton = document.createElement('button');
  removeButton.textContent = 'Remove exclusion';
  container.appendChild(removeButton);

  const status = document.createElement('p');
  status.setAttribute('data-queue-status', '');
  container.appendChild(status);

  // NOT EXCLUDED shape: textarea, its label and Save hidden; Remove absent. Ticking the box
  // reveals the textarea and Save — mirrors mountCurationControls's applyVisibility exactly.
  function applyVisibility(excluded: boolean): void {
    reasonLabel.hidden = !excluded;
    textarea.hidden = !excluded;
    saveButton.hidden = !excluded;
    removeButton.hidden = !excluded;
  }

  let currentlyExcluded = row.excluded;
  checkbox.checked = row.excluded;
  textarea.value = row.excluded
    ? (row.exclusionReason ?? '')
    : buildPrefillReason(row.flaggedEfforts);
  applyVisibility(row.excluded);

  // Ticking merely reveals the form — nothing is written until Save. Unticking an
  // ALREADY-EXCLUDED row is destructive (it deletes the stored entry) and earns a confirm()
  // before any request is issued; on cancel the checkbox is restored to checked (D-15).
  checkbox.addEventListener('change', () => {
    if (!checkbox.checked && currentlyExcluded) {
      const confirmed = window.confirm(
        'Removing this exclusion deletes it and changes PR history. Continue?'
      );
      if (!confirmed) {
        checkbox.checked = true;
        return;
      }
      void doRemove();
      return;
    }
    applyVisibility(checkbox.checked);
  });

  saveButton.addEventListener('click', () => {
    const reason = textarea.value.trim();
    if (reason.length === 0) {
      status.textContent = 'A reason is required before saving.';
      textarea.focus();
      return;
    }
    void doSave(reason);
  });

  removeButton.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Removing this exclusion deletes it and changes PR history. Continue?'
    );
    if (!confirmed) {
      return;
    }
    void doRemove();
  });

  // Neither Save nor Remove is ever disabled while a request is in flight, matching
  // mountCurationControls's own rejection of that shape — the status line is the only feedback.
  async function doSave(reason: string): Promise<void> {
    try {
      await saveExclusion(row.activityId, reason);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  async function doRemove(): Promise<void> {
    try {
      await removeExclusion(row.activityId);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
      checkbox.checked = currentlyExcluded;
    }
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
  mountRowControls(controls, row);

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

  // TD-03/D-09: rendered only when the count is greater than zero, so an ordinary session (the
  // real archive today has zero malformed entries) gains no noise — its absence here is that
  // deliberate choice, not a missing feature. countMalformedExclusions is called once, alongside
  // deriveFlaggedActivities, with the same exclusionsDoc already loaded above.
  const malformedCount = countMalformedExclusions(exclusionsDoc);
  if (malformedCount > 0) {
    const malformedNote = document.createElement('p');
    malformedNote.setAttribute('data-queue-malformed-note', '');
    malformedNote.textContent = `${malformedCount} exclusion entries ignored (malformed)`;
    main.appendChild(malformedNote);
  }

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

  const recomputeOutput = document.createElement('pre');
  recomputeOutput.setAttribute('data-queue-recompute-output', '');
  main.appendChild(recomputeOutput);

  // D-13: one Recompute control, reusing the existing recompute POST route and its streamed
  // output via the imported transport; runRecompute's own reload fires at the completion marker,
  // so this handler never calls reload itself. D-07's separation is inherited — Recompute is
  // never invoked from a Save path.
  recomputeButton.addEventListener('click', () => {
    if (recomputeInFlight) {
      return;
    }
    recomputeInFlight = true;
    recomputeOutput.textContent = '';
    runRecompute((chunk) => {
      recomputeOutput.textContent += chunk;
    })
      .catch((error) => {
        recomputeOutput.textContent += error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        recomputeInFlight = false;
      });
  });

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
