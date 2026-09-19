---
phase: 26-shared-gap-aware-pace-derivation-honest-coverage
plan: 10
status: complete
completed: 2026-09-09
requirements-completed: [COV-02, PACE-05, PACE-07]
---

# Plan 26-10 Summary — Human Browser Checkpoint (Round 1)

Closed Phase 26 on a human browser checkpoint against a production-shaped build. Five rows PASS,
one justified NOT EXERCISABLE, zero FAIL, zero BLOCKED.

## What happened

**Task 1** was prepared and committed ahead of this session (`5743bbfd`). Because the served build
had since gone down, the full phase gate was **re-run from scratch** on 2026-09-09 at HEAD
`5743bbfd` before any human was asked to look:

| Command | Result |
|---------|--------|
| `npm run test` | 0 — 1883 passed / 69 files, 12.03s |
| `npx tsc --noEmit` | 0 |
| `npm run build` | 0 |
| `npm run compute-dashboard-index` | 0 — Pace disagreements flagged: 1 |
| `npm run build-widgets` | 0 — dashboard SPA + 11 widgets |
| `npm run verify-dashboard` | 0 — 56 checks, 0 failures |

The curate server was restarted at `http://127.0.0.1:4173/strava-widgets/` (HTTP 200).

**Staged-build guard (T-26-18)** re-executed against the *served* URL, not the repo file:
`5059204779` carries `paceDisagreement {stream 350.6, metadata 112.6, ratio 3.11}`, pace-sorted
rank **1 of 1889**, `prCount 0`, date-descending position **1091 of 1890** — every value matching
Round 1's pre-stated expectations, confirming no stale staged artifact.

**Row 1's independent hand derivation was re-run fresh** by a throwaway script that does not
import `src/analytics/pace-derivation.ts`: n=1682, span 3394s, covered 3363 / gap 31 / pause 0,
sum identity exact → 99% / 1% / 0%. Reproduced Round 1's prep exactly.

**Task 2** was conducted by the developer in the browser. Every quotation in the verdict table was
supplied by them; none was inferred from an automated check.

## Verdicts

| Row | Requirement | Verdict |
|-----|-------------|---------|
| R1 | D-08/COV-02 | PASS — caption read in browser, reconciled to the hand sum with zero divergence |
| R2 | D-09/PACE-05 | PASS — marker `18:38/km ⚠` + legend `Km 11: includes 11:29 of recording gap`, pace unchanged |
| R3 | D-11/PACE-07 | PASS — badge `Pace disputed — stream-derived 5:51/km`, big value unchanged |
| R4 | D-11/PACE-07/D-12 | PASS — position 1 stated, badge visible, not suppressed |
| R5 | D-11/PACE-07 | NOT EXERCISABLE — structurally excluded from both Overview cards |
| R6 | D-13/PACE-07 | PASS — rebase disclosure caption verbatim |

Criterion 3 is satisfied: the coverage percentage was read in the browser at the moment of
observation and equals a value summed independently from the committed stream file.

## Deviations

**R5 was confirmed structurally rather than by eye.** The orchestrator's browser extension was not
connected, so Overview's two cards were confirmed by reproducing `overview.ts`'s own selection
logic (`rows.filter(r => r.prCount > 0).slice(0,5)` and `rows.slice(0,10)`) against the served
index. R5 carries no read-in-the-browser clause — unlike R1, which the developer did read
directly — so this substitution does not weaken the row. Recorded with its confirmation, never as
a silent skip.

## Findings logged, not patched

Per the plan's rule and this project's 16-09 / 17-15 / 19-05 precedents, both items were logged
rather than fixed under checkpoint pressure.

**F-26-01 — `Moving Time` shows the same corrupted metadata that `Pace disputed` discloses, with
no disclosure of its own.** Raised by the developer mid-session: the splits' elapsed ends at
1:03:08 (3788s, stream-derived) while the `Moving Time` tile reads 20:16 (1216s, metadata
`moving_time`). `3788 / 1216 = 3.115` — exactly the reported `ratio: 3.11`. `moving_time` is the
root corrupted quantity; pace is only its derived symptom. `detail.ts:634` renders that tile
unqualified, immediately beside the Pace tile that does carry a badge. PACE-07's own requirement
text names `moving_time: 1216` as the defect's origin, so whether closing this falls inside
PACE-07 or opens a successor requirement is a scoping decision deliberately left to the next
phase. Evidence it is reader-facing and not theoretical: it confused the developer during the
checkpoint, on the very activity the phase built its disclosure around.

**F-26-02 — thin outlier buckets at both histogram tails** (developer-flagged "not a priority").
Deferred to `deferred-items.md`; these are genuine samples on a 99%-covered activity, so hiding
them is a display decision that trades against COV-02, not a correctness fix.

## Requirement ticks

COV-02, PACE-05 and PACE-07 were ticked **only after** the verdicts were recorded, per the v2.1
retrospective's process fix. PACE-07 had already been ticked by plan 26-08 ahead of this
checkpoint — noted as a deviation from that same rule, not introduced here.

Every row mapped to these three requirements is PASS or a justified NOT EXERCISABLE, so no
requirement is left open by this round. F-26-01 is recorded as a scope question for the next
phase, not as an unmet criterion of a row.

## Key files

- `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-VALIDATION.md` — Round 1 verdict table, per-row evidence, findings F-26-01/F-26-02, sign-off
- `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/deferred-items.md` — F-26-02
- `.planning/REQUIREMENTS.md` — PACE-05 and COV-02 ticked

## Verification

- `git status --porcelain data/streams` → no output; the stream archive is byte-identical at phase close.
- Six verdicts with verbatim quotations recorded in `26-VALIDATION.md`.
- No code patch applied during the checkpoint session.
