import { redirect } from 'next/navigation'

import { EvaluationClient } from '@/components/course/EvaluationClient'
import { getEvaluationPageState } from '@/app/curso/[slug]/eval-actions'

/**
 * Entrada a la evaluación del curso (SPEC-EVALUACION §1.1). Acceso directo
 * para estudiantes inscritos (no gated por progreso de lecciones).
 * SSR + force-dynamic: el estado depende del usuario y del reloj (temporizador
 * y bloqueo de 24 h), no cachea.
 */
export const dynamic = 'force-dynamic'

export default async function EvaluacionPage({ params }: { params: { slug: string } }) {
  const state = await getEvaluationPageState(params.slug)

  if (state.status === 'auth') {
    redirect(`/ingresar?redirect=/curso/${params.slug}/evaluacion`)
  }
  if (state.status === 'enrollment') {
    // No inscrito → detalle público del curso (spec §1.1).
    redirect(`/certificaciones/${params.slug}`)
  }

  return <EvaluationClient state={state} />
}
