import Link from 'next/link'

import { VerifyLookup } from '@/components/landing/VerifyLookup'
import { Button } from '@/components/ui/Button'

/** Hero de la landing (RF-1.1). h1 en DM Serif Display; CTA primario único. */
export function Hero() {
  return (
    <section className="bg-mist">
      <div className="mx-auto max-w-6xl px-section py-hero">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-teal">
            Constancias verificables de habilidades clínicas
          </p>
          <h1 className="font-display text-display-3xl text-charcoal">
            Demuestra lo que sabes hacer, con una constancia que cualquiera puede verificar.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">
            Estudia una habilidad clínica, apruébala en una evaluación y obtén una constancia con
            URL pública verificable en segundos —sin trámites.
          </p>

          <div className="mt-8">
            <Button asChild variant="primary" size="lg">
              <Link href="/certificaciones">Ver cursos</Link>
            </Button>
          </div>

          <div className="mt-6">
            <VerifyLookup />
          </div>
        </div>
      </div>
    </section>
  )
}
