import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import storybook from 'eslint-plugin-storybook';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const renderer = ['src/renderer/**/*.{ts,tsx}'];

// Booleans that keep a name without `is`/`has`/`can`, each for a reason:
// - written to the user's files, or part of what Steam answers, so a new name
//   would be a new file format: `hidden`, `unlocked`, `done`, `pinned`,
//   `alwaysOnTop`, `rememberWindow`;
// - the name of a native or Radix attribute the prop stands for: `open`,
//   `checked`, `disabled`, `readOnly`;
// - `ok`, what tells a result from a failure (as in `Response.ok`), and
//   `value`, the argument of a setter.
const BOOLEAN_NAMES_KEPT =
  '^(hidden|unlocked|done|pinned|alwaysOnTop|rememberWindow|open|checked|disabled|readOnly|ok|value)$';

export default defineConfig(
  // shadcn/ui components are generated; they are formatted but not linted.
  globalIgnores([
    'out',
    'dist',
    'node_modules',
    'coverage',
    'src/renderer/src/ui/primitives',
    'storybook-static',
    // ESLint skips folders that start with a dot unless told otherwise.
    '!.storybook',
  ]),

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: [
            'tsconfig.node.json',
            'tsconfig.web.json',
            'tsconfig.webtest.json',
          ],
          noWarnOnMultipleProjects: true,
        }),
      ],
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-deprecated': 'error',
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          pathGroups: [
            {
              pattern: '@{app,ui,shared,tests}/**',
              group: 'internal',
            },
          ],
          alphabetize: { order: 'asc', caseInsensitive: true },
          'newlines-between': 'always',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
      // `onClick: () => void`, not `onClick(): void`: properties are safe to pass around unbound.
      '@typescript-eslint/method-signature-style': ['error', 'property'],
      // Async handlers on JSX attributes (onClick, onSubmit) are the React norm.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      // Interfaces are prefixed with `I`. `Window` is the global being augmented, not ours to rename.
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^I[A-Z]', match: true },
          filter: { regex: '^Window$', match: false },
        },
        // A boolean says what it answers: `isOpen`, `hasCounter`, `canOpen`.
        {
          selector: [
            'variable',
            'parameter',
            'classProperty',
            'typeProperty',
            'accessor',
          ],
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['is', 'has', 'can', 'should'],
          filter: { regex: BOOLEAN_NAMES_KEPT, match: false },
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    files: [
      'src/main/**/*.ts',
      'src/preload/**/*.ts',
      '__tests__/**/*.ts',
      'src/**/*.spec.ts',
    ],
    languageOptions: { globals: globals.node },
  },

  {
    files: renderer,
    ...react.configs.flat.recommended,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: globals.browser,
    },
    settings: { react: { version: 'detect' } },
  },
  { files: renderer, ...react.configs.flat['jsx-runtime'] },
  {
    files: renderer,
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  { files: renderer, ...jsxA11y.flatConfigs.recommended },
  {
    files: renderer,
    rules: {
      // Focus is moved on purpose into fields the user has just opened (dialog, inline rename).
      'jsx-a11y/no-autofocus': ['error', { ignoreNonDOM: true }],
    },
  },

  {
    // The interface reaches the main process only through app/services.
    files: renderer,
    ignores: ['src/renderer/src/app/services/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.name='window'][property.name='api']",
          message:
            'Use a service from @app/services instead of calling window.api directly.',
        },
      ],
    },
  },

  {
    // Every clickable element carries the pointer cursor, the focus ring and
    // the disabled state; those live in Button and Pressable.
    files: ['src/renderer/src/ui/**/*.tsx'],
    ignores: ['src/renderer/src/ui/components/Pressable.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='button']",
          message:
            'Use Button, IconButton or Pressable instead of a raw <button>.',
        },
        {
          selector: "JSXOpeningElement[name.name='select']",
          message:
            'Use OptionSelect: its list is drawn in the page and it requires a label.',
        },
        {
          selector:
            "MemberExpression[object.name='window'][property.name='api']",
          message:
            'Use a service from @app/services instead of calling window.api directly.',
        },
      ],
    },
  },

  {
    // Tests poke at untyped JSON and use fakes that are async only by signature.
    files: ['__tests__/**/*.ts', 'src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },

  {
    // Config files are plain JavaScript modules outside the TypeScript projects.
    files: ['*.config.mjs', 'scripts/**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: globals.node,
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      // Plugins are consumed through their default export by design.
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',
    },
  },

  // What makes a story file well formed (a default export with a component,
  // stories named in PascalCase...), and the Storybook configuration.
  ...storybook.configs['flat/recommended'],
  {
    // A story's `render` is a component: hooks are allowed in it, and it is
    // named `Render` so the hooks rule sees that.
    files: ['src/renderer/src/stories/**/*.tsx'],
    rules: { 'react/prop-types': 'off' },
  },

  prettier,
);
