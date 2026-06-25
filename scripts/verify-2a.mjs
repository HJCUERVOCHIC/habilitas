// Verifica que la migración 0006 (sub-slice 2a) esté aplicada:
//   - courses: professional_profile, methodology, completion_rule
//   - users:   credential, bio
//   - vista instructors_public expone credential y bio
// Uso: node --env-file=.env.local scripts/verify-2a.mjs
import { Client } from 'pg'

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('✗ Falta SUPABASE_DB_URL (ver .env.local.example).')
  process.exit(1)
}

const EXPECTED_COURSE_COLS = ['professional_profile', 'methodology', 'completion_rule']
const EXPECTED_USER_COLS = ['credential', 'bio']
const EXPECTED_VIEW_COLS = ['id', 'full_name', 'profession', 'credential', 'bio']

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
let failures = 0
const ok = (msg) => console.log('  ✓', msg)
const fail = (msg) => {
  console.log('  ✗', msg)
  failures++
}

async function tableColumns(table) {
  const { rows } = await client.query(
    `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = $1`,
    [table],
  )
  return new Set(rows.map((r) => r.column_name))
}

try {
  await client.connect()

  console.log('courses (R4, R5):')
  const courseCols = await tableColumns('courses')
  for (const col of EXPECTED_COURSE_COLS) {
    courseCols.has(col) ? ok(`courses.${col}`) : fail(`falta courses.${col}`)
  }

  console.log('users (R6):')
  const userCols = await tableColumns('users')
  for (const col of EXPECTED_USER_COLS) {
    userCols.has(col) ? ok(`users.${col}`) : fail(`falta users.${col}`)
  }

  console.log('vista instructors_public:')
  const viewCols = await tableColumns('instructors_public')
  for (const col of EXPECTED_VIEW_COLS) {
    viewCols.has(col)
      ? ok(`instructors_public.${col}`)
      : fail(`falta instructors_public.${col}`)
  }

  // Grant a anon (la vista debe ser legible públicamente para el detalle).
  const { rows: grants } = await client.query(
    `select grantee from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'instructors_public' and privilege_type = 'SELECT'`,
  )
  const grantees = new Set(grants.map((g) => g.grantee))
  console.log('grants:')
  grantees.has('anon')
    ? ok('SELECT on instructors_public to anon')
    : fail('falta GRANT SELECT on instructors_public to anon')
  grantees.has('authenticated')
    ? ok('SELECT on instructors_public to authenticated')
    : fail('falta GRANT SELECT on instructors_public to authenticated')

  console.log('')
  if (failures === 0) {
    console.log('✓ Sub-slice 2a verificado correctamente.')
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
