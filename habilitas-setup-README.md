# Habilitas — Frontend Setup

Design System v1.0 · Stack: Next.js 14 + Tailwind CSS + shadcn/ui

---

## Arranque en 5 pasos

```bash
# 1. Crear proyecto Next.js
npx create-next-app@latest habilitas --typescript --tailwind --app --src-dir

# 2. Instalar shadcn/ui
npx shadcn-ui@latest init

# 3. Instalar dependencias base
npm install clsx tailwind-merge

# 4. Copiar los archivos de este design system
cp tailwind.config.js  ./
cp globals.css         ./src/app/globals.css
cp Button.tsx          ./src/components/ui/Button.tsx

# 5. Crear el helper cn (si shadcn no lo creó)
mkdir -p src/lib && touch src/lib/utils.ts
```

Contenido de `src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## Estructura de carpetas

```
src/
├── app/
│   ├── globals.css              ← Design tokens + @layer base
│   ├── layout.tsx               ← Root layout (fuentes, metadata)
│   ├── page.tsx                 ← Landing page
│   │
│   ├── certificaciones/
│   │   ├── page.tsx             ← Catálogo
│   │   └── [slug]/
│   │       └── page.tsx         ← Detalle de certificación
│   │
│   ├── curso/
│   │   └── [slug]/
│   │       └── page.tsx         ← Contenido del curso + evaluación
│   │
│   ├── verificar/
│   │   └── [id]/
│   │       └── page.tsx         ← Verificación pública (SSR)
│   │
│   └── perfil/
│       └── page.tsx             ← Dashboard del profesional
│
├── components/
│   │
│   ├── ui/                      ← Componentes base del design system
│   │   ├── Button.tsx           ← ✅ Listo
│   │   ├── Badge.tsx            ← Próximo
│   │   ├── Input.tsx            ← Próximo
│   │   ├── Card.tsx             ← Próximo
│   │   └── Icon.tsx             ← Próximo
│   │
│   ├── cert/                    ← Componentes específicos de certificación
│   │   ├── CertCard.tsx         ← Card del catálogo (con variantes de categoría)
│   │   ├── CertDocument.tsx     ← Documento verificable completo
│   │   ├── CertListCard.tsx     ← Card horizontal del perfil
│   │   ├── PurchaseCard.tsx     ← Card de compra del detalle
│   │   └── VerifyBanner.tsx     ← Banner de estado (válido/vencido/revocado)
│   │
│   ├── course/                  ← Componentes del player de curso
│   │   ├── CourseTopbar.tsx
│   │   ├── VideoPlayer.tsx
│   │   ├── LessonSidebar.tsx
│   │   └── EvalModal.tsx
│   │
│   ├── landing/                 ← Secciones de la landing
│   │   ├── Hero.tsx
│   │   ├── EmployersStrip.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── Comparison.tsx
│   │   ├── Testimonials.tsx
│   │   └── CTABanner.tsx
│   │
│   └── layout/                  ← Layout compartido
│       ├── Topbar.tsx
│       ├── VerifyTopbar.tsx
│       └── CourseTopbar.tsx
│
├── lib/
│   ├── utils.ts                 ← cn() helper
│   ├── categories.ts            ← CATEGORY_COLORS y tipos
│   └── cert-states.ts           ← Lógica de estados del certificado
│
└── types/
    ├── cert.ts                  ← Tipos de certificado y profesional
    └── course.ts                ← Tipos de curso, módulo, lección
```

---

## Reglas críticas del design system

### 1. El gradiente teal es exclusivo del certificado
```tsx
// ✅ Correcto — solo en CertDocument
<div className="gradient-cert-header">...</div>

// ✗ Incorrecto — nunca en navbars, modales ni banners
<nav className="gradient-cert-header">...</nav>
```

### 2. DM Serif Display solo en estos casos
- Hero titles (`h1` de landing)
- Precios en purchase card
- Nombre del profesional en el certificado
- Títulos de sección grandes (`section-title`)
- Pantalla de celebración al aprobar

```tsx
// ✅ Correcto
<h1 className="font-display text-display-3xl">Tu próximo empleo...</h1>

// ✗ Incorrecto — botones, labels, metadata van en DM Sans
<button className="font-display">Ver certificaciones</button>
```

### 3. ButtonCert siempre con su categoría
```tsx
// ✅ Correcto — color semántico por categoría
<ButtonCert category="bioseguridad">Ver detalle →</ButtonCert>

// ✗ Incorrecto — no hardcodear colores en el botón
<Button style={{ background: '#1A7A4A' }}>Ver detalle →</Button>
```

### 4. Sombras según el contexto
| Sombra      | Usar en                                          |
|-------------|--------------------------------------------------|
| `shadow-sm` | Navbar, cards en estado default                  |
| `shadow-md` | Cards en hover, modales ligeros, purchase card   |
| `shadow-lg` | Modales overlay, cert-card-demo en el hero       |

---

## Próximos componentes a construir

En este orden, por prioridad de la pantalla más crítica primero:

1. `VerifyBanner.tsx` — la pantalla que ve el empleador
2. `CertDocument.tsx` — el certificado completo
3. `CertCard.tsx` — el catálogo
4. `PurchaseCard.tsx` — conversión
5. `Badge.tsx` — badges, pills, chips reutilizables
6. `Input.tsx` — buscador del catálogo
7. `EvalModal.tsx` — la evaluación
