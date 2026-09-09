# Deferred Items — Phase 26 Plan 01

## Pre-existing environment failures (out of scope, not caused by this plan)

Observed via `npm run test` after Task 2: 7 test files fail in this fresh worktree checkout,
none of them touching `src/analytics/pace-derivation.ts` or `pace-derivation.test.ts`:

- `scripts/verify-dashboard-publish-stats.test.mjs`
- `src/dashboard/views/records-logic.test.ts`
- `src/dashboard/views/trends-cadence-hr-logic.test.ts`
- `src/dashboard/views/trends-gear-logic.test.ts`
- `src/dashboard/views/trends-training-load-logic.test.ts`
- `src/dashboard/views/trends-yoy-logic.test.ts`

All six above fail with `ENOENT` reading `data/stats/*.json` — a gitignored, derived-output
directory that is absent until the compute pipeline runs; not present in this fresh worktree.

- `src/dashboard/views/trends-zoom-logic.test.ts` fails with `ENOENT` reading
  `node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js` — an npm-install artifact
  gap in this worktree, unrelated to any code change in this plan.

Not fixed (out of scope, Rule 1-3 boundary): pre-existing conditions in unrelated files, not
caused by Task 1 or Task 2's changes. `npx tsc --noEmit` is clean and
`npx vitest run src/analytics/pace-derivation.test.ts` passes 10/10.

---

# Deferred Items — Phase 26 Plan 10 (Round 1 browser checkpoint, 2026-09-09)

## F-26-02 — thin outlier buckets at both tails of the pace histogram

Raised by the developer during the Round 1 browser checkpoint on activity `4556693525`, explicitly
flagged **"not a priority"**. The Pace Distribution carries many 0.0-0.1 min buckets at both
extremes:

- Fast tail: `1:30-1:45/km` (0.2 min) through `3:00-3:15/km` (0.2 min)
- Slow tail: `8:15-8:30/km` (0.2 min) through `18:30-18:45/km` (0.1 min)

That activity is 99% covered (R1's hand-derived figure), so these are **genuine measured samples**,
not gap artefacts. Eliminating or hiding them is therefore a display decision, not a correctness
fix, and it trades against COV-02's "coverage is visible to the reader" principle — a histogram
that silently drops its tails is exactly the class of quiet omission this phase set out to end.

Candidate approaches, none evaluated: trim to a percentile band with the trim disclosed; merge
tail buckets into labelled `< x` / `> y` bins; leave as-is. Any of these needs its own scope and
an honesty note; not attempted here.

Not fixed (out of scope): raised during a blocking human-verify checkpoint, where the plan's own
rule is to log rather than patch. No row failed on account of it.
