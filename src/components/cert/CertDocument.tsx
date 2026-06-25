import { ComplianceNotice } from '@/components/compliance/ComplianceNotice'
import { MODALIDAD } from '@/lib/compliance'
import type { CertCourse, Certificate, CertStatus } from '@/types/cert'

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(new Date(iso))
}

interface CertDocumentProps {
  cert: Certificate
  course: CertCourse | null
  status: CertStatus
  qrSvg: string
  verifyUrl: string
}

/**
 * Documento verificable del certificado (HABILITAS-ESPECIFICACION §5.6 RF-6.3).
 * Los datos del profesional e instructor provienen del SNAPSHOT en `certificates`,
 * no de joins en vivo. La "habilidad" es el título del curso.
 * El header es el ÚNICO lugar donde se usa el gradiente teal.
 */
export function CertDocument({ cert, course, status, qrSvg, verifyUrl }: CertDocumentProps) {
  const dimmed = status !== 'valid'

  return (
    <article
      className="overflow-hidden rounded-lg border border-border bg-white shadow-md"
      aria-label={`${MODALIDAD.artefacto} ${cert.cert_id}`}
    >
      {/* Header — único lugar permitido del gradiente teal */}
      <header className="gradient-cert-header flex items-center justify-between px-8 py-6 text-white">
        <div className="flex items-center gap-3">
          <Seal />
          <div>
            <p className="font-display text-2xl leading-none">Habilitas</p>
            <p className="text-sm text-teal-mid">{MODALIDAD.encabezadoArtefacto}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-teal-mid">{MODALIDAD.artefacto}</p>
          <p className="font-mono text-lg font-semibold">{cert.cert_id}</p>
        </div>
      </header>

      <div className={dimmed ? 'opacity-70' : undefined}>
        {/* Cuerpo */}
        <div className="px-8 py-8">
          <p className="text-sm uppercase tracking-wide text-text-soft">
            Se hace constar que
          </p>
          <h1 className="mt-1 font-display text-display-md text-charcoal">
            {cert.professional_name}
          </h1>
          {cert.professional_profession && (
            <p className="mt-1 text-ink-soft">{cert.professional_profession}</p>
          )}

          <dl className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field label="Curso finalizado" value={course?.title ?? '—'} />
            <Field label="Puntaje obtenido" value={`${cert.score}%`} />
            <Field label="Fecha de emisión" value={formatDate(cert.issued_at)} />
            <Field label="Vigencia hasta" value={formatDate(cert.expires_at)} />
          </dl>

          {/* Instructor validador */}
          <div className="mt-10 max-w-xs">
            <div className="border-t border-border pt-2">
              <p className="font-medium text-charcoal">{cert.instructor_name ?? '—'}</p>
              {cert.instructor_role && (
                <p className="text-sm text-ink-soft">{cert.instructor_role}</p>
              )}
              <p className="mt-1 text-xs uppercase tracking-wide text-ink-muted">
                Instructor validador
              </p>
            </div>
          </div>

          <ComplianceNotice className="mt-8" />
        </div>

        {/* Footer — QR + URL de verificación */}
        <footer className="flex items-center gap-5 border-t border-border bg-mist px-8 py-6">
          <div
            className="h-[120px] w-[120px] shrink-0 rounded-md bg-white p-2 shadow-sm [&_svg]:h-full [&_svg]:w-full"
            // QR generado en el servidor a partir de la URL de verificación.
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-charcoal">Verificación en línea</p>
            <p className="break-all text-sm text-ink-soft">{verifyUrl}</p>
            <p className="mt-2 text-xs text-ink-muted">
              Escanea el código o abre el enlace para confirmar el estado en tiempo real.
            </p>
          </div>
        </footer>
      </div>
    </article>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-ink-main">{value}</dd>
    </div>
  )
}

function Seal() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="text-white"
    >
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <circle cx="24" cy="24" r="15" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m17 24 5 5 9-11"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
