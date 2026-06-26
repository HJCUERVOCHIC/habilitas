'use server'

import { revalidatePath } from 'next/cache'

import { getPublishChecklist } from '@/lib/publish-checklist'
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

/**
 * Soft-delete del curso (SPEC-CURSOS-ESTRUCTURA §1). Solo permitido si el
 * curso es borrador y no tiene inscripciones ni constancias emitidas
 * (preserva el acceso de cualquier persona ya inscrita y la integridad de
 * constancias). Reversible vía restoreCourse.
 */
export async function archiveCourse(courseId: string): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const { data: course } = await admin
    .from('courses')
    .select('published, archived_at')
    .eq('id', courseId)
    .maybeSingle()
  if (!course) return { ok: false, error: 'Curso no encontrado.' }
  if (course.archived_at) return { ok: true }
  if (course.published) {
    return { ok: false, error: 'Despublica el curso antes de archivarlo.' }
  }
  const { count: enrollments } = await admin
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)
  if (enrollments && enrollments > 0) {
    return {
      ok: false,
      error: 'Hay personas inscritas; archivar dejaría esas inscripciones sin acceso.',
    }
  }
  const { count: certs } = await admin
    .from('certificates')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)
  if (certs && certs > 0) {
    return { ok: false, error: 'El curso tiene constancias emitidas; no se puede archivar.' }
  }
  const now = new Date().toISOString()
  const { error } = await admin
    .from('courses')
    .update({ archived_at: now, updated_at: now })
    .eq('id', courseId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/cursos')
  revalidatePath('/certificaciones')
  return { ok: true }
}

/** Restaura un curso archivado (sin UI en Bloque 1; reservado para futuro). */
export async function restoreCourse(courseId: string): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('courses')
    .update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq('id', courseId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/cursos')
  return { ok: true }
}

export async function setPublished(courseId: string, published: boolean): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()

  // SPEC-PUBLICACION-CONSTANCIAS §2 CA-2: publicar exige checklist completo.
  // Despublicar es libre (reversible y solo retira del catálogo).
  if (published) {
    const checklist = await getPublishChecklist(courseId)
    if (!checklist.canPublish) {
      const missing = checklist.items
        .filter((i) => !i.passed)
        .map((i) => i.label)
        .join(', ')
      return {
        ok: false,
        error: `El curso aún no cumple los requisitos para publicarse (${missing}). Revisa el checklist en el detalle del curso.`,
      }
    }
  }

  const now = new Date().toISOString()
  const update: { published: boolean; updated_at: string; published_at?: string } = {
    published,
    updated_at: now,
  }
  // Al publicar registramos la marca; al despublicar conservamos el histórico.
  if (published) update.published_at = now

  const { error } = await admin.from('courses').update(update).eq('id', courseId)
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

export async function updateModule(moduleId: string, title: string): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  if (!title.trim()) return { ok: false, error: 'El título es obligatorio.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('modules')
    .update({ title: title.trim() })
    .eq('id', moduleId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/**
 * Reordena un módulo intercambiando su `order_index` con el vecino en la
 * dirección indicada. No hay constraint único en (course_id, order_index),
 * por lo que el swap en dos updates funciona sin colisión.
 */
export async function reorderModule(
  moduleId: string,
  direction: 'up' | 'down',
): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const { data: target } = await admin
    .from('modules')
    .select('id, course_id, order_index')
    .eq('id', moduleId)
    .maybeSingle()
  if (!target) return { ok: false, error: 'Módulo no encontrado.' }

  const neighborQuery = admin
    .from('modules')
    .select('id, order_index')
    .eq('course_id', target.course_id)
  const { data: neighbor } =
    direction === 'up'
      ? await neighborQuery
          .lt('order_index', target.order_index)
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle()
      : await neighborQuery
          .gt('order_index', target.order_index)
          .order('order_index', { ascending: true })
          .limit(1)
          .maybeSingle()

  if (!neighbor) return { ok: true } // ya está en el extremo

  const a = await admin
    .from('modules')
    .update({ order_index: neighbor.order_index })
    .eq('id', target.id)
  if (a.error) return { ok: false, error: a.error.message }
  const b = await admin
    .from('modules')
    .update({ order_index: target.order_index })
    .eq('id', neighbor.id)
  if (b.error) return { ok: false, error: b.error.message }
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

/**
 * Edita los campos de estructura de una lección (título + tipo).
 * Los campos de contenido (content_r2_key, transcript, duration_min) los maneja
 * el Bloque 2, no este action.
 */
export async function updateLesson(
  lessonId: string,
  input: { title: string; content_type: string },
): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  if (!input.title.trim()) return { ok: false, error: 'El título es obligatorio.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('lessons')
    .update({ title: input.title.trim(), content_type: input.content_type })
    .eq('id', lessonId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function reorderLesson(
  lessonId: string,
  direction: 'up' | 'down',
): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const { data: target } = await admin
    .from('lessons')
    .select('id, module_id, order_index')
    .eq('id', lessonId)
    .maybeSingle()
  if (!target) return { ok: false, error: 'Lección no encontrada.' }

  const neighborQuery = admin
    .from('lessons')
    .select('id, order_index')
    .eq('module_id', target.module_id)
  const { data: neighbor } =
    direction === 'up'
      ? await neighborQuery
          .lt('order_index', target.order_index)
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle()
      : await neighborQuery
          .gt('order_index', target.order_index)
          .order('order_index', { ascending: true })
          .limit(1)
          .maybeSingle()

  if (!neighbor) return { ok: true }

  const a = await admin
    .from('lessons')
    .update({ order_index: neighbor.order_index })
    .eq('id', target.id)
  if (a.error) return { ok: false, error: a.error.message }
  const b = await admin
    .from('lessons')
    .update({ order_index: target.order_index })
    .eq('id', neighbor.id)
  if (b.error) return { ok: false, error: b.error.message }
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

export async function updateQuestion(
  questionId: string,
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
  const { error } = await admin
    .from('questions')
    .update({
      text: input.text.trim(),
      context: input.context.trim() || null,
      options,
      correct_option: input.correct_option,
      feedback_correct: input.feedback_correct.trim() || null,
      feedback_wrong: input.feedback_wrong.trim() || null,
    })
    .eq('id', questionId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function reorderQuestion(
  questionId: string,
  direction: 'up' | 'down',
): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const { data: target } = await admin
    .from('questions')
    .select('id, evaluation_id, order_index')
    .eq('id', questionId)
    .maybeSingle()
  if (!target) return { ok: false, error: 'Pregunta no encontrada.' }

  const neighborQuery = admin
    .from('questions')
    .select('id, order_index')
    .eq('evaluation_id', target.evaluation_id)
  const { data: neighbor } =
    direction === 'up'
      ? await neighborQuery
          .lt('order_index', target.order_index)
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle()
      : await neighborQuery
          .gt('order_index', target.order_index)
          .order('order_index', { ascending: true })
          .limit(1)
          .maybeSingle()

  if (!neighbor) return { ok: true }

  const a = await admin
    .from('questions')
    .update({ order_index: neighbor.order_index })
    .eq('id', target.id)
  if (a.error) return { ok: false, error: a.error.message }
  const b = await admin
    .from('questions')
    .update({ order_index: target.order_index })
    .eq('id', neighbor.id)
  if (b.error) return { ok: false, error: b.error.message }
  return { ok: true }
}

export async function deleteQuestion(questionId: string): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const { error } = await admin.from('questions').delete().eq('id', questionId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/**
 * Configura la evaluación del curso (SPEC-EVALUACION-BANCO §1):
 * questions_per_attempt vive en `evaluations`; pass_score (nota mínima) en
 * `courses`. Una sola acción atómica para el admin.
 */
export async function setEvaluationConfig(
  courseId: string,
  input: { questions_per_attempt: number; pass_score: number },
): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  if (!Number.isInteger(input.questions_per_attempt) || input.questions_per_attempt < 1) {
    return { ok: false, error: 'Preguntas por intento debe ser un entero ≥ 1.' }
  }
  if (
    !Number.isInteger(input.pass_score) ||
    input.pass_score < 0 ||
    input.pass_score > 100
  ) {
    return { ok: false, error: 'La nota mínima debe ser un entero entre 0 y 100.' }
  }
  const admin = createAdminClient()
  const { data: evaluation } = await admin
    .from('evaluations')
    .select('id')
    .eq('course_id', courseId)
    .maybeSingle()
  if (!evaluation) return { ok: false, error: 'El curso aún no tiene evaluación.' }

  const evalUpdate = await admin
    .from('evaluations')
    .update({ questions_per_attempt: input.questions_per_attempt })
    .eq('id', evaluation.id)
  if (evalUpdate.error) return { ok: false, error: evalUpdate.error.message }

  const courseUpdate = await admin
    .from('courses')
    .update({ pass_score: input.pass_score, updated_at: new Date().toISOString() })
    .eq('id', courseId)
  if (courseUpdate.error) return { ok: false, error: courseUpdate.error.message }
  return { ok: true }
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
