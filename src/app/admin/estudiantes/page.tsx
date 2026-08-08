import { StudentsIndex } from '@/components/admin/StudentsIndex'
import { getStudentsIndex } from '@/lib/enrollments-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function EstudiantesIndexPage() {
  const admin = createAdminClient()
  const rows = await getStudentsIndex(admin)

  return (
    <div>
      <h1 className="mb-2 font-display text-display-md text-charcoal">Estudiantes</h1>
      <p className="mb-6 max-w-2xl text-sm text-ink-soft">
        Índice de personas registradas con rol estudiante. Busca por nombre o correo y
        entra a la ficha individual para ver progreso, intentos y constancias. Sin
        exportación ni edición desde aquí (Ley 1581, minimización).
      </p>
      <StudentsIndex rows={rows} />
    </div>
  )
}
