/**
 * The single enumeration point mapping routes to view modules (D-03).
 * Mirrors `scripts/build-widgets.mjs`'s `widgets` array: one flat array,
 * one entry per unit, one place to add the next one.
 *
 * Extension rule: to add a Phase 18 view, create `src/dashboard/views/<name>.ts`,
 * add its route to `ROUTES` and `ALL_ROUTES` in `view.types.ts`, add one line
 * to `VIEWS` below, and — only if it needs a nav slot — one entry to
 * `NAV_ORDER` (also in `view.types.ts`).
 */

import type { DashboardView } from './view.types.js';
import { createIndexClient } from './data/index-client.js';
import { createDetailClient } from './data/detail-client.js';
import { createOverviewView } from './views/overview.js';
import { createListView } from './views/list.js';
import { createDetailView } from './views/detail.js';
import { calendarView } from './views/calendar.stub.js';
import { recordsView } from './views/records.stub.js';
import { trendsView } from './views/trends.stub.js';

const indexClient = createIndexClient();
const detailClient = createDetailClient();

/** Shared clients, constructed exactly once, so `main.ts` can prefetch the index without re-instantiating either client. */
export const clients = { indexClient, detailClient };

export const VIEWS: readonly DashboardView[] = [
  createOverviewView({ indexClient }),
  createListView({ indexClient }),
  calendarView,
  recordsView,
  trendsView,
  createDetailView({ detailClient, indexClient }),
];

const viewsByRoute = new Map<string, DashboardView>(VIEWS.map((view) => [view.route, view]));

/** O(1) lookup, backed by a `Map` built once from `VIEWS`. */
export function getView(route: string): DashboardView | undefined {
  return viewsByRoute.get(route);
}
