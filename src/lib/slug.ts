/**
 * Normaliza una cadena a un slug URL-safe:
 *   1. NFD para separar diacríticos del carácter base.
 *   2. Elimina las marcas de combinación (acentos, diéresis, virgulilla).
 *   3. Pasa a minúsculas.
 *   4. Reemplaza todo lo no alfanumérico ASCII por guion.
 *   5. Colapsa guiones repetidos.
 *   6. Recorta guiones en los extremos.
 *
 * Devuelve cadena vacía si la entrada no produce caracteres alfanuméricos.
 * Idempotente: slugify(slugify(x)) === slugify(x).
 */
export function slugify(value: string): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** True si el valor ya está en forma slug (no requiere normalización). */
export function isSlug(value: string): boolean {
  return value === slugify(value) && value.length > 0
}
