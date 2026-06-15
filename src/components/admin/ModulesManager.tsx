'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
} from '@/app/admin/actions'
import { Button } from '@/components/ui/Button'

const FIELD =
  'rounded-md border border-border bg-white px-3 py-2 text-sm text-ink-main outline-none focus:border-teal focus:ring-2 focus:ring-ring'
const CONTENT_TYPES = ['video', 'pdf', 'slides', 'image', 'text'] as const

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

export function ModulesManager({
  courseId,
  modules,
}: {
  courseId: string
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

  async function removeModule(id: string) {
    setBusy(true)
    await deleteModule(id)
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
        <div key={mod.id} className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-charcoal">
              {index + 1}. {mod.title}
            </h3>
            <button
              type="button"
              onClick={() => removeModule(mod.id)}
              className="text-xs text-red-err hover:underline"
            >
              Eliminar módulo
            </button>
          </div>

          <ul className="mt-3 space-y-1.5">
            {mod.lessons.map((lesson) => (
              <li
                key={lesson.id}
                className="flex items-center justify-between rounded-md bg-mist px-3 py-2 text-sm"
              >
                <span className="text-ink-main">
                  {lesson.title}{' '}
                  <span className="text-ink-muted">
                    · {lesson.content_type}
                    {lesson.duration_min != null ? ` · ${lesson.duration_min}m` : ''}
                  </span>
                </span>
                <DeleteLessonButton lessonId={lesson.id} onDone={() => router.refresh()} />
              </li>
            ))}
            {mod.lessons.length === 0 && (
              <li className="text-sm text-ink-muted">Sin lecciones todavía.</li>
            )}
          </ul>

          <NewLessonForm moduleId={mod.id} onDone={() => router.refresh()} />
        </div>
      ))}
      {modules.length === 0 && (
        <p className="text-sm text-ink-muted">Aún no hay módulos. Añade el primero arriba.</p>
      )}
    </div>
  )
}

function DeleteLessonButton({ lessonId, onDone }: { lessonId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await deleteLesson(lessonId)
        setBusy(false)
        onDone()
      }}
      className="text-xs text-red-err hover:underline"
    >
      Eliminar
    </button>
  )
}

function NewLessonForm({ moduleId, onDone }: { moduleId: string; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [contentType, setContentType] = useState<string>('video')
  const [r2Key, setR2Key] = useState('')
  const [duration, setDuration] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function add() {
    setBusy(true)
    setError('')
    const res = await createLesson(moduleId, {
      title,
      content_type: contentType,
      content_r2_key: r2Key,
      duration_min: duration === '' ? null : Number(duration),
      transcript: '',
    })
    setBusy(false)
    if (res.ok) {
      setTitle('')
      setR2Key('')
      setDuration('')
      onDone()
    } else {
      setError(res.error ?? 'Error')
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
      <input className={`${FIELD} flex-1`} placeholder="Título de la lección" value={title} onChange={(e) => setTitle(e.target.value)} />
      <select className={FIELD} value={contentType} onChange={(e) => setContentType(e.target.value)}>
        {CONTENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input className={`${FIELD} w-20`} placeholder="min" value={duration} onChange={(e) => setDuration(e.target.value)} />
      <input className={`${FIELD} flex-1`} placeholder="content_r2_key (opcional)" value={r2Key} onChange={(e) => setR2Key(e.target.value)} />
      <Button variant="ghost" size="sm" onClick={add} disabled={busy}>
        Añadir lección
      </Button>
      {error && <span className="text-xs text-red-err">{error}</span>}
    </div>
  )
}
