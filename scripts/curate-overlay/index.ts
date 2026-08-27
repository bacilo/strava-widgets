/**
 * Local curation mode overlay entry point (Phase 24, D-01/D-03).
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
 * scope so it is live before any view mounts.
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
