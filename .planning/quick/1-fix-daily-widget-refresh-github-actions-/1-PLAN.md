---
phase: quick-1
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/geo/geocoder.ts
  - src/index.ts
autonomous: true
requirements: [FIX-CI-01]
must_haves:
  truths:
    - "Running `node dist/index.js compute-stats` does NOT trigger SQLite/offline-geocoder initialization"
    - "Running `node dist/index.js compute-geo-stats` still works correctly with lazy geocoder"
    - "Daily Widget Refresh workflow succeeds for compute-stats and compute-advanced-stats steps"
  artifacts:
    - path: "src/geo/geocoder.ts"
      provides: "Lazy-initialized geocoder (no eager SQLite load)"
      contains: "function getGeo"
    - path: "src/index.ts"
      provides: "Dynamic import of geo module only for geo commands"
      contains: "import\\("
  key_links:
    - from: "src/geo/geocoder.ts"
      to: "offline-geocoder"
      via: "lazy initialization on first geocode call"
      pattern: "getGeo"
    - from: "src/index.ts"
      to: "src/geo/compute-geo-stats.ts"
      via: "dynamic import() only in geo command handlers"
      pattern: "await import"
---

<objective>
Fix the Daily Widget Refresh GitHub Actions workflow failure caused by eager SQLite initialization from the offline-geocoder package.

Purpose: The `compute-stats` CI step fails with SQLITE_CANTOPEN because importing `compute-geo-stats` at the top of `index.ts` triggers `geocoder.ts` to eagerly load the offline-geocoder SQLite database -- even when running non-geo commands. Lazy-initializing the geocoder and dynamically importing the geo module prevents this.

Output: Updated `geocoder.ts` and `index.ts` that only load SQLite when geo commands actually run.
</objective>

<execution_context>
@/Users/pedf/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pedf/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/geo/geocoder.ts
@src/index.ts
@src/geo/compute-geo-stats.ts
@.github/workflows/daily-refresh.yml
</context>

<tasks>

<task type="auto">
  <name>Task 1: Lazy-initialize offline-geocoder in geocoder.ts</name>
  <files>src/geo/geocoder.ts</files>
  <action>
Replace the eager module-level initialization of offline-geocoder with a lazy singleton pattern:

1. Remove the top-level eager initialization (lines 8-15):
   ```
   // REMOVE these lines:
   import { createRequire } from 'module';
   const require = createRequire(import.meta.url);
   const geocoder = require('offline-geocoder');
   const geo = geocoder();
   ```

2. Replace with a lazy initialization function:
   ```typescript
   import { createRequire } from 'module';

   let geo: any = null;

   function getGeo(): any {
     if (!geo) {
       const require = createRequire(import.meta.url);
       const geocoder = require('offline-geocoder');
       geo = geocoder();
     }
     return geo;
   }
   ```

3. Update `geocodeCoordinate` to use `getGeo()` instead of the bare `geo` variable. Specifically, change line 77:
   - FROM: `const result = await geo.reverse(lat, lng);`
   - TO: `const result = await getGeo().reverse(lat, lng);`

4. Keep everything else unchanged: the GeoLocation/GeoCache interfaces, roundCoord, coordToCacheKey, geocodeActivity. Only the initialization pattern and the one call site in geocodeCoordinate change.
  </action>
  <verify>
Run `npx tsc --noEmit` to confirm TypeScript compilation succeeds with no errors.
  </verify>
  <done>geocoder.ts uses lazy singleton pattern; offline-geocoder and its SQLite database are only loaded on first actual geocode call, not at import time.</done>
</task>

<task type="auto">
  <name>Task 2: Dynamic-import geo module in index.ts</name>
  <files>src/index.ts</files>
  <action>
Remove the static top-level import of compute-geo-stats and replace with dynamic imports in the two command handlers that need it:

1. Remove the static import on line 10:
   ```
   // REMOVE this line:
   import { computeGeoStats } from './geo/compute-geo-stats.js';
   ```

2. In `computeGeoStatsCommand()` (around line 167), add a dynamic import at the start of the try block:
   ```typescript
   const { computeGeoStats } = await import('./geo/compute-geo-stats.js');
   ```
   Place it right before the console.log on the existing first line of the try block.

3. In `computeAllStatsCommand()` (around line 185), add the same dynamic import inside the try block, just before the geo stats section (before the comment "// Run geo stats"):
   ```typescript
   const { computeGeoStats } = await import('./geo/compute-geo-stats.js');
   ```

4. All other imports and code in index.ts remain unchanged. The `computeAllStats` and `computeAdvancedStats` static imports stay as-is since those modules have no SQLite dependency.
  </action>
  <verify>
1. Run `npx tsc --noEmit` to confirm compilation.
2. Run `npm run build` to produce dist/.
3. Run `node dist/index.js compute-stats` -- must succeed without any SQLite errors (and without touching geocoder at all).
4. Run `node dist/index.js help` -- must succeed without SQLite errors.
  </verify>
  <done>
- `node dist/index.js compute-stats` runs without loading offline-geocoder or SQLite.
- `node dist/index.js compute-advanced-stats` runs without loading offline-geocoder or SQLite.
- `node dist/index.js compute-geo-stats` still dynamically loads the geocoder and works.
- `node dist/index.js help` works without errors.
  </done>
</task>

</tasks>

<verification>
After both tasks are complete:

1. Build: `npm run build` succeeds.
2. Non-geo commands: `node dist/index.js compute-stats` and `node dist/index.js compute-advanced-stats` succeed without SQLITE_CANTOPEN.
3. Geo command: `node dist/index.js compute-geo-stats` still works (may fail gracefully if no data, but does not crash on import).
4. Help: `node dist/index.js help` prints usage without errors.
</verification>

<success_criteria>
- The SQLITE_CANTOPEN error no longer occurs when running non-geo commands
- The Daily Widget Refresh workflow's "Process statistics" step will succeed
- Geographic statistics computation still works when explicitly invoked
- No regressions in any existing CLI commands
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-daily-widget-refresh-github-actions-/1-SUMMARY.md`
</output>
