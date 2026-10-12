import { defineConfig } from 'vite';

export default defineConfig({
  // three.js alone is ~500 kB, so raise the warning threshold.
  build: { chunkSizeWarningLimit: 1000 },
});
