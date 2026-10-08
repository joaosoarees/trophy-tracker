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
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // What the project commits to testing: the main process, the shared
      // logic and the pure logic of the interface. Views and controllers are
      // validated by running the app (see CLAUDE.md).
      include: [
        'src/main/**/*.ts',
        'src/shared/**/*.ts',
        'src/renderer/src/app/lib/saver.ts',
        'src/renderer/src/ui/screens/**/achievementList.ts',
        'src/renderer/src/ui/screens/**/gameList.ts',
        'src/renderer/src/ui/screens/**/schema.ts',
        'src/renderer/src/ui/screens/**/stepperState.ts',
      ],
      exclude: [
        'src/shared/types/**',
        // Texts and constants: nothing to execute.
        'src/shared/i18n/locales/**',
        'src/shared/ipcEvents.ts',
        'src/main/services/releases.ts',
        // Wiring that only runs inside Electron; it is exercised by running
        // the app and by the package test in a container.
        'src/main/index.ts',
        'src/main/window.ts',
        'src/main/ipc/**',
        'src/main/system/autoUpdate.ts',
        'src/main/system/browser.ts',
        'src/main/system/notify.ts',
      ],
      reporter: ['text-summary', 'text'],
      // A little under what is covered today (89 / 82 / 85 / 90), so coverage
      // cannot drop unnoticed. Raise them as coverage grows; never lower them
      // to make a change pass.
      thresholds: { statements: 87, branches: 80, functions: 83, lines: 88 },
    },
  },
});
