import { describe, expect, it } from 'vitest'

import { isSlug, slugify } from './slug'

describe('slugify', () => {
  it('reemplaza espacios por guiones', () => {
    expect(slugify('Prueba de contenido 2')).toBe('prueba-de-contenido-2')
  })

  it('elimina diacríticos manteniendo la letra base', () => {
    expect(slugify('Bioseguridad — Educación Informal')).toBe(
      'bioseguridad-educacion-informal',
    )
    expect(slugify('Atención al paciente crítico')).toBe('atencion-al-paciente-critico')
  })

  it('colapsa guiones, espacios y signos repetidos', () => {
    expect(slugify('  ¿qué--es___esto?  ')).toBe('que-es-esto')
  })

  it('elimina caracteres no ASCII y emojis', () => {
    expect(slugify('Curso 🚑 de RCP')).toBe('curso-de-rcp')
  })

  it('es idempotente', () => {
    const once = slugify('Soporte Vital Básico (BLS)')
    expect(slugify(once)).toBe(once)
  })

  it('devuelve cadena vacía si no hay alfanuméricos', () => {
    expect(slugify('')).toBe('')
    expect(slugify('   ')).toBe('')
    expect(slugify('???')).toBe('')
  })

  it('preserva números', () => {
    expect(slugify('Módulo 3.5 — parte 2')).toBe('modulo-3-5-parte-2')
  })
})

describe('isSlug', () => {
  it('true para slugs ya normalizados', () => {
    expect(isSlug('soporte-vital-basico-bls')).toBe(true)
    expect(isSlug('curso-2')).toBe(true)
  })

  it('false para cadenas con espacios, mayúsculas o vacías', () => {
    expect(isSlug('Soporte Vital')).toBe(false)
    expect(isSlug('curso-')).toBe(false)
    expect(isSlug('')).toBe(false)
  })
})
