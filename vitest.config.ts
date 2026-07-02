import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // La suite e2e vive bajo src/tests/e2e y usa un config aparte
    // (vitest.e2e.config.ts) porque necesita un Supabase de test corriendo.
    // Aquí la excluimos para que `npm test` (CI) solo corra lógica pura.
    exclude: ['**/node_modules/**', 'src/tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
