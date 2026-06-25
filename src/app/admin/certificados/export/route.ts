import { toCsv } from '@/lib/csv'
import { getCertStatus } from '@/lib/cert-states'
import { getSessionAndRole } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

// SPEC-CUMPLIMIENTO-P1 §3 R8 — Exportación CSV de constancias emitidas para
// inspección administrativa. No incluye user_id ni correo (alineado con R3:
// la verificación / inspección no debe exponer identificadores internos).
export const dynamic = 'force-dynamic'

const HEADERS = [
  'id_constancia',
  'id_verificacion',
  'usuario',
  'curso',
  'horas',
  'puntaje',
  'fecha_emision',
  'fecha_expiracion',
  'estado',
  'fecha_revocacion',
  'razon_revocacion',
  'url_verificacion',
] as const

export async function GET() {
  const { isAdmin } = await getSessionAndRole()
  if (!isAdmin) {
    return new Response('Forbidden', { status: 403 })
  }

  const admin = createAdminClient()
  const { data: certs, error: certsError } = await admin
    .from('certificates')
    .select(
      'cert_id, verification_id, professional_name, status, expires_at, score, issued_at, course_id, duration_hours, revoked_at, revoke_reason, verify_url',
    )
    .order('issued_at', { ascending: false })

  if (certsError) {
    return new Response(`Error consultando constancias: ${certsError.message}`, { status: 500 })
  }

  const courseIds = Array.from(new Set((certs ?? []).map((c) => c.course_id)))
  const { data: courses } = courseIds.length
    ? await admin.from('courses').select('id, title').in('id', courseIds)
    : { data: [] }
  const titleById = new Map((courses ?? []).map((c) => [c.id, c.title]))

  const rows = (certs ?? []).map((c) => [
    c.cert_id,
    c.verification_id ?? '',
    c.professional_name,
    titleById.get(c.course_id) ?? '',
    c.duration_hours ?? '',
    c.score,
    c.issued_at,
    c.expires_at,
    getCertStatus(c),
    c.revoked_at ?? '',
    c.revoke_reason ?? '',
    c.verify_url ?? '',
  ])

  // BOM UTF-8: Excel en Windows necesita esta marca para respetar acentos.
  const body = '\uFEFF' + toCsv(HEADERS, rows)
  const filename = `constancias-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
