'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

import { SignOutButton } from '@/components/layout/SignOutButton'
import { cn } from '@/lib/utils'

interface AppNavProps {
  email: string
  fullName: string | null
}

interface NavItem {
  href: string
  label: string
}

/**
 * Topbar del shell de estudiante (SPEC-NAVEGACION §2 entregable 2 +
 * SPEC-ROLES-ACCESO §1). Color sólido, nunca gradiente (HABILITAS-STACK §6).
 *
 * Roles y acceso: el admin tiene su propio shell en /admin y se redirige
 * antes de llegar aquí (ver (app)/layout.tsx). Por eso este menú no
 * contiene un enlace al panel admin.
 */
export function AppNav({ email, fullName }: AppNavProps) {
  const [open, setOpen] = useState(false)
  const items: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/certificaciones', label: 'Catálogo' },
    { href: '/mis-cursos', label: 'Mis cursos' },
    { href: '/perfil', label: 'Perfil' },
  ]

  const displayName = fullName?.trim() || email

  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/dashboard"
          className="font-display text-xl text-charcoal"
          onClick={() => setOpen(false)}
        >
          Habilitas
        </Link>

        {/* Nav desktop */}
        <nav className="hidden items-center gap-6 md:flex">
          {items.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        {/* Identidad desktop */}
        <div className="hidden items-center gap-3 md:flex">
          <span className="max-w-[180px] truncate text-sm text-ink-soft" title={displayName}>
            {displayName}
          </span>
          <SignOutButton />
        </div>

        {/* Toggle móvil */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-ink-main hover:bg-mist md:hidden"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Panel móvil */}
      {open && (
        <div className="border-t border-border bg-white md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-3">
            {items.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                onNavigate={() => setOpen(false)}
                block
              />
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
              <span className="max-w-[60%] truncate text-sm text-ink-soft" title={displayName}>
                {displayName}
              </span>
              <SignOutButton />
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

function NavLink({
  href,
  label,
  onNavigate,
  block,
}: {
  href: string
  label: string
  onNavigate?: () => void
  block?: boolean
}) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(`${href}/`)
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'text-sm font-medium transition-colors',
        block ? 'rounded-md px-3 py-2' : '',
        active
          ? block
            ? 'bg-teal-pale text-teal'
            : 'text-teal'
          : block
            ? 'text-ink-main hover:bg-mist'
            : 'text-ink-main hover:text-teal',
      )}
    >
      {label}
    </Link>
  )
}
