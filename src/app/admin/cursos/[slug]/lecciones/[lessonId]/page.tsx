import Link from 'next/link'
import { notFound } from 'next/navigation'

import { LessonEditor } from '@/components/admin/LessonEditor'
import { isR2Configured } from '@/lib/r2'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function EditarLeccionPage({
  params,
}: {
  params: { slug: string; lessonId: string }
}) {
  const admin = createAdminClient()

  const { data: course } = await admin
    .from('courses')
    .select('id, slug, title')
    .eq('slug', params.slug)
    .maybeSingle()
  if (!course) notFound()

  const { data: lesson } = await admin
    .from('lessons')
    .select(
      'id, module_id, title, content_type, body_md, content_r2_key, content_original_name, content_mime_type, content_size_bytes',
    )
    .eq('id', params.lessonId)
    .maybeSingle()
  if (!lesson) notFound()

  // Validar que la lección pertenezca al curso (vía su módulo).
  const { data: ownModule } = await admin
    .from('modules')
    .select('course_id, title')
    .eq('id', lesson.module_id)
    .maybeSingle()
  if (!ownModule || ownModule.course_id !== course.id) notFound()

  return (
    <div>
      <Link
        href={`/admin/cursos/${course.slug}/modulos`}
        className="text-sm text-teal hover:text-teal-light"
      >
        ← Módulos y lecciones
      </Link>
      <h1 className="mb-1 mt-2 font-display text-display-md text-charcoal">{lesson.title}</h1>
      <p className="mb-6 text-sm text-ink-soft">
        {course.title} · {ownModule.title}
      </p>
      <LessonEditor
        lesson={{
          id: lesson.id,
          title: lesson.title,
          content_type: lesson.content_type,
          body_md: lesson.body_md ?? '',
          content_r2_key: lesson.content_r2_key,
          content_original_name: lesson.content_original_name,
          content_mime_type: lesson.content_mime_type,
          content_size_bytes: lesson.content_size_bytes,
        }}
        r2Configured={isR2Configured()}
      />
    </div>
  )
}
