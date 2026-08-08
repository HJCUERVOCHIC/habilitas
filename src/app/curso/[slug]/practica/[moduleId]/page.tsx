import { redirect } from 'next/navigation'

import { PracticeRunner } from '@/components/course/PracticeRunner'
import { countModuleQuestions, PRACTICE_MIN_QUESTIONS } from '@/lib/practice'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Reproductor de práctica formativa: requiere sesión + inscripción, igual
// que el reproductor principal. Per-usuario → dinámico.
export const dynamic = 'force-dynamic'

export default async function PracticaPage({
  params,
}: {
  params: { slug: string; moduleId: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/ingresar?redirect=/curso/${params.slug}`)

  const admin = createAdminClient()
  const { data: course } = await admin
    .from('courses')
    .select('id, title, slug')
    .eq('slug', params.slug)
    .maybeSingle()
  if (!course) redirect('/certificaciones')

  // Gate de inscripción con el cookies client (RLS `enrollments_own`).
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', course.id)
    .maybeSingle()
  if (!enrollment) redirect(`/certificaciones/${params.slug}`)

  // Módulo del curso, con conteo de preguntas para verificar umbral.
  const { data: mod } = await admin
    .from('modules')
    .select('id, title, course_id')
    .eq('id', params.moduleId)
    .maybeSingle<{ id: string; title: string; course_id: string }>()
  if (!mod || mod.course_id !== course.id) redirect(`/curso/${params.slug}`)

  const { data: evaluation } = await admin
    .from('evaluations')
    .select('id')
    .eq('course_id', course.id)
    .maybeSingle<{ id: string }>()
  if (!evaluation) redirect(`/curso/${params.slug}`)

  const count = await countModuleQuestions(admin, evaluation.id, mod.id)
  if (count < PRACTICE_MIN_QUESTIONS) redirect(`/curso/${params.slug}`)

  return (
    <PracticeRunner
      courseSlug={course.slug}
      courseTitle={course.title}
      moduleId={mod.id}
      moduleTitle={mod.title}
      minQuestions={PRACTICE_MIN_QUESTIONS}
      availableCount={count}
    />
  )
}
