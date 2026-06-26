import Link from 'next/link'
import { notFound } from 'next/navigation'

import { EvaluationManager, type AdminQuestion } from '@/components/admin/EvaluationManager'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function toOptions(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : []
}

export default async function EvaluacionPage({ params }: { params: { slug: string } }) {
  const admin = createAdminClient()
  const { data: course } = await admin
    .from('courses')
    .select('id, title, pass_score')
    .eq('slug', params.slug)
    .maybeSingle()
  if (!course) notFound()

  const { data: evaluation } = await admin
    .from('evaluations')
    .select('id, questions_per_attempt')
    .eq('course_id', course.id)
    .maybeSingle()

  const { data: questions } = evaluation
    ? await admin
        .from('questions')
        .select(
          'id, text, context, correct_option, options, order_index, feedback_correct, feedback_wrong',
        )
        .eq('evaluation_id', evaluation.id)
        .order('order_index')
    : { data: [] }

  const adminQuestions: AdminQuestion[] = (questions ?? []).map((q) => ({
    id: q.id,
    text: q.text,
    context: q.context,
    correct_option: q.correct_option,
    options: toOptions(q.options),
    feedback_correct: q.feedback_correct,
    feedback_wrong: q.feedback_wrong,
  }))

  return (
    <div>
      <Link
        href={`/admin/cursos/${params.slug}`}
        className="text-sm text-teal hover:text-teal-light"
      >
        ← {course.title}
      </Link>
      <h1 className="mb-6 mt-2 font-display text-display-md text-charcoal">
        Evaluación · banco de preguntas
      </h1>
      <EvaluationManager
        courseId={course.id}
        evaluationId={evaluation?.id ?? null}
        questionsPerAttempt={evaluation?.questions_per_attempt ?? 10}
        passScore={course.pass_score}
        questions={adminQuestions}
      />
    </div>
  )
}
