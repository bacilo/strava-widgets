/**
 * Local curation mode overlay entry point (Phase 24, D-01/D-03/D-07/OD-1).
 *
 * Developer-only, localhost-only — never built by the publish pipeline and
 * never shipped: this file is outside tsconfig.json's `include`, outside
 * every Vite config's input graph, and outside build-widgets.mjs's widget
 * loop and copy lists (D-01's structural absence). It is bundled only by
 * scripts/curate-server.mjs's buildOverlay(), into the gitignored
 * .curate-dist/, and served from /__curate/overlay.js.
 *
 * Registers exactly one document-level listener for the
 * 'dashboard:best-efforts-mounted' CustomEvent (D-03(b), dispatched from
 * src/dashboard/views/detail.ts's mountBestEffortsAndBadges), at module
 * scope so it is live before any view mounts. Never locates the panel by
 * visible label text, heading text, table column position or row content —
 * D-03 rejected a DOM-watching observer matching rows by strings like
 * "400 m" precisely because a later copy change would break curation
 * silently. Never calls, imports or reimplements the panel's own section
 * builder, and never wholesale-replaces the panel section's children — the
 * overlay APPENDS its own controls; it is not a second renderer.
 *
 * This file also owns the transport layer: every curate write is a
 * root-absolute /__curate/... fetch (D-02, the page is served under
 * /strava-widgets so a relative path would resolve inside the mount), and
 * every successful write ends in location.reload() rather than the overlay
 * rendering the panel itself (D-03's rejection, OD-1's resolution) — the
 * hash route survives the reload, so detail.ts's own render re-runs and
 * repaints the real Excluded — {reason} badge from code this phase never
 * touches for rendering.
 */

import { mountCurationControls } from './exclusion-panel.js';

const MOUNT_PREFIX = '/strava-widgets';
const CURATE_PREFIX = '/__curate';

interface BestEffortsMountedDetail {
  activityId: string;
}

document.addEventListener('dashboard:best-efforts-mounted', (event) => {
  const { activityId } = (event as CustomEvent<BestEffortsMountedDetail>).detail;

  const section = document.querySelector<HTMLElement>(
    `section[data-activity-id="${activityId}"]`
  );
  // The seam is best-effort — never throw into the dashboard's own event
  // loop. A missing section (e.g. a rapid navigation raced the mount) is a
  // silent no-op, not an error.
  if (!section) {
    return;
  }

  // Remove any pre-existing controls so a re-mount cannot double-render.
  const existing = section.querySelector('.curate-controls');
  if (existing) {
    existing.remove();
  }

  mountCurationControls(section, activityId);
});

/** Maps a non-ok curate response to a short, human sentence for the status line. */
async function describeFailure(response: Response): Promise<string> {
  if (response.status === 400) {
    return 'The server rejected this request (bad id, bad JSON, or an empty reason).';
  }
  if (response.status === 403) {
    return 'Rejected: this request did not come from the curate server\'s own origin.';
  }
  if (response.status === 412) {
    return 'dist/widgets is not built. Run `npm run build` and `npm run build-widgets`, then try again.';
  }
  if (response.status === 413) {
    return 'That reason is too long for the server to accept.';
  }
  const body = await response.text().catch(() => '');
  return `Request failed (${response.status})${body ? `: ${body}` : '.'}`;
}

/**
 * Writes (or edits in place) the exclusion for `activityId`. On success the
 * server has already mirrored data/best-effort-exclusions.json into
 * dist/widgets/data/best-effort-exclusions.json (D-07), so a full reload
 * lets detail.ts's own loadExclusionReason re-fetch the fresh file and
 * buildPrFlagsCell paint the real badge (OD-1) — this function never builds
 * panel DOM itself.
 */
export async function saveExclusion(activityId: string, reason: string): Promise<void> {
  const response = await fetch(`${CURATE_PREFIX}/exclusions/${encodeURIComponent(activityId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) {
    throw new Error(await describeFailure(response));
  }
  location.reload();
}

/**
 * Deletes the exclusion for `activityId`. Same mirror-then-reload shape as
 * saveExclusion — the reload re-reads a file with the entry gone and the
 * badge disappears, with zero overlay-side DOM diffing.
 */
export async function removeExclusion(activityId: string): Promise<void> {
  const response = await fetch(`${CURATE_PREFIX}/exclusions/${encodeURIComponent(activityId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(await describeFailure(response));
  }
  location.reload();
}

/**
 * Streams the recompute chain's progress to `onChunk`, then reloads once
 * the completion marker arrives. NEVER invoked from saveExclusion — D-07
 * keeps Save instant and treats recompute as a separate, deliberate press,
 * because compute-best-efforts walks all activities' streams and curating
 * five runs would otherwise pay that cost five times.
 */
export async function runRecompute(onChunk: (chunk: string) => void): Promise<void> {
  const response = await fetch(`${CURATE_PREFIX}/recompute`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(await describeFailure(response));
  }
  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunk = decoder.decode(value, { stream: true });
    onChunk(chunk);
    if (chunk.includes('__CURATE_RECOMPUTE_DONE__')) {
      location.reload();
      return;
    }
  }
}
