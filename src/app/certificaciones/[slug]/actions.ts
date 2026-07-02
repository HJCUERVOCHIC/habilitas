'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

/**
 * Inscribe al usuario en el curso (SPEC-CATALOGO-INSCRIPCION §1.3).
 * - Sin sesión → Magic Link, volviendo al detalle.
 * - Con sesión de admin → roles excluyentes (Bloque 0): redirige a /admin.
 * - Con sesión de estudiante → upsert idempotente por unique(user_id, course_id)
 *   y redirige al reproductor.
 * - Solo cursos publicados; RLS `enrollments_own` garantiza que la fila
 *   pertenezca al usuario.
 */
export async function enrollCourse(formData: FormData) {
  const slug = String(formData.get('slug') ?? '')
  if (!slug) redirect('/certificaciones')

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/ingresar?redirect=${encodeURIComponent(`/certificaciones/${slug}`)}`)
  }

  // Rol excluyente: admin no se inscribe (Bloque 0, SPEC-ROLES-ACCESO).
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role === 'admin') {
    redirect('/admin')
  }

  const { data: course } = await supabase
    .from('courses')
    .select('id')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()

  if (!course) redirect('/certificaciones')

  // Idempotente: si ya está inscrito, no duplica (DO NOTHING sobre el UNIQUE).
  await supabase
    .from('enrollments')
    .upsert(
      { user_id: user.id, course_id: course.id },
      { onConflict: 'user_id,course_id', ignoreDuplicates: true },
    )

  redirect(`/curso/${slug}`)
}
