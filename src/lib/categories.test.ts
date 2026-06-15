import { describe, expect, it } from 'vitest'

import {
  CATEGORIES,
  CATEGORY_BG_CLASS,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  isCategory,
} from './categories'

describe('categories', () => {
  it('cubre las 6 categorías del schema en cada mapa', () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_COLORS[category]).toMatch(/^#[0-9A-F]{6}$/i)
      expect(CATEGORY_LABELS[category]).toBeTruthy()
      expect(CATEGORY_BG_CLASS[category]).toMatch(/^bg-/)
    }
    expect(CATEGORIES).toHaveLength(6)
  })

  it('mapea los colores semánticos de HABILITAS-STACK §6', () => {
    expect(CATEGORY_COLORS['soporte-vital']).toBe('#0A6E6E')
    expect(CATEGORY_COLORS.urgencias).toBe('#C0392B')
    expect(CATEGORY_COLORS.enfermeria).toBe('#2E86AB')
  })

  it('isCategory discrimina valores válidos', () => {
    expect(isCategory('bioseguridad')).toBe(true)
    expect(isCategory('no-existe')).toBe(false)
  })
})
