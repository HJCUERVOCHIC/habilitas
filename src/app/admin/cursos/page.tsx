import Link from 'next/link'

import {
  CoursesIndex,
  type CourseIndexRow,
  type CourseStatus,
} from '@/components/admin/CoursesIndex'
import { Button } from '@/components/ui/Button'
import { listCategories } from '@/lib/categories-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function AdminCursosPage() {
  const admin = createAdminClient()
  // Traemos también los archivados: el filtro por estado los muestra a
  // demanda (SPEC-ESTUDIANTES-CLASIFICACION §1.4). El listado admin no es
  // un lugar donde ocultarlos indefinidamente.
  const [{ data: courses }, categories] = await Promise.all([
    admin
      .from('courses')
      .select('id, slug, title, category, difficulty, published, archived_at')
      .order('created_at', { ascending: false }),
    listCategories(admin),
  ])

  const rows: CourseIndexRow[] = (courses ?? []).map((c) => {
    const status: CourseStatus = c.archived_at ? 'archived' : c.published ? 'published' : 'draft'
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      category: c.category,
      difficulty: c.difficulty,
      status,
    }
  })

  const categoryLabels = Object.fromEntries(categories.map((c) => [c.slug, c.label]))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-display-md text-charcoal">Cursos</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/categorias">Categorías</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/cursos/importar">Importar YAML</Link>
          </Button>
          <Button asChild variant="primary">
            <Link href="/admin/cursos/nuevo">Nuevo curso</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <CoursesIndex courses={rows} categoryLabels={categoryLabels} />
      </div>
    </div>
  )
}
