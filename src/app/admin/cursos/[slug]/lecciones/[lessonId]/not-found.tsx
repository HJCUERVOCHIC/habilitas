import Link from 'next/link'

/**
 * not-found.tsx específico de la ruta de detalle de lección. Hace explícito
 * por qué se llegó al 404 (el caso típico es una URL stale con UUID que ya
 * no existe en la base) y ofrece volver al listado de módulos.
 */
export default function LessonNotFound() {
  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <h1 className="font-display text-display-sm text-charcoal">Lección no encontrada</h1>
      <p className="mt-2 text-sm text-ink-soft">
        La lección a la que apunta esta URL no existe en la base. Esto suele pasar cuando se
        usa un enlace viejo después de re-importar o purgar el curso (los UUID cambian en
        cada import). Vuelve al listado y abre el enlace &ldquo;Contenido&rdquo; desde ahí.
      </p>
      <div className="mt-4">
        <Link href="/admin/cursos" className="text-sm font-medium text-teal hover:text-teal-light">
          ← Volver al listado de cursos
        </Link>
      </div>
    </div>
  )
}
