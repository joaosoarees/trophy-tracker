import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const renderer = ['src/renderer/**/*.{ts,tsx}'];

export default tseslint.config(
  {
    // shadcn/ui components are generated; they are formatted but not linted.
    ignores: ['out', 'dist', 'node_modules', 'src/renderer/src/components/ui'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
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
          project: ['tsconfig.node.json', 'tsconfig.web.json'],
          noWarnOnMultipleProjects: true,
        }),
      ],
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
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
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
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
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'test/**/*.ts'],
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
    // Tests poke at untyped JSON and use fakes that are async only by signature.
    files: ['test/**/*.ts'],
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
    files: ['*.config.mjs'],
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

  prettier,
);
