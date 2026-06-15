import { CertAdminTable, type AdminCert } from '@/components/admin/CertAdminTable'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function AdminCertificadosPage() {
  const admin = createAdminClient()
  const { data: certs } = await admin
    .from('certificates')
    .select('cert_id, professional_name, status, expires_at, score, course_id')
    .order('issued_at', { ascending: false })

  const courseIds = Array.from(new Set((certs ?? []).map((c) => c.course_id)))
  const { data: courses } = courseIds.length
    ? await admin.from('courses').select('id, title').in('id', courseIds)
    : { data: [] }
  const titleById = new Map((courses ?? []).map((c) => [c.id, c.title]))

  const rows: AdminCert[] = (certs ?? []).map((c) => ({
    cert_id: c.cert_id,
    professional_name: c.professional_name,
    status: c.status,
    expires_at: c.expires_at,
    score: c.score,
    courseTitle: titleById.get(c.course_id) ?? 'Curso',
  }))

  return (
    <div>
      <h1 className="mb-6 font-display text-display-md text-charcoal">Certificados emitidos</h1>
      <CertAdminTable certs={rows} />
    </div>
  )
}
