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
    label: 'Válida y vigente',
    description: 'Esta constancia es auténtica y se encuentra vigente.',
  },
  expired: {
    label: 'Vencida',
    description: 'Esta constancia fue auténtica pero su vigencia ya expiró.',
  },
  revoked: {
    label: 'Revocada',
    description: 'Esta constancia fue revocada y ya no es válida.',
  },
}
