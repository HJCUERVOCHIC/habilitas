import Link from 'next/link'

/** Topbar de la página de verificación. Color sólido (nunca gradiente). */
export function VerifyTopbar() {
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-xl text-charcoal">
          Habilitas
        </Link>
        <Link href="/certificaciones" className="text-sm font-medium text-teal hover:text-teal-light">
          Ver certificaciones
        </Link>
      </div>
    </header>
  )
}
