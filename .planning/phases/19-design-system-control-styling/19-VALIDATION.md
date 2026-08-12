---
phase: 19
slug: design-system-control-styling
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-12
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `19-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (installed) |
| **Config file** | `vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts']` |
| **Quick run command** | `npx vitest run src/dashboard/styles.test.ts` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | ~1–2 seconds (884 tests passing as of Phase 18 close) |

**Hard constraint (verified in `19-RESEARCH.md`, not assumed).** `vitest.config.ts` sets
`environment: 'node'`, and `package.json` devDependencies contain `vitest` and **nothing else
test-related** — no `jsdom`, no `happy-dom`, no `@testing-library/*`, no `puppeteer`, no
`playwright`. **There is no CSSOM and no rendering engine available to any automated test in
this repo.** Every claim in this phase is therefore provable by exactly one of two mechanisms:

- **(a) a text assertion** over the literal characters of `src/dashboard/styles.css`, or
- **(b) the human browser checkpoint** (ROADMAP success criterion 5).

There is no third option. This phase authorizes **no new test dependency**, so no plan may
propose one as an escape hatch. A text assertion proves a *rule exists in the source*; it
proves nothing about computed styles, box rendering, native picker chrome, perceptual
contrast, or click behavior.

---

## Sampling Rate

- **After every task commit:** `npx vitest run src/dashboard/styles.test.ts` (sub-second; only the file this phase touches)
- **After every plan wave:** `npm test` **plus** `npx tsc --noEmit -p tsconfig.json`
  (this phase makes zero TypeScript changes, so these are primarily a scope-creep tripwire)
- **Before `/gsd-verify-work`:** `npm test` green, `npm run build-widgets && npm run verify-dashboard` green, **and** the real-browser human checkpoint complete
- **Max feedback latency:** ~5 seconds (unit suite sub-second; build + `verify-dashboard` adds the rest)

---

## Per-Task Verification Map

*Seeded from requirements before planning; reconciled against the plans that actually ship at
phase close (the Phase 18 pattern). `{plan}` cells are filled by the planner.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| control-baseline (D-01..D-04) | 19-02 | 2 | UI-01 | T-19-CASCADE-05, T-19-A11Y-06, T-19-FONT-07, T-19-FALSEGREEN-08 | N/A | text assertion | `npx vitest run src/dashboard/styles.test.ts` | ✅ | ✅ green |
| button baseline + hover + disabled (D-05..D-08) | 19-03 | 3 | UI-02 | T-19-CASCADE-09, T-19-A11Y-10, T-19-A11Y-11, T-19-ACT-12, T-19-SPEC-13 | N/A | text assertion | `npx vitest run src/dashboard/styles.test.ts` | ✅ | ✅ green |
| focus ring + clip fixes (D-09..D-12) | 19-04 | 4 | UI-02 | T-19-A11Y-14, T-19-A11Y-15, T-19-A11Y-16, T-19-CASCADE-17, T-19-FALSEGREEN-18 | N/A | text assertion + closed-form contrast computation (already discharged, see below) | `npx vitest run src/dashboard/styles.test.ts` | ✅ | ✅ green |
| radius tokens + panel/spacing rhythm (D-13, D-14) | 19-01 | 1 | UI-03 | T-19-CASCADE-01, T-19-CASCADE-02, T-19-DIFF-03 | N/A | text assertion | `npx vitest run src/dashboard/styles.test.ts` | ✅ | ✅ green |
| Activities styling pickup / row-click preservation | 19-02, 19-03 | 2, 3 | ACT-01 | T-19-ACT-12, T-19-CASCADE-05 | N/A | **manual only** — no text assertion is possible (`list.ts` is unmodified by design) | — | n/a | ⬜ pending (Task 2) |
| publish-shape regression | 19-05 | 5 | all | T-19-PUBLISH-04 (19-01, transferred), T-19-PUBLISH-25 | Assets resolve under the `/strava-widgets` prefix, not the server root | integration | `npm run build-widgets && npm run verify-dashboard` | ✅ (existing) | ✅ green (37 checks passed, 0 failures) |
| human browser checkpoint | 19-05 | 5 (final) | UI-01, UI-02, UI-03, ACT-01 | T-19-VERIFY-19, T-19-VERIFY-20, T-19-VERIFY-21, T-19-A11Y-22, T-19-CASCADE-23, T-19-ACT-24, T-19-PUBLISH-25 | N/A | **manual, BLOCKING** | — | n/a | ⬜ pending (Task 2) |
| `:where(:not(...))` hover exclusion list (derived correction to D-06) | 19-03 | 3 | UI-02 | T-19-CASCADE-09 | N/A | **manual only** — rendered outcome of the exclusion list cannot be seen by a text assertion | — | n/a | ⬜ pending (Task 2, rows 10-11) |
| `.cta:hover` repair (derived correction to D-06) | 19-03 | 3 | UI-02 | T-19-SPEC-13 | N/A | **manual only** — perceptual distinguishability of a `color-mix()` result | — | n/a | ⬜ pending (Task 2, row 4) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Wave note.** The seeded map assumed all four implementation rows shipped in wave 1. They did not: every plan in this phase writes to `src/dashboard/styles.css`, so the four implementation plans were sequenced deliberately as waves 1-4 (19-01 wave 1, 19-02 wave 2, 19-03 wave 3, 19-04 wave 4) rather than run concurrently, and this plan (19-05) is wave 5. The "Activities styling pickup" row spans two plans (19-02 delivers the control baseline that reaches Activities' 10 control sites; 19-03 delivers the button baseline, hover and disabled treatment plus the row-hover retrofit) — both list `ACT-01` in their own `requirements-completed`, so both are cited here rather than picking one arbitrarily.

**Sampling continuity note.** Because this phase's automated surface is a single test file,
every implementation task has an automated verify available at sub-second latency — there is
no run of 3 consecutive tasks without automated feedback. The continuity risk here is the
opposite one: automated green is *cheap and near-meaningless*, so it must not be mistaken for
proof. See Manual-Only Verifications.

---

## Wave 0 Requirements

**None.** `src/dashboard/styles.test.ts` already exists (142 lines pre-phase) and already
contained the exact helpers the seeded assertions needed — `declarationsFor()` and
`selectorListDeclares()`. No new test file, no new fixture, no framework install. The five new
`describe` blocks specified by `19-UI-SPEC.md` are ordinary Phase 19 implementation work, not a
Wave 0 infrastructure gap.

**In-phase addition, confirmed not a Wave 0 gap.** Plan 19-04 (Task 2) added exactly one new
helper, `ruleWithHeadContaining()`, because `selectorListDeclares()` splits a rule head on `,`
and requires an exact post-trim token match — but plan 19-03's shared hover selector's head
contains commas *inside* `:where(:not(…))` (`:disabled`, `[aria-disabled="true"]`,
`.pagination__button--current`, `.segmented__option--active`, four `.calendar-day--tint-N`
classes), so no comma-split fragment ever equals the full head. This was a same-day interaction
discovered while writing 19-04's own assertions against 19-03's already-shipped rule, not a
pre-existing infrastructure gap the phase inherited — nothing is ticked here that Wave 0 did not
actually need to deliver. `src/dashboard/styles.test.ts` now carries 341 lines / 40 tests total
(15 pre-Phase-19 + 25 added across 19-04's five `describe` blocks), confirmed still green in
this task's `npm test` run (909/909 passing, see Task 1 acceptance criteria below).

---

## Manual-Only Verifications

**This table is the human checkpoint's agenda.** Everything listed here is unprovable by any
automated test in this repository. This project has shipped rendering defects behind a fully
green automated gate **three times** (Phase 16's black page at 15/15 green; Phase 16 `16-09`;
Phase 17 `17-15`) — so a green suite is a precondition for opening the checkpoint, never a
substitute for it.

Row numbers below are referenced by plan 19-05's checkpoint agenda (`<how-to-verify>`) and by
the Gap-Closure Record protocol; they are not a table column, to keep the header matching the
seeded `| Behavior | ...` shape.

| Behavior | Requirement | Why Manual | Test Instructions | Observation |
|----------|-------------|------------|-------------------|--------------|
| 1. Every text/date/number/search input renders with the intended border, padding and background — no unstyled browser default anywhere | UI-01 | No CSSOM, no rendering engine. A text assertion proves the `input, select, textarea` rule *exists*; it cannot see a rendered box. | Load all five screens; visually inspect every input. Confirm none reads as a browser default. |  |
| 2. Native chrome (date picker, month picker, number spinners, search clear-X) still re-renders correctly per theme under D-02's "style the box only" rule | UI-01 | Native pseudo-element rendering is entirely outside CSS text assertions. | Open the date and month pickers in both themes; use the number spinners; type into search and click the clear-X. |  |
| 3. Buttons and selects read as one treatment after the low-specificity `button` baseline cascades under 12 existing classes | UI-02 | Cascade outcome is a computed-style question; there is no CSSOM. | Compare all 12 button treatments across the five screens. Confirm none regressed. |  |
| 4. `.cta` hover is now visibly distinguishable (the dead `.cta:hover` bug from D-06) | UI-02 | Perceptual distinguishability of a `color-mix()` result. | Hover the primary CTA in both themes; confirm it visibly changes. |  |
| 5. All five disabled states (D-07) render as visibly disabled | UI-02 | Requires driving the app into each disabled state and looking. | Pagination prev/next at first/last page; overlay checkbox at cap; Banister toggle; calendar `disabled` and `aria-disabled` days. |  |
| 6. The `:focus-visible` ring renders **fully unclipped** on `.segmented`, `.records-jump`, `.splits-scroll`, and on the two `--accent-strong` filled active states | UI-02 | A text assertion can prove `overflow: hidden` was removed from `.segmented`; it cannot prove no *other* ancestor clips the ring, nor that the ring is perceptually clear. | Tab through every control on all five screens, **in both themes**. Scrutinize light theme especially — 3.40:1 is the narrower margin. |  |
| 7. Spacing, density and card treatment read as one rhythm across all five screens | UI-03 | Inherently perceptual; no assertion over CSS source can judge "rhythm". | Side-by-side comparison of all five screens, including Overview (D-14, shared treatment only). |  |
| 8. **Activities row-click interaction model is functionally and visually unchanged** | ACT-01 | `list.ts` is unmodified by design (D-01/D-05), so there is nothing to assert. This is the **single highest-risk untestable claim in the phase** — a CSS specificity mistake (`pointer-events`, `cursor`) could silently break the reference pattern Phase 20 depends on. | Click rows to navigate; Tab + Enter to activate by keyboard; return from detail and confirm the highlight still flashes; exercise sort, filter and pagination. Confirm only visual chrome changed. |  |
| 9. `.activity-table tbody tr:hover` retrofit (D-08) — an **acknowledged intentional deviation** from "visually unchanged" in dark theme | ACT-01 | Deliberate visual change; must be a recorded decision, not a checkpoint surprise. | Call out explicitly at the checkpoint. Hover table rows in **both** themes; confirm dark mode now lightens rather than darkens. |  |
| 10. The two `--accent-strong` fills (current pagination page, active segmented option) keep their solid fill with readable white text while hovered | UI-02 | Derived correction to D-06 (plan 19-03, `T-19-CASCADE-09`). The `:where(:not(...))` exclusion list's rendered outcome is a computed cascade result; a text assertion can prove the exclusion tokens are present in the selector but not that the browser actually honors them. | Hover the current pagination page number on Activities, and the active option of the detail view's x-axis segmented control. Both must keep their solid `--accent-strong` fill with white label readable. If either turns grey-on-white while hovered, the exclusion list failed and this is a blocking defect (roughly 1.1:1 contrast). |  |
| 11. The calendar distance-tint scale (tint-1..tint-4) keeps its accent tint while hovered rather than flattening to grey | UI-02 | Derived correction to D-06 (plan 19-03, `T-19-CASCADE-09`). Same exclusion mechanism as row 10; a rendered cascade outcome, not provable from CSS text. | On Calendar, hover several days across the tint range (tint-1 faintest through tint-4 strongest). Each must keep its accent tint while hovered so the scale still reads under the pointer. |  |
| 12. The segmented control's rounded silhouette, now produced by `:first-child`/`:last-child` end-child radii instead of parent `overflow: hidden` clipping, shows no square inner corner, seam or sliver, and no change to the option divider | UI-02 | D-10 (plan 19-04). This is a real change of visual mechanism, not a pure refactor — whether the rendered silhouette still matches is a perceptual/computed-box question no text assertion can answer. | Look closely at all four corners of the x-axis toggle in both themes: no square inner corner, no visible seam or sliver between the container border and the end options, and no change to the divider between options. |  |
| 13. Button text size after `font: inherit` (`.cta`, `.pagination__button`, `.segmented__option`, `.chip__remove` move from the ~13.3px UA button default to the inherited 16px body size) still fits its 32px control height without crowding or wrapping | UI-02, UI-03 | Consequence of D-05 (plan 19-03). A real, visible size increase is a rendering/layout question — whether it crowds or wraps requires a rendered box, which no text assertion can produce. | Confirm each of the four classes still fits its 32px control height, that pagination numbers and segmented labels are not crowded or wrapping, and that the `.chip__remove` × glyph still sits correctly inside its 24px box. Record whether the new size is acceptable or should be pinned in a follow-up. |  |

### Contrast requirement (UI-02) — discharged by computation, not by test

Per D-11, the ring's inner halo is always `--bg`, so the accent ring is adjacent to exactly
one color per theme. Both ratios were computed independently in `19-RESEARCH.md` from raw hex
via the W3C relative-luminance formula and match `19-UI-SPEC.md`:

| Theme | Ring | Adjacent | Ratio | 3:1 non-text threshold |
|-------|------|----------|-------|------------------------|
| Light | `--accent` `#fc4c02` | `--bg` `#ffffff` | **3.40:1** | ✅ pass |
| Dark | `--accent` `#ff6b35` | `--bg` `#1a1a2e` | **6.02:1** | ✅ pass |

No luminance helper is added to the test suite (D-11). The **numeric** claim is closed; the
human checkpoint verifies only that the ring actually *renders*.

---

## Rules that shipped

Every selector this phase added or edited in `src/dashboard/styles.css`, so a future phase can
audit the element-level baseline without re-deriving it from the four plan summaries:

1. **Two `:root` radius tokens** — `--radius-control: 4px`, `--radius-panel: 8px` (plan 19-01, D-13), theme-invariant, declared once in the bare `:root` block.
2. **`input, select, textarea` baseline** (plan 19-02, D-01) — `border`, `background`, `color`, `padding`, `border-radius: var(--radius-control)`, `min-height: 32px`, `font: inherit`.
3. **`input[type="button"], input[type="checkbox"], input[type="radio"]` type-reset override** (plan 19-02, D-01) — excludes native type-restricted inputs (the live overlay-cap checkbox) from the text-field box treatment.
4. **`button` baseline** (plan 19-03, D-05) — `font: inherit`, `min-height: 32px`, `cursor: pointer`, `border-radius: var(--radius-control)`.
5. **Scoped shared hover** — `button:where(:not(:disabled, [aria-disabled="true"], .pagination__button--current, .segmented__option--active, .calendar-day--tint-1, .calendar-day--tint-2, .calendar-day--tint-3, .calendar-day--tint-4)):hover` (plan 19-03, D-06, corrected per `T-19-CASCADE-09`) — `background: color-mix(in srgb, var(--surface) 92%, var(--text))`.
6. **`:disabled, [aria-disabled="true"]` rule** (plan 19-03, D-07) — `color: var(--text-secondary)`, `opacity: 0.6`, `cursor: default`; the file's first disabled rule ever.
7. **Repaired `.cta:hover, .cta:focus-visible`** (plan 19-03, D-06 derived correction, `T-19-SPEC-13`) — `background: color-mix(in srgb, var(--accent) 92%, var(--text))`, replacing a dead byte-identical-to-base declaration.
8. **Retrofitted `.activity-table tbody tr:hover`** (plan 19-03, D-08) — `background: color-mix(in srgb, var(--surface) 92%, var(--text))`, replacing a literal-`black` mix that over-darkened dark theme; acknowledged intentional deviation from "visually unchanged".
9. **Replaced `:focus-visible`** (plan 19-04, D-09/D-12) — `outline: none; box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);`, replacing the old accent-only `outline`.
10. **`.segmented` minus its `overflow: hidden`** (plan 19-04, D-10) — clipping removed so the focus ring is no longer clipped on the active option.
11. **Two `.segmented__option` end-child radius rules** (plan 19-04, D-10) — `:first-child` and `:last-child` reproduce the previously-clipped rounded silhouette via `var(--radius-control)`.
12. **`.splits-scroll`'s padding** (plan 19-04, D-09) — `padding: var(--space-xs)` added for focus-ring clearance.
13. **Five D-13 panel/grid edits** (plan 19-01) — `.error-state`/`.stub-panel`, `.empty-state`, `.calendar-picker`, `.config-notice` all gained `border-radius: var(--radius-panel)` + `padding: var(--space-lg)`; `.stat-grid`'s `gap` corrected from `--space-xl` (32px) to `--space-lg` (24px).

Thirteen groups, matching the count enumerated in this task's action text and acceptance criteria.

---

## Human Checkpoint Staging (BLOCKING)

Verified against the sequence Phase 18 plan `18-16` actually ran and the developer approved.
Phase 19 introduces no new async chunks, so Phase 17's heavier custom-server approach is not
needed.

```bash
# 1. Full automated gate — all four must exit 0 before opening the checkpoint
npm test
npx tsc --noEmit -p tsconfig.json
npm run build-widgets
npm run verify-dashboard

# 2. Mount the built output under a production-shaped path
mkdir -p /tmp/gh-pages && ln -sfn "$PWD/dist/widgets" /tmp/gh-pages/strava-widgets
cd /tmp/gh-pages && python3 -m http.server 8099

# 3. Open all five screens with devtools Console visible for the whole session:
#    http://localhost:8099/strava-widgets/#/          (Overview)
#    http://localhost:8099/strava-widgets/#/list      (Activities)
#    http://localhost:8099/strava-widgets/#/calendar  (Calendar)
#    http://localhost:8099/strava-widgets/#/records   (Records)
#    http://localhost:8099/strava-widgets/#/trends    (Trends)
```

**Do not serve at the bare server root.** `scripts/verify-dashboard-publish.mjs` carries
`MOUNT_PREFIX = '/strava-widgets'` specifically because Phase 16 shipped a black page behind a
15/15 green gate that only mounted at the root.

**Checkpoint result protocol (16-09 / 17-15 precedent).** If any row above fails, record it
**verbatim as gap-closure work** and mark the checkpoint **PARTIAL** — do not patch defects
under checkpoint pressure, and list only the confirmed-clean rows in `requirements-completed`.

---

## Validation Sign-Off

- [x] All tasks have an automated verify, or are explicitly listed as Manual-Only above
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing infrastructure suffices)
- [x] No watch-mode flags (`vitest run` / `npm test` only)
- [x] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter *(set at phase close, after the human checkpoint)*

**Approval:** pending
