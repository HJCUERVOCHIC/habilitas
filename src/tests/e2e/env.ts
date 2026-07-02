/**
 * Cargador y guardarraíl de variables para la suite e2e.
 *
 * Diseño:
 *  - Lee EXCLUSIVAMENTE `.env.test.local` (nunca `.env.local`). Así los tests
 *    no pueden accidentalmente golpear el Supabase de producción aunque el
 *    operador tenga otras env vars cargadas.
 *  - Si falta cualquier variable, `hasE2eEnv=false` y las suites e2e se
 *    saltan con `describe.skipIf(!hasE2eEnv)` (CI queda en verde sin
 *    infraestructura).
 *  - Guardarraíl fuerte: si `E2E_SUPABASE_URL` apunta a un host hospedado
 *    (`.supabase.co`), se aborta salvo que `E2E_ALLOW_HOSTED=1` esté fijo
 *    explícitamente. Esto convierte "olvidé cambiar la URL" en un error duro,
 *    no en un `DELETE FROM courses` sobre prod.
 */

import fs from 'node:fs'
import path from 'node:path'

const ENV_FILE = '.env.test.local'

function loadDotenv(): void {
  const p = path.resolve(process.cwd(), ENV_FILE)
  if (!fs.existsSync(p)) return
  const content = fs.readFileSync(p, 'utf-8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!match) continue
    const key = match[1]!
    let value = match[2] ?? ''
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    // Solo setea si no está previamente definida (env explícita > archivo).
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadDotenv()

const url = process.env.E2E_SUPABASE_URL ?? ''
const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? ''
const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? ''
const dbUrl = process.env.E2E_SUPABASE_DB_URL ?? ''
const allowHosted = process.env.E2E_ALLOW_HOSTED === '1'

const missing: string[] = []
if (!url) missing.push('E2E_SUPABASE_URL')
if (!anonKey) missing.push('E2E_SUPABASE_ANON_KEY')
if (!serviceKey) missing.push('E2E_SUPABASE_SERVICE_ROLE_KEY')
if (!dbUrl) missing.push('E2E_SUPABASE_DB_URL')

export const hasE2eEnv = missing.length === 0

if (hasE2eEnv) {
  const isHosted = /\.supabase\.co(?::|\/|$)/.test(url)
  if (isHosted && !allowHosted) {
    throw new Error(
      `[e2e] E2E_SUPABASE_URL apunta a un host hospedado (${url}). ` +
        `Rechazo por defecto (defensa anti-prod). Si es un proyecto de test ` +
        `separado, agrega E2E_ALLOW_HOSTED=1 a .env.test.local.`,
    )
  }
}

export const E2E_URL = url
export const E2E_ANON_KEY = anonKey
export const E2E_SERVICE_KEY = serviceKey
export const E2E_DB_URL = dbUrl

/** Mensaje humano para logs cuando la suite se salta. */
export function e2eSkipReason(): string {
  if (hasE2eEnv) return ''
  return `Variables ausentes: ${missing.join(', ')}. Ver TESTING.md.`
}
