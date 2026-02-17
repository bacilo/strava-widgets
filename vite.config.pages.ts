import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/pages',
  build: {
    outDir: '../../dist/widgets',
    emptyDir: false,  // CRITICAL: Do not delete widget bundles
    rollupOptions: {
      input: {
        heatmap: resolve(__dirname, 'src/pages/heatmap.html'),
        pinmap: resolve(__dirname, 'src/pages/pinmap.html'),
        routes: resolve(__dirname, 'src/pages/routes.html'),
      },
    },
    target: 'es2020',
    minify: 'terser',
  },
});
