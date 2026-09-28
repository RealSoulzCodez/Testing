import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built site works from any path (a sub-folder, GitHub Pages, a static host).
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // keep images as files so they cache and lazy-load
    chunkSizeWarningLimit: 800, // three.js is large by nature
  },
});
