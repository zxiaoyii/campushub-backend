// Flat ESLint config. This file is .mjs because ESLint cannot consume a
// TypeScript config without extra tooling — the root-level exception allowed
// by AGENTS.md §2.
//
// Purpose: turn the prose rules in AGENTS.md into checks a machine enforces.
// Each block below cites the section it implements.
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

/** Layer boundaries from AGENTS.md §3: routes -> controllers -> services -> models. */
const layerBoundaries = [
  {
    // routes/ maps paths to controllers and middleware only.
    files: ['src/routes/**/*.ts'],
    forbidden: ['**/services/**', '**/models/**'],
    message:
      'routes/ may only import controllers and middleware (AGENTS.md §3).',
  },
  {
    // controllers/ must not reach past the service layer into persistence.
    files: ['src/controllers/**/*.ts'],
    forbidden: ['**/models/**', '**/routes/**', 'mongoose'],
    message:
      'controllers/ must delegate to services; no direct data access (AGENTS.md §3).',
  },
  {
    // services/ holds pure business logic and must stay HTTP-agnostic.
    files: ['src/services/**/*.ts'],
    forbidden: [
      'express',
      '**/controllers/**',
      '**/routes/**',
      '**/middleware/**',
    ],
    message:
      'services/ must not depend on HTTP or on layers above it (AGENTS.md §3).',
  },
  {
    // models/ defines schemas and interfaces, nothing else.
    files: ['src/models/**/*.ts'],
    forbidden: [
      'express',
      '**/services/**',
      '**/controllers/**',
      '**/routes/**',
    ],
    message: 'models/ may only define schemas and interfaces (AGENTS.md §3).',
  },
  {
    // config/ and types/ are cross-cutting and must not learn about the domain.
    files: ['src/config/**/*.ts', 'src/types/**/*.ts'],
    forbidden: [
      '**/routes/**',
      '**/controllers/**',
      '**/services/**',
      '**/models/**',
      '**/middleware/**',
    ],
    message:
      'config/ and types/ are cross-cutting and must not import business layers (AGENTS.md §3).',
  },
];

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs'] },

  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // --- §4 Typing: no any, no aliases for it, no suppression comments ---
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': true, 'ts-nocheck': true },
      ],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      // Express fixes handler arity, so unused params are sometimes mandatory.
      // A leading underscore marks them as deliberate; nothing else is exempt.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // --- §4 Async safety: no unhandled promises ---
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      'no-return-await': 'off',

      // --- §4 General: no stray logging, no silent catch ---
      'no-console': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],

      // --- §4 Secrets: process.env is read only inside config/ ---
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Read environment variables only in config/, then import the typed config (AGENTS.md §4).',
        },
      ],
    },
  },

  // config/ is the one place allowed to touch process.env.
  {
    files: ['src/config/**/*.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },

  // server.ts logs startup/shutdown; the error middleware logs failures.
  {
    files: ['src/server.ts', 'src/middleware/error-handler.ts'],
    rules: { 'no-console': 'off' },
  },

  ...layerBoundaries.map(({ files, forbidden, message }) => ({
    files,
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: forbidden, message }] },
      ],
    },
  })),

  // Keep formatting decisions with Prettier; must stay last.
  prettierConfig,
);
