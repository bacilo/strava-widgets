# Phase 4: Automation & Deployment - Research

**Researched:** 2026-02-14
**Domain:** GitHub Actions CI/CD, GitHub Pages deployment, Node.js automation
**Confidence:** HIGH

## Summary

Phase 4 focuses on automating the daily data refresh workflow and deploying widgets to GitHub Pages. The standard approach uses GitHub Actions workflows with scheduled triggers (cron), manual dispatch capability, and GitHub Pages deployment via Actions. The ecosystem has matured significantly, with official GitHub actions (setup-node, checkout, deploy-pages) and community actions (peaceiris/actions-gh-pages, stefanzweifel/git-auto-commit-action) providing robust, well-documented solutions.

Key considerations: GitHub Actions scheduled workflows are subject to delays (3-10 minutes typical, occasionally longer), so precise timing cannot be guaranteed. The workflow should handle errors gracefully with proper permissions configuration, timeout settings, and optional notification mechanisms. GitHub Pages deployment can be done either via the gh-pages branch pattern or the newer GitHub Actions artifact deployment method.

**Primary recommendation:** Use GitHub Actions with schedule + workflow_dispatch triggers, peaceiris/actions-gh-pages@v4 for deployment (simpler than official deploy-pages action for static file deployments), and git-auto-commit-action@v7 for committing generated widgets. Configure concurrency groups to prevent overlapping runs, set explicit timeouts, and use GITHUB_TOKEN with minimal required permissions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| actions/checkout | v6 | Clone repository | Official GitHub action, required for all workflows that access repo files |
| actions/setup-node | v6 | Configure Node.js | Official action with built-in npm caching, supports Node 18+ |
| peaceiris/actions-gh-pages | v4 | Deploy to GitHub Pages | Most popular community action (20k+ stars), simpler than official deploy-pages for static files |
| stefanzweifel/git-auto-commit-action | v7 | Commit generated files | Handles git add/commit/push automatically, widely used for auto-commit workflows |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| actions/upload-artifact | v6 | Share data between jobs | When build and deploy are separate jobs |
| actions/download-artifact | v6 | Retrieve uploaded artifacts | When consuming artifacts from previous jobs |
| Jtalk/url-health-check-action | latest | Verify deployment | Post-deployment health checks to ensure widgets load correctly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| peaceiris/actions-gh-pages | actions/deploy-pages | Official action requires more setup (configure-pages, upload-pages-artifact steps), better for complex artifact deployments |
| peaceiris/actions-gh-pages | JamesIves/github-pages-deploy-action | Similar functionality, peaceiris more widely adopted and recommended for security/simplicity |
| git-auto-commit-action | Manual git commands | More control but requires explicit git config, add, commit, push steps and error handling |
| GitHub Actions schedule | External cron (node-schedule, bree) | External requires always-on server, GitHub Actions serverless but has scheduling delays |

**Installation:**
```yaml
# No npm installation needed - GitHub Actions are referenced in workflow YAML
# Example workflow uses:
- uses: actions/checkout@v6
- uses: actions/setup-node@v6
  with:
    node-version: '24'
    cache: 'npm'
- run: npm ci
```

## Architecture Patterns

### Recommended Project Structure
```
.github/
├── workflows/
│   ├── daily-refresh.yml       # Scheduled + manual trigger workflow
│   └── deploy.yml              # Optional: separate deploy workflow
data/
├── stats/                       # Generated stats (gitignored)
└── activities/                  # Fetched activities
dist/                            # Built widgets
└── widgets/                     # Output from Vite builds
```

### Pattern 1: Single Workflow with Multiple Jobs
**What:** One workflow file with sequential jobs: fetch → process → build → commit → deploy
**When to use:** Simple pipelines where all steps run on every trigger
**Example:**
```yaml
# Source: GitHub Actions official docs + community best practices
name: Daily Widget Refresh

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily
  workflow_dispatch:      # Manual trigger button

# Prevent concurrent runs
concurrency:
  group: daily-refresh
  cancel-in-progress: false  # Let current run finish

# Minimal permissions for security
permissions:
  contents: write    # Commit generated files
  pages: write       # Deploy to GitHub Pages
  id-token: write    # OIDC for Pages deployment

jobs:
  refresh-and-deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout repository
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Fetch new activities
        env:
          STRAVA_CLIENT_ID: ${{ secrets.STRAVA_CLIENT_ID }}
          STRAVA_CLIENT_SECRET: ${{ secrets.STRAVA_CLIENT_SECRET }}
          STRAVA_REFRESH_TOKEN: ${{ secrets.STRAVA_REFRESH_TOKEN }}
        run: npm run fetch

      - name: Process statistics
        run: npm run process

      - name: Build widgets
        run: npm run build:widgets

      - name: Commit generated files
        uses: stefanzweifel/git-auto-commit-action@v7
        with:
          commit_message: "chore: update widgets and stats [skip ci]"
          file_pattern: "dist/widgets/*.js data/stats/*.json"

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist/widgets
          cname: your-domain.com  # Optional: custom domain
```

### Pattern 2: Separate Build and Deploy Jobs
**What:** Split workflow into jobs with artifact passing
**When to use:** When build and deploy need different environments or deploy needs approval
**Example:**
```yaml
# Source: GitHub Actions official docs
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: npm run build:widgets
      - uses: actions/upload-artifact@v6
        with:
          name: widgets
          path: dist/widgets
          retention-days: 1

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pages: write
    steps:
      - uses: actions/download-artifact@v6
        with:
          name: widgets
          path: dist/widgets
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist/widgets
```

### Pattern 3: Error Handling with Conditional Steps
**What:** Continue workflow even if some steps fail, send notifications
**When to use:** When you want to track failures without blocking deployment
**Example:**
```yaml
# Source: GitHub Actions error handling best practices
steps:
  - name: Fetch new activities
    id: fetch
    continue-on-error: true
    env:
      STRAVA_CLIENT_ID: ${{ secrets.STRAVA_CLIENT_ID }}
      STRAVA_CLIENT_SECRET: ${{ secrets.STRAVA_CLIENT_SECRET }}
      STRAVA_REFRESH_TOKEN: ${{ secrets.STRAVA_REFRESH_TOKEN }}
    run: npm run fetch

  - name: Check fetch status
    if: steps.fetch.outcome == 'failure'
    run: |
      echo "::warning::Activity fetch failed, using existing data"

  - name: Notify on failure
    if: failure()
    run: |
      echo "Workflow failed - notification would be sent here"
      # Could integrate with GitHub Issues, Slack, email, etc.
```

### Anti-Patterns to Avoid
- **Using npm install instead of npm ci:** In CI environments, always use `npm ci` for faster, deterministic installs
- **Overly broad permissions:** Don't use `permissions: write-all` - specify only what's needed
- **No timeout configuration:** Always set `timeout-minutes` to prevent runaway workflows consuming billable minutes
- **Hardcoded secrets:** Never put API keys in workflow files - use `secrets` context
- **No concurrency control:** Without concurrency groups, manual triggers during scheduled runs cause conflicts
- **Trusting ubuntu-latest blindly:** As of 2026, ubuntu-latest is Ubuntu 24.04 - verify compatibility or pin specific version

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git commit automation | Custom git commands in script | stefanzweifel/git-auto-commit-action@v7 | Handles git config, staging, committing, pushing, error cases; prevents duplicate commits; 4k+ stars, battle-tested |
| GitHub Pages deployment | Custom git push to gh-pages | peaceiris/actions-gh-pages@v4 | Handles branch creation, force pushing, CNAME preservation, Jekyll disable; prevents deployment race conditions |
| Node.js setup | Manual node download/install | actions/setup-node@v6 | Official action with built-in caching, version matrix support, registry auth; automatically handles package manager detection |
| Artifact sharing | Custom file storage/transfer | actions/upload-artifact & download-artifact | GitHub-native, secure, automatic cleanup, no external dependencies |
| Deployment health checks | Custom curl/fetch scripts | Jtalk/url-health-check-action | Built-in retry logic, redirect handling, timeout handling, proper error reporting |

**Key insight:** GitHub Actions ecosystem is mature - most common CI/CD patterns have well-maintained actions that handle edge cases you'll miss in custom implementations. Reinventing these wastes time and introduces bugs. Custom bash scripts are particularly problematic: they don't handle concurrency, permissions, rate limits, or security concerns properly.

## Common Pitfalls

### Pitfall 1: Scheduled Workflow Timing Unreliability
**What goes wrong:** Workflows scheduled with cron don't run exactly on time - delays of 3-10 minutes are typical, sometimes 30+ minutes or more during high load
**Why it happens:** GitHub Actions shares infrastructure; scheduled workflows run on best-effort basis, not guaranteed execution time
**How to avoid:**
- Don't rely on precise timing for critical operations
- Use workflow_dispatch as fallback for manual triggers when needed
- For mission-critical timing, consider external schedulers pinging a repository_dispatch webhook
**Warning signs:** Workflow runs show start times significantly later than scheduled cron time in Actions tab

### Pitfall 2: Pull Request Forks Can't Access Secrets
**What goes wrong:** Workflow fails with "secret not found" errors when triggered from forked PRs
**Why it happens:** Security restriction - forks can't access repository secrets to prevent secret theft
**How to avoid:** This workflow only runs on schedule/manual dispatch, not PRs, so not applicable; but important for future PR workflows
**Warning signs:** Workflow works on main branch but fails on forks with secret access errors

### Pitfall 3: Permissions Too Broad or Too Narrow
**What goes wrong:** Workflow fails with "permission denied" or operates with unnecessary privileges
**Why it happens:** GitHub defaults to restrictive permissions; must explicitly grant write access
**How to avoid:**
- Set minimal permissions at workflow/job level: `permissions: { contents: write, pages: write, id-token: write }`
- Don't use `permissions: write-all` - violates least-privilege principle
- Test permission changes in separate branch first
**Warning signs:** Error messages containing "Resource not accessible by integration" or permission failures

### Pitfall 4: Concurrent Workflow Runs Causing Conflicts
**What goes wrong:** Manual trigger during scheduled run causes git conflicts, race conditions, or duplicate work
**Why it happens:** Multiple workflow instances modify same files simultaneously
**How to avoid:** Use concurrency groups:
```yaml
concurrency:
  group: daily-refresh
  cancel-in-progress: false  # Or true to cancel old runs
```
**Warning signs:** Git push failures, merge conflicts in automated commits, duplicate deployments

### Pitfall 5: Missing [skip ci] in Commit Messages
**What goes wrong:** Auto-commits trigger workflows recursively, causing infinite loops or wasted Actions minutes
**Why it happens:** Commits by GITHUB_TOKEN trigger workflows unless explicitly skipped
**How to avoid:** Add `[skip ci]` or `[ci skip]` to auto-commit messages; git-auto-commit-action doesn't auto-trigger by default (safer)
**Warning signs:** Unexpected workflow runs immediately after automated commits, rapidly increasing Actions usage

### Pitfall 6: npm Cache Mismatch
**What goes wrong:** npm install runs slowly despite caching enabled
**Why it happens:** Cache key doesn't match package-lock.json hash, or lock file not committed
**How to avoid:**
- Always commit package-lock.json
- Use setup-node's built-in caching: `cache: 'npm'`
- Use `npm ci` not `npm install` in workflows
**Warning signs:** "Cache not found" in workflow logs, install step taking 2+ minutes

### Pitfall 7: Artifacts Exceeding Retention or Size Limits
**What goes wrong:** Artifacts fail to upload or are deleted before deploy job runs
**Why it happens:** 500 artifact limit per job, 10GB size limit, default 90-day retention
**How to avoid:**
- Set appropriate retention: `retention-days: 1` for same-workflow artifacts
- Minimize artifact size - only include necessary files
- Use artifacts only for job-to-job passing, not long-term storage
**Warning signs:** "Artifact exceeds maximum size" errors, deploy jobs failing to find artifacts

### Pitfall 8: Timeout Defaults Causing Runaway Costs
**What goes wrong:** Hanging processes run for 6 hours (default timeout), consuming billable minutes
**Why it happens:** GitHub default job timeout is 360 minutes; scripts can hang on network errors, infinite loops
**How to avoid:** Set explicit timeouts at job level: `timeout-minutes: 30`
**Warning signs:** Unexpectedly high Actions minutes usage, jobs running much longer than normal

## Code Examples

Verified patterns from official sources:

### Complete Daily Refresh Workflow
```yaml
# Source: Synthesized from GitHub official docs + community best practices
# .github/workflows/daily-refresh.yml
name: Daily Widget Refresh

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily (Note: may run with delays)
  workflow_dispatch:
    inputs:
      force_rebuild:
        description: 'Force rebuild all widgets'
        type: boolean
        default: false

concurrency:
  group: widget-refresh
  cancel-in-progress: false

permissions:
  contents: write
  pages: write
  id-token: write

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout code
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Fetch activities from Strava
        env:
          STRAVA_CLIENT_ID: ${{ secrets.STRAVA_CLIENT_ID }}
          STRAVA_CLIENT_SECRET: ${{ secrets.STRAVA_CLIENT_SECRET }}
          STRAVA_REFRESH_TOKEN: ${{ secrets.STRAVA_REFRESH_TOKEN }}
        run: npm run fetch

      - name: Process statistics
        run: npm run process

      - name: Build widgets
        run: npm run build:widgets

      - name: Commit updated files
        uses: stefanzweifel/git-auto-commit-action@v7
        with:
          commit_message: "chore: update widgets and stats [skip ci]"
          file_pattern: "dist/widgets/*.js data/stats/*.json"
          commit_user_name: "github-actions[bot]"
          commit_user_email: "github-actions[bot]@users.noreply.github.com"

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist/widgets
          enable_jekyll: false
```

### Manual Trigger with Inputs
```yaml
# Source: GitHub Actions official docs - workflow_dispatch inputs
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        type: choice
        options:
          - production
          - staging
      force_refresh:
        description: 'Force refresh all data'
        type: boolean
        default: false
      date_range:
        description: 'Number of days to fetch'
        type: number
        default: 7

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Use inputs
        run: |
          echo "Deploying to: ${{ inputs.environment }}"
          echo "Force refresh: ${{ inputs.force_refresh }}"
          echo "Date range: ${{ inputs.date_range }}"
```

### Accessing Secrets in Node.js Script
```javascript
// Source: Node.js process.env documentation + GitHub Actions best practices
// scripts/fetch-activities.js
const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

if (!clientId || !clientSecret || !refreshToken) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Use native fetch (Node 18+)
const response = await fetch('https://www.strava.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  })
});
```

### Error Handling with Notifications
```yaml
# Source: GitHub Actions error handling patterns
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Fetch data
        id: fetch
        continue-on-error: true
        run: npm run fetch

      - name: Handle fetch failure
        if: steps.fetch.outcome == 'failure'
        run: |
          echo "::warning::Data fetch failed, attempting to use cached data"
          # Could create GitHub issue, send notification, etc.

      # Continue with remaining steps even if fetch failed
      - name: Build with available data
        run: npm run build:widgets

      # Final notification step runs only on workflow failure
      - name: Report failure
        if: failure()
        run: |
          echo "::error::Workflow failed - manual intervention required"
          # Integration point for notifications (email, Slack, etc.)
```

### Health Check After Deployment
```yaml
# Source: Jtalk/url-health-check-action documentation
- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v4
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./dist/widgets

- name: Wait for deployment
  run: sleep 30  # Give GitHub Pages time to update

- name: Verify deployment
  uses: Jtalk/url-health-check-action@v4
  with:
    url: https://yourusername.github.io/repo-name/widget.js
    max-attempts: 5
    retry-delay: 10s
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| actions/checkout@v3 | actions/checkout@v6 | Jan 2026 | Updated to Node.js 24 runtime |
| actions/setup-node@v3 | actions/setup-node@v6 | Jan 2026 | Built-in automatic npm caching via packageManager field |
| ubuntu-22.04 | ubuntu-24.04 (ubuntu-latest) | Jan 2025 | Latest LTS, completed rollout Jan 17, 2025 |
| Deploy from gh-pages branch | Deploy via GitHub Actions | 2023+ | More flexible, supports custom build processes, artifact-based |
| actions/upload-artifact@v3 | actions/upload-artifact@v6 | 2025 | Node.js 24, better compression, overwrite support |
| Manual git commands | git-auto-commit-action@v7 | Ongoing | v7 latest stable, handles edge cases automatically |
| External cron services | GitHub Actions schedule | 2020+ | Native to platform but unreliable timing (delays common) |

**Deprecated/outdated:**
- **Node.js 16 in workflows:** Reached EOL, use Node 24 or 22 LTS
- **npm install in CI:** Use `npm ci` for deterministic, faster installs
- **Permissions: write-all:** Now considered anti-pattern, use minimal permissions
- **pull_request_target for untrusted code:** Major security vulnerability pattern, avoid unless absolutely necessary
- **@master version references:** Always use version tags (@v6) not branch names for actions
- **CNAME file in source branch:** When using GitHub Actions deployment, CNAME handled via action input, not committed file

## Open Questions

1. **Custom domain configuration**
   - What we know: peaceiris/actions-gh-pages supports `cname: domain.com` input
   - What's unclear: Whether project already has custom domain configured, or will use github.io subdomain
   - Recommendation: Skip CNAME configuration in initial implementation, add later if needed

2. **Notification mechanism for failures**
   - What we know: Multiple options exist (GitHub Issues, Slack, email via third-party actions)
   - What's unclear: User preference for notification method, or if GitHub's default email notifications sufficient
   - Recommendation: Start with GitHub's built-in notifications (email to workflow author), add custom notifications only if requested

3. **Deployment verification depth**
   - What we know: Can verify widget JS files load (HTTP 200), can check for specific text/content
   - What's unclear: Whether deep validation needed (parse JS, verify widget initialization) or surface check sufficient
   - Recommendation: Basic HTTP health check post-deployment, enhance if issues detected

4. **Retention of generated stats files**
   - What we know: data/stats/ currently gitignored, regenerated each run
   - What's unclear: Whether to commit stats for historical tracking or keep gitignored
   - Recommendation: Keep gitignored as designed unless historical tracking becomes requirement

## Sources

### Primary (HIGH confidence)
- [GitHub Actions Workflow Syntax](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions) - Schedule, workflow_dispatch, inputs syntax
- [GitHub Actions Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) - Secret access patterns, security
- [GitHub Pages Custom Workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) - Deployment permissions, actions
- [GitHub Actions Concurrency Control](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs) - Concurrency groups, cancel-in-progress
- [GitHub Actions Notifications](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/notifications-for-workflow-runs) - Notification behavior
- [actions/setup-node@v6](https://github.com/actions/setup-node) - Current version, inputs, caching
- [actions/checkout](https://github.com/actions/checkout) - Current version v6
- [actions/upload-artifact](https://github.com/actions/upload-artifact) - Version v6, inputs
- [peaceiris/actions-gh-pages@v4](https://github.com/peaceiris/actions-gh-pages) - Current version, inputs, permissions
- [stefanzweifel/git-auto-commit-action@v7](https://github.com/stefanzweifel/git-auto-commit-action) - Current version, inputs

### Secondary (MEDIUM confidence)
- [GitHub Actions Best Practices (Exercism)](https://exercism.org/docs/building/github/gha-best-practices) - Timeout recommendations
- [GitHub Actions Timeouts (Graphite)](https://www.graphite.com/guides/github-actions-timeouts) - Default 360 minutes
- [npm ci Best Practices](https://www.voorhoede.nl/en/blog/super-fast-npm-install-on-github-actions/) - CI vs install comparison
- [GitHub Actions Error Handling (Ken Muse)](https://www.kenmuse.com/blog/how-to-handle-step-and-job-errors-in-github-actions/) - continue-on-error patterns
- [GitHub Actions Security Pitfalls (Arctiq)](https://arctiq.com/blog/top-10-github-actions-security-pitfalls-the-ultimate-guide-to-bulletproof-workflows) - pull_request_target risks
- [GitHub Actions CI/CD Guide 2026 (DevToolbox)](https://devtoolbox.dedyn.io/blog/github-actions-cicd-complete-guide) - ubuntu-latest = 24.04
- [GitHub Actions Schedule Reliability Issues](https://github.com/orgs/community/discussions/156282) - Delay documentation
- [URL Health Check Action](https://github.com/Jtalk/url-health-check-action) - Post-deployment verification

### Tertiary (LOW confidence - community reports)
- Various GitHub community discussions on scheduled workflow delays, concurrency patterns, artifact limits

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All actions from official GitHub or highly-starred community projects with extensive documentation
- Architecture: HIGH - Patterns verified from official docs and widely-adopted community practices
- Pitfalls: HIGH - Documented in official troubleshooting guides and security advisories
- Scheduling reliability: MEDIUM-LOW - Well-documented issue but exact delay characteristics vary by load

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days - GitHub Actions stable, but action versions update regularly)
