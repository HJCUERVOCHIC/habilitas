import { redirect } from 'next/navigation'

import { AppNav } from '@/components/layout/AppNav'
import { ComplianceFooter } from '@/components/layout/ComplianceFooter'
import { getSessionAndRole } from '@/lib/require-admin'

/**
 * Layout autenticado (app shell). Envuelve /dashboard, /mis-cursos y /perfil.
 * Las rutas públicas (/, /certificaciones, /verificar) y el reproductor
 * (/curso/[slug]) quedan fuera por diseño — ver SPEC-NAVEGACION §2 y §4.
 *
 * Defensa en profundidad: el middleware ya redirige a /ingresar si no hay
 * sesión para /dashboard, /mis-cursos, /perfil. Aquí re-validamos en el
 * servidor por si una ruta nueva del grupo no quedara en PROTECTED_PREFIXES.
 */
export const dynamic = 'force-dynamic'

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, fullName } = await getSessionAndRole()
  if (!user) redirect('/ingresar')
  // SPEC-ROLES-ACCESO §1: separación estricta — un admin nunca ve el área
  // de estudiante. Se canaliza a su propio shell en /admin.
  if (isAdmin) redirect('/admin')

  return (
    <div className="flex min-h-screen flex-col bg-mist">
      <AppNav email={user.email ?? ''} fullName={fullName} />
      <main className="flex-1">{children}</main>
      <ComplianceFooter />
    </div>
  )
}
