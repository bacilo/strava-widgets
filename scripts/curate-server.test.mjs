/**
 * Unit tests for the pure helpers exported by curate-server.mjs (Phase 24,
 * plan 24-04). Importing curate-server.mjs must not start a server — if it
 * does, Task 1's self-execution guard is wrong and must be fixed rather than
 * worked around here.
 */

import http from 'node:http';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  CURATE_HOST,
  CURATE_PORT,
  CURATE_PREFIX,
  EXCLUSIONS_PATH,
  MOUNT_PREFIX,
  PUBLISH_EXCLUSIONS_PATH,
  REVIEWED_PATH,
  MAX_BODY_BYTES,
  REVIEWED_NOTE,
  applyRemove,
  applyReviewRemove,
  applyReviewUpsert,
  applyUpsert,
  buildQueueBundle,
  createServer,
  extractStylesheetHref,
  injectOverlayTag,
  isCurateRoute,
  isTrustedOrigin,
  isValidCurateActivityId,
  normalizeFingerprint,
  normalizeReason,
  readReviewedFile,
  renderQueuePage,
  resolveServerPaths,
  safeResolve,
  sharedActivityIds,
} from './curate-server.mjs';

const SOURCE = readFileSync(new URL('./curate-server.mjs', import.meta.url), 'utf8');

// Mirrors curate-server.mjs's own ROOT/INDEX_HTML computation — the liveness
// suite below only runs when the real build artifact it serves exists.
const INDEX_HTML = resolve(process.cwd(), 'dist/widgets/index.html');

// T-37-12: file-scoped guard. No test in this file may write or git-checkout
// a tracked file, so the SHA-256 of both tracked curation files must be
// identical before and after the whole suite. Reads only; a missing file
// hashes as the literal string 'absent'.
const TRACKED_FILES_UNDER_GUARD = [EXCLUSIONS_PATH, REVIEWED_PATH];

function sha256OrAbsent(path) {
  const abs = resolve(process.cwd(), path);
  if (!existsSync(abs)) return 'absent';
  return createHash('sha256').update(readFileSync(abs)).digest('hex');
}

describe('tracked-file SHA guard (T-37-12)', () => {
  let before;

  beforeAll(() => {
    before = Object.fromEntries(TRACKED_FILES_UNDER_GUARD.map((p) => [p, sha256OrAbsent(p)]));
  });

  afterAll(() => {
    const after = Object.fromEntries(TRACKED_FILES_UNDER_GUARD.map((p) => [p, sha256OrAbsent(p)]));
    expect(after).toEqual(before);
  });

  it('hashes both tracked paths at suite start', () => {
    expect(Object.keys(before).sort()).toEqual([EXCLUSIONS_PATH, REVIEWED_PATH].sort());
  });
});

describe('resolveServerPaths (path injection)', () => {
  it('with no argument resolves to exactly the module constants', () => {
    expect(resolveServerPaths()).toEqual({
      exclusionsPath: EXCLUSIONS_PATH,
      publishExclusionsPath: PUBLISH_EXCLUSIONS_PATH,
      publishRoot: resolve(process.cwd(), 'dist/widgets'),
      reviewedPath: REVIEWED_PATH,
    });
  });

  it('one override leaves the other three at their defaults', () => {
    const defaults = resolveServerPaths();
    const overridden = resolveServerPaths({ exclusionsPath: '/tmp/x.json' });
    expect(overridden.exclusionsPath).toBe('/tmp/x.json');
    expect(overridden.publishExclusionsPath).toBe(defaults.publishExclusionsPath);
    expect(overridden.publishRoot).toBe(defaults.publishRoot);
    expect(overridden.reviewedPath).toBe(defaults.reviewedPath);
  });
});

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

// Plan 29-06 Task 1: extractStylesheetHref resolves the queue page's
// stylesheet href from dist/widgets/index.html's real, content-hashed
// <link> tag at request time (PD-02). Never throws — a malformed built
// index.html must degrade the queue to an unstyled page, not a 500.
describe('extractStylesheetHref', () => {
  it('resolves a mount-prefixed href from a stylesheet link with crossorigin before href', () => {
    const html = '<link rel="stylesheet" crossorigin href="./assets/index-ABC.css">';
    expect(extractStylesheetHref(html)).toBe('/strava-widgets/assets/index-ABC.css');
  });

  it('attribute order is irrelevant — href before rel resolves identically', () => {
    const html = '<link href="./assets/index-ABC.css" crossorigin rel="stylesheet">';
    expect(extractStylesheetHref(html)).toBe('/strava-widgets/assets/index-ABC.css');
  });

  it('single-quoted attributes resolve identically', () => {
    const html = "<link rel='stylesheet' href='./assets/index-ABC.css'>";
    expect(extractStylesheetHref(html)).toBe('/strava-widgets/assets/index-ABC.css');
  });

  it('an already root-absolute href is returned unchanged, not double-prefixed', () => {
    const html = '<link rel="stylesheet" href="/strava-widgets/assets/x.css">';
    expect(extractStylesheetHref(html)).toBe('/strava-widgets/assets/x.css');
  });

  it('returns null, never throws, when there is no stylesheet link', () => {
    expect(extractStylesheetHref('<html><head></head><body></body></html>')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractStylesheetHref('')).toBeNull();
  });

  it('returns null, never throws, for malformed HTML', () => {
    expect(extractStylesheetHref('<link rel="stylesheet" href=')).toBeNull();
  });

  it('a non-stylesheet link (rel="icon") is not mistaken for the stylesheet', () => {
    const html = '<link rel="icon" href="./favicon.ico">';
    expect(extractStylesheetHref(html)).toBeNull();
  });

  it('picks the stylesheet link out of a real head containing a module script tag first', () => {
    const html =
      '<script type="module" crossorigin src="./assets/index-BZIqZhAY.js"></script>' +
      '<link rel="stylesheet" crossorigin href="./assets/index-CQkdBpPg.css">';
    expect(extractStylesheetHref(html)).toBe('/strava-widgets/assets/index-CQkdBpPg.css');
  });
});

// Plan 29-06 Task 1 / PD-02: renderQueuePage is a pure, exported, never-throw
// shell string function beside injectOverlayTag — the same shape precedent.
// No inline script, no inline style (CSP forbids both).
describe('renderQueuePage', () => {
  it('returns a full document with doctype, charset meta, CSP meta, linked stylesheet, title and bundle script', () => {
    const html = renderQueuePage('/strava-widgets/assets/index-ABC.css');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("script-src 'self'");
    expect(html).toContain('<link rel="stylesheet" href="/strava-widgets/assets/index-ABC.css">');
    expect(html).toMatch(/<title>[^<]*[Rr]eview [Qq]ueue[^<]*<\/title>/);
    expect(html).toContain('<script src="/__curate/queue.js"></script>');
  });

  it('with a null href, omits the stylesheet link entirely rather than emitting a literal "null" href', () => {
    const html = renderQueuePage(null);
    expect(html).not.toContain('<link rel="stylesheet"');
    expect(html).not.toContain('href="null"');
    expect(html).toContain('<script src="/__curate/queue.js"></script>');
  });

  it('contains no inline <script> body — the CSP forbids it', () => {
    const html = renderQueuePage(null);
    // Only the one bundle-loading <script src="..."> tag; no <script> with a body.
    expect(html).not.toMatch(/<script(?![^>]*src=)[^>]*>[^<]+<\/script>/);
  });

  it('contains no inline <style> block — the CSP forbids it', () => {
    const html = renderQueuePage(null);
    expect(html).not.toContain('<style');
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

  // GAP-24-03 / CR-01: a malformed percent-escape must be REJECTED exactly
  // like a traversal (returning null), not thrown out of the function.
  // decodeURIComponent throws URIError: URI malformed on each of these three
  // shapes; unguarded, that throw reaches the http request listener as an
  // uncaught exception and kills the whole curate process (D-11 — this case
  // is observed RED against the unfixed source before the fix lands).
  it('rejects /strava-widgets/% (a malformed percent-escape), exactly like a traversal', () => {
    expect(safeResolve('/strava-widgets/%')).toBeNull();
  });

  it('rejects /strava-widgets/%zz (a malformed percent-escape), exactly like a traversal', () => {
    expect(safeResolve('/strava-widgets/%zz')).toBeNull();
  });

  it('rejects /strava-widgets/%e0%a4%a (a malformed percent-escape), exactly like a traversal', () => {
    expect(safeResolve('/strava-widgets/%e0%a4%a')).toBeNull();
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

// GAP-24-03 / CR-01 / D-11: real-socket liveness and gate suite, exercising
// the SHIPPED createServer() over an ephemeral port rather than asserting
// about source text. Depends on dist/widgets/index.html existing (a real
// `npm run build-widgets` output), so it is skipped on a checkout with no
// build — recorded in the plan SUMMARY whether it ran or skipped.
//
// Before the fix lands, `GET /%` throws URIError out of safeResolve with no
// try/catch anywhere between it and the http request listener. That is an
// UNCAUGHT EXCEPTION inside a live http server's request handler, which Node
// treats as fatal to the whole process — not a rejected promise, not an
// assertion failure. Depending on timing this suite either fails cases 1/3/4
// outright or aborts the entire vitest worker process with an uncaught
// URIError before those assertions ever run. Both shapes count as RED
// evidence for D-11; see the plan SUMMARY for which one was observed.
describe.skipIf(!existsSync(INDEX_HTML))(
  'static route liveness & Origin/Host gate (D-11, D-12, GAP-24-03)',
  () => {
    let server;
    let port;

    beforeAll(async () => {
      // Plan 29-06 Task 3: build the queue bundle once so the
      // /__curate/queue.js route below has something real to serve.
      await buildQueueBundle();
      return new Promise((settle) => {
        server = createServer();
        server.listen(0, '127.0.0.1', () => {
          port = server.address().port;
          settle();
        });
      });
    });

    afterAll(() => {
      return new Promise((settle) => {
        server.close(() => settle());
      });
    });

    // EXPECTED_HOST is module-local (never exported) and resolves to the
    // literal '127.0.0.1:4173' — the gate compares req.headers.host against
    // that literal, not against the ephemeral test port, so every request
    // below must send it explicitly via a default header.
    function request(path, headers = {}) {
      return new Promise((settle, reject) => {
        const req = http.request(
          {
            host: '127.0.0.1',
            port,
            path,
            headers: { Host: '127.0.0.1:4173', ...headers },
          },
          (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
              settle({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
            });
          }
        );
        req.on('error', reject);
        req.end();
      });
    }

    it('case 1: GET /% with a matching Host responds 4xx and does not kill the process', async () => {
      const { status } = await request('/%');
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
    });

    it('case 2: immediately after, GET /strava-widgets/ still responds 200 with the overlay tag — the liveness proof', async () => {
      const { status, body } = await request(`${MOUNT_PREFIX}/`);
      expect(status).toBe(200);
      expect(body).toContain('<script src="/__curate/overlay.js"></script>');
    });

    it('case 3: GET /strava-widgets/ with a cross-origin Origin responds 403', async () => {
      const { status } = await request(`${MOUNT_PREFIX}/`, { Origin: 'http://evil.example' });
      expect(status).toBe(403);
    });

    it('case 4: GET /strava-widgets/ with a mismatched Host responds 403', async () => {
      const { status } = await request(`${MOUNT_PREFIX}/`, { Host: 'evil.example' });
      expect(status).toBe(403);
    });

    it('case 5 (control): GET /strava-widgets/ with a matching Host and no Origin responds 200 — an ordinary navigation is not broken by the new gate (D-02/OD-4)', async () => {
      const { status } = await request(`${MOUNT_PREFIX}/`);
      expect(status).toBe(200);
    });

    // Plan 29-06 Task 3: the two queue routes, live over the same socket,
    // including the origin gate in both directions (T-29-01).
    it('case 6: GET /__curate/queue with a matching Host and no Origin responds 200 carrying the bundle script tag and the live-resolved stylesheet href', async () => {
      const { status, body } = await request(`${CURATE_PREFIX}/queue`);
      expect(status).toBe(200);
      expect(body).toContain('<script src="/__curate/queue.js"></script>');
      const expectedHref = extractStylesheetHref(readFileSync(INDEX_HTML, 'utf8'));
      expect(expectedHref).not.toBeNull();
      expect(body).toContain(`href="${expectedHref}"`);
    });

    it('case 7: GET /__curate/queue with a cross-origin Origin responds 403', async () => {
      const { status } = await request(`${CURATE_PREFIX}/queue`, { Origin: 'http://evil.example' });
      expect(status).toBe(403);
    });

    it('case 8: GET /__curate/queue with a mismatched Host responds 403', async () => {
      const { status } = await request(`${CURATE_PREFIX}/queue`, { Host: 'evil.example' });
      expect(status).toBe(403);
    });

    // T-29-16 / D-06 corroboration: the queue bundle really carries the
    // imported saveExclusion/removeExclusion/runRecompute transport, not a
    // stub. esbuild does not fold the CURATE_PREFIX const into the
    // surrounding template-literal text it appears in (confirmed
    // independently in 29-05-SUMMARY.md's Deviations, reproduced here), so
    // the literal substring '/__curate/exclusions/' never appears in either
    // a minified or unminified bundle — the check below is the corrected
    // equivalent proving the same guarantee: the CURATE_PREFIX constant is
    // present, its template-literal boundary with the route suffixes is
    // intact, and location.reload (the transport's own post-write refresh)
    // is present.
    it('case 9: GET /__curate/queue.js with a matching Host responds 200 carrying the real imported transport, not a stub', async () => {
      const { status, body } = await request(`${CURATE_PREFIX}/queue.js`);
      expect(status).toBe(200);
      expect(body).toContain('CURATE_PREFIX = "/__curate"');
      expect(body).toMatch(/CURATE_PREFIX\}\/exclusions\//);
      expect(body).toMatch(/CURATE_PREFIX\}\/recompute/);
      expect(body).toContain('location.reload');
    });

    it('case 10: GET /__curate/queue.js with a cross-origin Origin responds 403', async () => {
      const { status } = await request(`${CURATE_PREFIX}/queue.js`, {
        Origin: 'http://evil.example',
      });
      expect(status).toBe(403);
    });

    it('case 11 (control): GET /strava-widgets/ still responds 200 with the overlay tag — the new queue branches did not disturb existing dispatch', async () => {
      const { status, body } = await request(`${MOUNT_PREFIX}/`);
      expect(status).toBe(200);
      expect(body).toContain('<script src="/__curate/overlay.js"></script>');
    });

    // T-29-05: both queue branches are exact string comparisons with no
    // filesystem-path derivation, so a traversal attempt under the queue
    // path never reaches a resolver to protect — it simply fails to match
    // either exact route and falls through to the generic 404.
    it('case 12: GET /__curate/queue/../../etc/passwd responds 404 — the exact-match branches never reach a filesystem resolution', async () => {
      const { status } = await request(`${CURATE_PREFIX}/queue/../../etc/passwd`);
      expect(status).toBe(404);
    });
  }
);

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

// GAP-24-03 / CR-01 / D-11: pins the fix's defence-in-depth shape so a future
// refactor cannot silently re-introduce the asymmetry between createServer's
// two branches — the curate branch was always wrapped with a .catch(), the
// static branch was not. This case reads source text deliberately (not
// in-process behaviour) so it runs even on a checkout with no build, unlike
// the describe.skipIf liveness suite above. Written and observed RED here in
// Task 1, against the unfixed source: respond500 does not exist anywhere in
// the file yet (the 500 logic is inline at the bottom of createServer today)
// and the listener body has no try. Re-run and recorded GREEN in Task 3
// after Task 2's fix lands.
describe('listener symmetry (D-11, GAP-24-03)', () => {
  it("createServer's listener body wraps both branches identically — it contains both 'try' and 'respond500'", () => {
    const start = SOURCE.indexOf('function createServer');
    expect(start).toBeGreaterThan(-1);
    const rest = SOURCE.slice(start);
    const bodyEnd = rest.indexOf('\n}');
    const body = bodyEnd === -1 ? rest : rest.slice(0, bodyEnd);
    expect(body).toContain('try');
    expect(body).toContain('respond500');
  });
});

// --- CUR-04: reviewed-and-kept helpers (D-05, D-13, D-14) -----------------

function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const reviewedEntry = (id, reason = 'Looked at it; the pace is real.') => ({
  activityId: id,
  reason,
  reviewedAt: '2026-11-25T10:00:00.000Z',
  fingerprint: '1k:demoted:ceiling|t=0',
});

const reviewedDoc = (...ids) => ({
  schemaVersion: 1,
  note: 'n',
  reviewed: ids.map((id) => reviewedEntry(id)),
});

describe('applyReviewUpsert (D-05, D-13)', () => {
  it('appends when the id is absent', () => {
    const result = applyReviewUpsert(reviewedDoc('1', '2'), reviewedEntry('3'));
    expect(result.reviewed.map((e) => e.activityId)).toEqual(['1', '2', '3']);
  });

  it('replaces at the same index when the id is present and leaves the others byte-identical', () => {
    const doc = reviewedDoc('1', '2', '3');
    const next = reviewedEntry('2', 'A newer reason.');
    const result = applyReviewUpsert(doc, next);
    expect(result.reviewed).toHaveLength(3);
    expect(result.reviewed[1]).toEqual(next);
    expect(JSON.stringify(result.reviewed[0])).toBe(JSON.stringify(doc.reviewed[0]));
    expect(JSON.stringify(result.reviewed[2])).toBe(JSON.stringify(doc.reviewed[2]));
  });

  it('never mutates its input (deep-frozen)', () => {
    const doc = deepFreeze(reviewedDoc('1', '2'));
    expect(() => applyReviewUpsert(doc, reviewedEntry('2', 'x'))).not.toThrow();
    expect(() => applyReviewUpsert(doc, reviewedEntry('9'))).not.toThrow();
  });

  it('carries schemaVersion and note through', () => {
    const result = applyReviewUpsert(reviewedDoc('1'), reviewedEntry('2'));
    expect(result.schemaVersion).toBe(1);
    expect(result.note).toBe('n');
  });
});

describe('applyReviewRemove (D-14)', () => {
  it('removes every entry for the id, including duplicates, and leaves the others', () => {
    const result = applyReviewRemove(reviewedDoc('1', '2', '2', '3'), '2');
    expect(result.reviewed.map((e) => e.activityId)).toEqual(['1', '3']);
  });

  it('writes no tombstone and does not mutate its input', () => {
    const doc = deepFreeze(reviewedDoc('1', '2'));
    const result = applyReviewRemove(doc, '1');
    expect(result.reviewed).toHaveLength(1);
    expect(result.reviewed[0].activityId).toBe('2');
  });

  it('removing an absent id returns an equal document', () => {
    const doc = reviewedDoc('1');
    expect(applyReviewRemove(doc, '9')).toEqual(doc);
  });
});

describe('normalizeFingerprint (T-37-07)', () => {
  it.each(['1k:demoted:ceiling,400m:contaminated:unreliable-segment|t=0', '1k:demoted:ceiling|t=1', '|t=0'])(
    'accepts %s unchanged',
    (fp) => {
      expect(normalizeFingerprint(fp)).toBe(fp);
    }
  );

  it.each([
    ['empty', ''],
    ['non-string', 5],
    ['null', null],
    ['2001 chars', 'a'.repeat(2001)],
    ['markup', '<script>'],
    ['a space', 'a b'],
  ])('rejects %s', (_label, raw) => {
    expect(normalizeFingerprint(raw)).toBe(null);
  });

  it('accepts exactly 2000 chars', () => {
    expect(normalizeFingerprint('a'.repeat(2000))).toBe('a'.repeat(2000));
  });
});

describe('readReviewedFile', () => {
  let dir;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'curate-readreviewed-'));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('a missing file reads as the default document', () => {
    expect(readReviewedFile(join(dir, 'absent.json'))).toEqual({
      schemaVersion: 1,
      note: REVIEWED_NOTE,
      reviewed: [],
    });
  });

  it('invalid JSON throws', () => {
    const p = join(dir, 'bad.json');
    writeFileSync(p, '{not json');
    expect(() => readReviewedFile(p)).toThrow();
  });

  it('a non-array reviewed throws', () => {
    const p = join(dir, 'shape.json');
    writeFileSync(p, JSON.stringify({ schemaVersion: 1, reviewed: {} }));
    expect(() => readReviewedFile(p)).toThrow(/reviewed/);
  });

  it('a valid file is returned as parsed', () => {
    const p = join(dir, 'ok.json');
    writeFileSync(p, JSON.stringify(reviewedDoc('7')));
    expect(readReviewedFile(p)).toEqual(reviewedDoc('7'));
  });
});

// Real-socket write tests. Every path is injected and lives under one
// mkdtemp directory: this suite never touches a tracked file (T-37-12) and
// never touches dist/widgets, so it is NOT skipped on a checkout with no
// build.
describe('reviewed routes over a real socket, temporary paths (D-16, D-11)', () => {
  let server;
  let port;
  let tmp;
  let paths;
  const exclusionsFixture = () =>
    JSON.stringify(
      {
        schemaVersion: 1,
        note: 'n',
        exclusions: [{ activityId: '5550001', distances: null, reason: 'Bad GPS.' }],
      },
      null,
      2
    ) + '\n';

  function call(method, path, { body, headers = {}, raw } = {}) {
    return new Promise((settle) => {
      const payload = raw ?? (body === undefined ? undefined : JSON.stringify(body));
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            Host: '127.0.0.1:4173',
            ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...headers,
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () =>
            settle({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') })
          );
        }
      );
      req.on('error', (e) => settle({ status: 'error', body: String(e.code ?? e.message) }));
      req.end(payload);
    });
  }

  function listTree(dir) {
    const out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) out.push(...listTree(p));
      else out.push(p);
    }
    return out;
  }

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'curate-reviewed-'));
    paths = {
      exclusionsPath: join(tmp, 'data', 'best-effort-exclusions.json'),
      publishRoot: join(tmp, 'publish'),
      publishExclusionsPath: join(tmp, 'publish', 'data', 'best-effort-exclusions.json'),
      reviewedPath: join(tmp, 'data', 'curation', 'reviewed.json'),
    };
    mkdirSync(join(tmp, 'data'), { recursive: true });
    mkdirSync(paths.publishRoot, { recursive: true });
    await new Promise((settle) => {
      server = createServer(paths);
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        settle();
      });
    });
  });

  beforeEach(() => {
    writeFileSync(paths.exclusionsPath, exclusionsFixture());
    rmSync(join(tmp, 'data', 'curation'), { recursive: true, force: true });
    rmSync(paths.publishRoot, { recursive: true, force: true });
    mkdirSync(paths.publishRoot, { recursive: true });
  });

  afterAll(async () => {
    await new Promise((settle) => server.close(() => settle()));
    rmSync(tmp, { recursive: true, force: true });
  });

  const put = (id, body, extra) =>
    call('PUT', `${CURATE_PREFIX}/reviewed/${id}`, { body, ...extra });
  const seedReviewed = (doc) => {
    mkdirSync(join(tmp, 'data', 'curation'), { recursive: true });
    writeFileSync(paths.reviewedPath, JSON.stringify(doc, null, 2) + '\n');
  };
  const seedCorrupt = () => {
    mkdirSync(join(tmp, 'data', 'curation'), { recursive: true });
    writeFileSync(paths.reviewedPath, '{corrupt');
  };

  describe('GET /__curate/reviewed', () => {
    it('with no file responds 200 and the default document', async () => {
      const { status, body } = await call('GET', `${CURATE_PREFIX}/reviewed`);
      expect(status).toBe(200);
      expect(JSON.parse(body)).toEqual({ schemaVersion: 1, note: REVIEWED_NOTE, reviewed: [] });
    });

    it('with a valid file responds 200 and the file contents', async () => {
      seedReviewed(reviewedDoc('777'));
      const { status, body } = await call('GET', `${CURATE_PREFIX}/reviewed`);
      expect(status).toBe(200);
      expect(JSON.parse(body)).toEqual(reviewedDoc('777'));
    });

    it('with a corrupt file responds 500', async () => {
      seedCorrupt();
      const { status } = await call('GET', `${CURATE_PREFIX}/reviewed`);
      expect(status).toBe(500);
    });

    it('with a cross-origin Origin responds 403', async () => {
      const { status } = await call('GET', `${CURATE_PREFIX}/reviewed`, {
        headers: { Origin: 'http://evil.example' },
      });
      expect(status).toBe(403);
    });

    it('with a mismatched Host responds 403', async () => {
      const { status } = await call('GET', `${CURATE_PREFIX}/reviewed`, {
        headers: { Host: 'evil.example' },
      });
      expect(status).toBe(403);
    });
  });

  describe('PUT /__curate/reviewed/:id', () => {
    it('writes exactly four keys, server-stamps reviewedAt and ignores a client-supplied one', async () => {
      const t0 = Date.now();
      const { status } = await put('4440001', {
        reason: '  Real effort, checked the stream.  ',
        fingerprint: '1k:demoted:ceiling|t=0',
        reviewedAt: '1999-01-01T00:00:00.000Z',
        extra: 'ignored',
      });
      const t1 = Date.now();
      expect(status).toBe(200);
      const doc = JSON.parse(readFileSync(paths.reviewedPath, 'utf8'));
      expect(doc.reviewed).toHaveLength(1);
      const entry = doc.reviewed[0];
      expect(Object.keys(entry).sort()).toEqual([
        'activityId',
        'fingerprint',
        'reason',
        'reviewedAt',
      ]);
      expect(entry.activityId).toBe('4440001');
      expect(entry.reason).toBe('Real effort, checked the stream.');
      expect(entry.fingerprint).toBe('1k:demoted:ceiling|t=0');
      const stamped = new Date(entry.reviewedAt).getTime();
      expect(stamped).toBeGreaterThanOrEqual(t0);
      expect(stamped).toBeLessThanOrEqual(t1);
    });

    it('a second PUT for the same id replaces in place (one entry)', async () => {
      await put('4440001', { reason: 'first', fingerprint: 'a|t=0' });
      await put('4440001', { reason: 'second', fingerprint: 'a|t=1' });
      const doc = JSON.parse(readFileSync(paths.reviewedPath, 'utf8'));
      expect(doc.reviewed).toHaveLength(1);
      expect(doc.reviewed[0].reason).toBe('second');
    });

    it.each([
      ['empty reason', { reason: '', fingerprint: 'a|t=0' }],
      ['whitespace reason', { reason: '   ', fingerprint: 'a|t=0' }],
      ['missing reason', { fingerprint: 'a|t=0' }],
      ['missing fingerprint', { reason: 'ok' }],
      ['bad fingerprint charset', { reason: 'ok', fingerprint: '<script>' }],
    ])('%s responds 400 and writes nothing', async (_l, body) => {
      const { status } = await put('4440001', body);
      expect(status).toBe(400);
      expect(existsSync(paths.reviewedPath)).toBe(false);
    });

    it.each(['..%2Fx', '__proto__', 'abc', '%'])('invalid id %s responds 400', async (id) => {
      const { status } = await put(id, { reason: 'ok', fingerprint: 'a|t=0' });
      expect(status).toBe(400);
      expect(existsSync(paths.reviewedPath)).toBe(false);
    });

    it('a body over MAX_BODY_BYTES is rejected (413, or a reset) and writes nothing', async () => {
      const { status } = await put('4440001', {
        reason: 'x'.repeat(MAX_BODY_BYTES + 1),
        fingerprint: 'a|t=0',
      });
      expect([413, 'error']).toContain(status);
      expect(existsSync(paths.reviewedPath)).toBe(false);
    });

    it('a cross-origin PUT responds 403 and writes nothing', async () => {
      const { status } = await put(
        '4440001',
        { reason: 'ok', fingerprint: 'a|t=0' },
        { headers: { Origin: 'http://evil.example' } }
      );
      expect(status).toBe(403);
      expect(existsSync(paths.reviewedPath)).toBe(false);
    });

    it('a mismatched Host PUT responds 403', async () => {
      const { status } = await put(
        '4440001',
        { reason: 'ok', fingerprint: 'a|t=0' },
        { headers: { Host: 'evil.example' } }
      );
      expect(status).toBe(403);
    });

    it('GET and POST on /reviewed/:id fall through to 404 (dispatch is PUT|DELETE only)', async () => {
      expect((await call('GET', `${CURATE_PREFIX}/reviewed/4440001`)).status).toBe(404);
      expect((await call('POST', `${CURATE_PREFIX}/reviewed/4440001`, { body: {} })).status).toBe(
        404
      );
    });

    it('409 when the id is in the exclusions file, and the reviewed file is unchanged', async () => {
      seedReviewed(reviewedDoc('9'));
      const before = readFileSync(paths.reviewedPath);
      const { status, body } = await put('5550001', { reason: 'ok', fingerprint: 'a|t=0' });
      expect(status).toBe(409);
      expect(body).toMatch(/excluded/);
      expect(readFileSync(paths.reviewedPath).equals(before)).toBe(true);
    });

    it('409 leaves no reviewed file behind when none existed', async () => {
      const { status } = await put('5550001', { reason: 'ok', fingerprint: 'a|t=0' });
      expect(status).toBe(409);
      expect(existsSync(paths.reviewedPath)).toBe(false);
    });

    it('PUT on a corrupt existing reviewed file responds 500 and the corrupt bytes are unchanged', async () => {
      seedCorrupt();
      const { status } = await put('4440001', { reason: 'ok', fingerprint: 'a|t=0' });
      expect(status).toBe(500);
      expect(readFileSync(paths.reviewedPath, 'utf8')).toBe('{corrupt');
    });

    it('other entries are untouched by a PUT for a different id (D-13)', async () => {
      seedReviewed(reviewedDoc('1', '2'));
      await put('3', { reason: 'ok', fingerprint: 'a|t=0' });
      const doc = JSON.parse(readFileSync(paths.reviewedPath, 'utf8'));
      expect(doc.reviewed.slice(0, 2)).toEqual(reviewedDoc('1', '2').reviewed);
      expect(doc.reviewed).toHaveLength(3);
    });
  });

  describe('DELETE /__curate/reviewed/:id', () => {
    it('removes the entry and answers 200', async () => {
      seedReviewed(reviewedDoc('1', '2'));
      const { status } = await call('DELETE', `${CURATE_PREFIX}/reviewed/1`);
      expect(status).toBe(200);
      const doc = JSON.parse(readFileSync(paths.reviewedPath, 'utf8'));
      expect(doc.reviewed.map((e) => e.activityId)).toEqual(['2']);
    });

    it('is never 409, even for an id that is excluded', async () => {
      const { status } = await call('DELETE', `${CURATE_PREFIX}/reviewed/5550001`);
      expect(status).toBe(200);
    });

    it('a cross-origin DELETE responds 403 and removes nothing', async () => {
      seedReviewed(reviewedDoc('1'));
      const { status } = await call('DELETE', `${CURATE_PREFIX}/reviewed/1`, {
        headers: { Origin: 'http://evil.example' },
      });
      expect(status).toBe(403);
      expect(JSON.parse(readFileSync(paths.reviewedPath, 'utf8')).reviewed).toHaveLength(1);
    });
  });

  describe('PUT /__curate/exclusions/:id (D-11, the symmetric check)', () => {
    const putExclusion = (id) =>
      call('PUT', `${CURATE_PREFIX}/exclusions/${id}`, { body: { reason: 'Bad GPS.' } });

    it('409 when the id is in the reviewed file, and the exclusions file and publish copy are unchanged', async () => {
      seedReviewed(reviewedDoc('4440001'));
      const before = readFileSync(paths.exclusionsPath);
      const { status, body } = await putExclusion('4440001');
      expect(status).toBe(409);
      expect(body).toMatch(/reviewed/);
      expect(readFileSync(paths.exclusionsPath).equals(before)).toBe(true);
      expect(existsSync(paths.publishExclusionsPath)).toBe(false);
    });

    it('a corrupt reviewed file fails closed with 500 and nothing is written', async () => {
      seedCorrupt();
      const before = readFileSync(paths.exclusionsPath);
      const { status } = await putExclusion('4440002');
      expect(status).toBe(500);
      expect(readFileSync(paths.exclusionsPath).equals(before)).toBe(true);
    });

    it('control: with no reviewed file, an exclusion PUT still succeeds and mirrors', async () => {
      const { status } = await putExclusion('4440002');
      expect(status).toBe(200);
      expect(existsSync(paths.publishExclusionsPath)).toBe(true);
    });
  });

  describe('a reviewed write never publishes (D-01, T-37-11)', () => {
    it('leaves the publish root empty after PUT and DELETE', async () => {
      await put('4440001', { reason: 'ok', fingerprint: 'a|t=0' });
      await call('DELETE', `${CURATE_PREFIX}/reviewed/4440001`);
      expect(listTree(paths.publishRoot)).toEqual([]);
    });
  });
});

describe('persistReviewed source discipline (D-01, T-37-11)', () => {
  it('its function body contains neither mirrorExclusions nor dist', () => {
    const start = SOURCE.indexOf('function persistReviewed(');
    expect(start).toBeGreaterThan(-1);
    const rest = SOURCE.slice(start);
    const body = rest.slice(0, rest.indexOf('\n}'));
    expect(body).toContain('writeAtomic');
    expect(body).not.toContain('mirrorExclusions');
    expect(body).not.toContain('dist');
  });
});

// D-11 over the COMMITTED files. Read-only. The planted in-memory pair shows
// the helper can fail; the committed pair shows it can pass.
describe('excluded and reviewed are disjoint (D-11)', () => {
  it('planted: two in-memory docs that both list X share exactly [X]', () => {
    expect(
      sharedActivityIds(
        { exclusions: [{ activityId: 'X' }, { activityId: 'Y' }] },
        { reviewed: [{ activityId: 'X' }, { activityId: 'Z' }] }
      )
    ).toEqual(['X']);
  });

  it('skips non-object entries and non-string ids', () => {
    expect(
      sharedActivityIds({ exclusions: [null, { activityId: 5 }] }, { reviewed: [null, { activityId: 5 }] })
    ).toEqual([]);
  });

  it('committed: data/best-effort-exclusions.json and data/curation/reviewed.json share no activityId', () => {
    const exclusions = JSON.parse(readFileSync(resolve(process.cwd(), EXCLUSIONS_PATH), 'utf8'));
    const reviewed = JSON.parse(readFileSync(resolve(process.cwd(), REVIEWED_PATH), 'utf8'));
    expect(Array.isArray(exclusions.exclusions)).toBe(true);
    expect(Array.isArray(reviewed.reviewed)).toBe(true);
    expect(sharedActivityIds(exclusions, reviewed)).toEqual([]);
  });
});
