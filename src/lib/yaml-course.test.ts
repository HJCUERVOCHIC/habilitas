import { describe, expect, it } from 'vitest'

import { parseAndValidateYaml } from './yaml-course'

const VALID_MINIMAL = `
titulo: Curso mínimo
area: bioseguridad
modulos:
  - titulo: Módulo 1
    lecciones:
      - tipo: texto
        titulo: Lección de prueba
        contenido_md: |
          # Hola
          Texto.
`

describe('parseAndValidateYaml', () => {
  it('acepta un curso mínimo válido y deriva slug del título', () => {
    const res = parseAndValidateYaml(VALID_MINIMAL)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.payload.slug).toBe('curso-minimo')
      expect(res.payload.category).toBe('bioseguridad')
      expect(res.payload.modules).toHaveLength(1)
      expect(res.payload.modules[0]?.lessons).toHaveLength(1)
      expect(res.payload.modules[0]?.lessons[0]?.content_type).toBe('text')
    }
  })

  it('mapea sinónimos de área a una categoría válida', () => {
    const res = parseAndValidateYaml(VALID_MINIMAL.replace('bioseguridad', 'Salud mental'))
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.payload.category).toBe('enfermeria')
  })

  it('rechaza áreas no reconocidas', () => {
    const res = parseAndValidateYaml(VALID_MINIMAL.replace('bioseguridad', 'astronomía'))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors.some((e) => /no reconocida/.test(e))).toBe(true)
  })

  it('respeta slug del YAML normalizándolo', () => {
    const yaml = `
slug: Mi Curso Salud Mental!!
titulo: Curso de prueba
area: salud mental
modulos:
  - titulo: M
    lecciones:
      - tipo: texto
        titulo: T
        contenido_md: 'x'
`
    const res = parseAndValidateYaml(yaml)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.payload.slug).toBe('mi-curso-salud-mental')
  })

  it('rechaza si modulos está vacío', () => {
    const res = parseAndValidateYaml(`
titulo: x
area: bioseguridad
modulos: []
`)
    expect(res.ok).toBe(false)
  })

  it('rechaza lección de texto sin contenido_md', () => {
    const res = parseAndValidateYaml(`
titulo: x
area: bioseguridad
modulos:
  - titulo: M
    lecciones:
      - tipo: texto
        titulo: T
`)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors.some((e) => /contenido_md/.test(e))).toBe(true)
  })

  it('importa video con video_url PENDIENTE como pending_media', () => {
    const res = parseAndValidateYaml(`
titulo: x
area: bioseguridad
modulos:
  - titulo: M
    lecciones:
      - tipo: video
        titulo: V
        video_url: PENDIENTE
        duracion_seg: 120
`)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.summary.pendingMedia).toHaveLength(1)
      const lesson = res.payload.modules[0]?.lessons[0]
      expect(lesson?.pending_media).toBe(true)
      expect(lesson?.content_type).toBe('video')
      expect(lesson?.duration_min).toBe(2)
    }
  })

  it('mapea recurso a content_type pdf', () => {
    const res = parseAndValidateYaml(`
titulo: x
area: bioseguridad
modulos:
  - titulo: M
    lecciones:
      - tipo: recurso
        titulo: R
        archivo_url: PENDIENTE
`)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.payload.modules[0]?.lessons[0]?.content_type).toBe('pdf')
  })

  it('valida evaluacion con banco y marca múltiples correctas como advertencia', () => {
    const res = parseAndValidateYaml(`
titulo: x
area: bioseguridad
modulos:
  - titulo: M
    lecciones:
      - tipo: texto
        titulo: T
        contenido_md: 'x'
evaluacion:
  preguntas_por_intento: 5
  nota_minima: 80
  banco:
    - enunciado: ¿Pregunta 1?
      opciones:
        - texto: A
          correcta: true
        - texto: B
          correcta: false
      explicacion: ok
    - enunciado: ¿Pregunta 2?
      opciones:
        - texto: A
          correcta: true
        - texto: B
          correcta: true
`)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.payload.evaluation?.pass_score).toBe(80)
      expect(res.payload.evaluation?.questions_per_attempt).toBe(5)
      expect(res.payload.evaluation?.questions).toHaveLength(2)
      expect(res.summary.multipleCorrectWarnings).toBe(1)
      expect(res.warnings.some((w) => /múltiples opciones/.test(w))).toBe(true)
    }
  })

  it('rechaza pregunta sin ninguna correcta', () => {
    const res = parseAndValidateYaml(`
titulo: x
area: bioseguridad
modulos:
  - titulo: M
    lecciones:
      - tipo: texto
        titulo: T
        contenido_md: 'x'
evaluacion:
  banco:
    - enunciado: x
      opciones:
        - texto: A
          correcta: false
        - texto: B
          correcta: false
`)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors.some((e) => /ninguna opción marcada/.test(e))).toBe(true)
  })

  it('rechaza YAML que no parsea', () => {
    const res = parseAndValidateYaml('::: invalid : yaml ::')
    expect(res.ok).toBe(false)
  })
})
