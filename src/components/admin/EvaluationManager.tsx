'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  createQuestion,
  deleteQuestion,
  ensureEvaluation,
} from '@/app/admin/actions'
import { Button } from '@/components/ui/Button'

const FIELD =
  'w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink-main outline-none focus:border-teal focus:ring-2 focus:ring-ring'

export interface AdminQuestion {
  id: string
  text: string
  correct_option: number
  options: string[]
}

export function EvaluationManager({
  courseId,
  evaluationId,
  questions,
}: {
  courseId: string
  evaluationId: string | null
  questions: AdminQuestion[]
}) {
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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {questions.map((q, index) => (
          <div
            key={q.id}
            className="flex items-start justify-between gap-4 rounded-md border border-border bg-white p-3 shadow-sm"
          >
            <div className="text-sm">
              <p className="font-medium text-charcoal">
                {index + 1}. {q.text}
              </p>
              <p className="text-ink-muted">
                Correcta: {String.fromCharCode(65 + q.correct_option)}. {q.options[q.correct_option]}
              </p>
            </div>
            <DeleteQuestionButton questionId={q.id} onDone={() => router.refresh()} />
          </div>
        ))}
        <p className="text-sm text-ink-muted">
          {questions.length} preguntas en el banco (recomendado 15–20).
        </p>
      </div>

      <NewQuestionForm evaluationId={evaluationId} onDone={() => router.refresh()} />
    </div>
  )
}

function DeleteQuestionButton({ questionId, onDone }: { questionId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await deleteQuestion(questionId)
        setBusy(false)
        onDone()
      }}
      className="shrink-0 text-xs text-red-err hover:underline"
    >
      Eliminar
    </button>
  )
}

function NewQuestionForm({ evaluationId, onDone }: { evaluationId: string; onDone: () => void }) {
  const [text, setText] = useState('')
  const [context, setContext] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correct, setCorrect] = useState(0)
  const [fbOk, setFbOk] = useState('')
  const [fbWrong, setFbWrong] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function setOption(i: number, v: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)))
  }

  async function add() {
    setBusy(true)
    setError('')
    const res = await createQuestion(evaluationId, {
      text,
      context,
      options,
      correct_option: correct,
      feedback_correct: fbOk,
      feedback_wrong: fbWrong,
    })
    setBusy(false)
    if (res.ok) {
      setText('')
      setContext('')
      setOptions(['', '', '', ''])
      setCorrect(0)
      setFbOk('')
      setFbWrong('')
      onDone()
    } else {
      setError(res.error ?? 'Error')
    }
  }

  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-semibold text-charcoal">Nueva pregunta</h3>
      <textarea className={FIELD} rows={2} placeholder="Enunciado" value={text} onChange={(e) => setText(e.target.value)} />
      <input className={`${FIELD} mt-2`} placeholder="Contexto clínico (opcional)" value={context} onChange={(e) => setContext(e.target.value)} />

      <div className="mt-3 space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct"
              checked={correct === i}
              onChange={() => setCorrect(i)}
              aria-label={`Opción ${String.fromCharCode(65 + i)} correcta`}
            />
            <span className="w-5 text-sm text-ink-muted">{String.fromCharCode(65 + i)}.</span>
            <input className={`${FIELD} flex-1`} placeholder={`Opción ${String.fromCharCode(65 + i)}`} value={opt} onChange={(e) => setOption(i, e.target.value)} />
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input className={FIELD} placeholder="Feedback si acierta" value={fbOk} onChange={(e) => setFbOk(e.target.value)} />
        <input className={FIELD} placeholder="Feedback si falla" value={fbWrong} onChange={(e) => setFbWrong(e.target.value)} />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={add} disabled={busy}>
          Añadir pregunta
        </Button>
        <span className="text-xs text-ink-muted">
          Marca el radio de la opción correcta. No se muestra al estudiante durante el intento.
        </span>
      </div>
      {error && <p className="mt-2 text-sm text-red-err">{error}</p>}
    </div>
  )
}
