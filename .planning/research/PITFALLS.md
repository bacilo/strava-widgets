# Pitfalls Research: Geographic Data Extraction & Widget Customization

**Domain:** Strava Analytics - Geographic Statistics & Widget System Enhancement
**Researched:** 2026-02-14
**Confidence:** HIGH

**Context:** Milestone v1.1 adds reverse geocoding for 1,808 activities, geographic statistics/tables, and HTML attribute-based widget customization to an existing TypeScript/Vite/Chart.js platform on GitHub Pages.

---

## Critical Pitfalls

### Pitfall 1: Reverse Geocoding API Cost Explosion

**What goes wrong:**
Processing 1,808+ activities through a reverse geocoding API during development/testing rapidly burns through free tiers and incurs unexpected costs. Multiple build attempts, CI failures, and iterative development can easily result in 10,000+ requests within days, triggering bills of $50-200+ or service suspension.

**Why it happens:**
- Developers run full geocoding in local dev without understanding request counts
- CI rebuilds trigger full re-geocoding on every failed pipeline
- No incremental processing logic (re-geocoding already processed activities)
- Testing with full dataset instead of subset
- GitHub Actions workflow failures cause repeated full runs
- Team members running concurrent builds multiply request counts

**How to avoid:**
- **Pre-flight cost calculation:** 1,808 activities at Google's $5 per 1,000 = $9 one-time, but development multiplier (10-20x) = $90-180 total
- **Incremental geocoding:** Only geocode activities lacking location data (check for existing lat/lng → location mapping)
- **Development subset:** Use first 50 activities for local development, full dataset only in CI
- **Request tracking:** Log every API call with timestamp to monitor usage
- **Geocoding cache:** Store coordinate → location mappings in separate JSON file, reuse across activities at same location
- **Rate limit enforcement:** Use bottleneck library (already in dependencies) to limit to 1-2 req/sec maximum
- **Free tier choice:** Nominatim (OpenStreetMap) free for reasonable use, LocationIQ free 10k/day
- **One-time batch:** Run geocoding as separate script, commit results, never re-run unless new activities added
- **CI guard:** Environment variable `SKIP_GEOCODING=true` for non-geocoding builds

**Warning signs:**
- API usage dashboard showing thousands of requests in single day
- CI builds taking 30+ minutes (1,808 activities at 1 req/sec = 30 minutes minimum)
- Email notifications about approaching/exceeding quota
- 429 rate limit errors in logs
- Unexpected charges on credit card
- Service degradation or temporary bans

**Phase to address:**
Phase 1 (Geographic Data Extraction) - before writing any geocoding code, establish cost guardrails and incremental processing strategy

---

### Pitfall 2: GPS Coordinate Quality Issues Breaking Geocoding

**What goes wrong:**
Strava GPS data contains missing coordinates, indoor activities with no GPS, signal loss segments, and low-accuracy points that cause reverse geocoding to return wrong cities, oceans, or ZERO_RESULTS errors. This produces garbage geographic statistics like "10 runs in Pacific Ocean" or missing data for 20% of activities.

**Why it happens:**
- Indoor treadmill runs have no GPS data
- Urban canyon signal loss creates gaps or straight-line interpolation
- GPS bounce in tall buildings causes coordinates offset by 100m+
- Start/end points may be in parking lots, not actual run location
- Strava privacy zones mask exact coordinates (returns null)
- Low battery causing GPS sampling degradation
- Activities uploaded without time information have unreliable coordinates

**How to avoid:**
- **Pre-geocoding validation:**
  ```typescript
  - Check activity.map exists and map.summary_polyline is not null
  - Verify start_latlng and end_latlng are not [0, 0] or null
  - Skip activities with map.privacy === "only_me" or lacking GPS data
  ```
- **Coordinate selection strategy:**
  - Don't use first GPS point (often parking lot/home driveway)
  - Use point 500m into activity as "representative location"
  - For short runs (<2km), use midpoint
  - Weight toward middle of activity to avoid privacy zone issues
- **Error handling for geocoding:**
  - ZERO_RESULTS → mark as "Unknown Location", don't retry
  - Ocean coordinates → validate with coastline database, mark as "Invalid GPS"
  - Confidence scoring: require accuracy_type >= "rooftop" or similar
- **Fallback hierarchy:**
  - Primary: Reverse geocode representative point
  - Fallback 1: Use activity.timezone to infer country
  - Fallback 2: Use athlete.city from profile
  - Last resort: Mark as "Location unavailable"
- **Data quality tracking:**
  - Track % of activities successfully geocoded
  - Flag activities with suspicious results (ocean, different country than timezone)
  - Maintain separate counts for "high confidence" vs "inferred" locations

**Warning signs:**
- Geographic stats showing activities in unexpected locations (ocean, wrong continent)
- High percentage (>10%) of activities with no location
- Cities appearing that don't match athlete's known locations
- Activities geocoded to administrative boundaries rather than actual cities
- Console logs showing ZERO_RESULTS for many activities
- Coordinates at exactly (0, 0) - the "Null Island" indicator

**Phase to address:**
Phase 1 (Geographic Data Extraction) - build validation and fallback logic BEFORE first geocoding attempt

---

### Pitfall 3: HTML Attribute Type Safety Collapse

**What goes wrong:**
HTML attributes only accept strings, causing type coercion bugs when widget code expects numbers, booleans, or objects. Developers write `<strava-widget max-items="10">` expecting number 10, but JavaScript receives string "10", breaking comparisons, arithmetic, and causing NaN errors. Worse, complex attributes like `colors='{"primary":"#ff0000"}'` require JSON parsing that fails silently or throws errors.

**Why it happens:**
- HTML spec: all attributes are DOMString type
- JavaScript's loose equality (==) hides the problem in some cases
- Developers test with hardcoded values, not attribute-passed values
- TypeScript types don't enforce runtime attribute parsing
- attributeChangedCallback receives string, must manually convert
- No validation framework for attribute values
- JSON.parse() failures on malformed JSON attributes

**How to avoid:**
- **Strict attribute parsing pattern:**
  ```typescript
  // In attributeChangedCallback
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (newValue === null) return;

    switch (name) {
      case 'max-items':
        const parsed = parseInt(newValue, 10);
        if (isNaN(parsed) || parsed < 1) {
          console.warn(`Invalid max-items: ${newValue}, using default 10`);
          this._maxItems = 10;
        } else {
          this._maxItems = parsed;
        }
        break;
      case 'show-chart':
        // Parse boolean: "true", "false", "", presence
        this._showChart = newValue === 'true' || newValue === '';
        break;
      case 'colors':
        try {
          this._colors = JSON.parse(newValue);
        } catch (e) {
          console.error(`Invalid JSON in colors attribute: ${newValue}`);
          this._colors = DEFAULT_COLORS;
        }
        break;
    }
  }
  ```
- **Type coercion rules (mimic WebIDL):**
  - Numbers: parseInt/parseFloat with NaN check, fallback to default
  - Booleans: presence = true, "false" = false, "" = true
  - JSON objects: try/catch with default fallback
  - Enums: whitelist check, fallback to default
- **Avoid infinite loops:**
  - NEVER call setAttribute() in attributeChangedCallback
  - Use internal property flag to prevent re-triggering
- **Validation and defaults:**
  - Every attribute must have documented default value
  - Validate ranges (e.g., max-items must be 1-100)
  - Type guards for enum values
- **Documentation pattern:**
  ```html
  <!-- Document expected types clearly -->
  <strava-geo-table
    max-items="10"          <!-- number (1-100), default: 10 -->
    show-count="true"       <!-- boolean, default: true -->
    sort-by="runs"          <!-- "runs" | "distance", default: "runs" -->
    colors='{"bg":"#fff"}'  <!-- JSON object, default: theme colors -->
  >
  </strava-geo-table>
  ```
- **TypeScript type definitions:**
  - Extend HTMLElementTagNameMap for custom elements
  - Use JSDoc to document attribute types for non-TS users

**Warning signs:**
- Widget behaves differently with attributes vs without
- Console showing NaN, Infinity, or [object Object]
- Type errors: "Cannot read property of undefined"
- Comparisons failing: maxItems > 5 returns false when maxItems="10"
- JSON.parse errors in console
- Attributes not reflecting to properties correctly
- Infinite loops in attributeChangedCallback

**Phase to address:**
Phase 3 (Widget Customization System) - create attribute parsing utilities BEFORE implementing first customizable widget

---

### Pitfall 4: Shadow DOM Table Rendering Performance Collapse

**What goes wrong:**
Rendering large geographic tables (100+ rows) inside Shadow DOM with frequent updates causes browser lockup, 5+ second render times, and unresponsive UI. Shadow DOM's style encapsulation overhead multiplies per-row, and Chart.js integration in same component creates double-rendering bottleneck.

**Why it happens:**
- Shadow DOM creates separate DOM tree for EACH widget instance (no shared rendering)
- Each row requires style computation inside shadow boundary
- Multiple widget instances on same page = multiplicative rendering cost
- Chart.js canvas rendering blocks main thread
- attributeChangedCallback triggering full re-renders on every attribute change
- No virtualization or pagination for long lists
- Constructible stylesheets not used, styles duplicated per instance
- Sorting/filtering re-renders entire table

**How to avoid:**
- **Pagination/limits:**
  - Default to 10-20 items max, require explicit attribute for more
  - Add "Show more" button rather than rendering all upfront
  - max-items="100" should trigger warning, cap at reasonable limit
- **Efficient Shadow DOM patterns:**
  ```typescript
  // Use Constructible Stylesheets (shared across instances)
  const tableStyles = new CSSStyleSheet();
  tableStyles.replaceSync(/* CSS */);
  shadowRoot.adoptedStyleSheets = [tableStyles]; // Shared, not duplicated
  ```
- **Render optimization:**
  - Use DocumentFragment for batch DOM updates
  - Only re-render changed rows, not entire table
  - Debounce attribute changes (don't re-render on every keystroke if editing)
  - requestAnimationFrame for visual updates
- **Virtual scrolling (if >50 rows):**
  - Only render visible rows + buffer
  - Use intersection observer for lazy row rendering
- **Separate concerns:**
  - Don't mix Chart.js canvas and table in same component
  - Use separate <strava-geo-chart> and <strava-geo-table> widgets
- **Light DOM alternative:**
  - If encapsulation not critical, render table in Light DOM
  - Use BEM naming convention for style scoping instead
  - 10x faster rendering for large datasets
- **Performance budgets:**
  - 10 rows: <50ms render
  - 50 rows: <200ms render
  - 100 rows: require pagination or warning
- **Measure first:**
  ```typescript
  const start = performance.now();
  // render logic
  const duration = performance.now() - start;
  if (duration > 200) console.warn(`Slow render: ${duration}ms`);
  ```

**Warning signs:**
- Browser tab freezing during widget initialization
- DevTools Performance showing long tasks >50ms
- Frame drops in scrolling (visible stutter)
- Multiple widget instances compounding slowdown
- Layout thrashing warnings in console
- Lighthouse performance score <80
- Users reporting "page feels slow"
- Fan spinning up on laptops when viewing page

**Phase to address:**
Phase 2 (Geographic Table Widgets) - establish performance budgets and measurement BEFORE building table component

---

### Pitfall 5: Static Site API Key Exposure via Client-Side Geocoding

**What goes wrong:**
Attempting to call reverse geocoding APIs directly from browser widgets exposes API keys in client-side JavaScript bundles. Keys become publicly visible in DevTools Network tab, page source, and minified bundle. Attackers extract keys within hours of deployment, abuse quota, and rack up bills or get service suspended.

**Why it happens:**
- Confusion between build-time (Node.js/CI) and runtime (browser) execution contexts
- Belief that minification/obfuscation hides keys (it doesn't)
- Environment variables compiled into bundle at build time
- CORS requirements forcing API key to be in client code
- Lack of understanding that GitHub Pages = purely static, no server-side processing

**How to avoid:**
- **Build-time geocoding only:**
  - Geocoding happens in Node.js script during GitHub Actions build
  - Results committed to repository as static JSON
  - Widgets consume pre-geocoded data, never call API
- **API key isolation:**
  - Store geocoding API key in GitHub Secrets (never in code)
  - Access via `process.env.GEOCODING_API_KEY` in Node.js scripts only
  - Never import API key in any file bundled by Vite for browser
- **Separation of concerns:**
  ```
  scripts/
    geocode-activities.mjs  ← Node.js script with API key access
    build-widgets.mjs       ← Uses geocoded data (no API key needed)
  src/
    widgets/                ← Browser code (no API key access ever)
  ```
- **Data flow architecture:**
  ```
  1. GitHub Actions runs: npm run geocode (Node.js, has API key)
  2. Generates: data/geocoded-activities.json (no keys, committed)
  3. Build widgets: npm run build-widget (reads JSON, no API calls)
  4. Deploy: static HTML/JS/JSON to GitHub Pages (no keys anywhere)
  ```
- **Verification:**
  - Audit: grep -r "API_KEY\|API_SECRET\|GEOCODING" src/ should return nothing
  - Check bundle: search dist/*.js for sensitive strings
  - DevTools Network tab should show ZERO external API calls from widgets
  - Use GitHub secret scanning to catch accidental commits
- **Alternative approaches (if runtime needed):**
  - Proxy through GitHub Actions (API endpoint that runs geocoding)
  - Serverless function (Netlify/Vercel) as API proxy
  - **NOT viable for GitHub Pages static hosting**

**Warning signs:**
- API key visible in View Source or DevTools
- Network tab showing API calls to geocoding service
- process.env variables appearing in browser console
- API usage dashboard showing requests from unexpected IPs
- GitHub secret scanning alerts
- Rate limit errors from client-side code
- CORS errors trying to call API from browser

**Phase to address:**
Phase 1 (Geographic Data Extraction) - architecture decision BEFORE writing any geocoding code

---

### Pitfall 6: Strava Activity Data Lacking Coordinates

**What goes wrong:**
20-30% of activities (indoor runs, treadmill workouts, GPS failures) have no start_latlng/end_latlng or map.summary_polyline, causing geocoding pipeline to fail silently, produce null values, or crash. Geographic statistics become inaccurate, showing "800 runs in Unknown Location" and undermining widget credibility.

**Why it happens:**
- Treadmill runs explicitly flagged as indoor (no GPS)
- Manual activity entry (typed in, no device)
- Watch/phone battery died mid-activity
- GPS signal never acquired (started run immediately after device power-on)
- Strava privacy settings hiding map data
- Upload from TCX files without GPS data
- Activities from devices without GPS (gym equipment uploads)

**How to avoid:**
- **Activity filtering strategy:**
  ```typescript
  function hasValidGPS(activity: StravaActivity): boolean {
    return !!(
      activity.map?.summary_polyline &&
      activity.start_latlng?.length === 2 &&
      activity.start_latlng[0] !== 0 &&
      activity.start_latlng[1] !== 0
    );
  }
  ```
- **Graceful degradation:**
  - Track total activities vs. geolocated activities separately
  - Display: "Geographic stats based on 1,250 of 1,808 activities (69%)"
  - Don't show "Unknown Location" in top lists unless >50 activities
- **Fallback location inference:**
  - Use activity.timezone to determine country (timezone → country mapping)
  - Use athlete.city from Strava profile as default city
  - Tag as "Inferred location (no GPS)" for transparency
- **Indoor activity handling:**
  - Check activity.trainer, activity.gear_id (treadmill marker)
  - Create separate category: "Indoor (no location)"
  - Option to exclude indoor from geographic stats
- **Data quality metadata:**
  ```json
  {
    "total_activities": 1808,
    "with_gps": 1250,
    "inferred_location": 380,
    "no_location": 178,
    "confidence_threshold": "gps_required"
  }
  ```
- **User communication:**
  - Widget tooltip: "Based on outdoor activities with GPS data"
  - Footnote: "Indoor activities excluded from geographic stats"

**Warning signs:**
- Geographic stats not adding up to total activity count
- Large number of activities in "Unknown" category
- Console errors: "Cannot read property of null (start_latlng)"
- Empty tables/charts when data should exist
- Stats showing lower counts than expected
- TypeScript errors about undefined coordinate properties

**Phase to address:**
Phase 1 (Geographic Data Extraction) - data filtering logic before geocoding pipeline

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Geocode on every build instead of incrementally | Simpler code (no state tracking) | 10-20x API costs, 30min+ builds, quota exhaustion | Never - costs scale linearly |
| Parse attribute strings without validation | Faster implementation | Type bugs, NaN errors, security issues | Never - creates silent failures |
| Use Light DOM instead of Shadow DOM | 10x faster rendering | Host page styles can break widgets | Acceptable if widget used on controlled site only |
| Hardcode widget defaults in code vs config | No config parsing needed | Every change requires rebuild, no user customization | Only for internal dashboards |
| Skip GPS validation, assume all activities have coordinates | Less code complexity | 20-30% of activities fail, garbage statistics | Never - data quality is critical |
| JSON.parse attributes without try/catch | Cleaner code | Unhandled exceptions crash widget | Never - user input is untrusted |
| Render entire table, no pagination | Simpler rendering logic | Browser lockup with 100+ rows | Acceptable if guaranteed <20 rows |
| Store API key in browser widget code | No build-time geocoding needed | Security breach, quota theft, service ban | Never - violates all security principles |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Reverse Geocoding API | Calling from browser widgets (exposes keys) | Build-time Node.js script with GitHub Secrets |
| Strava GPS Data | Assuming all activities have coordinates | Validate start_latlng, check map.summary_polyline, handle nulls |
| Chart.js in Shadow DOM | Importing Chart.js multiple times per widget instance | Import once globally, register once, reuse |
| HTML Attributes | Treating as typed (expecting numbers/booleans) | Parse strings explicitly with validation and defaults |
| Vite IIFE Bundles | Including Node.js-only code (breaks browser) | Separate src/ (browser) from scripts/ (Node.js) |
| GitHub Actions Geocoding | Running on every commit (burns quota) | Run only when new activities added, cache results |
| TypeScript Custom Elements | No type definitions for custom tags | Extend HTMLElementTagNameMap interface |
| Bottleneck Rate Limiting | Forgetting to await throttled calls | Use with async/await, configure reservoir correctly |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Shadow DOM table with 100+ rows | 5+ second render, browser freeze | Pagination (max 20 rows), virtualization if needed | >50 rows without limits |
| Multiple widget instances sharing no styles | Memory usage climbing, slow page load | Constructible Stylesheets (shared CSS) | >5 widgets on same page |
| Re-geocoding same coordinates | 30min builds, API quota exhaustion | Coordinate → location cache JSON | First development iteration |
| Parsing JSON attributes on every attributeChange | Layout thrashing, input lag | Parse once, cache result, debounce changes | Complex JSON attributes |
| Chart.js re-initialization per render | Memory leak, slowing over time | Destroy old chart before creating new | Attribute changes trigger re-render |
| Full table re-render on sort/filter | UI stuttering on interaction | Update DOM incrementally, only changed rows | Tables >30 rows |
| Geocoding all 1,808 activities sequentially at 1 req/sec | 30+ minute builds | Parallel requests (5-10 concurrent) with rate limiter | Any non-trivial dataset |
| No request caching across builds | Repeated API costs | Store geocode results in committed JSON | Multiple builds during development |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| API key in browser bundle | Quota theft, service ban, financial loss | Build-time geocoding only, keys in GitHub Secrets |
| Geocoding API key in .env committed to repo | Public exposure within minutes of push | Add .env to .gitignore, use .env.example template |
| CORS-enabled geocoding from client | Key exposure in Network tab | Proxy through serverless function OR build-time only |
| No rate limiting on API calls | Accidental DDoS, quota burn, IP ban | Bottleneck library with 1-2 req/sec limit |
| Trusting user-provided attribute values | XSS via JSON attributes, injection | Sanitize and validate all attribute strings |
| Displaying exact GPS coordinates in widgets | Privacy violations, Strava ToS breach | Use city-level aggregation only, never show precise coords |
| API keys in source control history | Keys compromised even after removal | Immediately rotate exposed keys, use git-secrets pre-commit |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No feedback during 30min geocoding build | User thinks CI is broken, cancels build | Log progress: "Geocoded 500/1808 activities..." |
| "Unknown Location" as top city in stats | Looks broken, unprofessional | Filter out or show as footnote, not top result |
| Widget shows 0 activities when GPS data missing | Confusion - "where's my data?" | Display message: "No GPS data available for indoor activities" |
| No indication of data freshness in widgets | User doesn't know if data is current | Timestamp: "Last updated: 2 hours ago" |
| Attribute changes not reflecting visually | User edits HTML, nothing happens | Console warn invalid values, show current config in DevTools |
| Geographic stats don't match Strava totals | Trust issues, debugging requests | Explain: "Based on X of Y activities with GPS data" |
| Table showing 500 rows causing browser freeze | User can't interact, leaves page | Hard limit 20-50 rows, pagination for more |
| Error states showing stack traces to users | Technical jargon confuses non-developers | User-friendly: "Could not load geographic data. Please try again later." |

---

## "Looks Done But Isn't" Checklist

- [ ] **Geographic Data:** Validated GPS coordinates exist before geocoding — verify not just truthy but actual lat/lng values
- [ ] **Geocoding Cache:** Stored results committed to repo — verify JSON file exists and contains expected location data
- [ ] **Incremental Processing:** Only geocodes new activities — verify script checks existing data, doesn't re-process
- [ ] **Rate Limiting:** Bottleneck configured and awaited — verify requests throttled to 1-2/sec, not parallel flood
- [ ] **API Key Security:** Never in browser bundle — verify grep -r "API_KEY" src/ returns nothing
- [ ] **Widget Attributes:** Type parsing with validation — verify parseInt/parseFloat with NaN checks, not direct assignment
- [ ] **Shadow DOM Styles:** Using Constructible Stylesheets — verify adoptedStyleSheets used, not <style> duplication
- [ ] **Performance Budget:** Table renders <200ms for 50 rows — verify with performance.measure() in dev
- [ ] **Error Handling:** Graceful degradation for missing GPS — verify "Unknown Location" not majority of results
- [ ] **Data Quality Metadata:** Tracking geocoding success rate — verify stats show X of Y activities geocoded
- [ ] **Indoor Activity Handling:** Filtered or categorized separately — verify not counted as geocoding failures
- [ ] **Build-time Geocoding:** Runs in Node.js, not browser — verify script in scripts/, not src/
- [ ] **Attribute Defaults:** Every attribute documented with default — verify README shows all attributes and fallback values
- [ ] **Type Definitions:** Custom elements in HTMLElementTagNameMap — verify TypeScript autocomplete works

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Exposed API key in committed code | MEDIUM | 1. Rotate key immediately 2. Rewrite git history (filter-branch) 3. Enable GitHub secret scanning 4. Add pre-commit hook |
| Burned through geocoding quota | LOW-MEDIUM | 1. Wait for quota reset 2. Switch to free-tier provider (Nominatim) 3. Use cached results 4. Implement incremental processing |
| 500+ activities with garbage locations | LOW | 1. Clear geocoding cache 2. Improve coordinate selection (use midpoint) 3. Add validation 4. Re-run batch geocoding |
| Widget renders breaking host page styles | HIGH | 1. Switch to Shadow DOM (breaking change) 2. Namespace all CSS classes 3. Use :host selectors 4. Document migration guide |
| Performance issues with 100+ row tables | LOW | 1. Add pagination (non-breaking) 2. Set max-items default to 20 3. Add virtual scrolling 4. Document performance notes |
| Attribute type coercion bugs in production | MEDIUM | 1. Add validation/parsing utilities 2. Update all widgets 3. Add warning logs for invalid values 4. Document type expectations |
| No GPS data for 30% of activities | LOW | 1. Add location inference fallback 2. Use timezone → country mapping 3. Display data quality metadata 4. Filter indoor activities |
| CI builds taking 45+ minutes | LOW | 1. Implement incremental geocoding 2. Add activity hash to detect changes 3. Parallel API requests (10 concurrent) 4. Cache aggressively |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Reverse Geocoding API Cost Explosion | Phase 1: Geographic Data Extraction | API usage dashboard shows <2,000 total requests, incremental script runs <5min |
| GPS Coordinate Quality Issues | Phase 1: Geographic Data Extraction | Geocoding success rate >70%, validation rejects invalid coords |
| HTML Attribute Type Safety Collapse | Phase 3: Widget Customization | All attributes parse with validation, test suite covers invalid values |
| Shadow DOM Table Rendering Performance | Phase 2: Geographic Table Widgets | 50 rows render <200ms, Lighthouse performance >90 |
| Static Site API Key Exposure | Phase 1: Geographic Data Extraction | grep -r "API" src/ returns zero keys, bundle audit clean |
| Strava Activity Data Lacking Coordinates | Phase 1: Geographic Data Extraction | Unknown Location <5% of results, metadata shows filtered count |
| No Request Caching Across Builds | Phase 1: Geographic Data Extraction | Second build uses cache, completes in <2min vs 30min |
| Attribute Parsing Infinite Loops | Phase 3: Widget Customization | No setAttribute in attributeChangedCallback, property flags used |
| Chart.js Integration Memory Leaks | Phase 2: Geographic Table Widgets | chart.destroy() called before re-render, heap stable over time |
| TypeScript Type Definition Missing | Phase 3: Widget Customization | HTMLElementTagNameMap extended, autocomplete works in VSCode |

---

## Sources

### Reverse Geocoding & APIs
- [Google Maps Geocoding API Usage and Billing](https://developers.google.com/maps/documentation/geocoding/usage-and-billing) - Rate limits (3,000 QPM), pricing ($5/1K), quota management
- [Guide To Geocoding API Pricing - February 13, 2026](https://mapscaping.com/guide-to-geocoding-api-pricing/) - Comparison of provider costs and free tiers
- [Optimizing Quota Usage When Geocoding](https://developers.google.com/maps/documentation/geocoding/geocoding-strategies) - Best practices for batch processing and caching
- [OpenCage Geocoding API Documentation](https://opencagedata.com/api) - Rate limiting approaches and soft limits
- [Batch Geocoding - Bulk Convert Addresses](https://www.geoapify.com/solutions/batch-geocoding-requests/) - Efficient batch processing strategies
- [Reverse Geocoding API: Complete Developer Guide](https://scrap.io/reverse-geocoding-api-comparison-save-costs) - Cost comparison and optimization

### Strava GPS Data Quality
- [Bad GPS Data – Strava Support](https://support.strava.com/hc/en-us/articles/216917707-Bad-GPS-Data) - Official documentation on GPS issues
- [Why is GPS data sometimes inaccurate?](https://support.strava.com/hc/en-us/articles/216917917-Why-is-GPS-data-sometimes-inaccurate) - Common accuracy problems
- [Strava Activities Project - Data Preparation](https://leavittmapping.com/projectpages/stravamapserverside) - Real-world GPS data processing challenges
- [GPS Coordinates Precision and Accuracy](https://www.smarty.com/docs/geocoding-accuracy) - Understanding decimal precision and accuracy types
- [What You Need to Know About the 2026 GPS Shift](https://www.precisionfarmingdealer.com/articles/6763-what-you-need-to-know-about-the-2026-gps-shift) - NAD 83 vs NATRF2022 datum changes

### Web Components & Type Safety
- [A Complete Introduction to Web Components in 2026](https://kinsta.com/blog/web-components/) - Modern best practices including TypeScript integration
- [Using Attributes and Properties in Custom Elements](https://ultimatecourses.com/blog/using-attributes-and-properties-in-custom-elements) - Attribute reflection patterns
- [Attributes and Properties: Open Web Components](https://open-wc.org/guides/knowledge/attributes-and-properties/) - Type coercion and validation strategies
- [The Flaws Of Web Components](https://www.thinktecture.com/en/web-components/web-components-flaws/) - Common pitfalls including infinite loops
- [Making Web Component Properties Behave Closer to Platform](https://blog.ltgt.net/web-component-properties/) - Reflection behaviors and best practices
- [How to Use Web Components with TypeScript](https://blog.pixelfreestudio.com/how-to-use-web-components-with-typescript/) - Type definitions and strict mode

### Shadow DOM Performance
- [Optimizing Rendering Performance in Web Components](https://medium.com/@sudheer.gowrigari/optimizing-rendering-performance-in-web-components-a-comprehensive-guide-a507ba4afe19) - Performance optimization techniques
- [Does Shadow DOM Improve Style Performance?](https://nolanlawson.com/2021/08/15/does-shadow-dom-improve-style-performance/) - Performance analysis and benchmarks
- [Pros and Cons of Shadow DOM](https://www.matuzo.at/blog/2023/pros-and-cons-of-shadow-dom/) - Trade-offs and when to use Light DOM
- [The Impact of Web Components on Web Performance](https://blog.pixelfreestudio.com/the-impact-of-web-components-on-web-performance/) - DOM complexity and rendering costs

### Static Site Security
- [Hiding API Keys on GitHub Pages](https://github.com/orgs/community/discussions/57070) - Fundamental limitations of static sites
- [The Rising Risk of Exposed ChatGPT API Keys](https://cyble.com/blog/when-ai-secrets-go-public-chatgpt/) - Real-world 2026 exposure incidents
- [8000+ ChatGPT API Keys Left Exposed Across GitHub](https://thecyberexpress.com/exposed-chatgpt-api-keys-github-websites/) - Scale of client-side key exposure problem
- [Securing API Credentials When Deploying to GitHub Pages](https://community.latenode.com/t/securing-api-credentials-when-deploying-to-github-pages/14194) - Static site security patterns

### Build Tools & Integration
- [Bundling Web Components with Vite](https://docs.mia-platform.eu/docs/products/microfrontend-composer/external-components/bundling) - IIFE bundle configuration
- [Vite and React-to-Web-Component](https://www.bitovi.com/blog/react-everywhere-with-vite-and-react-to-webcomponent) - Multi-entry build considerations
- [Building Embeddable React Widgets](https://makerkit.dev/blog/tutorials/embeddable-widgets-react) - Shadow DOM and CORS patterns
- [GitHub Actions Rate Limiting](https://www.cazzulino.com/github-actions-rate-limiting.html) - CI rate limit management
- [Managing Rate Limits for GitHub API](https://www.lunar.dev/post/a-developers-guide-managing-rate-limits-for-the-github-api) - Best practices for automated workflows

### TypeScript & Type Definitions
- [Defining a Component – Lit](https://lit.dev/docs/components/defining/) - HTMLElementTagNameMap pattern
- [Custom Element Types Generator](https://github.com/blueprintui/custom-element-types) - Automated type definition generation
- [How to Add Custom HTML Tags in TSX: 2026](https://copyprogramming.com/howto/how-to-add-custom-html-tag-tsx) - Module augmentation for custom elements

### Offline Geocoding & Alternatives
- [offline-geocoder - Node Library](https://github.com/lucaspiller/offline-geocoder) - Build-time geocoding without API calls
- [reverse-geocoder - Python Library](https://github.com/thampiman/reverse-geocoder) - K-D tree spatial indexing for offline use
- [Nominatim](https://nominatim.org/) - OpenStreetMap-based free geocoding alternative

---

*Pitfalls research for: Strava Analytics v1.1 - Geographic Data & Widget Customization*
*Researched: 2026-02-14*
*Focus: Integration pitfalls when adding geographic extraction, statistics, table widgets, and HTML attribute customization to existing TypeScript/Vite/Chart.js platform on GitHub Pages*
