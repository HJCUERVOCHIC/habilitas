'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { PublishToggle } from '@/components/admin/PublishToggle'
import { getCategoryLabelStatic } from '@/lib/categories'

const FIELD =
  'rounded-md border border-border bg-white px-3 py-2 text-sm text-ink-main outline-none focus:border-teal focus:ring-2 focus:ring-ring'

export type CourseStatus = 'draft' | 'published' | 'archived'

export interface CourseIndexRow {
  id: string
  slug: string
  title: string
  category: string
  difficulty: string | null
  status: CourseStatus
}

interface CoursesIndexProps {
  courses: CourseIndexRow[]
  categoryLabels: Record<string, string>
}

const STATUS_LABEL: Record<CourseStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  archived: 'Archivado',
}

const DIFFICULTY_LABEL: Record<string, string> = {
  basico: 'Básico',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

/**
 * Listado admin de cursos con búsqueda y filtros combinables
 * (SPEC-ESTUDIANTES-CLASIFICACION §1.4). Filtro client-side sobre el
 * conjunto ya cargado — el volumen del MVP no requiere paginación.
 *
 * La búsqueda por título es insensible a mayúsculas y acentos, coherente
 * con el índice de estudiantes (§1.1).
 */
export function CoursesIndex({ courses, categoryLabels }: CoursesIndexProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<CourseStatus | 'all'>('all')
  const [categorySlug, setCategorySlug] = useState<string>('all')
  const [difficulty, setDifficulty] = useState<string>('all')

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of courses) {
      if (!map.has(c.category)) {
        map.set(c.category, categoryLabels[c.category] ?? getCategoryLabelStatic(c.category))
      }
    }
    return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }))
  }, [courses, categoryLabels])

  const filtered = useMemo(() => {
    const needle = normalize(query)
    return courses.filter((c) => {
      if (status !== 'all' && c.status !== status) return false
      if (categorySlug !== 'all' && c.category !== categorySlug) return false
      if (difficulty !== 'all' && (c.difficulty ?? '') !== difficulty) return false
      if (needle && !normalize(c.title).includes(needle)) return false
      return true
    })
  }, [courses, query, status, categorySlug, difficulty])

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-lg border border-border bg-white p-4 shadow-sm sm:grid-cols-4">
        <label className="block text-sm sm:col-span-4">
          <span className="mb-1 block text-xs uppercase tracking-wide text-ink-muted">
            Buscar por título
          </span>
          <input
            className={`${FIELD} w-full`}
            placeholder="Nombre del curso…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar cursos por título"
          />
        </label>
        <FilterSelect
          label="Estado"
          value={status}
          onChange={(v) => setStatus(v as CourseStatus | 'all')}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'draft', label: 'Borrador' },
            { value: 'published', label: 'Publicado' },
            { value: 'archived', label: 'Archivado' },
          ]}
        />
        <FilterSelect
          label="Categoría"
          value={categorySlug}
          onChange={setCategorySlug}
          options={[
            { value: 'all', label: 'Todas' },
            ...categoryOptions.map((c) => ({ value: c.slug, label: c.label })),
          ]}
        />
        <FilterSelect
          label="Nivel"
          value={difficulty}
          onChange={setDifficulty}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'basico', label: 'Básico' },
            { value: 'intermedio', label: 'Intermedio' },
            { value: 'avanzado', label: 'Avanzado' },
          ]}
        />
      </div>

      <p className="text-xs text-ink-soft" aria-live="polite">
        {filtered.length} de {courses.length}{' '}
        {filtered.length === 1 ? 'curso' : 'cursos'}
      </p>

      <div className="space-y-3">
        {filtered.map((course) => (
          <CourseRow
            key={course.id}
            course={course}
            categoryLabel={
              categoryLabels[course.category] ?? getCategoryLabelStatic(course.category)
            }
          />
        ))}
        {filtered.length === 0 && (
          <p className="rounded-lg border border-border bg-white p-6 text-center text-ink-soft">
            No hay cursos que coincidan con los filtros.
          </p>
        )}
      </div>
    </div>
  )
}

function CourseRow({
  course,
  categoryLabel,
}: {
  course: CourseIndexRow
  categoryLabel: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <Link
          href={`/admin/cursos/${course.slug}`}
          className="font-medium text-charcoal hover:text-teal"
        >
          {course.title}
        </Link>
        <p className="text-xs text-ink-muted">
          {categoryLabel}
          {course.difficulty && ` · ${DIFFICULTY_LABEL[course.difficulty] ?? course.difficulty}`}
        </p>
      </div>
      {course.status === 'published' ? (
        <PublishToggle courseId={course.id} published={true} />
      ) : course.status === 'archived' ? (
        <span className="rounded-md bg-mist px-2.5 py-1 text-xs font-semibold text-ink-soft">
          {STATUS_LABEL.archived}
        </span>
      ) : (
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-mist px-2.5 py-1 text-xs font-semibold text-ink-soft">
            {STATUS_LABEL.draft}
          </span>
          <Link
            href={`/admin/cursos/${course.slug}`}
            className="text-sm font-medium text-teal hover:text-teal-light"
          >
            Configurar para publicar →
          </Link>
        </div>
      )}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      <select
        className={`${FIELD} w-full`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Filtrar por ${label.toLowerCase()}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
