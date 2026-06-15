import { redirect } from 'next/navigation'

import { CoursePlayer } from '@/components/course/CoursePlayer'
import { createClient } from '@/lib/supabase/server'
import type { ModuleWithLessons, ProgressMap } from '@/types/course'

// Reproductor del curso: requiere auth + inscripción. Per-usuario → dinámico.
export const dynamic = 'force-dynamic'

export default async function CursoPage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/ingresar?redirect=/curso/${params.slug}`)

  const { data: course } = await supabase
    .from('courses')
    .select('id, slug, title')
    .eq('slug', params.slug)
    .maybeSingle()
  if (!course) redirect('/certificaciones')

  // Gate de inscripción: sin inscripción no se ve contenido (§5.4 CA).
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', course.id)
    .maybeSingle()
  if (!enrollment) redirect(`/certificaciones/${params.slug}`)

  const { data: modules } = await supabase
    .from('modules')
    .select('id, title, order_index')
    .eq('course_id', course.id)
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

  const { data: evaluation } = await supabase
    .from('evaluations')
    .select('id')
    .eq('course_id', course.id)
    .maybeSingle()

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

  const initialProgress: ProgressMap = {}
  for (const row of progressRows ?? []) {
    initialProgress[row.lesson_id] = {
      completed: row.completed ?? false,
      last_position: row.last_position ?? 0,
    }
  }

  return (
    <CoursePlayer
      course={{ id: course.id, slug: course.slug, title: course.title }}
      modules={modulesWith}
      initialProgress={initialProgress}
      hasEvaluation={Boolean(evaluation)}
    />
  )
}
