import { defineConfig } from 'vite';

// base './' lets the same build run at a domain root, a GitHub Pages sub-path, or from a folder.
export default defineConfig({
  base: './',
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 600 },
  test: { environment: 'jsdom', include: ['tests/**/*.test.js'], globals: true },
});
