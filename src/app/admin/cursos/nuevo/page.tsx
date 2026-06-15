import { CourseForm } from '@/components/admin/CourseForm'

export const dynamic = 'force-dynamic'

export default function NuevoCursoPage() {
  return (
    <div>
      <h1 className="font-display text-display-md text-charcoal">Nuevo curso</h1>
      <p className="mb-6 mt-1 text-sm text-ink-soft">
        Tras crearlo, agrega módulos, lecciones y la evaluación. Se publica cuando tenga
        evaluación con preguntas.
      </p>
      <CourseForm mode="create" />
    </div>
  )
}
