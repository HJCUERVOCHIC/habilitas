import type { createAdminClient } from '@/lib/supabase/admin'

import { computeAttemptWindow, isAttemptExpired } from '@/lib/evaluation'

/**
 * Utilidades de servidor que agrupan a las personas alrededor de un curso.
 * Se usan tanto por las vistas admin (lista de inscritos, ficha) como por
 * las guardas de edición del Bloque 5 (SPEC-INSCRIPCIONES-SEGUIMIENTO §1.3).
 *
 * Todas asumen `createAdminClient` (service role): la RLS de las tablas de
 * personas es del estudiante; el bypass de service role es el vector normal
 * para lectura administrativa.
 *
 * Los lookups usan selects de columnas directas encadenados, no embeds de
 * PostgREST: `courses → evaluations → attempts` se resuelve leyendo IDs y
 * después filtrando por `in`, para no depender de la forma que devuelve un
 * embed (que puede llegar como array u objeto según cardinalidad detectada).
 */

type SupabaseAdmin = ReturnType<typeof createAdminClient>

/**
 * Inscritos **activos**: inscripciones al curso que aún no tienen constancia
 * emitida (revocada o no). La definición operativa está en la spec §1.3:
 * quien terminó queda protegido por el snapshot; quien está en curso, por
 * las guardas. Los dos no se solapan.
 *
 * Implementación: `enrollments − certificates` filtrados por `course_id`.
 * Se hace en dos queries porque los outer joins con `not exists` en
 * PostgREST vía el cliente JS son incómodos y menos legibles que este
 * conteo cliente-side (los volúmenes son pequeños en el MVP).
 */
export async function countActiveEnrollments(
  admin: SupabaseAdmin,
  courseId: string,
): Promise<number> {
  const { data: enrolls } = await admin
    .from('enrollments')
    .select('user_id')
    .eq('course_id', courseId)
  const enrolledIds = new Set((enrolls ?? []).map((r) => r.user_id))
  if (enrolledIds.size === 0) return 0
  const { data: certs } = await admin
    .from('certificates')
    .select('user_id')
    .eq('course_id', courseId)
  for (const c of certs ?? []) enrolledIds.delete(c.user_id)
  return enrolledIds.size
}

/**
 * Intentos **en curso**: filas de `eval_attempts` con `submitted_at IS NULL`
 * que aún no han expirado (dentro del timer + gracia). Se usa para la
 * advertencia de comparabilidad al editar el banco de preguntas o la nota
 * mínima (spec §1.3, caso especial).
 *
 * Devuelve 0 si el curso no tiene evaluación creada aún.
 */
export async function countInProgressAttempts(
  admin: SupabaseAdmin,
  courseId: string,
): Promise<number> {
  const { data: evaluation } = await admin
    .from('evaluations')
    .select('id')
    .eq('course_id', courseId)
    .maybeSingle<{ id: string }>()
  if (!evaluation) return 0
  const { data: openRows } = await admin
    .from('eval_attempts')
    .select('started_at')
    .eq('evaluation_id', evaluation.id)
    .is('submitted_at', null)
  let count = 0
  for (const r of openRows ?? []) {
    if (!isAttemptExpired(r.started_at)) count++
  }
  return count
}

/**
 * Lookups auxiliares: `courseId` a partir de `moduleId` o `lessonId`. Se
 * usan para que las guardas puedan consultar activeCount cuando el action
 * recibe un id intermedio.
 */
export async function courseIdForModule(
  admin: SupabaseAdmin,
  moduleId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('modules')
    .select('course_id')
    .eq('id', moduleId)
    .maybeSingle<{ course_id: string }>()
  return data?.course_id ?? null
}

export async function courseIdForLesson(
  admin: SupabaseAdmin,
  lessonId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('lessons')
    .select('module_id')
    .eq('id', lessonId)
    .maybeSingle<{ module_id: string }>()
  if (!data?.module_id) return null
  return courseIdForModule(admin, data.module_id)
}

export async function courseIdForEvaluation(
  admin: SupabaseAdmin,
  evaluationId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('evaluations')
    .select('course_id')
    .eq('id', evaluationId)
    .maybeSingle<{ course_id: string }>()
  return data?.course_id ?? null
}

export async function courseIdForQuestion(
  admin: SupabaseAdmin,
  questionId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('questions')
    .select('evaluation_id')
    .eq('id', questionId)
    .maybeSingle<{ evaluation_id: string }>()
  if (!data?.evaluation_id) return null
  return courseIdForEvaluation(admin, data.evaluation_id)
}

/**
 * Estado agregado por inscrito para la vista `/admin/cursos/[slug]/inscritos`
 * y para la ficha `/admin/estudiantes/[userId]`. Se computa en el servidor
 * con **un número fijo de queries** por curso: no depende del número de
 * inscritos (spec §2 CA-5, "sin N+1 por estudiante").
 */
export type EvalStatus =
  | 'none'
  | 'in-progress'
  | 'passed'
  | 'failed'
  | 'blocked'

export interface EnrollmentRow {
  userId: string
  fullName: string
  email: string | null
  enrolledAt: string
  lastActivityAt: string | null
  lessonsCompleted: number
  lessonsTotal: number
  progressPct: number
  evalStatus: EvalStatus
  cert: {
    certId: string
    verificationId: string | null
    status: string
    issuedAt: string
  } | null
}

/**
 * Aplasta las lecciones vivas del curso para calcular el `lessonsTotal` y el
 * filtro que se aplica a `lesson_progress`. Reutiliza una sola query de
 * módulos y otra de lecciones para toda la lista.
 */
async function loadCourseLessonIds(
  admin: SupabaseAdmin,
  courseId: string,
): Promise<string[]> {
  const { data: modules } = await admin
    .from('modules')
    .select('id')
    .eq('course_id', courseId)
  const moduleIds = (modules ?? []).map((m) => m.id)
  if (moduleIds.length === 0) return []
  const { data: lessons } = await admin
    .from('lessons')
    .select('id')
    .in('module_id', moduleIds)
  return (lessons ?? []).map((l) => l.id)
}

async function loadEmailsForUsers(
  admin: SupabaseAdmin,
  userIds: readonly string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (userIds.length === 0) return map
  // `listUsers` es 1 llamada por página; para el MVP (<= cientos) alcanza
  // con la primera página amplia. Si a futuro los cursos crecen a miles de
  // inscritos, paginar aquí — no en el caller.
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const wanted = new Set(userIds)
  for (const u of data?.users ?? []) {
    if (wanted.has(u.id) && u.email) map.set(u.id, u.email)
  }
  return map
}

export async function getCourseEnrollments(
  admin: SupabaseAdmin,
  courseId: string,
): Promise<EnrollmentRow[]> {
  // 1) Inscritos.
  const { data: enrolls } = await admin
    .from('enrollments')
    .select('user_id, enrolled_at')
    .eq('course_id', courseId)
    .order('enrolled_at', { ascending: false })
  const enrollList = enrolls ?? []
  if (enrollList.length === 0) return []
  const userIds = enrollList.map((e) => e.user_id)

  // 2) Perfil (nombre) y correo (auth).
  const { data: profiles } = await admin
    .from('users')
    .select('id, full_name')
    .in('id', userIds)
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))
  const emailById = await loadEmailsForUsers(admin, userIds)

  // 3) Progreso: total de lecciones y filas completadas por usuario.
  const lessonIds = await loadCourseLessonIds(admin, courseId)
  const totalLessons = lessonIds.length
  const completedByUser = new Map<string, number>()
  const lastActivityByUser = new Map<string, string>()
  if (lessonIds.length > 0) {
    const { data: progress } = await admin
      .from('lesson_progress')
      .select('user_id, completed, updated_at')
      .in('user_id', userIds)
      .in('lesson_id', lessonIds)
    for (const p of progress ?? []) {
      if (p.completed) {
        completedByUser.set(p.user_id, (completedByUser.get(p.user_id) ?? 0) + 1)
      }
      const prev = lastActivityByUser.get(p.user_id)
      if (!prev || p.updated_at > prev) lastActivityByUser.set(p.user_id, p.updated_at)
    }
  }

  // 4) Evaluación: intentos + unlocks. Estado por usuario.
  const { data: evaluation } = await admin
    .from('evaluations')
    .select('id')
    .eq('course_id', courseId)
    .maybeSingle<{ id: string }>()
  const attemptsByUser = new Map<
    string,
    { open: boolean; passed: boolean; closed: { submitted_at: string; passed: boolean }[]; lastAttemptAt: string | null }
  >()
  const unlocksByUser = new Map<string, { granted_at: string }[]>()
  if (evaluation) {
    const { data: attempts } = await admin
      .from('eval_attempts')
      .select('user_id, submitted_at, passed, started_at')
      .eq('evaluation_id', evaluation.id)
      .in('user_id', userIds)
    for (const a of attempts ?? []) {
      const state = attemptsByUser.get(a.user_id) ?? {
        open: false,
        passed: false,
        closed: [],
        lastAttemptAt: null as string | null,
      }
      if (a.submitted_at === null) {
        if (!isAttemptExpired(a.started_at)) state.open = true
      } else {
        state.closed.push({ submitted_at: a.submitted_at, passed: a.passed ?? false })
        if (a.passed) state.passed = true
      }
      const ts = a.submitted_at ?? a.started_at
      if (!state.lastAttemptAt || ts > state.lastAttemptAt) state.lastAttemptAt = ts
      attemptsByUser.set(a.user_id, state)
    }

    const { data: unlocks } = await admin
      .from('attempt_unlocks')
      .select('user_id, granted_at')
      .eq('evaluation_id', evaluation.id)
      .in('user_id', userIds)
    for (const u of unlocks ?? []) {
      const arr = unlocksByUser.get(u.user_id) ?? []
      arr.push({ granted_at: u.granted_at })
      unlocksByUser.set(u.user_id, arr)
    }
  }

  // 5) Constancias.
  const { data: certRows } = await admin
    .from('certificates')
    .select('user_id, cert_id, verification_id, status, issued_at')
    .eq('course_id', courseId)
    .in('user_id', userIds)
    .order('issued_at', { ascending: false })
  const certByUser = new Map<string, NonNullable<EnrollmentRow['cert']>>()
  for (const c of certRows ?? []) {
    if (certByUser.has(c.user_id)) continue // conservamos la más reciente
    certByUser.set(c.user_id, {
      certId: c.cert_id,
      verificationId: c.verification_id ?? null,
      status: c.status,
      issuedAt: c.issued_at,
    })
  }

  // 6) `max_attempts` del curso (para el estado bloqueado).
  const { data: course } = await admin
    .from('courses')
    .select('max_attempts')
    .eq('id', courseId)
    .maybeSingle<{ max_attempts: number }>()
  const maxAttempts = course?.max_attempts ?? 3

  // Ensamble final.
  return enrollList.map((e): EnrollmentRow => {
    const attempts = attemptsByUser.get(e.user_id)
    const unlocks = unlocksByUser.get(e.user_id) ?? []
    let evalStatus: EvalStatus = 'none'
    if (attempts) {
      if (attempts.passed) evalStatus = 'passed'
      else if (attempts.open) evalStatus = 'in-progress'
      else if (attempts.closed.length > 0) {
        const w = computeAttemptWindow(attempts.closed, maxAttempts, unlocks)
        evalStatus = w.blocked ? 'blocked' : 'failed'
      }
    }

    const completed = completedByUser.get(e.user_id) ?? 0
    const pct = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0

    // Última actividad = max(progreso, intentos).
    const progressActivity = lastActivityByUser.get(e.user_id) ?? null
    const attemptActivity = attempts?.lastAttemptAt ?? null
    const lastActivityAt =
      progressActivity && attemptActivity
        ? progressActivity > attemptActivity
          ? progressActivity
          : attemptActivity
        : progressActivity ?? attemptActivity

    return {
      userId: e.user_id,
      fullName: nameById.get(e.user_id) ?? '—',
      email: emailById.get(e.user_id) ?? null,
      enrolledAt: e.enrolled_at,
      lastActivityAt,
      lessonsCompleted: completed,
      lessonsTotal: totalLessons,
      progressPct: pct,
      evalStatus,
      cert: certByUser.get(e.user_id) ?? null,
    }
  })
}

/**
 * Datos para la ficha individual `/admin/estudiantes/[userId]`. Reúne los
 * cursos en los que el usuario está inscrito con su estado y las
 * constancias emitidas. Los intentos y unlocks se cargan solo cuando hace
 * falta pintar el bloqueo, por eso la ficha los pide aparte.
 */
export interface StudentSummaryCourse {
  courseId: string
  slug: string
  title: string
  enrolledAt: string
  progressPct: number
  evalStatus: EvalStatus
  evaluationId: string | null
  cert: EnrollmentRow['cert']
}

export interface StudentSummary {
  userId: string
  fullName: string
  email: string | null
  profession: string | null
  courses: StudentSummaryCourse[]
}

export async function getStudentSummary(
  admin: SupabaseAdmin,
  userId: string,
): Promise<StudentSummary | null> {
  const { data: profile } = await admin
    .from('users')
    .select('id, full_name, profession')
    .eq('id', userId)
    .maybeSingle<{ id: string; full_name: string; profession: string | null }>()
  if (!profile) return null

  const emails = await loadEmailsForUsers(admin, [userId])

  const { data: enrolls } = await admin
    .from('enrollments')
    .select('course_id, enrolled_at')
    .eq('user_id', userId)
    .order('enrolled_at', { ascending: false })
  const enrollList = enrolls ?? []
  if (enrollList.length === 0) {
    return {
      userId: profile.id,
      fullName: profile.full_name,
      email: emails.get(userId) ?? null,
      profession: profile.profession,
      courses: [],
    }
  }

  const courseIds = enrollList.map((e) => e.course_id)
  const { data: coursesData } = await admin
    .from('courses')
    .select('id, slug, title, max_attempts')
    .in('id', courseIds)
  const courseById = new Map((coursesData ?? []).map((c) => [c.id, c]))

  const summaries: StudentSummaryCourse[] = []
  for (const e of enrollList) {
    const course = courseById.get(e.course_id)
    if (!course) continue
    const lessonIds = await loadCourseLessonIds(admin, course.id)
    const total = lessonIds.length
    let completed = 0
    if (total > 0) {
      const { count } = await admin
        .from('lesson_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('lesson_id', lessonIds)
        .eq('completed', true)
      completed = count ?? 0
    }
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0

    const { data: evaluation } = await admin
      .from('evaluations')
      .select('id')
      .eq('course_id', course.id)
      .maybeSingle<{ id: string }>()

    let evalStatus: EvalStatus = 'none'
    if (evaluation) {
      const { data: attempts } = await admin
        .from('eval_attempts')
        .select('submitted_at, passed, started_at')
        .eq('evaluation_id', evaluation.id)
        .eq('user_id', userId)
      const open = (attempts ?? []).some(
        (a) => a.submitted_at === null && !isAttemptExpired(a.started_at),
      )
      const closed = (attempts ?? [])
        .filter((a) => a.submitted_at !== null)
        .map((a) => ({ submitted_at: a.submitted_at as string, passed: a.passed ?? false }))
      const passed = closed.some((a) => a.passed)
      if (passed) evalStatus = 'passed'
      else if (open) evalStatus = 'in-progress'
      else if (closed.length > 0) {
        const { data: unlocks } = await admin
          .from('attempt_unlocks')
          .select('granted_at')
          .eq('evaluation_id', evaluation.id)
          .eq('user_id', userId)
        const w = computeAttemptWindow(closed, course.max_attempts, unlocks ?? [])
        evalStatus = w.blocked ? 'blocked' : 'failed'
      }
    }

    const { data: cert } = await admin
      .from('certificates')
      .select('cert_id, verification_id, status, issued_at')
      .eq('user_id', userId)
      .eq('course_id', course.id)
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    summaries.push({
      courseId: course.id,
      slug: course.slug,
      title: course.title,
      enrolledAt: e.enrolled_at,
      progressPct: pct,
      evalStatus,
      evaluationId: evaluation?.id ?? null,
      cert: cert
        ? {
            certId: cert.cert_id,
            verificationId: cert.verification_id ?? null,
            status: cert.status,
            issuedAt: cert.issued_at,
          }
        : null,
    })
  }

  return {
    userId: profile.id,
    fullName: profile.full_name,
    email: emails.get(userId) ?? null,
    profession: profile.profession,
    courses: summaries,
  }
}

/**
 * Lista de intentos del estudiante en un curso concreto, para el detalle
 * dentro de la ficha. No agrega — enseña la cronología en crudo.
 */
export interface AttemptRow {
  id: string
  submittedAt: string | null
  startedAt: string
  score: number | null
  passed: boolean | null
  attemptNumber: number
}

export async function getUserAttempts(
  admin: SupabaseAdmin,
  userId: string,
  evaluationId: string,
): Promise<AttemptRow[]> {
  const { data } = await admin
    .from('eval_attempts')
    .select('id, submitted_at, started_at, score, passed, attempt_number')
    .eq('user_id', userId)
    .eq('evaluation_id', evaluationId)
    .order('started_at', { ascending: false })
  return (data ?? []).map((r) => ({
    id: r.id,
    submittedAt: r.submitted_at,
    startedAt: r.started_at,
    score: r.score,
    passed: r.passed,
    attemptNumber: r.attempt_number,
  }))
}

/**
 * Estado del bloqueo (ventana + unlocks) del estudiante para una
 * evaluación. Se usa en la ficha para pintar el botón "Conceder intento".
 */
export async function getUserAttemptWindow(
  admin: SupabaseAdmin,
  userId: string,
  evaluationId: string,
  maxAttempts: number,
): Promise<ReturnType<typeof computeAttemptWindow>> {
  const { data: attempts } = await admin
    .from('eval_attempts')
    .select('submitted_at, passed')
    .eq('user_id', userId)
    .eq('evaluation_id', evaluationId)
    .not('submitted_at', 'is', null)
  const closed = (attempts ?? []).map((a) => ({
    submitted_at: a.submitted_at as string,
    passed: a.passed ?? false,
  }))
  const { data: unlocks } = await admin
    .from('attempt_unlocks')
    .select('granted_at')
    .eq('user_id', userId)
    .eq('evaluation_id', evaluationId)
  return computeAttemptWindow(closed, maxAttempts, unlocks ?? [])
}
