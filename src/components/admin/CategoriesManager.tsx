'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  createCategory,
  deleteCategory,
  updateCategory,
} from '@/app/admin/actions'
import { Button } from '@/components/ui/Button'

const FIELD =
  'rounded-md border border-border bg-white px-3 py-2 text-sm text-ink-main outline-none focus:border-teal focus:ring-2 focus:ring-ring'

export interface CategoryUiRow {
  id: string
  slug: string
  label: string
  orderIndex: number
  coursesCount: number
}

/**
 * CRUD de categorías (SPEC-ESTUDIANTES-CLASIFICACION §1.2). El slug se
 * guarda al crear y no se cambia después: se muestra para el admin en cada
 * fila como identificador estable.
 */
export function CategoriesManager({ rows }: { rows: CategoryUiRow[] }) {
  const router = useRouter()
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function add() {
    if (!newLabel.trim()) return
    setBusy(true)
    setError('')
    const res = await createCategory({ label: newLabel })
    setBusy(false)
    if (res.ok) {
      setNewLabel('')
      router.refresh()
    } else {
      setError(res.error ?? 'No se pudo crear.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Nueva categoría
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className={`${FIELD} flex-1`}
            placeholder='Nombre visible (ej. "Cuidados paliativos")'
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <Button variant="primary" size="sm" onClick={add} disabled={busy}>
            Añadir
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-red-err">{error}</p>}
        <p className="mt-2 text-xs text-ink-muted">
          El identificador (slug) se genera automáticamente y queda fijo.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-white p-6 text-center text-ink-soft">
          No hay categorías registradas.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-mist text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Cursos</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <CategoryRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CategoryRow({ row }: { row: CategoryUiRow }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(row.label)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!label.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setBusy(true)
    setError('')
    const res = await updateCategory(row.id, { label })
    setBusy(false)
    if (res.ok) {
      setEditing(false)
      router.refresh()
    } else {
      setError(res.error ?? 'No se pudo guardar.')
    }
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar la categoría "${row.label}"?`)) return
    setBusy(true)
    setError('')
    const res = await deleteCategory(row.id)
    setBusy(false)
    if (res.ok) {
      router.refresh()
    } else {
      setError(res.error ?? 'No se pudo eliminar.')
    }
  }

  return (
    <tr>
      <td className="px-4 py-3">
        {editing ? (
          <input
            className={`${FIELD} w-full max-w-xs`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
          />
        ) : (
          <span className="font-medium text-charcoal">{row.label}</span>
        )}
        {error && <p className="mt-1 text-xs text-red-err">{error}</p>}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-ink-soft">{row.slug}</td>
      <td className="px-4 py-3 text-ink-soft">
        {row.coursesCount === 0
          ? 'Sin cursos'
          : `${row.coursesCount} curso${row.coursesCount === 1 ? '' : 's'}`}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {editing ? (
            <>
              <Button variant="primary" size="sm" onClick={save} disabled={busy}>
                Guardar
              </Button>
              <button
                type="button"
                className="text-xs text-ink-soft hover:text-ink-main"
                onClick={() => {
                  setEditing(false)
                  setLabel(row.label)
                  setError('')
                }}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="text-xs text-teal hover:underline"
                onClick={() => setEditing(true)}
                disabled={busy}
              >
                Renombrar
              </button>
              <button
                type="button"
                className="text-xs text-red-err hover:underline disabled:opacity-40"
                onClick={remove}
                disabled={busy || row.coursesCount > 0}
                title={
                  row.coursesCount > 0
                    ? 'Reasigna los cursos antes de eliminar.'
                    : 'Eliminar'
                }
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
