'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { updateProfile, type ProfileInput } from '@/app/perfil/actions'
import { Button } from '@/components/ui/Button'

type Status = 'idle' | 'saving' | 'saved' | 'error'

const FIELD =
  'w-full rounded-md border border-border bg-white px-4 py-2.5 text-ink-main outline-none focus:border-teal focus:ring-2 focus:ring-ring'

export function ProfileForm({ initial }: { initial: ProfileInput }) {
  const router = useRouter()
  const [form, setForm] = useState<ProfileInput>(initial)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  function update<K extends keyof ProfileInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    if (status !== 'idle') setStatus('idle')
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('saving')
    const res = await updateProfile(form)
    if (res.ok) {
      setStatus('saved')
      router.refresh()
    } else {
      setStatus('error')
      setMessage(res.error ?? 'No se pudo guardar.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nombre completo" required>
        <input
          className={FIELD}
          value={form.full_name}
          onChange={(e) => update('full_name', e.target.value)}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Profesión">
          <input
            className={FIELD}
            value={form.profession}
            onChange={(e) => update('profession', e.target.value)}
            placeholder="Ej: Enfermero profesional"
          />
        </Field>
        <Field label="Ciudad">
          <input
            className={FIELD}
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
            placeholder="Ej: Bogotá"
          />
        </Field>
      </div>

      <Field label="Número RETHUS (autodeclarado)">
        <input
          className={FIELD}
          value={form.rethus_number}
          onChange={(e) => update('rethus_number', e.target.value)}
          placeholder="Opcional"
        />
        <p className="mt-1 text-xs text-ink-muted">
          Este número es autodeclarado; Habilitas no lo verifica contra el RETHUS.
        </p>
      </Field>

      <Field label="URL de avatar">
        <input
          className={FIELD}
          value={form.avatar_url}
          onChange={(e) => update('avatar_url', e.target.value)}
          placeholder="https://… (opcional)"
        />
      </Field>

      <div className="flex items-center gap-4">
        <Button type="submit" variant="primary" disabled={status === 'saving'}>
          {status === 'saving' ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        {status === 'saved' && <span className="text-sm text-green-ok">✓ Guardado</span>}
        {status === 'error' && <span className="text-sm text-red-err">{message}</span>}
      </div>
    </form>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-main">
        {label}
        {required && <span className="text-red-err"> *</span>}
      </label>
      {children}
    </div>
  )
}
