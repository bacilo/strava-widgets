/**
 * Dashboard bootstrap. Mirrors `widget-base.ts`'s `connectedCallback`
 * ordering: theme, then chrome (nav), then loading, then data.
 *
 * This is the only module in `src/dashboard/` that touches
 * `document.getElementById`, `document.title`, or module-level side
 * effects — every view stays free of global DOM lookups.
 */

import { applyThemeMode, readStoredMode } from './theme.js';
import { createNav } from './nav.js';
import { createRouter, navigateTo, type RouteMatch } from './router.js';
import { ALL_ROUTES, ROUTES, type DashboardView } from './view.types.js';
import { clients, getView } from './view-registry.js';
import { resolveStorage } from './storage.js';

// 1. Re-apply at module scope what the inline pre-paint script in index.html
// already set, so module-side state and the DOM attribute agree and the
// toggle starts from the right mode. This statement runs at MODULE SCOPE
// (BL-03): an unguarded storage-global read here throws during module
// evaluation under blocked site data (Firefox "Block cookies and site data",
// Chrome "Don't allow sites to save data"), and the entire dashboard module
// graph fails — the page renders blank, with no nav and no view, and the
// `onMatch` try/catch below (which renders the generic error panel) is never
// reached because it wraps `view.mount(...)`, not module evaluation.
// `resolveStorage` wraps the throwing property getter instead. The next
// statement, `createNav(...)`, is module-scope too and carries the same
// requirement — see `nav.ts:186`.
applyThemeMode(readStoredMode(resolveStorage()));

// 2. Mount the nav chrome.
const nav = createNav(document.getElementById('app-nav-root')!);

// 3. Resolve the view mount point.
const container = document.getElementById('app')!;

// 4. Kick off the index load immediately WITHOUT awaiting it (DASH-02).
// Views await the same memoized promise and each render their own error
// state; a `.catch` here only prevents an unhandled-rejection warning from
// a load that fails before any view is mounted to observe it.
clients.indexClient.loadIndex().catch(() => {});

let currentView: DashboardView | null = null;

async function onMatch(match: RouteMatch): Promise<void> {
  currentView?.unmount?.();
  currentView = null;

  const view = getView(match.route);
  if (!view) {
    // Should not happen — VIEWS covers every ALL_ROUTES entry — but fail
    // safe rather than leave a blank page if the registry and router ever
    // drift apart.
    onNoMatch(match.route);
    return;
  }

  document.title = `${view.title} — Strava Analytics`;
  nav.setActiveRoute(match.route);
  container.replaceChildren();
  currentView = view;

  try {
    await view.mount({ container, routeParams: match.routeParams, query: match.query });
  } catch (error) {
    console.error(error);
    // Ownership guard. onMatch is async but the hashchange handler invokes it
    // unawaited, so a slow navigation A can still be in flight when navigation B
    // starts. Without this check, A's rejection would blow away B's freshly
    // rendered view and strand a permanent error panel on a route that is fine.
    // list.ts and overview.ts already guard their own error paths this way; this
    // app-wide boundary was the one that got missed. The ownership token here is
    // currentView rather than the container, because every view mounts into the
    // same container element — only currentView distinguishes navigations.
    if (currentView !== view) return;
    container.replaceChildren();
    const errorState = document.createElement('section');
    errorState.className = 'error-state';
    const heading = document.createElement('h2');
    heading.className = 'text-heading';
    heading.textContent = 'Something went wrong';
    const body = document.createElement('p');
    body.className = 'text-body';
    body.textContent = 'Check your connection and try again.';
    errorState.appendChild(heading);
    errorState.appendChild(body);
    container.appendChild(errorState);
  }
}

function onNoMatch(path: string): void {
  console.warn(`No route matched: ${path}`);
  navigateTo(ROUTES.OVERVIEW);
}

// 5. Start the router (dual-triggers: current hash immediately, plus every
// subsequent hashchange).
createRouter({ routes: ALL_ROUTES, onMatch, onNoMatch }).start();
