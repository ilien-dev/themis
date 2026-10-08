import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // Fixtures are test data: the JavaScript repos the eval cases hand to a session.
  globalIgnores(['**/node_modules/', 'hooks/dist/', 'evals/results/', 'evals/cases/*/fixture/', 'evals/cases/*/worktree/']),
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { '@stylistic': stylistic },
    rules: {
      'eqeqeq': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      // node:test collects the tests it is handed; nothing awaits them.
      '@typescript-eslint/no-floating-promises': ['error', { allowForKnownSafeCalls: [{ from: 'package', name: 'test', package: 'node:test' }] }],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      // An empty string falls back like a missing one, on purpose (options, env, argv).
      '@typescript-eslint/prefer-nullish-coalescing': ['error', { ignorePrimitives: { string: true } }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/eol-last': 'error',
      '@stylistic/no-trailing-spaces': 'error',
    },
  },
);
