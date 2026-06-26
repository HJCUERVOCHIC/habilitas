import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SignOutButton } from '@/components/layout/SignOutButton'
import { getSessionAndRole } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

/**
 * Shell del administrador (SPEC-ROLES-ACCESO §1).
 *
 * - Enforcement en servidor: sin sesión → /ingresar; con sesión no-admin →
 *   /dashboard (su propia área). Defensa en profundidad: la visibilidad de UI
 *   no sustituye el chequeo de rol.
 * - Identidad visible: nombre del usuario + insignia "Administrador" para
 *   reforzar el contexto.
 * - Egreso por logout (no por navegación a otra área): el admin no tiene un
 *   área de estudiante a la que "volver".
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, fullName } = await getSessionAndRole()
  if (!user) redirect('/ingresar')
  if (!isAdmin) redirect('/dashboard')

  const displayName = fullName?.trim() || user.email || ''

  return (
    <div className="min-h-screen bg-mist">
      <header className="bg-charcoal text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <Link href="/admin" className="font-display text-lg">
            Habilitas · Admin
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin" className="text-teal-mid hover:text-white">
              Panel
            </Link>
            <Link href="/admin/cursos" className="text-teal-mid hover:text-white">
              Cursos
            </Link>
            <Link href="/admin/certificados" className="text-teal-mid hover:text-white">
              Constancias
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span
              className="hidden max-w-[180px] truncate text-sm text-teal-mid sm:inline"
              title={displayName}
            >
              {displayName}
            </span>
            <span
              className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white"
              aria-label="Rol: Administrador"
            >
              Administrador
            </span>
            <SignOutButton variant="outline-white" />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
    </div>
  )
}
