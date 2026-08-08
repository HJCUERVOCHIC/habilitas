'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { StudentIndexRow } from '@/lib/enrollments-admin'

const FIELD =
  'rounded-md border border-border bg-white px-3 py-2 text-sm text-ink-main outline-none focus:border-teal focus:ring-2 focus:ring-ring'

const DEFAULT_LIMIT = 50

type SortKey = 'activity' | 'enrollments'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso))
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Índice admin de estudiantes con búsqueda y ordenamiento client-side
 * (SPEC-ESTUDIANTES-CLASIFICACION §1.1). La búsqueda por nombre o correo
 * es insensible a mayúsculas y acentos.
 *
 * §1.5 minimización: no expone documento de identidad ni RETHUS, no hay
 * exportación ni eliminación desde aquí.
 */
export function StudentsIndex({ rows }: { rows: StudentIndexRow[] }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('activity')
  const [showAll, setShowAll] = useState(false)

  const filtered = useMemo(() => {
    const needle = normalize(query)
    let list = rows
    if (needle) {
      list = list.filter((r) => {
        const name = normalize(r.fullName)
        const email = r.email ? normalize(r.email) : ''
        return name.includes(needle) || email.includes(needle)
      })
    }
    const sorted = [...list]
    if (sort === 'enrollments') {
      sorted.sort((a, b) => b.enrollmentsCount - a.enrollmentsCount)
    } else {
      sorted.sort((a, b) => {
        const av = a.lastActivityAt ?? ''
        const bv = b.lastActivityAt ?? ''
        return bv.localeCompare(av)
      })
    }
    return sorted
  }, [rows, query, sort])

  const displayed = showAll ? filtered : filtered.slice(0, DEFAULT_LIMIT)
  const hidden = filtered.length - displayed.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block flex-1 text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-ink-muted">
            Buscar por nombre o correo
          </span>
          <input
            className={`${FIELD} w-full`}
            placeholder="Nombre o correo…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowAll(false)
            }}
            aria-label="Buscar estudiantes"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-ink-muted">
            Ordenar por
          </span>
          <select
            className={FIELD}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="activity">Última actividad</option>
            <option value="enrollments">Inscripciones</option>
          </select>
        </label>
      </div>

      <p className="text-xs text-ink-soft" aria-live="polite">
        {filtered.length}{' '}
        {filtered.length === 1 ? 'estudiante' : 'estudiantes'} · mostrando{' '}
        {displayed.length}
      </p>

      {displayed.length === 0 ? (
        <p className="rounded-lg border border-border bg-white p-6 text-center text-ink-soft">
          Sin coincidencias.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-mist text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Persona</th>
                <th className="px-4 py-3">Inscritos</th>
                <th className="px-4 py-3">Completados</th>
                <th className="px-4 py-3">Vigentes</th>
                <th className="px-4 py-3">Última actividad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayed.map((r) => (
                <tr key={r.userId}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/estudiantes/${r.userId}`}
                      className="font-medium text-charcoal hover:text-teal"
                    >
                      {r.fullName}
                    </Link>
                    {r.email && (
                      <p className="text-xs text-ink-soft">{r.email}</p>
                    )}
                    {(r.profession || r.city) && (
                      <p className="text-xs text-ink-muted">
                        {[r.profession, r.city].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-main">{r.enrollmentsCount}</td>
                  <td className="px-4 py-3 text-ink-main">{r.completedCoursesCount}</td>
                  <td className="px-4 py-3 text-ink-main">{r.validCertificatesCount}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {formatDate(r.lastActivityAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hidden > 0 && (
        <div className="text-center">
          <button
            type="button"
            className="text-sm text-teal hover:underline"
            onClick={() => setShowAll(true)}
          >
            Ver {hidden} más
          </button>
        </div>
      )}
    </div>
  )
}
