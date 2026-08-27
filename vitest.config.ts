import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Phase 24 (local curation mode): script-level guards under scripts/ must
    // be testable too (D-11's planted-fixture proof needs a collected test file).
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
});
