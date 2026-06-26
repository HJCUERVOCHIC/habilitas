'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

type Variant = 'ghost' | 'outline-white' | 'dark'

/**
 * Cierra la sesión (HABILITAS-ESPECIFICACION §5.7 RF-7.4).
 * `variant` permite adaptarlo al fondo del shell donde vive (claro = ghost,
 * oscuro = outline-white / dark). Default mantiene el comportamiento previo.
 */
export function SignOutButton({ variant = 'ghost' }: { variant?: Variant }) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/ingresar')
    router.refresh()
  }

  return (
    <Button variant={variant} size="sm" onClick={handleSignOut}>
      Cerrar sesión
    </Button>
  )
}
