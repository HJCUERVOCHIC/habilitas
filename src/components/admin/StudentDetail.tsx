'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { grantAttemptUnlock } from '@/app/admin/actions'
import { Button } from '@/components/ui/Button'
import type {
  AttemptRow,
  EvalStatus,
  StudentSummary,
} from '@/lib/enrollments-admin'

const EVAL_LABEL: Record<EvalStatus, string> = {
  none: 'Sin intentos',
  'in-progress': 'En curso',
  passed: 'Aprobado',
  failed: 'Reprobado',
  blocked: 'Bloqueado',
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso))
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

interface StudentDetailProps {
  summary: StudentSummary
  attemptsByCourse: Record<string, AttemptRow[]>
  blockedByCourse: Record<string, { blocked: boolean; unlockAt?: string }>
}

export function StudentDetail({
  summary,
  attemptsByCourse,
  blockedByCourse,
}: StudentDetailProps) {
  if (summary.courses.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-white p-6 text-center text-ink-soft">
        Este estudiante aún no está inscrito en ningún curso.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {summary.courses.map((course) => (
        <CourseCard
          key={course.courseId}
          course={course}
          attempts={attemptsByCourse[course.courseId] ?? []}
          block={blockedByCourse[course.courseId]}
          userId={summary.userId}
          userName={summary.fullName}
        />
      ))}
    </div>
  )
}

function CourseCard({
  course,
  attempts,
  block,
  userId,
  userName,
}: {
  course: StudentSummary['courses'][number]
  attempts: AttemptRow[]
  block: { blocked: boolean; unlockAt?: string } | undefined
  userId: string
  userName: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  async function unlock() {
    if (!course.evaluationId) return
    if (
      !window.confirm(
        `¿Conceder un intento adicional a "${userName}" en "${course.title}"? El desbloqueo queda registrado con tu autoría.`,
      )
    ) {
      return
    }
    setBusy(true)
    const res = await grantAttemptUnlock({
      userId,
      evaluationId: course.evaluationId,
      note: note.trim() || undefined,
    })
    setBusy(false)
    if (res.ok) {
      setNote('')
      router.refresh()
    } else {
      window.alert(res.error ?? 'No se pudo desbloquear.')
    }
  }

  const canUnlock = Boolean(course.evaluationId) && (block?.blocked || course.evalStatus === 'blocked')

  return (
    <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-display-sm text-charcoal">
            <Link href={`/admin/cursos/${course.slug}`} className="hover:text-teal">
              {course.title}
            </Link>
          </h2>
          <p className="text-xs text-ink-soft">
            Inscrito el {formatDate(course.enrolledAt)} · Progreso {course.progressPct}%
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right text-sm">
          <span className="rounded-md bg-mist px-2 py-0.5 text-xs font-semibold text-ink-soft">
            {EVAL_LABEL[course.evalStatus]}
          </span>
          {course.cert ? (
            course.cert.status === 'revoked' ? (
              <span className="text-xs text-red-err">Constancia revocada · {course.cert.certId}</span>
            ) : (
              <Link
                href={`/verificar/${course.cert.verificationId ?? course.cert.certId}`}
                target="_blank"
                className="text-xs text-teal hover:underline"
              >
                Constancia · {course.cert.certId}
              </Link>
            )
          ) : (
            <span className="text-xs text-ink-muted">Sin constancia</span>
          )}
        </div>
      </header>

      {attempts.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-md border border-border">
          <table className="min-w-full text-xs">
            <thead className="bg-mist text-left uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Inicio</th>
                <th className="px-3 py-2">Envío</th>
                <th className="px-3 py-2">Puntaje</th>
                <th className="px-3 py-2">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2">{a.attemptNumber}</td>
                  <td className="px-3 py-2 text-ink-soft">{formatDateTime(a.startedAt)}</td>
                  <td className="px-3 py-2 text-ink-soft">
                    {a.submittedAt ? formatDateTime(a.submittedAt) : '—'}
                  </td>
                  <td className="px-3 py-2">{a.score ?? '—'}</td>
                  <td className="px-3 py-2">
                    {a.passed === true
                      ? 'Aprobado'
                      : a.passed === false
                        ? 'Reprobado'
                        : a.submittedAt
                          ? '—'
                          : 'En curso'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canUnlock && (
        <div className="mt-4 rounded-md border border-amber/30 bg-amber-pale/40 p-4">
          <p className="text-sm text-ink-main">
            {block?.blocked && block.unlockAt
              ? `Bloqueado por 24 h — se libera automáticamente el ${formatDateTime(block.unlockAt)}.`
              : 'Bloqueado por intentos agotados.'}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Concede un intento adicional. La operación queda registrada con tu autoría; el
            historial previo no se altera.
          </p>
          <label className="mt-3 block text-xs">
            <span className="mb-1 block text-ink-soft">Nota (opcional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Motivo del desbloqueo"
              className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="mt-3">
            <Button variant="primary" size="sm" onClick={unlock} disabled={busy}>
              {busy ? '…' : 'Conceder intento adicional'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
