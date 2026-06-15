import { CERT_STATUS_META } from '@/lib/cert-states'
import type { CertStatus } from '@/types/cert'
import { cn } from '@/lib/utils'

/** Banner de estado del certificado (HABILITAS-ESPECIFICACION §5.6 RF-6.2). */
export function VerifyBanner({ status }: { status: CertStatus }) {
  const meta = CERT_STATUS_META[status]

  const styles: Record<CertStatus, string> = {
    valid: 'border-green-ok/30 bg-green-pale text-green-ok',
    expired: 'border-amber/30 bg-amber-pale text-amber',
    revoked: 'border-red-err/30 bg-red-pale text-red-err',
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-4 rounded-lg border px-6 py-4 shadow-sm',
        styles[status],
      )}
    >
      <span className="shrink-0" aria-hidden="true">
        <StatusIcon status={status} />
      </span>
      <div>
        <p className="text-lg font-semibold leading-tight">{meta.label}</p>
        <p className="text-sm text-ink-soft">{meta.description}</p>
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: CertStatus }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (status === 'valid') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="m8 12 3 3 5-6" />
      </svg>
    )
  }
  if (status === 'expired') {
    return (
      <svg {...common}>
        <path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  )
}
