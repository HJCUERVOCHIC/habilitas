'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

export interface ProfileInput {
  full_name: string
  profession: string
  city: string
  rethus_number: string
  avatar_url: string
}

/**
 * Actualiza el perfil del usuario (§5.7 RF-7.1). RLS users_own garantiza que
 * solo edita su propia fila. El RETHUS es autodeclarado (D6): no se valida ni
 * se afirma como verificado. Los cambios se reflejan en certificados futuros,
 * no en los ya emitidos (que son snapshot).
 */
export async function updateProfile(
  input: ProfileInput,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Tu sesión expiró.' }

  const fullName = input.full_name.trim()
  if (!fullName) return { ok: false, error: 'El nombre es obligatorio.' }

  const { error } = await supabase
    .from('users')
    .update({
      full_name: fullName,
      profession: input.profession.trim() || null,
      city: input.city.trim() || null,
      rethus_number: input.rethus_number.trim() || null,
      avatar_url: input.avatar_url.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/perfil')
  return { ok: true }
}
