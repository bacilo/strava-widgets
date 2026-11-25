import { defineConfig } from 'vitest/config';

import base from './vitest.config';

// Reported (non-blocking in CI) suite: only archive-pinned files.
// passWithNoTests is deliberately NOT set: matching 0 files must exit non-zero.
export default defineConfig({
  test: {
    ...base.test,
    include: ['src/**/*.archive.test.ts', 'scripts/**/*.archive.test.mjs'],
  },
});
