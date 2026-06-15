// Genera un Magic Link vía Admin API (NO envía correo, no usa el rate limit del
// SMTP integrado) y verifica que el trigger handle_new_user creó la fila en
// public.users. Uso:
//   node --env-file=.env.local scripts/test-auth.mjs tu@correo.com
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const email = process.argv[2]

if (!url || !serviceKey) {
  console.error('✗ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
if (!email) {
  console.error('✗ Pasá un correo: node --env-file=.env.local scripts/test-auth.mjs tu@correo.com')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// 1) Generar el enlace (crea el usuario si no existe → dispara el trigger)
const { data, error } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email,
  options: { redirectTo: `${siteUrl}/auth/confirm?redirect=/perfil` },
})

if (error) {
  console.error('✗ Error generando el enlace:', error.message)
  process.exit(1)
}

const userId = data.user?.id
const tokenHash = data.properties?.hashed_token

// 2) Verificar la fila en public.users (service role omite RLS)
const { data: profile, error: profileError } = await admin
  .from('users')
  .select('id, full_name, role')
  .eq('id', userId)
  .single()

console.log('Usuario auth.users:', userId)
if (profileError) {
  console.log('✗ public.users:', profileError.message, '(¿falló el trigger?)')
} else {
  console.log('✓ public.users creado por el trigger:', JSON.stringify(profile))
}

// 3) Enlace local que ejercita /auth/confirm (rama token_hash, sin PKCE)
const localLink = `${siteUrl}/auth/confirm?token_hash=${tokenHash}&type=magiclink&redirect=%2Fperfil`
console.log('\nAbrí este enlace en el navegador (con el dev server corriendo):\n')
console.log(localLink)
console.log('\nDeberías quedar autenticado en /perfil. El enlace es de un solo uso.')
