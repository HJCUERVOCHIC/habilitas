import QRCode from 'qrcode'

import { CertDocument } from '@/components/cert/CertDocument'
import { CertNotFound } from '@/components/cert/CertNotFound'
import { CopyLinkButton } from '@/components/cert/CopyLinkButton'
import { VerifyBanner } from '@/components/cert/VerifyBanner'
import { ComplianceNotice } from '@/components/compliance/ComplianceNotice'
import { Button } from '@/components/ui/Button'
import { PublicShell } from '@/components/layout/PublicShell'
import { VerifyTopbar } from '@/components/layout/VerifyTopbar'
import { getCertStatus } from '@/lib/cert-states'
import { getSessionAndRole } from '@/lib/require-admin'
import { createClient } from '@/lib/supabase/server'
import type { CertCourse } from '@/types/cert'
import Link from 'next/link'

// SSR obligatorio: el estado del certificado debe ser tiempo real, sin caché
// (HABILITAS-STACK.md §9, HABILITAS-ESPECIFICACION §5.6 RF-6.1).
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function VerificarPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  // Lectura pública acotada por cert_id vía función security definer
  // (get_certificate) — no expone la tabla completa. Usa el snapshot de
  // certificates; no joins en vivo de datos del usuario o el instructor.
  const { data: cert } = await supabase.rpc('get_certificate', { p_cert_id: params.id })

  // Sesión para adaptar el shell y el enlace de retorno. Esto NO cambia
  // qué se muestra del certificado (la verificación pública no expone datos
  // adicionales por tener sesión); solo la navegación de contexto:
  //   - estudiante autenticado → AppNav + "Mis cursos" → /mis-cursos.
  //   - visitante anónimo o admin → VerifyTopbar + "Ver cursos" → catálogo.
  const { user, isAdmin } = await getSessionAndRole()
  const isStudent = Boolean(user) && !isAdmin

  // La función devuelve un composite con campos null cuando no hay match;
  // tratamos cert_id ausente como "no encontrado".
  if (!cert || !cert.cert_id) {
    return (
      <>
        <PublicShell fallback={<VerifyTopbar />} />
        <main className="bg-sand">
          <CertNotFound id={params.id} />
        </main>
      </>
    )
  }

  // La "habilidad" es el título del curso. Preferimos el SNAPSHOT guardado
  // al emitir (SPEC-INSCRIPCIONES-SEGUIMIENTO §1.6, H5): la constancia es
  // auditable con independencia de cambios posteriores en el curso vivo. La
  // categoría no está en el snapshot (no se usa como campo legal) y se
  // consulta viva sin bloquear el render si el curso fue archivado.
  const { data: liveCourse } = await supabase
    .from('courses')
    .select('title, category')
    .eq('id', cert.course_id)
    .maybeSingle<CertCourse>()

  const course: CertCourse | null = cert.course_title_snapshot
    ? {
        title: cert.course_title_snapshot,
        category: liveCourse?.category ?? '',
      }
    : liveCourse

  const status = getCertStatus(cert)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const verifyUrl = cert.verify_url ?? `${siteUrl}/verificar/${cert.cert_id}`
  const qrSvg = await QRCode.toString(verifyUrl, {
    type: 'svg',
    margin: 1,
    color: { dark: '#1A2A2A', light: '#FFFFFF' },
  })

  return (
    <>
      <PublicShell fallback={<VerifyTopbar />} />
      <main className="bg-sand">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-12">
          <VerifyBanner status={status} />
          <ComplianceNotice />
          <CertDocument
            cert={cert}
            course={course}
            status={status}
            qrSvg={qrSvg}
            verifyUrl={verifyUrl}
          />
          <div className="flex items-center justify-center gap-4">
            <CopyLinkButton url={verifyUrl} />
            <Button asChild variant="ghost">
              {isStudent ? (
                <Link href="/mis-cursos">Mis cursos</Link>
              ) : (
                <Link href="/certificaciones">Ver cursos</Link>
              )}
            </Button>
          </div>
        </div>
      </main>
    </>
  )
}
