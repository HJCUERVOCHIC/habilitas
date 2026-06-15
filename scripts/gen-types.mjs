// Genera src/types/database.ts desde el schema remoto con la Supabase CLI.
//
// Usa --project-id (API de plataforma, sin Docker). Requiere un access token:
//   SUPABASE_ACCESS_TOKEN=<token> npm run db:types
// El token se crea en https://supabase.com/dashboard/account/tokens
//
// Sin token, mantener src/types/database.ts sincronizado a mano con la migración.
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const PROJECT_REF = 'eauuevwrmtxekphqubpd'

if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error(
    '✗ Falta SUPABASE_ACCESS_TOKEN. Crea uno en el dashboard y expórtalo antes de correr este script.',
  )
  process.exit(1)
}

const result = spawnSync(
  'npx',
  ['--yes', 'supabase@latest', 'gen', 'types', 'typescript', '--project-id', PROJECT_REF],
  { encoding: 'utf8', shell: true, maxBuffer: 10 * 1024 * 1024 },
)

if (result.status !== 0 || !result.stdout) {
  console.error('✗ Error generando tipos:', result.stderr || result.error?.message)
  process.exit(1)
}

writeFileSync(new URL('../src/types/database.ts', import.meta.url), result.stdout)
console.log('✓ src/types/database.ts generado desde el schema remoto.')
