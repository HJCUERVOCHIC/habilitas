import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

/**
 * Utilidades server-only y tipos compartidos de la práctica formativa
 * (SPEC-PRACTICA-POR-MODULO). Vive fuera de `practice-actions.ts` porque
 * un módulo con `'use server'` solo puede exportar funciones async; las
 * constantes y tipos van aquí.
 */

/** Umbral mínimo para que un módulo ofrezca práctica (§4.7). */
export const PRACTICE_MIN_QUESTIONS = 3

/** Techo del sorteo por intento (§1.3). */
export const PRACTICE_MAX_QUESTIONS = 10

export interface PracticeQuestionForClient {
  id: string
  text: string
  context: string | null
  options: string[]
}

export type PracticeStart =
  | {
      ok: true
      attemptId: string
      questionIds: string[]
      firstQuestion: PracticeQuestionForClient
      total: number
      moduleTitle: string
    }
  | { ok: false; reason: 'auth' | 'enrollment' | 'not-found' | 'no-bank' }

export type PracticeAnswerNext =
  | { done: false; question: PracticeQuestionForClient; index: number }
  | { done: true; correctCount: number; total: number }

export type PracticeAnswer =
  | {
      ok: true
      correct: boolean
      correctOption: number
      explanation: string | null
      next: PracticeAnswerNext
    }
  | { ok: false; reason: 'auth' | 'not-found' | 'invalid' }

type SupabaseAdmin = ReturnType<typeof createAdminClient>

export function toOptions(value: Json): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : []
}

/**
 * Cuenta preguntas etiquetadas para un módulo. Se usa en la página del
 * reproductor para decidir si mostrar "Practicar" (§1.4 CA-5/6).
 */
export async function countModuleQuestions(
  admin: SupabaseAdmin,
  evaluationId: string,
  moduleId: string,
): Promise<number> {
  const { count } = await admin
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('evaluation_id', evaluationId)
    .eq('module_id', moduleId)
  return count ?? 0
}

/**
 * Proyección explícita: NUNCA `correct_option` (§1.3). Duplicada respecto
 * a `loadQuestionsForClient` de eval-actions.ts a propósito — no
 * compartimos helper para no arrastrar cambios de una superficie a la otra
 * sin querer.
 */
export async function loadPracticeQuestionForClient(
  admin: SupabaseAdmin,
  questionId: string,
): Promise<PracticeQuestionForClient | null> {
  const { data } = await admin
    .from('questions')
    .select('id, text, context, options')
    .eq('id', questionId)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    text: data.text,
    context: data.context,
    options: toOptions(data.options),
  }
}
