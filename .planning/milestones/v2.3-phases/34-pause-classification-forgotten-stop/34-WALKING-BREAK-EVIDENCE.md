# Walking-Break Evidence (Phase 34 plan 02, D-12)

Research-proposed walking-break candidates (34-RESEARCH.md § D-12), with evidence computed on each candidate's own committed stream by a zero-import evidence generator (its own source never imports the unreliable segments detector, pace derivation, or pause classification modules). These are PROPOSALS ONLY — the developer confirms at least one via `34-WALKING-BREAK-CONTROL.md` before any plan pins it as a fixture. Research's own figures are quoted below as references to reconcile against, never as expected values.

## Candidates

| Candidate | Window (t) | Duration (s) | Metres | Aggregate (m/s) | Rest-of-activity (m/s) | HR range | Internal gaps | Longest zero-advance run (s) |
|---|---|---|---|---|---|---|---|---|
| 6286234101 | t=5289-5696 | 407 | 514.5 | 1.264 | 2.826 | 141-166 | 0 | 0 |
| 3475733231 | t=1827-2229 | 402 | 608.0 | 1.512 | 2.550 | 110-157 | 0 | 0 |
| 3475715143 | t=1590-1992 | 402 | 722.4 | 1.797 | 2.489 | 135-177 | 0 | 0 |

## Reachability (CAN FAIL / CAN PASS)

| Candidate | minSec | minWindowSpeed (m/s) | Verdict |
|---|---|---|---|
| 6286234101 | 10 | 0.823 | CAN FAIL: flagged at any near-zero threshold >= 0.823 m/s. CAN PASS: not flagged at any threshold < 0.823 m/s. |
| 6286234101 | 20 | 0.885 | CAN FAIL: flagged at any near-zero threshold >= 0.885 m/s. CAN PASS: not flagged at any threshold < 0.885 m/s. |
| 6286234101 | 30 | 0.967 | CAN FAIL: flagged at any near-zero threshold >= 0.967 m/s. CAN PASS: not flagged at any threshold < 0.967 m/s. |
| 6286234101 | 60 | 1.044 | CAN FAIL: flagged at any near-zero threshold >= 1.044 m/s. CAN PASS: not flagged at any threshold < 1.044 m/s. |
| 6286234101 | 120 | 1.069 | CAN FAIL: flagged at any near-zero threshold >= 1.069 m/s. CAN PASS: not flagged at any threshold < 1.069 m/s. |
| 6286234101 | 300 | 1.134 | CAN FAIL: flagged at any near-zero threshold >= 1.134 m/s. CAN PASS: not flagged at any threshold < 1.134 m/s. |
| 3475733231 | 10 | 1.290 | CAN FAIL: flagged at any near-zero threshold >= 1.290 m/s. CAN PASS: not flagged at any threshold < 1.290 m/s. |
| 3475733231 | 20 | 1.340 | CAN FAIL: flagged at any near-zero threshold >= 1.340 m/s. CAN PASS: not flagged at any threshold < 1.340 m/s. |
| 3475733231 | 30 | 1.387 | CAN FAIL: flagged at any near-zero threshold >= 1.387 m/s. CAN PASS: not flagged at any threshold < 1.387 m/s. |
| 3475733231 | 60 | 1.415 | CAN FAIL: flagged at any near-zero threshold >= 1.415 m/s. CAN PASS: not flagged at any threshold < 1.415 m/s. |
| 3475733231 | 120 | 1.482 | CAN FAIL: flagged at any near-zero threshold >= 1.482 m/s. CAN PASS: not flagged at any threshold < 1.482 m/s. |
| 3475733231 | 300 | 1.507 | CAN FAIL: flagged at any near-zero threshold >= 1.507 m/s. CAN PASS: not flagged at any threshold < 1.507 m/s. |
| 3475715143 | 10 | 0.090 | CAN FAIL: flagged at any near-zero threshold >= 0.090 m/s. CAN PASS: not flagged at any threshold < 0.090 m/s. |
| 3475715143 | 20 | 0.240 | CAN FAIL: flagged at any near-zero threshold >= 0.240 m/s. CAN PASS: not flagged at any threshold < 0.240 m/s. |
| 3475715143 | 30 | 0.473 | CAN FAIL: flagged at any near-zero threshold >= 0.473 m/s. CAN PASS: not flagged at any threshold < 0.473 m/s. |
| 3475715143 | 60 | 0.650 | CAN FAIL: flagged at any near-zero threshold >= 0.650 m/s. CAN PASS: not flagged at any threshold < 0.650 m/s. |
| 3475715143 | 120 | 1.007 | CAN FAIL: flagged at any near-zero threshold >= 1.007 m/s. CAN PASS: not flagged at any threshold < 1.007 m/s. |
| 3475715143 | 300 | 1.738 | CAN FAIL: flagged at any near-zero threshold >= 1.738 m/s. CAN PASS: not flagged at any threshold < 1.738 m/s. |

## Research reconciliation

| Candidate | Research speed (m/s, reference only) | Measured aggregate speed (m/s) | Difference |
|---|---|---|---|
| 6286234101 | 1.264 | 1.264 | 0.000 |
| 3475733231 | 1.512 | 1.512 | 0.000 |
| 3475715143 | 1.797 | 1.797 | 0.000 |

## Inputs

Streams read: data/streams/6286234101.json, data/streams/3475733231.json, data/streams/3475715143.json

Regenerate with: `npm run compute-walking-break-evidence`
