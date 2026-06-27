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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-display-md text-charcoal">Cursos</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/cursos/importar">Importar YAML</Link>
          </Button>
          <Button asChild variant="primary">
            <Link href="/admin/cursos/nuevo">Nuevo curso</Link>
          </Button>
        </div>
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
            {course.published ? (
              // Publicado: permite despublicar rápido desde la lista.
              <PublishToggle courseId={course.id} published={true} />
            ) : (
              // Borrador: dirige al detalle, donde vive el checklist completo
              // y el botón "Publicar" (SPEC-PUBLICACION-CONSTANCIAS §1).
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-mist px-2.5 py-1 text-xs font-semibold text-ink-soft">
                  Borrador
                </span>
                <Link
                  href={`/admin/cursos/${course.slug}`}
                  className="text-sm font-medium text-teal hover:text-teal-light"
                >
                  Configurar para publicar →
                </Link>
              </div>
            )}
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
