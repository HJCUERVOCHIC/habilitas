import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ModulesManager, type AdminModule } from '@/components/admin/ModulesManager'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function ModulosPage({ params }: { params: { slug: string } }) {
  const admin = createAdminClient()
  const { data: course } = await admin
    .from('courses')
    .select('id, title')
    .eq('slug', params.slug)
    .maybeSingle()
  if (!course) notFound()

  const { data: modules } = await admin
    .from('modules')
    .select('id, title, order_index')
    .eq('course_id', course.id)
    .order('order_index')

  const moduleIds = (modules ?? []).map((m) => m.id)
  const { data: lessons } = moduleIds.length
    ? await admin
        .from('lessons')
        .select('id, title, content_type, duration_min, module_id, order_index')
        .in('module_id', moduleIds)
        .order('order_index')
    : { data: [] }

  const adminModules: AdminModule[] = (modules ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    lessons: (lessons ?? [])
      .filter((l) => l.module_id === m.id)
      .map((l) => ({
        id: l.id,
        title: l.title,
        content_type: l.content_type,
        duration_min: l.duration_min,
      })),
  }))

  return (
    <div>
      <Link href={`/admin/cursos/${params.slug}`} className="text-sm text-teal hover:text-teal-light">
        ← {course.title}
      </Link>
      <h1 className="mb-6 mt-2 font-display text-display-md text-charcoal">Módulos y lecciones</h1>
      <ModulesManager courseId={course.id} courseSlug={params.slug} modules={adminModules} />
    </div>
  )
}
