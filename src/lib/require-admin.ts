import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

/**
 * Verifica el rol admin en el servidor (HABILITAS-ESPECIFICACION §5.8 CA:
 * "bloqueada, no solo oculta en UI"). Devuelve el usuario si es admin, o null.
 */
export async function getAdminUser(): Promise<User | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  return data?.role === 'admin' ? user : null
}

/** Para páginas /admin: redirige a quien no sea admin. */
export async function requireAdminPage(): Promise<User> {
  const user = await getAdminUser()
  if (!user) redirect('/')
  return user
}
