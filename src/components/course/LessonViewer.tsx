'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'

import { getLessonContent, markLessonComplete, type LessonContent } from '@/app/curso/[slug]/actions'
import { VideoPlayer } from '@/components/course/VideoPlayer'
import { Button } from '@/components/ui/Button'
import type { LessonLite, ProgressEntry } from '@/types/course'

interface LessonViewerProps {
  lesson: LessonLite
  progressEntry?: ProgressEntry
  onComplete: (lessonId: string, lastPosition?: number) => void
  onPosition: (lessonId: string, position: number) => void
}

const TYPE_LABELS: Record<string, string> = {
  video: 'Video',
  pdf: 'Documento PDF',
  slides: 'Presentación',
  image: 'Imagen',
  text: 'Lectura',
}

/** Visor de lección que renderiza según content_type (§5.4 RF-4.2). */
export function LessonViewer({ lesson, progressEntry, onComplete, onPosition }: LessonViewerProps) {
  const [content, setContent] = useState<LessonContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const completed = progressEntry?.completed ?? false

  useEffect(() => {
    let active = true
    setLoading(true)
    getLessonContent(lesson.id).then((res) => {
      if (active) {
        setContent(res)
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [lesson.id])

  async function handleMark() {
    setMarking(true)
    const res = await markLessonComplete(lesson.id)
    setMarking(false)
    if (res.ok) onComplete(lesson.id)
  }

  const isVideo = lesson.content_type === 'video'
  const playableVideo = isVideo && content?.ok === true && content.kind === 'signed'
  // Para video reproducible se usa el 90% (D3); el resto usa botón manual.
  const showManualButton = content?.ok === true && !playableVideo

  return (
    <div className="rounded-lg border border-border bg-white shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <p className="text-xs uppercase tracking-wide text-ink-muted">
          {TYPE_LABELS[lesson.content_type] ?? 'Lección'}
        </p>
        <h2 className="text-lg font-semibold text-charcoal">{lesson.title}</h2>
      </div>

      <div className="p-6">
        {loading ? (
          <Placeholder>Cargando contenido…</Placeholder>
        ) : (
          content && (
            <LessonBody
              lesson={lesson}
              content={content}
              initialPosition={progressEntry?.last_position ?? 0}
              completed={completed}
              onComplete={onComplete}
              onPosition={onPosition}
            />
          )
        )}
      </div>

      {showManualButton && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <span className="text-sm text-ink-soft">
            {completed ? '✓ Lección completada' : 'Cuando termines, márcala como vista.'}
          </span>
          <Button variant="primary" size="sm" onClick={handleMark} disabled={completed || marking}>
            {completed ? 'Completada' : marking ? 'Guardando…' : 'Marcar como vista'}
          </Button>
        </div>
      )}
    </div>
  )
}

function LessonBody({
  lesson,
  content,
  initialPosition,
  completed,
  onComplete,
  onPosition,
}: {
  lesson: LessonLite
  content: LessonContent
  initialPosition: number
  completed: boolean
  onComplete: (lessonId: string, lastPosition?: number) => void
  onPosition: (lessonId: string, position: number) => void
}) {
  if (!content.ok) {
    const messages: Record<string, string> = {
      auth: 'Tu sesión expiró. Vuelve a iniciar sesión.',
      enrollment: 'No estás inscrito en este curso.',
      locked: 'Completa el módulo anterior para desbloquear esta lección.',
      'not-found': 'No encontramos esta lección.',
    }
    return <Placeholder>{messages[content.reason] ?? 'Contenido no disponible.'}</Placeholder>
  }

  if (content.kind === 'text') {
    if (!content.markdown.trim()) {
      return <Placeholder>Esta lectura aún no tiene contenido cargado.</Placeholder>
    }
    return (
      <div className="space-y-3 text-ink-main [&_h1]:font-display [&_h1]:text-2xl [&_h2]:mt-4 [&_h2]:font-semibold [&_a]:text-teal [&_li]:ml-5 [&_li]:list-disc">
        <ReactMarkdown>{content.markdown}</ReactMarkdown>
      </div>
    )
  }

  if (content.kind === 'unavailable') {
    return (
      <Placeholder>
        {content.reason === 'r2'
          ? 'Contenido pendiente: Cloudflare R2 aún no está configurado.'
          : 'Esta lección todavía no tiene archivo asociado.'}
      </Placeholder>
    )
  }

  // kind === 'signed'
  if (content.contentType === 'video') {
    return (
      <VideoPlayer
        lessonId={lesson.id}
        url={content.url}
        initialPosition={initialPosition}
        completed={completed}
        onComplete={onComplete}
        onPosition={onPosition}
      />
    )
  }
  if (content.contentType === 'pdf' || content.contentType === 'slides') {
    return (
      <iframe
        src={content.url}
        title={lesson.title}
        className="h-[600px] w-full rounded-md border border-border"
      />
    )
  }
  if (content.contentType === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL firmada de R2, dominio dinámico
      <img src={content.url} alt={lesson.title} className="mx-auto max-h-[600px] rounded-md" />
    )
  }
  return <Placeholder>Tipo de contenido no soportado.</Placeholder>
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-md bg-mist px-6 text-center text-sm text-ink-soft">
      {children}
    </div>
  )
}
