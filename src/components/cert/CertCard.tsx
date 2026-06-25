import Link from 'next/link'

import { ModalityBadge } from '@/components/compliance/ModalityBadge'
import { Button } from '@/components/ui/Button'
import { CategoryBadge, DifficultyDots } from '@/components/ui/Badge'
import { CATEGORY_BG_CLASS, isCategory } from '@/lib/categories'
import { cn } from '@/lib/utils'
import type { Tables } from '@/types/database'

export type CatalogCourse = Pick<
  Tables<'courses'>,
  'slug' | 'title' | 'description' | 'category' | 'duration_hours' | 'difficulty'
>

/**
 * Tarjeta de certificación del catálogo (HABILITAS-ESPECIFICACION §5.2 RF-2.1).
 * El color de la barra de acento y del botón corresponde a la categoría.
 * D2: el precio se etiqueta "Gratis durante el lanzamiento".
 */
export function CertCard({ course }: { course: CatalogCourse }) {
  const category = isCategory(course.category) ? course.category : null

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-border bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Barra de acento por categoría */}
      <div className={cn('h-1.5', category ? CATEGORY_BG_CLASS[category] : 'bg-border')} />

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-2">
          {category && <CategoryBadge category={category} />}
          <ModalityBadge />
        </div>

        <h3 className="mt-2 text-lg font-semibold text-charcoal">
          <Link href={`/certificaciones/${course.slug}`} className="hover:text-teal">
            {course.title}
          </Link>
        </h3>

        {course.description && (
          <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{course.description}</p>
        )}

        <div className="mt-4 flex items-center gap-4">
          {course.duration_hours != null && (
            <span className="text-xs text-ink-soft">{course.duration_hours} h</span>
          )}
          {course.difficulty && <DifficultyDots difficulty={course.difficulty} />}
        </div>

        <div className="mt-auto pt-5">
          <p className="text-sm font-medium text-green-ok">Gratis durante el lanzamiento</p>
          <div className="mt-3">
            {category ? (
              <Button asChild variant="cert" category={category} className="w-full">
                <Link href={`/certificaciones/${course.slug}`}>Ver detalle →</Link>
              </Button>
            ) : (
              <Button asChild variant="primary" className="w-full">
                <Link href={`/certificaciones/${course.slug}`}>Ver detalle →</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
