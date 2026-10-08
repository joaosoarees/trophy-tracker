import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

const shared = { '@shared': resolve('src/shared') };

export default defineConfig({
  // Dependencies are externalized by default (`build.externalizeDeps`).
  main: { resolve: { alias: shared } },
  preload: { resolve: { alias: shared } },
  renderer: {
    resolve: {
      alias: {
        ...shared,
        '@app': resolve('src/renderer/src/app'),
        '@ui': resolve('src/renderer/src/ui'),
      },
    },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        // Dependencies ship optimisation hints (`@__PURE__`) in places Rollup
        // cannot use. It drops them safely; there is nothing for us to fix.
        // Every other warning, and this one in our own code, still shows.
        onwarn(warning, warn) {
          const fromDependency = warning.id?.includes('node_modules') ?? false;
          if (warning.code === 'INVALID_ANNOTATION' && fromDependency) return;
          warn(warning);
        },
      },
    },
  },
});
