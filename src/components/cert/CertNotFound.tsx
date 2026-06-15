import Link from 'next/link'

import { Button } from '@/components/ui/Button'

/**
 * Pantalla "Certificado no encontrado" (HABILITAS-ESPECIFICACION §5.6 RF-6.5).
 * Se muestra con estado 200 (no es un error 500).
 */
export function CertNotFound({ id }: { id: string }) {
  return (
    <div className="mx-auto max-w-md px-6 py-hero text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-mist">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-muted"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <h1 className="font-display text-display-sm text-charcoal">Certificado no encontrado</h1>
      <p className="mt-3 text-ink-soft">
        No existe un certificado con el identificador{' '}
        <span className="font-mono text-ink-main">{id}</span>. Verifica el enlace o el código QR.
      </p>
      <div className="mt-8">
        <Button asChild variant="primary">
          <Link href="/certificaciones">Ver certificaciones</Link>
        </Button>
      </div>
    </div>
  )
}
