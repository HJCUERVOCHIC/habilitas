import { CourseForm } from '@/components/admin/CourseForm'
import { listCategories } from '@/lib/categories-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function NuevoCursoPage() {
  const admin = createAdminClient()
  const categories = await listCategories(admin)
  const options = categories.map((c) => ({ slug: c.slug, label: c.label }))

  return (
    <div>
      <h1 className="font-display text-display-md text-charcoal">Nuevo curso</h1>
      <p className="mb-6 mt-1 text-sm text-ink-soft">
        Tras crearlo, agrega módulos, lecciones y la evaluación. Se publica cuando tenga
        evaluación con preguntas.
      </p>
      <CourseForm mode="create" categories={options} />
    </div>
  )
}
