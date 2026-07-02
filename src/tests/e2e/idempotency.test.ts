import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { hasE2eEnv } from './env'
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
 * Test 4 — Idempotencia.
 *
 *  (a) Inscribirse dos veces al mismo curso no crea dos filas
 *      — la tabla `enrollments` tiene UNIQUE (user_id, course_id) y el server
 *        action usa upsert con `ignoreDuplicates`. Aquí ejercitamos la misma
 *        semántica (upsert) desde el cliente del estudiante bajo RLS.
 *
 *  (b) Emitir dos veces la constancia del mismo intento aprobado NO crea
 *      dos filas: el índice UNIQUE `certificates_eval_attempt_unique` bloquea
 *      el segundo insert. Se ejercita con service role para probar la
 *      restricción física en la DB (defensa a nivel esquema, no solo app).
 */

describe.skipIf(!hasE2eEnv)('Idempotencia · inscripción y emisión de constancia', () => {
  const runId = newRunId()
  const userIds: string[] = []
  let course: SeededCourse
  let student: TestUser

  beforeAll(async () => {
    course = await seedCourse({ runId, label: 'idem' })
    student = await createTestUser(runId, 's')
    userIds.push(student.id)
  })

  afterAll(async () => {
    await teardown(runId, userIds)
  })

  it('inscribirse dos veces deja exactamente una fila', async () => {
    // Primera inscripción (idempotente: upsert con ignoreDuplicates).
    const { error: e1 } = await student.client
      .from('enrollments')
      .upsert(
        { user_id: student.id, course_id: course.id },
        { onConflict: 'user_id,course_id', ignoreDuplicates: true },
      )
    expect(e1).toBeNull()

    // Segunda inscripción (mismo par).
    const { error: e2 } = await student.client
      .from('enrollments')
      .upsert(
        { user_id: student.id, course_id: course.id },
        { onConflict: 'user_id,course_id', ignoreDuplicates: true },
      )
    expect(e2).toBeNull()

    const { data, count } = await student.client
      .from('enrollments')
      .select('id', { count: 'exact' })
      .eq('user_id', student.id)
      .eq('course_id', course.id)
    expect(count).toBe(1)
    expect((data ?? []).length).toBe(1)
  })

  it('emitir dos constancias para el MISMO eval_attempt viola UNIQUE en DB', async () => {
    const admin = makeAdminClient()

    // Un intento aprobado del estudiante.
    const { data: attempt } = await admin
      .from('eval_attempts')
      .insert({
        user_id: student.id,
        evaluation_id: course.evaluationId,
        attempt_number: 1,
        question_ids: course.questionIds.slice(0, 10),
        score: 100,
        passed: true,
        submitted_at: new Date().toISOString(),
        time_spent_sec: 300,
        answers: {},
      })
      .select('id')
      .single()

    const certPayload = {
      user_id: student.id,
      course_id: course.id,
      eval_attempt_id: attempt!.id,
      score: 100,
      status: 'valid',
      expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      professional_name: student.fullName,
      duration_hours: 1,
    }

    // Primera emisión — inserta.
    const { error: e1 } = await admin.from('certificates').insert({
      ...certPayload,
      cert_id: `HAB-TEST-${runId}-1`,
      verification_id: `${runId}-verify-1`,
    })
    expect(e1).toBeNull()

    // Segunda emisión con distinto cert_id + verification_id pero MISMO
    // eval_attempt_id: la restricción física de la DB debe bloquearla.
    const { error: e2 } = await admin.from('certificates').insert({
      ...certPayload,
      cert_id: `HAB-TEST-${runId}-2`,
      verification_id: `${runId}-verify-2`,
    })
    expect(e2).not.toBeNull()
    // El código de duplicado de PostgreSQL es 23505 (unique_violation).
    expect(e2?.code).toBe('23505')

    const { count } = await admin
      .from('certificates')
      .select('id', { count: 'exact', head: true })
      .eq('eval_attempt_id', attempt!.id)
    expect(count).toBe(1)
  })
})
