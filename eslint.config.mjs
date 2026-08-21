// ESLint — targeted at the bug classes that actually reached production here.
//
// The rules below are not stylistic. Each one corresponds to a defect found in
// this codebase:
//
//   no-floating-promises  - an async function called without await produced a
//                           NaN credibility score, and `res.send = async`
//                           broke the Express response contract.
//   require-await         - async functions with no await hid sync-only logic
//                           behind a Promise-returning signature.
//   no-misused-promises   - passing an async function where a void callback is
//                           expected (Express middleware, event handlers).
//   await-thenable        - awaiting a non-Promise signals a mis-read API.
//
// Style is deliberately not enforced: this config exists to catch correctness
// bugs, so a noisy formatting ruleset would bury the signal.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'transcend-law/**',
      '**/*.d.ts',
      '**/*.config.{js,mjs,cjs,ts}',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // --- correctness gates (errors) ---
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',

      // --- noise this codebase legitimately produces (off or warn) ---
      // Legacy code is heavily `any`-typed; flagging every instance would bury
      // the correctness findings above. Tighten once those are clean.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': 'off',
      'no-console': 'off',
    },
  },
  {
    // Frontend: the React hooks plugin is registered so inline
    // `eslint-disable react-hooks/*` comments in components resolve. Without it
    // ESLint errors on the unknown rule name rather than the code.
    files: ['transcend-frontend/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    // Tests may fire and forget.
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  }
);
