import Link from 'next/link'

import { CERT_STATUS_META, getCertStatus } from '@/lib/cert-states'
import { cn } from '@/lib/utils'
import type { CertStatus } from '@/types/cert'

export interface CertListItem {
  cert_id: string
  verification_id: string | null
  status: string
  expires_at: string
  score: number
  issued_at: string
  courseTitle: string
}

const DOT: Record<CertStatus, string> = {
  valid: 'bg-green-ok',
  expired: 'bg-amber',
  revoked: 'bg-red-err',
}

const TEXT: Record<CertStatus, string> = {
  valid: 'text-green-ok',
  expired: 'text-amber',
  revoked: 'text-red-err',
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso))
}

/** Tarjeta horizontal de certificado en el perfil (§5.7 RF-7.3). */
export function CertListCard({ cert }: { cert: CertListItem }) {
  const status: CertStatus = getCertStatus(cert)
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', DOT[status])} aria-hidden="true" />
          <span className={cn('text-xs font-semibold uppercase tracking-wide', TEXT[status])}>
            {CERT_STATUS_META[status].label}
          </span>
        </div>
        <p className="mt-1 truncate font-medium text-charcoal">{cert.courseTitle}</p>
        <p className="text-sm text-ink-soft">
          <span className="font-mono">{cert.cert_id}</span> · emitido {formatDate(cert.issued_at)} ·
          vigencia {formatDate(cert.expires_at)}
        </p>
      </div>
      <Link
        href={`/verificar/${cert.verification_id ?? cert.cert_id}`}
        className="shrink-0 text-sm font-medium text-teal hover:text-teal-light"
      >
        Ver →
      </Link>
    </div>
  )
}
