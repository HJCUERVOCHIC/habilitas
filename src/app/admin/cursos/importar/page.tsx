import Link from 'next/link'

import { YamlImporter } from '@/components/admin/YamlImporter'
import { ComplianceNotice } from '@/components/compliance/ComplianceNotice'

export const dynamic = 'force-dynamic'

export default function ImportarPage() {
  return (
    <div>
      <Link href="/admin/cursos" className="text-sm text-teal hover:text-teal-light">
        ← Cursos
      </Link>
      <h1 className="mb-2 mt-2 font-display text-display-md text-charcoal">
        Importar curso desde YAML
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Sube un archivo .yaml o pega el contenido. La validación no escribe en la base; al
        confirmar, el curso se crea en borrador con sus módulos, lecciones y banco de
        preguntas.
      </p>

      <ComplianceNotice className="mb-6" />

      <YamlImporter />
    </div>
  )
}
