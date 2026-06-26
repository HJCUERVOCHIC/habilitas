'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  clearLessonContent,
  confirmLessonUpload,
  getLessonPreviewUrl,
  prepareLessonUpload,
  updateLessonBody,
} from '@/app/admin/lessons/actions'
import { MarkdownContent } from '@/components/markdown/MarkdownContent'
import { Button } from '@/components/ui/Button'
import { lessonTypeLabel } from '@/lib/lessons'

const FIELD =
  'w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink-main outline-none focus:border-teal focus:ring-2 focus:ring-ring'

const ACCEPT_BY_TYPE: Record<string, string> = {
  video: 'video/mp4,video/webm,video/quicktime',
  pdf: 'application/pdf',
  slides: 'application/pdf',
  image: 'image/jpeg,image/png,image/webp',
}

const MAX_MB_BY_TYPE: Record<string, number> = {
  video: 500,
  pdf: 50,
  slides: 50,
  image: 10,
}

interface LessonForEditor {
  id: string
  title: string
  content_type: string
  body_md: string
  content_r2_key: string | null
  content_original_name: string | null
  content_mime_type: string | null
  content_size_bytes: number | null
}

interface LessonEditorProps {
  lesson: LessonForEditor
  r2Configured: boolean
}

/**
 * Editor de contenido por lección (SPEC-CONTENIDO-LECCIONES §1):
 *   - body_md con tabs Editar / Vista previa (preview = render real del estudiante).
 *   - Carga directa a R2 vía URL PUT prefirmada (cuando el tipo lo requiere).
 *   - Reemplazar o quitar el medio actual.
 */
export function LessonEditor({ lesson, r2Configured }: LessonEditorProps) {
  return (
    <div className="space-y-8">
      <BodyEditor lessonId={lesson.id} initial={lesson.body_md} />
      {lesson.content_type !== 'text' && (
        <MediaSection lesson={lesson} r2Configured={r2Configured} />
      )}
    </div>
  )
}

function BodyEditor({ lessonId, initial }: { lessonId: string; initial: string }) {
  const router = useRouter()
  const [text, setText] = useState(initial)
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')

  async function save() {
    setBusy(true)
    setStatus('idle')
    setError('')
    const res = await updateLessonBody(lessonId, text)
    setBusy(false)
    if (res.ok) {
      setStatus('saved')
      router.refresh()
    } else {
      setStatus('error')
      setError(res.error ?? 'No se pudo guardar.')
    }
  }

  return (
    <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Texto de la lección (Markdown)
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <TabButton active={tab === 'edit'} onClick={() => setTab('edit')}>
            Editar
          </TabButton>
          <TabButton active={tab === 'preview'} onClick={() => setTab('preview')}>
            Vista previa
          </TabButton>
        </div>
      </div>

      {tab === 'edit' ? (
        <textarea
          className={`${FIELD} font-mono`}
          rows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe el contenido en Markdown. Acepta encabezados (#), listas, **negrita**, [enlaces](url)…"
        />
      ) : (
        <div className="min-h-[200px] rounded-md border border-border bg-mist p-4">
          {text.trim() ? (
            <MarkdownContent source={text} />
          ) : (
            <p className="text-center text-sm text-ink-muted">
              Aún no hay contenido para previsualizar.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={save} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar texto'}
        </Button>
        {status === 'saved' && <span className="text-xs text-green-ok">✓ Guardado</span>}
        {status === 'error' && <span className="text-xs text-red-err">{error}</span>}
      </div>
    </section>
  )
}

function MediaSection({
  lesson,
  r2Configured,
}: {
  lesson: LessonForEditor
  r2Configured: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<'idle' | 'signing' | 'uploading' | 'confirming'>(
    'idle',
  )
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const accept = ACCEPT_BY_TYPE[lesson.content_type] ?? ''
  const maxMb = MAX_MB_BY_TYPE[lesson.content_type] ?? 0
  const hasMedia = Boolean(lesson.content_r2_key)

  async function handleFile(file: File) {
    setBusy(true)
    setError('')
    setProgress('signing')
    const prep = await prepareLessonUpload({
      lessonId: lesson.id,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    })
    if (!prep.ok) {
      setBusy(false)
      setProgress('idle')
      setError(prep.error)
      return
    }
    setProgress('uploading')
    try {
      const putRes = await fetch(prep.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': prep.contentType },
      })
      if (!putRes.ok) {
        setBusy(false)
        setProgress('idle')
        setError(`Subida rechazada por R2 (${putRes.status}).`)
        return
      }
    } catch {
      setBusy(false)
      setProgress('idle')
      setError('No se pudo conectar con R2. Revisa la configuración CORS del bucket.')
      return
    }
    setProgress('confirming')
    const conf = await confirmLessonUpload({
      lessonId: lesson.id,
      key: prep.key,
      originalName: file.name,
      mimeType: prep.contentType,
      sizeBytes: file.size,
    })
    setBusy(false)
    setProgress('idle')
    if (conf.ok) {
      setPreviewUrl(null)
      router.refresh()
    } else {
      setError(conf.error ?? 'No se pudo guardar la referencia.')
    }
  }

  async function handleRemove() {
    if (!window.confirm('¿Quitar el archivo actual de la lección?')) return
    setBusy(true)
    setError('')
    const res = await clearLessonContent(lesson.id)
    setBusy(false)
    if (res.ok) {
      setPreviewUrl(null)
      router.refresh()
    } else {
      setError(res.error ?? 'No se pudo quitar.')
    }
  }

  async function loadPreview() {
    setLoadingPreview(true)
    const res = await getLessonPreviewUrl(lesson.id)
    setLoadingPreview(false)
    if (res.ok) {
      setPreviewUrl(res.url)
    } else {
      setError(
        res.reason === 'r2'
          ? 'Cloudflare R2 no está configurado.'
          : res.reason === 'empty'
            ? 'La lección no tiene archivo cargado.'
            : 'No autorizado.',
      )
    }
  }

  return (
    <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Archivo · {lessonTypeLabel(lesson.content_type)}
      </h2>

      {!r2Configured && (
        <p className="mt-3 rounded-md border border-amber/30 bg-amber-pale p-3 text-xs text-ink-main">
          Cloudflare R2 no está configurado. Define las variables{' '}
          <code>R2_ENDPOINT</code>, <code>R2_ACCESS_KEY_ID</code>,{' '}
          <code>R2_SECRET_ACCESS_KEY</code> y <code>R2_BUCKET_NAME</code> para habilitar la
          subida. El resto del editor funciona.
        </p>
      )}

      {hasMedia ? (
        <div className="mt-3 space-y-2 rounded-md border border-border bg-mist p-3 text-sm">
          <p className="font-medium text-charcoal">
            {lesson.content_original_name ?? 'archivo.bin'}
          </p>
          <p className="text-xs text-ink-soft">
            {lesson.content_mime_type ?? '—'}
            {lesson.content_size_bytes != null
              ? ` · ${formatBytes(lesson.content_size_bytes)}`
              : ''}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadPreview}
              disabled={loadingPreview || !r2Configured}
            >
              {loadingPreview ? '…' : previewUrl ? 'Renovar vista previa' : 'Vista previa'}
            </Button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="text-xs text-red-err hover:underline"
            >
              Quitar archivo
            </button>
          </div>
          {previewUrl && <PreviewMedia type={lesson.content_type} url={previewUrl} />}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">Aún no hay archivo cargado.</p>
      )}

      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 text-xs text-ink-soft">
          {hasMedia ? 'Reemplazar archivo:' : 'Subir archivo:'} acepta {accept || '—'}. Máx {maxMb}{' '}
          MB.
        </p>
        <input
          type="file"
          accept={accept}
          disabled={busy || !r2Configured}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) {
              void handleFile(f)
              e.currentTarget.value = ''
            }
          }}
          className="text-sm"
        />
        {progress !== 'idle' && (
          <p className="mt-2 text-xs text-ink-soft">
            {progress === 'signing'
              ? 'Solicitando URL firmada…'
              : progress === 'uploading'
                ? 'Subiendo a R2…'
                : 'Guardando referencia…'}
          </p>
        )}
        {error && <p className="mt-2 text-xs text-red-err">{error}</p>}
      </div>
    </section>
  )
}

function PreviewMedia({ type, url }: { type: string; url: string }) {
  if (type === 'video') {
    return (
      <video controls className="mt-2 w-full rounded-md border border-border">
        <source src={url} />
      </video>
    )
  }
  if (type === 'pdf' || type === 'slides') {
    return (
      <iframe
        src={url}
        title="Vista previa"
        className="mt-2 h-[480px] w-full rounded-md border border-border"
      />
    )
  }
  if (type === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL firmada de R2, dominio dinámico
      <img src={url} alt="Vista previa" className="mt-2 max-h-[480px] rounded-md" />
    )
  }
  return null
}

function TabButton({
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
      className={
        active
          ? 'rounded-md bg-teal px-3 py-1 font-medium text-white'
          : 'rounded-md px-3 py-1 font-medium text-ink-soft hover:bg-mist'
      }
    >
      {children}
    </button>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
