import QRCode from 'qrcode'

import { CertDocument } from '@/components/cert/CertDocument'
import { CertNotFound } from '@/components/cert/CertNotFound'
import { CopyLinkButton } from '@/components/cert/CopyLinkButton'
import { VerifyBanner } from '@/components/cert/VerifyBanner'
import { Button } from '@/components/ui/Button'
import { VerifyTopbar } from '@/components/layout/VerifyTopbar'
import { getCertStatus } from '@/lib/cert-states'
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

  // La función devuelve un composite con campos null cuando no hay match;
  // tratamos cert_id ausente como "no encontrado".
  if (!cert || !cert.cert_id) {
    return (
      <>
        <VerifyTopbar />
        <main className="bg-sand">
          <CertNotFound id={params.id} />
        </main>
      </>
    )
  }

  // La "habilidad" es el título del curso (consulta separada, bien tipada).
  const { data: course } = await supabase
    .from('courses')
    .select('title, category')
    .eq('id', cert.course_id)
    .maybeSingle<CertCourse>()

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
      <VerifyTopbar />
      <main className="bg-sand">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-12">
          <VerifyBanner status={status} />
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
              <Link href="/certificaciones">Ver certificaciones</Link>
            </Button>
          </div>
        </div>
      </main>
    </>
  )
}
