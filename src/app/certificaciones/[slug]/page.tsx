import { notFound } from 'next/navigation'

import { PurchaseCard } from '@/components/cert/PurchaseCard'
import { ComplianceNotice } from '@/components/compliance/ComplianceNotice'
import { ModalityBadge } from '@/components/compliance/ModalityBadge'
import { CategoryBadge, DifficultyDots } from '@/components/ui/Badge'
import { Topbar } from '@/components/layout/Topbar'
import { isCategory } from '@/lib/categories'
import { createPublicClient } from '@/lib/supabase/public'

// Detalle de certificación (ISR, revalida 1h).
export const revalidate = 3600

export async function generateStaticParams() {
  const supabase = createPublicClient()
  const { data } = await supabase.from('courses').select('slug').eq('published', true)
  return (data ?? []).map((course) => ({ slug: course.slug }))
}

export default async function DetalleCursoPage({ params }: { params: { slug: string } }) {
  const supabase = createPublicClient()

  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('slug', params.slug)
    .eq('published', true)
    .maybeSingle()

  if (!course) notFound()

  const [{ data: modules }, { data: evaluation }] = await Promise.all([
    supabase
      .from('modules')
      .select('id, title, order_index')
      .eq('course_id', course.id)
      .order('order_index'),
    supabase.from('evaluations').select('duration_min').eq('course_id', course.id).maybeSingle(),
  ])

  const moduleList = modules ?? []
  const moduleIds = moduleList.map((m) => m.id)

  const { data: lessons } = moduleIds.length
    ? await supabase.from('lessons').select('module_id, duration_min').in('module_id', moduleIds)
    : { data: [] }

  const byModule = new Map<string, { count: number; minutes: number }>()
  for (const lesson of lessons ?? []) {
    const current = byModule.get(lesson.module_id) ?? { count: 0, minutes: 0 }
    current.count += 1
    current.minutes += lesson.duration_min ?? 0
    byModule.set(lesson.module_id, current)
  }
  const totalLessons = Array.from(byModule.values()).reduce((sum, m) => sum + m.count, 0)

  const { data: instructor } = course.instructor_id
    ? await supabase
        .from('instructors_public')
        .select('full_name, profession')
        .eq('id', course.instructor_id)
        .maybeSingle()
    : { data: null }

  const category = isCategory(course.category) ? course.category : null
  const validityMonths = Math.round(course.cert_validity_days / 30)

  return (
    <>
      <Topbar />
      <main className="min-h-screen bg-mist">
        {/* Header */}
        <div className="border-b border-border bg-white">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <div className="flex flex-wrap items-center gap-2">
              {category && <CategoryBadge category={category} />}
              <ModalityBadge />
            </div>
            <h1 className="mt-2 font-display text-display-lg text-charcoal">{course.title}</h1>
            {course.subtitle && <p className="mt-2 text-lg text-ink-soft">{course.subtitle}</p>}

            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
              <Stat label="Duración">{course.duration_hours ?? '—'} h</Stat>
              <Stat label="Módulos">{moduleList.length}</Stat>
              <Stat label="Evaluación">{evaluation ? 'Final' : '—'}</Stat>
              <Stat label="Vigencia">{validityMonths} meses</Stat>
            </dl>
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-3">
          {/* Columna principal */}
          <div className="space-y-12 lg:col-span-2">
            {course.description && <p className="text-ink-main">{course.description}</p>}

            {course.learning_objectives.length > 0 && (
              <section>
                <h2 className="font-display text-2xl text-charcoal">Lo que aprenderás</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {course.learning_objectives.map((objective) => (
                    <li key={objective} className="flex items-start gap-2 text-sm text-ink-soft">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                      {objective}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="font-display text-2xl text-charcoal">Contenido del curso</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {moduleList.length} módulos · {totalLessons} clases
              </p>
              <ol className="mt-4 space-y-3">
                {moduleList.map((mod, index) => {
                  const stats = byModule.get(mod.id) ?? { count: 0, minutes: 0 }
                  return (
                    <li
                      key={mod.id}
                      className="flex items-center justify-between rounded-md border border-border bg-white px-5 py-4"
                    >
                      <span className="font-medium text-charcoal">
                        <span className="text-ink-muted">{index + 1}.</span> {mod.title}
                      </span>
                      <span className="text-sm text-ink-soft">
                        {stats.count} clases · {stats.minutes} min
                      </span>
                    </li>
                  )
                })}
              </ol>
            </section>

            <section>
              <h2 className="font-display text-2xl text-charcoal">Evaluación y constancia</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                <Stat label="Puntaje mínimo">{course.pass_score}%</Stat>
                <Stat label="Intentos">{course.max_attempts}</Stat>
                <Stat label="Duración">{evaluation?.duration_min ?? '—'} min</Stat>
              </dl>
              {course.difficulty && (
                <div className="mt-4">
                  <DifficultyDots difficulty={course.difficulty} />
                </div>
              )}
            </section>

            <ComplianceNotice />
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <PurchaseCard slug={course.slug} validityDays={course.cert_validity_days} />

            <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Instructor
              </h3>
              <p className="mt-2 font-medium text-charcoal">{instructor?.full_name ?? 'Equipo Habilitas'}</p>
              {instructor?.profession && (
                <p className="text-sm text-ink-soft">{instructor.profession}</p>
              )}

              <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Dónde es reconocido
              </h3>
              <p className="mt-1 text-sm text-ink-soft">
                Constancia verificable en línea por empleadores e instituciones de salud.
              </p>

              <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Contacto
              </h3>
              <p className="mt-1 text-sm text-ink-soft">soporte@habilitas.co</p>
            </div>
          </aside>
        </div>
      </main>
    </>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-charcoal">{children}</dd>
    </div>
  )
}
