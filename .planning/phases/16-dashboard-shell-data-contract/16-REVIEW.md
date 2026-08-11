---
phase: 16-dashboard-shell-data-contract
reviewed: 2026-08-11T00:00:00Z
depth: standard
files_reviewed: 37
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
  - src/dashboard/theme.test.ts
  - src/dashboard/theme.ts
  - src/dashboard/view-registry.test.ts
  - src/dashboard/view-registry.ts
  - src/dashboard/view.types.ts
  - src/dashboard/views/calendar.stub.ts
  - src/dashboard/views/detail.ts
  - src/dashboard/views/list.ts
  - src/dashboard/views/overview.ts
  - src/dashboard/views/records.stub.ts
  - src/dashboard/views/stub-view.ts
  - src/dashboard/views/trends.stub.ts
  - src/index.ts
  - src/pages/widgets.html
findings:
  critical: 1
  warning: 7
  info: 11
  total: 19
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-08-11
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

## Summary

Reviewed the Phase 16 dashboard shell, its data contract generators (dashboard index, best-effort exclusions), the two data clients, the router/theme/nav chrome, the build/verify scripts, and the CI workflow. The pipeline code (compute-best-efforts, compute-dashboard-index) is well guarded and thoroughly tested. The dashboard shell, however, contains one confirmed blocker and a cluster of provable defects rooted in the same blind spot: **the August 2026 intervals.icu migration introduced `i`-prefixed activity ids and no-`Z` `start_date_local` strings, and the browser-side code was written against the old Strava-only assumptions.**

Both known UAT gaps are root-caused below:
- **DASH-02** (detail view fails) → CR-01: `isValidActivityId` rejects every intervals.icu id.
- **DASH-03** (invisible theme toggle) → WR-04: the toggle button's color is never pinned to the theme tokens, and its icon CSS is defeated by SVG presentation attributes.

## Critical Issues

### CR-01: `isValidActivityId` rejects all intervals.icu activity ids — detail view broken for every post-migration activity (root cause of DASH-02)

**File:** `src/dashboard/router.ts:101-103`
**Issue:** The validation regex is digits-only:

```ts
export function isValidActivityId(id: string): boolean {
  return typeof id === 'string' && /^\d{1,20}$/.test(id);
}
```

The committed archive contains **55 activities with `i`-prefixed ids** (`data/activities/i174109928.json`, ...) — all activities ingested since the Aug 2026 intervals.icu migration, i.e. exactly the newest rows that the list view renders first. `compute-dashboard-index.ts:172-174` even documents the `i...` prefix, and the doc comment on this very function says "a real Strava/intervals id is well under it," but the pattern was never widened. Both consumers of the chokepoint fail:

- `src/dashboard/views/detail.ts:219-225` — `loadAndRender` renders the "Couldn't load this activity" error state (the exact DASH-02 symptom) before any fetch is attempted, which is why the same files fetch fine over plain HTTP.
- `src/dashboard/data/detail-client.ts:83-86` — `loadDetail` rejects with `InvalidActivityIdError` for the same ids (defense-in-depth on the same broken regex).

**Fix:** Widen the single chokepoint (both consumers inherit it):

```ts
// Strava ids are numeric; intervals.icu-migrated ids are 'i' + digits.
export function isValidActivityId(id: string): boolean {
  return typeof id === 'string' && /^i?\d{1,20}$/.test(id);
}
```

This preserves the traversal/injection guarantees (still no `.`, `/`, `%`, `<`). Add regression cases: `isValidActivityId('i174109928') === true` in `router.test.ts`, and an `i`-id happy path in `detail-client.test.ts` (see IN-07 — neither test file exercises an intervals id today, which is how this shipped).

## Warnings

### WR-01: List and overview views paint their error state into a container they no longer own

**File:** `src/dashboard/views/list.ts:129-146`, `src/dashboard/views/overview.ts:205-220`
**Issue:** Both views correctly guard the *success* path with `if (mountedContainer !== ctx.container) return;` (list.ts:151, overview.ts:224), but the *catch* path calls `ctx.container.replaceChildren()` and appends "Couldn't load activities" / "Couldn't load the overview" **unconditionally**. If the user navigates away while the index fetch is in flight and the fetch then rejects, the stale rejection wipes the currently mounted view and paints the wrong error over it. `detail.ts:242-244` handles this correctly (checks token/container before rendering the error) — the other two views must match.
**Fix:** In both catch blocks, add the same guard before rendering:

```ts
} catch (error) {
  console.error(error);
  if (mountedContainer !== ctx.container) return; // superseded — do not paint
  ctx.container.replaceChildren();
  ...
}
```

### WR-02: `formatActivityDate` misparses no-`Z` `startDateLocal` — timezone-dependent off-by-one dates for all intervals.icu activities

**File:** `src/dashboard/views/list.ts:31-34` (used by list, overview, and detail views)
**Issue:** The function's own comment assumes "Strava-style ... Z-suffixed" input, but intervals.icu-migrated records carry `start_date_local` **without** the `Z` (verified: `data/activities/i174109928.json` has `"start_date_local": "2026-08-06T07:28:22"`). `new Date('2026-08-06T07:28:22')` is parsed as *browser-local* time; the code then reads `getUTC*` components, silently shifting by the viewer's UTC offset. Verified locally: parsing that string on a UTC+2 machine yields `05:28Z`. Any activity whose local start time is inside the viewer's UTC-offset window renders the **wrong calendar date** (e.g. a 00:30 run shown as the previous day for European viewers; evening runs shown as the next day for US viewers).
**Fix:** Normalize before parsing so the wall-clock components are always read back unchanged:

```ts
export function formatActivityDate(isoLocal: string): string {
  const d = new Date(isoLocal.endsWith('Z') ? isoLocal : isoLocal + 'Z');
  ...
}
```

### WR-03: Dashboard index sort key mixes UTC and machine-local parses (and is NaN-unsafe)

**File:** `src/analytics/compute-dashboard-index.ts:190`
**Issue:** `rows.sort((a, b) => Date.parse(b.startDateLocal) - Date.parse(a.startDateLocal))` compares Z-suffixed Strava values (parsed as UTC) against no-`Z` intervals values (parsed in the *build machine's* timezone). On CI (UTC) the two coincide; on a developer machine in CET the intervals rows are skewed by 1-2h, so a locally generated `index.json` can order same-day boundary activities differently than CI. Additionally, if any record has a missing/unparseable `start_date_local`, `Date.parse` returns `NaN`, the comparator returns `NaN`, and the sort order becomes unspecified.
**Fix:** Sort on the normalized epoch with a NaN fallback:

```ts
const key = (s: string) => {
  const t = Date.parse(s.endsWith('Z') ? s : s + 'Z');
  return Number.isNaN(t) ? 0 : t;
};
rows.sort((a, b) => key(b.startDateLocal) - key(a.startDateLocal));
```

### WR-04: Theme toggle styling is structurally broken (root cause of DASH-03)

**File:** `src/dashboard/styles.css:141-155`, `src/dashboard/nav.ts:59-117`, `src/dashboard/index.html:7`
**Issue:** Three compounding defects:
1. **The button's color is never pinned to the theme tokens.** `.theme-toggle` (and `.app-nav__toggle`) sets no `color`, so the icons' `currentColor` resolves to the UA's `ButtonText`. Because `index.html` declares `<meta name="color-scheme" content="light dark">` and nothing syncs the *used* color-scheme to the `data-theme` attribute, a browser with a dark OS preference renders `ButtonText` as near-white while the forced-light nav surface stays `#f5f5f7` — a white icon on a near-white bar, i.e. the DASH-03 "invisible in light mode" symptom.
2. **`.theme-toggle__icon--active { fill: var(--accent); }` never takes effect.** The rule targets the `<svg>` root, but every child (`circle`, `path`) carries its own `fill="currentColor"` presentation attribute (nav.ts:68-73, 110-115), and a specified value on the element always beats an inherited one. The sun's rays additionally use `stroke`, which the rule doesn't set at all. The active-state highlight is dead code.
3. **Nothing hides the inactive icon.** Both sun and moon are always appended (nav.ts:168-169) and no CSS rule hides the non-active one, so the toggle shows both icons at once instead of the current effective theme's icon.

**Fix:**

```css
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"]  { color-scheme: dark; }

.theme-toggle, .app-nav__toggle { color: var(--text); }

.theme-toggle__icon { display: none; }
.theme-toggle__icon--active { display: inline; color: var(--accent); }
```

Using `color` (not `fill`) on the active rule works because the children reference `currentColor` for both fill and stroke.

### WR-05: `emptyDir` is not a Vite option — the "CRITICAL" don't-empty-outDir guard is a misspelled no-op

**File:** `scripts/build-widgets.mjs:98, 186, 211`
**Issue:** The Vite build option is `emptyOutDir`; `emptyDir` is silently ignored. The comment at line 208-211 ("CRITICAL: ... Emptying it would destroy all of them") believes `emptyDir: false` is protecting `dist/widgets/`. Today the build survives only because of Vite's *default*: an `outDir` outside `root` (`src/pages` → `../../dist/widgets`) is not emptied unless explicitly requested. Any future change (e.g. moving `root`, or Vite changing the default) would wipe the 11 widget bundles, the copied data tree, and the page HTML mid-build with no warning, and the deploy step would publish the gutted directory.
**Fix:** Rename all three occurrences to `emptyOutDir` (`true` for the per-widget temp dirs, `false` in `buildPages()` and `buildDashboard()`).

### WR-06: The publish verification script is never run by the pipeline that publishes

**File:** `.github/workflows/daily-refresh.yml:96-124`, `package.json:22`
**Issue:** `scripts/verify-dashboard-publish.mjs` self-describes as "the automated half of Phase 16's exit gate," and `package.json` wires it as `npm run verify-dashboard` — but `daily-refresh.yml` goes straight from `Build widgets` to the Pages deploy. No `verify-dashboard` step (and no `npm test`) runs in CI, so a regression in URL shape, data copying, or the index contract deploys silently every night. Notably, this gate could not have caught CR-01 either (it exercises HTTP paths, not the browser-side id validation), so it is a necessary-but-not-sufficient check that is currently not even running.
**Fix:** Add between build and deploy:

```yaml
      - name: Verify dashboard publish contract
        run: npm run verify-dashboard
```

### WR-07: Malformed-but-parseable best-efforts document empties the entire dashboard index and corrupts totals

**File:** `src/analytics/compute-dashboard-index.ts:140, 129-142`
**Issue:** `bestEfforts?.activities[id]` only optional-chains the *document*; if `best-efforts.json` parses but lacks an `activities` object (truncated write, schema drift), `undefined[id]` throws **inside the per-activity loop for every activity**, each caught by the outer try/catch — producing an index with zero rows and 1,867 `skippedUnreadable`, which then deploys as the live manifest. This defeats the file's stated contract ("OPTIONAL — degrade to an empty lookup on any failure"). Compounding it, `withStreams`/`withHr`/`withCadence`/`lowConfidenceCount` are incremented (lines 129-137) *before* the row is pushed, so any throw later in the iteration (this one, or the `cities` lookup) leaves counters counting activities that produced no row — breaking the reconciliation invariant the test suite asserts (`withStreams + withoutStreams + skippedUnreadable === manifest count`).
**Fix:** Use `bestEfforts?.activities?.[id]` (and `bestEfforts.activities` existence check at load time), and move the counter increments to after the `rows.push(row)` so a skipped activity increments only `skippedUnreadable`.

## Info

### IN-01: `safeResolve` crashes the verify server on malformed percent-encoding

**File:** `scripts/verify-dashboard-publish.mjs:56-65`
**Issue:** `decodeURIComponent(urlPath...)` throws `URIError` on input like `/%`; the throw escapes the `http.createServer` request handler and takes down the process. Harmless for the script's own well-formed requests, but a robustness gap in a function explicitly written as a traversal guard (T-16-VF-01).
**Fix:** Wrap the decode in try/catch and return `null` (403) on failure.

### IN-02: Per-widget temp build directories are never cleaned up

**File:** `scripts/build-widgets.mjs:87, 120-129`
**Issue:** `dist/widgets-temp-0` … `dist/widgets-temp-10` are created per build and never removed, accumulating stale bundles in `dist/`.
**Fix:** `rmSync(tempOutDir, { recursive: true, force: true })` after the copy.

### IN-03: mtime-skip copy never prunes deleted source files

**File:** `scripts/build-widgets.mjs:148-176`
**Issue:** `copyDataFiles` only adds/overwrites; a JSON deleted from `data/activities/` (or a renamed stats file) persists in `dist/widgets/data/` on developer machines and would be published by any local deploy. CI is unaffected (fresh checkout), as the comment notes, but the asymmetry is undocumented at the call site.
**Fix:** Either delete dest files with no source counterpart, or document that local `dist/widgets/data` may go stale and must be removed manually.

### IN-04: Truncation notice hardcodes "100" instead of `MAX_ROWS`

**File:** `src/dashboard/views/list.ts:18, 183`
**Issue:** `Showing the 100 most recent…` will silently lie if `MAX_ROWS` changes.
**Fix:** Interpolate: `` `Showing the ${MAX_ROWS} most recent of ${rows.length} activities...` ``.

### IN-05: Exclusions load message counts activities, not exclusion entries

**File:** `src/analytics/best-effort-exclusions.ts:94`
**Issue:** `index.size` is the number of distinct activity ids; with multiple entries per activity the "Loaded N best-effort exclusions" log undercounts. Cosmetic log inaccuracy only.
**Fix:** Log both: `Loaded ${index.size} excluded activit(y/ies) from N entries`.

### IN-06: Redundant dynamic re-import inside `probeIntervalsCommand`

**File:** `src/index.ts:399`
**Issue:** `const { IntervalsProvider: Provider } = await import('./api/intervals-provider.js')` re-imports a module already imported at line 333 in the same function, purely to reach the static `describeStreams`.
**Fix:** Reuse the earlier binding (`IntervalsProvider.describeStreams(...)`).

### IN-07: Neither id-validation test suite covers intervals.icu ids — the test gap behind CR-01

**File:** `src/dashboard/router.test.ts:86-108`, `src/dashboard/data/detail-client.test.ts:39-121`
**Issue:** Every accepted-id case in both suites is a bare numeric Strava id; there is no `i174109928`-style case in either direction, even though `compute-dashboard-index.test.ts:231-245` explicitly fixtures an `i123` activity for the *generator* side. The asymmetry let CR-01 ship green.
**Fix:** Add `i`-prefixed accept cases (and a reject case like `x123`) to both suites alongside the CR-01 fix.

### IN-08: Fetch failure messages omit the failing URL

**File:** `src/dashboard/data/detail-client.ts:56`, `src/dashboard/data/index-client.ts:58`, `src/dashboard/views/overview.ts:68`
**Issue:** All three throw `Failed to fetch data: <status> <statusText>` with no URL, so a console error from a session with several in-flight fetches cannot be attributed to a file.
**Fix:** Include the URL: `` throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`) ``.

### IN-09: `sportType` can be `undefined` despite its `string` contract

**File:** `src/analytics/compute-dashboard-index.ts:175`, `src/analytics/dashboard-index.types.ts:55`
**Issue:** `(activity.sport_type as string | undefined) ?? activity.type` yields `undefined` when both fields are absent; `JSON.stringify` then drops the key, so published rows can violate `sportType: string` and any Phase 17 filter grouping on it will see `undefined`. (The `??` fallback does correctly handle the `sport_type: null` that real intervals records carry — verified against `data/activities/i174109928.json`.)
**Fix:** `?? activity.type ?? 'Unknown'`.

### IN-10: Malformed stats JSON escalates the overview to a full-page error instead of the documented em-dash degrade

**File:** `src/dashboard/views/overview.ts:112-119, 235`
**Issue:** `fetchStatsJson` degrades a *missing* file to `null`, but a file that parses to the wrong shape (e.g. `totals.totalKm` absent) makes `totals.totalKm.toFixed(1)` throw during render, escalating to `main.ts`'s generic "Something went wrong" page — contradicting the function's "degrades to an em-dash placeholder card" contract.
**Fix:** Guard the reads (`typeof totals?.totalKm === 'number'`) or validate shape inside `fetchStatsJson` and return `null` on mismatch.

### IN-11: CSP relies on `'unsafe-inline'` for scripts

**File:** `src/dashboard/index.html:8, 19-37`
**Issue:** `script-src 'self' 'unsafe-inline'` exists solely for the theme-bootstrap inline script, but it whitelists *every* inline script, weakening the CSP's XSS backstop for athlete-authored strings. Low practical risk given the strict `textContent`-only DOM discipline, but cheap to tighten.
**Fix:** Replace `'unsafe-inline'` with the bootstrap script's hash (`'sha256-...'`), regenerated if the inline copy changes.

---

_Reviewed: 2026-08-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
