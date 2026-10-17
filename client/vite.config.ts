import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    rollupOptions: {
      // Two pages: the game, and the dev-only Bill preview.
      input: {
        main: resolve(__dirname, 'index.html'),
        character: resolve(__dirname, 'character-preview.html'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
