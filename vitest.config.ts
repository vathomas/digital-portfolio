import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run anything matching the conventional `*.test.ts(x)` glob under src/.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    // Don't fail loud just because we're not measuring coverage on a unit run.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts'],
    },
  },
});
