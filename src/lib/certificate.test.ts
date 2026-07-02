import { describe, expect, it } from 'vitest'

import { certificateExpiresAt, certificateVerifyUrl } from './certificate'

describe('certificateExpiresAt', () => {
  it('suma días de vigencia sobre la fecha de emisión (spec decisión 3)', () => {
    const issued = '2026-01-10T12:00:00.000Z'
    const out = certificateExpiresAt(issued, 365)
    expect(out).toBe('2027-01-10T12:00:00.000Z')
  })

  it('acepta Date además de ISO string', () => {
    const issued = new Date('2026-06-15T00:00:00.000Z')
    const out = certificateExpiresAt(issued, 30)
    expect(out).toBe('2026-07-15T00:00:00.000Z')
  })

  it('vigencia 0 → vence el mismo instante', () => {
    const issued = '2026-01-10T12:00:00.000Z'
    expect(certificateExpiresAt(issued, 0)).toBe(issued)
  })

  it('trunca vigencia fraccional y no acepta negativos', () => {
    const issued = '2026-01-10T00:00:00.000Z'
    expect(certificateExpiresAt(issued, 1.9)).toBe('2026-01-11T00:00:00.000Z')
    expect(certificateExpiresAt(issued, -5)).toBe(issued)
  })
})

describe('certificateVerifyUrl', () => {
  it('prefiere verification_id (inadivinable) sobre cert_id (legible)', () => {
    const url = certificateVerifyUrl(
      'https://habilitas.co',
      'abcd1234-uuid-inadivinable',
      'HAB-2026-0001',
    )
    expect(url).toBe('https://habilitas.co/verificar/abcd1234-uuid-inadivinable')
  })

  it('cae a cert_id cuando falta verification_id (legacy)', () => {
    expect(certificateVerifyUrl('https://habilitas.co', null, 'HAB-2026-0001')).toBe(
      'https://habilitas.co/verificar/HAB-2026-0001',
    )
    expect(certificateVerifyUrl('https://habilitas.co', '', 'HAB-2026-0001')).toBe(
      'https://habilitas.co/verificar/HAB-2026-0001',
    )
  })

  it('normaliza el trailing slash de la base URL', () => {
    expect(certificateVerifyUrl('https://habilitas.co/', 'v', 'c')).toBe(
      'https://habilitas.co/verificar/v',
    )
  })

  it('siteUrl vacía deja la URL relativa (dev)', () => {
    expect(certificateVerifyUrl('', 'v', 'c')).toBe('/verificar/v')
  })
})
