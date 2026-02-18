---
phase: 10-geocoding-foundation-map-infrastructure
plan: 01
subsystem: geocoding
tags: [geonames, offline-geocoder, sqlite, reverse-geocoding, versioned-cache]

# Dependency graph
requires:
  - phase: 05-geocoding-infrastructure
    provides: geocoding infrastructure with offline-geocode-city
provides:
  - GeoNames cities1000 dataset via offline-geocoder (166K+ cities worldwide)
  - Versioned cache system (v2) with geocoder metadata tracking
  - Archived v1 geo data for accuracy comparison (GEO-03 prep)
  - Improved city granularity (Copenhagen neighborhoods vs suburbs)
affects: [11-route-polyline-map, 12-heatmap-widget, geo-stats-widget]

# Tech tracking
tech-stack:
  added: [offline-geocoder@1.0.0, sqlite3, geonames cities1000 dataset]
  patterns: [versioned cache with metadata, async geocoding, promise-based geocoder API]

key-files:
  created:
    - src/types/offline-geocoder.d.ts
    - data/geo/v1/location-cache.json
    - data/geo/v1/cities.json
    - data/geo/v1/countries.json
  modified:
    - src/geo/geocoder.ts
    - src/geo/cache-manager.ts
    - src/geo/compute-geo-stats.ts
    - data/geo/location-cache.json
    - data/geo/cities.json
    - data/geo/countries.json
    - data/geo/geo-metadata.json

key-decisions:
  - "Switched from offline-geocode-city (UN/LOCODE) to offline-geocoder (GeoNames) to fix suburb-instead-of-city issue"
  - "Made geocodeActivity async to work with offline-geocoder's promise-based API"
  - "Versioned cache schema (v2) with version+geocoder metadata for future migrations"
  - "Generated GeoNames database from source data (166K cities) during npm install postprocessing"

patterns-established:
  - "Cache versioning: GeoCache interface includes version number and geocoder identifier for safe migration"
  - "Async geocoding: geocodeActivity returns Promise<GeoLocation | null> for database lookups"
  - "Data archival: Old geo data preserved in versioned subdirectories for comparison"

# Metrics
duration: 5min
completed: 2026-02-17
---

# Phase 10 Plan 01: Geocoding Foundation Summary

**GeoNames cities1000 geocoder with versioned cache (v2), replacing UN/LOCODE library to fix suburb-instead-of-city problem**

## Performance

- **Duration:** 5 minutes (358 seconds)
- **Started:** 2026-02-17T07:01:20Z
- **Completed:** 2026-02-17T07:07:18Z
- **Tasks:** 2
- **Files modified:** 8
- **Files created:** 4

## Accomplishments

- **Migrated geocoding library:** Replaced offline-geocode-city (UN/LOCODE data) with offline-geocoder (GeoNames cities1000 dataset with 166,323 cities worldwide)
- **Fixed city accuracy:** Activities now resolve to actual cities/neighborhoods (Copenhagen area shows Frederiksberg/Vanløse/Christianshavn) instead of suburbs (old: Roskilde)
- **Versioned cache system:** Implemented GeoCache v2 with version number and geocoder identifier for safe future migrations
- **Archived old data:** Preserved v1 geocoding results at data/geo/v1/ for GEO-03 comparison analysis
- **Backward compatibility:** Output JSON schema unchanged (cities.json/countries.json same fields) - existing widgets work without modification

## Task Commits

Each task was committed atomically:

1. **Task 1: Archive old geo data and swap geocoding library** - `7879658` (chore)
   - Archived existing geo data to data/geo/v1/
   - Removed offline-geocode-city dependency
   - Installed offline-geocoder@1.0.0
   - Verified package swap successful

2. **Task 2: Update geocoder, cache manager, and compute-geo-stats** - `e5a68a0` (feat)
   - Updated geocoder.ts to use offline-geocoder API
   - Made geocodeActivity async (Promise-based)
   - Implemented versioned GeoCache (v2) with metadata
   - Added TypeScript declarations for offline-geocoder
   - Updated cache-manager with version checking
   - Added geocoderVersion field to geo-metadata.json
   - Regenerated all geo data (1658/1808 activities geocoded, 92% coverage)

## Files Created/Modified

**Created:**
- `src/types/offline-geocoder.d.ts` - TypeScript declarations for offline-geocoder (CommonJS module)
- `data/geo/v1/location-cache.json` - Archived old geocoding cache (v1)
- `data/geo/v1/cities.json` - Archived old city statistics
- `data/geo/v1/countries.json` - Archived old country statistics

**Modified:**
- `src/geo/geocoder.ts` - Switched to offline-geocoder, async API, versioned cache access (cache.entries)
- `src/geo/cache-manager.ts` - Version checking, createEmptyCache helper, CURRENT_VERSION=2
- `src/geo/compute-geo-stats.ts` - Async geocoding loop, geocoderVersion in metadata
- `data/geo/location-cache.json` - Regenerated with v2 format (version, geocoder, entries)
- `data/geo/cities.json` - Regenerated with improved city names (86 cities)
- `data/geo/countries.json` - Regenerated (23 countries)
- `data/geo/geo-metadata.json` - Added geocoderVersion field

## Decisions Made

**1. Generated GeoNames database during migration**
- **Context:** offline-geocoder package doesn't include database (~12MB SQLite file)
- **Decision:** Ran generation script to download GeoNames cities1000.txt and build db.sqlite
- **Rationale:** Required for library to function, one-time setup cost, 166K cities vs ~5K in UN/LOCODE
- **Impact:** Database generation took ~2min during Task 2 execution

**2. Made geocodeActivity async**
- **Context:** offline-geocoder uses Promise-based API (.reverse() returns Promise)
- **Decision:** Changed geocodeActivity signature to async function returning Promise<GeoLocation | null>
- **Rationale:** offline-geocoder performs SQLite queries asynchronously, can't use sync API
- **Impact:** compute-geo-stats.ts loop updated with await, no breaking changes to other code

**3. Used CommonJS require for offline-geocoder**
- **Context:** offline-geocoder is CommonJS module, import statement failed in ESM context
- **Decision:** Used createRequire from 'module' to load offline-geocoder
- **Rationale:** Bridges ESM/CommonJS gap without requiring module type changes
- **Impact:** Added type declarations to support TypeScript compilation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Generated GeoNames database**
- **Found during:** Task 2 (running compute-geo-stats)
- **Issue:** SQLITE_CANTOPEN error - offline-geocoder requires database file at node_modules/offline-geocoder/data/db.sqlite, not included in npm package
- **Fix:** Ran generation script (scripts/generate_geonames.sh) to download GeoNames cities1000 data and build SQLite database (166,323 features)
- **Files modified:** node_modules/offline-geocoder/data/db.sqlite (created), plus temporary .txt/.tsv files
- **Verification:** compute-geo-stats completed successfully, geocoded 1658/1808 activities
- **Committed in:** Not committed (node_modules ignored), but documented in summary

**2. [Rule 1 - Bug] Fixed offline-geocoder API mismatch**
- **Found during:** Task 2 (initial implementation)
- **Issue:** Plan specified geo.search(lat, lng) but actual API is geo.reverse(lat, lng), different return structure
- **Fix:** Updated geocoder.ts to use .reverse() method, map result.country.id/name to countryIso2/countryName
- **Files modified:** src/geo/geocoder.ts, src/types/offline-geocoder.d.ts
- **Verification:** TypeScript compiled without errors, geocoding returned correct results
- **Committed in:** e5a68a0 (Task 2 commit)

**3. [Rule 3 - Blocking] Added TypeScript declarations for offline-geocoder**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** TS7016 error - no declaration file for offline-geocoder
- **Fix:** Created src/types/offline-geocoder.d.ts with full type definitions for API
- **Files modified:** src/types/offline-geocoder.d.ts (created)
- **Verification:** npm run build succeeded with zero errors
- **Committed in:** e5a68a0 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All deviations necessary to make offline-geocoder work in TypeScript ESM environment. Plan assumption about API was incorrect (search vs reverse). No scope creep - geocoding migration completed as intended.

## Issues Encountered

**1. Incorrect library version in plan**
- **Issue:** Plan specified offline-geocoder@^1.0.2 but latest version is 1.0.0
- **Resolution:** Installed @1.0.0 which worked correctly
- **Impact:** None - functionality identical, version number error in plan

**2. Database generation not documented in plan**
- **Issue:** Plan didn't mention offline-geocoder requires manual database generation
- **Resolution:** Ran scripts/generate_geonames.sh to download GeoNames data and build SQLite database
- **Impact:** Added ~2min to Task 2 execution, one-time setup cost

**3. API structure mismatch**
- **Issue:** Plan described incorrect API (geo.search returning array) vs actual (geo.reverse returning single result object)
- **Resolution:** Read source code, updated implementation to use correct API
- **Impact:** Implementation differs from plan but achieves same outcome

## User Setup Required

None - no external service configuration required. Database generation is one-time setup completed during plan execution.

## Data Quality Improvement

**Old library (offline-geocode-city / UN/LOCODE):**
- Top city: "Roskilde" (1320 activities) - actually a suburb 30km west of Copenhagen
- Coverage: ~5,000 cities worldwide (trade/transport locations)

**New library (offline-geocoder / GeoNames cities1000):**
- Top cities: "Frederiksberg" (872), "Vanløse" (237), "Christianshavn" (155) - all Copenhagen neighborhoods
- Coverage: 166,323 cities worldwide with population >1000
- Granularity: Now distinguishes between Copenhagen neighborhoods instead of lumping all as "Roskilde"

**Backward compatibility verified:**
- Output JSON schema unchanged (same field names in cities.json/countries.json)
- Existing geo-table-widget and geo-stats-widget work without modification
- Old data archived at data/geo/v1/ for GEO-03 comparison analysis

## Next Phase Readiness

**Ready for Phase 10 Plan 02 (Route Polyline Decoding & Map Infrastructure):**
- ✅ GeoNames geocoder operational with 92% coverage
- ✅ Versioned cache system supports future migrations
- ✅ City accuracy improved for map markers
- ✅ Old data archived for comparison
- ✅ All tests passing
- ✅ TypeScript compiles without errors

**Blockers:** None

**Concerns:**
- Database file (12MB) lives in node_modules - not committed to git. Future npm installs will require running generation script again OR we should move database to project data/ directory.
- GeoNames data is English-only - multilingual city names not supported
- Geocoding is now async (Promise-based) - any synchronous callers would need updating (none exist currently)

---
*Phase: 10-geocoding-foundation-map-infrastructure*
*Completed: 2026-02-17*

## Self-Check: PASSED

**Created files verified:**
- ✓ src/types/offline-geocoder.d.ts
- ✓ data/geo/v1/location-cache.json
- ✓ data/geo/v1/cities.json
- ✓ data/geo/v1/countries.json

**Commits verified:**
- ✓ 7879658 (Task 1: chore - archive and swap)
- ✓ e5a68a0 (Task 2: feat - migrate geocoder)

**Data integrity verified:**
- ✓ geo-metadata.json contains geocoderVersion: "geonames-cities1000"
- ✓ location-cache.json has version: 2, geocoder: "geonames-cities1000"
- ✓ Tests: 18 passed (0 failed)

All claims in summary verified against actual project state.
