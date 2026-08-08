import type { createAdminClient } from '@/lib/supabase/admin'

/**
 * Helpers server-side sobre la tabla `public.categories`. Complementan a
 * `src/lib/categories.ts`, que sigue conservando los mapas visuales
 * (colores, clases Tailwind) por slug — para categorías que se creen
 * después, un helper devuelve valores neutros.
 */

type SupabaseAdmin = ReturnType<typeof createAdminClient>

export interface CategoryRow {
  id: string
  slug: string
  label: string
  orderIndex: number
}

/** Devuelve las categorías ordenadas por `order_index` y luego por label. */
export async function listCategories(admin: SupabaseAdmin): Promise<CategoryRow[]> {
  const { data } = await admin
    .from('categories')
    .select('id, slug, label, order_index')
    .order('order_index')
    .order('label')
  return (data ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    label: c.label,
    orderIndex: c.order_index,
  }))
}

/**
 * Conteo de cursos por slug de categoría. Se usa para:
 *  - bloquear el borrado de una categoría con cursos asignados
 *    (SPEC-ESTUDIANTES-CLASIFICACION §1.2),
 *  - decorar el listado admin con "usada por N cursos".
 * Una sola query agregada client-side — sin N+1.
 */
export async function courseCountByCategory(
  admin: SupabaseAdmin,
): Promise<Map<string, number>> {
  const { data } = await admin
    .from('courses')
    .select('category')
    .is('archived_at', null)
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1)
  }
  return counts
}
