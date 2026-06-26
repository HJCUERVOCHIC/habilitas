'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { setPublished } from '@/app/admin/actions'
import { Button } from '@/components/ui/Button'

/**
 * Botones de acción del PublishPanel. Cliente porque dispara un server action
 * y luego refresca el árbol para recomputar el checklist.
 */
export function PublishActions({
  courseId,
  published,
  canPublish,
}: {
  courseId: string
  published: boolean
  canPublish: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    setBusy(true)
    setError('')
    const res = await setPublished(courseId, !published)
    setBusy(false)
    if (res.ok) {
      router.refresh()
    } else {
      setError(res.error ?? 'No se pudo cambiar el estado.')
    }
  }

  if (published) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button variant="ghost" size="sm" onClick={toggle} disabled={busy}>
          {busy ? '…' : 'Despublicar'}
        </Button>
        {error && <span className="text-xs text-red-err">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="primary"
        size="sm"
        onClick={toggle}
        disabled={busy || !canPublish}
        title={
          canPublish
            ? 'Publicar el curso y hacerlo visible en el catálogo'
            : 'Completa el checklist para habilitar'
        }
      >
        {busy ? '…' : 'Publicar'}
      </Button>
      {error && <span className="text-xs text-red-err">{error}</span>}
    </div>
  )
}
