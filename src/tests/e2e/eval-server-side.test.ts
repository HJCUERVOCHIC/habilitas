import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { gradeAttempt } from '@/lib/evaluation'

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
 * Test 3 — La calificación es server-side y las respuestas correctas nunca
 * llegan al cliente. Se verifica con RLS real (sin service role):
 *
 *  (a) El estudiante NO puede leer la tabla `questions` con su JWT — no hay
 *      política de SELECT para estudiantes; solo admin. Cualquier intento
 *      devuelve cero filas.
 *  (b) La grabación de un intento y su calificación viven en servidor: el
 *      cálculo real lo hace `gradeAttempt` con `correctById` leído por
 *      service-role. Aquí se comprueba que el mismo cálculo puro produce el
 *      score esperado con las opciones sembradas.
 */

describe.skipIf(!hasE2eEnv)('Evaluación server-side (RLS + grading)', () => {
  const runId = newRunId()
  const userIds: string[] = []
  let course: SeededCourse
  let student: TestUser

  beforeAll(async () => {
    course = await seedCourse({ runId, label: 'eval' })
    student = await createTestUser(runId, 's')
    userIds.push(student.id)

    const admin = makeAdminClient()
    await admin.from('enrollments').insert({ user_id: student.id, course_id: course.id })
  })

  afterAll(async () => {
    await teardown(runId, userIds)
  })

  it('el estudiante autenticado NO puede leer `questions` bajo RLS', async () => {
    // Sin política de SELECT para estudiantes, PostgREST filtra todas las
    // filas. Este es el mecanismo que garantiza que `correct_option` nunca
    // salga al cliente aunque un actor hostil intente pedirlo directo.
    const { data, error } = await student.client
      .from('questions')
      .select('id, correct_option')
      .in('id', course.questionIds)
    expect(error).toBeNull()
    expect(data ?? []).toEqual([])
  })

  it('el estudiante tampoco lista `questions` pidiendo solo `id` (sin política)', async () => {
    const { data } = await student.client.from('questions').select('id')
    expect(data ?? []).toEqual([])
  })

  it('la calificación se calcula desde correctById leído por servicio (no por cliente)', async () => {
    // Simula la ruta del servidor: leer `correct_option` con service role,
    // y calificar respuestas mixtas contra las 10 preguntas sorteadas.
    const drawn = course.questionIds.slice(0, 10)
    const correctById = Object.fromEntries(
      drawn.map((qid) => [qid, course.correctByQid[qid]!]),
    )

    const answers: Record<string, number> = {}
    // Acierta las primeras 7, falla las últimas 3.
    drawn.forEach((qid, i) => {
      answers[qid] = i < 7 ? correctById[qid]! : (correctById[qid]! + 1) % 4
    })

    const { correctCount, score } = gradeAttempt(drawn, correctById, answers)
    expect(correctCount).toBe(7)
    expect(score).toBe(70)
  })

  it('un intento del estudiante existe en la tabla, pero sin respuestas correctas leíbles', async () => {
    const admin = makeAdminClient()
    // Un intento de prueba con service role.
    const { data: attempt } = await admin
      .from('eval_attempts')
      .insert({
        user_id: student.id,
        evaluation_id: course.evaluationId,
        attempt_number: 1,
        question_ids: course.questionIds.slice(0, 10),
        answers: {},
      })
      .select('id')
      .single()

    // El estudiante puede ver SU intento (attempts_own) y las question_ids
    // sorteadas, pero NO puede unir a `questions` para leer correct_option.
    const { data: mine } = await student.client
      .from('eval_attempts')
      .select('id, question_ids')
      .eq('id', attempt!.id)
      .single()
    expect(mine?.question_ids).toEqual(course.questionIds.slice(0, 10))

    // Intento explícito de leer respuestas correctas: sigue sin filas.
    const { data: leak } = await student.client
      .from('questions')
      .select('id, correct_option')
      .in('id', mine!.question_ids)
    expect(leak ?? []).toEqual([])
  })
})
