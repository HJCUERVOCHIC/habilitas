import type { ModuleStatus, ModuleWithLessons, ProgressMap } from '@/types/course'

/**
 * Lógica de desbloqueo progresivo y progreso (HABILITAS-ESPECIFICACION §6.2).
 * Pura y sin dependencias: se usa en el cliente (recálculo en vivo) y en el
 * servidor (gating de acceso a contenido). El desbloqueo se evalúa en runtime;
 * no hay tabla de "módulo desbloqueado".
 */

export function isLessonCompleted(progress: ProgressMap, lessonId: string): boolean {
  return progress[lessonId]?.completed === true
}

export function isModuleCompleted(mod: ModuleWithLessons, progress: ProgressMap): boolean {
  return mod.lessons.length > 0 && mod.lessons.every((l) => isLessonCompleted(progress, l.id))
}

/** Módulo N desbloqueado ⟺ todos los módulos previos (0..N-1) están completos. */
export function isModuleUnlocked(
  modules: ModuleWithLessons[],
  index: number,
  progress: ProgressMap,
): boolean {
  for (let i = 0; i < index; i++) {
    const prev = modules[i]
    if (!prev || !isModuleCompleted(prev, progress)) return false
  }
  return true
}

export function getModuleStatus(
  modules: ModuleWithLessons[],
  index: number,
  progress: ProgressMap,
): ModuleStatus {
  if (!isModuleUnlocked(modules, index, progress)) return 'locked'
  const mod = modules[index]
  if (mod && isModuleCompleted(mod, progress)) return 'completed'
  return 'in-progress'
}

export function allModulesCompleted(
  modules: ModuleWithLessons[],
  progress: ProgressMap,
): boolean {
  return modules.length > 0 && modules.every((m) => isModuleCompleted(m, progress))
}

export function countLessons(modules: ModuleWithLessons[]): number {
  return modules.reduce((n, m) => n + m.lessons.length, 0)
}

export function countCompleted(modules: ModuleWithLessons[], progress: ProgressMap): number {
  return modules.reduce(
    (n, m) => n + m.lessons.filter((l) => isLessonCompleted(progress, l.id)).length,
    0,
  )
}

export function progressPct(modules: ModuleWithLessons[], progress: ProgressMap): number {
  const total = countLessons(modules)
  if (total === 0) return 0
  return Math.round((countCompleted(modules, progress) / total) * 100)
}

/** ¿La lección pertenece a un módulo desbloqueado? (gating de acceso). */
export function isLessonAccessible(
  modules: ModuleWithLessons[],
  lessonId: string,
  progress: ProgressMap,
): boolean {
  const index = modules.findIndex((m) => m.lessons.some((l) => l.id === lessonId))
  if (index === -1) return false
  return isModuleUnlocked(modules, index, progress)
}
