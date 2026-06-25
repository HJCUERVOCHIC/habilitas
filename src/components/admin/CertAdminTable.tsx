'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { revokeCertificate } from '@/app/admin/actions'
import { Button } from '@/components/ui/Button'
import { getCertStatus, CERT_STATUS_META } from '@/lib/cert-states'
import { cn } from '@/lib/utils'
import type { CertStatus } from '@/types/cert'

export interface AdminCert {
  cert_id: string
  verification_id: string | null
  professional_name: string
  status: string
  expires_at: string
  score: number
  courseTitle: string
}

const TEXT: Record<CertStatus, string> = {
  valid: 'text-green-ok',
  expired: 'text-amber',
  revoked: 'text-red-err',
}

export function CertAdminTable({ certs }: { certs: AdminCert[] }) {
  if (certs.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-white p-6 text-center text-ink-soft">
        No hay constancias emitidas.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      {certs.map((cert) => (
        <CertRow key={cert.cert_id} cert={cert} />
      ))}
    </div>
  )
}

function CertRow({ cert }: { cert: AdminCert }) {
  const router = useRouter()
  const status: CertStatus = getCertStatus(cert)
  const [revoking, setRevoking] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirmRevoke() {
    setBusy(true)
    setError('')
    const res = await revokeCertificate(cert.cert_id, reason)
    setBusy(false)
    if (res.ok) {
      setRevoking(false)
      router.refresh()
    } else {
      setError(res.error ?? 'Error')
    }
  }

  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-charcoal">
            <span className="font-mono text-sm">{cert.cert_id}</span> · {cert.professional_name}
          </p>
          <p className="text-sm text-ink-soft">
            {cert.courseTitle} · {cert.score}% ·{' '}
            <span className={cn('font-medium', TEXT[status])}>{CERT_STATUS_META[status].label}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/verificar/${cert.verification_id ?? cert.cert_id}`}
            className="text-sm text-teal hover:text-teal-light"
          >
            Ver
          </Link>
          {status !== 'revoked' && !revoking && (
            <Button variant="ghost" size="sm" onClick={() => setRevoking(true)}>
              Revocar
            </Button>
          )}
        </div>
      </div>

      {revoking && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <input
            className="flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-ring"
            placeholder="Razón de la revocación"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button variant="primary" size="sm" onClick={confirmRevoke} disabled={busy || !reason.trim()}>
            {busy ? '…' : 'Confirmar'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRevoking(false)}>
            Cancelar
          </Button>
          {error && <span className="text-xs text-red-err">{error}</span>}
        </div>
      )}
    </div>
  )
}
