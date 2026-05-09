/**
 * ESLint flat config (ESLint v9+).
 *
 * Layered rules:
 *   1. typescript-eslint recommended baseline for all .ts/.tsx
 *   2. eslint-plugin-astro recommended baseline for .astro files
 *   3. project-specific overrides — relax a couple of rules that fight
 *      with the SSE / async-generator / dynamic-import patterns this
 *      codebase deliberately uses
 *
 * Build artifacts and dependencies are excluded — we lint the source.
 */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astroPlugin from 'eslint-plugin-astro';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      '.vercel/**',
      '.astro/**',
      'node_modules/**',
      'coverage/**',
      // Generated PNG/SVG/etc.
      'public/**',
    ],
  },

  js.configs.recommended,

  ...tseslint.configs.recommended,

  ...astroPlugin.configs.recommended,

  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      // Allow `(_unused, used) => …` and `_prefix` for genuinely unused params.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // The agent code uses `void someExpr` to mark an intentionally-discarded
      // value (e.g. `void topic` to silence the unused-param warning when an
      // override keeps the parameter for API compatibility).
      'no-void': 'off',

      // We deliberately use `as Record<string, unknown>` casts in a few places
      // where the upstream type is overly strict (AI SDK's maxTokens field).
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
