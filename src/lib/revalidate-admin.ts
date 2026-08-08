import { revalidatePath } from 'next/cache'

/**
 * Invalidación de rutas tras mutaciones (SPEC-FIX-CACHE-ADMIN §1 +
 * CLAUDE.md "Invalidación tras mutar" + "La invalidación cruza roles").
 *
 * Diseño (v2, tras el bug del 07-ago con `/admin/certificados` que no se
 * actualizaba):
 *
 *  - `/admin` tiene su propio `layout.tsx`. Invalidamos el layout completo
 *    con `revalidatePath('/admin', 'layout')`: una sola llamada cubre todas
 *    las rutas admin actuales (listado, detalle, módulos, evaluación,
 *    lecciones, inscritos, ficha de estudiante, registro de constancias) y
 *    cualquier hija futura. Renombrar o mover una hija ya no rompe la
 *    invalidación en silencio.
 *  - Para reproductor de estudiante, catálogo público y verificación no hay
 *    un layout intermedio, así que usamos el patrón dinámico
 *    (`/curso/[slug]`, `/certificaciones/[slug]`, `/verificar/[id]`).
 *    `revalidatePath` con `[slug]` cubre cualquier URL que matchee el
 *    patrón — no depende del valor concreto del slug/id.
 *
 * El test `revalidate-admin.test.ts` recorre `REVALIDATE_TARGETS` y verifica
 * que cada target apunte a un `layout.tsx` o `page.tsx` real bajo `src/app`.
 * Si alguien renombra o mueve una ruta padre, el test falla en lugar de que
 * la invalidación se rompa silenciosamente.
 */

export type RevalidateKind = 'layout' | 'page'

export interface RevalidateTarget {
  /** Ruta de sistema de archivos (con segmentos dinámicos como `[slug]`). */
  path: string
  /** `layout` requiere `layout.tsx`; `page` requiere `page.tsx`. */
  kind: RevalidateKind
}

/**
 * Tabla única de rutas invalidables. Todas las llamadas a `revalidatePath`
 * del código admin y del runtime del estudiante pasan por aquí. Añadir un
 * nuevo target o renombrar uno existente es un cambio localizado que el
 * test detecta si el archivo referenciado no existe.
 */
export const REVALIDATE_TARGETS = {
  /** Cubre TODO `/admin` (usa `src/app/admin/layout.tsx`). */
  admin: { path: '/admin', kind: 'layout' },
  /** Catálogo público. */
  catalog: { path: '/certificaciones', kind: 'page' },
  /** Detalle público del curso (dinámico). */
  catalogDetail: { path: '/certificaciones/[slug]', kind: 'page' },
  /** Reproductor del estudiante (dinámico). */
  cursoPlayer: { path: '/curso/[slug]', kind: 'page' },
  /** Evaluación en el reproductor (dinámico). */
  cursoEval: { path: '/curso/[slug]/evaluacion', kind: 'page' },
  /** Verificación pública de constancia (dinámico). */
  verify: { path: '/verificar/[id]', kind: 'page' },
} as const satisfies Record<string, RevalidateTarget>

function invalidate(target: RevalidateTarget): void {
  revalidatePath(target.path, target.kind)
}

/**
 * Invalida toda la subárbol admin. Se llama desde cualquier mutación
 * (admin o del estudiante) que pueda cambiar lo que ve el panel.
 */
export function revalidateAdminAll(): void {
  invalidate(REVALIDATE_TARGETS.admin)
}

/**
 * Alcance CURSO: cambia información visible del curso (título, subtítulo,
 * descripción, publicación, archivado). Cubre admin, catálogo y detalle
 * público. El `slug` se ignora — el catálogo detalle se invalida por
 * patrón `[slug]`, no por literal, para no romper si el slug cambia.
 */
export function revalidateCourse(slug: string): void {
  void slug
  invalidate(REVALIDATE_TARGETS.admin)
  invalidate(REVALIDATE_TARGETS.catalog)
  invalidate(REVALIDATE_TARGETS.catalogDetail)
}

/**
 * Alcance ESTRUCTURA: cambian módulos o lecciones (crear, editar,
 * reordenar, eliminar). Admin ve estructura y checklist; el reproductor
 * del estudiante muestra el árbol.
 */
export function revalidateStructure(slug: string): void {
  void slug
  invalidate(REVALIDATE_TARGETS.admin)
  invalidate(REVALIDATE_TARGETS.cursoPlayer)
}

/**
 * Alcance LECCIÓN: cambian datos de una lección específica (título,
 * tipo, body_md, medio). Admin muestra la lección y el listado de
 * módulos; el reproductor la renderiza.
 */
export function revalidateLesson(slug: string, lessonId: string): void {
  void slug
  void lessonId
  invalidate(REVALIDATE_TARGETS.admin)
  invalidate(REVALIDATE_TARGETS.cursoPlayer)
}

/**
 * Alcance ESTUDIANTE → ADMIN (CLAUDE.md "la invalidación cruza roles"):
 * cuando una acción del estudiante cambia datos que el panel lee
 * (inscripción, progreso, intento, constancia), invalidamos todo `/admin`
 * de una sola pasada. `slug` y `userId` quedan como firma informativa y
 * facilitan logs futuros; no son necesarios para la invalidación en sí.
 */
export function revalidateStudentActivityForAdmin(
  slug: string,
  userId: string,
): void {
  void slug
  void userId
  invalidate(REVALIDATE_TARGETS.admin)
}

/**
 * Alcance VERIFICACIÓN pública. La página `/verificar/[id]` es dinámica
 * y no requiere un ID concreto: el patrón invalida cualquier URL bajo
 * el segmento. Resuelve el bug lateral de `revokeCertificate` que
 * invalidaba con `cert_id` legible cuando las URLs reales usan
 * `verification_id` (UUID) desde la migración 0008.
 */
export function revalidateVerify(): void {
  invalidate(REVALIDATE_TARGETS.verify)
}
