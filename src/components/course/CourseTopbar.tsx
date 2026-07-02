'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/Button'

interface CourseTopbarProps {
  title: string
  slug: string
  pct: number
  hasEvaluation: boolean
}

/**
 * Topbar del curso (HABILITAS-ESPECIFICACION §5.4 RF-4.1). Fondo sólido charcoal
 * (nunca gradiente). La evaluación tiene **acceso directo** (SPEC-EVALUACION
 * decisión 2): no está gated por el progreso de lecciones. El estado real
 * (aprobado / bloqueado / intentos restantes) se resuelve en la propia página
 * `/curso/[slug]/evaluacion`.
 */
export function CourseTopbar({ title, slug, pct, hasEvaluation }: CourseTopbarProps) {
  return (
    <header className="bg-charcoal text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link href="/perfil" className="text-xs text-teal-mid hover:text-white">
            ← Mis cursos
          </Link>
          <h1 className="truncate text-lg font-semibold">{title}</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="min-w-[140px]">
            <div className="flex items-center justify-between text-xs text-teal-mid">
              <span>Progreso</span>
              <span>{pct}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-teal-light transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {hasEvaluation && (
            <Button variant="primary" size="sm" asChild>
              <Link href={`/curso/${slug}/evaluacion`}>Ir a evaluación</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
