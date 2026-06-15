'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'

/** Búsqueda de verificación: lleva a /verificar/[id] (RF-1.1 CTA secundario). */
export function VerifyLookup() {
  const router = useRouter()
  const [id, setId] = useState('')

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = id.trim()
    if (value) router.push(`/verificar/${encodeURIComponent(value)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md gap-2">
      <input
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="Verificar un certificado (ej: HAB-2026-0001)"
        aria-label="Identificador del certificado"
        className="flex-1 rounded-md border border-border bg-white px-4 py-2.5 text-sm text-ink-main outline-none focus:border-teal focus:ring-2 focus:ring-ring"
      />
      <Button type="submit" variant="ghost">
        Verificar
      </Button>
    </form>
  )
}
