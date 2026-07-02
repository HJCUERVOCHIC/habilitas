import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { hasE2eEnv } from './env'
import {
  createTestUser,
  makeAdminClient,
  newRunId,
  seedCourse,
  teardown,
  type TestUser,
} from './harness'

/**
 * Regresión REG-02 — el admin debe poder abrir un curso en borrador.
 *
 * Contexto: en un momento un cambio de RLS ocultó los borradores tanto al
 * estudiante como al admin, rompiendo la edición desde `/admin/cursos/[slug]`.
 * La convivencia correcta es:
 *   - `admin_all` (PERMISSIVE) → admin ve TODO, incluidos borradores.
 *   - `courses_public_read` (PERMISSIVE) → cualquiera ve solo publicados.
 * Ambas políticas conviven; una PERMISSIVE se une, no se restringe.
 *
 * Este test ejercita el camino de RLS con el JWT del admin (equivalente al
 * fallback cookies-based de `createAdminClient`), que es el más frágil.
 * Si alguien futuro convierte `courses_public_read` en RESTRICTIVE o borra
 * `admin_all`, este test falla.
 */

describe.skipIf(!hasE2eEnv)('RLS · admin puede leer borradores (REG-02)', () => {
  const runId = newRunId()
  const userIds: string[] = []
  let admin: TestUser
  let student: TestUser
  let draftSlug: string
  let publishedSlug: string

  beforeAll(async () => {
    // Sembrar un borrador y un publicado con el service role (bypass RLS).
    const draft = await seedCourse({ runId, label: 'draft-admin', published: false })
    const published = await seedCourse({ runId, label: 'pub-admin', published: true })
    draftSlug = draft.slug
    publishedSlug = published.slug

    // Usuario admin (role=admin en public.users) + estudiante como control.
    admin = await createTestUser(runId, 'admin', { role: 'admin', fullName: 'E2E Admin' })
    student = await createTestUser(runId, 'student')
    userIds.push(admin.id, student.id)
  })

  afterAll(async () => {
    await teardown(runId, userIds)
  })

  it('el admin autenticado (JWT propio) lee el borrador via admin_all', async () => {
    const { data, error } = await admin.client
      .from('courses')
      .select('slug, published, archived_at')
      .eq('slug', draftSlug)
      .maybeSingle()
    expect(error).toBeNull()
    expect(data?.slug).toBe(draftSlug)
    expect(data?.published).toBe(false)
  })

  it('el admin también lee el publicado (control positivo)', async () => {
    const { data } = await admin.client
      .from('courses')
      .select('slug')
      .eq('slug', publishedSlug)
      .maybeSingle()
    expect(data?.slug).toBe(publishedSlug)
  })

  it('el estudiante NO lee el borrador (courses_public_read filtra)', async () => {
    const { data } = await student.client
      .from('courses')
      .select('slug')
      .eq('slug', draftSlug)
      .maybeSingle()
    expect(data).toBeNull()
  })

  it('el estudiante sí lee el publicado', async () => {
    const { data } = await student.client
      .from('courses')
      .select('slug')
      .eq('slug', publishedSlug)
      .maybeSingle()
    expect(data?.slug).toBe(publishedSlug)
  })

  it('service-role bypass (createAdminClient path preferido) también lee el borrador', async () => {
    // Camino de altísima confianza; falla solo si la BD está rota.
    const service = makeAdminClient()
    const { data, error } = await service
      .from('courses')
      .select('slug, published')
      .eq('slug', draftSlug)
      .maybeSingle()
    expect(error).toBeNull()
    expect(data?.slug).toBe(draftSlug)
    expect(data?.published).toBe(false)
  })
})
