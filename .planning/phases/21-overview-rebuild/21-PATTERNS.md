# Phase 21: Overview Rebuild - Pattern Map

**Mapped:** 2026-08-18
**Files analyzed:** 11 modified/impacted source files + 6 test files
**Analogs found:** 11 / 11 (every file has an in-repo analog — most are self-analogs, i.e. the
file already contains the pattern it must extend)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `src/dashboard/views/overview.ts` (`buildStatCard`) | component (tile builder) | transform | `src/dashboard/views/records.ts` `buildSuperlativeTile` (`:224-245`) | exact (same shape, sub-label to be ported) |
| `src/dashboard/views/overview.ts` (`buildRecentPrsCard`) | component (list builder) | CRUD (read/render) | `src/dashboard/views/overview.ts` `buildRecentActivitiesCard` (`:195-212`, same file) | exact (self-analog, already calls the shared renderer) |
| `src/dashboard/views/overview.ts` (retire `renderRecentPrRow`/`recentPrBadgeText`/`recentPrRowAriaLabel`) | component (row builder, dead code) | n/a (deletion) | `src/dashboard/views/list.ts` `renderActivityRow` (`:324-348`) | exact (the function these are retired **into**) |
| `src/dashboard/views/overview.ts` (`mount` fetch trio) | controller (data loader) | request-response | `src/dashboard/views/trends.ts` `load()` (`:1163-1169`) | exact (identical `fetchStatsJson` + `Promise.all` idiom, one more URL) |
| `src/dashboard/views/list.ts` (`renderActivityRow`) | component (shared row renderer) | transform | itself — no external analog needed, becomes the analog for the other two call sites | exact |
| `src/dashboard/views/records.ts` (`buildPrTablesSection` scope control) | component (control + re-render) | event-driven | `src/dashboard/views/detail-charts.ts` `.segmented` block (`:253-276`, `:538-552`) | exact |
| `src/dashboard/views/records.ts` (Current Streak sub-label, `:291-303`) | component (tile builder) | transform | already-correct code, no change needed once `records-logic.ts` layer 2 is fixed | exact (self-correcting) |
| `src/dashboard/views/records-logic.ts` (`selectCurrentStreak` fix) | service (pure logic) | transform | `src/dashboard/views/records-logic.ts` `selectLongestStreak` (`:249-260`, same file, unconditional-field precedent) | exact |
| `src/dashboard/views/records-logic.ts` (new year filter + re-rank fn) | service (pure logic) | transform | `src/dashboard/views/records-logic.ts` `buildPrTableRows` (`:101-136`) | exact (same module, same input shape) |
| `src/analytics/streak-utils.ts` (`currentStreakEnd` field) | service (pure computation) | transform | `src/analytics/streak-utils.ts` `longestStreakEnd` (same file, `:78-121`, unconditional-set precedent) | exact |
| `src/analytics/compute-advanced-stats.ts` (serialize `currentStreakEnd`) | service (build-time pipeline) | batch | `src/analytics/compute-advanced-stats.ts` `longestStreakEnd` serialization (`:218-222`, same file) | exact |
| `src/dashboard/styles.css` (`.activity-row` two-line hierarchy) | config (design tokens/rules) | transform | `src/dashboard/styles.css` Phase 20 banner block (`:1460-1548`) | exact (precedent for a new phase-scoped banner block) |
| `src/dashboard/styles.css` (scope control) | config | transform | `src/dashboard/styles.css` `.segmented` block (`:898-955`) | exact (reuse verbatim, no new CSS) |
| Test: `streak-utils.test.ts` | test | transform | itself, `describe('calculateDailyStreaks', ...)` (`:4-129`) | exact |
| Test: `records-logic.test.ts` | test | transform | itself, `describe('isEmptyRanking / buildPrTableRows — marathon empty state (D-05)', ...)` (`:78-94`) and `describe('selectSuperlatives — tolerant of null/malformed inputs', ...)` (`:353+`) | exact |
| Test: `overview.test.ts` | test | transform | itself, `describe('recentPrRowAriaLabel — CR-02 PR-count badge folded into the row label', ...)` (`:56-72`) | exact (shape to follow / retire) |
| Test: `row-semantics.test.ts` | test | transform | not read this pass — CONTEXT.md/RESEARCH.md confirm it exists and already asserts source-identity of shared-renderer call sites; extend, don't reinvent | role-match |
| Test: `styles.test.ts` | test | transform | itself, `declarationsFor` / `selectorListDeclares` / `cascadeWinningBodyDeclaring` helpers | exact |
| Fixture task: `dist/widgets/data/stats/streaks.json` edit | test/checkpoint-prep script | file I/O | `.planning/phases/20-row-click-interaction-pattern/20-18-PLAN.md` Task 1's automated-gate script (fixture-edit-and-verify) | exact |

## Pattern Assignments

### `src/dashboard/views/overview.ts` — `buildStatCard` gains an optional sub-label (D-15)

**Analog:** `src/dashboard/views/records.ts:224-245` (`buildSuperlativeTile`)

**Current `buildStatCard`** (`overview.ts:45-56`, read directly, exact current state):
```typescript
function buildStatCard(value: string, label: string): HTMLElement {
  const wrapper = document.createElement('div');
  const valueEl = document.createElement('div');
  valueEl.className = 'text-display';
  valueEl.textContent = value;
  const labelEl = document.createElement('div');
  labelEl.className = 'text-label';
  labelEl.textContent = label;
  wrapper.appendChild(valueEl);
  wrapper.appendChild(labelEl);
  return wrapper;
}
```

**Target shape — copy near-verbatim from `records.ts:224-245`:**
```typescript
function buildSuperlativeTile(value: string, label: string, sublabel?: string): HTMLElement {
  const wrapper = document.createElement('div');

  const valueEl = document.createElement('div');
  valueEl.className = 'text-display';
  valueEl.textContent = value;
  wrapper.appendChild(valueEl);

  const labelEl = document.createElement('div');
  labelEl.className = 'text-label';
  labelEl.textContent = label;
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
Add the same `if (sublabel)` block to `buildStatCard`, keeping the parameter name `sublabel` to
match `records.ts`'s vocabulary exactly (searchability). The `.stat-grid` CSS needs **zero**
changes for this (see the Grid Placement note under Shared Patterns).

**Current-Streak call site to update in `buildHeadlineStatsCard` (`overview.ts:143-165`)** —
mirror `records.ts:291-303`'s conditional exactly, but against `overview.ts`'s raw `StreaksStats`
shape (not the `selectCurrentStreak`-derived shape — Overview has no `records-logic.ts` layer):
```typescript
// records.ts:291-303 — the conditional shape to mirror (Records screen, post-selectCurrentStreak)
grid.appendChild(
  buildSuperlativeTile(
    currentStreak ? `${currentStreak.days} days` : '—',
    'Current Streak',
    currentStreak
      ? currentStreak.active
        ? 'active'
        : currentStreak.endedISO
          ? `ended ${formatActivityDate(currentStreak.endedISO)}`
          : undefined
      : undefined
  )
);
```
Overview's equivalent (new code, per RESEARCH.md's D-15 code example, `overview.ts`'s own
`StreaksStats` interface at `:34-43` needs `currentStreakEnd: string | null` added first):
```typescript
buildStatCard(
  streaks ? `${streaks.currentStreak} days` : '—',
  'Current Streak',
  streaks && !streaks.withinCurrentStreak && streaks.currentStreakEnd
    ? `ended ${formatActivityDate(streaks.currentStreakEnd)}`
    : undefined
)
```

---

### `src/dashboard/views/overview.ts` — retire `renderRecentPrRow` into the shared renderer (D-05)

**Analog:** `src/dashboard/views/list.ts:324-348` (`renderActivityRow`) — this is what
`buildRecentPrsCard` must call instead.

**What is being deleted** (`overview.ts:83-141`, read directly — full current extent):
```typescript
export function recentPrBadgeText(row: DashboardIndexRow): string {
  return `${row.prCount} PR`;
}

export function recentPrRowAriaLabel(row: DashboardIndexRow): string {
  const distanceKm = (row.distanceM / 1000).toFixed(1);
  const base = `${row.name}, ${formatActivityDate(row.startDateLocal)}, ${distanceKm} km`;
  return composeRowAriaLabel(base, [recentPrBadgeText(row)]);
}

function renderRecentPrRow(row: DashboardIndexRow): HTMLElement {
  const rowEl = document.createElement('a');
  rowEl.className = 'activity-row';
  const distanceKm = (row.distanceM / 1000).toFixed(1);
  rowEl.href = activityDetailHref(row.id);
  rowEl.setAttribute('aria-label', recentPrRowAriaLabel(row));

  const nameEl = document.createElement('div');
  nameEl.className = 'activity-row__name';
  nameEl.textContent = row.name;
  rowEl.appendChild(nameEl);

  const metaEl = document.createElement('div');
  metaEl.className = 'activity-row__meta';
  metaEl.textContent = `${formatActivityDate(row.startDateLocal)} · ${distanceKm} km`;
  rowEl.appendChild(metaEl);

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = recentPrBadgeText(row);
  rowEl.appendChild(badge);

  return rowEl;
}
```

**Call site to change** (`overview.ts:167-193`, `buildRecentPrsCard`) — replace the
`listEl.appendChild(renderRecentPrRow(row))` loop with the same idiom `buildRecentActivitiesCard`
already uses one function below it (`overview.ts:195-212`):
```typescript
// overview.ts:204-208 — buildRecentActivitiesCard, the pattern to copy verbatim into buildRecentPrsCard
const listEl = document.createElement('div');
listEl.className = 'activity-list';
for (const row of rows.slice(0, RECENT_ACTIVITY_COUNT)) {
  listEl.appendChild(renderActivityRow(row));
}
```
`renderActivityRow` is already imported at `overview.ts:15`
(`import { renderActivityRow, formatActivityDate, composeRowAriaLabel } from './list.js';`) — no
new import needed, only `activityDetailHref` (`overview.ts:16`) and `composeRowAriaLabel` become
candidates for removal if nothing else in the file uses them after the retirement (check before
deleting the import).

**The `idPrefix` collision this retirement introduces (RESEARCH.md Pitfall 2 / Assumption A5):**
`renderActivityRow`'s hardcoded `idPrefix` at `list.ts:328`:
```typescript
const idPrefix = `activity-card-${row.id}`;
```
is currently safe because `list.ts`'s own two call sites (`renderActivityRow` for the mobile card,
`buildTableRow` for the desktop table `'activity-table-' + row.id`) are CSS-hidden alternates, never
both visible. Once `buildRecentPrsCard` AND `buildRecentActivitiesCard` both call
`renderActivityRow` on the SAME Overview page render, a PR-carrying row within the last 10
activities gets the identical `id` in two simultaneously-visible DOM trees. Follow the existing
two-prefix precedent (`list.ts:242-247`'s JSDoc names the desktop/mobile split) and extend
`renderActivityRow`'s signature with a third `idPrefix`-scoping parameter (or an optional param
defaulting to today's string) so the two Overview call sites pass distinguishing values, e.g.
`overview-prs-${row.id}` / `overview-activities-${row.id}`.

---

### `src/dashboard/views/records.ts` — the `.segmented` scope control (D-01..D-04)

**Analog:** `src/dashboard/views/detail-charts.ts:253-276` (markup) + `:538-552` (toggle wiring) —
copy near-verbatim per RESEARCH.md's explicit "copied near-verbatim" recommendation.

**Markup pattern** (`detail-charts.ts:253-276`, read directly):
```typescript
const segmented = document.createElement('div');
segmented.className = 'segmented';
segmented.setAttribute('role', 'group');
segmented.setAttribute('aria-label', 'Chart x-axis');            // → 'Records scope' or similar

const distanceOption = document.createElement('button');
distanceOption.type = 'button';
distanceOption.className = 'segmented__option segmented__option--active';
distanceOption.textContent = 'Distance';                          // → 'All time'
distanceOption.setAttribute('aria-pressed', 'true');

const timeOption = document.createElement('button');
timeOption.type = 'button';
timeOption.className = 'segmented__option';
timeOption.textContent = 'Time';                                  // → 'This year'
timeOption.setAttribute('aria-pressed', 'false');

segmented.appendChild(distanceOption);
segmented.appendChild(timeOption);
root.appendChild(segmented);
```

**Toggle wiring pattern** (`detail-charts.ts:538-552`, read directly):
```typescript
function setXAxisMode(mode: XAxisMode): void {
  if (xAxisMode === mode) return;
  xAxisMode = mode;

  const isDistance = mode === 'distance';
  distanceOption.classList.toggle('segmented__option--active', isDistance);
  distanceOption.setAttribute('aria-pressed', String(isDistance));
  timeOption.classList.toggle('segmented__option--active', !isDistance);
  timeOption.setAttribute('aria-pressed', String(!isDistance));

  rebuildBands();
}

distanceOption.addEventListener('click', () => setXAxisMode('distance'));
timeOption.addEventListener('click', () => setXAxisMode('time'));
```

**View-local, non-persisted state idiom** (`detail-charts.ts:220`):
```typescript
let xAxisMode: XAxisMode = 'distance';
```
declared as a plain closure variable inside the mount/factory function scope, mutated only by the
click handler — no storage, no URL param. Per RESEARCH.md, for Records the equivalent variable
must be declared where `records.ts`'s `mountedContainer` lives (factory scope, not inside `load()`
which re-runs), but **initialized/reset to `'all-time'` at the top of `load()`** so every arrival
at `#/records` starts all-time (D-04).

**Insertion point:** `buildPrTablesSection` (`records.ts:567-592`) is the section the control
governs (D-01/D-03: PR tables only, not Superlatives/evolution/Riegel). The control sits above
the per-distance loop; re-render on toggle re-runs the `for (const distance of TARGET_ORDER)` loop
with a year-filtered `entries` array instead of the raw `bestEfforts.rankings[distance]`.

---

### `src/dashboard/views/records-logic.ts` — year filter + re-rank (new function, Claude's Discretion shape)

**Analog:** `records-logic.ts:101-136` (`buildPrTableRows`) — same module, same pure-function
discipline, consumes the same `PRRankingEntry[]` shape.

```typescript
// records-logic.ts:101-136 — the existing entry→row mapper this phase's new function feeds INTO,
// unchanged, per RESEARCH.md's recommended "filter, reassign sequential rank, then call
// buildPrTableRows unchanged" shape (Assumption A3):
export function buildPrTableRows(
  entries: readonly PRRankingEntry[] | undefined,
  ageGrading: AgeGradingDocument | null,
  distance: TargetDistanceKey,
  exclusionReasons: ReadonlyMap<string, string>
): PrTableRow[] {
  if (!entries || entries.length === 0) return [];
  // ... maps entries -> PrTableRow[], using entry.rank as-is
}
```

The date-normalization helper already exists in the same file and MUST be reused, not
reimplemented (RESEARCH.md's explicit anti-pattern warning):
```typescript
// records-logic.ts:38-44 — the Z-suffix normalization every date-bearing function in this
// codebase applies; the year-extraction helper must call this, not `new Date(startDate).getFullYear()`
function parseStartDateToEpochMs(startDate: string): number | null {
  if (typeof startDate !== 'string') return null;
  const normalized = startDate.endsWith('Z') ? startDate : `${startDate}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}
```
Use `new Date(epochMs).getUTCFullYear()` on the normalized instant — never a naive
`new Date(startDate).getFullYear()` (local-timezone bug risk near year boundaries).

**Empty-ranking sentinel to reuse unchanged** (`records-logic.ts:143-145`):
```typescript
export function isEmptyRanking(entries: readonly PRRankingEntry[] | undefined): boolean {
  return !entries || entries.length === 0;
}
```
Works unchanged on a filtered array — no new sentinel needed.

---

### `src/dashboard/views/records-logic.ts` — `selectCurrentStreak` D-12 layer-2 fix

**Analog:** `records-logic.ts:249-260` (`selectLongestStreak`), same file — the sibling function
that already reads an "end" field unconditionally, the precedent `selectCurrentStreak` must match.

**Current buggy code** (`records-logic.ts:268-282`, read directly, exact current state):
```typescript
function selectCurrentStreak(raw: unknown): { days: number; active: boolean; endedISO: string | null } | null {
  if (!isRecord(raw)) return null;
  if (!hasOwn(raw, 'currentStreak') || !hasOwn(raw, 'withinCurrentStreak')) return null;

  const { currentStreak, withinCurrentStreak, currentStreakStart } = raw;
  if (typeof currentStreak !== 'number' || typeof withinCurrentStreak !== 'boolean') return null;

  const active = withinCurrentStreak;
  const endedISO =
    !active && typeof currentStreakStart === 'string' && currentStreakStart.length > 0
      ? currentStreakStart
      : null;

  return { days: currentStreak, active, endedISO };
}
```
**Fix:** rename the destructured field to `currentStreakEnd` and read that instead — do NOT widen
the `hasOwn` required-field check to include it (would make the whole tile disappear before a
compute run regenerates `streaks.json`, per D-13's degrade-path requirement):
```typescript
const { currentStreak, withinCurrentStreak, currentStreakEnd } = raw;   // was: currentStreakStart
// ... (unchanged type guard on currentStreak/withinCurrentStreak only)
const endedISO =
  !active && typeof currentStreakEnd === 'string' && currentStreakEnd.length > 0
    ? currentStreakEnd
    : null;
```

**Sibling precedent this mirrors** (`selectLongestStreak`, `records-logic.ts:249-260`, read
directly) — note it already reads BOTH start and end unconditionally, no `active` gating:
```typescript
function selectLongestStreak(raw: unknown): { days: number; startISO: string; endISO: string } | null {
  if (!isRecord(raw)) return null;
  if (!hasOwn(raw, 'longestStreak') || !hasOwn(raw, 'longestStreakStart') || !hasOwn(raw, 'longestStreakEnd')) {
    return null;
  }
  const { longestStreak, longestStreakStart, longestStreakEnd } = raw;
  if (typeof longestStreak !== 'number') return null;
  if (typeof longestStreakStart !== 'string' || typeof longestStreakEnd !== 'string') return null;
  return { days: longestStreak, startISO: longestStreakStart, endISO: longestStreakEnd };
}
```

---

### `src/analytics/streak-utils.ts` — `currentStreakEnd` field (D-13 layer-1 fix)

**Analog:** the same file's own `longestStreakEnd`, which is already set unconditionally
(`streak-utils.ts:78, 91-92, 102, 120`) — the exact "set regardless of active/ended" precedent
`currentStreakEnd` must follow, unlike `currentStreakStart` which is deliberately nulled.

**Exact current return statement** (`streak-utils.ts:114-121`, read directly):
```typescript
return {
  currentStreak: finalCurrentStreak,
  longestStreak,
  withinCurrentStreak,
  currentStreakStart: withinCurrentStreak ? currentStreakStart : null,   // line 118
  longestStreakStart,
  longestStreakEnd,
};
```
**The value already exists as a local**, computed unconditionally one line 106 above and then
only used to derive `daysSinceLastActivity`/`withinCurrentStreak`, then discarded:
```typescript
// streak-utils.ts:106
const lastActivityDate = sortedDates[sortedDates.length - 1];
```
**Fix:** add `currentStreakEnd: lastActivityDate,` to the return object (set unconditionally, no
ternary), and add the field to the `StreakResult` interface (`streak-utils.ts:11-18`) and to the
empty-array early-return branch (`streak-utils.ts:49-59`, add `currentStreakEnd: null,`).

**Interface to extend** (`streak-utils.ts:11-18`, read directly, exact current state):
```typescript
export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  withinCurrentStreak: boolean;
  currentStreakStart: Date | null;
  longestStreakStart: Date | null;
  longestStreakEnd: Date | null;
}
```

---

### `src/analytics/compute-advanced-stats.ts` — thread `currentStreakEnd` into `streaks.json`

**Analog:** the same file's own `longestStreakEnd` serialization, immediately adjacent.

**Current serialization** (`compute-advanced-stats.ts:211-222`, confirmed via grep + RESEARCH.md
direct read):
```typescript
const streakData: StreakData = {
  // ...
  currentStreakStart: dailyStreaks.currentStreakStart
    ? dailyStreaks.currentStreakStart.toISOString()
    : '',
  longestStreakStart: dailyStreaks.longestStreakStart
    ? dailyStreaks.longestStreakStart.toISOString()
    : '',
  longestStreakEnd: dailyStreaks.longestStreakEnd
    ? dailyStreaks.longestStreakEnd.toISOString()
    : '',
};
```
**Add, following the identical ternary-to-empty-string idiom:**
```typescript
currentStreakEnd: dailyStreaks.currentStreakEnd
  ? dailyStreaks.currentStreakEnd.toISOString()
  : '',
```
Also add `currentStreakEnd: string;` to the `StreakData` interface
(`src/types/analytics.types.ts:79-93`, sibling to `longestStreakEnd: string;` at line 85).

---

### `src/dashboard/styles.css` — D-06 two-line `.activity-row` hierarchy

**Analog:** the file's own current `.activity-row` block, to be restructured, plus the Phase 20
banner-block precedent for where new rules land.

**Current exact rules** (`styles.css:329-367`, read directly):
```css
.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);              /* 8px — Phase 20 D-11's focus-ring clearance */
}

/* Phase 20: .activity-row is an <a> as of plan 20-02/20-03, and anchors are
   `inline` by default — `display: flex` here is load-bearing for laying the
   now-inline element out as a row; do not restructure it away. */
.activity-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;                /* hardcoded, not var(--radius-panel) — pre-dates the token */
  padding: var(--space-md);
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
Plus the Phase 20 banner block additions (`styles.css:1539-1548`, read directly):
```css
.activity-row {
  text-decoration: none;
}
.activity-row:hover {
  background: color-mix(in srgb, var(--surface) 92%, var(--text));
}
```

**D-08 constraint:** `background`, `border`, `border-radius`, `padding` on `.activity-row`, and
`.activity-list`'s `gap` stay unchanged — only the row's internal child layout changes. Per D-08's
own citation, the hover formula mixes against `var(--surface)` and the focus ring needs the 8px
gap; do not touch either.

**Banner-block precedent to follow** for where the new rules land — `styles.css` has one
phase-scoped, banner-commented block per prior phase (17/18/19/20); the closest is the Phase 20
block starting near `styles.css:1460` with a stated class contract in its header comment. Phase
21's new `.activity-row__header` (or similar, Claude's Discretion on the exact name) wrapper rule
must land in a NEW banner-commented block appended after the Phase 20 block, not edited into the
base `.activity-row` rule in place — this is the load-bearing convention `styles.test.ts`'s
`declarationsFor`/`cascadeWinningBodyDeclaring` helpers are built to verify against.

**Do not redeclare** `display: flex` on `.activity-row` itself (already declared, comment at
`:335-337` calls it load-bearing) — change `flex-direction: row` to `column` on the base rule (one
property edit) and add a NEW wrapper class for the name+badges header row with
`display: flex; justify-content: space-between; align-items: baseline; flex-wrap: nowrap;`.

---

### Fixture task — `dist/widgets/data/stats/streaks.json` edit (D-16)

**Analog:** `.planning/phases/20-row-click-interaction-pattern/20-18-PLAN.md` Task 1's automated
gate script — the exact precedent for editing a staged-build data file and verifying the edit
landed only in `dist/`, never in the repository's gitignored `data/` copy.

**Confirmed pattern from the 20-18 gate script** (paraphrased structure, read directly from the
plan's `<automated>` block):
```javascript
// 1. Run the full gate (npm test; tsc --noEmit; npm run build-widgets) first, so the fixture
//    edit is applied to freshly-built output, not stale dist/.
// 2. Read the staged file, assert the target row/field exists at the expected shape:
const idx = JSON.parse(readFileSync('dist/widgets/data/dashboard/index.json', 'utf8'));
const row = idx.activities.find((a) => a.id === 'i174109950');
if (!row) throw new Error('fixture target not found in the staged index');
// 3. Assert the edit's target field has the ORIGINAL (unedited) value here, proving this
//    is the pre-edit staged file, not an already-fixture-applied leftover.
// 4. Apply the edit directly to the staged file's parsed JSON, write it back.
// 5. Assert the repository's gitignored data/ copy is untouched:
const repo = JSON.parse(readFileSync('data/dashboard/index.json', 'utf8'));
const orig = repo.activities.find((a) => a.id === 'i174109950');
if (orig.streams.hr !== true) throw new Error('the repository copy was modified');
// 6. Final guard: `git status --porcelain src scripts data` must be empty.
```
**For FIX-01, transpose this to:**
- Target file: `dist/widgets/data/stats/streaks.json` (confirmed via `build-widgets.mjs:139`'s
  `{ src: 'data/stats', dest: 'dist/widgets/data/stats' }` mapping).
- Fields to set: `withinCurrentStreak: false`, `currentStreak: 0`, `currentStreakEnd` to a known,
  distinct, recent-past ISO string.
- Same three guards: staged file has the edit; `data/stats/streaks.json` (the repo copy) does not;
  `git status --porcelain src scripts data` is empty.
- Checkpoint assertion must compare the RENDERED date string against this fixture's injected
  value verbatim — not merely confirm a sub-label appeared (D-13/Pitfall 1's explicit warning).
- Serve via `127.0.0.1:8099`, never `localhost:8099` (D-16's stated trap, matches the user's own
  `staged-build-browser-cache-trap` memory note).

## Shared Patterns

### `fetchStatsJson` — individually-guarded stats fetch
**Source:** `src/dashboard/views/overview.ts:65-76` (identical copy also exists in `records.ts` and
`trends.ts` — this codebase duplicates this helper per view module rather than sharing it; follow
that precedent, do not introduce a shared import).
**Apply to:** OVR-04's new `yearly-stats.json` fetch in `overview.ts`.
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
**Call-site precedent for the new fetch** (`trends.ts:1163-1169`, read directly — proves the URL
and the `Promise.all` position):
```typescript
const [, weekly, monthly, yearly, yoy] = await Promise.all([
  deps.indexClient.loadIndex(),
  fetchStatsJson<unknown>(`${STATS_BASE_URL}weekly-distance.json`, doFetch),
  fetchStatsJson<unknown>(`${STATS_BASE_URL}monthly-stats.json`, doFetch),
  fetchStatsJson<unknown>(`${STATS_BASE_URL}yearly-stats.json`, doFetch),
  fetchStatsJson<unknown>(`${STATS_BASE_URL}year-over-year.json`, doFetch),
]);
```
`overview.ts`'s existing trio (`overview.ts:242-246`) adds one more entry in the same shape:
```typescript
[, totals, streaks] = await Promise.all([
  indexClient.loadIndex(),
  fetchStatsJson<AllTimeTotals>(`${STATS_BASE_URL}all-time-totals.json`, doFetch),
  fetchStatsJson<StreaksStats>(`${STATS_BASE_URL}streaks.json`, doFetch),
  // + fetchStatsJson<PeriodStats[]>(`${STATS_BASE_URL}yearly-stats.json`, doFetch),
]);
```

### `composeRowAriaLabel` — the shared accessible-name composer
**Source:** `src/dashboard/views/list.ts:266-269`
**Apply to:** the single row-name builder that survives D-05's retirement (whatever `activityRowAriaLabel` becomes once it is the only one).
```typescript
export function composeRowAriaLabel(base: string, badgeTexts: readonly string[]): string {
  if (badgeTexts.length === 0) return base;
  return `${base}, ${badgeTexts.join(', ')}`;
}
```
Curated 3-part base template both retiring and surviving builders share (`list.ts:290-293`):
```typescript
export function activityRowAriaLabel(row: DashboardIndexRow): string {
  const distanceKm = (row.distanceM / 1000).toFixed(1);
  const base = `${row.name}, ${formatActivityDate(row.startDateLocal)}, ${distanceKm} km`;
  return composeRowAriaLabel(base, statusBadgeTexts(row));
}
```

### `statusBadgeTexts` — badge source that already emits the PR count
**Source:** `src/dashboard/views/list.ts:212-234`
**Apply to:** D-07 — no new badge source needed for Recent PRs rows once they call
`renderActivityRow`.
```typescript
export function statusBadgeTexts(row: DashboardIndexRow): string[] {
  const texts: string[] = [];
  if (!row.streams.available) {
    texts.push(row.streams.reason ? `No streams (${row.streams.reason})` : 'No streams');
  } else if (!row.streams.hr) {
    texts.push('No HR');
  }
  if (row.lowConfidence) texts.push(LOW_CONFIDENCE_BADGE_TEXT);
  if (row.excludedFromRecords) texts.push('Excluded from records');
  if (row.prCount > 0) texts.push(`${row.prCount} PR`);
  return texts;
}
```

### `hasOwn` / tolerant-parse pattern for `records-logic.ts`'s `select*` functions
**Source:** `src/dashboard/views/records-logic.ts:21-24` + every `select*` function
**Apply to:** `selectCurrentStreak`'s fix — do not widen the required-field `hasOwn` check to
include `currentStreakEnd` (breaks the pre-compute-run degrade path per D-13).
```typescript
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
```

### Textual/string-only test assertions — the only automatable layer this phase has
**Source:** `.planning/phases/21-overview-rebuild/21-RESEARCH.md` § Validation Architecture
(confirmed: `vitest.config.ts` has `environment: 'node'`, no jsdom). Every new test in
`overview.test.ts`, `list.test.ts`, `records-logic.test.ts`, `streak-utils.test.ts`,
`row-semantics.test.ts` must assert TEXT CONTENT and STRING VALUES (aria-label strings, computed
numbers, filtered/re-ranked arrays) — never layout, never "does it render visually correct." The
human browser checkpoint (Success Criterion 6, `127.0.0.1`-served) is the only channel for visual
verification; do not write a test that pretends to cover it.

## No Analog Found

None. Every file in scope either already contains the exact pattern it needs to extend (self-analog:
`buildRecentActivitiesCard` already calls the shared renderer; `longestStreakEnd` already
demonstrates the unconditional-set precedent `currentStreakEnd` needs) or has a proven external
analog in a currently-passing, checkpoint-verified module (`.segmented`, `buildSuperlativeTile`,
`fetchStatsJson`, the 20-18 fixture-edit script).

## Metadata

**Analog search scope:** `src/dashboard/views/*.ts`, `src/dashboard/styles.css`,
`src/analytics/streak-utils.ts`, `src/analytics/compute-advanced-stats.ts`,
`src/types/analytics.types.ts`, `.planning/phases/20-row-click-interaction-pattern/20-18-PLAN.md`
**Files scanned (direct Read/grep this session):** `overview.ts` (full), `list.ts` (lines 180-380),
`records.ts` (lines 200-350, 530-595), `records-logic.ts` (full), `streak-utils.ts` (full),
`detail-charts.ts` (lines 215-280, 535-555), `styles.css` (lines 318-390, 895-955, 1470-1550),
`compute-advanced-stats.ts` / `analytics.types.ts` (grep-located), `trends.ts` (lines 1150-1185),
`overview.test.ts` (grep-located), `records-logic.test.ts` / `streak-utils.test.ts` /
`styles.test.ts` (grep-located describe/helper names), `20-18-PLAN.md` (grep-located fixture
script)
**Pattern extraction date:** 2026-08-18
