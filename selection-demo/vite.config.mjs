import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/selection/',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
  build: {
    outDir: fileURLToPath(new URL('../selection', import.meta.url)),
    emptyOutDir: true,
    rolldownOptions: {
      output: { manualChunks(id) { if (/node_modules[\\/](recharts|d3-|victory)/.test(id)) return 'charts'; } },
      onwarn(warning, warn) {
        // This export is entirely client-side; React package directives need no server boundary.
        if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning);
      },
    },
  },
});
