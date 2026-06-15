import Link from 'next/link'

/** Topbar compartido (catálogo, detalle). Color sólido, nunca gradiente. */
export function Topbar() {
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-xl text-charcoal">
          Habilitas
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/certificaciones" className="font-medium text-ink-main hover:text-teal">
            Certificaciones
          </Link>
          <Link href="/ingresar" className="font-medium text-teal hover:text-teal-light">
            Ingresar
          </Link>
        </nav>
      </div>
    </header>
  )
}
