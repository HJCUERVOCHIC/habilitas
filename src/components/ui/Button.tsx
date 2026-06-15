'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { CATEGORY_BG_CLASS, type Category } from '@/lib/categories'

/**
 * Button — componente base del design system Habilitas.
 * Variantes según la tabla de HABILITAS-STACK.md §6.
 * Regla: un solo `btn-primary` visible por sección o formulario.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-sans font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Acción principal — teal sólido
        primary: 'bg-teal text-white hover:bg-teal-light',
        // Acción secundaria — transparente, borde gris
        ghost: 'border border-border bg-transparent text-ink-main hover:bg-mist',
        // Sobre fondos teal/charcoal — borde blanco
        'outline-white': 'border border-white bg-transparent text-white hover:bg-white/10',
        // Topbar del curso — borde blanco sutil
        dark: 'border border-white/20 bg-transparent text-white hover:bg-white/10',
        // "Ver detalle" en catálogo — color de categoría (ver prop `category`)
        cert: 'text-white hover:brightness-110',
        // Acciones en verificación — blanco, borde gris
        'verify-secondary': 'border border-border bg-white text-ink-main hover:bg-mist',
      },
      size: {
        default: 'h-11 px-5 py-2.5 text-sm',
        // CTA de hero y purchase card — padding mayor
        lg: 'h-14 px-8 py-4 text-base',
        sm: 'h-9 px-4 text-sm',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Requerido cuando variant="cert": define el color de fondo por categoría. */
  category?: Category
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, category, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const categoryClass = variant === 'cert' && category ? CATEGORY_BG_CLASS[category] : undefined
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), categoryClass, className)}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
