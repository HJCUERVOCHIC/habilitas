/**
 * Helpers puros de la constancia (SPEC-CONSTANCIA-PERFIL §1.1 / decisión 3).
 * "Constancia de finalización" en el UI (ver `MODALIDAD.artefacto`); las tablas
 * y columnas mantienen su nombre técnico `certificates` por razones de
 * migración.
 */

const DAY_MS = 86_400_000

/**
 * Fecha de vencimiento = emisión + `validityDays` (spec decisión 3: la
 * vigencia arranca al emitir, NO al inscribirse ni al aprobar el intento).
 * Devuelve ISO 8601. `validityDays` debe ser ≥ 0; valores negativos se
 * tratan como 0 para no producir vencidos-al-emitir por accidente.
 */
export function certificateExpiresAt(issuedAt: Date | string, validityDays: number): string {
  const start = typeof issuedAt === 'string' ? new Date(issuedAt) : issuedAt
  const days = Math.max(0, Number.isFinite(validityDays) ? Math.floor(validityDays) : 0)
  return new Date(start.getTime() + days * DAY_MS).toISOString()
}

/**
 * URL pública de verificación. Prefiere `verificationId` (UUID inadivinable);
 * cae a `certId` (legible) solo por compatibilidad con constancias legacy.
 * Nota: `NEXT_PUBLIC_SITE_URL` puede venir vacía en dev; en tal caso la URL
 * queda relativa, lo que el navegador resuelve contra el host actual.
 */
export function certificateVerifyUrl(
  siteUrl: string,
  verificationId: string | null | undefined,
  certId: string,
): string {
  const base = siteUrl.trim().replace(/\/$/, '')
  const token = verificationId && verificationId.length > 0 ? verificationId : certId
  return `${base}/verificar/${token}`
}
