import { revalidatePath } from 'next/cache'

/**
 * Invalidación de rutas tras mutaciones en el panel de administración
 * (SPEC-FIX-CACHE-ADMIN §1.1). Centralizado aquí para que cada action no
 * improvise su propia lista y no se olvide alguna. Cada helper cubre un
 * alcance concreto; los actions escogen el que corresponde.
 *
 * Se usan rutas literales con los valores dinámicos reales (no plantillas
 * con corchetes), porque son las que Next asocia al Router Cache del
 * cliente para las navegaciones internas.
 */

/**
 * Alcance CURSO: cambia información visible del curso (título, subtítulo,
 * descripción, publicación, archivado). Cubre listado y detalle admin, más
 * catálogo público y detalle público (el estado de publicación y los datos
 * cambian su visibilidad).
 */
export function revalidateCourse(slug: string): void {
  revalidatePath('/admin/cursos')
  revalidatePath(`/admin/cursos/${slug}`)
  revalidatePath('/certificaciones')
  revalidatePath(`/certificaciones/${slug}`)
}

/**
 * Alcance ESTRUCTURA: cambia la estructura del curso (módulos o lecciones
 * agregados, reordenados o eliminados). Invalida el listado de módulos y
 * también el detalle admin del curso (el checklist de publicación depende
 * de estos conteos) y el reproductor del estudiante.
 */
export function revalidateStructure(slug: string): void {
  revalidatePath(`/admin/cursos/${slug}`)
  revalidatePath(`/admin/cursos/${slug}/modulos`)
  revalidatePath(`/curso/${slug}`)
}

/**
 * Alcance LECCIÓN: cambia una lección individual (título, tipo, body_md,
 * medio). Invalida el editor de esa lección y el listado de módulos porque
 * el título y el tipo se muestran allí, más el reproductor del estudiante.
 */
export function revalidateLesson(slug: string, lessonId: string): void {
  revalidatePath(`/admin/cursos/${slug}/lecciones/${lessonId}`)
  revalidatePath(`/admin/cursos/${slug}/modulos`)
  revalidatePath(`/curso/${slug}`)
}
