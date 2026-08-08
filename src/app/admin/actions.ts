'use server'

import {
  countActiveEnrollments,
  courseIdForEvaluation,
  courseIdForLesson,
  courseIdForModule,
  courseIdForQuestion,
} from '@/lib/enrollments-admin'
import { getPublishChecklist } from '@/lib/publish-checklist'
import { getAdminUser } from '@/lib/require-admin'
import {
  revalidateAdminAll,
  revalidateCourse,
  revalidateLesson,
  revalidateStructure,
  revalidateVerify,
} from '@/lib/revalidate-admin'
import { slugify } from '@/lib/slug'
import { createAdminClient } from '@/lib/supabase/admin'

// Lookups mínimos para resolver el slug del curso desde ids intermedios.
// Necesarios para invalidar el Router Cache tras una mutación cuando el
// action recibe moduleId o lessonId en vez del slug (SPEC-FIX-CACHE-ADMIN §1.2).
//
// Se resuelven encadenando selects de columnas directas en vez de recursos
// embebidos (`courses!inner(slug)`): la forma que PostgREST devuelve para un
// embed depende de cómo detecte la cardinalidad de la relación y puede llegar
// como array. El genérico de maybeSingle<> es una anotación de tipos, no una
// validación en runtime, así que un array hacía que `data.courses.slug` fuera
// undefined, la función devolviera null y la invalidación se saltara en
// silencio. Los selects directos no tienen esa ambigüedad.
//
// Los logs convierten un fallo silencioso en uno visible: si la invalidación
// no ocurre, queda constancia en la terminal del servidor.
async function slugForCourseId(
  admin: ReturnType<typeof createAdminClient>,
  courseId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('courses')
    .select('slug')
    .eq('id', courseId)
    .maybeSingle<{ slug: string }>()
  if (error) {
    console.error('[revalidate] slugForCourseId falló:', courseId, error.message)
    return null
  }
  if (!data?.slug) {
    console.warn('[revalidate] slugForCourseId sin resultado para:', courseId)
    return null
  }
  return data.slug
}

async function slugForModuleId(
  admin: ReturnType<typeof createAdminClient>,
  moduleId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('modules')
    .select('course_id')
    .eq('id', moduleId)
    .maybeSingle<{ course_id: string }>()
  if (error) {
    console.error('[revalidate] slugForModuleId falló:', moduleId, error.message)
    return null
  }
  if (!data?.course_id) {
    console.warn('[revalidate] slugForModuleId sin course_id para:', moduleId)
    return null
  }
  return slugForCourseId(admin, data.course_id)
}

async function slugForLessonId(
  admin: ReturnType<typeof createAdminClient>,
  lessonId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('lessons')
    .select('module_id')
    .eq('id', lessonId)
    .maybeSingle<{ module_id: string }>()
  if (error) {
    console.error('[revalidate] slugForLessonId falló:', lessonId, error.message)
    return null
  }
  if (!data?.module_id) {
    console.warn('[revalidate] slugForLessonId sin module_id para:', lessonId)
    return null
  }
  return slugForModuleId(admin, data.module_id)
}

/**
 * Devuelve un slug único en public.courses partiendo de `base`. Si está libre
 * lo retorna tal cual; si no, anexa -2, -3… hasta encontrar uno disponible.
 * TOCTOU aceptable en flujo admin de baja concurrencia; la UNIQUE constraint
 * de la columna es el cerrojo final.
 */
async function nextUniqueSlug(
  admin: ReturnType<typeof createAdminClient>,
  base: string,
): Promise<string> {
  let candidate = base
  let n = 2
  while (true) {
    const { data } = await admin
      .from('courses')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (!data) return candidate
    candidate = `${base}-${n++}`
  }
}

type Result = { ok: boolean; error?: string }

/**
 * Resultado extendido para `setPublished(false)` y `archiveCourse`
 * (SPEC-INSCRIPCIONES-SEGUIMIENTO §1.3 v1.2). Son las únicas operaciones
 * que sobreviven al cambio de política: la primera avisa al despublicar,
 * la segunda confirma al archivar.
 */
type GuardedResult = Result & {
  requiresConfirmation?: boolean
  activeCount?: number
}

/**
 * Bloqueo de contenido para cursos publicados
 * (SPEC-INSCRIPCIONES-SEGUIMIENTO §1.3 v1.2).
 *
 * Regla: un curso publicado no admite modificaciones de contenido —
 * módulos, lecciones, texto, medios, banco de preguntas o config de
 * evaluación. La revisión de contenido es responsabilidad previa a
 * publicar. Para editar hay que despublicar primero.
 *
 * Se resuelve leyendo `courses.published` por id. Si `courseId` no se
 * puede resolver desde la id intermedia (módulo/lección/pregunta huérfana),
 * no bloqueamos: es defensivo y evita convertir fallos de lookup en
 * rechazos silenciosos que confundan al admin. En la práctica los actions
 * también validan la existencia del recurso más adelante.
 */
async function refuseIfPublished(
  admin: ReturnType<typeof createAdminClient>,
  courseId: string | null,
): Promise<Result | null> {
  if (!courseId) return null
  const { data } = await admin
    .from('courses')
    .select('published')
    .eq('id', courseId)
    .maybeSingle<{ published: boolean }>()
  if (data?.published) {
    return {
      ok: false,
      error:
        'El curso está publicado. Para modificar su contenido, despublícalo primero desde el panel del curso.',
    }
  }
  return null
}

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
  if (!input.title.trim()) {
    return { ok: false, error: 'El título es obligatorio.' }
  }
  // El slug se normaliza en el servidor (fuente de verdad); el form lo
  // muestra preview-normalizado pero el servidor reaplica para garantizar
  // que la URL sea URL-safe y coincida con el redirect tras crear.
  const base = slugify(input.slug || input.title)
  if (!base) {
    return { ok: false, error: 'No se pudo generar un slug a partir del título.' }
  }
  const admin = createAdminClient()
  const slug = await nextUniqueSlug(admin, base)
  const { error } = await admin.from('courses').insert({
    slug,
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
  revalidateCourse(slug)
  return { ok: true, slug }
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
  revalidateCourse(input.slug)
  return { ok: true }
}

/**
 * Soft-delete del curso (SPEC-CURSOS-ESTRUCTURA §1 +
 * SPEC-INSCRIPCIONES-SEGUIMIENTO §1.3 CA-10). Requiere: borrador y sin
 * constancias emitidas. Si además hay inscritos activos, pide confirmación
 * explícita (`opts.confirmed=true`) para no archivar por accidente un curso
 * que gente está cursando. Reversible vía restoreCourse.
 */
export async function archiveCourse(
  courseId: string,
  opts: { confirmed?: boolean } = {},
): Promise<GuardedResult> {
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
  const { count: certs } = await admin
    .from('certificates')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)
  if (certs && certs > 0) {
    return { ok: false, error: 'El curso tiene constancias emitidas; no se puede archivar.' }
  }
  if (!opts.confirmed) {
    const active = await countActiveEnrollments(admin, courseId)
    if (active > 0) return { ok: false, requiresConfirmation: true, activeCount: active }
  }
  const now = new Date().toISOString()
  const { error } = await admin
    .from('courses')
    .update({ archived_at: now, updated_at: now })
    .eq('id', courseId)
  if (error) return { ok: false, error: error.message }
  const slug = await slugForCourseId(admin, courseId)
  if (slug) revalidateCourse(slug)
  else revalidateAdminAll()
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
  const slug = await slugForCourseId(admin, courseId)
  if (slug) revalidateCourse(slug)
  else revalidateAdminAll()
  return { ok: true }
}

export async function setPublished(
  courseId: string,
  published: boolean,
  opts: { confirmed?: boolean } = {},
): Promise<GuardedResult> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()

  // SPEC-PUBLICACION-CONSTANCIAS §2 CA-2: publicar exige checklist completo.
  // Despublicar retira del catálogo pero no borra datos; SPEC-INSCRIPCIONES-
  // SEGUIMIENTO §1.3 (G5): con inscritos activos pide confirmación para no
  // reproducir el incidente del 07-ago.
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
  } else if (!opts.confirmed) {
    const active = await countActiveEnrollments(admin, courseId)
    if (active > 0) return { ok: false, requiresConfirmation: true, activeCount: active }
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
  const slug = await slugForCourseId(admin, courseId)
  if (slug) revalidateCourse(slug)
  else revalidateAdminAll()
  return { ok: true }
}

export async function createModule(courseId: string, title: string): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  if (!title.trim()) return { ok: false, error: 'El título es obligatorio.' }
  const admin = createAdminClient()
  const guard = await refuseIfPublished(admin, courseId)
  if (guard) return guard
  const { count } = await admin
    .from('modules')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)
  const { error } = await admin
    .from('modules')
    .insert({ course_id: courseId, title: title.trim(), order_index: (count ?? 0) + 1 })
  if (error) return { ok: false, error: error.message }
  const slug = await slugForCourseId(admin, courseId)
  if (slug) revalidateStructure(slug)
  return { ok: true }
}

export async function updateModule(moduleId: string, title: string): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  if (!title.trim()) return { ok: false, error: 'El título es obligatorio.' }
  const admin = createAdminClient()
  const guard = await refuseIfPublished(admin, await courseIdForModule(admin, moduleId))
  if (guard) return guard
  const { error } = await admin
    .from('modules')
    .update({ title: title.trim() })
    .eq('id', moduleId)
  if (error) return { ok: false, error: error.message }
  const slug = await slugForModuleId(admin, moduleId)
  if (slug) revalidateStructure(slug)
  return { ok: true }
}

/**
 * Reordena un módulo intercambiando su `order_index` con el vecino en la
 * dirección indicada. No hay constraint único en (course_id, order_index),
 * por lo que el swap en dos updates funciona sin colisión.
 *
 * SPEC-INSCRIPCIONES-SEGUIMIENTO §1.3 v1.2: bloqueado mientras el curso
 * esté publicado. El riesgo residual para estudiantes existentes se elimina
 * en §1.7 (una lección ya completada permanece accesible).
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

  const guard = await refuseIfPublished(admin, target.course_id)
  if (guard) return guard

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
  const slug = await slugForCourseId(admin, target.course_id)
  if (slug) revalidateStructure(slug)
  return { ok: true }
}

export async function deleteModule(moduleId: string): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const courseId = await courseIdForModule(admin, moduleId)
  const guard = await refuseIfPublished(admin, courseId)
  if (guard) return guard
  // Resolvemos slug antes del delete: después el join sería imposible.
  const slug = await slugForModuleId(admin, moduleId)
  const { error } = await admin.from('modules').delete().eq('id', moduleId)
  if (error) return { ok: false, error: error.message }
  if (slug) revalidateStructure(slug)
  return { ok: true }
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
  const guard = await refuseIfPublished(admin, await courseIdForModule(admin, moduleId))
  if (guard) return guard
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
  const slug = await slugForModuleId(admin, moduleId)
  if (slug) revalidateStructure(slug)
  return { ok: true }
}

/**
 * Edita los campos de estructura de una lección (título + tipo).
 * Los campos de contenido (content_r2_key, transcript, duration_min) los maneja
 * el Bloque 2, no este action.
 *
 * SPEC-INSCRIPCIONES-SEGUIMIENTO §1.3 v1.2: bloqueado si el curso está
 * publicado, independientemente del campo modificado.
 */
export async function updateLesson(
  lessonId: string,
  input: { title: string; content_type: string },
): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  if (!input.title.trim()) return { ok: false, error: 'El título es obligatorio.' }
  const admin = createAdminClient()

  const guard = await refuseIfPublished(admin, await courseIdForLesson(admin, lessonId))
  if (guard) return guard

  const { error } = await admin
    .from('lessons')
    .update({ title: input.title.trim(), content_type: input.content_type })
    .eq('id', lessonId)
  if (error) return { ok: false, error: error.message }
  const slug = await slugForLessonId(admin, lessonId)
  if (slug) revalidateLesson(slug, lessonId)
  return { ok: true }
}

/**
 * Reordena una lección dentro de su módulo.
 * SPEC-INSCRIPCIONES-SEGUIMIENTO §1.3 v1.2: bloqueado si el curso está
 * publicado. La irreversibilidad del desbloqueo progresivo (§1.7) cubre
 * a los estudiantes ya avanzados una vez el curso se despublica y edita.
 */
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

  const guard = await refuseIfPublished(admin, await courseIdForLesson(admin, lessonId))
  if (guard) return guard

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
  const slug = await slugForLessonId(admin, lessonId)
  if (slug) revalidateStructure(slug)
  return { ok: true }
}

export async function deleteLesson(lessonId: string): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const courseId = await courseIdForLesson(admin, lessonId)
  const guard = await refuseIfPublished(admin, courseId)
  if (guard) return guard
  // Resolvemos slug antes del delete: después el join sería imposible.
  const slug = await slugForLessonId(admin, lessonId)
  const { error } = await admin.from('lessons').delete().eq('id', lessonId)
  if (error) return { ok: false, error: error.message }
  if (slug) revalidateStructure(slug)
  return { ok: true }
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
  /**
   * Etiqueta de módulo para la práctica formativa
   * (SPEC-PRACTICA-POR-MODULO §1.1). `null` = "sin etiquetar" — la pregunta
   * solo entra en la evaluación final. Debe pertenecer al MISMO curso que
   * la evaluación, o la validación server-side la rechaza.
   */
  module_id: string | null
}

/**
 * Verifica que `moduleId` pertenezca al mismo curso que la evaluación de
 * esa pregunta. Sin esta validación, un admin (o un YAML malformado) podría
 * etiquetar una pregunta con un módulo de otro curso; ese estado
 * inconsistente no se puede recuperar leyendo. Se rechaza en escritura,
 * no en lectura (§1.1). Selects encadenados por columna directa: primero
 * el `course_id` de la evaluación, luego el `course_id` del módulo.
 */
async function assertModuleBelongsToEvaluation(
  admin: ReturnType<typeof createAdminClient>,
  evaluationId: string,
  moduleId: string | null,
): Promise<Result | null> {
  if (moduleId == null) return null
  const { data: evaluation } = await admin
    .from('evaluations')
    .select('course_id')
    .eq('id', evaluationId)
    .maybeSingle<{ course_id: string }>()
  if (!evaluation?.course_id) return { ok: false, error: 'Evaluación no encontrada.' }
  const { data: mod } = await admin
    .from('modules')
    .select('course_id')
    .eq('id', moduleId)
    .maybeSingle<{ course_id: string }>()
  if (!mod?.course_id) return { ok: false, error: 'Módulo no encontrado.' }
  if (mod.course_id !== evaluation.course_id) {
    return {
      ok: false,
      error:
        'El módulo elegido pertenece a otro curso. Solo se puede etiquetar con un módulo del mismo curso.',
    }
  }
  return null
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
  const guard = await refuseIfPublished(admin, await courseIdForEvaluation(admin, evaluationId))
  if (guard) return guard
  const moduleGuard = await assertModuleBelongsToEvaluation(admin, evaluationId, input.module_id)
  if (moduleGuard) return moduleGuard
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
    module_id: input.module_id,
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
  const guard = await refuseIfPublished(admin, await courseIdForQuestion(admin, questionId))
  if (guard) return guard
  // Resolvemos la evaluación de la pregunta para validar module_id.
  const { data: current } = await admin
    .from('questions')
    .select('evaluation_id')
    .eq('id', questionId)
    .maybeSingle<{ evaluation_id: string }>()
  if (!current?.evaluation_id) return { ok: false, error: 'Pregunta no encontrada.' }
  const moduleGuard = await assertModuleBelongsToEvaluation(
    admin,
    current.evaluation_id,
    input.module_id,
  )
  if (moduleGuard) return moduleGuard
  const { error } = await admin
    .from('questions')
    .update({
      text: input.text.trim(),
      context: input.context.trim() || null,
      options,
      correct_option: input.correct_option,
      feedback_correct: input.feedback_correct.trim() || null,
      feedback_wrong: input.feedback_wrong.trim() || null,
      module_id: input.module_id,
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
  const guard = await refuseIfPublished(admin, await courseIdForEvaluation(admin, target.evaluation_id))
  if (guard) return guard

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
  const guard = await refuseIfPublished(admin, await courseIdForQuestion(admin, questionId))
  if (guard) return guard
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
  const guard = await refuseIfPublished(admin, courseId)
  if (guard) return guard
  const { data: evaluation } = await admin
    .from('evaluations')
    .select('id')
    .eq('course_id', courseId)
    .maybeSingle()
  if (!evaluation) return { ok: false, error: 'El curso aún no tiene evaluación.' }

  // SPEC-INSCRIPCIONES-SEGUIMIENTO §1.8 CA-26: rechazar N > banco disponible
  // con un mensaje claro. Sin esta cota el sorteo terminaría devolviendo el
  // banco entero barajado, lo cual no es lo que el admin configuró.
  const { count: bankSize } = await admin
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('evaluation_id', evaluation.id)
  const bank = bankSize ?? 0
  if (input.questions_per_attempt > bank) {
    return {
      ok: false,
      error: `Preguntas por intento (${input.questions_per_attempt}) supera el banco disponible (${bank}). Añade más preguntas o reduce el número.`,
    }
  }

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
  revalidateAdminAll()
  // Patrón dinámico: las URLs de verificación reales usan `verification_id`
  // (UUID) desde la migración 0008; el `cert_id` legible (HAB-YYYY-NNNN)
  // solo aplica a constancias legacy. Invalidar el patrón cubre ambas.
  revalidateVerify()
  return { ok: true }
}

/**
 * Desbloqueo manual de un estudiante bloqueado (F8;
 * SPEC-INSCRIPCIONES-SEGUIMIENTO §1.4). Inserta una fila en `attempt_unlocks`
 * que concede **un intento adicional** dentro de la ventana móvil. No toca
 * `eval_attempts` — el historial se preserva; `computeAttemptWindow` cuenta
 * los unlocks y agranda el techo efectivo.
 *
 * Registra `granted_by` (el admin actual) y opcionalmente una nota, lo que
 * satisface CA-17 aunque la auditoría general (área L) no exista todavía.
 */
export async function grantAttemptUnlock(input: {
  userId: string
  evaluationId: string
  note?: string
}): Promise<Result & { unlockId?: string }> {
  const currentAdmin = await getAdminUser()
  if (!currentAdmin) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('attempt_unlocks')
    .insert({
      user_id: input.userId,
      evaluation_id: input.evaluationId,
      granted_by: currentAdmin.id,
      note: input.note?.trim() || null,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? 'No se pudo desbloquear.' }
  // `revalidateAdminAll()` cubre listado, detalle, ficha del estudiante y
  // registro de constancias sin enumerar rutas hijas literales.
  revalidateAdminAll()
  return { ok: true, unlockId: data.id }
}

// ============================================================
// Categorías (Bloque 6 — SPEC-ESTUDIANTES-CLASIFICACION §1.2)
// ============================================================

const CATEGORY_SLUG_RE = /^[a-z][a-z0-9-]*$/

/**
 * Normaliza un candidato a slug: minúsculas, quita acentos, espacios y
 * caracteres no permitidos. Devuelve null si no queda nada útil.
 */
function normalizeCategorySlug(input: string): string | null {
  const base = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  if (!base || !CATEGORY_SLUG_RE.test(base)) return null
  return base
}

export async function createCategory(input: {
  label: string
  slug?: string
}): Promise<Result & { slug?: string }> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const label = input.label.trim()
  if (!label) return { ok: false, error: 'El nombre de la categoría es obligatorio.' }
  const slug = normalizeCategorySlug(input.slug?.trim() || label)
  if (!slug) {
    return { ok: false, error: 'No se pudo generar un identificador válido a partir del nombre.' }
  }
  const admin = createAdminClient()
  // Detectar colisión de slug antes del insert para dar un mensaje claro.
  const { data: existing } = await admin
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (existing) {
    return {
      ok: false,
      error: `Ya existe una categoría con el identificador "${slug}". Elige otro nombre o cambia el slug.`,
    }
  }
  // `order_index` al final: siguiente entero al máximo actual.
  const { data: last } = await admin
    .from('categories')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle<{ order_index: number }>()
  const nextIndex = (last?.order_index ?? 0) + 1
  const { error } = await admin
    .from('categories')
    .insert({ slug, label, order_index: nextIndex })
  if (error) return { ok: false, error: error.message }
  revalidateAdminAll()
  return { ok: true, slug }
}

export async function updateCategory(
  categoryId: string,
  input: { label: string },
): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const label = input.label.trim()
  if (!label) return { ok: false, error: 'El nombre de la categoría es obligatorio.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('categories')
    .update({ label })
    .eq('id', categoryId)
  if (error) return { ok: false, error: error.message }
  revalidateAdminAll()
  return { ok: true }
}

export async function deleteCategory(categoryId: string): Promise<Result & { usedBy?: number }> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  const admin = createAdminClient()
  const { data: category } = await admin
    .from('categories')
    .select('slug')
    .eq('id', categoryId)
    .maybeSingle<{ slug: string }>()
  if (!category) return { ok: false, error: 'Categoría no encontrada.' }
  // SPEC-ESTUDIANTES-CLASIFICACION §1.2 + §2 CA-10: rechazar si hay cursos
  // usando la categoría, incluidos los archivados (siguen apuntándola).
  const { count } = await admin
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .eq('category', category.slug)
  const usedBy = count ?? 0
  if (usedBy > 0) {
    return {
      ok: false,
      error: `No se puede eliminar: la usa${usedBy === 1 ? '' : 'n'} ${usedBy} curso${usedBy === 1 ? '' : 's'}. Reasígnalos primero.`,
      usedBy,
    }
  }
  const { error } = await admin.from('categories').delete().eq('id', categoryId)
  if (error) return { ok: false, error: error.message }
  revalidateAdminAll()
  return { ok: true }
}

/**
 * Actualiza `duration_min` de una lección (SPEC-ESTUDIANTES-CLASIFICACION §1.6).
 * Sujeto a la política de inmutabilidad del Bloque 5: bloqueado en cursos
 * publicados. `null` o valor vacío borra el dato.
 */
export async function updateLessonDuration(
  lessonId: string,
  durationMin: number | null,
): Promise<Result> {
  if (!(await ensureAdmin())) return { ok: false, error: 'No autorizado.' }
  if (durationMin != null) {
    if (!Number.isInteger(durationMin) || durationMin < 0 || durationMin > 600) {
      return { ok: false, error: 'La duración debe ser un entero entre 0 y 600 minutos.' }
    }
  }
  const admin = createAdminClient()
  const guard = await refuseIfPublished(admin, await courseIdForLesson(admin, lessonId))
  if (guard) return guard
  const { error } = await admin
    .from('lessons')
    .update({ duration_min: durationMin })
    .eq('id', lessonId)
  if (error) return { ok: false, error: error.message }
  const slug = await slugForLessonId(admin, lessonId)
  if (slug) revalidateLesson(slug, lessonId)
  return { ok: true }
}
