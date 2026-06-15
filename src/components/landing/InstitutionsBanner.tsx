import { Button } from '@/components/ui/Button'

/** Banner para instituciones con CTA de contacto (RF-1.3). Color sólido charcoal. */
export function InstitutionsBanner() {
  return (
    <section className="bg-charcoal">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-section py-hero sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <h2 className="font-display text-2xl text-white">¿Eres una IPS, clínica u hospital?</h2>
          <p className="mt-2 text-teal-mid">
            Certifica y verifica las competencias clínicas de tu equipo, sin llamadas ni trámites.
          </p>
        </div>
        <Button asChild variant="outline-white" size="lg">
          <a href="mailto:instituciones@habilitas.co">Contáctanos</a>
        </Button>
      </div>
    </section>
  )
}
