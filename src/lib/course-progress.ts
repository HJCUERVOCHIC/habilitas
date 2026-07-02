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

/**
 * Desbloqueo progresivo **por lección** (SPEC-REPRODUCTOR-PROGRESO §1.2): la
 * primera lección del curso siempre está abierta; cualquier otra queda
 * desbloqueada solo cuando la anterior (en orden natural) está completada.
 */
export function isLessonAccessible(
  modules: ModuleWithLessons[],
  lessonId: string,
  progress: ProgressMap,
): boolean {
  const flat: string[] = []
  for (const mod of modules) {
    for (const lesson of mod.lessons) flat.push(lesson.id)
  }
  const idx = flat.indexOf(lessonId)
  if (idx === -1) return false
  if (idx === 0) return true
  const prev = flat[idx - 1]
  return prev != null && isLessonCompleted(progress, prev)
}

/**
 * Siguiente lección accesible después de `currentLessonId` en el orden natural
 * del curso, o null si no hay una siguiente accesible (fin del curso o la
 * anterior no está completada). CTA "Siguiente lección" del reproductor.
 */
export function getNextAccessibleLessonId(
  modules: ModuleWithLessons[],
  currentLessonId: string,
  progress: ProgressMap,
): string | null {
  const flat: string[] = []
  for (const mod of modules) {
    for (const lesson of mod.lessons) flat.push(lesson.id)
  }
  const idx = flat.indexOf(currentLessonId)
  if (idx === -1 || idx === flat.length - 1) return null
  const next = flat[idx + 1]
  if (!next) return null
  return isLessonAccessible(modules, next, progress) ? next : null
}

/**
 * Regla D3 validada del lado servidor: video completado sólo si la posición
 * reportada alcanza el ≥90% de la duración. Duración null/0 → no se puede
 * validar → no aceptar completed=true.
 */
export function isVideoCompletionValid(
  lastPositionSec: number,
  durationSec: number | null | undefined,
): boolean {
  if (!durationSec || durationSec <= 0) return false
  if (lastPositionSec < 0) return false
  return lastPositionSec / durationSec >= 0.9
}
