import { CatalogClient } from '@/components/cert/CatalogClient'
import { Topbar } from '@/components/layout/Topbar'
import { createPublicClient } from '@/lib/supabase/public'

// Catálogo (ISR, revalida 1h). Solo cursos publicados (RLS courses_public_read).
export const revalidate = 3600

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

  return (
    <>
      <Topbar />
      <main className="min-h-screen bg-mist">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h1 className="font-display text-display-lg text-charcoal">Cursos</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Aprende habilidades clínicas y comparte una constancia verificable en segundos.
          </p>
          <div className="mt-8">
            <CatalogClient courses={courses ?? []} />
          </div>
        </div>
      </main>
    </>
  )
}
