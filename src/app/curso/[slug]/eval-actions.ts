'use server'

import { randomUUID } from 'node:crypto'

import { certificateExpiresAt } from '@/lib/certificate'
import { sendCertificateEmail } from '@/lib/email'
import {
  QUESTIONS_PER_ATTEMPT,
  TIMER_GRACE_SEC,
  TIMER_SEC,
  computeAttemptWindow,
  drawRandomIds,
  elapsedSec,
  gradeAttempt,
  isAttemptExpired,
} from '@/lib/evaluation'
import { revalidateStudentActivityForAdmin } from '@/lib/revalidate-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'
import type {
  EvalPageState,
  EvalQuestion,
  EvalReviewItem,
  EvalStart,
  EvalSubmit,
} from '@/types/eval'

/**
 * Server actions del bloque E3 (SPEC-EVALUACION).
 *
 * Reglas críticas:
 *  - **Las respuestas correctas nunca salen del servidor durante el intento.**
 *    Las preguntas viajan al cliente sin `correct_option`; la calificación
 *    ocurre server-side comparando contra el banco leído via service-role.
 *  - Timer (20 min) y bloqueo (24 h) son constantes fijas del spec, no
 *    columnas por curso; ver `src/lib/evaluation.ts`.
 *  - RLS: los propios `eval_attempts` se leen/escriben con el cookies client
 *    (política `attempts_own`); las preguntas/opciones se leen con el admin
 *    client porque no hay política de lectura para estudiantes (defensa en
 *    profundidad — así ni siquiera un cliente autenticado como estudiante
 *    puede pedir `correct_option`).
 */

type SupabaseAdmin = ReturnType<typeof createAdminClient>
type QuestionRow = {
  id: string
  text: string
  context: string | null
  options: Json
  correct_option: number
  feedback_correct: string | null
  feedback_wrong: string | null
  order_index: number
}

function toOptions(value: Json): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : []
}

function toAnswers(value: Json | null): Record<string, number> {
  const out: Record<string, number> = {}
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, val] of Object.entries(value)) {
      if (typeof val === 'number' && Number.isInteger(val) && val >= 0) out[key] = val
    }
  }
  return out
}

function sanitizeAnswers(
  responses: Record<string, unknown>,
  allowedIds: readonly string[],
): Record<string, number> {
  const allowed = new Set(allowedIds)
  const out: Record<string, number> = {}
  for (const [key, val] of Object.entries(responses)) {
    if (!allowed.has(key)) continue
    if (typeof val !== 'number' || !Number.isInteger(val) || val < 0) continue
    out[key] = val
  }
  return out
}

async function loadQuestionsForClient(
  admin: SupabaseAdmin,
  ids: readonly string[],
): Promise<EvalQuestion[]> {
  if (ids.length === 0) return []
  // Nota crítica: NO se selecciona `correct_option`. La proyección explícita
  // evita filtraciones si en el futuro alguien añade `select('*')`.
  const { data } = await admin
    .from('questions')
    .select('id, text, context, options, order_index')
    .in('id', ids)
  const byId = new Map((data ?? []).map((q) => [q.id, q]))
  return ids
    .map((id, index): EvalQuestion | null => {
      const q = byId.get(id)
      if (!q) return null
      return {
        id: q.id,
        order: index + 1,
        text: q.text,
        context: q.context,
        options: toOptions(q.options),
      }
    })
    .filter((q): q is EvalQuestion => q !== null)
}

async function loadCorrectByAndBank(
  admin: SupabaseAdmin,
  ids: readonly string[],
): Promise<{ correctById: Record<string, number>; rows: Map<string, QuestionRow> }> {
  if (ids.length === 0) return { correctById: {}, rows: new Map() }
  const { data } = await admin
    .from('questions')
    .select('id, text, context, options, correct_option, feedback_correct, feedback_wrong, order_index')
    .in('id', ids)
  const rows = new Map<string, QuestionRow>()
  const correctById: Record<string, number> = {}
  for (const q of data ?? []) {
    rows.set(q.id, q)
    correctById[q.id] = q.correct_option
  }
  return { correctById, rows }
}

function buildReview(
  ids: readonly string[],
  rows: Map<string, QuestionRow>,
  answers: Record<string, number>,
): EvalReviewItem[] {
  return ids
    .map((qid): EvalReviewItem | null => {
      const q = rows.get(qid)
      if (!q) return null
      const selected = answers[qid] ?? null
      const correct = selected === q.correct_option
      return {
        question: q.text,
        options: toOptions(q.options),
        correctOption: q.correct_option,
        selectedOption: selected,
        correct,
        explanation: correct ? q.feedback_correct : q.feedback_wrong,
      }
    })
    .filter((r): r is EvalReviewItem => r !== null)
}

type BaseContext = {
  supabase: ReturnType<typeof createClient>
  admin: SupabaseAdmin
  userId: string
  course: {
    id: string
    title: string
    slug: string
    pass_score: number
    max_attempts: number
    cert_validity_days: number
    instructor_id: string | null
  }
  evaluationId: string | null
  bankIds: string[]
  /**
   * Preguntas por intento efectivas (SPEC-INSCRIPCIONES-SEGUIMIENTO §1.8):
   * viene de `evaluations.questions_per_attempt`. Fallback a la constante
   * histórica cuando aún no hay `evaluation`.
   */
  questionsPerAttempt: number
}

async function loadBaseContext(slug: string): Promise<
  | { ok: false; reason: 'auth' | 'enrollment' | 'not-found' }
  | { ok: true; ctx: BaseContext }
> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'auth' }

  const admin = createAdminClient()

  const { data: course } = await admin
    .from('courses')
    .select('id, slug, title, pass_score, max_attempts, cert_validity_days, instructor_id')
    .eq('slug', slug)
    .maybeSingle()
  if (!course) return { ok: false, reason: 'not-found' }

  // Inscripción con el cookies client (política enrollments_own): defensa en
  // profundidad ante una respuesta incorrecta del admin client.
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', course.id)
    .maybeSingle()
  if (!enrollment) return { ok: false, reason: 'enrollment' }

  const { data: evaluation } = await admin
    .from('evaluations')
    .select('id, questions_per_attempt')
    .eq('course_id', course.id)
    .maybeSingle()

  const { data: bankRows } = evaluation
    ? await admin.from('questions').select('id').eq('evaluation_id', evaluation.id)
    : { data: [] }
  const bankIds = (bankRows ?? []).map((r) => r.id)

  return {
    ok: true,
    ctx: {
      supabase,
      admin,
      userId: user.id,
      course,
      evaluationId: evaluation?.id ?? null,
      bankIds,
      questionsPerAttempt: evaluation?.questions_per_attempt ?? QUESTIONS_PER_ATTEMPT,
    },
  }
}

/**
 * Construye el snapshot de la estructura del curso (módulos + lecciones con
 * su título y tipo) al momento de emitir la constancia. Se guarda como jsonb
 * en `certificates.course_structure_snapshot` (H5).
 *
 * Selects de columnas directas encadenados: primero los módulos, después las
 * lecciones filtradas por module_id. No usa embeds de PostgREST porque su
 * forma (array vs objeto) depende de heurísticas de cardinalidad y puede
 * romperse en silencio con el tipo genérico.
 */
export interface CourseStructureSnapshotModule {
  title: string
  lessons: { title: string; content_type: string }[]
}

async function buildCourseStructureSnapshot(
  admin: SupabaseAdmin,
  courseId: string,
): Promise<CourseStructureSnapshotModule[]> {
  const { data: modules } = await admin
    .from('modules')
    .select('id, title, order_index')
    .eq('course_id', courseId)
    .order('order_index')
  const modList = modules ?? []
  if (modList.length === 0) return []

  const moduleIds = modList.map((m) => m.id)
  const { data: lessons } = await admin
    .from('lessons')
    .select('module_id, title, content_type, order_index')
    .in('module_id', moduleIds)
    .order('order_index')
  const lessonsByModule = new Map<string, { title: string; content_type: string }[]>()
  for (const l of lessons ?? []) {
    const arr = lessonsByModule.get(l.module_id) ?? []
    arr.push({ title: l.title, content_type: l.content_type })
    lessonsByModule.set(l.module_id, arr)
  }
  return modList.map((m) => ({
    title: m.title,
    lessons: lessonsByModule.get(m.id) ?? [],
  }))
}

/**
 * Resuelve el slug del curso al que pertenece una evaluación. Se usa para
 * invalidar rutas de admin cuando el estudiante inicia o envía un intento
 * (regla de invalidación cruzada, CLAUDE.md). Selects encadenados; no
 * embeds. Loguea el fallo para no dejar la invalidación silenciosamente
 * omitida.
 */
async function slugForEvaluationFromStudent(
  admin: SupabaseAdmin,
  evaluationId: string,
): Promise<string | null> {
  const { data: evaluation, error: evalErr } = await admin
    .from('evaluations')
    .select('course_id')
    .eq('id', evaluationId)
    .maybeSingle<{ course_id: string }>()
  if (evalErr) {
    console.error('[student→admin] slugForEvaluationFromStudent(eval):', evalErr.message, evaluationId)
    return null
  }
  if (!evaluation?.course_id) {
    console.warn('[student→admin] slugForEvaluationFromStudent sin course_id:', evaluationId)
    return null
  }
  const { data: course, error: courseErr } = await admin
    .from('courses')
    .select('slug')
    .eq('id', evaluation.course_id)
    .maybeSingle<{ slug: string }>()
  if (courseErr) {
    console.error('[student→admin] slugForEvaluationFromStudent(course):', courseErr.message, evaluation.course_id)
    return null
  }
  return course?.slug ?? null
}

/**
 * Lee las anulaciones de bloqueo (F8) vigentes en la ventana para el par
 * (user, evaluation). Usa el admin client porque la RLS del estudiante
 * (`attempt_unlocks_own_read`) también funcionaría, pero mantenemos el admin
 * para consistencia con las lecturas de banco.
 */
async function loadUserUnlocks(
  admin: SupabaseAdmin,
  userId: string,
  evaluationId: string,
): Promise<{ granted_at: string }[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .from('attempt_unlocks')
    .select('granted_at')
    .eq('user_id', userId)
    .eq('evaluation_id', evaluationId)
    .gte('granted_at', cutoff)
  return (data ?? []).map((r) => ({ granted_at: r.granted_at }))
}

/**
 * Carga el estado completo para la pantalla `/curso/[slug]/evaluacion` (SSR).
 * Devuelve un variant discriminado que la página renderiza directamente.
 * No mutan datos: si un intento abierto expiró, se marca como
 * `expired-pending` para que el cliente auto-envíe con lo que tenga.
 */
export async function getEvaluationPageState(slug: string): Promise<EvalPageState> {
  const base = await loadBaseContext(slug)
  if (!base.ok) {
    if (base.reason === 'auth') return { status: 'auth' }
    return { status: 'enrollment', slug }
  }
  const { ctx } = base
  const { course, bankIds, evaluationId, questionsPerAttempt } = ctx

  if (!evaluationId || bankIds.length < questionsPerAttempt) {
    return {
      status: 'no-bank',
      courseTitle: course.title,
      slug: course.slug,
      bankSize: bankIds.length,
    }
  }

  const { data: attempts } = await ctx.supabase
    .from('eval_attempts')
    .select('id, started_at, submitted_at, score, passed, question_ids, answers, attempt_number')
    .eq('user_id', ctx.userId)
    .eq('evaluation_id', evaluationId)
    .order('started_at', { ascending: false })

  const rows = attempts ?? []
  const openAttempt = rows.find((r) => r.submitted_at === null)
  const closedAttempts = rows.filter((r) => r.submitted_at !== null)
  const passedRow = closedAttempts.find((r) => r.passed === true)

  if (passedRow) {
    // Aprobado — mostrar revisión completa (D1). Se lee el banco con admin
    // solo aquí, tras confirmar `passed=true`.
    const questionIds = passedRow.question_ids ?? []
    const { rows: qrows } = await loadCorrectByAndBank(ctx.admin, questionIds)
    const answers = toAnswers(passedRow.answers)
    const review = buildReview(questionIds, qrows, answers)
    const correct = questionIds.reduce((n, qid) => {
      const q = qrows.get(qid)
      return q && answers[qid] === q.correct_option ? n + 1 : n
    }, 0)

    // Backfill perezoso (SPEC-CONSTANCIA-PERFIL §1.1): si el aprobado se
    // registró antes de que existiera la emisión automática, emitirla ahora.
    // La operación es idempotente.
    const emission = await emitCertificate(passedRow.id)

    return {
      status: 'passed',
      courseTitle: course.title,
      slug: course.slug,
      score: passedRow.score ?? 0,
      submittedAt: passedRow.submitted_at ?? '',
      review,
      passScore: course.pass_score,
      correct,
      total: questionIds.length,
      timeSpentSec: 0,
      verificationId: emission.ok ? emission.verificationId : null,
      certId: emission.ok ? emission.certId : null,
    }
  }

  if (openAttempt) {
    if (isAttemptExpired(openAttempt.started_at)) {
      return {
        status: 'expired-pending',
        courseTitle: course.title,
        slug: course.slug,
        attemptId: openAttempt.id,
      }
    }
    const questions = await loadQuestionsForClient(ctx.admin, openAttempt.question_ids ?? [])
    return {
      status: 'active',
      courseTitle: course.title,
      slug: course.slug,
      attemptId: openAttempt.id,
      startedAt: openAttempt.started_at,
      questions,
      passScore: course.pass_score,
      maxAttempts: course.max_attempts,
      attemptNumber: openAttempt.attempt_number ?? closedAttempts.length + 1,
      savedAnswers: toAnswers(openAttempt.answers),
    }
  }

  const unlocks = await loadUserUnlocks(ctx.admin, ctx.userId, evaluationId)
  const window = computeAttemptWindow(
    closedAttempts.map((a) => ({ submitted_at: a.submitted_at!, passed: a.passed ?? false })),
    course.max_attempts,
    unlocks,
  )

  if (window.blocked) {
    const latest = closedAttempts.reduce<typeof closedAttempts[number] | null>((acc, a) => {
      if (!acc) return a
      return new Date(a.submitted_at!).getTime() > new Date(acc.submitted_at!).getTime() ? a : acc
    }, null)
    return {
      status: 'blocked',
      courseTitle: course.title,
      slug: course.slug,
      unlockAt: window.unlockAt,
      lastScore: latest?.score ?? null,
      maxAttempts: course.max_attempts,
    }
  }

  const lastFailed = closedAttempts[0] ?? null
  return {
    status: 'ready',
    courseTitle: course.title,
    slug: course.slug,
    passScore: course.pass_score,
    maxAttempts: course.max_attempts,
    remainingAttempts: window.remaining,
    questionCount: questionsPerAttempt,
    lastFailedScore: lastFailed?.score ?? null,
  }
}

/**
 * Crea un nuevo intento: sortea 10 preguntas y devuelve las opciones **sin**
 * la marca de correcta. Rechaza si ya aprobó, si está bloqueado por 24 h,
 * si hay un intento en curso, o si el banco no llega a 10.
 */
export async function startAttempt(slug: string): Promise<EvalStart> {
  const base = await loadBaseContext(slug)
  if (!base.ok) {
    if (base.reason === 'auth') return { ok: false, reason: 'auth' }
    if (base.reason === 'enrollment') return { ok: false, reason: 'enrollment' }
    return { ok: false, reason: 'no-bank' }
  }
  const { ctx } = base
  const { evaluationId, bankIds, course, questionsPerAttempt } = ctx

  if (!evaluationId || bankIds.length < questionsPerAttempt) {
    return { ok: false, reason: 'no-bank' }
  }

  const { data: attempts } = await ctx.supabase
    .from('eval_attempts')
    .select('id, started_at, submitted_at, score, passed, attempt_number')
    .eq('user_id', ctx.userId)
    .eq('evaluation_id', evaluationId)
    .order('started_at', { ascending: false })

  const rows = attempts ?? []
  if (rows.some((r) => r.submitted_at === null && !isAttemptExpired(r.started_at))) {
    return { ok: false, reason: 'in-progress' }
  }
  if (rows.some((r) => r.passed === true)) return { ok: false, reason: 'passed' }

  const closed = rows.filter((r) => r.submitted_at !== null)
  const unlocks = await loadUserUnlocks(ctx.admin, ctx.userId, evaluationId)
  const window = computeAttemptWindow(
    closed.map((a) => ({ submitted_at: a.submitted_at!, passed: a.passed ?? false })),
    course.max_attempts,
    unlocks,
  )
  if (window.blocked) return { ok: false, reason: 'blocked' }

  const drawn = drawRandomIds(bankIds, questionsPerAttempt)

  // Número de intento monotónico dentro de la evaluación (para el histórico).
  const nextNumber = (rows[0]?.attempt_number ?? 0) + 1

  const { data: attempt, error: insertError } = await ctx.supabase
    .from('eval_attempts')
    .insert({
      user_id: ctx.userId,
      evaluation_id: evaluationId,
      attempt_number: nextNumber,
      question_ids: drawn,
    })
    .select('id, started_at')
    .single()
  if (insertError || !attempt) return { ok: false, reason: 'no-bank' }

  const questions = await loadQuestionsForClient(ctx.admin, drawn)

  // Invalidación cruzada estudiante → admin: iniciar un intento cambia el
  // estado de evaluación en `/admin/cursos/[slug]/inscritos` y en la ficha
  // (regla en CLAUDE.md). `course.slug` está en ctx, no requiere lookup.
  revalidateStudentActivityForAdmin(course.slug, ctx.userId)

  return {
    ok: true,
    attemptId: attempt.id,
    startedAt: attempt.started_at,
    questions,
    passScore: course.pass_score,
    maxAttempts: course.max_attempts,
    attemptNumber: nextNumber,
  }
}

/**
 * Auto-save de respuestas mid-intento (spec §1.3 "reanuda"). Solo sobrescribe
 * `answers`; no toca `submitted_at` ni score. Idempotente y silencioso ante
 * errores para no bloquear la UX.
 */
export async function saveAttemptAnswers(
  attemptId: string,
  responses: Record<string, number>,
): Promise<{ ok: boolean }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const { data: attempt } = await supabase
    .from('eval_attempts')
    .select('id, user_id, submitted_at, question_ids, started_at')
    .eq('id', attemptId)
    .maybeSingle()
  if (!attempt || attempt.user_id !== user.id) return { ok: false }
  if (attempt.submitted_at !== null) return { ok: false }
  if (isAttemptExpired(attempt.started_at)) return { ok: false }

  const clean = sanitizeAnswers(responses, attempt.question_ids ?? [])
  const { error } = await supabase
    .from('eval_attempts')
    .update({ answers: clean })
    .eq('id', attemptId)
  return { ok: !error }
}

/**
 * Cierra y califica el intento. Fuente de verdad del timer: `started_at`.
 * - Si el envío llega dentro de la ventana → cuentan las respuestas.
 * - Si llega fuera de la ventana (spec §1.4: "lo enviado fuera de tiempo no
 *   cuenta") → se ignoran las respuestas del payload y se califican solo las
 *   que ya habían quedado auto-guardadas por `saveAttemptAnswers`. Esto evita
 *   que un cliente hostil suplante el timer subiendo respuestas post-vencido.
 */
export async function submitAttempt(
  attemptId: string,
  responses: Record<string, number>,
): Promise<EvalSubmit> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'auth' }

  const { data: attempt } = await supabase
    .from('eval_attempts')
    .select(
      'id, user_id, evaluation_id, question_ids, started_at, submitted_at, answers, score, passed, time_spent_sec, attempt_number',
    )
    .eq('id', attemptId)
    .maybeSingle()
  if (!attempt || attempt.user_id !== user.id) return { ok: false, reason: 'not-found' }
  if (attempt.submitted_at !== null) return { ok: false, reason: 'already-submitted' }

  const timedOut = isAttemptExpired(attempt.started_at)
  const questionIds = attempt.question_ids ?? []
  const persistedAnswers = toAnswers(attempt.answers)
  const cleanIncoming = sanitizeAnswers(responses, questionIds)
  // Fuera de tiempo → solo cuenta lo previamente auto-guardado.
  const finalAnswers = timedOut ? persistedAnswers : { ...persistedAnswers, ...cleanIncoming }

  const admin = createAdminClient()
  const { correctById, rows: qrows } = await loadCorrectByAndBank(admin, questionIds)
  const { correctCount, score } = gradeAttempt(questionIds, correctById, finalAnswers)

  const { data: evaluation } = attempt.evaluation_id
    ? await admin
        .from('evaluations')
        .select('course_id')
        .eq('id', attempt.evaluation_id)
        .maybeSingle()
    : { data: null }
  const { data: course } = evaluation
    ? await admin
        .from('courses')
        .select('pass_score, max_attempts')
        .eq('id', evaluation.course_id)
        .maybeSingle()
    : { data: null }
  const passScore = course?.pass_score ?? 70
  const maxAttempts = course?.max_attempts ?? 3
  const passed = score >= passScore

  const elapsed = elapsedSec(attempt.started_at)
  // Ante un envío tardío, el tiempo registrado queda topado en TIMER_SEC
  // (el intento "válido" duró como máximo la ventana). El campo es puramente
  // informativo; la validez del envío se refleja en `timedOut`.
  const timeSpentSec = Math.min(elapsed, TIMER_SEC + TIMER_GRACE_SEC)

  const { error: updateError } = await supabase
    .from('eval_attempts')
    .update({
      score,
      passed,
      answers: finalAnswers,
      time_spent_sec: timeSpentSec,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
  if (updateError) return { ok: false, reason: 'not-found' }

  // Invalidación cruzada estudiante → admin: el intento cerrado (aprobado o
  // reprobado) cambia el estado en `/admin/cursos/[slug]/inscritos` y en la
  // ficha (regla CLAUDE.md). Si aprobó, `emitCertificate` invalidará otra
  // vez tras insertar; `revalidatePath` es idempotente.
  if (attempt.evaluation_id) {
    const slug = await slugForEvaluationFromStudent(admin, attempt.evaluation_id)
    if (slug) revalidateStudentActivityForAdmin(slug, user.id)
  }

  const base = {
    ok: true as const,
    score,
    passed,
    correct: correctCount,
    total: questionIds.length,
    timeSpentSec,
    timedOut,
  }

  if (passed) {
    // Aprobado → emisión automática e idempotente de la constancia
    // (SPEC-CONSTANCIA-PERFIL §1.1). Se ignora un fallo: la vista de
    // aprobación funciona igual y el backfill de /perfil recuperará el caso.
    const emission = await emitCertificate(attemptId)
    const certExtras =
      emission.ok
        ? { verificationId: emission.verificationId, certId: emission.certId }
        : { verificationId: null, certId: null }
    return {
      ...base,
      review: buildReview(questionIds, qrows, finalAnswers),
      ...certExtras,
    }
  }

  const topics: string[] = []
  for (const qid of questionIds) {
    const q = qrows.get(qid)
    if (q && finalAnswers[qid] !== q.correct_option) topics.push(q.text)
  }

  // Post-envío: recomputar ventana incluyendo este intento para saber si
  // quedó bloqueado o aún puede reintentar. Los unlocks vigentes también
  // cuentan para el techo efectivo.
  const { data: allAttempts } = await supabase
    .from('eval_attempts')
    .select('submitted_at, passed')
    .eq('user_id', user.id)
    .eq('evaluation_id', attempt.evaluation_id!)
    .not('submitted_at', 'is', null)
  const closed = (allAttempts ?? []).map((a) => ({
    submitted_at: a.submitted_at as string,
    passed: a.passed ?? false,
  }))
  const unlocks = await loadUserUnlocks(admin, user.id, attempt.evaluation_id!)
  const window = computeAttemptWindow(closed, maxAttempts, unlocks)
  const extras =
    window.blocked
      ? { unlockAt: window.unlockAt, remainingAttempts: 0 }
      : { remainingAttempts: window.remaining }

  return { ...base, topics, ...extras }
}

export type EmitCertificateResult =
  | { ok: true; certId: string; verificationId: string }
  | { ok: false; reason: string }

/**
 * Emite la constancia asociada al intento aprobado (SPEC-CONSTANCIA-PERFIL
 * §1.1). Idempotente en dos niveles:
 *  1. Por `(user_id, course_id)`: si el usuario ya tiene una constancia para
 *     este curso (aunque venga de otro intento), la reutiliza.
 *  2. Por `eval_attempt_id` (UNIQUE en DB): defensa ante race conditions.
 *
 * La vigencia arranca en la emisión (`issued_at + cert_validity_days`).
 * `verification_id` es UUID v4 inadivinable — la URL pública usa este token
 * y nunca el `cert_id` legible (que existe solo para soporte y el documento).
 */
export async function emitCertificate(attemptId: string): Promise<EmitCertificateResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'auth' }

  const { data: attempt } = await supabase
    .from('eval_attempts')
    .select('id, user_id, evaluation_id, score, passed, submitted_at')
    .eq('id', attemptId)
    .maybeSingle()
  if (!attempt || attempt.user_id !== user.id) return { ok: false, reason: 'not-found' }
  if (!attempt.passed || attempt.submitted_at === null) return { ok: false, reason: 'not-passed' }

  const admin = createAdminClient()

  // Idempotencia (a): por intento — cubre re-emisión del mismo attempt.
  const { data: byAttempt } = await admin
    .from('certificates')
    .select('cert_id, verification_id')
    .eq('eval_attempt_id', attemptId)
    .maybeSingle()
  if (byAttempt) {
    return {
      ok: true,
      certId: byAttempt.cert_id,
      verificationId: byAttempt.verification_id ?? byAttempt.cert_id,
    }
  }

  const { data: evaluation } = await admin
    .from('evaluations')
    .select('course_id')
    .eq('id', attempt.evaluation_id)
    .maybeSingle()
  if (!evaluation) return { ok: false, reason: 'not-found' }

  // Idempotencia (b): por (user_id, course_id) — spec §1.1 "una sola por
  // user+course, aunque venga de otro intento aprobado".
  const { data: byUserCourse } = await admin
    .from('certificates')
    .select('cert_id, verification_id')
    .eq('user_id', attempt.user_id)
    .eq('course_id', evaluation.course_id)
    .neq('status', 'revoked')
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (byUserCourse) {
    return {
      ok: true,
      certId: byUserCourse.cert_id,
      verificationId: byUserCourse.verification_id ?? byUserCourse.cert_id,
    }
  }

  const { data: course } = await admin
    .from('courses')
    .select('id, title, cert_validity_days, instructor_id, duration_hours, pass_score')
    .eq('id', evaluation.course_id)
    .maybeSingle()
  if (!course) return { ok: false, reason: 'not-found' }

  const { data: professional } = await admin
    .from('users')
    .select('full_name, profession')
    .eq('id', attempt.user_id)
    .single()
  const { data: instructor } = course.instructor_id
    ? await admin
        .from('users')
        .select('full_name, profession')
        .eq('id', course.instructor_id)
        .maybeSingle()
    : { data: null }

  // Snapshot de la estructura del curso al momento de emitir
  // (SPEC-INSCRIPCIONES-SEGUIMIENTO §1.6, H5). Selects encadenados:
  // primero los módulos, luego las lecciones filtradas por module_id, para
  // no depender de embeds de PostgREST (CLAUDE.md: forma ambigua).
  const structureSnapshot = await buildCourseStructureSnapshot(admin, course.id)

  const { data: certId, error: rpcError } = await admin.rpc('generate_cert_id')
  if (rpcError || !certId) return { ok: false, reason: 'cert-id' }

  const issuedAt = new Date()
  const expiresAt = certificateExpiresAt(issuedAt, course.cert_validity_days ?? 365)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const verificationId = randomUUID()
  const verifyUrl = `${siteUrl}/verificar/${verificationId}`

  const { error: insertError } = await admin.from('certificates').insert({
    cert_id: certId,
    verification_id: verificationId,
    user_id: attempt.user_id,
    course_id: course.id,
    eval_attempt_id: attempt.id,
    score: attempt.score ?? 0,
    status: 'valid',
    expires_at: expiresAt,
    professional_name: professional?.full_name ?? 'Profesional de la salud',
    professional_profession: professional?.profession ?? null,
    instructor_name: instructor?.full_name ?? null,
    instructor_role: instructor?.profession ?? null,
    verify_url: verifyUrl,
    duration_hours: course.duration_hours,
    course_title_snapshot: course.title,
    course_pass_score_snapshot: course.pass_score,
    course_structure_snapshot: structureSnapshot as unknown as Json,
    snapshot_origin: 'live',
  })
  if (insertError) return { ok: false, reason: 'insert' }

  // Invalidación cruzada estudiante → admin: la constancia recién emitida
  // aparece en `/admin/certificados`, en la ficha del estudiante y en la
  // lista de inscritos del curso (regla CLAUDE.md). Fue el bug reproducido
  // el 07-ago (HAB-2026-0001 no aparecía sin recarga forzada).
  const { data: courseSlug } = await admin
    .from('courses')
    .select('slug')
    .eq('id', course.id)
    .maybeSingle<{ slug: string }>()
  if (courseSlug?.slug) {
    revalidateStudentActivityForAdmin(courseSlug.slug, attempt.user_id)
  } else {
    console.warn('[student→admin] emitCertificate sin slug del curso:', course.id)
  }

  await sendCertificateEmail({
    to: user.email ?? '',
    professionalName: professional?.full_name ?? 'Profesional',
    courseTitle: course.title,
    score: attempt.score ?? 0,
    expiresAt,
    certId,
    verifyUrl,
  })

  return { ok: true, certId, verificationId }
}
