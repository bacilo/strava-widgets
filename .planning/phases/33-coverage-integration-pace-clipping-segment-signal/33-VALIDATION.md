---
phase: 33
slug: coverage-integration-pace-clipping-segment-signal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-21
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `33-RESEARCH.md` § Validation Architecture. Task IDs are filled by the planner.

---

## The two rules this contract exists to enforce

**Rule 1 — every `-t` row records its matched test count.** A vitest name filter matching zero
tests **exits 0** and is indistinguishable from a pass. A row reading `-t "unreliable"` with no
matched count is not evidence. Record `(**N matched, N passed**)` on every filtered row, and a
whole-file count alongside it where the filter is the only proof of a behaviour.

**Rule 2 — every guard asserts against an INDEPENDENT value, never internal agreement.** This
project has twice shipped a green gate over broken code because a check asserted that the code
agreed with itself (Phase 23 extent; Phase 32 cross-segment conservation with N=1 fixtures).
`coveredSec + recordingGapSec + pauseSec + unreliableSec === spanSec` is near-tautological once
`classifyGaps` partitions a span — it is NOT the proof of COV-03. The load-bearing assertion is
that `unreliableSec` equals an **independently recounted** segment-seconds total produced by the
detector-free gap-first recount (D-03/D-15), computed without importing the detector.

**Corollary (D-13, reachability in both directions).** Every browser-checkpoint row carries a
stated CAN FAIL / CAN PASS proof before it is run. A row can be defective in *either* direction:
vacuous (passes against a chart that failed to render at all — which is exactly what an
absence-only "the 0:34/km sample is gone" row does) or unpassable (a discriminator no real input
can satisfy). Check both before blaming the code.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (already configured — no Wave 0 install) |
| **Config file** | `vitest.config.ts` — `globals: true`, `environment: 'node'`, `fileParallelism: false`, `include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']` |
| **Quick run command** | `npx vitest run <touched test files> -t "<fragment>"` (the `.test.mjs` files import `../dist/` — run `npm run build` first) |
| **Full suite command** | `npm test` (91 files / 2,848 tests as of 32-17 — will grow) |
| **Estimated runtime** | ~60 s full suite; archive-scanning tests dominate |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <touched test files> -t "<relevant fragment>"`, matched count recorded
- **After every plan wave:** `npm test` + `npx tsc --noEmit` + `npm run build` + `npm run build-widgets`
- **Before `/gsd-verify-work`:** full suite green; the archive-wide identity/recount artifact clean (zero identity violations across all 1,874 streams); every calibration/recount artifact regenerated **twice** and byte-identical (`git diff --exit-code`); human browser checkpoint (D-13 rows) PASS against a **digest-verified** served build
- **Max feedback latency:** ~60 s

**Archive-scan placement (D-03).** The 1,874-stream identity/recount scan is a regenerable
**artifact**, run by hand or CI at phase-close time — never inside `npm test`'s hot path (the
suite is already serialised with `fileParallelism: false`). The `npm test`-time guard is the fast
named-fixture identity check plus the extended `unreliable-segment-recount-crosscheck.test.mjs`.

---

## Per-Task Verification Map

Task IDs are filled by the planner. Every `-t` row MUST record the matched test count when run —
a filter matching 0 tests exits 0 and is indistinguishable from a pass (Rule 1).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | PACE-08 | T-33-01 | `classifyGaps` widened; `unreliable` outranks `recording-gap`/`pause`; the whole merged `[startSec,endSec]` moves out of `recordingGapSec`/`pauseSec` (D-01). Containment uses the detector's own `startIndex`/`endIndex` — never a second boundary convention (32-13/32-17 precedent) | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "unreliable"`, matched count recorded, watched RED first | ❌ new cases in existing file | ⬜ pending |
| TBD | TBD | 1 | PACE-08 | T-33-02 | Chart window clipping and histogram exclusion inherit the behaviour with **zero call-site change** (D-02/D-12). Asserted by fixture, not by source inspection | unit | `npx vitest run src/dashboard/views/detail-charts-logic.test.ts src/dashboard/views/detail-zones.test.ts -t "unreliable"`, matched count recorded | ❌ | ⬜ pending |
| TBD | TBD | 1 | PACE-09 | T-33-03 | `SplitGapAnnotation` widened three-way; `unreliable` wins the marker whenever present (D-09). The two-way else-branch (`else pauseSec += …`) is pinned by a test that FAILS if unreliable time is silently counted as pause | unit | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "splitGapAnnotations"`, matched count recorded | ❌ | ⬜ pending |
| TBD | TBD | 1 | COV-03 | T-33-04 | Caption renders the fourth term always-on **including at 0%** (D-10); the four independently-rounded integers are NOT forced to sum to 100 | unit | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "coverageCaptionText"`, matched count recorded | ❌ | ⬜ pending |
| TBD | TBD | 1 | COV-03 | T-33-05 | `gapFraction`'s numerator includes `unreliableSec` (D-04); `GAP_PROFILE_SEVERE_FRACTION`/`GAP_PROFILE_MINOR_FRACTION` unchanged (D-05, anti-quota) | unit | `npx vitest run src/analytics/pace-quality.test.ts -t "gapProfile"`, matched count recorded | ❌ | ⬜ pending |
| TBD | TBD | 1 | COV-03 | T-33-06 | **Trap 4 (found in research, absent from CONTEXT.md):** `pace-quality-client.ts`'s `VALID_GAP_KINDS` hardcoded `Set(['recording-gap','pause'])` drops every `unreliable` interval at parse time, client-side, independently of any rendering fix. Widened, and the tolerant-entry-drop pattern preserved for malformed entries | unit | `npx vitest run src/dashboard/data/pace-quality-client.test.ts -t "unreliable"`, matched count recorded. Needs a shard fixture carrying an `unreliable`-kind interval or the row is vacuous | ❌ fixture is Wave 0 | ⬜ pending |
| TBD | TBD | 1 | SEG-05b (D-15, this phase's half) | T-33-07 | `pace-derivation.ts` reading the detector is **load-bearing**, proven by stubbing the call and watching the clipping disappear — not by the import existing | unit | `npx vitest run src/analytics/pace-single-source.test.ts -t "pace-derivation"`, matched count recorded | ❌ extend | ⬜ pending |
| TBD | TBD | 2 | COV-03 | T-33-08 | Archive-wide four-way identity, **zero violations across 1,874 streams**, with `unreliableSec` asserted against the detector-free gap-first recount — not against `classifyGaps` (Rule 2). Recount extended to emit the currently-discarded isolated/hidden-pause runs, classified by the same `metres >= HIDDEN_PAUSE_MIN_METRES` rule | script (artifact) | `node scripts/compute-*-recount.mjs` (exit 0, PASS) + generator run twice with `git diff --exit-code` on the artifact | ❌ new script + `.test.mjs` | ⬜ pending |
| TBD | TBD | 2 | COV-03 | T-33-09 | The recount is watched FAILING against a deliberately-broken detector before it may pass (PITFALLS 11 — a recount sharing the classifier's blind spot proves nothing) | script | `npx vitest run scripts/*-recount-crosscheck.test.mjs`, matched count recorded | ❌ extend | ⬜ pending |
| TBD | TBD | 2 | COV-03 | T-33-10 | The artifact reports how much time moved out of `recording-gap`/`pause` per mechanism, and the D-05 per-tier migration **including if it is zero** | script | generator output inspected; figure reconciled against 32-CALIBRATION.md's 11,574 s gap-adjacent total | ❌ | ⬜ pending |
| TBD | TBD | 2 | SEG-06 | T-33-11 | D-07's excess-metres tier constant derived with its own non-circularity argument, matching 32-CALIBRATION.md § "Non-circularity (D-13)"'s shape; insensitivity checked (re-derive with detected segments removed, and with planted synthetics added). Watched failing first on a **deliberately circular strawman** (a raw tail percentile of the excess-fraction population itself). Reuses `quantile` (`pace-derivation.ts:100`) — no third percentile definition | script | `npx vitest run scripts/compute-*-severity-calibration.test.mjs`, matched count recorded; generator run twice, byte-identical | ❌ new script + `.test.mjs` | ⬜ pending |
| TBD | TBD | 3 | SEG-06 | T-33-12 | Signal tiered `none`/`minor`/`severe`; `hasAnySevereSignal`'s `Pick<>` **NEVER** widened (D-06), pinned by a never-widen guard demonstrated red (temporarily widen, watch the guard fail, revert, `git diff` empty after revert) | unit | `npx vitest run src/analytics/pace-quality.test.ts -t "unreliableSegments"`, matched count recorded | ❌ | ⬜ pending |
| TBD | TBD | 3 | SEG-06 | T-33-13 | Index row additions are additive; `DASHBOARD_INDEX_SCHEMA_VERSION` stays `1`. Shard segment list capped at 100 like `impossibleSamples`, carries no `parts` | unit | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "unreliable"`, matched count recorded | ❌ | ⬜ pending |
| TBD | TBD | 3 | SEG-06 | T-33-14 | Only `severe` badges a list row; `none`/`minor`/`not-computable` stay silent there | unit | `npx vitest run src/dashboard/views/list.test.ts -t "unreliableSegments"`, matched count recorded | ❌ | ⬜ pending |
| TBD | TBD | 3 | COV-03 | T-33-15 | `gapProfileRow`'s evidence line reads `shard.gapIntervals`, which now contains unreliable intervals — whether it itemises by kind is **decided and pinned**, not left to silently change (research recommends itemise) | unit | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "gapProfileRow"`, matched count recorded | ❌ | ⬜ pending |
| TBD | TBD | 3 | COV-03 | T-33-16 | D-11 copy widening: badge `visibleText`, the `Coverage gaps` detail label and the healthy text all name what the number now counts (correctness fix, not cosmetic) | unit | `npx vitest run src/dashboard/views/list.test.ts src/dashboard/views/detail-sections.test.ts -t "gaps, pauses or unreliable"`, matched count recorded | ❌ | ⬜ pending |

---

## Wave 0 Requirements

- [ ] A fixture `PaceQualityShard`-shaped object carrying **at least one `unreliable`-kind `gapInterval`**, for `pace-quality-client.test.ts` — without it T-33-06 is vacuous and Trap 4 ships silently.
- [ ] `scripts/compute-*-recount.mjs` extension (archive-wide, detector-free) + its own `.test.mjs` import-time no-side-effect guard. **Note (fs spy limitation):** `vi.spyOn(fs,'readFileSync')` cannot observe `import { readFileSync }` named imports — Phase 32 GAP 2 shipped two structurally vacuous guards on exactly that shape. Use a control probe that genuinely reads a file at import time and confirm it IS observed, or the guard passes forever.
- [ ] `scripts/compute-*-severity-calibration.mjs` (D-07's constant) + its own `.test.mjs`. Wave 3's SEG-06 tier cannot ship before this lands.
- [ ] Framework install: **none** — vitest already configured.

---

## Manual-Only Verifications

Human browser checkpoint against a **digest-verified served build**. Criteria 1, 2 and 4 are all
rendered claims. Every row states CAN FAIL / CAN PASS before it is run (D-13).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Post-clip **fastest** pace on the pace chart for 3475724402 and 3475734189 matches a value derived from raw `t`/`d` **outside the changed code** | PACE-08 | Rendered claim; the assertion must be an independently-derived extent, not an absence (Rule 2 — an absence-only row passes equally against a chart that failed to render) | Read back the fastest hovered tooltip; compare against the pre-computed expected value. CAN FAIL: a wrong/unclipped value differs. CAN PASS: the expected value is reachable and was computed from raw streams. |
| 3475740390 shows no 1:10–1:40/km sample, and its own post-clip fastest matches the independently-derived value | PACE-08 | as above | as above |
| A **control activity** with no detected segments renders its full range unchanged | PACE-08 | Distinguishes "clipped correctly" from "chart broken" — the direction an absence-only row cannot see | Name and pin a clean activity. CAN FAIL: a regression clips it. CAN PASS: today's build already renders it. |
| The per-km split covering 3475740390's t=2508 jump (**km split 8**, d=7305 m — verified against `data/streams/` in research) carries the unreliable marker | PACE-09 | Rendered claim | Confirm the marker is on split 8 specifically, consistent with the existing gap-crossing marker. CAN FAIL: marker absent or on the wrong split. |
| The always-on coverage caption discloses unreliable time as its own term on all three named activities **and on the 0% control** | COV-03 | Rendered claim; the 0% case is what proves "always-on" rather than "rendered when non-zero" | Read the caption verbatim. CAN FAIL: term missing on the control. |
| Each of the three named activities' detail view discloses the unreliable-segment signal badged with its **measured value** (count, total metres, total seconds, mechanisms) | SEG-06 | Rendered claim | Compare the badge's numbers against the artifact's per-activity row. CAN FAIL: a placeholder or mismatched figure. |

**Standing checkpoint conventions (learned the hard way on this project):**
- **Hard-reload after every fixture edit.** A stale `index.html`/`index.json` in a staged build has produced false evidence here before; serving from `127.0.0.1` alone is NOT enough.
- Verify the **served digest**, not the build log — `build-widgets` silently no-ops on any locally-edited `dist/` file (mtime skip).
- Viewport clamps to 500..941; gestures need a human.

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify or a stated Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the shard fixture above is blocking)
- [ ] No watch-mode flags
- [ ] Every `-t` row records a **non-zero matched count** (Rule 1)
- [ ] Every guard asserts against an independently-derived value (Rule 2); the four-way identity alone does NOT discharge COV-03
- [ ] Every browser-checkpoint row carries a stated CAN FAIL / CAN PASS proof in **both** directions
- [ ] Artifacts regenerated twice, byte-identical — hand-edits to generated prose revert on regeneration
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
