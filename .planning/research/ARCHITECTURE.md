# Architecture Research: Strava Analytics Platform

**Research Date:** 2026-02-13
**Dimension:** Architecture
**Milestone:** Greenfield - System Structure & Components

## Research Question

How are Strava analytics platforms typically structured? What are the major components for a system that fetches data, processes statistics, and serves embeddable widgets to a static site?

## Executive Summary

Strava analytics platforms typically follow a **3-tier architecture** with clear separation between data acquisition, processing, and presentation layers. Given the constraints (API rate limits: 100/15min, 1000/day; single user; static site embedding), the optimal structure is:

1. **Data Layer**: OAuth + API client with caching and rate limit management
2. **Processing Layer**: Statistics computation engine with aggregations, streaks, and geographic analysis
3. **Output Layer**: Static JSON/HTML widget generator for embedding

The architecture must balance between daily rebuild simplicity and live data freshness while respecting API constraints.

## Core Components

### 1. Authentication & Authorization Component

**Purpose:** Manage Strava OAuth flow and token lifecycle

**Responsibilities:**
- OAuth 2.0 authorization code flow
- Token storage (access + refresh tokens)
- Automatic token refresh before expiration
- Secure credential management

**Key Considerations:**
- Strava tokens expire after 6 hours
- Refresh tokens are long-lived but must be persisted
- For personal use, can use OAuth once and persist tokens
- Need webhook endpoint if supporting token revocation

**Data Flow:**
- **Input:** User authorization grant
- **Output:** Valid access token for API calls
- **Storage:** Encrypted token store (file, env vars, or secrets manager)

### 2. Data Fetching Component

**Purpose:** Retrieve data from Strava API with rate limit respect

**Responsibilities:**
- Fetch activities (paginated)
- Fetch athlete profile
- Fetch detailed activity streams (GPS, heart rate, power, etc.)
- Rate limit tracking and backoff
- Request retry logic with exponential backoff
- Incremental data sync (only new activities)

**Key Considerations:**
- API limits: 100 requests/15min, 1000/day
- Activities endpoint returns 30 per page
- Streams (GPS data) are separate API calls per activity
- Support both full sync (initial) and incremental sync (updates)
- Implement caching to avoid redundant API calls

**Data Flow:**
- **Input:** Valid access token, sync parameters (date range, activity IDs)
- **Output:** Raw activity data (JSON)
- **Storage:** Raw data cache (filesystem or database)

**Rate Limit Strategy:**
- Track remaining quota in-memory or persistence
- Queue requests when approaching limits
- Schedule intensive operations (full sync) during low-usage periods
- For single user: ~1000 activities = 34 API calls (pagination) + activity details

### 3. Data Storage Component

**Purpose:** Persist raw and processed data efficiently

**Responsibilities:**
- Store raw API responses (activities, streams, athlete data)
- Store processed statistics and aggregations
- Support incremental updates
- Enable fast queries for widget generation

**Architecture Options:**

**Option A: File-based Storage** (Simplest for personal use)
- Raw data: `data/raw/activities/{activity_id}.json`
- Streams: `data/raw/streams/{activity_id}.json`
- Processed: `data/processed/stats.json`, `data/processed/summaries/{year}.json`
- Widgets: `data/widgets/{widget_name}.json` or `.html`

**Option B: SQLite Database** (Better for complex queries)
- Tables: `activities`, `activity_streams`, `computed_stats`, `athlete`
- Enables SQL aggregations and filtering
- Single file, portable, no server required
- Good for geographic queries and time-series analysis

**Option C: Hybrid Approach** (Recommended)
- Raw data in files (immutable, backup-friendly)
- SQLite for processed data and queries
- Widget outputs as static files

**Data Flow:**
- **Input:** Raw API responses, processed statistics
- **Output:** Queryable data for processing and widget generation
- **Patterns:** Write-once for raw data, read-heavy for processed data

### 4. Statistics Processing Component

**Purpose:** Compute aggregations, streaks, and custom metrics

**Responsibilities:**
- Aggregate by time period (weekly, monthly, yearly, all-time)
- Compute running totals (distance, elevation, time)
- Calculate streaks (current, longest)
- Geographic analysis (routes, heatmaps, location clustering)
- Activity type breakdowns (run, ride, swim)
- Personal records and achievements
- Trend analysis (pace progression, fitness improvements)

**Processing Patterns:**

**Batch Processing** (Daily rebuild)
- Process all activities once per day
- Generate complete statistics set
- Simple, predictable, resource-efficient
- Works well with API rate limits

**Incremental Processing** (Near real-time)
- Fetch only new activities since last sync
- Update running totals and streaks
- Recompute affected aggregations
- More complex but fresher data

**Key Computations:**
- **Aggregations:** SUM(distance), AVG(pace), MAX(elevation), COUNT(activities)
- **Streaks:** Consecutive days with activities
- **Geographic:** Bounding boxes, unique locations, route clustering
- **Time-series:** Weekly/monthly trends, year-over-year comparisons
- **Pace zones:** Distribution of pace across activities
- **Equipment:** Stats per bike/shoe (if tracking)

**Data Flow:**
- **Input:** Raw activity data from storage
- **Output:** Computed statistics (JSON or database records)
- **Dependencies:** Requires complete historical data for accurate totals

### 5. Widget Generation Component

**Purpose:** Create embeddable HTML/JS/JSON widgets for static site

**Responsibilities:**
- Generate static HTML widgets with inline CSS
- Create JSON data files for JavaScript consumption
- Support multiple widget types (stats cards, charts, maps)
- Optimize for static site embedding (no server required)
- Handle responsive design

**Widget Types:**

**Type 1: Static HTML Cards**
- Pre-rendered HTML with statistics
- Inline CSS for styling
- No JavaScript required
- Example: Total distance, activity count, current streak

**Type 2: JSON + Client-side Rendering**
- Export data as JSON
- Consumed by JavaScript in static site
- Enables charts (Chart.js, D3.js) and interactive visualizations
- Example: Monthly distance chart, pace distribution

**Type 3: Interactive Maps**
- GeoJSON exports for route visualization
- Integration with Leaflet/Mapbox in static site
- Heatmap generation for activity density
- Example: Year's routes, heatmap overlay

**Type 4: Embeddable Iframes**
- Standalone HTML pages with full widget
- Can be embedded via iframe in static site
- Self-contained with all assets inline
- Example: Activity calendar, achievement gallery

**Output Formats:**
```
widgets/
├── stats-card.html          # Inline HTML widget
├── monthly-distance.json    # Data for chart
├── routes-2026.geojson      # Geographic data
├── activity-calendar.html   # Full interactive widget
└── metadata.json            # Widget catalog
```

**Data Flow:**
- **Input:** Processed statistics, activity data
- **Output:** Static files ready for embedding
- **Integration:** Copy to static site or fetch via URL

### 6. Orchestration Component

**Purpose:** Coordinate data pipeline execution

**Responsibilities:**
- Schedule data fetching (daily, hourly, or on-demand)
- Trigger processing after data updates
- Generate widgets after processing
- Handle errors and retry logic
- Log pipeline execution

**Execution Modes:**

**Mode 1: Scheduled Batch** (Recommended for daily rebuild)
- Cron job or GitHub Actions workflow
- Daily execution (e.g., 2 AM local time)
- Full pipeline: fetch → process → generate widgets
- Commit and push widget outputs to website repo

**Mode 2: Event-driven** (For live data)
- Strava webhook subscription for new activities
- Triggered processing on activity creation
- Incremental update and widget regeneration
- Requires server or serverless function

**Mode 3: Manual Trigger**
- CLI command or API endpoint
- On-demand data sync and processing
- Useful during development and testing

**Pipeline Flow:**
```
1. Authenticate (refresh token if needed)
2. Fetch new/updated activities
3. Store raw data
4. Process statistics
5. Generate widgets
6. Deploy to static site (copy or commit)
7. Log results and update state
```

**Error Handling:**
- Retry failed API calls with exponential backoff
- Continue processing on partial failures
- Log errors for debugging
- Maintain pipeline state for resume capability

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         STRAVA API                          │
│                  (Rate Limited: 100/15min)                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ OAuth + API Calls
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    DATA LAYER                               │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │   Auth       │  │  Data Fetcher   │  │  Rate Limiter │  │
│  │   Manager    │→ │  (Incremental)  │→ │  & Cache      │  │
│  └──────────────┘  └─────────────────┘  └───────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Raw Activity Data (JSON)
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   STORAGE LAYER                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Filesystem: data/raw/activities/{id}.json             │ │
│  │  SQLite: processed.db (stats, aggregations)            │ │
│  │  State: last_sync.json, rate_limits.json               │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Query Data
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                  PROCESSING LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Aggregation  │  │   Streak     │  │   Geographic     │  │
│  │   Engine     │  │  Calculator  │  │   Analyzer       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Computed Statistics
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   OUTPUT LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ HTML Widget  │  │ JSON Data    │  │  GeoJSON Maps    │  │
│  │  Generator   │  │  Exporter    │  │   Generator      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Static Files
                            │
┌───────────────────────────▼─────────────────────────────────┐
│              STATIC SITE INTEGRATION                        │
│  bacilo.github.io (Jekyll + Astro, GitHub Pages)           │
│  - Embed HTML widgets directly                              │
│  - Fetch JSON for client-side charts                        │
│  - Display GeoJSON maps with Leaflet                        │
└─────────────────────────────────────────────────────────────┘

                    ORCHESTRATION
         (Cron/GitHub Actions/Manual CLI)
         ┌────────────────────────────┐
         │ 1. Fetch new activities    │
         │ 2. Process statistics      │
         │ 3. Generate widgets        │
         │ 4. Deploy to static site   │
         └────────────────────────────┘
```

## Data Flow Details

### Primary Data Flow (Daily Rebuild)

```
[Strava API]
    ↓ (1) OAuth authentication
[Auth Manager: Valid access token]
    ↓ (2) Fetch activities since last sync
[Data Fetcher: API requests with rate limiting]
    ↓ (3) Raw JSON responses
[Storage: data/raw/activities/*.json]
    ↓ (4) Read all activities
[Processing: Compute aggregations, streaks, geographic stats]
    ↓ (5) Computed statistics
[Storage: processed.db or data/processed/*.json]
    ↓ (6) Read statistics
[Widget Generator: Create HTML/JSON/GeoJSON]
    ↓ (7) Static widget files
[Output: widgets/*.html, *.json, *.geojson]
    ↓ (8) Deploy (copy or git commit+push)
[Static Site: bacilo.github.io]
```

### Incremental Update Flow (Near Real-time)

```
[Strava Webhook: New activity created]
    ↓ (1) Webhook notification
[Orchestrator: Trigger incremental sync]
    ↓ (2) Fetch specific activity
[Data Fetcher: Single API call]
    ↓ (3) Store new activity
[Storage: Append to data/raw/]
    ↓ (4) Incremental processing
[Processing: Update affected statistics only]
    ↓ (5) Updated statistics
[Widget Generator: Regenerate affected widgets]
    ↓ (6) Deploy updated widgets
[Static Site: Fresh data without full rebuild]
```

## Component Boundaries

### Clear Separation Principles

1. **Authentication is separate from data fetching**
   - Auth component only manages tokens
   - Data fetcher receives valid tokens, never handles auth logic
   - Enables token reuse across multiple data operations

2. **Raw data storage is separate from processed data**
   - Raw data is immutable (never modified after storage)
   - Processed data can be regenerated from raw data
   - Enables reprocessing without re-fetching from API

3. **Processing is separate from output generation**
   - Statistics computation is independent of output format
   - Same processed data can generate multiple widget types
   - Enables adding new widgets without reprocessing

4. **Widget generation is separate from deployment**
   - Widgets are generated as static files
   - Deployment is handled by separate component or manual process
   - Enables testing widgets before deployment

### Interface Contracts

**Auth Manager ↔ Data Fetcher**
- Input: Token request
- Output: Valid access token or error
- Contract: Token is valid for at least next 5 minutes

**Data Fetcher ↔ Storage**
- Input: Raw API response (JSON)
- Output: File path or database ID
- Contract: Data stored exactly as received from API

**Storage ↔ Processing**
- Input: Query parameters (date range, activity types)
- Output: Activity data collection
- Contract: Data is complete and consistent

**Processing ↔ Widget Generator**
- Input: Statistic type request
- Output: Computed statistics (typed data)
- Contract: Statistics are accurate as of processing time

**Widget Generator ↔ Static Site**
- Input: Widget configuration
- Output: Static file (HTML/JSON/GeoJSON)
- Contract: File is self-contained and embeddable

## Suggested Build Order

### Phase 1: Foundation (Data Acquisition)

**Build in this order:**

1. **Auth Manager** (First - required for everything else)
   - Implement OAuth flow
   - Token storage and refresh
   - Test with manual token retrieval
   - **Deliverable:** Can obtain and maintain valid Strava access token

2. **Basic Data Fetcher** (Second - core data pipeline)
   - Fetch activities list (paginated)
   - Basic rate limiting (simple counter)
   - Error handling and retry logic
   - **Deliverable:** Can retrieve all activities for user

3. **File-based Storage** (Third - simplest persistence)
   - Save raw activities as JSON files
   - Track last sync timestamp
   - **Deliverable:** Activities persisted locally

**Why this order:**
- Auth is a hard dependency for all API operations
- Data fetcher needs auth but not storage (can print to console)
- Storage is needed before processing makes sense
- Each component can be tested independently

**Milestone:** Can fetch and store all Strava activities

### Phase 2: Basic Processing & Output

**Build in this order:**

4. **Simple Statistics Processor** (Fourth - basic value delivery)
   - Aggregate totals (distance, time, elevation)
   - Count activities by type
   - All-time statistics
   - **Deliverable:** Basic statistics computed from stored data

5. **Basic Widget Generator** (Fifth - first user-visible output)
   - Generate simple HTML stats card
   - Inline CSS for styling
   - **Deliverable:** Embeddable widget showing totals

6. **Simple Orchestrator** (Sixth - automated pipeline)
   - CLI command to run full pipeline
   - Fetch → Store → Process → Generate
   - **Deliverable:** One command to update all data and widgets

**Why this order:**
- Processing depends on stored data
- Widget generation depends on processed statistics
- Orchestrator ties everything together
- Each step adds user-visible value

**Milestone:** Can generate and embed basic statistics widget

### Phase 3: Advanced Features

**Build in this order:**

7. **Incremental Data Fetching** (Seventh - optimization)
   - Fetch only new activities since last sync
   - Update existing activities if modified
   - **Deliverable:** Faster updates, reduced API usage

8. **Advanced Statistics** (Eighth - richer insights)
   - Streak calculations
   - Time-series aggregations (weekly, monthly)
   - Pace and performance metrics
   - **Deliverable:** More interesting statistics

9. **Multiple Widget Types** (Ninth - variety)
   - JSON export for charts
   - Activity calendar widget
   - Stats comparison widgets
   - **Deliverable:** Rich set of embeddable visualizations

**Why this order:**
- Incremental sync is an optimization, not core functionality
- Advanced stats build on basic aggregation patterns
- Multiple widgets reuse processing infrastructure

**Milestone:** Comprehensive analytics with multiple visualizations

### Phase 4: Geographic & Advanced Visualization

**Build in this order:**

10. **Activity Streams Fetcher** (Tenth - enables geographic features)
    - Fetch GPS data for activities
    - Store coordinate streams
    - **Deliverable:** Complete route data available

11. **Geographic Processor** (Eleventh - spatial analysis)
    - Generate GeoJSON from activity streams
    - Compute heatmaps and route overlays
    - Location clustering and analysis
    - **Deliverable:** Geographic statistics and data

12. **Map Widget Generator** (Twelfth - visual payoff)
    - Generate GeoJSON for Leaflet/Mapbox
    - Create heatmap data
    - Route visualization widgets
    - **Deliverable:** Interactive maps in static site

**Why this order:**
- Geographic features require additional API calls (streams)
- Build after core pipeline is stable to manage rate limits
- Most complex visualizations, benefit from established patterns

**Milestone:** Full-featured analytics with geographic visualizations

### Phase 5: Polish & Automation

**Build in any order:**

13. **Scheduled Automation**
    - GitHub Actions workflow for daily updates
    - Automatic widget deployment to static site
    - **Deliverable:** Hands-free daily updates

14. **Error Handling & Monitoring**
    - Comprehensive logging
    - Error notifications
    - Pipeline health monitoring
    - **Deliverable:** Reliable, observable system

15. **SQLite Migration** (Optional)
    - Migrate from file storage to SQLite for processed data
    - Enables more complex queries
    - **Deliverable:** Faster, more flexible data access

**Why this order:**
- These are enhancements to working system
- Can be built independently in any order
- Each adds operational value

**Milestone:** Production-ready, automated platform

## Technology Recommendations

### Language & Runtime

**Option 1: Python** (Recommended for rapid development)
- Rich ecosystem: `requests`, `pandas`, `geojson`
- Easy OAuth: `stravalib` library available
- Good for data processing and statistics
- Jupyter notebooks for exploration

**Option 2: Node.js/TypeScript**
- Good for async API calls
- Easy JSON processing
- Can share types with static site if using TypeScript
- Rich charting libraries

**Option 3: Go**
- Excellent for CLI tools
- Fast, single binary deployment
- Good concurrency for API calls
- Less rich data processing ecosystem

### Key Dependencies

**For Python Stack:**
- `stravalib` or `requests` + OAuth2 handling
- `pandas` for data aggregation
- `sqlite3` (built-in) for database
- `jinja2` for HTML template rendering
- `geojson` for geographic data

**For Node.js Stack:**
- `strava-v3` or `axios` + OAuth2 library
- `date-fns` for date calculations
- `better-sqlite3` for database
- `handlebars` for HTML templates
- `@tmcw/togeojson` for geographic data

### Storage Options

**Recommended: Hybrid Approach**
- Raw data: JSON files in `data/raw/`
- Processed data: SQLite database `data/processed.db`
- Widget output: Static files in `widgets/`

**Rationale:**
- JSON files are easy to inspect and backup
- SQLite enables efficient queries for processing
- Static files enable static site embedding
- No external dependencies (no database server)

### Deployment Options

**Option 1: GitHub Actions** (Recommended)
- Free for public repos
- Scheduled workflows (cron)
- Can commit widget outputs to website repo
- Secrets management for Strava tokens

**Option 2: Local Cron + Git**
- Run on personal machine
- Scheduled via crontab
- Push to website repo via git
- Simple, full control

**Option 3: Serverless (AWS Lambda, Cloudflare Workers)**
- For webhook-driven updates
- More complex setup
- Good for near real-time updates
- May incur costs

## Constraints & Trade-offs

### API Rate Limits

**Constraints:**
- 100 requests per 15 minutes
- 1000 requests per day

**Implications:**
- Full sync of 500 activities: ~17 API calls (pagination)
- With streams: 500+ API calls (one per activity)
- **Trade-off:** Fetch streams incrementally, not for all activities at once
- **Strategy:** Daily incremental sync fits well within limits

### Static Site Integration

**Constraints:**
- No server-side processing on GitHub Pages
- Must use static files (HTML, JSON, JS)
- Client-side rendering for interactivity

**Implications:**
- Cannot fetch Strava data directly from browser (CORS, token exposure)
- Must pre-generate all data and widgets
- **Trade-off:** Fresh data requires rebuilding, but acceptable for daily cadence
- **Strategy:** Generate JSON for client-side charts, HTML for simple widgets

### Personal Use (Single User)

**Constraints:**
- Only need to support one Strava account
- No multi-tenancy or user management

**Implications:**
- Simpler auth (one-time OAuth, persist tokens)
- No need for database sharding or scaling
- Can optimize for specific activity types and preferences
- **Trade-off:** Not generalizable, but much simpler to build
- **Strategy:** Hardcode or configure personal preferences

### Daily Rebuild vs. Live Data

**Constraints:**
- Daily rebuild is acceptable
- Live data is ideal but not required

**Implications:**
- **Daily Rebuild:** Simpler orchestration, batch processing, fits rate limits
- **Live Data:** Requires webhooks, incremental processing, more complexity
- **Trade-off:** Start with daily rebuild, add live updates later if needed
- **Strategy:** Build incremental sync capability, use daily schedule initially

## Architectural Risks & Mitigations

### Risk 1: API Rate Limit Exhaustion

**Risk:** Exceeding Strava API limits during processing

**Mitigations:**
- Implement rate limit tracking and backoff
- Cache API responses aggressively
- Use incremental sync instead of full sync
- Schedule intensive operations during low-usage periods
- Monitor rate limit headers in API responses

### Risk 2: Token Expiration During Processing

**Risk:** Access token expires mid-pipeline

**Mitigations:**
- Refresh token proactively before expiration
- Handle 401 responses with automatic token refresh
- Persist refresh token securely
- Implement retry logic after token refresh

### Risk 3: Large Dataset Growth

**Risk:** Years of activities become too large to process efficiently

**Mitigations:**
- Use SQLite for indexed queries instead of scanning all files
- Implement incremental processing (only update changed data)
- Archive old raw data, keep processed summaries
- Use pagination and batching for large operations

### Risk 4: Strava API Changes

**Risk:** API schema or rate limits change

**Mitigations:**
- Store raw API responses (enables reprocessing)
- Version API response schemas
- Monitor Strava API announcements
- Implement graceful degradation for missing fields

### Risk 5: Static Site Deployment Failures

**Risk:** Widget generation succeeds but deployment fails

**Mitigations:**
- Separate widget generation from deployment
- Test widgets locally before deployment
- Use atomic deployments (all or nothing)
- Keep previous widget versions for rollback

## Recommendations for This Project

Given the project context (personal use, static site, daily rebuild OK, API limits), here are specific architectural recommendations:

### Recommended Architecture

**3-Tier Hybrid Architecture:**

1. **Data Layer**
   - Python with `stravalib` for API access
   - File-based storage for raw activities
   - SQLite for processed data and queries
   - Daily incremental sync via cron or GitHub Actions

2. **Processing Layer**
   - Python with `pandas` for aggregations
   - Modular processors: aggregation, streaks, geographic
   - Batch processing with incremental capability
   - Outputs to SQLite and JSON files

3. **Output Layer**
   - Jinja2 templates for HTML widgets
   - JSON export for Chart.js visualizations in static site
   - GeoJSON for Leaflet maps
   - Static files committed to website repo

**Orchestration:**
- GitHub Actions daily workflow (2 AM UTC)
- Manual CLI for testing and on-demand updates
- Logs stored in repository for debugging

**Deployment:**
- Widget outputs committed to website repo
- GitHub Pages auto-deploys on commit
- No manual deployment needed

### Directory Structure

```
strava-analytics/
├── auth/
│   ├── oauth.py              # OAuth flow implementation
│   └── token_store.py        # Token persistence
├── fetch/
│   ├── client.py             # Strava API client
│   ├── rate_limiter.py       # Rate limiting logic
│   └── sync.py               # Incremental sync coordinator
├── storage/
│   ├── raw.py                # Raw data file operations
│   ├── database.py           # SQLite operations
│   └── schema.sql            # Database schema
├── processing/
│   ├── aggregation.py        # Totals and summaries
│   ├── streaks.py            # Streak calculations
│   ├── geographic.py         # Geographic analysis
│   └── time_series.py        # Trend analysis
├── widgets/
│   ├── generator.py          # Widget generation coordinator
│   ├── templates/            # Jinja2 templates
│   │   ├── stats_card.html
│   │   └── activity_calendar.html
│   └── exporters/
│       ├── json.py           # JSON data export
│       └── geojson.py        # GeoJSON export
├── orchestration/
│   ├── pipeline.py           # Main pipeline coordinator
│   └── cli.py                # Command-line interface
├── data/
│   ├── raw/                  # Raw API responses (gitignored)
│   │   ├── activities/
│   │   └── streams/
│   ├── processed/            # SQLite database (gitignored)
│   └── state/                # Last sync, rate limits
├── output/
│   └── widgets/              # Generated widgets (committed to website)
├── tests/
├── config/
│   └── settings.yaml         # Configuration
├── .github/
│   └── workflows/
│       └── daily-sync.yml    # GitHub Actions workflow
└── README.md
```

### Build Order for This Project

**Phase 1 (Week 1-2): MVP**
1. Auth manager with OAuth
2. Basic data fetcher (activities only)
3. File storage for raw data
4. Simple aggregation processor
5. HTML stats card widget
6. CLI to run pipeline manually

**Phase 2 (Week 3-4): Automation**
7. Incremental sync capability
8. SQLite for processed data
9. GitHub Actions workflow
10. Automatic deployment to website

**Phase 3 (Week 5-6): Rich Analytics**
11. Streak calculations
12. Time-series statistics
13. Multiple widget types
14. JSON export for charts

**Phase 4 (Week 7-8): Geographic**
15. Activity streams fetcher
16. Geographic processor
17. GeoJSON export
18. Map widgets

## Conclusion

Strava analytics platforms for personal use with static site integration are best structured as 3-tier systems with clear separation between data acquisition, processing, and output generation. The recommended architecture balances simplicity (file-based storage, daily batch processing) with capability (incremental sync, rich analytics, geographic visualizations).

**Key Architectural Principles:**

1. **Separation of Concerns:** Clear boundaries between auth, data, processing, and output
2. **Immutable Raw Data:** Store API responses as-is, enables reprocessing
3. **Incremental Everything:** Sync, processing, and widget generation should support incremental updates
4. **Static-First:** Generate self-contained outputs that work without a server
5. **Rate Limit Respect:** Track and honor API limits at every layer

**Build Order Priority:**

1. Auth → Data → Storage (foundation)
2. Processing → Widgets → Orchestration (value delivery)
3. Advanced stats → Multiple widgets (enrichment)
4. Geographic → Maps (polish)
5. Automation → Monitoring (production readiness)

This architecture supports starting simple (daily batch, basic stats) while enabling future enhancements (live updates, advanced visualizations) without major refactoring.

## References & Further Reading

**Strava API Documentation:**
- Strava API v3 Documentation: https://developers.strava.com/docs/reference/
- OAuth 2.0 Flow: https://developers.strava.com/docs/authentication/
- Rate Limiting: https://developers.strava.com/docs/rate-limits/
- Webhooks: https://developers.strava.com/docs/webhooks/

**Architecture Patterns:**
- ETL Pipeline Design Patterns
- Static Site Generator Integration Patterns
- OAuth Token Management Best Practices
- Rate-Limited API Client Design

**Technology Ecosystems:**
- Python `stravalib`: https://github.com/stravalib/stravalib
- Pandas for Data Processing: https://pandas.pydata.org/
- Jinja2 Templating: https://jinja.palletsprojects.com/
- Leaflet.js for Maps: https://leafletjs.com/

**Similar Projects (for inspiration):**
- Various personal Strava dashboards on GitHub
- Fitness data visualization platforms
- Static site analytics integrations
