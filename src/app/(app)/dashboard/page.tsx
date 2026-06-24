import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/server'
import { getSessionAndRole } from '@/lib/require-admin'

// Punto de entrada tras iniciar sesión (SPEC-NAVEGACION §2 entregable 3).
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Inicio — Habilitas' }

const MAX_CONTINUE = 3

export default async function DashboardPage() {
  const { user, fullName } = await getSessionAndRole()
  if (!user) redirect('/ingresar?redirect=/dashboard')

  const supabase = createClient()
  const [{ data: enrollments }, { data: progressRows }] = await Promise.all([
    supabase
      .from('enrollments')
      .select('course_id, enrolled_at')
      .eq('user_id', user.id)
      .order('enrolled_at', { ascending: false }),
    supabase.from('course_progress').select('course_id, progress_pct').eq('user_id', user.id),
  ])

  const courseIds = (enrollments ?? []).map((e) => e.course_id)
  const { data: courses } = courseIds.length
    ? await supabase.from('courses').select('id, slug, title').in('id', courseIds)
    : { data: [] }

  const courseById = new Map((courses ?? []).map((c) => [c.id, c]))
  const progressByCourse = new Map(
    (progressRows ?? []).map((p) => [p.course_id, p.progress_pct ?? 0]),
  )

  // Continuar: cursos inscritos no terminados, priorizando los que tienen
  // algún avance; los recién inscritos también aparecen para que tengan tracción.
  const continueList = (enrollments ?? [])
    .map((e) => {
      const course = courseById.get(e.course_id)
      const pct = progressByCourse.get(e.course_id) ?? 0
      return course && pct < 100 ? { course, pct } : null
    })
    .filter((item): item is { course: { id: string; slug: string; title: string }; pct: number } =>
      item !== null,
    )
    .sort((a, b) => b.pct - a.pct)
    .slice(0, MAX_CONTINUE)

  const greeting = fullName?.trim() || user.email

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10">
        <p className="text-sm font-medium uppercase tracking-wide text-teal">Habilitas</p>
        <h1 className="mt-1 font-display text-display-lg text-charcoal">
          Hola, {greeting}
        </h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Retoma un curso, explora el catálogo o gestiona tu perfil.
        </p>
      </header>

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Continuar curso
          </h2>
          <Link
            href="/mis-cursos"
            className="text-sm font-medium text-teal hover:text-teal-light"
          >
            Ver todos →
          </Link>
        </div>

        {continueList.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {continueList.map(({ course, pct }) => (
              <article
                key={course.id}
                className="flex flex-col rounded-lg border border-border bg-white p-5 shadow-sm"
              >
                <p className="min-w-0 font-medium text-charcoal">{course.title}</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
                    <div
                      className="h-full rounded-full bg-teal transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-ink-soft">{pct}%</span>
                </div>
                <Link
                  href={`/curso/${course.slug}`}
                  className="mt-4 text-sm font-medium text-teal hover:text-teal-light"
                >
                  {pct > 0 ? 'Continuar →' : 'Empezar →'}
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-white p-8 text-center shadow-sm">
            <p className="text-ink-soft">Aún no te has inscrito en ningún curso.</p>
            <div className="mt-4">
              <Button asChild variant="primary">
                <Link href="/certificaciones">Explorar catálogo</Link>
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <AccessCard
          href="/certificaciones"
          title="Catálogo"
          description="Descubre certificaciones publicadas."
        />
        <AccessCard
          href="/mis-cursos"
          title="Mis cursos"
          description="Tu lista de inscripciones y progreso."
        />
        <AccessCard
          href="/perfil"
          title="Mi perfil"
          description="Tus datos y certificados emitidos."
        />
      </section>
    </div>
  )
}

function AccessCard({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-border bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <p className="font-medium text-charcoal group-hover:text-teal">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{description}</p>
    </Link>
  )
}
