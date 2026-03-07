import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/core/src/lib/ai/evals/**/*.eval.ts'],
    testTimeout: 30_000,
  },
});
