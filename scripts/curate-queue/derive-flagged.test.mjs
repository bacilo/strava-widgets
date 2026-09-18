/**
 * Behavioral unit tests for scripts/curate-queue/derive-flagged.mjs (Phase 29 plan 04). Follows
 * scripts/compute-pr-ceiling-recount.test.mjs's practice of asserting against small, hand-built
 * fixture documents, plus a live-archive cross-check (Task 3) against
 * scripts/compute-pr-ceiling-recount.mjs's independently-derived recount — never a hardcoded
 * count, since the archive grows nightly via CI sync.
 *
 * Canary-first discipline (this project has twice shipped a guard that stayed green while
 * proving nothing): Task 1 proves this file is actually collected by vitest before any real
 * assertion is written.
 */

import { describe, expect, it } from 'vitest';

import { buildPrefillReason, deriveFlaggedActivities, summarizeQueue } from './derive-flagged.mjs';

describe('collection canary', () => {
  it('the three exports are functions', () => {
    expect(typeof deriveFlaggedActivities).toBe('function');
    expect(typeof buildPrefillReason).toBe('function');
    expect(typeof summarizeQueue).toBe('function');
  });
});
