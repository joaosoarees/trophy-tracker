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
  },
});
