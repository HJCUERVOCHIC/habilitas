# Habilitas

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)

<!-- Reemplazá OWNER/REPO por tu organización y repositorio de GitHub. -->

Plataforma de certificación de habilidades clínicas para profesionales de la salud en Colombia.
**Flujo del MVP:** cursos → evaluación → **certificado verificable**. Sin pasarela de pagos.

> Fuentes de verdad: `HABILITAS-ESPECIFICACION-FUNCIONAL.md` (qué/reglas), `HABILITAS-STACK.md` (cómo técnico), `habilitas-setup-README.md` (design system). Este README es el **runbook de despliegue**.

---

## Stack

Next.js 14 (App Router) · TypeScript estricto · Tailwind v3 + design system propio · shadcn/ui (base) · Supabase (Auth Magic Link · Postgres + RLS) · Cloudflare R2 (contenido) · Resend (email) · Vercel.

---

## 1. Desarrollo local

```bash
npm install
cp .env.local.example .env.local   # y completar valores (ver §3)
npm run dev                         # http://localhost:3000
```

Verificaciones:

```bash
npm run type-check   # tsc --noEmit (sin any)
npm run lint
npm test             # vitest (cn, categorías, desbloqueo de módulos)
npm run build        # build de producción
```

> En Windows, no corras `npm run dev` y `npm run build`/`npm start` a la vez: pelean por `.next/` (`EPERM`). Corré uno a la vez.

---

## 2. Base de datos (Supabase) — migraciones

Las migraciones están en `supabase/migrations/`, **en orden**:

| Archivo | Contenido |
|---|---|
| `0000_init.sql` | Extensiones, 10 tablas, `generate_cert_id()`, RLS + políticas, índices, vista `course_progress`, trigger `handle_new_user`. |
| `0001_course_objectives.sql` | `courses.learning_objectives text[]`. |
| `0002_instructors_public.sql` | Vista `instructors_public` (datos seguros del instructor). |
| `0003_attempt_questions.sql` | `eval_attempts.question_ids uuid[]` (sorteo del intento). |
| `0004_unique_cert_per_attempt.sql` | Índice único `certificates(eval_attempt_id)` (idempotencia de emisión). |
| `0005_certificate_lookup_rpc.sql` | Reemplaza lectura pública abierta por la función `get_certificate(cert_id)`. |

**Aplicarlas** (a la base apuntada por `SUPABASE_DB_URL`):

```bash
# una por una, en orden (el script recarga el schema cache de PostgREST):
npm run db:apply 0000_init.sql
npm run db:apply 0001_course_objectives.sql
npm run db:apply 0002_instructors_public.sql
npm run db:apply 0003_attempt_questions.sql
npm run db:apply 0004_unique_cert_per_attempt.sql
npm run db:apply 0005_certificate_lookup_rpc.sql

npm run db:verify   # comprueba tablas, RLS, vista, función, trigger
```

Alternativa: pegar cada archivo en el **SQL Editor** de Supabase (mismo orden).

**Datos de demo** (opcional, no producción): `npm run db:seed` crea 4 cursos, banco de preguntas BLS y 3 certificados de ejemplo.

> `SUPABASE_DB_URL` usa el **Session pooler** (`...pooler.supabase.com:5432`), no el host directo. Lo tomás de Supabase → Settings → Database → Connection string → *Session pooler*.

---

## 3. Variables de entorno

`.env.local` local; en Vercel se cargan en Project → Settings → Environment Variables.

| Variable | Ámbito | Dónde se usa |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | público | clientes Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | público | clientes Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **secreto** | emisión de certs, panel admin (server actions) |
| `NEXT_PUBLIC_SITE_URL` | público | redirect del Magic Link y `verify_url`/QR — **debe ser el dominio real en prod** |
| `SUPABASE_DB_URL` | **secreto** | scripts `db:*` (no lo necesita el runtime de la app) |
| `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | **secreto** | contenido por URL firmada (slice 3) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | **secreto** | email de emisión de certificado |

> Las llaves `R2_*` y `RESEND_*` son **opcionales**: sin ellas la app funciona con *fallback* (el contenido muestra "R2 pendiente"; el email se omite y se loguea). La emisión del certificado y su verificación funcionan igual.

---

## 4. Configurar Supabase Auth (Magic Link)

En Supabase → Authentication → **URL Configuration**:

- **Site URL**: el dominio de producción (ej. `https://habilitas.co`).
- **Redirect URLs**: agregar `https://<dominio>/**` y `http://localhost:3000/**` (para dev).

**Rate limit de email:** el SMTP integrado de Supabase es solo para pruebas (pocos correos/hora). Para producción, configurar **SMTP propio con Resend** en Authentication → Settings → SMTP:

- Host `smtp.resend.com` · Puerto `587` · Usuario `resend` · Password = `RESEND_API_KEY`.
- Requiere un dominio verificado en Resend para el remitente (`RESEND_FROM_EMAIL`).

---

## 5. Cloudflare R2 (contenido)

1. Crear bucket `habilitas-content` y un API token (Access Key / Secret).
2. Cargar las `R2_*` en Vercel.
3. Estructura de claves: `courses/<slug>/<orden>-<modulo>/<orden>-<leccion>.<ext>` (ver `HABILITAS-STACK.md §8`).
4. En `/admin`, al crear una lección se define `content_type` y la `content_r2_key`.

Sin R2 configurado, el reproductor muestra el contenido como "pendiente"; el resto del flujo (progreso, desbloqueo, evaluación) funciona.

---

## 6. Despliegue en Vercel

1. **Conectar el repo** en Vercel (framework: Next.js, autodetectado). Build command `next build`, output por defecto. Node 18+.
2. **Cargar las variables** de §3 (marcar como *Production* y *Preview* según corresponda; los secretos NO con prefijo `NEXT_PUBLIC_`).
3. **Aplicar las migraciones** a la base de producción (§2) **antes** del primer tráfico real. Si prod y dev son proyectos Supabase distintos, apuntá `SUPABASE_DB_URL` al de prod y corré los `db:apply` en orden.
4. **Configurar Auth URLs** (§4) con el dominio de Vercel/producción.
5. **Deploy.** Vercel construye y publica.
6. Asignar un admin: `npm run admin:grant -- correo@dominio.co admin` (apuntando a la base de prod vía `.env.local`).

---

## 7. Checklist post-deploy (smoke test)

- [ ] `/` carga (landing, sin auth).
- [ ] `/certificaciones` lista cursos publicados; filtro por categoría funciona.
- [ ] `/verificar/<cert_id>` muestra estado correcto; un id inexistente muestra "no encontrado" (no 500).
- [ ] Magic Link: pedir enlace en `/ingresar`, abrir el correo, quedar autenticado (crea fila en `public.users`).
- [ ] Ruta protegida: `/perfil`, `/curso/...`, `/admin` sin sesión → redirige a `/ingresar`.
- [ ] `/admin` con usuario no-admin → redirige fuera; con admin → panel visible.
- [ ] Inscribirse a un curso, completar lecciones, aprobar evaluación → emite certificado y redirige a `/verificar/<id>`.
- [ ] Revocar un certificado en `/admin/certificados` → su `/verificar/<id>` muestra "Revocado" al instante.

---

## 8. Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run type-check` / `lint` / `test` | calidad |
| `npm run db:apply [archivo.sql]` | aplica una migración + recarga schema cache (default `0000_init.sql`) |
| `npm run db:verify` | verifica el schema aplicado |
| `npm run db:seed` | datos de demo (no producción) |
| `npm run db:types` | regenera `src/types/database.ts` (requiere `SUPABASE_ACCESS_TOKEN`) |
| `npm run auth:link -- correo` | genera un Magic Link sin enviar email (debug) |
| `npm run admin:grant -- correo [rol]` | asigna rol (`admin` por defecto) |

---

## 9. Limitaciones conocidas / pendientes

- **Tipos de DB a mano:** `src/types/database.ts` se mantiene sincronizado con las migraciones; `db:types` necesita `SUPABASE_ACCESS_TOKEN` (o Docker) para regenerarlo canónicamente.
- **Emisión de certificado:** implementada como server action (no Edge Function desplegada); mismo modelo de seguridad (service role en servidor). Migrable a Edge Function.
- **R2 / Resend:** con *fallback* hasta cargar credenciales.
- **Subida de archivos en admin:** por ahora se ingresa la `content_r2_key`; el PUT prefirmado entra al configurar R2.
- **Evaluación no supervisada:** en línea, sin verificación de identidad (limitación de producto conocida, fuera del MVP).
