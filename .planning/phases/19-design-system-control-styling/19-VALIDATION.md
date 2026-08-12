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
| control-baseline (D-01..D-04) | TBD | 1 | UI-01 | — | N/A | text assertion | `npx vitest run src/dashboard/styles.test.ts` | ✅ | ⬜ pending |
| button baseline + hover + disabled (D-05..D-08) | TBD | 1 | UI-02 | — | N/A | text assertion | `npx vitest run src/dashboard/styles.test.ts` | ✅ | ⬜ pending |
| focus ring + clip fixes (D-09..D-12) | TBD | 1 | UI-02 | — | N/A | text assertion + closed-form contrast computation (already discharged, see below) | `npx vitest run src/dashboard/styles.test.ts` | ✅ | ⬜ pending |
| radius tokens + panel/spacing rhythm (D-13, D-14) | TBD | 1 | UI-03 | — | N/A | text assertion | `npx vitest run src/dashboard/styles.test.ts` | ✅ | ⬜ pending |
| Activities styling pickup / row-click preservation | TBD | 2 | ACT-01 | — | N/A | **manual only** — no text assertion is possible (`list.ts` is unmodified by design) | — | n/a | ⬜ pending |
| publish-shape regression | TBD | 2 | all | — | Assets resolve under the `/strava-widgets` prefix, not the server root | integration | `npm run build-widgets && npm run verify-dashboard` | ✅ (existing) | ⬜ pending |
| human browser checkpoint | TBD | final | UI-01, UI-02, UI-03, ACT-01 | — | N/A | **manual, BLOCKING** | — | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity note.** Because this phase's automated surface is a single test file,
every implementation task has an automated verify available at sub-second latency — there is
no run of 3 consecutive tasks without automated feedback. The continuity risk here is the
opposite one: automated green is *cheap and near-meaningless*, so it must not be mistaken for
proof. See Manual-Only Verifications.

---

## Wave 0 Requirements

**None.** `src/dashboard/styles.test.ts` already exists (142 lines) and already contains the
exact helpers the new assertions need — `declarationsFor()` and `selectorListDeclares()`. No
new test file, no new fixture, no framework install. The five new `describe` blocks specified
by `19-UI-SPEC.md` are ordinary Phase 19 implementation work, not a Wave 0 infrastructure gap.

---

## Manual-Only Verifications

**This table is the human checkpoint's agenda.** Everything listed here is unprovable by any
automated test in this repository. This project has shipped rendering defects behind a fully
green automated gate **three times** (Phase 16's black page at 15/15 green; Phase 16 `16-09`;
Phase 17 `17-15`) — so a green suite is a precondition for opening the checkpoint, never a
substitute for it.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Every text/date/number/search input renders with the intended border, padding and background — no unstyled browser default anywhere | UI-01 | No CSSOM, no rendering engine. A text assertion proves the `input, select, textarea` rule *exists*; it cannot see a rendered box. | Load all five screens; visually inspect every input. Confirm none reads as a browser default. |
| Native chrome (date picker, month picker, number spinners, search clear-X) still re-renders correctly per theme under D-02's "style the box only" rule | UI-01 | Native pseudo-element rendering is entirely outside CSS text assertions. | Open the date and month pickers in both themes; use the number spinners; type into search and click the clear-X. |
| Buttons and selects read as one treatment after the low-specificity `button` baseline cascades under 12 existing classes | UI-02 | Cascade outcome is a computed-style question; there is no CSSOM. | Compare all 12 button treatments across the five screens. Confirm none regressed. |
| `.cta` hover is now visibly distinguishable (the dead `.cta:hover` bug from D-06) | UI-02 | Perceptual distinguishability of a `color-mix()` result. | Hover the primary CTA in both themes; confirm it visibly changes. |
| All five disabled states (D-07) render as visibly disabled | UI-02 | Requires driving the app into each disabled state and looking. | Pagination prev/next at first/last page; overlay checkbox at cap; Banister toggle; calendar `disabled` and `aria-disabled` days. |
| The `:focus-visible` ring renders **fully unclipped** on `.segmented`, `.records-jump`, `.splits-scroll`, and on the two `--accent-strong` filled active states | UI-02 | A text assertion can prove `overflow: hidden` was removed from `.segmented`; it cannot prove no *other* ancestor clips the ring, nor that the ring is perceptually clear. | Tab through every control on all five screens, **in both themes**. Scrutinize light theme especially — 3.40:1 is the narrower margin. |
| Spacing, density and card treatment read as one rhythm across all five screens | UI-03 | Inherently perceptual; no assertion over CSS source can judge "rhythm". | Side-by-side comparison of all five screens, including Overview (D-14, shared treatment only). |
| **Activities row-click interaction model is functionally and visually unchanged** | ACT-01 | `list.ts` is unmodified by design (D-01/D-05), so there is nothing to assert. This is the **single highest-risk untestable claim in the phase** — a CSS specificity mistake (`pointer-events`, `cursor`) could silently break the reference pattern Phase 20 depends on. | Click rows to navigate; Tab + Enter to activate by keyboard; return from detail and confirm the highlight still flashes; exercise sort, filter and pagination. Confirm only visual chrome changed. |
| `.activity-table tbody tr:hover` retrofit (D-08) — an **acknowledged intentional deviation** from "visually unchanged" in dark theme | ACT-01 | Deliberate visual change; must be a recorded decision, not a checkpoint surprise. | Call out explicitly at the checkpoint. Hover table rows in **both** themes; confirm dark mode now lightens rather than darkens. |

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
