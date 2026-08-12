---
phase: 19-design-system-control-styling
verified: 2026-08-12T18:46:32Z
status: gaps_found
score: 2/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "UI-01: every input, select and textarea renders with the intended border, padding, background, min-height and control radius across all five screens"
    status: failed
    reason: "Dead --radius-control custom property (GAP 1). src/dashboard/styles.css lines 54-56 contain a CSS comment whose body includes a premature `*/` inside the literal prose `--space-*/--zone-*/--load-*`, terminating the comment early. Browser-confirmed: getPropertyValue('--radius-control') returns empty; a sampled input/button computes border-radius: 0px. The developer's row-1 checkpoint observation ('sure') was made against this broken condition and is recorded in 19-VALIDATION.md as BLOCKED BY DEFECT, not a pass."
    artifacts:
      - path: "src/dashboard/styles.css"
        issue: "Lines 54-56: comment body contains an early '*/' at '--space-*/', causing CSS error-recovery to discard the real --radius-control declaration text up to the next ';'. Confirmed still present at HEAD — reproduced independently in this verification via a raw-text parser walk and via a live `npm run build-widgets` run (esbuild still emits `[WARNING] Expected \":\" [css-syntax-error]`)."
    missing:
      - "Rewrite the comment at lines 54-57 so it contains no internal '*/' sequence (e.g. rephrase '--space-*/--zone-*/--load-*' as '--space-*, --zone-*, --load-*' or similar), so --radius-control parses as a real custom property in the browser."
  - truth: "UI-02: buttons, selects and other controls share one visual treatment, including a visible, unoccluded :focus-visible ring in both themes"
    status: failed
    reason: "Two independent failures. (a) Same dead --radius-control token as UI-01 (GAP 1) — affects the button baseline (styles.css:1201) and both segmented end-child radius rules (lines 826, 830), so 12 compared button treatments and the segmented control's rounded silhouette were judged under 0px-corner rendering, not the intended 4px radius (rows 3 and 12 in 19-VALIDATION.md, both recorded BLOCKED BY DEFECT). (b) Focus ring occlusion (GAP 2) — on the detail view's x-axis segmented control the :focus-visible ring is partially covered at the bottom by the first chart and on the right by the sibling 'Time' option. Developer-confirmed FAIL, a distinct paint-order mechanism from the overflow:hidden clipping plan 19-04 removed."
    artifacts:
      - path: "src/dashboard/styles.css"
        issue: "Lines 54-56 (shared root cause with UI-01, see above); detail-view segmented control occlusion is a layout/paint-order issue not isolated to a single rule — plan 19-04's `.segmented` de-clip did not address it."
    missing:
      - "Fix the same comment defect (closes rows 3 and 12)."
      - "Diagnose and fix the neighbour-occlusion of the focus ring on the detail view's segmented control (row 6) — likely requires z-index, box-shadow spread, or stacking-context changes distinct from the overflow:hidden removal already shipped."
deferred: []
---

# Phase 19: Design System Control Styling — Verification Report

**Phase Goal:** Every input, button, select and card follows one shared visual treatment, with a visible focus ring in both themes, across all five screens
**Verified:** 2026-08-12T18:46:32Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Summary

This report confirms the three known gaps recorded in `19-VALIDATION.md` (dead `--radius-control` token, occluded focus ring, misclassified build warning) using independent evidence gathered directly against the codebase and the built artifacts — not by re-reading the SUMMARY narrative. It then answers the four targeted questions in `<your_focus>`. **One new mechanism-level finding was made** (documented below as Additional Finding A); **no new production-code defect** was found beyond the three already recorded. UI-03 and ACT-01 are independently confirmed genuinely complete, on evidence distinct from the developer's compromised checkpoint observations.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | UI-01 — every input/select/textarea styled consistently, no unstyled browser defaults | ✗ FAILED | GAP 1 confirmed independently (see below). `--radius-control` never resolves in the shipped bundle; input baseline at `styles.css:1165` depends on it. |
| 2 | UI-02 — buttons/selects share one treatment with a visible, unoccluded focus ring in both themes | ✗ FAILED | GAP 1 (button/segmented radius) + GAP 2 (ring occlusion on detail-view segmented control), both confirmed independently. |
| 3 | UI-03 — spacing, density and card treatment follow one rhythm across all five screens | ✓ VERIFIED | Independently re-derived (not solely from the checkpoint sign-off) — see "UI-03 Independent Verification" below. |
| 4 | ACT-01 — Activities controls adopt shared styling; row-click interaction model preserved as reference pattern | ✓ VERIFIED | Independently re-derived — see "ACT-01 Independent Verification" below. |

**Score:** 2/4 truths verified

## Answers to Focus Questions

### 1. Are UI-03 and ACT-01 genuinely, defensibly complete?

**UI-03 — YES, defensible independent of the compromised checkpoint.**

- `--radius-panel` (the token UI-03's panel/grid rhythm depends on) is a **separate** custom property from the broken `--radius-control`. Traced the shipped bundle `dist/widgets/assets/index-U16xFz57.css`: `--radius-panel: 8px` appears correctly inside `:root{...}` in a position *before* the corrupted comment region — but more importantly, the corrupted comment's CSS error-recovery only discards tokens up to the **next semicolon after the leaked prose**, which lands exactly at the end of `--radius-control: 4px`. `--radius-panel: 8px` (the declaration immediately following) is unaffected and parses normally. 19-VALIDATION.md's own browser probe already confirms this (`radiusPanel: "8px"`); this verification independently re-derived the same conclusion via static analysis of the comment-termination mechanics, not by trusting the probe output.
- All five D-13 panel/grid edits were checked directly in the shipped, minified bundle (not just the source): `.error-state,.stub-panel`, `.empty-state`, `.calendar-picker`, `.config-notice` all emit `border-radius:var(--radius-panel);...padding:var(--space-lg)` intact and well-formed, and `.stat-grid` emits `gap:var(--space-lg)` (corrected from the retired `--space-xl`). All five ship as valid, parseable CSS rules — confirmed with a direct grep against the bundle, not the source.
- Conclusion: UI-03's dependency chain is genuinely clean of GAP 1. The `[x]` in REQUIREMENTS.md is defensible on evidence independent of the developer's checkpoint judgment.

**ACT-01 — YES, defensible independent of the compromised checkpoint.**

- `src/dashboard/views/list.ts` has **zero diff** across the entire Phase 19 commit range. Verified via `git diff b932787..HEAD --stat -- . ':(exclude).planning/*'`, which shows changes to exactly two files: `src/dashboard/styles.css` and `src/dashboard/styles.test.ts`. Also confirmed via `git log --oneline -- src/dashboard/views/list.ts`, whose most recent commit (`d7552ff`, Phase 18 work) predates Phase 19 entirely. This is not a claim taken from SUMMARY.md — it is a direct git history check.
- Because `list.ts` (which owns the row-click handler, keyboard activation, sort/filter/pagination logic) is untouched, the row-click interaction model cannot have regressed from a code-change standpoint — the only surface Phase 19 could have broken it through is CSS (`pointer-events`, `cursor`, or a stacking/clipping change over the row). No such rule was found: `grep` for `pointer-events` in `styles.css` returns no result affecting `.activity-table`, and the row-hover retrofit (`.activity-table tbody tr:hover { background: color-mix(...) }`) is a pure background-color rule with no interaction-blocking properties.
- The row-hover retrofit rule itself is well-formed: confirmed present, syntactically valid, and correctly emitted in the shipped bundle (`.activity-table tbody tr:hover{background:color-mix(in srgb,var(--surface) 92%,var(--text))}`).
- Conclusion: ACT-01's `[x]` in REQUIREMENTS.md is defensible on evidence (git diff + static CSS check) independent of the developer's compromised visual judgment on rows 1/3/12 elsewhere in the checkpoint.

### 2. Is the `*/`-in-comment defect the only parse-level breakage in styles.css?

**Yes — confirmed the only instance, via three independent checks:**

1. **Bundle scan for stray comment markers.** A byte-level scan of the shipped, minified `dist/widgets/assets/index-U16xFz57.css` found exactly two `*/` occurrences and zero unmatched `/*`. Both belong to the single known defect: the false early terminator (inside `--space-*/`) and the genuine intended terminator immediately before `--radius-control`. No other comment-related artifact exists anywhere else in the ~24KB minified output.
2. **Full comment-block walk of the source.** Walked every `/* ... */` block in `src/dashboard/styles.css` (54 comments total) using first-`*/`-wins semantics (matching real CSS parsing behavior) and inspected the tail of each comment body plus the text immediately following its close. All 53 other comments close cleanly at author-intended positions (each ends with a trailing space before `*/`, and the text following is a syntactically normal selector or declaration start). Only the comment at source offset 1870 (the Phase 19 radius-scale comment, lines 54-57) shows the truncation signature — ending mid-word ("...following the --space-") instead of at a natural comment boundary.
3. **Dangling `var()` reference scan.** Extracted every `--custom-property:` definition and every `var(--custom-property)` usage from the shipped bundle. Zero custom properties are referenced via `var()` without a matching definition somewhere in the file. This confirms there is no *second* class of broken token (e.g., a property referenced but never declared at all) — GAP 1 is specifically a "declared but discarded by parser error-recovery" defect, and it is singular.

**Conclusion:** No additional gap of this class exists. GAP 1 is fully isolated to the one comment block already documented.

### 3. Do any of the five Phase 19 `describe` blocks in styles.test.ts have an assertion that should have caught GAP 1 — and is there a broader hollow-assertion risk?

**Yes — one specific assertion is structurally blind to GAP 1, and the mechanism is worth recording precisely (Additional Finding A below).**

`styles.test.ts:314-319` ("`:root` declares both radius tokens") is the assertion that most directly targets the broken declaration:
```js
it(':root declares both radius tokens', () => {
  const decl = declarationsFor(':root');
  expect(decl).toContain('--radius-control: 4px');
  expect(decl).toContain('--radius-panel: 8px');
});
```
This test passes at HEAD (confirmed via `npm test`, 909/909 green) despite `--radius-control` never resolving in a real browser. Traced why: the file's own comment-stripping helper (`styles.test.ts:18`, `const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '')`) uses a **non-greedy** regex — i.e. it also terminates each comment match at the *first* `*/`, the same semantics a real CSS parser uses. When applied to the defective comment, this regex strips only through the false early terminator, leaving the leaked prose (`-zone-*/--load-* precedent rather than the --chart-* per-theme precedent. */`) as **raw, unstripped text sitting inside the `:root` rule body** in `cssNoComments` — immediately followed by the still-literal, still-intact substring `--radius-control: 4px`. Because `declarationsFor()` and the test's `.toContain()` assertion do plain substring matching rather than validating that the substring sits at a syntactically reachable declaration position, the assertion finds the literal characters `--radius-control: 4px` in the leaked garbage and passes — exactly mirroring, at the test-tooling level, the same "text exists but is unreachable" failure mode that broke the real browser parse. This is a faithful demonstration of the boundary 19-VALIDATION.md's Gap-Closure Record already names in the abstract ("a green suite proves a rule exists in the source, never that it parses or renders as intended") — this verification traced the exact code path that produces that outcome for this specific assertion.

**Broader risk:** every assertion in the five Phase 19 `describe` blocks (40 assertions total, using `declarationsFor`, `selectorListDeclares`, or `ruleWithHeadContaining`) shares the same substring-matching methodology and is exposed to the same class of blind spot *in principle*. In practice, per the answer to question 2 above, no other comment-truncation defect currently exists in the file, so no other must-have is presently hollow through this mechanism — but the structural risk is real for any future edit that introduces a similarly-terminated multiline comment near a declaration. This is not a new gap to fix now; it is a latent methodology risk worth flagging for anyone maintaining this test file (e.g. as a follow-up: assert the round-trip property count, or add a lightweight "no unbalanced `*/`-inside-comment-body" lint check, rather than relying solely on substring containment).

**No other must-have was found to rest solely on a similarly hollow source-text assertion at this time.**

### 4. Requirement ID accounting

- Plan frontmatter requirement IDs across all five plans: 19-01 `[UI-03]`, 19-02 `[UI-01, ACT-01]`, 19-03 `[UI-02, ACT-01]`, 19-04 `[UI-01, UI-02, UI-03]`, 19-05 `[UI-01, UI-02, UI-03, ACT-01]`. Union = `{UI-01, UI-02, UI-03, ACT-01}` — exactly matches the four requirement IDs assigned to this phase in the verification task and in `REQUIREMENTS.md`.
- Cross-referenced `REQUIREMENTS.md`: `Phase 19` is listed against exactly these four IDs (lines 75-78), with statuses `UI-01: Blocked`, `UI-02: Blocked`, `UI-03: Complete`, `ACT-01: Complete` — this matches the checkpoint's own `requirements-completed` narrowing in `19-VALIDATION.md` and in `19-05-SUMMARY.md` (`requirements-completed: [UI-03, ACT-01]`).
- **No orphaned requirements.** No additional ID maps to "Phase 19" in `REQUIREMENTS.md` that is absent from every plan's `requirements` field.
- **No requirement is marked complete in REQUIREMENTS.md that the checkpoint did not actually confirm.** UI-01 and UI-02 are correctly marked `Blocked` (not `[x]`), matching the checkpoint's PARTIAL verdict. UI-03 and ACT-01 are marked `[x]`/`Complete`, and this verification independently re-derived both as genuinely defensible (see question 1 above) rather than merely trusting the checkpoint transcript.

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/dashboard/styles.css` | Radius tokens, control baselines, focus ring, panel rhythm rules | ⚠️ PARTIAL | Source text is correct; one comment (lines 54-57) breaks browser parsing of `--radius-control`, discarding it from the live custom-property set. `--radius-panel` and all other Phase 19 rules parse and ship correctly. |
| `src/dashboard/styles.test.ts` | 5 new Phase 19 `describe` blocks, 341 lines / 40 new+existing tests | ✓ VERIFIED (existence/substance), ⚠️ BLIND SPOT (see Focus Q3) | Exists, substantive, all pass (909/909 in full suite). One assertion (`:root declares both radius tokens`) is structurally unable to detect GAP 1 due to comment-stripping/substring-match interaction. |
| `src/dashboard/views/list.ts` | Unmodified (row-click model preserved by design) | ✓ VERIFIED | Zero diff across the entire Phase 19 commit range (`git diff b932787..HEAD --stat`), confirmed unmodified since Phase 18. |
| `dist/widgets/assets/index-U16xFz57.css` | Shipped bundle reflecting all Phase 19 rules | ⚠️ PARTIAL | Contains the leaked-prose defect verbatim (byte-level confirmed); all other Phase 19 rules (panel rhythm, row-hover, button baseline text, focus ring box-shadow) ship as valid, well-formed CSS. |

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `input, select, textarea` baseline (styles.css:1165) | `--radius-control` token | `var(--radius-control)` | ✗ NOT_WIRED | Token never resolves at runtime; falls back to `border-radius: 0`. |
| `button` baseline (styles.css:1201) | `--radius-control` token | `var(--radius-control)` | ✗ NOT_WIRED | Same root cause. |
| `.segmented__option:first-child` / `:last-child` (styles.css:826, 830) | `--radius-control` token | `var(--radius-control)` | ✗ NOT_WIRED | Same root cause; end-child radii resolve to 0px, invalidating row 12's "no square inner corner" check. |
| Panel selectors (`.error-state`, `.empty-state`, `.calendar-picker`, `.config-notice`) | `--radius-panel` token | `var(--radius-panel)` | ✓ WIRED | Confirmed in shipped bundle; token resolves to `8px`. |
| `:focus-visible` box-shadow ring | Detail-view `.segmented` control | rendered box-shadow | ✗ NOT_WIRED (perceptually) | Ring exists and computes correctly per closed-form contrast math, but is occluded by neighbour paint order (chart below, "Time" option to the right) — a distinct defect from the `overflow:hidden` clip already removed. |
| `list.ts` row-click handler | Phase 19 CSS changes | (no code path — verifying absence of interference) | ✓ CONFIRMED UNCHANGED | No CSS rule found affecting `pointer-events`, click handling, or hit-testing on `.activity-table` rows. |

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/dashboard/styles.css` | 54-57 | Early-terminated CSS comment (`*/` inside prose) | 🛑 BLOCKER | Discards `--radius-control` from the live custom-property set; affects 4 rules across 2 requirements (GAP 1, already recorded). |
| — | — | `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` scan | — | None found in either file modified this phase. |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full automated suite green | `npm test` | 909/909 passed, 46 files | ✓ PASS (re-run independently, not trusted from SUMMARY) |
| TypeScript clean | `npx tsc --noEmit -p tsconfig.json` | exit 0, no output | ✓ PASS |
| Build succeeds, warning reproduces | `npm run build-widgets` | exit 0; emits `▲ [WARNING] Expected ":" [css-syntax-error]` | ✓ PASS (confirms GAP 3's mechanism is still live at HEAD) |
| Publish-shape integration check | `npm run verify-dashboard` | 37/37 checks passed | ✓ PASS |
| `--radius-control` absent from shipped bundle | byte-level grep of `dist/widgets/assets/index-U16xFz57.css` | leaked prose + genuine `*/` confirmed at the exact reported location | ✓ PASS (confirms GAP 1 independently of the developer's browser probe) |
| No second comment-truncation defect exists | full comment-block walk of `styles.css` (54 comments) | only the known comment shows truncation signature | ✓ PASS |
| No dangling `var()` references in shipped bundle | custom-property definition vs. usage diff | empty set | ✓ PASS |
| `list.ts` unmodified this phase | `git diff b932787..HEAD --stat -- . ':(exclude).planning/*'` | only `styles.css` and `styles.test.ts` changed | ✓ PASS |
| Row-hover rule well-formed in bundle | grep of shipped CSS | `.activity-table tbody tr:hover{background:color-mix(...)}` present, valid | ✓ PASS |

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UI-01 | 19-02, 19-04, 19-05 | Form controls styled consistently | ✗ BLOCKED | Dead `--radius-control` token (GAP 1); `REQUIREMENTS.md` correctly records `Blocked`. |
| UI-02 | 19-03, 19-04, 19-05 | Shared button/select treatment + focus ring meeting contrast | ✗ BLOCKED | GAP 1 (radius) + GAP 2 (ring occlusion); `REQUIREMENTS.md` correctly records `Blocked`. |
| UI-03 | 19-01, 19-04, 19-05 | Spacing/density/card rhythm | ✓ SATISFIED | Independently re-verified via `--radius-panel` isolation and shipped-bundle rule inspection (Focus Q1). |
| ACT-01 | 19-02, 19-03, 19-05 | Activities shared styling + preserved row-click model | ✓ SATISFIED | Independently re-verified via git diff of `list.ts` and static CSS check (Focus Q1). |

No orphaned requirements. No requirement ID mismatch between plan frontmatter and `REQUIREMENTS.md`.

## Human Verification Required

None new. The blocking human checkpoint already ran (`19-VALIDATION.md`) and returned PARTIAL with a documented Gap-Closure Record. Per that record's own "Next step," rows 1, 3, 6 and 12 must be re-verified in a real browser **after** GAP 1 and GAP 2 are fixed — that re-verification is correctly scoped to the next execution pass, not to this verification pass.

## Gaps Summary

Two requirement-level gaps block phase goal achievement, both already established in `19-VALIDATION.md` and independently re-confirmed here against the live codebase and build output rather than the SUMMARY narrative:

1. **UI-01 blocked** by the dead `--radius-control` token (GAP 1) — a single early-terminated CSS comment at `src/dashboard/styles.css:54-57` whose body contains a premature `*/`, causing browser CSS error-recovery to silently discard the `--radius-control: 4px` declaration. Reproduced independently via byte-level bundle inspection and a fresh `npm run build-widgets` run (the `css-syntax-error` warning still fires at HEAD).
2. **UI-02 blocked** by the same GAP 1 (affecting button and segmented-control radii) plus GAP 2 — the detail view's segmented-control focus ring is occluded by neighbouring painted elements (the first chart below, the sibling "Time" option to the right), a distinct mechanism from the `overflow: hidden` clip plan 19-04 already removed.

GAP 3 (the misclassified esbuild warning) is not a separate blocking gap in this report — it is the causal explanation for why GAP 1 shipped behind a green gate, and is folded into the UI-01 gap entry's evidence.

**No additional gaps beyond these were found.** Specifically: UI-03 and ACT-01 hold up under independent scrutiny distinct from the compromised checkpoint; no second parse-breaking defect exists anywhere in `styles.css` or the shipped bundle; requirement-ID bookkeeping between the plans and `REQUIREMENTS.md` is exact with no orphans and no premature completions. One informational finding (Additional Finding A / Focus Q3) documents precisely why the `:root declares both radius tokens` test assertion could not have caught GAP 1 — this is a methodology note for whoever plans the gap-closure work, not a new production defect.

---

_Verified: 2026-08-12T18:46:32Z_
_Verifier: Claude (gsd-verifier)_
