import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Ratchet floor on src/lib only (2026-11-21): each figure sits just under
    // measured coverage, so a drop fails `vitest run --coverage` — which the
    // pre-push hook runs on every push to staging. Raise as money/auth coverage
    // grows; never gate pages, components or app/api (Playwright owns those).
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      include: ['src/lib/**/*.ts'],
      exclude: ['**/*.d.ts', '**/__tests__/**', '**/*.test.ts'],
      thresholds: { statements: 68, branches: 62, functions: 51, lines: 68 },
    },
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.ts', 'scripts/__tests__/**/*.test.ts'],
    exclude: ['tests/**', 'node_modules/**'],
    setupFiles: ['./tests/setup.ts'],
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
