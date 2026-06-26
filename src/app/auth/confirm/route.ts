import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

/**
 * Confirma el Magic Link / OTP y establece la sesión.
 * Soporta ambos formatos de enlace de Supabase:
 *  - PKCE: ?code=...                          → exchangeCodeForSession
 *  - Plantilla con token_hash: ?token_hash=&type= → verifyOtp
 *
 * IMPORTANTE: las cookies de sesión que escribe Supabase se adjuntan directamente
 * a la respuesta de redirección. (Si se usara el store de next/headers y luego se
 * devolviera un NextResponse.redirect nuevo, las cookies se perderían y el usuario
 * volvería a /ingresar sin sesión.)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  const redirectParam = searchParams.get('redirect') ?? searchParams.get('next') ?? '/dashboard'
  const next = redirectParam.startsWith('/') ? redirectParam : '/dashboard'

  // Acumula las cookies que Supabase quiera escribir para adjuntarlas a la
  // respuesta final (sea éxito o error).
  const pendingCookies: { name: string; value: string; options?: Record<string, unknown> }[] = []

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet)
        },
      },
    },
  )

  let errorMessage: string | null = null

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    errorMessage = error?.message ?? null
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    errorMessage = error?.message ?? null
  } else {
    errorMessage = 'enlace sin code ni token_hash (posible flujo implícito con #hash)'
  }

  // Enrutamiento por rol (SPEC-ROLES-ACCESO §1). Tras autenticar, leemos el
  // rol y decidimos destino:
  //   admin → /admin (honra ?redirect= solo si apunta a /admin/*)
  //   student → /dashboard (honra ?redirect= solo si NO apunta a /admin/*)
  let destination = next
  if (errorMessage === null) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      const isAdmin = profile?.role === 'admin'
      const requestedAdminPath = next.startsWith('/admin')
      if (isAdmin) {
        destination = requestedAdminPath ? next : '/admin'
      } else {
        destination = requestedAdminPath ? '/dashboard' : next
      }
    }
  }

  const target =
    errorMessage === null
      ? `${origin}${destination}`
      : `${origin}/ingresar?error=${encodeURIComponent('enlace-invalido')}`

  if (errorMessage) {
    console.error('[auth/confirm] fallo de verificación:', errorMessage)
  }

  const response = NextResponse.redirect(target)
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options)
  }
  return response
}
