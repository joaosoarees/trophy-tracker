import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@app': resolve('src/renderer/src/app'),
      '@ui': resolve('src/renderer/src/ui'),
      // Only tests use these two: they live away from the code they test.
      '@main': resolve('src/main'),
      '@test': resolve('test'),
    },
  },
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
