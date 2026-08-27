/**
 * Curation controls for the Best Efforts panel (Phase 24, D-08).
 *
 * Developer-only, localhost-only — never built by the publish pipeline,
 * never shipped. `mountCurationControls` appends the real two-step-commit
 * UI: tick the box to reveal a required reason textarea and a Save button;
 * an already-excluded activity loads pre-ticked with its stored reason so
 * editing and pressing Save edits the entry in place; unticking or pressing
 * "Remove exclusion" confirms before deleting the stored entry, because
 * either silently changes PR history (D-08).
 *
 * OD-3: ships zero styling of its own. Phase 19's bare-element baseline in
 * the dashboard's own stylesheet already covers plain input/textarea/button
 * elements, so this file must never import a stylesheet, create a <style>
 * element, or set an inline `style` attribute on an interactive element.
 * DOM is built with document.createElement + textContent + appendChild only
 * — no HTML-string assignment — matching detail-sections.ts's idiom. Only
 * the wrapping `<div class="curate-controls">` receives a class name; no
 * interactive element (input/textarea/button) ever gets one.
 */

import { removeExclusion, runRecompute, saveExclusion } from './index.js';

interface ExclusionsFile {
  schemaVersion?: unknown;
  note?: unknown;
  exclusions?: unknown;
}

interface ExclusionState {
  excluded: boolean;
  reason: string;
}

/**
 * Reads the current exclusion state for `activityId` from the published,
 * mirrored copy of the exclusions file. Tolerant of any malformed shape —
 * a missing file, a non-array `exclusions`, or a malformed entry all
 * degrade to "not excluded" and never throw, mirroring
 * `loadExclusionReason`'s never-rejects discipline at detail.ts:463. Skips
 * `__proto__` as an activityId value, mirroring records-logic.ts:82.
 */
async function loadExclusionState(activityId: string): Promise<ExclusionState> {
  const notExcluded: ExclusionState = { excluded: false, reason: '' };
  if (activityId === '__proto__') {
    return notExcluded;
  }
  try {
    const response = await fetch('/strava-widgets/data/best-effort-exclusions.json');
    if (!response.ok) {
      return notExcluded;
    }
    const body = (await response.json()) as ExclusionsFile;
    const exclusions = Array.isArray(body.exclusions) ? body.exclusions : [];
    for (const entry of exclusions) {
      if (
        entry !== null &&
        typeof entry === 'object' &&
        (entry as { activityId?: unknown }).activityId === activityId &&
        typeof (entry as { reason?: unknown }).reason === 'string'
      ) {
        return { excluded: true, reason: (entry as { reason: string }).reason };
      }
    }
    return notExcluded;
  } catch (error) {
    console.error(error);
    return notExcluded;
  }
}

/**
 * Mounts the curation controls for `activityId` into `section`.
 *
 * @param section the Best Efforts <section data-activity-id="..."> to augment
 * @param activityId the activity id the controls apply to
 */
export function mountCurationControls(section: HTMLElement, activityId: string): void {
  const container = document.createElement('div');
  container.className = 'curate-controls';

  const checkboxLabel = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkboxLabel.appendChild(checkbox);
  checkboxLabel.appendChild(document.createTextNode('Exclude this run from PRs'));
  container.appendChild(checkboxLabel);

  const reasonLabel = document.createElement('span');
  reasonLabel.textContent = 'Reason (required)';
  container.appendChild(reasonLabel);

  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Why is this run untrustworthy for PRs?';
  container.appendChild(textarea);

  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save';
  container.appendChild(saveButton);

  const removeButton = document.createElement('button');
  removeButton.textContent = 'Remove exclusion';
  container.appendChild(removeButton);

  const recomputeButton = document.createElement('button');
  recomputeButton.textContent = 'Recompute records';
  container.appendChild(recomputeButton);

  const status = document.createElement('p');
  container.appendChild(status);

  const progress = document.createElement('pre');
  container.appendChild(progress);

  // NOT EXCLUDED shape: textarea, its label and Save hidden; Remove absent.
  // Ticking the box reveals the textarea and Save.
  function applyVisibility(excluded: boolean): void {
    reasonLabel.hidden = !excluded;
    textarea.hidden = !excluded;
    saveButton.hidden = !excluded;
    removeButton.hidden = !excluded;
  }

  let currentlyExcluded = false;

  loadExclusionState(activityId)
    .then((state) => {
      currentlyExcluded = state.excluded;
      checkbox.checked = state.excluded;
      textarea.value = state.reason;
      applyVisibility(state.excluded);
    })
    .catch((error) => {
      console.error(error);
    });

  // Ticking merely reveals the form — nothing is written until Save.
  // Unticking an ALREADY-EXCLUDED activity is destructive (it deletes the
  // stored entry) and earns a confirm() before any request is issued; on
  // cancel the checkbox is restored to checked and nothing is sent.
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

  recomputeButton.addEventListener('click', () => {
    progress.textContent = '';
    status.textContent = 'Recomputing…';
    void runRecompute((chunk) => {
      progress.textContent += chunk;
    }).catch((error) => {
      status.textContent = error instanceof Error ? error.message : String(error);
    });
  });

  // Neither Save nor Remove is ever set `disabled` while a request is in
  // flight — D-08 explicitly rejected a disabled-control shape (Phase 19's
  // CR-03, unexplained disabled controls); a status-line message is the
  // only feedback mechanism this overlay uses.
  async function doSave(reason: string): Promise<void> {
    try {
      await saveExclusion(activityId, reason);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  async function doRemove(): Promise<void> {
    try {
      await removeExclusion(activityId);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
      checkbox.checked = currentlyExcluded;
    }
  }

  section.appendChild(container);
}
