import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { REVALIDATE_TARGETS, type RevalidateTarget } from './revalidate-admin'

/**
 * El helper enumera un puñado de targets (layout admin, catálogo,
 * reproductor, verificación, etc.). Este test valida que cada uno
 * corresponda a un archivo real bajo `src/app`. Si alguien renombra o
 * mueve una ruta padre (por ejemplo `/admin` → `/panel`), este test
 * rompe **antes** de que las mutaciones empiecen a invalidar rutas
 * fantasma en silencio.
 *
 * `layout` → `<path>/layout.tsx`, `page` → `<path>/page.tsx`. Los
 * segmentos dinámicos usan el nombre real de carpeta con corchetes
 * (`[slug]`, `[id]`).
 */
describe('revalidate-admin: cada target apunta a un archivo real de src/app', () => {
  // `__dirname` en Node/vitest apunta a `src/lib/`.
  const appRoot = path.resolve(__dirname, '..', 'app')

  for (const [key, target] of Object.entries(REVALIDATE_TARGETS) as [
    string,
    RevalidateTarget,
  ][]) {
    const filename = target.kind === 'layout' ? 'layout.tsx' : 'page.tsx'
    const trimmed = target.path.replace(/^\//, '')
    const filePath = path.join(appRoot, trimmed, filename)

    it(`${key} → ${target.path}/${filename}`, () => {
      expect(fs.existsSync(filePath), buildMessage(target, filePath)).toBe(true)
    })
  }
})

function buildMessage(target: RevalidateTarget, filePath: string): string {
  return [
    `El target ${target.path} (${target.kind}) declarado en REVALIDATE_TARGETS`,
    `apunta a ${filePath}, pero ese archivo no existe.`,
    `Alguien renombró o movió la ruta; actualiza src/lib/revalidate-admin.ts`,
    `en vez de dejar la invalidación fallando en silencio.`,
  ].join(' ')
}
