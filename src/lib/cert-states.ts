import type { CertStatus } from '@/types/cert'

/**
 * Calcula el estado del certificado en runtime (HABILITAS-ESPECIFICACION §6.5):
 *   revoked  → status === 'revoked'
 *   expired  → expires_at <= ahora
 *   valid    → en otro caso
 * El estado `expired` NO se persiste; se deriva comparando con la hora actual.
 */
export function getCertStatus(
  cert: { status: string; expires_at: string },
  now: Date = new Date(),
): CertStatus {
  if (cert.status === 'revoked') return 'revoked'
  if (new Date(cert.expires_at).getTime() <= now.getTime()) return 'expired'
  return 'valid'
}

/** Etiqueta y descripción por estado (para el banner de verificación). */
export const CERT_STATUS_META: Record<
  CertStatus,
  { label: string; description: string }
> = {
  valid: {
    label: 'Válido y vigente',
    description: 'Este certificado es auténtico y se encuentra vigente.',
  },
  expired: {
    label: 'Vencido',
    description: 'Este certificado fue auténtico pero su vigencia ya expiró.',
  },
  revoked: {
    label: 'Revocado',
    description: 'Este certificado fue revocado y ya no es válido.',
  },
}
