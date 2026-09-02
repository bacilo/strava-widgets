/**
 * Local curation mode's HTTP server (Phase 24, D-01/D-02/D-12).
 *
 * This is a LOCAL-ONLY developer tool. It is never built, bundled or
 * deployed — nothing in this file is an input to vite.config.ts,
 * vite.config.pages.ts, tsconfig.json's `include`, or build-widgets.mjs's
 * copy lists. It binds 127.0.0.1 only (D-12) and its entire /__curate/*
 * namespace must 404 over the published bundle — asserted at the HTTP
 * layer by scripts/verify-dashboard-publish.mjs (plan 24-05) and at the
 * build layer by scripts/lib/curation-guard.mjs (plan 24-01).
 *
 * It serves the already-BUILT dist/widgets under /strava-widgets (D-02 —
 * matching production's GitHub Pages project-page mount, the same shape
 * verify-dashboard-publish.mjs already uses) and injects the curation
 * overlay's script tag into index.html as a response-body patch — never a
 * disk write, since dist/widgets/index.html is the real publish artifact.
 *
 * ESM, Node built-ins only (node:http, node:fs, node:path, node:url) plus
 * the already-installed esbuild devDependency for the overlay bundle step
 * (buildOverlay). No new dependency.
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

import { copyJsonTree, RECOMPUTE_DATA_DIRS } from './lib/copy-data-tree.mjs';

// --- Constants (all exported) -----------------------------------------------

// D-12: literal '127.0.0.1' — never the all-interfaces wildcard bind (which
// would expose the write path to the local network) and never 'localhost'
// (which can resolve to ::1 and sidesteps the intended binding).
export const CURATE_HOST = '127.0.0.1';

// OD-4: a fixed, bookmarkable port. 4173 is free in this repo — package.json
// has no `vite preview` script — and curate deliberately does not hunt for a
// free port: an unpredictable port is one the developer bookmarks wrongly.
export const CURATE_PORT = 4173;

// D-02: dist/widgets mounts under this prefix, matching GitHub Pages' real
// project-page mount (the same shape verify-dashboard-publish.mjs already
// uses), so curating happens against production's URL shape and the overlay
// cannot silently acquire a root-relative path dependency.
export const MOUNT_PREFIX = '/strava-widgets';

// D-02: /__curate/* is routed OUTSIDE the mount prefix — the write path and
// the overlay bundle are never assets of the published site.
export const CURATE_PREFIX = '/__curate';

export const OVERLAY_ENTRY = 'scripts/curate-overlay/index.ts';
export const OVERLAY_OUTFILE = '.curate-dist/overlay.js';

// D-05/D-07: the two files joined only by build-widgets.mjs's copy step.
// EXCLUSIONS_PATH is the working-tree source of truth the developer reviews
// and commits by hand; PUBLISH_EXCLUSIONS_PATH is the served copy inside the
// already-built dist/widgets tree. Nothing curate writes is visible in the
// page the developer is looking at until mirrorExclusions() re-copies it.
export const EXCLUSIONS_PATH = 'data/best-effort-exclusions.json';
export const PUBLISH_EXCLUSIONS_PATH = 'dist/widgets/data/best-effort-exclusions.json';

// T-24-WRITE-DOS: Node's raw req.on('data') accumulation has no built-in
// size limit, and a reason string is never legitimately large.
export const MAX_BODY_BYTES = 10 * 1024;
export const MAX_REASON_CHARS = 2000;

// Pitfall 4: dist/index.js is tsc's output (`npm run build`), a completely
// separate build from dist/widgets. Recompute must FATAL-check this rather
// than let child_process.spawn fail with a raw "Cannot find module" trace.
const RECOMPUTE_CLI_PATH = 'dist/index.js';

const ROOT = resolve(process.cwd(), 'dist/widgets');
const INDEX_HTML = resolve(ROOT, 'index.html');

// D-02: the write/recompute routes live under CURATE_PREFIX, outside the
// published mount, matching every other /__curate/* route in this file.
const EXCLUSIONS_ROUTE_PREFIX = `${CURATE_PREFIX}/exclusions/`;
const RECOMPUTE_ROUTE = `${CURATE_PREFIX}/recompute`;

// D-12: computed once from the same CURATE_HOST/CURATE_PORT constants the
// server itself binds to — never derived from request input.
const EXPECTED_HOST = `${CURATE_HOST}:${CURATE_PORT}`;

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.js': 'application/javascript',
  '.css': 'text/css',
};

// --- FATAL missing-build check (direct-invocation only, see main()) --------

function assertBuilt() {
  if (!existsSync(INDEX_HTML)) {
    console.error(
      'FATAL: dist/widgets is not fully built.\n' +
        `  Missing: ${INDEX_HTML}\n` +
        '  Run `npm run build-widgets` first, then re-run `npm run curate`.'
    );
    process.exit(1);
  }
}

// --- Static-serve half (D-02) ------------------------------------------------

/**
 * Path-traversal-safe resolver, copied near-verbatim from
 * verify-dashboard-publish.mjs's safeResolve. Requires the path to sit under
 * MOUNT_PREFIX and requires the resolved path to stay inside ROOT — the
 * final check is the traversal rejection (T-16-VF-01 / T-24-VF-01) and must
 * not be weakened.
 *
 * GAP-24-03 / CR-01: a malformed percent-escape (e.g. `/%`, `/%zz`,
 * `/%e0%a4%a`) is rejected identically to a traversal, because
 * `decodeURIComponent` throws `URIError` on those inputs, and an unguarded
 * throw here reaches the http request listener as an uncaught exception.
 *
 * @param {string} urlPath
 * @returns {string | null} the resolved filesystem path, or null to reject
 */
export function safeResolve(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  if (decoded !== MOUNT_PREFIX && !decoded.startsWith(MOUNT_PREFIX + '/')) {
    return null;
  }
  const withinMount = decoded.slice(MOUNT_PREFIX.length);
  const relative =
    withinMount === '' || withinMount === '/' ? 'index.html' : withinMount.replace(/^\/+/, '');
  const resolved = resolve(ROOT, relative);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + '/')) {
    // Path traversal outside dist/widgets — reject (T-16-VF-01 / T-24-VF-01).
    return null;
  }
  return resolved;
}

/**
 * Literal prefix test on CURATE_PREFIX ('/__curate'). Deliberately NOT a
 * substring or wildcard match (T-24-OVERBROAD) — a broader test could
 * misclassify /strava-widgets/data/best-effort-exclusions.json as
 * curate-owned, and that file is PUBLIC: already published by
 * build-widgets.mjs, already asserted 200-and-parses at
 * verify-dashboard-publish.mjs:294, and fetched at runtime by detail.ts and
 * records.ts. Only the write PATH is private; the data is not.
 *
 * @param {string} urlPath
 * @returns {boolean}
 */
export function isCurateRoute(urlPath) {
  const decoded = urlPath.split('?')[0];
  return decoded === CURATE_PREFIX || decoded.startsWith(CURATE_PREFIX + '/');
}

/**
 * Pure string function: inserts the overlay's <script> tag immediately
 * before the LAST occurrence of </body>. Never fabricates markup when
 * </body> is absent, and is idempotent when the tag is already present.
 * This is a response-body patch only — never write the patched HTML back to
 * disk (dist/widgets/index.html is the real publish artifact).
 *
 * The script src is deliberately root-absolute so it resolves outside the
 * /strava-widgets mount per D-02.
 *
 * @param {string} html
 * @returns {string}
 */
export function injectOverlayTag(html) {
  const scriptTag = `<script src="${CURATE_PREFIX}/overlay.js"></script>`;
  if (html.includes(scriptTag)) {
    return html;
  }
  const lastBodyClose = html.lastIndexOf('</body>');
  if (lastBodyClose === -1) {
    return html;
  }
  return html.slice(0, lastBodyClose) + scriptTag + html.slice(lastBodyClose);
}

// --- Overlay bundling (D-01) -------------------------------------------------

/**
 * The ONLY thing that ever builds the curation overlay. scripts/curate-overlay/
 * is deliberately outside tsconfig.json's `include` (["src/**\/*"]), not an
 * input to vite.config.ts or vite.config.pages.ts, and not in
 * build-widgets.mjs's widgets array or copy lists — D-01's structural
 * absence from the publish pipeline. target: 'es2020' matches every other
 * build in this repo (build-widgets.mjs, vite.config.ts).
 *
 * @returns {Promise<void>}
 */
export async function buildOverlay() {
  await esbuild.build({
    entryPoints: [OVERLAY_ENTRY],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    outfile: OVERLAY_OUTFILE,
    logLevel: 'info',
  });
}

// --- Exclusion mutations, honoring D-05's exact JSON contract ---------------
//
// D-09: curate performs WORKING-TREE WRITES ONLY. data/best-effort-exclusions.json
// sits in the nightly workflow's push-paths filter (added 2026-08-12), so a
// commit reaching origin triggers a full rebuild and deploy — a tickbox must
// not be able to cause that. Consequently NO CODE PATH in this file may
// invoke `git`; the developer reviews `git diff`, commits and pushes by hand.

/**
 * D-05/D-06: returns a NEW document — never mutates `fileDoc`. The written
 * entry is ALWAYS exactly `{ activityId, distances: null, reason }` —
 * `distances` is the literal `null`, never an array, never `[]`, never
 * omitted. Curate is never a producer of the narrow distance-array form;
 * that form stays readable only because best-effort-exclusions.ts's own
 * tolerance (T-16-EX-01/T-16-EX-02) is a separate, untouched contract.
 *
 * If an entry for `activityId` already exists, it is replaced AT THE SAME
 * INDEX so a Save on an already-excluded activity edits in place and the
 * array length never grows — one reason per activity (D-06).
 *
 * `schemaVersion` and `note` are carried through unchanged — schemaVersion
 * is bumped only via a coordinated migration (best-effort.types.ts:18),
 * never here.
 *
 * @param {{schemaVersion: number, note: string, exclusions: Array<{activityId: string, distances: null, reason: string}>}} fileDoc
 * @param {string} activityId
 * @param {string} reason
 * @returns {object}
 */
export function applyUpsert(fileDoc, activityId, reason) {
  const exclusions = fileDoc.exclusions.slice();
  const entry = { activityId, distances: null, reason };
  const existingIndex = exclusions.findIndex((e) => e.activityId === activityId);
  if (existingIndex === -1) {
    exclusions.push(entry);
  } else {
    exclusions[existingIndex] = entry;
  }
  return { ...fileDoc, exclusions };
}

/**
 * D-05 (the untick rule): returns a NEW document with every entry whose
 * `activityId` matches REMOVED from the array.
 *
 * THIS MUST NEVER rewrite an entry to `distances: []` instead of removing
 * it. `buildExclusionIndex` (src/analytics/best-effort-exclusions.ts)
 * silently SKIPS an entry whose `distances` is an empty array — its
 * `known.size === 0` branch `continue`s without recording anything — so a
 * file that did that would read as "this activity is excluded" while the
 * loaded index excludes nothing at all. Filtering the entry OUT is the only
 * correct implementation of an untick.
 *
 * @param {object} fileDoc
 * @param {string} activityId
 * @returns {object}
 */
export function applyRemove(fileDoc, activityId) {
  const exclusions = fileDoc.exclusions.filter((e) => e.activityId !== activityId);
  return { ...fileDoc, exclusions };
}

/**
 * D-07: atomic write. Writes `contents` to a sibling temp file
 * (`${path}.tmp-${process.pid}`) then `renameSync`s it onto `path`.
 * `renameSync` is atomic on the same filesystem, which a sibling temp file
 * guarantees. This is a new pattern for this repo — every existing
 * `writeFileSync` call site writes directly — because
 * `data/best-effort-exclusions.json` (via its mirrored copy) is read
 * concurrently by the browser's own fetch: a half-written file must never
 * be observable.
 *
 * @param {string} path
 * @param {string} contents
 */
export function writeAtomic(path, contents) {
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, contents, 'utf8');
  renameSync(tmp, path);
}

/**
 * D-07: instant mirror. Copies the working-tree EXCLUSIONS_PATH into the
 * served PUBLISH_EXCLUSIONS_PATH synchronously, immediately after a
 * successful write, so the badge and reason are visible in the same
 * session without a rebuild. Creates the destination DIRECTORY
 * (dist/widgets/data) if absent, but throws — rather than writing a half
 * state — if the PUBLISH ROOT (dist/widgets, i.e. an unbuilt tree) is
 * itself missing; callers must catch and respond 500.
 */
export function mirrorExclusions() {
  if (!existsSync(ROOT)) {
    throw new Error(
      `dist/widgets is not built (${ROOT} missing). Run \`npm run build-widgets\` first.`
    );
  }
  mkdirSync(dirname(PUBLISH_EXCLUSIONS_PATH), { recursive: true });
  copyFileSync(EXCLUSIONS_PATH, PUBLISH_EXCLUSIONS_PATH);
}

function readExclusionsFile() {
  return JSON.parse(readFileSync(EXCLUSIONS_PATH, 'utf8'));
}

function persistExclusions(doc) {
  writeAtomic(EXCLUSIONS_PATH, `${JSON.stringify(doc, null, 2)}\n`);
  mirrorExclusions();
}

// --- Origin/Host gate & input validation (D-12, ASVS V4/V5) ------------------

/**
 * D-12: binding to 127.0.0.1 alone satisfies the literal "localhost-only"
 * wording but leaves the endpoint reachable from any OTHER TAB in the
 * developer's own browser — the header check here is what closes drive-by
 * CSRF and DNS rebinding. A startup session token was explicitly rejected
 * as redundant, since the overlay is served from the same origin the token
 * would protect.
 *
 * Returns false unless `req.headers.host` matches `expectedHost` exactly.
 * If `Origin` is absent, returns true (same-origin fetches from same-page
 * JS often omit it). Otherwise the Origin's own host must also match.
 * Never throws — a malformed Origin header returns false.
 *
 * @param {{headers: {host?: string, origin?: string}}} req
 * @param {string} expectedHost
 * @returns {boolean}
 */
export function isTrustedOrigin(req, expectedHost) {
  if (req.headers.host !== expectedHost) return false;
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}

/**
 * ASVS V5: the SAME pattern as src/dashboard/router.ts's isValidActivityId
 * (`/^i?\d{1,20}$/`) mirrored server-side rather than a second invented
 * regex, plus an explicit `__proto__` rejection matching
 * records-logic.ts:82's buildExclusionReasonIndex guard. The write TARGET
 * path is always the hardcoded EXCLUSIONS_PATH constant, never derived
 * from this id — no traversal surface exists here by construction; this
 * validation exists only so a malformed id can never become a corrupt JSON
 * field value.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function isValidCurateActivityId(id) {
  return typeof id === 'string' && id !== '__proto__' && /^i?\d{1,20}$/.test(id);
}

/**
 * D-08's server-side half: never trust the client's required-field
 * enforcement alone. Returns the trimmed string when `raw` is a string
 * whose trimmed length is between 1 and MAX_REASON_CHARS; otherwise null.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeReason(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_REASON_CHARS) return null;
  return trimmed;
}

/**
 * Reads and JSON-parses a request body, capped at MAX_BODY_BYTES
 * (T-24-WRITE-DOS). Resolves `{ ok: true, body }` on success, or
 * `{ ok: false, status, message }` for the caller to respond with
 * directly. Destroys the request on the over-limit path. `JSON.parse`
 * runs inside a try/catch so a malformed body responds 400 rather than
 * crashing the process.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<{ok: true, body: unknown} | {ok: false, status: number, message: string}>}
 */
function readJsonBody(req) {
  return new Promise((settle) => {
    let received = 0;
    const chunks = [];
    let done = false;

    req.on('data', (chunk) => {
      if (done) return;
      received += chunk.length;
      if (received > MAX_BODY_BYTES) {
        done = true;
        req.destroy();
        settle({ ok: false, status: 413, message: 'Payload Too Large' });
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (done) return;
      done = true;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        settle({ ok: true, body });
      } catch {
        settle({ ok: false, status: 400, message: 'Bad Request: invalid JSON' });
      }
    });

    req.on('error', () => {
      if (done) return;
      done = true;
      settle({ ok: false, status: 400, message: 'Bad Request' });
    });
  });
}

// --- Write routes (PUT/DELETE /__curate/exclusions/:activityId) -------------

async function handleExclusionWrite(req, res, urlPath) {
  if (!isTrustedOrigin(req, EXPECTED_HOST)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden: cross-origin write rejected');
    return;
  }

  let activityId;
  try {
    activityId = decodeURIComponent(urlPath.slice(EXCLUSIONS_ROUTE_PREFIX.length));
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request: malformed activity id');
    return;
  }

  if (!isValidCurateActivityId(activityId)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request: invalid activity id');
    return;
  }

  if (req.method === 'PUT') {
    const bodyResult = await readJsonBody(req);
    if (!bodyResult.ok) {
      res.writeHead(bodyResult.status, { 'Content-Type': 'text/plain' });
      res.end(bodyResult.message);
      return;
    }
    const rawReason =
      bodyResult.body && typeof bodyResult.body === 'object' ? bodyResult.body.reason : undefined;
    const reason = normalizeReason(rawReason);
    if (reason === null) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad Request: reason must be a non-empty string');
      return;
    }

    try {
      persistExclusions(applyUpsert(readExclusionsFile(), activityId, reason));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Internal Server Error: ${error.message}`);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'DELETE') {
    try {
      persistExclusions(applyRemove(readExclusionsFile(), activityId));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Internal Server Error: ${error.message}`);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method Not Allowed');
}

// --- Recompute route (POST /__curate/recompute) ------------------------------
//
// D-07: rejected running the full chain on every Save — compute-best-efforts
// walks all ~1,868 activities' streams, and curating five runs would pay
// that cost five times. Recompute is a separate, deliberate press.

/**
 * Spawns one `node dist/index.js <command>` step, piping its stdout/stderr
 * into `res` as chunked text as they arrive. Resolves with the child's exit
 * code (or 1 on a spawn error, after writing the error message).
 *
 * @param {string[]} args
 * @param {import('node:http').ServerResponse} res
 * @returns {Promise<number>}
 */
function runComputeStep(args, res) {
  return new Promise((settle) => {
    const child = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => res.write(chunk));
    child.stderr.on('data', (chunk) => res.write(chunk));
    child.on('error', (error) => {
      res.write(`\n${error.message}\n`);
      settle(1);
    });
    child.on('close', (code) => settle(code ?? 1));
  });
}

async function handleRecompute(req, res) {
  if (!isTrustedOrigin(req, EXPECTED_HOST)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden: cross-origin write rejected');
    return;
  }

  if (!existsSync(RECOMPUTE_CLI_PATH)) {
    res.writeHead(412, { 'Content-Type': 'text/plain' });
    res.end(
      `Precondition Failed: ${RECOMPUTE_CLI_PATH} is missing.\n` +
        'Run `npm run build` first, then retry Recompute.'
    );
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });

  // ORDER MATTERS: compute-best-efforts must run, and succeed, before
  // compute-dashboard-index — the second must not run if the first failed.
  const bestEffortsCode = await runComputeStep(['dist/index.js', 'compute-best-efforts'], res);
  if (bestEffortsCode !== 0) {
    res.end(`\n__CURATE_RECOMPUTE_FAILED__ (compute-best-efforts exited ${bestEffortsCode})\n`);
    return;
  }

  const dashboardIndexCode = await runComputeStep(['dist/index.js', 'compute-dashboard-index'], res);
  if (dashboardIndexCode !== 0) {
    res.end(
      `\n__CURATE_RECOMPUTE_FAILED__ (compute-dashboard-index exited ${dashboardIndexCode})\n`
    );
    return;
  }

  try {
    for (const dir of RECOMPUTE_DATA_DIRS) {
      copyJsonTree(dir.src, dir.dest);
    }
    mirrorExclusions();
  } catch (error) {
    res.end(`\n__CURATE_RECOMPUTE_FAILED__ (re-mirror error: ${error.message})\n`);
    return;
  }

  res.end('\n__CURATE_RECOMPUTE_DONE__\n');
}

// --- Request handler ---------------------------------------------------------

async function serveCurateRoute(req, res) {
  const urlPath = (req.url ?? '/').split('?')[0];

  if (req.method === 'GET' && urlPath === `${CURATE_PREFIX}/health`) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method === 'GET' && urlPath === `${CURATE_PREFIX}/overlay.js`) {
    if (!existsSync(OVERLAY_OUTFILE)) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(readFileSync(OVERLAY_OUTFILE));
    return;
  }

  if (
    (req.method === 'PUT' || req.method === 'DELETE') &&
    urlPath.startsWith(EXCLUSIONS_ROUTE_PREFIX)
  ) {
    await handleExclusionWrite(req, res, urlPath);
    return;
  }

  if (req.method === 'POST' && urlPath === RECOMPUTE_ROUTE) {
    await handleRecompute(req, res);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
}

/**
 * GAP-24-03 / D-12: the static route now carries the same Origin/Host gate
 * as the two write routes. DNS rebinding is a Host-header attack and is
 * route-agnostic — a rebound hostname reaches the static route exactly as
 * easily as a write route, and `24-VERIFICATION.md` recorded this key link
 * as NOT GATED. A normal browser navigation sends a matching `Host` and no
 * `Origin`, so `isTrustedOrigin` returns true and the tool keeps working
 * (D-02/OD-4). A developer reaching the server via `localhost:4173` instead
 * of the banner's `127.0.0.1:4173` gets 403 on every asset by design; the
 * response body names the correct origin so that mistake is self-explaining
 * rather than mysterious. `/__curate/health` and `/__curate/overlay.js`
 * deliberately remain ungated GETs — local-only, non-secret, no write, and
 * not in `24-VERIFICATION.md`'s `missing` list (see 24-12-PLAN.md's
 * <position_on_scope>).
 */
function serveStaticRoute(req, res) {
  if (!isTrustedOrigin(req, EXPECTED_HOST)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end(
      `Forbidden: curate serves only http://${CURATE_HOST}:${CURATE_PORT} — ` +
        'cross-origin and mismatched-Host requests are rejected.'
    );
    return;
  }

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

  if (filePath === INDEX_HTML) {
    const html = readFileSync(filePath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(injectOverlayTag(html));
    return;
  }

  const contentType = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(readFileSync(filePath));
}

/**
 * GAP-24-03 / CR-01: extracted verbatim from the curate branch's inline
 * `.catch()` handler so both branches of createServer's listener share one
 * 500 responder.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {Error} error
 */
function respond500(res, error) {
  if (!res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
  }
  res.end(`Internal Server Error: ${error.message}`);
}

// Exported so the real-socket liveness suite (scripts/curate-server.test.mjs)
// can exercise the shipped listener over an ephemeral port instead of
// asserting about its source text. main() remains the only production
// caller.
export function createServer() {
  return http.createServer((req, res) => {
    // GAP-24-03 / CR-01: defence-in-depth — no future synchronous throw
    // anywhere in the static path (or the curate path) can terminate a
    // process the developer has work in flight against. The curate branch
    // was already wrapped via its own .catch(); this try/catch makes the
    // static branch symmetric with it.
    try {
      if (isCurateRoute(req.url ?? '/')) {
        serveCurateRoute(req, res).catch((error) => respond500(res, error));
        return;
      }
      serveStaticRoute(req, res);
    } catch (error) {
      respond500(res, error);
    }
  });
}

// --- Entry point --------------------------------------------------------------

export async function main() {
  assertBuilt();
  await buildOverlay();

  const server = createServer();

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `FATAL: port ${CURATE_PORT} is already in use.\n` +
          '  curate deliberately does not hunt for a free port (OD-4) — a curate\n' +
          '  server on an unpredictable port is one you bookmark wrongly.\n' +
          `  Stop whatever is using port ${CURATE_PORT} and re-run \`npm run curate\`.`
      );
      process.exit(1);
      return;
    }
    throw error;
  });

  server.listen(CURATE_PORT, CURATE_HOST, () => {
    console.log(`curate server running at http://${CURATE_HOST}:${CURATE_PORT}${MOUNT_PREFIX}/`);
    console.log('Save writes the working tree only — curate never touches git (D-09).');
  });
}

// Self-execution guard: main() runs ONLY under direct invocation, never on
// import. scripts/curate-server.test.mjs imports this module and must not be
// killed by a missing build or a server start.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
