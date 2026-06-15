/** Pregunta enviada al cliente: SIN la opción correcta (D1). */
export type EvalQuestion = {
  id: string
  order: number
  text: string
  context: string | null
  options: string[]
}

/** Estado de la evaluación para la pantalla de intro (RF-5.1 / RF-5.9). */
export type EvalIntro = {
  durationMin: number
  questionCount: number
  passScore: number
  maxAttempts: number
  attemptsUsed: number
  hasPassed: boolean
  bankSize: number
  canStart: boolean
  reason: 'ok' | 'auth' | 'enrollment' | 'modules' | 'attempts' | 'passed' | 'no-bank'
}

export type EvalStart =
  | {
      ok: true
      attemptId: string
      startedAt: string
      durationMin: number
      attemptNumber: number
      maxAttempts: number
      passScore: number
      questions: EvalQuestion[]
    }
  | { ok: false; reason: EvalIntro['reason'] }

/** Revisión por pregunta (solo si aprobó — D1). */
export type EvalReviewItem = {
  question: string
  options: string[]
  correctOption: number
  selectedOption: number | null
  correct: boolean
  explanation: string | null
}

export type EvalResult =
  | {
      ok: true
      attemptId: string
      score: number
      passed: boolean
      total: number
      correct: number
      timeSpentSec: number
      // Solo si aprobó:
      review?: EvalReviewItem[]
      // Solo si reprobó (temas a reforzar, sin respuesta literal):
      topics?: string[]
    }
  | { ok: false; reason: 'auth' | 'not-found' | 'mismatch' }
