/**
 * View registry record shape and canonical route/nav tables (D-03, D-05).
 *
 * Types and constants ONLY — no `mount` implementations and no imports of
 * any view module, so this file stays a leaf that the stub views (plan 06)
 * and the real registry (plan 07) can both import without a cycle.
 *
 * D-03 extension rule: adding a future view means adding one module plus
 * one entry in the registry array (`view-registry.ts`, plan 07) and, if it
 * needs a nav slot, one entry in the nav-order table below.
 */

/** Context passed to a view's `mount` function. */
export interface ViewMountContext {
  container: HTMLElement;
  routeParams: Record<string, string>;
  query: URLSearchParams;
}

/** One entry in the view registry. `navEntry` is omitted for drill-in routes — how the detail view stays out of the nav bar (D-05). */
export interface DashboardView {
  route: string;
  title: string;
  navEntry?: { label: string; order: number };
  mount(ctx: ViewMountContext): void | Promise<void>;
  unmount?(): void;
}

/** Canonical route table — the single source of truth for every hash path in the dashboard. */
export const ROUTES = Object.freeze({
  OVERVIEW: '/',
  LIST: '/list',
  CALENDAR: '/calendar',
  RECORDS: '/records',
  TRENDS: '/trends',
  DETAIL: '/activity/:id',
} as const);

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Every value of `ROUTES`, with `'/activity/:id'` ordered last so a
 * literal-segment match is attempted before the param pattern — the
 * router's matcher is order-sensitive.
 */
export const ALL_ROUTES: readonly string[] = [
  ROUTES.OVERVIEW,
  ROUTES.LIST,
  ROUTES.CALENDAR,
  ROUTES.RECORDS,
  ROUTES.TRENDS,
  ROUTES.DETAIL,
];

/** The UI-SPEC nav contract (D-05). `ROUTES.DETAIL` must NOT appear — it is a drill-in route only. */
export const NAV_ORDER: readonly { route: string; label: string; order: number }[] = [
  { route: ROUTES.OVERVIEW, label: 'Overview', order: 1 },
  { route: ROUTES.LIST, label: 'Activities', order: 2 },
  { route: ROUTES.CALENDAR, label: 'Calendar', order: 3 },
  { route: ROUTES.RECORDS, label: 'Records', order: 4 },
  { route: ROUTES.TRENDS, label: 'Trends', order: 5 },
];

/** Which future phase ships each stub view's real content — interpolated into the UI-SPEC empty-state body copy. Calendar shipped in Phase 17 and is no longer a stub. */
export const STUB_PHASE: Readonly<Record<string, '17' | '18'>> = {
  [ROUTES.RECORDS]: '18',
  [ROUTES.TRENDS]: '18',
};
