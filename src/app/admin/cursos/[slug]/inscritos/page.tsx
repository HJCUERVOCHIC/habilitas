import Link from 'next/link'
import { notFound } from 'next/navigation'

import { EnrollmentsTable } from '@/components/admin/EnrollmentsTable'
import { getCourseEnrollments } from '@/lib/enrollments-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function InscritosPage({ params }: { params: { slug: string } }) {
  const admin = createAdminClient()
  const { data: course } = await admin
    .from('courses')
    .select('id, title')
    .eq('slug', params.slug)
    .maybeSingle<{ id: string; title: string }>()
  if (!course) notFound()

  const rows = await getCourseEnrollments(admin, course.id)

  return (
    <div>
      <Link
        href={`/admin/cursos/${params.slug}`}
        className="text-sm text-teal hover:text-teal-light"
      >
        ← {course.title}
      </Link>
      <h1 className="mb-2 mt-2 font-display text-display-md text-charcoal">Inscritos</h1>
      <p className="mb-6 text-sm text-ink-soft">
        {rows.length} {rows.length === 1 ? 'persona inscrita' : 'personas inscritas'}. Ordena por
        progreso o filtra por estado para hacer seguimiento.
      </p>
      <EnrollmentsTable rows={rows} />
    </div>
  )
}
