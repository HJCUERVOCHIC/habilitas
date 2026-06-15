'use client'

import {
  getModuleStatus,
  isLessonCompleted,
  isModuleUnlocked,
} from '@/lib/course-progress'
import { cn } from '@/lib/utils'
import type { ModuleStatus, ModuleWithLessons, ProgressMap } from '@/types/course'

interface LessonSidebarProps {
  modules: ModuleWithLessons[]
  progress: ProgressMap
  currentLessonId: string | null
  onSelect: (lessonId: string) => void
}

/** Temario con desbloqueo progresivo (HABILITAS-ESPECIFICACION §5.4 RF-4.3/4.4). */
export function LessonSidebar({ modules, progress, currentLessonId, onSelect }: LessonSidebarProps) {
  return (
    <nav className="rounded-lg border border-border bg-white p-2" aria-label="Temario del curso">
      {modules.map((mod, index) => {
        const status = getModuleStatus(modules, index, progress)
        const unlocked = isModuleUnlocked(modules, index, progress)
        return (
          <div key={mod.id} className="mb-1">
            <div className="flex items-center gap-2 px-3 py-2">
              <ModuleStatusIcon status={status} />
              <span
                className={cn(
                  'text-sm font-semibold',
                  status === 'locked' ? 'text-ink-muted' : 'text-charcoal',
                )}
              >
                {mod.title}
              </span>
            </div>
            <ul>
              {mod.lessons.map((lesson) => {
                const done = isLessonCompleted(progress, lesson.id)
                const active = lesson.id === currentLessonId
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      disabled={!unlocked}
                      onClick={() => onSelect(lesson.id)}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
                        !unlocked && 'cursor-not-allowed text-ink-muted',
                        unlocked && !active && 'text-ink-main hover:bg-mist',
                        active && 'bg-teal-pale font-medium text-teal',
                      )}
                    >
                      <LessonStatusIcon done={done} locked={!unlocked} />
                      <span className="flex-1 truncate">{lesson.title}</span>
                      {lesson.duration_min != null && (
                        <span className="text-xs text-ink-muted">{lesson.duration_min}m</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

function ModuleStatusIcon({ status }: { status: ModuleStatus }) {
  if (status === 'completed') {
    return (
      <span className="text-green-ok" aria-label="Módulo completado" title="Completado">
        <CheckCircle />
      </span>
    )
  }
  if (status === 'locked') {
    return (
      <span className="text-ink-muted" aria-label="Módulo bloqueado" title="Bloqueado">
        <Lock />
      </span>
    )
  }
  return (
    <span className="text-teal" aria-label="Módulo en progreso" title="En progreso">
      <Dot />
    </span>
  )
}

function LessonStatusIcon({ done, locked }: { done: boolean; locked: boolean }) {
  if (locked) return <span className="text-ink-muted"><Lock /></span>
  if (done) return <span className="text-green-ok"><CheckCircle /></span>
  return <span className="text-border"><EmptyCircle /></span>
}

function CheckCircle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  )
}
function Lock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
function Dot() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
    </svg>
  )
}
function EmptyCircle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}
