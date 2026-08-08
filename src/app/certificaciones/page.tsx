import { CatalogClient } from '@/components/cert/CatalogClient'
import { ComplianceNotice } from '@/components/compliance/ComplianceNotice'
import { PublicShell } from '@/components/layout/PublicShell'
import { createPublicClient } from '@/lib/supabase/public'

// Dinámico: el encabezado se decide por sesión (PublicShell). Un estudiante
// autenticado que llega al catálogo ve AppNav en lugar del Topbar público,
// así que la respuesta ya no puede cachearse como estática.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Cursos — Habilitas',
  description: 'Catálogo de cursos clínicos con constancia verificable.',
}

export default async function CertificacionesPage() {
  const supabase = createPublicClient()
  const { data: courses } = await supabase
    .from('courses')
    .select('slug, title, description, category, duration_hours, difficulty')
    .eq('published', true)
    .order('title')

  const list = courses ?? []

  return (
    <>
      <PublicShell />
      <main className="min-h-screen bg-mist">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h1 className="font-display text-display-lg text-charcoal">Cursos</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Aprende habilidades clínicas y comparte una constancia verificable en segundos.
          </p>
          <div className="mt-8">
            {list.length === 0 ? (
              <div className="rounded-lg border border-border bg-white p-10 text-center shadow-sm">
                <h2 className="font-display text-2xl text-charcoal">
                  Aún no hay cursos publicados
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                  Estamos preparando los primeros cursos. Vuelve pronto o escríbenos a{' '}
                  <a
                    href="mailto:soporte@habilitas.co"
                    className="font-medium text-teal hover:text-teal-light"
                  >
                    soporte@habilitas.co
                  </a>{' '}
                  para avisarte cuando arranquemos.
                </p>
              </div>
            ) : (
              <CatalogClient courses={list} />
            )}
          </div>

          <div className="mt-10">
            <ComplianceNotice variant="inline" />
          </div>
        </div>
      </main>
    </>
  )
}
