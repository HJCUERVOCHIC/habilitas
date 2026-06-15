import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CourseForm } from '@/components/admin/CourseForm'
import { PublishToggle } from '@/components/admin/PublishToggle'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CourseInput } from '@/app/admin/actions'

export const dynamic = 'force-dynamic'

export default async function EditarCursoPage({ params }: { params: { slug: string } }) {
  const admin = createAdminClient()
  const { data: course } = await admin
    .from('courses')
    .select(
      'id, slug, title, subtitle, description, category, difficulty, duration_hours, cert_validity_days, pass_score, max_attempts, learning_objectives, published',
    )
    .eq('slug', params.slug)
    .maybeSingle()
  if (!course) notFound()

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-display-md text-charcoal">{course.title}</h1>
        <PublishToggle courseId={course.id} published={course.published} />
      </div>

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
        <CourseForm mode="edit" courseId={course.id} initial={initial} />
      </div>
    </div>
  )
}
