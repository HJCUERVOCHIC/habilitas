import { MODALIDAD } from '@/lib/compliance'
import { cn } from '@/lib/utils'

interface ComplianceNoticeProps {
  /** Estilo visual. `card` (default) = bloque info; `inline` = párrafo discreto. */
  variant?: 'card' | 'inline'
  className?: string
}

/**
 * Aviso largo de modalidad regulatoria (SPEC-CUMPLIMIENTO-P0 §3 R1).
 * Se muestra en detalle de curso, artefacto y verificación pública.
 * Texto único desde `MODALIDAD.avisoLargo`.
 */
export function ComplianceNotice({ variant = 'card', className }: ComplianceNoticeProps) {
  if (variant === 'inline') {
    return (
      <p className={cn('text-xs leading-relaxed text-ink-soft', className)}>
        <span className="font-semibold text-ink-main">{MODALIDAD.etiqueta}.</span>{' '}
        {MODALIDAD.avisoLargo}
      </p>
    )
  }
  return (
    <section
      aria-label="Modalidad"
      className={cn(
        'rounded-lg border border-amber/30 bg-amber-pale/50 p-5 text-sm leading-relaxed text-ink-main',
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-amber">
        {MODALIDAD.etiqueta} · {MODALIDAD.norma}
      </p>
      <p className="mt-2">{MODALIDAD.avisoLargo}</p>
    </section>
  )
}
