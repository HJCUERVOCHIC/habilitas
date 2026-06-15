import { cn } from '@/lib/utils'
import {
  CATEGORY_TEXT_CLASS,
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_LEVEL,
  type Category,
} from '@/lib/categories'

/** Pill / chip neutral reutilizable. */
export function Badge({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-mist px-2.5 py-0.5 text-xs font-medium text-ink-soft',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Etiqueta de categoría con su color semántico (cert-category). */
export function CategoryBadge({
  category,
  className,
}: {
  category: Category
  className?: string
}) {
  return (
    <span
      className={cn(
        'text-xs font-semibold uppercase tracking-wide',
        CATEGORY_TEXT_CLASS[category],
        className,
      )}
    >
      {CATEGORY_LABELS[category]}
    </span>
  )
}

/** Indicador de dificultad de 3 puntos. */
export function DifficultyDots({ difficulty }: { difficulty: string }) {
  const level = DIFFICULTY_LEVEL[difficulty] ?? 0
  const label = DIFFICULTY_LABELS[difficulty] ?? difficulty
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <span className="flex items-center gap-1" aria-hidden="true">
        {[1, 2, 3].map((dot) => (
          <span
            key={dot}
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              dot <= level ? 'bg-teal' : 'bg-border',
            )}
          />
        ))}
      </span>
      <span className="text-xs text-ink-soft">{label}</span>
    </span>
  )
}
