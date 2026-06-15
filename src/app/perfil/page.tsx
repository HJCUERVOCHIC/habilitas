import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ProfileForm } from '@/app/perfil/ProfileForm'
import { CertListCard, type CertListItem } from '@/components/cert/CertListCard'
import { SignOutButton } from '@/components/layout/SignOutButton'
import { Topbar } from '@/components/layout/Topbar'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Mi perfil — Habilitas' }

export default async function PerfilPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/ingresar?redirect=/perfil')

  const [{ data: profile }, { data: enrollments }, { data: progressRows }, { data: certs }] =
    await Promise.all([
      supabase
        .from('users')
        .select('full_name, profession, city, rethus_number, avatar_url')
        .eq('id', user.id)
        .single<{
          full_name: string
          profession: string | null
          city: string | null
          rethus_number: string | null
          avatar_url: string | null
        }>(),
      supabase.from('enrollments').select('course_id, enrolled_at').eq('user_id', user.id),
      supabase
        .from('course_progress')
        .select('course_id, progress_pct')
        .eq('user_id', user.id),
      supabase
        .from('certificates')
        .select('cert_id, status, expires_at, score, issued_at, course_id')
        .eq('user_id', user.id)
        .order('issued_at', { ascending: false }),
    ])

  // Cursos necesarios para títulos/slugs (inscripciones + certificados).
  const courseIds = Array.from(
    new Set([
      ...(enrollments ?? []).map((e) => e.course_id),
      ...(certs ?? []).map((c) => c.course_id),
    ]),
  )
  const { data: courses } = courseIds.length
    ? await supabase.from('courses').select('id, slug, title').in('id', courseIds)
    : { data: [] }
  const courseById = new Map((courses ?? []).map((c) => [c.id, c]))
  const progressByCourse = new Map(
    (progressRows ?? []).map((p) => [p.course_id, p.progress_pct ?? 0]),
  )

  const certItems: CertListItem[] = (certs ?? []).map((c) => ({
    cert_id: c.cert_id,
    status: c.status,
    expires_at: c.expires_at,
    score: c.score,
    issued_at: c.issued_at,
    courseTitle: courseById.get(c.course_id)?.title ?? 'Curso',
  }))

  return (
    <>
      <Topbar />
      <main className="min-h-screen bg-mist">
        <div className="mx-auto max-w-3xl space-y-10 px-6 py-12">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-display-md text-charcoal">Mi perfil</h1>
            <SignOutButton />
          </div>

          {/* Datos editables */}
          <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Datos personales
            </h2>
            <p className="mb-4 text-sm text-ink-soft">{user.email}</p>
            <ProfileForm
              initial={{
                full_name: profile?.full_name ?? '',
                profession: profile?.profession ?? '',
                city: profile?.city ?? '',
                rethus_number: profile?.rethus_number ?? '',
                avatar_url: profile?.avatar_url ?? '',
              }}
            />
          </section>

          {/* Cursos inscritos */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Mis cursos
            </h2>
            {enrollments && enrollments.length > 0 ? (
              <div className="space-y-3">
                {enrollments.map((enrollment) => {
                  const course = courseById.get(enrollment.course_id)
                  const pct = progressByCourse.get(enrollment.course_id) ?? 0
                  if (!course) return null
                  return (
                    <div
                      key={enrollment.course_id}
                      className="rounded-lg border border-border bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="min-w-0 truncate font-medium text-charcoal">
                          {course.title}
                        </p>
                        <Link
                          href={`/curso/${course.slug}`}
                          className="shrink-0 text-sm font-medium text-teal hover:text-teal-light"
                        >
                          Continuar →
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
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-border bg-white p-6 text-center text-ink-soft">
                Aún no te has inscrito en ningún curso.{' '}
                <Link href="/certificaciones" className="font-medium text-teal">
                  Ver certificaciones
                </Link>
              </p>
            )}
          </section>

          {/* Certificados */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Mis certificados
            </h2>
            {certItems.length > 0 ? (
              <div className="space-y-3">
                {certItems.map((cert) => (
                  <CertListCard key={cert.cert_id} cert={cert} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-border bg-white p-6 text-center text-ink-soft">
                Todavía no tienes certificados. Aprueba la evaluación de un curso para obtenerlo.
              </p>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
