'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  emitCertificate,
  getEvaluationState,
  startAttempt,
  submitAttempt,
} from '@/app/curso/[slug]/eval-actions'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { EvalIntro, EvalQuestion, EvalResult } from '@/types/eval'

type Phase = 'loading' | 'intro' | 'questions' | 'submitting' | 'results'

const REASON_MESSAGES: Record<EvalIntro['reason'], string> = {
  ok: '',
  auth: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  enrollment: 'No estás inscrito en este curso.',
  modules: 'Completa todos los módulos para desbloquear la evaluación.',
  attempts: 'Agotaste tus intentos disponibles.',
  passed: 'Ya aprobaste esta evaluación.',
  'no-bank': 'Esta evaluación todavía no tiene preguntas.',
}

export function EvalModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [intro, setIntro] = useState<EvalIntro | null>(null)

  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<EvalQuestion[]>([])
  const [responses, setResponses] = useState<Record<string, number>>({})
  const [current, setCurrent] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [attemptNumber, setAttemptNumber] = useState(0)
  const [maxAttempts, setMaxAttempts] = useState(0)

  const [result, setResult] = useState<EvalResult | null>(null)
  const [emitting, setEmitting] = useState(false)
  const submittedRef = useRef(false)
  // Ref con las respuestas actuales: permite que el temporizador lea lo último
  // sin depender de `responses` (que reiniciaría el tick de 1s al responder).
  const responsesRef = useRef(responses)
  responsesRef.current = responses

  useEffect(() => {
    getEvaluationState(slug).then((state) => {
      setIntro(state)
      setPhase('intro')
    })
  }, [slug])

  const doSubmit = useCallback(
    async (id: string, answers: Record<string, number>) => {
      if (submittedRef.current) return
      submittedRef.current = true
      setPhase('submitting')
      const res = await submitAttempt(id, answers)
      setResult(res)
      setPhase('results')
    },
    [],
  )

  // Temporizador visual; al llegar a 0 fuerza el envío (D7). No depende de
  // `responses` para que el tick de 1s no se reinicie al seleccionar opciones.
  useEffect(() => {
    if (phase !== 'questions' || !attemptId) return
    if (secondsLeft <= 0) {
      void doSubmit(attemptId, responsesRef.current)
      return
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, secondsLeft, attemptId, doSubmit])

  async function handleStart() {
    setPhase('loading')
    const res = await startAttempt(slug)
    if (!res.ok) {
      const state = await getEvaluationState(slug)
      setIntro(state)
      setPhase('intro')
      return
    }
    submittedRef.current = false
    setAttemptId(res.attemptId)
    setQuestions(res.questions)
    setResponses({})
    setCurrent(0)
    setSecondsLeft(res.durationMin * 60)
    setAttemptNumber(res.attemptNumber)
    setMaxAttempts(res.maxAttempts)
    setResult(null)
    setPhase('questions')
  }

  async function handleEmit() {
    if (!attemptId) return
    setEmitting(true)
    const res = await emitCertificate(attemptId)
    if (res.ok) {
      router.push(`/verificar/${res.certId}`)
    } else {
      setEmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-charcoal/60 p-4">
      <div className="my-8 w-full max-w-2xl rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-xl text-charcoal">Evaluación final</h2>
          {phase !== 'questions' && (
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-ink-soft hover:text-charcoal"
            >
              Cerrar ✕
            </button>
          )}
        </div>

        <div className="px-6 py-6">
          {phase === 'loading' && <p className="text-center text-ink-soft">Cargando…</p>}

          {phase === 'intro' && intro && (
            <IntroScreen intro={intro} onStart={handleStart} onClose={onClose} />
          )}

          {phase === 'questions' && questions[current] && (
            <QuestionsScreen
              questions={questions}
              current={current}
              responses={responses}
              secondsLeft={secondsLeft}
              attemptNumber={attemptNumber}
              maxAttempts={maxAttempts}
              onSelect={(qid, opt) => setResponses((r) => ({ ...r, [qid]: opt }))}
              onGoto={setCurrent}
              onSubmit={() => attemptId && doSubmit(attemptId, responses)}
            />
          )}

          {phase === 'submitting' && (
            <p className="text-center text-ink-soft">Calificando tu intento…</p>
          )}

          {phase === 'results' && result && (
            <ResultsScreen
              result={result}
              canRetry={attemptNumber < maxAttempts}
              emitting={emitting}
              onEmit={handleEmit}
              onRetry={handleStart}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function IntroScreen({
  intro,
  onStart,
  onClose,
}: {
  intro: EvalIntro
  onStart: () => void
  onClose: () => void
}) {
  return (
    <div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Meta label="Duración">{intro.durationMin} min</Meta>
        <Meta label="Preguntas">{intro.questionCount}</Meta>
        <Meta label="Puntaje mínimo">{intro.passScore}%</Meta>
        <Meta label="Intentos">
          {Math.max(0, intro.maxAttempts - intro.attemptsUsed)} de {intro.maxAttempts}
        </Meta>
      </dl>

      {intro.canStart ? (
        <>
          <p className="mt-6 text-sm text-ink-soft">
            Se sortean {intro.questionCount} preguntas al azar. No verás las respuestas correctas
            durante el intento. Al agotarse el tiempo, se enviará automáticamente.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={onStart}>
              Comenzar evaluación
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-6 rounded-md bg-mist px-4 py-3 text-sm text-ink-soft">
            {REASON_MESSAGES[intro.reason] || 'No puedes iniciar la evaluación ahora.'}
          </p>
          <div className="mt-6 flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function QuestionsScreen({
  questions,
  current,
  responses,
  secondsLeft,
  attemptNumber,
  maxAttempts,
  onSelect,
  onGoto,
  onSubmit,
}: {
  questions: EvalQuestion[]
  current: number
  responses: Record<string, number>
  secondsLeft: number
  attemptNumber: number
  maxAttempts: number
  onSelect: (qid: string, opt: number) => void
  onGoto: (index: number) => void
  onSubmit: () => void
}) {
  const q = questions[current]
  if (!q) return null
  const answeredCount = questions.filter((item) => responses[item.id] !== undefined).length
  const mm = Math.floor(secondsLeft / 60)
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-muted">
          Intento {attemptNumber} de {maxAttempts}
        </span>
        <span
          className={cn(
            'rounded-md px-3 py-1 font-mono text-sm font-semibold',
            secondsLeft <= 30 ? 'bg-red-pale text-red-err' : 'bg-mist text-charcoal',
          )}
          aria-label="Tiempo restante"
        >
          {mm}:{ss}
        </span>
      </div>

      {/* Dots de navegación */}
      <div className="mt-4 flex flex-wrap gap-2">
        {questions.map((item, index) => {
          const answered = responses[item.id] !== undefined
          const isCurrent = index === current
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onGoto(index)}
              aria-current={isCurrent ? 'true' : undefined}
              className={cn(
                'h-8 w-8 rounded-md text-sm font-medium',
                isCurrent
                  ? 'bg-teal text-white'
                  : answered
                    ? 'bg-teal-pale text-teal'
                    : 'border border-border bg-white text-ink-soft',
              )}
            >
              {index + 1}
            </button>
          )
        })}
      </div>

      {/* Pregunta */}
      <div className="mt-6">
        {q.context && (
          <p className="mb-3 rounded-md bg-mist px-4 py-3 text-sm text-ink-soft">{q.context}</p>
        )}
        <p className="font-medium text-charcoal">
          {current + 1}. {q.text}
        </p>
        <ul className="mt-4 space-y-2">
          {q.options.map((opt, index) => {
            const selected = responses[q.id] === index
            return (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => onSelect(q.id, index)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-sm',
                    selected
                      ? 'border-teal bg-teal-pale text-charcoal'
                      : 'border-border bg-white text-ink-main hover:bg-mist',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                      selected ? 'border-teal bg-teal text-white' : 'border-border text-ink-soft',
                    )}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  {opt}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onGoto(Math.max(0, current - 1))}
            disabled={current === 0}
          >
            Anterior
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onGoto(Math.min(questions.length - 1, current + 1))}
            disabled={current === questions.length - 1}
          >
            Siguiente
          </Button>
        </div>
        <Button variant="primary" size="sm" onClick={onSubmit}>
          Enviar ({answeredCount}/{questions.length})
        </Button>
      </div>
    </div>
  )
}

function ResultsScreen({
  result,
  canRetry,
  emitting,
  onEmit,
  onRetry,
  onClose,
}: {
  result: EvalResult
  canRetry: boolean
  emitting: boolean
  onEmit: () => void
  onRetry: () => void
  onClose: () => void
}) {
  if (!result.ok) {
    return <p className="text-center text-ink-soft">No pudimos calificar el intento.</p>
  }
  const minutes = Math.floor(result.timeSpentSec / 60)
  const seconds = String(result.timeSpentSec % 60).padStart(2, '0')

  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <ScoreRing score={result.score} passed={result.passed} />
        <p
          className={cn(
            'mt-4 font-display text-2xl',
            result.passed ? 'text-green-ok' : 'text-red-err',
          )}
        >
          {result.passed ? '¡Aprobado!' : 'No aprobado'}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {result.correct} de {result.total} correctas · {minutes}:{seconds} min
        </p>
      </div>

      {result.passed ? (
        <>
          <div className="mt-6 flex justify-center">
            <Button variant="primary" size="lg" onClick={onEmit} disabled={emitting}>
              {emitting ? 'Emitiendo…' : 'Obtener certificado'}
            </Button>
          </div>
          {result.review && (
            <div className="mt-8 space-y-4">
              <h3 className="font-semibold text-charcoal">Revisión de respuestas</h3>
              {result.review.map((item, index) => (
                <div key={index} className="rounded-md border border-border p-4">
                  <p className="text-sm font-medium text-charcoal">
                    {index + 1}. {item.question}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {item.options.map((opt, optIndex) => (
                      <li
                        key={optIndex}
                        className={cn(
                          optIndex === item.correctOption && 'font-medium text-green-ok',
                          optIndex === item.selectedOption &&
                            optIndex !== item.correctOption &&
                            'text-red-err line-through',
                        )}
                      >
                        {String.fromCharCode(65 + optIndex)}. {opt}
                        {optIndex === item.correctOption && ' ✓'}
                      </li>
                    ))}
                  </ul>
                  {item.explanation && (
                    <p className="mt-2 text-xs text-ink-soft">{item.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {result.topics && result.topics.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-charcoal">Temas a reforzar</h3>
              <ul className="mt-2 space-y-1.5">
                {result.topics.map((topic, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-ink-soft">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                    {topic}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-muted">
                Repasa estos temas y vuelve a intentarlo. (No mostramos la respuesta correcta.)
              </p>
            </div>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
            {canRetry ? (
              <Button variant="primary" onClick={onRetry}>
                Reintentar
              </Button>
            ) : (
              <span className="self-center text-sm text-ink-muted">
                Sin intentos restantes.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ScoreRing({ score, passed }: { score: number; passed: boolean }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = passed ? '#1A7A4A' : '#C0392B'
  return (
    <svg width="130" height="130" viewBox="0 0 130 130" aria-label={`Puntaje ${score}%`}>
      <circle cx="65" cy="65" r={radius} fill="none" stroke="#E6F5F5" strokeWidth="10" />
      <circle
        cx="65"
        cy="65"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 65 65)"
      />
      <text x="65" y="72" textAnchor="middle" className="fill-charcoal font-display text-3xl">
        {score}%
      </text>
    </svg>
  )
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-mist px-3 py-2 text-center">
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold text-charcoal">{children}</dd>
    </div>
  )
}
