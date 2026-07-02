import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { e2eSkipReason, hasE2eEnv } from './env'
import {
  createTestUser,
  makeAdminClient,
  newRunId,
  seedCourse,
  teardown,
  type SeededCourse,
  type TestUser,
} from './harness'

/**
 * Test 1 — Aislamiento RLS entre estudiantes.
 *
 * Contrato: un estudiante (E-A) no ve inscripciones, progreso, intentos ni
 * constancias del otro (E-B), aunque estén inscritos al mismo curso. Se
 * verifica con clientes autenticados por JWT (RLS actúa como en producción,
 * no como service-role).
 */

describe.skipIf(!hasE2eEnv)('RLS · aislamiento entre estudiantes', () => {
  if (!hasE2eEnv) {
    // Log visible cuando la suite se salta (no ejecuta describe, así que
    // este mensaje aparece antes en la salida de vitest si se levanta la
    // suite; en la práctica el skipIf ya evita mostrarlo).
    // eslint-disable-next-line no-console
    console.log(`[e2e] RLS aislamiento: saltada — ${e2eSkipReason()}`)
  }

  const runId = newRunId()
  const userIds: string[] = []
  let course: SeededCourse
  let alice: TestUser
  let bob: TestUser

  beforeAll(async () => {
    course = await seedCourse({ runId, label: 'shared' })
    alice = await createTestUser(runId, 'a', { fullName: 'Alice E2E' })
    bob = await createTestUser(runId, 'b', { fullName: 'Bob E2E' })
    userIds.push(alice.id, bob.id)

    const admin = makeAdminClient()

    // Inscribir ambos en el mismo curso.
    await admin.from('enrollments').insert([
      { user_id: alice.id, course_id: course.id },
      { user_id: bob.id, course_id: course.id },
    ])

    // Progreso: Alice completó la lección; Bob no.
    const { data: firstLesson } = await admin
      .from('lessons')
      .select('id, modules!inner(course_id)')
      .eq('modules.course_id', course.id)
      .limit(1)
      .single()
    await admin.from('lesson_progress').insert({
      user_id: alice.id,
      lesson_id: firstLesson!.id,
      completed: true,
      completed_at: new Date().toISOString(),
    })

    // Un intento aprobado de Bob (con constancia asociada).
    const { data: bobAttempt } = await admin
      .from('eval_attempts')
      .insert({
        user_id: bob.id,
        evaluation_id: course.evaluationId,
        attempt_number: 1,
        question_ids: course.questionIds.slice(0, 10),
        score: 100,
        passed: true,
        answers: {},
        submitted_at: new Date().toISOString(),
        time_spent_sec: 600,
      })
      .select('id')
      .single()

    await admin.from('certificates').insert({
      cert_id: `HAB-TEST-${runId}-b`,
      verification_id: `${runId}-verify-b`,
      user_id: bob.id,
      course_id: course.id,
      eval_attempt_id: bobAttempt!.id,
      score: 100,
      status: 'valid',
      expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      professional_name: bob.fullName,
      duration_hours: 1,
    })
  })

  afterAll(async () => {
    await teardown(runId, userIds)
  })

  it('E-A no lee inscripciones de E-B', async () => {
    const { data } = await alice.client
      .from('enrollments')
      .select('user_id')
      .eq('user_id', bob.id)
    expect(data ?? []).toEqual([])
  })

  it('E-A no lee progreso de E-B', async () => {
    const { data } = await alice.client
      .from('lesson_progress')
      .select('user_id')
      .eq('user_id', bob.id)
    expect(data ?? []).toEqual([])
  })

  it('E-A no lee intentos de evaluación de E-B', async () => {
    const { data } = await alice.client
      .from('eval_attempts')
      .select('id, user_id')
      .eq('user_id', bob.id)
    expect(data ?? []).toEqual([])
  })

  it('E-A no lee constancias de E-B (por endpoint autenticado)', async () => {
    // certs_own_read solo permite ver las propias. La verificación pública
    // por RPC es un canal aparte y solo devuelve la del código consultado.
    const { data } = await alice.client
      .from('certificates')
      .select('id, cert_id, user_id')
      .eq('user_id', bob.id)
    expect(data ?? []).toEqual([])
  })

  it('E-A sí lee sus propias filas (control positivo)', async () => {
    const { data: enrollments } = await alice.client
      .from('enrollments')
      .select('user_id')
      .eq('user_id', alice.id)
    expect(enrollments?.length).toBeGreaterThan(0)

    const { data: progress } = await alice.client
      .from('lesson_progress')
      .select('user_id')
      .eq('user_id', alice.id)
    expect(progress?.length).toBeGreaterThan(0)
  })

  it('E-A no ve intentos/constancias con SELECT sin filtro (RLS lo restringe)', async () => {
    const { data: attempts } = await alice.client.from('eval_attempts').select('user_id')
    for (const row of attempts ?? []) expect(row.user_id).toBe(alice.id)

    const { data: certs } = await alice.client.from('certificates').select('user_id')
    for (const row of certs ?? []) expect(row.user_id).toBe(alice.id)
  })
})
