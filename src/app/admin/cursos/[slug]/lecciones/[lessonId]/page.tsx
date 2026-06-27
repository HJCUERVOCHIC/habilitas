import Link from 'next/link'
import { notFound } from 'next/navigation'

import { LessonEditor } from '@/components/admin/LessonEditor'
import { isR2Configured } from '@/lib/r2'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface JoinedLesson {
  id: string
  module_id: string
  title: string
  content_type: string
  body_md: string | null
  content_r2_key: string | null
  content_original_name: string | null
  content_mime_type: string | null
  content_size_bytes: number | null
  modules: {
    title: string
    course_id: string
    courses: {
      id: string
      slug: string
      title: string
    } | null
  } | null
}

/**
 * Detalle/edición de contenido de una lección bajo /admin/cursos/[slug].
 *
 * La consulta es UNA sola query con join embebido `lessons → modules →
 * courses` (PostgREST `!inner`), filtrada por `lesson.id` y por el `slug`
 * del curso. Devuelve null si CUALQUIER eslabón falla, lo que elimina la
 * ventana de tres round-trips que tenía la versión anterior y atomiza el
 * chequeo de pertenencia. Si vuelve a aparecer un 404 inesperado, los
 * console.error de abajo dejan rastro server-side con el detalle exacto.
 */
export default async function EditarLeccionPage({
  params,
}: {
  params: { slug: string; lessonId: string }
}) {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('lessons')
    .select(
      `
      id, module_id, title, content_type, body_md,
      content_r2_key, content_original_name, content_mime_type, content_size_bytes,
      modules!inner (
        title, course_id,
        courses!inner ( id, slug, title )
      )
      `,
    )
    .eq('id', params.lessonId)
    .eq('modules.courses.slug', params.slug)
    .maybeSingle<JoinedLesson>()

  if (error) {
    console.error('[admin/cursos/lecciones] error en consulta:', error.message, {
      slug: params.slug,
      lessonId: params.lessonId,
    })
    notFound()
  }

  if (!data) {
    console.error('[admin/cursos/lecciones] lección no encontrada o no pertenece al curso', {
      slug: params.slug,
      lessonId: params.lessonId,
    })
    notFound()
  }

  const course = data.modules?.courses
  const module_ = data.modules
  if (!course || !module_) {
    console.error('[admin/cursos/lecciones] cadena lección→módulo→curso rota', {
      slug: params.slug,
      lessonId: params.lessonId,
      hasModule: Boolean(module_),
      hasCourse: Boolean(course),
    })
    notFound()
  }

  return (
    <div>
      <Link
        href={`/admin/cursos/${course.slug}/modulos`}
        className="text-sm text-teal hover:text-teal-light"
      >
        ← Módulos y lecciones
      </Link>
      <h1 className="mb-1 mt-2 font-display text-display-md text-charcoal">{data.title}</h1>
      <p className="mb-6 text-sm text-ink-soft">
        {course.title} · {module_.title}
      </p>
      <LessonEditor
        lesson={{
          id: data.id,
          title: data.title,
          content_type: data.content_type,
          body_md: data.body_md ?? '',
          content_r2_key: data.content_r2_key,
          content_original_name: data.content_original_name,
          content_mime_type: data.content_mime_type,
          content_size_bytes: data.content_size_bytes,
        }}
        r2Configured={isR2Configured()}
      />
    </div>
  )
}
