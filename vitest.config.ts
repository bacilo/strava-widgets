import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Phase 24 (local curation mode): script-level guards under scripts/ must
    // be testable too (D-11's planted-fixture proof needs a collected test file).
    // Phase 24 wave 7 post-merge: curation-guard.test.mjs's whole-tree case
    // READS the real dist/widgets tree while verify-dashboard-publish-guard
    // .test.mjs PLANTS and removes dist/widgets/__curate inside that same real
    // tree (deliberately — see its header comment). Under file parallelism the
    // windows overlap and the reader intermittently sees the planted fixture.
    // Serializing files is the cheap fix: ~1.2s → ~6.6s for the whole suite.
    fileParallelism: false,
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
});
