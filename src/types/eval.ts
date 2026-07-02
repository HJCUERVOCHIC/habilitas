/**
 * Contratos de datos de la evaluación (SPEC-EVALUACION).
 * Regla crítica: `correct_option` **no** cruza al cliente durante el intento.
 * El servidor lee las respuestas correctas via service-role y las revela solo
 * en `review` (solo si el estudiante aprobó, D1 / spec §1.5).
 */

/** Pregunta enviada al cliente durante el intento: SIN la opción correcta. */
export type EvalQuestion = {
  id: string
  order: number
  text: string
  context: string | null
  options: string[]
}

/** Revisión por pregunta (solo si aprobó — D1 / spec §1.5). */
export type EvalReviewItem = {
  question: string
  options: string[]
  correctOption: number
  selectedOption: number | null
  correct: boolean
  explanation: string | null
}

/** Resumen de un intento cerrado (para el registro de la constancia en E4). */
export type EvalAttemptSummary = {
  score: number
  passed: boolean
  submittedAt: string
  correctCount: number
  total: number
  timeSpentSec: number
}

/**
 * Estado que renderiza la pantalla /curso/[slug]/evaluacion (SSR).
 * Un solo variant discriminado por `status` — evita props booleanos rotos.
 */
export type EvalPageState =
  | { status: 'auth' }
  | { status: 'enrollment'; slug: string }
  | { status: 'no-bank'; courseTitle: string; slug: string; bankSize: number }
  | {
      status: 'passed'
      courseTitle: string
      slug: string
      score: number
      submittedAt: string
      review: EvalReviewItem[]
      passScore: number
      correct: number
      total: number
      timeSpentSec: number
      /** Token público inadivinable (o cert_id legible como fallback legacy). */
      verificationId: string | null
      certId: string | null
    }
  | {
      status: 'active'
      courseTitle: string
      slug: string
      attemptId: string
      startedAt: string
      questions: EvalQuestion[]
      passScore: number
      maxAttempts: number
      attemptNumber: number
      /** Respuestas previamente guardadas por auto-save (spec §1.3: reanudar). */
      savedAnswers: Record<string, number>
    }
  | {
      status: 'expired-pending'
      courseTitle: string
      slug: string
      attemptId: string
    }
  | {
      status: 'blocked'
      courseTitle: string
      slug: string
      unlockAt: string
      lastScore: number | null
      maxAttempts: number
    }
  | {
      status: 'ready'
      courseTitle: string
      slug: string
      passScore: number
      maxAttempts: number
      remainingAttempts: number
      questionCount: number
      lastFailedScore: number | null
    }

/** Respuesta a startAttempt: éxito con set sorteado, o motivo de rechazo. */
export type EvalStart =
  | {
      ok: true
      attemptId: string
      startedAt: string
      questions: EvalQuestion[]
      passScore: number
      maxAttempts: number
      attemptNumber: number
    }
  | {
      ok: false
      reason: 'auth' | 'enrollment' | 'no-bank' | 'passed' | 'blocked' | 'in-progress'
    }

/** Respuesta a submitAttempt: intento cerrado, con revisión solo si aprobó. */
export type EvalSubmit =
  | {
      ok: true
      score: number
      passed: boolean
      correct: number
      total: number
      timeSpentSec: number
      /** Solo si aprobó — D1 / spec §1.5. */
      review?: EvalReviewItem[]
      /** Solo si NO aprobó — temas a reforzar sin respuesta literal. */
      topics?: string[]
      /** Solo si NO aprobó y aún queda cupo. */
      remainingAttempts?: number
      /** Solo si NO aprobó y se agotaron los intentos → bloqueo 24 h. */
      unlockAt?: string
      /** True si el envío llegó fuera de la ventana de 20 min. */
      timedOut: boolean
      /** Solo si aprobó — token público de la constancia emitida (o `null` si
       *  la emisión falló; la vista sigue mostrando el aprobado). */
      verificationId?: string | null
      certId?: string | null
    }
  | { ok: false; reason: 'auth' | 'not-found' | 'already-submitted' }
