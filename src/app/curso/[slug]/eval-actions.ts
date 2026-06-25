'use server'

import { randomUUID } from 'node:crypto'

import { allModulesCompleted } from '@/lib/course-progress'
import { sendCertificateEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { ModuleWithLessons, ProgressMap } from '@/types/course'
import type { EvalIntro, EvalResult, EvalReviewItem, EvalStart } from '@/types/eval'
import type { Json } from '@/types/database'

/** N preguntas por intento (D4, default 10, configurable). */
const QUESTIONS_PER_ATTEMPT = 10

type SupabaseServer = ReturnType<typeof createClient>

function toOptions(value: Json): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : []
}

function toResponses(value: Json | null): Record<string, number> {
  const out: Record<string, number> = {}
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, val] of Object.entries(value)) {
      if (typeof val === 'number') out[key] = val
    }
  }
  return out
}

async function loadModulesProgress(
  supabase: SupabaseServer,
  courseId: string,
  userId: string,
): Promise<{ modules: ModuleWithLessons[]; progress: ProgressMap }> {
  const { data: modules } = await supabase
    .from('modules')
    .select('id, title, order_index')
    .eq('course_id', courseId)
    .order('order_index')
  const moduleIds = (modules ?? []).map((m) => m.id)
  const { data: lessons } = moduleIds.length
    ? await supabase
        .from('lessons')
        .select('id, title, order_index, content_type, duration_min, module_id')
        .in('module_id', moduleIds)
    : { data: [] }
  const { data: progressRows } = await supabase
    .from('lesson_progress')
    .select('lesson_id, completed, last_position')
    .eq('user_id', userId)

  const modulesWith: ModuleWithLessons[] = (modules ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    order_index: m.order_index,
    lessons: (lessons ?? [])
      .filter((l) => l.module_id === m.id)
      .map(({ id, title, order_index, content_type, duration_min }) => ({
        id,
        title,
        order_index,
        content_type,
        duration_min,
      })),
  }))
  const progress: ProgressMap = {}
  for (const row of progressRows ?? []) {
    progress[row.lesson_id] = {
      completed: row.completed ?? false,
      last_position: row.last_position ?? 0,
    }
  }
  return { modules: modulesWith, progress }
}

type Gate =
  | { ok: false; reason: EvalIntro['reason'] }
  | {
      ok: true
      userId: string
      supabase: SupabaseServer
      course: { id: string; pass_score: number; max_attempts: number; cert_validity_days: number }
      evaluationId: string
      durationMin: number
      attemptsUsed: number
      hasPassed: boolean
      bankSize: number
    }

/** Gating común: auth, inscripción, módulos completos, intentos disponibles. */
async function gate(slug: string): Promise<Gate> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'auth' }

  const { data: course } = await supabase
    .from('courses')
    .select('id, pass_score, max_attempts, cert_validity_days')
    .eq('slug', slug)
    .maybeSingle()
  if (!course) return { ok: false, reason: 'enrollment' }

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', course.id)
    .maybeSingle()
  if (!enrollment) return { ok: false, reason: 'enrollment' }

  const { modules, progress } = await loadModulesProgress(supabase, course.id, user.id)
  if (!allModulesCompleted(modules, progress)) return { ok: false, reason: 'modules' }

  const { data: evaluation } = await supabase
    .from('evaluations')
    .select('id, duration_min')
    .eq('course_id', course.id)
    .maybeSingle()
  if (!evaluation) return { ok: false, reason: 'no-bank' }

  const { count: bankSize } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('evaluation_id', evaluation.id)

  const { data: attempts } = await supabase
    .from('eval_attempts')
    .select('passed')
    .eq('user_id', user.id)
    .eq('evaluation_id', evaluation.id)

  const attemptsUsed = attempts?.length ?? 0
  const hasPassed = (attempts ?? []).some((a) => a.passed === true)

  return {
    ok: true,
    userId: user.id,
    supabase,
    course,
    evaluationId: evaluation.id,
    durationMin: evaluation.duration_min,
    attemptsUsed,
    hasPassed,
    bankSize: bankSize ?? 0,
  }
}

export async function getEvaluationState(slug: string): Promise<EvalIntro> {
  const g = await gate(slug)
  if (!g.ok) {
    return {
      durationMin: 0,
      questionCount: 0,
      passScore: 0,
      maxAttempts: 0,
      attemptsUsed: 0,
      hasPassed: false,
      bankSize: 0,
      canStart: false,
      reason: g.reason,
    }
  }

  const questionCount = Math.min(QUESTIONS_PER_ATTEMPT, g.bankSize)
  let reason: EvalIntro['reason'] = 'ok'
  if (g.hasPassed) reason = 'passed'
  else if (g.attemptsUsed >= g.course.max_attempts) reason = 'attempts'
  else if (g.bankSize === 0) reason = 'no-bank'

  return {
    durationMin: g.durationMin,
    questionCount,
    passScore: g.course.pass_score,
    maxAttempts: g.course.max_attempts,
    attemptsUsed: g.attemptsUsed,
    hasPassed: g.hasPassed,
    bankSize: g.bankSize,
    canStart: reason === 'ok',
    reason,
  }
}

export async function startAttempt(slug: string): Promise<EvalStart> {
  const g = await gate(slug)
  if (!g.ok) return { ok: false, reason: g.reason }
  if (g.hasPassed) return { ok: false, reason: 'passed' }
  if (g.attemptsUsed >= g.course.max_attempts) return { ok: false, reason: 'attempts' }
  if (g.bankSize === 0) return { ok: false, reason: 'no-bank' }

  // Sorteo de N preguntas al azar (D4).
  const { data: bank } = await g.supabase
    .from('questions')
    .select('id')
    .eq('evaluation_id', g.evaluationId)
  const ids = (bank ?? []).map((q) => q.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = ids[i]!
    const b = ids[j]!
    ids[i] = b
    ids[j] = a
  }
  const drawn = ids.slice(0, Math.min(QUESTIONS_PER_ATTEMPT, ids.length))

  const { data: attempt, error: insertError } = await g.supabase
    .from('eval_attempts')
    .insert({
      user_id: g.userId,
      evaluation_id: g.evaluationId,
      attempt_number: g.attemptsUsed + 1,
      question_ids: drawn,
    })
    .select('id, started_at')
    .single()
  if (insertError || !attempt) return { ok: false, reason: 'no-bank' }

  // Preguntas SIN correct_option (D1: no se revela durante el intento).
  const { data: questions } = await g.supabase
    .from('questions')
    .select('id, text, context, options')
    .in('id', drawn)

  const byId = new Map((questions ?? []).map((q) => [q.id, q]))
  const ordered = drawn
    .map((id, index) => {
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
    .filter((q): q is NonNullable<typeof q> => q !== null)

  return {
    ok: true,
    attemptId: attempt.id,
    startedAt: attempt.started_at,
    durationMin: g.durationMin,
    attemptNumber: g.attemptsUsed + 1,
    maxAttempts: g.course.max_attempts,
    passScore: g.course.pass_score,
    questions: ordered,
  }
}

export async function submitAttempt(
  attemptId: string,
  responses: Record<string, number>,
): Promise<EvalResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'auth' }

  const { data: attempt } = await supabase
    .from('eval_attempts')
    .select('id, evaluation_id, question_ids, started_at, submitted_at, answers, score, passed, time_spent_sec')
    .eq('id', attemptId)
    .maybeSingle()
  if (!attempt) return { ok: false, reason: 'not-found' }

  const alreadySubmitted = attempt.submitted_at !== null
  const answers = alreadySubmitted ? toResponses(attempt.answers) : responses

  // pass_score del curso.
  const { data: evaluation } = await supabase
    .from('evaluations')
    .select('course_id')
    .eq('id', attempt.evaluation_id)
    .maybeSingle()
  const { data: course } = evaluation
    ? await supabase.from('courses').select('pass_score').eq('id', evaluation.course_id).maybeSingle()
    : { data: null }
  const passScore = course?.pass_score ?? 70

  // Preguntas del sorteo CON la opción correcta (puntuación en servidor).
  const { data: questions } = attempt.question_ids.length
    ? await supabase
        .from('questions')
        .select('id, text, options, correct_option, feedback_correct, feedback_wrong')
        .in('id', attempt.question_ids)
    : { data: [] }
  const byId = new Map((questions ?? []).map((q) => [q.id, q]))

  const total = attempt.question_ids.length
  let correctCount = 0
  for (const qid of attempt.question_ids) {
    const q = byId.get(qid)
    if (q && answers[qid] === q.correct_option) correctCount++
  }
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0
  const passed = score >= passScore

  // Tiempo validado en servidor desde started_at (D7).
  const elapsed = Math.max(
    0,
    Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000),
  )
  const timeSpentSec = alreadySubmitted ? attempt.time_spent_sec ?? elapsed : elapsed

  if (!alreadySubmitted) {
    await supabase
      .from('eval_attempts')
      .update({
        score,
        passed,
        answers,
        time_spent_sec: timeSpentSec,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', attemptId)
  }

  const base = {
    ok: true as const,
    attemptId,
    score,
    passed,
    total,
    correct: correctCount,
    timeSpentSec,
  }

  if (passed) {
    // Revisión completa con explicaciones (D1).
    const review: EvalReviewItem[] = attempt.question_ids
      .map((qid) => {
        const q = byId.get(qid)
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
    return { ...base, review }
  }

  // Reprobado: solo temas a reforzar, sin respuesta literal (D1).
  const topics: string[] = []
  for (const qid of attempt.question_ids) {
    const q = byId.get(qid)
    if (q && answers[qid] !== q.correct_option) topics.push(q.text)
  }
  return { ...base, topics }
}

export async function emitCertificate(
  attemptId: string,
): Promise<{ ok: true; certId: string } | { ok: false; reason: string }> {
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

  // Idempotencia: un intento aprobado emite un solo certificado (§6.4).
  const { data: existing } = await admin
    .from('certificates')
    .select('cert_id')
    .eq('eval_attempt_id', attemptId)
    .maybeSingle()
  if (existing) return { ok: true, certId: existing.cert_id }

  const { data: evaluation } = await admin
    .from('evaluations')
    .select('course_id')
    .eq('id', attempt.evaluation_id)
    .maybeSingle()
  if (!evaluation) return { ok: false, reason: 'not-found' }
  const { data: course } = await admin
    .from('courses')
    .select('id, title, cert_validity_days, instructor_id, duration_hours')
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

  const { data: certId, error: rpcError } = await admin.rpc('generate_cert_id')
  if (rpcError || !certId) return { ok: false, reason: 'cert-id' }

  const issuedAt = new Date()
  const expiresAt = new Date(issuedAt.getTime() + course.cert_validity_days * 86_400_000)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  // Token opaco, no enumerable (SPEC-CUMPLIMIENTO-P1 §3 R9). El cert_id
  // legible se conserva para soporte; las URLs públicas usan verification_id.
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
    expires_at: expiresAt.toISOString(),
    professional_name: professional?.full_name ?? 'Profesional de la salud',
    professional_profession: professional?.profession ?? null,
    instructor_name: instructor?.full_name ?? null,
    instructor_role: instructor?.profession ?? null,
    verify_url: verifyUrl,
    duration_hours: course.duration_hours,
  })
  if (insertError) return { ok: false, reason: 'insert' }

  // Email (con fallback si Resend no está configurado).
  await sendCertificateEmail({
    to: user.email ?? '',
    professionalName: professional?.full_name ?? 'Profesional',
    courseTitle: course.title,
    score: attempt.score ?? 0,
    expiresAt: expiresAt.toISOString(),
    certId,
    verifyUrl,
  })

  return { ok: true, certId }
}
