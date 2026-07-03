import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { notFound } from 'next/navigation'

import { ArchiveCourseButton } from '@/components/admin/ArchiveCourseButton'
import { CourseForm } from '@/components/admin/CourseForm'
import { PublishPanel } from '@/components/admin/PublishPanel'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CourseInput } from '@/app/admin/actions'

// Triple opt-out del cache de Next para el detalle admin de un curso.
// `force-dynamic` + `revalidate=0` + `fetchCache='force-no-store'` cubren el
// bug REG-02 en el que una entry stale de la Data Cache (poblada por otra
// ruta que hace la misma consulta por slug) devolvía `data:null` en el
// retorno del reproductor. `force-no-store` es más estricto que el
// `default-no-store` implícito de `force-dynamic`: rechaza el cache aunque
// el fetch pida `force-cache` explícito. `noStore()` dentro del componente
// remata a nivel de request. Sin esto, el patrón "curso→lección→volver"
// servía un 404 desde cache.
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default async function EditarCursoPage({ params }: { params: { slug: string } }) {
  noStore()

  const admin = createAdminClient()

  const { data: course, error: courseError } = await admin
    .from('courses')
    .select(
      'id, slug, title, subtitle, description, category, difficulty, duration_hours, cert_validity_days, pass_score, max_attempts, learning_objectives, published, published_at',
    )
    .eq('slug', params.slug)
    .maybeSingle()

  if (courseError) {
    console.error('[admin/cursos/[slug]] error en consulta de curso:', courseError.message, {
      slug: params.slug,
    })
    notFound()
  }
  if (!course) {
    console.error('[admin/cursos/[slug]] curso no encontrado por slug', {
      slug: params.slug,
    })
    notFound()
  }

  const { count: moduleCount } = await admin
    .from('modules')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', course.id)

  const { data: evaluation } = await admin
    .from('evaluations')
    .select('id')
    .eq('course_id', course.id)
    .maybeSingle()
  const { count: questionCount } = evaluation
    ? await admin
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('evaluation_id', evaluation.id)
    : { count: 0 }

  const initial: CourseInput = {
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle ?? '',
    description: course.description ?? '',
    category: course.category,
    difficulty: course.difficulty ?? 'basico',
    duration_hours: course.duration_hours,
    cert_validity_days: course.cert_validity_days,
    pass_score: course.pass_score,
    max_attempts: course.max_attempts,
    learning_objectives: course.learning_objectives,
  }

  return (
    <div>
      <h1 className="font-display text-display-md text-charcoal">{course.title}</h1>

      <div className="mt-4 flex flex-wrap gap-4">
        <Link
          href={`/admin/cursos/${course.slug}/modulos`}
          className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-teal hover:bg-mist"
        >
          Módulos y lecciones ({moduleCount ?? 0})
        </Link>
        <Link
          href={`/admin/cursos/${course.slug}/evaluacion`}
          className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-teal hover:bg-mist"
        >
          Evaluación · banco de preguntas ({questionCount ?? 0})
        </Link>
      </div>

      <div className="mt-6">
        <PublishPanel
          courseId={course.id}
          published={course.published}
          publishedAt={course.published_at}
        />
      </div>

      <div className="mt-6">
        <CourseForm mode="edit" courseId={course.id} initial={initial} />
      </div>

      {!course.published && (
        <div className="mt-8 border-t border-border pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Zona peligrosa
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Solo borradores sin inscripciones ni constancias se pueden archivar.
          </p>
          <div className="mt-3">
            <ArchiveCourseButton courseId={course.id} title={course.title} />
          </div>
        </div>
      )}
    </div>
  )
}
