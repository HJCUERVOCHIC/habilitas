'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import {
  answerPracticeQuestion,
  startPractice,
} from '@/app/curso/[slug]/practice-actions'
import type { PracticeAnswer, PracticeQuestionForClient } from '@/lib/practice'

interface PracticeRunnerProps {
  courseSlug: string
  courseTitle: string
  moduleId: string
  moduleTitle: string
  minQuestions: number
  availableCount: number
}

type Next = Extract<PracticeAnswer, { ok: true }>['next']

type Phase =
  | { kind: 'intro' }
  | {
      kind: 'answering'
      attemptId: string
      questionIds: string[]
      currentIndex: number
      total: number
      question: PracticeQuestionForClient
      selected: number | null
      correctSoFar: number
    }
  | {
      kind: 'reviewing'
      attemptId: string
      questionIds: string[]
      currentIndex: number
      total: number
      question: PracticeQuestionForClient
      selected: number
      correct: boolean
      correctOption: number
      explanation: string | null
      correctSoFar: number
      next: Next
    }
  | { kind: 'done'; correctCount: number; total: number }

/**
 * Práctica formativa por módulo (SPEC-PRACTICA-POR-MODULO §1.3):
 *   - Sin temporizador.
 *   - Retroalimentación pregunta a pregunta.
 *   - `correct_option` llega SOLO en la respuesta a `answerPracticeQuestion`
 *     (nunca en el sorteo inicial): garantiza el aislamiento con la final.
 *   - Al terminar, aciertos sobre total, sin nota ni aprobado.
 *   - Se puede repetir sin límite.
 */
export function PracticeRunner({
  courseSlug,
  courseTitle,
  moduleTitle,
  moduleId,
  minQuestions,
  availableCount,
}: PracticeRunnerProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function begin() {
    setBusy(true)
    setError('')
    const res = await startPractice({ slug: courseSlug, moduleId })
    setBusy(false)
    if (!res.ok) {
      setError(
        res.reason === 'no-bank'
          ? 'Este módulo no tiene suficientes preguntas para practicar.'
          : res.reason === 'enrollment'
            ? 'Necesitas estar inscrito en el curso.'
            : 'No se pudo iniciar la práctica.',
      )
      return
    }
    setPhase({
      kind: 'answering',
      attemptId: res.attemptId,
      questionIds: res.questionIds,
      currentIndex: 0,
      total: res.total,
      question: res.firstQuestion,
      selected: null,
      correctSoFar: 0,
    })
  }

  async function submitAnswer() {
    if (phase.kind !== 'answering' || phase.selected == null) return
    setBusy(true)
    setError('')
    const res = await answerPracticeQuestion({
      attemptId: phase.attemptId,
      questionIds: phase.questionIds,
      currentIndex: phase.currentIndex,
      questionId: phase.question.id,
      selectedOption: phase.selected,
    })
    setBusy(false)
    if (!res.ok) {
      setError('No se pudo registrar la respuesta.')
      return
    }
    setPhase({
      kind: 'reviewing',
      attemptId: phase.attemptId,
      questionIds: phase.questionIds,
      currentIndex: phase.currentIndex,
      total: phase.total,
      question: phase.question,
      selected: phase.selected,
      correct: res.correct,
      correctOption: res.correctOption,
      explanation: res.explanation,
      correctSoFar: phase.correctSoFar + (res.correct ? 1 : 0),
      next: res.next,
    })
  }

  function advance() {
    if (phase.kind !== 'reviewing') return
    if (phase.next.done) {
      setPhase({
        kind: 'done',
        correctCount: phase.next.correctCount,
        total: phase.next.total,
      })
      return
    }
    setPhase({
      kind: 'answering',
      attemptId: phase.attemptId,
      questionIds: phase.questionIds,
      currentIndex: phase.next.index,
      total: phase.total,
      question: phase.next.question,
      selected: null,
      correctSoFar: phase.correctSoFar,
    })
  }

  if (phase.kind === 'intro') {
    return (
      <PracticeShell courseSlug={courseSlug} courseTitle={courseTitle} moduleTitle={moduleTitle}>
        <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl text-charcoal">Práctica del módulo</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Se sortearán hasta {Math.min(10, availableCount)} preguntas del banco de este
            módulo ({availableCount} etiquetadas). Sin temporizador y sin límite de
            intentos. Es una evaluación formativa: <strong>no</strong> cuenta para el
            progreso del curso, <strong>no</strong> consume intentos de la evaluación
            final y <strong>no</strong> influye en la constancia.
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            Umbral mínimo del módulo: {minQuestions} preguntas etiquetadas.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button variant="primary" onClick={begin} disabled={busy}>
              {busy ? 'Preparando…' : 'Comenzar práctica'}
            </Button>
            <Link
              href={`/curso/${courseSlug}`}
              className="text-sm text-ink-soft hover:text-teal"
            >
              Volver al curso
            </Link>
          </div>
          {error && <p className="mt-3 text-sm text-red-err">{error}</p>}
        </div>
      </PracticeShell>
    )
  }

  if (phase.kind === 'done') {
    const pct = phase.total > 0 ? Math.round((phase.correctCount / phase.total) * 100) : 0
    return (
      <PracticeShell courseSlug={courseSlug} courseTitle={courseTitle} moduleTitle={moduleTitle}>
        <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl text-charcoal">Práctica terminada</h2>
          <p className="mt-2 text-sm text-ink-soft">
            {phase.correctCount} de {phase.total} respuestas correctas ({pct}%).
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Este resultado es formativo y no cuenta para el progreso del curso ni para la
            evaluación final.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button variant="primary" onClick={begin} disabled={busy}>
              Repetir práctica
            </Button>
            <Link
              href={`/curso/${courseSlug}`}
              className="text-sm text-teal hover:text-teal-light"
            >
              Volver al curso
            </Link>
          </div>
        </div>
      </PracticeShell>
    )
  }

  if (phase.kind === 'answering') {
    return (
      <PracticeShell courseSlug={courseSlug} courseTitle={courseTitle} moduleTitle={moduleTitle}>
        <QuestionCard
          index={phase.currentIndex}
          total={phase.total}
          question={phase.question}
          selected={phase.selected}
          onSelect={(i) => setPhase({ ...phase, selected: i })}
          disabled={busy}
          reviewing={false}
        />
        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="primary"
            onClick={submitAnswer}
            disabled={busy || phase.selected == null}
          >
            {busy ? 'Evaluando…' : 'Responder'}
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-red-err">{error}</p>}
      </PracticeShell>
    )
  }

  // phase.kind === 'reviewing'
  const isLast = phase.next.done
  return (
    <PracticeShell courseSlug={courseSlug} courseTitle={courseTitle} moduleTitle={moduleTitle}>
      <QuestionCard
        index={phase.currentIndex}
        total={phase.total}
        question={phase.question}
        selected={phase.selected}
        onSelect={() => {}}
        disabled
        reviewing
        correctOption={phase.correctOption}
      />
      <div
        className={
          phase.correct
            ? 'mt-3 rounded-md border border-green-ok/30 bg-green-pale/50 p-3 text-sm text-ink-main'
            : 'mt-3 rounded-md border border-red-err/30 bg-red-pale/50 p-3 text-sm text-ink-main'
        }
        aria-live="polite"
      >
        <p className="font-semibold">
          {phase.correct ? '✓ Respuesta correcta' : '✗ Respuesta incorrecta'}
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          Correcta: {String.fromCharCode(65 + phase.correctOption)}.{' '}
          {phase.question.options[phase.correctOption]}
        </p>
        {phase.explanation && (
          <p className="mt-2 text-sm text-ink-main">{phase.explanation}</p>
        )}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button variant="primary" onClick={advance}>
          {isLast ? 'Ver resumen' : 'Siguiente pregunta'}
        </Button>
        <span className="text-xs text-ink-soft">
          {phase.correctSoFar} / {phase.currentIndex + 1} correctas hasta aquí
        </span>
      </div>
    </PracticeShell>
  )
}

function PracticeShell({
  courseSlug,
  courseTitle,
  moduleTitle,
  children,
}: {
  courseSlug: string
  courseTitle: string
  moduleTitle: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-mist">
      <header className="bg-charcoal text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <Link
              href={`/curso/${courseSlug}`}
              className="text-xs text-teal-mid hover:text-white"
            >
              ← {courseTitle}
            </Link>
            <p className="truncate text-sm font-semibold">Práctica · {moduleTitle}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  )
}

function QuestionCard({
  index,
  total,
  question,
  selected,
  onSelect,
  disabled,
  reviewing,
  correctOption,
}: {
  index: number
  total: number
  question: PracticeQuestionForClient
  selected: number | null
  onSelect: (i: number) => void
  disabled: boolean
  reviewing: boolean
  correctOption?: number
}) {
  return (
    <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-ink-muted">
        Pregunta {index + 1} de {total}
      </p>
      {question.context && (
        <p className="mt-2 text-sm text-ink-soft">{question.context}</p>
      )}
      <p className="mt-3 font-medium text-charcoal">{question.text}</p>
      <ul className="mt-4 space-y-2">
        {question.options.map((opt, i) => {
          const isSelected = selected === i
          const isCorrect = reviewing && correctOption === i
          const isWrongPick = reviewing && isSelected && correctOption !== i
          const base =
            'flex w-full items-center gap-3 rounded-md border px-4 py-2 text-left text-sm transition-colors'
          const tone = reviewing
            ? isCorrect
              ? 'border-green-ok/50 bg-green-pale/60 text-charcoal'
              : isWrongPick
                ? 'border-red-err/50 bg-red-pale/60 text-charcoal'
                : 'border-border bg-mist text-ink-soft'
            : isSelected
              ? 'border-teal bg-teal-pale text-charcoal'
              : 'border-border bg-white text-ink-main hover:bg-mist'
          return (
            <li key={i}>
              <button
                type="button"
                className={`${base} ${tone}`}
                onClick={() => onSelect(i)}
                disabled={disabled}
                aria-pressed={isSelected}
              >
                <span className="w-5 text-xs text-ink-muted">
                  {String.fromCharCode(65 + i)}.
                </span>
                <span className="flex-1">{opt}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
