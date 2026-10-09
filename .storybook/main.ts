import { resolve } from 'node:path';

import { type StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';
import { mergeConfig } from 'vite';

/**
 * The catalogue of the interface's building blocks. It runs the same
 * components the app ships, outside Electron: `preview.tsx` stands in for
 * the main process and for the language the app would be in.
 */
const config: StorybookConfig = {
  stories: [
    '../src/renderer/src/stories/**/*.mdx',
    '../src/renderer/src/stories/**/*.stories.tsx',
  ],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
  // The project sends nothing anywhere, and that includes its tooling.
  core: { disableTelemetry: true },
  // The interface is built by electron-vite (electron.vite.config.ts), which
  // Storybook does not read: its aliases and Tailwind are repeated here.
  viteFinal: (base) =>
    mergeConfig(base, {
      resolve: {
        alias: {
          '@shared': resolve('src/shared'),
          '@app': resolve('src/renderer/src/app'),
          '@ui': resolve('src/renderer/src/ui'),
          '@test': resolve('test'),
        },
      },
      plugins: [tailwindcss()],
      // A catalogue opened from disk by a developer, not a site: the size
      // warning meant for downloads says nothing useful here.
      build: { chunkSizeWarningLimit: 2000 },
    }),
};

export default config;
