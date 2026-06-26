import { createAdminClient } from '@/lib/supabase/admin'

// Mínimo recomendado del banco (CLAUDE.md D4 + SPEC-EVALUACION-BANCO §1).
const RECOMMENDED_MIN_BANK = 15

export interface ChecklistItem {
  id: 'metadata' | 'structure' | 'content' | 'evaluation'
  label: string
  passed: boolean
  /** Texto que explica qué falta cuando passed=false. */
  detail?: string
}

export interface PublishChecklist {
  items: ChecklistItem[]
  canPublish: boolean
}

/**
 * Computa el checklist "listo para publicar" de un curso (SPEC-PUBLICACION-
 * CONSTANCIAS §1). Lo consumen `setPublished` (para validar la acción) y
 * `<PublishPanel>` (para renderizar el estado). Usa service role porque vive
 * en contextos admin.
 */
export async function getPublishChecklist(courseId: string): Promise<PublishChecklist> {
  const admin = createAdminClient()

  const { data: course } = await admin
    .from('courses')
    .select('id, title, description, pass_score')
    .eq('id', courseId)
    .maybeSingle()
  if (!course) {
    return {
      canPublish: false,
      items: [
        { id: 'metadata', label: 'Metadatos', passed: false, detail: 'Curso no encontrado.' },
        { id: 'structure', label: 'Estructura', passed: false },
        { id: 'content', label: 'Contenido por lección', passed: false },
        { id: 'evaluation', label: 'Evaluación', passed: false },
      ],
    }
  }

  const items: ChecklistItem[] = []

  // 1) Metadatos: título y descripción.
  const titleOk = !!course.title?.trim()
  const descriptionOk = !!course.description?.trim()
  const metaMissing: string[] = []
  if (!titleOk) metaMissing.push('título')
  if (!descriptionOk) metaMissing.push('descripción')
  items.push({
    id: 'metadata',
    label: 'Metadatos del curso',
    passed: titleOk && descriptionOk,
    detail: metaMissing.length > 0 ? `Falta: ${metaMissing.join(', ')}.` : undefined,
  })

  // 2) Estructura: ≥1 módulo y ≥1 lección.
  const { data: modules } = await admin
    .from('modules')
    .select('id, title, order_index')
    .eq('course_id', courseId)
    .order('order_index')
  const moduleList = modules ?? []
  const moduleIds = moduleList.map((m) => m.id)
  const { data: lessons } = moduleIds.length
    ? await admin
        .from('lessons')
        .select('id, module_id, title, content_type, body_md, content_r2_key')
        .in('module_id', moduleIds)
        .order('order_index')
    : { data: [] }
  const lessonList = lessons ?? []
  const structureOk = moduleList.length > 0 && lessonList.length > 0
  items.push({
    id: 'structure',
    label: 'Estructura',
    passed: structureOk,
    detail: !structureOk
      ? moduleList.length === 0
        ? 'Necesitas al menos 1 módulo.'
        : 'Cada módulo debe tener al menos 1 lección (en total, ≥1 lección en el curso).'
      : undefined,
  })

  // 3) Contenido por lección: texto con body_md; medios con content_r2_key.
  const missingContent = lessonList.filter((l) => {
    if (l.content_type === 'text') return !l.body_md || !l.body_md.trim()
    return !l.content_r2_key
  })
  const contentOk = lessonList.length > 0 && missingContent.length === 0
  items.push({
    id: 'content',
    label: 'Contenido por lección',
    passed: contentOk,
    detail:
      lessonList.length === 0
        ? 'Aún no hay lecciones.'
        : missingContent.length > 0
          ? `Faltan ${missingContent.length} lección(es) con contenido: ${missingContent
              .slice(0, 3)
              .map((l) => `"${l.title}"`)
              .join(', ')}${missingContent.length > 3 ? '…' : ''}.`
          : undefined,
  })

  // 4) Evaluación: existe, banco suficiente, configuración válida.
  const { data: evaluation } = await admin
    .from('evaluations')
    .select('id, questions_per_attempt')
    .eq('course_id', courseId)
    .maybeSingle()
  let evaluationOk = false
  let evaluationDetail: string | undefined
  if (!evaluation) {
    evaluationDetail = 'Crea la evaluación del curso.'
  } else if (!evaluation.questions_per_attempt || evaluation.questions_per_attempt < 1) {
    evaluationDetail = 'Configura cuántas preguntas se sortean por intento.'
  } else if (!course.pass_score || course.pass_score < 1 || course.pass_score > 100) {
    evaluationDetail = 'Configura la nota mínima de aprobación (1–100).'
  } else {
    const { count } = await admin
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('evaluation_id', evaluation.id)
    const total = count ?? 0
    const required = Math.max(RECOMMENDED_MIN_BANK, evaluation.questions_per_attempt)
    if (total < required) {
      evaluationDetail = `El banco tiene ${total} preguntas; necesitas al menos ${required}.`
    } else {
      evaluationOk = true
    }
  }
  items.push({
    id: 'evaluation',
    label: 'Evaluación',
    passed: evaluationOk,
    detail: evaluationDetail,
  })

  return {
    items,
    canPublish: items.every((i) => i.passed),
  }
}
