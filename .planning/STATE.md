---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Interface Polish
status: executing
stopped_at: Phase 24 gap-closure round 4 PLANNED under --force (closed-phase gate is a false positive; 24-VERIFICATION.md frontmatter still says status:passed while the developer holds the gate open). Plans 24-15/16/17 written, plan-checker PASSED 0 blockers. Scope = amended GAP-24-05's three items. CUR-01 still Pending. Next: /gsd-execute-phase 24
last_updated: "2026-09-02T13:29:43.580Z"
last_activity: 2026-09-02 -- Phase 24 planning complete
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 91
  completed_plans: 88
  percent: 71
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-10)

**Core value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.
**Current focus:** Phase 24 gap-closure round 3 complete (plans 24-11..24-14). Two of the three `24-VERIFICATION.md` gaps are closed (curation-guard extension allowlist, curate-server static-route hardening); the third (`buildPrBadgeLabels` live exclusions) is only partially closed — its mirror direction failed the Round 3 checkpoint on a checkpoint-design defect, tracked as GAP-24-05. CUR-01 and the Phase 24 gate stay open pending a further gap-closure round.

## Current Position

Phase: 24 (local-curation-mode) — GAP CLOSURE ROUND 4 PLANNED, GATE STILL OPEN
Plan: 14 of 17 executed — 24-01..24-14 done; 24-15/24-16/24-17 planned 2026-09-02 and not yet
      executed. Waves 9 (24-15, 24-16 — disjoint files, parallel-safe) and 10 (24-17 — BLOCKING,
      autonomous: false).
Status: Ready to execute — run /gsd-execute-phase 24
        Scope of this round is the AMENDED GAP-24-05 in 24-VALIDATION.md (three items):
        (1) browser-row coverage for the WR-05 live-document mirror direction, (2) WR-14
        (curation-guard.mjs missing entry.isFile() guard), (3) WR-17 (nothing pins
        buildPrBadgeLabels's call site to the same liveExclusions binding as the panel).
        WR-15 and IN-13 are deliberately OUT of scope — recorded in round 4 as optional
        Warnings, not part of GAP-24-05's closing list.

        **Gate status.** Re-verification round 4 (2026-09-02) returned `status: passed`, 5/5
        must-haves, and closed GAP-24-02/03/04 with independent live re-derivation. The
        developer read that result and held the Phase 24 gate OPEN anyway, because criterion 4
        is by its own wording a human checkpoint and plan 24-14's governing rule ("CUR-01 and
        the ROADMAP gate tick ONLY if every mapped row is PASS") was written in a phase where
        CUR-01 had already been ticked prematurely once, after Round 2's clean sweep, and had
        to be reopened when the code review landed afterwards. CUR-01 stays Pending in
        REQUIREMENTS.md; the ROADMAP Phase 24 gate stays open. 24-17 owns the disposition and
        ticks only if every mapped row (R32-R35) passes.

        **Known artifact inconsistency.** `24-VERIFICATION.md`'s frontmatter still reads
        `status: passed`, so `gsd-sdk query init.plan-phase 24` computes `phase_status:
        Complete` and the plan-phase closed-phase gate (workflow §1.5) blocks `--gaps`. This
        round was planned under `--force` with the developer's explicit authorization. That
        frontmatter also carries a STALE `gaps:` array of round-1 vintage describing three
        gaps that rounds 3-4 already closed; the live scope is the amended GAP-24-05 in
        24-VALIDATION.md, NOT that array. Any future --gaps round on Phase 24 hits the same
        collision.

        **Two grounding corrections encoded in 24-17**, both independently confirmed against
        live source: (a) GAP-24-05 item 1 names `data/stats/best-efforts.json`, but the detail
        view fetches the per-activity shard `data/stats/best-efforts/{id}.json`
        (best-efforts-client.ts:116) and the browser reads the copy under `dist/widgets/` —
        following the gap text literally would have produced a third non-observing row; (b)
        `dist/widgets/*` is gitignored (.gitignore:4), so byte-identity for the served copies
        is proven by sha256 against snapshots taken outside the repo, not by `git status`.

        **Historical gap record (all CLOSED — retained for audit trail):**

        - GAP-24-02 (CR-02, criterion 3): `curation-guard.mjs:37`'s `SCANNED_EXTENSIONS`
          allowlist omitted `.ts`/`.d.ts`/`.mjs`/extensionless while `dist/widgets` publishes
          22 `.d.ts` files. CLOSED by 24-11's fail-closed UNSCANNED_EXTENSIONS skip-list.

        - GAP-24-03 (CR-01, D-12): `safeResolve`'s unguarded `decodeURIComponent` plus no
          `.catch()` on the static branch meant `GET /%` from any browser tab killed the
          curate server. CLOSED by 24-12 (try/catch + static-route Origin/Host gate).

        - GAP-24-04 (WR-05, criterion 2): `buildPrBadgeLabels` never received `liveExclusions`
          while `buildBestEffortsPanelRows` was fixed by 24-09. CLOSED by 24-13; the mirror
          direction is proven at unit level (detail-best-efforts-logic.test.ts:286-293). Only
          browser-row COVERAGE of it remains, which is GAP-24-05 item 1 above.

        - GAP-24-05 (R26 unsatisfiable row): Round 3's R26 could not discriminate because its
          own mandated Save->Recompute->Untick setup zeroed `wasPRAtTheTime` for all distances,
          and both render paths gate on that flag before consulting the live document. 24-17's
          R32 avoids this by editing ONLY `excludedFromRecords` on the shard, leaving the
          discriminator live.
Last activity: 2026-09-02 -- Phase 24 planning complete

Progress: [█████████░] 97% (88/91 plans; 24-15/16/17 pending)

## Performance Metrics

**By Milestone:**

| Milestone | Plans | LOC | Duration |
|-----------|-------|-----|----------|
| v1.0 | 9 | 3,844 | 1 day |
| v1.1 | 10 | +2,858 | 3 days |
| v1.2 | 11 | +2,446 | 2 days |
| **Total** | **30** | **9,148** | **6 days** |
| Phase 16 P09 | ~30min | 2 tasks | 2 files |
| Phase 16 P14 | 40min | 3 tasks | 1 files |
| Phase 17 P15 | 25min | 3 tasks | 1 files |
| Phase 19 P05 | 35min | 3 tasks | 1 files |
| Phase 19 P09 | 25min | 3 tasks | 2 files |
| Phase 19 P12 | ~10min agent time + held checkpoint | 3 tasks | 2 files |
| Phase 19 P13 | 30min | 3 tasks | 2 files |
| Phase 19 P14 | 8min | 3 tasks | 3 files |
| Phase 19 P15 | recovery session | 3 tasks | 1 files |
| Phase 19 P16 | 14min | 3 tasks | 2 files |
| Phase 19 P17 | ~25min (continuation) | 3 tasks | 3 files |
| Phase 20 P05 | ~9min | 1 tasks | 1 files |
| Phase 20 P11 | multi-session | 2 tasks | 3 files |
| Phase 20 P18 | 25min | 2 tasks | 2 files |
| Phase 20 P20 | ~35min (continuation) | 1 tasks | 2 files |
| Phase 22 P08 | 15min | 1 tasks | 2 files |
| Phase 22 P12 | 20min | 3 tasks | 3 files |
| Phase 22 P16 | ~35min | 3 tasks | 2 files |
| Phase 23 P11 | 30min | 2 tasks | 2 files |
| Phase 23 P13 | 55min | 2 tasks | 2 files |
| Phase 24 P10 | ~40min (spanning checkpoint pause) | 3 tasks | 4 files |
| Phase 24 P14 | 63min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.

Roadmap-level decisions for v2.0 (from research, see .planning/research/SUMMARY.md):

- Stream ingestion (Phase 14) is the foundational blocker — must land first, storage/algorithm decisions (decimation, native-distance, timestamp-indexing) locked before any file is committed.
- Best-effort computation (Phase 15) is isolated as pure backend work, testable before it feeds any UI.
- Records/trends "view" requirements (weekly/monthly totals, TRIMP, YoY) do not depend on streams and are grouped into presentation (Phase 18) rather than gated behind stream work.
- Commit derived/decimated stream JSON to data/streams/, never raw full-resolution — repo already has a bloat precedent from data/heatmap/all-points.json.
- Phase 15 plan 04 (D-05 external validation): 2 of 8 candidate fixture rows (5k on activities 7827165619 and 9716153503) were dropped rather than frozen, because Strava does not surface a 5k best-effort panel for either activity and no platform-reported value existed — only the developer's manual judgment, which the plan's own anti-circularity rule forbids using as an expected value. The remaining 6 rows still clear every coverage guard.
- [Phase 16]: 16-09 human checkpoint recorded as PARTIAL, not approved: navigation (DASH-01) and error/degraded states confirmed working; deep-link detail rendering (DASH-02) and theme-toggle visibility (DASH-03) both surfaced real defects, logged verbatim as gap-closure work rather than patched under checkpoint pressure. requirements-completed for 16-09 lists only DASH-01.
- [Phase 16]: Non-fast-forward push rejections halt the executor rather than auto-merge/rebase; a coordinator-level decision resolved the divergence (merge over rebase, to avoid rewriting 179 phase commits for a one-line auto-generated timestamp conflict)
- [Phase 17]: 17-15 human checkpoint recorded as PARTIAL, not approved: 8 of 10 Manual-Only Verifications rows confirmed clean (BROWSE-01..06, DETAIL-01, DETAIL-05); DETAIL-02 (route-map basemap tiles absent, GAP 1) and DETAIL-03/DETAIL-04 (chart band x-axis misalignment undermining the shared crosshair, GAP 2) surfaced real defects, logged verbatim as gap-closure work rather than patched under checkpoint pressure, mirroring the 16-09 precedent. requirements-completed for 17-15 lists only BROWSE-01..06, DETAIL-01, DETAIL-05.
- [Phase 19]: 19-05 human checkpoint recorded as PARTIAL, not approved: 8 of 13 Manual-Only Verifications rows confirmed clean (rows 2, 4-hover-half, 5, 7, 8, 9, 10, 11, 13); rows 1, 3, 12 (UI-01/UI-02) surfaced a shipped defect — a stray `*/` inside a CSS comment at styles.css lines 54-56 silently discards the --radius-control token from the parsed stylesheet, invisible to all four automated gate commands (909/909 tests, clean tsc, clean build-widgets, 37/37 verify-dashboard checks all passed against the broken build) — and row 6 (UI-02, focus ring) failed outright, occluded on the detail view's segmented control by neighbouring painted elements. requirements-completed for 19-05 lists only UI-03 and ACT-01; UI-01 and UI-02 reverted from complete to blocked in REQUIREMENTS.md pending gap closure via /gsd-plan-phase 19 --gaps. Three non-Phase-19 issues (a Safari-specific JS SyntaxError on every page load, a dead Records "View Activity" click handler, and Safari's type="month" degradation) were logged separately in 19-VALIDATION.md's Gap-Closure Record, not counted against the phase.
- [Phase 19]: 19-09 human checkpoint recorded as approved, closing the phase gate: rows 1, 3, 6 and 12 re-verified in a real browser after GAP 1 (dead --radius-control token, plan 19-06), GAP 2 (occluded focus ring, plan 19-07) and GAP 3 (misclassified css-syntax-error warning, plan 19-06) were closed. The developer gave a single blanket verdict ("Everything looks good. Approved.") rather than per-row detail; every row's Re-verification entry, the Gap-Closure Record resolutions, and REQUIREMENTS.md state that granularity explicitly rather than inventing per-sub-check observations. nyquist_compliant flipped to true; UI-01 and UI-02 both ticked complete. No further gap-closure pass required for Phase 19.
- [Phase 19]: 19-12 Round 3 human checkpoint recorded PARTIAL, not approved: rows 14, 15, 16, 17 and 19 confirmed clean (CR-02 segmented middle-option radius and CR-03 focus-ring opacity both closed on rendered evidence); row 18 FAILED — the sticky nav does not remain on screen while scrolling (new GAP 7, Probe D: navH 77 = parentH 77), distinct from CR-01's z-index fix, whose declaration Probe B confirms is shipped but whose paint-order effect remains unconfirmed (GAP 6). nyquist_compliant stays false; requirements-completed for 19-12 lists only UI-01, UI-03, ACT-01 (confirmed-unregressed via row 19); UI-02 remains open pending another /gsd-plan-phase 19 --gaps pass.
- [Phase 19]: 19-13 GAP 7 diagnosis confirmed H1 (zero-travel containing block: #app-nav-root.clientHeight == .app-nav.offsetHeight, both 77) as the sole root cause of the sticky nav not remaining on screen, via three rendered-build Chrome console probes (E1 structural chain, E2 scroll behaviour on #/list and #/records). H2 (ancestor clip/scroll container), H3 (scroll container is not the document), H4 (ancestor height/display cap), and H5 (not sticky at tested width) were each excluded by a cited probe field. A matrix wording defect was found and documented: getComputedStyle().height never returns the literal string 'auto', so H4's originally-drafted excluding signature is unsatisfiable and was resolved instead via the plan's explicit H1-vs-H4 split. records.ts's updateJumpOffset is judged not implicated. No fix was written and no source file was touched, per the plan's constraint; 19-14 is unblocked to apply the H1 fix.
- [Phase 19]: 19-14 applied the H1-prescribed fix, moving the sticky rung (position: sticky, top: 0, z-index: 20) from .app-nav to #app-nav-root, and closed R3-WR-01 by extending the ladder test to pin position: sticky/relative rather than only z-index numbers. Confirmed on the rendered page via two Probe F runs (#/list, #/records), both meeting sy>=400 and top<=1. Rubber-band bounce reported on #/list is a recorded non-defect (macOS overscroll), not a new gap. requirements-completed for this plan is empty — UI-02 stays open; plan 19-17 performs the gate-quality re-verification across both themes as Probe G.
- [Phase 19]: 19-15 recovered from a killed prior executor that committed nothing but left uncommitted, unreviewed Task 1 work (+221/-54 in styles.test.ts). Audited line by line against the plan and 19-REVIEW-round3.md, found materially correct, and kept it - salvage, not rewrite. Fixed one real defect the review's own proposed hover-assertion snippet had (ruleWithHeadContaining's head+body return shape had no brace for indexOf('{') to find; changed to head+'{'+body+'}', its only call site). All three tasks complete: R3-CR-01/CR-02/WR-02/IN-01/IN-02/IN-03/IN-04 closed with 7 mutations executed and reverted, styles.css confirmed byte-identical to 19-14's end state, full gate green (927/927 tests, clean tsc, clean build-widgets, 37/37 verify-dashboard). requirements-completed for this plan is empty — an initial `requirements.mark-complete UI-02` call (mechanically run from the plan's `requirements: [UI-02]` frontmatter) was reverted in REQUIREMENTS.md after it contradicted that file's own still-open text and the project's established pattern of gating a requirement's completion on a rendered checkpoint (19-17's Probe G), not an autonomous test-file-only plan; UI-02 stays open. R3-WR-03 and R3-WR-04 (both styles.css comment fixes, out of this plan's test-file-only scope) remain open for plan 19-16.
- [Phase 19]: 19-16 corrected the sticky-layer ladder comment's disproven rung-4 stickiness claim (R3-WR-04) to cite dated Probe F evidence from 19-14's fix, hedged the still-unconfirmed paint-order claim naming GAP 6 and plan 19-17's row 21 as the observation that will settle it, and added a spec-derived (marked unobserved) descendant-containment scope statement (R3-WR-03). Stripped all foreign .ts:{line} citations plus one same-file rotted citation discovered in the process (R3-IN-05 partial). Deferred WR-03 radius literals and R3-IN-05's narrative-relocation remainder with dated reasoning in deferred-items.md. All eleven Round 3 findings now have a stated disposition (R3-CR-01/CR-02/WR-02/IN-01..04 closed in 19-15, R3-WR-01 closed in 19-14, R3-WR-03/WR-04 closed in 19-16, R3-IN-05 partial). requirements-completed for this plan is empty — UI-02 stays open, gated on plan 19-17's rendered checkpoint.
- [Phase 19]: 19-17 Round 4 human checkpoint returned a clean sweep — rows 20-24 all PASS, closing GAP 7 (row 20, the nav holds on both routes/themes) and GAP 6 (row 21, the original CR-01 paint-order question, first observed) on rendered evidence gated by Probes G and H. nyquist_compliant: true; UI-02 ticked complete, closing Phase 19's gate. One new gap found unprompted (GAP 8: Leaflet map tiles paint over the nav, plus a totality defect in plan 19-16's own ladder comment) is recorded, argued not to block UI-02 (different component, no checkpoint row named it), left unpatched per house rule, disposition deferred to the user. requirements-completed for this checkpoint lists UI-01, UI-02, UI-03, ACT-01.
- [Phase 20]: 20-05 human checkpoint closed with all twelve rows PASS on the developer's own words (rows 1-11 as one blanket approval, row 12 individually confirmed after clarification), but nyquist_compliant stays false and status is partial - seven theme-sensitive rows (1-4, 7, 9, 10) have no stated theme coverage, an evidence gap rather than a defect. No requirement ticked in REQUIREMENTS.md this session (plan's own files_modified scope names only 20-VALIDATION.md); the actionable follow-up is confirming theme coverage, not a code fix.
- [Phase 20]: Round 3 checkpoint recorded with a four-state verdict vocabulary (PASS/FAIL/BLOCKED/NOT EXERCISABLE) distinguishing dataset-coverage gaps and hardware limits from actual defects; R18/R19 FAIL recorded verbatim against D-12's stated expectation and left unpatched
- [Phase 20]: UX-02 stays open despite three of its four mapped rows passing cleanly, because R2 is BLOCKED (no badge-carrying row exists in the current Overview Recent Activities dataset) and every mapped row must pass before a requirement is ticked
- [Phase 20]: GAP 12: D-13 real cell anchors defeat D-12 drag-select and D-14 double-click guards on Records PR-table cells; recorded FAIL, unpatched, Round 5 must reconcile
- [Phase 20]: 20-20 Round 5 checkpoint recorded a clean sweep — all ten rows (R34-R43) PASS, closing GAP 12 (drag-select and double-click) and GAP 11 (middle-click disposition) fully. R35's double-click-still-navigates-on-first-click residual is a developer-accepted shipped limitation of D-16, not a defect. UX-01 and UX-03 both ticked complete.
- [Phase 20]: NEW DISPOSITION discovered during R36 corroboration — D-16's click-guard and draggable=false do not cover the Date-cell anchor (hand-built at records.ts:502-507, not via buildCellLink), so a drag or double-click starting in the Date cell still behaves natively. Developer explicitly accepted this as a deliberate, minor scope boundary rather than requesting an extension of D-16's contract.
- [Phase 22]: Phase 22 plan 22-08 Round 2: Gap 2 (CR-01, unguarded localStorage getter) CLOSED via R15 PASS; Gap 1 (CAL-02, ~380px day-cell overflow) STILL OPEN via R13 FAIL, so CAL-02 stays Pending while CAL-01 keeps its Complete tick. R16 was declined by the developer and recorded BLOCKED, not NOT EXERCISABLE.
- [Phase 22]: 22-12 Round 3 human checkpoint recorded a clean sweep — all six rows (R18-R23) PASS, closing both remaining Phase 22 gaps. R19 PASS closed Gap 1 (CAL-02, ~380px day-cell overflow, FAILED twice at R11/R13) at a stated 375px with matchMedia('(max-width: 380px)').matches confirmed engaged for the first time; values wrap rather than overflow. R22 PASS disposition (a) closed Gap 2 (BL-03, app-level blocked-site-data) in Safari after a genuine Chrome org-managed-preference block, the first real-browser exercise of that path in the phase. CAL-02 ticked complete; CAL-01's tick survives via R23 PASS; CAL-03 left untouched. nyquist_compliant: true.
- [Phase 22]: 22-16 Round 4 checkpoint recorded 3 PASS / 2 BLOCKED (R24/R25/R28 PASS, R26/R27 BLOCKED). R25 PASS closed the 381-530px overflow sub-band for the first time in the phase at a genuinely stated 393px; R26 was BLOCKED because the evidence given was at R25's own width, not R26's own required ~600px band; R27 was BLOCKED because only a summary 'dark reached' claim was given, not the three aria-label values disposition (a) requires. Both BLOCKED verdicts were held against three rounds of orchestrator-relayed pressure to record PASS on incomplete evidence, per the plan's non-waivable house rule 14. Gap 1 and Gap 2 both remain STILL OPEN; WR-01 CLOSED on automated evidence. CAL-01 reverted Complete->Pending (R27 BLOCKED); CAL-02 stays Pending (R26 BLOCKED); CAL-03 untouched.
- [Phase 23]: 23-11 Round 2 checkpoint recorded 21 PASS / 1 FAIL (R35) / 0 BLOCKED against a fresh build (assets/index-D01ardNQ.js). 23-08's settle-nesting/step-magnitude fixes and 23-09's year-heatmap wrapper closed Round 1's R8/R11/R16, ticking TRN-01/TRN-02/TRN-04. TRN-03 stays Pending: R35 narrowed the phone-width overflow from 682px to 460px but did not close it -- the root cause relocated to the unwrapped five-tab div.segmented strip (Finding 11). Finding 12 (pre-existing Training Load tooltip epoch, re-observed) recorded unpatched.
- [Phase 23]: 23-13 Round 3 checkpoint closed a clean sweep (12 PASS / 0 FAIL / 0 BLOCKED across R43-R54): documentElement.scrollWidth equals clientWidth at all four phone widths (390/393/412/430), closing R35's overflow clause via plan 23-12's .trends-tablist-scroll wrapper. TRN-03 ticks for the first time; TRN-01/02/04 confirmed unregressed by their own Round 3 rows. Phase 23's requirement gate is fully closed.
- [Phase 24]: [Phase 24] 24-10 Round 2 checkpoint recorded a clean sweep — all nine rows (R15-R23) PASS, closing GAP-24-01 in both directions (R15 forward, R19 mirror, judged against an independently-derived stale-precomputed-flag value rather than UI self-agreement). CUR-01 ticked Complete on rendered evidence per the Phase 19 UI-02 / plan 19-15 precedent, closing Phase 24's requirement gate. Origin todo moved to completed/.
- [Phase 24]: Round 3 checkpoint (R24-R31, 24-14): 7/8 PASS. R26 recorded FAIL on its literal assertion — its own discriminator goes vacuous once R25's mandatory Recompute clears wasPRAtTheTime, so it cannot distinguish correct wiring from broken (R27 shows the 24-13 code is correct). GAP-24-02 and GAP-24-03 closed (R28/R29, R30); GAP-24-05 opened for the still-unproven WR-05 mirror direction. CUR-01 and the ROADMAP gate stay open per the plan's own all-rows-PASS rule.

### Key Findings

Carried forward for future milestones:

- ~~GeoNames database lives in node_modules~~ RESOLVED 2026-08: committed to data/geo/geonames.db (13.5 MB)
- Multi-city route prevalence: 86% of activities pass through multiple cities
- Pre-decoded heatmap points file is 12.7 MB — acceptable for CDN but worth monitoring
- Cadence unit semantics on intervals.icu's streams endpoint not yet empirically verified — flagged for Phase 14 planning (probe-intervals-style check before trusting the field).

### Aug 2026 maintenance arc (outside GSD, commits 5e36da9..3787c20)

- **Ingestion migrated Strava → intervals.icu** (Garmin bridge): Strava paywalled API access (June 2026); Garmin has no personal API. Adapter validated against live payloads (latlng = data/data2 parallel arrays; geometry distance-validated + reverse-geocode checked). Dedupe by start_date epoch.
- **CI recovered**: commit-step bug (gitignored data/stats in file_pattern) had frozen gh-pages since Feb 23; geocoding silently broken since March. Both fixed; nightly green with zero warnings.
- **Bulk-export consolidation**: `consolidate-exports` command + data/provenance.json linking 1,841/1,866 records to original FIT/GPX in export_data/ (gitignored, local-only — needs private backup). 4 runs rescued that the API never delivered.
- Archive: 1,866 runs, 20,744.7 km, 24 countries, 88 cities. See ~/.claude memory `intervals-icu-migration` for hard-won API facts.

### Pending Todos

1 pending — `.planning/todos/pending/2026-08-10-garmin-export-adapter-when-export-arrives.md` (write garmin adapter for consolidate-exports once the requested Garmin bulk export lands in export_data/garmin/)

**Not yet filed as a todo item — flagged during Phase 15 plan 04 for triage:** manual per-activity exclusion from personal-best/PR calculations (developer wants to exclude activities like `3475726256`/`3475725513`, recorded with an inaccurate GPS device, from PR consideration despite their engine-computed times matching Strava's own reported values exactly). Natural fit for Phase 18 (Records & Trends) planning — that's where PR-list presentation and any exclusion/override UI would live. See `.planning/phases/15-best-effort-engine/15-04-SUMMARY.md` Follow-ups section.

### Blockers/Concerns

- RESOLVED 2026-08-11 (found by human testing during 16-15, fixed in 0b59d8c, redeployed via run 31488806924): the first live deploy rendered a black page with only the title. The dashboard build emitted root-absolute asset URLs (`/assets/index-*.js` + stylesheet); on a Pages *project* page under /strava-widgets/ those escape the project, GitHub returns its 404 HTML, and the browser fails parsing that HTML as JS/CSS. Fixed with `base: './'` on the dashboard build. IMPORTANT LESSON — the phase's own exit gate reported 15/15 green on this broken build for two independent reasons: verify-dashboard-publish.mjs served the publish dir at the server ROOT (where absolute URLs resolve), and its asset check did `src.replace(/^\//,'')`, normalising the broken URL into a working one before fetching it. Both are fixed: the verifier now mounts under /strava-widgets and treats a root-absolute asset URL as a hard failure, and it checks the stylesheet too. Confirmed load-bearing — 2 failures / exit 1 against the broken build, 16/16 / exit 0 after the fix. This is the same failure mode as 16-09 (asserting a local shape that production does not have), now closed structurally rather than by intent.

Previously resolved — SQLITE_CANTOPEN CI failure resolved by quick-1-01 (lazy geocoder init + dynamic import).

- RESOLVED 2026-08-11 (code fix landed; awaiting human confirmation in 16-15/16-16): Phase 16 GAP 1 (blocking, DASH-02) — deep-linked activity detail view rendered "Couldn't load this activity" in a real browser. Root cause was `isValidActivityId` rejecting `i`-prefixed intervals.icu ids before any fetch was issued; fixed in plan 16-10 by widening the single validation chokepoint to `/^i?\d{1,20}$/`, with regression tests added. GAP 2 (cosmetic, DASH-03) — theme toggle invisible in light mode; fixed in plan 16-11 by syncing `color-scheme` to `data-theme`, pinning the toggle color to `var(--text)`, and replacing a dead `fill` rule with real `display` toggling. Both remain pending live-browser confirmation by plans 16-15 and 16-16.
- RESOLVED 2026-08-11: Plan 16-14 push rejections (twice, non-fast-forward). Both were the nightly CI's `git-auto-commit-action` data commits landing on origin/master ahead of us — the second was from the very daily-refresh run (31487234659) that this plan triggered. Both had zero file overlap with local's `.planning/` commits. Resolved by the orchestrator with plain `git merge origin/master` (chosen over rebase to avoid rewriting 178 unpushed commits for auto-generated data), no conflicts, followed by a successful push. origin/master is now current at 9871285 (0 ahead, 0 behind) and carries src/dashboard. No force-push or history rewrite was used at any point.
- OPEN 2026-08-11: Phase 17 GAP 1 (DETAIL-02) — route-map basemap tiles do not render in a real browser; polyline renders correctly over a white background. RouteRenderer.addBasemapSwitcher() does register the tile layer, so the vector-renders-but-tiles-absent signature points at leaflet/dist/leaflet.css not taking effect for the dynamically-imported map chunk (implicates the phase's own MEDIUM-confidence async-CSS-injection assumption, T-17-MAP-04). Root cause still under active diagnosis, not yet fixed. See 17-VALIDATION.md Gap-Closure Record.
- OPEN 2026-08-11: Phase 17 GAP 2 (DETAIL-03/DETAIL-04) — chart band x-axis origins are not vertically aligned across bands in a real browser; each band auto-sizes its own y-axis gutter to its widest tick label (pace's '10:00/km' vs HR's '120'), so the bands' plot areas start at different x-offsets. This also undermines the shared hover-crosshair guarantee (17-UI-SPEC.md § 4c), since one screen x maps to a different data x per band. Not yet fixed. See 17-VALIDATION.md Gap-Closure Record.
- OPEN 2026-08-12: Phase 19 gap-closure register (19-05 checkpoint, PARTIAL) — GAP 1 (UI-01/UI-02): a stray `*/` inside a CSS comment at src/dashboard/styles.css lines 54-56 (`--space-*/--zone-*/--load-*` prose) terminates the comment early, silently discarding the `--radius-control` custom property from the parsed stylesheet in production. Browser-confirmed: `{radiusControl: "(EMPTY)", radiusPanel: "8px", sample: "button.app-nav__toggle", borderRadius: "0px"}`. Affects 4 rules (input/select/textarea baseline, button baseline, both .segmented__option end-child radii) — all render 0px corners instead of 4px. Invisible to all four automated gate commands (all text-assertion over source, which still contains the correct declaration). GAP 2 (UI-02): the focus ring on the detail view's x-axis segmented control is occluded at the bottom by the first chart and on the right by the sibling option — a distinct mechanism from the overflow:hidden clipping plan 19-04 fixed. GAP 3: the esbuild css-syntax-error warning emitted during `npm run build-widgets` (`Expected ":" [css-syntax-error]` at `<stdin>:56:59`) was misclassified as non-blocking by 19-05 Task 1 — it is the build-time signature of GAP 1. Not yet fixed. See 19-VALIDATION.md Gap-Closure Record. Three additional non-Phase-19 issues (Safari-specific JS SyntaxError on page load, dead Records "View Activity" click handler, Safari type="month" degradation) logged in the same record but confirmed out of scope for this phase (git diff 670b3ec..HEAD touches only styles.css and styles.test.ts).
- OPEN 2026-08-13: Phase 19 gap-closure register (19-12 Round 3 checkpoint, PARTIAL) — GAP 7 (UI-02, new): the sticky top nav does not remain on screen while scrolling on Activities, confirmed by an ad-hoc probe (navH 77 = parentH 77, position: sticky computed but not holding). Blocks row 18 of 19-VALIDATION.md and UI-02. No suggested fix or root-cause theory recorded, per house rule for still-failing rows — next planning round (/gsd-plan-phase 19 --gaps) diagnoses and fixes it. GAP 6 (CR-01's z-index: 20 fix) is not marked resolved either: Probe B confirms the declaration ships in the bundle, but its rendered paint-order effect could not be observed because row 18 failed for the unrelated GAP 7 reason first. GAP 4 (CR-02) and GAP 5 (CR-03) ARE resolved this round on rendered evidence (rows 14-16 and row 17 all PASS). See 19-VALIDATION.md Gap-Closure Record and 19-12-SUMMARY.md.
- OPEN 2026-08-13: Phase 19 GAP 8 (new, found unprompted during 19-17's Round 4 checkpoint) — Leaflet map tiles paint over the top nav on the detail-view route map. Source-derived (not measured): Leaflet's own panes (z-index 400) and controls (z-index 1000) are untouched by src/dashboard/styles.css and sit above #app-nav-root's z-index: 20. Second face: plan 19-16's sticky-layer ladder comment claims a totally-ordered four-rung ladder that does not list Leaflet's panes as a fifth, unlisted rung above it. Argued in 19-VALIDATION.md and REQUIREMENTS.md not to block UI-02 (different component, no checkpoint row named it) — UI-02 is ticked complete. Not patched per house rule since 16-09. Disposition (a small follow-up plan: z-index fix + one browser re-check + ladder-comment correction, or a deferred item) is the user's call after Phase 19 closes. See 19-VALIDATION.md GAP 8.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Fix Daily Widget Refresh GitHub Actions workflow error | 2026-02-18 | 0f1d761 | [1-fix-daily-widget-refresh-github-actions-](./quick/1-fix-daily-widget-refresh-github-actions-/) |

## Deferred Items

Items acknowledged and deferred at the v2.0 milestone close on 2026-08-12.

**Update 2026-08-12:** six of these were absorbed into milestone v2.1 as requirements and are now tracked in ROADMAP.md, not here — CUR-01 (Phase 24), FIX-01 (Phase 21), FIX-02 / CI-01 / CI-02 / VER-01 (Phase 25). They remain listed below for the record but are no longer outstanding debt. Full detail in `.planning/v2.0-MILESTONE-AUDIT.md` (status `tech_debt`).

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 16 — `16-HUMAN-UAT.md`, 4 pending scenarios | partial |
| verification_gap | Phase 16 — `16-VERIFICATION.md` | human_needed |
| untested_seam | Phase 16 UAT items 1-3: light-OS legibility, first-paint white flash, live OS auto-follow — NOT discharged by phases 17/18 despite both running human checkpoints on the same shell | open |
| integration_warning | `daily-refresh.yml` runs the 8 compute steps in a different order than `src/index.ts`'s `compute-all-stats` chain; both currently safe, no shared source of truth | open |
| integration_warning | `verify-dashboard-publish.mjs` does not individually assert reachability for `weekly-distance`/`monthly-stats`/`yearly-stats`/`year-over-year`/`best-efforts.json`/shards — affects REC-02/03/05, TREND-01/02 | open |
| code_review | WR-01: Current Streak tile's `ended {date}` sub-label is structurally unreachable (root cause `streak-utils.ts:118`) | open |
| code_review | WR-02: `gear-aggregate-logic.ts` strict `label === null` Unknown-bucket test crashes `slugify()` on an absent `gearName` key | open |
| evidence_gap | REC-06's external correctness evidence is one distance (5k) with a 0.51-point unexplained delta; the plan asked for two | open |
| doc_defect | `18-UI-SPEC.md:843` checklist wording contradicts the authoritative chart spec at line 319 | open |
| quick_task | `1-fix-daily-widget-refresh-github-actions-` | missing |
| todo | Exclusion tickbox / local curation mode (`npm run curate`) — approach chosen 2026-08-12, not yet planned | new |
| todo | Garmin export adapter (STREAM-04) — blocked on the export arriving | deferred |
| ~~todo~~ | ~~Manual exclusion of activities from best efforts~~ — **CORRECTION 2026-08-12: not deferred. Shipped in Phase 16 plan 16-01 (`b9d10cd`); the todo file was simply never closed, so `audit-open` miscounted it and the v2.0 audit repeated the error.** | resolved |

## Session Continuity

Last session: 2026-09-02T10:41:18.627Z
Stopped at: Completed 24-14-PLAN.md — Round 3 checkpoint 7/8 PASS (R26 FAIL); GAP-24-02/GAP-24-03 closed, GAP-24-05 opened; CUR-01 stays Pending, Phase 24 gate stays open
Resume file: None

---
*Last updated: 2026-08-11 — Phase 17 (activity-browser-detail-views) all 15 planned plans executed and summarized; human checkpoint on plan 17-15 came back PARTIAL — 8/10 Manual-Only Verifications rows confirmed clean, GAP 1 (DETAIL-02, route-map basemap tiles absent) and GAP 2 (DETAIL-03/04, chart band x-axis misalignment) have open gaps pending gap-closure planning (`/gsd-plan-phase 17 --gaps`) before the phase gate closes*

## Wave 7 result (2026-09-02)

All three gap-closure plans merged to master and verified on the integrated tree:

- 24-11 (GAP-24-02, criterion 3): `curation-guard.mjs` now uses the inverted
  `UNSCANNED_EXTENSIONS = ['.json']` skip-list, so `.ts`/`.d.ts`/`.mjs`/extensionless files
  fail CLOSED. Four planted fixtures observed RED before the fix. The whole-tree run over the
  real `dist/widgets` scans all 22 `.d.ts` files and returns zero violations.

- 24-12 (GAP-24-03, D-12): `safeResolve` rejects malformed percent-escapes, the `createServer`
  listener body is try/catch-wrapped symmetrically with the curate branch, and the static route
  is now `isTrustedOrigin`-gated. Nine-step live smoke against a real `npm run curate` returned
  `200/403/200/403/403/403/403/empty/stopped`.

- 24-13 (GAP-24-04, WR-05): `buildPrBadgeLabels(entry, liveExclusions)` takes a REQUIRED second
  parameter and `BestEffortPanelRow.isPr` is `wasPRAtTheTime && !excluded`, both fed from
  `detail.ts`'s single `Promise.all`. Closes the `PRExcluded — {reason}` string R15 quoted.

Post-merge gate: `tsc --noEmit`, `npm run build`, `npm run build-widgets` all exit 0.

One cross-plan defect the gate caught, which neither plan could see alone: 24-11's whole-tree
case READS the real `dist/widgets` while 24-05's `verify-dashboard-publish-guard.test.mjs`
PLANTS and removes `dist/widgets/__curate` inside that same real tree by design. Under vitest's
default file parallelism the reader intermittently saw the planted fixture — 1 failure in 4
full-suite runs. Fixed at the user's direction with `fileParallelism: false` in
`vitest.config.ts` (commit `e01ea8c`), ~1.2s → ~6.6s for the whole suite. Verified 60/60 green
across 4 consecutive runs. 24-14's Round 3 evidence is therefore gathered against a
deterministically green suite.

CUR-01 remains Pending. It re-ticks only on evidence 24-14 produces.

## Round 3 result (2026-09-02, plan 24-14)

R24-R31 scored **7 PASS / 1 FAIL**. GAP-24-02 and GAP-24-03 are CLOSED (R28/R29, R30). GAP-24-04
(WR-05) is only PARTIALLY closed: R24 proves the forward direction (header badge vs. panel flags
cells compared explicitly in one paint, `PRExcluded` string absent), but R26 (human-hand: untick,
confirm dialog, Cancel, OK) is **FAIL** — its own discriminator (the precomputed document still
saying `excludedFromRecords: true`) is vacuous, because R25's mandatory Recompute also clears
`wasPRAtTheTime` to `false` for every distance, and both render paths gate on that flag before
ever consulting the live document. So the row cannot distinguish correct wiring from broken
wiring. R27's supporting evidence shows the 24-13 code is in fact correct — this is a
checkpoint-design defect, not an implementation defect.

**GAP-24-05 opened** (`24-VALIDATION.md` § "Round 3 Checkpoint (R24-R31)"): the live-document
mirror direction of WR-05 remains unproven by any round to date (Round 2's R19 and this round's
R26 both failed for the same structural reason). A future row needs to hold `wasPRAtTheTime: true`
and precomputed `excludedFromRecords: true` simultaneously — not reachable via the curate UI's own
Save→Recompute→Untick sequence — e.g. by editing `data/stats/best-efforts.json` directly.

Per the plan's own rule (CUR-01 and the gate tick ONLY if every mapped row is PASS), the
disposition was withheld: CUR-01 stays Pending in `REQUIREMENTS.md`, the ROADMAP Phase 24 gate
stays open, and the origin todo stays in `pending/`. `24-VERIFICATION.md` gained an appended
Gap-Closure Record (frontmatter untouched); `24-REVIEW.md` gained dated CLOSED/PARTIALLY CLOSED
notes on CR-01, CR-02 and WR-05.

Next: a further gap-closure round targeting GAP-24-05 (`/gsd-plan-phase 24 --gaps`), or proceed to
Phase 25, which has no dependency on Phase 24.

## Round 4 re-verification and the gate decision (2026-09-02)

All 14 plans are executed and every execute-phase gate has run.

Gates: post-merge build/test green (60/60 files, 1531 tests, `tsc` 0, `build-widgets` 0);
regression gate green; code review appended a Wave 7 section to `24-REVIEW.md` tracing CR-01,
CR-02 and WR-05 as CLOSED in code and raising 5 new Warnings; re-verification round 4 returned
**`passed`, 5/5**, reversing the earlier `gaps_found` (2/5).

The verifier did not merely ratify the checkpoint — it re-derived each prior gap against live
source, live-planted its own `.d.ts` fixture rather than trusting R28's narration, and surfaced
`src/dashboard/views/detail-best-efforts-logic.test.ts:286` ("R19 mirror-image"), an existing unit
test that constructs the `wasPRAtTheTime: true` + `excludedFromRecords: true` + empty-live-index
state R19 and R26 could not reach and asserts the badge renders. Confirmed green independently.

**That correction narrows GAP-24-05** from "the mirror direction is unproven" to "the mirror
BEHAVIOUR is proven at the unit level; browser-row COVERAGE of it is missing."

**The gate was nonetheless held OPEN by developer decision**, because criterion 4 is by its own
wording a human checkpoint and R26 FAILED, and because CUR-01 was already ticked prematurely once
after Round 2 and had to be reopened when the code review landed afterwards. CUR-01 stays
**Pending**; Phase 24 stays **In Progress**; the origin todo stays in `pending/`.

Three concrete items remain for a closing round (see AMENDED GAP-24-05 in `24-VALIDATION.md`):

1. A browser row that reaches the discriminating state by editing `data/stats/best-efforts.json`
   directly (no Recompute), then observing suppress-and-restore.

2. **WR-14** — `curation-guard.mjs:116-130` has no `entry.isFile()` guard; symlinks/EISDIR/EACCES
   throw out of the guard and a FIFO blocks forever. Reproduced independently twice.

3. **WR-17** — nothing structurally pins `buildPrBadgeLabels`'s call site or that it shares the
   panel's `liveExclusions` binding; `buildPrBadgeLabels(entry, null)` would type-check and
   silently reinstate WR-05.

Phase 25 (CI Hardening & Light-Theme Verification) has no dependency on Phase 24 and is available.
