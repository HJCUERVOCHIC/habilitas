'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { EnrollmentRow, EvalStatus } from '@/lib/enrollments-admin'

type SortKey = 'progress' | 'activity'
type FilterKey = 'all' | 'active' | 'finished' | 'not-started' | 'blocked'

const EVAL_LABEL: Record<EvalStatus, string> = {
  none: 'Sin intentos',
  'in-progress': 'En curso',
  passed: 'Aprobado',
  failed: 'Reprobado',
  blocked: 'Bloqueado',
}

const EVAL_TONE: Record<EvalStatus, string> = {
  none: 'bg-mist text-ink-soft',
  'in-progress': 'bg-amber-pale text-amber',
  passed: 'bg-green-pale text-green-ok',
  failed: 'bg-red-pale text-red-err',
  blocked: 'bg-red-pale text-red-err',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso))
}

/**
 * Vista de inscritos por curso (SPEC-INSCRIPCIONES-SEGUIMIENTO §1.1).
 * Ordenamiento y filtrado ocurren client-side sobre los datos ya
 * agregados en el servidor — la promesa "sin N+1" (§2 CA-5) se cumple
 * al cargar la página, no al interactuar con la tabla.
 */
export function EnrollmentsTable({ rows }: { rows: EnrollmentRow[] }) {
  const [sort, setSort] = useState<SortKey>('progress')
  const [filter, setFilter] = useState<FilterKey>('all')

  const filtered = useMemo(() => {
    let list = rows
    if (filter === 'active') list = list.filter((r) => r.cert === null && r.evalStatus !== 'blocked')
    else if (filter === 'finished') list = list.filter((r) => r.cert !== null || r.evalStatus === 'passed')
    else if (filter === 'not-started')
      list = list.filter((r) => r.lessonsCompleted === 0 && r.evalStatus === 'none')
    else if (filter === 'blocked') list = list.filter((r) => r.evalStatus === 'blocked')

    const sorted = [...list]
    if (sort === 'progress') sorted.sort((a, b) => b.progressPct - a.progressPct)
    else
      sorted.sort((a, b) => {
        const av = a.lastActivityAt ?? ''
        const bv = b.lastActivityAt ?? ''
        return bv.localeCompare(av)
      })
    return sorted
  }, [rows, filter, sort])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-ink-soft">Ordenar por</span>
          <select
            className="rounded-md border border-border bg-white px-2 py-1"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="progress">Progreso</option>
            <option value="activity">Última actividad</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-ink-soft">Estado</span>
          <select
            className="rounded-md border border-border bg-white px-2 py-1"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterKey)}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="finished">Finalizados</option>
            <option value="not-started">Sin iniciar</option>
            <option value="blocked">Bloqueados</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-border bg-white p-6 text-center text-ink-soft">
          No hay inscritos que coincidan con el filtro.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-mist text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Persona</th>
                <th className="px-4 py-3">Inscripción</th>
                <th className="px-4 py-3">Progreso</th>
                <th className="px-4 py-3">Última actividad</th>
                <th className="px-4 py-3">Evaluación</th>
                <th className="px-4 py-3">Constancia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.userId}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/estudiantes/${r.userId}`}
                      className="font-medium text-charcoal hover:text-teal"
                    >
                      {r.fullName}
                    </Link>
                    {r.email && <p className="text-xs text-ink-soft">{r.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(r.enrolledAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded-full bg-mist">
                        <div
                          className="h-full rounded-full bg-teal"
                          style={{ width: `${r.progressPct}%` }}
                        />
                      </div>
                      <span className="text-xs text-ink-soft">
                        {r.lessonsCompleted}/{r.lessonsTotal} · {r.progressPct}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(r.lastActivityAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${EVAL_TONE[r.evalStatus]}`}
                    >
                      {EVAL_LABEL[r.evalStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.cert === null ? (
                      <span className="text-ink-muted">No emitida</span>
                    ) : r.cert.status === 'revoked' ? (
                      <span className="text-red-err">Revocada · {r.cert.certId}</span>
                    ) : (
                      <span className="font-mono text-ink-soft">{r.cert.certId}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
