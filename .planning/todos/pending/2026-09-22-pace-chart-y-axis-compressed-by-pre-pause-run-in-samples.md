---
created: 2026-09-22T07:59:19.000Z
title: Pace chart y-axis compressed by pre-pause run-in samples (3475734189, 68-93 min/km at t=208-219)
area: dashboard
files:
  - src/dashboard/views/detail-charts-logic.ts
  - src/analytics/pace-derivation.ts
---

## Problem

Surfaced during the phase 33 human browser checkpoint (plan 33-13 Task 1/2,
`33-VALIDATION.md` row R2). The developer, asked to hover activity
`3475734189`'s pace chart for its fastest point, reported: "it's hard to
find the lowest point. I can find a 3:52 but because there's such a spike
at around 0.571 where the pace goes up to more than 80, the rest of the
chart gets compressed and hard to identify variation." (verbatim, quoted
in full in `33-VALIDATION.md`'s "Developer verdicts" section).

Traced: this is the run-in to the 16-second `pause` interval at
t=219-235 s (~0.57 km). Windowed pace over samples t=208-219 climbs to
4082-5556 s/km (68-92.6 min/km) as the runner comes to a standstill.
Those samples sit *before* the pause interval starts, so PACE-08's
clipping (which clips inside `unreliable`/gap/pause intervals themselves,
not the deceleration leading into one) correctly leaves them unclipped —
this is not a PACE-08 regression, and R2 passed on its stated
discriminator (true minimum 231.21 s/km = 3:51.2/km at t=453, confirmed;
the developer's 3:52 reading was the adjacent sample one position off,
within ordinary tooltip granularity; zero 0:30-0:40/km samples exist).

But a 68-93 min/km spike compresses the chart's y-axis scale so heavily
that the rest of the activity's real pace variation (roughly 3:51-5:xx/km)
is squashed into a sliver of vertical space, making the chart hard to read
by eye — exactly what the developer described. This is a chart-readability
gap, not covered by any v2.3 requirement (no requirement mandates y-axis
scaling/clamping behaviour), and was deliberately left unfixed under
checkpoint pressure per this project's "record and leave unpatched"
convention (extended here to a non-failing-but-noteworthy readability
finding, not just outright failures).

## Solution

Not yet designed. Candidate directions to evaluate, none pre-committed:
- Clamp/cap the pace chart's y-axis domain to a percentile-based ceiling
  (e.g. p99 of in-range windowed pace) rather than the raw max, with an
  explicit "off-scale" indicator for points beyond the cap.
- Detect and visually flag (rather than fully plot) samples inside a
  pre-pause/pre-gap deceleration run-in, since they are legitimate data
  but predictably extreme.
- Log-scale or dual-scale rendering for the pace channel.

Whatever direction is chosen, it must not change what PACE-08 clips
(gap/pause/unreliable intervals only) — this is purely a rendering/scale
concern for samples PACE-08 correctly leaves unclipped. Probe the real
committed stream for `3475734189` (and any other activities with a
similar pre-pause run-in shape) before committing to an approach, per
this project's repeated "probe real data before coding" lesson.
