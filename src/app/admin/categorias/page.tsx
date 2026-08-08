import Link from 'next/link'

import { CategoriesManager } from '@/components/admin/CategoriesManager'
import { courseCountByCategory, listCategories } from '@/lib/categories-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function CategoriasAdminPage() {
  const admin = createAdminClient()
  const [categories, counts] = await Promise.all([
    listCategories(admin),
    courseCountByCategory(admin),
  ])

  const rows = categories.map((c) => ({
    ...c,
    coursesCount: counts.get(c.slug) ?? 0,
  }))

  return (
    <div>
      <Link href="/admin/cursos" className="text-sm text-teal hover:text-teal-light">
        ← Cursos
      </Link>
      <h1 className="mb-2 mt-2 font-display text-display-md text-charcoal">Categorías</h1>
      <p className="mb-6 max-w-2xl text-sm text-ink-soft">
        Etiquetas de descubrimiento del catálogo. Renombra libremente; el identificador
        interno (slug) queda fijo para no romper enlaces. No se puede eliminar una categoría
        con cursos asignados: reasígnalos desde el formulario del curso primero.
      </p>
      <CategoriesManager rows={rows} />
    </div>
  )
}
