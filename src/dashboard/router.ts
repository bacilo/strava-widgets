/**
 * Hash router: pure parsing/matching core (fully unit tested) plus a thin
 * DOM binding (not unit tested — this repo's precedent is that every
 * `.test.ts` covers node-environment logic only; the DOM binding is verified
 * manually per RESEARCH.md's Validation Architecture).
 */

/** A resolved match: the registered route pattern, extracted params, and parsed query string. */
export interface RouteMatch {
  route: string;
  routeParams: Record<string, string>;
  query: URLSearchParams;
}

/**
 * Splits a raw `location.hash` value into a normalized path and a parsed
 * query string. Strips a leading `#`, defaults an empty result to `'/'`,
 * splits on the FIRST `?` only, and strips one trailing slash from
 * non-root paths (so `/list` and `/list/` are the same route).
 */
export function parseHash(hash: string): { path: string; query: URLSearchParams } {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const questionIndex = withoutHash.indexOf('?');
  const pathPart = questionIndex === -1 ? withoutHash : withoutHash.slice(0, questionIndex);
  const queryPart = questionIndex === -1 ? '' : withoutHash.slice(questionIndex + 1);

  let path = pathPart === '' ? '/' : pathPart;
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  return { path, query: new URLSearchParams(queryPart) };
}

/**
 * Matches a normalized path against a registry of route patterns. Iterates
 * `routes` in order so literal routes win over param routes (`ALL_ROUTES`
 * from `view.types.ts` orders `/activity/:id` last for exactly this reason).
 * A candidate segment starting with `:` is a capture. Captured values are
 * decoded with `decodeURIComponent` inside a try/catch — a malformed escape
 * sequence resolves to `null` rather than throwing.
 */
export function matchRoute(
  path: string,
  routes: readonly string[]
): { route: string; routeParams: Record<string, string> } | null {
  const pathSegments = path.split('/');

  for (const route of routes) {
    const routeSegments = route.split('/');
    if (routeSegments.length !== pathSegments.length) {
      continue;
    }

    const routeParams: Record<string, string> = {};
    let matched = true;

    for (let i = 0; i < routeSegments.length; i++) {
      const routeSegment = routeSegments[i];
      const pathSegment = pathSegments[i];

      if (routeSegment.startsWith(':')) {
        try {
          routeParams[routeSegment.slice(1)] = decodeURIComponent(pathSegment);
        } catch {
          matched = false;
          break;
        }
      } else if (routeSegment !== pathSegment) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return { route, routeParams };
    }
  }

  return null;
}

/** Composes `parseHash` and `matchRoute` into a single resolve step. */
export function resolveHash(hash: string, routes: readonly string[]): RouteMatch | null {
  const { path, query } = parseHash(hash);
  const match = matchRoute(path, routes);
  if (!match) {
    return null;
  }
  return { route: match.route, routeParams: match.routeParams, query };
}

/**
 * The single exported chokepoint every fetch-URL builder and every DOM
 * writer in plans 05-07 must call before using a route param (threat
 * T-16-RT-01). Do not duplicate this regex anywhere else in `src/dashboard/`.
 * Strava-era ids are bare digits (`3475726256`); ids ingested since the Aug
 * 2026 intervals.icu migration carry a single leading lowercase `i`
 * (`i174109928`). The 20-digit ceiling applies to the digit run only. The
 * pattern still admits no `.`, `/`, `\`, `%`, `<`, `>`, `-`, or whitespace,
 * which is the T-16-RT-01 traversal/injection guarantee.
 */
export function isValidActivityId(id: string): boolean {
  return typeof id === 'string' && /^i?\d{1,20}$/.test(id);
}

export interface RouterOptions {
  routes: readonly string[];
  onMatch(match: RouteMatch): void;
  onNoMatch(path: string): void;
}

/**
 * Binds the pure router core to the DOM. `start()` MUST resolve the current
 * `location.hash` immediately in addition to registering a `hashchange`
 * listener.
 *
 * Source: MDN Window: hashchange event —
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/hashchange_event
 * `hashchange` never fires for the hash present at initial navigation, so a
 * bookmarked `#/activity/<id>` link would render nothing without this
 * second trigger (RESEARCH.md Pitfall 1). Do not "simplify" this away to a
 * single `hashchange` listener.
 */
export function createRouter(options: RouterOptions): {
  start(): void;
  stop(): void;
  resolveNow(): void;
} {
  const { routes, onMatch, onNoMatch } = options;

  function resolveNow(): void {
    const hash = window.location.hash;
    const match = resolveHash(hash, routes);
    if (match) {
      onMatch(match);
    } else {
      onNoMatch(parseHash(hash).path);
    }
  }

  function handleHashChange(): void {
    resolveNow();
  }

  let domContentLoadedHandler: (() => void) | null = null;

  function start(): void {
    window.addEventListener('hashchange', handleHashChange);

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      resolveNow();
    } else {
      domContentLoadedHandler = () => resolveNow();
      document.addEventListener('DOMContentLoaded', domContentLoadedHandler, { once: true });
    }
  }

  function stop(): void {
    window.removeEventListener('hashchange', handleHashChange);
    if (domContentLoadedHandler) {
      document.removeEventListener('DOMContentLoaded', domContentLoadedHandler);
      domContentLoadedHandler = null;
    }
  }

  return { start, stop, resolveNow };
}

/**
 * Sets `location.hash` to navigate to `path` (plus an optional query
 * string). Views use this instead of writing `location.hash` directly.
 */
export function navigateTo(path: string, query?: URLSearchParams): void {
  const queryString = query && query.toString().length > 0 ? '?' + query.toString() : '';
  window.location.hash = '#' + path + queryString;
}
