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
  QUEUE_VIEWS,
  buildPrefillReason,
  countMalformedExclusions,
  countMalformedReviewed,
  deriveFlaggedActivities,
  deriveOrphans,
  rowsForView,
  summarizeViews,
} from './derive-flagged.mjs';
import {
  activityDetailUrl,
  formatActivityDate,
  formatEffortDuration,
  formatPace,
} from './format.mjs';
import {
  loadReviewedDoc,
  removeExclusion,
  removeReviewed,
  runRecompute,
  saveExclusion,
  saveReviewed,
} from '../curate-overlay/index.js';

type QueueRow = ReturnType<typeof deriveFlaggedActivities>[number];
type Orphan = ReturnType<typeof deriveOrphans>[number];

const VIEW_LABELS: Record<string, string> = {
  'to-review': 'To review',
  reviewed: 'Reviewed',
  excluded: 'Excluded',
  all: 'All',
};

/** D-15: the active view lives in `#view=<name>` so the transport's reload returns to it. */
function readViewFromHash(): string {
  const match = /^#view=([a-z-]+)$/.exec(location.hash);
  if (match !== null && (QUEUE_VIEWS as string[]).includes(match[1])) {
    return match[1];
  }
  return 'to-review';
}

/** The date part of a stored ISO timestamp. */
function dateOnly(iso: string | null): string {
  return typeof iso === 'string' ? iso.slice(0, 10) : '';
}

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
function mountRowControls(container: HTMLElement, row: QueueRow): void {
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

/** Appends a plain `<p>` line with the given text and optional marker attribute. */
function appendLine(container: HTMLElement, text: string, marker?: string): HTMLElement {
  const line = document.createElement('p');
  if (marker !== undefined) {
    line.setAttribute(marker, '');
  }
  line.textContent = text;
  container.appendChild(line);
  return line;
}

/**
 * D-14/D-18: one Un-review button bound to one entry. The confirm() guard sits in front of the
 * only removeReviewed call; the transport owns the reload.
 */
function mountUnreviewControl(container: HTMLElement, activityId: string): void {
  const button = document.createElement('button');
  button.textContent = 'Un-review';
  container.appendChild(button);
  const status = document.createElement('p');
  status.setAttribute('data-queue-status', '');
  container.appendChild(status);

  button.addEventListener('click', async () => {
    const confirmed = window.confirm(
      'Un-reviewing deletes this reviewed-and-kept entry. The activity returns to the queue. Continue?'
    );
    if (!confirmed) {
      return;
    }
    try {
      await removeReviewed(activityId);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  });
}

/**
 * D-17/D-18: the one review control. A blank, required reason (the developer's own judgement,
 * never prefilled) and one Save bound to this row. Used by 'none' and 'changed' rows alike.
 */
function mountReviewControl(container: HTMLElement, row: QueueRow, label: string): void {
  const reasonLabel = document.createElement('span');
  reasonLabel.textContent = label;
  container.appendChild(reasonLabel);

  const reviewReasonInput = document.createElement('textarea');
  reviewReasonInput.placeholder = 'Why is this evidence acceptable?';
  container.appendChild(reviewReasonInput);

  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save reviewed and kept';
  container.appendChild(saveButton);

  const status = document.createElement('p');
  status.setAttribute('data-queue-status', '');
  container.appendChild(status);

  saveButton.addEventListener('click', async () => {
    const reason = reviewReasonInput.value.trim();
    if (reason.length === 0) {
      status.textContent = 'A reason is required.';
      reviewReasonInput.focus();
      return;
    }
    try {
      await saveReviewed(row.activityId, reason, row.fingerprint);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  });
}

function tierLine(row: QueueRow): string {
  if (row.tier === 1) {
    return 'Transported pause';
  }
  if (row.tier === 2) {
    return 'Moved by the unreliable-segment guard';
  }
  return 'Other demotion';
}

function effortText(effort: QueueRow['flaggedEfforts'][number]): string {
  return (
    `${effort.distance} · ${effort.guard} · ${effort.reason} · ` +
    `${formatEffortDuration(effort.durationSec)} · ${formatPace(effort.paceSecPerKm)}`
  );
}

/** Builds one `<li data-queue-row>` for a derived queue row (D-12). */
function buildRowElement(row: QueueRow): HTMLElement {
  const item = document.createElement('li');
  item.setAttribute('data-queue-row', '');
  item.setAttribute('data-activity-id', row.activityId);
  item.setAttribute('data-excluded', String(row.excluded));
  item.setAttribute('data-tier', String(row.tier));
  item.setAttribute(
    'data-contaminated-metres',
    row.contaminatedMetres === null ? '' : String(row.contaminatedMetres)
  );
  item.setAttribute('data-review-state', row.reviewState);
  item.setAttribute('data-transported', String(row.transported));

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

  appendLine(item, tierLine(row), 'data-queue-tier');
  if (row.tier !== 3 && row.contaminatedMetres !== null) {
    appendLine(item, `Contaminated metres: ${row.contaminatedMetres} m`, 'data-queue-metres');
  }

  if (row.reviewState === 'changed') {
    appendLine(
      item,
      `changed since review — reviewed on ${dateOnly(row.reviewedAt)}: ${row.reviewReason}`,
      'data-queue-changed'
    );
    appendLine(item, `Flags when reviewed: ${row.reviewedFingerprint}`);
    appendLine(item, `Flags now: ${row.fingerprint}`);
  } else if (row.reviewState === 'reviewed') {
    appendLine(
      item,
      `Reviewed and kept on ${dateOnly(row.reviewedAt)}: ${row.reviewReason}`,
      'data-queue-reviewed'
    );
  }

  if (row.contaminatedEfforts.length > 0) {
    appendLine(item, 'Efforts ranked on a clean window:');
    const contaminatedList = document.createElement('ul');
    contaminatedList.setAttribute('data-queue-contaminated', '');
    for (const effort of row.contaminatedEfforts) {
      const effortItem = document.createElement('li');
      effortItem.textContent = effortText(effort);
      contaminatedList.appendChild(effortItem);
    }
    item.appendChild(contaminatedList);
  }

  const effortsList = document.createElement('ul');
  effortsList.setAttribute('data-queue-efforts', '');
  for (const effort of row.flaggedEfforts) {
    const effortItem = document.createElement('li');
    effortItem.textContent = effortText(effort);
    effortsList.appendChild(effortItem);
  }
  item.appendChild(effortsList);

  const controls = document.createElement('div');
  controls.setAttribute('data-queue-controls', '');
  item.appendChild(controls);
  // D-11: excluded and reviewed-and-kept are mutually exclusive in the UI.
  if (row.excluded) {
    mountRowControls(controls, row);
    appendLine(controls, 'Remove the exclusion first to mark this reviewed and kept.');
  } else if (row.reviewState === 'reviewed') {
    mountUnreviewControl(controls, row.activityId);
    appendLine(controls, 'Un-review first to exclude this activity.');
  } else if (row.reviewState === 'changed') {
    mountReviewControl(controls, row, 'Review again');
    mountUnreviewControl(controls, row.activityId);
    appendLine(controls, 'Un-review first to exclude this activity.');
  } else {
    mountRowControls(controls, row);
    mountReviewControl(controls, row, 'Reviewed and kept — why?');
  }

  return item;
}

/** D-13: one reviewed entry whose activity is no longer flagged. */
function buildOrphanElement(orphan: Orphan): HTMLElement {
  const item = document.createElement('li');
  item.setAttribute('data-queue-orphan', '');
  item.setAttribute('data-activity-id', orphan.activityId);
  const link = document.createElement('a');
  link.href = activityDetailUrl(orphan.activityId);
  link.textContent = `Activity ${orphan.activityId}`;
  item.appendChild(link);
  appendLine(
    item,
    `no longer flagged — reviewed and kept on ${dateOnly(orphan.reviewedAt)}: ${orphan.reason}`
  );
  mountUnreviewControl(item, orphan.activityId);
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

  const [bestEffortsDoc, exclusionsDoc, indexDoc, reviewedDoc] = await Promise.all([
    loadBestEffortsDoc(),
    loadExclusionsDoc(),
    loadIndexDoc(),
    loadReviewedDoc(),
  ]);

  const rows = deriveFlaggedActivities(
    bestEffortsDoc,
    exclusionsDoc,
    indexDoc,
    reviewedDoc ?? undefined
  );
  const orphans = deriveOrphans(rows, reviewedDoc);
  const counts = summarizeViews(rows, orphans);

  const summary = document.createElement('p');
  summary.setAttribute('data-queue-summary', '');
  summary.textContent =
    `To review ${counts.toReview} (${counts.changed} changed since review) · ` +
    `Reviewed ${counts.reviewed} (${counts.orphans} no longer flagged) · ` +
    `Excluded ${counts.excluded} · All ${counts.all}`;
  main.appendChild(summary);

  const viewBar = document.createElement('div');
  viewBar.setAttribute('data-queue-views', '');
  main.appendChild(viewBar);

  // TD-03/D-09: notes render only when the count is greater than zero.
  const malformedCount = countMalformedExclusions(exclusionsDoc);
  if (malformedCount > 0) {
    appendLine(main, `${malformedCount} exclusion entries ignored (malformed)`, 'data-queue-malformed-note');
  }
  const malformedReviewed = countMalformedReviewed(reviewedDoc);
  if (malformedReviewed > 0) {
    appendLine(
      main,
      `${malformedReviewed} reviewed entries ignored (malformed)`,
      'data-queue-malformed-reviewed-note'
    );
  }
  if (counts.metresMissing > 0) {
    appendLine(
      main,
      `${counts.metresMissing} rows have no contaminated-metres figure; their order within the ` +
        'tier falls back to newest-first. Run Recompute.',
      'data-queue-metres-note'
    );
  }
  if (counts.conflicts > 0) {
    appendLine(
      main,
      `${counts.conflicts} activities are both excluded and reviewed-and-kept (hand-edited ` +
        'files); they are shown under Excluded only.',
      'data-queue-conflict-note'
    );
  }
  if (reviewedDoc === null) {
    appendLine(
      main,
      'The reviewed file could not be read; every row is shown as not reviewed.',
      'data-queue-reviewed-unavailable-note'
    );
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

  if (rows.length === 0 && orphans.length === 0) {
    appendEmptyState(main, bestEffortsDoc);
    document.body.appendChild(main);
    return;
  }

  // D-15: the list region is rebuilt in place on a view change; no reload, no class.
  const content = document.createElement('div');
  main.appendChild(content);

  function renderView(view: string): void {
    for (const button of Array.from(viewBar.children)) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-queue-view') === view));
    }
    const viewRows = rowsForView(rows, view);
    const list = document.createElement('ol');
    list.setAttribute('data-queue-list', '');
    for (const row of viewRows) {
      list.appendChild(buildRowElement(row));
    }
    const parts: HTMLElement[] = [];
    if (viewRows.length === 0) {
      const empty = document.createElement('p');
      empty.setAttribute('data-queue-empty', '');
      empty.textContent = `No rows in ${VIEW_LABELS[view]}.`;
      parts.push(empty);
    } else {
      parts.push(list);
    }
    if (view === 'reviewed' && orphans.length > 0) {
      const orphanHeading = document.createElement('h2');
      orphanHeading.textContent = `No longer flagged (${orphans.length})`;
      parts.push(orphanHeading);
      const orphanList = document.createElement('ul');
      for (const orphan of orphans) {
        orphanList.appendChild(buildOrphanElement(orphan));
      }
      parts.push(orphanList);
    }
    content.replaceChildren(...parts);
  }

  for (const name of QUEUE_VIEWS as string[]) {
    const button = document.createElement('button');
    button.setAttribute('data-queue-view', name);
    button.textContent = VIEW_LABELS[name];
    button.addEventListener('click', () => {
      location.hash = `view=${name}`;
      renderView(name);
    });
    viewBar.appendChild(button);
  }
  renderView(readViewFromHash());

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
