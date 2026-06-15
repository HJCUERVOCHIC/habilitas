// Asigna un rol a un usuario. Uso:
//   npm run admin:grant -- correo@dominio.co [admin|student|instructor]
import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]
const role = process.argv[3] ?? 'admin'
if (!email) {
  console.error('✗ Uso: npm run admin:grant -- correo@dominio.co [admin|student|instructor]')
  process.exit(1)
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
const user = list.users.find((u) => u.email === email)
if (!user) {
  console.error(`✗ No existe un usuario con el correo ${email}.`)
  process.exit(1)
}
const { error } = await admin.from('users').update({ role }).eq('id', user.id)
if (error) {
  console.error('✗', error.message)
  process.exit(1)
}
console.log(`✓ ${email} → ${role}`)
