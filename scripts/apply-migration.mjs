// Aplica una migración a la base apuntada por SUPABASE_DB_URL y recarga el
// schema cache de PostgREST.
// Uso: node --env-file=.env.local scripts/apply-migration.mjs [archivo.sql]
//   sin argumento → 0000_init.sql
import { readFileSync } from 'node:fs'
import { Client } from 'pg'

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('✗ Falta SUPABASE_DB_URL (ver .env.local.example).')
  process.exit(1)
}

const file = process.argv[2] ?? '0000_init.sql'
const sql = readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8')
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  await client.query(sql)
  // Forzar a PostgREST a refrescar el schema cache (para que el REST API vea
  // columnas/tablas nuevas de inmediato).
  await client.query(`notify pgrst, 'reload schema'`)
  console.log(`✓ Migración ${file} aplicada correctamente.`)
} catch (error) {
  console.error('✗ Error aplicando la migración:', error.message)
  process.exitCode = 1
} finally {
  await client.end()
}
