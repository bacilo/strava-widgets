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
  applyRemove,
  applyUpsert,
  injectOverlayTag,
  isCurateRoute,
  isTrustedOrigin,
  isValidCurateActivityId,
  normalizeReason,
  safeResolve,
} from './curate-server.mjs';

const SOURCE = readFileSync(new URL('./curate-server.mjs', import.meta.url), 'utf8');

// D-05: a literal in-test fixture mirroring the live data/best-effort-exclusions.json
// shape (schemaVersion: 1, a note string, two real entries with distances: null).
// NEVER read or write the real archive file from a test — a fresh copy is
// returned every call so tests can't leak mutations into one another.
function fixtureDoc() {
  return {
    schemaVersion: 1,
    note: 'Hand-maintained by the developer. Read by `node dist/index.js compute-best-efforts` to withhold specific activities from PR marking and ranking while still computing and retaining their efforts, flagged `excludedFromRecords`.',
    exclusions: [
      {
        activityId: '3475726256',
        distances: null,
        reason: 'Recorded with an inaccurate GPS device; its 400m time is not trusted as a genuine personal record.',
      },
      {
        activityId: '3475725513',
        distances: null,
        reason: 'Recorded with the same inaccurate GPS device class; its 1k time is not trusted as a genuine personal record.',
      },
    ],
  };
}

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

describe('applyUpsert (D-05/D-06)', () => {
  it('a new activity appends an entry deep-equal to { activityId, distances: null, reason }', () => {
    const result = applyUpsert(fixtureDoc(), '9999999999', 'A brand new exclusion.');
    expect(result.exclusions).toHaveLength(3);
    expect(result.exclusions[2]).toEqual({
      activityId: '9999999999',
      distances: null,
      reason: 'A brand new exclusion.',
    });
  });

  it('an existing activity is replaced AT THE SAME INDEX; array length is unchanged', () => {
    const doc = fixtureDoc();
    const result = applyUpsert(doc, '3475726256', 'Edited reason.');
    expect(result.exclusions).toHaveLength(2);
    expect(result.exclusions[0].activityId).toBe('3475726256');
    expect(result.exclusions[0].reason).toBe('Edited reason.');
    // The sibling entry stays untouched at its own index.
    expect(result.exclusions[1].activityId).toBe('3475725513');
  });

  it('does not mutate the input document', () => {
    const doc = fixtureDoc();
    const clone = JSON.parse(JSON.stringify(doc));
    applyUpsert(doc, '3475726256', 'Edited reason.');
    applyUpsert(doc, '1234567890', 'New reason.');
    expect(doc).toEqual(clone);
  });

  it('schemaVersion and note survive unchanged', () => {
    const doc = fixtureDoc();
    const result = applyUpsert(doc, '1234567890', 'A reason.');
    expect(result.schemaVersion).toBe(doc.schemaVersion);
    expect(result.note).toBe(doc.note);
  });

  it('distances is strictly null — not merely falsy, so [] and undefined both fail', () => {
    const result = applyUpsert(fixtureDoc(), '1234567890', 'A reason.');
    const entry = result.exclusions.find((e) => e.activityId === '1234567890');
    expect(entry.distances).toBe(null);
    expect(Array.isArray(entry.distances)).toBe(false);
    expect(entry.distances).not.toBeUndefined();
  });
});

describe('applyRemove (D-05, the untick rule)', () => {
  it('the entry is gone and the array is one shorter', () => {
    const doc = fixtureDoc();
    const result = applyRemove(doc, '3475726256');
    expect(result.exclusions).toHaveLength(doc.exclusions.length - 1);
    expect(result.exclusions.find((e) => e.activityId === '3475726256')).toBeUndefined();
  });

  it('never leaves distances: [] — buildExclusionIndex silently skips such an entry, so the file would read as excluded while excluding nothing', () => {
    const result = applyRemove(fixtureDoc(), '3475726256');
    expect(JSON.stringify(result)).not.toContain('"distances":[]');
  });

  it('removing an activity that is not present is a no-op returning an equal document', () => {
    const doc = fixtureDoc();
    const result = applyRemove(doc, '0000000000');
    expect(result).toEqual(doc);
  });

  it('removing when duplicate entries exist for the same activity removes ALL of them', () => {
    const doc = fixtureDoc();
    doc.exclusions.push({
      activityId: '3475726256',
      distances: null,
      reason: 'A duplicate entry for the same activity.',
    });
    const result = applyRemove(doc, '3475726256');
    expect(result.exclusions.find((e) => e.activityId === '3475726256')).toBeUndefined();
    expect(result.exclusions).toHaveLength(1);
  });
});

describe('isValidCurateActivityId (ASVS V5)', () => {
  it('accepts 3475726256 and i12345', () => {
    expect(isValidCurateActivityId('3475726256')).toBe(true);
    expect(isValidCurateActivityId('i12345')).toBe(true);
  });

  it('rejects __proto__, constructor, ../../etc/passwd, ..%2f..%2fetc, the empty string, 12a, and a 21-digit string', () => {
    expect(isValidCurateActivityId('__proto__')).toBe(false);
    expect(isValidCurateActivityId('constructor')).toBe(false);
    expect(isValidCurateActivityId('../../etc/passwd')).toBe(false);
    expect(isValidCurateActivityId('..%2f..%2fetc')).toBe(false);
    expect(isValidCurateActivityId('')).toBe(false);
    expect(isValidCurateActivityId('12a')).toBe(false);
    expect(isValidCurateActivityId('1'.repeat(21))).toBe(false);
  });
});

describe('normalizeReason (D-08 server-side half)', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeReason('  GPS device unreliable  ')).toBe('GPS device unreliable');
  });

  it('rejects empty, whitespace-only, non-string and over-length input', () => {
    expect(normalizeReason('')).toBeNull();
    expect(normalizeReason('   ')).toBeNull();
    expect(normalizeReason(null)).toBeNull();
    expect(normalizeReason(undefined)).toBeNull();
    expect(normalizeReason(123)).toBeNull();
    expect(normalizeReason({})).toBeNull();
    expect(normalizeReason('x'.repeat(2001))).toBeNull();
    expect(normalizeReason('x'.repeat(2000))).toBe('x'.repeat(2000));
  });
});

describe('isTrustedOrigin (D-12)', () => {
  const expectedHost = '127.0.0.1:4173';
  const req = (host, origin) => ({
    headers: origin === undefined ? { host } : { host, origin },
  });

  it('accepts a matching Host with no Origin header', () => {
    expect(isTrustedOrigin(req(expectedHost), expectedHost)).toBe(true);
  });

  it('accepts a matching Host and a matching Origin', () => {
    expect(isTrustedOrigin(req(expectedHost, 'http://127.0.0.1:4173'), expectedHost)).toBe(true);
  });

  it('rejects a matching Host with a cross-origin Origin', () => {
    expect(isTrustedOrigin(req(expectedHost, 'http://evil.example'), expectedHost)).toBe(false);
  });

  it('rejects a mismatched Host even with a matching Origin', () => {
    expect(isTrustedOrigin(req('evil.example', 'http://127.0.0.1:4173'), expectedHost)).toBe(
      false
    );
  });

  it('rejects a malformed Origin header rather than throwing', () => {
    expect(isTrustedOrigin(req(expectedHost, '::::'), expectedHost)).toBe(false);
  });

  it('rejects a Host/Origin pair differing only by port', () => {
    expect(isTrustedOrigin(req(expectedHost, 'http://127.0.0.1:9999'), expectedHost)).toBe(false);
  });
});

describe('source discipline (D-09)', () => {
  const nonCommentLines = SOURCE.split('\n').filter(
    (line) => !/^\s*\*/.test(line) && !/^\s*\/\//.test(line)
  );

  it("scripts/curate-server.mjs contains no 'git' spawn argument", () => {
    expect(nonCommentLines.some((line) => line.includes("'git'"))).toBe(false);
  });

  it('scripts/curate-server.mjs contains no all-interfaces wildcard bind', () => {
    expect(SOURCE.includes('0.0.0.0')).toBe(false);
  });
});
