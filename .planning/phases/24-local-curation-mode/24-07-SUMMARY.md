---
phase: 24-local-curation-mode
plan: 07
subsystem: ui
tags: [curation-overlay, dom, fetch, esbuild, vitest, source-structure-test]

# Dependency graph
requires:
  - phase: 24-local-curation-mode (plan 02)
    provides: "data-activity-id on the Best Efforts <section> and the dashboard:best-efforts-mounted CustomEvent (D-03), the attach seam this overlay listens for"
  - phase: 24-local-curation-mode (plan 04)
    provides: "scripts/curate-server.mjs's static-serving half, the esbuild bundling call, and the placeholder mountCurationControls signature this plan replaces in place"
provides:
  - "mountCurationControls — the tickbox, required-reason textarea, Save, Remove exclusion and Recompute records controls, built as bare unclassed elements"
  - "saveExclusion/removeExclusion/runRecompute — the overlay's network layer against PUT/DELETE /__curate/exclusions/:id and POST /__curate/recompute, each ending in location.reload()"
  - "scripts/curate-overlay.test.mjs — a 13-assertion source-structure guard pinning the overlay's four load-bearing contracts, D-11 discharged for two of them"
affects: [24-08 (the human browser checkpoint that is the sole proof of this plan's interaction)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Write-then-reload as the overlay's only re-render mechanism: every successful PUT/DELETE ends in location.reload(), never a second render of the panel — the hash route survives the reload so the existing, untouched detail.ts/detail-sections.ts renderer repaints from the freshly mirrored file"
    - "Two-step commit with a visible required-reason explanation instead of a disabled Save button, per D-08's explicit rejection of the unexplained-disabled-control pattern"

key-files:
  created:
    - scripts/curate-overlay.test.mjs
  modified:
    - scripts/curate-overlay/exclusion-panel.ts
    - scripts/curate-overlay/index.ts

key-decisions:
  - "No new decisions beyond what 24-CONTEXT.md/24-RESEARCH.md/24-PATTERNS.md already locked (D-01..D-08, OD-1, OD-3). This plan implemented the documented interaction and network contract exactly as specified."
  - "Neither Save nor Remove is ever disabled while a request is in flight — chose a status-line message over a disabled-control affordance so the acceptance criterion's 'no disabled = true on the Save button' constraint could never be read as ambiguous, and so the same code path stays simple to reason about for both buttons."
  - "Removed three literal forbidden substrings from doc-comment prose during self-verification, before any commit — 'styles.css' -> 'the dashboard's own stylesheet', 'buildBestEffortsSection'/'MutationObserver' -> paraphrased descriptions — because the plan's acceptance-criteria grep checks are literal substring scans over the whole file, not just live code."

patterns-established:
  - "Pattern: source-structure test files reimplement stripComments locally (rather than importing the .ts sibling in src/dashboard/row-semantics.test.ts) when the test itself lives under scripts/**/*.test.mjs, since a .mjs file cannot import a .ts module across that directory boundary in this repo's module resolution."

requirements-completed: []  # CUR-01 stays open — plan 24-08's human browser checkpoint is the requirement's sole remaining proof (criteria 1, 2, 4 are all manual-only per 24-VALIDATION.md).

# Metrics
duration: ~50min
completed: 2026-08-27
---

# Phase 24 Plan 07: Curation Overlay UI Summary

**Replaced the placeholder `mountCurationControls` with the real two-step-commit tickbox/reason/Save/Remove/Recompute UI, wired it to root-absolute `/__curate/...` writes that end in `location.reload()`, and pinned all four load-bearing contracts (not-a-second-renderer, seam-only attachment, confirm-before-delete, zero CSS) with a 13-assertion source-structure guard observed failing on two of them.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-27
- **Tasks:** 3/3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `scripts/curate-overlay/exclusion-panel.ts`'s `mountCurationControls` now builds the real panel: a bare `<input type="checkbox">` inside a `<label>`, a `Reason (required)` `<span>`, a bare `<textarea>`, and bare `Save`/`Remove exclusion`/`Recompute records` buttons — only the wrapping `<div class="curate-controls">` carries a class. `loadExclusionState` fetches the published, mirrored exclusions file, tolerantly scans for a matching `activityId` with a string `reason`, degrades to "not excluded" on any fetch/parse failure, and skips `__proto__` as an id.
- Not-excluded loads with the textarea/label/Save hidden and Remove absent; ticking reveals them. Already-excluded loads pre-ticked with the stored reason, Save visible for in-place edits, Remove visible. Saving with an empty-after-`.trim()` reason writes nothing and sets a visible status message plus moves focus to the textarea — never a silently disabled Save. Unticking an excluded activity and pressing Remove both call `window.confirm(...)` before issuing any request; cancelling restores the checkbox.
- `scripts/curate-overlay/index.ts` gained the transport layer: `saveExclusion`/`removeExclusion` PUT/DELETE `/__curate/exclusions/:id` and call `location.reload()` on success; `runRecompute` POSTs `/__curate/recompute`, streams chunks to a caller-supplied callback via `response.body.getReader()`/`TextDecoder`, and reloads once a chunk contains `__CURATE_RECOMPUTE_DONE__`. Non-ok responses map 400/403/412/413 to short status-line sentences, with 412 instructing `npm run build`. The mount listener's shape (exactly one `addEventListener`, seam-only attachment, pre-existing-controls removal) was already correct from plan 24-04 and is unchanged.
- `scripts/curate-overlay.test.mjs` (new): 13 assertions over comment-stripped source text covering all four load-bearing contracts — not-a-second-renderer (D-03/OD-1), seam-only attachment (D-03), confirm-before-delete with offset ordering (D-08), required-reason enforcement without a disabled Save (D-08), zero CSS shipped (OD-3), root-absolute curate paths (D-02), recompute kept structurally out of `saveExclusion`'s own function body (D-07), and structural absence from `vite.config.ts`/`vite.config.pages.ts`/`tsconfig.json`/`build-widgets.mjs` (D-01).

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the two-step commit UI as bare elements (D-08, OD-3)** - `822010d` (feat)
2. **Task 2: Wire the mount listener and the network layer (D-03, D-07, OD-1)** - `7985533` (feat)
3. **Task 3: Source-structure guard for the overlay's contract, observed failing (D-11)** - `9352bba` (test)

**Plan metadata:** committed alongside this SUMMARY (worktree mode — orchestrator finalizes STATE.md/ROADMAP.md after merge)

## Files Created/Modified

- `scripts/curate-overlay/exclusion-panel.ts` - real `mountCurationControls`: tickbox/textarea/Save/Remove/Recompute DOM, exclusion-state loading, confirm-guarded destructive paths, empty-reason status message
- `scripts/curate-overlay/index.ts` - added `saveExclusion`/`removeExclusion`/`runRecompute` (fetch + reload/stream transport layer); mount-listener wiring unchanged in shape
- `scripts/curate-overlay.test.mjs` (new) - 13-case source-structure guard, D-11 discharged for two of its four contract groups

## Decisions Made

Followed `24-CONTEXT.md`/`24-RESEARCH.md`/`24-PATTERNS.md` exactly — D-01 through D-08, OD-1 (full reload, not a DOM patch), OD-3 (zero CSS). No new decisions were made beyond two small implementation choices, both within the plan's stated discretion:

- Neither Save nor Remove is ever set `disabled` during an in-flight request (a status-line message is the only in-flight feedback) — this keeps the code path simple and avoids any ambiguity against the acceptance criterion forbidding a disabled Save button.
- The recompute-separation assertion (D-07) is proven by slicing `index.ts`'s source text from `saveExclusion`'s declaration to the next `export`, rather than a simpler substring-count check, so it holds even if a later plan adds more exported functions between them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed three literal forbidden substrings from doc-comment prose before the first commit**

- **Found during:** Task 1 and Task 2 self-verification against the acceptance criteria's automated grep-style checks
- **Issue:** Doc comments explaining the design (referencing `styles.css` by name, and naming `buildBestEffortsSection`/`MutationObserver` as the things NOT to do) used the exact literal substrings the acceptance criteria's automated verification scans for (`.css`, `buildBestEffortsSection`, `MutationObserver`) — a raw `s.includes(...)` check with no comment-stripping, unlike the acceptance-criteria's own `className` grep which does strip comments
- **Fix:** Reworded the three comments to describe the same design intent without the literal forbidden tokens (`"src/dashboard/styles.css"` → `"the dashboard's own stylesheet"`; `"buildBestEffortsSection"` → `"the panel section builder"`; `"MutationObserver"` → `"a DOM-watching observer"`)
- **Files modified:** `scripts/curate-overlay/exclusion-panel.ts`, `scripts/curate-overlay/index.ts`
- **Verification:** Re-ran each task's exact `<verify>` automated command; both pass. `scripts/curate-overlay.test.mjs`'s own assertions (which DO strip comments) were unaffected either way.
- **Committed in:** `822010d` (Task 1), `7985533` (Task 2) — caught before each task's respective commit, not shipped as a defect

---

**Total deviations:** 1 auto-fixed category, 3 instances, all Rule 1, all caught during self-verification before their respective task commits — none shipped as a defect.
**Impact on plan:** Cosmetic wording-only fixes to doc comments; no behavioral change. No scope creep.

## Issues Encountered

- **Worktree started with zero `node_modules`, no `dist/widgets`, no `dist/index.js`, and no `data/dashboard`/`data/stats`.** Ran `npm ci --prefer-offline` (no lockfile changes), then `npm run build-widgets`, `npm run build` (tsc), `npm run compute-dashboard-index`, and `npm run compute-all-stats` to produce a fully working local build for both manual reasoning and `npm test` verification. All outputs are gitignored; `git status --short` after each build step was checked and confirmed no tracked-file changes beyond `data/geo/geo-metadata.json`'s `generatedAt` timestamp, which was reverted with `git checkout -- data/geo/geo-metadata.json` before every commit. This closed a pre-existing environment gap noted in the 24-04/24-05 summaries (`records-logic.test.ts` and four `trends-*-logic.test.ts` files, plus `scripts/verify-dashboard-publish-guard.test.mjs`'s Cases A-D, all failed with ENOENT on the missing generated data before these steps) — `npm test` now runs 60/60 files, 1479/1479 tests green in this worktree.
- **Worktree branch had drifted onto stale pre-phase-24 history at agent startup** (a chain of `chore: update activities and stats [skip ci]` commits with no phase-24 work reachable), diverging from the orchestrator's expected base commit `431759f`. Per the mandated setup step, `git reset --hard 431759fbdaaa772614855188728bee3441e58c14` was run after confirming HEAD was on the correct `worktree-agent-*` branch (not a protected ref) — this is environment recovery specified by the agent's own setup protocol, not a plan deviation.

## D-11 observed failing

Per Task 3's mandatory discharge requirement, two of the guard's four contract groups were each temporarily broken in turn, `npx vitest run scripts/curate-overlay.test.mjs` was run and its RED output captured, then the file was restored to its committed state (`git diff` confirmed empty before each restoration) and the suite re-run green.

### Run 1 — `location.reload()` replaced with a panel-rebuild call (D-03/OD-1 violation)

`saveExclusion`'s success path was temporarily changed from `location.reload();` to `document.querySelector('section')?.replaceChildren(buildBestEffortsSection());` — simulating the overlay becoming a second renderer.

```
 ❯ scripts/curate-overlay.test.mjs (13 tests | 1 failed) 7ms
     × neither file mentions the panel section builder, a whole-children replace, or a DOM-watching observer
     ✓ index.ts calls location.reload()
     ✓ index.ts references the mount event name and the data-activity-id selector
     ✓ index.ts registers exactly one addEventListener(
     ... (9 more passing)

 FAIL scripts/curate-overlay.test.mjs > D-03/OD-1 — not a second renderer > neither file mentions the panel section builder, a whole-children replace, or a DOM-watching observer
AssertionError: expected true to be false // Object.is equality
- Expected: false
+ Received: true
 ❯ scripts/curate-overlay.test.mjs:41:48

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)
```

### Run 2 — both `confirm(` guards removed from exclusion-panel.ts (D-08 violation)

The `window.confirm(...)` calls in both the checkbox's `change` handler and the Remove button's `click` handler were removed, letting both paths call `doRemove()` unconditionally — simulating the accidental removal of the destructive-action guard.

```
 ❯ scripts/curate-overlay.test.mjs (13 tests | 2 failed) 7ms
     ✓ neither file mentions the panel section builder, a whole-children replace, or a DOM-watching observer
     ✓ index.ts calls location.reload()
     × exclusion-panel.ts contains confirm(
     × the panel calls its remove helper only from inside a confirm(-guarded path
     ... (9 more passing)

 FAIL scripts/curate-overlay.test.mjs > D-08 — confirm before destructive delete > exclusion-panel.ts contains confirm(
AssertionError: expected false to be true // Object.is equality
- Expected: true
+ Received: false
 ❯ scripts/curate-overlay.test.mjs:65:47

 FAIL scripts/curate-overlay.test.mjs > D-08 — confirm before destructive delete > the panel calls its remove helper only from inside a confirm(-guarded path
AssertionError: expected -1 to be greater than or equal to 0
 ❯ scripts/curate-overlay.test.mjs:75:27

 Test Files  1 failed (1)
      Tests  2 failed | 11 passed (13)
```

### Run 3 — both files restored, `git diff` clean, full green

```
 ✓ scripts/curate-overlay.test.mjs (13 tests) 3ms

 Test Files  1 passed (1)
      Tests  13 passed (13)
```

Assertion 1 (not-a-second-renderer) and assertions 3/3b (confirm-before-delete, including offset ordering) — the two contracts the plan's own `<threat_model>` names as protecting against "the phase's worst outcomes" (T-24-OVERLAY-DRIFT and T-24-DESTRUCTIVE) — are exactly the two observed failing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The overlay's full interaction contract (tick/reveal, edit-in-place, confirm-then-delete, empty-reason blocking, instant reload after write, streamed recompute) is implemented and source-pinned. Plan 24-08's human browser checkpoint is the only remaining proof — this repo has no DOM test environment, so nothing beyond source-structure shape could be asserted here.
- `saveExclusion`/`removeExclusion`/`runRecompute` are exported from `scripts/curate-overlay/index.ts` and imported by `exclusion-panel.ts`, matching the interface the plan's frontmatter fixed in advance.
- The write endpoints this overlay targets (`PUT`/`DELETE /__curate/exclusions/:id`, `POST /__curate/recompute`) are owned by the sibling plan 24-06 (`scripts/curate-server.mjs`), landing in the same wave — this plan's fetch calls were written strictly against the documented contract in the plan's `<interfaces>` block and were not exercised end-to-end against a live server in this session (no DOM/browser environment here); that live exercise is plan 24-08's job.
- No blockers.

---
*Phase: 24-local-curation-mode*
*Completed: 2026-08-27*
