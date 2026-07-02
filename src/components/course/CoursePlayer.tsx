'use client'

import { useCallback, useMemo, useState } from 'react'

import { CourseTopbar } from '@/components/course/CourseTopbar'
import { LessonSidebar } from '@/components/course/LessonSidebar'
import { LessonViewer } from '@/components/course/LessonViewer'
import {
  getNextAccessibleLessonId,
  isLessonAccessible,
  progressPct,
} from '@/lib/course-progress'
import { Button } from '@/components/ui/Button'
import type { CourseSummary, LessonLite, ModuleWithLessons, ProgressMap } from '@/types/course'

interface CoursePlayerProps {
  course: CourseSummary
  modules: ModuleWithLessons[]
  initialProgress: ProgressMap
  hasEvaluation: boolean
}

function findLesson(modules: ModuleWithLessons[], lessonId: string | null): LessonLite | null {
  if (!lessonId) return null
  for (const mod of modules) {
    const lesson = mod.lessons.find((l) => l.id === lessonId)
    if (lesson) return lesson
  }
  return null
}

export function CoursePlayer({ course, modules, initialProgress, hasEvaluation }: CoursePlayerProps) {
  const [progress, setProgress] = useState<ProgressMap>(initialProgress)
  const firstLessonId = modules[0]?.lessons[0]?.id ?? null
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(firstLessonId)

  const pct = progressPct(modules, progress)
  const currentLesson = useMemo(
    () => findLesson(modules, currentLessonId),
    [modules, currentLessonId],
  )
  // SPEC-REPRODUCTOR-PROGRESO §1.4: CTA explícito para avanzar. Solo aparece
  // cuando el usuario completó la lección actual y hay una siguiente en el
  // orden natural, respetando el desbloqueo progresivo.
  const nextLessonId = useMemo(
    () =>
      currentLessonId ? getNextAccessibleLessonId(modules, currentLessonId, progress) : null,
    [modules, currentLessonId, progress],
  )

  const handleComplete = useCallback((lessonId: string, lastPosition?: number) => {
    setProgress((prev) => ({
      ...prev,
      [lessonId]: {
        completed: true,
        last_position: lastPosition ?? prev[lessonId]?.last_position ?? 0,
      },
    }))
  }, [])

  const handlePosition = useCallback((lessonId: string, position: number) => {
    setProgress((prev) => ({
      ...prev,
      [lessonId]: {
        completed: prev[lessonId]?.completed ?? false,
        last_position: position,
      },
    }))
  }, [])

  function selectLesson(lessonId: string) {
    if (isLessonAccessible(modules, lessonId, progress)) {
      setCurrentLessonId(lessonId)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-mist">
      <CourseTopbar
        title={course.title}
        slug={course.slug}
        pct={pct}
        hasEvaluation={hasEvaluation}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
        <div className="min-w-0 space-y-4 lg:flex-1">
          {currentLesson ? (
            <>
              <LessonViewer
                key={currentLesson.id}
                lesson={currentLesson}
                progressEntry={progress[currentLesson.id]}
                onComplete={handleComplete}
                onPosition={handlePosition}
              />
              {nextLessonId && (
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setCurrentLessonId(nextLessonId)}
                  >
                    Siguiente lección →
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="rounded-lg border border-border bg-white p-8 text-center text-ink-soft">
              Este curso todavía no tiene lecciones.
            </p>
          )}
        </div>

        <aside className="lg:w-80 lg:shrink-0">
          <LessonSidebar
            modules={modules}
            progress={progress}
            currentLessonId={currentLessonId}
            onSelect={selectLesson}
          />
        </aside>
      </div>
    </div>
  )
}
