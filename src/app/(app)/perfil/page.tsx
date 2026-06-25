import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CertListCard, type CertListItem } from '@/components/cert/CertListCard'
import { createClient } from '@/lib/supabase/server'

import { ProfileForm } from './ProfileForm'

// Perfil del usuario. El chrome (topbar + cerrar sesión + footer aviso) lo
// provee el shell autenticado en (app)/layout.tsx. La lista de cursos vive
// en /mis-cursos para tener una única vista canónica.
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Mi perfil — Habilitas' }

export default async function PerfilPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/ingresar?redirect=/perfil')

  const [{ data: profile }, { data: certs }] = await Promise.all([
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
    supabase
      .from('certificates')
      .select('cert_id, status, expires_at, score, issued_at, course_id')
      .eq('user_id', user.id)
      .order('issued_at', { ascending: false }),
  ])

  const courseIds = Array.from(new Set((certs ?? []).map((c) => c.course_id)))
  const { data: courses } = courseIds.length
    ? await supabase.from('courses').select('id, title').in('id', courseIds)
    : { data: [] }
  const courseTitleById = new Map((courses ?? []).map((c) => [c.id, c.title]))

  const certItems: CertListItem[] = (certs ?? []).map((c) => ({
    cert_id: c.cert_id,
    status: c.status,
    expires_at: c.expires_at,
    score: c.score,
    issued_at: c.issued_at,
    courseTitle: courseTitleById.get(c.course_id) ?? 'Curso',
  }))

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-12">
      <h1 className="font-display text-display-md text-charcoal">Mi perfil</h1>

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

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Mis constancias
          </h2>
          <Link
            href="/mis-cursos"
            className="text-sm font-medium text-teal hover:text-teal-light"
          >
            Ver mis cursos →
          </Link>
        </div>
        {certItems.length > 0 ? (
          <div className="space-y-3">
            {certItems.map((cert) => (
              <CertListCard key={cert.cert_id} cert={cert} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-border bg-white p-6 text-center text-ink-soft">
            Todavía no tienes constancias. Aprueba la evaluación de un curso para obtenerla.
          </p>
        )}
      </section>
    </div>
  )
}
