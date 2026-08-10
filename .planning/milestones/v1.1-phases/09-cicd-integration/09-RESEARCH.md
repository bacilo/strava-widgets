# Phase 9: CI/CD Integration - Research

**Researched:** 2026-02-15
**Domain:** GitHub Actions CI/CD, geocoding automation, widget deployment
**Confidence:** HIGH

## Summary

Phase 9 integrates geographic data processing into the existing GitHub Actions workflow. The project already has a mature CI/CD pipeline (daily-refresh.yml) that handles Strava sync, stats computation, widget builds, and GitHub Pages deployment. This phase extends that pipeline to include geocoding (compute-geo-stats) and ensures geographic widgets are deployed alongside existing widgets.

The primary technical challenge is error handling: geocoding must be non-blocking so the pipeline continues if offline-geocode-city fails or activities lack GPS data. The existing workflow already uses continue-on-error for Strava API failures, providing a proven pattern to follow. Geographic data files (countries.json, cities.json, geo-metadata.json, location-cache.json) must be committed to git so they persist across workflow runs and deploy to GitHub Pages.

Documentation requirements include: new CLI commands (compute-geo-stats, compute-all-stats), widget HTML attributes for all five widgets (stats-card, comparison-chart, streak-widget, geo-stats-widget, geo-table-widget), and Strava API attribution guidelines per Strava Brand Guidelines and API Agreement.

**Primary recommendation:** Extend existing daily-refresh.yml workflow by adding geocoding step after "Compile TypeScript" with continue-on-error: true, expand git-auto-commit-action file_pattern to include data/geo/*.json, and create comprehensive README.md with widget documentation, CLI reference, and Strava attribution requirements.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stefanzweifel/git-auto-commit-action | v7 | Commit data files from workflow | Already in use, handles git add/commit/push with proper [skip ci] semantics |
| peaceiris/actions-gh-pages | v4 | Deploy widgets to GitHub Pages | Already in use, most popular community action (20k+ stars) |
| actions/checkout | v4 | Clone repository in workflow | Already in use, official GitHub action |
| actions/setup-node | v4 | Configure Node.js with npm caching | Already in use, official action with built-in cache support |
| offline-geocode-city | v1.0.2 | Offline reverse geocoding | Already installed, 217 KB bundle, zero API calls |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| scripts/ci-setup-tokens.mjs | custom | Bootstrap tokens.json for CI | Already implemented, runs before Strava fetch |
| scripts/build-widgets.mjs | custom | Build all widget IIFE bundles | Already implemented, builds all 5 widgets |
| npm ci | - | Install dependencies with locked versions | Standard for CI environments, faster than npm install |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| continue-on-error: true | Manual error handling with if conditions | continue-on-error is simpler and GitHub's recommended pattern for non-blocking steps |
| Extend compute-all-stats | Separate geocoding step | Separate step provides better error isolation and granular failure visibility in workflow UI |
| git-auto-commit-action | Manual git commands in workflow | Manual commands require explicit config, add, commit, push with proper [skip ci] handling - more error-prone |

**Installation:**
```bash
# No new dependencies needed - all libraries already installed
# Workflow changes only require updating .github/workflows/daily-refresh.yml
```

## Architecture Patterns

### Recommended Project Structure
```
.github/
├── workflows/
│   └── daily-refresh.yml       # Extended workflow with geocoding step
data/
├── activities/                  # Fetched from Strava API
├── stats/                       # Computed by compute-stats and compute-advanced-stats
│   ├── all-time-totals.json
│   ├── year-over-year.json
│   ├── streaks.json
│   ├── time-of-day.json
│   └── seasonal-trends.json
├── geo/                         # NEW: Computed by compute-geo-stats
│   ├── countries.json           # Country aggregations
│   ├── cities.json              # City aggregations
│   ├── geo-metadata.json        # Coverage stats
│   └── location-cache.json      # Persistent coordinate cache
└── sync-state.json
dist/
└── widgets/                     # Deployed to GitHub Pages
    ├── index.html               # Widget documentation and embed examples
    ├── test.html                # NEW: Visual test page for all widgets
    ├── *.iife.js                # Widget bundles (5 total)
    └── data/                    # Data files copied for deployment
        ├── stats/
        └── geo/                 # NEW: Geographic data for widgets
README.md                        # NEW: Comprehensive documentation
```

### Pattern 1: Non-Blocking Geocoding Step
**What:** Add geocoding step with continue-on-error so workflow continues if it fails
**When to use:** When step is important but not critical to pipeline success
**Example:**
```yaml
# Source: GitHub Actions continue-on-error best practices
- name: Compute geographic statistics
  id: geocode
  continue-on-error: true  # Don't block pipeline if geocoding fails
  run: npm run compute-geo-stats

- name: Warn on geocoding failure
  if: steps.geocode.outcome == 'failure'
  run: echo "::warning::Geocoding failed, widgets will use cached geo data"
```

**Key insight:** Use `steps.<id>.outcome` to detect actual failures (not `failure()` function which checks `conclusion`). When continue-on-error: true, the step's `conclusion` is success even if it failed, but `outcome` reflects the actual result.

### Pattern 2: Commit Generated Data Files
**What:** Use git-auto-commit-action to commit both stats and geo data files after computation
**When to use:** When workflow generates files that must persist across runs
**Example:**
```yaml
# Source: stefanzweifel/git-auto-commit-action documentation
- name: Commit updated data and stats
  uses: stefanzweifel/git-auto-commit-action@v7
  with:
    commit_message: 'chore: update activities and stats [skip ci]'
    file_pattern: 'data/activities/*.json data/sync-state.json data/stats/*.json data/geo/*.json'
    commit_user_name: 'github-actions[bot]'
    commit_user_email: 'github-actions[bot]@users.noreply.github.com'
```

**Key insight:** [skip ci] in commit message prevents infinite workflow loops. Commits made by GitHub Actions do not automatically trigger new workflow runs, but [skip ci] is explicit best practice. Glob patterns in file_pattern work correctly.

### Pattern 3: Copy Data Files for Deployment
**What:** Build script copies data/stats and data/geo to dist/widgets/data for deployment
**When to use:** When deployed widgets need to load JSON data via relative URLs
**Example:**
```javascript
// Source: scripts/build-widgets.mjs (already implemented)
function copyDataFiles() {
  const dataDirs = [
    { src: 'data/stats', dest: 'dist/widgets/data/stats' },
    { src: 'data/geo', dest: 'dist/widgets/data/geo' }
  ];

  for (const { src, dest } of dataDirs) {
    if (!existsSync(src)) continue;
    mkdirSync(dest, { recursive: true });
    for (const file of readdirSync(src)) {
      if (file.endsWith('.json')) {
        copyFileSync(resolve(src, file), resolve(dest, file));
      }
    }
    console.log(`✓ Copied ${src}/*.json → ${dest}/`);
  }
}
```

**Key insight:** Build script (scripts/build-widgets.mjs) already handles this pattern for data/stats - just ensure data/geo is included. Deploy step (peaceiris/actions-gh-pages) publishes entire dist/widgets directory.

### Anti-Patterns to Avoid
- **Failing workflow on geocoding errors:** Geographic data is supplementary - pipeline should continue if geocoding fails but core stats succeed
- **Not persisting location-cache.json:** Cache must be git-committed so subsequent runs are fast (>90% cache hit rate)
- **Committing without [skip ci]:** Creates workflow loop risk (though GitHub Actions commits don't auto-trigger by default)
- **Separate deploy workflow for geo widgets:** All widgets deploy together via dist/widgets, no need for separate deployment

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git commit automation | Manual git config/add/commit/push commands | stefanzweifel/git-auto-commit-action@v7 | Handles edge cases: no changes to commit, proper user attribution, [skip ci] semantics, file pattern globbing |
| GitHub Pages deployment | Manual push to gh-pages branch | peaceiris/actions-gh-pages@v4 | Handles force push, CNAME files, custom domain setup, proper branch management |
| Workflow error handling | Custom error detection and continuation logic | continue-on-error + steps.<id>.outcome | GitHub's native error handling with proper workflow UI integration (yellow warning vs red failure) |
| Documentation generation | Auto-generate docs from JSDoc/TypeScript | Hand-written README.md and index.html | Widget library is small (5 widgets), hand-written docs are clearer and more maintainable than generated docs |

**Key insight:** Mature GitHub Actions ecosystem provides battle-tested solutions for common CI/CD patterns. Custom implementations introduce maintenance burden and miss edge cases.

## Common Pitfalls

### Pitfall 1: Blocking Pipeline on Geocoding Failures
**What goes wrong:** Workflow fails if offline-geocode-city throws an exception or activities lack GPS data
**Why it happens:** Default behavior is for any step failure to halt the workflow
**How to avoid:** Use continue-on-error: true on geocoding step and check steps.geocode.outcome to emit warnings
**Warning signs:** Workflow runs failing with "Process completed with exit code 1" during compute-geo-stats step

### Pitfall 2: Not Committing location-cache.json
**What goes wrong:** Every workflow run re-geocodes all coordinates, making builds slow (minutes instead of seconds)
**Why it happens:** Forgetting to include data/geo/location-cache.json in git-auto-commit-action file_pattern
**How to avoid:** Verify file_pattern includes 'data/geo/*.json' which covers countries, cities, metadata, and cache
**Warning signs:** Workflow logs show "Cache size: 0 locations" on every run, geocoding step takes >1 minute

### Pitfall 3: Missing Strava Attribution
**What goes wrong:** Violating Strava API Agreement by not displaying required "Powered by Strava" attribution
**Why it happens:** Not reading Strava Brand Guidelines and API Agreement requirements
**How to avoid:** Include Strava attribution in README.md, index.html, and test.html footers with link to strava.com
**Warning signs:** Strava may revoke API access for non-compliant applications (rare but possible)

### Pitfall 4: Using failure() Instead of outcome
**What goes wrong:** Conditional steps don't trigger after continue-on-error failures because failure() checks conclusion (success) not outcome
**Why it happens:** Misunderstanding GitHub Actions error handling semantics: continue-on-error sets conclusion to success even when step fails
**How to avoid:** Always use steps.<id>.outcome == 'failure' when checking errors after continue-on-error: true
**Warning signs:** Warning messages not appearing in workflow logs despite geocoding failures

### Pitfall 5: Outdated Widget Embed Examples
**What goes wrong:** index.html shows old .init() API instead of new Custom Elements API
**Why it happens:** index.html was created during Phase 3 before Phase 7's attribute system existed
**How to avoid:** Update all widget embed examples to use Custom Elements syntax: `<strava-stats-card data-url="..."></strava-stats-card>`
**Warning signs:** Users copying embed code from index.html get deprecation warnings or broken widgets

## Code Examples

Verified patterns from official sources and existing implementation:

### Workflow Step: Non-Blocking Geocoding
```yaml
# Source: .github/workflows/daily-refresh.yml (current implementation)
# NEW: Add this step after "Compile TypeScript"
- name: Compute geographic statistics
  id: geocode
  continue-on-error: true
  run: npm run compute-geo-stats

- name: Warn on geocoding failure
  if: steps.geocode.outcome == 'failure'
  run: echo "::warning::Geocoding failed, widgets will use cached geo data"
```

### Workflow Step: Commit Geographic Data
```yaml
# Source: .github/workflows/daily-refresh.yml (modified)
- name: Commit updated data and stats
  uses: stefanzweifel/git-auto-commit-action@v7
  with:
    commit_message: 'chore: update activities and stats [skip ci]'
    # MODIFIED: Add data/geo/*.json to file_pattern
    file_pattern: 'data/activities/*.json data/sync-state.json data/stats/*.json data/geo/*.json'
    commit_user_name: 'github-actions[bot]'
    commit_user_email: 'github-actions[bot]@users.noreply.github.com'
```

### Widget Documentation: Custom Elements Embed Example
```html
<!-- Source: Web Components best practices + existing test.html -->
<!-- README.md and index.html examples should use this syntax -->
<strava-geo-table
  data-url="https://your-username.github.io/strava-widgets/data/geo/countries.json"
  data-dataset="countries"
  data-title="Countries I've Run In"
  data-rows-per-page="10">
</strava-geo-table>

<script src="https://your-username.github.io/strava-widgets/geo-table-widget.iife.js"></script>
```

### README.md Structure: Widget Library Documentation
```markdown
# Strava Analytics Widgets

Embeddable widgets for visualizing your Strava running data.

## Features

- 📊 Stats card with all-time totals and year-over-year comparisons
- 📈 Comparison charts for seasonal trends and time periods
- 🔥 Streak tracking and activity patterns visualization
- 🌍 Geographic statistics showing countries and cities you've run in
- 📋 Sortable, paginated tables for detailed geographic data

## Quick Start

### 1. Stats Card Widget

Display comprehensive running statistics:

```html
<strava-stats-card
  data-url="https://your-username.github.io/strava-widgets/data/stats/all-time-totals.json"
  data-secondary-url="https://your-username.github.io/strava-widgets/data/stats/year-over-year.json"
  data-title="My Running Stats">
</strava-stats-card>

<script src="https://your-username.github.io/strava-widgets/stats-card.iife.js"></script>
```

### Configuration

All widgets support these common attributes:

- `data-url` (required): URL to primary data JSON file
- `data-title`: Custom title (optional)
- `data-theme`: "light" or "dark" (default: auto-detect)
- `data-bg`: Background color override
- `data-text-color`: Text color override

[... more widget examples ...]

## CLI Commands

Build your own widget deployment:

```bash
npm run auth                   # Authenticate with Strava
npm run sync                   # Fetch new activities
npm run compute-all-stats      # Generate all statistics (basic, advanced, geo)
npm run build-widgets          # Build widget bundles
```

## Strava Attribution

This project uses data from the Strava API. When displaying widgets:

- Include "Powered by Strava" attribution with link to https://www.strava.com
- Comply with Strava Brand Guidelines: https://developers.strava.com/guidelines/
- If using Garmin-sourced data, include Garmin attribution per brand guidelines

## License

MIT
```

### CLI Help Text: Document New Commands
```typescript
// Source: src/index.ts (modified)
function printHelp() {
  console.log('Usage: npm run [command]');
  console.log('\nAvailable commands:');
  console.log('  auth                   - Complete OAuth flow with Strava');
  console.log('  sync                   - Sync new activities from Strava');
  console.log('  status                 - Show current sync status');
  console.log('  compute-stats          - Compute basic statistics from synced activities');
  console.log('  compute-advanced-stats - Compute advanced statistics (year-over-year, time-of-day, etc.)');
  console.log('  compute-geo-stats      - Compute geographic statistics (countries, cities) from GPS data');
  console.log('  compute-all-stats      - Compute all statistics (basic, advanced, geo)');
  console.log('\nExamples:');
  console.log('  npm run auth                   # Get authorization URL');
  console.log('  npm run sync                   # Fetch new activities');
  console.log('  npm run compute-all-stats      # Generate all stats (recommended)');
  console.log('  npm run build-widgets          # Build embeddable widget bundles');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual documentation updates | Auto-deploy index.html and test.html to GitHub Pages | Phase 4 (v1.0) | Widget examples always in sync with deployed widgets |
| Separate test files | Git-tracked test.html alongside index.html | Phase 8 (v1.1) | Visual testing page available in production for debugging |
| .init() API | Custom Elements with data-attributes | Phase 7 (v1.1) | Simpler embedding, HTML-only configuration, no JavaScript required |
| Online geocoding APIs | Offline library (offline-geocode-city) | Phase 5 (v1.1) | Zero API costs, no rate limits, works in CI without secrets |
| peaceiris/actions-gh-pages@v3 | peaceiris/actions-gh-pages@v4 | 2024 | Improved GitHub Pages deployment with better error messages |

**Deprecated/outdated:**
- Widget .init() API: Still supported for backward compatibility, but documentation should show Custom Elements syntax
- actions/checkout@v3, actions/setup-node@v3: Current workflow uses v4 versions (latest stable)

## Open Questions

1. **Should test.html be linked from index.html?**
   - What we know: test.html exists in dist/widgets and deploys to GitHub Pages
   - What's unclear: Whether users should be directed to test page for demos or if index.html should be sole landing page
   - Recommendation: Add "View Test Page" link to index.html footer for developers who want to see all widgets in action

2. **Should location-cache.json be .gitignored or tracked?**
   - What we know: Phase 5 plan specifies "git-tracked location cache" for persistence across CI runs
   - What's unclear: Whether committing cache to repo is best practice vs regenerating on each run
   - Recommendation: Track cache (already decided in phase 5) - provides 90%+ cache hit rate, drastically faster CI builds

3. **Should README.md duplicate index.html content?**
   - What we know: README.md serves GitHub repo visitors, index.html serves GitHub Pages visitors
   - What's unclear: Level of duplication vs cross-linking between them
   - Recommendation: README.md should be comprehensive (installation, setup, CLI, widget examples), index.html should focus on widget embedding only, both link to each other

## Sources

### Primary (HIGH confidence)
- Existing workflow: .github/workflows/daily-refresh.yml
- Existing build script: scripts/build-widgets.mjs
- Existing CI script: scripts/ci-setup-tokens.mjs
- Phase 4 Research: .planning/phases/04-automation-deployment/04-RESEARCH.md
- Phase 5 Plan: .planning/phases/05-geocoding-infrastructure/05-01-PLAN.md
- GitHub Actions official docs: https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions

### Secondary (MEDIUM confidence)
- [How to Handle Step and Job Errors in GitHub Actions](https://www.kenmuse.com/blog/how-to-handle-step-and-job-errors-in-github-actions/) - Error handling with continue-on-error and outcome vs conclusion
- [stefanzweifel/git-auto-commit-action](https://github.com/stefanzweifel/git-auto-commit-action) - Official repository and documentation
- [peaceiris/actions-gh-pages](https://github.com/peaceiris/actions-gh-pages) - Official repository and documentation
- [Web Components Best Practices](https://www.webcomponents.org/community/articles/web-components-best-practices) - Attribute documentation patterns
- [Custom Element Best Practices (web.dev)](https://web.dev/articles/custom-elements-best-practices) - Attribute handling and documentation
- [Strava Brand Guidelines](https://developers.strava.com/guidelines/) - API attribution requirements
- [Strava API Agreement](https://www.strava.com/legal/api) - Legal requirements for data attribution

### Tertiary (LOW confidence)
- None - all findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use and battle-tested in existing workflow
- Architecture: HIGH - Extending proven patterns from Phase 4 implementation
- Pitfalls: HIGH - Based on actual project code and official GitHub Actions documentation
- Documentation: MEDIUM - Standards well-established but specific content needs to be authored

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days - stable domain, GitHub Actions and project stack unlikely to change)
