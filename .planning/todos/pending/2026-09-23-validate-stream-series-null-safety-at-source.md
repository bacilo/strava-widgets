---
created: 2026-09-23T12:05:00.000Z
title: validateStreamSeries reads t.length unconditionally — nine call sites still carry the null gap
area: analytics
files:
  - src/analytics/best-effort-utils.ts
  - src/analytics/pace-derivation.ts
  - src/analytics/pace-quality.ts
---

## Problem

Phase 34 code review finding IN-04 (`34-REVIEW.md`, 2026-09-23).

`classifyPairKinds` (`pace-derivation.ts:332`) now checks `t == null || d == null` before calling
`validateStreamSeries`, and the comment at `:305-310` describes this as closing "the one gap
T-26-01's 'never throws' guarantee had". But `validateStreamSeries` reads `t.length`
unconditionally (`best-effort-utils.ts:73`), so the same gap remains at the other nine call sites:
`pace-derivation.ts:784`, `:937`, and `pace-quality.ts:1013`, `:1342`, `:1433`, `:1576`, `:1816`,
`:2151`.

Plan 34-16 narrowed the overreaching comment to its own call site. The real fix is one function:
make `validateStreamSeries` itself null-safe, returning its ordinary `{ ok: false }` shape, which
closes all ten sites at once and removes the need for a two-token guard at each.

## Why deferred

`validateStreamSeries` is a shared pre-Phase-32 utility used well outside Phase 34's surface.
Changing its behaviour for null input deserves its own change with its own tests and a check of
every caller's expectations, rather than riding along in a gap-closure plan that was already
carrying two Critical fixes.

No Phase 34 entry point reaches those sites with null — the new classifier functions guard their own
inputs — so this is hardening, not a live defect.

## Acceptance

- `validateStreamSeries(null, null)` returns `{ ok: false }` with a stated reason rather than
  throwing, proven by a test
- Every call site's behaviour on null input is asserted, or the site's own guard is removed as
  redundant with a comment saying why
- The narrowed comment in `pace-derivation.ts` is restored to the general claim once true
