'use client'

import { useMemo, useState } from 'react'

import { CertCard, type CatalogCourse } from '@/components/cert/CertCard'
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/lib/categories'
import { cn } from '@/lib/utils'

type Filter = Category | 'todas'

/**
 * Catálogo con filtro client-side por categoría (HABILITAS-ESPECIFICACION
 * §5.2 RF-2.2/RF-2.3). El filtro opera sobre el conjunto ya cargado.
 */
export function CatalogClient({ courses }: { courses: CatalogCourse[] }) {
  const [selected, setSelected] = useState<Filter>('todas')

  const presentCategories = useMemo(
    () => CATEGORIES.filter((cat) => courses.some((course) => course.category === cat)),
    [courses],
  )

  const filtered =
    selected === 'todas' ? courses : courses.filter((course) => course.category === selected)

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
        <FilterButton active={selected === 'todas'} onClick={() => setSelected('todas')}>
          Todas
        </FilterButton>
        {presentCategories.map((cat) => (
          <FilterButton key={cat} active={selected === cat} onClick={() => setSelected(cat)}>
            {CATEGORY_LABELS[cat]}
          </FilterButton>
        ))}
      </div>

      <p className="mt-4 text-sm text-ink-soft" aria-live="polite">
        {filtered.length}{' '}
        {filtered.length === 1 ? 'curso disponible' : 'cursos disponibles'}
      </p>

      {filtered.length > 0 ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <CertCard key={course.slug} course={course} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-center text-ink-muted">
          No hay cursos en esta categoría todavía.
        </p>
      )}
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-teal text-white'
          : 'border border-border bg-white text-ink-main hover:bg-mist',
      )}
    >
      {children}
    </button>
  )
}
