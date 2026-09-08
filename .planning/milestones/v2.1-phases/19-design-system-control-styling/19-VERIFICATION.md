---
phase: 19-design-system-control-styling
verified: 2026-08-13T14:20:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "UI-02 (ROADMAP SC2): the three defects that blocked the prior verification round — CR-01 (:focus-visible z-index painting over the sticky nav), CR-02 (segmented middle-option radius leak), CR-03 (focus-ring opacity composited below 3:1 on aria-disabled controls) — are all confirmed closed in source AND on rendered evidence gathered across Round 3 (rows 14-17) and Round 4 (rows 20-23) of 19-VALIDATION.md. A fourth, independently-discovered defect (GAP 7: the sticky nav did not actually stay on screen while scrolling, discovered mid-Round-3 when CR-01's own premise turned out to be unreachable) was diagnosed empirically (19-13, H1 — zero-travel containing block) and fixed (19-14: sticky rung moved from .app-nav to #app-nav-root) before this round's checkpoint could observe CR-01 for the first time."
  gaps_remaining: []
  regressions: []
deferred: []
---

# Phase 19: Design System Control Styling Verification Report

**Phase Goal:** Form controls, buttons, selects and card/spacing rhythm follow one shared visual treatment across all five screens (Overview, Activities, Calendar, Records, Trends), fixing the root cause of the "raw" feel without changing the existing visual language.
**Verified:** 2026-08-13T14:20:00Z
**Status:** passed
**Re-verification:** Yes — this supersedes the prior `19-VERIFICATION.md` (score 3/4, UI-02 FAILED on CR-01/CR-02/CR-03), which is preserved below in the re-verification frontmatter as `gaps_closed`. This pass covers all four rounds of the phase (waves 1-9 initial ship, waves 10-12 Round 3, waves 13-17 Round 4), with primary new evidence coming from Round 4.

## Summary

This is the fourth verification pass over a phase that has now recorded, and mitigated, five distinct false-green mechanisms in its own gap-closure record (`19-VALIDATION.md` § Lessons). I re-checked the Round 4 claims independently against source rather than trusting `19-VALIDATION.md`'s narrative, and re-ran the automated suite myself. The CSS fixes for CR-01, CR-02, CR-03 and GAP 7 are all present, correctly shaped, and covered by mutation-hardened regression tests (confirmed by `19-REVIEW-round4.md`, which executed the mutations itself rather than reading the fix). The Round 4 human checkpoint (rows 20-24) genuinely bears on UI-02's own text — each row carries its own PASS verdict, both themes are recorded for the theme-gated rows, and the checkpoint used objective probes (Probe G, Probe H) run before judgment rather than relying on developer appearance-only reports. I did not find evidence of a blanket-approval shortcut of the kind that produced the original CR-01/CR-02/CR-03 miss.

**On screen coverage (the specific concern raised for this pass):** Overview and Trends receive materially different depths of scrutiny than Activities/Records, but this tracks what each screen actually contains, not an evasion. I confirmed by reading `src/dashboard/views/overview.ts` that Overview has **zero** buttons, selects or inputs — it is a read-only stat/card display. UI-01 and UI-02 (control styling, focus ring) therefore have nothing to check on Overview by construction; only UI-03 (card/panel rhythm) applies, and that was checked by name in three separate rounds (row 7 at 19-05, row 19(c) in Round 3, row 24(c) in Round 4). Trends is the most heavily instrumented screen in the whole validation record (rows 14-16, three separate segmented-control groups probed with actual computed `border-radius` values in both the default and Training Load tabs). Calendar is covered by rows 2, 5, 17, and the Activities+Calendar-scoped input-baseline sub-checks (19(b)/24(b)). Records is covered by rows 6, 19(c)/24(c), 22, 23, and the "View Activity" link follow-up. I judge coverage adequate for the goal as stated, not merely present.

**On "without changing the existing visual language":** two deliberate deviations are on record, both disclosed to and accepted by the developer at checkpoint time rather than discovered later: the `.activity-table tbody tr:hover` dark-theme retrofit (row 9, accepted) and the button-text size increase from the ~13.3px UA default to the inherited 16px body size (row 13, accepted, "looks good"). Both are documented as intentional, checkpointed deviations — not silent scope creep — so the goal's "without changing" clause is satisfied in the sense the roadmap intends (no undisclosed visual drift), not in an absolute zero-diff sense.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | UI-01 — every input/select/textarea renders with consistent border, padding, background, min-height and control radius across all five screens | ✓ VERIFIED | `--radius-control` resolves to `4px` (GAP 1, closed 19-06). Round 3 row 19(b) and Round 4 row 24(b) both independently confirm Activities and Calendar input baselines render bordered/padded/4px-cornered with no unstyled default. Overview/Records/Trends have no form-control surface for this requirement to apply to (confirmed by source read of `overview.ts`; Records/Trends controls are covered under UI-02 rows instead). |
| 2 | UI-02 — buttons/selects share one visual treatment, with a `:focus-visible` ring that meets non-text contrast requirements, visible in both themes | ✓ VERIFIED | All three prior-verification blockers (CR-01, CR-02, CR-03) confirmed closed in source (`styles.css:911-917` `.segmented__option { border-radius: 0 }`; `:1464-1467` `:disabled:focus-visible, [aria-disabled="true"]:focus-visible { opacity: 1 }`; `:228-231` `#app-nav-root { position: sticky; top: 0; z-index: 20 }`) and on rendered evidence: rows 14-16 (Trends segmented groups, Probe A computed corner geometry), row 17 (calendar rest-day focus ring, Probe C computed opacity/ring), rows 20-21 (nav stickiness and paint order, Probes G/H, both routes both themes). GAP 7 (sticky nav not staying on screen — a defect discovered independently of, and blocking observation of, CR-01) was diagnosed empirically (19-13, H1 confirmed by 4 excluded alternatives) and fixed (19-14), then re-verified on rendered evidence (row 20). |
| 3 | UI-03 — spacing, density and card treatment read as one rhythm across all five screens | ✓ VERIFIED | `--radius-panel` resolves correctly; confirmed unregressed by row 19(c) (Round 3) and row 24(c) (Round 4), both explicitly naming Overview and Records. WR-03 (10 selectors still hardcode literal `4px`/`8px`/`6px` matching current token values) remains an open maintainability item, explicitly deferred with a stated re-entry trigger (`deferred-items.md`), not a rendering break. |
| 4 | ACT-01 — Activities controls adopt shared styling; row-click interaction model preserved as reference pattern | ✓ VERIFIED | `src/dashboard/views/list.ts` has zero diff across the entire Phase 19 commit range. Confirmed unregressed by row 8/9 (initial checkpoint), row 19(d) (Round 3), row 24(d) (Round 4) — each an independently-verdicted sub-check, not a blanket approval. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/dashboard/styles.css` | Radius tokens, control baselines, focus ring, panel rhythm, segmented control, disabled treatment, sticky-nav stacking ladder | ✓ VERIFIED | All Round 3/4 fixes confirmed present and correctly shaped by direct read: `.segmented__option { border-radius: 0 }` (line ~917), `:disabled:focus-visible, [aria-disabled="true"]:focus-visible { opacity: 1 }` (line ~1464-1467), `#app-nav-root { position: sticky; top: 0; z-index: 20 }` (line ~228-231), `.app-nav` no longer declares `position: sticky` anywhere in the file (confirmed by grep). |
| `src/dashboard/styles.test.ts` | Regression coverage for all Phase 19 rules including Round 3/4 fixes | ✓ VERIFIED | 927/927 tests pass (up from 919 at the prior verification, reflecting Round 4's hardened guard layer). Dedicated tests exist and were independently mutation-tested by `19-REVIEW-round4.md`: `.segmented__option cancels the button baseline radius so middle options render square (CR-02)`, `a control that is both focusable and aria-disabled restores full opacity under :focus-visible... (CR-03)`, `the sticky-layer ladder (#app-nav-root > .records-jump > .splits-table__km > :focus-visible) holds numerically and in order`. |
| `src/dashboard/views/list.ts` | Unmodified | ✓ VERIFIED | Zero diff across the Phase 19 commit range (re-confirmed this pass). |
| `index.html` / `main.ts` | `#app-nav-root` is a real DOM ancestor with scroll travel for the moved sticky rung | ✓ VERIFIED | `index.html:58` — `<header id="app-nav-root"></header>`, direct child of `<body>`. `main.ts:22` mounts the nav into it. Confirmed by `19-REVIEW-round4.md` and independently re-confirmed here. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `button` baseline `border-radius` | `.segmented__option` middle children | `.segmented__option { border-radius: 0 }` overriding at specificity `0,1,0` vs `0,0,1` | ✓ WIRED | Confirmed in source and on rendered geometry (Probe A: every middle option computes exactly `0px` across four segmented groups). |
| `:focus-visible` ring | `[aria-disabled="true"]`/`:disabled` focusable elements | `:disabled:focus-visible, [aria-disabled="true"]:focus-visible { opacity: 1 }` | ✓ WIRED | Confirmed in source and on rendered probe (Probe C second attempt: `opacity: "1"`, non-empty two-stop ring on a real calendar rest day). |
| Sticky rung | `#app-nav-root` (real scroll-travel ancestor) | `position: sticky; top: 0; z-index: 20` moved off `.app-nav` | ✓ WIRED | Confirmed structurally (`index.html`/`main.ts`) and on rendered evidence (Probe G: `sy: 600, rootTop: 0, navTop: 0` on both `#/list` and `#/records`). |
| `:focus-visible` `z-index: 1` | `#app-nav-root` `z-index: 20` | CSS 2.1 Appendix E paint order, now with both elements' stacking explicitly declared | ✓ WIRED | Confirmed on rendered evidence for the first time this phase (Probe H + row 21: "pass all" across Activities/Records × light/dark, orange ring never painted over the nav). |
| `--radius-control` token | `input, select, textarea` / `button` baselines | `var(--radius-control)` | ✓ WIRED | Resolves to `4px`; unchanged and re-confirmed since the prior verification pass. |

### Data-Flow Trace (Level 4)

Not applicable in the conventional sense — this phase ships CSS/styling rules, not components consuming a data source. The equivalent check (does the declared rule's cascade outcome actually reach the rendered element, rather than being shadowed by a higher-specificity or later rule) is what rows 14-23 and Probes A/C/G/H exist to test, and is covered above under Key Link Verification.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full automated suite green | `npm test` | 927/927 passed, 46 files | ✓ PASS |
| `.segmented__option` declares its own `border-radius: 0` | `sed -n '911,917p' src/dashboard/styles.css` | Confirmed present | ✓ PASS |
| Disabled-but-focusable opacity restore rule present | `sed -n '1464,1467p' src/dashboard/styles.css` | `:disabled:focus-visible, [aria-disabled="true"]:focus-visible { opacity: 1 }` | ✓ PASS |
| Sticky rung lives on `#app-nav-root`, not `.app-nav` | `grep -n "position: sticky\|z-index" src/dashboard/styles.css` | `#app-nav-root` carries `position: sticky; z-index: 20`; `.app-nav` block has no `position: sticky` | ✓ PASS |
| `#app-nav-root` is a direct child of `<body>` with real scroll travel | Read `index.html:58`, `main.ts:22` | Confirmed | ✓ PASS |
| Overview screen has no form controls (explains thinner UI-01/UI-02 evidence there) | `grep -n "<button\|<select\|<input" src/dashboard/views/overview.ts` | Zero matches | ✓ PASS (confirms scope, not a gap) |
| No debt markers in shipped files | `grep -n "TBD\|FIXME\|XXX" src/dashboard/styles.css src/dashboard/styles.test.ts` | No matches | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` shell probes exist for this phase — its verification mechanism is in-browser JavaScript console probes (Probe A through Probe H) run by the developer during the human checkpoint and recorded verbatim in `19-VALIDATION.md`, not standalone shell scripts this verifier can re-execute. I did not find any `scripts/.../tests/probe-*.sh` reference in the PLAN/SUMMARY files for this phase, so Step 7c's shell-probe execution contract does not apply. I instead independently re-derived the source-level preconditions each in-browser probe depended on (CSS rule presence and shape) and cross-checked them against `19-REVIEW-round4.md`'s own independently-executed mutation tests, which is the closest available substitute given no re-runnable probe artifact exists in this repo.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UI-01 | 19-02, 19-04, 19-05, 19-06 | Form controls styled consistently | ✓ SATISFIED | Dead-token gap closed and re-confirmed unregressed twice (rows 19(b), 24(b)). `REQUIREMENTS.md`'s `[x]` is defensible. |
| UI-02 | 19-03, 19-04, 19-05, 19-07, 19-10, 19-11, 19-14 | Shared button/select treatment + focus ring meeting contrast | ✓ SATISFIED | CR-01/CR-02/CR-03 and GAP 7 all closed on rendered evidence across Rounds 3 and 4, each with independent per-row PASS verdicts, both themes recorded where required. `REQUIREMENTS.md`'s `[x]` (dated to the Round 4 clean sweep) is defensible. |
| UI-03 | 19-01, 19-04, 19-05 | Spacing/density/card rhythm | ✓ SATISFIED | Re-confirmed unregressed twice, explicitly naming Overview and Records. |
| ACT-01 | 19-02, 19-03, 19-05 | Activities shared styling + preserved row-click model | ✓ SATISFIED | `list.ts` unmodified across all 17 plans; re-confirmed unregressed twice with its own lettered sub-check each time. |

No orphaned requirements — `REQUIREMENTS.md`'s "Phase 19" rows are exactly UI-01, UI-02, UI-03, ACT-01, matching the phase's own `requirements:` frontmatter across all 17 plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/dashboard/styles.test.ts` | ~161 | WR-01 (19-REVIEW-round4.md): `AT_RULE_RANGES`' regex assumes every at-rule has a `{`-delimited block; a brace-less at-rule (`@import`, `@charset`) would swallow the following real rule into its "at-rule range" | ⚠️ WARNING | Dormant — no brace-less at-rule exists in `styles.css` today. Would produce a confusing spurious failure if one is ever added. Test-helper substrate only, not reachable by any current assertion. |
| `src/dashboard/styles.test.ts` | 254-280 | WR-02 (19-REVIEW-round4.md): `bodyForSelectorListToken`'s `source` override parameter is checked against `AT_RULE_RANGES` computed from the real stylesheet, not from `source` itself | ⚠️ WARNING | Latent trap for a future author extending this exact describe block with a synthetic at-rule test. Not exploitable by either current call site (both short, at-rule-free strings). |
| `src/dashboard/styles.test.ts` | 325-336 | WR-03 (19-REVIEW-round4.md): `ruleWithHeadContaining` throws on the first at-rule-scoped match instead of skip-and-continue, unlike its sibling helper hardened in the same commit | ⚠️ WARNING | Inconsistency between two helpers hardened together in the same round. Not exploitable today — the one call site's substring never falls inside `@media`. |
| `src/dashboard/styles.css` | various (10 selectors, per `deferred-items.md`) | Partial radius-token adoption — literal `4px`/`8px`/`6px` instead of `var(--radius-control)`/`var(--radius-panel)` | ⚠️ WARNING | Consciously deferred with a stated re-entry trigger (next token retune). Currently not a rendering defect — literal values match token values. |
| — | — | GAP 8 (Leaflet map panes, z-index 400/1000, paint over `#app-nav-root`'s z-index 20 on the detail-view map; the sticky-layer ladder comment's "totally-ordered" claim is now known incomplete for not listing Leaflet's rungs) | ℹ️ INFO / ESCALATION | Reported unprompted by the developer during Round 4, found via source read (not a rendered probe), argued in `19-VALIDATION.md` not to block UI-02's own text (a third-party map library's stacking, not "buttons, selects" the requirement names), left deliberately unpatched per the phase's own house rule against patching under checkpoint pressure. **Disposition explicitly deferred to the user** — a small follow-up plan (map-container z-index fix + one browser re-check + ladder-comment correction) or a formal deferred item, whichever the user prefers. Not treated here as a new discovery; surfaced because it is still an open decision point. |
| — | — | `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` scan across `styles.css`/`styles.test.ts` | — | None found. |

No 🛑 BLOCKER anti-patterns found in this pass.

## Human Verification Required

None. The phase's own ROADMAP Success Criterion 5 (human checkpoint under a production-shaped URL, comparing all five screens, tabbing through controls in both themes) has already been discharged — thoroughly, and with the specific per-row, both-theme, probe-gated rigor this phase's own history of false-green mechanisms demanded — across the Round 4 checkpoint (`19-VALIDATION.md` rows 20-24, plus Round 3 rows 14-19 and the original rows 1-13). I found no gap in that checkpoint's coverage that would require re-opening it, and no new claim in this phase that hasn't already been put in front of the developer.

**One item is flagged for a disposition decision, not further testing:** GAP 8 (Leaflet map z-index over the nav) is a real, developer-observed, unpatched visual defect whose fix-now-vs-defer decision was explicitly left to the user by the phase's own closing plan. It does not block this phase's goal as scoped (the goal and its requirements concern form controls/buttons/selects/card rhythm, not third-party map layering), so it does not change this verification's status, but it should not be silently dropped either. See the Gaps Summary below.

## Gaps Summary

None blocking. All four requirements (UI-01, UI-02, UI-03, ACT-01) are independently confirmed satisfied against source and against the rendered-evidence checkpoint record across all four rounds of this phase. The three defects that failed the prior verification pass (CR-01, CR-02, CR-03) and the one defect discovered mid-Round-3 (GAP 7, sticky nav not staying on screen) are all confirmed closed — in source, and for the first time this phase, on rendered evidence that actually reached the specific premise each defect concerned (a focused control genuinely scrolled under a genuinely-sticky nav, not merely a z-index declaration read from source).

Two categories of non-blocking finding are carried forward for visibility rather than hidden:

1. **GAP 8** (Leaflet map z-index) — a real, unpatched, developer-confirmed visual defect on the detail-view map, reasoned not to block UI-02's own wording, disposition explicitly left to the user.
2. **Three latent test-substrate warnings** (WR-01/02/03 in `19-REVIEW-round4.md`) — dormant, unexploited by any current assertion, in the guard-layer machinery added this round, not in `styles.css` itself. Advisory only.

Neither category changes this phase's PASSED status; both are documented so a future phase or a deliberate follow-up plan can pick them up without rediscovery.

---

_Verified: 2026-08-13T14:20:00Z_
_Verifier: Claude (gsd-verifier)_
