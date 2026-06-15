import Link from 'next/link'

import { requireAdminPage } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Enforcement de rol en servidor para TODO /admin/* (§5.8 CA).
  await requireAdminPage()

  return (
    <div className="min-h-screen bg-mist">
      <header className="bg-charcoal text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <Link href="/admin" className="font-display text-lg">
            Habilitas · Admin
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin/cursos" className="text-teal-mid hover:text-white">
              Cursos
            </Link>
            <Link href="/admin/certificados" className="text-teal-mid hover:text-white">
              Certificados
            </Link>
          </nav>
          <Link href="/" className="ml-auto text-sm text-teal-mid hover:text-white">
            Salir del panel
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
    </div>
  )
}
