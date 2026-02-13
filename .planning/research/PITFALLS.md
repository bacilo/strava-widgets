# Pitfalls: Strava API Integration & Fitness Data Visualization

Research for personal Strava analytics & visualization platform (static site, GitHub Pages).

---

## 1. Rate Limit Management

### The Pitfall
Exceeding Strava's API rate limits (100 requests/15min, 1000/day) causes temporary bans and cascading failures in data refresh pipelines.

**Common mistakes:**
- Fetching all activities on every page load
- Not caching API responses locally
- Requesting detailed activity data when summary data suffices
- Parallel requests without rate limit tracking
- Daily rebuild pipeline hitting limits during development/testing

**Warning Signs:**
- HTTP 429 responses in logs
- Inconsistent data on page refreshes
- Pipeline failures during peak development
- Users reporting "data not loading"

**Prevention Strategy:**
- **Implement tiered caching:** Store API responses in static JSON files committed to repo
- **Incremental updates:** Only fetch new/updated activities since last sync
- **Request batching:** Use summary endpoints first, detailed only when needed
- **Rate limit buffer:** Target 80% of limits (80 req/15min, 800/day) to allow headroom
- **Local development mode:** Use cached data fixtures instead of live API calls
- **Backoff retry logic:** Exponential backoff with jitter on 429 responses

**Phase to Address:** Foundation (Phase 1) - before first API integration

---

## 2. OAuth Token Management in Static Sites

### The Pitfall
Storing refresh tokens in client-side code or committing them to public repos exposes credentials and violates Strava's terms.

**Common mistakes:**
- Storing tokens in localStorage without encryption
- Hardcoding tokens in JavaScript files
- Committing .env files with secrets to GitHub
- No token refresh logic for expired access tokens
- Assuming tokens never expire (they expire in 6 hours)

**Warning Signs:**
- Tokens appearing in browser DevTools/Network tab
- Authentication failures after 6 hours
- Tokens visible in public GitHub repo
- Manual re-authentication required frequently

**Prevention Strategy:**
- **Never store refresh tokens client-side** - use a serverless function (Netlify/Vercel) as proxy
- **Token refresh architecture:**
  - Store refresh token in serverless function environment variables
  - Client calls serverless endpoint with short-lived session token
  - Serverless function handles Strava OAuth refresh
  - Return fresh access token to client (in-memory only)
- **For truly static approach:**
  - Manual OAuth flow during build time
  - Store access token as GitHub secret
  - GitHub Actions fetches data using token
  - Commit processed data (not tokens) to repo
- **Token rotation:** Refresh proactively before 6-hour expiry
- **Audit:** Never commit files with "token", "secret", "client_secret" in .gitignore

**Phase to Address:** Foundation (Phase 1) - OAuth architecture must be correct from start

---

## 3. Geographic Data Privacy Violations

### The Pitfall
Displaying exact GPS coordinates of home/work locations violates user privacy and Strava's API terms.

**Common mistakes:**
- Showing full activity routes without privacy zones
- Not respecting Strava's map_privacy settings
- Displaying start/end coordinates verbatim
- Caching detailed GPS streams without filtering
- Creating heatmaps that reveal home address

**Warning Signs:**
- Activity start points cluster at specific location (home)
- Map shows exact route from doorstep
- Strava API returns activities with map.summary_polyline = null (privacy flag)
- User complaints about exposed locations

**Prevention Strategy:**
- **Check privacy flags:** Respect `map.privacy` field in API responses
- **Fuzzy start/end:** Add random offset (100-500m) to first/last GPS points
- **Privacy zones:**
  - Detect clustering of start/end points
  - Automatically blur/hide routes within 200m of clusters
  - Allow manual privacy zone definition
- **Data minimization:** Don't store detailed GPS streams unless necessary for feature
- **Aggregation only:** Use heatmaps/route density without precise coordinates
- **User control:** Allow users to hide specific activities from visualizations

**Phase to Address:** Foundation (Phase 1) - before processing any GPS data

---

## 4. Timezone and Time Series Data Handling

### The Pitfall
Inconsistent timezone handling leads to incorrect stats, duplicate activities, and broken time-based visualizations.

**Common mistakes:**
- Mixing UTC and local timezones in calculations
- Not accounting for DST transitions
- Assuming activity start_date_local is UTC
- Using JavaScript Date() without timezone libraries
- Aggregating stats by day without considering user's timezone

**Warning Signs:**
- Activity counts off by one on day boundaries
- Charts showing activity at wrong time of day
- Monthly/weekly stats don't match Strava's totals
- Activities appearing on wrong dates near midnight

**Prevention Strategy:**
- **Standardize on UTC:** Store all timestamps in UTC internally
- **Use timezone library:** date-fns-tz or Luxon for conversions
- **Respect activity timezone:** Strava provides timezone in API response
- **Day boundaries:** Calculate daily stats using activity's local timezone, not viewer's
- **ISO 8601 format:** Always use standardized timestamp formats
- **DST testing:** Test aggregations across DST transition dates (March/November)

**Phase to Address:** Core Development (Phase 2) - before time-series visualizations

---

## 5. Static Site Data Staleness

### The Pitfall
GitHub Pages serves cached data that becomes stale, leading to outdated stats and user confusion.

**Common mistakes:**
- Relying on users to manually trigger rebuilds
- No visual indication of data freshness
- Cache headers causing browser to serve old data
- GitHub Actions failures going unnoticed
- No fallback when daily rebuild fails

**Warning Signs:**
- Users reporting "my latest activity isn't showing"
- Stats frozen at specific date
- GitHub Actions tab showing failed workflows
- Data timestamp showing days ago

**Prevention Strategy:**
- **Scheduled rebuilds:** GitHub Actions cron job daily at low-traffic time
- **Data timestamp:** Display "Last updated: [timestamp]" prominently on every page
- **Cache busting:**
  - Use hash-based filenames for data JSON (data.[hash].json)
  - Set appropriate Cache-Control headers
  - Force refresh with query params (?v=[timestamp])
- **Failure alerts:**
  - GitHub Actions sends email on workflow failure
  - Status badge on site showing build status
  - Fallback to last successful build data
- **Manual trigger:** Allow on-demand rebuild via GitHub Actions workflow_dispatch
- **Incremental updates:** Store daily snapshots, merge with historical data

**Phase to Address:** Core Development (Phase 2) - before daily pipeline setup

---

## 6. Activity Type Assumptions

### The Pitfall
Hardcoding logic for specific activity types breaks when Strava adds new types or users have unexpected activities.

**Common mistakes:**
- Assuming only "Run" and "Ride" types exist
- Hardcoded switch statements for activity types
- Visualization layouts breaking on unexpected types (Swim, Hike, Kayak, etc.)
- Distance-based stats for stationary activities (Yoga, Workout)
- Pace calculations for non-moving activities

**Warning Signs:**
- Charts showing "NaN" or "Infinity" for certain activities
- Activities disappearing from views
- Console errors: "Cannot read property of undefined"
- Zero-distance activities causing division errors

**Prevention Strategy:**
- **Type whitelist approach:** Define supported types, gracefully handle others
- **Fallback rendering:** Generic activity card for unknown types
- **Conditional metrics:**
  - Only calculate pace for running/walking
  - Only show distance for moving activities
  - Use activity.type to determine relevant stats
- **Type mapping:** Create activity type groups (Cardio, Strength, Water, Winter)
- **Defensive coding:** Check for null/undefined before calculations
- **Test data:** Include edge cases (0 distance, 0 duration, uncommon types)

**Phase to Address:** Core Development (Phase 2) - before stat computation logic

---

## 7. Large Dataset Performance Issues

### The Pitfall
Loading and rendering years of activity data in browser crashes tabs and creates unusable interfaces.

**Common mistakes:**
- Loading all activities into single JSON file
- Rendering all data points on charts simultaneously
- No pagination or virtualization
- Processing full GPS streams for every activity
- Recalculating stats on every render

**Warning Signs:**
- Browser tab freezing on page load
- "Out of memory" errors in console
- Slow scrolling/interaction lag
- Charts taking >5 seconds to render
- File sizes >1MB for data files

**Prevention Strategy:**
- **Data splitting:**
  - Separate files by year/month (activities-2024-01.json)
  - Load on-demand based on selected date range
  - Summary data in main file, details lazy-loaded
- **Chart optimization:**
  - Downsample data points (max 1000 points per chart)
  - Use canvas instead of SVG for large datasets
  - Progressive rendering with loading states
- **Virtual scrolling:** Render only visible activity cards
- **Computed aggregates:**
  - Pre-calculate stats during build
  - Don't recalculate in browser
  - Cache computation results
- **Web workers:** Process heavy calculations off main thread
- **Memory management:** Clear old data when loading new ranges

**Phase to Address:** Polish (Phase 3) - after MVP with growing dataset

---

## 8. Polyline Encoding/Decoding Errors

### The Pitfall
Incorrectly decoding Strava's encoded polylines results in garbled maps and incorrect route visualizations.

**Common mistakes:**
- Using wrong precision (Strava uses precision 5, not 6)
- Not handling negative coordinates properly
- Coordinate order confusion (lat,lng vs lng,lat)
- Character encoding issues with special characters
- Off-by-one errors in decode algorithm

**Warning Signs:**
- Routes appearing in wrong continent
- Zig-zag patterns on maps
- Routes offset by constant distance
- Console errors from mapping libraries
- Activities with coordinates at (0, 0)

**Prevention Strategy:**
- **Use proven libraries:**
  - @mapbox/polyline for encoding/decoding
  - Don't implement from scratch unless necessary
- **Validate coordinates:**
  - Lat must be -90 to 90
  - Lng must be -180 to 180
  - First point should be near expected location
- **Coordinate system:** Standardize on [lat, lng] or [lng, lat] project-wide
- **Test cases:**
  - Known routes with expected coordinates
  - Activities from different hemispheres
  - Routes crossing date line
- **Precision setting:** Explicitly set precision=5 in decoder

**Phase to Address:** Extended Features (Phase 3+) - when implementing maps

---

## 9. Metric Unit Inconsistencies

### The Pitfall
Mixing metric/imperial units or incorrect conversions leads to confusing stats and calculation errors.

**Common mistakes:**
- Strava API returns meters, displaying as kilometers without conversion
- Not handling user's preferred unit system
- Hardcoding conversions (1 mile ≠ 1.6 km exactly)
- Pace vs speed confusion (min/km vs km/h)
- Elevation in feet vs meters inconsistency

**Warning Signs:**
- Distance showing 5000 instead of 5km
- Pace showing impossible values (e.g., 1:00 min/mile)
- Speed charts in wrong units
- Unit labels missing or incorrect
- US users seeing only metric

**Prevention Strategy:**
- **Canonical storage:** Store all values in metric (meters, seconds, kg)
- **Display conversion:** Convert to user preference only at display time
- **Unit context:** Always show units in UI (5.2 km, not just 5.2)
- **Consistent formatting:**
  - Distance: 1 decimal for km (5.2 km), 2 for miles (3.24 mi)
  - Pace: mm:ss format (5:23 /km)
  - Elevation: whole numbers (342 m)
- **Helper functions:** Centralized conversion utilities
- **User preference:** Detect from Strava profile or allow toggle
- **Constants:** Use precise values (1 mile = 1.609344 km)

**Phase to Address:** Core Development (Phase 2) - before displaying any stats

---

## 10. Correlation vs Causation in Fitness Analytics

### The Pitfall
Deriving misleading insights from correlations without statistical rigor leads to incorrect training recommendations.

**Common mistakes:**
- Claiming "more distance = better performance" without controlling variables
- Ignoring confounding factors (weather, sleep, stress)
- Cherry-picking date ranges to show desired trends
- Not accounting for training cycles (build/taper)
- Presenting correlation coefficient without context

**Warning Signs:**
- Insights contradicting established training science
- Stats that don't account for activity type differences
- "Optimize X to improve Y" claims without evidence
- Linear assumptions for non-linear relationships
- Ignoring statistical significance

**Prevention Strategy:**
- **Humble language:** "Correlation observed" not "This causes that"
- **Context provision:** Show sample size, date range, confidence intervals
- **Multiple variables:** Display related metrics together (volume AND intensity)
- **Segment by type:** Compare runs to runs, not runs to rides
- **Training zones:** Respect established heart rate/power zones
- **Disclaimers:** "For informational purposes, not medical/training advice"
- **Conservative insights:** Focus on descriptive stats over prescriptive recommendations
- **Literature basis:** Ground insights in exercise science principles

**Phase to Address:** Extended Features (Phase 3+) - if implementing insights/recommendations

---

## Summary: Critical Mistake Categories

1. **Security/Privacy:** OAuth tokens, GPS privacy (Foundation)
2. **API Constraints:** Rate limits, token refresh (Foundation)
3. **Data Integrity:** Timezones, unit conversions, activity types (Core Development)
4. **Performance:** Large datasets, efficient rendering (Polish)
5. **User Experience:** Data staleness, error handling (Core Development)
6. **Domain Knowledge:** Fitness metrics, polyline encoding (Extended Features)

**Highest Priority Pitfalls to Address First:**
- #2: OAuth Token Management (security risk)
- #3: Geographic Data Privacy (legal/ethical risk)
- #1: Rate Limit Management (blocks development)
- #5: Static Site Data Staleness (core UX)
- #9: Metric Unit Inconsistencies (credibility)
