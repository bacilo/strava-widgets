---
phase: 16-dashboard-shell-data-contract
reviewed: 2026-08-11T12:32:47Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - .github/workflows/daily-refresh.yml
  - data/best-effort-exclusions.json
  - scripts/build-widgets.mjs
  - scripts/verify-dashboard-publish.mjs
  - src/analytics/best-effort-exclusions.test.ts
  - src/analytics/best-effort-exclusions.ts
  - src/analytics/best-effort.types.ts
  - src/analytics/compute-best-efforts.test.ts
  - src/analytics/compute-best-efforts.ts
  - src/analytics/compute-dashboard-index.test.ts
  - src/analytics/compute-dashboard-index.ts
  - src/analytics/dashboard-index.types.ts
  - src/dashboard/data/detail-client.test.ts
  - src/dashboard/data/detail-client.ts
  - src/dashboard/data/index-client.test.ts
  - src/dashboard/data/index-client.ts
  - src/dashboard/index.html
  - src/dashboard/main.ts
  - src/dashboard/nav.ts
  - src/dashboard/router.test.ts
  - src/dashboard/router.ts
  - src/dashboard/styles.css
  - src/dashboard/styles.test.ts
  - src/dashboard/theme.test.ts
  - src/dashboard/theme.ts
  - src/dashboard/view-registry.test.ts
  - src/dashboard/view-registry.ts
  - src/dashboard/view.types.ts
  - src/dashboard/views/calendar.stub.ts
  - src/dashboard/views/detail.ts
  - src/dashboard/views/list.test.ts
  - src/dashboard/views/list.ts
  - src/dashboard/views/overview.ts
  - src/dashboard/views/records.stub.ts
  - src/dashboard/views/stub-view.ts
  - src/dashboard/views/trends.stub.ts
  - src/index.ts
  - src/pages/widgets.html
findings:
  critical: 2
  warning: 16
  info: 11
  total: 29
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-08-11T12:32:47Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

Reviewed the dashboard SPA shell (router, view registry, theme engine, nav, three
real views plus three stubs), its two data clients, the two generator modules and
their contracts, the build script, the publish-verification gate, and the CI
workflow that ties them together.

The XSS surface is genuinely clean: every athlete-authored string reaches the DOM
via `textContent`, `isValidActivityId` is a real single chokepoint (grep confirms
exactly one regex and two call sites), and the `#`-prefixed `href` construction
cannot carry a `javascript:` scheme. `npm test` passes 368/368 in 447 ms and
`npm run verify-dashboard` passes 16/16 against the current build.

That said, this phase's own regression themes are not fully closed:

- **A date/number formatter still produces wrong output on real published data.**
  `formatPace` renders `5:60/km` for 11 of the 1,867 rows in the live
  `data/dashboard/index.json` (verified by replaying the shipped values through
  the shipped function). The bug is copy-pasted into two files.
- **The "don't paint into a container you no longer own" guard that plans 05-07
  added to `list.ts` and `overview.ts` was never added to the app-wide error
  boundary in `main.ts`,** which is the one handler that unconditionally wipes
  `#app`.
- **The publish gate still cannot fail for the bug class it was hardened
  against.** It now correctly rejects a root-absolute URL taken out of
  `index.html`, but it never looks at how the *client code* builds its data URLs
  and it never asserts the mount prefix on the paths it reports, so its own log
  lines still read like root-absolute requests succeeding. Its per-activity
  coverage is also data-order-dependent, so the `i`-prefix path it happens to
  exercise today is not guaranteed tomorrow.
- **Generator resilience is asymmetric.** `compute-dashboard-index.ts` wraps every
  per-activity read in a try/catch so one bad file cannot abort a 1,868-activity
  run, then sorts with a comparator that dereferences a field without a null
  check, outside that try/catch.

## Critical Issues

### CR-01: `formatPace` renders an impossible `X:60/km` on real published data

**File:** `src/dashboard/views/list.ts:53-58` and `src/dashboard/views/detail.ts:27-32`

**Issue:** `Math.floor(s/60)` and `Math.round(s%60)` are computed independently, so
any pace whose seconds component rounds up to 60 prints as `m:60`. This is not
theoretical — replaying the 1,867 `paceSecPerKm` values from the current
`data/dashboard/index.json` through the shipped function produces 11 broken rows:

```
359.9 -> 5:60/km     (activity 16853051178)
359.6 -> 5:60/km     (activity 12537591212)
419.8 -> 6:60/km     (activity 10859442897)
359.7 -> 5:60/km     (activity 9110648308)
299.5 -> 4:60/km     (activity 6797720149)
```

`detail.ts` is worse: it recomputes pace from the raw
`movingTimeSec / (distanceM / 1000)` with no rounding at all, so it hits the
boundary on far more inputs than the pre-rounded index values do.

Note also that this is exactly the failure mode a duplicated helper produces: the
function exists twice, verbatim, in two files (see WR-14).

**Fix:** Round once, then decompose — and carry the minute rollover.

```ts
function formatPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm)) return DASH;
  const total = Math.round(secPerKm);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
}
```

Move the single corrected copy into a shared module (e.g.
`src/dashboard/views/format.ts`) and import it from `list.ts` and `detail.ts`, the
way `formatActivityDate` is already shared. Add a regression test for
`359.6`, `359.9`, `299.5` and `419.8`.

### CR-02: the app-wide error boundary in `main.ts` has no ownership guard and can wipe a newer view

**File:** `src/dashboard/main.ts:35-70`

**Issue:** `onMatch` is `async` but is registered as the router's `onMatch`
callback and invoked from a synchronous `hashchange` handler
(`router.ts:142-144`), which never awaits it. Two `onMatch` invocations can
therefore overlap. The catch block at lines 55-69 then does:

```ts
} catch (error) {
  console.error(error);
  container.replaceChildren();      // <- unconditional
  ... appends "Something went wrong"
}
```

with no check that `container` still belongs to the invocation that threw. If
navigation A's `view.mount()` rejects after navigation B has already mounted and
painted, A's handler destroys B's rendered output and replaces it with a
permanent error panel. Only a reload recovers, because nothing re-triggers a
route resolution for the unchanged hash.

This is precisely the defect class the same phase identified and fixed inside the
views — `list.ts:141-145` and `overview.ts:207-211` both carry a
`if (mountedContainer !== ctx.container) return;` guard with a "must not wipe the
newly-mounted view (WR-01)" comment. `main.ts` is the one handler that was missed,
and it is the *only* handler for a rejection from any future view's `mount()`, so
its correctness matters more than any individual view's.

Reachability caveat, stated honestly: with today's archive I could not force a
rejection out of any of the six registered views (all three data views catch their
own load failures; I verified all 1,868 activity records carry `name`, `distance`,
`moving_time`, `start_date` and `start_date_local`, and all 1,843 stream files
carry a non-empty `t`). The handler is nonetheless incorrect as written, is the
designated boundary for every view added in Phases 17-18, and contradicts the
guard pattern this phase established three files away.

**Fix:** Token the navigation and check it before touching the DOM.

```ts
let navToken = 0;

async function onMatch(match: RouteMatch): Promise<void> {
  const myToken = ++navToken;
  currentView?.unmount?.();
  currentView = null;
  // ... unchanged ...
  try {
    await view.mount({ container, routeParams: match.routeParams, query: match.query });
  } catch (error) {
    console.error(error);
    if (myToken !== navToken) return;   // superseded — do not paint
    container.replaceChildren();
    // ... error state ...
  }
}
```

## Warnings

### WR-01: the publish gate never inspects how the client builds its data URLs

**File:** `scripts/verify-dashboard-publish.mjs:225-261`

**Issue:** The gate hardcodes the data paths it probes
(`/data/dashboard/index.json`, `/data/stats/...`, `/data/activities/<id>.json`,
`/data/streams/<id>.json`) and asserts the *server* serves them. It never reads
the URLs the SPA actually constructs. The dashboard's runtime URLs come from
`index-client.ts:47-48` (`baseUrl ?? 'data/'`), `detail-client.ts:50,67,70`, and
`overview.ts:19` (`STATS_BASE_URL = 'data/stats/'`). If any of those defaults were
changed to `/data/...`, every check in this script would still pass 16/16 while
the deployed site 404s on every fetch — the identical false-pass shape that let the
absolute-asset bug ship green at 15/15.

**Fix:** Assert the client defaults are relative, in the gate or in a unit test:

```js
// in verify-dashboard-publish.mjs, after the HTTP checks
const clientSources = [
  'src/dashboard/data/index-client.ts',
  'src/dashboard/data/detail-client.ts',
  'src/dashboard/views/overview.ts',
];
for (const file of clientSources) {
  const text = readFileSync(resolve(process.cwd(), file), 'utf8');
  const rootAbsolute = text.match(/['"`]\/data\//g);
  if (rootAbsolute) {
    fail(`${file} builds a root-absolute data URL (${rootAbsolute[0]}); use a relative 'data/' base`);
  } else {
    ok(`${file} uses a relative data base URL`);
  }
}
```

A stronger variant: import the compiled `createIndexClient`/`createDetailClient`
with a recording `fetchImpl`, capture the URLs they emit, and feed *those*
strings through `expectAssetResolves`.

### WR-02: the gate's per-activity coverage is data-order-dependent, so the `i`-prefix path is not reliably exercised

**File:** `scripts/verify-dashboard-publish.mjs:203-205, 240-257`

**Issue:** `newestRow = indexDoc.activities[0]` and
`newestWithStream = activities.find(row => row.streams?.available === true)` pick
whatever happens to sort first. Today that is `i174284902`, so the run
coincidentally covers the intervals.icu `i`-prefixed id shape whose mishandling was
CR-01 of the previous round. The moment a Strava-era activity lands at the top (a
backfill, a re-sort, a manual edit), that coverage silently disappears and the
gate keeps printing 16/16.

**Fix:** Probe one id of each shape explicitly when both exist:

```js
const iPrefixed = indexDoc.activities.find((r) => /^i\d+$/.test(r.id));
const bareNumeric = indexDoc.activities.find((r) => /^\d+$/.test(r.id));
for (const [label, row] of [['i-prefixed', iPrefixed], ['bare-numeric', bareNumeric]]) {
  if (!row) { fail(`No ${label} activity id present in the index — id-shape coverage lost`); continue; }
  await expect200(baseUrl, `/data/activities/${row.id}.json`);
}
```

### WR-03: `startDateSortKey` is not null-safe and its throw escapes the per-activity try/catch

**File:** `src/analytics/compute-dashboard-index.ts:51-55` (used at line 209)

**Issue:** The function does `startDateLocal.endsWith('Z')` with no type or null
check. Its own doc comment advertises NaN-safety ("An unparseable value previously
made `Date.parse` return `NaN` ... falling back to `0` here confines the damage to
that single row"), but a *missing* `start_date_local` throws
`TypeError: Cannot read properties of undefined (reading 'endsWith')` (verified).
That throw happens inside the `rows.sort()` comparator at line 209 — outside the
per-activity `try/catch` at lines 127-206 whose entire purpose is that one bad
file must not abort the run. One archive record missing the field therefore aborts
the whole index generation, which in CI (WR-08) blocks the nightly deploy entirely.

`compute-dashboard-index.test.ts:525` covers a *malformed string*
(`'not-a-date'`) but never a missing field, which is why this survived.

**Fix:**

```ts
function startDateSortKey(startDateLocal: unknown): number {
  if (typeof startDateLocal !== 'string' || startDateLocal.length === 0) return 0;
  const normalized = startDateLocal.endsWith('Z') ? startDateLocal : `${startDateLocal}Z`;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}
```

Add a test writing an activity with `start_date_local: undefined` and assert the
run completes with the other rows intact.

### WR-04: `distanceM` and `movingTimeSec` bypass the `numOrNull` normalisation applied to every sibling field

**File:** `src/analytics/compute-dashboard-index.ts:172-176, 182-184`

**Issue:** `elevationGainM`, `avgHr`, `maxHr` and `avgCadenceRpm` all go through
`numOrNull`, but `distanceM` and `movingTimeSec` are copied raw:

```ts
const distanceM = activity.distance;
const movingTimeSec = activity.moving_time;
```

`DashboardIndexRow` types both as non-nullable `number`, so a record missing either
field emits `distanceM: undefined`, `JSON.stringify` drops the key entirely, and
the browser then renders `(undefined / 1000).toFixed(1)` → the literal string
`"NaN km"` in `list.ts:84` and `overview.ts:89`. The type system does not catch it
because `StravaActivity` carries a widening index signature (the same reason
`numOrNull` exists at all — see its doc comment in `detail.ts:34`).

Today's archive has zero such records, so this is latent, not live.

**Fix:** Normalise consistently and skip the row when the two required fields are
absent:

```ts
const distanceM = numOrNull(activity.distance);
const movingTimeSec = numOrNull(activity.moving_time);
if (distanceM === null || movingTimeSec === null) {
  console.warn(`  ${id}: missing distance/moving_time; skipping`);
  skippedUnreadable++;
  continue;
}
```

### WR-05: the theme toggle sticks when `localStorage` writes fail

**File:** `src/dashboard/nav.ts:205-210`, with `src/dashboard/theme.ts:101-108`

**Issue:** `handleThemeToggleClick` derives the current mode by re-reading
storage on every click:

```ts
const current = readStoredMode(localStorage);
const next = cycleThemeMode(current);
applyThemeMode(next);
```

`applyThemeMode` deliberately swallows `setItem` failures ("Safari private mode"
is called out in its comment), and `readStoredMode` falls back to `'auto'` on a
throwing `getItem`. In a browser where the write fails, every click reads `'auto'`
and cycles to `'light'` — the toggle can never reach `dark`, and in the
throwing-`getItem` case it cannot change at all. `theme.test.ts` covers
`throwOnSet`/`throwOnGet` at the `theme.ts` level, but nothing covers the
nav-level cycle, which is where the state actually lives.

**Fix:** Keep the mode in a module-local variable and treat storage as a
best-effort cache:

```ts
let currentMode: ThemeMode = readStoredMode(localStorage);
function handleThemeToggleClick(): void {
  currentMode = cycleThemeMode(currentMode);
  applyThemeMode(currentMode);
  updateThemeToggle(currentMode);
}
```

and have `watchSystemTheme`'s callback consult `currentMode === 'auto'` too.

### WR-06: the views' staleness guard compares a container that never changes

**File:** `src/dashboard/views/list.ts:143, 164`; `src/dashboard/views/overview.ts:209, 229`

**Issue:** Both guards are `if (mountedContainer !== ctx.container) return;`, but
`main.ts:25` resolves `#app` once and passes the *same element* to every mount of
every view. The guard therefore only fires because `unmount()` sets
`mountedContainer = null` — it is a "was I unmounted?" check wearing an identity
check's clothes. Consequence: when the same view is unmounted and re-mounted while
its first load is still in flight (`/list` → `/activity/x` → `/list` in quick
succession), `mountedContainer` is back to the same element, the guard passes, and
the superseded first mount paints. `detail.ts` gets this right by also carrying a
`requestToken` (lines 216, 227, 242, 255); `list.ts` and `overview.ts` do not.

**Fix:** Mirror `detail.ts`'s monotonic token in `list.ts` and `overview.ts`:

```ts
let mountToken = 0;
// in mount():
const myToken = ++mountToken;
// after every await:
if (myToken !== mountToken || mountedContainer !== ctx.container) return;
// in unmount():
mountToken++;
```

### WR-07: a best-efforts failure silently publishes a dashboard with every PR erased

**File:** `.github/workflows/daily-refresh.yml:76-94`

**Issue:** `Compute best efforts` is `continue-on-error: true`. When it fails,
`compute-dashboard-index` catches the missing `data/stats/best-efforts.json`
(`compute-dashboard-index.ts:96-101`), warns, and emits a *structurally valid*
index where every row has `prCount: 0` and `excludedFromRecords: false`. The
verify gate only checks `schemaVersion === 1` and a non-empty `activities` array
(lines 195-201, 228-234), so it passes. The site deploys with "Recent PRs" reading
"No personal records in the archive yet" (`overview.ts:136-140`) and every PR badge
gone from the activity list, with nothing but a workflow annotation to say so.

The step comments in the workflow call these steps "blocking, with no error-tolerant
escape hatch ... that is the entire point of a gate", but the gate is downstream of
two `continue-on-error` producers and cannot see a *degraded* payload, only an
absent one.

**Fix:** Add a content assertion to the gate that fails on a wholesale collapse:

```js
const prTotal = indexDoc.activities.reduce((n, r) => n + (r.prCount ?? 0), 0);
if (prTotal === 0) {
  fail('Every index row has prCount 0 — best-efforts.json was probably missing when the index was generated');
} else {
  ok(`index carries ${prTotal} PR markings across ${indexDoc.activities.length} rows`);
}
```

### WR-08: the dashboard-index failure warning states the opposite of what happens

**File:** `.github/workflows/daily-refresh.yml:92-94`

**Issue:** The annotation says "Dashboard index computation failed, the dashboard
will serve a stale index." There is no stale index to serve: `data/dashboard/` is
gitignored (`.gitignore`), CI runs on a fresh checkout, and the file is never
committed. A failed compute means `copyDataFiles` skips the directory entirely
(`build-widgets.mjs:148`), `verify-dashboard-publish.mjs:37-45` hits its FATAL
branch, `npm run verify-dashboard` exits 1, and the job aborts *before* the deploy
step. The real outcome is "the entire nightly deploy is blocked", which is a very
different thing for an operator reading the annotation at 5 AM.

**Fix:**

```yaml
run: echo "::warning::Dashboard index computation failed. data/dashboard/ is gitignored and not present on a fresh checkout, so the publish gate will FATAL and this run will not deploy."
```

### WR-09: the exclusions loader ignores `schemaVersion`, and the constant declared for it is dead

**File:** `src/analytics/best-effort-exclusions.ts:87-102`; `src/analytics/best-effort.types.ts:19`

**Issue:** `BEST_EFFORT_EXCLUSIONS_SCHEMA_VERSION = 1` is exported with the comment
"Bump only via an explicit, coordinated migration of
`data/best-effort-exclusions.json`", and grep across `src/` and `scripts/` finds
exactly one occurrence — its own declaration. `loadExclusions` reads the file as
`BestEffortExclusionsFile` and passes `file.exclusions` straight to
`buildExclusionIndex` without ever looking at `schemaVersion`. A future v2 file
with a changed entry shape would be silently mis-parsed into an empty or partial
index, and because `buildExclusionIndex` skips unrecognised entries without a
warning (WR-10), the run would report "Loaded 0 best-effort exclusions" and
proceed.

**Fix:** Warn (do not throw — the never-throws contract is deliberate) on a version
mismatch:

```ts
if (file.schemaVersion !== BEST_EFFORT_EXCLUSIONS_SCHEMA_VERSION) {
  console.warn(
    `${exclusionsPath} schemaVersion ${file.schemaVersion} != expected ` +
      `${BEST_EFFORT_EXCLUSIONS_SCHEMA_VERSION}; entries may be ignored`
  );
}
```

Mirror the index client's precedent (`index-client.ts:62-66`).

### WR-10: a typo in the hand-maintained exclusions file produces no signal at all

**File:** `src/analytics/best-effort-exclusions.ts:35-64`

**Issue:** Three `continue` paths drop an entry silently: a non-object entry
(line 36), a missing/non-string `activityId` (line 39), a non-array `distances`
(line 50), and a `distances` array whose members are all unrecognised (line 57).
The file is explicitly "Hand-maintained by the developer" (its own `note` field),
so `"distances": "1k"` instead of `["1k"]`, or `"5km"` instead of `"5k"`, is the
expected failure mode — and the only observable effect is that
`Loaded N best-effort exclusion(s)` prints a smaller `N` than the author expects,
buried in a nightly log. The module's stated goal (T-16-EX-02) is that a bad row
cannot poison the index; that goal does not require the bad row to be invisible.

**Fix:** Count and report skips without changing the never-throws contract:

```ts
let skipped = 0;
// ... `skipped++` before each `continue` ...
if (skipped > 0) {
  console.warn(`Skipped ${skipped} malformed exclusion entr${skipped === 1 ? 'y' : 'ies'}`);
}
```

Return the count from `buildExclusionIndex` or log it inside the function.

### WR-11: `inFlight` in the detail client is a permanent cache, not an in-flight map

**File:** `src/dashboard/data/detail-client.ts:51, 88-101`

**Issue:** The map is named `inFlight` and documented as "Test-support only: empties
the per-id cache", but nothing ever removes a *fulfilled* entry — only the
rejection path deletes (line 96). Every activity the user opens is retained for the
lifetime of the page, and a re-open never re-fetches. Two consequences: the name
actively misleads a future maintainer into thinking entries are transient, and a
long-lived tab spanning the 05:00 UTC refresh will keep serving pre-refresh detail
JSON for anything already visited while the index (also memoized,
`index-client.ts:50-52`) is equally stale.

Contrast `index-client.ts`, which names the same construct `inFlight` but is
genuinely a single-document memo with an explicit `document_` field alongside it.

**Fix:** Rename to `cache` and document the retention policy explicitly, or add a
bounded/TTL eviction:

```ts
const cache = new Map<string, Promise<ActivityDetail>>();
/** Fulfilled entries are retained for the page session by design (D-10); use clear() to drop them. */
```

### WR-12: the dashboard CSP allows `'unsafe-inline'` for scripts

**File:** `src/dashboard/index.html:8`

**Issue:** `script-src 'self' 'unsafe-inline'` is required only by the theme
bootstrap immediately below it (lines 19-37), but it disables the CSP's principal
protection for the whole document. The rest of the file goes to real trouble over
injection defence (the allow-list in the bootstrap is called out as the T-16-TH-01
mitigation), so the blanket `'unsafe-inline'` undercuts the stated intent. The
current code has no HTML-string sinks, so this is defence-in-depth, not a live
hole.

**Fix:** Hash the one inline script and drop `'unsafe-inline'`:

```
script-src 'self' 'sha256-<base64 of the bootstrap script body>';
```

The bootstrap is static, so the hash is stable; compute it in `build-widgets.mjs`
and assert it in `verify-dashboard-publish.mjs` so a bootstrap edit fails the gate
rather than silently blocking the script.

### WR-13: `copyDataFiles`'s mtime skip can publish stale files and never prunes deletions

**File:** `scripts/build-widgets.mjs:156-174`

**Issue:** Two gaps in the "efficiency guard":

1. `if (destMtime >= srcMtime) shouldCopy = false` — a source file whose content
   changed while its mtime was preserved or set backwards (`cp -p`, `rsync -a`,
   `tar -x` of an archive, a restored backup) is never republished, and the `>=`
   makes an identical-mtime pair a skip too.
2. Destination files with no corresponding source are never removed. Delete an
   activity from `data/activities/` and its JSON stays in `dist/widgets/data/`
   forever locally.

CI is unaffected (fresh checkout), but the local `dist/` a developer inspects, and
the local `npm run verify-dashboard` run that gates their work, can diverge from
what CI would produce — which is the situation this whole verification script
exists to prevent.

**Fix:** Compare size as well as mtime, and prune orphans:

```js
const srcStat = statSync(srcPath);
const destStat = existsSync(destPath) ? statSync(destPath) : null;
const shouldCopy = !destStat || destStat.mtimeMs < srcStat.mtimeMs || destStat.size !== srcStat.size;
```

and after the copy loop, `for (const file of readdirSync(dest)) if (!existsSync(resolve(src, file))) rmSync(resolve(dest, file));`

### WR-14: three formatters are copy-pasted across the view layer

**File:** `src/dashboard/views/list.ts:45-58`, `src/dashboard/views/detail.ts:20-32`, `src/dashboard/views/overview.ts:44-55`

**Issue:** `formatDurationHms` is byte-identical in `list.ts` and `detail.ts`;
`formatPace` is byte-identical in the same two files; `buildStatCard` is
byte-identical in `detail.ts` and `overview.ts`. `list.ts`'s own header comment
establishes the opposite convention for the row renderer ("one row renderer, two
views") and `formatActivityDate` is correctly shared, so the duplication is
inconsistent with the module's stated design as well as being the direct cause of
CR-01 needing two fixes instead of one.

**Fix:** Extract to `src/dashboard/views/format.ts` (`formatDurationHms`,
`formatPace`, `formatActivityDate`, `DASH`) and
`src/dashboard/views/components.ts` (`buildStatCard`, `appendBadge`), and import
from all three views.

### WR-15: the asset check inspects only the first script and the first stylesheet

**File:** `scripts/verify-dashboard-publish.mjs:273-289`

**Issue:** `indexHtml.match(...)` (non-global) returns the first match only. Vite
emits exactly one of each today, but it also emits
`<link rel="modulepreload" href="...">` for split chunks and additional CSS files
when a view starts pulling in a chart or map library — which Phase 17 explicitly
will. Those URLs get zero scrutiny, so the next root-absolute URL to ship could be
one of them and this gate would pass.

**Fix:** Iterate all asset-bearing tags:

```js
const assetRefs = [
  ...indexHtml.matchAll(/<script[^>]*\ssrc="([^"]+)"/g),
  ...indexHtml.matchAll(/<link[^>]*\s(?:href)="([^"]+)"/g),
];
if (assetRefs.length < 2) fail('index.html referenced fewer than 2 assets — regex probably stopped matching');
for (const [, url] of assetRefs) await expectAssetResolves('asset', url);
```

Keep the existing explicit script/stylesheet checks so a *missing* tag still
fails loudly.

### WR-16: an unguarded `decodeURIComponent` in the gate's request handler crashes the process instead of failing a check

**File:** `scripts/verify-dashboard-publish.mjs:64-65`

**Issue:** `decodeURIComponent(urlPath.split('?')[0])` throws `URIError` on a
malformed escape (`/strava-widgets/%`). Inside an `http.createServer` request
listener, that throw is an `uncaughtException`: the process dies with a stack
trace, and `main().catch(...)` at line 302 does not see it because the rejection
never reaches that promise. The gate's exit code is still non-zero, so it is not a
false pass, but the operator sees a Node crash rather than a named check failure —
and only self-generated requests reach it today, so it is a robustness issue
rather than a live one.

**Fix:**

```js
function safeResolve(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null; // malformed escape -> 403, same as off-mount
  }
  ...
}
```

## Info

### IN-01: three exports are dead

**File:** `src/dashboard/theme.ts:24` (`THEME_MODES`), `src/dashboard/view.types.ts:39` (`RoutePath`), `src/dashboard/nav.ts:228-234` (`destroy`)

**Issue:** grep across `src/` (excluding tests) finds no consumer for `THEME_MODES`
or the `RoutePath` type. `createNav().destroy()` is never called — `main.ts:22`
creates the nav once and holds it for the page lifetime — so
`unsubscribeSystemTheme` (line 213) never runs and the three
`removeEventListener` calls are unreachable.

**Fix:** Delete `THEME_MODES` and `RoutePath`, or add the consumer that justifies
them. Keep `destroy` only if a test exercises it; otherwise drop it and the
`unsubscribeSystemTheme` handle with it.

### IN-02: `.view` is nested inside `.view`, doubling the page inset

**File:** `src/dashboard/index.html:42` with `src/dashboard/views/list.ts:171`, `overview.ts:236`, `detail.ts:149`

**Issue:** `<main id="app" class="view">` already applies
`padding: var(--space-lg); max-width: 1100px; margin-inline: auto`
(`styles.css:177-181`), and all three data views append another
`<div class="view">` inside it — 48px of horizontal inset instead of 24px, and a
1100px box centred inside a 1100px box. The stub views and error states append no
`.view` wrapper, so the two families of screens are inset differently.

**Fix:** Drop `class="view"` from `<main id="app">` in `index.html` and let each
view own its wrapper, or drop the per-view wrapper and let `#app` own it. Pick one.

### IN-03: the gate logs paths without the mount prefix it just added

**File:** `scripts/verify-dashboard-publish.mjs:171, 178, 185, 188`

**Issue:** `expect200` reports `GET ${path}`, where `path` is the mount-relative
half. A successful run prints `✓ GET /assets/index-DJmOzHMs.js -> 200` even though
the request actually went to `http://127.0.0.1:PORT/strava-widgets/assets/...`.
That output reads exactly like a root-absolute URL succeeding, which is the
signal a reader would use to spot the very bug this script was hardened against.

**Fix:** Log the full URL: `` ok(`GET ${baseUrl}${path} -> 200`) ``, or at least
`` `GET ${MOUNT_PREFIX}${path}` ``.

### IN-04: `MOUNT_PREFIX` hardcodes the repo name in a third place

**File:** `scripts/verify-dashboard-publish.mjs:62`

**Issue:** `/strava-widgets` is duplicated from the deploy target and from the
comment in `build-widgets.mjs:206-217`. A repo rename leaves the gate probing a
prefix that no longer exists — harmlessly, since `base: './'` makes the prefix
value irrelevant to correctness, but the comment's claim that this mirrors
production would quietly stop being true.

**Fix:** Derive it: `const MOUNT_PREFIX = '/' + JSON.parse(readFileSync('package.json','utf8')).name;` or read it from the git remote, with a comment that only "non-root" matters.

### IN-05: `STUB_PHASE[route]` can interpolate `undefined` into user-visible copy

**File:** `src/dashboard/views/stub-view.ts:27`

**Issue:** `STUB_PHASE` (`view.types.ts:65-69`) covers exactly the three current
stub routes. A fourth stub registered without a `STUB_PHASE` entry renders
"This view lands in Phase undefined."

**Fix:** `const phase = STUB_PHASE[route] ?? 'a future phase';` and interpolate
`phase`, or type `createStubView`'s `route` parameter as `keyof typeof STUB_PHASE`.

### IN-06: activity-level `excludedFromRecords` is true for a partial exclusion

**File:** `src/analytics/compute-best-efforts.ts:239`, surfaced at `src/dashboard/views/list.ts:98-100`

**Issue:** `excludedFromRecords: exclusions.has(id)` is true when *any* distance is
excluded, which matches the type's documented contract
(`best-effort.types.ts:104`, "at least one entry"). The dashboard then renders a
flat "Excluded from records" badge, which overstates a `distances: ["1k"]`
exclusion where the other six distances still count.

**Fix:** Either label the badge from the per-effort data
(`Excluded: 1k`) or rename the row field to `partiallyExcludedFromRecords` so the
UI cannot read it as total.

### IN-07: `lowConfidenceEfforts` counts efforts that were then excluded

**File:** `src/analytics/compute-best-efforts.ts:212-219`

**Issue:** `if (effort.lowConfidence) lowConfidenceEfforts++` runs before the
exclusion `continue` on line 218, so the total mixes ranked and withheld efforts.
`effortsComputed` (line 281) deliberately counts both, so the two are consistent
with each other — but the field name suggests a PR-contention population.

**Fix:** Document the intent in `best-effort.types.ts:155` the way
`effortsExcluded` is documented on line 153, or move the increment below the
exclusion check.

### IN-08: `compute-all-stats` leaves the dashboard index stale

**File:** `src/index.ts:228-276`

**Issue:** `computeAllStatsCommand` runs basic, advanced, geo and best-efforts, but
not `computeDashboardIndex`. A developer running `npm run process` regenerates
`best-efforts.json` while `data/dashboard/index.json` keeps the old `prCount` and
`excludedFromRecords` values. The help text on line 483 lists exactly what it does,
so this is a discoverability trap rather than a contract violation.

**Fix:** Append `computeDashboardIndex` to `computeAllStatsCommand` (it depends on
best-efforts output, so it must run last) and update lines 483 and 498.

### IN-09: eleven `dist/widgets-temp-*` directories are left behind by every build

**File:** `scripts/build-widgets.mjs:87, 120-129`

**Issue:** `buildWidget` writes to `dist/widgets-temp-${index}`, copies the one
`.js` out, and never removes the directory. `ls dist/` currently shows
`widgets-temp-0` through `widgets-temp-10`. They are outside `publish_dir`
(`./dist/widgets`) so nothing ships, but they defeat any "is dist clean?"
reasoning and accumulate stale bundles from renamed widgets.

**Fix:** `rmSync(tempOutDir, { recursive: true, force: true })` after the copy, in
a `finally`.

### IN-10: `buildWidget` silently produces nothing when no `.js` is emitted

**File:** `scripts/build-widgets.mjs:123-131`

**Issue:** `const jsFile = files.find(f => f.endsWith('.js')); if (jsFile) { copy }`
— when the find misses, nothing is copied and the script still prints
`✓ Built ${widget.name}.iife.js`. The success line is unconditional and asserts an
output filename it never verified exists.

**Fix:**

```js
if (!jsFile) {
  throw new Error(`${widget.name}: no .js emitted into ${tempOutDir}`);
}
```

### IN-11: unused workflow permissions

**File:** `.github/workflows/daily-refresh.yml:19-22`

**Issue:** `pages: write` and `id-token: write` are granted for OIDC-based Pages
deployment, but the workflow deploys via `peaceiris/actions-gh-pages@v4` with
`GITHUB_TOKEN` pushing to a branch (lines 137-142), which needs only
`contents: write`.

**Fix:** Drop `pages: write` and `id-token: write`, or migrate to
`actions/deploy-pages` and use them.

---

_Reviewed: 2026-08-11T12:32:47Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
