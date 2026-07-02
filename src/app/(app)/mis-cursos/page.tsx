import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/server'

// Lista de inscripciones del usuario (SPEC-NAVEGACION §2 entregable 2: ítem
// "Mis cursos"). Extraído de /perfil para tener una vista canónica.
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Mis cursos — Habilitas' }

export default async function MisCursosPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/ingresar?redirect=/mis-cursos')

  const [{ data: enrollments }, { data: progressRows }, { data: certs }] = await Promise.all([
    supabase
      .from('enrollments')
      .select('course_id, enrolled_at')
      .eq('user_id', user.id)
      .order('enrolled_at', { ascending: false }),
    supabase.from('course_progress').select('course_id, progress_pct').eq('user_id', user.id),
    supabase
      .from('certificates')
      .select('course_id, verification_id, cert_id')
      .eq('user_id', user.id)
      .neq('status', 'revoked'),
  ])

  const courseIds = (enrollments ?? []).map((e) => e.course_id)
  const { data: courses } = courseIds.length
    ? await supabase.from('courses').select('id, slug, title').in('id', courseIds)
    : { data: [] }

  const courseById = new Map((courses ?? []).map((c) => [c.id, c]))
  const progressByCourse = new Map(
    (progressRows ?? []).map((p) => [p.course_id, p.progress_pct ?? 0]),
  )
  // Enlace a la constancia por curso (SPEC-CONSTANCIA-PERFIL §1.4). Prefiere
  // el token inadivinable; cae a cert_id solo por compatibilidad legacy.
  const certByCourse = new Map(
    (certs ?? []).map((c) => [c.course_id, c.verification_id ?? c.cert_id]),
  )

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="font-display text-display-md text-charcoal">Mis cursos</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/certificaciones">Explorar catálogo</Link>
        </Button>
      </header>

      {enrollments && enrollments.length > 0 ? (
        <div className="space-y-3">
          {enrollments.map((enrollment) => {
            const course = courseById.get(enrollment.course_id)
            const pct = progressByCourse.get(enrollment.course_id) ?? 0
            const certToken = certByCourse.get(enrollment.course_id)
            if (!course) return null
            return (
              <div
                key={enrollment.course_id}
                className="rounded-lg border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="min-w-0 truncate font-medium text-charcoal">{course.title}</p>
                  <Link
                    href={`/curso/${course.slug}`}
                    className="shrink-0 text-sm font-medium text-teal hover:text-teal-light"
                  >
                    {pct === 0 ? 'Empezar →' : pct === 100 ? 'Repasar →' : 'Continuar →'}
                  </Link>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
                    <div
                      className="h-full rounded-full bg-teal transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-ink-soft">{pct}%</span>
                </div>
                {certToken && (
                  <div className="mt-3 flex items-center justify-end">
                    <Link
                      href={`/verificar/${certToken}`}
                      className="text-sm font-medium text-teal hover:text-teal-light"
                    >
                      Ver constancia →
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-white p-6 text-center text-ink-soft">
          Aún no te has inscrito en ningún curso.{' '}
          <Link href="/certificaciones" className="font-medium text-teal">
            Ver cursos
          </Link>
        </p>
      )}
    </div>
  )
}
