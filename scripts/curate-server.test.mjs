/**
 * Unit tests for the pure helpers exported by curate-server.mjs (Phase 24,
 * plan 24-04). Importing curate-server.mjs must not start a server — if it
 * does, Task 1's self-execution guard is wrong and must be fixed rather than
 * worked around here.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  CURATE_HOST,
  CURATE_PORT,
  injectOverlayTag,
  isCurateRoute,
  safeResolve,
} from './curate-server.mjs';

const SOURCE = readFileSync(new URL('./curate-server.mjs', import.meta.url), 'utf8');

describe('CURATE_HOST / CURATE_PORT constants', () => {
  it('CURATE_HOST is exactly 127.0.0.1 (D-12)', () => {
    expect(CURATE_HOST).toBe('127.0.0.1');
  });

  it('the source text contains no all-interfaces wildcard bind', () => {
    expect(SOURCE.includes('0.0.0.0')).toBe(false);
  });

  it('CURATE_PORT is the number 4173 (OD-4)', () => {
    expect(CURATE_PORT).toBe(4173);
  });
});

describe('injectOverlayTag', () => {
  it('inserts the tag immediately before </body>', () => {
    const html = '<html><body><h1>App</h1></body></html>';
    const result = injectOverlayTag(html);
    expect(result).toContain('<script src="/__curate/overlay.js"></script></body>');
  });

  it('is idempotent — applying it to its own output changes nothing', () => {
    const html = '<html><body>x</body></html>';
    const once = injectOverlayTag(html);
    const twice = injectOverlayTag(once);
    expect(twice).toBe(once);
  });

  it('returns input unchanged when </body> is absent', () => {
    const html = '<html><div>no body tag here</div></html>';
    expect(injectOverlayTag(html)).toBe(html);
  });

  it('targets the LAST </body> when the literal text appears earlier inside a script or comment', () => {
    const html =
      '<html><body><script>const s = "</body>";</script><p>real content</p></body></html>';
    const result = injectOverlayTag(html);
    const lastBodyIndex = result.lastIndexOf('</body>');
    const scriptIndex = result.indexOf('<script src="/__curate/overlay.js"></script>');
    // The injected tag must sit immediately before the LAST </body>, not the
    // literal "</body>" text embedded inside the earlier <script> string.
    expect(scriptIndex).toBeGreaterThan(0);
    expect(scriptIndex + '<script src="/__curate/overlay.js"></script>'.length).toBe(lastBodyIndex);
    // And the earlier, in-string "</body>" text must be untouched.
    expect(result).toContain('const s = "</body>";');
  });
});

describe('safeResolve', () => {
  it('rejects /strava-widgets/../../etc/passwd', () => {
    expect(safeResolve('/strava-widgets/../../etc/passwd')).toBeNull();
  });

  it('rejects /etc/passwd (outside the mount prefix entirely)', () => {
    expect(safeResolve('/etc/passwd')).toBeNull();
  });

  it('rejects an encoded traversal sequence', () => {
    expect(safeResolve('/strava-widgets/%2e%2e%2f%2e%2e%2fetc/passwd')).toBeNull();
  });

  it('rejects / (outside the mount prefix)', () => {
    expect(safeResolve('/')).toBeNull();
  });

  it('/strava-widgets/ and /strava-widgets both resolve to a path ending in dist/widgets/index.html', () => {
    const withSlash = safeResolve('/strava-widgets/');
    const withoutSlash = safeResolve('/strava-widgets');
    expect(withSlash).not.toBeNull();
    expect(withoutSlash).not.toBeNull();
    expect(withSlash.endsWith('dist/widgets/index.html')).toBe(true);
    expect(withoutSlash.endsWith('dist/widgets/index.html')).toBe(true);
  });
});

describe('isCurateRoute', () => {
  it('the public exclusions data file is a static route, never a curate route', () => {
    // NEVER-CATCH GUARANTEE (hard constraint 1): /data/best-effort-exclusions.json
    // is PUBLIC — already published by build-widgets.mjs, already asserted
    // 200-and-parses at verify-dashboard-publish.mjs:294, and fetched at
    // runtime by detail.ts and records.ts. isCurateRoute must classify it as
    // static, and safeResolve must resolve it under dist/widgets.
    const publicPath = '/strava-widgets/data/best-effort-exclusions.json';
    expect(isCurateRoute(publicPath)).toBe(false);
    const resolved = safeResolve(publicPath);
    expect(resolved).not.toBeNull();
    expect(resolved.includes('dist/widgets')).toBe(true);
  });

  it('is true for /__curate, /__curate/health, /__curate/overlay.js, /__curate/exclusions/123', () => {
    expect(isCurateRoute('/__curate')).toBe(true);
    expect(isCurateRoute('/__curate/health')).toBe(true);
    expect(isCurateRoute('/__curate/overlay.js')).toBe(true);
    expect(isCurateRoute('/__curate/exclusions/123')).toBe(true);
  });

  it('is false for /__curatex/health and /strava-widgets/__curate/health', () => {
    expect(isCurateRoute('/__curatex/health')).toBe(false);
    expect(isCurateRoute('/strava-widgets/__curate/health')).toBe(false);
  });
});
