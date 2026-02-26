import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        content: resolve(__dirname, 'src/content/index.ts')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts']
  }
});
