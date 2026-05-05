import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        // 80% floor per stack.yaml.testing.coverage_target and
        // REQ-CRUX-018-adjacent quality.coverage-floor capability.
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      include: ['packages/**/src/**/*.ts'],
      exclude: ['packages/**/test/**', '**/*.test.ts', '**/*.spec.ts'],
    },
  },
});
