import { defineConfig } from 'vite';

export default defineConfig({
  // relative URLs: itch.io (and any static host) serves the build from a sub-path such as /html/123456/
  base: './',
  publicDir: 'public',
  server: { host: '127.0.0.1' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    // bundled code goes to app/, the game's runtime files stay in assets/ (public/assets)
    assetsDir: 'app',
    // three.js in its own long-cacheable chunk; game code changes don't invalidate it
    rollupOptions: { output: { manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined) } },
  },
});
