import { describe, expect, it } from 'vitest'

import { cn } from './utils'

describe('cn', () => {
  it('combina clases simples', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('aplica clases condicionales', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c')
  })

  it('resuelve conflictos de Tailwind con tailwind-merge', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
