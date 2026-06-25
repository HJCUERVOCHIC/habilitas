import { MODALIDAD } from '@/lib/compliance'
import { cn } from '@/lib/utils'

/**
 * Etiqueta compacta "Educación informal" para tarjeta de catálogo y otros
 * lugares donde aplica el `avisoCorto` (SPEC-CUMPLIMIENTO-P0 §3 R1).
 * El texto completo del aviso queda disponible vía `title` para que un
 * lector pueda inspeccionarlo sin saturar la card.
 */
export function ModalityBadge({ className }: { className?: string }) {
  return (
    <span
      title={MODALIDAD.avisoCorto}
      className={cn(
        'inline-flex items-center rounded-full border border-amber/40 bg-amber-pale px-2.5 py-0.5 text-xs font-medium text-amber',
        className,
      )}
    >
      {MODALIDAD.etiqueta}
    </span>
  )
}
