'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { setPublished } from '@/app/admin/actions'
import { Button } from '@/components/ui/Button'

export function PublishToggle({
  courseId,
  published,
}: {
  courseId: string
  published: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleToggle() {
    setBusy(true)
    setError('')
    const res = await setPublished(courseId, !published)
    if (!res.ok && res.requiresConfirmation) {
      const activeCount = res.activeCount ?? 0
      const message =
        `Este curso tiene ${activeCount} estudiante(s) activo(s). Al despublicarlo dejará de ser visible para ellos, pero su progreso se conserva.\n\n¿Continuar?`
      if (!window.confirm(message)) {
        setBusy(false)
        return
      }
      const confirmed = await setPublished(courseId, !published, { confirmed: true })
      setBusy(false)
      if (confirmed.ok) router.refresh()
      else setError(confirmed.error ?? 'No se pudo cambiar el estado.')
      return
    }
    setBusy(false)
    if (res.ok) router.refresh()
    else setError(res.error ?? 'No se pudo cambiar el estado.')
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className={
          published
            ? 'rounded-md bg-green-pale px-2.5 py-1 text-xs font-semibold text-green-ok'
            : 'rounded-md bg-mist px-2.5 py-1 text-xs font-semibold text-ink-soft'
        }
      >
        {published ? 'Publicado' : 'Borrador'}
      </span>
      <Button variant="ghost" size="sm" onClick={handleToggle} disabled={busy}>
        {busy ? '…' : published ? 'Despublicar' : 'Publicar'}
      </Button>
      {error && <span className="text-xs text-red-err">{error}</span>}
    </div>
  )
}
