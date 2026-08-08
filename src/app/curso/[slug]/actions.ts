'use server'

import { isLessonAccessible, isVideoCompletionValid } from '@/lib/course-progress'
import { getSignedLessonUrl } from '@/lib/r2'
import { revalidateStudentActivityForAdmin } from '@/lib/revalidate-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { ModuleWithLessons, ProgressMap } from '@/types/course'

/**
 * Resuelve el slug del curso al que pertenece una lección. Se usa para
 * invalidar rutas de admin cuando el estudiante marca progreso o envía un
 * intento (regla de invalidación cruzada, CLAUDE.md).
 *
 * Selects de columnas directas encadenados (no embeds de PostgREST) y
 * logs en los caminos de fallo para no dejar silenciada una invalidación
 * omitida.
 */
async function slugForLessonFromStudent(lessonId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data: lesson, error: lessonErr } = await admin
    .from('lessons')
    .select('module_id')
    .eq('id', lessonId)
    .maybeSingle<{ module_id: string }>()
  if (lessonErr) {
    console.error('[student→admin] slugForLessonFromStudent(lesson):', lessonErr.message, lessonId)
    return null
  }
  if (!lesson?.module_id) {
    console.warn('[student→admin] slugForLessonFromStudent sin module_id:', lessonId)
    return null
  }
  const { data: module_, error: modErr } = await admin
    .from('modules')
    .select('course_id')
    .eq('id', lesson.module_id)
    .maybeSingle<{ course_id: string }>()
  if (modErr) {
    console.error('[student→admin] slugForLessonFromStudent(module):', modErr.message, lesson.module_id)
    return null
  }
  if (!module_?.course_id) {
    console.warn('[student→admin] slugForLessonFromStudent sin course_id:', lesson.module_id)
    return null
  }
  const { data: course, error: courseErr } = await admin
    .from('courses')
    .select('slug')
    .eq('id', module_.course_id)
    .maybeSingle<{ slug: string }>()
  if (courseErr) {
    console.error('[student→admin] slugForLessonFromStudent(course):', courseErr.message, module_.course_id)
    return null
  }
  return course?.slug ?? null
}

export type LessonContent =
  | { ok: true; kind: 'text'; markdown: string }
  | { ok: true; kind: 'signed'; url: string; contentType: string }
  | { ok: true; kind: 'unavailable'; reason: 'r2' | 'no-content'; contentType: string }
  | { ok: false; reason: 'auth' | 'enrollment' | 'locked' | 'not-found' }

type Context =
  | { error: 'auth' | 'enrollment' | 'not-found' }
  | {
      supabase: ReturnType<typeof createClient>
      userId: string
      lesson: {
        id: string
        module_id: string
        content_type: string
        content_r2_key: string | null
        body_md: string | null
      }
      modules: ModuleWithLessons[]
      progress: ProgressMap
    }

/**
 * Carga el contexto del usuario para una lección: la lección (sujeta a RLS
 * lessons_enrolled_read), el árbol de módulos del curso y el progreso del
 * usuario. Sirve para recalcular el desbloqueo en el servidor (backstop de
 * seguridad, independiente de la UI).
 */
async function loadContext(lessonId: string): Promise<Context> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  // RLS: solo lecciones de cursos en los que el usuario está inscrito.
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, module_id, content_type, content_r2_key, body_md')
    .eq('id', lessonId)
    .maybeSingle()
  if (!lesson) return { error: 'enrollment' }

  const { data: ownModule } = await supabase
    .from('modules')
    .select('course_id')
    .eq('id', lesson.module_id)
    .maybeSingle()
  if (!ownModule) return { error: 'not-found' }

  const { data: modules } = await supabase
    .from('modules')
    .select('id, title, order_index')
    .eq('course_id', ownModule.course_id)
    .order('order_index')

  const moduleIds = (modules ?? []).map((m) => m.id)
  const { data: lessons } = moduleIds.length
    ? await supabase
        .from('lessons')
        .select('id, title, order_index, content_type, duration_min, module_id')
        .in('module_id', moduleIds)
        .order('order_index')
    : { data: [] }

  const { data: progressRows } = await supabase
    .from('lesson_progress')
    .select('lesson_id, completed, last_position')
    .eq('user_id', user.id)

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

  return { supabase, userId: user.id, lesson, modules: modulesWith, progress }
}

/** Devuelve el contenido de la lección, revalidando inscripción y desbloqueo. */
export async function getLessonContent(lessonId: string): Promise<LessonContent> {
  const ctx = await loadContext(lessonId)
  if ('error' in ctx) return { ok: false, reason: ctx.error }
  if (!isLessonAccessible(ctx.modules, lessonId, ctx.progress)) {
    return { ok: false, reason: 'locked' }
  }

  const { lesson } = ctx
  if (lesson.content_type === 'text') {
    return { ok: true, kind: 'text', markdown: lesson.body_md ?? '' }
  }
  if (!lesson.content_r2_key) {
    return { ok: true, kind: 'unavailable', reason: 'no-content', contentType: lesson.content_type }
  }
  const expires = lesson.content_type === 'video' ? 3600 : 900
  const url = await getSignedLessonUrl(lesson.content_r2_key, expires)
  if (!url) {
    return { ok: true, kind: 'unavailable', reason: 'r2', contentType: lesson.content_type }
  }
  return { ok: true, kind: 'signed', url, contentType: lesson.content_type }
}

/** Marca la lección como completada (D3: botón o video ≥90%). */
export async function markLessonComplete(lessonId: string): Promise<{ ok: boolean }> {
  const ctx = await loadContext(lessonId)
  if ('error' in ctx) return { ok: false }
  if (!isLessonAccessible(ctx.modules, lessonId, ctx.progress)) return { ok: false }

  const { error } = await ctx.supabase.from('lesson_progress').upsert(
    {
      user_id: ctx.userId,
      lesson_id: lessonId,
      completed: true,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,lesson_id' },
  )
  if (error) return { ok: false }
  // Invalidación cruzada: el progreso aparece en el listado de inscritos y
  // en la ficha del estudiante en admin (regla CLAUDE.md).
  const slug = await slugForLessonFromStudent(lessonId)
  if (slug) revalidateStudentActivityForAdmin(slug, ctx.userId)
  return { ok: true }
}

/**
 * Guarda posición del video y (D3) lo marca completado solo si el cliente
 * reporta ≥90% del video. La validación ocurre server-side vía
 * `isVideoCompletionValid`; sin `durationSec` o con ratio < 0.9,
 * `completed` NO se acepta (se persiste solo last_position).
 * SPEC-REPRODUCTOR-PROGRESO §1.3 (validado en registro/servidor).
 */
export async function saveVideoProgress(
  lessonId: string,
  lastPosition: number,
  durationSec: number | null,
  completed: boolean,
): Promise<{ ok: boolean }> {
  const ctx = await loadContext(lessonId)
  if ('error' in ctx) return { ok: false }
  if (!isLessonAccessible(ctx.modules, lessonId, ctx.progress)) return { ok: false }

  const acceptCompleted = completed && isVideoCompletionValid(lastPosition, durationSec)

  const payload: {
    user_id: string
    lesson_id: string
    last_position: number
    completed?: boolean
    completed_at?: string
  } = {
    user_id: ctx.userId,
    lesson_id: lessonId,
    last_position: Math.max(0, Math.floor(lastPosition)),
  }
  if (acceptCompleted) {
    payload.completed = true
    payload.completed_at = new Date().toISOString()
  }

  const { error } = await ctx.supabase
    .from('lesson_progress')
    .upsert(payload, { onConflict: 'user_id,lesson_id' })
  if (error) return { ok: false }
  // Invalidación cruzada solo si el progreso subió a `completed`: el
  // guardado de `last_position` a solas no cambia lo que ve el admin.
  if (acceptCompleted) {
    const slug = await slugForLessonFromStudent(lessonId)
    if (slug) revalidateStudentActivityForAdmin(slug, ctx.userId)
  }
  return { ok: true }
}
