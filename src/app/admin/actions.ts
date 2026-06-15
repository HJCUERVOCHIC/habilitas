'use server'

import { revalidatePath } from 'next/cache'

import { getAdminUser } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

type Result = { ok: boolean; error?: string }

export interface CourseInput {
  slug: string
  title: string
  subtitle: string
  description: string
  category: string
  difficulty: string
  duration_hours: number | null
  cert_validity_days: number
  pass_score: number
  max_attempts: number
  learning_objectives: string[]
}

async function ensureAdmin(): Promise<boolean> {
  return (await getAdminUser()) !== null
}

export async function createCourse(input: CourseInput): Promise<Result & { slug?: string }> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  if (!input.slug.trim() || !input.title.trim()) {
    return { ok: false, error: 'Slug y título son obligatorios.' }
  }
  const admin = createAdminClient()
  const { error } = await admin.from('courses').insert({
    slug: input.slug.trim(),
    title: input.title.trim(),
    subtitle: input.subtitle.trim() || null,
    description: input.description.trim() || null,
    category: input.category,
    difficulty: input.difficulty || null,
    duration_hours: input.duration_hours,
    cert_validity_days: input.cert_validity_days,
    pass_score: input.pass_score,
    max_attempts: input.max_attempts,
    learning_objectives: input.learning_objectives,
    published: false,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/cursos')
  return { ok: true, slug: input.slug.trim() }
}

export async function updateCourse(courseId: string, input: CourseInput): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('courses')
    .update({
      title: input.title.trim(),
      subtitle: input.subtitle.trim() || null,
      description: input.description.trim() || null,
      category: input.category,
      difficulty: input.difficulty || null,
      duration_hours: input.duration_hours,
      cert_validity_days: input.cert_validity_days,
      pass_score: input.pass_score,
      max_attempts: input.max_attempts,
      learning_objectives: input.learning_objectives,
      updated_at: new Date().toISOString(),
    })
    .eq('id', courseId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/admin/cursos/${input.slug}`)
  revalidatePath('/admin/cursos')
  return { ok: true }
}

export async function setPublished(courseId: string, published: boolean): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()

  // Regla (§5.8 CA): un curso sin evaluación (con preguntas) no se publica.
  if (published) {
    const { data: evaluation } = await admin
      .from('evaluations')
      .select('id')
      .eq('course_id', courseId)
      .maybeSingle()
    if (!evaluation) {
      return { ok: false, error: 'El curso necesita una evaluación antes de publicarse.' }
    }
    const { count } = await admin
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('evaluation_id', evaluation.id)
    if (!count || count === 0) {
      return { ok: false, error: 'La evaluación necesita al menos una pregunta.' }
    }
  }

  const { error } = await admin
    .from('courses')
    .update({ published, updated_at: new Date().toISOString() })
    .eq('id', courseId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/cursos')
  revalidatePath('/certificaciones')
  return { ok: true }
}

export async function createModule(courseId: string, title: string): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  if (!title.trim()) return { ok: false, error: 'El título es obligatorio.' }
  const admin = createAdminClient()
  const { count } = await admin
    .from('modules')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)
  const { error } = await admin
    .from('modules')
    .insert({ course_id: courseId, title: title.trim(), order_index: (count ?? 0) + 1 })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/cursos')
  return { ok: true }
}

export async function deleteModule(moduleId: string): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const { error } = await admin.from('modules').delete().eq('id', moduleId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export interface LessonInput {
  title: string
  content_type: string
  content_r2_key: string
  duration_min: number | null
  transcript: string
}

export async function createLesson(moduleId: string, input: LessonInput): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  if (!input.title.trim()) return { ok: false, error: 'El título es obligatorio.' }
  const admin = createAdminClient()
  const { count } = await admin
    .from('lessons')
    .select('*', { count: 'exact', head: true })
    .eq('module_id', moduleId)
  const { error } = await admin.from('lessons').insert({
    module_id: moduleId,
    title: input.title.trim(),
    order_index: (count ?? 0) + 1,
    content_type: input.content_type,
    content_r2_key: input.content_r2_key.trim() || null,
    duration_min: input.duration_min,
    transcript: input.transcript.trim() || null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteLesson(lessonId: string): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const { error } = await admin.from('lessons').delete().eq('id', lessonId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function ensureEvaluation(courseId: string): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('evaluations')
    .select('id')
    .eq('course_id', courseId)
    .maybeSingle()
  if (existing) return { ok: true }
  const { error } = await admin
    .from('evaluations')
    .insert({ course_id: courseId, title: 'Evaluación Final' })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export interface QuestionInput {
  text: string
  context: string
  options: string[]
  correct_option: number
  feedback_correct: string
  feedback_wrong: string
}

export async function createQuestion(
  evaluationId: string,
  input: QuestionInput,
): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const options = input.options.map((o) => o.trim()).filter(Boolean)
  if (!input.text.trim()) return { ok: false, error: 'El enunciado es obligatorio.' }
  if (options.length < 2) return { ok: false, error: 'Se requieren al menos 2 opciones.' }
  if (input.correct_option < 0 || input.correct_option >= options.length) {
    return { ok: false, error: 'La opción correcta no es válida.' }
  }
  const admin = createAdminClient()
  const { count } = await admin
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('evaluation_id', evaluationId)
  const { error } = await admin.from('questions').insert({
    evaluation_id: evaluationId,
    order_index: (count ?? 0) + 1,
    text: input.text.trim(),
    context: input.context.trim() || null,
    options,
    correct_option: input.correct_option,
    feedback_correct: input.feedback_correct.trim() || null,
    feedback_wrong: input.feedback_wrong.trim() || null,
  })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function deleteQuestion(questionId: string): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const { error } = await admin.from('questions').delete().eq('id', questionId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function revokeCertificate(certId: string, reason: string): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  if (!reason.trim()) return { ok: false, error: 'La razón es obligatoria.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('certificates')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoke_reason: reason.trim() })
    .eq('cert_id', certId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/certificados')
  revalidatePath(`/verificar/${certId}`)
  return { ok: true }
}
