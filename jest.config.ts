import type { Config } from 'jest';

/**
 * The project is ESM and its sources import each other with explicit `.ts`
 * extensions, which shapes three settings here:
 *
 * - `extensionsToTreatAsEsm` plus `useESM` keep ts-jest emitting ESM, matching
 *   `"type": "module"`. `npm test` sets --experimental-vm-modules for Node.
 * - `rewriteRelativeImportExtensions` is switched off for tests only. The build
 *   needs it (it turns `./env.ts` into `./env.js` for `dist/`), but under Jest
 *   the `.ts` file is what exists on disk, so the rewrite would break
 *   resolution.
 * - Coverage is collected from the two layers the lab sets a threshold on.
 *   Routers are declaration-only and the config layer reads the environment,
 *   so neither has branches worth asserting; both are covered in passing by
 *   the Supertest suites.
 */
const config: Config = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'esnext',
          moduleResolution: 'bundler',
          rewriteRelativeImportExtensions: false,
        },
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/services/**/*.ts', 'src/controllers/**/*.ts'],
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
  // mongodb-memory-server downloads the MongoDB binary on the first run.
  testTimeout: 30_000,
  clearMocks: true,
};

export default config;
