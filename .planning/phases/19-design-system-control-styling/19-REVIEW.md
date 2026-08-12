---
phase: 19-design-system-control-styling
reviewed: 2026-08-12T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/dashboard/styles.css
  - src/dashboard/styles.test.ts
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-08-12
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the two files phase 19 touched (`src/dashboard/styles.css`,
`src/dashboard/styles.test.ts`) against the diff from `670b3ec..HEAD`, cross-checking
every consuming `.ts` view file (`nav.ts`, `calendar.ts`, `list.ts`, `trends.ts`,
`records.ts`, `detail.ts`, `detail-map.ts`, `detail-charts.ts`) to see where the new
element-level `input`/`select`/`textarea`/`button` baselines and the unscoped
`:disabled`/`[aria-disabled="true"]` rule actually land in the running app, not just
in the stylesheet. Per the task's exclusion list, the three already-confirmed defects
(the `*/`-in-comment token swallow, the occluded segmented-control focus ring, and the
non-greedy comment-stripping regex) are not re-reported below; one new consequence of
the first is called out under WR-01.

Findings in scope for this review:

- **The unscoped `:disabled, [aria-disabled="true"]` rule** — traced every live
  `.disabled = true` / `setAttribute('aria-disabled', ...)` call site across the
  dashboard (pagination prev/next, the detail-charts overlay-cap checkbox, the
  Banister toggle, `calendar-day--outside`, `calendar-day--rest`). Every one is a
  `<button>` or `input[type="checkbox"]`. The rule does not currently reach anything
  it shouldn't — no leakage found.
- **`font: inherit` on `input, select, textarea` and on `button`** — checked whether
  it clobbers `.pr-table__numeric`'s `font-variant-numeric: tabular-nums`.
  `.pr-table__numeric` is applied only to `<td>`/`<th>` cells (`detail-sections.ts`,
  `trends.ts`, `records.ts`), never to a form control or button, so the two rules
  never compete. No defect found there.
- **The `button:where(:not(...)):hover` exclusion list** — verified `:where()`
  correctly contributes zero specificity while its `:not()` argument still filters
  matching, and that every exclusion (`.pagination__button--current`,
  `.segmented__option--active`, `.calendar-day--tint-1..4`) is required and
  sufficient given the real DOM (e.g. calendar rest/outside days never reach the
  tint exclusions because they're already caught by the `:disabled`/
  `[aria-disabled="true"]` arm). Sound.
- **`.segmented__option:first-child`/`:last-child`** — confirmed every `.segmented`
  container in the app (`detail-charts.ts` 2-option toggle, `trends.ts` 3-option
  training-load window, `trends.ts` 5-tab tablist) appends its option buttons as the
  only direct children, so `:first-child`/`:last-child` reliably targets the visual
  ends. Sound.
- Three findings below are new, provable issues not on the known-defects list.

## Warnings

### WR-01: `.segmented`'s own `border-radius` was left as a literal while the rule block around it was edited to introduce the token

**File:** `src/dashboard/styles.css:806-831`

**Issue:** This phase edited the `.segmented` rule directly — removing
`overflow: hidden` and adding two new child rules that key off
`var(--radius-control)` — but left `.segmented`'s own `border-radius: 4px;`
(line 809) as a hardcoded literal instead of migrating it to the new token. Every
other rule this phase touched in the same "radius scale" effort (the four panel
selectors, the two segmented end-children, the input/select/textarea/button
baselines) uses `var(--radius-control)`/`var(--radius-panel)`. This one slipped
through, and it's the exact rule whose sibling lines were edited in this diff, so it
isn't an out-of-scope pre-existing gap — it's an incomplete retrofit of the block
the plan was actively rewriting.

Consequence beyond what's already recorded for the `--radius-control` comment-token
defect: because `.segmented`'s own radius is a literal, it is *unaffected* by that
bug and still renders a 4px rounded corner today, while `.segmented__option:first-
child`/`:last-child` (which do use the broken token) currently fall back to
`border-radius: 0`. So right now the container's rounded corner sliver and its
square-cornered end buttons visibly disagree with each other — not just "no
rounding," but a container/child radius mismatch. This will silently resolve itself
once the token bug is fixed, but it's worth knowing before then, and the underlying
literal-vs-token inconsistency will persist even after that fix and can drift again
if `--radius-control`'s value ever changes.

**Fix:**
```css
.segmented {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
}
```

### WR-02: The bare `button` baseline's justification comment is inaccurate for real, class-less buttons — first-time visual change untracked

**File:** `src/dashboard/styles.css:1187-1202`

**Issue:** The comment above the `button { font: inherit; min-height: 32px;
cursor: pointer; border-radius: var(--radius-control); }` rule asserts: "Every one
of the 12 existing button-class rules already declares its own colors/backgrounds
and, where relevant, its own min-width/min-height, so this baseline only fills in
what those classes leave unset — nothing currently rendered changes shape or
color." That's only true for `<button>` elements that carry one of those 12
classes. At least three real, shipped buttons carry **no class at all** and were
therefore never touched by any prior CSS rule in this file:

- `src/dashboard/views/calendar.ts:74-76` — the multi-run picker's "Close" button
- `src/dashboard/views/calendar.ts:257-259` — the month-nav "‹ {month}" button
- `src/dashboard/views/calendar.ts:265-267` — the month-nav "{month} ›" button

For these three, this rule is not "filling in what a class leaves unset" — it is
the *first* CSS ever applied to them. Concretely: `font: inherit` changes their
text from the browser's UA default button font (commonly ~13px) to the inherited
page body font (16px, via `--font-stack`), `min-height: 32px` imposes a height
floor that previously had none, and `border-radius: var(--radius-control)` rounds
corners that previously used the platform's native button chrome. This is a real,
visible appearance change on production UI (the calendar month-navigation controls
are on every calendar page load), not merely a "fill in the gaps" no-op, and the
governing comment's blanket claim will mislead the next person who greps for "why
does this button look different" or audits this rule for safety before further
edits. It's also unclear whether these three specific buttons were in view during
plan 19-05's human validation checkpoint, since the checkpoint's documented scope
(per `styles.test.ts`'s banner comment) centers on the segmented control, hover, and
disabled states, not the calendar's unclassed navigation controls.

**Fix:** Either correct the comment to acknowledge the class-less exception, or
close the gap by giving these three buttons an explicit class (e.g. reuse
`.filter-toggle`-style quiet-button treatment, or a new shared `.icon-button`/
`.text-button` class) so their styling is intentional and covered by the same
audit trail as the other 12:
```ts
// calendar.ts
closeBtn.className = 'calendar-picker__close'; // or an existing quiet-button class
prevBtn.className = 'calendar-nav__button';
nextBtn.className = 'calendar-nav__button';
```

### WR-03: `selectorListDeclares` test helper's comma-splitting collides with the new `:not()`-argument selector, creating a latent false-pass risk

**File:** `src/dashboard/styles.test.ts:44-57`, interacting with `src/dashboard/styles.css:1222-1233`

**Issue:** `selectorListDeclares` splits a rule's head on `,` and requires an exact
post-trim match against `needle`. The new shared hover selector,

```css
button:where(:not(
      :disabled,
      [aria-disabled="true"],
      .pagination__button--current,
      .segmented__option--active,
      .calendar-day--tint-1,
      .calendar-day--tint-2,
      .calendar-day--tint-3,
      .calendar-day--tint-4
    )):hover {
```

contains commas *inside* the `:not()` argument list. When `selectorListDeclares`'s
regex splits this rule's head on `,`, it produces fragments that, after `.trim()`,
are byte-identical to real, unrelated selectors elsewhere in the file — most
concretely `[aria-disabled="true"]` (verified empirically: splitting the actual
file text yields the exact token `[aria-disabled="true"]` as one fragment). That
exact string is also the needle used at `styles.test.ts:249`:

```ts
expect(selectorListDeclares('[aria-disabled="true"]', 'opacity: 0.6')).toBe(true);
```

`selectorListDeclares` iterates every rule head/body pair in the file and returns
`true` on the first head whose selector list contains `needle` AND whose body
contains `declaration`. For the hover rule's coincidental `[aria-disabled="true"]`
fragment, the body is `background: color-mix(in srgb, var(--surface) 92%,
var(--text));`, which does not contain `opacity: 0.6` — so the loop happens to fall
through to the real `:disabled, [aria-disabled="true"] { ... }` rule and return the
correct result today. But this is passing by accident of what the hover rule's body
currently contains, not because the helper is selector-boundary-safe. If a future
edit ever added `opacity: 0.6` to the shared hover rule for an unrelated reason (or
reordered the rules so the coincidental match is evaluated after a real deletion),
this assertion would return `true` even if the genuine `:disabled` rule were
deleted — the same class of "test still passes for the wrong reason" failure mode
that produced the already-known non-greedy-regex defect. The test file's own
docstring for `ruleWithHeadContaining` (lines 59-70) shows the author was aware of
exactly this comma-inside-`:not()` hazard for one helper, but the same file
continues to use the comma-naive `selectorListDeclares` against needles that
literally collide with this selector's internal arguments.

**Fix:** Make `selectorListDeclares` robust to commas nested inside parentheses
when splitting the selector list, e.g. only split on top-level commas:
```ts
function splitTopLevelSelectors(head: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of head) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current.trim());
  return parts;
}
```
and use it in place of `head.split(',').map((s) => s.trim())`.

---

_Reviewed: 2026-08-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
