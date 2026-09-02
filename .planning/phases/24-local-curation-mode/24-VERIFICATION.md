---
phase: 24-local-curation-mode
verified: 2026-09-01T20:44:55Z
updated: 2026-09-02T22:30:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  round: 5
  previous_status: "passed (frontmatter), but developer held the ROADMAP gate open pending three concrete items — see 24-VALIDATION.md 'AMENDED GAP-24-05'; the frontmatter's own gaps: array was itself stale, describing an already-closed buildPrBadgeLabels defect"
  previous_score: 5/5 (round-4 re-verification, 2026-09-02T11:05:47Z)
  gaps_closed:
    - "Browser-row coverage of the WR-05 mirror direction (item 1 of amended GAP-24-05) — closed by R32/R34 in 24-VALIDATION.md 'Round 4 Checkpoint (R32-R35)', independently re-derived against src/dashboard/views/detail-best-efforts-logic.ts's resolveExcluded and detail.ts's two call sites"
    - "WR-14 — curation-guard.mjs walk threw on non-regular/unreadable file entries (item 2) — closed by plan 24-15; entry.isFile() gate ordered before UNSCANNED_EXTENSIONS skip, readFileSync wrapped in try/catch, independently confirmed by direct source read at scripts/lib/curation-guard.mjs:135-165"
    - "WR-17 — no structural pin stopped buildPrBadgeLabels and buildBestEffortsPanelRows from re-diverging (item 3) — closed by plan 24-16's exported resolveExcluded, independently confirmed as the sole shared definition (grep: resolveExcluded( occurs exactly 3 times, isExcluded( occurs exactly once, inside resolveExcluded's own body)"
  gaps_remaining: []
  regressions: []
deferred: []
---

# Phase 24: Local Curation Mode Verification Report

**Phase Goal:** Developer can toggle whole-activity PR exclusion from a localhost-only UI, with the
write path provably absent from the published bundle.
**Verified:** 2026-09-02T22:30:00Z
**Status:** passed
**Re-verification:** Yes — this is the fifth verification pass on this phase (Round 1 gaps_found →
Round 2 premature `passed` reversed by code review → Round 3/4 re-verification `passed` with the
developer holding the ROADMAP gate open pending three concrete items → Round 4 browser checkpoint
(plan 24-17) closed those items and the developer closed the gate → this pass independently
re-derives that closure against live source rather than trusting the frontmatter or SUMMARY.md
narration.)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — the authoritative contract)

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | `npm run curate` starts a localhost-only server exposing a UI to toggle whole-activity PR exclusion, as an inline control on the detail view's "Best Efforts This Run" panel | VERIFIED | `scripts/curate-server.mjs` binds `127.0.0.1:4173` only (D-04/OD-4), FATAL-exits on port conflict rather than hunting; `scripts/curate-overlay/exclusion-panel.ts:86` renders the "Exclude this run from PRs" checkbox, injected into the `<section data-activity-id>` the detail view already renders (`src/dashboard/views/detail.ts:520-557`). Independently confirmed by source read, and by 24-VALIDATION.md's R2/R3/R32/R33 browser evidence (banner, single injected control, no duplication). |
| 2 | Toggling an exclusion requires entering a reason, which is then surfaced in the activity detail view | VERIFIED | Write path (`scripts/curate-server.mjs` `handleExclusionWrite`) rejects an empty reason server-side; overlay requires a reason before Save (D-08). Render side: `resolveExcluded` (`src/dashboard/views/detail-best-efforts-logic.ts:40-49`) is now the SOLE derivation both `buildPrBadgeLabels` (line 78, call at line 91) and `buildBestEffortsPanelRows` (line 157, call at line 175) use — confirmed by direct grep (`resolveExcluded(` occurs exactly 3 times: 1 declaration + 2 call sites; `isExcluded(` occurs exactly once, inside `resolveExcluded`'s own body). `detail.ts:550` and `:554` read the identical `liveExclusions` binding. This closes the WR-05 defect (header badge and panel row disagreeing in one paint) that blocked Rounds 2 and 3. R32/R34 in `24-VALIDATION.md` (2026-09-02) constructed the previously-unreachable discriminating state — `wasPRAtTheTime: true` AND precomputed `excludedFromRecords: true` simultaneously, with no Recompute — and observed exactly one correctly-suppressed/restored badge, proving the live document (not the stale precomputed flag) drives the render. R34's untick/confirm/re-untick/OK sequence was performed by the human developer (native `window.confirm()` blocks browser automation). |
| 3 | `verify-dashboard-publish.mjs` gains an assertion (following `assertNoPrivateArtifacts`) that the curation write path is absent from the published bundle, and that assertion demonstrably fails against a build that regresses this | VERIFIED | Two independent layers, both re-derived: (a) build-time — `scripts/lib/curation-guard.mjs`'s `UNSCANNED_EXTENSIONS = ['.json']` (line 60) is a narrow, justified skip-list; every other extension, including the 22 `.d.ts` files `dist/widgets` actually publishes (`find dist/widgets -name "*.ts" \| wc -l` → 22, reproduced this session), is content-scanned and fails CLOSED. This replaces the Round-2-era `SCANNED_EXTENSIONS` allowlist that silently exempted `.ts`/`.d.ts`/`.mjs`/extensionless files (the CR-02 defect). `scripts/lib/curation-guard.test.mjs` plants markers in a `.d.ts` file, an extensionless file, and other classes and observes them flagged (case-by-case `it()` blocks confirmed by direct read). (b) HTTP-time — `scripts/verify-dashboard-publish.mjs:307-309` asserts 404 for `/__curate/health`, `/__curate/overlay.js`, `/__curate/exclusions/{id}`. `scripts/verify-dashboard-publish-guard.test.mjs` (Cases B/C/D) independently proves the shipped verifier exits non-zero against a planted overlay/health/write-endpoint fixture, and Case A proves the clean tree passes — the "demonstrably fails against a regression" clause is discharged, not just asserted. Re-ran `npm run build-widgets` and `npm run verify-dashboard` this session: both exit 0, guard prints the green scan line, 40/40 HTTP checks pass. |
| 4 | **Human checkpoint**: toggle a whole-activity exclusion end-to-end locally with a reason, confirm it lands in `data/best-effort-exclusions.json` and renders in the detail view; separately, confirm the production build exposes no curation write endpoint | VERIFIED | Discharged by a genuine human gesture at R34 (2026-09-02, plan 24-17 Round 4): the developer personally performed the untick/confirm/re-untick/OK sequence and read the native `window.confirm()` text verbatim (`"Removing this exclusion deletes it and changes PR history. Continue?"`, matching `scripts/curate-overlay/exclusion-panel.ts:143-144`/`:167-168`). R10 (Round 1) and R19 (Round 2) are the same class of human-performed row for the write/mirror-direction halves. Production-absence half discharged by R12/R21/R22/R23/R29 (no curation control renders, no `__curate` string, all three `/__curate/*` paths 404, an in-console `PUT` returns 404 leaving the tree unchanged) reproduced against the Round-4 build identity (`index-D-Ts7X8C.js` — confirmed this session as the current `dist/widgets/index.html` reference). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/curate-server.mjs` | localhost-only server, write + static routes, Origin/Host gate on every route | VERIFIED | `serveStaticRoute` (line 635) now calls `isTrustedOrigin` (line 636) before serving; `safeResolve` (line 132) wraps `decodeURIComponent` in try/catch; `createServer` (line 688) wraps the whole listener body in try/catch, symmetric with the curate branch's own `.catch()`. Independently reproduced: `decodeURIComponent('/%')` throws, confirmed `safeResolve` catches it and returns `null` rather than propagating. |
| `scripts/curate-overlay/exclusion-panel.ts` | inline exclusion toggle UI, reason textarea, confirm-before-delete | VERIFIED | Confirmed present, wired into the detail view's Best Efforts section via `scripts/curate-overlay/index.ts` overlay injection. |
| `scripts/lib/curation-guard.mjs` | pure, importable violations-returning scanner; fails closed on unknown file classes | VERIFIED (with one open non-blocking Warning — WR-19, see below) | `findCurationArtifacts` exported, called from `build-widgets.mjs:220` inside `assertNoCurationArtifacts()`, which `process.exit(1)`s on any violation. `UNSCANNED_EXTENSIONS` narrow skip-list confirmed. |
| `scripts/verify-dashboard-publish.mjs` | HTTP-level absence assertion for the three curate routes | VERIFIED | Lines 307-309, confirmed present and exercised in `verify-dashboard-publish-guard.test.mjs`. |
| `src/dashboard/views/detail-best-efforts-logic.ts` | single shared exclusion-derivation function used by both header badge and panel row builders | VERIFIED | `resolveExcluded` (lines 40-49) is the sole definition; both call sites confirmed. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `detail.ts:550` (`buildPrBadgeLabels`) | `resolveExcluded` | direct call, `liveExclusions` param | WIRED | Confirmed by source read: `buildPrBadgeLabels(bestEffortsEntry, liveExclusions)`. |
| `detail.ts:554` (`buildBestEffortsPanelRows`) | `resolveExcluded` | direct call, same `liveExclusions` binding | WIRED | Confirmed: both call sites in `mountBestEffortsAndBadges` read the identical parameter — no branch, no reassignment, no second call site for either function anywhere in the file (independently grepped). |
| `createServer` static branch | `isTrustedOrigin` | direct call before serving | WIRED | `serveStaticRoute:636`. |
| `assertNoCurationArtifacts` | `findCurationArtifacts` | direct call, exit-on-violation wrapper | WIRED | `build-widgets.mjs:220`, called at the end of `buildAllWidgets()` after `buildPages()`/`buildDashboard()` (OD-2). |

### Behavioral Spot-Checks (independently re-run this session, not trusted from SUMMARY)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full test suite | `npm test` | 60 test files, 1560 tests, all passed | PASS |
| Type-check | `npx tsc --noEmit` | exit 0 | PASS |
| App build | `npm run build` | exit 0 | PASS |
| Widget/dashboard build + curation-artifact guard | `npm run build-widgets` | exit 0; prints `✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.` | PASS |
| Publish-absence HTTP proof | `npm run verify-dashboard` | exit 0; `40 check(s) passed, 0 failure(s).` | PASS |
| `.d.ts` publish-count regression check | `find dist/widgets -name "*.ts" \| wc -l` | 22 (matches PINNED_DTS_COUNT from prior rounds; all 22 scanned clean) | PASS |
| WR-19 reproduction (mode-000 directory under a scanned tree) | direct call to `findCurationArtifacts` against a planted mode-000 directory (this session, scratch fixture, not the real `dist/widgets`) | `THREW: EACCES: permission denied, scandir '.../locked'` | CONFIRMED AS DESCRIBED — see Anti-Patterns below |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| CUR-01 | All 17 plans (24-01..24-17) declare `requirements: [CUR-01]`; no orphaned Phase-24 requirement IDs found in REQUIREMENTS.md | User can toggle whole-activity PR exclusion from a localhost-only UI; reason required and surfaced; write path provably absent from published bundle | SATISFIED | All four ROADMAP success criteria independently re-verified above. REQUIREMENTS.md line 51 marks `[x]` Complete with the full four-round history retained; ROADMAP.md line 74 marks `[x]` with "PHASE GATE CLOSED." |

No orphaned requirements: `grep -n "Phase 24" .planning/REQUIREMENTS.md` returns only the CUR-01 row and its milestone-tracker row; both are accounted for above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `scripts/lib/curation-guard.mjs` | 82-83 (and the recursive call at 101) | Unguarded `readdirSync(dir, {withFileTypes: true})` throws synchronously if a directory under `dist/widgets` is unreadable (e.g. mode-000) — the untested sibling of WR-14, which only guarded individual file entries, not the directory-listing call itself. Independently reproduced this session against the real, shipped module (a planted mode-000 directory containing a marker-bearing file threw `EACCES` rather than being reported as an attributed violation). | WARNING (WR-19, already logged in `24-REVIEW.md`) | Fails CLOSED — the uncaught throw still propagates through `buildAllWidgets().catch()` to `process.exit(1)`, so the build still aborts and nothing leaks to the published bundle. It does NOT violate ROADMAP criterion 3 ("provably absent"). It reintroduces the unattributed-crash operator experience (`Widget build failed: EACCES: permission denied, scandir '...'`) that plan 24-15/WR-14 existed to eliminate for the sibling file case, on a directory-shaped input class that is untested and undocumented. Recommend a follow-up plan (wrap `readdirSync` the same way WR-14 wrapped `readFileSync`, plus a planted mode-000-directory fixture test) but this does not block the phase goal — the phase goal is about publish-safety, which holds. |
| `scripts/lib/curation-guard.mjs` | 105-141 | A non-regular entry whose name also matches `__curate`/`.curate-dist` is reported twice with two different reasons (IN-17) | INFO | Cosmetic only — the guard already fails the build on any non-empty violations array, so the outcome is identical either way. |
| `src/dashboard/curation-seam.test.ts` | 152-155 | A literal-string call-site pin depends on exact single-line formatting with no formatter/lint enforcement in this repo (IN-18) | INFO | A future manual reflow could trip a false failure on an otherwise-correct change; the regex-based structural pin next to it would still catch a real regression. |

No `TBD`/`FIXME`/`XXX` unresolved debt markers found in the phase's changed files (`grep -rn "TBD\|FIXME\|XXX" scripts/curate-server.mjs scripts/curate-overlay/ scripts/lib/curation-guard.mjs src/dashboard/views/detail-best-efforts-logic.ts` — none found).

### Evidentiary caveats assessed (per critical_cautions #4)

- **R33's gestures were orchestrator-driven, not literal human-hand**, despite the plan's `<how-to-verify>` template phrasing. This is disclosed transparently in `24-VALIDATION.md`'s Round 4 evidence-provenance table, and correctly reasoned: no native `window.confirm()` or other automation-blocking dialog is involved in ticking a checkbox, typing into a textarea, or clicking Save — the specific justification behind reserving certain rows for human-hand-only (checkpoint-discipline rule 3) does not apply to R33's gestures. R33 is explicitly the paired control for R34 (with the precomputed flag hand-set true, ANY implementation would suppress the badge at R33 — it is not discriminating on its own), so this provenance note does not weaken the phase's discriminating claim, which rests on R32 and R34. Accepted.
- **R34's Cancel-noop sub-check rests on the developer's report alone**, not an independent orchestrator capture (the curate server logs no requests, so the intermediate state between Cancel and the subsequent re-untick+OK could not be recovered after the fact). This is the identical limitation Round 1's R10 disclosed for the same gesture and was accepted there without demoting the row. The precedent is sound: R34's own load-bearing, discriminating claim (the post-OK render/disk state) WAS independently and fully captured by the orchestrator; only the Cancel-then-nothing-happened intermediate state is unwitnessed, and that intermediate state is not what R34 exists to prove. Accepted, consistent with prior-round precedent.

### Human Verification Required

None outstanding. ROADMAP criterion 4's human checkpoint has already been discharged by a genuine human-performed gesture (R34, 2026-09-02, plan 24-17) — see the Observable Truths table above. No further human action is needed to close this phase.

### Gaps Summary

No gaps block the phase goal. All four ROADMAP success criteria are independently re-verified
against live source and against a fresh run of the full gate (tests, typecheck, both builds,
publish-verification) in this session — none of it taken on SUMMARY.md's word. CUR-01 is
genuinely satisfied: the localhost-only curate UI exists and is wired to the detail view, a
required reason is captured and rendered (with the header-badge/panel-row divergence that blocked
Rounds 2-3 now structurally prevented by a single shared `resolveExcluded` definition, not just a
verbal claim), the write path is provably absent from the published bundle at both the build-time
(content-scan, fail-closed on unknown extensions) and HTTP layers (both independently regression-
tested by planted-fixture suites that fail as designed), and the ROADMAP's own human checkpoint was
discharged by an actual human gesture, not simulated.

One open, non-blocking WARNING (WR-19) is independently reproduced and confirmed accurate: an
unreadable directory under `dist/widgets` still throws an uncaught `EACCES` out of
`findCurationArtifacts`'s `readdirSync` call, rather than being reported as an attributed
violation. This fails CLOSED — the build still aborts via `process.exit(1)`, so it does not
compromise publish-safety or any ROADMAP success criterion — but it reintroduces the unattributed-
crash operator experience that plan 24-15 (WR-14) set out to eliminate, on the directory-shaped
sibling of the case WR-14 fixed for files. This is correctly scoped as a follow-up (wrap
`readdirSync` the same way `readFileSync` was wrapped, plus a planted-fixture test), not as a phase
blocker, and should be tracked as a small follow-up task rather than reopening this phase's gate.

---

_Verified: 2026-09-02T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
