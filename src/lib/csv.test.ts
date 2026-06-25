import { describe, expect, it } from 'vitest'

import { escapeCsvField, toCsv } from './csv'

describe('escapeCsvField', () => {
  it('devuelve cadena vacía para null o undefined', () => {
    expect(escapeCsvField(null)).toBe('')
    expect(escapeCsvField(undefined)).toBe('')
  })

  it('no envuelve cadenas simples sin caracteres especiales', () => {
    expect(escapeCsvField('hola')).toBe('hola')
    expect(escapeCsvField('HAB-2026-0001')).toBe('HAB-2026-0001')
  })

  it('envuelve y escapa comillas embebidas', () => {
    expect(escapeCsvField('dijo "hola"')).toBe('"dijo ""hola"""')
  })

  it('envuelve si contiene coma', () => {
    expect(escapeCsvField('Bogotá, Colombia')).toBe('"Bogotá, Colombia"')
  })

  it('envuelve si contiene saltos de línea', () => {
    expect(escapeCsvField('línea1\nlínea2')).toBe('"línea1\nlínea2"')
    expect(escapeCsvField('línea1\r\nlínea2')).toBe('"línea1\r\nlínea2"')
  })

  it('serializa números y booleanos como su String()', () => {
    expect(escapeCsvField(42)).toBe('42')
    expect(escapeCsvField(true)).toBe('true')
  })
})

describe('toCsv', () => {
  it('emite encabezado + filas separadas por CRLF', () => {
    const csv = toCsv(['a', 'b'], [
      ['1', '2'],
      ['3', '4'],
    ])
    expect(csv).toBe('a,b\r\n1,2\r\n3,4')
  })

  it('escapa por columna sin contaminar otras', () => {
    const csv = toCsv(['id', 'nota'], [['HAB-1', 'tiene, coma'], ['HAB-2', 'normal']])
    expect(csv).toBe('id,nota\r\nHAB-1,"tiene, coma"\r\nHAB-2,normal')
  })

  it('soporta null/undefined como celda vacía', () => {
    const csv = toCsv(['a', 'b'], [['x', null], [undefined, 'y']])
    expect(csv).toBe('a,b\r\nx,\r\n,y')
  })
})
