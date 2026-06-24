import { MODALIDAD } from '@/lib/compliance'

/**
 * Aviso de modalidad regulatoria que vive al pie del shell autenticado
 * (SPEC-NAVEGACION §2 entregable 4 + §3). El texto es fuente única.
 */
export function ComplianceFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-mist">
      <div className="mx-auto max-w-6xl px-6 py-6 text-center text-xs text-ink-soft">
        <p>{MODALIDAD.avisoCorto}</p>
      </div>
    </footer>
  )
}
