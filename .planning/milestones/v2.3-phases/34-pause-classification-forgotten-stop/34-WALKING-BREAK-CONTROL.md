# Walking-Break Control (Phase 34 plan 02, D-12)

Developer confirmation of research's three proposed walking-break candidates
(`34-WALKING-BREAK-EVIDENCE.md`), recorded verbatim per D-12. This is the source of truth for the
negative control that plans 34-06 onward pin — no candidate is a control until it appears here as
a `CONFIRMED_CONTROL` line.

## Developer confirmation (verbatim)

The developer was shown the Candidates table and the Reachability table from
`34-WALKING-BREAK-EVIDENCE.md`, including each candidate's activity date (6286234101:
2021-11-21, 3475733231: 2018-06-20, 3475715143: 2019-09-20), and asked per candidate: "Was this
window a walking break inside a run — walking, not standing, not a slow jog, not a vehicle?"

Verbatim reply:

> 1. yes walking uphill, impossible to run. as long as there is gps data you don't need to
> eliminate these points. if i turned off the watch then please don't count them. 2.walking,
> probably tired. 3. yeah lots of walking because it was a thick forest and parts were hard to
> run. if there is data (i.e. didn't turn off watch), you can keep it.

Developer's policy note, recorded verbatim as provenance and not reinterpreted into a new
requirement: walking recorded with GPS data should be kept / not eliminated; time when the watch
was turned off should not be counted.

## Confirmed controls

Per-candidate mapping of the developer's numbered replies to the research candidates, in the
order presented (1 = 6286234101, 2 = 3475733231, 3 = 3475715143):

- **1. 6286234101 (t=5289-5696, 2021-11-21)** — YES. "yes walking uphill, impossible to run. as
  long as there is gps data you don't need to eliminate these points. if i turned off the watch
  then please don't count them."
- **2. 3475733231 (t=1827-2229, 2018-06-20)** — YES. "walking, probably tired."
- **3. 3475715143 (t=1590-1992, 2019-09-20)** — YES. "yeah lots of walking because it was a thick
  forest and parts were hard to run. if there is data (i.e. didn't turn off watch), you can keep
  it."

CONFIRMED_CONTROL: 6286234101 t=5289-5696
CONFIRMED_CONTROL: 3475733231 t=1827-2229
CONFIRMED_CONTROL: 3475715143 t=1590-1992

## Not confirmed

None — all three research candidates were confirmed by the developer.
