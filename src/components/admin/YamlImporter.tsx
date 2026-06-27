'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  importYamlCourse,
  previewYamlCourse,
  type PreviewResponse,
} from '@/app/admin/cursos/importar/actions'
import { Button } from '@/components/ui/Button'

const FIELD =
  'w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink-main outline-none focus:border-teal focus:ring-2 focus:ring-ring'

type Phase = 'edit' | 'previewing' | 'previewed' | 'importing'

export function YamlImporter() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>('edit')
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [importError, setImportError] = useState('')

  async function handleFile(file: File) {
    const content = await file.text()
    setText(content)
    setPreview(null)
    setPhase('edit')
  }

  async function validate() {
    setPhase('previewing')
    setImportError('')
    const res = await previewYamlCourse(text)
    setPreview(res)
    setPhase('previewed')
  }

  async function confirmImport() {
    if (!preview || !preview.ok || preview.slugTaken) return
    setPhase('importing')
    setImportError('')
    const res = await importYamlCourse(text)
    if (res.ok) {
      router.push(`/admin/cursos/${res.slug}`)
      router.refresh()
    } else {
      setImportError(res.errors.join(' '))
      setPhase('previewed')
    }
  }

  function reset() {
    setPreview(null)
    setPhase('edit')
    setImportError('')
  }

  const canConfirm =
    preview?.ok === true && !preview.slugTaken && phase === 'previewed'

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Fuente del curso
          </h2>
          <label className="text-sm text-teal hover:text-teal-light">
            <span className="cursor-pointer underline">Subir archivo .yaml</span>
            <input
              type="file"
              accept=".yaml,.yml,application/x-yaml,text/yaml"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  void handleFile(f)
                  e.currentTarget.value = ''
                }
              }}
            />
          </label>
        </div>
        <textarea
          className={`${FIELD} mt-3 font-mono`}
          rows={18}
          placeholder="Pega aquí el YAML del curso o sube un archivo arriba."
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (phase !== 'edit') reset()
          }}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={validate}
            disabled={!text.trim() || phase === 'previewing' || phase === 'importing'}
          >
            {phase === 'previewing' ? 'Validando…' : 'Validar y previsualizar'}
          </Button>
          {phase === 'previewed' && (
            <button
              type="button"
              onClick={reset}
              className="text-xs text-ink-soft hover:text-ink-main"
            >
              Reiniciar
            </button>
          )}
        </div>
      </section>

      {preview && !preview.ok && (
        <section className="rounded-lg border border-red-err/40 bg-red-pale p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-err">
            No se puede importar — errores
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-charcoal">
            {preview.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
      )}

      {preview && preview.ok && (
        <PreviewView
          preview={preview}
          canConfirm={canConfirm}
          importing={phase === 'importing'}
          importError={importError}
          onConfirm={confirmImport}
        />
      )}
    </div>
  )
}

function PreviewView({
  preview,
  canConfirm,
  importing,
  importError,
  onConfirm,
}: {
  preview: Extract<PreviewResponse, { ok: true }>
  canConfirm: boolean
  importing: boolean
  importError: string
  onConfirm: () => void
}) {
  return (
    <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Previsualización
      </h2>

      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <Pair label="Título" value={preview.summary.title} />
        <Pair label="Categoría" value={preview.summary.category} />
        <Pair label="Slug final" value={preview.summary.slug} mono />
        <Pair label="Módulos" value={String(preview.summary.modulesCount)} />
        <Pair label="Lecciones (total)" value={String(preview.summary.lessonsCount)} />
        <Pair label="Preguntas del banco" value={String(preview.summary.questionsCount)} />
      </dl>

      {preview.slugTaken && (
        <p className="mt-4 rounded-md border border-red-err/40 bg-red-pale p-3 text-sm text-charcoal">
          ⚠ Ya existe un curso con este slug. La importación no sobrescribe nada
          (Opción A). Cambia el <code>slug</code> en el YAML o edita el curso existente
          desde el panel.
        </p>
      )}

      <details className="mt-4 rounded-md border border-border p-3 text-sm">
        <summary className="cursor-pointer font-medium text-charcoal">
          Módulos y lecciones ({preview.summary.modulesCount} / {preview.summary.lessonsCount})
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
          {preview.summary.perModule.map((m, i) => (
            <li key={i}>
              <span className="font-medium text-charcoal">{m.title}</span> —{' '}
              {m.lessons} lección(es)
            </li>
          ))}
        </ul>
      </details>

      {preview.summary.pendingMedia.length > 0 && (
        <section className="mt-4 rounded-md border border-amber/30 bg-amber-pale p-3 text-sm">
          <p className="font-medium text-charcoal">
            Lecciones con medio pendiente ({preview.summary.pendingMedia.length})
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Se importan igual; subir el archivo más tarde desde el editor de cada lección.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
            {preview.summary.pendingMedia.map((p, i) => (
              <li key={i}>
                <span className="text-charcoal">{p.module}</span> · {p.lesson} ({p.type})
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview.warnings.length > 0 && (
        <section className="mt-4 rounded-md border border-amber/30 bg-amber-pale p-3 text-sm">
          <p className="font-medium text-charcoal">Advertencias</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-soft">
            {preview.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="sm" onClick={onConfirm} disabled={!canConfirm || importing}>
          {importing ? 'Importando…' : 'Confirmar e importar'}
        </Button>
        {!canConfirm && !preview.slugTaken && (
          <span className="text-xs text-ink-muted">
            Re-valida para habilitar el botón.
          </span>
        )}
        {importError && <span className="text-xs text-red-err">{importError}</span>}
      </div>
    </section>
  )
}

function Pair({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className={mono ? 'mt-0.5 font-mono text-charcoal' : 'mt-0.5 text-charcoal'}>
        {value || '—'}
      </dd>
    </div>
  )
}
