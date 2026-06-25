import { enrollCourse } from '@/app/certificaciones/[slug]/actions'
import { Button } from '@/components/ui/Button'

/**
 * Purchase card — variante MVP (D2): precio etiquetado "Gratis durante el
 * lanzamiento", CTA "Comenzar curso", SIN sello de "pago seguro".
 */
export function PurchaseCard({ slug, validityDays }: { slug: string; validityDays: number }) {
  const validityMonths = Math.round(validityDays / 30)
  const inclusions = [
    'Acceso completo al contenido del curso',
    'Evaluación final con constancia verificable',
    `Constancia con vigencia de ${validityMonths} meses`,
    'Verificación pública por URL y QR',
  ]

  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-md">
      <p className="font-display text-display-sm leading-none text-charcoal">Gratis</p>
      <p className="mt-1 text-sm font-medium text-green-ok">durante el lanzamiento</p>

      <ul className="mt-5 space-y-2.5">
        {inclusions.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink-soft">
            <Check />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <form action={enrollCourse} className="mt-6">
        <input type="hidden" name="slug" value={slug} />
        <Button type="submit" variant="primary" size="lg" className="w-full">
          Comenzar curso
        </Button>
      </form>

      <p className="mt-3 text-center text-xs text-ink-muted">
        Inscripción sin costo durante el lanzamiento.
      </p>
    </div>
  )
}

function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0 text-teal"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
