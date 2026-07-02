import Link from 'next/link'

import { enrollCourse } from '@/app/certificaciones/[slug]/actions'
import { Button } from '@/components/ui/Button'

interface PurchaseCardProps {
  slug: string
  validityDays: number
  /** True si el usuario autenticado ya está inscrito en este curso. */
  enrolled?: boolean
  /** True si el usuario autenticado es admin (roles excluyentes, Bloque 0). */
  isAdmin?: boolean
}

/**
 * Card de inscripción del detalle (SPEC-CATALOGO-INSCRIPCION §1.2):
 *   - Visitante o estudiante no inscrito → "Inscribirme" (server action).
 *   - Estudiante ya inscrito → "Continuar curso" (link al reproductor).
 *   - Admin → aviso de rol excluyente.
 * Precio siempre etiquetado "Gratis durante el lanzamiento" (D2).
 */
export function PurchaseCard({ slug, validityDays, enrolled, isAdmin }: PurchaseCardProps) {
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

      <div className="mt-6">
        {isAdmin ? (
          <AdminNotice slug={slug} />
        ) : enrolled ? (
          <Button asChild variant="primary" size="lg" className="w-full">
            <Link href={`/curso/${slug}`}>Continuar curso</Link>
          </Button>
        ) : (
          <form action={enrollCourse}>
            <input type="hidden" name="slug" value={slug} />
            <Button type="submit" variant="primary" size="lg" className="w-full">
              Inscribirme
            </Button>
          </form>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-ink-muted">
        {enrolled
          ? 'Ya estás inscrito. Retoma donde lo dejaste.'
          : isAdmin
            ? 'Los administradores no se inscriben.'
            : 'Inscripción sin costo durante el lanzamiento.'}
      </p>
    </div>
  )
}

function AdminNotice({ slug }: { slug: string }) {
  return (
    <div className="rounded-md border border-amber/30 bg-amber-pale p-3 text-xs text-ink-main">
      <p className="font-medium">Estás en modo administrador.</p>
      <p className="mt-1">
        Los roles son excluyentes: un admin no se inscribe. Para editar el curso, ve al{' '}
        <Link
          href={`/admin/cursos/${slug}`}
          className="font-medium text-teal hover:text-teal-light"
        >
          panel admin
        </Link>
        .
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
