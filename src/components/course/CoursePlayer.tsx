'use client'

import { useCallback, useMemo, useState } from 'react'

import { CourseTopbar } from '@/components/course/CourseTopbar'
import { EvalModal } from '@/components/course/EvalModal'
import { LessonSidebar } from '@/components/course/LessonSidebar'
import { LessonViewer } from '@/components/course/LessonViewer'
import { allModulesCompleted, isLessonAccessible, progressPct } from '@/lib/course-progress'
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
  const [showEval, setShowEval] = useState(false)

  const pct = progressPct(modules, progress)
  const completedAll = allModulesCompleted(modules, progress)
  const currentLesson = useMemo(
    () => findLesson(modules, currentLessonId),
    [modules, currentLessonId],
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
        pct={pct}
        completedAll={completedAll}
        hasEvaluation={hasEvaluation}
        onStartEvaluation={() => setShowEval(true)}
      />

      {showEval && <EvalModal slug={course.slug} onClose={() => setShowEval(false)} />}

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
        <div className="min-w-0 lg:flex-1">
          {currentLesson ? (
            <LessonViewer
              key={currentLesson.id}
              lesson={currentLesson}
              progressEntry={progress[currentLesson.id]}
              onComplete={handleComplete}
              onPosition={handlePosition}
            />
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
