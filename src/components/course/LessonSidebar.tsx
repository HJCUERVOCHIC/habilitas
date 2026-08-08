'use client'

import Link from 'next/link'

import {
  getModuleStatus,
  isLessonAccessible,
  isLessonCompleted,
} from '@/lib/course-progress'
import { cn } from '@/lib/utils'
import type { ModuleStatus, ModuleWithLessons, ProgressMap } from '@/types/course'

interface LessonSidebarProps {
  modules: ModuleWithLessons[]
  progress: ProgressMap
  currentLessonId: string | null
  onSelect: (lessonId: string) => void
  courseSlug: string
  /**
   * IDs de módulos que muestran la entrada "Practicar" al final del
   * módulo (SPEC-PRACTICA-POR-MODULO §1.4).
   */
  moduleIdsWithPractice: string[]
}

/** Temario con desbloqueo progresivo (HABILITAS-ESPECIFICACION §5.4 RF-4.3/4.4). */
export function LessonSidebar({
  modules,
  progress,
  currentLessonId,
  onSelect,
  courseSlug,
  moduleIdsWithPractice,
}: LessonSidebarProps) {
  const practiceSet = new Set(moduleIdsWithPractice)
  return (
    <nav className="rounded-lg border border-border bg-white p-2" aria-label="Temario del curso">
      {modules.map((mod, index) => {
        const status = getModuleStatus(modules, index, progress)
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
                const accessible = isLessonAccessible(modules, lesson.id, progress)
                const active = lesson.id === currentLessonId
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      disabled={!accessible}
                      onClick={() => onSelect(lesson.id)}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
                        !accessible && 'cursor-not-allowed text-ink-muted',
                        accessible && !active && 'text-ink-main hover:bg-mist',
                        active && 'bg-teal-pale font-medium text-teal',
                      )}
                    >
                      <LessonStatusIcon done={done} locked={!accessible} />
                      <span className="flex-1 truncate">{lesson.title}</span>
                      {lesson.duration_min != null && (
                        <span className="text-xs text-ink-muted">{lesson.duration_min}m</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
            {practiceSet.has(mod.id) && (
              <div className="mt-1 px-3 pb-2">
                <Link
                  href={`/curso/${courseSlug}/practica/${mod.id}`}
                  className="flex w-full items-center gap-2 rounded-md border border-amber/40 bg-amber-pale/40 px-3 py-2 text-left text-sm text-ink-main hover:bg-amber-pale/70"
                >
                  <PracticeIcon />
                  <span className="flex-1">Practicar</span>
                  <span className="text-xs text-ink-soft">formativa</span>
                </Link>
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

function PracticeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-amber"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
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
