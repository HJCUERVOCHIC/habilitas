import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

export interface SessionAndRole {
  user: User | null
  isAdmin: boolean
  fullName: string | null
}

/**
 * Lee sesión, rol y nombre del usuario en un único roundtrip para que el shell
 * autenticado decida qué mostrar (ítem "Panel admin", identidad). No redirige.
 *
 * SPEC-NAVEGACION §2 (entregable 2): "reutilizar la lógica existente, no
 * duplicarla".
 */
export async function getSessionAndRole(): Promise<SessionAndRole> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, isAdmin: false, fullName: null }
  const { data } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()
  return {
    user,
    isAdmin: data?.role === 'admin',
    fullName: data?.full_name ?? null,
  }
}

/**
 * Verifica el rol admin en el servidor (HABILITAS-ESPECIFICACION §5.8 CA:
 * "bloqueada, no solo oculta en UI"). Devuelve el usuario si es admin, o null.
 */
export async function getAdminUser(): Promise<User | null> {
  const { user, isAdmin } = await getSessionAndRole()
  return isAdmin ? user : null
}

/**
 * Para páginas /admin: distingue sin-sesión (→ /ingresar) de no-admin
 * (→ /dashboard). SPEC-ROLES-ACCESO §1: un estudiante que intenta /admin
 * vuelve a su propia área en lugar de ir a la landing.
 */
export async function requireAdminPage(): Promise<User> {
  const { user, isAdmin } = await getSessionAndRole()
  if (!user) redirect('/ingresar')
  if (!isAdmin) redirect('/dashboard')
  return user
}
