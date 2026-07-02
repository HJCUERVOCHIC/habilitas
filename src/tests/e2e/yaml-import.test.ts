import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createClient as createSupabaseJs } from '@supabase/supabase-js'

import { E2E_DB_URL, E2E_SERVICE_KEY, E2E_URL, hasE2eEnv } from './env'
import { makeAdminClient, newRunId } from './harness'

/**
 * Test 5 — Importación YAML: reimportar un slug existente se rechaza (Opción A).
 *
 * Estrategia:
 *  - Mockeamos `next/headers`, `next/cache`, `@/lib/require-admin` y
 *    `@/lib/supabase/admin` para poder invocar el server action REAL
 *    (`importYamlCourse`) contra el Supabase de test.
 *  - Redirigimos `process.env.SUPABASE_DB_URL` a `E2E_SUPABASE_DB_URL` para
 *    la ruta transaccional con `pg`.
 *
 * Guardarraíl: si `hasE2eEnv=false`, la suite se salta antes de tocar los
 * mocks. Con env presente, `process.env.SUPABASE_DB_URL` se restaura al
 * final para no contaminar procesos que sigan corriendo (poco probable en
 * `--singleFork`, pero disciplina no cuesta).
 */

// Mocks a nivel módulo (Vitest los aplica antes de resolver los imports que
// hace el server action bajo prueba).
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: () => {},
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}))

vi.mock('@/lib/require-admin', () => ({
  getAdminUser: async () => ({ id: '00000000-0000-0000-0000-000000000000' }),
  getSessionAndRole: async () => ({ user: null, isAdmin: true, fullName: 'e2e-admin' }),
  requireAdminPage: async () => ({ id: '00000000-0000-0000-0000-000000000000' }),
}))

// El server action lee `process.env.NEXT_PUBLIC_SUPABASE_URL` /
// `SUPABASE_SERVICE_ROLE_KEY` desde `createAdminClient()`. Redirigimos ese
// módulo entero al cliente de test.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () =>
    createSupabaseJs(E2E_URL, E2E_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
}))

// Import perezoso DESPUÉS de los mocks.
const importYamlCourse = async (
  text: string,
): Promise<{ ok: true; slug: string } | { ok: false; errors: string[] }> => {
  const mod = await import('@/app/admin/cursos/importar/actions')
  return mod.importYamlCourse(text)
}

const YAML_TEMPLATE = (slug: string) => `
titulo: ${slug}
area: bioseguridad
descripcion: Curso e2e para probar reimportación
modulos:
  - titulo: Módulo 1
    lecciones:
      - tipo: texto
        titulo: Lección 1
        contenido_md: |
          # Contenido
          Texto de prueba.
      - tipo: texto
        titulo: Lección 2
        contenido_md: Segunda lección.
`

describe.skipIf(!hasE2eEnv)('Importación YAML · rechazo de slug duplicado (Opción A)', () => {
  const runId = newRunId()
  const slug = `e2e-${runId}-yaml-dup`
  let dbUrlBackup: string | undefined

  beforeAll(() => {
    dbUrlBackup = process.env.SUPABASE_DB_URL
    process.env.SUPABASE_DB_URL = E2E_DB_URL
  })

  afterAll(async () => {
    // Limpia el curso importado (cascada a modules/lessons/evaluations).
    const admin = makeAdminClient()
    await admin.from('courses').delete().eq('slug', slug)

    if (dbUrlBackup === undefined) delete process.env.SUPABASE_DB_URL
    else process.env.SUPABASE_DB_URL = dbUrlBackup
    vi.restoreAllMocks()
  })

  it('la primera importación crea el curso', async () => {
    const res = await importYamlCourse(YAML_TEMPLATE(slug))
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.slug).toBe(slug)

    const admin = makeAdminClient()
    const { count } = await admin
      .from('courses')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug)
    expect(count).toBe(1)
  })

  it('la segunda importación del mismo slug es rechazada sin duplicar', async () => {
    const res = await importYamlCourse(YAML_TEMPLATE(slug))
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.errors.join(' ')).toMatch(/ya existe|slug/i)
    }

    // Sigue habiendo exactamente una fila: la transacción no debe haber
    // insertado nada nuevo.
    const admin = makeAdminClient()
    const { count } = await admin
      .from('courses')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug)
    expect(count).toBe(1)
  })
})
