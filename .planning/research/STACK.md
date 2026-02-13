# Technology Stack Research

**Project:** Strava Analytics & Visualization Platform
**Research Date:** 2026-02-13
**Researcher:** Claude (GSD Project Researcher)
**Stack Dimension:** Full stack for Strava data pipeline and embeddable widgets

---

## Executive Summary

This stack supports a **static-first, build-time data pipeline** that fetches Strava data via GitHub Actions, computes analytics in TypeScript/Node.js, and outputs embeddable JavaScript widgets for a Jekyll+Astro static site on GitHub Pages.

**Key Constraints:**
- GitHub Pages = static hosting only (no server-side rendering)
- Strava API rate limits: 100 req/15min, 1000/day
- OAuth token refresh required
- Separate repo from website (bacilo.github.io)
- Daily rebuild acceptable, live data ideal within rate limits

**Architecture Pattern:** JAMstack + Build-time Data Fetching + Client-side Widget Rendering

---

## Core Stack Recommendations

### 1. Runtime & Language

**TypeScript 5.3+ with Node.js 20 LTS**

**Rationale:**
- **TypeScript 5.3+**: Type safety for Strava API responses, reduces runtime errors, excellent IDE support
- **Node.js 20 LTS**: Active LTS until April 2026, stable for GitHub Actions, native fetch API, improved performance
- **Why NOT Deno/Bun**: Less mature GitHub Actions support, smaller ecosystem for data processing libraries

**Confidence:** ✅ HIGH (industry standard for this use case)

---

### 2. Data Fetching & API Client

**Option A: Custom fetch wrapper (RECOMMENDED)**

```typescript
// Using native Node.js fetch (v20+)
import { fetch } from 'node:fetch';
```

**Dependencies:**
- None (native Node.js 20+)

**Rationale:**
- Strava API is straightforward REST
- Native fetch reduces dependencies
- Full control over rate limiting, retries, OAuth flow
- No library updates to track

**Confidence:** ✅ HIGH

**Option B: Axios 1.6+**

**Only if:**
- Need request/response interceptors for complex logging
- Team prefers proven HTTP client

**Why NOT other libraries:**
- `strava-v3` npm package: Outdated, last updated 2019
- `node-fetch`: Redundant on Node.js 20+

---

### 3. OAuth & Token Management

**GitHub Secrets + GitHub Actions Environment Secrets**

**Setup:**
```yaml
# .github/workflows/fetch-strava-data.yml
env:
  STRAVA_CLIENT_ID: ${{ secrets.STRAVA_CLIENT_ID }}
  STRAVA_CLIENT_SECRET: ${{ secrets.STRAVA_CLIENT_SECRET }}
  STRAVA_REFRESH_TOKEN: ${{ secrets.STRAVA_REFRESH_TOKEN }}
```

**Token Refresh Strategy:**
- Store refresh token in GitHub Secrets
- First step of workflow refreshes access token
- Access token used for all API calls in that run
- Update refresh token if Strava returns a new one (rare)

**Rationale:**
- No external secrets management needed
- GitHub Secrets encrypted at rest
- No risk of committing tokens
- Simple for single-user personal project

**Confidence:** ✅ HIGH

**Why NOT:**
- **Vault/AWS Secrets Manager**: Overkill for personal project, adds cost
- **Environment variables in repo**: Security risk

---

### 4. Rate Limiting & Caching

**bottleneck ^2.19.5** (Rate limiting)

```bash
npm install bottleneck@^2.19.5
```

**Why:**
- Mature library (active development)
- Handles Strava's 15-minute sliding window (100 req/15min)
- Reservoir pattern fits Strava's rate limit model
- Prevents 429 errors

**Caching Strategy:**
```
- Cache athlete data (rarely changes): 7 days
- Cache activity details: Until new activity detected
- Cache activity list: 1 day
- Store in: Git-committed JSON files (`.data/cache/`)
```

**Rationale:**
- 1000 req/day limit is tight for historical data
- Incremental fetches: Only new activities after last sync
- Committed cache = faster rebuilds, audit trail
- No external cache service needed

**Confidence:** ✅ HIGH (bottleneck), ⚠️ MEDIUM (git-based cache strategy)

**Alternative:** Consider `p-queue` if bottleneck becomes unmaintained

---

### 5. Data Processing & Analytics

**Core JavaScript/TypeScript (RECOMMENDED)**

**For complex stats:**
- **date-fns ^3.3.0**: Date math, streaks, weekly aggregations
  - Why: Tree-shakeable, TypeScript-first, better than Moment.js (deprecated)
- **lodash-es ^4.17.21**: Grouping, sorting, aggregations
  - Why: Proven, tree-shakeable ES module version

**Why NOT:**
- **Pandas (Python)**: Adds Python runtime to Node.js workflow, context switching
- **Apache Arrow**: Overkill for <10k activities
- **DuckDB**: Unnecessary for in-memory analytics at this scale

**Confidence:** ✅ HIGH

---

### 6. Data Storage

**Static JSON files in Git**

**Structure:**
```
.data/
  activities/
    2024.json          # Activities by year
    2025.json
  stats/
    aggregated.json    # Pre-computed stats
    streaks.json
  cache/
    athlete.json
```

**Rationale:**
- GitHub Pages serves static files
- Widgets fetch JSON via CDN (fast, cacheable)
- Git history = audit trail
- No database needed for <10k activities
- JSON.parse is fast enough for this scale

**Why NOT:**
- **SQLite**: Can't query from browser on static site
- **IndexedDB**: Client-side only, can't pre-compute stats
- **External DB (Firebase/Supabase)**: Adds cost, complexity, latency

**Confidence:** ✅ HIGH for <10k activities, ⚠️ MEDIUM for 10k+ (revisit if performance degrades)

---

### 7. Visualization Libraries

**Observable Plot ^0.6.14** (PRIMARY - RECOMMENDED)

```bash
npm install @observablehq/plot@^0.6.14
```

**Why:**
- Modern D3-based grammar of graphics
- Concise syntax for common charts (time series, bar, area)
- Responsive by default
- Smaller bundle than raw D3
- Great for fitness data (aggregation helpers)

**Use cases:**
- Weekly mileage bar charts
- Pace trends (line charts)
- Activity heatmaps (calendar view)

**Confidence:** ✅ HIGH

---

**Chart.js ^4.4.0** (SECONDARY - for specific chart types)

```bash
npm install chart.js@^4.4.0
```

**Why:**
- Only if Observable Plot can't handle a chart type
- Better for: Doughnut charts (activity type breakdown), radar charts (performance metrics)
- Tree-shakeable in v4

**Confidence:** ⚠️ MEDIUM (use sparingly, prefer Observable Plot)

---

**Leaflet ^1.9.4** (MAPS)

```bash
npm install leaflet@^1.9.4
```

**Why:**
- Industry standard for web maps
- Strava polylines decode to lat/lng for route display
- Plugin ecosystem (heatmaps, animations)
- Lighter than Mapbox GL JS for basic maps

**Tile provider:** OpenStreetMap (free) or Mapbox (better styling, needs API key)

**Confidence:** ✅ HIGH

**Future:** Consider Mapbox GL JS for 3D terrain, animations

---

**Why NOT:**
- **D3.js directly**: Steeper learning curve, Observable Plot is D3 under the hood
- **Recharts/Victory**: React-specific, unnecessary for vanilla widgets
- **ApexCharts**: Heavier, less flexible than Observable Plot

---

### 8. Widget Build System

**Vite ^5.1.0 + TypeScript**

```bash
npm install -D vite@^5.1.0 typescript@^5.3.3
```

**Build target:** Embeddable UMD/IIFE bundles

**Why:**
- Fast dev server with HMR
- Tree-shaking for smaller bundles
- Built-in TypeScript support
- Library mode for widgets (`vite.config.ts`)

**Output:**
```
dist/
  strava-widget.js        # Single-file widget
  strava-widget.css
```

**Embed in Jekyll/Astro:**
```html
<div id="strava-stats"></div>
<script src="https://bacilo.github.io/strava-analytics/dist/strava-widget.js"></script>
<script>
  StravaWidget.init('#strava-stats', {
    dataUrl: 'https://bacilo.github.io/strava-analytics/.data/stats/aggregated.json'
  });
</script>
```

**Confidence:** ✅ HIGH

**Why NOT:**
- **Webpack**: Slower, more config than Vite
- **Rollup directly**: Vite provides better DX on top of Rollup
- **esbuild alone**: Less mature plugin ecosystem

---

### 9. Polyline Decoding

**@mapbox/polyline ^1.2.1**

```bash
npm install @mapbox/polyline@^1.2.1
```

**Why:**
- Strava returns routes as encoded polylines
- Official Mapbox library (well-maintained)
- Decodes to lat/lng arrays for Leaflet

**Confidence:** ✅ HIGH

---

### 10. CI/CD Pipeline

**GitHub Actions**

**Workflow:**
```yaml
name: Fetch Strava Data

on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM UTC
  workflow_dispatch:      # Manual trigger

jobs:
  fetch-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run fetch-strava  # Fetch + process data
      - run: npm run build         # Build widgets
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .data/ dist/
          git diff --quiet && git diff --staged --quiet || \
            git commit -m "chore: update Strava data [skip ci]"
          git push
```

**Why:**
- Free for public repos
- Secrets management built-in
- Cron scheduling for daily fetches
- Direct integration with GitHub Pages

**Confidence:** ✅ HIGH

**Why NOT:**
- **Vercel/Netlify**: Unnecessary for static hosting (GitHub Pages is free)
- **Cloud Functions/Lambda**: Would require separate trigger, more complex

---

### 11. Testing

**Vitest ^1.2.0** (Unit tests)

```bash
npm install -D vitest@^1.2.0
```

**Why:**
- Vite-native (shares config)
- Fast (parallelized, ESM-first)
- Jest-compatible API
- Great TypeScript support

**Test coverage:**
- Strava API response parsing
- Stat computation logic (streaks, aggregations)
- Rate limiting behavior
- Polyline decoding

**Confidence:** ✅ HIGH

**Why NOT:**
- **Jest**: Slower ESM support, more config with Vite
- **Playwright/Cypress**: E2E overkill for widget library (consider later for visual regression)

---

### 12. Linting & Formatting

**ESLint ^8.56.0 + Prettier ^3.2.0**

**Config:**
- `@typescript-eslint/eslint-plugin` ^6.19.0
- `eslint-config-prettier` ^9.1.0

**Why:**
- Industry standard
- TypeScript-aware linting
- Auto-fix on save

**Confidence:** ✅ HIGH

---

## Anti-Patterns to Avoid

### ❌ Server-Side Rendering (SSR)
**Why avoid:** GitHub Pages doesn't support Node.js runtime. Jekyll/Astro can do SSG, but data fetching must happen in build pipeline, not request-time.

### ❌ Real-time WebSockets
**Why avoid:** Static hosting = no persistent connections. Rate limits make polling impractical. Stick to daily batch updates.

### ❌ Client-side OAuth flow
**Why avoid:** Exposes client secret. OAuth must happen server-side (GitHub Actions) with secrets.

### ❌ Bundling all activities into widgets
**Why avoid:** Large JSON payloads. Widgets should fetch pre-aggregated stats, not raw activities.

### ❌ Using deprecated libraries
- **Moment.js**: Use `date-fns` or `Temporal` (when stable)
- **Request**: Deprecated, use `fetch`

---

## Dependency Summary

### Production Dependencies
```json
{
  "dependencies": {
    "@mapbox/polyline": "^1.2.1",
    "@observablehq/plot": "^0.6.14",
    "bottleneck": "^2.19.5",
    "date-fns": "^3.3.0",
    "leaflet": "^1.9.4",
    "lodash-es": "^4.17.21"
  }
}
```

### Development Dependencies
```json
{
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "eslint": "^8.56.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.2.0",
    "typescript": "^5.3.3",
    "vite": "^5.1.0",
    "vitest": "^1.2.0"
  }
}
```

**Total production bundle size estimate:** ~150-200 KB (gzipped) for full widget with charts + map

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions (Daily Cron)                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Refresh OAuth token (fetch API)                   │  │
│  │ 2. Fetch new activities (bottleneck rate limiting)   │  │
│  │ 3. Decode polylines (@mapbox/polyline)               │  │
│  │ 4. Compute stats (date-fns, lodash-es)               │  │
│  │ 5. Write to .data/*.json                             │  │
│  │ 6. Build widgets (Vite)                              │  │
│  │ 7. Commit & push to repo                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Git Repository (this repo)                                 │
│  .data/                 ← Static JSON files                 │
│  dist/                  ← Built widget bundles              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  GitHub Pages (CDN)                                         │
│  Serves: .data/*.json + dist/strava-widget.js               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  bacilo.github.io (Jekyll/Astro site)                       │
│  <script src="...strava-widget.js"></script>                │
│  Widget fetches JSON, renders charts (Observable Plot)      │
└─────────────────────────────────────────────────────────────┘
```

---

## Migration Path & Future Considerations

### Near-term (MVP)
- ✅ All recommendations above

### Mid-term (6-12 months)
- **Incremental Static Regeneration (ISR)**: If activity volume grows, consider moving to Astro with ISR for on-demand rebuilds
- **Geospatial clustering**: If route maps get complex, consider `@turf/turf` for geographic analysis
- **Animation**: `framer-motion` for route animations, street view integration

### Long-term (1+ years)
- **Temporal API**: Replace `date-fns` when Temporal reaches Stage 4 (better timezone handling)
- **Web Components**: Refactor widgets to Web Components for framework-agnostic embeds
- **Astro Content Collections**: If migrating site to Astro, use content collections for activity data

---

## Version Verification Notes

**Confidence Levels:**
- ✅ **HIGH**: Verified standard in 2025, unlikely to change
- ⚠️ **MEDIUM**: Good choice but alternatives exist, revisit in 6 months
- 🔴 **LOW**: Speculative, needs validation

**Note on version currency:** Versions listed reflect stable releases as of January 2025. For production use:
1. Check npm for latest stable versions
2. Review changelogs for breaking changes
3. Pin exact versions in package.json
4. Use Renovate/Dependabot for automated updates

---

## Questions for Clarification

1. **Activity volume**: How many years of Strava history? (affects caching strategy)
2. **Widget types**: Priority order for MVP? (e.g., weekly stats > maps > animations)
3. **Branding**: Custom design system or default chart styling?
4. **Privacy**: Any activities to filter out (e.g., routes near home)?

---

## References & Further Reading

- [Strava API v3 Documentation](https://developers.strava.com/docs/reference/)
- [GitHub Actions for Node.js](https://docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-nodejs)
- [Observable Plot Documentation](https://observablehq.com/plot/)
- [Vite Library Mode](https://vitejs.dev/guide/build.html#library-mode)
- [GitHub Pages Custom Domain Setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

---

**Research completed:** 2026-02-13
**Next step:** Review with stakeholder, create initial roadmap from this stack
