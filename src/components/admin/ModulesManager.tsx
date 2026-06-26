'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  reorderLesson,
  reorderModule,
  updateLesson,
  updateModule,
} from '@/app/admin/actions'
import { Button } from '@/components/ui/Button'
import { LESSON_TYPES, lessonTypeLabel } from '@/lib/lessons'

const FIELD =
  'rounded-md border border-border bg-white px-3 py-2 text-sm text-ink-main outline-none focus:border-teal focus:ring-2 focus:ring-ring'

export interface AdminLesson {
  id: string
  title: string
  content_type: string
  duration_min: number | null
}
export interface AdminModule {
  id: string
  title: string
  lessons: AdminLesson[]
}

/**
 * Gestor de estructura del curso (SPEC-CURSOS-ESTRUCTURA §1):
 *   - Módulos: crear, editar título, reordenar (↑/↓), eliminar.
 *   - Lecciones: crear (título + tipo), editar título y tipo, reordenar,
 *     eliminar.
 *
 * Bloque 2 conecta cada lección con su editor de contenido
 * (`/admin/cursos/[slug]/lecciones/[lessonId]`), por eso recibe `courseSlug`.
 */
export function ModulesManager({
  courseId,
  courseSlug,
  modules,
}: {
  courseId: string
  courseSlug: string
  modules: AdminModule[]
}) {
  const router = useRouter()
  const [newModule, setNewModule] = useState('')
  const [busy, setBusy] = useState(false)

  async function addModule() {
    if (!newModule.trim()) return
    setBusy(true)
    await createModule(courseId, newModule)
    setNewModule('')
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <input
          className={`${FIELD} flex-1`}
          placeholder="Título del nuevo módulo"
          value={newModule}
          onChange={(e) => setNewModule(e.target.value)}
        />
        <Button variant="primary" size="sm" onClick={addModule} disabled={busy}>
          Añadir módulo
        </Button>
      </div>

      {modules.map((mod, index) => (
        <ModuleCard
          key={mod.id}
          courseSlug={courseSlug}
          module={mod}
          index={index}
          isFirst={index === 0}
          isLast={index === modules.length - 1}
          onMutated={() => router.refresh()}
        />
      ))}

      {modules.length === 0 && (
        <p className="text-sm text-ink-muted">Aún no hay módulos. Añade el primero arriba.</p>
      )}
    </div>
  )
}

function ModuleCard({
  courseSlug,
  module,
  index,
  isFirst,
  isLast,
  onMutated,
}: {
  courseSlug: string
  module: AdminModule
  index: number
  isFirst: boolean
  isLast: boolean
  onMutated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(module.title)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!title.trim()) {
      setError('El título es obligatorio.')
      return
    }
    setBusy(true)
    setError('')
    const res = await updateModule(module.id, title)
    setBusy(false)
    if (res.ok) {
      setEditing(false)
      onMutated()
    } else {
      setError(res.error ?? 'No se pudo guardar.')
    }
  }

  async function move(direction: 'up' | 'down') {
    setBusy(true)
    await reorderModule(module.id, direction)
    setBusy(false)
    onMutated()
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar el módulo "${module.title}" y todas sus lecciones?`)) return
    setBusy(true)
    await deleteModule(module.id)
    setBusy(false)
    onMutated()
  }

  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {editing ? (
          <input
            className={`${FIELD} flex-1`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        ) : (
          <h3 className="font-semibold text-charcoal">
            {index + 1}. {module.title}
          </h3>
        )}
        <div className="flex items-center gap-2">
          <OrderButtons
            disabled={busy}
            isFirst={isFirst}
            isLast={isLast}
            onUp={() => move('up')}
            onDown={() => move('down')}
          />
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
                  setTitle(module.title)
                  setError('')
                }}
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              className="text-xs text-teal hover:underline"
              onClick={() => setEditing(true)}
            >
              Editar
            </button>
          )}
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-xs text-red-err hover:underline"
          >
            Eliminar módulo
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-err">{error}</p>}

      <ul className="mt-3 space-y-1.5">
        {module.lessons.map((lesson, i) => (
          <LessonRow
            key={lesson.id}
            courseSlug={courseSlug}
            lesson={lesson}
            isFirst={i === 0}
            isLast={i === module.lessons.length - 1}
            onMutated={onMutated}
          />
        ))}
        {module.lessons.length === 0 && (
          <li className="text-sm text-ink-muted">Sin lecciones todavía.</li>
        )}
      </ul>

      <NewLessonForm moduleId={module.id} onDone={onMutated} />
    </div>
  )
}

function LessonRow({
  courseSlug,
  lesson,
  isFirst,
  isLast,
  onMutated,
}: {
  courseSlug: string
  lesson: AdminLesson
  isFirst: boolean
  isLast: boolean
  onMutated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(lesson.title)
  const [contentType, setContentType] = useState(lesson.content_type)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!title.trim()) {
      setError('El título es obligatorio.')
      return
    }
    setBusy(true)
    setError('')
    const res = await updateLesson(lesson.id, { title, content_type: contentType })
    setBusy(false)
    if (res.ok) {
      setEditing(false)
      onMutated()
    } else {
      setError(res.error ?? 'No se pudo guardar.')
    }
  }

  async function move(direction: 'up' | 'down') {
    setBusy(true)
    await reorderLesson(lesson.id, direction)
    setBusy(false)
    onMutated()
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar la lección "${lesson.title}"?`)) return
    setBusy(true)
    await deleteLesson(lesson.id)
    setBusy(false)
    onMutated()
  }

  if (editing) {
    return (
      <li className="rounded-md border border-border bg-mist px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${FIELD} flex-1`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className={FIELD}
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
          >
            {LESSON_TYPES.map((t) => (
              <option key={t} value={t}>
                {lessonTypeLabel(t)}
              </option>
            ))}
          </select>
          <Button variant="primary" size="sm" onClick={save} disabled={busy}>
            Guardar
          </Button>
          <button
            type="button"
            className="text-xs text-ink-soft hover:text-ink-main"
            onClick={() => {
              setEditing(false)
              setTitle(lesson.title)
              setContentType(lesson.content_type)
              setError('')
            }}
          >
            Cancelar
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-err">{error}</p>}
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between rounded-md bg-mist px-3 py-2 text-sm">
      <span className="text-ink-main">
        {lesson.title}{' '}
        <span className="text-ink-muted">
          · {lessonTypeLabel(lesson.content_type)}
          {lesson.duration_min != null ? ` · ${lesson.duration_min}m` : ''}
        </span>
      </span>
      <div className="flex items-center gap-2">
        <OrderButtons
          disabled={busy}
          isFirst={isFirst}
          isLast={isLast}
          onUp={() => move('up')}
          onDown={() => move('down')}
        />
        <Link
          href={`/admin/cursos/${courseSlug}/lecciones/${lesson.id}`}
          className="text-xs text-teal hover:underline"
        >
          Contenido
        </Link>
        <button
          type="button"
          className="text-xs text-teal hover:underline"
          onClick={() => setEditing(true)}
        >
          Editar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="text-xs text-red-err hover:underline"
        >
          Eliminar
        </button>
      </div>
    </li>
  )
}

function OrderButtons({
  disabled,
  isFirst,
  isLast,
  onUp,
  onDown,
}: {
  disabled: boolean
  isFirst: boolean
  isLast: boolean
  onUp: () => void
  onDown: () => void
}) {
  return (
    <div className="flex items-center" role="group" aria-label="Reordenar">
      <button
        type="button"
        onClick={onUp}
        disabled={disabled || isFirst}
        aria-label="Mover arriba"
        className="rounded-md px-1.5 py-0.5 text-sm text-ink-soft hover:bg-mist disabled:opacity-40"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={disabled || isLast}
        aria-label="Mover abajo"
        className="rounded-md px-1.5 py-0.5 text-sm text-ink-soft hover:bg-mist disabled:opacity-40"
      >
        ↓
      </button>
    </div>
  )
}

function NewLessonForm({ moduleId, onDone }: { moduleId: string; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [contentType, setContentType] = useState<string>('video')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function add() {
    if (!title.trim()) {
      setError('El título es obligatorio.')
      return
    }
    setBusy(true)
    setError('')
    // El contenido (r2_key, duración, transcripción) lo maneja Bloque 2.
    const res = await createLesson(moduleId, {
      title,
      content_type: contentType,
      content_r2_key: '',
      duration_min: null,
      transcript: '',
    })
    setBusy(false)
    if (res.ok) {
      setTitle('')
      onDone()
    } else {
      setError(res.error ?? 'No se pudo añadir la lección.')
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <input
        className={`${FIELD} flex-1`}
        placeholder="Título de la lección"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <select
        className={FIELD}
        value={contentType}
        onChange={(e) => setContentType(e.target.value)}
        aria-label="Tipo de lección"
      >
        {LESSON_TYPES.map((t) => (
          <option key={t} value={t}>
            {lessonTypeLabel(t)}
          </option>
        ))}
      </select>
      <Button variant="ghost" size="sm" onClick={add} disabled={busy}>
        Añadir lección
      </Button>
      {error && <span className="text-xs text-red-err">{error}</span>}
    </div>
  )
}
