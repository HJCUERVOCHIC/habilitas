import { AdminPublicTopbar } from '@/components/layout/AdminPublicTopbar'
import { AppNav } from '@/components/layout/AppNav'
import { Topbar } from '@/components/layout/Topbar'
import { getSessionAndRole } from '@/lib/require-admin'

interface PublicShellProps {
  /**
   * Encabezado a renderizar cuando NO hay sesión (visitante anónimo). Por
   * defecto `<Topbar />`; `/verificar/[id]` lo sobreescribe con
   * `<VerifyTopbar />` para preservar el diseño neutro de la verificación
   * pública.
   *
   * El caso admin NO usa `fallback`: aunque la verificación pública es
   * accesible sin sesión, un admin autenticado que llega ahí debe tener
   * vuelta a `/admin` — el fallback público de `/verificar/[id]` no la
   * tiene. Ver `AdminPublicTopbar`.
   */
  fallback?: React.ReactNode
}

/**
 * Encabezado adaptativo para páginas públicas (catálogo, detalle de curso,
 * verificación de constancia). Resuelve la sesión en el servidor y decide
 * qué shell mostrar:
 *
 *   - **Estudiante autenticado** → `<AppNav>` (shell del área privada).
 *   - **Admin autenticado** → `<AdminPublicTopbar>`: conserva el enlace
 *     público a "Cursos" pero añade vuelta a `/admin`, identidad y
 *     "Cerrar sesión". Sin "Ingresar", ya hay sesión.
 *   - **Anónimo** → `fallback` (Topbar público por defecto).
 *
 * Los roles son mutuamente excluyentes (SPEC-ROLES-ACCESO §1): el admin
 * NUNCA ve la barra de estudiante y viceversa.
 *
 * Se llama desde páginas dinámicas: leer sesión requiere cookies, así que la
 * página que lo usa debe estar en `dynamic = 'force-dynamic'`.
 */
export async function PublicShell({ fallback }: PublicShellProps) {
  const { user, isAdmin, fullName } = await getSessionAndRole()
  if (user && isAdmin) {
    return <AdminPublicTopbar email={user.email ?? ''} fullName={fullName} />
  }
  if (user && !isAdmin) {
    return <AppNav email={user.email ?? ''} fullName={fullName} />
  }
  return <>{fallback ?? <Topbar />}</>
}
