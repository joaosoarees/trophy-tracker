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
    // Reuses transformed modules between runs made by hand. The commit and
    // push hooks and the CI set `CI`, so the runs that gate a change always
    // transform everything again and cannot pass on a stale cache.
    fsModuleCache: !process.env.CI,
    coverage: {
      provider: 'v8',
      // What the project commits to testing: the main process, the shared
      // logic and the pure logic of the interface. Views and controllers are
      // validated by running the app (see CLAUDE.md).
      include: [
        'src/main/**/*.ts',
        'src/shared/**/*.ts',
        'src/renderer/src/app/lib/saver.ts',
        // The store slices that hold logic, tested against a fake main process.
        'src/renderer/src/app/store/slices/updatesSlice.ts',
        'src/renderer/src/app/store/slices/settingsSlice.ts',
        'src/renderer/src/app/store/slices/userDataSlice.ts',
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
        // Wiring that only runs inside Electron; it is exercised by running
        // the app and by the package test in a container.
        'src/main/index.ts',
        'src/main/MainWindow.ts',
        'src/main/ipc/**',
        'src/main/system/AutoUpdater.ts',
        'src/main/system/Browser.ts',
        'src/main/system/LocalFolder.ts',
      ],
      // `lcovonly` (the report as one file, no pages) is what the coverage badge of the README is made from (CI sends
      // the report to Codecov).
      reporter: ['text-summary', 'text', 'lcovonly'],
      // A little under what is covered today (95 / 89 / 95 / 96), so coverage
      // cannot drop unnoticed. Raise them as coverage grows; never lower them
      // to make a change pass. The aim is not 100%: see Tests in CLAUDE.md.
      thresholds: { statements: 93, branches: 87, functions: 93, lines: 94 },
    },
  },
});
