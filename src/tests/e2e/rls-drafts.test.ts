import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { hasE2eEnv } from './env'
import { createTestUser, newRunId, seedCourse, teardown, type TestUser } from './harness'

/**
 * Test 2 — Los borradores no aparecen en el catálogo del estudiante.
 * Política `courses_public_read` filtra por `published = true`.
 */

describe.skipIf(!hasE2eEnv)('RLS · borradores fuera del catálogo', () => {
  const runId = newRunId()
  const userIds: string[] = []
  let student: TestUser
  let publishedSlug: string
  let draftSlug: string

  beforeAll(async () => {
    const published = await seedCourse({ runId, label: 'pub', published: true })
    const draft = await seedCourse({ runId, label: 'draft', published: false })
    publishedSlug = published.slug
    draftSlug = draft.slug
    student = await createTestUser(runId, 's')
    userIds.push(student.id)
  })

  afterAll(async () => {
    await teardown(runId, userIds)
  })

  it('el estudiante ve el curso publicado', async () => {
    const { data } = await student.client
      .from('courses')
      .select('slug')
      .eq('slug', publishedSlug)
      .maybeSingle()
    expect(data?.slug).toBe(publishedSlug)
  })

  it('el estudiante NO ve el borrador (misma consulta puntual)', async () => {
    const { data } = await student.client
      .from('courses')
      .select('slug')
      .eq('slug', draftSlug)
      .maybeSingle()
    expect(data).toBeNull()
  })

  it('SELECT sin filtro solo devuelve publicados (defensa en profundidad)', async () => {
    // Filtramos por prefijo de test para no arrastrar cursos de otros runs.
    const { data } = await student.client
      .from('courses')
      .select('slug, published')
      .like('slug', `e2e-${runId}-%`)
    expect(data?.length).toBeGreaterThan(0)
    for (const row of data ?? []) {
      expect(row.published).toBe(true)
    }
  })
})
