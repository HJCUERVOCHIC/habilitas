'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

type Status = 'idle' | 'sending' | 'sent' | 'error'

/** Formulario de ingreso por Magic Link (HABILITAS-ESPECIFICACION §5.9). */
export function LoginForm() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    setMessage('')

    const supabase = createClient()
    const safeRedirect = redirect.startsWith('/') ? redirect : '/dashboard'
    const emailRedirectTo = `${window.location.origin}/auth/confirm?redirect=${encodeURIComponent(
      safeRedirect,
    )}`

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }
    setStatus('sent')
  }

  if (status === 'sent') {
    return (
      <div className="rounded-lg border border-border bg-mist p-6 text-center">
        <h2 className="font-display text-display-sm text-charcoal">Revisa tu correo</h2>
        <p className="mt-2 text-ink-soft">
          Te enviamos un enlace de acceso a <span className="font-medium">{email}</span>. Ábrelo
          en este dispositivo para iniciar sesión.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-main">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@correo.com"
          className="w-full rounded-md border border-border bg-white px-4 py-2.5 text-ink-main outline-none focus:border-teal focus:ring-2 focus:ring-ring"
        />
      </div>

      {status === 'error' && (
        <p className="text-sm text-red-err" role="alert">
          {message || 'No pudimos enviar el enlace. Intenta de nuevo.'}
        </p>
      )}

      <Button type="submit" variant="primary" className="w-full" disabled={status === 'sending'}>
        {status === 'sending' ? 'Enviando…' : 'Enviar enlace de acceso'}
      </Button>

      <p className="text-center text-sm text-ink-muted">
        Sin contraseñas. Te enviamos un enlace mágico por correo.
      </p>
    </form>
  )
}
