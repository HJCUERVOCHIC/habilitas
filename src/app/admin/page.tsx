import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const admin = createAdminClient()
  const { data: courses } = await admin
    .from('courses')
    .select('slug, title, published, category')
    .order('created_at', { ascending: false })

  const all = courses ?? []
  const published = all.filter((c) => c.published).length
  const drafts = all.length - published

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-display-md text-charcoal">Panel</h1>
        <Button asChild variant="primary">
          <Link href="/admin/cursos/nuevo">Nuevo curso</Link>
        </Button>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Publicados">{published}</Stat>
        <Stat label="Borradores">{drafts}</Stat>
        <Stat label="Total cursos">{all.length}</Stat>
      </dl>

      <div className="mt-8 flex gap-4">
        <Link href="/admin/cursos" className="font-medium text-teal hover:text-teal-light">
          Gestionar cursos →
        </Link>
        <Link href="/admin/certificados" className="font-medium text-teal hover:text-teal-light">
          Ver constancias →
        </Link>
      </div>
    </div>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-1 font-display text-3xl text-charcoal">{children}</dd>
    </div>
  )
}
