import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/widget/index.ts'),
      name: 'WeeklyBarChart',
      fileName: 'weekly-bar-chart',
      formats: ['iife']
    },
    outDir: 'dist/widget',
    emptyDir: true,
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true,
        globals: {}
      }
    },
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false // Keep console.error for widget debugging
      }
    }
  }
});
