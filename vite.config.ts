import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  server: { host: '127.0.0.1' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    // three.js in its own long-cacheable chunk; game code changes don't invalidate it
    rollupOptions: { output: { manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined) } },
  },
});
