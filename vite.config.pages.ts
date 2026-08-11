import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/pages',
  build: {
    outDir: '../../dist/widgets',
    emptyOutDir: false,  // CRITICAL: emptyOutDir is the real Vite option name — by the
    // time this build runs, dist/widgets/ already holds 11 IIFE bundles, four page
    // HTML files and the copied data tree; emptying it would destroy all of them.
    rollupOptions: {
      input: {
        heatmap: resolve(__dirname, 'src/pages/heatmap.html'),
        pinmap: resolve(__dirname, 'src/pages/pinmap.html'),
        routes: resolve(__dirname, 'src/pages/routes.html'),
        widgets: resolve(__dirname, 'src/pages/widgets.html'),
      },
    },
    target: 'es2020',
    minify: 'terser',
  },
});
