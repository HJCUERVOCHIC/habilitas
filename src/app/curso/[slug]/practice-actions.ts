'use server'

import { drawRandomIds } from '@/lib/evaluation'
import {
  loadPracticeQuestionForClient,
  PRACTICE_MAX_QUESTIONS,
  PRACTICE_MIN_QUESTIONS,
  toOptions,
  type PracticeAnswer,
  type PracticeStart,
} from '@/lib/practice'
import { revalidateStudentActivityForAdmin } from '@/lib/revalidate-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

/**
 * Actions server-only del runtime de práctica formativa
 * (SPEC-PRACTICA-POR-MODULO §1.3). Este módulo solo puede exportar
 * funciones async (`'use server'`); las constantes y tipos viven en
 * `src/lib/practice.ts`.
 *
 * Diseño clave del aislamiento con la evaluación final:
 *   - Escribe en `practice_attempts`, NUNCA en `eval_attempts`. Un olvido
 *     de filtro sobre `eval_attempts` bloquearía la final: la spec §1.2
 *     escoge tabla aparte para que ese error sea imposible.
 *   - `correct_option` NO viaja al cliente por adelantado (§1.3): el
 *     estudiante responde una pregunta y solo entonces el servidor
 *     devuelve la correcta.
 */

type SupabaseAdmin = ReturnType<typeof createAdminClient>

async function loadContext(slug: string, moduleId: string): Promise<
  | { ok: false; reason: 'auth' | 'enrollment' | 'not-found' }
  | {
      ok: true
      admin: SupabaseAdmin
      supabase: ReturnType<typeof createClient>
      userId: string
      courseId: string
      module: { id: string; title: string; course_id: string }
      evaluationId: string
    }
> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'auth' }

  const admin = createAdminClient()
  const { data: course } = await admin
    .from('courses')
    .select('id')
    .eq('slug', slug)
    .maybeSingle<{ id: string }>()
  if (!course) return { ok: false, reason: 'not-found' }

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', course.id)
    .maybeSingle()
  if (!enrollment) return { ok: false, reason: 'enrollment' }

  const { data: module_ } = await admin
    .from('modules')
    .select('id, title, course_id')
    .eq('id', moduleId)
    .maybeSingle<{ id: string; title: string; course_id: string }>()
  if (!module_ || module_.course_id !== course.id) {
    return { ok: false, reason: 'not-found' }
  }

  const { data: evaluation } = await admin
    .from('evaluations')
    .select('id')
    .eq('course_id', course.id)
    .maybeSingle<{ id: string }>()
  if (!evaluation) return { ok: false, reason: 'not-found' }

  return {
    ok: true,
    admin,
    supabase,
    userId: user.id,
    courseId: course.id,
    module: module_,
    evaluationId: evaluation.id,
  }
}

/**
 * Inicia una práctica: sortea hasta 10 preguntas del subconjunto etiquetado
 * y devuelve la primera. NO revela `correct_option`.
 */
export async function startPractice(input: {
  slug: string
  moduleId: string
}): Promise<PracticeStart> {
  const ctx = await loadContext(input.slug, input.moduleId)
  if (!ctx.ok) return { ok: false, reason: ctx.reason }

  const { data: pool } = await ctx.admin
    .from('questions')
    .select('id')
    .eq('evaluation_id', ctx.evaluationId)
    .eq('module_id', input.moduleId)
  const bank = (pool ?? []).map((q) => q.id)
  if (bank.length < PRACTICE_MIN_QUESTIONS) return { ok: false, reason: 'no-bank' }

  const drawn = drawRandomIds(bank, PRACTICE_MAX_QUESTIONS)

  const { data: attempt, error } = await ctx.supabase
    .from('practice_attempts')
    .insert({
      user_id: ctx.userId,
      course_id: ctx.courseId,
      module_id: ctx.module.id,
      total_questions: drawn.length,
      correct_count: 0,
    })
    .select('id')
    .single()
  if (error || !attempt) return { ok: false, reason: 'no-bank' }

  const firstId = drawn[0]
  if (!firstId) return { ok: false, reason: 'no-bank' }
  const firstQuestion = await loadPracticeQuestionForClient(ctx.admin, firstId)
  if (!firstQuestion) return { ok: false, reason: 'no-bank' }

  return {
    ok: true,
    attemptId: attempt.id,
    questionIds: drawn,
    firstQuestion,
    total: drawn.length,
    moduleTitle: ctx.module.title,
  }
}

/**
 * Registra la respuesta del estudiante, incrementa `correct_count` si
 * corresponde y devuelve la corrección + la siguiente pregunta (o fin).
 * `correct_option` se lee con el admin client aquí, no antes.
 */
export async function answerPracticeQuestion(input: {
  attemptId: string
  questionIds: string[]
  currentIndex: number
  questionId: string
  selectedOption: number
}): Promise<PracticeAnswer> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'auth' }

  const { data: attempt } = await supabase
    .from('practice_attempts')
    .select('id, user_id, module_id, course_id, finished_at, correct_count')
    .eq('id', input.attemptId)
    .maybeSingle<{
      id: string
      user_id: string
      module_id: string
      course_id: string
      finished_at: string | null
      correct_count: number
    }>()
  if (!attempt || attempt.user_id !== user.id) {
    return { ok: false, reason: 'not-found' }
  }
  if (attempt.finished_at !== null) {
    return { ok: false, reason: 'not-found' }
  }

  if (
    input.currentIndex < 0 ||
    input.currentIndex >= input.questionIds.length ||
    input.questionIds[input.currentIndex] !== input.questionId
  ) {
    return { ok: false, reason: 'invalid' }
  }
  if (!Number.isInteger(input.selectedOption) || input.selectedOption < 0) {
    return { ok: false, reason: 'invalid' }
  }

  const admin = createAdminClient()
  const { data: question } = await admin
    .from('questions')
    .select('correct_option, options, feedback_correct, feedback_wrong')
    .eq('id', input.questionId)
    .maybeSingle<{
      correct_option: number
      options: Json
      feedback_correct: string | null
      feedback_wrong: string | null
    }>()
  if (!question) return { ok: false, reason: 'not-found' }

  const optionsCount = toOptions(question.options).length
  if (input.selectedOption >= optionsCount) return { ok: false, reason: 'invalid' }

  const isCorrect = input.selectedOption === question.correct_option
  const nextCorrectCount = attempt.correct_count + (isCorrect ? 1 : 0)
  const isLast = input.currentIndex === input.questionIds.length - 1

  const payload: {
    correct_count: number
    finished_at?: string
  } = { correct_count: nextCorrectCount }
  if (isLast) payload.finished_at = new Date().toISOString()

  const { error } = await supabase
    .from('practice_attempts')
    .update(payload)
    .eq('id', input.attemptId)
  if (error) return { ok: false, reason: 'not-found' }

  // Invalidación cruzada estudiante→admin al cierre del intento
  // (CLAUDE.md). Slug resuelto por select encadenado, sin embed.
  if (isLast) {
    const { data: courseRow } = await admin
      .from('courses')
      .select('slug')
      .eq('id', attempt.course_id)
      .maybeSingle<{ slug: string }>()
    if (courseRow?.slug) revalidateStudentActivityForAdmin(courseRow.slug, user.id)
  }

  const explanation = isCorrect ? question.feedback_correct : question.feedback_wrong

  if (isLast) {
    return {
      ok: true,
      correct: isCorrect,
      correctOption: question.correct_option,
      explanation,
      next: { done: true, correctCount: nextCorrectCount, total: input.questionIds.length },
    }
  }

  const nextId = input.questionIds[input.currentIndex + 1]
  if (!nextId) return { ok: false, reason: 'invalid' }
  const nextQuestion = await loadPracticeQuestionForClient(admin, nextId)
  if (!nextQuestion) return { ok: false, reason: 'not-found' }

  return {
    ok: true,
    correct: isCorrect,
    correctOption: question.correct_option,
    explanation,
    next: { done: false, question: nextQuestion, index: input.currentIndex + 1 },
  }
}
