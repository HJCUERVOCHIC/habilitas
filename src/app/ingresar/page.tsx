import { Suspense } from 'react'

import { LoginForm } from './LoginForm'

export const metadata = {
  title: 'Ingresar — Habilitas',
}

export default function IngresarPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-mist px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-teal">Habilitas</p>
          <h1 className="mt-1 font-display text-display-sm text-charcoal">Inicia sesión</h1>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}
