'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  saveAttemptAnswers,
  startAttempt,
  submitAttempt,
} from '@/app/curso/[slug]/eval-actions'
import { Button } from '@/components/ui/Button'
import { QUESTIONS_PER_ATTEMPT, TIMER_SEC, remainingSec } from '@/lib/evaluation'
import { cn } from '@/lib/utils'
import type { EvalPageState, EvalReviewItem, EvalSubmit } from '@/types/eval'

type ActiveState = Extract<EvalPageState, { status: 'active' }>
type PassedState = Extract<EvalPageState, { status: 'passed' }>
type BlockedState = Extract<EvalPageState, { status: 'blocked' }>
type ReadyState = Extract<EvalPageState, { status: 'ready' }>
type NoBankState = Extract<EvalPageState, { status: 'no-bank' }>

type Phase =
  | { kind: 'ready'; state: ReadyState }
  | { kind: 'active'; state: ActiveState }
  | { kind: 'submitting'; slug: string; courseTitle: string }
  | { kind: 'result'; slug: string; courseTitle: string; result: EvalSubmit }
  | { kind: 'passed'; state: PassedState }
  | { kind: 'blocked'; state: BlockedState }
  | { kind: 'no-bank'; state: NoBankState }

const AUTOSAVE_MS = 5_000

function initialPhase(state: EvalPageState): Phase {
  switch (state.status) {
    case 'active':
      return { kind: 'active', state }
    case 'passed':
      return { kind: 'passed', state }
    case 'blocked':
      return { kind: 'blocked', state }
    case 'no-bank':
      return { kind: 'no-bank', state }
    case 'ready':
      return { kind: 'ready', state }
    case 'expired-pending':
      // Se resuelve en el efecto (auto-envío con lo que haya).
      return {
        kind: 'submitting',
        slug: state.slug,
        courseTitle: state.courseTitle,
      }
    default:
      // 'auth' y 'enrollment' se redirigen desde el server; nunca deberían llegar
      // aquí. Devolvemos un fallback inerte para satisfacer al type-checker.
      return {
        kind: 'no-bank',
        state: {
          status: 'no-bank',
          slug: '',
          courseTitle: '',
          bankSize: 0,
        },
      }
  }
}

export function EvaluationClient({ state }: { state: EvalPageState }) {
  const [phase, setPhase] = useState<Phase>(() => initialPhase(state))

  // Efecto de arranque: si venimos de `expired-pending`, cerrar el intento
  // con lo que hubiera auto-guardado y transitar al resultado (fallido).
  useEffect(() => {
    if (state.status !== 'expired-pending') return
    let alive = true
    void (async () => {
      const res = await submitAttempt(state.attemptId, {})
      if (!alive) return
      setPhase({
        kind: 'result',
        slug: state.slug,
        courseTitle: state.courseTitle,
        result: res,
      })
    })()
    return () => {
      alive = false
    }
  }, [state])

  const handleStart = useCallback(async (slug: string) => {
    setPhase((p) => ({
      kind: 'submitting',
      slug,
      courseTitle: 'kind' in p && 'state' in p ? getTitle(p) : '',
    }))
    const res = await startAttempt(slug)
    if (!res.ok) {
      // Rechazo → forzar recarga SSR para reflejar el nuevo estado real.
      window.location.reload()
      return
    }
    setPhase({
      kind: 'active',
      state: {
        status: 'active',
        courseTitle: getPhaseTitle(phase),
        slug,
        attemptId: res.attemptId,
        startedAt: res.startedAt,
        questions: res.questions,
        passScore: res.passScore,
        maxAttempts: res.maxAttempts,
        attemptNumber: res.attemptNumber,
        savedAnswers: {},
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const handleSubmit = useCallback(
    async (attemptId: string, answers: Record<string, number>, slug: string, courseTitle: string) => {
      setPhase({ kind: 'submitting', slug, courseTitle })
      const res = await submitAttempt(attemptId, answers)
      setPhase({ kind: 'result', slug, courseTitle, result: res })
    },
    [],
  )

  switch (phase.kind) {
    case 'no-bank':
      return <NoBankScreen state={phase.state} />
    case 'passed':
      return <PassedScreen state={phase.state} />
    case 'blocked':
      return <BlockedScreen state={phase.state} />
    case 'ready':
      return (
        <ReadyScreen
          state={phase.state}
          onStart={() => handleStart(phase.state.slug)}
        />
      )
    case 'active':
      return (
        <ActiveScreen
          state={phase.state}
          onSubmit={(answers) =>
            handleSubmit(phase.state.attemptId, answers, phase.state.slug, phase.state.courseTitle)
          }
        />
      )
    case 'submitting':
      return <SubmittingScreen courseTitle={phase.courseTitle} />
    case 'result':
      return (
        <ResultScreen
          result={phase.result}
          slug={phase.slug}
          courseTitle={phase.courseTitle}
          onRetry={() => handleStart(phase.slug)}
        />
      )
  }
}

function getPhaseTitle(phase: Phase): string {
  if (phase.kind === 'ready' || phase.kind === 'active' || phase.kind === 'passed' ||
      phase.kind === 'blocked' || phase.kind === 'no-bank') {
    return phase.state.courseTitle
  }
  return phase.courseTitle
}

function getTitle(phase: Phase): string {
  return getPhaseTitle(phase)
}

/* -------------------------------------------------------------------------- */
/* Screens                                                                    */
/* -------------------------------------------------------------------------- */

function Shell({
  slug,
  title,
  children,
}: {
  slug: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-mist">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href={`/curso/${slug}`} className="text-sm text-teal hover:text-teal-light">
            ← Volver al curso
          </Link>
          <span className="truncate text-sm font-medium text-ink-soft">{title}</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-white p-6 shadow-sm">{children}</div>
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-mist px-3 py-3 text-center">
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-1 font-display text-lg text-charcoal">{children}</dd>
    </div>
  )
}

function ReadyScreen({ state, onStart }: { state: ReadyState; onStart: () => void }) {
  return (
    <Shell slug={state.slug} title={state.courseTitle}>
      <h1 className="mb-2 font-display text-display-md text-charcoal">Evaluación final</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Al iniciar, se sortean {state.questionCount} preguntas del banco. Dispones de{' '}
        <strong>20 minutos</strong> para responder. Puedes navegar entre preguntas; se guardan a
        medida que respondes. No verás las respuestas correctas durante el intento.
      </p>

      <Card>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Meta label="Duración">20 min</Meta>
          <Meta label="Preguntas">{state.questionCount}</Meta>
          <Meta label="Puntaje mínimo">{state.passScore}%</Meta>
          <Meta label="Intentos">
            {state.remainingAttempts} de {state.maxAttempts}
          </Meta>
        </dl>

        {state.lastFailedScore !== null && (
          <p className="mt-6 rounded-md border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-charcoal">
            Tu último intento no fue aprobado ({state.lastFailedScore}%). Este intento sorteará
            preguntas distintas.
          </p>
        )}

        <ul className="mt-6 space-y-2 text-sm text-ink-soft">
          <li>• No hay feedback por pregunta durante el intento.</li>
          <li>• Al agotarse el tiempo, tu intento se envía automáticamente.</li>
          <li>• Si agotas los intentos sin aprobar, deberás esperar 24 horas para reintentar.</li>
        </ul>

        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={onStart}>
            Iniciar intento
          </Button>
        </div>
      </Card>
    </Shell>
  )
}

function BlockedScreen({ state }: { state: BlockedState }) {
  const unlock = new Date(state.unlockAt)
  return (
    <Shell slug={state.slug} title={state.courseTitle}>
      <h1 className="mb-2 font-display text-display-md text-charcoal">Evaluación final</h1>
      <Card>
        <p className="font-display text-2xl text-red-err">Sin intentos disponibles</p>
        <p className="mt-2 text-sm text-ink-soft">
          Agotaste tus {state.maxAttempts} intentos. Podrás reintentar a partir de:
        </p>
        <p className="mt-4 rounded-md bg-mist px-4 py-3 text-center font-medium text-charcoal">
          {unlock.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
        {state.lastScore !== null && (
          <p className="mt-4 text-xs text-ink-muted">
            Puntaje de tu último intento: {state.lastScore}%.
          </p>
        )}
      </Card>
    </Shell>
  )
}

function NoBankScreen({ state }: { state: NoBankState }) {
  return (
    <Shell slug={state.slug} title={state.courseTitle}>
      <h1 className="mb-2 font-display text-display-md text-charcoal">Evaluación final</h1>
      <Card>
        <p className="text-sm text-ink-soft">
          Esta evaluación todavía no tiene suficientes preguntas cargadas (banco actual:{' '}
          {state.bankSize}, mínimo requerido: {QUESTIONS_PER_ATTEMPT}). Vuelve más tarde.
        </p>
      </Card>
    </Shell>
  )
}

function PassedScreen({ state }: { state: PassedState }) {
  const date = new Date(state.submittedAt)
  const token = state.verificationId ?? state.certId
  return (
    <Shell slug={state.slug} title={state.courseTitle}>
      <h1 className="mb-2 font-display text-display-md text-charcoal">Evaluación aprobada</h1>
      <Card>
        <div className="flex flex-col items-center text-center">
          <ScoreRing score={state.score} passed={true} />
          <p className="mt-4 font-display text-2xl text-green-ok">¡Aprobado!</p>
          <p className="mt-1 text-sm text-ink-soft">
            {state.correct} de {state.total} correctas · Puntaje mínimo {state.passScore}%
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
          {token && (
            <div className="mt-6">
              <Button variant="primary" size="sm" asChild>
                <Link href={`/verificar/${token}`}>Ver constancia →</Link>
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div className="mt-6">
        <h2 className="mb-3 font-display text-lg text-charcoal">Revisión de respuestas</h2>
        <ReviewList review={state.review} />
      </div>
    </Shell>
  )
}

function SubmittingScreen({ courseTitle }: { courseTitle: string }) {
  return (
    <div className="min-h-screen bg-mist">
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-ink-soft">Calificando tu intento…</p>
        <p className="mt-2 text-xs text-ink-muted">{courseTitle}</p>
      </main>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Active attempt                                                             */
/* -------------------------------------------------------------------------- */

function ActiveScreen({
  state,
  onSubmit,
}: {
  state: ActiveState
  onSubmit: (answers: Record<string, number>) => void
}) {
  const [answers, setAnswers] = useState<Record<string, number>>(state.savedAnswers)
  const [current, setCurrent] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(() => remainingSec(state.startedAt))

  const answersRef = useRef(answers)
  answersRef.current = answers
  const submittedRef = useRef(false)

  const doSubmit = useCallback(() => {
    if (submittedRef.current) return
    submittedRef.current = true
    onSubmit(answersRef.current)
  }, [onSubmit])

  // Contador visual derivado de `started_at` (SPEC §1.3). Si supera 0
  // localmente, dispara envío; el servidor valida de todas formas.
  useEffect(() => {
    const id = setInterval(() => {
      const left = remainingSec(state.startedAt)
      setSecondsLeft(left)
      if (left <= 0) {
        clearInterval(id)
        doSubmit()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [state.startedAt, doSubmit])

  // Auto-save periódico + al cerrar la pestaña (spec §1.3 reanuda).
  useEffect(() => {
    const id = setInterval(() => {
      if (submittedRef.current) return
      void saveAttemptAnswers(state.attemptId, answersRef.current)
    }, AUTOSAVE_MS)
    return () => clearInterval(id)
  }, [state.attemptId])

  const q = state.questions[current]
  const answeredCount = state.questions.filter((item) => answers[item.id] !== undefined).length
  const mm = Math.floor(secondsLeft / 60)
  const ss = String(secondsLeft % 60).padStart(2, '0')

  const selectOption = (qid: string, opt: number) => {
    setAnswers((prev) => {
      const next = { ...prev, [qid]: opt }
      // Auto-save de la última respuesta (best-effort).
      void saveAttemptAnswers(state.attemptId, next)
      return next
    })
  }

  return (
    <Shell slug={state.slug} title={state.courseTitle}>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-ink-soft">
          <span className="font-medium text-charcoal">Evaluación final</span>
          <span className="ml-2 text-ink-muted">
            Intento {state.attemptNumber} de {state.maxAttempts}
          </span>
        </div>
        <span
          className={cn(
            'rounded-md px-3 py-1 font-mono text-sm font-semibold',
            secondsLeft <= 30 ? 'bg-red-pale text-red-err' : 'bg-white text-charcoal',
          )}
          aria-label="Tiempo restante"
        >
          {mm}:{ss}
        </span>
      </div>

      <Card>
        {/* Dots de navegación */}
        <div className="mb-6 flex flex-wrap gap-2">
          {state.questions.map((item, index) => {
            const answered = answers[item.id] !== undefined
            const isCurrent = index === current
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrent(index)}
                aria-current={isCurrent ? 'true' : undefined}
                aria-label={`Ir a la pregunta ${index + 1}`}
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

        {q && (
          <div>
            {q.context && (
              <p className="mb-3 rounded-md bg-mist px-4 py-3 text-sm text-ink-soft">
                {q.context}
              </p>
            )}
            <p className="font-medium text-charcoal">
              {current + 1}. {q.text}
            </p>
            <ul className="mt-4 space-y-2">
              {q.options.map((opt, index) => {
                const selected = answers[q.id] === index
                return (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => selectOption(q.id, index)}
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
                          selected
                            ? 'border-teal bg-teal text-white'
                            : 'border-border text-ink-soft',
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
        )}

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
            >
              Anterior
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrent((c) => Math.min(state.questions.length - 1, c + 1))}
              disabled={current === state.questions.length - 1}
            >
              Siguiente
            </Button>
          </div>
          <Button variant="primary" size="sm" onClick={doSubmit}>
            Enviar ({answeredCount}/{state.questions.length})
          </Button>
        </div>
      </Card>
    </Shell>
  )
}

/* -------------------------------------------------------------------------- */
/* Post-submit result                                                         */
/* -------------------------------------------------------------------------- */

function ResultScreen({
  result,
  slug,
  courseTitle,
  onRetry,
}: {
  result: EvalSubmit
  slug: string
  courseTitle: string
  onRetry: () => void
}) {
  const router = useRouter()
  useEffect(() => {
    // Refresca el estado SSR una vez montado para que un reload posterior
    // muestre el estado canónico (aprobado / bloqueado / listo para reintentar).
    router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!result.ok) {
    return (
      <Shell slug={slug} title={courseTitle}>
        <Card>
          <p className="text-sm text-red-err">No pudimos calificar el intento.</p>
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/curso/${slug}`}>Volver al curso</Link>
            </Button>
          </div>
        </Card>
      </Shell>
    )
  }

  const mm = Math.floor(result.timeSpentSec / 60)
  const ss = String(result.timeSpentSec % 60).padStart(2, '0')

  return (
    <Shell slug={slug} title={courseTitle}>
      <Card>
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
            {result.correct} de {result.total} correctas · {mm}:{ss} min
          </p>
          {result.timedOut && (
            <p className="mt-2 text-xs text-amber">
              El intento se envió fuera de tiempo; solo cuentan las respuestas guardadas antes del
              vencimiento.
            </p>
          )}
        </div>

        {result.passed && (result.verificationId || result.certId) && (
          <div className="mt-6 flex justify-center">
            <Button variant="primary" size="sm" asChild>
              <Link href={`/verificar/${result.verificationId ?? result.certId}`}>
                Ver constancia →
              </Link>
            </Button>
          </div>
        )}

        {result.passed && result.review && (
          <div className="mt-8">
            <h2 className="mb-3 font-display text-lg text-charcoal">Revisión de respuestas</h2>
            <ReviewList review={result.review} />
          </div>
        )}

        {!result.passed && (
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
                  Repasa estos temas y vuelve a intentarlo. No mostramos la respuesta correcta.
                </p>
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/curso/${slug}`}>Volver al curso</Link>
              </Button>
              {result.unlockAt ? (
                <div className="text-right text-xs text-ink-muted">
                  Sin intentos restantes. Podrás reintentar el{' '}
                  {new Date(result.unlockAt).toLocaleString('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  .
                </div>
              ) : result.remainingAttempts && result.remainingAttempts > 0 ? (
                <Button variant="primary" size="sm" onClick={onRetry}>
                  Reintentar
                </Button>
              ) : null}
            </div>
          </>
        )}
      </Card>
    </Shell>
  )
}

/* -------------------------------------------------------------------------- */
/* Shared                                                                     */
/* -------------------------------------------------------------------------- */

function ReviewList({ review }: { review: EvalReviewItem[] }) {
  return (
    <div className="space-y-4">
      {review.map((item, index) => (
        <div key={index} className="rounded-md border border-border bg-white p-4">
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

// Constante para que TIMER_SEC no quede como import huérfano si se refactoriza
// el countdown; mantiene la fuente de verdad centralizada en `evaluation.ts`.
void TIMER_SEC
