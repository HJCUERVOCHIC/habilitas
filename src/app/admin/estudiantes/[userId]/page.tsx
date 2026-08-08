import Link from 'next/link'
import { notFound } from 'next/navigation'

import { StudentDetail } from '@/components/admin/StudentDetail'
import {
  getStudentSummary,
  getUserAttemptWindow,
  getUserAttempts,
  type AttemptRow,
} from '@/lib/enrollments-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function EstudianteFichaPage({
  params,
}: {
  params: { userId: string }
}) {
  const admin = createAdminClient()
  const summary = await getStudentSummary(admin, params.userId)
  if (!summary) notFound()

  // Intentos y bloqueo por curso: se cargan aquí para que la ficha muestre
  // el historial completo sin volver a llamar acciones del cliente. Cada
  // curso es independiente; el volumen esperado por estudiante es bajo
  // (2–5 cursos), por eso el bucle no requiere agregación previa.
  const attemptsByCourse: Record<string, AttemptRow[]> = {}
  const blockedByCourse: Record<string, { blocked: boolean; unlockAt?: string }> = {}
  for (const course of summary.courses) {
    if (!course.evaluationId) continue
    attemptsByCourse[course.courseId] = await getUserAttempts(
      admin,
      params.userId,
      course.evaluationId,
    )
    const { data: courseRow } = await admin
      .from('courses')
      .select('max_attempts')
      .eq('id', course.courseId)
      .maybeSingle<{ max_attempts: number }>()
    const window = await getUserAttemptWindow(
      admin,
      params.userId,
      course.evaluationId,
      courseRow?.max_attempts ?? 3,
    )
    blockedByCourse[course.courseId] = window.blocked
      ? { blocked: true, unlockAt: window.unlockAt }
      : { blocked: false }
  }

  return (
    <div>
      <Link href="/admin/cursos" className="text-sm text-teal hover:text-teal-light">
        ← Cursos
      </Link>
      <h1 className="mb-1 mt-2 font-display text-display-md text-charcoal">
        {summary.fullName}
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        {summary.email ?? 'Sin correo registrado'}
        {summary.profession ? ` · ${summary.profession}` : ''}
      </p>
      <StudentDetail
        summary={summary}
        attemptsByCourse={attemptsByCourse}
        blockedByCourse={blockedByCourse}
      />
    </div>
  )
}
