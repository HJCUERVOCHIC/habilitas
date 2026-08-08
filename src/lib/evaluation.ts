/**
 * Constantes y lógica pura de la evaluación (SPEC-EVALUACION §1.7).
 * Se aíslan del cliente Supabase para poder unit-testear el sorteo, la
 * calificación y la ventana de intentos/bloqueo sin tocar la DB. Las
 * constantes son **fijas** por spec — no columnas por curso.
 */

/** Duración fija de un intento (spec §1.7): 20 minutos. */
export const TIMER_SEC = 20 * 60
/** Bloqueo tras agotar intentos (spec §1.7): 24 horas. */
export const BLOCK_SEC = 24 * 60 * 60
/** Preguntas sorteadas por intento (spec §1.7). */
export const QUESTIONS_PER_ATTEMPT = 10
/**
 * Margen ante red/scheduler al cerrar el timer. El cliente auto-envía a los
 * 20:00 exactos; una llegada al servidor a 20:00.3s no debe descartarse.
 * Mantenerlo pequeño para que no anule el timer.
 */
export const TIMER_GRACE_SEC = 15

/** Sorteo Fisher-Yates: devuelve `n` ids barajados de `ids` sin mutar el input. */
export function drawRandomIds(
  ids: readonly string[],
  n: number,
  rand: () => number = Math.random,
): string[] {
  const copy = ids.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const a = copy[i]!
    const b = copy[j]!
    copy[i] = b
    copy[j] = a
  }
  return copy.slice(0, Math.min(n, copy.length))
}

/**
 * Califica un intento comparando cada `answers[qid]` contra `correctById[qid]`.
 * El score es un entero 0–100 (round). Si no hay preguntas → 0.
 * Diseño: nunca acepta la respuesta correcta desde el cliente; el llamador
 * debe leer `correctById` en servidor (RLS admin/service role).
 */
export function gradeAttempt(
  questionIds: readonly string[],
  correctById: Readonly<Record<string, number>>,
  answers: Readonly<Record<string, number>>,
): { correctCount: number; score: number } {
  const total = questionIds.length
  if (total === 0) return { correctCount: 0, score: 0 }
  let correctCount = 0
  for (const qid of questionIds) {
    const correct = correctById[qid]
    if (correct === undefined) continue
    if (answers[qid] === correct) correctCount++
  }
  const score = Math.round((correctCount / total) * 100)
  return { correctCount, score }
}

/** Segundos transcurridos desde `startedAt` (nunca negativos). */
export function elapsedSec(startedAtIso: string, nowMs: number = Date.now()): number {
  const started = new Date(startedAtIso).getTime()
  return Math.max(0, Math.floor((nowMs - started) / 1000))
}

/** Un intento está expirado si supera 20 min + margen (spec §1.4). */
export function isAttemptExpired(startedAtIso: string, nowMs: number = Date.now()): boolean {
  return elapsedSec(startedAtIso, nowMs) > TIMER_SEC + TIMER_GRACE_SEC
}

/** Segundos restantes del contador visual (para el UI). Nunca negativos. */
export function remainingSec(startedAtIso: string, nowMs: number = Date.now()): number {
  return Math.max(0, TIMER_SEC - elapsedSec(startedAtIso, nowMs))
}

export interface CompletedAttempt {
  submitted_at: string
  passed: boolean
}

export interface AttemptUnlockEntry {
  granted_at: string
}

export type AttemptWindow =
  | { blocked: false; attemptsUsed: number; remaining: number; extraGranted: number }
  | { blocked: true; attemptsUsed: number; remaining: 0; unlockAt: string; extraGranted: number }

/**
 * Modela intentos y bloqueo (spec §1.6 + SPEC-INSCRIPCIONES-SEGUIMIENTO §1.4).
 * Cuenta intentos **cerrados** dentro de la ventana móvil de 24 h; si el
 * estudiante los agotó sin aprobar, queda bloqueado hasta
 * `último submitted_at + 24 h`. Cuando pasa el bloqueo la ventana se reinicia
 * (los intentos antiguos no cuentan). El caller debe filtrar antes los
 * intentos aprobados: `hasPassed` cierra la evaluación y no consume ventana.
 *
 * Anulación manual (F8). `unlocks` son concesiones explícitas del admin, una
 * por intento adicional. Se cuentan dentro de la misma ventana móvil: un
 * unlock caduca 24 h después de concederse si no se usa. El techo efectivo
 * pasa a ser `maxAttempts + unlocksEnVentana`. El historial de intentos no
 * se toca; el unlock solo agranda el techo.
 */
export function computeAttemptWindow(
  completedAttempts: readonly CompletedAttempt[],
  maxAttempts: number,
  unlocks: readonly AttemptUnlockEntry[] = [],
  nowMs: number = Date.now(),
): AttemptWindow {
  const cutoff = nowMs - BLOCK_SEC * 1000
  const inWindow = completedAttempts.filter((a) => new Date(a.submitted_at).getTime() >= cutoff)
  const unlocksInWindow = unlocks.filter((u) => new Date(u.granted_at).getTime() >= cutoff)
  const attemptsUsed = inWindow.length
  const extraGranted = unlocksInWindow.length
  const effectiveMax = maxAttempts + extraGranted
  const remaining = Math.max(0, effectiveMax - attemptsUsed)
  if (remaining > 0) return { blocked: false, attemptsUsed, remaining, extraGranted }

  // Sin intentos: buscar el más reciente para calcular el desbloqueo.
  const latest = inWindow.reduce<CompletedAttempt | null>((acc, a) => {
    if (!acc) return a
    return new Date(a.submitted_at).getTime() > new Date(acc.submitted_at).getTime() ? a : acc
  }, null)
  if (!latest) return { blocked: false, attemptsUsed: 0, remaining: effectiveMax, extraGranted }
  const unlockAt = new Date(new Date(latest.submitted_at).getTime() + BLOCK_SEC * 1000).toISOString()
  return { blocked: true, attemptsUsed, remaining: 0, unlockAt, extraGranted }
}
