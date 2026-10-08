import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@app': resolve('src/renderer/src/app'),
      '@ui': resolve('src/renderer/src/ui'),
    },
  },
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
