'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { archiveCourse } from '@/app/admin/actions'
import { Button } from '@/components/ui/Button'

/**
 * Archiva (soft-delete) el curso actual. Solo se muestra para borradores
 * (SPEC-CURSOS-ESTRUCTURA §1). Pide confirmación antes de actuar.
 */
export function ArchiveCourseButton({ courseId, title }: { courseId: string; title: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleArchive() {
    if (
      !window.confirm(
        `¿Archivar "${title}"? El curso desaparecerá del catálogo y del listado del admin. Se puede restaurar desde la base de datos.`,
      )
    ) {
      return
    }
    setBusy(true)
    setError('')
    const res = await archiveCourse(courseId)
    setBusy(false)
    if (res.ok) {
      router.push('/admin/cursos')
      router.refresh()
    } else {
      setError(res.error ?? 'No se pudo archivar.')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="sm" onClick={handleArchive} disabled={busy}>
        {busy ? '…' : 'Archivar curso'}
      </Button>
      {error && <span className="text-xs text-red-err">{error}</span>}
    </div>
  )
}
