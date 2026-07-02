import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Config dedicado a la suite e2e (RLS + server actions sobre un Supabase de
 * test aislado). Corre en serie porque comparte una base de datos: dos tests
 * paralelos podrían pisarse aunque usen prefijos distintos (por conteos
 * globales de `certificates`, por ejemplo). El costo de la serie es aceptable
 * — son ~5 tests.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/e2e/**/*.test.ts'],
    // Sin paralelismo entre archivos: comparten la misma BD.
    fileParallelism: false,
    maxWorkers: 1,
    sequence: { concurrent: false },
    // Timeouts generosos: la creación de auth users + seeds toma ~1–2s.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
