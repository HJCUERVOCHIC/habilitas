'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'

/** Copia la URL de verificación al portapapeles (HABILITAS-ESPECIFICACION §5.6 RF-6.4). */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Button variant="verify-secondary" onClick={handleCopy}>
      {copied ? 'Enlace copiado' : 'Copiar enlace'}
    </Button>
  )
}
