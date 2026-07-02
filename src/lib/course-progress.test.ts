import { describe, expect, it } from 'vitest'

import {
  allModulesCompleted,
  getModuleStatus,
  getNextAccessibleLessonId,
  isLessonAccessible,
  isModuleUnlocked,
  isVideoCompletionValid,
  progressPct,
} from './course-progress'
import type { ModuleWithLessons, ProgressMap } from '@/types/course'

const modules: ModuleWithLessons[] = [
  {
    id: 'm1',
    title: 'Módulo 1',
    order_index: 1,
    lessons: [
      { id: 'l1', title: 'L1', order_index: 1, content_type: 'video', duration_min: 10 },
      { id: 'l2', title: 'L2', order_index: 2, content_type: 'pdf', duration_min: 5 },
    ],
  },
  {
    id: 'm2',
    title: 'Módulo 2',
    order_index: 2,
    lessons: [{ id: 'l3', title: 'L3', order_index: 1, content_type: 'text', duration_min: 6 }],
  },
]

const completed = (...ids: string[]): ProgressMap =>
  Object.fromEntries(ids.map((id) => [id, { completed: true, last_position: 0 }]))

describe('course-progress', () => {
  it('el primer módulo siempre está desbloqueado', () => {
    expect(isModuleUnlocked(modules, 0, {})).toBe(true)
  })

  it('el módulo 2 está bloqueado hasta completar todo el módulo 1', () => {
    expect(isModuleUnlocked(modules, 1, {})).toBe(false)
    expect(isModuleUnlocked(modules, 1, completed('l1'))).toBe(false)
    expect(isModuleUnlocked(modules, 1, completed('l1', 'l2'))).toBe(true)
  })

  it('una lección de un módulo bloqueado no es accesible', () => {
    expect(isLessonAccessible(modules, 'l3', {})).toBe(false)
    expect(isLessonAccessible(modules, 'l3', completed('l1', 'l2'))).toBe(true)
    expect(isLessonAccessible(modules, 'l1', {})).toBe(true)
  })

  it('estados de módulo', () => {
    expect(getModuleStatus(modules, 0, {})).toBe('in-progress')
    expect(getModuleStatus(modules, 0, completed('l1', 'l2'))).toBe('completed')
    expect(getModuleStatus(modules, 1, {})).toBe('locked')
  })

  it('porcentaje y completitud total', () => {
    expect(progressPct(modules, {})).toBe(0)
    expect(progressPct(modules, completed('l1'))).toBe(33)
    expect(allModulesCompleted(modules, completed('l1', 'l2', 'l3'))).toBe(true)
  })

  it('siguiente lección accesible respeta el desbloqueo progresivo', () => {
    // l1 completada → l2 accesible (mismo módulo).
    expect(getNextAccessibleLessonId(modules, 'l1', completed('l1'))).toBe('l2')
    // l1 no completada → no puedes saltar a l2 (no accesible aún).
    expect(getNextAccessibleLessonId(modules, 'l1', {})).toBe(null)
    // Fin de módulo: l2 completada + l1 completada → l3 accesible (mod2).
    expect(getNextAccessibleLessonId(modules, 'l2', completed('l1', 'l2'))).toBe('l3')
    // l3 es la última → no hay siguiente.
    expect(getNextAccessibleLessonId(modules, 'l3', completed('l1', 'l2', 'l3'))).toBe(null)
    // Lección desconocida → null.
    expect(getNextAccessibleLessonId(modules, 'xx', {})).toBe(null)
  })
})

describe('isVideoCompletionValid', () => {
  it('acepta si la posición supera el 90% de la duración', () => {
    expect(isVideoCompletionValid(90, 100)).toBe(true)
    expect(isVideoCompletionValid(100, 100)).toBe(true)
    expect(isVideoCompletionValid(95, 100)).toBe(true)
  })

  it('rechaza si la posición no llega al 90%', () => {
    expect(isVideoCompletionValid(89, 100)).toBe(false)
    expect(isVideoCompletionValid(0, 100)).toBe(false)
  })

  it('rechaza cuando duración es 0, null o undefined', () => {
    expect(isVideoCompletionValid(50, 0)).toBe(false)
    expect(isVideoCompletionValid(50, null)).toBe(false)
    expect(isVideoCompletionValid(50, undefined)).toBe(false)
  })

  it('rechaza posición negativa', () => {
    expect(isVideoCompletionValid(-1, 100)).toBe(false)
  })
})
