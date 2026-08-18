# Phase 21: Overview Rebuild - Research

**Researched:** 2026-08-18
**Domain:** Internal TypeScript/DOM refactor + CSS (no new libraries) — shared row-rendering,
records-screen scope toggle, headline-stats extension, and an analytics field addition
(`streaks.json`). Zero new external dependencies.
**Confidence:** HIGH (every claim below is sourced from direct reads of the live source tree in
this repository at commit state 2026-08-18, not from training data or web search — this phase has
no external-library domain to research)

## Summary

This phase touches five existing files (`overview.ts`, `list.ts`, `records.ts`,
`records-logic.ts`, `streak-utils.ts`) plus `styles.css`, and adds no new dependency. All the
"research" work here is source-reading: confirming exact current shapes so the planner does not
have to re-derive them. Every code excerpt below was read directly from the file named.

**Primary recommendation:** Retire `renderRecentPrRow` into `renderActivityRow` (D-05), extending
`renderActivityRow`'s signature to accept the badge set as a parameter rather than deriving it
internally, so it serves Recent PRs, Recent Activities, and the Activities mobile card from one
function. Two-line CSS hierarchy is a pure `styles.css` change reusing existing flex properties
(`flex-direction: column` plus a `justify-content: space-between` header row) — no grid, no media
query. The records year-scope toggle is a pure client-side filter/re-rank function in
`records-logic.ts` plus a `.segmented` control copied from `detail-charts.ts`. The streak fix is
two-layered (`streak-utils.ts:118` AND `records-logic.ts:274-278`) and needs one new field,
`currentStreakEnd`, threaded through `StreakResult` → `streaks.json` → `selectCurrentStreak` →
both `buildSuperlativeTile` (Records) and a new sub-label parameter on `buildStatCard` (Overview).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OVR-01 | Recent PRs rows show name, date, distance, PR badge in a deliberate hierarchy, link to activity | § Shared Row Renderer, § CSS Two-Line Hierarchy — exact current `renderRecentPrRow`/`recentPrRowAriaLabel` shapes and what must change |
| OVR-02 | Recent Activities rows follow the same structure and linking | § Shared Row Renderer — `renderActivityRow` is the seam; one edit serves both cards |
| OVR-03 | Records scope toggle (all-time / this-year) | § Records Scope Toggle — `buildPrTablesSection`/`buildPrTableRows` data flow, `.segmented` reference markup, `PRRankingEntry.startDate` field confirmed present |
| OVR-04 | Headline Stats shows distance/hours this year | § This-Year Headline Stats — `yearly-stats.json`'s exact shape (`periodLabel`, `totalKm`, `totalMovingTimeMin`), confirmed already fetched by `trends.ts` |
| FIX-01 | Current Streak `ended {date}` sub-label renders | § FIX-01 Ended Streak — the two-layer bug (`streak-utils.ts:118` + `records-logic.ts:274-278`), current `StreakResult`/`streaks.json` shape, test-fixture precedent |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Row rendering (name/date/distance/badges) | Browser / Client (static SPA view module) | — | `overview.ts`/`list.ts` are pure client-side DOM builders; no server tier exists in this app |
| Row navigation semantic | Browser / Client (`row-navigation.ts`) | — | Already owned by Phase 20; this phase builds inside it, does not touch it |
| Records year-scope filter/re-rank | Browser / Client (`records-logic.ts`, pure function) | — | Client-side filter over already-fetched `best-efforts.json`; no new fetch, no server involvement |
| Headline-stats this-year figures | Browser / Client (`overview.ts` fetch + render) | Static / CDN (`yearly-stats.json`, pre-published) | Data is pre-computed at build time (Node script) and published as a static JSON asset fetched by the browser at runtime — this phase adds one more `fetch`, no pipeline change |
| Streak `currentStreakEnd` field | Static data pipeline (`compute-advanced-stats.ts`, Node/build-time) | Browser / Client (`streak-utils.ts` pure function + `records-logic.ts`/`overview.ts` readers) | The field must be computed once at build time (in the Node compute script) and persisted to `streaks.json`; the browser only ever reads it |

This app has no backend/API tier — it is a fully static SPA (Vite-built, IIFE-bundled) served from
GitHub Pages under `/strava-widgets`, with data pre-computed by Node scripts (`compute-*.ts`) and
committed/published as static JSON. Every capability in this phase lives in the browser-tier view
modules or the build-time compute layer that feeds them; there is no server-side rendering, no
API endpoint, and no database. This matches the project's decade-consistent shape across Phases
14-20.

## Project Constraints (from CLAUDE.md)

No project-root `CLAUDE.md` exists in this repository (`/Users/pedf/workspace/strava-widgets/`)
and no `.claude/skills/` or `.agents/skills/` directory with project-specific skill files was
found. The only enforceable conventions for this phase are the ones already recorded in
CONTEXT.md's `<canonical_refs>` (frozen class names, D-08's row semantic, 18-UI-SPEC § 17's
type-role freeze) and the established in-repo patterns documented below (pure `*-logic.ts` +
`.test.ts` pairing, `textContent`-only for athlete free text, no jsdom/headless browser).

## Standard Stack

No new libraries. This phase is a pure refactor/extension of existing TypeScript/DOM code and
CSS, using only what is already imported in the touched files (`vitest` for tests, native DOM
APIs, no framework). There is nothing to install.

### Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages — confirmed by reading every file
named in CONTEXT.md's "Files this phase changes" list; none adds an `import` from a package not
already in `package.json`. The slopcheck/registry-verification gate is skipped for this reason,
not bypassed.

## Architecture Patterns

### System Architecture Diagram

```
Build time (Node, npm run compute-all-stats / compute-advanced-stats)
  activities[] (data/activities/*.json)
        │
        ▼
  calculateDailyStreaks()  [streak-utils.ts]
        │  StreakResult { currentStreak, longestStreak, withinCurrentStreak,
        │                 currentStreakStart, longestStreakStart, longestStreakEnd,
        │                 + NEW currentStreakEnd (D-13) }
        ▼
  compute-advanced-stats.ts → StreakData (analytics.types.ts) → JSON.stringify
        │
        ▼
  data/stats/streaks.json  ──(npm run build-widgets: copyDataFiles)──► dist/widgets/data/stats/streaks.json
                                                                              │
                                                                              ▼
Runtime (browser, SPA)                                          served under /strava-widgets/
  overview.ts mount()                         records.ts load()
        │  fetchStatsJson('streaks.json')            │  fetchStatsJson('streaks.json')
        │  fetchStatsJson('all-time-totals.json')    │  fetchStatsJson('best-efforts.json')
        │  fetchStatsJson('yearly-stats.json') [NEW] │
        ▼                                             ▼
  buildHeadlineStatsCard()                     selectCurrentStreak() [records-logic.ts]
    - existing 6 tiles                            reads currentStreakEnd (NOT currentStreakStart)
    - +2 this-year tiles (D-09/D-10/D-11)          for endedISO (D-12 layer-2 fix)
    - Current Streak sub-label (D-15)                    │
        │                                                ▼
        ▼                                        buildSuperlativesSection()
  buildRecentPrsCard() / buildRecentActivitiesCard()   Current Streak tile sub-label
        │  both call the ONE shared renderer                (already has the slot, :298-299)
        │  (retired renderRecentPrRow → renderActivityRow, D-05)
        ▼                                        buildPrTablesSection()
  renderActivityRow() [list.ts]                     │ scope control (D-01..D-04)
    - also called by list.ts's own                  │ .segmented All-time/This-year
      buildMobileCardList() — SAME function,         ▼
      so this is a 3-surface seam                buildPrTableRows() + NEW year filter/re-rank
                                                   (records-logic.ts, pure, client-side over
                                                    already-fetched best-efforts.json)
```

### Recommended Project Structure

No new files. Every change lands in an existing module:

```
src/
├── analytics/
│   ├── streak-utils.ts          # StreakResult gains currentStreakEnd (D-13)
│   └── streak-utils.test.ts     # new assertions for currentStreakEnd
├── analytics/compute-advanced-stats.ts   # StreakData gains currentStreakEnd, written to streaks.json
├── types/analytics.types.ts     # StreakData interface gains currentStreakEnd: string
├── dashboard/
│   ├── views/
│   │   ├── overview.ts          # buildStatCard sub-label param, +2 tiles, retire renderRecentPrRow
│   │   ├── list.ts              # renderActivityRow becomes the shared 3-surface renderer
│   │   ├── records.ts           # scope control above PR tables, streak sub-label already has slot
│   │   ├── records-logic.ts     # selectCurrentStreak reads currentStreakEnd; new year-filter fn
│   │   ├── overview.test.ts     # existing aria-label tests, retire or repoint
│   │   ├── list-logic.test.ts / list.test.ts
│   │   └── records-logic.test.ts
│   └── styles.css               # D-06 two-line row rules, D-09 grid (no new rule needed), scope control
```

### Pattern 1: The `*-logic.ts` / view-module split (established, load-bearing)

**What:** Pure, DOM-free data transforms live in `*-logic.ts` (node-environment testable);
DOM construction and event wiring live in the view module (`overview.ts`, `records.ts`, `list.ts`).
**When to use:** Every function this phase adds. The records year-filter+re-rank function belongs
in `records-logic.ts`, NOT `records.ts` — mirrors `buildPrTableRows`, `selectSuperlatives`, etc.
**Example (existing, from `records-logic.ts`):**
```typescript
// Source: src/dashboard/views/records-logic.ts:101-136 (read directly)
export function buildPrTableRows(
  entries: readonly PRRankingEntry[] | undefined,
  ageGrading: AgeGradingDocument | null,
  distance: TargetDistanceKey,
  exclusionReasons: ReadonlyMap<string, string>
): PrTableRow[] {
  if (!entries || entries.length === 0) return [];
  // ... maps entries -> PrTableRow[], ranked as-is
}
```
A year-scoped variant needs to (a) filter `entries` by `startDate`'s year, and (b) re-rank 1..N
within the filtered set (Claude's Discretion default, per CONTEXT.md). `PRRankingEntry.startDate`
is confirmed present (`best-effort.types.ts:130`) — no new data needed. `records-logic.ts`
already has `parseStartDateToEpochMs` as a private helper (used by `buildEvolutionSeries`) that
applies the correct Z-suffix normalization; a year-extraction helper should reuse that same
normalization rule, not invent a second one.

### Pattern 2: The `.segmented` control (D-02's reference)

**What:** A `role="group"` div containing `button` elements with `.segmented__option` /
`.segmented__option--active`, `aria-pressed` toggling.
**When to use:** The OVR-03 scope toggle, verbatim.
**Example — exact current markup and click wiring from `detail-charts.ts`:**
```typescript
// Source: src/dashboard/views/detail-charts.ts:257-276, 543-552 (read directly)
const segmented = document.createElement('div');
segmented.className = 'segmented';
segmented.setAttribute('role', 'group');
segmented.setAttribute('aria-label', 'Chart x-axis');   // → change to something like 'Records scope'

const distanceOption = document.createElement('button');
distanceOption.type = 'button';
distanceOption.className = 'segmented__option segmented__option--active';
distanceOption.textContent = 'Distance';                 // → 'All time'
distanceOption.setAttribute('aria-pressed', 'true');

const timeOption = document.createElement('button');
timeOption.type = 'button';
timeOption.className = 'segmented__option';
timeOption.textContent = 'Time';                          // → 'This year'
timeOption.setAttribute('aria-pressed', 'false');

segmented.appendChild(distanceOption);
segmented.appendChild(timeOption);

// ... elsewhere, the toggle function:
function setXAxisMode(mode) {
  const isDistance = mode === 'distance';
  distanceOption.classList.toggle('segmented__option--active', isDistance);
  distanceOption.setAttribute('aria-pressed', String(isDistance));
  timeOption.classList.toggle('segmented__option--active', !isDistance);
  timeOption.setAttribute('aria-pressed', String(!isDistance));
  // ... re-render whatever the toggle controls
}
distanceOption.addEventListener('click', () => setXAxisMode('distance'));
timeOption.addEventListener('click', () => setXAxisMode('time'));
```
**View-local state idiom (D-04, no persistence):** `detail-charts.ts`'s `xAxisMode` is a plain
closure variable inside the mount function, mutated by the click handler and read by a re-render
call — no storage, no URL. `list.ts`'s `panelOpen` boolean (line 1169: "NOT persisted to storage
and NOT written to the URL... outlives a re-mount within the same SPA session because the factory
instance is created once and reused") is the second precedent for exactly this shape. The
Records scope toggle should follow the same idiom: a closure variable in `createRecordsView`'s
factory scope (not inside `load()`, since `load()` re-runs on every mount and the scope's D-04
"resets to all-time on every arrival at `#/records`" requirement wants a variable that resets on
each `mount()`/`load()` call — i.e., declare it where `mountedContainer` etc. live, initialize to
`'all-time'` at the top of `load()`).

**CSS token note:** `.segmented` uses `var(--radius-control)` (`styles.css:900-950`), already
fixed by Phase 19's CR-02 (middle-option radius). A 2-option group has no middle option, so CR-02
is moot for this control, but confirms the tokens are current and correct.

### Pattern 3: `fetchStatsJson` — the individually-guarded stats fetch idiom

**What:** Every stats JSON fetch in this app goes through a locally-duplicated (not shared —
each view module has its own copy) `fetchStatsJson<T>` that try/catches and returns `null` on any
failure, never throwing into the caller's `Promise.all`.
**Example (from `overview.ts:65-76`, read directly):**
```typescript
async function fetchStatsJson<T>(url: string, doFetch: FetchLike): Promise<T | null> {
  try {
    const response = await doFetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(error);
    return null;
  }
}
```
OVR-04's `yearly-stats.json` fetch is one more call added to `overview.ts`'s existing
`Promise.all([indexClient.loadIndex(), fetchStatsJson<AllTimeTotals>(...), fetchStatsJson<StreaksStats>(...)])`
at `overview.ts:242-246`. `trends.ts:1167` already fetches the exact same file this way — confirms
the URL and the degrade-to-null contract are already proven in production.

### Anti-Patterns to Avoid

- **Branching inside the shared row renderer** (D-07 explicitly declined this): a field-subset
  option parameter that changes what's rendered per call site is "exactly the seam that drifts."
  Every call site renders the full field set; only the badge set varies, and that already varies
  today via `statusBadgeTexts` vs. the PR-only badge.
- **Deriving `ended {date}` from `all-time-totals.json`'s `lastActivityDate`** in view code — this
  is D-13's explicitly declined option. It works today by an unstated invariant
  (`withinCurrentStreak === false` implies the archive's last activity IS the streak's last day)
  that is untestable as a unit and is precisely the kind of implicit coupling that produced the
  original bug.
- **A URL-hash or localStorage-backed scope state for Records** (D-04 declined both) — `navigateTo`
  (`router.ts:171-177`) has no query-param contract, and persistence is deliberately reserved for
  Phase 22's CAL-01.
- **Reading `PRRankingEntry`/`PrTableRow` dates without the Z-suffix normalization** — every other
  date-bearing function in this codebase (`formatActivityDate`, `parseStartDateToEpochMs`,
  `activityDayKey`) applies "append Z if absent" before parsing, because the archive has two date
  shapes (Strava-era Z-suffixed, intervals.icu-era no-Z). A year-extraction helper that skips this
  will silently misclassify some rows near year boundaries in the visitor's timezone if it does a
  naive `new Date(startDate).getFullYear()` instead of `getUTCFullYear()` on a normalized instant.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Two-option toggle control | A new button-pair component | `.segmented` / `.segmented__option` (`detail-charts.ts`, `styles.css:900-955`) | Already themed, already has the Phase 19 focus-ring/radius fixes applied; a second implementation would need its own contrast/radius verification pass |
| Accessible row name composition | A new ad-hoc string template per call site | `composeRowAriaLabel` (`list.ts:266`) | Already the single composer three surfaces use; a fourth hand-rolled version reintroduces the exact CR-02 divergence this codebase already fixed once |
| Empty-state for a distance with no year-scoped rows | A new empty-state component | `buildPrTableEmptyState` (`records.ts:324`) | Already the named empty state for "no rows in this ranking"; Claude's Discretion default explicitly names reusing it |
| Sub-label / third line on a stat tile | A new tile component for Overview | `buildSuperlativeTile`'s existing optional `sublabel` param (`records.ts:224-245`) shape, ported to `buildStatCard` | `buildSuperlativeTile` already proves the "two `.text-label` lines, zero new CSS" pattern D-15 wants `buildStatCard` to gain |
| Row-click navigation, keyboard semantics, curated aria-label composition for any NEW row this phase renders | Anything from scratch | `activityDetailHref`, `composeRowAriaLabel`, the whole-row-`<a>` pattern (Phase 20, frozen) | Out of scope — Phase 20 owns the semantic; this phase only owns row *contents* |

**Key insight:** Nearly everything this phase needs is already built somewhere else in the
codebase in a proven, tested, checkpoint-verified form (`.segmented`, `composeRowAriaLabel`,
`buildPrTableEmptyState`, `buildSuperlativeTile`'s sublabel). The work here is almost entirely
*reuse and thread data through*, not *invent*.

## Shared Row Renderer (research_focus item 1)

### Current exact shapes

**`renderRecentPrRow`** (`overview.ts:118-141`) — renders an `<a class="activity-row">` with:
- `.activity-row__name` = `row.name`
- `.activity-row__meta` = `` `${formatActivityDate(row.startDateLocal)} · ${distanceKm} km` ``
  (date + distance only — no duration, no pace)
- one `.badge` span = `recentPrBadgeText(row)` = `` `${row.prCount} PR` ``
- `aria-label` from `recentPrRowAriaLabel(row)` = curated 3-part base + `composeRowAriaLabel`
  fold of `[recentPrBadgeText(row)]`

**`renderActivityRow`** (`list.ts:324-348`) — renders an `<a class="activity-row">` with:
- `.activity-row__name` = `row.name`
- `.activity-row__meta` = `` `${date} · ${distanceKm} km · ${formatDurationHms(row.movingTimeSec)} · ${formatPace(row.paceSecPerKm)}` ``
  (date + distance + duration + pace — the full field set)
- badges from `appendStatusBadges(rowEl, row, idPrefix)`, which iterates `statusBadgeTexts(row)` —
  this ALREADY includes `` `${row.prCount} PR` `` when `row.prCount > 0` (`list.ts:229-230`)
- `aria-label` from `activityRowAriaLabel(row)` = curated 3-part base + `composeRowAriaLabel` fold
  of the FULL `statusBadgeTexts(row)` array
- ALSO sets `aria-describedby` when `row.lowConfidence`, pointing at a `.sr-only` description span
  `appendLowConfidenceBadge` creates (via `lowConfidenceDescriptionId(idPrefix)`, unique per
  surface via `idPrefix`)

**Two accessible-name builders** differ only in which badge array they fold:
`recentPrRowAriaLabel` folds `[recentPrBadgeText(row)]` (always exactly one string, when
`prCount > 0`); `activityRowAriaLabel` folds `statusBadgeTexts(row)` (0-4 strings covering
streams/low-confidence/exclusion/PR-count). Both share the identical 3-part base template
(`` `${row.name}, ${formatActivityDate(row.startDateLocal)}, ${distanceKm} km` ``) and both call
`composeRowAriaLabel`.

### What one shared renderer needs (D-05, D-07)

D-07 already resolved the field-set question: a Recent PRs row under the shared renderer shows the
**full** field set (name, date, distance, duration, pace) — `statusBadgeTexts` already emits the
PR badge, so **no new badge source is needed**. This means `renderActivityRow` (list.ts) can
become the ONE renderer with **no signature change to its badge/meta logic at all** — the only
question is whether `overview.ts`'s Recent PRs card calls `renderActivityRow` directly (dropping
`renderRecentPrRow`, `recentPrBadgeText`, `recentPrRowAriaLabel` entirely) or whether a thin
`idPrefix`-scoping concern needs solving.

**The one real seam:** `renderActivityRow`'s `idPrefix` is `` `activity-card-${row.id}` `` — hardcoded
to a single prefix in the current signature (`list.ts:328`). If both the Recent PRs card and the
Recent Activities card on Overview render the SAME row (a row can have `prCount > 0` and also
appear in "recent activities" if it's within the last 10), two elements with the SAME
`idPrefix` (hence the same `.sr-only` description `id`) could render simultaneously on the same
page — `renderActivityRow`'s own JSDoc (`list.ts:242-247`) already documents this exact collision
class for the desktop-table-vs-mobile-card case (`'activity-card-' + row.id` vs
`'activity-table-' + row.id`). On Overview, Recent PRs and Recent Activities are two DIFFERENT
lists (max 5 vs max 10 rows) but a row's `id` could appear in both simultaneously (a PR-carrying
activity within the last 10). **The planner must decide**: either (a) give `renderActivityRow` an
explicit `idPrefix`-scoping parameter distinguishing "recent-prs" from "recent-activities" call
sites (extending the existing pattern with a third prefix value), or (b) confirm duplicate ids
across two simultaneously-rendered lists are harmless because `aria-describedby` only fires when
`row.lowConfidence` is true AND both instances would carry the identical description text anyway
(same row, same explanation) — collision would be a silent duplicate-id issue, not a wrong-content
issue, but `id` uniqueness is still an HTML validity concern worth a source guard.

**What breaks at each of the three call sites:**
1. **Recent PRs** (`overview.ts` `buildRecentPrsCard`): loses its lighter meta line (drops from
   "date · distance" to "date · distance · duration · pace") — this is D-07's explicit,
   intentional trade (duration/pace are "additions, not omissions").
2. **Recent Activities** (`overview.ts` `buildRecentActivitiesCard`): unchanged — already calls
   `renderActivityRow` (`overview.ts:207`, `import { renderActivityRow, ... } from './list.js'` at
   line 15). This call site requires NO code change for OVR-02's "same structure" once the CSS
   hierarchy (D-06) changes, because it already shares the function.
3. **Activities mobile card** (`list.ts` `buildMobileCardList` → `renderActivityRow`): visually
   changes shape under D-06's two-line hierarchy (name + right-aligned badges / meta beneath) —
   this is the surface Phase 19's criterion 4 was protecting during a styling-only phase, and now
   gets its structural rework. `20-VALIDATION.md` R26's fixture-badge precedent (see FIX-01
   section below) is the template for how to get a badge-carrying row into view for a checkpoint.

**Retire vs. keep:** `recentPrBadgeText` and `recentPrRowAriaLabel` (`overview.ts:83-105`) become
dead code once `buildRecentPrsCard` calls `renderActivityRow` directly. CONTEXT.md's Claude's
Discretion list explicitly defers "retire, re-point, or keep as thin wrappers" — `overview.test.ts`
currently imports and tests both (`overview.test.ts:2`), so removing them requires also removing
or repointing those tests. **Recommendation for the planner:** retire both functions and their
tests outright — they have no remaining call site once D-05 lands, and keeping dead exports around
as "thin wrappers" for functions nothing calls contradicts the "collapses the duplicated
accessible-name builders" rationale D-05 itself gives.

## CSS for the Two-Line Hierarchy (research_focus item 2)

### Current full `.activity-row` and related rule set (styles.css, read directly)

```css
/* styles.css:329-367 */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);              /* 8px — cited by Phase 20 D-11 as the focus-ring clearance */
}

.activity-row {
  display: flex;                     /* load-bearing: overrides anchor's default `inline` */
  flex-direction: row;
  flex-wrap: wrap;                   /* THIS is what produces "three stacked divs" at narrow widths */
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;                /* NOTE: hardcoded 8px, not var(--radius-panel) — pre-dates the token */
  padding: var(--space-md);          /* 16px */
}

.activity-row__name {
  font-size: 16px;
  font-weight: 400;
  color: var(--text);
}

.activity-row__meta {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-secondary);
}

.badge {
  font-size: 14px;
  font-weight: 400;
  padding-inline: var(--space-xs);
  border-radius: 4px;
  border: 1px solid var(--border);
  color: var(--text-secondary);
}
```

Plus, from the Phase 20 banner block (`styles.css:1539-1548`):
```css
.activity-row {
  text-decoration: none;             /* the whole-row link is not a text link */
}
.activity-row:hover {
  background: color-mix(in srgb, var(--surface) 92%, var(--text));
}
```

### What must change (D-06, D-08)

D-08 is explicit: the bordered-card treatment (`background`, `border`, `border-radius`, `padding`,
the 8px `.activity-list` gap) is **unchanged** — only the internal layout of a row's children
changes. The current `.activity-row { display: flex; flex-direction: row; flex-wrap: wrap; }`
places `.activity-row__name`, `.activity-row__meta`, and every `.badge` span as flat siblings that
wrap onto new lines unpredictably at narrow widths — this is the literal mechanism producing "three
stacked divs."

**No grid and no media query is required** to achieve D-06's shape:
```
┌─ .activity-row ───────────────────────────────┐
│ Morning Run in Herlev          [No HR] [2 PR] │   <- row 1: name (grow) + badges (right, no-wrap)
│ 12 Aug 2026 · 10.4 km · 52:31 · 5:03 /km      │   <- row 2: meta, full width, wraps if it must
└───────────────────────────────────────────────┘
```
This is achievable by changing `.activity-row` to `flex-direction: column` (stacking two rows: a
header row and the meta line) and wrapping `.activity-row__name` + the badges in a NEW header-row
wrapper with `display: flex; justify-content: space-between; align-items: baseline;` (or similar)
and `flex-wrap: nowrap` on that header row so badges never wrap into the meta line — satisfying
"badges pushed right and never wrapping into the metrics." `.activity-row__meta` stays as a
second full-width child; it may itself wrap at narrow widths (this is acceptable and is the
"degrades to narrow widths without a media query" requirement — text wrapping is not a media
query). The badges themselves should sit in their own flex container with `flex-shrink: 0` or
similar so a long activity name truncates/wraps around them rather than pushing them off-row.

**Existing type-role classes to reuse (18-UI-SPEC § 17 — no new type role permitted):**
`.activity-row__name` and `.activity-row__meta` are frozen class names per CONTEXT.md's
canonical_refs ("existing class contracts are frozen"). New sub-element wrapper classes (e.g. a
header-row wrapper) are Claude's Discretion territory — CONTEXT.md explicitly delegates "the exact
flex/grid mechanics ... and the class names for any new sub-elements." **Recommendation:** a new
wrapper class following the existing BEM-ish naming (`.activity-row__header` or
`.activity-row__badges`) is safe; it must NOT redeclare `display: flex` on `.activity-row` itself
(already declared, load-bearing per the existing comment) and must land in the Phase 21
banner-commented block at the end of `styles.css`, matching the precedent every prior phase
(17/18/19/20) set of appending a phase-scoped, banner-commented block with a stated class
contract rather than editing existing rules in place.

**Badge container note:** today badges are appended directly as siblings of `.activity-row__name`
and `.activity-row__meta` (both `renderRecentPrRow` and `renderActivityRow` `appendChild` badge
spans straight onto `rowEl`). A wrapper element for "name + badges" as one flex row means either
(a) restructuring the DOM to nest name+badges inside a new wrapper div, or (b) using CSS `order`/
`flex-wrap` tricks to visually group siblings without a DOM wrapper. Given `.badge` and
`.activity-row__name` are currently flat siblings and `flex-wrap: wrap` currently governs their
layout, a DOM-level wrapper (option a) is the more robust, less-magic approach and matches how
CSS Flexbox two-line card layouts are conventionally built. This is Claude's Discretion territory
per CONTEXT.md.

## Records Scope Toggle (research_focus item 3)

### `buildPrTablesSection` structure and data flow (records.ts:567-592, records-logic.ts, read directly)

```typescript
// records.ts:567-592
function buildPrTablesSection(
  bestEfforts: BestEffortsDocument,
  ageGrading: AgeGradingDocument | null,
  exclusionReasons: ReadonlyMap<string, string>
): HTMLElement {
  const section = document.createElement('section');
  section.id = 'records-pr-tables';
  // heading "PR Tables" ...
  for (const distance of TARGET_ORDER) {                          // 7 distances
    const entries = bestEfforts.rankings[distance];                // PRRankingEntry[]
    const empty = isEmptyRanking(entries);
    const rows = buildPrTableRows(entries, ageGrading, distance, exclusionReasons);
    section.appendChild(buildPrTableSection(distance, rows, empty));
  }
  return section;
}
```

`bestEfforts` is fetched once in `load()` (`records.ts:892`, `fetchStatsJson<BestEffortsDocument>`
against `best-efforts.json`, the whole 2.8 MB file — confirmed already fully loaded, per
CONTEXT.md D-01's claim). `PRRankingEntry` (`best-effort.types.ts:127-134`) carries `startDate:
string` — confirmed present, no pipeline change needed.

### Where the year filter + re-rank slots in

`buildPrTableRows` (`records-logic.ts:101-136`) is the existing entry→row mapper; it does NOT
filter or re-rank — it maps 1:1, preserving `entry.rank` from the source data (already computed at
build time, all-time). A year-scoped variant needs a NEW pure function, e.g.
`filterRankingsToYear(entries, year)`, that:
1. Filters `entries` to those whose `startDate` (Z-suffix-normalized) falls in `year`.
2. Re-ranks 1..N within the filtered subset (Claude's Discretion default per CONTEXT.md — "a
   'This year's records' table showing ranks 4, 9, 17 would be incoherent").

This should be a new export in `records-logic.ts`, called from `records.ts` BEFORE
`buildPrTableRows`, or the re-ranking could be folded into a variant call path. Because
`buildPrTableRows`'s output `PrTableRow.rank` comes straight from `entry.rank`
(`records-logic.ts:124`), re-ranking within a year must either (a) rewrite `entry.rank` on the
filtered subset before calling `buildPrTableRows`, or (b) have `buildPrTableRows` accept an
already-filtered-and-reordered `entries` array and derive `rank` from array position rather than
`entry.rank` when in year-scope mode. Option (a) — filter, then reassign sequential ranks on the
filtered array, then pass to the EXISTING `buildPrTableRows` unchanged — is simpler and reuses
more code; this is the recommended shape but is Claude's Discretion (the exact function signature
and split between `records.ts`/`records-logic.ts` is not locked by CONTEXT.md).

**Empty state for a distance with zero year-scoped rows:** `isEmptyRanking` (`records-logic.ts:143-
145`) already tests `!entries || entries.length === 0` — this works unchanged on a filtered
(possibly empty) array. `buildPrTableEmptyState()` (`records.ts:324-340`) is the reused empty
state per Claude's Discretion default, though its copy ("No marathon efforts yet" / "The archive
has no completed marathon-distance run") is marathon-specific hardcoded text (not parameterized
per distance!) — **planner note:** this function's hardcoded text is a PRE-EXISTING issue outside
this phase's scope (it's called for EVERY empty distance today, not just marathon — check
`buildPrTableSection` line 549-551), so a distance with zero rows this year would show the SAME
"No marathon efforts yet" text regardless of which distance is actually empty. This is a latent
copy bug already present in the all-time view; the planner should decide whether year-scoping
makes this pre-existing bug MORE visible (more distances will realistically hit zero-rows-this-
year than hit zero-rows-all-time) and if so, whether it's in scope to fix. CONTEXT.md's Claude's
Discretion explicitly names reusing `buildPrTableEmptyState` as the default, so fixing the
hardcoded text is not mandated, but the planner should flag this as a discovered issue.

### `.segmented` reference — see Pattern 2 above for exact markup/behaviour contract.

### View-local state idiom — see Pattern 2 above (`detail-charts.ts`'s `xAxisMode` closure
variable and `list.ts`'s `panelOpen` boolean are the two established precedents).

## This-Year Figures in Headline Stats (research_focus item 4)

### `buildHeadlineStatsCard`'s current inputs (overview.ts:143-165, read directly)

```typescript
function buildHeadlineStatsCard(totals: AllTimeTotals | null, streaks: StreaksStats | null): HTMLElement {
  // ... 6 tiles: Total Distance, Total Runs, Total Hours, Total Elevation,
  //              Current Streak, Longest Streak
}
```
`totals: AllTimeTotals` (`overview.ts:23-32`) has `totalKm`, `totalRuns`, `totalHours`,
`totalElevation`, `avgPaceMinPerKm`, `firstActivityDate`, `lastActivityDate`, `generatedAt` — NO
year-scoped fields. `streaks: StreaksStats` likewise has no year data.

### Is year-scoped data derivable from already-loaded data, or does it need a new fetch?

**A new fetch, but zero pipeline work.** `data/stats/yearly-stats.json` already exists, is already
published (`build-widgets.mjs`'s `copyDataFiles` copies the whole `data/stats` directory
verbatim), and is already fetched by `trends.ts:1167` using the identical `fetchStatsJson` idiom.
Confirmed shape from `compute-stats.ts:224-240` (the generator, read directly):
```typescript
interface PeriodStats /* one entry per year in yearly-stats.json's array */ {
  periodStart: string;       // ISO instant, year-start
  periodLabel: string;       // e.g. "2026" — the YEAR AS A STRING, not a number
  totalKm: number;
  runCount: number;
  avgPaceMinPerKm: number;
  elevationGain: number;
  totalMovingTimeMin: number;  // minutes — OVR-04 needs this /60 for hours
}
```
`yearly-stats.json` is a flat JSON array of these objects, one per year present in the archive,
sorted ascending by `periodStart`. `overview.ts` needs one more `fetchStatsJson<PeriodStats[]>`
call (or a locally-defined equivalent interface — `overview.ts` does not currently import from
`trends.ts` or a shared types file for this shape; the planner should decide whether to import
`trends.ts`'s type or define a local structural-equivalent interface, matching the existing
pattern where `overview.ts` and `records.ts` each define their own local `AllTimeTotals`/
`StreaksStats` interfaces rather than sharing one).

### "This year" resolution (D-11)

Per D-11: resolve `new Date().getUTCFullYear()` (client clock, UTC — consistent with this
codebase's UTC-everywhere date discipline) and find the `yearly-stats.json` entry whose
`periodLabel === String(currentYear)`. If no match (1 January before the nightly rebuild has run),
degrade to the existing em-dash placeholder (`'—'`), the same pattern every other stat card cell
already uses when its source data is `null`.

### Number formatting (Claude's Discretion, matching card's existing conventions)

From `buildHeadlineStatsCard`'s existing tiles: `totalKm.toFixed(1)` (one decimal, e.g. "1234.5
km"), `Math.round(totalHours)` (whole hours), `Math.round(totalElevation)` (whole metres). The two
new tiles should match: `entry.totalKm.toFixed(1)` for distance, and
`Math.round(entry.totalMovingTimeMin / 60)` for hours (converting minutes → hours, matching the
existing "Total Hours" tile's whole-number convention — note `AllTimeTotals.totalHours` is already
pre-computed in hours by the all-time pipeline, whereas `yearly-stats.json`'s
`totalMovingTimeMin` is in MINUTES, so the `/60` conversion is new arithmetic in the view, not a
pipeline change).

### Grid placement (D-09)

`.stat-grid` (`styles.css:321-325`) is `display: grid; grid-template-columns: repeat(auto-fit,
minmax(200px, 1fr)); gap: var(--space-lg);` — a pure CSS auto-fit grid with NO fixed column count.
Appending 2 more `buildStatCard(...)` calls to the existing 6 (going 6→8, per D-09) requires **zero
CSS change** — the grid absorbs new children automatically. This is the "grid gap already applies"
claim in D-09 confirmed directly from source.

## FIX-01 Ended Streak (research_focus item 5)

### The two-layer bug, confirmed by direct read

**Layer 1** — `streak-utils.ts:114-121` (the actual return statement, read directly):
```typescript
return {
  currentStreak: finalCurrentStreak,
  longestStreak,
  withinCurrentStreak,
  currentStreakStart: withinCurrentStreak ? currentStreakStart : null,   // <- line 118, nulled when ended
  longestStreakStart,
  longestStreakEnd,
};
```
When a streak has ended (`withinCurrentStreak === false`), `currentStreakStart` is deliberately set
to `null` — so the ONE field that theoretically carries date information for an ended streak is
gone by the time it leaves this function.

**Layer 2** (previously unrecorded, confirmed by direct read) — `records-logic.ts:268-282`
(`selectCurrentStreak`, the function `records.ts`'s Superlatives section calls via
`selectSuperlatives`):
```typescript
function selectCurrentStreak(raw: unknown): { days: number; active: boolean; endedISO: string | null } | null {
  // ...
  const { currentStreak, withinCurrentStreak, currentStreakStart } = raw;
  // ...
  const active = withinCurrentStreak;
  const endedISO =
    !active && typeof currentStreakStart === 'string' && currentStreakStart.length > 0
      ? currentStreakStart          // <- reads currentStreakStart, NOT an "end" field — even if
      : null;                       //    Layer 1 were fixed to populate currentStreakStart for
                                     //    an ended streak, this would label the streak's START
                                     //    date "ended", not its actual last-run day.
  return { days: currentStreak, active, endedISO };
}
```
This confirms D-12's claim precisely: even a naive fix to Layer 1 (e.g., always populating
`currentStreakStart` regardless of `withinCurrentStreak`) would make Layer 2 render the streak's
**start** date under the "ended" label — a confidently wrong date that would pass a
does-it-render checkpoint.

### What `records.ts:298-299` currently does with the sub-label (confirmed exact lines)

```typescript
// records.ts:291-303 (buildSuperlativesSection, Current Streak tile)
grid.appendChild(
  buildSuperlativeTile(
    currentStreak ? `${currentStreak.days} days` : '—',
    'Current Streak',
    currentStreak
      ? currentStreak.active
        ? 'active'
        : currentStreak.endedISO
          ? `ended ${formatActivityDate(currentStreak.endedISO)}`     // <- THE sub-label, already coded
          : undefined
      : undefined
  )
);
```
The Records tile's rendering logic for the sub-label ALREADY EXISTS and is correct — it is
`currentStreak.endedISO` (from `selectCurrentStreak`) that is always `null` today because Layer 1
never lets a non-null `currentStreakStart` reach `selectCurrentStreak` for an ended streak. Fixing
both layers correctly (populate `currentStreakEnd` distinctly at Layer 1, read it at Layer 2)
makes this ALREADY-WRITTEN line render correctly with no further `records.ts` DOM change needed
for the Records screen half of FIX-01.

### The data-model change (D-13)

**`StreakResult`** (`streak-utils.ts:11-18`) gains one field:
```typescript
export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  withinCurrentStreak: boolean;
  currentStreakStart: Date | null;
  currentStreakEnd: Date | null;      // NEW — the streak's last run day, set REGARDLESS of active/ended
  longestStreakStart: Date | null;
  longestStreakEnd: Date | null;
}
```
Per D-13, this is "the last day a run happened during that streak" — i.e. `lastActivityDate` /
`sortedDates[sortedDates.length - 1]` (already computed at `streak-utils.ts:106` as a local
variable `lastActivityDate`, currently discarded after computing `daysSinceLastActivity` and
`withinCurrentStreak`). **This is a one-line addition**: expose the existing local
`lastActivityDate` variable as `currentStreakEnd` in the return object, set UNCONDITIONALLY (not
gated on `withinCurrentStreak` like `currentStreakStart` is) — this matches the Longest Streak
tile's `endISO` precedent (`longestStreakEnd` is set unconditionally too, `streak-utils.ts:120`).

**`StreakData`** (`src/types/analytics.types.ts:79-93`) needs the parallel field
`currentStreakEnd: string` added, and **`compute-advanced-stats.ts:211-223`** (the serialization
site, read directly) needs one more line analogous to the existing
`longestStreakStart: dailyStreaks.longestStreakStart ? dailyStreaks.longestStreakStart.toISOString() : ''`
pattern:
```typescript
currentStreakEnd: dailyStreaks.currentStreakEnd
  ? dailyStreaks.currentStreakEnd.toISOString()
  : '',
```
This writes to `data/stats/streaks.json` the next time `npm run compute-advanced-stats` (or the
umbrella `compute-all-stats`) runs — confirmed the write site is `compute-advanced-stats.ts:255`
(`path.join(statsDir, 'streaks.json')`).

**`selectCurrentStreak`** (`records-logic.ts:268-282`) changes to read `currentStreakEnd` (a NEW
field on the raw JSON, camelCase, string ISO or empty string) instead of misreading
`currentStreakStart`:
```typescript
const { currentStreak, withinCurrentStreak, currentStreakEnd } = raw;   // was: currentStreakStart
// ...
const endedISO =
  !active && typeof currentStreakEnd === 'string' && currentStreakEnd.length > 0
    ? currentStreakEnd
    : null;
```

**`overview.ts`'s `StreaksStats` interface** (`overview.ts:34-43`) needs `currentStreakEnd: string
| null` added to mirror the new field, for D-15's Overview sub-label.

**Degrade path (D-13's explicit warning):** the new field is ABSENT from `streaks.json` until a
compute run regenerates it. `selectCurrentStreak`'s existing total/tolerant parsing style
(`hasOwn(raw, 'currentStreak')` etc., returns `null` for the whole tile only on missing REQUIRED
fields) already handles a missing `currentStreakEnd` gracefully: `typeof currentStreakEnd ===
'string'` is `false` when the field is absent (`undefined`), so `endedISO` naturally stays `null`
— the sub-label simply doesn't render, which is the correct degrade. **No special-case code is
needed for this — it falls out of the existing type-guard style for free**, provided the planner
does NOT change `hasOwn(raw, 'currentStreak') || hasOwn(raw, 'withinCurrentStreak')`'s required-
field list to include `currentStreakEnd` (which would make the WHOLE tile disappear when only the
sub-label data is missing — a regression, since `currentStreak`/`withinCurrentStreak`/`longestStreak`
etc. must keep rendering even before a compute run adds the new field).

### D-14 — the big number stays `0 days` (already correct, no change needed)

`finalCurrentStreak` is already forced to `0` when `!withinCurrentStreak`
(`streak-utils.ts:112,115`) — this is pre-existing, correct behavior per T-18-HONEST-05. No code
change is implicated by D-14; it's a confirmation that the existing zero-rendering behavior stays
as-is while the sub-label gets added beside it.

### D-15 — `buildStatCard` gains the optional sub-label (Overview)

`overview.ts`'s `buildStatCard(value, label)` (`:45-56`) currently takes exactly 2 params and
builds exactly 2 child divs (`.text-display` value, `.text-label` label). `records.ts`'s
`buildSuperlativeTile(value, label, sublabel?)` (`:224-245`) is the proven 3-line shape (optional
third `.text-label` div, only appended `if (sublabel)`). Porting this optional-third-param shape
onto `buildStatCard` is a small, mechanical change — copy the `if (sublabel)` block. The Overview
Current Streak tile's call site becomes something like:
```typescript
buildStatCard(
  streaks ? `${streaks.currentStreak} days` : '—',
  'Current Streak',
  streaks && !streaks.withinCurrentStreak && streaks.currentStreakEnd
    ? `ended ${formatActivityDate(streaks.currentStreakEnd)}`
    : undefined
)
```
mirroring `records.ts`'s exact conditional structure (though Overview's `StreaksStats` is a raw
JSON-shaped interface, not the `selectCurrentStreak`-derived `{ days, active, endedISO }` shape —
`records.ts` and `overview.ts` currently maintain SEPARATE local type definitions for the same
`streaks.json` file, so this logic must be written twice, once per view, matching the existing
duplication pattern rather than introducing a new shared import).

### D-16 — producing the ended state for the checkpoint (staged-build fixture, confirmed precedent)

Plan 20-18 established the exact precedent (confirmed via direct read of
`20-18-PLAN.md`'s automated gate script): edit ONLY the staged build's copy of a data file — never
the repository's `data/` copy — verify via an inline Node script that (a) the staged file has the
edit, (b) the repository's `data/` copy does NOT have the edit
(`git status --porcelain src scripts data` must be empty), then let the next `npm run
build-widgets` overwrite the staged edit.

**For FIX-01, the exact file to edit is `dist/widgets/data/stats/streaks.json`** (confirmed via
`build-widgets.mjs:139`, `{ src: 'data/stats', dest: 'dist/widgets/data/stats' }`) — the staged-
build sibling of the badge-fixture precedent's `dist/widgets/data/dashboard/index.json`. The
edit needed: `withinCurrentStreak: false`, `currentStreak: 0`, `currentStreakEnd` set to some
recent-past ISO string (per D-16, verbatim from CONTEXT.md: "edit the staged build's
`data/stats/streaks.json` — `withinCurrentStreak: false`, `currentStreak: 0`, `currentStreakEnd`
set — observe both tiles, then let the next `npm run build-widgets` overwrite it"). The live
archive's real `streaks.json` today has `withinCurrentStreak: true, currentStreak: 2` (per D-16's
own text), so this branch is genuinely unreachable against organic data — the fixture is required,
not optional, to exercise FIX-01's checkpoint row at all.

**Verification must assert the DATE'S VALUE, not just presence** — per CONTEXT.md's `<specifics>`:
"A plan that fixes only `streak-utils.ts:118` will render a wrong date with full confidence... The
checkpoint row must assert the date's value, not just its presence." The checkpoint script should
set `currentStreakEnd` to a KNOWN, DISTINCT value (different from whatever `currentStreakStart`
would have been in the old buggy code path, if the developer wants to positively distinguish the
two) and the checkpoint row must have the human/agent read back the exact rendered date string and
compare it against the fixture's injected value — not merely confirm "a sub-label appeared."

## Common Pitfalls

### Pitfall 1: Fixing only `streak-utils.ts:118` (Layer 1) and declaring FIX-01 done
**What goes wrong:** The sub-label renders — non-null, looks plausible — but names the streak's
**start** date, not its end date, because `records-logic.ts:274-282`'s `endedISO` derivation reads
whatever field Layer 1 populates and the current code reads `currentStreakStart` by name.
**Why it happens:** `records-logic.ts:274-282` was never audited against FIX-01's requirement text
before now — it's `20-VALIDATION.md`/`REQUIREMENTS.md`'s cited root cause (`streak-utils.ts:118`)
that gets fixed, and a checkpoint that only checks "does a sub-label render" (not "is the date
correct") would pass a wrong fix.
**How to avoid:** Fix both layers in the same plan/task, and make the checkpoint assert the exact
date string against the fixture's known injected value.
**Warning signs:** A plan whose task list only touches `streak-utils.ts` and `streaks.json`'s
schema, with no line-item for `records-logic.ts`'s `selectCurrentStreak`.

### Pitfall 2: `idPrefix` collision when Recent PRs and Recent Activities share a row
**What goes wrong:** If an activity with `prCount > 0` and `lowConfidence === true` appears in
BOTH the Recent PRs card (top 5 PR-carrying rows) and the Recent Activities card (top 10 rows) on
the same Overview page render, and both cards call `renderActivityRow` with the same hardcoded
`` `activity-card-${row.id}` `` prefix, two elements with the identical `id` (the
`.sr-only` description span) exist in the DOM simultaneously — invalid HTML, and
`aria-describedby` resolution becomes technically ambiguous (though in practice most browsers
resolve to the first matching id).
**Why it happens:** `renderActivityRow`'s current `idPrefix` scheme was designed for "one row,
rendered once, in one of two mutually-exclusive CSS-hidden layouts" (desktop table vs. mobile
card) — not for "the same row rendered in two SIMULTANEOUSLY VISIBLE cards on the same page,"
which is new to this phase.
**How to avoid:** Extend the `idPrefix` scheme with a third distinguishing value (e.g.
`` `overview-prs-${row.id}` `` vs `` `overview-activities-${row.id}` ``) at the two Overview call
sites, following the existing two-prefix precedent (`'activity-card-'` vs `'activity-table-'`).
**Warning signs:** `row-semantics.test.ts` or a new equivalent guard should assert `idPrefix`
uniqueness across simultaneously-callable call sites — check whether `row-semantics.test.ts`
already has an assertion of this shape before assuming it's untested territory.

### Pitfall 3: `buildPrTableEmptyState`'s hardcoded marathon-specific copy under year-scoping
**What goes wrong:** Every distance's empty state (not just marathon) already renders "No marathon
efforts yet" today (a pre-existing, out-of-phase-scope defect confirmed by reading
`buildPrTableSection`'s call site, which passes no distance-specific text to
`buildPrTableEmptyState()`). Year-scoping makes MORE distances hit this path (a distance with PRs
all-time may have zero PRs in a specific year), surfacing the wrong copy more often.
**Why it happens:** `buildPrTableEmptyState` was written when only marathon (the one genuinely
sparse distance) could realistically be empty; year-scoping breaks that assumption.
**How to avoid:** Not mandated by CONTEXT.md (Claude's Discretion explicitly names reusing this
function as the default) — but the planner should flag it explicitly as a known, accepted
limitation in the plan rather than let a later reviewer discover unexpected marathon-copy on a 5K
table.
**Warning signs:** A checkpoint row exercising the year scope on a non-marathon, non-empty-all-
time distance that happens to have zero year-scoped rows.

### Pitfall 4: Serving the checkpoint from `localhost:8099` instead of `127.0.0.1`
**What goes wrong:** Stale `index.html`/data files get served, the ended-streak fixture edit
appears invisible, and the checkpoint would (incorrectly) record the ACTIVE-streak path as if it
were the ended-streak path.
**Why it happens:** Documented, recurring project landmine (per user's own memory note
`staged-build-browser-cache-trap` and CONTEXT.md D-16's explicit "Known trap" callout) — this
project's checkpoints have served stale `localhost:8099` content before.
**How to avoid:** Serve and browse via `127.0.0.1:8099` (or whatever port), never `localhost`, for
this phase's human checkpoint — matches plan 20-20's precedent ("serving from 127.0.0.1 against a
bundle proven to be the one on disk").
**Warning signs:** Any checkpoint step that says "confirm you're on `/strava-widgets`" without ALSO
confirming the host is `127.0.0.1`.

## Code Examples

### Extending `buildStatCard` with an optional sub-label (mirrors `buildSuperlativeTile`)

```typescript
// Pattern source: src/dashboard/views/records.ts:224-245 (read directly) — port this shape onto
// overview.ts's buildStatCard(value, label) -> buildStatCard(value, label, sublabel?)
function buildStatCard(value: string, label: string, sublabel?: string): HTMLElement {
  const wrapper = document.createElement('div');
  const valueEl = document.createElement('div');
  valueEl.className = 'text-display';
  valueEl.textContent = value;
  const labelEl = document.createElement('div');
  labelEl.className = 'text-label';
  labelEl.textContent = label;
  wrapper.appendChild(valueEl);
  wrapper.appendChild(labelEl);
  if (sublabel) {
    const subEl = document.createElement('div');
    subEl.className = 'text-label';
    subEl.textContent = sublabel;
    wrapper.appendChild(subEl);
  }
  return wrapper;
}
```

### `streak-utils.ts`'s existing `lastActivityDate` local — already computed, just needs exposing

```typescript
// src/analytics/streak-utils.ts:105-121 (read directly) — the local variable `lastActivityDate`
// already IS the value D-13 wants as `currentStreakEnd`; it is computed unconditionally (line 106)
// but only used to derive `daysSinceLastActivity`/`withinCurrentStreak`, then discarded.
const lastActivityDate = sortedDates[sortedDates.length - 1];
const today = normalizeToUTCMidnight(new Date());
const daysSinceLastActivity = Math.round((today.getTime() - lastActivityDate.getTime()) / MS_PER_DAY);
const withinCurrentStreak = daysSinceLastActivity <= 1;
const finalCurrentStreak = withinCurrentStreak ? currentStreak : 0;

return {
  currentStreak: finalCurrentStreak,
  longestStreak,
  withinCurrentStreak,
  currentStreakStart: withinCurrentStreak ? currentStreakStart : null,
  currentStreakEnd: lastActivityDate,           // NEW — set unconditionally, unlike currentStreakStart
  longestStreakStart,
  longestStreakEnd,
};
```

## State of the Art

Not applicable in the conventional sense (no external library to check for updates) — but noting
one internal precedent shift: Phase 20's D-13/D-16/D-17 (real per-cell anchors on Records tables,
replacing the earlier "row click only, no anchor" model) is the MOST RECENT interaction pattern in
this codebase and should be treated as the current baseline, not the earlier Phase 17/18 row
patterns some older comments in `records.ts` still reference historically.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| Records PR-table cells had no anchors; row-click-only navigation | Every content-carrying cell wraps a real `<a>` (`buildCellLink`), `tabIndex=-1`, click-guarded via the shared `shouldNavigateOnRowClick` predicate | Phase 20, plans 20-16/20-17/20-19 | Any NEW cell this phase might add to a Records table (unlikely, but relevant if the scope-control interacts with table markup) must follow `buildCellLink`'s pattern, not a bare `<td>` |
| Two separate aria-label composers for row badges | `composeRowAriaLabel` as the single shared composer | Phase 20, plan 20-07 (CR-02 fix) | The shared row renderer must call `composeRowAriaLabel`, not reinvent string concatenation |

**Deprecated/outdated in the context of this phase:**
- `renderRecentPrRow`, `recentPrBadgeText`, `recentPrRowAriaLabel` (`overview.ts:83-141`) — all
  three become dead code once D-05 lands; do not extend or "fix" them, retire them.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended: retire `renderRecentPrRow`/`recentPrBadgeText`/`recentPrRowAriaLabel` outright rather than keeping thin wrappers | Shared Row Renderer | Low — CONTEXT.md leaves this as Claude's Discretion; if the planner disagrees, dead code lingers but nothing breaks |
| A2 | Recommended: a DOM-level wrapper element for "name + badges" as one flex row, rather than a CSS-only grouping trick | CSS Two-Line Hierarchy | Low — CONTEXT.md explicitly delegates the exact mechanics; a CSS-only alternative (e.g. `order`) could also satisfy D-06 if the planner prefers fewer DOM nodes |
| A3 | Recommended: filter-then-reassign-sequential-`rank` as the year re-rank mechanism, feeding the existing unchanged `buildPrTableRows` | Records Scope Toggle | Low — an alternative split (parameterizing `buildPrTableRows` itself) is equally valid; this is an implementation-shape suggestion, not a locked fact |
| A4 | Recommended: `overview.ts` defines its own local structural-equivalent interface for `yearly-stats.json` entries, rather than importing `trends.ts`'s type | This-Year Headline Stats | Low — matches the existing duplication pattern (`AllTimeTotals`/`StreaksStats` are already locally duplicated, not shared), but a shared type could also be introduced; not locked by CONTEXT.md |
| A5 | Recommended: extend `renderActivityRow`'s `idPrefix` scheme with a third value for the Overview Recent-PRs/Recent-Activities collision case (Pitfall 2) | Shared Row Renderer | Medium — if the planner does not address this, a genuine (if rare) invalid-HTML duplicate-id case ships; worth an explicit task/checkpoint row even if low-frequency in the live archive |

**All claims above are recommendations/implementation-shape suggestions marked as such, not
factual assertions requiring user confirmation** — every FACTUAL claim in this document (file
contents, line numbers, function signatures, data shapes) was confirmed by direct `Read`/`grep` of
the live source tree in this session, not from training data, and is therefore not entered in this
table. This document contains no `[ASSUMED]`-tagged claims in the source-provenance sense the GSD
process defines (no external package names, no unverified library capabilities) — the table above
exists only to flag DESIGN recommendations that remain Claude's Discretion per CONTEXT.md, not
verification gaps.

## Open Questions

1. **Does a row genuinely appear in both Recent PRs and Recent Activities simultaneously in the
   live archive today, making Pitfall 2's `idPrefix` collision observable rather than theoretical?**
   - What we know: Recent PRs = up to 5 most recent PR-carrying rows; Recent Activities = up to 10
     most recent rows overall. A PR-carrying activity within the most recent 10 activities would
     appear in both.
   - What's unclear: without running the actual archive data through both filters, whether this
     is a common case (worth a proper `idPrefix` scoping fix) or a rare edge case (worth a source
     comment and lighter-weight scoping).
   - Recommendation: the planner should have the executor check this empirically against
     `data/dashboard/index.json` (quick grep/jq on `prCount > 0` within the top 10 by date) rather
     than guess; regardless of frequency, the `idPrefix` fix is cheap enough to just do.

2. **Should the Overview and Records `streaks.json` type definitions be unified into one shared
   interface, now that both need the new `currentStreakEnd` field?**
   - What we know: today `overview.ts` and `records.ts`/`records-logic.ts` each define their own
     local interface for the same file, and CONTEXT.md's Claude's Discretion list does not mention
     this consolidation question at all (it only discusses unifying `buildStatCard`/
     `buildSuperlativeTile`, explicitly declined for this phase by D-15).
   - What's unclear: whether adding a field to two independently-maintained interfaces is
     acceptable duplication (matching the existing pattern) or worth flagging as tech debt.
   - Recommendation: keep the duplication (matches existing precedent, smallest diff), but the
     planner may note it as a candidate for a future cleanup phase.

## Environment Availability

Skipped — this phase has no external dependencies beyond what is already installed and proven
working in this repository (Node/npm/vitest/tsc, all confirmed present and used by every prior
phase's automated gate). No new CLI tool, service, or runtime is introduced.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (`vitest.config.ts`, confirmed via `package.json` and direct read) |
| Config file | `/Users/pedf/workspace/strava-widgets/vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts']`, **no jsdom** |
| Quick run command | `npm test` (= `vitest run`, full suite — this repo has no configured watch-mode subset flag; use `npx vitest run src/analytics/streak-utils.test.ts` etc. for a single-file quick run) |
| Full suite command | `npm test` |

**Critical constraint, stated explicitly per REQUIREMENTS.md's own Verification Note:** there is
NO jsdom and NO headless browser anywhere in this repository. Every requirement in this milestone
(v2.1) is visual or interactive. **No success criterion in this phase can be discharged by `npm
test` alone** — the human browser checkpoint (Success Criterion 6) is load-bearing and mandatory,
not a formality. This has bitten the project three times already (Phase 16's black page, Phase
17's two rendering gaps, Phase 18's near-miss), all behind a fully green automated gate.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OVR-01 | `renderActivityRow`/shared renderer produces correct name/date/distance/badge TEXT CONTENT and correct `aria-label` STRING | unit (text/string assertion only — NOT visual layout) | `npx vitest run src/dashboard/views/list.test.ts src/dashboard/views/overview.test.ts` | ✅ (both exist; `overview.test.ts` needs new/repointed assertions once `recentPrRowAriaLabel` retires) |
| OVR-01 | Two-line visual hierarchy actually renders correctly, badges don't wrap into meta, degrades at narrow widths | manual-only (browser checkpoint) | — | N/A — no jsdom, cannot be automated |
| OVR-02 | Recent Activities rows share structure/linking with Recent PRs | unit (source-identity: both call sites invoke the same function) + manual (visual) | `npx vitest run src/dashboard/views/list.test.ts` (or a new `row-semantics.test.ts` assertion that both call sites import/call the same function) | ✅ `row-semantics.test.ts` exists; extend it |
| OVR-03 | Year filter + re-rank produces correct `PrTableRow[]` (correct subset, correct 1..N ranks) | unit | `npx vitest run src/dashboard/views/records-logic.test.ts` | ✅ exists; needs new `describe` block for the new filter/re-rank function |
| OVR-03 | `.segmented` scope control renders, toggles, and visibly re-renders the correct table data in a real browser | manual-only (browser checkpoint) | — | N/A |
| OVR-04 | This-year tile values are correctly computed/formatted from a given `yearly-stats.json` entry, and correctly degrade to em-dash when absent | unit | `npx vitest run src/dashboard/views/overview.test.ts` | ✅ exists; needs new `describe` block |
| OVR-04 | Two new tiles visually appear in the `.stat-grid`, correctly positioned, both themes | manual-only (browser checkpoint) | — | N/A |
| FIX-01 | `calculateDailyStreaks` returns the correct `currentStreakEnd` value in every input scenario (active streak, ended streak, empty array) | unit | `npx vitest run src/analytics/streak-utils.test.ts` | ✅ exists; needs new assertions per existing `describe('calculateDailyStreaks')` block's scenario style |
| FIX-01 | `selectCurrentStreak` reads `currentStreakEnd` (not `currentStreakStart`) for `endedISO`, and degrades gracefully when the field is absent | unit | `npx vitest run src/dashboard/views/records-logic.test.ts` | ✅ exists; needs new `describe('selectCurrentStreak')` cases |
| FIX-01 | The `ended {date}` sub-label renders the CORRECT date value (not just "a" date) on both Records and Overview, against a fixture with a genuinely-ended streak | manual-only (browser checkpoint, fixture-gated) | — | N/A — requires the staged-build `streaks.json` fixture edit (D-16); cannot be automated in this repo |

### Sampling Rate

- **Per task commit:** `npx vitest run <touched-test-file>` (fast, single-file)
- **Per wave merge:** `npm test` (full suite, 900+ tests as of Phase 20's close) + `npx tsc
  --noEmit` + `npm run build-widgets` (per the established 4-command gate every prior phase used)
- **Phase gate:** Full suite green AND a served, `127.0.0.1`-hosted, `/strava-widgets`-based human
  browser checkpoint covering Success Criteria 1-6, per ROADMAP.md's Phase 21 entry.

### Wave 0 Gaps

- [ ] None structurally — every test file this phase needs already exists
  (`overview.test.ts`, `list.test.ts`, `list-logic.test.ts`, `records-logic.test.ts`,
  `streak-utils.test.ts`, `row-semantics.test.ts`, `styles.test.ts`). No new framework install, no
  new config, no new fixture directory needed.
- [ ] **A staged-build data fixture is needed for the checkpoint** (not a Wave-0 test-infra gap in
  the conventional sense, but a pre-checkpoint task): the `dist/widgets/data/stats/streaks.json`
  edit described in D-16/the FIX-01 section above must happen AFTER `npm run build-widgets` runs
  and BEFORE the checkpoint is opened, following plan 20-18's exact automated-verification-script
  pattern (assert the edit landed in `dist/`, assert `data/` is untouched, assert `git status
  --porcelain data` is clean).

*(No test-framework or fixture-directory gaps — the only "gap" is the one-time fixture edit
described above, which is a checkpoint-preparation task, not a Wave 0 test-infrastructure task.)*

## Security Domain

**Not applicable — `security_enforcement` is effectively out of scope for this phase.** This is a
static, read-only, public GitHub Pages SPA with no authentication, no user input persisted
server-side, no write path (CUR-01's write path is explicitly Phase 24, out of this phase's
scope), and no new external data source. The one XSS-adjacent discipline already in force
(`row.name` — athlete free text — reaches the DOM only via `textContent`, never
`innerHTML`/`insertAdjacentHTML`) is UNCHANGED by this phase: the shared row renderer already uses
`textContent` exclusively (`list.ts:337`, confirmed by direct read) and this phase does not modify
that line. No new user-controllable string enters the DOM in this phase (the scope-toggle's two
labels are hardcoded strings; the two new headline-stat tiles render only numbers derived from
pre-computed JSON).

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V5 Input Validation | Partial — no new user input, but `textContent`-only discipline for athlete free text (`row.name`) must be preserved in every new/edited call site | `textContent` assignment only, never HTML-string assignment (T-16-VW-01/T-17-VW-01, already established) |
| V2/V3/V4/V6 | No | No authentication, sessions, access control, or cryptography exist in this app or are touched by this phase |

## Sources

### Primary (HIGH confidence — direct file reads in this session)

- `.planning/phases/21-overview-rebuild/21-CONTEXT.md` — all 16 locked decisions, canonical refs, code context
- `.planning/phases/21-overview-rebuild/21-DISCUSSION-LOG.md` — declined alternatives for each decision
- `.planning/REQUIREMENTS.md` — OVR-01..04, FIX-01, Verification Note
- `.planning/STATE.md` — project history, Phase 19/20 closure state
- `.planning/ROADMAP.md` — Phase 21 goal, success criteria, dependencies
- `src/dashboard/views/overview.ts` — full file read
- `src/dashboard/views/list.ts` — full file read
- `src/dashboard/views/records.ts` — full file read
- `src/dashboard/views/records-logic.ts` — full file read
- `src/analytics/streak-utils.ts` — full file read
- `src/analytics/streak-utils.test.ts` — partial read (existing test shapes)
- `src/analytics/compute-advanced-stats.ts` (lines 180-260) — streak serialization site
- `src/analytics/compute-stats.ts` (lines 190-270) — `yearly-stats.json` generator, `PeriodStats` shape
- `src/types/analytics.types.ts` (lines 60-93) — `StreakData` interface
- `src/dashboard/views/detail-charts.ts` (lines 230-300, 543-552) — `.segmented` reference pattern
- `src/dashboard/styles.css` (lines 300-480, 890-960, 1480-1590) — `.activity-row`, `.stat-grid`, `.segmented`, Phase 20 banner block
- `src/dashboard/row-navigation.ts` — full file read
- `src/analytics/best-effort.types.ts` (lines 127-142) — `PRRankingEntry`
- `src/analytics/dashboard-index.types.ts` (lines 39-70) — `DashboardIndexRow`
- `src/dashboard/views/overview.test.ts` (partial) — existing test conventions
- `scripts/build-widgets.mjs` (lines 87-165) — `copyDataFiles` destination mapping, confirms `dist/widgets/data/stats/streaks.json`
- `.planning/phases/20-row-click-interaction-pattern/20-18-PLAN.md` (automated gate script) — the fixture-edit-and-verify precedent
- `.planning/phases/18-records-trends-differentiators/18-UI-SPEC.md` (lines 40-80) — spacing/typography roles, § 17 reference
- `package.json`, `vitest.config.ts` — test framework config

### Secondary (MEDIUM confidence)

None — no web search or Context7 lookup was needed; this phase has zero external-library surface.

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; everything already installed and proven
- Architecture: HIGH — every pattern cited was read directly from the live source tree
- Pitfalls: HIGH — Pitfalls 1, 2, 4 are derived from direct code reads and CONTEXT.md's own recorded
  reasoning; Pitfall 3 (empty-state copy) is a newly-discovered latent issue, confirmed by reading
  `buildPrTableSection`'s call site directly

**Research date:** 2026-08-18
**Valid until:** Until this phase's own plans land (source shapes cited here will change as soon as
plan work begins) — this document should be treated as a snapshot of the pre-Phase-21 codebase, not
a durable reference; re-read the source at planning/execution time if more than a few days elapse.
