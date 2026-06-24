import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import type { Database } from '@/types/database'

/** Rutas que requieren sesión (HABILITAS-ESPECIFICACION §5.9 RF-9.3). */
const PROTECTED_PREFIXES = ['/curso', '/perfil', '/admin', '/dashboard', '/mis-cursos']

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/**
 * Refresca la sesión de Supabase en cada request y protege las rutas
 * autenticadas. Un usuario sin sesión que entra a /curso, /perfil o /admin es
 * redirigido a /ingresar con el destino original en `redirect`.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANTE: getUser() valida el token contra Supabase; no usar getSession()
  // en el servidor para decisiones de autorización.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  if (!user && isProtected(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/ingresar'
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
