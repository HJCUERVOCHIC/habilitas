# Habilitas — testing

## Suite unitaria (por defecto, corre en CI)

Cubre lógica pura sin base de datos: parsers YAML, slugify, categorías,
progreso, evaluación, constancias, utilidades.

```bash
npm test              # una pasada
npm run test:watch    # modo watch
```

Config: `vitest.config.ts`. Include `src/**/*.test.ts`, excluye
`src/tests/e2e/**` (esos corren aparte, contra un Supabase de test).

## Suite e2e (RLS + server actions con Supabase real)

Cubre lo que solo puede validarse contra Postgres+GoTrue+PostgREST reales:

- Aislamiento RLS entre estudiantes.
- Cursos en borrador invisibles al estudiante.
- La respuesta correcta nunca sale al cliente (RLS de `questions`).
- Idempotencia de inscripción y del UNIQUE de constancias.
- Importación YAML rechaza slug duplicado (Opción A).

Es **opt-in** y NO corre en CI. Se salta limpiamente si falta cualquier
variable de `.env.test.local`.

### Prerrequisito: un Supabase de test AISLADO

**Nunca** apuntes esta suite al Supabase de producción. Los tests siembran
usuarios y cursos con prefijo `e2e-<runId>-` y luego los borran, pero la
regla es: entorno separado.

Dos caminos:

#### A. Supabase CLI local (recomendado)

Requiere Docker Desktop y la [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
supabase start                    # en la raíz del repo
supabase db reset --local         # aplica migraciones/seed
```

`supabase start` imprime las URLs y claves locales. Cópialas al archivo de
entorno de tests (ver siguiente sección). URLs típicas:

- API: `http://127.0.0.1:54321`
- DB : `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

Al ser local, no hay riesgo de tocar datos reales.

#### B. Proyecto Supabase de test separado

Crea un proyecto en Supabase distinto del de producción. Aplica todas las
migraciones de `supabase/migrations/` en ese proyecto. El guardarraíl anti-prod
rechaza URLs `.supabase.co` por defecto; para autorizar un proyecto hospedado
de test debes fijar además `E2E_ALLOW_HOSTED=1` en `.env.test.local`.

### Configuración del entorno de tests

```bash
cp .env.test.local.example .env.test.local
# edita .env.test.local y llena las 4 variables:
#   E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY,
#   E2E_SUPABASE_SERVICE_ROLE_KEY, E2E_SUPABASE_DB_URL
```

`.env.test.local` está en `.gitignore` implícito por el patrón `.env*.local`
que ya usa el repo (nunca se commitea).

### Correr los e2e

```bash
npm run test:e2e
```

Config: `vitest.e2e.config.ts` (singleFork, timeout 30s por hook). El archivo
`src/tests/e2e/env.ts` carga `.env.test.local` al importar; si falta cualquier
variable, cada suite se salta con `describe.skipIf` y `npm run test:e2e`
igual devuelve exit 0. Si el URL apunta a un host hospedado sin
`E2E_ALLOW_HOSTED=1`, aborta con un error claro.

### Datos de prueba

Cada test file genera un `runId` de 8 hex. Todo lo que siembra usa ese
prefijo (`e2e-<runId>-*` para slugs, `e2e-<runId>-*@test.habilitas.local`
para emails). El `afterAll` de cada suite borra el curso (cascada) y los
usuarios (cascada a `public.users`). El teardown es idempotente.

### Qué cubre y qué no

Estos 5 tests son el **primer** anillo, orientado a garantías de seguridad
y contratos duros. No cubren:

- Flujos de UI (Playwright — fuera del alcance de esta tanda).
- Reproductor de lecciones / progreso `≥90%` (parte se valida en unit tests
  de `course-progress.ts`).
- Envío de email (Resend) — se ejercita en el flujo real; no bloquea si
  falla.

Ver `PLAN-PRUEBAS-INTEGRAL-PLATAFORMA.md` (cuando exista) para el mapa
completo previsto.
