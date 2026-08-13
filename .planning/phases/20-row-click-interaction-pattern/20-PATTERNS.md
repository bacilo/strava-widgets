# Phase 20: Row-Click Interaction Pattern - Pattern Map

**Mapped:** 2026-08-13
**Files analyzed:** 6 modified + 1-2 new (D-03 helper + optional test)
**Analogs found:** 6 / 6 (all in-repo; no RESEARCH.md fallback needed)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/dashboard/views/list.ts` (`buildTableRow`) | view / row-builder | event-driven (click→navigate) | *is itself* the canonical pattern — no external analog needed, only extraction | exact (self) |
| `src/dashboard/views/list.ts` (`renderActivityRow`) | view / row-builder | event-driven | `overview.ts`'s `renderRecentPrRow` (sibling, will itself become the analog target) | exact (self) |
| `src/dashboard/views/overview.ts` (`renderRecentPrRow`) | view / row-builder | event-driven | `list.ts`'s `renderActivityRow` (post-change shape) | exact |
| `src/dashboard/views/records.ts` (`buildPrTable` row loop) | view / row-builder (table) | event-driven | `list.ts`'s `buildTableRow` | exact |
| `src/dashboard/views/records.ts` (`buildProgressionTable` row loop) | view / row-builder (table) | event-driven | `list.ts`'s `buildTableRow` | exact |
| New D-03 helper (e.g. `src/dashboard/row-navigation.ts`) | utility / DOM-touching navigation helper | event-driven | `src/dashboard/nav.ts` (closest DOM-touching sibling of `router.ts`) for module shape; `list.ts:333-343`'s inline handler for the extracted logic itself | role-match (shape) / exact (logic) |
| `src/dashboard/styles.css` (D-06 bare `a` rule, D-09 hover on row anchors, D-10 scoping) | config (CSS) | n/a | `.activity-table tbody tr` / `.activity-table tbody tr:hover` (styles.css:526-532), `.cta` (styles.css:368-386) | exact (hover formula), role-match (new bare-`a` rule has no existing analog — confirmed zero bare `a` rules exist) |
| `src/dashboard/styles.test.ts` (new assertions) | test | n/a | Existing `.activity-table tbody tr:hover` assertion (styles.test.ts:729-733) and `.cta:hover` assertion (styles.test.ts:723-727) | exact |

## Pattern Assignments

### `src/dashboard/views/list.ts` — `buildTableRow` (THE canonical pattern, D-03 source)

**File:** `src/dashboard/views/list.ts:333-383` (row-click block is `:333-343`; full row builder runs to `:383`)

This is the pattern being extracted verbatim into the D-03 helper. Read every line of the excerpt below before writing the helper — behavior must be preserved exactly (D-03: "behavior preserved exactly").

```typescript
// list.ts:328-343
/**
 * Builds one desktop `<tr>`, separate from `renderActivityRow` (D-04, two
 * renderers each with one job). Keyboard users operate the Activity-cell
 * anchor (already Tab+Enter operable) — no `tabindex` on the `<tr>` itself.
 */
function buildTableRow(row: DashboardIndexRow): HTMLTableRowElement {
  const tr = document.createElement('tr');
  tr.dataset.activityId = row.id;
  tr.addEventListener('click', (event) => {
    // The Activity-cell anchor already navigates on its own; do not
    // double-navigate when the click originated from it.
    if ((event.target as HTMLElement).closest('a')) {
      return;
    }
    navigateTo(`/activity/${row.id}`);
  });
```

**The comment above must be updated when this moves into the D-03 helper** — per CONTEXT.md's `<specifics>`, it currently reads as if it contradicts success criterion 3 ("Tab reaches the row"); it should instead state that Tab reaches the row via the anchor's native operability, reconciling with D-01/D-02.

**Anchor-in-cell + curated `aria-label` pattern** (`list.ts:347-360`, the Date and Activity cells):

```typescript
// list.ts:345-360
  const distanceKm = (row.distanceM / 1000).toFixed(1);

  const dateTd = document.createElement('td');
  dateTd.textContent = formatActivityDate(row.startDateLocal);
  tr.appendChild(dateTd);

  const activityTd = document.createElement('td');
  const anchor = document.createElement('a');
  anchor.href = `#/activity/${row.id}`;
  anchor.textContent = row.name; // athlete free text — textContent only (T-17-VW-01)
  anchor.setAttribute(
    'aria-label',
    `${row.name}, ${formatActivityDate(row.startDateLocal)}, ${distanceKm} km`
  );
  activityTd.appendChild(anchor);
  tr.appendChild(activityTd);
```

**D-04's curated `aria-label` shape to reuse everywhere a whole-row anchor needs one:**
`` `${row.name}, ${formatActivityDate(row.startDateLocal)}, ${distanceKm} km` ``
— note this is only assembled where a `name` field exists (list.ts, overview.ts's `renderActivityRow`/`renderRecentPrRow` paths). Records rows have **no activity name** (D-05: `PrTableRow`/`ProgressionRow` carry only `activityId`), so the Records anchor's accessible name/aria-label will necessarily be a different, Date-only shape — this is Claude's Discretion territory, not something to force into the same string template.

---

### `src/dashboard/views/list.ts` — `renderActivityRow` (div-row → anchor conversion, D-07)

**File:** `src/dashboard/views/list.ts:201-231`

```typescript
// list.ts:201-231
/**
 * Builds one `.activity-row`. Every athlete-authored string (`row.name`) is
 * written with `textContent` — an HTML-string assignment is never used —
 * per T-16-VW-01, the explicit deviation from `route-browser`'s known
 * unescaped-interpolation anti-pattern.
 */
export function renderActivityRow(row: DashboardIndexRow): HTMLElement {
  const rowEl = document.createElement('div');
  rowEl.className = 'activity-row';

  const nameEl = document.createElement('div');
  nameEl.className = 'activity-row__name';
  nameEl.textContent = row.name;
  rowEl.appendChild(nameEl);

  const metaEl = document.createElement('div');
  metaEl.className = 'activity-row__meta';
  const distanceKm = (row.distanceM / 1000).toFixed(1);
  metaEl.textContent = `${formatActivityDate(row.startDateLocal)} · ${distanceKm} km · ${formatDurationHms(row.movingTimeSec)} · ${formatPace(row.paceSecPerKm)}`;
  rowEl.appendChild(metaEl);

  appendStatusBadges(rowEl, row);

  const cta = document.createElement('a');
  cta.className = 'cta';
  cta.textContent = 'View Activity';
  cta.href = `#/activity/${row.id}`;
  rowEl.appendChild(cta);

  return rowEl;
}
```

**What D-07/D-01 changes:** `rowEl` becomes `document.createElement('a')` (element type only — `className = 'activity-row'` stays), `rowEl.href = '#/activity/${row.id}'` replaces the two-line `cta` block at `:224-227` (which is deleted entirely, not just re-homed), and `rowEl` needs the D-04 curated `aria-label` since it is now a whole-row link wrapping name + meta + badges. `appendStatusBadges` (`list.ts:181-199`) is confirmed to only emit non-interactive `<span>`s, so nesting it inside the new `<a>` is safe with no focusable-inside-focusable conflict.

**CSS follow-on:** `.activity-row` (`styles.css:335-343`) is `display: flex` today; since `<a>` is `inline` by default, `display: flex` must be preserved explicitly in the same rule (D-09/Integration Points already flags this) — no new selector needed, the existing `.activity-row` rule already declares `display: flex` so simply changing the element tag in `list.ts` is enough, **provided no browser default competes** (anchors have no competing `display` UA style beyond `inline`, so the existing rule fully overrides it).

---

### `src/dashboard/views/overview.ts` — `renderRecentPrRow` (D-08)

**File:** `src/dashboard/views/overview.ts:77-99`

```typescript
// overview.ts:77-99
/** A lighter-weight recent-PR row: name, local date, distance, and a PR-count badge — not the full `renderActivityRow`. */
function renderRecentPrRow(row: DashboardIndexRow): HTMLElement {
  const rowEl = document.createElement('div');
  rowEl.className = 'activity-row';

  const nameEl = document.createElement('div');
  nameEl.className = 'activity-row__name';
  nameEl.textContent = row.name;
  rowEl.appendChild(nameEl);

  const metaEl = document.createElement('div');
  metaEl.className = 'activity-row__meta';
  const distanceKm = (row.distanceM / 1000).toFixed(1);
  metaEl.textContent = `${formatActivityDate(row.startDateLocal)} · ${distanceKm} km`;
  rowEl.appendChild(metaEl);

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = `${row.prCount} PR`;
  rowEl.appendChild(badge);

  return rowEl;
}
```

**Exact three children per D-08** ("keeping its exact three children (name div, meta div, PR badge) — no hierarchy change, no new classes"): `nameEl` (`.activity-row__name`), `metaEl` (`.activity-row__meta`), `badge` (`.badge`). D-08's edit is: `rowEl` becomes `document.createElement('a')` with `href = '#/activity/${row.id}'` and a curated `aria-label`, exactly mirroring the `renderActivityRow` conversion above — nothing inside the three children moves or restructures (that is Phase 21's OVR-01/OVR-02).

`overview.ts` today imports only `renderActivityRow, formatActivityDate` from `list.ts` (`overview.ts:15`) — it has **no import of `navigateTo`/router** and **no import of the D-03 helper's future module**. If `renderRecentPrRow` needs the D-03 helper for anything beyond `href` (e.g. a shared hover/pointer marker class), that import must be added here.

---

### `src/dashboard/views/records.ts` — PR table (`buildPrTable`, D-05, 7→6 columns)

**File:** `src/dashboard/views/records.ts:336-411`

**Header declaration** (`:342-350`) — this is what a column drop touches:

```typescript
// records.ts:342-350
  const headers: { label: string; numeric: boolean }[] = [
    { label: 'Rank', numeric: true },
    { label: 'Time', numeric: true },
    { label: 'Pace', numeric: true },
    { label: 'Age-Grade', numeric: true },
    { label: 'Date', numeric: false },
    { label: 'Activity', numeric: false },   // <-- entire header REMOVED (D-05)
    { label: 'Flags', numeric: false },
  ];
```
D-05 drops the `{ label: 'Activity', numeric: false }` entry entirely — 7 headers become 6.

**Row construction and the CTA cell being removed** (`:360-407`):

```typescript
// records.ts:360-407 (abbreviated to the load-bearing parts)
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    // ... rankTd, timeTd, paceTd, ageTd appended (unchanged, :364-383) ...

    const dateTd = document.createElement('td');
    dateTd.textContent = formatActivityDate(row.startDate);
    tr.appendChild(dateTd);
    // ^ D-05: this cell gains the <a href="#/activity/{id}"> anchor instead
    //   of plain textContent — mirrors list.ts:352-359's anchor-in-cell shape.

    const activityTd = document.createElement('td');           // <-- ENTIRE
    const cta = document.createElement('a');                    //     BLOCK
    cta.className = 'cta';                                      //     REMOVED
    cta.textContent = 'View Activity';                           //     (:389-395)
    cta.href = `#/activity/${row.activityId}`;
    activityTd.appendChild(cta);
    tr.appendChild(activityTd);

    const flagsTd = document.createElement('td');
    // ... unchanged (:397-404) ...
    tr.appendChild(flagsTd);

    tbody.appendChild(tr);   // <-- D-03 helper attaches here: attachRowNavigation(tr, row.activityId)
  }
```

`row.activityId` is the field to pass into the D-03 helper (confirmed via `records-logic.ts:47-56`'s `PrTableRow` interface — it has `activityId: string`, no `name`).

---

### `src/dashboard/views/records.ts` — progression table (`buildProgressionTable`, D-05, 4→3 columns)

**File:** `src/dashboard/views/records.ts:472-516`

**Header declaration** (`:477-483`):

```typescript
// records.ts:476-483
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of ['Date', 'Time', 'Improvement', 'Run']) {   // <-- 'Run' REMOVED (D-05): 4 → 3
    const th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  }
```

**Row construction and the CTA cell being removed** (`:486-512`):

```typescript
// records.ts:486-512
  const tbody = document.createElement('tbody');
  for (const row of buildProgressionRows(series)) {
    const tr = document.createElement('tr');

    const dateTd = document.createElement('td');
    dateTd.textContent = formatActivityDate(row.startDate);
    tr.appendChild(dateTd);
    // ^ D-05: gains the anchor, same as the PR table's Date cell above.

    const timeTd = document.createElement('td');            // unchanged
    timeTd.textContent = formatEffortDuration(row.durationSec);
    tr.appendChild(timeTd);

    const improvementTd = document.createElement('td');     // unchanged
    improvementTd.textContent =
      row.improvementSec === null ? '—' : `−${formatEffortDuration(Math.abs(row.improvementSec))}`;
    tr.appendChild(improvementTd);

    const runTd = document.createElement('td');              // <-- ENTIRE
    const cta = document.createElement('a');                  //     BLOCK
    cta.className = 'cta';                                    //     REMOVED
    cta.textContent = 'View Activity';                          //     (:503-509)
    cta.href = `#/activity/${row.activityId}`;
    runTd.appendChild(cta);
    tr.appendChild(runTd);

    tbody.appendChild(tr);   // <-- D-03 helper attaches here: attachRowNavigation(tr, row.activityId)
  }
```

`ProgressionRow` (`records-logic.ts:188-194`) also carries only `activityId`, `startDate`, `durationSec`, `improvementSec` — no name, confirming D-05's Date-cell-carries-the-anchor decision for this table too.

**Both Records tables share `class="activity-table pr-table"`** (`records.ts:338`, `:474`) — same class as the four *non-clickable* tables listed below, which is exactly the D-10 problem: a `pr-table` class alone cannot distinguish clickable from non-clickable, confirmed by grep:
- `records.ts:608` (Riegel) — `table.className = 'activity-table pr-table'`
- `trends.ts:531` — `table.className = 'activity-table pr-table'`
- `trends.ts:1022` — `table.className = 'activity-table pr-table'`
- `detail-sections.ts:395` (approx, best-efforts table) — `table.className = 'activity-table pr-table'`

All four use the **identical class string** as the two Records tables this phase makes clickable. D-10's scoping mechanism (marker class from the D-03 helper, or a `:has()`/descendant selector keyed on the row anchor) must NOT key off `pr-table` — that class is shared by both clickable and non-clickable tables.

---

### New D-03 helper module

**Analog for module shape (DOM-touching, sibling of `router.ts`):** `src/dashboard/nav.ts:1-32`

```typescript
// nav.ts:1-23 — shape to mirror: file header explaining the DOM-construction
// discipline, then small focused exported functions, no *-logic.ts split
// because this module inherently touches document/window.
/**
 * Top nav bar: brand link, mobile hamburger collapse, the five NAV_ORDER
 * entries, and the light/dark/auto theme toggle (D-05, D-14).
 *
 * Every node is built with `document.createElement`/`createElementNS` +
 * `textContent` — no HTML-string assignment anywhere — establishing the
 * DOM-construction pattern plan 07's athlete free text must also follow
 * (T-16-SH-02).
 * Theming always goes through theme.ts; this file never touches
 * localStorage directly.
 */

import { NAV_ORDER } from './view.types.js';
import {
  applyThemeMode,
  cycleThemeMode,
  readStoredMode,
  watchSystemTheme,
  resolveEffectiveTheme,
  type Theme,
  type ThemeMode,
} from './theme.js';
```

**Analog for the logic to extract (the click/guard/navigate behavior itself):** `list.ts:336-343` (reproduced in full above under `buildTableRow`).

**Suggested import for the helper itself:** `import { navigateTo } from './router.js';` — same relative path `nav.ts` and `router.ts` share (siblings in `src/dashboard/`), confirming the helper belongs at `src/dashboard/<name>.ts`, not under `views/`.

**Confirmed: `records.ts` and `overview.ts` currently import NEITHER `navigateTo` nor `router.js` at all** (grep returned zero matches in both files) — the planner must add the import when either file starts calling the D-03 helper (or the helper itself imports `navigateTo` and the view files only import the helper, which is the cleaner seam and avoids `router.js` becoming a transitive import of every view).

**No `*-logic.ts` pairing.** Per CONTEXT.md `<code_context>` § Established Patterns: "Pure logic is split into `*-logic.ts` modules… DOM-touching code stays in the view module — which is why D-03's helper is not a `-logic` file." Contrast with the existing `*-logic.ts` + sibling `.test.ts` pattern below, included only to show what this helper explicitly is NOT:

```typescript
// list-logic.ts:1-8 — the *-logic.ts convention this helper does NOT follow
/**
 * Pure sort/filter/paginate/URL-state brain for the activity browser
 * (BROWSE-01..04, BROWSE-06). Every export in this module is DOM-free — no
 * `document`, no `window` — so it can be unit tested under vitest's
 * `environment: 'node'` (17-RESEARCH.md Pitfall 4: this repo has no jsdom).
 * `list.ts` and `list-logic.test.ts` are the only two files that may import
 * from here for the DOM/test split respectively.
 */
```

Since the D-03 helper's entire surface is DOM manipulation (`el.addEventListener`, `event.target`, `closest('a')`), it has **no unit-testable pure surface** by this repo's own `*-logic.ts` convention — CONTEXT.md flags this explicitly: "The planner should decide explicitly what, if anything, is assertable about the D-03 helper, and say so rather than leaving it implicit." Likely nothing is unit-testable here beyond a manual/checkpoint verification; if the planner finds any pure sub-piece (e.g. a guard-predicate function `isNavigationTarget(event): boolean` extracted separately from the DOM wiring), *that* piece could get a `.test.ts`, following the `records-logic.test.ts` / `list-logic.test.ts` structural precedent (import the named exports, `describe`/`it` blocks, no `document` reference anywhere in the test file).

---

### `src/dashboard/router.ts` — `navigateTo` (the only sanctioned hash-write path)

**File:** `src/dashboard/router.ts:170-177`

```typescript
// router.ts:170-177
/**
 * Sets `location.hash` to navigate to `path` (plus an optional query
 * string). Views use this instead of writing `location.hash` directly.
 */
export function navigateTo(path: string, query?: URLSearchParams): void {
  const queryString = query && query.toString().length > 0 ? '?' + query.toString() : '';
  window.location.hash = '#' + path + queryString;
}
```

`buildTableRow` calls it as `navigateTo(\`/activity/${row.id}\`)` (no leading `#`, no query) — the D-03 helper must call it the same way. `calendar.ts:156` calls it as `navigateTo(ROUTES.DETAIL.replace(':id', cell.activityIds[0]))` — an alternate call style using the `ROUTES` constant instead of a hand-built template string; either is acceptable, `ROUTES.DETAIL` is arguably more consistent with `view.types.ts`'s route registry but `list.ts`'s existing `buildTableRow` (the pattern being extracted) uses the template-string form, so preserving that form is the D-03-mandated "behavior preserved exactly" reading.

---

### `src/dashboard/styles.css` — hover/cursor/link rules

**`.activity-row`** (`styles.css:335-343`, must keep `display: flex` once it becomes an `<a>`):

```css
/* styles.css:335-343 */
.activity-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: var(--space-md);
}
```

**`.activity-table tbody tr` cursor/hover** (`styles.css:526-532`, the D-10 target to re-scope):

```css
/* styles.css:526-532 */
.activity-table tbody tr {
  cursor: pointer;
}

.activity-table tbody tr:hover {
  background: color-mix(in srgb, var(--surface) 92%, var(--text));
}
```

This is the exact `color-mix(in srgb, var(--surface) 92%, var(--text))` formula D-09 says the new row anchors must reuse verbatim.

**`.cta`** (`styles.css:368-386`, unmodified this phase but must survive — confirmed still used by 5 retry + 2 back CTAs per CONTEXT.md):

```css
/* styles.css:368-386 */
.cta {
  display: inline-block;
  background: var(--accent);
  color: #ffffff;
  border-radius: 6px;
  padding: var(--space-sm) var(--space-md);
  text-decoration: none;
  border: none;
}

.cta:hover,
.cta:focus-visible {
  background: color-mix(in srgb, var(--accent) 92%, var(--text));
}
```

**Confirmed: zero bare `a` rules exist in `styles.css`.** `grep -n '^a \|^a,\|^a{\| a {\|^a:'` returned no matches — CONTEXT.md's D-06 claim ("styles.css has zero rules for a bare `a` — the only `text-decoration: none` declarations are on `.app-nav__link` and `.cta`") is confirmed exactly. Every new row-anchor and D-06's bare `a` rule are genuinely new selectors with no existing analog to copy from directly; the closest available *token* precedent is `.cta`'s `text-decoration: none` and the `color-mix(...)` hover formula above — reuse the tokens (`var(--accent)`, `var(--text)`, `var(--text-secondary)`), not `.cta`'s visual treatment (a bare link should not look like a button).

---

### `src/dashboard/styles.test.ts` — text-assertion helpers (analog for new CSS assertions)

**File:** `src/dashboard/styles.test.ts:40-48` (`declarationsFor`) and `:125-138` (`selectorListDeclares`):

```typescript
// styles.test.ts:40-48
function declarationsFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ruleRegex = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  const match = cssNoComments.match(ruleRegex);
  if (!match) {
    throw new Error(`No rule found for selector: ${selector}`);
  }
  return match[1];
}
```

```typescript
// styles.test.ts:120-138
/**
 * Confirms some rule whose selector list includes `needle` declares
 * `declaration` in its body — covers both the combined-selector form
 * (`.theme-toggle, .app-nav__toggle { ... }`) and two separate rules.
 */
function selectorListDeclares(needle: string, declaration: string): boolean {
  const ruleHeadAndBody = RULE_SCANNER();
  let match: RegExpExecArray | null;
  while ((match = ruleHeadAndBody.exec(cssNoComments)) !== null) {
    const [, head, body] = match;
    const selectors = splitTopLevelSelectors(head);
    if (selectors.some((s) => s === needle) && body.includes(declaration)) {
      return true;
    }
  }
  return false;
}
```

**Representative existing assertion to copy the shape of** (`styles.test.ts:729-733`):

```typescript
// styles.test.ts:729-733
it('.activity-table tbody tr:hover mixes from var(--surface) toward var(--text)', () => {
  expect(declarationsFor('.activity-table tbody tr:hover')).toContain(
    'color-mix(in srgb, var(--surface) 92%, var(--text))',
  );
});
```

New D-06/D-09/D-10 assertions should follow this exact `declarationsFor(...)`/`selectorListDeclares(...)` + `toContain`/`toBe` shape — e.g. asserting a bare `a` rule declares a specific `color`/`text-decoration`, asserting the new row-anchor hover selector contains the same `color-mix` formula, and asserting the four innocent tables (`records.ts:608`, `trends.ts:531`, `trends.ts:1022`, `detail-sections.ts:395`) do NOT match whatever new scoped selector D-10 introduces (a negative assertion mirroring `styles.test.ts:719-721`'s `it('no bare button:hover rule exists', ...)`).

**Do not delete** — `styles.test.ts:723-727` (`.cta:hover` assertion) must keep passing, since `.cta` survives for the 7 remaining consumers:

```typescript
// styles.test.ts:723-727
it('.cta:hover mixes from var(--accent)', () => {
  expect(
    selectorListDeclares('.cta:hover', 'color-mix(in srgb, var(--accent) 92%, var(--text))'),
  ).toBe(true);
});
```

---

## Shared Patterns

### Row-click + anchor-in-cell (the D-03 extraction target)
**Source:** `src/dashboard/views/list.ts:333-360` (`buildTableRow`)
**Apply to:** The new D-03 helper module, then called from `list.ts` (post-refactor), `records.ts` (`buildPrTable`, `buildProgressionTable`).
**Guard:** `(event.target as HTMLElement).closest('a')` — mouse clicks on the anchor itself must not double-navigate via the row's own click listener.

### Navigation chokepoint
**Source:** `src/dashboard/router.ts:174-177` (`navigateTo`)
**Apply to:** The D-03 helper's internal call, and any direct `href` assignment in the div-row anchors (`renderActivityRow`, `renderRecentPrRow`) — those use `href = '#/activity/${id}'` directly since they are real `<a>` elements (native navigation, no listener needed), while table rows call `navigateTo(...)` from a listener because the `<tr>` itself is not a link.

### Shared hover formula (Phase 19 D-06/D-08, reused verbatim per D-09)
**Source:** `src/dashboard/styles.css:530-532`
```css
background: color-mix(in srgb, var(--surface) 92%, var(--text));
```
**Apply to:** New row-anchor hover rules (Overview and Activities mobile card rows) — must be byte-identical to this declaration, not a re-derived equivalent.

### Curated `aria-label` shape (D-04)
**Source:** `src/dashboard/views/list.ts:355-358`
```typescript
anchor.setAttribute(
  'aria-label',
  `${row.name}, ${formatActivityDate(row.startDateLocal)}, ${distanceKm} km`
);
```
**Apply to:** `renderActivityRow`'s and `renderRecentPrRow`'s new whole-row anchors (both have `row.name` available). Records' two tables have **no name field** on their row types (`PrTableRow`, `ProgressionRow` — confirmed via `records-logic.ts:47-56`, `:188-194`), so their Date-cell anchor needs an equivalently curated but differently-shaped label (Claude's Discretion) — do not force the same template where the data does not support it.

### `textContent`-only for athlete free text (T-16-VW-01 / T-17-VW-01)
**Source:** `src/dashboard/views/list.ts:354` (`anchor.textContent = row.name;` with inline comment)
**Apply to:** Every new anchor that carries `row.name` or any athlete-authored string — never an HTML-string assignment.

## No Analog Found

| File/Rule | Role | Data Flow | Reason |
|-----------|------|-----------|--------|
| D-06 bare `a { color: ...; text-decoration: ...; }` rule | config (CSS) | n/a | Confirmed zero existing bare-`a` rules in `styles.css`; nearest precedent is token reuse from `.cta` and `.activity-table tbody tr:hover`, not a structural analog — this is genuinely new CSS, built from existing tokens per D-06's constraint. |
| D-10 scoping marker/selector (e.g. `.activity-table--clickable` or a `:has()` selector) | config (CSS) + DOM (helper-applied class) | n/a | No existing marker-class or `:has()`-scoping precedent in this codebase's table styling; mechanism is explicitly Claude's Discretion in CONTEXT.md. |

## Metadata

**Analog search scope:** `src/dashboard/` (views/, styles.css, styles.test.ts, router.ts, nav.ts) — matches CONTEXT.md's "Files this phase changes" and "read-only but affected" lists exactly; no search outside `src/dashboard/` was needed since CONTEXT.md's `<canonical_refs>` already pre-identified every touched file with line numbers.
**Files scanned:** `list.ts`, `overview.ts`, `records.ts`, `records-logic.ts` (interfaces only), `router.ts`, `nav.ts`, `calendar.ts` (:95-163), `styles.css` (:320-560), `styles.test.ts` (:1-160, :700-740), `trends.ts` (:525-540, :1015-1030), `detail-sections.ts` (:388-400), `list-logic.ts`/`list-logic.test.ts` (headers only, for the `*-logic.ts` contrast).
**Pattern extraction date:** 2026-08-13
