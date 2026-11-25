import { configDefaults, defineConfig } from 'vitest/config';

import base from './vitest.config';

// Blocking suite: the base config minus archive-pinned files (*.archive.test.*).
// Setting `exclude` replaces vitest's defaults, so configDefaults.exclude is re-spread.
export default defineConfig({
  test: {
    ...base.test,
    exclude: [...configDefaults.exclude, '**/*.archive.test.*'],
  },
});
