import type { Tables } from '@/types/database'

export type LessonLite = Pick<
  Tables<'lessons'>,
  'id' | 'title' | 'order_index' | 'content_type' | 'duration_min'
>

export type ModuleWithLessons = Pick<Tables<'modules'>, 'id' | 'title' | 'order_index'> & {
  lessons: LessonLite[]
}

export type ProgressEntry = { completed: boolean; last_position: number }
export type ProgressMap = Record<string, ProgressEntry>

/** Estado de un módulo en el temario (HABILITAS-ESPECIFICACION §5.4 RF-4.3). */
export type ModuleStatus = 'completed' | 'in-progress' | 'locked'

export type CourseSummary = { id: string; slug: string; title: string }
