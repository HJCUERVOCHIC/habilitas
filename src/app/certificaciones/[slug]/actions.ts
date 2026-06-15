'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

/**
 * Inscribe al usuario en el curso (HABILITAS-ESPECIFICACION §5.3 RF-3.7).
 * - Sin sesión → flujo Magic Link, volviendo al detalle (RF-9.3 / §5.9 CA).
 * - Con sesión → crea la inscripción (idempotente por unique(user_id, course_id))
 *   y redirige al reproductor del curso.
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

  const { data: course } = await supabase
    .from('courses')
    .select('id')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()

  if (!course) redirect('/certificaciones')

  // Idempotente: si ya está inscrito, no duplica (DO NOTHING).
  await supabase
    .from('enrollments')
    .upsert(
      { user_id: user.id, course_id: course.id },
      { onConflict: 'user_id,course_id', ignoreDuplicates: true },
    )

  redirect(`/curso/${slug}`)
}
