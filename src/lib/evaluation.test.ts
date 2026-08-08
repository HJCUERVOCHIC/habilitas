import { describe, expect, it } from 'vitest'

import {
  BLOCK_SEC,
  QUESTIONS_PER_ATTEMPT,
  TIMER_SEC,
  TIMER_GRACE_SEC,
  computeAttemptWindow,
  drawRandomIds,
  elapsedSec,
  gradeAttempt,
  isAttemptExpired,
  remainingSec,
} from './evaluation'

describe('constantes fijas por spec', () => {
  it('son 20 min, 24 h y 10 preguntas', () => {
    expect(TIMER_SEC).toBe(20 * 60)
    expect(BLOCK_SEC).toBe(24 * 60 * 60)
    expect(QUESTIONS_PER_ATTEMPT).toBe(10)
  })
})

describe('drawRandomIds', () => {
  it('devuelve exactamente n ids sin duplicar', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const out = drawRandomIds(ids, 5, () => 0.5)
    expect(out).toHaveLength(5)
    expect(new Set(out).size).toBe(5)
    for (const id of out) expect(ids).toContain(id)
  })

  it('si n > pool, devuelve el pool completo barajado', () => {
    const ids = ['a', 'b', 'c']
    const out = drawRandomIds(ids, 10, () => 0)
    expect(out).toHaveLength(3)
    expect(new Set(out)).toEqual(new Set(ids))
  })

  it('no muta el arreglo original', () => {
    const ids = ['a', 'b', 'c', 'd']
    drawRandomIds(ids, 2, () => 0.5)
    expect(ids).toEqual(['a', 'b', 'c', 'd'])
  })

  it('rand=0 produce un orden determinista predecible', () => {
    // Con rand()===0, Fisher-Yates siempre intercambia con el índice 0.
    const ids = ['a', 'b', 'c']
    const out = drawRandomIds(ids, 3, () => 0)
    expect(out).toHaveLength(3)
    expect(new Set(out)).toEqual(new Set(ids))
  })
})

describe('gradeAttempt', () => {
  const correctById = { q1: 0, q2: 1, q3: 2, q4: 3 }

  it('todas correctas → 100', () => {
    const { correctCount, score } = gradeAttempt(
      ['q1', 'q2', 'q3', 'q4'],
      correctById,
      { q1: 0, q2: 1, q3: 2, q4: 3 },
    )
    expect(correctCount).toBe(4)
    expect(score).toBe(100)
  })

  it('cero respuestas → 0', () => {
    const { correctCount, score } = gradeAttempt(['q1', 'q2', 'q3', 'q4'], correctById, {})
    expect(correctCount).toBe(0)
    expect(score).toBe(0)
  })

  it('respuestas parciales cuentan solo las coincidentes', () => {
    const { correctCount, score } = gradeAttempt(
      ['q1', 'q2', 'q3', 'q4'],
      correctById,
      { q1: 0, q2: 0, q3: 2 },
    )
    expect(correctCount).toBe(2)
    expect(score).toBe(50)
  })

  it('respuestas a preguntas fuera del set no cuentan', () => {
    const { correctCount, score } = gradeAttempt(['q1'], correctById, { q1: 0, qX: 0 })
    expect(correctCount).toBe(1)
    expect(score).toBe(100)
  })

  it('sin preguntas → 0/0 (no divide por cero)', () => {
    const { correctCount, score } = gradeAttempt([], correctById, { q1: 0 })
    expect(correctCount).toBe(0)
    expect(score).toBe(0)
  })
})

describe('elapsedSec / isAttemptExpired / remainingSec', () => {
  const start = '2026-07-02T10:00:00.000Z'
  const startMs = new Date(start).getTime()

  it('elapsed es 0 si now < startedAt (nunca negativo)', () => {
    expect(elapsedSec(start, startMs - 5_000)).toBe(0)
  })

  it('remainingSec arranca en TIMER_SEC y baja a 0 al cumplir', () => {
    expect(remainingSec(start, startMs)).toBe(TIMER_SEC)
    expect(remainingSec(start, startMs + TIMER_SEC * 1000)).toBe(0)
    expect(remainingSec(start, startMs + (TIMER_SEC + 60) * 1000)).toBe(0)
  })

  it('isAttemptExpired es false dentro del timer + gracia', () => {
    expect(isAttemptExpired(start, startMs + (TIMER_SEC - 1) * 1000)).toBe(false)
    expect(isAttemptExpired(start, startMs + (TIMER_SEC + TIMER_GRACE_SEC) * 1000)).toBe(false)
  })

  it('isAttemptExpired es true al superar timer + gracia', () => {
    expect(isAttemptExpired(start, startMs + (TIMER_SEC + TIMER_GRACE_SEC + 1) * 1000)).toBe(true)
  })
})

describe('computeAttemptWindow', () => {
  const now = new Date('2026-07-02T12:00:00.000Z').getTime()
  const isoDaysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString()
  const isoHoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString()

  it('sin intentos → todos disponibles', () => {
    const w = computeAttemptWindow([], 3, [], now)
    expect(w.blocked).toBe(false)
    if (!w.blocked) {
      expect(w.attemptsUsed).toBe(0)
      expect(w.remaining).toBe(3)
    }
  })

  it('un intento reciente resta uno del cupo', () => {
    const w = computeAttemptWindow(
      [{ submitted_at: isoHoursAgo(1), passed: false }],
      3,
      [],
      now,
    )
    expect(w.blocked).toBe(false)
    if (!w.blocked) {
      expect(w.attemptsUsed).toBe(1)
      expect(w.remaining).toBe(2)
    }
  })

  it('tres intentos en la ventana sin aprobar → bloqueado hasta último + 24h', () => {
    const lastAttempt = isoHoursAgo(2)
    const w = computeAttemptWindow(
      [
        { submitted_at: isoHoursAgo(5), passed: false },
        { submitted_at: isoHoursAgo(3), passed: false },
        { submitted_at: lastAttempt, passed: false },
      ],
      3,
      [],
      now,
    )
    expect(w.blocked).toBe(true)
    if (w.blocked) {
      expect(w.attemptsUsed).toBe(3)
      expect(w.remaining).toBe(0)
      expect(new Date(w.unlockAt).getTime()).toBe(
        new Date(lastAttempt).getTime() + BLOCK_SEC * 1000,
      )
    }
  })

  it('intentos antiguos fuera de la ventana no cuentan (se reinicia)', () => {
    const w = computeAttemptWindow(
      [
        { submitted_at: isoDaysAgo(5), passed: false },
        { submitted_at: isoDaysAgo(3), passed: false },
        { submitted_at: isoDaysAgo(2), passed: false },
      ],
      3,
      [],
      now,
    )
    expect(w.blocked).toBe(false)
    if (!w.blocked) {
      expect(w.attemptsUsed).toBe(0)
      expect(w.remaining).toBe(3)
    }
  })

  it('mezcla dentro/fuera de ventana cuenta solo los dentro', () => {
    const w = computeAttemptWindow(
      [
        { submitted_at: isoDaysAgo(5), passed: false }, // fuera
        { submitted_at: isoHoursAgo(10), passed: false }, // dentro
      ],
      3,
      [],
      now,
    )
    expect(w.blocked).toBe(false)
    if (!w.blocked) {
      expect(w.attemptsUsed).toBe(1)
      expect(w.remaining).toBe(2)
    }
  })

  it('exactamente en el límite (justo 24 h) cuenta como dentro', () => {
    const w = computeAttemptWindow(
      [{ submitted_at: new Date(now - BLOCK_SEC * 1000).toISOString(), passed: false }],
      3,
      [],
      now,
    )
    expect(w.blocked).toBe(false)
    if (!w.blocked) expect(w.attemptsUsed).toBe(1)
  })

  it('un unlock concedido en ventana desbloquea al estudiante bloqueado', () => {
    const lastAttempt = isoHoursAgo(2)
    const w = computeAttemptWindow(
      [
        { submitted_at: isoHoursAgo(5), passed: false },
        { submitted_at: isoHoursAgo(3), passed: false },
        { submitted_at: lastAttempt, passed: false },
      ],
      3,
      [{ granted_at: isoHoursAgo(1) }],
      now,
    )
    expect(w.blocked).toBe(false)
    if (!w.blocked) {
      expect(w.attemptsUsed).toBe(3)
      expect(w.extraGranted).toBe(1)
      expect(w.remaining).toBe(1)
    }
  })

  it('unlock viejo (>24 h) ya no cuenta — la ventana lo descarta como a los intentos', () => {
    const w = computeAttemptWindow(
      [
        { submitted_at: isoHoursAgo(5), passed: false },
        { submitted_at: isoHoursAgo(3), passed: false },
        { submitted_at: isoHoursAgo(2), passed: false },
      ],
      3,
      [{ granted_at: isoDaysAgo(3) }],
      now,
    )
    expect(w.blocked).toBe(true)
    if (w.blocked) expect(w.extraGranted).toBe(0)
  })

  it('unlock concede un intento adicional, no restablece todos', () => {
    // Sin intentos usados: el techo pasa de 3 a 4, no a infinito.
    const w = computeAttemptWindow(
      [],
      3,
      [{ granted_at: isoHoursAgo(1) }],
      now,
    )
    expect(w.blocked).toBe(false)
    if (!w.blocked) {
      expect(w.extraGranted).toBe(1)
      expect(w.remaining).toBe(4)
    }
  })
})
