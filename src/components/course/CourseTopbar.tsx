'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/Button'

interface CourseTopbarProps {
  title: string
  pct: number
  completedAll: boolean
  hasEvaluation: boolean
  onStartEvaluation: () => void
}

/**
 * Topbar del curso (HABILITAS-ESPECIFICACION §5.4 RF-4.1). Fondo sólido charcoal
 * (nunca gradiente). La evaluación se habilita solo al completar todos los
 * módulos (RF-4.6).
 */
export function CourseTopbar({
  title,
  pct,
  completedAll,
  hasEvaluation,
  onStartEvaluation,
}: CourseTopbarProps) {
  const evalEnabled = completedAll && hasEvaluation

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

          <Button
            variant={evalEnabled ? 'primary' : 'dark'}
            size="sm"
            disabled={!evalEnabled}
            onClick={onStartEvaluation}
            title={
              evalEnabled
                ? 'Comenzar evaluación final'
                : 'Completa los módulos para desbloquear'
            }
          >
            {completedAll ? 'Comenzar evaluación' : 'Evaluación bloqueada'}
          </Button>
        </div>
      </div>
    </header>
  )
}
