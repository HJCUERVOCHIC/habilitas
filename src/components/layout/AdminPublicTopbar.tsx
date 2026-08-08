import Link from 'next/link'

import { SignOutButton } from '@/components/layout/SignOutButton'

interface AdminPublicTopbarProps {
  email: string
  fullName: string | null
}

/**
 * Encabezado que ve un **admin** cuando visita una página pública
 * (catálogo, detalle de curso, verificación). Los roles son mutuamente
 * excluyentes: el admin no tiene navegación de estudiante (Mis cursos,
 * Perfil, Dashboard), pero tampoco puede quedar en un callejón sin salida
 * como con el `Topbar` público, que solo muestra "Cursos" e "Ingresar".
 *
 * Preserva el enlace público a `/certificaciones` (para inspeccionar el
 * catálogo tal como lo verá un visitante) y añade una vuelta explícita a
 * `/admin`, la identidad del usuario y "Cerrar sesión". No muestra
 * "Ingresar" porque ya hay sesión activa.
 */
export function AdminPublicTopbar({ email, fullName }: AdminPublicTopbarProps) {
  const displayName = fullName?.trim() || email
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="font-display text-xl text-charcoal">
          Habilitas
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/certificaciones" className="font-medium text-ink-main hover:text-teal">
            Cursos
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center rounded-md bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-light"
          >
            Panel admin
          </Link>
          <span
            className="hidden max-w-[180px] truncate text-sm text-ink-soft sm:inline"
            title={displayName}
          >
            {displayName}
          </span>
          <SignOutButton />
        </nav>
      </div>
    </header>
  )
}
