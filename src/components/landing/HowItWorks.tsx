const STEPS = [
  {
    title: 'Elige',
    description: 'Explora el catálogo y elige la habilidad clínica que quieres aprender.',
  },
  {
    title: 'Estudia',
    description: 'Avanza por módulos y lecciones a tu ritmo, con desbloqueo progresivo.',
  },
  {
    title: 'Evalúate',
    description: 'Aprueba la evaluación final con un banco de preguntas y temporizador.',
  },
  {
    title: 'Comparte',
    description: 'Obtén tu constancia con URL pública y QR para verificación inmediata.',
  },
]

/** "Cómo funciona" — 4 pasos (RF-1.2). */
export function HowItWorks() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-section py-hero">
        <h2 className="font-display text-display-lg text-charcoal">Cómo funciona</h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-pale font-display text-lg text-teal">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-charcoal">{step.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
