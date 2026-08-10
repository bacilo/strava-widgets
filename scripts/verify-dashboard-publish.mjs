/**
 * HTTP smoke check over the built publish directory (dist/widgets).
 *
 * Proves every URL the dashboard SPA can request at runtime resolves over
 * HTTP from the built output — the automated half of Phase 16's exit gate.
 * The other half (hash navigation, deep linking, theming) needs a real
 * browser and is a human checkpoint; this script deliberately does not
 * attempt to fake that with a headless-browser dependency (D-01).
 *
 * ESM, Node built-ins only (`node:http`, `node:fs`, `node:path`) — no new
 * dependency, matching scripts/build-widgets.mjs's style.
 */

import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';

const ROOT = resolve(process.cwd(), 'dist/widgets');
const INDEX_HTML = join(ROOT, 'index.html');
const INDEX_JSON = join(ROOT, 'data/dashboard/index.json');

let failures = 0;
let checks = 0;

function fail(message) {
  failures += 1;
  console.error(`✗ ${message}`);
}

function ok(message) {
  checks += 1;
  console.log(`✓ ${message}`);
}

// --- 1. Fail fast if the publish directory isn't built yet -----------------

if (!existsSync(INDEX_HTML) || !existsSync(INDEX_JSON)) {
  console.error(
    'FATAL: dist/widgets is not fully built.\n' +
      `  Missing: ${!existsSync(INDEX_HTML) ? INDEX_HTML : INDEX_JSON}\n` +
      '  Run `npm run build-widgets` first (and `npm run compute-dashboard-index` ' +
      'if data/dashboard/index.json does not exist locally).'
  );
  process.exit(1);
}

// --- 2. Minimal static file server rooted at dist/widgets ------------------

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.js': 'application/javascript',
  '.css': 'text/css',
};

function safeResolve(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = resolve(ROOT, relative);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + '/')) {
    // Path traversal outside dist/widgets — reject (T-16-VF-01).
    return null;
  }
  return resolved;
}

function createServer() {
  return http.createServer((req, res) => {
    const filePath = safeResolve(req.url ?? '/');
    if (filePath === null) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const contentType = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(readFileSync(filePath));
  });
}

function startServer(server) {
  return new Promise((resolvePromise, rejectPromise) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'string' || address === null) {
        rejectPromise(new Error('Failed to determine server address'));
        return;
      }
      resolvePromise(`http://127.0.0.1:${address.port}`);
    });
    server.on('error', rejectPromise);
  });
}

function get(url) {
  return new Promise((resolvePromise, rejectPromise) => {
    http
      .get(url, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolvePromise({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      })
      .on('error', rejectPromise);
  });
}

async function expect200(baseUrl, path, { nonEmpty = true } = {}) {
  const { status, body } = await get(`${baseUrl}${path}`);
  if (status !== 200) {
    fail(`GET ${path} expected 200, got ${status}`);
    return null;
  }
  if (nonEmpty && body.length === 0) {
    fail(`GET ${path} returned 200 but an empty body`);
    return null;
  }
  ok(`GET ${path} -> 200`);
  return body;
}

async function expect404(baseUrl, path) {
  const { status } = await get(`${baseUrl}${path}`);
  if (status !== 404) {
    fail(`GET ${path} expected 404 (stream-unavailable activity), got ${status}`);
    return;
  }
  ok(`GET ${path} -> 404 (expected, stream-unavailable)`);
}

async function main() {
  // --- 3. Sample rows from the generated index -----------------------------

  const indexDoc = JSON.parse(readFileSync(INDEX_JSON, 'utf8'));
  if (indexDoc.schemaVersion !== 1) {
    fail(`data/dashboard/index.json schemaVersion expected 1, got ${indexDoc.schemaVersion}`);
  }
  if (!Array.isArray(indexDoc.activities) || indexDoc.activities.length === 0) {
    fail('data/dashboard/index.json has no activities');
    process.exit(1);
  }

  const newestRow = indexDoc.activities[0];
  const newestWithStream = indexDoc.activities.find((row) => row.streams?.available === true);
  const newestWithoutStream = indexDoc.activities.find((row) => row.streams?.available === false);

  if (!newestWithStream) {
    fail('No activity with streams.available === true found in the index — cannot verify stream URL shape');
  }

  const server = createServer();
  const baseUrl = await startServer(server);

  try {
    // --- 4. Core URL checks -------------------------------------------------

    const indexHtml = await expect200(baseUrl, '/');
    if (indexHtml && !indexHtml.includes('data-theme')) {
      fail('GET / did not include "data-theme" — theme bootstrap may not have survived the build');
    } else if (indexHtml) {
      ok('GET / includes "data-theme" (theme bootstrap present)');
    }

    const indexJsonBody = await expect200(baseUrl, '/data/dashboard/index.json');
    if (indexJsonBody) {
      const parsed = JSON.parse(indexJsonBody);
      if (parsed.schemaVersion !== 1) {
        fail(`/data/dashboard/index.json schemaVersion expected 1, got ${parsed.schemaVersion}`);
      } else if (!Array.isArray(parsed.activities) || parsed.activities.length === 0) {
        fail('/data/dashboard/index.json activities array is empty');
      } else {
        ok('/data/dashboard/index.json parses with schemaVersion 1 and a non-empty activities array');
      }
    }

    await expect200(baseUrl, '/data/stats/all-time-totals.json');
    await expect200(baseUrl, '/data/stats/streaks.json');

    if (newestRow) {
      const activityBody = await expect200(baseUrl, `/data/activities/${newestRow.id}.json`);
      if (activityBody) {
        JSON.parse(activityBody);
      }
    }

    if (newestWithStream) {
      const streamBody = await expect200(baseUrl, `/data/streams/${newestWithStream.id}.json`);
      if (streamBody) {
        const parsedStream = JSON.parse(streamBody);
        if (!Array.isArray(parsedStream.t) || parsedStream.t.length === 0) {
          fail(`/data/streams/${newestWithStream.id}.json parsed but "t" array is empty or missing`);
        } else {
          ok(`/data/streams/${newestWithStream.id}.json parses with a non-empty "t" array`);
        }
      }
    }

    for (const page of ['/widgets.html', '/heatmap.html', '/pinmap.html', '/routes.html']) {
      await expect200(baseUrl, page);
    }

    // --- 5. Degraded state: stream-unavailable activity must 404 -----------

    if (newestWithoutStream) {
      await expect404(baseUrl, `/data/streams/${newestWithoutStream.id}.json`);
    } else {
      console.log('(skipped: no stream-unavailable activity found in the archive)');
    }

    // --- 6. Hashed JS asset referenced by index.html ------------------------

    if (indexHtml) {
      const scriptMatch = indexHtml.match(/<script type="module"[^>]*\ssrc="([^"]+)"/);
      if (!scriptMatch) {
        fail('Could not find a <script type="module" src="..."> tag in index.html');
      } else {
        const scriptSrc = scriptMatch[1].replace(/^\//, '');
        await expect200(baseUrl, `/${scriptSrc}`, { nonEmpty: true });
      }
    }
  } finally {
    server.close();
  }

  // --- 7. Summary ------------------------------------------------------------

  console.log(`\n${checks} check(s) passed, ${failures} failure(s).`);
  if (failures > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('verify-dashboard-publish failed:', error);
  process.exit(1);
});
