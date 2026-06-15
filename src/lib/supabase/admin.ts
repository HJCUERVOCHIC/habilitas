import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

/**
 * Cliente con service role (omite RLS). USO EXCLUSIVO EN SERVIDOR (server actions,
 * route handlers). Nunca importar desde componentes cliente: la clave no es
 * NEXT_PUBLIC. Se usa para emitir certificados (la RLS no permite INSERT en
 * certificates a usuarios) y leer datos del instructor para el snapshot.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
