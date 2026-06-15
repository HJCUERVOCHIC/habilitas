/**
 * Categorías de certificación y sus colores semánticos.
 * Fuente: HABILITAS-STACK.md §6 (Colores por categoría) y §7 (check de courses.category).
 * Usar en: accent bar de card, texto cert-category, fondo de btn-cert.
 */

export const CATEGORIES = [
  'soporte-vital',
  'procedimientos-clinicos',
  'bioseguridad',
  'farmacologia',
  'urgencias',
  'enfermeria',
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  'soporte-vital': 'Soporte vital',
  'procedimientos-clinicos': 'Procedimientos clínicos',
  bioseguridad: 'Bioseguridad',
  farmacologia: 'Farmacología',
  urgencias: 'Urgencias y emergencias',
  enfermeria: 'Enfermería',
}

/** Color hex por categoría (HABILITAS-STACK.md §6). */
export const CATEGORY_COLORS: Record<Category, string> = {
  'soporte-vital': '#0A6E6E', // teal
  'procedimientos-clinicos': '#C8833A', // amber
  bioseguridad: '#1A7A4A', // green
  farmacologia: '#0A6E6E', // teal
  urgencias: '#C0392B', // red
  enfermeria: '#2E86AB', // blue
}

/** Clase Tailwind de fondo por categoría (para btn-cert / accent bar). */
export const CATEGORY_BG_CLASS: Record<Category, string> = {
  'soporte-vital': 'bg-teal',
  'procedimientos-clinicos': 'bg-amber',
  bioseguridad: 'bg-green-ok',
  farmacologia: 'bg-teal',
  urgencias: 'bg-red-err',
  enfermeria: 'bg-blue',
}

/** Clase Tailwind de texto por categoría (para cert-category). */
export const CATEGORY_TEXT_CLASS: Record<Category, string> = {
  'soporte-vital': 'text-teal',
  'procedimientos-clinicos': 'text-amber',
  bioseguridad: 'text-green-ok',
  farmacologia: 'text-teal',
  urgencias: 'text-red-err',
  enfermeria: 'text-blue',
}

export const DIFFICULTY_LABELS: Record<string, string> = {
  basico: 'Básico',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

/** Nivel 1–3 para los difficulty dots. */
export const DIFFICULTY_LEVEL: Record<string, number> = {
  basico: 1,
  intermedio: 2,
  avanzado: 3,
}

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value)
}
