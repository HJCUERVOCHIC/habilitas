import Link from 'next/link'

import { Hero } from '@/components/landing/Hero'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { InstitutionsBanner } from '@/components/landing/InstitutionsBanner'
import { Topbar } from '@/components/layout/Topbar'

// Landing (SSG): sin auth ni datos dinámicos → estática y rápida (RF-1.1..1.4).
// Valor configurable de prueba social; no afirma cifras verificables falsas (RF-1.4).
const LAUNCH_PROFESSIONALS = 120

export default function Home() {
  return (
    <>
      <Topbar />
      <main>
        <Hero />

        {/* Prueba social (valor estático de lanzamiento, RF-1.4) */}
        <section className="border-y border-border bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-section py-10 sm:grid-cols-3">
            <Proof figure={`+${LAUNCH_PROFESSIONALS}`}>
              profesionales en formación durante el lanzamiento
            </Proof>
            <Proof figure="Segundos">verificación pública por URL y QR</Proof>
            <Proof figure="Sin trámites">el empleador valida sin llamar a nadie</Proof>
          </div>
        </section>

        <HowItWorks />
        <InstitutionsBanner />
      </main>

      <footer className="bg-mist">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-section py-8 sm:flex-row">
          <p className="font-display text-lg text-charcoal">Habilitas</p>
          <nav className="flex gap-6 text-sm text-ink-soft">
            <Link href="/certificaciones" className="hover:text-teal">
              Certificaciones
            </Link>
            <Link href="/ingresar" className="hover:text-teal">
              Ingresar
            </Link>
          </nav>
          <p className="text-xs text-ink-muted">© 2026 Habilitas · Colombia</p>
        </div>
      </footer>
    </>
  )
}

function Proof({ figure, children }: { figure: string; children: React.ReactNode }) {
  return (
    <div className="text-center sm:text-left">
      <p className="font-display text-2xl text-teal">{figure}</p>
      <p className="mt-1 text-sm text-ink-soft">{children}</p>
    </div>
  )
}
