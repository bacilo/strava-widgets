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

// The publish directory is mounted under a non-root prefix on purpose. GitHub
// Pages serves this repo as a *project* page at /strava-widgets/, never at a
// domain root. Serving dist/widgets at '/' here is what let the absolute-asset
// bug ship green at 15/15: '/assets/index-*.js' resolves fine at a root mount
// and 404s on the real origin. Mounting under a prefix makes the local gate the
// same shape as production, so any absolute '/...' URL now fails here first.
const MOUNT_PREFIX = '/strava-widgets';

function safeResolve(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  // Anything outside the mount prefix is off-site as far as the deployed
  // origin is concerned — treat it exactly as GitHub Pages would.
  if (decoded !== MOUNT_PREFIX && !decoded.startsWith(MOUNT_PREFIX + '/')) {
    return null;
  }
  const withinMount = decoded.slice(MOUNT_PREFIX.length);
  const relative =
    withinMount === '' || withinMount === '/' ? 'index.html' : withinMount.replace(/^\/+/, '');
  const resolved = resolve(ROOT, relative);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + '/')) {
    // Path traversal outside dist/widgets — reject (T-16-VF-01).
    return null;
  }
  return resolved;
}

/**
 * Assert that an asset URL taken verbatim out of index.html actually resolves
 * on a project-page mount.
 *
 * The previous implementation did `src.replace(/^\//, '')` before fetching,
 * which silently rewrote a production-breaking absolute URL into a working
 * relative one — so the check passed while the deployed site served a black
 * page. Absolute URLs are therefore a hard failure here, not something to
 * normalise away: on GitHub Pages '/assets/x.js' leaves the project, returns
 * GitHub's 404 *HTML*, and the browser dies parsing that HTML as JS/CSS.
 */
async function expectAssetResolves(label, rawUrl) {
  if (/^[a-z]+:\/\//i.test(rawUrl)) {
    fail(`${label} URL "${rawUrl}" is absolute with a scheme — the publish tree must be self-contained`);
    return;
  }
  if (rawUrl.startsWith('/')) {
    fail(
      `${label} URL "${rawUrl}" is root-absolute. This site deploys to a GitHub Pages project ` +
        `page under ${MOUNT_PREFIX}/, where a root-absolute URL escapes the project and returns ` +
        `GitHub's 404 HTML page — the browser then fails to parse that HTML as ${label} and the ` +
        `page renders blank. Set Vite's \`base\` to './' for the dashboard build.`
    );
    return;
  }
  // Resolve exactly as a browser resolves a relative URL against the document.
  const relative = rawUrl.replace(/^\.\//, '');
  await expect200(baseUrlRef.value, `/${relative}`, { nonEmpty: true });
}

// expectAssetResolves runs after the server is up; hold the mounted base in a
// small ref so it does not need threading through every call site.
const baseUrlRef = { value: '' };

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
      // Hand back the mounted base so every check below addresses the site the
      // way the deployed origin does, prefix included.
      resolvePromise(`http://127.0.0.1:${address.port}${MOUNT_PREFIX}`);
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

async function expect404(baseUrl, path, reason) {
  const { status } = await get(`${baseUrl}${path}`);
  if (status !== 404) {
    fail(`GET ${path} expected 404 (${reason}), got ${status}`);
    return;
  }
  ok(`GET ${path} -> 404 (expected, ${reason})`);
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
  baseUrlRef.value = baseUrl;

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
      // gearName (D-17) must survive publication: at least one row resolved,
      // and no row leaks a raw gear id (T-18-GEAR-01).
      if (Array.isArray(parsed.activities)) {
        const badGearId = /^g\d{5,}$/;
        const hasGearName = parsed.activities.some((row) => row.gearName !== null && row.gearName !== undefined);
        const leakedRow = parsed.activities.find((row) => badGearId.test(row.gearName ?? ''));
        if (!hasGearName) {
          fail('/data/dashboard/index.json no row has a non-null "gearName" — gear resolution may not have survived publication');
        } else if (leakedRow) {
          fail(`/data/dashboard/index.json activity ${leakedRow.id} leaks a raw gear id in "gearName" (T-18-GEAR-01)`);
        } else {
          ok('/data/dashboard/index.json at least one row has "gearName" and no row leaks a raw gear id');
        }
      }
    }

    await expect200(baseUrl, '/data/stats/all-time-totals.json');
    await expect200(baseUrl, '/data/stats/streaks.json');

    const gearBody = await expect200(baseUrl, '/data/config/gear.json');
    if (gearBody) {
      const parsedGear = JSON.parse(gearBody);
      if (!parsedGear.gear || typeof parsedGear.gear !== 'object') {
        fail('/data/config/gear.json parsed but "gear" object is missing');
      } else {
        ok('/data/config/gear.json parses with a "gear" object');
      }
    }

    const athleteBody = await expect200(baseUrl, '/data/config/athlete.json');
    if (athleteBody) {
      const parsedAthlete = JSON.parse(athleteBody);
      if (!Array.isArray(parsedAthlete.hrZones) || parsedAthlete.hrZones.length !== 5) {
        fail('/data/config/athlete.json parsed but "hrZones" is not a five-entry array');
      } else {
        ok('/data/config/athlete.json parses with a five-entry "hrZones" array');
      }
      // Regression guard (T-18-PII-01): a well-meaning future edit must
      // never re-merge the private identity fields back into the public
      // config. Own-property check only — Object.prototype pollution is
      // out of scope here (the file is parsed JSON, not attacker input).
      if (
        Object.prototype.hasOwnProperty.call(parsedAthlete, 'birthDate') ||
        Object.prototype.hasOwnProperty.call(parsedAthlete, 'sex') ||
        Object.prototype.hasOwnProperty.call(parsedAthlete, 'restingHr')
      ) {
        fail(
          '/data/config/athlete.json has an own "birthDate", "sex", or "restingHr" property — ' +
            'identity/health fields must live only in gitignored data/private/athlete-private.json (T-18-PII-01)'
        );
      } else {
        ok('/data/config/athlete.json has no birthDate/sex/restingHr own properties (public config stays clean)');
      }
    }

    // Private athlete config must never be reachable over HTTP (T-18-PII-01).
    await expect404(baseUrl, '/data/private/athlete-private.json', 'private athlete config must never be published');
    await expect404(baseUrl, '/data/private/', 'private config directory must never be published');

    // D-10(b): the HTTP half of the two-layer curation-write-path absence guard
    // (build-time half is assertNoCurationArtifacts in build-widgets.mjs, called
    // per OD-2 at the end of buildAllWidgets()). These paths are written relative
    // to baseUrl, which already carries MOUNT_PREFIX (/strava-widgets) — GitHub
    // Pages serves this repo as a project page under /strava-widgets/, so a leaked
    // curate artifact would be reachable at exactly that URL. An origin-root
    // request (no prefix) would return 403 from safeResolve, not 404, and would
    // make this assertion lie about what a real deploy would do.
    //
    // These are literal /__curate/... paths and must NEVER be widened into a
    // wildcard or prefix match against /data/ — /data/best-effort-exclusions.json
    // is public, already published, and already asserted 200-and-parses on the
    // very next lines below. Only the write PATH is private; the data is not.
    await expect404(baseUrl, '/__curate/health', 'the curate health probe must never be published');
    await expect404(baseUrl, '/__curate/overlay.js', 'the curate overlay bundle must never be published');
    await expect404(baseUrl, '/__curate/exclusions/3475726256', 'the curate write endpoint must never be published');

    const exclusionsBody = await expect200(baseUrl, '/data/best-effort-exclusions.json');
    if (exclusionsBody) {
      const parsedExclusions = JSON.parse(exclusionsBody);
      if (!Array.isArray(parsedExclusions.exclusions)) {
        fail('/data/best-effort-exclusions.json parsed but "exclusions" is not an array');
      } else {
        ok('/data/best-effort-exclusions.json parses with an "exclusions" array');
      }
    }

    // --- 4b. Phase 18 published artifacts (D-20, D-22, T-18-AVAIL-03) -------
    //
    // Every file this phase adds must be asserted reachable at its production
    // mount point AND correctly shaped — a dropped copyDataFiles entry or a
    // missing CI compute step would otherwise 404 silently in production
    // while every local dev-machine check stayed green (the exact Phase 16
    // black-page failure mode this plan closes).

    const trainingLoadBody = await expect200(baseUrl, '/data/stats/training-load.json');
    if (trainingLoadBody) {
      const parsedTrainingLoad = JSON.parse(trainingLoadBody);
      if (parsedTrainingLoad.schemaVersion !== 1) {
        fail(`/data/stats/training-load.json schemaVersion expected 1, got ${parsedTrainingLoad.schemaVersion}`);
      } else if (!Array.isArray(parsedTrainingLoad.days) || parsedTrainingLoad.days.length <= 1000) {
        fail(
          `/data/stats/training-load.json "days" expected an array with more than 1000 entries, ` +
            `got ${Array.isArray(parsedTrainingLoad.days) ? parsedTrainingLoad.days.length : typeof parsedTrainingLoad.days}`
        );
      } else if (parsedTrainingLoad.models?.edwards !== true) {
        fail('/data/stats/training-load.json "models.edwards" expected true');
      } else {
        const day0Edwards = parsedTrainingLoad.days[0]?.edwards;
        const edwardsFieldsFinite =
          day0Edwards !== null &&
          typeof day0Edwards === 'object' &&
          Number.isFinite(day0Edwards.trimp) &&
          Number.isFinite(day0Edwards.ctl) &&
          Number.isFinite(day0Edwards.atl) &&
          Number.isFinite(day0Edwards.tsb);
        if (!edwardsFieldsFinite) {
          fail('/data/stats/training-load.json days[0].edwards does not carry four finite numbers (trimp/ctl/atl/tsb)');
        } else {
          ok('/data/stats/training-load.json parses with schemaVersion 1, >1000 days, models.edwards true, and finite days[0].edwards');
        }
      }
    }

    const ageGradingBody = await expect200(baseUrl, '/data/stats/age-grading.json');
    if (ageGradingBody) {
      const parsedAgeGrading = JSON.parse(ageGradingBody);
      if (parsedAgeGrading.schemaVersion !== 1) {
        fail(`/data/stats/age-grading.json schemaVersion expected 1, got ${parsedAgeGrading.schemaVersion}`);
      } else if (typeof parsedAgeGrading.enabled !== 'boolean') {
        // Deliberately NOT asserting enabled === true: it is false in CI by
        // design (data/private/athlete-private.json does not exist there,
        // plan 18-08) — an assertion that only passes on the developer's
        // machine is exactly the local-shape trap the Phase 16 postmortem
        // names (T-18-VERIFY-01).
        fail(`/data/stats/age-grading.json "enabled" expected a boolean, got ${typeof parsedAgeGrading.enabled}`);
      } else {
        ok('/data/stats/age-grading.json parses with schemaVersion 1 and a boolean "enabled"');
      }
      // Second, independent line of defence beside assertNoPrivateArtifacts
      // (T-18-PII-01): scan the published body for identity fields as JSON
      // KEYS (quoted-key-followed-by-colon), not as a raw substring — the
      // disabledReason copy legitimately contains the plain-English words
      // "birthDate" and "sex" in its user-facing guidance ("add birthDate
      // and sex to data/private/athlete-private.json to enable it", the
      // exact Copywriting Contract string plan 18-08 ships), and that is the
      // CI-normal state (enabled: false). A raw substring match would fail
      // on the very state this document is expected to publish in CI.
      if (/"birthDate"\s*:|"restingHr"\s*:|"sex"\s*:/.test(ageGradingBody)) {
        fail('/data/stats/age-grading.json body contains a "birthDate", "restingHr", or "sex" JSON key — identity fields must never be published');
      } else {
        ok('/data/stats/age-grading.json body has no birthDate/restingHr/sex JSON keys');
      }
    }

    const gearAggregateBody = await expect200(baseUrl, '/data/stats/gear-aggregate.json');
    if (gearAggregateBody) {
      const parsedGearAggregate = JSON.parse(gearAggregateBody);
      const badShoeKeyOrLabel = /^g\d{5,}$/;
      if (parsedGearAggregate.schemaVersion !== 1) {
        fail(`/data/stats/gear-aggregate.json schemaVersion expected 1, got ${parsedGearAggregate.schemaVersion}`);
      } else if (!Array.isArray(parsedGearAggregate.shoes) || parsedGearAggregate.shoes.length === 0) {
        fail('/data/stats/gear-aggregate.json "shoes" expected a non-empty array');
      } else if (!(parsedGearAggregate.totals?.runs > 0)) {
        fail(`/data/stats/gear-aggregate.json "totals.runs" expected > 0, got ${parsedGearAggregate.totals?.runs}`);
      } else {
        const leakedShoe = parsedGearAggregate.shoes.find(
          (shoe) => badShoeKeyOrLabel.test(shoe.key) || badShoeKeyOrLabel.test(shoe.label)
        );
        if (leakedShoe) {
          fail(`/data/stats/gear-aggregate.json shoe "${leakedShoe.key}" leaks a raw gear id in key/label (T-18-GEAR-01)`);
        } else {
          ok('/data/stats/gear-aggregate.json parses with schemaVersion 1, non-empty "shoes", totals.runs > 0, and no leaked gear ids');
        }
      }
    }

    for (const wmaFile of ['road-factors.json', 'track-factors.json']) {
      const wmaBody = await expect200(baseUrl, `/data/wma/${wmaFile}`);
      if (wmaBody) {
        const parsedWma = JSON.parse(wmaBody);
        const maleKeys = parsedWma.factors?.male ? Object.keys(parsedWma.factors.male) : [];
        const femaleKeys = parsedWma.factors?.female ? Object.keys(parsedWma.factors.female) : [];
        if (parsedWma.schemaVersion !== 1) {
          fail(`/data/wma/${wmaFile} schemaVersion expected 1, got ${parsedWma.schemaVersion}`);
        } else if (typeof parsedWma.edition !== 'string' || parsedWma.edition.length === 0) {
          fail(`/data/wma/${wmaFile} "edition" expected a non-empty string`);
        } else if (maleKeys.length === 0 || femaleKeys.length === 0) {
          fail(`/data/wma/${wmaFile} "factors.male"/"factors.female" expected both present and non-empty`);
        } else {
          ok(`/data/wma/${wmaFile} parses with schemaVersion 1, a non-empty edition, and non-empty factors.male/factors.female`);
        }
      }
    }

    // --- 4c. CI-02: every published stats document, by name ----------------
    //
    // The whole-directory `data/stats` copy (build-widgets.mjs's `dataDirs`
    // entry `{ src: 'data/stats', dest: 'dist/widgets/data/stats' }`) has
    // been trusted implicitly to carry these six documents. A dropped or
    // renamed compute step would 404 silently in production while every
    // local check stayed green — the same "verifier lies" failure class this
    // repo's Verification Note already records three times over. Each check
    // below is 200 + JSON.parse + one structural invariant that a truncated
    // or empty document would fail (D-09) — a bare `expect200` accepts an
    // empty `[]` or `{}` body just fine.

    const weeklyDistanceBody = await expect200(baseUrl, '/data/stats/weekly-distance.json');
    if (weeklyDistanceBody) {
      const parsedWeeklyDistance = JSON.parse(weeklyDistanceBody);
      if (!Array.isArray(parsedWeeklyDistance) || parsedWeeklyDistance.length === 0) {
        fail(
          `/data/stats/weekly-distance.json expected a non-empty array, got ${
            Array.isArray(parsedWeeklyDistance) ? `an array of length ${parsedWeeklyDistance.length}` : typeof parsedWeeklyDistance
          }`
        );
      } else if (typeof parsedWeeklyDistance[0].weekStartISO !== 'string' || parsedWeeklyDistance[0].weekStartISO.length === 0) {
        fail(
          `/data/stats/weekly-distance.json entry 0 "weekStartISO" expected a non-empty string, got ${JSON.stringify(
            parsedWeeklyDistance[0].weekStartISO
          )}`
        );
      } else if (!Number.isFinite(parsedWeeklyDistance[0].totalKm)) {
        fail(`/data/stats/weekly-distance.json entry 0 "totalKm" expected a finite number, got ${JSON.stringify(parsedWeeklyDistance[0].totalKm)}`);
      } else {
        ok('/data/stats/weekly-distance.json parses with a non-empty array, entry 0 has a non-empty weekStartISO and a finite totalKm');
      }
    }

    const monthlyStatsBody = await expect200(baseUrl, '/data/stats/monthly-stats.json');
    if (monthlyStatsBody) {
      const parsedMonthlyStats = JSON.parse(monthlyStatsBody);
      if (!Array.isArray(parsedMonthlyStats) || parsedMonthlyStats.length === 0) {
        fail(
          `/data/stats/monthly-stats.json expected a non-empty array, got ${
            Array.isArray(parsedMonthlyStats) ? `an array of length ${parsedMonthlyStats.length}` : typeof parsedMonthlyStats
          }`
        );
      } else if (typeof parsedMonthlyStats[0].periodLabel !== 'string' || parsedMonthlyStats[0].periodLabel.length === 0) {
        fail(
          `/data/stats/monthly-stats.json entry 0 "periodLabel" expected a non-empty string, got ${JSON.stringify(
            parsedMonthlyStats[0].periodLabel
          )}`
        );
      } else if (!Number.isFinite(parsedMonthlyStats[0].totalKm)) {
        fail(`/data/stats/monthly-stats.json entry 0 "totalKm" expected a finite number, got ${JSON.stringify(parsedMonthlyStats[0].totalKm)}`);
      } else {
        ok('/data/stats/monthly-stats.json parses with a non-empty array, entry 0 has a non-empty periodLabel and a finite totalKm');
      }
    }

    const yearlyStatsBody = await expect200(baseUrl, '/data/stats/yearly-stats.json');
    if (yearlyStatsBody) {
      const parsedYearlyStats = JSON.parse(yearlyStatsBody);
      if (!Array.isArray(parsedYearlyStats) || parsedYearlyStats.length === 0) {
        fail(
          `/data/stats/yearly-stats.json expected a non-empty array, got ${
            Array.isArray(parsedYearlyStats) ? `an array of length ${parsedYearlyStats.length}` : typeof parsedYearlyStats
          }`
        );
      } else if (typeof parsedYearlyStats[0].periodStart !== 'string' || parsedYearlyStats[0].periodStart.length === 0) {
        fail(
          `/data/stats/yearly-stats.json entry 0 "periodStart" expected a non-empty string, got ${JSON.stringify(
            parsedYearlyStats[0].periodStart
          )}`
        );
      } else if (!Number.isFinite(parsedYearlyStats[0].totalKm)) {
        fail(`/data/stats/yearly-stats.json entry 0 "totalKm" expected a finite number, got ${JSON.stringify(parsedYearlyStats[0].totalKm)}`);
      } else {
        ok('/data/stats/yearly-stats.json parses with a non-empty array, entry 0 has a non-empty periodStart and a finite totalKm');
      }
    }

    const yearOverYearBody = await expect200(baseUrl, '/data/stats/year-over-year.json');
    if (yearOverYearBody) {
      const parsedYearOverYear = JSON.parse(yearOverYearBody);
      // Fixed length is a strong truncation detector here, deliberately NOT
      // relaxed to `> 0`: the document is always pre-filled with one entry
      // per calendar month (compute-advanced-stats.ts:104), so `length ===
      // 12` catches a truncated file that `length > 0` would have accepted.
      const isExactlyTwelveMonths = Array.isArray(parsedYearOverYear) && parsedYearOverYear.length === 12;
      if (!isExactlyTwelveMonths) {
        fail(
          `/data/stats/year-over-year.json expected an array of exactly 12 entries (one per calendar month, ` +
            `per compute-advanced-stats.ts:104), got ${
              Array.isArray(parsedYearOverYear) ? `an array of length ${parsedYearOverYear.length}` : typeof parsedYearOverYear
            }`
        );
      } else if (parsedYearOverYear[0].years === null || typeof parsedYearOverYear[0].years !== 'object') {
        fail(`/data/stats/year-over-year.json entry 0 "years" expected a non-null object, got ${JSON.stringify(parsedYearOverYear[0].years)}`);
      } else {
        ok('/data/stats/year-over-year.json parses with exactly 12 entries and entry 0 has a non-null "years" object');
      }
    }

    // Populated from best-efforts.json below and used as the shard sample
    // population (see the shard block). Declared out here so the shard sample
    // can be derived from the producer's own record of which activities it
    // sharded, rather than from an index field that only mirrors the manifest.
    let bestEffortsActivityIds = null;

    const bestEffortsBody = await expect200(baseUrl, '/data/stats/best-efforts.json');
    if (bestEffortsBody) {
      const parsedBestEfforts = JSON.parse(bestEffortsBody);
      if (parsedBestEfforts.schemaVersion !== 1) {
        fail(`/data/stats/best-efforts.json schemaVersion expected 1, got ${parsedBestEfforts.schemaVersion}`);
      } else if (
        parsedBestEfforts.activities === null ||
        typeof parsedBestEfforts.activities !== 'object' ||
        Object.keys(parsedBestEfforts.activities).length === 0
      ) {
        fail(
          `/data/stats/best-efforts.json "activities" expected a non-null object with at least one key, got ${
            parsedBestEfforts.activities === null || typeof parsedBestEfforts.activities !== 'object'
              ? JSON.stringify(parsedBestEfforts.activities)
              : `an object with ${Object.keys(parsedBestEfforts.activities).length} keys`
          }`
        );
      } else if (
        parsedBestEfforts.rankings === null ||
        typeof parsedBestEfforts.rankings !== 'object' ||
        Object.keys(parsedBestEfforts.rankings).length === 0
      ) {
        fail(
          `/data/stats/best-efforts.json "rankings" expected a non-null object with at least one key, got ${
            parsedBestEfforts.rankings === null || typeof parsedBestEfforts.rankings !== 'object'
              ? JSON.stringify(parsedBestEfforts.rankings)
              : `an object with ${Object.keys(parsedBestEfforts.rankings).length} keys`
          }`
        );
      } else {
        bestEffortsActivityIds = Object.keys(parsedBestEfforts.activities);
        ok(
          '/data/stats/best-efforts.json parses with schemaVersion 1, a non-empty "activities" object, and a non-empty "rankings" object'
        );
      }
    }

    // Per-activity shard sample, ids derived AT RUNTIME — never pinned
    // literals (D-10).
    //
    // The sample population is `best-efforts.json`'s own `activities` keys,
    // NOT `indexDoc.activities.filter(streams.available)`. Those two sets
    // happen to coincide on a healthy day, but only the first is a producer
    // guarantee: shards and the aggregate's `activities` map are written from
    // the same `activities[id]` map (compute-best-efforts.ts), whereas the
    // index's `streams.available` mirrors the *manifest*
    // (compute-dashboard-index.ts), not shard existence. An activity whose
    // stream is truncated/unreadable is deliberately tolerated by
    // compute-best-efforts (threat T-15-02, `skippedUnreadable`) and produces
    // no shard and no aggregate entry — sampling off `streams.available`
    // would turn that tolerated data defect into a 404 and a hard deploy
    // block. Sampling off the aggregate still catches the failure this check
    // exists for: a shard the producer *did* write that the directory copy
    // dropped is listed in the aggregate and 404s here.
    if (bestEffortsActivityIds === null) {
      // best-efforts.json already failed above; nothing to sample from, and
      // re-failing here would double-count the same defect. Deliberately not
      // ok() — nothing was checked, so nothing should be tallied as passing.
      console.log('– /data/stats/best-efforts/{id}.json sample skipped — best-efforts.json did not pass its own checks (already reported above)');
    } else if (bestEffortsActivityIds.length === 0) {
      fail('/data/stats/best-efforts/{id}.json sample: best-efforts.json lists no sharded activities — cannot sample a shard id');
    } else {
      // Three ids spanning the archive (first, middle, last), de-duplicated so
      // a tiny archive does not double-check the same id — a partial or
      // truncated directory copy is the failure this catches, which a
      // newest-only sample would miss.
      const shardSampleIds = [
        ...new Set([
          bestEffortsActivityIds[0],
          bestEffortsActivityIds[Math.floor(bestEffortsActivityIds.length / 2)],
          bestEffortsActivityIds[bestEffortsActivityIds.length - 1],
        ]),
      ];
      for (const shardId of shardSampleIds) {
        const shardBody = await expect200(baseUrl, `/data/stats/best-efforts/${shardId}.json`);
        if (shardBody) {
          const parsedShard = JSON.parse(shardBody);
          if (parsedShard === null || typeof parsedShard !== 'object') {
            fail(`/data/stats/best-efforts/${shardId}.json did not parse to an object, got ${JSON.stringify(parsedShard)}`);
          } else if (String(parsedShard.activityId) !== String(shardId)) {
            fail(
              `/data/stats/best-efforts/${shardId}.json "activityId" expected "${shardId}", got ${JSON.stringify(
                parsedShard.activityId
              )} — best-efforts.json and the shard directory disagree about what exists`
            );
          } else if (!Array.isArray(parsedShard.efforts)) {
            // Shape, not census. An EMPTY `efforts` array is a legitimate
            // producer output — the activity is shorter than the 400 m
            // shortest target (best-effort.types.ts), or every candidate was
            // rejected by the plausibility filter (best-effort-utils.ts);
            // compute-best-efforts counts `activitiesWithEfforts` separately
            // precisely because empty ones are normal. The committed archive
            // already contains one (11865310195, distanceM 0). Only a
            // missing or non-array field is a defect.
            fail(`/data/stats/best-efforts/${shardId}.json "efforts" expected an array, got ${JSON.stringify(parsedShard.efforts)}`);
          } else {
            ok(
              `/data/stats/best-efforts/${shardId}.json parses with activityId "${shardId}" and an "efforts" array (${parsedShard.efforts.length} entries)`
            );
          }
        }
      }
    }

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
      await expect404(baseUrl, `/data/streams/${newestWithoutStream.id}.json`, 'stream-unavailable activity');
    } else {
      console.log('(skipped: no stream-unavailable activity found in the archive)');
    }

    // --- 6. Hashed JS asset referenced by index.html ------------------------

    if (indexHtml) {
      const scriptMatch = indexHtml.match(/<script type="module"[^>]*\ssrc="([^"]+)"/);
      if (!scriptMatch) {
        fail('Could not find a <script type="module" src="..."> tag in index.html');
      } else {
        await expectAssetResolves('module script', scriptMatch[1]);
      }

      // The stylesheet fails the same way and is just as fatal to the page, so
      // hold it to the identical rule rather than only checking the script.
      const styleMatch = indexHtml.match(/<link[^>]*\srel="stylesheet"[^>]*\shref="([^"]+)"/);
      if (!styleMatch) {
        fail('Could not find a <link rel="stylesheet" href="..."> tag in index.html');
      } else {
        await expectAssetResolves('stylesheet', styleMatch[1]);
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
