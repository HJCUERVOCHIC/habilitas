/**
 * Andamiaje de datos + autenticación para la suite e2e.
 *
 * Estrategia:
 *  - Cada test corre con un `runId` único (UUID corto) que se propaga a slugs
 *    de curso y emails de usuario: `e2e-<runId>-*`. La limpieza filtra por
 *    ese prefijo → tests paralelos no se pisan y `teardown` es determinista.
 *  - Los usuarios se crean via admin API (service role), con password para
 *    poder autenticarse desde clientes anon y quedar sujetos a RLS.
 *  - Los clientes autenticados NO comparten sesión: cada usuario recibe su
 *    propio `SupabaseClient` con un JWT distinto → RLS discrimina por
 *    `auth.uid()` como en producción.
 *  - Las semillas de curso/preguntas/inscripciones/intentos van con service
 *    role directo (bypass RLS): es infraestructura de test, no el sujeto.
 *
 * Regla dura: si `hasE2eEnv=false`, importar este módulo lanza al primer
 * acceso — nunca se invoca desde CI porque las suites e2e se saltan antes.
 */

import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { E2E_ANON_KEY, E2E_SERVICE_KEY, E2E_URL, hasE2eEnv } from './env'

function assertReady(): void {
  if (!hasE2eEnv) {
    throw new Error('[e2e/harness] entorno no configurado; ver TESTING.md')
  }
}

/** Cliente admin (service role) — bypass RLS. Solo para seed/teardown. */
export function makeAdminClient(): SupabaseClient {
  assertReady()
  return createClient(E2E_URL, E2E_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Cliente anon sin sesión — para probar acceso público / sin login. */
export function makeAnonClient(): SupabaseClient {
  assertReady()
  return createClient(E2E_URL, E2E_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export interface TestUser {
  id: string
  email: string
  password: string
  fullName: string
  role: 'student' | 'admin'
  client: SupabaseClient
}

export interface TestUserOptions {
  role?: 'student' | 'admin'
  fullName?: string
}

/**
 * Crea un usuario en `auth.users`, actualiza su rol/nombre en `public.users`
 * (el trigger `handle_new_user` ya insertó la fila) y devuelve un cliente
 * autenticado con la identidad de ese usuario. RLS aplica normal.
 */
export async function createTestUser(
  runId: string,
  label: string,
  opts: TestUserOptions = {},
): Promise<TestUser> {
  const admin = makeAdminClient()
  const email = `e2e-${runId}-${label}@test.habilitas.local`
  const password = `E2eTest!${randomUUID().slice(0, 12)}`
  const fullName = opts.fullName ?? `E2E ${label}`

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error || !data.user) {
    throw new Error(`createTestUser(${label}): ${error?.message ?? 'sin usuario'}`)
  }
  const userId = data.user.id

  // Ajusta rol y nombre en `public.users` (el trigger ya creó la fila).
  const { error: upErr } = await admin
    .from('users')
    .update({ full_name: fullName, role: opts.role ?? 'student' })
    .eq('id', userId)
  if (upErr) throw new Error(`update perfil ${label}: ${upErr.message}`)

  // Cliente anon separado y sign-in → JWT propio del usuario.
  const client = createClient(E2E_URL, E2E_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: signErr } = await client.auth.signInWithPassword({ email, password })
  if (signErr) throw new Error(`signIn ${label}: ${signErr.message}`)

  return {
    id: userId,
    email,
    password,
    fullName,
    role: opts.role ?? 'student',
    client,
  }
}

/** Semilla mínima de un curso publicado con banco de preguntas. */
export interface SeedCourseOptions {
  runId: string
  label?: string
  published?: boolean
  passScore?: number
  maxAttempts?: number
  certValidityDays?: number
  bankSize?: number
}

export interface SeededCourse {
  id: string
  slug: string
  title: string
  evaluationId: string
  questionIds: string[]
  correctByQid: Record<string, number>
}

export async function seedCourse(opts: SeedCourseOptions): Promise<SeededCourse> {
  const admin = makeAdminClient()
  const label = opts.label ?? 'course'
  const slug = `e2e-${opts.runId}-${label}`
  const title = `E2E Course ${label} ${opts.runId}`
  const bankSize = opts.bankSize ?? 12

  const { data: course, error: cErr } = await admin
    .from('courses')
    .insert({
      slug,
      title,
      category: 'soporte-vital',
      published: opts.published ?? true,
      pass_score: opts.passScore ?? 70,
      max_attempts: opts.maxAttempts ?? 3,
      cert_validity_days: opts.certValidityDays ?? 365,
      duration_hours: 1,
    })
    .select('id')
    .single()
  if (cErr || !course) throw new Error(`seed course: ${cErr?.message}`)

  // Un módulo con una lección de texto — suficiente para satisfacer FKs y
  // para el reproductor (no lo ejercitamos en estas 5 pruebas).
  const { data: mod } = await admin
    .from('modules')
    .insert({ course_id: course.id, title: 'M1', order_index: 1 })
    .select('id')
    .single()
  await admin.from('lessons').insert({
    module_id: mod!.id,
    title: 'L1',
    order_index: 1,
    content_type: 'text',
    duration_min: 5,
  })

  const { data: evaluation, error: eErr } = await admin
    .from('evaluations')
    .insert({ course_id: course.id, title: 'E2E Eval', questions_per_attempt: 10 })
    .select('id')
    .single()
  if (eErr || !evaluation) throw new Error(`seed evaluation: ${eErr?.message}`)

  const rows = Array.from({ length: bankSize }, (_, i) => ({
    evaluation_id: evaluation.id,
    order_index: i + 1,
    text: `Pregunta ${i + 1}`,
    context: null,
    options: ['A', 'B', 'C', 'D'],
    correct_option: i % 4,
    feedback_correct: 'Correcto.',
    feedback_wrong: 'Repasa el material.',
  }))
  const { data: inserted, error: qErr } = await admin
    .from('questions')
    .insert(rows)
    .select('id, correct_option')
  if (qErr || !inserted) throw new Error(`seed questions: ${qErr?.message}`)

  return {
    id: course.id,
    slug,
    title,
    evaluationId: evaluation.id,
    questionIds: inserted.map((q) => q.id),
    correctByQid: Object.fromEntries(inserted.map((q) => [q.id, q.correct_option])),
  }
}

/**
 * Borra TODO lo relacionado con `runId`: cursos (cascada a modules/lessons/
 * evaluations/questions/enrollments/eval_attempts/certificates via FK ON
 * DELETE CASCADE), y usuarios de auth (cascada a `public.users`, luego a lo
 * que quede en enrollments/etc por si algo no salió limpio).
 *
 * Idempotente: si no encuentra filas, no falla.
 */
export async function teardown(runId: string, userIds: readonly string[]): Promise<void> {
  const admin = makeAdminClient()
  const prefix = `e2e-${runId}-`

  await admin.from('courses').delete().like('slug', `${prefix}%`)

  for (const id of userIds) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error && !/not found/i.test(error.message)) {
      // Log pero no interrumpe el resto del teardown.
      // eslint-disable-next-line no-console
      console.warn(`[e2e/teardown] deleteUser(${id}): ${error.message}`)
    }
  }
}

/** UUID corto (8 hex) para prefijar slugs/emails sin exceder longitudes. */
export function newRunId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8)
}
