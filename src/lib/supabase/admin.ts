import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from '@/types/database'

/**
 * Cliente con privilegios elevados para operaciones admin.
 *
 * Estrategia preferida: usar SUPABASE_SERVICE_ROLE_KEY → bypasea RLS.
 *
 * Fallback (cuando la service role key no está disponible en runtime —
 * caso real con HMR de Next o deploys con env mal cargada): cliente
 * cookies-based con la anon key + sesión del usuario. Esto se apoya en
 * las políticas `*_admin_all` (migración 0014) para que un usuario
 * autenticado como admin pueda leer/escribir todo igual.
 *
 * USO EXCLUSIVO EN SERVIDOR (server actions, route handlers, server
 * components): el fallback llama a `cookies()` de next/headers.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL no está configurada.')
  }

  if (serviceKey && serviceKey.length > 0) {
    return createSupabaseClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  // Fallback cookies-based. Las políticas admin_all en cada tabla
  // relevante permiten al admin autenticado leer/escribir todo.
  console.warn(
    '[supabase/admin] SUPABASE_SERVICE_ROLE_KEY ausente; cayendo a cliente ' +
      'cookies-based (depende de RLS admin_all).',
  )
  const cookieStore = cookies()
  return createServerClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Llamado desde un server component: ignorar; el middleware
          // refresca cookies.
        }
      },
    },
  })
}
