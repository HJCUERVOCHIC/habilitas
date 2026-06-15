'use client'

import { useRef } from 'react'

import { saveVideoProgress } from '@/app/curso/[slug]/actions'

interface VideoPlayerProps {
  lessonId: string
  url: string
  initialPosition: number
  completed: boolean
  onComplete: (lessonId: string, lastPosition?: number) => void
  onPosition: (lessonId: string, position: number) => void
}

/**
 * Reproductor de video. D3: la lección se completa al alcanzar el ≥90% de
 * reproducción; se guarda `last_position` periódicamente. El servidor revalida
 * (saveVideoProgress) antes de persistir.
 */
export function VideoPlayer({
  lessonId,
  url,
  initialPosition,
  completed,
  onComplete,
  onPosition,
}: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const lastSavedAt = useRef(0)
  const doneRef = useRef(completed)

  function handleLoadedMetadata() {
    const video = ref.current
    if (video && initialPosition > 0 && initialPosition < video.duration) {
      video.currentTime = initialPosition
    }
  }

  function handleTimeUpdate() {
    const video = ref.current
    if (!video || !video.duration) return
    const pos = video.currentTime
    const ratio = pos / video.duration

    // Guardar posición cada ~10s (cronómetro de cliente, persistido en servidor).
    if (pos - lastSavedAt.current >= 10) {
      lastSavedAt.current = pos
      onPosition(lessonId, Math.floor(pos))
      void saveVideoProgress(lessonId, pos, false)
    }

    if (!doneRef.current && ratio >= 0.9) {
      doneRef.current = true
      onComplete(lessonId, Math.floor(pos))
      void saveVideoProgress(lessonId, pos, true)
    }
  }

  return (
    <video
      ref={ref}
      src={url}
      controls
      controlsList="nodownload"
      className="w-full rounded-md bg-black"
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={handleTimeUpdate}
    >
      Tu navegador no soporta video.
    </video>
  )
}
