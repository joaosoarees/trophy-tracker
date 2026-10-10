import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

const shared = { '@shared': resolve('src/shared') };

export default defineConfig({
  // electron-vite leaves `dependencies` out of the main and preload bundles by
  // default, expecting node_modules to ship with the app. Here the package
  // carries no node_modules (see electron-builder.yml), so they are bundled.
  main: { resolve: { alias: shared }, build: { externalizeDeps: false } },
  preload: { resolve: { alias: shared }, build: { externalizeDeps: false } },
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
      // electron-vite leaves the interface unminified by default; minifying cuts it to about a third.
      minify: true,
      // The default limit (500 kB) is meant for sites, where the file is
      // downloaded on every visit. Here it is read from the installed
      // package, and about half of it is react-dom. The warning still shows
      // if the file grows for real.
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        // Dependencies ship optimisation hints (`@__PURE__`) in places Rollup
        // cannot use. It drops them safely; there is nothing for us to fix.
        // Every other warning, and this one in our own code, still shows.
        onwarn(warning, warn) {
          const isFromDependency =
            warning.id?.includes('node_modules') ?? false;
          if (warning.code === 'INVALID_ANNOTATION' && isFromDependency) return;
          warn(warning);
        },
      },
    },
  },
});
