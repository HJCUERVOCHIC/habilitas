import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

/**
 * Cliente de Supabase para datos públicos (catálogo, detalle) en rutas ISR/SSG.
 * NO lee cookies, por lo que no fuerza render dinámico y permite el cacheo ISR.
 * Solo accede a datos con RLS de lectura pública (cursos publicados, vistas).
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
