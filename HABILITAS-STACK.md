# Habilitas — Stack Técnico v1.0

> Fuente de verdad técnica del proyecto. Consultar antes de tomar cualquier decisión de arquitectura, base de datos, componentes o despliegue.

**Producto:** Plataforma de certificación de habilidades clínicas para profesionales de la salud en Colombia.
**Estado:** MVP · Objetivo de lanzamiento: 2 semanas
**Prioridad MVP:** Cursos + evaluaciones + certificados verificables (sin pagos aún)

---

## Tabla de contenido

1. [Stack completo](#1-stack-completo)
2. [Estrategia de render por ruta](#2-estrategia-de-render-por-ruta)
3. [Estructura de carpetas](#3-estructura-de-carpetas)
4. [Reglas de desarrollo](#4-reglas-de-desarrollo)
5. [Variables de entorno](#5-variables-de-entorno)
6. [Design System](#6-design-system)
7. [Base de datos](#7-base-de-datos)
8. [Capa de contenido](#8-capa-de-contenido)
9. [Certificados](#9-certificados)

---

## 1. Stack completo

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR para `/verificar`, SSG para landing, CSR para curso/perfil |
| Estilos | Tailwind CSS + Design System Habilitas | Tokens del mockup v0.2 en `tailwind.config.js` |
| Componentes | shadcn/ui (base) + componentes propios | Accesibilidad resuelta, adaptados al design system |
| Auth | Supabase Auth — Magic Link / Email OTP | Usuario puntual, no recuerda contraseñas |
| Base de datos | Supabase PostgreSQL | Schema relacional, RLS por usuario |
| Backend logic | Supabase Edge Functions (Deno) | Emisión de certs, desbloqueo de módulos, emails |
| Almacenamiento | Cloudflare R2 | Videos, PDFs, imágenes, slides — CDN global sin egress fees |
| Email | Resend | Certificados emitidos, magic links, alta entregabilidad |
| Despliegue | Vercel | Next.js nativo, preview por rama, dominio habilitas.co |
| Tipos | TypeScript estricto | Todo tipado desde la DB hasta los componentes |

---

## 2. Estrategia de render por ruta

| Ruta | Modo | Razón |
|---|---|---|
| `/` | SSG | Landing estática, sin auth |
| `/certificaciones` | ISR · revalida 1h | Catálogo cambia poco |
| `/certificaciones/[slug]` | ISR · revalida 1h | Detalle de cert, sin auth |
| `/verificar/[id]` | SSR | El empleador necesita el estado real en tiempo real |
| `/curso/[slug]` | CSR | Requiere auth, progreso del usuario |
| `/perfil` | CSR | Requiere auth, datos personales |
| `/admin/*` | CSR | Requiere rol admin, panel interno |

---

## 3. Estructura de carpetas

```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                        ← Landing (SSG)
│   ├── certificaciones/
│   │   ├── page.tsx                    ← Catálogo (ISR)
│   │   └── [slug]/page.tsx             ← Detalle (ISR)
│   ├── curso/[slug]/page.tsx           ← Curso (CSR)
│   ├── verificar/[id]/page.tsx         ← Verificación pública (SSR)
│   ├── perfil/page.tsx                 ← Dashboard profesional (CSR)
│   └── admin/                          ← Panel interno (CSR, rol admin)
│       ├── page.tsx
│       ├── cursos/
│       └── certificados/
├── components/
│   ├── ui/                             ← Design system base
│   │   ├── Button.tsx                  ← ✅ Entregado
│   │   ├── Badge.tsx
│   │   ├── Input.tsx
│   │   └── Card.tsx
│   ├── cert/                           ← Componentes de certificación
│   │   ├── CertCard.tsx
│   │   ├── CertDocument.tsx
│   │   ├── CertListCard.tsx
│   │   ├── PurchaseCard.tsx
│   │   └── VerifyBanner.tsx
│   ├── course/                         ← Player de curso
│   │   ├── CourseTopbar.tsx
│   │   ├── LessonViewer.tsx            ← Renderiza según content_type
│   │   ├── LessonSidebar.tsx
│   │   └── EvalModal.tsx
│   ├── landing/                        ← Secciones de landing
│   └── layout/
│       ├── Topbar.tsx
│       └── VerifyTopbar.tsx
├── lib/
│   ├── utils.ts                        ← cn() helper
│   ├── supabase/
│   │   ├── client.ts                   ← Supabase browser client
│   │   ├── server.ts                   ← Supabase server client
│   │   └── middleware.ts               ← Auth middleware
│   ├── r2.ts                           ← Cloudflare R2 client + URLs firmadas
│   └── categories.ts                   ← CATEGORY_COLORS y tipos
└── types/
    ├── database.ts                     ← Tipos generados por Supabase CLI
    ├── cert.ts
    └── course.ts
```

---

## 4. Reglas de desarrollo

1. **TypeScript estricto** — sin `any`, sin `as unknown`
2. **RLS en Supabase** — cada tabla tiene Row Level Security; un usuario solo ve sus datos
3. **URLs firmadas para contenido** — nunca exponer URLs directas de R2 al cliente
4. **Un solo `btn-primary` por sección** — regla del design system
5. **Gradiente teal solo en `cert-doc-header`** — ver sección 6
6. **PPTX → PDF al subir** — nunca servir PowerPoint al estudiante
7. **SSR para `/verificar`** — el estado del certificado debe ser tiempo real
8. **Magic Link, no contraseñas** — decisión de UX para el perfil de usuario

---

## 5. Variables de entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...       # solo en Edge Functions y API routes admin

# Cloudflare R2
R2_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=habilitas-content
R2_PUBLIC_URL=https://content.habilitas.co

# Resend
RESEND_API_KEY=...
RESEND_FROM_EMAIL=certificados@habilitas.co
```

---

## 6. Design System

### Fuentes

```
DM Serif Display  →  display / headings / precios / nombres en certificados
DM Sans           →  UI / body / botones / labels  (pesos: 300 400 500 600 700)
```

```
https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap
```

**DM Serif Display se usa SOLO en:**
- `h1` de la landing (hero title)
- Títulos de sección grandes (38px)
- Precios en la purchase card
- Nombre del profesional en el certificado (34px)
- Pantalla de celebración al aprobar (28px)

Todo lo demás — botones, labels, metadata, párrafos, nav — usa **DM Sans**.

### Tokens de color

```css
/* Primario de marca */
--teal:       #0A6E6E   /* botones, links, íconos */
--teal-light: #0E8F8F   /* hover, estados activos */
--teal-mid:   #C2E8E8   /* bordes de énfasis */
--teal-pale:  #E6F5F5   /* fondos suaves, badges */

/* Neutros oscuros */
--charcoal:   #1A2A2A   /* texto principal, dark backgrounds */
--slate:      #3D5454   /* texto secundario en contextos dark */

/* Neutros claros */
--mist:       #F2F8F8   /* background de secciones */
--sand:       #F7F3EE   /* background verificación */
--white:      #FFFFFF
--border:     #D4E4E4   /* bordes generales */

/* Textos */
--text-main:  #1A2A2A
--text-soft:  #5A7070
--text-muted: #8AACAC

/* Acento */
--amber:      #C8833A
--amber-pale: #FDF0E3

/* Semánticos */
--green-ok:   #1A7A4A   /* aprobado, activo, válido */
--green-pale: #E4F5EC
--red-err:    #C0392B   /* error, revocado */
--red-pale:   #FDE8E8
```

### Colores por categoría de certificación

Usar en: accent bar de card, texto `cert-category`, fondo de `btn-cert`.

| Categoría | Color | Hex |
|---|---|---|
| Soporte vital | teal | `#0A6E6E` |
| Procedimientos clínicos | amber | `#C8833A` |
| Bioseguridad | green | `#1A7A4A` |
| Farmacología | teal | `#0A6E6E` |
| Urgencias y emergencias | red | `#C0392B` |
| Enfermería | blue | `#2E86AB` |

### Espaciado y radios

```
--space-section: 60px   /* padding horizontal secciones grandes */
--space-hero:    72px   /* padding vertical hero y secciones */
--radius:        12px   /* cards medias, inputs, badges */
--radius-lg:     20px   /* cards grandes, modales, purchase card */
```

### Sombras (teal-tinted)

```css
--shadow-sm: 0 2px 8px rgba(10,110,110,.08)    /* navbar, cards default */
--shadow-md: 0 6px 24px rgba(10,110,110,.12)   /* hover, modales ligeros */
--shadow-lg: 0 16px 48px rgba(10,110,110,.16)  /* modales overlay, hero card */
```

### ⚠️ Regla crítica del gradiente

```css
/* ✅ CORRECTO — solo en cert-doc-header (pantalla de verificación) */
.gradient-cert-header {
  background: linear-gradient(135deg, #0A6E6E 0%, #0A5050 100%);
}

/* ✗ NUNCA en: navbars, modales, CTA banners, heroes, topbars */
/* Para esos casos usar background: var(--teal) o var(--charcoal) sólido */
```

### Variantes de botones

| Variante | Uso | Fondo |
|---|---|---|
| `primary` | Acción principal | teal sólido |
| `primary large` | CTA de hero, purchase card | teal sólido, padding mayor |
| `ghost` | Acción secundaria | transparente, borde gris |
| `outline-white` | Sobre fondos teal/charcoal | transparente, borde blanco |
| `dark` | Topbar del curso | transparente, borde blanco sutil |
| `cert` | "Ver detalle" en catálogo | color de categoría |
| `verify-secondary` | Acciones en verificación | blanco, borde gris |

**Regla:** Un solo `btn-primary` visible por sección o formulario.

### Archivos entregados

| Archivo | Descripción |
|---|---|
| `tailwind.config.js` | Todos los tokens en Tailwind |
| `globals.css` | CSS variables + `@layer base` + reset |
| `Button.tsx` | Componente Button completo con TypeScript |
| `habilitas_mockup_v2.html` | Mockup funcional con 6 pantallas navegables |

### Componentes por construir (orden de prioridad)

1. `VerifyBanner.tsx` — estados válido / vencido / revocado
2. `CertDocument.tsx` — documento verificable con sello SVG y QR
3. `CertCard.tsx` — card del catálogo con variantes de categoría
4. `PurchaseCard.tsx` — card de compra del detalle
5. `Badge.tsx` — badges, pills, chips, difficulty dots
6. `Input.tsx` — search input con estados
7. `LessonViewer.tsx` — renderiza según `content_type`
8. `EvalModal.tsx` — modal de evaluación con timer y feedback

---

## 7. Base de datos

### Extensiones requeridas

```sql
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- búsqueda por texto
```

### Tablas

#### users
Extendida de `auth.users` de Supabase. No se crea manualmente — Supabase Auth la gestiona.

```sql
create table public.users (
  id            uuid references auth.users(id) on delete cascade primary key,
  full_name     text not null,
  profession    text,
  city          text,
  country       text default 'Colombia',
  rethus_number text,
  avatar_url    text,
  role          text default 'student'
                check (role in ('student', 'admin', 'instructor')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
```

#### courses

```sql
create table public.courses (
  id                 uuid default uuid_generate_v4() primary key,
  slug               text unique not null,
  title              text not null,
  subtitle           text,
  description        text,
  category           text not null
                     check (category in (
                       'soporte-vital', 'procedimientos-clinicos', 'bioseguridad',
                       'farmacologia', 'urgencias', 'enfermeria'
                     )),
  duration_hours     numeric(4,1),
  difficulty         text check (difficulty in ('basico', 'intermedio', 'avanzado')),
  price_cop          integer,              -- null = gratis en el MVP
  published          boolean default false,
  instructor_id      uuid references public.users(id),
  cert_validity_days integer default 365,
  pass_score         integer default 70,   -- puntaje mínimo %
  max_attempts       integer default 3,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
```

#### modules

```sql
create table public.modules (
  id          uuid default uuid_generate_v4() primary key,
  course_id   uuid references public.courses(id) on delete cascade not null,
  title       text not null,
  order_index integer not null,
  created_at  timestamptz default now()
);
```

#### lessons

```sql
create table public.lessons (
  id              uuid default uuid_generate_v4() primary key,
  module_id       uuid references public.modules(id) on delete cascade not null,
  title           text not null,
  order_index     integer not null,
  content_type    text not null
                  check (content_type in ('video', 'pdf', 'slides', 'image', 'text')),
  content_url     text,         -- URL base en R2 (nunca expuesta directamente)
  content_r2_key  text,         -- key real: courses/slug/mod1/clase1.mp4
  duration_min    integer,
  transcript      text,
  created_at      timestamptz default now()
);
-- Las presentaciones PPTX se convierten a PDF al subirse.
-- content_type='slides' → el archivo en R2 es .pdf
```

#### enrollments

```sql
create table public.enrollments (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references public.users(id) on delete cascade not null,
  course_id    uuid references public.courses(id) on delete cascade not null,
  enrolled_at  timestamptz default now(),
  completed_at timestamptz,
  unique(user_id, course_id)
);
```

#### lesson_progress

```sql
create table public.lesson_progress (
  id             uuid default uuid_generate_v4() primary key,
  user_id        uuid references public.users(id) on delete cascade not null,
  lesson_id      uuid references public.lessons(id) on delete cascade not null,
  completed      boolean default false,
  completed_at   timestamptz,
  time_spent_sec integer default 0,
  last_position  integer default 0,  -- segundos (para video)
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique(user_id, lesson_id)
);
```

#### evaluations

```sql
create table public.evaluations (
  id           uuid default uuid_generate_v4() primary key,
  course_id    uuid references public.courses(id) on delete cascade not null unique,
  title        text not null default 'Evaluación Final',
  duration_min integer default 45,
  instructions text,
  created_at   timestamptz default now()
);
```

#### questions

```sql
create table public.questions (
  id               uuid default uuid_generate_v4() primary key,
  evaluation_id    uuid references public.evaluations(id) on delete cascade not null,
  order_index      integer not null,
  text             text not null,
  context          text,              -- caso clínico opcional
  options          jsonb not null,    -- array de strings
  correct_option   integer not null,  -- índice 0-based
  feedback_correct text,
  feedback_wrong   text,
  created_at       timestamptz default now()
);
-- options: ["100-120/min", "80-100/min", "120-140/min", "60-80/min"]
```

#### eval_attempts

```sql
create table public.eval_attempts (
  id             uuid default uuid_generate_v4() primary key,
  user_id        uuid references public.users(id) on delete cascade not null,
  evaluation_id  uuid references public.evaluations(id) on delete cascade not null,
  attempt_number integer not null,
  score          integer,            -- 0-100
  passed         boolean,
  answers        jsonb,              -- { question_id: option_index }
  time_spent_sec integer,
  started_at     timestamptz default now(),
  submitted_at   timestamptz
);
```

#### certificates

```sql
create table public.certificates (
  id                      uuid default uuid_generate_v4() primary key,
  cert_id                 text unique not null,  -- 'HAB-2026-4872'
  user_id                 uuid references public.users(id) on delete cascade not null,
  course_id               uuid references public.courses(id) on delete cascade not null,
  eval_attempt_id         uuid references public.eval_attempts(id),
  score                   integer not null,
  status                  text default 'valid'
                          check (status in ('valid', 'expired', 'revoked')),
  issued_at               timestamptz default now(),
  expires_at              timestamptz not null,
  revoked_at              timestamptz,
  revoke_reason           text,
  -- Snapshot al momento de emisión
  professional_name       text not null,
  professional_profession text,
  instructor_name         text,
  instructor_role         text,
  verify_url              text
);
```

### Función: generate_cert_id

```sql
create or replace function generate_cert_id()
returns text as $$
declare
  year_part text := extract(year from now())::text;
  seq_num   text := lpad(
    (select count(*) + 1 from public.certificates
     where extract(year from issued_at) = extract(year from now()))::text,
    4, '0'
  );
begin
  return 'HAB-' || year_part || '-' || seq_num;
end;
$$ language plpgsql;
```

### Row Level Security (RLS)

```sql
-- Habilitar RLS
alter table public.users           enable row level security;
alter table public.enrollments     enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.eval_attempts   enable row level security;
alter table public.certificates    enable row level security;
alter table public.courses         enable row level security;
alter table public.modules         enable row level security;
alter table public.lessons         enable row level security;
alter table public.evaluations     enable row level security;
alter table public.questions       enable row level security;

-- Políticas de usuario
create policy "users_own"       on public.users           for all    using (auth.uid() = id);
create policy "enrollments_own" on public.enrollments     for all    using (auth.uid() = user_id);
create policy "progress_own"    on public.lesson_progress for all    using (auth.uid() = user_id);
create policy "attempts_own"    on public.eval_attempts   for all    using (auth.uid() = user_id);
create policy "certs_own_read"  on public.certificates    for select using (auth.uid() = user_id);

-- Certificados: lectura pública (para verificación por cert_id)
create policy "certs_public_verify" on public.certificates for select using (true);

-- Cursos y contenido: lectura pública si publicado
create policy "courses_public_read" on public.courses
  for select using (published = true);

create policy "modules_public_read" on public.modules
  for select using (
    exists (select 1 from public.courses where id = course_id and published = true)
  );

-- Lecciones: solo usuarios inscritos
create policy "lessons_enrolled_read" on public.lessons
  for select using (
    exists (
      select 1 from public.enrollments e
      join public.modules m on m.id = module_id
      where e.user_id = auth.uid() and e.course_id = m.course_id
    )
  );

-- Admin: acceso total
create policy "admin_all" on public.courses
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
```

### Índices

```sql
create index on public.enrollments(user_id);
create index on public.enrollments(course_id);
create index on public.lesson_progress(user_id, lesson_id);
create index on public.eval_attempts(user_id, evaluation_id);
create index on public.certificates(cert_id);
create index on public.certificates(user_id);
create index on public.modules(course_id, order_index);
create index on public.lessons(module_id, order_index);
```

### Vista: progreso por curso

```sql
create view public.course_progress as
select
  e.user_id,
  e.course_id,
  count(lp.id) filter (where lp.completed = true) as lessons_completed,
  count(l.id)                                      as lessons_total,
  round(
    count(lp.id) filter (where lp.completed = true)::numeric
    / nullif(count(l.id), 0) * 100
  ) as progress_pct
from public.enrollments e
join public.modules m on m.course_id = e.course_id
join public.lessons l on l.module_id = m.id
left join public.lesson_progress lp
  on lp.lesson_id = l.id and lp.user_id = e.user_id
group by e.user_id, e.course_id;
```

---

## 8. Capa de contenido

### Flujo completo

```
Equipo interno (2–5 personas)
  ↓ accede a
/admin  (Next.js, rol protegido)
  ↓ sube archivos a
Cloudflare R2  (storage + CDN)
  ↓ guarda metadata en
Supabase PostgreSQL  (lessons.content_r2_key, content_type)
  ↓ estudiante autenticado accede via
Next.js /curso/[slug]  →  URL firmada  →  archivo en R2
  ↓ al completar lección
lesson_progress actualizado en Supabase
  ↓ Edge Function evalúa desbloqueo
módulo N+1 disponible si módulo N completo
```

### Cloudflare R2 — estructura de carpetas

```
habilitas-content/
├── courses/
│   └── [course-slug]/
│       └── [order]-[module-slug]/
│           ├── [order]-[lesson-slug].mp4   ← video
│           ├── [order]-[lesson-slug].pdf   ← PDF o slides convertido
│           └── [order]-[lesson-slug].png   ← imagen
└── generated/
    └── certificates/
        └── HAB-2026-4872.pdf               ← PDF del certificado emitido
```

Ejemplos reales:
```
courses/soporte-vital-basico-bls/1-reconocimiento-pcr/1-fisiopatologia.mp4
courses/soporte-vital-basico-bls/1-reconocimiento-pcr/2-cadena-supervivencia.pdf
courses/bioseguridad-iaas/2-residuos/1-clasificacion.pdf
```

### URLs firmadas (`lib/r2.ts`)

El frontend nunca expone URLs directas de R2. Siempre usa URLs firmadas con expiración corta.

```typescript
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function getSignedLessonUrl(
  r2Key: string,
  expiresInSeconds = 3600   // 1h para video, 900 (15min) para documentos
): Promise<string> {
  return getSignedUrl(r2, new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: r2Key,
  }), { expiresIn: expiresInSeconds })
}
```

### Tipos de contenido y componente de render

| `content_type` | Archivo en R2 | Componente |
|---|---|---|
| `video` | `.mp4` | `<video>` nativo con controles |
| `pdf` | `.pdf` | `<iframe>` o PDF.js viewer |
| `slides` | `.pdf` (convertido desde PPTX) | mismo que pdf |
| `image` | `.png` / `.jpg` | `<img>` con zoom |
| `text` | — (contenido en DB) | Markdown renderer |

Las presentaciones `.pptx` se convierten a PDF al subirse via Edge Function. El estudiante siempre recibe PDF — nunca PowerPoint.

### Panel `/admin` — rutas

```
/admin                          → dashboard (publicados vs borradores)
/admin/cursos                   → lista de cursos
/admin/cursos/nuevo             → crear curso
/admin/cursos/[slug]            → editar curso
/admin/cursos/[slug]/modulos    → gestionar módulos y lecciones
/admin/certificados             → ver emitidos, revocar
```

Flujo para crear un curso:
1. Crear curso (título, categoría, dificultad, instructor)
2. Crear módulos (título, orden)
3. Crear lecciones (título, orden, tipo, subir archivo → R2)
4. Crear evaluación + banco de preguntas
5. Publicar

### Upload directo a R2

El archivo sube desde el browser directo a R2 via presigned PUT URL — no pasa por el servidor Next.js.

```typescript
// app/api/admin/upload-url/route.ts
// Recibe: { courseSlug, moduleOrder, lessonSlug, fileExtension }
// Devuelve: { uploadUrl, r2Key }
// El cliente hace PUT a uploadUrl
// Luego guarda r2Key en Supabase
```

### Edge Function — desbloqueo de módulos

```typescript
// supabase/functions/check-module-unlock/index.ts
// Llamada al completar una lección.
// Lógica: módulo N disponible si todas las lecciones de módulo N-1
// tienen completed=true para ese usuario.
// No hay tabla de "módulo desbloqueado" — es calculado en runtime.
// Si todos los módulos completados → habilitar evaluación final.
```

---

## 9. Certificados

### Anatomía

```
ID único:  HAB-2026-4872
URL:       habilitas.co/verificar/HAB-2026-4872
Estados:   valid | expired | revoked
```

### Flujo de emisión

```
Usuario aprueba evaluación (score ≥ pass_score)
  ↓
eval_attempts.passed = true
  ↓
Edge Function: emit-certificate
  ├── Genera cert_id via generate_cert_id()
  ├── Calcula expires_at = issued_at + cert_validity_days
  ├── Snapshot de nombre, profesión e instructor
  ├── Inserta en certificates
  ├── (Fase 2) Genera PDF → sube a R2 en generated/certificates/
  └── Resend → email al profesional con cert_id y URL
```

### Estados

| Estado | Condición | UI |
|---|---|---|
| `valid` | `status='valid'` y `expires_at > now()` | Banner verde · ✓ |
| `expired` | `expires_at <= now()` (calculado en runtime) | Banner amber · ⚠ |
| `revoked` | `status='revoked'` | Banner rojo · ✗ |

Solo admins pueden revocar desde `/admin/certificados`.

### Página de verificación pública (`/verificar/[id]`)

SSR obligatorio — `export const dynamic = 'force-dynamic'`.

```typescript
// app/verificar/[id]/page.tsx
export default async function VerifyPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()

  const { data: cert } = await supabase
    .from('certificates')
    .select('*, users(full_name, profession), courses(title, category)')
    .eq('cert_id', params.id)
    .single()

  if (!cert) return <CertNotFound />

  const isExpired = new Date(cert.expires_at) < new Date()
  const status = cert.status === 'revoked' ? 'revoked'
               : isExpired               ? 'expired'
               :                           'valid'

  return <VerifyPage cert={cert} status={status} />
}

export const dynamic = 'force-dynamic'
```

### Componente CertDocument

El header del certificado es el **único lugar** donde se usa el gradiente teal:

```tsx
<div className="gradient-cert-header">
  {/* Logo Habilitas · Sello SVG · cert_id */}
</div>
```

El cuerpo incluye: nombre del profesional (DM Serif Display 34px), grid de campos, firmas del instructor con línea horizontal, footer con QR SVG + URL de verificación.

### Renovación

Cuando un certificado vence, el profesional puede volver al curso y rendir la evaluación nuevamente. Al aprobar se emite un nuevo certificado con nuevo `cert_id` y nueva `expires_at`. El certificado anterior queda con `status: 'expired'` — no se elimina.

### Email de emisión (Resend)

```
Asunto: Tu certificado Habilitas está listo — [Nombre del curso]
Cuerpo:
  - Nombre del profesional
  - Curso y puntaje obtenido
  - Fecha de vencimiento
  - Botón "Ver mi certificado" → habilitas.co/verificar/HAB-YYYY-NNNN
  - "Comparte este enlace con tu empleador para verificación inmediata"
```
