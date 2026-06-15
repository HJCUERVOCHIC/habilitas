'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

/** Cierra la sesión (HABILITAS-ESPECIFICACION §5.7 RF-7.4). */
export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/ingresar')
    router.refresh()
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut}>
      Cerrar sesión
    </Button>
  )
}
