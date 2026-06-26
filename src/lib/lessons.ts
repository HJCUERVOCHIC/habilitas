/**
 * Tipos de lección y sus etiquetas para UI (SPEC-CURSOS-ESTRUCTURA §1).
 * El enum en DB (lessons.content_type) está en inglés
 * (`video | pdf | slides | image | text`). La UI muestra etiquetas en español.
 */
export const LESSON_TYPES = ['video', 'pdf', 'slides', 'image', 'text'] as const

export type LessonType = (typeof LESSON_TYPES)[number]

export const LESSON_TYPE_LABEL: Record<LessonType, string> = {
  text: 'Texto',
  video: 'Video',
  pdf: 'PDF',
  slides: 'Diapositivas',
  image: 'Imagen',
}

export function isLessonType(value: string): value is LessonType {
  return (LESSON_TYPES as readonly string[]).includes(value)
}

export function lessonTypeLabel(value: string): string {
  return isLessonType(value) ? LESSON_TYPE_LABEL[value] : value
}
