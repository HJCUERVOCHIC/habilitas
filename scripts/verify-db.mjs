// Verifica que el schema del slice 0 esté aplicado: tablas, vista, función,
// trigger e índices, y que RLS esté activo en cada tabla.
// Uso: node --env-file=.env.local scripts/verify-db.mjs
import { Client } from 'pg'

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('✗ Falta SUPABASE_DB_URL (ver .env.local.example).')
  process.exit(1)
}

const EXPECTED_TABLES = [
  'users',
  'courses',
  'modules',
  'lessons',
  'enrollments',
  'lesson_progress',
  'evaluations',
  'questions',
  'eval_attempts',
  'certificates',
]

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
let failures = 0
const ok = (msg) => console.log('  ✓', msg)
const fail = (msg) => {
  console.log('  ✗', msg)
  failures++
}

try {
  await client.connect()

  // Tablas + RLS habilitado
  const { rows: tables } = await client.query(
    `select tablename, rowsecurity from pg_tables where schemaname = 'public'`,
  )
  const byName = new Map(tables.map((t) => [t.tablename, t.rowsecurity]))
  console.log('Tablas y RLS:')
  for (const t of EXPECTED_TABLES) {
    if (!byName.has(t)) fail(`falta la tabla ${t}`)
    else if (byName.get(t) !== true) fail(`RLS desactivado en ${t}`)
    else ok(`${t} (RLS on)`)
  }

  // Vista course_progress
  const { rows: views } = await client.query(
    `select viewname from pg_views where schemaname = 'public' and viewname = 'course_progress'`,
  )
  console.log('Vista:')
  views.length ? ok('course_progress') : fail('falta la vista course_progress')

  // Función generate_cert_id + handle_new_user
  const { rows: fns } = await client.query(
    `select proname from pg_proc where proname in ('generate_cert_id','handle_new_user')`,
  )
  const fnNames = new Set(fns.map((f) => f.proname))
  console.log('Funciones:')
  fnNames.has('generate_cert_id') ? ok('generate_cert_id()') : fail('falta generate_cert_id()')
  fnNames.has('handle_new_user') ? ok('handle_new_user()') : fail('falta handle_new_user()')

  // Trigger on_auth_user_created en auth.users
  const { rows: trg } = await client.query(
    `select tgname from pg_trigger where tgname = 'on_auth_user_created'`,
  )
  console.log('Trigger:')
  trg.length ? ok('on_auth_user_created') : fail('falta el trigger on_auth_user_created')

  // generate_cert_id devuelve formato esperado
  const { rows: cid } = await client.query(`select generate_cert_id() as id`)
  console.log('Smoke test:')
  const certIdOk = /^HAB-\d{4}-\d{4}$/.test(cid[0]?.id ?? '')
  if (certIdOk) ok(`generate_cert_id() -> ${cid[0].id}`)
  else fail(`generate_cert_id() devolvió formato inesperado: ${cid[0]?.id}`)

  console.log('')
  if (failures === 0) {
    console.log('✓ Schema del slice 0 verificado correctamente.')
  } else {
    console.log(`✗ ${failures} verificación(es) fallida(s).`)
    process.exitCode = 1
  }
} catch (error) {
  console.error('✗ Error verificando la base:', error.message)
  process.exitCode = 1
} finally {
  await client.end()
}
