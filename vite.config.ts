import { defineConfig } from 'vite';

// Dev serves index.html plus every sandbox/*.html page; the production build ships the game only.
export default defineConfig({
  base: './',
  // Many agents edit while others test: no HMR pushes (pages only change on reload) and no
  // dependency re-optimisation mid-run (three is plain ESM and loads fine unbundled).
  server: { host: '127.0.0.1', port: 5300, strictPort: true, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  preview: { host: '127.0.0.1', port: 5310, strictPort: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
    rollupOptions: { input: { main: 'index.html' } },
  },
});
