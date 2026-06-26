import Link from 'next/link'

import { PublishToggle } from '@/components/admin/PublishToggle'
import { Button } from '@/components/ui/Button'
import { CATEGORY_LABELS, isCategory } from '@/lib/categories'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function AdminCursosPage() {
  const admin = createAdminClient()
  // Los archivados (soft-delete) se ocultan del listado. Restaurar requiere
  // intervención por DB en este bloque (Bloque 1 no expone UI de restore).
  const { data: courses } = await admin
    .from('courses')
    .select('id, slug, title, category, published')
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-display-md text-charcoal">Cursos</h1>
        <Button asChild variant="primary">
          <Link href="/admin/cursos/nuevo">Nuevo curso</Link>
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {(courses ?? []).map((course) => (
          <div
            key={course.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white p-4 shadow-sm"
          >
            <div>
              <Link
                href={`/admin/cursos/${course.slug}`}
                className="font-medium text-charcoal hover:text-teal"
              >
                {course.title}
              </Link>
              <p className="text-xs text-ink-muted">
                {isCategory(course.category) ? CATEGORY_LABELS[course.category] : course.category}
              </p>
            </div>
            <PublishToggle courseId={course.id} published={course.published} />
          </div>
        ))}
        {(courses ?? []).length === 0 && (
          <p className="rounded-lg border border-border bg-white p-6 text-center text-ink-soft">
            No hay cursos todavía.
          </p>
        )}
      </div>
    </div>
  )
}
