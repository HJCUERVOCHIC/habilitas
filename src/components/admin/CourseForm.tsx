'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { createCourse, updateCourse, type CourseInput } from '@/app/admin/actions'
import { Button } from '@/components/ui/Button'
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/categories'

const FIELD =
  'w-full rounded-md border border-border bg-white px-3 py-2 text-ink-main outline-none focus:border-teal focus:ring-2 focus:ring-ring'

const DIFFICULTIES = ['basico', 'intermedio', 'avanzado'] as const

interface CourseFormProps {
  mode: 'create' | 'edit'
  courseId?: string
  initial?: CourseInput
}

const EMPTY: CourseInput = {
  slug: '',
  title: '',
  subtitle: '',
  description: '',
  category: 'soporte-vital',
  difficulty: 'basico',
  duration_hours: null,
  cert_validity_days: 365,
  pass_score: 70,
  max_attempts: 3,
  learning_objectives: [],
}

export function CourseForm({ mode, courseId, initial }: CourseFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<CourseInput>(initial ?? EMPTY)
  const [objectivesText, setObjectivesText] = useState((initial?.learning_objectives ?? []).join('\n'))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  function set<K extends keyof CourseInput>(key: K, value: CourseInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    const payload: CourseInput = {
      ...form,
      learning_objectives: objectivesText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    }
    const res =
      mode === 'create'
        ? await createCourse(payload)
        : await updateCourse(courseId ?? '', payload)
    setSaving(false)
    if (res.ok) {
      const slug = 'slug' in res && res.slug ? res.slug : form.slug
      router.push(`/admin/cursos/${slug}`)
      router.refresh()
    } else {
      setMessage(res.error ?? 'No se pudo guardar.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-white p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-main">Título *</span>
          <input className={FIELD} value={form.title} onChange={(e) => set('title', e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-main">Slug *</span>
          <input
            className={FIELD}
            value={form.slug}
            onChange={(e) => set('slug', e.target.value)}
            disabled={mode === 'edit'}
            required
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink-main">Subtítulo</span>
        <input className={FIELD} value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink-main">Descripción</span>
        <textarea className={FIELD} rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-main">Categoría</span>
          <select className={FIELD} value={form.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-main">Dificultad</span>
          <select className={FIELD} value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <NumberField label="Horas" value={form.duration_hours} onChange={(v) => set('duration_hours', v)} step="0.5" />
        <NumberField label="Vigencia (días)" value={form.cert_validity_days} onChange={(v) => set('cert_validity_days', v ?? 365)} />
        <NumberField label="Puntaje mín. %" value={form.pass_score} onChange={(v) => set('pass_score', v ?? 70)} />
        <NumberField label="Intentos" value={form.max_attempts} onChange={(v) => set('max_attempts', v ?? 3)} />
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink-main">Objetivos (uno por línea)</span>
        <textarea className={FIELD} rows={4} value={objectivesText} onChange={(e) => setObjectivesText(e.target.value)} />
      </label>

      <div className="flex items-center gap-4">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Guardando…' : mode === 'create' ? 'Crear curso' : 'Guardar cambios'}
        </Button>
        {message && <span className="text-sm text-red-err">{message}</span>}
      </div>
    </form>
  )
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  step?: string
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink-main">{label}</span>
      <input
        type="number"
        step={step}
        className={FIELD}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    </label>
  )
}
