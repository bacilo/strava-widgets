# Garmin export fixture

Derived from 36.1-GARMIN-PROBE.md sections 2-5 and 10 (`.planning/phases/36.1-ingestion-integrity/`).
Layout: `DI_CONNECT/DI-Connect-Fitness/<prefix>_N_summarizedActivities.json`, wrapped as `[{"summarizedActivitiesExport":[...]}]`.
Distance is in centimetres, duration in milliseconds, `startTimeGmt` in epoch milliseconds.

Values are synthetic, except the two named-row epochs: 1794983400000 (2026-11-18T06:30:00Z, the missing row) and 1795014403000 (2026-11-18T15:06:43Z, the both-present row), which mirror the probed rows. The near row is 60 s after the planted archive epoch 2026-03-01T07:00:00Z. There is deliberately no row on 2026-04-20 (L-01a).

Regenerate it if a future export changes the layout.
