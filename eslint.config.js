const js = require('@eslint/js');
const { defineConfig, globalIgnores } = require('eslint/config');
const globals = require('globals');
const reactHooks = require('eslint-plugin-react-hooks');
const reactRefresh = require('eslint-plugin-react-refresh').default;
const tseslint = require('typescript-eslint');

const typescriptRecommended = [js.configs.recommended, tseslint.configs.recommended];

module.exports = defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/node_modules/**',
    'apps/web/playwright-report/**',
    'apps/web/test-results/**',
  ]),
  {
    name: 'smartclass/typescript',
    files: ['apps/api/src/**/*.ts', 'apps/api/test/**/*.ts', 'apps/web/src/**/*.{ts,tsx}', 'apps/web/e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
  {
    name: 'smartclass/api',
    files: ['apps/api/src/**/*.ts', 'apps/api/test/**/*.ts'],
    extends: typescriptRecommended,
    languageOptions: { globals: globals.node },
  },
  {
    name: 'smartclass/web',
    files: ['apps/web/src/**/*.{ts,tsx}'],
    extends: typescriptRecommended,
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    name: 'smartclass/web-refresh',
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/lib/**', 'apps/web/src/components/ui/SimgrRadar.tsx'],
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },
  {
    name: 'smartclass/browser-e2e',
    files: ['apps/web/e2e/**/*.ts'],
    extends: typescriptRecommended,
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
);
