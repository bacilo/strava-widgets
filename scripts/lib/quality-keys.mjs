/**
 * Shared quality-key lists for the publish gate (scripts/verify-dashboard-publish.mjs)
 * and its drift test (scripts/verify-dashboard-publish-quality-keys.test.mjs).
 *
 * Why shared: the gate is Node-built-ins-only, cannot import TypeScript, and
 * runs main() at import, so the drift test cannot import the gate itself. This
 * module is the single owner of both lists. It has NO top-level side effects:
 * constant declarations only.
 *
 * Notes:
 * - `pauseIntervals` is a shard top-level key only and must never be in
 *   QUALITY_SUB_KEYS.
 * - Shard top-level `unreliableSegments` is an ARRAY while
 *   `signals.unreliableSegments` is the signal OBJECT, so they live in
 *   separate lists.
 * - No exempt list exists anywhere (audit assumption A4): the gate checks every
 *   key the emitter writes, and the drift test enforces that in both directions.
 */

/** Every key of the emitter's ActivityQualitySignals (row `quality` and shard `signals`). */
export const QUALITY_SUB_KEYS = Object.freeze([
  'decimation',
  'gapProfile',
  'impossibleSamples',
  'deviceEra',
  'elapsedVsMoving',
  'elevation',
]);

/** Every top-level key of the emitter's PaceQualityShard. */
export const PACE_QUALITY_SHARD_KEYS = Object.freeze(['activityId', 'signals']);
