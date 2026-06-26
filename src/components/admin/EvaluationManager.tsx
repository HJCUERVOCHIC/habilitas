'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  createQuestion,
  deleteQuestion,
  ensureEvaluation,
  reorderQuestion,
  setEvaluationConfig,
  updateQuestion,
  type QuestionInput,
} from '@/app/admin/actions'
import { Button } from '@/components/ui/Button'

const FIELD =
  'w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink-main outline-none focus:border-teal focus:ring-2 focus:ring-ring'

// Umbral mínimo de banco recomendado para publicar (CLAUDE.md D4: 15–20).
const RECOMMENDED_MIN_BANK = 15

export interface AdminQuestion {
  id: string
  text: string
  context: string | null
  correct_option: number
  options: string[]
  feedback_correct: string | null
  feedback_wrong: string | null
}

interface EvaluationManagerProps {
  courseId: string
  evaluationId: string | null
  questionsPerAttempt: number
  passScore: number
  questions: AdminQuestion[]
}

export function EvaluationManager({
  courseId,
  evaluationId,
  questionsPerAttempt,
  passScore,
  questions,
}: EvaluationManagerProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!evaluationId) {
    return (
      <div className="rounded-lg border border-border bg-white p-6 text-center shadow-sm">
        <p className="mb-4 text-ink-soft">Este curso aún no tiene evaluación.</p>
        <Button
          variant="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await ensureEvaluation(courseId)
            setBusy(false)
            router.refresh()
          }}
        >
          Crear evaluación
        </Button>
      </div>
    )
  }

  const meetsMinimum =
    questions.length >= Math.max(RECOMMENDED_MIN_BANK, questionsPerAttempt)

  return (
    <div className="space-y-6">
      <ConfigPanel
        courseId={courseId}
        initialQuestionsPerAttempt={questionsPerAttempt}
        initialPassScore={passScore}
        bankSize={questions.length}
      />

      <BankSummary
        bankSize={questions.length}
        questionsPerAttempt={questionsPerAttempt}
        meetsMinimum={meetsMinimum}
      />

      <div className="space-y-2">
        {questions.map((q, index) => (
          <QuestionRow
            key={q.id}
            question={q}
            index={index}
            isFirst={index === 0}
            isLast={index === questions.length - 1}
            onMutated={() => router.refresh()}
          />
        ))}
        {questions.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-white p-6 text-center text-sm text-ink-muted">
            Aún no hay preguntas en el banco. Añade la primera abajo.
          </p>
        )}
      </div>

      <NewQuestionForm
        evaluationId={evaluationId}
        onDone={() => router.refresh()}
      />
    </div>
  )
}

function ConfigPanel({
  courseId,
  initialQuestionsPerAttempt,
  initialPassScore,
  bankSize,
}: {
  courseId: string
  initialQuestionsPerAttempt: number
  initialPassScore: number
  bankSize: number
}) {
  const router = useRouter()
  const [qpa, setQpa] = useState(initialQuestionsPerAttempt)
  const [pass, setPass] = useState(initialPassScore)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')

  const dirty = qpa !== initialQuestionsPerAttempt || pass !== initialPassScore

  async function save() {
    setBusy(true)
    setStatus('idle')
    setError('')
    const res = await setEvaluationConfig(courseId, {
      questions_per_attempt: qpa,
      pass_score: pass,
    })
    setBusy(false)
    if (res.ok) {
      setStatus('saved')
      router.refresh()
    } else {
      setStatus('error')
      setError(res.error ?? 'No se pudo guardar.')
    }
  }

  return (
    <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Configuración
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-main">
            Preguntas por intento
          </span>
          <input
            type="number"
            min={1}
            className={FIELD}
            value={qpa}
            onChange={(e) => setQpa(Math.max(1, Number(e.target.value || 1)))}
          />
          <span className="mt-1 block text-xs text-ink-muted">
            Cuántas preguntas se sortean del banco en cada intento. Hoy el banco
            tiene {bankSize}.
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-main">
            Nota mínima de aprobación
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              className={`${FIELD} flex-1`}
              value={pass}
              onChange={(e) =>
                setPass(Math.min(100, Math.max(0, Number(e.target.value || 0))))
              }
            />
            <span className="text-sm text-ink-soft">%</span>
          </div>
          <span className="mt-1 block text-xs text-ink-muted">
            Porcentaje mínimo para aprobar el intento.
          </span>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={save} disabled={busy || !dirty}>
          {busy ? 'Guardando…' : 'Guardar configuración'}
        </Button>
        {status === 'saved' && <span className="text-xs text-green-ok">✓ Guardado</span>}
        {status === 'error' && <span className="text-xs text-red-err">{error}</span>}
      </div>
    </section>
  )
}

function BankSummary({
  bankSize,
  questionsPerAttempt,
  meetsMinimum,
}: {
  bankSize: number
  questionsPerAttempt: number
  meetsMinimum: boolean
}) {
  const requirement = Math.max(RECOMMENDED_MIN_BANK, questionsPerAttempt)
  return (
    <section
      className={
        meetsMinimum
          ? 'rounded-lg border border-green-ok/30 bg-green-pale p-4 text-sm text-ink-main'
          : 'rounded-lg border border-amber/30 bg-amber-pale p-4 text-sm text-ink-main'
      }
      aria-live="polite"
    >
      <p className="font-medium">
        {meetsMinimum ? '✓ Banco listo para publicar' : '⚠ Banco insuficiente'}
      </p>
      <p className="mt-1 text-xs text-ink-soft">
        {bankSize} preguntas · mínimo recomendado: {requirement} (≥ {RECOMMENDED_MIN_BANK}{' '}
        y ≥ preguntas por intento).
      </p>
    </section>
  )
}

function QuestionRow({
  question,
  index,
  isFirst,
  isLast,
  onMutated,
}: {
  question: AdminQuestion
  index: number
  isFirst: boolean
  isLast: boolean
  onMutated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  async function move(direction: 'up' | 'down') {
    setBusy(true)
    await reorderQuestion(question.id, direction)
    setBusy(false)
    onMutated()
  }

  async function remove() {
    if (!window.confirm('¿Eliminar esta pregunta del banco?')) return
    setBusy(true)
    await deleteQuestion(question.id)
    setBusy(false)
    onMutated()
  }

  if (editing) {
    return (
      <div className="rounded-md border border-border bg-white p-4 shadow-sm">
        <QuestionForm
          initial={question}
          submitLabel="Guardar pregunta"
          onSubmit={async (input) => {
            const res = await updateQuestion(question.id, input)
            if (res.ok) {
              setEditing(false)
              onMutated()
            }
            return res
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-white p-3 shadow-sm">
      <div className="min-w-0 text-sm">
        <p className="font-medium text-charcoal">
          {index + 1}. {question.text}
        </p>
        <p className="text-ink-muted">
          Correcta: {String.fromCharCode(65 + question.correct_option)}.{' '}
          {question.options[question.correct_option]}
        </p>
        {question.feedback_correct && (
          <p className="mt-1 text-xs text-ink-soft">
            <span className="font-medium">Explicación:</span> {question.feedback_correct}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center" role="group" aria-label="Reordenar">
          <button
            type="button"
            onClick={() => move('up')}
            disabled={busy || isFirst}
            aria-label="Mover arriba"
            className="rounded-md px-1.5 py-0.5 text-sm text-ink-soft hover:bg-mist disabled:opacity-40"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => move('down')}
            disabled={busy || isLast}
            aria-label="Mover abajo"
            className="rounded-md px-1.5 py-0.5 text-sm text-ink-soft hover:bg-mist disabled:opacity-40"
          >
            ↓
          </button>
        </div>
        <button
          type="button"
          className="text-xs text-teal hover:underline"
          onClick={() => setEditing(true)}
        >
          Editar
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="shrink-0 text-xs text-red-err hover:underline"
        >
          Eliminar
        </button>
      </div>
    </div>
  )
}

function NewQuestionForm({
  evaluationId,
  onDone,
}: {
  evaluationId: string
  onDone: () => void
}) {
  const [resetKey, setResetKey] = useState(0)
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-semibold text-charcoal">Nueva pregunta</h3>
      <QuestionForm
        key={resetKey}
        initial={{
          text: '',
          context: null,
          options: ['', '', '', ''],
          correct_option: 0,
          feedback_correct: null,
          feedback_wrong: null,
        }}
        submitLabel="Añadir pregunta"
        onSubmit={async (input) => {
          const res = await createQuestion(evaluationId, input)
          if (res.ok) {
            setResetKey((k) => k + 1)
            onDone()
          }
          return res
        }}
      />
    </div>
  )
}

function QuestionForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: {
    text: string
    context: string | null
    options: string[]
    correct_option: number
    feedback_correct: string | null
    feedback_wrong: string | null
  }
  submitLabel: string
  onSubmit: (input: QuestionInput) => Promise<{ ok: boolean; error?: string }>
  onCancel?: () => void
}) {
  const [text, setText] = useState(initial.text)
  const [context, setContext] = useState(initial.context ?? '')
  const [options, setOptions] = useState<string[]>(
    initial.options.length >= 2 ? [...initial.options] : ['', '', '', ''],
  )
  const [correct, setCorrect] = useState(initial.correct_option)
  const [fbOk, setFbOk] = useState(initial.feedback_correct ?? '')
  const [fbWrong, setFbWrong] = useState(initial.feedback_wrong ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function setOption(i: number, v: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)))
  }

  function addOption() {
    setOptions((prev) => [...prev, ''])
  }

  function removeOption(i: number) {
    setOptions((prev) => {
      const next = prev.filter((_, idx) => idx !== i)
      // Si dejamos menos de 2, restablecer mínimo.
      if (next.length < 2) return ['', '']
      return next
    })
    if (correct === i) setCorrect(0)
    else if (correct > i) setCorrect((c) => c - 1)
  }

  async function submit() {
    setBusy(true)
    setError('')
    const res = await onSubmit({
      text,
      context,
      options,
      correct_option: correct,
      feedback_correct: fbOk,
      feedback_wrong: fbWrong,
    })
    setBusy(false)
    if (!res.ok) setError(res.error ?? 'Error.')
  }

  return (
    <div>
      <textarea
        className={FIELD}
        rows={2}
        placeholder="Enunciado"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <input
        className={`${FIELD} mt-2`}
        placeholder="Contexto clínico (opcional)"
        value={context}
        onChange={(e) => setContext(e.target.value)}
      />

      <div className="mt-3 space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name={`correct-${initial.text || 'new'}`}
              checked={correct === i}
              onChange={() => setCorrect(i)}
              aria-label={`Opción ${String.fromCharCode(65 + i)} correcta`}
            />
            <span className="w-5 text-sm text-ink-muted">
              {String.fromCharCode(65 + i)}.
            </span>
            <input
              className={`${FIELD} flex-1`}
              placeholder={`Opción ${String.fromCharCode(65 + i)}`}
              value={opt}
              onChange={(e) => setOption(i, e.target.value)}
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="text-xs text-red-err hover:underline"
                aria-label={`Quitar opción ${String.fromCharCode(65 + i)}`}
              >
                Quitar
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addOption}
          className="text-xs text-teal hover:underline"
        >
          + Añadir opción
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          className={FIELD}
          placeholder="Explicación de la respuesta (visible al aprobar)"
          value={fbOk}
          onChange={(e) => setFbOk(e.target.value)}
        />
        <input
          className={FIELD}
          placeholder="Mensaje al fallar (opcional)"
          value={fbWrong}
          onChange={(e) => setFbWrong(e.target.value)}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="sm" onClick={submit} disabled={busy}>
          {busy ? 'Guardando…' : submitLabel}
        </Button>
        {onCancel && (
          <button
            type="button"
            className="text-xs text-ink-soft hover:text-ink-main"
            onClick={onCancel}
          >
            Cancelar
          </button>
        )}
        <span className="text-xs text-ink-muted">
          Marca el radio de la opción correcta. No se muestra al estudiante durante el intento.
        </span>
      </div>
      {error && <p className="mt-2 text-sm text-red-err">{error}</p>}
    </div>
  )
}
